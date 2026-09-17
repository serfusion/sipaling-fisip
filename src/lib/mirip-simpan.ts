// ============================================================
// KEMIRIPAN JAWABAN — SISI BASIS DATA
//
// Aturan perbandingannya murni dan ada di src/lib/mirip-jawaban.ts. Berkas ini
// hanya menjalankannya terhadap isi tabel, lalu menyimpan hasilnya.
//
// ------------------------------------------------------------
// KAPAN IA BERJALAN
// ------------------------------------------------------------
// Segera sesudah satu peserta mengumpulkan, DI DALAM permintaan yang sama.
// Tidak ada antrean, tidak ada pekerja latar belakang, tidak ada Redis.
//
// Itu keputusan yang layak diterangkan, karena rancangan awal memintanya
// sebagai pekerjaan latar. Yang dikerjakan di sini adalah perbandingan teks
// tanpa satu pun panggilan model: tiga puluh peserta pada sepuluh soal esai
// selesai dalam hitungan milidetik. Antrean beserta pekerjanya akan menambah
// satu layanan yang harus dipasang, dijaga, dan dibayar — demi menunda
// pekerjaan yang lebih cepat daripada satu perjalanan ke basis data.
//
// Yang MEMANG berat — transkrip rekaman dan penilaian esai oleh model —
// dijalankan atas permintaan dosen, bukan pada saat pengumpulan. Jalannya
// berbeda karena biayanya berbeda.
//
// ------------------------------------------------------------
// SATU HAL YANG PERLU DIKETAHUI TENTANG ANGKANYA
// ------------------------------------------------------------
// Pembobotan kata memakai seberapa sering kata itu muncul di SELURUH jawaban
// yang sudah masuk. Artinya angka satu pasangan dapat bergeser sedikit ketika
// peserta berikutnya mengumpulkan — kata yang tadinya langka menjadi umum.
// Pergeserannya kecil dan arahnya benar (kemiripan menjadi lebih jujur seiring
// pembandingnya bertambah), tetapi ia ada.
//
// Karena itu ada `hitungUlangUjian`: sesudah seluruh kelas mengumpulkan, dosen
// dapat meminta seluruhnya dihitung ulang sekaligus, dan yang keluar adalah
// angka yang dihitung dari korpus yang sama untuk semua orang. Itu angka yang
// dipakai pada laporan.
// ============================================================

import { db } from "@/db";
import { cbtAnswers, cbtAttempts, cbtQuestions, cbtSimilarity } from "@/db/schema";
import { and, eq, inArray, ne, or } from "drizzle-orm";
import {
  AMBANG_BAWAAN, MIN_KATA, bandingkanSoal, kataDari, rapikanAmbang, ringkasPerPeserta,
  statusMirip, type Ambang, type PasanganMirip,
} from "@/lib/mirip-jawaban";

/**
 * Jenis soal yang jawabannya berupa teks bebas.
 *
 * Pilihan ganda tidak ikut, dan itu bukan kelalaian: tiga puluh peserta yang
 * menjawab "B" pada soal yang jawabannya memang B akan mirip seratus persen
 * satu sama lain. Menandainya sebagai indikasi kecurangan bukan hanya keliru —
 * ia membuat kolom kemiripan penuh derau sampai dosen berhenti membacanya.
 */
const JENIS_TEKS = ["essay", "isian"];

/** Paling banyak berapa peserta yang ikut dibandingkan sekali jalan. */
const MAKS_PESERTA = 400;

type Ujian = {
  id: number;
  checkSimilarity: boolean;
  similarityReview: number;
  similarityHigh: number;
};

export function ambangUjian(ujian: Ujian): Ambang {
  return rapikanAmbang({ tinjau: ujian.similarityReview, tinggi: ujian.similarityHigh });
}

/** Soal yang jawabannya layak dibandingkan pada satu ujian. */
async function soalTeks(examId: number): Promise<number[]> {
  const baris = await db
    .select({ id: cbtQuestions.id })
    .from(cbtQuestions)
    .where(and(eq(cbtQuestions.examId, examId), inArray(cbtQuestions.type, JENIS_TEKS)));
  return baris.map((b) => b.id);
}

/**
 * Attempt yang sudah dikumpulkan pada ujian ini.
 *
 * Yang masih berjalan sengaja tidak ikut. Jawaban setengah jadi berubah tiap
 * sepuluh detik oleh auto-save, dan kemiripan yang dihitung darinya akan
 * berubah-ubah tanpa sebab yang dapat diterangkan kepada siapa pun.
 */
async function attemptSelesai(examId: number): Promise<number[]> {
  const baris = await db
    .select({ id: cbtAttempts.id })
    .from(cbtAttempts)
    .where(and(eq(cbtAttempts.examId, examId), ne(cbtAttempts.status, "berjalan")))
    .limit(MAKS_PESERTA);
  return baris.map((b) => b.id);
}

async function simpanPasangan(
  examId: number,
  questionId: number,
  pasangan: PasanganMirip[],
  sekarang: Date,
) {
  for (const p of pasangan) {
    await db
      .insert(cbtSimilarity)
      .values({
        examId,
        questionId,
        attemptA: p.a,
        attemptB: p.b,
        score: p.skor,
        status: p.status,
        signals: JSON.stringify(p.sinyal),
        createdAt: sekarang,
      })
      .onConflictDoUpdate({
        target: [cbtSimilarity.questionId, cbtSimilarity.attemptA, cbtSimilarity.attemptB],
        set: {
          score: p.skor,
          status: p.status,
          signals: JSON.stringify(p.sinyal),
          createdAt: sekarang,
        },
      });
  }
}

/**
 * Perbarui ringkasan kemiripan pada baris attempt.
 *
 * Diambil dari SELURUH pasangan yang tersimpan untuk attempt itu, bukan hanya
 * dari yang baru dihitung. Attempt yang kemiripan tertingginya berasal dari
 * soal lain tidak boleh kehilangan angkanya hanya karena soal yang barusan
 * dihitung bersih.
 */
async function perbaruiRingkasan(attemptIds: number[], ambang: Ambang) {
  if (attemptIds.length === 0) return;
  const baris = await db
    .select({
      a: cbtSimilarity.attemptA,
      b: cbtSimilarity.attemptB,
      skor: cbtSimilarity.score,
    })
    .from(cbtSimilarity)
    .where(or(inArray(cbtSimilarity.attemptA, attemptIds), inArray(cbtSimilarity.attemptB, attemptIds)));

  const tertinggi = new Map<number, number>();
  for (const b of baris) {
    for (const siapa of [b.a, b.b]) {
      if (!attemptIds.includes(siapa)) continue;
      if ((tertinggi.get(siapa) ?? -1) < b.skor) tertinggi.set(siapa, b.skor);
    }
  }

  for (const id of attemptIds) {
    const skor = tertinggi.get(id) ?? 0;
    await db
      .update(cbtAttempts)
      .set({ similarityScore: skor, similarityStatus: statusMirip(skor, ambang) })
      .where(eq(cbtAttempts.id, id));
  }
}

/**
 * Bandingkan jawaban satu peserta dengan seluruh peserta lain yang sudah
 * mengumpulkan.
 *
 * Dipanggil sesudah pengumpulan, dan SELALU dibungkus penangkap galat oleh
 * pemanggilnya: pemeriksaan kemiripan yang gagal tidak boleh menggagalkan
 * pengumpulan. Yang dipertaruhkan pengumpulan adalah jawaban seseorang; yang
 * dipertaruhkan pemeriksaan ini hanya satu kolom pada papan pantau.
 */
export async function periksaKemiripan(ujian: Ujian, attemptId: number): Promise<number> {
  if (!ujian.checkSimilarity) return 0;

  const soal = await soalTeks(ujian.id);
  if (soal.length === 0) return 0;

  const peserta = await attemptSelesai(ujian.id);
  if (peserta.length < 2) return 0;

  const ambang = ambangUjian(ujian);
  const sekarang = new Date();
  const tersentuh = new Set<number>([attemptId]);
  let jumlah = 0;

  for (const questionId of soal) {
    const jawaban = await db
      .select({ attemptId: cbtAnswers.attemptId, teks: cbtAnswers.answer })
      .from(cbtAnswers)
      .where(and(eq(cbtAnswers.questionId, questionId), inArray(cbtAnswers.attemptId, peserta)));

    // Jawaban peserta ini sendiri harus ada dan cukup panjang, kalau tidak
    // tidak ada yang perlu dibandingkan pada soal ini.
    const punyaDia = jawaban.find((j) => j.attemptId === attemptId);
    if (!punyaDia || kataDari(punyaDia.teks).length < MIN_KATA) continue;

    const semua = bandingkanSoal(
      jawaban.map((j) => ({ attemptId: j.attemptId, teks: j.teks })),
      ambang,
    );
    // Hanya pasangan yang MELIBATKAN peserta ini yang ditulis ulang. Pasangan
    // antara dua peserta lain sudah dihitung ketika salah satunya mengumpulkan,
    // dan menulis ulang seluruhnya tiap kali ada yang selesai menjadikan
    // pengumpulan terakhir di kelas sebagai yang paling lambat.
    const miliknya = semua.filter((p) => p.a === attemptId || p.b === attemptId);
    if (miliknya.length === 0) continue;

    await simpanPasangan(ujian.id, questionId, miliknya, sekarang);
    jumlah += miliknya.length;
    for (const p of miliknya) { tersentuh.add(p.a); tersentuh.add(p.b); }
  }

  await perbaruiRingkasan([...tersentuh], ambang);
  return jumlah;
}

/**
 * Hitung ulang SELURUH kemiripan satu ujian dari nol.
 *
 * Dipakai dosen sesudah kelasnya selesai mengumpulkan, dan inilah angka yang
 * layak masuk laporan: seluruh pasangan dihitung dari korpus yang sama, jadi
 * dua peserta yang mengumpulkan pertama dan terakhir dinilai dengan ukuran
 * yang sama persis.
 */
export async function hitungUlangUjian(ujian: Ujian): Promise<{ pasangan: number; peserta: number }> {
  const soal = await soalTeks(ujian.id);
  const peserta = await attemptSelesai(ujian.id);
  const ambang = ambangUjian(ujian);

  // Dibersihkan lebih dulu. Tanpa ini, pasangan yang skornya turun di bawah
  // ambang pada hitungan baru akan tertinggal di tabel dengan angka lamanya —
  // dan angka lama itulah yang dibaca dosen, tanpa satu pun tanda bahwa ia
  // sudah tidak berlaku.
  await db.delete(cbtSimilarity).where(eq(cbtSimilarity.examId, ujian.id));

  if (!ujian.checkSimilarity || soal.length === 0 || peserta.length < 2) {
    if (peserta.length > 0) {
      await db
        .update(cbtAttempts)
        .set({ similarityScore: 0, similarityStatus: "bersih" })
        .where(eq(cbtAttempts.examId, ujian.id));
    }
    return { pasangan: 0, peserta: peserta.length };
  }

  const sekarang = new Date();
  const semua: PasanganMirip[] = [];

  for (const questionId of soal) {
    const jawaban = await db
      .select({ attemptId: cbtAnswers.attemptId, teks: cbtAnswers.answer })
      .from(cbtAnswers)
      .where(and(eq(cbtAnswers.questionId, questionId), inArray(cbtAnswers.attemptId, peserta)));

    const pasangan = bandingkanSoal(
      jawaban.map((j) => ({ attemptId: j.attemptId, teks: j.teks })),
      ambang,
    );
    if (pasangan.length === 0) continue;
    await simpanPasangan(ujian.id, questionId, pasangan, sekarang);
    semua.push(...pasangan);
  }

  // Ringkasannya dihitung dari hasil di memori, bukan dibaca ulang dari tabel:
  // seluruhnya baru saja ditulis dari sini, dan satu perjalanan lagi ke basis
  // data hanya akan menjawab hal yang sudah diketahui.
  const ringkas = ringkasPerPeserta(semua, ambang);
  for (const id of peserta) {
    const punya = ringkas.get(id);
    await db
      .update(cbtAttempts)
      .set({
        similarityScore: punya?.skor ?? 0,
        similarityStatus: punya?.status ?? "bersih",
      })
      .where(eq(cbtAttempts.id, id));
  }

  return { pasangan: semua.length, peserta: peserta.length };
}

export type PasanganTampil = {
  questionId: number;
  skor: number;
  status: string;
  lawanId: number;
  lawanNama: string;
  lawanNim: string;
  sinyal: unknown;
};

/**
 * Pasangan mirip milik satu peserta, beserta nama lawannya.
 *
 * Nama lawan ikut karena tanpanya dosen memegang nomor attempt — angka yang
 * tidak berarti apa pun baginya, dan yang harus ia cari sendiri satu per satu
 * pada papan pantau.
 */
export async function pasanganPeserta(attemptId: number): Promise<PasanganTampil[]> {
  const baris = await db
    .select()
    .from(cbtSimilarity)
    .where(or(eq(cbtSimilarity.attemptA, attemptId), eq(cbtSimilarity.attemptB, attemptId)))
    .limit(100);
  if (baris.length === 0) return [];

  const lawanIds = [...new Set(baris.map((b) => (b.attemptA === attemptId ? b.attemptB : b.attemptA)))];
  const lawan = await db
    .select({ id: cbtAttempts.id, nama: cbtAttempts.name, nim: cbtAttempts.nim })
    .from(cbtAttempts)
    .where(inArray(cbtAttempts.id, lawanIds));
  const peta = new Map(lawan.map((l) => [l.id, l]));

  return baris
    .map((b) => {
      const lawanId = b.attemptA === attemptId ? b.attemptB : b.attemptA;
      const orang = peta.get(lawanId);
      let sinyal: unknown = {};
      try { sinyal = JSON.parse(b.signals || "{}"); } catch { sinyal = {}; }
      return {
        questionId: b.questionId,
        skor: b.score,
        status: b.status,
        lawanId,
        lawanNama: orang?.nama ?? "(peserta terhapus)",
        lawanNim: orang?.nim ?? "",
        sinyal,
      };
    })
    .sort((a, b) => b.skor - a.skor);
}

export { AMBANG_BAWAAN };
