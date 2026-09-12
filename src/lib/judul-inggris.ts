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
// ---------- SETIAP ISTILAH INGGRIS, BUKAN HANYA UNGKAPAN YANG TERDAFTAR ----------
//
// Mula-mula hanya ungkapan pada `ISTILAH` yang dimiringkan. Yang tersisa
// tegak adalah justru kata Inggris yang berdiri sendiri — "engagement",
// "insight", "hoax", "flexing", "self healing" — dan satu judul yang setengah
// miring setengah tegak lebih buruk daripada tidak dimiringkan sama sekali.
//
// Sekarang judul dibaca berlapis:
//
//   1. UNGKAPAN. Yang terdaftar pada `ISTILAH` dicocokkan lebih dulu, yang
//      terpanjang menang — supaya "brand awareness" tidak keburu tercocokkan
//      sebagai "brand" saja, dan supaya ungkapan yang memuat kata serapan
//      ("digital marketing") tetap miring seutuhnya.
//   2. KATA TUNGGAL. Sisanya diperiksa kata demi kata terhadap `KATA` —
//      daftar kata Inggris yang lazim pada judul skripsi FISIP.
//   3. AKHIRAN. Kata yang belum terdaftar pun dikenali dari akhirannya kalau
//      akhiran itu MUSTAHIL dalam ejaan Indonesia: -tion, -ment, -ness,
//      -ship, -ity, -ous, -ive, -able, -ance, -ure, -age, -cy, -th. Bahasa
//      Indonesia menuliskannya -si, -men, -tas, -if, -abel — jadi
//      "sustainability", "empowerment", dan "accountability" ikut miring
//      tanpa perlu didaftar, sementara "efektivitas" dan "dokumen" tidak.
//   4. KATA TUGAS. "of", "the", "in", "and" ikut miring HANYA kalau terjepit
//      istilah Inggris di kedua sisinya — "word of mouth" miring seutuhnya,
//      tetapi "IT" pada "Divisi IT" tidak tersentuh.
//
// Penggalan miring yang hanya dipisahkan spasi disambung menjadi SATU
// penggal: "social media marketing" tercetak sebagai satu istilah asing,
// bukan tiga potong miring yang berjajar.
//
// ---------- YANG TIDAK IKUT DIMIRINGKAN ----------
//
// `TEGAK` menahan dua hal, dan ia diperiksa lebih dulu daripada semua lapis
// di atas:
//
//   a. KATA SERAPAN YANG SUDAH BAKU — media, publik, digital, video, radio,
//      televisi, film, program, produksi, informasi, komunikasi, strategi,
//      konten, viral, aplikasi, platform, gender, status, global, modern,
//      internal, target, level. Kata seperti itu ditulis tegak; memiringkannya
//      sama kelirunya dengan membiarkan istilah asing tegak.
//   b. NAMA DIRI — TikTok, Instagram, Shopee, Netflix, Gojek. Nama tidak
//      pernah dimiringkan, sekalipun asing.
//
// Judul yang seluruhnya berbahasa Inggris juga dibiarkan tegak: memiringkan
// seluruh kalimat bukan penanda istilah asing lagi.
//
// ---------- ADMIN SELALU MENANG ----------
//
// Istilah yang belum dikenali dimiringkan dengan menulisnya di antara tanda
// bintang pada kolom Judul skripsi:
//
//     Pengaruh *Brand Ambassador* terhadap Minat Beli
//
// Begitu satu tanda bintang dipakai, SELURUH lapis di atas TIDAK ikut bekerja
// pada judul itu: yang miring persis yang ditandai admin, tidak lebih. Judul
// resmi tidak boleh setengah ditentukan daftar dan setengah ditentukan
// manusia — yang seperti itu mustahil diperiksa sebelum cetak.
//
// Karena itu pula sepasang bintang kosong — `**` — berarti "jangan miringkan
// apa pun". Itu jalan keluar untuk judul yang kata Indonesianya kebetulan
// terbaca Inggris: satu ketukan, dan seluruh judul tercetak tegak.
//
// SENGAJA bebas dari React supaya dapat diuji sendirian.
// ============================================================

/** Satu penggal judul: teksnya, dan apakah ia dicetak miring. */
export type PenggalJudul = { teks: string; miring: boolean };

// ---------- 1. DAFTAR UNGKAPAN ----------
//
// Ungkapan didahulukan atas kata tunggal ("brand awareness" sebelum
// "brand"), diurutkan sendiri oleh kode di bawah menurut panjangnya.
//
// Yang wajib ada di sini hanyalah ungkapan yang TIDAK terbentuk sendiri dari
// daftar kata: yang memuat kata serapan baku ("digital marketing"), yang
// memuat kata tugas di ujungnya ("fear of missing out"), atau yang
// mengandung tanda hubung ("e-commerce").
const ISTILAH: string[] = [
  // Merek & pemasaran
  "brand awareness", "brand image", "brand loyalty", "brand equity",
  "brand ambassador", "brand trust", "personal branding", "city branding",
  "corporate branding", "rebranding", "branding", "brand",
  "marketing communication", "integrated marketing communication",
  "marketing public relations", "digital marketing", "content marketing",
  "marketing mix", "marketing", "positioning", "segmenting", "targeting",
  "soft selling", "hard selling", "selling", "endorsement", "endorser",
  "personal selling", "product placement", "product knowledge",
  "testimonial", "tagline", "copywriting", "copywriter", "billboard",
  "merchandise", "packaging", "reseller", "dropship", "affiliate",
  "e-commerce", "marketplace", "online shop", "offline", "online",
  "e-wallet", "e-money", "paylater", "cash on delivery", "flash sale",

  // Kehumasan & komunikasi korporat
  "public relations", "cyber public relations", "media relations",
  "government public relations", "marketing communications",
  "corporate image", "corporate social responsibility",
  "crisis management", "crisis communication", "issue management",
  "event organizer", "press release", "press conference", "media monitoring",
  "stakeholder", "stakeholders", "good governance", "e-government",
  "smart city", "smart governance", "one stop service", "public service",
  "public policy", "public speaking", "lobbying", "open data",
  "service excellence", "employee relations", "community relations",
  "human relations", "customer relations", "capacity building",
  "political marketing", "political branding", "citizen journalism",

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
  "word of mouth", "electronic word of mouth", "fake news", "clickbait",
  "citizen reporter", "media sosial digital",

  // Perilaku khalayak
  "customer relationship management", "customer satisfaction",
  "customer loyalty", "customer", "consumer behavior", "buying behavior",
  "purchase intention", "buying interest", "loyalty", "awareness",
  "feedback", "review", "reviewer", "trust", "lifestyle", "mindset",
  "fear of missing out", "quarter life crisis", "self healing",
  "self reward", "body shaming", "work from home", "new normal",
  "social distancing", "mental health",

  // Teori & metode
  "agenda setting", "framing", "gatekeeper", "spiral of silence",
  "uses and gratifications", "computer mediated communication",
  "self disclosure", "self presentation", "impression management",
  "dramaturgy", "coding", "member check", "triangulasi sumber",
  "focus group discussion", "depth interview", "purposive sampling",

  // Produksi siaran
  "shooting", "editing", "newsroom", "anchor", "voice over",
  "camera person", "script writing", "storyboard", "feature",
  "voice of customer", "behind the scene",
];

// ---------- 2. DAFTAR KATA TUNGGAL ----------
//
// Kata Inggris yang lazim pada judul skripsi Ilmu Komunikasi dan Ilmu
// Pemerintahan. Setiap kata di sini ditimbang satu per satu terhadap bahasa
// Indonesia: yang ejaannya SAMA dengan kata Indonesia — media, target,
// status, level, global, modern, internal — tidak pernah masuk, dan
// tercantum pada `TEGAK` di bawah supaya tidak tersesatkan ke sini.
const KATA: string[] = [
  // Merek, pemasaran & penjualan
  "advertisement", "advertising", "ads", "affiliate", "ambassador",
  "awareness", "bundling", "buyer", "buying", "benefit", "brochure",
  "campaign", "cashback", "cashless", "catalog", "catalogue", "checkout",
  "client", "consumer", "copywriter", "copywriting", "customer", "discount",
  "dropship", "dropshipper", "endorse", "endorsement", "endorser", "equity",
  "loyalty", "marketing", "marketplace", "merchandise", "merchandising",
  "outlet", "packaging", "paylater", "price", "pricing", "product",
  "promotion", "purchase", "purchasing", "reseller", "retail", "sale",
  "seller", "selling", "shop", "shopper", "shopping", "showroom", "store",
  "tagline", "testimonial", "wholesale", "wishlist", "booth", "gimmick",
  "brand", "branding", "rebranding", "positioning", "segmenting",
  "targeting", "feedback", "review", "reviewer",

  // Kehumasan, korporat & organisasi
  "accountability", "appraisal", "briefing", "career", "coaching",
  "collaboration", "company", "competence", "competency", "complaint",
  "compliance", "conference", "conflict", "corporate", "credibility",
  "crew", "crisis", "employee", "employer", "excellence", "exhibition",
  "external", "gathering", "governance", "grievance", "hearing", "leader",
  "leadership", "management", "manager", "meeting", "mentoring", "office",
  "officer", "organizer", "outsourcing", "partnership", "performance",
  "press", "publicity", "punishment", "recruitment", "release", "relation",
  "relations", "reputation", "retention", "reward", "satisfaction",
  "service", "services", "shareholder", "spokesperson", "sponsorship",
  "staff", "stakeholder", "statement", "teamwork", "training", "turnover",
  "workload", "workshop", "event", "networking", "report", "fair", "open",
  "lobbying",

  // Media, jurnalistik & produksi siaran
  "anchor", "broadcast", "broadcasting", "buzzer", "camera", "cameraman",
  "channel", "clickbait", "content", "coverage", "creator", "deadline",
  "dubbing", "editing", "fake", "feature", "footage", "framing",
  "gatekeeper", "gatekeeping", "headline", "hoax", "journal", "journalism",
  "journalist", "narrative", "news", "newsletter", "newspaper", "newsroom",
  "podcast", "podcaster", "priming", "reporting", "screenplay", "script",
  "shooting", "storyboard", "storytelling", "subtitle", "talent",
  "voiceover", "writer", "writing", "live", "streaming", "citizen",
  "highlight", "talkshow", "coding", "dramaturgy",

  // Media sosial & dunia digital
  "algorithm", "blog", "blogger", "browsing", "caption", "challenge",
  "chat", "comment", "device", "download", "duet", "engagement", "feed",
  "flexing", "follower", "followers", "gadget", "giveaway", "hardware",
  "hashtag", "impression", "influencer", "insight", "like", "likes",
  "livestreaming", "mobile", "netizen", "offline", "online", "post",
  "posting", "reach", "reels", "scrolling", "screenshot", "selfie",
  "share", "sharing", "shorts", "smartphone", "social", "software",
  "stories", "story", "subscriber", "timeline", "trend", "trending",
  "mention", "repost", "follow",
  "unboxing", "update", "upload", "user", "username", "viewer", "viewers",
  "views", "vlog", "vlogger", "vlogging", "website", "audience",

  // Perilaku, psikologi & khalayak
  "anxiety", "attitude", "behavior", "behaviour", "body", "bullying",
  "comparison", "confidence", "cosplay", "cyberbullying", "decision",
  "esteem", "expectation", "experience", "family", "fanbase", "fanboy",
  "fandom", "fangirl", "fear", "friendship", "habit", "happiness",
  "harassment", "healing", "idol", "intention", "interest", "knowledge",
  "life", "lifestyle", "loneliness", "love", "mindset", "motivation",
  "parasocial", "perception", "preference", "self", "shaming", "stress",
  "toxic", "trust", "wellbeing",

  // Pemerintahan, kebijakan & masyarakat
  "abuse", "budget", "budgeting", "bureaucracy", "candidate", "capacity",
  "citizenship", "city", "community", "corruption", "crime", "democracy",
  "development", "disaster", "election", "emergency", "empowerment",
  "evaluation", "freedom", "government", "governor", "implementation",
  "integrity", "international", "justice", "law", "legislation", "local",
  "minister", "monitoring", "national", "oversight", "participation",
  "peace", "planning", "police", "policy", "political", "politics",
  "poverty", "president", "privacy", "private", "public", "recovery",
  "region", "regulation", "response", "rights", "risk", "rural", "safety",
  "sector", "security", "smart", "society", "transparency", "village",
  "violence", "voter", "voting", "welfare", "whistleblower",

  // Akademik, metode & pendidikan
  "abstract", "analysis", "approach", "campus", "case", "citation",
  "concept", "correlation", "curriculum", "descriptive", "documentation",
  "education", "framework", "hypothesis", "indicator", "interview",
  "learning", "lecturer", "literacy", "literature", "method",
  "methodology", "observation", "population", "qualitative",
  "quantitative", "questionnaire", "regression", "reliability", "research",
  "respondent", "sample", "sampling", "school", "significance", "skill",
  "skills", "student", "study", "survey", "teacher", "teaching", "theory",
  "university", "validity", "variable",

  // Kata umum & pengubah
  "beauty", "best", "better", "big", "business", "cafe", "child",
  "children", "clean", "coffee", "cool", "creative", "cultural", "culture",
  "day", "design", "discourse", "doctor", "easy", "effect", "effective",
  "efficient", "fashion", "fast", "food", "free", "fun", "future", "game",
  "gamer", "gaming", "generation", "good", "great", "green", "growth",
  "happy", "health", "healthy", "high", "home", "hospital", "house",
  "human", "identity", "impact", "inclusive", "income", "influence",
  "innovation", "innovative", "job", "language", "low", "market", "meaning",
  "medical", "message", "messaging", "millennial", "money",
  "movie", "music", "new", "night", "old", "people", "photo", "place",
  "power", "religion", "representation", "restaurant", "semiotics", "small",
  "speech",
  "soft", "song", "space", "strategic", "strategy", "strong", "sustainable",
  "symbol", "tactic", "time", "tourism", "traditional", "transformation",
  "travel", "trip", "true", "woman", "women", "work", "working", "world",
  "year", "young", "youth",
];

// ---------- 3. AKHIRAN YANG MUSTAHIL DALAM EJAAN INDONESIA ----------
//
// Bahasa Indonesia menyerap akhiran Inggris dengan bentuknya sendiri:
// -tion menjadi -si, -ment menjadi -men, -ity menjadi -tas, -ive menjadi
// -if, -able menjadi -abel, -ism menjadi -isme. Kata yang masih berakhiran
// bentuk Inggrisnya karena itu pasti belum diserap — dan itulah yang
// dimiringkan, walau tidak terdaftar di atas.
//
// Setiap akhiran diberi panjang kata terkecil supaya kata pendek yang
// kebetulan berakhiran sama tidak ikut terbawa ("city", "live", "with").
const AKHIRAN: ReadonlyArray<readonly [string, number]> = [
  ["tion", 6], ["sion", 6], ["ment", 6], ["ness", 6], ["ship", 6],
  ["hood", 6], ["ity", 5], ["ism", 5], ["ous", 5], ["ive", 5],
  ["able", 6], ["ible", 6], ["ful", 5], ["less", 6], ["ance", 6],
  ["ence", 6], ["ure", 5], ["age", 5], ["cy", 4], ["th", 5],
  ["ology", 7], ["graphy", 8], ["ics", 5],
];

// ---------- 4. KATA TUGAS INGGRIS ----------
//
// Ikut miring HANYA kalau terjepit istilah Inggris di kedua sisinya, dan
// tidak pernah menjadi alasan sepotong judul mulai dimiringkan. Tanpa rem
// itu, "Divisi IT", "No. 5", dan "Pasal 12 A" ikut tercetak miring.
const PENYAMBUNG: string[] = [
  "a", "an", "and", "about", "after", "all", "also", "among", "are", "as",
  "at", "be", "before", "between", "but", "by", "during", "for", "from",
  "her", "his", "how", "in", "into", "is", "it", "its", "more", "most",
  "my", "no", "not", "of", "off", "on", "or", "our", "out", "over", "than",
  "that", "the", "their", "then", "this", "through", "to", "too", "under",
  "up", "upon", "very", "we", "what", "when", "where", "which", "who",
  "why", "with", "within", "without", "you", "your",
];

// ---------- 5. YANG TIDAK PERNAH DIMIRINGKAN ----------
//
// Diperiksa PALING DULU pada pemeriksaan kata tunggal. Dua isinya:
//
//   a. kata serapan yang sudah baku dalam bahasa Indonesia — ejaannya sama
//      dengan ejaan Inggrisnya, jadi hanya daftar ini yang dapat
//      membedakannya;
//   b. nama diri — nama lembaga, aplikasi, dan merek. Nama tidak pernah
//      dimiringkan, sekalipun asing.
//
// Ungkapan pada `ISTILAH` tetap menang atas daftar ini: "digital marketing"
// miring seutuhnya walau "digital" sendirian ditulis tegak, karena yang
// miring di situ istilah asingnya, bukan kata serapannya.
const TEGAK: string[] = [
  // Serapan yang sudah baku (KBBI) — ejaannya sama dengan Inggrisnya
  "media", "medium", "publik", "digital", "video", "audio", "visual",
  "radio", "televisi", "film", "program", "produksi", "produser",
  "promosi", "informasi", "komunikasi", "strategi", "konten", "viral",
  "aplikasi", "platform", "internet", "data", "gender", "status", "global",
  "modern", "personal", "profesional", "internal", "regional", "urban",
  "legal", "moral", "normal", "formal", "total", "final", "level",
  "target", "format", "standar", "editor", "editorial", "reporter",
  "presenter", "moderator", "sponsor", "aktor", "figur", "isu", "opini",
  "sistem", "bisnis", "tim", "grup", "klub", "hotel", "salon", "parade",
  "bonus", "fokus", "kasus", "virus", "plus", "poster", "rating", "filter",
  "stiker", "emoji", "agenda", "propaganda", "seminar", "episode",
  "profit", "sport", "host", "massa", "loyal", "detail", "server",
  "browser", "mental", "man", "art", "pers", "top",

  // Nama diri — lembaga, aplikasi, merek
  "tiktok", "instagram", "youtube", "whatsapp", "facebook", "twitter",
  "threads", "telegram", "shopee", "tokopedia", "lazada", "bukalapak",
  "blibli", "netflix", "spotify", "grab", "gojek", "maxim", "zoom",
  "google", "canva", "capcut", "snapchat", "line", "pinterest",
  "linkedin", "twitch", "discord", "disney", "vidio", "starbucks",
  "mcdonald", "indomaret", "alfamart", "traveloka", "dana", "ovo",
  "gopay", "halodoc", "ruangguru", "muhammadiyah",
];

// Diurutkan sekali: yang terpanjang dicoba lebih dulu, supaya "brand
// awareness" tidak keburu tercocokkan sebagai "brand" saja.
const ISTILAH_URUT = [...new Set(ISTILAH.map((kata) => kata.toLowerCase()))]
  .sort((a, b) => b.length - a.length);

const KATA_SET = new Set(KATA.map((kata) => kata.toLowerCase()));
const PENYAMBUNG_SET = new Set(PENYAMBUNG.map((kata) => kata.toLowerCase()));
const TEGAK_SET = new Set(TEGAK.map((kata) => kata.toLowerCase()));

/** Daftar ungkapan yang dimiringkan — diekspor supaya dapat diuji. */
export const ISTILAH_INGGRIS: readonly string[] = ISTILAH_URUT;
/** Daftar kata tunggal yang dimiringkan — diekspor supaya dapat diuji. */
export const KATA_INGGRIS: readonly string[] = [...KATA_SET].sort();
/** Kata serapan baku & nama diri yang tidak pernah miring — untuk diuji. */
export const KATA_TEGAK: readonly string[] = [...TEGAK_SET].sort();

const HURUF = /[0-9A-Za-zÀ-ÿ]/;

// Kata tugas yang menandai kalimatnya memang berbahasa Indonesia. Judul yang
// tidak memuat satu pun di antaranya diperlakukan sebagai judul berbahasa
// Inggris seluruhnya — dan judul yang seluruhnya Inggris TIDAK dimiringkan,
// karena memiringkan seluruh kalimat bukan penanda istilah asing lagi.
const KATA_TUGAS_ID =
  /(^|[^0-9A-Za-z])(dan|di|ke|dari|pada|untuk|dengan|yang|dalam|terhadap|sebagai|oleh|atas|antara|melalui|tentang|serta|para|studi|kasus|analisis|pengaruh|peran|strategi|hubungan|penggunaan|persepsi)([^0-9A-Za-z]|$)/i;

const PENANDA_PAKSA = /\*([^*\n]*)\*|_([^_\n]+)_/g;

// Satu kata: huruf dan angka, boleh bersambung dengan tanda hubung atau
// apostrof ("e-wallet", "mother's"). Tanda baca lain memutus kata.
const KATA_RE = /[0-9A-Za-zÀ-ÿ]+(?:[-'’][0-9A-Za-zÀ-ÿ]+)*/g;

type Kata = { awal: number; akhir: number; teks: string };

/**
 * Apakah judul ini ditulis dalam bahasa Indonesia?
 *
 * Dipakai sebagai rem, bukan sebagai pengenal bahasa: hanya judul Indonesia
 * yang istilah asingnya dimiringkan.
 */
export function judulBerbahasaIndonesia(judul: string): boolean {
  return KATA_TUGAS_ID.test(String(judul || ""));
}

/**
 * Penggalan sesuai tanda bintang/garis bawah yang ditulis admin sendiri.
 *
 * Sepasang bintang kosong (`**`) juga dihitung sebagai tanda: ia tidak
 * memiringkan apa pun, tetapi ia memindahkan judul itu ke tangan admin —
 * itulah cara menyatakan "jangan miringkan apa pun".
 */
function penggalPaksa(teks: string): PenggalJudul[] | null {
  // Saklar `**` dibuang lebih dulu — bersama spasi kembarnya, supaya judul
  // yang tercetak tidak menyisakan lubang di tempat tanda itu berdiri.
  const dibuang = teks.replace(/\s*\*\*\s*/g, (bagian) => (/\s/.test(bagian) ? " " : ""));
  const saklar = dibuang !== teks;
  const bersih = saklar ? dibuang.trim() : teks;

  PENANDA_PAKSA.lastIndex = 0;
  const hasil: PenggalJudul[] = [];
  let ditandai = false;
  let akhir = 0;
  let cocok: RegExpExecArray | null;
  while ((cocok = PENANDA_PAKSA.exec(bersih)) !== null) {
    const isi = cocok[1] ?? cocok[2] ?? "";
    ditandai = true;
    if (cocok.index > akhir) hasil.push({ teks: bersih.slice(akhir, cocok.index), miring: false });
    if (isi.trim()) hasil.push({ teks: isi, miring: true });
    akhir = cocok.index + cocok[0].length;
  }
  if (!ditandai && !saklar) return null;
  if (akhir < bersih.length) hasil.push({ teks: bersih.slice(akhir), miring: false });
  return rapatkan(hasil);
}

/** Panjang ungkapan terpanjang yang cocok tepat pada posisi `i`, atau 0. */
function istilahDi(rendah: string, i: number): number {
  for (const istilah of ISTILAH_URUT) {
    if (!rendah.startsWith(istilah, i)) continue;
    const sesudah = rendah[i + istilah.length];
    if (sesudah !== undefined && HURUF.test(sesudah)) continue;
    return istilah.length;
  }
  return 0;
}

/** Satu kata utuh: terdaftar, bentuk jamaknya, atau berakhiran Inggris. */
function kataTunggalInggris(kata: string): boolean {
  if (kata.length < 2) return false;
  if (KATA_SET.has(kata)) return true;
  // Bentuk jamak tidak didaftar dua kali: "influencers" ikut "influencer".
  if (kata.endsWith("ies") && KATA_SET.has(`${kata.slice(0, -3)}y`)) return true;
  if (kata.endsWith("es") && KATA_SET.has(kata.slice(0, -2))) return true;
  if (kata.endsWith("s") && KATA_SET.has(kata.slice(0, -1))) return true;
  return AKHIRAN.some(([akhiran, terkecil]) =>
    kata.length >= terkecil && kata.endsWith(akhiran));
}

/**
 * Apakah kata ini istilah Inggris yang harus dicetak miring?
 *
 * Kata bertanda hubung diperiksa per bagian: "e-wallet" miring karena
 * "wallet", dan "non-formal" tegak karena "formal" adalah serapan baku.
 * Diekspor supaya daftarnya dapat diuji kata demi kata.
 */
export function kataInggris(kata: string): boolean {
  const bagian = String(kata || "").toLowerCase().split(/[-'’]/).filter(Boolean);
  if (!bagian.length) return false;
  if (bagian.some((satu) => TEGAK_SET.has(satu) || PENYAMBUNG_SET.has(satu))) return false;
  return bagian.some(kataTunggalInggris);
}

/** Kata tugas Inggris — miring hanya kalau terjepit istilah Inggris. */
function kataPenyambung(kata: string): boolean {
  return PENYAMBUNG_SET.has(kata.toLowerCase());
}

function kataDalam(teks: string): Kata[] {
  KATA_RE.lastIndex = 0;
  const hasil: Kata[] = [];
  let cocok: RegExpExecArray | null;
  while ((cocok = KATA_RE.exec(teks)) !== null) {
    hasil.push({ awal: cocok.index, akhir: cocok.index + cocok[0].length, teks: cocok[0] });
  }
  return hasil;
}

/** Gabungkan penggalan bertetangga yang sama sifatnya. */
function rapatkan(penggal: PenggalJudul[]): PenggalJudul[] {
  const hasil: PenggalJudul[] = [];
  for (const bagian of penggal) {
    if (!bagian.teks) continue;
    const akhir = hasil[hasil.length - 1];
    if (akhir && akhir.miring === bagian.miring) akhir.teks += bagian.teks;
    else hasil.push({ ...bagian });
  }
  return hasil;
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
  const tanda = new Array<boolean>(teks.length).fill(false);
  const tandai = (awal: number, akhir: number) => {
    for (let i = awal; i < akhir; i += 1) tanda[i] = true;
  };

  // 1. Ungkapan terdaftar, yang terpanjang lebih dulu.
  let i = 0;
  while (i < teks.length) {
    const awalKata = i === 0 || !HURUF.test(teks[i - 1]);
    const panjang = awalKata ? istilahDi(rendah, i) : 0;
    if (panjang > 0) {
      tandai(i, i + panjang);
      i += panjang;
    } else {
      i += 1;
    }
  }

  // 2. Kata tunggal yang belum ikut ungkapan.
  const kata = kataDalam(teks);
  for (const satu of kata) {
    if (tanda[satu.awal]) continue;
    if (kataInggris(satu.teks)) tandai(satu.awal, satu.akhir);
  }

  // 3. Kata tugas Inggris yang terjepit istilah Inggris di kedua sisinya.
  for (let n = 0; n < kata.length; n += 1) {
    if (tanda[kata[n].awal] || !kataPenyambung(kata[n].teks)) continue;
    let ujung = n;
    while (ujung + 1 < kata.length
      && !tanda[kata[ujung + 1].awal]
      && kataPenyambung(kata[ujung + 1].teks)) ujung += 1;
    const sebelum = kata[n - 1];
    const sesudah = kata[ujung + 1];
    // Antara keduanya hanya boleh ada huruf dan spasi: tanda baca — koma,
    // titik dua, tanda kurung — memutus istilah, bukan menyambungnya.
    if (sebelum && sesudah && tanda[sebelum.awal] && tanda[sesudah.awal]
      && /^[\s0-9A-Za-zÀ-ÿ'’-]+$/.test(teks.slice(sebelum.akhir, sesudah.awal))) {
      tandai(kata[n].awal, kata[ujung].akhir);
    }
    n = ujung;
  }

  // 4. Spasi di antara dua penggal miring ikut miring: satu istilah asing
  //    dicetak sebagai satu penggal, bukan potongan miring yang berjajar.
  let j = 0;
  while (j < teks.length) {
    if (tanda[j] || !/\s/.test(teks[j])) { j += 1; continue; }
    let ujung = j;
    while (ujung < teks.length && !tanda[ujung] && /\s/.test(teks[ujung])) ujung += 1;
    if (j > 0 && tanda[j - 1] && ujung < teks.length && tanda[ujung]) tandai(j, ujung);
    j = ujung + 1;
  }

  // Dipecah per satuan UTF-16, sama seperti `tanda` diindeks: huruf yang
  // berpasangan ikut bersama karena sifat miringnya sama, dan `rapatkan`
  // menyatukannya kembali.
  return rapatkan(Array.from({ length: teks.length },
    (_, n) => ({ teks: teks[n], miring: tanda[n] })));
}

/** Judul tanpa tanda bintang — bentuk yang dibaca manusia, bukan yang dicetak. */
export function judulPolos(judul: string): string {
  return penggalJudulInggris(judul).map((p) => p.teks).join("");
}
