// UJI TANDA PISAH PANJANG DI TEKS YANG TAMPIL
//
// Pemilik sistem meminta tanda pisah panjang ("—") tidak lagi dipakai pada
// teks yang dibaca pengguna. Alasannya sederhana dan cukup: ia tidak ada pada
// papan ketik siapa pun di sini, tidak seragam antarperamban, dan pada layar
// sempit ia sering memutus kalimat di tempat yang salah.
//
// Yang dijaga HANYA teks yang tampil. Komentar dalam kode tidak pernah dibaca
// pengguna, dan memaksa penulisnya membuang tanda pisah dari penjelasan
// panjang di dalam kode hanya membuat penjelasannya lebih sulit dibaca tanpa
// menguntungkan siapa pun.
//
// Karena itu berkasnya dibersihkan dari komentar lebih dulu, lalu sisanya yang
// diperiksa. Cara ini tidak sempurna: tanda pisah di dalam tali teks yang
// kebetulan berisi "//" akan lolos. Yang penting ia menangkap bentuk yang
// benar-benar terjadi, yaitu kalimat JSX dan tali teks biasa.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}

const PISAH = "—";

/**
 * Yang boleh tetap memakainya, beserta alasannya.
 *
 * Hanya satu, dan ia bukan teks web: "Abstract—" dan "Keywords—" adalah
 * bentuk baku IEEE untuk naskah berbahasa Inggris, dan yang menghasilkannya
 * menulis DOKUMEN, bukan halaman. Menggantinya di sana berarti naskah yang
 * tidak sesuai templat jurnalnya.
 */
const KECUALI = [/`(Abstract|Keywords)—/, /\^keywords\[/];

function berkasSumber(dir: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(dir)) {
    const jalan = join(dir, nama);
    if (statSync(jalan).isDirectory()) { hasil.push(...berkasSumber(jalan)); continue; }
    if (/\.(ts|tsx|css)$/.test(nama)) hasil.push(jalan);
  }
  return hasil;
}

/** Buang komentar supaya yang tersisa mendekati apa yang benar-benar tampil. */
function tanpaKomentar(isi: string, css: boolean): string {
  // Baris komentar diganti baris kosong, bukan dihapus, supaya nomor barisnya
  // tetap menunjuk tempat yang benar saat dilaporkan.
  let s = isi.replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) ?? []).length));
  if (!css) {
    s = s.replace(/^\s*\/\/.*$/gm, "");
    s = s.replace(/(\S)\s+\/\/[^\n"'`]*$/gm, "$1");
  }
  return s;
}

const berkas = berkasSumber("src");
benar("berkas sumber ketemu", berkas.length > 50, `${berkas.length} berkas`);

const temuan: string[] = [];
for (const jalan of berkas) {
  const isi = readFileSync(jalan, "utf8");
  if (!isi.includes(PISAH)) continue;
  const baris = tanpaKomentar(isi, jalan.endsWith(".css")).split("\n");
  baris.forEach((teks, i) => {
    if (!teks.includes(PISAH)) return;
    if (KECUALI.some((k) => k.test(teks))) return;
    temuan.push(`${jalan}:${i + 1}: ${teks.trim().slice(0, 110)}`);
  });
}
benar("tidak ada tanda pisah panjang di teks yang tampil", temuan.length === 0,
  temuan.slice(0, 8).join(" | "));

// Penjaganya sendiri harus benar-benar hidup: kalimat yang memakai tanda pisah
// wajib tertangkap, dan yang dikecualikan wajib lolos.
const contohBuruk = tanpaKomentar('const a = "Ujian selesai — nilai keluar";', false);
benar("penjaga menangkap kalimat bertanda pisah", contohBuruk.includes(PISAH));
benar("komentar dibuang lebih dulu",
  !tanpaKomentar("// catatan — penjelasan\nconst a = 1;", false).includes(PISAH));
benar("komentar blok juga dibuang",
  !tanpaKomentar("/* catatan — penjelasan */\nconst a = 1;", false).includes(PISAH));
benar("bentuk baku IEEE dikecualikan",
  KECUALI.some((k) => k.test("hasil: `Abstract—${teks}`")));

console.log(`\n${lulus} periksa lulus atas ${berkas.length} berkas sumber`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
