// ============================================================
// UPLOAD BUKTI PENYERAHAN JURNAL/SKRIPSI — DIBAGI EMPAT BAGIAN
//
// Sebelumnya kebutuhan ini hanya menerima SATU berkas PDF gabungan. Admin
// Perpustakaan lalu harus membuka berkas itu dan memilah sendiri mana cover,
// mana isi, dan mana daftar pustaka — pekerjaan yang berulang untuk setiap
// mahasiswa.
//
// Sekarang mahasiswa mengunggah empat bagian terpisah sesuai persyaratan yang
// sudah lama tertulis di form. Berkas datang sudah tersortir, jadi admin
// tinggal mengunduh bagian yang dia perlukan.
//
// Berkas ini SENGAJA bebas dari database dan Supabase supaya boleh diimpor
// dari komponen client (form mahasiswa, dashboard) maupun dari route API.
// ============================================================

export const BUKTI_PENYERAHAN_NEED = "Upload Bukti Penyerahan Jurnal/Skripsi";

/** Jenis berkas yang boleh diunggah pada sebuah bagian. */
export type BuktiFormat = "pdf" | "pdf-atau-gambar";

export type BuktiPart = {
  /** Kode bagian; ikut tersimpan di database dan dipakai untuk mengurutkan. */
  id: string;
  /** Nama field pada FormData. */
  field: string;
  /** Judul kotak unggah. */
  label: string;
  /** Satu baris penjelas di bawah kotak unggah. */
  helper: string;
  /** Kalimat persyaratan yang tampil di kotak kuning. */
  requirement: string;
  format: BuktiFormat;
};

export const BUKTI_PARTS: BuktiPart[] = [
  {
    id: "cover",
    field: "fileCover",
    label: "Upload Cover s/d Daftar Isi",
    helper: "Boleh PDF atau gambar sesuai dokumen yang tersedia.",
    requirement: "Upload cover sampai daftar isi.",
    format: "pdf-atau-gambar",
  },
  {
    id: "isi",
    field: "fileIsi",
    label: "Upload BAB I s/d BAB V",
    helper: "Bagian isi skripsi.",
    requirement: "Upload bagian isi skripsi BAB I sampai BAB V.",
    format: "pdf-atau-gambar",
  },
  {
    id: "pustaka",
    field: "filePustaka",
    label: "Upload Daftar Pustaka s/d Selesai",
    helper: "Bagian akhir skripsi.",
    requirement: "Upload daftar pustaka sampai selesai.",
    format: "pdf-atau-gambar",
  },
  {
    id: "full",
    field: "fileFull",
    label: "Upload File Skripsi Full PDF",
    helper: "File skripsi lengkap format PDF.",
    requirement: "Upload file skripsi full dalam format PDF.",
    format: "pdf",
  },
];

/** Bagian yang juga disalin ke kolom lampiran utama tiket (kompatibilitas). */
export const BUKTI_PART_UTAMA = "full";

export const BUKTI_MAX_BYTES = 10 * 1024 * 1024;

export function isBuktiPenyerahan(serviceType: string, serviceNeed: string) {
  return serviceType === "Layanan Perpustakaan" && serviceNeed === BUKTI_PENYERAHAN_NEED;
}

export function buktiPart(id: string) {
  return BUKTI_PARTS.find((part) => part.id === id) || null;
}

/** Atribut accept untuk <input type="file">. */
export function buktiAccept(format: BuktiFormat) {
  return format === "pdf"
    ? ".pdf,application/pdf"
    : ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
}

const EXT_PDF = [".pdf"];
const EXT_GAMBAR = [".jpg", ".jpeg", ".png"];

export function buktiExtensions(format: BuktiFormat) {
  return format === "pdf" ? EXT_PDF : [...EXT_PDF, ...EXT_GAMBAR];
}

/**
 * Pemeriksaan yang dipakai bersama oleh peramban dan server.
 *
 * Sisi klien memakainya supaya mahasiswa mendapat pesan yang jelas sebelum
 * berkas dikirim; sisi server memakainya lagi karena pemeriksaan di peramban
 * selalu bisa dilewati. Aturannya satu, jadi keduanya tidak mungkin berbeda.
 */
export function periksaBuktiFile(
  part: BuktiPart,
  file: { name: string; size: number } | null,
): { ok: true } | { ok: false; pesan: string } {
  if (!file || !file.name) {
    return { ok: false, pesan: `${part.label} belum dipilih.` };
  }
  const nama = file.name.toLowerCase();
  const diterima = buktiExtensions(part.format);
  if (!diterima.some((ext) => nama.endsWith(ext))) {
    return {
      ok: false,
      pesan:
        part.format === "pdf"
          ? `${part.label} harus berupa file PDF.`
          : `${part.label} harus berupa PDF, JPG, atau PNG.`,
    };
  }
  if (file.size > BUKTI_MAX_BYTES) {
    return { ok: false, pesan: `${part.label} melebihi 10 MB. Perkecil dulu berkasnya.` };
  }
  if (file.size <= 0) {
    return { ok: false, pesan: `${part.label} kosong atau gagal dibaca. Pilih ulang berkasnya.` };
  }
  return { ok: true };
}

/** Tipe MIME yang disimpan bila peramban tidak mengirimkan file.type. */
export function buktiMime(fileName: string, fallback: string) {
  const nama = fileName.toLowerCase();
  if (nama.endsWith(".pdf")) return "application/pdf";
  if (nama.endsWith(".png")) return "image/png";
  if (nama.endsWith(".jpg") || nama.endsWith(".jpeg")) return "image/jpeg";
  return fallback || "application/octet-stream";
}
