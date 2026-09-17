// ============================================================
// CBT — MENGIRIM LAPORAN NILAI KE MAHASISWA
//
// GET  ?ujian=            kesiapan kirim + riwayat pengiriman ujian ini
// POST aksi=satu          kirim ke satu peserta
// POST aksi=semua         kirim ke seluruh peserta yang nilainya sudah disetujui
//
// Yang menentukan di sini bukan kodenya melainkan SATU ATURAN: hanya nilai
// yang sudah disetujui dosen yang dikirim. Aturan itu ditegakkan di dalam
// kirimLaporanNilai(), satu lapis lebih dalam, supaya jalur mana pun yang
// dipakai — tombol satuan, tombol massal, atau pengiriman otomatis sesudah
// persetujuan — melewati pemeriksaan yang sama persis.
// ============================================================
import { db } from "@/db";
import { cbtAttempts, cbtExams, cbtResultEmails } from "@/db/schema";
import { desc, eq, inArray, isNotNull, and } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { angkaParam, bolehCbt, bolehUbah, bolehPantau } from "@/lib/cbt";
import { kirimLaporanNilai, suratSiap } from "@/lib/kirim-nilai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paling banyak berapa surat dalam satu permintaan.
 *
 * Tiap surat adalah satu perjalanan HTTPS ke penyedia yang memakan ratusan
 * milidetik. Empat puluh surat sekaligus akan menabrak batas waktu fungsi,
 * dan yang paling buruk dari itu bukan galatnya melainkan keadaan sesudahnya:
 * sebagian terkirim, sebagian tidak, dan tidak ada yang tahu yang mana.
 *
 * Karena itu dibatasi, dan jawaban menyebut berapa yang tersisa. Catatan
 * pengiriman di basis data yang menentukan mana yang sudah — jadi tekan lagi
 * tidak pernah mengirim ulang kepada orang yang sama.
 */
const MAKS_SEKALI_KIRIM = 25;

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
              ? "Pengiriman nilai hanya oleh pengajar pemilik ujiannya."
              : "Ujian ini milik pengajar lain.",
        },
        { status: 403 },
      ),
    };
  }
  return { profile, ujian };
}

export async function GET(request: Request) {
  try {
    const examId = angkaParam(new URL(request.url).searchParams.get("ujian"));
    if (examId === null) return Response.json({ success: false, message: "Ujian tidak dikenali." }, { status: 400 });
    const cek = await gerbang(examId, "pantau");
    if ("gagal" in cek) return cek.gagal;

    const peserta = await db
      .select({
        id: cbtAttempts.id,
        nama: cbtAttempts.name,
        nim: cbtAttempts.nim,
        email: cbtAttempts.email,
        disetujui: cbtAttempts.approvedAt,
        terkirim: cbtAttempts.reportSentAt,
      })
      .from(cbtAttempts)
      .where(eq(cbtAttempts.examId, examId))
      .limit(500);

    const riwayat = peserta.length
      ? await db
          .select()
          .from(cbtResultEmails)
          .where(inArray(cbtResultEmails.attemptId, peserta.map((p) => p.id)))
          .orderBy(desc(cbtResultEmails.createdAt))
          .limit(100)
      : [];

    const siap = suratSiap();
    const disetujui = peserta.filter((p) => p.disetujui);

    return Response.json({
      success: true,
      siap: siap.siap,
      sebabBelumSiap: siap.sebab,
      jumlah: {
        peserta: peserta.length,
        disetujui: disetujui.length,
        terkirim: peserta.filter((p) => p.terkirim).length,
        // Yang sudah disetujui tetapi tidak punya alamat. Dihitung di sini
        // supaya panel dapat mengatakannya SEBELUM dosen menekan kirim
        // massal, bukan sesudahnya sebagai daftar kegagalan.
        tanpaEmail: disetujui.filter((p) => !p.email).length,
      },
      riwayat: riwayat.map((r) => ({
        attemptId: r.attemptId,
        email: r.email,
        status: r.status,
        galat: r.error || "",
        oleh: r.sentBy || "",
        jam: r.createdAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    console.error("kesiapan kirim nilai", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Riwayat pengiriman belum dapat dimuat.") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const examId = angkaParam(String(body.ujian ?? ""));
    if (examId === null) return Response.json({ success: false, message: "Ujian tidak dikenali." }, { status: 400 });

    const cek = await gerbang(examId, "ubah");
    if ("gagal" in cek) return cek.gagal;
    const { profile } = cek;

    const aksi = String(body.aksi ?? "satu");
    const paksa = body.paksa === true;

    // ---------- SATU PESERTA ----------
    if (aksi === "satu") {
      const attemptId = angkaParam(String(body.attempt ?? ""));
      if (attemptId === null) {
        return Response.json({ success: false, message: "Peserta tidak dikenali." }, { status: 400 });
      }
      const hasil = await kirimLaporanNilai({ attemptId, examId, dikirimOleh: profile.fullName, paksa });
      // Gagal yang DAPAT DIPERKIRAKAN — alamat kosong, belum disetujui —
      // dijawab 200 beserta keterangannya, bukan sebagai galat. Panel
      // menampilkannya sebagai kabar yang perlu dibaca, dan dosen tahu apa
      // yang harus ia perbaiki.
      return Response.json({ success: true, ...hasil });
    }

    // ---------- SELURUH YANG SUDAH DISETUJUI ----------
    if (aksi !== "semua") {
      return Response.json({ success: false, message: "Aksi tidak dikenali." }, { status: 400 });
    }

    const calon = await db
      .select({ id: cbtAttempts.id, nama: cbtAttempts.name, email: cbtAttempts.email, terkirim: cbtAttempts.reportSentAt })
      .from(cbtAttempts)
      .where(and(eq(cbtAttempts.examId, examId), isNotNull(cbtAttempts.approvedAt)))
      .limit(500);

    const antre = calon.filter((p) => Boolean(p.email) && (paksa || !p.terkirim));
    if (antre.length === 0) {
      const tanpaEmail = calon.filter((p) => !p.email).length;
      return Response.json({
        success: true,
        terkirim: 0,
        gagal: [],
        sisa: 0,
        pesan:
          calon.length === 0
            ? "Belum ada nilai yang disetujui. Setujui dulu nilainya, baru laporannya dapat dikirim."
            : tanpaEmail > 0
              ? `Semua yang punya alamat sudah dikirimi. ${tanpaEmail} peserta belum punya alamat email di daftar mahasiswa.`
              : "Semua laporan sudah pernah dikirim.",
      });
    }

    const kerjakan = antre.slice(0, MAKS_SEKALI_KIRIM);
    let terkirim = 0;
    const gagal: string[] = [];

    for (const p of kerjakan) {
      try {
        const hasil = await kirimLaporanNilai({ attemptId: p.id, examId, dikirimOleh: profile.fullName, paksa });
        if (hasil.terkirim) terkirim += 1;
        else gagal.push(`${p.nama}: ${hasil.pesan}`);
      } catch (galat) {
        // Satu surat yang gagal tidak menghentikan sisanya. Yang dikirim
        // adalah nilai dua puluh empat orang lain, dan menahannya karena satu
        // alamat yang bermasalah menghukum dua puluh empat orang.
        console.error("kirim nilai massal", p.id, galat);
        gagal.push(`${p.nama}: gagal dikirim.`);
      }
    }

    const sisa = antre.length - kerjakan.length;
    return Response.json({
      success: true,
      terkirim,
      gagal,
      sisa,
      pesan:
        sisa > 0
          ? `${terkirim} laporan terkirim. Masih ada ${sisa} lagi — tekan sekali lagi untuk melanjutkan.`
          : `${terkirim} laporan terkirim.`,
    });
  } catch (error: unknown) {
    console.error("kirim nilai", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Laporan belum dapat dikirim.") },
      { status: 500 },
    );
  }
}
