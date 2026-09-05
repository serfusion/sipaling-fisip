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
import { KOLOM_EXCEL } from "@/lib/impor-soal";

export { KOLOM_EXCEL };

/** Tiga baris contoh yang sudah benar, supaya bentuknya tidak perlu ditebak. */
export const CONTOH_EXCEL: Array<Array<string | number>> = [
  [1, "PG", "Siapa perumus teori agenda setting?", "McCombs & Shaw", "Lasswell", "Habermas", "Gerbner", "", "A", 5, "Teori Komunikasi", "sedang", "Dirumuskan McCombs dan Shaw pada 1972."],
  [2, "BENAR-SALAH", "Opini publik dapat dibentuk media massa.", "Benar", "Salah", "", "", "", "BENAR", 5, "Teori Komunikasi", "mudah", ""],
  [3, "ISIAN", "Sebutkan istilah pengaturan agenda oleh media.", "", "", "", "", "", "agenda setting|penentuan agenda", 5, "Teori Komunikasi", "sedang", "Beberapa kemungkinan jawaban dipisah tanda |"],
  [4, "ESSAY", "Jelaskan peran media massa dalam kampanye politik.", "", "", "", "", "", "", 20, "Komunikasi Politik", "sulit", "Dikoreksi dosen setelah ujian selesai."],
];

export const PETUNJUK_EXCEL: string[][] = [
  ["PETUNJUK PENGISIAN TEMPLATE SOAL"],
  [""],
  ["1. Isi mulai baris di bawah judul kolom pada sheet \"Soal\". Hapus 4 baris contoh, lalu isi soal asli."],
  ["2. Kolom JENIS diisi salah satu: PG, BENAR-SALAH, ISIAN, atau ESSAY. Kosong dianggap PG."],
  ["3. PG  → isi PILIHAN A sampai E seperlunya, KUNCI ditulis hurufnya (A/B/C/D/E)."],
  ["4. BENAR-SALAH → pilihan boleh dikosongkan, KUNCI ditulis BENAR atau SALAH."],
  ["5. ISIAN → pilihan dikosongkan, KUNCI berisi jawabannya."],
  ["   Beberapa kemungkinan jawaban dipisah tanda | misalnya: agenda setting|penentuan agenda"],
  ["6. ESSAY → pilihan dan KUNCI dikosongkan. Dikoreksi dosen setelah ujian selesai."],
  ["7. BOBOT diisi angka. Nilai akhir dihitung dari jumlah bobot, bukan jumlah soal,"],
  ["   jadi soal essay boleh diberi bobot lebih besar daripada pilihan ganda."],
  ["8. TINGKAT diisi mudah / sedang / sulit. Kosong dianggap sedang."],
  ["9. Urutan kolom boleh digeser dan kolom yang tidak dipakai boleh dihapus —"],
  ["   yang dicari sistem NAMA kolomnya, bukan letaknya."],
  ["10. Simpan berkas, lalu unggah lewat tombol \"Unggah soal\" di dashboard CBT."],
  [""],
  ["Satu baris yang bermasalah TIDAK menggagalkan seluruh berkas: yang sah tetap masuk,"],
  ["dan yang ditolak ditampilkan beserta nomor barisnya supaya tinggal diperbaiki."],
];

// ---------- WORD ----------

const NASKAH_WORD = [
  "TEMPLATE SOAL UJIAN — SiPaling FISIP",
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

  return buatZip([
    { nama: "[Content_Types].xml", data: enc(jenisIsi) },
    { nama: "_rels/.rels", data: enc(hubungan) },
    { nama: "word/document.xml", data: enc(dokumen) },
  ]);
}

export const NASKAH_TEMPLATE_WORD = NASKAH_WORD;
