import { db } from "@/db";
import { libraryAttendance, requestAttachments, revisionUploads, serviceRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccessServiceRequest, getCurrentProfile } from "@/lib/supabase-server";
import { removeDocument } from "@/lib/document-storage";
import { explainServerError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const validStatuses = ["Masuk", "Dicek", "Revisi", "Diproses", "Selesai", "Ditolak"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ticket: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return Response.json({ success: false, message: "Silakan login untuk memperbarui layanan." }, { status: 401 });
    }
    const { ticket } = await params;
    const body = (await request.json()) as {
      status?: string;
      administrativeStatus?: string;
      lecturerNote?: string;
      adminNote?: string;
    };
    const status = body.status?.trim();
    const administrativeStatus = body.administrativeStatus?.trim();

    if (status && !validStatuses.includes(status)) {
      return Response.json({ success: false, message: "Status layanan tidak valid." }, { status: 400 });
    }
    if (!status && !administrativeStatus && body.lecturerNote === undefined && body.adminNote === undefined) {
      return Response.json({ success: false, message: "Tidak ada perubahan yang dikirim." }, { status: 400 });
    }

    const targetRows = await db
      .select({
        serviceType: serviceRequests.serviceType,
        lecturerId: serviceRequests.lecturerId,
      })
      .from(serviceRequests)
      .where(eq(serviceRequests.ticket, ticket))
      .limit(1);
    const target = targetRows[0];
    if (!target) {
      return Response.json({ success: false, message: "Tiket tidak ditemukan." }, { status: 404 });
    }
    if (!canAccessServiceRequest(profile, target)) {
      return Response.json({ success: false, message: "Anda tidak memiliki akses ke tiket ini." }, { status: 403 });
    }

    const updated = await db
      .update(serviceRequests)
      .set({
        ...(status ? { status } : {}),
        ...(administrativeStatus ? { administrativeStatus } : {}),
        ...(body.lecturerNote !== undefined ? { lecturerNote: body.lecturerNote?.trim() || null } : {}),
        ...(body.adminNote !== undefined ? { adminNote: body.adminNote?.trim() || null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(serviceRequests.ticket, ticket))
      .returning({ ticket: serviceRequests.ticket });

    if (!updated.length) {
      return Response.json({ success: false, message: "Tiket tidak ditemukan." }, { status: 404 });
    }
    return Response.json({ success: true, ticket: updated[0].ticket });
  } catch (error: unknown) {
    console.error("update service request", error);
    return Response.json({ success: false, message: "Perubahan belum tersimpan." }, { status: 500 });
  }
}

// Hapus pengajuan — KHUSUS Super Admin (mis. membersihkan data uji coba).
// Lampiran di Supabase Storage dan riwayat revisinya ikut dihapus agar
// tidak meninggalkan berkas yatim yang memakan kuota penyimpanan.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ ticket: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "super_admin") {
      return Response.json(
        { success: false, message: "Hanya Super Admin yang dapat menghapus pengajuan." },
        { status: 403 },
      );
    }
    const { ticket } = await params;
    const found = await db.select().from(serviceRequests).where(eq(serviceRequests.ticket, ticket)).limit(1);
    if (!found.length) {
      return Response.json({ success: false, message: "Tiket tidak ditemukan." }, { status: 404 });
    }

    const requestId = found[0].id;
    const revisions = await db
      .select({ path: revisionUploads.fileStoragePath })
      .from(revisionUploads)
      .where(eq(revisionUploads.requestId, requestId));
    // Lampiran bernama (bukti penyerahan 4 bagian) ikut dibersihkan; barisnya
    // terhapus otomatis lewat ON DELETE CASCADE, tetapi berkas fisiknya di
    // Storage tidak — jadi jalurnya dikumpulkan lebih dulu di sini.
    const attachments = await db
      .select({ path: requestAttachments.fileStoragePath })
      .from(requestAttachments)
      .where(eq(requestAttachments.requestId, requestId));

    // Berkas skripsi full tercatat dua kali (lampiran utama tiket sekaligus
    // salah satu dari empat bagian), jadi jalurnya disatukan lebih dulu.
    const paths = [
      ...new Set(
        [
          found[0].fileStoragePath,
          ...revisions.map((r) => r.path),
          ...attachments.map((a) => a.path),
        ].filter((path): path is string => Boolean(path)),
      ),
    ];
    if (paths.length) {
      try {
        await Promise.all(paths.map((path) => removeDocument(path)));
      } catch (reason) {
        console.error("hapus berkas storage", reason);
      }
    }

    await db.delete(requestAttachments).where(eq(requestAttachments.requestId, requestId));
    await db.delete(libraryAttendance).where(eq(libraryAttendance.requestId, requestId));
    await db.delete(revisionUploads).where(eq(revisionUploads.requestId, requestId));
    await db.delete(serviceRequests).where(eq(serviceRequests.id, requestId));

    return Response.json({ success: true, ticket, filesRemoved: paths.length });
  } catch (error: unknown) {
    console.error("delete service request", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Pengajuan belum dapat dihapus.") },
      { status: 500 },
    );
  }
}
