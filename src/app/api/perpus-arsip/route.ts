import { db } from "@/db";
import { requestAttachments, serviceRequests } from "@/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { removeDocument } from "@/lib/document-storage";
import { PENYERAHAN_NEED, PENYERAHAN_NEED_LAMA } from "@/lib/bukti-penyerahan";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ARSIP PENYERAHAN SKRIPSI PERPUSTAKAAN
//
// Dua kerja: mendaftar berkas yang masih menumpuk di penyimpanan, dan
// menghapusnya setelah admin selesai mengarsipkan.
//
// Arsipnya sendiri TIDAK dibungkus di sini. Fungsi serverless punya batas
// memori dan waktu jalan; membungkus ratusan MB di sini akan gagal di tengah
// jalan. Dashboard mengunduh tiap berkas lewat /api/attachments/[id], lalu
// membungkusnya menjadi zip di peramban admin. Hasilnya mendarat langsung di
// komputernya, yang memang tujuannya.

/** Hanya pengelola perpustakaan dan Admin/Super Admin yang boleh mengarsip. */
function bolehArsip(role: string) {
  return role === "super_admin" || role === "admin" || role === "admin_perpustakaan";
}

const penyerahanSaja = and(
  eq(serviceRequests.serviceType, "Layanan Perpustakaan"),
  or(
    eq(serviceRequests.serviceNeed, PENYERAHAN_NEED),
    eq(serviceRequests.serviceNeed, PENYERAHAN_NEED_LAMA),
  ),
);

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return Response.json({ success: false, message: "Silakan login." }, { status: 401 });
    }
    if (!bolehArsip(profile.role)) {
      return Response.json({ success: false, message: "Anda tidak berwenang mengarsipkan berkas." }, { status: 403 });
    }

    const rows = await db
      .select({
        requestId: serviceRequests.id,
        ticket: serviceRequests.ticket,
        nim: serviceRequests.nim,
        studentName: serviceRequests.studentName,
        studyProgram: serviceRequests.studyProgram,
        title: serviceRequests.title,
        createdAt: serviceRequests.createdAt,
        attachmentId: requestAttachments.id,
        part: requestAttachments.part,
        label: requestAttachments.label,
        sortOrder: requestAttachments.sortOrder,
        fileName: requestAttachments.fileName,
        fileSize: requestAttachments.fileSize,
      })
      .from(requestAttachments)
      .innerJoin(serviceRequests, eq(requestAttachments.requestId, serviceRequests.id))
      .where(penyerahanSaja);

    // Baris digabungkan per mahasiswa supaya dashboard tidak perlu
    // mengelompokkan sendiri, dan urutan bagiannya tetap seperti saat diunggah.
    const peta = new Map<number, {
      requestId: number; ticket: string; nim: string; studentName: string;
      studyProgram: string | null; title: string | null; createdAt: string;
      totalBytes: number;
      bagian: Array<{ id: number; part: string; label: string; fileName: string; fileSize: number }>;
    }>();

    for (const r of rows) {
      let entri = peta.get(r.requestId);
      if (!entri) {
        entri = {
          requestId: r.requestId,
          ticket: r.ticket,
          nim: r.nim,
          studentName: r.studentName,
          studyProgram: r.studyProgram,
          title: r.title,
          createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
          totalBytes: 0,
          bagian: [],
        };
        peta.set(r.requestId, entri);
      }
      entri.bagian.push({
        id: r.attachmentId,
        part: r.part,
        label: r.label,
        fileName: r.fileName,
        fileSize: r.fileSize,
      });
      entri.totalBytes += r.fileSize;
    }

    const daftar = [...peta.values()]
      .map((e) => ({ ...e, bagian: e.bagian.sort((a, b) => a.part.localeCompare(b.part)) }))
      .sort((a, b) => a.nim.localeCompare(b.nim));

    return Response.json({
      success: true,
      daftar,
      ringkasan: {
        mahasiswa: daftar.length,
        berkas: daftar.reduce((n, d) => n + d.bagian.length, 0),
        totalBytes: daftar.reduce((n, d) => n + d.totalBytes, 0),
      },
    });
  } catch (error: unknown) {
    console.error("perpus arsip list", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Daftar arsip tidak dapat dibaca.") },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const batas = rateLimit({ request, name: "perpus-arsip-hapus", limit: 10, windowMs: 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return Response.json({ success: false, message: "Silakan login." }, { status: 401 });
    }
    // Penghapusan tidak dapat dibatalkan, jadi dibatasi lebih ketat daripada
    // pembacaan: hanya Admin dan Super Admin.
    if (profile.role !== "super_admin" && profile.role !== "admin") {
      return Response.json(
        { success: false, message: "Hanya Admin dan Super Admin yang boleh menghapus berkas arsip." },
        { status: 403 },
      );
    }

    let muatan: { requestIds?: unknown };
    try {
      muatan = (await request.json()) as { requestIds?: unknown };
    } catch {
      return Response.json({ success: false, message: "Permintaan tidak terbaca." }, { status: 400 });
    }

    const ids = Array.isArray(muatan.requestIds)
      ? muatan.requestIds.filter((x): x is number => Number.isInteger(x) && (x as number) > 0)
      : [];
    if (ids.length === 0) {
      return Response.json({ success: false, message: "Tidak ada berkas yang dipilih untuk dihapus." }, { status: 400 });
    }

    // Hanya lampiran milik penyerahan perpustakaan yang boleh dihapus lewat
    // jalur ini, walaupun id yang dikirim menunjuk tiket lain.
    const rows = await db
      .select({
        attachmentId: requestAttachments.id,
        path: requestAttachments.fileStoragePath,
      })
      .from(requestAttachments)
      .innerJoin(serviceRequests, eq(requestAttachments.requestId, serviceRequests.id))
      .where(and(penyerahanSaja, inArray(requestAttachments.requestId, ids)));

    if (rows.length === 0) {
      return Response.json({ success: false, message: "Tidak ada berkas penyerahan pada pilihan itu." }, { status: 404 });
    }

    // Berkas di penyimpanan dihapus lebih dulu. Bila catatannya yang dihapus
    // duluan lalu langkah ini gagal, berkasnya menjadi yatim: memakan kuota
    // tanpa ada baris yang menunjuknya, dan tidak ada lagi cara menemukannya.
    let gagalHapus = 0;
    for (const r of rows) {
      try {
        await removeDocument(r.path);
      } catch {
        gagalHapus += 1;
      }
    }

    await db.delete(requestAttachments).where(
      inArray(requestAttachments.id, rows.map((r) => r.attachmentId)),
    );

    return Response.json({
      success: true,
      dihapus: rows.length,
      gagalHapus,
      pesan:
        gagalHapus > 0
          ? `${rows.length} catatan berkas dihapus, tetapi ${gagalHapus} berkas gagal dihapus dari penyimpanan. Periksa bucket Supabase.`
          : `${rows.length} berkas dihapus dari penyimpanan.`,
    });
  } catch (error: unknown) {
    console.error("perpus arsip hapus", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Berkas tidak dapat dihapus.") },
      { status: 500 },
    );
  }
}
