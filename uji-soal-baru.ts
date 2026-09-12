// ============================================================
// UJI: PG kompleks, penjodohan, dan media
//
// Dua jenis soal baru dan satu kolom media. Yang paling mudah salah di sini
// bukan bentuknya melainkan PENILAIANNYA — dan salahnya diam-diam: nilai
// keluar, angkanya masuk akal, dan tidak ada yang tahu ia keliru sampai ada
// peserta yang menghitung ulang sendiri.
// ============================================================
import {
  hitungNilai, hurufOpsi, jawabanKosong, jawabanTerbaca, keUrutanBank, kunciTerbaca,
  nilaiJawaban, susunPaket, uraiJodoh, uraiKunciJamak,
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
bagian("Paket ke peserta — kunci tidak boleh ikut keluar");
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
cek("jenis yang ditulis pengajar menang", bacaMedia("video", "https://x.test/a.png", "").jenis === "video");
cek("tanpa tautan bukan media", bacaMedia("gambar", "", "").jenis === "");

// ---------- IMPOR ----------
bagian("Impor — jenis baru terbaca dari berkas pengajar");
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

// ---------- LEMBAR JAWABAN YANG DAPAT DIBACA PENGAJAR ----------
//
// Penilaiannya sudah benar sejak awal; yang keliru selama ini
// PENYEBUTANNYA. Pengajar yang membuka lembar jawaban membaca
// "jawaban peserta 2,3" dan "Kunci: 0,2" — dua deret angka yang tidak dapat
// dibandingkan satu sama lain, karena yang pertama nomor pilihan DI LAYAR
// PESERTA (sudah teracak) dan yang kedua nomor pada bank soal. Yang terlihat
// dari layar: kunci yang seakan-akan selalu dimulai "0,".
bagian("Lembar jawaban: jawaban dan kunci yang dapat dibaca orang");

cek("huruf pilihan dimulai dari A", hurufOpsi(0) === "A" && hurufOpsi(3) === "D");
cek("di atas 26 pilihan beralih ke nomor, bukan aksara ngawur",
    hurufOpsi(26) === "#27", hurufOpsi(26));
cek("peta pilihan mengembalikan nomor layar ke nomor bank",
    keUrutanBank([2, 0, 3, 1], 0) === 2 && keUrutanBank(undefined, 2) === 2);

const kunciKompleks = kunciTerbaca(kompleks);
cek("kunci PG kompleks tidak lagi berupa deret angka",
    kunciKompleks === "A. Agenda setting; B. Kultivasi; D. Spiral of silence", kunciKompleks);
cek("kunci PG kompleks tidak memuat nomor mentahnya", !kunciKompleks.includes("0,1,3"));

// Inilah pemeriksaan yang paling menentukan: yang tertulis pada lembar
// jawaban harus SEBANDING dengan yang tertulis pada kuncinya. Peserta ini
// menjawab dengan tepat — hanya saja nomor pilihan di layarnya teracak — dan
// dahulu lembarnya berbunyi "1,3,2" berhadapan dengan kunci "0,1,3".
const jawabKompleks = jawabanTerbaca(kompleks, "1,3,2", petaBalik);
cek("jawaban benar pada pilihan teracak terbaca SAMA dengan kuncinya",
    jawabKompleks === kunciKompleks, `${jawabKompleks} vs ${kunciKompleks}`);
cek("dan mesin penilai memang menyebutnya benar",
    nilaiJawaban(kompleks, "1,3,2", petaBalik).benar === true);

// Lembar dan mesin penilai harus sepakat pada setiap jawaban, bukan hanya
// pada yang benar: lembar yang menyebut jawaban sama dengan kunci padahal
// nilainya tidak penuh — atau sebaliknya — akan digugat, dan yang dipercaya
// orang lembarnya.
for (const dijawab of ["1,3,2", "1,3", "0", "0,1,2,3", ""]) {
  const samaDenganKunci = jawabanTerbaca(kompleks, dijawab, petaBalik) === kunciKompleks;
  const penuh = nilaiJawaban(kompleks, dijawab, petaBalik).benar === true;
  cek(`lembar dan nilai sepakat untuk jawaban "${dijawab}"`, samaDenganKunci === penuh,
      `lembar ${samaDenganKunci ? "sama" : "beda"}, nilai ${penuh ? "penuh" : "tidak"}`);
}

cek("PG kompleks yang tidak dijawab tidak dikarang isinya",
    jawabanTerbaca(kompleks, "") === "");
cek("dua yang tercentang disebut dua-duanya",
    jawabanTerbaca(kompleks, "0,1") === "A. Agenda setting; B. Kultivasi",
    jawabanTerbaca(kompleks, "0,1"));

const kunciJodoh = kunciTerbaca(jodoh);
cek("kunci penjodohan disebut pasangan demi pasangan",
    kunciJodoh === "Agenda setting → A. McCombs & Shaw; Spiral of silence → B. Noelle-Neumann; Kultivasi → C. Gerbner",
    kunciJodoh);

// Dahulu kolom ini memuat JSON apa adanya — {"0":0,"1":1,"2":3} — dan
// pengajar yang mengoreksi harus membaca tanda kutipnya sendiri.
const jawabJodoh = jawabanTerbaca(jodoh, '{"0":0,"1":1,"2":3}');
cek("jawaban penjodohan tidak lagi berupa JSON mentah", !jawabJodoh.includes('{"0"'), jawabJodoh);
cek("tiap pasangan disebut beserta yang dipilih peserta",
    jawabJodoh === "Agenda setting → A. McCombs & Shaw; Spiral of silence → B. Noelle-Neumann; Kultivasi → D. Lasswell",
    jawabJodoh);
// Pasangan yang dilewati harus KELIHATAN dilewati. Menyebut hanya yang
// terjawab membuat lembarnya terlihat lengkap padahal dua baris dibiarkan
// kosong — dan itulah yang ditanyakan ketika nilainya dipersoalkan.
cek("pasangan yang dilewati peserta tetap disebut",
    jawabanTerbaca(jodoh, '{"0":0}').includes("(kosong)"),
    jawabanTerbaca(jodoh, '{"0":0}'));
cek("penjodohan yang belum disentuh tidak dikarang isinya",
    jawabanTerbaca(jodoh, "{}") === "" && jawabanTerbaca(jodoh, "bukan json") === "");
cek("jawaban penjodohan teracak ikut dipetakan balik",
    jawabanTerbaca(jodoh, '{"0":1}', [2, 0, 3, 1]).startsWith("Agenda setting → A. McCombs & Shaw"),
    jawabanTerbaca(jodoh, '{"0":1}', [2, 0, 3, 1]));

const pgSatu: Soal = {
  ...dasar, id: 7, jenis: "pg", pertanyaan: "Siapa perumus agenda setting?",
  pilihan: ["McCombs & Shaw", "Lasswell", "Habermas", "Gerbner"], kunci: "0", bobot: 5,
};
cek("pilihan ganda disebut beserta hurufnya",
    kunciTerbaca(pgSatu) === "A. McCombs & Shaw", kunciTerbaca(pgSatu));
cek("pilihan ganda teracak dipetakan balik",
    jawabanTerbaca(pgSatu, "1", [3, 0, 2, 1]) === "A. McCombs & Shaw",
    jawabanTerbaca(pgSatu, "1", [3, 0, 2, 1]));
cek("pilihan ganda yang tidak dijawab kosong", jawabanTerbaca(pgSatu, "") === "");

const bs: Soal = {
  ...dasar, id: 8, jenis: "benar_salah", pertanyaan: "Agenda setting dirumuskan 1972.",
  pilihan: ["Benar", "Salah"], kunci: "0", bobot: 5,
};
// "A. Benar" menambah satu huruf yang tidak pernah ditanyakan siapa pun.
cek("benar/salah disebut tanpa huruf", kunciTerbaca(bs) === "Benar", kunciTerbaca(bs));
cek("jawaban benar/salah ikut tanpa huruf",
    jawabanTerbaca(bs, "1") === "Salah", jawabanTerbaca(bs, "1"));

const isianSoal: Soal = {
  ...dasar, id: 9, jenis: "isian", pertanyaan: "Sebutkan istilahnya.",
  pilihan: [], kunci: "komunikasi massa|mass communication", bobot: 4,
};
cek("kunci isian dibaca tanpa tanda pipa",
    kunciTerbaca(isianSoal) === "komunikasi massa / mass communication", kunciTerbaca(isianSoal));
cek("jawaban isian apa adanya", jawabanTerbaca(isianSoal, " Komunikasi Massa ") === "Komunikasi Massa");

const essaySoal: Soal = {
  ...dasar, id: 10, jenis: "essay", pertanyaan: "Jelaskan.", pilihan: [], kunci: "", bobot: 20,
};
// Essay tidak punya kunci. Kunci palsu di lembar koreksi hanya akan
// disalahartikan sebagai jawaban yang dituntut.
cek("essay tidak diberi kunci", kunciTerbaca(essaySoal) === "");
cek("jawaban essay apa adanya", jawabanTerbaca(essaySoal, "Media membentuk agenda.") === "Media membentuk agenda.");

// Soal yang kuncinya rusak — pernah ada pada bank dari versi lama — tidak
// boleh mencetak "Kunci: undefined" maupun aksara kosong.
cek("kunci yang rusak tidak mencetak sampah",
    kunciTerbaca({ ...pgSatu, kunci: "" }) === "" &&
    kunciTerbaca({ ...pgSatu, kunci: "bukan angka" }) === "");
cek("pilihan yang hilang jatuh ke hurufnya saja",
    kunciTerbaca({ ...pgSatu, kunci: "9" }) === "J", kunciTerbaca({ ...pgSatu, kunci: "9" }));

// Yang disebut kosong oleh lembar jawaban harus yang disebut kosong oleh
// penghitung nilai — supaya tidak ada butir berpoin yang terbaca "tidak
// dijawab", dan tidak ada butir kosong yang terbaca sudah dijawab.
for (const [soal, dijawab] of [
  [kompleks, ""], [kompleks, "0,1"], [jodoh, "{}"], [jodoh, '{"0":0}'],
  [pgSatu, ""], [pgSatu, "2"], [isianSoal, ""], [isianSoal, "agenda"],
] as Array<[Soal, string]>) {
  cek(`kosongnya sepakat: ${soal.jenis} "${dijawab}"`,
      (jawabanTerbaca(soal, dijawab) === "") === jawabanKosong(soal.jenis, dijawab));
}

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
