// ============================================================
// SIAPA MELIHAT NOTIFIKASI YANG MANA
//
// Dipisahkan dari route-nya supaya dapat diuji. Aturan ini pernah salah dan
// salahnya sunyi: Super Admin hanya melihat notifikasi beralamat
// "admin_prodi", sehingga loncengnya diam walaupun pengajuan perpustakaan dan
// PDDIKTI terus berdatangan — dan yang terlihat dari luar cuma "loncengnya
// rusak", bukan "alamatnya tidak cocok".
// ============================================================
import { notifications } from "@/db/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

/** Sebanyak yang dibutuhkan aturan ini; sengaja bukan SessionProfile utuh. */
export type PembacaNotifikasi = { role: string; lecturerId: number | null };

/**
 * Role yang melihat SELURUH notifikasi beralamat role.
 *
 * Orang yang memegang seluruh portal harus melihat seluruh portal; kalau
 * tidak, ia tidak punya cara mengetahui ada unit yang tertinggal.
 */
export const PENGAWAS_SEMUA = ["super_admin", "admin"];

export function audienceFilter(profile: PembacaNotifikasi) {
  if (profile.role === "dosen") {
    // Dosen hanya melihat notifikasi yang ditujukan kepada dirinya.
    return profile.lecturerId === null ? null : eq(notifications.lecturerId, profile.lecturerId);
  }
  if (PENGAWAS_SEMUA.includes(profile.role)) {
    // Seluruh notifikasi beralamat role, apa pun unitnya. Yang beralamat dosen
    // tidak ikut: itu percakapan antara dosen dan mahasiswa bimbingannya.
    return and(isNull(notifications.lecturerId), isNotNull(notifications.audienceRole));
  }
  // Sisanya melihat notifikasi yang dialamatkan ke rolenya sendiri.
  return and(isNull(notifications.lecturerId), eq(notifications.audienceRole, profile.role));
}
