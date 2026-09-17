// ============================================================
// IZIN UNGGAH SATU BAGIAN PENYERAHAN SKRIPSI
//
// Peramban menyebut bagian mana, nama berkasnya, dan ukurannya. Server
// menjawab dengan satu URL unggah bertanda tangan yang HANYA berlaku untuk
// satu jalur yang ia tentukan sendiri.
//
// Alasan endpoint ini ada sama sekali dijelaskan di src/lib/unggah-langsung.ts:
// empat PDF penyerahan tidak akan pernah muat di badan permintaan fungsi
// serverless, yang dipotong Vercel pada 4,5 MB.
//
// Yang diperiksa di sini hanya yang dapat diperiksa dari keterangan: bagian
// yang dikenal, nama berakhiran .pdf, ukuran masih di dalam batas. Isinya
// sendiri baru dapat diperiksa sesudah berkasnya mendarat, dan itu dikerjakan
// /api/requests maupun /api/revisions lewat periksaObjekPdf.
// ============================================================
import { DOCUMENT_BUCKET, buatIzinUnggah } from "@/lib/document-storage";
import { BAGIAN_PENYERAHAN, batasBagianMb, periksaBerkasBagian } from "@/lib/bukti-penyerahan";
import { isFolderTransit, jalurTransit, type IzinUnggah } from "@/lib/unggah-langsung";
import { izinkanJalur } from "@/lib/unggah-tanda";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { blockedByMaintenance } from "@/lib/maintenance-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Satu penyerahan meminta empat izin, dan mahasiswa yang salah pilih berkas
// akan mengulangnya. Batasnya karena itu jauh lebih longgar daripada batas
// pengiriman formulir (8 per 10 menit) — kalau disamakan, percobaan kedua
// sudah tertolak sebelum formulirnya sempat dikirim sekali pun.
const BATAS = 80;

export async function POST(request: Request) {
  const limit = rateLimit({ request, name: "unggah-izin", limit: BATAS, windowMs: 10 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const closed = await blockedByMaintenance();
  if (closed) return closed;

  try {
    const isi = (await request.json().catch(() => null)) as {
      folder?: unknown;
      bagian?: unknown;
      nama?: unknown;
      ukuran?: unknown;
    } | null;

    const folder = typeof isi?.folder === "string" ? isi.folder : "";
    const bagianId = typeof isi?.bagian === "string" ? isi.bagian : "";
    const nama = typeof isi?.nama === "string" ? isi.nama.slice(0, 200) : "";
    const ukuran = Number(isi?.ukuran);

    if (!isFolderTransit(folder)) {
      return Response.json({ success: false, message: "Tujuan unggahan tidak dikenali." }, { status: 400 });
    }
    const bagian = BAGIAN_PENYERAHAN.find((b) => b.id === bagianId);
    if (!bagian) {
      return Response.json({ success: false, message: "Bagian berkas tidak dikenali." }, { status: 400 });
    }
    if (!Number.isFinite(ukuran) || ukuran <= 0) {
      return Response.json({ success: false, message: "Ukuran berkas tidak terbaca." }, { status: 400 });
    }

    // Aturan yang sama persis dengan yang dipakai peramban dan yang dipakai
    // lagi saat formulirnya masuk. Satu pemeriksa, tiga tempat.
    const cek = periksaBerkasBagian(bagian.id, { name: nama, size: ukuran });
    if (!cek.ok) {
      return Response.json({ success: false, message: cek.pesan }, { status: 400 });
    }

    const jalur = jalurTransit(folder, bagian.id, nama);
    const unggah = await buatIzinUnggah(jalur);
    const { tanda, kedaluwarsa } = izinkanJalur(jalur);

    const izin: IzinUnggah = {
      jalur,
      bucket: DOCUMENT_BUCKET,
      url: unggah.url,
      token: unggah.token,
      tanda,
      kedaluwarsa,
    };
    return Response.json({ success: true, izin, maksMb: batasBagianMb(bagian.id) });
  } catch (error: unknown) {
    console.error("izin unggah bagian", error);
    // 503, bukan 500: peramban membaca kode ini sebagai "unggahan langsung
    // sedang tidak tersedia" lalu berpindah ke jalur cadangan, alih-alih
    // menggagalkan pengisian yang sudah terlanjur diketik mahasiswa.
    return Response.json(
      { success: false, message: explainServerError(error, "Izin unggah belum dapat dibuat.") },
      { status: 503 },
    );
  }
}
