// ============================================================
// CBT — DAFTAR MAHASISWA
//
// GET  ?kode=XXXXXX&q=a   cari peserta dari layar ujian (TANPA LOGIN)
// GET  ?q=a               cari dari dashboard (dosen/admin, keterangan lengkap)
// GET  ?daftar=1          seluruh daftar untuk panel pengelolaan
// POST                    impor/perbarui daftar (admin)
// DELETE ?id=             hapus satu baris (admin)
//
// ------------------------------------------------------------
// SATU JALUR TERBUKA, DAN APA YANG MENJAGANYA
// ------------------------------------------------------------
// Pencarian dari layar ujian harus berjalan TANPA LOGIN — peserta CBT memang
// tidak punya akun, dan itu keputusan portal sejak awal. Artinya ada satu
// titik akhir yang dapat dipanggil siapa pun, dan yang dicarinya adalah nama
// beserta nomor induk orang. Tiga hal menjaganya, dan ketiganya ditegakkan di
// sini:
//
//   1. HARUS MENYEBUT KODE UJIAN YANG SEDANG BERLANGSUNG. Kodenya dibacakan
//      dosen di depan kelas, dan hanya berlaku selama jendela ujiannya
//      terbuka. Di luar jam itu, titik akhir ini tidak menjawab apa pun.
//   2. DISEMPITKAN KE KELAS UJIANNYA bila ujiannya menyebut kelas. Yang
//      terlihat hanya peserta kelas itu — dan itu justru membuat daftarnya
//      lebih berguna bagi yang mencari namanya sendiri.
//   3. EMAIL TIDAK PERNAH IKUT KELUAR lewat jalur ini. Alamat email adalah
//      satu-satunya medan yang dapat langsung dipakai menghubungi orangnya,
//      dan ia tidak punya urusan apa pun dengan mengisi lembar identitas.
//
// Hasilnya paling banyak delapan nama sekali minta, dan lajunya dibatasi.
// ============================================================
import { db } from "@/db";
import { students } from "@/db/schema";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getCurrentProfile } from "@/lib/supabase-server";
import { bolehCbt } from "@/lib/cbt";
import { ujianDariKode } from "@/lib/cbt-store";
import { bolehMasuk } from "@/lib/cbt";
import {
  MAKS_SARAN, MIN_KETIK, kunciAngka, kunciCari, lolosLike, peringkatSaran,
  rapikanEmail, rapikanNamaMhs, rapikanNimMhs, rapikanStatus, type Mahasiswa,
} from "@/lib/mahasiswa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hanya Admin dan Super Admin yang boleh mengubah daftar mahasiswa. */
const PENGELOLA = ["super_admin", "admin"];

/**
 * Berapa baris yang ditarik dari basis data sebelum diperingkat di memori.
 *
 * Lebih banyak daripada yang dikirim balik, karena peringkatnya dihitung di
 * sini: yang diketik "bud" harus menaruh Budi di atas Mahmudi, dan basis data
 * yang hanya diminta LIMIT 8 mungkin sudah membuang Budi sebelum sempat
 * diperingkat.
 */
const AMBIL_CALON = 60;

function keMahasiswa(row: typeof students.$inferSelect): Mahasiswa {
  return {
    id: row.id,
    nim: row.nim,
    nama: row.name,
    email: row.email || "",
    prodi: row.prodi || "",
    kelas: row.className || "",
    angkatan: row.angkatan || "",
    status: row.status,
  };
}

/**
 * Susun syarat pencocokan untuk satu ketikan.
 *
 * Ketikan berupa angka hanya dicocokkan ke nomor induk, dari DEPAN. Ketikan
 * berupa huruf dicocokkan ke nama, dari mana saja — karena orang mencari nama
 * belakangnya sama seringnya dengan nama depannya.
 */
function syaratCari(q: string) {
  const bersih = lolosLike(q);
  if (kunciAngka(q)) return ilike(students.nim, `${bersih}%`);
  const kunci = lolosLike(kunciCari(q));
  return or(ilike(students.nameKey, `%${kunci}%`), ilike(students.nim, `${bersih}%`));
}

export async function GET(request: Request) {
  const batas = rateLimit({ request, name: "cbt-mahasiswa", limit: 300, windowMs: 5 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const params = new URL(request.url).searchParams;
    const q = String(params.get("q") ?? "").trim().slice(0, 60);
    const kode = String(params.get("kode") ?? "").trim().toUpperCase().slice(0, 12);

    // ---------- JALUR TERBUKA: DARI LAYAR UJIAN ----------
    if (kode) {
      const ujian = await ujianDariKode(kode);
      if (!ujian) return Response.json({ success: true, mahasiswa: [] });

      // Di luar jam ujian, daftar ini tidak dapat dibuka sama sekali. Kode
      // ujian yang bocor sesudah ujiannya lewat karena itu tidak membuka apa
      // pun — dan kode memang bocor, karena ia dibacakan di depan kelas.
      const terbuka = bolehMasuk(
        { aktif: Boolean(ujian.activatedAt), mulai: ujian.startAt, selesai: ujian.endAt },
        new Date(),
      );
      if (!terbuka) return Response.json({ success: true, mahasiswa: [] });
      if (q.length < MIN_KETIK) return Response.json({ success: true, mahasiswa: [] });

      // Kelas ujiannya menyempitkan daftar bila memang disebut. Dua keuntungan
      // sekaligus, dan yang kedua yang lebih sering terasa: yang terbuka ke
      // luar hanya satu kelas, dan yang mencari namanya melihat daftar yang
      // jauh lebih pendek.
      const kelas = (ujian.className || "").trim();
      const syarat = kelas
        ? and(syaratCari(q), eq(students.className, kelas))
        : syaratCari(q);

      let calon = await db.select().from(students).where(syarat).limit(AMBIL_CALON);
      // Kelas yang disebut ujian tidak selalu sama persis dengan kelas yang
      // tertulis di daftar mahasiswa — "3A" dan "III-A" adalah kelas yang sama
      // bagi manusia. Ketika penyempitannya tidak menemukan siapa pun,
      // pencariannya diulang tanpa kelas, supaya ejaan yang berbeda tidak
      // membuat seluruh kelas tidak menemukan namanya sendiri.
      if (kelas && calon.length === 0) {
        calon = await db.select().from(students).where(syaratCari(q)).limit(AMBIL_CALON);
      }

      return Response.json({
        success: true,
        mahasiswa: peringkatSaran(calon.map(keMahasiswa), q, MAKS_SARAN).map((m) => ({
          // Email sengaja TIDAK ikut. Lihat catatan di kepala berkas.
          nim: m.nim,
          nama: m.nama,
          kelas: m.kelas,
          prodi: m.prodi,
        })),
      });
    }

    // ---------- JALUR DASHBOARD: PERLU AKUN ----------
    const profile = await getCurrentProfile();
    if (!bolehCbt(profile) || !profile) {
      return Response.json({ success: false, message: "Menu CBT tidak tersedia untuk role Anda." }, { status: 403 });
    }

    if (params.get("daftar")) {
      const halaman = Math.max(0, Number(params.get("hal") ?? 0) || 0);
      const baris = q
        ? await db.select().from(students).where(syaratCari(q)).orderBy(asc(students.name)).limit(200)
        : await db.select().from(students).orderBy(asc(students.name)).limit(200).offset(halaman * 200);
      const [{ jumlah }] = await db.select({ jumlah: sql<number>`count(*)::int` }).from(students);
      return Response.json({
        success: true,
        mahasiswa: baris.map(keMahasiswa),
        jumlah,
        halaman,
        bolehKelola: PENGELOLA.includes(profile.role),
      });
    }

    if (q.length < MIN_KETIK) return Response.json({ success: true, mahasiswa: [] });
    const calon = await db.select().from(students).where(syaratCari(q)).limit(AMBIL_CALON);
    return Response.json({
      success: true,
      mahasiswa: peringkatSaran(calon.map(keMahasiswa), q, MAKS_SARAN),
    });
  } catch (error: unknown) {
    console.error("cari mahasiswa", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Daftar mahasiswa belum dapat dibaca.") },
      { status: 500 },
    );
  }
}

type BarisMasuk = {
  nim?: unknown; nama?: unknown; email?: unknown;
  prodi?: unknown; kelas?: unknown; angkatan?: unknown; status?: unknown;
};

/**
 * Impor atau perbarui daftar mahasiswa.
 *
 * Nomor induk yang SUDAH ADA diperbarui, tidak ditolak dan tidak digandakan.
 * Itu bentuk yang benar untuk pekerjaan yang sebenarnya dilakukan: bagian
 * akademik mengirim berkas yang sama tiap semester dengan beberapa baris yang
 * berubah, dan yang diinginkan adalah daftarnya menjadi benar — bukan laporan
 * berisi empat ratus penolakan "sudah ada".
 */
export async function POST(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !PENGELOLA.includes(profile.role)) {
      return Response.json(
        { success: false, message: "Hanya Admin dan Super Admin yang boleh mengubah daftar mahasiswa." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as { baris?: unknown };
    const mentah = Array.isArray(body.baris) ? body.baris : [];
    if (mentah.length === 0) {
      return Response.json({ success: false, message: "Tidak ada baris yang dikirim." }, { status: 400 });
    }
    if (mentah.length > 5000) {
      return Response.json(
        { success: false, message: "Sekali impor paling banyak 5.000 baris. Bagi berkasnya." },
        { status: 400 },
      );
    }

    const sekarang = new Date();
    const siap = mentah
      .map((b) => {
        const baris = b as BarisMasuk;
        const nim = rapikanNimMhs(baris.nim);
        const nama = rapikanNamaMhs(baris.nama);
        if (!nim || nama.length < 3) return null;
        return {
          nim,
          name: nama,
          nameKey: kunciCari(nama),
          email: rapikanEmail(baris.email) || null,
          prodi: String(baris.prodi ?? "").trim().slice(0, 120) || null,
          className: String(baris.kelas ?? "").trim().slice(0, 80) || null,
          angkatan: String(baris.angkatan ?? "").replace(/\D/g, "").slice(0, 10) || null,
          status: rapikanStatus(baris.status),
          updatedAt: sekarang,
        };
      })
      .filter(Boolean) as Array<typeof students.$inferInsert>;

    if (siap.length === 0) {
      return Response.json(
        { success: false, message: "Tidak ada baris yang dapat dipakai. Periksa kolom NIM dan Nama." },
        { status: 400 },
      );
    }

    // Ditulis per potongan seratus baris. Satu perintah berisi lima ribu baris
    // melampaui batas parameter driver, dan gagalnya terjadi sesudah pengguna
    // menunggu — bukan sebelum.
    let tersimpan = 0;
    for (let i = 0; i < siap.length; i += 100) {
      const potongan = siap.slice(i, i + 100);
      await db
        .insert(students)
        .values(potongan)
        .onConflictDoUpdate({
          target: students.nim,
          set: {
            name: sql`excluded.name`,
            nameKey: sql`excluded.name_key`,
            // Medan keterangan hanya ditimpa bila berkas barunya MENGISINYA.
            // Berkas yang hanya memuat NIM dan Nama karena itu tidak
            // menghapus email seluruh angkatan yang diimpor tahun lalu.
            email: sql`coalesce(excluded.email, ${students.email})`,
            prodi: sql`coalesce(excluded.prodi, ${students.prodi})`,
            className: sql`coalesce(excluded.class_name, ${students.className})`,
            angkatan: sql`coalesce(excluded.angkatan, ${students.angkatan})`,
            status: sql`excluded.status`,
            updatedAt: sekarang,
          },
        });
      tersimpan += potongan.length;
    }

    return Response.json({ success: true, tersimpan, ditolak: mentah.length - siap.length });
  } catch (error: unknown) {
    console.error("impor mahasiswa", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Daftar mahasiswa belum tersimpan.") },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !PENGELOLA.includes(profile.role)) {
      return Response.json(
        { success: false, message: "Hanya Admin dan Super Admin yang boleh menghapus data mahasiswa." },
        { status: 403 },
      );
    }
    const params = new URL(request.url).searchParams;
    const id = Number(params.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ success: false, message: "Baris tidak dikenali." }, { status: 400 });
    }
    await db.delete(students).where(eq(students.id, id));
    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("hapus mahasiswa", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Baris belum dapat dihapus.") },
      { status: 500 },
    );
  }
}
