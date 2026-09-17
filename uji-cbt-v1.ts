// UJI CBT V1 — RUBRIK, KEMIRIPAN JAWABAN, DATA MAHASISWA, REKAMAN
//
// Yang dijaga di sini adalah aturan-aturan yang kesalahannya TIDAK TERLIHAT
// sampai sudah terlambat: nilai esai yang salah hitung, jawaban yang ditandai
// mirip padahal tidak, dan kata yang ditandai mencurigakan padahal kalimatnya
// justru melarangnya.
//
// Seluruhnya murni. Tidak satu pun uji di sini menyentuh basis data, jaringan,
// atau model.

import {
  hitungRubrik, levelBerlaku, periksaRubrik, poinDariRubrik, predikat,
  ratakanBobot, rubrikBawaan, bacaKriteria, RUBRIK_BAWAAN, type Rubrik,
} from "./src/lib/rubrik";
import {
  AMBANG_BAWAAN, bandingkanSoal, cosine, jaccard, kalimatSama, kataDari,
  normalkan, ngram, rapikanAmbang, ringkasPerPeserta, sidikJawaban, skorPasangan,
  statusMirip, hitungDf,
} from "./src/lib/mirip-jawaban";
import {
  bacaImporMahasiswa, bacaTempelMahasiswa, kunciAngka, kunciCari, lolosLike,
  peringkatSaran, rapikanEmail, rapikanNimMhs, rapikanStatus, skorSaran,
  type Mahasiswa,
} from "./src/lib/mahasiswa";
import {
  bacaTranskrip, ejaJamRekaman, jalurPotongan, jenisDiterima, namaPotongan,
  normalUcapan, periksaUcapan, rapikanKata, statusTanda, tandaiTranskrip,
} from "./src/lib/rekaman";
import { bacaPenilaian, susunPerintah } from "./src/lib/nilai-esai";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

// ============================================================
console.log("\n=== RUBRIK: RUMUS PENILAIAN ===\n");
// ============================================================

const rubrikUji: Rubrik = {
  nama: "Uji",
  keterangan: "",
  skalaMin: 1,
  skalaMax: 4,
  kriteria: [
    { nama: "Analisis Situasi", bobot: 20, levels: [] },
    { nama: "Strategi Pesan", bobot: 20, levels: [] },
    { nama: "Kelayakan Kanal", bobot: 25, levels: [] },
    { nama: "Operasional", bobot: 15, levels: [] },
    { nama: "Sistematika", bobot: 20, levels: [] },
  ],
};

// Contoh yang sama persis dengan yang tertulis pada rancangan pemiliknya:
// 3, 4, 4, 3, 4 pada bobot 20/20/25/15/20 menghasilkan 3,65 lalu 91,25.
// Ini uji yang paling penting di seluruh berkas: kalau angka ini bergeser,
// seluruh nilai esai di portal bergeser bersamanya.
const contoh = hitungRubrik(rubrikUji, [
  { aiLevel: 3 }, { aiLevel: 4 }, { aiLevel: 4 }, { aiLevel: 3 }, { aiLevel: 4 },
]);
sama("total terbobot contoh rancangan", contoh.totalTerbobot, 3.65);
sama("nilai akhir contoh rancangan", contoh.nilai, 91.25);
sama("dan predikatnya A", predikat(contoh.nilai).huruf, "A");
sama("sebutannya Sangat Baik", predikat(contoh.nilai).sebutan, "Sangat Baik");
benar("seluruh kriteria terisi", contoh.lengkap);
sama("tidak ada yang tertinggal", contoh.belumDinilai, 0);

// Pembagian memakai SKALA, bukan jumlah kriteria. Rubrik 1–4 dan 1–5 harus
// sama-sama menghasilkan 100 untuk pekerjaan yang sempurna.
const penuh4 = hitungRubrik(rubrikUji, rubrikUji.kriteria.map(() => ({ aiLevel: 4 })));
sama("level penuh pada skala 1–4 = 100", penuh4.nilai, 100);
const rubrik5 = { ...rubrikUji, skalaMax: 5 };
const penuh5 = hitungRubrik(rubrik5, rubrikUji.kriteria.map(() => ({ aiLevel: 5 })));
sama("level penuh pada skala 1–5 juga 100", penuh5.nilai, 100);

// Kriteria yang belum dinilai dihitung nol DAN dilaporkan terpisah. Keduanya
// perlu: nilainya harus tetap dapat ditampilkan, dan pembacanya harus tahu
// bahwa angka itu belum utuh.
const separuh = hitungRubrik(rubrikUji, [{ aiLevel: 4 }, { aiLevel: 4 }, {}, {}, {}]);
sama("yang belum dinilai dihitung", separuh.belumDinilai, 3);
benar("dan ditandai belum lengkap", !separuh.lengkap);
sama("nilainya tetap keluar", separuh.nilai, 40);

// Keputusan dosen menang atas pembacaan mesin — SELALU, termasuk ketika
// angkanya kebetulan sama.
sama("dosen menang atas AI", levelBerlaku({ aiLevel: 4, finalLevel: 2 }), 2);
sama("tanpa keputusan dosen, AI dipakai", levelBerlaku({ aiLevel: 3 }), 3);
sama("tanpa keduanya, belum dinilai", levelBerlaku({}), null);
benar("perubahan dosen tercatat",
  hitungRubrik(rubrikUji, [{ aiLevel: 4, finalLevel: 2 }, {}, {}, {}, {}]).kriteria[0].diubahDosen);

// Level di luar skala dijepit, bukan ditolak. Rubrik dapat dipersempit dari
// 1–5 menjadi 1–4 sesudah sebagian jawaban dinilai, dan angka 5 yang
// tertinggal tidak boleh menghasilkan nilai di atas seratus.
const liar = hitungRubrik(rubrikUji, rubrikUji.kriteria.map(() => ({ aiLevel: 9 })));
sama("level di atas skala dijepit", liar.nilai, 100);
sama("level di bawah skala dijepit",
  hitungRubrik(rubrikUji, rubrikUji.kriteria.map(() => ({ aiLevel: -3 }))).nilai, 25);

// Nilai rubrik 0–100 menjadi poin soal.
sama("nilai penuh jadi bobot penuh", poinDariRubrik(100, 20), 20);
sama("separuh nilai jadi separuh poin", poinDariRubrik(50, 20), 10);
sama("91,25 pada soal 20 poin", poinDariRubrik(91.25, 20), 18.25);
sama("nilai di atas 100 tetap dijepit", poinDariRubrik(160, 20), 20);

console.log("\n=== RUBRIK: PEMERIKSAAN BENTUK ===\n");

benar("rubrik lengkap diterima", periksaRubrik(rubrikUji).ok);
// Bobot yang berjumlah 95 menghasilkan nilai yang salah TANPA satu pun tanda
// bahwa ada yang salah. Inilah satu-satunya hal yang wajib ditolak.
const bobotKurang = { ...rubrikUji, kriteria: rubrikUji.kriteria.map((k, i) => (i === 0 ? { ...k, bobot: 15 } : k)) };
benar("bobot yang tidak 100% ditolak", !periksaRubrik(bobotKurang).ok);
benar("dan pesannya menyebut angkanya",
  (periksaRubrik(bobotKurang) as { pesan: string }).pesan.includes("95"));
benar("rubrik tanpa kriteria ditolak", !periksaRubrik({ ...rubrikUji, kriteria: [] }).ok);
benar("rubrik tanpa nama ditolak", !periksaRubrik({ ...rubrikUji, nama: "  " }).ok);
benar("skala terbalik ditolak", !periksaRubrik({ ...rubrikUji, skalaMin: 4, skalaMax: 1 }).ok);

sama("bobot rata tiga kriteria", ratakanBobot(3).join(","), "34,33,33");
sama("dan jumlahnya tetap 100", ratakanBobot(3).reduce((a, b) => a + b, 0), 100);
sama("bobot rata empat kriteria", ratakanBobot(4).join(","), "25,25,25,25");
sama("tujuh kriteria tetap berjumlah 100", ratakanBobot(7).reduce((a, b) => a + b, 0), 100);

console.log("\n=== RUBRIK: PEMBACAAN JSON DAN BAWAAN ===\n");

sama("JSON rusak dibaca kosong, bukan melempar", bacaKriteria("{bukan json").length, 0);
sama("JSON bukan larik dibaca kosong", bacaKriteria('{"a":1}').length, 0);
sama("kriteria tanpa nama dibuang", bacaKriteria('[{"nama":"","bobot":50},{"nama":"Isi","bobot":50}]').length, 1);
sama("level diurutkan naik",
  bacaKriteria('[{"nama":"X","bobot":100,"levels":[{"level":3},{"level":1},{"level":2}]}]')[0].levels
    .map((l) => l.level).join(","),
  "1,2,3");

// Rubrik bawaan harus SAH — ia ditawarkan untuk langsung dipakai, dan rubrik
// bawaan yang bobotnya tidak 100% akan ditolak server tepat ketika dosen
// menekan simpan.
for (const r of RUBRIK_BAWAAN) {
  benar(`rubrik bawaan "${r.nama}" sah`, periksaRubrik(r).ok,
    (periksaRubrik(r) as { pesan?: string }).pesan ?? "");
  benar(`dan tiap kriterianya punya deskriptor lengkap`,
    r.kriteria.every((k) => k.levels.length === r.skalaMax && k.levels.every((l) => l.deskriptor.trim() !== "")));
}
sama("rubrik proposal kampanye punya lima komponen",
  rubrikBawaan("Rubrik Proposal Kampanye")?.kriteria.length, 5);
sama("dengan bobot 20/20/25/15/20",
  rubrikBawaan("Rubrik Proposal Kampanye")?.kriteria.map((k) => k.bobot).join("/"), "20/20/25/15/20");
// Salinan, bukan rujukan: rubrik bawaan yang disunting seorang dosen tidak
// boleh berubah bagi seluruh dosen lain yang memakainya.
const salinan = rubrikBawaan("Rubrik Esai Umum")!;
salinan.kriteria[0].nama = "DIUBAH";
sama("yang diambil adalah salinan",
  rubrikBawaan("Rubrik Esai Umum")?.kriteria[0].nama, "Ketepatan Konsep");
sama("nama yang tidak ada mengembalikan null", rubrikBawaan("Tidak Ada"), null);

console.log("\n=== RUBRIK: PREDIKAT ===\n");
sama("85 ke atas A", predikat(85).huruf, "A");
sama("84 masih B", predikat(84).huruf, "B");
sama("75 B", predikat(75).huruf, "B");
sama("65 C", predikat(65).huruf, "C");
sama("55 D", predikat(55).huruf, "D");
sama("nol E", predikat(0).huruf, "E");

// ============================================================
console.log("\n=== KEMIRIPAN: NORMALISASI ===\n");
// ============================================================

sama("tanda baca dibuang", normalkan("Halo, dunia!"), "halo dunia");
sama("huruf besar diseragamkan", normalkan("HALO Dunia"), "halo dunia");
sama("spasi berlebih dirapikan", normalkan("halo    dunia  "), "halo dunia");
sama("diakritik dibuang", normalkan("Zulfikár"), "zulfikar");
sama("kata dipecah benar", kataDari("Satu dua tiga").join("|"), "satu|dua|tiga");
sama("teks kosong menghasilkan nol kata", kataDari("   ").length, 0);
sama("4-gram dari lima kata ada dua", ngram(["a", "b", "c", "d", "e"], 4).length, 2);
sama("kata lebih sedikit dari n menghasilkan kosong", ngram(["a", "b"], 4).length, 0);

console.log("\n=== KEMIRIPAN: UKURAN DASAR ===\n");

sama("jaccard himpunan identik", jaccard(new Set(["a", "b"]), new Set(["a", "b"])), 1);
sama("jaccard tanpa irisan", jaccard(new Set(["a"]), new Set(["b"])), 0);
sama("jaccard separuh", jaccard(new Set(["a", "b"]), new Set(["b", "c"])), 1 / 3);
sama("jaccard himpunan kosong", jaccard(new Set(), new Set(["a"])), 0);

const v1 = new Map([["a", 1], ["b", 1]]);
sama("cosine vektor identik", Math.round(cosine(v1, v1) * 1000) / 1000, 1);
sama("cosine tanpa irisan", cosine(new Map([["a", 1]]), new Map([["b", 1]])), 0);
sama("cosine vektor kosong", cosine(new Map(), v1), 0);

console.log("\n=== KEMIRIPAN: PERBANDINGAN JAWABAN ===\n");

// Naskah yang cukup panjang supaya melewati MIN_KATA, dan cukup berbeda satu
// sama lain supaya yang diukur benar-benar kemiripannya.
const asli =
  "Komunikasi massa memiliki peran penting dalam membentuk opini publik pada masyarakat modern " +
  "karena media menyediakan kerangka penafsiran atas peristiwa yang terjadi setiap hari.";
const disalin = asli;
const parafrase =
  "Media massa berperan besar membentuk pandangan khalayak di zaman sekarang sebab ia " +
  "menyodorkan cara memahami kejadian yang berlangsung sehari-hari.";
const berbeda =
  "Metode penelitian kuantitatif menuntut pengukuran variabel yang jelas beserta instrumen " +
  "yang sudah diuji reliabilitas dan validitasnya sebelum dipakai mengumpulkan data lapangan.";

const pasangan = bandingkanSoal([
  { attemptId: 1, teks: asli },
  { attemptId: 2, teks: disalin },
  { attemptId: 3, teks: parafrase },
  { attemptId: 4, teks: berbeda },
]);

const cari = (a: number, b: number) =>
  pasangan.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));

const identik = cari(1, 2);
benar("jawaban identik terdeteksi", Boolean(identik));
sama("dan skornya tepat seratus", identik?.skor, 100);
sama("statusnya tinggi", identik?.status, "tinggi");
benar("ditandai salinan utuh", identik?.sinyal.salinanUtuh === true);

// Parafrase memang SEHARUSNYA lolos. Itu namanya belajar, bukan menyontek,
// dan alat yang menandainya akan menghukum mahasiswa yang justru mengerjakan
// dengan benar.
const parafrasePasang = cari(1, 3);
benar("parafrase tidak ditandai tinggi", !parafrasePasang || parafrasePasang.skor < 60,
  `skor ${parafrasePasang?.skor}`);

// Jawaban yang topiknya berbeda sama sekali tidak boleh muncul.
benar("jawaban berbeda topik tidak tersimpan", !cari(1, 4) && !cari(2, 4));

// attemptId yang lebih kecil SELALU menjadi `a` — indeks unik di basis data
// bergantung padanya.
benar("pasangan selalu urut a < b", pasangan.every((p) => p.a < p.b));

// Jawaban terlalu pendek dibuang. "Ya" dan "setuju" akan mirip seratus persen
// satu sama lain, dan menandainya hanya menghasilkan derau yang membuat dosen
// berhenti mempercayai seluruh kolomnya.
sama("jawaban pendek tidak dibandingkan",
  bandingkanSoal([
    { attemptId: 1, teks: "ya benar sekali" },
    { attemptId: 2, teks: "ya benar sekali" },
  ]).length, 0);
sama("satu peserta saja tidak menghasilkan pasangan",
  bandingkanSoal([{ attemptId: 1, teks: asli }]).length, 0);
sama("jawaban kosong dilewati",
  bandingkanSoal([{ attemptId: 1, teks: asli }, { attemptId: 2, teks: "" }]).length, 0);

console.log("\n=== KEMIRIPAN: AMBANG DAN RINGKASAN ===\n");

sama("di bawah setengah ambang: bersih", statusMirip(10, AMBANG_BAWAAN), "bersih");
sama("di atas setengah ambang: rendah", statusMirip(20, AMBANG_BAWAAN), "rendah");
sama("tepat ambang tinjau", statusMirip(30, AMBANG_BAWAAN), "tinjau");
sama("tepat ambang tinggi", statusMirip(60, AMBANG_BAWAAN), "tinggi");
sama("ambang yang disetel dosen dipakai", statusMirip(45, { tinjau: 50, tinggi: 80 }), "rendah");

// Ambang terbalik harus tetap menghasilkan urutan yang masuk akal.
const terbalik = rapikanAmbang({ tinjau: 70, tinggi: 40 });
benar("ambang terbalik dibetulkan", terbalik.tinggi > terbalik.tinjau);
sama("ambang kosong memakai bawaan", rapikanAmbang(null).tinjau, 30);
sama("ambang di luar batas dijepit", rapikanAmbang({ tinjau: 500, tinggi: 900 }).tinjau, 99);

// Ringkasan per peserta memakai yang TERTINGGI, bukan rata-rata: peserta yang
// satu jawabannya identik dan sembilan lainnya asli punya persoalan yang tidak
// tertangkap rata-rata.
const ringkas = ringkasPerPeserta(
  [
    { a: 1, b: 2, skor: 90, status: "tinggi", sinyal: {} as never },
    { a: 1, b: 3, skor: 20, status: "bersih", sinyal: {} as never },
  ],
  AMBANG_BAWAAN,
);
sama("ringkasan memakai yang tertinggi", ringkas.get(1)?.skor, 90);
sama("dan menyebut lawannya", ringkas.get(1)?.lawan, 2);
sama("kedua arah ikut tercatat", ringkas.get(2)?.skor, 90);
sama("yang skornya rendah tetap dicatat apa adanya", ringkas.get(3)?.skor, 20);

console.log("\n=== KEMIRIPAN: KALIMAT YANG SAMA PERSIS ===\n");

const samaPersis = kalimatSama(
  "Ini kalimat pertama yang cukup panjang untuk dihitung. Ini kalimat kedua yang berbeda sama sekali isinya.",
  "Pembukanya lain sama sekali dan tidak sama. Ini kalimat pertama yang cukup panjang untuk dihitung.",
);
sama("kalimat yang sama ditemukan", samaPersis.length, 1);
benar("dan dikembalikan utuh apa adanya", samaPersis[0].startsWith("Ini kalimat pertama"));
sama("kalimat pendek tidak dihitung", kalimatSama("Ya benar.", "Ya benar.").length, 0);

// Pembobotan TF-IDF: kata yang muncul di seluruh lembar hampir tidak berbobot.
const sidikSemua = [
  sidikJawaban(1, "media massa membentuk opini"),
  sidikJawaban(2, "media massa membentuk pandangan"),
  sidikJawaban(3, "media massa membentuk persepsi"),
];
const df = hitungDf(sidikSemua);
sama("kata yang ada di semua lembar berfrekuensi tiga", df.get("media"), 3);
sama("kata khas hanya satu", df.get("opini"), 1);

console.log("\n=== DATA MAHASISWA: PENCARIAN ===\n");

const orang = (id: number, nim: string, nama: string, status = "aktif"): Mahasiswa =>
  ({ id, nim, nama, email: "", prodi: "", kelas: "", angkatan: "", status });

const kelas: Mahasiswa[] = [
  orang(1, "2023123456", "Andi Pratama"),
  orang(2, "2023123488", "Budi Santoso"),
  orang(3, "2024123411", "Siti Rahma"),
  // Namanya memuat "bud" DI TENGAH, bukan di awal. Itulah yang diuji di
  // bawah: peringkat harus menaruh yang diawali ketikan di atas yang sekadar
  // mengandungnya.
  orang(4, "2022555000", "Mahbudi Akbar"),
  orang(5, "2021777000", "Anita Sari", "lulus"),
];

// Permintaan pemiliknya: mengetik SATU huruf sudah menghasilkan daftar.
const satuHuruf = peringkatSaran(kelas, "a");
benar("satu huruf menghasilkan hasil", satuHuruf.length > 0);
sama("yang namanya diawali huruf itu paling atas", satuHuruf[0].nama, "Andi Pratama");

// "bud" harus menaruh Budi di atas Mahbudi, walaupun keduanya cocok.
const bud = peringkatSaran(kelas, "bud");
sama("nama yang diawali ketikan menang", bud[0].nama, "Budi Santoso");
benar("yang mengandung di tengah tetap muncul", bud.some((m) => m.nama === "Mahbudi Akbar"),
  `dapat ${bud.map((m) => m.nama).join(", ")}`);

sama("tidak peka huruf besar-kecil", peringkatSaran(kelas, "ANDI")[0].nama, "Andi Pratama");
sama("nama belakang juga ketemu", peringkatSaran(kelas, "santoso")[0].nama, "Budi Santoso");

// Ketikan angka dicari pada NOMOR, dari depan.
const angka = peringkatSaran(kelas, "2023");
sama("dua nomor diawali 2023", angka.length, 2);
benar("dan keduanya benar", angka.every((m) => m.nim.startsWith("2023")));
sama("nomor lengkap paling pasti", peringkatSaran(kelas, "2023123456")[0].nim, "2023123456");

// Mahasiswa tidak aktif ikut tampil tetapi selalu di bawah yang aktif —
// mahasiswa cuti yang ikut ujian susulan memang ada.
const huruf_a = peringkatSaran(kelas, "an");
const urutAnita = huruf_a.findIndex((m) => m.nama === "Anita Sari");
const urutAndi = huruf_a.findIndex((m) => m.nama === "Andi Pratama");
benar("yang tidak aktif tetap muncul", urutAnita >= 0);
benar("tetapi di bawah yang aktif", urutAndi < urutAnita);

sama("hasil dipotong sesuai batas", peringkatSaran(kelas, "a", 2).length, 2);
sama("ketikan kosong tidak menghasilkan apa-apa", peringkatSaran(kelas, "").length, 0);
sama("yang tidak cocok sama sekali dibuang", peringkatSaran(kelas, "zzzz").length, 0);
sama("skor nol untuk yang tidak cocok", skorSaran(kelas[0], "zzz"), 0);

benar("ketikan angka dikenali", kunciAngka("2023"));
benar("ketikan huruf bukan angka", !kunciAngka("budi"));
sama("gelar dibuang dari kunci cari", kunciCari("Andi Pratama, S.I.Kom."), "andi pratama s i kom");
sama("tanda persen diloloskan", lolosLike("100%"), "100\\%");
sama("garis bawah diloloskan", lolosLike("a_b"), "a\\_b");

console.log("\n=== DATA MAHASISWA: PEMBERSIHAN ===\n");

sama("nomor dibersihkan dari huruf", rapikanNimMhs("NIM 2023-123456"), "2023123456");
sama("nomor kosong tetap kosong", rapikanNimMhs("abc"), "");
sama("email sah diterima", rapikanEmail("Andi@Kampus.AC.ID"), "andi@kampus.ac.id");
sama("bukan email dibuang", rapikanEmail("bukan alamat"), "");
sama("email tanpa domain dibuang", rapikanEmail("andi@kampus"), "");
sama("status tidak dikenal jadi aktif", rapikanStatus("apa saja"), "aktif");
sama("status cuti dikenali", rapikanStatus("CUTI"), "cuti");

console.log("\n=== DATA MAHASISWA: IMPOR ===\n");

const imporRapi = bacaImporMahasiswa([
  ["NIM", "Nama", "Email", "Kelas"],
  ["2023123456", "Andi Pratama", "andi@kampus.ac.id", "3A"],
  ["2023123457", "Budi Santoso", "budi@kampus.ac.id", "3A"],
]);
sama("dua baris terbaca", imporRapi.baris.length, 2);
sama("nomornya benar", imporRapi.baris[0].nim, "2023123456");
sama("emailnya ikut", imporRapi.baris[0].email, "andi@kampus.ac.id");
sama("tanpa penolakan", imporRapi.tolak.length, 0);

// Berkas dari bagian akademik lazim diawali kop dan baris kosong. Judul
// kolomnya dicari, bukan dianggap selalu baris pertama.
const adaKop = bacaImporMahasiswa([
  ["DAFTAR MAHASISWA FAKULTAS"],
  ["Tahun Ajaran 2024/2025"],
  [],
  ["NPM", "Nama Lengkap", "Surel"],
  ["2023123456", "Andi Pratama", "andi@kampus.ac.id"],
]);
sama("judul kolom dicari, bukan diasumsikan", adaKop.baris.length, 1);
sama("NPM dikenali sebagai nomor", adaKop.baris[0].nim, "2023123456");

// Nomor Excel yang terbaca sebagai angka besar harus pulih utuh.
sama("angka Excel dipulihkan utuh",
  bacaImporMahasiswa([["NIM", "Nama"], [2023123456, "Andi"]]).baris[0].nim, "2023123456");

const adaMasalah = bacaImporMahasiswa([
  ["NIM", "Nama"],
  ["", "Tanpa Nomor"],
  ["2023123456", "Andi Pratama"],
  ["2023123456", "Andi Pratama Lagi"],
  ["999", "Nomor Pendek"],
  ["2023123457", "AB"],
]);
sama("hanya yang sah yang masuk", adaMasalah.baris.length, 1);
sama("empat baris ditolak", adaMasalah.tolak.length, 4);
benar("nomor ganda disebut alasannya",
  adaMasalah.tolak.some((t) => t.alasan.includes("dua kali")));

sama("berkas tanpa kolom NIM ditolak",
  bacaImporMahasiswa([["Kolom", "Lain"], ["a", "b"]]).baris.length, 0);
sama("berkas kosong ditolak", bacaImporMahasiswa([]).tolak.length, 1);

// Tempelan dua kolom dari layar SIAKAD.
const tempelan = bacaTempelMahasiswa("2023123456\tAndi Pratama\n2023123457\tBudi Santoso");
sama("tempelan tab terbaca", tempelan.baris.length, 2);
sama("namanya benar", tempelan.baris[1].nama, "Budi Santoso");
sama("tempelan koma juga terbaca",
  bacaTempelMahasiswa("2023123456,Andi Pratama").baris.length, 1);
sama("tempelan bertitik koma juga",
  bacaTempelMahasiswa("2023123456;Andi Pratama").baris.length, 1);

// ============================================================
console.log("\n=== REKAMAN: PENYIMPANAN ===\n");
// ============================================================

// Nol di depan bukan kerapian: daftar objek Storage terurut sebagai TEKS,
// dan tanpa itu potongan ke-10 berdiri di antara ke-1 dan ke-2.
sama("nomor potongan rata kiri dengan nol", namaPotongan(7), "00007.webm");
sama("potongan ke-10 tetap di belakang ke-9",
  ["00009.webm", "00010.webm"].sort().join(","), "00009.webm,00010.webm");
benar("penomoran urut sebagai teks",
  [namaPotongan(2), namaPotongan(10)].sort()[0] === namaPotongan(2));
sama("mp4 memakai akhiran m4a", namaPotongan(1, "audio/mp4"), "00001.m4a");
sama("jalur potongan lengkap", jalurPotongan(12, 345, 0), "ujian-12/attempt-345/00000.webm");

benar("webm diterima", jenisDiterima("audio/webm"));
benar("webm dengan codec diterima", jenisDiterima("audio/webm;codecs=opus"));
benar("mp4 diterima", jenisDiterima("audio/mp4"));
benar("video ditolak", !jenisDiterima("video/mp4"));
benar("kosong ditolak", !jenisDiterima(""));

sama("jam di bawah sejam tanpa angka jam", ejaJamRekaman(125), "02:05");
sama("jam di atas sejam memakai tiga bagian", ejaJamRekaman(3725), "01:02:05");
sama("nol detik", ejaJamRekaman(0), "00:00");
sama("angka minus tetap nol", ejaJamRekaman(-5), "00:00");

console.log("\n=== REKAMAN: DETEKSI KATA ===\n");

sama("tanda baca dari mesin transkrip dibuang", normalUcapan("Buka, Google!"), "buka google");

// Tahap satu: kata kunci ditemukan.
const jelas = periksaUcapan("eh coba buka google dulu");
benar("kata kunci ditemukan", Boolean(jelas));
sama("kata yang ditemukan tepat", jelas?.keyword, "buka google");
sama("dan risikonya tinggi", jelas?.risk, "tinggi");

// Tahap dua: KONTEKSNYA. Inilah yang membuat alat ini layak dipakai.
// "Kita tidak boleh membuka Google" memuat kata yang dicari dan artinya
// justru kebalikannya.
const dibalik = periksaUcapan("dalam pembahasan ini kita tidak boleh buka google");
benar("kalimat yang mengingkari tetap ditemukan", Boolean(dibalik));
sama("tetapi risikonya diturunkan", dibalik?.risk, "rendah");
benar("dan alasannya menyebut pengingkarnya",
  (dibalik?.reason ?? "").includes("pengingkar"));

sama("larangan juga diturunkan", periksaUcapan("jangan buka chatgpt ya")?.risk, "rendah");
sama("dilarang juga", periksaUcapan("dilarang buka browser saat ujian")?.risk, "rendah");
sama("tanpa kata kunci tidak ada temuan", periksaUcapan("saya sedang mengerjakan soal nomor tiga"), null);
sama("ucapan kosong tidak ada temuan", periksaUcapan(""), null);

// Kata "google" sendirian TIDAK ada di daftar bawaan — ia muncul pada hampir
// semua kuliah metodologi, dan daftar yang memuatnya akan menandai satu kelas.
sama("kata aplikasi sendirian tidak ditandai",
  periksaUcapan("google scholar adalah mesin pencari jurnal"), null);

sama("daftar kata dapat diganti dosen",
  periksaUcapan("kunci jawabannya apa", ["kunci jawaban"])?.keyword, "kunci jawaban");
sama("kata terlalu pendek dibuang", rapikanKata(["ab", "buka google"]).length, 1);
sama("kata ganda dibuang", rapikanKata(["buka google", "BUKA GOOGLE"]).length, 1);
sama("dipisah baris juga terbaca", rapikanKata("buka google\nbuka chatgpt").length, 2);

console.log("\n=== REKAMAN: STATUS PENANDAAN ===\n");

const tertanda = tandaiTranskrip([
  { startSec: 0, endSec: 5, text: "saya mulai mengerjakan soalnya" },
  { startSec: 763, endSec: 768, text: "coba buka google dong" },
  { startSec: 1089, endSec: 1094, text: "kita tidak boleh buka chatgpt" },
]);
sama("tiga penggal ditandai", tertanda.length, 3);
sama("yang biasa tetap bersih", tertanda[0].risk, "bersih");
sama("perintah berisiko tinggi", tertanda[1].risk, "tinggi");
sama("yang diingkari berisiko rendah", tertanda[2].risk, "rendah");

sama("tanpa penandaan: bersih", statusTanda(tandaiTranskrip([
  { startSec: 0, endSec: 5, text: "saya sedang membaca soalnya" },
])).status, "bersih");

// Satu penandaan berisiko tinggi TIDAK langsung berarti mencurigakan.
// Pengubah suara ke teks salah dengar, dan satu salah dengar tidak boleh
// cukup untuk menaruh kata "mencurigakan" pada laporan ujian seseorang.
sama("satu yang tinggi: perlu ditinjau", statusTanda(tertanda).status, "tinjau");
sama("tiga yang tinggi: mencurigakan", statusTanda(tandaiTranskrip([
  { startSec: 10, endSec: 15, text: "coba buka google" },
  { startSec: 60, endSec: 65, text: "tolong buka chatgpt" },
  { startSec: 90, endSec: 95, text: "cepat buka whatsapp" },
])).status, "mencurigakan");
sama("jumlahnya ikut dihitung", statusTanda(tertanda).jumlah, 2);

console.log("\n=== REKAMAN: PEMBACAAN TRANSKRIP ===\n");

// Model hanya mendengar SATU potongan dan menghitung dari nol. Tanpa
// pergeseran, seluruh penandaan pada potongan kedua dan seterusnya akan
// menunjuk menit pertama rekaman.
const geser = bacaTranskrip({ penggal: [{ mulai: 3, selesai: 8, teks: "halo" }] }, 200);
sama("jam digeser sesuai potongannya", geser.penggal[0].startSec, 203);
sama("akhirnya juga digeser", geser.penggal[0].endSec, 208);
sama("penggal kosong dibuang",
  bacaTranskrip({ penggal: [{ mulai: 0, selesai: 1, teks: "   " }] }).penggal.length, 0);
sama("jawaban rusak dibaca kosong", bacaTranskrip(null).penggal.length, 0);
benar("potongan sunyi ditandai tanpa suara", !bacaTranskrip({ penggal: [] }).adaSuara);

// ============================================================
console.log("\n=== PENILAIAN ESAI: PERINTAH DAN PEMBACAAN ===\n");
// ============================================================

const perintah = susunPerintah({
  rubrik: rubrikBawaan("Rubrik Esai Umum")!,
  pertanyaan: "Jelaskan teori agenda setting.",
  jawaban: "Agenda setting adalah teori yang menjelaskan pengaruh media terhadap isu yang dianggap penting.",
  mataKuliah: "Komunikasi Massa",
});
benar("perintah memuat pertanyaannya", perintah.includes("agenda setting"));
benar("perintah memuat seluruh kriteria", perintah.includes("Ketepatan Konsep"));
// Bobot ikut walaupun model tidak memakainya menghitung: kriteria berbobot
// 30% memang layak dibaca lebih teliti daripada yang berbobot 10%.
benar("bobot ikut disebutkan", perintah.includes("bobot 30%"));
benar("skala disebutkan", perintah.includes("1 sampai 4"));
benar("mata kuliah ikut", perintah.includes("Komunikasi Massa"));
benar("jawaban kosong dikatakan apa adanya",
  susunPerintah({
    rubrik: rubrikBawaan("Rubrik Esai Umum")!,
    pertanyaan: "x", jawaban: "   ",
  }).includes("kosong"));

const rubrik4 = rubrikBawaan("Rubrik Esai Umum")!;

// Kriteria yang TIDAK dijawab model dikembalikan sebagai level terendah
// dengan alasan yang mengatakan apa adanya — bukan dibuang. Kriteria yang
// hilang akan tampak seperti yang belum sempat dinilai.
const setengah = bacaPenilaian({ kriteria: [{ urut: 0, level: 3, alasan: "Konsepnya tepat." }] }, rubrik4);
sama("seluruh kriteria selalu kembali", setengah.length, 4);
sama("yang dijawab model dipakai", setengah[0].level, 3);
sama("yang tidak dijawab jadi level terendah", setengah[1].level, 1);
benar("dan alasannya mengatakan apa adanya",
  setengah[1].alasan.toLowerCase().includes("tidak memberi penilaian"));

// Model yang menjawab level 9 pada rubrik 1–4 bukan alasan menolak seluruh
// penilaian; ia alasan memakai 4.
sama("level di atas skala dijepit",
  bacaPenilaian({ kriteria: [{ urut: 0, level: 9, alasan: "x" }] }, rubrik4)[0].level, 4);
sama("level di bawah skala dijepit",
  bacaPenilaian({ kriteria: [{ urut: 0, level: -2, alasan: "x" }] }, rubrik4)[0].level, 1);
sama("urut di luar jangkauan diabaikan",
  bacaPenilaian({ kriteria: [{ urut: 99, level: 3, alasan: "x" }] }, rubrik4)[0].level, 1);
sama("jawaban bukan objek tidak memecahkan apa-apa", bacaPenilaian(null, rubrik4).length, 4);
sama("jawaban tanpa kriteria tetap lengkap", bacaPenilaian({}, rubrik4).length, 4);

// ============================================================
// HASIL
// ============================================================
console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
