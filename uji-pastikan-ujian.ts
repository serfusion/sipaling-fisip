// UJI KOTAK PASTIKAN UJIAN
//
// Satu keluhan dari peserta sungguhan, dan seluruh berkas ini menguji
// perbaikannya:
//
//   "Baru mau mengakhiri ujian, malah kena pelanggaran keluar dari layar."
//
// SEBABNYA. Pertanyaan "yakin mau mengumpulkan?" dahulu ditanyakan
// window.confirm(). Kotak itu BUKAN lapisan di dalam halaman — ia milik
// peramban, berdiri di luar dokumen — dan Chrome MELEPAS LAYAR PENUH sebelum
// menggambarnya. Pelepasan itu mengirim `fullscreenchange` yang tidak diminta
// siapa pun, dan penjaga ujian membacanya persis seperti peserta yang menekan
// Esc untuk mengintip jendela lain: satu pelanggaran berat, satu kotak
// teguran, satu langkah lebih dekat ke pengumpulan paksa — untuk satu ketukan
// pada tombol "AKHIRI UJIAN".
//
// Peramban lain melepas FOKUS jendelanya selama kotak itu berdiri, dan peserta
// yang membaca pertanyaannya lebih dari satu setengah detik mendapat catatan
// "jendela kehilangan fokus" sebagai gantinya.
//
// DUA LAPIS PERBAIKANNYA, dan keduanya diuji di bawah:
//
//   1. Pertanyaannya digambar halaman itu sendiri (src/app/cbt/ujian/
//      pastikan.tsx). Tidak ada kotak peramban, jadi tidak ada layar penuh yang
//      lepas dan tidak ada fokus yang keluar. Kalimatnya diuji di sini; adanya
//      kotak peramban di layar ujian ditolak oleh pemindaian sumber di bawah.
//   2. Sejak "kumpulkan" ditekan, dua insiden yang memang dilahirkan penutupan
//      ujian — layar penuh yang dilepas halaman, fokus yang berpindah ke layar
//      hasil — berhenti dicatat atas nama peserta. Itulah milikPengakhiran(),
//      dan yang diuji bukan hanya dua yang masuk melainkan SEMUA yang tidak
//      boleh ikut.
//
// Yang TIDAK diperbaiki, dan sengaja: pertanyaannya sendiri tidak dihapus.
// Ketukan pada "AKHIRI UJIAN" tidak dapat ditarik kembali, dan tombolnya duduk
// persis di tempat "SOAL SELANJUTNYA" berada satu soal sebelumnya.

import { readFileSync } from "node:fs";
import { pastikanKeluar, pastikanKumpul, rincianSisa } from "./src/lib/pastikan";
import { SEMUA_INSIDEN, milikPengakhiran, type JenisInsiden } from "./src/lib/pengawasan";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

// Berkas sumber dibaca SEKALI di sini, bukan di tempat masing-masing
// pemeriksaan — alasan yang sama seperti di uji-kunci-layar.ts.
const pastikanTsx = readFileSync("./src/app/cbt/ujian/pastikan.tsx", "utf8");
const penjagaTs = readFileSync("./src/app/cbt/ujian/penjaga.ts", "utf8");
const ujianApp = readFileSync("./src/app/cbt/ujian/ujian-app.tsx", "utf8");
const gaya = readFileSync("./src/app/globals.css", "utf8");

console.log("\n=== RINCIAN SOAL YANG BELUM SELESAI ===\n");

// Yang salah di sini bukan kalimat yang jelek, melainkan peserta yang
// mengumpulkan ujiannya sambil mengira seluruh soalnya sudah terjawab.
sama("semua terjawab, tidak ada yang perlu diperingatkan", rincianSisa(0, 0), "");
sama("hanya yang kosong", rincianSisa(3, 0), "3 soal belum dijawab");
sama("hanya yang ragu-ragu", rincianSisa(0, 2), "2 soal ditandai ragu-ragu");
sama("keduanya, disambung 'dan'", rincianSisa(3, 2),
  "3 soal belum dijawab dan 2 soal ditandai ragu-ragu");
sama("satu soal pun tetap disebut", rincianSisa(1, 0), "1 soal belum dijawab");
// Angka minus tidak seharusnya sampai ke sini, tetapi soal.length - terjawab
// adalah pengurangan, dan pengurangan dapat salah. Yang tidak boleh terjadi
// adalah kotak yang berkata "-1 soal belum dijawab".
sama("angka minus tidak pernah ditulis", rincianSisa(-1, -1), "");

console.log("=== PERTANYAAN SEBELUM MENGUMPULKAN ===\n");

const bersih = pastikanKumpul({ kosong: 0, ragu: 0 });
const tertinggal = pastikanKumpul({ kosong: 3, ragu: 2 });

sama("nada kotaknya merah — ia menutup ujian", bersih.nada, "akhir");
benar("judulnya bertanya, bukan memberi tahu", bersih.judul.endsWith("?"), bersih.judul);
sama("tidak ada yang tertinggal, tidak ada baris rincian", bersih.rincian, "");
sama("yang tertinggal disebut apa adanya", tertinggal.rincian,
  "Masih ada 3 soal belum dijawab dan 2 soal ditandai ragu-ragu.");

// Akibat yang tidak dapat ditarik kembali HARUS tertulis sebelum ketukannya,
// bukan sesudah. Peserta yang mengira masih bisa masuk lagi adalah peserta
// yang kehilangan sisa waktunya tanpa pernah diberi tahu.
const kalimatKumpul = tertinggal.kalimat.join(" ");
benar("akibatnya disebut: lembarnya tidak dapat dibuka lagi",
  /tidak dapat dibuka lagi/i.test(kalimatKumpul), kalimatKumpul);
benar("akibatnya disebut: sisa waktunya hangus",
  /sisa waktunya/i.test(kalimatKumpul), kalimatKumpul);

benar("dua jalan keluarnya berbeda", bersih.ya !== bersih.tidak);
benar("tombol ya menyebut perbuatannya", /kumpulkan/i.test(bersih.ya), bersih.ya);
// "Belum", bukan "Batal": yang ditanyakan bukan perintah yang dapat gagal
// melainkan kesiapan orangnya.
benar("tombol batal tidak terbaca seperti kegagalan",
  bersih.tidak.toLowerCase().startsWith("belum"), bersih.tidak);
benar("yang masih punya soal kosong diajak kembali ke soalnya",
  /kembali ke soal/i.test(tertinggal.tidak), tertinggal.tidak);

console.log("=== PERTANYAAN SEBELUM MENINGGALKAN HALAMAN ===\n");

const keluar = pastikanKeluar();
sama("nada kotaknya bukan merah — ujiannya tidak ditutup", keluar.nada, "keluar");
// Inilah kalimat yang tidak boleh hilang dari kotak ini. Peserta yang mengira
// keluar berarti menjeda akan kembali ke lembar yang waktunya sudah habis, dan
// tidak ada cara memulihkan menit-menit itu untuknya.
benar("waktu yang terus berjalan ditulis dengan huruf besar",
  keluar.rincian.includes("WAKTU UJIAN TERUS BERJALAN"), keluar.rincian);
const kalimatKeluar = keluar.kalimat.join(" ");
benar("jawaban yang tersimpan dikatakan tidak hilang",
  /tidak hilang/i.test(kalimatKeluar), kalimatKeluar);
benar("dikatakan ia dapat masuk lagi", /masuk lagi/i.test(kalimatKeluar), kalimatKeluar);
benar("dikatakan ujiannya TIDAK ikut dikumpulkan",
  /tidak ikut dikumpulkan/i.test(kalimatKeluar), kalimatKeluar);

console.log("=== INSIDEN YANG DILAHIRKAN PENUTUPAN, BUKAN PESERTANYA ===\n");

// Dua ini memang dikerjakan halaman ujian sendiri begitu jawabannya terkumpul:
// layar penuhnya dilepas supaya pesertanya tidak terkunci di halaman hasil, dan
// fokusnya berpindah ke layar hasil pada saat yang sama.
benar("layar penuh yang dilepas saat menutup tidak dicatat",
  milikPengakhiran("fullscreen"));
benar("fokus yang pindah ke layar hasil tidak dicatat", milikPengakhiran("blur"));

// Dan inilah sisi yang jauh lebih penting: SEMUA yang lain tetap dicatat, juga
// pada detik-detik terakhir sebuah ujian. Pengakhiran bukan pintu keluar yang
// dapat dibuka lalu dipakai untuk hal lain — menekan "kumpulkan" lalu berpindah
// tab selama pengiriman berlangsung tetap satu pelanggaran.
const bolehDiam: JenisInsiden[] = ["fullscreen", "blur"];
for (const jenis of SEMUA_INSIDEN) {
  if (bolehDiam.includes(jenis)) continue;
  benar(`"${jenis}" tetap dicatat selama pengiriman`, milikPengakhiran(jenis) === false);
}
sama("hanya dua yang boleh diam, tidak lebih",
  SEMUA_INSIDEN.filter(milikPengakhiran).join(","), "fullscreen,blur");

console.log("=== TIDAK ADA KOTAK BAWAAN PERAMBAN DI LAYAR UJIAN ===\n");

/**
 * Buang komentar sebelum memindai.
 *
 * Berkas-berkas ini MENYEBUT window.confirm berkali-kali di dalam komentarnya —
 * justru untuk menerangkan kenapa ia tidak boleh dipakai — dan pemindaian yang
 * ikut membaca komentar akan menolak keterangannya sendiri.
 */
function tanpaKomentar(sumber: string): string {
  return sumber
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((baris) => baris.replace(/\/\/.*$/, " "))
    .join("\n");
}

const KOTAK_PERAMBAN = /\b(?:window\s*\.\s*)?(confirm|alert|prompt)\s*\(/;
for (const [nama, sumber] of [
  ["pastikan.tsx", pastikanTsx],
  ["penjaga.ts", penjagaTs],
  ["ujian-app.tsx", ujianApp],
] as const) {
  const kena = tanpaKomentar(sumber)
    .split("\n")
    .map((baris, i) => ({ baris: baris.trim(), nomor: i + 1 }))
    .filter(({ baris }) => KOTAK_PERAMBAN.test(baris));
  benar(
    `${nama} tidak memanggil kotak bawaan peramban`,
    kena.length === 0,
    kena.map((k) => `baris ${k.nomor}: ${k.baris.slice(0, 70)}`).join(" | "),
  );
}

console.log("=== KOTAKNYA TERPASANG DAN TAHU TEMPATNYA ===\n");

benar("layar ujian menggambar kotak pastikannya sendiri",
  ujianApp.includes("<Pastikan"));
benar("kotaknya dipanggil dari tombol akhiri", ujianApp.includes("pastikanKumpul("));
benar("kotaknya dipanggil dari tombol keluar", ujianApp.includes("pastikanKeluar("));

// Kotak ini HARUS kalah dari tirai (60) dan kotak teguran (70). Peserta yang
// membukanya lalu keluar dari layar penuh tidak boleh mendapati soalnya
// terbuka di belakang sebuah kotak yang boleh dibiarkan terbuka.
const zPastikan = /\.uj-pastikan\s*\{[^}]*z-index:\s*(\d+)/.exec(gaya);
const zTirai = /\.uj-tirai\s*\{[^}]*z-index:\s*(\d+)/.exec(gaya);
const zTegur = /\.uj-tegur\s*\{[^}]*z-index:\s*(\d+)/.exec(gaya);
benar("ketiga lapisan punya z-index yang tertulis",
  Boolean(zPastikan && zTirai && zTegur));
if (zPastikan && zTirai && zTegur) {
  benar("kotak pastikan berada DI BAWAH tirai",
    Number(zPastikan[1]) < Number(zTirai[1]), `${zPastikan[1]} lawan ${zTirai[1]}`);
  benar("kotak pastikan berada DI BAWAH kotak teguran",
    Number(zPastikan[1]) < Number(zTegur[1]), `${zPastikan[1]} lawan ${zTegur[1]}`);
}

console.log("=== PENGAWASAN TIDAK TERTIDUR OLEH KOTAKNYA ===\n");

// Ini bagian yang paling mudah salah dan paling mahal bila salah: kalau
// pengawasan dijeda selama kotak konfirmasi terbuka, jalan curang termurah yang
// dapat dibayangkan terbuka lebar — tekan "Akhiri", pindah tab mencari jawaban
// selagi kotaknya menunggu, lalu tekan "Belum".
//
// Karena itu yang mematikan laporan BUKAN kotaknya, melainkan `mengakhiri`, dan
// ia baru menyala sesudah pengumpulannya benar-benar dimulai.
benar("penjaga mengenal keadaan mengakhiri", penjagaTs.includes("mengakhiri"));
benar("penjaga menyaring lewat milikPengakhiran",
  penjagaTs.includes("milikPengakhiran(jenis)"));
benar("layar ujian meneruskan keadaan itu ke penjaga",
  /usePenjaga\(\{[^}]*mengakhiri[^}]*\}\)/.test(ujianApp));
// Menyala saat pengumpulan dimulai, padam lagi pada tiap jalan gagal — kalau
// tidak, satu pengumpulan yang gagal karena jaringan akan mematikan dua
// deteksi itu sepanjang sisa ujian.
benar("mengakhiri menyala ketika pengumpulan dimulai",
  ujianApp.includes("setMengakhiri(true)"));
// Dua jalan gagal: jawaban yang belum sampai ke server, dan pengiriman yang
// ditolak. Keduanya mengembalikan pesertanya ke soal, jadi keduanya harus
// mengembalikan penjagaannya juga.
benar("dan padam lagi pada tiap jalan gagal",
  (ujianApp.match(/setMengakhiri\(false\)/g) ?? []).length >= 2,
  `ada ${(ujianApp.match(/setMengakhiri\(false\)/g) ?? []).length}`);
// Dan pada tiap jalan MASUK ke lembar ujian. Tanpa ini, peserta yang keluar
// lewat Logout di tengah ujian lalu masuk kembali membawa keadaan yang masih
// menyala — dan layar penuh maupun fokusnya tidak lagi dijaga sampai ujiannya
// habis.
const masukKerja = (ujianApp.match(/setLayar\("kerja"\)/g) ?? []).length;
const dipulangkanDulu =
  (ujianApp.match(/setMengakhiri\(false\);(?:[^\n]*\n){1,7}\s*setLayar\("kerja"\)/g) ?? []).length;
benar("tiap jalan masuk ke lembar ujian memulangkannya ke false",
  masukKerja > 0 && dipulangkanDulu === masukKerja,
  `${dipulangkanDulu} dari ${masukKerja} jalan masuk`);

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
