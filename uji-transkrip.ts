// UJI PEMBACA TRANSKRIP & KAMUS MATA KULIAH
//
// Bahannya berkas SIMAK sungguhan — struktur aslinya, dengan nama dan NIM
// mahasiswanya diganti. Struktur itulah yang penting: dua blok kolom
// bernomor, judul skripsi yang melompat dua baris, dan blok "Keterangan" di
// bawah tabel yang sel-selnya berada tepat di kolom nama mata kuliah.
//
// Blok terakhir itu pernah merusak satu baris tanpa ada yang menyadarinya:
// sel legenda "K" terbaca sebagai nama Inggris milik "Etika Pemerintahan",
// dan transkrip resmi tercetak begitu. Uji ini menahannya kembali.

import { readFileSync } from "node:fs";
import { extractBio, parseSheetRows, computeTotals, type Aoa } from "./src/app/dashboard/template/transkrip-parse";
import {
  labelTranskrip, pakaiRektorDari, pecahAkreditasi, lengkapiAkreditasi,
  labelSebaris, LABEL_SEBARIS, LABEL_BERTINGKAT,
  AKREDITASI_BAWAAN, PERINGKAT_AKREDITASI,
} from "./src/app/dashboard/template/transkrip-label";
import { TEMPLATE_BIO_ROWS } from "./src/app/dashboard/template/transkrip-template";
import {
  isiInggris, isiUlangInggris, terjemahkanMatkul, rapikanNama, rapikanKode, panenKamus,
  rantaiLingkup, lingkupUtama, kunciKamus, kodeBentrok, KAMUS_KODE, tebakKonsentrasi,
  NAMA_KONSENTRASI, LINGKUP_PEMERINTAHAN, LINGKUP_ILKOM, LINGKUP_ILKOM_BC,
  LINGKUP_ILKOM_PR, LINGKUP_ILKOM_ADV,
} from "./src/lib/kamus-matkul";
import { penggalJudulInggris, judulBerbahasaIndonesia } from "./src/lib/judul-inggris";
import { concentrationsFor } from "./src/lib/academic";

const IP = { prodi: "Ilmu Pemerintahan" };

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

const aoa = JSON.parse(readFileSync("./uji-berkas-contoh/transkrip-simak.json", "utf8")) as Aoa;

console.log("\n=== BIODATA DARI BERKAS MENTAH ===\n");

const bio = extractBio(aoa);
sama("nama mahasiswa terbaca", bio.nama, "Mahasiswa Contoh");
sama("NIM terbaca", bio.nim, "1900000000");
sama("program studi terbaca", bio.prodi, "Ilmu Pemerintahan");
sama("tempat tanggal lahir terbaca", bio.ttl, "Tangerang, 1 Januari 2000");
sama("tanggal yudisium terbaca", bio.yudisium, "6 Juli 2026");
benar("akreditasi terbaca", (bio.akred || "").includes("LAMSPAK"), bio.akred);
// Berkas SIMAK mengirim nomor SK-nya sendirian. Yang masuk ke kolom
// Akreditasi — dan yang ikut diarsipkan — harus sudah berperingkat.
sama("peringkat UNGGUL ditempelkan pada akreditasi dari SIMAK",
  lengkapiAkreditasi(bio.akred || ""), "UNGGUL LAMSPAK Nomor 099/AK.03.05/2026");

// Judul skripsi ditulis melompat dua baris di kolom kanan; kalau hanya baris
// pertama yang terbaca, transkrip resmi tercetak dengan judul terpotong.
benar("judul skripsi terbaca utuh dua baris",
  (bio.judul || "").includes("Meminimalisir Angka Putus") && (bio.judul || "").includes("SMKN Kota Tangerang"),
  bio.judul);
benar("judul tidak kemasukan label lain",
  !/keterangan|predikat|indeks|dekan/i.test(bio.judul || ""), bio.judul);

console.log("\n=== MATA KULIAH & ANGKA ===\n");

const rows = parseSheetRows(aoa);
sama("53 mata kuliah terbaca", rows.length, 53);
// Dua blok kolom digabung menurut nomornya, bukan menurut letaknya.
sama("mata kuliah pertama dari blok kiri", rows[0].nama, "Ilmu Budaya Dasar");
sama("mata kuliah terakhir dari blok kanan", rows[52].nama, "Skripsi");
benar("semua punya SKS", rows.every((r) => r.k > 0));
benar("semua punya kode", rows.every((r) => r.kode.length > 0));

const total = computeTotals(rows);
// Angka-angka ini tertulis di berkasnya sendiri: 153 SKS, mutu 525, IPK 3.43.
sama("total SKS sama dengan yang tertulis", total.sks, 153);
sama("total mutu sama dengan yang tertulis", total.mutu, 525);
sama("IPK dibulatkan dua angka", total.ipk.toFixed(2), "3.43");

// Baris subtotal dan JUMLAH tidak boleh ikut terbaca sebagai mata kuliah.
benar("tidak ada mata kuliah ber-SKS ganjil besar", rows.every((r) => r.k <= 12));
benar("tidak ada baris bernama JUMLAH/Total", !rows.some((r) => /jumlah|^total/i.test(r.nama)));

console.log("\n=== BLOK KETERANGAN TIDAK MENYUSUP ===\n");

// Sel legenda "K", "HM", "AM", "MK" berada di kolom nama mata kuliah, tepat
// di bawah tabel. Sebelum diperbaiki, "K" menjadi nama Inggris milik mata
// kuliah terakhir kolom kiri.
const etika = rows.find((r) => r.nama === "Etika Pemerintahan");
benar("Etika Pemerintahan ada", Boolean(etika));
sama("dan kolom Inggrisnya TIDAK terisi legenda", etika?.en, "");
benar("tidak ada satu pun nama Inggris satu-dua huruf",
  rows.every((r) => !r.en || r.en.length >= 4),
  rows.filter((r) => r.en && r.en.length < 4).map((r) => `${r.nama}="${r.en}"`).join(", "));

console.log("\n=== KAMUS: BERKAS INDONESIA JADI DWIBAHASA ===\n");

const hasil = isiInggris(rows, {}, IP);
sama("seluruh 53 baris terisi bahasa Inggris", hasil.rows.filter((r) => r.en).length, 53);
sama("semuanya dari kamus, bukan tebakan kata", hasil.dariKasar, 0);
sama("tidak ada yang perlu dicek manual", hasil.perluDicek.length, 0);

const cari = (nama: string) => hasil.rows.find((r) => r.nama === nama)?.en;
sama("Ilmu Budaya Dasar", cari("Ilmu Budaya Dasar"), "Basic Cultural Sciences");
sama("Etika Pemerintahan", cari("Etika Pemerintahan"), "Government Ethics");
sama("Skripsi", cari("Skripsi"), "Undergraduate Thesis");
sama("PKL", cari("PKL"), "Field Work Practice (Internship)");
sama("KKN", cari("KKN"), "Community Service Program");
sama("AIKA V", cari("AIKA V"), "Al-Islam and Kemuhammadiyahan V");
sama("kurung E-Government tetap rapi",
  cari("Pemerintahan Elektronik ( E-Government )"), "Electronic Government (E-Government)");

console.log("\n=== ATURAN KAMUS ===\n");

// Kode didahulukan atas nama: kode unik per kurikulum, sedangkan nama dapat
// ditulis berbeda oleh operator yang berbeda.
sama("kode menang atas nama", terjemahkanMatkul("MKK-011", "Nama Yang Salah Ketik", {}, IP).sumber, "kode");
sama("nama dipakai bila kodenya asing", terjemahkanMatkul("XXX-999", "Kewirausahaan", {}, IP).sumber, "nama");
sama("ejaan berbeda tetap ketemu", terjemahkanMatkul("", "MANAJEMEN KONFLIK", {}, IP).en, "Conflict Management");
sama("spasi berlebih tidak masalah", terjemahkanMatkul("", "  Kepemimpinan  ", {}, IP).en, "Leadership");
sama("kode berspasi tetap ketemu", terjemahkanMatkul(" mkk-011 ", "", {}, IP).en, "Basic Cultural Sciences");

// Yang tidak dikenal tetap mendapat sesuatu yang terbaca, DAN ditandai.
const asing = terjemahkanMatkul("ZZZ-001", "Sistem Pemerintahan Antariksa", {}, IP);
sama("mata kuliah asing ditandai sebagai tebakan", asing.sumber, "kasar");
benar("tebakannya tetap terbaca", asing.en.includes("Government System"), asing.en);
sama("nama kosong tidak menghasilkan apa-apa", terjemahkanMatkul("", "", {}, IP).sumber, "kosong");

// Terjemahan resmi dari KUI SELALU menang atas kamus.
const sudahInggris = isiInggris(
  [{ kode: "MKK-011", nama: "Ilmu Budaya Dasar", en: "Terjemahan Resmi KUI" }], {}, IP);
sama("yang sudah berisi tidak ditimpa", sudahInggris.rows[0].en, "Terjemahan Resmi KUI");
sama("dan dihitung sebagai sudah ada", sudahInggris.sudahAda, 1);

console.log("\n=== BENTUK KAMUS ===\n");

benar("tidak ada kode kembar",
  new Set(Object.keys(KAMUS_KODE).map(rapikanKode)).size === Object.keys(KAMUS_KODE).length);
benar("semua kode sudah rapi", Object.keys(KAMUS_KODE).every((k) => k === rapikanKode(k)));
benar("tidak ada terjemahan kosong", Object.values(KAMUS_KODE).every((v) => v.trim().length > 2));
// Kamus tidak boleh memuat kata Indonesia yang jelas — itu tanda ada baris
// yang lupa diterjemahkan.
benar("tidak ada sisa kata Indonesia di kamus kode",
  !Object.values(KAMUS_KODE).some((v) => /\b(dan|ilmu|sistem|pemerintahan|manajemen)\b/i.test(v)),
  Object.values(KAMUS_KODE).filter((v) => /\b(dan|ilmu|sistem|pemerintahan|manajemen)\b/i.test(v)).join(", "));
sama("penyeragam nama membuang tanda baca", rapikanNama("Analisa & Kebijakan  Publik!"), "analisa kebijakan publik");

console.log("\n=== KAMUS YANG TUMBUH DARI KOREKSI ADMIN ===\n");

// Koreksi tangan admin harus menang atas daftar bawaan — daftar bawaan
// ditulis sekali, koreksinya dibuat orang yang sedang melihat berkasnya.
const koreksiIP = { [kunciKamus(LINGKUP_PEMERINTAHAN, "MKK-011")]: "Introduction to Culture" };
sama("kamus tambahan mengalahkan bawaan",
  terjemahkanMatkul("MKK-011", "Ilmu Budaya Dasar", koreksiIP, IP).en, "Introduction to Culture");
sama("dan tetap ditandai berasal dari kode",
  terjemahkanMatkul("MKK-011", "", koreksiIP, IP).sumber, "kode");
sama("kode yang tidak ada di tambahan jatuh ke bawaan",
  terjemahkanMatkul("MKK-012", "", koreksiIP, IP).en, "Introduction to Sociology");

// Koreksi berlingkup TIDAK boleh bocor ke prodi lain: MKK-011 Ilmu
// Pemerintahan dan kamus Ilmu Komunikasi adalah dua laci yang berbeda.
sama("koreksi Ilmu Pemerintahan tidak mengubah Ilmu Komunikasi",
  terjemahkanMatkul("MKK-012", "Ilmu Budaya Dasar", koreksiIP, { prodi: "Ilmu Komunikasi" }).en,
  "Basic Cultural Studies");

// Kunci lama tanpa lingkup tetap terpakai — tetapi hanya untuk kode yang
// kamus bawaan memang tidak punya, bukan menimpa transkrip resmi.
sama("kunci lama mengisi kode yang belum dikenal",
  terjemahkanMatkul("ZZZ-777", "", { "ZZZ-777": "Legacy Course" }, IP).en, "Legacy Course");
sama("kunci lama TIDAK menimpa nama resmi konsentrasi",
  terjemahkanMatkul("MKPB-051", "Produksi Feature TV", { "MKPB-051": "Field Work Practice (Internship)" },
    { prodi: "Ilmu Komunikasi", konsentrasi: "Broadcasting" }).en,
  "TV Feature Production");

// Yang dipanen hanya yang BERBEDA dari bawaan; menyimpan ulang yang sama
// hanya menggelembungkan penyimpanan tanpa mengubah hasil apa pun.
const panen = panenKamus([
  { kode: "MKK-011", nama: "Ilmu Budaya Dasar", en: "Basic Cultural Sciences" },
  { kode: "ZZZ-001", nama: "Mata Kuliah Baru", en: "Brand New Course" },
  { kode: "ZZZ-002", nama: "Tanpa Inggris", en: "" },
  { kode: "", nama: "Tanpa Kode", en: "No Code" },
], IP);
sama("hanya satu pasangan yang layak diingat", panen.length, 1);
sama("dan itu yang benar-benar baru", panen[0].kode, "ZZZ-001");
sama("lingkupnya ikut dipanen", panen[0].lingkup, LINGKUP_PEMERINTAHAN);
sama("kode kembar tidak dipanen dua kali",
  panenKamus([
    { kode: "ZZZ-003", nama: "A", en: "Alpha" },
    { kode: "zzz-003", nama: "A", en: "Alpha" },
  ], IP).length, 1);

// Tanpa prodi, koreksinya tidak punya laci. Menyimpannya datar persis
// melahirkan kembali bug yang memaksa kamus ini dipecah.
sama("tanpa prodi tidak ada yang dipanen",
  panenKamus([{ kode: "ZZZ-004", nama: "B", en: "Beta" }]).length, 0);
sama("konsentrasi ikut menentukan laci",
  panenKamus([{ kode: "ZZZ-005", nama: "C", en: "Gamma" }],
    { prodi: "Ilmu Komunikasi", konsentrasi: "Broadcasting" })[0].lingkup,
  LINGKUP_ILKOM_BC);

console.log("\n=== ILMU KOMUNIKASI: TIGA KONSENTRASI ===\n");

// Bahannya transkrip dwibahasa RESMI fakultas untuk ketiga konsentrasi, tanpa
// nama dan NIM mahasiswanya. Kolom Inggris pada berkas itu adalah jawaban
// yang benar; uji ini membuang kolom tersebut, mengisinya kembali dari kamus,
// lalu menuntut hasilnya sama persis. Kalau kamus bergeser satu kata pun dari
// yang dicetak fakultas, uji ini gagal.
const KONSENTRASI: Array<[string, string]> = [
  ["public-relations", "Public Relations"],
  ["broadcasting", "Broadcasting"],
  ["advertising", "Advertising"],
];


for (const [berkas, konsentrasi] of KONSENTRASI) {
  const lembar = JSON.parse(
    readFileSync(`./uji-berkas-contoh/transkrip-ilkom-${berkas}.json`, "utf8"),
  ) as Aoa;
  const bioIlkom = extractBio(lembar);
  const barisIlkom = parseSheetRows(lembar);
  const lingkup = { prodi: bioIlkom.prodi, konsentrasi: bioIlkom.konsentrasi };

  sama(`${konsentrasi}: prodi terbaca`, bioIlkom.prodi, "ILMU KOMUNIKASI");
  // Label pada berkas fakultas tertulis "KONSETRASI" — salah ketik yang sudah
  // dipakai bertahun-tahun. Pembacanya harus tetap mengenalinya.
  sama(`${konsentrasi}: konsentrasi terbaca meski labelnya salah ketik`,
    bioIlkom.konsentrasi, konsentrasi.toUpperCase());
  sama(`${konsentrasi}: 52 mata kuliah terbaca`, barisIlkom.length, 52);

  // Mata kuliah yang nama Indonesia dan Inggrisnya SAMA PERSIS ("Media
  // Relations", "Digital Editing", "Public Speaking") tidak punya baris
  // Inggris tersendiri untuk dibaca — pembacanya menolak menyalin nama ke
  // dirinya sendiri. Yang seperti itu diisi kamus, dan hasilnya sama saja.
  const resmi = new Map(barisIlkom.filter((r) => r.en).map((r) => [r.kode, r.en]));
  benar(`${konsentrasi}: sebagian besar kolom Inggris terbaca dari berkasnya`,
    resmi.size >= 49, `${resmi.size} dari 52`);

  const diisi = isiUlangInggris(barisIlkom, {}, lingkup);
  sama(`${konsentrasi}: seluruh 52 baris terisi`, diisi.rows.filter((r) => r.en).length, 52);
  sama(`${konsentrasi}: tidak ada yang cuma tebakan kata`, diisi.dariKasar, 0);

  // TANPA pengecualian satu pun. Kamus tidak berwenang merapikan bahasa KUI:
  // yang tercetak harus sama dengan yang dikeluarkan KUI untuk konsentrasi
  // ini, termasuk bunyi yang berbeda dari dua konsentrasi lain.
  const beda = diisi.rows.filter((r) => resmi.has(r.kode) && r.en !== resmi.get(r.kode));
  benar(`${konsentrasi}: nama Inggris sama persis dengan kiriman KUI`,
    beda.length === 0,
    beda.map((r) => `${r.kode} "${r.nama}": kamus "${r.en}" ≠ KUI "${resmi.get(r.kode)}"`).join(" | "));
}

// Lima kode yang KUI tulis berbeda antar konsentrasi. Diperiksa tersendiri
// supaya jelas bahwa selisihnya memang disengaja, bukan lolos dari uji.
console.log("\n=== SELISIH ANTAR KONSENTRASI, DIPERTAHANKAN ===\n");
const PR = { prodi: "Ilmu Komunikasi", konsentrasi: "Public Relations" };
const BC = { prodi: "Ilmu Komunikasi", konsentrasi: "Broadcasting" };
const ADV = { prodi: "Ilmu Komunikasi", konsentrasi: "Advertising" };
sama("AIKA III di Public Relations", terjemahkanMatkul("MPK-003", "", {}, PR).en,
  "Al-Islam and Kemuhammadiyahan III (Islamic and Muhammadiyah Studies III)");
sama("AIKA III di Advertising", terjemahkanMatkul("MPK-003", "", {}, ADV).en,
  "Islamic and Muhammadiyah Studies III");
sama("MPK-011 di Broadcasting", terjemahkanMatkul("MPK-011", "", {}, BC).en,
  "Sociology and System Social Indonesia");
sama("MPK-011 di Public Relations", terjemahkanMatkul("MPK-011", "", {}, PR).en,
  "Sociology and Indonesian Social System");
sama("MKB-011 di Broadcasting", terjemahkanMatkul("MKB-011", "", {}, BC).en,
  "Social Development Communication");
sama("MKB-011 di Advertising", terjemahkanMatkul("MKB-011", "", {}, ADV).en,
  "Development Communication");

console.log("\n=== KODE YANG BERTABRAKAN ANTAR PRODI ===\n");

// Inilah sebabnya kamus dipecah. Kesepuluh kode ini dipakai OLEH KEDUA prodi
// untuk mata kuliah yang berbeda; sebelum diperbaiki, transkrip Ilmu
// Komunikasi tercetak dengan nama mata kuliah Ilmu Pemerintahan.
const BENTROK: Array<[string, string, string]> = [
  ["MKK-012", "Introduction to Sociology", "Basic Cultural Studies"],
  ["MKK-020", "Fundamentals of Logic", "Computer and Multimedia"],
  ["MPK-001", "Al-Islam and Kemuhammadiyahan I", "Islamic and Muhammadiyah Studies I"],
  ["MPK-010", "Philosophy of Science", "Philosophy of Knowledge and Fundamentals of Logic"],
];
for (const [kode, ip, ilkom] of BENTROK) {
  sama(`${kode} di Ilmu Pemerintahan`, terjemahkanMatkul(kode, "", {}, IP).en, ip);
  sama(`${kode} di Ilmu Komunikasi`, terjemahkanMatkul(kode, "", {}, BC).en, ilkom);
}

// MKPB-051/052 adalah tabrakan yang paling mahal: di Ilmu Pemerintahan itu
// PKL dan KKN, di Broadcasting itu dua mata kuliah produksi televisi.
sama("MKPB-051 di Ilmu Pemerintahan", terjemahkanMatkul("MKPB-051", "", {}, IP).en,
  "Field Work Practice (Internship)");
sama("MKPB-051 di Broadcasting", terjemahkanMatkul("MKPB-051", "", {}, BC).en, "TV Feature Production");
sama("MKPB-052 di Ilmu Pemerintahan", terjemahkanMatkul("MKPB-052", "", {}, IP).en,
  "Community Service Program");
sama("MKPB-052 di Broadcasting", terjemahkanMatkul("MKPB-052", "", {}, BC).en,
  "Production and Post-Production");

// Tanpa prodi, kode yang bertabrakan TIDAK ditebak. Menebak berarti mencetak
// nama mata kuliah prodi lain pada dokumen resmi yang ikut dilegalisir.
sama("tanpa prodi, kode bentrok tidak dijawab dari kode",
  terjemahkanMatkul("MKPB-051", "").sumber, "kosong");
// Daftar lengkapnya dikunci, bukan sekadar jumlahnya: kode yang diam-diam
// masuk atau keluar daftar ini mengubah transkrip yang sudah dicetak.
// Sepuluh yang pertama bentrok ANTAR PRODI; MKB-011 dan MPK-011 bentrok di
// dalam Ilmu Komunikasi sendiri, karena KUI menulisnya lain di berkas
// Broadcasting.
sama("daftar kode bentrok persis seperti yang didata",
  kodeBentrok().join(", "),
  "MKB-011, MKK-012, MKK-020, MKPB-051, MKPB-052, " +
    "MPK-001, MPK-002, MPK-003, MPK-004, MPK-005, MPK-010, MPK-011");
// Kode yang berarti sama di mana pun tetap dijawab tanpa prodi.
sama("tanpa prodi, kode yang tidak bentrok tetap dijawab",
  terjemahkanMatkul("MKB-044", "").en, "Undergraduate Thesis");

console.log("\n=== RANTAI LINGKUP ===\n");

// Konsentrasi yang tertulis selalu di depan; dua konsentrasi lain tetap ikut
// ditelusuri supaya mata kuliah lintas konsentrasi tidak jatuh ke tebakan.
sama("konsentrasi tertulis berada paling depan", rantaiLingkup(BC)[0], LINGKUP_ILKOM_BC);
sama("lalu inti Ilmu Komunikasi", rantaiLingkup(BC)[1], LINGKUP_ILKOM);
sama("rantai Broadcasting memuat keempat kamus", rantaiLingkup(BC).length, 4);
sama("mata kuliah lintas konsentrasi tetap ketemu",
  terjemahkanMatkul("MKSA-048", "Managemen Periklanan", {}, BC).en, "Advertising Management");
sama("ejaan konsentrasi bebas — 'BROADCASTING' huruf besar",
  lingkupUtama({ prodi: "ILMU KOMUNIKASI", konsentrasi: "BROADCASTING" }), LINGKUP_ILKOM_BC);
sama("ejaan Indonesia pun dikenali — 'Penyiaran'",
  lingkupUtama({ prodi: "Ilmu Komunikasi", konsentrasi: "Penyiaran" }), LINGKUP_ILKOM_BC);
sama("konsentrasi kosong jatuh ke inti Ilmu Komunikasi",
  lingkupUtama({ prodi: "Ilmu Komunikasi" }), LINGKUP_ILKOM);
sama("Ilmu Pemerintahan tidak punya konsentrasi", rantaiLingkup(IP).length, 1);
sama("prodi asing menghasilkan rantai kosong", rantaiLingkup({ prodi: "Ilmu Hukum" }).length, 0);

// Konsentrasi yang belum tertulis tetap menjangkau ketiganya — base SIMAK
// mentah memuat PROGRAM STUDI tetapi tidak selalu memuat KONSENTRASI.
sama("tanpa konsentrasi, mata kuliah Advertising tetap ketemu",
  terjemahkanMatkul("MKSA-046", "", {}, { prodi: "Ilmu Komunikasi" }).en,
  "Visual Communication Design I");

console.log("\n=== LABEL HEADER & FOOTER TRANSKRIP ===\n");

// Label transkrip ikut dilegalisir dan ikut dibaca kampus luar negeri, jadi
// bunyinya dikunci di sini — bukan sekadar terlihat benar sekali di layar.
// Acuannya transkrip resmi KUI yang sudah tercetak dan ditandatangani.
const EN_LBL = labelTranskrip(true);
const ID_LBL = labelTranskrip(false);
const sisiEn = (teks: string) => (teks.includes("|") ? teks.split("|")[1] : teks.split("/").slice(1).join("/")).trim();

sama("judul Inggris", EN_LBL.subtitle, "OFFICIAL ACADEMIC TRANSCRIPT");
sama("Nomor Ijazah Nasional", sisiEn(EN_LBL.noij), "NATIONAL DIPLOMA NUMBER");
sama("Nomor Pokok Perguruan Tinggi", sisiEn(EN_LBL.nppt), "NATIONAL HIGHER EDUCATION INSTITUTION CODE");
sama("Tanggal Yudisium", sisiEn(EN_LBL.yud), "DATE OF DEGREE CONFERRAL");
sama("Terakreditasi", sisiEn(EN_LBL.akred), "ACCREDITATION");
sama("Nama Mahasiswa", sisiEn(EN_LBL.nama), "STUDENT NAME");
sama("Nomor Induk Mahasiswa", sisiEn(EN_LBL.nim), "STUDENT IDENTIFICATION NUMBER");
sama("Tempat, Tgl Lahir", sisiEn(EN_LBL.ttl), "PLACE, DATE OF BIRTH");
sama("Program Studi", sisiEn(EN_LBL.prodi), "STUDY PROGRAM");
sama("Nomor Pokok Program Studi", sisiEn(EN_LBL.npps), "NATIONAL STUDY PROGRAM CODE");
sama("Fakultas", sisiEn(EN_LBL.fak), "FACULTY");
sama("nilai Fakultas", sisiEn(EN_LBL.fakval), "SOCIAL AND POLITICAL SCIENCES");
sama("Jenjang", sisiEn(EN_LBL.jenjangLbl), "DEGREE LEVEL");
sama("Konsentrasi", sisiEn(EN_LBL.kons), "CONCENTRATION");
sama("Total Kredit", sisiEn(EN_LBL.totKredit), "Total Credits");
sama("Total Nilai", sisiEn(EN_LBL.totNilai), "Total Quality Points");
sama("Indeks Prestasi Kumulatif", sisiEn(EN_LBL.ipkLbl), "Cumulative Grade Point Average (GPA)");
sama("Predikat Kelulusan", sisiEn(EN_LBL.predLbl), "Graduation Honors");
sama("Judul Skripsi", sisiEn(EN_LBL.judul), "THESIS TITLE:");

// Bunyi yang dipakai sebelumnya dan terbukti keliru tidak boleh kembali.
const KELIRU = [
  "DEGREE CERTIFICATE NUMBER", "COMPLETE NAME", "STUDENT REGISTRATION NUMBER",
  "INSTITUTIONAL REGISTRATION NUMBER", "STUDY PROGRAM IDENTIFICATION NUMBER",
  "DEGREE CONFERRAL DATE", "Total Grade Points", "Total Credits Accomplished",
  "JENJANG/COURSE", "ACCREDITED",
];
const semuaLabel = Object.values(EN_LBL).flat().join(" | ");
for (const salah of KELIRU) {
  benar(`label lama "${salah}" tidak dipakai lagi`, !semuaLabel.includes(salah));
}

// Singkatan kolom pernah tergeser satu kolom: AM berlabel CR, K berlabel WM,
// M berlabel GP. Pasangannya harus lurus dengan arti kolomnya.
sama("kolom K = Credits", EN_LBL.th[3], "K|CR");
sama("kolom HM = Letter Grade", EN_LBL.th[4], "HM|LG");
sama("kolom AM = Grade Point", EN_LBL.th[5], "AM|GP");
sama("kolom M = Quality Points", EN_LBL.th[6], "M|QP");
benar("singkatan lama WM sudah tidak dipakai", !semuaLabel.includes("WM"));

// Satu lembar untuk kedua prodi: label yang sama persis, hanya isinya beda.
// Kalau suatu saat label dipecah per prodi, uji ini yang pertama gagal.
sama("label tidak bercabang per prodi", typeof labelTranskrip(true).nama, "string");
benar("lembar Indonesia memakai label yang seragam huruf besar",
  [ID_LBL.noij, ID_LBL.nppt, ID_LBL.yud, ID_LBL.akred, ID_LBL.nama, ID_LBL.nim,
    ID_LBL.ttl, ID_LBL.prodi, ID_LBL.npps, ID_LBL.fak, ID_LBL.jenjangLbl, ID_LBL.kons]
    .every((teks) => teks === teks.toUpperCase()),
  [ID_LBL.noij, ID_LBL.nppt, ID_LBL.fak].join(" / "));
sama("ejaan Ijazah, bukan Ijasah", ID_LBL.noij, "NOMOR IJAZAH NASIONAL");
benar("tidak ada lagi ejaan 'Ijasah' di label mana pun",
  !`${semuaLabel} ${Object.values(ID_LBL).flat().join(" ")}`.toLowerCase().includes("ijasah"));

console.log("\n=== SETIAP GARIS MIRING DIAPIT SPASI ===\n");

// "NAMA MAHASISWA / STUDENT NAME", bukan "NAMA MAHASISWA/STUDENT NAME".
// Berlaku juga untuk garis miring yang jatuh di ujung baris karena bagian
// Inggrisnya turun ke bawah — yang tercetak berbunyi "NAMA MAHASISWA /".
function miringRapat(teks: string): string[] {
  const salah: string[] = [];
  for (let i = 0; i < teks.length; i++) {
    if (teks[i] !== "/") continue;
    const sebelum = teks[i - 1];
    const sesudah = teks[i + 1];
    if (sebelum !== " ") salah.push(`"${teks}" (tidak ada spasi sebelum /)`);
    else if (sesudah !== undefined && sesudah !== " " && sesudah !== "|") {
      salah.push(`"${teks}" (tidak ada spasi sesudah /)`);
    }
  }
  return salah;
}

for (const [nama, kamus] of [["Inggris", EN_LBL], ["Indonesia", ID_LBL]] as const) {
  const rapat = Object.values(kamus).flat().flatMap((teks) => miringRapat(String(teks)));
  benar(`label ${nama}: setiap garis miring diapit spasi`, rapat.length === 0, rapat.join(" | "));
}
sama("contoh yang diminta", sisiEn(EN_LBL.nama), "STUDENT NAME");
sama("dan sisi Indonesianya berakhir dengan spasi-garis miring",
  EN_LBL.nama.split("|")[0], "NAMA MAHASISWA /");
// Nilai yang ikut tercetak, bukan label, harus ikut aturan yang sama.
benar("jenjang bawaan diapit spasi", miringRapat("SARJANA / BACHELOR DEGREE (S-1)").length === 0);

console.log("\n=== AKREDITASI: PERINGKAT DI BARIS ATAS ===\n");

// Transkrip KUI mencetak peringkatnya sendirian, nomor SK-nya di bawah.
sama("UNGGUL dipenggal dari nomor SK",
  pecahAkreditasi("UNGGUL LAMSPAK Nomor 156/AK.03.05/2026").join(" ¶ "),
  "UNGGUL ¶ LAMSPAK Nomor 156/AK.03.05/2026");
sama("tanda kutip dari berkas KUI ikut dibuang",
  pecahAkreditasi('"UNGGUL" LAMSPAK Nomor 156/AK.03.05/2026')[0], "UNGGUL");
sama("nomor SK tidak ikut dirapikan spasinya",
  pecahAkreditasi("UNGGUL LAMSPAK Nomor 156/AK.03.05/2026")[1],
  "LAMSPAK Nomor 156/AK.03.05/2026");
sama("bentuk BAN-PT dari base SIMAK",
  pecahAkreditasi("TERAKREDITASI SK BAN-PT Nomor : 5435/SK/BAN-PT/Ak.KP/S/VIII/2024").join(" ¶ "),
  "TERAKREDITASI ¶ SK BAN-PT Nomor : 5435/SK/BAN-PT/Ak.KP/S/VIII/2024");
sama("admin dapat memaksa penggalannya dengan |",
  pecahAkreditasi("BAIK SEKALI|Nomor 123/ABC").join(" ¶ "), "BAIK SEKALI ¶ Nomor 123/ABC");
// Isian yang HANYA memuat nomor SK — bentuk kiriman SIMAK — tetap tercetak
// berperingkat: "UNGGUL" dipasang sendiri di baris atas. Admin tidak pernah
// diminta mengetikkannya lagi.
sama("tanpa peringkat pun UNGGUL tetap tercetak di baris atas",
  pecahAkreditasi("LAMSPAK Nomor 099/AK.03.05/2026").join(" ¶ "),
  "UNGGUL ¶ LAMSPAK Nomor 099/AK.03.05/2026");
sama("bentuk SK BAN-PT tanpa peringkat ikut ditempeli",
  pecahAkreditasi("SK BAN-PT Nomor : 5435/SK/BAN-PT/Ak.KP/S/VIII/2024").join(" ¶ "),
  "UNGGUL ¶ SK BAN-PT Nomor : 5435/SK/BAN-PT/Ak.KP/S/VIII/2024");
sama("isian kosong tidak menghasilkan apa-apa", pecahAkreditasi("").join(" ¶ "), " ¶ ");
sama("spasi berlebih dirapikan", pecahAkreditasi("  UNGGUL   LAMSPAK  Nomor 1 ").join(" ¶ "),
  "UNGGUL ¶ LAMSPAK Nomor 1");
// Isian tanpa rujukan SK sama sekali tetap utuh satu baris: peringkat yang
// ditulis sendirian bukan nomor yang kehilangan peringkatnya.
sama("peringkat sendirian tetap satu baris",
  pecahAkreditasi("BAIK SEKALI").join(" ¶ "), "BAIK SEKALI ¶ ");
// "|" adalah satu-satunya jalan keluar: kalau admin sengaja mengosongkan
// peringkatnya, UNGGUL tidak boleh ikut dipasang.
sama("peringkat kosong yang dipaksa admin dihormati",
  pecahAkreditasi("|LAMSPAK Nomor 1").join(" ¶ "), " ¶ LAMSPAK Nomor 1");

// Yang DISIMPAN — kolom Akreditasi di layar dan isian yang diarsipkan —
// berbunyi sama dengan yang tercetak.
sama("isian SIMAK dilengkapi peringkatnya",
  lengkapiAkreditasi("LAMSPAK Nomor 099/AK.03.05/2026"),
  "UNGGUL LAMSPAK Nomor 099/AK.03.05/2026");
sama("yang sudah berperingkat tidak ditempeli dua kali",
  lengkapiAkreditasi("UNGGUL LAMSPAK Nomor 156/AK.03.05/2026"),
  "UNGGUL LAMSPAK Nomor 156/AK.03.05/2026");
sama("tanda kutip berkas KUI ikut dibuang saat disimpan",
  lengkapiAkreditasi('"UNGGUL" LAMSPAK Nomor 156/AK.03.05/2026'),
  "UNGGUL LAMSPAK Nomor 156/AK.03.05/2026");
sama("peringkat lain tidak diganti UNGGUL",
  lengkapiAkreditasi("BAIK SEKALI LAMSPAK Nomor 1"), "BAIK SEKALI LAMSPAK Nomor 1");
sama("penggalan paksa admin tidak ikut diutak-atik",
  lengkapiAkreditasi("BAIK SEKALI|Nomor 123/ABC"), "BAIK SEKALI|Nomor 123/ABC");
sama("isian kosong tetap kosong", lengkapiAkreditasi(""), "");

console.log("\n=== SAKLAR REKTOR ===\n");

benar("bawaan: dua tanda tangan", pakaiRektorDari("dekan-rektor"));
benar("\"dekan\" mematikan kolom rektor", !pakaiRektorDari("dekan"));
benar("huruf besar tetap dikenali", !pakaiRektorDari("DEKAN"));
benar("spasi berlebih tetap dikenali", !pakaiRektorDari("  dekan  "));
// Draf dan arsip yang dibuat sebelum saklarnya ada tidak menyebut `ttd`
// sama sekali. Yang seperti itu harus tetap tercetak seperti sedia kala,
// bukan tiba-tiba kehilangan tanda tangan Rektor.
benar("isian lama tanpa saklar tetap dua tanda tangan", pakaiRektorDari(undefined));
benar("isian kosong pun tetap dua tanda tangan", pakaiRektorDari(""));


console.log("\n=== LABEL SEBARIS vs BERTINGKAT ===\n");

// Acuannya transkrip KUI yang sudah tercetak: label pendek sebaris dengan
// pasangan Inggrisnya, label panjang dipatahkan. Dikunci di sini karena
// pilihan yang tersebar di dua puluh baris JSX tidak dapat diperiksa mata.
benar("TERAKREDITASI sebaris dengan ACCREDITATION", labelSebaris("akred"));
benar("FAKULTAS sebaris", labelSebaris("fak"));
benar("JENJANG sebaris", labelSebaris("jenjangLbl"));
benar("KONSENTRASI sebaris", labelSebaris("kons"));
// Label biodata menyambung dengan pasangan Inggrisnya, tidak lagi dipatahkan
// ke baris bawah: "NAMA MAHASISWA / STUDENT NAME" pada satu baris.
benar("NAMA MAHASISWA menyambung dengan STUDENT NAME", labelSebaris("nama"));
benar("NOMOR INDUK MAHASISWA menyambung dengan STUDENT IDENTIFICATION NUMBER",
  labelSebaris("nim"));
benar("TEMPAT, TGL LAHIR menyambung dengan PLACE, DATE OF BIRTH", labelSebaris("ttl"));
benar("PROGRAM STUDI menyambung dengan STUDY PROGRAM", labelSebaris("prodi"));
// Yang tersisa bertingkat hanyalah label nomor: pasangan Inggrisnya terlalu
// panjang dan akan mendorong kolom nilainya ke kanan.
for (const kunci of ["noij", "nppt", "yud", "npps"]) {
  benar(`${kunci} tetap bertingkat`, !labelSebaris(kunci));
}
// Tidak boleh ada label yang lupa didaftar, dan tidak boleh ada yang masuk
// dua daftar sekaligus — keduanya berakhir sebagai tata letak yang diam-diam
// ikut selera komponennya lagi.
const KUNCI_LABEL = [...LABEL_SEBARIS, ...LABEL_BERTINGKAT];
sama("tidak ada label yang masuk dua daftar", new Set(KUNCI_LABEL).size, KUNCI_LABEL.length);
benar("setiap label yang didaftar memang ada pada kamus label",
  KUNCI_LABEL.every((kunci) => typeof (EN_LBL as Record<string, unknown>)[kunci] === "string"),
  KUNCI_LABEL.filter((kunci) => typeof (EN_LBL as Record<string, unknown>)[kunci] !== "string").join(", "));
// Label yang tercetak di blok atas & biodata, seluruhnya, harus terdaftar.
const LABEL_DICETAK = ["noij", "nppt", "yud", "akred", "nama", "fak", "nim", "jenjangLbl", "ttl", "kons", "prodi", "npps"];
benar("seluruh label biodata sudah dipilah sebaris/bertingkat",
  LABEL_DICETAK.every((kunci) => KUNCI_LABEL.includes(kunci as never)),
  LABEL_DICETAK.filter((kunci) => !KUNCI_LABEL.includes(kunci as never)).join(", "));

console.log("\n=== UNGGUL TERTULIS LANGSUNG DI TEMPLATE ===\n");

// Template unduhan adalah yang disalin admin apa adanya. Kalau peringkatnya
// tidak tertulis di situ, setiap transkrip menuntut koreksi tangan yang sama.
const akredTemplate = TEMPLATE_BIO_ROWS.find(([label]) => /akredit/i.test(label))?.[1] || "";
sama("template memuat peringkat UNGGUL apa adanya, tanpa tanda kutip",
  akredTemplate, "UNGGUL LAMSPAK Nomor 156/AK.03.05/2026");
sama("dan terpenggal benar saat dicetak",
  pecahAkreditasi(akredTemplate).join(" ¶ "), "UNGGUL ¶ LAMSPAK Nomor 156/AK.03.05/2026");
// Template unduhan dan lembar kosong di layar membaca tetapan yang SAMA:
// nomor SK yang berganti di satu tempat tidak boleh tertinggal di tempat lain.
sama("template memakai tetapan bawaan yang sama", akredTemplate, AKREDITASI_BAWAAN);
benar("tetapan bawaan dibuka peringkatnya", AKREDITASI_BAWAAN.startsWith(PERINGKAT_AKREDITASI));
benar("konsentrasi contoh pada template termasuk yang dikenali kamus",
  Boolean(lingkupUtama({ prodi: "Ilmu Komunikasi", konsentrasi: TEMPLATE_BIO_ROWS.find(([l]) => /^konsentrasi/i.test(l))?.[1] })));

console.log("\n=== KONSENTRASI TERBACA DARI MATA KULIAHNYA ===\n");

// Nama konsentrasi yang ditulis ke biodata harus sama persis dengan daftar
// yang ditawarkan formulir — kalau berselisih, yang ditebak mesin tidak akan
// cocok dengan pilihan mana pun di layar.
sama("nama konsentrasi sama dengan daftar prodi",
  Object.values(NAMA_KONSENTRASI).slice().sort().join(", "),
  concentrationsFor("Ilmu Komunikasi").slice().sort().join(", "));

const BERKAS_KONSENTRASI: Array<[string, string, string]> = [
  ["advertising", "Advertising", LINGKUP_ILKOM_ADV],
  ["broadcasting", "Broadcasting", LINGKUP_ILKOM_BC],
  ["public-relations", "Public Relations", LINGKUP_ILKOM_PR],
];
for (const [berkas, nama, lingkup] of BERKAS_KONSENTRASI) {
  const lembar = JSON.parse(readFileSync(`./uji-berkas-contoh/transkrip-ilkom-${berkas}.json`, "utf8")) as Aoa;
  const baris = parseSheetRows(lembar);
  const tebakan = tebakKonsentrasi(baris, "Ilmu Komunikasi");
  sama(`${nama}: terbaca dari berkas KUI`, tebakan.konsentrasi, nama);
  sama(`${nama}: lingkup kamusnya ikut benar`, tebakan.lingkup, lingkup);
  benar(`${nama}: buktinya ikut disebut`, tebakan.bukti.length > 0);
  // Base SIMAK mentah tidak membawa kolom Inggris sama sekali.
  sama(`${nama}: tetap terbaca tanpa kolom Inggris`,
    tebakKonsentrasi(baris.map((r) => ({ ...r, en: "" })), "ILMU KOMUNIKASI").konsentrasi, nama);
  // Berkas yang kodenya berganti kurikulum: namanya saja harus cukup.
  sama(`${nama}: tetap terbaca tanpa kode mata kuliah`,
    tebakKonsentrasi(baris.map((r) => ({ ...r, kode: "" })), "Ilmu Komunikasi").konsentrasi, nama);
}

// Contoh yang diminta Admin Akademik, dengan nama Inggrisnya saja.
const dariNama = (...nama: string[]) =>
  tebakKonsentrasi(nama.map((n) => ({ kode: "", nama: n, en: "" })), "Ilmu Komunikasi").konsentrasi;
sama("Advertising Management + Advertising Research", dariNama("Advertising Management", "Advertising Research"), "Advertising");
sama("Radio Broadcast Production + Camera Techniques", dariNama("Radio Broadcast Production", "Camera Techniques"), "Broadcasting");
sama("Cyber Public Relations + Public Relations Campaign Strategy",
  dariNama("Cyber Public Relations", "Public Relations Campaign Strategy"), "Public Relations");
// Padanan Indonesianya harus sama kuat.
sama("Riset Iklan + Managemen Periklanan", dariNama("Riset Iklan", "Managemen Periklanan"), "Advertising");
sama("Produksi Siaran Radio + Teknik Kamera", dariNama("Produksi Siaran Radio", "Teknik Kamera"), "Broadcasting");
sama("Penulisan Naskah Kehumasan + Protokoler", dariNama("Penulisan Naskah Kehumasan", "Protokoler"), "Public Relations");

// Mata kuliah INTI diambil KETIGA konsentrasi. Memakainya sebagai tanda
// membuat setiap mahasiswa terbaca Advertising sekaligus Public Relations.
sama("mata kuliah inti tidak menjadi tanda",
  dariNama("Dasar Dasar Periklanan", "Dasar Dasar Public Relations"), "");
// Satu mata kuliah yang HANYA ada di satu konsentrasi sudah menyimpulkan:
// tidak ada mahasiswa Broadcasting yang mengambil "Riset Iklan".
sama("satu mata kuliah khas sudah cukup", dariNama("Riset Iklan"), "Advertising");
// Sebaliknya, satu kata kunci pada mata kuliah yang tidak dikenal kamus mana
// pun BELUM cukup — kurikulum baru dapat menaruh kata itu di mana saja.
sama("satu kata kunci saja belum cukup", dariNama("Manajemen Iklan Digital"), "");
sama("tanda yang terbagi rata tidak ditebak",
  dariNama("Riset Iklan", "Managemen Periklanan", "Teknik Kamera", "Produksi Siaran Radio"), "");
sama("daftar kosong tidak ditebak", tebakKonsentrasi([], "Ilmu Komunikasi").konsentrasi, "");

// MKPB-051 di Ilmu Pemerintahan adalah PKL, bukan Produksi Feature TV.
// Menebak lintas prodi persis melahirkan kembali kekeliruan yang memaksa
// kamus ini dipecah.
sama("Ilmu Pemerintahan tidak pernah ditebak konsentrasinya",
  tebakKonsentrasi(rows, "Ilmu Pemerintahan").konsentrasi, "");
sama("prodi kosong pun tidak ditebak", tebakKonsentrasi(rows, "").konsentrasi, "");

console.log("\n=== ISTILAH INGGRIS PADA JUDUL SKRIPSI DICETAK MIRING ===\n");

const dicetak = (judul: string) =>
  penggalJudulInggris(judul).map((p) => (p.miring ? `<i>${p.teks}</i>` : p.teks)).join("");

// ---------- lapis 1: ungkapan yang terdaftar ----------
sama("brand awareness dimiringkan utuh, bukan sepotong",
  dicetak("Pengaruh Brand Awareness terhadap Minat Beli"),
  "Pengaruh <i>Brand Awareness</i> terhadap Minat Beli");
sama("ungkapan panjang menang atas kata pendek di dalamnya",
  dicetak("Peran Cyber Public Relations dalam Membangun Citra"),
  "Peran <i>Cyber Public Relations</i> dalam Membangun Citra");
// Dua istilah yang hanya dipisahkan spasi dicetak sebagai SATU penggal
// miring: satu istilah asing, bukan dua potongan miring yang berjajar.
sama("istilah bertetangga menjadi satu penggal miring",
  dicetak("Analisis Personal Branding Content Creator di TikTok"),
  "Analisis <i>Personal Branding Content Creator</i> di TikTok");
// Ungkapan menang atas daftar kata serapan: yang miring di sini istilah
// asingnya, bukan kata "digital" yang sudah baku.
sama("ungkapan yang memuat kata serapan tetap miring seutuhnya",
  dicetak("Pengaruh Digital Marketing terhadap Loyalitas Pelanggan"),
  "Pengaruh <i>Digital Marketing</i> terhadap Loyalitas Pelanggan");

// ---------- lapis 2: kata Inggris yang berdiri sendiri ----------
//
// Inilah yang dulu tertinggal tegak: satu judul yang setengah miring
// setengah tegak lebih buruk daripada tidak dimiringkan sama sekali.
sama("kata Inggris tunggal ikut miring",
  dicetak("Pengaruh Engagement dan Insight terhadap Keputusan Pembelian"),
  "Pengaruh <i>Engagement</i> dan <i>Insight</i> terhadap Keputusan Pembelian");
sama("kata yang belum masuk ungkapan pun miring",
  dicetak("Fenomena Flexing dan Hoax pada Media Sosial"),
  "Fenomena <i>Flexing</i> dan <i>Hoax</i> pada Media Sosial");
sama("bentuk jamak tidak perlu didaftar dua kali",
  dicetak("Peran Influencers dan Followers dalam Pemasaran Daerah"),
  "Peran <i>Influencers</i> dan <i>Followers</i> dalam Pemasaran Daerah");

// ---------- lapis 3: akhiran yang mustahil dalam ejaan Indonesia ----------
//
// Bahasa Indonesia menuliskannya -si, -men, -tas, -if, -abel. Kata yang
// masih berakhiran bentuk Inggrisnya pasti belum diserap.
for (const kata of [
  "Sustainability", "Responsiveness", "Trustworthiness", "Entrepreneurship",
  "Readiness", "Attractiveness", "Creativity", "Continuity", "Photography",
  "Psychology", "Statehood", "Comparative",
]) {
  const judul = `Analisis ${kata} Pemerintah Desa`;
  sama(`akhiran Inggris "${kata}" dikenali tanpa didaftar`,
    dicetak(judul), `Analisis <i>${kata}</i> Pemerintah Desa`);
}
// Sebaliknya: bentuk Indonesianya TIDAK boleh ikut terbawa.
for (const kata of [
  "Efektivitas", "Produktivitas", "Aktivitas", "Identitas", "Dokumen",
  "Komitmen", "Argumen", "Instrumen", "Nasionalisme", "Efektif",
  "Variabel", "Reliabel", "Klasifikasi", "Implementasi", "Strategis",
]) {
  const judul = `Analisis ${kata} Pemerintah Desa`;
  sama(`bentuk Indonesia "${kata}" tetap tegak`, dicetak(judul), judul);
}

// ---------- kata serapan baku ditulis tegak ----------
//
// Memiringkannya sama kelirunya dengan membiarkan istilah asing tegak.
for (const kata of [
  "Media", "Publik", "Digital", "Televisi", "Strategi", "Komunikasi",
  "Program", "Produksi", "Massa", "Status", "Target", "Level", "Modern",
  "Internal", "Gender", "Mental", "Agenda", "Sistem", "Bisnis", "Isu",
  "Opini", "Data", "Platform", "Konten", "Viral", "Aplikasi",
]) {
  const judul = `Peran ${kata} dalam Pembangunan Daerah`;
  benar(`kata serapan "${kata}" tetap tegak`, dicetak(judul) === judul, dicetak(judul));
}

// ---------- nama diri tidak pernah dimiringkan ----------
for (const nama of [
  "TikTok", "Instagram", "YouTube", "WhatsApp", "Shopee", "Netflix",
  "Gojek", "Traveloka", "Google", "Canva", "Tokopedia", "Muhammadiyah",
]) {
  const judul = `Analisis Konten ${nama} di Kalangan Remaja`;
  benar(`nama diri "${nama}" tetap tegak`, dicetak(judul) === judul, dicetak(judul));
}

benar("judul tanpa istilah asing tidak disentuh sama sekali",
  dicetak("Upaya Meminimalisir Angka Putus Sekolah di SMKN Kota Tangerang") ===
    "Upaya Meminimalisir Angka Putus Sekolah di SMKN Kota Tangerang");

// ---------- kata tugas Inggris ----------
//
// Ikut miring HANYA kalau terjepit istilah Inggris di kedua sisinya.
sama("kata tugas yang terjepit ikut miring",
  dicetak("Analisis Freedom of Speech dalam Pemberitaan Daerah"),
  "Analisis <i>Freedom of Speech</i> dalam Pemberitaan Daerah");
sama("kata tugas yang bertetangga sebelah saja tetap tegak",
  dicetak("Peran Insight on Instagram bagi Pelaku Usaha"),
  "Peran <i>Insight</i> on Instagram bagi Pelaku Usaha");
// Tanpa rem itu, singkatan Indonesia ikut tercetak miring.
benar("singkatan Indonesia tidak tersentuh",
  dicetak("Peran Divisi IT dalam Pengelolaan Data Kelurahan") ===
    "Peran Divisi IT dalam Pengelolaan Data Kelurahan");

// ---------- tanda bintang admin menang penuh ----------
sama("admin dapat memaksa istilah yang belum terdaftar",
  dicetak("Pengaruh *Brand Ambassador* terhadap Minat Beli"),
  "Pengaruh <i>Brand Ambassador</i> terhadap Minat Beli");
sama("sejak satu bintang dipakai, daftar tidak ikut bekerja",
  dicetak("Pengaruh *Brand Ambassador* terhadap Brand Awareness"),
  "Pengaruh <i>Brand Ambassador</i> terhadap Brand Awareness");
sama("tanda bintangnya sendiri tidak ikut tercetak",
  penggalJudulInggris("Pengaruh *Brand Ambassador* terhadap Minat Beli").map((p) => p.teks).join(""),
  "Pengaruh Brand Ambassador terhadap Minat Beli");
// Sepasang bintang kosong = "jangan miringkan apa pun", dan ia tidak
// meninggalkan lubang di tempatnya berdiri.
sama("sepasang bintang kosong mematikan seluruh daftar",
  dicetak("Pengaruh ** Brand Awareness terhadap Minat Beli"),
  "Pengaruh Brand Awareness terhadap Minat Beli");
sama("bintang kosong di ujung judul ikut hilang",
  dicetak("Pengaruh Brand Awareness terhadap Minat Beli**"),
  "Pengaruh Brand Awareness terhadap Minat Beli");
sama("bintang kosong tanpa spasi tidak melekatkan dua kata",
  dicetak("Pengaruh Brand Awareness** terhadap Minat Beli"),
  "Pengaruh Brand Awareness terhadap Minat Beli");

// Judul transkrip berbahasa Inggris seluruhnya TIDAK dimiringkan: memiringkan
// seluruh kalimat bukan lagi penanda istilah asing.
benar("judul yang seluruhnya Inggris dibiarkan tegak",
  penggalJudulInggris("The Influence of Social Media Marketing on Purchase Intention")
    .every((p) => !p.miring));
benar("judul Indonesia dikenali sebagai Indonesia",
  judulBerbahasaIndonesia("Pengaruh Brand Awareness terhadap Minat Beli"));
benar("judul Inggris tidak dikenali sebagai Indonesia",
  !judulBerbahasaIndonesia("The Influence of Social Media on Purchase Intention"));
sama("judul kosong tidak menghasilkan penggalan apa pun", penggalJudulInggris("").length, 0);
sama("judul berisi spasi saja pun kosong", penggalJudulInggris("   ").length, 0);
// Seluruh huruf judul harus utuh: satu huruf yang hilang ikut dicetak dan
// ikut dilegalisir.
for (const judul of [
  "Pengaruh Brand Awareness terhadap Minat Beli Konsumen pada Media Sosial",
  "Analisis Personal Branding Content Creator di TikTok",
  "Upaya Meminimalisir Angka Putus Sekolah di SMKN Kota Tangerang",
  "Strategi Komunikasi Pemerintah Kota Tangerang dalam Sosialisasi Program Smart City",
  "Pengaruh Body Shaming dan Cyberbullying terhadap Self Esteem Remaja (Studi Kasus SMAN 1)",
  "Peran Humas dalam Meningkatkan Public Awareness tentang Hoax dan Fake News",
]) {
  sama(`judul utuh: "${judul.slice(0, 28)}…"`,
    penggalJudulInggris(judul).map((p) => p.teks).join(""), judul);
}
// Tanda baca memutus istilah: yang di seberang koma bukan lagi satu istilah.
benar("koma tidak menyambung dua penggal miring",
  dicetak("Peran Insight, Engagement, dan Reach dalam Pemasaran").includes("</i>,"));

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
