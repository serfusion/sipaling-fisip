// Uji template rubrik dan pembacanya (v46).
//
// Dua hal yang diuji, dan yang kedua paling menentukan:
//
//   1. PEMBACANYA — Excel dan Word, termasuk isian yang ditulis seenaknya:
//      bobot berakhiran %, label huruf kecil, kolom yang digeser, deskriptor
//      yang dipotong Enter.
//   2. PUTARANNYA UTUH — template yang dirakit portal harus dapat dibaca
//      kembali oleh pengimpor portal sendiri, dan rubrik yang diunduh lalu
//      diunggah kembali harus menghasilkan rubrik yang sama persis. Template
//      yang cantik tetapi ditolak pengimpornya lebih buruk daripada tabel
//      mentah.
//
// Berjalan tanpa basis data, tanpa Supabase, dan tanpa peramban.
import * as XLSX from "xlsx";

import {
  bacaBobot, bacaLabel, imporRubrikExcel, imporRubrikWord, rakitRubrik, type Aoa,
} from "@/lib/impor-rubrik";
import {
  LEMBAR_RUBRIK, buatDocxRubrik, buatXlsxDariRubrik, buatXlsxRubrik, naskahWordRubrik,
} from "@/lib/template-rubrik";
import { MIME_DOCX } from "@/lib/template-docx";
import { MIME_XLSX } from "@/lib/template-xlsx";
import { RUBRIK_BAWAAN, periksaRubrik, type Rubrik } from "@/lib/rubrik";

let lulus = 0;
let gagal = 0;
const ok = (nama: string, syarat: boolean, keterangan = "") => {
  if (syarat) { lulus += 1; console.log(`  ✓ ${nama}`); }
  else { gagal += 1; console.log(`  ✗ ${nama}${keterangan ? ` — ${keterangan}` : ""}`); }
};

/** Lembar Excel apa adanya, seperti yang dikirim peramban ke pengimpor. */
function lembarAoa(berkas: Buffer, nama: string): Aoa {
  const kerja = XLSX.read(berkas, { type: "buffer" });
  const lembar = kerja.Sheets[nama] ?? kerja.Sheets[kerja.SheetNames[0]];
  return XLSX.utils.sheet_to_json(lembar, { header: 1, defval: "", raw: false }) as Aoa;
}

// ------------------------------------------------------------
console.log("\n=== BOBOT DARI TULISAN BEBAS ===\n");

ok("angka biasa", bacaBobot("30") === 30);
ok("berakhiran persen", bacaBobot("30%") === 30);
ok("berspasi sebelum persen", bacaBobot("25 %") === 25);
ok("pecahan koma dibaca sebagai persen", bacaBobot("0,3") === 30, String(bacaBobot("0,3")));
ok("pecahan titik dibaca sebagai persen", bacaBobot("0.25") === 25, String(bacaBobot("0.25")));
ok("angka dari Excel", bacaBobot(20) === 20);
ok("kosong menjadi nol", bacaBobot("") === 0 && bacaBobot(null) === 0);
ok("tulisan bukan angka menjadi nol", bacaBobot("sepertiga") === 0);
ok("lebih dari seratus dijepit", bacaBobot("250") === 100);

// ------------------------------------------------------------
console.log("\n=== LABEL PADA LEMBAR ===\n");

const lembarLabel: Aoa = [
  ["NAMA RUBRIK", "Rubrik Esai Metodologi"],
  ["Keterangan:", "Untuk soal metodologi"],
  ["LEVEL TERTINGGI", 5],
  ["Nama dan gelar", 30],
];
ok("label bernilai di sel sebelahnya", bacaLabel(lembarLabel, /^(NAMA RUBRIK)\s*(?=[:=]|$)/i) === "Rubrik Esai Metodologi");
ok("label huruf kecil dan bertitik dua tetap terbaca",
   bacaLabel(lembarLabel, /^(KETERANGAN)\s*(?=[:=]|$)/i) === "Untuk soal metodologi");
ok("angka sebagai nilai label", bacaLabel(lembarLabel, /^(LEVEL TERTINGGI)\s*(?=[:=]|$)/i) === "5");
ok("label dalam satu sel", bacaLabel([["NAMA RUBRIK: Rubrik Singkat"]], /^(NAMA RUBRIK)\s*(?=[:=]|$)/i) === "Rubrik Singkat");
// Inilah sebab pola labelnya berjangkar: tanpa itu "Nama dan gelar" terbaca
// sebagai label NAMA, dan yang diambil sebagai nilainya adalah bobotnya.
ok("kriteria bernama \"Nama dan gelar\" TIDAK dibaca sebagai label",
   bacaLabel(lembarLabel, /^(NAMA)\s*(?=[:=]|$)/i) !== "30",
   bacaLabel(lembarLabel, /^(NAMA)\s*(?=[:=]|$)/i));

// ------------------------------------------------------------
console.log("\n=== EXCEL: ISIAN YANG WAJAR ===\n");

const excelWajar: Aoa = [
  ["NAMA RUBRIK", "Rubrik Esai Metodologi"],
  ["KETERANGAN", "Untuk soal esai metodologi penelitian"],
  [],
  ["KRITERIA", "BOBOT %", "LEVEL 1", "LEVEL 2", "LEVEL 3", "LEVEL 4", "LEVEL 5", "LEVEL 6"],
  ["Ketepatan Konsep", "40%", "Keliru", "Sebagian tepat", "Tepat", "Tepat & menyeluruh", "", ""],
  ["Argumentasi", 35, "Tidak ada", "Lemah", "Jelas", "Kuat", "", ""],
  ["Referensi", 25, "Tidak ada", "Minim", "Cukup", "Kuat", "", ""],
  ["", "", "", "", "", "", "", ""],
];
const bacaWajar = imporRubrikExcel(excelWajar);
ok("terbaca", bacaWajar.ok, bacaWajar.ok ? "" : bacaWajar.pesan);
if (bacaWajar.ok) {
  const r = bacaWajar.rubrik;
  ok("namanya terbaca", r.nama === "Rubrik Esai Metodologi", r.nama);
  ok("keterangannya terbaca", r.keterangan.startsWith("Untuk soal esai"), r.keterangan);
  ok("tiga kriteria", r.kriteria.length === 3, String(r.kriteria.length));
  ok("baris kosong di bawah dilewati", r.kriteria.every((k) => k.nama !== ""));
  ok("bobot berakhiran % tetap 40", r.kriteria[0].bobot === 40, String(r.kriteria[0].bobot));
  ok("skala terbaca 1–4 dari kolom yang terisi", r.skalaMax === 4, String(r.skalaMax));
  ok("tiap kriteria punya empat level", r.kriteria.every((k) => k.levels.length === 4));
  ok("deskriptor level 3 kriteria pertama", r.kriteria[0].levels[2].deskriptor === "Tepat");
  ok("rubriknya lolos periksaRubrik", periksaRubrik(r).ok, JSON.stringify(periksaRubrik(r)));
  // Isian yang benar TIDAK menghasilkan catatan apa pun: kotak kuning yang
  // muncul pada setiap unggahan adalah kotak yang berhenti dibaca.
  ok("isian yang benar tidak menghasilkan catatan apa pun",
     bacaWajar.catatan.length === 0, JSON.stringify(bacaWajar.catatan));
}

// ------------------------------------------------------------
console.log("\n=== EXCEL: KOLOM DIGESER DAN DIHAPUS ===\n");

const excelGeser: Aoa = [
  ["Catatan dosen", "KRITERIA", "LEVEL 1", "LEVEL 2", "LEVEL 3", "BOBOT"],
  ["abaikan", "Kebenaran Isi", "Keliru", "Separuh", "Benar", 60],
  ["abaikan", "Kejelasan", "Sulit", "Cukup", "Jelas", 40],
];
const bacaGeser = imporRubrikExcel(excelGeser);
ok("kolom yang digeser tetap terbaca", bacaGeser.ok, bacaGeser.ok ? "" : bacaGeser.pesan);
if (bacaGeser.ok) {
  ok("dua kriteria", bacaGeser.rubrik.kriteria.length === 2);
  ok("bobot dari kolom paling kanan", bacaGeser.rubrik.kriteria[0].bobot === 60, String(bacaGeser.rubrik.kriteria[0].bobot));
  ok("skala tiga tingkat", bacaGeser.rubrik.skalaMax === 3, String(bacaGeser.rubrik.skalaMax));
  ok("nama rubrik yang tidak ada diberi catatan",
     bacaGeser.catatan.some((c) => c.toLowerCase().includes("nama rubrik")), JSON.stringify(bacaGeser.catatan));
}

// ------------------------------------------------------------
console.log("\n=== EXCEL: BOBOT KOSONG DAN BOBOT YANG TIDAK 100 ===\n");

const tanpaBobot = imporRubrikExcel([
  ["KRITERIA", "BOBOT %", "LEVEL 1", "LEVEL 2", "LEVEL 3"],
  ["A", "", "x", "y", "z"],
  ["B", "", "x", "y", "z"],
  ["C", "", "x", "y", "z"],
]);
ok("bobot kosong dibagi rata", tanpaBobot.ok && tanpaBobot.rubrik.kriteria.map((k) => k.bobot).join(",") === "34,33,33",
   tanpaBobot.ok ? tanpaBobot.rubrik.kriteria.map((k) => k.bobot).join(",") : tanpaBobot.pesan);
ok("pembagian rata disebut dalam catatan",
   tanpaBobot.ok && tanpaBobot.catatan.some((c) => c.toLowerCase().includes("dibagi rata")));
ok("hasil bagi rata tetap berjumlah tepat 100",
   tanpaBobot.ok && tanpaBobot.rubrik.kriteria.reduce((n, k) => n + k.bobot, 0) === 100,
   tanpaBobot.ok ? String(tanpaBobot.rubrik.kriteria.reduce((n, k) => n + k.bobot, 0)) : "");

const bobotMiring = imporRubrikExcel([
  ["KRITERIA", "BOBOT", "LEVEL 1", "LEVEL 2", "LEVEL 3"],
  ["A", 50, "x", "y", "z"],
  ["B", 45, "x", "y", "z"],
]);
ok("bobot 95 tetap masuk, tetapi diberi catatan",
   bobotMiring.ok && bobotMiring.catatan.some((c) => c.includes("95%")),
   bobotMiring.ok ? JSON.stringify(bobotMiring.catatan) : bobotMiring.pesan);
ok("dan periksaRubrik-nya memang menolak — dosen harus membetulkannya dulu",
   bobotMiring.ok && !periksaRubrik(bobotMiring.rubrik).ok);

// ------------------------------------------------------------
console.log("\n=== EXCEL: YANG DITOLAK ===\n");

const tanpaKepala = imporRubrikExcel([["Rubrik saya"], ["Ketepatan", 40]]);
ok("lembar tanpa baris judul kolom ditolak", !tanpaKepala.ok);
ok("penolakannya menyebut kolom yang dicari",
   !tanpaKepala.ok && tanpaKepala.pesan.includes("KRITERIA"), !tanpaKepala.ok ? tanpaKepala.pesan : "");

const kepalaTanpaIsi = imporRubrikExcel([
  ["KRITERIA", "BOBOT %", "LEVEL 1", "LEVEL 2", "LEVEL 3"],
  ["", "", "", "", ""],
]);
ok("tabel kosong ditolak dengan sebabnya", !kepalaTanpaIsi.ok && kepalaTanpaIsi.pesan.includes("KRITERIA"),
   !kepalaTanpaIsi.ok ? kepalaTanpaIsi.pesan : "");

// ------------------------------------------------------------
console.log("\n=== SKALA: YANG TERTULIS MENANG ===\n");

const skalaDitulis = imporRubrikExcel([
  ["LEVEL TERTINGGI", 5],
  ["KRITERIA", "BOBOT", "LEVEL 1", "LEVEL 2", "LEVEL 3", "LEVEL 4", "LEVEL 5"],
  ["A", 100, "a", "b", "c", "d", ""],
]);
ok("skala 1–5 walau deskriptor level 5 belum ditulis",
   skalaDitulis.ok && skalaDitulis.rubrik.skalaMax === 5,
   skalaDitulis.ok ? String(skalaDitulis.rubrik.skalaMax) : skalaDitulis.pesan);
ok("level kelima ada dan kosong",
   skalaDitulis.ok && skalaDitulis.rubrik.kriteria[0].levels.length === 5 &&
   skalaDitulis.rubrik.kriteria[0].levels[4].deskriptor === "");

const duaLevel = rakitRubrik({
  nama: "Dua level saja", keterangan: "",
  kriteria: [{ nama: "A", bobot: 100, deskriptor: ["kurang", "baik"] }],
});
ok("dua level dinaikkan menjadi tiga, batas terendah rubrik",
   duaLevel.ok && duaLevel.rubrik.skalaMax === 3, duaLevel.ok ? String(duaLevel.rubrik.skalaMax) : duaLevel.pesan);
ok("kenaikannya disebut dalam catatan",
   duaLevel.ok && duaLevel.catatan.some((c) => c.includes("tingkat")), duaLevel.ok ? JSON.stringify(duaLevel.catatan) : "");

const tujuhLevel = rakitRubrik({
  nama: "Tujuh level", keterangan: "",
  kriteria: [{ nama: "A", bobot: 100, deskriptor: ["1", "2", "3", "4", "5", "6", "7"] }],
});
ok("tujuh level dipotong menjadi enam",
   tujuhLevel.ok && tujuhLevel.rubrik.skalaMax === 6, tujuhLevel.ok ? String(tujuhLevel.rubrik.skalaMax) : tujuhLevel.pesan);

const tigaBelas = rakitRubrik({
  nama: "Banyak sekali", keterangan: "",
  kriteria: Array.from({ length: 13 }, (_, i) => ({ nama: `K${i + 1}`, bobot: 0, deskriptor: ["a", "b", "c"] })),
});
ok("kriteria lebih dari dua belas dipotong",
   tigaBelas.ok && tigaBelas.rubrik.kriteria.length === 12,
   tigaBelas.ok ? String(tigaBelas.rubrik.kriteria.length) : tigaBelas.pesan);
ok("pemotongannya disebut dalam catatan",
   tigaBelas.ok && tigaBelas.catatan.some((c) => c.includes("13")));

// ------------------------------------------------------------
console.log("\n=== WORD ===\n");

const wordWajar = imporRubrikWord([
  "TEMPLATE RUBRIK PENILAIAN ESAI",
  "",
  "NAMA RUBRIK: Rubrik Presentasi",
  "Keterangan: Untuk penilaian presentasi kelompok",
  "LEVEL TERTINGGI: 4",
  "",
  "KRITERIA 1: Penguasaan Materi",
  "BOBOT: 50",
  "LEVEL 1: Tidak menguasai.",
  "LEVEL 2: Menguasai sebagian,",
  "  dan masih membaca catatan sepanjang waktu.",
  "LEVEL 3: Menguasai.",
  "LEVEL 4: Menguasai dan menjawab pertanyaan di luar naskah.",
  "",
  "kriteria 2: Kejelasan Penyampaian",
  "bobot: 50",
  "level 1: Sulit diikuti.",
  "level 2: Dapat diikuti sebagian.",
  "level 3: Jelas.",
  "level 4: Jelas dan menarik.",
].join("\n"));

ok("naskah Word terbaca", wordWajar.ok, wordWajar.ok ? "" : wordWajar.pesan);
if (wordWajar.ok) {
  const r = wordWajar.rubrik;
  ok("namanya terbaca", r.nama === "Rubrik Presentasi", r.nama);
  ok("keterangan berlabel huruf kecil terbaca", r.keterangan.includes("presentasi kelompok"), r.keterangan);
  ok("dua kriteria", r.kriteria.length === 2, String(r.kriteria.length));
  ok("\"KRITERIA 1:\" bernomor tetap terbaca", r.kriteria[0].nama === "Penguasaan Materi", r.kriteria[0].nama);
  ok("label huruf kecil tetap terbaca", r.kriteria[1].nama === "Kejelasan Penyampaian", r.kriteria[1].nama);
  ok("bobotnya terbaca", r.kriteria[0].bobot === 50 && r.kriteria[1].bobot === 50);
  ok("baris sambungan digabung ke deskriptor sebelumnya",
     r.kriteria[0].levels[1].deskriptor === "Menguasai sebagian, dan masih membaca catatan sepanjang waktu.",
     r.kriteria[0].levels[1].deskriptor);
  ok("judul naskah tidak menjadi kriteria", r.kriteria.every((k) => !k.nama.includes("TEMPLATE")));
  ok("lolos periksaRubrik", periksaRubrik(r).ok, JSON.stringify(periksaRubrik(r)));
}

const wordTabel = imporRubrikWord("Kriteria\nBobot\nLevel 1\nKetepatan\n40\nKeliru");
ok("naskah tanpa label ditolak", !wordTabel.ok);
ok("penolakannya menyarankan Excel untuk rubrik berbentuk tabel",
   !wordTabel.ok && wordTabel.pesan.includes("Excel"), !wordTabel.ok ? wordTabel.pesan : "");

// ------------------------------------------------------------
console.log("\n=== PUTARAN UTUH: TEMPLATE → PEMBACA ===\n");

async function jalan() {
  const xlsx = buatXlsxRubrik();
  ok("jenis isinya jenis Excel, bukan zip", xlsx.type === MIME_XLSX, xlsx.type);
  const buf = Buffer.from(await xlsx.arrayBuffer());
  ok("berawal tanda zip PK", buf[0] === 0x50 && buf[1] === 0x4b);

  const kerja = XLSX.read(buf, { type: "buffer" });
  ok("tiga lembar: Rubrik, Contoh, Petunjuk",
     kerja.SheetNames.join(",") === `${LEMBAR_RUBRIK},Contoh,Petunjuk`, kerja.SheetNames.join(","));

  // Lembar yang diisi HARUS kosong: contoh yang duduk di lembar isian akan
  // bercampur ke dalam rubrik dosen, bukan berdiri sebagai rubrik lain.
  const kosong = imporRubrikExcel(lembarAoa(buf, LEMBAR_RUBRIK));
  ok("lembar \"Rubrik\" pada template masih kosong isinya", !kosong.ok,
     kosong.ok ? JSON.stringify(kosong.rubrik.kriteria.map((k) => k.nama)) : "");

  // Lembar contohnya harus terbaca sempurna oleh pembacanya sendiri: itu satu-
  // satunya bukti bahwa bentuk yang diajarkan template memang bentuk yang
  // diterima portal.
  const contoh = imporRubrikExcel(lembarAoa(buf, "Contoh"));
  ok("lembar \"Contoh\" terbaca pembacanya sendiri", contoh.ok, contoh.ok ? "" : contoh.pesan);
  if (contoh.ok) {
    const asal = RUBRIK_BAWAAN[1];
    ok("namanya sama dengan rubrik bawaan yang dicontohkan", contoh.rubrik.nama === asal.nama, contoh.rubrik.nama);
    ok("jumlah kriterianya sama", contoh.rubrik.kriteria.length === asal.kriteria.length);
    ok("skalanya sama", contoh.rubrik.skalaMax === asal.skalaMax, String(contoh.rubrik.skalaMax));
    ok("bobotnya sama", contoh.rubrik.kriteria.map((k) => k.bobot).join(",") === asal.kriteria.map((k) => k.bobot).join(","),
       contoh.rubrik.kriteria.map((k) => k.bobot).join(","));
    ok("deskriptornya sama persis",
       JSON.stringify(contoh.rubrik.kriteria.map((k) => k.levels)) === JSON.stringify(asal.kriteria.map((k) => k.levels)));
    ok("contohnya sendiri lolos periksaRubrik", periksaRubrik(contoh.rubrik).ok);
  }

  console.log("\n=== PUTARAN UTUH: RUBRIK TERSIMPAN → EXCEL → PEMBACA ===\n");

  // Rubrik berskala 1–5 yang level 5-nya sengaja dibiarkan kosong: inilah
  // keadaan yang membuat skala turun sendiri menjadi 1–4 bila berkasnya tidak
  // menyebut level tertingginya.
  const asli: Rubrik = {
    nama: "Rubrik Uji Putaran",
    keterangan: "Dipakai memastikan unduhan dapat diunggah kembali",
    skalaMin: 1,
    skalaMax: 5,
    kriteria: [
      { nama: "Analisis", bobot: 60, levels: [1, 2, 3, 4, 5].map((l) => ({ level: l, deskriptor: l === 5 ? "" : `Tingkat ${l}` })) },
      { nama: "Bahasa & Sistematika", bobot: 40, levels: [1, 2, 3, 4, 5].map((l) => ({ level: l, deskriptor: l === 5 ? "" : `Bahasa ${l}` })) },
    ],
  };
  const turun = Buffer.from(await buatXlsxDariRubrik(asli).arrayBuffer());
  const kembali = imporRubrikExcel(lembarAoa(turun, LEMBAR_RUBRIK));
  ok("unduhan rubrik terbaca kembali", kembali.ok, kembali.ok ? "" : kembali.pesan);
  if (kembali.ok) {
    ok("namanya utuh", kembali.rubrik.nama === asli.nama, kembali.rubrik.nama);
    ok("keterangannya utuh", kembali.rubrik.keterangan === asli.keterangan, kembali.rubrik.keterangan);
    ok("skala 1–5 tidak turun menjadi 1–4", kembali.rubrik.skalaMax === 5, String(kembali.rubrik.skalaMax));
    ok("bobotnya utuh", kembali.rubrik.kriteria.map((k) => k.bobot).join(",") === "60,40",
       kembali.rubrik.kriteria.map((k) => k.bobot).join(","));
    ok("seluruh deskriptornya utuh",
       JSON.stringify(kembali.rubrik.kriteria.map((k) => k.levels)) === JSON.stringify(asli.kriteria.map((k) => k.levels)),
       JSON.stringify(kembali.rubrik.kriteria[0].levels));
  }

  console.log("\n=== PUTARAN UTUH: TEMPLATE WORD → PEMBACA ===\n");

  const docx = buatDocxRubrik();
  ok("jenis isinya jenis Word, bukan zip", docx.type === MIME_DOCX, docx.type);
  const bufDocx = Buffer.from(await docx.arrayBuffer());
  ok("berawal tanda zip PK", bufDocx[0] === 0x50 && bufDocx[1] === 0x4b);
  ok("ukurannya masuk akal", bufDocx.length > 1500, String(bufDocx.length));

  // Naskahnya diuji langsung: yang dibaca pengimpor adalah teks yang sama,
  // karena mammoth hanya mengambil teks tiap paragraf.
  const dariWord = imporRubrikWord(naskahWordRubrik().join("\n"));
  ok("naskah template Word terbaca pembacanya sendiri", dariWord.ok, dariWord.ok ? "" : dariWord.pesan);
  if (dariWord.ok) {
    const asal = RUBRIK_BAWAAN[1];
    ok("namanya sama", dariWord.rubrik.nama === asal.nama, dariWord.rubrik.nama);
    ok("kriterianya sama banyak", dariWord.rubrik.kriteria.length === asal.kriteria.length,
       String(dariWord.rubrik.kriteria.length));
    ok("bobotnya sama", dariWord.rubrik.kriteria.map((k) => k.bobot).join(",") === asal.kriteria.map((k) => k.bobot).join(","),
       dariWord.rubrik.kriteria.map((k) => k.bobot).join(","));
    ok("deskriptornya sama persis",
       JSON.stringify(dariWord.rubrik.kriteria.map((k) => k.levels)) === JSON.stringify(asal.kriteria.map((k) => k.levels)));
    ok("petunjuk di kepala naskah tidak ikut menjadi kriteria",
       dariWord.rubrik.kriteria.every((k) => !k.nama.startsWith("-")));
    ok("lolos periksaRubrik", periksaRubrik(dariWord.rubrik).ok, JSON.stringify(periksaRubrik(dariWord.rubrik)));
  }

  console.log(`\n${gagal === 0 ? `SEMUA ${lulus} UJI LULUS` : `${gagal} GAGAL dari ${lulus + gagal}`}\n`);
  process.exit(gagal === 0 ? 0 : 1);
}

void jalan();
