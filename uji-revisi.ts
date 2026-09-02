// UJI JALUR REVISI DAN ARAH NOTIFIKASI
//
// Dua kesalahan yang diperbaiki di sini keduanya tidak kelihatan dari kode
// yang membacanya sepintas, jadi keduanya dikunci dengan pemeriksaan:
//
//   1. Revisi penyerahan skripsi ke perpustakaan sempat meminta satu berkas
//      .docx, padahal pengajuan awalnya empat bagian PDF. Yang menentukan
//      bentuk formulirnya adalah isPenyerahanPerpus, bukan bentuk nomor
//      tiketnya — dan itulah yang diperiksa di bawah.
//   2. Notifikasi tiket tidak pernah sampai ke lonceng admin unit karena
//      tidak ada satu pun yang dibuat, dan penyaring loncengnya hanya
//      mengenal urusan Prodi.

import {
  ABSENSI_NEED,
  BAGIAN_PENYERAHAN,
  PENYERAHAN_NEED,
  PENYERAHAN_NEED_LAMA,
  isPenyerahanPerpus,
  periksaBerkasBagian,
} from "./src/lib/bukti-penyerahan";
import { audienceForServiceType } from "./src/lib/notify";

let gagal = 0;
const ok = (n: string, s: boolean, i = "") => {
  console.log(`${s ? "  ✓" : "  ✗"} ${n}${i ? ` — ${i}` : ""}`);
  if (!s) gagal++;
};
const berkas = (name: string, mb: number) => ({ name, size: Math.round(mb * 1024 * 1024) });

/** Cerminan pemilihan bentuk formulir revisi di /api/revisions. */
const bentukRevisi = (serviceType: string, serviceNeed: string) =>
  isPenyerahanPerpus(serviceType, serviceNeed) ? "penyerahan" : "docx";

console.log("\n=== BENTUK FORMULIR REVISI ===\n");

ok(
  "penyerahan skripsi direvisi sebagai empat bagian PDF",
  bentukRevisi("Layanan Perpustakaan", PENYERAHAN_NEED) === "penyerahan",
);
ok(
  "nama lama penyerahan tetap dikenali",
  bentukRevisi("Layanan Perpustakaan", PENYERAHAN_NEED_LAMA) === "penyerahan",
  PENYERAHAN_NEED_LAMA,
);

// Nomor tiket perpustakaan dipakai bersama empat kebutuhan. Hanya penyerahan
// yang berkasnya empat bagian; sisanya tidak boleh ikut berganti bentuk.
ok("absensi perpustakaan tidak ikut", bentukRevisi("Layanan Perpustakaan", ABSENSI_NEED) === "docx");
ok("bebas pustaka tidak ikut", bentukRevisi("Layanan Perpustakaan", "Request Bebas Pustaka") === "docx");
ok("cek repository tidak ikut", bentukRevisi("Layanan Perpustakaan", "Permintaan Cek Repository") === "docx");
ok(
  "nama kebutuhan yang sama di unit lain tidak ikut",
  bentukRevisi("Layanan Umum", PENYERAHAN_NEED) === "docx",
  "jenis layanan ikut menentukan",
);
ok("upload revisi skripsi tetap satu berkas Word", bentukRevisi("Layanan Tugas Akhir", "Upload Revisi Skripsi") === "docx");

console.log("\n=== BERKAS REVISI PENYERAHAN ===\n");

// Revisi memakai pemeriksa yang sama dengan pengajuan awal, jadi aturannya
// tidak mungkin berselisih antara "unggah pertama" dan "unggah ulang".
ok("empat bagian yang harus diganti", BAGIAN_PENYERAHAN.length === 4, BAGIAN_PENYERAHAN.map((b) => b.id).join(","));
ok(
  "keempatnya lolos bila PDF wajar",
  BAGIAN_PENYERAHAN.every((b) => periksaBerkasBagian(b.id, berkas(`${b.id}.pdf`, 3)).ok),
);
const satuKosong = BAGIAN_PENYERAHAN.map((b, i) =>
  periksaBerkasBagian(b.id, i === 2 ? null : berkas(`${b.id}.pdf`, 3)),
);
ok("satu bagian yang belum dipilih menggagalkan kiriman", satuKosong.some((h) => !h.ok));
const docxDitolak = periksaBerkasBagian("isi", berkas("revisi-bab.docx", 3));
ok(
  "berkas .docx ditolak pada revisi penyerahan",
  !docxDitolak.ok && docxDitolak.pesan.includes("harus PDF"),
  !docxDitolak.ok ? docxDitolak.pesan : "",
);

console.log("\n=== ARAH NOTIFIKASI TIKET ===\n");

ok("tiket perpustakaan berbunyi di lonceng Admin Perpustakaan",
   audienceForServiceType("Layanan Perpustakaan") === "admin_perpustakaan");
ok("tiket umum ke Admin Umum", audienceForServiceType("Layanan Umum") === "admin_umum");
ok("tiket akademik ke Admin Akademik", audienceForServiceType("Layanan Akademik") === "admin_akademik");
ok("tiket prodi ke Admin Prodi", audienceForServiceType("Layanan Prodi") === "admin_prodi");
ok("tiket PDDIKTI ke Admin PDDIKTI", audienceForServiceType("Layanan PDDIKTI") === "admin_pddikti");
ok("tiket laboratorium ke Admin Laboratorium",
   audienceForServiceType("Layanan Laboratorium") === "admin_laboratorium");
ok("tugas akhir tidak punya admin unit", audienceForServiceType("Layanan Tugas Akhir") === null,
   "notifikasinya dialamatkan ke dosen tujuan lewat lecturerId");
ok("jenis layanan asing tidak dipaksakan ke role mana pun",
   audienceForServiceType("Layanan Entah Apa") === null);

console.log(gagal ? `\n${gagal} UJI GAGAL\n` : "\nSEMUA UJI LULUS\n");
process.exit(gagal ? 1 : 0);
