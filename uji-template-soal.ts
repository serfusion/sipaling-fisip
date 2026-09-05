// Uji perakit template: berkasnya harus benar-benar terbaca sebagai .xlsx
// oleh pembaca sungguhan (SheetJS), bukan hanya "berbentuk zip".
import { writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

// Blob ada di Node 18+, tetapi kode sumbernya memakai "@/lib/..." — jalankan
// lewat tsx dengan alias yang sudah ada di tsconfig.
import { buatXlsxTemplate, buatDocxTemplate, MIME_DOCX, KOLOM_EXCEL, CONTOH_EXCEL } from "@/lib/template-soal";
import { MIME_XLSX } from "@/lib/template-xlsx";
import { imporDariExcel } from "@/lib/impor-soal";

let lulus = 0;
let gagal = 0;
function cek(nama: string, syarat: boolean, keterangan = "") {
  if (syarat) { lulus += 1; console.log(`  ok   ${nama}`); }
  else { gagal += 1; console.log(`  GAGAL ${nama}${keterangan ? " — " + keterangan : ""}`); }
}

async function jalan() {
  console.log("\n== TEMPLATE EXCEL ==");
  const xlsx = buatXlsxTemplate();
  cek("jenis isinya jenis Excel, bukan zip", xlsx.type === MIME_XLSX, xlsx.type);
  const buf = Buffer.from(await xlsx.arrayBuffer());
  cek("ukurannya masuk akal", buf.length > 2000, String(buf.length));
  cek("berawal tanda zip PK", buf[0] === 0x50 && buf[1] === 0x4b);

  // Dibaca pembaca sungguhan. Inilah yang membedakan "zip yang berisi XML"
  // dari "berkas Excel yang benar-benar dapat dibuka".
  const wb = XLSX.read(buf, { type: "buffer" });
  cek("dua lembar: Soal dan Petunjuk", wb.SheetNames.join(",") === "Soal,Petunjuk", wb.SheetNames.join(","));

  const aoa = XLSX.utils.sheet_to_json(wb.Sheets["Soal"], { header: 1, defval: "", raw: false }) as string[][];
  cek("baris 1 judulnya", String(aoa[0]?.[0] ?? "").includes("TEMPLATE SOAL UJIAN"), String(aoa[0]?.[0]));
  cek("baris 3 nama kolomnya", String(aoa[2]?.[0] ?? "") === String(KOLOM_EXCEL[0]), JSON.stringify(aoa[2]?.slice(0, 3)));
  cek("empat baris contoh ikut terbaca", aoa.length >= 7, String(aoa.length));

  // Yang paling penting: template ini harus dapat diunggah kembali dan
  // terbaca pengimpornya sendiri. Template yang cantik tetapi ditolak
  // pengimpornya lebih buruk daripada tabel mentah.
  const bacaan = imporDariExcel(aoa.slice(2));
  cek("pengimpornya membaca seluruh contoh", bacaan.soal.length === CONTOH_EXCEL.length,
      `${bacaan.soal.length} soal, ${bacaan.tolak.length} ditolak: ${JSON.stringify(bacaan.tolak)}`);
  // Dicari berdasarkan jenis, bukan nomor baris: template ini bertambah tiap
  // kali ada jenis soal baru.
  const contoh = (jenis: string) => bacaan.soal.find((s) => s.jenis === jenis);
  cek("contoh pilihan ganda kuncinya A", contoh("pg")?.kunci === "0", JSON.stringify(contoh("pg")));
  cek("contoh essay bobot 20", contoh("essay")?.bobot === 20, JSON.stringify(contoh("essay")));
  cek("keenam jenis soal ada contohnya",
      new Set(bacaan.soal.map((s) => s.jenis)).size === 6,
      JSON.stringify([...new Set(bacaan.soal.map((s) => s.jenis))]));
  cek("contoh PG kompleks kuncinya jamak", contoh("pg_kompleks")?.kunci === "0,1,3",
      JSON.stringify(contoh("pg_kompleks")));
  cek("contoh penjodohan punya pasangan", (contoh("penjodohan")?.pasangan.length ?? 0) === 3,
      JSON.stringify(contoh("penjodohan")));

  const petunjuk = XLSX.utils.sheet_to_json(wb.Sheets["Petunjuk"], { header: 1, defval: "", raw: false }) as string[][];
  cek("lembar petunjuk berisi langkah-langkahnya", petunjuk.length > 8, String(petunjuk.length));

  console.log("\n== TEMPLATE WORD ==");
  const docx = buatDocxTemplate();
  cek("jenis isinya jenis Word, bukan zip", docx.type === MIME_DOCX, docx.type);
  const dbuf = Buffer.from(await docx.arrayBuffer());
  cek("berawal tanda zip PK", dbuf[0] === 0x50 && dbuf[1] === 0x4b);
  const teks = dbuf.toString("latin1");
  for (const wajib of ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]) {
    cek(`memuat ${wajib}`, teks.includes(wajib));
  }

  writeFileSync("/tmp/claude-0/-home-user-sipaling-fisip/43787386-10d9-5ffb-abce-64323d97478e/scratchpad/Template-Soal.xlsx", buf);
  writeFileSync("/tmp/claude-0/-home-user-sipaling-fisip/43787386-10d9-5ffb-abce-64323d97478e/scratchpad/Template-Soal.docx", dbuf);

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  if (gagal > 0) process.exit(1);
}

void jalan();
