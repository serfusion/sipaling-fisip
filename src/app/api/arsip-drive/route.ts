// ============================================================
// ARSIP DRIVE — tautan Google Drive hasil penilaian, dengan tautan pendek
//
// GET          daftar arsip (Pengajar: miliknya sendiri; Admin dan Super
//              Admin: semuanya)
// POST         simpan tautan Drive → kode tautan pendek (<portal>/s/KODE)
// DELETE ?id=  HANYA Super Admin
//
// Alurnya: dosen mengunduh arsip lengkap satu tugas (.zip berisi laporan
// PDF, kiriman .md, rekap nilai, dan rekap plagiasi), menaruhnya di Google
// Drive, lalu menyimpan tautannya di sini. Sesudah itu isi tugas boleh
// dihapus dari portal; tautan arsipnya tetap. Karena justru tautan inilah
// satu-satunya petunjuk ke arsip, menghapusnya dipegang Super Admin saja.
//
// Pemendek ini HANYA menerima Google Drive/Docs (lihat tautanDriveSah), dan
// SQL v54 menegakkan aturan yang sama: pemendek yang menerima alamat apa saja
// adalah pengalih terbuka atas nama portal kampus.
// ============================================================
import { db } from "@/db";
import { cbtTasks, driveArchives } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { PEMANTAU, bolehCbt, bolehPantau } from "@/lib/cbt";
import { buatKodeArsip, tautanDriveSah } from "@/lib/tugas-kode";
import { galatPg, kepemilikan, tugasDariId } from "@/lib/tugas-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tolak = (message: string, status = 400) => Response.json({ success: false, message }, { status });

function keKlien(a: typeof driveArchives.$inferSelect, judulTugas?: string | null) {
  return {
    id: a.id,
    kode: a.code,
    pendek: `/s/${a.code}`,
    judul: a.title,
    url: a.driveUrl,
    catatan: a.note ?? "",
    tugas: a.taskId,
    judulTugas: judulTugas ?? "",
    klik: a.clicks,
    oleh: a.createdBy,
    dibuat: a.createdAt.toISOString(),
  };
}

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) return tolak("Arsip Drive tidak tersedia untuk role Anda.", 403);
    const semua = PEMANTAU.includes(profile.role);
    const baris = await db
      .select({ a: driveArchives, judulTugas: cbtTasks.title, mataKuliah: cbtTasks.courseName })
      .from(driveArchives)
      .leftJoin(cbtTasks, eq(cbtTasks.id, driveArchives.taskId))
      .where(semua ? undefined : eq(driveArchives.createdById, profile.id))
      .orderBy(desc(driveArchives.createdAt))
      .limit(500);
    return Response.json({
      success: true,
      arsip: baris.map((b) => keKlien(b.a, [b.mataKuliah, b.judulTugas].filter(Boolean).join(" · "))),
      bolehHapus: profile.role === "super_admin",
    });
  } catch (galat: unknown) {
    console.error("arsip drive GET", galat);
    return tolak(explainServerError(galat, "Arsip Drive belum dapat dimuat."), 500);
  }
}

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "arsip-drive", limit: 60, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) return tolak("Arsip Drive tidak tersedia untuk role Anda.", 403);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const url = tautanDriveSah(body?.url);
    if (!url) return tolak("Tautan harus tautan Google Drive atau Google Docs (https://drive.google.com/...).");
    const judul = String(body?.judul ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (judul.length < 3) return tolak("Judul arsip belum diisi.");
    const catatan = String(body?.catatan ?? "").trim().slice(0, 1000) || null;

    let taskId: number | null = null;
    if (body?.tugas) {
      const t = await tugasDariId(Number(body.tugas));
      if (!t || !bolehPantau(profile, kepemilikan(t))) return tolak("Tugas untuk arsip ini tidak ditemukan.", 404);
      taskId = t.id;
    }

    for (let coba = 0; coba < 6; coba += 1) {
      try {
        const [a] = await db.insert(driveArchives).values({
          code: buatKodeArsip(), title: judul, driveUrl: url, note: catatan, taskId,
          createdBy: profile.fullName.slice(0, 160), createdById: profile.id, createdByRole: profile.role,
        }).returning();
        return Response.json({ success: true, arsip: keKlien(a) }, { status: 201 });
      } catch (e) {
        const g = galatPg(e);
        if (g.kode === "23505" && /code/.test(g.batasan)) continue;
        throw e;
      }
    }
    return tolak("Kode tautan pendek tidak dapat dibuat. Coba lagi.", 500);
  } catch (galat: unknown) {
    console.error("arsip drive POST", galat);
    return tolak(explainServerError(galat, "Arsip Drive belum dapat disimpan."), 500);
  }
}

export async function DELETE(request: Request) {
  const batas = rateLimit({ request, name: "arsip-drive-hapus", limit: 30, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);
  try {
    const profile = await getCurrentProfile();
    if (!profile) return tolak("Silakan login.", 401);
    if (profile.role !== "super_admin") return tolak("Hanya Super Admin yang dapat menghapus Arsip Drive.", 403);
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) return tolak("Arsip tidak dipilih.");
    const hapus = await db.delete(driveArchives).where(eq(driveArchives.id, id)).returning({ id: driveArchives.id });
    if (!hapus.length) return tolak("Arsip tidak ditemukan.", 404);
    return Response.json({ success: true, pesan: "Tautan arsip dihapus. Berkas di Google Drive tidak ikut terhapus." });
  } catch (galat: unknown) {
    console.error("arsip drive DELETE", galat);
    return tolak(explainServerError(galat, "Arsip Drive belum dapat dihapus."), 500);
  }
}
