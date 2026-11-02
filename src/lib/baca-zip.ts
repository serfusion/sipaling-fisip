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

/** Bilangan 64-bit kecil (cukup untuk arsip di bawah 9 PB) sebagai number. */
function u64(dv: DataView, pos: number): number {
  return Number(dv.getBigUint64(pos, true));
}

/**
 * Letak dan jumlah isi direktori pusat, termasuk arsip ZIP64.
 *
 * Arsip yang diunduh dari Google Drive, dan arsip di atas 4 GB atau 65.535
 * berkas, memakai perluasan ZIP64: angka 32-bit di ekor arsip diisi
 * 0xFFFFFFFF dan angka sebenarnya ditaruh di catatan ZIP64 tepat sebelumnya.
 */
function direktoriPusat(dv: DataView, akhir: number): { jumlah: number; pos: number } {
  let jumlah = dv.getUint16(akhir + 10, true);
  let pos = dv.getUint32(akhir + 16, true);
  const lokator = akhir - 20;
  if ((jumlah === 0xffff || pos === 0xffffffff) && lokator >= 0 && dv.getUint32(lokator, true) === 0x07064b50) {
    const akhir64 = u64(dv, lokator + 8);
    if (akhir64 + 56 <= dv.byteLength && dv.getUint32(akhir64, true) === 0x06064b50) {
      jumlah = u64(dv, akhir64 + 32);
      pos = u64(dv, akhir64 + 48);
    }
  }
  return { jumlah, pos };
}

/** Angka ZIP64 pada bidang tambahan 0x0001, menurut urutan bakunya. */
function bacaTambahan64(
  dv: DataView,
  awal: number,
  panjang: number,
  butuh: { asli: boolean; mampat: boolean; lokal: boolean },
): { asli?: number; mampat?: number; lokal?: number } {
  let p = awal;
  while (p + 4 <= awal + panjang) {
    const id = dv.getUint16(p, true);
    const ukuran = dv.getUint16(p + 2, true);
    if (id === 0x0001) {
      let q = p + 4;
      const hasil: { asli?: number; mampat?: number; lokal?: number } = {};
      if (butuh.asli && q + 8 <= p + 4 + ukuran) { hasil.asli = u64(dv, q); q += 8; }
      if (butuh.mampat && q + 8 <= p + 4 + ukuran) { hasil.mampat = u64(dv, q); q += 8; }
      if (butuh.lokal && q + 8 <= p + 4 + ukuran) { hasil.lokal = u64(dv, q); }
      return hasil;
    }
    p += 4 + ukuran;
  }
  return {};
}

/**
 * Buka arsip zip dan kembalikan berkas yang namanya lolos saringan.
 *
 * Saringan diberikan pemanggilnya supaya arsip besar tidak perlu dimekarkan
 * seluruhnya: sebuah .pptx berisi gambar-gambar yang tidak ada gunanya di
 * sini, dan memekarkannya hanya menghabiskan memori peramban.
 *
 * Isi yang tersandi (zip berkata sandi) dilewati, bukan menggugurkan arsip.
 */
export async function bacaZip(
  sumber: ArrayBuffer,
  saring: (nama: string) => boolean = () => true,
): Promise<IsiArsip[]> {
  const dv = new DataView(sumber);
  const bita = new Uint8Array(sumber);
  const akhir = cariAkhir(dv);
  if (akhir < 0) throw new Error("Berkasnya bukan arsip zip yang sah.");

  const { jumlah } = direktoriPusat(dv, akhir);
  let { pos } = direktoriPusat(dv, akhir);

  const hasil: IsiArsip[] = [];
  let galatPertama: unknown = null;
  for (let i = 0; i < jumlah; i += 1) {
    if (pos + 46 > dv.byteLength || dv.getUint32(pos, true) !== TANDA_PUSAT) break;

    const bendera = dv.getUint16(pos + 8, true);
    const metode = dv.getUint16(pos + 10, true);
    let ukuranMampat = dv.getUint32(pos + 20, true);
    const ukuranAsli32 = dv.getUint32(pos + 24, true);
    const panjangNama = dv.getUint16(pos + 28, true);
    const panjangTambahan = dv.getUint16(pos + 30, true);
    const panjangKomentar = dv.getUint16(pos + 32, true);
    let awalLokal = dv.getUint32(pos + 42, true);
    const nama = new TextDecoder().decode(bita.subarray(pos + 46, pos + 46 + panjangNama));
    if (ukuranMampat === 0xffffffff || awalLokal === 0xffffffff || ukuranAsli32 === 0xffffffff) {
      const t = bacaTambahan64(dv, pos + 46 + panjangNama, panjangTambahan, {
        asli: ukuranAsli32 === 0xffffffff, mampat: ukuranMampat === 0xffffffff, lokal: awalLokal === 0xffffffff,
      });
      if (t.mampat !== undefined) ukuranMampat = t.mampat;
      if (t.lokal !== undefined) awalLokal = t.lokal;
    }
    pos += 46 + panjangNama + panjangTambahan + panjangKomentar;

    if (!saring(nama)) continue;
    // Bit 0 = tersandi. Isinya tidak dapat dibaca tanpa sandi.
    if (bendera & 1) continue;

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
      galatPertama ??= galat;
    }
  }
  if (hasil.length === 0 && galatPertama) throw galatPertama;
  return hasil;
}
