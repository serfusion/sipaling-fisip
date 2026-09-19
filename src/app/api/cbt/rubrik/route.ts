// ============================================================
// CBT — RUBRIK PENILAIAN ESAI
//
// GET             daftar rubrik milik portal + rubrik siap pakai bawaan
// POST            buat rubrik baru (boleh menyalin salah satu bawaan)
// PATCH           sunting rubrik
// DELETE ?id=     hapus rubrik
//
// ------------------------------------------------------------
// SIAPA YANG BOLEH MENYUNTING APA
// ------------------------------------------------------------
// Rubrik dipakai bersama-sama: dosen A menyusun "Rubrik Esai Metodologi", dan
// dosen B memakainya untuk ujiannya sendiri. Itu memang yang dikehendaki —
// menyusun rubrik yang baik memakan waktu, dan menyuruh tiap dosen menyusunnya
// sendiri berarti hampir tidak ada yang memakainya.
//
// Yang MENYUNTING tetap pemiliknya saja, ditambah Admin dan Super Admin. Kalau
// siapa pun boleh mengubah rubrik milik siapa pun, nilai yang sudah keluar
// dapat berubah artinya tanpa sepengetahuan yang mengeluarkannya.
//
// Rubrik BAWAAN tidak tersimpan di basis data sama sekali. Ia hidup di dalam
// kode (src/lib/rubrik.ts) dan hanya ditawarkan untuk DISALIN. Dengan begitu
// tidak ada satu baris pun yang dapat dihapus seseorang lalu hilang bagi
// seluruh portal.
// ============================================================
import { db } from "@/db";
import { cbtExams, cbtRubrics } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { angkaParam, bolehCbt } from "@/lib/cbt";
import {
  MAKS_KRITERIA, MAKS_LEVEL, RUBRIK_BAWAAN, bacaKriteria, periksaRubrik,
  type KriteriaRubrik, type Rubrik,
} from "@/lib/rubrik";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENGELOLA = ["super_admin", "admin"];

function bolehSunting(profile: { id: string; role: string }, rubrik: { ownerId: string | null }) {
  if (PENGELOLA.includes(profile.role)) return true;
  return Boolean(rubrik.ownerId) && rubrik.ownerId === profile.id;
}

/**
 * Bersihkan kriteria yang datang dari layar.
 *
 * Yang masuk dari peramban tidak pernah dipercaya bentuknya — termasuk ketika
 * peramban itu milik dosen sendiri. Bobot dijepit 0–100, jumlah kriteria dan
 * level dibatasi, dan deskriptor dipotong. Rubrik dengan delapan ratus
 * kriteria bukan rubrik; ia perintah untuk menghabiskan jatah model pada satu
 * permintaan.
 */
function bersihkanKriteria(masukan: unknown): KriteriaRubrik[] {
  const daftar = Array.isArray(masukan) ? masukan : [];
  return daftar
    .slice(0, MAKS_KRITERIA)
    .map((k) => {
      const baris = k as Partial<KriteriaRubrik>;
      const levels = (Array.isArray(baris.levels) ? baris.levels : [])
        .slice(0, MAKS_LEVEL)
        .map((l) => ({
          level: Math.round(Number((l as { level?: unknown })?.level) || 0),
          deskriptor: String((l as { deskriptor?: unknown })?.deskriptor ?? "").trim().slice(0, 2000),
          // Ambang panjang, inti penilaian yang berjalan sampai selesai
          // tanpa ketukan pengajar. Dijepit pada batas yang masih masuk akal
          // untuk satu jawaban esai.
          minKata: Math.max(0, Math.min(5000, Math.round(Number((l as { minKata?: unknown })?.minKata) || 0))),
        }))
        .filter((l) => Number.isFinite(l.level) && l.level > 0)
        .sort((a, b) => a.level - b.level);
      return {
        nama: String(baris.nama ?? "").trim().slice(0, 160),
        bobot: Math.max(0, Math.min(100, Math.round(Number(baris.bobot) || 0))),
        levels,
      };
    })
    .filter((k) => k.nama !== "");
}

function bentukRubrik(body: Record<string, unknown>): Rubrik {
  const min = Math.round(Number(body.skalaMin) || 1);
  const max = Math.round(Number(body.skalaMax) || 4);
  return {
    nama: String(body.nama ?? "").trim().slice(0, 160),
    keterangan: String(body.keterangan ?? "").trim().slice(0, 1000),
    skalaMin: min,
    skalaMax: max,
    kriteria: bersihkanKriteria(body.kriteria),
  };
}

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) {
      return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
    }

    const baris = await db.select().from(cbtRubrics).orderBy(desc(cbtRubrics.updatedAt)).limit(200);

    // Berapa ujian yang memakai tiap rubrik. Dihitung sekali untuk seluruh
    // daftar, bukan satu pertanyaan per rubrik — dan yang membacanya adalah
    // tombol hapus, yang harus dapat mengatakan "dipakai 3 ujian" SEBELUM
    // ditekan, bukan sesudahnya.
    const pakai = await db
      .select({ rubricId: cbtExams.rubricId, jumlah: sql<number>`count(*)::int` })
      .from(cbtExams)
      .where(sql`${cbtExams.rubricId} is not null`)
      .groupBy(cbtExams.rubricId);
    const petaPakai = new Map(pakai.map((p) => [p.rubricId, p.jumlah]));

    return Response.json({
      success: true,
      rubrik: baris.map((r) => ({
        id: r.id,
        nama: r.name,
        keterangan: r.description || "",
        skalaMin: r.scaleMin,
        skalaMax: r.scaleMax,
        kriteria: bacaKriteria(r.criteria),
        pemilik: r.createdBy,
        milikSaya: r.ownerId === profile.id,
        bolehSunting: bolehSunting(profile, r),
        dipakai: petaPakai.get(r.id) ?? 0,
        diubah: r.updatedAt.toISOString(),
      })),
      // Rubrik siap pakai, dikirim apa adanya untuk disalin. Tidak punya id
      // karena ia memang bukan baris basis data.
      bawaan: RUBRIK_BAWAAN,
    });
  } catch (error: unknown) {
    console.error("daftar rubrik", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Daftar rubrik belum dapat dimuat.") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) {
      return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const rubrik = bentukRubrik(body);
    const periksa = periksaRubrik(rubrik);
    if (!periksa.ok) return Response.json({ success: false, message: periksa.pesan }, { status: 400 });

    const dibuat = await db
      .insert(cbtRubrics)
      .values({
        name: rubrik.nama,
        description: rubrik.keterangan || null,
        scaleMin: rubrik.skalaMin,
        scaleMax: rubrik.skalaMax,
        criteria: JSON.stringify(rubrik.kriteria),
        ownerId: profile.id,
        createdBy: profile.fullName,
      })
      .returning({ id: cbtRubrics.id });

    return Response.json({ success: true, id: dibuat[0].id }, { status: 201 });
  } catch (error: unknown) {
    console.error("buat rubrik", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Rubrik belum tersimpan.") },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) {
      return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const id = angkaParam(String(body.id ?? ""));
    if (id === null) return Response.json({ success: false, message: "Rubrik tidak dikenali." }, { status: 400 });

    const ada = await db.select().from(cbtRubrics).where(eq(cbtRubrics.id, id)).limit(1);
    const lama = ada[0];
    if (!lama) return Response.json({ success: false, message: "Rubrik tidak ditemukan." }, { status: 404 });
    if (!bolehSunting(profile, lama)) {
      return Response.json(
        { success: false, message: "Rubrik ini milik pengajar lain. Salin dulu bila ingin mengubahnya." },
        { status: 403 },
      );
    }

    const rubrik = bentukRubrik(body);
    const periksa = periksaRubrik(rubrik);
    if (!periksa.ok) return Response.json({ success: false, message: periksa.pesan }, { status: 400 });

    // Rubrik yang sudah DIPAKAI ujian tetap boleh disunting, dan itu disengaja.
    // Kesalahan ketik pada deskriptor harus dapat dibetulkan. Yang berubah
    // artinya adalah skor yang sudah tersimpan dengan nomor urut kriteria
    // lamanya — karena itu panel penilaian selalu menunjukkan nama kriteria
    // sebagaimana tersimpan bersama skornya, bukan sebagaimana rubriknya
    // sekarang. Dosen dapat melihat bahwa keduanya berbeda.
    await db
      .update(cbtRubrics)
      .set({
        name: rubrik.nama,
        description: rubrik.keterangan || null,
        scaleMin: rubrik.skalaMin,
        scaleMax: rubrik.skalaMax,
        criteria: JSON.stringify(rubrik.kriteria),
        updatedAt: new Date(),
      })
      .where(eq(cbtRubrics.id, id));

    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("sunting rubrik", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Rubrik belum tersimpan.") },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) {
      return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
    }
    const id = angkaParam(new URL(request.url).searchParams.get("id"));
    if (id === null) return Response.json({ success: false, message: "Rubrik tidak dikenali." }, { status: 400 });

    const ada = await db.select().from(cbtRubrics).where(eq(cbtRubrics.id, id)).limit(1);
    const rubrik = ada[0];
    if (!rubrik) return Response.json({ success: true });
    if (!bolehSunting(profile, rubrik)) {
      return Response.json({ success: false, message: "Rubrik ini milik pengajar lain." }, { status: 403 });
    }

    // Rubrik yang masih dipakai ujian TIDAK dihapus, dan penolakannya menyebut
    // berapa ujian. Menghapusnya akan membuat lembar penilaian ujian-ujian itu
    // kehilangan nama kriterianya berbulan-bulan kemudian — tepat ketika ada
    // yang menggugat nilainya dan bertanya "dinilai pakai rubrik yang mana".
    const [{ jumlah }] = await db
      .select({ jumlah: sql<number>`count(*)::int` })
      .from(cbtExams)
      .where(eq(cbtExams.rubricId, id));
    if (jumlah > 0) {
      return Response.json(
        {
          success: false,
          message:
            `Rubrik ini masih dipakai ${jumlah} ujian. Lepaskan dulu dari ujiannya, ` +
            "atau biarkan saja — rubrik yang tidak dipakai tidak mengganggu apa pun.",
        },
        { status: 409 },
      );
    }

    await db.delete(cbtRubrics).where(eq(cbtRubrics.id, id));
    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("hapus rubrik", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Rubrik belum dapat dihapus.") },
      { status: 500 },
    );
  }
}
