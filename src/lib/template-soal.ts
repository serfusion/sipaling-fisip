// ============================================================
// TEMPLATE SOAL YANG DAPAT DIUNDUH — Excel dan Word
//
// Dua berkas kosong yang tinggal diisi dosen. Isinya sengaja memuat contoh
// yang sudah benar pada baris pertama: template kosong melulu membuat orang
// menebak-nebak bentuknya, dan tebakannya ditolak saat diunggah.
//
// Berkas .docx dirakit sendiri di sini — sebuah .docx pada dasarnya zip
// berisi tiga XML, dan perakit zip-nya sudah ada di src/lib/zip.ts untuk
// keperluan arsip. Menambah satu pustaka penulis Word demi satu template
// yang bentuknya tidak pernah berubah tidak sepadan harganya.
// ============================================================
import { buatZip, type Bita } from "@/lib/zip";
import { buatXlsx, GAYA, hurufKolom, type Baris } from "@/lib/template-xlsx";
import { KOLOM_EXCEL } from "@/lib/impor-soal";

export { KOLOM_EXCEL };

export const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Satu contoh untuk TIAP jenis soal, dan semuanya sudah benar.
 *
 * Urutan selnya mengikuti KOLOM_EXCEL persis. Menyisipkan satu kolom di sana
 * tanpa menggeser baris-baris ini akan membuat seluruh contoh salah kolom —
 * dan salahnya senyap: berkasnya tetap terbuka, hanya isinya yang bergeser.
 */
export const CONTOH_EXCEL: Array<Array<string | number>> = [
  //  NO JENIS          PERTANYAAN                     A                  B                 C            D          E    KUNCI                              PASANGAN                                            MEDIA                                BOBOT MATERI               TINGKAT   PEMBAHASAN
  [1, "PG", "Siapa perumus teori agenda setting?", "McCombs & Shaw", "Lasswell", "Habermas", "Gerbner", "", "A", "", "", 5, "Teori Komunikasi", "sedang", "Dirumuskan McCombs dan Shaw pada 1972."],
  [2, "PG KOMPLEKS", "Manakah yang termasuk teori komunikasi massa? (jawaban boleh lebih dari satu)", "Agenda setting", "Kultivasi", "Fotosintesis", "Spiral of silence", "", "A,B,D", "", "", 9, "Teori Komunikasi", "sulit", "Dinilai per bagian; yang keliru mengurangi yang tepat."],
  [3, "PENJODOHAN", "Jodohkan teori berikut dengan perumusnya.", "Lasswell", "", "", "", "", "", "Agenda setting = McCombs & Shaw\nSpiral of silence = Noelle-Neumann\nKultivasi = Gerbner", "", 6, "Teori Komunikasi", "sedang", "Kolom PILIHAN diisi pengecoh yang tidak berpasangan."],
  [4, "BENAR-SALAH", "Opini publik dapat dibentuk media massa.", "Benar", "Salah", "", "", "", "BENAR", "", "", 5, "Teori Komunikasi", "mudah", ""],
  [5, "ISIAN", "Sebutkan istilah pengaturan agenda oleh media.", "", "", "", "", "", "agenda setting|penentuan agenda", "", "", 5, "Teori Komunikasi", "sedang", "Beberapa kemungkinan jawaban dipisah tanda |"],
  [6, "ESSAY", "Jelaskan peran media massa dalam kampanye politik.", "", "", "", "", "", "", "", "https://upload.wikimedia.org/contoh-poster.jpg", 20, "Komunikasi Politik", "sulit", "Kolom MEDIA boleh diisi tautan gambar atau video."],
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
  ["      Agenda setting = McCombs & Shaw"],
  ["      Kultivasi = Gerbner"],
  ["   Kolom kanan otomatis menjadi daftar jawaban dan diacak untuk mahasiswa."],
  ["   Kolom PILIHAN A-E boleh diisi PENGECOH yang tidak berpasangan dengan apa pun."],
  ["   Dinilai per pasangan: satu kekeliruan tidak menghapus jawaban yang sudah benar."],
  ["6. BENAR-SALAH → pilihan boleh dikosongkan, KUNCI ditulis BENAR atau SALAH."],
  ["7. ISIAN → pilihan dikosongkan, KUNCI berisi jawabannya."],
  ["   Beberapa kemungkinan jawaban dipisah tanda | misalnya: agenda setting|penentuan agenda"],
  ["8. ESSAY → pilihan dan KUNCI dikosongkan. Dikoreksi dosen setelah ujian selesai."],
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
  "TEMPLATE SOAL UJIAN SiPaling FISIP",
  "",
  "Tulis soal langsung di bawah ini. Tiap soal diawali nomor, lalu pilihan berhuruf,",
  "lalu baris KUNCI. Baris BOBOT, MATERI, TINGKAT, dan PEMBAHASAN boleh dikosongkan.",
  "Hapus empat contoh di bawah, lalu tulis soal Anda sendiri.",
  "",
  "1. Siapa perumus teori agenda setting?",
  "A. McCombs & Shaw",
  "B. Lasswell",
  "C. Habermas",
  "D. Gerbner",
  "KUNCI: A",
  "BOBOT: 5",
  "MATERI: Teori Komunikasi",
  "TINGKAT: sedang",
  "PEMBAHASAN: Dirumuskan McCombs dan Shaw pada 1972.",
  "",
  "2. Opini publik dapat dibentuk media massa.",
  "A. Benar",
  "B. Salah",
  "KUNCI: BENAR",
  "BOBOT: 5",
  "",
  "3. Sebutkan istilah pengaturan agenda oleh media.",
  "JENIS: ISIAN",
  "KUNCI: agenda setting|penentuan agenda",
  "BOBOT: 5",
  "",
  "4. Jelaskan peran media massa dalam kampanye politik.",
  "JENIS: ESSAY",
  "BOBOT: 20",
  "TINGKAT: sulit",
  "",
];

function lolosXml(teks: string) {
  return teks
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const enc = (teks: string): Bita => new TextEncoder().encode(teks) as Bita;

/**
 * Rakit berkas .docx berisi naskah template.
 *
 * Tiga bagian yang wajib ada agar Word mau membukanya: daftar jenis isi,
 * hubungan akar, dan dokumennya sendiri. Paragraf pertama dibuat tebal
 * sebagai judul; sisanya paragraf biasa.
 */
export function buatDocxTemplate(baris: string[] = NASKAH_WORD): Blob {
  const paragraf = baris
    .map((isi, urut) => {
      if (!isi) return "<w:p/>";
      const tebal = urut === 0 ? "<w:rPr><w:b/><w:sz w:val=\"28\"/></w:rPr>" : "";
      // xml:space="preserve" menjaga spasi di awal baris, yang dipakai
      // pembacanya untuk mengenali baris lanjutan.
      return `<w:p><w:r>${tebal}<w:t xml:space="preserve">${lolosXml(isi)}</w:t></w:r></w:p>`;
    })
    .join("");

  const dokumen =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${paragraf}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body>` +
    "</w:document>";

  const jenisIsi =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    "</Types>";

  const hubungan =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>";

  // Jenis isinya HARUS jenis Word, bukan "application/zip". Sebuah .docx
  // memang zip, tetapi zip yang berlabel zip akan tersimpan sebagai arsip di
  // komputer dosennya — dan itulah sebab template Word sebelumnya turun
  // sebagai .zip.
  return buatZip(
    [
      { nama: "[Content_Types].xml", data: enc(jenisIsi) },
      { nama: "_rels/.rels", data: enc(hubungan) },
      { nama: "word/document.xml", data: enc(dokumen) },
    ],
    new Date(),
    MIME_DOCX,
  );
}

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
 * soal ujian sungguhan — dan itu baru ketahuan ketika mahasiswa membacanya.
 */
export function buatXlsxTemplate(): Blob {
  const kolomTerakhir = hurufKolom(KOLOM_EXCEL.length);

  const baris: Baris[] = [
    {
      tinggi: 30,
      sel: KOLOM_EXCEL.map((_, i) =>
        i === 0 ? { nilai: "TEMPLATE SOAL UJIAN SiPaling FISIP", gaya: GAYA.judul } : { nilai: "", gaya: GAYA.judul },
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
    // Dua puluh baris kosong yang sudah bergaris, supaya dosen langsung
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
