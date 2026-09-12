// ============================================================
// JAM INDONESIA
//
// Satu berkas yang menjawab satu keluhan: jam ujian yang tertulis "07:30 AM"
// dan jam ujian yang bergeser sendiri.
//
// DUA sebab, dan keduanya berbeda:
//
//   1. AM/PM datang dari PERAMBAN, bukan dari halaman. <input type="datetime-local">
//      dan <input type="time"> menggambar dirinya menurut bahasa sistem operasi
//      pemakainya, dan laptop yang bahasanya English (United States) — kebanyakan
//      laptop yang dipakai pengajar — menggambarkan jam dua belas beserta AM dan PM.
//      Tidak ada atribut yang dapat memaksanya. Yang dapat dilakukan halaman
//      hanya BERHENTI MEMAKAI kotak isian itu dan menggambar pemilih jamnya
//      sendiri: 00 sampai 23, dengan angka yang ditulisnya sendiri.
//
//   2. Pergeseran jam datang dari ZONA WAKTU PERANGKAT. `new Date("2026-05-12T08:00")`
//      berarti "pukul delapan menurut jam perangkat ini" — dan perangkat yang
//      zonanya UTC, atau pengajar yang sedang di Makassar, menyimpan jam mulai yang
//      berbeda dari yang ia ketik. Peserta yang membuka tautannya kemudian
//      menemukan ujian yang belum terbuka, atau ujian yang sudah tutup.
//
// Karena itu seluruh jam CBT di sistem ini dibaca dan ditulis dalam SATU zona
// yang tetap, ditulis apa adanya di bawah, dan ditampilkan dengan huruf zonanya
// supaya tidak ada yang perlu menebak jam siapa yang dimaksud.
// ============================================================

/**
 * Zona yang dipakai seluruh jadwal ujian.
 *
 * Sengaja satu, bukan zona masing-masing perangkat: satu ujian dibuka pada satu
 * jam untuk semua pesertanya, dan jam itu harus berarti sama bagi pengajar yang
 * menyetelnya dan peserta yang menunggunya.
 *
 * Penyelenggara di luar WIB mengubah DUA baris di bawah ini sekaligus — nama
 * zonanya dan hurufnya — lalu seluruh sistem ikut. Keduanya harus cocok: WITA
 * adalah "Asia/Makassar", WIT adalah "Asia/Jayapura".
 */
export const ZONA_UJIAN = "Asia/Jakarta";
export const HURUF_ZONA = "WIB";

/** Jam dan menit yang sudah terpisah, siap dipasang pada pemilih. */
export type JamPecah = {
  /** "YYYY-MM-DD" menurut zona ujian. */
  tanggal: string;
  /** 0–23. */
  jam: number;
  /** 0–59. */
  menit: number;
};

const KOSONG: JamPecah = { tanggal: "", jam: 0, menit: 0 };

function angkaBagian(bagian: Intl.DateTimeFormatPart[], jenis: Intl.DateTimeFormatPartTypes) {
  return Number(bagian.find((b) => b.type === jenis)?.value ?? "0");
}

/**
 * Pecah satu saat menjadi tanggal, jam, dan menit MENURUT ZONA UJIAN.
 *
 * Dipakai untuk mengisi formulir jadwal: yang tersimpan di basis data selalu
 * UTC, sedangkan yang harus terbaca pengajar adalah jam Indonesianya.
 */
export function pecahWaktuUjian(nilai: string | Date | null | undefined): JamPecah {
  if (!nilai) return { ...KOSONG };
  const d = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(d.getTime())) return { ...KOSONG };

  // formatToParts, bukan penguraian tali hasil format. Susunan tali berbeda
  // antarperamban; nama bagiannya tidak.
  const bagian = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_UJIAN,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);

  const tahun = angkaBagian(bagian, "year");
  const bulan = angkaBagian(bagian, "month");
  const hari = angkaBagian(bagian, "day");
  if (!tahun || !bulan || !hari) return { ...KOSONG };
  return {
    tanggal: `${String(tahun).padStart(4, "0")}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`,
    // h23 memberi 0–23, jadi tengah malam terbaca 0 dan bukan 24.
    jam: angkaBagian(bagian, "hour") % 24,
    menit: angkaBagian(bagian, "minute"),
  };
}

/** Selisih zona ujian terhadap UTC pada satu saat, dalam menit. */
function selisihMenit(saat: Date): number {
  // Dihitung, bukan ditulis tetap +7, supaya berkas ini tetap benar bila
  // ZONA_UJIAN diganti ke zona yang mengenal waktu musim panas.
  const bagian = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_UJIAN,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(saat);
  const sebagaiUtc = Date.UTC(
    angkaBagian(bagian, "year"),
    angkaBagian(bagian, "month") - 1,
    angkaBagian(bagian, "day"),
    angkaBagian(bagian, "hour") % 24,
    angkaBagian(bagian, "minute"),
    angkaBagian(bagian, "second"),
  );
  return Math.round((sebagaiUtc - saat.getTime()) / 60_000);
}

/**
 * Susun satu saat dari tanggal, jam, dan menit yang DIMAKSUDKAN sebagai jam
 * Indonesia — apa pun zona perangkat yang mengetiknya.
 *
 * Mengembalikan null bila isiannya belum lengkap atau tidak masuk akal, dan
 * itulah yang membuat tombol aktivasi berani mematikan dirinya sendiri: satu
 * pemeriksaan yang sama dipakai untuk menyusun jam DAN untuk memutuskan
 * tombolnya boleh ditekan atau tidak.
 */
export function susunWaktuUjian(tanggal: string, jam: number, menit: number): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tanggal || ""))) return null;
  const j = Number(jam);
  const m = Number(menit);
  if (!Number.isInteger(j) || j < 0 || j > 23) return null;
  if (!Number.isInteger(m) || m < 0 || m > 59) return null;

  const [tahun, bulan, hari] = tanggal.split("-").map(Number);
  if (!tahun || !bulan || !hari) return null;

  // Ditebak sebagai UTC lebih dulu, lalu digeser sebanyak selisih zonanya pada
  // saat itu. Dua langkah, karena selisihnya sendiri bergantung pada saatnya.
  const tebakan = new Date(Date.UTC(tahun, bulan - 1, hari, j, m, 0, 0));
  if (Number.isNaN(tebakan.getTime())) return null;
  const hasil = new Date(tebakan.getTime() - selisihMenit(tebakan) * 60_000);
  return Number.isNaN(hasil.getTime()) ? null : hasil;
}

type GayaJam = {
  /** Sertakan nama harinya — "Senin". */
  hari?: boolean;
  /** Sertakan tahunnya. Mati secara bawaan: jadwal ujian hampir selalu tahun ini. */
  tahun?: boolean;
  /** Bulan ditulis penuh ("Mei"), bukan disingkat ("Mei" tetap, "Agu" menjadi "Agustus"). */
  panjang?: boolean;
};

/**
 * Satu saat, ditulis seperti orang Indonesia menuliskannya.
 *
 * Tiga hal yang membedakannya dari toLocaleString apa adanya, dan ketiganya
 * disengaja: jamnya 24 jam tanpa AM dan PM, zonanya selalu zona ujian, dan
 * huruf zonanya ikut tertulis. Yang terakhir yang paling sering terlupa —
 * "08.00" tanpa keterangan adalah jam yang harus ditebak, dan yang menebaknya
 * adalah peserta yang sedang menunggu ujiannya dibuka.
 */
export function jamIndonesia(nilai: string | Date | null | undefined, gaya: GayaJam = {}): string {
  if (!nilai) return "-";
  const d = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(d.getTime())) return "-";
  const teks = d.toLocaleString("id-ID", {
    timeZone: ZONA_UJIAN,
    ...(gaya.hari ? { weekday: "long" as const } : {}),
    day: "numeric",
    month: gaya.panjang ? ("long" as const) : ("short" as const),
    ...(gaya.tahun ? { year: "numeric" as const } : {}),
    hour: "2-digit",
    minute: "2-digit",
    // Dituliskan terus terang meskipun id-ID memang tidak memakai AM/PM.
    // Peramban lama yang datanya tidak lengkap jatuh kembali ke bahasa
    // sistemnya, dan di situlah "AM" muncul lagi tanpa ada yang meminta.
    hour12: false,
    hourCycle: "h23",
  });
  return `${teks} ${HURUF_ZONA}`;
}

/** Pilihan untuk pemilih jam: 00 sampai 23. */
export const PILIHAN_JAM: string[] = Array.from({ length: 24 }, (_, n) => String(n).padStart(2, "0"));

/** Pilihan untuk pemilih menit: 00 sampai 59. */
export const PILIHAN_MENIT: string[] = Array.from({ length: 60 }, (_, n) => String(n).padStart(2, "0"));

/**
 * Sisa waktu menuju satu saat, dieja untuk dibaca orang yang sedang menunggu.
 *
 * "Terbuka dalam 1 jam 12 menit" menjawab pertanyaan yang sebenarnya —
 * "saya harus menunggu berapa lama" — sedangkan jam pembukaannya saja menuntut
 * orang menghitungnya sendiri, dan orang yang sedang menunggu ujian tidak
 * sedang dalam keadaan menghitung dengan benar.
 */
export function ejaSelisih(detik: number): string {
  const utuh = Math.max(0, Math.floor(detik));
  if (utuh < 60) return `${utuh} detik`;
  const menit = Math.floor(utuh / 60);
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;
  if (jam < 24) return sisaMenit === 0 ? `${jam} jam` : `${jam} jam ${sisaMenit} menit`;
  const hari = Math.floor(jam / 24);
  const sisaJam = jam % 24;
  return sisaJam === 0 ? `${hari} hari` : `${hari} hari ${sisaJam} jam`;
}
