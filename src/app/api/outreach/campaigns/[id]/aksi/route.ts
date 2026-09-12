// Kendali kampanye: jalankan, jeda, lanjutkan, batalkan, dan surat uji.
//
// Perhatikan satu hal yang membedakan "batal" dari yang lain: ia tidak dapat
// dibatalkan kembali. Surat yang sudah keluar tidak dapat ditarik pulang, dan
// panel mengatakannya apa adanya alih-alih menawarkan tombol "urungkan" yang
// tidak mungkin menepati janjinya.

import {
  jatahHariIni,
  rapikanEmail,
  type StatusKampanye,
} from "@/lib/outreach";
import { kirimSurat, periksaKesiapan, rakitSurat } from "@/lib/outreach-kirim";
import { bolehSentuhKampanye, gerbangOus } from "@/lib/outreach-gerbang";
import {
  ambilKampanye,
  catatAudit,
  mulaiPemanasan,
  segarkanHitung,
  tokenPenerima,
  ubahStatusKampanye,
} from "@/lib/outreach-store";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Perpindahan keadaan yang diizinkan. Yang tidak tercantum, ditolak. */
const PINDAH: Record<string, { dari: string[]; ke: StatusKampanye; pesan: string }> = {
  jalan: { dari: ["draft", "paused", "queued"], ke: "sending", pesan: "Kampanye mulai berjalan." },
  jeda: { dari: ["sending", "queued"], ke: "paused", pesan: "Kampanye dijeda." },
  lanjut: { dari: ["paused"], ke: "sending", pesan: "Kampanye dilanjutkan." },
  batal: { dari: ["draft", "queued", "sending", "paused"], ke: "cancelled", pesan: "Kampanye dibatalkan." },
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gerbang = await gerbangOus("pakai");
  if (!gerbang.ok) return gerbang.jawab;
  const { profil, pelaku, state } = gerbang.ctx;

  const batas = rateLimit({ request, name: "outreach-aksi", limit: 40, windowMs: 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const { id } = await params;
    const nomor = Number(id);
    if (!Number.isInteger(nomor) || nomor < 1) {
      return Response.json({ success: false, message: "Kampanye tidak ditemukan." }, { status: 404 });
    }

    const kampanye = await ambilKampanye(nomor);
    if (!kampanye || !bolehSentuhKampanye(profil, kampanye)) {
      return Response.json({ success: false, message: "Kampanye tidak ditemukan." }, { status: 404 });
    }

    const badan = (await request.json()) as { aksi?: string; ke?: string };
    const aksi = String(badan.aksi || "");

    // --- surat uji --------------------------------------------------------
    if (aksi === "uji") {
      const tujuan = rapikanEmail(badan.ke) || rapikanEmail(profil.email);
      if (!tujuan) {
        return Response.json({ success: false, message: "Alamat tujuan uji tidak sah." }, { status: 400 });
      }
      const penerima = await tokenPenerima(tujuan);
      if (!penerima) {
        return Response.json({ success: false, message: "Alamat tujuan uji tidak dapat disiapkan." }, { status: 400 });
      }

      const surat = rakitSurat(
        {
          // Surat uji memang dikirim berkali-kali ke alamat yang sama, jadi
          // kuncinya ikut membawa waktu — tanpa itu, uji kedua akan ditolak
          // penyedia sebagai kiriman berulang dan tidak pernah sampai.
          idem: `uji${nomor}-${Date.now()}`,
          email: tujuan,
          // Diisi contoh, bukan dikosongkan: yang perlu diperiksa pada surat
          // uji justru bagaimana nama dan institusi muncul di dalam kalimat.
          name: profil.fullName,
          institution: "Universitas Muhammadiyah Tangerang",
          field: "Communication Studies",
          country: "Indonesia",
          unsubscribeToken: penerima.token,
          subject: `[UJI] ${kampanye.subject}`,
          bodyHtml: kampanye.bodyHtml,
          bodyText: kampanye.bodyText,
          fromName: kampanye.fromName,
          fromEmail: kampanye.fromEmail,
          replyTo: kampanye.replyTo,
        },
        state,
      );

      const hasil = await kirimSurat(surat, kampanye.simulasi);
      await catatAudit({
        pelaku,
        tindakan: "kampanye.uji",
        jenis: "kampanye",
        nomor,
        keterangan: { ke: tujuan, berhasil: hasil.ok, simulasi: kampanye.simulasi },
      });

      if (!hasil.ok) {
        return Response.json(
          { success: false, message: `Surat uji gagal dikirim: ${hasil.pesan}` },
          { status: 502 },
        );
      }
      return Response.json({
        success: true,
        simulasi: hasil.simulasi,
        message: hasil.simulasi
          ? "Mode simulasi: surat uji TIDAK benar-benar dikirim. Pratinjau di layar sudah memakai perakitan yang sama persis dengan surat sungguhan."
          : `Surat uji dikirim ke ${tujuan}.`,
      });
    }

    // --- perpindahan keadaan ---------------------------------------------
    const aturan = PINDAH[aksi];
    if (!aturan) {
      return Response.json({ success: false, message: "Perintah tidak dikenali." }, { status: 400 });
    }
    if (!aturan.dari.includes(kampanye.status)) {
      return Response.json(
        { success: false, message: `Kampanye berstatus "${kampanye.status}" tidak dapat menerima perintah ini.` },
        { status: 400 },
      );
    }

    if (aturan.ke === "sending") {
      if (kampanye.queuedCount <= 0) {
        return Response.json(
          { success: false, message: "Tidak ada lagi penerima yang mengantre pada kampanye ini." },
          { status: 400 },
        );
      }
      // Kampanye sungguhan menuntut pengaturannya benar-benar siap. Yang
      // dibekukan pada kampanye adalah simulasi/tidak; sisanya diperiksa
      // lagi di sini, sebab pengaturan dapat berubah sesudah kampanye dibuat.
      if (!kampanye.simulasi) {
        const siap = periksaKesiapan(state);
        if (!siap.siap) {
          return Response.json(
            { success: false, message: `Kampanye sungguhan belum dapat dijalankan. ${siap.penghalang[0]}`, kesiapan: siap },
            { status: 400 },
          );
        }
        await mulaiPemanasan();
      }
    }

    await ubahStatusKampanye(nomor, aturan.ke);
    await segarkanHitung(nomor);
    await catatAudit({ pelaku, tindakan: `kampanye.${aksi}`, jenis: "kampanye", nomor });

    const jatah = jatahHariIni(state, new Date());
    return Response.json({
      success: true,
      message: aturan.ke === "sending"
        ? `${aturan.pesan} Jatah hari ini ${jatah} surat; sisanya dilanjutkan besok.`
        : aturan.pesan,
      status: aturan.ke,
    });
  } catch (galat: unknown) {
    console.error("aksi kampanye outreach", galat);
    return Response.json(
      { success: false, message: explainServerError(galat, "Perintah belum dapat dijalankan.") },
      { status: 500 },
    );
  }
}
