// ============================================================
// CBT - KUNCI JAWABAN ACUAN DOSEN
//
// GET             daftar acuan milik portal
// POST            buat acuan baru
// PATCH           sunting acuan
// DELETE ?id=     hapus acuan
//
// ------------------------------------------------------------
// SIAPA YANG BOLEH MENYUNTING APA
// ------------------------------------------------------------
// Aturannya sama persis dengan rubrik di ../rubrik/route.ts, dan kesamaan itu
// disengaja: dua pustaka yang berdampingan di satu menu tetapi hak suntingnya
// berbeda adalah dua pustaka yang salah satunya akan dipakai keliru.
//
// Acuan dipakai bersama-sama. Dosen A menulis acuan untuk mata kuliah yang
// diampunya, dosen B memakainya pada kelas paralel. Itu memang yang
// dikehendaki, karena menulis jawaban acuan yang baik memakan waktu berjam-jam
// dan menyuruh tiap dosen menulisnya sendiri berarti hampir tidak ada yang
// memakainya.
//
// Yang MENYUNTING tetap pemiliknya saja, ditambah Admin dan Super Admin.
// Alasannya lebih keras di sini daripada di rubrik: mengubah satu jawaban
// acuan mengubah nilai yang sudah keluar bagi SELURUH kelas sekaligus, bukan
// mengubah satu deskriptor yang masih harus dibaca dosen.
// ============================================================
import { db } from "@/db";
import { cbtAnswerKeys, cbtExams } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { angkaParam, bolehCbt } from "@/lib/cbt";
import {
  AMBANG_NOL_BAWAAN, AMBANG_PENUH_BAWAAN, MAKS_BUTIR,
  bacaButir, bersihkanButir, periksaAcuan, type Acuan, type ButirAcuan,
} from "@/lib/nilai-acuan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENGELOLA = ["super_admin", "admin"];

function bolehSunting(profile: { id: string; role: string }, acuan: { ownerId: string | null }) {
  if (PENGELOLA.includes(profile.role)) return true;
  return Boolean(acuan.ownerId) && acuan.ownerId === profile.id;
}

/**
 * Bersihkan butir yang datang dari layar.
 *
 * Yang masuk dari peramban tidak pernah dipercaya bentuknya, termasuk ketika
 * peramban itu milik dosen sendiri. bersihkanButir dipakai kembali apa adanya
 * dari src/lib/nilai-acuan.ts, sehingga yang datang dari basis data dan yang
 * datang dari layar melewati jepitan yang SAMA. Dua jepitan terpisah berarti
 * dua tempat yang dapat berbeda diam-diam, dan yang berbeda diam-diam di sini
 * adalah panjang acuan yang dibandingkan dengan tiap lembar di kelas.
 */
function bersihkanButirMasuk(masukan: unknown): ButirAcuan[] {
  const daftar = Array.isArray(masukan) ? masukan : [];
  return daftar.slice(0, MAKS_BUTIR).map(bersihkanButir).filter((b) => b.jawaban !== "");
}

function bentukAcuan(body: Record<string, unknown>): Acuan {
  return {
    nama: String(body.nama ?? "").trim().slice(0, 160),
    keterangan: String(body.keterangan ?? "").trim().slice(0, 1000),
    ambangNol: Math.max(0, Math.min(99, Math.round(Number(body.ambangNol) || AMBANG_NOL_BAWAAN))),
    ambangPenuh: Math.max(1, Math.min(100, Math.round(Number(body.ambangPenuh) || AMBANG_PENUH_BAWAAN))),
    butir: bersihkanButirMasuk(body.butir),
  };
}

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) {
      return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
    }

    const baris = await db.select().from(cbtAnswerKeys).orderBy(desc(cbtAnswerKeys.updatedAt)).limit(200);

    // Berapa ujian yang memakai tiap acuan. Dihitung sekali untuk seluruh
    // daftar, bukan satu pertanyaan per acuan, dan yang membacanya adalah
    // tombol hapus: ia harus dapat berkata "dipakai 3 ujian" SEBELUM ditekan.
    const pakai = await db
      .select({ keyId: cbtExams.answerKeyId, jumlah: sql<number>`count(*)::int` })
      .from(cbtExams)
      .where(sql`${cbtExams.answerKeyId} is not null`)
      .groupBy(cbtExams.answerKeyId);
    const petaPakai = new Map(pakai.map((p) => [p.keyId, p.jumlah]));

    return Response.json({
      success: true,
      acuan: baris.map((a) => ({
        id: a.id,
        nama: a.name,
        keterangan: a.description || "",
        ambangNol: a.zeroThreshold,
        ambangPenuh: a.fullThreshold,
        butir: bacaButir(a.items),
        pemilik: a.createdBy,
        milikSaya: a.ownerId === profile.id,
        bolehSunting: bolehSunting(profile, a),
        dipakai: petaPakai.get(a.id) ?? 0,
        diubah: a.updatedAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    console.error("daftar acuan", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Daftar jawaban acuan belum dapat dimuat.") },
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
    const acuan = bentukAcuan(body);
    const periksa = periksaAcuan(acuan);
    if (!periksa.ok) return Response.json({ success: false, message: periksa.pesan }, { status: 400 });

    const dibuat = await db
      .insert(cbtAnswerKeys)
      .values({
        name: acuan.nama,
        description: acuan.keterangan || null,
        zeroThreshold: acuan.ambangNol,
        fullThreshold: acuan.ambangPenuh,
        items: JSON.stringify(acuan.butir),
        ownerId: profile.id,
        createdBy: profile.fullName,
      })
      .returning({ id: cbtAnswerKeys.id });

    return Response.json({ success: true, id: dibuat[0].id }, { status: 201 });
  } catch (error: unknown) {
    console.error("buat acuan", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Jawaban acuan belum tersimpan.") },
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
    if (id === null) return Response.json({ success: false, message: "Acuan tidak dikenali." }, { status: 400 });

    const ada = await db.select().from(cbtAnswerKeys).where(eq(cbtAnswerKeys.id, id)).limit(1);
    const lama = ada[0];
    if (!lama) return Response.json({ success: false, message: "Acuan tidak ditemukan." }, { status: 404 });
    if (!bolehSunting(profile, lama)) {
      return Response.json(
        { success: false, message: "Acuan ini milik pengajar lain. Salin dulu bila ingin mengubahnya." },
        { status: 403 },
      );
    }

    const acuan = bentukAcuan(body);
    const periksa = periksaAcuan(acuan);
    if (!periksa.ok) return Response.json({ success: false, message: periksa.pesan }, { status: 400 });

    // Acuan yang sudah dipakai ujian tetap boleh disunting, dan itu disengaja:
    // salah ketik pada jawaban acuan harus dapat dibetulkan. Yang perlu
    // diketahui penyuntingnya adalah bahwa nilai yang sudah keluar dihitung
    // dengan acuan versi lama, dan penghitungan ulang hanya terjadi bila
    // penilaian dijalankan lagi. Jalur penilaian selalu menyimpan kemiripan
    // yang dipakainya, sehingga dosen dapat melihat bahwa keduanya berbeda.
    const dipakai = await db
      .select({ jumlah: sql<number>`count(*)::int` })
      .from(cbtExams)
      .where(eq(cbtExams.answerKeyId, id));

    await db
      .update(cbtAnswerKeys)
      .set({
        name: acuan.nama,
        description: acuan.keterangan || null,
        zeroThreshold: acuan.ambangNol,
        fullThreshold: acuan.ambangPenuh,
        items: JSON.stringify(acuan.butir),
        updatedAt: new Date(),
      })
      .where(eq(cbtAnswerKeys.id, id));

    return Response.json({ success: true, dipakai: dipakai[0]?.jumlah ?? 0 });
  } catch (error: unknown) {
    console.error("sunting acuan", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Jawaban acuan belum tersimpan.") },
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
    if (id === null) return Response.json({ success: false, message: "Acuan tidak dikenali." }, { status: 400 });

    const ada = await db.select().from(cbtAnswerKeys).where(eq(cbtAnswerKeys.id, id)).limit(1);
    const acuan = ada[0];
    if (!acuan) return Response.json({ success: true });
    if (!bolehSunting(profile, acuan)) {
      return Response.json({ success: false, message: "Acuan ini milik pengajar lain." }, { status: 403 });
    }

    // Acuan yang masih dipakai ujian TIDAK dihapus, dan penolakannya menyebut
    // berapa ujian. Menghapusnya membuat lembar penilaian ujian-ujian itu
    // kehilangan dasar angkanya berbulan-bulan kemudian, tepat ketika ada yang
    // menggugat nilainya dan bertanya "dibandingkan dengan jawaban yang mana".
    const [{ jumlah }] = await db
      .select({ jumlah: sql<number>`count(*)::int` })
      .from(cbtExams)
      .where(eq(cbtExams.answerKeyId, id));
    if (jumlah > 0) {
      return Response.json(
        {
          success: false,
          message:
            `Acuan ini masih dipakai ${jumlah} ujian. Lepaskan dulu dari ujiannya, ` +
            "atau biarkan saja. Acuan yang tidak dipakai tidak mengganggu apa pun.",
        },
        { status: 409 },
      );
    }

    await db.delete(cbtAnswerKeys).where(eq(cbtAnswerKeys.id, id));
    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("hapus acuan", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Jawaban acuan belum dapat dihapus.") },
      { status: 500 },
    );
  }
}
