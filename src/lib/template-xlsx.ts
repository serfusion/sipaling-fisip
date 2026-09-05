// ============================================================
// PERAKIT .XLSX BERHIAS — khusus template soal
//
// KENAPA DIRAKIT SENDIRI, PADAHAL SUDAH ADA SheetJS DI PROYEK INI:
// Edisi komunitas SheetJS tidak dapat MENULIS gaya sel. Ia menulis angka dan
// huruf dengan benar, tetapi tanpa warna, tanpa tebal, tanpa bingkai, dan
// tanpa baris judul yang dibekukan. Template yang dibuka dosen karena itu
// tampil sebagai lembar mentah tanpa penanda apa pun — dan template yang tidak
// menuntun adalah template yang salah diisi.
//
// Sebuah .xlsx pada dasarnya zip berisi beberapa XML, dan perakit zip-nya
// sudah ada di src/lib/zip.ts. Yang ditulis di sini hanyalah bagian yang
// benar-benar dipakai satu template tetap: gaya, dua lembar, dan lebar kolom.
//
// Talinya ditulis sebagai "inline string", bukan lewat tabel tali bersama.
// Untuk berkas sekecil ini bedanya tidak terasa, dan tanpa tabel bersama tidak
// ada indeks yang dapat meleset.
// ============================================================
import { buatZip, type Bita } from "@/lib/zip";

export const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const enc = (teks: string): Bita => new TextEncoder().encode(teks) as Bita;

function lolos(teks: string) {
  return teks
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Nomor kolom menjadi hurufnya: 1 → A, 27 → AA. */
export function hurufKolom(nomor: number) {
  let hasil = "";
  let n = nomor;
  while (n > 0) {
    const sisa = (n - 1) % 26;
    hasil = String.fromCharCode(65 + sisa) + hasil;
    n = Math.floor((n - 1) / 26);
  }
  return hasil;
}

/**
 * Gaya sel yang dipakai template.
 *
 * Nomornya adalah indeks pada cellXfs di bawah, dan urutannya TIDAK boleh
 * digeser tanpa mengubah keduanya bersama-sama.
 */
export const GAYA = {
  biasa: 0,
  judul: 1,
  anak: 2,
  kepala: 3,
  isi: 4,
  isiTengah: 5,
  contoh: 6,
  contohTengah: 7,
  petunjukJudul: 8,
  petunjukIsi: 9,
  petunjukTebal: 10,
} as const;

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  // --- huruf ---
  "<fonts count=\"7\">" +
  '<font><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '<font><i/><sz val="10"/><color rgb="FF5B6470"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '<font><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/></font>' +
  '<font><i/><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="12"/><color rgb="FF1E3A5F"/><name val="Calibri"/></font>' +
  "</fonts>" +
  // --- warna latar ---
  "<fills count=\"5\">" +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF2B5BA9"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1E3A5F"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF3F6FA"/><bgColor indexed="64"/></patternFill></fill>' +
  "</fills>" +
  // --- bingkai ---
  "<borders count=\"2\">" +
  "<border><left/><right/><top/><bottom/><diagonal/></border>" +
  '<border><left style="thin"><color rgb="FFC9D2DE"/></left>' +
  '<right style="thin"><color rgb="FFC9D2DE"/></right>' +
  '<top style="thin"><color rgb="FFC9D2DE"/></top>' +
  '<bottom style="thin"><color rgb="FFC9D2DE"/></bottom><diagonal/></border>' +
  "</borders>" +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  // --- gaya sel, urutannya sama dengan GAYA di atas ---
  '<cellXfs count="11">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">' +
  '<alignment vertical="center" indent="1"/></xf>' +
  '<xf numFmtId="0" fontId="2" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">' +
  '<alignment vertical="center" indent="1"/></xf>' +
  '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
  '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">' +
  '<alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">' +
  '<alignment horizontal="center" vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
  '<alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
  '<alignment horizontal="center" vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">' +
  '<alignment vertical="center" indent="1"/></xf>' +
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">' +
  '<alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">' +
  '<alignment vertical="center"/></xf>' +
  "</cellXfs>" +
  "</styleSheet>";

export type Sel = { nilai: string | number; gaya?: number };
export type Baris = { sel: Array<Sel | null>; tinggi?: number };

export type Lembar = {
  nama: string;
  baris: Baris[];
  /** Lebar kolom dalam satuan lebar-karakter Excel. */
  lebar: number[];
  /** Baris yang dibekukan di atas, mis. 3 berarti tiga baris pertama tetap. */
  beku?: number;
  /** Rentang saringan otomatis, mis. "A3:M3". */
  saring?: string;
  /** Rentang sel yang digabung, mis. ["A1:M1"]. */
  gabung?: string[];
};

function xmlLembar(lembar: Lembar) {
  const kolom = lembar.lebar
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("");

  const baris = lembar.baris
    .map((b, urut) => {
      const nomor = urut + 1;
      const sel = b.sel
        .map((s, kol) => {
          if (s === null) return "";
          const alamat = `${hurufKolom(kol + 1)}${nomor}`;
          const gaya = s.gaya ? ` s="${s.gaya}"` : "";
          if (typeof s.nilai === "number") {
            return `<c r="${alamat}"${gaya}><v>${s.nilai}</v></c>`;
          }
          if (s.nilai === "") return `<c r="${alamat}"${gaya}/>`;
          return `<c r="${alamat}"${gaya} t="inlineStr"><is><t xml:space="preserve">${lolos(s.nilai)}</t></is></c>`;
        })
        .join("");
      const tinggi = b.tinggi ? ` ht="${b.tinggi}" customHeight="1"` : "";
      return `<row r="${nomor}"${tinggi}>${sel}</row>`;
    })
    .join("");

  // Pembekuan baris judul. Tanpa ini, dosen yang menggulir ke soal ketiga
  // puluh tidak lagi melihat kolom mana yang sedang ia isi.
  const beku = lembar.beku
    ? `<pane ySplit="${lembar.beku}" topLeftCell="A${lembar.beku + 1}" activePane="bottomLeft" state="frozen"/>` +
      '<selection pane="bottomLeft"/>'
    : "";

  const gabung = lembar.gabung?.length
    ? `<mergeCells count="${lembar.gabung.length}">` +
      lembar.gabung.map((r) => `<mergeCell ref="${r}"/>`).join("") +
      "</mergeCells>"
    : "";

  const saring = lembar.saring ? `<autoFilter ref="${lembar.saring}"/>` : "";

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetViews><sheetView workbookViewId="0" showGridLines="0">${beku}</sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${kolom}</cols>` +
    `<sheetData>${baris}</sheetData>` +
    // Urutannya WAJIB, dan urutannya adalah autoFilter DULU baru mergeCells —
    // begitulah CT_Worksheet menyusun anak-anaknya pada ECMA-376. Excel
    // menolak berkas yang menyusunnya terbalik, dan penolakannya berbunyi
    // "berkas rusak" tanpa menyebut sebabnya.
    saring +
    gabung +
    "</worksheet>"
  );
}

/** Rakit satu berkas .xlsx berisi lembar-lembar yang diberikan. */
export function buatXlsx(lembar: Lembar[]): Blob {
  const jenisIsi =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    lembar
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ` +
          'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
      )
      .join("") +
    "</Types>";

  const akar =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    "</Relationships>";

  const bukuKerja =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    "<sheets>" +
    lembar
      .map((l, i) => `<sheet name="${lolos(l.nama)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("") +
    "</sheets></workbook>";

  const hubunganBuku =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    lembar
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" ` +
          'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
          `Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join("") +
    `<Relationship Id="rId${lembar.length + 1}" ` +
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    "</Relationships>";

  return buatZip(
    [
      { nama: "[Content_Types].xml", data: enc(jenisIsi) },
      { nama: "_rels/.rels", data: enc(akar) },
      { nama: "xl/workbook.xml", data: enc(bukuKerja) },
      { nama: "xl/_rels/workbook.xml.rels", data: enc(hubunganBuku) },
      { nama: "xl/styles.xml", data: enc(STYLES) },
      ...lembar.map((l, i) => ({
        nama: `xl/worksheets/sheet${i + 1}.xml`,
        data: enc(xmlLembar(l)),
      })),
    ],
    new Date(),
    MIME_XLSX,
  );
}
