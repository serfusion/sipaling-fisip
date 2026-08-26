// ALIH BAHASA NASKAH INDONESIA KE INGGRIS ILMIAH.
//
// Berkas ini melengkapi bank frasa pada `frasa-akademik.ts`. Bank frasa hanya
// menunjukkan padanan sepotong-sepotong; yang di sini menyusun draf naskah
// Inggris utuh: judul bab dijadikan judul bagian bergaya jurnal, kalimatnya
// dialihbahasakan, dan kalanya disesuaikan dengan bagian tempat kalimat itu
// berada.
//
// Pedoman yang diikuti diambil dari tiga sumber yang sama-sama berlaku pada
// skripsi, karangan ilmiah, jurnal, literatur, maupun prosiding:
//
// 1. Susunan IMRaD dengan judul bagian bernomor Romawi kapital
//    (I. INTRODUCTION, II. METHODS, III. RESULT AND DISCUSSION,
//    IV. CONCLUSION AND RECOMMENDATION, REFERENCES), sebagaimana dipakai
//    prosiding IEEE dan sebagian besar jurnal ilmu sosial terindeks.
// 2. Kala baku tiap bagian: Introduction dan Discussion memakai present
//    tense, Methods dan Results memakai past tense (APA edisi 7, bab 4).
// 3. Rumusan baku Swales dan Feak: "This study examines…", bukan terjemahan
//    harfiah "This research have a purpose to analyze".
//
// Seluruhnya deterministik: tidak ada AI, tidak ada permintaan jaringan, dan
// naskah tidak pernah meninggalkan peramban. Konsekuensinya jujur disebut di
// antarmuka: hasilnya draf yang wajib disunting, bukan terjemahan siap kirim.

export type BagianEN =
  | "judul"
  | "abstrak"
  | "katakunci"
  | "pendahuluan"
  | "pustaka"
  | "metode"
  | "hasil"
  | "simpulan"
  | "daftar";

/** Kala baku tiap bagian menurut APA edisi 7 bab 4. */
const KALA: Record<BagianEN, "kini" | "lampau"> = {
  judul: "kini",
  abstrak: "kini",
  katakunci: "kini",
  pendahuluan: "kini",
  pustaka: "kini",
  metode: "lampau",
  hasil: "lampau",
  simpulan: "kini",
  daftar: "kini",
};

export const BAGIAN_EN_LABEL: Record<BagianEN, string> = {
  judul: "Judul",
  abstrak: "Abstract",
  katakunci: "Keywords",
  pendahuluan: "Introduction",
  pustaka: "Literature review",
  metode: "Methods",
  hasil: "Result and discussion",
  simpulan: "Conclusion",
  daftar: "References",
};

/** Judul bagian bergaya prosiding, bernomor Romawi kapital. */
const JUDUL_EN: Partial<Record<BagianEN, string>> = {
  pendahuluan: "INTRODUCTION",
  pustaka: "LITERATURE REVIEW",
  metode: "METHODS",
  hasil: "RESULT AND DISCUSSION",
  simpulan: "CONCLUSION AND RECOMMENDATION",
  daftar: "REFERENCES",
};

const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

// ---------------------------------------------------------------------------
// Pengenalan judul bab
// ---------------------------------------------------------------------------

type PolaJudul = { pola: RegExp; bagian: BagianEN };

const POLA_JUDUL: PolaJudul[] = [
  { pola: /^(?:bab\s+[ivx\d]+\s*[.:-]?\s*)?abstrak\b/i, bagian: "abstrak" },
  { pola: /^(?:kata[-\s]?kunci|katakunci)\b/i, bagian: "katakunci" },
  { pola: /^(?:bab\s+[ivx\d]+\s*[.:-]?\s*)?pendahuluan\b/i, bagian: "pendahuluan" },
  { pola: /^(?:bab\s+[ivx\d]+\s*[.:-]?\s*)?(?:tinjauan\s+pustaka|landasan\s+teori|kajian\s+(?:pustaka|teori|teoritis))\b/i, bagian: "pustaka" },
  { pola: /^(?:bab\s+[ivx\d]+\s*[.:-]?\s*)?(?:metode|metodologi)(?:\s+penelitian)?\b/i, bagian: "metode" },
  { pola: /^(?:bab\s+[ivx\d]+\s*[.:-]?\s*)?(?:hasil|temuan)(?:\s+(?:penelitian|dan)\b.*)?$/i, bagian: "hasil" },
  { pola: /^(?:bab\s+[ivx\d]+\s*[.:-]?\s*)?(?:pembahasan|analisis\s+data|deskripsi\s+(?:hasil|data))\b/i, bagian: "hasil" },
  { pola: /^(?:bab\s+[ivx\d]+\s*[.:-]?\s*)?(?:penutup|kesimpulan|simpulan|saran)\b/i, bagian: "simpulan" },
  { pola: /^(?:bab\s+[ivx\d]+\s*[.:-]?\s*)?(?:daftar\s+pustaka|referensi|bibliografi)\b/i, bagian: "daftar" },
];

/**
 * Judul sub-bab yang dikenali, dipakai sebagai sub-judul berhuruf (A, B, C…).
 *
 * Bagiannya ikut disimpan karena banyak naskah hanya memuat sub-bab tanpa
 * judul BAB. "Teknik Analisis Data" sudah cukup untuk menetapkan bahwa
 * paragraf sesudahnya bagian Methods, dan karenanya berkala lampau.
 */
const SUB_JUDUL: { pola: RegExp; en: string; bagian?: BagianEN }[] = [
  { pola: /latar\s+belakang/i, en: "Background", bagian: "pendahuluan" },
  { pola: /(?:rumusan|perumusan)\s+masalah/i, en: "Research Problem", bagian: "pendahuluan" },
  { pola: /tujuan\s+penelitian/i, en: "Research Objectives", bagian: "pendahuluan" },
  { pola: /manfaat\s+penelitian/i, en: "Significance of the Study", bagian: "pendahuluan" },
  { pola: /(?:batasan|ruang\s+lingkup)\s+(?:masalah|penelitian)/i, en: "Scope of the Study", bagian: "pendahuluan" },
  { pola: /(?:tinjauan\s+pustaka|kajian\s+pustaka)/i, en: "Literature Review", bagian: "pustaka" },
  { pola: /(?:landasan|kajian)\s+teor(?:i|itis)/i, en: "Theoretical Framework", bagian: "pustaka" },
  { pola: /penelitian\s+terdahulu/i, en: "Previous Studies", bagian: "pustaka" },
  { pola: /kerangka\s+(?:pemikiran|berpikir)/i, en: "Conceptual Framework", bagian: "pustaka" },
  { pola: /hipotesis/i, en: "Hypotheses", bagian: "pustaka" },
  { pola: /(?:jenis|desain|rancangan)\s+penelitian/i, en: "Research Design", bagian: "metode" },
  { pola: /(?:lokasi|tempat)\s+(?:dan\s+waktu\s+)?penelitian/i, en: "Research Setting", bagian: "metode" },
  { pola: /populasi\s+dan\s+sampel/i, en: "Population and Sample", bagian: "metode" },
  { pola: /teknik\s+pengumpulan\s+data/i, en: "Data Collection", bagian: "metode" },
  { pola: /teknik\s+analisis\s+data/i, en: "Data Analysis", bagian: "metode" },
  { pola: /(?:uji\s+)?keabsahan\s+data/i, en: "Data Validity", bagian: "metode" },
  { pola: /(?:hasil\s+penelitian|deskripsi\s+hasil)/i, en: "Findings", bagian: "hasil" },
  { pola: /pembahasan/i, en: "Discussion", bagian: "hasil" },
  { pola: /keterbatasan\s+penelitian/i, en: "Limitations", bagian: "hasil" },
  { pola: /(?:kesimpulan|simpulan)/i, en: "Conclusion", bagian: "simpulan" },
  { pola: /saran/i, en: "Recommendations", bagian: "simpulan" },
];

// ---------------------------------------------------------------------------
// Rumusan baku: kalimat yang muncul hampir di setiap skripsi
//
// Diterjemahkan sebagai satu kesatuan, bukan kata per kata, karena justru di
// rumusan baku inilah terjemahan harfiah paling sering terbaca janggal.
// `$1` diisi hasil alih bahasa dari bagian yang ditangkap polanya.
// ---------------------------------------------------------------------------

type Templat = { pola: RegExp; en: string };

const TEMPLAT: Templat[] = [
  // --- Tujuan penelitian ---
  { pola: /penelitian ini bertujuan untuk (?:menganalisa|menganalisis)/gi, en: "This study examines" },
  { pola: /penelitian ini bertujuan untuk (?:mengetahui|melihat|mengkaji)/gi, en: "This study investigates" },
  { pola: /penelitian ini bertujuan untuk mendeskripsikan/gi, en: "This study describes" },
  { pola: /penelitian ini bertujuan untuk menjelaskan/gi, en: "This study explains" },
  { pola: /penelitian ini bertujuan untuk menguji/gi, en: "This study tests" },
  { pola: /tujuan (?:dari )?penelitian ini adalah untuk/gi, en: "The aim of this study is to" },
  { pola: /tujuan (?:dari )?penelitian ini adalah/gi, en: "The aim of this study is" },
  { pola: /penelitian ini (?:berusaha|mencoba) untuk/gi, en: "This study attempts to" },
  { pola: /penelitian ini (?:membahas|mengulas)/gi, en: "This study discusses" },
  { pola: /penelitian ini (?:memfokuskan|berfokus) pada/gi, en: "This study focuses on" },
  { pola: /berdasarkan uraian (?:di ?atas|tersebut),?/gi, en: "Against this background," },
  { pola: /oleh karena itu,? penelitian ini/gi, en: "This study therefore" },

  // --- Rumusan masalah ---
  { pola: /rumusan masalah (?:dalam|pada) penelitian ini adalah/gi, en: "This study addresses the following question:" },
  { pola: /pertanyaan penelitian (?:ini )?adalah/gi, en: "The research question is" },
  { pola: /bagaimana pengaruh ([^?.,]+) terhadap ([^?.,]+)/gi, en: "how $1 affects $2" },
  { pola: /bagaimana hubungan antara ([^?.,]+) dan ([^?.,]+)/gi, en: "how $1 relates to $2" },
  { pola: /sejauh ?mana/gi, en: "to what extent" },
  { pola: /apakah terdapat pengaruh/gi, en: "whether there is an effect" },

  // --- Metode ---
  { pola: /penelitian ini menggunakan (?:metode |pendekatan )?(?:penelitian )?kualitatif deskriptif/gi, en: "This study used a descriptive qualitative approach" },
  { pola: /penelitian ini menggunakan (?:metode |pendekatan )?deskriptif kualitatif/gi, en: "This study used a descriptive qualitative approach" },
  { pola: /penelitian ini menggunakan (?:metode |pendekatan )?(?:penelitian )?kualitatif/gi, en: "This study used a qualitative approach" },
  { pola: /penelitian ini menggunakan (?:metode |pendekatan )?(?:penelitian )?kuantitatif/gi, en: "This study used a quantitative approach" },
  { pola: /(?:penelitian ini merupakan|jenis penelitian ini adalah) penelitian ([a-z ]+)/gi, en: "This study is $1 research" },
  { pola: /(?:metode|pendekatan) yang digunakan (?:dalam penelitian ini )?adalah/gi, en: "The approach adopted in this study was" },
  { pola: /penelitian (?:ini )?dilaksanakan di/gi, en: "The study was conducted at" },
  { pola: /penelitian (?:ini )?dilakukan (?:di|pada)/gi, en: "The study was carried out at" },
  { pola: /data (?:dalam penelitian ini )?dikumpulkan (?:melalui|dengan)/gi, en: "Data were collected through" },
  { pola: /(?:teknik )?pengumpulan data dilakukan (?:melalui|dengan)/gi, en: "Data were collected through" },
  { pola: /data (?:yang )?diperoleh (?:kemudian )?dianalisis (?:dengan|menggunakan)/gi, en: "The data were analysed using" },
  { pola: /analisis data (?:dilakukan )?(?:dengan|menggunakan)/gi, en: "The data were analysed using" },
  { pola: /populasi (?:dalam|pada) penelitian ini adalah/gi, en: "The population of this study comprised" },
  { pola: /sampel (?:dalam|pada) penelitian ini (?:adalah|berjumlah|sebanyak)/gi, en: "The sample comprised" },
  { pola: /teknik pengambilan sampel (?:yang digunakan )?(?:adalah|menggunakan)/gi, en: "The sampling technique used was" },
  { pola: /(?:jumlah )?responden (?:dalam penelitian ini )?(?:sebanyak|berjumlah)/gi, en: "A total of" },
  { pola: /informan (?:dalam|pada) penelitian ini (?:adalah|berjumlah|sebanyak)/gi, en: "The informants in this study were" },
  { pola: /wawancara (?:mendalam )?dilakukan (?:dengan|terhadap|kepada)/gi, en: "In-depth interviews were conducted with" },
  { pola: /(?:uji|pengujian) validitas dan reliabilitas/gi, en: "validity and reliability testing" },
  { pola: /keabsahan data (?:diuji )?(?:dengan|menggunakan) triangulasi/gi, en: "Data validity was established through triangulation" },
  { pola: /reduksi data,? penyajian data,? dan penarikan kesimpulan/gi, en: "data reduction, data display, and conclusion drawing" },

  { pola: /sehingga diperoleh/gi, en: "yielding" },
  { pola: /(?:dari hasil tersebut )?diketahui bahwa/gi, en: "it was found that" },
  { pola: /dengan rumus slovin/gi, en: "using the Slovin formula" },
  { pola: /uji validitas dan reliabilitas dilakukan/gi, en: "Validity and reliability tests were conducted" },
  // --- Hasil ---
  { pola: /hasil penelitian (?:ini )?menunjukkan bahwa/gi, en: "The results indicate that" },
  { pola: /hasil (?:analisis|pengujian) menunjukkan bahwa/gi, en: "The analysis revealed that" },
  { pola: /penelitian ini menemukan bahwa/gi, en: "This study found that" },
  { pola: /temuan (?:penelitian )?(?:ini )?menunjukkan bahwa/gi, en: "The findings show that" },
  { pola: /berdasarkan (?:hasil )?(?:tabel|gambar) (?:di ?atas|tersebut|berikut)/gi, en: "As shown in Table 1" },
  { pola: /(?:dapat )?dilihat (?:pada|dalam) (?:tabel|gambar) (?:di ?atas|berikut|tersebut)/gi, en: "as presented in Table 1" },
  { pola: /terdapat pengaruh (?:yang )?signifikan (?:antara )?/gi, en: "a significant effect was found for " },
  { pola: /terdapat hubungan (?:yang )?signifikan (?:antara )?/gi, en: "a significant association was found between " },
  { pola: /tidak terdapat pengaruh (?:yang )?signifikan/gi, en: "no significant effect was found" },
  { pola: /secara (?:simultan|bersama-sama) berpengaruh terhadap/gi, en: "jointly affected" },
  { pola: /secara parsial berpengaruh terhadap/gi, en: "individually affected" },
  { pola: /sebagian besar responden/gi, en: "most respondents" },
  { pola: /hal ini (?:berarti|bermakna) bahwa/gi, en: "This indicates that" },

  // --- Pembahasan ---
  { pola: /(?:hal ini )?sejalan dengan (?:hasil )?penelitian sebelumnya/gi, en: "This is consistent with previous studies" },
  { pola: /(?:hal ini )?sejalan dengan (?:hasil )?penelitian/gi, en: "This is consistent with the findings of" },
  { pola: /(?:hal ini )?sesuai dengan (?:teori|pendapat)/gi, en: "This accords with the argument of" },
  { pola: /(?:hal ini )?berbeda dengan (?:hasil )?(?:penelitian|temuan)/gi, en: "This contrasts with the findings of" },
  { pola: /menurut ([A-Z][a-z]+) \((\d{4})\)/g, en: "$1 ($2) argues that" },
  { pola: /keterbatasan (?:dalam )?penelitian ini/gi, en: "The limitations of this study" },
  { pola: /temuan ini (?:menegaskan|memperkuat)/gi, en: "These findings reinforce" },

  // --- Simpulan ---
  { pola: /berdasarkan (?:hasil )?(?:penelitian|pembahasan) (?:di ?atas|tersebut),?/gi, en: "Taken together," },
  { pola: /(?:dapat|maka dapat) disimpulkan bahwa/gi, en: "These results indicate that" },
  { pola: /penelitian ini menyimpulkan bahwa/gi, en: "This study concludes that" },
  { pola: /saran (?:untuk|bagi) penelitian selanjutnya/gi, en: "Future research should" },
  { pola: /penelitian selanjutnya (?:diharapkan|disarankan) (?:untuk|dapat)/gi, en: "Future research should" },
  { pola: /diharapkan (?:dapat )?(?:memberikan )?(?:manfaat|kontribusi)/gi, en: "is expected to contribute" },

  // --- Penghubung dan rumusan umum ---
  { pola: /^selain itu,?/gi, en: "In addition," },
  { pola: /^di samping itu,?/gi, en: "In addition," },
  { pola: /^oleh karena itu,?/gi, en: "Therefore," },
  { pola: /^namun demikian,?/gi, en: "Nevertheless," },
  { pola: /^dengan demikian,?/gi, en: "Accordingly," },
  { pola: /^dengan kata lain,?/gi, en: "In other words," },
  { pola: /^di sisi lain,?/gi, en: "By contrast," },
  { pola: /^pada akhirnya,?/gi, en: "Ultimately," },
  { pola: /^sementara itu,?/gi, en: "Meanwhile," },
  { pola: /^lebih lanjut,?/gi, en: "Furthermore," },
  { pola: /tidak dapat dipisahkan dari/gi, en: "is closely linked to" },
  { pola: /seperti (?:yang )?(?:kita ketahui|diketahui)/gi, en: "" },
  { pola: /di era (?:modern|globalisasi|digital) (?:ini|saat ini)/gi, en: "in recent years" },
  { pola: /dewasa ini|saat ini/gi, en: "in recent years" },
  { pola: /memiliki (?:pengaruh|dampak) terhadap/gi, en: "has an effect on" },
  { pola: /berpengaruh (?:secara )?(?:positif|signifikan) terhadap/gi, en: "positively affects" },
  { pola: /berperan penting dalam/gi, en: "plays a central role in" },
  { pola: /salah satu faktor yang mempengaruhi/gi, en: "one factor that shapes" },
  { pola: /semakin ([a-z]+) semakin ([a-z]+)/gi, en: "the more $1, the more $2" },
];

// ---------------------------------------------------------------------------
// Kamus kata dan frasa
//
// Kelas kata ikut disimpan karena dua hal yang paling sering merusak
// terjemahan harfiah bergantung padanya: urutan kata sifat (bahasa Indonesia
// menempatkan sifat di belakang benda, Inggris di depan) dan pembentukan kala
// pada kata kerja.
// ---------------------------------------------------------------------------

type Kelas = "n" | "v" | "adj" | "adv" | "prep" | "conj" | "pron" | "num" | "det";

type Entri = {
  en: string;
  kelas: Kelas;
  /** Bentuk lampau bila tidak beraturan. */
  lampau?: string;
  /** Benda jamak: menentukan bentuk kata kerja yang mengikutinya. */
  jamak?: boolean;
};

function n(en: string, jamak = false): Entri { return { en, kelas: "n", jamak }; }
function v(en: string, lampau?: string): Entri { return { en, kelas: "v", lampau }; }
function adj(en: string): Entri { return { en, kelas: "adj" }; }
function adv(en: string): Entri { return { en, kelas: "adv" }; }
function prep(en: string): Entri { return { en, kelas: "prep" }; }
function conj(en: string): Entri { return { en, kelas: "conj" }; }
function pron(en: string): Entri { return { en, kelas: "pron" }; }
function det(en: string): Entri { return { en, kelas: "det" }; }

/**
 * Frasa banyak kata, dicocokkan lebih dulu daripada kata tunggal.
 *
 * Sebagian besar isinya gabungan benda-benda yang urutannya terbalik dalam
 * bahasa Inggris ("media sosial" menjadi "social media"), dan istilah
 * metodologi yang punya padanan baku di jurnal.
 */
const FRASA_KAMUS: Record<string, Entri> = {
  "media sosial": n("social media"),
  "partisipasi politik": n("political participation"),
  "informan kunci": n("key informants", true),
  "wawancara terstruktur": n("structured interview"),
  "motivasi kerja": n("work motivation"),
  "kinerja karyawan": n("employee performance"),
  "kepuasan kerja": n("job satisfaction"),
  "lingkungan kerja": n("work environment"),
  "beban kerja": n("workload"),
  "disiplin kerja": n("work discipline"),
  "budaya organisasi": n("organisational culture"),
  "nilai signifikansi": n("significance value"),
  "analisis regresi linier berganda": n("multiple linear regression analysis"),
  "analisis regresi linear berganda": n("multiple linear regression analysis"),
  "penelitian sebelumnya": n("previous studies", true),
  "lebih kecil dari": adj("smaller than"),
  "lebih besar dari": adj("greater than"),
  "lebih tinggi dari": adj("higher than"),
  "lebih rendah dari": adj("lower than"),
  "rumus slovin": n("Slovin formula"),
  "purposive sampling": n("purposive sampling"),
  "snowball sampling": n("snowball sampling"),
  "random sampling": n("random sampling"),
  "simple random sampling": n("simple random sampling"),
  "accidental sampling": n("accidental sampling"),
  "total sampling": n("total sampling"),
  "pemilih pemula": n("first-time voters", true),
  "kemampuan menyaring": n("ability to filter"),
  "opini masyarakat": n("public opinion"),
  "pilihan politik": n("political choice"),
  "sesuai dengan pedoman": prep("in accordance with the guidelines of"),
  "jejaring sosial": n("social networks", true),
  "jaringan sosial": n("social networks", true),
  "komunikasi massa": n("mass communication"),
  "komunikasi politik": n("political communication"),
  "komunikasi organisasi": n("organisational communication"),
  "komunikasi antarpribadi": n("interpersonal communication"),
  "opini publik": n("public opinion"),
  "ruang publik": n("public sphere"),
  "kebijakan publik": n("public policy"),
  "pelayanan publik": n("public service"),
  "administrasi publik": n("public administration"),
  "pemerintah daerah": n("local government"),
  "pemerintah pusat": n("central government"),
  "otonomi daerah": n("regional autonomy"),
  "partisipasi masyarakat": n("community participation"),
  "masyarakat sipil": n("civil society"),
  "sumber daya manusia": n("human resources", true),
  "citra diri": n("self-image"),
  "citra politik": n("political image"),
  "pencitraan politik": n("political branding"),
  "kampanye politik": n("political campaign"),
  "perilaku pemilih": n("voter behaviour"),
  "pemilihan umum": n("general election"),
  "pemilihan kepala daerah": n("regional election"),
  "partai politik": n("political party"),
  "aktor politik": n("political actors", true),
  "elite politik": n("political elites", true),
  "literasi digital": n("digital literacy"),
  "literasi media": n("media literacy"),
  "media massa": n("mass media"),
  "media daring": n("online media"),
  "berita bohong": n("disinformation"),
  "hasil penelitian": n("research findings", true),
  "temuan penelitian": n("research findings", true),
  "objek penelitian": n("research object"),
  "subjek penelitian": n("research subject"),
  "lokasi penelitian": n("research site"),
  "fokus penelitian": n("research focus"),
  "desain penelitian": n("research design"),
  "rancangan penelitian": n("research design"),
  "jenis penelitian": n("research type"),
  "metode penelitian": n("research method"),
  "metode kualitatif": n("qualitative method"),
  "metode kuantitatif": n("quantitative method"),
  "pendekatan kualitatif": n("qualitative approach"),
  "pendekatan kuantitatif": n("quantitative approach"),
  "studi kasus": n("case study"),
  "studi literatur": n("literature review"),
  "studi pustaka": n("literature review"),
  "tinjauan pustaka": n("literature review"),
  "kajian pustaka": n("literature review"),
  "landasan teori": n("theoretical framework"),
  "kerangka teori": n("theoretical framework"),
  "kerangka pemikiran": n("conceptual framework"),
  "kerangka berpikir": n("conceptual framework"),
  "penelitian terdahulu": n("previous studies", true),
  "analisis isi": n("content analysis"),
  "analisis wacana": n("discourse analysis"),
  "analisis jaringan sosial": n("social network analysis"),
  "analisis data": n("data analysis"),
  "analisis regresi": n("regression analysis"),
  "regresi linier berganda": n("multiple linear regression"),
  "regresi linear berganda": n("multiple linear regression"),
  "uji validitas": n("validity test"),
  "uji reliabilitas": n("reliability test"),
  "uji normalitas": n("normality test"),
  "uji hipotesis": n("hypothesis testing"),
  "uji t": n("t-test"),
  "teknik pengumpulan data": n("data collection technique"),
  "teknik analisis data": n("data analysis technique"),
  "teknik pengambilan sampel": n("sampling technique"),
  "pengumpulan data": n("data collection"),
  "sumber data": n("data sources", true),
  "data primer": n("primary data", true),
  "data sekunder": n("secondary data", true),
  "wawancara mendalam": n("in-depth interview"),
  "observasi partisipan": n("participant observation"),
  "studi dokumentasi": n("documentary study"),
  "reduksi data": n("data reduction"),
  "penyajian data": n("data display"),
  "penarikan kesimpulan": n("conclusion drawing"),
  "keabsahan data": n("data validity"),
  "variabel bebas": n("independent variable"),
  "variabel terikat": n("dependent variable"),
  "variabel independen": n("independent variable"),
  "variabel dependen": n("dependent variable"),
  "variabel mediasi": n("mediating variable"),
  "variabel moderasi": n("moderating variable"),
  "populasi dan sampel": n("population and sample"),
  "daftar pustaka": n("references", true),
  "kata kunci": n("keywords", true),
  "latar belakang": n("background"),
  "rumusan masalah": n("research problem"),
  "tujuan penelitian": n("research objective"),
  "manfaat penelitian": n("significance of the study"),
  "batasan masalah": n("scope of the study"),
  "ruang lingkup": n("scope"),
  "kehidupan sehari-hari": n("everyday life"),
  "ilmu komunikasi": n("communication science"),
  "ilmu pemerintahan": n("government science"),
  "ilmu sosial": n("social science"),
  "perguruan tinggi": n("higher education institution"),
  "kelompok masyarakat": n("community groups", true),
  "tanggung jawab": n("responsibility"),
  "pengambilan keputusan": n("decision making"),
  "sumber informasi": n("source of information"),
  "teknologi informasi": n("information technology"),
  "era digital": n("digital era"),
  "jumlah penduduk": n("population size"),
  "sebagian besar": det("most"),
  "sebagian kecil": det("a small proportion of"),
  "cukup besar": adj("considerable"),
  "sangat penting": adj("critical"),
  "sangat berpengaruh": adj("highly influential"),
  "lebih lanjut": adv("further"),
  "secara umum": adv("in general"),
  "secara khusus": adv("specifically"),
  "secara signifikan": adv("significantly"),
  "secara langsung": adv("directly"),
  "secara tidak langsung": adv("indirectly"),
  "secara keseluruhan": adv("overall"),
  "pada umumnya": adv("generally"),
  "antara lain": adv("among others"),
  "misalnya": adv("for example"),
  "sebagai contoh": adv("for example"),
  "sehingga": conj("so that"),
  "sedangkan": conj("whereas"),
  "meskipun demikian": conj("nevertheless"),
  "walaupun demikian": conj("nevertheless"),
  "akan tetapi": conj("however"),
  "oleh sebab itu": conj("therefore"),
  "karena itu": conj("therefore"),
  "sebaliknya": adv("conversely"),
  "terlebih dahulu": adv("first"),
  "pada dasarnya": adv("in principle"),
  "pada saat": prep("when"),
  "pada waktu": prep("when"),
  "berdasarkan hal tersebut": adv("on this basis"),
  "hal ini": pron("this"),
  "hal tersebut": pron("this"),
  "penelitian ini": n("this study"),
  "artikel ini": n("this article"),
  "tulisan ini": n("this article"),
  "penulis": n("the author"),
  "para ahli": n("scholars", true),
  "para peneliti": n("researchers", true),
  "tidak hanya": adv("not only"),
  "tetapi juga": conj("but also"),
  "di mana": pron("in which"),
  "yang mana": pron("which"),
  "sebagai berikut": adv("as follows"),
  "sesuai dengan": prep("in accordance with"),
  "berkaitan dengan": prep("related to"),
  "berhubungan dengan": prep("associated with"),
  "terkait dengan": prep("related to"),
  "berdasarkan pada": prep("based on"),
  "menurut pendapat": prep("according to"),
  "dalam rangka": prep("in order to"),
  "dengan cara": prep("by"),
  "melalui proses": prep("through the process of"),
};

/** Kata tunggal. Kata kerja disimpan dalam bentuk dasar Inggris. */
const KAMUS: Record<string, Entri> = {
  // --- Bentukan berimbuhan yang paling sering muncul ---
  kemampuan: n("ability"),
  kemauan: n("willingness"),
  keinginan: n("desire"),
  kebutuhan: n("need"),
  kepentingan: n("interest"),
  keberhasilan: n("success"),
  kegagalan: n("failure"),
  ketersediaan: n("availability"),
  keterlibatan: n("involvement"),
  keterbatasan: n("limitation"),
  keberadaan: n("presence"),
  kesadaran: n("awareness"),
  kemandirian: n("autonomy"),
  keadilan: n("justice"),
  kesetaraan: n("equality"),
  keamanan: n("security"),
  kesejahteraan: n("welfare"),
  keterbukaan: n("openness"),
  kejelasan: n("clarity"),
  kesiapan: n("readiness"),
  pembentukan: n("formation"),
  penggunaan: n("use"),
  pemanfaatan: n("utilisation"),
  penerimaan: n("acceptance"),
  penyebaran: n("dissemination"),
  penyampaian: n("delivery"),
  penyusunan: n("preparation"),
  penilaian: n("assessment"),
  pengukuran: n("measurement"),
  pengamatan: n("observation"),
  pengujian: n("testing"),
  pengaruhnya: n("its effect"),
  pemberitaan: n("news coverage"),
  pemberian: n("provision"),
  pemilihan: n("selection"),
  penentuan: n("determination"),
  penetapan: n("establishment"),
  pengembangan: n("development"),
  penyaringan: n("filtering"),
  pengolahan: n("processing"),
  perencanaan: n("planning"),
  pelaporan: n("reporting"),
  perhatian: n("attention"),
  pengetahuan: n("knowledge"),
  pemahaman: n("understanding"),
  pandangan: n("view"),
  pendapat: n("opinion"),
  pernyataan: n("statement"),
  pertanyaan: n("question"),
  jawaban: n("answer"),
  tanggapan: n("response"),
  ungkapan: n("expression"),
  tindakan: n("action"),
  gerakan: n("movement"),
  dukungan: n("support"),
  tekanan: n("pressure"),
  ancaman: n("threat"),
  harapan: n("expectation"),
  tuntutan: n("demand"),
  kewajiban: n("obligation"),
  aturan: n("rule"),
  ketentuan: n("provision"),
  pilihan: n("choice"),
  pemula: adj("first-time"),
  keluarga: n("family"),
  remaja: n("adolescent"),
  anak: n("child"),
  orang: n("person"),
  pihak: n("party"),
  pengikut: n("followers", true),
  khalayak: n("audience"),
  audiens: n("audience"),
  citranya: n("its image"),

  // --- Kata kerja tambahan ---
  menyaring: v("filters", "filtered"),
  memilah: v("sorts", "sorted"),
  memperluas: v("broadens", "broadened"),
  memperkuat: v("reinforces", "reinforced"),
  mempertimbangkan: v("considers", "considered"),
  mempersiapkan: v("prepares", "prepared"),
  memperhatikan: v("attends to", "attended to"),
  mengacu: v("refers", "referred"),
  merujuk: v("refers", "referred"),
  menilai: v("assesses", "assessed"),
  mengkritik: v("criticises", "criticised"),
  membaca: v("reads", "read"),
  menulis: v("writes", "wrote"),
  mencari: v("seeks", "sought"),
  menyusun: v("compiles", "compiled"),
  merancang: v("designs", "designed"),
  mengikuti: v("follows", "followed"),
  menyebarkan: v("disseminates", "disseminated"),
  membagikan: v("shares", "shared"),
  mengakses: v("accesses", "accessed"),
  memantau: v("monitors", "monitored"),
  mengalami: v("experiences", "experienced"),
  merasakan: v("perceives", "perceived"),
  menganggap: v("regards", "regarded"),
  meyakini: v("believes", "believed"),
  bertujuan: v("aims", "aimed"),
  berupaya: v("seeks", "sought"),
  bergantung: v("depends", "depended"),
  bertambah: v("increases", "increased"),
  berkurang: v("decreases", "decreased"),
  berjalan: v("proceeds", "proceeded"),
  bersifat: v("is", "was"),
  tergantung: v("depends", "depended"),
  terlibat: v("is involved", "was involved"),
  terbatas: adj("limited"),
  tersedia: adj("available"),
  terbuka: adj("open"),
  tertutup: adj("closed"),

  kompensasi: n("compensation"),
  partisipasi: n("participation"),
  kunci: n("key"),
  keterwakilan: n("representation"),
  kerja: n("work"),
  pekerjaan: n("job"),
  aset: n("asset"),
  rumus: n("formula"),
  signifikansi: n("significance"),
  laba: n("profit"),
  biaya: n("cost"),
  harga: n("price"),
  produk: n("product"),
  layanan: n("service"),
  jabatan: n("position"),
  gaji: n("salary"),
  upah: n("wage"),
  linier: adj("linear"),
  linear: adj("linear"),
  berganda: adj("multiple"),
  lain: adj("other"),
  lainnya: adj("other"),
  sebelum: prep("before"),
  setelah: prep("after"),
  sesudah: prep("after"),
  sebesar: prep("of"),
  terkait: prep("regarding"),
  menambah: v("adds", "added"),
  menambahkan: v("adds", "added"),
  dituntut: v("is required", "was required"),
  diwajibkan: v("is required", "was required"),
  ditetapkan: v("is established", "was established"),
  disebarkan: v("is distributed", "was distributed"),
  disebarluaskan: v("is disseminated", "was disseminated"),
  diterima: v("is accepted", "was accepted"),
  ditolak: v("is rejected", "was rejected"),
  diukur: v("is measured", "was measured"),
  dihitung: v("is calculated", "was calculated"),
  diolah: v("is processed", "was processed"),
  disajikan: v("is presented", "was presented"),
  ditunjukkan: v("is shown", "was shown"),

  // --- Kata benda: penelitian dan akademik ---
  penelitian: n("study"),
  riset: n("research"),
  studi: n("study"),
  skripsi: n("undergraduate thesis"),
  tesis: n("thesis"),
  disertasi: n("dissertation"),
  jurnal: n("journal"),
  artikel: n("article"),
  makalah: n("paper"),
  prosiding: n("proceedings", true),
  literatur: n("literature"),
  pustaka: n("literature"),
  referensi: n("reference"),
  rujukan: n("reference"),
  sumber: n("source"),
  teori: n("theory"),
  konsep: n("concept"),
  definisi: n("definition"),
  hipotesis: n("hypothesis"),
  variabel: n("variable"),
  indikator: n("indicator"),
  dimensi: n("dimension"),
  instrumen: n("instrument"),
  kuesioner: n("questionnaire"),
  angket: n("questionnaire"),
  wawancara: n("interview"),
  observasi: n("observation"),
  dokumentasi: n("documentation"),
  responden: n("respondents", true),
  informan: n("informants", true),
  narasumber: n("informants", true),
  partisipan: n("participants", true),
  populasi: n("population"),
  sampel: n("sample"),
  data: n("data", true),
  temuan: n("finding"),
  hasil: n("result"),
  simpulan: n("conclusion"),
  kesimpulan: n("conclusion"),
  saran: n("recommendation"),
  pembahasan: n("discussion"),
  pendahuluan: n("introduction"),
  metode: n("method"),
  metodologi: n("methodology"),
  pendekatan: n("approach"),
  paradigma: n("paradigm"),
  analisis: n("analysis"),
  kajian: n("review"),
  tinjauan: n("review"),
  gambaran: n("overview"),
  uraian: n("explanation"),
  penjelasan: n("explanation"),
  keterangan: n("information"),
  bukti: n("evidence"),
  argumen: n("argument"),
  tabel: n("Table"),
  gambar: n("Figure"),
  grafik: n("chart"),
  bagan: n("diagram"),
  lampiran: n("appendix"),
  catatan: n("note"),
  bab: n("chapter"),
  halaman: n("page"),
  penulis: n("author"),
  peneliti: n("researcher"),
  ahli: n("expert"),
  akademisi: n("academic"),
  dosen: n("lecturer"),
  mahasiswa: n("students", true),
  pembimbing: n("supervisor"),
  universitas: n("university"),
  fakultas: n("faculty"),
  kampus: n("campus"),
  jurusan: n("department"),
  prodi: n("study programme"),

  // --- Kata benda: ilmu sosial dan politik ---
  masyarakat: n("society"),
  komunitas: n("community"),
  publik: n("public"),
  warga: n("citizens", true),
  penduduk: n("population"),
  individu: n("individual"),
  kelompok: n("group"),
  organisasi: n("organisation"),
  lembaga: n("institution"),
  institusi: n("institution"),
  instansi: n("agency"),
  pemerintah: n("government"),
  negara: n("state"),
  daerah: n("region"),
  wilayah: n("area"),
  kota: n("city"),
  desa: n("village"),
  kecamatan: n("subdistrict"),
  kelurahan: n("urban village"),
  provinsi: n("province"),
  kabupaten: n("regency"),
  pejabat: n("official"),
  aparatur: n("civil apparatus"),
  birokrasi: n("bureaucracy"),
  kebijakan: n("policy"),
  peraturan: n("regulation"),
  program: n("programme"),
  kegiatan: n("activity"),
  pelaksanaan: n("implementation"),
  penerapan: n("implementation"),
  pengelolaan: n("management"),
  pelayanan: n("service"),
  pembangunan: n("development"),
  pemberdayaan: n("empowerment"),
  pengawasan: n("supervision"),
  koordinasi: n("coordination"),
  demokrasi: n("democracy"),
  politik: n("politics"),
  kekuasaan: n("power"),
  kepemimpinan: n("leadership"),
  pemimpin: n("leader"),
  partai: n("party"),
  pemilih: n("voters", true),
  kandidat: n("candidate"),
  kampanye: n("campaign"),
  konflik: n("conflict"),
  isu: n("issue"),
  wacana: n("discourse"),
  opini: n("opinion"),
  persepsi: n("perception"),
  sikap: n("attitude"),
  perilaku: n("behaviour"),
  budaya: n("culture"),
  nilai: n("value"),
  norma: n("norm"),
  identitas: n("identity"),
  citra: n("image"),
  reputasi: n("reputation"),
  kepercayaan: n("trust"),
  motivasi: n("motivation"),
  kepuasan: n("satisfaction"),
  kinerja: n("performance"),
  produktivitas: n("productivity"),
  karyawan: n("employees", true),
  pegawai: n("employees", true),
  pimpinan: n("management"),
  perusahaan: n("company"),
  konsumen: n("consumer"),
  pelanggan: n("customer"),
  pasar: n("market"),
  ekonomi: n("economy"),
  pendidikan: n("education"),
  sekolah: n("school"),
  guru: n("teacher"),
  kesehatan: n("health"),
  lingkungan: n("environment"),
  teknologi: n("technology"),
  informasi: n("information"),
  komunikasi: n("communication"),
  pesan: n("message"),
  media: n("media", true),
  berita: n("news"),
  jaringan: n("network"),
  hubungan: n("relationship"),
  interaksi: n("interaction"),
  proses: n("process"),
  sistem: n("system"),
  struktur: n("structure"),
  strategi: n("strategy"),
  taktik: n("tactic"),
  upaya: n("effort"),
  langkah: n("step"),
  tahap: n("stage"),
  tahapan: n("stage"),
  bentuk: n("form"),
  jenis: n("type"),
  faktor: n("factor"),
  aspek: n("aspect"),
  unsur: n("element"),
  bagian: n("part"),
  peran: n("role"),
  fungsi: n("function"),
  tujuan: n("objective"),
  sasaran: n("target"),
  manfaat: n("benefit"),
  dampak: n("impact"),
  pengaruh: n("effect"),
  akibat: n("consequence"),
  penyebab: n("cause"),
  masalah: n("problem"),
  permasalahan: n("problem"),
  kendala: n("obstacle"),
  hambatan: n("barrier"),
  tantangan: n("challenge"),
  peluang: n("opportunity"),
  solusi: n("solution"),
  keputusan: n("decision"),
  perubahan: n("change"),
  perkembangan: n("development"),
  pertumbuhan: n("growth"),
  peningkatan: n("increase"),
  penurunan: n("decrease"),
  perbedaan: n("difference"),
  persamaan: n("similarity"),
  keadaan: n("condition"),
  kondisi: n("condition"),
  situasi: n("situation"),
  fenomena: n("phenomenon"),
  kasus: n("case"),
  peristiwa: n("event"),
  kejadian: n("event"),
  waktu: n("time"),
  tahun: n("year"),
  bulan: n("month"),
  hari: n("day"),
  jumlah: n("number"),
  angka: n("figure"),
  persen: n("per cent"),
  persentase: n("percentage"),
  rata: n("average"),
  tingkat: n("level"),
  ukuran: n("measure"),
  kualitas: n("quality"),
  kuantitas: n("quantity"),
  akses: n("access"),
  konten: n("content"),
  pengguna: n("users", true),
  akun: n("account"),
  unggahan: n("post"),
  komentar: n("comment"),
  platform: n("platform"),
  aplikasi: n("application"),
  internet: n("internet"),
  daring: adj("online"),
  luring: adj("offline"),

  // --- Kata kerja ---
  adalah: v("is"),
  ialah: v("is"),
  merupakan: v("constitutes"),
  menjadi: v("becomes", "became"),
  memiliki: v("has", "had"),
  mempunyai: v("has", "had"),
  terdapat: v("there is"),
  ada: v("exists"),
  menggunakan: v("uses", "used"),
  memakai: v("uses", "used"),
  memanfaatkan: v("utilises", "utilised"),
  menerapkan: v("applies", "applied"),
  melaksanakan: v("implements", "implemented"),
  melakukan: v("conducts", "conducted"),
  meneliti: v("examines", "examined"),
  mengkaji: v("examines", "examined"),
  menganalisis: v("analyses", "analysed"),
  menganalisa: v("analyses", "analysed"),
  mengukur: v("measures", "measured"),
  menguji: v("tests", "tested"),
  membandingkan: v("compares", "compared"),
  mengamati: v("observes", "observed"),
  mewawancarai: v("interviews", "interviewed"),
  mengumpulkan: v("collects", "collected"),
  memperoleh: v("obtains", "obtained"),
  mendapatkan: v("obtains", "obtained"),
  menemukan: v("finds", "found"),
  menunjukkan: v("shows", "showed"),
  memperlihatkan: v("shows", "showed"),
  menggambarkan: v("describes", "described"),
  mendeskripsikan: v("describes", "described"),
  menjelaskan: v("explains", "explained"),
  menguraikan: v("outlines", "outlined"),
  menyatakan: v("states", "stated"),
  mengatakan: v("states", "stated"),
  mengemukakan: v("argues", "argued"),
  berpendapat: v("argues", "argued"),
  menyimpulkan: v("concludes", "concluded"),
  menyarankan: v("recommends", "recommended"),
  menganjurkan: v("recommends", "recommended"),
  menyebutkan: v("mentions", "mentioned"),
  mengungkapkan: v("reveals", "revealed"),
  membahas: v("discusses", "discussed"),
  membuktikan: v("demonstrates", "demonstrated"),
  mempengaruhi: v("affects", "affected"),
  memengaruhi: v("affects", "affected"),
  berpengaruh: v("affects", "affected"),
  meningkatkan: v("increases", "increased"),
  menurunkan: v("reduces", "reduced"),
  mendorong: v("encourages", "encouraged"),
  menyebabkan: v("causes", "caused"),
  menghasilkan: v("produces", "produced"),
  membentuk: v("shapes", "shaped"),
  membangun: v("builds", "built"),
  mengembangkan: v("develops", "developed"),
  menciptakan: v("creates", "created"),
  memberikan: v("provides", "provided"),
  memberi: v("provides", "provided"),
  menyampaikan: v("conveys", "conveyed"),
  menerima: v("receives", "received"),
  membutuhkan: v("requires", "required"),
  memerlukan: v("requires", "required"),
  mendukung: v("supports", "supported"),
  menolak: v("rejects", "rejected"),
  memilih: v("selects", "selected"),
  menentukan: v("determines", "determined"),
  menetapkan: v("establishes", "established"),
  mengelola: v("manages", "managed"),
  mengatur: v("regulates", "regulated"),
  mengawasi: v("supervises", "supervised"),
  melibatkan: v("involves", "involved"),
  meliputi: v("includes", "included"),
  mencakup: v("covers", "covered"),
  terdiri: v("consists", "consisted"),
  berjumlah: v("totals", "totalled"),
  berbeda: v("differs", "differed"),
  berkaitan: v("relates", "related"),
  berhubungan: v("relates", "related"),
  bekerja: v("works", "worked"),
  berperan: v("plays a role", "played a role"),
  berlangsung: v("takes place", "took place"),
  terjadi: v("occurs", "occurred"),
  muncul: v("emerges", "emerged"),
  berkembang: v("develops", "developed"),
  meningkat: v("increases", "increased"),
  menurun: v("declines", "declined"),
  dianggap: v("is considered", "was considered"),
  dinilai: v("is judged", "was judged"),
  dilakukan: v("is conducted", "was conducted"),
  dilaksanakan: v("is implemented", "was implemented"),
  digunakan: v("is used", "was used"),
  dikumpulkan: v("is collected", "was collected"),
  diperoleh: v("is obtained", "was obtained"),
  ditemukan: v("is found", "was found"),
  dianalisis: v("is analysed", "was analysed"),
  diuji: v("is tested", "was tested"),
  diketahui: v("is known", "was known"),
  dijelaskan: v("is explained", "was explained"),
  disebut: v("is called", "was called"),
  dipilih: v("is selected", "was selected"),
  diharapkan: v("is expected", "was expected"),
  disimpulkan: v("is concluded", "was concluded"),
  dapat: v("can"),
  bisa: v("can"),
  harus: v("must"),
  perlu: v("needs to"),
  akan: v("will"),
  telah: v("has"),
  sudah: v("has"),
  sedang: v("is currently"),
  belum: v("has not yet"),
  tidak: adv("not"),
  bukan: adv("not"),

  // --- Kata sifat ---
  penting: adj("important"),
  utama: adj("main"),
  besar: adj("large"),
  kecil: adj("small"),
  tinggi: adj("high"),
  rendah: adj("low"),
  baik: adj("good"),
  buruk: adj("poor"),
  baru: adj("new"),
  lama: adj("long-standing"),
  modern: adj("modern"),
  umum: adj("general"),
  khusus: adj("specific"),
  luas: adj("broad"),
  sempit: adj("narrow"),
  kuat: adj("strong"),
  lemah: adj("weak"),
  positif: adj("positive"),
  negatif: adj("negative"),
  signifikan: adj("significant"),
  efektif: adj("effective"),
  efisien: adj("efficient"),
  optimal: adj("optimal"),
  relevan: adj("relevant"),
  valid: adj("valid"),
  reliabel: adj("reliable"),
  akurat: adj("accurate"),
  konsisten: adj("consistent"),
  kompleks: adj("complex"),
  sederhana: adj("simple"),
  jelas: adj("clear"),
  sulit: adj("difficult"),
  mudah: adj("straightforward"),
  cepat: adj("rapid"),
  lambat: adj("slow"),
  banyak: det("many"),
  sedikit: adj("few"),
  seluruh: det("all"),
  setiap: det("each"),
  beberapa: det("several"),
  berbagai: det("various"),
  semua: det("all"),
  kualitatif: adj("qualitative"),
  kuantitatif: adj("quantitative"),
  deskriptif: adj("descriptive"),
  eksploratif: adj("exploratory"),
  eksperimen: adj("experimental"),
  empiris: adj("empirical"),
  teoritis: adj("theoretical"),
  konseptual: adj("conceptual"),
  praktis: adj("practical"),
  sosial: adj("social"),
  ekonomis: adj("economic"),
  digital: adj("digital"),
  nasional: adj("national"),
  lokal: adj("local"),
  global: adj("global"),
  internasional: adj("international"),
  resmi: adj("official"),
  formal: adj("formal"),
  informal: adj("informal"),
  independen: adj("independent"),
  dependen: adj("dependent"),
  bersama: adj("joint"),

  // --- Kata keterangan ---
  sangat: adv("highly"),
  cukup: adv("fairly"),
  lebih: adv("more"),
  paling: adv("most"),
  kurang: adv("less"),
  hanya: adv("only"),
  juga: adv("also"),
  masih: adv("still"),
  selalu: adv("always"),
  sering: adv("frequently"),
  jarang: adv("rarely"),
  kadang: adv("occasionally"),
  segera: adv("immediately"),
  kemudian: adv("subsequently"),
  selanjutnya: adv("subsequently"),
  akhirnya: adv("finally"),
  sebelumnya: adv("previously"),
  bahkan: adv("indeed"),
  memang: adv("indeed"),
  tentu: adv("certainly"),
  mungkin: adv("possibly"),
  terutama: adv("particularly"),
  khususnya: adv("particularly"),
  umumnya: adv("generally"),
  langsung: adv("directly"),
  bersamaan: adv("simultaneously"),
  secara: adv(""),

  // --- Kata depan, penghubung, ganti ---
  di: prep("in"),
  ke: prep("to"),
  dari: prep("from"),
  pada: prep("in"),
  dalam: prep("in"),
  untuk: prep("for"),
  dengan: prep("with"),
  oleh: prep("by"),
  tentang: prep("about"),
  mengenai: prep("regarding"),
  terhadap: prep("on"),
  antara: prep("between"),
  melalui: prep("through"),
  selama: prep("during"),
  sejak: prep("since"),
  hingga: prep("until"),
  sampai: prep("until"),
  atas: prep("of"),
  bagi: prep("for"),
  seperti: prep("such as"),
  berupa: prep("in the form of"),
  menurut: prep("according to"),
  berdasarkan: prep("based on"),
  termasuk: prep("including"),
  tanpa: prep("without"),
  dan: conj("and"),
  atau: conj("or"),
  serta: conj("and"),
  tetapi: conj("but"),
  namun: conj("however"),
  karena: conj("because"),
  sebab: conj("because"),
  jika: conj("if"),
  kalau: conj("if"),
  bila: conj("when"),
  ketika: conj("when"),
  saat: conj("when"),
  agar: conj("so that"),
  supaya: conj("so that"),
  bahwa: conj("that"),
  yang: pron("that"),
  meskipun: conj("although"),
  walaupun: conj("although"),
  maka: conj("thus"),
  ini: det("this"),
  itu: det("that"),
  tersebut: det("this"),
  mereka: pron("they"),
  ia: pron("it"),
  dia: pron("it"),
  kami: pron("we"),
  kita: pron("we"),
  saya: pron("I"),
  siapa: pron("who"),
  apa: pron("what"),
  bagaimana: pron("how"),
  mengapa: pron("why"),
  kapan: pron("when"),
  dimana: pron("where"),
  satu: { en: "one", kelas: "num" },
  dua: { en: "two", kelas: "num" },
  tiga: { en: "three", kelas: "num" },
  empat: { en: "four", kelas: "num" },
  lima: { en: "five", kelas: "num" },
  enam: { en: "six", kelas: "num" },
  tujuh: { en: "seven", kelas: "num" },
  delapan: { en: "eight", kelas: "num" },
  sembilan: { en: "nine", kelas: "num" },
  sepuluh: { en: "ten", kelas: "num" },
  puluh: { en: "ten", kelas: "num" },
  ratus: { en: "hundred", kelas: "num" },
  ribu: { en: "thousand", kelas: "num" },
  juta: { en: "million", kelas: "num" },
  pertama: { en: "first", kelas: "num" },
  kedua: { en: "second", kelas: "num" },
  ketiga: { en: "third", kelas: "num" },
};

// ---------------------------------------------------------------------------
// Morfologi sederhana
//
// Bahasa Indonesia membentuk kata dengan imbuhan, sehingga kamus tidak mungkin
// memuat semua bentuknya. Bagian ini mengupas imbuhan yang paling lazim lalu
// mencari kata dasarnya. Bila tetap tidak ketemu, katanya ditandai belum
// dikenal — bukan ditebak.
// ---------------------------------------------------------------------------

type Temu = { entri: Entri; pasif?: boolean; milik?: boolean; jamak?: boolean };

/** Bentuk jamak Inggris yang paling lazim. */
function jamakkan(kata: string): string {
  if (/(?:s|x|z|ch|sh)$/i.test(kata)) return `${kata}es`;
  if (/[^aeiou]y$/i.test(kata)) return `${kata.slice(0, -1)}ies`;
  if (/is$/i.test(kata)) return `${kata.slice(0, -2)}es`;
  return `${kata}s`;
}

/** Bentuk lampau beraturan, dengan penyesuaian ejaan yang lazim. */
function lampaukan(kata: string): string {
  if (/e$/i.test(kata)) return `${kata}d`;
  if (/[^aeiou]y$/i.test(kata)) return `${kata.slice(0, -1)}ied`;
  return `${kata}ed`;
}

/** Bentuk orang ketiga tunggal. */
function tunggalkan(kata: string): string {
  if (/(?:s|x|z|ch|sh|o)$/i.test(kata)) return `${kata}es`;
  if (/[^aeiou]y$/i.test(kata)) return `${kata.slice(0, -1)}ies`;
  return `${kata}s`;
}

const AWALAN_ME: { awal: RegExp; ganti: string[] }[] = [
  { awal: /^meng/, ganti: ["", "k"] },
  { awal: /^meny/, ganti: ["s"] },
  { awal: /^mem/, ganti: ["", "p"] },
  { awal: /^men/, ganti: ["", "t"] },
  { awal: /^mel/, ganti: ["l"] },
  { awal: /^mer/, ganti: ["r"] },
  { awal: /^me/, ganti: [""] },
];

function ambil(kata: string): Entri | null {
  return KAMUS[kata] ?? FRASA_KAMUS[kata] ?? null;
}

/** Cari padanan satu kata, termasuk bila berimbuhan. */
function cariKata(kata: string): Temu | null {
  const k = kata.toLowerCase();

  const langsung = ambil(k);
  if (langsung) return { entri: langsung };

  // Perulangan: "kata-kata", "orang-orang".
  const ulang = k.match(/^([a-z]+)-\1(?:nya)?$/);
  if (ulang) {
    const dasar = ambil(ulang[1]);
    if (dasar) return { entri: dasar, jamak: true };
  }

  // Akhiran kepemilikan dan partikel.
  for (const [akhir, tanda] of [["nya", "milik"], ["lah", ""], ["kah", ""], ["pun", ""]] as const) {
    if (k.endsWith(akhir) && k.length > akhir.length + 2) {
      const dasar = cariKata(k.slice(0, -akhir.length));
      if (dasar) return { ...dasar, milik: tanda === "milik" ? true : dasar.milik };
    }
  }

  // Awalan pasif "di-".
  if (k.startsWith("di") && k.length > 4) {
    const sisa = k.slice(2).replace(/(?:kan|i)$/, "");
    const dasar = ambil(sisa) ?? ambil(k.slice(2));
    if (dasar && dasar.kelas === "v") return { entri: dasar, pasif: true };
    if (dasar) return { entri: { en: dasar.en, kelas: "v" }, pasif: true };
  }

  // Awalan aktif "me-" beserta peluluhannya.
  for (const { awal, ganti } of AWALAN_ME) {
    if (!awal.test(k)) continue;
    const sisa = k.replace(awal, "");
    for (const huruf of ganti) {
      for (const potong of ["", "kan", "i"]) {
        const calon = huruf + (potong ? sisa.replace(new RegExp(`${potong}$`), "") : sisa);
        const dasar = ambil(calon);
        if (dasar) return { entri: { en: dasar.en, kelas: "v" } };
      }
    }
  }

  // Awalan "ber-", "ter-", "se-".
  for (const awal of ["ber", "ter", "se"]) {
    if (!k.startsWith(awal) || k.length <= awal.length + 2) continue;
    const dasar = ambil(k.slice(awal.length));
    if (!dasar) continue;
    if (awal === "ber") return { entri: { en: dasar.en, kelas: dasar.kelas === "n" ? "v" : dasar.kelas } };
    if (awal === "ter") return { entri: dasar.kelas === "adj" ? { en: `most ${dasar.en}`, kelas: "adj" } : { en: dasar.en, kelas: "v" }, pasif: dasar.kelas !== "adj" };
    return { entri: dasar };
  }

  // Akhiran "-kan" dan "-i" pada kata dasar yang dikenali.
  const tanpaAkhiran = k.replace(/(?:kan|i)$/, "");
  if (tanpaAkhiran !== k && tanpaAkhiran.length > 3) {
    const dasar = ambil(tanpaAkhiran);
    if (dasar) return { entri: { en: dasar.en, kelas: "v" } };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Alih bahasa satu kalimat
// ---------------------------------------------------------------------------

/** Penanda titipan: potongan yang sudah berbahasa Inggris tidak diolah lagi. */
const TANDA = "\u0001";

type Butir = {
  teks: string;
  kelas: Kelas | "tanda" | "utuh";
  jamak?: boolean;
  belum?: boolean;
  /** Sudah berbentuk final: jangan diubah kala atau jumlahnya lagi. */
  beku?: boolean;
  /** Nama diri: tidak diterjemahkan dan tidak diberi kata sandang. */
  diri?: boolean;
};

/** Kata sifat menjadi keterangan: "secara efektif" menjadi "effectively". */
function keKeterangan(sifat: string): string {
  if (/le$/i.test(sifat)) return `${sifat.slice(0, -1)}y`;
  if (/[^aeiou]y$/i.test(sifat)) return `${sifat.slice(0, -1)}ily`;
  if (/ic$/i.test(sifat)) return `${sifat}ally`;
  return `${sifat}ly`;
}

/**
 * Kelas kata terakhir sebuah potongan Inggris yang sudah jadi.
 *
 * Dipakai agar rumusan baku yang sudah diterjemahkan utuh tetap dapat
 * dibaca pas berikutnya: "This study examines" berakhir kata kerja, sehingga
 * benda sesudahnya berhak memperoleh kata sandang.
 */
function kelasEkor(teks: string): Kelas | "utuh" {
  const ekor = teks.trim().replace(/[.,;:]$/, "").split(/\s+/).pop()?.toLowerCase() ?? "";
  if (/^(?:in|on|of|for|to|with|through|from|at|by|into|between)$/.test(ekor)) return "prep";
  if (/^(?:that|which|and|or|but|because)$/.test(ekor)) return "conj";
  if (/^(?:this|these|those|the|a|an)$/.test(ekor)) return "det";
  if (/^(?:study|research|article|results|findings|analysis|sample|population|data)$/.test(ekor)) return "n";
  return "utuh";
}

/**
 * Pemisah angka: bahasa Indonesia memakai koma untuk desimal dan titik untuk
 * ribuan, bahasa Inggris sebaliknya. "0,05" yang dibiarkan apa adanya terbaca
 * sebagai nol koma nol lima ribu oleh peninjau berbahasa Inggris.
 */
function angkaInggris(angka: string): string {
  const bersih = angka.replace(/\s+/g, "");
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?%?$/.test(bersih)) {
    return bersih.replace(/\./g, "\u0000").replace(/,/g, ".").replace(/\u0000/g, ",");
  }
  if (/^\d+,\d+%?$/.test(bersih)) return bersih.replace(",", ".");
  return bersih;
}

export type HasilKalimat = { hasil: string; belum: string[] };

/**
 * Alihbahasakan satu kalimat.
 *
 * Urutannya sengaja: rumusan baku lebih dulu sebagai satu kesatuan, baru
 * sisanya kata per kata. Rumusan bakulah yang paling sering rusak bila
 * diterjemahkan kata per kata.
 */
export function terjemahKalimat(kalimat: string, kala: "kini" | "lampau" = "kini"): HasilKalimat {
  const belum: string[] = [];
  const simpan: string[] = [];
  const titip = (teks: string) => {
    simpan.push(teks);
    return `${TANDA}${simpan.length - 1}${TANDA}`;
  };

  let teks = kalimat.trim();
  const penutup = teks.match(/[.!?]+$/)?.[0] ?? "";
  if (penutup) teks = teks.slice(0, -penutup.length);

  // Sitasi, rujukan bernomor, dan angka dibiarkan apa adanya.
  teks = teks.replace(/\([^)]*\d{4}[^)]*\)/g, (m) => titip(m));
  teks = teks.replace(/\[\d+(?:\s*[,–-]\s*\d+)*\]/g, (m) => titip(m));
  teks = teks.replace(/\d+(?:[.,]\d+)*\s*%|\d+(?:[.,]\d+)+/g, (m) => titip(angkaInggris(m)));

  // Rumusan baku.
  for (const t of TEMPLAT) {
    t.pola.lastIndex = 0;
    teks = teks.replace(t.pola, (...arg) => {
      const tangkap = arg.slice(1, -2).filter((a) => typeof a === "string") as string[];
      const isi = t.en.replace(/\$(\d)/g, (_, i: string) => {
        const bagian = tangkap[Number(i) - 1] ?? "";
        if (!bagian.trim()) return "";
        if (/^\d+$/.test(bagian)) return bagian;
        const dalam = terjemahKalimat(bagian, kala);
        belum.push(...dalam.belum);
        return dalam.hasil.replace(/\.$/, "").replace(/^(.)/, (c) => c.toLowerCase());
      });
      return isi ? titip(isi) : "";
    });
  }

  // Pemenggalan menjadi kata dan tanda baca.
  const polaPotong = new RegExp(
    `${TANDA}\\d+${TANDA}|[A-Za-zÀ-ÿ]+(?:-[A-Za-zÀ-ÿ]+)*|\\d+(?:[.,]\\d+)*|[^\\s\\w]`, "g",
  );
  const potongan = teks.match(polaPotong) ?? [];

  const butir: Butir[] = [];
  for (let i = 0; i < potongan.length; i += 1) {
    const kata = potongan[i];

    const titipan = kata.match(new RegExp(`^${TANDA}(\\d+)${TANDA}$`));
    if (titipan) {
      const isi = simpan[Number(titipan[1])] ?? "";
      butir.push({ teks: isi, kelas: kelasEkor(isi), beku: true, diri: true });
      continue;
    }
    if (/^[^\wÀ-ÿ]$/.test(kata)) { butir.push({ teks: kata, kelas: "tanda" }); continue; }
    if (/^\d/.test(kata)) { butir.push({ teks: kata, kelas: "num" }); continue; }

    // Frasa banyak kata dicoba lebih dulu, dari yang terpanjang.
    let ketemu = false;
    for (let lebar = Math.min(5, potongan.length - i); lebar >= 2; lebar -= 1) {
      const irisan = potongan.slice(i, i + lebar);
      if (irisan.some((x) => !/^[A-Za-zÀ-ÿ-]+$/.test(x))) continue;
      const kunci = irisan.join(" ").toLowerCase();
      const entri = FRASA_KAMUS[kunci] ?? KAMUS[kunci];
      if (!entri) continue;
      butir.push({ teks: entri.en, kelas: entri.kelas, jamak: entri.jamak });
      i += lebar - 1;
      ketemu = true;
      break;
    }
    if (ketemu) continue;

    // Nama diri berangkai ("Universitas Muhammadiyah Tangerang", "Kota
    // Tangerang") adalah nama, bukan istilah: dipertahankan apa adanya.
    if (i > 0 && /^[A-Z]/.test(kata) && /^[A-Z]/.test(potongan[i + 1] ?? "")) {
      butir.push({ teks: kata, kelas: "n", diri: true, beku: true });
      continue;
    }

    // "secara" dengan kata sifat menjadi satu kata keterangan.
    if (kata.toLowerCase() === "secara" && potongan[i + 1]) {
      const sifat = cariKata(potongan[i + 1]);
      if (sifat && sifat.entri.kelas === "adj") {
        butir.push({ teks: keKeterangan(sifat.entri.en), kelas: "adv" });
        i += 1;
        continue;
      }
    }

    const temu = cariKata(kata);
    if (!temu) {
      // Nama diri dibiarkan apa adanya; kata biasa ditandai supaya penulisnya
      // tahu persis mana yang masih harus dikerjakan sendiri.
      const nama = /^[A-Z]/.test(kata);
      if (!nama) belum.push(kata.toLowerCase());
      butir.push({ teks: nama ? kata : `«${kata}»`, kelas: "n", belum: !nama, diri: true, beku: true });
      continue;
    }

    let hasil = temu.entri.en;
    if (temu.jamak && temu.entri.kelas === "n") hasil = jamakkan(hasil);
    if (temu.pasif) hasil = `${kala === "lampau" ? "was" : "is"} ${temu.entri.lampau ?? lampaukan(temu.entri.en)}`;
    if (temu.milik) hasil = `its ${hasil}`;
    butir.push({
      teks: hasil,
      kelas: temu.pasif ? "v" : temu.entri.kelas,
      jamak: temu.jamak || temu.entri.jamak,
    });
  }

  susunUlang(butir);
  rapikanTataBahasa(butir);
  terapkanKala(butir, kala);

  let keluar = "";
  for (const b of butir) {
    if (b.teks === "") continue;
    if (b.kelas === "tanda" && /^[,.;:!?)\]]$/.test(b.teks)) keluar += b.teks;
    else if (keluar === "" || /[([]$/.test(keluar)) keluar += b.teks;
    else keluar += ` ${b.teks}`;
  }

  keluar = keluar.replace(/\s+/g, " ").replace(/^[,;:\s]+/, "").trim();
  keluar = keluar.replace(new RegExp(`${TANDA}(\\d+)${TANDA}`, "g"), (_, i: string) => simpan[Number(i)] ?? "");
  keluar = keluar.replace(/\s+([,.;:])/g, "$1");
  // Kata bantu tidak berpasangan dengan kata "to be": "should is" tidak ada.
  keluar = keluar.replace(/\b(should|can|must|will|may|might)\s+(?:is|are|was|were)\b/gi, "$1");
  // Rumusan baku yang jatuh di tengah kalimat tidak berhuruf besar.
  keluar = keluar.replace(
    /([,;])\s+(This|These|Those|The|It|There|A|An|Future|Taken)\b/g,
    (_, tanda: string, kata: string) => `${tanda} ${kata.toLowerCase()}`,
  );
  keluar = keluar.charAt(0).toUpperCase() + keluar.slice(1);
  if (keluar && !/[.!?]$/.test(keluar)) keluar += penutup || ".";

  return { hasil: keluar, belum };
}

/**
 * Kata benda tak terbilang: tidak pernah didahului "the" oleh alat ini, karena
 * "the information" hampir selalu keliru pada kalimat umum.
 */
const TAK_TERBILANG = new Set([
  "information", "data", "research", "evidence", "literature", "media", "politics",
  "communication", "education", "knowledge", "technology", "society", "power",
  "culture", "news", "money", "time", "work", "behaviour", "democracy", "health",
  "social media", "mass media", "public opinion", "digital literacy", "media literacy",
  "compensation", "motivation", "work motivation", "performance", "employee performance",
  "satisfaction", "job satisfaction", "participation", "leadership", "quality",
  "awareness", "literacy", "trust", "support", "access", "content", "growth",
  "development", "management", "supervision", "coordination", "implementation",
  "understanding", "attention", "pressure", "welfare", "security", "equality",
  "justice", "productivity", "economy", "politics", "bureaucracy", "discipline",
  "training", "experience", "feedback", "engagement", "interaction", "governance",
]);

/** Bentuk jamak yang tidak beraturan. */
const JAMAK_KHUSUS: Record<string, string> = {
  person: "people", child: "children", man: "men", woman: "women",
  analysis: "analyses", hypothesis: "hypotheses", phenomenon: "phenomena",
  criterion: "criteria", datum: "data", medium: "media",
};

/** Kata ganti orang setelah benda dalam bahasa Indonesia bermakna milik. */
const MILIK: Record<string, string> = {
  they: "their", it: "its", we: "our", I: "my", he: "his", she: "her",
};

/**
 * Urutan kata: bahasa Indonesia menempatkan sifat di belakang benda, bahasa
 * Inggris di depan. "media baru", bukan "media new".
 */
function susunUlang(butir: Butir[]) {
  for (let i = 0; i < butir.length - 1; i += 1) {
    // "faktor yang penting" menjadi "important factor".
    if (butir[i].kelas === "n" && butir[i + 1]?.teks === "that" && butir[i + 2]?.kelas === "adj") {
      butir.splice(i + 1, 1);
    }
    if (butir[i].kelas === "n" && butir[i + 1]?.kelas === "adj") {
      const calon = butir[i + 1];
      // Sifat berbanding ("smaller than") tidak pernah pindah ke depan benda,
      // dan frasa bersubjek ("this study") menuntut "to be", bukan pembalikan.
      if (/\b(?:than|to|with|for|of)$/.test(calon.teks)) continue;
      if (/^(?:this|these|those|the|its|their|our|my|his|her)\b/i.test(butir[i].teks)) continue;
      const sifat = butir.splice(i + 1, 1)[0];
      // Penguatnya ikut pindah: "peran yang sangat penting".
      const adaPenguat = butir[i - 1]?.kelas === "adv";
      butir.splice(adaPenguat ? i - 1 : i, 0, sifat);
      i += 1;
    }
  }
}

/**
 * Kala mengikuti bagian naskah: Methods dan Results memakai kala lampau,
 * Introduction dan Discussion memakai kala kini (APA edisi 7, bab 4).
 */
function terapkanKala(butir: Butir[], kala: "kini" | "lampau") {
  sisipkanToBe(butir, kala);
  const iKerja = butir.findIndex((b) => b.kelas === "v" && !b.beku);
  if (iKerja < 0) return;
  const kerja = butir[iKerja];

  // Kata kerja setelah kata bantu tetap berbentuk dasar: "should broaden",
  // bukan "should broadens".
  const sebelumnya = butir.slice(0, iKerja).map((b) => b.teks).join(" ");
  if (/\b(?:should|can|could|must|will|would|may|might|to)\s*$/i.test(sebelumnya)) {
    // "should is" tidak ada dalam bahasa Inggris: kata "to be"-nya dibuang,
    // kata kerja biasa cukup dikembalikan ke bentuk dasar.
    kerja.teks = /^(?:is|are|was|were|has|have|had|does|did)$/.test(kerja.teks)
      ? ""
      : kerja.teks.replace(/^(\w+)s$/, "$1");
    return;
  }

  if (/^(?:is|are|was|were|has|have|had|can|must|will|there)\b/.test(kerja.teks)) {
    if (kala === "lampau") {
      kerja.teks = kerja.teks
        .replace(/^there is\b/, "there was")
        .replace(/^is\b/, "was").replace(/^are\b/, "were")
        .replace(/^has\b/, "had").replace(/^have\b/, "had");
    }
    return;
  }

  const subjekJamak = butir.slice(0, iKerja).some((b) => b.kelas === "n" && b.jamak);
  const dasar = kerja.teks.replace(/^(\w+)s$/, "$1");

  if (kala === "lampau") {
    const kamus = Object.values(KAMUS).find((e) => e.kelas === "v" && e.en === kerja.teks);
    kerja.teks = kamus?.lampau ?? lampaukan(dasar);
  } else {
    kerja.teks = subjekJamak ? dasar : tunggalkan(dasar);
  }

  selaraskanSisanya(butir, iKerja);
}

/**
 * "Nilai signifikansi lebih kecil dari 0,05" tidak memuat kata kerja sama
 * sekali. Bahasa Indonesia membolehkannya, bahasa Inggris menuntut "to be".
 */
function sisipkanToBe(butir: Butir[], kala: "kini" | "lampau") {
  const iSifat = butir.findIndex((b, i) => b.kelas === "adj" && i > 0
    && ["n", "num", "utuh"].includes(butir[i - 1].kelas));
  if (iSifat < 0) return;

  // Cukup ditengok anak kalimatnya sendiri: yang di depan "that" atau koma
  // sudah punya kata kerjanya sendiri.
  let mulai = 0;
  for (let i = iSifat - 1; i >= 0; i -= 1) {
    if (/\b(?:that|which)$/.test(butir[i].teks) || butir[i].teks === ",") { mulai = i + 1; break; }
  }
  if (butir.slice(mulai, iSifat).some((b) => b.kelas === "v")) return;

  const sebelum = butir[iSifat - 1];
  const jamak = sebelum.kelas === "n" && sebelum.jamak;
  const toBe = kala === "lampau" ? (jamak ? "were" : "was") : (jamak ? "are" : "is");
  butir.splice(iSifat, 0, { teks: toBe, kelas: "v", beku: true });
}

/**
 * Kata kerja pada anak kalimat tidak ikut berubah kalanya, tetapi tetap harus
 * selaras jumlahnya: "social networks affect", bukan "social networks affects".
 */
function selaraskanSisanya(butir: Butir[], mulai: number) {
  for (let i = mulai + 1; i < butir.length; i += 1) {
    const b = butir[i];
    if (b.kelas !== "v" || b.beku) continue;
    if (!/^\w+s$/.test(b.teks)) continue;
    let j = i - 1;
    while (j >= 0 && butir[j].kelas !== "n") j -= 1;
    if (j >= 0 && butir[j].jamak) b.teks = b.teks.replace(/^(\w+)s$/, "$1");
  }
}

// ---------------------------------------------------------------------------
// Alih bahasa satu naskah
//
// Naskah dibaca baris per baris. Judul bab dikenali lalu diganti judul bagian
// bergaya jurnal beserta nomor Romawinya, sub-bab menjadi sub-judul berhuruf,
// dan sisanya dialihbahasakan kalimat per kalimat dengan kala yang mengikuti
// bagian tempatnya berada.
// ---------------------------------------------------------------------------

export type JenisBaris = "judul-bagian" | "sub-judul" | "paragraf";

export type BarisAlih = {
  jenis: JenisBaris;
  bagian: BagianEN;
  sumber: string;
  hasil: string;
  belum: string[];
};

export type CatatanGaya = { judul: string; pesan: string };

export type HasilAlih = {
  baris: BarisAlih[];
  /** Draf naskah Inggris yang sudah tersusun, siap disalin dan disunting. */
  teks: string;
  jumlahKata: number;
  jumlahDikenali: number;
  /** Persentase kata yang punya padanan di kamus. */
  cakupan: number;
  belum: { kata: string; jumlah: number }[];
  catatan: CatatanGaya[];
  bagianAda: BagianEN[];
};

/** Buang penomoran bab dan sub-bab dari judul: "1.2", "BAB III", "A.". */
function tanpaNomor(baris: string): string {
  return baris
    .replace(/^\s*bab\s+[ivxlc\d]+\s*[.:-]?\s*/i, "")
    .replace(/^\s*\d+(?:\.\d+)*\s*[.):-]?\s*/, "")
    .replace(/^\s*[a-z]\s*[.)]\s*/i, "")
    .trim();
}

/** Apakah baris ini judul bab, dan bagian mana yang diwakilinya? */
function kenaliJudul(baris: string): BagianEN | null {
  // "1.1 Latar Belakang" adalah sub-bab, bukan judul bab.
  if (/^\s*(?:\d+\.\d+|[A-Za-z][.)])\s+/.test(baris)) return null;
  const bersih = tanpaNomor(baris);
  if (!bersih || bersih.length > 90) return null;
  // Judul tidak diakhiri titik dan tidak memuat banyak kalimat.
  if (/[.!?]$/.test(bersih.replace(/\.$/, ""))) return null;
  for (const p of POLA_JUDUL) if (p.pola.test(bersih)) return p.bagian;
  return null;
}

/** Apakah baris ini judul sub-bab? Dikembalikan padanan Inggris dan bagiannya. */
function kenaliSubJudul(baris: string): { en: string; bagian?: BagianEN } | null {
  const bersih = tanpaNomor(baris);
  if (!bersih || bersih.length > 80 || /[.!?]$/.test(bersih)) return null;
  const berNomor = /^\s*(?:\d+(?:\.\d+)+|[A-Z][.)])\s+/.test(baris);
  for (const s of SUB_JUDUL) if (s.pola.test(bersih)) return { en: s.en, bagian: s.bagian };
  if (!berNomor) return null;
  // Sub-bab bernomor yang tidak dikenali tetap dialihbahasakan seadanya.
  const alih = terjemahKalimat(bersih, "kini").hasil.replace(/\.$/, "");
  return { en: alih.replace(/\b([a-z])/g, (c) => c.toUpperCase()) };
}

/** Kata kunci dialihbahasakan satu per satu, bukan sebagai satu kalimat. */
function alihKataKunci(baris: string, kala: "kini" | "lampau"): HasilKalimat {
  const belum: string[] = [];
  const isi = baris
    .split(/[,;]/)
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => {
      const alih = terjemahKalimat(k, kala);
      belum.push(...alih.belum);
      return alih.hasil.replace(/\.$/, "").replace(/^(.)/, (c) => c.toLowerCase());
    });
  return { hasil: isi.join(", "), belum };
}

/** Penggal paragraf menjadi kalimat, tanpa memotong "Dr." atau angka desimal. */
export function bagiKalimat(paragraf: string): string[] {
  return paragraf
    .replace(/([.!?])\s+(?=[A-Z“"(])/g, "$1\u0001")
    .split("\u0001")
    .map((k) => k.trim())
    .filter(Boolean);
}

function hitungKata(teks: string): number {
  return (teks.match(/[A-Za-zÀ-ÿ]+/g) ?? []).length;
}

/**
 * Alihbahasakan naskah Indonesia menjadi draf naskah Inggris bergaya jurnal.
 *
 * Hasilnya draf, bukan terjemahan siap kirim: kata yang tidak ada padanannya
 * di kamus ditandai «begini» supaya penulisnya tahu persis mana yang masih
 * harus dikerjakan sendiri, dan berapa banyak.
 */
export function alihBahasa(naskah: string): HasilAlih {
  const baris: BarisAlih[] = [];
  const belumSemua: string[] = [];
  const bagianAda = new Set<BagianEN>();

  let bagian: BagianEN = "pendahuluan";
  let nomorBagian = 0;
  let hurufSub = 0;
  let adaJudulBagian = false;
  const sudahTerbit = new Set<BagianEN>();

  /** Terbitkan judul bagian bernomor Romawi, sekali saja untuk tiap bagian. */
  const terbitkanJudul = (b: BagianEN, sumber: string) => {
    if (sudahTerbit.has(b)) return;
    sudahTerbit.add(b);
    nomorBagian += 1;
    const angka = ROMAWI[nomorBagian - 1] ?? String(nomorBagian);
    baris.push({ jenis: "judul-bagian", bagian: b, sumber, hasil: `${angka}. ${JUDUL_EN[b] ?? ""}`, belum: [] });
  };

  for (const mentah of naskah.split(/\n/)) {
    const isi = mentah.trim();
    if (!isi) continue;

    const judul = kenaliJudul(isi);
    if (judul) {
      bagian = judul;
      bagianAda.add(judul);
      hurufSub = 0;
      adaJudulBagian = true;
      if (judul === "abstrak" || judul === "katakunci") {
        // Isi yang menempel pada judulnya ("Kata Kunci: a, b, c") tidak boleh
        // ikut hilang bersama judulnya.
        const lekat = isi.replace(/^[^:]*:\s*/, "");
        const adaIsi = lekat !== isi && lekat.trim().length > 0;
        if (!adaIsi) continue;
        const kala = KALA[judul];
        const alih = judul === "katakunci"
          ? alihKataKunci(lekat, kala)
          : terjemahKalimat(lekat, kala);
        belumSemua.push(...alih.belum);
        baris.push({
          jenis: "paragraf",
          bagian: judul,
          sumber: isi,
          hasil: judul === "abstrak" ? `Abstract—${alih.hasil}` : `Keywords—${alih.hasil.replace(/\.$/, "")}`,
          belum: alih.belum,
        });
        continue;
      }
      if (judul === "daftar") {
        baris.push({ jenis: "judul-bagian", bagian: judul, sumber: isi, hasil: "REFERENCES", belum: [] });
        continue;
      }
      terbitkanJudul(judul, isi);
      continue;
    }

    const sub = kenaliSubJudul(isi);
    if (sub) {
      // Sub-bab boleh memindahkan bagian: banyak naskah hanya memuat
      // "Teknik Analisis Data" tanpa judul BAB III di atasnya. Judul bagiannya
      // diterbitkan di sini supaya susunan IMRaD tetap utuh — pengurai bab
      // memang membuang "BAB I PENDAHULUAN" yang tidak memuat isi sendiri.
      if (sub.bagian && sub.bagian !== bagian) hurufSub = 0;
      if (sub.bagian) {
        bagian = sub.bagian;
        if (!sudahTerbit.has(bagian)) {
          adaJudulBagian = true;
          // Sumbernya dikosongkan: judul ini disisipkan alat, tidak ada
          // barisnya pada naskah asli.
          terbitkanJudul(bagian, "");
        }
      }
      const huruf = String.fromCharCode(65 + hurufSub);
      hurufSub += 1;
      bagianAda.add(bagian);
      baris.push({ jenis: "sub-judul", bagian, sumber: isi, hasil: `${huruf}. ${sub.en}`, belum: [] });
      continue;
    }

    // Daftar pustaka tidak diterjemahkan: judul karya orang lain tetap
    // sebagaimana aslinya, hanya susunannya yang diubah di alat terpisah.
    if (bagian === "daftar") {
      baris.push({ jenis: "paragraf", bagian, sumber: isi, hasil: isi, belum: [] });
      continue;
    }

    bagianAda.add(bagian);
    const kala = KALA[bagian];
    const kalimat = bagiKalimat(isi);
    const hasil: string[] = [];
    const belum: string[] = [];
    for (const k of kalimat) {
      const alih = terjemahKalimat(k, kala);
      if (alih.hasil.replace(/[.\s]/g, "")) hasil.push(alih.hasil);
      belum.push(...alih.belum);
    }
    belumSemua.push(...belum);

    let teksBaris = hasil.join(" ");
    if (bagian === "abstrak" && !/^abstract/i.test(teksBaris)) teksBaris = `Abstract—${teksBaris}`;
    if (bagian === "katakunci") teksBaris = `Keywords—${teksBaris.replace(/^keywords[—:-]\s*/i, "").replace(/\.$/, "")}`;

    baris.push({ jenis: "paragraf", bagian, sumber: isi, hasil: teksBaris, belum });
  }

  // Ringkasan kata yang belum punya padanan, yang tersering di atas.
  const tally = new Map<string, number>();
  for (const k of belumSemua) tally.set(k, (tally.get(k) ?? 0) + 1);
  const belum = [...tally.entries()]
    .map(([kata, jumlah]) => ({ kata, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah || a.kata.localeCompare(b.kata));

  const jumlahKata = hitungKata(naskah);
  const jumlahDikenali = Math.max(0, jumlahKata - belumSemua.length);
  const cakupan = jumlahKata > 0 ? Math.round((jumlahDikenali / jumlahKata) * 100) : 0;

  const teks = baris
    .map((b) => (b.jenis === "judul-bagian" ? `\n${b.hasil}\n` : b.jenis === "sub-judul" ? `\n${b.hasil}` : b.hasil))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    baris,
    teks,
    jumlahKata,
    jumlahDikenali,
    cakupan,
    belum,
    catatan: susunCatatan(naskah, bagianAda, adaJudulBagian, belum.length, jumlahKata),
    bagianAda: [...bagianAda],
  };
}

/** Catatan pedoman: apa yang sudah diterapkan, dan apa yang masih kurang. */
function susunCatatan(
  naskah: string, ada: Set<BagianEN>, adaJudulBagian: boolean, belum: number, kata: number,
): CatatanGaya[] {
  const c: CatatanGaya[] = [];

  if (adaJudulBagian) {
    c.push({
      judul: "Judul bagian disusun ulang",
      pesan:
        "Judul bab diganti judul bagian bergaya jurnal dan prosiding: I. INTRODUCTION, II. METHODS, " +
        "III. RESULT AND DISCUSSION, IV. CONCLUSION AND RECOMMENDATION, lalu REFERENCES tanpa nomor.",
    });
  } else {
    c.push({
      judul: "Judul bab belum dikenali",
      pesan:
        "Tidak ada baris yang terbaca sebagai judul bab, jadi seluruh naskah diperlakukan sebagai Introduction. " +
        "Pastikan tiap judul bab berada pada barisnya sendiri.",
    });
  }

  c.push({
    judul: "Kala menyesuaikan bagian",
    pesan:
      "Methods dan Results ditulis dengan kala lampau karena melaporkan apa yang sudah dikerjakan dan ditemukan; " +
      "Introduction, Discussion, dan Conclusion memakai kala kini (APA edisi 7, bab 4).",
  });

  if (!ada.has("abstrak")) {
    c.push({
      judul: "Abstract belum ada",
      pesan:
        "Jurnal dan prosiding menuntut abstrak 150–250 kata yang memuat tujuan, metode, temuan utama, dan " +
        "simpulan, lalu 3–5 kata kunci. Tambahkan barisnya dengan judul Abstrak.",
    });
  }
  if (!ada.has("metode")) {
    c.push({
      judul: "Bagian Methods belum terbaca",
      pesan: "Tanpa bagian metode, peninjau tidak dapat menilai keabsahan temuan. Sertakan pendekatan, sumber data, dan cara analisisnya.",
    });
  }
  if (!ada.has("daftar")) {
    c.push({
      judul: "Daftar pustaka belum terbaca",
      pesan: "Prosiding IEEE menomori rujukan dalam kurung siku, [1], [2], sesuai urutan penyebutan. Alat pengubah APA ke IEEE tersedia di bawah.",
    });
  }

  if (/\((?:[A-Z][A-Za-z]+(?:,| dan| &)[^)]*)?\d{4}\)/.test(naskah)) {
    c.push({
      judul: "Sitasi masih bergaya APA",
      pesan:
        "Sitasi (Nama, 2019) dibiarkan apa adanya karena masih dipakai banyak jurnal ilmu sosial. Untuk prosiding " +
        "bergaya IEEE, ubah menjadi nomor [1] sesuai urutan penyebutan pertama.",
    });
  }

  if (/\b(?:tabel|gambar) (?:di ?atas|di ?bawah|berikut)\b/i.test(naskah)) {
    c.push({
      judul: "Rujukan tabel menyebut letak",
      pesan:
        '"Tabel di atas" tidak bermakna setelah tata letak berubah. Draf ini menggantinya dengan "As shown in ' +
        'Table 1"; sesuaikan nomornya dengan tabel Anda.',
    });
  }

  if (kata > 0 && kata < 3000) {
    c.push({
      judul: "Naskah masih pendek",
      pesan: `Naskah sumber ${kata.toLocaleString("id-ID")} kata. Artikel ilmu sosial umumnya 5.000–7.000 kata, prosiding 3.000–5.000 kata.`,
    });
  }

  if (belum > 0) {
    c.push({
      judul: `${belum} kata belum ada padanannya`,
      pesan:
        "Kata yang tidak ada di kamus ditandai «begini» dan tidak ditebak. Istilah khas bidang Anda memang " +
        "sebaiknya Anda sendiri yang menentukan padanannya, lalu dipakai konsisten di seluruh naskah.",
    });
  }

  return c;
}

// ---------------------------------------------------------------------------
// Daftar pustaka: APA menjadi IEEE
//
// Prosiding dan sebagian besar jurnal teknik memakai rujukan bernomor dalam
// kurung siku, sedangkan skripsi ilmu sosial di Indonesia hampir selalu APA.
// Pengubahnya deterministik: yang tidak terbaca polanya dilaporkan apa adanya
// agar tidak ada entri yang diam-diam hilang.
// ---------------------------------------------------------------------------

export type EntriIeee = { nomor: number; hasil: string; sumber: string; utuh: boolean };

/** "Basit, A., & Nurlukman, A. D." menjadi "A. Basit and A. D. Nurlukman". */
function balikNama(bagian: string): string {
  const potong = bagian
    .replace(/\s*&\s*/g, ", ")
    .replace(/\s+dan\s+/g, ", ")
    .replace(/,\s*,/g, ",")
    .trim()
    .replace(/[,.]$/, "")
    .split(/,\s*/)
    .map((x) => x.trim())
    .filter(Boolean);

  // APA menulis nama belakang lebih dulu, lalu inisialnya. Keduanya
  // dipasangkan lalu dibalik, sebagaimana lazimnya rujukan IEEE.
  const orang: string[] = [];
  for (let i = 0; i < potong.length; i += 1) {
    const kini = potong[i];
    const lanjut = potong[i + 1];
    const inisial = /^(?:[A-Z]\.?\s*)+$/.test(lanjut ?? "");
    if (inisial) {
      const depan = (lanjut ?? "").replace(/\s+/g, " ").trim();
      orang.push(`${/\.$/.test(depan) ? depan : `${depan}.`} ${kini}`);
      i += 1;
      continue;
    }
    orang.push(kini);
  }

  if (orang.length === 0) return bagian;
  if (orang.length === 1) return orang[0];
  return `${orang.slice(0, -1).join(", ")} and ${orang[orang.length - 1]}`;
}

/**
 * Ubah satu daftar pustaka bergaya APA menjadi rujukan bernomor bergaya IEEE.
 *
 * Entri dipisah baris kosong atau baris baru; tiap entri yang polanya tidak
 * terbaca tetap dikeluarkan apa adanya dan ditandai belum utuh.
 */
export function apaKeIeee(daftar: string): EntriIeee[] {
  const entri = daftar
    .split(/\n\s*\n|\n(?=[A-Z‘“])/)
    .map((e) => e.replace(/\s+/g, " ").trim())
    .filter((e) => e.length > 12);

  return entri.map((asli, i) => {
    const nomor = i + 1;
    const pisah = asli.match(/^(.+?)\s*\((\d{4}[a-z]?)\)\.?\s*(.+)$/);
    if (!pisah) return { nomor, hasil: `[${nomor}] ${asli}`, sumber: asli, utuh: false };

    const penulis = balikNama(pisah[1].trim());
    const tahun = pisah[2].replace(/[a-z]$/, "");
    const sisa = pisah[3].trim();

    const bagi = sisa.match(/^(.+?)\.\s+(.+)$/);
    const judul = (bagi ? bagi[1] : sisa).replace(/\.$/, "").trim();
    const wadah = (bagi ? bagi[2] : "").replace(/\.$/, "").trim();

    if (!wadah) return { nomor, hasil: `[${nomor}] ${penulis}, ${judul}. ${tahun}.`, sumber: asli, utuh: false };

    // Artikel jurnal: "Nama Jurnal, 18(9), 1875-1895" beserta variasinya.
    const jurnal = wadah.match(/^(.+?),\s*(\d+)\s*(?:\((\d+[^)]*)\))?,\s*(?:pp\.\s*)?(\d+\s*[–-]+\s*\d+)/i);
    if (jurnal) {
      const nama = jurnal[1].replace(/,$/, "").trim();
      const jilid = jurnal[2];
      const nomorTerbit = jurnal[3];
      const halaman = jurnal[4].replace(/\s*[–-]+\s*/, "-");
      const bagianNomor = nomorTerbit ? `, no. ${nomorTerbit}` : "";
      return {
        nomor,
        hasil: `[${nomor}] ${penulis}, "${judul}," ${nama}, vol. ${jilid}${bagianNomor}, pp. ${halaman}, ${tahun}.`,
        sumber: asli,
        utuh: true,
      };
    }

    // Artikel tanpa halaman, tetapi jelas ada nama jurnalnya.
    const jurnalRingkas = wadah.match(/^(.+?),\s*(\d+)\s*(?:\((\d+[^)]*)\))?$/);
    if (jurnalRingkas) {
      const bagianNomor = jurnalRingkas[3] ? `, no. ${jurnalRingkas[3]}` : "";
      return {
        nomor,
        hasil: `[${nomor}] ${penulis}, "${judul}," ${jurnalRingkas[1].trim()}, vol. ${jurnalRingkas[2]}${bagianNomor}, ${tahun}.`,
        sumber: asli,
        utuh: true,
      };
    }

    // Buku: judul tanpa tanda kutip, lalu penerbit.
    const alamat = wadah.match(/https?:\/\/\S+/);
    if (alamat) {
      return {
        nomor,
        hasil: `[${nomor}] ${penulis}, "${judul}," ${tahun}. [Online]. Available: ${alamat[0]}`,
        sumber: asli,
        utuh: true,
      };
    }

    return { nomor, hasil: `[${nomor}] ${penulis}, ${judul}. ${wadah}, ${tahun}.`, sumber: asli, utuh: true };
  });
}

/**
 * Tiga hal yang tidak ada padanan strukturalnya dalam bahasa Indonesia dan
 * karena itu paling sering hilang pada terjemahan harfiah:
 *
 * 1. Kata sandang. "menjadi sumber utama" harus menjadi "became the main
 *    source", bukan "became main source".
 * 2. Kata kerja setelah kata depan berbentuk -ing: "dalam menentukan" menjadi
 *    "in determining", bukan "in determine".
 * 3. Kata ganti milik. Bahasa Indonesia menaruhnya di belakang benda
 *    ("pilihan mereka"), bahasa Inggris di depan ("their choice").
 */
function rapikanTataBahasa(butir: Butir[]) {
  // Milik: kata ganti sesudah benda dipindahkan ke depan frasanya.
  for (let i = butir.length - 1; i > 0; i -= 1) {
    const ganti = MILIK[butir[i].teks];
    if (!ganti || butir[i].kelas !== "pron") continue;
    if (butir[i - 1].kelas !== "n" && butir[i - 1].kelas !== "adj") continue;
    let awal = i - 1;
    while (awal > 0 && (butir[awal - 1].kelas === "n" || butir[awal - 1].kelas === "adj")) awal -= 1;
    butir.splice(i, 1);
    butir.splice(awal, 0, { teks: ganti, kelas: "det", beku: true });
  }

  // Benda sesudah angka atau kata penentu jumlah berbentuk jamak: "120
  // people", "many experts", "several factors".
  for (const [i, b] of butir.entries()) {
    if (b.kelas !== "n" || b.jamak || b.diri) continue;
    const sebelum = butir[i - 1];
    if (!sebelum) continue;
    const banyak = sebelum.kelas === "num" && sebelum.teks !== "one"
      || /^(?:many|several|various|all|most|numerous|few)$/i.test(sebelum.teks);
    if (!banyak) continue;
    b.teks = JAMAK_KHUSUS[b.teks.toLowerCase()] ?? jamakkan(b.teks);
    b.jamak = true;
  }

  // Dua benda berturut-turut dalam bahasa Indonesia bermakna kepemilikan:
  // "peran media sosial" adalah "role of social media", bukan "role social
  // media".
  for (let i = 0; i < butir.length - 1; i += 1) {
    const kini = butir[i];
    const lanjut = butir[i + 1];
    if (kini.kelas !== "n" || lanjut.kelas !== "n" || kini.diri) continue;
    if (/\bof$/.test(kini.teks) || /\bto\s+\w+$/.test(kini.teks)) continue;
    if (/^(?:its|their|our|my|his|her)\b/.test(lanjut.teks)) continue;
    butir.splice(i + 1, 0, { teks: "of", kelas: "prep", beku: true });
    i += 1;
  }

  // Kata bantu tidak berpasangan dengan kata "to be": "should is" dibuang di
  // sini supaya kata kerja sesudahnya yang diurus kalanya.
  for (let i = butir.length - 1; i > 0; i -= 1) {
    if (!/^(?:is|are|was|were)$/.test(butir[i].teks)) continue;
    if (!/\b(?:should|can|could|must|will|would|may|might)\s*$/i.test(butir[i - 1].teks)) continue;
    butir.splice(i, 1);
  }

  for (let i = 0; i < butir.length; i += 1) {
    const b = butir[i];
    const sebelum = butir[i - 1];

    // "untuk meningkatkan" adalah "to increase", bukan "for increasing".
    if (b.kelas === "v" && sebelum?.teks === "for") {
      sebelum.teks = "to";
      b.teks = b.teks.replace(/^(\w+)s$/, "$1");
      b.beku = true;
      continue;
    }

    // Kata kerja setelah kata depan menjadi bentuk -ing: "dalam menentukan"
    // adalah "in determining", bukan "in determine".
    if (b.kelas === "v" && sebelum?.kelas === "prep" && !/ing$/.test(b.teks)) {
      const dasar = b.teks.replace(/^(\w+)s$/, "$1");
      b.teks = /e$/.test(dasar) ? `${dasar.slice(0, -1)}ing` : `${dasar}ing`;
      b.beku = true;
      continue;
    }

    if (b.kelas !== "n" || b.diri) continue;

    // Kata sandang, hanya bila jelas dibutuhkan dan jelas aman. Kata sifat di
    // depan benda ikut dilewati: "the main source", bukan "main the source".
    if (b.jamak || /^[A-Z]/.test(b.teks)) continue;
    // Inti frasa menentukan perlu tidaknya kata sandang: pada "source of
    // information" intinya "source", pada "voter behaviour" intinya
    // "behaviour".
    const kata = b.teks.toLowerCase().split(/\s+/);
    const inti = / (?:of|to) /.test(` ${b.teks.toLowerCase()} `) ? kata[0] : kata[kata.length - 1];
    if (TAK_TERBILANG.has(b.teks.toLowerCase()) || TAK_TERBILANG.has(inti)) continue;
    if (/^(?:its|their|our|my|his|her|this|that|these|those|the|a|an)\b/.test(b.teks)) continue;

    let awal = i;
    while (awal > 0 && butir[awal - 1].kelas === "adj") awal -= 1;
    const pemicu = butir[awal - 1];

    // Subjek di awal kalimat: "Perusahaan dituntut" adalah "The company is
    // required", bukan "Company is required".
    if (!pemicu) {
      butir.splice(awal, 0, { teks: "The", kelas: "det", beku: true });
      i += 1;
      continue;
    }

    // "that" membuka anak kalimat yang subjeknya berhak memperoleh kata
    // sandang; "and" hanya merangkai, dan tidak.
    const pembukaKlausa = pemicu.kelas === "conj" && /\b(?:that|which)$/i.test(pemicu.teks);
    if (!pembukaKlausa && !["prep", "v", "utuh"].includes(pemicu.kelas)) continue;
    const ekorPemicu = pemicu.teks.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
    if (/^(?:is|are|was|were|be|been)$/.test(ekorPemicu)) continue;
    // Sesudah kata depan, kata sandang dipasang pada rangkaian milik
    // ("in the formation of public opinion", "of the company"); "through
    // interviews" tidak memerlukannya dan terbaca keliru bila dipaksakan.
    if (pemicu.kelas === "prep" && ekorPemicu !== "of" && butir[i + 1]?.teks !== "of") continue;
    butir.splice(awal, 0, { teks: "the", kelas: "det", beku: true });
    i += 1;
  }
}
