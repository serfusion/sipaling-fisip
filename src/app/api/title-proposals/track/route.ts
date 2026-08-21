import { db } from "@/db";
import { lecturers, titleProposalChoices, titleProposals } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { isProposalCode } from "@/lib/academic";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Endpoint publik: mahasiswa memantau pengajuan judulnya lewat kode pelacakan.
// Sengaja TIDAK mengembalikan alamat, kontak, tautan bukti keuangan, maupun
// catatan internal prodi — kode pelacakan bisa saja terlihat orang lain.
export async function GET(request: Request) {
  // Membatasi percobaan menebak kode pelacakan secara beruntun.
  const limit = rateLimit({ request, name: "proposal-track", limit: 30, windowMs: 5 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);
  try {
    const code = new URL(request.url).searchParams.get("code")?.trim() || "";
    if (!code || code.length > 80 || !isProposalCode(code)) {
      return Response.json(
        { success: false, message: "Kode pelacakan pengajuan judul tidak valid. Contoh: SIPALING-PRODI-JUDUL-XXXXX-XXXXX." },
        { status: 400 },
      );
    }

    const rows = await db
      .select({
        id: titleProposals.id,
        code: titleProposals.code,
        nim: titleProposals.nim,
        studentName: titleProposals.studentName,
        studyProgram: titleProposals.studyProgram,
        concentration: titleProposals.concentration,
        gpa: titleProposals.gpa,
        finalTaskType: titleProposals.finalTaskType,
        title: titleProposals.title,
        financeVerified: titleProposals.financeVerified,
        eligibilityVerified: titleProposals.eligibilityVerified,
        status: titleProposals.status,
        approvedLecturerId: titleProposals.approvedLecturerId,
        prodiNote: titleProposals.prodiNote,
        lecturerNote: titleProposals.lecturerNote,
        createdAt: titleProposals.createdAt,
        updatedAt: titleProposals.updatedAt,
      })
      .from(titleProposals)
      .where(eq(titleProposals.code, code.toUpperCase()))
      .limit(1);

    const proposal = rows[0];
    if (!proposal) {
      return Response.json({ success: false, message: "Kode pelacakan tidak ditemukan. Periksa kembali penulisannya." }, { status: 404 });
    }

    const choices = await db
      .select({
        lecturerName: lecturers.name,
        studyProgram: lecturers.studyProgram,
        choiceOrder: titleProposalChoices.choiceOrder,
        selected: titleProposalChoices.selected,
        decision: titleProposalChoices.decision,
      })
      .from(titleProposalChoices)
      .innerJoin(lecturers, eq(titleProposalChoices.lecturerId, lecturers.id))
      .where(eq(titleProposalChoices.proposalId, proposal.id))
      .orderBy(asc(titleProposalChoices.choiceOrder));

    const approved = choices.find((choice) => choice.selected && choice.decision === "Diterima");

    return Response.json({
      success: true,
      proposal: {
        code: proposal.code,
        nim: proposal.nim,
        studentName: proposal.studentName,
        studyProgram: proposal.studyProgram,
        concentration: proposal.concentration,
        gpa: proposal.gpa,
        finalTaskType: proposal.finalTaskType,
        title: proposal.title,
        financeVerified: proposal.financeVerified,
        eligibilityVerified: proposal.eligibilityVerified,
        status: proposal.status,
        approvedLecturerName: approved?.lecturerName || null,
        prodiNote: proposal.prodiNote,
        lecturerNote: proposal.lecturerNote,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt,
        choices,
      },
    });
  } catch (error: unknown) {
    console.error("track title proposal", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Data pengajuan judul belum dapat dimuat.") },
      { status: 500 },
    );
  }
}
