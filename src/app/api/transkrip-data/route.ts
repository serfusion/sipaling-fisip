import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { bersihkanTataLetak } from "@/lib/arsip-transkrip";

export const dynamic = "force-dynamic";

// Penyimpanan DATA transkrip (biodata + daftar mata kuliah) dalam bentuk JSON.
// Berbeda dari /api/templates yang menyimpan HTML template surat: di sini isinya
// data terstruktur, sehingga admin dapat memuat kembali lalu MENAMBAH atau
// MENGURANGI mata kuliah tanpa perlu mengunggah Excel lagi.
const EDIT_ROLES = ["super_admin", "admin", "admin_akademik"];
const KEY = "transkrip_data";
// Draf ikut memuat tata letak hasil suntingan tangan (HTML), jadi batasnya
// lebih longgar daripada sekadar biodata dan daftar mata kuliah.
const MAX_CHARS = 800_000;

type Payload = {
  meta?: Record<string, string>;
  rows?: unknown[];
  savedBy?: string;
  /**
   * HTML pratinjau hasil "Edit tata letak". Kosong berarti transkripnya
   * dirender dari data — itulah bentuk bawaannya.
   */
  tataLetak?: string;
};

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return Response.json({ success: false, message: "Silakan login." }, { status: 401 });

    const found = await db.select().from(appSettings).where(eq(appSettings.key, KEY)).limit(1);
    if (!found.length) return Response.json({ success: true, data: null });
    try {
      const parsed = JSON.parse(found[0].value) as Payload;
      return Response.json({
        success: true,
        data: {
          meta: parsed.meta || {},
          rows: Array.isArray(parsed.rows) ? parsed.rows : [],
          tataLetak: typeof parsed.tataLetak === "string" ? parsed.tataLetak : "",
        },
        savedBy: parsed.savedBy || null,
        savedAt: found[0].updatedAt,
      });
    } catch {
      return Response.json({ success: true, data: null });
    }
  } catch (error: unknown) {
    console.error("get transkrip data", error);
    return Response.json({ success: false, message: explainServerError(error, "Data transkrip belum dapat dimuat.") }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !EDIT_ROLES.includes(profile.role)) {
      return Response.json({ success: false, message: "Role Anda tidak dapat menyimpan data transkrip." }, { status: 403 });
    }
    const body = (await request.json()) as Payload;
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) {
      return Response.json({ success: false, message: "Tidak ada baris nilai untuk disimpan." }, { status: 400 });
    }
    // Tata letak dibersihkan seperti template surat sebelum tersimpan; yang
    // menampilkannya kembali membersihkannya sekali lagi.
    const tataLetak = bersihkanTataLetak(body.tataLetak);
    const value = JSON.stringify({ meta: body.meta || {}, rows, tataLetak, savedBy: profile.fullName });
    if (value.length > MAX_CHARS) {
      return Response.json({
        success: false,
        message: "Draf terlalu besar untuk disimpan. Biasanya karena gambar yang ditempel pada tata letak. Perkecil atau hapus gambarnya, lalu simpan lagi.",
      }, { status: 400 });
    }
    await db
      .insert(appSettings)
      .values({ key: KEY, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
    return Response.json({ success: true, rows: rows.length, tataLetak: Boolean(tataLetak) });
  } catch (error: unknown) {
    console.error("save transkrip data", error);
    return Response.json({ success: false, message: explainServerError(error, "Data transkrip belum tersimpan.") }, { status: 500 });
  }
}
