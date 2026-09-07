// UJI TOMBOL YANG DICEGAT SELAMA UJIAN
//
// Dua arah dijaga di sini, dan yang kedua lebih sering terlupa:
//
//   1. Yang terlarang benar-benar tertangkap — termasuk pada papan ketik yang
//      `key`-nya bukan aksara Latin, tempat pemeriksaan yang hanya membaca
//      `key` diam-diam tidak pernah menyala sama sekali.
//   2. Yang biasa saja TIDAK ikut tertangkap. Satu salah tangkap pada huruf
//      biasa membuat peserta tidak dapat mengetik jawabannya, dan pada mode
//      sertifikasi tiga di antaranya mengumpulkan ujiannya secara paksa.
//
// Dan satu lagi yang bukan tentang tombol sama sekali: JANJI. Kolom
// `benarTercegah` harus tetap false untuk semua yang nyatanya tidak tercegah,
// karena kalimat di layar peserta dibaca dari sana. "Diblokir" yang ternyata
// tidak memblokir akan diuji peserta pertama dalam lima detik, dan sesudah itu
// seluruh peringatan lain di layar ikut kehilangan wibawanya.

import {
  PESAN_TOMBOL, periksaTombol, type GolonganTombol, type Isyarat,
} from "./src/lib/tombol-terlarang";
import {
  INSIDEN_BERAT, SEMUA_INSIDEN, aturanMode, harusDipaksa, pesanTeguran,
  type JenisInsiden,
} from "./src/lib/pengawasan";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

/** Ketukan yang tidak terlarang sama sekali. */
function lolos(nama: string, t: Isyarat, mengetik = false) {
  benar(`dibiarkan: ${nama}`, periksaTombol(t, mengetik) === null,
    JSON.stringify(periksaTombol(t, mengetik)));
}

/** Ketukan yang harus tertangkap, beserta golongan dan namanya. */
function tertangkap(
  nama: string, t: Isyarat,
  harap: { golongan: GolonganTombol; nama: string; insiden: JenisInsiden | null; tercegah: boolean },
  mengetik = false,
) {
  const p = periksaTombol(t, mengetik);
  if (!p) { gagal.push(`${nama} — tidak tertangkap sama sekali`); return; }
  sama(`${nama}: golongan`, p.golongan, harap.golongan);
  sama(`${nama}: nama`, p.nama, harap.nama);
  sama(`${nama}: insiden`, p.insiden, harap.insiden);
  sama(`${nama}: benarTercegah`, p.benarTercegah, harap.tercegah);
}

console.log("\n=== KETUKAN BIASA DIBIARKAN ===\n");

// Kalau salah satu dari ini tertangkap, peserta tidak dapat mengerjakan
// ujiannya sama sekali.
lolos("huruf a", { key: "a", code: "KeyA" });
lolos("huruf S tanpa pengubah", { key: "S", code: "KeyS", shiftKey: true });
lolos("huruf P tanpa pengubah", { key: "p", code: "KeyP" });
lolos("angka 4", { key: "4", code: "Digit4" });
lolos("spasi", { key: " ", code: "Space" });
lolos("Enter", { key: "Enter", code: "Enter" });
lolos("Backspace", { key: "Backspace", code: "Backspace" });
lolos("panah kiri", { key: "ArrowLeft", code: "ArrowLeft" });
// Tab tidak boleh dicegat: ia satu-satunya jalan peserta yang memakai papan
// ketik saja untuk berpindah antar pilihan jawaban.
lolos("Tab", { key: "Tab", code: "Tab" });
// Escape tidak dicegat, dan itu disengaja. Ia jalan keluar dari layar penuh
// yang memang tidak dapat dicegah peramban mana pun — yang menjaganya
// peristiwa fullscreenchange, bukan daftar ini.
lolos("Escape", { key: "Escape", code: "Escape" });
// Ctrl+C dan Ctrl+V memang terlarang, tetapi bukan di sini: peristiwa copy dan
// paste yang menanganinya, dan itu jalan yang jauh lebih dapat diandalkan
// karena ikut menangkap salin lewat menu klik kanan.
lolos("Ctrl+C diurus peristiwa copy", { key: "c", code: "KeyC", ctrlKey: true });
lolos("Ctrl+V diurus peristiwa paste", { key: "v", code: "KeyV", ctrlKey: true });
lolos("Ctrl+Z urung ketik", { key: "z", code: "KeyZ", ctrlKey: true });
lolos("Ctrl+F cari di halaman", { key: "f", code: "KeyF", ctrlKey: true });
lolos("F1 sampai F4", { key: "F3", code: "F3" });

console.log("=== TANGKAPAN LAYAR SISTEM ===\n");

tertangkap("PrintScreen", { key: "PrintScreen", code: "PrintScreen" },
  { golongan: "tangkap", nama: "PrintScreen", insiden: "tangkap", tercegah: false });
tertangkap("Print (nama lama)", { key: "Print" },
  { golongan: "tangkap", nama: "PrintScreen", insiden: "tangkap", tercegah: false });
// Sebagian peramban mengirim key kosong untuk PrintScreen; codenya yang
// menyelamatkan.
tertangkap("PrintScreen dari code saja", { key: "Unidentified", code: "PrintScreen" },
  { golongan: "tangkap", nama: "PrintScreen", insiden: "tangkap", tercegah: false });
tertangkap("Alt+PrintScreen (jendela aktif saja)",
  { key: "PrintScreen", code: "PrintScreen", altKey: true },
  { golongan: "tangkap", nama: "PrintScreen", insiden: "tangkap", tercegah: false });

console.log("=== ALAT POTONG ===\n");

tertangkap("Win+Shift+S", { key: "S", code: "KeyS", metaKey: true, shiftKey: true },
  { golongan: "tangkap", nama: "Shift+Meta+S", insiden: "tangkap", tercegah: false });
tertangkap("Cmd+Shift+4", { key: "4", code: "Digit4", metaKey: true, shiftKey: true },
  { golongan: "tangkap", nama: "Shift+Meta+4", insiden: "tangkap", tercegah: false });
tertangkap("Cmd+Shift+3", { key: "3", code: "Digit3", metaKey: true, shiftKey: true },
  { golongan: "tangkap", nama: "Shift+Meta+3", insiden: "tangkap", tercegah: false });
tertangkap("Cmd+Shift+5", { key: "5", code: "Digit5", metaKey: true, shiftKey: true },
  { golongan: "tangkap", nama: "Shift+Meta+5", insiden: "tangkap", tercegah: false });
// Shift+angka menghasilkan tanda baca pada tata letak AS: Shift+4 adalah "$".
// Codenya yang menjawab, dan tanpanya seluruh pintasan macOS lolos.
tertangkap("Cmd+Shift+4 yang key-nya sudah menjadi $",
  { key: "$", code: "Digit4", metaKey: true, shiftKey: true },
  { golongan: "tangkap", nama: "Shift+Meta+4", insiden: "tangkap", tercegah: false });
// Tanpa Meta ini hanya mengetik angka.
lolos("Shift+4 biasa", { key: "$", code: "Digit4", shiftKey: true });
lolos("Cmd+4 tanpa Shift", { key: "4", code: "Digit4", metaKey: true });

console.log("=== CETAK DAN SIMPAN ===\n");

// Dua-duanya BENAR-BENAR tercegah, dan keduanya jauh lebih merugikan daripada
// tangkapan layar: yang tertulis bukan satu layar melainkan seluruh naskah.
tertangkap("Ctrl+P", { key: "p", code: "KeyP", ctrlKey: true },
  { golongan: "tangkap", nama: "Ctrl+P", insiden: "tangkap", tercegah: true });
tertangkap("Cmd+P", { key: "p", code: "KeyP", metaKey: true },
  { golongan: "tangkap", nama: "Meta+P", insiden: "tangkap", tercegah: true });
tertangkap("Ctrl+S", { key: "s", code: "KeyS", ctrlKey: true },
  { golongan: "tangkap", nama: "Ctrl+S", insiden: "tangkap", tercegah: true });
tertangkap("Cmd+S", { key: "s", code: "KeyS", metaKey: true },
  { golongan: "tangkap", nama: "Meta+S", insiden: "tangkap", tercegah: true });
// Urutan pemeriksaan: Meta+Shift+S adalah ALAT POTONG, bukan simpan halaman.
// Kalau simpan diperiksa lebih dulu, seluruh alat potong Windows salah nama
// dan salah janji — "tercegah" untuk sesuatu yang tidak tercegah.
benar("Meta+Shift+S bukan simpan halaman",
  periksaTombol({ key: "S", code: "KeyS", metaKey: true, shiftKey: true })?.benarTercegah === false);
// Cetak tetap dicegat walau pesertanya sedang menulis essay. Mengetik bukan
// alasan untuk boleh mencetak naskah soal.
tertangkap("Ctrl+P saat mengetik essay", { key: "p", code: "KeyP", ctrlKey: true },
  { golongan: "tangkap", nama: "Ctrl+P", insiden: "tangkap", tercegah: true }, true);

console.log("=== ALAT PENGEMBANG ===\n");

tertangkap("F12", { key: "F12", code: "F12" },
  { golongan: "devtools", nama: "F12", insiden: "devtools", tercegah: false });
tertangkap("Ctrl+Shift+I", { key: "I", code: "KeyI", ctrlKey: true, shiftKey: true },
  { golongan: "devtools", nama: "Ctrl+Shift+I", insiden: "devtools", tercegah: false });
tertangkap("Ctrl+Shift+J", { key: "J", code: "KeyJ", ctrlKey: true, shiftKey: true },
  { golongan: "devtools", nama: "Ctrl+Shift+J", insiden: "devtools", tercegah: false });
tertangkap("Ctrl+Shift+C", { key: "C", code: "KeyC", ctrlKey: true, shiftKey: true },
  { golongan: "devtools", nama: "Ctrl+Shift+C", insiden: "devtools", tercegah: false });
tertangkap("Ctrl+Shift+K (Firefox)", { key: "K", code: "KeyK", ctrlKey: true, shiftKey: true },
  { golongan: "devtools", nama: "Ctrl+Shift+K", insiden: "devtools", tercegah: false });
tertangkap("Cmd+Opt+I (macOS)", { key: "i", code: "KeyI", metaKey: true, altKey: true },
  { golongan: "devtools", nama: "Alt+Meta+I", insiden: "devtools", tercegah: false });
// Lihat sumber halaman: seluruh naskah soal dalam satu jendela teks. Ini
// satu-satunya di golongan devtools yang sungguh dapat dibatalkan.
tertangkap("Ctrl+U", { key: "u", code: "KeyU", ctrlKey: true },
  { golongan: "devtools", nama: "Ctrl+U", insiden: "devtools", tercegah: true });

console.log("=== PAPAN KETIK BUKAN-LATIN ===\n");

// Papan ketik Arab, Sirilik, dan Yunani mengirim `key` dalam aksaranya sendiri
// untuk tombol fisik yang sama. Pemeriksaan yang hanya membaca `key` diam-diam
// tidak pernah menyala di sana — dan diam-diam adalah bagian terburuknya,
// karena laporan pengawasannya tetap terlihat bersih.
tertangkap("Ctrl+Shift+I pada papan ketik Sirilik",
  { key: "Ш", code: "KeyI", ctrlKey: true, shiftKey: true },
  { golongan: "devtools", nama: "Ctrl+Shift+I", insiden: "devtools", tercegah: false });
tertangkap("Ctrl+P pada papan ketik Arab",
  { key: "ح", code: "KeyP", ctrlKey: true },
  { golongan: "tangkap", nama: "Ctrl+P", insiden: "tangkap", tercegah: true });
tertangkap("Ctrl+A pada papan ketik Yunani",
  { key: "α", code: "KeyA", ctrlKey: true },
  { golongan: "pilih_semua", nama: "Ctrl+A", insiden: null, tercegah: true });

console.log("=== MUAT ULANG, SOROT SEMUA, F11 ===\n");

// Ketiganya dicegah TANPA dicatat. Peserta yang panik menekan F5 bukan peserta
// yang curang, dan memotong skor integritasnya untuk itu hanya menghukum
// kegugupan.
tertangkap("F5", { key: "F5", code: "F5" },
  { golongan: "muat_ulang", nama: "F5", insiden: null, tercegah: true });
tertangkap("Ctrl+R", { key: "r", code: "KeyR", ctrlKey: true },
  { golongan: "muat_ulang", nama: "Ctrl+R", insiden: null, tercegah: true });
tertangkap("Ctrl+Shift+R", { key: "R", code: "KeyR", ctrlKey: true, shiftKey: true },
  { golongan: "muat_ulang", nama: "Ctrl+Shift+R", insiden: null, tercegah: true });
tertangkap("Ctrl+A", { key: "a", code: "KeyA", ctrlKey: true },
  { golongan: "pilih_semua", nama: "Ctrl+A", insiden: null, tercegah: true });
tertangkap("F11", { key: "F11", code: "F11" },
  { golongan: "layar_penuh", nama: "F11", insiden: null, tercegah: false });

// SATU-SATUNYA pembebasan karena sedang mengetik. Orang yang menulis jawaban
// essay panjang harus dapat menyorot kalimatnya sendiri untuk membetulkannya;
// melarang itu tidak menghalangi kecurangan apa pun.
lolos("Ctrl+A di dalam kolom essay", { key: "a", code: "KeyA", ctrlKey: true }, true);
benar("Ctrl+A di luar kolom essay tetap dicegah",
  periksaTombol({ key: "a", code: "KeyA", ctrlKey: true }, false) !== null);

console.log("=== JANJI YANG TIDAK BOLEH DILEBIHKAN ===\n");

// Daftar tetap: yang sistem operasi atau peramban yang memegangnya, dan tidak
// satu baris kode pun di halaman ini dapat membatalkannya. Kalau salah satunya
// suatu hari ditandai "tercegah", layar peserta akan menuliskan janji yang
// dapat dipatahkan dalam lima detik.
const MILIK_SISTEM: Array<[string, Isyarat]> = [
  ["PrintScreen", { key: "PrintScreen", code: "PrintScreen" }],
  ["Win+Shift+S", { key: "S", code: "KeyS", metaKey: true, shiftKey: true }],
  ["Cmd+Shift+4", { key: "4", code: "Digit4", metaKey: true, shiftKey: true }],
  ["F12", { key: "F12", code: "F12" }],
  ["Ctrl+Shift+I", { key: "I", code: "KeyI", ctrlKey: true, shiftKey: true }],
  ["F11", { key: "F11", code: "F11" }],
];
for (const [nama, t] of MILIK_SISTEM) {
  benar(`${nama} tidak pernah mengaku tercegah`,
    periksaTombol(t)?.benarTercegah === false);
}

console.log("=== BENTUK PUTUSAN ===\n");

// Semua golongan punya kalimat yang dapat dibacakan. Golongan yang tidak
// melaporkan insiden TIDAK punya balasan server, jadi kalimat inilah
// satu-satunya yang dilihat peserta — golongan tanpa kalimat berarti layar
// yang menolak ketukan tanpa mengatakan apa pun.
const SEMUA_GOLONGAN: GolonganTombol[] =
  ["tangkap", "devtools", "muat_ulang", "pilih_semua", "layar_penuh"];
for (const g of SEMUA_GOLONGAN) {
  benar(`golongan ${g} punya kalimat`, (PESAN_TOMBOL[g] ?? "").length > 20);
}

// Semua ketukan yang dikenali harus menghasilkan nama yang dapat dibaca
// manusia — nama itu yang tertulis di lembar pengawasan yang dibaca penguji
// berbulan-bulan kemudian, dan "undefined" di sana tidak menjawab apa pun.
const CONTOH: Isyarat[] = [
  { key: "PrintScreen", code: "PrintScreen" },
  { key: "S", code: "KeyS", metaKey: true, shiftKey: true },
  { key: "p", code: "KeyP", ctrlKey: true },
  { key: "s", code: "KeyS", ctrlKey: true },
  { key: "u", code: "KeyU", ctrlKey: true },
  { key: "F12", code: "F12" },
  { key: "I", code: "KeyI", ctrlKey: true, shiftKey: true },
  { key: "F5", code: "F5" },
  { key: "a", code: "KeyA", ctrlKey: true },
  { key: "F11", code: "F11" },
];
for (const t of CONTOH) {
  const p = periksaTombol(t);
  if (!p) { gagal.push(`contoh tidak tertangkap: ${JSON.stringify(t)}`); continue; }
  benar(`nama terbaca: ${p.nama}`, /^[A-Za-z0-9+]{1,24}$/.test(p.nama), p.nama);
  benar(`insiden ${p.nama} dikenali basis data`,
    p.insiden === null || SEMUA_INSIDEN.includes(p.insiden), String(p.insiden));
}

console.log("=== LIMA KALI, LALU DIKUMPULKAN ===\n");

// Lima ketukan terlarang mengakhiri ujiannya, dan pesertanya tidak pernah
// diberi tahu angka itu. Diperiksa lewat jalan yang sama dengan yang dilalui
// ujian sungguhan — putusan tombol → insiden → hitungan → harusDipaksa —
// supaya perubahan pada salah satu dari ketiganya tertangkap di sini, bukan
// pada ujian orang.
function hitungKetukan(ketukan: Isyarat[]): Record<string, number> {
  const hitungan: Record<string, number> = {};
  for (const t of ketukan) {
    const p = periksaTombol(t);
    if (p?.insiden) hitungan[p.insiden] = (hitungan[p.insiden] ?? 0) + 1;
  }
  return hitungan;
}

const f12 = { key: "F12", code: "F12" };
const prtsc = { key: "PrintScreen", code: "PrintScreen" };
const ctrlP = { key: "p", code: "KeyP", ctrlKey: true };
const ctrlS = { key: "s", code: "KeyS", ctrlKey: true };
const ctrlU = { key: "u", code: "KeyU", ctrlKey: true };

sama("sertifikasi memang lima", aturanMode("sertifikasi").batasPaksa, 5);
benar("empat kali F12 belum memutus",
  !harusDipaksa("sertifikasi", hitungKetukan([f12, f12, f12, f12]) as never));
benar("lima kali F12 memutus",
  harusDipaksa("sertifikasi", hitungKetukan([f12, f12, f12, f12, f12]) as never));
benar("lima ketukan berbeda juga memutus",
  harusDipaksa("sertifikasi", hitungKetukan([f12, prtsc, ctrlP, ctrlS, ctrlU]) as never));

// Dan teguran yang muncul pada tiap ketukan menyebut nomornya, tanpa pernah
// menyebut bahwa lima adalah ujungnya. Diperiksa dari rentetan ketukan
// sungguhan, bukan dari angka yang diketik tangan.
const rentetan = [f12, prtsc, ctrlP, ctrlS];
let sudah = 0;
for (const t of rentetan) {
  const putusan = periksaTombol(t);
  if (!putusan?.insiden) continue;
  sudah += 1;
  const kata = pesanTeguran(putusan.insiden, sudah);
  benar(`teguran ketukan ke-${sudah} menyebut nomornya`,
    kata.judul.includes(`ke-${sudah}`), kata.judul);
  benar(`teguran ketukan ke-${sudah} tidak menyebut batasnya`,
    !/\b5\b|lima|sisa|tinggal/i.test(`${kata.judul} ${kata.sebab}`),
    JSON.stringify(kata));
}
// Yang tidak dicatat tidak pernah mengakhiri ujian siapa pun, berapa pun
// banyaknya.
const banyakF5 = Array.from({ length: 20 }, () => ({ key: "F5", code: "F5" }));
benar("dua puluh kali F5 tidak memutus apa pun",
  !harusDipaksa("sertifikasi", hitungKetukan(banyakF5) as never));
benar("dua puluh kali Ctrl+A tidak memutus apa pun",
  !harusDipaksa("sertifikasi",
    hitungKetukan(Array.from({ length: 20 }, () => ({ key: "a", code: "KeyA", ctrlKey: true }))) as never));

// Setiap insiden yang dilaporkan daftar tombol ini HARUS ikut menghitung
// mundur. Kalau tidak, "tiga kali lalu dikumpulkan" menjadi janji yang
// dibatalkan diam-diam oleh berkas lain.
for (const t of CONTOH) {
  const p = periksaTombol(t);
  if (!p?.insiden) continue;
  benar(`${p.nama} ikut menghitung mundur`, INSIDEN_BERAT.includes(p.insiden), p.insiden);
}

console.log("");
if (gagal.length) {
  console.log(`${gagal.length} GAGAL:`);
  for (const g of gagal) console.log(`  - ${g}`);
  process.exit(1);
}
console.log(`${lulus} periksa lulus`);
console.log("SEMUA UJI LULUS");
