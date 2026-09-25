// ============================================================
// KUNCI AI — khusus Super Admin
//
// GET              daftar kunci, TERSAMAR, beserta fitur yang menyala
// PUT  { daftar }  simpan seluruh daftar dan urutannya
// POST { id }      uji satu kunci dengan permintaan sekecil mungkin
//
// Kunci utuh tidak pernah dikirim balik ke peramban. Lihat src/lib/ai-kunci.ts.
// ============================================================
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  LABEL_PENYEDIA, MODEL_BAWAAN, SEMUA_PENYEDIA, daftarKunci, daftarTersamar, simpanDaftar,
} from "@/lib/ai-kunci";
import { GalatModel, ujiKunci } from "@/lib/ai-penyedia";
import { bacaPemakaian, bulanIni, daftarBulan } from "@/lib/ai-pemakaian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function hanyaSuperAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    return Response.json(
      { success: false, message: "Hanya Super Admin yang dapat mengelola kunci AI." },
      { status: 403 },
    );
  }
  return null;
}

/** Fitur apa saja yang menyala, menurut penyedia yang aktif. */
function fiturMenyala(penyedia: string[]) {
  const ada = penyedia.length > 0;
  const dengar = penyedia.includes("gemini");
  return [
    { nama: "Buat soal otomatis", nyala: ada },
    { nama: "Penilaian esai dengan AI", nyala: ada },
    { nama: "Pemeriksa cuplikan kamera", nyala: ada },
    {
      nama: "Transkrip & deteksi suara mencurigakan",
      nyala: dengar,
      catatan: dengar ? "" : "Hanya Gemini yang dapat mendengar rekaman.",
    },
  ];
}

export async function GET(request: Request) {
  const tolak = await hanyaSuperAdmin();
  if (tolak) return tolak;
  try {
    const diminta = new URL(request.url).searchParams.get("bulan") || "";
    const bulan = /^\d{4}-\d{2}$/.test(diminta) ? diminta : bulanIni();
    const [daftar, pemakaian, bulanAda] = await Promise.all([daftarTersamar(), bacaPemakaian(bulan), daftarBulan()]);
    const aktif = [...new Set(daftar.filter((k) => k.aktif).map((k) => k.penyedia))];
    return Response.json({
      success: true,
      daftar,
      penyedia: SEMUA_PENYEDIA.map((p) => ({ kode: p, label: LABEL_PENYEDIA[p], modelBawaan: MODEL_BAWAAN[p] })),
      fitur: fiturMenyala(aktif),
      pemakaian,
      bulanAda: bulanAda.includes(bulanIni()) ? bulanAda : [bulanIni(), ...bulanAda],
    });
  } catch (error: unknown) {
    return Response.json(
      { success: false, message: explainServerError(error, "Daftar kunci belum dapat dibaca.") },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const tolak = await hanyaSuperAdmin();
  if (tolak) return tolak;
  try {
    const body = (await request.json()) as { daftar?: unknown };
    const daftar = Array.isArray(body.daftar) ? body.daftar : [];
    await simpanDaftar(
      daftar
        .map((d) => d as Record<string, unknown>)
        // Kunci environment hanya dibaca; ia tidak ikut disimpan.
        .filter((d) => !String(d.id ?? "").startsWith("env-"))
        .map((d) => ({
          id: typeof d.id === "string" ? d.id : undefined,
          penyedia: String(d.penyedia ?? ""),
          kunci: typeof d.kunci === "string" ? d.kunci : "",
          model: typeof d.model === "string" ? d.model : "",
          aktif: d.aktif !== false,
        })),
    );
    return Response.json({ success: true, daftar: await daftarTersamar() });
  } catch (error: unknown) {
    return Response.json(
      { success: false, message: explainServerError(error, "Kunci belum tersimpan.") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const tolak = await hanyaSuperAdmin();
  if (tolak) return tolak;
  // Tiap uji adalah satu panggilan sungguhan ke penyedia.
  const batas = rateLimit({ request, name: "uji-kunci-ai", limit: 30, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  const body = (await request.json().catch(() => ({}))) as { id?: unknown };
  const k = (await daftarKunci(true)).find((x) => x.id === String(body.id ?? ""));
  if (!k) return Response.json({ success: false, message: "Kunci tidak ditemukan. Simpan dulu." }, { status: 404 });

  try {
    const hasil = await ujiKunci({ ...k, model: k.model || MODEL_BAWAAN[k.penyedia] });
    return Response.json({ success: true, pesan: `Tersambung · ${hasil.model} · ${hasil.ms} ms` });
  } catch (error: unknown) {
    const pesan = error instanceof GalatModel || error instanceof Error ? error.message : "Uji gagal.";
    return Response.json({ success: false, message: pesan }, { status: 200 });
  }
}
