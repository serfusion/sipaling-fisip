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
import { and, eq, sql } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { angkaParam, bolehCbt, bolehPantau, bolehUbah } from "@/lib/cbt";
import {
  acuanUjian, bacaLembar, rekamanAttempt, rubrikUjian, skorRubrikAttempt, soalUjian,
} from "@/lib/cbt-store";
import { hitungRubrik, levelBerlaku, poinDariRubrik, predikat, type Rubrik } from "@/lib/rubrik";
import { aiSiap, nilaiEsai } from "@/lib/nilai-esai";
import { GalatModel } from "@/lib/ai-penyedia";
import { hitungUlangUjian, pasanganPeserta } from "@/lib/mirip-simpan";
import { hitungUlangAttempt } from "@/lib/nilai-attempt";
import {
  MAKS_SEKALI_NILAI, antreEsai, kerjakanPenilaian, kerjakanPenilaianAcuan, kerjakanPenilaianLokal,
  pembandingPanjang, simpanPoinRubrik,
} from "@/lib/nilai-otomatis";
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
      aiSiap: await aiSiap(),
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

    // ---------- PENILAIAN DARI JAWABAN ACUAN PENGAJAR ----------
    //
    // Jalur ketiga, dan satu-satunya yang mengukur ISI jawaban. Tanpa
    // jaringan, tanpa kunci API, tanpa biaya per jawaban. Rumusnya cosine
    // similarity atas bobot kata TF-IDF; lihat src/lib/nilai-acuan.ts.
    //
    // Batas MAKS_SEKALI_NILAI tidak berlaku, sama seperti penilaian lokal:
    // yang membatasi penilaian model adalah umur satu permintaan HTTP yang
    // diisi panggilan jaringan berulang, dan di sini tidak ada satu pun
    // panggilan jaringan.
    if (aksi === "acuan") {
      const acuan = await acuanUjian(ujian.answerKeyId);
      if (!acuan || acuan.butir.length === 0) {
        return Response.json(
          {
            success: false,
            message:
              "Ujian ini belum memakai jawaban acuan. Pilih satu acuan pada Pengaturan Ujian, " +
              "atau buat yang baru di menu Penilaian esai.",
          },
          { status: 400 },
        );
      }

      const attemptSatu = angkaParam(String(body.attempt ?? ""));
      const pesertaAcuan = attemptSatu
        ? await db
            .select()
            .from(cbtAttempts)
            .where(and(eq(cbtAttempts.id, attemptSatu), eq(cbtAttempts.examId, examId)))
            .limit(1)
        : await db.select().from(cbtAttempts).where(eq(cbtAttempts.examId, examId)).limit(400);

      if (pesertaAcuan.length === 0) {
        return Response.json({ success: false, message: "Belum ada peserta yang dapat dinilai." }, { status: 400 });
      }

      const antreAcuan = await antreEsai(examId, pesertaAcuan, body.ulangi === true);
      if (antreAcuan.length === 0) {
        return Response.json({
          success: true,
          dinilai: 0,
          sisa: 0,
          pesan: "Semua jawaban sudah pernah dinilai. Pakai 'nilai ulang' bila ingin mengulanginya.",
        });
      }

      const dinilaiAcuan = await kerjakanPenilaianAcuan(examId, acuan, antreAcuan);

      // Bobot kata TF-IDF bergantung pada seluruh lembar yang dibandingkan,
      // jadi menilai di tengah ujian memakai korpus yang belum lengkap. Itu
      // tidak salah, tetapi harus dikatakan: dua jawaban yang sama persis
      // dapat bernilai sedikit berbeda bila dinilai pada putaran yang berbeda.
      // "Nilai ulang" sesudah kelasnya selesai menyamakan semuanya dengan satu
      // korpus yang sama.
      const masihBerjalan = await db
        .select({ jumlah: sql<number>`count(*)::int` })
        .from(cbtAttempts)
        .where(and(eq(cbtAttempts.examId, examId), eq(cbtAttempts.status, "berjalan")));
      const belumKumpul = masihBerjalan[0]?.jumlah ?? 0;

      return Response.json({
        success: true,
        dinilai: dinilaiAcuan,
        sisa: 0,
        pesan:
          belumKumpul > 0
            ? `${dinilaiAcuan} jawaban dinilai dengan acuan "${acuan.nama}". ${belumKumpul} peserta masih mengerjakan; ` +
              "jalankan nilai ulang sesudah semuanya mengumpulkan supaya seluruh kelas dinilai dengan pembanding yang sama."
            : `${dinilaiAcuan} jawaban dinilai dengan acuan "${acuan.nama}".`,
      });
    }

    // ---------- DUA PENILAI LAIN ----------
    //
    // "lokal" adalah bawaan. Menghitung dari bentuk jawaban: panjang dibanding
    //   sekelas, cakupan istilah soal, susunan kalimat. Tanpa jaringan, tanpa
    //   kunci, tanpa biaya. Inilah yang dijalankan papan pantau sendiri.
    // "ai" berjalan atas permintaan, lewat tombolnya. Membaca isinya, dan itu
    //   satu panggilan model berbayar per jawaban.
    //
    // Keduanya menulis ke kolom yang sama dan sama-sama hanya MENGUSULKAN;
    // level yang diubah pengajar selalu menang atas keduanya.
    if (aksi !== "ai" && aksi !== "lokal") {
      return Response.json({ success: false, message: "Aksi tidak dikenali." }, { status: 400 });
    }

    if (aksi === "ai" && !(await aiSiap())) {
      return Response.json(
        {
          success: false,
          message:
            "Penilaian AI belum tersambung. Tempel kunci Gemini, ChatGPT, atau Claude di " +
            "Dashboard Super Admin → Kunci AI. Penilaian otomatis tanpa " +
            "model dan penilaian manual tetap jalan.",
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
            "Ujian ini belum memakai rubrik. Pilih satu rubrik pada Pengaturan Ujian, " +
            "ada beberapa rubrik siap pakai yang tinggal disalin.",
        },
        { status: 400 },
      );
    }

    const attemptId = angkaParam(String(body.attempt ?? ""));

    // Peserta mana saja yang dinilai: satu orang, atau seluruh yang sudah
    // mengumpulkan.
    const peserta = attemptId
      ? await db
          .select()
          .from(cbtAttempts)
          .where(and(eq(cbtAttempts.id, attemptId), eq(cbtAttempts.examId, examId)))
          .limit(1)
      : await db.select().from(cbtAttempts).where(eq(cbtAttempts.examId, examId)).limit(400);

    if (peserta.length === 0) {
      return Response.json({ success: false, message: "Belum ada peserta yang dapat dinilai." }, { status: 400 });
    }

    const antre = await antreEsai(examId, peserta, body.ulangi === true);
    if (antre.length === 0) {
      return Response.json({
        success: true,
        dinilai: 0,
        sisa: 0,
        pesan: "Semua jawaban sudah pernah dinilai. Pakai 'nilai ulang' bila ingin mengulanginya.",
      });
    }

    // Penilaian lokal tidak memanggil apa pun ke luar, jadi batas per
    // panggilan tidak berlaku untuknya: yang membatasi penilaian model adalah
    // umur satu permintaan HTTP yang diisi panggilan jaringan berulang.
    const kerjakan = aksi === "lokal" ? antre : antre.slice(0, MAKS_SEKALI_NILAI);
    const { dinilai, gagal } =
      aksi === "lokal"
        ? await kerjakanPenilaianLokal(rubrik, kerjakan, await pembandingPanjang(peserta))
        : await kerjakanPenilaian(rubrik, kerjakan, ujian.courseName);

    return Response.json({
      success: true,
      dinilai,
      sisa: antre.length - kerjakan.length,
      gagal,
      pesan:
        antre.length > kerjakan.length
          ? `${dinilai} jawaban dinilai. Masih ada ${antre.length - kerjakan.length} lagi, tekan sekali lagi untuk melanjutkan.`
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
