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
  /**
   * Kapan akses kode ini berakhir. null berarti tanpa batas waktu — itulah
   * bentuk kode yang dibagikan sendiri oleh pemiliknya.
   *
   * Wajib ada sejak Cakrawala dijual per paket: paket Coba tiga hari dan paket
   * Skripsi enam bulan tidak mungkin dibedakan kalau kodenya sama-sama berlaku
   * selamanya sampai dimatikan dengan tangan.
   */
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  /** Nomor pesanan yang menerbitkan kode ini, bila ia lahir dari pembelian. */
  orderCode?: string | null;
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

/**
 * Batas jumlah kode yang boleh hidup bersamaan.
 *
 * Enam puluh cukup ketika kodenya dibagikan sendiri satu per satu. Setelah
 * Cakrawala dijual, satu musim skripsi saja dapat melewatinya. Angkanya
 * dinaikkan, dan kode yang sudah lewat masa berlakunya dibersihkan berkala
 * supaya daftarnya tidak menggelembung tanpa guna.
 */
export const CAKRAWALA_MAX_CODES = 400;

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

/** Terima hanya tanggal yang benar-benar terbaca; sisanya "tanpa batas". */
function waktuSah(nilai: unknown): string | null {
  if (typeof nilai !== "string" || !nilai) return null;
  const waktu = new Date(nilai);
  return Number.isNaN(waktu.getTime()) ? null : waktu.toISOString();
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
    // Nilai yang bukan tanggal terbaca sebagai "tanpa batas waktu", bukan
    // sebagai "sudah lewat": kode lama yang tersimpan sebelum kolom ini ada
    // memang tidak punya batas, dan tidak boleh ikut mati sendiri.
    expiresAt: waktuSah(raw.expiresAt),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    lastUsedAt: typeof raw.lastUsedAt === "string" ? raw.lastUsedAt : null,
    orderCode: typeof raw.orderCode === "string" ? raw.orderCode.slice(0, 20) : null,
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

/** Sudah lewat masa berlakunya? Kode tanpa batas waktu tidak pernah lewat. */
export function kodeKedaluwarsa(kode: CakrawalaCode, sekarang: Date = new Date()) {
  if (!kode.expiresAt) return false;
  return new Date(kode.expiresAt).getTime() <= sekarang.getTime();
}

/** Kode masih berlaku bila aktif, belum lewat waktunya, dan kuotanya ada. */
export function kodeBerlaku(kode: CakrawalaCode, sekarang: Date = new Date()) {
  if (!kode.active) return false;
  if (kodeKedaluwarsa(kode, sekarang)) return false;
  if (kode.maxUses > 0 && kode.uses >= kode.maxUses) return false;
  return true;
}

/** Sisa masa berlaku untuk ditampilkan di panel Super Admin. */
export function sisaMasa(kode: CakrawalaCode, sekarang: Date = new Date()) {
  if (!kode.expiresAt) return "Tanpa batas waktu";
  const selisih = new Date(kode.expiresAt).getTime() - sekarang.getTime();
  if (selisih <= 0) return "Sudah lewat";
  const hari = Math.ceil(selisih / (24 * 60 * 60_000));
  return hari === 1 ? "Sisa 1 hari" : `Sisa ${hari} hari`;
}

/** Sisa pemakaian untuk ditampilkan di panel Super Admin. */
export function sisaPemakaian(kode: CakrawalaCode) {
  if (kode.maxUses <= 0) return "Tanpa batas";
  return `${Math.max(kode.maxUses - kode.uses, 0)} dari ${kode.maxUses}`;
}
