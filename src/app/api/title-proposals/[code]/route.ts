import { db } from "@/db";
import { lecturers, titleProposalChoices, titleProposals } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { PROPOSAL_STATUS } from "@/lib/academic";
import { getCurrentProfile } from "@/lib/supabase-server";
import { canReviewProposals } from "@/lib/proposal-access";
import { PRODI_AUDIENCE, pushNotification } from "@/lib/notify";
import { removeDocument } from "@/lib/document-storage";
import { explainServerError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

type Action = "verify" | "approve" | "reject" | "accept" | "decline";

const PRODI_ACTIONS: Action[] = ["verify", "approve", "reject"];
const LECTURER_ACTIONS: Action[] = ["accept", "decline"];

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return Response.json({ success: false, message: "Silakan login terlebih dahulu." }, { status: 401 });
    }
    const { code } = await params;
    const body = (await request.json()) as {
      action?: string;
      financeVerified?: boolean;
      eligibilityVerified?: boolean;
      prodiNote?: string;
      lecturerNote?: string;
      lecturerId?: number;
    };
    const action = body.action as Action;
    if (!action || ![...PRODI_ACTIONS, ...LECTURER_ACTIONS].includes(action)) {
      return Response.json({ success: false, message: "Aksi tidak dikenali." }, { status: 400 });
    }

    const found = await db
      .select()
      .from(titleProposals)
      .where(eq(titleProposals.code, code))
      .limit(1);
    const proposal = found[0];
    if (!proposal) {
      return Response.json({ success: false, message: "Pengajuan judul tidak ditemukan." }, { status: 404 });
    }

    const isProdiAction = PRODI_ACTIONS.includes(action);
    if (isProdiAction && !canReviewProposals(profile)) {
      return Response.json({ success: false, message: "Hanya Admin Prodi yang dapat memverifikasi pengajuan judul." }, { status: 403 });
    }
    if (!isProdiAction && (profile.role !== "dosen" || profile.lecturerId === null)) {
      return Response.json({ success: false, message: "Hanya dosen tujuan yang dapat menerima atau menolak bimbingan." }, { status: 403 });
    }

    const now = new Date();

    // ---------------- Aksi Program Studi ----------------
    if (action === "verify") {
      await db
        .update(titleProposals)
        .set({
          financeVerified: Boolean(body.financeVerified),
          eligibilityVerified: Boolean(body.eligibilityVerified),
          prodiNote: clean(body.prodiNote, 2000) || null,
          reviewedBy: profile.fullName,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(titleProposals.id, proposal.id));
      return Response.json({ success: true, status: proposal.status });
    }

    if (action === "reject") {
      const note = clean(body.prodiNote, 2000);
      if (!note) {
        return Response.json({ success: false, message: "Alasan penolakan wajib diisi agar mahasiswa tahu perbaikannya." }, { status: 400 });
      }
      await db
        .update(titleProposals)
        .set({
          status: PROPOSAL_STATUS.rejectedProdi,
          prodiNote: note,
          approvedLecturerId: null,
          reviewedBy: profile.fullName,
          reviewedAt: now,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(titleProposals.id, proposal.id));
      await db
        .update(titleProposalChoices)
        .set({ selected: false })
        .where(eq(titleProposalChoices.proposalId, proposal.id));
      return Response.json({ success: true, status: PROPOSAL_STATUS.rejectedProdi });
    }

    if (action === "approve") {
      const lecturerId = Number(body.lecturerId);
      if (!Number.isInteger(lecturerId) || lecturerId < 1) {
        return Response.json({ success: false, message: "Pilih satu dosen pembimbing terlebih dahulu." }, { status: 400 });
      }
      // Kedua ceklis wajib terpenuhi sebelum pengajuan diteruskan ke dosen.
      const finance = body.financeVerified ?? proposal.financeVerified;
      const eligibility = body.eligibilityVerified ?? proposal.eligibilityVerified;
      if (!finance || !eligibility) {
        return Response.json(
          { success: false, message: "Ceklis \"Bukti Keuangan\" dan \"Layak Diajukan\" harus terpenuhi sebelum meneruskan ke dosen." },
          { status: 400 },
        );
      }

      const lecturerRows = await db
        .select({ id: lecturers.id, name: lecturers.name })
        .from(lecturers)
        .where(and(eq(lecturers.id, lecturerId), eq(lecturers.active, true)))
        .limit(1);
      const lecturer = lecturerRows[0];
      if (!lecturer) {
        return Response.json({ success: false, message: "Dosen tidak ditemukan atau sudah tidak aktif." }, { status: 400 });
      }

      const isSuperAdmin = profile.role === "super_admin";

      // Mengubah pembimbing yang sudah final berarti keluar dari alur, jadi
      // hanya Super Admin yang boleh melakukannya.
      if (proposal.status === PROPOSAL_STATUS.acceptedLecturer && !isSuperAdmin) {
        return Response.json(
          {
            success: false,
            message: "Pengajuan ini sudah final dan diterima dosen. Penggantian pembimbing hanya dapat dilakukan Super Admin.",
          },
          { status: 403 },
        );
      }

      const existing = await db
        .select({ id: titleProposalChoices.id, choiceOrder: titleProposalChoices.choiceOrder })
        .from(titleProposalChoices)
        .where(eq(titleProposalChoices.proposalId, proposal.id));
      const match = await db
        .select({ id: titleProposalChoices.id })
        .from(titleProposalChoices)
        .where(and(eq(titleProposalChoices.proposalId, proposal.id), eq(titleProposalChoices.lecturerId, lecturerId)))
        .limit(1);

      // Program Studi hanya boleh menyeleksi dari usulan mahasiswa. Menunjuk
      // dosen di luar usulan adalah aksi di luar alur sehingga dibatasi pada
      // Super Admin — pembatasan ini ditegakkan di server, bukan sekadar
      // disembunyikan dari layar.
      if (!match[0] && !isSuperAdmin) {
        return Response.json(
          {
            success: false,
            message: "Program Studi hanya dapat memilih dari tiga dosen usulan mahasiswa. Penunjukan dosen di luar usulan hanya dapat dilakukan Super Admin.",
          },
          { status: 403 },
        );
      }

      await db
        .update(titleProposalChoices)
        .set({ selected: false })
        .where(eq(titleProposalChoices.proposalId, proposal.id));

      if (match[0]) {
        await db
          .update(titleProposalChoices)
          .set({ selected: true, decision: "Menunggu", decisionNote: null, decidedAt: null })
          .where(eq(titleProposalChoices.id, match[0].id));
      } else {
        const nextOrder = existing.reduce((max, row) => Math.max(max, row.choiceOrder), 0) + 1;
        await db.insert(titleProposalChoices).values({
          proposalId: proposal.id,
          lecturerId,
          choiceOrder: nextOrder,
          selected: true,
        });
      }

      await db
        .update(titleProposals)
        .set({
          financeVerified: Boolean(finance),
          eligibilityVerified: Boolean(eligibility),
          prodiNote: clean(body.prodiNote, 2000) || proposal.prodiNote,
          status: PROPOSAL_STATUS.waitingLecturer,
          approvedLecturerId: null,
          reviewedBy: profile.fullName,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(titleProposals.id, proposal.id));

      await pushNotification({
        lecturerId,
        kind: "proposal_assigned",
        severity: "info",
        title: "Pengajuan bimbingan baru",
        body: `${proposal.studentName} (${proposal.nim}) — "${proposal.title}". Pilih TERIMA atau TOLAK.`,
        refCode: proposal.code,
      });

      return Response.json({ success: true, status: PROPOSAL_STATUS.waitingLecturer, lecturerName: lecturer.name });
    }

    // ---------------- Aksi Dosen ----------------
    const myLecturerId = profile.lecturerId as number;
    const myChoice = await db
      .select({ id: titleProposalChoices.id })
      .from(titleProposalChoices)
      .where(
        and(
          eq(titleProposalChoices.proposalId, proposal.id),
          eq(titleProposalChoices.lecturerId, myLecturerId),
          eq(titleProposalChoices.selected, true),
        ),
      )
      .limit(1);
    if (!myChoice[0]) {
      return Response.json({ success: false, message: "Pengajuan ini tidak ditujukan kepada Anda." }, { status: 403 });
    }
    if (proposal.status !== PROPOSAL_STATUS.waitingLecturer) {
      return Response.json({ success: false, message: "Pengajuan ini sudah tidak menunggu keputusan Anda." }, { status: 409 });
    }

    const lecturerNote = clean(body.lecturerNote, 2000);

    if (action === "accept") {
      await db
        .update(titleProposalChoices)
        .set({ decision: "Diterima", decisionNote: lecturerNote || null, decidedAt: now })
        .where(eq(titleProposalChoices.id, myChoice[0].id));
      await db
        .update(titleProposals)
        .set({
          status: PROPOSAL_STATUS.acceptedLecturer,
          approvedLecturerId: myLecturerId,
          lecturerNote: lecturerNote || null,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(titleProposals.id, proposal.id));

      await pushNotification({
        audienceRole: PRODI_AUDIENCE,
        kind: "proposal_accepted",
        severity: "info",
        title: "Dosen menerima bimbingan",
        body: `${profile.fullName} menerima ${proposal.studentName} (${proposal.nim}).`,
        refCode: proposal.code,
      });
      return Response.json({ success: true, status: PROPOSAL_STATUS.acceptedLecturer });
    }

    // action === "decline"
    if (!lecturerNote) {
      return Response.json({ success: false, message: "Alasan penolakan wajib diisi agar Prodi dapat mencarikan pengganti." }, { status: 400 });
    }
    await db
      .update(titleProposalChoices)
      .set({ decision: "Ditolak", decisionNote: lecturerNote, decidedAt: now, selected: false })
      .where(eq(titleProposalChoices.id, myChoice[0].id));
    await db
      .update(titleProposals)
      .set({
        status: PROPOSAL_STATUS.rejectedLecturer,
        approvedLecturerId: null,
        lecturerNote,
        decidedAt: now,
        updatedAt: now,
      })
      .where(eq(titleProposals.id, proposal.id));

    await pushNotification({
      audienceRole: PRODI_AUDIENCE,
      kind: "proposal_declined",
      severity: "urgent",
      title: "(URGENT) Dosen menolak mahasiswa",
      body: `${profile.fullName} menolak ${proposal.studentName} (${proposal.nim}). Alasan: ${lecturerNote}`,
      refCode: proposal.code,
    });

    return Response.json({ success: true, status: PROPOSAL_STATUS.rejectedLecturer });
  } catch (error: unknown) {
    console.error("update title proposal", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Perubahan pengajuan judul belum tersimpan.") },
      { status: 500 },
    );
  }
}

// Hapus pengajuan judul — khusus Super Admin (mis. membersihkan data uji).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "super_admin") {
      return Response.json({ success: false, message: "Hanya Super Admin yang dapat menghapus pengajuan judul." }, { status: 403 });
    }
    const { code } = await params;
    const found = await db
      .select({ id: titleProposals.id, path: titleProposals.paymentStoragePath })
      .from(titleProposals)
      .where(eq(titleProposals.code, code))
      .limit(1);
    if (!found[0]) {
      return Response.json({ success: false, message: "Pengajuan judul tidak ditemukan." }, { status: 404 });
    }
    await removeDocument(found[0].path);
    await db.delete(titleProposalChoices).where(eq(titleProposalChoices.proposalId, found[0].id));
    await db.delete(titleProposals).where(eq(titleProposals.id, found[0].id));
    return Response.json({ success: true, code });
  } catch (error: unknown) {
    console.error("delete title proposal", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Pengajuan judul belum dapat dihapus.") },
      { status: 500 },
    );
  }
}
