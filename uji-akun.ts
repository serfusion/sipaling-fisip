// UJI AKUN LANGGANAN — nomor WhatsApp, perpanjangan, dan penguncian kode.
//
// Tiga hal dijaga di sini, dan ketiganya soal orang yang sudah membayar:
//
// 1. Nomor yang sama harus SELALU terbaca sama, dari mana pun ia datang.
//    "0812…", "+62 812…", dan "62812…@c.us" adalah satu orang. Kalau
//    ketiganya menjadi tiga akun, orang yang memperpanjang lewat WhatsApp
//    menambah hari pada akun yang bukan miliknya.
//
// 2. Perpanjangan harus MENAMBAH, bukan memotong. Membeli paket kedua sepekan
//    sebelum yang pertama habis tidak boleh menghanguskan sisa tujuh harinya.
//
// 3. Satu kode hanya untuk satu nomor. Penguncinya ada di basis data — kolom
//    UNIQUE pada cakrawala_redemptions.code — jadi yang diperiksa di sini
//    adalah bahwa migrasinya benar-benar memuat kunci itu. Kunci yang hanya
//    ada di pemeriksaan JavaScript dapat dilewati dua permintaan yang datang
//    bersamaan; kunci di basis data tidak.

import { readFileSync } from "node:fs";
import {
  rapikanWa, perpanjang, akunAktif, umurCookieAkun, samarkanWa,
  AKUN_COOKIE_MAX_AGE, TENGGANG_COOKIE,
} from "./src/lib/akun-cakrawala";
import { hariKode, type CakrawalaCode } from "./src/lib/cakrawala";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

console.log("\n=== NOMOR WHATSAPP ===\n");

sama("nol di depan menjadi 62", rapikanWa("081234567890"), "6281234567890");
sama("tanda plus dibuang", rapikanWa("+6281234567890"), "6281234567890");
sama("spasi dan tanda hubung dibuang", rapikanWa("+62 812-3456-7890"), "6281234567890");
sama("kurung dibuang", rapikanWa("(0812) 3456 7890"), "6281234567890");
sama("sudah 62 dibiarkan", rapikanWa("6281234567890"), "6281234567890");
sama("tanpa nol dan tanpa kode negara", rapikanWa("81234567890"), "6281234567890");
sama("bentuk WhatsApp @c.us dipotong", rapikanWa("6281234567890@c.us"), "6281234567890");

// Semua bentuk di atas WAJIB bermuara pada satu nomor yang sama. Inilah
// syarat agar perpanjangan lewat WhatsApp mendarat di akun yang benar.
const bentuk = ["081234567890", "+6281234567890", "+62 812-3456-7890", "6281234567890@c.us", "81234567890"];
sama("semua bentuk bermuara pada satu nomor", new Set(bentuk.map(rapikanWa)).size, 1);

sama("kosong ditolak", rapikanWa(""), null);
sama("null ditolak", rapikanWa(null), null);
sama("bukan angka ditolak", rapikanWa("nomor saya"), null);
sama("terlalu pendek ditolak", rapikanWa("0812345"), null);
sama("terlalu panjang ditolak", rapikanWa("6281234567890123456"), null);
// Nomor luar negeri yang bukan Indonesia tidak dilayani: langganannya
// diperpanjang lewat WhatsApp ke nomor Indonesia.
sama("kode negara lain ditolak", rapikanWa("+14155552671"), null);
benar("hasilnya selalu berawalan 62", bentuk.every((b) => rapikanWa(b)?.startsWith("62")));
benar("hasilnya hanya angka", bentuk.every((b) => /^\d+$/.test(rapikanWa(b) ?? "x")));

console.log("\n=== PERPANJANGAN ===\n");

const kini = new Date("2026-09-02T10:00:00Z");
const hari = (n: number) => n * 24 * 60 * 60_000;

// Langganan yang MASIH berjalan: harinya ditambahkan dari tanggal akhirnya.
const masihAda = new Date(kini.getTime() + hari(7));
sama("menambah dari akhir yang masih berjalan",
  perpanjang(masihAda, 30, kini).getTime(), masihAda.getTime() + hari(30));
benar("sisa hari lama tidak hangus",
  perpanjang(masihAda, 30, kini).getTime() > kini.getTime() + hari(30));

// Langganan yang SUDAH lewat: dihitung dari hari ini, bukan dari tanggal
// akhirnya yang sudah di belakang — kalau dari sana, orang yang berhenti
// setahun lalu membeli 30 hari dan mendapat langganan yang sudah mati.
const sudahLewat = new Date(kini.getTime() - hari(40));
sama("yang sudah lewat dihitung dari hari ini",
  perpanjang(sudahLewat, 30, kini).getTime(), kini.getTime() + hari(30));
sama("belum pernah berlangganan dihitung dari hari ini",
  perpanjang(null, 30, kini).getTime(), kini.getTime() + hari(30));
benar("hasil perpanjangan selalu di depan hari ini",
  [null, sudahLewat, masihAda].every((d) => perpanjang(d, 1, kini).getTime() > kini.getTime()));

// Tepat pada detik berakhirnya dihitung sebagai SUDAH lewat, sama seperti
// akunAktif membacanya. Dua fungsi yang berbeda pendapat pada perbatasan
// membuat akun yang tampak mati justru diperpanjang dari masa depan.
sama("tepat di detik berakhirnya dihitung dari hari ini",
  perpanjang(new Date(kini.getTime()), 5, kini).getTime(), kini.getTime() + hari(5));

const akun = (sampai: Date) => ({
  id: 1, whatsapp: "6281234567890", name: null, expiresAt: sampai,
  token: "t".repeat(64), lastCode: "CKRW-AAAA-BBBB", redeemCount: 1,
  createdAt: kini, lastSeenAt: null,
});

benar("akun yang masih berjalan aktif", akunAktif(akun(masihAda), kini));
benar("akun yang sudah lewat tidak aktif", !akunAktif(akun(sudahLewat), kini));
benar("tepat di detik berakhirnya tidak aktif", !akunAktif(akun(new Date(kini.getTime())), kini));

console.log("\n=== UMUR COOKIE ===\n");

// Cookie tidak boleh hidup lebih lama daripada langganannya: yang terjadi
// bukan akses gratis — gerbangnya tetap memeriksa tanggal — melainkan
// pengguna yang dilempar keluar tanpa penjelasan.
sama("umur cookie = sisa langganan + tenggang",
  umurCookieAkun(akun(new Date(kini.getTime() + hari(3))), kini), 3 * 24 * 60 * 60 + TENGGANG_COOKIE);
sama("sisa yang sangat panjang dipotong batas atas",
  umurCookieAkun(akun(new Date(kini.getTime() + hari(4000))), kini), AKUN_COOKIE_MAX_AGE);
benar("langganan yang sudah lewat tetap memberi umur positif",
  umurCookieAkun(akun(sudahLewat), kini) >= 60);
// Tenggangnya hanya memperpanjang INGATAN peramban, bukan aksesnya: cookie
// yang masih hidup pada akun yang sudah lewat tetap harus terbaca tidak aktif.
benar("cookie masih hidup pada akun yang sudah habis",
  umurCookieAkun(akun(new Date(kini.getTime() - hari(5))), kini) > 60);
benar("tetapi akunnya tetap terbaca tidak aktif",
  !akunAktif(akun(new Date(kini.getTime() - hari(5))), kini));
benar("umur cookie tidak pernah melampaui batas atasnya",
  [1, 30, 180, 4000].every((d) => umurCookieAkun(akun(new Date(kini.getTime() + hari(d))), kini) <= AKUN_COOKIE_MAX_AGE));

console.log("\n=== NOMOR YANG DISAMARKAN ===\n");

sama("empat angka depan dan belakang tetap terbaca",
  samarkanWa("6281234567890"), "6281*****7890");
benar("angka di tengah tidak ikut keluar", !samarkanWa("6281234567890").includes("23456"));
sama("panjangnya tidak berubah", samarkanWa("6281234567890").length, 13);
sama("nomor pendek dibiarkan", samarkanWa("628123"), "628123");

console.log("\n=== LAMA LANGGANAN DARI KODE ===\n");

const kode = (isi: Partial<CakrawalaCode>): CakrawalaCode => ({
  code: "CKRW-AAAA-BBBB", label: "", active: true, maxUses: 0, uses: 0,
  expiresAt: null, createdAt: kini.toISOString(), lastUsedAt: null, ...isi,
});

sama("kolom hari dipakai apa adanya", hariKode(kode({ hari: 30 })), 30);
// Kode yang terbit SEBELUM kolom hari ada tidak punya angkanya; lamanya
// disimpulkan dari jarak pembuatan ke masa berlakunya.
sama("kode lama disimpulkan dari masa berlakunya",
  hariKode(kode({ expiresAt: new Date(kini.getTime() + hari(180)).toISOString() })), 180);
sama("kode tanpa batas waktu diberi setahun", hariKode(kode({})), 365);
benar("hasilnya selalu positif",
  [kode({ hari: 3 }), kode({}), kode({ expiresAt: kini.toISOString() })].every((k) => hariKode(k) > 0));

console.log("\n=== PENGUNCIAN KODE DI BASIS DATA ===\n");

// Aturan "satu kode satu nomor" ditegakkan oleh basis data, bukan oleh
// pemeriksaan di JavaScript: dua permintaan yang datang pada milidetik yang
// sama dapat lolos pemeriksaan bersama-sama, dan hanya penolakan UNIQUE yang
// menghentikan yang kedua. Karena itu keberadaan kuncinya ikut diuji.
const sqlAkun = readFileSync("./supabase-update-v16-akun-cakrawala.sql", "utf8").toLowerCase();
benar("migrasi membuat tabel akun", sqlAkun.includes("create table if not exists public.cakrawala_accounts"));
benar("migrasi membuat tabel penukaran", sqlAkun.includes("create table if not exists public.cakrawala_redemptions"));
benar("kode penukaran dikunci UNIQUE", /code\s+varchar\(\d+\)\s+not null unique/.test(sqlAkun));
benar("nomor whatsapp dikunci UNIQUE", /whatsapp\s+varchar\(\d+\)\s+not null unique/.test(sqlAkun));
benar("token dikunci UNIQUE", /token\s+varchar\(\d+\)\s+not null unique/.test(sqlAkun));
benar("token diberi indeks", sqlAkun.includes("idx_cakrawala_accounts_token"));
// Nomor WhatsApp pelanggan tidak boleh terbaca langsung dari peramban.
benar("RLS menyala pada tabel akun", sqlAkun.includes("alter table public.cakrawala_accounts   enable row level security")
  || /alter table public\.cakrawala_accounts\s+enable row level security/.test(sqlAkun));
benar("RLS menyala pada tabel penukaran",
  /alter table public\.cakrawala_redemptions\s+enable row level security/.test(sqlAkun));
benar("tidak ada policy yang membuka bacaannya untuk umum", !sqlAkun.includes("create policy"));

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
