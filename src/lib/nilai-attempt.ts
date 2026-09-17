// ============================================================
// MENGHITUNG ULANG NILAI SATU ATTEMPT
//
// Satu fungsi, dipakai oleh tiga jalur yang semuanya dapat mengubah nilai:
// koreksi essay manual, penilaian rubrik oleh model, dan perubahan level oleh
// dosen.
//
// Alasannya satu dan tidak berubah: TIGA TEMPAT YANG MENGHITUNG NILAI AKAN
// MENGHASILKAN TIGA NILAI. Bukan mungkin — pasti, dan tidak segera. Yang
// pertama membulatkan ke atas, yang kedua ke bawah, yang ketiga lupa
// menghitung soal yang benar sebagian. Lalu dosen membuka lembar yang sama
// dari dua tempat berbeda dan melihat dua angka, dan sejak saat itu tidak ada
// lagi yang dapat dipercaya tanpa dihitung tangan.
//
// SELALU DARI NOL. Nilai tidak pernah ditambahkan pada yang sudah ada:
// mengoreksi satu jawaban dua kali akan melipatgandakan poinnya, dan
// ketahuannya sesudah nilai keluar.
// ============================================================

import { db } from "@/db";
import { cbtAnswers, cbtAttempts } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { bacaLembar, soalUjian } from "@/lib/cbt-store";
import type { Soal } from "@/lib/cbt";

export type NilaiUlang = {
  nilai: number;
  poin: number;
  poinMaks: number;
  benar: number;
  salah: number;
  sebagian: number;
  tertunda: number;
  kosong: number;
};

/**
 * Hitung ulang seluruh nilai satu attempt dari isi tabel jawaban, lalu simpan.
 *
 * Yang dibaca adalah POIN yang sudah tersimpan pada tiap jawaban — bukan
 * jawabannya dinilai ulang dari kunci. Itu disengaja: poin soal objektif sudah
 * benar sejak pengumpulan, dan poin esai adalah hasil keputusan yang tidak
 * dapat disimpulkan ulang dari mana pun (rubrik yang sudah disunting, angka
 * yang diketik dosen). Menilai ulang dari kunci akan menghapus keduanya.
 */
export async function hitungUlangAttempt(attemptId: number): Promise<NilaiUlang | null> {
  const baris = await db.select().from(cbtAttempts).where(eq(cbtAttempts.id, attemptId)).limit(1);
  const attempt = baris[0];
  if (!attempt) return null;

  const bank = await soalUjian(attempt.examId);
  const lembar = bacaLembar(attempt.paper);
  // Yang dihitung hanya soal yang BENAR-BENAR keluar pada lembar peserta ini.
  // Bank soal berisi lebih banyak daripada yang dikerjakan — itu memang cara
  // paket acak bekerja — dan menghitung seluruh bank sebagai penyebut membuat
  // nilai peserta yang mengerjakan dua puluh dari lima puluh soal tidak pernah
  // melewati empat puluh.
  const dipakai = lembar
    .map((l) => bank.find((s) => s.id === l.id))
    .filter((s): s is Soal => Boolean(s));

  const jawaban = await db
    .select()
    .from(cbtAnswers)
    .where(eq(cbtAnswers.attemptId, attemptId))
    .orderBy(asc(cbtAnswers.questionId));
  const peta = new Map(jawaban.map((j) => [j.questionId, j]));

  let poin = 0;
  let poinMaks = 0;
  let benar = 0;
  let salah = 0;
  let sebagian = 0;
  let tertunda = 0;
  let kosong = 0;

  for (const soal of dipakai) {
    poinMaks += soal.bobot;
    const j = peta.get(soal.id);
    const isi = String(j?.answer ?? "").trim();

    if (!isi) { kosong += 1; continue; }

    const dapat = j?.points ?? 0;
    poin += dapat;

    if (j?.isCorrect === null || j?.isCorrect === undefined) {
      // Essay yang belum disentuh siapa pun. Bukan salah — belum dibaca.
      tertunda += 1;
    } else if (j.isCorrect) {
      benar += 1;
    } else if (dapat > 0) {
      sebagian += 1;
    } else {
      salah += 1;
    }
  }

  const nilai = poinMaks > 0 ? Math.round((poin / poinMaks) * 100) : 0;

  await db
    .update(cbtAttempts)
    .set({ score: nilai, correct: benar, wrong: salah, partial: sebagian, pending: tertunda, blank: kosong })
    .where(eq(cbtAttempts.id, attemptId));

  return {
    nilai,
    poin: Math.round(poin * 100) / 100,
    poinMaks,
    benar,
    salah,
    sebagian,
    tertunda,
    kosong,
  };
}
