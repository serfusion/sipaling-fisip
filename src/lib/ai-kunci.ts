// ============================================================
// KUNCI AI — disimpan di basis data, dikelola dari Dashboard Super Admin
//
// Dulu satu-satunya jalan memasang atau mengganti kunci adalah environment
// Vercel, lalu deploy ulang. Artinya kunci yang kehabisan kuota pada jam
// ujian tidak dapat diganti oleh siapa pun yang tidak memegang akun Vercel —
// dan yang memegang akun Vercel jarang sedang berada di ruang ujian.
//
// Sekarang daftar kunci disimpan di tabel app_settings dan disusun URUT:
// kunci pertama dipakai lebih dulu, dan bila ia gagal karena ditolak, kuota
// habis, atau penyedianya sedang galat, kunci berikutnya dicoba sendiri.
// Mengganti Gemini dengan ChatGPT atau Claude cukup dengan menempelkan kunci
// baru di dashboard.
//
// ------------------------------------------------------------
// KUNCINYA TIDAK PERNAH KELUAR DARI SERVER
// ------------------------------------------------------------
//   1. Disimpan TERSANDI (AES-256-GCM). Isi tabel yang bocor lewat cadangan
//      atau ekspor tidak membuka kuncinya.
//   2. Yang dikirim ke peramban hanya bentuk tersamar: "AQ.Con…WXYZ".
//   3. Kunci yang tidak diubah di layar dikirim balik tanpa isi, dan server
//      mempertahankan yang lama. Kunci utuhnya tidak pernah bolak-balik.
//
// Kunci di environment (GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY)
// tetap dibaca, dan ditaruh di BELAKANG daftar dari dashboard sebagai
// cadangan terakhir. Portal yang sudah memasangnya tidak berubah perilakunya.
// ============================================================
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type PenyediaAi = "gemini" | "claude" | "openai";

export const SEMUA_PENYEDIA: PenyediaAi[] = ["gemini", "claude", "openai"];

export const LABEL_PENYEDIA: Record<PenyediaAi, string> = {
  gemini: "Google Gemini",
  claude: "Anthropic Claude",
  openai: "OpenAI ChatGPT",
};

/**
 * Model bawaan tiap penyedia, bila kolom model di dashboard dikosongkan.
 *
 * Gemini memakai alias "-latest" supaya portal ikut naik ke model terbaru
 * tanpa perlu disentuh; alias itu juga yang dipakai contoh kunci pemiliknya.
 */
export const MODEL_BAWAAN: Record<PenyediaAi, string> = {
  gemini: process.env.CBT_MODEL_GEMINI || "gemini-flash-latest",
  claude: process.env.CBT_MODEL_CLAUDE || "claude-opus-5",
  openai: process.env.CBT_MODEL_OPENAI || "gpt-4o-mini",
};

/** Satu kunci, lengkap, hanya untuk dipakai di server. */
export type KunciAi = {
  id: string;
  penyedia: PenyediaAi;
  kunci: string;
  model: string;
  aktif: boolean;
  /** "dashboard" dapat diubah di layar; "environment" hanya dibaca. */
  asal: "dashboard" | "environment";
};

/** Bentuk yang aman dikirim ke peramban: tanpa kunci utuh. */
export type KunciTersamar = Omit<KunciAi, "kunci"> & { samaran: string };

const KUNCI_SETELAN = "ai_kunci";
const AWALAN_SANDI = "enc1:";

// ------------------------------------------------------------
// SANDI
// ------------------------------------------------------------

/**
 * Kunci sandi diturunkan dari rahasia server yang SUDAH ada.
 *
 * Tidak ada rahasia baru yang harus dipasang siapa pun: kunci layanan
 * Supabase, atau alamat basis data bila itu pun tidak ada. Keduanya hanya
 * hidup di environment server, tidak di basis data yang disandikan.
 */
function kunciSandi(): Buffer {
  const rahasia =
    process.env.AI_KUNCI_RAHASIA ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.DATABASE_URL ||
    "";
  return createHash("sha256").update(`sipaling-ai-kunci|${rahasia}`).digest();
}

export function sandikan(teks: string): string {
  const iv = randomBytes(12);
  const sandi = createCipheriv("aes-256-gcm", kunciSandi(), iv);
  const isi = Buffer.concat([sandi.update(teks, "utf8"), sandi.final()]);
  const tanda = sandi.getAuthTag();
  return AWALAN_SANDI + Buffer.concat([iv, tanda, isi]).toString("base64");
}

export function bukaSandi(teks: string): string | null {
  if (!teks.startsWith(AWALAN_SANDI)) return teks;
  try {
    const mentah = Buffer.from(teks.slice(AWALAN_SANDI.length), "base64");
    const iv = mentah.subarray(0, 12);
    const tanda = mentah.subarray(12, 28);
    const isi = mentah.subarray(28);
    const buka = createDecipheriv("aes-256-gcm", kunciSandi(), iv);
    buka.setAuthTag(tanda);
    return Buffer.concat([buka.update(isi), buka.final()]).toString("utf8");
  } catch {
    // Rahasia servernya berganti sejak kunci ini disimpan. Kuncinya tidak
    // dapat dipulihkan dan harus ditempel ulang — lebih baik daripada
    // menjalankan permintaan dengan kunci yang rusak.
    return null;
  }
}

/** "AQ.Contoh1234567…WXYZ" → "AQ.Con…WXYZ". */
export function samarkan(kunci: string): string {
  const k = kunci.trim();
  if (k.length <= 10) return "•".repeat(k.length);
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}

// ------------------------------------------------------------
// BACA & SIMPAN
// ------------------------------------------------------------

type BarisTersimpan = { id: string; penyedia: PenyediaAi; kunci: string; model: string; aktif: boolean };

function rapikanPenyedia(p: unknown): PenyediaAi | null {
  return SEMUA_PENYEDIA.includes(p as PenyediaAi) ? (p as PenyediaAi) : null;
}

/**
 * Tembolok singkat. Setiap permintaan AI membaca daftar ini, dan pemeriksaan
 * kamera berjalan beberapa kali per menit per peserta — satu perjalanan ke
 * basis data untuk masing-masing adalah beban yang tidak perlu. Tiga puluh
 * detik cukup pendek sehingga kunci yang baru ditempel segera terpakai.
 */
let tembolok: { waktu: number; daftar: KunciAi[] } | null = null;
const UMUR_TEMBOLOK = 30_000;

async function bacaTersimpan(): Promise<BarisTersimpan[]> {
  try {
    const baris = await db.select().from(appSettings).where(eq(appSettings.key, KUNCI_SETELAN)).limit(1);
    if (!baris[0]) return [];
    const mentah = JSON.parse(baris[0].value) as unknown;
    if (!Array.isArray(mentah)) return [];
    const hasil: BarisTersimpan[] = [];
    for (const m of mentah) {
      const r = m as Record<string, unknown>;
      const penyedia = rapikanPenyedia(r.penyedia);
      const kunci = bukaSandi(String(r.kunci ?? ""));
      if (!penyedia || !kunci) continue;
      hasil.push({
        id: String(r.id || randomBytes(6).toString("hex")),
        penyedia,
        kunci,
        model: String(r.model ?? "").trim().slice(0, 80),
        aktif: r.aktif !== false,
      });
    }
    return hasil;
  } catch {
    // Basis data belum tersambung atau tabelnya belum ada. Environment tetap
    // dibaca di bawah, jadi portal yang hanya memakai environment tidak ikut
    // mati.
    return [];
  }
}

function dariEnvironment(): KunciAi[] {
  const env: Array<[PenyediaAi, string | undefined]> = [
    ["gemini", process.env.GEMINI_API_KEY],
    ["claude", process.env.ANTHROPIC_API_KEY],
    ["openai", process.env.OPENAI_API_KEY],
  ];
  return env
    .filter(([, k]) => (k || "").trim() !== "")
    .map(([penyedia, k]) => ({
      id: `env-${penyedia}`,
      penyedia,
      kunci: (k || "").trim(),
      model: "",
      aktif: true,
      asal: "environment" as const,
    }));
}

/**
 * Seluruh kunci, urut: dari dashboard lebih dulu, environment di belakang.
 *
 * Kunci environment yang SAMA PERSIS dengan salah satu kunci dashboard tidak
 * dicantumkan dua kali — mencoba kunci yang sama dua kali hanya menggandakan
 * waktu tunggu ketika kunci itu ditolak.
 */
export async function daftarKunci(segar = false): Promise<KunciAi[]> {
  if (!segar && tembolok && Date.now() - tembolok.waktu < UMUR_TEMBOLOK) return tembolok.daftar;
  const tersimpan = (await bacaTersimpan()).map((b) => ({ ...b, asal: "dashboard" as const }));
  const sudah = new Set(tersimpan.map((b) => b.kunci));
  const daftar = [...tersimpan, ...dariEnvironment().filter((e) => !sudah.has(e.kunci))];
  tembolok = { waktu: Date.now(), daftar };
  return daftar;
}

/** Kunci yang siap dipakai, urut prioritas, dengan model yang sudah pasti. */
export async function kunciAktif(): Promise<Array<KunciAi & { model: string }>> {
  return (await daftarKunci())
    .filter((k) => k.aktif)
    .map((k) => ({ ...k, model: k.model || MODEL_BAWAAN[k.penyedia] }));
}

export async function daftarTersamar(): Promise<KunciTersamar[]> {
  return (await daftarKunci(true)).map(({ kunci, ...sisa }) => ({ ...sisa, samaran: samarkan(kunci) }));
}

/**
 * Simpan daftar dari dashboard.
 *
 * `kunci` kosong berarti "tidak diubah": kunci lama dengan id yang sama
 * dipertahankan. Itulah yang membuat kunci utuh tidak pernah perlu dikirim
 * balik ke peramban.
 */
export async function simpanDaftar(
  masuk: Array<{ id?: string; penyedia: string; kunci?: string; model?: string; aktif?: boolean }>,
): Promise<void> {
  const lama = new Map((await bacaTersimpan()).map((b) => [b.id, b]));
  const baru: BarisTersimpan[] = [];

  for (const m of masuk.slice(0, 12)) {
    const penyedia = rapikanPenyedia(m.penyedia);
    if (!penyedia) continue;
    const id = String(m.id || "").startsWith("env-") ? "" : String(m.id || "");
    const kunciBaru = String(m.kunci ?? "").trim();
    const kunci = kunciBaru || (id ? lama.get(id)?.kunci ?? "" : "");
    if (!kunci) continue;
    baru.push({
      id: id || randomBytes(6).toString("hex"),
      penyedia,
      kunci,
      model: String(m.model ?? "").trim().slice(0, 80),
      aktif: m.aktif !== false,
    });
  }

  const nilai = JSON.stringify(baru.map((b) => ({ ...b, kunci: sandikan(b.kunci) })));
  await db
    .insert(appSettings)
    .values({ key: KUNCI_SETELAN, value: nilai, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: nilai, updatedAt: new Date() } });
  tembolok = null;
}
