// ============================================================
// WEBHOOK PENYEDIA EMAIL
//
// Satu-satunya jalan bagi sistem ini untuk mengetahui apa yang TERJADI pada
// surat sesudah ia keluar. Tanpa webhook, statusnya berhenti di "terkirim"
// selamanya: pantulan tidak tercatat, keluhan tidak tercatat, dan alamat mati
// tetap dikirimi berbulan-bulan — yang persis merupakan cara tercepat
// menghancurkan reputasi sebuah domain.
//
// Yang mengetuk di sini BUKAN peramban dan BUKAN pemilik akun. Karena itu:
//
//   * jalur ini terdaftar pada TANPA_ORIGIN di middleware
//   * wewenangnya datang dari TANDA TANGAN, bukan dari cookie
//   * badan permintaannya dibaca MENTAH lebih dulu, sebab tanda tangannya
//     dihitung atas huruf-hurufnya persis seperti yang dikirim — JSON yang
//     sudah diurai lalu disusun ulang menghasilkan tanda tangan yang berbeda
//   * muatannya tidak pernah dipercaya begitu saja: yang dipakai hanya nomor
//     pesan, dan nomor itu harus cocok dengan baris yang memang kita kirim
// ============================================================

import {
  cekalDariPeristiwa,
  statusDariPeristiwa,
} from "@/lib/outreach";
import { tandaTanganSah } from "@/lib/outreach-kirim";
import {
  catatPeristiwa,
  penerimaDariPesan,
  segarkanHitung,
  tambahCekal,
  ubahStatusPenerimaKampanye,
} from "@/lib/outreach-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Muatan = {
  type?: string;
  event?: string;
  data?: { email_id?: string; message_id?: string; to?: string[] | string };
  message_id?: string;
};

/** Nomor pesan dari bentuk muatan yang berbeda-beda antar penyedia. */
function nomorPesan(muatan: Muatan): string {
  return String(muatan.data?.email_id || muatan.data?.message_id || muatan.message_id || "");
}

export async function POST(request: Request) {
  const rahasia = process.env.OUTREACH_WEBHOOK_SECRET || "";
  if (!rahasia) {
    // Tanpa rahasia, tidak ada yang dapat dibuktikan. Menerima apa adanya
    // berarti siapa pun yang tahu alamat ini dapat mengarang "pantulan keras"
    // untuk alamat mana pun dan mencekalnya dari sistem ini selamanya.
    return Response.json(
      { success: false, message: "Webhook belum dikonfigurasi." },
      { status: 503 },
    );
  }

  const mentah = await request.text();
  const sah = await tandaTanganSah(
    mentah,
    {
      id: request.headers.get("svix-id") || request.headers.get("webhook-id") || "",
      timestamp: request.headers.get("svix-timestamp") || request.headers.get("webhook-timestamp") || "",
      signature: request.headers.get("svix-signature") || request.headers.get("webhook-signature") || "",
    },
    rahasia,
  );
  if (!sah) {
    return Response.json({ success: false, message: "Tanda tangan tidak sah." }, { status: 401 });
  }

  let muatan: Muatan;
  try {
    muatan = JSON.parse(mentah) as Muatan;
  } catch {
    return Response.json({ success: false, message: "Muatan bukan JSON." }, { status: 400 });
  }

  const jenis = String(muatan.type || muatan.event || "").slice(0, 40);
  const pesanId = nomorPesan(muatan);
  if (!jenis) return Response.json({ success: true, diabaikan: "tanpa jenis peristiwa" });

  try {
    const baris = pesanId ? await penerimaDariPesan(pesanId) : null;

    // Peristiwa dicatat lebih dulu, bahkan bila barisnya tidak ketemu.
    // Nomor pesan yang tidak dikenali adalah hal yang perlu dapat ditelusuri
    // — biasanya surat uji, atau kampanye dari pemasangan lain yang webhook-
    // nya kebetulan diarahkan ke sini.
    const baru = await catatPeristiwa({
      penerimaKampanyeId: baris?.id ?? null,
      eventId: request.headers.get("svix-id") || request.headers.get("webhook-id") || pesanId || null,
      jenis,
      muatan,
    });

    // Peristiwa yang sudah pernah dicatat berhenti di sini. Penyedia mengirim
    // ulang webhook yang belum dijawab 200, dan tanpa pemeriksaan ini satu
    // pantulan yang sama akan terhitung berkali-kali.
    if (!baru) return Response.json({ success: true, diabaikan: "peristiwa berulang" });
    if (!baris) return Response.json({ success: true, diabaikan: "nomor pesan tidak dikenali" });

    const status = statusDariPeristiwa(jenis);
    if (status) await ubahStatusPenerimaKampanye(baris.id, status);

    const cekal = cekalDariPeristiwa(jenis);
    if (cekal) {
      await tambahCekal({
        email: baris.email,
        alasan: cekal,
        sumber: `webhook:${jenis}`,
        catatan: null,
      });
    }

    await segarkanHitung(baris.campaignId);
    return Response.json({ success: true, jenis, status, cekal });
  } catch (galat) {
    console.error("webhook outreach", galat);
    // 500 supaya penyedia mengirimnya lagi. Peristiwa yang hilang berarti
    // statistik yang salah dan alamat mati yang tidak pernah terbuang.
    return Response.json({ success: false, message: "Gagal memproses peristiwa." }, { status: 500 });
  }
}
