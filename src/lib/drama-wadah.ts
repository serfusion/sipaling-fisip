// ============================================================
// MEMBUKA WADAH POTONGAN VIDEO
//
// Satu platform — ShortMax — tidak mengirim potongan videonya sebagai berkas
// yang dapat langsung diputar. Yang dikirimnya berkas berwadah: 1040 bita
// kepala buatan aplikasinya sendiri, lalu isinya. Pemutar mana pun menolak
// berkas itu, sebab bukan potongan video yang dikenalinya.
//
// Yang dikerjakan berkas ini membuka wadah itu, dan hanya itu. Tidak ada
// pengaman yang dilewati: KUNCINYA IKUT DI DALAM BERKAS YANG SAMA, pada
// posisi yang ditunjuk kepalanya sendiri, dan servernya mengirimkan berkas itu
// kepada siapa pun yang memintanya tanpa menanyakan apa pun. Ini membaca
// format, sebagaimana membaca kepala berkas .mp4 — bukan membuka kunci.
//
// Disalin dari src/app/api/shortmax/hls/route.ts di hulu (MIT), dengan satu
// perbedaan yang disengaja dan dijelaskan di bawah.
//
// Berkas ini hanya dipakai di server. Ia mengimpor node:crypto, jadi ia tidak
// boleh ikut ke bundel peramban — itulah sebabnya ia tinggal di sini dan bukan
// di src/lib/drama-aliran.ts, yang ikut dipakai layar menonton.
// ============================================================
import { createDecipheriv } from "node:crypto";

/** Bita pertama tiap potongan MPEG-TS yang sah. */
const TANDA_TS = 0x47;

/** Panjang kepala wadahnya, tetap. */
const PANJANG_KEPALA = 1040;

/** Nama wadahnya, tertulis apa adanya di delapan bita pertama. */
const NAMA_WADAH = "shortmax";

/** Nilai awal AES-CBC-nya, tetap dan tertulis di aplikasinya. */
const AWAL_AES = Buffer.from("shortmax00000000", "ascii");

/** Apakah deretan bita ini sudah berbentuk potongan video yang siap diputar? */
function sudahSiap(bita: Buffer): boolean {
  return bita.length > 0 && bita[0] === TANDA_TS;
}

/** Apakah berkas ini memang berwadah ShortMax? */
export function berwadahShortmax(bita: Buffer): boolean {
  if (bita.length < PANJANG_KEPALA) return false;
  return bita.subarray(0, NAMA_WADAH.length).toString("ascii") === NAMA_WADAH;
}

/**
 * Isi sebenarnya dari sebuah potongan ShortMax.
 *
 * Bentuk berkasnya, menurut kepalanya sendiri:
 *
 *   0..8       nama wadahnya, "shortmax"
 *   16..20     posisi kuncinya, ditulis sebagai angka dalam huruf
 *   24..1024   daerah tempat kunci 16 bita itu berada
 *   1024..1040 enam belas bita yang ikut dipulihkan bersama isinya
 *   1040..     isinya
 *
 * SATU PERBEDAAN DARI HULU, dan ini yang membuatnya bekerja lebih sering.
 * Hulu memulihkan isinya dengan pelucutan ganjal dinyalakan. Isi ini tidak
 * berganjal, jadi pemeriksaannya hampir selalu gagal, pustakanya melempar,
 * dan hulu menangkapnya lalu memulangkan isi yang kepalanya sekadar dipotong.
 * Di sini ganjalnya dimatikan — sehingga pemulihannya benar-benar dicoba —
 * lalu HASILNYA DIPERIKSA: yang dipulangkan yang bita pertamanya benar-benar
 * penanda potongan video. Bila pemulihannya tidak menghasilkan itu, yang
 * dipulangkan isi dengan kepala dipotong saja, persis seperti hulu.
 *
 * Yang tidak dikenali dipulangkan apa adanya. Potongan yang sudah berbentuk
 * video tidak disentuh sama sekali, dan itu memang keadaan sebagian besar
 * potongan pada sebagian besar judul.
 */
export function bukaWadahShortmax(bita: Buffer): Buffer {
  if (sudahSiap(bita)) return bita;
  if (!berwadahShortmax(bita)) return bita;

  const isi = bita.subarray(PANJANG_KEPALA);

  try {
    const posisiKunci = Number.parseInt(bita.subarray(16, 20).toString("ascii"), 10);
    if (!Number.isFinite(posisiKunci)) return isi;

    const geser = posisiKunci - 24;
    const awalKunci = 24 + geser;
    if (geser < 0 || awalKunci + 16 > PANJANG_KEPALA) return isi;

    const kunci = bita.subarray(awalKunci, awalKunci + 16);
    const tersandi = Buffer.concat([bita.subarray(1024, PANJANG_KEPALA), isi.subarray(0, 1024)]);
    if (tersandi.length % 16 !== 0) return isi;

    const pembuka = createDecipheriv("aes-128-cbc", kunci, AWAL_AES);
    pembuka.setAutoPadding(false);
    const terbuka = Buffer.concat([pembuka.update(tersandi), pembuka.final()]);

    if (sudahSiap(terbuka)) return Buffer.concat([terbuka, isi.subarray(1024)]);
    return isi;
  } catch {
    // Wadah yang tidak terbaca bukan alasan menolak melayani: isi tanpa
    // kepalanya masih punya peluang diputar, dan peluang itu lebih baik
    // daripada layar hitam yang pasti.
    return isi;
  }
}

/** Pembuka wadah untuk sebuah nama wadah; null bila tidak ada yang perlu dibuka. */
export function pembukaWadah(nama: string | undefined): ((bita: Buffer) => Buffer) | null {
  return nama === "shortmax" ? bukaWadahShortmax : null;
}
