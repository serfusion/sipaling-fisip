// MEMBACA CERITA MAHASISWA
//
// Mahasiswa yang bingung tidak datang dengan variabel bebas dan variabel
// terikat. Ia datang dengan kalimat seperti "aku pengen neliti soal anak
// muda yang kena FOMO gara-gara TikTok, tapi bingung metodenya apa". Formulir
// tujuh langkah menuntut ia sudah tahu jawabannya sebelum bertanya, dan di
// situlah kebanyakan orang berhenti.
//
// Berkas ini membaca kalimat itu dan mengeluarkan isian yang sama dengan yang
// biasa diisi tangan, lengkap dengan potongan kalimat yang menjadi dasarnya.
//
// TIDAK ADA MODEL BAHASA DI SINI, dan itu disengaja. Yang bekerja adalah
// kamus dan pola: kosakata metodologi Indonesia jumlahnya terbatas, dan
// "pengaruh A terhadap B" selalu berarti hal yang sama. Akibatnya:
//
//   - naskah tidak pernah meninggalkan perangkat, sama seperti alat lain;
//   - tidak ada yang dikarang. Kalau sesuatu tidak ditemukan, ia dinyatakan
//     tidak ditemukan lalu ditanyakan, bukan ditebak diam-diam;
//   - tiap tafsiran dapat ditunjukkan asalnya di kalimat mahasiswa sendiri.
//
// Yang keluar dari sini tetap dugaan, dan mahasiswa dapat membetulkannya
// lewat formulir yang sama seperti sebelumnya.

import {
  JENIS_KERJA, JENIS_LABEL, JENIS_UMUM, KESULITAN, METODE_POLA, PENDEKATAN,
  PRODI_LABEL, URUT_MUDAH, metodeProdi, prodiBerdaftar, rancang,
} from "./metodologi";
import type { Jenis, Pendekatan, Rancangan } from "./metodologi";
import type { Data, Masukan, Prodi, Tujuan, Unit } from "./metodologi";

export type Yakin = "kuat" | "sedang" | "terka";

export type Temuan = {
  bidang: string;
  nilai: string;
  /** Potongan kalimat mahasiswa yang menjadi dasarnya. */
  bukti: string | null;
  yakin: Yakin;
};

export type Bacaan = {
  masukan: Masukan;
  temuan: Temuan[];
  /** Yang belum terbaca, ditulis sebagai pertanyaan yang bisa dijawab. */
  pertanyaan: string[];
  /** Satu paragraf: cerita mahasiswa dibacakan ulang dalam bahasa metode. */
  ringkas: string;
  /** Cukup untuk disusun menjadi rancangan? */
  cukup: boolean;
  jumlahKata: number;
  /** Nama media yang disebut, dipakai jalur analisis isi. */
  media: string;
  /** Nama lembaga yang disebut, dipakai jalur studi kasus. */
  lembaga: string;
  /** Populasi orang yang disebut, dipakai jalur pengaruh dan fenomenologi. */
  orang: string;
};

export const MINIMAL_KATA = 12;

export type Jalur = "kuantitatif" | "kualitatif";

export type ContohIde = {
  id: string;
  /** Nama pendek untuk penanda jalurnya. */
  label: string;
  jalur: Jalur;
  cerita: string;
};

/**
 * Empat contoh cerita untuk tiap prodi.
 *
 * Isinya mengikuti empat rancangan yang paling sering selesai di prodi
 * tersebut, berurutan dari yang paling ringan. Ilmu Komunikasi berangkat dari
 * pengaruh, analisis isi, analisis framing, dan semiotika; Ilmu Pemerintahan
 * dari pengaruh, efektivitas program, implementasi kebijakan, dan peran
 * pemerintah. Daftarnya memang tidak sama, dan itu justru yang membuat
 * pertanyaan prodi di awal ada gunanya.
 *
 * Tiap cerita ditulis seperti mahasiswa bercerita, bukan seperti proposal.
 * Yang tertera pada tombolnya hanya nama pendek rancangannya; judulnya sengaja
 * tidak dibocorkan lebih dulu, karena kejutannya justru terletak pada empat
 * judul yang keluar sesudah tombolnya ditekan.
 */
export const CONTOH_IDE: Record<"komunikasi" | "pemerintahan", ContohIde[]> = {
  komunikasi: [
    {
      id: "pengaruh",
      label: "Pengaruh",
      jalur: "kuantitatif",
      cerita:
        "Aku mau meneliti mahasiswa Ilmu Komunikasi di Universitas Serang Raya. Aku menduga " +
        "bahwa intensitas menonton TikTok dan terpaan konten kreator berpengaruh terhadap " +
        "perilaku komunikasi interpersonal, tapi lewat literasi media digital dulu. Jadi " +
        "literasi media digital sebagai variabel intervening. Rencananya sebar kuesioner, " +
        "populasinya sekitar 600 mahasiswa, target responden 240 orang.",
    },
    {
      id: "isi",
      label: "Analisis Isi",
      jalur: "kualitatif",
      cerita:
        "Saya mau melakukan analisis isi pesan persuasif pada konten Instagram selama Januari " +
        "sampai Maret 2025. Yang ingin saya tahu, kategori pesan mana yang paling sering " +
        "muncul dan bagaimana kecenderungannya. Kontennya saya kumpulkan sebagai dokumen " +
        "supaya bisa dikoding ulang oleh koder kedua.",
    },
    {
      id: "framing",
      label: "Analisis Framing",
      jalur: "kualitatif",
      cerita:
        "Saya ingin meneliti bagaimana media online membingkai pemberitaan kebijakan kenaikan " +
        "tarif parkir di Kota Serang. Rencananya pakai analisis framing, membandingkan bingkai " +
        "yang dipakai dua media online selama Februari sampai April 2025. Beritanya saya " +
        "kumpulkan sebagai dokumen.",
    },
    {
      id: "semiotika",
      label: "Semiotika",
      jalur: "kualitatif",
      cerita:
        "Saya tertarik membaca representasi perempuan dalam film Marlina si Pembunuh dalam " +
        "Empat Babak. Rencananya pakai analisis semiotika untuk membaca tanda pada adegan " +
        "dan dialognya, sampai ke makna yang terbangun di baliknya. Bahannya potongan " +
        "adegan film itu sendiri, saya simpan sebagai dokumen.",
    },
  ],
  pemerintahan: [
    {
      id: "pengaruh",
      label: "Pengaruh",
      jalur: "kuantitatif",
      cerita:
        "Aku mau meneliti masyarakat di Kantor Kecamatan Serang. Aku menduga bahwa kualitas " +
        "pelayanan publik dan kompetensi aparatur berpengaruh terhadap kepuasan masyarakat, " +
        "tapi lewat kepercayaan masyarakat dulu. Jadi kepercayaan masyarakat sebagai variabel " +
        "intervening. Rencananya sebar kuesioner, populasinya sekitar 900 warga, target " +
        "responden 280 orang.",
    },
    {
      id: "efektivitas",
      label: "Efektivitas",
      jalur: "kuantitatif",
      cerita:
        "Saya ingin menilai efektivitas program pelayanan administrasi kependudukan di Dinas " +
        "Kependudukan dan Pencatatan Sipil Kota Serang. Sejauh mana program itu mencapai " +
        "sasaran yang ditetapkan, dan apa yang menghambatnya. Rencananya sebar kuesioner ke " +
        "warga yang pernah mengurus dokumen, ditambah laporan resmi dinasnya.",
    },
    {
      id: "implementasi",
      label: "Implementasi Kebijakan",
      jalur: "kualitatif",
      cerita:
        "Saya ingin meneliti implementasi kebijakan penanganan sampah di Kota Serang. " +
        "Bagaimana kebijakan itu dijalankan di lapangan, siapa saja pelaksananya, dan apa " +
        "saja hambatannya. Rencananya wawancara pejabat Dinas Lingkungan Hidup dan petugas " +
        "kebersihan, serta mengumpulkan dokumen peraturannya.",
    },
    {
      id: "peran",
      label: "Peran Pemerintah",
      jalur: "kualitatif",
      cerita:
        "Saya ingin meneliti peran pemerintah desa dalam pemberdayaan masyarakat lewat " +
        "program BUMDes di Desa Sukajaya. Bagaimana peran itu dijalankan dan apa yang " +
        "menghambatnya. Rencananya wawancara kepala desa, pengurus BUMDes, dan warga " +
        "penerima manfaat, ditambah dokumen laporan desa.",
    },
  ],
};

/** Contoh bawaan untuk sebuah prodi. */
export function contohProdi(prodi: Prodi): ContohIde[] {
  return CONTOH_IDE[prodiBerdaftar(prodi)];
}

// ---------------------------------------------------------------------------
// EMPAT JALUR DARI SATU CERITA
// ---------------------------------------------------------------------------
//
// Satu topik hampir selalu bisa diteliti lebih dari satu cara, dan mahasiswa
// yang bingung biasanya tidak tahu itu. Ia mengira "metodeku apa" adalah
// pertanyaan yang jawabannya satu, padahal jawabannya bergantung pada
// pertanyaan mana yang ingin ia ajukan.
//
// Karena itu satu cerita dikeluarkan menjadi empat judul sekaligus, satu untuk
// tiap rancangan yang paling sering dipakai di FISIP. Yang berubah hanya
// bentuk pertanyaannya; topik, orang, dan tempatnya tetap milik mahasiswa.
//
// Jalur yang paling sesuai dengan ceritanya sendiri ditandai, supaya yang
// disodorkan bukan empat pilihan tanpa arah melainkan satu anjuran beserta
// tiga kemungkinan lain.

export type JalurAlternatif = {
  id: Jenis;
  label: string;
  jalur: Jalur;
  judul: string;
  metode: string;
  metodeResmi: string;
  metodePola: string;
  pendekatan: Pendekatan;
  kesulitan: 1 | 2 | 3;
  kerja: string;
  masukan: Masukan;
  rancangan: Rancangan;
  /** Rancangan ini yang paling sesuai dengan cerita aslinya. */
  pas: boolean;
};

/** Bagian judul yang memang harus diisi sendiri mahasiswa. Ditulis terbuka
 *  sebagai isian, bukan ditebak, karena ceritanya tidak menyebutnya. */
function slot(nama: string) {
  return `[sebutkan ${nama}]`;
}

/**
 * Topik tanpa embel-embel medianya.
 *
 * "intensitas menonton TikTok" adalah nama variabel yang benar untuk
 * penelitian pengaruh, tetapi untuk analisis isi yang diteliti bukan
 * menontonnya melainkan isinya, dan medianya pindah menjadi tempat teks itu
 * berada. Tanpa pembersihan ini, judul analisis isinya berbunyi "Analisis Isi
 * Intensitas Menonton TikTok dalam TikTok".
 *
 * Bila yang tersisa sesudah medianya dibuang ternyata kosong, itu bukan
 * kegagalan melainkan keterangan: ceritanya memang belum menyebut isi apa
 * yang mau dihitung. Yang dikembalikan kemudian isian, bukan tebakan.
 */
function topikInti(x: string, media: string) {
  let t = x;
  if (media) {
    const lolos = media.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`\\s*\\b(?:di|pada|dalam|lewat|melalui)\\s+${lolos}\\b.*$`, "i"), "");
    t = t.replace(new RegExp(`\\s*\\b${lolos}\\b\\s*`, "gi"), " ");
  }
  // Kata pembuka yang mengubah nama gagasan menjadi nama ukuran dibuang
  // berulang: "intensitas penggunaan TikTok" harus tinggal "TikTok", bukan
  // "penggunaan TikTok".
  let sebelum = "";
  while (sebelum !== t) {
    sebelum = t;
    t = t.replace(/^(?:terpaan|intensitas|frekuensi|penggunaan|pemakaian|menonton|tingkat|kualitas)\s+/i, "");
  }
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Satu cerita, empat rancangan.
 *
 * Yang ditawarkan bukan empat rancangan sembarang, melainkan empat yang
 * paling sering diselesaikan mahasiswa di prodi itu, berurutan dari yang
 * paling ringan. Rancangan yang memang paling sesuai ceritanya sendiri selalu
 * ikut, walaupun ia berada di luar empat besar, dan ia yang ditandai.
 *
 * Yang berubah antar rancangan hanya bentuk pertanyaannya; topik, orang, dan
 * tempatnya tetap milik mahasiswa.
 */
export function empatJalur(b: Bacaan): JalurAlternatif[] {
  const m = b.masukan;
  const media = b.media;
  const prodi = prodiBerdaftar(m.prodi);
  const asli = rancang(m).jenis;

  const inti = topikInti(m.variabelX, media);
  // Variabel terikat hanya sah bila ia memang sesuatu yang bisa berubah pada
  // diri responden. Nama media bukan variabel terikat, dan begitu pula
  // pekerjaan yang tertangkap dari cerita berbentuk proses.
  const yTerbaca = m.tujuan === "pengaruh" || m.tujuan === "hubungan" || m.tujuan === "perbedaan" ? m.variabelY : "";
  const terikat = yTerbaca && yTerbaca !== media ? yTerbaca : slot("yang dipengaruhi");
  const orang = b.orang || m.objek;
  const lembaga = b.lembaga || m.objek;

  /** Isian tiap rancangan. Yang tidak disebut ceritanya ditulis terbuka. */
  function cetak(jenis: Jenis): Partial<Masukan> {
    const teks = { unit: "teks" as Unit, data: ["dokumen"] as Data[], variabelX2: "", variabelZ: "" };
    const lapangan = { unit: "organisasi" as Unit, data: ["wawancara", "dokumen"] as Data[], variabelX2: "", variabelZ: "" };
    switch (jenis) {
      case "kuantitatif-eksplanatif":
        return { tujuan: "pengaruh", unit: "individu", data: ["kuesioner"], variabelY: terikat, objek: orang || slot("respondennya") };
      case "kuantitatif-korelasional":
        return { tujuan: "hubungan", unit: "individu", data: ["kuesioner"], variabelY: terikat, objek: orang || slot("respondennya") };
      case "kuantitatif-deskriptif":
        return { tujuan: "gambaran", unit: "individu", data: ["kuesioner"], variabelX: inti || m.variabelX, variabelX2: "", variabelZ: "", objek: orang || slot("respondennya") };
      case "uses-gratifications":
        return { tujuan: "hubungan", unit: "individu", data: ["kuesioner"], variabelX: media || inti || m.variabelX, variabelX2: "", variabelZ: "", variabelY: yTerbaca || slot("kebutuhan yang dipenuhi"), objek: orang || slot("respondennya") };
      case "efektivitas-program":
        return { tujuan: "evaluasi", unit: "kebijakan", data: ["kuesioner", "dokumen"], variabelX: inti || m.variabelX, variabelX2: "", variabelZ: "", variabelY: yTerbaca || slot("sasaran programnya"), objek: orang || slot("penerima manfaatnya") };
      case "analisis-isi":
        return { ...teks, tujuan: "isi", variabelX: inti || slot("isi yang dihitung"), variabelY: media || slot("medianya"), lokasi: media ? "" : m.lokasi };
      case "analisis-framing":
        return { ...teks, tujuan: "isi", variabelX: inti || slot("peristiwa yang diberitakan"), variabelY: media || slot("medianya"), lokasi: "" };
      case "semiotika":
        return { ...teks, tujuan: "makna", variabelX: inti || slot("yang direpresentasikan"), variabelY: media || slot("film atau iklannya"), lokasi: "" };
      case "analisis-kebijakan":
        return { ...teks, unit: "kebijakan", data: ["dokumen", "wawancara"], tujuan: "isi", variabelX: inti || slot("kebijakannya"), variabelY: yTerbaca || slot("bidang yang diatur") };
      case "fenomenologi":
        return { tujuan: "makna", unit: "individu", data: ["wawancara"], variabelX: inti || m.variabelX, variabelX2: "", variabelZ: "", objek: orang || slot("informannya") };
      case "studi-kasus":
        return { tujuan: "proses", unit: "organisasi", data: ["wawancara", "dokumen", "observasi"], variabelX: inti || m.variabelX, variabelX2: "", variabelZ: "", variabelY: yTerbaca, objek: lembaga || slot("lembaganya") };
      case "implementasi-kebijakan":
        return { ...lapangan, unit: "kebijakan", tujuan: "proses", variabelX: inti || slot("kebijakannya"), variabelY: yTerbaca || slot("bidang yang diatur"), objek: lembaga || slot("lembaga pelaksananya") };
      case "peran-pemerintah":
        return { ...lapangan, tujuan: "proses", variabelX: inti || m.variabelX, variabelY: yTerbaca, objek: lembaga || slot("lembaga pemerintahnya") };
      case "governance":
        return { ...lapangan, tujuan: "gambaran", variabelX: inti || m.variabelX, objek: lembaga || slot("lembaganya") };
      case "strategi-pemerintah":
        return { ...lapangan, tujuan: "proses", variabelX: inti || m.variabelX, variabelY: yTerbaca || slot("sasarannya"), objek: lembaga || slot("lembaganya") };
      case "strategi-komunikasi":
        return { ...lapangan, tujuan: "proses", variabelX: inti || m.variabelX, variabelY: yTerbaca || slot("sasarannya"), objek: lembaga || slot("lembaganya") };
      default:
        return { tujuan: "gambaran", unit: "individu", data: ["wawancara"], variabelX: inti || m.variabelX, variabelX2: "", variabelZ: "", objek: orang || slot("informannya") };
    }
  }

  function buat(jenis: Jenis): JalurAlternatif {
    // Rancangan yang memang sesuai ceritanya dipakai apa adanya, tanpa dicor
    // ulang. Hasil bacaan aslinya selalu lebih rapi daripada hasil
    // penyesuaian, karena ia tidak perlu menambal apa pun.
    const pas = jenis === asli;
    const masukan: Masukan = pas ? { ...m, metode: jenis } : { ...m, ...cetak(jenis), metode: jenis };
    // Nama tempat yang sudah termuat pada nama yang diteliti hanya akan
    // tercetak dua kali di judul yang sama.
    const o = masukan.objek.toLowerCase();
    const l = masukan.lokasi.toLowerCase();
    if (o && l && (o === l || o.includes(l) || l.includes(o))) masukan.lokasi = "";
    const rancangan = rancang(masukan);
    // Judul cadangan dipakai bila judul pertama masih memuat nama pengganti
    // bawaan, yang berarti ceritanya belum menyebut bagian itu.
    const judul =
      rancangan.judul.find((j) => !/variabel (terikat|bebas)|objek penelitian/i.test(j)) ?? rancangan.judul[0];
    return {
      id: jenis,
      label: JENIS_UMUM[jenis],
      jalur: PENDEKATAN[jenis],
      judul,
      metode: JENIS_UMUM[jenis],
      metodeResmi: JENIS_LABEL[jenis],
      metodePola: METODE_POLA[jenis],
      pendekatan: PENDEKATAN[jenis],
      kesulitan: KESULITAN[jenis],
      kerja: JENIS_KERJA[jenis],
      masukan,
      rancangan,
      pas,
    };
  }

  const empat = URUT_MUDAH[prodi].slice(0, 4);
  // Rancangan yang paling sesuai ceritanya sendiri wajib ikut. Bila ia berada
  // di luar empat besar, yang paling berat di antara keempatnya yang mundur.
  const daftar = empat.includes(asli) ? empat : [...empat.slice(0, 3), asli];
  return daftar.map(buat);
}

// ---------------------------------------------------------------------------
// Perkakas kecil
// ---------------------------------------------------------------------------

/** Kata yang tidak boleh menjadi ujung sebuah frasa variabel. */
const EKOR_BUANG = new RegExp(
  "\\s+(?:yang|itu|ini|nya|adalah|akan|bisa|dapat|sangat|sudah|masih|juga|dan|atau|" +
    "dengan|untuk|dari|pada|di|ke|dalam|terhadap|karena|sehingga|tapi|tetapi|kalau|" +
    "jika|serta|maupun|lebih|paling|banyak|para|si|sang|mereka|kita|kami|saya|anda|" +
    "benar-benar|beneran|memang|sebenarnya|sih|nih|tuh|banget|sekali|tuh)$",
  "i",
);

const KEPALA_BUANG = new RegExp(
  "^(?:soal|tentang|mengenai|masalah|perihal|kaitan|hal|adanya|si|sang|para|" +
    "bagaimana|apakah|seberapa|adanya|tahu|ingin|pengen|kepengen|mau|bahwa|kalau|" +
    "jika|ternyata|memang|benarkah|makin|semakin|lebih|sering|tinggi|rendah|naik|" +
    "turun|banyak|kurang|nggak|ya|gak|tidak|jadi|menjadi)\\s+",
  "i",
);

/** Rapikan sebuah frasa hasil tangkapan pola supaya layak jadi nama variabel. */
function rapikanFrasa(mentah: string | undefined, maksKata = 8): string {
  if (!mentah) return "";
  let f = mentah
    .replace(/["“”'’()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Potong pada tanda baca atau kata sambung yang mengakhiri gagasan.
  // Titik dan koma di antara angka ("Kompas.com", "1.200") bukan tanda
  // pemenggal kalimat, jadi tidak boleh memotong frasa di situ.
  f = f.split(/[;:!?]|[.,](?=\s|$)|\bkarena\b|\bsehingga\b|\bsedangkan\b|\btapi\b|\btetapi\b|\blewat\b|\bmelalui\b/i)[0].trim();

  // Kata pengantar yang terakhir menandai awal gagasannya. Dipakai serakah
  // dengan sengaja: pada "Aku pengen tahu apakah terpaan konten berita…",
  // yang menjadi variabel adalah bagian sesudah "apakah", bukan sesudah "tahu".
  f = f.replace(/^.*\b(?:apakah|bahwa|kalau|jika|yaitu|yakni|ternyata|tahu|soal|bahwasanya)\s+/i, "");

  let sebelum = "";
  while (f !== sebelum) {
    sebelum = f;
    f = f.replace(KEPALA_BUANG, "").replace(EKOR_BUANG, "").trim();
  }

  const kata = f.split(/\s+/).filter(Boolean);
  if (kata.length > maksKata) f = kata.slice(0, maksKata).join(" ");
  return f.trim();
}

/** Kalimat tempat sebuah pola ditemukan, untuk ditunjukkan sebagai bukti. */
function kalimatSekitar(teks: string, posisi: number) {
  // Titik pemisah kalimat saja: titik di dalam "Kompas.com" tidak mengakhiri
  // apa pun, dan memotong di situ menghasilkan bukti yang terpenggal.
  const pemisah = /[.!?](?=\s|$)/g;
  let awal = 0;
  let akhir = teks.length;
  for (const m of teks.matchAll(pemisah)) {
    const i = m.index ?? 0;
    if (i < posisi) awal = i + 1;
    else { akhir = i + 1; break; }
  }
  const potong = teks.slice(awal, akhir).trim();
  return potong.length > 180 ? `${potong.slice(0, 177)}…` : potong;
}

type Cocok = { nilai: string; bukti: string; posisi: number };

// ---------------------------------------------------------------------------
// 1. Apa yang ingin diketahui
// ---------------------------------------------------------------------------

type Isyarat = { pola: RegExp; bobot: number };

const ISYARAT_TUJUAN: Record<Tujuan, Isyarat[]> = {
  pengaruh: [
    { pola: /\bpengaruh(?:nya)?\b/gi, bobot: 3 },
    { pola: /\b(?:mem|di)pengaruhi\b/gi, bobot: 3 },
    { pola: /\bberpengaruh\b/gi, bobot: 3 },
    { pola: /\bdampak(?:nya)?\b/gi, bobot: 2 },
    { pola: /\befek(?:nya)?\b/gi, bobot: 2 },
    { pola: /\bakibat(?:nya)?\b/gi, bobot: 1 },
    { pola: /\bberdampak\b/gi, bobot: 2 },
    { pola: /\bkontribusi\b/gi, bobot: 1 },
    { pola: /\bgara-gara\b/gi, bobot: 1 },
    { pola: /\bmakin\s+\w+\s+makin\b/gi, bobot: 2 },
    { pola: /\bsemakin\s+\w+\s+semakin\b/gi, bobot: 2 },
  ],
  hubungan: [
    { pola: /\bhubungan(?:nya)?\b/gi, bobot: 3 },
    { pola: /\bkorelasi\b/gi, bobot: 3 },
    { pola: /\bketerkaitan\b/gi, bobot: 3 },
    { pola: /\bkaitan(?:nya)?\b/gi, bobot: 2 },
    { pola: /\bberkaitan\s+dengan\b/gi, bobot: 2 },
    { pola: /\bberhubungan\b/gi, bobot: 2 },
  ],
  perbedaan: [
    { pola: /\bperbedaan\b/gi, bobot: 3 },
    { pola: /\bmembandingkan\b/gi, bobot: 3 },
    { pola: /\bperbandingan\b/gi, bobot: 3 },
    { pola: /\bkomparasi\b/gi, bobot: 3 },
    { pola: /\bdibandingkan\s+(?:dengan|antara)\b/gi, bobot: 2 },
    { pola: /\bbeda(?:nya)?\s+(?:antara|dengan)\b/gi, bobot: 2 },
  ],
  gambaran: [
    { pola: /\bgambaran\b/gi, bobot: 3 },
    { pola: /\bseberapa\s+(?:banyak|besar|tinggi|sering)\b/gi, bobot: 2 },
    { pola: /\btingkat\s+\w+/gi, bobot: 2 },
    { pola: /\bmendeskripsikan\b/gi, bobot: 2 },
    { pola: /\bbagaimana\s+(?:kondisi|keadaan)\b/gi, bobot: 2 },
    { pola: /\bpotret\b/gi, bobot: 1 },
  ],
  makna: [
    { pola: /\bmakna(?:nya)?\b/gi, bobot: 3 },
    { pola: /\bmemaknai\b/gi, bobot: 3 },
    { pola: /\bpengalaman\b/gi, bobot: 3 },
    { pola: /\bfenomenologi\b/gi, bobot: 4 },
    { pola: /\bpersepsi\b/gi, bobot: 2 },
    { pola: /\bdirasakan\b/gi, bobot: 2 },
    { pola: /\bmotif\b/gi, bobot: 2 },
    { pola: /\bpandangan\s+(?:mereka|informan)\b/gi, bobot: 2 },
    { pola: /\bkenapa\s+(?:mereka|orang)\b/gi, bobot: 2 },
  ],
  proses: [
    { pola: /\bstrategi\b/gi, bobot: 3 },
    { pola: /\bimplementasi\b/gi, bobot: 3 },
    { pola: /\bpenerapan\b/gi, bobot: 3 },
    { pola: /\bpelaksanaan\b/gi, bobot: 3 },
    { pola: /\bupaya\b/gi, bobot: 2 },
    { pola: /\bperan(?:an)?\b/gi, bobot: 2 },
    { pola: /\bmekanisme\b/gi, bobot: 2 },
    { pola: /\bproses\b/gi, bobot: 2 },
    { pola: /\bbagaimana\s+\w+\s+(?:menjalankan|melakukan|mengelola)\b/gi, bobot: 3 },
    { pola: /\bhambatan\b/gi, bobot: 1 },
  ],
  isi: [
    { pola: /\banalisis\s+isi\b/gi, bobot: 4 },
    { pola: /\banalisis\s+wacana\b/gi, bobot: 4 },
    { pola: /\bsemiotika\b/gi, bobot: 4 },
    { pola: /\bframing\b/gi, bobot: 3 },
    { pola: /\bpembingkaian\b/gi, bobot: 3 },
    { pola: /\bpemberitaan\b/gi, bobot: 3 },
    { pola: /\brepresentasi\b/gi, bobot: 3 },
    { pola: /\bisi\s+(?:pesan|berita|konten)\b/gi, bobot: 3 },
    { pola: /\bnarasi\b/gi, bobot: 1 },
  ],
  evaluasi: [
    { pola: /\bevaluasi\b/gi, bobot: 4 },
    { pola: /\befektivitas\b/gi, bobot: 3 },
    { pola: /\bkeberhasilan\b/gi, bobot: 3 },
    { pola: /\bberhasil\s+(?:atau\s+tidak|apa\s+tidak)\b/gi, bobot: 3 },
    { pola: /\bcapaian\b/gi, bobot: 2 },
    { pola: /\bsudah\s+(?:tepat\s+sasaran|berjalan\s+baik)\b/gi, bobot: 2 },
    { pola: /\btepat\s+sasaran\b/gi, bobot: 2 },
  ],
};

/** Bila skornya seri, yang lebih khusus didahulukan. */
const URUT_TUJUAN: Tujuan[] = [
  "evaluasi", "isi", "makna", "perbedaan", "pengaruh", "hubungan", "proses", "gambaran",
];

function bacaTujuan(t: string): { tujuan: Tujuan; bukti: string | null; yakin: Yakin } {
  const skor = new Map<Tujuan, number>();
  let buktiTerbaik: string | null = null;
  let bobotBukti = 0;

  for (const [tujuan, isyarat] of Object.entries(ISYARAT_TUJUAN) as Array<[Tujuan, Isyarat[]]>) {
    let jumlah = 0;
    for (const { pola, bobot } of isyarat) {
      for (const m of t.matchAll(pola)) {
        jumlah += bobot;
        if (bobot > bobotBukti && typeof m.index === "number") {
          bobotBukti = bobot;
          buktiTerbaik = kalimatSekitar(t, m.index);
        }
      }
    }
    if (jumlah > 0) skor.set(tujuan, jumlah);
  }

  if (skor.size === 0) {
    return { tujuan: "gambaran", bukti: null, yakin: "terka" };
  }

  const tertinggi = Math.max(...skor.values());
  const pemenang = URUT_TUJUAN.find((j) => skor.get(j) === tertinggi) ?? "gambaran";
  const beda = tertinggi - Math.max(0, ...[...skor.values()].filter((v) => v !== tertinggi));
  const yakin: Yakin = tertinggi >= 3 && beda >= 2 ? "kuat" : tertinggi >= 2 ? "sedang" : "terka";
  return { tujuan: pemenang, bukti: buktiTerbaik, yakin };
}

// ---------------------------------------------------------------------------
// 2. Yang diteliti itu apa
// ---------------------------------------------------------------------------

const KATA_UNIT: Record<Unit, RegExp[]> = {
  teks: [
    /\b(?:berita|pemberitaan|artikel|headline|judul berita)\b/gi,
    /\b(?:tiktok|instagram|twitter|facebook|youtube|whatsapp|threads)\b/gi,
    /\b(?:iklan|film|sinetron|poster|meme|konten|unggahan|postingan|caption|komentar warganet)\b/gi,
    /\b(?:media massa|media online|portal berita|surat kabar|koran|majalah|kanal)\b/gi,
    /\b(?:kompas|detik|tribun|tempo|liputan6|cnn indonesia|antara)\b/gi,
  ],
  kebijakan: [
    /\b(?:kebijakan|peraturan daerah|perda|perbup|perwal|undang-undang|permen)\b/gi,
    /\b(?:program|bantuan sosial|bansos|blt|pkh|subsidi|dana desa|jkn|bpjs)\b/gi,
    /\b(?:layanan publik|pelayanan publik|e-government|smart city|samsat|adminduk)\b/gi,
  ],
  organisasi: [
    /\b(?:dinas|badan|kantor|kecamatan|kelurahan|pemerintah desa|pemdes|pemda|pemkot|pemkab)\b/gi,
    /\b(?:dprd|dpr|kpu|bawaslu|bpbd|dukcapil|puskesmas|rsud)\b/gi,
    /\b(?:perusahaan|pt |cv |umkm|startup|bank|hotel|koperasi)\b/gi,
    /\b(?:partai|ormas|lsm|komunitas|organisasi|humas|public relations|divisi)\b/gi,
    /\b(?:sekolah|kampus|universitas|fakultas|yayasan)\b/gi,
  ],
  individu: [
    /\b(?:mahasiswa|siswa|pelajar|remaja|anak muda|gen ?z|generasi z|milenial)\b/gi,
    /\b(?:warga|masyarakat|penduduk|ibu rumah tangga|petani|nelayan|pedagang)\b/gi,
    /\b(?:pegawai|karyawan|asn|pns|aparatur|guru|dosen|perawat|staf)\b/gi,
    /\b(?:pemilih|konstituen|responden|informan|pelanggan|konsumen|pengguna|followers|netizen)\b/gi,
  ],
};

/** Yang lebih khusus didahulukan bila skornya seri. */
const URUT_UNIT: Unit[] = ["teks", "kebijakan", "organisasi", "individu"];

function bacaUnit(t: string, tujuan: Tujuan): { unit: Unit; bukti: string | null; yakin: Yakin } {
  const skor = new Map<Unit, number>();
  const bukti = new Map<Unit, string>();

  for (const [unit, pola] of Object.entries(KATA_UNIT) as Array<[Unit, RegExp[]]>) {
    let jumlah = 0;
    for (const p of pola) {
      for (const m of t.matchAll(p)) {
        jumlah += 1;
        if (!bukti.has(unit) && typeof m.index === "number") bukti.set(unit, kalimatSekitar(t, m.index));
      }
    }
    if (jumlah > 0) skor.set(unit, jumlah);
  }

  // Yang diteliti adalah orangnya, walaupun media disebut-sebut: "pengaruh
  // TikTok terhadap mahasiswa" mengukur mahasiswa, bukan TikTok. Yang
  // menentukan bukan kata mana yang paling sering muncul, melainkan apakah
  // pertanyaannya menuntut pengukuran pada orang.
  const keOrang: Tujuan[] = ["pengaruh", "hubungan", "perbedaan"];
  if (keOrang.includes(tujuan) && (skor.get("individu") ?? 0) > 0) {
    return { unit: "individu", bukti: bukti.get("individu") ?? null, yakin: "kuat" };
  }
  if (tujuan === "isi") {
    return { unit: "teks", bukti: bukti.get("teks") ?? null, yakin: (skor.get("teks") ?? 0) > 0 ? "kuat" : "sedang" };
  }
  if (tujuan === "evaluasi" && (skor.get("kebijakan") ?? 0) > 0) {
    return { unit: "kebijakan", bukti: bukti.get("kebijakan") ?? null, yakin: "kuat" };
  }

  if (skor.size === 0) return { unit: "individu", bukti: null, yakin: "terka" };
  const tertinggi = Math.max(...skor.values());
  const unit = URUT_UNIT.find((u) => skor.get(u) === tertinggi) ?? "individu";
  return { unit, bukti: bukti.get(unit) ?? null, yakin: tertinggi >= 2 ? "kuat" : "sedang" };
}

// ---------------------------------------------------------------------------
// 3. Cara mengumpulkan data
// ---------------------------------------------------------------------------

// Sengaja tanpa bendera global: String.match pada pola global tidak
// mengembalikan letak temuannya, sehingga kalimat buktinya tidak dapat diambil.
const KATA_DATA: Record<Data, RegExp[]> = {
  kuesioner: [/\b(?:kuesioner|kuisioner|angket|survei|survey|skala likert|sebar\w*\s+(?:ke\s+)?\w*responden)\b/i],
  wawancara: [/\b(?:wawancara|interview|narasumber|informan|ngobrol dengan|tanya langsung)\b/i],
  dokumen: [/\b(?:dokumen|arsip|data sekunder|laporan (?:resmi|tahunan|dinas)|notula|unggahan|postingan|dokumentasi)\b/i],
  observasi: [/\b(?:observasi|pengamatan|mengamati|turun ke lapangan|ikut kegiatan)\b/i],
};

/** Bila tidak disebut sama sekali, cara yang memang dituntut tujuannya. */
const DATA_BAWAAN: Record<Tujuan, Data[]> = {
  pengaruh: ["kuesioner"],
  hubungan: ["kuesioner"],
  perbedaan: ["kuesioner"],
  gambaran: ["kuesioner"],
  makna: ["wawancara"],
  proses: ["wawancara", "dokumen"],
  isi: ["dokumen"],
  evaluasi: ["wawancara", "dokumen"],
};

function bacaData(t: string, tujuan: Tujuan): { data: Data[]; bukti: string | null; yakin: Yakin } {
  const ketemu: Data[] = [];
  let bukti: string | null = null;
  for (const [jenis, pola] of Object.entries(KATA_DATA) as Array<[Data, RegExp[]]>) {
    for (const p of pola) {
      const m = t.match(p);
      if (m && typeof m.index === "number") {
        ketemu.push(jenis);
        if (!bukti) bukti = kalimatSekitar(t, m.index);
        break;
      }
    }
  }
  if (ketemu.length > 0) return { data: ketemu, bukti, yakin: "kuat" };
  return { data: DATA_BAWAAN[tujuan], bukti: null, yakin: "terka" };
}

// ---------------------------------------------------------------------------
// 4. Variabel
// ---------------------------------------------------------------------------

/** Batas kanan sebuah frasa variabel.
 *
 *  Tanda baca hanya menghentikan frasa bila ia memang mengakhiri kata:
 *  "Kompas.com" dan "1.200" harus lewat utuh. Keterangan waktu ikut
 *  menghentikan, karena "selama Januari sampai Maret" bukan bagian dari nama
 *  variabel maupun nama media. */
const HENTI =
  "(?=\\s*(?:[.,;:](?=\\s|$)|$|\\bdi\\b|\\bpada\\b|\\bdalam\\b|\\bselama\\b|\\bsejak\\b|" +
  "\\bperiode\\b|\\bedisi\\b|\\bsepanjang\\b|\\bkarena\\b|\\bsehingga\\b|\\bdengan demikian\\b))";

/** Batas kiri untuk pola yang variabel bebasnya berada di depan kata kerja.
 *
 *  Tanpa ini, "Aku pengen tahu apakah terpaan konten berita di TikTok itu
 *  benar-benar berpengaruh terhadap …" menghasilkan variabel bebas yang
 *  diawali "Aku pengen tahu apakah". Yang dicari adalah awal gagasannya, dan
 *  gagasan selalu dimulai sesudah tanda baca atau kata pengantar semacam ini. */
const MULAI =
  "(?:^|[.,;:]\\s*|\\b(?:apakah|bahwa|kalau|jika|yaitu|yakni|ternyata|tahu|soal|bahwasanya)\\s+)";

type PolaVariabel = {
  pola: RegExp;
  /** Tangkapan pertama sebenarnya variabel terikat, bukan bebas. Terjadi pada
   *  rumusan komparatif: "membandingkan Y antara kelompok A dan B". */
  balik?: boolean;
};

// \b di depan "pengaruh" penting: tanpa itu, pola ini ikut tersulut di tengah
// kata "berpengaruh", lalu menangkap potongan kalimat yang salah.
const POLA_DUA_VARIABEL: PolaVariabel[] = [
  { pola: new RegExp(`\\bpengaruh(?:nya)?\\s+(?:dari\\s+)?(.{3,70}?)\\s+(?:terhadap|pada|atas|ke)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`\\bdampak(?:nya)?\\s+(?:dari\\s+)?(.{3,70}?)\\s+(?:terhadap|pada|bagi|atas)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`\\befek(?:nya)?\\s+(?:dari\\s+)?(.{3,70}?)\\s+(?:terhadap|pada|bagi)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`\\bhubungan(?:nya)?\\s+(?:antara\\s+)?(.{3,70}?)\\s+(?:dengan|dan|terhadap)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`\\bkorelasi\\s+(?:antara\\s+)?(.{3,70}?)\\s+(?:dengan|dan)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`\\bketerkaitan\\s+(?:antara\\s+)?(.{3,70}?)\\s+(?:dengan|dan)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`\\bmembandingkan\\s+(.{3,70}?)\\s+(?:antara|pada)\\s+(.{3,70}?)${HENTI}`, "i"), balik: true },
  { pola: new RegExp(`\\bperbandingan\\s+(.{3,70}?)\\s+(?:antara|pada)\\s+(.{3,70}?)${HENTI}`, "i"), balik: true },
  { pola: new RegExp(`\\bperbedaan\\s+(.{3,70}?)\\s+antara\\s+(.{3,70}?)${HENTI}`, "i"), balik: true },
  { pola: new RegExp(`${MULAI}(.{3,70}?)\\s+(?:mem|di)pengaruhi\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`${MULAI}(.{3,70}?)\\s+berpengaruh\\s+(?:terhadap|pada)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`${MULAI}(.{3,70}?)\\s+berdampak\\s+(?:terhadap|pada|bagi)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`${MULAI}(.{3,70}?)\\s+berkaitan\\s+dengan\\s+(.{3,70}?)${HENTI}`, "i") },
  // "makin sering buka TikTok, makin turun minat baca"
  { pola: new RegExp(`(?:makin|semakin)\\s+(.{3,60}?)\\s*,\\s*(?:makin|semakin)\\s+(.{3,60}?)${HENTI}`, "i") },
];

/** Untuk rancangan berbasis teks: gagasan yang diteliti dan medianya. */
const POLA_TEKS: PolaVariabel[] = [
  { pola: new RegExp(`(?:pemberitaan|berita|representasi|citra|framing|pembingkaian|narasi|konten|wacana)\\s+(?:tentang\\s+|soal\\s+|mengenai\\s+)?(.{3,70}?)\\s+(?:di|pada|dalam|oleh)\\s+(.{3,60}?)${HENTI}`, "i") },
  { pola: new RegExp(`analisis\\s+(?:isi|wacana|semiotika)\\s+(?:pada\\s+|terhadap\\s+)?(.{3,70}?)\\s+(?:di|pada|dalam)\\s+(.{3,60}?)${HENTI}`, "i") },
];

/** Untuk rancangan proses dan evaluasi: apa yang dikerjakan dan sasarannya. */
const POLA_PROSES: PolaVariabel[] = [
  { pola: new RegExp(`(?:strategi|upaya|peran|peranan|implementasi|penerapan|pelaksanaan|evaluasi)\\s+(.{3,70}?)\\s+(?:dalam|untuk|terhadap|guna)\\s+(.{3,70}?)${HENTI}`, "i") },
];

/** Satu gagasan saja, tanpa lawan. Dipakai pada rancangan yang memang tidak
 *  berpasangan variabel: proses, evaluasi, dan gambaran. */
const POLA_SATU: RegExp[] = [
  new RegExp(`(?:strategi|upaya|peranan|peran|implementasi|penerapan|pelaksanaan|evaluasi|efektivitas|gambaran|tingkat)\\s+(?:dari\\s+|program\\s+)?(.{3,70}?)${HENTI}`, "i"),
];

/**
 * Kosakata variabel yang paling sering muncul pada skripsi FISIP.
 *
 * Dipakai hanya sebagai jaring terakhir, ketika mahasiswa tidak menulis
 * hubungan antarvariabel secara terang-terangan. Urutannya penting: yang
 * lebih panjang lebih dulu, supaya "kualitas pelayanan publik" tidak keburu
 * tertangkap sebagai "pelayanan publik".
 */
const KONSEP = [
  "kualitas pelayanan publik", "kualitas pelayanan", "pelayanan publik",
  "partisipasi masyarakat", "partisipasi politik", "perilaku memilih", "pilihan politik",
  "literasi digital", "literasi media", "literasi politik", "minat baca", "minat beli",
  "terpaan media", "terpaan iklan", "intensitas penggunaan media sosial",
  "penggunaan media sosial", "media sosial", "konten digital",
  "citra lembaga", "citra perusahaan", "citra diri", "brand awareness", "brand image",
  "kepuasan masyarakat", "kepuasan kerja", "kepuasan pelanggan",
  "kinerja pegawai", "kinerja aparatur", "kinerja organisasi", "kinerja karyawan",
  "motivasi kerja", "disiplin kerja", "budaya organisasi", "gaya kepemimpinan", "kepemimpinan",
  "komunikasi organisasi", "komunikasi interpersonal", "komunikasi pemasaran", "komunikasi politik",
  "efektivitas komunikasi", "strategi komunikasi", "strategi humas", "hubungan masyarakat",
  "akuntabilitas", "transparansi", "good governance", "e-government", "digitalisasi",
  "kualitas informasi", "kepercayaan publik", "kepercayaan masyarakat",
  "kesadaran hukum", "kepatuhan", "loyalitas", "keputusan pembelian",
  "perilaku konsumtif", "gaya hidup", "konsep diri", "kecemasan sosial",
  "fear of missing out", "fomo", "kesehatan mental", "kesejahteraan psikologis",
  "prestasi belajar", "hasil belajar", "motivasi belajar",
  "efektivitas program", "implementasi kebijakan", "pengawasan", "pemberdayaan masyarakat",
];

function cariKonsep(t: string): Array<{ nilai: string; posisi: number }> {
  const rendah = t.toLowerCase();
  const hasil: Array<{ nilai: string; posisi: number }> = [];
  const dipakai: Array<[number, number]> = [];

  for (const k of KONSEP) {
    let dari = 0;
    for (;;) {
      const p = rendah.indexOf(k, dari);
      if (p < 0) break;
      dari = p + k.length;
      // Lewati bila sudah tertutup konsep lain yang lebih panjang.
      if (dipakai.some(([a, b]) => p >= a && p < b)) continue;
      dipakai.push([p, p + k.length]);
      hasil.push({ nilai: t.slice(p, p + k.length), posisi: p });
    }
  }
  return hasil.sort((a, b) => a.posisi - b.posisi);
}

type Variabel = {
  x: string;
  /** Variabel bebas kedua, bila ceritanya menyebut dua sebab. */
  x2: string;
  /** Variabel antara, bila ceritanya menyebut jalur tidak langsung. */
  z: string;
  y: string;
  bukti: string | null;
  yakin: Yakin;
};

/**
 * Pisahkan "A dan B" menjadi dua variabel bebas.
 *
 * Model dua sebab adalah bentuk paling lazim pada skripsi kuantitatif FISIP:
 * "pengaruh lingkungan kerja dan kompensasi terhadap kepuasan". Yang tidak
 * boleh ikut terpisah adalah nama lembaga yang memang mengandung "dan",
 * seperti Dinas Komunikasi dan Informatika, jadi frasa yang berhuruf kapital
 * di awal dilewati.
 */
function pisahDuaSebab(frasa: string): [string, string] {
  if (/^\p{Lu}/u.test(frasa)) return [frasa, ""];
  const potong = frasa.split(/\s+(?:dan|serta|maupun)\s+/i);
  if (potong.length !== 2) return [frasa, ""];
  const [a, b] = potong.map((t) => rapikanFrasa(t, 6));
  if (a.length < 4 || b.length < 4) return [frasa, ""];
  return [a, b];
}

/** Variabel antara, ditulis dengan istilah yang memang dipakai di skripsi. */
const POLA_ANTARA: RegExp[] = [
  new RegExp(`${MULAI}(?:dengan\\s+)?(.{3,60}?)\\s+sebagai\\s+(?:variabel\\s+)?(?:intervening|mediasi|mediator|antara|perantara|penghubung)`, "i"),
  new RegExp(`dimediasi\\s+(?:oleh\\s+)?(.{3,60}?)${HENTI}`, "i"),
  new RegExp(`(?:lewat|melalui)\\s+(.{3,60}?)\\s+(?:dulu|lebih dulu|terlebih dahulu)`, "i"),
];

function bacaAntara(t: string): { z: string; bukti: string | null } {
  for (const p of POLA_ANTARA) {
    const m = t.match(p);
    if (!m || typeof m.index !== "number") continue;
    const z = bakukan(rapikanFrasa(m[1], 6));
    if (z.length >= 4) return { z, bukti: kalimatSekitar(t, m.index) };
  }
  return { z: "", bukti: null };
}

/**
 * Ganti frasa tangkapan dengan istilah bakunya bila ada.
 *
 * Mahasiswa menulis "makin tinggi kecemasan sosial mereka"; yang pantas
 * tercetak di bagan kerangka berpikir adalah "kecemasan sosial". Penggantian
 * hanya dilakukan bila istilah bakunya memang menjadi bagian terbesar frasa
 * itu, supaya "terpaan konten berita di TikTok" tidak ikut disusutkan menjadi
 * "media sosial".
 */
function bakukan(frasa: string): string {
  if (!frasa) return frasa;
  const konsep = cariKonsep(frasa);
  if (konsep.length === 0) return frasa;
  const terpanjang = konsep.reduce((a, b) => (b.nilai.length > a.nilai.length ? b : a));
  return terpanjang.nilai.length >= frasa.length * 0.6 ? terpanjang.nilai : frasa;
}

function cocokkanPola(t: string, daftar: PolaVariabel[]): Variabel | null {
  for (const { pola, balik } of daftar) {
    const m = t.match(pola);
    if (!m || typeof m.index !== "number") continue;
    const satu = bakukan(rapikanFrasa(m[1]));
    const dua = bakukan(rapikanFrasa(m[2]));
    if (satu.length < 3 || dua.length < 3) continue;
    if (satu.toLowerCase() === dua.toLowerCase()) continue;
    // Letak tangkapan pertama, bukan letak awal kecocokan: pola yang
    // variabelnya berada di depan kata kerja dimulai dari batas kalimat
    // SEBELUMNYA, sehingga kalimat buktinya akan meleset satu kalimat.
    const letak = m.index + Math.max(0, m[0].indexOf(m[1]));
    return {
      x: balik ? dua : satu,
      x2: "",
      z: "",
      y: balik ? satu : dua,
      bukti: kalimatSekitar(t, letak),
      yakin: "kuat",
    };
  }
  return null;
}

function bacaVariabel(t: string, tujuan: Tujuan): Variabel {
  const urutan =
    tujuan === "isi" ? [...POLA_TEKS, ...POLA_DUA_VARIABEL]
      : tujuan === "proses" || tujuan === "evaluasi" ? [...POLA_PROSES, ...POLA_DUA_VARIABEL]
        : [...POLA_DUA_VARIABEL, ...POLA_TEKS, ...POLA_PROSES];

  const berpasangan = cocokkanPola(t, urutan);
  if (berpasangan) {
    // Model dua sebab dan model jalur hanya masuk akal pada rancangan yang
    // memang menguji hubungan antarvariabel.
    if (tujuan === "pengaruh" || tujuan === "hubungan") {
      const [x1, x2] = pisahDuaSebab(berpasangan.x);
      const antara = bacaAntara(t);
      // Variabel antara tidak boleh sama dengan variabel yang sudah ada,
      // jika tidak bagannya akan menggambar panah dari sebuah kotak ke
      // dirinya sendiri.
      const bedaSemua = [x1, x2, berpasangan.y]
        .filter(Boolean)
        .every((v) => v.toLowerCase() !== antara.z.toLowerCase());
      return {
        ...berpasangan,
        x: x1,
        x2,
        z: bedaSemua ? antara.z : "",
        bukti: berpasangan.bukti ?? antara.bukti,
      };
    }
    return berpasangan;
  }

  // Fenomenologi: yang dicari pengalamannya, bukan orang yang mengalaminya.
  // Orangnya sudah tercatat tersendiri sebagai populasi.
  if (tujuan === "makna") {
    const m = t.match(new RegExp(`(?:pengalaman|makna|persepsi|motif)\\s+(?:dari\\s+)?(.{3,70}?)${HENTI}`, "i"));
    if (m && typeof m.index === "number") {
      let x = rapikanFrasa(m[1]);
      const anak = x.match(new RegExp(`^(?:${KATA_ORANG})[\\w\\s]*?\\s+yang\\s+(.+)$`, "i"));
      if (anak) x = rapikanFrasa(anak[1]);
      if (x.length >= 3) return { x, x2: "", z: "", y: "", bukti: kalimatSekitar(t, m.index), yakin: "kuat" };
    }
  }

  // Rancangan yang memang tidak berpasangan variabel: satu gagasan sudah cukup.
  if (tujuan === "proses" || tujuan === "evaluasi" || tujuan === "gambaran") {
    for (const p of POLA_SATU) {
      const m = t.match(p);
      if (!m || typeof m.index !== "number") continue;
      const x = bakukan(rapikanFrasa(m[1]));
      if (x.length >= 3) return { x, x2: "", z: "", y: "", bukti: kalimatSekitar(t, m.index), yakin: "kuat" };
    }
  }

  // Jaring berikutnya: dua konsep FISIP pertama yang muncul di cerita.
  const konsep = cariKonsep(t);
  if (konsep.length >= 2) {
    return {
      x: konsep[0].nilai,
      x2: "",
      z: "",
      y: konsep[1].nilai,
      bukti: kalimatSekitar(t, konsep[0].posisi),
      yakin: "sedang",
    };
  }
  if (konsep.length === 1) {
    return { x: konsep[0].nilai, x2: "", z: "", y: "", bukti: kalimatSekitar(t, konsep[0].posisi), yakin: "terka" };
  }

  // Benar-benar tidak ada penanda: ambil frasa sesudah kata kerja meneliti.
  const sesudah = t.match(
    /(?:meneliti|teliti|membahas|mengkaji|mengangkat|bahas|angkat)\s+(?:tentang\s+|soal\s+|mengenai\s+)?(.{4,70})/i,
  );
  if (sesudah && typeof sesudah.index === "number") {
    const x = rapikanFrasa(sesudah[1]);
    if (x.length >= 3) return { x, x2: "", z: "", y: "", bukti: kalimatSekitar(t, sesudah.index), yakin: "terka" };
  }
  return { x: "", x2: "", z: "", y: "", bukti: null, yakin: "terka" };
}

// ---------------------------------------------------------------------------
// 5. Siapa yang diteliti dan di mana
// ---------------------------------------------------------------------------

const KATA_ORANG =
  "mahasiswa|siswa|pelajar|remaja|anak muda|generasi z|gen z|milenial|warga|masyarakat|" +
  "penduduk|ibu rumah tangga|petani|nelayan|pedagang|pelaku umkm|umkm|pegawai|karyawan|" +
  "asn|pns|aparatur|guru|dosen|perawat|staf|pemilih pemula|pemilih|konstituen|pelanggan|" +
  "konsumen|pengguna|followers|pengikut|anggota|kader|santri|alumni";

// Batas kata di kiri wajib. Tanpa itu "administrasi kependudukan" terbaca
// sebagai populasi bernama "pendudukan".
const POLA_OBJEK: RegExp[] = [
  new RegExp(`(?:pada|terhadap|di kalangan|kepada|buat|untuk)\\s+\\b((?:${KATA_ORANG})[\\w\\s]{0,40}?)${HENTI}`, "i"),
  new RegExp(`\\b((?:${KATA_ORANG})[\\w\\s]{0,40}?)${HENTI}`, "i"),
];

/** Nama tempat sungguhan diawali penanda ini, sehingga "di TikTok" tidak
 *  keliru dibaca sebagai lokasi penelitian. */
const PENANDA_TEMPAT =
  "kota|kabupaten|kab\\.|provinsi|kecamatan|kelurahan|desa|dusun|universitas|univ\\.|" +
  "institut|sekolah tinggi|politeknik|kampus|fakultas|sma|smk|smp|sd|madrasah|pondok|" +
  "dinas|badan|kantor|balai|puskesmas|rsud|rumah sakit|pemerintah kota|pemerintah kabupaten|" +
  "pemkot|pemkab|pemda|pemdes|dprd|kpu|bawaslu|pt |cv ";

const POLA_LOKASI: RegExp[] = [
  new RegExp(`\\bdi\\s+((?:${PENANDA_TEMPAT})[\\w\\s.'-]{2,50}?)${HENTI}`, "i"),
  // "di Serang", "di Banten": satu sampai tiga kata berhuruf kapital.
  /\bdi\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){0,2})\b/,
];

/** Nama layanan dan media yang sering muncul sesudah "di", tetapi bukan lokasi. */
const BUKAN_TEMPAT = new Set(
  ("tiktok instagram twitter facebook youtube whatsapp threads telegram shopee tokopedia " +
    "google kompas detik tribun tempo liputan6 antara cnn media sosial medsos indonesia " +
    "internet online daring rumah sana situ")
    .split(" "),
);

/** Nama lembaga yang lengkap, misalnya "Dinas Komunikasi dan Informatika Kota
 *  Serang". Pada studi kasus, yang diteliti memang lembaganya, bukan orang
 *  per orang yang kebetulan disebut sebagai calon narasumber. */
const POLA_LEMBAGA = new RegExp(
  "\\b((?:Dinas|Badan|Kantor|Balai|Sekretariat|Biro|Bagian|Kementerian|Kecamatan|" +
    "Kelurahan|Desa|Puskesmas|RSUD|DPRD|KPU|Bawaslu|Universitas|Fakultas|Yayasan|" +
    "Koperasi|Perusahaan)\\s+[A-Z][\\w.'-]*(?:\\s+(?:dan|[A-Z][\\w.'-]*)){0,5})",
);

function bacaLembaga(t: string): Cocok | null {
  const m = t.match(POLA_LEMBAGA);
  if (m && typeof m.index === "number") {
    const nilai = rapikanFrasa(m[1], 7);
    if (nilai.length >= 4) return { nilai, bukti: kalimatSekitar(t, m.index), posisi: m.index };
  }
  return null;
}

function bacaOrang(t: string): Cocok | null {
  for (const p of POLA_OBJEK) {
    const m = t.match(p);
    if (m && typeof m.index === "number") {
      // Anak kalimat "yang …" menerangkan populasinya, bukan menamainya.
      // "ibu rumah tangga yang jadi penjual online" sebagai nama populasi
      // membuat judul usulan berbunyi janggal ketika keterangannya diulang.
      let nilai = rapikanFrasa(m[1].split(/\s+yang\s+/i)[0], 7);
      // "stafnya" adalah cara bercerita, bukan nama populasi. Akhiran itu
      // dilepas selama sisanya masih berupa kata utuh.
      nilai = nilai.replace(/(\p{L}{3,})nya$/iu, "$1");
      if (nilai.length >= 4) return { nilai, bukti: kalimatSekitar(t, m.index), posisi: m.index };
    }
  }
  return null;
}

function bacaObjek(t: string, unit: Unit): Cocok | null {
  if (unit === "organisasi") return bacaLembaga(t) ?? bacaOrang(t);
  return bacaOrang(t);
}

/** Nama media dan pelantar yang lazim menjadi bahan analisis isi. Diperiksa
 *  menurut panjangnya, supaya "Kompas.com" tidak keburu tertangkap sebagai
 *  "Kompas". */
const NAMA_MEDIA = [
  "Kompas.com", "Detik.com", "Tribunnews", "CNN Indonesia", "Liputan6", "Tempo.co",
  "TikTok", "Instagram", "Twitter", "Facebook", "YouTube", "WhatsApp", "Threads",
  "Kompas", "Detik", "Tribun", "Tempo", "Antara", "Shopee", "Tokopedia",
  "media sosial", "media online", "media daring", "media massa", "media cetak",
  "portal berita", "surat kabar", "koran", "televisi", "radio",
];

function bacaMedia(t: string): string {
  const rendah = t.toLowerCase();
  let terpanjang = "";
  for (const nama of NAMA_MEDIA) {
    const p = rendah.indexOf(nama.toLowerCase());
    if (p < 0) continue;
    if (nama.length > terpanjang.length) terpanjang = t.slice(p, p + nama.length);
  }
  return terpanjang;
}

function bacaLokasi(t: string): Cocok | null {
  for (const p of POLA_LOKASI) {
    for (const m of t.matchAll(new RegExp(p.source, p.flags.includes("g") ? p.flags : `${p.flags}g`))) {
      if (typeof m.index !== "number") continue;
      // Delapan kata, bukan enam: nama dinas di Indonesia memang panjang, dan
      // "Dinas Kependudukan dan Pencatatan Sipil Kota Serang" terpotong
      // menjadi "… Kota" pada batas yang lebih pendek.
      const nilai = rapikanFrasa(m[1], 8);
      if (nilai.length < 3) continue;
      if (BUKAN_TEMPAT.has(nilai.toLowerCase())) continue;
      return { nilai, bukti: kalimatSekitar(t, m.index), posisi: m.index };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 6. Angka populasi dan sampel
// ---------------------------------------------------------------------------

function angka(teks: string) {
  const bersih = teks.replace(/[.\s]/g, "").replace(/,/g, "");
  const n = Number(bersih);
  return Number.isFinite(n) ? n : 0;
}

function bacaAngka(t: string): { populasi: number; sampel: number; bukti: string | null } {
  let populasi = 0;
  let sampel = 0;
  let bukti: string | null = null;

  const ambil = (pola: RegExp) => {
    const m = t.match(pola);
    if (!m || typeof m.index !== "number") return 0;
    if (!bukti) bukti = kalimatSekitar(t, m.index);
    return angka(m[1]);
  };

  populasi = ambil(/populasi\w*\s*(?:sekitar|kurang lebih|kira-kira|ada|nya)?\s*(\d[\d.,]*)/i);
  sampel = ambil(/(?:sampel|responden|target)\w*\s*(?:sekitar|kurang lebih|kira-kira|ada|nya)?\s*(\d[\d.,]*)/i)
    || ambil(/(\d[\d.,]*)\s*(?:orang\s+)?responden/i);

  if (!populasi && !sampel) {
    // Tidak ada penanda: kumpulkan angka yang diikuti kata benda orang, lalu
    // yang terbesar dianggap populasi dan yang terkecil sampel.
    const semua: number[] = [];
    for (const m of t.matchAll(new RegExp(`(\\d[\\d.,]*)\\s*(?:orang|${KATA_ORANG})`, "gi"))) {
      const n = angka(m[1]);
      if (n > 0) {
        semua.push(n);
        if (!bukti && typeof m.index === "number") bukti = kalimatSekitar(t, m.index);
      }
    }
    if (semua.length === 1) {
      if (semua[0] >= 300) populasi = semua[0];
      else sampel = semua[0];
    } else if (semua.length >= 2) {
      populasi = Math.max(...semua);
      sampel = Math.min(...semua);
    }
  }

  return { populasi, sampel, bukti };
}

// ---------------------------------------------------------------------------
// 7. Program studi
// ---------------------------------------------------------------------------

const KATA_PRODI: Record<Exclude<Prodi, "lain">, RegExp> = {
  komunikasi:
    /\b(?:komunikasi|jurnalistik|humas|public relations|periklanan|media|penyiaran|broadcasting|pemasaran|branding|khalayak|audiens)\b/i,
  pemerintahan:
    /\b(?:pemerintahan|kebijakan publik|birokrasi|otonomi daerah|desa|kelurahan|kecamatan|dprd|asn|pelayanan publik|governance|politik lokal)\b/i,
};

function bacaProdi(t: string, bawaan: Prodi): Prodi {
  // Prodi yang dipilih sendiri di layar selalu menang. Kata "media" muncul di
  // banyak cerita pemerintahan dan kata "pelayanan publik" muncul di banyak
  // cerita komunikasi, jadi menebak dari isi cerita hanya sah ketika
  // mahasiswanya memang belum menyatakan prodinya.
  if (bawaan !== "lain") return bawaan;
  const k = KATA_PRODI.komunikasi.test(t);
  const p = KATA_PRODI.pemerintahan.test(t);
  if (k && !p) return "komunikasi";
  if (p && !k) return "pemerintahan";
  return bawaan;
}

/**
 * Metode yang mahasiswanya sebut sendiri.
 *
 * Sebagian mahasiswa sudah tahu nama metodenya sebelum tahu variabelnya:
 * "aku mau pakai analisis framing" atau "rencananya semiotika Barthes".
 * Menyimpulkan ulang dari tujuan dan unit analisis pada cerita seperti itu
 * justru menimpa keterangan yang paling pasti di seluruh ceritanya.
 *
 * Yang dikenali hanya metode yang memang ditawarkan di prodinya. Cerita
 * pemerintahan yang menyebut "framing" tidak diarahkan ke analisis framing,
 * karena rancangan itu tidak ada di daftar prodinya.
 */
const POLA_METODE: Array<{ jenis: Jenis; pola: RegExp }> = [
  { jenis: "analisis-framing", pola: /\b(?:analisis\s+)?framing\b|\bmembingkai\b|\bentman\b|\bpan\s+dan\s+kosicki\b|\bgamson\b/i },
  { jenis: "semiotika", pola: /\bsemiotik\w*\b|\bbarthes\b|\bpeirce\b|\bsaussure\b|\bdenotasi\b|\bkonotasi\b|\brepresentasi\b/i },
  { jenis: "analisis-isi", pola: /\banalisis\s+isi\b|\bkoding\b|\bkoder\b|\bcontent\s+analysis\b/i },
  { jenis: "uses-gratifications", pola: /\buses\s+and\s+gratification\w*\b|\bmotif\b.{0,40}\bkepuasan\b|\bgratifikasi\b/i },
  { jenis: "implementasi-kebijakan", pola: /\bimplementasi\b.{0,30}\b(?:kebijakan|perda|peraturan|program)\b|\bedward\s*iii\b|\bvan\s+meter\b|\bgrindle\b/i },
  { jenis: "efektivitas-program", pola: /\befekti[fv]itas\b/i },
  { jenis: "analisis-kebijakan", pola: /\banalisis\s+kebijakan\b|\bwilliam\s+dunn\b/i },
  { jenis: "governance", pola: /\btata\s+kelola\b|\bgood\s+governance\b|\bgovernance\b/i },
  { jenis: "peran-pemerintah", pola: /\bperan\b.{0,40}\b(?:pemerintah|desa|kelurahan|kecamatan|dinas|lurah|camat)\b/i },
  { jenis: "fenomenologi", pola: /\bfenomenolog\w*\b|\bschutz\b|\bhusserl\b|\bmoustakas\b/i },
  { jenis: "studi-kasus", pola: /\bstudi\s+kasus\b|\bcase\s+study\b|\brobert\s+yin\b/i },
  { jenis: "strategi-komunikasi", pola: /\bstrategi\s+komunikasi\b|\bstrategi\s+humas\b/i },
  { jenis: "strategi-pemerintah", pola: /\bstrategi\s+pemerintah\b|\bstrategi\s+dinas\b|\banalisis\s+swot\b/i },
];

function bacaMetode(t: string, prodi: Prodi): Cocok & { jenis: Jenis } | null {
  for (const { jenis, pola } of POLA_METODE) {
    if (!metodeProdi(jenis, prodi)) continue;
    const m = t.match(pola);
    if (!m || typeof m.index !== "number") continue;
    return { jenis, nilai: JENIS_UMUM[jenis], bukti: kalimatSekitar(t, m.index), posisi: m.index };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pembacaan utuh
// ---------------------------------------------------------------------------

const LABEL_TUJUAN: Record<Tujuan, string> = {
  pengaruh: "Pengaruh, apakah A memengaruhi B",
  hubungan: "Hubungan, apakah A berkaitan dengan B",
  perbedaan: "Perbedaan antar kelompok",
  gambaran: "Gambaran keadaan",
  makna: "Makna dan pengalaman",
  proses: "Proses dan strategi",
  isi: "Isi pesan atau teks",
  evaluasi: "Evaluasi program",
};

const LABEL_UNIT: Record<Unit, string> = {
  individu: "Orang",
  organisasi: "Lembaga",
  teks: "Teks atau media",
  kebijakan: "Kebijakan atau program",
};

const LABEL_DATA: Record<Data, string> = {
  kuesioner: "kuesioner",
  wawancara: "wawancara mendalam",
  dokumen: "dokumen atau arsip",
  observasi: "pengamatan langsung",
};

export function hitungKataCerita(cerita: string) {
  const b = cerita.trim();
  return b ? b.split(/\s+/).length : 0;
}

/**
 * Baca cerita mahasiswa menjadi isian rancangan.
 *
 * `prodiBawaan` dipakai hanya bila ceritanya sendiri tidak memberi petunjuk;
 * biasanya diisi dari program studi yang tercatat pada project.
 */
export function tafsirkan(cerita: string, prodiBawaan: Prodi = "lain"): Bacaan {
  // Tanda baca dirapikan supaya pemenggal kalimat dan pola tidak tersandung
  // pada tulisan yang memang ditulis apa adanya di kotak cerita.
  // Spasi disisipkan sesudah tanda baca yang menempel pada kata berikutnya.
  // Titik hanya dipisah bila disusul huruf kapital, yaitu ketika ia memang
  // mengakhiri kalimat; dengan begitu "Kompas.com" dan "1.200" tetap utuh.
  const t = cerita
    .replace(/\s+/g, " ")
    .replace(/([,;:])(?=[^\s\d])/g, "$1 ")
    .replace(/\.(?=[A-Z])/g, ". ")
    .trim();
  const jumlahKata = hitungKataCerita(cerita);

  const tujuan = bacaTujuan(t);
  const unit = bacaUnit(t, tujuan.tujuan);
  const data = bacaData(t, tujuan.tujuan);
  const variabel = bacaVariabel(t, tujuan.tujuan);
  const objek = bacaObjek(t, unit.unit);
  const lokasi = bacaLokasi(t);
  const bilangan = bacaAngka(t);
  const prodi = bacaProdi(t, prodiBawaan);
  const metode = bacaMetode(t, prodi);

  // Pada rancangan berbahan teks, yang menempati tempat variabel terikat
  // adalah wadah teksnya. Tanpa penegasan ini, "membingkai pemberitaan …
  // di Kota Serang" membuat nama kota terbaca sebagai medianya.
  const media = bacaMedia(t);
  const wadahTeks = unit.unit === "teks" && media && !variabel.y.toLowerCase().includes(media.toLowerCase());

  const masukan: Masukan = {
    variabelX: variabel.x,
    variabelX2: variabel.x2,
    variabelZ: variabel.z,
    variabelY: wadahTeks ? media : variabel.y,
    objek: objek?.nilai ?? "",
    lokasi: lokasi?.nilai ?? "",
    tujuan: tujuan.tujuan,
    unit: unit.unit,
    data: data.data,
    jumlahPopulasi: bilangan.populasi,
    perkiraanSampel: bilangan.sampel,
    prodi,
    metode: metode?.jenis,
  };

  const temuan: Temuan[] = [
    { bidang: "Prodi", nilai: PRODI_LABEL[prodi], bukti: null, yakin: prodiBawaan === "lain" ? "terka" : "kuat" },
    { bidang: "Yang ingin diketahui", nilai: LABEL_TUJUAN[tujuan.tujuan], bukti: tujuan.bukti, yakin: tujuan.yakin },
    { bidang: "Yang diteliti", nilai: LABEL_UNIT[unit.unit], bukti: unit.bukti, yakin: unit.yakin },
  ];
  if (metode) {
    temuan.push({ bidang: "Metode yang kamu sebut", nilai: metode.nilai, bukti: metode.bukti, yakin: "kuat" });
  }

  if (variabel.x) {
    temuan.push({
      bidang: tujuan.tujuan === "isi" ? "Gagasan yang ditelusuri" : "Variabel bebas (X)",
      nilai: variabel.x,
      bukti: variabel.bukti,
      yakin: variabel.yakin,
    });
  }
  if (variabel.x2) {
    temuan.push({
      bidang: "Variabel bebas kedua (X2)",
      nilai: variabel.x2,
      bukti: variabel.bukti,
      yakin: variabel.yakin,
    });
  }
  if (variabel.z) {
    temuan.push({
      bidang: "Variabel antara (Z)",
      nilai: variabel.z,
      bukti: variabel.bukti,
      yakin: "sedang",
    });
  }
  if (variabel.y) {
    temuan.push({
      bidang: tujuan.tujuan === "isi" ? "Media yang diperiksa" : "Variabel terikat (Y)",
      nilai: variabel.y,
      bukti: variabel.bukti,
      yakin: variabel.yakin,
    });
  }
  if (objek) {
    temuan.push({ bidang: "Siapa yang diteliti", nilai: objek.nilai, bukti: objek.bukti, yakin: "sedang" });
  }
  if (lokasi) {
    temuan.push({ bidang: "Lokasi", nilai: lokasi.nilai, bukti: lokasi.bukti, yakin: "sedang" });
  }
  temuan.push({
    bidang: "Cara mengumpulkan data",
    nilai: data.data.map((d) => LABEL_DATA[d]).join(", "),
    bukti: data.bukti,
    yakin: data.yakin,
  });
  if (bilangan.populasi || bilangan.sampel) {
    temuan.push({
      bidang: "Jumlah",
      nilai: [
        bilangan.populasi ? `populasi ${bilangan.populasi.toLocaleString("id-ID")}` : null,
        bilangan.sampel ? `sampel ${bilangan.sampel.toLocaleString("id-ID")}` : null,
      ].filter(Boolean).join(", "),
      bukti: bilangan.bukti,
      yakin: "sedang",
    });
  }

  // Yang ditanyakan hanya yang memang dituntut rancangannya. Menanyakan
  // variabel terikat pada penelitian fenomenologi, misalnya, justru
  // menyesatkan: rancangan itu tidak punya variabel terikat.
  const berpasangan: Tujuan[] = ["pengaruh", "hubungan", "perbedaan"];
  const pertanyaan: string[] = [];

  if (!variabel.x) {
    pertanyaan.push("Gagasan utama yang Anda teliti apa? Sebutkan satu istilahnya, misalnya “literasi digital”.");
  }
  if (!variabel.y && berpasangan.includes(tujuan.tujuan)) {
    pertanyaan.push("Yang Anda ingin lihat berubah atau terpengaruh itu apa? Itulah variabel terikatnya.");
  }
  if (!objek && unit.unit !== "teks") {
    pertanyaan.push("Siapa yang akan Anda teliti? Mahasiswa, warga, pegawai, atau pihak lain?");
  }
  if (unit.unit === "teks" && !/\b(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|\d{4})\b/i.test(t)) {
    pertanyaan.push("Teksnya diambil dari rentang waktu kapan? Analisis isi menuntut periode yang ditetapkan lebih dulu.");
  }
  if (!lokasi && unit.unit !== "teks") {
    pertanyaan.push("Penelitiannya di mana? Sebutkan kampus, kantor, desa, atau kotanya.");
  }
  if (data.yakin === "terka" && tujuan.tujuan !== "isi") {
    pertanyaan.push(
      `Datanya mau diambil bagaimana? Belum disebut, jadi untuk sementara diisi ${data.data.map((d) => LABEL_DATA[d]).join(" dan ")}.`,
    );
  }
  if (
    berpasangan.includes(tujuan.tujuan) &&
    data.data.includes("kuesioner") &&
    !bilangan.populasi &&
    !bilangan.sampel
  ) {
    pertanyaan.push("Kira-kira berapa orang populasinya? Angka itu yang menentukan berapa responden yang harus dikejar.");
  }

  const ringkas = susunRingkas(masukan, tujuan.tujuan);
  const cukup = jumlahKata >= MINIMAL_KATA && Boolean(variabel.x || objek);

  return {
    masukan,
    temuan,
    pertanyaan,
    ringkas,
    cukup,
    jumlahKata,
    media,
    lembaga: bacaLembaga(t)?.nilai ?? "",
    orang: bacaOrang(t)?.nilai ?? "",
  };
}

function susunRingkas(m: Masukan, tujuan: Tujuan): string {
  const X = m.variabelX || "gagasan yang kamu sebut";
  const Y = m.variabelY || "hal yang terpengaruh";
  const siapa = m.objek ? ` pada ${m.objek}` : "";
  const tempat = m.lokasi ? ` di ${m.lokasi}` : "";
  const cara = m.data.map((d) => LABEL_DATA[d]).join(" dan ");

  const inti: Record<Tujuan, string> = {
    pengaruh: `apakah ${X} benar-benar memengaruhi ${Y}`,
    hubungan: `apakah ${X} berkaitan dengan ${Y}`,
    perbedaan: `apakah ${Y} berbeda antar kelompok yang kamu bandingkan`,
    gambaran: `bagaimana keadaan ${X} sebenarnya`,
    makna: `bagaimana ${X} dimaknai oleh orang yang mengalaminya`,
    proses: `bagaimana ${X} dijalankan${m.variabelY ? ` untuk ${Y}` : ""}`,
    isi: `apa yang sebenarnya terkandung dalam ${Y || "media yang kamu sebut"} ketika membicarakan ${X}`,
    evaluasi: `sejauh mana ${X} mencapai sasarannya`,
  };

  return `Yang kamu cari adalah ${inti[tujuan]}${siapa}${tempat}, dan datanya diambil lewat ${cara}.`;
}
