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
// Keduanya berakhir sama: berkas terverifikasi, tersimpan di folder tiketnya,
// dan jalurnya siap dicatat di basis data.
//
// HANYA untuk server.
// ============================================================
import {
  batasBagianMb,
  periksaBerkasBagian,
  type BagianPenyerahan,
} from "@/lib/bukti-penyerahan";
import {
  buatJalurDokumen,
  moveDocument,
  periksaObjekPdf,
  uploadDocument,
} from "@/lib/document-storage";
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
 * SELURUH bagian diperiksa sebelum satu pun disentuh. Kalau pemeriksaannya
 * diselang-seling dengan pemindahan berkas, bagian keempat yang ditolak
 * meninggalkan tiga berkas setengah jadi di folder tiket.
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
 * Verifikasi tiap berkas lalu letakkan di folder tiketnya.
 *
 * `naik` dan `sapu` dimiliki pemanggil dan diisi di tempat, supaya blok
 * penanganan galat miliknya dapat membersihkan seluruh jejak — berkas yang
 * sudah pindah maupun yang masih menunggu di transit — tanpa perlu menebak
 * sejauh mana proses ini sempat berjalan.
 */
export async function amankanBagian(input: {
  daftar: BagianDiklaim[];
  folder: "requests" | "revisions";
  ticket: string;
  naik: string[];
  sapu: string[];
}): Promise<{ ok: true; hasil: BagianTersimpan[] } | { ok: false; pesan: string }> {
  const hasil: BagianTersimpan[] = [];

  for (const b of input.daftar) {
    if (b.transit) {
      const cek = await periksaObjekPdf(b.transit, batasBagianMb(b.id) * 1024 * 1024, b.label);
      if (!cek.ok) return { ok: false, pesan: cek.pesan };

      const tujuan = buatJalurDokumen({
        folder: input.folder,
        ticket: input.ticket,
        fileName: b.nama,
      });
      await moveDocument(b.transit, tujuan);
      // Sudah pindah: bukan lagi urusan penyapu transit, tetapi menjadi
      // urusan pembatalan bila langkah berikutnya gagal.
      const posisi = input.sapu.indexOf(b.transit);
      if (posisi >= 0) input.sapu.splice(posisi, 1);
      input.naik.push(tujuan);

      hasil.push({ ...b, ukuran: cek.ukuran, jalur: tujuan });
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
