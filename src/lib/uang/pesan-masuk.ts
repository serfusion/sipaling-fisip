// ============================================================
// PERKAKAS BERSAMA JALUR PESAN MASUK
//
// Dua hal kecil yang dibutuhkan Telegram maupun WhatsApp, dan keduanya
// berbahaya bila ditulis dua kali dengan cara yang sedikit berbeda.
// ============================================================
import { timingSafeEqual } from "node:crypto";

/**
 * Membandingkan tanda tangan tanpa membocorkan panjang kecocokannya.
 *
 * Perbandingan biasa berhenti pada huruf pertama yang berbeda, dan selisih
 * waktunya cukup untuk menebak tanda tangan huruf demi huruf.
 */
export function tandaCocok(kirim: string, simpan: string) {
  const a = Buffer.from(String(kirim || ""), "utf8");
  const b = Buffer.from(String(simpan || ""), "utf8");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Nomor kiriman yang baru saja dikerjakan, per kanal.
 *
 * Telegram dan WhatsApp sama-sama mengirim ulang kiriman yang tidak dijawab
 * tepat waktu, dan tanpa penyaring ini satu "beli kopi 15k" dapat tercatat
 * dua kali. Penyaringnya hanya berlaku selama proses ini hidup, jadi ia
 * peredam, bukan jaminan; jaminannya datang dari menjawab cepat dan selalu
 * dengan 200.
 */
const sudah = new Map<string, Set<string>>();

export function pernahDikerjakan(kanal: string, nomor: string | number | undefined | null) {
  if (nomor === undefined || nomor === null || nomor === "") return false;
  const kunci = String(nomor);

  let daftar = sudah.get(kanal);
  if (!daftar) {
    daftar = new Set();
    sudah.set(kanal, daftar);
  }
  if (daftar.has(kunci)) return true;

  daftar.add(kunci);
  if (daftar.size > 500) {
    // Set menyimpan urutan masuk, jadi yang dibuang lebih dulu memang yang
    // paling lama. Kiriman selama itu tidak akan diulang lagi oleh siapa pun.
    for (const lama of daftar) {
      daftar.delete(lama);
      if (daftar.size <= 250) break;
    }
  }
  return false;
}
