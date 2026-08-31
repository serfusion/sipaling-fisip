// UJI ATURAN AKSES SAAT MODE MAINTENANCE
//
// Selama portal ditutup, hanya Super Admin yang boleh memakai sesinya. Aturan
// ini menentukan siapa yang bisa masuk ke dashboard dan siapa yang tidak, jadi
// tabel kebenarannya diperiksa seluruhnya — semua peran, dua keadaan portal —
// bukan sekadar satu-dua contoh.

import {
  PERAN_LOLOS_MAINTENANCE,
  sesiTertahanMaintenance,
  normalizeMaintenance,
  parseMaintenance,
  DEFAULT_MAINTENANCE,
} from "./src/lib/maintenance";

let lulus = 0;
const gagal: string[] = [];

function benar(nama: string, syarat: boolean) {
  if (syarat) lulus += 1;
  else gagal.push(nama);
}

function sama(nama: string, dapat: unknown, harap: unknown) {
  benar(`${nama} (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`, dapat === harap);
}

// Seluruh peran yang ada di sistem, disalin dari daftar di supabase-server.
const SEMUA_PERAN = [
  "super_admin",
  "admin",
  "admin_umum",
  "admin_akademik",
  "admin_prodi",
  "admin_pddikti",
  "admin_perpustakaan",
  "admin_laboratorium",
  "dosen",
] as const;

// --- Portal terbuka: tidak ada satu pun peran yang tertahan ---------------
// Sakelar "admin boleh masuk" tidak boleh berpengaruh apa pun selama portal
// masih terbuka.
for (const peran of SEMUA_PERAN) {
  sama(`portal terbuka, ${peran} lolos`, sesiTertahanMaintenance(peran, false, false), false);
  sama(`portal terbuka + izin admin, ${peran} lolos`, sesiTertahanMaintenance(peran, false, true), false);
}

// --- Portal ditutup, izin admin MATI: hanya Super Admin yang lolos --------
sama("maintenance, super_admin tetap lolos", sesiTertahanMaintenance("super_admin", true, false), false);
for (const peran of SEMUA_PERAN.filter((p) => p !== "super_admin")) {
  sama(`maintenance tanpa izin, ${peran} tertahan`, sesiTertahanMaintenance(peran, true, false), true);
}

// Tepat satu peran yang lolos — bukan dua, bukan nol.
sama(
  "hanya satu peran yang lolos saat maintenance",
  SEMUA_PERAN.filter((p) => !sesiTertahanMaintenance(p, true, false)).length,
  1,
);
sama("peran yang lolos itu super_admin", PERAN_LOLOS_MAINTENANCE, "super_admin");

// --- Portal ditutup, izin admin MENYALA: semua peran lolos ---------------
// Ini sakelar di panel Super Admin. Kalau dinyalakan, admin unit dan dosen
// kembali dapat bekerja selagi portal ditutup.
for (const peran of SEMUA_PERAN) {
  sama(`maintenance + izin admin, ${peran} lolos`, sesiTertahanMaintenance(peran, true, true), false);
}
sama(
  "dengan izin admin, tidak ada peran yang tertahan",
  SEMUA_PERAN.filter((p) => sesiTertahanMaintenance(p, true, true)).length,
  0,
);

// Parameter yang lupa diisi harus MENUTUP, bukan membuka.
sama("bawaan tanpa parameter ketiga: tertahan", sesiTertahanMaintenance("admin", true), true);
// Nilai selain true tidak boleh terbaca sebagai izin.
sama("izin bernilai string tidak membuka", sesiTertahanMaintenance("admin", true, "ya" as unknown as boolean), true);
sama("izin bernilai 1 tidak membuka", sesiTertahanMaintenance("admin", true, 1 as unknown as boolean), true);

// --- Belum login bukan "tertahan" ----------------------------------------
// Pengunjung tanpa sesi memang tidak punya apa-apa untuk ditahan. Kalau ini
// dilaporkan true, halaman login akan memberi tahu tamu biasa bahwa akunnya
// diblokir maintenance — padahal ia belum pernah punya akun.
sama("null tidak tertahan", sesiTertahanMaintenance(null, true, false), false);
sama("undefined tidak tertahan", sesiTertahanMaintenance(undefined, true, false), false);
sama("string kosong tidak tertahan", sesiTertahanMaintenance("", true, false), false);

// --- Peran tak dikenal tetap tertahan ------------------------------------
// Kalau kelak ada peran baru dan aturan ini lupa diperbarui, bawaannya harus
// menutup, bukan membuka.
sama("peran asing tertahan", sesiTertahanMaintenance("admin_baru", true, false), true);
sama("peran mirip tidak lolos", sesiTertahanMaintenance("Super_Admin", true, false), true);
sama("peran berspasi tidak lolos", sesiTertahanMaintenance(" super_admin", true, false), true);

// --- Status maintenance dibaca dengan aman -------------------------------
// getSessionState memanggil readMaintenanceState, yang memakai parse di bawah.
// Nilai rusak harus dibaca sebagai "tidak maintenance" supaya satu baris
// pengaturan yang kacau tidak mengunci seluruh admin di luar sistemnya.
sama("JSON rusak dianggap tidak maintenance", parseMaintenance("{bukan json").enabled, false);
sama("kolom kosong dianggap tidak maintenance", parseMaintenance(null).enabled, false);
sama("enabled hanya true yang menyala", normalizeMaintenance({ enabled: "true" }).enabled, false);
sama("enabled true menyala", normalizeMaintenance({ enabled: true }).enabled, true);
sama("bawaan portal terbuka", DEFAULT_MAINTENANCE.enabled, false);

// Pintu rahasia pada titik huruf "i" tetap menyala kecuali dimatikan tegas.
sama("pintu rahasia bawaan menyala", normalizeMaintenance({}).secretDoor, true);
sama("pintu rahasia bisa dimatikan", normalizeMaintenance({ secretDoor: false }).secretDoor, false);

// Izin masuk admin justru kebalikannya: MATI kecuali dinyalakan tegas.
// Pengaturan lama yang tersimpan sebelum kolom ini ada harus terbaca sebagai
// terkunci, bukan terbuka.
sama("izin admin bawaan mati", normalizeMaintenance({}).adminLogin, false);
sama("pengaturan lama terbaca terkunci", parseMaintenance('{"enabled":true,"secretDoor":true}').adminLogin, false);
sama("izin admin bisa dinyalakan", normalizeMaintenance({ adminLogin: true }).adminLogin, true);
sama("izin admin hanya true yang menyala", normalizeMaintenance({ adminLogin: "true" }).adminLogin, false);
sama("bawaan izin admin mati", DEFAULT_MAINTENANCE.adminLogin, false);

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
