// ============================================================
// UJI: lembar cetak CBT
//
// Satu hal di berkas ini lebih penting daripada semua yang lain: NASKAH YANG
// DIBAGIKAN KE PESERTA TIDAK BOLEH MEMUAT KUNCI JAWABAN. Naskah cadangan
// yang tercetak beserta kuncinya lalu dibagikan adalah cara tercepat
// menggagalkan ujian, dan kekeliruannya tidak akan terlihat sampai sudah
// terlambat.
// ============================================================
import { readFileSync } from "node:fs";
import { MEDIA_KOSONG } from "./src/lib/cbt";
import {
  beritaAcaraHtml, laporanPesertaHtml, lolos, naskahSoalHtml,
  type SoalCetak, type UjianCetak,
} from "./src/lib/cetak-cbt";

let lulus = 0;
let gagal = 0;
function cek(nama: string, syarat: boolean, ket = "") {
  if (syarat) { lulus += 1; console.log(`  ok    ${nama}`); }
  else { gagal += 1; console.log(`  GAGAL ${nama}${ket ? " — " + ket : ""}`); }
}
function bagian(j: string) { console.log(`\n== ${j} ==`); }

const ujian: UjianCetak = {
  judul: "UTS Komunikasi Politik", mataKuliah: "Komunikasi Politik", kelas: "4A",
  kode: "K7M2QX", durasi: 90, jumlahSoal: 5,
  instruksi: "Kerjakan sendiri. Tidak boleh membuka catatan.",
  mulai: "2026-09-10T02:00:00.000Z", selesai: "2026-09-10T03:30:00.000Z",
};

const soal: SoalCetak[] = [
  { id: 1, jenis: "pg", pertanyaan: "Siapa perumus teori agenda setting?",
    pilihan: ["McCombs & Shaw", "Lasswell", "Habermas", "Gerbner"],
    kunci: "0", pasangan: [], media: MEDIA_KOSONG, bobot: 5, pembahasan: "Dirumuskan 1972." },
  { id: 2, jenis: "pg_kompleks", pertanyaan: "Mana saja teori komunikasi massa?",
    pilihan: ["Agenda setting", "Kultivasi", "Fotosintesis", "Spiral of silence"],
    kunci: "0,1,3", pasangan: [], media: MEDIA_KOSONG, bobot: 9 },
  { id: 3, jenis: "penjodohan", pertanyaan: "Jodohkan teori dan perumusnya.",
    pilihan: ["McCombs & Shaw", "Noelle-Neumann", "Gerbner", "Lasswell"],
    kunci: "",
    pasangan: [{ kiri: "Agenda setting", kanan: 0 }, { kiri: "Spiral of silence", kanan: 1 }],
    media: MEDIA_KOSONG, bobot: 6 },
  // Kuncinya sengaja diberi penanda yang MUSTAHIL muncul pada pertanyaan mana
  // pun. Memakai kata yang wajar — "agenda setting" — membuat ujian kebocoran
  // di bawah lulus palsu, karena frasa itu memang ada pada pertanyaan lain.
  { id: 4, jenis: "isian", pertanyaan: "Sebutkan istilah pengaturan agenda oleh media.",
    pilihan: [], kunci: "KUNCIRAHASIAISIAN", pasangan: [], media: MEDIA_KOSONG, bobot: 5 },
  { id: 5, jenis: "essay", pertanyaan: "Jelaskan peran media dalam kampanye politik.",
    pilihan: [], kunci: "", pasangan: [], bobot: 20,
    media: { jenis: "gambar", url: "https://x.test/poster.png", keterangan: "Poster kampanye" },
    pembahasan: "Sebutkan minimal tiga peran." },
];

// ---------- YANG PALING PENTING ----------
bagian("Naskah peserta TIDAK boleh membocorkan kunci");
const naskah = naskahSoalHtml(ujian, soal);

cek("kunci isian tidak tercetak", !naskah.includes("KUNCIRAHASIAISIAN"),
    naskah.includes("KUNCIRAHASIAISIAN") ? "TERBACA DI NASKAH" : "");
cek("tidak ada penanda kunci ✓", !naskah.includes("✓"));
cek('tidak ada kata "Kunci:"', !naskah.includes("Kunci:"));
cek("rambu penilaian essay tidak tercetak", !naskah.includes("Sebutkan minimal tiga peran"));
cek("pembahasan tidak tercetak", !naskah.includes("Dirumuskan 1972"));
cek("jawaban penjodohan tidak dipasangkan",
    !/Agenda setting<\/td><td><span class="kunci"/.test(naskah));
cek("kolom penjodohan dikosongkan untuk diisi", naskah.includes("…………"));

bagian("Naskah itu tetap berisi soalnya");
cek("seluruh pertanyaan ada", soal.every((s) => naskah.includes(lolos(s.pertanyaan))));
cek("pilihan ganda tercetak berhuruf", naskah.includes("A. McCombs &amp; Shaw"));
cek("pilihan penjodohan tetap ditawarkan", naskah.includes("D. Lasswell"));
cek("PG kompleks diberi keterangan jawaban jamak", naskah.includes("Jawaban boleh lebih dari satu"));
cek("essay diberi ruang menulis", (naskah.match(/class="garis"/g) || []).length >= 6);
cek("soal bermedia ditandai tidak tercetak", naskah.includes("tidak tercetak"));
cek("ada tempat nama dan nomor peserta",
  naskah.includes("Nama") && naskah.includes("Nomor Peserta"));
cek("instruksi pengajar ikut", naskah.includes("Tidak boleh membuka catatan"));
cek("total bobot dihitung", naskah.includes("45 poin"), "harusnya 5+9+6+5+20");

bagian("Berkas pengawas memang membawa kunci");
const naskahKunci = naskahSoalHtml(ujian, soal, { denganKunci: true });
cek("kunci isian tercetak", naskahKunci.includes("KUNCIRAHASIAISIAN"));
cek("kunci pilihan ganda ditandai", naskahKunci.includes("A. McCombs &amp; Shaw ✓"));
cek("PG kompleks menandai TIGA kunci",
    (naskahKunci.match(/✓/g) || []).length >= 4, String((naskahKunci.match(/✓/g) || []).length));
cek("pasangan penjodohan terisi", naskahKunci.includes("Noelle-Neumann"));
cek("rambu penilaian essay ikut", naskahKunci.includes("Sebutkan minimal tiga peran"));
cek("diberi peringatan jangan dibagikan", naskahKunci.includes("JANGAN DIBAGIKAN"));

// ---------- KESELAMATAN HTML ----------
bagian("Teks pengajar tidak boleh merusak halaman cetak");
cek("tanda & diloloskan", lolos("McCombs & Shaw") === "McCombs &amp; Shaw");
cek("tanda kurung siku diloloskan", lolos("<script>") === "&lt;script&gt;");
const jahat = naskahSoalHtml(ujian, [{
  ...soal[0], pertanyaan: '<img src=x onerror="alert(1)">Berapa 2 < 3 & 4 > 1?',
  pilihan: ['</li><script>alert(2)</script>', "B"],
}]);
cek("tanda kurung dari soal tidak menjadi unsur HTML", !jahat.includes("<img src=x"));
cek("skrip dari pilihan tidak menjadi unsur HTML", !jahat.includes("<script>alert(2)"));
cek("isinya tetap terbaca sebagai teks", jahat.includes("Berapa 2 &lt; 3 &amp; 4 &gt; 1?"));

// ---------- BERITA ACARA ----------
bagian("Berita acara");
const acara = beritaAcaraHtml(ujian, {
  pengawas: "Dr. Ayu", ruang: "Lab Komputer 2",
  hadir: 28, terdaftar: 30, selesai: 19, berjalan: 9, pelanggaran: 24,
  catatan: "Listrik sempat padam 5 menit pada pukul 09.20.",
  peserta: [
    { nim: "111", nama: "Budi", status: "selesai", pindahTab: 3, keluarFullscreen: 1 },
    { nim: "222", nama: "Citra", status: "selesai", pindahTab: 0, keluarFullscreen: 0 },
  ],
});
cek("menyebut pengawas", acara.includes("Dr. Ayu"));
cek("menyebut ruang", acara.includes("Lab Komputer 2"));
cek("angka kehadiran tercetak", acara.includes("28 orang"));
cek("hanya yang melanggar yang didaftar", acara.includes("Budi") && !acara.includes(">Citra<"));
cek("jumlah pelanggaran per orang tercetak", acara.includes("3×"));
cek("catatan pengawas ikut", acara.includes("Listrik sempat padam"));
cek("ada blok tanda tangan", acara.includes("Pengawas Ujian"));
cek("menegaskan catatan sistem bukan putusan", acara.includes("bukan putusan"));

// Sejak menempel, menyalin, dan menekan tombol tangkapan layar ikut tercatat,
// menyaring hanya dengan dua kolom lama akan menghasilkan berita acara yang
// menyatakan "tidak ada pelanggaran" pada ujian yang jawabannya ditempel
// delapan kali — dan dokumen itu ditandatangani pengawas.
const acara2 = beritaAcaraHtml(ujian, {
  pengawas: "Dr. Ayu", ruang: "Daring",
  hadir: 3, terdaftar: 3, selesai: 3, berjalan: 0, pelanggaran: 2,
  catatan: "",
  peserta: [
    // Tidak pernah pindah tab, tetapi menempel jawaban berkali-kali.
    { nim: "333", nama: "Dewi", status: "selesai", pindahTab: 0, keluarFullscreen: 0, integritas: 50 },
    // Bersih betul.
    { nim: "444", nama: "Eka", status: "selesai", pindahTab: 0, keluarFullscreen: 0, integritas: 100 },
    // Dihentikan pengawasan.
    {
      nim: "555", nama: "Fajar", status: "waktu_habis", pindahTab: 5, keluarFullscreen: 0,
      integritas: 20, dihentikan: "Dihentikan pengawasan: tab melampaui batas.",
    },
  ],
});
cek("yang menempel tanpa pindah tab tetap terdaftar", acara2.includes("Dewi"));
cek("yang bersih tetap tidak terdaftar", !acara2.includes(">Eka<"));
cek("skor integritas tercetak", acara2.includes("50/100"));
cek("sebab pemutusan ikut tercetak", acara2.includes("melampaui batas"));
// Yang paling perlu dibaca harus berada di baris pertama: berita acara dibaca
// dari atas, dan baris kedua puluh jarang sampai terbaca.
cek("diurutkan dari yang paling rendah skornya",
  acara2.indexOf("Fajar") < acara2.indexOf("Dewi"));
cek("menegaskan skor bukan nilai ujian", acara2.includes("BUKAN nilai ujian"));

// Ujian lama, dari sebelum pengawasan ada, tidak punya skor sama sekali.
// Ia tidak boleh dianggap bersih maupun dianggap melanggar.
const acara3 = beritaAcaraHtml(ujian, {
  pengawas: "", ruang: "", hadir: 1, terdaftar: 1, selesai: 1, berjalan: 0,
  pelanggaran: 0, catatan: "",
  peserta: [{ nim: "666", nama: "Gita", status: "selesai", pindahTab: 0, keluarFullscreen: 0 }],
});
cek("peserta lama tanpa skor tidak didaftar sebagai pelanggar",
  acara3.includes("Tidak ada pelanggaran"));

const acaraBersih = beritaAcaraHtml(ujian, {
  pengawas: "", ruang: "", hadir: 5, terdaftar: 5, selesai: 5, berjalan: 0, pelanggaran: 0,
  catatan: "", peserta: [{ nim: "1", nama: "A", status: "selesai", pindahTab: 0, keluarFullscreen: 0 }],
});
cek("tanpa pelanggaran dinyatakan tegas", acaraBersih.includes("Tidak ada pelanggaran"));
cek("moda daring jadi bawaan bila ruang kosong", acaraBersih.includes("Daring"));

// ---------- LAPORAN PER PESERTA ----------
bagian("Laporan per peserta");
const laporan = laporanPesertaHtml(ujian, {
  nim: "1234567", nama: "Dewi Lestari", nilai: 78, benar: 3, salah: 1, sebagian: 1,
  kosong: 0, tertunda: 1, mulai: "2026-09-10T02:05:00.000Z", kumpul: "2026-09-10T03:10:00.000Z",
  pindahTab: 2, keluarFullscreen: 0,
}, [
  { nomor: 1, jenis: "pg", pertanyaan: "Siapa perumus agenda setting?", jawabanTeks: "McCombs & Shaw",
    benar: true, poin: 5, bobot: 5 },
  { nomor: 2, jenis: "pg_kompleks", pertanyaan: "Mana saja teori komunikasi massa?", jawabanTeks: "A, B",
    benar: false, poin: 6, bobot: 9 },
  { nomor: 3, jenis: "essay", pertanyaan: "Jelaskan peran media.", jawabanTeks: "Media membentuk agenda.",
    benar: null, poin: 0, bobot: 20, catatan: "Perlu contoh kasus." },
], 70);

cek("nama dan NOMOR PESERTA tercetak", laporan.includes("Dewi Lestari") && laporan.includes("1234567"));
cek("nilai akhir tercetak", laporan.includes("78"));
cek("status kelulusan dinyatakan", laporan.includes("LULUS"));
cek("benar sebagian dihitung terpisah", laporan.includes("Benar sebagian"));
cek("yang benar sebagian tidak dicap salah", laporan.includes("benar sebagian"));
cek("essay yang belum dikoreksi dinyatakan", laporan.includes("menunggu koreksi"));
cek("catatan pengajar ikut", laporan.includes("Perlu contoh kasus"));
cek("catatan sistem tercetak", laporan.includes("Pindah tab 2×"));
cek("ampersand jawaban diloloskan", laporan.includes("McCombs &amp; Shaw"));

const belum = laporanPesertaHtml(ujian, {
  nim: "1", nama: "X", nilai: null, benar: 0, salah: 0, kosong: 0, tertunda: 3,
  mulai: "2026-09-10T02:00:00.000Z", kumpul: null, pindahTab: 0, keluarFullscreen: 0,
}, [], 70);
cek("nilai kosong tidak jadi angka palsu", belum.includes("belum dinilai"));
cek("tanpa pelanggaran, bagian catatan sistem tidak muncul", !belum.includes("Catatan sistem"));

bagian("Bentuk berkasnya");
for (const [nama, html] of [["naskah", naskah], ["berita acara", acara], ["laporan", laporan]] as const) {
  cek(`${nama}: dokumen HTML utuh`, html.startsWith("<!DOCTYPE html>") && html.endsWith("</html>"));
  cek(`${nama}: ada tombol cetak yang hilang saat dicetak`,
      html.includes("sembunyi-cetak") && html.includes("window.print()"));
  cek(`${nama}: ukuran kertas A4`, html.includes("size: A4"));
}

bagian("Tidak terikat satu lembaga");

// CBT ini satu produk yang sama untuk siapa pun yang memasangnya. Nama lembaga
// mana pun yang tertanam di dalam kodenya akan ikut tercetak pada naskah soal
// dan berita acara orang lain — dokumen yang ditandatangani, dan yang paling
// tidak boleh membawa nama yang salah.
// KELIMA bentuk berkasnya, bukan dua. Naskah peserta dan naskah pengawas
// berbeda isinya — blok "Nama / NIM / Tanda Tangan" hanya tercetak pada yang
// TANPA kunci — dan tabel pelanggaran berita acara hanya muncul bila memang
// ada yang melanggar. Menguji sebagiannya saja membuat penjaga di bawah lulus
// tanpa pernah melihat baris yang justru paling perlu dijaga.
const semuaBerkas = [
  naskahSoalHtml(ujian, soal),
  naskahSoalHtml(ujian, soal, { denganKunci: true }),
  beritaAcaraHtml(ujian, {
    pengawas: "Dr. Ayu", ruang: "Daring", hadir: 1, terdaftar: 1, selesai: 1,
    berjalan: 0, pelanggaran: 0, catatan: "",
    peserta: [{ nim: "1", nama: "A", status: "selesai", pindahTab: 0, keluarFullscreen: 0 }],
  }),
  beritaAcaraHtml(ujian, {
    pengawas: "Dr. Ayu", ruang: "Daring", hadir: 1, terdaftar: 1, selesai: 1,
    berjalan: 0, pelanggaran: 1, catatan: "",
    peserta: [{ nim: "2", nama: "B", status: "selesai", pindahTab: 4, keluarFullscreen: 1, integritas: 60 }],
  }),
  laporanPesertaHtml(ujian, {
    nim: "3", nama: "C", nilai: 80, benar: 4, salah: 1, kosong: 0, tertunda: 0,
    mulai: "2026-09-10T02:00:00.000Z", kumpul: "2026-09-10T03:00:00.000Z",
    pindahTab: 0, keluarFullscreen: 0,
  }, [], 60),
].join("\n");
for (const jenama of ["FISIP", "Fakultas Ilmu Sosial", "ILMU POLITIK", "SiPaling FISIP"]) {
  cek(`tidak menyebut "${jenama}"`, !semuaBerkas.toUpperCase().includes(jenama.toUpperCase()));
}
// Kosakata perguruan tinggi ikut dijaga, tetapi aturannya BUKAN "jangan pernah
// dipakai" melainkan "jangan dipakai sendirian". Label berpasangan justru yang
// paling terbaca: yang dari kampus mengenali kata pertama, yang dari sekolah
// dan lembaga sertifikasi mengenali kata kedua. Yang berbahaya kata kampusnya
// berdiri sendiri — di situlah pembaca yang bukan dari kampus tertinggal, dan
// berkas ini dokumen yang ditandatangani orang.
//
// Daftar kata di bawah pernah ikut tersapu penggantian kosakata dan berhenti
// menjaga apa pun tanpa satu uji pun gagal. Karena itu ada pemeriksaan
// terakhir di bawahnya: kalau bentuk berpasangannya TIDAK ada sama sekali di
// berkas cetak, penjaganya sendiri yang sedang rusak.
const PASANGAN: Array<[string, RegExp]> = [
  ["Mahasiswa", /Mahasiswa\s*\/\s*Peserta/],
  ["NIM", /NIM\s*\/\s*(Nomor Peserta|No\.)/],
  ["Dosen", /Dosen\s*\/\s*Pengajar/],
  ["Mata Kuliah", /Mata Kuliah\s*\/\s*Materi/],
];
for (const [kata, pasangan] of PASANGAN) {
  const munculan = semuaBerkas.split(kata).length - 1;
  const berpasangan = (semuaBerkas.match(new RegExp(pasangan.source, "g")) || []).length;
  cek(`"${kata}" tidak pernah berdiri sendiri`, munculan === berpasangan,
    `${munculan} kali muncul, ${berpasangan} di antaranya berpasangan`);
}
cek("penjaganya sendiri masih hidup: label berpasangan memang ada di berkas cetak",
  /NIM\s*\/\s*(Nomor Peserta|No\.)/.test(semuaBerkas)
  && /Mata Kuliah\s*\/\s*Materi/.test(semuaBerkas));
// Yang menggantikannya bukan kekosongan: kop tetap menyebut mata ujinya,
// sehingga berkasnya tetap dapat dikenali milik ujian yang mana.
cek("kop menyebut mata ujinya", semuaBerkas.includes("Komunikasi Politik"));

// Dan yang memasangnya untuk ujian sungguhan tetap dapat menaruh namanya
// sendiri — lewat pengaturan, bukan lewat kode.
cek("nama penyelenggara dapat diatur dari environment",
  /NEXT_PUBLIC_CBT_PENYELENGGARA/.test(
    readFileSync("./src/lib/cetak-cbt.ts", "utf8"),
  ));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
