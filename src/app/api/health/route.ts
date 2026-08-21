import { getPool, isDatabaseConfigured } from "@/db";
import { DOCUMENT_BUCKET } from "@/lib/document-storage";
import { getSupabasePublishableKey, getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase-config";
import { createClient } from "@supabase/supabase-js";
import { explainServerError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Buka /api/health di browser untuk melihat diagnosis lengkap:
// env vars mana yang belum diisi, apakah database tersambung,
// apakah tabel sudah dibuat, dan apakah bucket Storage sudah ada.
export async function GET() {
  const env = {
    DATABASE_URL: isDatabaseConfigured(),
    NEXT_PUBLIC_SUPABASE_URL: Boolean(getSupabaseUrl()),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Boolean(getSupabasePublishableKey()),
    SUPABASE_SECRET_KEY: Boolean(getSupabaseSecretKey()),
  };

  let database: { ok: boolean; detail: string } = { ok: false, detail: "" };
  let tables: { ok: boolean; missing: string[]; detail: string } = { ok: false, missing: [], detail: "Tidak dapat diperiksa karena database belum tersambung." };
  const required = [
    "lecturers",
    "service_requests",
    "revision_uploads",
    "announcements",
    "profiles",
    "library_attendance",
    "app_settings",
    "generated_documents",
  ];

  if (!env.DATABASE_URL) {
    database.detail = "DATABASE_URL belum diatur di environment variables hosting.";
  } else {
    try {
      const pool = getPool();
      await pool.query("select 1");
      database = { ok: true, detail: "Koneksi database berhasil." };
      const res = await pool.query(
        "select table_name from information_schema.tables where table_schema = 'public'",
      );
      const existing = new Set(res.rows.map((r: { table_name: string }) => r.table_name));
      const missing = required.filter((t) => !existing.has(t));
      tables = missing.length
        ? { ok: false, missing, detail: "Jalankan supabase-setup.sql dan supabase-update-v2.sql di Supabase → SQL Editor." }
        : { ok: true, missing: [], detail: "Semua tabel tersedia." };
    } catch (error: unknown) {
      database.detail = explainServerError(error, "Koneksi database gagal.");
      tables.detail = "Tidak dapat diperiksa karena database belum tersambung.";
    }
  }

  let storage: { ok: boolean; detail: string } = { ok: false, detail: "" };
  const url = getSupabaseUrl();
  const secret = getSupabaseSecretKey();
  if (!url || !secret) {
    storage.detail = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY belum diatur, upload file tidak akan berjalan.";
  } else {
    try {
      const client = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error } = await client.storage.from(DOCUMENT_BUCKET).list("", { limit: 1 });
      storage = error
        ? { ok: false, detail: `Bucket "${DOCUMENT_BUCKET}" bermasalah: ${error.message}. Buat bucket lewat Dashboard → Storage atau jalankan supabase-storage-migration.sql.` }
        : { ok: true, detail: `Bucket "${DOCUMENT_BUCKET}" siap dipakai.` };
    } catch (error: unknown) {
      storage.detail = explainServerError(error, "Supabase Storage tidak dapat dihubungi.");
    }
  }

  const ok = database.ok && tables.ok && storage.ok && Object.values(env).every(Boolean);
  return Response.json({ ok, env, database, tables, storage }, { status: ok ? 200 : 500 });
}
