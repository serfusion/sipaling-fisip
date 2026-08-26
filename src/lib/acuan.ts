// ACUAN TIAP ALAT
//
// Mahasiswa berhak tahu dari mana kaidah sebuah alat berasal, dan dosen
// pembimbing berhak menolak temuan yang tidak dapat ditelusuri. Karena itu
// tiap menu mencantumkan acuannya, bukan sekadar menyatakan hasil.
//
// Yang dicantumkan hanya acuan yang benar-benar dipakai menyusun kaidah di
// dalam kode, bukan daftar bacaan yang membuat alat terlihat berwibawa.

export type Acuan = { sumber: string; untuk: string };

export type Kelompok = { alat: string; catatan: string; acuan: Acuan[] };

export const ACUAN: Record<string, Kelompok> = {
  judul: {
    alat: "Perumus Judul dan Metode",
    catatan:
      "Pemetaan tujuan penelitian ke jenis rancangan, syarat tiap teknik analisis, dan peringatan ketidakcocokan " +
      "disusun dari rujukan metodologi berikut.",
    acuan: [
      { sumber: "Creswell, J. W., & Creswell, J. D. (2018). Research Design: Qualitative, Quantitative, and Mixed Methods Approaches (5th ed.). SAGE.", untuk: "Pemilihan rancangan menurut jenis pertanyaan penelitian" },
      { sumber: "Sugiyono. (2019). Metode Penelitian Kuantitatif, Kualitatif, dan R&D. Alfabeta.", untuk: "Istilah dan tahapan yang lazim dipakai skripsi Indonesia" },
      { sumber: "Slovin, M. (1960), sebagaimana dikutip dalam Sevilla, C. G. dkk. (1993). Pengantar Metode Penelitian. UI Press.", untuk: "Rumus penentuan ukuran sampel dari populasi diketahui" },
      { sumber: "Green, S. B. (1991). How Many Subjects Does It Take To Do A Regression Analysis? Multivariate Behavioral Research, 26(3), 499-510.", untuk: "Ambang minimal responden untuk regresi berganda" },
      { sumber: "Moleong, L. J. (2018). Metodologi Penelitian Kualitatif. Remaja Rosdakarya.", untuk: "Triangulasi dan uji keabsahan data kualitatif" },
      { sumber: "Miles, M. B., Huberman, A. M., & Saldaña, J. (2014). Qualitative Data Analysis: A Methods Sourcebook (3rd ed.). SAGE.", untuk: "Reduksi data, penyajian data, penarikan kesimpulan" },
      { sumber: "Krippendorff, K. (2018). Content Analysis: An Introduction to Its Methodology (4th ed.). SAGE.", untuk: "Reliabilitas antar-koder pada analisis isi" },
    ],
  },

  referensi: {
    alat: "Cari Referensi",
    catatan:
      "Pencarian menuju katalog terbuka. Kalimat inti diambil apa adanya dari abstrak, tanpa disusun ulang mesin.",
    acuan: [
      { sumber: "OpenAlex (openalex.org), katalog terbuka karya ilmiah, dikelola OurResearch.", untuk: "Sumber pencarian artikel, jumlah sitasi, dan status akses terbuka" },
      { sumber: "Directory of Open Access Journals (doaj.org).", untuk: "Penanda jurnal yang lolos seleksi DOAJ" },
      { sumber: "American Psychological Association. (2020). Publication Manual of the APA (7th ed.).", untuk: "Susunan entri daftar pustaka gaya APA" },
    ],
  },

  kemiripan: {
    alat: "Cek Kemiripan dan Parafrase",
    catatan:
      "Alat ini tidak memiliki korpus berlangganan, sehingga tidak dapat dan tidak berusaha menyerupai Turnitin. " +
      "Yang diperiksa adalah sumber yang Anda tempel sendiri dan kelengkapan sitasi.",
    acuan: [
      { sumber: "American Psychological Association. (2020). Publication Manual of the APA (7th ed.), bab 8.", untuk: "Kewajiban nomor halaman pada kutipan langsung, dan kecocokan sitasi dengan daftar pustaka" },
      { sumber: "Howard, R. M. (1995). Plagiarisms, Authorships, and the Academic Death Penalty. College English, 57(7), 788-806.", untuk: "Patchwriting: tukar sinonim dengan susunan kalimat dipertahankan" },
      { sumber: "Council of Writing Program Administrators. (2003). Defining and Avoiding Plagiarism: The WPA Statement on Best Practices.", untuk: "Batas antara parafrase, kutipan, dan salinan" },
      { sumber: "Broder, A. Z. (1997). On the Resemblance and Containment of Documents. Compression and Complexity of Sequences.", untuk: "Sidik kata berurutan untuk mengukur kemiripan teks" },
    ],
  },

  sitasi: {
    alat: "Verifikasi Sitasi",
    catatan:
      "Tiap rujukan dicari di dua pangkalan data sekaligus, lalu kandidat terbaik dipilih secara pasti agar " +
      "pemeriksaan yang diulang menghasilkan putusan yang sama.",
    acuan: [
      { sumber: "Crossref (crossref.org), pangkalan data DOI dan metadata terbitan ilmiah.", untuk: "Pencocokan judul, tahun, dan penulis" },
      { sumber: "OpenAlex (openalex.org).", untuk: "Pemeriksaan silang bila Crossref tidak memuat karyanya" },
      { sumber: "Dice, L. R. (1945). Measures of the Amount of Ecologic Association Between Species. Ecology, 26(3), 297-302.", untuk: "Koefisien kemiripan judul" },
    ],
  },

  radar: {
    alat: "Radar Jurnal",
    catatan:
      "Penilaian risiko disusun dari prinsip yang disepakati bersama oleh empat lembaga penerbitan ilmiah, " +
      "bukan dari daftar hitam. Tiap sinyal ditampilkan beserta bobot dan buktinya agar dapat diperdebatkan.",
    acuan: [
      { sumber: "COPE, DOAJ, OASPA, & WAME. (2018). Principles of Transparency and Best Practice in Scholarly Publishing (3rd ed.).", untuk: "Dasar seluruh sinyal yang dinilai" },
      { sumber: "Directory of Open Access Journals (doaj.org).", untuk: "Status seleksi jurnal" },
      { sumber: "Crossref (crossref.org) dan OpenAlex (openalex.org).", untuk: "Riwayat terbitan, sebaran topik, dan kelengkapan metadata" },
      { sumber: "Grudniewicz, A. dkk. (2019). Predatory journals: no definition, no defence. Nature, 576, 210-212.", untuk: "Alasan alat ini memakai pita risiko, bukan pernyataan hitam-putih" },
    ],
  },

  bahasa: {
    alat: "Periksa Bahasa",
    catatan: "Pemeriksaan mengikuti pedoman ejaan resmi dan kamus baku, bukan selera penulis.",
    acuan: [
      { sumber: "Badan Pengembangan dan Pembinaan Bahasa. (2022). Ejaan Bahasa Indonesia yang Disempurnakan, Edisi V (ejaan.kemdikbud.go.id).", untuk: "Kata depan, huruf kapital, tanda baca, penulisan angka" },
      { sumber: "Kamus Besar Bahasa Indonesia Daring, Badan Bahasa (kbbi.kemdikbud.go.id).", untuk: "Bentuk baku kata dan kata berimbuhan" },
      { sumber: "Badan Pengembangan dan Pembinaan Bahasa. (2007). Pedoman Umum Pembentukan Istilah, Edisi Ketiga.", untuk: "Istilah serapan bidang ilmu" },
    ],
  },

  struktur: {
    alat: "Struktur Naskah",
    catatan: "Pemetaan bab skripsi ke bagian artikel jurnal mengikuti pola yang dipakai jurnal ilmu sosial.",
    acuan: [
      { sumber: "Swales, J. M. (1990). Genre Analysis: English in Academic and Research Settings. Cambridge University Press.", untuk: "Model CARS untuk menyusun Introduction" },
      { sumber: "American Psychological Association. (2020). Publication Manual of the APA (7th ed.), bab 3.", untuk: "Susunan IMRaD dan porsi tiap bagian" },
      { sumber: "Sollaci, L. B., & Pereira, M. G. (2004). The introduction, methods, results, and discussion (IMRAD) structure. Journal of the Medical Library Association, 92(3), 364-367.", untuk: "Asal usul dan penerapan IMRaD" },
    ],
  },

  inggris: {
    alat: "Naskah Inggris",
    catatan:
      "Bank frasa memuat rumusan baku yang paling sering muncul pada skripsi Indonesia beserta padanan yang " +
      "lazim dipakai jurnal berbahasa Inggris. Ini bukan penerjemah otomatis.",
    acuan: [
      { sumber: "Swales, J. M., & Feak, C. B. (2012). Academic Writing for Graduate Students (3rd ed.). University of Michigan Press.", untuk: "Rumusan baku tiap bagian artikel" },
      { sumber: "Hyland, K. (2005). Metadiscourse: Exploring Interaction in Writing. Continuum.", untuk: "Kadar hedging dan klaim yang wajar di jurnal" },
      { sumber: "American Psychological Association. (2020). Publication Manual of the APA (7th ed.), bab 4.", untuk: "Ragam bahasa, kala, dan kalimat pasif" },
    ],
  },
};
