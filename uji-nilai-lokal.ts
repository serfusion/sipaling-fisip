// UJI PENILAIAN OTOMATIS TANPA MODEL
//
// Yang dijaga di sini adalah aturan yang kesalahannya TIDAK TERLIHAT sampai
// nilai sudah keluar dan sudah disahkan: jawaban yang mengulang satu kalimat
// sepuluh kali, peserta pertama yang belum punya pembanding, dan kedudukan
// yang salah hitung sehingga seluruh kelas berada di puncak.
//
// Seluruhnya murni. Tidak satu pun uji di sini menyentuh basis data, jaringan,
// atau model — dan itu memang inti fiturnya.

import {
  MIN_PEMBANDING, bacaSinyal, cakupanIstilah, istilahKunci, jumlahKalimat,
  jumlahParagraf, kataDariTeks, kedudukan, kedudukanAmbang, keLevel, nilaiLokal,
} from "./src/lib/nilai-lokal";
import type { Rubrik } from "./src/lib/rubrik";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

const RUBRIK: Rubrik = {
  nama: "Rubrik Esai Umum",
  keterangan: "",
  skalaMin: 1,
  skalaMax: 4,
  kriteria: [
    { nama: "Ketepatan Konsep", bobot: 30, levels: [] },
    { nama: "Argumentasi", bobot: 25, levels: [] },
    { nama: "Analisis", bobot: 25, levels: [] },
    { nama: "Referensi & Contoh", bobot: 20, levels: [] },
  ],
};

console.log("\n=== PEMBACAAN TEKS ===\n");

sama("kata dihitung tanpa tanda baca", kataDariTeks("Halo, dunia! Apa kabar?").length, 4);
benar("angka ikut dihitung sebagai kata", kataDariTeks("pasal 28 tahun 2024").includes("2024"),
  "nomor pasal dan tahun adalah isi jawaban, bukan hiasan");
sama("kalimat dihitung dari titik", jumlahKalimat("Satu. Dua. Tiga."), 3);
sama("tanpa titik tetap satu kalimat", jumlahKalimat("tanpa titik sama sekali"), 1);
sama("teks kosong nol kalimat", jumlahKalimat("   "), 0);
sama("paragraf dipisah baris kosong", jumlahParagraf("a\n\nb\n\nc"), 3);

console.log("\n=== ISTILAH KUNCI ===\n");

const istilah = istilahKunci("Jelaskan teori agenda setting dalam komunikasi politik", "");
benar("kata perintah tidak menjadi istilah kunci", !istilah.includes("jelaskan"),
  "kalau ia ikut, setiap jawaban memuatnya dan sinyalnya mati");
benar("kata umum dibuang", !istilah.includes("dalam"));
benar("istilah isi dipertahankan", istilah.includes("agenda") && istilah.includes("komunikasi"));
benar("kata pendek dibuang", istilah.every((i) => i.length >= 4));

sama("cakupan tanpa istilah adalah nol", cakupanIstilah("apa pun", []), 0);
sama("cakupan penuh", cakupanIstilah("agenda setting komunikasi", ["agenda", "setting", "komunikasi"]), 1);
sama("cakupan separuh", cakupanIstilah("agenda saja", ["agenda", "setting"]), 0.5);

console.log("\n=== KEDUDUKAN DI ANTARA SEKELAS ===\n");

sama("tanpa pembanding, dianggap di tengah", kedudukan(100, []), 0.5);
sama("paling panjang", kedudukan(100, [10, 20, 30]), 1);
sama("paling pendek", kedudukan(5, [10, 20, 30]), 0);
// Inilah aturan yang paling mudah ditulis salah, dan salahnya membuat SELURUH
// kelas berada di puncak ketika jawabannya kebetulan sama panjang.
sama("nilai yang sama berada di tengah, bukan di puncak", kedudukan(20, [20, 20, 20]), 0.5);
benar("kedudukan selalu 0–1", [0, 5, 50, 500].every((n) => {
  const k = kedudukan(n, [10, 20, 30, 40]);
  return k >= 0 && k <= 1;
}));

benar("jawaban kosong tidak melewati satu ambang pun", kedudukanAmbang(0) === 0);
benar("jawaban sangat panjang melewati seluruh ambang", kedudukanAmbang(500) === 1);
benar("ambang naik bertahap", kedudukanAmbang(20) > kedudukanAmbang(5));

console.log("\n=== LEVEL ===\n");

sama("nilai nol jatuh ke level terendah", keLevel(0, 1, 4), 1);
sama("nilai penuh jatuh ke level tertinggi", keLevel(1, 1, 4), 4);
sama("nilai penuh tidak melampaui skala", keLevel(1.5, 1, 4), 4);
sama("skala 1–5 ikut terpakai penuh", keLevel(1, 1, 5), 5);
benar("seluruh nilai 0–1 menghasilkan level di dalam skala", (() => {
  for (let n = 0; n <= 100; n += 1) {
    const l = keLevel(n / 100, 1, 4);
    if (l < 1 || l > 4) return false;
  }
  return true;
})());

console.log("\n=== SINYAL PENGULANGAN ===\n");

const berulang = bacaSinyal("saya setuju. ".repeat(40), []);
const beragam = bacaSinyal(
  "Agenda setting menjelaskan bagaimana media memilih isu yang dianggap penting " +
  "oleh khalayak. Teori ini lahir dari penelitian Chapel Hill. Media tidak " +
  "memberitahu apa yang harus dipikirkan, melainkan tentang apa orang berpikir.",
  [],
);
benar("jawaban yang mengulang punya keragaman rendah", berulang.keragaman < 0.2,
  `keragaman ${berulang.keragaman}`);
benar("jawaban yang beragam punya keragaman tinggi", beragam.keragaman > 0.7,
  `keragaman ${beragam.keragaman}`);

console.log("\n=== USULAN LEVEL ===\n");

const pertanyaan = "Jelaskan teori agenda setting dalam komunikasi politik";
const panjangBagus =
  "Agenda setting adalah teori yang menjelaskan bagaimana media massa memilih " +
  "isu tertentu sehingga isu itu dianggap penting oleh khalayak. Karena itu media " +
  "tidak menentukan apa yang dipikirkan orang, melainkan tentang apa mereka " +
  "berpikir. Dalam komunikasi politik, misalnya, pemberitaan yang terus mengulang " +
  "satu isu membuat isu tersebut menjadi bahan pertimbangan pemilih. Contohnya " +
  "terlihat pada musim kampanye ketika liputan ekonomi meningkat dan kekhawatiran " +
  "pemilih terhadap ekonomi ikut meningkat.";

const pendek = nilaiLokal({ jawaban: "tidak tahu", pertanyaan, acuan: "", rubrik: RUBRIK });
const bagus = nilaiLokal({ jawaban: panjangBagus, pertanyaan, acuan: "", rubrik: RUBRIK });

sama("satu usulan per kriteria", bagus.kriteria.length, RUBRIK.kriteria.length);
benar("jawaban panjang berisi mengungguli jawaban dua kata",
  bagus.kriteria[0].level > pendek.kriteria[0].level,
  `bagus ${bagus.kriteria[0].level}, pendek ${pendek.kriteria[0].level}`);
benar("tiap usulan membawa alasannya",
  bagus.kriteria.every((k) => k.alasan.length > 10 && k.alasan.includes("bukan dari isinya")));
benar("keyakinannya rendah, dan memang harus", bagus.keyakinan < 70,
  "di atas 70 lembar penilaian berhenti menandai 'mohon diperiksa'");
benar("ringkasannya menyebut angka yang dipakai",
  bagus.ringkasan.includes("kata") && bagus.ringkasan.includes("kalimat"));
benar("ringkasannya mengakui batasnya", bagus.ringkasan.includes("BENTUK"));

// Kriteria "Referensi & Contoh" dinilai dari cakupan istilah, bukan panjang —
// tanpa pemisahan ini seluruh kriteria menerima level yang sama dan bobot
// rubrik berhenti berarti apa pun.
const kosongIstilah = nilaiLokal({
  jawaban: "x ".repeat(300), pertanyaan, acuan: "", rubrik: RUBRIK,
});
benar("kriteria referensi tidak ikut naik hanya karena panjang",
  kosongIstilah.kriteria[3].level < kosongIstilah.kriteria[0].level ||
  kosongIstilah.kriteria[3].level === RUBRIK.skalaMin,
  `referensi ${kosongIstilah.kriteria[3].level}, konsep ${kosongIstilah.kriteria[0].level}`);

console.log("\n=== PEMBANDING SEKELAS ===\n");

const sedang = "Agenda setting adalah teori media yang menjelaskan pemilihan isu penting.";
const antaraKelasPendek = nilaiLokal({
  jawaban: sedang, pertanyaan, acuan: "", rubrik: RUBRIK,
  pembandingKata: [3, 4, 5, 6],
});
const antaraKelasPanjang = nilaiLokal({
  jawaban: sedang, pertanyaan, acuan: "", rubrik: RUBRIK,
  pembandingKata: [400, 500, 600, 700],
});
benar("jawaban yang sama dinilai relatif terhadap sekelasnya",
  antaraKelasPendek.kriteria[0].level > antaraKelasPanjang.kriteria[0].level,
  `di kelas pendek ${antaraKelasPendek.kriteria[0].level}, di kelas panjang ${antaraKelasPanjang.kriteria[0].level}`);
benar("alasannya menyebut perbandingannya bila memang relatif",
  antaraKelasPendek.kriteria[0].alasan.includes("jawaban lain"));
benar("tanpa pembanding cukup, alasannya TIDAK mengaku membandingkan",
  !nilaiLokal({ jawaban: sedang, pertanyaan, acuan: "", rubrik: RUBRIK, pembandingKata: [10] })
    .kriteria[0].alasan.includes("jawaban lain"),
  `ambangnya ${MIN_PEMBANDING} pembanding`);

console.log("\n=== JAWABAN YANG MENGULANG ===\n");

const jujur = nilaiLokal({ jawaban: panjangBagus, pertanyaan, acuan: "", rubrik: RUBRIK });
const curang = nilaiLokal({
  jawaban: "agenda setting media politik. ".repeat(30),
  pertanyaan, acuan: "", rubrik: RUBRIK,
});
benar("panjang yang dicapai dengan mengulang tidak setara dengan panjang yang jujur",
  curang.kriteria[0].level <= jujur.kriteria[0].level,
  `curang ${curang.kriteria[0].level}, jujur ${jujur.kriteria[0].level}`);

console.log("\n=== PEMBAHASAN SEBAGAI ACUAN ===\n");

const tanpaAcuan = nilaiLokal({ jawaban: "media memilih isu", pertanyaan, acuan: "", rubrik: RUBRIK });
const denganAcuan = nilaiLokal({
  jawaban: "media memilih isu", pertanyaan,
  acuan: "Jawaban seharusnya menyebut khalayak, salience, dan penelitian Chapel Hill.",
  rubrik: RUBRIK,
});
benar("pembahasan menambah istilah yang dicari",
  denganAcuan.sinyal.istilahTotal > tanpaAcuan.sinyal.istilahTotal,
  `${denganAcuan.sinyal.istilahTotal} lawan ${tanpaAcuan.sinyal.istilahTotal}`);

console.log("\n=== KEADAAN TEPI ===\n");

const kosong = nilaiLokal({ jawaban: "", pertanyaan, acuan: "", rubrik: RUBRIK });
benar("jawaban kosong tetap menghasilkan level terendah, bukan galat",
  kosong.kriteria.every((k) => k.level === RUBRIK.skalaMin));
const tanpaKriteria = nilaiLokal({
  jawaban: panjangBagus, pertanyaan, acuan: "",
  rubrik: { ...RUBRIK, kriteria: [] },
});
sama("rubrik tanpa kriteria menghasilkan daftar kosong", tanpaKriteria.kriteria.length, 0);

console.log("");
if (gagal.length === 0) {
  console.log(`${lulus} periksa lulus`);
  console.log("SEMUA UJI LULUS");
} else {
  console.log(`${lulus} periksa lulus`);
  console.log(`\n${gagal.length} GAGAL:`);
  for (const g of gagal) console.log(`  ✗ ${g}`);
  process.exit(1);
}
