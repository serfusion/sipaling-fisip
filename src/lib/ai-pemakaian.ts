// ============================================================
// PEMAKAIAN AI — dicatat per bulan, per kunci, dan per fitur
//
// Dua pertanyaan yang dulu tidak dapat dijawab siapa pun:
//
//   1. "Kuota kita habis karena apa?" — berapa panggilan bulan ini, lewat
//      kunci mana, untuk fitur apa. Tanpa catatan ini kuota habis baru
//      ketahuan ketika transkrip gagal di tengah ujian.
//   2. "Kunci utama sebenarnya masih hidup?" — cadangan otomatis membuat
//      kunci yang mati tidak terasa, dan justru karena itu ia bisa mati
//      berminggu-minggu tanpa ketahuan. Setiap kali kunci utama gagal dan
//      cadangan terpakai, Super Admin mendapat notifikasi.
//
// ------------------------------------------------------------
// DISIMPAN DI app_settings, SATU BARIS PER KUNCI PER BULAN
// ------------------------------------------------------------
//   aip:2026-09:k:<id kunci>   pemakaian satu kunci
//   aip:2026-09:f:<fitur>      pemakaian satu fitur
//
// Tanpa tabel baru, jadi tanpa migrasi. Penambahannya ATOMIK di Postgres
// (INSERT … ON CONFLICT DO UPDATE yang menjumlah di dalam basis data), bukan
// baca-lalu-tulis dari aplikasi: dua peserta yang ditranskrip bersamaan
// tidak boleh saling menimpa hitungannya.
//
// Pencatatan TIDAK PERNAH menggagalkan permintaan AI-nya. Catatan yang
// hilang adalah satu angka yang kurang; permintaan yang gagal karena
// pencatatnya adalah soal ujian yang tidak jadi.
// ============================================================
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq, like, sql } from "drizzle-orm";
import { pushNotification } from "@/lib/notify";
import { LABEL_PENYEDIA, type PenyediaAi } from "@/lib/ai-kunci";

/** Bulan berjalan menurut jam Indonesia (WIB), mis. "2026-09". */
export function bulanIni(saat: Date = new Date()): string {
  return new Date(saat.getTime() + 7 * 3600_000).toISOString().slice(0, 7);
}

export type CatatanPemakaian = {
  ok: number;
  gagal: number;
  masuk: number;
  keluar: number;
  penyedia?: string;
  label?: string;
  galat?: string;
  waktuGalat?: string;
  terakhir?: string;
};

/** Nama fitur yang dicatat — sengaja pendek; kunci setelan dibatasi 64 huruf. */
export type FiturAi = "Buat soal" | "Penilaian esai" | "Transkrip suara" | "Pemeriksa kamera" | "Uji kunci" | "Lainnya";

async function tambah(
  kunci: string,
  inc: { ok: number; gagal: number; masuk: number; keluar: number },
  tetap: { penyedia?: string; label?: string; galat?: string },
) {
  const sekarang = new Date().toISOString();
  const awal: CatatanPemakaian = {
    ...inc,
    ...tetap,
    terakhir: sekarang,
    ...(tetap.galat ? { waktuGalat: sekarang } : {}),
  };
  // Penjumlahan terjadi DI DALAM Postgres. `excluded` adalah baris yang
  // sedang dicoba masukkan; nilainya dijumlahkan pada yang sudah ada.
  const tambahan = sql`jsonb_build_object(
      'ok', coalesce((${appSettings.value}::jsonb->>'ok')::int, 0) + ${inc.ok},
      'gagal', coalesce((${appSettings.value}::jsonb->>'gagal')::int, 0) + ${inc.gagal},
      'masuk', coalesce((${appSettings.value}::jsonb->>'masuk')::bigint, 0) + ${inc.masuk},
      'keluar', coalesce((${appSettings.value}::jsonb->>'keluar')::bigint, 0) + ${inc.keluar},
      'terakhir', ${sekarang}::text
    )`;
  const tetapJson = JSON.stringify({
    ...(tetap.penyedia ? { penyedia: tetap.penyedia } : {}),
    ...(tetap.label ? { label: tetap.label } : {}),
    ...(tetap.galat ? { galat: tetap.galat.slice(0, 300), waktuGalat: sekarang } : {}),
  });
  await db
    .insert(appSettings)
    .values({ key: kunci, value: JSON.stringify(awal), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        // Galat lama dipertahankan sampai ada galat baru: yang ingin dilihat
        // Super Admin adalah KAPAN terakhir kunci ini gagal dan kenapa.
        value: sql`(${appSettings.value}::jsonb || ${tambahan} || ${tetapJson}::jsonb)::text`,
        updatedAt: new Date(),
      },
    });
}

/** Catat satu panggilan ke satu kunci. Tidak pernah melempar galat. */
export async function catatPanggilan(input: {
  kunciId: string;
  penyedia: PenyediaAi;
  label: string;
  fitur: FiturAi;
  berhasil: boolean;
  masuk?: number;
  keluar?: number;
  galat?: string;
}): Promise<void> {
  const bulan = bulanIni();
  const inc = {
    ok: input.berhasil ? 1 : 0,
    gagal: input.berhasil ? 0 : 1,
    masuk: Math.max(0, Math.round(input.masuk ?? 0)),
    keluar: Math.max(0, Math.round(input.keluar ?? 0)),
  };
  try {
    await Promise.all([
      tambah(`aip:${bulan}:k:${input.kunciId}`.slice(0, 64), inc, {
        penyedia: input.penyedia,
        label: input.label,
        galat: input.berhasil ? undefined : input.galat,
      }),
      tambah(`aip:${bulan}:f:${input.fitur}`.slice(0, 64), inc, {}),
    ]);
  } catch (galat) {
    console.error("catat pemakaian AI", galat);
  }
}

/**
 * Beri tahu Super Admin bahwa kunci utama gagal.
 *
 * DIBATASI satu kali per jam. Kunci yang mati tetap gagal pada setiap
 * permintaan berikutnya, dan pemeriksa kamera memanggil AI beberapa kali per
 * menit per peserta — tanpa batas ini satu kunci mati menghasilkan ratusan
 * notifikasi dalam satu ujian, dan lonceng yang terus berbunyi berhenti
 * dibaca. Batasnya disimpan di basis data, bukan di memori, karena tiap
 * permintaan di Vercel dapat berjalan pada mesin yang berbeda.
 */
export async function laporkanKunciGagal(input: {
  gagal: Array<{ penyedia: PenyediaAi; label: string; sebab: string }>;
  /** Kunci yang akhirnya berhasil, atau null bila semuanya gagal. */
  dipakai: { penyedia: PenyediaAi; label: string } | null;
  fitur: FiturAi;
}): Promise<void> {
  if (input.gagal.length === 0) return;
  try {
    const sejamLalu = new Date(Date.now() - 3600_000).toISOString();
    const sekarang = new Date().toISOString();
    // Diklaim secara ATOMIK: hanya permintaan yang berhasil memperbarui
    // barisnya yang mengirim notifikasi. Dua permintaan yang gagal bersamaan
    // tidak mengirim dua notifikasi.
    const klaim = await db
      .insert(appSettings)
      .values({ key: "ai_lapor_terakhir", value: sekarang, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: sekarang, updatedAt: new Date() },
        setWhere: sql`${appSettings.value} < ${sejamLalu}`,
      })
      .returning({ key: appSettings.key });
    if (klaim.length === 0) return;

    const daftarGagal = input.gagal
      .map((g) => `• ${LABEL_PENYEDIA[g.penyedia]} (${g.label}): ${g.sebab.slice(0, 160)}`)
      .join("\n");
    const semuaMati = input.dipakai === null;

    await pushNotification({
      audienceRole: "super_admin",
      kind: "ai-kunci",
      severity: "urgent",
      title: semuaMati
        ? `Semua kunci AI gagal — fitur "${input.fitur}" tidak berjalan`
        : `Kunci AI utama gagal — cadangan ${LABEL_PENYEDIA[input.dipakai!.penyedia]} dipakai`,
      body:
        `${semuaMati ? "Tidak ada kunci yang berhasil." : `Permintaan "${input.fitur}" tetap berhasil lewat ${input.dipakai!.label}.`}\n\n` +
        `Yang gagal:\n${daftarGagal}\n\n` +
        "Periksa di Dashboard → Kunci AI. Notifikasi ini dikirim paling banyak sekali per jam.",
    });
  } catch (galat) {
    console.error("lapor kunci AI gagal", galat);
  }
}

// ------------------------------------------------------------
// BATAS BULANAN PER FITUR
// ------------------------------------------------------------
// Pemeriksa kamera memanggil AI beberapa kali per menit per peserta; tanpa
// batas ia dapat menghabiskan kuota sebelum transkrip suara sempat berjalan.
// 0 atau kosong = tanpa batas. Yang dihitung: panggilan berhasil + gagal.

export const FITUR_BERBATAS: FiturAi[] = ["Buat soal", "Penilaian esai", "Transkrip suara", "Pemeriksa kamera"];
const KUNCI_BATAS = "ai_batas";

export async function bacaBatas(): Promise<Partial<Record<FiturAi, number>>> {
  try {
    const b = await db.select().from(appSettings).where(eq(appSettings.key, KUNCI_BATAS)).limit(1);
    return b[0] ? (JSON.parse(b[0].value) as Partial<Record<FiturAi, number>>) : {};
  } catch {
    return {};
  }
}

export async function simpanBatas(masuk: Record<string, unknown>): Promise<void> {
  const rapi: Partial<Record<FiturAi, number>> = {};
  for (const f of FITUR_BERBATAS) {
    const n = Math.max(0, Math.floor(Number(masuk[f]) || 0));
    if (n > 0) rapi[f] = n;
  }
  const nilai = JSON.stringify(rapi);
  await db
    .insert(appSettings)
    .values({ key: KUNCI_BATAS, value: nilai, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: nilai, updatedAt: new Date() } });
}

/** null = boleh jalan; selain itu pesan penolakannya. Tidak pernah melempar. */
export async function cekBatas(fitur: FiturAi): Promise<string | null> {
  try {
    const batas = (await bacaBatas())[fitur];
    if (!batas) return null;
    const b = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, `aip:${bulanIni()}:f:${fitur}`.slice(0, 64)))
      .limit(1);
    if (!b[0]) return null;
    const c = JSON.parse(b[0].value) as CatatanPemakaian;
    const pakai = (c.ok ?? 0) + (c.gagal ?? 0);
    return pakai >= batas
      ? `Batas bulanan fitur "${fitur}" (${batas} panggilan) sudah tercapai. Naikkan di Dashboard → Kunci AI.`
      : null;
  } catch {
    return null;
  }
}

export type RingkasanBulan = {
  bulan: string;
  kunci: Array<{ id: string } & CatatanPemakaian>;
  fitur: Array<{ nama: string } & CatatanPemakaian>;
};

/** Pemakaian satu bulan, untuk ditampilkan di panel Kunci AI. */
export async function bacaPemakaian(bulan = bulanIni()): Promise<RingkasanBulan> {
  const hasil: RingkasanBulan = { bulan, kunci: [], fitur: [] };
  try {
    const baris = await db.select().from(appSettings).where(like(appSettings.key, `aip:${bulan}:%`));
    for (const b of baris) {
      let isi: CatatanPemakaian;
      try { isi = JSON.parse(b.value) as CatatanPemakaian; } catch { continue; }
      const [, , jenis, ...sisa] = b.key.split(":");
      const nama = sisa.join(":");
      if (jenis === "k") hasil.kunci.push({ id: nama, ...isi });
      else if (jenis === "f") hasil.fitur.push({ nama, ...isi });
    }
  } catch {
    // Belum ada catatan, atau basis data belum siap.
  }
  hasil.kunci.sort((a, b) => b.ok + b.gagal - (a.ok + a.gagal));
  hasil.fitur.sort((a, b) => b.ok + b.gagal - (a.ok + a.gagal));
  return hasil;
}

/** Bulan-bulan yang punya catatan, terbaru dulu. */
export async function daftarBulan(): Promise<string[]> {
  try {
    const baris = await db.select({ key: appSettings.key }).from(appSettings).where(like(appSettings.key, "aip:%"));
    return [...new Set(baris.map((b) => b.key.split(":")[1]))].filter(Boolean).sort().reverse();
  } catch {
    return [];
  }
}
