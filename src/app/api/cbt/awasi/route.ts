// ============================================================
// CBT — PENGAWASAN KAMERA
//
// Jalur ini menerima cuplikan kamera peserta dari layar ujian, dan ia dibangun
// di sekitar tiga batas yang semuanya ditegakkan DI SINI, bukan di peramban.
//
//   1. BATAS UANG. Tiap attempt punya jatah pemeriksaan model (aturanMode →
//      jatahAi). Peramban peserta dapat disuruh mengirim seribu cuplikan, dan
//      yang membayarnya pemilik portal — jadi jatahnya dihitung dari kolom di
//      basis data, bukan dari angka yang ikut dikirim perambannya.
//   2. BATAS PENYIMPANAN. Cuplikan yang BERSIH dibuang begitu selesai
//      diperiksa dan tidak pernah menyentuh Storage. Yang tersimpan hanya yang
//      memang bermasalah. Wajah ratusan orang yang tidak berbuat apa-apa tidak
//      menjadi arsip yang harus dijaga berbulan-bulan.
//   3. BATAS TUDUHAN. Model yang menjawab "saya tidak yakin" TIDAK
//      menghasilkan catatan apa pun. Ketidakyakinan bukan bukti, dan
//      mencatatnya sebagai insiden berarti menghukum peserta atas keterbatasan
//      alatnya.
//
// Sebagian besar cuplikan tidak pernah sampai ke sini. Lensa yang tertutup dan
// gambar yang beku dikenali di perangkat pesertanya sendiri (lihat
// src/lib/awas-kamera.ts) dan dilaporkan lewat jalur insiden biasa — tanpa
// gambar, tanpa model, tanpa biaya.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { cbtAttempts, cbtExams, cbtIncidents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase-config";
import { attemptDariKunci } from "@/lib/cbt-store";
import {
  SKEMA_BACAAN, bacaanKeInsiden, type BacaanModel,
} from "@/lib/awas-kamera";
import { aturanMode, kameraMenyala, rapikanMode, skorIntegritas } from "@/lib/pengawasan";
import { mintaJson, penyediaTersedia } from "@/lib/ai-penyedia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_BUKTI = "cbt-bukti";

/** Paling banyak berapa cuplikan dalam satu permintaan. */
const MAKS_CUPLIKAN = 4;
/** Batas ukuran satu cuplikan sesudah diurai dari base64. */
const MAKS_BITA = 400_000;

const SISTEM = `Anda pengawas ujian yang memeriksa satu cuplikan kamera peserta.

Jawab HANYA yang benar-benar terlihat. Bila gambarnya buram, gelap, atau
terpotong sehingga Anda tidak dapat memastikan berapa orang yang ada, isi
"orang" dengan -1. Menebak dalam keadaan itu merugikan peserta yang jujur,
karena catatannya masuk ke laporan ujian sertifikasinya.

Yang dihitung sebagai orang hanyalah manusia yang benar-benar hadir di depan
kamera. Wajah pada poster, foto di dinding, dan orang di layar televisi TIDAK
dihitung.

Isi "catatan" dengan satu kalimat bahasa Indonesia yang menerangkan apa yang
terlihat, seperti yang akan dibaca dosen penguji.`;

/** Base64 → bita, dengan batas ukuran. Kiriman dari luar, jadi dijaga ketat. */
function bacaBase64(masukan: unknown): { data: string; bita: Buffer } | null {
  const teks = String(masukan ?? "").replace(/^data:image\/[a-z]+;base64,/, "").trim();
  if (!teks || teks.length > MAKS_BITA * 2) return null;
  if (!/^[A-Za-z0-9+/=]+$/.test(teks)) return null;
  try {
    const bita = Buffer.from(teks, "base64");
    // JPEG selalu diawali FF D8 FF. Diperiksa dari ISI berkasnya, bukan dari
    // keterangan jenis yang ikut dikirim — keterangan itu datang dari peramban
    // yang sedang diawasi.
    if (bita.length < 512 || bita.length > MAKS_BITA) return null;
    if (bita[0] !== 0xff || bita[1] !== 0xd8 || bita[2] !== 0xff) return null;
    return { data: teks, bita };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  // Longgar, karena satu peserta mengirim paling banyak beberapa belas kali
  // sepanjang ujian — tetapi tetap ada, karena jalur ini menerima gambar.
  const batas = rateLimit({ request, name: "cbt-awasi", limit: 120, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const attempt = await attemptDariKunci(String(body.kunciSesi || ""));
    if (!attempt) {
      return Response.json({ success: false, message: "Sesi ujian tidak dikenali." }, { status: 401 });
    }
    if (attempt.status !== "berjalan") {
      return Response.json({ success: false, message: "Ujian ini sudah selesai." }, { status: 409 });
    }

    const baris = await db.select().from(cbtExams).where(eq(cbtExams.id, attempt.examId)).limit(1);
    const ujian = baris[0];
    if (!ujian) return Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 });

    const mode = rapikanMode(ujian.proctorMode);
    const aturan = aturanMode(mode);
    // Saklarnya ikut diperiksa DI SINI, bukan hanya di layar peserta. Peramban
    // yang sudah membuka kamera sebelum Admin mematikannya akan terus mengirim
    // cuplikan; menolaknya di server adalah satu-satunya tempat yang benar,
    // karena di situlah gambarnya berhenti.
    if (!kameraMenyala(mode, ujian.cameraOn)) {
      return Response.json(
        { success: false, message: "Ujian ini tidak memakai pengawasan kamera." },
        { status: 409 },
      );
    }

    // ---------- BATAS UANG ----------
    // Dibaca dari basis data, bukan dari angka yang ikut dikirim peramban.
    if (attempt.aiChecks >= aturan.jatahAi) {
      return Response.json({
        success: true,
        diperiksa: false,
        alasan: "jatah pemeriksaan model untuk peserta ini sudah habis",
      });
    }

    const mentah = Array.isArray(body.cuplikan) ? body.cuplikan.slice(0, MAKS_CUPLIKAN) : [];
    const gambar = mentah
      .map((c) => bacaBase64(c))
      .filter((g): g is { data: string; bita: Buffer } => g !== null);
    if (gambar.length === 0) {
      return Response.json({ success: false, message: "Cuplikan tidak terbaca." }, { status: 400 });
    }

    if (penyediaTersedia().length === 0) {
      // Tanpa kunci model, pengawasan kameranya tetap berjalan — yang hilang
      // hanya lapisan yang paling mahal. Ini dijawab sebagai keadaan biasa,
      // bukan galat, supaya ujiannya tidak terganggu oleh hal yang bukan
      // urusan pesertanya.
      return Response.json({
        success: true,
        diperiksa: false,
        alasan: "belum ada model yang tersambung",
      });
    }

    // ---------- JATAH DIPOTONG LEBIH DULU ----------
    // Sebelum modelnya dipanggil, bukan sesudah. Panggilan yang gagal di
    // tengah jalan tetap menghabiskan uang, dan jatah yang hanya dipotong pada
    // panggilan yang berhasil dapat dikuras dengan permintaan yang sengaja
    // dibuat gagal.
    await db
      .update(cbtAttempts)
      .set({ aiChecks: sql`${cbtAttempts.aiChecks} + 1`, lastSeenAt: new Date() })
      .where(eq(cbtAttempts.id, attempt.id));

    let bacaan: BacaanModel;
    try {
      const jawab = await mintaJson({
        sistem: SISTEM,
        perintah:
          gambar.length === 1
            ? "Periksa cuplikan kamera peserta ini."
            : `Periksa ${gambar.length} cuplikan kamera peserta ini. Jawab berdasarkan keadaan yang paling banyak terlihat di antaranya.`,
        skema: SKEMA_BACAAN as unknown as Record<string, unknown>,
        gambar: gambar.map((g) => ({ jenis: "image/jpeg", data: g.data })),
        // Pekerjaan yang berulang ribuan kali dengan jawaban empat kolom.
        // Usaha tinggi di sini hanya menambah biaya, tidak menambah ketepatan.
        usaha: "low",
        maksKeluaran: 700,
      });
      bacaan = jawab.isi as BacaanModel;
    } catch (galat: unknown) {
      // Model yang tidak dapat dihubungi bukan urusan peserta, dan ujiannya
      // tidak boleh terganggu karenanya.
      console.error("awasi kamera cbt", galat);
      return Response.json({ success: true, diperiksa: false, alasan: "model tidak menjawab" });
    }

    const putusan = bacaanKeInsiden(bacaan);
    if (!putusan) {
      // ---------- BERSIH: GAMBARNYA DIBUANG DI SINI ----------
      // Tidak diunggah, tidak dicatat, tidak disebut lagi. Inilah yang membuat
      // pengawasan ini tidak berubah menjadi arsip wajah.
      return Response.json({ success: true, diperiksa: true, bersih: true });
    }

    // ---------- BERMASALAH: CUPLIKANNYA DISIMPAN SEBAGAI BUKTI ----------
    let bukti: string | null = null;
    const url = getSupabaseUrl();
    const kunci = getSupabaseSecretKey();
    if (url && kunci) {
      const jalur = `ujian-${attempt.examId}/attempt-${attempt.id}/${Date.now()}.jpg`;
      const storage = createClient(url, kunci, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await storage.storage.from(BUCKET_BUKTI).upload(jalur, gambar[0].bita, {
        contentType: "image/jpeg",
        upsert: false,
      });
      // Gagal mengunggah TIDAK membatalkan catatannya. Insiden tanpa gambar
      // tetap jauh lebih berguna daripada tidak ada catatan sama sekali.
      if (!error) bukti = jalur;
      else console.error("simpan bukti kamera", error.message);
    }

    const sekarang = new Date();
    await db.insert(cbtIncidents).values({
      attemptId: attempt.id,
      kind: putusan.jenis,
      at: sekarang,
      detail: putusan.catatan.slice(0, 200) || null,
      evidence: bukti,
    });

    const kolom = putusan.jenis === "orang_lain" ? "otherPerson" : "faceMissing";
    const sesudah = await db
      .update(cbtAttempts)
      .set({ [kolom]: sql`${cbtAttempts[kolom]} + 1`, lastSeenAt: sekarang })
      .where(eq(cbtAttempts.id, attempt.id))
      .returning();

    const a = sesudah[0];
    const skor = a
      ? skorIntegritas({
          tab: a.switchedTab, fullscreen: a.leftFullscreen, blur: a.blurCount,
          salin: a.copyAttempts, tempel: a.pasteAttempts, tangkap: a.screenshotAttempts,
          klik_kanan: a.rightClicks, devtools: a.devtoolsOpens, layar_kedua: a.secondScreens,
          kamera_mati: a.cameraOff, kamera_tertutup: a.cameraCovered,
          kamera_beku: a.cameraFrozen, wajah_hilang: a.faceMissing, orang_lain: a.otherPerson,
        })
      : attempt.integrityScore;
    await db.update(cbtAttempts).set({ integrityScore: skor }).where(eq(cbtAttempts.id, attempt.id));

    return Response.json({
      success: true,
      diperiksa: true,
      bersih: false,
      jenis: putusan.jenis,
      skor,
      // Peserta diberi tahu apa yang terlihat, bukan dibiarkan menebak. Yang
      // sedang menunduk membaca soal dapat membetulkan posisinya; yang tidak
      // pernah diberi tahu akan mengulangi hal yang sama sampai ujian selesai.
      pesan:
        putusan.jenis === "orang_lain"
          ? "Terdeteksi orang lain di depan kamera. Kejadian ini dicatat dan dilaporkan ke pengawas."
          : "Wajahmu tidak terlihat kamera. Duduklah menghadap layar — kejadian ini dicatat.",
    });
  } catch (error: unknown) {
    console.error("awasi kamera cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Pengawasan kamera belum dapat diproses.") },
      { status: 500 },
    );
  }
}
