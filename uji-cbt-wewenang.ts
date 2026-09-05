// ============================================================
// UJI: wewenang CBT, deteksi ujian ganda, dan parameter angka
//
// Tiga hal yang diperiksa berkas ini, dan ketiganya bug yang benar-benar
// terjadi di portal:
//
//   1. angkaParam — parameter yang TIDAK dikirim harus null, bukan nol.
//      Number(null) bernilai 0 dan Number.isInteger(0) bernilai true, jadi
//      pemeriksaan lama menganggap "attempt" selalu terkirim. Akibatnya
//      /api/cbt/hasil selalu mengambil cabang "satu mahasiswa", selalu
//      menjawab 404, dan daftar peserta tidak pernah sempat dijalankan —
//      itulah sebab Monitoring tampak kosong padahal ada empat peserta.
//   2. Kepemilikan — aktivasi hanya di tangan dosen pemilik ujiannya.
//   3. periksaGanda — satu orang satu kali, dilihat dari nama dan perangkat,
//      bukan dari NIM saja.
// ============================================================
import {
  angkaParam, bolehHapus, bolehPantau, bolehUbah, kunciNama, pemilik,
  periksaGanda, rapikanPerangkat, type Kepemilikan, type Pemakai,
} from "@/lib/cbt";

let lulus = 0;
let gagal = 0;
function cek(nama: string, syarat: boolean, keterangan = "") {
  if (syarat) { lulus += 1; console.log(`  ok    ${nama}`); }
  else { gagal += 1; console.log(`  GAGAL ${nama}${keterangan ? " — " + keterangan : ""}`); }
}
function bagian(judul: string) { console.log(`\n== ${judul} ==`); }

// ---------- 1. PARAMETER ANGKA ----------
bagian("angkaParam — bug Monitoring kosong");
cek("null menjadi null, BUKAN nol", angkaParam(null) === null, String(angkaParam(null)));
cek("parameter kosong menjadi null", angkaParam("") === null);
cek("spasi saja menjadi null", angkaParam("   ") === null);
cek("undefined menjadi null", angkaParam(undefined) === null);
cek("nol ditolak — tidak ada id bernilai nol", angkaParam("0") === null);
cek("angka negatif ditolak", angkaParam("-3") === null);
cek("bukan angka ditolak", angkaParam("abc") === null);
cek("pecahan ditolak", angkaParam("3.7") === null);
cek("angka sah lolos apa adanya", angkaParam("42") === 42);
// Inilah pembuktian bugnya, ditulis sebagai uji supaya tidak pernah kembali.
cek(
  "cara lama menganggap parameter kosong sebagai id yang sah",
  Number.isInteger(Number(null)) === true && angkaParam(null) === null,
);

// ---------- 2. KEPEMILIKAN ----------
bagian("Kepemilikan — hanya dosen pemilik yang mengaktifkan");

const dosenA: Pemakai = { id: "u-a", fullName: "Dr. Ayu", role: "dosen", lecturerId: 7 };
const dosenB: Pemakai = { id: "u-b", fullName: "Dr. Budi", role: "dosen", lecturerId: 9 };
const dosenTanpaBaris: Pemakai = { id: "u-c", fullName: "Dr. Citra", role: "dosen", lecturerId: null };
const admin: Pemakai = { id: "u-ad", fullName: "Admin Umum", role: "admin", lecturerId: null };
const superAdmin: Pemakai = { id: "u-sa", fullName: "Super", role: "super_admin", lecturerId: null };

const ujianAyu: Kepemilikan = { lecturerId: 7, createdBy: "Dr. Ayu", createdById: "u-a" };
const ujianSeleksiAdmin: Kepemilikan = { lecturerId: null, createdBy: "Admin Umum", createdById: "u-ad" };
const ujianCitra: Kepemilikan = { lecturerId: null, createdBy: "Dr. Citra", createdById: "u-c" };

cek("dosen memiliki ujiannya sendiri", pemilik(dosenA, ujianAyu));
cek("dosen lain bukan pemiliknya", !pemilik(dosenB, ujianAyu));
cek("admin BUKAN pemilik ujian dosen", !pemilik(admin, ujianAyu));
cek("super admin pun BUKAN pemiliknya", !pemilik(superAdmin, ujianAyu));

// Ini bug yang kedua: dosen yang profilnya belum tersambung ke baris dosen
// dapat membuat ujian, lalu terkunci di luar ujiannya sendiri selamanya.
cek("dosen tanpa lecturerId tetap memiliki ujian buatannya", pemilik(dosenTanpaBaris, ujianCitra));

cek("admin memiliki ujian seleksi buatannya sendiri", pemilik(admin, ujianSeleksiAdmin));
cek("admin boleh mengaktifkan ujian seleksinya", bolehUbah(admin, ujianSeleksiAdmin));
cek("admin TIDAK boleh mengaktifkan ujian dosen", !bolehUbah(admin, ujianAyu));
cek("super admin TIDAK boleh mengaktifkan ujian dosen", !bolehUbah(superAdmin, ujianAyu));
cek("dosen pemiliknya boleh mengaktifkan", bolehUbah(dosenA, ujianAyu));
cek("dosen lain tidak boleh mengaktifkan", !bolehUbah(dosenB, ujianAyu));

cek("admin boleh memantau ujian siapa pun", bolehPantau(admin, ujianAyu));
cek("super admin boleh memantau", bolehPantau(superAdmin, ujianAyu));
cek("dosen lain tidak boleh memantau ujian bukan miliknya", !bolehPantau(dosenB, ujianAyu));
cek("dosen pemiliknya boleh memantau", bolehPantau(dosenA, ujianAyu));

cek("admin boleh menghapus ujian", bolehHapus(admin, ujianAyu));
cek("super admin boleh menghapus ujian", bolehHapus(superAdmin, ujianAyu));
cek("dosen pemiliknya boleh menghapus", bolehHapus(dosenA, ujianAyu));
cek("dosen lain tidak boleh menghapus", !bolehHapus(dosenB, ujianAyu));

// Baris lama, dari sebelum kolom created_by_id ada.
const ujianLamaDosen: Kepemilikan = { lecturerId: 7, createdBy: "Dr. Ayu", createdById: null };
const ujianLamaAdmin: Kepemilikan = { lecturerId: null, createdBy: "Admin Umum", createdById: null };
cek("ujian lama tetap dikenali pemiliknya lewat lecturerId", pemilik(dosenA, ujianLamaDosen));
cek("ujian lama milik dosen lain tetap tertutup", !pemilik(dosenB, ujianLamaDosen));
cek("ujian lama buatan admin dikenali lewat namanya", pemilik(admin, ujianLamaAdmin));
cek("nama yang berbeda tidak menjadikannya pemilik", !pemilik(superAdmin, ujianLamaAdmin));

// Dosen yang akun profilnya baru DISAMBUNGKAN ke baris dosen sesudah ujiannya
// dibuat. Ujiannya lahir tanpa lecturerId; kalau kepemilikan lama hanya dilihat
// dari kolom itu, penyambungan justru merampas ujiannya sendiri.
const dosenBaruTersambung: Pemakai = { id: "u-c", fullName: "Dr. Citra", role: "dosen", lecturerId: 12 };
const ujianCitraLama: Kepemilikan = { lecturerId: null, createdBy: "Dr. Citra", createdById: null };
cek("penyambungan baris dosen tidak merampas ujian lamanya sendiri",
    pemilik(dosenBaruTersambung, ujianCitraLama));
cek("ujian lama tanpa lecturerId tetap tertutup bagi dosen lain",
    !pemilik(dosenB, ujianCitraLama));

// ---------- 3. UJIAN GANDA ----------
bagian("kunciNama — dua tulisan, satu orang");
cek("spasi berlebih diseragamkan", kunciNama("Budi  Santoso") === "budi santoso", kunciNama("Budi  Santoso"));
cek("huruf besar-kecil tidak membedakan", kunciNama("BUDI SANTOSO") === kunciNama("budi santoso"));
cek("titik dan gelar dibuang", kunciNama("Budi Santoso, S.I.Kom.").startsWith("budi santoso"), kunciNama("Budi Santoso, S.I.Kom."));
cek("nama kosong menjadi tali kosong", kunciNama("") === "");
cek("angka tidak ikut terbawa", kunciNama("Budi 2 Santoso") === "budi santoso", kunciNama("Budi 2 Santoso"));

bagian("rapikanPerangkat — nilai dari luar, dibersihkan keras");
cek("uuid lolos apa adanya",
    rapikanPerangkat("3f2a1b7c-9d4e-4f1a-8b2c-7e6d5c4b3a21") === "3f2a1b7c-9d4e-4f1a-8b2c-7e6d5c4b3a21");
cek("tanda baca lain dibuang", rapikanPerangkat("ab<script>cd") === "abscriptcd", rapikanPerangkat("ab<script>cd"));
cek("dipotong 64 huruf", rapikanPerangkat("a".repeat(200)).length === 64);
cek("null menjadi tali kosong", rapikanPerangkat(null) === "");

bagian("periksaGanda — satu orang, satu kali");
const riwayat = [
  { nim: "1111", nameKey: "budi santoso", deviceId: "hp-budi", status: "selesai" },
  { nim: "2222", nameKey: "citra dewi", deviceId: "hp-citra", status: "berjalan" },
];

cek("orang baru dengan perangkat baru diterima",
    periksaGanda({ nim: "3333", nameKey: "dedi kurnia", deviceId: "hp-dedi" }, riwayat).ok);

const namaKembar = periksaGanda({ nim: "9999", nameKey: "budi santoso", deviceId: "hp-lain" }, riwayat);
cek("nama sama dengan NIM berbeda ditolak", !namaKembar.ok);
cek("penolakannya menyebut NIM yang sudah terdaftar",
    !namaKembar.ok && namaKembar.pesan.includes("1111"), !namaKembar.ok ? namaKembar.pesan : "");

const perangkatKembar = periksaGanda({ nim: "9999", nameKey: "eka putri", deviceId: "hp-budi" }, riwayat);
cek("perangkat yang sudah dipakai orang lain ditolak", !perangkatKembar.ok);
cek("penolakannya menyebut perangkat",
    !perangkatKembar.ok && perangkatKembar.pesan.toLowerCase().includes("perangkat"));

// Yang paling penting: orang yang kembali ke ujiannya SENDIRI tidak boleh
// tertahan oleh pemeriksaan yang ditujukan kepada orang lain.
cek("NIM yang sama kembali dengan perangkatnya sendiri tetap lolos",
    periksaGanda({ nim: "1111", nameKey: "budi santoso", deviceId: "hp-budi" }, riwayat).ok);
cek("NIM yang sama kembali dari perangkat lain tetap lolos",
    periksaGanda({ nim: "1111", nameKey: "budi santoso", deviceId: "laptop-pinjam" }, riwayat).ok);

// Laboratorium: satu komputer memang dipakai bergantian sepanjang hari.
cek("saklar satu-perangkat dimatikan, perangkat berulang diterima",
    periksaGanda({ nim: "9999", nameKey: "eka putri", deviceId: "hp-budi" }, riwayat, { satuPerangkat: false }).ok);
cek("nama kembar TETAP ditolak walau saklar perangkat mati",
    !periksaGanda({ nim: "9999", nameKey: "budi santoso", deviceId: "bebas" }, riwayat, { satuPerangkat: false }).ok);

// Peramban yang menolak menyimpan apa pun mengirim tali kosong. Ia tidak
// boleh dicocokkan dengan tali kosong milik orang lain — kalau tidak, peserta
// kedua yang perambannya terkunci akan ditolak tanpa sebab.
const riwayatTanpaPerangkat = [{ nim: "1111", nameKey: "budi santoso", deviceId: "", status: "selesai" }];
cek("perangkat kosong tidak dianggap kembar",
    periksaGanda({ nim: "3333", nameKey: "dedi kurnia", deviceId: "" }, riwayatTanpaPerangkat).ok);
cek("nama kosong tidak dianggap kembar",
    periksaGanda({ nim: "3333", nameKey: "", deviceId: "hp-dedi" },
      [{ nim: "1111", nameKey: "", deviceId: "hp-budi", status: "selesai" }]).ok);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
