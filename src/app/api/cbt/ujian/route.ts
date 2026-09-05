// ============================================================
// CBT — UJIAN (sisi dosen dan admin)
//
// GET    daftar ujian yang boleh dilihat pemanggilnya
// POST   buat ujian baru
// PATCH  ubah setelan ujian — setelan pengawasan tetap terbuka walau berjalan
// DELETE hapus ujian beserta soal dan hasilnya
//
// Yang boleh MENGAKTIFKAN ada di /api/cbt/aktivasi, bukan di sini — dan yang
// boleh melakukannya hanyalah PEMILIK ujiannya. Dosen yang menyusun soalnyalah
// yang tahu kapan kelasnya siap; admin memantau, menghapus, dan boleh membuat
// ujian sendiri (mis. seleksi) yang kemudian juga miliknya.
// ============================================================
import { db } from "@/db";
import { cbtAttempts, cbtExams, cbtQuestions } from "@/db/schema";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  angkaParam, bolehCbt, bolehHapus, bolehUbah, kodeUjianBaru, pemilik, PEMANTAU, statusUjian,
} from "@/lib/cbt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Aturan kepemilikan tinggal di src/lib/cbt.ts — bebas basis data, sehingga
// dapat diuji tanpa menyalakan Postgres, dan diambil langsung dari sana oleh
// rute CBT yang lain. Berkas rute sengaja tidak mengekspor apa pun selain
// penangan dan pengaturannya.

const teks = (nilai: unknown, batas: number) =>
  typeof nilai === "string" ? nilai.replace(/\s+/g, " ").trim().slice(0, batas) : "";

const angka = (nilai: unknown, bawaan: number, min: number, maks: number) => {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return bawaan;
  return Math.max(min, Math.min(Math.round(n), maks));
};

/**
 * Setelan yang MENGUBAH BENTUK ujian, dan hanya itu yang terkunci selama ujian
 * berlangsung.
 *
 * Dulu seluruh perubahan ditolak begitu ujiannya berjalan. Terdengar aman,
 * tetapi yang terjadi di ruang ujian justru sebaliknya: seorang mahasiswa
 * terblokir karena ponselnya sudah dipakai temannya, dan pengawas tidak dapat
 * melepas centang "satu perangkat" sampai ujiannya usai — artinya orang itu
 * tidak ikut ujian sama sekali. Setelan pengawasan dan keterangan karena itu
 * tetap terbuka; yang tetap dikunci hanya empat hal yang membuat sebagian
 * peserta mengerjakan ujian yang berbeda dari sebagian yang lain.
 */
const BENTUK = ["questionCount", "durationMinutes", "randomQuestions", "randomOptions"] as const;

const NAMA_BENTUK: Record<(typeof BENTUK)[number], string> = {
  questionCount: "jumlah soal",
  durationMinutes: "durasi",
  randomQuestions: "pengacakan urutan soal",
  randomOptions: "pengacakan urutan pilihan",
};

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) {
      return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
    }

    // Dosen hanya melihat ujiannya sendiri. Admin melihat semuanya, karena
    // merekalah yang memantau.
    //
    // Dua sisi diperiksa, bukan satu. Dosen yang profilnya belum tersambung ke
    // baris dosen tetap harus menemukan ujian yang ia buat sendiri; sebaliknya
    // ujian lama yang hanya membawa lecturerId tetap harus terlihat.
    const saring =
      profile.role === "dosen"
        ? profile.lecturerId === null
          ? eq(cbtExams.createdById, profile.id)
          : or(eq(cbtExams.lecturerId, profile.lecturerId), eq(cbtExams.createdById, profile.id))
        : undefined;

    const daftar = await db
      .select({
        id: cbtExams.id,
        code: cbtExams.code,
        title: cbtExams.title,
        courseName: cbtExams.courseName,
        className: cbtExams.className,
        lecturerId: cbtExams.lecturerId,
        createdBy: cbtExams.createdBy,
        createdById: cbtExams.createdById,
        questionCount: cbtExams.questionCount,
        durationMinutes: cbtExams.durationMinutes,
        passingGrade: cbtExams.passingGrade,
        maxAttempts: cbtExams.maxAttempts,
        randomQuestions: cbtExams.randomQuestions,
        randomOptions: cbtExams.randomOptions,
        allowBack: cbtExams.allowBack,
        showScore: cbtExams.showScore,
        singleDevice: cbtExams.singleDevice,
        token: cbtExams.token,
        startAt: cbtExams.startAt,
        endAt: cbtExams.endAt,
        activatedAt: cbtExams.activatedAt,
        activatedBy: cbtExams.activatedBy,
        description: cbtExams.description,
        instruction: cbtExams.instruction,
        createdAt: cbtExams.createdAt,
      })
      .from(cbtExams)
      .where(saring)
      .orderBy(desc(cbtExams.createdAt))
      .limit(200);

    // Jumlah soal dan peserta dihitung sekali untuk seluruh daftar, bukan
    // satu pertanyaan per ujian: dua puluh ujian berarti empat puluh
    // perjalanan ke basis data yang semuanya menunggu.
    const bankRows = await db
      .select({ examId: cbtQuestions.examId, n: sql<number>`count(*)::int` })
      .from(cbtQuestions)
      .groupBy(cbtQuestions.examId);
    const bank = new Map(bankRows.map((b) => [b.examId, b.n]));

    const pesertaRows = await db
      .select({
        examId: cbtAttempts.examId,
        total: sql<number>`count(*)::int`,
        berjalan: sql<number>`count(*) filter (where status = 'berjalan')::int`,
        selesai: sql<number>`count(*) filter (where status <> 'berjalan')::int`,
      })
      .from(cbtAttempts)
      .groupBy(cbtAttempts.examId);
    const peserta = new Map(pesertaRows.map((p) => [p.examId, p]));

    const sekarang = new Date();
    return Response.json({
      success: true,
      // Bukan lagi satu izin untuk seluruh halaman: izin menempel pada tiap
      // ujian, karena satu orang dapat memiliki sebagian dan hanya memantau
      // sisanya.
      pemantau: PEMANTAU.includes(profile.role),
      ujian: daftar.map((u) => ({
        ...u,
        status: statusUjian({ aktif: Boolean(u.activatedAt), mulai: u.startAt, selesai: u.endAt }, sekarang),
        jumlahBank: bank.get(u.id) ?? 0,
        peserta: peserta.get(u.id) ?? { total: 0, berjalan: 0, selesai: 0 },
        milik: pemilik(profile, u),
        bolehUbah: bolehUbah(profile, u),
        bolehHapus: bolehHapus(profile, u),
      })),
    });
  } catch (error: unknown) {
    console.error("daftar ujian cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Daftar ujian belum dapat dimuat.") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "cbt-buat-ujian", limit: 30, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) {
      return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const title = teks(body.title, 160);
    const courseName = teks(body.courseName, 120);
    if (!title || !courseName) {
      return Response.json({ success: false, message: "Nama ujian dan mata kuliah wajib diisi." }, { status: 400 });
    }

    // Kode diulang bila kebetulan tabrakan. Enam huruf dari 32 abjad memberi
    // lebih dari satu miliar kemungkinan; tabrakan itu jarang, bukan mustahil.
    for (let coba = 0; coba < 5; coba += 1) {
      const code = kodeUjianBaru();
      try {
        const dibuat = await db
          .insert(cbtExams)
          .values({
            code,
            title,
            courseName,
            className: teks(body.className, 80) || null,
            description: teks(body.description, 2000) || null,
            instruction: teks(body.instruction, 2000) || null,
            lecturerId: profile.role === "dosen" ? profile.lecturerId : null,
            createdBy: profile.fullName,
            createdById: profile.id,
            createdByRole: profile.role,
            questionCount: angka(body.questionCount, 0, 0, 500),
            durationMinutes: angka(body.durationMinutes, 60, 1, 600),
            passingGrade: angka(body.passingGrade, 60, 0, 100),
            maxAttempts: angka(body.maxAttempts, 1, 1, 10),
            randomQuestions: body.randomQuestions !== false,
            randomOptions: body.randomOptions !== false,
            allowBack: body.allowBack !== false,
            showScore: body.showScore !== false,
            singleDevice: body.singleDevice !== false,
            token: teks(body.token, 12).toUpperCase() || null,
          })
          .returning({ id: cbtExams.id, code: cbtExams.code });
        return Response.json({ success: true, ujian: dibuat[0] }, { status: 201 });
      } catch (error) {
        if (coba >= 4) throw error;
      }
    }
    return Response.json({ success: false, message: "Ujian belum dapat dibuat." }, { status: 500 });
  } catch (error: unknown) {
    console.error("buat ujian cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Ujian belum tersimpan.") },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) {
      return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const id = angkaParam(String(body.id ?? ""));
    if (id === null) {
      return Response.json({ success: false, message: "Ujian tidak dikenali." }, { status: 400 });
    }

    const ada = await db.select().from(cbtExams).where(eq(cbtExams.id, id)).limit(1);
    const ujian = ada[0];
    if (!ujian) return Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 });
    if (!bolehUbah(profile, ujian)) {
      return Response.json(
        { success: false, message: "Ujian ini milik dosen lain. Anda hanya dapat memantaunya." },
        { status: 403 },
      );
    }

    const status = statusUjian({ aktif: Boolean(ujian.activatedAt), mulai: ujian.startAt, selesai: ujian.endAt });
    const berlangsung = status === "berlangsung";

    const ubah: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.title === "string") ubah.title = teks(body.title, 160);
    if (typeof body.courseName === "string") ubah.courseName = teks(body.courseName, 120);
    if (typeof body.className === "string") ubah.className = teks(body.className, 80) || null;
    if (typeof body.description === "string") ubah.description = teks(body.description, 2000) || null;
    if (typeof body.instruction === "string") ubah.instruction = teks(body.instruction, 2000) || null;
    if (body.questionCount !== undefined) ubah.questionCount = angka(body.questionCount, 0, 0, 500);
    if (body.durationMinutes !== undefined) ubah.durationMinutes = angka(body.durationMinutes, 60, 1, 600);
    if (body.passingGrade !== undefined) ubah.passingGrade = angka(body.passingGrade, 60, 0, 100);
    if (body.maxAttempts !== undefined) ubah.maxAttempts = angka(body.maxAttempts, 1, 1, 10);
    if (body.randomQuestions !== undefined) ubah.randomQuestions = body.randomQuestions !== false;
    if (body.randomOptions !== undefined) ubah.randomOptions = body.randomOptions !== false;
    if (body.allowBack !== undefined) ubah.allowBack = body.allowBack !== false;
    if (body.showScore !== undefined) ubah.showScore = body.showScore !== false;
    if (body.singleDevice !== undefined) ubah.singleDevice = body.singleDevice !== false;
    if (body.token !== undefined) ubah.token = teks(body.token, 12).toUpperCase() || null;

    // Selama ujian berjalan, yang mengubah bentuknya ditolak — tetapi hanya
    // bila nilainya memang berbeda. Layar dosen mengirim seluruh formulir
    // sekaligus, dan menolaknya karena membawa durasi yang sama persis dengan
    // yang tersimpan berarti mengunci setelan yang sebenarnya boleh diubah.
    if (berlangsung) {
      const tersendat = BENTUK.filter(
        (k) => k in ubah && ubah[k] !== (ujian as unknown as Record<string, unknown>)[k],
      );
      if (tersendat.length > 0) {
        return Response.json(
          {
            success: false,
            message:
              `Ujian sedang berlangsung, jadi ${tersendat.map((k) => NAMA_BENTUK[k]).join(", ")} ` +
              "belum dapat diubah — sebagian peserta akan mengerjakan ujian yang berbeda dari " +
              "sebagian yang lain. Setelan pengawasan seperti “satu perangkat”, kode " +
              "pengawas, dan instruksi tetap dapat diubah sekarang.",
          },
          { status: 409 },
        );
      }
      for (const k of BENTUK) delete ubah[k];
    }

    await db.update(cbtExams).set(ubah).where(eq(cbtExams.id, id));
    return Response.json({ success: true, berlangsung });
  } catch (error: unknown) {
    console.error("ubah ujian cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Perubahan belum tersimpan.") },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) {
      return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
    }
    const id = angkaParam(new URL(request.url).searchParams.get("id"));
    if (id === null) {
      return Response.json({ success: false, message: "Ujian tidak dikenali." }, { status: 400 });
    }

    const ada = await db.select().from(cbtExams).where(eq(cbtExams.id, id)).limit(1);
    const ujian = ada[0];
    if (!ujian) return Response.json({ success: true });
    if (!bolehHapus(profile, ujian)) {
      return Response.json({ success: false, message: "Ujian ini milik dosen lain." }, { status: 403 });
    }

    // Ujian yang sudah dikerjakan orang hanya boleh dihapus Super Admin.
    // Hasil ujian adalah catatan akademik; menghapusnya bukan kerja harian.
    const dipakai = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(cbtAttempts)
      .where(eq(cbtAttempts.examId, id));
    if ((dipakai[0]?.n ?? 0) > 0 && profile.role !== "super_admin") {
      return Response.json(
        {
          success: false,
          message: "Ujian ini sudah dikerjakan mahasiswa. Penghapusannya hanya oleh Super Admin.",
        },
        { status: 403 },
      );
    }

    await db.delete(cbtExams).where(and(eq(cbtExams.id, id)));
    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("hapus ujian cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Ujian belum dapat dihapus.") },
      { status: 500 },
    );
  }
}
