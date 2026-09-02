// ============================================================
// GERBANG BUKU KAS
//
// Satu-satunya kunci catatan uang adalah kode bukunya, jadi di sinilah
// seluruh pemeriksaannya dikumpulkan: bentuk kodenya benar, bukunya ada, dan
// yang salah menebak kode dibatasi lajunya.
// ============================================================
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { normalisasiKode } from "./buku";
import { bukuDariKode, type Buku } from "./simpan";

export type Gerbang = { ok: true; buku: Buku } | { ok: false; jawab: Response };

/**
 * Mengambil buku yang dimaksud sebuah permintaan.
 *
 * Kodenya boleh datang dari tiga tempat: badan JSON (dipakai POST), header
 * X-Kode-Buku (dipakai otomasi), atau parameter ?kode= (dipakai GET). Yang
 * dibaca pertama kali yang ada.
 *
 * KENAPA PENEBAK KODE DIBATASI TERPISAH: buku tidak punya kata sandi, jadi
 * satu-satunya serangan yang masuk akal adalah mencoba kode satu per satu.
 * Penghitungnya hanya bertambah ketika tebakannya SALAH, supaya pemakaian
 * yang wajar tidak pernah ikut tertahan.
 */
export async function bukuDariPermintaan(
  request: Request,
  badan?: { kode?: unknown } | null,
): Promise<Gerbang> {
  const dariHeader = request.headers.get("x-kode-buku");
  let dariUrl: string | null = null;
  try {
    dariUrl = new URL(request.url).searchParams.get("kode");
  } catch {
    dariUrl = null;
  }

  const kode = normalisasiKode(badan?.kode ?? dariHeader ?? dariUrl);
  if (!kode) return { ok: false, jawab: tolak("Kode buku tidak dikenali. Periksa lagi salinannya.", 401) };

  const buku = await bukuDariKode(kode);
  if (!buku) {
    const batas = rateLimit({ request, name: "uang-kode-salah", limit: 20, windowMs: 10 * 60_000 });
    if (!batas.ok) return { ok: false, jawab: tooManyRequests(batas.retryAfter) };
    return { ok: false, jawab: tolak("Buku dengan kode itu tidak ada.", 404) };
  }
  return { ok: true, buku };
}

export function tolak(pesan: string, status: number) {
  return Response.json({ success: false, message: pesan }, { status });
}

/** Bulan yang diminta, "YYYY-MM". Bentuk yang aneh dikembalikan sebagai null. */
export function bulanDari(teks: unknown): string | null {
  const rapi = String(teks ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(rapi)) return null;
  const nomor = Number(rapi.slice(5));
  if (nomor < 1 || nomor > 12) return null;
  return rapi;
}
