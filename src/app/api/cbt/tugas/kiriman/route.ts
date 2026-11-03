// ============================================================
// CBT — KIRIMAN TUGAS (pengajar)
//
// GET ?id=                 satu kiriman beserta isi .md-nya
// GET ?tugas=&ids=1,2,3    isi .md beberapa kiriman, untuk zip arsip
//                          (± 3 MB per jawaban; sisanya di `sisa`)
// POST aksi=impor          pengajar mengimpor tugas dari Drive (zip/rar/PDF/Word
//                          yang sudah disusun menjadi .md di perambannya)
// POST aksi=simpan-hasil   simpan suntingan pengajar atas hasil penilaian
// POST aksi=putuskan       putusan pengajar atas indikasi plagiasi
// POST aksi=identitas      betulkan nama dan nomor peserta
// DELETE {tugas, ids}      hapus kiriman
//
// BERKAS ASLI TIDAK PERNAH SAMPAI KE SINI. Yang dikirim peramban hanya
// Markdown hasil pembacaannya, sidik SHA-256, jumlah halaman, dan namanya.
// ============================================================
import { after } from "next/server";
import { db } from "@/db";
import { cbtTaskSimilarity, cbtTaskSubmissions } from "@/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { bolehCbt, bolehHapus, bolehPantau, bolehUbah, rapikanNama, rapikanNim } from "@/lib/cbt";
import { hitungKata } from "@/lib/pdf-markdown";
import { sidikSah } from "@/lib/tugas-kode";
import { rapikanPutusan, rapikanTindakan } from "@/lib/tugas-papan";
import {
  MAKS_MD, galatPg, hasilDari, hitungUlangPlagiasi, kepemilikan, kirimanDariId, kirimanKeKlien, kirimanTugas,
  markdownKiriman, pasanganKeKlien, pasanganTugas, plagiasiSesudahKirim, rapikanHasilDosen, rubrikDari, simpanHasil,
  simpanKiriman, tugasDariId, type BarisTugas,
} from "@/lib/tugas-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tolak = (message: string, status = 400) => Response.json({ success: false, message }, { status });

async function tugasTerlihat(profile: NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>, id: number) {
  const t = await tugasDariId(id);
  if (!t || !bolehPantau(profile, kepemilikan(t))) return null;
  return t;
}

/** Daftar kiriman & pasangan terbaru, supaya layar pengajar tidak perlu memuat ulang terpisah. */
async function keadaanTugas(t: BarisTugas) {
  const tindakan = rapikanTindakan(t.plagiarismAction);
  const [kiriman, pasangan] = await Promise.all([kirimanTugas(t.id), pasanganTugas(t.id)]);
  return { kiriman: kiriman.map((k) => kirimanKeKlien(k, tindakan)), pasangan: pasangan.map(pasanganKeKlien) };
}

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) return tolak("Menu CBT tidak tersedia untuk role Anda.", 403);
    const q = new URL(request.url).searchParams;

    if (q.get("ids")) {
      const t = await tugasTerlihat(profile, Number(q.get("tugas")));
      if (!t) return tolak("Tugas tidak ditemukan.", 404);
      const ids = String(q.get("ids")).split(",").map(Number);
      return Response.json({ success: true, ...(await markdownKiriman(t.id, ids)) });
    }

    const k = await kirimanDariId(Number(q.get("id")));
    if (!k) return tolak("Kiriman tidak ditemukan.", 404);
    const t = await tugasTerlihat(profile, k.taskId);
    if (!t) return tolak("Kiriman tidak ditemukan.", 404);
    const pasangan = await db.select().from(cbtTaskSimilarity)
      .where(or(eq(cbtTaskSimilarity.subA, k.id), eq(cbtTaskSimilarity.subB, k.id)));
    return Response.json({
      success: true,
      kiriman: { ...kirimanKeKlien(k, rapikanTindakan(t.plagiarismAction)), markdown: k.markdown },
      pasangan: pasangan.map(pasanganKeKlien),
    });
  } catch (galat: unknown) {
    console.error("kiriman tugas GET", galat);
    return tolak(explainServerError(galat, "Kiriman belum dapat dimuat."), 500);
  }
}

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "tugas-kiriman", limit: 900, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) return tolak("Menu CBT tidak tersedia untuk role Anda.", 403);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return tolak("Permintaan tidak dapat dibaca. Mungkin terlalu besar.");
    const aksi = String(body.aksi ?? "");

    // ---------- IMPOR PENGAJAR ----------
    if (aksi === "impor") {
      const t = await tugasTerlihat(profile, Number(body.tugas));
      if (!t) return tolak("Tugas tidak ditemukan.", 404);
      if (!bolehUbah(profile, kepemilikan(t))) return tolak("Hanya pembuat tugas ini yang dapat mengimpor kiriman.", 403);
      const masuk = (Array.isArray(body.kiriman) ? body.kiriman : []).slice(0, 200);
      const tindakan = rapikanTindakan(t.plagiarismAction);
      const dibuat = [];
      const catatan: string[] = [];
      for (const x of masuk) {
        const m = (x ?? {}) as Record<string, unknown>;
        let markdown = String(m.markdown ?? "").replace(/\r/g, "");
        const berkas = String(m.berkas ?? "").slice(0, 400);
        if (!markdown.trim()) { catatan.push(`${berkas || "Satu kiriman"}: tidak ada teks yang terbaca, dilewati.`); continue; }
        if (markdown.length > MAKS_MD) {
          markdown = markdown.slice(0, MAKS_MD);
          catatan.push(`${berkas}: teksnya sangat panjang dan dipotong.`);
        }
        const k = await simpanKiriman({
          taskId: t.id,
          nim: String(m.nim ?? "").replace(/\s/g, "").slice(0, 32),
          name: rapikanNama(m.nama).slice(0, 160),
          source: "dosen",
          fileName: berkas,
          fileSize: Math.max(0, Math.min(2_000_000_000, Math.round(Number(m.ukuran) || 0))),
          fileHash: sidikSah(m.sidik) ? String(m.sidik) : "",
          pages: Math.max(0, Math.min(5000, Math.round(Number(m.halaman) || 0))),
          words: hitungKata(markdown),
          markdown,
        });
        dibuat.push(kirimanKeKlien(k, tindakan));
      }
      if (dibuat.length) after(() => plagiasiSesudahKirim(t.id).catch((e) => console.error("plagiasi impor", e)));
      return Response.json({ success: true, dibuat, catatan }, { status: 201 });
    }

    const k = await kirimanDariId(Number(body.id));
    if (!k) return tolak("Kiriman tidak ditemukan.", 404);
    const t = await tugasTerlihat(profile, k.taskId);
    if (!t) return tolak("Kiriman tidak ditemukan.", 404);
    if (!bolehUbah(profile, kepemilikan(t))) return tolak("Hanya pembuat tugas ini yang dapat mengubah kirimannya.", 403);
    const tindakan = rapikanTindakan(t.plagiarismAction);

    // ---------- SUNTINGAN PENGAJAR ----------
    if (aksi === "simpan-hasil") {
      const hasil = rapikanHasilDosen(body.hasil, rubrikDari(t), hasilDari(k));
      const baru = await simpanHasil(k, hasil, { disunting: true });
      return Response.json({ success: true, kiriman: kirimanKeKlien(baru, tindakan) });
    }

    // ---------- PUTUSAN PLAGIASI ----------
    if (aksi === "putuskan") {
      const putusan = rapikanPutusan(body.putusan);
      const ubah: Partial<typeof cbtTaskSubmissions.$inferInsert> = {
        decision: putusan,
        decidedBy: putusan ? profile.fullName.slice(0, 160) : null,
        updatedAt: new Date(),
      };
      // Yang diloloskan sesudah ditahan gerbang kembali menunggu dinilai.
      if (putusan === "lolos" && k.status === "ditahan") ubah.status = "masuk";
      const [baru] = await db.update(cbtTaskSubmissions).set(ubah).where(eq(cbtTaskSubmissions.id, k.id)).returning();
      return Response.json({ success: true, kiriman: kirimanKeKlien(baru, tindakan) });
    }

    // ---------- IDENTITAS ----------
    if (aksi === "identitas") {
      const ubah: Partial<typeof cbtTaskSubmissions.$inferInsert> = { updatedAt: new Date() };
      if ("nama" in body) ubah.name = rapikanNama(body.nama).slice(0, 160);
      if ("nim" in body) ubah.nim = k.source === "cbt" ? rapikanNim(body.nim) : String(body.nim ?? "").replace(/\s/g, "").slice(0, 32);
      try {
        const [baru] = await db.update(cbtTaskSubmissions).set(ubah).where(eq(cbtTaskSubmissions.id, k.id)).returning();
        return Response.json({ success: true, kiriman: kirimanKeKlien(baru, tindakan) });
      } catch (e) {
        if (galatPg(e).kode === "23505") return tolak("Nomor peserta itu sudah dipakai kiriman CBT lain pada tugas ini.", 409);
        throw e;
      }
    }

    return tolak("Aksi tidak dikenali.");
  } catch (galat: unknown) {
    console.error("kiriman tugas POST", galat);
    return tolak(explainServerError(galat, "Kiriman belum dapat disimpan."), 500);
  }
}

export async function DELETE(request: Request) {
  const batas = rateLimit({ request, name: "tugas-kiriman-hapus", limit: 60, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) return tolak("Menu CBT tidak tersedia untuk role Anda.", 403);
    const body = (await request.json().catch(() => null)) as { tugas?: unknown; ids?: unknown } | null;
    const t = await tugasTerlihat(profile, Number(body?.tugas));
    if (!t) return tolak("Tugas tidak ditemukan.", 404);
    if (!bolehHapus(profile, kepemilikan(t))) return tolak("Anda tidak berwenang menghapus kiriman tugas ini.", 403);
    const ids = (Array.isArray(body?.ids) ? body.ids : [])
      .map(Number).filter((x) => Number.isInteger(x) && x > 0).slice(0, 1000);
    if (!ids.length) return tolak("Tidak ada kiriman yang dipilih.");
    const hapus = await db.delete(cbtTaskSubmissions)
      .where(and(eq(cbtTaskSubmissions.taskId, t.id), inArray(cbtTaskSubmissions.id, ids)))
      .returning({ id: cbtTaskSubmissions.id });
    // Tanda kemiripan kiriman yang tersisa dihitung ulang: pasangannya
    // mungkin baru saja terhapus.
    await hitungUlangPlagiasi(t);
    return Response.json({ success: true, dihapus: hapus.length, ...(await keadaanTugas(t)) });
  } catch (galat: unknown) {
    console.error("kiriman tugas DELETE", galat);
    return tolak(explainServerError(galat, "Kiriman belum dapat dihapus."), 500);
  }
}
