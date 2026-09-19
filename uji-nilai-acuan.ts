// UJI PENILAIAN ESAI DARI JAWABAN ACUAN
//
// Yang dijaga di sini adalah satu janji yang kesalahannya TIDAK TERLIHAT
// sampai nilai sudah keluar dan sudah disahkan: bahwa jawaban yang menyalin
// pertanyaannya kembali, dan jawaban panjang yang membicarakan hal lain,
// tidak boleh bernilai setinggi parafrase yang benar.
//
// Itu justru yang terjadi bila pembobotan TF-IDF lepas. Pertanyaan yang sama
// membuat kata-kata soal muncul di hampir setiap lembar; tanpa pembobotan,
// seluruh kelas terlihat mirip acuan hanya karena menjawab pertanyaan yang
// sama. Uji "celah asal menyalin" di bawah adalah yang menahannya.
//
// Seluruhnya murni. Tidak satu pun uji di sini menyentuh basis data,
// jaringan, atau model, dan itu memang inti fiturnya.

import {
  MIN_KATA_ACUAN, acuanKosong, bacaButir, bersihkanButir, gabungButir,
  istilahWajibHilang, kurvaNilai, nilaiSoal, periksaAcuan, ratakanBobotButir,
  type ButirAcuan,
} from "./src/lib/nilai-acuan";
import { acuanDariExcel, acuanDariWord, buatDocxAcuan, buatXlsxAcuan } from "./src/lib/template-acuan";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? `: ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

const ACUAN_ENERGI =
  "Energi terbarukan mengurangi emisi gas rumah kaca karena tidak membakar bahan bakar fosil. " +
  "Pemanfaatan tenaga surya dan angin menekan pencemaran udara serta memperlambat pemanasan global. " +
  "Sumbernya tidak habis sehingga ketergantungan pada batu bara berkurang.";

const BUTIR: ButirAcuan = {
  nomor: 1,
  pertanyaan: "Jelaskan manfaat energi terbarukan bagi lingkungan.",
  jawaban: ACUAN_ENERGI,
  bobot: 100,
  wajib: [],
};

// ------------------------------------------------------------
console.log("\n=== CELAH 'ASAL MENYALIN' TERTUTUP ===\n");
// ------------------------------------------------------------

const KELAS = [
  // Parafrase yang benar: kalimat sendiri, gagasan sama.
  { attemptId: 1, teks:
    "Pemakaian tenaga surya dan angin menekan emisi gas rumah kaca sebab tidak ada pembakaran bahan bakar fosil. " +
    "Pencemaran udara ikut turun dan pemanasan global melambat. Sumber ini tidak habis sehingga batu bara makin ditinggalkan." },
  // Menyalin pertanyaannya, lalu dipanjangkan sampai selebar jawaban lain.
  { attemptId: 2, teks:
    "Manfaat energi terbarukan bagi lingkungan sangat banyak sekali. Energi terbarukan bagi lingkungan itu manfaatnya besar. " +
    "Jelaskan manfaat energi terbarukan bagi lingkungan adalah pertanyaan yang penting sekali untuk dijawab dengan baik dan benar." },
  // Panjang, tersusun, dan sama sekali di luar topik.
  { attemptId: 3, teks:
    "Sepak bola adalah olahraga paling populer di dunia yang dimainkan sebelas orang setiap tim. " +
    "Pertandingan berlangsung sembilan puluh menit dibagi dua babak dengan istirahat di antaranya. " +
    "Wasit memimpin jalannya pertandingan dan berhak memberikan kartu kuning maupun kartu merah." },
  // Menyalin acuan kata demi kata.
  { attemptId: 4, teks: ACUAN_ENERGI },
  { attemptId: 5, teks: "Bagus untuk bumi." },
  { attemptId: 6, teks: "" },
];

const hasil = nilaiSoal(KELAS, BUTIR);
const h = (id: number) => hasil.get(id)!;
for (const k of KELAS) {
  const x = h(k.attemptId);
  console.log(`  #${k.attemptId}  mirip ${String(x.kemiripan).padStart(3)}%  nilai ${String(x.nilai).padStart(3)}  ${x.alasan.slice(0, 74)}`);
}

benar("parafrase yang benar mengalahkan penyalin pertanyaan",
  h(1).kemiripan > h(2).kemiripan, `${h(1).kemiripan}% lawan ${h(2).kemiripan}%`);
benar("parafrase yang benar mengalahkan jawaban di luar topik",
  h(1).kemiripan > h(3).kemiripan, `${h(1).kemiripan}% lawan ${h(3).kemiripan}%`);
sama("penyalin pertanyaan bernilai nol", h(2).nilai, 0);
sama("jawaban di luar topik bernilai nol", h(3).nilai, 0);
benar("parafrase yang benar bernilai tinggi", h(1).nilai >= 70, `nilai ${h(1).nilai}`);
sama("salinan persis mirip seratus persen", h(4).kemiripan, 100);
sama("salinan persis bernilai seratus", h(4).nilai, 100);

// Panjang saja tidak menolong: yang di luar topik justru yang TERPANJANG.
benar("panjang tidak menolong jawaban di luar topik",
  h(3).jumlahKata >= h(1).jumlahKata && h(3).nilai < h(1).nilai,
  `${h(3).jumlahKata} kata bernilai ${h(3).nilai}, lawan ${h(1).jumlahKata} kata bernilai ${h(1).nilai}`);

// ------------------------------------------------------------
console.log("\n=== YANG DISERAHKAN KEPADA PENGAJAR ===\n");
// ------------------------------------------------------------

benar("jawaban terlalu pendek tidak dinilai mesin", h(5).perluDibaca === true);
benar("jawaban terlalu pendek menyebut jumlah katanya", h(5).alasan.includes("3 kata"), h(5).alasan);
sama("jawaban kosong dikenali apa adanya", h(6).alasan, "Tidak dijawab.");
benar("jawaban kosong juga diserahkan", h(6).perluDibaca === true);

// Inilah yang membuat lembar pendek tetap muncul sebagai pekerjaan yang
// menunggu, bukan lenyap sebagai nol yang terlihat sudah dinilai.
const gab = gabungButir([h(5), h(6)]);
sama("seluruhnya pendek: nilainya nol", gab.nilai, 0);
benar("seluruhnya pendek: alasannya menyebut pengajar", gab.alasan.includes("dosen") || gab.alasan.includes("pengajar"), gab.alasan);
benar("tanpa butir sama sekali punya alasannya sendiri",
  gabungButir([]).alasan.includes("Belum ada butir"), gabungButir([]).alasan);

// Bobot yang dipakai hanya bobot butir yang BENAR-BENAR dinilai. Butir yang
// acuannya belum ditulis tidak boleh menyeret seluruh kelas ke bawah.
const campur = gabungButir([
  { ...h(4), bobot: 50 },
  { ...h(5), bobot: 50, perluDibaca: true },
]);
sama("butir yang diserahkan tidak menyeret nilai ke bawah", campur.nilai, 100);
benar("dan jumlahnya disebut", campur.alasan.includes("1 butir diserahkan"), campur.alasan);

// ------------------------------------------------------------
console.log("\n=== KURVA DUA AMBANG ===\n");
// ------------------------------------------------------------

sama("tepat di ambang nol bernilai nol", kurvaNilai(15, 15, 65), 0);
sama("tepat di ambang penuh bernilai seratus", kurvaNilai(65, 15, 65), 100);
sama("tengah kurva bernilai lima puluh", kurvaNilai(40, 15, 65), 50);
sama("di atas ambang penuh tetap seratus", kurvaNilai(100, 15, 65), 100);
sama("di bawah ambang nol tetap nol", kurvaNilai(0, 15, 65), 0);
// Ambang yang terbalik tidak boleh melempar galat: yang menyetelnya salah
// ketik, dan panel yang menolak terbuka menghukum satu-satunya orang yang
// dapat membetulkannya.
benar("ambang terbalik tidak melempar", Number.isFinite(kurvaNilai(50, 80, 20)));

// ------------------------------------------------------------
console.log("\n=== ISTILAH WAJIB ===\n");
// ------------------------------------------------------------

const hilang = istilahWajibHilang(ACUAN_ENERGI, ["gas rumah kaca", "Bahan Bakar Fosil", "nuklir"]);
sama("istilah berfrasa dan beda huruf besar tetap ketemu", JSON.stringify(hilang), '["nuklir"]');
sama("tanpa daftar wajib tidak ada yang hilang", istilahWajibHilang(ACUAN_ENERGI, []).length, 0);

const BERWAJIB: ButirAcuan = { ...BUTIR, wajib: ["gas rumah kaca", "bahan bakar fosil"] };
const penuh = nilaiSoal([{ attemptId: 9, teks: ACUAN_ENERGI }], BERWAJIB).get(9)!;
sama("semua istilah wajib ada: nilai utuh", penuh.nilai, 100);

const kurang = nilaiSoal(
  [{ attemptId: 9, teks: ACUAN_ENERGI.replace(/bahan bakar fosil/gi, "sumber lain") }],
  BERWAJIB,
).get(9)!;
benar("satu istilah wajib hilang: memotong, bukan menolkan",
  kurang.nilai > 0 && kurang.nilai < 100, `nilai ${kurang.nilai}`);
benar("dan istilah yang hilang disebut namanya",
  kurang.wajibHilang.includes("bahan bakar fosil"), JSON.stringify(kurang.wajibHilang));

// ------------------------------------------------------------
console.log("\n=== ALASAN YANG DIBACA PENGAJAR ===\n");
// ------------------------------------------------------------

// Kolom yang berbunyi "kata penentu: dan, tidak, karena" akan membuat
// pembacanya berhenti percaya pada seluruh angkanya, dan ia benar untuk
// berhenti percaya. Penyaringan ini hanya menyentuh ALASAN, bukan nilainya.
const kataSambung = ["dan", "tidak", "karena", "serta", "yang", "dengan"];
benar("kata sambung tidak muncul sebagai kata penentu",
  !h(1).kataBersama.some((k) => kataSambung.includes(k)), JSON.stringify(h(1).kataBersama));
benar("kata penentu memang kata isi",
  h(1).kataBersama.length > 0 && h(1).kataBersama.every((k) => k.length > 2),
  JSON.stringify(h(1).kataBersama));
benar("alasan menyebut persen kemiripannya", h(1).alasan.includes(`${h(1).kemiripan}% mirip acuan`), h(1).alasan);

// ------------------------------------------------------------
console.log("\n=== PEMERIKSAAN SEBELUM SIMPAN ===\n");
// ------------------------------------------------------------

const SAH = { nama: "Uji", keterangan: "", ambangNol: 15, ambangPenuh: 65, butir: [BUTIR] };
benar("acuan yang sah diterima", periksaAcuan(SAH).ok === true, JSON.stringify(periksaAcuan(SAH)));
benar("acuan kosong ditolak", periksaAcuan(acuanKosong()).ok === false);
benar("tanpa nama ditolak", periksaAcuan({ ...SAH, nama: "" }).ok === false);
benar("bobot bukan seratus ditolak", periksaAcuan({ ...SAH, butir: [{ ...BUTIR, bobot: 60 }] }).ok === false);
benar("ambang terbalik ditolak", periksaAcuan({ ...SAH, ambangNol: 70 }).ok === false);
benar("nomor kembar ditolak",
  periksaAcuan({ ...SAH, butir: [{ ...BUTIR, bobot: 50 }, { ...BUTIR, bobot: 50 }] }).ok === false);
benar("acuan lebih pendek dari ambang ditolak",
  periksaAcuan({ ...SAH, butir: [{ ...BUTIR, jawaban: "terlalu pendek sekali" }] }).ok === false);
benar("dan penolakannya menyebut berapa kata paling sedikit",
  String((periksaAcuan({ ...SAH, butir: [{ ...BUTIR, jawaban: "terlalu pendek sekali" }] }) as { pesan: string }).pesan)
    .includes(String(MIN_KATA_ACUAN)));

sama("ratakan tiga butir", JSON.stringify(ratakanBobotButir(3)), "[33,33,34]");
sama("ratakan empat butir", JSON.stringify(ratakanBobotButir(4)), "[25,25,25,25]");
sama("ratakan nol butir", ratakanBobotButir(0).length, 0);
benar("ratakan selalu berjumlah seratus",
  [1, 2, 3, 6, 7, 9, 11].every((n) => ratakanBobotButir(n).reduce((a, b) => a + b, 0) === 100));

// JSON rusak tidak boleh melempar: acuan yang kolomnya cacat harus tetap
// TAMPIL supaya yang berhak membetulkannya dapat melihatnya.
sama("JSON rusak tidak melempar", bacaButir("{rusak").length, 0);
sama("null tidak melempar", bacaButir(null).length, 0);
sama("bukan larik tidak melempar", bacaButir('{"a":1}').length, 0);
sama("butir tanpa jawaban dibuang", bacaButir('[{"nomor":1,"jawaban":""}]').length, 0);

const dijepit = bersihkanButir({ nomor: -5, bobot: 500, jawaban: "x".repeat(9000), wajib: Array(40).fill("a") });
benar("nomor negatif dijepit", dijepit.nomor >= 0, String(dijepit.nomor));
sama("bobot di atas seratus dijepit", dijepit.bobot, 100);
benar("jawaban sangat panjang dipotong", dijepit.jawaban.length <= 4000, String(dijepit.jawaban.length));
benar("istilah wajib dibatasi jumlahnya", dijepit.wajib.length <= 12, String(dijepit.wajib.length));

// ------------------------------------------------------------
console.log("\n=== TEMPLATE: UNDUH, ISI, UNGGAH ===\n");
// ------------------------------------------------------------

const xl = acuanDariExcel([
  ["TEMPLATE JAWABAN ACUAN DOSEN / PENGAJAR"],
  [],
  ["CATATAN SAYA", "NO", "PERTANYAAN", "JAWABAN ACUAN", "BOBOT", "ISTILAH WAJIB"],
  ["abaikan", 1, "Manfaat energi terbarukan?", ACUAN_ENERGI, 60, "gas rumah kaca, bahan bakar fosil"],
  ["", 2, "Apa itu agenda setting?", "Agenda setting adalah kemampuan media massa menentukan isu mana yang dianggap penting khalayak.", 40, ""],
  ["", "", "", "", "", ""],
]);
sama("kolom yang digeser dan disisipi tetap terbaca", xl.butir.length, 2);
sama("baris kosong tidak dikeluhkan", xl.tolak.length, 0);
sama("bobot terbaca apa adanya", JSON.stringify(xl.butir.map((b) => b.bobot)), "[60,40]");
sama("istilah wajib terpecah benar", xl.butir[0].wajib.length, 2);
benar("hasil impor langsung sah",
  periksaAcuan({ nama: "x", keterangan: "", ambangNol: 15, ambangPenuh: 65, butir: xl.butir }).ok === true);

const rata = acuanDariExcel([
  ["NO", "PERTANYAAN", "JAWABAN ACUAN", "BOBOT"],
  [1, "a", ACUAN_ENERGI, ""],
  [2, "b", ACUAN_ENERGI, ""],
  [3, "c", ACUAN_ENERGI, ""],
]);
sama("seluruh bobot kosong dibagi rata", JSON.stringify(rata.butir.map((b) => b.bobot)), "[33,33,34]");

const tanpaNomor = acuanDariExcel([
  ["PERTANYAAN", "JAWABAN ACUAN"],
  ["a", ACUAN_ENERGI],
  ["b", ACUAN_ENERGI],
]);
sama("kolom NO kosong diisi urutan kemunculan",
  JSON.stringify(tanpaNomor.butir.map((b) => b.nomor)), "[1,2]");

const asing = acuanDariExcel([["a", "b"], [1, 2]]);
sama("berkas asing tidak menghasilkan butir", asing.butir.length, 0);
benar("dan penolakannya menyuruh memakai templatenya", asing.tolak[0].alasan.includes("template"), asing.tolak[0].alasan);

// Inilah uji Word yang paling menentukan. Jawaban acuan berupa paragraf
// dipecah Word menjadi beberapa baris, dan pembaca yang hanya menerima satu
// baris per label akan memotong acuannya pada titik pertama TANPA MENGATAKAN
// APA PUN. Nilai seluruh kelas kemudian dihitung dari sepertiga acuan yang
// dimaksud penyusunnya.
const w = acuanDariWord(
  "<p>1. Jelaskan manfaat energi terbarukan bagi lingkungan.</p>" +
  "<p>Jawaban: Energi terbarukan menekan emisi gas rumah kaca.</p>" +
  "<p>Tenaga surya dan angin mengurangi pencemaran udara.</p>" +
  "<p>Sumbernya tidak habis sehingga batu bara ditinggalkan.</p>" +
  "<p>Bobot: 60</p><p>Wajib: gas rumah kaca, bahan bakar fosil</p>" +
  "<p>2. Apa yang dimaksud agenda setting?</p>" +
  "<p>Lanjutan pertanyaannya ada di baris ini.</p>" +
  "<p>Jawaban: Agenda setting adalah kemampuan media massa menentukan isu mana yang dianggap penting khalayak.</p>" +
  "<p>Bobot: 40</p>",
);
sama("dua butir terbaca dari Word", w.butir.length, 2);
benar("paragraf lanjutan IKUT ke dalam jawaban acuan",
  w.butir[0].jawaban.includes("batu bara"), w.butir[0].jawaban);
benar("jawaban acuan terbaca utuh", w.butir[0].jawaban.split(/\s+/).length > 20,
  String(w.butir[0].jawaban.split(/\s+/).length));
sama("bobot dari Word terbaca", JSON.stringify(w.butir.map((b) => b.bobot)), "[60,40]");
sama("istilah wajib dari Word terbaca", w.butir[0].wajib.length, 2);
benar("lanjutan pertanyaan menyambung ke pertanyaan",
  w.butir[1].pertanyaan.includes("Lanjutan"), w.butir[1].pertanyaan);
benar("dan tidak bocor ke jawaban",
  !w.butir[1].jawaban.includes("Lanjutan"), w.butir[1].jawaban);

const tanpaJawaban = acuanDariWord("<p>1. Pertanyaan tanpa jawaban.</p><p>Bobot: 100</p>");
sama("butir tanpa baris Jawaban tidak disimpan diam-diam", tanpaJawaban.butir.length, 0);
sama("melainkan dikeluhkan", tanpaJawaban.tolak.length, 1);
const naskahAsing = acuanDariWord("<p>Ini surat undangan rapat, bukan jawaban acuan.</p>");
sama("naskah asing tidak menghasilkan butir", naskahAsing.butir.length, 0);
benar("dan penolakannya menerangkan bentuk yang benar",
  naskahAsing.tolak[0].alasan.includes("Jawaban:"), naskahAsing.tolak[0].alasan);

const bx = buatXlsxAcuan();
const bd = buatDocxAcuan();
benar("template Excel terbentuk dan berisi", bx.size > 1000, `${bx.size} bita`);
benar("template Word terbentuk dan berisi", bd.size > 1000, `${bd.size} bita`);
benar("template Excel berjenis xlsx", bx.type.includes("spreadsheetml"), bx.type);
benar("template Word berjenis docx", bd.type.includes("wordprocessingml"), bd.type);

// ------------------------------------------------------------
console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  x " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
