// ============================================================
// TEMPLATE RUBRIK YANG DAPAT DIUNDUH — Excel dan Word
//
// Dua berkas yang tinggal diisi dosen, lalu diunggah kembali di menu Rubrik.
//
// SATU KEPUTUSAN TATA LETAK YANG MENENTUKAN: lembar yang diisi TIDAK memuat
// contoh, dan contohnya ditaruh di lembar sendiri.
//
// Pada template soal, contoh dan isian boleh duduk di satu tabel — soal yang
// contohnya lupa dihapus hanya menjadi satu soal berlebih yang langsung
// terlihat di daftar. Rubrik lain soal: satu berkas adalah SATU rubrik, jadi
// contoh yang lupa dihapus tidak menjadi rubrik berlebih melainkan bercampur
// ke dalam rubrik yang sedang disusun — "Ketepatan Konsep" milik contoh berdiri
// di antara kriteria dosen sendiri, dengan bobot yang ikut menggeser jumlahnya.
//
// Karena itu: lembar "Rubrik" kosong dan bergaris, lembar "Contoh" berisi
// rubrik yang sudah jadi untuk dilihat, lembar "Petunjuk" berisi aturannya.
// Pembacanya membaca lembar "Rubrik".
// ============================================================
import { buatXlsx, GAYA, hurufKolom, type Baris } from "@/lib/template-xlsx";
import { buatDocx } from "@/lib/template-docx";
import { KOLOM_RUBRIK } from "@/lib/impor-rubrik";
import { RUBRIK_BAWAAN, type Rubrik } from "@/lib/rubrik";

export { KOLOM_RUBRIK };

/** Nama lembar yang dibaca pengimpor. Dipakai bersama sisi peramban. */
export const LEMBAR_RUBRIK = "Rubrik";

/** Rubrik yang dipakai sebagai contoh pada lembar "Contoh". */
const CONTOH = RUBRIK_BAWAAN[1] ?? RUBRIK_BAWAAN[0];

export const PETUNJUK_RUBRIK: string[] = [
  "PETUNJUK PENGISIAN TEMPLATE RUBRIK",
  "",
  "SATU BERKAS = SATU RUBRIK",
  "1. Isi lembar \"Rubrik\". Lembar \"Contoh\" hanya untuk dilihat — isinya tidak dibaca",
  "   saat diunggah, jadi tidak perlu dihapus.",
  "2. Baris NAMA RUBRIK dan KETERANGAN diisi pada kolom sebelahnya (kolom B).",
  "   Baris LEVEL TERTINGGI boleh dibiarkan kosong — lihat butir 5.",
  "",
  "KRITERIA DAN BOBOT",
  "3. Satu kriteria satu baris. Paling banyak 12 kriteria.",
  "4. BOBOT % diisi angka, dan jumlah seluruh kriteria HARUS 100.",
  "   Boleh ditulis \"30\" atau \"30%\" — keduanya dibaca sama.",
  "   Bila seluruh kolom BOBOT dikosongkan, bobotnya dibagi rata sendiri.",
  "",
  "LEVEL",
  "5. LEVEL 1 adalah yang paling rendah, dan angka terbesar yang Anda isi menjadi",
  "   level tertinggi rubriknya. Mengisi LEVEL 1 sampai LEVEL 4 berarti skala 1–4;",
  "   kolom LEVEL 5 dan LEVEL 6 yang dibiarkan kosong tidak dihitung.",
  "6. Isi tiap sel dengan APA YANG MEMBUAT sebuah jawaban berada di level itu,",
  "   bukan dengan angka nilainya. Deskriptor itulah yang dibacakan ketika ada",
  "   mahasiswa menggugat nilainya, dan yang dipakai mesin penilai sebagai acuan.",
  "7. Level paling sedikit 3 tingkat dan paling banyak 6 tingkat. Bila rubrik Anda",
  "   berskala 1–5 tetapi deskriptor level 5 belum ditulis, tulis 5 pada baris",
  "   LEVEL TERTINGGI supaya skalanya tidak terbaca 1–4.",
  "8. Deskriptor yang belum sempat ditulis boleh dikosongkan — rubriknya tetap",
  "   tersimpan, dan kotaknya dapat diisi kapan saja lewat tombol Sunting.",
  "",
  "SESUDAH DIUNGGAH",
  "9. Urutan kolom boleh digeser dan kolom yang tidak dipakai boleh dihapus:",
  "   yang dicari sistem NAMA kolomnya, bukan letaknya.",
  "10. Rubrik yang diunggah TIDAK langsung tersimpan. Ia muncul di formulir",
  "    penyusun supaya Anda periksa dulu, baru tekan \"Simpan rubrik\".",
  "11. Rubrik yang sudah tersimpan dapat diunduh kembali sebagai Excel lewat",
  "    tombol pada daftarnya, disunting di komputer, lalu diunggah lagi.",
];

// ------------------------------------------------------------
// EXCEL
// ------------------------------------------------------------

/** Lebar kolom: kriteria, bobot, lalu enam kolom deskriptor yang lebar. */
const LEBAR = [34, 10, 44, 44, 44, 44, 44, 44];

/**
 * Baris-baris satu lembar rubrik.
 *
 * `isi` menentukan apakah lembarnya berisi rubrik sungguhan (lembar "Contoh",
 * atau hasil unduhan rubrik yang sudah tersimpan) atau kosong dan bergaris
 * (lembar "Rubrik" pada template).
 */
function barisLembar(judul: string, keterangan: string, isi: Rubrik | null, barisKosong: number): Baris[] {
  const kolom = KOLOM_RUBRIK.length;
  const sebaris = (nilai: string, gaya: number): Baris => ({
    tinggi: 22,
    sel: Array.from({ length: kolom }, (_, i) => ({ nilai: i === 0 ? nilai : "", gaya })),
  });

  const kriteria = isi?.kriteria ?? [];
  const gayaIsi = isi ? GAYA.contoh : GAYA.isi;
  const gayaTengah = isi ? GAYA.contohTengah : GAYA.isiTengah;

  return [
    { tinggi: 30, sel: Array.from({ length: kolom }, (_, i) => ({ nilai: i === 0 ? judul : "", gaya: GAYA.judul })) },
    { tinggi: 20, sel: Array.from({ length: kolom }, (_, i) => ({ nilai: i === 0 ? keterangan : "", gaya: GAYA.anak })) },

    // Dua keterangan rubrik, berlabel di kolom A dan bernilai di kolom B.
    // Pembacanya mencari labelnya, bukan barisnya, jadi keduanya boleh
    // dipindahkan dosen ke mana pun di dalam lembar ini.
    {
      sel: Array.from({ length: kolom }, (_, i) => ({
        nilai: i === 0 ? "NAMA RUBRIK" : i === 1 ? (isi?.nama ?? "") : "",
        gaya: i === 0 ? GAYA.petunjukTebal : gayaIsi,
      })),
    },
    {
      sel: Array.from({ length: kolom }, (_, i) => ({
        nilai: i === 0 ? "KETERANGAN" : i === 1 ? (isi?.keterangan ?? "") : "",
        gaya: i === 0 ? GAYA.petunjukTebal : gayaIsi,
      })),
    },
    // Boleh dikosongkan pada template: bila kosong, levelnya dihitung dari
    // kolom LEVEL yang terisi. Yang mengisinya adalah unduhan rubrik yang sudah
    // tersimpan — supaya rubrik berskala 1–5 yang level 5-nya belum ditulis
    // deskriptornya tidak turun menjadi 1–4 saat berkasnya diunggah kembali.
    {
      sel: Array.from({ length: kolom }, (_, i) => ({
        nilai: i === 0 ? "LEVEL TERTINGGI" : i === 1 ? (isi ? isi.skalaMax : "") : "",
        gaya: i === 0 ? GAYA.petunjukTebal : gayaTengah,
      })),
    },
    sebaris("", GAYA.biasa),

    { tinggi: 34, sel: KOLOM_RUBRIK.map((k) => ({ nilai: k, gaya: GAYA.kepala })) },

    ...kriteria.map((k) => ({
      tinggi: 58,
      sel: KOLOM_RUBRIK.map((_, i) => {
        if (i === 0) return { nilai: k.nama, gaya: gayaIsi };
        if (i === 1) return { nilai: k.bobot, gaya: gayaTengah };
        const level = k.levels.find((l) => l.level === i - 1);
        return { nilai: level?.deskriptor ?? "", gaya: gayaIsi };
      }),
    })),

    // Baris kosong yang sudah bergaris: dosen mengetik ke dalam tabel, bukan
    // ke ruang kosong di bawahnya — dan yang mengetik di luar tabel sering
    // mengira isiannya ikut terbaca.
    ...Array.from({ length: barisKosong }, () => ({
      tinggi: 44,
      sel: KOLOM_RUBRIK.map((_, i) => ({ nilai: "", gaya: i === 1 ? gayaTengah : gayaIsi })),
    })),
  ];
}

function lembarPetunjuk(): Baris[] {
  return [
    { tinggi: 30, sel: [{ nilai: PETUNJUK_RUBRIK[0], gaya: GAYA.petunjukJudul }] },
    { sel: [{ nilai: "", gaya: GAYA.petunjukIsi }] },
    ...PETUNJUK_RUBRIK.slice(2).map((p) => ({
      // Judul bagian ditulis huruf besar seluruhnya; itu yang membedakannya
      // dari butir biasa, tanpa perlu penanda lain di dalam naskahnya.
      sel: [{ nilai: p, gaya: /^[A-Z0-9 =]+$/.test(p) && p.trim() !== "" ? GAYA.petunjukTebal : GAYA.petunjukIsi }],
    })),
  ];
}

/**
 * Template rubrik kosong, beserta lembar contoh dan petunjuknya.
 *
 * Lembar pertama yang terbuka adalah lembar yang harus diisi — bukan
 * petunjuknya. Template yang membuka petunjuk lebih dahulu membuat separuh
 * orang menutupnya sebelum menemukan tempat mengisi.
 */
export function buatXlsxRubrik(): Blob {
  const kolomTerakhir = hurufKolom(KOLOM_RUBRIK.length);
  return buatXlsx([
    {
      nama: LEMBAR_RUBRIK,
      baris: barisLembar(
        "TEMPLATE RUBRIK PENILAIAN ESAI",
        "Isi lembar ini. Lihat lembar \"Contoh\" bila ragu bentuknya, dan lembar \"Petunjuk\" untuk aturannya.",
        null,
        8,
      ),
      lebar: LEBAR,
      beku: 7,
      gabung: [`A1:${kolomTerakhir}1`, `A2:${kolomTerakhir}2`],
    },
    {
      nama: "Contoh",
      baris: barisLembar(
        "CONTOH — HANYA UNTUK DILIHAT",
        "Lembar ini tidak dibaca saat diunggah. Yang dibaca lembar \"Rubrik\".",
        CONTOH,
        0,
      ),
      lebar: LEBAR,
      beku: 7,
      gabung: [`A1:${kolomTerakhir}1`, `A2:${kolomTerakhir}2`],
    },
    { nama: "Petunjuk", baris: lembarPetunjuk(), lebar: [104], gabung: ["A1:A1"] },
  ]);
}

/**
 * Rubrik yang sudah tersimpan, diturunkan menjadi Excel.
 *
 * Bentuknya sama dengan template, jadi berkas ini dapat disunting di komputer
 * lalu diunggah kembali. Itu yang membuat rubrik dapat dititipkan ke rekan
 * pengajar lewat surel tanpa seorang pun perlu membuka portal.
 */
export function buatXlsxDariRubrik(rubrik: Rubrik): Blob {
  const kolomTerakhir = hurufKolom(KOLOM_RUBRIK.length);
  return buatXlsx([
    {
      nama: LEMBAR_RUBRIK,
      baris: barisLembar(
        rubrik.nama || "RUBRIK PENILAIAN ESAI",
        `Skala 1–${rubrik.skalaMax} · ${rubrik.kriteria.length} kriteria. Sunting lalu unggah kembali di menu Rubrik.`,
        rubrik,
        4,
      ),
      lebar: LEBAR,
      beku: 7,
      gabung: [`A1:${kolomTerakhir}1`, `A2:${kolomTerakhir}2`],
    },
    { nama: "Petunjuk", baris: lembarPetunjuk(), lebar: [104], gabung: ["A1:A1"] },
  ]);
}

// ------------------------------------------------------------
// WORD
// ------------------------------------------------------------

/**
 * Naskah template Word.
 *
 * Berlabel per baris, BUKAN tabel — dan itu bukan kemalasan. Pembaca .docx
 * portal mengambil teksnya saja; sebuah tabel Word kehilangan susunan
 * kolomnya begitu teksnya diambil, sehingga "mana kolom level 2" tidak lagi
 * dapat dipastikan. Rubrik yang salah kolom lebih berbahaya daripada rubrik
 * yang ditolak: angkanya tetap keluar, hanya artinya yang bergeser.
 *
 * Contohnya ditulis lengkap sebagai isi yang siap DIGANTI — satu berkas satu
 * rubrik, jadi mengganti isi jauh lebih wajar daripada menghapus contoh lalu
 * menulis dari nol.
 */
export function naskahWordRubrik(isi: Rubrik = CONTOH): string[] {
  const baris: string[] = [
    "TEMPLATE RUBRIK PENILAIAN ESAI",
    "",
    "Ganti isi di bawah dengan rubrik Anda sendiri, lalu unggah berkas ini di",
    "dashboard CBT → Rubrik → Unggah rubrik.",
    "",
    "Aturannya singkat:",
    "- Tiap kriteria diawali baris KRITERIA:, lalu BOBOT:, lalu LEVEL 1: dan seterusnya.",
    "- Jumlah seluruh BOBOT harus 100. Bila seluruhnya dikosongkan, dibagi rata sendiri.",
    "- Angka LEVEL terbesar yang Anda tulis menjadi level tertinggi rubriknya (3 sampai 6).",
    "- Deskriptor panjang boleh dilanjutkan pada baris berikutnya tanpa label.",
    "- Satu berkas berisi SATU rubrik.",
    "",
    "===============================",
    "",
    `NAMA RUBRIK: ${isi.nama}`,
    `KETERANGAN: ${isi.keterangan}`,
    `LEVEL TERTINGGI: ${isi.skalaMax}`,
    "",
  ];

  for (const k of isi.kriteria) {
    baris.push(`KRITERIA: ${k.nama}`);
    baris.push(`BOBOT: ${k.bobot}`);
    for (const l of k.levels) {
      baris.push(`LEVEL ${l.level}: ${l.deskriptor}`);
    }
    baris.push("");
  }

  return baris;
}

export function buatDocxRubrik(isi: Rubrik = CONTOH): Blob {
  return buatDocx(naskahWordRubrik(isi));
}
