import { db } from "@/db";
import { lecturers, titleProposals } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { compareLecturerName, PROPOSAL_STATUS } from "@/lib/academic";
import { explainServerError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Jumlah mahasiswa bimbingan = pengajuan judul yang sudah disetujui dosen
    // bersangkutan. Ditampilkan di portal sebagai "(8 Mhs Bimbingan)" supaya
    // mahasiswa tahu beban tiap dosen sebelum memilih.
    const rows = await db
      .select({
        id: lecturers.id,
        name: lecturers.name,
        studyProgram: lecturers.studyProgram,
        guidanceCount: sql<number>`(
          select count(*)::int from ${titleProposals}
          where ${titleProposals.approvedLecturerId} = ${lecturers.id}
            and ${titleProposals.status} = ${PROPOSAL_STATUS.acceptedLecturer}
        )`,
      })
      .from(lecturers)
      .where(eq(lecturers.active, true));

    // Urutan abjad memakai nama asli — gelar depan seperti "Dr." diabaikan.
    rows.sort((a, b) => compareLecturerName(a.name, b.name));

    return Response.json({ success: true, lecturers: rows });
  } catch (error: unknown) {
    console.error("list lecturers", error);
    // Fallback: instalasi yang belum menjalankan supabase-update-v4 belum
    // memiliki tabel title_proposals — daftar dosen tetap harus tampil.
    try {
      const basic = await db
        .select({ id: lecturers.id, name: lecturers.name, studyProgram: lecturers.studyProgram })
        .from(lecturers)
        .where(eq(lecturers.active, true));
      basic.sort((a, b) => compareLecturerName(a.name, b.name));
      return Response.json({
        success: true,
        lecturers: basic.map((row) => ({ ...row, guidanceCount: 0 })),
      });
    } catch {
      return Response.json(
        { success: false, message: explainServerError(error, "Daftar dosen belum dapat dimuat.") },
        { status: 500 },
      );
    }
  }
}
