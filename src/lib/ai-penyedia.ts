// ============================================================
// LAPISAN PENYEDIA MODEL — Gemini, Claude, atau ChatGPT
//
// Seluruh fitur AI portal ini — pembuat soal, penilai esai, transkrip rekaman
// suara, pemeriksa kamera — lewat SATU pintu di sini, dan tidak satu pun
// perlu tahu penyedia mana yang sedang dipakai.
//
// Kuncinya dibaca dari Dashboard Super Admin (lihat src/lib/ai-kunci.ts),
// dengan environment sebagai cadangan terakhir. Kunci-kunci itu disusun URUT,
// dan permintaan yang gagal karena kunci ditolak, kuota habis, atau
// penyedianya sedang galat DICOBA ULANG pada kunci berikutnya. Kunci Gemini
// yang habis kuotanya di tengah ujian tidak lagi mematikan transkrip; ia
// berpindah sendiri ke kunci cadangan.
// ============================================================
import Anthropic from "@anthropic-ai/sdk";
import { kunciAktif, LABEL_PENYEDIA, samarkan, type KunciAi, type PenyediaAi } from "@/lib/ai-kunci";
import { catatPanggilan, laporkanKunciGagal, type FiturAi, cekBatas } from "@/lib/ai-pemakaian";

export type NamaPenyedia = PenyediaAi;

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

/** Penyedia yang siap dipakai, urut prioritas, tanpa pengulangan. */
export async function penyediaTersedia(): Promise<NamaPenyedia[]> {
  const urut: NamaPenyedia[] = [];
  for (const k of await kunciAktif()) if (!urut.includes(k.penyedia)) urut.push(k.penyedia);
  return urut;
}

/**
 * Galat yang layak dicoba ulang pada KUNCI LAIN.
 *
 * Kunci ditolak (500 dari kita), kuota habis (429), penyedia galat atau tidak
 * terjangkau (502, 503). Yang TIDAK dicoba ulang: penolakan isi (422) — kunci
 * lain akan menolak naskah yang sama, dan mencobanya hanya memperlama.
 */
function bolehPindah(galat: unknown): boolean {
  return galat instanceof GalatModel && [429, 500, 502, 503, 504].includes(galat.status);
}

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

/**
 * Penyedia mana yang dapat mendengar rekaman.
 *
 * Hanya Gemini. Rekaman ujian berbentuk WebM/Opus, dan masukan suara ChatGPT
 * hanya menerima WAV dan MP3; Claude tidak menerima suara sama sekali.
 */
export async function penyediaDengar(): Promise<NamaPenyedia[]> {
  return (await penyediaTersedia()).filter((p) => p === "gemini");
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
  /** Untuk catatan pemakaian bulanan: fitur mana yang memanggil. */
  fitur?: FiturAi;
}): Promise<JawabanModel> {
  const fitur = input.fitur ?? "Lainnya";
  const tolakBatas = await cekBatas(fitur);
  if (tolakBatas) throw new GalatModel(tolakBatas, 429);
  const semua = await kunciAktif();
  if (semua.length === 0) {
    throw new GalatModel(
      "Fitur AI belum tersambung. Tempel kunci Gemini, ChatGPT, atau Claude di " +
        "Dashboard Super Admin → Kunci AI.",
      503,
    );
  }

  // Permintaan bersuara memilih penyedianya sendiri, apa pun yang diminta
  // pemanggil. Yang meminta transkrip tidak seharusnya perlu tahu penyedia
  // mana yang kebetulan punya telinga bulan ini.
  const bersuara = (input.suara ?? []).length > 0;
  let calon = bersuara ? semua.filter((k) => k.penyedia === "gemini") : semua;
  if (calon.length === 0) {
    throw new GalatModel(
      "Transkrip rekaman memerlukan kunci Gemini — hanya Gemini yang dapat mendengar " +
        "rekaman ujian. Tempel kuncinya di Dashboard Super Admin → Kunci AI. " +
        "Rekamannya tetap tersimpan dan tetap dapat diputar.",
      503,
    );
  }

  // Penyedia yang diminta pemanggil didahulukan, tanpa membuang yang lain
  // sebagai cadangan.
  if (input.penyedia) {
    calon = [...calon.filter((k) => k.penyedia === input.penyedia), ...calon.filter((k) => k.penyedia !== input.penyedia)];
  }

  const gagal: string[] = [];
  const gagalRinci: Array<{ penyedia: PenyediaAi; label: string; sebab: string }> = [];
  for (const k of calon) {
    const label = samarkan(k.kunci);
    try {
      const jawab = await lewatKunci(k, input);
      await catatPanggilan({
        kunciId: k.id, penyedia: k.penyedia, label, fitur, berhasil: true,
        masuk: jawab.pemakaian?.masuk, keluar: jawab.pemakaian?.keluar,
      });
      // Berhasil, TETAPI lewat cadangan: kunci di atasnya gagal. Justru
      // inilah yang harus dikabarkan — perpindahan yang diam-diam membuat
      // kunci yang mati tidak ketahuan berminggu-minggu.
      if (gagalRinci.length > 0) {
        await laporkanKunciGagal({ gagal: gagalRinci, dipakai: { penyedia: k.penyedia, label }, fitur });
      }
      return jawab;
    } catch (galat) {
      const sebab = (galat as Error)?.message ?? "gagal";
      await catatPanggilan({ kunciId: k.id, penyedia: k.penyedia, label, fitur, berhasil: false, galat: sebab });
      if (!bolehPindah(galat)) throw galat;
      gagal.push(`${LABEL_PENYEDIA[k.penyedia]}: ${sebab}`);
      gagalRinci.push({ penyedia: k.penyedia, label, sebab });
    }
  }

  await laporkanKunciGagal({ gagal: gagalRinci, dipakai: null, fitur });

  // Seluruh kunci gagal. Sebab masing-masing disebut, supaya yang membaca
  // tahu kunci mana yang harus diganti — bukan hanya bahwa "AI gagal".
  const terakhir = gagal.length === 1 ? gagal[0] : `Semua kunci gagal. ${gagal.join(" · ")}`;
  throw new GalatModel(terakhir, 503);
}

type Masukan = Parameters<typeof mintaJson>[0];

function lewatKunci(k: KunciAi & { model: string }, input: Masukan): Promise<JawabanModel> {
  if (k.penyedia === "claude") return lewatClaude(k, input);
  if (k.penyedia === "openai") return lewatOpenAi(k, input);
  return lewatGemini(k, input);
}

/**
 * Uji satu kunci dengan permintaan sekecil mungkin.
 *
 * Dipakai tombol "Uji" di dashboard. Yang diuji kunci itu SENDIRI, tanpa
 * pindah ke cadangan — tombol yang selalu menjawab "berhasil" karena diam-diam
 * memakai kunci lain tidak menguji apa pun.
 */
export async function ujiKunci(k: KunciAi & { model: string }): Promise<{ model: string; ms: number }> {
  const mulai = Date.now();
  const jawab = await lewatKunci(k, {
    sistem: "Balas singkat.",
    perintah: 'Balas {"ok": true}.',
    skema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
    // Bukan 64. Model Gemini terbaru "berpikir" lebih dulu, dan pikirannya
    // ikut memakan batas keluaran: dengan 64 token seluruhnya habis untuk
    // berpikir, jawabannya kosong, dan uji ini melaporkan kunci yang sehat
    // sebagai rusak.
    maksKeluaran: 1024,
    usaha: "low",
    fitur: "Uji kunci",
  });
  return { model: jawab.model, ms: Date.now() - mulai };
}

async function lewatClaude(k: KunciAi & { model: string }, input: Masukan): Promise<JawabanModel> {
  const client = new Anthropic({ apiKey: k.kunci });
  try {
    // Dialirkan, bukan sekali tunggu: dua puluh soal beserta pembahasannya
    // adalah keluaran panjang, dan permintaan panjang yang tidak dialirkan
    // menabrak batas waktu HTTP sebelum jawabannya selesai.
    const aliran = client.messages.stream({
      model: k.model,
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
      throw new GalatModel("Kunci Claude ditolak. Ganti kuncinya di Dashboard Super Admin → Kunci AI.", 500);
    }
    if (galat instanceof Anthropic.RateLimitError) {
      throw new GalatModel("Batas pemakaian model tercapai. Tunggu sebentar lalu coba lagi.", 429);
    }
    if (galat instanceof Anthropic.APIError) {
      throw new GalatModel(`Claude menjawab galat ${galat.status}: ${galat.message}`, 502);
    }
    throw new GalatModel(galat instanceof Error ? galat.message : "Claude tidak dapat dihubungi.", 503);
  }
}

/**
 * Jalur Gemini, lewat HTTP biasa.
 *
 * Tanpa SDK, karena yang dipakai hanya satu titik akhir dan menambah satu
 * pustaka lagi demi itu tidak sepadan.
 */
async function lewatGemini(k: KunciAi & { model: string }, input: Masukan): Promise<JawabanModel> {
  const kunci = k.kunci;
  const alamatUntuk = (model: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  // Model cadangan untuk jam sibuk. Diukur, bukan diduga: pada jam yang sama
  // gemini-flash-latest menjawab 503 "high demand" tiga kali dari tiga,
  // sementara gemini-flash-lite-latest menjawab tiga kali dari tiga dengan
  // kunci yang sama. Flash-Lite lebih ringan mutunya, tetapi jawaban dari
  // model yang sedikit lebih ringan jauh lebih berguna daripada transkrip
  // yang gagal di tengah ujian.
  const modelCadangan = /lite/i.test(k.model) ? k.model : "gemini-flash-lite-latest";

  let jawab: Response | null = null;
  // Gemini menjawab 503 "high demand" pada jam sibuk. Percobaan kedua memakai
  // model cadangan dengan kunci yang SAMA, sebelum menyerah ke kunci
  // berikutnya — portal yang hanya punya satu kunci pun tetap tertolong.
  let modelDipakai = k.model;
  for (let coba = 0; coba < 2; coba += 1) {
    modelDipakai = coba === 0 ? k.model : modelCadangan;
    try {
      jawab = await fetch(alamatUntuk(modelDipakai), {
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
      throw new GalatModel("Gemini tidak dapat dihubungi. Periksa sambungan jaringan server.", 503);
    }
    if (jawab.status !== 503 || coba === 1) break;
    await new Promise((r) => setTimeout(r, 800));
  }
  if (!jawab) throw new GalatModel("Gemini tidak dapat dihubungi.", 503);

  if (!jawab.ok) {
    const badan = await jawab.text().catch(() => "");
    if (jawab.status === 401 || jawab.status === 403) {
      throw new GalatModel("Kunci Gemini ditolak. Ganti kuncinya di Dashboard Super Admin → Kunci AI.", 500);
    }
    if (jawab.status === 429) {
      throw new GalatModel("Kuota Gemini tercapai. Tunggu sebentar lalu coba lagi.", 429);
    }
    throw new GalatModel(`Gemini menjawab galat ${jawab.status}: ${badan.slice(0, 200)}`, jawab.status >= 500 ? 502 : 422);
  }

  const data = (await jawab.json()) as {
    modelVersion?: string;
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
  };
  const calon = data.candidates?.[0];
  const teks = (calon?.content?.parts || []).map((p) => p.text ?? "").join("");
  if (!teks.trim()) {
    throw new GalatModel(
      calon?.finishReason === "MAX_TOKENS"
        ? "Jawaban Gemini terpotong batas panjang sebelum selesai. Coba lagi dengan permintaan yang lebih kecil."
        : "Gemini menjawab kosong. Coba lagi.",
      502,
    );
  }

  try {
    return { penyedia: "gemini", model: data.modelVersion || modelDipakai, isi: JSON.parse(teks) };
  } catch {
    throw new GalatModel("Jawaban Gemini tidak dapat diurai sebagai JSON. Coba lagi.", 502);
  }
}

/**
 * Jalur ChatGPT, lewat HTTP biasa — alasannya sama dengan Gemini.
 *
 * Skemanya dikirim TIDAK ketat (strict: false). Mode ketat OpenAI menuntut
 * setiap objek menyebut additionalProperties: false dan seluruh medannya
 * wajib — skema yang dipakai portal ini ditulis untuk Claude dan Gemini dan
 * tidak selalu memenuhinya. Mode longgar tetap memaksa balasan berupa JSON.
 */
async function lewatOpenAi(k: KunciAi & { model: string }, input: Masukan): Promise<JawabanModel> {
  let jawab: Response;
  try {
    jawab = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${k.kunci}` },
      body: JSON.stringify({
        model: k.model,
        max_completion_tokens: input.maksKeluaran ?? 16_000,
        response_format: {
          type: "json_schema",
          json_schema: { name: "jawaban", schema: input.skema, strict: false },
        },
        messages: [
          { role: "system", content: input.sistem },
          {
            role: "user",
            content: [
              ...(input.gambar ?? []).map((g) => ({
                type: "image_url" as const,
                image_url: { url: `data:${g.jenis};base64,${g.data}` },
              })),
              { type: "text" as const, text: input.perintah },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new GalatModel("ChatGPT tidak dapat dihubungi. Periksa sambungan jaringan server.", 503);
  }

  if (!jawab.ok) {
    const badan = await jawab.text().catch(() => "");
    if (jawab.status === 401 || jawab.status === 403) {
      throw new GalatModel("Kunci ChatGPT ditolak. Ganti kuncinya di Dashboard Super Admin → Kunci AI.", 500);
    }
    if (jawab.status === 429) {
      throw new GalatModel("Kuota ChatGPT tercapai atau saldonya habis.", 429);
    }
    throw new GalatModel(`ChatGPT menjawab galat ${jawab.status}: ${badan.slice(0, 200)}`, jawab.status >= 500 ? 502 : 422);
  }

  const data = (await jawab.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const pesan = data.choices?.[0]?.message;
  if (pesan?.refusal) {
    throw new GalatModel("Model menolak memproses naskah ini. Periksa isinya, lalu coba lagi.", 422);
  }
  const teks = pesan?.content ?? "";
  if (!teks.trim()) throw new GalatModel("ChatGPT menjawab kosong. Coba lagi.", 502);

  try {
    return {
      penyedia: "openai",
      model: data.model || k.model,
      isi: JSON.parse(teks),
      pemakaian: { masuk: data.usage?.prompt_tokens, keluar: data.usage?.completion_tokens },
    };
  } catch {
    throw new GalatModel("Jawaban ChatGPT tidak dapat diurai sebagai JSON. Coba lagi.", 502);
  }
}
