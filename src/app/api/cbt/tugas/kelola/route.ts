// ============================================================
// CBT — KELOLA TUGAS (pengajar)
//
// GET              daftar tugas yang terlihat (milik sendiri; Admin dan Super
//                  Admin melihat semuanya), beserta hitungan kirimannya
// GET ?id=         satu tugas lengkap: pengaturan, kiriman (tanpa isi .md),
//                  dan pasangan kiriman yang mirip
// POST aksi=buat   tugas baru dengan kode pengumpulan
// POST aksi=ubah   ubah pengaturan (pemilik saja)
// POST aksi=salin  salin pengaturan tugas yang terlihat menjadi tugas baru
// POST aksi=pindah pindahkan pengaturan tugas v53 dari peramban ke server
// DELETE ?id=      hapus tugas beserta seluruh kiriman dan nilainya
//
// Wewenang mengikuti ujian CBT (src/lib/cbt.ts): pemilik mengubah dan
// menilai; Admin dan Super Admin memantau dan boleh menghapus.
// ============================================================
import { db } from "@/db";
import { cbtTasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { bolehCbt, bolehHapus, bolehPantau, bolehUbah, type Pemakai } from "@/lib/cbt";
import { rapikanAmbang } from "@/lib/mirip-jawaban";
import { rapikanRubrikTugas, rapikanSkala } from "@/lib/tugas-rubrik";
import { TEMPLATE_BAWAAN } from "@/lib/tugas-template";
import { rapikanBatasKritis, rapikanTindakan } from "@/lib/tugas-papan";
import {
  buatTugas, daftarTugasUntuk, hitungUlangPlagiasi, kepemilikan, kirimanKeKlien, kirimanTugas,
  pasanganKeKlien, pasanganTugas, tugasDariId, tugasKeKlien, type BarisTugas,
} from "@/lib/tugas-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tolak = (message: string, status = 400) => Response.json({ success: false, message }, { status });

const teks = (v: unknown, maks: number) => String(v ?? "").replace(/\r/g, "").trim().slice(0, maks);

/**
 * Pengaturan dari peramban → kolom tabel. Hanya kunci yang dikirim yang
 * diubah, dan setiap nilainya dibersihkan di sini, bukan dipercaya.
 */
function kolomDari(ubah: Record<string, unknown>): Partial<typeof cbtTasks.$inferInsert> {
  const k: Partial<typeof cbtTasks.$inferInsert> = {};
  if ("mataKuliah" in ubah) k.courseName = teks(ubah.mataKuliah, 160);
  if ("nomor" in ubah) k.taskNo = teks(ubah.nomor, 20);
  if ("nama" in ubah) k.title = teks(ubah.nama, 300);
  if ("petunjuk" in ubah) k.instruction = teks(ubah.petunjuk, 8000);
  if ("dosen" in ubah) k.lecturerName = teks(ubah.dosen, 160);
  if ("kelas" in ubah) k.className = teks(ubah.kelas, 80) || null;
  if ("rubrik" in ubah) k.rubric = JSON.stringify(rapikanRubrikTugas(ubah.rubrik));
  if ("template" in ubah) {
    const t = String(ubah.template ?? "").replace(/\r/g, "").slice(0, 60_000);
    // Template bawaan disimpan sebagai kosong, supaya perbaikan template
    // bawaan kelak ikut sampai ke tugas lama yang memakainya.
    k.template = t.trim() === TEMPLATE_BAWAAN.trim() ? "" : t;
  }
  if ("namaTemplate" in ubah) k.templateName = teks(ubah.namaTemplate, 200);
  if ("skala" in ubah) k.scale = JSON.stringify(rapikanSkala(ubah.skala));
  if ("kakiSpf" in ubah) k.footerOn = Boolean(ubah.kakiSpf);
  if ("batasKritis" in ubah) k.criticalScore = rapikanBatasKritis(ubah.batasKritis);
  if ("ambangTinjau" in ubah || "ambangTinggi" in ubah) {
    const a = rapikanAmbang({ tinjau: Number(ubah.ambangTinjau ?? 25), tinggi: Number(ubah.ambangTinggi ?? 50) });
    k.plagiarismReview = a.tinjau;
    k.plagiarismHigh = a.tinggi;
  }
  if ("tindakan" in ubah) k.plagiarismAction = rapikanTindakan(ubah.tindakan);
  if ("terbuka" in ubah) k.acceptOpen = Boolean(ubah.terbuka);
  if ("tenggat" in ubah) {
    const d = ubah.tenggat ? new Date(String(ubah.tenggat)) : null;
    k.deadlineAt = d && Number.isFinite(d.getTime()) ? d : null;
  }
  return k;
}

async function rinci(t: BarisTugas, profile: Pemakai) {
  const tindakan = rapikanTindakan(t.plagiarismAction);
  const [kiriman, pasangan] = await Promise.all([kirimanTugas(t.id), pasanganTugas(t.id)]);
  return {
    tugas: tugasKeKlien(t),
    kiriman: kiriman.map((k) => kirimanKeKlien(k, tindakan)),
    pasangan: pasangan.map(pasanganKeKlien),
    boleh: { ubah: bolehUbah(profile, kepemilikan(t)), hapus: bolehHapus(profile, kepemilikan(t)) },
  };
}

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) return tolak("Menu CBT tidak tersedia untuk role Anda.", 403);
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ success: true, tugas: await daftarTugasUntuk(profile) });

    const t = await tugasDariId(id);
    if (!t || !bolehPantau(profile, kepemilikan(t))) return tolak("Tugas tidak ditemukan.", 404);
    return Response.json({ success: true, ...(await rinci(t, profile)) });
  } catch (galat: unknown) {
    console.error("kelola tugas GET", galat);
    return tolak(explainServerError(galat, "Tugas belum dapat dimuat."), 500);
  }
}

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "tugas-kelola", limit: 600, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) return tolak("Menu CBT tidak tersedia untuk role Anda.", 403);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return tolak("Permintaan tidak dapat dibaca.");
    const aksi = String(body.aksi ?? "");

    if (aksi === "buat") {
      const isi = kolomDari((body.isi ?? {}) as Record<string, unknown>);
      const t = await buatTugas(profile, { lecturerName: isi.lecturerName ?? profile.fullName.slice(0, 160), ...isi });
      return Response.json({ success: true, ...(await rinci(t, profile)) }, { status: 201 });
    }

    if (aksi === "pindah") {
      // Pengaturan tugas v53 yang selama ini hanya hidup di peramban pengajar.
      const daftar = (Array.isArray(body.tugas) ? body.tugas : []).slice(0, 50);
      const dibuat: number[] = [];
      for (const x of daftar) {
        const isi = kolomDari((x ?? {}) as Record<string, unknown>);
        const t = await buatTugas(profile, isi);
        dibuat.push(t.id);
      }
      return Response.json({ success: true, dibuat, tugas: await daftarTugasUntuk(profile) });
    }

    const t = await tugasDariId(Number(body.id));
    if (!t || !bolehPantau(profile, kepemilikan(t))) return tolak("Tugas tidak ditemukan.", 404);

    if (aksi === "salin") {
      const baru = await buatTugas(profile, {
        courseName: t.courseName, taskNo: "", title: t.title ? `${t.title} (salinan)`.slice(0, 300) : "",
        instruction: t.instruction, lecturerName: t.lecturerName, className: t.className, rubric: t.rubric,
        template: t.template, templateName: t.templateName, scale: t.scale, footerOn: t.footerOn,
        criticalScore: t.criticalScore, plagiarismReview: t.plagiarismReview, plagiarismHigh: t.plagiarismHigh,
        plagiarismAction: t.plagiarismAction,
      });
      return Response.json({ success: true, ...(await rinci(baru, profile)) }, { status: 201 });
    }

    if (aksi === "ubah") {
      if (!bolehUbah(profile, kepemilikan(t))) {
        return tolak("Hanya pembuat tugas ini yang dapat mengubah pengaturannya.", 403);
      }
      const ubah = (body.ubah ?? {}) as Record<string, unknown>;
      const kolom = kolomDari(ubah);
      if ("terbit" in ubah) {
        kolom.published = Boolean(ubah.terbit);
        // Waktu terbit dicatat sekali, saat pertama kali diterbitkan.
        if (kolom.published && !t.published) kolom.publishedAt = new Date();
      }
      if (!Object.keys(kolom).length) return tolak("Tidak ada yang diubah.");
      const [baru] = await db.update(cbtTasks).set({ ...kolom, updatedAt: new Date() }).where(eq(cbtTasks.id, t.id)).returning();
      // Ambang yang berubah membuat status kemiripan lama tidak berlaku.
      const ambangBerubah = (kolom.plagiarismReview !== undefined && kolom.plagiarismReview !== t.plagiarismReview) ||
        (kolom.plagiarismHigh !== undefined && kolom.plagiarismHigh !== t.plagiarismHigh);
      if (ambangBerubah) await hitungUlangPlagiasi(baru);
      const lengkap = body.lengkap === true || ambangBerubah || "tindakan" in ubah;
      return Response.json({ success: true, tugas: tugasKeKlien(baru), ...(lengkap ? await rinci(baru, profile) : {}) });
    }

    return tolak("Aksi tidak dikenali.");
  } catch (galat: unknown) {
    console.error("kelola tugas POST", galat);
    return tolak(explainServerError(galat, "Tugas belum dapat disimpan."), 500);
  }
}

export async function DELETE(request: Request) {
  const batas = rateLimit({ request, name: "tugas-hapus", limit: 30, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) return tolak("Menu CBT tidak tersedia untuk role Anda.", 403);
    const t = await tugasDariId(Number(new URL(request.url).searchParams.get("id")));
    if (!t || !bolehPantau(profile, kepemilikan(t))) return tolak("Tugas tidak ditemukan.", 404);
    if (!bolehHapus(profile, kepemilikan(t))) return tolak("Anda tidak berwenang menghapus tugas ini.", 403);
    // Kiriman, nilai, dan pasangan kemiripan ikut terhapus (ON DELETE
    // CASCADE). Tautan Arsip Drive-nya TETAP ada: task_id menjadi kosong.
    await db.delete(cbtTasks).where(eq(cbtTasks.id, t.id));
    return Response.json({ success: true, pesan: "Tugas beserta seluruh kiriman dan nilainya sudah dihapus." });
  } catch (galat: unknown) {
    console.error("kelola tugas DELETE", galat);
    return tolak(explainServerError(galat, "Tugas belum dapat dihapus."), 500);
  }
}
