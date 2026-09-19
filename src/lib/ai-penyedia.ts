// ============================================================
// LAPISAN PENYEDIA MODEL — Claude atau Gemini
//
// Dipisahkan supaya pemilik portal tidak terkunci pada satu penyedia: yang
// menentukan hanyalah kunci mana yang terpasang di environment.
//
//   ANTHROPIC_API_KEY → Claude   (mutu paling baik untuk soal berbahasa Indonesia)
//   GEMINI_API_KEY    → Gemini   (punya lapis gratis)
//
// Bila keduanya terpasang, Claude dipakai kecuali diminta lain. Bila tidak ada
// satu pun, menu-nya tetap ada tetapi menjawab dengan keterangan yang jelas —
// bukan galat 500 yang menyuruh dosennya menebak-nebak.
// ============================================================
import Anthropic from "@anthropic-ai/sdk";

export type NamaPenyedia = "claude" | "gemini";

export type JawabanModel = {
  penyedia: NamaPenyedia;
  model: string;
  /** JSON yang sudah diurai. */
  isi: unknown;
  /** Untuk dicatat di log, bukan untuk ditampilkan ke dosen. */
  pemakaian?: { masuk?: number; keluar?: number };
};

export class GalatModel extends Error {
  constructor(pesan: string, readonly status = 502) {
    super(pesan);
    this.name = "GalatModel";
  }
}

/** Penyedia mana yang siap dipakai, menurut kunci yang terpasang. */
export function penyediaTersedia(): NamaPenyedia[] {
  const ada: NamaPenyedia[] = [];
  if ((process.env.ANTHROPIC_API_KEY || "").trim()) ada.push("claude");
  if ((process.env.GEMINI_API_KEY || "").trim()) ada.push("gemini");
  return ada;
}

const MODEL_CLAUDE = process.env.CBT_MODEL_CLAUDE || "claude-opus-5";
const MODEL_GEMINI = process.env.CBT_MODEL_GEMINI || "gemini-2.5-flash";

/**
 * Minta model menjawab dalam bentuk JSON yang sesuai skema.
 *
 * Skemanya ditegakkan penyedia — bukan dititipkan sebagai permintaan di dalam
 * perintah. Model yang diminta "tolong balas JSON saja" tetap sesekali
 * membalas dengan kalimat pembuka, dan yang menanggungnya adalah dosen yang
 * menunggu dua puluh soal lalu menerima galat penguraian.
 */
/**
 * Gambar yang ikut dikirim bersama perintah.
 *
 * Datanya base64 TANPA awalan "data:", supaya kedua penyedia menerimanya apa
 * adanya — Claude menuntut base64 murni, dan Gemini juga.
 */
export type GambarMasuk = { jenis: string; data: string };

/**
 * Suara yang ikut dikirim bersama perintah. Bentuknya sama dengan gambar:
 * base64 murni tanpa awalan "data:".
 *
 * HANYA GEMINI YANG MENDENGAR. Claude membaca gambar tetapi tidak menerima
 * masukan suara, jadi permintaan bersuara yang jatuh ke Claude ditolak dengan
 * keterangan yang menyebut sebabnya — bukan dikirim lalu gagal dengan galat
 * penyedia yang tidak dapat dibaca siapa pun.
 */
export type SuaraMasuk = { jenis: string; data: string };

/** Penyedia mana yang dapat mendengar rekaman. */
export function penyediaDengar(): NamaPenyedia[] {
  return penyediaTersedia().filter((p) => p === "gemini");
}

export async function mintaJson(input: {
  sistem: string;
  perintah: string;
  skema: Record<string, unknown>;
  penyedia?: NamaPenyedia;
  maksKeluaran?: number;
  /** Gambar yang ikut dibaca model. Kosong untuk permintaan teks biasa. */
  gambar?: GambarMasuk[];
  /** Suara yang ikut didengar model. Hanya Gemini yang menerimanya. */
  suara?: SuaraMasuk[];
  /**
   * Seberapa dalam model diminta berpikir. "low" untuk pekerjaan yang
   * berulang ribuan kali dan jawabannya pendek — memeriksa satu cuplikan
   * kamera adalah persis itu, dan "high" di sana hanya menambah biaya tanpa
   * menambah ketepatan.
   */
  usaha?: "low" | "medium" | "high";
}): Promise<JawabanModel> {
  const tersedia = penyediaTersedia();
  if (tersedia.length === 0) {
    throw new GalatModel(
      "Pembuat soal AI belum tersambung ke model mana pun. Pasang ANTHROPIC_API_KEY " +
        "(Claude) atau GEMINI_API_KEY pada environment Vercel, lalu deploy ulang.",
      503,
    );
  }

  // Permintaan bersuara memilih penyedianya sendiri, apa pun yang diminta
  // pemanggil. Yang meminta transkrip tidak seharusnya perlu tahu penyedia
  // mana yang kebetulan punya telinga bulan ini.
  if ((input.suara ?? []).length > 0) {
    if (!tersedia.includes("gemini")) {
      throw new GalatModel(
        "Transkrip rekaman memerlukan GEMINI_API_KEY pada environment, model yang " +
          "terpasang sekarang tidak dapat mendengar rekaman. Rekamannya tetap tersimpan " +
          "dan tetap dapat diputar dosen.",
        503,
      );
    }
    return lewatGemini(input);
  }

  const pilih = input.penyedia && tersedia.includes(input.penyedia) ? input.penyedia : tersedia[0];
  return pilih === "claude" ? lewatClaude(input) : lewatGemini(input);
}

async function lewatClaude(input: {
  sistem: string;
  perintah: string;
  skema: Record<string, unknown>;
  maksKeluaran?: number;
  gambar?: GambarMasuk[];
  usaha?: "low" | "medium" | "high";
}): Promise<JawabanModel> {
  const client = new Anthropic();
  try {
    // Dialirkan, bukan sekali tunggu: dua puluh soal beserta pembahasannya
    // adalah keluaran panjang, dan permintaan panjang yang tidak dialirkan
    // menabrak batas waktu HTTP sebelum jawabannya selesai.
    const aliran = client.messages.stream({
      model: MODEL_CLAUDE,
      max_tokens: input.maksKeluaran ?? 32_000,
      system: input.sistem,
      thinking: { type: "adaptive" },
      output_config: {
        effort: input.usaha ?? "high",
        format: { type: "json_schema", schema: input.skema },
      },
      messages: [
        {
          role: "user",
          // Gambar diletakkan SEBELUM teksnya. Perintah yang datang lebih dulu
          // membuat model menjawab sebelum ia benar-benar melihat gambarnya,
          // dan pada pemeriksaan kamera itu berarti jawaban yang percaya diri
          // tentang gambar yang belum dibaca.
          content: [
            ...(input.gambar ?? []).map((g) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: g.jenis as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: g.data,
              },
            })),
            { type: "text" as const, text: input.perintah },
          ],
        },
      ],
    });
    const pesan = await aliran.finalMessage();

    if (pesan.stop_reason === "refusal") {
      throw new GalatModel(
        "Model menolak memproses naskah ini. Periksa isinya, lalu coba lagi dengan bagian yang relevan saja.",
        422,
      );
    }

    const teks = pesan.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (!teks.trim()) throw new GalatModel("Model menjawab kosong. Coba lagi.");

    return {
      penyedia: "claude",
      model: pesan.model,
      isi: JSON.parse(teks),
      pemakaian: { masuk: pesan.usage.input_tokens, keluar: pesan.usage.output_tokens },
    };
  } catch (galat: unknown) {
    if (galat instanceof GalatModel) throw galat;
    if (galat instanceof SyntaxError) {
      throw new GalatModel("Jawaban model tidak dapat diurai sebagai JSON. Coba lagi.");
    }
    // Kelas galat SDK diperiksa dari yang paling khusus ke yang paling umum.
    if (galat instanceof Anthropic.AuthenticationError) {
      throw new GalatModel("ANTHROPIC_API_KEY ditolak. Periksa kuncinya di environment.", 500);
    }
    if (galat instanceof Anthropic.RateLimitError) {
      throw new GalatModel("Batas pemakaian model tercapai. Tunggu sebentar lalu coba lagi.", 429);
    }
    if (galat instanceof Anthropic.APIError) {
      throw new GalatModel(`Model menjawab galat ${galat.status}: ${galat.message}`);
    }
    throw new GalatModel(galat instanceof Error ? galat.message : "Model tidak dapat dihubungi.");
  }
}

/**
 * Jalur Gemini, lewat HTTP biasa.
 *
 * Tanpa SDK, karena yang dipakai hanya satu titik akhir dan menambah satu
 * pustaka lagi demi itu tidak sepadan.
 */
async function lewatGemini(input: {
  sistem: string;
  perintah: string;
  skema: Record<string, unknown>;
  maksKeluaran?: number;
  gambar?: GambarMasuk[];
  suara?: SuaraMasuk[];
  usaha?: "low" | "medium" | "high";
}): Promise<JawabanModel> {
  const kunci = (process.env.GEMINI_API_KEY || "").trim();
  const alamat =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL_GEMINI)}:generateContent`;

  let jawab: Response;
  try {
    jawab = await fetch(alamat, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": kunci },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.sistem }] },
        contents: [
          {
            role: "user",
            parts: [
              ...(input.gambar ?? []).map((g) => ({
                inline_data: { mime_type: g.jenis, data: g.data },
              })),
              ...(input.suara ?? []).map((a) => ({
                inline_data: { mime_type: a.jenis, data: a.data },
              })),
              { text: input.perintah },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: input.skema,
          maxOutputTokens: input.maksKeluaran ?? 32_000,
        },
      }),
    });
  } catch {
    throw new GalatModel("Gemini tidak dapat dihubungi. Periksa sambungan jaringan server.");
  }

  if (!jawab.ok) {
    const badan = await jawab.text().catch(() => "");
    if (jawab.status === 401 || jawab.status === 403) {
      throw new GalatModel("GEMINI_API_KEY ditolak. Periksa kuncinya di environment.", 500);
    }
    if (jawab.status === 429) {
      throw new GalatModel("Kuota Gemini tercapai. Tunggu sebentar lalu coba lagi.", 429);
    }
    throw new GalatModel(`Gemini menjawab galat ${jawab.status}: ${badan.slice(0, 200)}`);
  }

  const data = (await jawab.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const teks = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text ?? "").join("");
  if (!teks.trim()) throw new GalatModel("Gemini menjawab kosong. Coba lagi.");

  try {
    return { penyedia: "gemini", model: MODEL_GEMINI, isi: JSON.parse(teks) };
  } catch {
    throw new GalatModel("Jawaban Gemini tidak dapat diurai sebagai JSON. Coba lagi.");
  }
}
