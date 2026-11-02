// ============================================================
// RUBRIK TUGAS — kriteria, bobot, nilai akhir, dan predikat
//
// Penilaian tugas berbeda dari penilaian esai CBT dalam satu hal yang
// menentukan: yang dinilai adalah KARYA UTUH (proposal, laporan, makalah)
// dan rubrik tugas yang dipakai dosen umumnya memberi SKOR 0–100 per
// kriteria, bukan level 1–4. Contoh laporan yang menjadi acuan fitur ini:
//
//   Kualitas Konsep & Riset          80
//   Perencanaan Program PR           84
//   Kualitas Pitch Letter            82
//   Target Media & KPI               82
//   Kerapian Dokumen                 75
//                                   ----
//   NILAI AKHIR (RATA-RATA)        80,60   →  A
//
// Maka rubrik tugas di sini cukup: nama kriteria, bobot, dan DESKRIPSI yang
// menampung apa pun yang ditulis dosen tentang kriteria itu, termasuk
// pita skor ("85–100: ..., 70–84: ...") atau deskriptor level. Model membaca
// deskripsinya; nilai akhirnya dihitung kode, bukan model.
//
// Nilai akhir = Σ (skor × bobot) ÷ 100. Bila bobotnya sama rata, itu persis
// rata-rata biasa seperti pada contoh.
//
// SELURUHNYA FUNGSI MURNI, diuji di uji-penilaian-tugas.ts.
// ============================================================
import { bacaBobot, type Aoa } from "@/lib/impor-rubrik";
import type { Rubrik } from "@/lib/rubrik";

export type KriteriaTugas = {
  nama: string;
  /** Persen, bilangan bulat. Jumlah seluruhnya 100. */
  bobot: number;
  /** Apa yang dinilai pada kriteria ini, termasuk pita skor atau level bila ada. */
  deskripsi: string;
};

export type RubrikTugas = {
  nama: string;
  kriteria: KriteriaTugas[];
};

/** Batas wajar supaya laporan tetap terbaca dan perintah ke AI tetap ringkas. */
export const MAKS_KRITERIA_TUGAS = 15;

// ------------------------------------------------------------
// BOBOT
// ------------------------------------------------------------

/**
 * Rapikan bobot supaya berjumlah tepat 100.
 *
 *   seluruhnya kosong            → dibagi rata (34/33/33)
 *   berjumlah lain (mis. 1 + 1)  → diskalakan, sisa pembulatan ke yang terbesar
 *   sudah 100                    → tidak disentuh
 *
 * Setiap perubahan dilaporkan lewat `catatan`, supaya dosen tahu bobot mana
 * yang tidak ia tulis sendiri.
 */
export function rapikanBobot(kriteria: KriteriaTugas[]): { kriteria: KriteriaTugas[]; catatan: string[] } {
  const catatan: string[] = [];
  if (kriteria.length === 0) return { kriteria, catatan };
  const salin = kriteria.map((k) => ({ ...k, bobot: Math.max(0, Math.round(Number(k.bobot) || 0)) }));
  const jumlah = salin.reduce((n, k) => n + k.bobot, 0);
  if (jumlah === 100) return { kriteria: salin, catatan };

  if (jumlah === 0) {
    const dasar = Math.floor(100 / salin.length);
    salin.forEach((k) => { k.bobot = dasar; });
    salin[0].bobot += 100 - dasar * salin.length;
    catatan.push(`Bobot tidak tertulis, jadi dibagi rata ke ${salin.length} kriteria.`);
    return { kriteria: salin, catatan };
  }

  const skala = salin.map((k) => (k.bobot * 100) / jumlah);
  salin.forEach((k, i) => { k.bobot = Math.floor(skala[i]); });
  let sisa = 100 - salin.reduce((n, k) => n + k.bobot, 0);
  // Sisa pembulatan diberikan pada pecahan terbesar lebih dulu.
  const urut = skala.map((s, i) => ({ i, pecahan: s - Math.floor(s) })).sort((a, b) => b.pecahan - a.pecahan);
  for (const { i } of urut) {
    if (sisa <= 0) break;
    salin[i].bobot += 1;
    sisa -= 1;
  }
  catatan.push(`Jumlah bobot tertulis ${jumlah}, disesuaikan menjadi 100% dengan perbandingan yang sama.`);
  return { kriteria: salin, catatan };
}

export function periksaRubrikTugas(r: RubrikTugas): { ok: true } | { ok: false; pesan: string } {
  if (r.kriteria.length === 0) return { ok: false, pesan: "Rubrik belum punya satu kriteria pun." };
  if (r.kriteria.length > MAKS_KRITERIA_TUGAS) {
    return { ok: false, pesan: `Kriteria paling banyak ${MAKS_KRITERIA_TUGAS}.` };
  }
  if (r.kriteria.some((k) => !k.nama.trim())) return { ok: false, pesan: "Ada kriteria yang namanya kosong." };
  const jumlah = r.kriteria.reduce((n, k) => n + k.bobot, 0);
  if (jumlah !== 100) {
    return { ok: false, pesan: `Jumlah bobot harus 100%, sekarang ${jumlah}%.` };
  }
  return { ok: true };
}

/** Rapikan rubrik yang datang dari luar (peramban, AI, penyimpanan lokal). */
export function rapikanRubrikTugas(masuk: unknown): RubrikTugas {
  const r = (masuk ?? {}) as { nama?: unknown; kriteria?: unknown };
  const kriteria = (Array.isArray(r.kriteria) ? r.kriteria : [])
    .slice(0, MAKS_KRITERIA_TUGAS)
    .map((k) => {
      const b = (k ?? {}) as Record<string, unknown>;
      return {
        nama: String(b.nama ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
        bobot: Math.max(0, Math.min(100, Math.round(Number(b.bobot) || 0))),
        deskripsi: String(b.deskripsi ?? "").replace(/\r/g, "").trim().slice(0, 4000),
      };
    })
    .filter((k) => k.nama !== "");
  return { nama: String(r.nama ?? "").trim().slice(0, 200), kriteria };
}

// ------------------------------------------------------------
// NILAI AKHIR
// ------------------------------------------------------------

/** Jepit skor ke 0–100, bilangan bulat. null bila bukan angka. */
export function skorAman(nilai: unknown): number | null {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const n = Number(String(nilai).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type HasilNilaiTugas = {
  /** 0–100, dua desimal. */
  nilai: number;
  /** Seluruh kriteria punya skor. */
  lengkap: boolean;
  /** Bobot seluruh kriteria sama: nilai akhirnya rata-rata biasa. */
  rataBiasa: boolean;
};

/**
 * Nilai akhir = Σ (skor × bobot) ÷ 100, dibulatkan dua desimal.
 *
 * Kriteria yang belum berskor dihitung nol dan dilaporkan lewat `lengkap`,
 * sama seperti hitungRubrik() pada esai CBT.
 */
export function hitungNilaiTugas(rubrik: RubrikTugas, skor: Array<number | null | undefined>): HasilNilaiTugas {
  let total = 0;
  let lengkap = rubrik.kriteria.length > 0;
  rubrik.kriteria.forEach((k, i) => {
    const s = skorAman(skor[i]);
    if (s === null) lengkap = false;
    total += ((s ?? 0) * k.bobot) / 100;
  });
  const bobot = rubrik.kriteria.map((k) => k.bobot);
  return {
    nilai: Math.max(0, Math.min(100, Math.round(total * 100) / 100)),
    lengkap,
    rataBiasa: bobot.every((b) => b === bobot[0]),
  };
}

/** "80.60", gaya laporan acuan (titik desimal, dua angka). */
export function ejaNilai(n: number): string {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

/** "79,5", angka Indonesia untuk rentang predikat. */
export function angkaId(n: number): string {
  const bulat = Math.round(n * 100) / 100;
  return String(bulat).replace(".", ",");
}

// ------------------------------------------------------------
// PREDIKAT
// ------------------------------------------------------------

export type TingkatPredikat = { huruf: string; batas: number };

/**
 * Tangga predikat bawaan: A mulai 79,5, sesuai acuan pada laporan contoh
 * ("Grade A: 79,5–100"). Tingkat di bawahnya memakai langkah sepuluh dengan
 * pembulatan yang sama. Dosen dapat menggantinya per tugas.
 */
export const SKALA_BAWAAN: TingkatPredikat[] = [
  { huruf: "A", batas: 79.5 },
  { huruf: "B", batas: 69.5 },
  { huruf: "C", batas: 59.5 },
  { huruf: "D", batas: 49.5 },
  { huruf: "E", batas: 0 },
];

/** Urutkan dari batas tertinggi, buang yang tidak sah, pastikan ada lantai 0. */
export function rapikanSkala(masuk: unknown): TingkatPredikat[] {
  const daftar = (Array.isArray(masuk) ? masuk : [])
    .map((t) => {
      const b = (t ?? {}) as Record<string, unknown>;
      return {
        huruf: String(b.huruf ?? "").trim().slice(0, 4),
        batas: Number(String(b.batas ?? "").replace(",", ".")),
      };
    })
    .filter((t) => t.huruf && Number.isFinite(t.batas) && t.batas >= 0 && t.batas <= 100)
    .sort((a, b) => b.batas - a.batas);
  if (daftar.length === 0) return SKALA_BAWAAN.map((t) => ({ ...t }));
  if (daftar[daftar.length - 1].batas > 0) daftar[daftar.length - 1] = { ...daftar[daftar.length - 1], batas: 0 };
  return daftar;
}

/** Tulis skala sebagai "A=79,5; B=69,5; ...", untuk satu kotak isian. */
export function ejaSkala(skala: TingkatPredikat[]): string {
  return skala.map((t) => `${t.huruf}=${angkaId(t.batas)}`).join("; ");
}

/** Baca kembali "A=79,5; B=69,5; C=59,5" atau "A 80, B 70". */
export function uraiSkala(teks: string): TingkatPredikat[] {
  const daftar = String(teks ?? "")
    .split(/[;\n]|,(?=\s*[A-Za-z])/)
    .map((p) => p.trim().match(/^([A-Za-z][A-Za-z+\-]{0,3})\s*(?:=|:|≥|>=|\s)\s*(\d+(?:[.,]\d+)?)/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ huruf: m[1].toUpperCase(), batas: Number(m[2].replace(",", ".")) }));
  return rapikanSkala(daftar);
}

export type PredikatTugas = { huruf: string; bawah: number; atas: number };

export function predikatTugas(nilai: number, skala: TingkatPredikat[] = SKALA_BAWAAN): PredikatTugas {
  const rapi = rapikanSkala(skala);
  const n = Number(nilai) || 0;
  for (let i = 0; i < rapi.length; i += 1) {
    if (n >= rapi[i].batas) {
      const atas = i === 0 ? 100 : Math.round((rapi[i - 1].batas - 0.01) * 100) / 100;
      return { huruf: rapi[i].huruf, bawah: rapi[i].batas, atas };
    }
  }
  const akhir = rapi[rapi.length - 1];
  return { huruf: akhir.huruf, bawah: 0, atas: akhir.batas };
}

/** "79,5–100" */
export function ejaRentang(p: PredikatTugas): string {
  return `${angkaId(p.bawah)}–${angkaId(p.atas)}`;
}

// ------------------------------------------------------------
// RUBRIK DARI SUMBER LAIN
// ------------------------------------------------------------

/**
 * Rubrik berlevel milik CBT (pustaka rubrik) dipakai untuk tugas.
 *
 * Deskriptor tiap level dipindah ke deskripsi, lengkap dengan pita skor yang
 * setara (level 3 dari 4 = 75), supaya model menilai dengan ukuran yang sama
 * dengan yang dipakai dosen di CBT.
 */
export function dariRubrikLevel(r: Rubrik): RubrikTugas {
  const rentang = Math.max(1, r.skalaMax);
  return {
    nama: r.nama,
    kriteria: r.kriteria.map((k) => ({
      nama: k.nama,
      bobot: k.bobot,
      deskripsi: k.levels
        .map((l) => `Level ${l.level} (setara ±${Math.round((l.level / rentang) * 100)}): ${l.deskriptor.trim() || "-"}`)
        .join("\n"),
    })),
  };
}

const sel = (v: unknown) => String(v ?? "").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();

/**
 * Baca rubrik dari TABEL apa pun yang punya kolom "Kriteria".
 *
 * Ini bentuk rubrik yang paling sering dimiliki dosen: tabel Excel atau Word
 * dengan kolom Kriteria, Bobot, lalu satu atau beberapa kolom deskripsi
 * ("Sangat Baik (85–100)", "Baik (70–84)", ...). Kolom selain nama dan bobot
 * digabung ke deskripsi BESERTA judul kolomnya, sehingga pita skor yang
 * tertulis di judul kolom tidak hilang.
 *
 * Mengembalikan null bila tidak ada tabel yang dapat dikenali; pemanggil
 * lalu menyerahkan teksnya kepada AI untuk disusun.
 */
export function bacaTabelRubrik(aoa: Aoa): { rubrik: RubrikTugas; catatan: string[] } | null {
  const baris = aoa.map((b) => (Array.isArray(b) ? b.map(sel) : []));
  const POLA_NAMA = /^(kriteria|aspek|komponen|indikator|unsur|kriteria penilaian|aspek penilaian|komponen penilaian)\b/i;
  let kepala = -1;
  let kolNama = -1;
  for (let i = 0; i < Math.min(baris.length, 25); i += 1) {
    const j = baris[i].findIndex((c) => POLA_NAMA.test(c));
    if (j >= 0) { kepala = i; kolNama = j; break; }
  }
  if (kepala < 0) return null;

  const judul = baris[kepala];
  const kolBobot = judul.findIndex((c, j) => j !== kolNama && /bobot|persen|%|weight/i.test(c));
  const lewati = new Set<number>([kolNama]);
  if (kolBobot >= 0) lewati.add(kolBobot);
  judul.forEach((c, j) => {
    // Nomor urut dan kolom skor kosong (tempat dosen menulis nilai) tidak
    // ikut ke deskripsi.
    if (/^(no\.?|nomor|#)$/i.test(c) || /^(skor|nilai|score|skor akhir|nilai akhir)$/i.test(c)) lewati.add(j);
  });

  const kriteria: KriteriaTugas[] = [];
  for (const b of baris.slice(kepala + 1)) {
    const nama = (b[kolNama] ?? "").replace(/^\d+[.)]\s*/, "").trim();
    if (/^(total|jumlah|nilai akhir|rata-rata)\b/i.test(nama)) break;
    const bagian: string[] = [];
    judul.forEach((jud, j) => {
      if (lewati.has(j)) return;
      const isi = b[j] ?? "";
      if (!isi) return;
      bagian.push(jud ? `${jud}: ${isi}` : isi);
    });
    if (!nama) {
      // Baris tanpa nama adalah sambungan baris sebelumnya (sel yang
      // digabung di Word/Excel).
      if (kriteria.length > 0 && bagian.length > 0) {
        const akhir = kriteria[kriteria.length - 1];
        akhir.deskripsi = [akhir.deskripsi, ...bagian].filter(Boolean).join("\n");
      }
      continue;
    }
    kriteria.push({
      nama: nama.slice(0, 200),
      bobot: kolBobot >= 0 ? bacaBobot(b[kolBobot]) : 0,
      deskripsi: bagian.join("\n").slice(0, 4000),
    });
  }
  if (kriteria.length === 0) return null;

  const catatan: string[] = [];
  let dipakai = kriteria;
  if (dipakai.length > MAKS_KRITERIA_TUGAS) {
    catatan.push(`Hanya ${MAKS_KRITERIA_TUGAS} kriteria pertama yang dipakai dari ${dipakai.length}.`);
    dipakai = dipakai.slice(0, MAKS_KRITERIA_TUGAS);
  }
  const rapi = rapikanBobot(dipakai);
  return { rubrik: { nama: "", kriteria: rapi.kriteria }, catatan: [...catatan, ...rapi.catatan] };
}
