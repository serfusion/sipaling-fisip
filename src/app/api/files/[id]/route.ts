import { db } from "@/db";
import { serviceRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createDocumentDownloadUrl } from "@/lib/document-storage";
import { canAccessServiceRequest, getCurrentProfile } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const requestId = Number(id);
    if (!Number.isInteger(requestId) || requestId < 1) {
      return new Response("File tidak ditemukan", { status: 404 });
    }

    const rows = await db
      .select({
        fileData: serviceRequests.fileData,
        fileStoragePath: serviceRequests.fileStoragePath,
        fileName: serviceRequests.fileName,
        fileMime: serviceRequests.fileMime,
        serviceType: serviceRequests.serviceType,
        lecturerId: serviceRequests.lecturerId,
      })
      .from(serviceRequests)
      .where(eq(serviceRequests.id, requestId))
      .limit(1);
    const file = rows[0];

    if (!file?.fileName || (!file.fileStoragePath && !file.fileData)) {
      return new Response("File tidak ditemukan", { status: 404 });
    }
    if (!canAccessServiceRequest(profile, file)) {
      return new Response("Anda tidak memiliki akses ke berkas ini", { status: 403 });
    }

    if (file.fileStoragePath) {
      const signedUrl = await createDocumentDownloadUrl(file.fileStoragePath, file.fileName);
      return Response.redirect(signedUrl, 302);
    }

    const safeName = file.fileName.replace(/[\r\n"\\]/g, "_");
    const responseBody = new Uint8Array(file.fileData as Buffer);
    return new Response(responseBody as unknown as BodyInit, {
      headers: {
        "Content-Type": file.fileMime || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("File tidak dapat diakses", { status: 500 });
  }
}
