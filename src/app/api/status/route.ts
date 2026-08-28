import { db } from "@/db";
import { lecturers, requestAttachments, serviceRequests } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Membatasi percobaan menebak nomor tiket orang lain secara beruntun.
  const limit = rateLimit({ request, name: "status-lookup", limit: 30, windowMs: 5 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);
  try {
    const body = (await request.json()) as { ticket?: string; nim?: string };
    const ticket = body.ticket?.trim();
    const nim = body.nim?.trim(); // opsional — dipertahankan untuk kompatibilitas

    if (!ticket) {
      return Response.json({ success: false, message: "Nomor tiket wajib diisi." }, { status: 400 });
    }

    const rows = await db
      .select({
        id: serviceRequests.id,
        ticket: serviceRequests.ticket,
        nim: serviceRequests.nim,
        studentName: serviceRequests.studentName,
        studyProgram: serviceRequests.studyProgram,
        contact: serviceRequests.contact,
        serviceType: serviceRequests.serviceType,
        serviceNeed: serviceRequests.serviceNeed,
        title: serviceRequests.title,
        lecturerId: lecturers.id,
        lecturerName: lecturers.name,
        lecturerStudyProgram: lecturers.studyProgram,
        status: serviceRequests.status,
        administrativeStatus: serviceRequests.administrativeStatus,
        revisionCount: serviceRequests.revisionCount,
        studentNote: serviceRequests.studentNote,
        lecturerNote: serviceRequests.lecturerNote,
        adminNote: serviceRequests.adminNote,
        fileName: serviceRequests.fileName,
        createdAt: serviceRequests.createdAt,
        updatedAt: serviceRequests.updatedAt,
      })
      .from(serviceRequests)
      .leftJoin(lecturers, eq(serviceRequests.lecturerId, lecturers.id))
      .where(nim ? and(eq(serviceRequests.ticket, ticket), eq(serviceRequests.nim, nim)) : eq(serviceRequests.ticket, ticket))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return Response.json({ success: false, message: "Data tidak ditemukan. Pastikan nomor tiket sudah benar." }, { status: 404 });
    }

    // Nama berkas per bagian ditampilkan agar mahasiswa yakin keempat unggahan
    // bukti penyerahan benar-benar diterima. Hanya nama dan ukurannya —
    // berkasnya sendiri tetap tidak dapat diunduh tanpa login.
    //
    // SENGAJA GAGAL-LUNAK: bila tabelnya belum dibuat (migrasi v7 belum
    // dijalankan), pelacakan status tetap berjalan tanpa daftar bagian.
    let attachments: Array<{ part: string; label: string; fileName: string; fileSize: number }> = [];
    try {
      attachments = await db
        .select({
          part: requestAttachments.part,
          label: requestAttachments.label,
          fileName: requestAttachments.fileName,
          fileSize: requestAttachments.fileSize,
        })
        .from(requestAttachments)
        .where(eq(requestAttachments.requestId, row.id))
        .orderBy(asc(requestAttachments.sortOrder), asc(requestAttachments.id));
    } catch (error) {
      console.error("baca lampiran bernama", error);
    }

    return Response.json({
      success: true,
      data: {
        ticket: row.ticket,
        nim: row.nim,
        studentName: row.studentName,
        studyProgram: row.studyProgram,
        contact: row.contact,
        serviceType: row.serviceType,
        serviceNeed: row.serviceNeed,
        title: row.title,
        lecturer: row.lecturerId ? { id: row.lecturerId, name: row.lecturerName, studyProgram: row.lecturerStudyProgram } : null,
        status: row.status,
        administrativeStatus: row.administrativeStatus,
        revisionCount: row.revisionCount,
        studentNote: row.studentNote,
        lecturerNote: row.lecturerNote,
        adminNote: row.adminNote,
        fileName: row.fileName,
        attachments,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (error: unknown) {
    console.error("check service status", error);
    return Response.json({ success: false, message: "Status belum dapat diperiksa." }, { status: 500 });
  }
}
