// VERIFIKASI SITASI: pengurai daftar pustaka dan pencocok hasil pencarian.
//
// Latar: referensi fiktif buatan AI naik dua belas kali lipat dalam tiga
// tahun, dan dua pertiganya karangan utuh: nama penulis nyata, jurnal nyata,
// tahun masuk akal, tetapi karyanya tidak pernah ada. Yang membuatnya
// berbahaya justru karena tidak terlihat cacat.
//
// PRINSIP TERPENTING DI BERKAS INI:
// Banyak referensi Indonesia yang sepenuhnya sah tidak ada di Crossref atau
// OpenAlex. Contohnya buku terbitan lokal, skripsi, tesis, peraturan perundangan,
// laporan lembaga, jurnal kampus yang belum ber-DOI. Alat yang menyamakan
// "tidak ditemukan" dengan "palsu" akan menuduh mahasiswa yang benar.
// Karena itu jenis referensi dikenali lebih dulu, dan yang memang tidak dapat
// diperiksa otomatis dinyatakan begitu apa adanya, bukan dituduh.
//
// Semua fungsi di sini murni supaya dapat diuji tanpa jaringan.

export type JenisRujukan =
  | "artikel-jurnal"
  | "buku"
  | "skripsi-tesis"
  | "peraturan"
  | "laman-web"
  | "tak-dikenal";

export type Rujukan = {
  /** Nomor urut sebagaimana ditempel pengguna. */
  urut: number;
  /** Baris utuh apa adanya. */
  mentah: string;
  penulisPertama: string | null;
  tahun: number | null;
  judul: string | null;
  doi: string | null;
  url: string | null;
  jenis: JenisRujukan;
};

export type Putusan =
  | "terverifikasi"
  | "beda-rincian"
  | "tidak-ditemukan"
  | "tak-dapat-diperiksa";

export type Temuan = {
  judul: string | null;
  tahun: number | null;
  penulisPertama: string | null;
  doi: string | null;
  sumber: "Crossref" | "OpenAlex";
  kemiripanJudul: number;
};

export type HasilRujukan = {
  rujukan: Rujukan;
  putusan: Putusan;
  pesan: string;
  temuan: Temuan | null;
  /** Perbedaan yang perlu diperiksa mahasiswa, mis. tahun tidak cocok. */
  selisih: string[];
};

export const PUTUSAN_LABEL: Record<Putusan, string> = {
  terverifikasi: "Terverifikasi",
  "beda-rincian": "Rinciannya berbeda",
  "tidak-ditemukan": "Tidak ditemukan",
  "tak-dapat-diperiksa": "Tidak bisa diperiksa otomatis",
};

// ---------------------------------------------------------------------------
// Pengurai
// ---------------------------------------------------------------------------

const POLA_DOI = /\b(10\.\d{4,9}\/[^\s,;"'<>()[\]]+)/i;
const POLA_URL = /\bhttps?:\/\/[^\s,;"'<>]+/i;
const POLA_TAHUN = /\((\d{4})[a-z]?\)|\b(19|20)\d{2}\b/;

// Penanda jenis rujukan. Diperiksa pada teks yang sudah dihuruf-kecilkan.
const PENANDA_SKRIPSI = /\b(skripsi|tesis|disertasi|thesis|dissertation|tugas akhir)\b/;
const PENANDA_PERATURAN =
  /\b(undang-undang|undang undang|uu no|peraturan|permendik|permenkes|perpres|perda|keputusan menteri|kepmen|inpres|pp no)\b/;
const PENANDA_BUKU = /\b(penerbit|press|pustaka|gramedia|erlangga|rajawali|kencana|alfabeta|remaja rosdakarya|bumi aksara|prenada|salemba|andi offset|deepublish|edisi ke|cet\.|jakarta:|bandung:|yogyakarta:|surabaya:|malang:|depok:)\b/;
const PENANDA_WEB = /\b(diakses|retrieved|diunduh|www\.|\.com|\.co\.id|\.go\.id\b)/;
const PENANDA_JURNAL = /\b(jurnal|journal|vol\.|volume|no\.\s*\d|hlm\.|pp\.|issn|doi)\b/;

export function kenaliJenis(teks: string, adaDoi: boolean): JenisRujukan {
  const t = teks.toLowerCase();
  if (adaDoi) return "artikel-jurnal";
  if (PENANDA_PERATURAN.test(t)) return "peraturan";
  if (PENANDA_SKRIPSI.test(t)) return "skripsi-tesis";
  if (PENANDA_JURNAL.test(t)) return "artikel-jurnal";
  if (PENANDA_BUKU.test(t)) return "buku";
  if (PENANDA_WEB.test(t)) return "laman-web";
  return "tak-dikenal";
}

/** Jenis yang memang tidak terdaftar di Crossref/OpenAlex pada umumnya. */
export function dapatDiperiksa(jenis: JenisRujukan) {
  return jenis === "artikel-jurnal" || jenis === "tak-dikenal";
}

/**
 * Pecah daftar pustaka yang ditempel menjadi entri terpisah.
 *
 * Daftar pustaka biasanya memakai indentasi gantung, sehingga satu entri bisa
 * memakan beberapa baris. Baris yang menjorok atau tidak diawali pola penulis
 * digabungkan ke entri sebelumnya.
 */
export function pecahDaftar(teks: string): string[] {
  const baris = teks.split(/\r?\n/);
  const entri: string[] = [];
  let kini = "";

  const mulaiEntriBaru = (b: string) => {
    const bersih = b.trim();
    if (!bersih) return false;
    // Baris yang menjorok adalah lanjutan (indentasi gantung).
    if (/^\s{2,}|^\t/.test(b)) return false;
    // Penomoran daftar: "1." atau "[1]".
    if (/^\s*(\[\d+\]|\d+[.)])\s+/.test(b)) return true;
    // Entri baru umumnya diawali nama keluarga berhuruf kapital.
    return /^[\p{Lu}]/u.test(bersih);
  };

  for (const b of baris) {
    if (!b.trim()) {
      if (kini.trim()) { entri.push(kini.trim()); kini = ""; }
      continue;
    }
    if (kini && mulaiEntriBaru(b)) {
      entri.push(kini.trim());
      kini = b.trim();
    } else {
      kini = kini ? `${kini} ${b.trim()}` : b.trim();
    }
  }
  if (kini.trim()) entri.push(kini.trim());

  // Buang entri yang terlalu pendek untuk menjadi rujukan.
  return entri.filter((e) => e.replace(/^\s*(\[\d+\]|\d+[.)])\s*/, "").length >= 20);
}

export function uraiRujukan(mentah: string, urut: number): Rujukan {
  const teks = mentah.replace(/^\s*(\[\d+\]|\d+[.)])\s*/, "").trim();

  const doi = teks.match(POLA_DOI)?.[1]?.replace(/[.,;]+$/, "") ?? null;
  const url = teks.match(POLA_URL)?.[0]?.replace(/[.,;]+$/, "") ?? null;

  const cocokTahun = teks.match(POLA_TAHUN);
  let tahun: number | null = null;
  if (cocokTahun) {
    const n = Number(cocokTahun[1] ?? cocokTahun[0]);
    // Tahun yang masuk akal untuk rujukan akademik.
    if (n >= 1800 && n <= new Date().getFullYear() + 1) tahun = n;
  }

  // Nama keluarga penulis pertama: potongan sebelum koma pertama.
  const sebelumKoma = teks.split(/[,(]/)[0]?.trim() ?? "";
  const penulisPertama = /^[\p{L}'’\- .]{2,60}$/u.test(sebelumKoma) ? sebelumKoma : null;

  // Judul: potongan sesudah tanda tahun, sampai titik yang mengakhiri kalimat.
  let judul: string | null = null;
  const posisiTahun = cocokTahun?.index;
  if (posisiTahun !== undefined) {
    const sesudah = teks
      .slice(posisiTahun + (cocokTahun?.[0].length ?? 0))
      .replace(/^[\s.):]+/, "");
    // Berhenti pada titik yang diikuti spasi lalu huruf kapital atau akhir teks.
    const potong = sesudah.split(/\.(?=\s+[\p{Lu}]|\s*$)/u)[0] ?? "";
    const bersih = potong.replace(/\s+/g, " ").trim();
    if (bersih.length >= 8) judul = bersih;
  }

  return {
    urut,
    mentah: teks,
    penulisPertama,
    tahun,
    judul,
    doi,
    url,
    jenis: kenaliJenis(teks, Boolean(doi)),
  };
}

export function uraiDaftar(teks: string): Rujukan[] {
  return pecahDaftar(teks).map((e, i) => uraiRujukan(e, i + 1));
}

// ---------------------------------------------------------------------------
// Pencocokan judul
// ---------------------------------------------------------------------------

const KATA_ABAIKAN = new Set([
  "a", "an", "the", "of", "in", "on", "for", "and", "or", "to", "with", "at", "by", "from",
  "dan", "di", "ke", "dari", "pada", "yang", "untuk", "dengan", "terhadap", "dalam", "atas",
]);

export function tokenJudul(judul: string): string[] {
  return judul
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((k) => k.length > 1 && !KATA_ABAIKAN.has(k));
}

/**
 * Kemiripan judul 0–1 dengan koefisien Dice atas token.
 * Dipilih ketimbang jarak edit karena tahan terhadap perbedaan tanda baca,
 * subjudul yang terpotong, dan urutan kata yang sedikit berbeda.
 */
export function kemiripanJudul(a: string, b: string): number {
  const ta = tokenJudul(a);
  const tb = tokenJudul(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const hitung = new Map<string, number>();
  for (const k of ta) hitung.set(k, (hitung.get(k) ?? 0) + 1);

  let sama = 0;
  for (const k of tb) {
    const n = hitung.get(k) ?? 0;
    if (n > 0) { sama += 1; hitung.set(k, n - 1); }
  }
  return (2 * sama) / (ta.length + tb.length);
}

export function namaKeluargaSama(a: string | null, b: string | null): boolean | null {
  if (!a || !b) return null;
  const bersih = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const na = bersih(a);
  const nb = bersih(b);
  if (na.length === 0 || nb.length === 0) return null;
  return na.some((x) => nb.includes(x) && x.length > 2);
}

// ---------------------------------------------------------------------------
// Putusan
// ---------------------------------------------------------------------------

const AMBANG = {
  cocokKuat: 0.82,
  cocokLemah: 0.62,
} as const;

/**
 * Simpulkan satu rujukan dari kandidat terbaik hasil pencarian.
 *
 * `kandidat` null berarti pencarian berjalan tetapi tidak menemukan apa pun.
 * `jaringanGagal` true berarti pencarian tidak dapat dilakukan. Ini tidak
 * boleh dibaca sebagai bukti apa pun tentang rujukannya.
 */
export function simpulkan(
  rujukan: Rujukan,
  kandidat: Temuan | null,
  jaringanGagal = false,
): HasilRujukan {
  const selisih: string[] = [];

  if (jaringanGagal) {
    return {
      rujukan,
      putusan: "tak-dapat-diperiksa",
      pesan: "Pemeriksaan gagal berjalan. Coba lagi. Ini bukan tanda apa pun tentang rujukannya.",
      temuan: null,
      selisih,
    };
  }

  if (!dapatDiperiksa(rujukan.jenis)) {
    const alasan: Record<string, string> = {
      buku: "Buku memang jarang terdaftar di Crossref maupun OpenAlex. Cek langsung ke katalog perpustakaan atau ke penerbitnya.",
      "skripsi-tesis": "Skripsi, tesis, dan disertasi tidak terdaftar di Crossref. Cek ke repositori kampus asalnya.",
      peraturan: "Peraturan perundangan tidak ada di pangkalan data sitasi. Cek ke JDIH instansi terkait.",
      "laman-web": "Laman web tidak ada di pangkalan data sitasi. Buka tautannya, pastikan masih hidup.",
    };
    return {
      rujukan,
      putusan: "tak-dapat-diperiksa",
      pesan: alasan[rujukan.jenis] ?? "Jenis rujukan ini tidak bisa diperiksa otomatis.",
      temuan: null,
      selisih,
    };
  }

  if (!kandidat) {
    return {
      rujukan,
      putusan: "tidak-ditemukan",
      pesan:
        "Tidak ada di Crossref maupun OpenAlex. Inilah rujukan yang paling perlu Anda buka sendiri. " +
        "Referensi karangan AI biasanya terlihat wajar, padahal karyanya tidak pernah terbit.",
      temuan: null,
      selisih,
    };
  }

  const mirip = kandidat.kemiripanJudul;

  if (rujukan.tahun !== null && kandidat.tahun !== null && rujukan.tahun !== kandidat.tahun) {
    selisih.push(`Tahun di daftar pustaka Anda ${rujukan.tahun}, di catatan resmi ${kandidat.tahun}.`);
  }
  const penulisCocok = namaKeluargaSama(rujukan.penulisPertama, kandidat.penulisPertama);
  if (penulisCocok === false) {
    selisih.push(
      `Penulis pertama di daftar pustaka Anda "${rujukan.penulisPertama}", di catatan resmi "${kandidat.penulisPertama}".`,
    );
  }
  if (mirip < 0.95 && rujukan.judul && kandidat.judul) {
    selisih.push(`Judulnya mirip, tetapi tidak sama persis (kemiripan ${Math.round(mirip * 100)}%).`);
  }

  if (mirip >= AMBANG.cocokKuat && selisih.length === 0) {
    return {
      rujukan,
      putusan: "terverifikasi",
      pesan: `Ada di ${kandidat.sumber}. Judul, tahun, dan penulisnya cocok.`,
      temuan: kandidat,
      selisih,
    };
  }

  if (mirip >= AMBANG.cocokLemah) {
    return {
      rujukan,
      putusan: "beda-rincian",
      pesan:
        "Ada karya nyata yang mirip, tetapi rinciannya berbeda. Samakan dengan catatan resmi, " +
        "atau pastikan yang Anda maksud memang karya lain.",
      temuan: kandidat,
      selisih,
    };
  }

  return {
    rujukan,
    putusan: "tidak-ditemukan",
    pesan:
      "Tidak ada karya berjudul cukup mirip. Buka sendiri rujukan ini, pastikan memang ada.",
    temuan: kandidat,
    selisih,
  };
}

export type RingkasanSitasi = {
  total: number;
  terverifikasi: number;
  bedaRincian: number;
  tidakDitemukan: number;
  takDapatDiperiksa: number;
  /** Kalimat ringkas, tanpa menuduh. */
  pesan: string;
};

export function ringkas(hasil: HasilRujukan[]): RingkasanSitasi {
  const hitung = (p: Putusan) => hasil.filter((h) => h.putusan === p).length;
  const terverifikasi = hitung("terverifikasi");
  const bedaRincian = hitung("beda-rincian");
  const tidakDitemukan = hitung("tidak-ditemukan");
  const takDapatDiperiksa = hitung("tak-dapat-diperiksa");

  let pesan: string;
  if (hasil.length === 0) {
    pesan = "Belum ada rujukan yang bisa diurai.";
  } else if (tidakDitemukan === 0 && bedaRincian === 0) {
    pesan = "Tidak ada rujukan yang mencurigakan dari pemeriksaan otomatis.";
  } else if (tidakDitemukan > 0) {
    pesan = `${tidakDitemukan} rujukan tidak ditemukan. Buka sendiri satu per satu.`;
  } else {
    pesan = `${bedaRincian} rujukan perlu dirapikan rinciannya.`;
  }

  return { total: hasil.length, terverifikasi, bedaRincian, tidakDitemukan, takDapatDiperiksa, pesan };
}
