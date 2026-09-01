import { createHmac, timingSafeEqual } from "node:crypto";
import { paketDari, rapikanNomorPesanan } from "@/lib/paket-cakrawala";
import { ambilPesanan, lunaskanPesanan } from "@/lib/pesanan-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SAMBUNGAN GERBANG PEMBAYARAN
//
// Selama pembayaran masih ditandai lunas dengan tangan lewat panel, jalur ini
// TIDUR: tanpa CAKRAWALA_WEBHOOK_SECRET ia menolak semuanya. Ia disiapkan
// sekarang supaya berpindah ke gerbang pembayaran nanti tinggal memasang
// kunci, bukan membangun ulang alur pesanannya.
//
// Yang diharapkan: POST berisi JSON { pesanan, nominal, status } beserta
// tanda tangan HMAC-SHA256 atas seluruh badannya pada header
// X-Cakrawala-Signature. Hampir semua gerbang pembayaran Indonesia dapat
// disetel mengirim bentuk seperti ini; yang berbeda hanya nama headernya.

/**
 * Bandingkan tanda tangan tanpa membocorkan panjang kecocokannya.
 *
 * Perbandingan biasa berhenti pada huruf pertama yang berbeda, dan selisih
 * waktunya cukup untuk menebak tanda tangan huruf demi huruf.
 */
function tandaCocok(kirim: string, hitung: string) {
  const a = Buffer.from(kirim, "utf8");
  const b = Buffer.from(hitung, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const kunci = (process.env.CAKRAWALA_WEBHOOK_SECRET || "").trim();
  if (!kunci) {
    // Sengaja tidak menyebut "belum disetel". Jalur yang tidur tidak perlu
    // memberi tahu siapa pun bahwa ia ada dan sedang menunggu kunci.
    return Response.json({ success: false, message: "Tidak tersedia." }, { status: 404 });
  }

  let mentah = "";
  try {
    mentah = await request.text();
  } catch {
    return Response.json({ success: false, message: "Badan permintaan tidak terbaca." }, { status: 400 });
  }
  // Batas ukuran: badan yang sangat besar tidak mungkin datang dari gerbang
  // pembayaran, dan menghitung HMAC atasnya hanya membuang waktu server.
  if (mentah.length > 16_000) {
    return Response.json({ success: false, message: "Permintaan terlalu besar." }, { status: 413 });
  }

  const kirim = request.headers.get("x-cakrawala-signature") || "";
  const hitung = createHmac("sha256", kunci).update(mentah).digest("hex");
  if (!kirim || !tandaCocok(kirim, hitung)) {
    return Response.json({ success: false, message: "Tanda tangan tidak sah." }, { status: 401 });
  }

  let muatan: { pesanan?: unknown; nominal?: unknown; status?: unknown; lewat?: unknown };
  try {
    muatan = JSON.parse(mentah) as typeof muatan;
  } catch {
    return Response.json({ success: false, message: "Muatan bukan JSON." }, { status: 400 });
  }

  const nomor = rapikanNomorPesanan(muatan.pesanan);
  if (!nomor) return Response.json({ success: false, message: "Nomor pesanan kosong." }, { status: 400 });

  // Hanya pemberitahuan "lunas" yang dikerjakan. Sisanya diterima dengan
  // sopan supaya gerbangnya berhenti mengirim ulang, tetapi tidak mengubah
  // apa pun.
  const status = String(muatan.status ?? "").toLowerCase();
  if (!["lunas", "paid", "settlement", "success", "berhasil"].includes(status)) {
    return Response.json({ success: true, pesan: "Diterima, tidak ada yang perlu dikerjakan." });
  }

  const pesanan = await ambilPesanan(nomor);
  if (!pesanan) return Response.json({ success: false, message: "Pesanan tidak ditemukan." }, { status: 404 });

  // Nominalnya wajib sama persis. Tanpa pemeriksaan ini, pemberitahuan yang
  // sah untuk pembayaran 10.001 dapat membuka paket seharga 60.001.
  const nominal = Number(muatan.nominal);
  if (Number.isFinite(nominal) && Math.round(nominal) !== pesanan.amount) {
    console.error(`webhook nominal tidak cocok: ${nominal} vs ${pesanan.amount} pada ${nomor}`);
    return Response.json({ success: false, message: "Nominal tidak cocok." }, { status: 400 });
  }

  const paket = paketDari(pesanan.packageId);
  if (!paket) return Response.json({ success: false, message: "Paket sudah tidak ada." }, { status: 400 });

  const lewat = typeof muatan.lewat === "string" ? muatan.lewat.slice(0, 40) : "webhook";
  const hasil = await lunaskanPesanan(nomor, lewat, paket);
  if (!hasil.ok) return Response.json({ success: false, message: hasil.pesan }, { status: 500 });

  // Pengiriman ulang atas pesanan yang sama menerima jawaban yang sama, dan
  // tetap satu kode. Gerbang pembayaran memang mengulang kiriman ketika
  // balasannya tidak sampai.
  return Response.json({ success: true, kode: hasil.accessCode, baru: hasil.baru });
}
