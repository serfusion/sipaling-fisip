import { db } from "@/db";
import { requestAttachments, serviceRequests } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { canAccessServiceRequest, getCurrentProfile } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// Daftar lampiran bernama milik satu tiket (empat bagian bukti penyerahan).
//
// Dipisahkan dari daftar antrean supaya halaman dashboard tidak ikut
// mengangkut data lampiran untuk ratusan tiket sekaligus: laci detail
// memanggilnya hanya ketika satu tiket dibuka.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticket: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return Response.json({ success: false, message: "Silakan login untuk melihat lampiran." }, { status: 401 });
    }
    const { ticket } = await params;
    const found = await db
      .select({
        id: serviceRequests.id,
        serviceType: serviceRequests.serviceType,
        lecturerId: serviceRequests.lecturerId,
      })
      .from(serviceRequests)
      .where(eq(serviceRequests.ticket, ticket))
      .limit(1);
    const target = found[0];
    if (!target) {
      return Response.json({ success: false, message: "Tiket tidak ditemukan." }, { status: 404 });
    }
    if (!canAccessServiceRequest(profile, target)) {
      return Response.json({ success: false, message: "Anda tidak memiliki akses ke tiket ini." }, { status: 403 });
    }

    const rows = await db
      .select({
        id: requestAttachments.id,
        part: requestAttachments.part,
        label: requestAttachments.label,
        fileName: requestAttachments.fileName,
        fileMime: requestAttachments.fileMime,
        fileSize: requestAttachments.fileSize,
        createdAt: requestAttachments.createdAt,
      })
      .from(requestAttachments)
      .where(eq(requestAttachments.requestId, target.id))
      .orderBy(asc(requestAttachments.sortOrder), asc(requestAttachments.id));

    return Response.json({ success: true, attachments: rows });
  } catch (error: unknown) {
    console.error("list request attachments", error);
    return Response.json({ success: false, message: "Daftar lampiran belum dapat dimuat." }, { status: 500 });
  }
}
