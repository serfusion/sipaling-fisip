// ============================================================
// CBT — JALUR MAHASISWA (TANPA LOGIN)
//
// Ini satu-satunya jalur yang terbuka untuk umum, dan karena itu ia yang
// paling ketat aturannya:
//
//   1. KUNCI JAWABAN TIDAK PERNAH IKUT KELUAR sebelum ujiannya selesai. Yang
//      dikirim hanya pertanyaan dan pilihan yang sudah diacak.
//   2. WAKTU DIHITUNG DI SERVER. Jam di peramban mahasiswa dapat diputar
//      mundur; kalau batasnya dihitung di sana, ujian enam puluh menit dapat
//      dikerjakan semalaman.
//   3. IDENTITASNYA MELEKAT PADA ATTEMPT, bukan pada akun. Sesudah masuk,
//      yang dipegang perambannya adalah kunci sesi acak — bukan NIM, yang
//      dapat ditebak siapa pun yang tahu pola nomor induk kampus.
//
// GET  ?kode=XXXX      lihat ujian, sebelum masuk
// POST aksi=masuk      buat attempt, kembalikan soalnya
// POST aksi=lanjut     ambil kembali attempt yang tertunda
// POST aksi=jawab      auto-save satu jawaban
// POST aksi=selesai    kumpulkan dan nilai
// POST aksi=langgar    catat keluar fullscreen / pindah tab
// ============================================================
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { cbtAnswers, cbtAttempts, cbtExams } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { blockedByMaintenance } from "@/lib/maintenance-gate";
import {
  batasWaktu, benihBaru, bolehMasuk, hitungNilai, nilaiJawaban, periksaMasuk,
  sisaDetik, statusUjian, susunPaket, type Soal,
} from "@/lib/cbt";
import { attemptDariKunci, bacaLembar, soalUjian, ujianDariKode, type Ujian } from "@/lib/cbt-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Berapa angka minimal sebuah NIM. Menahan salah ketik, bukan memvalidasi. */
const NIM_MIN = 6;

function kunciSesiBaru() {
  return randomBytes(24).toString("hex");
}

/** Keterangan ujian yang aman dilihat siapa pun — tanpa soal, tanpa kunci. */
function ringkasUjian(u: Ujian, sekarang: Date) {
  const status = statusUjian({ aktif: Boolean(u.activatedAt), mulai: u.startAt, selesai: u.endAt }, sekarang);
  return {
    kode: u.code,
    judul: u.title,
    mataKuliah: u.courseName,
    kelas: u.className,
    deskripsi: u.description,
    instruksi: u.instruction,
    durasi: u.durationMinutes,
    jumlahSoal: u.questionCount,
    pakaiToken: Boolean(u.token),
    bisaKembali: u.allowBack,
    tampilkanNilai: u.showScore,
    status,
    mulai: u.startAt ? u.startAt.toISOString() : null,
    selesai: u.endAt ? u.endAt.toISOString() : null,
  };
}

export async function GET(request: Request) {
  const batas = rateLimit({ request, name: "cbt-lihat", limit: 120, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const kode = String(new URL(request.url).searchParams.get("kode") || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12);
    if (!kode) return Response.json({ success: false, message: "Kode ujian belum diisi." }, { status: 400 });

    const ujian = await ujianDariKode(kode);
    // Ujian yang belum diaktifkan dijawab sama seperti ujian yang tidak ada.
    // Membedakan keduanya memberi tahu orang luar bahwa ada ujian di balik
    // kode itu, dan kode ujian memang dibagikan lewat grup kelas.
    if (!ujian || !ujian.activatedAt) {
      return Response.json({ success: false, message: "Ujian tidak ditemukan atau belum dibuka." }, { status: 404 });
    }
    return Response.json({ success: true, ujian: ringkasUjian(ujian, new Date()) });
  } catch (error: unknown) {
    console.error("lihat ujian cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Ujian belum dapat dibuka.") },
      { status: 500 },
    );
  }
}

/** Soal untuk layar mahasiswa: pertanyaan dan pilihan saja. */
function lembarUntukLayar(bank: Soal[], lembar: Array<{ id: number; peta: number[] }>) {
  const peta = new Map(bank.map((s) => [s.id, s]));
  return lembar
    .map((item) => {
      const soal = peta.get(item.id);
      if (!soal) return null;
      return {
        id: soal.id,
        jenis: soal.jenis,
        pertanyaan: soal.pertanyaan,
        // Urutan pilihan mengikuti peta yang tersimpan pada attempt, supaya
        // memuat ulang halaman tidak mengubah letak jawaban yang sudah dipilih.
        pilihan: item.peta.length ? item.peta.map((i) => soal.pilihan[i] ?? "") : soal.pilihan,
        bobot: soal.bobot,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
}

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "cbt-ikut", limit: 600, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  const tutup = await blockedByMaintenance();
  if (tutup) return tutup;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const aksi = String(body.aksi || "");

    // ---------- MASUK ----------
    if (aksi === "masuk") {
      const kode = String(body.kode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
      const ujian = await ujianDariKode(kode);
      if (!ujian || !ujian.activatedAt) {
        return Response.json({ success: false, message: "Ujian tidak ditemukan atau belum dibuka." }, { status: 404 });
      }

      const sekarang = new Date();
      const status = statusUjian({ aktif: true, mulai: ujian.startAt, selesai: ujian.endAt }, sekarang);
      if (!bolehMasuk({ aktif: true, mulai: ujian.startAt, selesai: ujian.endAt }, sekarang)) {
        const pesan =
          status === "terjadwal"
            ? `Ujian belum dibuka. Mulai ${ujian.startAt?.toLocaleString("id-ID") ?? "-"}.`
            : "Ujian ini sudah ditutup.";
        return Response.json({ success: false, message: pesan, status }, { status: 409 });
      }

      const identitas = periksaMasuk(body, { token: ujian.token, nimMin: NIM_MIN });
      if (!identitas.ok) return Response.json({ success: false, message: identitas.pesan }, { status: 400 });

      // Attempt yang masih berjalan dikembalikan apa adanya. Mahasiswa yang
      // ponselnya mati lalu masuk lagi harus menemukan lembar yang SAMA,
      // dengan sisa waktu yang terus berjalan — bukan ujian baru yang kosong.
      const sudah = await db
        .select()
        .from(cbtAttempts)
        .where(and(eq(cbtAttempts.examId, ujian.id), eq(cbtAttempts.nim, identitas.nim)));

      const berjalan = sudah.find((a) => a.status === "berjalan");
      if (berjalan) {
        const bank = await soalUjian(ujian.id);
        const lembar = bacaLembar(berjalan.paper);
        const jawaban = await db.select().from(cbtAnswers).where(eq(cbtAnswers.attemptId, berjalan.id));
        return Response.json({
          success: true,
          lanjut: true,
          kunciSesi: berjalan.sessionKey,
          ujian: ringkasUjian(ujian, sekarang),
          soal: lembarUntukLayar(bank, lembar),
          jawaban: Object.fromEntries(jawaban.map((j) => [j.questionId, j.answer])),
          ditandai: jawaban.filter((j) => j.marked).map((j) => j.questionId),
          sisaDetik: sisaDetik(berjalan.deadlineAt, sekarang),
        });
      }

      if (sudah.length >= ujian.maxAttempts) {
        return Response.json(
          {
            success: false,
            message:
              ujian.maxAttempts === 1
                ? "NIM ini sudah mengerjakan ujian tersebut. Satu kali percobaan saja."
                : `NIM ini sudah memakai ${sudah.length} dari ${ujian.maxAttempts} percobaan.`,
          },
          { status: 409 },
        );
      }

      const bank = await soalUjian(ujian.id);
      if (bank.length === 0) {
        return Response.json({ success: false, message: "Ujian ini belum berisi soal." }, { status: 409 });
      }

      const benih = benihBaru();
      const paket = susunPaket(
        bank,
        {
          acakSoal: ujian.randomQuestions,
          acakPilihan: ujian.randomOptions,
          jumlahSoal: ujian.questionCount,
        },
        benih,
      );
      const lembar = paket.map((s) => ({ id: s.id, peta: s.petaPilihan }));
      const deadline = batasWaktu(sekarang, ujian.durationMinutes, ujian.endAt);
      const kunciSesi = kunciSesiBaru();

      try {
        await db.insert(cbtAttempts).values({
          examId: ujian.id,
          nim: identitas.nim,
          name: identitas.nama,
          attemptNo: sudah.length + 1,
          sessionKey: kunciSesi,
          seed: benih,
          paper: JSON.stringify(lembar),
          startedAt: sekarang,
          deadlineAt: deadline,
          lastSeenAt: sekarang,
        });
      } catch {
        // Indeks unik (ujian, nim, percobaan) menolak dua permintaan yang
        // datang bersamaan. Yang kalah membaca attempt yang barusan menang.
        const ulang = await db
          .select()
          .from(cbtAttempts)
          .where(and(eq(cbtAttempts.examId, ujian.id), eq(cbtAttempts.nim, identitas.nim)));
        const hidup = ulang.find((a) => a.status === "berjalan");
        if (!hidup) {
          return Response.json({ success: false, message: "Ujian belum dapat dimulai. Coba lagi." }, { status: 500 });
        }
        return Response.json({
          success: true,
          lanjut: true,
          kunciSesi: hidup.sessionKey,
          ujian: ringkasUjian(ujian, sekarang),
          soal: lembarUntukLayar(bank, bacaLembar(hidup.paper)),
          jawaban: {},
          sisaDetik: sisaDetik(hidup.deadlineAt, sekarang),
        });
      }

      return Response.json({
        success: true,
        lanjut: false,
        kunciSesi,
        ujian: ringkasUjian(ujian, sekarang),
        soal: paket.map((s) => ({
          id: s.id, jenis: s.jenis, pertanyaan: s.pertanyaan, pilihan: s.pilihan, bobot: s.bobot,
        })),
        jawaban: {},
        sisaDetik: sisaDetik(deadline, sekarang),
      });
    }

    // ---------- SEMUA AKSI DI BAWAH MENUNTUT KUNCI SESI ----------
    const kunciSesi = String(body.kunciSesi || "");
    const attempt = await attemptDariKunci(kunciSesi);
    if (!attempt) {
      return Response.json({ success: false, message: "Sesi ujian tidak dikenali." }, { status: 401 });
    }
    const sekarang = new Date();

    // ---------- LANJUT ----------
    if (aksi === "lanjut") {
      const ujianRow = await db.select().from(cbtExams).where(eq(cbtExams.id, attempt.examId)).limit(1);
      const ujian = ujianRow[0];
      if (!ujian) return Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 });
      const bank = await soalUjian(attempt.examId);
      const jawaban = await db.select().from(cbtAnswers).where(eq(cbtAnswers.attemptId, attempt.id));
      void db
        .update(cbtAttempts)
        .set({ lastSeenAt: sekarang })
        .where(eq(cbtAttempts.id, attempt.id))
        .catch(() => undefined);
      return Response.json({
        success: true,
        selesai: attempt.status !== "berjalan",
        ujian: ringkasUjian(ujian, sekarang),
        soal: lembarUntukLayar(bank, bacaLembar(attempt.paper)),
        jawaban: Object.fromEntries(jawaban.map((j) => [j.questionId, j.answer])),
        ditandai: jawaban.filter((j) => j.marked).map((j) => j.questionId),
        sisaDetik: sisaDetik(attempt.deadlineAt, sekarang),
      });
    }

    if (attempt.status !== "berjalan") {
      return Response.json({ success: false, message: "Ujian ini sudah dikumpulkan." }, { status: 409 });
    }

    // ---------- CATAT PELANGGARAN ----------
    if (aksi === "langgar") {
      const jenis = String(body.jenis || "");
      const kolom =
        jenis === "fullscreen"
          ? { leftFullscreen: sql`${cbtAttempts.leftFullscreen} + 1` }
          : jenis === "tab"
            ? { switchedTab: sql`${cbtAttempts.switchedTab} + 1` }
            : null;
      if (kolom) {
        await db.update(cbtAttempts).set({ ...kolom, lastSeenAt: sekarang }).where(eq(cbtAttempts.id, attempt.id));
      }
      return Response.json({ success: true });
    }

    // ---------- TANDAI UNTUK DITINJAU ----------
    if (aksi === "tandai") {
      const questionId = Number(body.soal);
      const lembar = bacaLembar(attempt.paper);
      if (!lembar.some((l) => l.id === questionId)) {
        return Response.json({ success: false, message: "Soal ini bukan bagian dari lembar Anda." }, { status: 400 });
      }
      const tandai = body.tandai !== false;
      await db
        .insert(cbtAnswers)
        .values({ attemptId: attempt.id, questionId, answer: "", marked: tandai, updatedAt: sekarang })
        .onConflictDoUpdate({
          target: [cbtAnswers.attemptId, cbtAnswers.questionId],
          // HANYA kolom penanda yang disentuh. Menulis ulang answer di sini
          // akan menghapus jawaban yang sudah diketik mahasiswa hanya karena
          // ia menandai soalnya untuk ditinjau.
          set: { marked: tandai, updatedAt: sekarang },
        });
      return Response.json({ success: true, ditandai: tandai });
    }

    // ---------- AUTO-SAVE ----------
    if (aksi === "jawab") {
      // Lewat batas waktu, jawaban baru TIDAK diterima lagi — tetapi yang
      // sudah tersimpan tetap dihitung. Menolak dengan galat membuat mahasiswa
      // menyangka seluruh pekerjaannya hilang.
      if (sekarang.getTime() > attempt.deadlineAt.getTime()) {
        return Response.json({ success: false, habis: true, message: "Waktu ujian sudah habis." }, { status: 409 });
      }

      const questionId = Number(body.soal);
      const lembar = bacaLembar(attempt.paper);
      if (!lembar.some((l) => l.id === questionId)) {
        return Response.json({ success: false, message: "Soal ini bukan bagian dari lembar Anda." }, { status: 400 });
      }
      const jawaban = String(body.jawaban ?? "").slice(0, 8000);

      await db
        .insert(cbtAnswers)
        .values({ attemptId: attempt.id, questionId, answer: jawaban, updatedAt: sekarang })
        .onConflictDoUpdate({
          target: [cbtAnswers.attemptId, cbtAnswers.questionId],
          set: { answer: jawaban, updatedAt: sekarang },
        });
      await db.update(cbtAttempts).set({ lastSeenAt: sekarang }).where(eq(cbtAttempts.id, attempt.id));

      return Response.json({ success: true, sisaDetik: sisaDetik(attempt.deadlineAt, sekarang) });
    }

    // ---------- KUMPULKAN ----------
    if (aksi === "selesai") {
      const ujianRow = await db.select().from(cbtExams).where(eq(cbtExams.id, attempt.examId)).limit(1);
      const ujian = ujianRow[0];
      if (!ujian) return Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 });

      const bank = await soalUjian(attempt.examId);
      const lembar = bacaLembar(attempt.paper);
      const dipakai = lembar
        .map((l) => bank.find((s) => s.id === l.id))
        .filter((s): s is Soal => Boolean(s));
      const petaPilihan = Object.fromEntries(lembar.map((l) => [l.id, l.peta]));

      const tersimpan = await db.select().from(cbtAnswers).where(eq(cbtAnswers.attemptId, attempt.id));
      const jawaban = Object.fromEntries(tersimpan.map((j) => [j.questionId, j.answer]));

      const ringkas = hitungNilai(dipakai, jawaban, petaPilihan, ujian.passingGrade);

      // Tiap jawaban ikut dinilai satu per satu, supaya dosen dapat melihat
      // mana yang benar dan mana yang salah tanpa menghitung ulang.
      for (const soal of dipakai) {
        const isi = String(jawaban[soal.id] ?? "");
        const hasil = nilaiJawaban(soal, isi, petaPilihan[soal.id]);
        await db
          .insert(cbtAnswers)
          .values({
            attemptId: attempt.id, questionId: soal.id, answer: isi,
            isCorrect: hasil.benar, points: hasil.poin, updatedAt: sekarang,
          })
          .onConflictDoUpdate({
            target: [cbtAnswers.attemptId, cbtAnswers.questionId],
            set: { isCorrect: hasil.benar, points: hasil.poin, updatedAt: sekarang },
          });
      }

      const lewatWaktu = sekarang.getTime() > attempt.deadlineAt.getTime();
      await db
        .update(cbtAttempts)
        .set({
          status: lewatWaktu ? "waktu_habis" : "selesai",
          submittedAt: sekarang,
          score: Math.round(ringkas.nilai),
          correct: ringkas.benar,
          wrong: ringkas.salah,
          blank: ringkas.kosong,
          pending: ringkas.tertunda,
          lastSeenAt: sekarang,
        })
        .where(eq(cbtAttempts.id, attempt.id));

      return Response.json({
        success: true,
        // Nilai hanya ditampilkan bila dosennya mengizinkan. Sebagian ujian
        // memang diumumkan belakangan, dan itu keputusan dosennya.
        tampilkanNilai: ujian.showScore,
        hasil: ujian.showScore
          ? {
              nilai: ringkas.nilai, benar: ringkas.benar, salah: ringkas.salah,
              kosong: ringkas.kosong, tertunda: ringkas.tertunda,
              lulus: ringkas.lulus, passing: ujian.passingGrade,
            }
          : null,
      });
    }

    return Response.json({ success: false, message: "Aksi tidak dikenali." }, { status: 400 });
  } catch (error: unknown) {
    console.error("jalur ujian cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Ujian belum dapat diproses.") },
      { status: 500 },
    );
  }
}
