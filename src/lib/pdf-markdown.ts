// ============================================================
// PDF → MARKDOWN — tugas mahasiswa disimpan sebagai .md, bukan PDF
//
// Permintaan pemilik portal: "setelah upload, otomatis tersusun .md di sistem
// kita (supaya tidak makan storage)". Empat puluh PDF tugas bergambar dapat
// mencapai ratusan MB; teksnya dalam Markdown jarang lebih dari 50 KB per
// mahasiswa. Yang dibutuhkan penilaian (AI dan dosen) dan pemeriksaan plagiasi
// memang teksnya, beserta susunannya: judul bagian, daftar, tabel, halaman.
//
// Penyusunan berjalan DI PERAMBAN PENGIRIM (mahasiswa di halaman CBT, dosen
// di dashboard), sehingga PDF-nya tidak pernah melewati batas unggah fungsi
// serverless dan tidak pernah singgah di server. Berkas ini juga berjalan di
// Node, supaya diuji apa adanya (uji-tugas-cbt.ts).
//
// ------------------------------------------------------------
// BAGAIMANA SUSUNANNYA DIKENALI
// ------------------------------------------------------------
// PDF tidak menyimpan "paragraf" atau "judul"; yang ada hanya potongan teks
// beserta letak dan ukuran hurufnya. Susunannya disimpulkan dari situ:
//
//   potongan pada ketinggian yang sama       → satu baris
//   celah lebar (> 2,2 em) di dalam baris     → batas sel tabel
//   dua baris atau lebih bersel sama          → tabel Markdown
//   huruf lebih besar dari huruf badan        → judul (#, ##, ###)
//   "BAB I", "1.2 Latar Belakang", "A. Tujuan", baris pendek berhuruf kapital
//                                             → judul ###/##
//   "•", "-", "1.", "a)" di awal baris        → butir daftar
//   jarak antarbaris > 1,45 × jarak lazim     → paragraf baru
//   kata terpenggal "komuni-" + "kasi"        → disambung kembali
//   nomor halaman, kepala & kaki yang berulang → dibuang
//
// Jarak lazim antarbaris diukur dari dokumennya sendiri, bukan ditetapkan:
// skripsi berspasi 2 dan makalah berspasi 1 harus sama-sama terbaca benar.
//
// Setiap halaman diberi penanda [Halaman N], bentuk yang sama dengan pembaca
// berkas v53, supaya umpan balik AI tetap dapat menunjuk nomor halaman.
// ============================================================

export type ButirTeks = {
  teks: string;
  /** Kiri potongan, dalam satuan PDF (pt), dari tepi kiri halaman. */
  x: number;
  /** Garis dasar potongan, dari tepi BAWAH halaman (arah PDF). */
  y: number;
  ukuran: number;
  lebar: number;
};

export type HalamanTeks = { nomor: number; lebar: number; tinggi: number; butir: ButirTeks[] };

export type HasilMarkdown = {
  markdown: string;
  /** Jumlah halaman PDF (seluruhnya, termasuk yang tidak dibaca). */
  halaman: number;
  kata: number;
  catatan: string[];
};

/** Batas wajar halaman yang dibaca; tugas yang lebih tebal jarang ada. */
export const MAKS_HALAMAN_MD = 400;

// ------------------------------------------------------------
// PEMBERSIHAN HURUF
// ------------------------------------------------------------

const LIGATUR: Record<string, string> = { "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st" };

/** Butir dari huruf Symbol/Wingdings yang terbaca sebagai huruf area pribadi. */
const BUTIR_PRIBADI = /[]/g;

function bersihkan(s: string): string {
  return s
    .replace(/[ﬀ-ﬆ]/g, (h) => LIGATUR[h] ?? h)
    .replace(BUTIR_PRIBADI, "•")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[   ]/g, " ")
    .replace(/[​-‍﻿­]/g, "");
}

/** Jumlah kata (huruf/angka berurutan). */
export function hitungKata(teks: string): number {
  const cocok = String(teks ?? "").replace(/\[Halaman \d+\]/g, "").match(/[\p{L}\p{N}]+/gu);
  return cocok ? cocok.length : 0;
}

// ------------------------------------------------------------
// BARIS
// ------------------------------------------------------------

type Sel = { teks: string; x: number; akhir: number };

type Baris = {
  sel: Sel[];
  teks: string;
  x: number;
  akhir: number;
  y: number;
  ukuran: number;
};

function ukuranDominan(butir: ButirTeks[]): number {
  const bobot = new Map<number, number>();
  for (const b of butir) {
    const k = Math.round(b.ukuran * 2) / 2;
    bobot.set(k, (bobot.get(k) ?? 0) + b.teks.length);
  }
  let terbaik = butir[0]?.ukuran ?? 10;
  let maks = -1;
  for (const [k, v] of bobot) if (v > maks || (v === maks && k > terbaik)) { maks = v; terbaik = k; }
  return terbaik;
}

/** Kelompokkan potongan teks satu halaman menjadi baris, atas ke bawah. */
function susunBaris(h: HalamanTeks): Baris[] {
  const butir = h.butir
    .map((b) => ({ ...b, teks: bersihkan(String(b.teks ?? "")), ukuran: Math.abs(Number(b.ukuran)) || 10, lebar: Math.max(0, Number(b.lebar) || 0) }))
    .filter((b) => b.teks.trim() !== "" && Number.isFinite(b.x) && Number.isFinite(b.y));
  butir.sort((a, b) => b.y - a.y || a.x - b.x);

  const kelompok: ButirTeks[][] = [];
  for (const b of butir) {
    const akhir = kelompok[kelompok.length - 1];
    if (akhir) {
      const acuan = akhir[0];
      const toleransi = Math.max(1.5, 0.45 * Math.min(acuan.ukuran, b.ukuran));
      if (Math.abs(acuan.y - b.y) <= toleransi) { akhir.push(b); continue; }
    }
    kelompok.push([b]);
  }

  const hasil: Baris[] = [];
  for (const g of kelompok) {
    g.sort((a, b) => a.x - b.x);
    const sel: Sel[] = [];
    let kini: Sel = { teks: "", x: g[0].x, akhir: g[0].x };
    let sebelum: ButirTeks | null = null;
    for (const b of g) {
      if (sebelum) {
        const celah = b.x - (sebelum.x + sebelum.lebar);
        const u = Math.max(sebelum.ukuran, b.ukuran, 1);
        if (celah > 2.2 * u && kini.teks.trim()) {
          sel.push(kini);
          kini = { teks: "", x: b.x, akhir: b.x };
        } else if (celah > 0.14 * u && !/\s$/.test(kini.teks) && !/^\s/.test(b.teks)) {
          kini.teks += " ";
        }
      }
      kini.teks += b.teks;
      kini.akhir = Math.max(kini.akhir, b.x + b.lebar);
      sebelum = b;
    }
    sel.push(kini);
    const rapi = sel.map((s) => ({ ...s, teks: s.teks.replace(/\s+/g, " ").trim() })).filter((s) => s.teks);
    if (!rapi.length) continue;
    hasil.push({
      sel: rapi,
      teks: rapi.map((s) => s.teks).join(" "),
      x: rapi[0].x,
      akhir: Math.max(...rapi.map((s) => s.akhir)),
      y: g[0].y,
      ukuran: ukuranDominan(g),
    });
  }
  return hasil;
}

// ------------------------------------------------------------
// KEPALA, KAKI, DAN NOMOR HALAMAN
// ------------------------------------------------------------

const NOMOR_HALAMAN =
  /^(?:hal(?:aman)?\.?\s*|page\s*)?[-–—(]?\s*(?:\d{1,4}|[ivxlcdm]{1,7})\s*[-–—)]?(?:\s*(?:\/|dari|of)\s*\d{1,4})?$/i;

/**
 * Buang nomor halaman dan kepala/kaki yang berulang.
 *
 * Hanya baris di pita atas atau bawah halaman (9% tinggi) yang diperiksa,
 * supaya angka atau kalimat di tengah isi tidak ikut terbuang. Kepala yang
 * berulang ("Proposal PR — Kelompok 3") juga dibuang dari perbandingan
 * plagiasi secara tidak langsung: tanpa ini, tiap halaman menambah kalimat
 * yang sama dan dokumen terlihat "mengulang dirinya sendiri".
 */
function buangKepalaKaki(halaman: Array<{ h: HalamanTeks; baris: Baris[] }>): void {
  const n = halaman.length;
  const diPita = (b: Baris, h: HalamanTeks) => b.y > h.tinggi * 0.91 || b.y < h.tinggi * 0.09;
  const kunci = (t: string) => t.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
  const hitung = new Map<string, number>();
  for (const { h, baris } of halaman) {
    const dilihat = new Set<string>();
    for (const b of baris) if (diPita(b, h)) dilihat.add(kunci(b.teks));
    for (const k of dilihat) hitung.set(k, (hitung.get(k) ?? 0) + 1);
  }
  const berulang = (k: string) => n >= 3 && (hitung.get(k) ?? 0) >= Math.max(2, Math.ceil(n * 0.5));
  for (const p of halaman) {
    p.baris = p.baris.filter((b) => !(diPita(b, p.h) && (NOMOR_HALAMAN.test(b.teks) || berulang(kunci(b.teks)))));
  }
}

// ------------------------------------------------------------
// JENIS BARIS
// ------------------------------------------------------------

const POLA_BUTIR = /^(?:[•●▪■◦○∙·➢➤►▶✓✔*]|[-–—](?=\s)|\(?\d{1,2}[.)]|\(?[a-z][.)])\s*(?=\S)/;
const POLA_BAB = /^BAB\s+(?:[IVXLC]+|\d{1,2})\b/i;
const POLA_SUBBAB = /^\d{1,2}(?:\.\d{1,2})+\.?\s+\S/;
const POLA_HURUF_BAGIAN = /^[A-Z]\.\s+\S/;

function kapitalSemua(t: string): boolean {
  const huruf = t.replace(/[^\p{L}]/gu, "");
  return huruf.length >= 4 && huruf === huruf.toUpperCase() && huruf !== huruf.toLowerCase();
}

const akhirKalimat = (t: string) => /[.!?:;"”)\]]$/.test(t.trim());

/** Tingkat judul (1–3), atau 0 bila baris ini bukan judul. */
function tingkatJudul(b: Baris, badan: number): number {
  const t = b.teks;
  const kata = t.split(/\s+/).length;
  if (b.sel.length > 1 || t.length > 150 || kata > 22) return 0;
  // Word: judul 16–20 pt, Heading 1 14–16 pt, badan 11–12 pt.
  const rasio = b.ukuran / badan;
  if (rasio >= 1.45) return 1;
  if (rasio >= 1.2) return 2;
  if (rasio >= 1.07) return 3;
  if (t.length > 90 || /[.,;]$/.test(t)) return 0;
  if (POLA_BAB.test(t)) return 2;
  if (POLA_SUBBAB.test(t) && kata <= 12) return 3;
  if (POLA_HURUF_BAGIAN.test(t) && kata <= 10) return 3;
  if (kapitalSemua(t) && kata <= 10 && !/^\d/.test(t)) return 3;
  return 0;
}

// ------------------------------------------------------------
// PENYUSUNAN
// ------------------------------------------------------------

type Blok =
  | { jenis: "judul"; tingkat: number; teks: string; y: number }
  | { jenis: "paragraf"; teks: string }
  | { jenis: "butir"; penanda: string; teks: string; xIsi: number }
  | { jenis: "tabel"; baris: string[][] };

function sambung(kiri: string, kanan: string): string {
  // Kata terpenggal di ujung baris: "komuni-" + "kasi". Tanda pisah yang
  // diikuti huruf kecil hampir selalu pemenggalan, bukan kata ulang.
  if (/\p{L}-$/u.test(kiri) && /^\p{Ll}/u.test(kanan)) return kiri.slice(0, -1) + kanan;
  return `${kiri} ${kanan}`;
}

function tabelMd(baris: string[][]): string {
  const lebar = Math.max(...baris.map((r) => r.length));
  const sel = (s: string) => s.replace(/\|/g, "\\|");
  const tulis = (r: string[]) => `| ${Array.from({ length: lebar }, (_, j) => sel(r[j] ?? "")).join(" | ")} |`;
  return [tulis(baris[0]), `|${" --- |".repeat(lebar)}`, ...baris.slice(1).map(tulis)].join("\n");
}

function lolosAwal(t: string): string {
  // Paragraf yang kebetulan diawali tanda Markdown tidak boleh berubah makna.
  return /^(#{1,6}\s|>\s?|[-+*]\s)/.test(t) ? `\\${t}` : t;
}

function tulisBlok(b: Blok): string {
  switch (b.jenis) {
    case "judul": return `${"#".repeat(b.tingkat)} ${b.teks}`;
    case "paragraf": return lolosAwal(b.teks);
    case "butir": return `${b.penanda} ${b.teks}`;
    case "tabel": return tabelMd(b.baris);
  }
}

function penandaButir(t: string): { penanda: string; sisa: string } {
  const m = t.match(POLA_BUTIR);
  if (!m) return { penanda: "-", sisa: t };
  const tanda = m[0].trim();
  const sisa = t.slice(m[0].length).trim();
  const angka = tanda.match(/^\(?(\d{1,2})[.)]$/);
  if (angka) return { penanda: `${Number(angka[1])}.`, sisa };
  const huruf = tanda.match(/^\(?([a-z])[.)]$/);
  if (huruf) return { penanda: "-", sisa: `${huruf[1]}) ${sisa}` };
  return { penanda: "-", sisa };
}

/**
 * Susun Markdown dari potongan teks berletak, halaman demi halaman.
 *
 * Fungsi murni: pembacaan PDF-nya ada di pdfKeMarkdown(). Dipisah supaya
 * aturan penyusunan dapat diuji dengan potongan buatan tangan.
 */
export function susunMarkdown(daftar: HalamanTeks[], opsi: { penandaHalaman?: boolean } = {}): string {
  const halaman = daftar.map((h) => ({ h, baris: susunBaris(h) }));
  buangKepalaKaki(halaman);
  const semua = halaman.flatMap((p) => p.baris);
  if (!semua.length) return "";

  // Ukuran huruf badan: yang menutupi huruf terbanyak.
  const bobot = new Map<number, number>();
  for (const b of semua) {
    const k = Math.round(b.ukuran * 2) / 2;
    bobot.set(k, (bobot.get(k) ?? 0) + b.teks.length);
  }
  let badan = 11;
  let maks = -1;
  for (const [k, v] of bobot) if (v > maks) { maks = v; badan = k; }

  // Jarak lazim antarbaris badan, dari dokumennya sendiri (median).
  const jarak: number[] = [];
  for (const { baris } of halaman) {
    for (let i = 1; i < baris.length; i += 1) {
      const d = baris[i - 1].y - baris[i].y;
      if (d > 0 && d < badan * 3.2 && Math.abs(baris[i].ukuran - badan) < 0.6) jarak.push(d);
    }
  }
  jarak.sort((a, b) => a - b);
  const lazim = jarak.length ? jarak[Math.floor(jarak.length / 2)] : badan * 1.25;
  const batasParagraf = lazim * 1.45;

  const penanda = opsi.penandaHalaman ?? true;
  const keluar: string[] = [];

  for (const { h, baris } of halaman) {
    if (penanda) keluar.push(`[Halaman ${h.nomor}]`);
    if (!baris.length) continue;

    const badanHalaman = baris.filter((b) => Math.abs(b.ukuran - badan) < 0.6 && b.sel.length === 1);
    const kiri = badanHalaman.length ? Math.min(...badanHalaman.map((b) => b.x)) : Math.min(...baris.map((b) => b.x));
    const kanan = badanHalaman.length ? Math.max(...badanHalaman.map((b) => b.akhir)) : Math.max(...baris.map((b) => b.akhir));

    const blok: Blok[] = [];
    let paragraf: { teks: string; y: number; akhir: number } | null = null;
    let butir: (Extract<Blok, { jenis: "butir" }> & { y: number }) | null = null;
    let tabel: { baris: string[][]; y: number } | null = null;

    const tutupParagraf = () => { if (paragraf) blok.push({ jenis: "paragraf", teks: paragraf.teks }); paragraf = null; };
    const tutupButir = () => { if (butir) blok.push({ jenis: "butir", penanda: butir.penanda, teks: butir.teks, xIsi: butir.xIsi }); butir = null; };
    const tutupTabel = () => {
      if (tabel) {
        if (tabel.baris.length >= 2) blok.push({ jenis: "tabel", baris: tabel.baris });
        else blok.push({ jenis: "paragraf", teks: tabel.baris[0].join(" | ") });
      }
      tabel = null;
    };
    const tutup = () => { tutupParagraf(); tutupButir(); tutupTabel(); };

    for (const b of baris) {
      // ---------- tabel: baris bersel lebih dari satu ----------
      if (b.sel.length >= 2) {
        tutupParagraf();
        tutupButir();
        const sel = b.sel.map((s) => s.teks);
        const t = tabel as { baris: string[][]; y: number } | null;
        if (t && t.y - b.y <= batasParagraf * 1.8) {
          t.baris.push(sel);
          t.y = b.y;
        } else {
          tutupTabel();
          tabel = { baris: [sel], y: b.y };
        }
        continue;
      }
      tutupTabel();

      // ---------- judul ----------
      const tingkat = tingkatJudul(b, badan);
      if (tingkat) {
        tutupParagraf();
        tutupButir();
        const lalu = blok[blok.length - 1];
        // Judul dua baris (mis. judul proposal di sampul) disatukan.
        if (lalu && lalu.jenis === "judul" && lalu.tingkat === tingkat && lalu.y - b.y <= lazim * 1.9 && tingkat <= 2) {
          lalu.teks = sambung(lalu.teks, b.teks);
          lalu.y = b.y;
        } else {
          blok.push({ jenis: "judul", tingkat, teks: b.teks, y: b.y });
        }
        continue;
      }

      // ---------- butir daftar ----------
      if (POLA_BUTIR.test(b.teks)) {
        tutupParagraf();
        tutupButir();
        const { penanda: p, sisa } = penandaButir(b.teks);
        butir = { jenis: "butir", penanda: p, teks: sisa, xIsi: b.x + b.ukuran, y: b.y };
        continue;
      }
      const bt = butir as (Extract<Blok, { jenis: "butir" }> & { y: number }) | null;
      if (bt) {
        // Sambungan butir: menjorok sejajar isi butir, tanpa jarak paragraf.
        if (b.x >= bt.xIsi - b.ukuran * 0.8 && bt.y - b.y <= batasParagraf) {
          bt.teks = sambung(bt.teks, b.teks);
          bt.y = b.y;
          continue;
        }
        tutupButir();
      }

      // ---------- paragraf ----------
      const p = paragraf as { teks: string; y: number; akhir: number } | null;
      if (p) {
        const renggang = p.y - b.y > batasParagraf;
        const habis = akhirKalimat(p.teks) && p.akhir < kanan - b.ukuran * 4;
        const menjorok = b.x > kiri + b.ukuran * 1.2 && akhirKalimat(p.teks);
        if (renggang || habis || menjorok) {
          tutupParagraf();
        } else {
          p.teks = sambung(p.teks, b.teks);
          p.y = b.y;
          p.akhir = b.akhir;
          continue;
        }
      }
      paragraf = { teks: b.teks, y: b.y, akhir: b.akhir };
    }
    tutup();

    // Butir berurutan dipisah satu baris baru, selebihnya satu baris kosong.
    // Daftar berbutir yang langsung disusul daftar bernomor tetap dipisah
    // baris kosong; tanpa itu Markdown membacanya sebagai satu daftar.
    const bernomor = (x: Blok) => x.jenis === "butir" && /\d/.test(x.penanda);
    let potong = "";
    blok.forEach((x, i) => {
      const sebelum = blok[i - 1];
      const satuDaftar = sebelum?.jenis === "butir" && x.jenis === "butir" && bernomor(sebelum) === bernomor(x);
      if (i > 0) potong += satuDaftar ? "\n" : "\n\n";
      potong += tulisBlok(x);
    });
    if (potong) keluar.push(potong);
  }

  return keluar.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ------------------------------------------------------------
// MEMBACA PDF (pdf.js)
// ------------------------------------------------------------

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsSiap: Promise<PdfJs> | null = null;

/** pdf.js dengan pekerja semu, sama seperti pembaca berkas tugas dan pemeriksa naskah. */
async function pdfjs(): Promise<PdfJs> {
  pdfjsSiap ??= (async () => {
    const [pdf, pekerja] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.mjs"),
    ]);
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = { WorkerMessageHandler: pekerja.WorkerMessageHandler };
    return pdf;
  })();
  return pdfjsSiap;
}

/** Potongan teks berletak tiap halaman PDF. Melempar galat yang dapat dibaca orang. */
export async function bacaHalamanPdf(
  data: Uint8Array,
  maksHalaman = MAKS_HALAMAN_MD,
  lapor?: (sudah: number, total: number) => void,
): Promise<{ halaman: HalamanTeks[]; total: number }> {
  const pdf = await pdfjs();
  const salin = new Uint8Array(data.byteLength);
  salin.set(data);
  const tugas = pdf.getDocument({ data: salin, disableFontFace: true, useSystemFonts: false, useWasm: false, verbosity: 0 });
  let dok: Awaited<typeof tugas.promise>;
  try {
    dok = await tugas.promise;
  } catch (alasan) {
    void tugas.destroy();
    const nama = (alasan as { name?: string })?.name ?? "";
    if (nama === "PasswordException") throw new Error("PDF ini dikunci kata sandi. Simpan ulang tanpa kata sandi lalu kumpulkan lagi.");
    throw new Error("Berkas ini bukan PDF yang dapat dibuka, atau berkasnya rusak.");
  }
  try {
    const hasil: HalamanTeks[] = [];
    const n = Math.min(dok.numPages, Math.max(1, maksHalaman));
    for (let i = 1; i <= n; i += 1) {
      const hal = await dok.getPage(i);
      const [x0, y0, x1, y1] = hal.view;
      const isi = await hal.getTextContent();
      const butir: ButirTeks[] = [];
      for (const it of isi.items) {
        if (!("str" in it) || !it.str) continue;
        const [a, b, c, d, e, f] = it.transform as number[];
        butir.push({
          teks: it.str,
          x: e - x0,
          y: f - y0,
          ukuran: Math.hypot(c, d) || Math.hypot(a, b) || it.height || 10,
          lebar: it.width || 0,
        });
      }
      hal.cleanup();
      hasil.push({ nomor: i, lebar: x1 - x0, tinggi: y1 - y0, butir });
      lapor?.(i, n);
    }
    return { halaman: hasil, total: dok.numPages };
  } finally {
    void dok.loadingTask.destroy();
  }
}

/** PDF → Markdown, beserta jumlah halaman, jumlah kata, dan catatan pembacaan. */
export async function pdfKeMarkdown(
  data: Uint8Array,
  opsi: { maksHalaman?: number; lapor?: (sudah: number, total: number) => void } = {},
): Promise<HasilMarkdown> {
  const { halaman, total } = await bacaHalamanPdf(data, opsi.maksHalaman ?? MAKS_HALAMAN_MD, opsi.lapor);
  const markdown = susunMarkdown(halaman);
  const kata = hitungKata(markdown);
  const catatan: string[] = [];
  if (total > halaman.length) catatan.push(`Hanya ${halaman.length} halaman pertama dari ${total} yang dibaca.`);
  if (kata < 20 * Math.max(1, halaman.length)) {
    catatan.push("Teksnya sangat sedikit. Kemungkinan PDF hasil pindaian atau foto, yang isinya tidak dapat dibaca sebagai teks.");
  }
  return { markdown, halaman: total, kata, catatan };
}
