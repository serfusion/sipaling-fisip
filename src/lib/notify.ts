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
