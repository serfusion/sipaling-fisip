// ============================================================
// PENILAIAN ESAI OLEH AI — ATURAN YANG TIDAK MENYENTUH BASIS DATA
//
// Sejak v49 esai dinilai dengan SATU cara: AI (Gemini, ChatGPT, atau Claude,
// mana pun yang kuncinya terpasang) membaca jawaban terhadap RUBRIK MATA
// KULIAHNYA, segera sesudah peserta mengumpulkan. Jawaban acuan dan penilai
// "bentuk jawaban" tanpa model sudah dihapus.
//
// Berkas ini memuat aturan-aturan yang menentukan jawaban MANA yang dinilai,
// dipisahkan dari jalur basis datanya (src/lib/nilai-otomatis.ts) supaya
// dapat diuji tanpa Postgres maupun kunci model. Kesalahan di sini tidak
// terlihat dari luar: yang salah bukan angkanya, melainkan jawaban yang
// diam-diam tidak pernah dinilai, atau nilai pengajar yang diam-diam ditimpa.
// ============================================================

// ------------------------------------------------------------
// SATU RUBRIK UNTUK SATU MATA KULIAH
// ------------------------------------------------------------

/**
 * Kunci mata kuliah: nama yang dinormalkan.
 *
 * Nama mata kuliah diketik bebas pada tiap ujian. "Sosiologi Politik" dan
 * "sosiologi  politik" adalah mata kuliah yang sama, dan memperlakukannya
 * sebagai dua mata kuliah berarti satu kelas paralel dinilai dengan rubrik
 * dan kelas lainnya tidak.
 *
 * Yang dinormalkan hanya huruf besar-kecil dan spasi. Tanda baca TIDAK
 * dibuang: "Statistik I" dan "Statistik II" harus tetap dua mata kuliah.
 *
 * Rumus yang sama dipakai SQL migrasi v49 untuk mengisi tabelnya:
 *   left(lower(btrim(regexp_replace(course_name, '\s+', ' ', 'g'))), 160)
 */
export function kunciMatkul(nama: string | null | undefined): string {
  return String(nama ?? "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 160);
}

// ------------------------------------------------------------
// JENIS SOAL YANG DINILAI AI
// ------------------------------------------------------------

/**
 * Soal ini dinilai AI dengan rubrik?
 *
 * Esai: selalu, ia memang tidak punya kunci.
 *
 * Isian singkat: HANYA bila tidak berkunci. Isian yang berkunci sudah dinilai
 * tepat oleh pencocokan teks, gratis dan tanpa salah baca; menyerahkannya ke
 * model berarti membayar untuk jawaban yang lebih buruk.
 */
export function dinilaiRubrik(soal: { jenis: string; kunci?: string }): boolean {
  if (soal.jenis === "essay") return true;
  if (soal.jenis === "isian") return String(soal.kunci ?? "").trim() === "";
  return false;
}

// ------------------------------------------------------------
// TANDA "SEDANG DINILAI"
// ------------------------------------------------------------

/**
 * Isi kolom graded_by selama AI sedang menilai satu jawaban.
 *
 * Penilaian berjalan dari dua tempat: sesudah peserta mengumpulkan, dan dari
 * papan pantau pengajar yang menyegar tiap sepuluh detik. Tanpa tanda ini,
 * keduanya menilai jawaban yang SAMA bersamaan, dan setiap lembar yang
 * dikumpulkan selagi papan pantau terbuka dibayar dua kali dari kuota AI
 * bulanan.
 */
export const TANDA_MENILAI = "AI: sedang menilai";

/**
 * Umur tanda di atas. Lewat dari ini, jawabannya boleh diklaim lagi.
 *
 * Ada karena penilai dapat mati di tengah jalan (fungsi server dihentikan,
 * jaringan putus) tanpa sempat melepas tandanya. Tanpa batas umur, jawaban
 * itu terkunci selamanya sebagai "sedang dinilai".
 */
export const MASA_KLAIM_MS = 5 * 60_000;

export function klaimMasihBerlaku(
  gradedBy: string | null | undefined,
  diubah: Date | null | undefined,
  sekarang: Date = new Date(),
): boolean {
  if (gradedBy !== TANDA_MENILAI || !diubah) return false;
  return sekarang.getTime() - diubah.getTime() < MASA_KLAIM_MS;
}

/**
 * Nilai ini dibuat penilai mesin LAMA yang sudah dihapus?
 *
 * "Otomatis (bentuk jawaban)" dari penilai tanpa model, dan "Acuan: ..." dari
 * jawaban acuan pengajar. Keduanya tidak membaca isi jawaban terhadap rubrik,
 * jadi jawaban yang masih membawanya dinilai ulang AI. Itulah arti "berlaku
 * juga untuk soal yang sudah dibuat".
 */
export function penilaiMesinLama(gradedBy: string | null | undefined): boolean {
  const s = String(gradedBy ?? "");
  return s.startsWith("Otomatis") || s.startsWith("Acuan:");
}

/**
 * Jawaban ini perlu dinilai AI sekarang?
 *
 * Aturan untuk penilaian yang berjalan SENDIRI. Penilaian ulang yang diminta
 * pengajar lewat tombolnya tidak lewat sini: ia memang sengaja menilai semua.
 *
 *   kosong                          tidak; tidak ada yang dapat dibaca
 *   lembarnya sudah disahkan        tidak; yang sudah ditandatangani pengajar
 *                                   tidak diubah diam-diam
 *   sedang dinilai penilai lain     tidak; lihat TANDA_MENILAI
 *   belum dinilai siapa pun         YA
 *   rubriknya belum lengkap         YA; level pengajar yang sudah ada tetap
 *   dinilai penilai mesin lama      YA
 *   dinilai AI atau pengajar        tidak; angka pengajar tidak pernah ditimpa
 *
 * "Belum dinilai siapa pun" dibaca dari graded_by yang KOSONG, bukan dari
 * is_correct. Isian tanpa kunci keluar dari pengumpulan dengan is_correct
 * false (pencocokan teksnya tidak menemukan kunci apa pun), padahal belum
 * seorang pun membacanya.
 */
export function perluDinilaiAi(
  j: {
    jawaban: string | null | undefined;
    isCorrect: boolean | null | undefined;
    gradedBy: string | null | undefined;
    diubah?: Date | null;
    disahkan: boolean;
  },
  sekarang: Date = new Date(),
): boolean {
  if (!String(j.jawaban ?? "").trim()) return false;
  if (j.disahkan) return false;
  if (klaimMasihBerlaku(j.gradedBy, j.diubah, sekarang)) return false;
  if (!String(j.gradedBy ?? "").trim()) return true;
  if (j.isCorrect === null || j.isCorrect === undefined) return true;
  // Klaim yang sudah basi: penilai yang mengklaimnya mati sebelum selesai.
  if (j.gradedBy === TANDA_MENILAI) return true;
  return penilaiMesinLama(j.gradedBy);
}

// ------------------------------------------------------------
// MENJALANKAN BEBERAPA PANGGILAN SEKALIGUS
// ------------------------------------------------------------

/**
 * Kerjakan daftar dengan paling banyak `batas` pekerjaan berjalan bersamaan.
 *
 * Satu panggilan model memakan belasan detik. Lima esai satu peserta yang
 * dinilai berurutan berarti lebih dari satu menit sebelum nilainya lengkap;
 * dinilai bersamaan, kurang dari setengahnya. Batasnya ada supaya kelas
 * berisi empat puluh orang tidak menembakkan dua ratus permintaan sekaligus
 * ke kunci yang kuotanya per menit.
 */
export async function berbarengan<T>(
  daftar: T[],
  batas: number,
  kerja: (isi: T) => Promise<void>,
): Promise<void> {
  let berikut = 0;
  const pekerja = Array.from({ length: Math.max(1, Math.min(batas, daftar.length)) }, async () => {
    while (berikut < daftar.length) {
      const isi = daftar[berikut];
      berikut += 1;
      await kerja(isi);
    }
  });
  await Promise.all(pekerja);
}
