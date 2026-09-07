// UJI KOSAKATA CBT — PENJAGA YANG MEMBACA KODENYA SENDIRI
//
// CBT ini satu produk yang sama untuk siapa pun yang memasangnya: perguruan
// tinggi, sekolah, maupun lembaga sertifikasi. Karena itu tidak boleh ada
// kosakata yang mengikat ia pada satu jenis pemakai — "Mahasiswa" pada lembar
// ujian SMA dan "NIM" pada uji kompetensi profesi adalah kekeliruan yang
// terlihat semua orang di ruangan, dan yang menemukannya bukan pengembangnya.
//
// Penjaga ini membaca BERKAS SUMBERNYA, bukan keluarannya, dengan sengaja.
// Yang paling mungkin mengembalikan kata-kata itu bukan seseorang yang
// mengetiknya lagi dengan sadar, melainkan blok yang disalin dari bagian lain
// portal — dan salinan seperti itu jarang lewat jalur yang punya uji keluaran.
//
// Yang DIKECUALIKAN hanya dua, dan keduanya bukan kosakata yang terbaca
// pengguna: nama peran di basis data ("dosen"), dan nama medan `nim` yang
// dipakai di kabel serta di kolom basis data. Mengganti keduanya adalah
// migrasi skema beserta perubahan yang memutus API, tanpa satu pun keuntungan
// yang terlihat pengguna.

import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}

/** Berkas yang membentuk CBT. Pola, bukan daftar — berkas baru ikut terjaga. */
const POLA = [
  "src/app/cbt/**/*.ts",
  "src/app/cbt/**/*.tsx",
  "src/app/api/cbt/**/*.ts",
  "src/app/dashboard/cbt-panel.tsx",
  "src/lib/cbt.ts",
  "src/lib/cbt-store.ts",
  "src/lib/cetak-cbt.ts",
  "src/lib/impor-soal.ts",
  "src/lib/template-soal.ts",
  "src/lib/ai-soal.ts",
  "src/lib/pengawasan.ts",
  "src/lib/awas-kamera.ts",
  "src/lib/situs-cbt.ts",
];

const berkas = [...new Set(POLA.flatMap((p) => globSync(p)))].sort();
benar("berkas CBT ketemu", berkas.length >= 20, `${berkas.length} berkas`);

/**
 * Baris yang boleh memuat kata terlarang.
 *
 * Sesempit mungkin dan diperiksa apa adanya: pengecualian yang longgar akan
 * menelan justru baris yang hendak dijaga.
 */
const KECUALI = [
  '"dosen"',        // nama peran di basis data
  "nim",            // nama medan di kabel dan nama kolom
  "Nim",            // setNim, useState — pengenal yang sama
  "NOMOR PESERTA",  // hasil penggantian sebelumnya, huruf besar
];

const TERLARANG: Array<{ kata: RegExp; sebut: string; kenapa: string }> = [
  { kata: /\bmahasiswa\b/i, sebut: "mahasiswa", kenapa: "sekolah dan lembaga sertifikasi memakai CBT ini juga" },
  { kata: /\bdosen\b/i, sebut: "dosen", kenapa: "pengajar tidak selalu dosen" },
  { kata: /\bNIM\b/, sebut: "NIM", kenapa: "nomor induk mahasiswa hanya ada di perguruan tinggi" },
  { kata: /\bmata kuliah\b/i, sebut: "mata kuliah", kenapa: "yang diuji tidak selalu mata kuliah" },
  { kata: /\bsiswa\b/i, sebut: "siswa", kenapa: "menandai jenjang sekolah, sama terikatnya" },
  { kata: /\bguru\b/i, sebut: "guru", kenapa: "sama terikatnya, arah sebaliknya" },
  { kata: /\bFISIP\b/i, sebut: "FISIP", kenapa: "nama satu fakultas" },
  { kata: /\bfakultas ilmu sosial\b/i, sebut: "Fakultas Ilmu Sosial", kenapa: "nama satu fakultas" },
];

let temuan = 0;
for (const nama of berkas) {
  const baris = readFileSync(nama, "utf8").split("\n");
  baris.forEach((isi, i) => {
    if (KECUALI.some((k) => isi.includes(k))) return;
    for (const { kata, sebut, kenapa } of TERLARANG) {
      if (kata.test(isi)) {
        temuan += 1;
        gagal.push(`${nama}:${i + 1} memakai "${sebut}" (${kenapa}) — ${isi.trim().slice(0, 90)}`);
      }
    }
  });
}
benar("tidak ada kosakata yang mengikat CBT pada satu jenis pemakai", temuan === 0);

// Dan penjaganya sendiri harus benar-benar bekerja: kalau polanya salah tulis
// atau daftar kecualinya terlalu longgar, ia akan lulus tanpa memeriksa apa
// pun — dan itu lebih buruk daripada tidak ada penjaga sama sekali.
const contohBuruk = "  // Kode diberikan dosen Anda, isi NIM lalu mulai.";
benar("penjaganya menangkap baris yang memang salah",
  TERLARANG.some((t) => t.kata.test(contohBuruk)));
benar("dan tidak menangkap nama medan `nim`",
  KECUALI.some((k) => "  nim: cbtAttempts.nim,".includes(k)));

console.log(`\n${lulus} periksa lulus atas ${berkas.length} berkas CBT`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
