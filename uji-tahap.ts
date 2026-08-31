// UJI TANGGA PENYUSUNAN — dari fenomena sampai judul
//
// Tangga ini yang dilihat mahasiswa sambil mengetik, jadi yang diperiksa di
// sini bukan "ada isinya", melainkan: apakah tahap yang menyala benar-benar
// mencerminkan yang ia tulis, dan apakah tahap yang belum ia sebut tetap
// gelap alih-alih diisi tebakan yang terlihat meyakinkan.

import { tafsirkan, tahapCerita, hitungTahapSiap, MINIMAL_KATA, hitungKataCerita } from "./src/lib/tafsir-cerita";
import { rancang } from "./src/lib/metodologi";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean) {
  if (syarat) lulus += 1;
  else gagal.push(nama);
}
function sama(nama: string, dapat: unknown, harap: unknown) {
  benar(`${nama} (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`, dapat === harap);
}
const ambil = (t: ReturnType<typeof tahapCerita>, id: string) => t.find((x) => x.id === id)!;

// --- Cerita sangat pendek, seperti yang benar-benar diketik mahasiswa -----
const pendek = "saya mau neliti fenomena tiktok";
sama("cerita pendek lima kata", hitungKataCerita(pendek), 5);
benar("cerita sependek itu sudah boleh dibaca", hitungKataCerita(pendek) >= MINIMAL_KATA);

const bPendek = tafsirkan(pendek, "komunikasi");
const tPendek = tahapCerita(bPendek);
sama("dua belas tahap selalu utuh", tPendek.length, 12);
benar("fenomena menyala dari kata tiktok", ambil(tPendek, "fenomena").siap);
benar(
  "fenomena berisi tiktok",
  ambil(tPendek, "fenomena").isi.toLowerCase().includes("tiktok"),
);
// Lokasi tidak disebut sama sekali. Menyalakannya berarti berbohong pada
// mahasiswa tentang kelengkapan rancangannya.
benar("lokasi tetap gelap", !ambil(tPendek, "lokasi").siap);
benar("judul masih gelap sebelum rancangan", !ambil(tPendek, "judul").siap);
benar("metode masih gelap sebelum rancangan", !ambil(tPendek, "metode").siap);

// --- Cerita lengkap -------------------------------------------------------
const penuh =
  "Saya ingin meneliti pengaruh kecanduan game online terhadap prestasi belajar " +
  "mahasiswa Ilmu Komunikasi di Universitas Muhammadiyah Tangerang. Saya mau menyebar " +
  "kuesioner ke 200 mahasiswa untuk melihat seberapa besar pengaruhnya.";
const bPenuh = tafsirkan(penuh, "komunikasi");
const tPenuh = tahapCerita(bPenuh);
benar("fenomena terbaca", ambil(tPenuh, "fenomena").siap);
benar("tujuan terbaca", ambil(tPenuh, "tujuan").siap);
benar("masalah menyala karena fenomena dan tujuan ada", ambil(tPenuh, "masalah").siap);
benar("lokasi terbaca dari nama kampus", ambil(tPenuh, "lokasi").siap);
benar("data terbaca dari kata kuesioner", ambil(tPenuh, "data").siap);
benar("cerita penuh lebih terisi daripada cerita pendek",
  hitungTahapSiap(tPenuh) > hitungTahapSiap(tPendek));

// Masalah tidak boleh menyala tanpa fenomena maupun tujuan yang terbaca.
const bKosong = tafsirkan("aku bingung", "lain");
const tKosong = tahapCerita(bKosong);
benar("masalah gelap pada cerita kosong", !ambil(tKosong, "masalah").siap);

// --- Lima tahap susulan terisi setelah rancangannya ada -------------------
const rancangan = rancang(bPenuh.masukan);
const tSetelah = tahapCerita(bPenuh, rancangan);
for (const id of ["pendekatan", "metode", "sampling", "judul"]) {
  benar(`${id} menyala setelah rancangan`, ambil(tSetelah, id).siap);
}
benar("judul berisi kalimat, bukan penanda", ambil(tSetelah, "judul").isi.length > 10);
benar("rancangan menambah tahap yang menyala",
  hitungTahapSiap(tSetelah) > hitungTahapSiap(tPenuh));
sama("tahap susulan ditandai", ambil(tSetelah, "judul").susulan, true);
sama("tahap dari cerita tidak ditandai susulan", ambil(tSetelah, "fenomena").susulan, false);

// --- Urutannya tetap seperti yang diajarkan -------------------------------
sama(
  "urutan tahap",
  tPendek.map((t) => t.id).join(" "),
  "fenomena masalah tujuan objek subjek lokasi pendekatan metode teori data sampling judul",
);

// --- Fungsi murni: dipanggil ulang memberi hasil yang sama ---------------
// Tangga ini dihitung tiap ketukan papan tik. Kalau hasilnya bisa bergeser
// sendiri, deretannya akan berkedip-kedip tanpa sebab.
sama(
  "hasilnya tetap sama bila dipanggil ulang",
  JSON.stringify(tahapCerita(tafsirkan(penuh, "komunikasi"))),
  JSON.stringify(tPenuh),
);

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
