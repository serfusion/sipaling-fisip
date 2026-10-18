// ============================================================
// PENJAGA MAINTENANCE UNTUK ENDPOINT MAHASISWA
//
// Dipisahkan dari maintenance-store.ts dengan sengaja. Berkas ini memanggil
// getCurrentProfile, sementara supabase-server kini perlu membaca status
// maintenance untuk menahan sesi selain Super Admin. Kalau keduanya berada
// dalam satu berkas, impornya melingkar.
// ============================================================
import { getCurrentProfile } from "@/lib/supabase-server";
import { readMaintenanceState } from "@/lib/maintenance-store";
import { kartuUntukLayanan, layananTertutup } from "@/lib/maintenance";

/**
 * Penjaga untuk endpoint yang dipakai MAHASISWA (kirim pengajuan, unggah
 * revisi, ajukan judul). Selama maintenance, pengunjung umum ditolak dengan
 * 503 supaya halaman yang sudah terlanjur terbuka di tab lama tidak bisa
 * menyelinap mengirim data.
 *
 * Hanya Super Admin yang lolos. getCurrentProfile sendiri sudah memulangkan
 * null untuk peran lain selama maintenance, jadi admin unit dan dosen ikut
 * tertahan di sini — memang itu yang dikehendaki: saat portal ditutup, hanya
 * satu orang yang boleh menyentuhnya.
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

/**
 * Penjaga kunci per kartu layanan. Kartu yang terkunci tampil bergembok di
 * portal, tetapi tab lama atau kiriman yang dirakit sendiri tetap dapat
 * mencoba mengirim — di sinilah yang seperti itu ditolak.
 *
 * Hanya Super Admin yang lolos, supaya ia dapat menguji kartu yang sedang
 * maintenance. Sesi hanya ditanyakan bila layanannya memang terkunci, jadi
 * kiriman ke layanan yang terbuka tidak menambah satu panggilan pun ke
 * Supabase.
 *
 * Mengembalikan Response bila harus ditolak, atau null bila boleh lanjut.
 */
export async function blockedByServiceLock(serviceType: string): Promise<Response | null> {
  const { lockedServices } = await readMaintenanceState();
  if (!layananTertutup(serviceType, lockedServices)) return null;

  const profile = await getCurrentProfile();
  if (!layananTertutup(serviceType, lockedServices, profile?.role)) return null;

  const nama = kartuUntukLayanan(serviceType) ?? serviceType;
  return Response.json(
    {
      success: false,
      message: `${nama} sedang maintenance, jadi untuk sementara belum menerima pengajuan. Silakan coba lagi setelah layanannya dibuka kembali.`,
    },
    { status: 503 },
  );
}
