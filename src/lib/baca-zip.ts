// ============================================================
// PEMBACA ZIP DI PERAMBAN — pasangan dari src/lib/zip.ts
//
// zip.ts MENULIS arsip; berkas ini MEMBACANYA. Dibutuhkan sejak dosen boleh
// mengunggah .pptx untuk dijadikan soal: sebuah .pptx adalah zip berisi satu
// XML per salindia, dan tidak ada cara membaca teksnya tanpa membuka zip-nya
// lebih dulu.
//
// KENAPA TIDAK MEMAKAI PUSTAKA:
// Yang dibutuhkan hanya membaca — tanpa menulis, tanpa enkripsi, tanpa arsip
// terbelah. Pemekaran deflate-nya diserahkan kepada DecompressionStream yang
// sudah ada di dalam peramban, jadi yang tersisa hanyalah membaca daftar isi
// arsipnya. Menambah satu pustaka demi itu tidak sepadan.
//
// HANYA UNTUK PERAMBAN. DecompressionStream tersedia di Chrome, Edge, Firefox,
// dan Safari 16.4 ke atas; peramban yang lebih tua mendapat pesan yang jelas,
// bukan galat yang tidak dapat dibaca siapa pun.
// ============================================================

export type IsiArsip = { nama: string; data: Uint8Array };

/** Tanda direktori pusat pada akhir berkas zip. */
const TANDA_AKHIR = 0x06054b50;
const TANDA_PUSAT = 0x02014b50;

/**
 * Cari direktori pusat, dari belakang.
 *
 * Dibaca dari ekor DAN BUKAN dari kepala, karena hanya ekornya yang memuat
 * daftar isi lengkap beserta letak tiap berkas. Membaca dari kepala berarti
 * menebak-nebak panjang tiap bagian, dan tebakan itu meleset pada arsip yang
 * memakai penanda data tambahan.
 */
function cariAkhir(dv: DataView): number {
  // Komentar arsip paling panjang 65535 bita; lebih jauh dari itu tidak perlu.
  const mulai = Math.max(0, dv.byteLength - 65_535 - 22);
  for (let i = dv.byteLength - 22; i >= mulai; i -= 1) {
    if (dv.getUint32(i, true) === TANDA_AKHIR) return i;
  }
  return -1;
}

async function mekarkan(data: Uint8Array, metode: number): Promise<Uint8Array> {
  // Metode 0 = disimpan apa adanya, tanpa pemampatan.
  if (metode === 0) return data;
  if (metode !== 8) throw new Error(`Cara pemampatan ${metode} tidak dikenali.`);
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "Peramban ini belum dapat membuka berkas .pptx. Pakai Chrome, Edge, Firefox, " +
        "atau Safari versi 16.4 ke atas, atau unggah dokumennya sebagai .docx / .pdf.",
    );
  }
  const aliran = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(aliran).arrayBuffer());
}

/**
 * Buka arsip zip dan kembalikan berkas yang namanya lolos saringan.
 *
 * Saringan diberikan pemanggilnya supaya arsip besar tidak perlu dimekarkan
 * seluruhnya: sebuah .pptx berisi gambar-gambar yang tidak ada gunanya di
 * sini, dan memekarkannya hanya menghabiskan memori peramban.
 */
export async function bacaZip(
  sumber: ArrayBuffer,
  saring: (nama: string) => boolean = () => true,
): Promise<IsiArsip[]> {
  const dv = new DataView(sumber);
  const bita = new Uint8Array(sumber);
  const akhir = cariAkhir(dv);
  if (akhir < 0) throw new Error("Berkasnya bukan arsip zip yang sah.");

  const jumlah = dv.getUint16(akhir + 10, true);
  let pos = dv.getUint32(akhir + 16, true);

  const hasil: IsiArsip[] = [];
  for (let i = 0; i < jumlah; i += 1) {
    if (pos + 46 > dv.byteLength || dv.getUint32(pos, true) !== TANDA_PUSAT) break;

    const metode = dv.getUint16(pos + 10, true);
    const ukuranMampat = dv.getUint32(pos + 20, true);
    const panjangNama = dv.getUint16(pos + 28, true);
    const panjangTambahan = dv.getUint16(pos + 30, true);
    const panjangKomentar = dv.getUint16(pos + 32, true);
    const awalLokal = dv.getUint32(pos + 42, true);
    const nama = new TextDecoder().decode(bita.subarray(pos + 46, pos + 46 + panjangNama));
    pos += 46 + panjangNama + panjangTambahan + panjangKomentar;

    if (!saring(nama)) continue;

    // Panjang nama dan bagian tambahan pada KEPALA LOKAL bisa berbeda dari
    // yang tercatat di direktori pusat, jadi keduanya dibaca ulang di sana.
    if (awalLokal + 30 > dv.byteLength) continue;
    const namaLokal = dv.getUint16(awalLokal + 26, true);
    const tambahanLokal = dv.getUint16(awalLokal + 28, true);
    const awalData = awalLokal + 30 + namaLokal + tambahanLokal;
    if (awalData + ukuranMampat > bita.length) continue;

    try {
      hasil.push({ nama, data: await mekarkan(bita.subarray(awalData, awalData + ukuranMampat), metode) });
    } catch (galat) {
      // Satu berkas rusak di dalam arsip tidak boleh menggugurkan sisanya —
      // satu salindia yang gagal dibaca jauh lebih baik daripada seluruh
      // presentasi yang ditolak.
      if (hasil.length === 0 && i === jumlah - 1) throw galat;
    }
  }
  return hasil;
}
