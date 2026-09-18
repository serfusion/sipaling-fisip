// ============================================================
// PENYAPU RUANG TRANSIT
//
// Mahasiswa yang memilih empat berkas lalu menutup tabnya meninggalkan empat
// PDF di folder transit yang tidak pernah diklaim tiket mana pun. Tanpa
// penyapu, tumpukan itu tidak pernah berkurang — dan seluruh alasan
// penyerahan kembali ke penyimpanan portal adalah supaya kuotanya tidak
// menumpuk antar musim.
//
// Yang disapu hanya folder transit, dan hanya yang berumur lebih dari sehari.
//
// PENGAMANNYA — dan sejak v45 ia bukan lagi pengaman tambahan melainkan
// SATU-SATUNYA yang menjaga berkas penyerahan: jalur yang masih ditunjuk basis
// data TIDAK PERNAH dihapus. Berkas yang sudah diklaim tiket kini tetap tinggal
// di folder ini (ia tidak lagi disalin ke folder tiket — lihat catatan pada
// src/lib/unggah-klaim.ts), jadi yang membedakan "milik tiket" dari "yatim"
// hanyalah pertanyaan ke basis data di bawah.
//
// Karena berkas yang diklaim ikut menetap, satu folder tanggal pada musim
// penyerahan dapat memuat ribuan benda. Daftarnya karena itu diambil
// BERHALAMAN: satu permintaan list hanya memulangkan 1000 nama pertama, dan
// tanpa halaman berikutnya berkas yatim di luar seribu pertama tidak akan
// pernah tersapu.
// ============================================================
import { PREFIKS_TRANSIT, FOLDER_TRANSIT, hariTransit } from "@/lib/unggah-langsung";

type Penyimpanan = {
  list: (
    jalur: string,
    opsi?: { limit?: number; offset?: number },
  ) => Promise<{ data: Array<{ name: string; id: string | null }> | null; error: unknown }>;
  remove: (jalur: string[]) => Promise<{ error: unknown }>;
};

/** Sebanyak apa satu permintaan daftar boleh memulangkan. Batas Storage sendiri. */
const SEHALAMAN = 1000;

/**
 * Berapa halaman paling banyak dibaca untuk satu folder tanggal.
 *
 * Bukan karena 20.000 benda sehari pernah terjadi, melainkan karena pembacaan
 * berhalaman tanpa batas atas adalah perulangan yang bergantung pada jawaban
 * pihak lain — dan pembersih yang berjalan otomatis setiap hari tidak boleh
 * punya perulangan yang tidak dijamin berhenti.
 */
const MAKS_HALAMAN = 20;

/** Seluruh isi satu folder, dibaca berhalaman sampai habis. */
async function isiFolder(storage: Penyimpanan, folder: string) {
  const semua: Array<{ name: string; id: string | null }> = [];
  for (let halaman = 0; halaman < MAKS_HALAMAN; halaman++) {
    const { data } = await storage.list(folder, { limit: SEHALAMAN, offset: halaman * SEHALAMAN });
    if (!data || data.length === 0) break;
    semua.push(...data);
    // Halaman yang tidak penuh berarti sudah yang terakhir. Pemanggil tiruan
    // yang mengabaikan offset juga berhenti di sini, bukan berputar selamanya.
    if (data.length < SEHALAMAN) break;
  }
  return semua;
}

/** Umur berkas transit sebelum dianggap yatim. */
export const HARI_SIMPAN_TRANSIT = 1;

/**
 * Nama folder tanggal yang sudah lewat masa simpannya.
 *
 * Nama foldernya YYYY-MM-DD, jadi perbandingan teks biasa sudah setara dengan
 * perbandingan tanggal — dan tidak memerlukan penguraian tanggal sama sekali.
 */
export function hariKedaluwarsa(daftar: string[], sekarang = Date.now()) {
  const batas = hariTransit(sekarang - HARI_SIMPAN_TRANSIT * 24 * 3600_000);
  return daftar.filter((nama) => /^\d{4}-\d{2}-\d{2}$/.test(nama) && nama < batas);
}

/**
 * Sapu folder transit pada satu bucket.
 *
 * `masihDipakai` menerima daftar jalur dan mengembalikan jalur yang masih
 * ditunjuk basis data. Diserahkan kepada pemanggil supaya berkas ini tetap
 * dapat diuji tanpa satu pun sambungan basis data.
 */
export async function sapuTransit(
  storage: Penyimpanan,
  masihDipakai: (jalur: string[]) => Promise<Set<string>>,
) {
  let dihapus = 0;

  for (const folder of FOLDER_TRANSIT) {
    const induk = `${folder}/${PREFIKS_TRANSIT}`;
    const hari = await isiFolder(storage, induk);

    // Folder dikenali dari id yang kosong; sisanya benda, yang tidak
    // diharapkan berada langsung di bawah induk ini.
    const namaHari = hari.filter((h) => h.id === null).map((h) => h.name);

    for (const tanggal of hariKedaluwarsa(namaHari)) {
      const isi = await isiFolder(storage, `${induk}/${tanggal}`);
      if (isi.length === 0) continue;

      const jalur = isi.filter((b) => b.id !== null).map((b) => `${induk}/${tanggal}/${b.name}`);
      if (jalur.length === 0) continue;

      // Pertanyaan ke basis data ikut dipotong: satu klausa IN dengan ribuan
      // jalur adalah kueri yang dapat ditolak sendiri oleh Postgres.
      const buang: string[] = [];
      for (let i = 0; i < jalur.length; i += 200) {
        const potongan = jalur.slice(i, i + 200);
        const dipakai = await masihDipakai(potongan);
        buang.push(...potongan.filter((j) => !dipakai.has(j)));
      }

      // Dipotong per seratus: satu perintah hapus dengan ribuan nama ditolak
      // Storage, dan yang ditolak adalah SELURUH daftarnya.
      for (let i = 0; i < buang.length; i += 100) {
        const potongan = buang.slice(i, i + 100);
        const { error } = await storage.remove(potongan);
        if (!error) dihapus += potongan.length;
      }
    }
  }

  return dihapus;
}
