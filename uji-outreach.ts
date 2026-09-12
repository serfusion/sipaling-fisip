// UJI OUTREACH ULTRAMAILER SYSTEM (OUS)
//
// Yang diuji di sini adalah aturan yang menentukan SIAPA menerima APA, dan
// berapa banyak dalam sehari. Kekeliruan pada aturan semacam ini tidak
// berhenti di layar: ia berujung pada surat yang terkirim kepada orang yang
// sudah meminta berhenti, atau pada tiga ratus surat yang keluar sekaligus
// dari domain yang belum pernah mengirim apa-apa.
//
// Karena itu tabel kebenarannya diperiksa SELURUHNYA — semua peran, dua
// keadaan saklar — bukan sekadar satu-dua contoh.
//
//   npx tsx uji-outreach.ts

import {
  ALASAN_CEKAL_LABEL,
  BATAS,
  DEFAULT_OUS,
  STATUS_KAMPANYE_LABEL,
  STATUS_PENERIMA_LABEL,
  bolehAturOus,
  bolehLihatOus,
  bolehPakaiOus,
  buatToken,
  cekalDariPeristiwa,
  domainEmail,
  emailSah,
  gabungNaskah,
  galatSementara,
  hariPemanasan,
  izinKirim,
  jamWib,
  jatahHariIni,
  jatahPemanasan,
  jedaBerikutnya,
  jedaCobaUlang,
  keTeksBiasa,
  kodeKampanye,
  lolosHtml,
  normalkanOus,
  parseOus,
  periksaNada,
  perkiraanHari,
  peubahDipakai,
  pitaNada,
  rapikanEmail,
  ringkasanKampanye,
  samarkanEmail,
  saringPenerima,
  statusDariPeristiwa,
  tautanBerhenti,
  uraiCsv,
  uraiTempelan,
  type OusState,
} from "./src/lib/outreach";
import { KAKI_WAJIB, TEMPLATE_BAWAAN, pastikanKakiBerhenti, rangkaEmail } from "./src/lib/outreach-template";
import { periksaKesiapan, rakitSurat } from "./src/lib/outreach-kirim";

let lulus = 0;
const gagal: string[] = [];

function benar(nama: string, syarat: boolean) {
  if (syarat) lulus += 1;
  else gagal.push(nama);
}

function sama(nama: string, dapat: unknown, harap: unknown) {
  benar(`${nama} (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`, dapat === harap);
}

// ============================================================
// 1. ALAMAT EMAIL
// ============================================================

sama("huruf besar jadi kecil", rapikanEmail("JOHN@UNIVERSITY.EDU"), "john@university.edu");
sama("spasi dibuang", rapikanEmail("  john@university.edu  "), "john@university.edu");
sama("kurung sudut dibuang", rapikanEmail("John Smith <john@university.edu>"), "john@university.edu");
sama("tanda kutip pada nama", rapikanEmail('"Jane Lee" <jane@university.edu>'), "jane@university.edu");
sama("mailto: dibuang", rapikanEmail("mailto:john@university.edu"), "john@university.edu");
sama("koma di ekor dibuang", rapikanEmail("john@university.edu,"), "john@university.edu");
sama("titik koma di ekor dibuang", rapikanEmail("john@university.edu;"), "john@university.edu");
sama("subdomain diterima", rapikanEmail("a@mail.fisip.umt.ac.id"), "a@mail.fisip.umt.ac.id");
sama("tanda plus diterima", rapikanEmail("john+cfp@university.edu"), "john+cfp@university.edu");

sama("tanpa @ ditolak", rapikanEmail("john.university.edu"), "");
sama("tanpa domain ditolak", rapikanEmail("john@"), "");
sama("tanpa nama ditolak", rapikanEmail("@university.edu"), "");
sama("tanpa TLD ditolak", rapikanEmail("john@university"), "");
sama("titik ganda ditolak", rapikanEmail("john..smith@university.edu"), "");
sama("spasi di tengah ditolak", rapikanEmail("john smith@university.edu"), "");
sama("bukan string ditolak", rapikanEmail(12345), "");
sama("null ditolak", rapikanEmail(null), "");
sama("kosong ditolak", rapikanEmail(""), "");
// Batas RFC 5321. Alamat yang lebih panjang ditolak server penerima, dan
// pantulannya ikut menggerus reputasi domain — jadi ditahan di sini.
sama("bagian lokal 65 huruf ditolak", rapikanEmail(`${"a".repeat(65)}@x.edu`), "");
sama("bagian lokal 64 huruf diterima", rapikanEmail(`${"a".repeat(64)}@x.edu`), `${"a".repeat(64)}@x.edu`);
sama("alamat 255 huruf ditolak", rapikanEmail(`${"a".repeat(60)}@${"b".repeat(190)}.edu`), "");

sama("emailSah sepakat dengan rapikanEmail", emailSah("John <john@x.edu>"), true);
sama("emailSah menolak yang rusak", emailSah("john@@x.edu"), false);
sama("domainEmail", domainEmail("John <JOHN@University.EDU>"), "university.edu");
sama("domainEmail pada alamat rusak", domainEmail("bukan email"), "");
sama("samarkanEmail", samarkanEmail("john.smith@university.edu"), "jo•••••••@university.edu");
benar("samarkanEmail tidak membocorkan nama penuh", !samarkanEmail("john.smith@university.edu").includes("smith"));

// ============================================================
// 2. PEMBACA DAFTAR
// ============================================================

const tempel = uraiTempelan(`
john@university.edu
John Smith <john.smith@university.edu>
jane@a.edu, bob@b.edu; carol@c.edu
baris rusak tanpa alamat
`);
sama("tempelan membaca lima alamat", tempel.penerima.length, 5);
sama("tempelan menahan baris rusak", tempel.tidakSah.length, 1);
sama("nama ikut terbaca", tempel.penerima[1].name, "John Smith");
sama("alamat polos tanpa nama", tempel.penerima[0].name, null);
benar("baris rusak dikembalikan apa adanya", tempel.tidakSah[0].includes("baris rusak"));

const csv = uraiCsv(`name,email,institution,field,country
John Smith,john@abc.edu,ABC University,Digital Media,Malaysia
Jane Lee,jane@xyz.edu,XYZ University,Journalism,Singapore`);
sama("CSV membaca dua baris", csv.penerima.length, 2);
sama("CSV membaca institusi", csv.penerima[0].institution, "ABC University");
sama("CSV membaca bidang", csv.penerima[1].field, "Journalism");
sama("CSV membaca negara", csv.penerima[0].country, "Malaysia");

// Berkas tanpa judul kolom: baris pertama TIDAK boleh ikut hilang.
const csvTanpaJudul = uraiCsv("john@abc.edu\njane@xyz.edu");
sama("CSV tanpa judul tetap utuh", csvTanpaJudul.penerima.length, 2);
sama("alamat pertama tidak hilang", csvTanpaJudul.penerima[0].email, "john@abc.edu");

const csvTitikKoma = uraiCsv("email;name\njohn@abc.edu;John");
sama("CSV titik koma terbaca", csvTitikKoma.penerima.length, 1);
sama("CSV titik koma membaca nama", csvTitikKoma.penerima[0].name, "John");

const csvKutip = uraiCsv('name,email\n"Lee, Jane",jane@xyz.edu');
sama("koma di dalam tanda kutip tidak memecah kolom", csvKutip.penerima[0].name, "Lee, Jane");

sama("kolom nama dalam Bahasa Indonesia dikenali", uraiCsv("nama,email\nBudi,budi@x.edu").penerima[0].name, "Budi");

// ============================================================
// 3. PENYARINGAN
// ============================================================

const saring = saringPenerima(
  [
    { email: "a@x.edu", name: null, institution: null, field: null, country: null },
    { email: "A@X.edu", name: "Anna", institution: "Kampus A", field: null, country: null },
    { email: "b@y.edu", name: null, institution: null, field: null, country: null },
    { email: "cekal@z.edu", name: null, institution: null, field: null, country: null },
  ],
  ["rusak sekali"],
  ["CEKAL@z.edu"],
);
sama("duplikat lintas huruf besar/kecil terdeteksi", saring.duplikat.length, 1);
sama("yang tersisa dua alamat", saring.valid.length, 2);
sama("alamat tercekal dilewati", saring.tercekal.length, 1);
sama("baris rusak ikut terhitung", saring.tidakSah.length, 1);
sama("total = mentah + rusak", saring.total, 5);

// Baris kedua sering justru yang membawa nama dan institusinya.
const anna = saring.valid.find((item) => item.email === "a@x.edu");
sama("nama dari baris kedua terpakai", anna?.name, "Anna");
sama("institusi dari baris kedua terpakai", anna?.institution, "Kampus A");

// Angka di layar harus dapat dijumlahkan kembali menjadi totalnya.
sama(
  "valid + duplikat + rusak + tercekal = total",
  saring.valid.length + saring.duplikat.length + saring.tidakSah.length + saring.tercekal.length,
  saring.total,
);

// Alamat yang tercekal DAN ditempel dua kali dihitung sekali sebagai tercekal.
const gandaCekal = saringPenerima(
  [
    { email: "c@z.edu", name: null, institution: null, field: null, country: null },
    { email: "c@z.edu", name: null, institution: null, field: null, country: null },
  ],
  [],
  ["c@z.edu"],
);
sama("tercekal ganda dihitung sekali", gandaCekal.tercekal.length, 1);
sama("tercekal ganda tidak jadi duplikat", gandaCekal.duplikat.length, 0);

// ============================================================
// 4. MAIL MERGE
// ============================================================

sama("peubah terisi", gabungNaskah("Dear {{name}},", { name: "John Smith" }), "Dear John Smith,");
sama("peubah kosong memakai bawaan", gabungNaskah("Dear {{name}},", {}), "Dear Researcher,");
sama("peubah null memakai bawaan", gabungNaskah("Dear {{name}},", { name: null }), "Dear Researcher,");
sama("spasi kosong dianggap kosong", gabungNaskah("Dear {{name}},", { name: "   " }), "Dear Researcher,");
sama("cadangan di naskah dipakai", gabungNaskah("at {{institution|your lab}}", {}), "at your lab");
sama("data mengalahkan cadangan", gabungNaskah("at {{institution|your lab}}", { institution: "MIT" }), "at MIT");
sama("bawaan institusi", gabungNaskah("at {{institution}}", {}), "at your institution");
sama("peubah tak dikenal jadi kosong", gabungNaskah("x{{entah}}y", {}), "xy");
sama("spasi di dalam kurung", gabungNaskah("Dear {{ name }},", { name: "Ana" }), "Dear Ana,");
sama("huruf besar pada nama peubah", gabungNaskah("Dear {{NAME}},", { name: "Ana" }), "Dear Ana,");

// Nama penerima datang dari berkas CSV yang ditempel orang. Naskah HTML yang
// menyisipkannya mentah-mentah adalah lubang penyuntikan skrip yang kebetulan
// dikirimkan ke ratusan kotak masuk.
const jahat = gabungNaskah("<p>{{name}}</p>", { name: '<script>alert(1)</script>' }, true);
benar("nilai diloloskan pada mode HTML", !jahat.includes("<script>"));
benar("nilai diloloskan menjadi entitas", jahat.includes("&lt;script&gt;"));
sama("mode teks tidak meloloskan", gabungNaskah("{{name}}", { name: "A & B" }), "A & B");
sama("lolosHtml lengkap", lolosHtml(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");

const peubah = peubahDipakai("Dear {{name}}, from {{institution|x}} in {{name}}");
sama("peubah dipakai tidak berganda", peubah.length, 2);
benar("peubah dipakai memuat name", peubah.includes("name"));

sama("teks biasa membuang tag", keTeksBiasa("<p>Halo <b>dunia</b></p>"), "Halo dunia");
benar("tautan ikut tertulis alamatnya", keTeksBiasa('<a href="https://x.edu">Submit</a>').includes("https://x.edu"));
benar("skrip dibuang seluruhnya", !keTeksBiasa("<script>jahat()</script><p>a</p>").includes("jahat"));
sama("entitas dikembalikan", keTeksBiasa("<p>A &amp; B</p>"), "A & B");

// ============================================================
// 5. PEMERIKSA NADA
// ============================================================

const naskahBaik = TEMPLATE_BAWAAN[0];
const nadaBaik = periksaNada(naskahBaik.subjek, rangkaEmail(naskahBaik.bodyHtml, naskahBaik.subjek));
benar(`naskah bawaan tidak tertahan (skor ${nadaBaik.skor})`, !nadaBaik.tertahan);
benar("naskah bawaan berskor rendah", nadaBaik.skor <= 25);

for (const naskah of TEMPLATE_BAWAAN) {
  const nada = periksaNada(naskah.subjek, rangkaEmail(naskah.bodyHtml, naskah.subjek));
  benar(`naskah "${naskah.nama}" lolos pemeriksa nada`, !nada.tertahan);
  benar(`naskah "${naskah.nama}" memuat tautan berhenti`, naskah.bodyHtml.includes("{{unsubscribe_url}}"));
  benar(`naskah "${naskah.nama}" menyapa penerimanya`, naskah.bodyHtml.includes("{{name}}"));
}

// Tanpa tautan berhenti langganan, kampanye TIDAK boleh berjalan.
const tanpaBerhenti = periksaNada("Invitation to Submit Your Research", "<p>Dear {{name}}, halo sekali lagi.</p>");
benar("tanpa tautan berhenti tertahan", tanpaBerhenti.tertahan);
benar(
  "alasannya disebut",
  tanpaBerhenti.temuan.some((item) => item.pesan.includes("berhenti langganan")),
);

const berteriak = periksaNada("PUBLISH YOUR PAPER NOW!!!", `<p>x</p>${KAKI_WAJIB}`);
benar("subjek berteriak tertahan", berteriak.tertahan);
benar("skor subjek berteriak tinggi", berteriak.skor >= 40);

const pemendek = periksaNada("Invitation to submit your research", `<p><a href="https://bit.ly/abc">x</a></p>${KAKI_WAJIB}`);
benar("pemendek tautan tertahan", pemendek.tertahan);

const subjekKosong = periksaNada("", `<p>x</p>${KAKI_WAJIB}`);
benar("subjek kosong tertahan", subjekKosong.tertahan);

const reBohong = periksaNada("Re: your manuscript submission", `<p>Dear {{name}}</p>${KAKI_WAJIB}`);
benar(
  'subjek "Re:" palsu ditegur',
  reBohong.temuan.some((item) => item.pesan.includes("Re:")),
);
benar('subjek "Re:" palsu tidak menahan', !reBohong.tertahan);

sama("pita baik", pitaNada(0), "baik");
sama("pita sedang", pitaNada(30), "sedang");
sama("pita buruk", pitaNada(80), "buruk");
sama("skor dibatasi 100", periksaNada("URGENT!!! FREE MONEY GUARANTEED", "<p>x</p>").skor <= 100, true);

// ============================================================
// 6. JATAH HARIAN DAN PEMANASAN
// ============================================================

sama("pemanasan hari 1", jatahPemanasan(1), 20);
sama("pemanasan hari 2", jatahPemanasan(2), 20);
sama("pemanasan hari 3", jatahPemanasan(3), 30);
sama("pemanasan hari 5", jatahPemanasan(5), 40);
sama("pemanasan hari 7", jatahPemanasan(7), 50);
sama("pemanasan hari 10 penuh", jatahPemanasan(10), BATAS.hariMaks);

// Tabel pemanasan tidak boleh pernah turun.
let sebelumnya = 0;
let menaik = true;
for (let hari = 1; hari <= 14; hari++) {
  if (jatahPemanasan(hari) < sebelumnya) menaik = false;
  sebelumnya = jatahPemanasan(hari);
}
benar("tabel pemanasan tidak pernah turun", menaik);

const kini = new Date("2026-03-10T04:00:00Z"); // 11.00 WIB
sama("hari pemanasan tanpa tanggal mulai", hariPemanasan(null, kini), 1);
sama("hari pemanasan hari pertama", hariPemanasan("2026-03-10T01:00:00Z", kini), 1);
sama("hari pemanasan hari ketiga", hariPemanasan("2026-03-08T01:00:00Z", kini), 3);
sama("tanggal rusak dianggap hari pertama", hariPemanasan("bukan tanggal", kini), 1);

const dasar: OusState = { ...DEFAULT_OUS, enabled: true, hariMaks: 100, pemanasanMulai: "2026-03-08T01:00:00Z" };
sama("jatah hari ini ikut pemanasan", jatahHariIni(dasar, kini), 30);
sama("pemanasan mati memakai jatah penuh", jatahHariIni({ ...dasar, pemanasan: false }, kini), 100);
sama(
  "pemanasan tidak pernah melebihi jatah yang disetel",
  jatahHariIni({ ...dasar, hariMaks: 25 }, kini),
  25,
);

// ============================================================
// 7. JENDELA JAM DAN IZIN KIRIM
// ============================================================

sama("tengah malam UTC = 07.00 WIB", jamWib(new Date("2026-03-10T00:00:00Z")), 7);
sama("01.00 UTC = 08.00 WIB", jamWib(new Date("2026-03-10T01:00:00Z")), 8);
sama("melewati tengah malam", jamWib(new Date("2026-03-10T20:00:00Z")), 3);

const jalan: OusState = { ...DEFAULT_OUS, enabled: true, hariMaks: 60, jamMaks: 12, jedaDetik: 45, pemanasan: false };
const kosong = { hariIni: 0, jamIni: 0, sejakTerakhir: null };

sama("saklar mati menolak", izinKirim({ ...jalan, enabled: false }, kosong, kini).boleh, false);
benar(
  "alasan saklar mati disebut",
  izinKirim({ ...jalan, enabled: false }, kosong, kini).alasan.includes("dimatikan"),
);

sama("di dalam jam kirim boleh", izinKirim(jalan, kosong, kini).boleh, true);
sama("subuh ditolak", izinKirim(jalan, kosong, new Date("2026-03-09T22:00:00Z")).boleh, false);
sama("malam ditolak", izinKirim(jalan, kosong, new Date("2026-03-10T12:00:00Z")).boleh, false);
benar(
  "alasan di luar jam menyebut jamnya",
  izinKirim(jalan, kosong, new Date("2026-03-10T12:00:00Z")).alasan.includes("jam kirim"),
);

sama("jatah harian habis menolak", izinKirim(jalan, { hariIni: 60, jamIni: 0, sejakTerakhir: null }, kini).boleh, false);
sama("jatah jam habis menolak", izinKirim(jalan, { hariIni: 5, jamIni: 12, sejakTerakhir: null }, kini).boleh, false);
sama("jeda belum lewat menolak", izinKirim(jalan, { hariIni: 5, jamIni: 1, sejakTerakhir: 10 }, kini).boleh, false);
sama("jeda sudah lewat boleh", izinKirim(jalan, { hariIni: 5, jamIni: 1, sejakTerakhir: 60 }, kini).boleh, true);

// Jatah yang diberikan tidak boleh melampaui sisa harian maupun sisa jam.
sama("jatah dipotong sisa harian", izinKirim(jalan, { hariIni: 58, jamIni: 0, sejakTerakhir: 99 }, kini).jatah, 2);
sama("jatah dipotong sisa jam", izinKirim(jalan, { hariIni: 0, jamIni: 11, sejakTerakhir: 99 }, kini).jatah, 1);

// Pemanasan ikut menegakkan batasnya lewat izinKirim.
const panasHari1: OusState = { ...jalan, pemanasan: true, pemanasanMulai: kini.toISOString() };
sama(
  "hari pertama berhenti di 20 surat",
  izinKirim(panasHari1, { hariIni: 20, jamIni: 0, sejakTerakhir: 999 }, kini).boleh,
  false,
);

// Guncangan jeda: selalu di antara 80% dan 130% dari jeda yang disetel.
sama("jeda paling cepat 80%", jedaBerikutnya(jalan, 0), Math.round(45_000 * 0.8));
sama("jeda paling lambat 130%", jedaBerikutnya(jalan, 1), Math.round(45_000 * 1.3));

// ============================================================
// 8. COBA ULANG
// ============================================================

sama("429 dicoba lagi", galatSementara("429"), true);
sama("500 dicoba lagi", galatSementara(500), true);
sama("503 dicoba lagi", galatSementara("503"), true);
sama("400 tidak dicoba lagi", galatSementara("400"), false);
sama("403 tidak dicoba lagi", galatSementara(403), false);
sama("422 tidak dicoba lagi", galatSementara("422"), false);
sama("timeout dicoba lagi", galatSementara("network timeout"), true);
sama("ECONNRESET dicoba lagi", galatSementara("ECONNRESET"), true);
sama("alamat ditolak tidak dicoba lagi", galatSementara("invalid recipient"), false);

sama("jeda percobaan pertama 5 menit", jedaCobaUlang(1, 0.5), Math.round(5 * 60_000 * 1.0));
benar("jeda percobaan kedua sekitar 30 menit", (jedaCobaUlang(2, 0.5) ?? 0) > 25 * 60_000);
sama("percobaan ketiga menyerah", jedaCobaUlang(3), null);
sama("percobaan keempat tetap menyerah", jedaCobaUlang(4), null);
sama("batas percobaan tiga", BATAS.cobaMaks, 3);

// ============================================================
// 9. PENGATURAN — NILAI BAWAAN YANG AMAN
// ============================================================

// Pengaturan yang tidak lengkap harus terbaca sebagai keadaan PALING AMAN:
// saklar mati, mode simulasi. Bukan sebaliknya.
sama("bawaan saklar mati", DEFAULT_OUS.enabled, false);
sama("bawaan mode simulasi", DEFAULT_OUS.simulasi, true);
sama("JSON rusak dibaca sebagai mati", parseOus("{bukan json").enabled, false);
sama("kolom kosong dibaca sebagai mati", parseOus(null).enabled, false);
sama("JSON rusak tetap simulasi", parseOus("{bukan json").simulasi, true);
sama("pengaturan lama tanpa kolom simulasi tetap simulasi", parseOus('{"enabled":true}').simulasi, true);
sama("saklar hanya true yang menyala", normalkanOus({ enabled: "true" }).enabled, false);
sama("saklar true menyala", normalkanOus({ enabled: true }).enabled, true);
sama("simulasi hanya false yang mematikan", normalkanOus({ simulasi: 0 }).simulasi, true);
sama("simulasi false mematikan", normalkanOus({ simulasi: false }).simulasi, false);

sama("jatah harian dibatasi atas", normalkanOus({ hariMaks: 5000 }).hariMaks, BATAS.hariMaks);
sama("jatah harian dibatasi bawah", normalkanOus({ hariMaks: 1 }).hariMaks, BATAS.hariMin);
sama("jatah harian bukan angka memakai bawaan", normalkanOus({ hariMaks: "banyak" }).hariMaks, DEFAULT_OUS.hariMaks);
sama("jeda dibatasi bawah", normalkanOus({ jedaDetik: 0 }).jedaDetik, BATAS.jedaMin);
sama("jam dibatasi", normalkanOus({ jamMaks: 999 }).jamMaks, BATAS.jamMaks);

// Jendela jam terbalik dirapikan menjadi satu hari penuh, bukan ditolak:
// yang salah setel lebih baik mengirim kapan saja daripada tidak pernah
// mengirim sama sekali tanpa keterangan apa pun.
sama("jendela terbalik jadi jam 0", normalkanOus({ jamMulai: 20, jamSelesai: 6 }).jamMulai, 0);
sama("jendela terbalik jadi jam 23", normalkanOus({ jamMulai: 20, jamSelesai: 6 }).jamSelesai, 23);
sama("jendela wajar dipertahankan", normalkanOus({ jamMulai: 9, jamSelesai: 16 }).jamMulai, 9);

sama("alamat pengirim rusak dikosongkan", normalkanOus({ fromEmail: "bukan alamat" }).fromEmail, "");
sama("alamat pengirim sah dirapikan", normalkanOus({ fromEmail: " JURNAL@UMT.AC.ID " }).fromEmail, "jurnal@umt.ac.id");

sama("daftar dosen membuang yang rusak", normalkanOus({ dosen: ["a@x.edu", "rusak", "A@X.edu"] }).dosen.length, 1);
sama("daftar dosen dirapikan huruf kecil", normalkanOus({ dosen: ["Basit@UMT.ac.id"] }).dosen[0], "basit@umt.ac.id");
sama("dosen bukan larik diabaikan", normalkanOus({ dosen: "a@x.edu" }).dosen.length, 0);
benar("pemasangan awal membuka akun pengurus jurnal", DEFAULT_OUS.dosen.includes("basit@umt.ac.id"));

// ============================================================
// 10. SIAPA YANG BOLEH — TABEL KEBENARAN PENUH
// ============================================================

const SEMUA_PERAN = [
  "super_admin", "admin", "admin_umum", "admin_akademik", "admin_prodi",
  "admin_pddikti", "admin_perpustakaan", "admin_laboratorium", "dosen",
] as const;

const mati: OusState = { ...DEFAULT_OUS, enabled: false, dosen: ["basit@umt.ac.id"] };
const nyala: OusState = { ...DEFAULT_OUS, enabled: true, dosen: ["basit@umt.ac.id"] };

// Saklar mati: TIDAK ADA satu peran pun yang boleh memakai, Super Admin
// sekalipun. Saklar yang pemegangnya sendiri kebal bukan saklar.
for (const peran of SEMUA_PERAN) {
  sama(`saklar mati, ${peran} tidak boleh memakai`, bolehPakaiOus({ role: peran, email: "basit@umt.ac.id" }, mati), false);
}
sama(
  "saklar mati, tidak ada satu pun yang boleh memakai",
  SEMUA_PERAN.filter((peran) => bolehPakaiOus({ role: peran, email: "basit@umt.ac.id" }, mati)).length,
  0,
);

// Tetapi Super Admin tetap MELIHAT panelnya — di situlah saklarnya berada.
sama("saklar mati, super_admin tetap melihat panel", bolehLihatOus({ role: "super_admin", email: "s@x.id" }, mati), true);
for (const peran of SEMUA_PERAN.filter((p) => p !== "super_admin")) {
  sama(`saklar mati, ${peran} tidak melihat panel`, bolehLihatOus({ role: peran, email: "basit@umt.ac.id" }, mati), false);
}

// Saklar menyala: Admin dan Super Admin selalu; dosen hanya yang terdaftar.
sama("saklar nyala, super_admin boleh", bolehPakaiOus({ role: "super_admin", email: "s@x.id" }, nyala), true);
sama("saklar nyala, admin boleh", bolehPakaiOus({ role: "admin", email: "a@x.id" }, nyala), true);
sama("dosen terdaftar boleh", bolehPakaiOus({ role: "dosen", email: "basit@umt.ac.id" }, nyala), true);
sama("dosen terdaftar beda huruf besar tetap boleh", bolehPakaiOus({ role: "dosen", email: "BASIT@UMT.AC.ID" }, nyala), true);
sama("dosen terdaftar dengan spasi tetap boleh", bolehPakaiOus({ role: "dosen", email: " basit@umt.ac.id " }, nyala), true);
sama("dosen lain tidak boleh", bolehPakaiOus({ role: "dosen", email: "dosen.lain@umt.ac.id" }, nyala), false);
sama("dosen tanpa email tidak boleh", bolehPakaiOus({ role: "dosen", email: "" }, nyala), false);

// Admin bagian tidak pernah melihat menu ini, walau saklarnya menyala.
for (const peran of ["admin_umum", "admin_akademik", "admin_prodi", "admin_pddikti", "admin_perpustakaan", "admin_laboratorium"] as const) {
  sama(`saklar nyala, ${peran} tetap tidak boleh`, bolehPakaiOus({ role: peran, email: "basit@umt.ac.id" }, nyala), false);
}
sama("profil kosong tidak boleh", bolehPakaiOus(null, nyala), false);

// Pengaturan: Super Admin seorang diri.
sama("super_admin boleh mengatur", bolehAturOus({ role: "super_admin" }), true);
for (const peran of SEMUA_PERAN.filter((p) => p !== "super_admin")) {
  sama(`${peran} tidak boleh mengatur`, bolehAturOus({ role: peran }), false);
}
sama("tanpa profil tidak boleh mengatur", bolehAturOus(null), false);

// ============================================================
// 11. PERISTIWA PENYEDIA
// ============================================================

sama("delivered menjadi sampai", statusDariPeristiwa("email.delivered"), "delivered");
sama("bounced menjadi memantul", statusDariPeristiwa("email.bounced"), "bounced");
sama("complained menjadi memantul", statusDariPeristiwa("email.complained"), "bounced");
sama("sent menjadi terkirim", statusDariPeristiwa("email.sent"), "sent");
sama("opened tidak mengubah status", statusDariPeristiwa("email.opened"), null);
sama("peristiwa tak dikenal tidak mengubah status", statusDariPeristiwa("email.entah"), null);

sama("pantulan keras mencekal", cekalDariPeristiwa("email.bounced"), "hard_bounce");
sama("keluhan mencekal", cekalDariPeristiwa("email.complained"), "complaint");
sama("berhenti langganan mencekal", cekalDariPeristiwa("email.unsubscribed"), "unsubscribe");
// Kotak penuh adalah keadaan sementara. Mencekal alamat karenanya berarti
// kehilangan penerima yang sah untuk seterusnya.
sama("pantulan lunak TIDAK mencekal", cekalDariPeristiwa("email.soft_bounce"), null);
sama("delivered tidak mencekal", cekalDariPeristiwa("email.delivered"), null);
sama("dibuka tidak mencekal", cekalDariPeristiwa("email.opened"), null);

// ============================================================
// 12. TOKEN DAN TAUTAN
// ============================================================

const token = buatToken(32);
sama("token sepanjang 32", token.length, 32);
benar("token hanya heksadesimal", /^[a-f0-9]{32}$/.test(token));
benar("dua token berbeda", buatToken(32) !== buatToken(32));

const tautan = tautanBerhenti("https://sipalingfisip.web.id/", token);
sama("garis miring ganda dihindari", tautan, `https://sipalingfisip.web.id/email/berhenti?t=${token}`);
benar("tautan tidak membocorkan alamat email", !tautan.includes("@"));

const kode = kodeKampanye();
sama("kode kampanye delapan huruf", kode.length, 8);
benar("kode kampanye tanpa huruf yang mudah keliru", !/[IO01]/.test(kode));

// ============================================================
// 13. STATISTIK
// ============================================================

const hitung = ringkasanKampanye({
  total: 1000, queued: 120, sent: 38, delivered: 800, failed: 18, bounced: 20, unsubscribed: 4,
});
sama("diproses dijumlahkan", hitung.diproses, 880);
sama("sisa dihitung dari total", hitung.sisa, 120);
sama("kemajuan persen", hitung.kemajuan, 88);
// Laju dihitung terhadap YANG SUDAH DIPROSES, bukan terhadap seluruh
// penerima: kampanye yang baru seperlima jalan kalau tidak begitu akan
// menampilkan angka yang benar secara aritmetika dan menyesatkan.
sama("laju sampai terhadap yang diproses", hitung.lajuSampai, 90.9);
sama("laju pantul terhadap yang diproses", hitung.lajuPantul, 2.3);
sama(
  "kampanye kosong tidak membagi nol",
  ringkasanKampanye({ total: 0, queued: 0, sent: 0, delivered: 0, failed: 0, bounced: 0, unsubscribed: 0 }).lajuSampai,
  0,
);

sama("seribu alamat pada jatah 60", perkiraanHari(1000, 60), 17);
sama("lima puluh alamat pada jatah 60", perkiraanHari(50, 60), 1);
sama("daftar kosong nol hari", perkiraanHari(0, 60), 0);

// ============================================================
// 14. PERAKITAN SURAT
// ============================================================

const negara: OusState = {
  ...DEFAULT_OUS,
  enabled: true,
  fromName: "NYIMAK Editorial Team",
  fromEmail: "journal@nyimak.example.ac.id",
  replyTo: "editorial@nyimak.example.ac.id",
};

const surat = rakitSurat(
  {
    idem: "cr101",
    email: "john@university.edu",
    name: "John Smith",
    institution: "ABC University",
    field: "Digital Media",
    country: "Malaysia",
    unsubscribeToken: "a".repeat(32),
    subject: TEMPLATE_BAWAAN[0].subjek,
    bodyHtml: TEMPLATE_BAWAAN[0].bodyHtml,
    bodyText: null,
    fromName: negara.fromName,
    fromEmail: negara.fromEmail,
    replyTo: negara.replyTo,
  },
  negara,
  "https://sipalingfisip.web.id",
);

sama("baris Dari tersusun", surat.from, "NYIMAK Editorial Team <journal@nyimak.example.ac.id>");
sama("satu penerima saja", surat.to, "john@university.edu");
benar("nama penerima masuk ke badan surat", surat.html.includes("John Smith"));
benar("nama jurnal masuk ke badan surat", surat.html.includes(negara.jurnalNama));
benar("alamat pengiriman naskah masuk", surat.html.includes(negara.jurnalUrl));
benar("tidak ada peubah yang tertinggal", !surat.html.includes("{{"));
benar("versi teks biasa ikut dirakit", surat.text.length > 200);
benar("versi teks biasa tanpa tag", !surat.text.includes("<p"));

// Inilah yang membuat tombol "berhenti berlangganan" muncul di baris atas
// Gmail — dan orang yang menekannya tidak menekan "laporkan spam".
benar("kepala List-Unsubscribe terpasang", Boolean(surat.headers["List-Unsubscribe"]));
benar("List-Unsubscribe memakai kurung sudut", surat.headers["List-Unsubscribe"].startsWith("<"));
sama("satu ketukan dinyatakan", surat.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
benar("kepala berhenti tidak membocorkan alamat", !surat.headers["List-Unsubscribe"].includes("john@"));
benar("tautan berhenti ada di badan surat", surat.html.includes("/email/berhenti?t="));

// Naskah yang kehilangan tautan berhentinya ditambal sebelum keluar.
benar("kaki berhenti ditambal", pastikanKakiBerhenti("<p>x</p>").includes("{{unsubscribe_url}}"));
sama(
  "kaki yang sudah ada tidak diduakan",
  (pastikanKakiBerhenti(`<p>x</p>${KAKI_WAJIB}`).match(/unsubscribe_url/g) || []).length,
  1,
);

const suratTambal = rakitSurat(
  {
    idem: "cr102",
    email: "a@x.edu", name: null, institution: null, field: null, country: null,
    unsubscribeToken: "b".repeat(32),
    subject: "Invitation to Submit Your Research",
    bodyHtml: "<p>Dear {{name}}, tanpa kaki sama sekali.</p>",
    bodyText: null,
    fromName: "X", fromEmail: "x@y.edu", replyTo: null,
  },
  negara,
  "https://sipalingfisip.web.id",
);
benar("surat tanpa kaki tetap membawa tautan berhenti", suratTambal.html.includes("/email/berhenti?t="));
benar("penerima tanpa nama disapa Researcher", suratTambal.html.includes("Researcher"));

// Kunci idempotensi harus membedakan BARIS ANTREAN, bukan penerimanya:
// kampanye kedua kepada orang yang sama tidak boleh ditolak penyedia sebagai
// kiriman berulang.
benar("kunci idempotensi membawa nomor barisnya", surat.idem.startsWith("cr101:"));
benar("kunci idempotensi berbeda antar baris", surat.idem !== suratTambal.idem);
benar("kunci idempotensi dibatasi panjangnya", surat.idem.length <= 250);

// Rangka surat: satu bentuk untuk semua kampanye.
benar("rangka memuat charset", rangkaEmail("<p>x</p>").includes('charset="utf-8"'));
benar("rangka membatasi lebar", rangkaEmail("<p>x</p>").includes("max-width:600px"));

// ============================================================
// 15. KESIAPAN KIRIM SUNGGUHAN
// ============================================================

const tanpaPengirim = periksaKesiapan({ ...DEFAULT_OUS, fromEmail: "" });
benar("tanpa alamat pengirim tidak siap", !tanpaPengirim.siap);
benar(
  "alasannya disebut",
  tanpaPengirim.penghalang.some((item) => item.includes("Alamat pengirim")),
);

// Penyedia gratis menolak menandatangani DKIM atas nama kita, dan DMARC
// penerima akan menolak suratnya. Ini bukan soal selera.
const gmail = periksaKesiapan({ ...DEFAULT_OUS, fromEmail: "jurnalnyimak@gmail.com" });
benar("alamat gmail ditolak sebagai pengirim", !gmail.siap);
benar(
  "penolakan gmail menerangkan sebabnya",
  gmail.penghalang.some((item) => item.includes("DKIM")),
);

benar(
  "SPF/DKIM/DMARC selalu diingatkan",
  periksaKesiapan(DEFAULT_OUS).catatan.some((item) => item.includes("DMARC")),
);

// ============================================================
// 16. LABEL
// ============================================================

sama("label status penerima lengkap", Object.keys(STATUS_PENERIMA_LABEL).length, 8);
sama("label status kampanye lengkap", Object.keys(STATUS_KAMPANYE_LABEL).length, 6);
sama("label alasan cekal lengkap", Object.keys(ALASAN_CEKAL_LABEL).length, 5);
sama("batas satu kampanye", BATAS.penerimaPerKampanye, 5000);
sama("jumlah naskah bawaan", TEMPLATE_BAWAAN.length, 4);
benar("naskah CFP umum tersedia", TEMPLATE_BAWAAN.some((item) => item.kode === "nyimak-cfp"));

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((item) => console.error("  ✗ " + item));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
