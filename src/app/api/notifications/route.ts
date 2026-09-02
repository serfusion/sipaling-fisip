import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { audienceFilter } from "@/lib/notifikasi-audiens";
import { explainServerError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return Response.json({ success: false, message: "Silakan login terlebih dahulu." }, { status: 401 });
    }
    const filter = audienceFilter(profile);
    if (!filter) return Response.json({ success: true, notifications: [], unread: 0 });

    const rows = await db
      .select({
        id: notifications.id,
        kind: notifications.kind,
        severity: notifications.severity,
        title: notifications.title,
        body: notifications.body,
        refCode: notifications.refCode,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(filter)
      .orderBy(desc(notifications.createdAt))
      .limit(60);

    return Response.json({
      success: true,
      notifications: rows,
      unread: rows.filter((row) => !row.readAt).length,
    });
  } catch (error: unknown) {
    console.error("list notifications", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Notifikasi belum dapat dimuat.") },
      { status: 500 },
    );
  }
}

// Tandai notifikasi sudah dibaca. Notifikasi berbasis role dibaca bersama
// oleh seluruh pemegang role tersebut, jadi statusnya juga berlaku bersama.
export async function PATCH(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return Response.json({ success: false, message: "Silakan login terlebih dahulu." }, { status: 401 });
    }
    const body = (await request.json()) as { ids?: number[]; all?: boolean };
    const filter = audienceFilter(profile);
    if (!filter) return Response.json({ success: true, updated: 0 });

    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is number => Number.isInteger(id) && id > 0).slice(0, 200)
      : [];
    if (!body.all && ids.length === 0) {
      return Response.json({ success: false, message: "Tidak ada notifikasi yang ditandai." }, { status: 400 });
    }

    // Filter audiens tetap dipasang agar tidak ada yang bisa menandai
    // notifikasi milik orang lain hanya dengan menebak id-nya.
    const updated = await db
      .update(notifications)
      .set({ readAt: sql`now()` })
      .where(and(filter, isNull(notifications.readAt), body.all ? undefined : inArray(notifications.id, ids)))
      .returning({ id: notifications.id });

    return Response.json({ success: true, updated: updated.length });
  } catch (error: unknown) {
    console.error("mark notifications", error);
    return Response.json({ success: false, message: "Notifikasi belum dapat diperbarui." }, { status: 500 });
  }
}
