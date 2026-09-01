// ============================================================
// KAMUS KATEGORI UANG
//
// Bagian yang mengubah "beli nasi uduk 10k" menjadi kategori "jajan" tanpa
// pemiliknya perlu memilih apa pun dari daftar. Isinya kata-kata yang benar
// benar dipakai orang sehari-hari, bukan istilah akuntansi.
//
// Berkas ini SENGAJA tidak menyentuh database supaya boleh diimpor dari
// komponen client (kotak tulis di halaman /uang menampilkan tebakan sambil
// diketik) maupun dari server (jalur Telegram).
// ============================================================

export type Arah = "masuk" | "keluar";

export type Kategori = {
  /** Dipakai di basis data dan di alamat. Selalu huruf kecil tanpa spasi. */
  id: string;
  nama: string;
  /** "dua" berarti kategori ini menampung pemasukan maupun pengeluaran. */
  arah: Arah | "dua";
  ikon: string;
  warna: string;
  /**
   * Kata kunci penebak. Ditulis dalam bentuk dasarnya saja: pencocokan
   * membolehkan akhiran, jadi "makan" sudah ikut menangkap "makanan" dan
   * "makanannya".
   */
  kata: string[];
};

// Urutannya berarti: bila dua kategori sama-sama cocok dengan panjang kata
// yang sama, yang lebih dulu di daftar ini yang menang.
export const KATEGORI: Kategori[] = [
  // ---------- PEMASUKAN ----------
  {
    id: "gaji",
    nama: "Gaji & honor",
    arah: "masuk",
    ikon: "💼",
    warna: "#16a36b",
    kata: [
      "gaji", "gajian", "honor", "honorarium", "upah", "tunjangan", "thr",
      "insentif", "komisi", "bonus", "payroll", "uang saku", "kiriman",
      "transferan", "bayaran", "imbalan", "pensiun", "lembur", "tukin",
      "ngajar", "mengajar", "narasumber", "pemateri", "juri", "royalti",
      "dividen", "sertifikasi guru", "uang lelah", "amplop dinas",
    ],
  },
  {
    id: "usaha",
    nama: "Usaha & jualan",
    arah: "masuk",
    ikon: "🛍️",
    warna: "#0fa3b1",
    kata: [
      "jual", "jualan", "terjual", "laku", "omzet", "omset", "laba", "untung",
      "dagang", "orderan", "pesanan masuk", "olshop", "endorse", "freelance",
      "proyek", "panen", "setoran", "hasil sewa", "uang masuk toko",
    ],
  },
  {
    id: "hadiah",
    nama: "Hadiah & bantuan",
    arah: "masuk",
    ikon: "🎁",
    warna: "#8b5cf6",
    kata: [
      "hadiah", "kado", "angpao", "angpau", "menang", "doorprize", "giveaway",
      "hibah", "warisan", "beasiswa", "subsidi", "bantuan", "blt", "santunan",
      "sumbangan masuk", "dikasih", "dikirimi",
    ],
  },
  {
    id: "balik",
    nama: "Uang kembali",
    arah: "masuk",
    ikon: "↩️",
    warna: "#f59e42",
    kata: [
      "refund", "cashback", "kembalian", "pengembalian", "reimburse",
      "reimbursement", "klaim", "pelunasan", "utang dibayar", "piutang",
      "dibayar", "ditransfer", "tarik tabungan", "cair",
    ],
  },

  // ---------- PENGELUARAN ----------
  {
    id: "jajan",
    nama: "Makan & jajan",
    arah: "keluar",
    ikon: "🍚",
    warna: "#ef6a8a",
    kata: [
      "makan", "minum", "jajan", "cemilan", "camilan", "snack", "sarapan",
      "nasi", "mie", "bakso", "soto", "sate", "ayam", "geprek", "warteg",
      "warung", "angkringan", "gorengan", "martabak", "roti", "kue", "donat",
      "eskrim", "es krim", "es teh", "es kopi", "teh", "kopi", "boba", "jus",
      "susu", "seblak", "batagor", "siomay", "pecel", "gado", "rawon",
      "padang", "ketoprak", "bubur", "lontong", "ketupat", "rendang", "sambal",
      "gofood", "grabfood", "shopeefood", "mcd", "kfc", "hokben", "pizza",
      "burger", "sushi", "dimsum", "mixue", "chatime", "starbucks", "kantin",
      "katering", "kuliner", "traktir", "buka puasa", "sahur",
    ],
  },
  {
    id: "belanja",
    nama: "Belanja",
    arah: "keluar",
    ikon: "🧺",
    warna: "#1565d8",
    kata: [
      "belanja", "sembako", "beras", "minyak goreng", "telur", "gula",
      "garam", "bumbu", "sayur", "buah", "daging", "ikan", "pasar",
      "indomaret", "alfamart", "supermarket", "minimarket", "superindo",
      "hypermart", "tokopedia", "shopee", "lazada", "bukalapak", "blibli",
      "tiktok shop", "baju", "celana", "kaos", "kemeja", "jilbab", "kerudung",
      "sepatu", "sandal", "tas", "sabun", "sampo", "shampo", "odol",
      "pasta gigi", "deterjen", "pewangi", "tisu", "popok", "skincare",
      "kosmetik", "parfum", "galon", "gas", "elpiji", "perabot", "peralatan",
      "kasur", "bantal", "piring", "panci", "hp baru", "laptop", "charger",
      "kabel", "headset",
    ],
  },
  {
    id: "transportasi",
    nama: "Transportasi",
    arah: "keluar",
    ikon: "🛵",
    warna: "#0b4aa8",
    kata: [
      "bensin", "pertalite", "pertamax", "solar", "ojek", "ojol", "gojek",
      "grab", "maxim", "indriver", "angkot", "bus", "busway", "transjakarta",
      "kereta", "krl", "mrt", "lrt", "travel", "taksi", "tiket", "pesawat",
      "kapal", "parkir", "tol", "etoll", "e toll", "ongkir", "ongkos",
      "cuci motor", "cuci mobil", "oli", "helm", "sim", "perpanjang sim",
    ],
  },
  {
    id: "tagihan",
    nama: "Tagihan & langganan",
    arah: "keluar",
    ikon: "🧾",
    warna: "#f5c542",
    kata: [
      "listrik", "token", "pln", "pdam", "air", "wifi", "internet",
      "indihome", "biznet", "pulsa", "kuota", "paket data", "netflix",
      "spotify", "youtube premium", "disney", "vidio", "iqiyi", "viu",
      "langganan", "iuran", "sampah", "keamanan", "sewa", "kos", "kosan",
      "kontrakan", "cicilan", "angsuran", "kredit", "paylater", "kartu kredit",
      "pajak", "pbb", "stnk", "bpjs", "asuransi", "domain", "hosting",
      "zoom", "canva", "chatgpt",
    ],
  },
  {
    id: "kesehatan",
    nama: "Kesehatan",
    arah: "keluar",
    ikon: "💊",
    warna: "#dc2626",
    kata: [
      "obat", "apotek", "apotik", "dokter", "rumah sakit", "klinik",
      "puskesmas", "periksa", "berobat", "vitamin", "suplemen", "masker",
      "gigi", "opname", "lab", "rontgen", "terapi", "pijat", "urut", "vaksin",
      "imunisasi", "bidan", "melahirkan", "kacamata", "softlens", "sakit",
    ],
  },
  {
    id: "pendidikan",
    nama: "Pendidikan",
    arah: "keluar",
    ikon: "📚",
    warna: "#8b5cf6",
    kata: [
      "spp", "ukt", "kuliah", "semesteran", "daftar ulang", "buku", "kursus",
      "les", "bimbel", "seminar", "workshop", "pelatihan", "skripsi",
      "wisuda", "print", "ngeprint", "fotokopi", "jilid", "alat tulis", "atk",
      "pulpen", "kertas", "ujian", "praktikum", "kkn", "magang", "toefl",
      "sekolah", "modul", "lks", "seragam",
    ],
  },
  {
    id: "hiburan",
    nama: "Hiburan & gaya hidup",
    arah: "keluar",
    ikon: "🎬",
    warna: "#0fa3b1",
    kata: [
      "nonton", "bioskop", "film", "konser", "game", "top up", "topup",
      "diamond", "voucher game", "steam", "mobile legend", "liburan", "wisata",
      "jalan jalan", "healing", "staycation", "hotel", "penginapan", "villa",
      "karaoke", "mancing", "hobi", "gym", "futsal", "badminton", "renang",
      "salon", "potong rambut", "barbershop", "spa", "kafe", "cafe", "nongkrong",
    ],
  },
  {
    id: "sosial",
    nama: "Sosial & keluarga",
    arah: "keluar",
    ikon: "🤝",
    warna: "#16a36b",
    kata: [
      "sedekah", "zakat", "infak", "infaq", "donasi", "sumbangan", "amal",
      "kondangan", "nikahan", "kawinan", "amplop", "kado", "arisan",
      "patungan", "takziah", "jenguk", "oleh oleh", "buat ibu", "buat emak",
      "kirim ke ortu", "uang jajan anak", "uang jajan adik", "santunan anak",
    ],
  },
  {
    id: "tabungan",
    nama: "Tabungan & investasi",
    arah: "keluar",
    ikon: "🐖",
    warna: "#0a2a5e",
    kata: [
      "nabung", "menabung", "tabungan", "investasi", "reksadana", "saham",
      "emas", "deposito", "crypto", "dana darurat", "celengan", "setor tabungan",
    ],
  },
  {
    id: "tak-terduga",
    nama: "Biaya tak terduga",
    arah: "keluar",
    ikon: "⚡",
    warna: "#f59e42",
    kata: [
      "darurat", "mendadak", "dadakan", "tak terduga", "tiba tiba", "rusak",
      "benerin", "perbaikan", "servis", "bengkel", "tambal ban", "ban bocor",
      "derek", "denda", "tilang", "kehilangan", "hilang", "musibah",
      "kecelakaan", "ganti rugi", "bocor", "mati lampu", "banjir",
    ],
  },

  // ---------- PENUTUP ----------
  {
    id: "lainnya",
    nama: "Lainnya",
    arah: "dua",
    ikon: "•",
    warna: "#64748b",
    kata: [],
  },
];

export const KATEGORI_LAIN = "lainnya";

const PETA = new Map(KATEGORI.map((k) => [k.id, k]));

export function kategoriDari(id: string | null | undefined): Kategori {
  return PETA.get(String(id || "")) ?? PETA.get(KATEGORI_LAIN)!;
}

export function kategoriUntuk(arah: Arah): Kategori[] {
  return KATEGORI.filter((k) => k.arah === arah || k.arah === "dua");
}

/**
 * Menyeragamkan teks sebelum dicocokkan: huruf kecil, tanda baca menjadi
 * spasi, spasi rangkap dirapatkan, lalu diberi spasi di kedua ujungnya.
 *
 * Spasi di ujung itu yang membuat pencocokan berhenti di awal kata: mencari
 * " kopi" di dalam " fotokopi " tidak ketemu, jadi fotokopi tidak pernah
 * salah masuk kategori jajan.
 */
export function seragamkan(teks: string) {
  return ` ${teks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/** Kata muncul sebagai awal kata di dalam teks yang sudah diseragamkan. */
function memuat(teksRapi: string, kata: string) {
  return teksRapi.includes(` ${kata}`);
}

// Kata kerja yang hampir selalu berarti uang keluar, dipakai untuk memutuskan
// arah ketika pesannya tidak diawali + atau -. Diperiksa LEBIH DULU daripada
// kata pemasukan supaya "bayar gaji karyawan" tidak terbaca sebagai gajian.
const KATA_KELUAR = [
  "bayar", "beli", "belanja", "jajan", "isi", "top up", "topup", "keluar",
  "kasih", "ngasih", "sedekah", "zakat", "infak", "donasi", "sumbang",
  "ongkos", "biaya", "iuran", "cicil", "angsur", "servis", "sewa",
  "langganan", "traktir", "pesan", "order", "transfer ke", "kirim ke",
  "nabung", "menabung", "setor", "buat beli", "habis",
];

// Kata yang menandai uang masuk meski tanpa tanda +.
const KATA_MASUK = [
  "gaji", "gajian", "honor", "upah", "thr", "tunjangan", "bonus", "komisi",
  "insentif", "royalti", "dividen", "pensiun", "terima", "diterima", "dapat",
  "dapet", "masuk", "jual", "terjual", "laku", "laba", "untung", "omzet",
  "omset", "hadiah", "angpao", "angpau", "cashback", "refund", "kembalian",
  "menang", "hibah", "beasiswa", "subsidi", "warisan", "dibayar",
  "ditransfer", "dikirimi", "dikasih", "panen", "setoran", "cair",
  "pemasukan", "penghasilan",
];

/**
 * Menebak arah uang dari kalimatnya.
 *
 * Bawaannya "keluar". Alasannya sederhana: catatan harian orang hampir
 * seluruhnya pengeluaran, dan salah menebak pemasukan jauh lebih merusak
 * ringkasan bulanan daripada sebaliknya.
 */
export function tebakArah(catatan: string): Arah {
  const rapi = seragamkan(catatan);
  for (const kata of KATA_KELUAR) if (memuat(rapi, kata)) return "keluar";
  for (const kata of KATA_MASUK) if (memuat(rapi, kata)) return "masuk";
  return "keluar";
}

/**
 * Menebak kategori dari kalimatnya.
 *
 * Yang menang adalah kecocokan TERPANJANG, bukan yang pertama ketemu:
 * "nasi uduk" mengalahkan "nasi", dan "top up game" mengalahkan "game".
 * Arah ikut menyaring, jadi kata "kado" masuk ke Hadiah pada pemasukan dan
 * ke Sosial pada pengeluaran tanpa perlu dua kamus terpisah.
 */
export function tebakKategori(catatan: string, arah: Arah): string {
  const rapi = seragamkan(catatan);
  let juara = KATEGORI_LAIN;
  let panjang = 0;

  for (const kategori of KATEGORI) {
    if (kategori.arah !== "dua" && kategori.arah !== arah) continue;
    for (const kata of kategori.kata) {
      if (kata.length > panjang && memuat(rapi, kata)) {
        juara = kategori.id;
        panjang = kata.length;
      }
    }
  }
  return juara;
}

/**
 * Kategori yang ditulis sendiri oleh pemiliknya, mis. "#jajan" atau
 * "#tak terduga". Dicocokkan dengan id maupun namanya supaya "#makan" dan
 * "#jajan" sama-sama sampai.
 */
export function kategoriDariTanda(tanda: string): string | null {
  const rapi = seragamkan(tanda).trim().replace(/\s+/g, "-");
  if (!rapi) return null;
  const langsung = KATEGORI.find((k) => k.id === rapi);
  if (langsung) return langsung.id;

  const kata = rapi.replace(/-/g, " ");
  const lewatNama = KATEGORI.find((k) => seragamkan(k.nama).includes(` ${kata}`));
  if (lewatNama) return lewatNama.id;

  // Terakhir: perlakukan tandanya sebagai kata kunci biasa.
  for (const kategori of KATEGORI) {
    if (kategori.kata.some((k) => k === kata)) return kategori.id;
  }
  return null;
}
