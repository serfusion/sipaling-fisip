import { db } from "@/db";
import { appSettings, revisionUploads, serviceRequests } from "@/db/schema";
import { and, eq, isNotNull, lt, or, sql } from "drizzle-orm";
import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase-config";
import { DOCUMENT_BUCKET } from "@/lib/document-storage";
import { createClient } from "@supabase/supabase-js";
import { explainServerError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// PEMBERSIHAN OTOMATIS PENYIMPANAN
// Menghapus FILE lampiran yang berumur lebih dari 1 tahun dari Supabase
// Storage (dan sisa file lama di kolom bytea), TANPA menghapus baris
// datanya — sehingga laporan/statistik tetap utuh (tiket, nama, status,
// nama file, ukuran file tetap ada; hanya isi filenya yang dibuang).
//
// Dipanggil otomatis tiap hari oleh Vercel Cron (lihat vercel.json), atau
// manual: curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cleanup
const RETENTION_DAYS = 365;
const BATCH = 100;

// Perbandingan yang waktunya tetap, supaya kunci tidak bisa ditebak
// karakter demi karakter dari selisih waktu jawaban.
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return { ok: false, reason: "CRON_SECRET belum diatur di environment variables." };
  // HANYA lewat header Authorization. Cara lama `?key=...` dihapus karena
  // kunci pada URL ikut tercatat di log akses, riwayat peramban, dan header
  // Referer. Vercel Cron memang mengirimkannya sebagai header.
  const header = request.headers.get("authorization") || "";
  if (safeEqual(header, `Bearer ${secret}`)) return { ok: true, reason: "" };
  return { ok: false, reason: "Kunci tidak cocok atau tidak dikirim lewat header Authorization." };
}

export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return Response.json({ success: false, message: `Akses ditolak: ${auth.reason}` }, { status: 401 });
  }
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000);
    const url = getSupabaseUrl();
    const secretKey = getSupabaseSecretKey();
    const storage = url && secretKey
      ? createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } }).storage.from(DOCUMENT_BUCKET)
      : null;

    let filesDeleted = 0;
    let rowsCleaned = 0;

    // --- lampiran pengajuan ---
    const oldRequests = await db
      .select({ id: serviceRequests.id, path: serviceRequests.fileStoragePath })
      .from(serviceRequests)
      .where(and(lt(serviceRequests.createdAt, cutoff), or(isNotNull(serviceRequests.fileStoragePath), sql`${serviceRequests.fileData} is not null`)))
      .limit(BATCH);
    const requestPaths = oldRequests.map((row) => row.path).filter((path): path is string => Boolean(path));
    if (storage && requestPaths.length) {
      const { error } = await storage.remove(requestPaths);
      if (error) throw new Error(`Hapus file pengajuan gagal: ${error.message}`);
      filesDeleted += requestPaths.length;
    }
    for (const row of oldRequests) {
      await db.update(serviceRequests).set({ fileStoragePath: null, fileData: null }).where(eq(serviceRequests.id, row.id));
      rowsCleaned += 1;
    }

    // --- lampiran revisi ---
    const oldRevisions = await db
      .select({ id: revisionUploads.id, path: revisionUploads.fileStoragePath })
      .from(revisionUploads)
      .where(and(lt(revisionUploads.createdAt, cutoff), or(isNotNull(revisionUploads.fileStoragePath), sql`${revisionUploads.fileData} is not null`)))
      .limit(BATCH);
    const revisionPaths = oldRevisions.map((row) => row.path).filter((path): path is string => Boolean(path));
    if (storage && revisionPaths.length) {
      const { error } = await storage.remove(revisionPaths);
      if (error) throw new Error(`Hapus file revisi gagal: ${error.message}`);
      filesDeleted += revisionPaths.length;
    }
    for (const row of oldRevisions) {
      await db.update(revisionUploads).set({ fileStoragePath: null, fileData: null }).where(eq(revisionUploads.id, row.id));
      rowsCleaned += 1;
    }

    const summary = {
      ranAt: new Date().toISOString(),
      cutoff: cutoff.toISOString(),
      filesDeleted,
      rowsCleaned,
      note: rowsCleaned >= BATCH * 2 ? "Masih ada sisa — akan dilanjutkan pada jadwal berikutnya." : "Selesai.",
    };
    await db
      .insert(appSettings)
      .values({ key: "last_cleanup", value: JSON.stringify(summary), updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: JSON.stringify(summary), updatedAt: new Date() } });

    return Response.json({ success: true, ...summary });
  } catch (error: unknown) {
    console.error("cleanup", error);
    return Response.json({ success: false, message: explainServerError(error, "Pembersihan gagal dijalankan.") }, { status: 500 });
  }
}
