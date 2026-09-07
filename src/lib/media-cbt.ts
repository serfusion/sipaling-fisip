// ============================================================
// MEDIA SOAL: KAPAN BERKASNYA IKUT DIBUANG
//
// Gambar dan video soal mendarat di bucket Supabase yang bersifat publik.
// Barisnya di basis data dapat dihapus dalam satu perintah; berkasnya TIDAK
// ikut hilang sendiri, dan di situlah penyimpanan berbayar itu bocor.
//
// Tiga jalan berkas dibuang, dan ketiganya ada karena kebocorannya berbeda:
//
//   1. SOAL DIHAPUS       — berkasnya dibuang pada saat yang sama. Ini yang
//                           paling sering, dan tanpa ia satu bank soal yang
//                           disusun ulang tiap semester meninggalkan seluruh
//                           gambar lamanya di sana selamanya.
//   2. UJIAN DIHAPUS      — seluruh isi map ujian-<id>/ dibuang sekaligus,
//                           termasuk berkas yang soalnya sudah lebih dulu
//                           hilang bersama ujiannya.
//   3. PENYAPU HARIAN     — berkas yang tidak lagi ditunjuk soal mana pun dan
//                           umurnya lewat sebulan. Ini menutup sisa yang tidak
//                           tertutup dua jalan di atas: unggahan yang batal
//                           dipakai, dan gambar lama yang tergantikan saat
//                           soalnya disunting.
//
// SATU HAL YANG SENGAJA TIDAK DIKERJAKAN penyapu harian: membuang berkas yang
// MASIH ditunjuk soal, walau umurnya setahun. Bank soal disusun sekali lalu
// dipakai berulang tiap semester, dan gambar yang hilang sendiri sesudah
// sebulan berarti naskah ujian yang kosong pada hari pelaksanaan tanpa seorang
// pun tahu sebabnya. Yang menginginkan aturan sekeras itu menyalakannya
// sendiri lewat CBT_SAPU_SEMUA_MEDIA=1, dan risikonya tertulis di sana.
// ============================================================

/** Berapa lama berkas yatim disimpan sebelum disapu, dalam hari. */
export const HARI_SIMPAN_MEDIA = 30;

/**
 * Bentuk URL publik Supabase Storage:
 *   https://<proyek>.supabase.co/storage/v1/object/public/<bucket>/<jalur>
 *
 * Yang dicari hanya bagian sesudah nama bucket-nya.
 */
const PENANDA = "/storage/v1/object/public/";

/**
 * Jalur objek di dalam bucket, atau null bila URL-nya bukan milik bucket itu.
 *
 * Null berarti "jangan sentuh", dan itu jawaban yang benar untuk sebagian
 * besar media: pengajar boleh menempelkan tautan YouTube, Google Drive, atau
 * gambar dari situs mana pun. Menghapus sesuatu karena salah mengenali tautan
 * luar sebagai berkas sendiri adalah kesalahan yang tidak dapat dibatalkan.
 */
export function jalurMedia(url: unknown, bucket: string): string | null {
  const teks = String(url ?? "").trim();
  if (!teks || !bucket) return null;
  const i = teks.indexOf(`${PENANDA}${bucket}/`);
  if (i < 0) return null;
  const mentah = teks.slice(i + PENANDA.length + bucket.length + 1);
  // Tanda tanya dan pagar dibuang: URL publik sering membawa ?t=... dari
  // pemuat gambar, dan jalur yang ikut membawanya tidak akan pernah cocok
  // dengan objek mana pun di Storage.
  const bersih = mentah.split("?")[0].split("#")[0];
  if (!bersih) return null;
  let jalur: string;
  try { jalur = decodeURIComponent(bersih); } catch { jalur = bersih; }
  // Naik satu tingkat lewat ".." harus mustahil. Jalur ini diserahkan apa
  // adanya ke perintah hapus Storage, dan satu saja yang lolos berarti berkas
  // di luar bucket ini ikut terbuang.
  if (jalur.includes("..") || jalur.startsWith("/")) return null;
  return jalur;
}

/**
 * Semua jalur berkas sendiri yang ditunjuk sekumpulan soal.
 *
 * Menerima DUA bentuk, karena soal yang sama muncul dalam dua rupa di sistem
 * ini: baris basis data memakai kolom `mediaUrl`, sedangkan bentuk yang
 * dipakai halaman memakai objek `media` berisi jenis, url, dan keterangannya.
 * Menerima satu bentuk saja berarti separuh pemanggilnya diam-diam tidak
 * menemukan berkas apa pun, dan berkasnya tertinggal di Storage.
 */
export type SoalBermedia = { media?: unknown; mediaUrl?: unknown } | null | undefined;

export function jalurDariSoal(soal: SoalBermedia[], bucket: string): string[] {
  const kumpul = new Set<string>();
  for (const s of soal) {
    const url = s && "mediaUrl" in s && s.mediaUrl ? String(s.mediaUrl) : bacaUrlMedia(s?.media);
    const jalur = jalurMedia(url, bucket);
    if (jalur) kumpul.add(jalur);
  }
  return [...kumpul];
}

/**
 * URL di dalam kolom media, apa pun bentuk simpanannya.
 *
 * Kolomnya JSON bertali di basis data, tetapi sebagian jalur kode sudah
 * menguraikannya lebih dulu. Yang dibaca di sini menerima keduanya, karena
 * jalur yang salah bentuk hanya menghasilkan "tidak ada berkas" dan itu
 * berarti berkasnya tertinggal di Storage tanpa ada yang tahu.
 */
export function bacaUrlMedia(media: unknown): string {
  if (!media) return "";
  if (typeof media === "string") {
    const teks = media.trim();
    if (!teks || teks === "{}" || teks === "null") return "";
    try {
      const urai = JSON.parse(teks) as { url?: unknown };
      return String(urai?.url ?? "");
    } catch {
      return "";
    }
  }
  if (typeof media === "object") return String((media as { url?: unknown }).url ?? "");
  return "";
}

/** Map penyimpanan milik satu ujian. Dipakai saat ujiannya dihapus. */
export function mapUjian(examId: number): string {
  return `ujian-${examId}`;
}

/**
 * Umur objek Storage dalam milidetik, dari cap waktu yang dibawa namanya.
 *
 * Nama berkasnya dibentuk `ujian-<id>/<Date.now()>-<uuid>.<ext>` pada saat
 * diunggah, jadi umurnya terbaca tanpa perlu bertanya ke Storage. Ini penting:
 * daftar objek Supabase mengembalikan created_at, tetapi tidak untuk semua
 * versi dan tidak untuk berkas yang dipindahkan tangan.
 *
 * Null berarti tidak dapat dibaca, dan yang tidak dapat dibaca TIDAK PERNAH
 * disapu. Menebak umur berkas lalu menghapusnya adalah kesalahan yang tidak
 * ada jalan kembalinya.
 */
export function umurMedia(jalur: string, sekarang: number): number | null {
  const nama = String(jalur ?? "").split("/").pop() ?? "";
  const cocok = /^(\d{13})-/.exec(nama);
  if (!cocok) return null;
  const cap = Number(cocok[1]);
  if (!Number.isFinite(cap) || cap <= 0) return null;
  const umur = sekarang - cap;
  // Cap waktu dari masa depan berarti jam server pernah meleset. Diperlakukan
  // sebagai umur nol, bukan sebagai umur negatif yang lolos perbandingan.
  return umur < 0 ? 0 : umur;
}

export type Objek = { jalur: string; dibuat?: string | Date | null };

/**
 * Berkas mana yang boleh disapu sekarang.
 *
 * @param objek     seluruh isi bucket.
 * @param dipakai   jalur yang masih ditunjuk soal yang ada.
 * @param sekarang  jam server.
 * @param sapuSemua abaikan `dipakai` dan sapu apa pun yang cukup tua. Hanya
 *   dari CBT_SAPU_SEMUA_MEDIA=1, dan akibatnya nyata: bank soal yang dipakai
 *   ulang semester depan kehilangan gambarnya.
 */
export function sapuMedia(
  objek: Objek[],
  dipakai: Iterable<string>,
  sekarang: number,
  { hari = HARI_SIMPAN_MEDIA, sapuSemua = false } = {},
): string[] {
  const masihDipakai = new Set(dipakai);
  const batas = Math.max(1, hari) * 24 * 3600 * 1000;
  const buang: string[] = [];
  for (const o of objek) {
    const jalur = String(o?.jalur ?? "");
    if (!jalur) continue;
    if (!sapuSemua && masihDipakai.has(jalur)) continue;
    const umur = umurObjek(o, sekarang);
    if (umur === null || umur < batas) continue;
    buang.push(jalur);
  }
  return buang;
}

/** Umur satu objek: cap waktu Storage lebih dipercaya daripada namanya. */
function umurObjek(o: Objek, sekarang: number): number | null {
  if (o.dibuat) {
    const t = new Date(o.dibuat).getTime();
    if (Number.isFinite(t) && t > 0) return Math.max(0, sekarang - t);
  }
  return umurMedia(o.jalur, sekarang);
}
