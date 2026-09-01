// ============================================================
// CATATAN UANG - sisi server
//
// Semua sentuhan ke basis data untuk buku kas ada di sini: membuat buku,
// membukanya dengan kode, menyimpan pesan yang sudah diurai, meringkas satu
// bulan, dan menautkan percakapan Telegram ke sebuah buku.
//
// Jalur masuknya cuma satu: `catatPesan`. Halaman web, Telegram, dan
// otomasi apa pun memakai fungsi yang sama, jadi aturan pengurainya tidak
// mungkin berbeda antar pintu.
// ============================================================
import { db } from "@/db";
import { moneyBooks, moneyChannels, moneyEntries } from "@/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { buatKodeBuku, rapikanNamaBuku } from "./buku";
import { KATEGORI_LAIN, kategoriDari, type Arah } from "./kategori";
import { uraiBanyak, type Catatan } from "./urai-pesan";

export { bulanWib, tanggalWib } from "./urai-pesan";

export type Buku = typeof moneyBooks.$inferSelect;
export type Baris = typeof moneyEntries.$inferSelect;

/**
 * Batas isi satu buku.
 *
 * Bukan soal ruang penyimpanan, melainkan soal orang yang menyalahgunakan
 * jalur tanpa akun ini untuk menumpuk data. Dua puluh ribu baris kira-kira
 * lima belas tahun mencatat sepuluh transaksi sehari.
 */
export const BATAS_ISI_BUKU = 20_000;

/** Batas jumlah baris yang boleh masuk dari satu pesan. */
export const BATAS_PER_PESAN = 20;

// ---------- BUKU ----------

export async function buatBuku(nama: unknown): Promise<Buku> {
  const name = rapikanNamaBuku(nama);

  // Diulang bila kodenya kebetulan sudah ada. Yang diandalkan adalah
  // penolakan indeks unik, bukan pemeriksaan sebelum menulis: dua permintaan
  // yang datang bersamaan dapat lolos pemeriksaan bersama-sama.
  for (let percobaan = 0; percobaan < 5; percobaan += 1) {
    const code = buatKodeBuku();
    try {
      const baris = await db.insert(moneyBooks).values({ code, name }).returning();
      return baris[0];
    } catch (error) {
      if (percobaan >= 4) throw error;
    }
  }
  throw new Error("Buku gagal dibuat.");
}

export async function bukuDariKode(kode: string): Promise<Buku | null> {
  const baris = await db.select().from(moneyBooks).where(eq(moneyBooks.code, kode)).limit(1);
  return baris[0] ?? null;
}

/**
 * Menandai buku baru saja dipakai.
 *
 * Sengaja tidak pernah menggagalkan apa pun: yang hilang kalau gagal hanyalah
 * satu stempel waktu, dan tidak ada gunanya membatalkan pencatatan uang orang
 * karena itu.
 */
async function tandaiDipakai(bookId: number) {
  try {
    await db.update(moneyBooks).set({ lastUsedAt: new Date() }).where(eq(moneyBooks.id, bookId));
  } catch (error) {
    console.error("tandai buku dipakai", error);
  }
}

export async function gantiNamaBuku(bookId: number, nama: unknown) {
  const name = rapikanNamaBuku(nama);
  await db.update(moneyBooks).set({ name }).where(eq(moneyBooks.id, bookId));
  return name;
}

// ---------- MENCATAT ----------

export type Tersimpan = { baris: Baris; hasil: Catatan };

export type HasilCatat = {
  tersimpan: Tersimpan[];
  gagal: { baris: string; alasan: string }[];
};

/**
 * Menyimpan satu pesan. Pesan boleh berisi beberapa baris sekaligus.
 *
 * Baris yang gagal diurai TIDAK menjatuhkan baris lain, dan alasannya ikut
 * dikembalikan supaya pengirimnya tahu persis mana yang tidak terbaca.
 */
export async function catatPesan(masukan: {
  bookId: number;
  pesan: string;
  sumber: string;
  sekarang?: Date;
}): Promise<HasilCatat> {
  const uraian = uraiBanyak(masukan.pesan, masukan.sekarang ?? new Date());
  const hasil: HasilCatat = { tersimpan: [], gagal: [] };
  if (uraian.length === 0) {
    hasil.gagal.push({ baris: "", alasan: "Pesannya kosong." });
    return hasil;
  }

  const berhasil: { baris: string; catatan: Catatan }[] = [];
  for (const satu of uraian) {
    if (satu.hasil.ok) berhasil.push({ baris: satu.baris, catatan: satu.hasil.hasil });
    else hasil.gagal.push({ baris: satu.baris, alasan: satu.hasil.alasan });
  }
  if (berhasil.length === 0) return hasil;

  if (berhasil.length > BATAS_PER_PESAN) {
    hasil.gagal.push({
      baris: "",
      alasan: `Satu pesan paling banyak ${BATAS_PER_PESAN} baris. Sisanya belum tercatat.`,
    });
  }
  const dipakai = berhasil.slice(0, BATAS_PER_PESAN);

  const isi = await hitungIsi(masukan.bookId);
  if (isi + dipakai.length > BATAS_ISI_BUKU) {
    hasil.gagal.push({
      baris: "",
      alasan: `Buku ini sudah memuat ${isi.toLocaleString("id-ID")} catatan, sudah sampai batasnya.`,
    });
    return hasil;
  }

  const nilai = dipakai.map(({ baris, catatan }) => ({
    bookId: masukan.bookId,
    direction: catatan.arah,
    amount: catatan.nominal,
    category: catatan.kategori,
    note: catatan.catatan.slice(0, 200),
    entryDate: catatan.tanggal,
    source: masukan.sumber.slice(0, 20),
    rawText: baris.slice(0, 400),
  }));

  // Urutan baris yang dikembalikan INSERT ... RETURNING sama dengan urutan
  // nilai yang dikirim, jadi pasangannya dapat dirakit lewat nomor urut.
  const tersimpan = await db.insert(moneyEntries).values(nilai).returning();
  tersimpan.forEach((baris, urutan) => {
    hasil.tersimpan.push({ baris, hasil: dipakai[urutan].catatan });
  });

  await tandaiDipakai(masukan.bookId);
  return hasil;
}

export async function hitungIsi(bookId: number) {
  const baris = await db
    .select({ jumlah: sql<string>`count(*)` })
    .from(moneyEntries)
    .where(eq(moneyEntries.bookId, bookId));
  return Number(baris[0]?.jumlah ?? 0);
}

export async function hapusCatatan(bookId: number, id: number) {
  const dihapus = await db
    .delete(moneyEntries)
    .where(and(eq(moneyEntries.id, id), eq(moneyEntries.bookId, bookId)))
    .returning({ id: moneyEntries.id });
  return dihapus.length > 0;
}

/** Catatan terakhir yang masuk. Dipakai perintah "batal" lewat Telegram. */
export async function catatanTerakhir(bookId: number): Promise<Baris | null> {
  const baris = await db
    .select()
    .from(moneyEntries)
    .where(eq(moneyEntries.bookId, bookId))
    .orderBy(desc(moneyEntries.id))
    .limit(1);
  return baris[0] ?? null;
}

// ---------- MEMBACA ----------

/** Batas baris yang dikirim ke layar untuk satu bulan. */
const BATAS_TAMPIL = 500;

export async function isiBulan(bookId: number, bulan: string): Promise<Baris[]> {
  return db
    .select()
    .from(moneyEntries)
    .where(
      and(
        eq(moneyEntries.bookId, bookId),
        gte(moneyEntries.entryDate, `${bulan}-01`),
        lte(moneyEntries.entryDate, `${bulan}-31`),
      ),
    )
    .orderBy(desc(moneyEntries.entryDate), desc(moneyEntries.id))
    .limit(BATAS_TAMPIL);
}

export type RingkasKategori = { kategori: string; nama: string; warna: string; ikon: string; jumlah: number; nilai: number };

export type Ringkasan = {
  bulan: string;
  masuk: number;
  keluar: number;
  sisa: number;
  jumlahBaris: number;
  perKategori: { masuk: RingkasKategori[]; keluar: RingkasKategori[] };
  terbesar: Baris | null;
};

/**
 * Ringkasan satu bulan, dihitung dari baris yang sudah diambil.
 *
 * Sengaja tidak menjadi kueri agregat tersendiri: satu bulan catatan pribadi
 * hampir tidak pernah lebih dari beberapa ratus baris, dan menghitungnya di
 * sini menghemat satu perjalanan ke basis data untuk tiap layar yang dibuka.
 */
export function ringkas(bulan: string, baris: Baris[]): Ringkasan {
  let masuk = 0;
  let keluar = 0;
  const kumpul = new Map<string, { arah: Arah; jumlah: number; nilai: number }>();
  let terbesar: Baris | null = null;

  for (const isi of baris) {
    const arah: Arah = isi.direction === "masuk" ? "masuk" : "keluar";
    const nilai = Number(isi.amount) || 0;
    if (arah === "masuk") masuk += nilai;
    else keluar += nilai;

    const kunci = `${arah}:${isi.category}`;
    const ada = kumpul.get(kunci) ?? { arah, jumlah: 0, nilai: 0 };
    ada.jumlah += 1;
    ada.nilai += nilai;
    kumpul.set(kunci, ada);

    if (arah === "keluar" && (!terbesar || nilai > Number(terbesar.amount))) terbesar = isi;
  }

  const susun = (arah: Arah): RingkasKategori[] =>
    [...kumpul.entries()]
      .filter(([, isi]) => isi.arah === arah)
      .map(([kunci, isi]) => {
        const id = kunci.slice(arah.length + 1) || KATEGORI_LAIN;
        const kategori = kategoriDari(id);
        return {
          kategori: id,
          nama: kategori.nama,
          warna: kategori.warna,
          ikon: kategori.ikon,
          jumlah: isi.jumlah,
          nilai: isi.nilai,
        };
      })
      .sort((a, b) => b.nilai - a.nilai);

  return {
    bulan,
    masuk,
    keluar,
    sisa: masuk - keluar,
    jumlahBaris: baris.length,
    perKategori: { masuk: susun("masuk"), keluar: susun("keluar") },
    terbesar,
  };
}

export type TitikTren = { bulan: string; masuk: number; keluar: number };

/** Enam bulan terakhir yang ada isinya, untuk batang tren di kepala halaman. */
export async function tren(bookId: number, jumlahBulan = 6): Promise<TitikTren[]> {
  const potong = sql<string>`substr(${moneyEntries.entryDate}, 1, 7)`;
  const baris = await db
    .select({
      bulan: potong,
      masuk: sql<string>`coalesce(sum(case when ${moneyEntries.direction} = 'masuk' then ${moneyEntries.amount} else 0 end), 0)`,
      keluar: sql<string>`coalesce(sum(case when ${moneyEntries.direction} = 'keluar' then ${moneyEntries.amount} else 0 end), 0)`,
    })
    .from(moneyEntries)
    .where(eq(moneyEntries.bookId, bookId))
    .groupBy(potong)
    .orderBy(sql`${potong} desc`)
    .limit(Math.max(1, Math.min(24, jumlahBulan)));

  return baris
    .map((b) => ({ bulan: b.bulan, masuk: Number(b.masuk) || 0, keluar: Number(b.keluar) || 0 }))
    .reverse();
}

// ---------- SAMBUNGAN PESAN ----------

export async function sambungkanKanal(masukan: {
  bookId: number;
  kind: string;
  externalId: string;
  label?: string | null;
}) {
  await db
    .insert(moneyChannels)
    .values({
      bookId: masukan.bookId,
      kind: masukan.kind,
      externalId: masukan.externalId,
      label: masukan.label?.slice(0, 120) ?? null,
    })
    .onConflictDoUpdate({
      target: [moneyChannels.kind, moneyChannels.externalId],
      set: { bookId: masukan.bookId, label: masukan.label?.slice(0, 120) ?? null },
    });
}

export async function bukuDariKanal(kind: string, externalId: string): Promise<Buku | null> {
  const baris = await db
    .select({ buku: moneyBooks })
    .from(moneyChannels)
    .innerJoin(moneyBooks, eq(moneyBooks.id, moneyChannels.bookId))
    .where(and(eq(moneyChannels.kind, kind), eq(moneyChannels.externalId, externalId)))
    .limit(1);
  return baris[0]?.buku ?? null;
}

export async function lepasKanal(kind: string, externalId: string) {
  const dihapus = await db
    .delete(moneyChannels)
    .where(and(eq(moneyChannels.kind, kind), eq(moneyChannels.externalId, externalId)))
    .returning({ id: moneyChannels.id });
  return dihapus.length > 0;
}

/** Daftar kanal yang tersambung ke satu buku, untuk ditampilkan di panelnya. */
export async function kanalBuku(bookId: number) {
  return db
    .select({
      id: moneyChannels.id,
      kind: moneyChannels.kind,
      label: moneyChannels.label,
      createdAt: moneyChannels.createdAt,
    })
    .from(moneyChannels)
    .where(eq(moneyChannels.bookId, bookId))
    .orderBy(desc(moneyChannels.id))
    .limit(20);
}
