// ============================================================
// MENGIRIM FORMULIR YANG BOLEH DICOBA LAGI
//
// MASALAHNYA. Penyerahan skripsi mengunggah berkas puluhan MB lebih dulu,
// lalu mengirim formulirnya. Ketika langkah terakhir itu gagal — fungsi
// serverless kehabisan waktu (504), mati di tengah (502), atau sambungan
// ponsel terputus tepat saat jawabannya hendak datang — SELURUH pekerjaan
// mahasiswa dianggap hilang: ia diminta memilih ulang empat berkas dan
// mengunggah puluhan MB dari nol.
//
// Yang paling menyakitkan: kegagalan itu sering terjadi SESUDAH server
// sebenarnya menyimpan pengajuannya. Yang hilang hanya jawabannya.
//
// PERBAIKANNYA dua bagian, dan keduanya harus ada:
//
//   1. Di sini — kirimannya dicoba lagi beberapa kali. Berkasnya sudah berada
//      di penyimpanan, jadi percobaan ulang hanya mengirim beberapa ratus
//      bita, bukan mengunggah ulang apa pun.
//   2. Di server — /api/requests dan /api/revisions mengenali kiriman ulang
//      dari jalur berkasnya, lalu memulangkan tiket yang SAMA alih-alih
//      membuat tiket kedua. Tanpa bagian ini, percobaan ulang di sini akan
//      melahirkan pengajuan ganda.
//
// YANG TIDAK DICOBA LAGI: penolakan yang datang dari portal sendiri. Bila
// server sempat menjawab dengan pesannya sendiri ("NIM harus angka", "Berkas
// melebihi batas", "Portal sedang maintenance"), mengulanginya hanya membuang
// waktu mahasiswa dan memakan kuota pembatas laju — jawabannya akan sama.
// Yang dicoba lagi hanyalah kegagalan yang TIDAK membawa pesan portal: itu
// tanda permintaannya tidak pernah selesai diproses.
// ============================================================
import { pesanStatusHttp } from "@/lib/pesan-http";

/** Berapa kali formulir dikirim sebelum menyerah. */
export const MAKS_PERCOBAAN = 3;

/**
 * Batas waktu satu percobaan.
 *
 * Fungsi serverless-nya sendiri dibatasi 60 detik, jadi jawabannya — termasuk
 * jawaban galat platform — selalu datang sebelum ini. Angka 90 detik adalah
 * jaring pengaman untuk keadaan ketika jawabannya tidak datang sama sekali;
 * tanpa batas ini, fetch dapat menggantung tanpa akhir dan layar mahasiswa
 * tertinggal pada "Menyimpan pengajuan…" selamanya.
 */
export const BATAS_WAKTU_KIRIM_MS = 90_000;

/** Jeda sebelum percobaan berikutnya; dikalikan nomor percobaan. */
const JEDA_DASAR_MS = 1_500;

/**
 * Pantas dicoba lagi?
 *
 * `adaPesanPortal` benar bila jawabannya berisi JSON portal beserta pesannya.
 * Itu berarti kode portal sempat berjalan dan MEMUTUSKAN menolak — keputusan
 * yang tidak akan berubah bila diulang.
 *
 * Status 0 dipakai untuk kegagalan yang tidak punya kode HTTP sama sekali
 * (sambungan terputus, waktu habis sebelum jawabannya datang).
 */
export function bolehCobaLagi(status: number, adaPesanPortal: boolean) {
  if (adaPesanPortal) return false;
  if (status === 0) return true;
  // 2xx yang badannya bukan JSON portal: jawabannya terpotong atau diganti di
  // tengah jalan oleh perantara jaringan. Permintaannya mungkin sudah selesai
  // diproses, mungkin belum — dan hanya percobaan ulang yang dapat memastikan.
  if (status >= 200 && status < 300) return true;
  // 408 & 425: permintaan tidak selesai diterima. 5xx tanpa pesan portal:
  // kegagalan platform, bukan penolakan portal.
  if (status === 408 || status === 425) return true;
  return status >= 500 && status <= 599;
}

/** Kalimat untuk kegagalan yang tidak sampai membawa jawaban HTTP. */
export function pesanJaringan(galat: unknown) {
  const nama = galat instanceof Error ? galat.name : "";
  if (nama === "TimeoutError" || nama === "AbortError") {
    return "Server belum menjawab sampai batas waktu. Kiriman diulang.";
  }
  return "Sambungan ke server terputus. Kiriman diulang.";
}

function tunggu(ms: number) {
  return new Promise<void>((lanjut) => setTimeout(lanjut, ms));
}

type Jawaban<T> =
  | { jenis: "berhasil"; data: T }
  | { jenis: "tolak"; pesan: string }
  | { jenis: "ulang"; pesan: string };

async function sekali<T>(alamat: string, isi: FormData, batasWaktuMs: number): Promise<Jawaban<T>> {
  try {
    const jawaban = await fetch(alamat, {
      method: "POST",
      body: isi,
      signal: AbortSignal.timeout(batasWaktuMs),
    });
    const muatan = (await jawaban.json().catch(() => null)) as
      | { success?: boolean; message?: string }
      | null;
    const pesanPortal = typeof muatan?.message === "string" ? muatan.message : "";

    if (jawaban.ok && muatan && muatan.success !== false) {
      return { jenis: "berhasil", data: muatan as T };
    }
    const pesan = pesanPortal || pesanStatusHttp(jawaban.status);
    return bolehCobaLagi(jawaban.status, Boolean(pesanPortal))
      ? { jenis: "ulang", pesan }
      : { jenis: "tolak", pesan };
  } catch (galat: unknown) {
    return { jenis: "ulang", pesan: pesanJaringan(galat) };
  }
}

/**
 * Kirim formulir, dan coba lagi bila yang gagal bukan keputusan portal.
 *
 * `lapor` dipanggil sebelum setiap percobaan supaya layar dapat menuliskan
 * "percobaan 2 dari 3" — menunggu dalam diam adalah alasan orang menekan
 * tombol kirim berkali-kali, dan itulah yang melahirkan pengajuan ganda.
 */
export async function kirimFormulir<T>(
  alamat: string,
  isi: FormData,
  opsi: {
    maks?: number;
    batasWaktuMs?: number;
    lapor?: (percobaan: number, maks: number) => void;
  } = {},
): Promise<T> {
  const maks = Math.max(1, opsi.maks ?? MAKS_PERCOBAAN);
  const batasWaktuMs = opsi.batasWaktuMs ?? BATAS_WAKTU_KIRIM_MS;
  let terakhir = "Kiriman gagal.";

  for (let percobaan = 1; percobaan <= maks; percobaan++) {
    opsi.lapor?.(percobaan, maks);
    const hasil = await sekali<T>(alamat, isi, batasWaktuMs);
    if (hasil.jenis === "berhasil") return hasil.data;
    if (hasil.jenis === "tolak") throw new Error(hasil.pesan);

    terakhir = hasil.pesan;
    if (percobaan < maks) await tunggu(JEDA_DASAR_MS * percobaan);
  }

  throw new Error(
    `${terakhir} Sudah dicoba ${maks} kali dan server tetap tidak menyelesaikannya. ` +
      "Berkas Anda masih tersimpan di server; coba kirim lagi beberapa menit lagi — " +
      "bila pengajuannya ternyata sudah masuk, nomor tiketnya akan muncul tanpa membuat pengajuan kedua.",
  );
}
