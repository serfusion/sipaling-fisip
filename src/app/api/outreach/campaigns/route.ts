// Daftar kampanye, pemeriksaan daftar penerima, dan pembuatan kampanye.
//
// Dua mode pada POST, dan keduanya memakai jalur pembacaan yang SAMA PERSIS:
//
//   mode "periksa" — mengembalikan hitungan valid/duplikat/rusak/tercekal
//   mode "buat"    — menyimpannya menjadi kampanye
//
// Sengaja satu jalur. Kalau layar memeriksa dengan aturan A lalu server
// menyimpan dengan aturan B, angka yang dilihat orangnya sebelum menekan
// "buat" bukan angka yang benar-benar terkirim — dan selisihnya baru
// ketahuan sesudah suratnya keluar.

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { outreachTemplates } from "@/db/schema";
import {
  BATAS,
  periksaNada,
  perkiraanHari,
  jatahHariIni,
  saringPenerima,
  uraiCsv,
  uraiTempelan,
  type Penerima,
} from "@/lib/outreach";
import { rangkaEmail } from "@/lib/outreach-template";
import { periksaKesiapan } from "@/lib/outreach-kirim";
import { gerbangOus } from "@/lib/outreach-gerbang";
import { buatKampanye, catatAudit, cekalUntuk, daftarKampanye } from "@/lib/outreach-store";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Batas ukuran tempelan/CSV. Lima juta huruf sudah jauh di atas 5.000 alamat. */
const MAKS_TEKS = 5_000_000;

export async function GET() {
  const gerbang = await gerbangOus("lihat");
  if (!gerbang.ok) return gerbang.jawab;
  const { profil } = gerbang.ctx;

  try {
    const kampanye = await daftarKampanye({ id: profil.id, peran: profil.role });
    return Response.json({ success: true, campaigns: kampanye });
  } catch (galat: unknown) {
    console.error("daftar kampanye outreach", galat);
    return Response.json(
      { success: false, message: explainServerError(galat, "Daftar kampanye belum dapat dimuat.") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const gerbang = await gerbangOus("pakai");
  if (!gerbang.ok) return gerbang.jawab;
  const { pelaku, state, profil } = gerbang.ctx;

  const batas = rateLimit({ request, name: "outreach-kampanye", limit: 20, windowMs: 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const badan = (await request.json()) as {
      mode?: string;
      nama?: string;
      templateId?: number | null;
      tempelan?: string;
      csv?: string;
      simulasi?: boolean;
    };

    const tempelan = String(badan.tempelan || "").slice(0, MAKS_TEKS);
    const csv = String(badan.csv || "").slice(0, MAKS_TEKS);

    // --- baca daftar penerima -------------------------------------------
    const mentah: Penerima[] = [];
    const rusak: string[] = [];
    if (tempelan.trim()) {
      const hasil = uraiTempelan(tempelan);
      mentah.push(...hasil.penerima);
      rusak.push(...hasil.tidakSah);
    }
    if (csv.trim()) {
      const hasil = uraiCsv(csv);
      mentah.push(...hasil.penerima);
      rusak.push(...hasil.tidakSah);
    }

    const cekal = await cekalUntuk(mentah.map((item) => item.email));
    const ringkas = saringPenerima(mentah, rusak, cekal.keys());

    const jatah = jatahHariIni(state, new Date());
    const laporan = {
      total: ringkas.total,
      valid: ringkas.valid.length,
      duplikat: ringkas.duplikat.length,
      tidakSah: ringkas.tidakSah.length,
      tercekal: ringkas.tercekal.length,
      contohRusak: ringkas.tidakSah.slice(0, 10),
      contohTercekal: ringkas.tercekal.slice(0, 10),
      jatahHarian: jatah,
      perkiraanHari: perkiraanHari(ringkas.valid.length, jatah),
      batasPenerima: BATAS.penerimaPerKampanye,
    };

    if (badan.mode === "periksa") {
      return Response.json({ success: true, laporan });
    }

    // --- dari sini ke bawah: benar-benar membuat kampanye ----------------
    const nama = String(badan.nama || "").trim();
    if (!nama) {
      return Response.json({ success: false, message: "Nama kampanye wajib diisi." }, { status: 400 });
    }
    if (ringkas.valid.length === 0) {
      return Response.json(
        { success: false, message: "Tidak ada satu pun alamat yang dapat dikirimi.", laporan },
        { status: 400 },
      );
    }
    if (ringkas.valid.length > BATAS.penerimaPerKampanye) {
      return Response.json(
        {
          success: false,
          message: `Satu kampanye dibatasi ${BATAS.penerimaPerKampanye} penerima. Pecah daftarnya menjadi beberapa kampanye.`,
          laporan,
        },
        { status: 400 },
      );
    }

    const templateId = Number(badan.templateId);
    if (!Number.isInteger(templateId) || templateId < 1) {
      return Response.json({ success: false, message: "Pilih naskah surat lebih dahulu." }, { status: 400 });
    }
    const naskah = (
      await db.select().from(outreachTemplates).where(eq(outreachTemplates.id, templateId)).limit(1)
    )[0];
    if (!naskah) {
      return Response.json({ success: false, message: "Naskah surat tidak ditemukan." }, { status: 404 });
    }

    if (!state.fromEmail) {
      return Response.json(
        {
          success: false,
          message: "Alamat pengirim belum diisi. Minta Super Admin melengkapinya di pengaturan OUS.",
        },
        { status: 400 },
      );
    }

    const nada = periksaNada(naskah.subject, rangkaEmail(naskah.bodyHtml, naskah.subject), naskah.bodyText || "");
    if (nada.tertahan) {
      const maut = nada.temuan.find((item) => item.tingkat === "berat");
      return Response.json(
        { success: false, message: `Naskah belum layak dikirim. ${maut?.pesan ?? ""}`, nada },
        { status: 400 },
      );
    }

    // Simulasi hanya boleh dimatikan bila pengaturannya memang sudah keluar
    // dari mode simulasi DAN tidak ada penghalang. Permintaan dari layar
    // tidak pernah dapat menaikkan wewenangnya sendiri.
    const siap = periksaKesiapan(state);
    const simulasi = state.simulasi || !siap.siap || badan.simulasi !== false;

    const kampanye = await buatKampanye({
      nama,
      templateId: naskah.id,
      subjek: naskah.subject,
      bodyHtml: naskah.bodyHtml,
      bodyText: naskah.bodyText || "",
      fromName: state.fromName,
      fromEmail: state.fromEmail,
      replyTo: state.replyTo || null,
      simulasi,
      penerima: ringkas.valid,
      pemilik: { id: profil.id, nama: profil.fullName, peran: profil.role },
    });

    await catatAudit({
      pelaku,
      tindakan: "kampanye.buat",
      jenis: "kampanye",
      nomor: kampanye.id,
      keterangan: { nama, penerima: ringkas.valid.length, simulasi, naskah: naskah.name },
    });

    return Response.json({ success: true, campaign: kampanye, laporan, simulasi, nada });
  } catch (galat: unknown) {
    console.error("buat kampanye outreach", galat);
    return Response.json(
      { success: false, message: explainServerError(galat, "Kampanye belum dapat dibuat.") },
      { status: 500 },
    );
  }
}
