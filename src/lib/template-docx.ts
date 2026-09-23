// ============================================================
// PERAKIT .DOCX SEDERHANA — dipakai bersama seluruh template Word
//
// Sebuah .docx pada dasarnya zip berisi tiga XML, dan perakit zip-nya sudah
// ada di src/lib/zip.ts untuk keperluan arsip. Menambah satu pustaka penulis
// Word demi template yang bentuknya tidak pernah berubah tidak sepadan
// harganya.
//
// Yang dirakit di sini SENGAJA sesederhana mungkin: satu paragraf per baris,
// baris pertama sebagai judul tebal. Itu cukup untuk seluruh template yang
// ada — soal maupun rubrik — dan yang membacanya kembali adalah pengimpor
// portal sendiri, yang hanya memerlukan teksnya.
//
// Dahulu berkas ini tinggal di dalam template-soal.ts. Ia dipindahkan ketika
// template rubrik membutuhkan perakit yang sama: template rubrik yang mengimpor
// "template-soal" hanya untuk mendapatkan perakit Word akan membaca seperti
// salah satunya adalah bagian dari yang lain.
// ============================================================
import { buatZip, type Bita } from "@/lib/zip";

export const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function lolosXml(teks: string) {
  return teks
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const enc = (teks: string): Bita => new TextEncoder().encode(teks) as Bita;

/**
 * Rakit berkas .docx berisi naskah yang diberikan.
 *
 * Tiga bagian yang wajib ada agar Word mau membukanya: daftar jenis isi,
 * hubungan akar, dan dokumennya sendiri. Paragraf pertama dibuat tebal
 * sebagai judul; sisanya paragraf biasa.
 */
export function buatDocx(baris: string[]): Blob {
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
  // komputer pengajarnya — dan itulah sebab template Word sebelumnya turun
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
