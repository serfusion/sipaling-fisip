// ============================================================
// MODE MAINTENANCE — sisi server (baca/tulis ke tabel app_settings)
// ============================================================
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  MAINTENANCE_KEY,
  DEFAULT_MAINTENANCE,
  parseMaintenance,
  type MaintenanceState,
} from "@/lib/maintenance";
import { getCurrentProfile } from "@/lib/supabase-server";

/**
 * Membaca status maintenance.
 *
 * SENGAJA GAGAL-TERBUKA: bila database bermasalah, fungsi ini mengembalikan
 * status "tidak maintenance". Halaman utama tidak boleh ikut mati hanya
 * karena satu baris pengaturan gagal dibaca — persis alasan yang sama seperti
 * catatan pada src/app/page.tsx.
 */
export async function readMaintenanceState(): Promise<MaintenanceState> {
  try {
    const rows = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, MAINTENANCE_KEY))
      .limit(1);
    return parseMaintenance(rows[0]?.value);
  } catch {
    return DEFAULT_MAINTENANCE;
  }
}

export async function writeMaintenanceState(state: MaintenanceState) {
  const value = JSON.stringify(state);
  await db
    .insert(appSettings)
    .values({ key: MAINTENANCE_KEY, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

/**
 * Penjaga untuk endpoint yang dipakai MAHASISWA (kirim pengajuan, unggah
 * revisi, ajukan judul). Selama maintenance, pengunjung umum ditolak dengan
 * 503 supaya halaman yang sudah terlanjur terbuka di tab lama tidak bisa
 * menyelinap mengirim data.
 *
 * Dosen/admin yang sudah login TIDAK diblokir: mereka justru sedang bekerja
 * membereskan sesuatu ketika portal ditutup.
 *
 * Mengembalikan Response bila harus ditolak, atau null bila boleh lanjut.
 */
export async function blockedByMaintenance(): Promise<Response | null> {
  const state = await readMaintenanceState();
  if (!state.enabled) return null;

  const profile = await getCurrentProfile();
  if (profile) return null;

  return Response.json(
    {
      success: false,
      message:
        "Portal sedang dalam mode maintenance, jadi pengiriman ditutup sementara. Silakan coba lagi setelah layanan kembali dibuka.",
    },
    { status: 503 },
  );
}
