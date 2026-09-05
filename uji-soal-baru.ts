// ============================================================
// UJI: PG kompleks, penjodohan, dan media
//
// Dua jenis soal baru dan satu kolom media. Yang paling mudah salah di sini
// bukan bentuknya melainkan PENILAIANNYA — dan salahnya diam-diam: nilai
// keluar, angkanya masuk akal, dan tidak ada yang tahu ia keliru sampai ada
// mahasiswa yang menghitung ulang sendiri.
// ============================================================
import {
  hitungNilai, jawabanKosong, nilaiJawaban, susunPaket, uraiJodoh, uraiKunciJamak,
  MEDIA_KOSONG, type Soal,
} from "./src/lib/cbt";
import { bacaJenis, bacaKunciJamak, bacaMedia, bacaPasangan, imporDariExcel, imporDariWord } from "./src/lib/impor-soal";

let lulus = 0;
let gagal = 0;
function cek(nama: string, syarat: boolean, ket = "") {
  if (syarat) { lulus += 1; console.log(`  ok    ${nama}`); }
  else { gagal += 1; console.log(`  GAGAL ${nama}${ket ? " — " + ket : ""}`); }
}
function bagian(j: string) { console.log(`\n== ${j} ==`); }

const dasar = { materi: "", tingkat: "sedang" as const, pembahasan: "", pasangan: [], media: MEDIA_KOSONG };

// ---------- PG KOMPLEKS ----------
bagian("PG kompleks — penskoran sebagian");
const kompleks: Soal = {
  ...dasar, id: 1, jenis: "pg_kompleks",
  pertanyaan: "Manakah yang termasuk teori komunikasi massa?",
  pilihan: ["Agenda setting", "Kultivasi", "Fotosintesis", "Spiral of silence"],
  kunci: "0,1,3", bobot: 9,
};

cek("kunci terbaca sebagai himpunan", uraiKunciJamak("0,1,3").size === 3);
cek("kunci bertoleransi spasi dan titik koma", uraiKunciJamak(" 0 ; 1,3 ").size === 3);

const semuaBenar = nilaiJawaban(kompleks, "0,1,3");
cek("seluruhnya tepat → poin penuh", semuaBenar.poin === 9 && semuaBenar.benar === true, JSON.stringify(semuaBenar));

const duaDariTiga = nilaiJawaban(kompleks, "0,1");
cek("dua dari tiga → 2/3 poin, belum penuh",
    duaDariTiga.poin === 6 && duaDariTiga.benar === false, JSON.stringify(duaDariTiga));

const adaSalah = nilaiJawaban(kompleks, "0,1,2");
cek("dua tepat satu keliru → (2−1)/3 poin", adaSalah.poin === 3, JSON.stringify(adaSalah));

// Inilah alasan pengurangan itu ada.
const centangSemua = nilaiJawaban(kompleks, "0,1,2,3");
cek("mencentang SEMUA pilihan tidak menghasilkan nilai penuh",
    centangSemua.poin < 9, JSON.stringify(centangSemua));
cek("mencentang semua → (3−1)/3 poin", centangSemua.poin === 6, JSON.stringify(centangSemua));

cek("seluruhnya keliru → nol, tidak minus", nilaiJawaban(kompleks, "2").poin === 0);
cek("tidak dijawab → nol", nilaiJawaban(kompleks, "").poin === 0);

// Pilihan yang diacak harus dipetakan balik.
const petaBalik = [2, 0, 3, 1]; // tampil ke-0 = bank ke-2, dst.
cek("jawaban pada pilihan teracak dipetakan balik ke banknya",
    nilaiJawaban(kompleks, "1,3,2", petaBalik).benar === true,
    JSON.stringify(nilaiJawaban(kompleks, "1,3,2", petaBalik)));

// ---------- PENJODOHAN ----------
bagian("Penjodohan — dinilai per pasangan");
const jodoh: Soal = {
  ...dasar, id: 2, jenis: "penjodohan",
  pertanyaan: "Jodohkan teori dengan perumusnya.",
  pilihan: ["McCombs & Shaw", "Noelle-Neumann", "Gerbner", "Lasswell"],
  kunci: "",
  pasangan: [
    { kiri: "Agenda setting", kanan: 0 },
    { kiri: "Spiral of silence", kanan: 1 },
    { kiri: "Kultivasi", kanan: 2 },
  ],
  bobot: 6,
};

cek("jawaban JSON terbaca", uraiJodoh('{"0":1,"2":0}').get(0) === 1);
cek("jawaban rusak dianggap belum dijawab", uraiJodoh("bukan json").size === 0);

const jodohPenuh = nilaiJawaban(jodoh, '{"0":0,"1":1,"2":2}');
cek("tiga-tiganya tepat → poin penuh", jodohPenuh.poin === 6 && jodohPenuh.benar === true, JSON.stringify(jodohPenuh));

const jodohSebagian = nilaiJawaban(jodoh, '{"0":0,"1":1,"2":3}');
cek("dua dari tiga → 2/3 poin dan belum penuh",
    jodohSebagian.poin === 4 && jodohSebagian.benar === false, JSON.stringify(jodohSebagian));
cek("satu kekeliruan TIDAK menghapus dua yang benar", jodohSebagian.poin > 0);
cek("kosong → nol", nilaiJawaban(jodoh, "{}").poin === 0);

// Pengecoh "Lasswell" tidak berpasangan dengan apa pun, dan itu sah.
cek("pengecoh yang tak berpasangan tidak merusak penilaian",
    nilaiJawaban(jodoh, '{"0":3,"1":3,"2":3}').poin === 0);

// ---------- RINGKASAN NILAI ----------
bagian("Ringkasan nilai — sebagian dihitung terpisah");
const ringkas = hitungNilai([kompleks, jodoh], { 1: "0,1", 2: '{"0":0,"1":1,"2":2}' }, {}, 60);
cek("yang sebagian benar tidak dicap salah", ringkas.sebagian === 1, JSON.stringify(ringkas));
cek("yang penuh dihitung benar", ringkas.benar === 1, JSON.stringify(ringkas));
cek("tidak ada yang dicap salah", ringkas.salah === 0, JSON.stringify(ringkas));
cek("poinnya 6 dari 15", ringkas.poin === 12, JSON.stringify(ringkas));

// ---------- PAKET UNTUK MAHASISWA ----------
bagian("Paket ke mahasiswa — kunci tidak boleh ikut keluar");
const paket = susunPaket([jodoh], { acakSoal: false, acakPilihan: true, jumlahSoal: 1 }, 12345);
const dikirim = JSON.stringify(paket[0]);
cek("kolom kiri ikut terkirim", paket[0].kiri.length === 3, dikirim);
cek("pasangan TIDAK ikut terkirim", !("pasangan" in paket[0]));
cek("kunci TIDAK ikut terkirim", !dikirim.includes('"kunci"'));
cek("media ikut terkirim", paket[0].media.jenis === "");
cek("pilihannya teracak tapi lengkap", paket[0].pilihan.length === 4, dikirim);

// ---------- MEDIA ----------
bagian("Media — jenis ditebak dari tautannya");
cek("mp4 terbaca video", bacaMedia("", "https://x.test/a.mp4", "").jenis === "video");
cek("youtube terbaca video", bacaMedia("", "https://youtu.be/abc", "").jenis === "video");
cek("png terbaca gambar", bacaMedia("", "https://x.test/a.png", "").jenis === "gambar");
cek("jenis yang ditulis dosen menang", bacaMedia("video", "https://x.test/a.png", "").jenis === "video");
cek("tanpa tautan bukan media", bacaMedia("gambar", "", "").jenis === "");

// ---------- IMPOR ----------
bagian("Impor — jenis baru terbaca dari berkas dosen");
cek('"PG Kompleks" tidak jatuh menjadi "pg"', bacaJenis("PG Kompleks") === "pg_kompleks", bacaJenis("PG Kompleks"));
cek('"PGK" terbaca kompleks', bacaJenis("PGK") === "pg_kompleks");
cek('"Penjodohan" terbaca', bacaJenis("Penjodohan") === "penjodohan");
cek('"PG" biasa tetap pg', bacaJenis("PG") === "pg");

const kj = bacaKunciJamak("A,C", ["a", "b", "c", "d"]);
cek('kunci "A,C" → "0,2"', kj.ok && kj.kunci === "0,2", JSON.stringify(kj));
const kj2 = bacaKunciJamak("AC", ["a", "b", "c", "d"]);
cek('kunci menyatu "AC" → "0,2"', kj2.ok && kj2.kunci === "0,2", JSON.stringify(kj2));
const kj3 = bacaKunciJamak("1,3", ["a", "b", "c", "d"]);
cek('kunci angka "1,3" (mulai 1) → "0,2"', kj3.ok && kj3.kunci === "0,2", JSON.stringify(kj3));
const kj4 = bacaKunciJamak("A,B,C,D", ["a", "b", "c", "d"]);
cek("seluruh pilihan ditandai benar ditolak", !kj4.ok, JSON.stringify(kj4));
const kj5 = bacaKunciJamak("F", ["a", "b"]);
cek("kunci menunjuk pilihan yang tidak ada ditolak", !kj5.ok);

const bp = bacaPasangan("Agenda setting = McCombs\nKultivasi = Gerbner", ["Lasswell"]);
cek("pasangan terbaca", bp.ok && bp.pasangan.length === 2, JSON.stringify(bp));
cek("kolom kanan jadi pilihan", bp.ok && bp.pilihan.length === 3, JSON.stringify(bp));
cek("pengecoh ikut masuk pilihan", bp.ok && bp.pilihan.includes("Lasswell"));
cek("pasangan tunggal ditolak", !bacaPasangan("A = B").ok);
cek("pasangan tanpa sisi kanan ditolak", !bacaPasangan("A\nB").ok);

const excel = imporDariExcel([
  ["NO", "JENIS", "PERTANYAAN", "PILIHAN A", "PILIHAN B", "PILIHAN C", "KUNCI", "PASANGAN", "MEDIA", "BOBOT"],
  [1, "PG Kompleks", "Pilih dua yang benar", "Satu", "Dua", "Tiga", "A,C", "", "", 4],
  [2, "Penjodohan", "Jodohkan", "", "", "", "", "Ibu kota Jepang = Tokyo\nIbu kota Korea = Seoul", "", 6],
  [3, "PG", "Bergambar", "Ya", "Tidak", "", "A", "", "https://x.test/peta.png", 2],
]);
cek("tiga baris terbaca tanpa penolakan", excel.soal.length === 3 && excel.tolak.length === 0,
    JSON.stringify(excel.tolak));
cek("baris 1 jadi pg_kompleks kunci 0,2",
    excel.soal[0]?.jenis === "pg_kompleks" && excel.soal[0]?.kunci === "0,2", JSON.stringify(excel.soal[0]));
cek("baris 2 jadi penjodohan dua pasangan",
    excel.soal[1]?.jenis === "penjodohan" && excel.soal[1]?.pasangan.length === 2, JSON.stringify(excel.soal[1]));
cek("baris 3 membawa media gambar",
    excel.soal[2]?.media.jenis === "gambar", JSON.stringify(excel.soal[2]?.media));

const word = imporDariWord([
  "1. Pilih dua yang benar",
  "A. Satu", "B. Dua", "C. Tiga",
  "KUNCI: A,C",
  "BOBOT: 4",
  "",
  "2. Jodohkan negara dan ibu kotanya",
  "PASANGAN:",
  "Jepang = Tokyo",
  "Korea = Seoul",
  "BOBOT: 6",
  "",
  "3. Perhatikan gambar berikut",
  "GAMBAR: https://x.test/peta.png",
  "A. Benar", "B. Salah",
  "KUNCI: A",
].join("\n"));
cek("Word: tiga soal terbaca", word.soal.length === 3 && word.tolak.length === 0, JSON.stringify(word.tolak));
cek("Word: kunci jamak menebak pg_kompleks tanpa baris JENIS",
    word.soal[0]?.jenis === "pg_kompleks", JSON.stringify(word.soal[0]));
cek("Word: baris pasangan menebak penjodohan",
    word.soal[1]?.jenis === "penjodohan" && word.soal[1]?.pasangan.length === 2, JSON.stringify(word.soal[1]));
cek("Word: media terbaca", word.soal[2]?.media.jenis === "gambar", JSON.stringify(word.soal[2]?.media));

// Pertanyaan biasa yang memuat "=" tidak boleh tertangkap sebagai pasangan.
const wordAman = imporDariWord([
  "1. Berapa hasil 2 + 2 = ?",
  "A. 3", "B. 4",
  "KUNCI: B",
].join("\n"));
cek('pertanyaan bertanda "=" tidak berubah jadi penjodohan',
    wordAman.soal[0]?.jenis === "pg", JSON.stringify(wordAman.soal[0]));

// ---------- JAWABAN KOSONG ----------
bagian("Jawaban kosong — \"{}\" bukan jawaban");
cek("penjodohan {} terbaca kosong", jawabanKosong("penjodohan", "{}"));
cek("penjodohan yang terisi tidak kosong", !jawabanKosong("penjodohan", '{"0":1}'));
cek("penjodohan rusak terbaca kosong", jawabanKosong("penjodohan", "bukan json"));
cek("pg kompleks tanpa centang terbaca kosong", jawabanKosong("pg_kompleks", ""));
cek("pg kompleks tercentang tidak kosong", !jawabanKosong("pg_kompleks", "0,2"));
cek("pg biasa nol TIDAK terbaca kosong", !jawabanKosong("pg", "0"));
cek("essay berisi tidak kosong", !jawabanKosong("essay", "jawaban saya"));

// Inilah akibatnya bila pemeriksaannya keliru: soal yang tidak dikerjakan
// siapa pun terhitung sudah dijawab, di palet nomor maupun di laporan.
const belumDisentuh = hitungNilai([jodoh], { 2: "{}" }, {}, 60);
cek("penjodohan yang belum disentuh dihitung KOSONG, bukan salah",
    belumDisentuh.kosong === 1 && belumDisentuh.salah === 0, JSON.stringify(belumDisentuh));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
