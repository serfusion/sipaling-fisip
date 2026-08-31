// VISUALISASI YANG SESUAI RANCANGAN
//
// Grafik yang keliru dipilih merusak temuan yang sebenarnya benar. Diagram
// lingkaran untuk sepuluh kategori tidak terbaca; grafik garis untuk data
// yang bukan deret waktu menyesatkan; dan penelitian kualitatif yang
// dipaksa berdiagram batang justru memperlihatkan bahwa penulisnya belum
// paham jenis datanya sendiri.
//
// Karena itu usulan di sini diturunkan dari jenis rancangan, bukan dari
// selera, dan sebagiannya justru menyarankan agar tidak memakai grafik.

import type { Jenis } from "./metodologi";

export type JenisGrafik =
  | "batang" | "batang-kelompok" | "garis" | "sebar" | "lingkaran"
  | "kotak" | "polar" | "matriks" | "jalur" | "tema" | "alur" | "tabel";

export type Usul = {
  grafik: JenisGrafik;
  nama: string;
  untuk: string;
  sumbu?: string;
  hati?: string;
  utama?: boolean;
};

export const GRAFIK_NAMA: Record<JenisGrafik, string> = {
  batang: "Diagram batang",
  "batang-kelompok": "Diagram batang berkelompok",
  garis: "Grafik garis",
  sebar: "Diagram sebar",
  lingkaran: "Diagram lingkaran",
  kotak: "Diagram kotak",
  polar: "Diagram polar",
  matriks: "Matriks korelasi",
  jalur: "Diagram jalur",
  tema: "Peta tema",
  alur: "Bagan alur",
  tabel: "Tabel",
};

const PETA: Record<Jenis, Usul[]> = {
  "kuantitatif-eksplanatif": [
    { grafik: "sebar", nama: "Diagram sebar dengan garis regresi", utama: true,
      untuk: "Memperlihatkan arah dan kekuatan pengaruh X terhadap Y pada tiap responden.",
      sumbu: "Sumbu datar: skor variabel bebas. Sumbu tegak: skor variabel terikat.",
      hati: "Satu titik satu responden. Jangan diganti grafik garis: data Anda bukan deret waktu." },
    { grafik: "jalur", nama: "Diagram jalur", utama: true,
      untuk: "Menampilkan koefisien tiap jalur hipotesis dalam satu bagan.",
      sumbu: "Tulis nilai koefisien dan taraf signifikansi pada tiap panah.",
      hati: "Bentuknya sama dengan kerangka berpikir Anda, hanya diisi angka hasil." },
    { grafik: "batang", nama: "Diagram batang per indikator",
      untuk: "Membandingkan skor rata-rata tiap indikator dalam satu variabel.",
      sumbu: "Sumbu datar: nama indikator. Sumbu tegak: skor rata-rata.",
      hati: "Mulai sumbu tegak dari nol, jika tidak perbedaannya terlihat berlebihan." },
  ],
  "kuantitatif-korelasional": [
    { grafik: "sebar", nama: "Diagram sebar", utama: true,
      untuk: "Memperlihatkan pola hubungan dua variabel apa adanya.",
      sumbu: "Sumbu datar dan tegak: dua variabel yang dikorelasikan.",
      hati: "Hubungan bukan sebab-akibat. Jangan menulis “memengaruhi” pada pembahasan." },
    { grafik: "matriks", nama: "Matriks korelasi", utama: true,
      untuk: "Menampilkan koefisien seluruh pasangan variabel sekaligus.",
      sumbu: "Baris dan kolom berisi nama variabel, sel berisi koefisien.",
      hati: "Tandai yang signifikan dengan asterisk, jangan hanya diwarnai." },
  ],
  "kuantitatif-komparatif": [
    { grafik: "batang-kelompok", nama: "Diagram batang berkelompok", utama: true,
      untuk: "Membandingkan rata-rata antar kelompok yang diuji.",
      sumbu: "Sumbu datar: kelompok. Sumbu tegak: rata-rata skor.",
      hati: "Sertakan galat baku sebagai garis kesalahan; tanpa itu perbedaannya tidak dapat dinilai." },
    { grafik: "kotak", nama: "Diagram kotak", utama: true,
      untuk: "Memperlihatkan sebaran dan pencilan tiap kelompok, bukan hanya rata-ratanya.",
      sumbu: "Sumbu datar: kelompok. Sumbu tegak: sebaran nilai.",
      hati: "Lebih jujur daripada batang karena memperlihatkan keragaman dalam kelompok." },
  ],
  "kuantitatif-deskriptif": [
    { grafik: "batang", nama: "Diagram batang frekuensi", utama: true,
      untuk: "Menampilkan sebaran jawaban tiap indikator.",
      sumbu: "Sumbu datar: kategori jawaban. Sumbu tegak: jumlah atau persentase.",
      hati: "Cantumkan jumlah responden pada keterangan gambar." },
    { grafik: "lingkaran", nama: "Diagram lingkaran",
      untuk: "Menampilkan komposisi ciri responden, misalnya jenis kelamin atau angkatan.",
      sumbu: "Tiap juring satu kategori, seluruhnya berjumlah seratus persen.",
      hati: "Hanya untuk dua sampai lima kategori. Lebih dari itu pakai diagram batang." },
    { grafik: "tabel", nama: "Tabel distribusi frekuensi",
      untuk: "Menyajikan angka tepat yang tidak terbaca dari grafik.",
      hati: "Wajib ada di lampiran walaupun grafiknya sudah ditampilkan." },
  ],
  "analisis-isi": [
    { grafik: "batang", nama: "Diagram batang frekuensi kategori", utama: true,
      untuk: "Menampilkan berapa kali tiap kategori muncul dalam korpus.",
      sumbu: "Sumbu datar: kategori koding. Sumbu tegak: jumlah kemunculan.",
      hati: "Urutkan dari yang terbanyak, jangan menurut abjad." },
    { grafik: "garis", nama: "Grafik garis tren waktu", utama: true,
      untuk: "Memperlihatkan perubahan kecenderungan pemberitaan sepanjang periode.",
      sumbu: "Sumbu datar: waktu. Sumbu tegak: jumlah kemunculan.",
      hati: "Hanya sah bila unit analisis Anda memang berurutan waktu." },
    { grafik: "polar", nama: "Diagram polar",
      untuk: "Membandingkan proporsi banyak kategori sekaligus dalam satu lingkaran.",
      hati: "Menarik dipandang, tetapi luas juring mudah salah dibaca. Sertakan angkanya." },
  ],
  "analisis-framing": [
    { grafik: "tabel", nama: "Tabel perangkat framing", utama: true,
      untuk: "Memasangkan tiap perangkat model yang dipakai dengan kutipan beritanya.",
      hati: "Satu tabel untuk satu berita. Inilah bentuk penyajian utama analisis framing." },
    { grafik: "tabel", nama: "Matriks perbandingan bingkai antar media", utama: true,
      untuk: "Menyilangkan media dengan bingkai yang dipakai, sehingga perbedaannya terlihat.",
      hati: "Tanpa pembandingan, hasilnya hanya ringkasan berita." },
    { grafik: "tema", nama: "Peta bingkai",
      untuk: "Menampilkan kaitan antar bingkai yang ditemukan.",
      hati: "Bukan grafik statistik. Tidak boleh dibaca sebagai frekuensi." },
  ],
  semiotika: [
    { grafik: "tabel", nama: "Tabel tataran tanda", utama: true,
      untuk: "Memasangkan tiap potongan tanda dengan denotasi, konotasi, dan mitosnya.",
      hati: "Lampirkan gambar atau tangkapan layarnya, jangan hanya deskripsi." },
    { grafik: "tema", nama: "Peta makna",
      untuk: "Menampilkan kaitan antar makna yang ditemukan pada beberapa tanda.",
      hati: "Bukan grafik statistik. Semiotika menafsirkan, tidak menghitung." },
  ],
  "uses-gratifications": [
    { grafik: "batang", nama: "Diagram batang peringkat motif", utama: true,
      untuk: "Membandingkan kekuatan tiap motif penggunaan media.",
      sumbu: "Sumbu datar: nama motif. Sumbu tegak: skor rata-rata.",
      hati: "Urutkan dari yang tertinggi, dan mulai sumbu tegak dari nol." },
    { grafik: "batang-kelompok", nama: "Diagram batang motif dicari dan kepuasan diperoleh", utama: true,
      untuk: "Menyandingkan motif yang dicari dengan kepuasan yang benar-benar diperoleh.",
      sumbu: "Sumbu datar: motif. Sumbu tegak: dua batang berdampingan.",
      hati: "Hanya sah bila keduanya diukur pada responden yang sama." },
    { grafik: "tabel", nama: "Tabel distribusi tiap butir motif",
      untuk: "Menyajikan angka tepat per butir yang tidak terbaca dari grafik.",
      hati: "Wajib ada di lampiran walaupun grafiknya sudah ditampilkan." },
  ],
  "strategi-komunikasi": [
    { grafik: "alur", nama: "Bagan tahap strategi", utama: true,
      untuk: "Menggambarkan urutan tahap strategi menurut model yang dipakai.",
      hati: "Nyatakan sumber tiap tahap: wawancara, dokumen, atau observasi." },
    { grafik: "tabel", nama: "Matriks tahap dan hambatan", utama: true,
      untuk: "Menyilangkan tiap tahap dengan hambatan yang ditemukan.",
      hati: "Kolom kosong menunjukkan tahap yang belum tergali." },
  ],
  "implementasi-kebijakan": [
    { grafik: "tabel", nama: "Matriks aspek model dan temuan", utama: true,
      untuk: "Menyilangkan tiap aspek model dengan keterangan pelaksana dan dokumennya.",
      hati: "Inilah bentuk penyajian utamanya. Tiap aspek satu baris, dengan kutipan." },
    { grafik: "alur", nama: "Bagan alur pelaksanaan", utama: true,
      untuk: "Menggambarkan jalannya kebijakan dari pusat sampai ke sasaran.",
      hati: "Tunjukkan di tahap mana pelaksanaannya tersendat." },
    { grafik: "polar", nama: "Diagram polar antar aspek",
      untuk: "Memperlihatkan aspek mana yang kuat dan mana yang tertinggal.",
      hati: "Hanya dipakai bila tiap aspek benar-benar diberi skor, bukan sekadar diceritakan." },
  ],
  "peran-pemerintah": [
    { grafik: "tabel", nama: "Matriks peran dan bukti", utama: true,
      untuk: "Menyilangkan tiap peran dengan keterangan pemerintah dan keterangan masyarakat.",
      hati: "Dua kolom sumber itu yang membuat triangulasinya terlihat." },
    { grafik: "tema", nama: "Peta peran dan hambatan",
      untuk: "Menampilkan peran yang dijalankan beserta hambatan yang menyertainya.",
      hati: "Tanpa angka dan tanpa persentase." },
  ],
  "analisis-kebijakan": [
    { grafik: "tabel", nama: "Tabel telaah pasal", utama: true,
      untuk: "Memasangkan tiap butir kebijakan dengan persoalan yang ditemukan.",
      hati: "Sebutkan pasal atau halamannya, jangan hanya menyimpulkan." },
    { grafik: "alur", nama: "Bagan tahap kebijakan",
      untuk: "Menggambarkan tahap kebijakan yang menjadi fokus penelitian.",
      hati: "Tandai tahap mana yang diteliti; meneliti seluruh tahap tidak selesai dalam satu skripsi." },
  ],
  governance: [
    { grafik: "polar", nama: "Diagram polar antar prinsip", utama: true,
      untuk: "Memperlihatkan prinsip tata kelola mana yang kuat dan mana yang tertinggal.",
      hati: "Samakan rentang tiap sumbu, dan hanya pakai bila tiap prinsip diberi skor." },
    { grafik: "tabel", nama: "Matriks prinsip dan bukti", utama: true,
      untuk: "Menyilangkan tiap prinsip dengan bukti dokumen dan keterangan informan.",
      hati: "Pilih beberapa prinsip saja, jangan seluruh daftar UNDP." },
  ],
  "strategi-pemerintah": [
    { grafik: "tabel", nama: "Matriks SWOT", utama: true,
      untuk: "Menata kekuatan, kelemahan, peluang, dan ancaman beserta strategi silangnya.",
      hati: "Tiap butir harus berasal dari data lapangan, bukan dari dugaan peneliti." },
    { grafik: "alur", nama: "Bagan tahap penyusunan strategi",
      untuk: "Menggambarkan urutan penyusunan dan pelaksanaan strateginya.",
      hati: "Nyatakan sumber tiap tahap." },
  ],
  fenomenologi: [
    { grafik: "tema", nama: "Peta tema", utama: true,
      untuk: "Menampilkan tema induk dan anak tema dari pernyataan informan.",
      hati: "Tanpa angka. Fenomenologi tidak menghitung, ia menafsirkan." },
    { grafik: "tabel", nama: "Tabel horizonalisasi", utama: true,
      untuk: "Memasangkan pernyataan penting informan dengan makna yang dirumuskan.",
      hati: "Sertakan kode informan, bukan namanya." },
  ],
  "studi-kasus": [
    { grafik: "alur", nama: "Bagan alur proses", utama: true,
      untuk: "Menggambarkan urutan kejadian atau tahapan yang diteliti.",
      hati: "Nyatakan sumber tiap tahapan: wawancara, dokumen, atau observasi." },
    { grafik: "tabel", nama: "Matriks temuan", utama: true,
      untuk: "Menyilangkan tema dengan sumber data agar triangulasi terlihat.",
      hati: "Kolom kosong menunjukkan temuan yang baru bersumber tunggal." },
  ],
  "kualitatif-deskriptif": [
    { grafik: "tema", nama: "Peta tema", utama: true,
      untuk: "Menampilkan tema yang muncul beserta kaitannya.",
      hati: "Tanpa angka dan tanpa persentase." },
    { grafik: "tabel", nama: "Tabel kode dan kutipan", utama: true,
      untuk: "Menunjukkan dasar tiap tema pada data lapangan.",
      hati: "Satu tema minimal disokong beberapa kutipan dari informan berbeda." },
  ],
  "efektivitas-program": [
    { grafik: "batang-kelompok", nama: "Diagram batang capaian dan target", utama: true,
      untuk: "Membandingkan capaian nyata dengan tolok ukur resmi program.",
      sumbu: "Sumbu datar: indikator program. Sumbu tegak: nilai capaian dan target berdampingan.",
      hati: "Target harus berasal dari dokumen resmi, bukan ditetapkan peneliti." },
    { grafik: "polar", nama: "Diagram polar antar dimensi", utama: true,
      untuk: "Memperlihatkan dimensi mana yang kuat dan mana yang tertinggal.",
      hati: "Samakan rentang tiap sumbu, jika tidak bentuknya menyesatkan." },
    { grafik: "tabel", nama: "Tabel kriteria evaluasi",
      untuk: "Menjabarkan tiap kriteria model evaluasi yang dipakai beserta hasilnya.",
      hati: "Sebut model yang dipakai secara tegas: CIPP, Kirkpatrick, atau lainnya." },
  ],
};

export function usulkanVisual(jenis: Jenis): Usul[] {
  return PETA[jenis] ?? [];
}

/** Apakah rancangan ini memang tidak cocok disajikan dengan grafik statistik? */
export function tanpaGrafikStatistik(jenis: Jenis) {
  return usulkanVisual(jenis).every((u) => ["tema", "tabel", "alur"].includes(u.grafik));
}
