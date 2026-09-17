// ============================================================
// SISI PERAMBAN DARI UNGGAH LANGSUNG
//
// Satu per satu, bukan sekaligus. Bukan karena lebih cepat — justru sedikit
// lebih lambat — melainkan karena mahasiswa harus tahu berkas KEBERAPA yang
// sedang naik. Empat unggahan paralel yang berhenti di tengah hanya
// menyisakan satu bilah putar tanpa keterangan, dan itulah bentuk lama dari
// keluhan "uploadnya gagal terus".
//
// Kalau pemberi izin tidak menjawab (penyimpanan belum diatur, endpoint-nya
// belum ter-deploy), fungsi ini TIDAK menggagalkan pengisian: ia meminta
// pemanggilnya berpindah ke jalur cadangan — kirim berkas lewat API seperti
// dulu — yang masih sanggup melayani berkas kecil.
// ============================================================
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { pesanStatusHttp } from "@/lib/pesan-http";
import type { BagianTerunggah, FolderTransit, IzinUnggah } from "@/lib/unggah-langsung";

export type HasilUnggahBagian =
  | { mode: "langsung"; hasil: BagianTerunggah[] }
  | { mode: "cadangan"; alasan: string };

/** Berkas PDF selalu dititipkan dengan jenis yang benar, bukan yang dilaporkan peramban.
 *
 *  Bucket penyimpanan menolak jenis yang tidak ada di daftarnya, dan sebagian
 *  komputer melaporkan PDF sebagai "application/octet-stream" karena catatan
 *  asosiasi berkasnya rusak. Ekstensi dan isinya sudah diperiksa di tempat
 *  lain, jadi jenisnya tidak perlu ditebak dari laporan itu. */
const JENIS_PDF = "application/pdf";

/**
 * Terjemahkan keluhan Supabase Storage yang paling sering muncul.
 *
 * Aslinya bahasa Inggris dan menyebut istilah yang tidak berarti apa-apa bagi
 * mahasiswa. Yang pertama di bawah ini khususnya: ia muncul ketika batas
 * ukuran BUCKET belum dinaikkan ke 25 MB, dan yang harus bertindak adalah
 * admin — bukan mahasiswa yang berkasnya memang sah.
 */
function terjemahkanGalatStorage(pesan: string) {
  const kecil = pesan.toLowerCase();
  if (kecil.includes("maximum allowed size") || kecil.includes("payload too large")) {
    return (
      "Penyimpanan menolak karena batas ukurannya belum dinaikkan. " +
      "Beri tahu admin untuk menjalankan supabase-update-v43-unggah-langsung.sql."
    );
  }
  if (kecil.includes("mime type") || kecil.includes("invalid_mime_type")) {
    return "Penyimpanan hanya menerima berkas PDF. Simpan ulang berkasnya sebagai PDF.";
  }
  if (kecil.includes("jwt") || kecil.includes("expired") || kecil.includes("invalid signature")) {
    return "Izin unggahnya sudah kedaluwarsa. Pilih ulang berkasnya lalu kirim lagi.";
  }
  return pesan;
}

/** Unggah lewat pustaka Supabase. Jalur utama, dan yang paling teruji. */
async function lewatKlien(izin: IzinUnggah, berkas: File) {
  const klien = getSupabaseBrowserClient();
  if (!klien) return "Kunci Supabase peramban belum diatur.";
  const { error } = await klien.storage
    .from(izin.bucket)
    // upsert: percobaan berikutnya menimpa sisa percobaan yang terputus.
    // Jalurnya unik per izin, jadi tidak ada berkas orang lain yang
    // mungkin tertimpa.
    .uploadToSignedUrl(izin.jalur, izin.token, berkas, { contentType: JENIS_PDF, upsert: true });
  return error ? terjemahkanGalatStorage(error.message) : null;
}

/** Unggah dengan fetch biasa ke URL bertanda tangan. Cadangan bila pustaka
 *  Supabase tidak dapat dipakai (kunci peramban kosong, atau ia menolak
 *  karena alasan yang tidak ada hubungannya dengan berkasnya). */
async function lewatFetch(izin: IzinUnggah, berkas: File) {
  const jawaban = await fetch(izin.url, {
    method: "PUT",
    body: berkas,
    headers: { "content-type": JENIS_PDF, "x-upsert": "true" },
  });
  if (jawaban.ok) return null;
  const teks = await jawaban.text().catch(() => "");
  return teks ? terjemahkanGalatStorage(teks.slice(0, 200)) : pesanStatusHttp(jawaban.status);
}

async function kirimSatuBerkas(izin: IzinUnggah, berkas: File) {
  // Tiga percobaan, dan yang TERAKHIR memakai cara yang berbeda. Dua yang
  // pertama menjawab jaringan kampus yang kerap memutus unggahan di tengah;
  // yang ketiga menjawab keadaan ketika pustaka Supabase sendiri yang tidak
  // dapat dipakai. Meminta mahasiswa memilih ulang empat berkas karena satu
  // putus di detik terakhir adalah cara tercepat membuat orang berhenti
  // memakai portal.
  const cara = [lewatKlien, lewatKlien, lewatFetch];
  let galatTerakhir = "";

  for (const jalan of cara) {
    try {
      const galat = await jalan(izin, berkas);
      if (!galat) return;
      galatTerakhir = galat;
    } catch (galat: unknown) {
      galatTerakhir = galat instanceof Error ? galat.message : String(galat);
    }
  }

  throw new Error(
    `Berkas "${berkas.name}" gagal diunggah ke penyimpanan. ${galatTerakhir} ` +
      "Periksa sambungan internet Anda lalu kirim lagi.",
  );
}

/**
 * Unggah seluruh bagian langsung ke penyimpanan.
 *
 * `lapor` dipanggil sebelum dan sesudah tiap berkas supaya formulir dapat
 * menulis "Mengunggah berkas 2 dari 4".
 */
export async function unggahBagianLangsung(
  folder: FolderTransit,
  daftar: Array<{ id: string; berkas: File }>,
  lapor?: (selesai: number, total: number, nama: string) => void,
): Promise<HasilUnggahBagian> {
  const hasil: BagianTerunggah[] = [];

  for (const [urut, item] of daftar.entries()) {
    lapor?.(urut, daftar.length, item.berkas.name);

    const jawaban = await fetch("/api/unggah/bagian", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder,
        bagian: item.id,
        nama: item.berkas.name,
        ukuran: item.berkas.size,
      }),
    });
    const payload = (await jawaban.json().catch(() => null)) as
      | { success?: boolean; message?: string; izin?: IzinUnggah }
      | null;

    // 503 berarti penyimpanan atau endpoint-nya sedang tidak siap; 404 berarti
    // halaman lama yang masih terbuka memanggil endpoint yang belum ada.
    // Keduanya bukan kesalahan mahasiswa, jadi pengisiannya tidak dibuang.
    if (jawaban.status === 503 || jawaban.status === 404) {
      return { mode: "cadangan", alasan: payload?.message || "Unggahan langsung sedang tidak tersedia." };
    }
    if (!jawaban.ok || !payload?.success || !payload.izin) {
      throw new Error(payload?.message || pesanStatusHttp(jawaban.status));
    }

    await kirimSatuBerkas(payload.izin, item.berkas);

    hasil.push({
      id: item.id,
      nama: item.berkas.name,
      ukuran: item.berkas.size,
      jalur: payload.izin.jalur,
      tanda: payload.izin.tanda,
      kedaluwarsa: payload.izin.kedaluwarsa,
    });
    lapor?.(urut + 1, daftar.length, item.berkas.name);
  }

  return { mode: "langsung", hasil };
}

/** Tempelkan hasil unggahan ke FormData yang akan dikirim ke API. */
export function tempelkanBagian(formData: FormData, hasil: BagianTerunggah[]) {
  for (const b of hasil) {
    formData.delete(`bagian_${b.id}`);
    formData.set(`bagian_${b.id}_jalur`, b.jalur);
    formData.set(`bagian_${b.id}_tanda`, b.tanda);
    formData.set(`bagian_${b.id}_kedaluwarsa`, String(b.kedaluwarsa));
    formData.set(`bagian_${b.id}_nama`, b.nama);
    formData.set(`bagian_${b.id}_ukuran`, String(b.ukuran));
  }
}
