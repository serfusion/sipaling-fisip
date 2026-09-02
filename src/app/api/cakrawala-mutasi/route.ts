// ============================================================
// JEMBATAN PEMBERITAHUAN DANA → PESANAN CAKRAWALA
//
// Masalah yang diselesaikan: DANA tidak memberi tahu situs mana pun ketika
// uang masuk. Gerbang pembayaran melakukannya, tetapi berbayar bulanan, dan
// pemiliknya memilih tidak.
//
// Yang tersisa gratis hanyalah ini: ponsel pemiliknya SUDAH menerima
// pemberitahuan "Kamu menerima Rp25.037" dari aplikasi DANA. Sebuah aplikasi
// penerus pemberitahuan di ponsel itu meneruskannya ke alamat ini, nominalnya
// dicocokkan dengan pesanan yang sedang menunggu, dan kodenya terbit sendiri
// dalam hitungan detik — persis seperti gerbang pembayaran, tanpa biaya.
//
// Jalur ini TIDUR tanpa CAKRAWALA_MUTASI_SECRET, dan diam pula: yang tidak
// membawa kunci menerima 404, bukan "kunci salah". Alamat yang mengaku ada
// dan sedang menunggu kunci adalah undangan untuk dicoba-coba.
// ============================================================
import { timingSafeEqual } from "node:crypto";
import { bacaMutasi, teksDariMuatan } from "@/lib/mutasi";
import { paketDari } from "@/lib/paket-cakrawala";
import { lunaskanPesanan, pesananUntukNominal } from "@/lib/pesanan-store";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { uraiBadan } from "@/lib/uang/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bandingkan kunci tanpa membocorkan panjang kecocokannya. */
function kunciCocok(kirim: string, benar: string) {
  const a = Buffer.from(kirim, "utf8");
  const b = Buffer.from(benar, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const kunci = (process.env.CAKRAWALA_MUTASI_SECRET || "").trim();
  if (!kunci) {
    return Response.json({ success: false, message: "Tidak tersedia." }, { status: 404 });
  }

  // Ponsel yang meneruskan pemberitahuan tidak pernah mengirim lebih dari
  // beberapa puluh kali sejam. Yang melampauinya sedang mencoba menebak.
  const batas = rateLimit({ request, name: "cakrawala-mutasi", limit: 90, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  let mentah = "";
  try {
    mentah = await request.text();
  } catch {
    return Response.json({ success: false, message: "Badan permintaan tidak terbaca." }, { status: 400 });
  }
  if (mentah.length > 8_000) {
    return Response.json({ success: false, message: "Permintaan terlalu besar." }, { status: 413 });
  }

  const badan = uraiBadan(request.headers.get("content-type") || "", mentah);

  // Kunci boleh datang lewat header — itu yang dianjurkan — atau lewat kolom
  // di badannya, karena sebagian aplikasi penerus pemberitahuan tidak dapat
  // menyetel header sendiri. Yang TIDAK diterima: kunci pada alamat URL,
  // sebab alamat ikut tercatat di log server dan proxy.
  const kirim =
    request.headers.get("x-cakrawala-kunci") ||
    request.headers.get("x-api-key") ||
    (badan && typeof badan.kunci === "string" ? badan.kunci : "") ||
    "";
  if (!kirim || !kunciCocok(kirim, kunci)) {
    return Response.json({ success: false, message: "Tidak tersedia." }, { status: 404 });
  }

  const teks = teksDariMuatan(badan ?? mentah) || mentah;
  const mutasi = bacaMutasi(teks);
  if (!mutasi) {
    return Response.json({ success: true, dikerjakan: false, alasan: "tanpa nominal" });
  }

  // Nominal boleh dikirim langsung oleh penerus yang memang mengetahuinya.
  // Yang dikirim menang atas hasil pembacaan kalimat, karena angka yang sudah
  // pasti lebih dapat dipercaya daripada tebakan atas kalimat bebas.
  const nominalKirim = Number(badan?.nominal);
  const nominal = Number.isInteger(nominalKirim) && nominalKirim > 0 ? nominalKirim : mutasi.nominal;

  // Uang KELUAR yang nominalnya kebetulan sama tidak boleh menerbitkan kode.
  // Penerus yang sudah menyaring sendiri boleh menyatakannya lewat arah:"masuk".
  const arah = String(badan?.arah ?? "").toLowerCase();
  if (!mutasi.masuk && arah !== "masuk") {
    return Response.json({ success: true, dikerjakan: false, alasan: "bukan uang masuk" });
  }

  try {
    const pesanan = await pesananUntukNominal(nominal);
    if (!pesanan) {
      // Bukan galat. Pemilik nomor DANA yang sama juga menerima uang untuk
      // hal-hal lain, dan itu memang bukan urusan Cakrawala.
      console.warn("mutasi tanpa pesanan yang cocok:", nominal);
      return Response.json({ success: true, dikerjakan: false, alasan: "tidak ada pesanan dengan nominal itu" });
    }
    if (pesanan.status === "batal") {
      return Response.json({ success: true, dikerjakan: false, alasan: "pesanan sudah dibatalkan" });
    }

    const paket = paketDari(pesanan.packageId);
    if (!paket) {
      console.error("paket pesanan tidak dikenali:", pesanan.packageId);
      return Response.json({ success: false, message: "Paket pesanan tidak dikenali." }, { status: 500 });
    }

    // lunaskanPesanan SELALU aman diulang: pesanan yang sudah lunas
    // mengembalikan kode yang sama. Aplikasi penerus pemberitahuan sering
    // mengirim ulang kiriman yang sama, dan satu pembayaran tidak boleh
    // berubah menjadi dua kode.
    const hasil = await lunaskanPesanan(pesanan.orderCode, "dana-mutasi", paket);
    if (!hasil.ok) {
      return Response.json({ success: false, message: hasil.pesan }, { status: 409 });
    }
    return Response.json({
      success: true,
      dikerjakan: hasil.baru,
      pesanan: pesanan.orderCode,
      nominal,
    });
  } catch (error) {
    console.error("mutasi cakrawala", error);
    return Response.json({ success: false, message: "Mutasi belum dapat diproses." }, { status: 500 });
  }
}
