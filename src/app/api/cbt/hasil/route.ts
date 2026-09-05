// ============================================================
// CBT — MONITORING, HASIL, DAN ANALISIS (sisi dosen)
//
// GET ?ujian=<id>            monitoring + statistik + analisis soal
// GET ?ujian=<id>&attempt=<id>  rincian jawaban satu mahasiswa
// PATCH                      koreksi essay: nilai + catatan dosen
// ============================================================
import { db } from "@/db";
import { cbtAnswers, cbtAttempts, cbtExams } from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { analisisSoal, sisaDetik, statistikNilai, statusUjian } from "@/lib/cbt";
import { bacaLembar, soalUjian } from "@/lib/cbt-store";
import { bolehCbt, miliknya } from "../ujian/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gerbang(examId: number) {
  const profile = await getCurrentProfile();
  if (!bolehCbt(profile) || !profile) {
    return { gagal: Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 }) };
  }
  const baris = await db.select().from(cbtExams).where(eq(cbtExams.id, examId)).limit(1);
  const ujian = baris[0];
  if (!ujian) return { gagal: Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 }) };
  if (!miliknya(profile, ujian)) {
    return { gagal: Response.json({ success: false, message: "Ujian ini milik dosen lain." }, { status: 403 }) };
  }
  return { profile, ujian };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const examId = Number(params.get("ujian"));
    if (!Number.isInteger(examId)) {
      return Response.json({ success: false, message: "Ujian tidak dikenali." }, { status: 400 });
    }
    const cek = await gerbang(examId);
    if ("gagal" in cek) return cek.gagal;
    const { ujian } = cek;
    const sekarang = new Date();

    // ---------- RINCIAN SATU MAHASISWA ----------
    const attemptId = Number(params.get("attempt"));
    if (Number.isInteger(attemptId)) {
      const baris = await db
        .select()
        .from(cbtAttempts)
        .where(and(eq(cbtAttempts.id, attemptId), eq(cbtAttempts.examId, examId)))
        .limit(1);
      const attempt = baris[0];
      if (!attempt) return Response.json({ success: false, message: "Peserta tidak ditemukan." }, { status: 404 });

      const bank = await soalUjian(examId);
      const lembar = bacaLembar(attempt.paper);
      const jawaban = await db.select().from(cbtAnswers).where(eq(cbtAnswers.attemptId, attempt.id));
      const petaJawab = new Map(jawaban.map((j) => [j.questionId, j]));

      return Response.json({
        success: true,
        peserta: {
          id: attempt.id, nim: attempt.nim, nama: attempt.name, status: attempt.status,
          nilai: attempt.score, benar: attempt.correct, salah: attempt.wrong,
          kosong: attempt.blank, tertunda: attempt.pending,
          mulai: attempt.startedAt.toISOString(),
          kumpul: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
          keluarFullscreen: attempt.leftFullscreen, pindahTab: attempt.switchedTab,
        },
        // Kunci jawaban baru ikut keluar DI SINI — sesudah ujiannya dikumpulkan,
        // dan hanya kepada dosen pemiliknya.
        rincian: lembar.map((l, urut) => {
          const soal = bank.find((s) => s.id === l.id);
          if (!soal) return null;
          const j = petaJawab.get(l.id);
          const dipilih = j ? j.answer : "";
          const nomorAsli = l.peta.length && dipilih !== "" ? l.peta[Number(dipilih)] : Number(dipilih);
          return {
            nomor: urut + 1,
            id: soal.id,
            jenis: soal.jenis,
            pertanyaan: soal.pertanyaan,
            pilihan: soal.pilihan,
            bobot: soal.bobot,
            kunci: soal.kunci,
            pembahasan: soal.pembahasan,
            jawaban: dipilih,
            jawabanTeks:
              soal.jenis === "pg" || soal.jenis === "benar_salah"
                ? (soal.pilihan[nomorAsli] ?? "")
                : dipilih,
            benar: j ? j.isCorrect : null,
            poin: j ? j.points : 0,
            catatan: j?.feedback || "",
          };
        }).filter(Boolean),
      });
    }

    // ---------- MONITORING SELURUH PESERTA ----------
    const peserta = await db
      .select()
      .from(cbtAttempts)
      .where(eq(cbtAttempts.examId, examId))
      .orderBy(desc(cbtAttempts.startedAt))
      .limit(500);

    const jumlahSoal = ujian.questionCount || (await soalUjian(examId)).length;
    const semuaJawaban = await db
      .select({
        attemptId: cbtAnswers.attemptId,
        questionId: cbtAnswers.questionId,
        answer: cbtAnswers.answer,
        isCorrect: cbtAnswers.isCorrect,
      })
      .from(cbtAnswers);
    const punyaUjianIni = new Set(peserta.map((p) => p.id));
    const jawabanUjian = semuaJawaban.filter((j) => punyaUjianIni.has(j.attemptId));

    const terisi = new Map<number, number>();
    for (const j of jawabanUjian) {
      if (String(j.answer ?? "").trim()) terisi.set(j.attemptId, (terisi.get(j.attemptId) ?? 0) + 1);
    }

    const nilai = peserta.filter((p) => p.status !== "berjalan" && p.score !== null).map((p) => p.score as number);
    const bank = await soalUjian(examId);

    return Response.json({
      success: true,
      ujian: {
        id: ujian.id, kode: ujian.code, judul: ujian.title, mataKuliah: ujian.courseName,
        kelas: ujian.className, durasi: ujian.durationMinutes, jumlahSoal,
        passing: ujian.passingGrade,
        status: statusUjian({ aktif: Boolean(ujian.activatedAt), mulai: ujian.startAt, selesai: ujian.endAt }, sekarang),
        mulai: ujian.startAt ? ujian.startAt.toISOString() : null,
        selesai: ujian.endAt ? ujian.endAt.toISOString() : null,
      },
      peserta: peserta.map((p) => ({
        id: p.id, nim: p.nim, nama: p.name, status: p.status,
        terjawab: terisi.get(p.id) ?? 0,
        nilai: p.score,
        tertunda: p.pending,
        sisaDetik: p.status === "berjalan" ? sisaDetik(p.deadlineAt, sekarang) : 0,
        keluarFullscreen: p.leftFullscreen,
        pindahTab: p.switchedTab,
        mulai: p.startedAt.toISOString(),
        kumpul: p.submittedAt ? p.submittedAt.toISOString() : null,
      })),
      statistik: statistikNilai(nilai, ujian.passingGrade),
      analisis: analisisSoal(
        bank.map((s) => ({ id: s.id, pertanyaan: s.pertanyaan })),
        jawabanUjian.map((j) => ({ questionId: j.questionId, benar: j.isCorrect })),
      ),
    });
  } catch (error: unknown) {
    console.error("hasil cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Hasil belum dapat dimuat.") },
      { status: 500 },
    );
  }
}

/**
 * Koreksi essay.
 *
 * Nilai attempt-nya dihitung ulang seluruhnya sesudah koreksi, bukan
 * ditambahkan begitu saja — menambahkan berarti mengoreksi dua kali membuat
 * poinnya berlipat, dan itu ketahuannya baru setelah nilai keluar.
 */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      ujian?: unknown; attempt?: unknown; soal?: unknown; poin?: unknown; catatan?: unknown;
    };
    const examId = Number(body.ujian);
    const attemptId = Number(body.attempt);
    const questionId = Number(body.soal);
    if (!Number.isInteger(examId) || !Number.isInteger(attemptId) || !Number.isInteger(questionId)) {
      return Response.json({ success: false, message: "Data koreksi tidak lengkap." }, { status: 400 });
    }
    const cek = await gerbang(examId);
    if ("gagal" in cek) return cek.gagal;

    const bank = await soalUjian(examId);
    const soal = bank.find((s) => s.id === questionId);
    if (!soal) return Response.json({ success: false, message: "Soal tidak ditemukan." }, { status: 404 });

    const diberi = Number(body.poin);
    if (!Number.isFinite(diberi) || diberi < 0 || diberi > soal.bobot) {
      return Response.json(
        { success: false, message: `Nilai harus antara 0 dan ${soal.bobot}.` },
        { status: 400 },
      );
    }
    const poin = Math.round(diberi);
    const sekarang = new Date();

    await db
      .update(cbtAnswers)
      .set({
        points: poin,
        isCorrect: poin > 0,
        feedback: typeof body.catatan === "string" ? body.catatan.slice(0, 2000) : null,
        gradedBy: cek.profile.fullName,
        updatedAt: sekarang,
      })
      .where(and(eq(cbtAnswers.attemptId, attemptId), eq(cbtAnswers.questionId, questionId)));

    // Hitung ulang dari nol.
    const attemptRow = await db.select().from(cbtAttempts).where(eq(cbtAttempts.id, attemptId)).limit(1);
    const attempt = attemptRow[0];
    if (!attempt) return Response.json({ success: false, message: "Peserta tidak ditemukan." }, { status: 404 });

    const lembar = bacaLembar(attempt.paper);
    const dipakai = lembar.map((l) => bank.find((s) => s.id === l.id)).filter(Boolean) as typeof bank;
    const jawaban = await db
      .select()
      .from(cbtAnswers)
      .where(eq(cbtAnswers.attemptId, attemptId))
      .orderBy(asc(cbtAnswers.questionId));

    const poinMaks = dipakai.reduce((n, s) => n + s.bobot, 0);
    const poinDapat = jawaban.reduce((n, j) => n + (j.points || 0), 0);
    const tertunda = dipakai.filter((s) => {
      if (s.jenis !== "essay") return false;
      const j = jawaban.find((x) => x.questionId === s.id);
      return Boolean(j && String(j.answer).trim() && j.isCorrect === null);
    }).length;
    const benar = jawaban.filter((j) => j.isCorrect === true).length;
    const salah = jawaban.filter((j) => j.isCorrect === false).length;

    await db
      .update(cbtAttempts)
      .set({
        score: poinMaks > 0 ? Math.round((poinDapat / poinMaks) * 100) : 0,
        correct: benar,
        wrong: salah,
        pending: tertunda,
      })
      .where(eq(cbtAttempts.id, attemptId));

    return Response.json({
      success: true,
      nilai: poinMaks > 0 ? Math.round((poinDapat / poinMaks) * 100) : 0,
      tertunda,
    });
  } catch (error: unknown) {
    console.error("koreksi cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Koreksi belum tersimpan.") },
      { status: 500 },
    );
  }
}
