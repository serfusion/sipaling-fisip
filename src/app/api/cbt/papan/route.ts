// ============================================================
// CBT — PAPAN NILAI TUGAS (terbuka, tanpa akun)
//
// GET               tugas yang nilainya sudah diterbitkan pengajar
// GET ?tugas=ID     papan satu tugas: peringkat, nilai, predikat, nilai merah
//                   (di bawah batas kritis), penanda plagiasi, dan tanda
//                   bahwa baris itu punya keterangan TERKUNCI
// POST {kode}       buka dengan kode SIPALING-TUGAS: status kiriman; bila
//                   sudah terbit, nilai, peringkat, keterangan, umpan balik,
//                   dan data laporan PDF-nya
// POST {kode,baris} sama, tetapi untuk membuka keterangan SATU BARIS papan:
//                   kodenya harus milik baris itu
//
// Batas yang dijaga di sini, dan alasannya:
//   - Papan memuat nama dan nomor peserta tersamar, tidak pernah kode kiriman. Kode
//     adalah "kata sandi" keterangan nilai; yang tercetak di papan bukan
//     kata sandi lagi.
//   - Isi keterangan (alasan nilai merah, indikasi plagiasi, kalimat yang
//     sama) hanya keluar untuk pemilik kode. Yang lain melihat bahwa ada
//     keterangan, tidak melihat isinya.
//   - Tugas yang belum diterbitkan tidak tampil, dan kodenya hanya menjawab
//     "sudah diterima".
//   - Pembukaan dengan kode dibatasi lajunya, dan kodenya 30^8 kemungkinan,
//     jadi menebak kode orang lain bukan jalan yang masuk akal.
// ============================================================
import { db } from "@/db";
import { cbtTasks } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { ejaRentang, predikatTugas } from "@/lib/tugas-rubrik";
import { TEMPLATE_BAWAAN, KAKI_SPF } from "@/lib/tugas-template";
import { cuplikanSama } from "@/lib/tugas-plagiasi";
import { rapikanKodeResi } from "@/lib/tugas-kode";
import {
  keteranganNilai, nilaiEfektif, nilaiKritis, rapikanTindakan, susunDataLaporan, susunPapan, terindikasi,
  type KirimanPapan,
} from "@/lib/tugas-papan";
import {
  hasilDari, kirimanDariId, kirimanDariResi, kirimanTugas, nilaiDari, rubrikDari, skalaDari, tugasDariId, tugasLaporan,
  type BarisTugas,
} from "@/lib/tugas-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tolak = (message: string, status = 400) => Response.json({ success: false, message }, { status });

function infoTugas(t: BarisTugas) {
  return {
    id: t.id,
    mataKuliah: t.courseName,
    nomor: t.taskNo,
    judul: t.title,
    pengajar: t.lecturerName,
    kelas: t.className ?? "",
    terbitPada: t.publishedAt ? t.publishedAt.toISOString() : null,
    batasKritis: t.criticalScore,
  };
}

async function papanTugas(t: BarisTugas) {
  const kiriman = await kirimanTugas(t.id);
  const masuk: KirimanPapan[] = kiriman.map((k) => {
    const h = hasilDari(k);
    return {
      id: k.id,
      nama: k.name,
      nim: k.nim,
      status: k.status,
      nilai: nilaiDari(k),
      plagiasi: { status: k.similarityStatus, skor: k.similarity, putusan: k.decision },
      gerbangIsiLolos: h ? h.gerbang?.lolos !== false : undefined,
    };
  });
  return susunPapan(masuk, { batasKritis: t.criticalScore, skala: skalaDari(t), tindakan: rapikanTindakan(t.plagiarismAction) });
}

export async function GET(request: Request) {
  const batas = rateLimit({ request, name: "papan-lihat", limit: 600, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);
  try {
    const id = Number(new URL(request.url).searchParams.get("tugas"));
    if (!id) {
      const daftar = await db
        .select({
          t: cbtTasks,
          jumlah: sql<number>`(SELECT count(*)::int FROM cbt_task_submissions s WHERE s.task_id = cbt_tasks.id)`,
        })
        .from(cbtTasks)
        .where(eq(cbtTasks.published, true))
        .orderBy(desc(cbtTasks.publishedAt))
        .limit(200);
      return Response.json({ success: true, tugas: daftar.map((d) => ({ ...infoTugas(d.t), jumlah: d.jumlah })) });
    }
    const t = await tugasDariId(id);
    if (!t || !t.published) return tolak("Papan nilai tugas ini belum diterbitkan.", 404);
    const papan = await papanTugas(t);
    return Response.json({ success: true, tugas: infoTugas(t), ...papan });
  } catch (galat: unknown) {
    console.error("papan nilai GET", galat);
    return tolak(explainServerError(galat, "Papan nilai belum dapat dimuat."), 500);
  }
}

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "papan-kode", limit: 40, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);
  try {
    const body = (await request.json().catch(() => null)) as { kode?: unknown; baris?: unknown } | null;
    const resi = rapikanKodeResi(body?.kode);
    if (!resi) return tolak("Kode tidak dikenali. Bentuknya SIPALING-TUGAS- diikuti 8 huruf/angka.");
    const k = await kirimanDariResi(resi);
    if (!k) return tolak("Kode tidak ditemukan. Periksa lagi kode kiriman Anda.", 404);
    if (body?.baris !== undefined && body.baris !== null && Number(body.baris) !== k.id) {
      return tolak("Kode ini bukan milik baris tersebut. Keterangan hanya dapat dibuka pemilik kodenya.", 403);
    }
    const t = await tugasDariId(k.taskId);
    if (!t) return tolak("Tugas kiriman ini sudah dihapus pengajar.", 404);

    const dasar = {
      success: true,
      tugas: { ...infoTugas(t), terbit: t.published },
      kiriman: {
        kode: k.receipt, nama: k.name, nim: k.nim, asal: k.source, berkas: k.fileName, ukuran: k.fileSize,
        halaman: k.pages, kata: k.words, sidik: k.fileHash, dikumpulkan: k.submittedAt.toISOString(),
      },
    };
    if (!t.published) {
      return Response.json({ ...dasar, terbit: false, pesan: "Kiriman Anda sudah diterima. Nilainya belum diterbitkan pengajar." });
    }

    const tindakan = rapikanTindakan(t.plagiarismAction);
    const plagiasi = { status: k.similarityStatus, skor: k.similarity, putusan: k.decision };
    const ef = nilaiEfektif({ status: k.status, nilai: nilaiDari(k), plagiasi }, tindakan);
    const rubrik = rubrikDari(t);
    const skala = skalaDari(t);
    const hasil = hasilDari(k);
    const papan = await papanTugas(t);
    const baris = papan.baris.find((b) => b.baris === k.id);

    // Contoh kalimat yang sama: diambil dari teks PEMILIK kode sendiri, dan
    // kiriman pembandingnya tidak disebut namanya.
    let kalimat: string[] = [];
    if (terindikasi(plagiasi) && k.similarTo) {
      const lawan = await kirimanDariId(k.similarTo);
      if (lawan && lawan.taskId === k.taskId) kalimat = cuplikanSama(k.markdown, lawan.markdown).slice(0, 3);
    }
    const keterangan = keteranganNilai({
      nilai: ef.nilai, status: ef.keadaan, batasKritis: t.criticalScore, rubrik, hasil, plagiasi, kalimatSama: kalimat,
    });

    const pred = ef.nilai !== null ? predikatTugas(ef.nilai, skala) : null;
    const laporan = ef.keadaan === "dinilai" && hasil
      ? {
        template: t.template || TEMPLATE_BAWAAN,
        kaki: t.footerOn ? KAKI_SPF : "",
        data: susunDataLaporan({
          tugas: tugasLaporan(t),
          mahasiswa: { nama: k.name, nim: k.nim },
          rubrik, skala, hasil, status: k.status, plagiasi, tindakan, batasKritis: t.criticalScore,
          dinilai: k.gradedAt ? k.gradedAt.toISOString() : null, kode: k.receipt,
        }),
      }
      : null;

    return Response.json({
      ...dasar,
      terbit: true,
      nilai: {
        angka: ef.nilai,
        keadaan: ef.keadaan,
        predikat: pred?.huruf ?? "",
        rentang: pred ? ejaRentang(pred) : "",
        peringkat: baris?.peringkat ?? null,
        dari: papan.ringkas.dinilai,
        kritis: nilaiKritis(ef.nilai, t.criticalScore),
        batasKritis: t.criticalScore,
        penanda: baris?.penanda ?? "",
      },
      keterangan,
      rincian: hasil && ef.keadaan === "dinilai" && !ef.nol
        ? {
          judul: hasil.judul,
          kriteria: rubrik.kriteria.map((kr, i) => {
            const x = hasil.kriteria?.find((y) => y.urut === i) ?? hasil.kriteria?.[i];
            return { nama: kr.nama, bobot: kr.bobot, skor: x?.skor ?? null, capaian: x?.capaian ?? "" };
          }),
          kelebihan: hasil.kelebihan ?? [],
          perbaikan: hasil.perbaikan ?? [],
          catatan: hasil.catatan ?? "",
        }
        : null,
      laporan,
    });
  } catch (galat: unknown) {
    console.error("papan nilai POST", galat);
    return tolak(explainServerError(galat, "Kode belum dapat diperiksa."), 500);
  }
}
