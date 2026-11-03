// ============================================================
// PLAGIASI ANTARKIRIMAN TUGAS — gerbang sebelum penilaian AI
//
// Membandingkan seluruh kiriman SATU tugas satu sama lain. Bukan dengan
// internet atau korpus luar: yang dapat diperiksa portal secara jujur adalah
// kiriman sekelas, dan di situlah salin-tempel antarmahasiswa terjadi.
//
// ------------------------------------------------------------
// KENAPA BUKAN RUMUS KEMIRIPAN JAWABAN ESAI CBT
// ------------------------------------------------------------
// src/lib/mirip-jawaban.ts dibuat untuk jawaban esai beberapa paragraf atas
// soal yang sama, dan sinyal urutannya memakai Jaccard. Untuk DOKUMEN UTUH
// Jaccard menyesatkan: bila B menyalin separuh isi A, irisan dibagi gabungan
// hanya ±33%, dan salinan yang nyata terbaca "rendah". Yang dipakai di sini
// adalah CAKUPAN (containment):
//
//   bagian A = urutan lima kata milik A yang juga ada di B ÷ seluruh urutan A
//
// Angkanya dapat dikatakan apa adanya kepada dosen dan mahasiswa: "45% isi
// kiriman ini sama persis, lima kata berturut-turut, dengan kiriman lain".
// Skor pasangan adalah yang lebih besar dari dua arah, karena ringkasan dua
// halaman yang seluruhnya disalin dari makalah sepuluh halaman adalah salinan
// penuh walaupun makalahnya hanya 20% sama dengan ringkasan itu.
//
// ------------------------------------------------------------
// YANG SENGAJA DIABAIKAN
// ------------------------------------------------------------
//   - Urutan kata yang muncul di SEPARUH KELAS atau lebih (minimal empat
//     kiriman): templat dari dosen, soal yang disalin ke lembar jawaban, kop
//     dan sampul seragam. Tanpa ini seluruh kelas saling "mirip".
//   - Teks yang diberikan dosen sendiri (petunjuk tugas), lewat `abaikan`.
//   - Kiriman di bawah 40 kata: terlalu pendek untuk persen yang bermakna.
//     Yang SAMA PERSIS tetap tertangkap.
//
// Berkas yang SAMA PERSIS (sidik SHA-256 sama) atau teks yang sama persis
// langsung 100%, tanpa rumus.
//
// Seperti mirip-jawaban.ts, label tertinggi berbunyi "terindikasi", bukan
// "terbukti". Keputusannya pada dosen (lolos/plagiasi), dan gerbangnya di
// src/lib/tugas-papan.ts.
//
// SELURUHNYA FUNGSI MURNI, diuji di uji-tugas-cbt.ts.
// ============================================================
import {
  bobotTfIdf, cosine, hitungDf, kalimatSama, kataDari, rapikanAmbang, statusMirip,
  type Ambang, type Sidik, type StatusMirip,
} from "@/lib/mirip-jawaban";

export const AMBANG_TUGAS: Ambang = { tinjau: 25, tinggi: 50 };
export const PANJANG_SIRAP = 5;
export const MIN_KATA_DOKUMEN = 40;
/** Kiriman perlu sekian urutan kata miliknya sendiri supaya persennya bermakna. */
const MIN_SIRAP_MILIK = 30;

export type DokumenBanding = {
  id: number;
  teks: string;
  /** SHA-256 berkas aslinya, bila ada. */
  sidikBerkas?: string;
};

export type SinyalTugas = {
  /** "berkas" = berkas identik; "teks" = teks identik; "" = tidak kembar. */
  kembar: "berkas" | "teks" | "";
  /** Banyaknya urutan lima kata yang sama. */
  sirapSama: number;
  /** Kesamaan kosakata berbobot (TF-IDF cosine), 0–100. Sekadar keterangan. */
  kosakata: number;
};

export type PasanganTugas = {
  /** id yang lebih kecil. */
  a: number;
  b: number;
  /** max(bagianA, bagianB), 0–100. */
  skor: number;
  /** Persen isi A yang sama dengan B. */
  bagianA: number;
  bagianB: number;
  status: StatusMirip;
  sinyal: SinyalTugas;
};

export type RingkasTugas = { skor: number; status: StatusMirip; lawan: number | null };

export type HasilPlagiasi = {
  pasangan: PasanganTugas[];
  ringkas: Map<number, RingkasTugas>;
  /** Urutan kata umum (templat, soal) yang diabaikan. */
  umum: number;
  ambang: Ambang;
};

/** Teks Markdown kiriman tanpa penanda halaman dan tanda Markdown. */
export function teksBanding(md: string): string {
  return String(md ?? "")
    .replace(/\[Halaman \d+\]/g, " ")
    .replace(/^\s*\|?\s*:?-{2,}[\s|:-]*$/gm, " ")
    .replace(/[#*_>|`~\\]/g, " ");
}

/** FNV-1a 32 bit. Urutan kata disimpan sebagai angka, bukan untai. */
function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function sirapDari(kata: string[]): Set<number> {
  const hasil = new Set<number>();
  for (let i = 0; i + PANJANG_SIRAP <= kata.length; i += 1) {
    hasil.add(fnv(kata.slice(i, i + PANJANG_SIRAP).join(" ")));
  }
  return hasil;
}

type Siap = {
  id: number;
  kata: string[];
  hitung: Map<string, number>;
  sirap: Set<number>;
  sidikBerkas: string;
  sidikTeks: string;
};

function siapkan(d: DokumenBanding): Siap {
  const kata = kataDari(teksBanding(d.teks));
  const hitung = new Map<string, number>();
  for (const k of kata) hitung.set(k, (hitung.get(k) ?? 0) + 1);
  const normal = kata.join(" ");
  return {
    id: d.id,
    kata,
    hitung,
    sirap: kata.length >= MIN_KATA_DOKUMEN ? sirapDari(kata) : new Set(),
    sidikBerkas: /^[0-9a-f]{64}$/.test(d.sidikBerkas ?? "") ? String(d.sidikBerkas) : "",
    sidikTeks: kata.length >= 8 ? `${kata.length}:${fnv(normal)}:${fnv(normal.split("").reverse().join(""))}` : "",
  };
}

/**
 * Periksa seluruh kiriman satu tugas.
 *
 * Pasangan dihitung lewat indeks terbalik: tiap urutan lima kata menunjuk
 * kiriman yang memuatnya, dan hanya urutan yang dipakai dua kiriman atau lebih
 * yang menyentuh hitungan pasangan. Seratus kiriman berarti 4.950 pasang,
 * tetapi kerjanya sebanding dengan jumlah kata, bukan dengan jumlah pasangan.
 */
export function periksaPlagiasi(
  dokumen: DokumenBanding[],
  ambangMasuk: Partial<Ambang> = {},
  opsi: { abaikan?: string[] } = {},
): HasilPlagiasi {
  const ambang = rapikanAmbang({ ...AMBANG_TUGAS, ...ambangMasuk });
  const siap = dokumen.map(siapkan);
  const n = siap.length;
  const ringkas = new Map<number, RingkasTugas>(siap.map((s) => [s.id, { skor: 0, status: "bersih" as StatusMirip, lawan: null }]));
  if (n < 2) return { pasangan: [], ringkas, umum: 0, ambang };

  // ---------- urutan kata yang diabaikan ----------
  const abaikan = new Set<number>();
  for (const t of opsi.abaikan ?? []) for (const s of sirapDari(kataDari(teksBanding(t)))) abaikan.add(s);

  const df = new Map<number, number>();
  for (const s of siap) for (const x of s.sirap) df.set(x, (df.get(x) ?? 0) + 1);
  const batasUmum = Math.max(4, Math.ceil(n * 0.5));
  let umum = 0;
  for (const [x, jumlah] of df) if (jumlah >= batasUmum && !abaikan.has(x)) umum += 1;
  const dipakai = (x: number) => !abaikan.has(x) && (df.get(x) ?? 0) < batasUmum;

  const milik = siap.map((s) => {
    let jumlah = 0;
    for (const x of s.sirap) if (dipakai(x)) jumlah += 1;
    return jumlah;
  });

  // ---------- indeks terbalik: hanya urutan yang dipakai bersama ----------
  const daftar = new Map<number, number[]>();
  siap.forEach((s, i) => {
    for (const x of s.sirap) {
      if ((df.get(x) ?? 0) < 2 || !dipakai(x)) continue;
      const l = daftar.get(x);
      if (l) l.push(i); else daftar.set(x, [i]);
    }
  });
  const sama = new Map<number, number>();
  for (const l of daftar.values()) {
    for (let p = 0; p < l.length; p += 1) {
      for (let q = p + 1; q < l.length; q += 1) {
        const kunci = l[p] * n + l[q];
        sama.set(kunci, (sama.get(kunci) ?? 0) + 1);
      }
    }
  }

  // ---------- kembar persis ----------
  const kembar = new Map<number, "berkas" | "teks">();
  const kelompokkan = (ambil: (s: Siap) => string, jenis: "berkas" | "teks") => {
    const peta = new Map<string, number[]>();
    siap.forEach((s, i) => {
      const k = ambil(s);
      if (!k) return;
      const l = peta.get(k);
      if (l) l.push(i); else peta.set(k, [i]);
    });
    for (const l of peta.values()) {
      for (let p = 0; p < l.length; p += 1) {
        for (let q = p + 1; q < l.length; q += 1) {
          const kunci = l[p] * n + l[q];
          if (!kembar.has(kunci)) kembar.set(kunci, jenis);
        }
      }
    }
  };
  kelompokkan((s) => s.sidikBerkas, "berkas");
  kelompokkan((s) => s.sidikTeks, "teks");

  // ---------- kosakata (keterangan saja) ----------
  const sidikKata: Sidik[] = siap.map((s) => ({
    attemptId: s.id, kata: s.kata, hitung: s.hitung, gram: new Set(), frasa: new Set(),
    jumlahKata: s.kata.length, jumlahKalimat: 1,
  }));
  const dfKata = hitungDf(sidikKata);
  const vektor = new Map<number, Map<string, number>>();
  const vek = (i: number) => {
    let v = vektor.get(i);
    if (!v) { v = bobotTfIdf(sidikKata[i], dfKata, n); vektor.set(i, v); }
    return v;
  };

  // ---------- pasangan ----------
  const batasSimpan = Math.max(1, Math.round(ambang.tinjau / 2));
  const kunciSemua = new Set<number>([...sama.keys(), ...kembar.keys()]);
  const pasangan: PasanganTugas[] = [];
  for (const kunci of kunciSemua) {
    const i = Math.floor(kunci / n);
    const j = kunci % n;
    const c = sama.get(kunci) ?? 0;
    const persen = (milikX: number) => (milikX >= MIN_SIRAP_MILIK ? Math.min(100, Math.round((c / milikX) * 100)) : 0);
    const jenisKembar = kembar.get(kunci) ?? "";
    let bagianI = persen(milik[i]);
    let bagianJ = persen(milik[j]);
    if (jenisKembar) { bagianI = 100; bagianJ = 100; }
    const skor = Math.max(bagianI, bagianJ);
    if (skor < batasSimpan) continue;
    const [kiri, kanan, bKiri, bKanan] = siap[i].id <= siap[j].id
      ? [siap[i], siap[j], bagianI, bagianJ]
      : [siap[j], siap[i], bagianJ, bagianI];
    pasangan.push({
      a: kiri.id,
      b: kanan.id,
      skor,
      bagianA: bKiri,
      bagianB: bKanan,
      status: statusMirip(skor, ambang),
      sinyal: { kembar: jenisKembar, sirapSama: c, kosakata: Math.round(cosine(vek(i), vek(j)) * 100) },
    });
  }
  pasangan.sort((x, y) => y.skor - x.skor || x.a - y.a || x.b - y.b);

  for (const p of pasangan) {
    for (const [siapa, lawan] of [[p.a, p.b], [p.b, p.a]] as const) {
      const ada = ringkas.get(siapa);
      if (ada && ada.skor >= p.skor) continue;
      ringkas.set(siapa, { skor: p.skor, status: p.status, lawan });
    }
  }
  return { pasangan, ringkas, umum, ambang };
}

/**
 * Kalimat yang sama persis pada dua kiriman, untuk ditunjukkan berdampingan.
 *
 * Angka 72% tidak dapat dibawa ke sidang akademik; kalimat yang sama huruf
 * demi huruf, bisa.
 */
export function cuplikanSama(teksA: string, teksB: string): string[] {
  return kalimatSama(teksBanding(teksA), teksBanding(teksB), 8);
}
