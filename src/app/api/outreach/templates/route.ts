// Naskah surat. Dibaca siapa pun yang boleh membuka panel; disunting hanya
// oleh yang boleh memakai OUS.

import { periksaNada } from "@/lib/outreach";
import { rangkaEmail } from "@/lib/outreach-template";
import { bersihkanHtmlServer } from "@/lib/sanitize-html";
import { gerbangOus } from "@/lib/outreach-gerbang";
import { catatAudit, daftarTemplate, simpanTemplate } from "@/lib/outreach-store";
import { explainServerError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const gerbang = await gerbangOus("lihat");
  if (!gerbang.ok) return gerbang.jawab;

  try {
    const naskah = await daftarTemplate();
    return Response.json({ success: true, templates: naskah });
  } catch (galat: unknown) {
    console.error("daftar template outreach", galat);
    return Response.json(
      { success: false, message: explainServerError(galat, "Daftar naskah belum dapat dimuat.") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const gerbang = await gerbangOus("pakai");
  if (!gerbang.ok) return gerbang.jawab;
  const { pelaku } = gerbang.ctx;

  try {
    const badan = (await request.json()) as {
      id?: number | null;
      nama?: string;
      keterangan?: string;
      subjek?: string;
      bodyHtml?: string;
      bodyText?: string;
      aktif?: boolean;
    };

    const nama = String(badan.nama || "").trim();
    const subjek = String(badan.subjek || "").trim();
    // Dibersihkan SEBELUM disimpan, bukan hanya sebelum ditampilkan. Naskah
    // ini nanti dikirim ke ratusan kotak masuk di luar kampus; <script> yang
    // lolos masuk basis data adalah hal yang tidak dapat ditarik kembali.
    const bodyHtml = bersihkanHtmlServer(String(badan.bodyHtml || "").trim(), 60_000);
    if (!nama || !subjek || !bodyHtml) {
      return Response.json(
        { success: false, message: "Nama, subjek, dan isi naskah wajib diisi." },
        { status: 400 },
      );
    }
    if (bodyHtml.length > 60_000) {
      return Response.json({ success: false, message: "Isi naskah terlalu panjang." }, { status: 400 });
    }

    // Naskah yang kehilangan tautan berhenti langganan DITOLAK di sini, bukan
    // hanya diberi peringatan di layar. Surat outreach tanpa jalan keluar
    // melanggar syarat setiap penyedia email sekaligus menjadi alasan paling
    // wajar bagi penerimanya untuk menekan "laporkan spam".
    const nada = periksaNada(subjek, rangkaEmail(bodyHtml, subjek), String(badan.bodyText || ""));
    const maut = nada.temuan.find((item) => item.tingkat === "berat");
    if (maut) {
      return Response.json(
        { success: false, message: `Naskah belum dapat disimpan. ${maut.pesan}`, nada },
        { status: 400 },
      );
    }

    const id = await simpanTemplate({
      id: badan.id ?? null,
      nama,
      keterangan: String(badan.keterangan || ""),
      subjek,
      bodyHtml,
      bodyText: String(badan.bodyText || ""),
      aktif: badan.aktif !== false,
      oleh: pelaku.nama,
    });

    await catatAudit({
      pelaku,
      tindakan: badan.id ? "naskah.ubah" : "naskah.buat",
      jenis: "naskah",
      nomor: id,
      keterangan: { nama },
    });

    return Response.json({ success: true, id, nada });
  } catch (galat: unknown) {
    console.error("simpan template outreach", galat);
    return Response.json(
      { success: false, message: explainServerError(galat, "Naskah belum tersimpan.") },
      { status: 500 },
    );
  }
}
