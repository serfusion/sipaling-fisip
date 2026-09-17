// ============================================================
// DAFTAR MAHASISWA — PENCARIAN DAN IMPOR
//
// Satu permintaan pemilik portal yang terdengar sepele dan sebenarnya
// menentukan: peserta mengetik SATU huruf, dan daftarnya langsung muncul.
//
// Yang membuatnya tidak sepele adalah keadaan tempat ia dipakai. Tiga puluh
// orang membuka layar yang sama pada menit yang sama, lima menit sebelum ujian
// dimulai, lewat jaringan kampus yang sedang menanggung ketiga puluhnya
// sekaligus. Pada keadaan itu, pencarian yang "cukup cepat" di layar pengembang
// menjadi kotak yang tidak menjawab.
//
// Karena itu tiga keputusan di bawah ini, dan semuanya tentang menahan diri:
//
//   1. YANG DIKETIK DISARING DI PERAMBAN DULU. Huruf yang belum berubah tidak
//      pernah dikirim ulang, dan ketikan yang masih berlanjut menunggu sebentar
//      (debounce) sebelum menjadi permintaan.
//   2. HASILNYA DIPOTONG. Paling banyak delapan nama. Orang yang mengetik "a"
//      tidak sedang membaca daftar; ia sedang menunggu namanya muncul, dan ia
//      akan mengetik huruf kedua.
//   3. PERINGKATNYA DIHITUNG DI SINI, bukan diserahkan pada urutan basis data.
//      Yang diketik "bud" hampir pasti mencari Budi, bukan Mahmudi — walaupun
//      keduanya sama-sama cocok.
//
// Seluruh berkas ini murni: masuk data, keluar data. Tidak ada satu pun
// panggilan basis data, sehingga aturannya dapat diuji tanpa server hidup.
// ============================================================

/** Paling banyak berapa nama yang dikirim balik untuk satu ketikan. */
export const MAKS_SARAN = 8;

/** Paling sedikit berapa karakter sebelum pencarian dijalankan. */
export const MIN_KETIK = 1;

export type Mahasiswa = {
  id: number;
  nim: string;
  nama: string;
  email: string;
  prodi: string;
  kelas: string;
  angkatan: string;
  status: string;
};

export const STATUS_MAHASISWA = ["aktif", "cuti", "lulus", "keluar"] as const;
export type StatusMahasiswa = (typeof STATUS_MAHASISWA)[number];

export const STATUS_MAHASISWA_LABEL: Record<StatusMahasiswa, string> = {
  aktif: "Aktif",
  cuti: "Cuti",
  lulus: "Lulus",
  keluar: "Keluar",
};

export function rapikanStatus(masukan: unknown): StatusMahasiswa {
  const teks = String(masukan ?? "").trim().toLowerCase();
  return (STATUS_MAHASISWA as readonly string[]).includes(teks) ? (teks as StatusMahasiswa) : "aktif";
}

/**
 * Nomor induk yang sudah dibersihkan.
 *
 * Hanya angka, karena itulah bentuk yang dipakai seluruh CBT sejak awal (lihat
 * rapikanNim di src/lib/cbt.ts). Berkas impor dari bagian akademik sering
 * memuatnya sebagai angka Excel bergaya ilmiah atau dengan spasi di ujungnya,
 * dan keduanya harus menjadi nomor yang sama dengan yang diketik pesertanya.
 */
export function rapikanNimMhs(masukan: unknown): string {
  return String(masukan ?? "").replace(/\D/g, "").slice(0, 20);
}

export function rapikanNamaMhs(masukan: unknown): string {
  return String(masukan ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Nama yang diseragamkan untuk dicari dan dibandingkan.
 *
 * Huruf kecil, tanpa tanda baca, tanpa gelar yang menempel di belakang koma.
 * "Andi Pratama, S.I.Kom." dan "ANDI  PRATAMA" menjadi untai yang sama —
 * sebab yang mengetik di layar ujian tidak akan mengetikkan gelarnya.
 */
export function kunciCari(masukan: unknown): string {
  return String(masukan ?? "")
    .toLowerCase()
    .normalize("NFKD")
    // Tanda diakritik dibuang supaya "Zulfikár" ketemu oleh "zulfikar".
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function rapikanEmail(masukan: unknown): string {
  const teks = String(masukan ?? "").trim().toLowerCase().slice(0, 160);
  // Bukan validasi RFC — hanya menahan isi kolom yang jelas bukan alamat,
  // supaya baris impor yang kolomnya tergeser tidak menjadi tujuan kiriman.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(teks) ? teks : "";
}

/**
 * Apakah kata kunci ini berupa angka — artinya orang sedang mencari nomor.
 *
 * Dipisahkan karena arah pencariannya berbeda: nomor dicari dari DEPAN
 * ("2023..." adalah angkatan), sedangkan nama dicari dari mana saja
 * ("santoso" adalah nama belakang).
 */
export function kunciAngka(q: string): boolean {
  return /^\d+$/.test(q.trim());
}

export type SaranCari = Mahasiswa & { skor: number };

/**
 * Urutkan calon yang sudah cocok menurut seberapa mungkin ia yang dicari.
 *
 * Empat lapis, dari yang paling meyakinkan:
 *
 *   1000  nomornya persis sama — tidak ada yang lebih pasti dari ini
 *    900  nomornya diawali ketikan ("2023" → 2023123456)
 *    800  namanya diawali ketikan ("bud" → Budi Santoso)
 *    700  salah satu kata pada namanya diawali ketikan ("san" → Budi Santoso)
 *    600  ketikan muncul di tengah nama ("udi" → Budi)
 *
 * Nama yang lebih pendek menang tipis pada lapis yang sama: yang mengetik
 * "ani" lebih mungkin mencari "Ani" daripada "Aniyah Rahmadani Putri".
 *
 * Fungsi ini TIDAK menyaring — pemanggilnya yang sudah menyaring lewat basis
 * data. Ia hanya menyusun ulang, dan baris yang tidak cocok sama sekali
 * mendapat skor nol supaya dapat dibuang pemanggilnya.
 */
export function skorSaran(m: Mahasiswa, ketikan: string): number {
  const q = kunciCari(ketikan);
  if (!q) return 0;

  const nim = m.nim;
  const nama = kunciCari(m.nama);

  if (kunciAngka(q)) {
    if (nim === q) return 1000;
    if (nim.startsWith(q)) return 900 - Math.min(80, nim.length - q.length);
    if (nim.includes(q)) return 650;
    // Angkatan sering diketik sebagai bagian nomor; kalau tidak ketemu di
    // nomor, ia bukan yang dicari. Nama tidak ikut diperiksa untuk ketikan
    // angka — "2" akan mencocoki tiap nama yang memuat angka dua, dan tidak
    // ada nama seperti itu.
    return 0;
  }

  if (nama === q) return 1000;
  if (nama.startsWith(q)) return 900 - Math.min(80, nama.length - q.length);

  const kata = nama.split(" ");
  if (kata.some((k) => k.startsWith(q))) return 800 - Math.min(80, nama.length - q.length);
  if (nama.includes(q)) return 700 - Math.min(80, nama.length - q.length);

  return 0;
}

/**
 * Peringkat akhir satu daftar calon.
 *
 * Mahasiswa yang berstatus tidak aktif ikut tampil, tetapi selalu di bawah
 * yang aktif. Ia tidak disembunyikan: mahasiswa cuti yang mengikuti ujian
 * susulan memang ada, dan menyembunyikannya akan membuat pengawas mengira
 * namanya belum diimpor — lalu mengetiknya manual dengan nomor yang salah.
 */
export function peringkatSaran(calon: Mahasiswa[], ketikan: string, batas = MAKS_SARAN): SaranCari[] {
  const hasil: SaranCari[] = [];
  for (const m of calon) {
    const dasar = skorSaran(m, ketikan);
    if (dasar <= 0) continue;
    hasil.push({ ...m, skor: m.status === "aktif" ? dasar : dasar - 500 });
  }
  hasil.sort((a, b) => (b.skor - a.skor) || a.nama.localeCompare(b.nama, "id"));
  return hasil.slice(0, Math.max(1, batas));
}

/**
 * Untai yang aman ditaruh di dalam pola ILIKE.
 *
 * Tanda % dan _ punya arti khusus di sana, dan nama orang memang kadang
 * memuatnya lewat salah tempel. Tanpa pelolosan ini, satu tanda persen yang
 * terketik membuat pencarian mengembalikan seluruh isi tabel.
 */
export function lolosLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ------------------------------------------------------------
// IMPOR
// ------------------------------------------------------------

/**
 * Nama kolom yang dikenali dari berkas impor, dan ke mana ia dipetakan.
 *
 * Bagian akademik mengirim berkas dengan judul kolom yang berbeda-beda tiap
 * tahun, dan memintanya menyeragamkan berkasnya lebih dulu berarti berkas itu
 * tidak akan pernah masuk. Yang dikenali karena itu banyak — dan yang tidak
 * dikenali dilaporkan, bukan didiamkan.
 */
const KOLOM: Array<{ medan: keyof BarisImpor; nama: string[] }> = [
  { medan: "nim", nama: ["nim", "npm", "nomor induk", "no induk", "nomor mahasiswa", "no", "nomor"] },
  { medan: "nama", nama: ["nama", "nama lengkap", "nama mahasiswa", "name"] },
  { medan: "email", nama: ["email", "e-mail", "surel", "alamat email"] },
  { medan: "prodi", nama: ["prodi", "program studi", "jurusan", "konsentrasi"] },
  { medan: "kelas", nama: ["kelas", "class", "rombel", "kelompok"] },
  { medan: "angkatan", nama: ["angkatan", "tahun masuk", "tahun angkatan", "cohort"] },
  { medan: "status", nama: ["status", "status mahasiswa", "keterangan"] },
];

export type BarisImpor = {
  nim: string;
  nama: string;
  email: string;
  prodi: string;
  kelas: string;
  angkatan: string;
  status: StatusMahasiswa;
};

export type HasilImpor = {
  baris: BarisImpor[];
  /** Baris yang tidak dapat dipakai, beserta alasannya — untuk ditunjukkan. */
  tolak: Array<{ baris: string; alasan: string }>;
  /** Judul kolom yang ada di berkas tetapi tidak dikenali. */
  kolomAsing: string[];
};

/** Satu sel apa adanya dari pembaca Excel. */
export type Sel = string | number | boolean | null | undefined;
export type Aoa = Sel[][];

function selTeks(sel: Sel): string {
  if (sel === null || sel === undefined) return "";
  if (typeof sel === "number") {
    // Angka besar dari Excel dapat terbaca 2.02312e+9. toFixed(0) memulihkan
    // nomor induknya utuh; String() tidak.
    return Number.isInteger(sel) ? sel.toFixed(0) : String(sel);
  }
  return String(sel).trim();
}

/**
 * Baca tabel mahasiswa dari isi berkas Excel/CSV yang sudah menjadi larik.
 *
 * Baris judulnya dicari, bukan dianggap selalu baris pertama: berkas dari
 * bagian akademik lazim diawali kop, logo, dan satu baris kosong. Yang dicari
 * adalah baris pertama yang memuat kolom nomor DAN kolom nama — dua kolom yang
 * tanpa keduanya berkas ini bukan daftar mahasiswa.
 */
export function bacaImporMahasiswa(aoa: Aoa): HasilImpor {
  const tolak: HasilImpor["tolak"] = [];
  const kosong: HasilImpor = { baris: [], tolak, kolomAsing: [] };
  if (!Array.isArray(aoa) || aoa.length === 0) {
    tolak.push({ baris: "-", alasan: "Berkasnya kosong." });
    return kosong;
  }

  let barisJudul = -1;
  let peta: Partial<Record<keyof BarisImpor, number>> = {};
  const asing: string[] = [];

  for (let i = 0; i < Math.min(aoa.length, 30); i += 1) {
    const calon: Partial<Record<keyof BarisImpor, number>> = {};
    const belumDikenal: string[] = [];
    (aoa[i] ?? []).forEach((sel, kolom) => {
      const judul = selTeks(sel).toLowerCase().replace(/\s+/g, " ").trim();
      if (!judul) return;
      const cocok = KOLOM.find((k) => k.nama.includes(judul));
      if (!cocok) { belumDikenal.push(judul); return; }
      // Judul yang muncul dua kali memakai yang PERTAMA. Berkas dengan kolom
      // "Nama" dan "Nama Ibu" akan salah membaca kalau yang belakangan menang.
      if (calon[cocok.medan] === undefined) calon[cocok.medan] = kolom;
    });
    if (calon.nim !== undefined && calon.nama !== undefined) {
      barisJudul = i;
      peta = calon;
      asing.push(...belumDikenal);
      break;
    }
  }

  if (barisJudul < 0) {
    tolak.push({
      baris: "-",
      alasan: "Tidak ditemukan kolom NIM dan Nama. Pastikan berkasnya memakai judul kolom.",
    });
    return kosong;
  }

  const ambil = (baris: Sel[], medan: keyof BarisImpor): string => {
    const kolom = peta[medan];
    return kolom === undefined ? "" : selTeks(baris[kolom]);
  };

  const baris: BarisImpor[] = [];
  // Nomor yang sudah masuk, supaya berkas yang memuat satu orang dua kali
  // tidak menabrak batas unik basis data di tengah penyimpanan — dan
  // meninggalkan separuh daftar tersimpan, separuh tidak.
  const sudah = new Set<string>();

  for (let i = barisJudul + 1; i < aoa.length; i += 1) {
    const isi = aoa[i] ?? [];
    const mentahNim = ambil(isi, "nim");
    const mentahNama = ambil(isi, "nama");
    if (!mentahNim && !mentahNama) continue; // baris kosong, dilewati diam-diam

    const petunjuk = `Baris ${i + 1}: ${(mentahNama || mentahNim || "").slice(0, 50)}`;
    const nim = rapikanNimMhs(mentahNim);
    const nama = rapikanNamaMhs(mentahNama);

    if (!nim) { tolak.push({ baris: petunjuk, alasan: "Nomor induknya kosong atau bukan angka." }); continue; }
    if (nim.length < 4) { tolak.push({ baris: petunjuk, alasan: "Nomor induknya terlalu pendek." }); continue; }
    if (nama.length < 3) { tolak.push({ baris: petunjuk, alasan: "Namanya kosong atau terlalu pendek." }); continue; }
    if (sudah.has(nim)) { tolak.push({ baris: petunjuk, alasan: `Nomor ${nim} muncul dua kali di berkas ini.` }); continue; }

    sudah.add(nim);
    baris.push({
      nim,
      nama,
      email: rapikanEmail(ambil(isi, "email")),
      prodi: ambil(isi, "prodi").slice(0, 120),
      kelas: ambil(isi, "kelas").slice(0, 80),
      angkatan: ambil(isi, "angkatan").replace(/\D/g, "").slice(0, 10),
      status: rapikanStatus(ambil(isi, "status")),
    });
  }

  if (baris.length === 0 && tolak.length === 0) {
    tolak.push({ baris: "-", alasan: "Tidak ada satu pun baris data di bawah judul kolom." });
  }

  return { baris, tolak, kolomAsing: [...new Set(asing)] };
}

/**
 * Baca daftar yang DITEMPEL sebagai teks biasa.
 *
 * Jalan kedua yang sering justru jalan pertama: dosen menyalin dua kolom dari
 * layar SIAKAD dan menempelkannya. Pemisahnya bisa tab, titik koma, atau koma
 * — yang mana pun, asal konsisten dalam satu baris.
 */
export function bacaTempelMahasiswa(teks: string): HasilImpor {
  const baris = String(teks ?? "")
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const aoa: Aoa = baris.map((b) => {
    const pemisah = b.includes("\t") ? "\t" : b.includes(";") ? ";" : ",";
    return b.split(pemisah).map((s) => s.trim());
  });
  // Tanpa judul kolom, dua kolom pertama dianggap nomor dan nama — urutan yang
  // dipakai hampir semua tampilan SIAKAD. Judulnya disisipkan supaya
  // pembacanya satu-satunya dan tidak ada cabang aturan kedua yang harus
  // dijaga ikut berubah.
  const adaJudul = aoa[0]?.some((s) => String(s).toLowerCase().includes("nim") || String(s).toLowerCase().includes("nama"));
  return bacaImporMahasiswa(adaJudul ? aoa : [["nim", "nama", "email", "prodi", "kelas", "angkatan"], ...aoa]);
}
