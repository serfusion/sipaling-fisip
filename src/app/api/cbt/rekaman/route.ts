// ============================================================
// CBT — REKAMAN SUARA
//
// POST aksi=potongan   peramban peserta mengirim satu potongan suara
// POST aksi=tutup      peserta selesai; rekaman ditutup
// POST aksi=gagal      mikrofon ditolak atau bermasalah; dicatat, ujian jalan terus
// POST aksi=transkrip  dosen meminta rekamannya ditranskripsikan (perlu akun)
// GET  ?ujian=&attempt= dosen membuka rekaman beserta penandanya (perlu akun)
//
// ------------------------------------------------------------
// DUA SISI YANG SANGAT BERBEDA WEWENANGNYA
// ------------------------------------------------------------
// Jalur POST potongan/tutup/gagal dipanggil PERAMBAN PESERTA, yang tidak punya
// akun. Yang membuktikan haknya hanya kunci sesi acak yang ia pegang sejak
// masuk — kunci yang sama yang dipakai menyimpan jawabannya. Ia hanya dapat
// menulis ke rekamannya sendiri, dan tidak dapat membaca apa pun.
//
// Jalur GET dan transkrip dipanggil DOSEN, lewat akun portal, dan melewati
// pemeriksaan kepemilikan ujian yang sama dengan seluruh menu pengawasan.
// Suara orang tidak dapat didengarkan siapa pun yang menebak nomor attempt.
//
// ------------------------------------------------------------
// PENYIMPANAN YANG TERTUTUP
// ------------------------------------------------------------
// Bucket rekaman TIDAK publik. Alamat pemutarnya dibuatkan bertanda tangan,
// berumur satu jam — cukup untuk satu sesi pemeriksaan, tidak cukup untuk
// menjadi tautan yang beredar di grup pesan.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { cbtAttempts, cbtExams, cbtRecordings, cbtTranscriptSegments } from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase-config";
import { getCurrentProfile } from "@/lib/supabase-server";
import { angkaParam, bolehCbt, bolehPantau, bolehUbah } from "@/lib/cbt";
import { attemptDariKunci } from "@/lib/cbt-store";
import { mintaJson, GalatModel, penyediaDengar } from "@/lib/ai-penyedia";
import {
  BUCKET_REKAMAN, DETIK_POTONGAN, KATA_BAWAAN, MAKS_BITA_POTONGAN, MAKS_DETIK_REKAMAN,
  SISTEM_TRANSKRIP, SKEMA_TRANSKRIP, bacaTranskrip, jalurPotongan, jenisDiterima,
  mapRekaman, statusTanda, tandaiTranskrip, type Penggal,
} from "@/lib/rekaman";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function storage() {
  const url = getSupabaseUrl();
  const kunci = getSupabaseSecretKey();
  if (!url || !kunci) return null;
  return createClient(url, kunci, { auth: { autoRefreshToken: false, persistSession: false } })
    .storage.from(BUCKET_REKAMAN);
}

/**
 * Base64 → bita, dijaga ketat karena datang dari luar.
 *
 * Yang diperiksa: bentuk base64-nya, ukurannya sesudah diurai, dan jenis
 * MIME-nya. Yang TIDAK diperiksa adalah isi berkasnya — berbeda dari cuplikan
 * kamera, yang penanda JPEG-nya diperiksa dari bita pertama. Bentuk WebM,
 * Ogg, dan MP4 berbeda-beda penandanya antarperamban, dan menolak yang
 * penandanya tidak dikenal berarti menolak rekaman peserta yang perambannya
 * kebetulan tidak lazim — lalu ujiannya berlangsung tanpa rekaman tanpa ada
 * yang tahu sebabnya.
 */
function bacaBase64(masukan: unknown): Buffer | null {
  const teks = String(masukan ?? "").replace(/^data:[^;]+;base64,/, "").trim();
  if (!teks || teks.length > MAKS_BITA_POTONGAN * 2) return null;
  if (!/^[A-Za-z0-9+/=]+$/.test(teks)) return null;
  try {
    const bita = Buffer.from(teks, "base64");
    return bita.length > 0 && bita.length <= MAKS_BITA_POTONGAN ? bita : null;
  } catch {
    return null;
  }
}

/** Baris rekaman attempt ini; dibuat bila belum ada. */
async function pastikanRekaman(attemptId: number, examId: number, sekarang: Date) {
  const ada = await db.select().from(cbtRecordings).where(eq(cbtRecordings.attemptId, attemptId)).limit(1);
  if (ada[0]) return ada[0];
  const dibuat = await db
    .insert(cbtRecordings)
    .values({
      attemptId,
      examId,
      prefix: mapRekaman(examId, attemptId),
      status: "merekam",
      startedAt: sekarang,
      updatedAt: sekarang,
    })
    .onConflictDoNothing()
    .returning();
  if (dibuat[0]) return dibuat[0];
  // Dua potongan pertama yang datang bersamaan: yang kalah membaca baris yang
  // barusan dibuat yang menang.
  const ulang = await db.select().from(cbtRecordings).where(eq(cbtRecordings.attemptId, attemptId)).limit(1);
  return ulang[0] ?? null;
}

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "cbt-rekaman", limit: 900, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const aksi = String(body.aksi ?? "");
    const sekarang = new Date();

    // ---------- JALUR DOSEN: TRANSKRIP ----------
    if (aksi === "transkrip") return transkripkan(body);

    // ---------- JALUR PESERTA ----------
    const attempt = await attemptDariKunci(String(body.kunciSesi ?? ""));
    if (!attempt) {
      return Response.json({ success: false, message: "Sesi ujian tidak dikenali." }, { status: 401 });
    }

    const ujianBaris = await db.select().from(cbtExams).where(eq(cbtExams.id, attempt.examId)).limit(1);
    const ujian = ujianBaris[0];
    if (!ujian || !ujian.recordAudio) {
      // Ujian yang tidak merekam menjawab "sudah selesai", bukan galat.
      // Peramban yang masih mengirim karena dosennya baru mematikan saklarnya
      // di tengah jalan akan berhenti sendiri, tanpa menampilkan pesan galat
      // kepada peserta yang tidak melakukan apa-apa.
      return Response.json({ success: true, berhenti: true });
    }

    // ---------- MIKROFON YANG GAGAL ----------
    if (aksi === "gagal") {
      const sebab = String(body.sebab ?? "").slice(0, 200);
      const ditolak = String(body.jenis ?? "") === "ditolak";
      const baris = await pastikanRekaman(attempt.id, attempt.examId, sekarang);
      if (baris) {
        await db
          .update(cbtRecordings)
          .set({
            // Rekaman yang sudah SEMPAT berisi suara tidak diturunkan menjadi
            // "gagal" hanya karena mikrofonnya lepas di menit kelima puluh.
            // Empat puluh sembilan menit yang sudah tersimpan tetap ada, dan
            // laporannya harus mengatakan begitu.
            status: baris.chunkCount > 0 ? baris.status : ditolak ? "ditolak" : "gagal",
            note: sebab || (ditolak ? "Peserta menolak izin mikrofon." : "Mikrofon bermasalah."),
            updatedAt: sekarang,
          })
          .where(eq(cbtRecordings.id, baris.id));
      }
      // SELALU sukses. Ujian tidak pernah berhenti karena mikrofon.
      return Response.json({ success: true });
    }

    // ---------- PESERTA MENUTUP REKAMANNYA ----------
    if (aksi === "tutup") {
      const baris = await db
        .select()
        .from(cbtRecordings)
        .where(eq(cbtRecordings.attemptId, attempt.id))
        .limit(1);
      if (baris[0]) {
        await db
          .update(cbtRecordings)
          .set({
            status: baris[0].chunkCount > 0 ? "selesai" : baris[0].status,
            endedAt: sekarang,
            updatedAt: sekarang,
          })
          .where(eq(cbtRecordings.id, baris[0].id));
      }
      return Response.json({ success: true });
    }

    if (aksi !== "potongan") {
      return Response.json({ success: false, message: "Aksi tidak dikenali." }, { status: 400 });
    }

    // ---------- SATU POTONGAN SUARA ----------
    const jenis = String(body.jenis ?? "audio/webm").split(";")[0].trim();
    if (!jenisDiterima(jenis)) {
      return Response.json({ success: false, message: "Bentuk rekaman tidak dikenali." }, { status: 400 });
    }
    const bita = bacaBase64(body.data);
    if (!bita) {
      return Response.json({ success: false, message: "Potongan rekaman tidak dapat dibaca." }, { status: 400 });
    }

    const baris = await pastikanRekaman(attempt.id, attempt.examId, sekarang);
    if (!baris) {
      return Response.json({ success: false, message: "Rekaman belum dapat disiapkan." }, { status: 500 });
    }

    // Batas panjang rekaman ditegakkan DI SINI, bukan di peramban. Satu tab
    // yang tertinggal terbuka semalaman akan mengirim tiga ribu potongan, dan
    // yang membayar penyimpanannya pemilik portal.
    if (baris.durationSec >= MAKS_DETIK_REKAMAN) {
      return Response.json({ success: true, berhenti: true });
    }

    const simpan = storage();
    if (!simpan) {
      return Response.json(
        { success: false, message: "Penyimpanan rekaman belum tersambung." },
        { status: 503 },
      );
    }

    const urut = baris.chunkCount;
    const jalur = jalurPotongan(attempt.examId, attempt.id, urut, jenis);
    const { error } = await simpan.upload(jalur, bita, { contentType: jenis, upsert: true });
    if (error) {
      console.error("unggah potongan rekaman", error.message);
      // Potongan yang gagal naik tidak menghentikan rekaman: peramban akan
      // mengirim potongan berikutnya dua puluh detik lagi, dan yang hilang
      // hanya dua puluh detik.
      return Response.json({ success: true, tersimpan: false });
    }

    const detik = Math.max(1, Math.min(120, Math.round(Number(body.detik) || DETIK_POTONGAN)));
    await db
      .update(cbtRecordings)
      .set({
        chunkCount: sql`${cbtRecordings.chunkCount} + 1`,
        durationSec: sql`${cbtRecordings.durationSec} + ${detik}`,
        bytes: sql`${cbtRecordings.bytes} + ${bita.length}`,
        status: "merekam",
        updatedAt: sekarang,
      })
      .where(eq(cbtRecordings.id, baris.id));

    return Response.json({ success: true, tersimpan: true, urut });
  } catch (error: unknown) {
    if (error instanceof GalatModel) {
      return Response.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error("rekaman cbt", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Rekaman belum dapat diproses.") },
      { status: 500 },
    );
  }
}

// ------------------------------------------------------------
// TRANSKRIP — DIMINTA DOSEN, BUKAN BERJALAN SENDIRI
// ------------------------------------------------------------

/**
 * Paling banyak berapa potongan yang dikirim ke model sekali jalan.
 *
 * Ujian sembilan puluh menit menghasilkan 270 potongan. Mengirim seluruhnya
 * dalam satu permintaan akan menabrak batas waktu fungsi, dan biayanya keluar
 * penuh untuk hasil yang tidak pernah tersimpan. Jawaban menyebut berapa yang
 * tersisa dan panel menekan lagi.
 */
const MAKS_POTONGAN_SEKALI = 12;

async function transkripkan(body: Record<string, unknown>) {
  const profile = await getCurrentProfile();
  if (!bolehCbt(profile) || !profile) {
    return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
  }
  const examId = angkaParam(String(body.ujian ?? ""));
  const attemptId = angkaParam(String(body.attempt ?? ""));
  if (examId === null || attemptId === null) {
    return Response.json({ success: false, message: "Rekaman tidak dikenali." }, { status: 400 });
  }

  const ujianBaris = await db.select().from(cbtExams).where(eq(cbtExams.id, examId)).limit(1);
  const ujian = ujianBaris[0];
  if (!ujian) return Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 });
  if (!bolehUbah(profile, ujian)) {
    return Response.json(
      { success: false, message: "Transkrip hanya dapat diminta pengajar pemilik ujiannya." },
      { status: 403 },
    );
  }

  if ((await penyediaDengar()).length === 0) {
    return Response.json(
      {
        success: false,
        message:
          "Transkrip memerlukan kunci Gemini di Dashboard Super Admin → Kunci AI. Rekamannya tetap tersimpan " +
          "dan tetap dapat diputar serta diunduh dari sini.",
      },
      { status: 503 },
    );
  }

  const rekamanBaris = await db
    .select()
    .from(cbtRecordings)
    .where(and(eq(cbtRecordings.attemptId, attemptId), eq(cbtRecordings.examId, examId)))
    .limit(1);
  const rekaman = rekamanBaris[0];
  if (!rekaman || rekaman.chunkCount === 0) {
    return Response.json({ success: false, message: "Peserta ini tidak punya rekaman." }, { status: 404 });
  }

  const simpan = storage();
  if (!simpan) {
    return Response.json({ success: false, message: "Penyimpanan rekaman belum tersambung." }, { status: 503 });
  }

  // Potongan mana yang BELUM ditranskripsikan. Ditentukan dari penggal yang
  // sudah ada, bukan dari penghitung tersendiri: dosen yang menekan tombolnya
  // tiga kali harus melanjutkan, bukan mengulang dari awal dan membayar dua
  // kali untuk penggal yang sama.
  const sudah = await db
    .select({ paling: sql<number>`coalesce(max(${cbtTranscriptSegments.endSec}), 0)::int` })
    .from(cbtTranscriptSegments)
    .where(eq(cbtTranscriptSegments.recordingId, rekaman.id));
  const mulaiDari = Math.floor((sudah[0]?.paling ?? 0) / DETIK_POTONGAN);

  if (mulaiDari >= rekaman.chunkCount) {
    return Response.json({ success: true, sisa: 0, pesan: "Seluruh rekaman sudah ditranskripsikan." });
  }

  await db
    .update(cbtRecordings)
    .set({ transcriptStatus: "berjalan", updatedAt: new Date() })
    .where(eq(cbtRecordings.id, rekaman.id));

  const daftar = await simpan.list(rekaman.prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  const berkas = (daftar.data ?? []).map((o) => o.name).sort();

  const kata = Array.isArray(body.kata) && body.kata.length > 0
    ? (body.kata as unknown[]).map((k) => String(k)).slice(0, 100)
    : KATA_BAWAAN;

  const kerjakan = berkas.slice(mulaiDari, mulaiDari + MAKS_POTONGAN_SEKALI);
  let masuk = 0;
  const gagal: string[] = [];

  for (const [i, nama] of kerjakan.entries()) {
    const urut = mulaiDari + i;
    try {
      const { data, error } = await simpan.download(`${rekaman.prefix}/${nama}`);
      if (error || !data) { gagal.push(nama); continue; }
      const bita = Buffer.from(await data.arrayBuffer());

      const jawab = await mintaJson({
      fitur: "Transkrip suara",
        sistem: SISTEM_TRANSKRIP,
        perintah:
          `Tuliskan seluruh yang terdengar pada potongan rekaman ruang ujian ini. ` +
          `Potongan ini berdurasi sekitar ${DETIK_POTONGAN} detik. ` +
          `Hitung detiknya dari awal potongan ini (mulai dari 0).`,
        skema: SKEMA_TRANSKRIP as unknown as Record<string, unknown>,
        suara: [{ jenis: data.type || "audio/webm", data: bita.toString("base64") }],
        // Menuliskan apa yang terdengar adalah pekerjaan yang berulang ratusan
        // kali dan jawabannya pendek. Usaha tinggi di sini menambah biaya
        // tanpa menambah ketepatan pendengaran.
        usaha: "low",
        maksKeluaran: 4_000,
      });

      const hasil = bacaTranskrip(jawab.isi, urut * DETIK_POTONGAN);
      if (hasil.penggal.length === 0) continue;

      const tertanda = tandaiTranskrip(hasil.penggal as Penggal[], kata);
      for (const p of tertanda) {
        await db.insert(cbtTranscriptSegments).values({
          recordingId: rekaman.id,
          startSec: p.startSec,
          endSec: p.endSec,
          text: p.text.slice(0, 1000),
          keyword: p.keyword,
          risk: p.risk,
          reason: p.reason,
        });
      }
      masuk += tertanda.length;
    } catch (galat) {
      // Satu potongan yang gagal tidak menghentikan sisanya, dan tidak
      // menggagalkan penggal yang sudah tersimpan.
      console.error("transkrip potongan", nama, galat);
      gagal.push(nama);
    }
  }

  // Keadaan menyeluruh dihitung ulang dari SELURUH penggal yang tersimpan,
  // bukan hanya dari yang baru masuk. Rekaman yang penandanya ada di menit
  // kesepuluh tidak boleh menjadi "bersih" karena potongan terakhir sunyi.
  const semua = await db
    .select()
    .from(cbtTranscriptSegments)
    .where(eq(cbtTranscriptSegments.recordingId, rekaman.id));
  const keadaan = statusTanda(
    semua.map((s) => ({
      startSec: s.startSec,
      endSec: s.endSec,
      text: s.text,
      keyword: s.keyword,
      risk: s.risk as "bersih" | "rendah" | "tinggi",
      reason: s.reason,
    })),
  );

  const sisa = Math.max(0, rekaman.chunkCount - (mulaiDari + kerjakan.length));
  await db
    .update(cbtRecordings)
    .set({
      transcriptStatus: sisa === 0 ? "selesai" : "berjalan",
      flagStatus: keadaan.status,
      flagCount: keadaan.jumlah,
      updatedAt: new Date(),
    })
    .where(eq(cbtRecordings.id, rekaman.id));

  return Response.json({
    success: true,
    penggal: masuk,
    sisa,
    gagal: gagal.length,
    tanda: keadaan.status,
    jumlahTanda: keadaan.jumlah,
    pesan:
      sisa > 0
        ? `${masuk} penggal tersimpan. Masih ada ${sisa} potongan, tekan sekali lagi untuk melanjutkan.`
        : `Transkrip selesai. ${keadaan.jumlah} penggal ditandai untuk ditinjau.`,
  });
}

// ------------------------------------------------------------
// GET — DOSEN MEMBUKA REKAMAN
// ------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) {
      return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
    }
    const params = new URL(request.url).searchParams;
    const examId = angkaParam(params.get("ujian"));
    const attemptId = angkaParam(params.get("attempt"));
    if (examId === null || attemptId === null) {
      return Response.json({ success: false, message: "Rekaman tidak dikenali." }, { status: 400 });
    }

    const ujianBaris = await db.select().from(cbtExams).where(eq(cbtExams.id, examId)).limit(1);
    const ujian = ujianBaris[0];
    if (!ujian) return Response.json({ success: false, message: "Ujian tidak ditemukan." }, { status: 404 });
    if (!bolehPantau(profile, ujian)) {
      return Response.json({ success: false, message: "Ujian ini milik pengajar lain." }, { status: 403 });
    }

    const pesertaBaris = await db
      .select({ id: cbtAttempts.id })
      .from(cbtAttempts)
      .where(and(eq(cbtAttempts.id, attemptId), eq(cbtAttempts.examId, examId)))
      .limit(1);
    if (!pesertaBaris[0]) {
      return Response.json({ success: false, message: "Peserta tidak ditemukan." }, { status: 404 });
    }

    const rekamanBaris = await db
      .select()
      .from(cbtRecordings)
      .where(eq(cbtRecordings.attemptId, attemptId))
      .limit(1);
    const rekaman = rekamanBaris[0];
    if (!rekaman) {
      return Response.json({ success: true, rekaman: null, potongan: [], penggal: [] });
    }

    // ---------- REKAMAN UTUH, SATU ALIRAN ----------
    //
    // Potongan dua puluh detik adalah cara MENYIMPAN, bukan cara mendengarkan.
    // Pemutar yang berganti berkas tiap dua puluh detik berhenti sejenak pada
    // tiap pergantian, dan yang mendengarkan sembilan puluh menit rekaman
    // ujian menghitung jeda itu ratusan kali.
    //
    // Yang dikirim di sini satu aliran berurutan: potongan diunduh satu per
    // satu dan disambung apa adanya. Itu memang bentuk aslinya — MediaRecorder
    // dengan `timeslice` menghasilkan pecahan dari SATU wadah, dan
    // menyambungnya kembali mengembalikan berkas yang sama seperti seandainya
    // ia tidak pernah dipecah.
    //
    // Dialirkan, bukan dikumpulkan di memori lebih dulu: ujian sembilan puluh
    // menit berisi 270 potongan, dan menahan seluruhnya sekaligus adalah cara
    // paling mudah membuat fungsi ini kehabisan memori pada peserta terpanjang.
    if (params.get("utuh")) {
      const simpanUtuh = storage();
      if (!simpanUtuh || rekaman.chunkCount === 0) {
        return Response.json({ success: false, message: "Rekamannya belum ada." }, { status: 404 });
      }
      const daftar = await simpanUtuh.list(rekaman.prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
      const nama = (daftar.data ?? []).map((o) => o.name).sort();
      if (nama.length === 0) {
        return Response.json({ success: false, message: "Rekamannya belum ada." }, { status: 404 });
      }

      const antre = [...nama];
      const aliran = new ReadableStream<Uint8Array>({
        async pull(kendali) {
          const berikut = antre.shift();
          if (!berikut) { kendali.close(); return; }
          try {
            const { data } = await simpanUtuh.download(`${rekaman.prefix}/${berikut}`);
            if (data) kendali.enqueue(new Uint8Array(await data.arrayBuffer()));
          } catch (galat) {
            // Satu potongan yang gagal diunduh tidak mematikan sisanya. Yang
            // terdengar adalah lompatan dua puluh detik — jauh lebih baik
            // daripada pemutar yang berhenti di tengah dan tidak menjelaskan
            // apa pun.
            console.error("unduh potongan rekaman", rekaman.prefix, berikut, galat);
          }
        },
      });

      // Jenisnya dibaca dari akhiran nama potongan — di sanalah ia disimpan
      // (lihat namaPotongan di src/lib/rekaman.ts), dan tabelnya tidak
      // menyimpan mime apa pun.
      const akhiran = (nama[0].split(".").pop() || "webm").toLowerCase();
      const jenis =
        akhiran === "m4a" ? "audio/mp4" : akhiran === "ogg" ? "audio/ogg" : akhiran === "mp3" ? "audio/mpeg" : "audio/webm";

      return new Response(aliran, {
        headers: {
          "Content-Type": jenis,
          "Cache-Control": "private, max-age=3600",
          "Content-Disposition": `inline; filename="rekaman-${attemptId}.${akhiran}"`,
        },
      });
    }

    const penggal = await db
      .select()
      .from(cbtTranscriptSegments)
      .where(eq(cbtTranscriptSegments.recordingId, rekaman.id))
      .orderBy(asc(cbtTranscriptSegments.startSec))
      .limit(2000);

    // ---------- ALAMAT PEMUTAR ----------
    // Potongannya tetap disimpan terpisah — itu yang membuat rekaman selamat
    // dari jaringan kampus yang putus. Yang DIGABUNG adalah pemutarannya:
    // lihat `utuh=1` di bawah, satu aliran berurutan untuk satu pemutar.
    // Daftar potongan di bawah tetap dikirim karena penanda transkrip
    // membutuhkan detik mulai tiap potongan.
    const simpan = storage();
    let potongan: Array<{ urut: number; url: string; mulai: number }> = [];
    if (simpan && rekaman.chunkCount > 0) {
      const daftar = await simpan.list(rekaman.prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
      const nama = (daftar.data ?? []).map((o) => o.name).sort();
      const { data } = await simpan.createSignedUrls(nama.map((n) => `${rekaman.prefix}/${n}`), 3600);
      potongan = (data ?? [])
        .map((d, i) => ({ urut: i, url: d.signedUrl ?? "", mulai: i * DETIK_POTONGAN }))
        .filter((p) => p.url !== "");
    }

    return Response.json({
      success: true,
      rekaman: {
        status: rekaman.status,
        durasi: rekaman.durationSec,
        potongan: rekaman.chunkCount,
        bita: rekaman.bytes,
        transkrip: rekaman.transcriptStatus,
        tanda: rekaman.flagStatus,
        jumlahTanda: rekaman.flagCount,
        catatan: rekaman.note || "",
        mulai: rekaman.startedAt ? rekaman.startedAt.toISOString() : null,
        selesai: rekaman.endedAt ? rekaman.endedAt.toISOString() : null,
      },
      potongan,
      penggal: penggal.map((p) => ({
        mulai: p.startSec,
        selesai: p.endSec,
        teks: p.text,
        kata: p.keyword || "",
        risiko: p.risk,
        alasan: p.reason || "",
      })),
      bolehTranskrip: bolehUbah(profile, ujian) && (await penyediaDengar()).length > 0,
    });
  } catch (error: unknown) {
    console.error("baca rekaman", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Rekaman belum dapat dimuat.") },
      { status: 500 },
    );
  }
}
