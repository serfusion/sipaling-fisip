// ============================================================
// CBT — BANK SOAL
//
// GET    daftar soal satu ujian, LENGKAP dengan kuncinya — hanya untuk dosen
//        pemiliknya dan admin. Jalur mahasiswa tidak pernah lewat sini.
// POST   tambah soal (satu, atau banyak sekaligus dari tempel-tempelan)
// PATCH  ubah satu soal
// DELETE hapus satu soal
// ============================================================
import { db } from "@/db";
import { cbtExams, cbtQuestions } from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  angkaParam, bolehCbt, bolehPantau, bolehUbah, statusUjian, uraiKunciJamak,
  SEMUA_JENIS, type JenisMedia, type JenisSoal, type Pasangan,
} from "@/lib/cbt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JENIS: JenisSoal[] = SEMUA_JENIS;
const TINGKAT = ["mudah", "sedang", "sulit"];
const MEDIA: JenisMedia[] = ["", "gambar", "video"];

/**
 * Tautan media yang boleh disimpan.
 *
 * Hanya http(s), dan hanya sampai seribu huruf. Yang ditahan di sini terutama
 * "javascript:" dan "data:" — keduanya berubah menjadi jalan menjalankan kode
 * begitu tautannya dipasang pada halaman yang dibuka mahasiswa.
 */
function tautanAman(nilai: unknown): string {
  const isi = String(nilai ?? "").trim().slice(0, 1000);
  if (!isi) return "";
  try {
    const alamat = new URL(isi);
    if (alamat.protocol !== "http:" && alamat.protocol !== "https:") return "";
    return alamat.toString();
  } catch {
    return "";
  }
}

const teks = (nilai: unknown, batas: number) =>
  typeof nilai === "string" ? nilai.replace(/\r\n/g, "\n").trim().slice(0, batas) : "";

type Masukan = {
  jenis?: unknown; pertanyaan?: unknown; pilihan?: unknown; kunci?: unknown;
  bobot?: unknown; materi?: unknown; tingkat?: unknown; pembahasan?: unknown;
  pasangan?: unknown; media?: unknown;
};

/** Bersihkan pasangan penjodohan, dan buang yang menunjuk ke luar daftar. */
function rapikanPasangan(mentah: unknown, pilihan: string[]): Pasangan[] {
  if (!Array.isArray(mentah)) return [];
  return mentah
    .slice(0, 20)
    .map((p) => {
      const isi = p as { kiri?: unknown; kanan?: unknown };
      return { kiri: teks(isi?.kiri, 400), kanan: Number(isi?.kanan) };
    })
    .filter((p) => p.kiri.length > 0 && Number.isInteger(p.kanan) && p.kanan >= 0 && p.kanan < pilihan.length);
}

/**
 * Bersihkan dan periksa satu soal.
 *
 * Soal yang kuncinya tidak sah lebih berbahaya daripada soal yang tidak ada:
 * ia tampak beres di layar dosen, lalu menyalahkan seluruh mahasiswa yang
 * sebenarnya menjawab benar.
 */
function rapikanSoal(m: Masukan): { ok: true; nilai: Record<string, unknown> } | { ok: false; pesan: string } {
  const jenis = (JENIS as string[]).includes(String(m.jenis)) ? (String(m.jenis) as JenisSoal) : "pg";
  const pertanyaan = teks(m.pertanyaan, 4000);
  if (pertanyaan.length < 3) return { ok: false, pesan: "Pertanyaan belum diisi." };

  let pilihan: string[] = [];
  if (Array.isArray(m.pilihan)) {
    pilihan = m.pilihan.map((p) => teks(p, 500)).filter((p) => p.length > 0);
  }
  let kunci = teks(m.kunci, 400);
  let pasangan: Pasangan[] = [];

  const mediaMentah = (m.media ?? {}) as { jenis?: unknown; url?: unknown; keterangan?: unknown };
  const mediaUrl = tautanAman(mediaMentah.url);
  const mediaJenisDiminta = String(mediaMentah.jenis ?? "") as JenisMedia;
  // Media tanpa tautan yang sah bukan media. Menyimpan jenisnya saja
  // menyediakan kotak gambar yang selamanya kosong di layar mahasiswa.
  const mediaJenis: JenisMedia = mediaUrl && MEDIA.includes(mediaJenisDiminta) && mediaJenisDiminta !== ""
    ? mediaJenisDiminta
    : mediaUrl ? "gambar" : "";

  if (jenis === "pg" || jenis === "benar_salah") {
    if (jenis === "benar_salah" && pilihan.length === 0) pilihan = ["Benar", "Salah"];
    if (pilihan.length < 2) return { ok: false, pesan: "Pilihan jawaban minimal dua." };
    const nomor = Number(kunci);
    if (!Number.isInteger(nomor) || nomor < 0 || nomor >= pilihan.length) {
      return { ok: false, pesan: "Kunci jawaban belum dipilih." };
    }
    kunci = String(nomor);
  } else if (jenis === "pg_kompleks") {
    if (pilihan.length < 2) return { ok: false, pesan: "Pilihan jawaban minimal dua." };
    const nomor = [...uraiKunciJamak(kunci)].filter((n) => n < pilihan.length).sort((a, b) => a - b);
    if (nomor.length === 0) return { ok: false, pesan: "Tandai dulu jawaban mana saja yang benar." };
    if (nomor.length === pilihan.length) {
      return {
        ok: false,
        pesan: "Seluruh pilihan ditandai benar. Soal seperti ini tidak mengukur apa pun. Sisakan minimal satu pengecoh.",
      };
    }
    kunci = nomor.join(",");
  } else if (jenis === "penjodohan") {
    if (pilihan.length < 2) return { ok: false, pesan: "Kolom jawaban penjodohan minimal dua." };
    pasangan = rapikanPasangan(m.pasangan, pilihan);
    if (pasangan.length < 2) return { ok: false, pesan: "Penjodohan perlu minimal dua pasangan yang lengkap." };
    kunci = "";
  } else if (jenis === "isian") {
    pilihan = [];
    if (!kunci) return { ok: false, pesan: "Kunci jawaban isian singkat belum diisi." };
  } else {
    // Essay tidak punya kunci; ia menunggu dosen.
    pilihan = [];
    kunci = "";
  }
  if (jenis !== "penjodohan") pasangan = [];

  const bobotAngka = Number(m.bobot);
  const bobot = Number.isFinite(bobotAngka) ? Math.max(1, Math.min(Math.round(bobotAngka), 100)) : 1;
  const tingkat = TINGKAT.includes(String(m.tingkat)) ? String(m.tingkat) : "sedang";

  return {
    ok: true,
    nilai: {
      type: jenis,
      question: pertanyaan,
      options: JSON.stringify(pilihan),
      answerKey: kunci,
      pairs: JSON.stringify(pasangan),
      mediaType: mediaJenis,
      mediaUrl: mediaUrl || null,
      mediaCaption: teks(mediaMentah.keterangan, 240) || null,
      points: bobot,
      material: teks(m.materi, 120) || null,
      difficulty: tingkat,
      explanation: teks(m.pembahasan, 2000) || null,
    },
  };
}

/**
 * Ambil ujiannya sekaligus periksa izin pemanggilnya.
 *
 * Dua tingkat izin, dan perbedaannya penting: MEMBACA bank soal terbuka bagi
 * admin yang memantau, sedangkan MENGUBAHNYA hanya bagi pemilik ujiannya.
 * Sebelumnya keduanya satu pintu, dan itu berarti setiap admin dapat menyunting
 * soal kelas dosen mana pun.
 */
async function ujianMilikSaya(examId: number, izin: "pantau" | "ubah" = "ubah") {
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
              ? "Soal ujian ini hanya dapat diubah dosen pemiliknya."
              : "Ujian ini milik dosen lain.",
        },
        { status: 403 },
      ),
    };
  }
  return { profile, ujian };
}

/** Soal tidak boleh diubah selagi ujiannya berlangsung. */
function terkunci(ujian: { activatedAt: Date | null; startAt: Date | null; endAt: Date | null }) {
  return statusUjian({ aktif: Boolean(ujian.activatedAt), mulai: ujian.startAt, selesai: ujian.endAt }) === "berlangsung";
}

export async function GET(request: Request) {
  try {
    const examId = angkaParam(new URL(request.url).searchParams.get("ujian"));
    if (examId === null) {
      return Response.json({ success: false, message: "Ujian tidak dikenali." }, { status: 400 });
    }
    const cek = await ujianMilikSaya(examId, "pantau");
    if ("gagal" in cek) return cek.gagal;

    const baris = await db
      .select()
      .from(cbtQuestions)
      .where(eq(cbtQuestions.examId, examId))
      .orderBy(asc(cbtQuestions.sortOrder), asc(cbtQuestions.id));

    return Response.json({
      success: true,
      soal: baris.map((s) => ({
        id: s.id,
        jenis: s.type,
        pertanyaan: s.question,
        pilihan: JSON.parse(s.options || "[]") as string[],
        kunci: s.answerKey,
        pasangan: JSON.parse(s.pairs || "[]") as Pasangan[],
        media: { jenis: s.mediaType || "", url: s.mediaUrl || "", keterangan: s.mediaCaption || "" },
        bobot: s.points,
        materi: s.material || "",
        tingkat: s.difficulty,
        pembahasan: s.explanation || "",
      })),
    });
  } catch (error: unknown) {
    console.error("baca soal cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Soal belum dapat dimuat.") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "cbt-soal", limit: 200, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const body = (await request.json()) as { ujian?: unknown; soal?: Masukan[] };
    const examId = angkaParam(String(body.ujian ?? ""));
    if (examId === null) {
      return Response.json({ success: false, message: "Ujian tidak dikenali." }, { status: 400 });
    }
    const cek = await ujianMilikSaya(examId);
    if ("gagal" in cek) return cek.gagal;
    if (terkunci(cek.ujian)) {
      return Response.json(
        { success: false, message: "Ujian sedang berlangsung. Soal tidak dapat diubah sekarang." },
        { status: 409 },
      );
    }

    const masuk = Array.isArray(body.soal) ? body.soal.slice(0, 200) : [];
    if (masuk.length === 0) {
      return Response.json({ success: false, message: "Tidak ada soal yang dikirim." }, { status: 400 });
    }

    const urutTerakhir = await db
      .select({ n: sql<number>`coalesce(max(sort_order), 0)::int` })
      .from(cbtQuestions)
      .where(eq(cbtQuestions.examId, examId));
    let urut = urutTerakhir[0]?.n ?? 0;

    const siap: Array<Record<string, unknown>> = [];
    const ditolak: string[] = [];
    for (const [i, m] of masuk.entries()) {
      const hasil = rapikanSoal(m);
      if (!hasil.ok) {
        ditolak.push(`Soal ${i + 1}: ${hasil.pesan}`);
        continue;
      }
      urut += 1;
      siap.push({ ...hasil.nilai, examId, sortOrder: urut });
    }

    if (siap.length === 0) {
      return Response.json({ success: false, message: ditolak[0] || "Soal tidak sah." }, { status: 400 });
    }

    // Barisnya dikembalikan, bukan hanya jumlahnya. Panel dosen memasang soal
    // barunya ke layar seketika lalu menukarnya dengan baris asli begitu
    // jawaban ini tiba — tanpa id yang sebenarnya, ia harus memuat ulang
    // seluruh bank soal hanya untuk satu soal yang baru ditambahkan.
    const dibuat = await db.insert(cbtQuestions).values(siap as never).returning();
    return Response.json(
      {
        success: true,
        masuk: dibuat.length,
        ditolak,
        soal: dibuat.map((s) => ({
          id: s.id,
          jenis: s.type,
          pertanyaan: s.question,
          pilihan: JSON.parse(s.options || "[]") as string[],
          kunci: s.answerKey,
          pasangan: JSON.parse(s.pairs || "[]") as Pasangan[],
          media: { jenis: s.mediaType || "", url: s.mediaUrl || "", keterangan: s.mediaCaption || "" },
          bobot: s.points,
          materi: s.material || "",
          tingkat: s.difficulty,
          pembahasan: s.explanation || "",
        })),
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("simpan soal cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Soal belum tersimpan.") },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: unknown } & Masukan;
    const id = angkaParam(String(body.id ?? ""));
    if (id === null) {
      return Response.json({ success: false, message: "Soal tidak dikenali." }, { status: 400 });
    }
    const punya = await db.select().from(cbtQuestions).where(eq(cbtQuestions.id, id)).limit(1);
    if (!punya[0]) return Response.json({ success: false, message: "Soal tidak ditemukan." }, { status: 404 });

    const cek = await ujianMilikSaya(punya[0].examId);
    if ("gagal" in cek) return cek.gagal;
    if (terkunci(cek.ujian)) {
      return Response.json(
        { success: false, message: "Ujian sedang berlangsung. Soal tidak dapat diubah sekarang." },
        { status: 409 },
      );
    }

    const hasil = rapikanSoal(body);
    if (!hasil.ok) return Response.json({ success: false, message: hasil.pesan }, { status: 400 });

    await db.update(cbtQuestions).set(hasil.nilai as never).where(eq(cbtQuestions.id, id));
    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("ubah soal cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Soal belum tersimpan.") },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const id = angkaParam(new URL(request.url).searchParams.get("id"));
    if (id === null) {
      return Response.json({ success: false, message: "Soal tidak dikenali." }, { status: 400 });
    }
    const punya = await db.select().from(cbtQuestions).where(eq(cbtQuestions.id, id)).limit(1);
    if (!punya[0]) return Response.json({ success: true });

    const cek = await ujianMilikSaya(punya[0].examId);
    if ("gagal" in cek) return cek.gagal;
    if (terkunci(cek.ujian)) {
      return Response.json(
        { success: false, message: "Ujian sedang berlangsung. Soal tidak dapat dihapus sekarang." },
        { status: 409 },
      );
    }

    await db.delete(cbtQuestions).where(and(eq(cbtQuestions.id, id)));
    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("hapus soal cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Soal belum dapat dihapus.") },
      { status: 500 },
    );
  }
}
