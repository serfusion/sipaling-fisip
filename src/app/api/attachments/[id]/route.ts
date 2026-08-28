import { db } from "@/db";
import { requestAttachments, serviceRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createDocumentDownloadUrl } from "@/lib/document-storage";
import { canAccessServiceRequest, getCurrentProfile } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Unduhan satu bagian lampiran (mis. "Upload BAB I s/d BAB V").
//
// Aturan aksesnya persis sama dengan lampiran utama di /api/files/[id]:
// berkas mahasiswa hanya boleh dibuka oleh admin unit yang menanganinya,
// dosen tujuannya, atau Admin/Super Admin.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return new Response("Silakan login untuk mengunduh berkas", { status: 401 });
    }
    const { id } = await params;
    const attachmentId = Number(id);
    if (!Number.isInteger(attachmentId) || attachmentId < 1) {
      return new Response("File tidak ditemukan", { status: 404 });
    }

    const rows = await db
      .select({
        fileName: requestAttachments.fileName,
        fileStoragePath: requestAttachments.fileStoragePath,
        serviceType: serviceRequests.serviceType,
        lecturerId: serviceRequests.lecturerId,
      })
      .from(requestAttachments)
      .innerJoin(serviceRequests, eq(requestAttachments.requestId, serviceRequests.id))
      .where(eq(requestAttachments.id, attachmentId))
      .limit(1);
    const attachment = rows[0];

    if (!attachment?.fileStoragePath) {
      return new Response("File tidak ditemukan", { status: 404 });
    }
    if (!canAccessServiceRequest(profile, attachment)) {
      return new Response("Anda tidak memiliki akses ke berkas ini", { status: 403 });
    }

    const signedUrl = await createDocumentDownloadUrl(attachment.fileStoragePath, attachment.fileName);
    return Response.redirect(signedUrl, 302);
  } catch {
    return new Response("File tidak dapat diakses", { status: 500 });
  }
}
