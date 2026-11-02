// ============================================================
// CBT — PENILAIAN TUGAS DENGAN AI
//
// GET              penyedia AI mana yang siap
// POST aksi=nilai  satu kiriman tugas (teks + lampiran) → skor & umpan balik
// POST aksi=rubrik teks dokumen rubrik → rubrik tugas tersusun
//
// YANG DIKIRIM KE SINI ADALAH ISI YANG SUDAH DISARIKAN, BUKAN ARSIPNYA. Zip,
// rar, Word, Excel, dan PDF mahasiswa dibongkar di peramban dosen
// (src/lib/tugas-berkas.ts). Yang berangkat hanya teksnya ditambah, bila
// muat, PDF asli atau gambar halamannya untuk dibaca model. Arsip ratusan MB
// tidak pernah melewati batas unggah fungsi serverless, dan tidak satu pun
// berkas mahasiswa disimpan di server.
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
import { periksaRubrikTugas, rapikanRubrikTugas } from "@/lib/tugas-rubrik";

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

    const rubrik = rapikanRubrikTugas(body.rubrik);
    const cek = periksaRubrikTugas(rubrik);
    if (!cek.ok) return tolak(`Rubrik belum siap: ${cek.pesan}`);

    const t = (body.tugas ?? {}) as Record<string, unknown>;
    const m = (body.mahasiswa ?? {}) as Record<string, unknown>;
    const teks = String(body.teks ?? "");
    if (teks.length > MAKS_TEKS_TUGAS * 1.5) return tolak("Teks tugas terlalu panjang.");

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
      return tolak("Kiriman ini tidak berisi teks maupun lampiran yang dapat dibaca.");
    }

    const hasil = await nilaiTugas(
      {
        tugas: {
          mataKuliah: String(t.mataKuliah ?? "").slice(0, 200),
          nomor: String(t.nomor ?? "").slice(0, 20),
          nama: String(t.nama ?? "").slice(0, 300),
          petunjuk: String(t.petunjuk ?? "").slice(0, 8000),
        },
        rubrik,
        mahasiswa: { nama: String(m.nama ?? "").slice(0, 160), nim: String(m.nim ?? "").slice(0, 30) },
        berkas: (Array.isArray(body.berkas) ? body.berkas : []).map((b) => String(b).slice(0, 200)).slice(0, 40),
        teks,
        bagianTambahan: (Array.isArray(body.bagianTambahan) ? body.bagianTambahan : []).map((b) => String(b).slice(0, 200)),
        keteranganLampiran: String(body.keteranganLampiran ?? "").slice(0, 300),
      },
      { gambar, dokumen },
    );
    return Response.json({ success: true, hasil });
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
