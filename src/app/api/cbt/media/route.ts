// ============================================================
// CBT — UNGGAH MEDIA SOAL (gambar dan video)
//
// Dosen boleh menempelkan tautan, boleh juga mengunggah berkasnya. Yang
// diunggah mendarat di bucket TERSENDIRI yang bersifat publik, dan itu
// disengaja: yang membuka soalnya adalah mahasiswa tanpa akun, sehingga URL
// bertanda tangan — yang dipakai berkas layanan lain di portal ini — tidak
// dapat bekerja di sini. Ia akan kedaluwarsa di tengah ujian.
//
// Karena bucket-nya publik, yang boleh masuk ke sana dijaga ketat di hulu:
//
//   1. Hanya pemilik ujiannya yang boleh mengunggah.
//   2. Hanya gambar dan video, dan JENISNYA DIPERIKSA DARI ISI BERKAS —
//      bukan dari nama atau dari content-type yang dikirim peramban, karena
//      keduanya ditentukan pihak yang mengunggah.
//   3. Nama berkasnya dibuang seluruhnya dan diganti nama acak.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { cbtExams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase-config";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { angkaParam, bolehCbt, bolehUbah } from "@/lib/cbt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const BUCKET_MEDIA = process.env.SUPABASE_CBT_BUCKET || "cbt-media";
const MAKS_GAMBAR = 5 * 1024 * 1024;
const MAKS_VIDEO = 50 * 1024 * 1024;

/**
 * Kenali jenis berkas dari beberapa bita pertamanya.
 *
 * Nama berkas dan content-type dikirim oleh yang mengunggah, jadi keduanya
 * dapat dikarang. Yang tidak dapat dikarang adalah isinya sendiri — dan
 * inilah satu-satunya pemeriksaan yang menentukan.
 */
export function kenaliJenis(b: Uint8Array): { ext: string; mime: string; video: boolean } | null {
  const cocok = (pos: number, ...bita: number[]) => bita.every((n, i) => b[pos + i] === n);

  if (b.length > 8 && cocok(0, 0x89, 0x50, 0x4e, 0x47)) return { ext: "png", mime: "image/png", video: false };
  if (b.length > 3 && cocok(0, 0xff, 0xd8, 0xff)) return { ext: "jpg", mime: "image/jpeg", video: false };
  if (b.length > 12 && cocok(0, 0x47, 0x49, 0x46, 0x38)) return { ext: "gif", mime: "image/gif", video: false };
  // WEBP dan WEBM sama-sama berawalan RIFF/EBML yang berbeda; keduanya dibedakan di sini.
  if (b.length > 12 && cocok(0, 0x52, 0x49, 0x46, 0x46) && cocok(8, 0x57, 0x45, 0x42, 0x50)) {
    return { ext: "webp", mime: "image/webp", video: false };
  }
  if (b.length > 4 && cocok(0, 0x1a, 0x45, 0xdf, 0xa3)) return { ext: "webm", mime: "video/webm", video: true };
  // MP4 dan MOV: kotak "ftyp" pada offset 4.
  if (b.length > 12 && cocok(4, 0x66, 0x74, 0x79, 0x70)) {
    const merek = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (merek === "qt  ") return { ext: "mov", mime: "video/quicktime", video: true };
    return { ext: "mp4", mime: "video/mp4", video: true };
  }
  return null;
}

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "cbt-media", limit: 60, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) {
      return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
    }

    const form = await request.formData();
    const examId = angkaParam(String(form.get("ujian") ?? ""));
    if (examId === null) {
      return Response.json({ success: false, message: "Ujian tidak dikenali." }, { status: 400 });
    }

    const baris = await db.select().from(cbtExams).where(eq(cbtExams.id, examId)).limit(1);
    const ujian = baris[0];
    if (!ujian) return Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 });
    if (!bolehUbah(profile, ujian)) {
      return Response.json(
        { success: false, message: "Media hanya dapat diunggah oleh dosen pemilik ujiannya." },
        { status: 403 },
      );
    }

    const berkas = form.get("berkas");
    if (!(berkas instanceof File) || berkas.size === 0) {
      return Response.json({ success: false, message: "Berkasnya belum dipilih." }, { status: 400 });
    }

    const bita = new Uint8Array(await berkas.arrayBuffer());
    const jenis = kenaliJenis(bita);
    if (!jenis) {
      return Response.json(
        {
          success: false,
          message: "Berkasnya bukan gambar atau video yang dikenali. Pakai PNG, JPG, GIF, WEBP, MP4, atau WEBM.",
        },
        { status: 400 },
      );
    }

    const batasUkuran = jenis.video ? MAKS_VIDEO : MAKS_GAMBAR;
    if (bita.length > batasUkuran) {
      return Response.json(
        {
          success: false,
          message:
            `Ukurannya ${Math.round(bita.length / 1024 / 1024)} MB, melebihi batas ` +
            `${Math.round(batasUkuran / 1024 / 1024)} MB untuk ${jenis.video ? "video" : "gambar"}. ` +
            "Tautan sematan (YouTube, Drive) tidak punya batas ini.",
        },
        { status: 413 },
      );
    }

    const url = getSupabaseUrl();
    const kunci = getSupabaseSecretKey();
    if (!url || !kunci) {
      return Response.json(
        { success: false, message: "Supabase Storage belum diatur di environment." },
        { status: 500 },
      );
    }

    // Nama aslinya DIBUANG, bukan dibersihkan. Nama berkas dari luar adalah
    // sumber galat yang tidak habis-habis — huruf aneh, titik ganda, panjang
    // yang melampaui batas — dan tidak ada yang membutuhkannya di sini.
    const jalur = `ujian-${examId}/${Date.now()}-${crypto.randomUUID()}.${jenis.ext}`;
    const storage = createClient(url, kunci, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await storage.storage.from(BUCKET_MEDIA).upload(jalur, bita, {
      contentType: jenis.mime,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      const kurang = /bucket not found/i.test(error.message);
      return Response.json(
        {
          success: false,
          message: kurang
            ? `Bucket Storage "${BUCKET_MEDIA}" belum ada. Jalankan supabase-update-v26-cbt-lanjutan.sql lebih dulu.`
            : `Unggahan gagal: ${error.message}`,
        },
        { status: 500 },
      );
    }

    const { data } = storage.storage.from(BUCKET_MEDIA).getPublicUrl(jalur);
    return Response.json({
      success: true,
      url: data.publicUrl,
      jenis: jenis.video ? "video" : "gambar",
      ukuran: bita.length,
    });
  } catch (error: unknown) {
    console.error("unggah media cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Media belum dapat diunggah.") },
      { status: 500 },
    );
  }
}
