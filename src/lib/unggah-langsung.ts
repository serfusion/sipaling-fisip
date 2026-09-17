// ============================================================
// UNGGAH LANGSUNG KE PENYIMPANAN — kenapa berkas tidak lagi lewat /api
//
// PENYERAHAN SKRIPSI MENGIRIM EMPAT PDF SEKALIGUS. Batasnya 10 + 10 + 10 MB
// untuk tiga bagian pertama dan 25 MB untuk berkas utuh, jadi satu penyerahan
// yang sah dapat berukuran puluhan MB.
//
// Yang tidak pernah diperhitungkan: fungsi serverless Vercel MENOLAK badan
// permintaan yang lebih besar dari 4,5 MB, dan penolakan itu terjadi di tepi
// jaringan — sebelum satu baris pun kode route dijalankan. Jawabannya halaman
// HTML, bukan JSON, sehingga readApi di peramban gagal mengurainya dan yang
// muncul di layar mahasiswa hanya "Terjadi gangguan. Silakan coba lagi."
//
// Artinya penyerahan yang wajar — satu skripsi utuh saja biasanya sudah 5-15
// MB — TIDAK PERNAH bisa berhasil di produksi. Yang lolos hanya berkas yang
// kebetulan sangat kecil, dan itulah sebabnya masalahnya tampak muncul
// sesekali, bukan selalu.
//
// PERBAIKANNYA: berkasnya tidak lagi menumpang badan permintaan API.
//
//   1. Peramban meminta izin unggah ke /api/unggah/bagian — sebuah JSON
//      kecil berisi nama, ukuran, dan bagian mana yang hendak diunggah.
//   2. Server menjawab dengan URL unggah bertanda tangan milik Supabase
//      Storage, berlaku singkat dan HANYA untuk satu jalur yang ia tentukan
//      sendiri.
//   3. Peramban mengunggah berkasnya LANGSUNG ke Supabase. Tidak ada satu
//      bita pun yang melewati fungsi serverless, jadi batas 4,5 MB tidak
//      berlaku dan fungsi tidak pernah kehabisan waktu.
//   4. Formulir dikirim membawa jalur berkasnya saja — beberapa ratus bita.
//      Server memverifikasi tiap berkas (ada, ukurannya wajar, isinya
//      benar-benar PDF) lalu memindahkannya ke folder tiketnya.
//
// KENAPA JALURNYA DITANDATANGANI. Tanpa tanda tangan, siapa pun dapat
// mengirim formulir yang menunjuk jalur berkas milik orang lain dan
// melampirkannya ke tiketnya sendiri. Tanda tangan HMAC dibuat server saat
// memberi izin, berumur pendek, dan diperiksa lagi saat formulir masuk:
// jalur yang tidak pernah diizinkan server tidak akan pernah diterima.
//
// RUANG TRANSIT DAN SAMPAHNYA. Berkas mendarat di folder "transit" lebih
// dahulu, lalu dipindahkan ke folder tiket ketika formulirnya benar-benar
// terkirim. Yang tertinggal di transit berarti mahasiswa membatalkan
// pengisian di tengah jalan; /api/cleanup menyapunya setiap hari. Tanpa
// pemisahan ini, berkas yatim tidak dapat dibedakan dari berkas yang sah.
//
// SENGAJA bebas dari database, Supabase, dan node:crypto supaya boleh
// diimpor dari komponen client maupun dari route API. Penandatanganannya
// tinggal di src/lib/unggah-tanda.ts, yang hanya dipanggil server.
// ============================================================

/** Folder penyimpanan yang boleh menerima unggahan langsung. */
export const FOLDER_TRANSIT = ["requests", "revisions"] as const;
export type FolderTransit = (typeof FOLDER_TRANSIT)[number];

export function isFolderTransit(nilai: string): nilai is FolderTransit {
  return (FOLDER_TRANSIT as readonly string[]).includes(nilai);
}

/**
 * Batas badan permintaan pada fungsi serverless Vercel: 4,5 MB.
 *
 * Angka ini milik platform, bukan pilihan portal, dan tidak dapat dinaikkan
 * lewat konfigurasi. Ia ditulis di sini supaya jalur cadangan (kirim berkas
 * lewat API seperti dulu) tahu kapan harus berhenti dan memberi pesan yang
 * jelas, alih-alih membiarkan Vercel menjawab dengan halaman HTML.
 */
export const BATAS_BADAN_SERVERLESS = 4_500_000;

/** Sisa aman untuk kolom teks formulir di luar berkasnya. */
export const BATAS_AMAN_MULTIPART = 4_000_000;

/** Umur izin unggah. Sama dengan umur URL bertanda tangan Supabase (2 jam). */
export const UMUR_IZIN_MS = 2 * 60 * 60 * 1000;

/** Prefiks folder singgah, dipakai bersama oleh pemberi izin dan penyapu. */
export const PREFIKS_TRANSIT = "transit";

export type IzinUnggah = {
  /** Jalur tujuan di dalam bucket. */
  jalur: string;
  /** Nama bucket, dikirim supaya peramban tidak perlu mengimpor modul server. */
  bucket: string;
  /** URL unggah bertanda tangan milik Supabase Storage. */
  url: string;
  /** Token unggah, untuk uploadToSignedUrl. */
  token: string;
  /** Tanda tangan jalur; dikembalikan lagi saat formulir dikirim. */
  tanda: string;
  /** Waktu kedaluwarsa tanda tangan, dalam milidetik epoch. */
  kedaluwarsa: number;
};

/** Berkas yang sudah mendarat di transit dan siap diklaim formulir. */
export type BagianTerunggah = {
  id: string;
  nama: string;
  ukuran: number;
  jalur: string;
  tanda: string;
  kedaluwarsa: number;
};

/** Nama berkas yang aman dipakai sebagai bagian dari jalur penyimpanan. */
export function namaJalurAman(nama: string) {
  return (
    nama
      .normalize("NFKD")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "dokumen"
  );
}

/** Tanggal WIB dalam bentuk YYYY-MM-DD, dipakai sebagai nama folder transit. */
export function hariTransit(waktu = Date.now()) {
  return new Date(waktu + 7 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Jalur singgah untuk satu berkas.
 *
 * Seluruh bagiannya ditentukan SERVER: mahasiswa tidak pernah memilih ke mana
 * berkasnya mendarat. Nama aslinya ikut dibawa hanya supaya admin yang
 * membuka Supabase masih mengenali isinya, dan itu pun sudah dibersihkan.
 */
export function jalurTransit(folder: FolderTransit, bagianId: string, namaBerkas: string) {
  const acak = globalThis.crypto.randomUUID();
  return `${folder}/${PREFIKS_TRANSIT}/${hariTransit()}/${acak}-${bagianId}-${namaJalurAman(namaBerkas)}.pdf`;
}

/** Benar bila jalur ini berbentuk jalur transit milik folder tersebut. */
export function jalurTransitSah(jalur: string, folder: FolderTransit) {
  if (!jalur || jalur.length > 300) return false;
  // Titik ganda dan garis miring ganda adalah jalan pintas ke folder lain.
  if (jalur.includes("..") || jalur.includes("//")) return false;
  const pola = new RegExp(
    `^${folder}/${PREFIKS_TRANSIT}/\\d{4}-\\d{2}-\\d{2}/[0-9a-f-]{36}-[a-z]+-[A-Za-z0-9._-]+\\.pdf$`,
  );
  return pola.test(jalur);
}

/** Berapa bita seluruh berkas ini bila dikirim sekaligus lewat API. */
export function totalBita(berkas: Array<{ size: number } | null>) {
  return berkas.reduce((jumlah, b) => jumlah + (b?.size ?? 0), 0);
}

/**
 * Apakah kumpulan berkas ini masih muat dikirim lewat fungsi serverless?
 *
 * Dipakai jalur cadangan saja. Bila jawabannya tidak, mahasiswa diberi tahu
 * sebabnya di sini — bukan dibiarkan menunggu unggahan yang sudah pasti
 * ditolak di tepi jaringan.
 */
export function muatLewatServerless(berkas: Array<{ size: number } | null>) {
  const total = totalBita(berkas);
  if (total <= BATAS_AMAN_MULTIPART) return { ok: true as const, total };
  const mb = (total / (1024 * 1024)).toFixed(1);
  return {
    ok: false as const,
    total,
    pesan:
      `Total berkas ${mb} MB. Unggahan langsung ke penyimpanan sedang tidak tersedia, ` +
      "dan jalur cadangan hanya sanggup mengirim sekitar 4 MB sekali jalan. " +
      "Perkecil ukuran berkasnya (simpan ulang sebagai PDF teks, bukan hasil pindai foto) " +
      "atau coba lagi beberapa saat lagi.",
  };
}
