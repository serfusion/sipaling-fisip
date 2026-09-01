// ============================================================
// PESANAN AKSES CAKRAWALA — sisi server
//
// Dua kerja: membuat pesanan beserta nominal uniknya, dan menerbitkan kode
// akses begitu pesanannya lunas.
// ============================================================
import { db } from "@/db";
import { cakrawalaOrders } from "@/db/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import {
  batasAkses, batasBayar, nomorPesanan, nominalUnik, penandaKosong,
  type Paket, type StatusPesanan,
} from "@/lib/paket-cakrawala";
import {
  buatKodeCakrawala, CAKRAWALA_MAX_CODES, kodeKedaluwarsa, type CakrawalaCode,
} from "@/lib/cakrawala";
import { readCakrawalaState, writeCakrawalaState } from "@/lib/cakrawala-store";

/**
 * Tandai pesanan yang sudah lewat waktunya.
 *
 * Dijalankan sebelum penanda baru dipilih, bukan lewat penjadwal terpisah.
 * Nominal unik hanya dapat didaur ulang kalau pesanan lamanya benar-benar
 * berhenti dianggap hidup; menunggu penjadwal berarti persediaan penandanya
 * habis di tengah jam sibuk.
 */
export async function sapuPesananKedaluwarsa() {
  try {
    await db
      .update(cakrawalaOrders)
      .set({ status: "kedaluwarsa" })
      .where(and(eq(cakrawalaOrders.status, "menunggu"), lt(cakrawalaOrders.expiresAt, new Date())));
  } catch (error) {
    // Bukan alasan menggagalkan pembelian: yang terjadi paling buruk adalah
    // satu penanda tertahan lebih lama daripada seharusnya.
    console.error("sapu pesanan kedaluwarsa", error);
  }
}

export type PesananBaru = {
  paket: Paket;
  nama?: string;
  kontak?: string;
};

export type HasilPesan =
  | { ok: true; orderCode: string; amount: number; expiresAt: Date }
  | { ok: false; pesan: string };

/**
 * Buat pesanan baru beserta nominal uniknya.
 *
 * Dicoba beberapa kali: indeks unik di basis data menolak dua pesanan hidup
 * yang bernominal sama, dan penolakan itu memang yang diandalkan. Memeriksa
 * lebih dulu lalu menulis TIDAK cukup — dua permintaan yang datang pada saat
 * yang sama dapat lolos pemeriksaan bersama-sama.
 */
export async function buatPesanan(masukan: PesananBaru): Promise<HasilPesan> {
  await sapuPesananKedaluwarsa();

  for (let percobaan = 0; percobaan < 6; percobaan += 1) {
    let terpakai: number[] = [];
    try {
      const hidup = await db
        .select({ marker: cakrawalaOrders.marker })
        .from(cakrawalaOrders)
        .where(
          and(
            eq(cakrawalaOrders.status, "menunggu"),
            eq(cakrawalaOrders.basePrice, masukan.paket.harga),
          ),
        );
      terpakai = hidup.map((h) => h.marker);
    } catch (error) {
      console.error("baca penanda terpakai", error);
      return { ok: false, pesan: "Pesanan belum dapat dibuat. Coba lagi sebentar." };
    }

    const penanda = penandaKosong(terpakai);
    if (penanda === null) {
      return {
        ok: false,
        pesan: "Antrean pembayaran sedang penuh. Coba lagi beberapa menit lagi.",
      };
    }
    const amount = nominalUnik(masukan.paket.harga, penanda);
    if (amount === null) return { ok: false, pesan: "Nominal tidak dapat dihitung." };

    const dibuat = new Date();
    const expiresAt = batasBayar(dibuat);
    const orderCode = nomorPesanan();

    try {
      await db.insert(cakrawalaOrders).values({
        orderCode,
        packageId: masukan.paket.id,
        packageName: masukan.paket.nama,
        basePrice: masukan.paket.harga,
        marker: penanda,
        amount,
        days: masukan.paket.hari,
        maxDevices: masukan.paket.maksPerangkat,
        status: "menunggu",
        buyerName: masukan.nama?.slice(0, 120) || null,
        buyerContact: masukan.kontak?.slice(0, 120) || null,
        expiresAt,
      });
      return { ok: true, orderCode, amount, expiresAt };
    } catch (error) {
      // Tabrakan nominal atau nomor pesanan: coba lagi dengan yang lain.
      // Sengaja tidak dibedakan jenis galatnya — apa pun sebabnya, satu
      // percobaan ulang dengan angka baru adalah jawaban yang benar.
      if (percobaan >= 5) {
        console.error("buat pesanan", error);
        return { ok: false, pesan: "Pesanan belum dapat dibuat. Coba lagi sebentar." };
      }
    }
  }
  return { ok: false, pesan: "Pesanan belum dapat dibuat. Coba lagi sebentar." };
}

export type Pesanan = typeof cakrawalaOrders.$inferSelect;

export async function ambilPesanan(orderCode: string): Promise<Pesanan | null> {
  const baris = await db
    .select()
    .from(cakrawalaOrders)
    .where(eq(cakrawalaOrders.orderCode, orderCode))
    .limit(1);
  return baris[0] ?? null;
}

/**
 * Sisipkan kode akses baru ke daftar, tahan terhadap penulisan berbarengan.
 *
 * Daftar kode masih berupa satu baris JSON. Dua pesanan yang ditandai lunas
 * pada saat yang sama karena itu dapat saling menimpa, dan yang hilang adalah
 * kode yang sudah dibayar orang. Penangkalnya: sesudah menulis, daftarnya
 * dibaca ulang dan dipastikan kodenya benar-benar ada. Bila tidak, diulang.
 */
async function simpanKodeBaru(kode: CakrawalaCode) {
  for (let percobaan = 0; percobaan < 4; percobaan += 1) {
    const state = await readCakrawalaState();
    if (state.codes.some((k) => k.code === kode.code)) return true;

    // Kode yang sudah lewat masanya dibuang lebih dulu, supaya batas jumlah
    // tidak tercapai oleh kode yang memang sudah tidak berguna.
    const hidup = state.codes.filter((k) => !kodeKedaluwarsa(k));
    const berikut = [kode, ...hidup].slice(0, CAKRAWALA_MAX_CODES);
    await writeCakrawalaState({ ...state, codes: berikut });

    const ulang = await readCakrawalaState();
    if (ulang.codes.some((k) => k.code === kode.code)) return true;
  }
  return false;
}

export type HasilTerbit =
  | { ok: true; accessCode: string; baru: boolean }
  | { ok: false; pesan: string };

/**
 * Tandai pesanan lunas dan terbitkan kode aksesnya.
 *
 * SELALU aman diulang. Pesanan yang sudah lunas mengembalikan kode yang sama,
 * tidak menerbitkan yang baru: gerbang pembayaran mengirim ulang pemberitahuan
 * yang sama ketika balasannya tidak sampai, dan satu pembayaran tidak boleh
 * berubah menjadi dua kode.
 */
export async function lunaskanPesanan(
  orderCode: string,
  lewat: string,
  paket: Paket,
): Promise<HasilTerbit> {
  const pesanan = await ambilPesanan(orderCode);
  if (!pesanan) return { ok: false, pesan: "Pesanan tidak ditemukan." };

  if (pesanan.status === "lunas" && pesanan.accessCode) {
    return { ok: true, accessCode: pesanan.accessCode, baru: false };
  }
  if (pesanan.status === "batal") {
    return { ok: false, pesan: "Pesanan ini sudah dibatalkan." };
  }

  const sekarang = new Date();
  const state = await readCakrawalaState();
  let kode = buatKodeCakrawala();
  for (let n = 0; n < 6 && state.codes.some((k) => k.code === kode); n += 1) {
    kode = buatKodeCakrawala();
  }

  const baru: CakrawalaCode = {
    code: kode,
    label: `${pesanan.packageName} · ${pesanan.orderCode}${pesanan.buyerName ? ` · ${pesanan.buyerName}` : ""}`,
    active: true,
    maxUses: pesanan.maxDevices,
    uses: 0,
    expiresAt: batasAkses(paket, sekarang).toISOString(),
    createdAt: sekarang.toISOString(),
    lastUsedAt: null,
    orderCode: pesanan.orderCode,
  };

  if (!(await simpanKodeBaru(baru))) {
    return { ok: false, pesan: "Kode akses belum tersimpan. Coba tandai lunas sekali lagi." };
  }

  // Pesanan ditandai lunas SESUDAH kodenya benar-benar tersimpan. Bila
  // urutannya dibalik dan penyimpanan kodenya gagal, pesanan tampak lunas
  // tanpa kode — dan tidak ada lagi yang mengingatkan siapa pun bahwa ada
  // orang yang sudah membayar tetapi belum menerima apa-apa.
  //
  // Syarat status <> 'lunas' membuat dua pemberitahuan yang datang bersamaan
  // tidak dapat sama-sama menang.
  const hasil = await db
    .update(cakrawalaOrders)
    .set({ status: "lunas" as StatusPesanan, accessCode: kode, paidVia: lewat, paidAt: sekarang })
    .where(and(eq(cakrawalaOrders.orderCode, orderCode), sql`${cakrawalaOrders.status} <> 'lunas'`))
    .returning({ accessCode: cakrawalaOrders.accessCode });

  if (hasil.length === 0) {
    // Yang lain menang. Kode miliknyalah yang berlaku.
    const ulang = await ambilPesanan(orderCode);
    if (ulang?.accessCode) return { ok: true, accessCode: ulang.accessCode, baru: false };
    return { ok: false, pesan: "Pesanan tidak dapat ditandai lunas." };
  }
  return { ok: true, accessCode: kode, baru: true };
}
