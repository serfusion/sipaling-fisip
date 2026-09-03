// ============================================================
// ARSIP TRANSKRIP NILAI — apa yang layak diarsipkan, dan ringkasannya
//
// Transkrip dibuat satu per satu, dan yang sudah selesai tidak boleh hilang
// begitu admin menutup tab. Modul ini memegang dua aturan yang harus SAMA
// di layar dan di server:
//
//   1. Sebuah transkrip baru boleh masuk arsip kalau memang sudah jadi:
//      punya nama, punya NIM, dan punya mata kuliah yang lengkap. Tombolnya
//      dimatikan dengan ALASAN yang tertulis, bukan diam-diam.
//   2. Angka yang tersimpan (SKS, mutu, IPK, predikat) dihitung ULANG dari
//      barisnya, tidak diambil dari kiriman peramban. Arsip dipakai untuk
//      mencetak transkrip resmi; angkanya harus berasal dari satu tempat.
//
// Tidak ada penyimpanan otomatis di sini. Selama tombolnya belum ditekan,
// tidak ada satu baris pun yang ditulis ke arsip.
// ============================================================

import { AM, computeTotals, type CourseRow } from "@/app/dashboard/template/transkrip-parse";

export type MetaTranskrip = Record<string, string>;

/** Batas wajar satu transkrip. Kurikulum S-1 jauh di bawah angka ini. */
export const MAKS_BARIS = 200;

export type RingkasArsip = {
  nim: string;
  nama: string;
  prodi: string;
  konsentrasi: string;
  jenjang: string;
  yudisium: string;
  judul: string;
  jumlahMk: number;
  sks: number;
  mutu: number;
  ipk: number;
  predikat: string;
};

const teks = (nilai: unknown, batas: number) =>
  String(nilai ?? "").replace(/\s+/g, " ").trim().slice(0, batas);

/**
 * Predikat kelulusan menurut IPK.
 *
 * Selama judul skripsi belum diisi dan IPK-nya belum mencapai batas terendah,
 * transkripnya belum bisa disebut lulus — dan tanda "—" itu yang tercetak.
 */
export function predikatKelulusan(ipk: number, judul: string) {
  if (ipk >= 3.51) return "Dengan Pujian";
  if (ipk >= 3.01) return "Sangat Memuaskan";
  if (ipk >= 2.76) return "Memuaskan";
  return judul ? "Lulus" : "—";
}

/**
 * Bersihkan daftar mata kuliah yang datang dari peramban.
 *
 * Baris tanpa nama dan tanpa SKS dibuang: yang tersimpan hanya baris yang
 * benar-benar tercetak di transkrip.
 */
export function bersihkanBaris(masuk: unknown): CourseRow[] {
  if (!Array.isArray(masuk)) return [];
  const bersih: CourseRow[] = [];
  for (const baris of masuk.slice(0, MAKS_BARIS)) {
    if (!baris || typeof baris !== "object") continue;
    const isi = baris as Record<string, unknown>;
    const nama = teks(isi.nama, 200);
    const k = Number(isi.k) || 0;
    if (!nama && !k) continue;
    const hm = teks(isi.hm, 2).toUpperCase();
    bersih.push({
      kode: teks(isi.kode, 40),
      nama,
      en: teks(isi.en, 200),
      hm: hm in AM ? hm : "",
      // SKS negatif atau raksasa hanya merusak total; 24 sudah lebih dari
      // cukup untuk satu mata kuliah.
      k: Math.min(Math.max(Math.round(k), 0), 24),
    });
  }
  return bersih;
}

/** Buang isian meta yang tidak dikenal, dan potong yang kepanjangan. */
export function bersihkanMeta(masuk: unknown): MetaTranskrip {
  if (!masuk || typeof masuk !== "object") return {};
  const bersih: MetaTranskrip = {};
  for (const [kunci, nilai] of Object.entries(masuk as Record<string, unknown>)) {
    if (!/^[a-z]{2,20}$/i.test(kunci)) continue;
    const isi = teks(nilai, 600);
    if (isi) bersih[kunci] = isi;
  }
  return bersih;
}

/** Ringkasan satu transkrip — inilah yang tampil pada daftar arsip. */
export function ringkasTranskrip(meta: MetaTranskrip, rows: CourseRow[]): RingkasArsip {
  const total = computeTotals(rows);
  const judul = teks(meta.judul, 600);
  // IPK dibulatkan dua angka sekali di sini, supaya angka pada daftar arsip
  // dan angka yang tercetak di transkrip tidak pernah berbeda.
  const ipk = Number(total.ipk.toFixed(2));
  return {
    nim: teks(meta.nim, 32),
    nama: teks(meta.nama, 160),
    prodi: teks(meta.prodi, 120),
    konsentrasi: teks(meta.konsentrasi, 160),
    jenjang: teks(meta.jenjang, 120),
    yudisium: teks(meta.yudisium, 60),
    judul,
    jumlahMk: rows.length,
    sks: total.sks,
    mutu: total.mutu,
    ipk,
    predikat: predikatKelulusan(ipk, judul),
  };
}

/**
 * Boleh masuk arsip atau belum?
 *
 * Alasannya dikembalikan sebagai kalimat, bukan sekadar `false`: tombol yang
 * mati tanpa keterangan membuat orang mengira sistemnya rusak.
 */
export function periksaSiapArsip(meta: MetaTranskrip, rows: CourseRow[]): { siap: boolean; alasan: string } {
  const nama = teks(meta.nama, 160);
  const nim = teks(meta.nim, 32);
  if (!rows.length) return { siap: false, alasan: "Belum ada mata kuliah. Impor Excel atau tambah baris dulu." };
  if (rows.length > MAKS_BARIS) return { siap: false, alasan: `Terlalu banyak baris (maks. ${MAKS_BARIS}).` };
  if (!nama) return { siap: false, alasan: "Nama mahasiswa belum diisi pada Biodata." };
  if (nim.length < 4) return { siap: false, alasan: "NIM belum diisi pada Biodata — NIM dipakai sebagai penanda arsip." };

  const tanpaNama = rows.findIndex((baris) => !baris.nama.trim());
  if (tanpaNama >= 0) return { siap: false, alasan: `Baris ke-${tanpaNama + 1} belum punya nama mata kuliah.` };
  const tanpaSks = rows.findIndex((baris) => baris.k <= 0);
  if (tanpaSks >= 0) return { siap: false, alasan: `Baris ke-${tanpaSks + 1} ("${rows[tanpaSks].nama}") belum punya SKS.` };

  return { siap: true, alasan: "" };
}

/**
 * Tanda satu transkrip: dipakai untuk tahu apakah yang di layar masih sama
 * dengan yang terakhir diarsipkan. Selama berbeda, tombolnya menyala dan
 * status di sebelahnya berbunyi "belum disimpan".
 */
export function sidikTranskrip(meta: MetaTranskrip, rows: CourseRow[]) {
  const inti = rows.map((baris) => `${baris.kode}|${baris.nama}|${baris.en}|${baris.hm}|${baris.k}`).join("\n");
  const bio = Object.keys(meta)
    .sort()
    .map((kunci) => `${kunci}=${meta[kunci]}`)
    .join("\n");
  return `${bio}\n--\n${inti}`;
}
