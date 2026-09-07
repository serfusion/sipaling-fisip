// UJI ATURAN PENGAWASAN UJIAN
//
// Yang dijaga di sini dua arah sekaligus, dan keduanya sama pentingnya:
// penjagaan yang terlalu longgar tidak menahan siapa pun, dan penjagaan yang
// terlalu galak memutus ujian orang yang tidak berbuat apa-apa. Yang kedua itu
// kesalahan yang jauh lebih mahal — nilainya hilang, dan yang hilang adalah
// nilai peserta yang jujur.

import {
  BOBOT_INSIDEN, INSIDEN_BERAT, INSIDEN_LABEL, MODE_KETERANGAN, MODE_LABEL,
  INSIDEN_TEGUR, SEMUA_INSIDEN, SEMUA_MODE, aturanMode, berat, harusDipaksa,
  jumlahBerat,
  kameraMenyala, pesanPeringatan, pesanTeguran, rapikanInsiden, rapikanMode,
  skorIntegritas,
  tandaAir, tingkatIntegritas, type JenisInsiden,
} from "./src/lib/pengawasan";
import { bolehSaklarKamera, PEMANTAU } from "./src/lib/cbt";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

console.log("\n=== MODE PENGAWASAN ===\n");

sama("mode tidak dikenal jatuh ke biasa", rapikanMode("apa saja"), "biasa");
sama("kosong jatuh ke biasa", rapikanMode(""), "biasa");
sama("null jatuh ke biasa", rapikanMode(null), "biasa");
sama("huruf besar tetap terbaca", rapikanMode("SERTIFIKASI"), "sertifikasi");
sama("spasi di tepi dibuang", rapikanMode("  ketat "), "ketat");
// Yang paling penting: masukan sembarang TIDAK pernah menaikkan keketatan.
sama("angka jatuh ke biasa", rapikanMode(7), "biasa");

for (const m of SEMUA_MODE) {
  benar(`mode ${m} punya label`, Boolean(MODE_LABEL[m]));
  benar(`mode ${m} punya keterangan`, MODE_KETERANGAN[m].length > 20);
}

const biasa = aturanMode("biasa");
const ketat = aturanMode("ketat");
const sertifikasi = aturanMode("sertifikasi");

// Mode biasa harus benar-benar tidak mengganggu. Kuis harian yang mengunci
// layar penuh dan mematikan salin-tempel hanya membuat peserta mengira
// aplikasinya rusak.
sama("biasa: tanpa layar penuh", biasa.layarPenuh, false);
sama("biasa: salin dibiarkan", biasa.kunciSalin, false);
sama("biasa: tanpa tanda air", biasa.tandaAir, false);
sama("biasa: tidak pernah memaksa", biasa.batasPaksa, 0);

sama("ketat: layar penuh", ketat.layarPenuh, true);
sama("ketat: salin dikunci", ketat.kunciSalin, true);
sama("ketat: tanda air menyala", ketat.tandaAir, true);
// Keduanya memutus pada LIMA. Yang membedakan Ketat dari Sertifikasi bukan
// ambangnya melainkan apa yang diawasi — kamera, layar kedua, dan alat
// pengembang hanya ada di mode sertifikasi.
sama("ketat: memaksa pada lima", ketat.batasPaksa, 5);
sama("ketat: lingkungan belum dijaga", ketat.jagaLingkungan, false);

sama("sertifikasi: menjaga lingkungan", sertifikasi.jagaLingkungan, true);
sama("sertifikasi: memaksa pada lima", sertifikasi.batasPaksa, 5);
// Yang membuat ambang itu tetap adil bukan angkanya, melainkan siapa yang
// menghitung mundur. Kalau blur pernah masuk INSIDEN_BERAT, lima notifikasi
// sistem sudah cukup mengakhiri ujian orang, dan tidak satu pun di antaranya
// perbuatan pesertanya.
benar("blur di luar hitungan mundur", !INSIDEN_BERAT.includes("blur"));
benar("wajah hilang di luar hitungan mundur", !INSIDEN_BERAT.includes("wajah_hilang"));
benar("orang lain di luar hitungan mundur", !INSIDEN_BERAT.includes("orang_lain"));
// Klik kanan dan salin IKUT. Keduanya sudah dicegah, jadi yang tercatat bukan
// perbuatan yang berhasil melainkan percobaan yang diulang.
benar("klik kanan ikut menghitung mundur", INSIDEN_BERAT.includes("klik_kanan"));
benar("menyalin ikut menghitung mundur", INSIDEN_BERAT.includes("salin"));
// Keterangan mode dibaca PENGAJAR di panel, bukan peserta di layar ujian —
// jadi di sini angkanya justru harus disebut. Pengajar yang memilih mode
// tanpa tahu ujiannya dapat berakhir sendiri akan terkejut oleh ujiannya
// sendiri.
benar("keterangan sertifikasi menyebut ambangnya",
  /lima/i.test(MODE_KETERANGAN.sertifikasi), MODE_KETERANGAN.sertifikasi);
benar("keterangan ketat menyebut ambangnya",
  /lima/i.test(MODE_KETERANGAN.ketat), MODE_KETERANGAN.ketat);
// Dan tetap pendek. Keterangan mode dibaca sambil memilih, bukan dipelajari:
// yang panjang tidak terbaca sama sekali.
for (const m of SEMUA_MODE) {
  benar(`keterangan ${m} tetap singkat`, MODE_KETERANGAN[m].length <= 110,
    `${MODE_KETERANGAN[m].length} aksara`);
}
sama("sertifikasi: layar penuh", sertifikasi.layarPenuh, true);
sama("sertifikasi: salin dikunci", sertifikasi.kunciSalin, true);
sama("sertifikasi: tanda air menyala", sertifikasi.tandaAir, true);

console.log("=== JENIS INSIDEN ===\n");

sama("jenis tidak dikenal ditolak", rapikanInsiden("apa-apa"), null);
sama("jenis kosong ditolak", rapikanInsiden(""), null);
sama("jenis dikenali", rapikanInsiden("tempel"), "tempel");
sama("huruf besar tetap terbaca", rapikanInsiden("DEVTOOLS"), "devtools");

for (const j of SEMUA_INSIDEN) {
  benar(`insiden ${j} punya label`, Boolean(INSIDEN_LABEL[j]));
  benar(`insiden ${j} punya bobot`, typeof BOBOT_INSIDEN[j] === "number" && BOBOT_INSIDEN[j] > 0);
}

// Urutan bobotnya harus mencerminkan seberapa sulit sesuatu terjadi tanpa
// sengaja. Alat pengembang tidak terbuka sendiri; jendela kehilangan fokus
// setiap kali ada notifikasi.
benar("devtools lebih berat daripada tempel", BOBOT_INSIDEN.devtools > BOBOT_INSIDEN.tempel);
benar("tempel lebih berat daripada salin", BOBOT_INSIDEN.tempel > BOBOT_INSIDEN.salin);
benar("tangkap layar lebih berat daripada pindah tab", BOBOT_INSIDEN.tangkap > BOBOT_INSIDEN.tab);
benar("blur paling ringan bersama klik kanan",
  BOBOT_INSIDEN.blur <= 5 && BOBOT_INSIDEN.klik_kanan <= 5);

// Dan yang tidak disengaja tidak boleh ikut menghitung mundur ke pemutusan.
benar("blur BUKAN pelanggaran berat", !berat("blur"));
benar("klik kanan kini pelanggaran berat", berat("klik_kanan"));
benar("layar kedua bukan pelanggaran berat", !berat("layar_kedua"),
  "layar kedua adalah keadaan, bukan perbuatan berulang");
benar("tempel adalah pelanggaran berat", berat("tempel"));
benar("devtools adalah pelanggaran berat", berat("devtools"));
benar("keluar layar penuh berat", berat("fullscreen"));

console.log("=== SKOR INTEGRITAS ===\n");

sama("tanpa catatan: seratus", skorIntegritas({}), 100);
sama("sekali klik kanan hampir tidak berpengaruh", skorIntegritas({ klik_kanan: 1 }), 98);
sama("sekali menempel terasa", skorIntegritas({ tempel: 1 }), 75);
sama("dua kali menempel", skorIntegritas({ tempel: 2 }), 50);
sama("campuran dijumlahkan", skorIntegritas({ tab: 2, salin: 1 }), 72);
// Tidak pernah menembus nol, walau catatannya panjang sekali.
sama("tidak pernah minus", skorIntegritas({ devtools: 20 }), 0);
// Dan tidak pernah lebih dari seratus, walau datanya rusak.
sama("hitungan minus diabaikan", skorIntegritas({ tab: -5 }), 100);
sama("pecahan dibulatkan ke bawah", skorIntegritas({ tab: 1.9 }), 90);

sama("seratus itu bersih", tingkatIntegritas(100), "bersih");
sama("sembilan puluh masih wajar", tingkatIntegritas(90), "wajar");
sama("delapan puluh masih wajar", tingkatIntegritas(80), "wajar");
sama("tujuh puluh sembilan perlu ditinjau", tingkatIntegritas(79), "tinjau");
sama("lima puluh perlu ditinjau", tingkatIntegritas(50), "tinjau");
sama("empat puluh sembilan diragukan", tingkatIntegritas(49), "diragukan");
sama("nol diragukan", tingkatIntegritas(0), "diragukan");

console.log("=== PENGUMPULAN PAKSA ===\n");

const banyak: Record<string, number> = { tab: 3, fullscreen: 3, tempel: 3 };
sama("berat dijumlahkan", jumlahBerat(banyak as never), 9);
sama("yang ringan tidak ikut", jumlahBerat({ blur: 9, wajah_hilang: 9 }), 0);

// Mode biasa TIDAK PERNAH memutus, berapa pun catatannya. Kuis harian yang
// berakhir sendiri karena pesertanya berpindah tab tiga kali adalah kerugian
// yang tidak sebanding dengan apa pun yang dijaganya.
benar("biasa tidak pernah memaksa", !harusDipaksa("biasa", banyak as never));
benar("biasa tetap tidak memaksa walau catatannya banyak",
  !harusDipaksa("biasa", { tab: 99, tempel: 99 }));
benar("ketat memaksa saat batasnya lewat", harusDipaksa("ketat", banyak as never));
benar("sertifikasi memaksa saat batasnya lewat", harusDipaksa("sertifikasi", banyak as never));

// Yang tidak disengaja tidak memutus apa-apa, pada mode mana pun.
benar("blur berkali-kali tidak memutus sertifikasi",
  !harusDipaksa("sertifikasi", { blur: 50, wajah_hilang: 50 }));
benar("blur berkali-kali tidak memutus ketat",
  !harusDipaksa("ketat", { blur: 50, wajah_hilang: 50 }));

// Persis di ambangnya, dari kedua sisi, pada kedua mode yang memutus.
// Selisih satu di sini adalah ujian orang yang berakhir satu ketukan terlalu
// cepat — dan tidak dapat dibatalkan.
for (const m of ["ketat", "sertifikasi"] as const) {
  benar(`${m}: empat pelanggaran berat belum memutus`, !harusDipaksa(m, { tab: 4 }));
  benar(`${m}: lima pelanggaran berat memutus`, harusDipaksa(m, { tab: 5 }));
}
benar("lima pelanggaran campuran juga memutus",
  harusDipaksa("sertifikasi", { tangkap: 2, devtools: 1, tempel: 1, tab: 1 }));
benar("empat pelanggaran campuran belum memutus",
  !harusDipaksa("sertifikasi", { tangkap: 2, devtools: 1, tempel: 1 }));

console.log("=== PERINGATAN KEPADA PESERTA ===\n");

// Peringatan yang tidak menyebut sisa kesempatan tidak mengubah perilaku
// siapa pun.
const p1 = pesanPeringatan("sertifikasi", "tab", { tab: 1 });
benar("menyebut perbuatannya", p1.includes("Pindah tab"), p1);
benar("menyebut sudah berapa kali", /ke-1\b/.test(p1), p1);

// ---------- BATASNYA TIDAK PERNAH BOCOR ----------
//
// Inilah yang membuat ancamannya bekerja, dan sekali bocor ia tidak dapat
// ditarik kembali: peserta yang tahu batasnya membelanjakan jatahnya dengan
// tenang sampai satu ketukan sebelum habis, dan seluruh penjagaan berubah
// menjadi anggaran. Diperiksa pada TIAP mode dan TIAP angka, karena satu
// kalimat yang terlewat sudah cukup.
const KATA_BOCOR = /sisa|tersisa|tinggal|batas(?:nya)? \d|dari \d|\bdari lima\b/i;
for (const m of SEMUA_MODE) {
  const batas = aturanMode(m).batasPaksa;
  for (let sudah = 1; sudah <= Math.max(batas, 3) + 2; sudah += 1) {
    const pesan = pesanPeringatan(m, "tab", { tab: sudah });
    benar(`${m}/${sudah}: tidak membocorkan batasnya`, !KATA_BOCOR.test(pesan), pesan);
    // Dan angka batasnya sendiri tidak pernah muncul sebagai angka telanjang.
    if (batas > 0 && sudah !== batas) {
      benar(`${m}/${sudah}: angka batas tidak tertulis`,
        !new RegExp(`\\b${batas}\\b`).test(pesan), pesan);
    }
  }
}

// Yang tetap dikatakan: perbuatannya, nomornya, dan bahwa ujiannya dapat
// berakhir. Ancaman yang kabur bukan alasan untuk menjadi ancaman yang tidak
// jujur.
for (const m of ["ketat", "sertifikasi"] as const) {
  const batas = aturanMode(m).batasPaksa;
  for (let sudah = 1; sudah < batas; sudah += 1) {
    const pesan = pesanPeringatan(m, "tab", { tab: sudah });
    benar(`${m}: menyebut pelanggaran ke-${sudah}`,
      new RegExp(`ke-${sudah}\\b`).test(pesan), pesan);
    benar(`${m}: mengancam tanpa peringatan lagi`,
      /tanpa peringatan lagi/i.test(pesan), pesan);
  }
  const habis = pesanPeringatan(m, "tab", { tab: batas });
  benar(`${m}: saat batasnya lewat, mengatakan apa yang terjadi`,
    habis.includes("dikumpulkan otomatis"), habis);
}

const p3 = pesanPeringatan("biasa", "tab", { tab: 1 });
benar("mode biasa tidak mengancam yang tidak akan terjadi",
  !p3.includes("ke-1") && !p3.includes("otomatis"), p3);
benar("mode biasa tetap mencatat", p3.includes("dilaporkan ke pengawas"), p3);

const p4 = pesanPeringatan("sertifikasi", "blur", { blur: 3 });
benar("pelanggaran ringan tidak dihitung mundur", !/ke-\d/.test(p4), p4);
benar("pelanggaran ringan tidak diancam", !/tanpa peringatan lagi/i.test(p4), p4);

console.log("=== KOTAK TEGURAN ===\n");

// Kotak yang menutup soal dan harus diakui. Isinya diperiksa dengan aturan
// yang sama: menyebut nomornya, tidak pernah menyebut batasnya.
for (let n = 1; n <= 8; n += 1) {
  const t = pesanTeguran("tangkap", n);
  benar(`teguran ke-${n} menyebut nomornya`, t.judul === `Pelanggaran ke-${n}`, t.judul);
  benar(`teguran ke-${n} tidak membocorkan batas`,
    !KATA_BOCOR.test(`${t.judul} ${t.sebab}`), JSON.stringify(t));
}
const tg = pesanTeguran("tangkap", 2);
benar("teguran menyebut perbuatannya", tg.sebab === INSIDEN_TEGUR.tangkap, tg.sebab);
// Empat perbuatan yang paling sering dicoba harus berbunyi persis "Terdeteksi
// ...", karena itulah kalimat yang menghentikan tangan orang.
for (const j of ["tangkap", "tab", "klik_kanan", "salin"] as const) {
  benar(`teguran ${j} berbunyi "Terdeteksi ..."`,
    INSIDEN_TEGUR[j].startsWith("Terdeteksi "), INSIDEN_TEGUR[j]);
}
// Isinya HANYA dua: nomornya dan perbuatannya. Kotak ini muncul di tengah
// ujian pada orang yang sedang panik, dan dua baris penjelas yang harus
// dibaca lebih dulu justru membuat angkanya terlewat. Kalau suatu hari ada
// yang menambahkan paragraf lagi ke sini, uji ini yang menahannya.
benar("teguran hanya membawa nomor dan perbuatannya",
  Object.keys(tg).sort().join(",") === "judul,sebab", JSON.stringify(tg));
benar("teguran tetap singkat", `${tg.judul} ${tg.sebab}`.length <= 70,
  `${tg.judul} ${tg.sebab}`);
// Nomor nol tidak boleh menghasilkan "Pelanggaran ke-0".
benar("nomor yang hilang tidak menjadi ke-0",
  !pesanTeguran("tangkap", 0).judul.includes("ke-0"), pesanTeguran("tangkap", 0).judul);
// Tiap jenis insiden punya sebab yang dapat dibaca — kotak yang berkata
// "undefined" adalah kotak yang tidak dipercaya siapa pun.
for (const j of SEMUA_INSIDEN) {
  const t = pesanTeguran(j, 1);
  benar(`teguran ${j} punya sebab terbaca`, (t.sebab ?? "").length > 3, t.sebab);
}

console.log("=== SAKLAR KAMERA ===\n");

// Dua syarat, dan keduanya harus benar. Kuis harian yang menyalakan webcam
// karena satu saklar tergeser adalah kesalahan yang tidak boleh mungkin.
sama("sertifikasi + saklar menyala: kamera hidup", kameraMenyala("sertifikasi", true), true);
sama("sertifikasi + saklar mati: kamera mati", kameraMenyala("sertifikasi", false), false);
sama("ketat + saklar menyala: tetap mati", kameraMenyala("ketat", true), false);
sama("biasa + saklar menyala: tetap mati", kameraMenyala("biasa", true), false);

// Ujian lama, dari sebelum kolom saklarnya ada, tidak boleh mendadak
// kehilangan kameranya. Bawaan kolomnya TRUE, dan nilai yang hilang pun
// diperlakukan sebagai menyala.
sama("saklar tidak diisi diperlakukan menyala",
  kameraMenyala("sertifikasi", undefined as unknown as boolean), true);

console.log("=== SIAPA YANG BOLEH MENGGESERNYA ===\n");

const orang = (role: string) => ({ id: "x", role, fullName: "X", lecturerId: null });

// Wewenang ini satu-satunya di CBT yang justru MENJAUH dari pemilik ujian.
// Menyalakan kamera bukan mengatur ujian, melainkan merekam wajah orang.
sama("super admin boleh", bolehSaklarKamera(orang("super_admin")), true);
sama("admin boleh", bolehSaklarKamera(orang("admin")), true);
sama("pengajar TIDAK boleh, walau ujian itu miliknya", bolehSaklarKamera(orang("dosen")), false);

// Admin bagian tidak menyentuh menu CBT sama sekali, apalagi saklar ini.
for (const bagian of [
  "admin_umum", "admin_akademik", "admin_prodi",
  "admin_pddikti", "admin_perpustakaan", "admin_laboratorium",
]) {
  sama(`${bagian} tidak boleh`, bolehSaklarKamera(orang(bagian)), false);
}
sama("peserta tidak boleh", bolehSaklarKamera(orang("peserta")), false);
sama("tanpa profil tidak boleh", bolehSaklarKamera(null), false);
// Peran karangan tidak pernah lolos hanya karena namanya mengandung "admin".
sama("peran karangan tidak boleh", bolehSaklarKamera(orang("admin_super")), false);
benar("daftarnya persis dua peran", PEMANTAU.length === 2,
  JSON.stringify(PEMANTAU));

console.log("=== TANDA AIR ===\n");

const saat = new Date("2026-09-07T09:30:00+07:00");
const air = tandaAir({ nama: "Rina Halim", nim: "2021001", kode: "SV4LDP" }, saat);
benar("memuat nama", air.includes("Rina Halim"), air);
benar("memuat NOMOR PESERTA", air.includes("2021001"), air);
benar("memuat kode ujian", air.includes("SV4LDP"), air);
benar("memuat jamnya", air.includes("09") || air.includes("9"), air);
// Satu potongan kecil tangkapan layar pun harus cukup menunjuk orangnya.
benar("cukup rapat untuk diulang-ulang", air.length < 80, `${air.length} huruf: ${air}`);

const kosong = tandaAir({ nama: "", nim: "", kode: "" }, saat);
benar("identitas kosong tidak menyisakan pemisah menggantung",
  !kosong.startsWith(" ·") && !kosong.endsWith("· "), `"${kosong}"`);
const rapi = tandaAir({ nama: "  Budi   Santoso  ", nim: " 2021002 ", kode: "AB12CD" }, saat);
benar("spasi ganda dirapikan", rapi.includes("Budi Santoso"), rapi);

// Semua jenis insiden harus dapat dicatat lewat jalur yang sama.
for (const j of SEMUA_INSIDEN) {
  sama(`insiden ${j} bolak-balik utuh`, rapikanInsiden(j), j as JenisInsiden);
}
benar("daftar berat adalah bagian dari daftar insiden",
  INSIDEN_BERAT.every((j) => SEMUA_INSIDEN.includes(j)));

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
