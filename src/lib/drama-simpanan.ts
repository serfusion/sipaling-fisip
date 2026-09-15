// ============================================================
// SIMPANAN JAWABAN HULU
//
// Menu Nonton Drama berdiri di atas API milik orang lain. API itu berjalan di
// satu mesin, tagihannya dibayar dari donasi, dan ia memang sesekali mati —
// beberapa detik, kadang beberapa menit. Sebelum berkas ini ada, tiap detik
// mati itu sampai utuh ke layar pengunjung sebagai "Sumber dramanya sedang
// tidak menjawab", dan menu yang hulunya mati sembilan puluh detik sehari
// terbaca sebagai menu yang rusak sepanjang hari.
//
// YANG DIKERJAKAN DI SINI: jawaban hulu yang berhasil diingat sebentar. Bila
// permintaan berikutnya gagal, yang diingat itulah yang dipulangkan — bukan
// pesan galat. Daftar judul drama berubah dalam hitungan jam, jadi daftar
// berumur sepuluh menit yang dapat dibuka jauh lebih berguna daripada daftar
// mutakhir yang tidak ada.
//
// TIGA HAL YANG MEMBATASINYA, dan ketiganya disengaja:
//
//   1. UMURNYA BERBEDA MENURUT APA YANG DISIMPAN. Daftar judul boleh basi
//      berjam-jam. Tautan video TIDAK: ia bertanda tangan dan kedaluwarsa
//      sendiri, dan menyajikan tautan mati dari simpanan berarti menukar satu
//      pesan galat dengan pesan galat lain yang lebih membingungkan — video
//      yang berputar lalu berhenti.
//   2. INI MEMORI PROSES, bukan penyimpanan bersama. Di Vercel tiap instance
//      punya memorinya sendiri dan dapat didaur ulang kapan saja, jadi
//      simpanan ini "sebisanya" — persis seperti pembatas laju di
//      src/lib/rate-limit.ts, dan dengan kejujuran yang sama.
//   3. HANYA JAWABAN YANG BERHASIL yang disimpan. Mengingat kegagalan berarti
//      memperpanjang umurnya, dan itu kebalikan dari maksud berkas ini.
//
// Bagian yang menghitung — umur, dan apakah sebuah catatan masih layak pakai —
// dipisahkan sebagai fungsi murni supaya seluruhnya dapat dibuktikan di
// uji-drama.ts tanpa menunggu waktu berjalan.
// ============================================================

import type { Aksi } from "./drama";

/** Berapa lama sebuah jawaban dianggap masih layak dipakai. */
export type Umur = {
  /** Selama ini, simpanan dipakai TANPA menanyai hulu sama sekali. */
  segarMs: number;
  /** Sesudah segar habis, simpanan masih boleh dipakai bila hulu gagal. */
  basiMs: number;
};

const MENIT = 60_000;
const JAM = 60 * MENIT;

/**
 * Umur simpanan menurut apa yang disimpan.
 *
 * Angka-angkanya mengikuti seberapa cepat isinya benar-benar berubah, bukan
 * selera:
 *
 *   daftar judul — hulu sendiri menyusunnya ulang dalam hitungan jam, dan
 *                  judul yang baru masuk tidak akan hilang bila terlihat lima
 *                  menit terlambat.
 *   rincian      — ringkasan dan jumlah episode sebuah judul nyaris tidak
 *                  pernah berubah sesudah judulnya terbit.
 *   episode      — tautan videonya bertanda tangan dan berumur pendek. Yang
 *                  disimpan di sini hanya cukup untuk melewati satu gangguan
 *                  sesaat, bukan untuk menyajikan tautan yang sudah mati.
 */
export function umurSimpanan(aksi: Aksi): Umur {
  if (aksi === "episode") return { segarMs: MENIT, basiMs: 5 * MENIT };
  if (aksi === "rinci") return { segarMs: 10 * MENIT, basiMs: 6 * JAM };
  return { segarMs: 5 * MENIT, basiMs: 12 * JAM };
}

export type Catatan<T> = {
  isi: T;
  /** Kapan jawaban ini datang dari hulu. */
  waktu: number;
};

export type Nilai = "segar" | "basi" | "kedaluwarsa";

/**
 * Seberapa layak sebuah catatan dipakai pada saat tertentu.
 *
 * Dipisahkan dari penyimpanannya supaya dapat diuji dengan jam buatan. Yang
 * diuji dengan `Date.now()` sungguhan adalah yang lulus hari ini dan gagal
 * pada mesin yang kebetulan lebih lambat.
 */
export function nilaiCatatan(waktu: number, sekarang: number, umur: Umur): Nilai {
  const usia = sekarang - waktu;
  // Catatan dari masa depan berarti jam mesinnya mundur di tengah jalan.
  // Diperlakukan sebagai segar, bukan dibuang: yang salah jamnya, bukan
  // isinya, dan membuang isinya berarti kehilangan simpanan tepat pada saat
  // ia paling dibutuhkan.
  if (usia < 0) return "segar";
  if (usia <= umur.segarMs) return "segar";
  if (usia <= umur.basiMs) return "basi";
  return "kedaluwarsa";
}

/** Usia sebuah catatan dalam detik, dibulatkan ke bawah. */
export function usiaDetik(waktu: number, sekarang: number): number {
  return Math.max(0, Math.floor((sekarang - waktu) / 1000));
}

// ============================================================
// PENYIMPANANNYA SENDIRI
// ============================================================

/**
 * Berapa banyak jawaban yang boleh diingat sekaligus.
 *
 * Sepuluh platform dikali enam jenis permintaan dikali halaman-halamannya
 * sudah beberapa ratus, dan pencarian menambah satu catatan untuk tiap kata
 * yang pernah diketik siapa pun. Batasnya menahan itu supaya memori instance
 * tidak tumbuh mengikuti rasa ingin tahu pengunjung.
 */
const MAKS_CATATAN = 600;

const lemari = new Map<string, Catatan<unknown>>();

/** Kunci sebuah permintaan: alamat hulu apa adanya sudah cukup memilah. */
export function kunciSimpanan(platform: string, aksi: string, alamat: string): string {
  return `${platform}:${aksi}:${alamat}`;
}

/**
 * Buang yang sudah tidak berguna, lalu — bila masih penuh — yang paling tua.
 *
 * Map di JavaScript mengingat urutan penyisipan, jadi yang paling depan
 * memang yang paling lama tidak diperbarui. Itu bukan LRU yang sesungguhnya,
 * dan tidak perlu: yang dijaga di sini memori, bukan angka kena-simpan.
 */
function rapikan(sekarang: number) {
  if (lemari.size < MAKS_CATATAN) return;

  for (const [kunci, catatan] of lemari) {
    // Batas terpanjang yang mungkin: apa pun yang lebih tua dari itu tidak
    // akan pernah dipakai lagi oleh pembaca mana pun.
    if (sekarang - catatan.waktu > 12 * JAM) lemari.delete(kunci);
  }

  while (lemari.size >= MAKS_CATATAN) {
    const tertua = lemari.keys().next();
    if (tertua.done) break;
    lemari.delete(tertua.value);
  }
}

export function simpanJawaban<T>(kunci: string, isi: T, sekarang = Date.now()): void {
  rapikan(sekarang);
  // Dihapus lebih dulu supaya penyisipannya pindah ke belakang antrean —
  // tanpa itu, catatan yang terus diperbarui tetap dianggap tertua dan
  // justru dialah yang dibuang lebih dulu saat lemarinya penuh.
  lemari.delete(kunci);
  lemari.set(kunci, { isi, waktu: sekarang });
}

export type Temuan<T> = {
  isi: T;
  nilai: Nilai;
  usiaDetik: number;
};

/**
 * Catatan untuk sebuah kunci, beserta seberapa layak ia dipakai.
 *
 * null berarti tidak ada sama sekali, atau ada tetapi sudah terlalu tua untuk
 * dipakai dalam keadaan apa pun.
 */
export function ambilJawaban<T>(kunci: string, umur: Umur, sekarang = Date.now()): Temuan<T> | null {
  const catatan = lemari.get(kunci) as Catatan<T> | undefined;
  if (!catatan) return null;

  const nilai = nilaiCatatan(catatan.waktu, sekarang, umur);
  if (nilai === "kedaluwarsa") {
    lemari.delete(kunci);
    return null;
  }

  return { isi: catatan.isi, nilai, usiaDetik: usiaDetik(catatan.waktu, sekarang) };
}

/** Untuk uji: mengosongkan lemari supaya satu berkas uji tidak mewarisi isi berkas lain. */
export function kosongkanSimpanan(): void {
  lemari.clear();
}

/** Untuk uji dan pemantauan: berapa catatan yang sedang diingat. */
export function isiSimpanan(): number {
  return lemari.size;
}
