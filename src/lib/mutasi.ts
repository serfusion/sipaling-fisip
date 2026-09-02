// ============================================================
// MEMBACA PEMBERITAHUAN UANG MASUK
//
// DANA tidak memberi tahu situs mana pun ketika uang masuk. Yang ia beri tahu
// hanyalah PONSEL pemiliknya, lewat satu baris pemberitahuan:
//
//     "Transaksi Berhasil! Kamu menerima Rp25.037 dari Naufal"
//
// Berkas ini membaca baris seperti itu dan mengeluarkan nominalnya, supaya
// aplikasi penerus pemberitahuan di ponsel dapat menjadi jembatan antara DANA
// dan pesanan di sini — tanpa gerbang pembayaran dan tanpa biaya bulanan.
//
// SENGAJA tidak menyentuh basis data. Semua yang di sini murni perhitungan
// atas untai teks, jadi ia dapat diuji dengan kalimat pemberitahuan sungguhan
// tanpa perlu satu pun pesanan hidup.
// ============================================================

/** Kata yang menandakan uang MASUK, bukan keluar. */
const MASUK = [
  "menerima", "diterima", "terima", "masuk", "penerimaan",
  "received", "incoming", "credit", "kredit",
];

/** Kata yang menandakan uang KELUAR, dan karena itu harus diabaikan. */
const KELUAR = [
  "kamu mengirim", "anda mengirim", "kirim ke", "transfer ke",
  "pembayaran ke", "dibayarkan ke", "terpotong", "penarikan",
  "kamu membayar", "anda membayar", "debit", "sent to",
];

/**
 * Apakah kalimat ini berbicara tentang uang yang MASUK?
 *
 * Kata "keluar" diperiksa lebih dulu dan menang. Kalimat pengiriman uang di
 * DANA hampir selalu memuat kata "berhasil" juga, jadi mendahulukan kata
 * masuk akan membuat pembayaran KELUAR yang nominalnya kebetulan sama ikut
 * menerbitkan kode akses.
 */
export function arahMasuk(teks: string): boolean {
  const isi = String(teks || "").toLowerCase();
  if (!isi.trim()) return false;
  if (KELUAR.some((k) => isi.includes(k))) return false;
  return MASUK.some((k) => isi.includes(k));
}

/**
 * Semua nominal rupiah di dalam kalimat, sesuai urutan kemunculannya.
 *
 * Aturan penulisan Indonesia: titik memisahkan ribuan, koma memisahkan sen.
 * "Rp25.037,00" berarti dua puluh lima ribu tiga puluh tujuh rupiah — bukan
 * dua puluh lima koma nol tiga tujuh. Salah membaca ini berarti pesanan yang
 * benar tidak pernah ketemu.
 */
export function semuaNominal(teks: string): number[] {
  const isi = String(teks || "");
  const hasil: number[] = [];
  const pola = /rp\.?\s*([\d][\d.,\s]*)/gi;
  let cocok: RegExpExecArray | null;
  while ((cocok = pola.exec(isi)) !== null) {
    // Sennya dibuang lebih dulu, baru pemisah ribuannya. Urutan sebaliknya
    // membuat "25.037,00" terbaca 2.503.700.
    const tanpaSen = cocok[1].split(",")[0];
    const angka = Number(tanpaSen.replace(/[.\s]/g, ""));
    if (Number.isInteger(angka) && angka > 0) hasil.push(angka);
  }
  return hasil;
}

/**
 * Nominal transaksinya — yang PERTAMA disebut, bukan yang terbesar.
 *
 * Pemberitahuan uang masuk selalu menyebut nominal transaksinya lebih dulu,
 * lalu sisa saldo. Mengambil yang terbesar berarti pada suatu hari sisa saldo
 * kebetulan sama dengan sebuah pesanan hidup, dan kode akses terbit untuk
 * orang yang belum membayar apa-apa.
 */
export function bacaNominal(teks: string): number | null {
  return semuaNominal(teks)[0] ?? null;
}

export type Mutasi = { nominal: number; masuk: boolean; teks: string };

/**
 * Baca satu pemberitahuan menjadi mutasi yang siap dicocokkan.
 *
 * Mengembalikan null bila tidak ada nominal yang terbaca — kalimat tanpa
 * angka rupiah bukan pemberitahuan pembayaran, dan tidak perlu dikeluhkan.
 */
export function bacaMutasi(teks: string): Mutasi | null {
  const bersih = String(teks || "").replace(/\s+/g, " ").trim();
  if (!bersih) return null;
  const nominal = bacaNominal(bersih);
  if (nominal === null) return null;
  return { nominal, masuk: arahMasuk(bersih), teks: bersih.slice(0, 400) };
}

/**
 * Kumpulkan teks dari bentuk kiriman apa pun.
 *
 * Tiap aplikasi penerus pemberitahuan menamai kolomnya sendiri-sendiri, dan
 * tidak ada standarnya. Yang dilakukan di sini: menerima nama-nama yang lazim,
 * dan menggabungkan judul dengan isinya — nominal kadang ada di judul
 * ("Rp25.037 masuk"), kadang di badannya.
 */
export function teksDariMuatan(muatan: unknown): string {
  if (typeof muatan === "string") return muatan;
  const isi = (muatan ?? {}) as Record<string, unknown>;
  // Judul lebih dulu, mengikuti urutan bacanya di layar ponsel. Urutan ini
  // menentukan nominal mana yang terbaca pertama, dan nominal pertama itulah
  // yang dipakai — jadi ia bukan soal kerapian.
  const nama = ["judul", "title", "teks", "text", "pesan", "message", "body", "isi", "content", "notification"];
  const bagian: string[] = [];
  for (const n of nama) {
    const nilai = isi[n];
    const bersih = typeof nilai === "string" ? nilai.trim() : "";
    // Penerus yang mengirim isi yang sama pada dua kolom tidak boleh membuat
    // kalimatnya tertulis dua kali.
    if (bersih && !bagian.includes(bersih)) bagian.push(bersih);
  }
  return bagian.join(" · ");
}
