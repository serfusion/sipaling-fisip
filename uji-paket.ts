// UJI PAKET AKSES — harga, nominal unik, dan masa berlaku kode.
//
// Dua hal yang dijaga di sini, dan keduanya soal uang:
//
// 1. Nominal unik harus benar-benar unik antar pesanan yang masih hidup.
//    Dua pesanan bernominal sama berarti pemiliknya tidak dapat membedakan
//    siapa yang barusan membayar — persis pekerjaan manual yang mau dihapus.
//
// 2. Masa berlaku kode harus ditegakkan. Kode paket tiga hari yang masih
//    membuka Cakrawala pada hari kesepuluh sama saja dengan memberikannya
//    gratis.

import {
  PAKET, paketDari, nominalUnik, penandaKosong, nomorPesanan, rapikanNomorPesanan,
  batasBayar, batasAkses, rupiah, sisaWaktu, MENIT_BAYAR, PENANDA_MIN, PENANDA_MAKS,
} from "./src/lib/paket-cakrawala";
import { kodeBerlaku, kodeKedaluwarsa, sisaMasa, normalizeCakrawala } from "./src/lib/cakrawala";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

console.log("\n=== PAKET ===\n");

sama("ada tiga paket", PAKET.length, 3);
benar("tepat satu paket ditonjolkan", PAKET.filter((p) => p.utama).length === 1);
benar("id paket tidak ada yang kembar", new Set(PAKET.map((p) => p.id)).size === PAKET.length);
benar("harga naik seiring masa berlakunya",
  PAKET.every((p, i) => i === 0 || (p.harga > PAKET[i - 1].harga && p.hari > PAKET[i - 1].hari)));
benar("tiap paket punya harga bulat positif",
  PAKET.every((p) => Number.isInteger(p.harga) && p.harga > 0));
benar("tiap paket punya keterangan yang terbaca",
  PAKET.every((p) => p.jelas.length > 20 && p.untuk.length > 20));
// Makin panjang paketnya, makin murah per harinya — kalau tidak, tidak ada
// alasan siapa pun naik ke paket yang lebih besar.
benar("paket panjang lebih murah per hari",
  PAKET.every((p, i) => i === 0 || p.harga / p.hari < PAKET[i - 1].harga / PAKET[i - 1].hari));

sama("paket dikenali dari id", paketDari("bab")?.harga, 25_000);
sama("id asing ditolak", paketDari("gratisan"), null);
sama("id kosong ditolak", paketDari(""), null);
sama("bukan teks ditolak", paketDari(123), null);

console.log("\n=== NOMINAL UNIK ===\n");

sama("harga 25.000 dengan penanda 37", nominalUnik(25_000, 37), 25_037);
sama("penanda selalu MENAMBAH, tidak pernah mengurangi", nominalUnik(10_000, 1), 10_001);
benar("nominal selalu lebih besar daripada harga paketnya",
  PAKET.every((p) => (nominalUnik(p.harga, PENANDA_MIN) ?? 0) > p.harga));
sama("penanda nol ditolak", nominalUnik(25_000, 0), null);
sama("penanda 1000 ditolak", nominalUnik(25_000, 1000), null);
sama("penanda pecahan ditolak", nominalUnik(25_000, 3.5), null);
sama("harga nol ditolak", nominalUnik(0, 5), null);

// Dua penanda berbeda pada harga yang sama WAJIB menghasilkan nominal berbeda.
const semuaNominal = new Set(
  Array.from({ length: PENANDA_MAKS }, (_, i) => nominalUnik(25_000, i + 1)),
);
sama("999 penanda menghasilkan 999 nominal berbeda", semuaNominal.size, PENANDA_MAKS);

// Paket berbeda tidak boleh bertabrakan nominalnya. 10.000+999 = 10.999 masih
// jauh di bawah 25.000+1 = 25.001, jadi aman — dan itu diperiksa, bukan
// diasumsikan, karena harga paket bisa berubah sewaktu-waktu.
const rentang = PAKET.map((p) => [p.harga + PENANDA_MIN, p.harga + PENANDA_MAKS] as const);
benar(
  "rentang nominal antar paket tidak bertindihan",
  rentang.every(([, atas], i) => i === rentang.length - 1 || atas < rentang[i + 1][0]),
  rentang.map(([a, b]) => `${a}-${b}`).join(" | "),
);

console.log("\n=== PILIH PENANDA KOSONG ===\n");

sama("daftar kosong: dapat penanda", typeof penandaKosong([], () => 0), "number");
sama("acak 0 memberi penanda terkecil", penandaKosong([], () => 0), PENANDA_MIN);
benar("penanda yang sudah dipakai dilewati", penandaKosong([1], () => 0) !== 1);
sama("penanda berikutnya diambil", penandaKosong([1, 2], () => 0), 3);
// Penanda yang sudah lunas/kedaluwarsa TIDAK ikut disodorkan sebagai terpakai,
// jadi persediaannya kembali. Yang diuji: 999 pesanan hidup baru habis.
const penuh = Array.from({ length: PENANDA_MAKS }, (_, i) => i + 1);
sama("penanda habis dilaporkan null", penandaKosong(penuh, () => 0), null);
sama("sisa satu tetap ketemu", penandaKosong(penuh.slice(0, -1), () => 0), PENANDA_MAKS);
benar("hasilnya selalu di dalam rentang", Array.from({ length: 50 }, () => {
  const p = penandaKosong([], Math.random);
  return p !== null && p >= PENANDA_MIN && p <= PENANDA_MAKS;
}).every(Boolean));

console.log("\n=== NOMOR PESANAN ===\n");

const nomor = nomorPesanan();
benar("berawalan PSN-", nomor.startsWith("PSN-"), nomor);
sama("panjangnya tetap", nomor.length, 10);
benar("tanpa huruf yang mudah tertukar", !/[01OIS]/.test(nomor.slice(4)), nomor);
// Sulit ditebak: siapa pun yang dapat menerka nomor pesanan orang lain dapat
// ikut melihat kode akses yang keluar dari pesanan itu.
const banyak = new Set(Array.from({ length: 500 }, () => nomorPesanan()));
benar("500 nomor tidak ada yang kembar", banyak.size === 500, `${banyak.size} unik`);
sama("dirapikan menjadi huruf kapital", rapikanNomorPesanan(" psn-abc123 "), "PSN-ABC123");
sama("bukan teks menjadi kosong", rapikanNomorPesanan(null), "");

console.log("\n=== WAKTU ===\n");

const awal = new Date("2026-09-01T10:00:00Z");
sama("batas bayar 15 menit", batasBayar(awal).toISOString(), "2026-09-01T10:15:00.000Z");
sama("MENIT_BAYAR sesuai", MENIT_BAYAR, 15);
sama("paket coba berakhir 3 hari", batasAkses(PAKET[0], awal).toISOString(), "2026-09-04T10:00:00.000Z");
sama("paket skripsi berakhir 180 hari", batasAkses(PAKET[2], awal).toISOString(), "2027-02-28T10:00:00.000Z");

sama("hitung mundur penuh", sisaWaktu(new Date(awal.getTime() + 15 * 60_000), awal), "15:00");
sama("hitung mundur sebagian", sisaWaktu(new Date(awal.getTime() + 90_000), awal), "01:30");
// Tidak pernah negatif: penghitung yang jalan terus ke minus membuat orang
// mengira pembayarannya masih ditunggu padahal sudah lewat.
sama("sudah lewat berhenti di nol", sisaWaktu(new Date(awal.getTime() - 60_000), awal), "00:00");

sama("rupiah dieja dengan titik", rupiah(25_037), "Rp 25.037");
sama("rupiah bulat", rupiah(1_000_000), "Rp 1.000.000");

console.log("\n=== MASA BERLAKU KODE ===\n");

const kini = new Date("2026-09-01T10:00:00Z");
const buat = (expiresAt: string | null, lain: Record<string, unknown> = {}) =>
  normalizeCakrawala({ codes: [{ code: "CKRW-AAAA-BBBB", expiresAt, active: true, ...lain }] }).codes[0];

benar("tanpa batas waktu tidak pernah kedaluwarsa", !kodeKedaluwarsa(buat(null), kini));
benar("besok belum kedaluwarsa", !kodeKedaluwarsa(buat("2026-09-02T10:00:00Z"), kini));
benar("kemarin sudah kedaluwarsa", kodeKedaluwarsa(buat("2026-08-31T10:00:00Z"), kini));
benar("tepat detik ini sudah kedaluwarsa", kodeKedaluwarsa(buat("2026-09-01T10:00:00Z"), kini));

benar("kode kedaluwarsa tidak berlaku", !kodeBerlaku(buat("2026-08-31T10:00:00Z"), kini));
benar("kode belum kedaluwarsa berlaku", kodeBerlaku(buat("2026-09-30T10:00:00Z"), kini));
benar("kode nonaktif tetap tidak berlaku", !kodeBerlaku(buat(null, { active: false }), kini));
benar("kuota habis tetap tidak berlaku", !kodeBerlaku(buat(null, { maxUses: 2, uses: 2 }), kini));

// Kode lama yang tersimpan SEBELUM kolom masa berlaku ada tidak boleh ikut
// mati sendiri hanya karena kolomnya kosong.
sama("kode lama tanpa kolom terbaca tanpa batas",
  normalizeCakrawala({ codes: [{ code: "CKRW-LAMA-KODE" }] }).codes[0].expiresAt, null);
benar("kode lama tetap berlaku",
  kodeBerlaku(normalizeCakrawala({ codes: [{ code: "CKRW-LAMA-KODE" }] }).codes[0], kini));
// Tanggal yang rusak dibaca sebagai "tanpa batas", BUKAN sebagai "sudah
// lewat" — kalau sebaliknya, satu kolom yang kacau mengunci pembeli yang sah.
sama("tanggal rusak dibaca tanpa batas", buat("bukan tanggal").expiresAt, null);

sama("sisa masa tanpa batas", sisaMasa(buat(null), kini), "Tanpa batas waktu");
sama("sisa masa sudah lewat", sisaMasa(buat("2026-08-31T10:00:00Z"), kini), "Sudah lewat");
sama("sisa masa satu hari", sisaMasa(buat("2026-09-02T09:00:00Z"), kini), "Sisa 1 hari");
sama("sisa masa 30 hari", sisaMasa(buat("2026-10-01T10:00:00Z"), kini), "Sisa 30 hari");

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
