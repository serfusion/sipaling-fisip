// ============================================================
// CBT — TAUTAN & KODE QR SATU UJIAN
//
// GET /api/cbt/tautan?ujian=<id>
//
// Mengembalikan alamat yang dibagikan ke mahasiswa beserta kode QR-nya:
// SVG untuk ditampilkan dan dicetak, PNG untuk diunduh dan ditempel ke grup.
//
// ALAMATNYA DISUSUN DI SERVER, bukan di peramban. Peramban dosen tahu ia
// sedang membuka domain utama, tetapi TIDAK tahu apakah CBT dipasang pada
// subdomainnya sendiri — yang tahu hanya environment, dan environment ada di
// sini. Tautan yang salah domain baru ketahuan sesudah tersalin ke grup kelas.
//
// Kode QR dirakit di server dengan alasan yang sama sederhananya: pustaka
// qrcode sudah ada di proyek ini (dipakai QRIS Cakrawala), dan memuatnya ke
// dalam bundel dashboard hanya demi satu gambar berarti setiap dosen yang
// membuka dashboard ikut mengunduhnya, termasuk yang tidak menyentuh CBT.
// ============================================================
import QRCode from "qrcode";
import { db } from "@/db";
import { cbtExams, cbtQuestions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { angkaParam, bolehCbt, bolehPantau, statusUjian } from "@/lib/cbt";
import { asalCbtEnv, asalPermintaan, tautanUjian } from "@/lib/tautan-cbt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Warna QR-nya sengaja biru tua jenama, bukan hitam. Kontrasnya terhadap putih
// masih jauh di atas yang dibutuhkan pemindai mana pun, dan poster yang
// tercetak jadi satu benda dengan situsnya.
const TINTA = "#1e2d6b";

export async function GET(request: Request) {
  const batas = rateLimit({ request, name: "cbt-tautan", limit: 120, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) {
      return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
    }

    const alamat = new URL(request.url);
    const examId = angkaParam(alamat.searchParams.get("ujian"));
    if (examId === null) {
      return Response.json({ success: false, message: "Ujian tidak dikenali." }, { status: 400 });
    }

    const baris = await db.select().from(cbtExams).where(eq(cbtExams.id, examId)).limit(1);
    const ujian = baris[0];
    if (!ujian) return Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 });
    if (!bolehPantau(profile, ujian)) {
      return Response.json(
        { success: false, message: "Tautan ujian ini hanya dapat dilihat dosen pemiliknya." },
        { status: 403 },
      );
    }

    const asal = asalPermintaan(request);
    const tautan = tautanUjian(ujian.code, asal, asalCbtEnv(asal));

    // Toleransi galat M, bukan L. Poster ujian ditempel di pintu ruangan,
    // tersentuh tangan, dan tercetak pencetak kantor yang tintanya menipis;
    // seperempat modul yang boleh rusak adalah selisih antara QR yang terbaca
    // dan tiga puluh mahasiswa yang mengetik alamatnya satu per satu.
    const pilihan = { errorCorrectionLevel: "M" as const, margin: 1, color: { dark: TINTA, light: "#ffffff" } };
    const [qrSvg, qrPng] = await Promise.all([
      QRCode.toString(tautan, { ...pilihan, type: "svg", width: 512 }),
      QRCode.toDataURL(tautan, { ...pilihan, width: 900 }),
    ]);

    // Jumlah soal di bank ikut dihitung: yang dikerjakan mahasiswa adalah
    // questionCount, tetapi ujian yang belum disetel jumlahnya bernilai nol,
    // dan "0 soal" pada pesan grup adalah kabar yang salah.
    const bank = await db
      .select({ jumlah: sql<number>`count(*)::int` })
      .from(cbtQuestions)
      .where(eq(cbtQuestions.examId, examId));
    const jumlahBank = Number(bank[0]?.jumlah ?? 0);

    return Response.json({
      success: true,
      tautan,
      qrSvg,
      qrPng,
      ujian: {
        kode: ujian.code,
        judul: ujian.title,
        mataKuliah: ujian.courseName,
        kelas: ujian.className,
        token: ujian.token,
        jumlahSoal: ujian.questionCount || jumlahBank,
        durasi: ujian.durationMinutes,
        mulai: ujian.startAt ? ujian.startAt.toISOString() : null,
        selesai: ujian.endAt ? ujian.endAt.toISOString() : null,
        aktif: Boolean(ujian.activatedAt),
        status: statusUjian({
          aktif: Boolean(ujian.activatedAt),
          mulai: ujian.startAt,
          selesai: ujian.endAt,
        }),
      },
    });
  } catch (alasan: unknown) {
    return Response.json({ success: false, message: explainServerError(alasan, "Tautan ujian belum dapat disusun.") }, { status: 500 });
  }
}
