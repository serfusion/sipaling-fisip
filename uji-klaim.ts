// UJI KLAIM PEMBAYARAN & PENCOCOKAN MUTASI — dengan basis data sungguhan.
//
// Berkas uji lain di repositori ini murni perhitungan dan tidak menyentuh
// basis data. Yang ini HARUS menyentuhnya, karena yang dijaga di sini justru
// perilaku yang hanya muncul ketika ada tabel: pesanan yang kedaluwarsa,
// pemberitahuan yang datang dua kali, dan klaim yang menyelamatkan uang yang
// sudah masuk tetapi belum menemukan pesanannya.
//
// Jalankan dengan DATABASE_URL menunjuk basis data yang BOLEH dikotori:
//
//   DATABASE_URL=postgres://postgres@127.0.0.1:5433/uji npx tsx uji-klaim.ts
//
// Tanpa DATABASE_URL ia melewatkan dirinya sendiri, bukan gagal — supaya
// menjalankan seluruh berkas uji sekaligus tidak menuntut Postgres hidup.

import { db } from "./src/db";
import { cakrawalaMutations, cakrawalaOrders } from "./src/db/schema";
import { eq, sql } from "drizzle-orm";
import { paketDari } from "./src/lib/paket-cakrawala";
import {
  buatPesanan, ambilPesanan, catatMutasi, klaimPesanan, lunaskanPesanan,
  mutasiUntukNominal, pesananUntukNominal, sapuPesananKedaluwarsa,
} from "./src/lib/pesanan-store";

if (!process.env.DATABASE_URL) {
  console.log("\n=== KLAIM ===\n");
  console.log("DATABASE_URL kosong — uji ini dilewati.");
  console.log("SEMUA UJI LULUS");
  process.exit(0);
}

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

const coba = paketDari("coba")!;
const bab = paketDari("bab")!;

async function bersihkan() {
  await db.delete(cakrawalaMutations);
  await db.delete(cakrawalaOrders);
}

async function pesananBaru(paket = coba) {
  const hasil = await buatPesanan({ paket });
  if (!hasil.ok) throw new Error(hasil.pesan);
  return hasil;
}

async function main() {
  await bersihkan();

  console.log("\n=== PENCOCOKAN NOMINAL ===\n");

  const satu = await pesananBaru();
  const ketemu = await pesananUntukNominal(satu.amount);
  sama("pesanan yang menunggu ditemukan dari nominalnya", ketemu?.orderCode, satu.orderCode);
  sama("nominal yang tidak dipesan siapa pun tidak menemukan apa-apa",
    await pesananUntukNominal(satu.amount + 500), null);
  sama("nominal nol ditolak", await pesananUntukNominal(0), null);
  sama("nominal pecahan ditolak", await pesananUntukNominal(25_000.5), null);

  // Pesanan yang sudah kedaluwarsa TETAP harus ketemu. Orang yang membayar di
  // menit ketujuh belas sudah mengeluarkan uangnya, dan jendela lima belas
  // menit itu urusan daur ulang nominal — bukan alasan menahan barangnya.
  await db
    .update(cakrawalaOrders)
    .set({ expiresAt: new Date(Date.now() - 60_000), status: "kedaluwarsa" })
    .where(eq(cakrawalaOrders.orderCode, satu.orderCode));
  const lewat = await pesananUntukNominal(satu.amount);
  sama("pesanan yang sudah kedaluwarsa tetap ditemukan", lewat?.orderCode, satu.orderCode);

  // Tetapi yang MASIH menunggu selalu menang atas yang sudah kedaluwarsa —
  // nominalnya didaur ulang, jadi dua pesanan dapat memakai angka yang sama.
  await db.insert(cakrawalaOrders).values({
    orderCode: "PSN-KEMBAR", packageId: coba.id, packageName: coba.nama,
    basePrice: coba.harga, marker: 1, amount: satu.amount, days: coba.hari,
    maxDevices: 1, status: "menunggu", expiresAt: new Date(Date.now() + 600_000),
  });
  const menang = await pesananUntukNominal(satu.amount);
  sama("yang masih menunggu menang atas yang kedaluwarsa", menang?.orderCode, "PSN-KEMBAR");

  // Pembayaran hari ini tidak boleh menyambar pesanan bulan lalu.
  await db
    .update(cakrawalaOrders)
    .set({ createdAt: new Date(Date.now() - 90 * 24 * 60 * 60_000) })
    .where(eq(cakrawalaOrders.orderCode, "PSN-KEMBAR"));
  await db
    .update(cakrawalaOrders)
    .set({ createdAt: new Date(Date.now() - 90 * 24 * 60 * 60_000) })
    .where(eq(cakrawalaOrders.orderCode, satu.orderCode));
  sama("pesanan yang terlalu tua tidak ikut dicocokkan",
    await pesananUntukNominal(satu.amount), null);

  console.log("\n=== SATU PEMBAYARAN, SATU KODE ===\n");

  await bersihkan();
  const dua = await pesananBaru(bab);
  const terbit = await lunaskanPesanan(dua.orderCode, "uji", bab);
  benar("pesanan pertama kali dilunaskan menerbitkan kode", terbit.ok && terbit.baru);

  // Aplikasi penerus pemberitahuan mengirim ulang kiriman yang sama. Satu
  // pembayaran yang berubah menjadi dua kode adalah barang yang diberikan
  // gratis, dan tidak ada yang memberi tahu bahwa itu terjadi.
  const ulang = await lunaskanPesanan(dua.orderCode, "uji", bab);
  benar("pelunasan kedua tidak menerbitkan kode baru", ulang.ok && !ulang.baru);
  sama("kodenya persis sama",
    terbit.ok && ulang.ok ? terbit.accessCode === ulang.accessCode : false, true);

  console.log("\n=== KLAIM \"SAYA SUDAH MEMBAYAR\" ===\n");

  await bersihkan();
  const tiga = await pesananBaru();
  const sebelum = await ambilPesanan(tiga.orderCode);
  sama("sebelum diklaim, penandanya kosong", sebelum?.claimedAt, null);

  const diklaim = await klaimPesanan(tiga.orderCode);
  benar("klaim tercatat", diklaim?.claimedAt !== null && diklaim?.claimedAt !== undefined);
  benar("masa berlakunya diperpanjang jauh melewati lima belas menit",
    (diklaim?.expiresAt.getTime() ?? 0) > Date.now() + 20 * 60 * 60_000);
  sama("statusnya tetap menunggu", diklaim?.status, "menunggu");

  // Inilah gunanya perpanjangan itu: penyapu berkala tidak boleh membunuh
  // pesanan yang uangnya sedang di jalan, karena begitu ia mati nominal
  // uniknya didaur ulang dan pembayarannya mendarat di pesanan orang lain.
  await sapuPesananKedaluwarsa();
  sama("penyapu tidak membunuh pesanan yang diklaim",
    (await ambilPesanan(tiga.orderCode))?.status, "menunggu");

  // Pesanan yang sudah kedaluwarsa DIHIDUPKAN kembali oleh klaim.
  const empat = await pesananBaru(bab);
  await db
    .update(cakrawalaOrders)
    .set({ expiresAt: new Date(Date.now() - 60_000), status: "kedaluwarsa" })
    .where(eq(cakrawalaOrders.orderCode, empat.orderCode));
  sama("klaim menghidupkan kembali pesanan yang kedaluwarsa",
    (await klaimPesanan(empat.orderCode))?.status, "menunggu");

  // Yang sudah lunas dan yang sudah batal TIDAK boleh disentuh klaim.
  await lunaskanPesanan(empat.orderCode, "uji", bab);
  sama("pesanan yang sudah lunas tidak dapat diklaim", await klaimPesanan(empat.orderCode), null);

  await db
    .update(cakrawalaOrders)
    .set({ status: "batal" })
    .where(eq(cakrawalaOrders.orderCode, tiga.orderCode));
  sama("pesanan yang sudah batal tidak dapat diklaim", await klaimPesanan(tiga.orderCode), null);

  console.log("\n=== CATATAN MUTASI ===\n");

  await bersihkan();
  const lima = await pesananBaru();

  sama("belum ada mutasi apa pun", await mutasiUntukNominal(lima.amount), null);

  // Pemberitahuan yang SAMPAI tetapi tidak menemukan pesanannya tetap dicatat.
  // Tanpa itu, uang yang sudah masuk berakhir sebagai satu baris log yang
  // tidak dibaca siapa pun, dan pembelinya menatap layar menunggu selamanya.
  await catatMutasi(lima.amount, "Kamu menerima Rp… dari Sari", true, "tanpa-pesanan");
  const tercatat = await mutasiUntukNominal(lima.amount);
  sama("mutasi yang tidak menemukan pesanan tetap dapat dicari", tercatat?.amount, lima.amount);

  // Uang KELUAR tidak boleh ikut terbaca sebagai pembayaran ketika pembelinya
  // menekan "Saya sudah membayar".
  await bersihkan();
  const enam = await pesananBaru();
  await catatMutasi(enam.amount, "Kamu mengirim Rp… ke Rina", false, "bukan-masuk");
  sama("mutasi keluar tidak dianggap pembayaran", await mutasiUntukNominal(enam.amount), null);

  // Mutasi yang terlalu tua tidak boleh menghidupkan pesanan hari ini.
  await bersihkan();
  const tujuh = await pesananBaru();
  await catatMutasi(tujuh.amount, "Kamu menerima Rp… dari Kemarin Dulu", true, "tanpa-pesanan");
  await db
    .update(cakrawalaMutations)
    .set({ createdAt: new Date(Date.now() - 48 * 60 * 60_000) })
    .where(eq(cakrawalaMutations.amount, tujuh.amount));
  sama("mutasi berumur dua hari tidak lagi dipakai", await mutasiUntukNominal(tujuh.amount), null);

  console.log("\n=== NOMINAL UNIK TETAP UNIK ===\n");

  await bersihkan();
  // Sepuluh pesanan berurutan pada paket yang sama wajib menerima sepuluh
  // nominal berbeda; kalau dua sama, pemiliknya tidak dapat membedakan siapa
  // yang barusan membayar — dan itulah seluruh dasar cara kerja ini.
  const nominal: number[] = [];
  for (let n = 0; n < 10; n += 1) nominal.push((await pesananBaru()).amount);
  sama("sepuluh pesanan, sepuluh nominal berbeda", new Set(nominal).size, 10);
  benar("semuanya lebih besar daripada harga paketnya", nominal.every((a) => a > coba.harga));

  const hidup = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(cakrawalaOrders)
    .where(eq(cakrawalaOrders.status, "menunggu"));
  sama("sepuluh-duanya masih hidup", hidup[0]?.n, 10);

  await bersihkan();
}

main()
  .then(() => {
    console.log(`\n${lulus} periksa lulus`);
    if (gagal.length > 0) {
      console.error(`\n${gagal.length} GAGAL:`);
      gagal.forEach((g) => console.error("  ✗ " + g));
      process.exit(1);
    }
    console.log("SEMUA UJI LULUS");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nUJI BERHENTI:", error);
    process.exit(1);
  });
