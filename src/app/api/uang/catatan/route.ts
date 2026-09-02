// Isi satu bulan beserta ringkasannya, dan penghapusan satu baris.
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { bukuDariPermintaan, bulanDari, tolak } from "@/lib/uang/gerbang";
import { hapusCatatan, isiBulan, ringkas, tanggalWib, tren } from "@/lib/uang/simpan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const batas = rateLimit({ request, name: "uang-baca", limit: 120, windowMs: 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  const gerbang = await bukuDariPermintaan(request);
  if (!gerbang.ok) return gerbang.jawab;

  const alamat = new URL(request.url);
  const bulan = bulanDari(alamat.searchParams.get("bulan")) ?? tanggalWib().slice(0, 7);

  try {
    const [baris, titik] = await Promise.all([
      isiBulan(gerbang.buku.id, bulan),
      tren(gerbang.buku.id, 6),
    ]);
    return Response.json({
      success: true,
      buku: { kode: gerbang.buku.code, nama: gerbang.buku.name },
      bulan,
      hariIni: tanggalWib(),
      baris: baris.map((b) => ({
        id: b.id,
        arah: b.direction,
        nominal: Number(b.amount),
        catatan: b.note,
        kategori: b.category,
        tanggal: b.entryDate,
        sumber: b.source,
        dibuat: b.createdAt,
      })),
      ringkasan: ringkas(bulan, baris),
      tren: titik,
    });
  } catch (error) {
    console.error("baca catatan uang", error);
    return tolak(explainServerError(error, "Catatan gagal dibaca."), 500);
  }
}

export async function DELETE(request: Request) {
  const batas = rateLimit({ request, name: "uang-hapus", limit: 60, windowMs: 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  const gerbang = await bukuDariPermintaan(request);
  if (!gerbang.ok) return gerbang.jawab;

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return tolak("Nomor catatan tidak sah.", 400);

  try {
    // Nomor buku ikut menjadi syarat penghapusan, jadi kode buku A tidak
    // pernah dapat menghapus baris milik buku B walaupun nomornya ditebak.
    const jadi = await hapusCatatan(gerbang.buku.id, id);
    if (!jadi) return tolak("Catatan itu tidak ada di buku ini.", 404);
    return Response.json({ success: true });
  } catch (error) {
    console.error("hapus catatan uang", error);
    return tolak(explainServerError(error, "Catatan gagal dihapus."), 500);
  }
}
