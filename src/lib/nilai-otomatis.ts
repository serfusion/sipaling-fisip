// ============================================================
// PENILAIAN ESAI OTOMATIS OLEH AI, TERHADAP RUBRIK MATA KULIAH
//
// Satu jalan untuk tiga pemanggil, supaya ketiganya menilai dengan cara yang
// sama persis:
//
//   1. SAAT PESERTA MENGUMPULKAN. Esai dinilai DI DALAM permintaan
//      "kumpulkan", seluruh esai satu peserta bersamaan, dan permintaan itu
//      menunggu hasilnya paling lama TUNGGU_SAAT_KUMPUL_MS. Karena AI hanya
//      mengklasifikasikan jawaban ke level rubrik (lihat nilai-esai.ts),
//      hampir selalu selesai dalam hitungan detik, dan peserta langsung
//      melihat nilai lengkapnya. Yang melewati batas tunggu dilanjutkan
//      fungsi yang sama lewat after(), tanpa menahan peserta lebih lama.
//   2. PAPAN PANTAU PENGAJAR, yang menyegar tiap sepuluh detik dan menilai
//      sisa yang belum ternilai: jawaban yang penilaiannya gagal karena kuota,
//      dan ujian lama yang esainya belum pernah dibaca AI.
//   3. TOMBOL "NILAI ULANG" yang ditekan pengajar.
//
// ------------------------------------------------------------
// KENAPA MENUNGGU, DAN KENAPA ADA BATASNYA
// ------------------------------------------------------------
// Rubrik yang sudah dipasang pengajar tidak berarti apa-apa bagi peserta yang
// membaca "sedang dinilai" lalu menutup halamannya. Karena itu permintaan
// "kumpulkan" menunggu penilaiannya, dan seluruh esai dinilai bersamaan,
// bukan bergiliran: lima esai selesai dalam waktu satu esai.
//
// Batasnya tetap ada, karena penyedia model kadang lambat pada jam sibuk, dan
// jalur pengumpulan adalah jalur yang 504-nya baru diperbaiki v45. Peserta
// yang menunggu lebih dari beberapa detik akan menekan tombolnya lagi atau
// mengira jawabannya hilang. Melewati batas itu, jawabannya dikirim dengan
// keterangan "masih dinilai", penilaiannya berjalan terus di fungsi yang
// sama, dan layar peserta menanyakan nilainya lagi.
//
// ------------------------------------------------------------
// RUBRIK ADALAH SATU-SATUNYA ACUAN
// ------------------------------------------------------------
// Rubrik yang dipakai adalah rubrik MATA KULIAH ujiannya (lihat
// rubrikMatkul() di src/lib/cbt-store.ts). Jawaban acuan dan penilai "bentuk
// jawaban" tanpa model sudah dihapus pada v49: ujian yang mata kuliahnya
// belum punya rubrik tidak dinilai otomatis sama sekali, dan papan pantaunya
// mengatakan itu.
// ============================================================

import { after } from "next/server";
import { db } from "@/db";
import { cbtAnswers, cbtAttempts, cbtRubricScores } from "@/db/schema";
import { and, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { bacaLembar, rubrikUjian, soalUjian } from "@/lib/cbt-store";
import { hitungRubrik, poinDariRubrik, type Rubrik } from "@/lib/rubrik";
import { GalatModel } from "@/lib/ai-penyedia";
import { aiSiap, nilaiEsai } from "@/lib/nilai-esai";
import { hitungUlangAttempt, type NilaiUlang } from "@/lib/nilai-attempt";
import {
  MASA_KLAIM_MS, TANDA_MENILAI, berbarengan, dinilaiRubrik, klaimMasihBerlaku, perluDinilaiAi,
} from "@/lib/penilaian-ai";

/**
 * Berapa jawaban dinilai dalam satu panggilan dari papan pantau.
 *
 * Batasnya ada karena satu permintaan HTTP punya umur. Sisanya dikerjakan
 * panggilan berikutnya, dan pemanggilnya diberi tahu berapa yang tersisa.
 */
export const MAKS_SEKALI_NILAI = 12;

/** Berapa panggilan model berjalan bersamaan. Lihat berbarengan(). */
export const SEKALIGUS = 4;

/**
 * Esai satu peserta yang dinilai bersamaan saat ia mengumpulkan.
 *
 * Lebih longgar daripada SEKALIGUS karena yang dinilai hanya lembar satu
 * orang: ujian dengan delapan soal esai tetap selesai dalam waktu satu esai.
 */
export const SEKALIGUS_SATU_PESERTA = 8;

/**
 * Batas tunggu penilaian di dalam permintaan "kumpulkan".
 *
 * Klasifikasi satu esai biasanya selesai dalam dua sampai lima detik. Sepuluh
 * detik memberi ruang untuk penyedia yang sedang lambat tanpa membuat peserta
 * mengira tombolnya macet.
 */
export const TUNGGU_SAAT_KUMPUL_MS = 10_000;

export type Pekerjaan = {
  attemptId: number;
  nama: string;
  soalId: number;
  bobot: number;
  pertanyaan: string;
  jawaban: string;
  /**
   * Isi graded_by sebelum diklaim. Dikembalikan bila penilaian gagal, supaya
   * jawaban yang sebelumnya dinilai pengajar tidak berubah menjadi "sedang
   * dinilai" selamanya hanya karena kuota AI habis.
   */
  penilaiLama: string | null;
};

/**
 * Lembar ini masih dikerjakan, jadi belum boleh dinilai.
 *
 * Statusnya harus dibaca dari BARIS BASIS DATA YANG TERBARU. Obyek attempt
 * yang dipegang pemanggil dapat saja masih membawa "berjalan" walaupun
 * barisnya sudah lama berubah menjadi "selesai", dan kesalahan itu pernah
 * membuat seluruh penilaian sesudah kumpul diam-diam tidak pernah berjalan.
 */
export function masihMengerjakan(status: string): boolean {
  return status === "berjalan";
}

/**
 * Susun daftar jawaban yang menunggu dinilai AI.
 *
 * `ulangi` false: hanya yang memang perlu (aturannya di perluDinilaiAi).
 * `ulangi` true:  seluruh jawaban esai, atas permintaan pengajar. Keputusan
 * level pengajar tetap tidak tersentuh, karena yang ditimpa penilaian hanya
 * kolom usulan AI.
 *
 * Disusun lengkap lebih dulu, baru dipotong pemanggilnya, supaya ia dapat
 * mengatakan berapa yang TERSISA.
 */
export async function antreEsai(
  examId: number,
  peserta: Array<typeof cbtAttempts.$inferSelect>,
  ulangi = false,
): Promise<Pekerjaan[]> {
  const bank = await soalUjian(examId);
  const antre: Pekerjaan[] = [];
  const sekarang = new Date();

  for (const p of peserta) {
    // Yang MASIH mengerjakan tidak pernah ikut: menilai jawaban setengah jadi
    // menghabiskan kuota pada teks yang akan berubah.
    if (masihMengerjakan(p.status)) continue;

    const lembar = bacaLembar(p.paper);
    const jawaban = await db.select().from(cbtAnswers).where(eq(cbtAnswers.attemptId, p.id));
    const petaJawab = new Map(jawaban.map((j) => [j.questionId, j]));

    for (const l of lembar) {
      const soal = bank.find((s) => s.id === l.id);
      if (!soal || !dinilaiRubrik(soal)) continue;

      const j = petaJawab.get(soal.id);
      const isi = String(j?.answer ?? "").trim();
      // Jawaban kosong tidak dikirim ke model. Tidak ada yang perlu dibaca,
      // dan membayar model untuk menyimpulkan bahwa tidak ada apa-apa di sana
      // adalah pemborosan yang berulang pada tiap kelas.
      if (!j || !isi) continue;

      const perlu = ulangi
        ? !klaimMasihBerlaku(j.gradedBy, j.updatedAt, sekarang)
        : perluDinilaiAi(
            {
              jawaban: isi,
              isCorrect: j.isCorrect,
              gradedBy: j.gradedBy,
              diubah: j.updatedAt,
              disahkan: Boolean(p.approvedAt),
            },
            sekarang,
          );
      if (!perlu) continue;

      antre.push({
        attemptId: p.id,
        nama: p.name,
        soalId: soal.id,
        bobot: soal.bobot,
        pertanyaan: soal.pertanyaan,
        jawaban: isi,
        penilaiLama: j.gradedBy === TANDA_MENILAI ? null : j.gradedBy,
      });
    }
  }

  return antre;
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

// ------------------------------------------------------------
// KLAIM: SATU JAWABAN, SATU PENILAI
// ------------------------------------------------------------

/**
 * Tandai satu jawaban sedang dinilai. False bila penilai lain lebih dulu.
 *
 * Satu perintah UPDATE bersyarat, bukan baca-lalu-tulis. Dua penilai yang
 * mengklaim bersamaan diantrekan Postgres pada kunci baris yang sama, dan
 * yang kedua memeriksa ulang syaratnya terhadap baris yang sudah diklaim
 * yang pertama, sehingga hanya satu yang mendapat barisnya kembali.
 */
async function klaim(kerja: Pekerjaan, sekarang: Date): Promise<boolean> {
  const basi = new Date(sekarang.getTime() - MASA_KLAIM_MS);
  const dapat = await db
    .update(cbtAnswers)
    .set({ gradedBy: TANDA_MENILAI, updatedAt: sekarang })
    .where(and(
      eq(cbtAnswers.attemptId, kerja.attemptId),
      eq(cbtAnswers.questionId, kerja.soalId),
      or(isNull(cbtAnswers.gradedBy), ne(cbtAnswers.gradedBy, TANDA_MENILAI), lt(cbtAnswers.updatedAt, basi)),
    ))
    .returning({ id: cbtAnswers.id });
  return dapat.length > 0;
}

/** Kembalikan graded_by seperti sebelum diklaim, bila klaimnya masih milik kita. */
async function lepas(kerja: Pekerjaan) {
  await db
    .update(cbtAnswers)
    .set({ gradedBy: kerja.penilaiLama })
    .where(and(
      eq(cbtAnswers.attemptId, kerja.attemptId),
      eq(cbtAnswers.questionId, kerja.soalId),
      eq(cbtAnswers.gradedBy, TANDA_MENILAI),
    ));
}

/**
 * Klaimnya masih milik kita?
 *
 * Pengajar dapat mengoreksi jawaban yang sama selagi model masih membacanya.
 * Keputusannya yang menang: hasil model yang datang sesudahnya dibuang, bukan
 * menimpa angka yang baru saja ia ketik.
 */
async function masihDiklaim(kerja: Pekerjaan): Promise<boolean> {
  const baris = await db
    .select({ gradedBy: cbtAnswers.gradedBy })
    .from(cbtAnswers)
    .where(and(eq(cbtAnswers.attemptId, kerja.attemptId), eq(cbtAnswers.questionId, kerja.soalId)))
    .limit(1);
  return baris[0]?.gradedBy === TANDA_MENILAI;
}

/**
 * Simpan level usulan AI satu jawaban, lalu hitung poinnya.
 *
 * Seluruh kriteria ditulis SEKALI JALAN. Keputusan pengajar yang sudah ada
 * TIDAK dihapus oleh penilaian ulang: yang ditimpa hanya kolom usulan,
 * sedangkan finalLevel tidak disentuh.
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
  if (usulan.length > 0) {
    await db
      .insert(cbtRubricScores)
      .values(usulan.map((k) => ({
        attemptId: kerja.attemptId,
        questionId: kerja.soalId,
        criterionIndex: k.urut,
        criterionName: rubrik.kriteria[k.urut]?.nama ?? "",
        weight: rubrik.kriteria[k.urut]?.bobot ?? 0,
        aiLevel: k.level,
        aiReason: k.alasan,
        aiConfidence: keyakinan,
        updatedAt: sekarang,
      })))
      // `excluded` menunjuk baris yang sedang dicoba masukkan, jadi tiap
      // kriteria memperbarui dirinya dengan nilainya sendiri.
      .onConflictDoUpdate({
        target: [cbtRubricScores.attemptId, cbtRubricScores.questionId, cbtRubricScores.criterionIndex],
        set: {
          criterionName: sql`excluded.criterion_name`,
          weight: sql`excluded.weight`,
          aiLevel: sql`excluded.ai_level`,
          aiReason: sql`excluded.ai_reason`,
          aiConfidence: sql`excluded.ai_confidence`,
          updatedAt: sekarang,
        },
      });
  }
  await simpanPoinRubrik(kerja.attemptId, kerja.soalId, kerja.bobot, rubrik, penilai, catatan);
}

/**
 * Nilai daftar pekerjaan dengan AI: klaim, panggil model, simpan, hitung ulang.
 *
 * Satu jawaban yang gagal dinilai tidak menggagalkan sisanya. Kelas berisi
 * empat puluh peserta tidak boleh kehilangan tiga puluh sembilan penilaian
 * karena satu jawaban memuat sesuatu yang membuat model tersedak. Yang gagal
 * dilepas klaimnya dan tetap terhitung belum dinilai, sehingga papan pantau
 * mencobanya lagi.
 */
export async function kerjakanPenilaian(
  rubrik: Rubrik,
  kerjakan: Pekerjaan[],
  mataKuliah: string,
  sekaligus = SEKALIGUS,
): Promise<{ dinilai: number; gagal: string[]; dilewati: number; nilai: Map<number, NilaiUlang> }> {
  let dinilai = 0;
  let dilewati = 0;
  const gagal: string[] = [];
  const tersentuh = new Set<number>();

  await berbarengan(kerjakan, sekaligus, async (kerja) => {
    const sekarang = new Date();
    if (!(await klaim(kerja, sekarang))) {
      dilewati += 1;
      return;
    }
    try {
      const hasil = await nilaiEsai({
        rubrik,
        pertanyaan: kerja.pertanyaan,
        jawaban: kerja.jawaban,
        mataKuliah,
      });

      if (!(await masihDiklaim(kerja))) {
        dilewati += 1;
        return;
      }

      // Umpan balik yang dibaca peserta dirakit di SATU tempat, bukan disimpan
      // terpisah lalu dirakit ulang di panel dan sekali lagi di laporan cetak.
      const catatan = [
        hasil.gerbang.lolos
          ? ""
          : `Tidak lolos gerbang rubrik${hasil.gerbang.alasan ? `: ${hasil.gerbang.alasan}` : "."}\n\n`,
        hasil.ringkasan,
        hasil.saran.length > 0 ? `\n\nSaran perbaikan:\n${hasil.saran.map((s) => `• ${s}`).join("\n")}` : "",
        hasil.perluDosen ? `\n\n(Keyakinan penilaian AI ${hasil.keyakinan}%. Mohon diperiksa pengajar.)` : "",
      ].join("");

      await simpanUsulan(
        kerja, rubrik, hasil.kriteria, hasil.keyakinan,
        `AI (${hasil.model})`, catatan, new Date(),
      );
      dinilai += 1;
      tersentuh.add(kerja.attemptId);
    } catch (galat: unknown) {
      await lepas(kerja).catch(() => undefined);
      const sebab = galat instanceof GalatModel || galat instanceof Error ? galat.message : "gagal";
      gagal.push(`${kerja.nama}: ${sebab.slice(0, 160)}`);
      console.error("nilai esai ai", kerja.attemptId, kerja.soalId, galat);
    }
  });

  // Nilai attempt dihitung ulang sesudah SELURUH jawabannya selesai, bukan tiap
  // kali satu jawaban tersimpan: satu peserta dengan lima soal esai akan
  // menghitung ulang lima kali untuk sampai pada angka yang sama.
  const nilai = new Map<number, NilaiUlang>();
  for (const id of tersentuh) {
    const segar = await hitungUlangAttempt(id);
    if (segar) nilai.set(id, segar);
  }

  return { dinilai, gagal, dilewati, nilai };
}

// ------------------------------------------------------------
// SAAT PESERTA MENGUMPULKAN
// ------------------------------------------------------------

/**
 * Nilai seluruh esai satu peserta dengan AI, bersamaan.
 *
 * Barisnya DIBACA ULANG dari basis data, bukan diterima dari pemanggil. Obyek
 * attempt yang dipegang jalur pengumpulan masih membawa status "berjalan",
 * dan antreEsai() melewati yang masih berjalan; kesalahan persis itulah yang
 * dahulu membuat penilaian sesudah kumpul diam-diam tidak pernah terjadi.
 */
export async function nilaiEsaiAttempt(
  ujian: { id: number; courseName: string },
  attemptId: number,
  rubrikSiap?: Rubrik | null,
) {
  const rubrik = rubrikSiap ?? (await rubrikUjian(ujian));
  if (!rubrik || rubrik.kriteria.length === 0) return null;

  const baris = await db.select().from(cbtAttempts).where(eq(cbtAttempts.id, attemptId)).limit(1);
  const attempt = baris[0];
  if (!attempt) return null;

  const antre = await antreEsai(ujian.id, [attempt]);
  if (antre.length === 0) return null;

  return kerjakanPenilaian(
    rubrik, antre, ujian.courseName, Math.min(SEKALIGUS_SATU_PESERTA, antre.length),
  );
}

export type HasilSaatKumpul = {
  /** Penilaian masih berjalan sesudah batas tunggu; layar peserta menanyakan lagi. */
  menungguAi: boolean;
  /** Nilai attempt yang sudah memuat esainya, bila penilaiannya selesai. */
  nilai: NilaiUlang | null;
};

/**
 * Nilai esai satu peserta di dalam permintaan "kumpulkan".
 *
 * Penilaiannya dimulai seketika dan didaftarkan ke after(), lalu ditunggu
 * paling lama `tungguMs`. Selesai sebelum batas: nilai lengkapnya
 * dikembalikan untuk langsung ditampilkan kepada peserta. Melewati batas:
 * yang kembali hanya keterangan bahwa esainya masih dinilai, dan after()
 * menjaga fungsi ini tetap hidup sampai penilaiannya tuntas. Pekerjaannya
 * hanya satu; yang berbeda hanya siapa yang sempat menunggunya.
 *
 * `tungguMs` 0 berarti tidak menunggu sama sekali, untuk pengumpulan paksa
 * oleh aturan pengawasan: layar peserta itu harus segera tahu ujiannya
 * dihentikan, bukan sepuluh detik kemudian.
 *
 * Tidak berjalan bila mata kuliahnya belum punya rubrik, atau belum ada kunci
 * AI satu pun. Keduanya dikatakan papan pantau kepada pengajarnya.
 */
export async function nilaiEsaiSaatKumpul(
  ujian: { id: number; courseName: string },
  attemptId: number,
  tungguMs: number = TUNGGU_SAAT_KUMPUL_MS,
): Promise<HasilSaatKumpul> {
  const tidakAda: HasilSaatKumpul = { menungguAi: false, nilai: null };
  const rubrik = await rubrikUjian(ujian);
  if (!rubrik || rubrik.kriteria.length === 0) return tidakAda;
  if (!(await aiSiap())) return tidakAda;

  const kerja = nilaiEsaiAttempt(ujian, attemptId, rubrik).catch((galat: unknown) => {
    // Yang gagal di sini tidak hilang: jawabannya tetap terhitung belum
    // dinilai, dan papan pantau pengajar menilainya pada penyegaran
    // berikutnya.
    console.error("nilai esai saat kumpul", attemptId, galat);
    return null;
  });

  try {
    after(kerja);
  } catch {
    // Di luar lingkup permintaan (mis. dipanggil dari skrip), after() tidak
    // tersedia. Pekerjaannya sudah berjalan; papan pantau tetap menjadi
    // jaring pengamannya bila prosesnya berhenti lebih dulu.
  }

  if (tungguMs <= 0) return { menungguAi: true, nilai: null };

  let jam: ReturnType<typeof setTimeout> | undefined;
  const habis = new Promise<"habis">((selesai) => {
    jam = setTimeout(() => selesai("habis"), tungguMs);
  });
  const hasil = await Promise.race([kerja, habis]);
  if (jam) clearTimeout(jam);

  if (hasil === "habis") return { menungguAi: true, nilai: null };
  return { menungguAi: false, nilai: hasil?.nilai.get(attemptId) ?? null };
}
