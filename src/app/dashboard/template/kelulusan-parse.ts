// ============================================================
// PEMBACA DATA YUDISIUM FAKULTAS → BARIS TEMPLATE PDDIKTI
//
// Template "Input Kelulusan & Dropout" milik PDDIKTI punya sepuluh kolom
// tetap dengan urutan yang tidak boleh digeser. Excel yudisium yang keluar
// dari fakultas bentuknya lain sama sekali: ada kop lampiran SK, ada judul
// prodi, baris judul kolomnya baru muncul di baris kesembilan, dan tanggal
// yudisiumnya ditulis manusia ("7 JUNI 2026") — bukan tanggal Excel.
//
// Berkas ini yang menjembatani keduanya. Dipisah dari komponennya supaya
// dapat diuji tanpa peramban (lihat uji-kelulusan-pddikti.ts).
// ============================================================

import type { Aoa } from "./transkrip-parse";

/* ---------- bentuk kolom template PDDIKTI ---------- */

export type KolomTemplate = {
  judul: string;
  /** true = latar merah pada template asli: PDDIKTI menolak baris tanpa isi ini. */
  wajib: boolean;
  /** Catatan (comment) yang menempel pada sel judul di template asli. */
  catatan: string;
  /** Lebar kolom, disalin dari template asli agar tampilannya sama. */
  lebar: number;
};

/**
 * Sepuluh kolom template kelulusan PDDIKTI, urut A–J.
 *
 * Judul, catatan, warna, dan lebarnya disalin apa adanya dari berkas
 * "template_kelulusan.xlsx" milik PDDIKTI — termasuk salah ketik pada
 * catatannya ("wajib disi", "Peride keluar"). Yang disalin harus sama persis;
 * begitu judulnya diperbaiki, berkasnya tidak lagi cocok dengan yang
 * diharapkan pengimpor di seberang.
 */
export const KOLOM_KELULUSAN: KolomTemplate[] = [
  { judul: "NIM", wajib: true, lebar: 19, catatan: "NIM / NIPD Mahasiswa\n\ninfo : wajib disi" },
  { judul: "Nama", wajib: false, lebar: 30, catatan: "Nama Mahasiswa\nInfo : Boleh kosong" },
  {
    judul: "Jenis Keluar", wajib: true, lebar: 15,
    catatan:
      "Jenis keluar\n0 : Selesai Pendidikan Non Gelar\n1 : Lulus\n2 : Mutasi\n3 : Dikeluarkan\n" +
      "4 : Mengajukan pengunduran diri\n5 : Putus Studi\n6 : Meninggal dunia\n\nInfo : Wajib Diisi",
  },
  { judul: "Tanggal keluar / Tanggal lulus", wajib: true, lebar: 27, catatan: "format tahun-bulan-tanggal\nInfo : Wajib Diisi" },
  {
    judul: "Semester Keluar", wajib: true, lebar: 17,
    catatan: "Peride keluar\ntahun+semester\n1 : ganjil, 2 genap, \n20221 berarti keluar 2022 ganjil\nInfo : Wajib Diisi",
  },
  { judul: "Nomor SK", wajib: false, lebar: 25, catatan: "" },
  { judul: "Tanggal SK", wajib: false, lebar: 20, catatan: "" },
  { judul: "IP Kumulatif", wajib: true, lebar: 19, catatan: "\nInfo : Wajib Diisi" },
  { judul: "Keterangan", wajib: false, lebar: 21, catatan: "" },
  { judul: "Kode Prodi", wajib: true, lebar: 14, catatan: "\nInfo : Wajib Diisi" },
];

export const NAMA_LEMBAR_PDDIKTI = "Template kelulusan";

/** Pilihan kolom "Jenis Keluar", disalin dari catatan template PDDIKTI. */
export const JENIS_KELUAR: Array<{ kode: string; label: string }> = [
  { kode: "0", label: "Selesai Pendidikan Non Gelar" },
  { kode: "1", label: "Lulus" },
  { kode: "2", label: "Mutasi" },
  { kode: "3", label: "Dikeluarkan" },
  { kode: "4", label: "Mengajukan pengunduran diri" },
  { kode: "5", label: "Putus Studi" },
  { kode: "6", label: "Meninggal dunia" },
];

/** Prodi FISIP beserta kode PDDIKTI-nya dan kata kunci pengenal pada lembar. */
export const PRODI_PDDIKTI: Array<{ kode: string; nama: string; kunci: RegExp }> = [
  { kode: "70201", nama: "Ilmu Komunikasi", kunci: /ilkom|komunikasi/i },
  { kode: "65201", nama: "Ilmu Pemerintahan", kunci: /ilpem|pemerintahan/i },
];

/* ---------- tanggal ---------- */

const BULAN: Record<string, number> = {
  januari: 1, jan: 1,
  februari: 2, pebruari: 2, feb: 2, peb: 2,
  maret: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  agustus: 8, agu: 8, ags: 8, agt: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, oct: 10,
  november: 11, nopember: 11, nov: 11, nop: 11,
  desember: 12, des: 12, dec: 12,
  january: 1, february: 2, march: 3, june: 6, july: 7, august: 8, october: 10, december: 12,
};

const dua = (n: number) => String(n).padStart(2, "0");

/** Apakah tahun-bulan-tanggal ini benar-benar ada di kalender? */
function tanggalNyata(tahun: number, bulan: number, hari: number) {
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return false;
  const d = new Date(Date.UTC(tahun, bulan - 1, hari));
  return d.getUTCFullYear() === tahun && d.getUTCMonth() === bulan - 1 && d.getUTCDate() === hari;
}

/**
 * Ubah tanggal apa pun dari lembar fakultas menjadi "tahun-bulan-tanggal".
 *
 * Inilah kolom yang paling sering salah ketika disalin tangan: tanggal
 * yudisium DI SATU BERKAS PUN berbeda-beda per mahasiswa (7 Juni, 18 Juni,
 * 24 Juli…), sehingga menyalin satu tanggal ke seluruh baris menghasilkan
 * ratusan data lulus yang tanggalnya keliru. Yang diterima:
 *
 *   "7 JUNI 2026" · "01 Nopember 1998" · "2026-06-07" · "7/6/2026" ·
 *   "2026/06/07" · objek Date · nomor seri Excel (45810)
 *
 * Mengembalikan null bila tidak terbaca — pemanggilnya menandai baris itu
 * sebagai perlu diperbaiki, BUKAN menebak tanggalnya sendiri.
 */
export function tanggalPddikti(nilai: unknown): string | null {
  if (nilai === null || nilai === undefined) return null;

  if (nilai instanceof Date && !Number.isNaN(nilai.getTime())) {
    return `${nilai.getFullYear()}-${dua(nilai.getMonth() + 1)}-${dua(nilai.getDate())}`;
  }

  // Nomor seri Excel. Dibatasi 1970–2100 supaya angka lain (mis. NIM yang
  // nyasar ke kolom tanggal) tidak diam-diam berubah menjadi tanggal.
  if (typeof nilai === "number" && Number.isFinite(nilai)) {
    return seriExcel(nilai);
  }

  const teks = String(nilai).trim().replace(/\s+/g, " ");
  if (!teks) return null;

  let cocok = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(teks);
  if (cocok) {
    const [tahun, bulan, hari] = [Number(cocok[1]), Number(cocok[2]), Number(cocok[3])];
    return tanggalNyata(tahun, bulan, hari) ? `${tahun}-${dua(bulan)}-${dua(hari)}` : null;
  }

  // "7 JUNI 2026" — bentuk yang dipakai lembar yudisium fakultas.
  cocok = /^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/.exec(teks);
  if (cocok) {
    const bulan = BULAN[cocok[2].toLowerCase()];
    const [hari, tahun] = [Number(cocok[1]), Number(cocok[3])];
    if (!bulan || !tanggalNyata(tahun, bulan, hari)) return null;
    return `${tahun}-${dua(bulan)}-${dua(hari)}`;
  }

  // "7/6/2026" dan "7-6-2026" — hari dulu, bulan kemudian (kebiasaan di sini).
  cocok = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(teks);
  if (cocok) {
    const [hari, bulan, tahun] = [Number(cocok[1]), Number(cocok[2]), Number(cocok[3])];
    return tanggalNyata(tahun, bulan, hari) ? `${tahun}-${dua(bulan)}-${dua(hari)}` : null;
  }

  // Angka polos yang datang sebagai teks: tetap nomor seri Excel.
  if (/^\d{4,5}(\.\d+)?$/.test(teks)) return seriExcel(Number(teks));

  return null;
}

/** Nomor seri Excel (hari sejak 30 Desember 1899) menjadi tanggal ISO. */
function seriExcel(seri: number): string | null {
  if (seri < 25569 || seri > 73415) return null; // di luar 1970–2100
  const ms = Math.round(seri - 25569) * 86400000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${dua(d.getUTCMonth() + 1)}-${dua(d.getUTCDate())}`;
}

/**
 * Kode "Semester Keluar" dari tanggal lulus — versi TAHUN AJARAN, yang
 * dipakai PDDIKTI FISIP.
 *
 * Tahunnya adalah tahun AWAL tahun ajarannya, bukan tahun pada tanggalnya.
 * Yudisium Juni 2026 jatuh pada semester genap tahun ajaran 2025/2026, jadi
 * kodenya "20252" — bukan "20262". Perbedaan satu angka ini menentukan pada
 * periode mana seluruh angkatan tercatat keluar.
 *
 *   Agustus–Desember tahun Y  → ganjil TA Y/(Y+1)      → `${Y}1`
 *   Januari tahun Y           → ekor ganjil TA (Y-1)/Y → `${Y-1}1`
 *   Februari–Juli tahun Y     → genap TA (Y-1)/Y       → `${Y-1}2`
 *
 * Sebagian operator memakai kode TAHUN KALENDER (Juni 2026 = "20262"); nilai
 * itu tersedia lewat semesterTahunKalender() dan dapat dipasang di layar,
 * bukan diputuskan diam-diam di sini.
 */
export function semesterKeluar(iso: string): string {
  const musim = musimKuliah(iso);
  if (!musim) return "";
  return musim.genap ? `${musim.tahun - 1}2` : `${musim.tahunGanjil}1`;
}

/** Kode semester versi tahun kalender: yudisium Juni 2026 → "20262". */
export function semesterTahunKalender(iso: string): string {
  const musim = musimKuliah(iso);
  if (!musim) return "";
  return musim.genap ? `${musim.tahun}2` : `${musim.tahunGanjil}1`;
}

/**
 * Musim perkuliahan pada satu tanggal.
 *
 * Genap berjalan Februari–Juli, ganjil Agustus–Januari. Januari adalah ekor
 * semester ganjil yang dimulai Agustus tahun sebelumnya — karena itu
 * `tahunGanjil`-nya mundur satu, dan kedua kode di atas sama-sama memakainya.
 */
function musimKuliah(iso: string): { tahun: number; genap: boolean; tahunGanjil: number } | null {
  const cocok = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso);
  if (!cocok) return null;
  const tahun = Number(cocok[1]);
  const bulan = Number(cocok[2]);
  const genap = bulan >= 2 && bulan <= 7;
  return { tahun, genap, tahunGanjil: bulan === 1 ? tahun - 1 : tahun };
}

/* ---------- membaca lembar yudisium ---------- */

export type BarisKelulusan = {
  /** Penanda tetap untuk React; tidak ikut ke berkas hasil. */
  id: string;
  lembar: string;
  barisAsli: number;
  nim: string;
  nama: string;
  jenisKeluar: string;
  tanggalKeluar: string;
  semester: string;
  nomorSk: string;
  tanggalSk: string;
  ipk: string;
  keterangan: string;
  kodeProdi: string;
  /** Tanggal yudisium apa adanya dari lembar fakultas, untuk ditampilkan bila gagal dibaca. */
  tanggalAsli: string;
  /** Predikat kelulusan dari lembar fakultas. Tidak ikut ke berkas kecuali diminta. */
  predikat: string;
  /**
   * Kode prodinya berasal dari berkas fakultas (kolom KODE PRODI atau judul
   * lembarnya), bukan dari pilihan cadangan di layar. Yang datang dari berkas
   * tidak boleh tertimpa ketika admin mengganti pilihan cadangannya.
   */
  prodiDariBerkas: boolean;
};

export type HasilBaca = {
  baris: BarisKelulusan[];
  /** Judul kolom yang ketemu, untuk ditampilkan sebagai bukti pembacaan. */
  kolom: Record<string, string>;
  /** Baris yang dilewati beserta alasannya (kop, tanda tangan, baris kosong). */
  dilewati: number;
};

const teks = (nilai: unknown) => String(nilai ?? "").trim();

/** Cari baris judul kolom: baris yang memuat "nim" dan "nama". */
function cariKepala(aoa: Aoa): number {
  for (let i = 0; i < Math.min(aoa.length, 40); i += 1) {
    const baris = (aoa[i] || []).map((sel) => teks(sel).toLowerCase());
    const adaNim = baris.some((sel) => /^nim\b|^n\.?i\.?m\.?$|nomor induk/.test(sel));
    const adaNama = baris.some((sel) => /^nama/.test(sel));
    if (adaNim && adaNama) return i;
  }
  return -1;
}

/**
 * Ambil nomor SK dari kop lembar, mis.
 * "Lampiran SK No. 003/KEP/III.3.AU/F/FISIP/2026" → "003/KEP/III.3.AU/F/FISIP/2026".
 *
 * Nomor SK kolom hijau — boleh kosong. Diambil di sini hanya supaya admin
 * tidak perlu mengetik ulang yang sudah tertulis di berkasnya sendiri; ia
 * tetap dapat menghapus atau menggantinya di layar.
 */
export function nomorSkDariLembar(aoa: Aoa): string {
  for (let i = 0; i < Math.min(aoa.length, 12); i += 1) {
    for (const sel of aoa[i] || []) {
      const isi = teks(sel);
      const cocok = /(?:sk|surat\s+keputusan)\s*(?:no\.?|nomor)?\s*:?\s*([0-9][^\s].*)$/i.exec(isi);
      if (cocok) return cocok[1].trim();
    }
  }
  return "";
}

/** Tebak kode prodi dari judul lembar ("PROGRAM STUDI ILMU KOMUNIKASI") atau namanya. */
export function prodiDariLembar(aoa: Aoa, namaLembar: string): string {
  const kepala = aoa
    .slice(0, 10)
    .map((baris) => (baris || []).map((sel) => teks(sel)).join(" "))
    .join(" ");
  for (const prodi of PRODI_PDDIKTI) {
    if (prodi.kunci.test(namaLembar) || prodi.kunci.test(kepala)) return prodi.kode;
  }
  return "";
}

/** IPK apa adanya → dua angka di belakang koma, bertitik: 3.8 → "3.80". */
export function rapikanIpk(nilai: unknown): string {
  const mentah = teks(nilai).replace(",", ".");
  if (!mentah) return "";
  const angka = Number(mentah);
  if (!Number.isFinite(angka) || angka <= 0 || angka > 4) return "";
  return angka.toFixed(2);
}

export type OpsiBaca = {
  /** Kode "Jenis Keluar" untuk semua baris; "1" (Lulus) untuk lembar yudisium. */
  jenisKeluar: string;
  /** Dipakai bila lembar fakultas tidak punya kolom Kode Prodi. */
  kodeProdiCadangan: string;
};

/**
 * Baca satu lembar yudisium fakultas menjadi baris-baris template PDDIKTI.
 *
 * Kolom dicari lewat judulnya, bukan lewat huruf kolomnya, supaya lembar
 * yang kolomnya bergeser tahun depan tetap terbaca.
 */
export function bacaLembarYudisium(aoa: Aoa, namaLembar: string, opsi: OpsiBaca): HasilBaca {
  const kepala = cariKepala(aoa);
  if (kepala < 0) {
    throw new Error(
      `Lembar "${namaLembar}" tidak punya baris judul kolom. Baris yang memuat NIM dan NAMA MAHASISWA wajib ada.`,
    );
  }

  const judul = (aoa[kepala] || []).map((sel) => teks(sel));
  const kecil = judul.map((sel) => sel.toLowerCase());
  const cari = (re: RegExp) => kecil.findIndex((sel) => re.test(sel));

  const cNim = cari(/^nim\b|^n\.?i\.?m\.?$|nomor induk/);
  const cNama = cari(/^nama/);
  const cTanggal = cari(/yudisium|tgl\s*lulus|tanggal\s*lulus|tanggal\s*keluar/);
  const cIpk = cari(/^ipk$|ip\s*kumulatif|indeks\s*prestasi/);
  const cProdi = cari(/kode\s*prodi|kode\s*ps\b/);
  const cKet = cari(/predikat/);

  const kurang: string[] = [];
  if (cNim < 0) kurang.push("NIM");
  if (cTanggal < 0) kurang.push("TGL YUDISIUM");
  if (cIpk < 0) kurang.push("IPK");
  if (kurang.length) {
    throw new Error(`Lembar "${namaLembar}" belum punya kolom ${kurang.join(", ")}.`);
  }

  // Bila lembarnya tidak punya kolom Kode Prodi, prodinya ditebak dari judul
  // lembar ("PROGRAM STUDI ILMU KOMUNIKASI") — itu masih hitungan "dari
  // berkas". Pilihan cadangan di layar dipakai terakhir.
  const prodiJudul = prodiDariLembar(aoa, namaLembar);

  const baris: BarisKelulusan[] = [];
  let dilewati = 0;

  for (let i = kepala + 1; i < aoa.length; i += 1) {
    const isi = aoa[i] || [];
    const nim = teks(isi[cNim]);
    const nama = cNama >= 0 ? teks(isi[cNama]) : "";

    // Baris kosong, blok tanda tangan, dan baris "JUMLAH" di kaki tabel tidak
    // punya NIM berupa angka. Dilewati diam-diam, tetapi tetap dihitung.
    if (!/^\d{5,}$/.test(nim)) {
      if (nim || nama) dilewati += 1;
      continue;
    }

    const tanggalAsli = teks(isi[cTanggal]);
    const tanggalKeluar = tanggalPddikti(isi[cTanggal]) || "";
    const prodiBerkas = (cProdi >= 0 ? teks(isi[cProdi]) : "") || prodiJudul;

    baris.push({
      id: `${namaLembar}#${i}`,
      lembar: namaLembar,
      barisAsli: i + 1,
      nim,
      nama,
      jenisKeluar: opsi.jenisKeluar,
      tanggalKeluar,
      semester: tanggalKeluar ? semesterKeluar(tanggalKeluar) : "",
      nomorSk: "",
      tanggalSk: "",
      ipk: rapikanIpk(isi[cIpk]),
      keterangan: "",
      kodeProdi: prodiBerkas || opsi.kodeProdiCadangan,
      tanggalAsli,
      predikat: cKet >= 0 ? teks(isi[cKet]) : "",
      prodiDariBerkas: Boolean(prodiBerkas),
    });
  }

  return {
    baris,
    kolom: {
      NIM: judul[cNim] || "",
      Nama: cNama >= 0 ? judul[cNama] : "(tidak ada)",
      "Tanggal lulus": judul[cTanggal] || "",
      IPK: judul[cIpk] || "",
      "Kode Prodi": cProdi >= 0 ? judul[cProdi] : `(dari judul lembar: ${prodiJudul || "kosong"})`,
    },
    dilewati,
  };
}

/* ---------- pemeriksaan sebelum diunduh ---------- */

export type Masalah = { id: string; nim: string; nama: string; sebab: string };

/**
 * Periksa baris terhadap kolom merah template PDDIKTI.
 *
 * Kolom hijau (Nama, Nomor SK, Tanggal SK, Keterangan) tidak pernah membuat
 * baris gagal — memang boleh kosong.
 */
export function periksaBaris(baris: BarisKelulusan[]): Masalah[] {
  const masalah: Masalah[] = [];
  const nimTerlihat = new Map<string, number>();

  baris.forEach((row, urut) => {
    const sebab: string[] = [];
    if (!row.nim) sebab.push("NIM kosong");
    if (!/^[0-6]$/.test(row.jenisKeluar)) sebab.push("Jenis Keluar harus 0–6");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.tanggalKeluar)) {
      sebab.push(row.tanggalAsli ? `tanggal "${row.tanggalAsli}" tidak terbaca` : "Tanggal keluar kosong");
    }
    if (!/^\d{5}$/.test(row.semester)) sebab.push("Semester Keluar harus 5 angka, mis. 20262");
    if (!row.ipk || !Number.isFinite(Number(row.ipk))) sebab.push("IP Kumulatif kosong / bukan angka");
    if (!/^\d{5}$/.test(row.kodeProdi)) sebab.push("Kode Prodi harus 5 angka, mis. 70201");
    if (row.tanggalSk && !/^\d{4}-\d{2}-\d{2}$/.test(row.tanggalSk)) sebab.push("Tanggal SK bukan tahun-bulan-tanggal");

    const sebelumnya = nimTerlihat.get(row.nim);
    if (row.nim && sebelumnya !== undefined) sebab.push(`NIM kembar dengan baris ke-${sebelumnya + 1}`);
    else if (row.nim) nimTerlihat.set(row.nim, urut);

    if (sebab.length) masalah.push({ id: row.id, nim: row.nim, nama: row.nama, sebab: sebab.join("; ") });
  });

  return masalah;
}

/** Baris siap unggah → larik sepuluh kolom, urut sama dengan KOLOM_KELULUSAN. */
export function barisKeAoa(baris: BarisKelulusan[]): string[][] {
  return baris.map((row) => [
    row.nim,
    row.nama,
    row.jenisKeluar,
    row.tanggalKeluar,
    row.semester,
    row.nomorSk,
    row.tanggalSk,
    row.ipk,
    row.keterangan,
    row.kodeProdi,
  ]);
}
