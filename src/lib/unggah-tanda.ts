// ============================================================
// TANDA TANGAN JALUR TRANSIT — supaya jalur tidak dapat dikarang
//
// Formulir penyerahan sekarang mengirim JALUR berkas, bukan berkasnya. Jalur
// adalah teks biasa, dan teks biasa dapat diketik siapa saja. Tanpa
// penjagaan, satu permintaan yang menyebut jalur berkas milik mahasiswa lain
// akan melampirkan berkas itu ke tiketnya sendiri.
//
// Karena itu server menandatangani setiap jalur yang ia izinkan, dan
// memeriksa tanda tangannya lagi ketika formulirnya masuk. Yang tidak pernah
// diizinkan server tidak akan pernah lolos, sekalipun jalurnya ditebak benar.
//
// Kuncinya menumpang rahasia yang memang sudah wajib ada: tanpa
// SUPABASE_SECRET_KEY penyimpanan tidak berfungsi sama sekali, jadi tidak ada
// keadaan di mana portal berjalan tetapi kunci ini kosong. UNGGAH_SECRET
// disediakan bagi yang ingin memisahkannya.
//
// HANYA untuk server: berkas ini mengimpor node:crypto.
// ============================================================
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseSecretKey } from "@/lib/supabase-config";
import { UMUR_IZIN_MS, jalurTransitSah, type FolderTransit } from "@/lib/unggah-langsung";

function rahasia() {
  const kunci = process.env.UNGGAH_SECRET || getSupabaseSecretKey() || "";
  if (!kunci) {
    throw new Error("Supabase Storage belum dikonfigurasi di environment variables.");
  }
  return kunci;
}

export function tandaiJalur(jalur: string, kedaluwarsa: number) {
  return createHmac("sha256", rahasia()).update(`${jalur}|${kedaluwarsa}`).digest("base64url");
}

/** Izin baru untuk satu jalur, beserta batas waktunya. */
export function izinkanJalur(jalur: string) {
  const kedaluwarsa = Date.now() + UMUR_IZIN_MS;
  return { kedaluwarsa, tanda: tandaiJalur(jalur, kedaluwarsa) };
}

/**
 * Periksa klaim atas satu jalur transit.
 *
 * Tiga hal diperiksa berurutan, dan urutannya disengaja: bentuk jalur lebih
 * dulu (paling murah), lalu masa berlaku, baru tanda tangannya.
 */
export function periksaKlaimJalur(input: {
  jalur: string;
  folder: FolderTransit;
  tanda: string;
  kedaluwarsa: number;
}): { ok: true } | { ok: false; pesan: string } {
  if (!jalurTransitSah(input.jalur, input.folder)) {
    return { ok: false, pesan: "Jalur berkas tidak dikenali. Silakan pilih ulang berkasnya." };
  }
  if (!Number.isFinite(input.kedaluwarsa) || input.kedaluwarsa <= Date.now()) {
    return {
      ok: false,
      pesan: "Izin unggah sudah kedaluwarsa. Pilih ulang berkasnya lalu kirim lagi.",
    };
  }
  const benar = Buffer.from(tandaiJalur(input.jalur, input.kedaluwarsa));
  const dikirim = Buffer.from(String(input.tanda || ""));
  if (benar.length !== dikirim.length || !timingSafeEqual(benar, dikirim)) {
    return { ok: false, pesan: "Izin unggah tidak sah. Silakan pilih ulang berkasnya." };
  }
  return { ok: true };
}
