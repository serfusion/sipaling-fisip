// ============================================================
// PENILAIAN OTOMATIS BERBASIS RUBRIK
//
// Dipisahkan dari /api/cbt/penilaian supaya dua pemanggil memakai jalan yang
// sama persis: tombol "Nilai dengan AI" yang ditekan pengajar, dan penilaian
// yang berjalan SENDIRI begitu ada jawaban yang menunggu.
//
// ------------------------------------------------------------
// KENAPA IA TIDAK BERJALAN DI DALAM PERMINTAAN "KUMPULKAN"
// ------------------------------------------------------------
// Tempat yang paling masuk akal untuk menaruhnya — tepat sesudah nilai
// dihitung di nilaiDanTutup() — justru tempat yang paling berbahaya.
// Pemeriksaan kemiripan boleh di sana karena ia berjalan di dalam server,
// tanpa jaringan, dalam hitungan milidetik. Penilaian rubrik memanggil model
// lewat internet, satu panggilan per jawaban esai, masing-masing beberapa
// detik. Ujian berisi lima soal esai akan menahan tombol "kumpulkan" selama
// setengah menit, dan v45 baru saja memperbaiki 504 pada jalur penyerahan.
//
// Peserta yang melihat "gagal mengumpulkan" akan menekan tombolnya lagi, atau
// mengira jawabannya hilang. Itu harga yang tidak sebanding dengan menghemat
// satu putaran.
//
// Karena itu urutannya: kumpulkan → nilai objektif + kemiripan (seketika) →
// penilaian rubrik menyusul, dijalankan papan pantau pengajar yang memang
// sudah menyegar tiap sepuluh detik. Dari kursi pengajar hasilnya sama —
// nilainya sudah ada tanpa ia mengoreksi apa pun — tanpa satu detik pun
// ditambahkan ke jalur yang dilewati peserta.
// ============================================================

import { db } from "@/db";
import { cbtAnswers, cbtAttempts, cbtRubricScores } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { bacaLembar, skorRubrikAttempt, soalUjian } from "@/lib/cbt-store";
import { hitungRubrik, poinDariRubrik, type Rubrik } from "@/lib/rubrik";
import { GalatModel } from "@/lib/ai-penyedia";
import { nilaiEsai } from "@/lib/nilai-esai";
import { kataDariTeks, nilaiLokal } from "@/lib/nilai-lokal";
import { hitungUlangAttempt } from "@/lib/nilai-attempt";

/**
 * Berapa jawaban dinilai dalam satu panggilan.
 *
 * Batasnya ada karena satu permintaan HTTP punya umur. Sisanya dikerjakan
 * panggilan berikutnya, dan pemanggilnya diberi tahu berapa yang tersisa.
 */
export const MAKS_SEKALI_NILAI = 12;

export type Pekerjaan = {
  attemptId: number;
  nama: string;
  soalId: number;
  bobot: number;
  pertanyaan: string;
  acuan: string;
  jawaban: string;
};

/**
 * Jumlah kata jawaban peserta lain, per soal.
 *
 * Dipakai penilaian tanpa model: panjang yang "cukup" tidak sama antara soal
 * yang minta definisi dan soal yang minta analisis kasus, jadi yang dipakai
 * kedudukan jawaban ini di antara jawaban sekelas pada soal yang SAMA.
 */
export type PembandingSoal = Map<number, number[]>;

/**
 * Jenis soal yang dinilai rubrik.
 *
 * Esai: selalu — ia memang tidak punya kunci.
 *
 * Isian singkat: HANYA bila soalnya tidak punya kunci. Isian yang berkunci
 * sudah dinilai tepat oleh pencocokan teks, gratis dan tanpa salah baca;
 * menyerahkannya ke model berarti membayar untuk jawaban yang lebih buruk.
 * Yang tidak berkunci tidak punya penilai lain sama sekali — itulah yang
 * dimaksud "isian singkat dinilai otomatis".
 */
function dinilaiRubrik(soal: { jenis: string; kunci?: string }): boolean {
  if (soal.jenis === "essay") return true;
  if (soal.jenis === "isian") return String(soal.kunci ?? "").trim() === "";
  return false;
}

/**
 * Susun daftar jawaban yang menunggu dinilai.
 *
 * Disusun lengkap lebih dulu, baru dipotong sesuai batas — dengan begitu
 * pemanggilnya dapat mengatakan berapa yang TERSISA, bukan menyuruh menekan
 * berulang sampai entah kapan.
 */
export async function antreEsai(
  examId: number,
  peserta: Array<typeof cbtAttempts.$inferSelect>,
  ulangi = false,
): Promise<Pekerjaan[]> {
  const bank = await soalUjian(examId);
  const antre: Pekerjaan[] = [];

  for (const p of peserta) {
    // Yang MASIH mengerjakan tidak pernah ikut: menilai jawaban setengah jadi
    // menghabiskan biaya pada teks yang akan berubah, dan meninggalkan nilai
    // yang terlihat final pada lembar yang belum selesai.
    if (p.status === "berjalan") continue;

    const lembar = bacaLembar(p.paper);
    const jawaban = await db.select().from(cbtAnswers).where(eq(cbtAnswers.attemptId, p.id));
    const petaJawab = new Map(jawaban.map((j) => [j.questionId, j]));
    const sudah = await skorRubrikAttempt(p.id);

    for (const l of lembar) {
      const soal = bank.find((s) => s.id === l.id);
      if (!soal || !dinilaiRubrik(soal)) continue;

      const isi = String(petaJawab.get(soal.id)?.answer ?? "").trim();
      // Jawaban kosong tidak dikirim ke model. Ia tidak memerlukan pembacaan
      // siapa pun, dan membayar model untuk menyimpulkan bahwa tidak ada
      // apa-apa di sana adalah pemborosan yang berulang seratus kali pada
      // kelas yang separuhnya tidak menjawab esai.
      if (!isi) continue;
      if (!ulangi && (sudah.get(soal.id)?.length ?? 0) > 0) continue;

      antre.push({
        attemptId: p.id,
        nama: p.name,
        soalId: soal.id,
        bobot: soal.bobot,
        pertanyaan: soal.pertanyaan,
        acuan: soal.pembahasan || "",
        jawaban: isi,
      });
    }
  }

  return antre;
}

/**
 * Susun pembanding panjang per soal dari seluruh jawaban yang sudah masuk.
 *
 * Diambil dari SEMUA peserta yang mengumpulkan, bukan hanya yang sedang
 * diantre: yang sudah dinilai kemarin tetap pembanding yang sah, dan tanpa
 * mereka peserta pertama pada tiap penyegaran hanya punya dirinya sendiri.
 */
export async function pembandingPanjang(
  peserta: Array<typeof cbtAttempts.$inferSelect>,
): Promise<PembandingSoal> {
  const peta: PembandingSoal = new Map();
  for (const p of peserta) {
    if (p.status === "berjalan") continue;
    const jawaban = await db.select().from(cbtAnswers).where(eq(cbtAnswers.attemptId, p.id));
    for (const j of jawaban) {
      const isi = String(j.answer ?? "").trim();
      if (!isi) continue;
      const daftar = peta.get(j.questionId) ?? [];
      daftar.push(kataDariTeks(isi).length);
      peta.set(j.questionId, daftar);
    }
  }
  return peta;
}

/**
 * Hitung ulang poin satu jawaban dari level rubriknya, lalu simpan.
 *
 * Keputusan dosen yang sudah ada tidak pernah ditimpa: hitungRubrik memakai
 * finalLevel bila ada, dan aiLevel hanya bila belum ada.
 */
export async function simpanPoinRubrik(
  attemptId: number,
  questionId: number,
  bobotSoal: number,
  rubrik: Rubrik,
  penilai: string,
  catatan?: string | null,
) {
  const semua = await db
    .select()
    .from(cbtRubricScores)
    .where(and(eq(cbtRubricScores.attemptId, attemptId), eq(cbtRubricScores.questionId, questionId)));

  const urut = new Map(semua.map((s) => [s.criterionIndex, s]));
  const hasil = hitungRubrik(
    rubrik,
    rubrik.kriteria.map((_, i) => ({
      aiLevel: urut.get(i)?.aiLevel ?? null,
      finalLevel: urut.get(i)?.finalLevel ?? null,
    })),
  );

  const poin = poinDariRubrik(hasil.nilai, bobotSoal);
  const isi: Record<string, unknown> = {
    points: poin,
    // Belum lengkap berarti belum dinilai — isCorrect tetap null, dan jawaban
    // ini masih terhitung "menunggu koreksi" pada rekap. Menandainya sebagai
    // sudah dinilai ketika baru dua dari lima kriteria terisi membuat dosen
    // kehilangan daftar pekerjaan yang belum selesai.
    isCorrect: hasil.lengkap ? poin > 0 : null,
    gradedBy: penilai,
    updatedAt: new Date(),
  };
  if (typeof catatan === "string") isi.feedback = catatan.slice(0, 4000);

  await db
    .update(cbtAnswers)
    .set(isi)
    .where(and(eq(cbtAnswers.attemptId, attemptId), eq(cbtAnswers.questionId, questionId)));

  return hasil;
}

/**
 * Simpan usulan level satu jawaban, dari mana pun asalnya.
 *
 * Satu jalan tulis untuk dua penilai — model dan hitungan lokal — supaya
 * keduanya mendarat di kolom yang sama, dibaca lembar penilaian yang sama,
 * dan dapat ditimpa keputusan pengajar dengan cara yang sama.
 */
async function simpanUsulan(
  kerja: Pekerjaan,
  rubrik: Rubrik,
  usulan: Array<{ urut: number; level: number; alasan: string }>,
  keyakinan: number,
  penilai: string,
  catatan: string,
  sekarang: Date,
) {
  for (const k of usulan) {
    const nilaiKriteria = {
      criterionName: rubrik.kriteria[k.urut]?.nama ?? "",
      weight: rubrik.kriteria[k.urut]?.bobot ?? 0,
      aiLevel: k.level,
      aiReason: k.alasan,
      aiConfidence: keyakinan,
      updatedAt: sekarang,
    };
    await db
      .insert(cbtRubricScores)
      .values({
        attemptId: kerja.attemptId,
        questionId: kerja.soalId,
        criterionIndex: k.urut,
        ...nilaiKriteria,
      })
      // Keputusan pengajar yang sudah ada TIDAK dihapus oleh penilaian ulang.
      .onConflictDoUpdate({
        target: [cbtRubricScores.attemptId, cbtRubricScores.questionId, cbtRubricScores.criterionIndex],
        set: nilaiKriteria,
      });
  }
  await simpanPoinRubrik(kerja.attemptId, kerja.soalId, kerja.bobot, rubrik, penilai, catatan);
}

/**
 * Nilai antrean TANPA model: dari panjang, cakupan istilah, dan susunan.
 *
 * Inilah jalur bawaan penilaian otomatis. Ia tidak memanggil apa pun ke luar,
 * jadi ia berjalan pada portal yang tidak punya kunci API sama sekali, tidak
 * pernah gagal karena kuota, dan tidak menambah biaya per jawaban. Batasnya
 * ditulis terang di src/lib/nilai-lokal.ts: ia mengukur bentuk jawaban, bukan
 * kebenarannya.
 */
export async function kerjakanPenilaianLokal(
  rubrik: Rubrik,
  kerjakan: Pekerjaan[],
  pembanding: PembandingSoal,
): Promise<{ dinilai: number; gagal: string[] }> {
  const sekarang = new Date();
  let dinilai = 0;
  const gagal: string[] = [];

  for (const kerja of kerjakan) {
    try {
      // Jawaban peserta ini sendiri dikeluarkan dari pembandingnya. Tanpa itu
      // satu-satunya peserta yang sudah mengumpulkan selalu dibandingkan
      // dengan dirinya sendiri, dan selalu berada tepat di tengah.
      const semua = pembanding.get(kerja.soalId) ?? [];
      const sendiri = kataDariTeks(kerja.jawaban).length;
      const lain = [...semua];
      const posisi = lain.indexOf(sendiri);
      if (posisi >= 0) lain.splice(posisi, 1);

      const hasil = nilaiLokal({
        jawaban: kerja.jawaban,
        pertanyaan: kerja.pertanyaan,
        acuan: kerja.acuan,
        rubrik,
        pembandingKata: lain,
      });

      await simpanUsulan(
        kerja, rubrik, hasil.kriteria, hasil.keyakinan,
        "Otomatis (bentuk jawaban)", hasil.ringkasan, sekarang,
      );
      dinilai += 1;
    } catch (galat: unknown) {
      const sebab = galat instanceof Error ? galat.message : "gagal";
      gagal.push(`${kerja.nama}: ${sebab.slice(0, 120)}`);
      console.error("nilai lokal", kerja.attemptId, kerja.soalId, galat);
    }
  }

  for (const id of new Set(kerjakan.map((k) => k.attemptId))) {
    await hitungUlangAttempt(id);
  }

  return { dinilai, gagal };
}

/**
 * Kerjakan sebagian antrean: panggil model, simpan levelnya, hitung ulang.
 *
 * Satu jawaban yang gagal dinilai tidak menggagalkan sisanya. Kelas berisi
 * empat puluh peserta tidak boleh kehilangan tiga puluh sembilan penilaian
 * karena satu jawaban memuat sesuatu yang membuat model tersedak.
 */
export async function kerjakanPenilaian(
  rubrik: Rubrik,
  kerjakan: Pekerjaan[],
  mataKuliah: string,
): Promise<{ dinilai: number; gagal: string[] }> {
  const sekarang = new Date();
  let dinilai = 0;
  const gagal: string[] = [];

  for (const kerja of kerjakan) {
    try {
      const hasil = await nilaiEsai({
        rubrik,
        pertanyaan: kerja.pertanyaan,
        jawaban: kerja.jawaban,
        mataKuliah,
        acuan: kerja.acuan,
      });

      // Umpan balik yang dibaca peserta dirakit di SATU tempat, bukan disimpan
      // terpisah lalu dirakit ulang di panel dan sekali lagi di laporan cetak.
      const catatan = [
        hasil.ringkasan,
        hasil.saran.length > 0 ? `\n\nSaran perbaikan:\n${hasil.saran.map((s) => `• ${s}`).join("\n")}` : "",
        hasil.perluDosen ? `\n\n(Keyakinan penilaian awal ${hasil.keyakinan}%. Mohon diperiksa.)` : "",
      ].join("");

      await simpanUsulan(
        kerja, rubrik, hasil.kriteria, hasil.keyakinan,
        `AI (${hasil.model})`, catatan, sekarang,
      );
      dinilai += 1;
    } catch (galat: unknown) {
      const sebab = galat instanceof GalatModel || galat instanceof Error ? galat.message : "gagal";
      gagal.push(`${kerja.nama}: ${sebab.slice(0, 120)}`);
      console.error("nilai esai", kerja.attemptId, kerja.soalId, galat);
    }
  }

  // Nilai attempt dihitung ulang sesudah SELURUH jawabannya selesai, bukan tiap
  // kali satu jawaban tersimpan: satu peserta dengan lima soal esai akan
  // menghitung ulang lima kali untuk sampai pada angka yang sama.
  for (const id of new Set(kerjakan.map((k) => k.attemptId))) {
    await hitungUlangAttempt(id);
  }

  return { dinilai, gagal };
}
