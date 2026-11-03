// ============================================================
// CBT — PENGUMPULAN TUGAS OLEH PESERTA (terbuka, tanpa akun)
//
// GET ?kode=XXXXXX   keterangan tugas: materi, judul, pengajar, tenggat,
//                    dan apakah pengumpulannya masih dibuka
// POST               kumpulkan: Markdown hasil pembacaan PDF + sidik SHA-256
//                    → kode SIPALING-TUGAS-XXXXXXXX
//
// PDF-NYA TIDAK DIKIRIM. Halaman CBT menyusun Markdown di peramban peserta
// (src/lib/pdf-markdown.ts) dan hanya teks itu yang berangkat. Tidak ada
// berkas yang menumpang di server, dan tidak ada batas unggah 4,5 MB yang
// dapat ditabrak PDF bergambar.
//
// SATU NOMOR PESERTA SATU KIRIMAN per tugas. Mengirim ulang diperbolehkan selama
// pengumpulan masih dibuka, TETAPI hanya dengan menyertakan kode kiriman
// lama: tanpa syarat itu, siapa pun yang tahu nomor peserta teman dapat menimpa
// kirimannya. Kode lama juga tidak pernah dibocorkan pada penolakan.
//
// Kemiripan dengan kiriman lain diperiksa SESUDAH jawaban terkirim (after),
// supaya peserta yang mengumpulkan pada menit terakhir tidak saling
// menunggu.
// ============================================================
import { after } from "next/server";
import { db } from "@/db";
import { cbtTaskSubmissions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { rapikanNama, rapikanNim } from "@/lib/cbt";
import { hitungKata } from "@/lib/pdf-markdown";
import { rapikanKodeResi, rapikanKodeTugas, sidikSah } from "@/lib/tugas-kode";
import {
  GalatNimKembar, MAKS_MD, MIN_KATA_KIRIM, kirimanCbtDariNim, plagiasiSesudahKirim, simpanKiriman, tugasDariKode,
  type BarisTugas,
} from "@/lib/tugas-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tolak = (message: string, status = 400) => Response.json({ success: false, message }, { status });

/** Ukuran berkas terbesar yang diterima (hanya keterangan; berkasnya tidak dikirim). */
const MAKS_UKURAN_PDF = 60 * 1024 * 1024;

function infoTugas(t: BarisTugas, sekarang = new Date()) {
  const lewat = Boolean(t.deadlineAt && t.deadlineAt.getTime() < sekarang.getTime());
  const terbuka = t.acceptOpen && !lewat;
  return {
    kode: t.code,
    mataKuliah: t.courseName,
    nomor: t.taskNo,
    judul: t.title,
    pengajar: t.lecturerName,
    kelas: t.className ?? "",
    tenggat: t.deadlineAt ? t.deadlineAt.toISOString() : null,
    terbuka,
    alasanTutup: terbuka ? "" : lewat ? "Batas waktu pengumpulan sudah lewat." : "Pengumpulan tugas ini sedang ditutup pengajar.",
    terbit: t.published,
  };
}

export async function GET(request: Request) {
  const batas = rateLimit({ request, name: "tugas-kumpul-lihat", limit: 300, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);
  try {
    const kode = rapikanKodeTugas(new URL(request.url).searchParams.get("kode"));
    if (!kode) return tolak("Kode tugas belum diisi.");
    const t = await tugasDariKode(kode);
    if (!t) return tolak("Kode tugas tidak ditemukan. Periksa lagi kode dari pengajar Anda.", 404);
    return Response.json({ success: true, tugas: infoTugas(t) });
  } catch (galat: unknown) {
    console.error("kumpul tugas GET", galat);
    return tolak(explainServerError(galat, "Tugas belum dapat dibuka."), 500);
  }
}

export async function POST(request: Request) {
  // Longgar per alamat: satu kelas sering mengumpulkan dari satu jaringan
  // kampus (satu alamat keluar) pada menit yang sama.
  const batas = rateLimit({ request, name: "tugas-kumpul", limit: 150, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return tolak("Kiriman tidak dapat dibaca. Teks tugasnya mungkin terlalu panjang.");

    const t = await tugasDariKode(rapikanKodeTugas(body.kode));
    if (!t) return tolak("Kode tugas tidak ditemukan.", 404);
    const info = infoTugas(t);
    if (!info.terbuka) return tolak(info.alasanTutup, 403);

    const nim = rapikanNim(body.nim);
    const nama = rapikanNama(body.nama);
    if (nim.length < 5) return tolak("Nomor peserta belum diisi dengan benar.");
    if (nama.length < 3) return tolak("Nama lengkap belum diisi.");

    const b = (body.berkas ?? {}) as Record<string, unknown>;
    const namaBerkas = String(b.nama ?? "").replace(/[\\/]/g, "_").trim().slice(0, 255);
    if (!/\.pdf$/i.test(namaBerkas)) return tolak("Tugas dikumpulkan dalam bentuk PDF (.pdf).");
    const ukuran = Math.round(Number(b.ukuran) || 0);
    if (ukuran <= 0 || ukuran > MAKS_UKURAN_PDF) return tolak("Ukuran PDF tidak wajar (paling besar 60 MB).");
    const sidik = String(b.sidik ?? "");
    if (!sidikSah(sidik)) return tolak("Sidik berkas tidak sah. Muat ulang halaman lalu kumpulkan lagi.");
    const halaman = Math.round(Number(b.halaman) || 0);
    if (halaman <= 0 || halaman > 5000) return tolak("Jumlah halaman PDF tidak terbaca.");

    const markdown = String(body.markdown ?? "").replace(/\r/g, "");
    if (markdown.length > MAKS_MD) return tolak("Teks tugas terlalu panjang (lebih dari ±60.000 kata). Kurangi lampirannya.", 413);
    const kata = hitungKata(markdown);
    if (kata < MIN_KATA_KIRIM) {
      return tolak(
        "PDF ini hampir tidak berisi teks (kemungkinan hasil pindaian atau foto), jadi tidak dapat dinilai. " +
          "Ekspor ulang dari Word/Google Docs sebagai PDF, lalu kumpulkan lagi.",
        422,
      );
    }

    const isi = {
      name: nama.slice(0, 160),
      fileName: namaBerkas,
      fileSize: ukuran,
      fileHash: sidik,
      pages: halaman,
      words: kata,
      markdown,
    };

    // ---------- SUDAH PERNAH MENGUMPULKAN ----------
    const lama = await kirimanCbtDariNim(t.id, nim);
    if (lama) {
      const kodeLama = rapikanKodeResi(body.kodeLama);
      if (!kodeLama || kodeLama !== lama.receipt) {
        return Response.json({
          success: false,
          sudahAda: true,
          message:
            "Nomor peserta ini sudah mengumpulkan tugas ini. Untuk mengganti kiriman, masukkan kode SIPALING-TUGAS kiriman " +
            "sebelumnya. Lupa kodenya? Hubungi pengajar Anda.",
        }, { status: 409 });
      }
      // Kiriman pengganti: kodenya tetap, penilaian dan pemeriksaannya diulang.
      await db.update(cbtTaskSubmissions).set({
        ...isi,
        status: "masuk", score: null, result: null, edited: false, gradedAt: null,
        decision: "", decidedBy: null, similarity: 0, similarityStatus: "bersih", similarTo: null,
        submittedAt: new Date(), updatedAt: new Date(),
      }).where(eq(cbtTaskSubmissions.id, lama.id));
      after(() => plagiasiSesudahKirim(t.id).catch((e) => console.error("plagiasi kumpul", e)));
      return Response.json({
        success: true, diganti: true, kode: lama.receipt, tugas: info,
        kiriman: { nama, nim, berkas: namaBerkas, halaman, kata, sidik, waktu: new Date().toISOString() },
      });
    }

    let baru;
    try {
      baru = await simpanKiriman({ taskId: t.id, nim, source: "cbt", ...isi });
    } catch (e) {
      if (e instanceof GalatNimKembar) {
        return tolak("Nomor peserta ini baru saja mengumpulkan tugas ini. Periksa kode SIPALING-TUGAS yang sudah Anda terima.", 409);
      }
      throw e;
    }
    after(() => plagiasiSesudahKirim(t.id).catch((e) => console.error("plagiasi kumpul", e)));
    return Response.json({
      success: true, kode: baru.receipt, tugas: info,
      kiriman: { nama, nim, berkas: namaBerkas, halaman, kata, sidik, waktu: baru.submittedAt.toISOString() },
    }, { status: 201 });
  } catch (galat: unknown) {
    console.error("kumpul tugas POST", galat);
    return tolak(explainServerError(galat, "Tugas belum dapat dikumpulkan. Coba lagi sebentar."), 500);
  }
}
