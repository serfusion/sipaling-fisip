// NASKAH INGGRIS — pemeriksa ragam akademik Inggris dan pemeta BAB → IMRaD.
//
// Dua hal yang membuat naskah penulis Indonesia ditolak sebelum isinya dibaca:
//
// 1. Struktur. BAB I–V bukan IMRaD. Pendahuluan skripsi memuat latar
//    belakang, rumusan masalah, tujuan, manfaat, dan sistematika penulisan.
//    Introduction jurnal menuntut gerakan CARS: tegakkan bidang, tunjukkan
//    celah, isi celah. Menyalin apa adanya menghasilkan naskah yang oleh
//    peninjau dibaca sebagai laporan, bukan artikel.
//
// 2. Ragam. Bukan tata bahasa yang salah, melainkan pola retorika Indonesia
//    yang diterjemahkan harfiah — "in this modern era", "as we know",
//    "from the explanation above". Peninjau internasional menandainya
//    seketika sebagai "language needs improvement" walaupun ilmunya bagus.
//
// Keduanya deterministik. Tidak ada AI di berkas ini, dan seluruh pemeriksaan
// dapat berjalan di peramban tanpa naskah meninggalkan perangkat.

export type BeratInggris = "ganti" | "rapikan" | "pertimbangkan";

export type TemuanInggris = {
  aturan: string;
  berat: BeratInggris;
  kutipan: string;
  posisi: number;
  pesan: string;
  saran: string | null;
};

export const BERAT_INGGRIS_LABEL: Record<BeratInggris, string> = {
  ganti: "Ditandai peninjau",
  rapikan: "Sebaiknya dirapikan",
  pertimbangkan: "Pertimbangkan",
};

// ---------------------------------------------------------------------------
// 1. Kalke — pola retorika Indonesia yang diterjemahkan harfiah
// ---------------------------------------------------------------------------
type Aturan = { pola: RegExp; pesan: string; saran: string | null; berat: BeratInggris };

const KALKE: Aturan[] = [
  {
    pola: /\bin (?:this|the) (?:modern|globalization|digital|current) (?:era|age)\b/gi,
    pesan: 'Terjemahan harfiah "di era modern ini". Pembuka semacam ini tidak dipakai jurnal internasional.',
    saran: "Buka dengan temuan atau masalah yang konkret",
    berat: "ganti",
  },
  {
    pola: /\bas we (?:all )?know\b/gi,
    pesan: 'Terjemahan "seperti yang kita ketahui". Klaim tanpa rujukan.',
    saran: "Sebutkan sumbernya, atau hapus",
    berat: "ganti",
  },
  {
    pola: /\b(?:based on|from) the (?:explanation|description|background|elaboration) above\b/gi,
    pesan: 'Terjemahan "berdasarkan penjelasan di atas". Jurnal tidak merujuk letak dalam teks.',
    saran: "Nyatakan langsung simpulannya",
    berat: "ganti",
  },
  {
    pola: /\bcannot be separated from\b/gi,
    pesan: 'Terjemahan "tidak dapat dipisahkan dari". Tidak lazim dalam bahasa Inggris akademik.',
    saran: "is closely linked to / depends on",
    berat: "ganti",
  },
  {
    pola: /\bthe (?:writer|author)s?\s+(?:want|would like|will|tries|try|attempts?)\b/gi,
    pesan: 'Terjemahan "penulis ingin/berusaha". Jurnal memakai kalimat pasif atau "this study".',
    saran: "This study examines…",
    berat: "ganti",
  },
  {
    pola: /\bin this (?:research|study),? the (?:researcher|writer|author)s?\b/gi,
    pesan: 'Terjemahan "dalam penelitian ini, peneliti…". Mubazir dan menonjolkan orangnya.',
    saran: "This study…",
    berat: "ganti",
  },
  {
    pola: /\bvery (?:influential|important|significant|crucial|useful|interesting)\b/gi,
    pesan: '"very" + kata sifat adalah pola Indonesia. Bahasa Inggris akademik memakai kata yang lebih tepat.',
    saran: "substantial / central / considerable",
    berat: "rapikan",
  },
  {
    pola: /\b(?:beside|besides) that\b/gi,
    pesan: 'Terjemahan "di samping itu". Bentuk yang lazim adalah "In addition" atau "Moreover".',
    saran: "In addition",
    berat: "rapikan",
  },
  {
    pola: /\bnowadays\b/gi,
    pesan: '"Nowadays" jarang dipakai dalam jurnal; ia menandai tulisan sebagai non-akademik.',
    saran: "Recently / Over the past decade",
    berat: "rapikan",
  },
  {
    pola: /\bmany (?:experts|scholars|researchers) (?:say|said|state|argue)\b(?![^.]{0,80}\()/gi,
    pesan: "Klaim banyak ahli tanpa rujukan. Peninjau akan meminta sitasinya.",
    saran: "Sebutkan penulis dan tahunnya",
    berat: "ganti",
  },
  {
    pola: /\b(?:do|does|did|make|made|conducting a|doing a) (?:a )?research\b/gi,
    pesan: 'Kolokasi keliru. Bahasa Inggris memakai "conduct research" atau "carry out research".',
    saran: "conduct research",
    berat: "ganti",
  },
  {
    pola: /\bgive (?:an? )?(?:impact|influence|effect) (?:to|for)\b/gi,
    pesan: "Kolokasi keliru.",
    saran: "affect / influence",
    berat: "ganti",
  },
  {
    pola: /\bhas (?:an? )?(?:influence|impact|effect) (?:to|for)\b/gi,
    pesan: 'Kata depan keliru — yang benar "on".',
    saran: "has an effect on",
    berat: "ganti",
  },
  {
    pola: /\baccording to .{0,40}\b(?:said|says)\b/gi,
    pesan: '"According to X, X said" mubazir.',
    saran: "According to X, …",
    berat: "rapikan",
  },
  {
    pola: /\bit can be concluded that\b/gi,
    pesan: "Frasa ini sangat sering muncul pada naskah Indonesia dan terbaca sebagai pengisi.",
    saran: "These results indicate that…",
    berat: "rapikan",
  },
  {
    pola: /\bin line with (?:the )?(?:theory|opinion|statement)\b/gi,
    pesan: 'Terjemahan "sejalan dengan teori/pendapat".',
    saran: "consistent with",
    berat: "rapikan",
  },
  {
    pola: /\band so on\b|\betc\.\s/gi,
    pesan: '"and so on" serta "etc." dihindari dalam jurnal karena tidak menyebutkan apa pun.',
    saran: "Sebutkan seluruh butirnya, atau tulis 'among others'",
    berat: "rapikan",
  },
  {
    pola: /\bhuman being(?!s?\b['’]?s?\s+(?:right|dignity))\b/gi,
    pesan: '"human being" kerap dipakai berlebihan sebagai terjemahan "manusia".',
    saran: "people / individuals",
    berat: "pertimbangkan",
  },
];

// ---------------------------------------------------------------------------
// 2. Klaim tanpa lindung nilai (hedging)
// ---------------------------------------------------------------------------
const KLAIM_MUTLAK: Aturan[] = [
  {
    pola: /\b(?:this )?(?:research|study|result|data|finding)s?\s+(?:prove|proves|proved)\b/gi,
    pesan: 'Penelitian sosial tidak "membuktikan". Klaim mutlak adalah alasan penolakan yang lazim.',
    saran: "suggests / indicates / provides evidence that",
    berat: "ganti",
  },
  {
    pola: /\b(?:clearly|obviously|certainly|definitely|undoubtedly) (?:shows?|proves?|indicates?)\b/gi,
    pesan: "Penegasan semacam ini melemahkan naskah, bukan menguatkannya.",
    saran: "Hapus keterangannya",
    berat: "ganti",
  },
  {
    pola: /\b(?:always|never) (?:happens?|occurs?|results? in|leads? to)\b/gi,
    pesan: "Klaim tanpa kecuali hampir selalu terlalu kuat untuk data sampel.",
    saran: "tends to / is likely to",
    berat: "rapikan",
  },
  {
    pola: /\bit is (?:certain|sure) that\b/gi,
    pesan: "Kepastian mutlak jarang dapat dipertahankan.",
    saran: "It appears that / The evidence suggests",
    berat: "rapikan",
  },
];

// ---------------------------------------------------------------------------
// 3. Ketaksederhanaan — frasa panjang yang punya padanan pendek
// ---------------------------------------------------------------------------
const BERTELE: Array<[RegExp, string]> = [
  [/\bin order to\b/gi, "to"],
  [/\bdue to the fact that\b/gi, "because"],
  [/\bdespite the fact that\b/gi, "although"],
  [/\bin the event that\b/gi, "if"],
  [/\bat this point in time\b/gi, "now"],
  [/\ba large number of\b/gi, "many"],
  [/\ba majority of\b/gi, "most"],
  [/\bis able to\b/gi, "can"],
  [/\bhas the ability to\b/gi, "can"],
  [/\bit is important to note that\b/gi, "(hapus)"],
  [/\bin terms of\b/gi, "(sering dapat dihapus)"],
  [/\bwith regard to\b/gi, "regarding"],
  [/\bfor the purpose of\b/gi, "to"],
  [/\bin the process of\b/gi, "(hapus)"],
  [/\btake into consideration\b/gi, "consider"],
  [/\bconduct an analysis of\b/gi, "analyse"],
  [/\bmake a decision\b/gi, "decide"],
];

// ---------------------------------------------------------------------------
// Pemeriksa
// ---------------------------------------------------------------------------

const AMBANG_KALIMAT_PANJANG = 40;

export function periksaInggris(teks: string): {
  temuan: TemuanInggris[];
  jumlahKata: number;
  jumlahKalimat: number;
  rataKataPerKalimat: number;
  kalimatPasifPersen: number;
  perAturan: Array<{ aturan: string; jumlah: number; berat: BeratInggris }>;
} {
  const temuan: TemuanInggris[] = [];
  const tambah = (t: TemuanInggris) => temuan.push(t);

  const jalankan = (daftar: Aturan[], namaAturan: string) => {
    for (const { pola, pesan, saran, berat } of daftar) {
      for (const cocok of teks.matchAll(pola)) {
        tambah({
          aturan: namaAturan,
          berat,
          kutipan: cocok[0].trim(),
          posisi: cocok.index ?? 0,
          pesan,
          saran,
        });
      }
    }
  };

  jalankan(KALKE, "Pola Indonesia yang diterjemahkan harfiah");
  jalankan(KLAIM_MUTLAK, "Klaim terlalu kuat");

  for (const [pola, ganti] of BERTELE) {
    for (const cocok of teks.matchAll(pola)) {
      tambah({
        aturan: "Bertele-tele",
        berat: "pertimbangkan",
        kutipan: cocok[0].trim(),
        posisi: cocok.index ?? 0,
        pesan: "Ada padanan yang lebih ringkas.",
        saran: ganti,
      });
    }
  }

  // Kalimat kepanjangan — batas Inggris lebih longgar daripada Indonesia.
  const kalimat = teks.split(/(?<=[.!?])\s+/).filter((k) => k.trim());
  let jalan = 0;
  for (const k of kalimat) {
    const posisi = teks.indexOf(k, jalan);
    jalan = posisi >= 0 ? posisi + k.length : jalan;
    const jumlah = k.trim().split(/\s+/).length;
    if (jumlah > AMBANG_KALIMAT_PANJANG) {
      tambah({
        aturan: "Kalimat kepanjangan",
        berat: "pertimbangkan",
        kutipan: k.trim().slice(0, 90) + (k.length > 90 ? "…" : ""),
        posisi: Math.max(0, posisi),
        pesan: `${jumlah} kata. Di atas ${AMBANG_KALIMAT_PANJANG} kata, peninjau kehilangan alur argumennya.`,
        saran: "Pecah menjadi dua kalimat",
      });
    }
  }

  // Kadar kalimat pasif — bukan kesalahan, tetapi kadar yang terlalu tinggi
  // membuat naskah sulit dibaca. Ditampilkan sebagai angka, bukan temuan.
  const pasif = kalimat.filter((k) =>
    /\b(?:is|are|was|were|been|being|be)\s+\w+(?:ed|en)\b/i.test(k),
  ).length;

  const jumlahKata = teks.trim() ? teks.trim().split(/\s+/).length : 0;
  temuan.sort((a, b) => a.posisi - b.posisi);

  const hitung = new Map<string, { jumlah: number; berat: BeratInggris }>();
  for (const t of temuan) {
    const ada = hitung.get(t.aturan);
    if (ada) ada.jumlah += 1;
    else hitung.set(t.aturan, { jumlah: 1, berat: t.berat });
  }

  return {
    temuan,
    jumlahKata,
    jumlahKalimat: kalimat.length,
    rataKataPerKalimat: kalimat.length ? Math.round((jumlahKata / kalimat.length) * 10) / 10 : 0,
    kalimatPasifPersen: kalimat.length ? Math.round((pasif / kalimat.length) * 100) : 0,
    perAturan: [...hitung.entries()]
      .map(([aturan, v]) => ({ aturan, jumlah: v.jumlah, berat: v.berat }))
      .sort((a, b) => b.jumlah - a.jumlah),
  };
}

// ---------------------------------------------------------------------------
// Pemeta BAB → IMRaD
// ---------------------------------------------------------------------------

export type BagianJurnal =
  | "abstract"
  | "introduction"
  | "literature"
  | "methods"
  | "results"
  | "discussion"
  | "conclusion"
  | "dibuang";

export const BAGIAN_LABEL: Record<BagianJurnal, string> = {
  abstract: "Abstract",
  introduction: "Introduction",
  literature: "Literature review",
  methods: "Methods",
  results: "Results",
  discussion: "Discussion",
  conclusion: "Conclusion",
  dibuang: "Tidak dibawa ke naskah",
};

/** Porsi kata yang lazim pada artikel jurnal ilmu sosial. */
export const PORSI_TARGET: Record<Exclude<BagianJurnal, "dibuang">, number> = {
  abstract: 0.035,
  introduction: 0.16,
  literature: 0.15,
  methods: 0.15,
  results: 0.24,
  discussion: 0.2,
  conclusion: 0.065,
};

type PolaBagian = { pola: RegExp; bagian: BagianJurnal; catatan: string };

// Diperiksa berurutan; yang lebih khusus didahulukan.
const PETA_JUDUL: PolaBagian[] = [
  { pola: /sistematika\s+penulisan/i, bagian: "dibuang", catatan: "Sistematika penulisan tidak ada pada artikel jurnal." },
  { pola: /manfaat\s+(?:penelitian|teoritis|praktis)/i, bagian: "dibuang", catatan: "Manfaat penelitian dilebur ke bagian akhir Introduction, biasanya satu kalimat." },
  { pola: /batasan\s+masalah|ruang\s+lingkup/i, bagian: "methods", catatan: "Batasan masalah menjadi bagian dari cakupan pada Methods." },
  { pola: /latar\s+belakang/i, bagian: "introduction", catatan: "Menjadi gerakan pertama CARS: menegakkan bidang penelitian." },
  { pola: /(?:rumusan|identifikasi)\s+masalah/i, bagian: "introduction", catatan: "Menjadi gerakan kedua CARS: menunjukkan celah. Ditulis sebagai pernyataan, bukan daftar pertanyaan." },
  { pola: /tujuan\s+penelitian/i, bagian: "introduction", catatan: "Menjadi gerakan ketiga CARS: mengisi celah, ditempatkan di akhir Introduction." },
  { pola: /penelitian\s+(?:terdahulu|relevan|sebelumnya)/i, bagian: "literature", catatan: "Inti Literature review — inilah yang paling dipertahankan dari BAB II." },
  { pola: /kerangka\s+(?:pemikiran|teori|konsep|berpikir)/i, bagian: "literature", catatan: "Diringkas menjadi beberapa paragraf yang memosisikan penelitian Anda." },
  { pola: /hipotesis/i, bagian: "literature", catatan: "Hipotesis ditempatkan di akhir Literature review." },
  { pola: /(?:landasan|kajian|tinjauan)\s+(?:teori|pustaka)/i, bagian: "literature", catatan: "Uraian teori dipangkas paling banyak — jurnal tidak memuat penjelasan buku teks." },
  { pola: /(?:metode|metodologi)\s+penelitian/i, bagian: "methods", catatan: "Ditulis dalam kala lampau." },
  { pola: /(?:populasi|sampel|teknik\s+pengambilan)/i, bagian: "methods", catatan: "Sertakan jumlah, cara pengambilan, dan alasannya." },
  { pola: /(?:teknik|instrumen)\s+(?:pengumpulan|analisis)\s+data/i, bagian: "methods", catatan: "Cukup ringkas; rincian panjang dipindahkan ke lampiran." },
  { pola: /(?:uji\s+validitas|uji\s+reliabilitas)/i, bagian: "methods", catatan: "Cukup satu paragraf berisi angkanya." },
  { pola: /(?:hasil\s+penelitian|hasil\s+dan\s+pembahasan|deskripsi\s+data|gambaran\s+umum)/i, bagian: "results", catatan: "Hanya temuan, tanpa penafsiran. Kala lampau." },
  { pola: /pembahasan|interpretasi/i, bagian: "discussion", catatan: "Hubungkan dengan penelitian terdahulu di Literature review, lalu sebutkan keterbatasan." },
  { pola: /(?:kesimpulan|simpulan|penutup)/i, bagian: "conclusion", catatan: "Tanpa mengulang angka; nyatakan sumbangan dan arah penelitian berikutnya." },
  { pola: /saran/i, bagian: "conclusion", catatan: "Dilebur ke Conclusion, bukan bagian tersendiri." },
  { pola: /(?:daftar\s+pustaka|referensi)/i, bagian: "dibuang", catatan: "Ditulis ulang mengikuti gaya sitasi jurnal tujuan." },
  { pola: /lampiran/i, bagian: "dibuang", catatan: "Lampiran umumnya tidak ikut, kecuali instrumen yang diminta." },
  { pola: /(?:kata\s+pengantar|halaman\s+pengesahan|motto|persembahan|riwayat\s+hidup|ucapan\s+terima\s+kasih)/i, bagian: "dibuang", catatan: "Bagian administratif skripsi, tidak ada pada artikel." },
  { pola: /abstrak/i, bagian: "abstract", catatan: "Ditulis ulang: latar, tujuan, metode, temuan utama berikut angkanya, dan implikasi." },
];

export type BagianSkripsi = {
  judul: string;
  bagian: BagianJurnal;
  catatan: string;
  jumlahKata: number;
  /** Target kata pada naskah jurnal. null untuk bagian yang dibuang. */
  targetKata: number | null;
};

export type PetaNaskah = {
  bagian: BagianSkripsi[];
  totalKataSkripsi: number;
  totalKataTarget: number;
  /** Porsi yang harus dipangkas, 0–1. */
  pemampatan: number;
  takTerpetakan: string[];
};

const POLA_JUDUL_BAB =
  /^\s*(?:BAB\s+[IVX]+\b.*|(?:\d+\.){1,3}\s*\S.*|[A-Z][A-Z\s,&-]{4,}|[A-Z]\.\s+\S.*)$/;

/**
 * Petakan naskah skripsi ke struktur artikel jurnal.
 *
 * Judul dikenali dari pola penomoran BAB dan subbab. Yang tidak cocok dengan
 * satu pun pola dilaporkan apa adanya supaya penulis memutuskan sendiri —
 * menebak akan lebih berbahaya daripada mengaku tidak tahu.
 */
export function petakanNaskah(teks: string, targetTotal = 7000): PetaNaskah {
  const baris = teks.split(/\r?\n/);
  const bagian: BagianSkripsi[] = [];
  const takTerpetakan: string[] = [];

  let judulKini: string | null = null;
  let bufferKata = 0;

  const tutup = () => {
    if (judulKini === null) return;
    const cocok = PETA_JUDUL.find((p) => p.pola.test(judulKini as string));
    if (cocok) {
      bagian.push({
        judul: judulKini,
        bagian: cocok.bagian,
        catatan: cocok.catatan,
        jumlahKata: bufferKata,
        targetKata: null,
      });
      // Judul BAB yang langsung disusul subbab tidak memuat teks sendiri.
      // Menampilkannya sebagai "0 kata" hanya menambah derau.
      if (bufferKata === 0) bagian.pop();
    } else if (bufferKata > 30) {
      takTerpetakan.push(judulKini);
    }
    judulKini = null;
    bufferKata = 0;
  };

  for (const b of baris) {
    const bersih = b.trim();
    if (!bersih) continue;
    const tampakJudul = bersih.length <= 90 && POLA_JUDUL_BAB.test(bersih);
    if (tampakJudul) {
      tutup();
      judulKini =
        bersih
          .replace(/^\s*(?:BAB\s+[IVX]+\s*)?/i, "")
          .replace(/^\d+(?:\.\d+)*\.?\s*/, "")
          .replace(/^[A-Z]\.\s*/, "")
          .trim() || bersih;
    } else if (judulKini !== null) {
      bufferKata += bersih.split(/\s+/).length;
    }
  }
  tutup();

  // Gabungkan bagian dengan tujuan yang sama untuk menghitung target.
  const kataPerBagian = new Map<BagianJurnal, number>();
  for (const s of bagian) {
    kataPerBagian.set(s.bagian, (kataPerBagian.get(s.bagian) ?? 0) + s.jumlahKata);
  }

  for (const s of bagian) {
    if (s.bagian === "dibuang") { s.targetKata = 0; continue; }
    const porsi = PORSI_TARGET[s.bagian];
    const totalBagian = kataPerBagian.get(s.bagian) ?? 0;
    const targetBagian = Math.round(targetTotal * porsi);
    // Bagi target secara proporsional bila satu tujuan diisi beberapa subbab.
    s.targetKata = totalBagian > 0 ? Math.round((s.jumlahKata / totalBagian) * targetBagian) : targetBagian;
  }

  const totalKataSkripsi = bagian.reduce((n, s) => n + s.jumlahKata, 0);
  const totalKataTarget = bagian.reduce((n, s) => n + (s.targetKata ?? 0), 0);

  return {
    bagian,
    totalKataSkripsi,
    totalKataTarget,
    pemampatan: totalKataSkripsi > 0 ? 1 - totalKataTarget / totalKataSkripsi : 0,
    takTerpetakan,
  };
}
