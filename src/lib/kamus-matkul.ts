// ============================================================
// KAMUS NAMA MATA KULIAH — Indonesia ke Inggris
//
// Transkrip berbahasa Inggris menuntut nama mata kuliah dalam bahasa Inggris.
// Berkas mentah dari SIMAK hanya memuat nama Indonesia, dan versi
// dwibahasanya harus diminta ke KUI setiap kali ada lulusan baru — yang
// artinya menunggu, dan menunggu untuk pekerjaan yang sama berulang-ulang.
//
// ---------- KODE MATA KULIAH TIDAK UNIK ANTAR PRODI ----------
//
// Kamus ini semula satu daftar datar: satu kode, satu nama Inggris. Itu
// keliru, dan keliru dengan diam. Ilmu Komunikasi dan Ilmu Pemerintahan
// memakai AWALAN KODE YANG SAMA untuk mata kuliah yang BERBEDA:
//
//   MKK-012   Ilmu Pemerintahan : Pengantar Sosiologi
//             Ilmu Komunikasi   : Ilmu Budaya Dasar
//   MKK-020   Ilmu Pemerintahan : Dasar Dasar Logika
//             Ilmu Komunikasi   : Komputer Dan Multimedia
//   MKPB-051  Ilmu Pemerintahan : PKL
//             Ilmu Komunikasi   : Produksi Feature TV  (Broadcasting)
//   MKPB-052  Ilmu Pemerintahan : KKN
//             Ilmu Komunikasi   : Produksi Dan Pasca Produksi  (Broadcasting)
//
// Sepuluh kode bertabrakan seperti itu. Transkrip Ilmu Komunikasi karenanya
// tercetak dengan "Introduction to Sociology" di bawah "Ilmu Budaya Dasar",
// dan "Field Work Practice (Internship)" di bawah "Produksi Feature TV" —
// ikut dilegalisir, ikut dikirim ke luar negeri.
//
// Jadi kamusnya sekarang BERLINGKUP: satu kamus per kurikulum, dan
// kurikulum Ilmu Komunikasi dipecah lagi per konsentrasi. Yang menentukan
// kamus mana yang dipakai adalah prodi dan konsentrasi pada biodata
// transkrip yang sedang dikerjakan.
//
// ---------- ASAL DATANYA ----------
//
// Nama Inggris Ilmu Komunikasi disalin dari transkrip dwibahasa resmi
// fakultas untuk ketiga konsentrasi (Public Relations, Broadcasting,
// Advertising) — bukan terjemahan yang dikarang di sini. Ketika ketiga
// berkas itu berselisih untuk kode yang sama, yang dipakai adalah bunyi
// yang muncul pada mayoritas berkas; selisihnya dicatat di
// UPDATE-V32-KAMUS-PER-KONSENTRASI.md supaya dapat ditimpa admin kalau
// fakultas memutuskan lain.
//
// ---------- TIGA LAPIS ----------
//
//   1. KODE mata kuliah, DI DALAM LINGKUPNYA. Paling tepat.
//   2. NAMA yang diseragamkan. Menampung kode yang berganti antar kurikulum
//      sementara namanya tetap.
//   3. KATA per kata. Bukan terjemahan yang indah, tetapi terbaca — dan yang
//      terbaca dapat diperbaiki admin dalam hitungan detik, sedangkan kolom
//      kosong menuntut ia mengetik seluruh barisnya sendiri.
//
// Lapis ketiga TIDAK PERNAH menebak diam-diam: hasilnya ditandai supaya
// layarnya dapat menyorot baris yang perlu dilihat manusia. Transkrip adalah
// dokumen resmi; terjemahan yang salah di sana ikut tercetak dan ikut
// dilegalisir.
//
// SENGAJA bebas dari database dan React supaya dapat diuji sendirian.
// ============================================================

/** Seragamkan nama untuk dicocokkan: huruf kecil, tanpa tanda baca ganda. */
export function rapikanNama(nama: string) {
  return String(nama || "")
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Seragamkan kode: huruf besar, tanpa spasi. */
export function rapikanKode(kode: string) {
  return String(kode || "").toUpperCase().replace(/\s+/g, "");
}

// ---------- LINGKUP KURIKULUM ----------
//
// Kunci lingkup dipakai DUA kali: untuk memilih kamus bawaan di berkas ini,
// dan sebagai awalan kunci pada kamus koreksi admin yang tersimpan di
// database ("ilkom-bc::MKPB-051"). Karena ikut tersimpan, nilainya tidak
// boleh diubah begitu sudah dipakai.
export const LINGKUP_PEMERINTAHAN = "pemerintahan";
export const LINGKUP_ILKOM = "ilkom";
export const LINGKUP_ILKOM_PR = "ilkom-pr";
export const LINGKUP_ILKOM_BC = "ilkom-bc";
export const LINGKUP_ILKOM_ADV = "ilkom-adv";

export const SEMUA_LINGKUP = [
  LINGKUP_PEMERINTAHAN,
  LINGKUP_ILKOM,
  LINGKUP_ILKOM_PR,
  LINGKUP_ILKOM_BC,
  LINGKUP_ILKOM_ADV,
] as const;

export type Lingkup = { prodi?: string; konsentrasi?: string };

const KONSENTRASI_ILKOM: Array<[RegExp, string]> = [
  [/public\s*relation|humas|kehumasan|\bpr\b/i, LINGKUP_ILKOM_PR],
  [/broadcast|penyiaran|\bbc\b/i, LINGKUP_ILKOM_BC],
  [/advertis|periklanan|\biklan\b|\badv\b/i, LINGKUP_ILKOM_ADV],
];

/**
 * Kamus mana saja yang ditelusuri untuk satu transkrip, paling khusus dulu.
 *
 * Konsentrasi yang tertulis selalu menang. Dua konsentrasi Ilmu Komunikasi
 * yang lain tetap ikut ditelusuri SESUDAHNYA, bukan dibuang: kode ketiganya
 * berawalan berbeda (MKSP/MKPP, MKSB/MKPB, MKSA/MKPA) sehingga tidak pernah
 * bertabrakan satu sama lain, dan mahasiswa yang mengambil mata kuliah
 * lintas konsentrasi karena itu tetap mendapat nama Inggrisnya.
 *
 * Prodi yang TIDAK dikenali menghasilkan rantai kosong — dan rantai kosong
 * sengaja tidak menebak: lihat `terjemahkanMatkul`.
 */
export function rantaiLingkup(lingkup?: Lingkup): string[] {
  const prodi = String(lingkup?.prodi || "");
  if (/komunikasi/i.test(prodi)) {
    const kons = String(lingkup?.konsentrasi || "");
    const cocok = KONSENTRASI_ILKOM.find(([re]) => re.test(kons))?.[1];
    const lain = [LINGKUP_ILKOM_PR, LINGKUP_ILKOM_BC, LINGKUP_ILKOM_ADV].filter((k) => k !== cocok);
    return cocok ? [cocok, LINGKUP_ILKOM, ...lain] : [LINGKUP_ILKOM, ...lain];
  }
  if (/pemerintahan/i.test(prodi)) return [LINGKUP_PEMERINTAHAN];
  return [];
}

/** Kunci penyimpanan koreksi admin untuk satu lingkup: "ilkom-bc::MKPB-051". */
export function kunciKamus(lingkup: string, kode: string) {
  return `${lingkup}::${rapikanKode(kode)}`;
}

/** Lingkup terkhusus untuk satu transkrip — dipakai saat menyimpan koreksi. */
export function lingkupUtama(lingkup?: Lingkup): string {
  return rantaiLingkup(lingkup)[0] || "";
}

// ---------- KAMUS ILMU KOMUNIKASI ----------
//
// Disalin dari transkrip dwibahasa resmi fakultas untuk ketiga konsentrasi.
// Tiap baris: [ kode, nama Indonesia sebagaimana tertulis di SIMAK,
// nama Inggris sebagaimana tercetak di transkrip resmi ].
//
// Nama Indonesianya ikut dicatat, bukan sekadar hiasan: dari situ lapis
// NAMA dibangun sendiri, sehingga mata kuliah yang kodenya berganti antar
// angkatan tetap ketemu selama namanya masih sama.
type Entri = [kode: string, id: string, en: string];

// Mata kuliah inti Ilmu Komunikasi — sama pada ketiga konsentrasi.
const ILKOM_INTI: Entri[] = [
  ["MKB-001","Teori Komunikasi",                     "Communication Theory"],
  ["MKB-002","Psikologi Komunikasi",                 "Communication Psychology"],
  ["MKB-003","Etika Dan Filsafat Komunikasi",        "Communication Ethics and Philosophy"],
  ["MKB-004","Media Dan Kajian Budaya",              "Media and Cultural Studies"],
  ["MKB-005","Media Dan Opini Publik",               "Media and Public Opinion"],
  ["MKB-006","Komunikasi Antar Budaya",              "Intercultural Communication"],
  ["MKB-007","Media Dan Komunikasi Massa",           "Media and Mass Communication"],
  ["MKB-008","Sosiologi Komunikasi",                 "Sociology of Communication"],
  ["MKB-009","Dasar Dasar Penulisan",                "Fundamentals of Writing"],
  ["MKB-010","Komunikasi Politik",                   "Political Communication"],
  ["MKB-011","Komunikasi Sosial Pembangunan",        "Development Communication"],
  ["MKB-012","Perkembangan Teknologi Komunikasi",    "Development of Communication Technology"],
  ["MKB-013","Dasar Dasar Jurnalistik",              "Fundamentals of Journalism"],
  ["MKB-014","Dasar Dasar Public Relations",         "Fundamentals of Public Relations"],
  ["MKB-015","Dasar Dasar Periklanan",               "Fundamentals of Advertising"],
  ["MKB-016","Metode Penelitian Komunikasi I",       "Communication Research Methods I"],
  ["MKB-018","Komunikasi Persuasif",                 "Persuasive Communication"],
  ["MKB-019","Fotografi Dan Praktik",                "Photography and Practice"],
  ["MKB-037","Metode Penelitian Komunikasi II",      "Communication Research Methods II"],
  ["MKB-040","Komunikasi Organisasi",                "Organizational Communication"],
  ["MKB-041","PKL",                                  "Field Work Practice (Internship)"],
  ["MKB-042","KKN",                                  "Community Service Program (Real Work Lecture / KKN)"],
  ["MKB-043","Seminar Komunikasi",                   "Communication Seminar"],
  ["MKB-044","Skripsi",                              "Undergraduate Thesis"],
  ["MKK-007","Sistem Ekonomi Indonesia",             "Indonesian Economic System"],
  ["MKK-009","Azas Azas Managemen",                  "Principles of Management"],
  ["MKK-012","Ilmu Budaya Dasar",                    "Basic Cultural Studies"],
  ["MKK-018","Kewirausahaan",                        "Entrepreneurship"],
  ["MKK-020","Komputer Dan Multimedia",              "Computer and Multimedia"],
  ["MPK-001","AIKA I",                               "Islamic and Muhammadiyah Studies I"],
  ["MPK-002","AIKA II",                              "Islamic and Muhammadiyah Studies II"],
  ["MPK-003","AIKA III",                             "Islamic and Muhammadiyah Studies III"],
  ["MPK-004","AIKA IV",                              "Islamic and Muhammadiyah Studies IV"],
  ["MPK-005","AIKA V",                               "Islamic and Muhammadiyah Studies V"],
  ["MPK-006","Pancasila Dan Kewarganegaraan",        "Pancasila and Civic Education"],
  ["MPK-007","Bahasa Indonesia",                     "Indonesian Language"],
  ["MPK-008","Bahasa Inggris I",                     "English I"],
  ["MPK-009","Bahasa Inggris II",                    "English II"],
  ["MPK-010","Filsafat Pengetahuan Dan Dasar Logika","Philosophy of Knowledge and Fundamentals of Logic"],
  ["MPK-011","Sosiologi Dan Sistem Sosial Indonesia","Sociology and Indonesian Social System"],
  ["MPK-013","Pengantar Ilmu Politik",               "Introduction to Political Science"],
  ["MPK-014","Pengantar Statistik Sosial",           "Introduction to Social Statistics"],
  ["MPK-015","Pengantar Ilmu Komunikasi",            "Introduction to Communication Science"],
  ["MPK-016","Sistem Hukum Indonesia",               "Indonesian Legal System"],
];

// Mata kuliah konsentrasi Public Relations.
const ILKOM_PR: Entri[] = [
  ["MKPP-001","Managemen Krisis",                  "Crisis Management"],
  ["MKPP-002","Media Relations",                   "Media Relations"],
  ["MKSP-001","Protokoler",                        "Protocol Affairs"],
  ["MKSP-002","Cyber Public Relations",            "Cyber Public Relations"],
  ["MKSP-003","Penulisan Naskah Kehumasan",        "Public Relations Writing"],
  ["MKSP-004","Event Managemen",                   "Event Management"],
  ["MKSP-005","Public Speaking",                   "Public Speaking"],
  ["MKSP-006","Strategi Kampanye Public Relations","Public Relations Campaign Strategy"],
];

// Mata kuliah konsentrasi Broadcasting.
const ILKOM_BC: Entri[] = [
  ["MKPB-051","Produksi Feature TV",            "TV Feature Production"],
  ["MKPB-052","Produksi Dan Pasca Produksi",    "Production and Post-Production"],
  ["MKSB-045","Managemen Penerbitan Elektronik","Electronic Publishing Management"],
  ["MKSB-046","Digital Editing",                "Digital Editing"],
  ["MKSB-047","Cinematografi",                  "Cinematography"],
  ["MKSB-048","Produksi Berita TV",             "TV News Production"],
  ["MKSB-049","Produksi Siaran Radio",          "Radio Broadcast Production"],
  ["MKSB-050","Teknik Kamera",                  "Camera Techniques"],
];

// Mata kuliah konsentrasi Advertising.
const ILKOM_ADV: Entri[] = [
  ["MKPA-051","Presentasi Dan Negosiasi",           "Presentation and Negotiation"],
  ["MKPA-052","Riset Iklan",                        "Advertising Research"],
  ["MKSA-045","Komunikasi Pemasaran",               "Marketing Communication"],
  ["MKSA-046","Desain Komunikasi Visual I",         "Visual Communication Design I"],
  ["MKSA-047","Produksi Cetak Dan Iklan Elektronik","Print Production and Electronic Advertising"],
  ["MKSA-048","Managemen Periklanan",               "Advertising Management"],
  ["MKSA-049","Perilaku Konsumen",                  "Consumer Behavior"],
  ["MKSA-050","Desain Komunikasi Visual II",        "Visual Communication Design II"],
];

// ---------- KAMUS ILMU PEMERINTAHAN ----------
//
// Kurikulum Ilmu Pemerintahan FISIP, kode apa adanya dari SIMAK. Daftar ini
// TIDAK berlaku untuk Ilmu Komunikasi: sepuluh kode di dalamnya dipakai ulang
// di sana untuk mata kuliah yang sama sekali berbeda.
const PEMERINTAHAN_KODE: Record<string, string> = {
  // Mata kuliah pengembangan kepribadian
  "MPK-001": "Al-Islam and Kemuhammadiyahan I",
  "MPK-002": "Al-Islam and Kemuhammadiyahan II",
  "MPK-003": "Al-Islam and Kemuhammadiyahan III",
  "MPK-004": "Al-Islam and Kemuhammadiyahan IV",
  "MPK-005": "Al-Islam and Kemuhammadiyahan V",
  "MPK-006": "Pancasila and Civic Education",
  "MPK-007": "Indonesian Language",
  "MPK-008": "English I",
  "MPK-009": "English II",
  "MPK-010": "Philosophy of Science",

  // Mata kuliah keilmuan dan keterampilan
  "MKK-011": "Basic Cultural Sciences",
  "MKK-012": "Introduction to Sociology",
  "MKK-013": "Introduction to Political Science",
  "MKK-014": "Introduction to Government Science",
  "MKK-015": "Sociology of Government",
  "MKK-016": "Indonesian Legal System",
  "MKK-017": "Indonesian Economic System",
  "MKK-018": "Entrepreneurship",
  "MKK-019": "Principles of Management",
  "MKK-020": "Fundamentals of Logic",
  "MKK-021": "Indonesian Social System",
  "MKK-022": "Indonesian Political System",
  "MKK-023": "Methodology of Government Science",
  "MKK-024": "Islamic Political Thought",
  "MKK-032": "Indonesian Bureaucracy",

  // Mata kuliah keahlian berkarya
  "MKKB-025": "Leadership",
  "MKKB-026": "Regional Government System and Regional Autonomy",
  "MKKB-027": "Qualitative Research Methods",
  "MKKB-028": "Village Government System",
  "MKKB-029": "Indonesian Government System",
  "MKKB-030": "Quantitative Research Methods",
  "MKKB-031": "Government Organization and Management",
  "MKKB-033": "Government Ethics",
  "MKKB-034": "Government Ecology",
  "MKKB-035": "Document Administration and Archiving",
  "MKKB-036": "Development Program Management",
  "MKKB-037": "Public Service Management",
  "MKKB-038": "Procurement of Goods and Services Management",
  "MKKB-039": "Regional Financial Politics",
  "MKKB-040": "Conflict Management and Area Studies",
  "MKKB-041": "Indonesian Party System and General Elections",
  "MKKB-042": "Legislative Process",
  "MKKB-043": "Agrarian Legal Politics",
  "MKKB-044": "Public Policy Analysis",
  "MKKB-045": "Political Theory and Philosophy",
  "MKKB-046": "Comparative Political and Government Systems",
  "MKKB-047": "Civil Society",

  // Mata kuliah perilaku berkarya
  "MKPB-048": "Selected Topics in Government",
  "MKPB-049": "Electronic Government (E-Government)",
  "MKPB-050": "Government Seminar",
  "MKPB-051": "Field Work Practice (Internship)",
  "MKPB-052": "Community Service Program",
  "MKPB-053": "Undergraduate Thesis",
};

// ---------- MERAKIT LINGKUP ----------

type KamusLingkup = { kode: Record<string, string>; nama: Record<string, string> };

function rakit(entri: Entri[]): KamusLingkup {
  const kode: Record<string, string> = {};
  const nama: Record<string, string> = {};
  for (const [k, id, en] of entri) {
    kode[rapikanKode(k)] = en;
    nama[rapikanNama(id)] = en;
  }
  return { kode, nama };
}

const KAMUS: Record<string, KamusLingkup> = {
  [LINGKUP_PEMERINTAHAN]: { kode: PEMERINTAHAN_KODE, nama: {} },
  [LINGKUP_ILKOM]: rakit(ILKOM_INTI),
  [LINGKUP_ILKOM_PR]: rakit(ILKOM_PR),
  [LINGKUP_ILKOM_BC]: rakit(ILKOM_BC),
  [LINGKUP_ILKOM_ADV]: rakit(ILKOM_ADV),
};

/**
 * Kode yang berarti SAMA di seluruh lingkup.
 *
 * Dipakai hanya ketika prodinya tidak diketahui. Kode yang artinya berbeda
 * antar prodi sengaja TIDAK masuk sini: menebak salah satunya berarti
 * mencetak nama mata kuliah milik prodi lain pada transkrip resmi, persis
 * kesalahan yang memaksa kamus ini dipecah.
 */
const KODE_TAKSAMAR: Record<string, string> = (() => {
  const kumpul: Record<string, Set<string>> = {};
  for (const lingkup of SEMUA_LINGKUP) {
    for (const [kode, en] of Object.entries(KAMUS[lingkup].kode)) {
      (kumpul[kode] ||= new Set()).add(en);
    }
  }
  const hasil: Record<string, string> = {};
  for (const [kode, isi] of Object.entries(kumpul)) {
    if (isi.size === 1) hasil[kode] = [...isi][0];
  }
  return hasil;
})();

/** Kode yang artinya berbeda antar prodi — yang memicu pemisahan kamus ini. */
export function kodeBentrok(): string[] {
  const semua = new Set(SEMUA_LINGKUP.flatMap((lingkup) => Object.keys(KAMUS[lingkup].kode)));
  return [...semua].filter((kode) => !(kode in KODE_TAKSAMAR)).sort();
}

/**
 * Kamus kode Ilmu Pemerintahan.
 *
 * Tetap diekspor dengan nama lamanya supaya pemanggil yang sudah ada tidak
 * ikut berubah — tetapi ia bukan lagi SATU-SATUNYA kamus kode.
 */
export const KAMUS_KODE = PEMERINTAHAN_KODE;

// ---------- KAMUS LINTAS PRODI, DICOCOKKAN MENURUT NAMA ----------
//
// Jaring terakhir sebelum tebakan kata, berlaku untuk SEMUA lingkup. Isinya
// nama yang berarti sama di kurikulum mana pun — "Kewirausahaan", "Skripsi",
// "PKL" — sehingga aman dipakai bahkan ketika prodinya tidak diketahui.
//
// Kalau satu nama berarti lain di satu kurikulum tertentu, tempatnya BUKAN
// di sini melainkan di kamus lingkup itu, yang ditelusuri lebih dulu.
const NAMA_MENTAH: Array<[string, string]> = [
  // Umum lintas prodi
  ["ilmu budaya dasar", "Basic Cultural Sciences"],
  ["pengantar sosiologi", "Introduction to Sociology"],
  ["pengantar ilmu politik", "Introduction to Political Science"],
  ["pengantar ilmu pemerintahan", "Introduction to Government Science"],
  ["pengantar ilmu komunikasi", "Introduction to Communication Science"],
  ["pengantar antropologi", "Introduction to Anthropology"],
  ["pengantar ilmu ekonomi", "Introduction to Economics"],
  ["pengantar statistik sosial", "Introduction to Social Statistics"],
  ["pancasila dan kewarganegaraan", "Pancasila and Civic Education"],
  ["pendidikan pancasila", "Pancasila Education"],
  ["pendidikan kewarganegaraan", "Civic Education"],
  ["bahasa indonesia", "Indonesian Language"],
  ["bahasa inggris", "English"],
  ["bahasa inggris i", "English I"],
  ["bahasa inggris ii", "English II"],
  ["bahasa inggris iii", "English III"],
  ["filsafat ilmu pengetahuan", "Philosophy of Science"],
  ["filsafat ilmu", "Philosophy of Science"],
  ["kewirausahaan", "Entrepreneurship"],
  ["dasar dasar logika", "Fundamentals of Logic"],
  ["logika", "Logic"],
  ["kepemimpinan", "Leadership"],
  ["civil society", "Civil Society"],
  ["skripsi", "Undergraduate Thesis"],
  ["pkl", "Field Work Practice (Internship)"],
  ["praktek kerja lapangan", "Field Work Practice (Internship)"],
  ["praktik kerja lapangan", "Field Work Practice (Internship)"],
  ["kkn", "Community Service Program"],
  ["kuliah kerja nyata", "Community Service Program"],
  ["magang", "Internship"],
  ["seminar proposal", "Research Proposal Seminar"],
  ["metode penelitian kualitatif", "Qualitative Research Methods"],
  ["metode penelitian kuantitatif", "Quantitative Research Methods"],
  ["metode penelitian sosial", "Social Research Methods"],
  ["metodologi penelitian", "Research Methodology"],
  ["metodelogi penelitian", "Research Methodology"],
  ["statistik sosial", "Social Statistics"],
  ["sistem hukum indonesia", "Indonesian Legal System"],
  ["sistem ekonomi indonesia", "Indonesian Economic System"],
  ["sistem sosial indonesia", "Indonesian Social System"],
  ["sistem politik indonesia", "Indonesian Political System"],
  ["azas azas managemen", "Principles of Management"],
  ["asas asas manajemen", "Principles of Management"],
  ["dasar dasar manajemen", "Principles of Management"],

  // AIKA
  ["aika i", "Al-Islam and Kemuhammadiyahan I"],
  ["aika ii", "Al-Islam and Kemuhammadiyahan II"],
  ["aika iii", "Al-Islam and Kemuhammadiyahan III"],
  ["aika iv", "Al-Islam and Kemuhammadiyahan IV"],
  ["aika v", "Al-Islam and Kemuhammadiyahan V"],
  ["al islam dan kemuhammadiyahan", "Al-Islam and Kemuhammadiyahan"],

  // Ilmu Pemerintahan
  ["sosiologi pemerintahan", "Sociology of Government"],
  ["etika pemerintahan", "Government Ethics"],
  ["ekologi pemerintahan", "Government Ecology"],
  ["birokrasi indonesia", "Indonesian Bureaucracy"],
  ["sistem pemerintahan desa", "Village Government System"],
  ["sistem pemerintahan indonesia", "Indonesian Government System"],
  ["sistem pemerintahan daerah dan otonomi daerah", "Regional Government System and Regional Autonomy"],
  ["otonomi daerah", "Regional Autonomy"],
  ["organisasi dan managemen pemerintahan", "Government Organization and Management"],
  ["organisasi dan manajemen pemerintahan", "Government Organization and Management"],
  ["managemen program pembangunan", "Development Program Management"],
  ["manajemen program pembangunan", "Development Program Management"],
  ["managemen layanan publik", "Public Service Management"],
  ["manajemen pelayanan publik", "Public Service Management"],
  ["managemen pengadaan barang dan jasa", "Procurement of Goods and Services Management"],
  ["managemen konflik dan studi kawasan", "Conflict Management and Area Studies"],
  ["manajemen konflik", "Conflict Management"],
  ["sistem kepartaian dan pemilu indonesia", "Indonesian Party System and General Elections"],
  ["politik hukum agraria", "Agrarian Legal Politics"],
  ["politik keuangan daerah", "Regional Financial Politics"],
  ["keuangan negara", "State Finance"],
  ["proses legislasi", "Legislative Process"],
  ["tata naskah dan kearsipan", "Document Administration and Archiving"],
  ["pemikiran politik islam", "Islamic Political Thought"],
  ["metodelogi ilmu pemerintahan", "Methodology of Government Science"],
  ["metodologi ilmu pemerintahan", "Methodology of Government Science"],
  ["analisa dan kebijakan publik", "Public Policy Analysis"],
  ["analisis kebijakan publik", "Public Policy Analysis"],
  ["kebijakan publik", "Public Policy"],
  ["teori dan filsafat politik", "Political Theory and Philosophy"],
  ["perbandingan sistem politik dan pemerintahan", "Comparative Political and Government Systems"],
  ["perbandingan pemerintahan", "Comparative Government"],
  ["kapita selekta pemerintahan", "Selected Topics in Government"],
  ["pemerintahan elektronik e-government", "Electronic Government (E-Government)"],
  ["e-government", "Electronic Government (E-Government)"],
  ["seminar pemerintahan", "Government Seminar"],
  ["hukum tata negara", "Constitutional Law"],
  ["hukum administrasi negara", "State Administrative Law"],
  ["administrasi pembangunan", "Development Administration"],
  ["perencanaan pembangunan", "Development Planning"],

  // Ilmu Komunikasi
  ["teori komunikasi", "Communication Theory"],
  ["komunikasi massa", "Mass Communication"],
  ["komunikasi organisasi", "Organizational Communication"],
  ["komunikasi antar pribadi", "Interpersonal Communication"],
  ["komunikasi antarpribadi", "Interpersonal Communication"],
  ["komunikasi antar budaya", "Intercultural Communication"],
  ["komunikasi antarbudaya", "Intercultural Communication"],
  ["komunikasi politik", "Political Communication"],
  ["komunikasi pemasaran", "Marketing Communication"],
  ["komunikasi bisnis", "Business Communication"],
  ["komunikasi pembangunan", "Development Communication"],
  ["psikologi komunikasi", "Communication Psychology"],
  ["sosiologi komunikasi", "Sociology of Communication"],
  ["filsafat komunikasi", "Communication Philosophy"],
  ["etika dan hukum komunikasi", "Communication Ethics and Law"],
  ["hukum dan etika pers", "Press Law and Ethics"],
  ["jurnalistik", "Journalism"],
  ["dasar dasar jurnalistik", "Fundamentals of Journalism"],
  ["fotografi", "Photography"],
  ["fotografi jurnalistik", "Photojournalism"],
  ["videografi", "Videography"],
  ["produksi siaran televisi", "Television Broadcast Production"],
  ["produksi siaran radio", "Radio Broadcast Production"],
  ["penyiaran", "Broadcasting"],
  ["public relations", "Public Relations"],
  ["hubungan masyarakat", "Public Relations"],
  ["periklanan", "Advertising"],
  ["manajemen media massa", "Mass Media Management"],
  ["media baru", "New Media"],
  ["literasi media", "Media Literacy"],
  ["opini publik", "Public Opinion"],
  ["retorika", "Rhetoric"],
  ["public speaking", "Public Speaking"],
  ["desain komunikasi visual", "Visual Communication Design"],
  ["perilaku konsumen", "Consumer Behavior"],
  ["manajemen periklanan", "Advertising Management"],
  ["strategi kreatif periklanan", "Creative Advertising Strategy"],
  ["riset komunikasi", "Communication Research"],
  ["teknologi informasi dan komunikasi", "Information and Communication Technology"],
];

export const KAMUS_NAMA: Record<string, string> = Object.fromEntries(
  NAMA_MENTAH.map(([id, en]) => [rapikanNama(id), en]),
);

// ---------- TEBAKAN KATA PER KATA ----------
//
// Diurutkan dari frasa terpanjang ke terpendek: "sistem pemerintahan" harus
// menang atas "sistem" dan "pemerintahan" yang berdiri sendiri.
const FRASA_MENTAH: Array<[string, string]> = [
  ["sistem pemerintahan", "Government System"],
  ["ilmu pemerintahan", "Government Science"],
  ["ilmu komunikasi", "Communication Science"],
  ["ilmu politik", "Political Science"],
  ["ilmu sosial", "Social Science"],
  ["metode penelitian", "Research Methods"],
  ["kebijakan publik", "Public Policy"],
  ["pelayanan publik", "Public Service"],
  ["layanan publik", "Public Service"],
  ["pengantar", "Introduction to"],
  ["dasar dasar", "Fundamentals of"],
  ["azas azas", "Principles of"],
  ["asas asas", "Principles of"],
  ["kapita selekta", "Selected Topics in"],
  ["perbandingan", "Comparative"],
  ["pemerintahan", "Government"],
  ["pemerintah", "Government"],
  ["komunikasi", "Communication"],
  ["managemen", "Management"],
  ["manajemen", "Management"],
  ["organisasi", "Organization"],
  ["pembangunan", "Development"],
  ["masyarakat", "Society"],
  ["kepemimpinan", "Leadership"],
  ["kewirausahaan", "Entrepreneurship"],
  ["penelitian", "Research"],
  ["kualitatif", "Qualitative"],
  ["kuantitatif", "Quantitative"],
  ["indonesia", "Indonesian"],
  ["kebijakan", "Policy"],
  ["keuangan", "Finance"],
  ["pengadaan", "Procurement"],
  ["kearsipan", "Archiving"],
  ["legislasi", "Legislation"],
  ["birokrasi", "Bureaucracy"],
  ["sosiologi", "Sociology"],
  ["psikologi", "Psychology"],
  ["antropologi", "Anthropology"],
  ["filsafat", "Philosophy"],
  ["statistik", "Statistics"],
  ["ekonomi", "Economics"],
  ["politik", "Politics"],
  ["hukum", "Law"],
  ["etika", "Ethics"],
  ["teori", "Theory"],
  ["sistem", "System"],
  ["daerah", "Regional"],
  ["negara", "State"],
  ["publik", "Public"],
  ["sosial", "Social"],
  ["budaya", "Cultural"],
  ["agraria", "Agrarian"],
  ["konflik", "Conflict"],
  ["kawasan", "Area"],
  ["seminar", "Seminar"],
  ["analisa", "Analysis"],
  ["analisis", "Analysis"],
  ["program", "Program"],
  ["proses", "Process"],
  ["ekologi", "Ecology"],
  ["desa", "Village"],
  ["islam", "Islamic"],
  ["media", "Media"],
  ["dan", "and"],
  ["studi", "Studies"],
  ["tata", "Administration of"],
  ["naskah", "Documents"],
  ["mutu", "Quality"],
  ["dasar", "Basic"],
  ["umum", "General"],
  ["lanjutan", "Advanced"],
];

const FRASA = FRASA_MENTAH.map(([id, en]) => [rapikanNama(id), en] as const).sort(
  (a, b) => b[0].length - a[0].length,
);

/** Terjemahan kasar kata per kata. Dipakai hanya bila dua lapis di atas gagal. */
function terjemahKasar(nama: string): string {
  const bersih = rapikanNama(nama);
  if (!bersih) return "";

  let sisa = bersih;
  const hasil: string[] = [];
  let aman = 0;
  while (sisa && aman < 40) {
    aman += 1;
    const cocok = FRASA.find(([id]) => sisa === id || sisa.startsWith(`${id} `));
    if (cocok) {
      hasil.push(cocok[1]);
      sisa = sisa.slice(cocok[0].length).trim();
      continue;
    }
    // Kata yang tidak ada di daftar dibiarkan apa adanya, berhuruf besar di
    // awal. Nama diri dan singkatan memang tidak diterjemahkan.
    const spasi = sisa.indexOf(" ");
    const kata = spasi < 0 ? sisa : sisa.slice(0, spasi);
    hasil.push(kata.charAt(0).toUpperCase() + kata.slice(1));
    sisa = spasi < 0 ? "" : sisa.slice(spasi + 1).trim();
  }
  return hasil.join(" ").replace(/\s+/g, " ").trim();

}

export type HasilTerjemah = {
  en: string;
  /** "kode" | "nama" | "kasar" | "kosong" — dari lapis mana hasilnya datang. */
  sumber: "kode" | "nama" | "kasar" | "kosong";
};

/**
 * Terjemahkan satu nama mata kuliah DI DALAM LINGKUPNYA.
 *
 * Urutannya, dari yang paling dapat dipertanggungjawabkan:
 *
 *   1. Koreksi admin untuk lingkup ini ("ilkom-bc::MKPB-051"). Koreksi
 *      manusia yang tahu prodinya selalu menang.
 *   2. Kamus bawaan lingkup ini — untuk Ilmu Komunikasi: konsentrasinya
 *      dulu, baru inti, baru dua konsentrasi lain.
 *   3. Koreksi admin TANPA lingkup. Bentuk lama, dari sebelum kamus ini
 *      dipecah: entri seperti itu bisa datang dari prodi mana pun, jadi ia
 *      tidak lagi boleh menimpa nama yang tertulis pada transkrip resmi —
 *      ia hanya mengisi kode yang kamus bawaan memang tidak punya.
 *   4. Kode yang berarti sama di semua prodi.
 *   5. Nama mata kuliah — lingkupnya dulu, lalu daftar lintas prodi.
 *   6. Kata per kata, DITANDAI sebagai tebakan.
 *
 * Prodi yang tidak dikenali menghasilkan rantai kosong. Itu bukan kegagalan:
 * lapis 4 dan 5 tetap bekerja, dan kode yang bertabrakan antar prodi memang
 * sengaja dilewati daripada ditebak.
 */
export function terjemahkanMatkul(
  kode: string,
  nama: string,
  tambahan: Record<string, string> = {},
  lingkup?: Lingkup,
): HasilTerjemah {
  const k = rapikanKode(kode);
  const rantai = rantaiLingkup(lingkup);

  if (k) {
    for (const l of rantai) {
      const koreksi = tambahan[kunciKamus(l, k)];
      if (koreksi) return { en: koreksi, sumber: "kode" };
    }
    for (const l of rantai) {
      const bawaan = KAMUS[l].kode[k];
      if (bawaan) return { en: bawaan, sumber: "kode" };
    }
    if (tambahan[k]) return { en: tambahan[k], sumber: "kode" };
    if (KODE_TAKSAMAR[k]) return { en: KODE_TAKSAMAR[k], sumber: "kode" };
  }

  const n = rapikanNama(nama);
  if (n) {
    for (const l of rantai) {
      const bawaan = KAMUS[l].nama[n];
      if (bawaan) return { en: bawaan, sumber: "nama" };
    }
    if (KAMUS_NAMA[n]) return { en: KAMUS_NAMA[n], sumber: "nama" };
  }

  const kasar = terjemahKasar(nama);
  if (kasar) return { en: kasar, sumber: "kasar" };
  return { en: "", sumber: "kosong" };
}

export type BarisMatkul = { kode: string; nama: string; en: string };

/** Satu koreksi yang layak diingat, berikut lingkup tempat ia berlaku. */
export type PasanganKamus = { kode: string; en: string; lingkup: string };

/**
 * Pasangan kode → nama Inggris yang layak diingat untuk unggahan berikutnya.
 *
 * Hanya yang BERBEDA dari kamus bawaan lingkup ini. Menyimpan ulang yang
 * sudah ada hanya menggelembungkan penyimpanan tanpa mengubah hasil apa pun.
 *
 * Lingkupnya ikut disimpan. Tanpa itu, koreksi "MKK-012 = Basic Cultural
 * Studies" yang benar untuk Ilmu Komunikasi akan ikut mengubah transkrip
 * Ilmu Pemerintahan, yang MKK-012-nya adalah Pengantar Sosiologi.
 */
export function panenKamus(rows: BarisMatkul[], lingkup?: Lingkup): PasanganKamus[] {
  const sasaran = lingkupUtama(lingkup);
  // Tanpa prodi yang jelas, koreksinya tidak punya tempat menetap: menyimpan
  // ke laci "entah prodi mana" persis melahirkan kembali kamus datar yang
  // membuat transkrip Ilmu Komunikasi tercetak dengan nama Ilmu Pemerintahan.
  if (!sasaran) return [];
  const hasil: PasanganKamus[] = [];
  const sudah = new Set<string>();
  for (const row of rows) {
    const kode = rapikanKode(row.kode);
    const en = String(row.en || "").trim();
    if (!kode || en.length < 3 || sudah.has(kode)) continue;
    if (terjemahkanMatkul(kode, "", {}, lingkup).en === en) continue;
    sudah.add(kode);
    hasil.push({ kode, en, lingkup: sasaran });
  }
  return hasil;
}

export type HasilIsiInggris<T> = {
  rows: T[];
  /** Berapa yang diisi dari kamus, dan berapa yang hanya tebakan kata. */
  dariKamus: number;
  dariKasar: number;
  /** Sudah berisi sejak awal — berkas dwibahasa dari KUI. */
  sudahAda: number;
  /** Nama mata kuliah yang hasilnya hanya tebakan, untuk ditengok admin. */
  perluDicek: string[];
};

/**
 * Isi kolom Inggris untuk seluruh baris.
 *
 * Yang SUDAH berisi tidak pernah ditimpa. Berkas dwibahasa dari KUI membawa
 * terjemahan resmi, dan terjemahan resmi selalu menang atas kamus mana pun.
 */
export function isiInggris<T extends BarisMatkul>(
  rows: T[],
  tambahan: Record<string, string> = {},
  lingkup?: Lingkup,
): HasilIsiInggris<T> {
  let dariKamus = 0;
  let dariKasar = 0;
  let sudahAda = 0;
  const perluDicek: string[] = [];

  const hasil = rows.map((row) => {
    if (row.en && row.en.trim()) {
      sudahAda += 1;
      return row;
    }
    const { en, sumber } = terjemahkanMatkul(row.kode, row.nama, tambahan, lingkup);
    if (!en) return row;
    if (sumber === "kasar") {
      dariKasar += 1;
      perluDicek.push(row.nama);
    } else {
      dariKamus += 1;
    }
    return { ...row, en };
  });

  return { rows: hasil, dariKamus, dariKasar, sudahAda, perluDicek };
}

/**
 * Isi ulang kolom Inggris, MENIMPA yang sudah ada.
 *
 * Dipanggil hanya kalau admin menekan tombolnya sendiri, sesudah membetulkan
 * prodi atau konsentrasi. Tanpa jalur ini, transkrip yang diimpor dengan
 * konsentrasi salah tetap mencetak nama Inggris konsentrasi yang salah itu
 * meskipun biodatanya sudah dibetulkan di layar.
 */
export function isiUlangInggris<T extends BarisMatkul>(
  rows: T[],
  tambahan: Record<string, string> = {},
  lingkup?: Lingkup,
): HasilIsiInggris<T> {
  return isiInggris(
    rows.map((row) => ({ ...row, en: "" })),
    tambahan,
    lingkup,
  );
}
