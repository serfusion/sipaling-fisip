// UJI PEMBACA TRANSKRIP & KAMUS MATA KULIAH
//
// Bahannya berkas SIMAK sungguhan — struktur aslinya, dengan nama dan NIM
// mahasiswanya diganti. Struktur itulah yang penting: dua blok kolom
// bernomor, judul skripsi yang melompat dua baris, dan blok "Keterangan" di
// bawah tabel yang sel-selnya berada tepat di kolom nama mata kuliah.
//
// Blok terakhir itu pernah merusak satu baris tanpa ada yang menyadarinya:
// sel legenda "K" terbaca sebagai nama Inggris milik "Etika Pemerintahan",
// dan transkrip resmi tercetak begitu. Uji ini menahannya kembali.

import { readFileSync } from "node:fs";
import { extractBio, parseSheetRows, computeTotals, type Aoa } from "./src/app/dashboard/template/transkrip-parse";
import {
  isiInggris, terjemahkanMatkul, rapikanNama, rapikanKode, panenKamus, KAMUS_KODE,
} from "./src/lib/kamus-matkul";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

const aoa = JSON.parse(readFileSync("./uji-berkas-contoh/transkrip-simak.json", "utf8")) as Aoa;

console.log("\n=== BIODATA DARI BERKAS MENTAH ===\n");

const bio = extractBio(aoa);
sama("nama mahasiswa terbaca", bio.nama, "Mahasiswa Contoh");
sama("NIM terbaca", bio.nim, "1900000000");
sama("program studi terbaca", bio.prodi, "Ilmu Pemerintahan");
sama("tempat tanggal lahir terbaca", bio.ttl, "Tangerang, 1 Januari 2000");
sama("tanggal yudisium terbaca", bio.yudisium, "6 Juli 2026");
benar("akreditasi terbaca", (bio.akred || "").includes("LAMSPAK"), bio.akred);

// Judul skripsi ditulis melompat dua baris di kolom kanan; kalau hanya baris
// pertama yang terbaca, transkrip resmi tercetak dengan judul terpotong.
benar("judul skripsi terbaca utuh dua baris",
  (bio.judul || "").includes("Meminimalisir Angka Putus") && (bio.judul || "").includes("SMKN Kota Tangerang"),
  bio.judul);
benar("judul tidak kemasukan label lain",
  !/keterangan|predikat|indeks|dekan/i.test(bio.judul || ""), bio.judul);

console.log("\n=== MATA KULIAH & ANGKA ===\n");

const rows = parseSheetRows(aoa);
sama("53 mata kuliah terbaca", rows.length, 53);
// Dua blok kolom digabung menurut nomornya, bukan menurut letaknya.
sama("mata kuliah pertama dari blok kiri", rows[0].nama, "Ilmu Budaya Dasar");
sama("mata kuliah terakhir dari blok kanan", rows[52].nama, "Skripsi");
benar("semua punya SKS", rows.every((r) => r.k > 0));
benar("semua punya kode", rows.every((r) => r.kode.length > 0));

const total = computeTotals(rows);
// Angka-angka ini tertulis di berkasnya sendiri: 153 SKS, mutu 525, IPK 3.43.
sama("total SKS sama dengan yang tertulis", total.sks, 153);
sama("total mutu sama dengan yang tertulis", total.mutu, 525);
sama("IPK dibulatkan dua angka", total.ipk.toFixed(2), "3.43");

// Baris subtotal dan JUMLAH tidak boleh ikut terbaca sebagai mata kuliah.
benar("tidak ada mata kuliah ber-SKS ganjil besar", rows.every((r) => r.k <= 12));
benar("tidak ada baris bernama JUMLAH/Total", !rows.some((r) => /jumlah|^total/i.test(r.nama)));

console.log("\n=== BLOK KETERANGAN TIDAK MENYUSUP ===\n");

// Sel legenda "K", "HM", "AM", "MK" berada di kolom nama mata kuliah, tepat
// di bawah tabel. Sebelum diperbaiki, "K" menjadi nama Inggris milik mata
// kuliah terakhir kolom kiri.
const etika = rows.find((r) => r.nama === "Etika Pemerintahan");
benar("Etika Pemerintahan ada", Boolean(etika));
sama("dan kolom Inggrisnya TIDAK terisi legenda", etika?.en, "");
benar("tidak ada satu pun nama Inggris satu-dua huruf",
  rows.every((r) => !r.en || r.en.length >= 4),
  rows.filter((r) => r.en && r.en.length < 4).map((r) => `${r.nama}="${r.en}"`).join(", "));

console.log("\n=== KAMUS: BERKAS INDONESIA JADI DWIBAHASA ===\n");

const hasil = isiInggris(rows);
sama("seluruh 53 baris terisi bahasa Inggris", hasil.rows.filter((r) => r.en).length, 53);
sama("semuanya dari kamus, bukan tebakan kata", hasil.dariKasar, 0);
sama("tidak ada yang perlu dicek manual", hasil.perluDicek.length, 0);

const cari = (nama: string) => hasil.rows.find((r) => r.nama === nama)?.en;
sama("Ilmu Budaya Dasar", cari("Ilmu Budaya Dasar"), "Basic Cultural Sciences");
sama("Etika Pemerintahan", cari("Etika Pemerintahan"), "Government Ethics");
sama("Skripsi", cari("Skripsi"), "Undergraduate Thesis");
sama("PKL", cari("PKL"), "Field Work Practice (Internship)");
sama("KKN", cari("KKN"), "Community Service Program");
sama("AIKA V", cari("AIKA V"), "Al-Islam and Kemuhammadiyahan V");
sama("kurung E-Government tetap rapi",
  cari("Pemerintahan Elektronik ( E-Government )"), "Electronic Government (E-Government)");

console.log("\n=== ATURAN KAMUS ===\n");

// Kode didahulukan atas nama: kode unik per kurikulum, sedangkan nama dapat
// ditulis berbeda oleh operator yang berbeda.
sama("kode menang atas nama", terjemahkanMatkul("MKK-011", "Nama Yang Salah Ketik").sumber, "kode");
sama("nama dipakai bila kodenya asing", terjemahkanMatkul("XXX-999", "Kewirausahaan").sumber, "nama");
sama("ejaan berbeda tetap ketemu", terjemahkanMatkul("", "MANAJEMEN KONFLIK").en, "Conflict Management");
sama("spasi berlebih tidak masalah", terjemahkanMatkul("", "  Kepemimpinan  ").en, "Leadership");
sama("kode berspasi tetap ketemu", terjemahkanMatkul(" mkk-011 ", "").en, "Basic Cultural Sciences");

// Yang tidak dikenal tetap mendapat sesuatu yang terbaca, DAN ditandai.
const asing = terjemahkanMatkul("ZZZ-001", "Sistem Pemerintahan Antariksa");
sama("mata kuliah asing ditandai sebagai tebakan", asing.sumber, "kasar");
benar("tebakannya tetap terbaca", asing.en.includes("Government System"), asing.en);
sama("nama kosong tidak menghasilkan apa-apa", terjemahkanMatkul("", "").sumber, "kosong");

// Terjemahan resmi dari KUI SELALU menang atas kamus.
const sudahInggris = isiInggris([{ kode: "MKK-011", nama: "Ilmu Budaya Dasar", en: "Terjemahan Resmi KUI" }]);
sama("yang sudah berisi tidak ditimpa", sudahInggris.rows[0].en, "Terjemahan Resmi KUI");
sama("dan dihitung sebagai sudah ada", sudahInggris.sudahAda, 1);

console.log("\n=== BENTUK KAMUS ===\n");

benar("tidak ada kode kembar",
  new Set(Object.keys(KAMUS_KODE).map(rapikanKode)).size === Object.keys(KAMUS_KODE).length);
benar("semua kode sudah rapi", Object.keys(KAMUS_KODE).every((k) => k === rapikanKode(k)));
benar("tidak ada terjemahan kosong", Object.values(KAMUS_KODE).every((v) => v.trim().length > 2));
// Kamus tidak boleh memuat kata Indonesia yang jelas — itu tanda ada baris
// yang lupa diterjemahkan.
benar("tidak ada sisa kata Indonesia di kamus kode",
  !Object.values(KAMUS_KODE).some((v) => /\b(dan|ilmu|sistem|pemerintahan|manajemen)\b/i.test(v)),
  Object.values(KAMUS_KODE).filter((v) => /\b(dan|ilmu|sistem|pemerintahan|manajemen)\b/i.test(v)).join(", "));
sama("penyeragam nama membuang tanda baca", rapikanNama("Analisa & Kebijakan  Publik!"), "analisa kebijakan publik");

console.log("\n=== KAMUS YANG TUMBUH DARI KOREKSI ADMIN ===\n");

// Koreksi tangan admin harus menang atas daftar bawaan — daftar bawaan
// ditulis sekali, koreksinya dibuat orang yang sedang melihat berkasnya.
sama("kamus tambahan mengalahkan bawaan",
  terjemahkanMatkul("MKK-011", "Ilmu Budaya Dasar", { "MKK-011": "Introduction to Culture" }).en,
  "Introduction to Culture");
sama("dan tetap ditandai berasal dari kode",
  terjemahkanMatkul("MKK-011", "", { "MKK-011": "Introduction to Culture" }).sumber, "kode");
sama("kode yang tidak ada di tambahan jatuh ke bawaan",
  terjemahkanMatkul("MKK-012", "", { "MKK-011": "X" }).en, "Introduction to Sociology");

// Yang dipanen hanya yang BERBEDA dari bawaan; menyimpan ulang yang sama
// hanya menggelembungkan penyimpanan tanpa mengubah hasil apa pun.
const panen = panenKamus([
  { kode: "MKK-011", nama: "Ilmu Budaya Dasar", en: "Basic Cultural Sciences" },
  { kode: "ZZZ-001", nama: "Mata Kuliah Baru", en: "Brand New Course" },
  { kode: "ZZZ-002", nama: "Tanpa Inggris", en: "" },
  { kode: "", nama: "Tanpa Kode", en: "No Code" },
]);
sama("hanya satu pasangan yang layak diingat", panen.length, 1);
sama("dan itu yang benar-benar baru", panen[0].kode, "ZZZ-001");
sama("kode kembar tidak dipanen dua kali",
  panenKamus([
    { kode: "ZZZ-003", nama: "A", en: "Alpha" },
    { kode: "zzz-003", nama: "A", en: "Alpha" },
  ]).length, 1);

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
