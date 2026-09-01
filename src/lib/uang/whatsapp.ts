// ============================================================
// PERKAKAS WHATSAPP
//
// Dua cara memasang WhatsApp, dan keduanya dilayani jalur yang sama:
//
//   1. WhatsApp Cloud API resmi dari Meta. Gratis untuk percakapan yang
//      dimulai pengguna, tetapi perlu akun Meta Business.
//   2. Gerbang pihak ketiga (Fonnte, Wablas, Watzap, dan sebangsanya) yang
//      lazim dipakai di Indonesia. Lebih cepat dipasang, berbayar murah.
//
// Yang berbeda hanya bentuk muatannya dan cara mengirim balasan. Isi
// percakapannya satu, di src/lib/uang/percakapan.ts.
// ============================================================

export type PesanWa = {
  /** Nomor pengirim, hanya angka, sudah berawalan kode negara. */
  nomor: string;
  teks: string;
  label: string;
  /** Nomor pesan dari penyedianya, dipakai menyaring kiriman ulang. */
  id?: string;
};

/**
 * Menyeragamkan nomor telepon menjadi satu bentuk.
 *
 * Satu orang yang sama dapat datang sebagai "08123456789" dari sebuah
 * gerbang dan "628123456789@c.us" dari Meta. Tanpa penyeragaman ini,
 * keduanya menjadi dua sambungan berbeda dan catatannya terbelah dua.
 */
export function nomorWa(masukan: unknown): string | null {
  const angka = String(masukan ?? "")
    .split("@")[0]
    .replace(/\D/g, "");
  if (!angka) return null;

  let nomor = angka;
  if (nomor.startsWith("0")) nomor = `62${nomor.slice(1)}`;
  // Nomor Indonesia yang ditulis tanpa nol dan tanpa kode negara.
  else if (nomor.startsWith("8") && nomor.length >= 9 && nomor.length <= 13) nomor = `62${nomor}`;

  if (nomor.length < 8 || nomor.length > 20) return null;
  return nomor;
}

// ---------- MUATAN ----------

type MuatanMeta = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
        }>;
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
      };
    }>;
  }>;
};

/** Membaca satu pesan teks dari muatan WhatsApp Cloud API. */
export function bacaMuatanMeta(muatan: unknown): PesanWa | null {
  const isi = muatan as MuatanMeta;
  const nilai = isi?.entry?.[0]?.changes?.[0]?.value;
  const pesan = nilai?.messages?.[0];

  // Pemberitahuan status (terkirim, dibaca) datang tanpa messages. Ia bukan
  // kesalahan, hanya bukan sesuatu yang perlu dikerjakan.
  if (!pesan || pesan.type !== "text") return null;

  const nomor = nomorWa(pesan.from);
  if (!nomor) return null;

  const teks = String(pesan.text?.body ?? "").trim();
  if (!teks) return null;

  return {
    nomor,
    teks,
    label: nilai?.contacts?.[0]?.profile?.name || "WhatsApp",
    id: pesan.id,
  };
}

/**
 * Membaca muatan gerbang pihak ketiga.
 *
 * Tiap gerbang menamai kolomnya sendiri-sendiri, dan tidak ada standarnya.
 * Yang dilakukan di sini: menerima nama-nama yang lazim dipakai, supaya
 * berpindah gerbang tidak berarti menulis ulang jalur ini.
 */
export function bacaMuatanGerbang(muatan: unknown): PesanWa | null {
  const isi = (muatan ?? {}) as Record<string, unknown>;
  const ambil = (...nama: string[]) => {
    for (const n of nama) {
      const nilai = isi[n];
      if (typeof nilai === "string" && nilai.trim()) return nilai.trim();
      if (typeof nilai === "number") return String(nilai);
    }
    return "";
  };

  const nomor = nomorWa(ambil("sender", "pengirim", "from", "phone", "nomor", "wa", "number"));
  if (!nomor) return null;

  const teks = ambil("message", "pesan", "text", "body", "isi", "msg");
  if (!teks) return null;

  return {
    nomor,
    teks,
    label: ambil("name", "nama", "pushname", "sender_name") || "WhatsApp",
    id: ambil("id", "message_id", "messageId", "msgId") || undefined,
  };
}

// ---------- MENGIRIM BALASAN ----------

/** Panjang aman satu pesan WhatsApp. Batas sesungguhnya 4096 huruf. */
const BATAS = 3_900;

export async function balasLewatMeta(nomor: string, teks: string) {
  const token = (process.env.WHATSAPP_TOKEN || "").trim();
  const nomorId = (process.env.WHATSAPP_PHONE_ID || "").trim();
  if (!token || !nomorId || !teks) return;

  const versi = (process.env.WHATSAPP_API_VERSION || "v21.0").trim();
  try {
    const jawab = await fetch(`https://graph.facebook.com/${versi}/${nomorId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: nomor,
        type: "text",
        text: { preview_url: false, body: teks.slice(0, BATAS) },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!jawab.ok) console.error("balas whatsapp meta", jawab.status, await jawab.text());
  } catch (error) {
    // Uangnya sudah tercatat; yang gagal hanya kabarnya.
    console.error("balas whatsapp meta", error);
  }
}

/**
 * Mengirim balasan lewat gerbang pihak ketiga.
 *
 * Bentuk yang dipakai mengikuti Fonnte, yang paling banyak dipakai di
 * Indonesia: POST JSON { target, message } dengan token pada header
 * Authorization. Gerbang lain yang bentuknya berbeda cukup diarahkan ke
 * alamat penyesuainya sendiri lewat WA_GATEWAY_KIRIM_URL.
 */
export async function balasLewatGerbang(nomor: string, teks: string) {
  const alamat = (process.env.WA_GATEWAY_KIRIM_URL || "").trim();
  const token = (process.env.WA_GATEWAY_TOKEN || "").trim();
  if (!alamat || !teks) return;

  try {
    const jawab = await fetch(alamat, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: token } : {}),
      },
      body: JSON.stringify({ target: nomor, message: teks.slice(0, BATAS) }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!jawab.ok) console.error("balas whatsapp gerbang", jawab.status);
  } catch (error) {
    console.error("balas whatsapp gerbang", error);
  }
}
