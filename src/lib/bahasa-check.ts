// PERIKSA BAHASA — pemeriksa ragam ilmiah Bahasa Indonesia.
//
// Penelitian atas karya tulis mahasiswa Indonesia berulang kali menemukan
// bahwa 40–45% kesalahan terjadi di tataran ejaan: huruf kapital, penulisan
// kata depan, tanda baca, dan pemakaian kata tidak baku. Semuanya dapat
// diperiksa tanpa AI sama sekali.
//
// Seluruh pemeriksaan berjalan di peramban. Naskah tidak pernah dikirim ke
// mana pun — ini penting karena draf skripsi kerap memuat data responden.
//
// Rujukan: Pedoman Umum Ejaan Bahasa Indonesia (PUEBI/EYD) dan KBBI.

export type Berat = "salah" | "sebaiknya" | "gaya";

export type Temuan = {
  aturan: string;
  berat: Berat;
  /** Potongan teks yang ditandai. */
  kutipan: string;
  /** Posisi karakter pada naskah asli. */
  posisi: number;
  pesan: string;
  saran: string | null;
};

export type Ringkasan = {
  temuan: Temuan[];
  jumlahKata: number;
  jumlahKalimat: number;
  rataKataPerKalimat: number;
  perAturan: Array<{ aturan: string; jumlah: number; berat: Berat }>;
};

// ---------------------------------------------------------------------------
// Kata tidak baku yang paling sering muncul pada karya ilmiah mahasiswa.
// Kunci ditulis huruf kecil; pencocokan memakai batas kata.
// ---------------------------------------------------------------------------
const KATA_TIDAK_BAKU: Record<string, string> = {
  analisa: "analisis",
  aktifitas: "aktivitas",
  apotik: "apotek",
  atlit: "atlet",
  azas: "asas",
  detil: "detail",
  diagnosa: "diagnosis",
  effektif: "efektif",
  ekstrim: "ekstrem",
  faham: "paham",
  fikir: "pikir",
  formil: "formal",
  frekwensi: "frekuensi",
  hakekat: "hakikat",
  hipotesa: "hipotesis",
  ijasah: "ijazah",
  ijin: "izin",
  jadual: "jadwal",
  karir: "karier",
  kwalitas: "kualitas",
  kwantitas: "kuantitas",
  kwitansi: "kuitansi",
  konkrit: "konkret",
  kongkrit: "konkret",
  komplek: "kompleks",
  kreatifitas: "kreativitas",
  managemen: "manajemen",
  manajement: "manajemen",
  merubah: "mengubah",
  metoda: "metode",
  nasehat: "nasihat",
  obyek: "objek",
  obyektif: "objektif",
  praktek: "praktik",
  produktifitas: "produktivitas",
  propinsi: "provinsi",
  resiko: "risiko",
  rubah: "ubah",
  sekedar: "sekadar",
  silahkan: "silakan",
  sistim: "sistem",
  standarisasi: "standardisasi",
  subyek: "subjek",
  subyektif: "subjektif",
  syah: "sah",
  tehnik: "teknik",
  telpon: "telepon",
  terlanjur: "telanjur",
  trampil: "terampil",
  varitas: "varietas",
  jaman: "zaman",
  nampak: "tampak",
  ketrampilan: "keterampilan",
  himbau: "imbau",
  himbauan: "imbauan",
  antri: "antre",
  antrian: "antrean",
  disain: "desain",
  kordinasi: "koordinasi",
  aktifis: "aktivis",
  sportifitas: "sportivitas",
  efektifitas: "efektivitas",
  konsekwensi: "konsekuensi",
  prosentase: "persentase",
  prosen: "persen",
  hutang: "utang",
  lembab: "lembap",
  nomer: "nomor",
  pebruari: "Februari",
  nopember: "November",
  rapot: "rapor",
  seksama: "saksama",
  tauladan: "teladan",
  terimakasih: "terima kasih",
  kemana: "ke mana",
  dimana: "di mana",
  disamping: "di samping",
  didalam: "di dalam",
  diluar: "di luar",
  diatas: "di atas",
  dibawah: "di bawah",
  diantara: "di antara",
  kedalam: "ke dalam",
};

// Akar kata serapan Yunani yang berakhiran -a padahal seharusnya -is. Bentuk
// berimbuhannya sangat lazim ("menganalisa", "dianalisa", "penganalisaan"),
// sehingga pencocokan kata utuh saja akan melewatkannya.
const AKAR_BERIMBUHAN: Record<string, string> = {
  analisa: "analisis",
  hipotesa: "hipotesis",
  diagnosa: "diagnosis",
  sintesa: "sintesis",
  aktifitas: "aktivitas",
  kreatifitas: "kreativitas",
  produktifitas: "produktivitas",
  efektifitas: "efektivitas",
  praktek: "praktik",
  obyek: "objek",
  subyek: "subjek",
};

// Awalan dan akhiran yang boleh melekat tanpa mengubah bentuk akarnya.
const AWALAN = ["meng", "men", "mem", "me", "di", "ter", "ber", "peng", "pen", "pem", "per", "se", "ke"];
const AKHIRAN = ["kan", "nya", "an", "i"];

// Kata yang tidak boleh dipakai sebagai kata depan terpisah karena sebenarnya
// awalan pasif. Dipakai untuk mendeteksi "di sebut" (salah) vs "di sana" (benar).
// Daftar kata yang SAH mengikuti kata depan "di"/"ke" (keterangan tempat).
const TEMPAT_SAH = new Set([
  "sini", "situ", "sana", "mana", "atas", "bawah", "dalam", "luar", "depan",
  "belakang", "samping", "antara", "tengah", "sekitar", "seberang", "balik",
  "muka", "pinggir", "tepi", "ujung", "pusat", "rumah", "kampus", "kelas",
  "kantor", "sekolah", "kota", "desa", "daerah", "wilayah", "lokasi", "tempat",
  "jalan", "gedung", "ruang", "lantai", "halaman", "indonesia", "jakarta",
  "tangerang", "bandung", "surabaya", "fisip", "umt", "perpustakaan",
  "laboratorium", "lapangan", "masjid", "pasar", "bagian", "sisi", "arah",
]);

// Kata sambung yang tidak boleh mengawali kalimat pada ragam ilmiah.
const PEMBUKA_TERLARANG = ["sehingga", "sedangkan", "yaitu", "yakni", "tetapi", "namun demikian"];

// Kata percakapan yang tidak dipakai pada ragam ilmiah.
const RAGAM_LISAN: Record<string, string> = {
  bikin: "membuat",
  bilang: "menyatakan",
  kayak: "seperti",
  gimana: "bagaimana",
  kenapa: "mengapa",
  nggak: "tidak",
  enggak: "tidak",
  udah: "sudah",
  banget: "sangat",
  ngasih: "memberikan",
  ngambil: "mengambil",
  dapetin: "memperoleh",
  cuma: "hanya",
  cuman: "hanya",
  gitu: "seperti itu",
  emang: "memang",
  kalo: "kalau",
  jadinya: "sehingga",
  nah: "",
  sih: "",
  dong: "",
};

const BULAN = [
  "januari", "februari", "maret", "april", "mei", "juni",
  "juli", "agustus", "september", "oktober", "november", "desember",
];

// Kata yang kerap dipakai berpasangan secara mubazir.
const MUBAZIR: Array<[RegExp, string, string]> = [
  [/\badalah\s+merupakan\b/gi, "adalah merupakan", "adalah"],
  [/\bagar\s+supaya\b/gi, "agar supaya", "agar"],
  [/\bdemi\s+untuk\b/gi, "demi untuk", "untuk"],
  [/\bsangat\s+.{0,12}?\s*sekali\b/gi, "sangat … sekali", "pilih salah satu"],
  [/\bnamun\s+akan\s+tetapi\b/gi, "namun akan tetapi", "namun"],
  [/\bseperti\s+misalnya\b/gi, "seperti misalnya", "misalnya"],
  [/\bantara\s+lain\s+adalah\b/gi, "antara lain adalah", "antara lain"],
  [/\bsaling\s+ber\w+an\b/gi, "saling ber…an", "pilih salah satu bentuk"],
  [/\bpara\s+\w+[- ]\w+\b/gi, "para + kata ulang", "cukup salah satu penanda jamak"],
  [/\bdisebabkan\s+karena\b/gi, "disebabkan karena", "disebabkan oleh"],
  [/\bdikarenakan\s+oleh\b/gi, "dikarenakan oleh", "karena"],
  [/\bmengapa\s+sebabnya\b/gi, "mengapa sebabnya", "mengapa"],
];

const AMBANG_KALIMAT_PANJANG = 35;

function batasKata(kata: string) {
  return new RegExp(`(?<![\\p{L}\\p{N}-])${kata.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}-])`, "giu");
}

/**
 * Buang blok yang tidak boleh diperiksa: kutipan langsung dan daftar pustaka.
 * Diganti spasi agar posisi karakter tetap sejajar dengan naskah asli.
 */
function samarkanKutipan(teks: string) {
  return teks.replace(/[""][^""]{0,600}[""]|"[^"\n]{0,600}"/g, (cocok) => " ".repeat(cocok.length));
}

export function periksaBahasa(teksAsli: string): Ringkasan {
  const teks = samarkanKutipan(teksAsli);
  const temuan: Temuan[] = [];

  const tambah = (t: Temuan) => temuan.push(t);

  // --- 1. Kata depan "di"/"ke" yang seharusnya dirangkai -------------------
  // "di sebutkan" salah; "di sana" benar. Pembeda: kata yang mengikuti.
  const kataDepan = /(?<![\p{L}\p{N}-])(di|ke)\s+(\p{L}+)/giu;
  for (const cocok of teks.matchAll(kataDepan)) {
    const depan = cocok[1].toLowerCase();
    const berikut = cocok[2].toLowerCase();
    if (TEMPAT_SAH.has(berikut)) continue;
    // Kata berawalan huruf kapital umumnya nama tempat.
    if (/^\p{Lu}/u.test(cocok[2])) continue;
    // Hanya tandai bila kata berikutnya berupa kata kerja pasif yang jelas.
    const kerjaPasif = /^(lakukan|laksanakan|sebut|sebutkan|jelaskan|gunakan|pakai|buat|ambil|bahas|teliti|analisis|kaji|ukur|amati|catat|olah|peroleh|dapat|hasilkan|tetapkan|tentukan|pilih|susun|rancang|uji|nilai|beri|berikan|tunjukkan|temukan|kelola|atur|kembangkan|terapkan|anggap|harapkan|perlukan|butuhkan|maksud|artikan|sajikan|paparkan|gambarkan|urai|uraikan)\w*$/;
    if (!kerjaPasif.test(berikut)) continue;
    tambah({
      aturan: "Kata depan dan awalan",
      berat: "salah",
      kutipan: cocok[0],
      posisi: cocok.index ?? 0,
      pesan: `"${depan}" di sini adalah awalan, bukan kata depan, jadi harus dirangkai.`,
      saran: `${depan}${berikut}`,
    });
  }

  // --- 2. Kata tidak baku ---------------------------------------------------
  const sudahDitandai = new Set<number>();

  // 2a. Bentuk berimbuhan lebih dulu, supaya "menganalisa" tertangkap utuh
  //     dan tidak dilaporkan dua kali oleh pencocokan kata utuh di bawah.
  const gugusAwalan = AWALAN.join("|");
  const gugusAkhiran = AKHIRAN.join("|");
  for (const [akar, benar] of Object.entries(AKAR_BERIMBUHAN)) {
    const pola = new RegExp(
      `(?<![\\p{L}\\p{N}-])(${gugusAwalan})?(${akar})((?:${gugusAkhiran}))?(?![\\p{L}\\p{N}-])`,
      "giu",
    );
    for (const cocok of teks.matchAll(pola)) {
      const posisi = cocok.index ?? 0;
      const awalan = cocok[1] ?? "";
      const akhiran = cocok[3] ?? "";
      // Tanpa imbuhan apa pun, biarkan pencocokan kata utuh yang menangani.
      if (!awalan && !akhiran) continue;
      sudahDitandai.add(posisi);
      tambah({
        aturan: "Kata tidak baku",
        berat: "salah",
        kutipan: cocok[0],
        posisi,
        pesan: `Akar "${akar}" tidak baku menurut KBBI; bentuk bakunya "${benar}".`,
        saran: `${awalan}${benar}${akhiran}`,
      });
    }
  }

  // 2b. Kata utuh.
  for (const [salah, benar] of Object.entries(KATA_TIDAK_BAKU)) {
    if (salah === benar) continue;
    for (const cocok of teks.matchAll(batasKata(salah))) {
      const posisi = cocok.index ?? 0;
      if (sudahDitandai.has(posisi)) continue;
      sudahDitandai.add(posisi);
      tambah({
        aturan: "Kata tidak baku",
        berat: "salah",
        kutipan: cocok[0],
        posisi,
        pesan: `"${cocok[0]}" tidak baku menurut KBBI.`,
        saran: benar,
      });
    }
  }

  // --- 3. Ragam lisan -------------------------------------------------------
  for (const [lisan, ganti] of Object.entries(RAGAM_LISAN)) {
    for (const cocok of teks.matchAll(batasKata(lisan))) {
      tambah({
        aturan: "Ragam lisan",
        berat: "sebaiknya",
        kutipan: cocok[0],
        posisi: cocok.index ?? 0,
        pesan: `"${cocok[0]}" adalah ragam percakapan, tidak dipakai dalam karya ilmiah.`,
        saran: ganti || "hapus",
      });
    }
  }

  // --- 4. "di mana" sebagai kata penghubung --------------------------------
  // Penulisannya benar sebagai keterangan tempat, tetapi sebagai penghubung
  // ia serapan dari "where" dan tidak lazim dalam ragam ilmiah Indonesia.
  for (const cocok of teks.matchAll(/(?<![\p{L}\p{N}-])(?:di|ke)\s+mana\b/giu)) {
    const posisi = cocok.index ?? 0;
    const sebelum = teks.slice(Math.max(0, posisi - 40), posisi);
    // Kalimat tanya yang sah biasanya diawali/berakhir tanda tanya.
    const kalimatTanya = /[?]\s*$/.test(teks.slice(posisi, posisi + 60)) || /\b(apa|siapa|kapan|bagaimana)\b/i.test(sebelum);
    if (kalimatTanya) continue;
    // Sebagai penghubung, biasanya didahului kata benda lalu koma opsional.
    if (!/[\p{L}]\s*,?\s*$/u.test(sebelum)) continue;
    tambah({
      aturan: "Penghubung serapan",
      berat: "sebaiknya",
      kutipan: cocok[0],
      posisi,
      pesan: `"${cocok[0]}" sebagai kata penghubung adalah serapan dari "where". Dalam ragam ilmiah Indonesia gunakan "yang", "tempat", atau pecah kalimatnya.`,
      saran: "yang / tempat",
    });
  }

  // --- 5. Pasangan mubazir --------------------------------------------------
  for (const [pola, nama, ganti] of MUBAZIR) {
    for (const cocok of teks.matchAll(pola)) {
      tambah({
        aturan: "Kalimat tidak efektif",
        berat: "sebaiknya",
        kutipan: cocok[0].trim(),
        posisi: cocok.index ?? 0,
        pesan: `"${nama}" mubazir — dua kata dengan makna sama dipakai bersamaan.`,
        saran: ganti,
      });
    }
  }

  // --- 6. Huruf kapital pada nama bulan ------------------------------------
  for (const bulan of BULAN) {
    for (const cocok of teks.matchAll(batasKata(bulan))) {
      if (/^\p{Lu}/u.test(cocok[0])) continue;
      tambah({
        aturan: "Huruf kapital",
        berat: "salah",
        kutipan: cocok[0],
        posisi: cocok.index ?? 0,
        pesan: "Nama bulan ditulis dengan huruf kapital.",
        saran: bulan.charAt(0).toUpperCase() + bulan.slice(1),
      });
    }
  }

  // --- 7. Tanda baca --------------------------------------------------------
  for (const cocok of teks.matchAll(/\s+([,.;:!?])/g)) {
    tambah({
      aturan: "Tanda baca",
      berat: "salah",
      kutipan: cocok[0].replace(/\s+/g, "␣"),
      posisi: cocok.index ?? 0,
      pesan: `Tidak ada spasi sebelum tanda "${cocok[1]}".`,
      saran: cocok[1],
    });
  }
  for (const cocok of teks.matchAll(/([,;:])(?=[\p{L}])/gu)) {
    tambah({
      aturan: "Tanda baca",
      berat: "salah",
      kutipan: teks.slice(cocok.index ?? 0, (cocok.index ?? 0) + 12),
      posisi: cocok.index ?? 0,
      pesan: `Perlu satu spasi sesudah tanda "${cocok[1]}".`,
      saran: `${cocok[1]} `,
    });
  }
  for (const cocok of teks.matchAll(/\.{2,}(?!\.)|\.{4,}/g)) {
    if (cocok[0].length === 3) continue; // elipsis
    tambah({
      aturan: "Tanda baca",
      berat: "salah",
      kutipan: cocok[0],
      posisi: cocok.index ?? 0,
      pesan: "Titik berlebih.",
      saran: ".",
    });
  }

  // --- 8. Kata sambung di awal kalimat -------------------------------------
  for (const kata of PEMBUKA_TERLARANG) {
    const pola = new RegExp(`(?:^|[.!?]\\s+)(${kata})\\b`, "gi");
    for (const cocok of teks.matchAll(pola)) {
      const posisi = (cocok.index ?? 0) + cocok[0].indexOf(cocok[1]);
      tambah({
        aturan: "Kata sambung di awal kalimat",
        berat: "sebaiknya",
        kutipan: cocok[1],
        posisi,
        pesan: `"${cocok[1]}" menghubungkan bagian dalam satu kalimat, jadi tidak lazim mengawali kalimat baru.`,
        saran: kata === "sehingga" ? "Oleh karena itu" : kata === "sedangkan" ? "Sementara itu" : null,
      });
    }
  }

  // --- 9. Kalimat kepanjangan ----------------------------------------------
  const kalimat = teksAsli.split(/(?<=[.!?])\s+/).filter((k) => k.trim().length > 0);
  let jalan = 0;
  for (const k of kalimat) {
    const posisi = teksAsli.indexOf(k, jalan);
    jalan = posisi >= 0 ? posisi + k.length : jalan;
    const kata = k.trim().split(/\s+/).length;
    if (kata > AMBANG_KALIMAT_PANJANG) {
      tambah({
        aturan: "Kalimat kepanjangan",
        berat: "gaya",
        kutipan: k.trim().slice(0, 90) + (k.length > 90 ? "…" : ""),
        posisi: Math.max(0, posisi),
        pesan: `Kalimat ini ${kata} kata. Di atas ${AMBANG_KALIMAT_PANJANG} kata, pembaca mudah kehilangan subjeknya.`,
        saran: "Pecah menjadi dua kalimat.",
      });
    }
  }

  // --- Ringkasan ------------------------------------------------------------
  const jumlahKata = teksAsli.trim() ? teksAsli.trim().split(/\s+/).length : 0;
  const jumlahKalimat = kalimat.length;

  temuan.sort((a, b) => a.posisi - b.posisi);

  const hitung = new Map<string, { jumlah: number; berat: Berat }>();
  for (const t of temuan) {
    const ada = hitung.get(t.aturan);
    if (ada) ada.jumlah += 1;
    else hitung.set(t.aturan, { jumlah: 1, berat: t.berat });
  }

  return {
    temuan,
    jumlahKata,
    jumlahKalimat,
    rataKataPerKalimat: jumlahKalimat ? Math.round((jumlahKata / jumlahKalimat) * 10) / 10 : 0,
    perAturan: [...hitung.entries()]
      .map(([aturan, v]) => ({ aturan, jumlah: v.jumlah, berat: v.berat }))
      .sort((a, b) => b.jumlah - a.jumlah),
  };
}

export const BERAT_LABEL: Record<Berat, string> = {
  salah: "Salah menurut PUEBI/KBBI",
  sebaiknya: "Sebaiknya diperbaiki",
  gaya: "Pertimbangkan",
};
