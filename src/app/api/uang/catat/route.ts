// SATU PINTU MASUK untuk semua catatan uang.
//
// Halaman web memakainya lewat kotak tulis, Telegram memakainya lewat
// webhook, dan otomasi apa pun (Shortcut iOS, Tasker, gerbang WhatsApp)
// tinggal mengirim POST yang sama:
//
//   POST /api/uang/catat
//   { "kode": "UNG-XXXX-XXXX-XXXX", "pesan": "-beli nasi uduk 10k" }
//
// Kodenya boleh dikirim lewat header X-Kode-Buku bila muatannya ingin berisi
// pesannya saja.
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { bukuDariPermintaan, tolak } from "@/lib/uang/gerbang";
import { kategoriDari } from "@/lib/uang/kategori";
import { catatPesan } from "@/lib/uang/simpan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "uang-catat", limit: 60, windowMs: 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  const badan = (await request.json().catch(() => null)) as
    | { kode?: unknown; pesan?: unknown; sumber?: unknown }
    | null;
  if (!badan) return tolak("Muatan bukan JSON.", 400);

  const pesan = String(badan.pesan ?? "").slice(0, 4_000);
  if (!pesan.trim()) return tolak("Pesannya kosong.", 400);

  const gerbang = await bukuDariPermintaan(request, badan);
  if (!gerbang.ok) return gerbang.jawab;

  try {
    const hasil = await catatPesan({
      bookId: gerbang.buku.id,
      pesan,
      // Sumber ditulis pemanggilnya, tetapi hanya sebagai label. Ia tidak
      // pernah menentukan apa pun selain isi kolom catatan.
      sumber: String(badan.sumber ?? "web").slice(0, 20),
    });

    return Response.json({
      success: hasil.tersimpan.length > 0,
      tersimpan: hasil.tersimpan.map(({ baris, hasil: urai }) => ({
        id: baris.id,
        arah: baris.direction,
        nominal: Number(baris.amount),
        catatan: baris.note,
        kategori: baris.category,
        namaKategori: kategoriDari(baris.category).nama,
        ikon: kategoriDari(baris.category).ikon,
        tanggal: baris.entryDate,
        pesan: urai.catatanTambahan,
      })),
      gagal: hasil.gagal,
    });
  } catch (error) {
    console.error("catat uang", error);
    return tolak(explainServerError(error, "Catatan gagal disimpan."), 500);
  }
}
