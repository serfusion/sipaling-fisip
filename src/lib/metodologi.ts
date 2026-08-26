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

export type Jenis =
  | "kuantitatif-eksplanatif" | "kuantitatif-korelasional" | "kuantitatif-komparatif"
  | "kuantitatif-deskriptif" | "kualitatif-deskriptif" | "fenomenologi"
  | "studi-kasus" | "analisis-isi" | "analisis-wacana" | "evaluasi-program";

export const JENIS_LABEL: Record<Jenis, string> = {
  "kuantitatif-eksplanatif": "Kuantitatif eksplanatif (asosiatif kausal)",
  "kuantitatif-korelasional": "Kuantitatif korelasional",
  "kuantitatif-komparatif": "Kuantitatif komparatif",
  "kuantitatif-deskriptif": "Kuantitatif deskriptif",
  "kualitatif-deskriptif": "Kualitatif deskriptif",
  fenomenologi: "Kualitatif fenomenologi",
  "studi-kasus": "Kualitatif studi kasus",
  "analisis-isi": "Analisis isi kuantitatif",
  "analisis-wacana": "Analisis wacana atau semiotika",
  "evaluasi-program": "Penelitian evaluasi",
};

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

const KUANTITATIF: Jenis[] = [
  "kuantitatif-eksplanatif", "kuantitatif-korelasional",
  "kuantitatif-komparatif", "kuantitatif-deskriptif", "analisis-isi",
];

export function kuantitatif(jenis: Jenis) {
  return KUANTITATIF.includes(jenis);
}

/** Rumus Slovin, yang dipakai hampir semua skripsi Indonesia untuk populasi diketahui. */
export function slovin(populasi: number, galat = 0.05) {
  if (!populasi || populasi <= 0) return null;
  return Math.ceil(populasi / (1 + populasi * galat * galat));
}

function tentukanJenis(m: Masukan): Jenis {
  if (m.unit === "teks") {
    // Teks dapat dikerjakan dua arah. Yang menentukan adalah apakah yang
    // dicari frekuensi (dihitung) atau makna (ditafsirkan).
    return m.tujuan === "isi" || m.tujuan === "gambaran" ? "analisis-isi" : "analisis-wacana";
  }
  switch (m.tujuan) {
    case "pengaruh": return "kuantitatif-eksplanatif";
    case "hubungan": return "kuantitatif-korelasional";
    case "perbedaan": return "kuantitatif-komparatif";
    case "isi": return "analisis-isi";
    case "makna": return "fenomenologi";
    case "proses": return m.unit === "organisasi" ? "studi-kasus" : "kualitatif-deskriptif";
    case "evaluasi": return "evaluasi-program";
    case "gambaran":
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
    case "analisis-wacana":
      return [
        { nama: "Perangkat analisis yang dipilih secara tegas", syarat: "Sebut satu: Van Dijk, Fairclough, Roland Barthes, atau Charles Sanders Peirce. Jangan mencampur tanpa alasan." },
        { nama: "Analisis pada tiap tataran perangkat tersebut", syarat: "Tunjukkan potongan teksnya, jangan hanya menyimpulkan." },
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
    case "evaluasi-program":
      return [
        { nama: "Model evaluasi yang dipilih tegas", syarat: "Sebut satu: CIPP, Kirkpatrick, atau kriteria efektivitas program yang sudah baku." },
        { nama: "Pembandingan capaian dengan tolok ukur", syarat: "Tolok ukurnya harus dari dokumen resmi program, bukan ditetapkan sendiri." },
      ];
  }
}

function bangunSampling(jenis: Jenis, m: Masukan) {
  if (kuantitatif(jenis) && jenis !== "analisis-isi") {
    const acak = m.jumlahPopulasi > 0
      ? { nama: "Simple random sampling", alasan: "Populasi Anda terhitung, jadi peluang tiap anggota dapat disamakan. Ini yang paling kuat untuk menggeneralisasi." }
      : { nama: "Purposive sampling", alasan: "Dipakai bila kerangka sampel tidak tersedia. Sebutkan kriterianya secara tegas dan akui keterbatasan generalisasinya." };
    return [
      acak,
      { nama: "Stratified random sampling", alasan: "Bila populasi Anda berlapis (angkatan, kelas, wilayah) dan lapisan itu diduga berbeda." },
      { nama: "Accidental sampling", alasan: "Paling mudah, paling lemah. Hanya bila cara lain benar-benar tertutup, dan sebutkan itu sebagai keterbatasan." },
    ];
  }
  if (jenis === "analisis-isi" || jenis === "analisis-wacana") {
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
      isi: ["Framing (Entman, Pan dan Kosicki)", "Agenda Setting", "Analisis Semiotika Barthes atau Peirce"],
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
      proses: ["Implementasi Kebijakan (Van Meter dan Van Horn, Edwards III, Grindle)", "Collaborative Governance"],
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
 * yang tidak berada di awal judul. Akronim yang sudah kapital dibiarkan utuh.
 */
export function kapitalJudul(judul: string) {
  const tugas = new Set([
    "di", "ke", "dari", "dan", "atau", "pada", "terhadap", "dalam", "untuk",
    "yang", "dengan", "antara", "bagi", "sebagai", "oleh", "serta",
  ]);
  return judul
    .split(" ")
    .map((kata, i) => {
      if (!kata) return kata;
      if (kata === kata.toUpperCase() && /[A-Z]/.test(kata)) return kata;
      const kecil = kata.toLowerCase();
      if (i > 0 && tugas.has(kecil.replace(/[^a-z]/g, ""))) return kecil;
      return kecil.charAt(0).toUpperCase() + kecil.slice(1);
    })
    .join(" ");
}

function bangunJudul(jenis: Jenis, m: Masukan): string[] {
  const X = m.variabelX.trim() || "variabel bebas";
  const Y = m.variabelY.trim() || "variabel terikat";
  const O = m.objek.trim() || "objek penelitian";
  const L = m.lokasi.trim();
  const di = L ? ` di ${L}` : "";
  const pada = O ? ` pada ${O}` : "";

  switch (jenis) {
    case "kuantitatif-eksplanatif":
      return [
        `Pengaruh ${X} terhadap ${Y}${pada}${di}`,
        `Pengaruh ${X} terhadap ${Y}: Studi pada ${O}${di}`,
      ];
    case "kuantitatif-korelasional":
      return [`Hubungan antara ${X} dengan ${Y}${pada}${di}`, `Korelasi ${X} dan ${Y}${pada}${di}`];
    case "kuantitatif-komparatif":
      return [`Perbandingan ${Y} antara ${X}${di}`, `Studi Komparatif ${Y}${pada}${di}`];
    case "kuantitatif-deskriptif":
      return [`Gambaran ${X}${pada}${di}`, `Tingkat ${X}${pada}${di}`];
    case "analisis-isi":
      return [`Analisis Isi ${X} dalam ${Y}${di}`, `Analisis Isi Pemberitaan ${X}${di}`];
    case "analisis-wacana":
      return [`Analisis Wacana ${X} dalam ${Y}`, `Representasi ${X} dalam ${Y}: Analisis Semiotika`];
    case "fenomenologi":
      return [`Pengalaman ${O} dalam ${X}${di}`, `Makna ${X} bagi ${O}${di}`];
    case "studi-kasus":
      return [`Strategi ${X} dalam ${Y}${di}`, `${X} pada ${O}${di}: Studi Kasus`];
    case "kualitatif-deskriptif":
      return [`${X} pada ${O}${di}`, `Penerapan ${X}${pada}${di}`];
    case "evaluasi-program":
      return [`Evaluasi ${X}${di}`, `Efektivitas ${X} dalam ${Y}${di}`];
  }
}

function bangunRumusan(jenis: Jenis, m: Masukan): string[] {
  const X = m.variabelX.trim() || "variabel bebas";
  const Y = m.variabelY.trim() || "variabel terikat";
  const O = m.objek.trim() || "objek penelitian";
  switch (jenis) {
    case "kuantitatif-eksplanatif":
      return [`Apakah ${X} berpengaruh terhadap ${Y} pada ${O}?`, `Seberapa besar pengaruh ${X} terhadap ${Y} pada ${O}?`];
    case "kuantitatif-korelasional":
      return [`Apakah terdapat hubungan antara ${X} dengan ${Y} pada ${O}?`];
    case "kuantitatif-komparatif":
      return [`Apakah terdapat perbedaan ${Y} antara kelompok yang dibandingkan?`];
    case "kuantitatif-deskriptif":
      return [`Bagaimana tingkat ${X} pada ${O}?`];
    case "analisis-isi":
      return [`Bagaimana kecenderungan ${X} dalam ${Y}?`, `Kategori mana yang paling sering muncul dalam ${Y}?`];
    case "analisis-wacana":
      return [`Bagaimana ${X} diwacanakan dalam ${Y}?`];
    case "fenomenologi":
      return [`Bagaimana ${O} memaknai pengalaman ${X}?`];
    case "studi-kasus":
      return [`Bagaimana ${X} dijalankan pada ${O}?`, `Apa saja hambatan yang dihadapi dalam menjalankan ${X}?`];
    case "kualitatif-deskriptif":
      return [`Bagaimana ${X} berlangsung pada ${O}?`];
    case "evaluasi-program":
      return [`Sejauh mana ${X} mencapai sasaran yang ditetapkan?`, `Faktor apa yang menghambat pencapaian ${X}?`];
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

  if (kuan && jenis !== "analisis-isi") {
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

  if (jenis === "analisis-isi" && !m.data.includes("dokumen")) {
    p.push({
      berat: "periksa",
      judul: "Analisis isi menuntut dokumen yang dapat diarsipkan",
      pesan: "Teks yang dianalisis harus dapat ditunjukkan kembali kepada penguji dan kepada koder kedua.",
      jalanKeluar: "Centang dokumen atau arsip sebagai cara pengumpulan data, lalu simpan salinannya sejak awal.",
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

  const populasi = m.unit === "teks"
    ? `Seluruh ${m.variabelY.trim() || "teks"} pada rentang waktu yang Anda tetapkan${m.lokasi ? ` di ${m.lokasi}` : ""}.`
    : `Seluruh ${m.objek.trim() || "anggota populasi"}${m.lokasi ? ` di ${m.lokasi}` : ""}${m.jumlahPopulasi > 0 ? `, sebanyak ${m.jumlahPopulasi.toLocaleString("id-ID")} orang.` : "."}`;

  const pengumpulan: string[] = [];
  if (m.data.includes("kuesioner")) pengumpulan.push("Kuesioner tertutup dengan skala Likert, disebar setelah uji validitas dan reliabilitas.");
  if (m.data.includes("wawancara")) pengumpulan.push("Wawancara mendalam semiterstruktur dengan pedoman wawancara yang dilampirkan.");
  if (m.data.includes("dokumen")) pengumpulan.push("Dokumentasi: arsip, laporan resmi, pemberitaan, atau unggahan yang disimpan salinannya.");
  if (m.data.includes("observasi")) pengumpulan.push("Observasi dengan catatan lapangan bertanggal.");
  if (pengumpulan.length === 0) pengumpulan.push("Belum ada cara pengumpulan data yang dipilih. Bagian ini wajib ada di bab metode.");

  const keabsahan = kuan
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
    paradigma: kuan
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
    sampelDisarankan: kuan && jenis !== "analisis-isi" ? slovin(m.jumlahPopulasi) : null,
  };
}
