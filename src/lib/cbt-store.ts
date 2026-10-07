// ============================================================
// CBT — pembacaan basis data yang dipakai bersama beberapa route
// ============================================================
import { db } from "@/db";
import {
  cbtAnswers, cbtAttempts, cbtCourseRubrics, cbtExams, cbtQuestions, cbtRecordings,
  cbtRubrics, cbtRubricScores, students,
} from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import type { JenisMedia, JenisSoal, Pasangan, Soal } from "@/lib/cbt";
import { bacaKriteria, type Rubrik } from "@/lib/rubrik";
import { kunciMatkul } from "@/lib/penilaian-ai";

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
    // pengajar dapat melihat dan memperbaikinya, bukan hilang tanpa jejak.
  }
  // Pasangan penjodohan. Baris yang rusak dibuang satu per satu, bukan
  // menggugurkan seluruh soal: soal yang hilang dari bank jauh lebih sulit
  // ditelusuri pengajarnya daripada soal yang pasangannya kurang satu.
  let pasangan: Pasangan[] = [];
  try {
    const isi = JSON.parse(row.pairs || "[]");
    if (Array.isArray(isi)) {
      pasangan = isi
        .map((p) => ({ kiri: String((p as Pasangan)?.kiri ?? ""), kanan: Number((p as Pasangan)?.kanan) }))
        .filter((p) => p.kiri !== "" && Number.isInteger(p.kanan) && p.kanan >= 0 && p.kanan < pilihan.length);
    }
  } catch {
    // Sama seperti pilihan: dibaca kosong, soalnya tetap tampil.
  }

  const tingkat = row.difficulty === "mudah" || row.difficulty === "sulit" ? row.difficulty : "sedang";
  const jenisMedia = (row.mediaType || "") as JenisMedia;
  return {
    id: row.id,
    jenis: (row.type as JenisSoal) || "pg",
    pertanyaan: row.question,
    pilihan,
    kunci: row.answerKey || "",
    pasangan,
    media: {
      // Media tanpa tautan bukan media. Menyimpan jenisnya saja membuat layar
      // peserta menyediakan kotak gambar yang selamanya kosong.
      jenis: row.mediaUrl && (jenisMedia === "gambar" || jenisMedia === "video") ? jenisMedia : "",
      url: row.mediaUrl || "",
      keterangan: row.mediaCaption || "",
    },
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

export async function attemptPeserta(examId: number, nim: string) {
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

// ============================================================
// CBT V1 — PEMBACAAN TAMBAHAN
// ============================================================

/**
 * Baris daftar mahasiswa yang nomornya sama, bila ada.
 *
 * Mengembalikan null — bukan melempar — ketika daftarnya kosong atau nomornya
 * tidak ada di sana. Portal yang belum mengimpor satu mahasiswa pun harus
 * tetap menjalankan ujiannya, dan tidak seorang pun boleh tertolak masuk
 * karena namanya belum sempat didaftarkan bagian akademik.
 */
export async function mahasiswaDariNim(nim: string): Promise<{ id: number; email: string | null } | null> {
  const bersih = String(nim ?? "").replace(/\D/g, "").slice(0, 20);
  if (!bersih) return null;
  try {
    const baris = await db
      .select({ id: students.id, email: students.email })
      .from(students)
      .where(eq(students.nim, bersih))
      .limit(1);
    return baris[0] ?? null;
  } catch {
    // Tabelnya belum ada karena migrasinya belum dijalankan. Ujian tetap
    // berjalan; yang hilang hanya pengisian email otomatis.
    return null;
  }
}

export type RubrikBaris = typeof cbtRubrics.$inferSelect;

/** Rubrik satu mata uji beserta siapa yang memasangnya. */
export type RubrikMatkul = Rubrik & { id: number; diaturOleh: string };

/**
 * Rubrik yang berlaku untuk mata uji ini, atau null.
 *
 * Satu mata uji, satu rubrik: inilah satu-satunya tempat rubrik sebuah
 * ujian dicari, dan yang dicari adalah NAMA MATA UJINYA, bukan ujiannya.
 * Ujian yang dibuat sebelum rubriknya dipasang karena itu ikut memakainya
 * tanpa disentuh satu per satu.
 *
 * Tabelnya bisa saja belum ada karena migrasi v49 belum dijalankan. Yang
 * terjadi kemudian adalah esai tidak dinilai otomatis dan papan pantau
 * mengatakannya, bukan seluruh panel CBT menolak terbuka.
 */
export async function rubrikMatkul(courseName: string | null | undefined): Promise<RubrikMatkul | null> {
  const kunci = kunciMatkul(courseName);
  if (!kunci) return null;
  try {
    const baris = await db
      .select({ rubrik: cbtRubrics, diaturOleh: cbtCourseRubrics.setBy })
      .from(cbtCourseRubrics)
      .innerJoin(cbtRubrics, eq(cbtRubrics.id, cbtCourseRubrics.rubricId))
      .where(eq(cbtCourseRubrics.courseKey, kunci))
      .limit(1);
    const r = baris[0]?.rubrik;
    if (!r) return null;
    return {
      id: r.id,
      nama: r.name,
      keterangan: r.description || "",
      skalaMin: r.scaleMin,
      skalaMax: r.scaleMax,
      kriteria: bacaKriteria(r.criteria),
      diaturOleh: baris[0].diaturOleh,
    };
  } catch {
    return null;
  }
}

/** Rubrik yang dipakai menilai esai satu ujian: rubrik mata ujinya. */
export async function rubrikUjian(ujian: { courseName: string }): Promise<RubrikMatkul | null> {
  return rubrikMatkul(ujian.courseName);
}

/** Satu baris rubrik mata uji, untuk daftar dan pemilih di layar. */
export type RubrikMatkulRingkas = {
  kunci: string;
  mataKuliah: string;
  rubrikId: number;
  rubrikNama: string;
  jumlahKriteria: number;
  diaturOleh: string;
  diubah: string;
};

/**
 * Seluruh rubrik mata uji, atau null bila tabelnya belum ada.
 *
 * Null dan daftar kosong sengaja dibedakan. Daftar kosong berarti belum ada
 * mata uji yang dipasangi rubrik; null berarti SQL v49 belum dijalankan,
 * dan layar pengajar harus mengatakan itu, bukan menawarkan pemilih yang
 * pilihannya tidak akan pernah tersimpan.
 */
export async function daftarRubrikMatkul(): Promise<RubrikMatkulRingkas[] | null> {
  try {
    const baris = await db
      .select({
        kunci: cbtCourseRubrics.courseKey,
        mataKuliah: cbtCourseRubrics.courseName,
        rubrikId: cbtCourseRubrics.rubricId,
        diaturOleh: cbtCourseRubrics.setBy,
        diubah: cbtCourseRubrics.updatedAt,
        rubrikNama: cbtRubrics.name,
        kriteria: cbtRubrics.criteria,
      })
      .from(cbtCourseRubrics)
      .innerJoin(cbtRubrics, eq(cbtRubrics.id, cbtCourseRubrics.rubricId))
      .orderBy(asc(cbtCourseRubrics.courseName));
    return baris.map((b) => ({
      kunci: b.kunci,
      mataKuliah: b.mataKuliah,
      rubrikId: b.rubrikId,
      rubrikNama: b.rubrikNama,
      jumlahKriteria: bacaKriteria(b.kriteria).length,
      diaturOleh: b.diaturOleh,
      diubah: b.diubah.toISOString(),
    }));
  } catch {
    return null;
  }
}

/**
 * Pasang, ganti, atau lepas rubrik satu mata uji.
 *
 * `rubrikId` null melepasnya: esai seluruh ujian mata uji itu berhenti
 * dinilai AI sampai rubrik dipasang lagi. Skor yang sudah tersimpan tidak
 * ikut terhapus, sama seperti ketika rubrik sebuah ujian diganti dahulu.
 *
 * Yang memeriksa siapa boleh memanggilnya adalah jalur API. Di sini hanya
 * penulisannya, supaya pengaturan ujian dan menu rubrik menulis dengan cara
 * yang sama persis.
 */
export async function pasangRubrikMatkul(
  courseName: string,
  rubrikId: number | null,
  oleh: string,
): Promise<{ ok: true } | { ok: false; pesan: string }> {
  const kunci = kunciMatkul(courseName);
  if (!kunci) return { ok: false, pesan: "Nama mata uji belum diisi." };

  if (rubrikId === null) {
    await db.delete(cbtCourseRubrics).where(eq(cbtCourseRubrics.courseKey, kunci));
    return { ok: true };
  }

  const ada = await db
    .select({ id: cbtRubrics.id, kriteria: cbtRubrics.criteria })
    .from(cbtRubrics)
    .where(eq(cbtRubrics.id, rubrikId))
    .limit(1);
  if (!ada[0]) return { ok: false, pesan: "Rubrik tidak ditemukan." };
  if (bacaKriteria(ada[0].kriteria).length === 0) {
    return { ok: false, pesan: "Rubrik itu belum punya kriteria, jadi belum dapat dipakai menilai." };
  }

  const sekarang = new Date();
  await db
    .insert(cbtCourseRubrics)
    .values({
      courseKey: kunci,
      courseName: String(courseName).replace(/\s+/g, " ").trim().slice(0, 120),
      rubricId: rubrikId,
      setBy: oleh.slice(0, 120),
      updatedAt: sekarang,
    })
    .onConflictDoUpdate({
      target: cbtCourseRubrics.courseKey,
      set: {
        courseName: sql`excluded.course_name`,
        rubricId: sql`excluded.rubric_id`,
        setBy: sql`excluded.set_by`,
        updatedAt: sekarang,
      },
    });
  return { ok: true };
}

/** Skor rubrik satu attempt, dikelompokkan per soal lalu per urutan kriteria. */
export async function skorRubrikAttempt(attemptId: number) {
  const baris = await db
    .select()
    .from(cbtRubricScores)
    .where(eq(cbtRubricScores.attemptId, attemptId))
    .orderBy(asc(cbtRubricScores.questionId), asc(cbtRubricScores.criterionIndex));
  const peta = new Map<number, typeof baris>();
  for (const b of baris) {
    const daftar = peta.get(b.questionId);
    if (daftar) daftar.push(b);
    else peta.set(b.questionId, [b]);
  }
  return peta;
}

/** Baris rekaman satu attempt, atau null bila ujiannya tidak merekam. */
export async function rekamanAttempt(attemptId: number) {
  try {
    const baris = await db
      .select()
      .from(cbtRecordings)
      .where(eq(cbtRecordings.attemptId, attemptId))
      .limit(1);
    return baris[0] ?? null;
  } catch {
    return null;
  }
}
