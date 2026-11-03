// ============================================================
// KODE TUGAS — kode kiriman, kode pengumpulan, tautan pendek Arsip Drive
//
// Tiga kode dengan tiga sifat yang berbeda, dan perbedaannya disengaja:
//
//   SIPALING-TUGAS-H7KQ3MXP  kode KIRIMAN, satu per mahasiswa per tugas.
//                            RAHASIA: hanya pemiliknya yang tahu, dan kode
//                            inilah satu-satunya kunci untuk membuka
//                            keterangan nilai di papan. Karena itu delapan
//                            hurufnya acak (30^8 ≈ 6,6 × 10^11 kemungkinan),
//                            bukan nomor urut 001, 002, ... yang dapat ditebak
//                            siapa pun yang mengumpulkan sesudah temannya.
//   K7M2QX                   kode PENGUMPULAN, satu per tugas. Bukan rahasia:
//                            dibacakan di kelas seperti kode ujian.
//   /s/K7Q2XMP               kode TAUTAN PENDEK Arsip Drive.
//
// Abjadnya membuang huruf yang mudah tertukar saat dibaca atau diketik ulang
// dari tangkapan layar: I, L, O, U, 0, dan 1.
//
// Acaknya dari crypto.getRandomValues (ada di peramban dan Node 19+), bukan
// Math.random: kode kiriman adalah kunci, dan kunci tidak boleh lahir dari
// pembangkit yang urutannya dapat diduga.
//
// SELURUHNYA FUNGSI MURNI, diuji di uji-tugas-cbt.ts.
// ============================================================

export const AWALAN_RESI = "SIPALING-TUGAS-";
/** 30 huruf: tanpa I, L, O, U, 0, 1. */
export const ABJAD_KODE = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
export const PANJANG_RESI = 8;
export const PANJANG_KODE_TUGAS = 6;
export const PANJANG_KODE_ARSIP = 7;

/** Untai acak dari abjad, tanpa bias modulo (sampel ditolak bila di luar batas). */
export function acakKode(panjang: number, abjad = ABJAD_KODE): string {
  const hasil: string[] = [];
  const batas = 256 - (256 % abjad.length);
  while (hasil.length < panjang) {
    const bita = new Uint8Array(panjang * 2);
    globalThis.crypto.getRandomValues(bita);
    for (const b of bita) {
      if (b >= batas) continue;
      hasil.push(abjad[b % abjad.length]);
      if (hasil.length === panjang) break;
    }
  }
  return hasil.join("");
}

/** Kode kiriman baru, mis. "SIPALING-TUGAS-H7KQ3MXP". */
export function buatKodeResi(): string {
  return AWALAN_RESI + acakKode(PANJANG_RESI);
}

/**
 * Rapikan kode kiriman yang DIKETIK orang.
 *
 * Mahasiswa menyalinnya dari tangkapan layar, mengetiknya dengan huruf kecil,
 * memberi spasi, atau melupakan awalannya. Semua bentuk itu diterima:
 *
 *   "sipaling tugas h7kq 3mxp"  → "SIPALING-TUGAS-H7KQ3MXP"
 *   "H7KQ-3MXP"                 → "SIPALING-TUGAS-H7KQ3MXP"
 *
 * Mengembalikan "" bila bukan kode kiriman yang sah. Huruf di luar abjad
 * (I, L, O, U, 0, 1) tidak ditebak maksudnya: tebakan yang salah akan
 * membuka kode orang lain, dan itu lebih buruk daripada "kode tidak dikenali".
 */
export function rapikanKodeResi(masuk: unknown): string {
  let s = String(masuk ?? "").toUpperCase().trim();
  s = s.replace(/^SIPALING[\s_.-]*TUGAS[\s_.-]*/, "");
  s = s.replace(/[\s_.-]+/g, "");
  if (s.length !== PANJANG_RESI) return "";
  for (const h of s) if (!ABJAD_KODE.includes(h)) return "";
  return AWALAN_RESI + s;
}

/** Kode pengumpulan baru untuk satu tugas, mis. "K7M2QX". */
export function buatKodeTugas(): string {
  return acakKode(PANJANG_KODE_TUGAS);
}

/** Rapikan kode pengumpulan yang diketik: huruf besar, tanpa spasi dan tanda. */
export function rapikanKodeTugas(masuk: unknown): string {
  return String(masuk ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

/** Kode tautan pendek Arsip Drive, mis. "K7Q2XMP". */
export function buatKodeArsip(): string {
  return acakKode(PANJANG_KODE_ARSIP);
}

export function rapikanKodeArsip(masuk: unknown): string {
  const s = String(masuk ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length >= 4 && s.length <= 16 ? s : "";
}

/**
 * NIM yang disamarkan untuk papan nilai: "23702010192" → "2370•••••92".
 *
 * Papan nilai dibaca siapa saja, seperti mading. Nama tetap utuh supaya
 * mahasiswa menemukan barisnya; NIM cukup sebagian untuk membedakan dua nama
 * yang sama, tanpa membeberkan nomor induk seluruh kelas.
 */
export function samarkanNim(nim: unknown): string {
  const s = String(nim ?? "").replace(/\s/g, "");
  if (!s) return "";
  if (s.length <= 4) return `${s[0]}${"•".repeat(s.length - 1)}`;
  if (s.length <= 7) return `${s.slice(0, 2)}${"•".repeat(s.length - 3)}${s.slice(-1)}`;
  return `${s.slice(0, 4)}${"•".repeat(s.length - 6)}${s.slice(-2)}`;
}

/**
 * Tautan Google Drive/Docs yang sah, atau "" bila bukan.
 *
 * Pemendek tautan portal HANYA menerima Google Drive. Pemendek yang menerima
 * alamat apa saja adalah pengalih terbuka: tautan bernama portal kampus yang
 * mendarat di situs penipu. SQL v54 menegakkan aturan yang sama.
 */
export function tautanDriveSah(masuk: unknown): string {
  const s = String(masuk ?? "").trim();
  if (!s || s.length > 2000 || /\s/.test(s)) return "";
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return "";
  }
  if (url.protocol !== "https:") return "";
  if (!/^(drive|docs)\.google\.com$/i.test(url.hostname)) return "";
  if (url.username || url.password || url.port) return "";
  return url.toString();
}

/** SHA-256 berkas dalam heksadesimal huruf kecil (peramban dan Node 19+). */
export async function sidikBerkas(data: Uint8Array): Promise<string> {
  const salin = new Uint8Array(data.byteLength);
  salin.set(data);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", salin.buffer as ArrayBuffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const sidikSah = (s: unknown) => typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
