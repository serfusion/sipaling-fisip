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

import type { Rubrik } from "@/lib/rubrik";

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
const KATA_UMUM = new Set([
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
};

export function bacaSinyal(jawaban: string, istilah: string[]): Sinyal {
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
  };
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
  const sinyal = bacaSinyal(jawaban, istilah);

  const relatif = pembandingKata.length >= MIN_PEMBANDING;
  const panjang = relatif ? kedudukan(sinyal.kata, pembandingKata) : kedudukanAmbang(sinyal.kata);

  // Panjang yang dicapai dengan mengulang kalimat yang sama tidak dihitung
  // penuh. Keragaman di bawah 0,4 berarti hampir seluruhnya pengulangan.
  const panjangJujur = panjang * Math.min(1, sinyal.keragaman / 0.55 + 0.25);

  const gabungan = Math.min(
    1,
    panjangJujur * 0.55 + sinyal.cakupan * 0.30 + sinyal.susunan * 0.15,
  );

  const dasar = relatif
    ? `${sinyal.kata} kata (lebih panjang dari ${Math.round(panjang * 100)}% jawaban lain)`
    : `${sinyal.kata} kata`;
  const dasarIstilah =
    sinyal.istilahTotal > 0
      ? `${sinyal.istilahKena} dari ${sinyal.istilahTotal} istilah soal`
      : "istilah soal tidak dapat diambil";

  const kriteria: UsulanKriteria[] = rubrik.kriteria.map((k, urut) => {
    const keluarga = keluargaKriteria(k.nama);
    const nilai =
      keluarga === "cakupan" ? sinyal.cakupan
        : keluarga === "susunan" ? sinyal.susunan
          : keluarga === "panjang" ? panjangJujur
            : gabungan;

    const alasan =
      keluarga === "cakupan" ? `${dasarIstilah}.`
        : keluarga === "susunan" ? `${sinyal.kalimat} kalimat, ${sinyal.paragraf} paragraf.`
          : keluarga === "panjang" ? `${dasar}.`
            : `${dasar}, ${dasarIstilah}, ${sinyal.kalimat} kalimat.`;

    return {
      urut,
      level: keLevel(nilai, rubrik.skalaMin, rubrik.skalaMax),
      alasan: `Dihitung dari bentuk jawaban, bukan dari isinya: ${alasan}`,
    };
  });

  return {
    kriteria,
    // Sengaja tidak pernah tinggi. Angka ini muncul di lembar penilaian, dan
    // di bawah 70 lembarnya menandai "mohon diperiksa" — yang memang benar
    // untuk setiap jawaban yang dinilai tanpa dibaca.
    keyakinan: 35,
    ringkasan:
      `Penilaian otomatis tanpa model. ${dasar}, ${dasarIstilah}, ` +
      `${sinyal.kalimat} kalimat, ${sinyal.paragraf} paragraf. ` +
      `Angka ini mengukur BENTUK jawaban, bukan kebenarannya — ubah levelnya bila tidak sesuai.`,
    sinyal,
  };
}
