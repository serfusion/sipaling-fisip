import { db } from "@/db";
import { generatedDocuments } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentProfile, type Role } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const UNIT_ROLES: Role[] = [
  "admin_umum",
  "admin_akademik",
  "admin_prodi",
  "admin_pddikti",
  "admin_perpustakaan",
  "admin_laboratorium",
];

function canUseArchive(role: Role) {
  return role === "super_admin" || role === "admin" || UNIT_ROLES.includes(role);
}

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !canUseArchive(profile.role)) {
      return Response.json({ success: false, message: "Silakan login sebagai admin." }, { status: 401 });
    }
    const scoped = UNIT_ROLES.includes(profile.role);
    const rows = await db
      .select()
      .from(generatedDocuments)
      .where(scoped ? eq(generatedDocuments.unitRole, profile.role) : undefined)
      .orderBy(desc(generatedDocuments.createdAt))
      .limit(100);
    return Response.json({ success: true, archives: rows });
  } catch (error: unknown) {
    console.error("list archives", error);
    return Response.json({ success: false, message: "Arsip belum dapat dimuat." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !canUseArchive(profile.role)) {
      return Response.json({ success: false, message: "Silakan login sebagai admin." }, { status: 401 });
    }
    const body = (await request.json()) as {
      docType?: string;
      studentName?: string;
      nim?: string;
      driveUrl?: string;
      unitRole?: string;
    };
    const docType = body.docType?.trim();
    const driveUrl = body.driveUrl?.trim();
    if (!docType || docType.length > 120) {
      return Response.json({ success: false, message: "Nama dokumen wajib diisi (maks. 120 karakter)." }, { status: 400 });
    }
    if (!driveUrl || !/^https:\/\/(drive|docs)\.google\.com\//i.test(driveUrl)) {
      return Response.json(
        { success: false, message: "Tautan harus berupa link Google Drive/Docs yang valid." },
        { status: 400 },
      );
    }
    const unitRole = UNIT_ROLES.includes(profile.role)
      ? profile.role
      : UNIT_ROLES.includes(body.unitRole as Role)
        ? (body.unitRole as Role)
        : "admin_umum";

    const inserted = await db
      .insert(generatedDocuments)
      .values({
        unitRole,
        docType,
        studentName: body.studentName?.trim().slice(0, 160) || null,
        nim: body.nim?.trim().slice(0, 32) || null,
        driveUrl,
        createdBy: profile.fullName,
      })
      .returning();
    return Response.json({ success: true, archive: inserted[0] }, { status: 201 });
  } catch (error: unknown) {
    console.error("create archive", error);
    return Response.json({ success: false, message: "Arsip belum tersimpan." }, { status: 500 });
  }
}
