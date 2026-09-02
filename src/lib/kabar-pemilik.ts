// ============================================================
// KABAR KE PEMILIK — Telegram
//
// Kenapa Telegram, bukan yang lain: bot Telegram GRATIS, tidak menuntut
// aplikasi tambahan di ponsel, dan pemberitahuannya muncul di layar kunci.
// Gerbang WhatsApp berbayar bulanan, dan aplikasi penerus pemberitahuan
// menuntut pemasangan yang ternyata tidak sempat dikerjakan.
//
// Yang dikirim ke sini hanya hal yang MENUNTUT TINDAKAN. Pemberitahuan untuk
// hal yang tidak perlu dikerjakan siapa pun adalah cara tercepat membuat orang
// berhenti membaca pemberitahuan.
//
// TIDUR TANPA KUNCI: tanpa TELEGRAM_BOT_TOKEN dan TELEGRAM_ADMIN_CHAT_ID,
// fungsi ini diam saja. Kegagalannya tidak pernah menggagalkan apa pun —
// pesanannya sudah tersimpan; yang hilang hanya kabarnya.
// ============================================================

export function telegramSiap() {
  return Boolean(
    (process.env.TELEGRAM_BOT_TOKEN || "").trim() && (process.env.TELEGRAM_ADMIN_CHAT_ID || "").trim(),
  );
}

/** Chat mana yang boleh memberi perintah. Kosong berarti tidak ada. */
export function chatPemilik() {
  return (process.env.TELEGRAM_ADMIN_CHAT_ID || "").trim();
}

export async function kabarkanPemilik(teks: string) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chat = chatPemilik();
  if (!token || !chat || !teks) return false;

  try {
    const jawab = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: teks.slice(0, 3_900),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!jawab.ok) {
      console.error("kabar telegram", jawab.status, await jawab.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("kabar telegram", error);
    return false;
  }
}
