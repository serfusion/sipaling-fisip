// ============================================================
// CBT — BUAT SOAL DENGAN AI
//
// GET  keterangan: penyedia mana yang siap dipakai
// POST naskah → soal
//
// YANG DIKIRIM KE SINI ADALAH TEKS, BUKAN BERKAS. Dokumen dosen disarikan di
// perambannya sendiri — sama seperti pengimpor Excel dan Word — sehingga
// berkas aslinya tidak pernah singgah di server ini.
//
// Soal yang dihasilkan TIDAK langsung masuk bank. Ia dikembalikan sebagai
// pratinjau, dan dosennya yang memutuskan. Dua puluh soal buatan mesin yang
// langsung tersimpan berarti dua puluh soal yang harus diperiksa satu per satu
// sesudahnya — dan yang paling sering terjadi adalah tidak diperiksa sama
// sekali.
// ============================================================
import { db } from "@/db";
import { cbtExams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { angkaParam, bolehCbt, bolehUbah } from "@/lib/cbt";
import {
  MAKS_SOAL, PERAN_SISTEM, SKEMA_JAWABAN, naskahCukup, periksaJawabanAi,
  rapikanPermintaan, susunPerintah,
} from "@/lib/ai-soal";
import { GalatModel, mintaJson, penyediaTersedia, type NamaPenyedia } from "@/lib/ai-penyedia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Membuat soal memakan waktu; batas bawaan Vercel terlalu pendek untuk itu.
export const maxDuration = 300;

export async function GET() {
  const profile = await getCurrentProfile();
  if (!bolehCbt(profile)) {
    return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
  }
  const tersedia = penyediaTersedia();
  return Response.json({
    success: true,
    tersedia,
    siap: tersedia.length > 0,
    maksSoal: MAKS_SOAL,
  });
}

export async function POST(request: Request) {
  // Dibatasi ketat: tiap panggilan memakan waktu dan biaya sungguhan.
  const batas = rateLimit({ request, name: "cbt-ai-soal", limit: 20, windowMs: 60 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) {
      return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const examId = angkaParam(String(body.ujian ?? ""));
    if (examId === null) {
      return Response.json({ success: false, message: "Ujian tidak dikenali." }, { status: 400 });
    }

    const baris = await db.select().from(cbtExams).where(eq(cbtExams.id, examId)).limit(1);
    const ujian = baris[0];
    if (!ujian) return Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 });
    if (!bolehUbah(profile, ujian)) {
      return Response.json(
        { success: false, message: "Soal ujian ini hanya dapat disusun dosen pemiliknya." },
        { status: 403 },
      );
    }

    const minta = rapikanPermintaan({
      teks: String(body.teks ?? ""),
      jumlah: Number(body.jumlah),
      jenis: Array.isArray(body.jenis) ? (body.jenis as never) : undefined,
      tingkat: body.tingkat as never,
      materi: String(body.materi ?? ujian.courseName ?? ""),
      arahan: String(body.arahan ?? ""),
    });

    const cukup = naskahCukup(minta.teks, minta.jumlah);
    if (!cukup.ok) {
      return Response.json({ success: false, message: cukup.pesan }, { status: 400 });
    }

    const jawaban = await mintaJson({
      sistem: PERAN_SISTEM,
      perintah: susunPerintah(minta),
      skema: SKEMA_JAWABAN as unknown as Record<string, unknown>,
      penyedia: body.penyedia as NamaPenyedia | undefined,
    });

    const hasil = periksaJawabanAi(jawaban.isi, minta.jumlah);
    if (hasil.soal.length === 0) {
      return Response.json(
        {
          success: false,
          message:
            "Model tidak menghasilkan satu pun soal yang sah dari naskah ini. " +
            "Coba naskah yang lebih rinci, atau kurangi jumlah soalnya.",
          tolak: hasil.tolak.slice(0, 8),
        },
        { status: 422 },
      );
    }

    return Response.json({
      success: true,
      soal: hasil.soal,
      tolak: hasil.tolak,
      kurang: hasil.kurang,
      penyedia: jawaban.penyedia,
      model: jawaban.model,
    });
  } catch (galat: unknown) {
    if (galat instanceof GalatModel) {
      return Response.json({ success: false, message: galat.message }, { status: galat.status });
    }
    console.error("buat soal ai", galat);
    return Response.json(
      { success: false, message: explainServerError(galat, "Soal belum dapat dibuat.") },
      { status: 500 },
    );
  }
}
