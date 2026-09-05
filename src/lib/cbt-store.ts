// ============================================================
// CBT — pembacaan basis data yang dipakai bersama beberapa route
// ============================================================
import { db } from "@/db";
import { cbtAnswers, cbtAttempts, cbtExams, cbtQuestions } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import type { JenisSoal, Soal } from "@/lib/cbt";

export type Ujian = typeof cbtExams.$inferSelect;
export type Attempt = typeof cbtAttempts.$inferSelect;

export async function ujianDariKode(kode: string): Promise<Ujian | null> {
  if (!kode) return null;
  const baris = await db.select().from(cbtExams).where(eq(cbtExams.code, kode)).limit(1);
  return baris[0] ?? null;
}

export async function ujianDariId(id: number): Promise<Ujian | null> {
  const baris = await db.select().from(cbtExams).where(eq(cbtExams.id, id)).limit(1);
  return baris[0] ?? null;
}

/** Urai satu baris soal menjadi bentuk yang dipakai mesin penilai. */
export function bacaSoal(row: typeof cbtQuestions.$inferSelect): Soal {
  let pilihan: string[] = [];
  try {
    const isi = JSON.parse(row.options || "[]");
    if (Array.isArray(isi)) pilihan = isi.map((p) => String(p ?? ""));
  } catch {
    // Pilihan yang rusak dibaca sebagai kosong; soalnya tetap tampil supaya
    // dosen dapat melihat dan memperbaikinya, bukan hilang tanpa jejak.
  }
  const tingkat = row.difficulty === "mudah" || row.difficulty === "sulit" ? row.difficulty : "sedang";
  return {
    id: row.id,
    jenis: (row.type as JenisSoal) || "pg",
    pertanyaan: row.question,
    pilihan,
    kunci: row.answerKey || "",
    bobot: row.points || 1,
    materi: row.material || "",
    tingkat,
    pembahasan: row.explanation || "",
  };
}

export async function soalUjian(examId: number): Promise<Soal[]> {
  const baris = await db
    .select()
    .from(cbtQuestions)
    .where(eq(cbtQuestions.examId, examId))
    .orderBy(asc(cbtQuestions.sortOrder), asc(cbtQuestions.id));
  return baris.map(bacaSoal);
}

export async function attemptDariKunci(kunci: string): Promise<Attempt | null> {
  if (!kunci || kunci.length < 16) return null;
  const baris = await db.select().from(cbtAttempts).where(eq(cbtAttempts.sessionKey, kunci)).limit(1);
  return baris[0] ?? null;
}

export async function jawabanAttempt(attemptId: number) {
  return db.select().from(cbtAnswers).where(eq(cbtAnswers.attemptId, attemptId));
}

export async function attemptMahasiswa(examId: number, nim: string) {
  return db
    .select()
    .from(cbtAttempts)
    .where(and(eq(cbtAttempts.examId, examId), eq(cbtAttempts.nim, nim)))
    .orderBy(asc(cbtAttempts.attemptNo));
}

/** Lembar soal yang tersimpan pada attempt: id soal + peta pilihannya. */
export type Lembar = Array<{ id: number; peta: number[] }>;

export function bacaLembar(paper: string): Lembar {
  try {
    const isi = JSON.parse(paper || "[]");
    if (!Array.isArray(isi)) return [];
    return isi
      .map((item) => ({
        id: Number((item as { id?: unknown }).id),
        peta: Array.isArray((item as { peta?: unknown }).peta)
          ? ((item as { peta: unknown[] }).peta.map(Number).filter(Number.isInteger) as number[])
          : [],
      }))
      .filter((item) => Number.isInteger(item.id));
  } catch {
    return [];
  }
}
