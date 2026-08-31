// PERUMUS JUDUL DAN METODE
//
// Alasan alat ini ada: yang paling sering memulangkan mahasiswa FISIP dari
// meja pembimbing bukan kekurangan bacaan, melainkan judul yang tidak sejalan
// dengan metodenya. "Pengaruh A terhadap B" yang hendak dikerjakan dengan
// wawancara mendalam tidak akan pernah bisa menjawab pertanyaannya sendiri,
// dan itu baru ketahuan setelah berbulan-bulan.
//
// Semua di sini kaidah, bukan tebakan mesin. Tiap keluaran dapat ditelusuri
// ke pilihan yang mahasiswa buat sendiri, dan tiap peringatan menyebutkan
// alasannya. Keputusan akhir tetap milik dosen pembimbing.

export type Tujuan =
  | "pengaruh" | "hubungan" | "perbedaan" | "gambaran"
  | "makna" | "proses" | "isi" | "evaluasi";

export type Unit = "individu" | "organisasi" | "teks" | "kebijakan";

export type Data = "kuesioner" | "wawancara" | "dokumen" | "observasi";

export type Prodi = "komunikasi" | "pemerintahan" | "lain";

export const TUJUAN_PILIHAN: Array<{ id: Tujuan; label: string; tanya: string }> = [
  { id: "pengaruh", label: "Pengaruh", tanya: "Apakah A memengaruhi B?" },
  { id: "hubungan", label: "Hubungan", tanya: "Apakah A berkaitan dengan B?" },
  { id: "perbedaan", label: "Perbedaan", tanya: "Apakah kelompok A berbeda dari kelompok B?" },
  { id: "gambaran", label: "Gambaran", tanya: "Bagaimana keadaan A sebenarnya?" },
  { id: "makna", label: "Makna dan pengalaman", tanya: "Bagaimana orang memaknai A?" },
  { id: "proses", label: "Proses dan strategi", tanya: "Bagaimana A dijalankan?" },
  { id: "isi", label: "Isi pesan atau teks", tanya: "Apa yang terkandung dalam A?" },
  { id: "evaluasi", label: "Evaluasi program", tanya: "Seberapa berhasil A?" },
];

export const UNIT_PILIHAN: Array<{ id: Unit; label: string; ket: string }> = [
  { id: "individu", label: "Orang", ket: "Mahasiswa, warga, pemilih, pegawai" },
  { id: "organisasi", label: "Lembaga", ket: "Dinas, perusahaan, partai, kampus" },
  { id: "teks", label: "Teks atau media", ket: "Berita, unggahan, iklan, film" },
  { id: "kebijakan", label: "Kebijakan atau program", ket: "Perda, program bantuan, layanan" },
];

export const DATA_PILIHAN: Array<{ id: Data; label: string; ket: string }> = [
  { id: "kuesioner", label: "Sebar kuesioner", ket: "Bisa menjangkau puluhan sampai ratusan responden" },
  { id: "wawancara", label: "Wawancara mendalam", ket: "Ada narasumber yang bersedia ditemui" },
  { id: "dokumen", label: "Dokumen atau arsip", ket: "Berita, laporan, unggahan, notula" },
  { id: "observasi", label: "Pengamatan langsung", ket: "Bisa hadir di lokasi kegiatan" },
];

/**
 * Rancangan penelitian yang dikenal di FISIP.
 *
 * Daftarnya mengikuti dua daftar yang benar-benar dipakai dosen pembimbing di
 * dua prodi ini, bukan daftar metodologi yang lengkap. Ilmu Komunikasi dan
 * Ilmu Pemerintahan memang tidak memakai rancangan yang sama: analisis framing
 * dan semiotika hampir tidak pernah muncul di skripsi pemerintahan, sedangkan
 * implementasi kebijakan dan tata kelola hampir tidak pernah muncul di skripsi
 * komunikasi. Karena itu prodinya ditanyakan lebih dulu, dan daftar yang
 * ditawarkan menyesuaikan.
 */
export type Jenis =
  | "kuantitatif-eksplanatif" | "kuantitatif-korelasional" | "kuantitatif-komparatif"
  | "kuantitatif-deskriptif" | "uses-gratifications" | "efektivitas-program"
  | "analisis-isi" | "analisis-framing" | "semiotika"
  | "fenomenologi" | "studi-kasus" | "kualitatif-deskriptif" | "strategi-komunikasi"
  | "implementasi-kebijakan" | "peran-pemerintah" | "analisis-kebijakan"
  | "governance" | "strategi-pemerintah";

/**
 * Empat lapis yang sering tertukar.
 *
 * "Pengaruh", "analisis", dan "framing" bukan tiga hal yang sejenis, dan
 * menyebut ketiganya "metode" adalah salah satu sebab mahasiswa dipulangkan
 * dari meja pembimbing. Yang benar berlapis:
 *
 *   pendekatan  →  kuantitatif atau kualitatif
 *   metode      →  survei, analisis framing, studi kasus, dan seterusnya
 *   model/teori →  Entman, Barthes, Edward III, dan seterusnya
 *   analisis    →  regresi, uji reliabilitas antar-koder, pengodean tematik
 *
 * Keempatnya kini disusun terpisah dan ditampilkan terpisah, sehingga
 * mahasiswa tahu persis kalimat mana yang masuk ke bab metode dan pada bagian
 * mana ia menyebut nama model.
 */
export type Pendekatan = "kuantitatif" | "kualitatif";

export const PENDEKATAN: Record<Jenis, Pendekatan> = {
  "kuantitatif-eksplanatif": "kuantitatif",
  "kuantitatif-korelasional": "kuantitatif",
  "kuantitatif-komparatif": "kuantitatif",
  "kuantitatif-deskriptif": "kuantitatif",
  "uses-gratifications": "kuantitatif",
  "efektivitas-program": "kuantitatif",
  "analisis-isi": "kualitatif",
  "analisis-framing": "kualitatif",
  semiotika: "kualitatif",
  fenomenologi: "kualitatif",
  "studi-kasus": "kualitatif",
  "kualitatif-deskriptif": "kualitatif",
  "strategi-komunikasi": "kualitatif",
  "implementasi-kebijakan": "kualitatif",
  "peran-pemerintah": "kualitatif",
  "analisis-kebijakan": "kualitatif",
  governance: "kualitatif",
  "strategi-pemerintah": "kualitatif",
};

export const PENDEKATAN_LABEL: Record<Pendekatan, string> = {
  kuantitatif: "Kuantitatif",
  kualitatif: "Kualitatif",
};

/** Nama metodenya, lapis kedua. Inilah yang ditulis pada kalimat "penelitian
 *  ini menggunakan metode …" di bab tiga. */
export const METODE_POLA: Record<Jenis, string> = {
  "kuantitatif-eksplanatif": "Survei",
  "kuantitatif-korelasional": "Survei",
  "kuantitatif-komparatif": "Survei komparatif",
  "kuantitatif-deskriptif": "Survei deskriptif",
  "uses-gratifications": "Survei",
  "efektivitas-program": "Survei efektivitas program",
  "analisis-isi": "Analisis isi",
  "analisis-framing": "Analisis framing",
  semiotika: "Analisis semiotika",
  fenomenologi: "Fenomenologi",
  "studi-kasus": "Studi kasus",
  "kualitatif-deskriptif": "Deskriptif kualitatif",
  "strategi-komunikasi": "Deskriptif kualitatif",
  "implementasi-kebijakan": "Studi kasus kebijakan",
  "peran-pemerintah": "Deskriptif kualitatif",
  "analisis-kebijakan": "Analisis kebijakan",
  governance: "Deskriptif kualitatif",
  "strategi-pemerintah": "Deskriptif kualitatif",
};

/**
 * Berapa berat mengerjakannya, satu sampai tiga.
 *
 * Angka ini bukan penilaian mutu. Rancangan bintang tiga tidak lebih baik
 * daripada bintang satu; ia hanya menuntut bacaan teori yang lebih panjang,
 * data yang lebih sulit didapat, atau tahap analisis yang lebih banyak.
 * Mahasiswa yang mengejar wisuda berhak tahu itu sebelum memilih.
 */
export const KESULITAN: Record<Jenis, 1 | 2 | 3> = {
  "kuantitatif-eksplanatif": 2,
  "kuantitatif-korelasional": 2,
  "kuantitatif-komparatif": 2,
  "kuantitatif-deskriptif": 1,
  "uses-gratifications": 3,
  "efektivitas-program": 2,
  "analisis-isi": 2,
  "analisis-framing": 3,
  semiotika: 3,
  fenomenologi: 3,
  "studi-kasus": 3,
  "kualitatif-deskriptif": 2,
  "strategi-komunikasi": 2,
  "implementasi-kebijakan": 3,
  "peran-pemerintah": 2,
  "analisis-kebijakan": 3,
  governance: 3,
  "strategi-pemerintah": 2,
};

export const JENIS_LABEL: Record<Jenis, string> = {
  "kuantitatif-eksplanatif": "Kuantitatif eksplanatif (asosiatif kausal)",
  "kuantitatif-korelasional": "Kuantitatif korelasional",
  "kuantitatif-komparatif": "Kuantitatif komparatif",
  "kuantitatif-deskriptif": "Kuantitatif deskriptif",
  "uses-gratifications": "Kuantitatif survei, pendekatan uses and gratifications",
  "efektivitas-program": "Kuantitatif deskriptif efektivitas program",
  "analisis-isi": "Analisis isi",
  "analisis-framing": "Kualitatif analisis framing",
  semiotika: "Kualitatif analisis semiotika",
  fenomenologi: "Kualitatif fenomenologi",
  "studi-kasus": "Kualitatif studi kasus",
  "kualitatif-deskriptif": "Kualitatif deskriptif",
  "strategi-komunikasi": "Kualitatif deskriptif strategi komunikasi",
  "implementasi-kebijakan": "Kualitatif studi implementasi kebijakan",
  "peran-pemerintah": "Kualitatif deskriptif peran pemerintah",
  "analisis-kebijakan": "Kualitatif analisis kebijakan",
  governance: "Kualitatif tata kelola pemerintahan",
  "strategi-pemerintah": "Kualitatif deskriptif strategi pemerintah",
};

/**
 * Nama metode dalam bahasa yang dipakai sehari-hari di ruang bimbingan.
 *
 * `JENIS_LABEL` di atas adalah nama resminya, dan memang itu yang harus
 * tertulis di bab metode. Tetapi "kuantitatif eksplanatif (asosiatif kausal)"
 * bukan kalimat yang menenangkan mahasiswa yang baru bertanya. Yang mereka
 * kenal adalah "pengaruh" dan "studi kasus". Nama pendek dipakai di layar,
 * nama resminya disebut di bawahnya supaya tetap terbawa ke naskah.
 */
export const JENIS_UMUM: Record<Jenis, string> = {
  "kuantitatif-eksplanatif": "Pengaruh",
  "kuantitatif-korelasional": "Hubungan",
  "kuantitatif-komparatif": "Perbedaan",
  "kuantitatif-deskriptif": "Deskriptif Kuantitatif",
  "uses-gratifications": "Uses & Gratifications",
  "efektivitas-program": "Efektivitas",
  "analisis-isi": "Analisis Isi",
  "analisis-framing": "Analisis Framing",
  semiotika: "Semiotika",
  fenomenologi: "Fenomenologi",
  "studi-kasus": "Studi Kasus",
  "kualitatif-deskriptif": "Kualitatif Deskriptif",
  "strategi-komunikasi": "Strategi Komunikasi",
  "implementasi-kebijakan": "Implementasi Kebijakan",
  "peran-pemerintah": "Peran Pemerintah",
  "analisis-kebijakan": "Analisis Kebijakan",
  governance: "Tata Kelola",
  "strategi-pemerintah": "Strategi Pemerintah",
};

/** Satu frasa tentang apa yang dikerjakan metode itu, untuk mendampingi nama
 *  pendeknya tanpa mengulang istilah teknis. */
export const JENIS_KERJA: Record<Jenis, string> = {
  "kuantitatif-eksplanatif": "menguji pengaruh",
  "kuantitatif-korelasional": "menguji hubungan",
  "kuantitatif-komparatif": "membandingkan kelompok",
  "kuantitatif-deskriptif": "memetakan keadaan",
  "uses-gratifications": "mengukur motif dan kepuasan",
  "efektivitas-program": "menilai capaian program",
  "analisis-isi": "menghitung isi teks",
  "analisis-framing": "membedah bingkai berita",
  semiotika: "membaca tanda dan makna",
  fenomenologi: "menggali pengalaman",
  "studi-kasus": "menelusuri satu kasus",
  "kualitatif-deskriptif": "menggali tema",
  "strategi-komunikasi": "menelusuri strategi komunikasi",
  "implementasi-kebijakan": "menelusuri jalannya kebijakan",
  "peran-pemerintah": "menelusuri peran pemerintah",
  "analisis-kebijakan": "membedah isi kebijakan",
  governance: "menilai tata kelola",
  "strategi-pemerintah": "menelusuri strategi pemerintah",
};

/**
 * Model atau teori yang biasa dipakai di dalam metode itu, lapis ketiga.
 *
 * Rancangan survei tidak punya lapis ini: yang dipilih di sana adalah teori
 * yang menjelaskan hubungan variabelnya, bukan model analisis. Karena itu
 * daftarnya sengaja dikosongkan, bukan diisi teori supaya kelihatan penuh.
 *
 * Yang ditandai `anjuran` adalah yang paling ringkas dikerjakan pada tingkat
 * S1. Ketiganya sah; yang membedakan hanya berapa banyak tabel yang harus
 * dibuat dan berapa panjang bacaan teorinya.
 */
export type Model = { nama: string; catatan: string; anjuran?: boolean };

export const MODEL_PILIHAN: Record<Jenis, Model[]> = {
  "kuantitatif-eksplanatif": [],
  "kuantitatif-korelasional": [],
  "kuantitatif-komparatif": [],
  "kuantitatif-deskriptif": [],
  "uses-gratifications": [
    { nama: "Katz, Blumler, dan Gurevitch", anjuran: true,
      catatan: "Motif dipilah menjadi kebutuhan kognitif, afektif, integratif pribadi, integratif sosial, dan pelepasan ketegangan. Paling sering dipakai dan paling mudah dijadikan butir kuesioner." },
    { nama: "McQuail", catatan: "Empat motif: informasi, identitas pribadi, integrasi dan interaksi sosial, serta hiburan. Lebih ringkas, tetapi butirnya lebih sedikit." },
    { nama: "Gratification sought dan gratification obtained", catatan: "Motif yang dicari dibandingkan dengan kepuasan yang diperoleh. Menuntut dua kali pengukuran pada responden yang sama." },
  ],
  "efektivitas-program": [
    { nama: "Kriteria efektivitas Duncan", anjuran: true,
      catatan: "Tiga tolok ukur: pencapaian tujuan, integrasi, dan adaptasi. Paling mudah diturunkan menjadi indikator kuesioner." },
    { nama: "Model CIPP (Stufflebeam)", catatan: "Context, input, process, product. Menuntut dokumen resmi program yang lengkap." },
    { nama: "Kirkpatrick", catatan: "Empat tingkat: reaksi, pembelajaran, perilaku, hasil. Cocok untuk program pelatihan." },
  ],
  "analisis-isi": [
    { nama: "Kategori yang diturunkan dari teori", anjuran: true,
      catatan: "Kategori disusun sendiri dari teori yang dipakai, ditetapkan sebelum koding dimulai." },
    { nama: "Kategori baku dari penelitian terdahulu", catatan: "Memakai lembar koding penelitian sebelumnya. Lebih cepat, tetapi wajib menyebut sumbernya." },
  ],
  "analisis-framing": [
    { nama: "Robert N. Entman", anjuran: true,
      catatan: "Empat perangkat: pendefinisian masalah, perkiraan penyebab, penilaian moral, dan saran penyelesaian. Paling ringkas untuk S1." },
    { nama: "Zhongdang Pan dan Gerald M. Kosicki", catatan: "Empat struktur: sintaksis, skrip, tematik, retoris. Lebih rinci, dan tabelnya jauh lebih banyak." },
    { nama: "William A. Gamson", catatan: "Perangkat framing dan perangkat penalaran. Menuntut bacaan teori yang paling panjang di antara ketiganya." },
  ],
  semiotika: [
    { nama: "Roland Barthes", anjuran: true,
      catatan: "Denotasi, konotasi, dan mitos. Paling sering dipakai untuk film, iklan, dan poster." },
    { nama: "Charles Sanders Peirce", catatan: "Segitiga tanda: representamen, objek, interpretan. Menuntut ketelitian menentukan jenis tandanya." },
    { nama: "Ferdinand de Saussure", catatan: "Penanda dan petanda. Cocok untuk teks yang strukturnya sederhana." },
  ],
  fenomenologi: [
    { nama: "Alfred Schutz", anjuran: true,
      catatan: "Motif sebab dan motif tujuan. Paling mudah dijadikan pedoman wawancara." },
    { nama: "Clark Moustakas", catatan: "Horizonalisasi, unit makna, deskripsi tekstural dan struktural." },
    { nama: "Edmund Husserl", catatan: "Bracketing dan pencarian esensi. Bacaan filsafatnya paling berat." },
  ],
  "studi-kasus": [
    { nama: "Robert K. Yin", anjuran: true,
      catatan: "Kasus tunggal atau jamak, dengan proposisi teoretis dan penjodohan pola." },
    { nama: "Robert E. Stake", catatan: "Kasus intrinsik dan instrumental. Lebih longgar, lebih menuntut kepekaan menafsirkan." },
  ],
  "kualitatif-deskriptif": [],
  "strategi-komunikasi": [
    { nama: "Perencanaan komunikasi Cutlip dan Center", anjuran: true,
      catatan: "Empat tahap: pengumpulan fakta, perencanaan, komunikasi, dan evaluasi." },
    { nama: "Harold Lasswell", catatan: "Siapa, mengatakan apa, lewat saluran apa, kepada siapa, dengan akibat apa." },
    { nama: "Analisis SWOT", catatan: "Dipakai bila yang ditanyakan penyusunan strateginya, bukan pelaksanaannya." },
  ],
  "implementasi-kebijakan": [
    { nama: "George C. Edward III", anjuran: true,
      catatan: "Empat aspek: komunikasi, sumber daya, disposisi, dan struktur birokrasi. Paling mudah dijadikan pedoman wawancara." },
    { nama: "Van Meter dan Van Horn", catatan: "Enam variabel, termasuk ukuran dan sasaran kebijakan serta keadaan sosial dan politik." },
    { nama: "Merilee S. Grindle", catatan: "Isi kebijakan dan konteks implementasinya. Cocok bila yang diteliti kebijakan yang kontroversial." },
  ],
  "peran-pemerintah": [
    { nama: "Peran regulator, fasilitator, dan dinamisator", anjuran: true,
      catatan: "Tiga peran ini paling mudah dijadikan pertanyaan wawancara kepada pemerintah dan masyarakat." },
    { nama: "Pelayanan, pemberdayaan, dan pembangunan (Ryaas Rasyid)", catatan: "Tiga fungsi pemerintahan. Cocok untuk penelitian di tingkat desa dan kecamatan." },
  ],
  "analisis-kebijakan": [
    { nama: "William N. Dunn", anjuran: true,
      catatan: "Perumusan masalah, peramalan, rekomendasi, pemantauan, dan evaluasi kebijakan." },
    { nama: "Segitiga kebijakan Walt dan Gilson", catatan: "Isi, konteks, proses, dan aktor. Cocok bila banyak pihak yang berkepentingan." },
  ],
  governance: [
    { nama: "Prinsip good governance UNDP", anjuran: true,
      catatan: "Antara lain partisipasi, transparansi, akuntabilitas, dan penegakan hukum. Pilih beberapa saja, jangan seluruhnya." },
    { nama: "Collaborative governance (Ansell dan Gash)", catatan: "Dipakai bila yang diteliti kerja sama antara pemerintah, swasta, dan masyarakat." },
  ],
  "strategi-pemerintah": [
    { nama: "Analisis SWOT", anjuran: true,
      catatan: "Kekuatan, kelemahan, peluang, dan ancaman. Paling mudah dijadikan bagan temuan." },
    { nama: "Manajemen strategis Bryson", catatan: "Perumusan, pelaksanaan, dan pengendalian strategi pada organisasi publik." },
  ],
};

/**
 * Daftar yang ditawarkan pada tiap prodi.
 *
 * Urutannya bukan abjad melainkan urutan kemudahan: yang paling sering
 * berhasil diselesaikan mahasiswa berada di atas. Perbedaan kelompok memang
 * tidak ada di daftar ini karena jarang diajukan di kedua prodi, tetapi ia
 * tetap dapat dicapai lewat formulir tujuh langkah bila ceritanya memang
 * membandingkan dua kelompok.
 */
export const PRODI_METODE: Record<"komunikasi" | "pemerintahan", Record<Pendekatan, Jenis[]>> = {
  komunikasi: {
    kuantitatif: ["kuantitatif-eksplanatif", "kuantitatif-korelasional", "kuantitatif-deskriptif", "uses-gratifications"],
    kualitatif: ["analisis-isi", "analisis-framing", "semiotika", "strategi-komunikasi", "kualitatif-deskriptif", "studi-kasus", "fenomenologi"],
  },
  pemerintahan: {
    kuantitatif: ["kuantitatif-eksplanatif", "kuantitatif-korelasional", "efektivitas-program", "kuantitatif-deskriptif"],
    kualitatif: ["implementasi-kebijakan", "peran-pemerintah", "strategi-pemerintah", "analisis-kebijakan", "governance", "studi-kasus"],
  },
};

/** Urutan kemudahan, dipakai memilih empat rancangan yang ditawarkan lebih
 *  dulu dari sebuah cerita. Yang di depan yang paling sering selesai. */
export const URUT_MUDAH: Record<"komunikasi" | "pemerintahan", Jenis[]> = {
  komunikasi: ["kuantitatif-eksplanatif", "analisis-isi", "analisis-framing", "semiotika", "strategi-komunikasi", "studi-kasus", "fenomenologi", "kualitatif-deskriptif", "kuantitatif-korelasional", "kuantitatif-deskriptif", "uses-gratifications"],
  pemerintahan: ["kuantitatif-eksplanatif", "efektivitas-program", "implementasi-kebijakan", "peran-pemerintah", "strategi-pemerintah", "analisis-kebijakan", "governance", "studi-kasus", "kuantitatif-korelasional", "kuantitatif-deskriptif"],
};

export const PRODI_LABEL: Record<Prodi, string> = {
  komunikasi: "Ilmu Komunikasi",
  pemerintahan: "Ilmu Pemerintahan",
  lain: "Prodi lain",
};

/** Prodi yang punya daftar metode sendiri. Nilai lama "lain" diarahkan ke
 *  daftar Ilmu Komunikasi supaya data project yang sudah tersimpan tetap
 *  terbaca, bukan menghasilkan daftar kosong. */
export function prodiBerdaftar(prodi: Prodi): "komunikasi" | "pemerintahan" {
  return prodi === "pemerintahan" ? "pemerintahan" : "komunikasi";
}

/** Apakah rancangan ini memang ditawarkan pada prodi tersebut? */
export function metodeProdi(jenis: Jenis, prodi: Prodi): boolean {
  const daftar = PRODI_METODE[prodiBerdaftar(prodi)];
  return daftar.kuantitatif.includes(jenis) || daftar.kualitatif.includes(jenis);
}

export type Masukan = {
  variabelX: string;
  /** Variabel bebas kedua, bila ada. Kosong berarti hanya satu X. */
  variabelX2?: string;
  /** Variabel antara atau mediasi, bila ada. */
  variabelZ?: string;
  variabelY: string;
  objek: string;
  lokasi: string;
  tujuan: Tujuan;
  unit: Unit;
  data: Data[];
  jumlahPopulasi: number;
  perkiraanSampel: number;
  prodi: Prodi;
  /** Rancangan yang dipilih sendiri dari daftar prodinya. Kosong berarti
   *  rancangannya disimpulkan dari tujuan, unit analisis, dan datanya. */
  metode?: Jenis;
};

export type Peringatan = {
  berat: "hambat" | "periksa";
  judul: string;
  pesan: string;
  jalanKeluar: string;
};

export type Analisis = { nama: string; syarat: string };

export type Rancangan = {
  jenis: Jenis;
  /** Lapis satu: kuantitatif atau kualitatif. */
  pendekatan: Pendekatan;
  /** Lapis dua: nama metodenya, yang ditulis di kalimat "penelitian ini
   *  menggunakan metode …". */
  metodePola: string;
  /** Lapis tiga: model atau teori di dalam metode itu. Kosong pada rancangan
   *  survei, yang memang tidak punya lapis ini. */
  model: Model[];
  /** Satu sampai tiga. Bukan penilaian mutu, melainkan berat pengerjaannya. */
  kesulitan: 1 | 2 | 3;
  paradigma: string;
  populasi: string;
  sampling: Array<{ nama: string; alasan: string }>;
  pengumpulan: string[];
  analisis: Analisis[];
  keabsahan: string[];
  judul: string[];
  rumusan: string[];
  tujuanTulis: string[];
  teori: string[];
  peringatan: Peringatan[];
  sampelDisarankan: number | null;
};

/**
 * Analisis isi sengaja tidak lagi berada di sini.
 *
 * Ia memang menghitung, tetapi yang dihitung adalah kategori yang disusun
 * peneliti sendiri, bukan jawaban responden. Selama ia dianggap kuantitatif,
 * rumus Slovin dan Cronbach's Alpha ikut disarankan, padahal keduanya tidak
 * berlaku pada korpus teks; yang berlaku di sana adalah kesepakatan antar
 * koder. Penempatannya mengikuti daftar yang dipakai kedua prodi.
 */
export function kuantitatif(jenis: Jenis) {
  return PENDEKATAN[jenis] === "kuantitatif";
}

/** Rancangan yang bahannya teks atau dokumen, bukan orang. Sampling dan
 *  keabsahannya berbeda dari rancangan yang mendatangi responden. */
const BERBAHAN_TEKS: Jenis[] = ["analisis-isi", "analisis-framing", "semiotika", "analisis-kebijakan"];

export function berbahanTeks(jenis: Jenis) {
  return BERBAHAN_TEKS.includes(jenis);
}

/** Rumus Slovin, yang dipakai hampir semua skripsi Indonesia untuk populasi diketahui. */
export function slovin(populasi: number, galat = 0.05) {
  if (!populasi || populasi <= 0) return null;
  return Math.ceil(populasi / (1 + populasi * galat * galat));
}

/**
 * Rancangan mana yang paling menjawab cerita mahasiswa.
 *
 * Prodinya ikut menentukan, dan itu bukan sekadar penyesuaian istilah.
 * Cerita "bagaimana dinas menjalankan programnya" di Ilmu Pemerintahan
 * bermuara pada implementasi kebijakan, sedangkan cerita yang sama di Ilmu
 * Komunikasi bermuara pada strategi komunikasi. Keduanya kualitatif, tetapi
 * teori, pertanyaan wawancara, dan bab duanya sama sekali berbeda. Selama
 * prodinya tidak ditanyakan, satu dari dua kelompok mahasiswa selalu
 * mendapat jawaban yang keliru.
 */
function tentukanJenis(m: Masukan): Jenis {
  // Pilihan mahasiswa sendiri selalu menang, asalkan rancangan itu memang
  // ditawarkan di prodinya.
  if (m.metode && metodeProdi(m.metode, m.prodi)) return m.metode;

  const pem = prodiBerdaftar(m.prodi) === "pemerintahan";

  if (m.unit === "kebijakan") {
    if (m.tujuan === "isi" || m.tujuan === "gambaran") return pem ? "analisis-kebijakan" : "analisis-isi";
    if (m.tujuan === "evaluasi") return "efektivitas-program";
    if (m.tujuan === "proses" || m.tujuan === "makna") return pem ? "implementasi-kebijakan" : "kualitatif-deskriptif";
  }

  if (m.unit === "teks") {
    // Teks dapat dikerjakan dua arah. Yang menentukan adalah apakah yang
    // dicari frekuensi (dihitung) atau makna (ditafsirkan).
    if (pem) return "analisis-kebijakan";
    return m.tujuan === "isi" || m.tujuan === "gambaran" ? "analisis-isi" : "semiotika";
  }

  switch (m.tujuan) {
    case "pengaruh": return "kuantitatif-eksplanatif";
    case "hubungan": return "kuantitatif-korelasional";
    case "perbedaan": return "kuantitatif-komparatif";
    case "isi": return pem ? "analisis-kebijakan" : "analisis-isi";
    case "makna": return pem ? "kualitatif-deskriptif" : "fenomenologi";
    case "evaluasi": return "efektivitas-program";
    case "proses":
      if (m.unit !== "organisasi") return "kualitatif-deskriptif";
      // Studi kasus menuntut lebih dari satu jenis bukti pada satu kasus.
      // Bila datanya hanya wawancara, yang jujur disebut adalah deskriptif
      // kualitatif, dan itu justru lebih ringan dikerjakan.
      if (m.data.length >= 3 && m.data.includes("observasi")) return "studi-kasus";
      return pem ? "strategi-pemerintah" : "strategi-komunikasi";
    case "gambaran":
      if (pem) return m.data.includes("kuesioner") ? "kuantitatif-deskriptif" : "governance";
      return m.data.includes("kuesioner") ? "kuantitatif-deskriptif" : "kualitatif-deskriptif";
  }
}

function bangunAnalisis(jenis: Jenis, m: Masukan): Analisis[] {
  switch (jenis) {
    case "kuantitatif-eksplanatif":
      return [
        { nama: "Uji validitas dan reliabilitas instrumen", syarat: "Dijalankan lebih dulu pada 30 responden uji coba. Cronbach's Alpha minimal 0,70." },
        { nama: "Uji asumsi klasik", syarat: "Normalitas, multikolinearitas, heteroskedastisitas. Wajib sebelum regresi." },
        { nama: "Regresi linier sederhana atau berganda", syarat: "Minimal 30 responden; untuk regresi berganda tambahkan sekitar 20 responden per variabel bebas." },
        { nama: "Uji t dan uji F, koefisien determinasi", syarat: "Uji t untuk pengaruh tiap variabel, uji F untuk pengaruh serentak." },
      ];
    case "kuantitatif-korelasional":
      return [
        { nama: "Uji validitas dan reliabilitas instrumen", syarat: "Cronbach's Alpha minimal 0,70." },
        { nama: "Korelasi Pearson atau Rank Spearman", syarat: "Pearson bila data interval dan normal; Spearman bila ordinal atau tidak normal. Minimal 30 responden." },
      ];
    case "kuantitatif-komparatif":
      return [
        { nama: "Uji normalitas dan homogenitas", syarat: "Menentukan uji beda mana yang sah dipakai." },
        { nama: "Uji t sampel bebas atau Mann-Whitney", syarat: "Minimal 30 responden per kelompok yang dibandingkan." },
        { nama: "ANOVA bila kelompoknya lebih dari dua", syarat: "Disertai uji lanjut bila hasilnya signifikan." },
      ];
    case "kuantitatif-deskriptif":
      return [
        { nama: "Distribusi frekuensi dan persentase", syarat: "Disajikan per indikator, bukan hanya per variabel." },
        { nama: "Rata-rata dan skor interval kategori", syarat: "Tetapkan rentang kategorinya di bab metode, bukan setelah melihat hasil." },
      ];
    case "analisis-isi":
      return [
        { nama: "Lembar koding dengan kategori yang saling terpisah", syarat: "Kategori disusun sebelum koding dan tidak boleh tumpang tindih." },
        { nama: "Uji reliabilitas antar-koder", syarat: "Wajib. Holsti minimal 0,75 atau Krippendorff's Alpha minimal 0,80, dengan koder kedua di luar peneliti." },
        { nama: "Distribusi frekuensi kategori", syarat: "Sebutkan unit analisis dan unit pencatatannya secara tegas." },
      ];
    case "uses-gratifications":
      return [
        { nama: "Uji validitas dan reliabilitas butir motif", syarat: "Tiap motif diwakili beberapa butir. Cronbach's Alpha minimal 0,70 per motif, bukan hanya untuk seluruh kuesioner." },
        { nama: "Distribusi frekuensi dan rata-rata tiap motif", syarat: "Disajikan per motif, lalu diurutkan dari yang paling tinggi." },
        { nama: "Uji beda motif yang dicari dan kepuasan yang diperoleh", syarat: "Hanya bila memakai model GS dan GO. Uji t berpasangan pada responden yang sama." },
      ];
    case "efektivitas-program":
      return [
        { nama: "Uji validitas dan reliabilitas instrumen", syarat: "Cronbach's Alpha minimal 0,70." },
        { nama: "Skor capaian per indikator efektivitas", syarat: "Indikatornya diturunkan dari model yang dipilih, bukan dikarang sendiri." },
        { nama: "Pembandingan skor dengan rentang kategori", syarat: "Rentang kategori (sangat efektif sampai tidak efektif) ditetapkan di bab metode, bukan setelah melihat hasil." },
      ];
    case "analisis-framing":
      return [
        { nama: "Perangkat framing yang dipilih secara tegas", syarat: "Sebut satu model: Entman, Pan dan Kosicki, atau Gamson. Jangan mencampur tanpa alasan." },
        { nama: "Analisis tiap berita pada seluruh perangkat model itu", syarat: "Satu tabel untuk satu berita, dengan kutipan teksnya. Jangan hanya menyimpulkan." },
        { nama: "Pembandingan bingkai antar media atau antar periode", syarat: "Inilah temuan utamanya. Tanpa pembandingan, hasilnya hanya ringkasan berita." },
      ];
    case "semiotika":
      return [
        { nama: "Pemilihan potongan tanda yang dianalisis", syarat: "Sebutkan alasan tiap potongan dipilih: menit ke berapa, adegan mana, unsur visual apa." },
        { nama: "Analisis pada tiap tataran model yang dipakai", syarat: "Barthes: denotasi, konotasi, mitos. Peirce: representamen, objek, interpretan. Lampirkan gambarnya." },
        { nama: "Penafsiran yang ditopang teori, bukan pendapat", syarat: "Tiap makna konotatif dikaitkan dengan konsep yang sudah dibahas di bab dua." },
      ];
    case "implementasi-kebijakan":
      return [
        { nama: "Analisis per aspek model yang dipilih", syarat: "Edward III: komunikasi, sumber daya, disposisi, struktur birokrasi. Tiap aspek satu subbab temuan." },
        { nama: "Model Miles dan Huberman", syarat: "Reduksi data, penyajian data, penarikan kesimpulan dan verifikasi." },
        { nama: "Pembandingan pelaksanaan dengan bunyi kebijakannya", syarat: "Kutip pasal atau butir aturannya, lalu tunjukkan pelaksanaannya di lapangan." },
      ];
    case "analisis-kebijakan":
      return [
        { nama: "Analisis menurut tahap model yang dipilih", syarat: "Dunn: perumusan masalah, peramalan, rekomendasi, pemantauan, evaluasi. Pilih tahap mana yang diteliti, jangan seluruhnya." },
        { nama: "Telaah dokumen kebijakan secara utuh", syarat: "Naskah kebijakannya dilampirkan, dan tiap kutipan disebutkan pasal atau halamannya." },
        { nama: "Pengodean tematik atas keterangan pemangku kepentingan", syarat: "Kode terbuka lalu dikelompokkan menjadi tema." },
      ];
    case "peran-pemerintah":
    case "governance":
    case "strategi-pemerintah":
    case "strategi-komunikasi":
      return [
        { nama: "Analisis per aspek model yang dipilih", syarat: "Tiap aspek model menjadi satu subbab temuan, sehingga hasilnya tidak berupa cerita berurutan waktu." },
        { nama: "Model Miles dan Huberman", syarat: "Reduksi data, penyajian data, penarikan kesimpulan dan verifikasi." },
        { nama: "Pengodean tematik", syarat: "Kode terbuka lalu dikelompokkan menjadi tema. Lampirkan contoh kutipannya." },
      ];
    case "fenomenologi":
      return [
        { nama: "Reduksi data dan horizonalisasi", syarat: "Pernyataan penting informan dikumpulkan tanpa penilaian lebih dulu." },
        { nama: "Perumusan makna tekstural dan struktural", syarat: "Berakhir pada deskripsi esensi pengalaman, bukan daftar tema." },
      ];
    case "studi-kasus":
      return [
        { nama: "Analisis tematik atau model Miles dan Huberman", syarat: "Reduksi data, penyajian data, penarikan kesimpulan." },
        { nama: "Penjodohan pola dengan teori", syarat: "Bandingkan pola temuan dengan pola yang diramalkan teori." },
      ];
    case "kualitatif-deskriptif":
      return [
        { nama: "Model Miles dan Huberman", syarat: "Reduksi data, penyajian data, penarikan kesimpulan dan verifikasi." },
        { nama: "Pengodean tematik", syarat: "Kode terbuka lalu dikelompokkan menjadi tema. Lampirkan contoh kutipannya." },
      ];
  }
}

function bangunSampling(jenis: Jenis, m: Masukan) {
  if (kuantitatif(jenis)) {
    const acak = m.jumlahPopulasi > 0
      ? { nama: "Simple random sampling", alasan: "Populasi Anda terhitung, jadi peluang tiap anggota dapat disamakan. Ini yang paling kuat untuk menggeneralisasi." }
      : { nama: "Purposive sampling", alasan: "Dipakai bila kerangka sampel tidak tersedia. Sebutkan kriterianya secara tegas dan akui keterbatasan generalisasinya." };
    return [
      acak,
      { nama: "Stratified random sampling", alasan: "Bila populasi Anda berlapis (angkatan, kelas, wilayah) dan lapisan itu diduga berbeda." },
      { nama: "Accidental sampling", alasan: "Paling mudah, paling lemah. Hanya bila cara lain benar-benar tertutup, dan sebutkan itu sebagai keterbatasan." },
    ];
  }
  if (berbahanTeks(jenis)) {
    return [
      { nama: "Total sampling pada periode tertentu", alasan: "Seluruh teks dalam rentang waktu diambil. Tetapkan rentangnya beserta alasannya." },
      { nama: "Purposive sampling teks", alasan: "Pilih teks berdasarkan kriteria yang Anda tetapkan lebih dulu, bukan yang kebetulan menarik." },
    ];
  }
  return [
    { nama: "Purposive sampling", alasan: "Informan dipilih karena memang mengalami atau menguasai persoalannya, bukan karena mudah ditemui." },
    { nama: "Snowball sampling", alasan: "Bila informan awal sulit ditemukan dan mereka dapat menunjuk yang berikutnya." },
    { nama: "Berhenti pada titik jenuh", alasan: "Penambahan informan dihentikan ketika keterangan baru tidak lagi muncul. Nyatakan di bab metode." },
  ];
}

function bangunTeori(m: Masukan): string[] {
  if (m.prodi === "komunikasi") {
    const peta: Partial<Record<Tujuan, string[]>> = {
      pengaruh: ["Stimulus-Organism-Response", "Uses and Gratifications", "Elaboration Likelihood Model", "Teori Kultivasi"],
      hubungan: ["Uses and Gratifications", "Teori Kultivasi", "Media Dependency"],
      isi: ["Agenda Setting", "Framing (Entman, Pan dan Kosicki)", "Teori Konstruksi Realitas Sosial"],
      makna: ["Interaksionisme Simbolik", "Konstruksi Realitas Sosial (Berger dan Luckmann)", "Fenomenologi Schutz"],
      proses: ["Difusi Inovasi", "Teori Manajemen Kesan", "Public Relations Excellence"],
      perbedaan: ["Uses and Gratifications", "Teori Kesenjangan Pengetahuan"],
      gambaran: ["Literasi Media", "Uses and Gratifications"],
      evaluasi: ["Model Komunikasi Program", "Teori Efektivitas Komunikasi"],
    };
    return peta[m.tujuan] ?? ["Teori Komunikasi Massa"];
  }
  if (m.prodi === "pemerintahan") {
    const peta: Partial<Record<Tujuan, string[]>> = {
      pengaruh: ["Kinerja Organisasi Publik", "New Public Management", "Teori Akuntabilitas"],
      hubungan: ["Good Governance", "Teori Partisipasi Masyarakat"],
      isi: ["Analisis Kebijakan (Dunn)", "Framing Kebijakan"],
      makna: ["Street-Level Bureaucracy (Lipsky)", "Konstruksi Sosial Kebijakan"],
      proses: ["Teori Implementasi Kebijakan", "Street-Level Bureaucracy (Lipsky)", "Collaborative Governance"],
      perbedaan: ["Desentralisasi dan Otonomi Daerah", "Kapasitas Pemerintah Daerah"],
      gambaran: ["Pelayanan Publik", "E-Government"],
      evaluasi: ["Evaluasi Kebijakan (Dunn)", "Model CIPP", "Teori Efektivitas Program"],
    };
    return peta[m.tujuan] ?? ["Teori Administrasi Publik"];
  }
  return ["Diskusikan kerangka teori dengan dosen pembimbing sesuai peminatan Anda."];
}

/**
 * Kapitalisasi judul menurut PUEBI: setiap kata diawali huruf kapital,
 * kecuali kata tugas (di, ke, dari, dan, pada, terhadap, dalam, untuk, yang)
 * yang tidak berada di awal judul.
 *
 * Dua bentuk dibiarkan apa adanya: akronim yang seluruhnya kapital (KPU,
 * UMKM), dan nama yang huruf kapitalnya berada di tengah (TikTok, YouTube,
 * WhatsApp). Tanpa pengecualian kedua, judul skripsi tentang media sosial
 * akan tercetak "Tiktok", dan itu langsung terbaca sebagai salah ketik.
 */
export function kapitalJudul(judul: string): string {
  // Bagian dalam kurung siku adalah isian yang harus dilengkapi mahasiswa,
  // bukan bagian judul. Dikapitalkan, ia berhenti terbaca sebagai perintah.
  if (judul.includes("[")) {
    return judul
      .split(/(\[[^\]]*\])/)
      .map((bagian) => (bagian.startsWith("[") ? bagian : kapitalJudul(bagian)))
      .join("");
  }

  const tugas = new Set([
    "di", "ke", "dari", "dan", "atau", "pada", "terhadap", "dalam", "untuk",
    "yang", "dengan", "antara", "bagi", "sebagai", "oleh", "serta", "melalui",
  ]);
  return judul
    .split(" ")
    .map((kata, i) => {
      if (!kata) return kata;
      if (kata === kata.toUpperCase() && /[A-Z]/.test(kata)) return kata;
      if (/\p{Lu}/u.test(kata.slice(1))) return kata.charAt(0).toUpperCase() + kata.slice(1);
      const kecil = kata.toLowerCase();
      if (i > 0 && tugas.has(kecil.replace(/[^a-z]/g, ""))) return kecil;
      return kecil.charAt(0).toUpperCase() + kecil.slice(1);
    })
    .join(" ");
}

/** Buang kata pembuka yang sudah disebut nama rancangannya, supaya judulnya
 *  tidak berbunyi "Implementasi Kebijakan Kebijakan Penanganan Sampah". */
function tanpaAwalan(teks: string, awalan: RegExp): string {
  return teks.replace(awalan, "").trim() || teks;
}

function bangunJudul(jenis: Jenis, m: Masukan): string[] {
  const X = m.variabelX.trim() || "variabel bebas";
  const Ymentah = m.variabelY.trim();
  const Omentah = m.objek.trim();
  // Nama pengganti hanya dipakai pada rancangan yang judulnya memang tidak
  // berbunyi tanpa bagian itu. Pada rancangan lain, bagian yang belum
  // disebut ceritanya lebih baik dihilangkan daripada dicetak sebagai
  // "Variabel Terikat", yang terbaca sebagai judul yang belum jadi.
  const Y = Ymentah || "variabel terikat";
  const O = Omentah || "objek penelitian";
  const L = m.lokasi.trim();
  const di = L ? ` di ${L}` : "";
  const pada = Omentah ? ` pada ${Omentah}` : "";
  const dalamY = Ymentah ? ` dalam ${Ymentah}` : "";

  // Judul model dua sebab dan model jalur ditulis lengkap. Menyebut satu
  // variabel bebas saja pada penelitian yang menguji dua akan membuat judul
  // berselisih dengan bagan kerangka berpikir dan dengan hipotesisnya.
  const X2 = (m.variabelX2 ?? "").trim();
  const Z = (m.variabelZ ?? "").trim();
  const sebab = X2 ? `${X} dan ${X2}` : X;
  const lewat = Z ? ` melalui ${Z}` : "";

  switch (jenis) {
    case "kuantitatif-eksplanatif":
      return [
        `Pengaruh ${sebab} terhadap ${Y}${lewat}${pada}${di}`,
        Z
          ? `Pengaruh ${sebab} terhadap ${Y} dengan ${Z} sebagai Variabel Intervening${pada}${di}`
          : `Pengaruh ${sebab} terhadap ${Y}: Studi pada ${O}${di}`,
      ];
    case "kuantitatif-korelasional":
      return [`Hubungan antara ${sebab} dengan ${Y}${pada}${di}`, `Korelasi ${sebab} dan ${Y}${pada}${di}`];
    case "kuantitatif-komparatif":
      return [`Perbandingan ${Y} antara ${X}${di}`, `Studi Komparatif ${Y}${pada}${di}`];
    case "kuantitatif-deskriptif":
      return [`Gambaran ${X}${pada}${di}`, `Tingkat ${X}${pada}${di}`];
    case "uses-gratifications": {
      const U = tanpaAwalan(X, /^(?:motif\s+)?(?:penggunaan|pemakaian)\s+/i);
      return [`Motif Penggunaan ${U}${Ymentah ? ` terhadap Pemenuhan ${Ymentah}` : ""}${pada}${di}`, `Motif dan Kepuasan Penggunaan ${U}${pada}${di}`];
    }
    case "efektivitas-program": {
      const E = tanpaAwalan(X, /^efektivitas\s+/i);
      return [`Efektivitas ${E}${dalamY}${di}`, `Efektivitas ${E}${pada}${di}`];
    }
    case "analisis-isi": {
      const I = tanpaAwalan(X, /^(?:analisis\s+)?isi\s+/i);
      return [`Analisis Isi ${I}${dalamY}${di}`, `Analisis Isi Pemberitaan ${I}${di}`];
    }
    case "analisis-framing": {
      const F = tanpaAwalan(X, /^(?:analisis\s+)?(?:framing|pemberitaan|berita)\s+/i);
      return [`Analisis Framing Pemberitaan ${F}${Ymentah ? ` pada ${Ymentah}` : ""}`, `Framing ${F}${dalamY}: Analisis Model Entman`];
    }
    case "semiotika": {
      const S = tanpaAwalan(X, /^(?:analisis\s+)?(?:semiotika|representasi)\s+/i);
      return [`Analisis Semiotika Representasi ${S}${dalamY}`, `Representasi ${S}${dalamY}: Analisis Semiotika Roland Barthes`];
    }
    case "fenomenologi":
      return [`Pengalaman ${O} dalam ${X}${di}`, `Makna ${X} bagi ${O}${di}`];
    case "studi-kasus":
      return [`${X}${pada}${di}: Studi Kasus`, `Strategi ${X}${dalamY}${di}`];
    case "kualitatif-deskriptif":
      return [`${X}${pada}${di}`, `Penerapan ${X}${pada}${di}`];
    case "strategi-komunikasi": {
      const K = tanpaAwalan(X, /^strategi\s+(?:komunikasi\s+)?/i);
      return [`Strategi Komunikasi ${O}${dalamY}${di}`, `Strategi Komunikasi ${O} pada ${K}${di}`];
    }
    case "implementasi-kebijakan": {
      const B = tanpaAwalan(X, /^(?:implementasi\s+)?kebijakan\s+/i);
      return [`Implementasi Kebijakan ${B}${dalamY}${di}`, `Implementasi Kebijakan ${B}${pada}${di}`];
    }
    case "peran-pemerintah": {
      // Pada cerita bertema peran, yang tertangkap sebagai gagasan utama
      // justru pelakunya: "peran pemerintah desa dalam pemberdayaan
      // masyarakat" memberi X berupa "pemerintah desa" dan Y berupa
      // kegiatannya. Kalau keduanya tidak ditukar, judulnya berbunyi "Peran
      // Masyarakat dalam Pemerintah Desa".
      const aktorDiX = /^(?:pemerintah|dinas|badan|kantor|kecamatan|kelurahan|desa|pemda|pemkot|pemkab|lurah|camat|kepala|bupati|wali kota|gubernur)\b/i.test(X);
      const aktor = aktorDiX ? X : O;
      const bidang = aktorDiX ? Ymentah : tanpaAwalan(X, /^peran\s+/i);
      return bidang
        ? [`Peran ${aktor} dalam ${bidang}${di}`, `Peran ${aktor} dalam ${bidang}${pada}${di}`]
        : [`Peran ${aktor}${di}`, `Peran ${aktor}${pada}${di}`];
    }
    case "analisis-kebijakan": {
      const A = tanpaAwalan(X, /^(?:analisis\s+)?kebijakan\s+/i);
      return [`Analisis Kebijakan ${A}${dalamY}${di}`, `Analisis Kebijakan ${A}${pada}${di}`];
    }
    case "governance": {
      const G = tanpaAwalan(X, /^(?:tata\s+kelola|governance)\s+/i);
      return [`Tata Kelola Pemerintahan dalam ${G}${pada}${di}`, `Penerapan Prinsip Good Governance dalam ${G}${di}`];
    }
    case "strategi-pemerintah": {
      const P = tanpaAwalan(X, /^strategi\s+/i);
      return [`Strategi ${O}${dalamY}${di}`, `Strategi ${O} dalam ${P}${di}`];
    }
  }
}

function bangunRumusan(jenis: Jenis, m: Masukan): string[] {
  const X = m.variabelX.trim() || "variabel bebas";
  const Y = m.variabelY.trim() || "variabel terikat";
  const Omentah = m.objek.trim();
  const O = Omentah || "objek penelitian";
  // Bagian yang belum disebut ceritanya lebih baik hilang daripada tercetak
  // sebagai "objek penelitian", yang membuat rumusan masalahnya terbaca
  // sebagai kalimat yang belum jadi.
  const padaO = Omentah ? ` pada ${Omentah}` : "";
  switch (jenis) {
    case "kuantitatif-eksplanatif": {
      const X2 = (m.variabelX2 ?? "").trim();
      const Z = (m.variabelZ ?? "").trim();
      const daftar = [`Apakah ${X} berpengaruh terhadap ${Y}${padaO}?`];
      if (X2) daftar.push(`Apakah ${X2} berpengaruh terhadap ${Y}${padaO}?`);
      if (Z) {
        daftar.push(`Apakah ${X}${X2 ? ` dan ${X2}` : ""} berpengaruh terhadap ${Z}${padaO}?`);
        daftar.push(`Apakah ${Z} berpengaruh terhadap ${Y}${padaO}?`);
        daftar.push(`Apakah ${X}${X2 ? ` dan ${X2}` : ""} berpengaruh terhadap ${Y} melalui ${Z}${padaO}?`);
      }
      if (X2) daftar.push(`Apakah ${X} dan ${X2} secara serentak berpengaruh terhadap ${Y}${padaO}?`);
      if (!X2 && !Z) daftar.push(`Seberapa besar pengaruh ${X} terhadap ${Y}${padaO}?`);
      return daftar;
    }
    case "kuantitatif-korelasional":
      return [`Apakah terdapat hubungan antara ${X} dengan ${Y}${padaO}?`];
    case "kuantitatif-komparatif":
      return [`Apakah terdapat perbedaan ${Y} antara kelompok yang dibandingkan?`];
    case "kuantitatif-deskriptif":
      return [`Bagaimana tingkat ${X}${padaO}?`];
    case "uses-gratifications":
      return [`Motif apa yang mendorong ${Omentah || "responden"} menggunakan ${X}?`, `Sejauh mana penggunaan ${X} memenuhi ${Y}${padaO}?`];
    case "efektivitas-program":
      return [`Sejauh mana ${X} mencapai sasaran yang ditetapkan${padaO}?`, `Faktor apa yang menghambat pencapaian ${X}?`];
    case "analisis-isi":
      return [`Bagaimana kecenderungan ${X} dalam ${Y}?`, `Kategori mana yang paling sering muncul dalam ${Y}?`];
    case "analisis-framing":
      return [`Bagaimana ${Y} membingkai ${X}?`, `Apa perbedaan bingkai yang dipakai pada tiap periode atau tiap media?`];
    case "semiotika":
      return [`Bagaimana ${X} direpresentasikan dalam ${Y}?`, `Makna apa yang terbangun di balik tanda yang dipakai?`];
    case "fenomenologi":
      return [`Bagaimana ${Omentah || "informan"} memaknai pengalaman ${X}?`];
    case "studi-kasus":
      return [`Bagaimana ${X} dijalankan${padaO}?`, `Apa saja hambatan yang dihadapi dalam menjalankan ${X}?`];
    case "kualitatif-deskriptif":
      return [`Bagaimana ${X} berlangsung${padaO}?`];
    case "strategi-komunikasi":
      return [`Bagaimana strategi komunikasi ${Omentah || "lembaga yang diteliti"} disusun dan dijalankan?`, `Apa saja hambatan yang dihadapi dalam menjalankannya?`];
    case "implementasi-kebijakan":
      return [`Bagaimana ${X} diimplementasikan${padaO || " di lapangan"}?`, `Faktor apa yang mendukung dan menghambat implementasinya?`];
    case "peran-pemerintah":
      return [`Bagaimana peran ${Omentah || "pemerintah"} dalam ${X}?`, `Apa saja hambatan yang dihadapi${Omentah ? ` ${Omentah}` : ""} dalam menjalankan peran tersebut?`];
    case "analisis-kebijakan":
      return [`Bagaimana isi kebijakan ${X} dirumuskan?`, `Apa saja persoalan yang muncul dalam pelaksanaannya?`];
    case "governance":
      return [`Bagaimana penerapan prinsip tata kelola pemerintahan dalam ${X}${padaO}?`, `Prinsip mana yang belum berjalan sebagaimana mestinya?`];
    case "strategi-pemerintah":
      return [`Bagaimana strategi ${Omentah || "lembaga yang diteliti"} dalam ${X} disusun dan dijalankan?`, `Apa saja hambatan yang dihadapi dalam menjalankannya?`];
  }
}

function bangunPeringatan(jenis: Jenis, m: Masukan): Peringatan[] {
  const p: Peringatan[] = [];
  const kuan = kuantitatif(jenis);

  // Ketidakcocokan paling mahal: pertanyaan sebab-akibat dengan alat yang
  // tidak dapat menjawabnya. Baru ketahuan saat sidang, sudah terlambat.
  if ((m.tujuan === "pengaruh" || m.tujuan === "hubungan") && !m.data.includes("kuesioner")) {
    p.push({
      berat: "hambat",
      judul: "Pertanyaan menuntut angka, tetapi belum ada cara mengumpulkannya",
      pesan:
        `Judul bertema ${m.tujuan === "pengaruh" ? "pengaruh" : "hubungan"} menuntut pengukuran pada banyak responden, lalu diuji secara statistik. Wawancara mendalam tidak dapat membuktikannya: sepuluh narasumber tidak menghasilkan koefisien yang sah.`,
      jalanKeluar:
        "Pilih salah satu: tambahkan kuesioner sebagai cara pengumpulan data, atau ubah tujuan menjadi makna, proses, atau gambaran yang memang dijawab dengan wawancara.",
    });
  }

  if (m.tujuan === "makna" && m.data.includes("kuesioner") && !m.data.includes("wawancara")) {
    p.push({
      berat: "hambat",
      judul: "Makna tidak dapat ditangkap kuesioner",
      pesan:
        "Fenomenologi mencari esensi pengalaman yang dihidupi. Pertanyaan tertutup memaksa jawaban ke dalam pilihan yang Anda susun sendiri, sehingga yang keluar adalah kategori Anda, bukan pengalaman informan.",
      jalanKeluar: "Tambahkan wawancara mendalam sebagai cara pengumpulan data utama.",
    });
  }

  if (m.unit === "teks" && (m.tujuan === "pengaruh" || m.tujuan === "perbedaan")) {
    p.push({
      berat: "hambat",
      judul: "Unit analisis dan tujuan tidak bertemu",
      pesan:
        "Unit analisis Anda adalah teks, tetapi tujuannya mengukur pengaruh atau perbedaan pada orang. Teks tidak dapat mengisi kuesioner, dan pengaruh pada pembaca tidak dapat disimpulkan dari isi teksnya saja.",
      jalanKeluar:
        "Pilih salah satu: ubah unit analisis menjadi orang (meneliti pembacanya), atau ubah tujuan menjadi isi pesan sehingga menjadi analisis isi.",
    });
  }

  if (kuan) {
    const perlu = jenis === "kuantitatif-komparatif" ? 60 : 30;
    if (m.perkiraanSampel > 0 && m.perkiraanSampel < perlu) {
      p.push({
        berat: "hambat",
        judul: `Sampel ${m.perkiraanSampel} responden belum mencukupi`,
        pesan:
          jenis === "kuantitatif-komparatif"
            ? "Uji beda menuntut sekitar 30 responden untuk tiap kelompok yang dibandingkan. Di bawah itu, uji statistiknya tidak dapat diandalkan."
            : "Analisis regresi dan korelasi menuntut minimal sekitar 30 responden. Di bawah itu, uji normalitas pun sering tidak dapat dipercaya.",
        jalanKeluar: `Perluas sasaran responden hingga minimal ${perlu}, atau ubah rancangan menjadi kualitatif deskriptif yang memang tidak menuntut jumlah besar.`,
      });
    }
    const anjuran = slovin(m.jumlahPopulasi);
    if (anjuran && m.perkiraanSampel > 0 && m.perkiraanSampel < anjuran) {
      p.push({
        berat: "periksa",
        judul: `Rumus Slovin menganjurkan ${anjuran} responden`,
        pesan:
          `Dengan populasi ${m.jumlahPopulasi.toLocaleString("id-ID")} dan taraf kesalahan 5%, Slovin menghasilkan ${anjuran} responden. Rencana Anda ${m.perkiraanSampel}.`,
        jalanKeluar: `Naikkan sasaran ke ${anjuran}, atau nyatakan taraf kesalahan 10% di bab metode beserta alasannya.`,
      });
    }
  }

  if (berbahanTeks(jenis) && !m.data.includes("dokumen")) {
    p.push({
      berat: "periksa",
      judul: "Rancangan ini menuntut teks yang dapat diarsipkan",
      pesan: "Teks yang dianalisis harus dapat ditunjukkan kembali kepada penguji, dan pada analisis isi juga kepada koder kedua.",
      jalanKeluar: "Centang dokumen atau arsip sebagai cara pengumpulan data, lalu simpan salinannya sejak awal.",
    });
  }

  // Lapis ketiga yang tidak disebut adalah sebab paling sering revisi pada
  // rancangan yang memakainya: naskah berisi "analisis framing" tanpa pernah
  // menyatakan framing model siapa, sehingga tabel temuannya tidak punya
  // bentuk yang dapat dinilai penguji.
  if (MODEL_PILIHAN[jenis].length > 0 && !kuan) {
    const model = MODEL_PILIHAN[jenis];
    const anjuran = model.find((k) => k.anjuran) ?? model[0];
    p.push({
      berat: "periksa",
      judul: `Sebut satu model ${METODE_POLA[jenis].toLowerCase()}, jangan hanya nama metodenya`,
      pesan:
        `${METODE_POLA[jenis]} bukan satu prosedur tunggal. Ada ${model.length} model yang lazim dipakai, dan tabel temuan Anda mengikuti model yang dipilih. Naskah yang hanya menulis nama metodenya akan ditanya "model siapa" pada menit pertama sidang.`,
      jalanKeluar: `Pilih satu dan sebutkan di bab metode. Untuk tingkat S1, ${anjuran.nama} yang paling ringkas dikerjakan.`,
    });
  }

  if (!kuan && m.data.length === 1 && m.data[0] === "dokumen") {
    p.push({
      berat: "periksa",
      judul: "Hanya satu sumber data",
      pesan: "Penelitian kualitatif menegakkan keabsahan lewat triangulasi. Dengan satu sumber, triangulasi sumber tidak dapat dilakukan.",
      jalanKeluar: "Tambahkan wawancara atau observasi, agar temuan dari dokumen dapat diperiksa silang.",
    });
  }

  if (jenis === "studi-kasus" || jenis === "fenomenologi") {
    p.push({
      berat: "periksa",
      judul: "Jangan menggeneralisasi pada bab kesimpulan",
      pesan:
        "Temuan berlaku untuk kasus dan informan yang Anda teliti. Kalimat seperti “masyarakat Indonesia cenderung…” akan langsung ditanyakan penguji.",
      jalanKeluar: "Batasi kesimpulan pada kasus yang diteliti, lalu nyatakan keterbatasan itu secara terbuka.",
    });
  }

  return p;
}

export function rancang(m: Masukan): Rancangan {
  const jenis = tentukanJenis(m);
  const kuan = kuantitatif(jenis);

  const populasi = m.unit === "teks" || berbahanTeks(jenis)
    ? `Seluruh ${m.variabelY.trim() || "teks"} pada rentang waktu yang Anda tetapkan${m.lokasi ? ` di ${m.lokasi}` : ""}.`
    : `Seluruh ${m.objek.trim() || "anggota populasi"}${m.lokasi ? ` di ${m.lokasi}` : ""}${m.jumlahPopulasi > 0 ? `, sebanyak ${m.jumlahPopulasi.toLocaleString("id-ID")} orang.` : "."}`;

  const pengumpulan: string[] = [];
  if (m.data.includes("kuesioner")) pengumpulan.push("Kuesioner tertutup dengan skala Likert, disebar setelah uji validitas dan reliabilitas.");
  if (m.data.includes("wawancara")) pengumpulan.push("Wawancara mendalam semiterstruktur dengan pedoman wawancara yang dilampirkan.");
  if (m.data.includes("dokumen")) pengumpulan.push("Dokumentasi: arsip, laporan resmi, pemberitaan, atau unggahan yang disimpan salinannya.");
  if (m.data.includes("observasi")) pengumpulan.push("Observasi dengan catatan lapangan bertanggal.");
  if (pengumpulan.length === 0) pengumpulan.push("Belum ada cara pengumpulan data yang dipilih. Bagian ini wajib ada di bab metode.");

  // Keabsahan pada rancangan berbahan teks tidak sama dengan keduanya:
  // tidak ada responden untuk diuji Cronbach dan tidak ada informan untuk
  // member check. Yang menegakkannya adalah kesepakatan pembaca kedua.
  const keabsahan = jenis === "analisis-isi"
    ? ["Uji reliabilitas antar-koder: Holsti minimal 0,75 atau Krippendorff's Alpha minimal 0,80.", "Koder kedua di luar peneliti, dengan lembar koding yang sama.", "Lembar koding dan seluruh teks yang dikoding dilampirkan."]
    : berbahanTeks(jenis)
      ? ["Ketekunan pengamatan: teks dibaca berulang sebelum ditafsirkan.", "Pembacaan silang oleh pembaca kedua atas potongan yang sama.", "Seluruh potongan teks yang ditafsirkan dilampirkan apa adanya."]
      : kuan
        ? ["Uji validitas butir (korelasi item-total).", "Uji reliabilitas Cronbach's Alpha minimal 0,70.", "Uji asumsi klasik sebelum uji hipotesis."]
        : ["Triangulasi sumber: bandingkan keterangan antar informan.", "Triangulasi teknik: bandingkan hasil wawancara dengan dokumen dan observasi.", "Member check: kembalikan hasil analisis kepada informan untuk dikonfirmasi."];

  const tujuanTulis = bangunRumusan(jenis, m).map((r) =>
    r.replace(/^Apakah\s+/i, "Untuk mengetahui apakah ")
     .replace(/^Bagaimana\s+/i, "Untuk mendeskripsikan bagaimana ")
     .replace(/^Seberapa besar\s+/i, "Untuk mengukur seberapa besar ")
     .replace(/^Sejauh mana\s+/i, "Untuk menilai sejauh mana ")
     .replace(/^Kategori mana\s+/i, "Untuk mengetahui kategori mana ")
     .replace(/^Apa saja\s+/i, "Untuk mengidentifikasi apa saja ")
     .replace(/\?$/, "."));

  return {
    jenis,
    pendekatan: PENDEKATAN[jenis],
    metodePola: METODE_POLA[jenis],
    model: MODEL_PILIHAN[jenis],
    kesulitan: KESULITAN[jenis],
    paradigma: jenis === "analisis-isi"
      ? "Positivisme pada bahan teks. Kategori ditetapkan lebih dulu, lalu kemunculannya dihitung; keandalannya ditegakkan lewat kesepakatan antar koder, bukan lewat uji statistik pada responden."
      : kuan
        ? "Positivisme. Kenyataan dianggap terukur, dan kesimpulan ditarik dari uji statistik atas data yang dikumpulkan secara sistematis."
        : "Konstruktivisme atau interpretivisme. Kenyataan dipahami sebagai hasil pemaknaan, dan kesimpulan ditarik dari penafsiran yang ditopang data lapangan.",
    populasi,
    sampling: bangunSampling(jenis, m),
    pengumpulan,
    analisis: bangunAnalisis(jenis, m),
    keabsahan,
    judul: bangunJudul(jenis, m).map(kapitalJudul),
    rumusan: bangunRumusan(jenis, m),
    tujuanTulis,
    teori: bangunTeori(m),
    peringatan: bangunPeringatan(jenis, m),
    sampelDisarankan: kuan ? slovin(m.jumlahPopulasi) : null,
  };
}
