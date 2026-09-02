// ============================================================
// AKUN LANGGANAN CAKRAWALA — sisi server
//
// Langganan menempel pada NOMOR WHATSAPP, bukan pada perangkat. Ganti ponsel
// tidak menghilangkan akses, aplikasi berbagi langganan yang sama dengan web,
// dan perpanjangan punya sesuatu untuk ditempeli.
//
// TIDAK ADA KATA SANDI DAN TIDAK ADA OTP, dan itu keputusan sadar. Nomor
// didaftarkan sekali ketika kode ditukar, lalu kode itu terkunci padanya. Yang
// dapat menyamar hanyalah orang yang tahu KODE AKSES milik temannya — dan
// orang itu memang sudah bisa masuk tanpa perlu tahu nomornya. Jadi tidak ada
// yang bertambah bocor dibanding keadaan sebelum akun ada.
// ============================================================
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { cakrawalaAccounts, cakrawalaRedemptions } from "@/db/schema";
import { eq, gt, sql } from "drizzle-orm";
// Penormal nomornya tinggal di berkas tersendiri yang tidak menyentuh basis
// data, supaya formulir pembelian di peramban dapat memakai aturan yang sama
// persis. Diteruskan kembali dari sini agar sisi server cukup mengimpor satu
// tempat.
export { rapikanWa, samarkanWa } from "@/lib/nomor-wa";

export type Akun = typeof cakrawalaAccounts.$inferSelect;

/** Nama cookie yang menyimpan kunci sesi akun. */
export const AKUN_COOKIE = "cakrawala_akun";

/** Umur cookie sesi, dipotong lagi mengikuti sisa langganannya. */
export const AKUN_COOKIE_MAX_AGE = 180 * 24 * 60 * 60;

/** Kunci sesi acak. Bukan turunan nomornya — nomor mudah ditebak, ini tidak. */
function tokenBaru() {
  return randomBytes(32).toString("hex");
}

export async function akunDariToken(token: string): Promise<Akun | null> {
  if (!token || token.length < 32) return null;
  const baris = await db
    .select()
    .from(cakrawalaAccounts)
    .where(eq(cakrawalaAccounts.token, token))
    .limit(1);
  return baris[0] ?? null;
}

export async function akunDariWa(whatsapp: string): Promise<Akun | null> {
  const baris = await db
    .select()
    .from(cakrawalaAccounts)
    .where(eq(cakrawalaAccounts.whatsapp, whatsapp))
    .limit(1);
  return baris[0] ?? null;
}

/** Masih berlangganan? */
export function akunAktif(akun: Akun, sekarang: Date = new Date()) {
  return akun.expiresAt.getTime() > sekarang.getTime();
}

/**
 * Kapan langganan berakhir setelah ditambah sekian hari.
 *
 * Menambah dari akhir langganan yang MASIH berjalan, bukan dari hari ini.
 * Membeli paket kedua sepekan sebelum yang pertama habis karena itu menambah
 * penuh, tidak memotong sisanya. Langganan yang sudah lewat mulai lagi dari
 * hari ini, karena hari-hari yang telanjur hilang tidak dapat dikembalikan.
 */
export function perpanjang(dariAkhir: Date | null, hari: number, sekarang: Date = new Date()) {
  const dasar = dariAkhir && dariAkhir.getTime() > sekarang.getTime() ? dariAkhir : sekarang;
  return new Date(dasar.getTime() + hari * 24 * 60 * 60_000);
}

/**
 * Nomor mana yang sudah memegang kode ini? null bila belum pernah ditukar.
 *
 * Dipakai SEBELUM kode diperiksa lewat verifyCakrawalaCode, dan urutan itu
 * disengaja: pemeriksaan kode memotong kuota pemakaiannya. Orang yang
 * memasukkan kode milik orang lain tidak boleh menghabiskan jatah perangkat
 * pemiliknya hanya dengan mencoba.
 */
export async function pemilikKode(kode: string): Promise<string | null> {
  if (!kode) return null;
  const baris = await db
    .select({ whatsapp: cakrawalaRedemptions.whatsapp })
    .from(cakrawalaRedemptions)
    .where(eq(cakrawalaRedemptions.code, kode))
    .limit(1);
  return baris[0]?.whatsapp ?? null;
}

export type HasilTukar =
  | { ok: true; akun: Akun; token: string; baru: boolean; sampai: Date }
  | { ok: false; pesan: string };

/**
 * Tukarkan kode menjadi langganan pada sebuah nomor.
 *
 * Aturan penguncinya: satu kode hanya dapat ditukar SEKALI, dan sesudah itu
 * terikat pada nomor yang menukarkannya. Menukarkan ulang kode yang sama dari
 * nomor yang sama tidak menambah hari — ia hanya mengembalikan sesi, supaya
 * orang yang berganti ponsel dapat masuk lagi dengan kode yang ia simpan.
 */
export async function tukarkanKode(
  kode: string,
  whatsapp: string,
  hari: number,
  nama?: string,
): Promise<HasilTukar> {
  const sekarang = new Date();

  // Sudah pernah ditukar?
  const sudah = await db
    .select()
    .from(cakrawalaRedemptions)
    .where(eq(cakrawalaRedemptions.code, kode))
    .limit(1);

  if (sudah[0]) {
    if (sudah[0].whatsapp !== whatsapp) {
      return {
        ok: false,
        pesan: "Kode ini sudah dipakai nomor WhatsApp lain. Satu kode hanya untuk satu nomor.",
      };
    }
    // Nomor yang sama menukarkan ulang: kembalikan sesinya tanpa menambah hari.
    const akun = await akunDariWa(whatsapp);
    if (!akun) return { ok: false, pesan: "Akun untuk kode ini tidak ditemukan." };
    if (!akunAktif(akun, sekarang)) {
      return { ok: false, pesan: "Langganan pada nomor ini sudah berakhir. Perpanjang dulu." };
    }
    return { ok: true, akun, token: akun.token, baru: false, sampai: akun.expiresAt };
  }

  const adaAkun = await akunDariWa(whatsapp);
  const sampai = perpanjang(adaAkun?.expiresAt ?? null, hari, sekarang);
  const token = adaAkun?.token ?? tokenBaru();

  let akun: Akun;
  if (adaAkun) {
    const ubah = await db
      .update(cakrawalaAccounts)
      .set({
        expiresAt: sampai,
        lastCode: kode,
        redeemCount: sql`${cakrawalaAccounts.redeemCount} + 1`,
        lastSeenAt: sekarang,
        ...(nama ? { name: nama } : {}),
      })
      .where(eq(cakrawalaAccounts.id, adaAkun.id))
      .returning();
    akun = ubah[0];
  } else {
    const buat = await db
      .insert(cakrawalaAccounts)
      .values({
        whatsapp,
        name: nama || null,
        expiresAt: sampai,
        token,
        lastCode: kode,
        redeemCount: 1,
        lastSeenAt: sekarang,
      })
      .returning();
    akun = buat[0];
  }

  // Penguncian kodenya ditulis SESUDAH langganannya bertambah. Kalau urutannya
  // dibalik dan penambahan harinya gagal, kodenya terkunci pada nomor yang
  // belum menerima apa-apa — dan tidak ada lagi kode kedua untuk menebusnya.
  //
  // UNIQUE pada kolom code yang menegakkan aturannya, bukan pemeriksaan di
  // atas: dua permintaan yang datang bersamaan dapat lolos pemeriksaan
  // bersama-sama, dan penolakan basis datalah yang menghentikan yang kedua.
  try {
    await db.insert(cakrawalaRedemptions).values({
      code: kode,
      accountId: akun.id,
      whatsapp,
      days: hari,
    });
  } catch {
    // Yang lain menang dalam hitungan milidetik. Langganannya sudah bertambah,
    // jadi sesi tetap diberikan; yang tidak terjadi hanyalah penambahan kedua.
    const ulang = await akunDariWa(whatsapp);
    if (ulang) return { ok: true, akun: ulang, token: ulang.token, baru: false, sampai: ulang.expiresAt };
  }

  return { ok: true, akun, token: akun.token, baru: !adaAkun, sampai };
}

/** Catat bahwa akun ini baru saja dipakai. Kegagalannya tidak penting. */
export async function tandaiDipakai(id: number) {
  try {
    await db.update(cakrawalaAccounts).set({ lastSeenAt: new Date() }).where(eq(cakrawalaAccounts.id, id));
  } catch {
    // Penanda waktu pakai hanya untuk panel; tidak boleh menghalangi akses.
  }
}

/**
 * Umur cookie: sisa langganan DITAMBAH tenggang, dipotong batas atasnya.
 *
 * Tenggangnya sengaja ada, dan bukan kelalaian. Cookie yang mati bersamaan
 * dengan langganannya membuat orang yang memperpanjang lewat WhatsApp
 * terkunci di luar meskipun harinya sudah ditambahkan — ia harus mengetik
 * ulang kode lama yang mungkin sudah tidak ia simpan. Dengan tenggang ini,
 * perangkat yang sama langsung mengenalinya kembali begitu harinya masuk.
 *
 * Ia TIDAK memberi akses tambahan sedetik pun: gerbangnya memeriksa
 * expiresAt pada tiap permintaan, bukan umur cookie-nya. Yang diperpanjang
 * hanyalah ingatan peramban tentang siapa pemiliknya.
 */
export const TENGGANG_COOKIE = 60 * 24 * 60 * 60;

export function umurCookieAkun(akun: Akun, sekarang: Date = new Date()) {
  const detik = Math.floor((akun.expiresAt.getTime() - sekarang.getTime()) / 1000);
  return Math.max(60, Math.min(detik + TENGGANG_COOKIE, AKUN_COOKIE_MAX_AGE));
}

/** Daftar pelanggan untuk panel Super Admin, yang hampir habis lebih dulu. */
export async function daftarAkun(batas = 200) {
  return db
    .select({
      id: cakrawalaAccounts.id,
      whatsapp: cakrawalaAccounts.whatsapp,
      name: cakrawalaAccounts.name,
      expiresAt: cakrawalaAccounts.expiresAt,
      lastCode: cakrawalaAccounts.lastCode,
      redeemCount: cakrawalaAccounts.redeemCount,
      createdAt: cakrawalaAccounts.createdAt,
      lastSeenAt: cakrawalaAccounts.lastSeenAt,
    })
    .from(cakrawalaAccounts)
    .orderBy(cakrawalaAccounts.expiresAt)
    .limit(batas);
}

/** Berapa yang masih aktif, untuk angka ringkas di panel. */
export async function jumlahAktif() {
  const baris = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(cakrawalaAccounts)
    .where(gt(cakrawalaAccounts.expiresAt, new Date()));
  return baris[0]?.n ?? 0;
}
