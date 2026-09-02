// UJI PEMBACA PEMBERITAHUAN UANG MASUK
//
// Yang dijaga di sini adalah dua kesalahan yang sama-sama mahal:
//
// 1. Pembayaran yang SUDAH masuk tidak terbaca → orang yang sudah membayar
//    menatap layar "menunggu pembayaran". Itu yang menghancurkan kepercayaan.
//
// 2. Sesuatu yang BUKAN pembayaran terbaca sebagai pembayaran → kode akses
//    terbit untuk orang yang belum membayar sepeser pun.
//
// Kalimat-kalimat di bawah ditulis mengikuti bentuk pemberitahuan yang
// sungguh-sungguh muncul di ponsel, bukan bentuk yang enak diuji.

import { arahMasuk, bacaNominal, semuaNominal, bacaMutasi, teksDariMuatan } from "./src/lib/mutasi";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

console.log("\n=== MEMBACA NOMINAL ===\n");

sama("bentuk DANA yang lazim", bacaNominal("Transaksi Berhasil! Kamu menerima Rp25.037 dari Naufal"), 25_037);
sama("dengan spasi setelah Rp", bacaNominal("Kamu menerima Rp 25.037"), 25_037);
sama("dengan titik setelah Rp", bacaNominal("Uang masuk Rp. 25.037"), 25_037);
sama("huruf kecil", bacaNominal("menerima rp25.037"), 25_037);
sama("tanpa pemisah ribuan", bacaNominal("Kamu menerima Rp25037"), 25_037);
sama("nominal enam angka", bacaNominal("Kamu menerima Rp160.045 dari Rina"), 160_045);

// Koma memisahkan SEN, titik memisahkan ribuan. Terbalik membacanya berarti
// Rp25.037,00 menjadi 2.503.700 dan pesanannya tidak pernah ketemu.
sama("sen dibuang, bukan dianggap ribuan", bacaNominal("Kamu menerima Rp25.037,00"), 25_037);
sama("sen dua angka bukan nol", bacaNominal("Rp25.037,50 diterima"), 25_037);

sama("kalimat tanpa rupiah", bacaNominal("Paket Anda sedang dalam perjalanan"), null);
sama("kalimat kosong", bacaNominal(""), null);
sama("rupiah tanpa angka", bacaNominal("saldo Rp kosong"), null);

console.log("\n=== NOMINAL PERTAMA, BUKAN TERBESAR ===\n");

// Inilah jebakan yang paling berbahaya: pemberitahuan menyebut nominal
// transaksinya lebih dulu, lalu SISA SALDO. Mengambil yang terbesar berarti
// pada suatu hari sisa saldo kebetulan sama dengan sebuah pesanan hidup, dan
// kode akses terbit untuk orang yang belum membayar apa-apa.
const denganSaldo = "Kamu menerima Rp10.001 dari Budi. Saldo DANA kamu sekarang Rp25.037";
sama("yang diambil nominal transaksinya", bacaNominal(denganSaldo), 10_001);
benar("bukan sisa saldonya", bacaNominal(denganSaldo) !== 25_037);
sama("keduanya tetap terbaca lengkap", JSON.stringify(semuaNominal(denganSaldo)), JSON.stringify([10_001, 25_037]));

console.log("\n=== ARAH UANG ===\n");

benar("menerima", arahMasuk("Kamu menerima Rp25.037 dari Naufal"));
benar("uang masuk", arahMasuk("Rp25.037 masuk ke saldo DANA kamu"));
benar("pembayaran diterima", arahMasuk("Pembayaran diterima Rp25.037"));
benar("bahasa Inggris", arahMasuk("You received Rp25.037"));

// Uang KELUAR yang nominalnya kebetulan sama tidak boleh menerbitkan kode.
// Kata "berhasil" muncul di kedua arah, jadi ia tidak boleh menjadi penentu.
benar("kamu mengirim ditolak", !arahMasuk("Transaksi Berhasil! Kamu mengirim Rp25.037 ke Rina"));
benar("pembayaran ke ditolak", !arahMasuk("Pembayaran ke Tokopedia berhasil Rp25.037"));
benar("transfer ke ditolak", !arahMasuk("Transfer ke BCA berhasil Rp25.037"));
benar("penarikan ditolak", !arahMasuk("Penarikan saldo Rp25.037 berhasil"));
benar("kalimat tanpa arah ditolak", !arahMasuk("Transaksi berhasil Rp25.037"));
benar("kosong ditolak", !arahMasuk(""));

// Kalimat yang memuat kata kedua arah sekaligus dibaca sebagai KELUAR.
// Menebak salah ke arah "masuk" berarti memberi barang gratis; menebak salah
// ke arah "keluar" hanya berarti satu pesanan ditandai lunas dengan tangan.
benar("dua arah sekaligus dibaca keluar",
  !arahMasuk("Kamu mengirim Rp25.037, penerima sudah menerima dananya"));

console.log("\n=== MUTASI UTUH ===\n");

const m = bacaMutasi("  Transaksi Berhasil!   Kamu menerima  Rp25.037  dari Naufal  ");
sama("nominalnya", m?.nominal, 25_037);
sama("arahnya masuk", m?.masuk, true);
benar("spasi berlebih dirapikan", !(m?.teks ?? "").includes("  "));
sama("kalimat tanpa angka bukan mutasi", bacaMutasi("Ada pesan baru untukmu"), null);

const keluar = bacaMutasi("Kamu mengirim Rp25.037 ke Rina");
sama("uang keluar tetap terbaca nominalnya", keluar?.nominal, 25_037);
sama("tetapi ditandai bukan masuk", keluar?.masuk, false);

console.log("\n=== BENTUK KIRIMAN ===\n");

sama("teks polos", teksDariMuatan("Kamu menerima Rp25.037"), "Kamu menerima Rp25.037");
// Nominal kadang hanya ada di judul, kadang hanya di badannya. Keduanya
// digabung supaya tidak ada penerus pemberitahuan yang perlu disetel khusus.
sama("judul dan isi digabung",
  teksDariMuatan({ title: "DANA", text: "Kamu menerima Rp25.037" }),
  "DANA · Kamu menerima Rp25.037");
sama("nama kolom Indonesia", teksDariMuatan({ pesan: "Kamu menerima Rp25.037" }), "Kamu menerima Rp25.037");
sama("kolom kosong diabaikan", teksDariMuatan({ text: "", body: "Rp25.037 masuk" }), "Rp25.037 masuk");
sama("muatan kosong", teksDariMuatan({}), "");
sama("bukan objek", teksDariMuatan(null), "");

// Rangkaian penuh: dari muatan aplikasi penerus sampai nominal yang siap
// dicocokkan dengan pesanan.
const utuh = bacaMutasi(teksDariMuatan({ title: "DANA", body: "Kamu menerima Rp60.112 dari Sari" }));
sama("dari muatan ke nominal", utuh?.nominal, 60_112);
sama("dari muatan ke arah", utuh?.masuk, true);

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
