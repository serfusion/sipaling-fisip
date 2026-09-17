// ============================================================
// RUBRIK PENILAIAN ESAI
//
// Rubrik mengubah penilaian esai dari "kira-kira berapa" menjadi angka yang
// dapat diterangkan. Itu bukan sekadar kerapian: nilai esai adalah satu-satunya
// nilai yang digugat mahasiswa, dan yang menentukan hasil gugatan bukan
// angkanya melainkan apakah ada alasan yang dapat dibacakan.
//
// ------------------------------------------------------------
// RUMUSNYA, DAN KENAPA BEGITU
// ------------------------------------------------------------
//
//   Total terbobot = Σ (level tiap kriteria × bobotnya)
//   Nilai 0–100    = (total terbobot ÷ level tertinggi) × 100
//
// Contoh pada rubrik skala 1–4 dengan lima kriteria:
//
//   Analisis Situasi        3 × 20% = 0,60
//   Strategi Pesan          4 × 20% = 0,80
//   Kelayakan Kanal         4 × 25% = 1,00
//   Operasional & Timeline  3 × 15% = 0,45
//   Sistematika & Bahasa    4 × 20% = 0,80
//                                   ------
//                                     3,65   →  (3,65 ÷ 4) × 100 = 91,25
//
// Pembagian dengan level TERTINGGI, bukan dengan jumlah kriteria — itu
// perbedaan yang menentukan. Rubrik berskala 1–4 dan rubrik berskala 1–5 harus
// menghasilkan nilai 100 untuk pekerjaan yang sempurna pada keduanya, dan
// hanya pembagian dengan skala yang memberikannya.
//
// ------------------------------------------------------------
// SATU HAL YANG TIDAK DIKERJAKAN RUBRIK
// ------------------------------------------------------------
// Rubrik tidak pernah memutuskan nilai akhir sendiri. Yang dikerjakannya
// adalah menyiapkan pembacaan beserta alasannya; yang menandatangani tetap
// dosen. Seluruh berkas ini karena itu menghitung, dan tidak satu pun
// fungsinya menyimpan apa pun.
// ============================================================

export type LevelRubrik = {
  /** Angka levelnya, mis. 1..4. */
  level: number;
  /** Apa yang membuat sebuah jawaban berada di level ini. */
  deskriptor: string;
};

export type KriteriaRubrik = {
  nama: string;
  /** Persen, 0–100. Jumlah seluruh kriteria harus 100. */
  bobot: number;
  levels: LevelRubrik[];
};

export type Rubrik = {
  nama: string;
  keterangan: string;
  skalaMin: number;
  skalaMax: number;
  kriteria: KriteriaRubrik[];
};

/** Batas wajar supaya satu rubrik tetap dapat dipakai manusia. */
export const MAKS_KRITERIA = 12;
export const MAKS_LEVEL = 6;

// ------------------------------------------------------------
// PEMBACAAN DAN PEMERIKSAAN
// ------------------------------------------------------------

/**
 * Baca kriteria dari kolom JSON, tanpa pernah melempar galat.
 *
 * Rubrik yang JSON-nya rusak tetap tampil dengan kriteria kosong, supaya dosen
 * dapat melihat dan memperbaikinya. Melempar galat di sini berarti seluruh
 * panel penilaian menolak terbuka karena satu baris yang cacat — dan yang
 * kehilangan akses justru satu-satunya orang yang dapat membetulkannya.
 */
export function bacaKriteria(json: string | null | undefined): KriteriaRubrik[] {
  try {
    const isi = JSON.parse(String(json || "[]"));
    if (!Array.isArray(isi)) return [];
    return isi
      .slice(0, MAKS_KRITERIA)
      .map((k) => {
        const baris = k as Partial<KriteriaRubrik>;
        const levels = Array.isArray(baris.levels)
          ? baris.levels
              .slice(0, MAKS_LEVEL)
              .map((l) => ({
                level: Number((l as LevelRubrik)?.level) || 0,
                deskriptor: String((l as LevelRubrik)?.deskriptor ?? "").slice(0, 2000),
              }))
              .filter((l) => Number.isFinite(l.level) && l.level > 0)
              .sort((a, b) => a.level - b.level)
          : [];
        return {
          nama: String(baris.nama ?? "").slice(0, 160),
          bobot: Math.max(0, Math.min(100, Math.round(Number(baris.bobot) || 0))),
          levels,
        };
      })
      .filter((k) => k.nama !== "");
  } catch {
    return [];
  }
}

export type PeriksaRubrik = { ok: true } | { ok: false; pesan: string };

/**
 * Apakah rubrik ini layak dipakai menilai.
 *
 * Yang diperiksa hanya hal yang membuat hitungannya SALAH, bukan hal yang
 * membuatnya kurang rapi. Deskriptor yang kosong pada satu level tidak
 * menggagalkan apa pun — mesin penilai akan menyebutnya "tanpa deskriptor" dan
 * dosen akan melihatnya. Bobot yang berjumlah 95 lain soal: ia menghasilkan
 * nilai yang salah tanpa satu pun tanda bahwa ada yang salah.
 */
export function periksaRubrik(r: Rubrik): PeriksaRubrik {
  if (!r.nama.trim()) return { ok: false, pesan: "Nama rubrik belum diisi." };
  if (r.kriteria.length === 0) return { ok: false, pesan: "Rubrik belum punya satu kriteria pun." };
  if (r.kriteria.length > MAKS_KRITERIA) {
    return { ok: false, pesan: `Kriteria paling banyak ${MAKS_KRITERIA}.` };
  }
  if (!Number.isInteger(r.skalaMin) || !Number.isInteger(r.skalaMax) || r.skalaMax <= r.skalaMin) {
    return { ok: false, pesan: "Skala rubrik tidak masuk akal. Contoh yang benar: 1 sampai 4." };
  }
  if (r.skalaMax - r.skalaMin + 1 > MAKS_LEVEL) {
    return { ok: false, pesan: `Level paling banyak ${MAKS_LEVEL} tingkat.` };
  }
  const kosong = r.kriteria.find((k) => !k.nama.trim());
  if (kosong) return { ok: false, pesan: "Ada kriteria yang namanya kosong." };

  const jumlah = r.kriteria.reduce((n, k) => n + k.bobot, 0);
  if (jumlah !== 100) {
    return {
      ok: false,
      pesan: `Jumlah bobot harus 100%, sekarang ${jumlah}%. Betulkan salah satu kriterianya.`,
    };
  }
  return { ok: true };
}

/**
 * Bagi bobot rata ke seluruh kriteria, sisanya ditaruh pada yang pertama.
 *
 * Dipakai tombol "ratakan" di panel dosen. Sisa pembagian sengaja tidak
 * disebar: tiga kriteria menghasilkan 34/33/33, dan itu lebih mudah dibaca
 * daripada 33,34/33,33/33,33 — yang juga tidak dapat disimpan sebagai bilangan
 * bulat.
 */
export function ratakanBobot(jumlahKriteria: number): number[] {
  if (jumlahKriteria <= 0) return [];
  const dasar = Math.floor(100 / jumlahKriteria);
  const bobot = Array.from({ length: jumlahKriteria }, () => dasar);
  bobot[0] += 100 - dasar * jumlahKriteria;
  return bobot;
}

// ------------------------------------------------------------
// PERHITUNGAN
// ------------------------------------------------------------

export type SkorKriteria = {
  nama: string;
  bobot: number;
  /** Level yang dipakai menghitung — keputusan dosen bila ada, kalau tidak pembacaan mesin. */
  level: number;
  /** Level × bobot ÷ 100. */
  terbobot: number;
  /** Apakah angka ini sudah disentuh dosen. */
  diubahDosen: boolean;
};

export type HasilRubrik = {
  kriteria: SkorKriteria[];
  /** Σ (level × bobot). Pada skala 1–4, angkanya berkisar 1,00 sampai 4,00. */
  totalTerbobot: number;
  /** 0–100. */
  nilai: number;
  /** Berapa kriteria yang belum punya level sama sekali. */
  belumDinilai: number;
  lengkap: boolean;
};

export type MasukanSkor = {
  /** Pembacaan mesin, bila sudah ada. */
  aiLevel?: number | null;
  /** Keputusan dosen, bila ia mengubahnya. */
  finalLevel?: number | null;
};

/**
 * Level yang BERLAKU untuk satu kriteria.
 *
 * Keputusan dosen selalu menang, termasuk ketika ia menurunkan level ke angka
 * yang sama dengan pembacaan mesin — yang dicatat bukan hanya angkanya, tetapi
 * bahwa ada yang memeriksanya.
 */
export function levelBerlaku(s: MasukanSkor): number | null {
  if (typeof s.finalLevel === "number" && Number.isFinite(s.finalLevel)) return s.finalLevel;
  if (typeof s.aiLevel === "number" && Number.isFinite(s.aiLevel)) return s.aiLevel;
  return null;
}

/**
 * Hitung nilai satu jawaban esai dari rubrik dan skornya.
 *
 * Kriteria yang BELUM dinilai dihitung sebagai nol dan dilaporkan terpisah
 * lewat `belumDinilai`. Dua-duanya perlu: nilainya harus tetap dapat
 * ditampilkan sebagai angka sementara, dan yang membacanya harus tahu bahwa
 * angka itu belum utuh. Menyembunyikan nilainya sampai lengkap membuat dosen
 * yang menilai kriteria demi kriteria kehilangan umpan balik di sepanjang
 * jalan.
 */
export function hitungRubrik(rubrik: Rubrik, skor: MasukanSkor[]): HasilRubrik {
  const kriteria: SkorKriteria[] = [];
  let totalTerbobot = 0;
  let belumDinilai = 0;

  rubrik.kriteria.forEach((k, urut) => {
    const masuk = skor[urut] ?? {};
    const level = levelBerlaku(masuk);
    if (level === null) belumDinilai += 1;

    // Level yang di luar skala dipaksa masuk, bukan ditolak. Rubrik dapat
    // disunting sesudah sebagian jawaban dinilai — skala yang dipersempit dari
    // 1–5 menjadi 1–4 meninggalkan angka 5 di basis data, dan angka itu tidak
    // boleh menghasilkan nilai di atas seratus.
    const dipakai = level === null ? 0 : Math.max(rubrik.skalaMin, Math.min(rubrik.skalaMax, level));
    const terbobot = Math.round(((dipakai * k.bobot) / 100) * 10000) / 10000;
    totalTerbobot += terbobot;

    kriteria.push({
      nama: k.nama,
      bobot: k.bobot,
      level: level === null ? 0 : dipakai,
      terbobot,
      diubahDosen: typeof masuk.finalLevel === "number" && Number.isFinite(masuk.finalLevel),
    });
  });

  totalTerbobot = Math.round(totalTerbobot * 100) / 100;
  const nilai = rubrik.skalaMax > 0
    ? Math.round((totalTerbobot / rubrik.skalaMax) * 100 * 100) / 100
    : 0;

  return {
    kriteria,
    totalTerbobot,
    nilai: Math.max(0, Math.min(100, nilai)),
    belumDinilai,
    lengkap: belumDinilai === 0 && rubrik.kriteria.length > 0,
  };
}

/**
 * Nilai rubrik 0–100 diubah menjadi poin soal.
 *
 * Soal esai punya bobot poinnya sendiri (mis. 20 dari total 100), dan rubrik
 * menghasilkan persentase. Yang dikerjakan di sini hanya pengalian — tetapi ia
 * berada di satu tempat supaya jalur penilaian AI dan jalur koreksi manual
 * memakai pembulatan yang sama. Dua pembulatan yang berbeda pada satu lembar
 * jawaban menghasilkan dua nilai akhir yang berbeda untuk pekerjaan yang sama.
 */
export function poinDariRubrik(nilai0100: number, bobotSoal: number): number {
  const aman = Math.max(0, Math.min(100, Number(nilai0100) || 0));
  return Math.round(((aman / 100) * bobotSoal) * 100) / 100;
}

// ------------------------------------------------------------
// PREDIKAT
// ------------------------------------------------------------

export type Predikat = { huruf: string; sebutan: string };

const TANGGA: Array<{ batas: number } & Predikat> = [
  { batas: 85, huruf: "A", sebutan: "Sangat Baik" },
  { batas: 75, huruf: "B", sebutan: "Baik" },
  { batas: 65, huruf: "C", sebutan: "Cukup" },
  { batas: 55, huruf: "D", sebutan: "Kurang" },
  { batas: 0, huruf: "E", sebutan: "Sangat Kurang" },
];

/**
 * Predikat huruf dari nilai 0–100.
 *
 * Tangganya mengikuti sebaran yang lazim dipakai di kampus. Ia TIDAK
 * menentukan lulus atau tidak — itu urusan passing grade ujiannya, yang disetel
 * dosen per ujian — dan hanya muncul pada laporan sebagai sebutan.
 */
export function predikat(nilai: number): Predikat {
  const angka = Number(nilai) || 0;
  const cocok = TANGGA.find((t) => angka >= t.batas);
  return cocok ? { huruf: cocok.huruf, sebutan: cocok.sebutan } : TANGGA[TANGGA.length - 1];
}

// ------------------------------------------------------------
// RUBRIK SIAP PAKAI
// ------------------------------------------------------------
//
// Ada supaya dosen yang membuka menu rubrik pertama kali tidak menghadapi
// formulir kosong. Menyusun rubrik dari nol memakan dua puluh menit dan
// pengetahuan tentang bentuk deskriptor yang baik; memilih satu dari daftar
// lalu mengganti satu-dua kata memakan dua menit.
//
// Yang dipilih DISALIN, bukan dirujuk. Rubrik bawaan yang disunting seorang
// dosen tidak boleh berubah bagi seluruh dosen lain yang memakainya.

export const RUBRIK_BAWAAN: Rubrik[] = [
  {
    nama: "Rubrik Proposal Kampanye",
    keterangan:
      "Lima komponen dengan skala 1–4, untuk menilai proposal kampanye komunikasi: " +
      "analisis wilayah, strategi pesan, kelayakan kanal, rencana operasional, dan sistematika penulisan.",
    skalaMin: 1,
    skalaMax: 4,
    kriteria: [
      {
        nama: "Analisis Situasi & Konteks Wilayah",
        bobot: 20,
        levels: [
          { level: 1, deskriptor: "Analisis situasi tidak memadai. Audiens dan konteks wilayah tidak jelas. Tidak ada data atau dasar yang cukup untuk mendukung analisis." },
          { level: 2, deskriptor: "Analisis situasi ada tetapi masih umum. Pemetaan audiens atau konteks wilayah belum lengkap. Data pendukung terbatas." },
          { level: 3, deskriptor: "Pemetaan audiens dan konteks wilayah tepat. Identifikasi masalah cukup tepat, tetapi masih membutuhkan dukungan data statistik lokal yang lebih spesifik." },
          { level: 4, deskriptor: "Pemetaan situasi, audiens sasaran, dan konteks wilayah sangat lengkap. Identifikasi masalah tepat, didukung data lokal yang spesifik, dan hubungan antara masalah, wilayah, serta target kampanye dijelaskan kuat." },
        ],
      },
      {
        nama: "Strategi Pesan & Pendekatan Budaya",
        bobot: 20,
        levels: [
          { level: 1, deskriptor: "Pesan tidak sesuai audiens. Tidak menunjukkan sensitivitas budaya. Pendekatan komunikasi terlalu umum atau tidak relevan." },
          { level: 2, deskriptor: "Pesan cukup relevan tetapi pendekatan budaya masih terbatas. Kesesuaian bahasa dan figur lokal belum kuat." },
          { level: 3, deskriptor: "Strategi pesan relevan dan pendekatan budaya cukup sesuai. Unsur lokal sudah digunakan tetapi belum maksimal." },
          { level: 4, deskriptor: "Strategi pesan sangat relevan dengan audiens. Pendekatan budaya kuat dan sensitif terhadap konteks lokal, melibatkan figur atau aktor lokal yang tepat, dengan pemilihan bahasa dan media yang mendukung penerimaan pesan." },
        ],
      },
      {
        nama: "Kelayakan Kanal & Taktik Eksekusi",
        bobot: 25,
        levels: [
          { level: 1, deskriptor: "Kanal tidak realistis atau tidak sesuai target. Taktik eksekusi tidak jelas atau sulit dilaksanakan." },
          { level: 2, deskriptor: "Kanal tersedia tetapi kesesuaiannya belum kuat. Taktik belum cukup rinci atau masih memiliki hambatan implementasi." },
          { level: 3, deskriptor: "Kanal dan taktik realistis serta sebagian besar sesuai kondisi target. Masih terdapat aspek eksekusi yang perlu diperjelas." },
          { level: 4, deskriptor: "Kanal sangat realistis dan sesuai kondisi target. Taktik eksekusi konkret dan dapat dilaksanakan, mempertimbangkan akses geografis, ekonomi, dan kebiasaan audiens, dengan pilihan media serta titik distribusi yang sangat sesuai." },
        ],
      },
      {
        nama: "Rencana Operasional & Timeline",
        bobot: 15,
        levels: [
          { level: 1, deskriptor: "Tidak ada timeline yang jelas. Operasional tidak terstruktur dan tidak ada indikator keberhasilan yang dapat digunakan." },
          { level: 2, deskriptor: "Timeline tersedia tetapi kurang rinci. Tahapan operasional atau indikator keberhasilan masih terbatas." },
          { level: 3, deskriptor: "Timeline terstruktur dan logis, tahapan pelaksanaan cukup jelas, tetapi indikator kinerja pada tahap evaluasi belum seluruhnya terukur." },
          { level: 4, deskriptor: "Timeline jelas, realistis, dan terukur. Tahapan operasional lengkap, dengan indikator kinerja utama yang kuantitatif dan jelas." },
        ],
      },
      {
        nama: "Sistematika Penulisan & Bahasa",
        bobot: 20,
        levels: [
          { level: 1, deskriptor: "Tulisan tidak terstruktur. Bahasa sulit dipahami dan banyak masalah dalam penyajian." },
          { level: 2, deskriptor: "Struktur tulisan cukup tetapi belum konsisten. Bahasa masih memiliki beberapa masalah yang mengganggu pemahaman." },
          { level: 3, deskriptor: "Penulisan cukup rapi dan mudah dipahami. Struktur dan bahasa umumnya konsisten, masih terdapat sedikit bagian yang dapat diperbaiki." },
          { level: 4, deskriptor: "Penulisan ringkas dan sangat terstruktur. Bahasa Indonesia baku dan konsisten, mudah dipahami, dan penyajiannya mendukung pemahaman isi." },
        ],
      },
    ],
  },
  {
    nama: "Rubrik Esai Umum",
    keterangan:
      "Empat kriteria dengan skala 1–4, dapat dipakai untuk sebagian besar soal esai: " +
      "ketepatan konsep, argumentasi, analisis, dan penggunaan referensi.",
    skalaMin: 1,
    skalaMax: 4,
    kriteria: [
      {
        nama: "Ketepatan Konsep",
        bobot: 30,
        levels: [
          { level: 1, deskriptor: "Konsep yang dipakai keliru atau tidak berhubungan dengan pertanyaan." },
          { level: 2, deskriptor: "Sebagian konsep tepat, tetapi masih bercampur dengan kekeliruan yang mendasar." },
          { level: 3, deskriptor: "Konsep yang dipakai tepat dan sesuai dengan pertanyaan." },
          { level: 4, deskriptor: "Konsep tepat, menyeluruh, dan dihubungkan dengan konsep lain yang relevan." },
        ],
      },
      {
        nama: "Argumentasi",
        bobot: 25,
        levels: [
          { level: 1, deskriptor: "Tidak ada argumen — jawaban hanya menyebut ulang pertanyaan atau mendaftar istilah." },
          { level: 2, deskriptor: "Ada argumen tetapi lemah, tanpa dasar yang jelas." },
          { level: 3, deskriptor: "Argumen jelas dan didukung alasan yang masuk akal." },
          { level: 4, deskriptor: "Argumen kuat, runtut, dan menimbang kemungkinan bantahannya." },
        ],
      },
      {
        nama: "Analisis",
        bobot: 25,
        levels: [
          { level: 1, deskriptor: "Tidak ada analisis, atau analisisnya tidak berhubungan dengan pertanyaan." },
          { level: 2, deskriptor: "Analisis ada tetapi terbatas pada permukaan persoalan." },
          { level: 3, deskriptor: "Analisis baik dan menjangkau hubungan sebab-akibat." },
          { level: 4, deskriptor: "Analisis mendalam, menghubungkan beberapa sudut pandang, dan sampai pada kesimpulan yang beralasan." },
        ],
      },
      {
        nama: "Referensi & Contoh",
        bobot: 20,
        levels: [
          { level: 1, deskriptor: "Tidak ada rujukan maupun contoh." },
          { level: 2, deskriptor: "Rujukan atau contohnya minim dan kurang berkaitan." },
          { level: 3, deskriptor: "Rujukan dan contohnya cukup serta berkaitan dengan pembahasan." },
          { level: 4, deskriptor: "Rujukan relevan dan kuat, contohnya tepat dan benar-benar menjelaskan." },
        ],
      },
    ],
  },
  {
    nama: "Rubrik Jawaban Singkat",
    keterangan:
      "Tiga kriteria dengan skala 1–4, untuk soal esai pendek yang jawabannya satu sampai dua paragraf.",
    skalaMin: 1,
    skalaMax: 4,
    kriteria: [
      {
        nama: "Kebenaran Isi",
        bobot: 50,
        levels: [
          { level: 1, deskriptor: "Isi jawabannya keliru." },
          { level: 2, deskriptor: "Sebagian isinya benar, sebagian keliru." },
          { level: 3, deskriptor: "Isi jawabannya benar." },
          { level: 4, deskriptor: "Isi jawabannya benar dan lengkap, termasuk bagian yang sering terlewat." },
        ],
      },
      {
        nama: "Kelengkapan",
        bobot: 30,
        levels: [
          { level: 1, deskriptor: "Hanya menyebut satu bagian dari yang diminta." },
          { level: 2, deskriptor: "Menyebut sebagian yang diminta." },
          { level: 3, deskriptor: "Menyebut hampir seluruh yang diminta." },
          { level: 4, deskriptor: "Menyebut seluruh yang diminta beserta keterangannya." },
        ],
      },
      {
        nama: "Kejelasan Bahasa",
        bobot: 20,
        levels: [
          { level: 1, deskriptor: "Sulit dipahami." },
          { level: 2, deskriptor: "Dapat dipahami dengan membaca ulang." },
          { level: 3, deskriptor: "Jelas dan mudah dipahami." },
          { level: 4, deskriptor: "Jelas, ringkas, dan tepat istilah." },
        ],
      },
    ],
  },
];

/** Rubrik bawaan menurut namanya, sudah berupa salinan yang aman disunting. */
export function rubrikBawaan(nama: string): Rubrik | null {
  const cocok = RUBRIK_BAWAAN.find((r) => r.nama === nama);
  return cocok ? (JSON.parse(JSON.stringify(cocok)) as Rubrik) : null;
}

/**
 * Rubrik kosong yang sudah berbentuk benar, untuk dosen yang menyusun sendiri.
 *
 * Dua kriteria, bukan nol: formulir yang benar-benar kosong tidak menunjukkan
 * apa yang harus diisi, dan dosen yang membukanya pertama kali harus menebak
 * bentuk yang diharapkan.
 */
export function rubrikKosong(): Rubrik {
  const bobot = ratakanBobot(2);
  const levels = (): LevelRubrik[] =>
    [1, 2, 3, 4].map((level) => ({ level, deskriptor: "" }));
  return {
    nama: "",
    keterangan: "",
    skalaMin: 1,
    skalaMax: 4,
    kriteria: [
      { nama: "", bobot: bobot[0], levels: levels() },
      { nama: "", bobot: bobot[1], levels: levels() },
    ],
  };
}
