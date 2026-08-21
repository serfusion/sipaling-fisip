import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// Template surat disimpan sebagai HTML di tabel app_settings dengan key
// template_html_<slug>, sehingga Admin Umum bisa mengubah template dari
// dashboard tanpa deploy ulang.
const ALLOWED_SLUGS = ["izin-penelitian", "pkl", "surat-aktif", "transkrip-custom", "transkrip-en"] as const;
const EDIT_ROLES = ["super_admin", "admin", "admin_umum", "admin_akademik"];
const MAX_HTML = 1_500_000; // ±1,5 MB per template (memuat gambar ttd base64)

function keyFor(slug: string) {
  return `template_html_${slug}`;
}

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return Response.json({ success: false, message: "Silakan login." }, { status: 401 });
    }
    const slug = new URL(request.url).searchParams.get("slug") || "";
    if (!ALLOWED_SLUGS.includes(slug as (typeof ALLOWED_SLUGS)[number])) {
      return Response.json({ success: false, message: "Template tidak dikenal." }, { status: 400 });
    }
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, keyFor(slug))).limit(1);
    if (!rows.length) return Response.json({ success: true, template: null });
    try {
      const parsed = JSON.parse(rows[0].value) as { html?: string; updatedBy?: string };
      return Response.json({ success: true, template: { html: parsed.html || "", updatedBy: parsed.updatedBy || null, updatedAt: rows[0].updatedAt } });
    } catch {
      return Response.json({ success: true, template: null });
    }
  } catch (error: unknown) {
    console.error("get template", error);
    return Response.json({ success: false, message: explainServerError(error, "Template belum dapat dimuat.") }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !EDIT_ROLES.includes(profile.role)) {
      return Response.json({ success: false, message: "Role Anda tidak dapat mengubah template." }, { status: 403 });
    }
    const body = (await request.json()) as { slug?: string; html?: string };
    const slug = body.slug || "";
    if (!ALLOWED_SLUGS.includes(slug as (typeof ALLOWED_SLUGS)[number])) {
      return Response.json({ success: false, message: "Template tidak dikenal." }, { status: 400 });
    }
    const html = String(body.html || "").slice(0, MAX_HTML);
    // Lapis pertama (server). Versi lama hanya membuang pasangan tag yang
    // lengkap sehingga `<script src=...>` tanpa penutup dan `<svg/onload=...>`
    // masih lolos. Sekarang seluruh tag berbahaya dibuang walau tak berpenutup,
    // dan atribut handler dikenali meski dipisah "/" atau baris baru.
    // Lapis kedua ada di sisi tampilan (sanitizeLetterHtml) yang membangun
    // ulang DOM dengan allowlist — itulah pertahanan yang menentukan.
    const safe = html
      .replace(/<\s*(script|iframe|object|embed|link|meta|form|svg|math)\b[\s\S]*?(?:<\s*\/\s*\1\s*>|>)/gi, "")
      .replace(/<\s*\/\s*(script|iframe|object|embed|link|meta|form|svg|math)\s*>/gi, "")
      .replace(/[\s/]on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/(javascript|vbscript|data)\s*(?::|&#58;)/gi, (match) =>
        // data: tetap boleh khusus gambar tertanam (tanda tangan hasil scan).
        /^data/i.test(match) ? match : "blocked:",
      );
    const value = JSON.stringify({ html: safe, updatedBy: profile.fullName });
    await db
      .insert(appSettings)
      .values({ key: keyFor(slug), value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("save template", error);
    return Response.json({ success: false, message: explainServerError(error, "Template belum tersimpan.") }, { status: 500 });
  }
}
