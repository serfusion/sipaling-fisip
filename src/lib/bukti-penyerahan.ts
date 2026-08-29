// ============================================================
// PENYERAHAN SKRIPSI/JURNAL KE PERPUSTAKAAN — UNGGAH LANGSUNG
//
// Riwayatnya berputar dua kali, dan alasannya perlu dicatat.
//
// Mula-mula empat berkas diunggah ke penyimpanan portal. Kuota cepat penuh,
// jadi dialihkan ke folder Google Drive perpustakaan. Ternyata Drive
// merepotkan mahasiswa: harus punya akun, harus mengatur izin folder, dan
// admin tetap perlu merapikan sendiri.
//
// Sekarang kembali ke unggah langsung, tetapi dengan aturan yang membuatnya
// tidak lagi menggerus kuota. Kuncinya: penyimpanan diperlakukan sebagai
// RUANG TRANSIT, bukan gudang.
//
//   1. Yang masuk dibatasi. Hanya PDF, dengan batas keras per bagian.
//      Yang membuat kuota bengkak biasanya hasil pindai berupa foto.
//   2. Yang menetap dibatasi. Berkas hidup hanya sampai admin mengarsipkannya
//      lewat "Backup Semua" di dashboard: seluruh berkas dibungkus jadi satu
//      arsip zip di peramban admin, turun ke komputernya, lalu dihapus dari
//      penyimpanan portal.
//
// Dengan begitu penyimpanan tidak pernah menumpuk antar musim penyerahan.
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

/** Batas ukuran tiap bagian, dalam MB. */
export const MAKS_BAGIAN_MB = 10;
/** Berkas utuh boleh lebih besar karena memuat seluruh bab sekaligus. */
export const MAKS_FULL_MB = 25;

export function batasBagianMb(id: string) {
  return id === "full" ? MAKS_FULL_MB : MAKS_BAGIAN_MB;
}

/** Empat bagian yang harus diunggah mahasiswa. */
export const BAGIAN_PENYERAHAN: BagianPenyerahan[] = [
  { id: "cover", label: "Cover sampai daftar isi", keterangan: "PDF, maksimal 10 MB." },
  { id: "isi", label: "BAB I sampai BAB V", keterangan: "Bagian isi skripsi. PDF, maksimal 10 MB." },
  { id: "pustaka", label: "Daftar pustaka sampai selesai", keterangan: "Bagian akhir skripsi. PDF, maksimal 10 MB." },
  { id: "full", label: "Skripsi full format PDF", keterangan: "Satu berkas lengkap. PDF, maksimal 25 MB." },
];

/**
 * Pemeriksaan satu berkas bagian, dipakai bersama peramban dan server.
 *
 * Sisi peramban memakainya supaya mahasiswa tahu masalahnya sebelum menunggu
 * unggahan selesai; sisi server memakainya lagi karena pemeriksaan di
 * peramban selalu bisa dilewati. Aturannya satu, jadi keduanya tidak mungkin
 * berselisih.
 */
export function periksaBerkasBagian(
  id: string,
  berkas: { name: string; size: number } | null,
): { ok: true } | { ok: false; pesan: string } {
  const bagian = BAGIAN_PENYERAHAN.find((b) => b.id === id);
  const nama = bagian?.label ?? id;
  if (!berkas || !berkas.name) {
    return { ok: false, pesan: `Berkas "${nama}" belum dipilih.` };
  }
  if (!berkas.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, pesan: `Berkas "${nama}" harus PDF.` };
  }
  const maks = batasBagianMb(id);
  if (berkas.size > maks * 1024 * 1024) {
    const mb = (berkas.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      pesan:
        `Berkas "${nama}" berukuran ${mb} MB, melebihi batas ${maks} MB. ` +
        "Ukuran sebesar ini biasanya karena halamannya dipindai sebagai foto. " +
        "Simpan ulang sebagai PDF teks, atau perkecil resolusi pindaiannya.",
    };
  }
  return { ok: true };
}

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
