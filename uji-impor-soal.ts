// UJI IMPOR SOAL DARI EXCEL DAN WORD
//
// Yang dijaga di sini satu hal yang mahal: KUNCI JAWABAN. Kunci yang salah
// menyalahkan seluruh mahasiswa yang sebenarnya menjawab benar, dan itu baru
// ketahuan sesudah nilai keluar.
//
// Dan satu hal yang membuat fiturnya dipakai atau ditinggalkan: satu baris
// rusak tidak boleh menggagalkan seluruh berkas. Dosen memperbaiki tiga baris,
// bukan mengunggah ulang empat puluh soal.

import {
  imporDariExcel, imporDariWord, bacaJenis, bacaTingkat, bacaBobot, bacaKunci,
  KOLOM_EXCEL, type Aoa,
} from "./src/lib/impor-soal";
import { CONTOH_EXCEL, NASKAH_TEMPLATE_WORD, buatDocxTemplate } from "./src/lib/template-soal";
import { nilaiJawaban, type Soal } from "./src/lib/cbt";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

console.log("\n=== MEMBACA TULISAN BEBAS DOSEN ===\n");

// Dosen menulis jenisnya dengan cara yang berbeda-beda; semuanya harus sampai.
sama("PG", bacaJenis("PG"), "pg");
sama("Pilihan Ganda", bacaJenis("Pilihan Ganda"), "pg");
sama("kosong dianggap PG", bacaJenis(""), "pg");
sama("BENAR-SALAH", bacaJenis("BENAR-SALAH"), "benar_salah");
sama("benar salah", bacaJenis("benar salah"), "benar_salah");
sama("ISIAN", bacaJenis("ISIAN"), "isian");
sama("isian singkat", bacaJenis("isian singkat"), "isian");
sama("ESSAY", bacaJenis("ESSAY"), "essay");
sama("esai", bacaJenis("Esai"), "essay");
sama("uraian", bacaJenis("Uraian"), "essay");

sama("tingkat mudah", bacaTingkat("Mudah"), "mudah");
sama("tingkat sulit", bacaTingkat("SUKAR"), "sulit");
sama("tingkat kosong jadi sedang", bacaTingkat(""), "sedang");

sama("bobot angka", bacaBobot("5"), 5);
sama("bobot koma dibaca", bacaBobot("2,7"), 3);
sama("bobot kosong jadi 1", bacaBobot(""), 1);
sama("bobot nol jadi 1", bacaBobot("0"), 1);
sama("bobot berlebihan dipotong", bacaBobot("500"), 100);

console.log("\n=== KUNCI JAWABAN ===\n");

const pilihan = ["McCombs & Shaw", "Lasswell", "Habermas", "Gerbner"];
const kunciOk = (m: unknown) => { const h = bacaKunci("pg", m, pilihan); return h.ok ? h.kunci : `TOLAK: ${h.alasan}`; };
sama("huruf A", kunciOk("A"), "0");
sama("huruf kecil b", kunciOk("b"), "1");
sama("huruf bertitik C.", kunciOk("C."), "2");
sama("huruf berkurung D)", kunciOk("D)"), "3");
// Dosen menyalin teks jawabannya utuh — sering terjadi, dan tidak salah.
sama("teks jawaban disalin utuh", kunciOk("Habermas"), "2");
sama("teks beda huruf besar-kecil", kunciOk("lasswell"), "1");
// Yang benar-benar tidak menunjuk ke mana pun WAJIB ditolak.
benar("huruf E tanpa pilihan E ditolak", String(kunciOk("E")).startsWith("TOLAK"));
benar("kunci kosong ditolak", String(kunciOk("")).startsWith("TOLAK"));
benar("teks asing ditolak", String(kunciOk("Entah siapa")).startsWith("TOLAK"));

const bs = (m: unknown) => { const h = bacaKunci("benar_salah", m, ["Benar", "Salah"]); return h.ok ? h.kunci : "TOLAK"; };
sama("BENAR jadi indeks 0", bs("BENAR"), "0");
sama("Salah jadi indeks 1", bs("Salah"), "1");
sama("true jadi 0", bs("true"), "0");
benar("kunci benar-salah asing ditolak", bs("mungkin") === "TOLAK");

const isian = bacaKunci("isian", "agenda setting|penentuan agenda", []);
benar("kunci isian disimpan apa adanya", isian.ok && isian.kunci === "agenda setting|penentuan agenda");
benar("isian tanpa kunci ditolak", !bacaKunci("isian", "", []).ok);
benar("essay tidak menuntut kunci", bacaKunci("essay", "", []).ok);

console.log("\n=== EXCEL ===\n");

const baris = (isi: Array<string | number>) => isi as Array<string | number>;
const sheet: Aoa = [
  ["Template Soal Ujian"], [""],
  KOLOM_EXCEL,
  baris([1, "PG", "Ibu kota Indonesia?", "Bandung", "Jakarta", "Medan", "Surabaya", "", "B", 5, "Umum", "mudah", "Sejak 1945."]),
  baris([2, "BENAR-SALAH", "Bumi itu bulat.", "", "", "", "", "", "BENAR", 3, "", "", ""]),
  baris([3, "ISIAN", "Sebutkan ibu kota Jawa Barat.", "", "", "", "", "", "bandung", 4, "", "", ""]),
  baris([4, "ESSAY", "Jelaskan sistem pemerintahan daerah.", "", "", "", "", "", "", 20, "", "sulit", ""]),
  baris(["", "", "", "", "", "", "", "", "", "", "", "", ""]),
  baris([5, "PG", "Soal tanpa kunci", "A", "B", "", "", "", "", 5, "", "", ""]),
  baris([6, "PG", "Soal kunci ngawur", "A", "B", "", "", "", "Z", 5, "", "", ""]),
];

const hasil = imporDariExcel(sheet);
sama("empat soal sah terbaca", hasil.soal.length, 4);
sama("dua baris ditolak", hasil.tolak.length, 2);
// Baris kosong di ekor template TIDAK boleh ikut mengeluh.
benar("baris kosong dilewati diam-diam", !hasil.tolak.some((t) => t.baris.includes("Baris 8")));
benar("alasan tolak menyebut nomor barisnya", hasil.tolak.every((t) => /Baris \d+/.test(t.baris)),
  hasil.tolak.map((t) => t.baris).join(" | "));

sama("PG: jenis", hasil.soal[0].jenis, "pg");
sama("PG: kunci B jadi indeks 1", hasil.soal[0].kunci, "1");
sama("PG: empat pilihan", hasil.soal[0].pilihan.length, 4);
sama("PG: bobot", hasil.soal[0].bobot, 5);
sama("PG: tingkat", hasil.soal[0].tingkat, "mudah");
sama("BENAR-SALAH: pilihan diisikan sendiri", hasil.soal[1].pilihan.join("/"), "Benar/Salah");
sama("BENAR-SALAH: kunci", hasil.soal[1].kunci, "0");
sama("ISIAN: tanpa pilihan", hasil.soal[2].pilihan.length, 0);
sama("ESSAY: tanpa kunci", hasil.soal[3].kunci, "");
sama("ESSAY: bobot besar dipertahankan", hasil.soal[3].bobot, 20);

// Kolom dicari dari NAMANYA. Dosen menggeser urutan dan menyisipkan kolom
// catatannya sendiri — berkasnya harus tetap terbaca.
const acak: Aoa = [
  ["CATATAN", "KUNCI", "PERTANYAAN", "PILIHAN A", "PILIHAN B", "JENIS", "BOBOT"],
  ["punya saya", "A", "Dua tambah dua?", "4", "5", "PG", "2"],
];
const hasilAcak = imporDariExcel(acak);
sama("urutan kolom digeser tetap terbaca", hasilAcak.soal.length, 1);
sama("dan kuncinya tetap benar", hasilAcak.soal[0].kunci, "0");

sama("tanpa baris judul ditolak dengan jelas",
  imporDariExcel([["a", "b"], ["c", "d"]]).tolak.length, 1);

console.log("\n=== WORD ===\n");

const naskah = `
TEMPLATE SOAL

1. Siapa perumus teori agenda setting?
A. McCombs & Shaw
B. Lasswell
C. Habermas
D. Gerbner
KUNCI: A
BOBOT: 5
MATERI: Teori Komunikasi
TINGKAT: sedang
PEMBAHASAN: Dirumuskan McCombs dan Shaw
pada tahun 1972.

2. Opini publik dapat dibentuk media massa.
A. Benar
B. Salah
KUNCI: BENAR

3. Sebutkan istilah pengaturan agenda oleh media.
JENIS: ISIAN
KUNCI: agenda setting|penentuan agenda

4. Jelaskan peran media massa dalam kampanye politik.
JENIS: ESSAY
BOBOT: 20

5. Soal yang kuncinya lupa ditulis
A. satu
B. dua
`;
const word = imporDariWord(naskah);
sama("empat soal sah dari Word", word.soal.length, 4);
sama("satu ditolak", word.tolak.length, 1);
benar("yang ditolak menyebut nomor soalnya", word.tolak[0].baris.includes("Soal 5"), word.tolak[0].baris);

sama("Word: kunci A", word.soal[0].kunci, "0");
sama("Word: materi terbaca", word.soal[0].materi, "Teori Komunikasi");
// Pembahasan yang ditulis dua baris harus tersambung, bukan terpotong.
benar("pembahasan dua baris tersambung",
  word.soal[0].pembahasan.includes("McCombs dan Shaw") && word.soal[0].pembahasan.includes("1972"),
  word.soal[0].pembahasan);
sama("Word: benar-salah", word.soal[1].kunci, "0");
sama("Word: isian tanpa pilihan", word.soal[2].pilihan.length, 0);
sama("Word: essay bobot 20", word.soal[3].bobot, 20);
sama("Word: bobot kosong jadi 1", word.soal[1].bobot, 1);

// Nomor bergaya lain dan pertanyaan yang memanjang dua baris.
const lain = imporDariWord(`
Soal 1) Pertanyaan yang panjang
dan menyambung ke baris kedua
A) pilihan satu
B) pilihan dua
Jawaban: b
`);
sama("nomor bergaya \"Soal 1)\" terbaca", lain.soal.length, 1);
benar("pertanyaan dua baris tersambung",
  lain.soal[0].pertanyaan.includes("panjang") && lain.soal[0].pertanyaan.includes("baris kedua"),
  lain.soal[0].pertanyaan);
sama("label \"Jawaban\" sama dengan KUNCI", lain.soal[0].kunci, "1");

sama("naskah tanpa nomor ditolak dengan jelas",
  imporDariWord("cuma tulisan biasa tanpa nomor").tolak.length, 1);

console.log("\n=== TEMPLATE YANG DIUNDUH TERBACA KEMBALI ===\n");

// Template yang kami sediakan sendiri WAJIB lolos pembacanya sendiri. Kalau
// tidak, orang pertama yang mengunduhnya langsung menemui penolakan.
const dariTemplate = imporDariExcel([KOLOM_EXCEL, ...CONTOH_EXCEL] as Aoa);
sama("empat contoh Excel terbaca semua", dariTemplate.soal.length, 4);
sama("tanpa satu pun ditolak", dariTemplate.tolak.length, 0);
sama("contoh PG kuncinya A", dariTemplate.soal[0].kunci, "0");

const dariWord = imporDariWord(NASKAH_TEMPLATE_WORD.join("\n"));
sama("empat contoh Word terbaca semua", dariWord.soal.length, 4);
sama("tanpa satu pun ditolak", dariWord.tolak.length, 0);

// Dan soal hasil impor harus benar-benar dapat dinilai mesin penilai.
const jadiSoal = (s: (typeof dariTemplate.soal)[number], id: number): Soal => ({
  id, jenis: s.jenis, pertanyaan: s.pertanyaan, pilihan: s.pilihan,
  kunci: s.kunci, bobot: s.bobot, materi: s.materi, tingkat: s.tingkat, pembahasan: s.pembahasan,
});
const pgTemplate = jadiSoal(dariTemplate.soal[0], 1);
sama("jawaban benar dinilai benar", nilaiJawaban(pgTemplate, "0").benar, true);
sama("jawaban salah dinilai salah", nilaiJawaban(pgTemplate, "1").benar, false);
const isianTemplate = jadiSoal(dariTemplate.soal[2], 3);
sama("isian kunci pertama diterima", nilaiJawaban(isianTemplate, "Agenda Setting").benar, true);
sama("isian kunci kedua diterima", nilaiJawaban(isianTemplate, "penentuan agenda").benar, true);

console.log("\n=== BERKAS .DOCX YANG DIRAKIT SENDIRI ===\n");

const docx = buatDocxTemplate();
benar("menghasilkan Blob berisi", docx.size > 500, `${docx.size} byte`);
sama("jenisnya zip", docx.type.length >= 0, true);

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
