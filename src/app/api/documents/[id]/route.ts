import { db } from "@/db";
import { documentContributors, documentRecords } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// Data di database dokumen bersifat permanen bagi seluruh admin.
// Hanya Super Admin yang boleh menghapusnya.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "super_admin") {
      return Response.json(
        { success: false, message: "Data database hanya dapat dihapus oleh Super Admin." },
        { status: 403 },
      );
    }
    const { id } = await params;
    const documentId = Number(id);
    if (!Number.isInteger(documentId) || documentId < 1) {
      return Response.json({ success: false, message: "Dokumen tidak ditemukan." }, { status: 404 });
    }
    await db.delete(documentContributors).where(eq(documentContributors.documentId, documentId));
    const removed = await db
      .delete(documentRecords)
      .where(eq(documentRecords.id, documentId))
      .returning({ id: documentRecords.id });
    if (!removed.length) {
      return Response.json({ success: false, message: "Dokumen tidak ditemukan." }, { status: 404 });
    }
    return Response.json({ success: true, id: documentId });
  } catch (error: unknown) {
    console.error("delete document", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Dokumen belum dapat dihapus.") },
      { status: 500 },
    );
  }
}
