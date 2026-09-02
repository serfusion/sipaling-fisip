// ============================================================
// BENTUK UNGGAHAN SATU LAYANAN — berapa berkas, jenis apa, wajib atau tidak
//
// Sebelum berkas ini ada, aturannya tersebar di tiga tempat yang tidak saling
// tahu: formulir pengajuan di peramban, /api/requests di server, dan formulir
// revisi yang ternyata SELALU meminta satu berkas .docx — apa pun layanannya.
//
// Akibatnya nyata: mahasiswa yang menyerahkan skripsi ke perpustakaan
// mengunggah empat PDF saat mengajukan, lalu ketika diminta merevisi ia hanya
// dapat mengunggah satu .docx. Berkas yang tiga lagi tidak pernah tergantikan,
// dan admin memeriksa campuran antara yang lama dan yang baru.
//
// Sekarang aturannya SATU, dan ketiga tempat itu memanggilnya. Menambah
// layanan baru berarti mengubah satu fungsi di sini, bukan mencari tiga
// tempat yang harus diubah bersamaan.
//
// SENGAJA bebas dari database supaya boleh diimpor dari komponen client
// maupun dari route API.
// ============================================================
import {
  BAGIAN_PENYERAHAN,
  batasBagianMb,
  isAbsensiPerpus,
  isPenyerahanPerpus,
  periksaBerkasBagian,
  type BagianPenyerahan,
} from "@/lib/bukti-penyerahan";

/** Batas berkas tunggal, dalam MB. Sama dengan MAX_DOCUMENT_BYTES di server. */
export const MAKS_TUNGGAL_MB = 10;

const ACCEPT_PDF = ".pdf,application/pdf";
const ACCEPT_DOCX =
  ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ACCEPT_DUA = `${ACCEPT_PDF},${ACCEPT_DOCX}`;

export type BentukUnggah =
  /** Beberapa berkas bernama sekaligus, mis. empat bagian skripsi. */
  | { jenis: "bagian"; bagian: BagianPenyerahan[]; jumlah: number }
  /** Satu berkas. */
  | {
      jenis: "tunggal";
      /** Nama kolom pada FormData. */
      nama: string;
      label: string;
      wajib: boolean;
      accept: string;
      /** Akhiran yang diterima, huruf kecil, termasuk titiknya. */
      ekstensi: string[];
      maksMb: number;
      catatan: string;
    }
  /** Layanan yang memang tidak memuat berkas apa pun. */
  | { jenis: "tanpa"; alasan: string };

/**
 * Apa yang harus diunggah untuk layanan ini?
 *
 * `untukRevisi` mengubah satu hal saja: lampiran yang OPSIONAL saat mengajukan
 * menjadi WAJIB saat merevisi. Revisi tanpa berkas baru tidak mengubah apa pun
 * yang dapat diperiksa admin, jadi membiarkannya kosong hanya memindahkan
 * kebingungan ke meja orang lain.
 */
export function bentukUnggah(
  serviceType: string,
  serviceNeed: string,
  untukRevisi = false,
): BentukUnggah {
  if (isAbsensiPerpus(serviceType, serviceNeed)) {
    return { jenis: "tanpa", alasan: "Absensi perpustakaan tidak memuat berkas." };
  }

  if (isPenyerahanPerpus(serviceType, serviceNeed)) {
    return { jenis: "bagian", bagian: BAGIAN_PENYERAHAN, jumlah: BAGIAN_PENYERAHAN.length };
  }

  if (serviceType === "Layanan Tugas Akhir" || serviceType === "Layanan Skripsi / Jurnal") {
    return {
      jenis: "tunggal",
      nama: "file",
      label: untukRevisi ? "Upload File Revisi .DOCX" : "Lampiran",
      wajib: true,
      accept: ACCEPT_DOCX,
      ekstensi: [".docx"],
      maksMb: MAKS_TUNGGAL_MB,
      catatan: `File wajib .DOCX, maksimal ${MAKS_TUNGGAL_MB} MB.`,
    };
  }

  if (serviceType === "Layanan PDDIKTI") {
    return {
      jenis: "tunggal",
      nama: "file",
      label: untukRevisi ? "Upload File Revisi PDF" : "Lampiran",
      wajib: true,
      accept: ACCEPT_PDF,
      ekstensi: [".pdf"],
      maksMb: MAKS_TUNGGAL_MB,
      catatan: `File wajib PDF, maksimal ${MAKS_TUNGGAL_MB} MB.`,
    };
  }

  return {
    jenis: "tunggal",
    nama: "file",
    label: untukRevisi ? "Upload Berkas Revisi" : "Lampiran",
    wajib: untukRevisi,
    accept: ACCEPT_DUA,
    ekstensi: [".pdf", ".docx"],
    maksMb: MAKS_TUNGGAL_MB,
    catatan: untukRevisi
      ? `Berkas revisi PDF atau DOCX, maksimal ${MAKS_TUNGGAL_MB} MB.`
      : `Lampiran PDF atau DOCX opsional, maksimal ${MAKS_TUNGGAL_MB} MB.`,
  };
}

/** Berapa berkas yang diminta bentuk ini. Dipakai untuk kalimat "4 berkas". */
export function jumlahBerkas(bentuk: BentukUnggah) {
  if (bentuk.jenis === "bagian") return bentuk.jumlah;
  if (bentuk.jenis === "tunggal") return 1;
  return 0;
}

/**
 * Periksa satu berkas terhadap bentuk tunggal.
 *
 * Dipakai peramban supaya mahasiswa tahu masalahnya sebelum menunggu
 * unggahan selesai, dan dipakai lagi di server karena pemeriksaan di peramban
 * selalu dapat dilewati. Aturannya satu, jadi keduanya tidak mungkin
 * berselisih.
 */
export function periksaBerkasTunggal(
  bentuk: Extract<BentukUnggah, { jenis: "tunggal" }>,
  berkas: { name: string; size: number } | null,
): { ok: true } | { ok: false; pesan: string } {
  if (!berkas || !berkas.name) {
    if (bentuk.wajib) return { ok: false, pesan: `${bentuk.label} belum dipilih.` };
    return { ok: true };
  }
  const nama = berkas.name.toLowerCase();
  if (!bentuk.ekstensi.some((e) => nama.endsWith(e))) {
    const daftar = bentuk.ekstensi.map((e) => e.toUpperCase().replace(".", "")).join(" atau ");
    return { ok: false, pesan: `Berkas harus ${daftar}.` };
  }
  if (berkas.size > bentuk.maksMb * 1024 * 1024) {
    const mb = (berkas.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      pesan: `Berkas berukuran ${mb} MB, melebihi batas ${bentuk.maksMb} MB.`,
    };
  }
  return { ok: true };
}

/**
 * Periksa seluruh berkas sekaligus, apa pun bentuknya.
 *
 * `ambil` menyerahkan cara mengambil berkasnya kepada pemanggil: server
 * membacanya dari FormData, peramban dari state-nya sendiri. Yang dijaga di
 * sini hanya aturannya.
 */
export function periksaSemuaBerkas(
  bentuk: BentukUnggah,
  ambil: (nama: string) => { name: string; size: number } | null,
): { ok: true } | { ok: false; pesan: string } {
  if (bentuk.jenis === "tanpa") return { ok: true };
  if (bentuk.jenis === "tunggal") return periksaBerkasTunggal(bentuk, ambil(bentuk.nama));
  for (const bagian of bentuk.bagian) {
    const cek = periksaBerkasBagian(bagian.id, ambil(`bagian_${bagian.id}`));
    if (!cek.ok) return cek;
  }
  return { ok: true };
}

export { batasBagianMb };
