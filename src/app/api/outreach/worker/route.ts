// ============================================================
// PEKERJA ANTREAN OUS
//
// Satu putaran: ambil beberapa surat dari antrean, kirim, catat hasilnya.
// Dipanggil berkali-kali; tidak ada satu pun panggilan yang mengirim seluruh
// kampanye sekaligus. Itulah inti dari "50–100 per hari" — dan alasan kenapa
// blueprint melarang keras mengirim seribu surat di dalam satu permintaan
// HTTP: permintaan itu akan mati di tengah, dan tidak ada yang tahu surat ke
// berapa yang sudah keluar.
//
// ------------------------------------------------------------
// DUA PINTU, DUA CARA MEMBUKTIKAN WEWENANG
// ------------------------------------------------------------
//   GET  — untuk penjadwal. Membuktikan diri dengan CRON_SECRET pada kepala
//          Authorization, persis seperti /api/cleanup.
//   POST — untuk tombol "proses antrean" di panel. Membuktikan diri dengan
//          sesi login, dan karenanya ikut diperiksa CSRF oleh middleware.
//
// GET SENGAJA mengubah data, yang biasanya keliru. Pengecualiannya di sini
// disengaja dan sama seperti /api/cleanup: penjadwal Vercel hanya mengirim
// GET, dan kuncinya tidak pernah dimiliki peramban siapa pun.
// ============================================================

import {
  galatSementara,
  izinKirim,
  jedaBerikutnya,
  jedaCobaUlang,
} from "@/lib/outreach";
import { kirimSurat, rakitSurat } from "@/lib/outreach-kirim";
import { gerbangOus } from "@/lib/outreach-gerbang";
import {
  bacaOus,
  catatAudit,
  cekalUntuk,
  keadaanAntrean,
  kembalikanKeAntrean,
  klaimAntrean,
  mulaiPemanasan,
  segarkanHitung,
  tandaiGagal,
  tandaiTerkirim,
  tandaiTercekal,
  tundaCobaUlang,
} from "@/lib/outreach-store";
import { explainServerError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Paling banyak sekian surat dalam satu putaran, apa pun jatah yang tersisa. */
const SATU_PUTARAN = 5;

/**
 * Anggaran waktu satu putaran.
 *
 * Pekerja menunggu jeda di antara surat, dan penungguan itu harus berhenti
 * sebelum fungsinya dimatikan paksa. Surat yang sudah diklaim tetapi belum
 * sempat dikirim dikembalikan ke antrean sebelum putaran ditutup.
 */
const ANGGARAN_MS = 45_000;

function tidur(ms: number) {
  return new Promise((lanjut) => setTimeout(lanjut, ms));
}

function samaWaktuTetap(a: string, b: string) {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

function kunciCocok(request: Request) {
  const rahasia = process.env.CRON_SECRET || "";
  if (!rahasia) return false;
  return samaWaktuTetap(request.headers.get("authorization") || "", `Bearer ${rahasia}`);
}

type Hasil = {
  diproses: number;
  terkirim: number;
  gagal: number;
  ditunda: number;
  dilewati: number;
  sisaDikembalikan: number;
  alasanBerhenti: string;
};

async function jalankanPutaran(): Promise<Hasil> {
  const hasil: Hasil = {
    diproses: 0, terkirim: 0, gagal: 0, ditunda: 0, dilewati: 0,
    sisaDikembalikan: 0, alasanBerhenti: "",
  };

  const state = await bacaOus();
  const keadaan = await keadaanAntrean();
  const izin = izinKirim(state, keadaan, new Date());
  if (!izin.boleh) {
    hasil.alasanBerhenti = izin.alasan;
    return hasil;
  }

  const klaim = await klaimAntrean(Math.min(SATU_PUTARAN, izin.jatah));
  if (klaim.length === 0) {
    hasil.alasanBerhenti = "Tidak ada surat yang mengantre.";
    return hasil;
  }

  // Daftar cekal diperiksa SEKALI LAGI di sini, walau sudah diperiksa saat
  // kampanye dibuat. Di antara keduanya bisa lewat berhari-hari, dan orang
  // yang menekan "berhenti langganan" kemarin tidak boleh menerima surat yang
  // sudah telanjur mengantre sejak minggu lalu.
  const cekal = await cekalUntuk(klaim.map((item) => item.email));

  const mulai = Date.now();
  const kampanyeTersentuh = new Set<number>();
  let pertamaSungguhan = false;
  let i = 0;

  for (; i < klaim.length; i++) {
    const surat = klaim[i];
    kampanyeTersentuh.add(surat.campaignId);

    const alasanCekal = cekal.get(surat.email);
    if (alasanCekal) {
      await tandaiTercekal(surat.id, alasanCekal);
      hasil.dilewati += 1;
      hasil.diproses += 1;
      continue;
    }

    const rakitan = rakitSurat({ ...surat, idem: `cr${surat.id}` }, state);
    const kirim = await kirimSurat(rakitan, surat.simulasi);
    hasil.diproses += 1;

    if (kirim.ok) {
      await tandaiTerkirim(surat.id, kirim.messageId);
      hasil.terkirim += 1;
      if (!kirim.simulasi) pertamaSungguhan = true;
    } else if (galatSementara(kirim.kode)) {
      const jeda = jedaCobaUlang(surat.attempts);
      if (jeda === null) {
        await tandaiGagal(surat.id, kirim.kode, `Menyerah sesudah ${surat.attempts} percobaan: ${kirim.pesan}`);
        hasil.gagal += 1;
      } else {
        await tundaCobaUlang(surat.id, jeda, kirim.kode, kirim.pesan);
        hasil.ditunda += 1;
      }
    } else {
      await tandaiGagal(surat.id, kirim.kode, kirim.pesan);
      hasil.gagal += 1;
    }

    // --- jeda sebelum surat berikutnya ---
    //
    // Hanya untuk kiriman SUNGGUHAN. Simulasi tidak menyentuh reputasi domain
    // apa pun, dan gladi bersih yang berjalan selambat aslinya tidak pernah
    // sempat diselesaikan siapa pun.
    if (i < klaim.length - 1 && !surat.simulasi) {
      const jeda = jedaBerikutnya(state);
      if (Date.now() - mulai + jeda > ANGGARAN_MS) {
        hasil.alasanBerhenti = "Anggaran waktu satu putaran habis; sisanya dilanjutkan pada putaran berikutnya.";
        i += 1;
        break;
      }
      await tidur(jeda);
    }
  }

  // Yang telanjur diklaim tetapi tidak sempat dikirim dikembalikan. Tanpa ini
  // ia akan tergantung pada status "sending" selamanya — tidak terkirim, dan
  // tidak pernah diambil lagi oleh pekerja mana pun.
  const sisa = klaim.slice(i).map((item) => item.id);
  if (sisa.length > 0) {
    await kembalikanKeAntrean(sisa);
    hasil.sisaDikembalikan = sisa.length;
  }

  if (pertamaSungguhan) await mulaiPemanasan();
  for (const id of kampanyeTersentuh) await segarkanHitung(id);
  if (!hasil.alasanBerhenti) hasil.alasanBerhenti = "Putaran selesai.";
  return hasil;
}

export async function GET(request: Request) {
  if (!kunciCocok(request)) {
    return Response.json(
      { success: false, message: "Akses ditolak: kunci penjadwal tidak cocok atau CRON_SECRET belum diatur." },
      { status: 401 },
    );
  }
  try {
    const hasil = await jalankanPutaran();
    return Response.json({ success: true, ...hasil });
  } catch (galat: unknown) {
    console.error("pekerja outreach (cron)", galat);
    return Response.json(
      { success: false, message: explainServerError(galat, "Putaran pekerja gagal dijalankan.") },
      { status: 500 },
    );
  }
}

export async function POST() {
  const gerbang = await gerbangOus("pakai");
  if (!gerbang.ok) return gerbang.jawab;

  try {
    const hasil = await jalankanPutaran();
    // Sengaja TIDAK dicatat ke jejak audit. Panel memanggil ini tiap setengah
    // menit selama layarnya terbuka; mencatat tiap putaran hanya akan
    // menenggelamkan tindakan yang benar-benar perlu ditelusuri.
    return Response.json({ success: true, ...hasil });
  } catch (galat: unknown) {
    console.error("pekerja outreach (panel)", galat);
    await catatAudit({
      pelaku: gerbang.ctx.pelaku,
      tindakan: "pekerja.galat",
      keterangan: { pesan: galat instanceof Error ? galat.message.slice(0, 300) : "tidak diketahui" },
    });
    return Response.json(
      { success: false, message: explainServerError(galat, "Putaran pekerja gagal dijalankan.") },
      { status: 500 },
    );
  }
}
