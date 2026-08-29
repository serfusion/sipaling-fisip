// ============================================================
// PENYERAHAN SKRIPSI/JURNAL KE PERPUSTAKAAN — LEWAT GOOGLE DRIVE
//
// Sebelumnya empat berkas skripsi diunggah ke penyimpanan portal. Satu
// mahasiswa bisa memakai puluhan MB, dan kuota penyimpanan cepat penuh.
//
// Sekarang berkasnya diunggah ke folder Google Drive milik perpustakaan.
// Portal hanya menyimpan tautannya, jadi berkas tetap dipegang perpustakaan
// dan penyimpanan portal tidak ikut terisi.
//
// Berkas ini SENGAJA bebas dari database dan Supabase supaya boleh diimpor
// dari komponen client (form mahasiswa, dashboard) maupun dari route API.
// ============================================================

/** Nama kebutuhan yang dipakai sekarang. */
export const PENYERAHAN_NEED = "Penyerahan Skripsi/Jurnal";

/** Nama lama sebelum pindah ke Google Drive. Tetap diterima supaya tiket dan
 *  tautan yang sudah tersebar tidak menjadi tidak valid. */
export const PENYERAHAN_NEED_LAMA = "Upload Bukti Penyerahan Jurnal/Skripsi";

export const ABSENSI_NEED = "Absensi Perpustakaan";

export type BagianPenyerahan = {
  id: string;
  /** Nama berkas yang harus ada di folder Drive. */
  label: string;
  /** Satu baris penjelas. */
  keterangan: string;
};

/** Daftar berkas yang harus diunggah mahasiswa ke folder Drive perpustakaan. */
export const BAGIAN_PENYERAHAN: BagianPenyerahan[] = [
  { id: "cover", label: "Cover sampai daftar isi", keterangan: "PDF atau hasil pindai." },
  { id: "isi", label: "BAB I sampai BAB V", keterangan: "Bagian isi skripsi." },
  { id: "pustaka", label: "Daftar pustaka sampai selesai", keterangan: "Bagian akhir skripsi." },
  { id: "full", label: "Skripsi full format PDF", keterangan: "Satu berkas lengkap." },
];

export function isPenyerahanPerpus(serviceType: string, serviceNeed: string) {
  return (
    serviceType === "Layanan Perpustakaan" &&
    (serviceNeed === PENYERAHAN_NEED || serviceNeed === PENYERAHAN_NEED_LAMA)
  );
}

export function isAbsensiPerpus(serviceType: string, serviceNeed: string) {
  return serviceType === "Layanan Perpustakaan" && serviceNeed === ABSENSI_NEED;
}

/**
 * Pemeriksaan tautan Drive yang dipakai bersama peramban dan server.
 *
 * Sisi klien memakainya supaya mahasiswa mendapat pesan yang jelas sebelum
 * mengirim; sisi server memakainya lagi karena pemeriksaan di peramban selalu
 * bisa dilewati. Aturannya satu, jadi keduanya tidak mungkin berbeda.
 */
export function periksaTautanDrive(
  nilai: string | null | undefined,
): { ok: true; tautan: string } | { ok: false; pesan: string } {
  const tautan = (nilai || "").trim();
  if (!tautan) {
    return { ok: false, pesan: "Tautan Google Drive belum diisi." };
  }
  if (tautan.length > 500) {
    return { ok: false, pesan: "Tautan Google Drive terlalu panjang." };
  }
  if (!/^https:\/\/(drive|docs)\.google\.com\/\S+$/i.test(tautan)) {
    return {
      ok: false,
      pesan: "Tautan harus dimulai dengan https://drive.google.com/ atau https://docs.google.com/",
    };
  }
  return { ok: true, tautan };
}
