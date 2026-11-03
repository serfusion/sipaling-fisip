// ============================================================
// CBT — PENILAIAN TUGAS DENGAN AI
//
// GET              penyedia AI mana yang siap
// POST aksi=nilai  satu kiriman TERSIMPAN (id) → gerbang plagiasi → skor &
//                  umpan balik AI → disimpan
// POST aksi=rubrik teks dokumen rubrik → rubrik tugas tersusun
//
// Sejak v54 yang dinilai adalah kiriman yang tersimpan di server sebagai
// Markdown (dikumpulkan peserta lewat CBT atau diimpor pengajar). Peramban
// pengajar hanya menyebut id-nya, ditambah lampiran visual BILA berkas aslinya
// kebetulan masih terbuka di perambannya (impor dari Drive pada sesi yang
// sama): PDF utuh atau gambar halaman, untuk dibaca model. Lampiran itu
// dipakai untuk satu permintaan ini saja dan tidak disimpan.
//
// GERBANG PLAGIASI dijalankan lebih dulu (src/lib/tugas-papan.ts): kiriman
// yang terindikasi plagiasi ditahan atau dinolkan menurut pengaturan tugas,
// TANPA memanggil model, sehingga kuota AI tidak terpakai untuknya.
//
// Satu permintaan = satu mahasiswa. Peramban yang mengatur antreannya
// (dua sekaligus), sehingga empat puluh mahasiswa tidak pernah menjadi satu
// permintaan yang menabrak batas waktu.
// ============================================================
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { bolehCbt } from "@/lib/cbt";
import { GalatModel, penyediaTersedia, type DokumenMasuk, type GambarMasuk } from "@/lib/ai-penyedia";
import { MAKS_TEKS_TUGAS, nilaiTugas, susunRubrikDenganAi } from "@/lib/tugas-nilai";
import { periksaRubrikTugas } from "@/lib/tugas-rubrik";
import { TEMPLATE_BAWAAN, analisisTemplate, uraiMarkdown } from "@/lib/tugas-template";
import { gerbangPlagiasi, rapikanTindakan } from "@/lib/tugas-papan";
import { bolehUbah } from "@/lib/cbt";
import { db } from "@/db";
import { cbtTaskSubmissions } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  kepemilikan, kirimanDariId, kirimanKeKlien, rubrikDari, simpanHasil, tugasDariId,
} from "@/lib/tugas-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Satu tugas belasan halaman dibaca model yang berpikir: puluhan detik.
export const maxDuration = 300;

/** Batas lampiran visual per mahasiswa. Base64, jadi ± 3 MB berkas asli. */
const MAKS_LAMPIRAN_BASE64 = 4_300_000;
const MAKS_LAMPIRAN = 16;
const JENIS_GAMBAR = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const tolak = (message: string, status = 400) => Response.json({ success: false, message }, { status });

export async function GET() {
  const profile = await getCurrentProfile();
  if (!bolehCbt(profile)) return tolak("Menu CBT tidak tersedia untuk role Anda.", 403);
  const tersedia = await penyediaTersedia();
  return Response.json({ success: true, siap: tersedia.length > 0, tersedia, maksTeks: MAKS_TEKS_TUGAS });
}

const base64Sah = (s: string) => /^[A-Za-z0-9+/]*={0,2}$/.test(s);

export async function POST(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) return tolak("Menu CBT tidak tersedia untuk role Anda.", 403);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return tolak("Permintaan tidak dapat dibaca. Mungkin lampirannya terlalu besar.");
    const aksi = String(body.aksi ?? "");

    if (aksi === "rubrik") {
      const batas = rateLimit({ request, name: "tugas-rubrik", limit: 40, windowMs: 60 * 60_000 });
      if (!batas.ok) return tooManyRequests(batas.retryAfter);
      const naskah = String(body.teks ?? "").trim();
      if (naskah.length < 30) return tolak("Teks rubriknya terlalu pendek untuk disusun.");
      const hasil = await susunRubrikDenganAi(naskah);
      if (hasil.rubrik.kriteria.length === 0) {
        return tolak("AI tidak menemukan satu kriteria pun di dokumen itu. Isi rubriknya langsung di tabel.", 422);
      }
      return Response.json({ success: true, ...hasil });
    }

    if (aksi !== "nilai") return tolak("Aksi tidak dikenali.");

    // Longgar, karena satu kelas bisa empat puluh sampai seratus mahasiswa,
    // tetapi tetap berbatas: tiap panggilan memakan kuota AI sungguhan.
    const batas = rateLimit({ request, name: "tugas-nilai", limit: 600, windowMs: 60 * 60_000 });
    if (!batas.ok) return tooManyRequests(batas.retryAfter);

    const k = await kirimanDariId(Number(body.kiriman));
    if (!k) return tolak("Kiriman tidak ditemukan. Muat ulang daftar kiriman.", 404);
    const t = await tugasDariId(k.taskId);
    if (!t) return tolak("Tugas kiriman ini sudah dihapus.", 404);
    if (!bolehUbah(profile, kepemilikan(t))) return tolak("Hanya pembuat tugas ini yang dapat menilai kirimannya.", 403);

    const rubrik = rubrikDari(t);
    const cek = periksaRubrikTugas(rubrik);
    if (!cek.ok) return tolak(`Rubrik belum siap: ${cek.pesan}`);
    const tindakan = rapikanTindakan(t.plagiarismAction);

    // ---------- GERBANG PLAGIASI ----------
    const gerbang = gerbangPlagiasi({ status: k.similarityStatus, skor: k.similarity, putusan: k.decision }, tindakan);
    if (!gerbang.lanjut) {
      let baris = k;
      if (k.status !== "dinilai" && k.status !== "ditahan") {
        [baris] = await db.update(cbtTaskSubmissions).set({ status: "ditahan", updatedAt: new Date() })
          .where(eq(cbtTaskSubmissions.id, k.id)).returning();
      }
      return Response.json(
        { success: false, ditahan: true, message: gerbang.alasan, kiriman: kirimanKeKlien(baris, tindakan) },
        { status: 409 },
      );
    }

    const teks = k.markdown;
    const gambar: GambarMasuk[] = [];
    const dokumen: DokumenMasuk[] = [];
    let ukuran = 0;
    for (const l of (Array.isArray(body.lampiran) ? body.lampiran : []).slice(0, MAKS_LAMPIRAN)) {
      const x = (l ?? {}) as { jenis?: unknown; data?: unknown; nama?: unknown };
      const jenis = String(x.jenis ?? "");
      const data = String(x.data ?? "");
      if (!data || !base64Sah(data)) continue;
      ukuran += data.length;
      if (ukuran > MAKS_LAMPIRAN_BASE64) break;
      if (jenis === "application/pdf") dokumen.push({ jenis, data, nama: String(x.nama ?? "").slice(0, 200) });
      else if (JENIS_GAMBAR.has(jenis)) gambar.push({ jenis, data });
    }
    if (!teks.trim() && gambar.length === 0 && dokumen.length === 0) {
      return tolak("Kiriman ini tidak berisi teks yang dapat dinilai. Unggah ulang berkas aslinya di sesi ini untuk melampirkan gambarnya.", 422);
    }

    const hasil = await nilaiTugas(
      {
        tugas: { mataKuliah: t.courseName, nomor: t.taskNo, nama: t.title, petunjuk: t.instruction },
        rubrik,
        mahasiswa: { nama: k.name, nim: k.nim },
        berkas: k.fileName.split(/;\s*/).filter(Boolean).slice(0, 40),
        teks,
        bagianTambahan: analisisTemplate(uraiMarkdown(t.template || TEMPLATE_BAWAAN)).bagianBebas,
        keteranganLampiran: String(body.keteranganLampiran ?? "").slice(0, 300),
      },
      { gambar, dokumen },
    );
    const { mentah, ...simpan } = hasil;
    const baru = await simpanHasil(k, simpan, { disunting: false, isiIdentitas: true });
    return Response.json({ success: true, hasil: { ...simpan, mentah }, catatanGerbang: gerbang.catatan, kiriman: kirimanKeKlien(baru, tindakan) });
  } catch (galat: unknown) {
    if (galat instanceof GalatModel) {
      return Response.json({ success: false, message: galat.message }, { status: galat.status });
    }
    console.error("penilaian tugas", galat);
    return Response.json(
      { success: false, message: explainServerError(galat, "Tugas belum dapat dinilai.") },
      { status: 500 },
    );
  }
}
