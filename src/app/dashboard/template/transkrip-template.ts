// Pembaca "Template Transkrip SiPaling" — format 2 sheet yang dapat diunduh
// dari dashboard, dirancang agar mudah diisi manual (mirip template AKM).
//
//  Sheet "Biodata" : dua kolom  -> A = label, B = isi
//  Sheet "Nilai"   : baris 1 header -> NO | KODE MK | NAMA MATA KULIAH |
//                    COURSE TITLE (INGGRIS) | K | HM
//
// Berbeda dari format KUI (dua blok kolom + baris Inggris terpisah), template
// ini satu baris per mata kuliah sehingga aman diedit siapa pun.

import type { Aoa, CourseRow } from "./transkrip-parse";

export const TEMPLATE_SHEET_BIO = "Biodata";
export const TEMPLATE_SHEET_NILAI = "Nilai";

const txt = (v: unknown) => String(v ?? "").trim();

// label pada sheet Biodata -> kunci internal
const BIO_KEYS: Array<[RegExp, string]> = [
  [/^nama/i, "nama"],
  [/^(nim|nomor induk)/i, "nim"],
  [/^tempat/i, "ttl"],
  [/^program studi|^prodi/i, "prodi"],
  [/^konsentrasi/i, "konsentrasi"],
  [/^jenjang/i, "jenjang"],
  [/^nomor ija|^no\.? ija/i, "noijazah"],
  [/^nppt|^nomor pokok perguruan/i, "nppt"],
  [/^tanggal yudisium|^tgl yudisium/i, "yudisium"],
  [/^akreditasi|^terakreditasi/i, "akred"],
  [/^judul/i, "judul"],
  [/^tanggal surat|^tanggal ttd/i, "tanggal"],
  [/^dekan$/i, "dekan"],
  [/^nbm dekan/i, "nbmdekan"],
  [/^rektor$/i, "rektor"],
  [/^nbm rektor/i, "nbmrektor"],
];

export function isTemplateWorkbook(sheetNames: string[]) {
  const lower = sheetNames.map((n) => n.toLowerCase());
  return lower.includes(TEMPLATE_SHEET_NILAI.toLowerCase());
}

export function parseTemplateBio(aoa: Aoa): Record<string, string> {
  const bio: Record<string, string> = {};
  for (const row of aoa) {
    const label = txt(row?.[0]);
    const value = txt(row?.[1]);
    if (!label || !value) continue;
    for (const [re, key] of BIO_KEYS) {
      if (bio[key] === undefined && re.test(label)) {
        bio[key] = value;
        break;
      }
    }
  }
  return bio;
}

export function parseTemplateNilai(aoa: Aoa): CourseRow[] {
  if (!aoa.length) throw new Error(`Sheet "${TEMPLATE_SHEET_NILAI}" kosong.`);

  // cari baris header (memuat "KODE" dan "NAMA")
  let head = -1;
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const cells = (aoa[i] || []).map((c) => txt(c).toLowerCase());
    if (cells.some((c) => c.includes("kode")) && cells.some((c) => c.includes("nama"))) {
      head = i;
      break;
    }
  }
  if (head < 0) throw new Error(`Baris header tidak ditemukan pada sheet "${TEMPLATE_SHEET_NILAI}". Gunakan template yang diunduh dari dashboard.`);

  const header = (aoa[head] || []).map((c) => txt(c).toLowerCase());
  const find = (re: RegExp) => header.findIndex((c) => re.test(c));
  const cKode = find(/kode/);
  const cNama = header.findIndex((c) => /nama/.test(c));
  const cEn = header.findIndex((c) => /course|inggris|english/.test(c));
  const cK = header.findIndex((c) => /^k$|sks|kredit|credit/.test(c));
  const cHm = header.findIndex((c) => /^hm$|huruf|grade/.test(c));

  if (cNama < 0 || cK < 0) {
    throw new Error(`Kolom "NAMA MATA KULIAH" dan "K" wajib ada pada sheet "${TEMPLATE_SHEET_NILAI}".`);
  }

  const rows: CourseRow[] = [];
  const seen = new Set<string>();
  for (let i = head + 1; i < aoa.length; i++) {
    const row = aoa[i] || [];
    const nama = txt(row[cNama]);
    if (!nama) continue;
    if (/^(jumlah|total|judul|keterangan)/i.test(nama)) continue;

    const kRaw = txt(row[cK]).replace(",", ".");
    const k = Number(kRaw) || 0;
    if (!k) continue; // baris contoh kosong / tanpa SKS diabaikan
    if (k > 24) continue; // pengaman: baris subtotal nyasar

    const hm = txt(row[cHm]).toUpperCase();
    const kode = cKode >= 0 ? txt(row[cKode]) : "";
    const key = `${kode}|${nama}`.toLowerCase();
    if (seen.has(key)) continue; // hindari duplikat tak sengaja
    seen.add(key);

    rows.push({
      kode,
      nama,
      en: cEn >= 0 ? txt(row[cEn]) : "",
      hm: ["A", "B", "C", "D", "E"].includes(hm) ? hm : "",
      k,
    });
  }
  if (!rows.length) throw new Error(`Tidak ada baris nilai terisi pada sheet "${TEMPLATE_SHEET_NILAI}". Isi minimal kolom NAMA MATA KULIAH dan K.`);
  return rows;
}

// Data contoh yang ikut tercetak di template unduhan (baris panduan).
export const TEMPLATE_BIO_ROWS: Array<[string, string]> = [
  ["Nama Mahasiswa", "NUR BAITU RAHMAH"],
  ["NIM", "2061201446"],
  ["Tempat, Tgl Lahir", "TANGERANG, 31 MARET 2001"],
  ["Program Studi", "Ilmu Komunikasi"],
  ["Konsentrasi", "BROADCASTING"],
  ["Jenjang", "SARJANA / BACHELOR DEGREE (S-1)"],
  ["Nomor Ijazah Nasional", ""],
  ["NPPT", "041051"],
  ["Tanggal Yudisium", "9 Juli 2026"],
  ["Akreditasi", '"UNGGUL" LAMSPAK Nomor 099/AK.03.05/2026'],
  ["Judul Skripsi", ""],
  ["Tanggal Surat", ""],
  ["Dekan", "Dr. H. Achmad Kosasih, MM."],
  ["NBM Dekan", "739.574"],
  ["Rektor", "Dr. H. Desri Arwen, M.Pd."],
  ["NBM Rektor", "837.138"],
];

export const TEMPLATE_NILAI_HEADER = [
  "NO",
  "KODE MK",
  "NAMA MATA KULIAH",
  "COURSE TITLE (INGGRIS)",
  "K",
  "HM",
];

export const TEMPLATE_NILAI_CONTOH: Array<Array<string | number>> = [
  [1, "MKK-012", "Ilmu Budaya Dasar", "Basic Cultural Studies", 2, "B"],
  [2, "MPK-001", "AIKA I", "Islamic and Muhammadiyah Studies I", 2, "A"],
  [3, "MKB-044", "Skripsi", "Undergraduate Thesis", 6, ""],
];
