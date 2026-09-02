// ============================================================
// JALUR TELEGRAM
//
// Salah satu dari dua pintu "tinggal kirim pesan": satu bot Telegram
// diarahkan ke alamat ini, lalu apa pun yang diketik pemiliknya di percakapan
// itu langsung menjadi baris di bukunya.
//
// Yang dikerjakan berkas ini HANYA protokol Telegram: memeriksa tanda tangan,
// membaca bentuk muatannya, dan mengirim balasan. Isi percakapannya sendiri
// diputuskan di src/lib/uang/percakapan.ts, sama persis dengan WhatsApp.
//
// Cara memasangnya ada di UPDATE-V14-CATATAN-UANG.md.
//
// TIDUR TANPA KUNCI: tanpa TELEGRAM_BOT_TOKEN dan TELEGRAM_WEBHOOK_SECRET,
// jalur ini menjawab 404 untuk siapa pun. Sama seperti webhook pembayaran
// Cakrawala, jalur yang belum dipakai tidak perlu memberi tahu bahwa ia ada.
// ============================================================
import { layaniPesan } from "@/lib/uang/percakapan";
import { pernahDikerjakan, tandaCocok } from "@/lib/uang/pesan-masuk";
import { chatPemilik } from "@/lib/kabar-pemilik";
import { bacaPerintahPesanan, layaniPerintahPesanan } from "@/lib/perintah-pesanan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PesanMasuk = {
  message_id?: number;
  text?: string;
  chat?: { id?: number | string; type?: string; title?: string };
  from?: { first_name?: string; username?: string };
};

type Kiriman = { update_id?: number; message?: PesanMasuk; edited_message?: PesanMasuk };

async function balas(token: string, chatId: string, teks: string) {
  if (!teks) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: teks.slice(0, 3_900),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    // Balasan yang gagal terkirim tidak boleh membatalkan pencatatannya.
    // Uangnya sudah tercatat; yang hilang cuma kabarnya.
    console.error("balas telegram", error);
  }
}

export async function POST(request: Request) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const kunci = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  if (!token || !kunci) {
    return Response.json({ success: false, message: "Tidak tersedia." }, { status: 404 });
  }

  const kirimTanda = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!tandaCocok(kirimTanda, kunci)) {
    return Response.json({ success: false, message: "Tanda tangan tidak sah." }, { status: 401 });
  }

  let kiriman: Kiriman;
  try {
    kiriman = (await request.json()) as Kiriman;
  } catch {
    return Response.json({ ok: true });
  }

  const pesan = kiriman.message ?? kiriman.edited_message;
  const chatId = pesan?.chat?.id;
  const teks = String(pesan?.text ?? "").trim();

  // Kiriman tanpa teks (stiker, foto, orang masuk grup) dijawab ramah dengan
  // 200 supaya Telegram berhenti mengulanginya.
  if (chatId === undefined || chatId === null || !teks) return Response.json({ ok: true });
  if (pernahDikerjakan("telegram", kiriman.update_id)) return Response.json({ ok: true });

  const chat = String(chatId);
  const label = pesan?.chat?.title || pesan?.from?.first_name || pesan?.from?.username || "Telegram";

  // PERINTAH PESANAN CAKRAWALA — didahulukan atas catatan uang.
  //
  // Hanya dari chat pemiliknya. Bot Telegram dapat diajak bicara siapa saja
  // yang tahu namanya, dan "lunas PSN-XXXXXX" dari orang asing berarti kode
  // akses yang diberikan gratis. Chat lain tidak diberi tahu bahwa perintah
  // ini ada; pesannya diteruskan ke jalur catatan uang seperti biasa.
  const pemilik = chatPemilik();
  if (pemilik && chat === pemilik) {
    const perintah = bacaPerintahPesanan(teks);
    if (perintah) {
      try {
        await balas(token, chat, await layaniPerintahPesanan(perintah));
      } catch (error) {
        console.error("perintah pesanan telegram", error);
        await balas(token, chat, "Perintahnya belum dapat dikerjakan. Coba lagi sebentar.");
      }
      return Response.json({ ok: true });
    }
  }

  try {
    const jawab = await layaniPesan({ kanal: "telegram", externalId: chat, teks, label });
    await balas(token, chat, jawab.teks);
  } catch (error) {
    console.error("telegram catatan uang", error);
    await balas(
      token,
      chat,
      "Ada yang bermasalah di sisi server. Catatannya belum tersimpan, coba kirim ulang sebentar lagi.",
    );
  }

  // SELALU 200. Balasan selain itu membuat Telegram mengirim ulang kiriman
  // yang sama, dan yang terulang adalah pencatatan uang orang.
  return Response.json({ ok: true });
}
