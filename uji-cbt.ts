// UJI ATURAN CBT
//
// Yang dijaga di sini adalah keputusan-keputusan yang menentukan nasib nilai
// mahasiswa, dan yang kesalahannya baru terlihat setelah terlambat — ketika
// nilai sudah keluar dan mahasiswanya sudah pulang.

import {
  statusUjian, bolehMasuk, batasWaktu, sisaDetik, ejaWaktu,
  kocok, acakBerbenih, susunPaket, nilaiJawaban, hitungNilai, rapikanIsian,
  periksaMasuk, rapikanNim, rapikanNama, rapikanToken, kodeUjianBaru,
  analisisSoal, statistikNilai, otomatis, MEDIA_KOSONG, type Soal,
} from "./src/lib/cbt";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

const jam = (t: string) => new Date(`2026-09-05T${t}:00+07:00`);
const pukul9 = jam("09:00");
const pukul10 = jam("10:00");
const pukul11 = jam("11:00");
const pukul12 = jam("12:00");

console.log("\n=== JAM BUKA UJIAN ===\n");

// Permintaan pemiliknya: "jam 10 ada test cbt, admin setting jam 10 akan
// terbuka otomatis". Tidak ada tombol yang harus ditekan pada detik itu.
const jadwal = { aktif: true, mulai: pukul10, selesai: pukul12 };
sama("sebelum jam mulai: terjadwal", statusUjian(jadwal, pukul9), "terjadwal");
sama("tepat jam mulai: berlangsung", statusUjian(jadwal, pukul10), "berlangsung");
sama("di tengah jendela: berlangsung", statusUjian(jadwal, pukul11), "berlangsung");
sama("sesudah jam tutup: selesai", statusUjian(jadwal, jam("12:01")), "selesai");

// Tanpa aktivasi Super Admin/Admin, jam berapa pun tidak membuka apa-apa.
sama("belum diaktifkan tetap tertutup",
  statusUjian({ aktif: false, mulai: pukul10, selesai: pukul12 }, pukul11), "menunggu");
benar("dan mahasiswa tidak boleh masuk",
  !bolehMasuk({ aktif: false, mulai: pukul10, selesai: pukul12 }, pukul11));
sama("tanpa jadwal masih draf", statusUjian({ aktif: true, mulai: null, selesai: null }), "draf");

benar("boleh masuk hanya saat berlangsung", bolehMasuk(jadwal, pukul11));
benar("tidak boleh masuk sebelum waktunya", !bolehMasuk(jadwal, pukul9));
benar("tidak boleh masuk setelah ditutup", !bolehMasuk(jadwal, jam("12:30")));

console.log("\n=== BATAS WAKTU DIHITUNG SERVER ===\n");

// Yang lebih dulu antara durasi dan jam tutup ujian.
sama("durasi penuh bila jendelanya masih panjang",
  batasWaktu(pukul10, 60, pukul12).toISOString(), pukul11.toISOString());
// Masuk 20 menit sebelum tutup: tidak mendapat satu jam penuh.
sama("dipotong jam tutup ujian",
  batasWaktu(jam("11:40"), 60, pukul12).toISOString(), pukul12.toISOString());
sama("tanpa jam tutup, durasi apa adanya",
  batasWaktu(pukul10, 90, null).toISOString(), jam("11:30").toISOString());

sama("sisa waktu dalam detik", sisaDetik(pukul11, pukul10), 3600);
sama("sisa waktu tidak pernah negatif", sisaDetik(pukul10, pukul11), 0);
sama("format jam:menit:detik", ejaWaktu(3661), "01:01:01");
sama("di bawah sejam tanpa angka jam", ejaWaktu(125), "02:05");
sama("nol detik", ejaWaktu(0), "00:00");
sama("detik negatif dibaca nol", ejaWaktu(-5), "00:00");

console.log("\n=== PENGACAKAN YANG DAPAT DIULANG ===\n");

const daftar = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// Mahasiswa yang jaringannya putus lalu kembali HARUS menemukan soal nomor 7
// yang sama. Karena itu urutannya diturunkan dari benih, bukan diacak ulang.
sama("benih yang sama menghasilkan urutan yang sama",
  JSON.stringify(kocok(daftar, 12345)), JSON.stringify(kocok(daftar, 12345)));
benar("benih berbeda menghasilkan urutan berbeda",
  JSON.stringify(kocok(daftar, 1)) !== JSON.stringify(kocok(daftar, 2)));
benar("tidak ada yang hilang saat diacak",
  kocok(daftar, 99).slice().sort((a, b) => a - b).join() === daftar.join());
benar("pengacak menghasilkan angka 0..1",
  Array.from({ length: 50 }, acakBerbenih(7)).every((n) => n >= 0 && n < 1));

const bank: Soal[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1, jenis: "pg", pertanyaan: `Soal ${i + 1}`,
  pilihan: ["A", "B", "C", "D"], kunci: "1", bobot: 1,
  materi: "", tingkat: "sedang", pembahasan: "", pasangan: [], media: MEDIA_KOSONG,
}));

const paket = susunPaket(bank, { acakSoal: true, acakPilihan: true, jumlahSoal: 8 }, 777);
sama("bank 20 soal, ujian 8 soal", paket.length, 8);
benar("tidak ada soal kembar dalam satu paket", new Set(paket.map((p) => p.id)).size === 8);
sama("paket dari benih yang sama identik",
  JSON.stringify(susunPaket(bank, { acakSoal: true, acakPilihan: true, jumlahSoal: 8 }, 777).map((p) => p.id)),
  JSON.stringify(paket.map((p) => p.id)));
benar("peta pilihan ikut tersimpan", paket.every((p) => p.petaPilihan.length === 4));
// KUNCI JAWABAN TIDAK BOLEH IKUT ke bentuk yang dikirim ke mahasiswa.
benar("paket tidak membawa kunci jawaban",
  !JSON.stringify(paket).includes("kunci") && !JSON.stringify(paket).includes("pembahasan"));

// Bank yang lebih sedikit daripada permintaan dipakai seadanya: ujian yang
// gagal terbuka karena kurang satu soal jauh lebih buruk.
sama("bank lebih sedikit dipakai semua",
  susunPaket(bank.slice(0, 5), { acakSoal: false, acakPilihan: false, jumlahSoal: 40 }, 1).length, 5);
sama("jumlah 0 berarti semua soal",
  susunPaket(bank, { acakSoal: false, acakPilihan: false, jumlahSoal: 0 }, 1).length, 20);

console.log("\n=== PENILAIAN ===\n");

const pg: Soal = { id: 1, jenis: "pg", pertanyaan: "?", pilihan: ["A", "B", "C", "D"], kunci: "2", bobot: 5, materi: "", tingkat: "sedang", pembahasan: "", pasangan: [], media: MEDIA_KOSONG };
sama("jawaban benar tanpa acak", nilaiJawaban(pg, "2").poin, 5);
sama("jawaban salah", nilaiJawaban(pg, "0").benar, false);
sama("tidak dijawab dianggap salah, poin nol", nilaiJawaban(pg, "").poin, 0);

// Inilah yang paling mudah salah: pilihan sudah diacak, jadi "pilihan ke-0
// pada layar" belum tentu "pilihan ke-0 pada bank". Salah mengembalikannya
// berarti menyalahkan mahasiswa yang menjawab benar.
const peta = [3, 2, 1, 0];
sama("pilihan teracak dikembalikan dulu", nilaiJawaban(pg, "1", peta).benar, true);
sama("dan yang bukan kuncinya tetap salah", nilaiJawaban(pg, "0", peta).benar, false);

const isian: Soal = { ...pg, id: 2, jenis: "isian", pilihan: [], kunci: "komunikasi massa|mass communication", bobot: 4 };
sama("isian cocok", nilaiJawaban(isian, "Komunikasi Massa").benar, true);
sama("kunci kedua juga diterima", nilaiJawaban(isian, "mass communication").benar, true);
sama("tanda baca dan spasi diabaikan", nilaiJawaban(isian, "  komunikasi,  massa! ").benar, true);
sama("jawaban lain salah", nilaiJawaban(isian, "komunikasi politik").benar, false);
sama("penyeragam isian", rapikanIsian("Komunikasi  Massa!!"), "komunikasi massa");

const essay: Soal = { ...pg, id: 3, jenis: "essay", pilihan: [], kunci: "", bobot: 20 };
// Essay yang belum dikoreksi BUKAN jawaban salah. Membedakannya penting:
// menghitungnya salah membuat nilai sementara jauh lebih rendah daripada
// yang sebenarnya, dan mahasiswanya panik atas sesuatu yang belum terjadi.
sama("essay menunggu dosen, bukan salah", nilaiJawaban(essay, "jawaban panjang").benar, null);
benar("essay tidak dinilai mesin", !otomatis("essay"));
benar("pilihan ganda dinilai mesin", otomatis("pg"));

console.log("\n=== NILAI SATU ATTEMPT ===\n");

const soalUjian: Soal[] = [pg, isian, essay];
const hasil = hitungNilai(
  soalUjian,
  { 1: "2", 2: "komunikasi massa", 3: "jawaban essay" },
  {},
  60,
);
// Nilai adalah persentase BOBOT, bukan jumlah soal: essay 20 poin dan pilihan
// ganda 5 poin tidak boleh dihitung sederajat.
sama("poin maksimal menjumlah bobot", hasil.poinMaks, 29);
sama("dua benar mesin", hasil.benar, 2);
sama("satu essay tertunda", hasil.tertunda, 1);
sama("poin sementara 9 dari 29", hasil.poin, 9);
benar("nilai sementara di bawah 100", hasil.nilai < 100);

const sesudahKoreksi = hitungNilai(
  soalUjian,
  { 1: "2", 2: "komunikasi massa", 3: "jawaban essay" },
  {},
  60,
  { 3: 20 },
);
sama("sesudah essay dikoreksi penuh: 100", sesudahKoreksi.nilai, 100);
benar("dan dinyatakan lulus", sesudahKoreksi.lulus);
sama("tidak ada lagi yang tertunda", sesudahKoreksi.tertunda, 0);

const kosongSemua = hitungNilai(soalUjian, {}, {}, 60);
sama("tidak menjawab apa pun: nol", kosongSemua.nilai, 0);
sama("dan ketiganya terhitung kosong", kosongSemua.kosong, 3);
benar("tidak lulus", !kosongSemua.lulus);

console.log("\n=== IDENTITAS TANPA LOGIN ===\n");

sama("NIM hanya angka", rapikanNim("19-6520.1058"), "1965201058");
sama("nama dirapikan", rapikanNama("  Darojah   Nur  Syarifah "), "Darojah Nur Syarifah");
sama("token huruf besar tanpa tanda", rapikanToken(" k7m2-qx "), "K7M2QX");

const tanpaToken = { token: null, nimMin: 6 };
benar("nama dan NIM cukup", periksaMasuk({ nama: "Budi Santoso", nim: "1965201058" }, tanpaToken).ok);
benar("nama kosong ditolak", !periksaMasuk({ nama: "", nim: "1965201058" }, tanpaToken).ok);
benar("nama satu huruf ditolak", !periksaMasuk({ nama: "B", nim: "1965201058" }, tanpaToken).ok);
benar("NIM kosong ditolak", !periksaMasuk({ nama: "Budi Santoso", nim: "" }, tanpaToken).ok);
benar("NIM terlalu pendek ditolak", !periksaMasuk({ nama: "Budi Santoso", nim: "123" }, tanpaToken).ok);

const denganToken = { token: "K7M2QX", nimMin: 6 };
benar("token benar diterima",
  periksaMasuk({ nama: "Budi Santoso", nim: "1965201058", token: "k7m2qx" }, denganToken).ok);
benar("token salah ditolak",
  !periksaMasuk({ nama: "Budi Santoso", nim: "1965201058", token: "SALAH1" }, denganToken).ok);
benar("token kosong ditolak saat diwajibkan",
  !periksaMasuk({ nama: "Budi Santoso", nim: "1965201058" }, denganToken).ok);

// Kode ujian dibacakan di depan kelas: huruf yang mudah tertukar dibuang.
const kode = Array.from({ length: 200 }, () => kodeUjianBaru());
benar("kode selalu enam huruf", kode.every((k) => k.length === 6));
benar("tanpa huruf yang mudah tertukar (I, O, 0, 1)", kode.every((k) => !/[IO01]/.test(k)));
benar("kodenya beragam", new Set(kode).size > 190);

console.log("\n=== ANALISIS ===\n");

const analisis = analisisSoal(
  [{ id: 1, pertanyaan: "Mudah" }, { id: 2, pertanyaan: "Sulit sekali" }],
  [
    ...Array.from({ length: 8 }, () => ({ questionId: 1, benar: true })),
    ...Array.from({ length: 2 }, () => ({ questionId: 1, benar: false })),
    ...Array.from({ length: 2 }, () => ({ questionId: 2, benar: true })),
    ...Array.from({ length: 8 }, () => ({ questionId: 2, benar: false })),
  ],
);
sama("soal mudah 80%", analisis[0].persen, 80);
sama("dan dikategorikan mudah", analisis[0].kategori, "mudah");
sama("soal sulit 20%", analisis[1].persen, 20);
// Di bawah 30% ditandai: bisa jadi memang sulit, bisa jadi kuncinya salah —
// dan yang terakhir itu yang paling mahal bila tidak ketahuan.
benar("dan ditandai perlu ditinjau", analisis[1].perluDitinjau);
benar("yang mudah tidak ditandai", !analisis[0].perluDitinjau);
// Essay yang belum dikoreksi tidak boleh ikut menghitung persentase.
sama("yang belum dinilai tidak ikut dihitung",
  analisisSoal([{ id: 1, pertanyaan: "x" }], [{ questionId: 1, benar: null }])[0].dijawab, 0);

const stat = statistikNilai([90, 80, 70, 60, 50], 65);
sama("peserta", stat.peserta, 5);
sama("rata-rata", stat.rata, 70);
sama("tertinggi", stat.tertinggi, 90);
sama("terendah", stat.terendah, 50);
sama("median ganjil", stat.median, 70);
sama("median genap", statistikNilai([60, 70, 80, 90], 65).median, 75);
sama("jumlah lulus", stat.lulus, 3);
sama("persen lulus", stat.persenLulus, 60);
sama("tanpa peserta tidak pecah", statistikNilai([], 60).peserta, 0);

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
