import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentProfile, hasAtLeast } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const KEY = "service_status";
const DEFAULT_STATE = { status: "green" as const, message: "Semua layanan aktif" };

type ServiceState = { status: "green" | "yellow" | "red"; message: string };

function parseState(value: string | null | undefined): ServiceState {
  if (!value) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(value) as Partial<ServiceState>;
    const status = parsed.status && ["green", "yellow", "red"].includes(parsed.status)
      ? parsed.status
      : DEFAULT_STATE.status;
    const message = typeof parsed.message === "string" && parsed.message.trim()
      ? parsed.message.trim()
      : DEFAULT_STATE.message;
    return { status, message };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function GET() {
  try {
    const rows = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, KEY))
      .limit(1);
    const state = parseState(rows[0]?.value);
    return Response.json({ success: true, ...state });
  } catch {
    // Jangan gagalkan halaman publik hanya karena status tidak terbaca.
    return Response.json({ success: true, ...DEFAULT_STATE });
  }
}

export async function PUT(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !["super_admin", "admin"].includes(profile.role)) {
    return Response.json(
      { success: false, message: "Status layanan hanya dapat diubah oleh Admin atau Super Admin." },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as { status?: string; message?: string };
    const status = body.status && ["green", "yellow", "red"].includes(body.status)
      ? (body.status as ServiceState["status"])
      : DEFAULT_STATE.status;
    const message = body.message?.trim() || DEFAULT_STATE.message;
    const value = JSON.stringify({ status, message });

    await db
      .insert(appSettings)
      .values({ key: KEY, value })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      });

    return Response.json({ success: true, status, message });
  } catch (error: unknown) {
    console.error("update service status", error);
    return Response.json({ success: false, message: "Status layanan belum tersimpan." }, { status: 500 });
  }
}
