import { db } from "@/db";
import { lecturers, libraryAttendance, requestAttachments, serviceRequests } from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { isAbsensiPerpus } from "@/lib/bukti-penyerahan";
import { kolomDriveSiap } from "@/lib/kolom-drive";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Membatasi percobaan menebak nomor tiket orang lain secara beruntun.
  const limit = rateLimit({ request, name: "status-lookup", limit: 30, windowMs: 5 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);
  try {
    const body = (await request.json()) as { ticket?: string; nim?: string };
    const ticket = body.ticket?.trim();
    const nim = body.nim?.trim(); // opsional, dipertahankan untuk kompatibilitas

    if (!ticket) {
      return Response.json({ success: false, message: "Nomor tiket wajib diisi." }, { status: 400 });
    }

    const withDrive = await kolomDriveSiap();
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
        ...(withDrive ? { driveUrl: serviceRequests.driveUrl } : {}),
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

    // Nama berkas per bagian hanya ada pada tiket lama, dari masa penyerahan
    // skripsi masih diunggah ke portal. Hanya nama dan ukurannya yang tampil;
    // berkasnya sendiri tetap tidak dapat diunduh tanpa login.
    //
    // SENGAJA GAGAL-LUNAK: bila tabelnya belum dibuat, pelacakan status tetap
    // berjalan tanpa daftar bagian.
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

    // Absensi bukan pengajuan yang diperiksa siapa pun, jadi yang dikirim
    // hanya catatan kunjungannya: kapan datang dan kunjungan yang keberapa.
    // Halaman Cek Status memakai keberadaan bidang ini untuk memilih tampilan,
    // bukan mencocokkan nama layanan sendiri.
    let absensi: { visitNumber: number; visitDate: string } | null = null;
    if (isAbsensiPerpus(row.serviceType, row.serviceNeed)) {
      try {
        const kunjungan = await db
          .select({ visitNumber: libraryAttendance.visitNumber, visitDate: libraryAttendance.visitDate })
          .from(libraryAttendance)
          .where(eq(libraryAttendance.requestId, row.id))
          .orderBy(desc(libraryAttendance.visitDate))
          .limit(1);
        const satu = kunjungan[0];
        if (satu) {
          absensi = {
            visitNumber: satu.visitNumber,
            visitDate: (satu.visitDate instanceof Date ? satu.visitDate : new Date(satu.visitDate)).toISOString(),
          };
        } else {
          // Tiket absensi lama yang catatan kunjungannya belum sempat dibuat:
          // waktu pengajuannya tetap waktu kedatangannya.
          absensi = {
            visitNumber: 0,
            visitDate: (row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)).toISOString(),
          };
        }
      } catch (error) {
        console.error("baca kunjungan absensi", error);
      }
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
        driveUrl: "driveUrl" in row ? row.driveUrl : null,
        attachments,
        absensi,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (error: unknown) {
    console.error("check service status", error);
    return Response.json({ success: false, message: "Status belum dapat diperiksa." }, { status: 500 });
  }
}
