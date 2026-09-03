// ============================================================
// ARSIP TRANSKRIP NILAI — penyimpanan transkrip yang sudah selesai
//
// Berbeda dari /api/transkrip-data yang hanya satu laci draf (menyimpan
// transkrip berikutnya menimpa yang sebelumnya), di sini tiap mahasiswa
// mendapat barisnya sendiri. Itulah yang membuat daftar "siapa saja yang
// transkripnya sudah dibuat" ada isinya.
//
// Menyimpan hanya terjadi ketika tombolnya ditekan. Tidak ada penyimpanan
// otomatis di jalur mana pun: transkrip yang belum selesai tidak pernah
// menyelinap masuk ke arsip.
// ============================================================
import { db } from "@/db";
import { transcriptArchives } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentProfile, type Role } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import {
  bersihkanBaris, bersihkanMeta, bersihkanTataLetak, periksaSiapArsip, ringkasTranskrip,
} from "@/lib/arsip-transkrip";

export const dynamic = "force-dynamic";

// Transkrip nilai adalah pekerjaan Admin Akademik; Admin dan Super Admin ikut
// melihatnya karena keduanya menutupi seluruh unit.
const ARSIP_ROLES: Role[] = ["super_admin", "admin", "admin_akademik"];
/**
 * Batas satu baris arsip. Transkrip 60 mata kuliah jauh di bawah ini; ruang
 * selebihnya untuk tata letak hasil suntingan tangan, yang tersimpan sebagai
 * HTML di dalam JSON `meta` (lihat POST di bawah).
 */
const MAKS_HURUF = 800_000;

/**
 * Kunci tata letak di dalam JSON `meta`.
 *
 * Tata letak menumpang pada kolom yang sudah ada, BUKAN kolom baru: kolom
 * baru berarti setiap pemasangan lama harus menjalankan SQL lebih dulu, dan
 * sampai itu dilakukan tombol simpan arsip akan gagal seluruhnya. Menumpang
 * pada JSON membuat perbaikan ini langsung bekerja begitu situsnya terbit.
 */
const KUNCI_TATA_LETAK = "tataLetak";

function boleh(role: Role) {
  return ARSIP_ROLES.includes(role);
}

/** Kolom ringkas untuk daftar — sengaja tanpa `meta`/`rows` yang panjang. */
const KOLOM_DAFTAR = {
  id: transcriptArchives.id,
  nim: transcriptArchives.nim,
  studentName: transcriptArchives.studentName,
  studyProgram: transcriptArchives.studyProgram,
  concentration: transcriptArchives.concentration,
  lang: transcriptArchives.lang,
  courseCount: transcriptArchives.courseCount,
  totalSks: transcriptArchives.totalSks,
  totalMutu: transcriptArchives.totalMutu,
  ipk: transcriptArchives.ipk,
  predikat: transcriptArchives.predikat,
  yudisium: transcriptArchives.yudisium,
  thesisTitle: transcriptArchives.thesisTitle,
  savedBy: transcriptArchives.savedBy,
  createdAt: transcriptArchives.createdAt,
  updatedAt: transcriptArchives.updatedAt,
};

/**
 * GET tanpa `id` -> daftar ringkas (untuk panel arsip).
 * GET dengan `id` -> satu transkrip UTUH, siap dimuat kembali ke editor.
 */
export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !boleh(profile.role)) {
      return Response.json({ success: false, message: "Silakan login sebagai Admin Akademik." }, { status: 401 });
    }

    const id = Number(new URL(request.url).searchParams.get("id") || 0);
    if (id > 0) {
      const baris = await db.select().from(transcriptArchives).where(eq(transcriptArchives.id, id)).limit(1);
      if (!baris.length) {
        return Response.json({ success: false, message: "Transkrip itu sudah tidak ada di arsip." }, { status: 404 });
      }
      const satu = baris[0];
      let tersimpan: Record<string, string> = {};
      let rows: unknown[] = [];
      try {
        tersimpan = JSON.parse(satu.meta) as Record<string, string>;
        rows = JSON.parse(satu.rows) as unknown[];
      } catch {
        return Response.json({ success: false, message: "Isi arsip ini tidak terbaca." }, { status: 500 });
      }
      // Tata letak dipisahkan lagi dari biodata: yang masuk ke isian Biodata
      // di layar hanya biodata, tidak ikut kemasukan HTML.
      const { [KUNCI_TATA_LETAK]: tataLetak = "", ...meta } = tersimpan;
      return Response.json({
        success: true,
        arsip: { ...satu, meta, tataLetak, rows: bersihkanBaris(rows) },
      });
    }

    const daftar = await db
      .select(KOLOM_DAFTAR)
      .from(transcriptArchives)
      .orderBy(desc(transcriptArchives.updatedAt))
      .limit(500);
    return Response.json({ success: true, daftar });
  } catch (error: unknown) {
    console.error("daftar arsip transkrip", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Arsip transkrip belum dapat dimuat.") },
      { status: 500 },
    );
  }
}

/**
 * Simpan satu transkrip ke arsip.
 *
 * NIM yang sudah ada TIDAK melahirkan baris kembar: barisnya diperbarui, dan
 * jawabannya menyebutkan bahwa yang terjadi adalah pembaruan — supaya admin
 * tahu transkrip lama mahasiswa itu tergantikan, bukan bertambah.
 */
export async function POST(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !boleh(profile.role)) {
      return Response.json({ success: false, message: "Role Anda tidak dapat menyimpan ke Arsip Transkrip Nilai." }, { status: 403 });
    }

    const body = (await request.json()) as { meta?: unknown; rows?: unknown; lang?: unknown; tataLetak?: unknown };
    const meta = bersihkanMeta(body.meta);
    const rows = bersihkanBaris(body.rows);
    // Hanya tata letak yang lewat pembersih HTML yang boleh tersimpan; kunci
    // dengan nama sama yang menyelinap lewat `meta` dibuang lebih dulu.
    delete meta[KUNCI_TATA_LETAK];
    const tataLetak = bersihkanTataLetak(body.tataLetak);

    // Syarat yang sama persis dengan yang dipakai tombolnya di layar. Kalau
    // sesuatu tetap lolos sampai sini (mis. dua tab terbuka), alasannya yang
    // sama pula yang dikembalikan.
    const siap = periksaSiapArsip(meta, rows);
    if (!siap.siap) return Response.json({ success: false, message: siap.alasan }, { status: 400 });

    const ringkas = ringkasTranskrip(meta, rows);
    const isiMeta = JSON.stringify(tataLetak ? { ...meta, [KUNCI_TATA_LETAK]: tataLetak } : meta);
    const isiRows = JSON.stringify(rows);
    if (isiMeta.length + isiRows.length > MAKS_HURUF) {
      return Response.json({
        success: false,
        message: "Transkrip ini terlalu besar untuk diarsipkan. Biasanya karena gambar yang ditempel pada tata letak — perkecil atau hapus gambarnya, lalu simpan lagi.",
      }, { status: 400 });
    }

    const lang = body.lang === "en" ? "en" : "id";
    const sekarang = new Date();
    const nilai = {
      nim: ringkas.nim,
      studentName: ringkas.nama,
      studyProgram: ringkas.prodi || null,
      concentration: ringkas.konsentrasi || null,
      lang,
      courseCount: ringkas.jumlahMk,
      totalSks: ringkas.sks,
      totalMutu: ringkas.mutu,
      ipk: ringkas.ipk.toFixed(2),
      predikat: ringkas.predikat,
      yudisium: ringkas.yudisium || null,
      thesisTitle: ringkas.judul || null,
      meta: isiMeta,
      rows: isiRows,
      savedBy: profile.fullName,
      updatedAt: sekarang,
    };

    const sudahAda = await db
      .select({ id: transcriptArchives.id })
      .from(transcriptArchives)
      .where(eq(transcriptArchives.nim, ringkas.nim))
      .limit(1);

    const [tersimpan] = await db
      .insert(transcriptArchives)
      .values({ ...nilai, createdAt: sekarang })
      .onConflictDoUpdate({ target: transcriptArchives.nim, set: nilai })
      .returning(KOLOM_DAFTAR);

    return Response.json({
      success: true,
      diperbarui: sudahAda.length > 0,
      arsip: tersimpan,
    });
  } catch (error: unknown) {
    console.error("simpan arsip transkrip", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Transkrip belum tersimpan ke arsip.") },
      { status: 500 },
    );
  }
}

/** Hapus satu baris arsip. Dipakai kalau transkrip tersimpan atas NIM keliru. */
export async function DELETE(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !boleh(profile.role)) {
      return Response.json({ success: false, message: "Role Anda tidak dapat menghapus arsip transkrip." }, { status: 403 });
    }
    const id = Number(new URL(request.url).searchParams.get("id") || 0);
    if (!id) return Response.json({ success: false, message: "Arsip yang mana yang hendak dihapus?" }, { status: 400 });

    const [terhapus] = await db
      .delete(transcriptArchives)
      .where(eq(transcriptArchives.id, id))
      .returning({ id: transcriptArchives.id, nim: transcriptArchives.nim, studentName: transcriptArchives.studentName });
    if (!terhapus) return Response.json({ success: false, message: "Arsip itu sudah tidak ada." }, { status: 404 });

    return Response.json({ success: true, terhapus });
  } catch (error: unknown) {
    console.error("hapus arsip transkrip", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Arsip belum dapat dihapus.") },
      { status: 500 },
    );
  }
}
