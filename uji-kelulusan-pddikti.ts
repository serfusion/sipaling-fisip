// Uji jembatan "Excel yudisium fakultas → Template kelulusan PDDIKTI".
//
// Dua hal yang diperiksa, dan keduanya pernah menjadi sumber data salah
// unggah di dunia nyata:
//   1. TANGGAL. Satu berkas yudisium memuat belasan tanggal berbeda; menyalin
//      satu tanggal ke semua baris membuat ratusan data kelulusan keliru.
//   2. BENTUK BERKASNYA. Berkas yang "berbentuk zip" belum tentu .xlsx yang
//      dapat dibuka — karena itu hasilnya dibaca ulang oleh SheetJS.
import { writeFileSync, existsSync } from "node:fs";
import * as XLSX from "xlsx";

import {
  KOLOM_KELULUSAN, NAMA_LEMBAR_PDDIKTI,
  bacaLembarYudisium, barisKeAoa, nomorSkDariLembar, periksaBaris,
  prodiDariLembar, rapikanIpk, semesterKeluar, semesterTahunAjaran, tanggalPddikti,
  type BarisKelulusan,
} from "@/app/dashboard/template/kelulusan-parse";
import { buatXlsxKelulusan } from "@/lib/kelulusan-xlsx";
import type { Aoa } from "@/app/dashboard/template/transkrip-parse";

let lulus = 0;
let gagal = 0;
function cek(nama: string, syarat: boolean, keterangan = "") {
  if (syarat) { lulus += 1; console.log(`  ok   ${nama}`); }
  else { gagal += 1; console.log(`  GAGAL ${nama}${keterangan ? " — " + keterangan : ""}`); }
}

const LEMBAR_CONTOH: Aoa = [
  ["Lampiran SK No. 003/KEP/III.3.AU/F/FISIP/2026"],
  [],
  ["DATA YUDISIUM"],
  ["PROGRAM STUDI ILMU KOMUNIKASI"],
  ["FAKULTAS ILMU SOSIAL DAN ILMU POLITIK"],
  ["UNIVERSITAS MUHAMMADIYAH TANGERANG"],
  ["TAHUN AKADEMIK 2025/2026"],
  [],
  ["NO", "KODE PT", "KODE PRODI", "NIM", "NAMA MAHASISWA", "TEMPAT LAHIR", "TANGGAL LAHIR", "JK", "TGL YUDISIUM", "NIK", "IPK", "PREDIKAT KELULUSAN"],
  [1, "041051", 70201, 2270201090, "ALDINA PRATIWI", "TANGERANG", "23 FEBRUARI 2002", "P", "7 JUNI 2026", "3671106302020002", 3.74, "CUM LAUDE"],
  [2, "041051", 70201, 2270201200, "MARSHANDA ANGGRAINI PUTRI", "TANGERANG", "01 OKTOBER 2004", "P", "24 JULI 2026", "3671124110040004", 3.8, "CUM LAUDE"],
  [3, "041051", 70201, 2270201204, "VIVI FAHRIYANTI PUTRI", "JAKARTA", "08 OKTOBER 2004", "P", "tanggal belum ada", "3671084870040004", 3.74, "CUM LAUDE"],
  [],
  [null, null, null, null, null, null, null, null, null, "Dr. H. Achmad Kosasih, MM"],
];

function jalan() {
  console.log("\n== TANGGAL YUDISIUM → tahun-bulan-tanggal ==");
  cek('"7 JUNI 2026" → 2026-06-07', tanggalPddikti("7 JUNI 2026") === "2026-06-07", String(tanggalPddikti("7 JUNI 2026")));
  cek('"18 JUNI 2026" → 2026-06-18', tanggalPddikti("18 JUNI 2026") === "2026-06-18");
  cek('"24 JULI 2026" → 2026-07-24', tanggalPddikti("24 JULI 2026") === "2026-07-24");
  cek('"01 NOPEMBER 1998" → 1998-11-01', tanggalPddikti("01 NOPEMBER 1998") === "1998-11-01");
  cek('"2 Juli 2026" huruf kecil ikut terbaca', tanggalPddikti("2 Juli 2026") === "2026-07-02");
  cek('"2026-06-07" dibiarkan apa adanya', tanggalPddikti("2026-06-07") === "2026-06-07");
  cek('"7/6/2026" dibaca hari-dulu', tanggalPddikti("7/6/2026") === "2026-06-07");
  cek("objek Date ikut terbaca", tanggalPddikti(new Date(2026, 5, 7)) === "2026-06-07");
  cek("nomor seri Excel ikut terbaca", tanggalPddikti(46180) === "2026-06-07", String(tanggalPddikti(46180)));
  cek('"31 FEBRUARI 2026" ditolak, bukan digeser', tanggalPddikti("31 FEBRUARI 2026") === null);
  cek('"7 JUNIX 2026" ditolak', tanggalPddikti("7 JUNIX 2026") === null);
  cek("teks kosong ditolak", tanggalPddikti("   ") === null);
  cek("NIM tidak diam-diam menjadi tanggal", tanggalPddikti("2270201090") === null, String(tanggalPddikti("2270201090")));

  console.log("\n== SEMESTER KELUAR ==");
  cek("Juni 2026 → 20262 (genap)", semesterKeluar("2026-06-07") === "20262", semesterKeluar("2026-06-07"));
  cek("Juli 2026 → 20262 (genap)", semesterKeluar("2026-07-24") === "20262");
  cek("Februari 2026 → 20262 (awal genap)", semesterKeluar("2026-02-03") === "20262");
  cek("September 2026 → 20261 (ganjil)", semesterKeluar("2026-09-01") === "20261");
  cek("Januari 2026 → 20251 (ekor ganjil tahun lalu)", semesterKeluar("2026-01-15") === "20251", semesterKeluar("2026-01-15"));
  cek("versi tahun ajaran: genap 2025/2026 → 20252", semesterTahunAjaran("2026-06-07") === "20252", semesterTahunAjaran("2026-06-07"));
  cek("versi tahun ajaran: ganjil tetap 20261", semesterTahunAjaran("2026-09-01") === "20261");

  console.log("\n== IPK ==");
  cek("3.8 → 3.80", rapikanIpk(3.8) === "3.80", rapikanIpk(3.8));
  cek("3.74 → 3.74", rapikanIpk(3.74) === "3.74");
  cek('koma "3,12" → 3.12', rapikanIpk("3,12") === "3.12");
  cek("kosong tetap kosong", rapikanIpk("") === "");
  cek("di atas 4 ditolak", rapikanIpk(7.4) === "");

  console.log("\n== MEMBACA LEMBAR YUDISIUM ==");
  const hasil = bacaLembarYudisium(LEMBAR_CONTOH, "YUDISIUM ILKOM", { jenisKeluar: "1", kodeProdiCadangan: "" });
  cek("tiga mahasiswa terbaca, kop & tanda tangan dilewati", hasil.baris.length === 3, String(hasil.baris.length));
  cek("NIM terbaca utuh sebagai teks", hasil.baris[0].nim === "2270201090", hasil.baris[0].nim);
  cek("nama terbaca", hasil.baris[0].nama === "ALDINA PRATIWI");
  cek("TGL YUDISIUM per baris, bukan satu untuk semua",
      hasil.baris[0].tanggalKeluar === "2026-06-07" && hasil.baris[1].tanggalKeluar === "2026-07-24",
      `${hasil.baris[0].tanggalKeluar} / ${hasil.baris[1].tanggalKeluar}`);
  cek("semester ikut per baris", hasil.baris[0].semester === "20262" && hasil.baris[1].semester === "20262");
  cek("IPK dipetakan ke IP Kumulatif", hasil.baris[1].ipk === "3.80", hasil.baris[1].ipk);
  cek("Kode Prodi dari kolomnya", hasil.baris[0].kodeProdi === "70201", hasil.baris[0].kodeProdi);
  cek("Jenis Keluar bawaan Lulus", hasil.baris[0].jenisKeluar === "1");
  cek("tanggal tak terbaca disimpan apa adanya untuk diperbaiki",
      hasil.baris[2].tanggalKeluar === "" && hasil.baris[2].tanggalAsli === "tanggal belum ada");
  cek("predikat ikut terbaca", hasil.baris[0].predikat === "CUM LAUDE");
  cek("nomor SK terangkat dari kop", nomorSkDariLembar(LEMBAR_CONTOH) === "003/KEP/III.3.AU/F/FISIP/2026", nomorSkDariLembar(LEMBAR_CONTOH));
  cek("prodi tertebak dari judul lembar", prodiDariLembar(LEMBAR_CONTOH, "YUDISIUM ILKOM") === "70201");

  // Lembar tanpa kolom KODE PRODI: prodinya jatuh ke tebakan judul lembar,
  // dan cadangan pilihan admin hanya dipakai kalau judulnya pun tidak bicara.
  const tanpaKolomProdi: Aoa = LEMBAR_CONTOH.map((b, i) =>
    i === 8 ? b.filter((_, k) => k !== 2) : i >= 9 ? (b.length ? b.filter((_, k) => k !== 2) : b) : b);
  const bacaTanpa = bacaLembarYudisium(tanpaKolomProdi, "YUDISIUM ILKOM", { jenisKeluar: "1", kodeProdiCadangan: "65201" });
  cek("judul lembar menang atas cadangan pilihan admin",
      bacaTanpa.baris[0].kodeProdi === "70201" && bacaTanpa.baris[0].prodiDariBerkas === true,
      `${bacaTanpa.baris[0].kodeProdi}/${bacaTanpa.baris[0].prodiDariBerkas}`);
  const bacaLain = bacaLembarYudisium(
    tanpaKolomProdi.map((b, i) => (i === 3 ? ["DATA YUDISIUM"] : b)),
    "LEMBAR1",
    { jenisKeluar: "1", kodeProdiCadangan: "65201" },
  );
  cek("cadangan dipakai bila berkasnya benar-benar bisu soal prodi",
      bacaLain.baris[0].kodeProdi === "65201" && bacaLain.baris[0].prodiDariBerkas === false,
      `${bacaLain.baris[0].kodeProdi}/${bacaLain.baris[0].prodiDariBerkas}`);

  console.log("\n== PEMERIKSAAN SEBELUM UNDUH ==");
  const masalah = periksaBaris(hasil.baris);
  cek("hanya baris bertanggal rusak yang ditahan", masalah.length === 1, JSON.stringify(masalah));
  cek("sebabnya menyebut tanggal aslinya", masalah[0]?.sebab.includes("tanggal belum ada"), masalah[0]?.sebab);

  const kembar: BarisKelulusan[] = [hasil.baris[0], { ...hasil.baris[0], id: "x" }];
  cek("NIM kembar tertangkap", periksaBaris(kembar).some((m) => m.sebab.includes("kembar")));

  const tanpaProdi: BarisKelulusan[] = [{ ...hasil.baris[0], kodeProdi: "" }];
  cek("Kode Prodi kosong ditahan", periksaBaris(tanpaProdi).length === 1);
  cek("kode prodi dari kolom berkas ditandai milik berkas", hasil.baris[0].prodiDariBerkas === true);
  const namaKosong: BarisKelulusan[] = [{ ...hasil.baris[0], nama: "", nomorSk: "", tanggalSk: "", keterangan: "" }];
  cek("kolom hijau kosong TIDAK menahan baris", periksaBaris(namaKosong).length === 0, JSON.stringify(periksaBaris(namaKosong)));

  console.log("\n== BERKAS .XLSX HASIL ==");
  const siap = hasil.baris.filter((b) => b.tanggalKeluar).map((b) => ({ ...b, nomorSk: "003/KEP/III.3.AU/F/FISIP/2026", tanggalSk: "2026-08-01" }));
  const blob = buatXlsxKelulusan(KOLOM_KELULUSAN, barisKeAoa(siap), NAMA_LEMBAR_PDDIKTI);
  cek("jenis isinya Excel, bukan zip", blob.type.includes("spreadsheetml.sheet"), blob.type);

  return blob.arrayBuffer().then((ab) => {
    const buf = Buffer.from(ab);
    cek("berawal tanda zip PK", buf[0] === 0x50 && buf[1] === 0x4b);

    // Dibaca pembaca sungguhan — inilah bedanya "zip berisi XML" dari "berkas
    // Excel yang benar-benar terbuka".
    const wb = XLSX.read(buf, { type: "buffer", cellStyles: true });
    cek("satu lembar bernama persis seperti template PDDIKTI",
        wb.SheetNames.length === 1 && wb.SheetNames[0] === NAMA_LEMBAR_PDDIKTI, wb.SheetNames.join(","));

    const ws = wb.Sheets[NAMA_LEMBAR_PDDIKTI];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as string[][];
    cek("sepuluh kolom, urut sama dengan template PDDIKTI",
        aoa[0].join("|") === KOLOM_KELULUSAN.map((k) => k.judul).join("|"), aoa[0].join("|"));
    cek("dua baris data ikut tertulis", aoa.length === 3, String(aoa.length));
    cek("baris pertama lengkap sepuluh kolom",
        aoa[1].join("|") === "2270201090|ALDINA PRATIWI|1|2026-06-07|20262|003/KEP/III.3.AU/F/FISIP/2026|2026-08-01|3.74||70201",
        aoa[1].join("|"));

    // NIM & kode prodi tetap teks. Kalau salah satunya tersimpan sebagai
    // angka, pengimpor di seberang menerima 2.27E+09.
    const nim = ws["A2"] as { t?: string; v?: unknown };
    cek("NIM tersimpan sebagai teks, bukan angka", nim?.t === "s", String(nim?.t));
    const ipk = ws["H2"] as { t?: string; v?: unknown };
    cek("IP Kumulatif tersimpan sebagai teks 3.74", ipk?.t === "s" && ipk?.v === "3.74", `${ipk?.t}/${String(ipk?.v)}`);

    // Warna judul: merah = wajib, hijau = boleh kosong.
    const xml = buf.toString("latin1");
    cek("warna merah PDDIKTI ada di berkas", xml.includes("FFFF0000"));
    cek("warna hijau PDDIKTI ada di berkas", xml.includes("FF00FF00"));
    cek("catatan judul kolom ikut terbungkus", xml.includes("xl/comments1.xml"));
    cek("kotak catatan (VML) ikut, tanpa itu Excel mengeluh rusak", xml.includes("xl/drawings/vmlDrawing1.vml"));

    const komentar = (ws["!comments"] ?? (ws["A1"] as { c?: Array<{ t: string }> })?.c) as Array<{ t: string }> | undefined;
    cek("catatan NIM terbaca kembali", Boolean(komentar?.[0]?.t?.includes("wajib disi")), JSON.stringify(komentar?.[0]?.t));

    console.log("\n== BERKAS YUDISIUM SUNGGUHAN (bila ada) ==");
    const asli = "/root/.claude/uploads/7b6e93ca-c58d-57db-b5b1-526956c1cc5b/f0b7cc48-DATA_WISUDAWAN_FISIP_20252026_1.xlsx";
    if (existsSync(asli)) {
      const wbAsli = XLSX.readFile(asli);
      let total = 0;
      let bermasalah = 0;
      const tanggalUnik = new Set<string>();
      for (const nama of wbAsli.SheetNames) {
        const lembar = XLSX.utils.sheet_to_json(wbAsli.Sheets[nama], { header: 1, defval: "", raw: false }) as Aoa;
        const baca = bacaLembarYudisium(lembar, nama, { jenisKeluar: "1", kodeProdiCadangan: "" });
        total += baca.baris.length;
        bermasalah += periksaBaris(baca.baris).length;
        baca.baris.forEach((b) => tanggalUnik.add(b.tanggalKeluar));
      }
      cek("363 wisudawan terbaca dari dua lembar", total === 363, String(total));
      cek("tidak ada baris bermasalah", bermasalah === 0, String(bermasalah));
      cek("tanggal lulusnya memang berbeda-beda, bukan satu untuk semua",
          tanggalUnik.size >= 15 && !tanggalUnik.has(""), `${tanggalUnik.size} tanggal berbeda`);
    } else {
      console.log("  (dilewati: berkas contoh tidak ada di mesin ini)");
    }

    const keluar = process.env.UJI_KELUARAN;
    if (keluar) writeFileSync(keluar, buf);

    console.log(`\n${lulus} lulus, ${gagal} gagal`);
    if (gagal > 0) process.exit(1);
  });
}

void jalan();
