// ============================================================
// TEMPLATE SOAL YANG DAPAT DIUNDUH — Excel dan Word
//
// Dua berkas kosong yang tinggal diisi pengajar. Isinya sengaja memuat contoh
// yang sudah benar pada baris pertama: template kosong melulu membuat orang
// menebak-nebak bentuknya, dan tebakannya ditolak saat diunggah.
//
// Berkas .docx dirakit sendiri, bukan lewat pustaka penulis Word: perakitnya
// ada di src/lib/template-docx.ts dan dipakai bersama template rubrik.
// ============================================================
import { buatXlsx, GAYA, hurufKolom, type Baris } from "@/lib/template-xlsx";
import { MIME_DOCX, buatDocx } from "@/lib/template-docx";
import { KOLOM_EXCEL } from "@/lib/impor-soal";

export { KOLOM_EXCEL, MIME_DOCX };

/**
 * Template soal dalam bentuk Word.
 *
 * Perakit .docx-nya sendiri tinggal di src/lib/template-docx.ts, dipakai
 * bersama template rubrik. Yang tinggal di sini hanya naskahnya.
 */
export function buatDocxTemplate(baris: string[] = NASKAH_WORD): Blob {
  return buatDocx(baris);
}

/**
 * Satu contoh untuk TIAP jenis soal, dan semuanya sudah benar.
 *
 * Urutan selnya mengikuti KOLOM_EXCEL persis. Menyisipkan satu kolom di sana
 * tanpa menggeser baris-baris ini akan membuat seluruh contoh salah kolom —
 * dan salahnya senyap: berkasnya tetap terbuka, hanya isinya yang bergeser.
 */
export const CONTOH_EXCEL: Array<Array<string | number>> = [
  //  NO JENIS          PERTANYAAN                     A                  B                 C            D          E    KUNCI                              PASANGAN                                            MEDIA                                BOBOT MATERI               TINGKAT   PEMBAHASAN
  [1, "PG", "Ibu kota Indonesia adalah?", "Jakarta", "Bandung", "Surabaya", "Medan", "", "A", "", "", 5, "Pengetahuan Umum", "mudah", "Contoh soal pilihan ganda berkunci tunggal."],
  [2, "PG KOMPLEKS", "Manakah yang termasuk bilangan prima? (jawaban boleh lebih dari satu)", "2", "9", "7", "13", "", "A,C,D", "", "", 9, "Pengetahuan Umum", "sedang", "Dinilai per bagian; yang keliru mengurangi yang tepat."],
  [3, "PENJODOHAN", "Jodohkan negara berikut dengan ibu kotanya.", "Kuala Lumpur", "", "", "", "", "", "Jepang = Tokyo\nMesir = Kairo\nBrasil = Brasilia", "", 6, "Pengetahuan Umum", "sedang", "Kolom PILIHAN diisi pengecoh yang tidak berpasangan."],
  [4, "BENAR-SALAH", "Air mendidih pada suhu 100 derajat Celsius di permukaan laut.", "Benar", "Salah", "", "", "", "BENAR", "", "", 5, "Pengetahuan Umum", "mudah", ""],
  [5, "ISIAN", "Planet terdekat dari Matahari adalah?", "", "", "", "", "", "merkurius|mercury", "", "", 5, "Pengetahuan Umum", "sedang", "Beberapa kemungkinan jawaban dipisah tanda |"],
  [6, "ESSAY", "Jelaskan manfaat energi terbarukan bagi lingkungan.", "", "", "", "", "", "", "", "https://contoh.test/gambar-soal.jpg", 20, "Pengetahuan Umum", "sulit", "Kolom MEDIA boleh diisi tautan gambar atau video."],
];

export const PETUNJUK_EXCEL: string[][] = [
  ["PETUNJUK PENGISIAN TEMPLATE SOAL"],
  [""],
  ["1. Isi mulai baris di bawah judul kolom pada sheet \"Soal\". Hapus 6 baris contoh, lalu isi soal asli."],
  ["2. Kolom JENIS diisi salah satu:"],
  ["   PG · PG KOMPLEKS · PENJODOHAN · BENAR-SALAH · ISIAN · ESSAY. Kosong dianggap PG."],
  [""],
  ["JENIS SOAL"],
  ["3. PG → isi PILIHAN A sampai E seperlunya, KUNCI ditulis hurufnya (A/B/C/D/E)."],
  ["4. PG KOMPLEKS → jawaban benar boleh lebih dari satu. KUNCI ditulis dipisah koma: A,C"],
  ["   Dinilai per bagian, dan yang keliru MENGURANGI yang tepat, jadi mencentang semua"],
  ["   pilihan tidak menghasilkan nilai penuh. Sisakan minimal satu pengecoh."],
  ["5. PENJODOHAN → kolom PASANGAN diisi satu pasangan per baris, dipisah tanda ="],
  ["      Jepang = Tokyo"],
  ["      Mesir = Kairo"],
  ["   Kolom kanan otomatis menjadi daftar jawaban dan diacak untuk peserta."],
  ["   Kolom PILIHAN A-E boleh diisi PENGECOH yang tidak berpasangan dengan apa pun."],
  ["   Dinilai per pasangan: satu kekeliruan tidak menghapus jawaban yang sudah benar."],
  ["6. BENAR-SALAH → pilihan boleh dikosongkan, KUNCI ditulis BENAR atau SALAH."],
  ["7. ISIAN → pilihan dikosongkan, KUNCI berisi jawabannya."],
  ["   Beberapa kemungkinan jawaban dipisah tanda | misalnya: merkurius|mercury"],
  ["8. ESSAY → pilihan dan KUNCI dikosongkan. Dikoreksi pengajar setelah ujian selesai."],
  [""],
  ["MEDIA, BOBOT, DAN LAIN-LAIN"],
  ["9. MEDIA diisi tautan gambar atau video, dan boleh dikosongkan."],
  ["   Gambar: tautan langsung ke berkas .jpg / .png / .webp"],
  ["   Video : tautan YouTube, Google Drive, atau berkas .mp4"],
  ["   Jenisnya ditebak sendiri dari tautannya. Berkas dari komputer diunggah lewat"],
  ["   tombol Unggah di penyunting soal, bukan lewat berkas ini."],
  ["10. BOBOT diisi angka. Nilai akhir dihitung dari jumlah bobot, bukan jumlah soal,"],
  ["    jadi soal essay boleh diberi bobot lebih besar daripada pilihan ganda."],
  ["11. TINGKAT diisi mudah / sedang / sulit. Kosong dianggap sedang."],
  ["12. Urutan kolom boleh digeser dan kolom yang tidak dipakai boleh dihapus,"],
  ["    yang dicari sistem NAMA kolomnya, bukan letaknya."],
  ["13. Simpan berkas, lalu unggah lewat tombol \"Unggah soal\" di dashboard CBT."],
  [""],
  ["Satu baris yang bermasalah TIDAK menggagalkan seluruh berkas: yang sah tetap masuk,"],
  ["dan yang ditolak ditampilkan beserta nomor barisnya supaya tinggal diperbaiki."],
];

// ---------- WORD ----------

const NASKAH_WORD = [
  "TEMPLATE SOAL UJIAN",
  "",
  "Tulis soal langsung di bawah ini. Tiap soal diawali nomor, lalu pilihan berhuruf,",
  "lalu baris KUNCI. Baris BOBOT, MATERI, TINGKAT, dan PEMBAHASAN boleh dikosongkan.",
  "Hapus empat contoh di bawah, lalu tulis soal Anda sendiri.",
  "",
  "1. Ibu kota Indonesia adalah?",
  "A. Jakarta",
  "B. Bandung",
  "C. Surabaya",
  "D. Medan",
  "KUNCI: A",
  "BOBOT: 5",
  "MATERI: Pengetahuan Umum",
  "TINGKAT: mudah",
  "PEMBAHASAN: Contoh soal pilihan ganda berkunci tunggal.",
  "",
  "2. Air mendidih pada suhu 100 derajat Celsius di permukaan laut.",
  "A. Benar",
  "B. Salah",
  "KUNCI: BENAR",
  "BOBOT: 5",
  "",
  "3. Planet terdekat dari Matahari adalah?",
  "JENIS: ISIAN",
  "KUNCI: merkurius|mercury",
  "BOBOT: 5",
  "",
  "4. Jelaskan manfaat energi terbarukan bagi lingkungan.",
  "JENIS: ESSAY",
  "BOBOT: 20",
  "TINGKAT: sulit",
  "",
];

// ---------- EXCEL BERHIAS ----------

/**
 * Rakit template Excel yang sudah berhias.
 *
 * Bukan sekadar tabel mentah: judul berlatar biru, baris kepala yang dibekukan
 * dan disaring, empat contoh berlatar abu supaya jelas ia contoh dan bukan
 * soal, lalu satu lembar Petunjuk di sebelahnya.
 *
 * Contohnya diberi warna berbeda dengan sengaja. Template yang contohnya tidak
 * dapat dibedakan dari isian membuat empat baris contoh ikut terunggah sebagai
 * soal ujian sungguhan — dan itu baru ketahuan ketika peserta membacanya.
 */
export function buatXlsxTemplate(): Blob {
  const kolomTerakhir = hurufKolom(KOLOM_EXCEL.length);

  const baris: Baris[] = [
    {
      tinggi: 30,
      sel: KOLOM_EXCEL.map((_, i) =>
        i === 0 ? { nilai: "TEMPLATE SOAL UJIAN", gaya: GAYA.judul } : { nilai: "", gaya: GAYA.judul },
      ),
    },
    {
      tinggi: 20,
      sel: KOLOM_EXCEL.map((_, i) =>
        i === 0
          ? {
              nilai:
                "Hapus enam baris contoh berwarna abu di bawah, lalu isi soal Anda sendiri. " +
                "Petunjuk lengkap ada pada lembar sebelah.",
              gaya: GAYA.anak,
            }
          : { nilai: "", gaya: GAYA.anak },
      ),
    },
    { tinggi: 34, sel: KOLOM_EXCEL.map((k) => ({ nilai: k, gaya: GAYA.kepala })) },
    ...CONTOH_EXCEL.map((c) => ({
      sel: KOLOM_EXCEL.map((_, i) => ({
        nilai: c[i] ?? "",
        // Kolom NO dan BOBOT dipusatkan; sisanya rata kiri.
        gaya: i === 0 || i === 11 ? GAYA.contohTengah : GAYA.contoh,
      })),
    })),
    // Dua puluh baris kosong yang sudah bergaris, supaya pengajar langsung
    // mengetik ke dalam tabel dan bukan ke ruang kosong di bawahnya.
    ...Array.from({ length: 20 }, () => ({
      sel: KOLOM_EXCEL.map((_, i) => ({
        nilai: "",
        gaya: i === 0 || i === 11 ? GAYA.isiTengah : GAYA.isi,
      })),
    })),
  ];

  const petunjuk: Baris[] = [
    { tinggi: 30, sel: [{ nilai: "PETUNJUK PENGISIAN TEMPLATE SOAL", gaya: GAYA.petunjukJudul }] },
    { sel: [{ nilai: "", gaya: GAYA.petunjukIsi }] },
    ...PETUNJUK_EXCEL.slice(2).map((p) => ({
      sel: [{ nilai: p[0] ?? "", gaya: /^[A-Z ]+$/.test(p[0] ?? "") ? GAYA.petunjukTebal : GAYA.petunjukIsi }],
    })),
  ];

  return buatXlsx([
    {
      nama: "Soal",
      baris,
      lebar: [5, 14, 52, 22, 22, 22, 22, 22, 26, 34, 30, 8, 20, 11, 40],
      beku: 3,
      saring: `A3:${kolomTerakhir}3`,
      gabung: [`A1:${kolomTerakhir}1`, `A2:${kolomTerakhir}2`],
    },
    {
      nama: "Petunjuk",
      baris: petunjuk,
      lebar: [104],
      gabung: ["A1:A1"],
    },
  ]);
}

export const NASKAH_TEMPLATE_WORD = NASKAH_WORD;
