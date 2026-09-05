// UJI ARSIP TRANSKRIP NILAI
//
// Yang dijaga di sini satu kalimat: transkrip masuk ke arsip hanya kalau
// memang sudah jadi, dan angka yang tersimpan sama dengan angka yang
// tercetak.
//
// Dua hal yang membuat uji ini ada:
//
//  1. Arsip transkrip ikut dipakai untuk mencetak ulang transkrip resmi.
//     Kalau IPK pada daftar arsip berbeda satu angka di belakang koma dari
//     yang tercetak, yang salah adalah dokumen bertanda tangan Dekan.
//  2. Tombol simpannya dimatikan dengan ALASAN. Aturan yang dipakai layar
//     dan yang dipakai server harus benar-benar satu, supaya tidak ada
//     tombol menyala yang ditolak di seberang — atau sebaliknya.

import {
  MAKS_BARIS, MAKS_TATA_LETAK, bersihkanBaris, bersihkanMeta, bersihkanTataLetak,
  periksaSiapArsip, predikatKelulusan, ringkasTranskrip, sidikTranskrip,
} from "./src/lib/arsip-transkrip";
import { computeTotals, type CourseRow } from "./src/app/dashboard/template/transkrip-parse";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

const mk = (nama: string, hm: string, k: number, kode = "MKK-001"): CourseRow => ({ kode, nama, en: "", hm, k });

const META_LENGKAP = {
  nama: "Mahasiswa Contoh",
  nim: "1900000000",
  prodi: "Ilmu Pemerintahan",
  konsentrasi: "",
  judul: "Judul Skripsi Contoh",
  yudisium: "6 Juli 2026",
};
const BARIS_LENGKAP = [mk("Ilmu Budaya Dasar", "A", 2), mk("Statistik Sosial", "B", 3), mk("Skripsi", "", 6, "MKB-044")];

console.log("\n=== SYARAT MASUK ARSIP ===\n");

// Transkrip kosong tidak pernah boleh masuk arsip: yang tercatat "sudah
// dibuat" tetapi isinya nol justru menyesatkan admin berikutnya.
benar("transkrip kosong ditolak", !periksaSiapArsip(META_LENGKAP, []).siap);
benar("dan alasannya menyebut mata kuliah",
  periksaSiapArsip(META_LENGKAP, []).alasan.toLowerCase().includes("mata kuliah"),
  periksaSiapArsip(META_LENGKAP, []).alasan);

benar("tanpa nama mahasiswa ditolak", !periksaSiapArsip({ ...META_LENGKAP, nama: "" }, BARIS_LENGKAP).siap);
benar("dan alasannya menyebut nama",
  periksaSiapArsip({ ...META_LENGKAP, nama: "  " }, BARIS_LENGKAP).alasan.toLowerCase().includes("nama"));

// NIM adalah kunci arsipnya. Tanpa NIM, transkrip kedua akan menimpa yang
// pertama — persis penyakit yang hendak disembuhkan arsip ini.
benar("tanpa NIM ditolak", !periksaSiapArsip({ ...META_LENGKAP, nim: "" }, BARIS_LENGKAP).siap);
benar("NIM terlalu pendek ditolak", !periksaSiapArsip({ ...META_LENGKAP, nim: "12" }, BARIS_LENGKAP).siap);

const tanpaNama = periksaSiapArsip(META_LENGKAP, [BARIS_LENGKAP[0], mk("", "B", 3)]);
benar("baris tanpa nama mata kuliah ditolak", !tanpaNama.siap);
benar("dan nomor barisnya disebut", tanpaNama.alasan.includes("ke-2"), tanpaNama.alasan);

const tanpaSks = periksaSiapArsip(META_LENGKAP, [BARIS_LENGKAP[0], mk("Metode Penelitian", "B", 0)]);
benar("baris tanpa SKS ditolak", !tanpaSks.siap);
benar("dan nama mata kuliahnya disebut", tanpaSks.alasan.includes("Metode Penelitian"), tanpaSks.alasan);

const siap = periksaSiapArsip(META_LENGKAP, BARIS_LENGKAP);
benar("transkrip lengkap diterima", siap.siap);
sama("dan tidak membawa alasan apa pun", siap.alasan, "");

// Mata kuliah tanpa huruf mutu (Skripsi/Seminar) TETAP sah — SKS-nya dihitung,
// nilainya memang belum ada. Menolaknya berarti tidak ada satu pun transkrip
// kelulusan yang bisa diarsipkan.
benar("mata kuliah tanpa huruf mutu tetap boleh", periksaSiapArsip(META_LENGKAP, [mk("Skripsi", "", 6)]).siap);

console.log("\n=== ANGKA YANG TERSIMPAN = ANGKA YANG TERCETAK ===\n");

const ringkas = ringkasTranskrip(META_LENGKAP, BARIS_LENGKAP);
const total = computeTotals(BARIS_LENGKAP);
sama("total SKS mengikuti perhitungan transkrip", ringkas.sks, total.sks);
sama("total mutu mengikuti perhitungan transkrip", ringkas.mutu, total.mutu);
sama("total SKS menghitung juga MK tanpa nilai huruf", ringkas.sks, 11);
sama("total mutu tidak menghitung MK tanpa nilai huruf", ringkas.mutu, 17);
sama("IPK dibulatkan dua angka", ringkas.ipk, Number((17 / 11).toFixed(2)));
sama("jumlah mata kuliah ikut tercatat", ringkas.jumlahMk, 3);
sama("nama dan NIM ikut tercatat", `${ringkas.nama}|${ringkas.nim}`, "Mahasiswa Contoh|1900000000");
sama("judul skripsi ikut tercatat", ringkas.judul, "Judul Skripsi Contoh");

// Predikat dihitung dari IPK yang SUDAH dibulatkan. Kalau tidak, transkrip
// ber-IPK 3,505 bisa tercetak "Sangat Memuaskan" sementara arsipnya menulis
// "Dengan Pujian".
sama("predikat memakai IPK yang sudah dibulatkan",
  ringkasTranskrip({ nama: "A", nim: "1900000001", judul: "J" }, [mk("A", "A", 2), mk("B", "B", 2)]).predikat,
  predikatKelulusan(3.5, "J"));

sama("IPK 3,51 -> Dengan Pujian", predikatKelulusan(3.51, "J"), "Dengan Pujian");
sama("IPK 3,50 -> Sangat Memuaskan", predikatKelulusan(3.5, "J"), "Sangat Memuaskan");
sama("IPK 3,01 -> Sangat Memuaskan", predikatKelulusan(3.01, "J"), "Sangat Memuaskan");
sama("IPK 2,76 -> Memuaskan", predikatKelulusan(2.76, "J"), "Memuaskan");
sama("IPK rendah tapi berjudul -> Lulus", predikatKelulusan(2.5, "J"), "Lulus");
sama("IPK rendah tanpa judul -> belum lulus", predikatKelulusan(2.5, ""), "—");

console.log("\n=== KIRIMAN PERAMBAN DIBERSIHKAN ===\n");

// Arsip dibaca kembali untuk dicetak. Apa pun yang masuk lewat jaringan
// dirapikan dulu, supaya yang tersimpan hanya baris yang benar-benar
// tercetak di transkrip.
sama("bukan larik -> kosong", bersihkanBaris("bukan larik").length, 0);
sama("baris kosong dibuang", bersihkanBaris([{ nama: "", k: 0 }]).length, 0);
sama("huruf mutu asing dibuang", bersihkanBaris([{ nama: "X", k: 3, hm: "Z" }])[0].hm, "");
sama("huruf mutu kecil tetap dikenali", bersihkanBaris([{ nama: "X", k: 3, hm: "b" }])[0].hm, "B");
sama("SKS raksasa dipangkas", bersihkanBaris([{ nama: "X", k: 999 }])[0].k, 24);
sama("SKS negatif menjadi nol", bersihkanBaris([{ nama: "X", k: -4 }])[0].k, 0);
sama("SKS pecahan dibulatkan", bersihkanBaris([{ nama: "X", k: 2.6 }])[0].k, 3);
benar("jumlah baris dibatasi",
  bersihkanBaris(Array.from({ length: MAKS_BARIS + 40 }, () => ({ nama: "X", k: 2 }))).length === MAKS_BARIS);
// SKS 0 lolos pembersihan (nama masih ada), tetapi tidak lolos syarat simpan.
benar("baris ber-SKS nol tetap tertahan di gerbang simpan",
  !periksaSiapArsip(META_LENGKAP, bersihkanBaris([{ nama: "X", k: -4 }])).siap);

const meta = bersihkanMeta({ nama: "  Andi  Contoh ", nim: "1900000002", "<script>": "x", kosong: "   ", panjang: "y".repeat(900) });
sama("spasi ganda dirapikan", meta.nama, "Andi Contoh");
sama("kunci aneh dibuang", meta["<script>"], undefined);
sama("isian kosong tidak disimpan", meta.kosong, undefined);
sama("isian kepanjangan dipotong", meta.panjang?.length, 600);
sama("bukan objek -> kosong", Object.keys(bersihkanMeta(null)).length, 0);

console.log("\n=== TATA LETAK HASIL SUNTINGAN ===\n");

// Inilah yang dulu hilang: yang tersimpan hanya bentuk bawaan, sedangkan
// suntingan tata letak admin tidak pernah ikut. Sekarang HTML-nya tersimpan —
// dan karena yang tersimpan HTML, ia harus dibersihkan lebih dulu.
sama("bukan teks -> tidak ada tata letak", bersihkanTataLetak(null), "");
sama("HTML kosong -> tidak ada tata letak", bersihkanTataLetak("   "), "");
sama("hanya tag tanpa isi -> tidak ada tata letak", bersihkanTataLetak("<div>  </div>"), "");
benar("isi transkrip dipertahankan",
  bersihkanTataLetak('<div class="doc-title">TRANSKRIP NILAI</div>').includes("TRANSKRIP NILAI"));
benar("gambar tanda tangan dipertahankan",
  bersihkanTataLetak('<img src="data:image/png;base64,AAAA">').includes("data:image/png"));

const disunting = bersihkanTataLetak(
  '<div>Nilai<script>alert(1)</script><img src=x onerror="alert(2)">' +
  '<a href="javascript:alert(3)">tautan</a><iframe src="//jahat"></div>',
);
benar("<script> dibuang", !/script/i.test(disunting), disunting);
benar("onerror dibuang", !/onerror/i.test(disunting), disunting);
benar("javascript: diblokir", !/javascript:/i.test(disunting), disunting);
benar("<iframe> dibuang", !/iframe/i.test(disunting), disunting);
benar("teksnya sendiri tetap ada", disunting.includes("Nilai"), disunting);

const kepanjangan = bersihkanTataLetak("<div>" + "x".repeat(MAKS_TATA_LETAK * 2) + "</div>");
benar("tata letak raksasa dipotong", kepanjangan.length <= MAKS_TATA_LETAK, `${kepanjangan.length}`);

console.log("\n=== TANDA \"BELUM DISIMPAN\" ===\n");

// Inilah yang membuat statusnya jujur: selama satu huruf pun berubah,
// transkrip di layar bukan lagi yang ada di arsip.
const sidikAwal = sidikTranskrip(META_LENGKAP, BARIS_LENGKAP);
sama("isi yang sama menghasilkan tanda yang sama", sidikTranskrip(META_LENGKAP, BARIS_LENGKAP), sidikAwal);
benar("urutan kunci biodata tidak mengubah tanda",
  sidikTranskrip({ nim: META_LENGKAP.nim, nama: META_LENGKAP.nama, prodi: META_LENGKAP.prodi,
    konsentrasi: "", judul: META_LENGKAP.judul, yudisium: META_LENGKAP.yudisium }, BARIS_LENGKAP) === sidikAwal);
benar("satu nilai berubah -> tanda berubah",
  sidikTranskrip(META_LENGKAP, [mk("Ilmu Budaya Dasar", "B", 2), BARIS_LENGKAP[1], BARIS_LENGKAP[2]]) !== sidikAwal);
benar("biodata berubah -> tanda berubah",
  sidikTranskrip({ ...META_LENGKAP, judul: "Judul Lain" }, BARIS_LENGKAP) !== sidikAwal);
benar("baris bertambah -> tanda berubah",
  sidikTranskrip(META_LENGKAP, [...BARIS_LENGKAP, mk("Tambahan", "A", 2)]) !== sidikAwal);

// Tata letak yang baru disunting membuat transkrip di layar berbeda dari yang
// ada di arsip, walau satu angka pun tidak berubah. Kalau tandanya tidak ikut
// berubah, status di sebelah tombol akan berbohong: "sudah tersimpan"
// padahal suntingannya belum pernah dikirim ke mana pun.
benar("tata letak disunting -> tanda berubah",
  sidikTranskrip(META_LENGKAP, BARIS_LENGKAP, "<div>hasil suntingan</div>") !== sidikAwal);
benar("tata letak yang sama -> tanda tetap sama",
  sidikTranskrip(META_LENGKAP, BARIS_LENGKAP, "<div>hasil suntingan</div>") ===
    sidikTranskrip(META_LENGKAP, BARIS_LENGKAP, "<div>hasil suntingan</div>"));
benar("tanpa tata letak sama dengan tata letak kosong",
  sidikTranskrip(META_LENGKAP, BARIS_LENGKAP, "") === sidikAwal);

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
