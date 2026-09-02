// ============================================================
// KODE BUKU KAS - bagian yang aman dipakai di peramban
//
// Catatan uang tidak memakai akun. Yang memegang kode buku, dialah
// pemiliknya: satu kode yang sama dipakai di ponsel, di laptop, dan di
// Telegram tanpa perlu login tiga kali.
//
// Karena kode inilah satu-satunya kunci, ia dibuat cukup panjang untuk tidak
// dapat ditebak (dua belas huruf dari tiga puluh satu kemungkinan, sekitar 59
// bit) dan jalur pemakaiannya dibatasi lajunya di sisi server.
// ============================================================

// Sama persis dengan abjad kode Cakrawala: tanpa 0/O, 1/I, dan S yang sering
// tertukar dengan 5 ketika kodenya dibacakan lewat pesan atau ditulis tangan.
const ABJAD = "ABCDEFGHJKLMNPQRTUVWXYZ23456789";

const PANJANG = 12;

/** "UNG-7HQ4-M2XB-9KDT" dari dua belas huruf intinya. */
export function bentukKode(inti: string) {
  return `UNG-${inti.slice(0, 4)}-${inti.slice(4, 8)}-${inti.slice(8, 12)}`;
}

export function buatKodeBuku() {
  const nilai = new Uint32Array(PANJANG);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(nilai);
  } else {
    // Jalur ini tidak pernah dipakai di Node modern maupun di peramban.
    // Ia ada supaya berkas ini tetap dapat diimpor di lingkungan uji.
    for (let i = 0; i < PANJANG; i += 1) nilai[i] = Math.floor(Math.random() * 0xffffffff);
  }
  let inti = "";
  for (let i = 0; i < PANJANG; i += 1) inti += ABJAD[nilai[i] % ABJAD.length];
  return bentukKode(inti);
}

/**
 * Menyeragamkan kode yang diketik orang.
 *
 * Yang dimaafkan: huruf kecil, spasi, tanda hubung yang hilang atau kelebihan,
 * awalan UNG yang tidak ikut disalin, dan huruf S yang sebenarnya angka 5.
 * Yang tidak dimaafkan: panjang yang tidak dua belas, dan huruf di luar abjad.
 *
 * Mengembalikan null bila kodenya tidak mungkin pernah diterbitkan. Dengan
 * begitu kode ngawur tidak sampai menjadi kueri ke basis data.
 */
export function normalisasiKode(teks: unknown): string | null {
  const rapi = String(teks ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^UNG/, "")
    .replace(/S/g, "5");

  if (rapi.length !== PANJANG) return null;
  for (const huruf of rapi) if (!ABJAD.includes(huruf)) return null;
  return bentukKode(rapi);
}

export const NAMA_BUKU_MAKS = 60;

export function rapikanNamaBuku(nama: unknown) {
  const bersih = String(nama ?? "")
    // Huruf kendali dibuang lebih dulu: nama buku ikut muncul di balasan
    // Telegram, dan karakter kendali di dalamnya membuat balasannya kacau.
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAMA_BUKU_MAKS);
  return bersih || "Buku kas saya";
}
