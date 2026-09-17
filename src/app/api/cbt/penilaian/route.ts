// ============================================================
// CBT — PENILAIAN RUBRIK, KEMIRIPAN, DAN PERSETUJUAN AKHIR
//
// GET    ?ujian=&attempt=       lembar penilaian satu peserta
// POST   aksi=ai                model menilai esai terhadap rubrik
// POST   aksi=hitung-kemiripan  hitung ulang kemiripan seluruh ujian
// PATCH  aksi=level             dosen mengubah level satu kriteria
// PATCH  aksi=setuju            dosen menyetujui nilai akhir
// PATCH  aksi=batal             tarik kembali persetujuan
//
// ------------------------------------------------------------
// SATU PRINSIP YANG MENGATUR SELURUH BERKAS INI
// ------------------------------------------------------------
//
//     Model    = penilaian awal
//     Dosen    = penentu nilai akademik
//
// Yang dikerjakan model berhenti pada mengusulkan level beserta alasannya.
// Tidak ada satu pun jalur di sini yang membuat nilai menjadi resmi tanpa
// seseorang menekan "SETUJUI" — dan yang menekannya tercatat namanya beserta
// jamnya.
//
// Itu bukan kehati-hatian yang berlebihan. Nilai yang keluar dari sini menempel
// pada transkrip seseorang, dan ketika ia digugat, pertanyaan pertama yang
// diajukan adalah siapa yang memutuskan. "Sistem" bukan jawaban yang dapat
// dipertahankan di sidang akademik mana pun.
// ============================================================
import { db } from "@/db";
import { cbtAnswers, cbtAttempts, cbtExams, cbtRubricScores } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { angkaParam, bolehCbt, bolehPantau, bolehUbah } from "@/lib/cbt";
import { bacaLembar, rekamanAttempt, rubrikUjian, skorRubrikAttempt, soalUjian } from "@/lib/cbt-store";
import { hitungRubrik, levelBerlaku, poinDariRubrik, predikat, type Rubrik } from "@/lib/rubrik";
import { aiSiap, nilaiEsai } from "@/lib/nilai-esai";
import { GalatModel } from "@/lib/ai-penyedia";
import { hitungUlangUjian, pasanganPeserta } from "@/lib/mirip-simpan";
import { hitungUlangAttempt } from "@/lib/nilai-attempt";
import { kirimLaporanNilai } from "@/lib/kirim-nilai";
import { STATUS_TANDA_LABEL, type StatusTanda } from "@/lib/rekaman";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Batas jawaban yang dinilai model dalam satu permintaan.
 *
 * Ada karena "nilai semua" pada kelas berisi empat puluh peserta dikali lima
 * soal esai adalah dua ratus panggilan model di dalam satu permintaan HTTP —
 * yang akan menabrak batas waktu jauh sebelum selesai, sesudah membakar
 * separuh biayanya tanpa menyimpan apa pun.
 *
 * Yang dikirim balik menyebut berapa yang tersisa, dan panel dosen menekan
 * tombolnya lagi. Lambat, dan selesai. Itu lebih baik daripada cepat dan
 * setengah jalan.
 */
const MAKS_SEKALI_NILAI = 12;

async function gerbang(examId: number, izin: "pantau" | "ubah") {
  const profile = await getCurrentProfile();
  if (!bolehCbt(profile) || !profile) {
    return { gagal: Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 }) };
  }
  const baris = await db.select().from(cbtExams).where(eq(cbtExams.id, examId)).limit(1);
  const ujian = baris[0];
  if (!ujian) return { gagal: Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 }) };
  const lolos = izin === "pantau" ? bolehPantau(profile, ujian) : bolehUbah(profile, ujian);
  if (!lolos) {
    return {
      gagal: Response.json(
        {
          success: false,
          message:
            izin === "ubah"
              ? "Penilaian esai hanya oleh pengajar pemilik ujiannya."
              : "Ujian ini milik pengajar lain.",
        },
        { status: 403 },
      ),
    };
  }
  return { profile, ujian };
}

/**
 * Tuliskan hasil rubrik satu jawaban ke kolom poin jawabannya.
 *
 * Dikerjakan tiap kali level berubah — oleh model maupun oleh dosen — supaya
 * nilai yang dibaca papan pantau selalu sama dengan yang terlihat pada lembar
 * penilaian. Dua angka yang berbeda untuk satu jawaban adalah keadaan yang
 * paling cepat menghabiskan kepercayaan dosen terhadap seluruh menu ini.
 */
async function simpanPoinRubrik(
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
// GET — LEMBAR PENILAIAN SATU PESERTA
// ------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const examId = angkaParam(params.get("ujian"));
    const attemptId = angkaParam(params.get("attempt"));
    if (examId === null || attemptId === null) {
      return Response.json({ success: false, message: "Peserta tidak dikenali." }, { status: 400 });
    }
    const cek = await gerbang(examId, "pantau");
    if ("gagal" in cek) return cek.gagal;
    const { ujian } = cek;

    const baris = await db
      .select()
      .from(cbtAttempts)
      .where(and(eq(cbtAttempts.id, attemptId), eq(cbtAttempts.examId, examId)))
      .limit(1);
    const attempt = baris[0];
    if (!attempt) return Response.json({ success: false, message: "Peserta tidak ditemukan." }, { status: 404 });

    const rubrik = await rubrikUjian(ujian.rubricId);
    const bank = await soalUjian(examId);
    const lembar = bacaLembar(attempt.paper);
    const jawaban = await db.select().from(cbtAnswers).where(eq(cbtAnswers.attemptId, attemptId));
    const petaJawab = new Map(jawaban.map((j) => [j.questionId, j]));
    const skor = await skorRubrikAttempt(attemptId);

    const esai = lembar
      .map((l) => bank.find((s) => s.id === l.id))
      .filter((s) => s && s.jenis === "essay")
      .map((soal) => {
        const s = soal!;
        const j = petaJawab.get(s.id);
        const tersimpan = skor.get(s.id) ?? [];
        const urut = new Map(tersimpan.map((t) => [t.criterionIndex, t]));

        const hasil = rubrik
          ? hitungRubrik(
              rubrik,
              rubrik.kriteria.map((_, i) => ({
                aiLevel: urut.get(i)?.aiLevel ?? null,
                finalLevel: urut.get(i)?.finalLevel ?? null,
              })),
            )
          : null;

        return {
          soalId: s.id,
          pertanyaan: s.pertanyaan,
          bobot: s.bobot,
          jawaban: j?.answer ?? "",
          poin: j?.points ?? 0,
          catatan: j?.feedback ?? "",
          dinilaiOleh: j?.gradedBy ?? "",
          kriteria: (rubrik?.kriteria ?? []).map((k, i) => {
            const t = urut.get(i);
            return {
              urut: i,
              nama: k.nama,
              bobot: k.bobot,
              levels: k.levels,
              aiLevel: t?.aiLevel ?? null,
              aiAlasan: t?.aiReason ?? "",
              aiKeyakinan: t?.aiConfidence ?? null,
              finalLevel: t?.finalLevel ?? null,
              level: levelBerlaku({ aiLevel: t?.aiLevel ?? null, finalLevel: t?.finalLevel ?? null }),
              // Nama kriteria SEBAGAIMANA TERSIMPAN bersama skornya. Bila
              // rubriknya disunting sesudah jawaban ini dinilai, keduanya
              // berbeda — dan dosen berhak melihat bahwa ia berbeda, bukan
              // membaca nama baru di atas angka lama.
              namaTersimpan: t?.criterionName ?? "",
            };
          }),
          hasil,
        };
      });

    const rekaman = await rekamanAttempt(attemptId);
    const nilaiAkhir = attempt.finalScore ?? attempt.score ?? 0;

    return Response.json({
      success: true,
      peserta: {
        id: attempt.id,
        nim: attempt.nim,
        nama: attempt.name,
        email: attempt.email || "",
        nilaiMesin: attempt.score,
        nilaiAkhir: attempt.finalScore,
        predikat: predikat(nilaiAkhir),
        lulus: nilaiAkhir >= ujian.passingGrade,
        tertunda: attempt.pending,
        disetujui: attempt.approvedAt ? attempt.approvedAt.toISOString() : null,
        disetujuiOleh: attempt.approvedBy || "",
        laporanTerkirim: attempt.reportSentAt ? attempt.reportSentAt.toISOString() : null,
        kemiripan: attempt.similarityScore,
        statusKemiripan: attempt.similarityStatus,
      },
      rubrik: rubrik
        ? { nama: rubrik.nama, skalaMin: rubrik.skalaMin, skalaMax: rubrik.skalaMax, jumlahKriteria: rubrik.kriteria.length }
        : null,
      esai,
      kemiripan: await pasanganPeserta(attemptId),
      rekaman: rekaman
        ? {
            status: rekaman.status,
            durasi: rekaman.durationSec,
            potongan: rekaman.chunkCount,
            transkrip: rekaman.transcriptStatus,
            tanda: rekaman.flagStatus,
            tandaLabel: STATUS_TANDA_LABEL[rekaman.flagStatus as StatusTanda] ?? rekaman.flagStatus,
            jumlahTanda: rekaman.flagCount,
            catatan: rekaman.note || "",
          }
        : null,
      aiSiap: aiSiap(),
    });
  } catch (error: unknown) {
    console.error("lembar penilaian", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Lembar penilaian belum dapat dimuat.") },
      { status: 500 },
    );
  }
}

// ------------------------------------------------------------
// POST — PENILAIAN OLEH MODEL, DAN HITUNG ULANG KEMIRIPAN
// ------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const aksi = String(body.aksi ?? "");
    const examId = angkaParam(String(body.ujian ?? ""));
    if (examId === null) return Response.json({ success: false, message: "Ujian tidak dikenali." }, { status: 400 });

    const cek = await gerbang(examId, "ubah");
    if ("gagal" in cek) return cek.gagal;
    const { ujian } = cek;

    // ---------- HITUNG ULANG KEMIRIPAN ----------
    if (aksi === "hitung-kemiripan") {
      const hasil = await hitungUlangUjian(ujian);
      return Response.json({
        success: true,
        ...hasil,
        pesan:
          hasil.peserta < 2
            ? "Belum ada dua peserta yang mengumpulkan, jadi belum ada yang dapat dibandingkan."
            : `${hasil.pasangan} pasangan jawaban diperiksa dari ${hasil.peserta} peserta.`,
      });
    }

    if (aksi !== "ai") {
      return Response.json({ success: false, message: "Aksi tidak dikenali." }, { status: 400 });
    }

    // ---------- PENILAIAN OLEH MODEL ----------
    if (!aiSiap()) {
      return Response.json(
        {
          success: false,
          message:
            "Penilaian AI belum tersambung ke model mana pun. Pasang ANTHROPIC_API_KEY atau " +
            "GEMINI_API_KEY pada environment, lalu deploy ulang. Penilaian manual tetap jalan.",
        },
        { status: 503 },
      );
    }

    const rubrik = await rubrikUjian(ujian.rubricId);
    if (!rubrik || rubrik.kriteria.length === 0) {
      return Response.json(
        {
          success: false,
          message:
            "Ujian ini belum memakai rubrik. Pilih satu rubrik pada Pengaturan Ujian — " +
            "ada beberapa rubrik siap pakai yang tinggal disalin.",
        },
        { status: 400 },
      );
    }

    const attemptId = angkaParam(String(body.attempt ?? ""));
    const bank = await soalUjian(examId);

    // Peserta mana saja yang dinilai: satu orang, atau seluruh yang sudah
    // mengumpulkan. Yang MASIH MENGERJAKAN tidak pernah ikut — menilai jawaban
    // setengah jadi menghabiskan biaya pada teks yang akan berubah, dan
    // meninggalkan nilai yang terlihat final pada lembar yang belum selesai.
    const peserta = attemptId
      ? await db
          .select()
          .from(cbtAttempts)
          .where(and(eq(cbtAttempts.id, attemptId), eq(cbtAttempts.examId, examId)))
          .limit(1)
      : (await db.select().from(cbtAttempts).where(eq(cbtAttempts.examId, examId)).limit(400))
          .filter((p) => p.status !== "berjalan");

    if (peserta.length === 0) {
      return Response.json({ success: false, message: "Belum ada peserta yang dapat dinilai." }, { status: 400 });
    }

    // Susun daftar pekerjaan lebih dulu, baru dikerjakan. Dengan begitu
    // batas MAKS_SEKALI_NILAI dapat mengatakan berapa yang TERSISA — dan
    // tombol di panel dosen dapat menyebutkan angkanya, bukan menyuruh
    // menekan berulang sampai entah kapan.
    type Pekerjaan = { attempt: typeof peserta[number]; soalId: number; bobot: number; pertanyaan: string; acuan: string; jawaban: string };
    const antre: Pekerjaan[] = [];
    const ulangi = body.ulangi === true;

    for (const p of peserta) {
      const lembar = bacaLembar(p.paper);
      const jawaban = await db.select().from(cbtAnswers).where(eq(cbtAnswers.attemptId, p.id));
      const petaJawab = new Map(jawaban.map((j) => [j.questionId, j]));
      const sudah = await skorRubrikAttempt(p.id);

      for (const l of lembar) {
        const soal = bank.find((s) => s.id === l.id);
        if (!soal || soal.jenis !== "essay") continue;
        const isi = String(petaJawab.get(soal.id)?.answer ?? "").trim();
        // Jawaban kosong tidak dikirim ke model. Ia tidak memerlukan
        // pembacaan siapa pun, dan membayar model untuk menyimpulkan bahwa
        // tidak ada apa-apa di sana adalah pemborosan yang berulang seratus
        // kali pada kelas yang separuhnya tidak menjawab esai.
        if (!isi) continue;
        // Yang SUDAH dinilai dilewati, kecuali dosen memang meminta mengulang.
        if (!ulangi && (sudah.get(soal.id)?.length ?? 0) > 0) continue;
        antre.push({
          attempt: p,
          soalId: soal.id,
          bobot: soal.bobot,
          pertanyaan: soal.pertanyaan,
          acuan: soal.pembahasan || "",
          jawaban: isi,
        });
      }
    }

    if (antre.length === 0) {
      return Response.json({
        success: true,
        dinilai: 0,
        sisa: 0,
        pesan: "Semua jawaban esai sudah pernah dinilai. Pakai 'nilai ulang' bila ingin mengulanginya.",
      });
    }

    const kerjakan = antre.slice(0, MAKS_SEKALI_NILAI);
    const sekarang = new Date();
    let dinilai = 0;
    const gagal: string[] = [];

    for (const kerja of kerjakan) {
      try {
        const hasil = await nilaiEsai({
          rubrik,
          pertanyaan: kerja.pertanyaan,
          jawaban: kerja.jawaban,
          mataKuliah: ujian.courseName,
          acuan: kerja.acuan,
        });

        for (const k of hasil.kriteria) {
          await db
            .insert(cbtRubricScores)
            .values({
              attemptId: kerja.attempt.id,
              questionId: kerja.soalId,
              criterionIndex: k.urut,
              criterionName: rubrik.kriteria[k.urut]?.nama ?? "",
              weight: rubrik.kriteria[k.urut]?.bobot ?? 0,
              aiLevel: k.level,
              aiReason: k.alasan,
              aiConfidence: hasil.keyakinan,
              updatedAt: sekarang,
            })
            .onConflictDoUpdate({
              target: [cbtRubricScores.attemptId, cbtRubricScores.questionId, cbtRubricScores.criterionIndex],
              set: {
                criterionName: rubrik.kriteria[k.urut]?.nama ?? "",
                weight: rubrik.kriteria[k.urut]?.bobot ?? 0,
                aiLevel: k.level,
                aiReason: k.alasan,
                aiConfidence: hasil.keyakinan,
                // Keputusan dosen yang sudah ada TIDAK dihapus oleh penilaian
                // ulang. Dosen yang sudah membaca dan memutuskan tidak boleh
                // kehilangan keputusannya karena ada yang menekan "nilai
                // ulang" — level akhirnya tetap miliknya.
                updatedAt: sekarang,
              },
            });
        }

        // Umpan balik yang dibaca mahasiswa dirakit dari ringkasan dan saran.
        // Keduanya digabung di SATU tempat, bukan disimpan terpisah lalu
        // dirakit ulang di panel dan sekali lagi di laporan cetak.
        const catatan = [
          hasil.ringkasan,
          hasil.saran.length > 0 ? `\n\nSaran perbaikan:\n${hasil.saran.map((s) => `• ${s}`).join("\n")}` : "",
          hasil.perluDosen
            ? `\n\n(Keyakinan penilaian awal ${hasil.keyakinan}%. Mohon diperiksa dosen.)`
            : "",
        ].join("");

        await simpanPoinRubrik(
          kerja.attempt.id,
          kerja.soalId,
          kerja.bobot,
          rubrik,
          `AI (${hasil.model})`,
          catatan,
        );
        dinilai += 1;
      } catch (galat: unknown) {
        // Satu jawaban yang gagal dinilai tidak menggagalkan sisanya. Kelas
        // berisi empat puluh peserta tidak boleh kehilangan tiga puluh sembilan
        // penilaian karena satu jawaban memuat sesuatu yang membuat model
        // tersedak.
        const sebab = galat instanceof GalatModel || galat instanceof Error ? galat.message : "gagal";
        gagal.push(`${kerja.attempt.name}: ${sebab.slice(0, 120)}`);
        console.error("nilai esai", kerja.attempt.id, kerja.soalId, galat);
      }
    }

    // Nilai attempt dihitung ulang sesudah seluruh jawabannya selesai, bukan
    // tiap kali satu jawaban tersimpan: satu peserta dengan lima soal esai
    // akan menghitung ulang lima kali untuk sampai pada angka yang sama.
    for (const id of new Set(kerjakan.map((k) => k.attempt.id))) {
      await hitungUlangAttempt(id);
    }

    return Response.json({
      success: true,
      dinilai,
      sisa: antre.length - kerjakan.length,
      gagal,
      pesan:
        antre.length > kerjakan.length
          ? `${dinilai} jawaban dinilai. Masih ada ${antre.length - kerjakan.length} lagi — tekan sekali lagi untuk melanjutkan.`
          : `${dinilai} jawaban dinilai.`,
    });
  } catch (error: unknown) {
    if (error instanceof GalatModel) {
      return Response.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error("penilaian ai", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Penilaian belum dapat dijalankan.") },
      { status: 500 },
    );
  }
}

// ------------------------------------------------------------
// PATCH — KEPUTUSAN DOSEN
// ------------------------------------------------------------

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const aksi = String(body.aksi ?? "level");
    const examId = angkaParam(String(body.ujian ?? ""));
    const attemptId = angkaParam(String(body.attempt ?? ""));
    if (examId === null || attemptId === null) {
      return Response.json({ success: false, message: "Data tidak lengkap." }, { status: 400 });
    }

    const cek = await gerbang(examId, "ubah");
    if ("gagal" in cek) return cek.gagal;
    const { ujian, profile } = cek;

    const baris = await db
      .select()
      .from(cbtAttempts)
      .where(and(eq(cbtAttempts.id, attemptId), eq(cbtAttempts.examId, examId)))
      .limit(1);
    const attempt = baris[0];
    if (!attempt) return Response.json({ success: false, message: "Peserta tidak ditemukan." }, { status: 404 });

    const sekarang = new Date();

    // ---------- DOSEN MENGUBAH SATU LEVEL ----------
    if (aksi === "level") {
      const rubrik = await rubrikUjian(ujian.rubricId);
      if (!rubrik) return Response.json({ success: false, message: "Ujian ini belum memakai rubrik." }, { status: 400 });

      const questionId = angkaParam(String(body.soal ?? ""));
      const urut = Number(body.kriteria);
      if (questionId === null || !Number.isInteger(urut) || urut < 0 || urut >= rubrik.kriteria.length) {
        return Response.json({ success: false, message: "Kriteria tidak dikenali." }, { status: 400 });
      }

      // null berarti dosen MENCABUT keputusannya dan kembali memakai pembacaan
      // model. Itu perbuatan yang sah dan harus ada jalannya: dosen yang salah
      // menekan tidak boleh terkunci pada angka yang ia tekan keliru.
      const mentah = body.level;
      const level =
        mentah === null || mentah === "" || mentah === undefined
          ? null
          : Math.max(rubrik.skalaMin, Math.min(rubrik.skalaMax, Math.round(Number(mentah))));
      if (level !== null && !Number.isFinite(level)) {
        return Response.json({ success: false, message: "Level tidak dikenali." }, { status: 400 });
      }

      await db
        .insert(cbtRubricScores)
        .values({
          attemptId,
          questionId,
          criterionIndex: urut,
          criterionName: rubrik.kriteria[urut].nama,
          weight: rubrik.kriteria[urut].bobot,
          finalLevel: level,
          updatedAt: sekarang,
        })
        .onConflictDoUpdate({
          target: [cbtRubricScores.attemptId, cbtRubricScores.questionId, cbtRubricScores.criterionIndex],
          set: { finalLevel: level, updatedAt: sekarang },
        });

      const bank = await soalUjian(examId);
      const soal = bank.find((s) => s.id === questionId);
      const hasil = await simpanPoinRubrik(
        attemptId,
        questionId,
        soal?.bobot ?? 1,
        rubrik,
        profile.fullName,
        typeof body.catatan === "string" ? body.catatan : undefined,
      );
      const nilai = await hitungUlangAttempt(attemptId);

      // Persetujuan yang sudah ada DICABUT begitu nilainya berubah. Laporan
      // yang sudah ditandatangani tidak boleh diam-diam berbeda dari nilai
      // yang sekarang tersimpan — dan dosen harus menyetujuinya lagi, sadar
      // bahwa yang ia setujui sudah berubah.
      if (attempt.approvedAt) {
        await db
          .update(cbtAttempts)
          .set({ approvedAt: null, approvedBy: null, finalScore: null })
          .where(eq(cbtAttempts.id, attemptId));
      }

      return Response.json({
        success: true,
        rubrik: hasil,
        nilai,
        persetujuanDicabut: Boolean(attempt.approvedAt),
      });
    }

    // ---------- DOSEN MENYETUJUI NILAI AKHIR ----------
    if (aksi === "setuju") {
      if (attempt.status === "berjalan") {
        return Response.json(
          { success: false, message: "Peserta ini masih mengerjakan. Nilainya belum dapat disetujui." },
          { status: 409 },
        );
      }

      // Dosen boleh mengetik nilai akhir yang BERBEDA dari hitungan mesin, dan
      // keduanya tetap tersimpan berdampingan. Itu kewenangan akademiknya, dan
      // laporan yang menunjukkan keduanya justru lebih jujur daripada laporan
      // yang hanya memuat satu angka tanpa menyebut bahwa ia diubah.
      const mentah = body.nilai;
      const diketik =
        mentah === null || mentah === "" || mentah === undefined ? null : Math.round(Number(mentah));
      if (diketik !== null && (!Number.isFinite(diketik) || diketik < 0 || diketik > 100)) {
        return Response.json({ success: false, message: "Nilai akhir harus antara 0 dan 100." }, { status: 400 });
      }
      const nilaiAkhir = diketik ?? attempt.score ?? 0;

      await db
        .update(cbtAttempts)
        .set({ finalScore: nilaiAkhir, approvedAt: sekarang, approvedBy: profile.fullName })
        .where(eq(cbtAttempts.id, attemptId));

      // Email otomatis, bila ujiannya memintanya. Kegagalan mengirim TIDAK
      // menggagalkan persetujuan: yang barusan terjadi adalah dosen menyetujui
      // sebuah nilai, dan itu sudah tersimpan. Surat yang tidak terkirim dapat
      // dicoba lagi dari panelnya, dan catat gagalnya ada di log pengiriman.
      let surat: { terkirim: boolean; pesan: string } | null = null;
      if (ujian.autoEmail) {
        try {
          const hasil = await kirimLaporanNilai({
            attemptId,
            examId,
            dikirimOleh: profile.fullName,
          });
          surat = { terkirim: hasil.terkirim, pesan: hasil.pesan };
        } catch (galat) {
          console.error("kirim nilai otomatis", galat);
          surat = { terkirim: false, pesan: "Surat belum terkirim. Coba kirim ulang dari panel." };
        }
      }

      return Response.json({
        success: true,
        nilaiAkhir,
        predikat: predikat(nilaiAkhir),
        disetujui: sekarang.toISOString(),
        disetujuiOleh: profile.fullName,
        surat,
      });
    }

    // ---------- DOSEN MENARIK PERSETUJUANNYA ----------
    if (aksi === "batal") {
      await db
        .update(cbtAttempts)
        .set({ finalScore: null, approvedAt: null, approvedBy: null })
        .where(eq(cbtAttempts.id, attemptId));
      return Response.json({ success: true });
    }

    return Response.json({ success: false, message: "Aksi tidak dikenali." }, { status: 400 });
  } catch (error: unknown) {
    console.error("keputusan penilaian", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Keputusan belum tersimpan.") },
      { status: 500 },
    );
  }
}
