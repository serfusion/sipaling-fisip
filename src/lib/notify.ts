import { db } from "@/db";
import { notifications } from "@/db/schema";

type NotificationInput = {
  audienceRole?: string | null;
  lecturerId?: number | null;
  kind: string;
  severity?: "info" | "urgent";
  title: string;
  body: string;
  refCode?: string | null;
};

// Notifikasi bersifat pelengkap: kegagalan menulisnya tidak boleh
// membatalkan aksi utama (mis. persetujuan prodi yang sudah tersimpan).
export async function pushNotification(input: NotificationInput) {
  try {
    await db.insert(notifications).values({
      audienceRole: input.audienceRole ?? null,
      lecturerId: input.lecturerId ?? null,
      kind: input.kind,
      severity: input.severity || "info",
      title: input.title.slice(0, 200),
      body: input.body,
      refCode: input.refCode ?? null,
    });
  } catch (error) {
    console.error("push notification", error);
  }
}

export async function pushNotifications(list: NotificationInput[]) {
  await Promise.all(list.map((item) => pushNotification(item)));
}

// Role yang berhak menerima notifikasi urusan Pengajuan Judul.
export const PRODI_AUDIENCE = "admin_prodi";

/**
 * Role unit yang menangani sebuah jenis layanan.
 *
 * Notifikasi tanpa alamat yang benar sama saja dengan tidak ada: pengajuan
 * perpustakaan yang dikirim ke "admin_prodi" tidak pernah terlihat oleh orang
 * yang harus mengerjakannya. Peta ini cerminan serviceByUnitRole di
 * supabase-server.ts — dibalik arahnya, dan sengaja dituliskan di sini supaya
 * berkas ini tetap dapat diimpor tanpa menyeret lapisan sesi.
 */
const UNIT_LAYANAN: Record<string, string> = {
  "Layanan Umum": "admin_umum",
  "Layanan Akademik": "admin_akademik",
  "Layanan Prodi": "admin_prodi",
  "Layanan PDDIKTI": "admin_pddikti",
  "Layanan Perpustakaan": "admin_perpustakaan",
  "Layanan Laboratorium": "admin_laboratorium",
};

/**
 * Kepada siapa notifikasi layanan ini ditujukan.
 *
 * Layanan tugas akhir tidak punya unit sendiri — yang memeriksanya dosen
 * tujuan, dan notifikasinya dialamatkan ke dosen itu lewat lecturerId.
 * Alamat role-nya "admin", yang dibaca oleh Admin dan Super Admin, supaya
 * tetap ada yang melihatnya bila dosennya belum sempat membuka dashboard.
 */
export function audienceUntukLayanan(serviceType: string) {
  return UNIT_LAYANAN[serviceType] || "admin";
}
