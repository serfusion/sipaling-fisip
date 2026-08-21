import { db } from "@/db";
import { revisionUploads, serviceRequests } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  MAX_DOCUMENT_BYTES,
  removeDocument,
  uploadDocument,
} from "@/lib/document-storage";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { blockedByMaintenance } from "@/lib/maintenance-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function textValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const limit = rateLimit({ request, name: "revision-upload", limit: 8, windowMs: 10 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  // Selama mode maintenance menyala, kiriman dari pengunjung umum ditolak
  // supaya halaman lama yang masih terbuka di tab mahasiswa tidak dapat
  // menyelinap mengirim data. Dosen/admin yang login tetap dilayani.
  const closed = await blockedByMaintenance();
  if (closed) return closed;
  try {
    const form = await request.formData();
    const ticket = textValue(form, "ticket");
    const nim = textValue(form, "nim");
    const note = textValue(form, "note");
    const fileEntry = form.get("file");
    const file = fileEntry instanceof File && fileEntry.name ? fileEntry : null;

    if (!ticket || !nim || !file) {
      return Response.json({ success: false, message: "Nomor tiket, NIM, dan file revisi wajib diisi." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".docx") || file.size > MAX_DOCUMENT_BYTES) {
      return Response.json({ success: false, message: "File revisi harus .DOCX dan berukuran maksimal 10 MB." }, { status: 400 });
    }

    const rows = await db
      .select({
        id: serviceRequests.id,
        status: serviceRequests.status,
        revisionCount: serviceRequests.revisionCount,
        fileName: serviceRequests.fileName,
        fileMime: serviceRequests.fileMime,
        fileSize: serviceRequests.fileSize,
        fileStoragePath: serviceRequests.fileStoragePath,
        fileData: serviceRequests.fileData,
      })
      .from(serviceRequests)
      .where(and(eq(serviceRequests.ticket, ticket), eq(serviceRequests.nim, nim)))
      .limit(1);
    const service = rows[0];

    if (!service) {
      return Response.json({ success: false, message: "Tiket dan NIM tidak ditemukan." }, { status: 404 });
    }
    if (service.status !== "Revisi") {
      return Response.json({ success: false, message: `Upload revisi hanya tersedia saat status Revisi. Status saat ini: ${service.status}.` }, { status: 409 });
    }

    const revisionNumber = (service.revisionCount || 0) + 1;
    const fileMime = file.type || DOCX_MIME;
    const fileStoragePath = await uploadDocument({
      folder: "revisions",
      ticket,
      file,
      contentType: fileMime,
    });

    try {
      await db.transaction(async (tx) => {
        // Simpan berkas pengajuan awal sebagai revisi ke-0 sebelum pointer
        // berkas utama diarahkan ke revisi terbaru.
        if (
          revisionNumber === 1 &&
          service.fileName &&
          service.fileMime &&
          service.fileSize &&
          (service.fileStoragePath || service.fileData)
        ) {
          await tx.insert(revisionUploads).values({
            requestId: service.id,
            nim,
            revisionNumber: 0,
            note: "Berkas pengajuan awal",
            fileName: service.fileName,
            fileMime: service.fileMime,
            fileSize: service.fileSize,
            fileStoragePath: service.fileStoragePath,
            fileData: service.fileData,
          });
        }

        await tx.insert(revisionUploads).values({
          requestId: service.id,
          nim,
          revisionNumber,
          note: note || null,
          fileName: file.name,
          fileMime,
          fileSize: file.size,
          fileStoragePath,
          fileData: null,
        });
        await tx
          .update(serviceRequests)
          .set({
            revisionCount: revisionNumber,
            fileName: file.name,
            fileMime,
            fileSize: file.size,
            fileStoragePath,
            fileData: null,
            studentNote: note || null,
            status: "Masuk",
            administrativeStatus: "Belum Dicek",
            updatedAt: new Date(),
          })
          .where(eq(serviceRequests.id, service.id));
      });
    } catch (error) {
      await removeDocument(fileStoragePath);
      throw error;
    }

    return Response.json({ success: true, message: "Revisi berhasil dikirim.", ticket });
  } catch (error: unknown) {
    console.error("upload revision", error);
    return Response.json({ success: false, message: explainServerError(error, "Revisi belum tersimpan. Silakan coba lagi.") }, { status: 500 });
  }
}
