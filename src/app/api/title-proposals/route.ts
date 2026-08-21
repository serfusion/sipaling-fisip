import { db } from "@/db";
import { lecturers, titleProposalChoices, titleProposals } from "@/db/schema";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  concentrationsFor,
  FINAL_TASK_TYPES,
  hasConcentration,
  NO_CONCENTRATION,
  MAX_LECTURER_CHOICES,
  makeProposalCode,
  PROPOSAL_STATUS,
  STUDY_PROGRAMS,
} from "@/lib/academic";
import { MAX_DOCUMENT_BYTES, removeDocument, uploadDocument } from "@/lib/document-storage";
import { getCurrentProfile } from "@/lib/supabase-server";
import { canReviewProposals, type ProposalChoiceRow } from "@/lib/proposal-access";
import { PRODI_AUDIENCE, pushNotification } from "@/lib/notify";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { blockedByMaintenance } from "@/lib/maintenance-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROOF_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
};

function textValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function proofExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  return "";
}

export async function POST(request: Request) {
  let storagePath: string | null = null;
  // Endpoint publik yang menerima unggahan: dibatasi agar tidak dibanjiri.
  const limit = rateLimit({ request, name: "proposal-submit", limit: 5, windowMs: 10 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  // Selama mode maintenance menyala, kiriman dari pengunjung umum ditolak
  // supaya halaman lama yang masih terbuka di tab mahasiswa tidak dapat
  // menyelinap mengirim data. Dosen/admin yang login tetap dilayani.
  const closed = await blockedByMaintenance();
  if (closed) return closed;
  try {
    const form = await request.formData();

    // Honeypot anti-bot: field tersembunyi ini selalu kosong pada pengisian manusia.
    if (textValue(form, "website")) {
      return Response.json({ success: true, code: makeProposalCode() }, { status: 201 });
    }

    const nim = textValue(form, "nim");
    const studentName = textValue(form, "studentName");
    const address = textValue(form, "address");
    const studyProgram = textValue(form, "studyProgram");
    const concentrationInput = textValue(form, "concentration");
    const gpaRaw = textValue(form, "gpa").replace(",", ".");
    const finalTaskType = textValue(form, "finalTaskType");
    const title = textValue(form, "title");
    const statement = textValue(form, "statement");
    const contact = textValue(form, "contact");

    if (!/^\d{4,20}$/.test(nim)) {
      return Response.json({ success: false, message: "NIM harus berupa angka 4 sampai 20 digit." }, { status: 400 });
    }
    if (!/^[A-Za-zÀ-ɏ\s.,'-]{3,160}$/.test(studentName)) {
      return Response.json({ success: false, message: "Nama pemohon hanya boleh berisi huruf dan tanda baca umum." }, { status: 400 });
    }
    if (address.length < 8 || address.length > 500) {
      return Response.json({ success: false, message: "Alamat wajib diisi (8 sampai 500 karakter)." }, { status: 400 });
    }
    if (!(STUDY_PROGRAMS as readonly string[]).includes(studyProgram)) {
      return Response.json({ success: false, message: "Program studi tidak valid." }, { status: 400 });
    }
    // Konsentrasi divalidasi ketat terhadap daftar resmi tiap prodi; prodi
    // tanpa konsentrasi (Ilmu Pemerintahan) selalu memakai nilai baku,
    // apa pun yang dikirim klien.
    const concentration = hasConcentration(studyProgram) ? concentrationInput : NO_CONCENTRATION;
    if (hasConcentration(studyProgram) && !concentrationsFor(studyProgram).includes(concentration)) {
      return Response.json(
        { success: false, message: "Konsentrasi tidak sesuai daftar program studi yang dipilih." },
        { status: 400 },
      );
    }
    if (!(FINAL_TASK_TYPES as readonly string[]).includes(finalTaskType)) {
      return Response.json({ success: false, message: "Jenis tugas akhir harus Skripsi atau Jurnal." }, { status: 400 });
    }
    const gpa = Number(gpaRaw);
    if (!Number.isFinite(gpa) || gpa < 0 || gpa > 4) {
      return Response.json({ success: false, message: "IPK terakhir harus berupa angka antara 0,00 dan 4,00." }, { status: 400 });
    }
    if (title.length < 10 || title.length > 500) {
      return Response.json({ success: false, message: "Judul yang diajukan wajib diisi (10 sampai 500 karakter)." }, { status: 400 });
    }
    if (statement.length < 20 || statement.length > 2000) {
      return Response.json({ success: false, message: "Pernyataan wajib diisi (20 sampai 2000 karakter)." }, { status: 400 });
    }
    if (contact.length > 160) {
      return Response.json({ success: false, message: "Kontak terlalu panjang." }, { status: 400 });
    }

    // Tiga dosen usulan — wajib tiga, berbeda satu sama lain, dan aktif.
    const choiceIds: number[] = [];
    for (let index = 1; index <= MAX_LECTURER_CHOICES; index++) {
      const raw = Number(textValue(form, `lecturer${index}`));
      if (!Number.isInteger(raw) || raw < 1) {
        return Response.json({ success: false, message: `Pilihan dosen ke-${index} belum dipilih.` }, { status: 400 });
      }
      if (choiceIds.includes(raw)) {
        return Response.json({ success: false, message: "Ketiga dosen yang dipilih harus berbeda." }, { status: 400 });
      }
      choiceIds.push(raw);
    }
    const foundLecturers = await db
      .select({ id: lecturers.id, name: lecturers.name })
      .from(lecturers)
      .where(and(inArray(lecturers.id, choiceIds), eq(lecturers.active, true)));
    if (foundLecturers.length !== MAX_LECTURER_CHOICES) {
      return Response.json({ success: false, message: "Salah satu dosen yang dipilih tidak ditemukan atau tidak aktif." }, { status: 400 });
    }

    // Bukti keuangan wajib: PDF atau foto struk/bukti transfer.
    const fileEntry = form.get("paymentFile");
    const file = fileEntry instanceof File && fileEntry.name ? fileEntry : null;
    if (!file) {
      return Response.json({ success: false, message: "Bukti keuangan wajib dilampirkan." }, { status: 400 });
    }
    const extension = proofExtension(file.name);
    if (!extension) {
      return Response.json({ success: false, message: "Bukti keuangan harus berformat PDF, JPG, atau PNG." }, { status: 400 });
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      return Response.json({ success: false, message: "Ukuran bukti keuangan maksimal 10 MB." }, { status: 400 });
    }

    // Satu mahasiswa hanya boleh punya satu pengajuan judul yang masih
    // berjalan; ini sekaligus membatasi pengiriman berulang dari luar portal.
    const running = await db
      .select({ code: titleProposals.code })
      .from(titleProposals)
      .where(
        and(
          eq(titleProposals.nim, nim),
          inArray(titleProposals.status, [PROPOSAL_STATUS.waitingProdi, PROPOSAL_STATUS.waitingLecturer]),
        ),
      )
      .limit(1);
    if (running[0]) {
      return Response.json(
        {
          success: false,
          message: `NIM ini masih memiliki pengajuan judul yang sedang diproses (${running[0].code}). Pantau dulu prosesnya sebelum mengajukan judul baru.`,
        },
        { status: 409 },
      );
    }

    const code = makeProposalCode();
    const contentType = PROOF_MIME[extension];
    storagePath = await uploadDocument({ folder: "proposals", ticket: code, file, contentType });

    const inserted = await db
      .insert(titleProposals)
      .values({
        code,
        nim,
        studentName,
        address,
        studyProgram,
        concentration,
        gpa: gpa.toFixed(2),
        finalTaskType,
        title,
        statement,
        contact: contact || null,
        paymentFileName: file.name.slice(0, 255),
        paymentFileMime: contentType,
        paymentFileSize: file.size,
        paymentStoragePath: storagePath,
      })
      .returning({ id: titleProposals.id });

    const proposalId = inserted[0]?.id;
    if (!proposalId) throw new Error("Pengajuan gagal disimpan.");

    await db.insert(titleProposalChoices).values(
      choiceIds.map((lecturerId, index) => ({
        proposalId,
        lecturerId,
        choiceOrder: index + 1,
      })),
    );

    await pushNotification({
      audienceRole: PRODI_AUDIENCE,
      kind: "proposal_submitted",
      severity: "info",
      title: "Pengajuan judul baru",
      body: `${studentName} (${nim}) — ${finalTaskType}: "${title}". Perlu verifikasi.`,
      refCode: code,
    });

    return Response.json({ success: true, code }, { status: 201 });
  } catch (error: unknown) {
    console.error("submit title proposal", error);
    await removeDocument(storagePath);
    const message = explainServerError(error, "Pengajuan judul belum tersimpan. Silakan coba lagi.");
    return Response.json({ success: false, message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return Response.json({ success: false, message: "Silakan login untuk melihat pengajuan judul." }, { status: 401 });
    }
    const isLecturer = profile.role === "dosen";
    if (isLecturer && profile.lecturerId === null) {
      return Response.json({ success: true, proposals: [] });
    }
    if (!isLecturer && !canReviewProposals(profile)) {
      return Response.json({ success: false, message: "Role Anda tidak memiliki akses ke pengajuan judul." }, { status: 403 });
    }

    const statusFilter = new URL(request.url).searchParams.get("status")?.trim() || "";

    // Dosen hanya melihat pengajuan yang memang menyangkut dirinya: sedang
    // ditugaskan kepadanya (selected), atau pernah ia putuskan (diterima /
    // ditolak). Pengajuan yang sekadar mencantumkan namanya sebagai salah satu
    // usulan mahasiswa belum boleh terlihat sebelum diseleksi Prodi.
    const scope = isLecturer
      ? or(
          eq(titleProposals.approvedLecturerId, profile.lecturerId as number),
          sql`exists (
            select 1 from ${titleProposalChoices}
            where ${titleProposalChoices.proposalId} = ${titleProposals.id}
              and ${titleProposalChoices.lecturerId} = ${profile.lecturerId as number}
              and (${titleProposalChoices.selected} = true or ${titleProposalChoices.decision} <> 'Menunggu')
          )`,
        )
      : undefined;

    const rows = await db
      .select({
        id: titleProposals.id,
        code: titleProposals.code,
        nim: titleProposals.nim,
        studentName: titleProposals.studentName,
        address: titleProposals.address,
        studyProgram: titleProposals.studyProgram,
        concentration: titleProposals.concentration,
        gpa: titleProposals.gpa,
        finalTaskType: titleProposals.finalTaskType,
        title: titleProposals.title,
        statement: titleProposals.statement,
        contact: titleProposals.contact,
        paymentFileName: titleProposals.paymentFileName,
        financeVerified: titleProposals.financeVerified,
        eligibilityVerified: titleProposals.eligibilityVerified,
        status: titleProposals.status,
        approvedLecturerId: titleProposals.approvedLecturerId,
        prodiNote: titleProposals.prodiNote,
        lecturerNote: titleProposals.lecturerNote,
        reviewedBy: titleProposals.reviewedBy,
        reviewedAt: titleProposals.reviewedAt,
        decidedAt: titleProposals.decidedAt,
        createdAt: titleProposals.createdAt,
        updatedAt: titleProposals.updatedAt,
      })
      .from(titleProposals)
      .where(and(scope, statusFilter ? eq(titleProposals.status, statusFilter) : undefined))
      .orderBy(desc(titleProposals.createdAt))
      .limit(300);

    if (!rows.length) return Response.json({ success: true, proposals: [] });

    const proposalIds = rows.map((row) => row.id);
    const choiceRows = await db
      .select({
        proposalId: titleProposalChoices.proposalId,
        lecturerId: titleProposalChoices.lecturerId,
        choiceOrder: titleProposalChoices.choiceOrder,
        selected: titleProposalChoices.selected,
        decision: titleProposalChoices.decision,
        decisionNote: titleProposalChoices.decisionNote,
        lecturerName: lecturers.name,
        studyProgram: lecturers.studyProgram,
        guidanceCount: sql<number>`(
          select count(*)::int from ${titleProposals}
          where ${titleProposals.approvedLecturerId} = ${lecturers.id}
            and ${titleProposals.status} = ${PROPOSAL_STATUS.acceptedLecturer}
        )`,
      })
      .from(titleProposalChoices)
      .innerJoin(lecturers, eq(titleProposalChoices.lecturerId, lecturers.id))
      .where(inArray(titleProposalChoices.proposalId, proposalIds));

    const byProposal = new Map<number, ProposalChoiceRow[]>();
    for (const choice of choiceRows) {
      const list = byProposal.get(choice.proposalId) || [];
      list.push({
        lecturerId: choice.lecturerId,
        lecturerName: choice.lecturerName,
        studyProgram: choice.studyProgram,
        choiceOrder: choice.choiceOrder,
        selected: choice.selected,
        decision: choice.decision,
        decisionNote: choice.decisionNote,
        guidanceCount: choice.guidanceCount,
      });
      byProposal.set(choice.proposalId, list);
    }
    for (const list of byProposal.values()) list.sort((a, b) => a.choiceOrder - b.choiceOrder);

    const proposals = rows.map((row) => ({
      ...row,
      choices: byProposal.get(row.id) || [],
      // Alamat & pernyataan lengkap hanya relevan bagi prodi; dosen cukup
      // melihat ringkasannya agar data pribadi tidak tersebar tanpa perlu.
      address: isLecturer ? null : row.address,
    }));

    return Response.json({ success: true, proposals });
  } catch (error: unknown) {
    console.error("list title proposals", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Pengajuan judul belum dapat dimuat.") },
      { status: 500 },
    );
  }
}
