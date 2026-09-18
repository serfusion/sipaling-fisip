// ============================================================
// MENGENALI KIRIMAN YANG SAMA, DIKIRIM DUA KALI
//
// KEADAAN YANG DILAYANI. Mahasiswa mengunggah empat PDF, formulirnya terkirim,
// server menyimpannya — lalu jawabannya tidak pernah sampai ke peramban:
// fungsi serverless-nya dihentikan sesudah bekerja, sambungan ponselnya
// terputus, atau tabnya sempat dimuat ulang. Di layar mahasiswa yang terlihat
// hanya kegagalan, jadi ia menekan kirim lagi.
//
// Tanpa penjagaan di sini, tekanan kedua itu melahirkan TIKET KEDUA untuk
// skripsi yang sama: dua baris di antrean perpustakaan, delapan berkas, dan
// admin yang harus menebak mana yang harus diarsipkan.
//
// KUNCINYA jalur berkas. Jalur dibuat server saat memberi izin unggah, unik
// untuk satu izin, dan sejak v45 TIDAK BERUBAH sesudah diklaim (berkasnya
// tidak lagi dipindahkan). Jadi: bila ada baris lampiran yang sudah menunjuk
// salah satu jalur pada kiriman ini, kiriman ini bukan pengajuan baru — ia
// kiriman ulang dari pengajuan yang sudah tersimpan.
//
// Yang dipulangkan karena itu tiket yang SUDAH ADA, bukan tiket baru dan bukan
// pula pesan galat. Mahasiswa mendapat nomor tiketnya, dan tidak pernah tahu
// bahwa jawaban pertamanya hilang di jalan.
// ============================================================
import { db } from "@/db";
import { requestAttachments, revisionUploads, serviceRequests } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Tiket yang sudah pernah mengklaim salah satu jalur ini.
 *
 * Dipanggil SEBELUM satu pun berkas diperiksa: kiriman ulang tidak perlu
 * memeriksa apa pun, dan pemeriksaannya sendirilah yang memakan waktu.
 */
export async function tiketPemilikJalur(jalur: string[]) {
  if (jalur.length === 0) return null;
  const rows = await db
    .select({
      id: serviceRequests.id,
      ticket: serviceRequests.ticket,
      nim: serviceRequests.nim,
    })
    .from(requestAttachments)
    .innerJoin(serviceRequests, eq(requestAttachments.requestId, serviceRequests.id))
    .where(inArray(requestAttachments.fileStoragePath, jalur))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Nomor revisi yang sudah pernah mengklaim salah satu jalur ini.
 *
 * Revisi punya masalah tambahan: begitu revisi tersimpan, status tiketnya
 * berpindah dari "Revisi" menjadi "Masuk". Kiriman ulangnya karena itu akan
 * ditolak dengan 409 ("hanya tersedia saat status Revisi") — penolakan yang
 * benar menurut aturannya, tetapi salah menurut keadaannya: berkasnya justru
 * sudah masuk. Fungsi ini yang membedakan keduanya.
 */
export async function revisiPemilikJalur(requestId: number, jalur: string[]) {
  if (jalur.length === 0) return null;
  const rows = await db
    .select({ nomor: revisionUploads.revisionNumber })
    .from(revisionUploads)
    .where(
      and(
        eq(revisionUploads.requestId, requestId),
        inArray(revisionUploads.fileStoragePath, jalur),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
