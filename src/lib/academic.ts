// Konstanta & util bersama untuk Pengajuan Judul Tugas Akhir dan
// Database Dokumen. Dipakai bersama oleh route API dan komponen klien,
// sehingga daftar pilihan di layar selalu sama persis dengan yang
// divalidasi di server.

export const FINAL_TASK_TYPES = ["Skripsi", "Jurnal"] as const;
export type FinalTaskType = (typeof FINAL_TASK_TYPES)[number];

export const PROPOSAL_STATUS = {
  waitingProdi: "Menunggu Verifikasi Prodi",
  waitingLecturer: "Menunggu Persetujuan Dosen",
  acceptedLecturer: "Disetujui Dosen",
  rejectedLecturer: "Ditolak Dosen",
  rejectedProdi: "Ditolak Prodi",
} as const;

export const CHOICE_DECISIONS = ["Menunggu", "Diterima", "Ditolak"] as const;
export type ChoiceDecision = (typeof CHOICE_DECISIONS)[number];

export const STUDY_PROGRAMS = ["Ilmu Komunikasi", "Ilmu Pemerintahan"] as const;

// Konsentrasi/kejuruan per program studi.
// Ilmu Komunikasi hanya memiliki tiga konsentrasi.
// Ilmu Pemerintahan TIDAK memiliki jurusan maupun konsentrasi — daftarnya
// sengaja kosong dan formulir akan menyembunyikan kolomnya.
export const CONCENTRATIONS: Record<string, string[]> = {
  "Ilmu Komunikasi": ["Public Relations", "Advertising", "Broadcasting"],
  "Ilmu Pemerintahan": [],
};

// Nilai yang disimpan untuk prodi tanpa konsentrasi, supaya kolom database
// tetap terisi dan surat tugas tidak menampilkan bagian kosong.
export const NO_CONCENTRATION = "Tanpa Konsentrasi";

export function concentrationsFor(studyProgram: string) {
  return CONCENTRATIONS[studyProgram] || [];
}

export function hasConcentration(studyProgram: string) {
  return concentrationsFor(studyProgram).length > 0;
}

export const DOCUMENT_CATEGORIES = [
  "Surat Tugas",
  "Sertifikat",
  "Sertifikasi",
  "Publikasi Jurnal",
  "Jurnal Bersama Mahasiswa",
  "Artikel Ilmiah",
  "Surat Keputusan",
  "Hak Kekayaan Intelektual",
  "Pengabdian Masyarakat",
  "Penelitian",
  "Dokumen Lainnya",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const MAX_LECTURER_CHOICES = 3;

// Batas wajar jumlah mahasiswa bimbingan aktif per dosen. Dipakai hanya
// sebagai penanda visual di layar Prodi, bukan larangan keras.
export const GUIDANCE_SOFT_LIMIT = 10;

const DEGREE_PREFIX =
  /^(prof(?:\.|esor)?|dr(?:\.|s\.?|a\.?)?|drs\.?|dra\.?|ir\.?|h\.|hj\.|kh\.|apt\.|ns\.)\s+/i;

// Nama dosen diurutkan berdasarkan nama aslinya, bukan gelar depannya:
// "Dr. Mirza Shahreza, M.I.K" diurutkan pada huruf "M", bukan "D".
export function lecturerSortKey(name: string) {
  let value = name.trim();
  // Buang gelar depan berlapis, mis. "Prof. Dr. Ir. Budi" -> "Budi".
  for (let guard = 0; guard < 5; guard++) {
    const next = value.replace(DEGREE_PREFIX, "");
    if (next === value) break;
    value = next;
  }
  return value.trim() || name.trim();
}

export function compareLecturerName(a: string, b: string) {
  return lecturerSortKey(a).localeCompare(lecturerSortKey(b), "id-ID", { sensitivity: "base" });
}

// Kode pelacakan pengajuan judul selalu berawalan SIPALING-PRODI-JUDUL-
// agar tidak tertukar dengan nomor tiket layanan biasa.
export const PROPOSAL_CODE_PREFIX = "SIPALING-PRODI-JUDUL-";

export function isProposalCode(value: string) {
  return value.trim().toUpperCase().startsWith(PROPOSAL_CODE_PREFIX);
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa I/O/0/1 agar tidak salah baca

export function makeProposalCode() {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
  return `${PROPOSAL_CODE_PREFIX}${body.slice(0, 5)}-${body.slice(5)}`;
}

export const DEFAULT_STATEMENT =
  "Dengan ini saya menyatakan bahwa judul yang saya ajukan adalah karya asli saya sendiri, " +
  "bukan hasil plagiat, belum pernah diajukan pada program studi mana pun, dan seluruh data " +
  "yang saya isi pada formulir ini benar adanya. Apabila di kemudian hari pernyataan ini " +
  "terbukti tidak benar, saya bersedia menerima sanksi akademik sesuai ketentuan yang berlaku.";
