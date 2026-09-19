// ============================================================
// PENILAIAN OTOMATIS TANPA MODEL
//
// Menilai esai dan isian singkat dari hal-hal yang dapat DIHITUNG: berapa
// panjang jawabannya, berapa banyak istilah dari soal yang muncul di dalamnya,
// dan seberapa tersusun kalimatnya. Tanpa jaringan, tanpa kunci API, tanpa
// biaya, dan hasilnya sama persis tiap kali dijalankan pada teks yang sama.
//
// ------------------------------------------------------------
// APA YANG SEBENARNYA DIUKUR, DAN APA YANG TIDAK
// ------------------------------------------------------------
// Ini TIDAK membaca jawaban. Ia tidak tahu apakah isinya benar, dan tidak akan
// pernah tahu. Jawaban panjang yang melantur mendapat angka yang sama dengan
// jawaban panjang yang tepat; jawaban dua kalimat yang justru paling tajam
// mendapat angka rendah.
//
// Itu bukan cacat yang disembunyikan, melainkan alasan bentuknya:
//
//   1. TIAP ANGKA MEMBAWA ALASANNYA. "218 kata · 7 dari 12 istilah soal · 9
//      kalimat" — pengajar membaca dasar angkanya, bukan angkanya saja, dan
//      dapat langsung melihat kapan ia keliru.
//   2. ANGKANYA USULAN, BUKAN PUTUSAN. Ia mengisi kolom AI pada lembar
//      penilaian, persis seperti usulan model. Level yang diubah pengajar
//      selalu menang, dan nilai baru berlaku sesudah SAHKAN ditekan.
//   3. DIBANDINGKAN DENGAN SEKELAS, BUKAN DENGAN ANGKA KERAMAT. Panjang yang
//      "cukup" berbeda antara soal yang minta definisi dan soal yang minta
//      analisis kasus. Yang dipakai karena itu kedudukan jawaban ini di antara
//      jawaban peserta lain pada SOAL YANG SAMA — cara yang sama dengan
//      pengajar yang membandingkan satu lembar dengan tumpukan di sebelahnya.
//      Ambang tetap hanya dipakai ketika pembandingnya belum cukup.
//
// Seluruh isi berkas ini murni: tidak ada basis data, tidak ada jaringan, tidak
// ada jam. Itu yang membuatnya dapat diuji, dan ia memang diuji di
// uji-nilai-lokal.ts.
// ============================================================

import type { LevelRubrik, Rubrik } from "@/lib/rubrik";
import { cosine, jaccard, ngram } from "@/lib/mirip-jawaban";

// ------------------------------------------------------------
// PEMBACAAN TEKS
// ------------------------------------------------------------

/**
 * Kata yang terlalu umum untuk menandakan apa pun.
 *
 * Dipakai saat menyusun istilah kunci dari soal: tanpa daftar ini, "yang",
 * "dan", "dengan" menjadi istilah kunci, dan setiap jawaban memuat semuanya —
 * cakupannya selalu 100% dan sinyalnya mati.
 */
/**
 * Kata yang ada di hampir setiap jawaban, apa pun soalnya.
 *
 * Diekspor supaya penilaian jawaban acuan dapat memakai daftar yang SAMA
 * ketika menyusun alasannya. Dua daftar kata umum yang terpisah berarti dua
 * daftar yang akan berbeda diam-diam.
 */
export const KATA_UMUM = new Set([
  "yang", "dan", "atau", "dengan", "untuk", "pada", "dari", "dalam", "adalah",
  "akan", "tidak", "bukan", "juga", "agar", "supaya", "karena", "sebab", "maka",
  "oleh", "jika", "bila", "saat", "ketika", "serta", "telah", "sudah", "masih",
  "dapat", "bisa", "harus", "lebih", "sangat", "hanya", "saja", "itu", "ini",
  "tersebut", "sebagai", "antara", "setiap", "banyak", "beberapa", "secara",
  "terhadap", "tentang", "melalui", "berikut", "berikan", "jelaskan",
  "sebutkan", "uraikan", "analisis", "bagaimana", "mengapa", "apakah", "siapa",
  "kapan", "dimana", "anda", "kamu", "mereka", "kita", "kami",
]);

/** Penanda kalimat yang tersusun: penghubung antar-gagasan. */
const PENGHUBUNG = [
  "karena", "sehingga", "namun", "tetapi", "meskipun", "walaupun", "selain itu",
  "sedangkan", "oleh karena", "dengan demikian", "sebaliknya", "misalnya",
  "contohnya", "pertama", "kedua", "ketiga", "akhirnya", "kesimpulan",
];

export function kataDariTeks(teks: string): string[] {
  return String(teks ?? "")
    .toLowerCase()
    // Tanda baca dibuang, tetapi angka DIPERTAHANKAN: "pasal 28" dan "2024"
    // adalah isi jawaban, bukan hiasan.
    .replace(/[^a-z0-9À-ɏ\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function jumlahKalimat(teks: string): number {
  const potong = String(teks ?? "")
    .split(/[.!?]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 2);
  // Jawaban tanpa satu pun titik tetap satu kalimat, bukan nol — nol akan
  // membuat rata-rata panjang kalimatnya tak terhingga.
  return Math.max(potong.length, String(teks ?? "").trim() ? 1 : 0);
}

export function jumlahParagraf(teks: string): number {
  const potong = String(teks ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return Math.max(potong.length, String(teks ?? "").trim() ? 1 : 0);
}

/**
 * Istilah kunci yang diharapkan muncul di jawaban.
 *
 * Diambil dari pertanyaan DAN dari pembahasan bila pengajar mengisinya.
 * Pembahasan jauh lebih berharga — di sanalah istilah yang benar-benar dicari
 * tertulis — tetapi sebagian besar soal tidak punya, jadi pertanyaannya tetap
 * ikut dipakai.
 */
export function istilahKunci(pertanyaan: string, acuan: string): string[] {
  const kata = [...kataDariTeks(pertanyaan), ...kataDariTeks(acuan)];
  const unik = new Set<string>();
  for (const k of kata) {
    if (k.length < 4) continue;
    if (KATA_UMUM.has(k)) continue;
    unik.add(k);
  }
  return [...unik];
}

/** Berapa bagian istilah kunci yang benar-benar muncul, 0–1. */
export function cakupanIstilah(jawaban: string, istilah: string[]): number {
  if (istilah.length === 0) return 0;
  const ada = new Set(kataDariTeks(jawaban));
  let kena = 0;
  for (const i of istilah) if (ada.has(i)) kena += 1;
  return kena / istilah.length;
}

/** Berapa istilah kunci yang muncul — untuk ditulis di alasannya. */
export function istilahTerpakai(jawaban: string, istilah: string[]): number {
  const ada = new Set(kataDariTeks(jawaban));
  return istilah.filter((i) => ada.has(i)).length;
}

// ------------------------------------------------------------
// SINYAL
// ------------------------------------------------------------

export type Sinyal = {
  /** Jumlah kata. */
  kata: number;
  kalimat: number;
  paragraf: number;
  /** 0–1: bagian istilah kunci yang muncul. */
  cakupan: number;
  istilahKena: number;
  istilahTotal: number;
  /** 0–1: keragaman kata, penangkap jawaban yang mengulang kalimat yang sama. */
  keragaman: number;
  /** 0–1: kepadatan penghubung antar-gagasan. */
  susunan: number;
  /** 0–1: kedekatan dengan jawaban acuan dosen. 0 bila acuannya tidak ada. */
  kesesuaian: number;
  adaAcuan: boolean;
  /** 0–1: bagian kalimat yang merupakan ulangan kalimat lain. */
  redundansi: number;
  /** 0–1: bagian kata yang tidak berbentuk kata. */
  ngawur: number;
  /** 0–1: seberapa besar jawaban hanyalah pertanyaannya diketik ulang. */
  menyalinSoal: number;
};

export function bacaSinyal(
  jawaban: string,
  istilah: string[],
  pertanyaan = "",
  acuan = "",
): Sinyal {
  const kata = kataDariTeks(jawaban);
  const unik = new Set(kata);
  const rendah = String(jawaban ?? "").toLowerCase();
  const penghubung = PENGHUBUNG.filter((p) => rendah.includes(p)).length;

  return {
    kata: kata.length,
    kalimat: jumlahKalimat(jawaban),
    paragraf: jumlahParagraf(jawaban),
    cakupan: cakupanIstilah(jawaban, istilah),
    istilahKena: istilahTerpakai(jawaban, istilah),
    istilahTotal: istilah.length,
    // Jawaban yang menyalin satu kalimat sepuluh kali panjangnya sama dengan
    // jawaban yang benar-benar menguraikan, dan hanya angka inilah yang
    // membedakan keduanya tanpa membaca isinya.
    keragaman: kata.length === 0 ? 0 : unik.size / kata.length,
    susunan: Math.min(1, penghubung / 4),
    kesesuaian: acuan.trim() ? kesesuaianAcuan(jawaban, acuan) : 0,
    adaAcuan: acuan.trim().length > 0,
    redundansi: redundansi(jawaban),
    ngawur: ngawur(jawaban),
    menyalinSoal: pertanyaan.trim() ? menyalinSoal(jawaban, pertanyaan) : 0,
  };
}


// ------------------------------------------------------------
// KESESUAIAN DENGAN JAWABAN ACUAN
// ------------------------------------------------------------
//
// Inilah yang membuat penilaian berhenti dapat dicurangi dengan mengetik
// panjang-panjang. Dasarnya cara baku penilaian jawaban singkat otomatis:
// jawaban peserta dan jawaban acuan dosen sama-sama diubah menjadi vektor
// bobot kata, lalu diukur sudut di antara keduanya (cosine similarity).
// Jawaban yang membicarakan hal yang sama akan berdekatan betapa pun berbeda
// kalimatnya; jawaban yang panjang tetapi membicarakan hal lain tidak.
//
// Ditambah satu ukuran kedua: kesamaan URUTAN kata (Jaccard atas 3-gram).
// Cosine tidak peduli susunan — "media memilih isu" dan "isu memilih media"
// bernilai sama baginya. Untuk jawaban pendek, perbedaan itu berarti.
//
// Keduanya memakai mesin yang sama persis dengan pemeriksaan kemiripan
// antarpeserta di src/lib/mirip-jawaban.ts. Satu mesin, dua kegunaan: di sana
// membandingkan peserta dengan peserta, di sini peserta dengan acuan dosen.

/** Vektor jumlah kata isi, tanpa kata umum. */
function vektorKata(teks: string): Map<string, number> {
  const peta = new Map<string, number>();
  for (const k of kataDariTeks(teks)) {
    if (k.length < 3 || KATA_UMUM.has(k)) continue;
    peta.set(k, (peta.get(k) ?? 0) + 1);
  }
  return peta;
}

/**
 * Seberapa dekat jawaban dengan acuan dosen, 0–1.
 *
 * Nol berarti tidak ada acuan untuk dibandingkan — BUKAN berarti jawabannya
 * salah. Pemanggilnya harus membedakan keduanya, dan `adaAcuan` di bawah
 * itulah yang membedakannya.
 */
export function kesesuaianAcuan(jawaban: string, acuan: string): number {
  const a = vektorKata(jawaban);
  const b = vektorKata(acuan);
  if (a.size === 0 || b.size === 0) return 0;

  const arah = cosine(a, b);
  const urutan = jaccard(
    new Set(ngram(kataDariTeks(jawaban), 3)),
    new Set(ngram(kataDariTeks(acuan), 3)),
  );
  // Cosine memimpin: parafrase yang benar harus lolos, dan itu justru tanda
  // peserta memahami — bukan menyalin. Urutan kata hanya menambah keyakinan.
  return Math.min(1, arah * 0.8 + urutan * 0.2);
}

// ------------------------------------------------------------
// PENANGKAL AKAL-AKALAN
// ------------------------------------------------------------
//
// Tiga cara paling murah membohongi penilai otomatis, dan ketiganya sudah
// terdokumentasi dalam penelitian penilaian esai otomatis: mengulang kalimat
// yang sama (padding), mengetik huruf asal (gibberish), dan menyalin kembali
// pertanyaannya. Ketiganya menaikkan jumlah kata tanpa menambah satu gagasan
// pun, dan ketiganya dihitung di sini.

/** Bagian kalimat yang merupakan ulangan kalimat lain, 0–1. */
export function redundansi(teks: string): number {
  const kalimat = String(teks ?? "")
    .split(/[.!?\n]+/)
    .map((k) => kataDariTeks(k))
    .filter((k) => k.length >= 2);
  if (kalimat.length < 2) return 0;

  let ulangan = 0;
  for (let i = 1; i < kalimat.length; i += 1) {
    const kini = new Set(kalimat[i]);
    for (let j = 0; j < i; j += 1) {
      // Dua kalimat dianggap ulangan bila delapan dari sepuluh katanya sama.
      // Ambang di bawah itu akan menghukum penulis yang memang mengulang satu
      // istilah kunci di tiap kalimat, dan itu justru tanda jawaban yang fokus.
      if (jaccard(kini, new Set(kalimat[j])) >= 0.8) { ulangan += 1; break; }
    }
  }
  return ulangan / kalimat.length;
}

/** Bagian kata yang tidak berbentuk kata, 0–1. */
export function ngawur(teks: string): number {
  const kata = kataDariTeks(teks);
  if (kata.length === 0) return 0;
  let aneh = 0;
  for (const k of kata) {
    // Tanpa huruf hidup sama sekali, atau panjang tidak wajar. "asdfgh",
    // "qwertyuiop", dan "kkkkkkkk" tertangkap; "DPR" dan "PDIP" tidak,
    // karena singkatan pendek dilewati.
    if (k.length <= 3) continue;
    const adaVokal = /[aeiou]/.test(k);
    const berulang = /(.)\1{3,}/.test(k);
    const deretKonsonan = /[bcdfghjklmnpqrstvwxyz]{5,}/.test(k);
    if (!adaVokal || berulang || deretKonsonan || k.length > 24) aneh += 1;
  }
  return aneh / kata.length;
}

/** Seberapa besar jawaban hanyalah pertanyaannya yang diketik ulang, 0–1. */
export function menyalinSoal(jawaban: string, pertanyaan: string): number {
  const a = kataDariTeks(jawaban);
  const b = kataDariTeks(pertanyaan);
  if (a.length < 3 || b.length < 3) return 0;
  return jaccard(new Set(ngram(a, 3)), new Set(ngram(b, 3)));
}

// ------------------------------------------------------------
// KEDUDUKAN DI ANTARA SEKELAS
// ------------------------------------------------------------

/** Pembanding paling sedikit, sebelum kedudukan relatif berarti apa pun. */
export const MIN_PEMBANDING = 3;

/**
 * Kedudukan satu angka di antara angka pembanding, 0–1.
 *
 * Nilai yang sama dihitung setengah, supaya sepuluh jawaban yang panjangnya
 * persis sama semuanya berada di tengah (0,5) — bukan semuanya di puncak.
 */
export function kedudukan(angka: number, pembanding: number[]): number {
  if (pembanding.length === 0) return 0.5;
  let bawah = 0;
  let sama = 0;
  for (const p of pembanding) {
    if (p < angka) bawah += 1;
    else if (p === angka) sama += 1;
  }
  return (bawah + sama / 2) / pembanding.length;
}

/**
 * Ambang panjang ketika pembandingnya belum cukup.
 *
 * Angkanya sengaja rendah hati: 40 kata sudah dianggap jawaban utuh untuk
 * esai pendek. Ambang yang tinggi menghukum kelas yang soalnya memang hanya
 * menuntut satu paragraf, dan itu terjadi pada ujian pertama yang dijalankan
 * portal ini — ketika belum ada satu pun pembanding.
 */
const AMBANG_KATA = [15, 40, 90, 160, 260];

/**
 * Level dari ambang panjang yang DITETAPKAN RUBRIK.
 *
 * Inilah jalur yang membuat nilai dapat berdiri sendiri tanpa verifikasi
 * siapa pun: tangga yang ditetapkan sebelum ujian, berlaku sama untuk semua
 * orang, dan tidak bergantung pada siapa mengumpulkan lebih dulu.
 *
 * Kedudukan relatif terhadap sekelas tidak dapat dipakai untuk nilai final —
 * peserta pertama yang mengumpulkan belum punya satu pun pembanding, dan
 * jawaban yang sama persis akan bernilai lain bila dikumpulkan lebih awal.
 * Untuk nilai yang langsung terlihat peserta, itu tidak dapat dipertanggung-
 * jawabkan.
 *
 * Mengembalikan null bila kriteria ini memang tidak memakai ambang.
 */
export function levelDariAmbang(kata: number, levels: LevelRubrik[]): number | null {
  const berambang = levels.filter((l) => (l.minKata ?? 0) > 0);
  if (berambang.length === 0) return null;

  // Naik dari level terendah: level tertinggi yang ambangnya sudah terlewati.
  const urut = [...levels].sort((a, b) => a.level - b.level);
  let dipakai = urut[0]?.level ?? 1;
  for (const l of urut) {
    if (kata >= (l.minKata ?? 0)) dipakai = l.level;
  }
  return dipakai;
}

/** Kedudukan panjang terhadap ambang tetap, 0–1. */
export function kedudukanAmbang(kata: number): number {
  let lewat = 0;
  for (const a of AMBANG_KATA) if (kata >= a) lewat += 1;
  return lewat / AMBANG_KATA.length;
}

// ------------------------------------------------------------
// DARI SINYAL KE LEVEL RUBRIK
// ------------------------------------------------------------

/**
 * Keluarga kriteria yang dikenali dari namanya.
 *
 * Tanpa ini seluruh kriteria menerima level yang sama, dan bobot rubrik
 * berhenti berarti apa pun — kriteria 30% dan 20% menghasilkan angka yang
 * sebanding apa pun isinya. Dengan ini, kriteria yang menyebut "referensi"
 * dinilai dari cakupan istilah, dan yang menyebut "sistematika" dari
 * susunan kalimatnya.
 *
 * Nama yang tidak dikenali memakai gabungan seluruh sinyal, dan itu memang
 * jalan yang paling sering dilewati.
 */
const KELUARGA: Array<{ kunci: string[]; sinyal: "cakupan" | "susunan" | "panjang" }> = [
  { kunci: ["referensi", "rujukan", "sitasi", "contoh", "data", "bukti"], sinyal: "cakupan" },
  { kunci: ["sistematika", "struktur", "bahasa", "penulisan", "kerapian", "tata"], sinyal: "susunan" },
  { kunci: ["kelengkapan", "cakupan", "keluasan"], sinyal: "panjang" },
];

function keluargaKriteria(nama: string): "cakupan" | "susunan" | "panjang" | "gabungan" {
  const rendah = nama.toLowerCase();
  for (const k of KELUARGA) {
    if (k.kunci.some((kata) => rendah.includes(kata))) return k.sinyal;
  }
  return "gabungan";
}

/** Ubah angka 0–1 menjadi level di dalam skala rubrik. */
export function keLevel(nilai: number, skalaMin: number, skalaMax: number): number {
  const tingkat = skalaMax - skalaMin + 1;
  const pilih = Math.floor(nilai * tingkat);
  return skalaMin + Math.max(0, Math.min(tingkat - 1, pilih));
}

export type UsulanKriteria = { urut: number; level: number; alasan: string };

export type HasilLokal = {
  kriteria: UsulanKriteria[];
  /** 0–100, selalu rendah: ini pengukuran bentuk, bukan pembacaan isi. */
  keyakinan: number;
  ringkasan: string;
  sinyal: Sinyal;
};

/**
 * Usulkan level tiap kriteria untuk satu jawaban.
 *
 * `pembandingKata` berisi jumlah kata jawaban peserta LAIN pada soal yang
 * sama. Bila jumlahnya belum cukup, ambang tetap yang dipakai.
 */
export function nilaiLokal({
  jawaban, pertanyaan, acuan, rubrik, pembandingKata = [],
}: {
  jawaban: string;
  pertanyaan: string;
  acuan: string;
  rubrik: Rubrik;
  pembandingKata?: number[];
}): HasilLokal {
  const istilah = istilahKunci(pertanyaan, acuan);
  const sinyal = bacaSinyal(jawaban, istilah, pertanyaan, acuan);

  const relatif = pembandingKata.length >= MIN_PEMBANDING;
  const panjang = relatif ? kedudukan(sinyal.kata, pembandingKata) : kedudukanAmbang(sinyal.kata);

  // ---------- KEJUJURAN BENTUK ----------
  //
  // Satu pengali, 0–1, yang menyusut setiap kali jawaban menaikkan jumlah
  // katanya tanpa menambah gagasan. Ketiganya berlipat, bukan dijumlah:
  // jawaban yang sekaligus mengulang DAN ngawur harus jatuh lebih dalam
  // daripada yang hanya melakukan salah satunya.
  const kejujuran =
    (1 - sinyal.redundansi) *
    (1 - Math.min(1, sinyal.ngawur * 2)) *
    Math.min(1, sinyal.keragaman / 0.45 + 0.15);

  // Bagian jawaban yang hanyalah pertanyaannya diketik ulang tidak dihitung
  // sebagai isi. Menyalin soal adalah cara paling murah memenuhi ambang kata.
  const isiBersih = Math.max(0, 1 - sinyal.menyalinSoal);

  // ---------- NILAI ISI ----------
  //
  // Ketika dosen mengisi jawaban acuan, kedekatan dengan acuan itulah yang
  // memimpin — 60% — dan panjang tidak ikut sama sekali. Tanpa acuan, yang
  // tersisa hanya cakupan istilah soal dan susunan kalimat; panjang diberi
  // porsi kecil karena harus ada sesuatu yang membedakan jawaban dua kata
  // dari jawaban satu paragraf, tetapi porsinya sengaja tidak cukup untuk
  // memenangkan apa pun sendirian.
  const isi = sinyal.adaAcuan
    ? Math.min(1, (sinyal.kesesuaian * 0.60 + sinyal.cakupan * 0.25 + sinyal.susunan * 0.15) * isiBersih * kejujuran)
    : Math.min(1, (sinyal.cakupan * 0.50 + sinyal.susunan * 0.25 + panjang * 0.25) * isiBersih * kejujuran);

  // ---------- MELENCENG ----------
  //
  // Jawaban yang tidak menyentuh acuan MAUPUN istilah soalnya tidak dinilai
  // dari panjangnya, berapa pun panjangnya. Inilah yang menutup celah
  // "ketik apa saja asal banyak".
  const melenceng = sinyal.adaAcuan && sinyal.kesesuaian < 0.12 && sinyal.cakupan < 0.10;

  const dasar = relatif
    ? `${sinyal.kata} kata (lebih panjang dari ${Math.round(panjang * 100)}% jawaban lain)`
    : `${sinyal.kata} kata`;
  const dasarIstilah =
    sinyal.istilahTotal > 0
      ? `${sinyal.istilahKena} dari ${sinyal.istilahTotal} istilah soal`
      : "istilah soal tidak dapat diambil";
  const dasarAcuan = sinyal.adaAcuan
    ? `kesesuaian dengan jawaban acuan ${Math.round(sinyal.kesesuaian * 100)}%`
    : "tanpa jawaban acuan";

  const peringatan: string[] = [];
  if (sinyal.redundansi > 0.3) peringatan.push(`${Math.round(sinyal.redundansi * 100)}% kalimatnya mengulang`);
  if (sinyal.ngawur > 0.15) peringatan.push(`${Math.round(sinyal.ngawur * 100)}% katanya tidak berbentuk kata`);
  if (sinyal.menyalinSoal > 0.4) peringatan.push("sebagian besar menyalin pertanyaannya");
  if (melenceng) peringatan.push("tidak menyentuh acuan maupun istilah soal");

  const kriteria: UsulanKriteria[] = rubrik.kriteria.map((k, urut) => {
    // ---------- PANJANG HANYA MEMBATASI, TIDAK PERNAH MEMBERI ----------
    //
    // Inilah pembalikan yang menutup celah "asal panjang". Ambang pada rubrik
    // tidak lagi MENENTUKAN level; ia menjadi LANGIT-LANGIT. Jawaban 300 kata
    // yang isinya tidak menyentuh acuan tetap mendapat level satu, sedangkan
    // jawaban 150 kata yang tepat tidak akan terhalang.
    //
    // Arahnya masuk akal bagi yang menyusun rubrik: "level 4 mulai 140 kata"
    // berarti jawaban di bawah 140 kata tidak akan dianggap level 4 betapa pun
    // tepatnya — dan itu memang yang dimaksud ketika ambangnya ditulis.
    const keluarga = keluargaKriteria(k.nama);
    const nilai =
      melenceng ? 0
        : keluarga === "cakupan" ? sinyal.cakupan * kejujuran
          : keluarga === "susunan" ? sinyal.susunan * kejujuran
            : isi;

    const alasan =
      melenceng ? `Tidak menyentuh acuan maupun istilah soal (${sinyal.kata} kata).`
        : keluarga === "cakupan" ? `${dasarIstilah}.`
          : keluarga === "susunan" ? `${sinyal.kalimat} kalimat, ${sinyal.paragraf} paragraf.`
            : sinyal.adaAcuan ? `${dasarAcuan}, ${dasarIstilah}, ${dasar}.`
              : `${dasarIstilah}, ${dasar}, ${sinyal.kalimat} kalimat.`;

    const langit = levelDariAmbang(sinyal.kata, k.levels);
    const dariIsi = keLevel(nilai, rubrik.skalaMin, rubrik.skalaMax);
    const dipakai = langit === null ? dariIsi : Math.min(dariIsi, langit);

    return {
      urut,
      level: Math.max(rubrik.skalaMin, Math.min(rubrik.skalaMax, dipakai)),
      alasan:
        (langit !== null && dariIsi > langit ? `Dibatasi ambang panjang level ${langit}. ` : "") +
        alasan +
        (peringatan.length > 0 ? ` ⚠ ${peringatan.join("; ")}.` : ""),
    };
  });

  return {
    kriteria,
    // Naik ketika ada jawaban acuan untuk dibandingkan, dan turun ketika ada
    // tanda akal-akalan. Angka ini muncul di lembar penilaian; di bawah 70 ia
    // menandai "mohon diperiksa", dan tanpa acuan penilaian ini memang selalu
    // pantas ditandai begitu.
    keyakinan: Math.round(
      Math.max(20, Math.min(85, (sinyal.adaAcuan ? 70 : 35) * kejujuran - peringatan.length * 8)),
    ),
    ringkasan:
      `Penilaian otomatis tanpa model. ${dasarAcuan}, ${dasarIstilah}, ${dasar}, ` +
      `${sinyal.kalimat} kalimat.` +
      (peringatan.length > 0 ? ` ⚠ ${peringatan.join("; ")}.` : "") +
      (sinyal.adaAcuan
        ? " Yang menentukan kedekatan dengan jawaban acuan; panjang hanya membatasi."
        : " Soal ini belum punya jawaban acuan pada kolom Pembahasan — isilah untuk penilaian yang jauh lebih tepat.") +
      " Ubah levelnya bila ada yang meleset.",
    sinyal,
  };
}
