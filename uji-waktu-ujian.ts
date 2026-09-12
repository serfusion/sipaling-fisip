// UJI JAM UJIAN — ZONA INDONESIA DAN SYARAT JADWAL
//
// Dua keluhan yang dijawab berkas ini, dan keduanya tentang jam:
//
//   1. "Hapus jam AM dan PM, sesuaikan jam Indonesia."
//      AM/PM sendiri tidak dapat diuji di sini — ia digambar peramban pada
//      <input type="datetime-local">, dan jawabannya adalah berhenti memakai
//      kotak isian itu (lihat PilihJam di cbt-panel.tsx). Yang DAPAT diuji, dan
//      yang justru lebih berbahaya, adalah paruh keduanya: jam yang bergeser
//      karena zona perangkat. Pengajar yang laptopnya berzona UTC mengetik "08.00"
//      dan menyimpan ujian yang terbuka pukul tiga sore.
//
//   2. "Apabila jamnya kurang memenuhi syarat waktu yang telah ditentukan,
//      jadikan abu-abu." Tombol yang mematikan dirinya sendiri hanya berguna
//      bila ia mati pada keadaan yang BENAR — tombol yang mati pada jadwal yang
//      sebenarnya sah adalah ujian yang tidak jadi dibuka.
//
// Seluruh uji di bawah berjalan pada zona perangkat mana pun: TZ diputar
// sebelum berkasnya dijalankan, dan hasilnya harus sama.

import {
  ejaSelisih, HURUF_ZONA, jamIndonesia, pecahWaktuUjian, PILIHAN_JAM, PILIHAN_MENIT,
  susunWaktuUjian, ZONA_UJIAN,
} from "./src/lib/waktu-indonesia";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

console.log(`=== ZONA UJIAN: ${ZONA_UJIAN} (${HURUF_ZONA}) ===`);
console.log(`=== ZONA PERANGKAT PENGUJI: ${process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone} ===\n`);

// ------------------------------------------------------------
// MENYUSUN JAM: yang diketik pengajar selalu berarti jam Indonesia
// ------------------------------------------------------------
console.log("=== YANG DIKETIK PENGAJAR ADALAH JAM INDONESIA ===\n");

// Pukul 08.00 WIB adalah pukul 01.00 UTC. Ini satu-satunya angka yang benar,
// apa pun zona laptop yang mengetiknya.
sama("08.00 WIB tersimpan sebagai 01.00 UTC",
  susunWaktuUjian("2026-05-12", 8, 0)?.toISOString(), "2026-05-12T01:00:00.000Z");
sama("00.00 WIB adalah 17.00 UTC hari sebelumnya",
  susunWaktuUjian("2026-05-12", 0, 0)?.toISOString(), "2026-05-11T17:00:00.000Z");
sama("23.59 WIB masih hari yang sama di WIB",
  susunWaktuUjian("2026-05-12", 23, 59)?.toISOString(), "2026-05-12T16:59:00.000Z");
sama("menit ganjil tidak dibulatkan",
  susunWaktuUjian("2026-05-12", 7, 31)?.toISOString(), "2026-05-12T00:31:00.000Z");

// Pergantian tahun: yang paling sering salah pada penyusunan jam bertangan.
sama("31 Desember 23.00 WIB masih tahun itu di UTC",
  susunWaktuUjian("2026-12-31", 23, 0)?.toISOString(), "2026-12-31T16:00:00.000Z");
sama("1 Januari 06.00 WIB adalah 31 Desember di UTC",
  susunWaktuUjian("2027-01-01", 6, 0)?.toISOString(), "2026-12-31T23:00:00.000Z");

console.log("=== ISIAN YANG BELUM LENGKAP MENJAWAB NULL ===\n");

// Inilah yang membuat tombol aktivasi berani mematikan dirinya: satu
// pemeriksaan yang sama dipakai untuk menyusun jam DAN untuk memutuskan
// tombolnya boleh ditekan.
sama("tanggal kosong", susunWaktuUjian("", 8, 0), null);
sama("tanggal tidak berbentuk", susunWaktuUjian("12/05/2026", 8, 0), null);
sama("jam di luar 0-23", susunWaktuUjian("2026-05-12", 24, 0), null);
sama("jam negatif", susunWaktuUjian("2026-05-12", -1, 0), null);
sama("menit di luar 0-59", susunWaktuUjian("2026-05-12", 8, 60), null);
sama("jam pecahan ditolak", susunWaktuUjian("2026-05-12", 8.5, 0), null);
sama("bukan angka sama sekali", susunWaktuUjian("2026-05-12", Number.NaN, 0), null);

console.log("=== PECAH DAN SUSUN SALING MEMBALIK ===\n");

// Yang tersimpan di basis data dibaca kembali ke formulir, lalu disimpan lagi
// tanpa disentuh. Jamnya TIDAK BOLEH bergeser satu menit pun oleh perjalanan
// pulang pergi itu — dan dahulu ia bergeser, sebanyak selisih zona perangkatnya.
for (const [tanggal, jam, menit] of [
  ["2026-05-12", 8, 0],
  ["2026-05-12", 0, 0],
  ["2026-05-12", 23, 59],
  ["2026-01-01", 13, 45],
  ["2026-08-17", 17, 5],
] as Array<[string, number, number]>) {
  const saat = susunWaktuUjian(tanggal, jam, menit);
  const balik = pecahWaktuUjian(saat);
  sama(`pulang pergi ${tanggal} ${jam}.${String(menit).padStart(2, "0")}`,
    `${balik.tanggal} ${balik.jam}.${balik.menit}`, `${tanggal} ${jam}.${menit}`);
}

sama("tanggal kosong dipecah menjadi kosong", pecahWaktuUjian(null).tanggal, "");
sama("tali sampah dipecah menjadi kosong", pecahWaktuUjian("bukan tanggal").tanggal, "");

// Yang datang dari server selalu ISO berakhiran Z.
const dariServer = pecahWaktuUjian("2026-05-12T01:00:00.000Z");
sama("ISO dari server dibaca sebagai jam WIB", `${dariServer.tanggal} ${dariServer.jam}`, "2026-05-12 8");

console.log("=== YANG TERTULIS DI LAYAR ===\n");

const tertulis = jamIndonesia("2026-05-12T01:00:00.000Z");
benar("tidak ada AM maupun PM", !/\b[AP]M\b/i.test(tertulis), tertulis);
benar("jamnya 24 jam dan itu jam WIB-nya", tertulis.includes("08.00"), tertulis);
benar("huruf zonanya ikut tertulis", tertulis.endsWith(HURUF_ZONA), tertulis);

const sore = jamIndonesia("2026-05-12T08:30:00.000Z");
benar("pukul setengah empat sore ditulis 15.30", sore.includes("15.30"), sore);
benar("dan tanpa PM", !/\bPM\b/i.test(sore), sore);

const tengahMalam = jamIndonesia("2026-05-11T17:00:00.000Z");
benar("tengah malam ditulis 00.00, bukan 24.00", tengahMalam.includes("00.00"), tengahMalam);
benar("dan tanggalnya sudah berganti", tengahMalam.includes("12"), tengahMalam);

sama("yang kosong tetap tanda pisah", jamIndonesia(null), "-");
sama("yang tidak masuk akal tetap tanda pisah", jamIndonesia("bukan tanggal"), "-");

const berhari = jamIndonesia("2026-05-12T01:00:00.000Z", { hari: true, tahun: true, panjang: true });
benar("nama hari ikut bila diminta", berhari.includes("Selasa"), berhari);
benar("tahun ikut bila diminta", berhari.includes("2026"), berhari);
benar("bulan penuh bila diminta", berhari.includes("Mei"), berhari);

console.log("=== PILIHAN JAM DAN MENIT ===\n");

sama("dua puluh empat pilihan jam", PILIHAN_JAM.length, 24);
sama("mulai dari 00", PILIHAN_JAM[0], "00");
sama("berakhir di 23 — tidak ada jam 12 kedua", PILIHAN_JAM[23], "23");
sama("enam puluh pilihan menit", PILIHAN_MENIT.length, 60);
sama("menit berangka dua", PILIHAN_MENIT[7], "07");
benar("tidak satu pun pilihan memuat AM/PM",
  ![...PILIHAN_JAM, ...PILIHAN_MENIT].some((p) => /[ap]m/i.test(p)));

console.log("=== SISA WAKTU MENUJU PEMBUKAAN ===\n");

sama("kurang dari semenit", ejaSelisih(45), "45 detik");
sama("tepat semenit", ejaSelisih(60), "1 menit");
sama("menitnya dibulatkan ke bawah", ejaSelisih(119), "1 menit");
sama("sejam lewat", ejaSelisih(3 * 3600 + 12 * 60), "3 jam 12 menit");
sama("sejam bulat tanpa menit", ejaSelisih(3600), "1 jam");
sama("sehari lebih", ejaSelisih(26 * 3600), "1 hari 2 jam");
sama("waktu yang sudah lewat tidak menjadi negatif", ejaSelisih(-500), "0 detik");

// ------------------------------------------------------------
// SYARAT JADWAL — yang membuat tombol aktivasi abu-abu
// ------------------------------------------------------------
//
// Salinan aturan yang sama persis dengan halanganJadwal() di cbt-panel.tsx dan
// dengan penolakan server di api/cbt/aktivasi/route.ts. Diuji di sini sebagai
// aturan, bukan sebagai tombol: yang harus benar adalah KEADAAN MANA yang
// menahan, dan keadaan mana yang tidak.
console.log("=== SYARAT SEBELUM UJIAN BOLEH DIAKTIFKAN ===\n");

function halangan(opsi: {
  mulai: Date | null; selesai: Date | null; durasi: number;
  jumlahBank: number; soalDipakai: number;
}): string | null {
  const { mulai, selesai, durasi, jumlahBank, soalDipakai } = opsi;
  if (!mulai || !selesai) return "belum lengkap";
  if (selesai.getTime() <= mulai.getTime()) return "selesai sebelum mulai";
  if (Math.round((selesai.getTime() - mulai.getTime()) / 60_000) < durasi) return "jendela terlalu pendek";
  if (jumlahBank === 0) return "bank kosong";
  if (soalDipakai > jumlahBank) return "bank kurang";
  return null;
}

const pagi = susunWaktuUjian("2026-05-12", 8, 0);
const siang = susunWaktuUjian("2026-05-12", 10, 0);

sama("jadwal yang sah tidak terhalang",
  halangan({ mulai: pagi, selesai: siang, durasi: 60, jumlahBank: 30, soalDipakai: 20 }), null);
sama("jam mulai belum diisi",
  halangan({ mulai: null, selesai: siang, durasi: 60, jumlahBank: 30, soalDipakai: 20 }), "belum lengkap");
sama("jam selesai belum diisi",
  halangan({ mulai: pagi, selesai: null, durasi: 60, jumlahBank: 30, soalDipakai: 20 }), "belum lengkap");
sama("selesai mendahului mulai",
  halangan({ mulai: siang, selesai: pagi, durasi: 60, jumlahBank: 30, soalDipakai: 20 }), "selesai sebelum mulai");
sama("mulai dan selesai pada detik yang sama",
  halangan({ mulai: pagi, selesai: pagi, durasi: 60, jumlahBank: 30, soalDipakai: 20 }), "selesai sebelum mulai");

// Jendela dua jam untuk ujian tiga jam: setiap peserta terpotong, dan dahulu
// itu baru ketahuan ketika mereka sudah duduk di depan layar.
sama("jendela lebih pendek daripada durasinya",
  halangan({ mulai: pagi, selesai: siang, durasi: 180, jumlahBank: 30, soalDipakai: 20 }), "jendela terlalu pendek");
sama("jendela yang persis sepanjang durasinya boleh",
  halangan({ mulai: pagi, selesai: siang, durasi: 120, jumlahBank: 30, soalDipakai: 20 }), null);

sama("bank soal masih kosong",
  halangan({ mulai: pagi, selesai: siang, durasi: 60, jumlahBank: 0, soalDipakai: 20 }), "bank kosong");
sama("bank lebih sedikit daripada yang dipakai",
  halangan({ mulai: pagi, selesai: siang, durasi: 60, jumlahBank: 15, soalDipakai: 20 }), "bank kurang");
sama("bank yang pas boleh",
  halangan({ mulai: pagi, selesai: siang, durasi: 60, jumlahBank: 20, soalDipakai: 20 }), null);
sama("bank yang berlebih juga boleh — soalnya diacak dari seluruh bank",
  halangan({ mulai: pagi, selesai: siang, durasi: 60, jumlahBank: 90, soalDipakai: 20 }), null);

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
