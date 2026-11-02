// ============================================================
// PENULIS PDF SEDERHANA — tanpa pustaka, tanpa jendela cetak
//
// Laporan penilaian tugas harus turun sebagai berkas .pdf SUNGGUHAN, satu per
// mahasiswa, puluhan sekaligus. Jendela cetak yang dipakai portal untuk surat
// tugas dan naskah soal tidak dapat melakukannya: empat puluh mahasiswa berarti
// empat puluh kali menekan "Simpan sebagai PDF" dan mengetik empat puluh nama
// berkas. Karena itu berkas ini MENULIS PDF-nya sendiri, sama seperti
// src/lib/zip.ts menulis zip sendiri.
//
// Yang ditulis sengaja sempit, dan cukup untuk sebuah laporan:
//   judul, paragraf (dengan **tebal** dan *miring*), garis, daftar berbutir
//   atau bernomor, tabel bergaris dengan baris kepala, dan kaki halaman
//   bernomor "Halaman 1 dari 2".
//
// HURUFNYA HELVETICA BAWAAN PDF. Empat huruf standar (biasa, tebal, miring,
// tebal-miring) dijamin ada di setiap pembaca PDF, jadi tidak ada berkas huruf
// yang perlu ditanam dan berkasnya tetap belasan KB. Penyandiannya WinAnsi:
// seluruh huruf bahasa Indonesia, tanda petik lengkung, tanda pisah, dan
// butir "•" tercakup. Huruf di luar itu (emoji, panah, ≥) diganti padanannya
// atau dibuang, bukan dibiarkan menjadi kotak kosong.
//
// SELURUHNYA FUNGSI MURNI: masuk blok, keluar Uint8Array. Berjalan sama di
// peramban maupun di Node, sehingga isinya diuji apa adanya oleh
// uji-penilaian-tugas.ts (dibaca ulang dengan pdfjs dan pdftotext).
// ============================================================

/** Satu blok isi laporan. Teks boleh memuat **tebal** dan *miring*. */
export type BlokPdf =
  | { jenis: "judul"; teks: string; tingkat?: 1 | 2 | 3 }
  | { jenis: "paragraf"; teks: string; ukuran?: number; tebal?: boolean; menjorok?: number }
  | { jenis: "garis" }
  | { jenis: "jarak"; pt: number }
  | { jenis: "daftar"; butir: string[]; bernomor?: boolean; ukuran?: number }
  | {
      jenis: "tabel";
      /** Perbandingan lebar kolom, mis. [1, 2.6, 0.5]. */
      lebar: number[];
      baris: string[][];
      /** Baris pertama adalah kepala: diberi latar dan diulang di halaman baru. */
      kepala?: boolean;
      /** Kolom yang seluruh isinya ditulis tebal, mis. [0]. */
      kolomTebal?: number[];
      /** Kolom yang isinya rata tengah, mis. [2] untuk skor. */
      kolomTengah?: number[];
      ukuran?: number;
    };

export type OpsiPdf = {
  judul?: string;
  penulis?: string;
  /** Teks kecil di kiri kaki tiap halaman. */
  kaki?: string;
};

// ------------------------------------------------------------
// UKURAN HURUF HELVETICA (per 1000 satuan), kode WinAnsi 32..255
// Diambil dari metrik AFM resmi Adobe untuk Helvetica dan Helvetica-Bold.
// Miring memakai lebar yang sama dengan pasangan tegaknya.
// ------------------------------------------------------------
const LEBAR_BIASA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 761,
  556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667,
  278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500,
];
const LEBAR_TEBAL = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 761,
  556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667,
  278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278,
  611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556,
];

// ------------------------------------------------------------
// PENYANDIAN WINANSI
// ------------------------------------------------------------

/** Huruf Unicode yang punya tempat di WinAnsi pada rentang 0x80–0x9F. */
const WINANSI_KHUSUS: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88,
  "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93,
  "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b,
  "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

/** Padanan untuk huruf yang tidak ada di WinAnsi sama sekali. */
const PADANAN: Record<string, string> = {
  "≥": ">=", "≤": "<=", "≠": "!=", "→": "->", "←": "<-", "⇒": "=>", "↔": "<->",
  "✓": "v", "✔": "v", "✗": "x", "✘": "x", "−": "-", "‐": "-", "‑": "-", "‒": "-", "―": "—",
  "′": "'", "″": "\"", "‧": "·", "∙": "·", "●": "•", "◦": "•", "▪": "•", "■": "•", "➢": "•",
  "≈": "~", "∼": "~", "∗": "*", "√": "v", "∞": "~", "​": "", "﻿": "", "­": "",
};

/**
 * Ubah teks menjadi untai berkode WinAnsi (satu huruf JS = satu bita).
 *
 * Huruf beraksen di luar Latin-1 (mis. "ă") dilepas aksennya; emoji dan
 * simbol yang tidak punya padanan dibuang. Tanda tanya tidak dipakai sebagai
 * pengganti: "Sangat baik?" di laporan nilai dibaca sebagai keraguan dosen.
 */
export function winAnsi(teks: string): string {
  let hasil = "";
  for (const huruf of String(teks ?? "").replace(/\t/g, "    ").replace(/\r/g, "")) {
    const kode = huruf.codePointAt(0) ?? 32;
    if (huruf === "\n") { hasil += "\n"; continue; }
    if (kode === 0xa0) { hasil += " "; continue; }
    if ((kode >= 32 && kode <= 126) || (kode >= 0xa1 && kode <= 0xff)) { hasil += huruf; continue; }
    if (WINANSI_KHUSUS[huruf] !== undefined) { hasil += String.fromCharCode(WINANSI_KHUSUS[huruf]); continue; }
    if (PADANAN[huruf] !== undefined) { hasil += winAnsi(PADANAN[huruf]); continue; }
    const polos = huruf.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    if (polos !== huruf && [...polos].every((h) => {
      const k = h.codePointAt(0) ?? 0;
      return (k >= 32 && k <= 126) || (k >= 0xa1 && k <= 0xff);
    })) { hasil += polos; continue; }
    // Selebihnya (emoji, aksara lain) dibuang.
  }
  return hasil;
}

// ------------------------------------------------------------
// UKURAN TEKS
// ------------------------------------------------------------

type Gaya = { tebal: boolean; miring: boolean };

function lebarHuruf(kode: number, tebal: boolean): number {
  if (kode < 32 || kode > 255) return 0;
  return (tebal ? LEBAR_TEBAL : LEBAR_BIASA)[kode - 32] || 0;
}

/** Lebar untai WinAnsi pada ukuran huruf tertentu, dalam pt. */
export function lebarTeks(teksWinAnsi: string, ukuran: number, tebal = false): number {
  let n = 0;
  for (let i = 0; i < teksWinAnsi.length; i += 1) n += lebarHuruf(teksWinAnsi.charCodeAt(i), tebal);
  return (n * ukuran) / 1000;
}

// ------------------------------------------------------------
// TANDA TEBAL DAN MIRING
// ------------------------------------------------------------

export type Potongan = { teks: string } & Gaya;

/**
 * Pecah teks bertanda **tebal** dan *miring* menjadi potongan bergaya.
 *
 * Hanya bintang. Garis bawah sengaja tidak dianggap tanda miring: nama berkas
 * seperti "Proposal_Final_v2.pdf" sering dikutip di umpan balik, dan miring
 * yang muncul di tengahnya membuat namanya tidak dapat dicari lagi.
 * Bintang tunggal yang tidak berpasangan tetap tertulis apa adanya.
 */
export function uraiGaya(teks: string, dasar: Partial<Gaya> = {}): Potongan[] {
  const hasil: Potongan[] = [];
  const tebalDasar = Boolean(dasar.tebal);
  const miringDasar = Boolean(dasar.miring);
  // Pola: **...** atau *...* (isi tidak diawali/diakhiri spasi).
  const pola = /\*\*(?=\S)([\s\S]*?\S)\*\*|\*(?=[^\s*])([^*\n]*?[^\s*])\*/g;
  let akhir = 0;
  for (const m of teks.matchAll(pola)) {
    const awal = m.index ?? 0;
    if (awal > akhir) hasil.push({ teks: teks.slice(akhir, awal), tebal: tebalDasar, miring: miringDasar });
    if (m[1] !== undefined) {
      // Isi tebal boleh memuat *miring* di dalamnya.
      for (const p of uraiGaya(m[1], { tebal: true, miring: miringDasar })) hasil.push(p);
    } else {
      hasil.push({ teks: m[2], tebal: tebalDasar, miring: true });
    }
    akhir = awal + m[0].length;
  }
  if (akhir < teks.length) hasil.push({ teks: teks.slice(akhir), tebal: tebalDasar, miring: miringDasar });
  return hasil.filter((p) => p.teks.length > 0);
}

// ------------------------------------------------------------
// PEMBUNGKUS BARIS
// ------------------------------------------------------------

type Kata = { teks: string; gaya: Gaya; spasi: boolean };
export type BarisTeks = Array<{ teks: string } & Gaya>;

/**
 * Bungkus teks bergaya ke dalam lebar tertentu.
 *
 * Pemenggalan per kata; kata yang lebih panjang dari satu baris (alamat
 * tautan, nama berkas) dipenggal per huruf supaya tidak keluar dari kolomnya.
 * Ganti baris di dalam teks dihormati.
 */
export function bungkus(teks: string, lebar: number, ukuran: number, dasar: Partial<Gaya> = {}): BarisTeks[] {
  const hasil: BarisTeks[] = [];
  for (const paragraf of winAnsi(teks).split("\n")) {
    const kata: Kata[] = [];
    // Spasi dibawa melintasi batas potongan: "Halo **dunia**" adalah dua
    // potongan, dan spasinya ada di ujung potongan pertama.
    let spasi = false;
    for (const p of uraiGaya(paragraf, dasar)) {
      const bagian = p.teks.split(/( +)/);
      for (const b of bagian) {
        if (b === "") continue;
        if (/^ +$/.test(b)) { spasi = true; continue; }
        // Potongan yang menempel pada kata sebelumnya (mis. "**tebal**,")
        // tidak diberi spasi.
        kata.push({ teks: b, gaya: { tebal: p.tebal, miring: p.miring }, spasi: kata.length === 0 ? false : spasi });
        spasi = false;
      }
    }

    let baris: BarisTeks = [];
    let lebarBaris = 0;
    const tutup = () => { hasil.push(baris); baris = []; lebarBaris = 0; };

    for (const k of kata) {
      const lebarSpasi = k.spasi && baris.length > 0 ? lebarTeks(" ", ukuran, k.gaya.tebal) : 0;
      let lebarKata = lebarTeks(k.teks, ukuran, k.gaya.tebal);

      if (baris.length > 0 && lebarBaris + lebarSpasi + lebarKata > lebar) tutup();

      // Kata yang sendirian pun tidak muat: penggal per huruf.
      let sisa = k.teks;
      while (lebarKata > lebar && sisa.length > 1) {
        let n = 1;
        while (n < sisa.length && lebarTeks(sisa.slice(0, n + 1), ukuran, k.gaya.tebal) <= lebar - lebarBaris) n += 1;
        baris.push({ teks: sisa.slice(0, n), ...k.gaya });
        tutup();
        sisa = sisa.slice(n);
        lebarKata = lebarTeks(sisa, ukuran, k.gaya.tebal);
      }
      const pakaiSpasi = baris.length > 0 && k.spasi;
      baris.push({ teks: (pakaiSpasi ? " " : "") + sisa, ...k.gaya });
      lebarBaris += (pakaiSpasi ? lebarTeks(" ", ukuran, k.gaya.tebal) : 0) + lebarKata;
    }
    tutup();
  }
  return hasil;
}

// ------------------------------------------------------------
// TATA LETAK
// ------------------------------------------------------------

const LEBAR_KERTAS = 595.28; // A4
const TINGGI_KERTAS = 841.89;
const TEPI_KIRI = 62;
const TEPI_KANAN = 62;
const TEPI_ATAS = 64;
const TEPI_BAWAH = 62;
const LEBAR_ISI = LEBAR_KERTAS - TEPI_KIRI - TEPI_KANAN;

const UKURAN_DASAR = 10.5;
const UKURAN_JUDUL: Record<1 | 2 | 3, number> = { 1: 15.5, 2: 12.5, 3: 11 };

function namaHuruf(g: Gaya) {
  if (g.tebal && g.miring) return "/F4";
  if (g.tebal) return "/F2";
  if (g.miring) return "/F3";
  return "/F1";
}

function lolosPdf(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const angka = (n: number) => (Math.round(n * 100) / 100).toString();

class Penata {
  halaman: string[][] = [];
  private isi: string[] = [];
  y = TINGGI_KERTAS - TEPI_ATAS;

  constructor() {
    this.halamanBaru();
  }

  halamanBaru() {
    this.isi = [];
    this.halaman.push(this.isi);
    this.y = TINGGI_KERTAS - TEPI_ATAS;
  }

  /** Pastikan masih ada ruang setinggi h; kalau tidak, pindah halaman. */
  pastikan(h: number) {
    if (this.y - h < TEPI_BAWAH) this.halamanBaru();
  }

  get sisa() {
    return this.y - TEPI_BAWAH;
  }

  tulisBaris(baris: BarisTeks, x: number, yGaris: number, ukuran: number, rata: "kiri" | "tengah" = "kiri", lebar = 0) {
    let xx = x;
    if (rata === "tengah") {
      const total = baris.reduce((n, p) => n + lebarTeks(p.teks, ukuran, p.tebal), 0);
      xx = x + Math.max(0, (lebar - total) / 2);
    }
    for (const p of baris) {
      if (!p.teks) continue;
      this.isi.push(`BT ${namaHuruf(p)} ${angka(ukuran)} Tf ${angka(xx)} ${angka(yGaris)} Td (${lolosPdf(p.teks)}) Tj ET`);
      xx += lebarTeks(p.teks, ukuran, p.tebal);
    }
  }

  garis(x1: number, y1: number, x2: number, y2: number, tebal = 0.6, abu = 0) {
    this.isi.push(`${angka(abu)} G ${angka(tebal)} w ${angka(x1)} ${angka(y1)} m ${angka(x2)} ${angka(y2)} l S 0 G`);
  }

  kotak(x: number, y: number, w: number, h: number, isiAbu: number | null) {
    if (isiAbu !== null) this.isi.push(`${angka(isiAbu)} g ${angka(x)} ${angka(y)} ${angka(w)} ${angka(h)} re f 0 g`);
    this.isi.push(`0.6 w ${angka(x)} ${angka(y)} ${angka(w)} ${angka(h)} re S`);
  }

  /** Paragraf atau judul yang dibungkus selebar isi. */
  teks(teks: string, ukuran: number, opsi: { tebal?: boolean; menjorok?: number; jarakBawah?: number } = {}) {
    const menjorok = opsi.menjorok ?? 0;
    const tinggi = ukuran * 1.32;
    for (const baris of bungkus(teks, LEBAR_ISI - menjorok, ukuran, { tebal: opsi.tebal })) {
      this.pastikan(tinggi);
      this.y -= tinggi;
      this.tulisBaris(baris, TEPI_KIRI + menjorok, this.y + ukuran * 0.28, ukuran);
    }
    this.y -= opsi.jarakBawah ?? 0;
  }

  daftar(butir: string[], bernomor: boolean, ukuran: number) {
    const tinggi = ukuran * 1.32;
    const menjorok = 16;
    butir.forEach((b, i) => {
      const tanda = bernomor ? `${i + 1}.` : "\u0095";
      const baris = bungkus(b, LEBAR_ISI - menjorok - 4, ukuran);
      baris.forEach((isi, j) => {
        this.pastikan(tinggi);
        this.y -= tinggi;
        const yTeks = this.y + ukuran * 0.28;
        if (j === 0) this.tulisBaris([{ teks: tanda, tebal: false, miring: false }], TEPI_KIRI + 3, yTeks, ukuran);
        this.tulisBaris(isi, TEPI_KIRI + menjorok + 4, yTeks, ukuran);
      });
      this.y -= 2;
    });
    this.y -= 4;
  }

  tabel(b: Extract<BlokPdf, { jenis: "tabel" }>) {
    const ukuran = b.ukuran ?? 9.5;
    const tinggi = ukuran * 1.3;
    const pad = 5;
    const jumlahLebar = b.lebar.reduce((n, x) => n + x, 0) || 1;
    const kolom = b.lebar.map((x) => (x / jumlahLebar) * LEBAR_ISI);
    const tebalKolom = new Set(b.kolomTebal ?? []);
    const tengahKolom = new Set(b.kolomTengah ?? []);

    const siapkan = (baris: string[], kepala: boolean) =>
      kolom.map((w, i) => bungkus(String(baris[i] ?? ""), w - pad * 2, ukuran, { tebal: kepala || tebalKolom.has(i) }));

    const kepala = b.kepala && b.baris.length > 0 ? siapkan(b.baris[0], true) : null;
    const tinggiBaris = (sel: BarisTeks[][]) => Math.max(1, ...sel.map((s) => s.length)) * tinggi + pad * 2;

    const gambarBaris = (sel: BarisTeks[][], dari: number, sampai: number, latar: boolean) => {
      const jumlah = sampai - dari;
      const h = Math.max(1, jumlah) * tinggi + pad * 2;
      let x = TEPI_KIRI;
      const yBawah = this.y - h;
      kolom.forEach((w, i) => {
        this.kotak(x, yBawah, w, h, latar ? 0.92 : null);
        sel[i].slice(dari, sampai).forEach((garis, j) => {
          const yTeks = this.y - pad - tinggi * (j + 1) + ukuran * 0.3;
          this.tulisBaris(garis, x + pad, yTeks, ukuran, tengahKolom.has(i) ? "tengah" : "kiri", w - pad * 2);
        });
        x += w;
      });
      this.y = yBawah;
    };

    const tulisKepala = () => {
      if (!kepala) return;
      this.pastikan(tinggiBaris(kepala) + tinggi * 2 + pad * 2);
      gambarBaris(kepala, 0, Math.max(1, ...kepala.map((s) => s.length)), true);
    };

    tulisKepala();
    for (const baris of b.baris.slice(kepala ? 1 : 0)) {
      const sel = siapkan(baris, false);
      const total = Math.max(1, ...sel.map((s) => s.length));
      let dari = 0;
      // Baris yang tidak muat dipindah utuh ke halaman berikutnya bila
      // memungkinkan; baris yang lebih tinggi dari satu halaman dipenggal.
      if (tinggiBaris(sel) > this.sisa && tinggiBaris(sel) <= TINGGI_KERTAS - TEPI_ATAS - TEPI_BAWAH - 40) {
        this.halamanBaru();
        tulisKepala();
      }
      while (dari < total) {
        const muat = Math.max(1, Math.floor((this.sisa - pad * 2) / tinggi));
        const sampai = Math.min(total, dari + muat);
        gambarBaris(sel, dari, sampai, false);
        dari = sampai;
        if (dari < total) {
          this.halamanBaru();
          tulisKepala();
        }
      }
    }
    this.y -= 8;
  }
}

/** Tata letak seluruh blok menjadi daftar perintah gambar per halaman. */
function tataLetak(blok: BlokPdf[]): string[][] {
  const p = new Penata();
  for (const b of blok) {
    switch (b.jenis) {
      case "judul": {
        const tingkat = b.tingkat ?? 2;
        const ukuran = UKURAN_JUDUL[tingkat];
        // Judul tidak boleh tertinggal sendirian di dasar halaman.
        if (p.sisa < ukuran * 1.4 + 60) p.halamanBaru();
        p.y -= tingkat === 1 ? 0 : 8;
        p.teks(b.teks, ukuran, { tebal: true, jarakBawah: tingkat === 1 ? 2 : 3 });
        break;
      }
      case "paragraf":
        p.teks(b.teks, b.ukuran ?? UKURAN_DASAR, { tebal: b.tebal, menjorok: b.menjorok, jarakBawah: 5 });
        break;
      case "garis":
        p.pastikan(10);
        p.y -= 3;
        p.garis(TEPI_KIRI, p.y, LEBAR_KERTAS - TEPI_KANAN, p.y, 0.8, 0.45);
        p.y -= 9;
        break;
      case "jarak":
        p.y -= b.pt;
        break;
      case "daftar":
        p.daftar(b.butir, Boolean(b.bernomor), b.ukuran ?? UKURAN_DASAR);
        break;
      case "tabel":
        if (b.baris.length > 0) p.tabel(b);
        break;
    }
  }
  return p.halaman;
}

// ------------------------------------------------------------
// PERAKITAN BERKAS
// ------------------------------------------------------------

/** Untai PDF (literal) dalam UTF-16BE, untuk judul dan penulis di info dokumen. */
function untaiInfo(s: string) {
  let hex = "FEFF";
  for (const h of s) {
    const kode = h.codePointAt(0) ?? 32;
    if (kode > 0xffff) continue;
    hex += kode.toString(16).padStart(4, "0").toUpperCase();
  }
  return `<${hex}>`;
}

function tanggalPdf(d: Date) {
  const dua = (n: number) => String(n).padStart(2, "0");
  return `D:${d.getUTCFullYear()}${dua(d.getUTCMonth() + 1)}${dua(d.getUTCDate())}` +
    `${dua(d.getUTCHours())}${dua(d.getUTCMinutes())}${dua(d.getUTCSeconds())}Z`;
}

/**
 * Rakit berkas PDF dari daftar blok.
 *
 * Aliran isi tidak dimampatkan: laporan dua halaman tetap belasan KB, dan
 * berkas yang dapat dibaca dengan mata telanjang jauh lebih mudah diperiksa
 * bila suatu hari ada yang tampil keliru.
 */
export function buatPdf(blok: BlokPdf[], opsi: OpsiPdf = {}, waktu = new Date()): Uint8Array {
  const halaman = tataLetak(blok);
  const n = halaman.length;

  // Kaki halaman ditulis sesudah tata letak, karena jumlah halamannya baru
  // diketahui di sini.
  halaman.forEach((isi, i) => {
    const ukuran = 7.5;
    const y = TEPI_BAWAH - 26;
    const kanan = winAnsi(`Halaman ${i + 1} dari ${n}`);
    const xKanan = LEBAR_KERTAS - TEPI_KANAN - lebarTeks(kanan, ukuran);
    isi.push(`0.45 g BT /F1 ${ukuran} Tf ${angka(xKanan)} ${y} Td (${lolosPdf(kanan)}) Tj ET 0 g`);
    if (opsi.kaki) {
      let kaki = winAnsi(opsi.kaki);
      const ruang = xKanan - TEPI_KIRI - 16;
      while (kaki.length > 3 && lebarTeks(kaki, ukuran) > ruang) kaki = kaki.slice(0, -2);
      if (kaki !== winAnsi(opsi.kaki)) kaki = kaki.trimEnd() + "\u0085";
      isi.push(`0.45 g BT /F3 ${ukuran} Tf ${TEPI_KIRI} ${y} Td (${lolosPdf(kaki)}) Tj ET 0 g`);
    }
  });

  const objek: string[] = [];
  // 1 katalog, 2 daftar halaman, 3-6 huruf, 7 info, lalu pasangan halaman+isi.
  const idHalaman = halaman.map((_, i) => 8 + i * 2);
  objek[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objek[2] = `<< /Type /Pages /Kids [${idHalaman.map((id) => `${id} 0 R`).join(" ")}] /Count ${n} >>`;
  const huruf = ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"];
  huruf.forEach((nama, i) => {
    objek[3 + i] = `<< /Type /Font /Subtype /Type1 /BaseFont /${nama} /Encoding /WinAnsiEncoding >>`;
  });
  objek[7] = `<< /Producer ${untaiInfo("SiPaling FISIP")} /CreationDate (${tanggalPdf(waktu)})` +
    (opsi.judul ? ` /Title ${untaiInfo(opsi.judul)}` : "") +
    (opsi.penulis ? ` /Author ${untaiInfo(opsi.penulis)}` : "") + " >>";
  halaman.forEach((isi, i) => {
    const idHal = idHalaman[i];
    const aliran = isi.join("\n");
    objek[idHal] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LEBAR_KERTAS} ${TINGGI_KERTAS}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ${idHal + 1} 0 R >>`;
    objek[idHal + 1] = `<< /Length ${aliran.length} >>\nstream\n${aliran}\nendstream`;
  });

  // Seluruh untai di atas hanya berisi huruf 0–255, jadi satu huruf = satu bita.
  let keluaran = "%PDF-1.4\n%âãÏÓ\n";
  const letak: number[] = [];
  for (let id = 1; id < objek.length; id += 1) {
    letak[id] = keluaran.length;
    keluaran += `${id} 0 obj\n${objek[id]}\nendobj\n`;
  }
  const awalXref = keluaran.length;
  keluaran += `xref\n0 ${objek.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objek.length; id += 1) keluaran += `${String(letak[id]).padStart(10, "0")} 00000 n \n`;
  keluaran += `trailer\n<< /Size ${objek.length} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${awalXref}\n%%EOF\n`;

  const bita = new Uint8Array(keluaran.length);
  for (let i = 0; i < keluaran.length; i += 1) bita[i] = keluaran.charCodeAt(i) & 0xff;
  return bita;
}
