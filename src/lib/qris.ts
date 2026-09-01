// ============================================================
// QRIS: BACA, UBAH STATIS MENJADI DINAMIS
//
// Disalin dan ditulis ulang dari qris-dinamis (MIT, github.com/verssache/
// qris-dinamis). Yang diambil hanya tiga hal intinya — pengurai TLV, penyisip
// nominal, dan CRC16 — tanpa aplikasi React maupun CLI-nya.
//
// KENAPA DITULIS ULANG, BUKAN DIPASANG SEBAGAI PAKET:
// Isinya cuma ratusan baris tanpa satu pun ketergantungan, dan bagian ini
// menentukan ke mana uang orang mengalir. Kode yang menentukan hal seperti itu
// lebih baik ada di dalam gudang sendiri, terbaca, dan teruji di sini.
//
// BENTUK QRIS (EMVCo):
// Rentetan "TLV" — dua angka tag, dua angka panjang, lalu isinya sepanjang itu.
//   00 02 01            → Payload Format Indicator
//   01 02 11            → 11 statis, 12 dinamis
//   54 05 25000         → nominal (hanya ada pada yang dinamis)
//   63 04 A1B2          → CRC16 atas SELURUH teks sampai "6304"
// ============================================================

/** Tag yang dipakai berkas ini. Nomornya baku, bukan pilihan kami. */
export const TAG = {
  metodeAwal: "01",
  nominal: "54",
  penandaBiaya: "55",
  biayaTetap: "56",
  biayaPersen: "57",
  mataUang: "53",
  negara: "58",
  namaMerchant: "59",
  kotaMerchant: "60",
  kodePos: "61",
  kategori: "52",
  crc: "63",
} as const;

export const STATIS = "11";
export const DINAMIS = "12";

export type Tlv = { tag: string; nilai: string };

/**
 * CRC-16/CCITT-FALSE.
 *
 * Bukan sembarang CRC16: yang dipakai QRIS berpolinomial 0x1021, berawal
 * 0xFFFF, tanpa pembalikan bit, dan tanpa XOR penutup. Salah satu saja dari
 * keempatnya membuat seluruh QR yang dihasilkan ditolak aplikasi pembayaran —
 * dan itu baru ketahuan di depan kasir. Nilai ujinya ada di uji-qris.ts:
 * CRC dari "123456789" wajib 0x29B1.
 */
export function crc16(teks: string) {
  let crc = 0xffff;
  for (let i = 0; i < teks.length; i += 1) {
    crc ^= teks.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Pecah rentetan QRIS menjadi daftar TLV, apa adanya dan berurutan.
 *
 * Mengembalikan null bila bentuknya rusak. Sengaja tidak "memperbaiki" apa
 * pun: QRIS yang tidak terbaca utuh harus ditolak, bukan ditebak.
 */
export function uraiTlv(qris: string): Tlv[] | null {
  const daftar: Tlv[] = [];
  let i = 0;
  while (i < qris.length) {
    if (i + 4 > qris.length) return null;
    const tag = qris.slice(i, i + 2);
    const panjangTeks = qris.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(panjangTeks)) return null;
    const panjang = Number(panjangTeks);
    const awal = i + 4;
    if (awal + panjang > qris.length) return null;
    daftar.push({ tag, nilai: qris.slice(awal, awal + panjang) });
    i = awal + panjang;
  }
  return daftar.length > 0 ? daftar : null;
}

/** Susun kembali daftar TLV menjadi rentetan, tanpa CRC. */
function susunTlv(daftar: Tlv[]) {
  return daftar
    .map(({ tag, nilai }) => `${tag}${String(nilai.length).padStart(2, "0")}${nilai}`)
    .join("");
}

/**
 * Pasang CRC di ujung.
 *
 * "6304" ikut dihitung, isinya tidak. Ini yang paling sering keliru ketika
 * orang menulis sendiri: CRC dihitung atas teks yang sudah memuat "6304"
 * tetapi belum memuat empat huruf hasilnya.
 */
export function pasangCrc(tanpaCrc: string) {
  const dasar = `${tanpaCrc}${TAG.crc}04`;
  return `${dasar}${crc16(dasar)}`;
}

export type BacaanQris = {
  merchant: string;
  kota: string;
  kodePos: string;
  kategori: string;
  mataUang: string;
  negara: string;
  dinamis: boolean;
  /** Nominal yang sudah tertanam, kosong pada QRIS statis. */
  nominal: string;
};

const nilaiTag = (daftar: Tlv[], tag: string) => daftar.find((t) => t.tag === tag)?.nilai ?? "";

/** Baca keterangan yang tampil ke pengguna. */
export function bacaQris(qris: string): BacaanQris | null {
  const daftar = uraiTlv(qris);
  if (!daftar) return null;
  return {
    merchant: nilaiTag(daftar, TAG.namaMerchant),
    kota: nilaiTag(daftar, TAG.kotaMerchant),
    kodePos: nilaiTag(daftar, TAG.kodePos),
    kategori: nilaiTag(daftar, TAG.kategori),
    mataUang: nilaiTag(daftar, TAG.mataUang),
    negara: nilaiTag(daftar, TAG.negara),
    dinamis: nilaiTag(daftar, TAG.metodeAwal) === DINAMIS,
    nominal: nilaiTag(daftar, TAG.nominal),
  };
}

export type HasilPeriksa = { sah: boolean; alasan: string };

/** Periksa keutuhan: bentuk TLV-nya benar DAN CRC-nya cocok. */
export function periksaQris(qris: string): HasilPeriksa {
  const bersih = qris.trim();
  if (bersih.length < 12) return { sah: false, alasan: "Rentetan QRIS terlalu pendek." };
  const daftar = uraiTlv(bersih);
  if (!daftar) return { sah: false, alasan: "Bentuk TLV-nya tidak terbaca utuh." };
  if (!daftar.some((t) => t.tag === TAG.crc)) return { sah: false, alasan: "Tidak ada CRC (tag 63)." };

  const potong = bersih.slice(0, -4);
  if (!potong.endsWith(`${TAG.crc}04`)) {
    return { sah: false, alasan: "CRC tidak berada di ujung seperti seharusnya." };
  }
  const seharusnya = crc16(potong);
  const tertulis = bersih.slice(-4).toUpperCase();
  if (seharusnya !== tertulis) {
    return { sah: false, alasan: `CRC tidak cocok: tertulis ${tertulis}, seharusnya ${seharusnya}.` };
  }
  return { sah: true, alasan: "" };
}

/** Tag wajib berurut menaik. Tempat sisipan dicari dari urutan itu. */
function sisipkanUrut(daftar: Tlv[], tag: string, nilai: string) {
  const tanpa = daftar.filter((t) => t.tag !== tag);
  const posisi = tanpa.findIndex((t) => t.tag > tag);
  const baru = { tag, nilai };
  if (posisi === -1) return [...tanpa, baru];
  return [...tanpa.slice(0, posisi), baru, ...tanpa.slice(posisi)];
}

export type BiayaLayanan =
  | { jenis: "tidak-ada" }
  | { jenis: "tetap"; nilai: number }
  | { jenis: "persen"; nilai: number };

export type HasilUbah = { ok: true; qris: string } | { ok: false; pesan: string };

/**
 * Ubah QRIS statis menjadi dinamis bernominal.
 *
 * Nominal ditulis sebagai bilangan bulat rupiah tanpa pemisah. Sen tidak
 * dipakai: rupiah pada QRIS Indonesia selalu bulat, dan menuliskan ",00"
 * hanya memperbesar peluang ditolak.
 */
export function jadikanDinamis(
  qrisStatis: string,
  nominal: number,
  biaya: BiayaLayanan = { jenis: "tidak-ada" },
): HasilUbah {
  // HANYA ujungnya yang dirapikan. Spasi di TENGAH tidak boleh disentuh:
  // "Naufal Shop 1" dan "Kab. Tangerang" memang memuat spasi, dan membuangnya
  // membuat panjang yang tertulis pada TLV tidak lagi cocok dengan isinya —
  // seluruh QRIS milik merchant yang namanya lebih dari satu kata gagal
  // dikonversi.
  const bersih = qrisStatis.trim();

  const periksa = periksaQris(bersih);
  if (!periksa.sah) return { ok: false, pesan: `QRIS asal tidak sah. ${periksa.alasan}` };

  if (!Number.isFinite(nominal) || !Number.isInteger(nominal) || nominal < 1) {
    return { ok: false, pesan: "Nominal harus bilangan bulat minimal 1." };
  }
  // Tag 54 hanya menyediakan dua angka untuk panjangnya, jadi nominalnya
  // paling panjang tiga belas huruf. Batas ini bukan aturan kami.
  if (String(nominal).length > 13) return { ok: false, pesan: "Nominal terlalu besar." };

  const daftar = uraiTlv(bersih);
  if (!daftar) return { ok: false, pesan: "QRIS asal tidak dapat diurai." };

  // CRC lama dibuang; yang baru dipasang setelah seluruh perubahan selesai.
  let hasil = daftar.filter((t) => t.tag !== TAG.crc);

  hasil = sisipkanUrut(hasil, TAG.metodeAwal, DINAMIS);
  hasil = sisipkanUrut(hasil, TAG.nominal, String(nominal));

  // Biaya layanan selalu dibersihkan lebih dulu. Tanpa itu, QRIS yang sudah
  // pernah dikonversi menyisakan biaya lama yang tidak terlihat siapa pun.
  hasil = hasil.filter(
    (t) => t.tag !== TAG.penandaBiaya && t.tag !== TAG.biayaTetap && t.tag !== TAG.biayaPersen,
  );
  if (biaya.jenis === "tetap") {
    if (!Number.isInteger(biaya.nilai) || biaya.nilai < 1) {
      return { ok: false, pesan: "Biaya tetap harus bilangan bulat minimal 1." };
    }
    hasil = sisipkanUrut(hasil, TAG.penandaBiaya, "02");
    hasil = sisipkanUrut(hasil, TAG.biayaTetap, String(biaya.nilai));
  } else if (biaya.jenis === "persen") {
    if (!(biaya.nilai > 0) || biaya.nilai > 100) {
      return { ok: false, pesan: "Biaya persen harus di antara 0 dan 100." };
    }
    hasil = sisipkanUrut(hasil, TAG.penandaBiaya, "03");
    hasil = sisipkanUrut(hasil, TAG.biayaPersen, String(biaya.nilai));
  }

  return { ok: true, qris: pasangCrc(susunTlv(hasil)) };
}
