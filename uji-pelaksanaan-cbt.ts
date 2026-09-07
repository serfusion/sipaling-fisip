// UJI PELAKSANAAN ULANG CBT
//
// Yang diuji di sini satu keluhan yang benar-benar datang dari lapangan:
// ujian sudah pernah dibuka dan ditutup, jam dan tanggalnya diperbarui supaya
// dapat dibuka lagi, tetapi mahasiswanya tetap tidak bisa masuk.
//
// Sebabnya jatah percobaan. "Satu orang satu kali" itu benar untuk satu kali
// pelaksanaan, dan salah kalau dihitung seumur hidup ujiannya — ujian susulan
// dan ujian ulang memakai baris ujian yang sama.
//
// Dua sisi yang harus lulus bersama-sama, karena memperbaiki satu sisi saja
// justru merusak sisi lain:
//
//   - dijadwalkan ulang sesudah tutup  -> jatah kembali, mahasiswa dapat masuk
//   - jam digeser saat sedang berjalan -> jatah TETAP terpakai, dan mahasiswa
//     yang sedang mengerjakan tidak kehilangan lembarnya

import {
  attemptHidup, attemptPelaksanaanIni, batasPelaksanaan, pelaksanaanBaru, statusUjian,
} from "./src/lib/cbt";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

/** Tanggal 5 September, hari ujian yang pertama. */
const h1 = (t: string) => new Date(`2026-09-05T${t}:00+07:00`);
/** Tanggal 12 September, hari ujian susulannya. */
const h2 = (t: string) => new Date(`2026-09-12T${t}:00+07:00`);

type Baris = { id: number; startedAt: Date; deadlineAt: Date; status: string; attemptNo: number };

const attempt = (id: number, mulai: Date, menit: number, status: string, no = 1): Baris => ({
  id, startedAt: mulai, deadlineAt: new Date(mulai.getTime() + menit * 60_000), status, attemptNo: no,
});

console.log("\n=== KAPAN SEBUAH PELAKSANAAN DIANGGAP BARU ===\n");

// Dasarnya keadaan ujian SEBELUM jadwal barunya disimpan.
sama("ujian sudah tutup, dijadwalkan ulang", pelaksanaanBaru("selesai"), true);
sama("ujian belum pernah dibuka", pelaksanaanBaru("menunggu"), true);
sama("ujian masih menunggu jam mulainya", pelaksanaanBaru("terjadwal"), true);
sama("ujian belum berjadwal sama sekali", pelaksanaanBaru("draf"), true);
// Inilah pengecualiannya, dan ia yang menjaga nilai orang lain.
sama("ujian sedang berjalan, jamnya digeser", pelaksanaanBaru("berlangsung"), false);

sama("belum diaktifkan berarti tanpa batas", batasPelaksanaan({ activatedAt: null }), 0);
sama("sudah diaktifkan memakai jam aktivasinya",
  batasPelaksanaan({ activatedAt: h2("07:30") }), h2("07:30").getTime());

console.log("=== KELUHANNYA: SUDAH DIBUKA, DITUTUP, LALU DIBUKA LAGI ===\n");

// Pelaksanaan pertama. Dosen mengaktifkan pukul 07.30, ujian 09.00-11.00,
// durasi 60 menit. Satu mahasiswa masuk 09.15 dan mengumpulkan.
const aktivasi1 = h1("07:30");
const riwayat: Baris[] = [attempt(1, h1("09:15"), 60, "selesai", 1)];

const sesi1 = attemptPelaksanaanIni(riwayat, { activatedAt: aktivasi1 });
sama("pelaksanaan pertama: percobaannya terhitung", sesi1.length, 1);
benar("jatah 1 habis pada pelaksanaan pertama", sesi1.length >= 1);

// Sepekan kemudian dosen membuka ujian susulan. Ia menekan "Perbarui jadwal"
// pukul 07.30 tanggal 12, dan menyetel jendelanya 08.00-15.00 — SENGAJA
// dimulai lebih pagi daripada percobaan lama pukul 09.15, karena begitulah
// cara membuat ujian langsung terbuka hari itu.
const statusSaatDiperbarui = statusUjian(
  { aktif: true, mulai: h1("09:00"), selesai: h1("11:00") },
  h2("07:30"),
);
sama("ujian lama memang sudah berstatus selesai", statusSaatDiperbarui, "selesai");
sama("maka ini pelaksanaan baru", pelaksanaanBaru(statusSaatDiperbarui), true);

const aktivasi2 = h2("07:30");
const sesi2 = attemptPelaksanaanIni(riwayat, { activatedAt: aktivasi2 });
sama("percobaan pekan lalu tidak ikut menghabiskan jatah", sesi2.length, 0);
benar("mahasiswa yang sama boleh masuk lagi", sesi2.length < 1 + 0 + 1);

// Batas yang lama — jam MULAI ujian — tidak menyelesaikan keluhan ini, karena
// dosen justru menyetel jam mulai lebih pagi supaya ujiannya langsung terbuka.
const batasJamMulai = h2("08:00");
sama("batas jam mulai masih menahan percobaan lama? tidak, tanggalnya beda",
  riwayat.filter((a) => a.startedAt.getTime() >= batasJamMulai.getTime()).length, 0);

// Yang benar-benar gagal pada batas lama: jendela diperpanjang pada HARI YANG
// SAMA tanpa menggeser jam mulainya. Ini kejadian "listrik padam, lanjutkan".
const batasJamMulaiSehari = h1("09:00");
sama("batas jam mulai: percobaan hari itu tetap terhitung — inilah bugnya",
  riwayat.filter((a) => a.startedAt.getTime() >= batasJamMulaiSehari.getTime()).length, 1);
sama("batas aktivasi: dibuka ulang sore harinya, jatah kembali",
  attemptPelaksanaanIni(riwayat, { activatedAt: h1("13:00") }).length, 0);

console.log("=== SISI SEBALIKNYA: JAM DIGESER SAAT UJIAN BERJALAN ===\n");

// Pukul 10.00, ujian sedang berlangsung. Dua puluh mahasiswa sudah
// mengumpulkan, satu masih mengerjakan. Dosen menambah waktu tutup.
const sedangJalan: Baris[] = [
  attempt(1, h1("09:05"), 60, "selesai", 1),
  attempt(2, h1("09:07"), 60, "selesai", 1),
  attempt(3, h1("09:50"), 60, "berjalan", 1),
];
const statusSaatDigeser = statusUjian(
  { aktif: true, mulai: h1("09:00"), selesai: h1("11:00") },
  h1("10:00"),
);
sama("ujiannya memang sedang berlangsung", statusSaatDigeser, "berlangsung");
sama("menggeser jamnya bukan pelaksanaan baru", pelaksanaanBaru(statusSaatDigeser), false);

// Karena bukan pelaksanaan baru, activatedAt-nya tidak berubah.
const sesiJalan = attemptPelaksanaanIni(sedangJalan, { activatedAt: aktivasi1 });
sama("yang sudah mengumpulkan tetap terhitung", sesiJalan.length, 3);
benar("jadi mereka tidak dapat mengerjakan ulang", sesiJalan.filter((a) => a.status === "selesai").length === 2);

// Dan yang paling penting: yang sedang mengerjakan tidak boleh kehilangan
// lembarnya. Ia dicari dari SELURUH riwayat, bukan dari saringan di atas.
const hidup = attemptHidup(sedangJalan, h1("10:00"));
sama("lembar yang sedang dikerjakan tetap ditemukan", hidup?.id, 3);

console.log("=== PERCOBAAN BASI TIDAK IKUT DIHIDUPKAN ===\n");

// Mahasiswa yang perambannya tertutup dan tidak pernah kembali meninggalkan
// baris "berjalan" selamanya. Waktunya sudah lewat; membukanya lagi berarti
// memberi tambahan waktu kepada orang yang jam ujiannya sudah habis.
const basi: Baris[] = [attempt(9, h1("09:00"), 60, "berjalan", 1)];
sama("sesudah batas waktu: tidak dianggap hidup", attemptHidup(basi, h1("10:30")), undefined);
sama("sebelum batas waktu: masih hidup", attemptHidup(basi, h1("09:30"))?.id, 9);
sama("tepat di detik batas: sudah tidak hidup", attemptHidup(basi, h1("10:00")), undefined);

// Baris basi itu tetap MENGHABISKAN jatah pada pelaksanaan yang sama — memang
// begitu seharusnya, waktunya sudah dipakai.
sama("basi tetap terhitung pada pelaksanaannya",
  attemptPelaksanaanIni(basi, { activatedAt: aktivasi1 }).length, 1);
// Tetapi tidak pada pelaksanaan berikutnya.
sama("basi tidak terbawa ke pelaksanaan berikutnya",
  attemptPelaksanaanIni(basi, { activatedAt: aktivasi2 }).length, 0);

// Yang sudah dikumpulkan jelas bukan lembar hidup, walau jamnya masih panjang.
sama("yang sudah selesai bukan lembar hidup",
  attemptHidup([attempt(4, h1("09:00"), 600, "selesai", 1)], h1("09:30")), undefined);
sama("yang waktu_habis bukan lembar hidup",
  attemptHidup([attempt(5, h1("09:00"), 600, "waktu_habis", 1)], h1("09:30")), undefined);

console.log("=== NOMOR PERCOBAAN TIDAK BOLEH DIULANG ===\n");

// Indeks unik (ujian, nim, nomor) menolak nomor yang sudah terpakai. Nomor
// baru karena itu dihitung dari SELURUH riwayat, bukan dari pelaksanaan ini
// saja — kalau tidak, mahasiswa yang masuk pada ujian susulan menabrak baris
// pekan lalu tepat ketika ia menekan "Mulai Ujian".
const nomorBaru = (r: Baris[]) => r.reduce((n, a) => Math.max(n, a.attemptNo), 0) + 1;
sama("pelaksanaan pertama mulai dari 1", nomorBaru([]), 1);
sama("pelaksanaan kedua melanjutkan nomornya", nomorBaru(riwayat), 2);
sama("bukan mengulang dari saringan pelaksanaan ini", nomorBaru(sesi2), 1);
benar("dan nomor itu memang berbeda", nomorBaru(riwayat) !== nomorBaru(sesi2));

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
