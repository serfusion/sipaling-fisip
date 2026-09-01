// Membuat buku kas baru, membacanya, dan mengganti namanya.
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { bukuDariPermintaan, tolak } from "@/lib/uang/gerbang";
import { buatBuku, gantiNamaBuku, hitungIsi, kanalBuku, tren } from "@/lib/uang/simpan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Buku baru. Kodenya hanya diperlihatkan di sini dan tidak dapat dipulihkan. */
export async function POST(request: Request) {
  // Batasnya ketat: jalur ini tidak memerlukan akun, jadi tanpa batas ia
  // menjadi pintu paling mudah untuk membanjiri tabel dengan buku kosong.
  const batas = rateLimit({ request, name: "uang-buku-baru", limit: 5, windowMs: 60 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const badan = (await request.json().catch(() => ({}))) as { nama?: unknown };
    const buku = await buatBuku(badan?.nama);
    return Response.json({
      success: true,
      buku: { kode: buku.code, nama: buku.name, dibuat: buku.createdAt },
    });
  } catch (error) {
    console.error("buat buku uang", error);
    return tolak(explainServerError(error, "Buku gagal dibuat. Coba lagi sebentar."), 500);
  }
}

/** Keterangan satu buku: namanya, isinya, kanal yang tersambung, dan trennya. */
export async function GET(request: Request) {
  const gerbang = await bukuDariPermintaan(request);
  if (!gerbang.ok) return gerbang.jawab;

  try {
    const [isi, kanal, titik] = await Promise.all([
      hitungIsi(gerbang.buku.id),
      kanalBuku(gerbang.buku.id),
      tren(gerbang.buku.id, 6),
    ]);
    return Response.json({
      success: true,
      buku: { kode: gerbang.buku.code, nama: gerbang.buku.name, dibuat: gerbang.buku.createdAt },
      isi,
      kanal,
      tren: titik,
    });
  } catch (error) {
    console.error("baca buku uang", error);
    return tolak(explainServerError(error, "Buku gagal dibaca."), 500);
  }
}

export async function PATCH(request: Request) {
  const badan = (await request.json().catch(() => ({}))) as { kode?: unknown; nama?: unknown };
  const gerbang = await bukuDariPermintaan(request, badan);
  if (!gerbang.ok) return gerbang.jawab;

  try {
    const nama = await gantiNamaBuku(gerbang.buku.id, badan?.nama);
    return Response.json({ success: true, nama });
  } catch (error) {
    console.error("ganti nama buku uang", error);
    return tolak(explainServerError(error, "Nama buku gagal disimpan."), 500);
  }
}
