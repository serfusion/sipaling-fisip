// ============================================================
// CBT — BANK SOAL
//
// GET    daftar soal satu ujian, LENGKAP dengan kuncinya — hanya untuk dosen
//        pemiliknya dan admin. Jalur mahasiswa tidak pernah lewat sini.
// POST   tambah soal (satu, atau banyak sekaligus dari tempel-tempelan)
// PATCH  ubah satu soal
// DELETE hapus satu soal
// ============================================================
import { db } from "@/db";
import { cbtExams, cbtQuestions } from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { statusUjian, type JenisSoal } from "@/lib/cbt";
import { bolehCbt, miliknya } from "../ujian/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JENIS: JenisSoal[] = ["pg", "benar_salah", "isian", "essay"];
const TINGKAT = ["mudah", "sedang", "sulit"];

const teks = (nilai: unknown, batas: number) =>
  typeof nilai === "string" ? nilai.replace(/\r\n/g, "\n").trim().slice(0, batas) : "";

type Masukan = {
  jenis?: unknown; pertanyaan?: unknown; pilihan?: unknown; kunci?: unknown;
  bobot?: unknown; materi?: unknown; tingkat?: unknown; pembahasan?: unknown;
};

/**
 * Bersihkan dan periksa satu soal.
 *
 * Soal yang kuncinya tidak sah lebih berbahaya daripada soal yang tidak ada:
 * ia tampak beres di layar dosen, lalu menyalahkan seluruh mahasiswa yang
 * sebenarnya menjawab benar.
 */
function rapikanSoal(m: Masukan): { ok: true; nilai: Record<string, unknown> } | { ok: false; pesan: string } {
  const jenis = (JENIS as string[]).includes(String(m.jenis)) ? (String(m.jenis) as JenisSoal) : "pg";
  const pertanyaan = teks(m.pertanyaan, 4000);
  if (pertanyaan.length < 3) return { ok: false, pesan: "Pertanyaan belum diisi." };

  let pilihan: string[] = [];
  if (Array.isArray(m.pilihan)) {
    pilihan = m.pilihan.map((p) => teks(p, 500)).filter((p) => p.length > 0);
  }
  let kunci = teks(m.kunci, 400);

  if (jenis === "pg" || jenis === "benar_salah") {
    if (jenis === "benar_salah" && pilihan.length === 0) pilihan = ["Benar", "Salah"];
    if (pilihan.length < 2) return { ok: false, pesan: "Pilihan jawaban minimal dua." };
    const nomor = Number(kunci);
    if (!Number.isInteger(nomor) || nomor < 0 || nomor >= pilihan.length) {
      return { ok: false, pesan: "Kunci jawaban belum dipilih." };
    }
    kunci = String(nomor);
  } else if (jenis === "isian") {
    pilihan = [];
    if (!kunci) return { ok: false, pesan: "Kunci jawaban isian singkat belum diisi." };
  } else {
    // Essay tidak punya kunci; ia menunggu dosen.
    pilihan = [];
    kunci = "";
  }

  const bobotAngka = Number(m.bobot);
  const bobot = Number.isFinite(bobotAngka) ? Math.max(1, Math.min(Math.round(bobotAngka), 100)) : 1;
  const tingkat = TINGKAT.includes(String(m.tingkat)) ? String(m.tingkat) : "sedang";

  return {
    ok: true,
    nilai: {
      type: jenis,
      question: pertanyaan,
      options: JSON.stringify(pilihan),
      answerKey: kunci,
      points: bobot,
      material: teks(m.materi, 120) || null,
      difficulty: tingkat,
      explanation: teks(m.pembahasan, 2000) || null,
    },
  };
}

async function ujianMilikSaya(examId: number) {
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

/** Soal tidak boleh diubah selagi ujiannya berlangsung. */
function terkunci(ujian: { activatedAt: Date | null; startAt: Date | null; endAt: Date | null }) {
  return statusUjian({ aktif: Boolean(ujian.activatedAt), mulai: ujian.startAt, selesai: ujian.endAt }) === "berlangsung";
}

export async function GET(request: Request) {
  try {
    const examId = Number(new URL(request.url).searchParams.get("ujian"));
    if (!Number.isInteger(examId)) {
      return Response.json({ success: false, message: "Ujian tidak dikenali." }, { status: 400 });
    }
    const cek = await ujianMilikSaya(examId);
    if ("gagal" in cek) return cek.gagal;

    const baris = await db
      .select()
      .from(cbtQuestions)
      .where(eq(cbtQuestions.examId, examId))
      .orderBy(asc(cbtQuestions.sortOrder), asc(cbtQuestions.id));

    return Response.json({
      success: true,
      soal: baris.map((s) => ({
        id: s.id,
        jenis: s.type,
        pertanyaan: s.question,
        pilihan: JSON.parse(s.options || "[]") as string[],
        kunci: s.answerKey,
        bobot: s.points,
        materi: s.material || "",
        tingkat: s.difficulty,
        pembahasan: s.explanation || "",
      })),
    });
  } catch (error: unknown) {
    console.error("baca soal cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Soal belum dapat dimuat.") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "cbt-soal", limit: 200, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const body = (await request.json()) as { ujian?: unknown; soal?: Masukan[] };
    const examId = Number(body.ujian);
    if (!Number.isInteger(examId)) {
      return Response.json({ success: false, message: "Ujian tidak dikenali." }, { status: 400 });
    }
    const cek = await ujianMilikSaya(examId);
    if ("gagal" in cek) return cek.gagal;
    if (terkunci(cek.ujian)) {
      return Response.json(
        { success: false, message: "Ujian sedang berlangsung. Soal tidak dapat diubah sekarang." },
        { status: 409 },
      );
    }

    const masuk = Array.isArray(body.soal) ? body.soal.slice(0, 200) : [];
    if (masuk.length === 0) {
      return Response.json({ success: false, message: "Tidak ada soal yang dikirim." }, { status: 400 });
    }

    const urutTerakhir = await db
      .select({ n: sql<number>`coalesce(max(sort_order), 0)::int` })
      .from(cbtQuestions)
      .where(eq(cbtQuestions.examId, examId));
    let urut = urutTerakhir[0]?.n ?? 0;

    const siap: Array<Record<string, unknown>> = [];
    const ditolak: string[] = [];
    for (const [i, m] of masuk.entries()) {
      const hasil = rapikanSoal(m);
      if (!hasil.ok) {
        ditolak.push(`Soal ${i + 1}: ${hasil.pesan}`);
        continue;
      }
      urut += 1;
      siap.push({ ...hasil.nilai, examId, sortOrder: urut });
    }

    if (siap.length === 0) {
      return Response.json({ success: false, message: ditolak[0] || "Soal tidak sah." }, { status: 400 });
    }

    await db.insert(cbtQuestions).values(siap as never);
    return Response.json({ success: true, masuk: siap.length, ditolak }, { status: 201 });
  } catch (error: unknown) {
    console.error("simpan soal cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Soal belum tersimpan.") },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: unknown } & Masukan;
    const id = Number(body.id);
    if (!Number.isInteger(id)) {
      return Response.json({ success: false, message: "Soal tidak dikenali." }, { status: 400 });
    }
    const punya = await db.select().from(cbtQuestions).where(eq(cbtQuestions.id, id)).limit(1);
    if (!punya[0]) return Response.json({ success: false, message: "Soal tidak ditemukan." }, { status: 404 });

    const cek = await ujianMilikSaya(punya[0].examId);
    if ("gagal" in cek) return cek.gagal;
    if (terkunci(cek.ujian)) {
      return Response.json(
        { success: false, message: "Ujian sedang berlangsung. Soal tidak dapat diubah sekarang." },
        { status: 409 },
      );
    }

    const hasil = rapikanSoal(body);
    if (!hasil.ok) return Response.json({ success: false, message: hasil.pesan }, { status: 400 });

    await db.update(cbtQuestions).set(hasil.nilai as never).where(eq(cbtQuestions.id, id));
    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("ubah soal cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Soal belum tersimpan.") },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) {
      return Response.json({ success: false, message: "Soal tidak dikenali." }, { status: 400 });
    }
    const punya = await db.select().from(cbtQuestions).where(eq(cbtQuestions.id, id)).limit(1);
    if (!punya[0]) return Response.json({ success: true });

    const cek = await ujianMilikSaya(punya[0].examId);
    if ("gagal" in cek) return cek.gagal;
    if (terkunci(cek.ujian)) {
      return Response.json(
        { success: false, message: "Ujian sedang berlangsung. Soal tidak dapat dihapus sekarang." },
        { status: 409 },
      );
    }

    await db.delete(cbtQuestions).where(and(eq(cbtQuestions.id, id)));
    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("hapus soal cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Soal belum dapat dihapus.") },
      { status: 500 },
    );
  }
}
