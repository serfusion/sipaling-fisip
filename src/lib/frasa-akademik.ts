// BANK FRASA AKADEMIK INDONESIA KE INGGRIS.
//
// Yang membuat naskah penulis Indonesia terbaca janggal biasanya bukan tata
// bahasanya, melainkan pilihan kata pada rumusan baku. "Penelitian ini
// bertujuan untuk menganalisa" diterjemahkan harfiah menjadi "This research
// have a purpose to analyze", padahal rumusan bakunya di jurnal internasional
// adalah "This study examines".
//
// Berkas ini memuat padanan baku itu: rumusan yang muncul hampir di setiap
// skripsi, beserta bentuk Inggris yang benar-benar dipakai jurnal. Semuanya
// deterministik, berjalan di peramban, tanpa AI, dan tanpa naskah dikirim ke
// mana pun.
//
// Ini alat bantu, bukan penerjemah otomatis. Ia menunjukkan rumusan yang
// dikenali beserta padanannya; penulisnya yang memutuskan.

export type Bidang =
  | "tujuan"
  | "rumusan"
  | "metode"
  | "sampel"
  | "analisis"
  | "hasil"
  | "pembahasan"
  | "simpulan"
  | "penghubung"
  | "istilah";

export const BIDANG_LABEL: Record<Bidang, string> = {
  tujuan: "Tujuan penelitian",
  rumusan: "Rumusan masalah",
  metode: "Metode",
  sampel: "Populasi dan sampel",
  analisis: "Analisis data",
  hasil: "Hasil",
  pembahasan: "Pembahasan",
  simpulan: "Simpulan",
  penghubung: "Kata penghubung",
  istilah: "Istilah metodologi",
};

export type Frasa = {
  /** Pola yang dicari pada naskah Indonesia. */
  pola: RegExp;
  /** Rumusan Indonesia sebagaimana dikenali, untuk ditampilkan. */
  sumber: string;
  /** Padanan yang dipakai jurnal. Yang pertama paling lazim. */
  padanan: string[];
  bidang: Bidang;
  /** Kenapa padanan harfiahnya keliru. Ditampilkan bila ada. */
  catatan?: string;
};

export const FRASA: Frasa[] = [
  // --- Tujuan penelitian ---
  {
    pola: /penelitian ini bertujuan untuk (?:menganalisa|menganalisis)/gi,
    sumber: "Penelitian ini bertujuan untuk menganalisis",
    padanan: ["This study examines", "This study analyses", "This study investigates"],
    bidang: "tujuan",
    catatan: 'Hindari "This research have a purpose to analyze". Jurnal memakai "study", bukan "research", sebagai subjek kalimat.',
  },
  {
    pola: /penelitian ini bertujuan untuk (?:mengetahui|melihat)/gi,
    sumber: "Penelitian ini bertujuan untuk mengetahui",
    padanan: ["This study investigates", "This study explores", "This study assesses"],
    bidang: "tujuan",
    catatan: '"to know" bukan bentuk akademik. Pilih kata kerja yang menyebut tindakan penelitiannya.',
  },
  {
    pola: /penelitian ini bertujuan untuk mendeskripsikan/gi,
    sumber: "Penelitian ini bertujuan untuk mendeskripsikan",
    padanan: ["This study describes", "This study documents"],
    bidang: "tujuan",
  },
  {
    pola: /tujuan (?:dari )?penelitian ini adalah/gi,
    sumber: "Tujuan dari penelitian ini adalah",
    padanan: ["The aim of this study is to", "This study seeks to"],
    bidang: "tujuan",
  },
  {
    pola: /untuk mengetahui (?:pengaruh|dampak)/gi,
    sumber: "Untuk mengetahui pengaruh",
    padanan: ["to examine the effect of", "to assess the impact of"],
    bidang: "tujuan",
    catatan: 'Kata depannya "of", bukan "to". "the effect to" adalah kesalahan yang sangat lazim.',
  },

  // --- Rumusan masalah ---
  {
    pola: /rumusan masalah (?:dalam|pada) penelitian ini/gi,
    sumber: "Rumusan masalah dalam penelitian ini",
    padanan: ["This study addresses the following questions", "The research questions guiding this study are"],
    bidang: "rumusan",
    catatan: 'Jurnal menuliskannya sebagai pernyataan, bukan sebagai daftar pertanyaan bernomor seperti pada skripsi.',
  },
  {
    pola: /bagaimana pengaruh (\w+) terhadap/gi,
    sumber: "Bagaimana pengaruh X terhadap Y",
    padanan: ["How does X affect Y?", "To what extent does X influence Y?"],
    bidang: "rumusan",
  },
  {
    pola: /belum banyak (?:penelitian|kajian) yang/gi,
    sumber: "Belum banyak penelitian yang",
    padanan: ["Few studies have", "Little research has examined"],
    bidang: "rumusan",
    catatan: "Inilah gerakan menunjukkan celah pada Introduction. Sebutkan penelitian yang sudah ada lebih dulu.",
  },

  // --- Metode ---
  {
    pola: /penelitian ini menggunakan (?:metode )?(?:pendekatan )?kualitatif/gi,
    sumber: "Penelitian ini menggunakan pendekatan kualitatif",
    padanan: ["This study employs a qualitative approach", "A qualitative design was used"],
    bidang: "metode",
    catatan: "Bagian Methods ditulis dalam kala lampau.",
  },
  {
    pola: /penelitian ini menggunakan (?:metode )?(?:pendekatan )?kuantitatif/gi,
    sumber: "Penelitian ini menggunakan pendekatan kuantitatif",
    padanan: ["This study employs a quantitative approach", "A quantitative design was used"],
    bidang: "metode",
  },
  {
    pola: /(?:metode )?deskriptif kualitatif/gi,
    sumber: "Deskriptif kualitatif",
    padanan: ["descriptive qualitative", "qualitative descriptive design"],
    bidang: "metode",
  },
  {
    pola: /studi kasus/gi,
    sumber: "Studi kasus",
    padanan: ["case study"],
    bidang: "metode",
  },
  {
    pola: /penelitian (?:ini )?dilaksanakan (?:di|pada)/gi,
    sumber: "Penelitian dilaksanakan di",
    padanan: ["The study was conducted at", "Data were collected at"],
    bidang: "metode",
    catatan: '"data" jamak dalam ragam ilmiah: "data were", bukan "data was".',
  },

  // --- Populasi dan sampel ---
  {
    pola: /teknik pengambilan sampel/gi,
    sumber: "Teknik pengambilan sampel",
    padanan: ["sampling technique", "sampling procedure"],
    bidang: "sampel",
  },
  {
    pola: /purposive sampling/gi,
    sumber: "Purposive sampling",
    padanan: ["purposive sampling"],
    bidang: "istilah",
    catatan: "Istilah ini sudah bahasa Inggris. Sebutkan kriteria pemilihannya, karena itu yang ditanya peninjau.",
  },
  {
    pola: /(?:teknik )?snowball sampling/gi,
    sumber: "Snowball sampling",
    padanan: ["snowball sampling"],
    bidang: "istilah",
  },
  {
    pola: /(?:jumlah )?(?:responden|sampel) (?:dalam penelitian ini )?(?:sebanyak|berjumlah)/gi,
    sumber: "Jumlah responden sebanyak",
    padanan: ["The sample comprised", "A total of … respondents participated"],
    bidang: "sampel",
  },
  {
    pola: /populasi (?:dalam|pada) penelitian ini adalah/gi,
    sumber: "Populasi dalam penelitian ini adalah",
    padanan: ["The population of this study comprised", "The target population was"],
    bidang: "sampel",
  },

  // --- Analisis ---
  {
    pola: /teknik analisis data/gi,
    sumber: "Teknik analisis data",
    padanan: ["data analysis technique", "analytical procedure"],
    bidang: "analisis",
  },
  {
    pola: /uji validitas/gi,
    sumber: "Uji validitas",
    padanan: ["validity test", "construct validity assessment"],
    bidang: "istilah",
  },
  {
    pola: /uji reliabilitas/gi,
    sumber: "Uji reliabilitas",
    padanan: ["reliability test", "Cronbach's alpha was computed"],
    bidang: "istilah",
    catatan: "Sertakan nilai alfanya. Peninjau akan menanyakannya bila tidak ada.",
  },
  {
    pola: /triangulasi/gi,
    sumber: "Triangulasi",
    padanan: ["triangulation"],
    bidang: "istilah",
    catatan: "Sebutkan jenisnya: source, method, atau investigator triangulation.",
  },
  {
    pola: /(?:uji|analisis) regresi (?:linier|linear)? ?(?:berganda|sederhana)?/gi,
    sumber: "Analisis regresi",
    padanan: ["regression analysis", "multiple linear regression"],
    bidang: "analisis",
  },
  {
    pola: /(?:reduksi data|penyajian data|penarikan kesimpulan)/gi,
    sumber: "Reduksi data, penyajian data, penarikan kesimpulan",
    padanan: ["data reduction, data display, and conclusion drawing"],
    bidang: "analisis",
    catatan: "Rujuk Miles dan Huberman bila memakai tahapan ini.",
  },

  // --- Hasil ---
  {
    pola: /(?:hasil penelitian|penelitian ini) menunjukkan bahwa/gi,
    sumber: "Hasil penelitian menunjukkan bahwa",
    padanan: ["The results indicate that", "The findings show that", "The analysis revealed that"],
    bidang: "hasil",
    catatan: "Bagian Results memakai kala lampau untuk apa yang Anda temukan.",
  },
  {
    pola: /berdasarkan (?:hasil )?(?:tabel|gambar) di ?atas/gi,
    sumber: "Berdasarkan tabel di atas",
    padanan: ["As shown in Table 1", "Table 1 presents"],
    bidang: "hasil",
    catatan: 'Jurnal merujuk nomor tabel, bukan letaknya. "di atas" tidak bermakna setelah tata letak berubah.',
  },
  {
    pola: /terdapat (?:pengaruh|hubungan) (?:yang )?signifikan/gi,
    sumber: "Terdapat pengaruh yang signifikan",
    padanan: ["a significant effect was found", "there was a significant association"],
    bidang: "hasil",
    catatan: "Sertakan nilai statistik dan p-nya. Klaim signifikan tanpa angka akan ditolak.",
  },

  // --- Pembahasan ---
  {
    pola: /(?:hal ini )?sejalan dengan (?:penelitian|hasil penelitian)/gi,
    sumber: "Sejalan dengan penelitian",
    padanan: ["consistent with", "in line with the findings of"],
    bidang: "pembahasan",
  },
  {
    pola: /(?:hal ini )?berbeda dengan (?:penelitian|temuan)/gi,
    sumber: "Berbeda dengan penelitian",
    padanan: ["in contrast to", "diverges from the findings of"],
    bidang: "pembahasan",
  },
  {
    pola: /keterbatasan penelitian/gi,
    sumber: "Keterbatasan penelitian",
    padanan: ["limitations of this study"],
    bidang: "pembahasan",
    catatan: "Wajib ada pada artikel jurnal. Naskah tanpa bagian ini kerap diminta revisi.",
  },

  // --- Simpulan ---
  {
    pola: /berdasarkan (?:hasil )?(?:penelitian|pembahasan) (?:di ?atas|tersebut)/gi,
    sumber: "Berdasarkan hasil pembahasan di atas",
    padanan: ["These findings suggest that", "Taken together, the results indicate"],
    bidang: "simpulan",
    catatan: 'Jangan menerjemahkan "di atas" menjadi "above". Jurnal tidak merujuk letak dalam teks.',
  },
  {
    pola: /dapat disimpulkan bahwa/gi,
    sumber: "Dapat disimpulkan bahwa",
    padanan: ["These results indicate that", "This study concludes that"],
    bidang: "simpulan",
    catatan: '"It can be concluded that" terlalu sering muncul pada naskah Indonesia dan terbaca sebagai pengisi.',
  },
  {
    pola: /saran (?:untuk )?penelitian selanjutnya/gi,
    sumber: "Saran untuk penelitian selanjutnya",
    padanan: ["Future research should", "Further studies could"],
    bidang: "simpulan",
  },

  // --- Penghubung ---
  {
    pola: /(?:^|[.!?]\s+)selain itu\b/gi,
    sumber: "Selain itu",
    padanan: ["In addition", "Moreover", "Furthermore"],
    bidang: "penghubung",
  },
  {
    pola: /(?:^|[.!?]\s+)oleh karena itu\b/gi,
    sumber: "Oleh karena itu",
    padanan: ["Therefore", "Accordingly", "Consequently"],
    bidang: "penghubung",
  },
  {
    pola: /(?:^|[.!?]\s+)namun demikian\b/gi,
    sumber: "Namun demikian",
    padanan: ["Nevertheless", "However"],
    bidang: "penghubung",
    catatan: '"Nevertheless however" mubazir. Pilih satu.',
  },
  {
    pola: /di samping itu\b/gi,
    sumber: "Di samping itu",
    padanan: ["In addition", "Besides this"],
    bidang: "penghubung",
    catatan: '"Beside that" adalah terjemahan harfiah yang keliru.',
  },
  {
    pola: /dengan kata lain\b/gi,
    sumber: "Dengan kata lain",
    padanan: ["In other words", "That is"],
    bidang: "penghubung",
  },
];

export type TemuanFrasa = {
  sumber: string;
  padanan: string[];
  bidang: Bidang;
  catatan?: string;
  kutipan: string;
  posisi: number;
};

/**
 * Kenali rumusan baku pada naskah Indonesia dan tunjukkan padanannya.
 *
 * Satu pola hanya dilaporkan sekali walau muncul berkali-kali: yang berguna
 * bagi penulis adalah daftar rumusan yang perlu diputuskan, bukan daftar
 * kemunculan.
 */
export function cariFrasa(teks: string): TemuanFrasa[] {
  const temuan: TemuanFrasa[] = [];
  const sudah = new Set<string>();

  for (const f of FRASA) {
    const cocok = [...teks.matchAll(f.pola)];
    if (cocok.length === 0) continue;
    if (sudah.has(f.sumber)) continue;
    sudah.add(f.sumber);
    const pertama = cocok[0];
    temuan.push({
      sumber: f.sumber,
      padanan: f.padanan,
      bidang: f.bidang,
      catatan: f.catatan,
      kutipan: pertama[0].trim().replace(/^[.!?]\s*/, ""),
      posisi: pertama.index ?? 0,
    });
  }

  return temuan.sort((a, b) => a.posisi - b.posisi);
}

/** Kelompokkan temuan menurut bagian naskah, mengikuti urutan penulisan. */
export function kelompokkan(temuan: TemuanFrasa[]) {
  const urutan: Bidang[] = [
    "tujuan", "rumusan", "metode", "sampel", "analisis",
    "hasil", "pembahasan", "simpulan", "penghubung", "istilah",
  ];
  return urutan
    .map((b) => ({ bidang: b, label: BIDANG_LABEL[b], isi: temuan.filter((t) => t.bidang === b) }))
    .filter((k) => k.isi.length > 0);
}
