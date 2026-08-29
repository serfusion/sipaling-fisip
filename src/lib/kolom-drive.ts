// ============================================================
// PENJAGA KOLOM drive_url
//
// Kolom service_requests.drive_url baru ada setelah migrasi v8 dijalankan di
// Supabase. Selama belum, seluruh portal harus tetap berjalan: pengajuan
// masih tersimpan dan dashboard masih terbuka, hanya tautan Drive-nya yang
// ikut menumpang di catatan mahasiswa.
//
// Hasil pemeriksaan disimpan di memori proses, jadi biayanya satu kueri kecil
// sekali jalan, bukan tiap permintaan.
// ============================================================

import { db } from "@/db";
import { sql } from "drizzle-orm";

let siap: boolean | null = null;

export async function kolomDriveSiap(): Promise<boolean> {
  if (siap !== null) return siap;
  try {
    const rows = await db.execute(sql`
      select 1
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'service_requests'
         and column_name = 'drive_url'
       limit 1
    `);
    // Bentuk hasil db.execute berbeda antar driver; keduanya ditangani.
    const daftar = Array.isArray(rows) ? rows : ((rows as { rows?: unknown[] }).rows ?? []);
    siap = daftar.length > 0;
  } catch {
    siap = false;
  }
  return siap;
}

/** Dipakai pengujian dan setelah migrasi dijalankan tanpa memulai ulang. */
export function lupakanKolomDrive() {
  siap = null;
}
