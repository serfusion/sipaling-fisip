import { db } from "@/db";
import { announcements } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentProfile, hasAtLeast } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(announcements)
      .where(eq(announcements.active, true))
      .orderBy(desc(announcements.priority), desc(announcements.updatedAt))
      .limit(1);
    return Response.json({ success: true, announcement: rows[0] || null });
  } catch {
    return Response.json({ success: false, announcement: null });
  }
}

export async function PUT(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !["super_admin", "admin"].includes(profile.role)) {
      return Response.json({ success: false, message: "Pengumuman hanya dapat diubah oleh Admin atau Super Admin." }, { status: 403 });
    }
    const body = (await request.json()) as { title?: string; body?: string; active?: boolean };
    const title = body.title?.trim();
    const bodyText = body.body?.trim();
    if (!title || !bodyText) {
      return Response.json({ success: false, message: "Judul dan isi pengumuman wajib diisi." }, { status: 400 });
    }

    const existing = await db.select({ id: announcements.id }).from(announcements).where(eq(announcements.active, true)).limit(1);

    if (existing.length) {
      const updated = await db
        .update(announcements)
        .set({ title, body: bodyText, active: true, priority: 1, createdBy: profile.fullName, updatedAt: new Date() })
        .where(eq(announcements.id, existing[0].id))
        .returning();
      return Response.json({ success: true, announcement: updated[0] });
    }

    const inserted = await db
      .insert(announcements)
      .values({ title, body: bodyText, active: true, priority: 1, createdBy: profile.fullName })
      .returning();
    return Response.json({ success: true, announcement: inserted[0] });
  } catch (error: unknown) {
    console.error("update announcement", error);
    return Response.json({ success: false, message: "Pengumuman gagal disimpan." }, { status: 500 });
  }
}
