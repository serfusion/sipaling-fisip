// ============================================================
// PAKET AKSES CAKRAWALA — harga, masa berlaku, dan nominal unik
//
// Berkas ini SENGAJA tidak menyentuh database maupun QRIS, supaya boleh
// diimpor dari komponen client (halaman beli) maupun dari server (API
// pesanan), dan supaya seluruh aturan uangnya dapat diuji tanpa apa pun.
// ============================================================

export type PaketId = "coba" | "bab" | "skripsi";

export type Paket = {
  id: PaketId;
  nama: string;
  /** Harga dasar dalam rupiah bulat, sebelum ditambah penanda pesanan. */
  harga: number;
  /** Berapa hari akses berlaku sejak kodenya ditukar. */
  hari: number;
  /**
   * Berapa perangkat yang dibayangkan untuk paket ini.
   *
   * Sejak langganan menempel pada nomor WhatsApp, angka ini TIDAK lagi
   * membatasi apa pun: yang mengunci adalah tabel penukaran — satu kode satu
   * nomor — dan sesudah itu pemiliknya boleh masuk dari mana saja. Angkanya
   * tetap dicatat pada baris pesanan sebagai keterangan paket yang dibeli,
   * dan sengaja tidak pernah dijanjikan di halaman penjualan.
   */
  maksPerangkat: number;
  jelas: string;
  untuk: string;
  /** Ditonjolkan di halaman beli. Tepat satu paket. */
  utama?: boolean;
};

export const PAKET: Paket[] = [
  {
    id: "coba",
    nama: "Coba",
    harga: 10_000,
    hari: 3,
    maksPerangkat: 1,
    jelas: "Tiga hari, seluruh alat terbuka, tanpa batas pemakaian.",
    untuk: "Buat yang mau lihat buktinya dulu sebelum yakin.",
  },
  {
    id: "bab",
    nama: "Bab",
    harga: 25_000,
    hari: 30,
    maksPerangkat: 2,
    jelas: "Tiga puluh hari, seluruh alat terbuka, tanpa batas pemakaian.",
    untuk: "Buat yang lagi mentok di satu bab dan butuh waktu berminggu-minggu.",
    utama: true,
  },
  {
    id: "skripsi",
    nama: "Skripsi",
    harga: 60_000,
    hari: 180,
    maksPerangkat: 3,
    jelas: "Enam bulan, seluruh alat terbuka, tanpa batas pemakaian.",
    untuk: "Buat yang sudah yakin dan mau dipakai sampai sidang.",
  },
];

export const paketDari = (id: unknown): Paket | null =>
  PAKET.find((p) => p.id === id) ?? null;

/** Berapa lama QR pembayaran berlaku sebelum nominalnya boleh dipakai ulang. */
export const MENIT_BAYAR = 15;

export type StatusPesanan = "menunggu" | "lunas" | "kedaluwarsa" | "batal";

// ---------------------------------------------------------------------------
// Nominal unik
// ---------------------------------------------------------------------------

/** Batas bawah dan atas penanda tiga angka di ekor nominal. */
export const PENANDA_MIN = 1;
export const PENANDA_MAKS = 999;

/**
 * Nominal yang ditagihkan: harga paket ditambah penanda tiga angka.
 *
 * Paket Bab seharga 25.000 ditagih 25.037, dan "037" itulah yang menunjukkan
 * pesanan mana yang barusan dibayar. Tanpa penanda ini, sepuluh mahasiswa yang
 * sama-sama membayar 25.000 pada jam yang sama tidak mungkin dibedakan dari
 * mutasi — dan pemiliknya harus meminta bukti transfer satu per satu, persis
 * pekerjaan yang mau dihapus.
 *
 * Penanda ditambahkan, bukan mengganti angka terakhir: mahasiswa membayar
 * SEDIKIT LEBIH, tidak pernah kurang dari harga yang tertulis.
 */
export function nominalUnik(harga: number, penanda: number) {
  if (!Number.isInteger(harga) || harga < 1) return null;
  if (!Number.isInteger(penanda) || penanda < PENANDA_MIN || penanda > PENANDA_MAKS) return null;
  return harga + penanda;
}

/**
 * Pilih penanda yang belum dipakai pesanan mana pun yang masih menunggu.
 *
 * Yang dihindari hanya penanda yang MASIH HIDUP. Pesanan yang sudah lunas atau
 * kedaluwarsa mengembalikan penandanya ke peredaran; tanpa itu, 999 pesanan
 * pertama akan menghabiskan seluruh persediaan selamanya.
 *
 * Dimulai dari angka acak, bukan dari 1. Kalau selalu berurutan, siapa pun
 * dapat menghitung berapa banyak pesanan yang pernah masuk hanya dari nominal
 * yang ia bayar sendiri.
 */
export function penandaKosong(terpakai: number[], acak = Math.random): number | null {
  const dipakai = new Set(terpakai);
  const jumlah = PENANDA_MAKS - PENANDA_MIN + 1;
  if (dipakai.size >= jumlah) return null;
  const mulai = PENANDA_MIN + Math.floor(acak() * jumlah);
  for (let langkah = 0; langkah < jumlah; langkah += 1) {
    const calon = PENANDA_MIN + ((mulai - PENANDA_MIN + langkah) % jumlah);
    if (!dipakai.has(calon)) return calon;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Nomor pesanan
// ---------------------------------------------------------------------------

// Tanpa huruf dan angka yang mudah tertukar ketika dibacakan: 0/O, 1/I, 5/S.
const ABJAD = "ABCDEFGHJKLMNPQRTUVWXYZ23456789";

/**
 * Nomor pesanan, mis. "PSN-7HQ4M2".
 *
 * Dipegang mahasiswa untuk menanyakan pesanannya, dan dipakai halaman beli
 * untuk menanyakan statusnya. Karena itu ia harus sulit ditebak: siapa pun
 * yang dapat menerka nomor pesanan orang lain dapat ikut melihat kode yang
 * keluar dari pesanan itu.
 */
export function nomorPesanan(acakBytes?: (n: number) => Uint32Array) {
  const ambil =
    acakBytes ??
    ((n: number) => {
      const nilai = new Uint32Array(n);
      if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(nilai);
      else for (let i = 0; i < n; i += 1) nilai[i] = Math.floor(Math.random() * 0xffffffff);
      return nilai;
    });
  const huruf = Array.from(ambil(6), (angka) => ABJAD[angka % ABJAD.length]);
  return `PSN-${huruf.join("")}`;
}

export function rapikanNomorPesanan(value: unknown) {
  if (typeof value !== "string") return "";
  return value.toUpperCase().replace(/\s+/g, "").slice(0, 20);
}

// ---------------------------------------------------------------------------
// Waktu
// ---------------------------------------------------------------------------

/** Kapan QR pembayaran ini berhenti berlaku. */
export function batasBayar(dibuat: Date) {
  return new Date(dibuat.getTime() + MENIT_BAYAR * 60_000);
}

/** Kapan akses berakhir, dihitung dari saat kodenya diterbitkan. */
export function batasAkses(paket: Paket, mulai: Date) {
  return new Date(mulai.getTime() + paket.hari * 24 * 60 * 60_000);
}

/** Rupiah yang enak dibaca, mis. "Rp 25.037". */
export function rupiah(nilai: number) {
  return `Rp ${Math.round(nilai).toLocaleString("id-ID")}`;
}

/**
 * Sisa waktu sebagai "mm:dd", berhenti di nol.
 *
 * Dipakai hitung mundur pada halaman beli. Tidak pernah negatif: penghitung
 * yang berjalan terus ke angka minus membuat orang mengira pembayarannya
 * masih ditunggu padahal sudah lewat.
 */
export function sisaWaktu(sampai: Date, sekarang: Date = new Date()) {
  const detik = Math.max(0, Math.floor((sampai.getTime() - sekarang.getTime()) / 1000));
  const menit = Math.floor(detik / 60);
  return `${String(menit).padStart(2, "0")}:${String(detik % 60).padStart(2, "0")}`;
}
