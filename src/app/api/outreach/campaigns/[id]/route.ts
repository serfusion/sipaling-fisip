// Rincian satu kampanye beserta daftar penerimanya.

import { periksaNada, ringkasanKampanye } from "@/lib/outreach";
import { rangkaEmail } from "@/lib/outreach-template";
import { bolehSentuhKampanye, gerbangOus } from "@/lib/outreach-gerbang";
import { ambilKampanye, penerimaKampanye } from "@/lib/outreach-store";
import { explainServerError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gerbang = await gerbangOus("lihat");
  if (!gerbang.ok) return gerbang.jawab;
  const { profil } = gerbang.ctx;

  try {
    const { id } = await params;
    const nomor = Number(id);
    if (!Number.isInteger(nomor) || nomor < 1) {
      return Response.json({ success: false, message: "Kampanye tidak ditemukan." }, { status: 404 });
    }

    const kampanye = await ambilKampanye(nomor);
    if (!kampanye) {
      return Response.json({ success: false, message: "Kampanye tidak ditemukan." }, { status: 404 });
    }
    if (!bolehSentuhKampanye(profil, kampanye)) {
      // 404, bukan 403. Menjawab "tidak boleh" pada kampanye milik orang lain
      // sudah memberi tahu bahwa kampanye bernomor itu ada.
      return Response.json({ success: false, message: "Kampanye tidak ditemukan." }, { status: 404 });
    }

    const alamat = new URL(request.url);
    const saring = alamat.searchParams.get("status") || "";
    const penerima = await penerimaKampanye(nomor, saring, 300);

    return Response.json({
      success: true,
      campaign: kampanye,
      ringkasan: ringkasanKampanye({
        total: kampanye.totalRecipients,
        queued: kampanye.queuedCount,
        sent: kampanye.sentCount,
        delivered: kampanye.deliveredCount,
        failed: kampanye.failedCount,
        bounced: kampanye.bouncedCount,
        unsubscribed: kampanye.unsubscribedCount,
      }),
      nada: periksaNada(kampanye.subject, rangkaEmail(kampanye.bodyHtml, kampanye.subject), kampanye.bodyText || ""),
      recipients: penerima,
    });
  } catch (galat: unknown) {
    console.error("rincian kampanye outreach", galat);
    return Response.json(
      { success: false, message: explainServerError(galat, "Rincian kampanye belum dapat dimuat.") },
      { status: 500 },
    );
  }
}
