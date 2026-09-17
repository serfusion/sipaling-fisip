// ============================================================
// PENYAPU RUANG TRANSIT
//
// Mahasiswa yang memilih empat berkas lalu menutup tabnya meninggalkan empat
// PDF di folder transit yang tidak pernah diklaim tiket mana pun. Tanpa
// penyapu, tumpukan itu tidak pernah berkurang — dan seluruh alasan
// penyerahan kembali ke penyimpanan portal adalah supaya kuotanya tidak
// menumpuk antar musim.
//
// Yang disapu hanya folder transit, dan hanya yang berumur lebih dari sehari:
// berkas yang benar-benar dipakai sudah dipindahkan ke folder tiketnya pada
// detik formulirnya terkirim, jadi apa pun yang masih tertinggal di sana
// setelah sehari pasti yatim.
//
// Pengaman tambahan: jalur yang ternyata masih ditunjuk basis data TIDAK
// dihapus. Pemindahannya boleh saja pernah gagal separuh jalan, dan menghapus
// berkas yang masih punya pemilik jauh lebih mahal daripada menyisakan
// beberapa berkas yatim satu hari lagi.
// ============================================================
import { PREFIKS_TRANSIT, FOLDER_TRANSIT, hariTransit } from "@/lib/unggah-langsung";

type Penyimpanan = {
  list: (
    jalur: string,
    opsi?: { limit?: number },
  ) => Promise<{ data: Array<{ name: string; id: string | null }> | null; error: unknown }>;
  remove: (jalur: string[]) => Promise<{ error: unknown }>;
};

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
    const { data: hari } = await storage.list(induk, { limit: 1000 });
    if (!hari) continue;

    // Folder dikenali dari id yang kosong; sisanya benda, yang tidak
    // diharapkan berada langsung di bawah induk ini.
    const namaHari = hari.filter((h) => h.id === null).map((h) => h.name);

    for (const tanggal of hariKedaluwarsa(namaHari)) {
      const { data: isi } = await storage.list(`${induk}/${tanggal}`, { limit: 1000 });
      if (!isi || isi.length === 0) continue;

      const jalur = isi.filter((b) => b.id !== null).map((b) => `${induk}/${tanggal}/${b.name}`);
      if (jalur.length === 0) continue;

      const dipakai = await masihDipakai(jalur);
      const buang = jalur.filter((j) => !dipakai.has(j));

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
