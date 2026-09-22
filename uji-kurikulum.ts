// UJI PEMBACAAN ACUAN KURIKULUM → TEMPLATE MATAKULIAH PDDIKTI
//
// Yang dijaga di sini adalah kesalahan yang TIDAK terlihat sampai berkasnya
// sudah diunggah dan ditolak PDDIKTI: kolom yang bergeser satu, semester yang
// tertukar antarpita, mata kuliah yang sama terkirim tiga kali karena ada di
// tiga konsentrasi, dan baris "TOTAL JUMLAH SKS" yang ikut terbawa sebagai
// mata kuliah.
//
// Seluruhnya murni. Tidak satu pun uji di sini menyentuh basis data, berkas,
// atau jaringan — lembar acuannya disusun di sini sebagai larik biasa.

import {
  KOLOM_MATKUL, OPSI_BAWAAN, SEMESTER_MAKS, bacaKurikulumAcuan, barisKeAoa,
  gabungKonsentrasi, periksaBaris, rapikanKodeMk, rapikanSks, semesterDariJudul,
  tahunKurikulumSah, type Aoa,
} from "./src/app/dashboard/template/kurikulum-parse";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, JSON.stringify(dapat) === JSON.stringify(harap),
    `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

/**
 * Lembar acuan tiruan, bentuknya SAMA PERSIS dengan kiriman fakultas:
 * tiga konsentrasi berdampingan (kolom 0, 6, 12), semester bertumpuk.
 */
function lembarTiruan(): Aoa {
  const kosong = () => Array(18).fill("");
  const baris: Aoa = [kosong(), kosong()];

  // Baris 3: nama konsentrasi di kolom awal tiap kelompok.
  const nama = kosong();
  nama[0] = "ADV"; nama[6] = "BROADCASTING"; nama[12] = "PUBLIC RELATIONS";
  baris.push(nama);

  const pita = (sem: number, isi: Array<[string, string, string, string]>) => {
    const judul = kosong();
    for (const off of [0, 6, 12]) {
      judul[off] = "KD MATKUL"; judul[off + 1] = "BK";
      judul[off + 2] = `SEMESTER ${sem}`; judul[off + 3] = "SKS";
    }
    baris.push(judul);
    for (const [kd, bk, mk, sks] of isi) {
      const r = kosong();
      for (const off of [0, 6, 12]) { r[off] = kd; r[off + 1] = bk; r[off + 2] = mk; r[off + 3] = sks; }
      baris.push(r);
    }
  };

  pita(1, [
    ["MKU-0201", "17", "AIKA 1", "2"],
    ["IKM 8258", "08", "Komunikasi Antar Budaya", "2"],
  ]);
  pita(2, [["MKN 0102", "10", "Bahasa Indonesia", "2"]]);
  return baris;
}

console.log("\n=== BAGIAN KECIL ===\n");

sama("semester dari judul", semesterDariJudul("SEMESTER 3"), 3);
sama("judul berspasi tetap terbaca", semesterDariJudul("  semester   7 "), 7);
sama("judul tanpa angka tidak terbaca", semesterDariJudul("SEMESTER"), 0);
sama("semester di luar 1-8 ditolak", semesterDariJudul("SEMESTER 9"), 0);
benar("batas semester delapan", SEMESTER_MAKS === 8);

sama("sks angka", rapikanSks("3"), 3);
sama("sks koma dibaca", rapikanSks("2,0"), 2);
sama("sks kosong null", rapikanSks(""), null);
sama("sks bukan angka null", rapikanSks("dua"), null);
sama("sks tak masuk akal ditolak", rapikanSks("99"), null);

sama("kode dirapikan spasinya", rapikanKodeMk("  IKM   8202 "), "IKM 8202");
benar("huruf kodenya TIDAK diubah", rapikanKodeMk("MKU-0201") === "MKU-0201",
  "kode PDDIKTI peka huruf besar-kecil; mengubahnya berarti kode lain");

benar("tahun kurikulum sah", tahunKurikulumSah("20241"));
benar("tahun tanpa semester ditolak", !tahunKurikulumSah("2024"));
benar("semester 3 ditolak", !tahunKurikulumSah("20243"));
benar("kosong ditolak", !tahunKurikulumSah(""));

console.log("\n=== PEMBACAAN LEMBAR ===\n");

const baca = bacaKurikulumAcuan(lembarTiruan());
sama("ketiga konsentrasi terbaca", baca.konsentrasi, ["ADV", "BROADCASTING", "PUBLIC RELATIONS"]);
sama("dua semester ditemukan", baca.semesterAda, [1, 2]);
// 3 mata kuliah × 3 konsentrasi.
sama("seluruh baris terbaca", baca.baris.length, 9);

const aika = baca.baris.filter((b) => b.kode === "MKU-0201");
sama("AIKA muncul di tiga konsentrasi", aika.length, 3);
sama("semesternya ikut judul kolom namanya", aika[0].semester, 1);
sama("namanya diambil dari kolom di bawah judul semester", aika[0].nama, "AIKA 1");
sama("sks dari kolom keempat", aika[0].sks, 2);
sama("BK ikut terbaca untuk ditampilkan", aika[0].bk, "17");

const bind = baca.baris.find((b) => b.kode === "MKN 0102");
sama("pita kedua bersemester dua", bind?.semester, 2);

console.log("\n=== BARIS YANG HARUS DILEWATI ===\n");

// Lembar sungguhan memuat baris rekap di kaki tiap pita. Ia punya kode tetapi
// tidak punya nama mata kuliah, dan pernah ikut terkirim sebagai mata kuliah.
const denganRekap = lembarTiruan();
const rekap = Array(18).fill("");
for (const off of [0, 6, 12]) { rekap[off] = "TOTAL JUMLAH SKS"; rekap[off + 3] = "22"; }
denganRekap.push(rekap);
const bacaRekap = bacaKurikulumAcuan(denganRekap);
benar("baris rekap tidak menjadi mata kuliah",
  !bacaRekap.baris.some((b) => b.kode.toUpperCase().includes("TOTAL")),
  "baris tanpa nama mata kuliah bukan mata kuliah");
benar("dan alasannya dilaporkan, bukan didiamkan",
  bacaRekap.tolak.some((t) => t.alasan.includes("nama mata kuliah")));

const kosong = bacaKurikulumAcuan([]);
sama("lembar kosong tidak menghasilkan baris", kosong.baris.length, 0);
benar("lembar kosong menjelaskan dirinya", kosong.tolak.length > 0);

const bukanAcuan = bacaKurikulumAcuan([["Nama", "NIM"], ["Andi", "2023"]]);
benar("lembar yang bukan acuan ditolak dengan sebab yang dapat ditindaklanjuti",
  bukanAcuan.tolak.some((t) => t.alasan.includes("KD MATKUL")));

console.log("\n=== PENGGABUNGAN ANTARKONSENTRASI ===\n");

const gab = gabungKonsentrasi(baca.baris);
sama("tiga konsentrasi menjadi satu daftar", gab.baris.length, 3);
sama("baris ganda dihitung", gab.ganda, 6);
sama("tanpa bentrok bila isinya sama", gab.bentrok.length, 0);
benar("urut menurut semester lalu kode",
  gab.baris[0].semester <= gab.baris[1].semester);

// Kode yang sama dengan nama berbeda antarkonsentrasi: hanya manusia yang tahu
// mana yang benar, jadi ia dilaporkan — bukan dipilih diam-diam.
const bedaNama = lembarTiruan();
bedaNama[4][8] = "AIKA Satu";
const gabBeda = gabungKonsentrasi(bacaKurikulumAcuan(bedaNama).baris);
sama("perbedaan isi dilaporkan", gabBeda.bentrok.length, 1);
sama("kode yang bentrok disebut", gabBeda.bentrok[0].kode, "MKU-0201");
benar("kedua versinya ikut disebut", gabBeda.bentrok[0].versi.length === 2);
sama("tetap satu baris yang dikirim", gabBeda.baris.length, 3);

console.log("\n=== PEMERIKSAAN ===\n");

sama("baris sehat tidak bermasalah", periksaBaris(gab.baris).length, 0);
const sksHilang = gab.baris.map((b, i) => (i === 0 ? { ...b, sks: null } : b));
benar("sks yang tidak terbaca ditahan", periksaBaris(sksHilang).some((m) => m.sebab.includes("SKS")));
const sksNol = gab.baris.map((b, i) => (i === 0 ? { ...b, sks: 0 } : b));
benar("sks nol ditahan", periksaBaris(sksNol).some((m) => m.sebab.includes("SKS nol")),
  "mata kuliah nol SKS hampir selalu baris rekap yang lolos");

console.log("\n=== KELUARAN PDDIKTI ===\n");

sama("enam belas kolom", KOLOM_MATKUL.length, 16);
sama("kolom pertama Kode MK", KOLOM_MATKUL[0].judul, "Kode MK");
sama("kolom kedua Nama MK", KOLOM_MATKUL[1].judul, "Nama MK");
sama("kolom keempat SKS Tatap Muka", KOLOM_MATKUL[3].judul, "SKS Tatap Muka");
sama("kolom kesebelas Semester", KOLOM_MATKUL[10].judul, "Semester");
sama("kolom keempat belas Kode Prodi", KOLOM_MATKUL[13].judul, "Kode Prodi");

const keluar = barisKeAoa(gab.baris, { ...OPSI_BAWAAN, tahunKurikulum: "20241", kodeProdi: "70201" });
benar("tiap baris enam belas sel", keluar.every((r) => r.length === 16));

const satu = keluar.find((r) => r[0] === "MKU-0201");
benar("baris AIKA ada", Boolean(satu));
if (satu) {
  sama("Kode MK dari KD MATKUL", satu[0], "MKU-0201");
  sama("Nama MK dari nama mata kuliah", satu[1], "AIKA 1");
  sama("SKS Tatap Muka dari SKS", satu[3], "2");
  sama("Semester dari judul kolom", satu[10], "1");
  sama("Tahun Kurikulum dari setelan", satu[11], "20241");
  sama("Kode Prodi dari setelan", satu[13], "70201");
  // Catatan template menyebut ketiganya wajib diisi dan memerintahkan "Isi 0
  // jika tidak ada". Dikosongkan berarti barisnya ditolak pengimpor.
  sama("SKS Praktek nol, bukan kosong", satu[4], "0");
  sama("SKS Praktek Lapangan nol", satu[5], "0");
  sama("SKS Simulasi nol", satu[6], "0");
}

console.log("");
if (gagal.length === 0) {
  console.log(`${lulus} periksa lulus`);
  console.log("SEMUA UJI LULUS");
} else {
  console.log(`${lulus} periksa lulus`);
  console.log(`\n${gagal.length} GAGAL:`);
  for (const g of gagal) console.log(`  ✗ ${g}`);
  process.exit(1);
}
