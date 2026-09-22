// ============================================================
// KURIKULUM: ACUAN FAKULTAS → TEMPLATE MATAKULIAH PDDIKTI
//
// Dua berkas yang bentuknya sama sekali berbeda, dan seluruh pekerjaan berkas
// ini adalah menjembatani keduanya.
//
// ------------------------------------------------------------
// YANG DIKIRIM FAKULTAS
// ------------------------------------------------------------
// Satu lembar yang dibaca MANUSIA, bukan mesin: tiga konsentrasi berdiri
// BERDAMPINGAN sebagai tiga kelompok kolom, dan delapan semester bertumpuk ke
// bawah sebagai delapan pita.
//
//        A          B     C                    D        G ..        M ..
//   3    ADV                                            BROADCASTING PUBLIC RELATIONS
//   4    KD MATKUL  BK    SEMESTER 1           SKS      KD MATKUL …  KD MATKUL …
//   5    MKU-0201   17    AIKA 1               2        …            …
//   …
//  15    KD MATKUL  BK    SEMESTER 2           SKS      …            …
//
// Perhatikan bahwa nama mata kuliahnya berada di kolom yang JUDULNYA adalah
// "SEMESTER 1". Judul itu memikul dua pekerjaan sekaligus — menamai kolomnya
// dan menyebut semesternya — dan itulah kunci pembacaan seluruh lembar.
//
// ------------------------------------------------------------
// YANG DIMINTA PDDIKTI
// ------------------------------------------------------------
// Satu tabel datar enam belas kolom, satu baris per mata kuliah.
//
// ------------------------------------------------------------
// EMPAT YANG DIPETAKAN, SISANYA DISETEL SEKALI
// ------------------------------------------------------------
//   Kode MK        ← KD MATKUL
//   Nama MK        ← kolom di bawah judul "SEMESTER n"
//   SKS Tatap Muka ← SKS
//   Semester       ← angka pada judul "SEMESTER n"
//
// Sisanya tidak ada di berkas fakultas dan memang tidak bisa ditebak: tahun
// kurikulum, kode prodi, jenis mata kuliah. Ketiganya disetel sekali di layar
// dan berlaku untuk seluruh baris.
//
// Seluruh isi berkas ini MURNI: tidak ada basis data, jaringan, berkas, atau
// jam. Itu yang membuatnya dapat diuji, dan ia diuji di uji-kurikulum.ts.
// ============================================================

import type { KolomKelulusan } from "@/lib/kelulusan-xlsx";

/** Satu sel apa adanya dari pembaca Excel. */
export type Sel = string | number | boolean | null | undefined;
export type Aoa = Sel[][];

export const NAMA_LEMBAR_MATKUL = "Matkul";

/**
 * Enam belas kolom template matakuliah PDDIKTI, urut A–P.
 *
 * Judul, catatan, warna, dan lebarnya disalin apa adanya dari
 * "template_baru_matakuliah.xlsx" milik PDDIKTI — termasuk salah ketiknya
 * ("wajib disi", "Prak Lapaangan", "MKK <perlu diisi>)"). Yang disalin harus
 * sama persis; begitu judulnya diperbaiki, berkasnya tidak lagi cocok dengan
 * yang diharapkan pengimpor di seberang.
 */
export const KOLOM_MATKUL: KolomKelulusan[] = [
  { judul: "Kode MK", wajib: true, lebar: 15, catatan: "Kode Mata Kuliah\n\ninfo : wajib disi" },
  { judul: "Nama MK", wajib: true, lebar: 20, catatan: "Nama Mata Kuliah\ninfo : wajib disi" },
  {
    judul: "Jenis MK", wajib: true, lebar: 10,
    catatan:
      "Jenis Mata Kuliah. Isi sesuai id dibawah\nA : Wajib\nB : Pilihan\nC : Wajib Peminatan\n" +
      "D : Pilihan Peminatan\nS : Tugas akhir/ Skripsi/ Thesis/ Disertasi\n\nInfo : Wajib Diisi\n",
  },
  { judul: "SKS Tatap Muka", wajib: true, lebar: 15, catatan: "sks_tm : Jumlah Sks Tatap Muka\nIsi 0 : jika tidak ada\ninfo : wajib disi" },
  { judul: "SKS Praktek", wajib: true, lebar: 15, catatan: "Jumlah Sks Praktek.\nIsi 0 : jika tidak ada\ninfo : wajib disi" },
  { judul: "SKS Praktek Lapangan", wajib: true, lebar: 18, catatan: "Jumlah SKS Prak Lapaangan.\nIsi 0 : jika tidak ada\ninfo : wajib disi" },
  { judul: "SKS Simulasi", wajib: true, lebar: 13, catatan: "Jumlah SKS Simulasi.\nIsi 0 : jika tidak ada\ninfo : wajib disi" },
  { judul: "Metode Pembelajaran", wajib: false, lebar: 25, catatan: "Metode Pembelajaran\ninfo : Boleh kosong jika belum ada" },
  {
    judul: "Tgl Mulai Efektif", wajib: false, lebar: 15,
    catatan: "ket : tanggal Mulai efektif matakuliah\nformat : tahun-bulan-tgl\ncontoh : 2017-07-01\ninfo : Boleh kosong jika belum ada",
  },
  {
    judul: "Tgl Akhir Efektif", wajib: false, lebar: 15,
    catatan: "ket : tanggal Akhir efektif matakuliah\nformat : tahun-bulan-tgl\ncontoh : 2017-07-01\ninfo : Boleh kosong jika belum ada",
  },
  { judul: "Semester", wajib: true, lebar: 10, catatan: "Semester Matakuliah 1 sampai 8\ninfo : Wajib diisi" },
  { judul: "Tahun Kurikulum", wajib: true, lebar: 20, catatan: "Mulai Berlaku Kurikulum\nformat : tahunsemester\ncontoh : 20201" },
  { judul: "Wajib", wajib: true, lebar: 11, catatan: "Apakah Matkul Wajib\n1 : YA\n0 : TIDAK" },
  { judul: "Kode Prodi", wajib: true, lebar: 13, catatan: "Kode Prodi/Jurusan, \nLihat di menu master data -> jurusan\nWajib diisi" },
  {
    judul: "Kelompok Matakuliah", wajib: false, lebar: 20,
    catatan:
      "Kelompok Matakuliah. Isi sesuai id dibawah\nA : MPK (Matakuliah Pengembangan Kepribadian)\n" +
      "B : MKK (Matakuliah Keilmuan dan Keterampilan)\nC : MKB (Matakuliah Keahlian Berkarya)\n" +
      "D : MPB (Matakuliah Perilaku Berkarya)\nE : MBB (Matakuliah Berkehidupan Bermasyarakat)\n" +
      "F : MBB (Matakuliah Berkehidupan Bermasyarakat)\nG : MKDK (Matakuliah Dasar Keahlian)\n" +
      "H : MKK <perlu diisi>)\n\nInfo : Wajib Diisi\n",
  },
  {
    judul: "Id Matkul", wajib: false, lebar: 15,
    catatan: "Hanya untuk update Matakuliah, Bisa didapat dari download matkul di menu tool -> download data\nInfo : Boleh Kosong",
  },
];

/** Pilihan kolom "Jenis MK", disalin dari catatan template PDDIKTI. */
export const JENIS_MK: Array<{ kode: string; label: string }> = [
  { kode: "A", label: "A — Wajib" },
  { kode: "B", label: "B — Pilihan" },
  { kode: "C", label: "C — Wajib Peminatan" },
  { kode: "D", label: "D — Pilihan Peminatan" },
  { kode: "S", label: "S — Tugas akhir / Skripsi" },
];

/** Pilihan kolom "Kelompok Matakuliah", disalin dari catatan template PDDIKTI. */
export const KELOMPOK_MK: Array<{ kode: string; label: string }> = [
  { kode: "", label: "— kosongkan —" },
  { kode: "A", label: "A — MPK" },
  { kode: "B", label: "B — MKK" },
  { kode: "C", label: "C — MKB" },
  { kode: "D", label: "D — MPB" },
  { kode: "E", label: "E — MBB" },
  { kode: "F", label: "F — MBB" },
  { kode: "G", label: "G — MKDK" },
  { kode: "H", label: "H — MKK" },
];

/** Kode prodi PDDIKTI yang dipakai fakultas ini. Sama dengan daftar kelulusan. */
export const PRODI_MATKUL: Array<{ kode: string; nama: string }> = [
  { kode: "70201", nama: "Ilmu Komunikasi" },
  { kode: "65201", nama: "Ilmu Pemerintahan" },
];

export const SEMESTER_MAKS = 8;

// ------------------------------------------------------------
// PEMBACAAN LEMBAR ACUAN
// ------------------------------------------------------------

function teks(sel: Sel): string {
  if (sel === null || sel === undefined) return "";
  if (typeof sel === "number") {
    // Angka besar dari Excel dapat terbaca 2.02312e+9. toFixed(0) memulihkan
    // angkanya utuh; String() tidak.
    return Number.isInteger(sel) ? sel.toFixed(0) : String(sel);
  }
  return String(sel).trim();
}

const rapat = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Baris ini judul pita semester? Ditandai sel "KD MATKUL". */
function kolomJudul(baris: Sel[]): number[] {
  const hasil: number[] = [];
  baris.forEach((sel, i) => {
    const t = rapat(teks(sel));
    if (t === "kd matkul" || t === "kode matkul" || t === "kode mk") hasil.push(i);
  });
  return hasil;
}

/**
 * Angka semester dari judul kolom namanya, mis. "SEMESTER 3" → 3.
 *
 * Mengembalikan 0 bila tidak ada angkanya. Nol tidak pernah menjadi semester
 * yang sah, jadi pemanggilnya dapat memakainya sebagai tanda "tidak terbaca"
 * tanpa perlu jenis nilai yang lain.
 */
export function semesterDariJudul(judul: string): number {
  const cocok = /(\d+)/.exec(String(judul ?? ""));
  if (!cocok) return 0;
  const n = Number(cocok[1]);
  return Number.isInteger(n) && n >= 1 && n <= SEMESTER_MAKS ? n : 0;
}

/** SKS: hanya angka 0–24 yang masuk akal untuk satu mata kuliah. */
export function rapikanSks(sel: Sel): number | null {
  const t = teks(sel).replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 24) return null;
  return Math.round(n);
}

/** Kode mata kuliah: dirapikan spasinya, tanpa mengubah hurufnya. */
export function rapikanKodeMk(sel: Sel): string {
  return teks(sel).replace(/\s+/g, " ").trim().slice(0, 40);
}

export function rapikanNamaMk(sel: Sel): string {
  return teks(sel).replace(/\s+/g, " ").trim().slice(0, 160);
}

export type BarisMatkul = {
  /** Penanda tetap, dipakai daftar dan penandaan masalah di layar. */
  id: string;
  kode: string;
  nama: string;
  sks: number | null;
  semester: number;
  /** Nama konsentrasi tempat baris ini ditemukan, untuk ditunjukkan. */
  konsentrasi: string;
  /** Kolom BK pada lembar fakultas. Tidak dikirim ke PDDIKTI. */
  bk: string;
  /** Baris asalnya di lembar acuan, 1-berbasis — untuk menunjuk saat salah. */
  barisAsal: number;
};

export type HasilBacaKurikulum = {
  baris: BarisMatkul[];
  konsentrasi: string[];
  /** Semester yang benar-benar ditemukan pitanya. */
  semesterAda: number[];
  /** Baris yang dilewati beserta alasannya — untuk ditunjukkan, bukan didiamkan. */
  tolak: Array<{ baris: string; alasan: string }>;
};

/**
 * Baca seluruh lembar acuan fakultas.
 *
 * Tidak satu pun letak kolom ditanam di sini. Pita semester dicari dari sel
 * "KD MATKUL", dan lebar tiap kelompok kolom disimpulkan dari jarak antar-sel
 * itu — supaya lembar tahun depan yang konsentrasinya bertambah atau
 * kolomnya bergeser tetap terbaca tanpa menyentuh kode ini.
 */
export function bacaKurikulumAcuan(aoa: Aoa): HasilBacaKurikulum {
  const tolak: HasilBacaKurikulum["tolak"] = [];
  const kosong: HasilBacaKurikulum = { baris: [], konsentrasi: [], semesterAda: [], tolak };
  if (!Array.isArray(aoa) || aoa.length === 0) {
    tolak.push({ baris: "-", alasan: "Berkasnya kosong." });
    return kosong;
  }

  // Seluruh baris judul pita, beserta kolom awal tiap konsentrasi di dalamnya.
  const pita: Array<{ baris: number; kolom: number[] }> = [];
  aoa.forEach((baris, i) => {
    const kolom = kolomJudul(baris ?? []);
    if (kolom.length > 0) pita.push({ baris: i, kolom });
  });

  if (pita.length === 0) {
    tolak.push({
      baris: "-",
      alasan: 'Tidak ditemukan satu pun kolom "KD MATKUL". Pastikan berkasnya acuan kurikulum fakultas.',
    });
    return kosong;
  }

  // Nama konsentrasi: sel tidak kosong di kolom yang sama, DI ATAS pita
  // pertama. Di sanalah "ADV", "BROADCASTING", "PUBLIC RELATIONS" berdiri.
  const namaKolom = new Map<number, string>();
  const pitaPertama = pita[0].baris;
  for (const kolom of pita[0].kolom) {
    let nama = "";
    for (let r = pitaPertama - 1; r >= 0 && !nama; r -= 1) {
      const calon = teks((aoa[r] ?? [])[kolom]);
      if (calon) nama = calon;
    }
    namaKolom.set(kolom, nama || `Kolom ${kolom + 1}`);
  }

  const hasil: BarisMatkul[] = [];
  const semesterAda = new Set<number>();

  pita.forEach((p, urut) => {
    const akhir = urut + 1 < pita.length ? pita[urut + 1].baris : aoa.length;
    const barisJudul = aoa[p.baris] ?? [];

    for (const kolom of p.kolom) {
      const semester = semesterDariJudul(teks(barisJudul[kolom + 2]));
      if (semester === 0) {
        tolak.push({
          baris: `Baris ${p.baris + 1}, kolom ${kolom + 1}`,
          alasan: `Judul semesternya tidak terbaca: "${teks(barisJudul[kolom + 2])}".`,
        });
        continue;
      }
      semesterAda.add(semester);
      const konsentrasi = namaKolom.get(kolom) ?? `Kolom ${kolom + 1}`;

      for (let r = p.baris + 1; r < akhir; r += 1) {
        const baris = aoa[r] ?? [];
        const kode = rapikanKodeMk(baris[kolom]);
        const nama = rapikanNamaMk(baris[kolom + 2]);
        // Baris kosong dilewati diam-diam: lembar fakultas memang memuat
        // banyak baris penyela agar ketiga kolomnya sejajar di layar.
        if (!kode && !nama) continue;

        const petunjuk = `Baris ${r + 1} · ${konsentrasi} · semester ${semester}`;
        if (!kode) { tolak.push({ baris: petunjuk, alasan: `"${nama}" tidak punya kode mata kuliah.` }); continue; }
        if (!nama) { tolak.push({ baris: petunjuk, alasan: `Kode ${kode} tidak punya nama mata kuliah.` }); continue; }

        hasil.push({
          id: `${r}-${kolom}`,
          kode,
          nama,
          sks: rapikanSks(baris[kolom + 3]),
          semester,
          konsentrasi,
          bk: teks(baris[kolom + 1]),
          barisAsal: r + 1,
        });
      }
    }
  });

  if (hasil.length === 0 && tolak.length === 0) {
    tolak.push({ baris: "-", alasan: "Tidak ada satu pun mata kuliah di bawah judul kolomnya." });
  }

  return {
    baris: hasil,
    konsentrasi: [...namaKolom.values()],
    semesterAda: [...semesterAda].sort((a, b) => a - b),
    tolak,
  };
}

// ------------------------------------------------------------
// PENGGABUNGAN ANTARKONSENTRASI
// ------------------------------------------------------------

export type Bentrok = {
  kode: string;
  /** Dua atau lebih versi berbeda dari kode yang sama. */
  versi: Array<{ nama: string; sks: number | null; semester: number; konsentrasi: string }>;
};

export type HasilGabung = {
  baris: BarisMatkul[];
  bentrok: Bentrok[];
  /** Berapa baris yang dibuang karena kodenya sudah ada. */
  ganda: number;
};

/**
 * Gabungkan ketiga konsentrasi menjadi satu daftar, satu baris per kode.
 *
 * Kurikulum PDDIKTI berdiri per PRODI, sedangkan lembar fakultas disusun per
 * konsentrasi — dan semester satu sampai empat hampir seluruhnya sama di
 * ketiganya. Mengirim apa adanya berarti mengirim mata kuliah yang sama tiga
 * kali, dan pengimpor di seberang akan menolaknya sebagai kode ganda.
 *
 * Yang pertama ditemukan yang dipakai. Versi yang BERBEDA — nama, sks, atau
 * semester tidak sama untuk kode yang sama — tidak didiamkan melainkan
 * dilaporkan, karena hanya manusia yang tahu mana yang benar.
 */
export function gabungKonsentrasi(baris: BarisMatkul[]): HasilGabung {
  const pertama = new Map<string, BarisMatkul>();
  const semua = new Map<string, Bentrok["versi"]>();
  let ganda = 0;

  for (const b of baris) {
    const kunci = b.kode.toUpperCase().replace(/\s+/g, "");
    if (!pertama.has(kunci)) pertama.set(kunci, b);
    else ganda += 1;

    const daftar = semua.get(kunci) ?? [];
    // Versi yang isinya persis sama tidak dicatat dua kali; yang dicari di
    // sini perbedaan, bukan pengulangan.
    const sama = daftar.some((v) => v.nama === b.nama && v.sks === b.sks && v.semester === b.semester);
    if (!sama) daftar.push({ nama: b.nama, sks: b.sks, semester: b.semester, konsentrasi: b.konsentrasi });
    semua.set(kunci, daftar);
  }

  const bentrok: Bentrok[] = [];
  for (const [kunci, versi] of semua) {
    if (versi.length > 1) bentrok.push({ kode: pertama.get(kunci)?.kode ?? kunci, versi });
  }

  return {
    baris: [...pertama.values()].sort((a, b) => a.semester - b.semester || a.kode.localeCompare(b.kode)),
    bentrok,
    ganda,
  };
}

// ------------------------------------------------------------
// PEMERIKSAAN
// ------------------------------------------------------------

export type Masalah = { id: string; kode: string; nama: string; sebab: string };

/** Baris yang belum boleh dikirim ke PDDIKTI, beserta sebabnya. */
export function periksaBaris(baris: BarisMatkul[]): Masalah[] {
  const masalah: Masalah[] = [];
  for (const b of baris) {
    const sebab: string[] = [];
    if (!b.kode) sebab.push("kode mata kuliah kosong");
    if (!b.nama) sebab.push("nama mata kuliah kosong");
    if (b.sks === null) sebab.push("SKS tidak terbaca");
    else if (b.sks === 0) sebab.push("SKS nol");
    if (b.semester < 1 || b.semester > SEMESTER_MAKS) sebab.push("semester di luar 1–8");
    if (sebab.length > 0) masalah.push({ id: b.id, kode: b.kode, nama: b.nama, sebab: sebab.join(", ") });
  }
  return masalah;
}

// ------------------------------------------------------------
// KELUARAN
// ------------------------------------------------------------

export type OpsiKeluaran = {
  /** Mulai berlaku kurikulum, mis. "20241". */
  tahunKurikulum: string;
  kodeProdi: string;
  /** Jenis MK bawaan untuk seluruh baris: A/B/C/D/S. */
  jenisMk: string;
  /** "1" wajib, "0" tidak. */
  wajib: string;
  kelompokMk: string;
  tglMulai: string;
  tglAkhir: string;
};

export const OPSI_BAWAAN: OpsiKeluaran = {
  tahunKurikulum: "",
  kodeProdi: "",
  // A (Wajib) dan 1 (Ya) dipilih sebagai bawaan karena itulah keadaan
  // sebagian besar baris pada kurikulum inti; yang peminatan diubah sendiri.
  jenisMk: "A",
  wajib: "1",
  kelompokMk: "",
  tglMulai: "",
  tglAkhir: "",
};

/**
 * Susun baris siap unggah, urut sesuai enam belas kolom PDDIKTI.
 *
 * SKS Praktek, Praktek Lapangan, dan Simulasi diisi "0", bukan dikosongkan:
 * catatan templatenya menyebutnya wajib diisi dan memerintahkan "Isi 0 jika
 * tidak ada". Lembar fakultas hanya memuat satu angka SKS, dan menebak
 * pemecahannya menjadi tatap muka dan praktek akan salah pada mata kuliah
 * praktikum — yang benar dikerjakan manusia yang tahu, sesudah berkas ini
 * jadi.
 */
export function barisKeAoa(baris: BarisMatkul[], opsi: OpsiKeluaran): string[][] {
  return baris.map((b) => [
    b.kode,
    b.nama,
    opsi.jenisMk,
    b.sks === null ? "" : String(b.sks),
    "0",
    "0",
    "0",
    "",
    opsi.tglMulai,
    opsi.tglAkhir,
    String(b.semester),
    opsi.tahunKurikulum,
    opsi.wajib,
    opsi.kodeProdi,
    opsi.kelompokMk,
    "",
  ]);
}

/** Tahun kurikulum berbentuk tahun+semester, mis. 20241. */
export function tahunKurikulumSah(nilai: string): boolean {
  return /^(19|20)\d{2}[12]$/.test(String(nilai ?? "").trim());
}
