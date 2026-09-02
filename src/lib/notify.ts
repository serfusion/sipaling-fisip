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

// Role admin unit yang menangani tiap jenis layanan. Dipakai untuk
// mengarahkan notifikasi tiket ke lonceng admin yang benar: tiket
// perpustakaan hanya berbunyi di lonceng Admin Perpustakaan, dan seterusnya.
// Super Admin dan Admin melihat semuanya lewat penyaring di /api/notifications.
//
// "Layanan Tugas Akhir" sengaja tidak ada di sini: tiketnya tidak dipegang
// admin unit mana pun, melainkan dosen tujuan yang dipilih mahasiswa, jadi
// notifikasinya dialamatkan lewat lecturerId.
const AUDIENCE_BY_SERVICE_TYPE: Record<string, string> = {
  "Layanan Umum": "admin_umum",
  "Layanan Akademik": "admin_akademik",
  "Layanan Prodi": "admin_prodi",
  "Layanan PDDIKTI": "admin_pddikti",
  "Layanan Perpustakaan": "admin_perpustakaan",
  "Layanan Laboratorium": "admin_laboratorium",
};

export function audienceForServiceType(serviceType: string): string | null {
  return AUDIENCE_BY_SERVICE_TYPE[serviceType] ?? null;
}
