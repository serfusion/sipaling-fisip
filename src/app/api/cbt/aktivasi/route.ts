// ============================================================
// CBT — GERBANG AKTIVASI
//
// HANYA Super Admin dan Admin. Admin bagian — umum, akademik, prodi, PDDIKTI,
// perpustakaan, laboratorium — sengaja TIDAK termasuk, dan itu permintaan
// yang tegas: ujian yang dapat dibuka siapa saja yang kebetulan punya akses
// dashboard bukan ujian yang terjaga.
//
// Yang diatur di sini dua hal, dan keduanya soal WAKTU:
//
//   mulai / selesai  — jendela ujiannya
//   activatedAt      — izin yang membuat jendela itu berlaku
//
// Sesudah keduanya terisi, tidak ada lagi tombol yang harus ditekan siapa pun.
// Disetel pukul sepuluh, terbuka sendiri pukul sepuluh — karena orang yang
// harus menekan tombol tepat pada satu detik tertentu adalah titik gagal yang
// paling sering benar-benar terjadi.
// ============================================================
import { db } from "@/db";
import { cbtExams, cbtQuestions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { statusUjian } from "@/lib/cbt";
import { AKTIVATOR } from "../ujian/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const waktu = (nilai: unknown): Date | null => {
  if (typeof nilai !== "string" || !nilai.trim()) return null;
  const d = new Date(nilai);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "cbt-aktivasi", limit: 60, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const profile = await getCurrentProfile();
    if (!profile || !AKTIVATOR.includes(profile.role)) {
      return Response.json(
        {
          success: false,
          message: "Aktivasi ujian hanya oleh Super Admin dan Admin.",
        },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      id?: unknown;
      aksi?: "aktifkan" | "batalkan";
      mulai?: unknown;
      selesai?: unknown;
    };
    const id = Number(body.id);
    if (!Number.isInteger(id)) {
      return Response.json({ success: false, message: "Ujian tidak dikenali." }, { status: 400 });
    }

    const ada = await db.select().from(cbtExams).where(eq(cbtExams.id, id)).limit(1);
    const ujian = ada[0];
    if (!ujian) return Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 });

    if (body.aksi === "batalkan") {
      const status = statusUjian({
        aktif: Boolean(ujian.activatedAt), mulai: ujian.startAt, selesai: ujian.endAt,
      });
      if (status === "berlangsung") {
        return Response.json(
          {
            success: false,
            message: "Ujian sedang berlangsung. Membatalkannya sekarang memutus mahasiswa yang sedang mengerjakan.",
          },
          { status: 409 },
        );
      }
      await db
        .update(cbtExams)
        .set({ activatedAt: null, activatedBy: null, updatedAt: new Date() })
        .where(eq(cbtExams.id, id));
      return Response.json({ success: true, status: "menunggu" });
    }

    const mulai = waktu(body.mulai);
    const selesai = waktu(body.selesai);
    if (!mulai || !selesai) {
      return Response.json(
        { success: false, message: "Jam mulai dan jam selesai wajib diisi." },
        { status: 400 },
      );
    }
    if (selesai.getTime() <= mulai.getTime()) {
      return Response.json(
        { success: false, message: "Jam selesai harus sesudah jam mulai." },
        { status: 400 },
      );
    }

    // Jendela ujian harus memuat setidaknya satu durasi penuh. Jendela 30
    // menit untuk ujian 60 menit berarti setiap mahasiswa terpotong, dan itu
    // baru ketahuan ketika mereka sudah duduk di depan layar.
    const menitJendela = (selesai.getTime() - mulai.getTime()) / 60_000;
    if (menitJendela < ujian.durationMinutes) {
      return Response.json(
        {
          success: false,
          message:
            `Jendela ujian ${Math.round(menitJendela)} menit, lebih pendek daripada durasinya ` +
            `${ujian.durationMinutes} menit. Mahasiswa akan terpotong waktunya.`,
        },
        { status: 400 },
      );
    }

    // Ujian tanpa soal tidak boleh diaktifkan. Yang terjadi bila lolos:
    // mahasiswa masuk, layarnya kosong, dan tidak ada yang dapat ia kerjakan.
    const bank = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(cbtQuestions)
      .where(eq(cbtQuestions.examId, id));
    const jumlahBank = bank[0]?.n ?? 0;
    if (jumlahBank === 0) {
      return Response.json(
        { success: false, message: "Bank soalnya masih kosong. Minta dosennya mengisi soal dulu." },
        { status: 400 },
      );
    }
    if (ujian.questionCount > jumlahBank) {
      return Response.json(
        {
          success: false,
          message:
            `Ujian menuntut ${ujian.questionCount} soal, sedangkan banknya baru ${jumlahBank}. ` +
            "Tambah soal, atau turunkan jumlah soal ujiannya.",
        },
        { status: 400 },
      );
    }

    const sekarang = new Date();
    await db
      .update(cbtExams)
      .set({
        startAt: mulai,
        endAt: selesai,
        activatedAt: sekarang,
        activatedBy: profile.fullName,
        updatedAt: sekarang,
      })
      .where(eq(cbtExams.id, id));

    return Response.json({
      success: true,
      status: statusUjian({ aktif: true, mulai, selesai }, sekarang),
      mulai: mulai.toISOString(),
      selesai: selesai.toISOString(),
      olehSiapa: profile.fullName,
    });
  } catch (error: unknown) {
    console.error("aktivasi ujian cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Aktivasi belum tersimpan.") },
      { status: 500 },
    );
  }
}
