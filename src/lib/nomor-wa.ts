// ============================================================
// NOMOR WHATSAPP PELANGGAN — bagian yang aman dipakai di browser
//
// Berdiri sendiri, terpisah dari akun-cakrawala.ts, karena berkas itu
// menyentuh basis data dan karena itu tidak boleh ikut terbawa ke bundel
// peramban. Yang di sini murni perhitungan atas sebuah untai teks, dan
// dipakai di dua sisi sekaligus: formulir pembelian memeriksanya sebelum
// mengirim, server memeriksanya lagi sebelum menyimpan.
//
// Pemeriksaan di peramban tidak menggantikan pemeriksaan di server. Ia hanya
// menghemat satu perjalanan pulang-pergi bagi orang yang salah ketik.
// ============================================================
import { nomorWa } from "@/lib/uang/whatsapp";

/**
 * Seragamkan dan periksa nomor WhatsApp yang diketik pengguna.
 *
 * Memakai penormal yang sama dengan jalur pesan masuk, supaya orang yang
 * mendaftar lewat web dan yang mengirim pesan dari WhatsApp dikenali sebagai
 * satu nomor yang sama — bukan dua akun terpisah.
 */
export function rapikanWa(masukan: unknown): string | null {
  const nomor = nomorWa(masukan);
  if (!nomor) return null;
  // Nomor Indonesia yang wajar: 62 diikuti 9–13 angka. Batas ini menahan salah
  // ketik yang jelas, bukan memvalidasi bahwa nomornya benar-benar aktif —
  // yang terakhir hanya dapat dibuktikan OTP, dan OTP sengaja tidak dipakai.
  if (!/^62\d{8,13}$/.test(nomor)) return null;
  return nomor;
}

/**
 * Nomor yang disamarkan untuk ditampilkan kembali kepada pemiliknya.
 *
 * "6281234567890" menjadi "6281*****7890". Cukup bagi pemiliknya untuk
 * mengenali nomornya sendiri, tidak cukup bagi orang yang mengintip layar
 * untuk menyalinnya.
 */
export function samarkanWa(nomor: string) {
  if (nomor.length <= 8) return nomor;
  return `${nomor.slice(0, 4)}${"*".repeat(nomor.length - 8)}${nomor.slice(-4)}`;
}
