import { db } from "@/db";
import { libraryAttendance } from "@/db/schema";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { getCurrentProfile, type SessionProfile } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function canManageAttendance(profile: SessionProfile | null) {
  return Boolean(
    profile &&
    ["super_admin", "admin", "admin_perpustakaan"].includes(profile.role),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nim = searchParams.get("nim")?.trim();
  const wantRecent = searchParams.get("recent") === "1";
  const profile = await getCurrentProfile();
  const isStaff = canManageAttendance(profile);

  try {
    // Daftar kunjungan terbaru: khusus staf perpustakaan/admin.
    if (wantRecent) {
      if (!isStaff) {
        return Response.json({ success: false, message: "Hanya admin perpustakaan yang dapat melihat daftar absensi." }, { status: 403 });
      }
      const visits = await db
        .select()
        .from(libraryAttendance)
        .orderBy(desc(libraryAttendance.visitDate))
        .limit(50);
      return Response.json({ success: true, visits });
    }

    if (!nim) {
      return Response.json({ success: false, message: "NIM wajib diisi." }, { status: 400 });
    }

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(libraryAttendance)
      .where(eq(libraryAttendance.nim, nim));
    const total = countRows[0]?.count ?? 0;

    // Publik (form mahasiswa) hanya menerima nomor kunjungan berikutnya —
    // riwayat lengkap (nama & waktu) hanya untuk staf yang login.
    if (!isStaff) {
      return Response.json({ success: true, nextVisit: total + 1 });
    }

    const visits = await db
      .select()
      .from(libraryAttendance)
      .where(eq(libraryAttendance.nim, nim))
      .orderBy(desc(libraryAttendance.visitDate))
      .limit(20);
    return Response.json({ success: true, visits, nextVisit: total + 1 });
  } catch {
    return Response.json({ success: false, message: "Data absensi tidak dapat dimuat." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!canManageAttendance(profile)) {
      return Response.json({ success: false, message: "Hanya Admin Perpustakaan, Admin, atau Super Admin yang dapat mencatat absensi." }, { status: 403 });
    }

    const body = (await request.json()) as {
      nim?: string;
      studentName?: string;
      visitDate?: string;
      visitNumber?: number;
      note?: string;
      requestId?: number | null;
    };

    const nim = body.nim?.trim();
    const studentName = body.studentName?.trim();
    if (!nim || !studentName) {
      return Response.json({ success: false, message: "NIM dan nama mahasiswa wajib diisi." }, { status: 400 });
    }

    let visitNumber = body.visitNumber;
    if (!visitNumber || visitNumber < 1) {
      const countRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(libraryAttendance)
        .where(eq(libraryAttendance.nim, nim));
      visitNumber = (countRows[0]?.count ?? 0) + 1;
    }

    const inserted = await db
      .insert(libraryAttendance)
      .values({
        nim,
        studentName,
        visitDate: body.visitDate ? new Date(body.visitDate) : new Date(),
        visitNumber,
        note: body.note?.trim() || null,
        requestId: body.requestId || null,
      })
      .returning();

    return Response.json({ success: true, attendance: inserted[0] });
  } catch (error: unknown) {
    console.error("create attendance", error);
    return Response.json({ success: false, message: "Absensi gagal dicatat." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!canManageAttendance(profile)) {
      return Response.json({ success: false, message: "Hanya Admin Perpustakaan, Admin, atau Super Admin yang dapat mengubah absensi." }, { status: 403 });
    }

    const body = (await request.json()) as {
      id?: number;
      visitDate?: string;
      visitNumber?: number;
      note?: string;
    };

    if (!body.id) {
      return Response.json({ success: false, message: "ID absensi wajib diisi." }, { status: 400 });
    }

    const updated = await db
      .update(libraryAttendance)
      .set({
        visitDate: body.visitDate ? new Date(body.visitDate) : undefined,
        visitNumber: body.visitNumber,
        note: body.note?.trim() ?? undefined,
      })
      .where(eq(libraryAttendance.id, body.id))
      .returning();

    if (!updated.length) {
      return Response.json({ success: false, message: "Data absensi tidak ditemukan." }, { status: 404 });
    }
    return Response.json({ success: true, attendance: updated[0] });
  } catch (error: unknown) {
    console.error("update attendance", error);
    return Response.json({ success: false, message: "Absensi gagal diubah." }, { status: 500 });
  }
}

/**
 * Hapus catatan kunjungan. HANYA SUPER ADMIN.
 *
 * Absensi tidak melewati pemeriksaan siapa pun, jadi salah catat — NIM keliru,
 * satu orang terhitung dua kali, uji coba yang terlanjur tersimpan — tidak
 * punya jalan perbaikan lain selain dihapus. Haknya dipegang satu peran saja:
 * ini menghapus bukti kehadiran orang, dan admin unit tidak perlu bisa
 * melakukannya.
 *
 * Nomor kunjungan yang tersisa SENGAJA tidak dihitung ulang. Nomor itu sudah
 * terlanjur dipakai pada tiket yang dipegang mahasiswa; mengubahnya membuat
 * bukti yang ada di tangan mereka tidak lagi cocok dengan yang tercatat.
 */
export async function DELETE(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "super_admin") {
      return Response.json(
        { success: false, message: "Hanya Super Admin yang dapat menghapus catatan absensi." },
        { status: 403 },
      );
    }

    let muatan: { ids?: unknown };
    try {
      muatan = (await request.json()) as { ids?: unknown };
    } catch {
      return Response.json({ success: false, message: "Permintaan tidak terbaca." }, { status: 400 });
    }

    const ids = Array.isArray(muatan.ids)
      ? muatan.ids.filter((x): x is number => Number.isInteger(x) && (x as number) > 0).slice(0, 200)
      : [];
    if (ids.length === 0) {
      return Response.json({ success: false, message: "Tidak ada catatan yang dipilih." }, { status: 400 });
    }

    const dihapus = await db
      .delete(libraryAttendance)
      .where(inArray(libraryAttendance.id, ids))
      .returning({ id: libraryAttendance.id });

    return Response.json({
      success: true,
      dihapus: dihapus.map((baris) => baris.id),
      pesan: `${dihapus.length} catatan kunjungan dihapus.`,
    });
  } catch (error: unknown) {
    console.error("hapus absensi", error);
    return Response.json({ success: false, message: "Catatan absensi gagal dihapus." }, { status: 500 });
  }
}
