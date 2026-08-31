import { uraiBab, projectBaru, hitungKata } from "./src/lib/project";
import { cariFrasa, kelompokkan } from "./src/lib/frasa-akademik";

let gagal = 0;
const ok = (n: string, s: boolean, i = "") => { console.log(`${s ? "  ✓" : "  ✗"} ${n}${i ? ` — ${i}` : ""}`); if (!s) gagal++; };

console.log("\n=== PENGURAI BAB ===\n");

const naskah = `Kata pengantar singkat sebelum bab pertama.

BAB I PENDAHULUAN
1.1 Latar Belakang
${"kata ".repeat(120)}
1.2 Rumusan Masalah
${"kata ".repeat(40)}
BAB II TINJAUAN PUSTAKA
${"kata ".repeat(200)}
BAB III METODE PENELITIAN
${"kata ".repeat(90)}`;

const bab = uraiBab(naskah);
ok("bab terurai", bab.length >= 5, `${bab.length} bagian: ${bab.map(b => b.judul).join(" | ")}`);
ok("teks sebelum bab pertama tidak hilang",
   bab.some(b => b.judul === "Bagian awal" && b.isi.includes("Kata pengantar")));
ok("judul wadah tanpa isi tidak dihitung sebagai bab",
   !bab.some(b => b.judul.includes("BAB I PENDAHULUAN")),
   bab.map(b => b.judul).join(" | "));
ok("judul yang langsung memuat isi tetap jadi bab",
   bab.find(b => b.judul.includes("BAB II"))?.jumlahKata === 200,
   String(bab.find(b => b.judul.includes("BAB II"))?.jumlahKata));
ok("tiap bab yang tersisa punya isi", bab.every(b => b.jumlahKata > 0));
ok("subbab dikenali", bab.some(b => b.judul.includes("Latar Belakang")));
ok("jumlah kata dihitung", bab.find(b => b.judul.includes("Latar Belakang"))?.jumlahKata === 120,
   String(bab.find(b => b.judul.includes("Latar Belakang"))?.jumlahKata));

const kosong = uraiBab("");
ok("naskah kosong -> nol bab", kosong.length === 0);

const tanpaJudul = uraiBab("hanya paragraf biasa tanpa judul apa pun di dalamnya.");
ok("naskah tanpa judul tetap tersimpan", tanpaJudul.length === 1 && tanpaJudul[0].judul === "Bagian awal",
   tanpaJudul.map(b => b.judul).join());

ok("hitungKata benar", hitungKata("satu dua tiga") === 3 && hitungKata("   ") === 0);

const p = projectBaru("Skripsi Saya", "skripsi", "Ilmu Komunikasi");
ok("project baru punya bidang riset", p.topik === "" && p.rancangan === null && p.sumberBanding.length === 0);
ok("project baru punya id unik", p.id.length > 5);
ok("project baru bersih", p.bab.length === 0 && p.daftarPustaka === "" && p.kodeTiket === null);
ok("nama kosong diberi bawaan", projectBaru("  ", "jurnal").nama === "Project tanpa nama");

console.log("\n=== BANK FRASA ===\n");

const teksSkripsi = `Penelitian ini bertujuan untuk menganalisis pengaruh literasi digital.
Penelitian ini menggunakan pendekatan kualitatif dengan studi kasus.
Teknik pengambilan sampel memakai purposive sampling.
Uji reliabilitas dilakukan pada instrumen.
Hasil penelitian menunjukkan bahwa terdapat pengaruh yang signifikan.
Berdasarkan tabel di atas, dapat disimpulkan bahwa literasi berperan.
Selain itu, keterbatasan penelitian perlu disebutkan.`;

const f = cariFrasa(teksSkripsi);
const punya = (s: string) => f.some(x => x.sumber.toLowerCase().includes(s));

ok("tujuan penelitian dikenali", punya("bertujuan untuk menganalisis"));
ok("pendekatan kualitatif dikenali", punya("kualitatif"));
ok("purposive sampling dikenali", punya("purposive"));
ok("uji reliabilitas dikenali", punya("reliabilitas"));
ok("hasil menunjukkan dikenali", punya("menunjukkan bahwa"));
ok("tabel di atas dikenali", punya("tabel di atas"));
ok("dapat disimpulkan dikenali", punya("disimpulkan"));
ok("keterbatasan dikenali", punya("keterbatasan"));
ok("selain itu dikenali", punya("selain itu"));
ok("total temuan wajar", f.length >= 9, `${f.length} rumusan dikenali`);

const contohPadanan = f.find(x => x.sumber.includes("bertujuan untuk menganalisis"));
ok("padanan Inggris tersedia",
   contohPadanan?.padanan[0] === "This study examines", contohPadanan?.padanan.join(" / "));
ok("catatan menjelaskan kenapa harfiah keliru",
   Boolean(contohPadanan?.catatan?.includes("This research have a purpose")));

ok("tiap pola hanya sekali walau berulang",
   cariFrasa("Selain itu. Selain itu. Selain itu.").filter(x => x.sumber === "Selain itu").length === 1);

const k = kelompokkan(f);
ok("dikelompokkan per bagian naskah", k.length >= 5, k.map(x => `${x.label}(${x.isi.length})`).join(" | "));
ok("urutan mengikuti alur penulisan", k[0].bidang === "tujuan", k[0].label);

ok("naskah tanpa rumusan baku -> kosong",
   cariFrasa("Kucing itu tidur di atas meja kayu.").length === 0);

console.log(gagal === 0 ? "\nSEMUA UJI LULUS\n" : `\n${gagal} UJI GAGAL\n`);
process.exit(gagal === 0 ? 0 : 1);
