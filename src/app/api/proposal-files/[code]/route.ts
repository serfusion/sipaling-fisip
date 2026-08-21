import { db } from "@/db";
import { titleProposalChoices, titleProposals } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createDocumentDownloadUrl } from "@/lib/document-storage";
import { getCurrentProfile } from "@/lib/supabase-server";
import { canReviewProposals } from "@/lib/proposal-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Unduhan bukti keuangan pengajuan judul.
// Akses: Admin Prodi/Admin/Super Admin, serta dosen yang sedang ditunjuk
// untuk pengajuan tersebut. Berkas dilayani lewat signed URL berumur pendek.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return new Response("Silakan login untuk mengunduh berkas", { status: 401 });
    }
    const { code } = await params;
    const rows = await db
      .select({
        id: titleProposals.id,
        path: titleProposals.paymentStoragePath,
        fileName: titleProposals.paymentFileName,
      })
      .from(titleProposals)
      .where(eq(titleProposals.code, code))
      .limit(1);
    const proposal = rows[0];
    if (!proposal?.path || !proposal.fileName) {
      return new Response("Berkas tidak ditemukan", { status: 404 });
    }

    let allowed = canReviewProposals(profile);
    if (!allowed && profile.role === "dosen" && profile.lecturerId !== null) {
      const assigned = await db
        .select({ id: titleProposalChoices.id })
        .from(titleProposalChoices)
        .where(
          and(
            eq(titleProposalChoices.proposalId, proposal.id),
            eq(titleProposalChoices.lecturerId, profile.lecturerId),
            eq(titleProposalChoices.selected, true),
          ),
        )
        .limit(1);
      allowed = assigned.length > 0;
    }
    if (!allowed) {
      return new Response("Anda tidak memiliki akses ke berkas ini", { status: 403 });
    }

    const signedUrl = await createDocumentDownloadUrl(proposal.path, proposal.fileName);
    return Response.redirect(signedUrl, 302);
  } catch (error) {
    console.error("download proposal file", error);
    return new Response("Berkas tidak dapat diakses", { status: 500 });
  }
}
