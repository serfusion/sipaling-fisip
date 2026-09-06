// ============================================================
// PERAKIT .XLSX "Template kelulusan" PDDIKTI
//
// KENAPA TIDAK MEMAKAI SheetJS YANG SUDAH ADA:
// sama dengan alasan di src/lib/template-xlsx.ts — edisi komunitas SheetJS
// tidak dapat MENULIS gaya sel. Template PDDIKTI justru dikenali dari
// gayanya: judul kolom berlatar MERAH berarti wajib diisi, HIJAU berarti
// boleh kosong, dan tiap judul menggantung catatan (comment) berisi aturan
// pengisiannya. Berkas tanpa itu memang tetap terunggah, tetapi admin yang
// membukanya kehilangan seluruh penanda yang ia pakai untuk memeriksa.
//
// Yang dirakit di sini karena itu berusaha SAMA PERSIS dengan
// template_kelulusan.xlsx milik PDDIKTI: sepuluh kolom, warnanya, lebarnya,
// dan catatannya kata demi kata.
//
// Catatan sel pada .xlsx butuh TIGA bagian sekaligus — comments1.xml (isinya),
// vmlDrawing1.vml (kotak kuningnya, warisan Excel lama), dan <legacyDrawing>
// pada lembarnya. Tanpa VML-nya, Excel membuka berkas ini sambil mengeluh
// rusak; karena itu ketiganya selalu ditulis bersama-sama.
// ============================================================
import { buatZip, type Bita } from "@/lib/zip";
import { MIME_XLSX } from "@/lib/template-xlsx";

const enc = (teks: string): Bita => new TextEncoder().encode(teks) as Bita;

function lolos(teks: string) {
  return teks
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hurufKolom(nomor: number) {
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
 * Gaya sel. Nomornya adalah indeks pada cellXfs di bawah — urutan keduanya
 * tidak boleh digeser sendiri-sendiri.
 */
const GAYA = { isi: 0, judulWajib: 1, judulBebas: 2 } as const;

// Merah FFFF0000 dan hijau FF00FF00 disalin dari template PDDIKTI apa adanya;
// keduanya memang sekeras itu di berkas aslinya.
const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2">' +
  '<font><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/></font>' +
  "</fonts>" +
  '<fills count="4">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFFF0000"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF00FF00"/><bgColor indexed="64"/></patternFill></fill>' +
  "</fills>" +
  '<borders count="2">' +
  "<border><left/><right/><top/><bottom/><diagonal/></border>" +
  '<border><left style="thin"><color rgb="FF000000"/></left>' +
  '<right style="thin"><color rgb="FF000000"/></right>' +
  '<top style="thin"><color rgb="FF000000"/></top>' +
  '<bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>' +
  "</borders>" +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3">' +
  // 0 — sel isi: teks polos berbingkai. numFmtId 49 = "Text", supaya NIM dan
  // kode prodi tidak dibulatkan Excel menjadi notasi ilmiah.
  '<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
  // 1 — judul kolom wajib (merah)
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
  '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  // 2 — judul kolom boleh kosong (hijau)
  '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
  '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  "</cellXfs>" +
  // Tanpa gaya "Normal" ini sebagian pembaca mengeluh berkasnya tidak punya
  // gaya bawaan, lalu menambal sendiri dengan tebakannya.
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16"/>' +
  "</styleSheet>";

export type KolomKelulusan = { judul: string; wajib: boolean; catatan: string; lebar: number };

/** Catatan yang menggantung pada satu sel judul. */
type Catatan = { alamat: string; kolom: number; teks: string };

function xmlCatatan(daftar: Catatan[]) {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    "<authors><author>PDDIKTI</author></authors>" +
    "<commentList>" +
    daftar
      .map(
        (c) =>
          `<comment ref="${c.alamat}" authorId="0"><text><r><rPr><sz val="9"/><color indexed="81"/>` +
          '<rFont val="Tahoma"/></rPr>' +
          `<t xml:space="preserve">${lolos(c.teks)}</t></r></text></comment>`,
      )
      .join("") +
    "</commentList></comments>"
  );
}

/**
 * Kotak kuning tempat catatan digambar. Bentuknya warisan Excel 97 dan
 * memang seaneh ini; yang penting satu <v:shape> untuk satu catatan, dengan
 * baris & kolom yang ditunjuk pada <x:ClientData>.
 */
function xmlVml(daftar: Catatan[]) {
  const bentuk = daftar
    .map(
      (c, i) =>
        `<v:shape id="_x0000_s${1025 + i}" type="#_x0000_t202" ` +
        'style="position:absolute;margin-left:60pt;margin-top:6pt;width:240pt;height:130pt;' +
        'z-index:1;visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto">' +
        '<v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/>' +
        '<v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto">' +
        '<div style="text-align:left"></div></v:textbox>' +
        '<x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/>' +
        `<x:Anchor>${c.kolom + 1}, 15, 0, 2, ${c.kolom + 4}, 15, 7, 2</x:Anchor>` +
        `<x:AutoFill>False</x:AutoFill><x:Row>0</x:Row><x:Column>${c.kolom}</x:Column>` +
        "</x:ClientData></v:shape>",
    )
    .join("");

  return (
    '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout>' +
    '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe">' +
    '<v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>' +
    bentuk +
    "</xml>"
  );
}

function xmlLembar(kolom: KolomKelulusan[], baris: string[][], adaCatatan: boolean) {
  const lebar = kolom
    .map((k, i) => `<col min="${i + 1}" max="${i + 1}" width="${k.lebar}" customWidth="1"/>`)
    .join("");

  const judul =
    '<row r="1" ht="30" customHeight="1">' +
    kolom
      .map(
        (k, i) =>
          `<c r="${hurufKolom(i + 1)}1" s="${k.wajib ? GAYA.judulWajib : GAYA.judulBebas}" ` +
          `t="inlineStr"><is><t xml:space="preserve">${lolos(k.judul)}</t></is></c>`,
      )
      .join("") +
    "</row>";

  // Semua isi ditulis sebagai TEKS, tidak satu pun sebagai angka. NIM
  // 2270201090 yang disimpan sebagai angka akan muncul kembali sebagai
  // 2.27E+09 di layar sebagian admin, dan "3.80" berubah menjadi "3.8".
  const isi = baris
    .map((sel, urut) => {
      const nomor = urut + 2;
      const kolomXml = sel
        .map((nilai, i) => {
          const alamat = `${hurufKolom(i + 1)}${nomor}`;
          if (nilai === "") return `<c r="${alamat}" s="${GAYA.isi}"/>`;
          return `<c r="${alamat}" s="${GAYA.isi}" t="inlineStr"><is><t xml:space="preserve">${lolos(nilai)}</t></is></c>`;
        })
        .join("");
      return `<row r="${nomor}">${kolomXml}</row>`;
    })
    .join("");

  const akhirKolom = hurufKolom(kolom.length);
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<dimension ref="A1:${akhirKolom}${baris.length + 1}"/>` +
    '<sheetViews><sheetView workbookViewId="0">' +
    // Baris judul dibekukan: dengan ratusan wisudawan, admin yang menggulir
    // ke baris ke-300 tidak lagi tahu kolom mana yang sedang ia periksa.
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
    "</sheetView></sheetViews>" +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${lebar}</cols>` +
    `<sheetData>${judul}${isi}</sheetData>` +
    // Segitiga hijau "angka disimpan sebagai teks" dimatikan: di sini teks
    // memang yang benar, dan peringatan pada 3.600 sel hanya menakuti.
    (baris.length ? `<ignoredErrors><ignoredError sqref="A2:${akhirKolom}${baris.length + 1}" numberStoredAsText="1"/></ignoredErrors>` : "") +
    (adaCatatan ? '<legacyDrawing r:id="rId1"/>' : "") +
    "</worksheet>"
  );
}

/**
 * Rakit berkas "Template kelulusan" siap unggah PDDIKTI.
 *
 * `baris` sudah harus urut sama dengan `kolom` — pemetaannya dikerjakan
 * kelulusan-parse.ts, bukan di sini.
 */
export function buatXlsxKelulusan(
  kolom: KolomKelulusan[],
  baris: string[][],
  namaLembar: string,
): Blob {
  const catatan: Catatan[] = kolom
    .map((k, i) => ({ alamat: `${hurufKolom(i + 1)}1`, kolom: i, teks: k.catatan }))
    .filter((c) => c.teks.trim().length > 0);
  const adaCatatan = catatan.length > 0;

  const jenisIsi =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    (adaCatatan ? '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>' : "") +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    (adaCatatan
      ? '<Override PartName="/xl/comments1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>'
      : "") +
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
    `<sheets><sheet name="${lolos(namaLembar)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const hubunganBuku =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    "</Relationships>";

  const hubunganLembar =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments1.xml"/>' +
    "</Relationships>";

  const bagian = [
    { nama: "[Content_Types].xml", data: enc(jenisIsi) },
    { nama: "_rels/.rels", data: enc(akar) },
    { nama: "xl/workbook.xml", data: enc(bukuKerja) },
    { nama: "xl/_rels/workbook.xml.rels", data: enc(hubunganBuku) },
    { nama: "xl/styles.xml", data: enc(STYLES) },
    { nama: "xl/worksheets/sheet1.xml", data: enc(xmlLembar(kolom, baris, adaCatatan)) },
  ];

  if (adaCatatan) {
    bagian.push(
      { nama: "xl/worksheets/_rels/sheet1.xml.rels", data: enc(hubunganLembar) },
      { nama: "xl/comments1.xml", data: enc(xmlCatatan(catatan)) },
      { nama: "xl/drawings/vmlDrawing1.vml", data: enc(xmlVml(catatan)) },
    );
  }

  return buatZip(bagian, new Date(), MIME_XLSX);
}
