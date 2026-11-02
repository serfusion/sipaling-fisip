// ============================================================
// TEMPLATE LAPORAN PENILAIAN TUGAS — dibaca, dikenali, lalu diisi
//
// Dosen mengunggah template laporannya sendiri (Markdown, Word, atau teks)
// dan setiap mahasiswa mendapat satu PDF yang mengikuti template itu. Template
// bawaan adalah template yang dipakai dosen pengusul fitur ini, apa adanya.
//
// ------------------------------------------------------------
// BAGAIMANA ISIANNYA DITEMUKAN
// ------------------------------------------------------------
// Template ditulis untuk dibaca manusia, bukan mesin: tidak ada {{penanda}}
// di dalamnya, hanya tabel dengan kolom kanan yang kosong, baris "NILAI
// AKHIR:" tanpa angka, dan judul "A. Kelebihan Utama" dengan titik di
// bawahnya. Maka isiannya DIKENALI dari bentuk dan kata-katanya:
//
//   tabel dua kolom, kolom kanan kosong   → informasi tugas & mahasiswa,
//                                           diisi menurut label kirinya
//   tabel dengan kolom "Kriteria"         → satu baris per kriteria rubrik
//   baris "NILAI AKHIR ..."                → nilai akhir
//   baris "PREDIKAT ..." / "GRADE ..."     → huruf predikat
//   butir "Skor Kriteria 1 ..."            → satu butir per kriteria
//   label "Kelebihan" / "Strength"         → daftar kelebihan
//   label "Perlu Ditingkatkan" / "Improve" → daftar perbaikan
//   label "Catatan Khusus" / "Saran"       → catatan tindak lanjut
//   [Nomor dan Nama Tugas], [Nama], ...    → penanda dalam kurung siku
//   {{nama}}, {{nim}}, {{nilai}}, ...      → penanda eksplisit
//   judul bagian lain yang kosong          → diisi AI (bagian tambahan)
//
// Template yang tidak memuat tabel rubrik atau umpan balik sama sekali tetap
// menghasilkan laporan lengkap: bagian yang tidak ditemukan ditambahkan di
// akhir, bukan dihilangkan diam-diam.
//
// SELURUHNYA FUNGSI MURNI, diuji di uji-penilaian-tugas.ts.
// ============================================================
import { buatPdf, type BlokPdf } from "@/lib/pdf-sederhana";
import {
  ejaNilai, ejaRentang, type PredikatTugas, type RubrikTugas,
} from "@/lib/tugas-rubrik";

/** Template bawaan: persis template laporan yang dilampirkan dosen. */
export const TEMPLATE_BAWAAN = `# **LAPORAN PENILAIAN \\[Nomor dan Nama Tugas\\]**

**NAMA dan NIM**

## **1\\. Informasi Tugas & Mahasiswa**

---

| Mata Kuliah |  |
| :---- | :---- |
| **Tugas Ke-** |  |
| **Nama Mahasiswa** |  |
| **Judul Proposal** |  |

## **2\\. Nilai Akhir**

---

**NILAI AKHIR:**

**PREDIKAT (GRADE): A**

## **3\\. Rubrik Penilaian Analitis**

---

| Kriteria Penilaian | Deskripsi Capaian Mahasiswa | Skor   |
| :---- | :---- | ----- |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |

## **4\\. Penghitungan Nilai Akhir**

* Skor Kriteria 1
* Skor Kriteria 2
* Skor Kriteria 3
* Skor Kriteria 4
* Skor Kriteria 5

**NILAI AKHIR (RATA-RATA):**

**PREDIKAT (GRADE):**

## **5\\. Lembar Feedback / Catatan Evaluasi Dosen**

---

**A. Kelebihan Utama (Strengths)**

.

**B. Area yang Perlu Ditingkatkan (Areas for Improvement)**

**C. Catatan Khusus / Saran Tindak Lanjut**
`;

// ------------------------------------------------------------
// MARKDOWN → BLOK
// ------------------------------------------------------------

/** Buang garis miring pelolos Markdown: \[ \] \. \_ \# dan sejenisnya. */
function tanpaPelolos(s: string) {
  return s.replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, (_, h: string) => (h === "*" ? "∗" : h));
}

/** Teks polos: tanpa tanda tebal/miring, untuk dicocokkan dengan pola. */
export function polos(s: string) {
  return s.replace(/\*\*|\*/g, "").replace(/∗/g, "*").replace(/\s+/g, " ").trim();
}

function pecahSel(baris: string): string[] {
  let isi = baris.trim();
  if (isi.startsWith("|")) isi = isi.slice(1);
  if (isi.endsWith("|") && !isi.endsWith("\\|")) isi = isi.slice(0, -1);
  return isi.split(/(?<!\\)\|/).map((c) => tanpaPelolos(c.replace(/\\\|/g, "|").trim()).replace(/<br\s*\/?>/gi, "\n"));
}

const barisPemisah = (s: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(s);

/**
 * Urai Markdown sederhana menjadi blok PDF.
 *
 * Yang dikenali: judul (#), garis (---), tabel pipa, daftar (* - + 1.), dan
 * paragraf. Cukup untuk template laporan; Markdown yang lebih kaya (gambar,
 * kode, kutipan) diturunkan menjadi paragraf biasa, bukan dibuang.
 */
export function uraiMarkdown(md: string): BlokPdf[] {
  const baris = String(md ?? "").replace(/\r/g, "").split("\n");
  const blok: BlokPdf[] = [];
  let paragraf: string[] = [];
  let daftar: { butir: string[]; bernomor: boolean } | null = null;

  const tutupParagraf = () => {
    if (paragraf.length) blok.push({ jenis: "paragraf", teks: paragraf.join("") .trim() });
    paragraf = [];
  };
  const tutupDaftar = () => {
    if (daftar) blok.push({ jenis: "daftar", butir: daftar.butir, bernomor: daftar.bernomor });
    daftar = null;
  };
  const tutup = () => { tutupParagraf(); tutupDaftar(); };

  for (let i = 0; i < baris.length; i += 1) {
    const mentah = baris[i];
    const b = mentah.trim();
    if (!b) { tutup(); continue; }

    const judul = b.match(/^(#{1,6})\s+(.*)$/);
    if (judul) {
      tutup();
      const tingkat = Math.min(3, judul[1].length) as 1 | 2 | 3;
      const teks = tanpaPelolos(judul[2].replace(/\s#+\s*$/, "")).replace(/^\*\*(.*)\*\*$/, "$1").trim();
      blok.push({ jenis: "judul", tingkat, teks });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(b.replace(/\s/g, ""))) { tutup(); blok.push({ jenis: "garis" }); continue; }

    if (b.startsWith("|")) {
      tutup();
      const kumpul: string[] = [];
      while (i < baris.length && baris[i].trim().startsWith("|")) { kumpul.push(baris[i]); i += 1; }
      i -= 1;
      const adaPemisah = kumpul.length > 1 && barisPemisah(kumpul[1]);
      const isi = kumpul.filter((k) => !barisPemisah(k)).map(pecahSel);
      const lebar = Math.max(...isi.map((r) => r.length));
      const rapi = isi.map((r) => Array.from({ length: lebar }, (_, j) => r[j] ?? ""));
      blok.push({ jenis: "tabel", lebar: Array(lebar).fill(1), baris: rapi, kepala: adaPemisah });
      continue;
    }

    const butir = b.match(/^([*+-]|\d+[.)])\s+(.*)$/);
    if (butir) {
      tutupParagraf();
      const bernomor = /\d/.test(butir[1]);
      if (!daftar || daftar.bernomor !== bernomor) { tutupDaftar(); daftar = { butir: [], bernomor }; }
      daftar.butir.push(tanpaPelolos(butir[2]).trim());
      continue;
    }

    // Baris lanjutan butir daftar (menjorok).
    if (daftar && /^\s{2,}/.test(mentah)) {
      const d = daftar as { butir: string[] };
      d.butir[d.butir.length - 1] += " " + tanpaPelolos(b);
      continue;
    }

    tutupDaftar();
    const keras = /( {2,}|\\)$/.test(mentah);
    const teks = tanpaPelolos(b.replace(/\\$/, "")).replace(/<br\s*\/?>/gi, "\n");
    paragraf.push(paragraf.length ? (paragraf[paragraf.length - 1].endsWith("\n") ? teks : " " + teks) : teks);
    if (keras) paragraf[paragraf.length - 1] += "\n";
  }
  tutup();
  return blok;
}

/**
 * Template dari HTML (hasil mammoth untuk .docx) diubah ke Markdown lebih
 * dulu, supaya satu pengurai melayani keduanya. Tanpa DOM: berjalan sama di
 * peramban dan di uji Node.
 */
export function htmlKeMarkdown(html: string): string {
  let s = String(html ?? "");
  const entitas = (t: string) => t
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  s = s.replace(/<(strong|b)>/gi, "**").replace(/<\/(strong|b)>/gi, "**");
  s = s.replace(/<(em|i)>/gi, "*").replace(/<\/(em|i)>/gi, "*");
  s = s.replace(/\*\*\s*\*\*/g, "");
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n: string, t: string) => `\n\n${"#".repeat(Number(n))} ${t.replace(/<[^>]+>/g, "").trim()}\n\n`);
  s = s.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, isi: string) => {
    const baris = [...isi.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
      [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        c[1].replace(/<\/p>\s*<p[^>]*>/gi, "<br>").replace(/<(?!br)[^>]+>/gi, "").replace(/\|/g, "\\|").trim()),
    );
    if (baris.length === 0) return "";
    const lebar = Math.max(...baris.map((b) => b.length));
    const tulis = (b: string[]) => `| ${Array.from({ length: lebar }, (_, j) => b[j] ?? "").join(" | ")} |`;
    return `\n\n${tulis(baris[0])}\n|${" --- |".repeat(lebar)}\n${baris.slice(1).map(tulis).join("\n")}\n\n`;
  });
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t: string) => `\n* ${t.replace(/<[^>]+>/g, "").trim()}`);
  s = s.replace(/<\/(ul|ol)>/gi, "\n\n");
  s = s.replace(/<hr[^>]*>/gi, "\n\n---\n\n");
  s = s.replace(/<br\s*\/?>/gi, "  \n");
  s = s.replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "");
  return entitas(s).replace(/\n{3,}/g, "\n\n").trim();
}

// ------------------------------------------------------------
// PENGENALAN BAGIAN
// ------------------------------------------------------------

const P_KELEBIHAN = /kelebihan|kekuatan|strength|keunggulan|hal (yang )?baik/i;
const P_PERBAIKAN = /perlu (di)?tingkatkan|perbaikan|improvement|kelemahan|kekurangan|weakness/i;
// "Rekomendasi" sengaja tidak di sini: judul bagian "Rekomendasi" yang kosong
// diisi AI sebagai bagian tambahan, bukan dijadikan salinan catatan.
const P_CATATAN = /catatan (khusus|dosen|evaluasi|penilai)|saran|tindak lanjut|follow.?up/i;
const P_NILAI = /^nilai akhir\b/i;
const P_PREDIKAT = /^(predikat|grade|huruf mutu|nilai huruf)\b/i;
const P_SKOR_KRITERIA = /^skor\s+kriteria\b/i;

type JenisLabel = "kelebihan" | "perbaikan" | "catatan";

/**
 * Apakah blok ini LABEL bagian umpan balik ("**A. Kelebihan Utama**")?
 *
 * Label adalah judul, atau paragraf yang seluruhnya tebal dan pendek. Kalimat
 * biasa yang kebetulan memuat kata "saran" bukan label.
 */
function jenisLabel(b: BlokPdf): JenisLabel | null {
  let teks = "";
  if (b.jenis === "judul") teks = b.teks;
  else if (b.jenis === "paragraf" && /^\*\*[^*]+\*\*:?$/.test(b.teks.trim()) && polos(b.teks).length <= 90) teks = b.teks;
  else return null;
  const p = polos(teks);
  // "Lembar Feedback / Catatan Evaluasi Dosen" adalah judul bagian induk,
  // bukan label catatan.
  if (/lembar|feedback\s*\//i.test(p) && b.jenis === "judul") return null;
  if (P_KELEBIHAN.test(p)) return "kelebihan";
  if (P_PERBAIKAN.test(p)) return "perbaikan";
  if (P_CATATAN.test(p)) return "catatan";
  return null;
}

const isianSemu = (b: BlokPdf) =>
  (b.jenis === "paragraf" && /^[.\s…_\-–—]*$|^\[.*\]$|^\(.*\)$/.test(polos(b.teks))) ||
  (b.jenis === "daftar" && b.butir.every((x) => !polos(x) || /^[.\s…_\-–—]*$/.test(polos(x))));

function tabelInfo(b: BlokPdf): boolean {
  return b.jenis === "tabel" && b.baris.length > 0 && b.baris[0].length === 2 &&
    b.baris.filter((r) => !polos(r[1] ?? "")).length >= Math.ceil(b.baris.length / 2) &&
    !b.baris[0].some((c) => /kriteria/i.test(polos(c)));
}

function tabelRubrik(b: BlokPdf): boolean {
  return b.jenis === "tabel" && b.baris.length > 0 && b.baris[0].some((c) => /kriteria|aspek|komponen/i.test(polos(c)));
}

/** Ringkasan isian yang ditemukan pada template, untuk layar dosen dan perintah AI. */
export type AnalisisTemplate = {
  tabelInfo: boolean;
  tabelRubrik: boolean;
  nilaiAkhir: boolean;
  predikat: boolean;
  daftarSkor: boolean;
  kelebihan: boolean;
  perbaikan: boolean;
  catatan: boolean;
  /** Judul bagian yang kosong dan tidak dikenali: isinya diminta dari AI. */
  bagianBebas: string[];
  /** Label baris tabel informasi yang tidak dikenali (diisi tanda pisah). */
  labelAsing: string[];
};

export function analisisTemplate(blok: BlokPdf[]): AnalisisTemplate {
  const hasil: AnalisisTemplate = {
    tabelInfo: false, tabelRubrik: false, nilaiAkhir: false, predikat: false, daftarSkor: false,
    kelebihan: false, perbaikan: false, catatan: false, bagianBebas: [], labelAsing: [],
  };
  blok.forEach((b, i) => {
    if (b.jenis === "tabel" && tabelInfo(b)) {
      hasil.tabelInfo = true;
      for (const r of b.baris) if (nilaiLabel(r[0], null) === undefined) hasil.labelAsing.push(polos(r[0]));
    }
    if (tabelRubrik(b)) hasil.tabelRubrik = true;
    if (b.jenis === "paragraf" && P_NILAI.test(polos(b.teks))) hasil.nilaiAkhir = true;
    if (b.jenis === "paragraf" && P_PREDIKAT.test(polos(b.teks))) hasil.predikat = true;
    if (b.jenis === "daftar" && b.butir.some((x) => P_SKOR_KRITERIA.test(polos(x)))) hasil.daftarSkor = true;
    const label = jenisLabel(b);
    if (label) hasil[label] = true;
    if (b.jenis === "judul" && !label && i > 0) {
      // Bagian kosong: sesudah judulnya (dan garis) langsung judul lain atau akhir.
      let j = i + 1;
      while (j < blok.length && (blok[j].jenis === "garis" || isianSemu(blok[j]))) j += 1;
      if (j >= blok.length || blok[j].jenis === "judul") hasil.bagianBebas.push(polos(b.teks));
    }
  });
  return hasil;
}

// ------------------------------------------------------------
// PENGISIAN
// ------------------------------------------------------------

export type PerbaikanTugas = { aspek: string; uraian: string };

export type DataLaporan = {
  tugas: { mataKuliah: string; nomor: string; nama: string; dosen?: string; kelas?: string };
  mahasiswa: { nama: string; nim: string; kelas?: string };
  judulKarya: string;
  rubrik: RubrikTugas;
  skor: Array<number | null>;
  capaian: string[];
  nilai: number;
  rataBiasa: boolean;
  predikat: PredikatTugas;
  kelebihan: string[];
  perbaikan: PerbaikanTugas[];
  catatan: string;
  bagianTambahan: Array<{ judul: string; isi: string }>;
  /** Mis. "2 November 2026". */
  tanggal: string;
};

/** "TUGAS 2: PROPOSAL PROGRAM PR" atau "Tugas 2: Proposal ..." menurut konteks. */
export function judulTugas(t: DataLaporan["tugas"]): string {
  const nomor = t.nomor.trim();
  const nama = t.nama.trim();
  if (nomor && nama) return `Tugas ${nomor}: ${nama}`;
  if (nomor) return `Tugas ${nomor}`;
  return nama || "Tugas";
}

const huruf = (teks: string, kapital: boolean) => (kapital ? teks.toUpperCase() : teks);

/**
 * Nilai untuk satu label (tabel informasi atau penanda kurung siku).
 * undefined = label tidak dikenali.
 */
function nilaiLabel(label: string, d: DataLaporan | null): string | undefined {
  const l = polos(label).toLowerCase().replace(/[:\-–]+$/, "").trim();
  const isi = (v: string | undefined) => (d ? (v ?? "").trim() || "–" : "");
  if (!l) return undefined;
  if (/nomor dan nama tugas|nama tugas|judul tugas/.test(l)) return d ? judulTugas(d.tugas) : "";
  if (/^tugas( ke)?/.test(l)) return isi(d ? (d.tugas.nomor || d.tugas.nama) : "");
  if (/mata ?kuliah|matkul|mata uji/.test(l)) return isi(d?.tugas.mataKuliah);
  if (/nama.*(dan|&|\/).*(nim|npm)/.test(l)) return d ? `${isi(d.mahasiswa.nama)} (${isi(d.mahasiswa.nim)})` : "";
  if (/^(nim|npm|nomor induk|no\.? induk)/.test(l)) return isi(d?.mahasiswa.nim);
  if (/^nama( mahasiswa| lengkap| peserta)?$/.test(l)) return isi(d?.mahasiswa.nama);
  if (/judul|tema|topik/.test(l)) return isi(d?.judulKarya);
  if (/dosen|pengampu|penilai/.test(l)) return isi(d?.tugas.dosen);
  if (/kelas/.test(l)) return isi(d ? (d.mahasiswa.kelas || d.tugas.kelas) : "");
  if (/tanggal/.test(l)) return isi(d?.tanggal);
  if (/^nilai( akhir)?$/.test(l)) return d ? ejaNilai(d.nilai) : "";
  if (/predikat|grade/.test(l)) return d ? d.predikat.huruf : "";
  return undefined;
}

/** Ganti penanda {{...}} dan [ ... ] di dalam teks. */
function gantiPenanda(teks: string, d: DataLaporan, kapitalKonteks: boolean): string {
  let hasil = teks.replace(/\{\{\s*([a-z_ ]+?)\s*\}\}/gi, (asli, kunci: string) => {
    const k = kunci.toLowerCase().replace(/_/g, " ");
    const peta: Record<string, string> = {
      "nama": d.mahasiswa.nama, "nim": d.mahasiswa.nim, "mata kuliah": d.tugas.mataKuliah,
      "matakuliah": d.tugas.mataKuliah, "tugas": judulTugas(d.tugas), "nomor tugas": d.tugas.nomor,
      "nama tugas": d.tugas.nama, "judul": d.judulKarya, "nilai": ejaNilai(d.nilai),
      "predikat": d.predikat.huruf, "grade": d.predikat.huruf, "tanggal": d.tanggal,
      "dosen": d.tugas.dosen ?? "", "kelas": d.mahasiswa.kelas || d.tugas.kelas || "",
    };
    return peta[k] !== undefined ? peta[k] : asli;
  });
  hasil = hasil.replace(/\[([^\]\n]{2,60})\]/g, (asli, isi: string) => {
    const v = nilaiLabel(isi, d);
    return v === undefined ? asli : huruf(v, kapitalKonteks);
  });
  return hasil;
}

const kapital = (s: string) => {
  const hurufSaja = polos(s).replace(/\[[^\]]*\]|\{\{[^}]*\}\}/g, "").replace(/[^A-Za-z]/g, "");
  return hurufSaja.length >= 4 && hurufSaja === hurufSaja.toUpperCase();
};

/** Ambil bagian label sebelum titik dua: "**NILAI AKHIR (RATA-RATA):**" → "NILAI AKHIR (RATA-RATA)". */
function labelSebelumTitikDua(teks: string) {
  const p = polos(teks);
  const i = p.indexOf(":");
  return (i >= 0 ? p.slice(0, i) : p).trim();
}

/**
 * Isi template dengan hasil penilaian satu mahasiswa.
 *
 * Mengembalikan blok yang siap ditulis ke PDF.
 */
export function isiTemplate(blokTemplate: BlokPdf[], d: DataLaporan): BlokPdf[] {
  const keluar: BlokPdf[] = [];
  const rubrik = d.rubrik.kriteria;
  let predikatPertama = true;
  const terpakai = { rubrik: false, nilai: false, kelebihan: false, perbaikan: false, catatan: false };
  const nilaiTeks = `${ejaNilai(d.nilai)} / 100`;
  const tambahan = (judul: string) => {
    const k = polos(judul).toLowerCase().replace(/^[\d.a-z]\.?\s+/i, "").trim();
    return d.bagianTambahan.find((b) => {
      const kb = polos(b.judul).toLowerCase().replace(/^[\d.a-z]\.?\s+/i, "").trim();
      return kb === k || kb.includes(k) || k.includes(kb);
    });
  };

  const isiLabel = (jenis: JenisLabel) => {
    terpakai[jenis] = true;
    if (jenis === "kelebihan") {
      keluar.push({ jenis: "daftar", butir: d.kelebihan.length ? d.kelebihan : ["–"] });
    } else if (jenis === "perbaikan") {
      keluar.push({
        jenis: "daftar",
        butir: d.perbaikan.length
          ? d.perbaikan.map((p) => (p.aspek ? `**${p.aspek.replace(/\*/g, "")}:** ${p.uraian}` : p.uraian))
          : ["–"],
      });
    } else {
      for (const para of (d.catatan || "–").split(/\n{2,}/)) keluar.push({ jenis: "paragraf", teks: para.trim() });
    }
  };

  for (let i = 0; i < blokTemplate.length; i += 1) {
    const b = blokTemplate[i];

    // ---------- label umpan balik: label, lalu isinya, lewati isian semu ----------
    const label = jenisLabel(b);
    if (label) {
      if (b.jenis === "judul" || b.jenis === "paragraf") keluar.push({ ...b, teks: gantiPenanda(b.teks, d, kapital(b.teks)) });
      // Isi bawaan template di bawah label (titik, petunjuk, contoh) diganti.
      while (i + 1 < blokTemplate.length) {
        const n = blokTemplate[i + 1];
        if (n.jenis === "judul" || n.jenis === "garis" || n.jenis === "tabel" || jenisLabel(n)) break;
        if (n.jenis === "paragraf" && /^\*\*[^*]+\*\*/.test(n.teks.trim()) && polos(n.teks).length <= 90) break;
        i += 1;
      }
      isiLabel(label);
      continue;
    }

    switch (b.jenis) {
      case "judul": {
        keluar.push({ ...b, teks: gantiPenanda(b.teks, d, kapital(b.teks)) });
        const t = tambahan(b.teks);
        // Bagian kosong yang tidak dikenali diisi AI.
        let j = i + 1;
        while (j < blokTemplate.length && (blokTemplate[j].jenis === "garis" || isianSemu(blokTemplate[j]))) j += 1;
        const kosong = j >= blokTemplate.length || blokTemplate[j].jenis === "judul";
        if (kosong && t) {
          // Garis di bawah judul tetap dipertahankan.
          while (i + 1 < j) {
            i += 1;
            if (blokTemplate[i].jenis === "garis") keluar.push(blokTemplate[i]);
          }
          for (const para of t.isi.split(/\n{2,}/)) keluar.push({ jenis: "paragraf", teks: para.trim() });
        }
        break;
      }
      case "paragraf": {
        const p = polos(b.teks);
        const diganti = gantiPenanda(b.teks, d, kapital(b.teks));
        if (P_NILAI.test(p)) {
          let lbl = labelSebelumTitikDua(b.teks);
          if (!d.rataBiasa) lbl = lbl.replace(/\(\s*rata-?rata\s*\)/i, "(RATA-RATA TERBOBOT)");
          keluar.push({ jenis: "paragraf", teks: `**${lbl}: ${nilaiTeks}**` });
          terpakai.nilai = true;
        } else if (P_PREDIKAT.test(p)) {
          const lbl = labelSebelumTitikDua(b.teks);
          const rentang = predikatPertama ? ` (Grade ${d.predikat.huruf}: ${ejaRentang(d.predikat)})` : "";
          keluar.push({ jenis: "paragraf", teks: `**${lbl}: ${d.predikat.huruf}${rentang}**` });
          predikatPertama = false;
        } else if (/^nama\s+(dan|&)\s+nim$/i.test(p)) {
          const tebal = /^\*\*/.test(b.teks.trim());
          const isi = `${d.mahasiswa.nama || "–"} (NIM ${d.mahasiswa.nim || "–"})`;
          keluar.push({ jenis: "paragraf", teks: tebal ? `**${isi}**` : isi });
        } else if (diganti !== b.teks) {
          keluar.push({ ...b, teks: diganti });
        } else if (!isianSemu(b)) {
          // Titik atau tanda pisah sisa template tidak ikut tercetak.
          keluar.push(b);
        }
        break;
      }
      case "daftar": {
        if (b.butir.some((x) => P_SKOR_KRITERIA.test(polos(x)))) {
          keluar.push({
            jenis: "daftar",
            bernomor: b.bernomor,
            butir: rubrik.map((k, n) => {
              const s = d.skor[n];
              const bobot = d.rataBiasa ? "" : `, bobot ${k.bobot}%`;
              return `Skor Kriteria ${n + 1} (${k.nama}${bobot}): ${s === null || s === undefined ? "–" : s}`;
            }),
          });
        } else if (!isianSemu(b)) {
          keluar.push({ ...b, butir: b.butir.map((x) => gantiPenanda(x, d, false)) });
        }
        break;
      }
      case "tabel": {
        if (tabelRubrik(b)) {
          keluar.push(tabelKriteria(b, d));
          terpakai.rubrik = true;
        } else if (tabelInfo(b)) {
          keluar.push({
            jenis: "tabel",
            lebar: [1, 2.3],
            kolomTebal: [0],
            kepala: false,
            ukuran: 10,
            baris: b.baris.map((r) => {
              const v = nilaiLabel(r[0], d);
              const sudah = polos(r[1] ?? "");
              return [polos(r[0]), sudah ? gantiPenanda(r[1], d, false) : (v ?? "–")];
            }),
          });
        } else {
          keluar.push({ ...b, baris: b.baris.map((r) => r.map((c) => gantiPenanda(c, d, false))) });
        }
        break;
      }
      default:
        keluar.push(b);
    }
  }

  // ---------- yang tidak ditemukan pada template, ditambahkan ----------
  if (!terpakai.nilai) {
    keluar.push({ jenis: "judul", tingkat: 2, teks: "Nilai Akhir" }, { jenis: "garis" });
    keluar.push({ jenis: "paragraf", teks: `**NILAI AKHIR: ${nilaiTeks}**` });
    keluar.push({ jenis: "paragraf", teks: `**PREDIKAT (GRADE): ${d.predikat.huruf} (Grade ${d.predikat.huruf}: ${ejaRentang(d.predikat)})**` });
  }
  if (!terpakai.rubrik) {
    keluar.push({ jenis: "judul", tingkat: 2, teks: "Rubrik Penilaian" }, { jenis: "garis" });
    keluar.push(tabelKriteria({ jenis: "tabel", lebar: [1, 1, 1], kepala: true,
      baris: [["Kriteria Penilaian", "Deskripsi Capaian Mahasiswa", "Skor"]] }, d));
  }
  if (!terpakai.kelebihan || !terpakai.perbaikan || !terpakai.catatan) {
    keluar.push({ jenis: "judul", tingkat: 2, teks: "Umpan Balik" }, { jenis: "garis" });
    if (!terpakai.kelebihan) { keluar.push({ jenis: "paragraf", teks: "**Kelebihan Utama**" }); isiLabel("kelebihan"); }
    if (!terpakai.perbaikan) { keluar.push({ jenis: "paragraf", teks: "**Area yang Perlu Ditingkatkan**" }); isiLabel("perbaikan"); }
    if (!terpakai.catatan) { keluar.push({ jenis: "paragraf", teks: "**Catatan / Saran Tindak Lanjut**" }); isiLabel("catatan"); }
  }
  // Bagian tambahan dari AI yang judulnya tidak cocok dengan template tidak
  // dicetak: yang menentukan susunan laporan adalah template dosen.
  return keluar;
}

/** Tabel rubrik: kepala dari template, satu baris per kriteria. */
function tabelKriteria(b: Extract<BlokPdf, { jenis: "tabel" }>, d: DataLaporan): BlokPdf {
  const kepala = b.baris[0].map((c) => polos(c));
  const peran = kepala.map((c) => {
    const k = c.toLowerCase();
    if (/kriteria|aspek|komponen|indikator/.test(k)) return "nama";
    if (/deskripsi|capaian|uraian|komentar|catatan|keterangan|umpan|analisis/.test(k)) return "capaian";
    if (/bobot|%/.test(k)) return "bobot";
    if (/terbobot|kontribusi/.test(k)) return "terbobot";
    if (/skor|nilai|score|angka/.test(k)) return "skor";
    if (/^no\.?$|nomor/.test(k)) return "no";
    return "lain";
  });
  if (!peran.includes("capaian") && !peran.includes("skor")) {
    // Tabel kriteria tanpa kolom deskripsi maupun skor: kolom kedua dianggap
    // deskripsi dan kolom terakhir skor, supaya isinya tidak kosong.
    if (peran.length >= 2) peran[1] = "capaian";
    if (peran.length >= 3) peran[peran.length - 1] = "skor";
  }
  const lebarPeran: Record<string, number> = { nama: 1.15, capaian: 2.9, skor: 0.55, bobot: 0.6, terbobot: 0.7, no: 0.35, lain: 1 };
  const baris = d.rubrik.kriteria.map((k, n) => peran.map((p) => {
    const s = d.skor[n];
    switch (p) {
      case "nama": return `${n + 1}. ${k.nama}`;
      case "capaian": return d.capaian[n] || "–";
      case "skor": return s === null || s === undefined ? "–" : String(s);
      case "bobot": return `${k.bobot}%`;
      case "terbobot": return s === null || s === undefined ? "–" : (Math.round(s * k.bobot) / 100).toFixed(2);
      case "no": return String(n + 1);
      default: return "";
    }
  }));
  return {
    jenis: "tabel",
    lebar: peran.map((p) => lebarPeran[p]),
    kepala: true,
    kolomTebal: peran.flatMap((p, j) => (p === "nama" ? [j] : [])),
    kolomTengah: peran.flatMap((p, j) => (["skor", "bobot", "terbobot", "no"].includes(p) ? [j] : [])),
    baris: [kepala, ...baris],
  };
}

// ------------------------------------------------------------
// BERKAS PDF
// ------------------------------------------------------------

/** "PENILAIAN_TUGAS_2_-_Afifah_Meilina_23702010192.pdf", sama seperti contoh dosen. */
export function namaBerkasLaporan(d: Pick<DataLaporan, "tugas" | "mahasiswa">): string {
  const bersih = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[\\/:*?"<>|]/g, " ").replace(/[^\w\s.-]/g, "").trim().replace(/\s+/g, "_");
  const tugas = d.tugas.nomor.trim() ? `TUGAS_${bersih(d.tugas.nomor)}` : bersih(d.tugas.nama || "TUGAS").toUpperCase();
  const siapa = [bersih(d.mahasiswa.nama), bersih(d.mahasiswa.nim)].filter(Boolean).join("_") || "Mahasiswa";
  return `PENILAIAN_${tugas}_-_${siapa}`.slice(0, 150) + ".pdf";
}

export function buatLaporanPdf(
  template: string,
  d: DataLaporan,
  opsi: { kaki?: string } = {},
): Uint8Array {
  const blok = isiTemplate(uraiMarkdown(template || TEMPLATE_BAWAAN), d);
  return buatPdf(blok, {
    judul: `Laporan Penilaian ${judulTugas(d.tugas)} - ${d.mahasiswa.nama}`,
    penulis: d.tugas.dosen || undefined,
    kaki: opsi.kaki,
  });
}
