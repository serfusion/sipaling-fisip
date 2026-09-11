// ============================================================
// ISTILAH INGGRIS PADA JUDUL SKRIPSI — dicetak MIRING
//
// Kaidah penulisan ilmiah Indonesia: kata atau ungkapan asing yang belum
// diserap ditulis miring. Judul skripsi Ilmu Komunikasi hampir selalu
// memuatnya — "brand awareness", "personal branding", "engagement",
// "content creator" — dan selama ini tercetak tegak seperti kata Indonesia
// di sekelilingnya.
//
// Transkrip nilai ikut dilegalisir dan ikut dibaca kampus luar negeri, jadi
// judulnya harus tercetak seperti pada skripsi yang disahkan pembimbing.
//
// ---------- DAFTAR, BUKAN TEBAKAN ----------
//
// Yang dimiringkan HANYA istilah yang terdaftar di bawah. Tidak ada
// pengenalan bahasa otomatis, tidak ada tebakan dari bentuk kata: judul
// adalah kalimat yang ditulis mahasiswanya sendiri, dan memiringkan kata
// Indonesia yang kebetulan mirip Inggris adalah kesalahan yang ikut
// dicetak, ditandatangani Dekan, lalu dilegalisir.
//
// Karena itu pula kata serapan yang SUDAH baku dalam bahasa Indonesia
// sengaja TIDAK didaftar — media, publik, digital, video, radio, televisi,
// film, program, produksi, promosi, informasi, komunikasi, strategi,
// konten, viral, aplikasi, platform. Kata seperti itu ditulis tegak.
//
// ---------- ADMIN SELALU DAPAT MEMAKSA ----------
//
// Istilah yang belum terdaftar dimiringkan dengan menulisnya di antara
// tanda bintang pada kolom Judul skripsi:
//
//     Pengaruh *Brand Ambassador* terhadap Minat Beli
//
// Begitu satu tanda bintang dipakai, DAFTAR DI BAWAH TIDAK IKUT BEKERJA
// pada judul itu: yang miring persis yang ditandai admin, tidak lebih.
// Judul resmi tidak boleh setengah ditentukan daftar dan setengah
// ditentukan manusia — yang seperti itu mustahil diperiksa sebelum cetak.
//
// SENGAJA bebas dari React supaya dapat diuji sendirian.
// ============================================================

/** Satu penggal judul: teksnya, dan apakah ia dicetak miring. */
export type PenggalJudul = { teks: string; miring: boolean };

// ---------- DAFTAR ISTILAH ----------
//
// Ungkapan didahulukan atas kata tunggal ("brand awareness" sebelum
// "brand"), diurutkan sendiri oleh kode di bawah menurut panjangnya.
const ISTILAH: string[] = [
  // Merek & pemasaran
  "brand awareness", "brand image", "brand loyalty", "brand equity",
  "brand ambassador", "brand trust", "personal branding", "city branding",
  "corporate branding", "rebranding", "branding", "brand",
  "marketing communication", "integrated marketing communication",
  "marketing public relations", "digital marketing", "content marketing",
  "marketing mix", "marketing", "positioning", "segmenting", "targeting",
  "soft selling", "hard selling", "selling", "endorsement", "endorser",
  "testimonial", "tagline", "copywriting", "copywriter", "billboard",
  "merchandise", "packaging", "reseller", "dropship", "affiliate",
  "e-commerce", "marketplace", "online shop", "offline", "online",

  // Kehumasan & komunikasi korporat
  "public relations", "cyber public relations", "media relations",
  "government public relations", "marketing communications",
  "corporate image", "corporate social responsibility",
  "crisis management", "issue management", "event organizer",
  "stakeholder", "stakeholders", "good governance", "e-government",
  "smart city", "one stop service", "public speaking", "lobbying",

  // Media siber & media sosial
  "social media", "new media", "mass media", "user generated content",
  "content creator", "content", "creator", "influencer",
  "key opinion leader", "opinion leader", "followers", "follower",
  "subscriber", "subscribers", "viewers", "audience", "netizen",
  "engagement rate", "engagement", "hashtag", "trending", "feed",
  "reels", "shorts", "live streaming", "live shopping", "streaming",
  "podcast", "vlogger", "vlog", "blogger", "blog", "website",
  "storytelling", "short video", "video profile", "company profile",
  "talkshow", "call to action", "search engine optimization",
  "word of mouth", "electronic word of mouth",

  // Perilaku khalayak
  "customer relationship management", "customer satisfaction",
  "customer loyalty", "customer", "consumer behavior", "buying behavior",
  "purchase intention", "buying interest", "loyalty", "awareness",
  "feedback", "review", "reviewer", "trust", "lifestyle", "mindset",

  // Teori & metode
  "agenda setting", "framing", "gatekeeper", "spiral of silence",
  "uses and gratifications", "computer mediated communication",
  "self disclosure", "self presentation", "impression management",
  "dramaturgy", "coding", "member check", "triangulasi sumber",

  // Produksi siaran
  "shooting", "editing", "newsroom", "anchor", "voice over",
  "camera person", "script writing", "storyboard", "feature",
];

// Diurutkan sekali: yang terpanjang dicoba lebih dulu, supaya "brand
// awareness" tidak keburu tercocokkan sebagai "brand" saja.
const ISTILAH_URUT = [...new Set(ISTILAH.map((kata) => kata.toLowerCase()))]
  .sort((a, b) => b.length - a.length);

/** Daftar istilah yang dimiringkan — diekspor supaya dapat diuji. */
export const ISTILAH_INGGRIS: readonly string[] = ISTILAH_URUT;

const HURUF = /[0-9A-Za-zÀ-ÿ]/;

// Kata tugas yang menandai kalimatnya memang berbahasa Indonesia. Judul yang
// tidak memuat satu pun di antaranya diperlakukan sebagai judul berbahasa
// Inggris seluruhnya — dan judul yang seluruhnya Inggris TIDAK dimiringkan,
// karena memiringkan seluruh kalimat bukan penanda istilah asing lagi.
const KATA_TUGAS_ID =
  /(^|[^0-9A-Za-z])(dan|di|ke|dari|pada|untuk|dengan|yang|dalam|terhadap|sebagai|oleh|atas|antara|melalui|tentang|serta|para|studi|kasus|analisis|pengaruh|peran|strategi|hubungan|penggunaan|persepsi)([^0-9A-Za-z]|$)/i;

const PENANDA_PAKSA = /\*([^*\n]+)\*|_([^_\n]+)_/g;

/**
 * Apakah judul ini ditulis dalam bahasa Indonesia?
 *
 * Dipakai sebagai rem, bukan sebagai pengenal bahasa: hanya judul Indonesia
 * yang istilah asingnya dimiringkan.
 */
export function judulBerbahasaIndonesia(judul: string): boolean {
  return KATA_TUGAS_ID.test(String(judul || ""));
}

/** Penggalan sesuai tanda bintang/garis bawah yang ditulis admin sendiri. */
function penggalPaksa(teks: string): PenggalJudul[] | null {
  PENANDA_PAKSA.lastIndex = 0;
  const hasil: PenggalJudul[] = [];
  let akhir = 0;
  let cocok: RegExpExecArray | null;
  while ((cocok = PENANDA_PAKSA.exec(teks)) !== null) {
    const isi = cocok[1] ?? cocok[2] ?? "";
    if (!isi.trim()) continue;
    if (cocok.index > akhir) hasil.push({ teks: teks.slice(akhir, cocok.index), miring: false });
    hasil.push({ teks: isi, miring: true });
    akhir = cocok.index + cocok[0].length;
  }
  if (!hasil.length) return null;
  if (akhir < teks.length) hasil.push({ teks: teks.slice(akhir), miring: false });
  return hasil;
}

/** Panjang istilah terpanjang yang cocok tepat pada posisi `i`, atau 0. */
function istilahDi(rendah: string, i: number): number {
  for (const istilah of ISTILAH_URUT) {
    if (!rendah.startsWith(istilah, i)) continue;
    const sesudah = rendah[i + istilah.length];
    if (sesudah !== undefined && HURUF.test(sesudah)) continue;
    return istilah.length;
  }
  return 0;
}

/**
 * Pecah judul skripsi menjadi penggalan tegak dan miring.
 *
 * Judul kosong menghasilkan daftar kosong, bukan satu penggal kosong:
 * pemanggilnya merender daftar itu apa adanya.
 */
export function penggalJudulInggris(judul: string): PenggalJudul[] {
  const teks = String(judul || "");
  if (!teks.trim()) return [];

  const paksa = penggalPaksa(teks);
  if (paksa) return paksa;

  if (!judulBerbahasaIndonesia(teks)) return [{ teks, miring: false }];

  const rendah = teks.toLowerCase();
  const hasil: PenggalJudul[] = [];
  let tegak = "";
  let i = 0;
  while (i < teks.length) {
    const awalKata = i === 0 || !HURUF.test(teks[i - 1]);
    const panjang = awalKata ? istilahDi(rendah, i) : 0;
    if (panjang > 0) {
      if (tegak) { hasil.push({ teks: tegak, miring: false }); tegak = ""; }
      hasil.push({ teks: teks.slice(i, i + panjang), miring: true });
      i += panjang;
    } else {
      tegak += teks[i];
      i += 1;
    }
  }
  if (tegak) hasil.push({ teks: tegak, miring: false });
  return hasil;
}

/** Judul tanpa tanda bintang — bentuk yang dibaca manusia, bukan yang dicetak. */
export function judulPolos(judul: string): string {
  return penggalJudulInggris(judul).map((p) => p.teks).join("");
}
