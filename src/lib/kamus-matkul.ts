// ============================================================
// KAMUS NAMA MATA KULIAH — Indonesia ke Inggris
//
// Transkrip berbahasa Inggris menuntut nama mata kuliah dalam bahasa Inggris.
// Berkas mentah dari SIMAK hanya memuat nama Indonesia, dan versi
// dwibahasanya harus diminta ke KUI setiap kali ada lulusan baru — yang
// artinya menunggu, dan menunggu untuk pekerjaan yang sama berulang-ulang.
//
// Berkas ini menerjemahkannya sendiri, dengan tiga lapis yang menurun
// ketepatannya:
//
//   1. KODE mata kuliah. Paling tepat: kode itu unik per kurikulum, jadi
//      "MKK-011" selalu berarti mata kuliah yang sama.
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

// ---------- LAPIS 1: KODE ----------
//
// Kurikulum Ilmu Pemerintahan dan Ilmu Komunikasi FISIP. Kode yang sama
// dipakai lintas angkatan, jadi daftar ini bertahan lebih lama daripada
// pencocokan nama.
export const KAMUS_KODE: Record<string, string> = {
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

// ---------- LAPIS 2: NAMA ----------
//
// Kunci berupa nama yang sudah diseragamkan. Menampung kode yang berganti
// antar kurikulum, dan mata kuliah Ilmu Komunikasi yang kodenya berbeda.
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
  ["sosiologi komunikasi", "Communication Sociology"],
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

// ---------- LAPIS 3: KATA ----------
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
 * Terjemahkan satu nama mata kuliah.
 *
 * Kode didahulukan atas nama karena kode itu unik per kurikulum, sedangkan
 * nama dapat ditulis berbeda-beda oleh operator yang berbeda ("Managemen"
 * dan "Manajemen" adalah mata kuliah yang sama).
 */
export function terjemahkanMatkul(
  kode: string,
  nama: string,
  tambahan: Record<string, string> = {},
): HasilTerjemah {
  const k = rapikanKode(kode);
  // Kamus tambahan DIDAHULUKAN: isinya koreksi tangan admin, dan koreksi
  // manusia selalu lebih benar daripada daftar bawaan yang ditulis di sini.
  if (k && tambahan[k]) return { en: tambahan[k], sumber: "kode" };
  if (k && KAMUS_KODE[k]) return { en: KAMUS_KODE[k], sumber: "kode" };

  const n = rapikanNama(nama);
  if (n && KAMUS_NAMA[n]) return { en: KAMUS_NAMA[n], sumber: "nama" };

  const kasar = terjemahKasar(nama);
  if (kasar) return { en: kasar, sumber: "kasar" };
  return { en: "", sumber: "kosong" };
}

export type BarisMatkul = { kode: string; nama: string; en: string };

/**
 * Pasangan kode → nama Inggris yang layak diingat untuk unggahan berikutnya.
 *
 * Hanya yang BERBEDA dari kamus bawaan. Menyimpan ulang yang sudah ada hanya
 * menggelembungkan penyimpanan tanpa mengubah hasil apa pun.
 */
export function panenKamus(rows: BarisMatkul[]): Array<{ kode: string; en: string }> {
  const hasil: Array<{ kode: string; en: string }> = [];
  const sudah = new Set<string>();
  for (const row of rows) {
    const kode = rapikanKode(row.kode);
    const en = String(row.en || "").trim();
    if (!kode || en.length < 3 || sudah.has(kode)) continue;
    if (KAMUS_KODE[kode] === en) continue;
    sudah.add(kode);
    hasil.push({ kode, en });
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
    const { en, sumber } = terjemahkanMatkul(row.kode, row.nama, tambahan);
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
