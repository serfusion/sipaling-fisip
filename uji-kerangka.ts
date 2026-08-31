import { susunKerangka } from "./src/lib/kerangka";
import { usulkanVisual, tanpaGrafikStatistik, GRAFIK_NAMA } from "./src/lib/visual";
import { ACUAN } from "./src/lib/acuan";
import type { Masukan } from "./src/lib/metodologi";

let gagal = 0;
const ok = (n: string, s: boolean, i = "") => { console.log(`${s ? "  ✓" : "  ✗"} ${n}${i ? ` — ${i}` : ""}`); if (!s) gagal++; };

const dasar: Masukan = {
  variabelX: "lingkungan kerja", variabelY: "kepuasan karyawan", objek: "karyawan", lokasi: "",
  tujuan: "pengaruh", unit: "individu", data: ["kuesioner"],
  jumlahPopulasi: 0, perkiraanSampel: 100, prodi: "lain",
};

console.log("\n=== KERANGKA BERPIKIR ===\n");
const sederhana = susunKerangka(dasar);
ok("satu X tanpa Z -> dua kotak, satu hipotesis",
   sederhana.kotak.length === 2 && sederhana.jalur.length === 1, `${sederhana.kotak.length} kotak, ${sederhana.jalur.length} jalur`);
ok("tanpa variabel antara ditandai", !sederhana.adaAntara);

const duaX = susunKerangka({ ...dasar, variabelX2: "kompensasi" });
ok("dua X -> tiga hipotesis termasuk serentak", duaX.jalur.length === 3, duaX.jalur.map(j => j.kode).join(","));
ok("hipotesis serentak ada", duaX.jalur.some(j => j.jenis === "serentak"));

// Persis seperti bagan yang dikirim pengguna.
const penuh = susunKerangka({ ...dasar, variabelX2: "kompensasi", variabelZ: "komitmen organisasional" });
ok("dua X dengan mediasi -> empat kotak", penuh.kotak.length === 4, penuh.kotak.map(k => k.id).join(","));
ok("delapan hipotesis", penuh.jalur.length === 8, penuh.jalur.map(j => j.kode).join(","));
ok("nomor hipotesis berurutan tanpa lompat",
   penuh.jalur.every((j, i) => j.kode === `H${i + 1}`));
ok("ada jalur tidak langsung lewat Z",
   penuh.jalur.filter(j => j.jenis === "tak-langsung").length === 2);
ok("tiap X punya jalur ke Z",
   penuh.jalur.some(j => j.dari === "X1" && j.ke === "Z") && penuh.jalur.some(j => j.dari === "X2" && j.ke === "Z"));
ok("Z punya jalur ke Y", penuh.jalur.some(j => j.dari === "Z" && j.ke === "Y"));
ok("rumusan masalah sebanyak hipotesis", penuh.rumusan.length === penuh.jalur.length);
ok("tiap rumusan berbentuk pertanyaan", penuh.rumusan.every(r => r.endsWith("?")));
ok("bunyi hipotesis memakai nama variabel mahasiswa",
   penuh.jalur[0].bunyi.includes("lingkungan kerja") && penuh.jalur[0].bunyi.includes("kepuasan karyawan"),
   penuh.jalur[0].bunyi);
ok("variabel kosong tetap menghasilkan bagan",
   susunKerangka({ ...dasar, variabelX: "", variabelY: "" }).kotak.length === 2);

console.log("\n=== USULAN VISUALISASI ===\n");
ok("eksplanatif -> diagram sebar utama",
   usulkanVisual("kuantitatif-eksplanatif").some(v => v.grafik === "sebar" && v.utama));
ok("komparatif -> batang berkelompok",
   usulkanVisual("kuantitatif-komparatif").some(v => v.grafik === "batang-kelompok"));
ok("analisis isi -> batang frekuensi",
   usulkanVisual("analisis-isi").some(v => v.grafik === "batang"));
ok("fenomenologi tidak menyarankan grafik statistik", tanpaGrafikStatistik("fenomenologi"));
ok("semiotika tidak menyarankan grafik statistik", tanpaGrafikStatistik("semiotika"));
ok("eksplanatif justru memakai grafik statistik", !tanpaGrafikStatistik("kuantitatif-eksplanatif"));
const semuaJenis = ["kuantitatif-eksplanatif","kuantitatif-korelasional","kuantitatif-komparatif",
  "kuantitatif-deskriptif","kualitatif-deskriptif","fenomenologi","studi-kasus","analisis-isi",
  "semiotika","efektivitas-program"] as const;
ok("tiap rancangan punya usulan", semuaJenis.every(j => usulkanVisual(j).length > 0));
ok("tiap usulan punya penjelasan kegunaan", semuaJenis.every(j => usulkanVisual(j).every(v => v.untuk.length > 20)));
ok("tiap usulan punya nama grafik yang dikenal",
   semuaJenis.every(j => usulkanVisual(j).every(v => Boolean(GRAFIK_NAMA[v.grafik]))));
ok("tiap rancangan punya minimal satu usulan utama",
   semuaJenis.every(j => usulkanVisual(j).some(v => v.utama)));

console.log("\n=== ACUAN ===\n");
const kunci = ["judul","referensi","kemiripan","sitasi","radar","bahasa","struktur","inggris"];
ok("delapan alat punya acuan", kunci.every(k => Boolean(ACUAN[k])));
ok("tiap acuan punya minimal tiga rujukan", kunci.every(k => ACUAN[k].acuan.length >= 3));
ok("tiap rujukan menyebut untuk apa dipakai",
   kunci.every(k => ACUAN[k].acuan.every(a => a.untuk.length > 15)));
ok("tiap rujukan menyebut tahun atau alamat",
   kunci.every(k => ACUAN[k].acuan.every(a => /\(\d{4}\)|\.org|\.id/.test(a.sumber))));

console.log(gagal ? `\n${gagal} UJI GAGAL\n` : "\nSEMUA UJI LULUS\n");
process.exit(gagal ? 1 : 0);
