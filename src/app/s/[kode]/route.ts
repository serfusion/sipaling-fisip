// ============================================================
// TAUTAN PENDEK ARSIP DRIVE — <portal>/s/KODE → Google Drive
//
// Terbuka tanpa login: tautan pendek memang untuk dibagikan. Yang dibuka
// hanya ALAMAT Drive-nya; siapa yang boleh melihat isi berkasnya tetap
// diatur izin berbagi Google Drive itu sendiri.
//
// Alamat tujuan diperiksa sekali lagi sebelum dialihkan, walaupun basis data
// sudah menolak alamat selain Google Drive: pengalih yang suatu hari
// mengantar ke situs lain atas nama portal kampus adalah lubang yang terlalu
// mahal untuk dipercayakan pada satu lapis penjagaan.
// ============================================================
import { db } from "@/db";
import { driveArchives } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { rapikanKodeArsip, tautanDriveSah } from "@/lib/tugas-kode";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function halamanTidakAda(status = 404) {
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tautan arsip tidak ditemukan</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f6f8fc;color:#1f2937}
main{max-width:26rem;padding:28px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;text-align:center}
h1{margin:0 0 8px;font-size:19px;color:#1e2d6b}p{margin:0;font-size:14px;line-height:1.6;color:#6b7280}</style></head>
<body><main><h1>Tautan arsip tidak ditemukan</h1><p>Tautan pendek ini tidak ada atau sudah dihapus Super Admin. Mintalah tautan terbaru kepada pengelola arsip.</p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ kode: string }> }) {
  const batas = rateLimit({ request, name: "tautan-pendek", limit: 300, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);
  try {
    const kode = rapikanKodeArsip((await params).kode);
    if (!kode) return halamanTidakAda();
    const [a] = await db
      .update(driveArchives)
      .set({ clicks: sql`${driveArchives.clicks} + 1` })
      .where(eq(driveArchives.code, kode))
      .returning({ url: driveArchives.driveUrl });
    const tujuan = a ? tautanDriveSah(a.url) : "";
    if (!tujuan) return halamanTidakAda();
    return new Response(null, {
      status: 307,
      headers: { Location: tujuan, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  } catch (galat: unknown) {
    console.error("tautan pendek", galat);
    return halamanTidakAda(500);
  }
}
