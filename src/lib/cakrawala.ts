// ============================================================
// KUNCI MENU CAKRAWALA — bagian yang aman dipakai di browser
//
// Cakrawala adalah sembilan alat bantu naskah yang berat dibangun dan tidak
// dibuka untuk umum begitu saja. Menunya dikunci: pengunjung melihat halaman
// pratinjau berisi keunggulannya, dan hanya pemegang kode yang masuk.
//
// Berkas ini SENGAJA tidak menyentuh database supaya boleh diimpor dari
// komponen client (panel Super Admin, kotak kode di halaman pratinjau)
// maupun dari server. Pembacaan ke database ada di `cakrawala-store.ts`.
// ============================================================

export const CAKRAWALA_KEY = "cakrawala_access";

/** Nama cookie penanda "perangkat ini sudah membuka Cakrawala". */
export const CAKRAWALA_COOKIE = "cakrawala_pass";

/** Umur cookie pembuka: 30 hari, dihitung sejak kode dimasukkan. */
export const CAKRAWALA_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export type CakrawalaCode = {
  /** Kode yang diketik pengguna. Selalu disimpan dalam huruf kapital. */
  code: string;
  /** Catatan pemilik kode, mis. "Kak Rina — Ilkom 2021". */
  label: string;
  /** Kode nonaktif ditolak tanpa perlu dihapus dari daftar. */
  active: boolean;
  /** 0 berarti tanpa batas pemakaian. */
  maxUses: number;
  uses: number;
  createdAt: string;
  lastUsedAt: string | null;
};

export type CakrawalaState = {
  /**
   * Kunci menyala. Bawaannya TRUE: bila baris pengaturannya belum ada,
   * Cakrawala tertutup — bukan terbuka. Fitur berbayar tidak boleh
   * menganggur terbuka hanya karena satu baris pengaturan belum sempat
   * dibuat.
   */
  locked: boolean;
  codes: CakrawalaCode[];
};

export const DEFAULT_CAKRAWALA: CakrawalaState = { locked: true, codes: [] };

/** Batas jumlah kode yang boleh hidup bersamaan. */
export const CAKRAWALA_MAX_CODES = 60;

const LABEL_MAX = 80;

// Huruf dan angka yang tidak mudah tertukar saat dibacakan lewat pesan:
// tanpa 0/O, 1/I, dan 5/S.
const ABJAD = "ABCDEFGHJKLMNPQRTUVWXYZ23456789";

/** Membentuk kode baru, mis. "CKRW-7HQ4-M2XB". */
export function buatKodeCakrawala() {
  const nilai = new Uint32Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(nilai);
  } else {
    for (let i = 0; i < nilai.length; i++) nilai[i] = Math.floor(Math.random() * 0xffffffff);
  }
  const huruf = Array.from(nilai, (angka) => ABJAD[angka % ABJAD.length]);
  return `CKRW-${huruf.slice(0, 4).join("")}-${huruf.slice(4, 8).join("")}`;
}

/** Menyeragamkan ketikan pengguna: huruf kapital, tanpa spasi. */
export function rapikanKode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.toUpperCase().replace(/\s+/g, "").slice(0, 40);
}

function bersihkanLabel(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, LABEL_MAX);
}

function normalkanKode(input: unknown): CakrawalaCode | null {
  const raw = (typeof input === "object" && input ? input : {}) as Partial<CakrawalaCode>;
  const code = rapikanKode(raw.code);
  if (!code) return null;
  const maxUses = Number(raw.maxUses);
  const uses = Number(raw.uses);
  return {
    code,
    label: bersihkanLabel(raw.label),
    active: raw.active !== false,
    maxUses: Number.isInteger(maxUses) && maxUses > 0 ? Math.min(maxUses, 9999) : 0,
    uses: Number.isInteger(uses) && uses > 0 ? uses : 0,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    lastUsedAt: typeof raw.lastUsedAt === "string" ? raw.lastUsedAt : null,
  };
}

/**
 * Mengubah apa pun (isi kolom app_settings, body permintaan PUT) menjadi
 * CakrawalaState yang pasti valid. Dipakai di kedua sisi supaya aturan
 * panjang teks dan nilai bawaan tidak pernah berbeda.
 */
export function normalizeCakrawala(input: unknown): CakrawalaState {
  const raw = (typeof input === "object" && input ? input : {}) as Partial<CakrawalaState>;
  const daftar = Array.isArray(raw.codes) ? raw.codes : [];
  const terlihat = new Set<string>();
  const codes: CakrawalaCode[] = [];
  for (const item of daftar) {
    const kode = normalkanKode(item);
    if (!kode || terlihat.has(kode.code)) continue;
    terlihat.add(kode.code);
    codes.push(kode);
    if (codes.length >= CAKRAWALA_MAX_CODES) break;
  }
  return {
    // Kunci hanya mati bila diminta tegas; nilai apa pun yang tidak jelas
    // dibaca sebagai "terkunci".
    locked: raw.locked !== false,
    codes,
  };
}

export function parseCakrawala(value: string | null | undefined): CakrawalaState {
  if (!value) return DEFAULT_CAKRAWALA;
  try {
    return normalizeCakrawala(JSON.parse(value));
  } catch {
    return DEFAULT_CAKRAWALA;
  }
}

/** Kode masih berlaku bila aktif dan kuota pemakaiannya belum habis. */
export function kodeBerlaku(kode: CakrawalaCode) {
  if (!kode.active) return false;
  if (kode.maxUses > 0 && kode.uses >= kode.maxUses) return false;
  return true;
}

/** Sisa pemakaian untuk ditampilkan di panel Super Admin. */
export function sisaPemakaian(kode: CakrawalaCode) {
  if (kode.maxUses <= 0) return "Tanpa batas";
  return `${Math.max(kode.maxUses - kode.uses, 0)} dari ${kode.maxUses}`;
}
