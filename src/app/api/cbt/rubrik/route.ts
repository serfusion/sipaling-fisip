// ============================================================
// CBT — RUBRIK PENILAIAN ESAI
//
// GET             daftar rubrik milik portal + rubrik siap pakai bawaan
//                 + rubrik tiap mata uji yang boleh dilihat pemanggilnya
// POST            buat rubrik baru (boleh menyalin salah satu bawaan)
// POST aksi=matkul  pasang / ganti / lepas rubrik satu mata uji
// PATCH           sunting rubrik
// DELETE ?id=     hapus rubrik
//
// ------------------------------------------------------------
// SATU MATA UJI, SATU RUBRIK
// ------------------------------------------------------------
// Sejak v49 rubrik dipasang pada MATA UJI, bukan pada ujian. Seluruh ujian
// yang nama mata ujinya sama dinilai AI dengan rubrik itu, termasuk ujian
// yang dibuat sebelum rubriknya dipasang. Yang boleh memasangnya: pengajar
// yang memiliki minimal satu ujian mata uji itu, ditambah Admin dan Super
// Admin.
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
import { cbtCourseRubrics, cbtExams, cbtRubrics } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { angkaParam, bolehCbt, pemilik } from "@/lib/cbt";
import { daftarRubrikMatkul, pasangRubrikMatkul } from "@/lib/cbt-store";
import { kunciMatkul } from "@/lib/penilaian-ai";
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

type Profil = NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>;

/**
 * Mata uji dari ujian-ujian yang ada, beserta apakah pemanggil boleh
 * memasang rubriknya.
 *
 * Pengajar melihat mata uji dari ujiannya sendiri; Admin dan Super Admin
 * melihat semuanya. Yang boleh MEMASANG sama dengan yang boleh melihat:
 * pengajar yang memiliki minimal satu ujian mata uji itu, karena rubrik
 * yang ia pasang langsung menilai ujiannya sendiri.
 */
async function matkulDariUjian(profile: Profil) {
  const ujian = await db
    .select({
      courseName: cbtExams.courseName,
      lecturerId: cbtExams.lecturerId,
      createdBy: cbtExams.createdBy,
      createdById: cbtExams.createdById,
    })
    .from(cbtExams)
    .orderBy(desc(cbtExams.createdAt))
    .limit(3000);

  const kelola = PENGELOLA.includes(profile.role);
  const peta = new Map<string, { mataKuliah: string; jumlahUjian: number }>();
  for (const u of ujian) {
    if (!kelola && !pemilik(profile, u)) continue;
    const kunci = kunciMatkul(u.courseName);
    if (!kunci) continue;
    const ada = peta.get(kunci);
    if (ada) ada.jumlahUjian += 1;
    else peta.set(kunci, { mataKuliah: u.courseName, jumlahUjian: 1 });
  }
  return { peta, kelola };
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

    // Rubrik tiap mata uji. null berarti SQL v49 belum dijalankan.
    const terpasang = await daftarRubrikMatkul();

    // Berapa mata uji yang memakai tiap rubrik. Yang membacanya adalah
    // tombol hapus, yang harus dapat mengatakan "dipakai 3 mata uji"
    // SEBELUM ditekan, bukan sesudahnya.
    const petaPakai = new Map<number, number>();
    for (const m of terpasang ?? []) petaPakai.set(m.rubrikId, (petaPakai.get(m.rubrikId) ?? 0) + 1);

    // Daftar mata uji yang dapat dilihat pemanggil: dari ujiannya, dan
    // (bagi pengelola) juga yang sudah berubrik walau ujiannya sudah dihapus.
    const { peta, kelola } = await matkulDariUjian(profile);
    const petaTerpasang = new Map((terpasang ?? []).map((m) => [m.kunci, m]));
    const kunciTampil = new Set(peta.keys());
    if (kelola) for (const m of terpasang ?? []) kunciTampil.add(m.kunci);
    const matkul = [...kunciTampil]
      .map((kunci) => {
        const u = peta.get(kunci);
        const m = petaTerpasang.get(kunci);
        return {
          kunci,
          mataKuliah: m?.mataKuliah || u?.mataKuliah || kunci,
          jumlahUjian: u?.jumlahUjian ?? 0,
          rubrikId: m?.rubrikId ?? null,
          rubrikNama: m?.rubrikNama ?? "",
          diaturOleh: m?.diaturOleh ?? "",
          diubah: m?.diubah ?? null,
          bolehAtur: kelola || Boolean(u),
        };
      })
      .sort((a, b) => a.mataKuliah.localeCompare(b.mataKuliah, "id"));

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
        // Jumlah MATA UJI yang memakainya, bukan jumlah ujian.
        dipakai: petaPakai.get(r.id) ?? 0,
        diubah: r.updatedAt.toISOString(),
      })),
      // Rubrik siap pakai, dikirim apa adanya untuk disalin. Tidak punya id
      // karena ia memang bukan baris basis data.
      bawaan: RUBRIK_BAWAAN,
      matkul,
      // Seluruh rubrik mata uji yang terpasang, termasuk mata uji yang
      // ujiannya bukan milik pemanggil. Dipakai formulir ujian untuk
      // menunjukkan rubrik yang SUDAH berlaku begitu nama mata ujinya
      // diketik, misalnya yang dipasang rekan pengajar kelas paralel.
      terpasang: (terpasang ?? []).map((m) => ({
        kunci: m.kunci, rubrikId: m.rubrikId, rubrikNama: m.rubrikNama, diaturOleh: m.diaturOleh,
      })),
      matkulSiap: terpasang !== null,
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

    // ---------- RUBRIK SATU MATA UJI ----------
    if (body.aksi === "matkul") {
      const mataKuliah = String(body.mataKuliah ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
      const kunci = kunciMatkul(mataKuliah);
      if (!kunci) return Response.json({ success: false, message: "Mata uji tidak dikenali." }, { status: 400 });

      const { peta, kelola } = await matkulDariUjian(profile);
      if (!kelola && !peta.has(kunci)) {
        return Response.json(
          {
            success: false,
            message: "Rubrik mata uji ini hanya dapat dipasang pengajar yang memiliki ujiannya, atau Admin.",
          },
          { status: 403 },
        );
      }

      // Ejaan yang tersimpan diambil dari ujiannya bila ada, supaya daftar
      // menampilkan nama yang sama dengan yang tertulis di kartu ujian.
      const ejaan = peta.get(kunci)?.mataKuliah || mataKuliah;
      const rubrikId = angkaParam(String(body.rubrikId ?? ""));
      try {
        const hasil = await pasangRubrikMatkul(ejaan, rubrikId, profile.fullName);
        if (!hasil.ok) return Response.json({ success: false, message: hasil.pesan }, { status: 400 });
      } catch (galat) {
        console.error("pasang rubrik mata uji", galat);
        return Response.json(
          {
            success: false,
            message:
              "Rubrik mata uji belum dapat disimpan. Pastikan supabase-update-v49-rubrik-matkul.sql " +
              "sudah dijalankan di Supabase.",
          },
          { status: 500 },
        );
      }

      const jumlah = peta.get(kunci)?.jumlahUjian ?? 0;
      return Response.json({
        success: true,
        pesan: rubrikId
          ? `Rubrik dipasang untuk ${ejaan}. Esai ${jumlah > 0 ? `${jumlah} ujian` : "seluruh ujian"} mata uji ini ` +
            "dinilai AI dengan rubrik ini, termasuk yang sudah dikumpulkan dan belum dinilai."
          : `Rubrik ${ejaan} dilepas. Esainya tidak dinilai AI sampai rubrik dipasang lagi.`,
      });
    }

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

    // Rubrik yang masih dipakai mata uji TIDAK dihapus, dan penolakannya
    // menyebut berapa. Menghapusnya akan membuat lembar penilaian ujian-ujian
    // itu kehilangan nama kriterianya berbulan-bulan kemudian, tepat ketika
    // ada yang menggugat nilainya dan bertanya "dinilai pakai rubrik yang mana".
    let jumlah = 0;
    try {
      const [baris] = await db
        .select({ jumlah: sql<number>`count(*)::int` })
        .from(cbtCourseRubrics)
        .where(eq(cbtCourseRubrics.rubricId, id));
      jumlah = baris?.jumlah ?? 0;
    } catch {
      // Tabelnya belum ada (SQL v49 belum dijalankan): belum ada mata uji
      // yang dapat memakainya.
    }
    if (jumlah > 0) {
      return Response.json(
        {
          success: false,
          message:
            `Rubrik ini masih dipakai ${jumlah} mata uji. Ganti dulu rubrik mata ujinya, ` +
            "atau biarkan saja, rubrik yang tidak dipakai tidak mengganggu apa pun.",
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
