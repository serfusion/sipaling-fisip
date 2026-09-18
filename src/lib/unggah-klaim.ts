// ============================================================
// MENGAMBIL ALIH BERKAS YANG SUDAH DIUNGGAH PERAMBAN
//
// Formulir penyerahan sekarang dapat datang dalam dua bentuk, dan keduanya
// harus dilayani:
//
//   BARU      — berkasnya sudah berada di penyimpanan, formulir hanya
//               membawa jalur beserta tanda tangannya. Inilah jalur yang
//               dipakai peramban modern, dan satu-satunya yang sanggup
//               melewati batas 4,5 MB milik fungsi serverless.
//   CADANGAN  — berkasnya ikut di badan permintaan seperti sebelumnya.
//               Tetap dilayani untuk halaman lama yang masih terbuka di tab
//               mahasiswa, dan untuk pemasangan yang penyimpanannya belum
//               siap melayani unggahan langsung.
//
// Keduanya berakhir sama: berkas terverifikasi, berada di penyimpanan, dan
// jalurnya siap dicatat di basis data.
//
// Yang TIDAK terjadi di sini sejak v45: memindahkan berkas ke folder tiketnya.
// Alasannya panjang dan penting — lihat catatan pada amankanBagian di bawah.
//
// HANYA untuk server.
// ============================================================
import {
  batasBagianMb,
  periksaBerkasBagian,
  type BagianPenyerahan,
} from "@/lib/bukti-penyerahan";
import { periksaObjekPdf, uploadDocument } from "@/lib/document-storage";
import { periksaKlaimJalur } from "@/lib/unggah-tanda";
import type { FolderTransit } from "@/lib/unggah-langsung";

/** Jenis yang dititipkan ke penyimpanan. Bukan yang dilaporkan peramban:
 *  sebagian komputer menyebut PDF sebagai "application/octet-stream", dan
 *  bucket menolak jenis yang tidak ada di daftarnya. Ekstensi dan isi
 *  berkasnya sudah diperiksa, jadi jenisnya tidak perlu ditebak. */
const PDF_MIME = "application/pdf";

export type BagianDiklaim = {
  id: string;
  label: string;
  urut: number;
  nama: string;
  ukuran: number;
  /** Terisi pada jalur cadangan. */
  berkas: File | null;
  /** Terisi pada jalur baru. */
  transit: string | null;
};

export type BagianTersimpan = BagianDiklaim & { jalur: string };

function teksForm(form: FormData, kunci: string) {
  const nilai = form.get(kunci);
  return typeof nilai === "string" ? nilai.trim() : "";
}

/**
 * Baca keempat bagian dari formulir, apa pun bentuk kirimannya.
 *
 * SELURUH bagian diperiksa sebelum satu pun diklaim. Kalau pemeriksaannya
 * diselang-seling dengan pencatatan, bagian keempat yang ditolak meninggalkan
 * tiga berkas yang sudah tercatat sebagai milik tiket yang tidak pernah jadi.
 *
 * `sapu` berisi jalur transit yang tanda tangannya SUDAH terbukti sah, jadi
 * aman dihapus bila pengirimannya batal. Jalur yang tanda tangannya gagal
 * tidak pernah masuk ke sana: ia mungkin milik orang lain, dan menghapusnya
 * justru akan menjadi celah baru.
 */
export function bacaBagianDariForm(
  form: FormData,
  folder: FolderTransit,
  bagian: BagianPenyerahan[],
): { ok: true; daftar: BagianDiklaim[]; sapu: string[] } | { ok: false; pesan: string; sapu: string[] } {
  const daftar: BagianDiklaim[] = [];
  const sapu: string[] = [];

  for (const [urut, b] of bagian.entries()) {
    const jalur = teksForm(form, `bagian_${b.id}_jalur`);

    if (jalur) {
      const klaim = periksaKlaimJalur({
        jalur,
        folder,
        tanda: teksForm(form, `bagian_${b.id}_tanda`),
        kedaluwarsa: Number(teksForm(form, `bagian_${b.id}_kedaluwarsa`)),
      });
      if (!klaim.ok) return { ok: false, pesan: klaim.pesan, sapu };
      sapu.push(jalur);

      const nama = teksForm(form, `bagian_${b.id}_nama`) || `${b.id}.pdf`;
      const ukuran = Number(teksForm(form, `bagian_${b.id}_ukuran`)) || 0;
      // Keterangan dari peramban diperiksa dengan aturan yang sama seperti
      // berkas sungguhan. Ukuran sebenarnya tetap dibaca ulang dari
      // penyimpanan sesudah ini — keterangan dapat dikarang, isi bucket tidak.
      const cek = periksaBerkasBagian(b.id, { name: nama, size: ukuran || 1 });
      if (!cek.ok) return { ok: false, pesan: cek.pesan, sapu };

      daftar.push({ id: b.id, label: b.label, urut, nama, ukuran, berkas: null, transit: jalur });
      continue;
    }

    const isi = form.get(`bagian_${b.id}`);
    const berkas = isi instanceof File && isi.name ? isi : null;
    const cek = periksaBerkasBagian(b.id, berkas);
    if (!cek.ok) return { ok: false, pesan: cek.pesan, sapu };
    const asli = berkas as File;
    daftar.push({
      id: b.id,
      label: b.label,
      urut,
      nama: asli.name,
      ukuran: asli.size,
      berkas: asli,
      transit: null,
    });
  }

  return { ok: true, daftar, sapu };
}

/**
 * Verifikasi tiap berkas lalu nyatakan jalurnya menjadi milik tiket ini.
 *
 * DUA HAL YANG DIUBAH v45, dan keduanya soal waktu jalan fungsi serverless:
 *
 * 1. BERKAS TIDAK LAGI DIPINDAHKAN. Dulu tiap berkas disalin dari folder
 *    transit ke folder tiketnya. "Pindah" di Supabase Storage berarti
 *    MENYALIN seluruh isinya: untuk satu penyerahan skripsi itu sampai 55 MB,
 *    empat kali, berurutan, di dalam satu fungsi yang anggarannya 60 detik.
 *    Itulah sebab galat 504 yang selalu muncul pada berkas besar — tepat
 *    sesudah layar menulis "Semua berkas terunggah. Menyimpan pengajuan…".
 *
 *    Yang hilang karena tidak memindahkan hanyalah kerapian nama folder di
 *    dalam bucket. Tidak ada satu pun bagian portal yang membaca tiket dari
 *    jalur berkas: dashboard, unduhan, arsip, dan penghapusan semuanya
 *    bekerja dari jalur yang tercatat di basis data. Penyapu transit pun sejak
 *    awal MENOLAK menghapus jalur yang masih ditunjuk basis data (lihat
 *    src/lib/sapu-transit.ts), jadi berkas yang sudah diklaim aman di
 *    tempatnya.
 *
 *    Keuntungan lain yang sama pentingnya: jalurnya TIDAK BERUBAH. Kiriman
 *    ulang sesudah jawaban yang hilang karena itu dapat dikenali dari
 *    jalurnya, dan dijawab dengan tiket yang sama alih-alih tiket kedua.
 *
 * 2. PEMERIKSAANNYA SEKALIGUS, bukan satu per satu. Empat pemeriksaan
 *    berurutan berarti delapan perjalanan ke Supabase yang saling menunggu;
 *    dijalankan bersama, keempatnya selesai dalam waktu satu pemeriksaan.
 *
 * `naik` dan `sapu` dimiliki pemanggil dan diisi di tempat, supaya blok
 * penanganan galat miliknya dapat membersihkan seluruh jejak tanpa perlu
 * menebak sejauh mana proses ini sempat berjalan.
 */
export async function amankanBagian(input: {
  daftar: BagianDiklaim[];
  folder: "requests" | "revisions";
  ticket: string;
  naik: string[];
  sapu: string[];
}): Promise<{ ok: true; hasil: BagianTersimpan[] } | { ok: false; pesan: string }> {
  // Berkas yang sudah berada di penyimpanan diperiksa SEKALIGUS. Satu pun
  // yang ditolak membatalkan seluruhnya — pemanggil yang menyapu jejaknya.
  const diPenyimpanan = input.daftar.filter(
    (b): b is BagianDiklaim & { transit: string } => typeof b.transit === "string" && b.transit.length > 0,
  );
  const ukuranBenar = new Map<string, number>();
  if (diPenyimpanan.length > 0) {
    const jawaban = await Promise.all(
      diPenyimpanan.map((b) =>
        periksaObjekPdf(b.transit, batasBagianMb(b.id) * 1024 * 1024, b.label),
      ),
    );
    const tolak = jawaban.find((j) => !j.ok);
    if (tolak && !tolak.ok) return { ok: false, pesan: tolak.pesan };
    diPenyimpanan.forEach((b, i) => {
      const j = jawaban[i];
      // Ukuran yang dicatat adalah ukuran SEBENARNYA dari penyimpanan, bukan
      // yang dilaporkan peramban: yang kedua dapat dikarang, yang pertama tidak.
      if (j.ok) ukuranBenar.set(b.transit, j.ukuran);
    });
  }

  const hasil: BagianTersimpan[] = [];
  for (const b of input.daftar) {
    if (b.transit) {
      // Sudah diklaim tiket ini: bukan lagi urusan penyapu transit, tetapi
      // menjadi urusan pembatalan bila langkah berikutnya gagal.
      const posisi = input.sapu.indexOf(b.transit);
      if (posisi >= 0) input.sapu.splice(posisi, 1);
      input.naik.push(b.transit);
      hasil.push({ ...b, ukuran: ukuranBenar.get(b.transit) ?? b.ukuran, jalur: b.transit });
      continue;
    }

    if (!b.berkas) return { ok: false, pesan: `Berkas "${b.label}" belum dipilih.` };
    const jalur = await uploadDocument({
      folder: input.folder,
      ticket: input.ticket,
      file: b.berkas,
      contentType: PDF_MIME,
    });
    input.naik.push(jalur);
    hasil.push({ ...b, jalur });
  }

  return { ok: true, hasil };
}

/**
 * Jalur berkas yang dibawa satu kiriman, untuk mengenali kiriman ulang.
 *
 * Hanya jalur yang datang dari penyimpanan (jalur transit) yang berguna di
 * sini: ia dibuat server, unik untuk satu izin unggah, dan TIDAK berubah
 * sesudah diklaim — tiga sifat yang membuatnya dapat dipakai sebagai kunci
 * "kiriman ini sudah pernah masuk". Kiriman jalur cadangan tidak punya jalur
 * apa pun sebelum berkasnya naik, jadi ia tidak dapat dikenali dengan cara ini.
 */
export function jalurDiklaim(daftar: BagianDiklaim[]) {
  return daftar
    .map((b) => b.transit)
    .filter((jalur): jalur is string => typeof jalur === "string" && jalur.length > 0);
}
