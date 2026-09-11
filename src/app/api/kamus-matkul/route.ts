// ============================================================
// KAMUS MATA KULIAH TAMBAHAN — yang dipelajari dari koreksi admin
//
// Kamus bawaan di src/lib/kamus-matkul.ts menutup kurikulum yang berjalan
// sekarang. Kurikulum berubah, dan tanpa jalur ini setiap mata kuliah baru
// menuntut koreksi tangan yang SAMA pada tiap unggahan berikutnya — pekerjaan
// berulang yang justru ingin dihapus.
//
// Jadi: begitu admin memperbaiki satu nama Inggris lalu menyimpan datanya,
// pasangan kode → nama Inggris itu diingat. Unggahan berikutnya sudah terisi.
//
// KUNCINYA BERLINGKUP: "ilkom-bc::MKPB-051", bukan "MKPB-051" saja. Kode
// mata kuliah TIDAK unik antar prodi — MKPB-051 adalah "Produksi Feature TV"
// di Ilmu Komunikasi konsentrasi Broadcasting dan "PKL" di Ilmu Pemerintahan
// — sehingga kunci tanpa lingkup membuat koreksi yang benar untuk satu prodi
// mencetak nama yang salah pada transkrip prodi yang lain.
//
// Kunci lama tanpa "::" TETAP dibaca. Entri seperti itu dibuat sebelum kamus
// dipecah dan tidak diketahui lagi dari prodi mana asalnya, jadi pembacanya
// (src/lib/kamus-matkul.ts) memakainya hanya untuk kode yang kamus bawaan
// memang tidak punya — bukan untuk menimpa nama yang tertulis pada transkrip
// resmi fakultas.
// ============================================================
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { SEMUA_LINGKUP, kunciKamus, rapikanKode } from "@/lib/kamus-matkul";

export const dynamic = "force-dynamic";

const KEY = "kamus_matkul";
const EDIT_ROLES = ["super_admin", "admin", "admin_akademik"];
/** Batas jumlah pasangan. Satu kurikulum jauh di bawah angka ini. */
const MAKS_PASANGAN = 2_000;
const MAKS_PANJANG = 160;

type Kamus = Record<string, string>;

async function bacaKamus(): Promise<Kamus> {
  try {
    const baris = await db.select().from(appSettings).where(eq(appSettings.key, KEY)).limit(1);
    if (!baris.length) return {};
    const isi = JSON.parse(baris[0].value) as Kamus;
    return isi && typeof isi === "object" ? isi : {};
  } catch {
    // Kamus tambahan bersifat pelengkap: yang bawaan tetap bekerja tanpanya.
    return {};
  }
}

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return Response.json({ success: false, message: "Silakan login." }, { status: 401 });
    const kamus = await bacaKamus();
    return Response.json({ success: true, kamus, jumlah: Object.keys(kamus).length });
  } catch (error: unknown) {
    console.error("baca kamus matkul", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Kamus belum dapat dimuat.") },
      { status: 500 },
    );
  }
}

/**
 * Tambahkan pasangan baru. TIDAK menghapus yang lama.
 *
 * Menimpa yang lama memang disengaja: koreksi terakhir dari manusia selalu
 * lebih benar daripada yang tersimpan sebelumnya.
 */
export async function PUT(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !EDIT_ROLES.includes(profile.role)) {
      return Response.json({ success: false, message: "Role Anda tidak dapat mengubah kamus." }, { status: 403 });
    }

    const body = (await request.json()) as {
      pasangan?: Array<{ kode?: string; en?: string; lingkup?: string }>;
    };
    const masuk = Array.isArray(body.pasangan) ? body.pasangan : [];
    if (!masuk.length) return Response.json({ success: true, jumlah: 0, baru: 0 });

    const kamus = await bacaKamus();
    let baru = 0;
    for (const p of masuk.slice(0, MAKS_PASANGAN)) {
      const kode = rapikanKode(String(p.kode ?? ""));
      const lingkup = String(p.lingkup ?? "");
      const en = String(p.en ?? "").replace(/\s+/g, " ").trim().slice(0, MAKS_PANJANG);
      // Kode tanpa bentuk yang jelas tidak disimpan: kamus yang berisi sampah
      // akan mengisi transkrip orang lain dengan sampah yang sama.
      if (!/^[A-Z]{2,6}-?[A-Z0-9]{1,8}$/.test(kode) || en.length < 3) continue;
      // Lingkup yang tidak dikenali DITOLAK, bukan disimpan tanpa lingkup:
      // menyimpannya datar mengembalikan persis bug yang memisahkan kamus
      // ini — koreksi satu prodi menimpa transkrip prodi lain.
      if (!(SEMUA_LINGKUP as readonly string[]).includes(lingkup)) continue;
      const kunci = kunciKamus(lingkup, kode);
      if (kamus[kunci] === en) continue;
      kamus[kunci] = en;
      baru += 1;
    }

    const semua = Object.keys(kamus);
    if (semua.length > MAKS_PASANGAN) {
      return Response.json(
        { success: false, message: `Kamus sudah memuat ${semua.length} entri, melebihi batas ${MAKS_PASANGAN}.` },
        { status: 400 },
      );
    }

    const value = JSON.stringify(kamus);
    await db
      .insert(appSettings)
      .values({ key: KEY, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });

    return Response.json({ success: true, jumlah: semua.length, baru });
  } catch (error: unknown) {
    console.error("simpan kamus matkul", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Kamus belum tersimpan.") },
      { status: 500 },
    );
  }
}
