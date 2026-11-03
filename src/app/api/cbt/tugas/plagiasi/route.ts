// ============================================================
// CBT — PLAGIASI TUGAS (pengajar)
//
// POST {tugas}      hitung ulang kemiripan seluruh kiriman SEKARANG. Inilah
//                   gerbang yang dijalankan panel pengajar sebelum menilai.
// GET ?a=&b=        dua kiriman berdampingan: kalimat yang sama persis.
//
// Kiriman CBT sudah diperiksa otomatis sesaat sesudah masuk
// (plagiasiSesudahKirim). Hitung ulang di sini tetap perlu: ambang dapat
// berubah, kiriman dapat dihapus, dan pengajar berhak melihat angka yang segar
// tepat sebelum menilai.
// ============================================================
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { bolehCbt, bolehPantau } from "@/lib/cbt";
import { cuplikanSama } from "@/lib/tugas-plagiasi";
import { rapikanTindakan } from "@/lib/tugas-papan";
import {
  hitungUlangPlagiasi, kepemilikan, kirimanDariId, kirimanKeKlien, kirimanTugas, pasanganKeKlien, pasanganTugas,
  tugasDariId,
} from "@/lib/tugas-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const tolak = (message: string, status = 400) => Response.json({ success: false, message }, { status });

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "tugas-plagiasi", limit: 120, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) return tolak("Menu CBT tidak tersedia untuk role Anda.", 403);
    const body = (await request.json().catch(() => null)) as { tugas?: unknown } | null;
    const t = await tugasDariId(Number(body?.tugas));
    if (!t || !bolehPantau(profile, kepemilikan(t))) return tolak("Tugas tidak ditemukan.", 404);

    const hasil = await hitungUlangPlagiasi(t);
    const tindakan = rapikanTindakan(t.plagiarismAction);
    const [kiriman, pasangan] = await Promise.all([kirimanTugas(t.id), pasanganTugas(t.id)]);
    return Response.json({
      success: true,
      ringkas: { pasangan: hasil.pasangan, ditandai: hasil.ditandai, umum: hasil.umum, baru: hasil.baruDitandai.length },
      kiriman: kiriman.map((k) => kirimanKeKlien(k, tindakan)),
      pasangan: pasangan.map(pasanganKeKlien),
    });
  } catch (galat: unknown) {
    console.error("plagiasi tugas", galat);
    return tolak(explainServerError(galat, "Plagiasi belum dapat diperiksa."), 500);
  }
}

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) return tolak("Menu CBT tidak tersedia untuk role Anda.", 403);
    const q = new URL(request.url).searchParams;
    const [a, b] = await Promise.all([kirimanDariId(Number(q.get("a"))), kirimanDariId(Number(q.get("b")))]);
    if (!a || !b || a.taskId !== b.taskId) return tolak("Pasangan kiriman tidak ditemukan.", 404);
    const t = await tugasDariId(a.taskId);
    if (!t || !bolehPantau(profile, kepemilikan(t))) return tolak("Pasangan kiriman tidak ditemukan.", 404);
    const ringkas = (k: typeof a) => ({ id: k.id, kode: k.receipt, nama: k.name, nim: k.nim, kata: k.words, berkas: k.fileName });
    return Response.json({ success: true, a: ringkas(a), b: ringkas(b), kalimat: cuplikanSama(a.markdown, b.markdown) });
  } catch (galat: unknown) {
    console.error("plagiasi pasangan", galat);
    return tolak(explainServerError(galat, "Pasangan kiriman belum dapat dibandingkan."), 500);
  }
}
