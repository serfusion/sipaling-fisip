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
  jumlahParagraf, kataDariTeks, kedudukan, kedudukanAmbang, keLevel,
  kesesuaianAcuan, levelDariAmbang, menyalinSoal, ngawur, nilaiLokal, redundansi,
} from "./src/lib/nilai-lokal";
import { RUBRIK_BAWAAN, hitungRubrik, predikat, rubrikBawaan, type Rubrik } from "./src/lib/rubrik";

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
  bagus.kriteria.every((k) => k.alasan.length > 10 && /kata|istilah|kalimat/.test(k.alasan)));
benar("keyakinannya rendah, dan memang harus", bagus.keyakinan < 70,
  "di atas 70 lembar penilaian berhenti menandai 'mohon diperiksa'");
benar("ringkasannya menyebut angka yang dipakai",
  bagus.ringkasan.includes("kata") && bagus.ringkasan.includes("kalimat"));
benar("tanpa acuan, ringkasannya mengakui batasnya dan menunjuk jalan keluarnya",
  bagus.ringkasan.includes("Pembahasan"));

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

console.log("\n=== AMBANG PANJANG DARI RUBRIK ===\n");

const BERAMBANG = [
  { level: 1, minKata: 0, deskriptor: "" },
  { level: 2, minKata: 25, deskriptor: "" },
  { level: 3, minKata: 70, deskriptor: "" },
  { level: 4, minKata: 140, deskriptor: "" },
];

sama("kosong jatuh ke level terendah", levelDariAmbang(0, BERAMBANG), 1);
sama("tepat di ambang sudah naik", levelDariAmbang(25, BERAMBANG), 2);
sama("satu kata di bawah ambang belum naik", levelDariAmbang(24, BERAMBANG), 1);
sama("di antara dua ambang memakai yang bawah", levelDariAmbang(100, BERAMBANG), 3);
sama("melampaui ambang tertinggi tetap level tertinggi", levelDariAmbang(9999, BERAMBANG), 4);
benar("level tanpa ambang sama sekali dilewati",
  levelDariAmbang(500, [{ level: 1, deskriptor: "" }, { level: 2, deskriptor: "" }]) === null,
  "kriteria tanpa ambang harus jatuh ke tangga bawaan, bukan dipaksa");

const RUBRIK_AMBANG: Rubrik = {
  nama: "Berambang", keterangan: "", skalaMin: 1, skalaMax: 4,
  kriteria: [{ nama: "Isi", bobot: 100, levels: BERAMBANG }],
};
// Ambang adalah LANGIT-LANGIT, bukan penentu. Mengetik satu kata yang sama
// 150 kali melewati seluruh ambang panjang, dan justru itulah yang tidak
// boleh menghasilkan level tertinggi.
const pakaiAmbang = nilaiLokal({
  jawaban: "kata ".repeat(150), pertanyaan: "apa saja", acuan: "", rubrik: RUBRIK_AMBANG,
});
benar("melewati ambang panjang saja TIDAK menghasilkan level tertinggi",
  pakaiAmbang.kriteria[0].level < 4,
  `level ${pakaiAmbang.kriteria[0].level} untuk 150 kata yang sama diulang`);

// Yang tidak boleh berubah: nilai final tidak bergantung pada siapa yang
// mengumpulkan lebih dulu.
const denganPembandingPanjang = nilaiLokal({
  jawaban: "kata ".repeat(150), pertanyaan: "apa saja", acuan: "",
  rubrik: RUBRIK_AMBANG, pembandingKata: [900, 950, 1000, 1100],
});
sama("level tidak berubah karena sekelasnya lebih panjang",
  denganPembandingPanjang.kriteria[0].level, pakaiAmbang.kriteria[0].level);

console.log("\n=== RUBRIK BAWAAN SIAP MENILAI SENDIRI ===\n");

benar("seluruh rubrik bawaan sudah berambang",
  RUBRIK_BAWAAN.every((r) => r.kriteria.every((k) => k.levels.some((l) => (l.minKata ?? 0) > 0))),
  "rubrik yang baru disalin harus langsung dapat menilai tanpa disetel");
benar("ambangnya naik seiring levelnya",
  RUBRIK_BAWAAN.every((r) => r.kriteria.every((k) => {
    const urut = [...k.levels].sort((a, b) => a.level - b.level);
    return urut.every((l, i) => i === 0 || (l.minKata ?? 0) >= (urut[i - 1].minKata ?? 0));
  })));

console.log("\n=== CONTOH DARI LAMPIRAN: 3,65 → 91,25 ===\n");

// Angka dari laporan_penilaian_proposal_kampanye.md, dijadikan uji supaya
// rumusnya tidak dapat bergeser diam-diam.
const kampanye = rubrikBawaan("Rubrik Proposal Kampanye");
benar("rubrik proposal kampanye ada", kampanye !== null);
if (kampanye) {
  const hasil = hitungRubrik(kampanye, [
    { aiLevel: 3, finalLevel: null },
    { aiLevel: 4, finalLevel: null },
    { aiLevel: 4, finalLevel: null },
    { aiLevel: 3, finalLevel: null },
    { aiLevel: 4, finalLevel: null },
  ]);
  sama("total skor terbobot", hasil.totalTerbobot, 3.65);
  sama("nilai akhir", hasil.nilai, 91.25);
  sama("predikat", predikat(hasil.nilai).huruf, "A");
}

console.log("\n=== PENANGKAL AKAL-AKALAN ===\n");

benar("kalimat yang diulang tertangkap", redundansi("Saya setuju. ".repeat(10)) > 0.8,
  `redundansi ${redundansi("Saya setuju. ".repeat(10))}`);
benar("tulisan yang benar-benar berbeda tidak dianggap mengulang",
  redundansi("Media memilih isu penting. Khalayak lalu memikirkannya. Teori ini lahir di Chapel Hill.") === 0);
benar("huruf asal tertangkap", ngawur("asdfgh qwertyuiop zxcvbnm hjklmn") > 0.5);
benar("kalimat Indonesia wajar tidak dianggap ngawur",
  ngawur("media massa memilih isu yang dianggap penting oleh khalayak") === 0);
benar("singkatan pendek tidak dianggap ngawur", ngawur("DPR dan KPU serta MPR") === 0);
benar("menyalin pertanyaan tertangkap",
  menyalinSoal("Jelaskan teori agenda setting dalam komunikasi politik",
    "Jelaskan teori agenda setting dalam komunikasi politik") > 0.9);
benar("jawaban sungguhan tidak dianggap menyalin soal",
  menyalinSoal("Media menentukan isu apa yang dipikirkan khalayak melalui pemberitaan berulang.",
    "Jelaskan teori agenda setting dalam komunikasi politik") < 0.2);

console.log("\n=== KESESUAIAN DENGAN ACUAN ===\n");

const ACUAN =
  "Agenda setting adalah teori yang menyatakan media massa menentukan isu mana yang " +
  "dianggap penting oleh khalayak. Media tidak memberitahu apa yang harus dipikirkan, " +
  "melainkan tentang apa khalayak berpikir. Teori ini berasal dari penelitian McCombs " +
  "dan Shaw di Chapel Hill.";

const tepatBeda =
  "Teori ini menjelaskan bahwa pemberitaan media menentukan isu mana yang dianggap " +
  "penting khalayak. McCombs dan Shaw membuktikannya lewat penelitian di Chapel Hill. " +
  "Media membentuk tentang apa orang berpikir, bukan apa yang dipikirkan.";
const melencengPanjang =
  "Kemarin saya pergi ke pasar membeli sayur dan ikan segar. Harga cabai sedang naik " +
  "sekali sehingga ibu-ibu mengeluh. Setelah itu saya mampir ke warung kopi bertemu " +
  "teman lama yang baru pulang dari Surabaya membawa oleh-oleh.";

benar("parafrase yang benar tetap dekat dengan acuan",
  kesesuaianAcuan(tepatBeda, ACUAN) > 0.3,
  `kesesuaian ${kesesuaianAcuan(tepatBeda, ACUAN).toFixed(3)}`);
benar("jawaban yang membicarakan hal lain jauh dari acuan",
  kesesuaianAcuan(melencengPanjang, ACUAN) < 0.12,
  `kesesuaian ${kesesuaianAcuan(melencengPanjang, ACUAN).toFixed(3)}`);
benar("parafrase mengungguli jawaban melenceng",
  kesesuaianAcuan(tepatBeda, ACUAN) > kesesuaianAcuan(melencengPanjang, ACUAN));

console.log("\n=== CELAH 'ASAL PANJANG' TERTUTUP ===\n");

const SOAL = "Jelaskan teori agenda setting dalam komunikasi politik";
const RUBRIK_ISI: Rubrik = {
  nama: "Isi", keterangan: "", skalaMin: 1, skalaMax: 4,
  kriteria: [{ nama: "Ketepatan Konsep", bobot: 100, levels: BERAMBANG }],
};

// Inilah uji yang paling menentukan: jawaban PANJANG tetapi melenceng harus
// kalah dari jawaban PENDEK yang tepat. Kalau ini gagal, seluruh fiturnya
// hanya menghadiahi siapa yang paling rajin mengetik.
const panjangMelenceng = nilaiLokal({
  jawaban: melencengPanjang + " " + melencengPanjang,
  pertanyaan: SOAL, acuan: ACUAN, rubrik: RUBRIK_ISI,
});
const pendekTepat = nilaiLokal({
  jawaban: tepatBeda, pertanyaan: SOAL, acuan: ACUAN, rubrik: RUBRIK_ISI,
});
benar("jawaban panjang yang melenceng kalah dari jawaban lebih pendek yang tepat",
  panjangMelenceng.kriteria[0].level < pendekTepat.kriteria[0].level,
  `melenceng(${panjangMelenceng.sinyal.kata} kata) level ${panjangMelenceng.kriteria[0].level}, ` +
  `tepat(${pendekTepat.sinyal.kata} kata) level ${pendekTepat.kriteria[0].level}`);
sama("jawaban panjang yang sama sekali tidak menyentuh acuan jatuh ke level terendah",
  panjangMelenceng.kriteria[0].level, 1);
benar("alasannya menyebut kenapa", panjangMelenceng.kriteria[0].alasan.includes("Tidak menyentuh"));

const ulangPanjang = nilaiLokal({
  jawaban: (tepatBeda + " ").repeat(6),
  pertanyaan: SOAL, acuan: ACUAN, rubrik: RUBRIK_ISI,
});
benar("menggandakan kalimat yang benar tidak menaikkan level",
  ulangPanjang.kriteria[0].level <= pendekTepat.kriteria[0].level,
  `ulang ${ulangPanjang.kriteria[0].level}, asli ${pendekTepat.kriteria[0].level}`);
benar("pengulangan ditandai pada alasannya",
  ulangPanjang.kriteria[0].alasan.includes("mengulang"));

const hurufAsal = nilaiLokal({
  jawaban: "asdfgh qwertyuiop zxcvbnm ".repeat(30),
  pertanyaan: SOAL, acuan: ACUAN, rubrik: RUBRIK_ISI,
});
sama("mengetik huruf asal sepanjang apa pun tetap level terendah",
  hurufAsal.kriteria[0].level, 1);

const salinSoal = nilaiLokal({
  jawaban: (SOAL + " ").repeat(20),
  pertanyaan: SOAL, acuan: ACUAN, rubrik: RUBRIK_ISI,
});
sama("menyalin pertanyaan berulang kali tetap level terendah",
  salinSoal.kriteria[0].level, 1);

console.log("\n=== PANJANG HANYA MEMBATASI ===\n");

// Jawaban tepat tetapi pendek tidak boleh menembus ambang level yang lebih
// tinggi — itu memang arti ambang yang ditulis dosen.
const tepatTapiPendek = nilaiLokal({
  jawaban: "Media menentukan isu penting bagi khalayak.",
  pertanyaan: SOAL, acuan: ACUAN, rubrik: RUBRIK_ISI,
});
benar("jawaban tepat tetapi di bawah ambang tidak menembus level tertinggi",
  tepatTapiPendek.kriteria[0].level < 4,
  `level ${tepatTapiPendek.kriteria[0].level} pada ${tepatTapiPendek.sinyal.kata} kata`);
benar("alasannya mengatakan ia dibatasi ambang bila memang begitu",
  tepatTapiPendek.kriteria[0].alasan.includes("ambang") ||
  tepatTapiPendek.kriteria[0].level === 1);

console.log("\n=== KEYAKINAN ===\n");

benar("ada acuan menaikkan keyakinan", pendekTepat.keyakinan > hurufAsal.keyakinan,
  `tepat ${pendekTepat.keyakinan}, ngawur ${hurufAsal.keyakinan}`);
benar("tanpa acuan keyakinannya selalu di bawah ambang 'mohon diperiksa'",
  nilaiLokal({ jawaban: tepatBeda, pertanyaan: SOAL, acuan: "", rubrik: RUBRIK_ISI }).keyakinan < 70);
benar("tanpa acuan, ringkasannya menyuruh mengisi Pembahasan",
  nilaiLokal({ jawaban: tepatBeda, pertanyaan: SOAL, acuan: "", rubrik: RUBRIK_ISI })
    .ringkasan.includes("Pembahasan"));

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
