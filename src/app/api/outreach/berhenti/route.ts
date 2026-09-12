// BERHENTI LANGGANAN — alamat yang tertulis pada kepala List-Unsubscribe.
//
// Dua metode, dan bedanya penting:
//
//   POST — "satu ketukan" menurut RFC 8058. Inilah yang dipanggil Gmail dan
//          Outlook ketika penerima menekan tombol "Berhenti berlangganan" di
//          baris atas kotak masuknya. Langsung dikerjakan, tanpa halaman
//          konfirmasi — memang itu janjinya kepada penerima.
//
//   GET  — untuk klien surat lama yang membuka alamatnya di peramban. TIDAK
//          mengubah apa pun, hanya mengantar ke halaman konfirmasi. Pemindai
//          tautan dan pramuat peramban mengetuk alamat ini tanpa diminta;
//          kalau GET langsung memberhentikan, orang akan keluar dari daftar
//          tanpa pernah menekan apa pun.
//
// Jalur ini terdaftar pada TANPA_ORIGIN di middleware: yang mengetuk adalah
// server penyedia surat, bukan peramban, dan ia tidak pernah mengirim Origin.
// Wewenangnya datang dari token acak di dalam alamatnya sendiri.

import { berhentiLangganan } from "@/lib/outreach-store";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function token(request: Request) {
  return new URL(request.url).searchParams.get("t") || "";
}

export async function GET(request: Request) {
  const t = token(request);
  const tujuan = new URL(`/email/berhenti${t ? `?t=${encodeURIComponent(t)}` : ""}`, request.url);
  return Response.redirect(tujuan, 303);
}

export async function POST(request: Request) {
  // Token acak sepanjang 32 huruf tidak dapat ditebak dengan menebak, tetapi
  // pembatas laju tetap dipasang: tanpanya, alamat ini adalah tempat yang
  // nyaman untuk mencoba token secara membabi buta sambil membebani basis
  // data.
  const batas = rateLimit({ request, name: "outreach-berhenti", limit: 30, windowMs: 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    await berhentiLangganan(token(request), "satu ketukan");
    // Jawaban yang SAMA untuk token sah maupun tidak. Jawaban yang berbeda
    // mengubah alamat ini menjadi cara memastikan apakah sebuah token — dan
    // karenanya sebuah alamat — ada di dalam sistem.
    return new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (galat) {
    console.error("berhenti langganan outreach", galat);
    // Tetap 200. Penyedia surat yang menerima galat akan mengetuk berulang
    // kali, dan penerima yang sudah menekan tombolnya tidak perlu tahu bahwa
    // ada yang bermasalah di pihak kita — yang perlu, ia tidak dikirimi lagi.
    return new Response("OK", { status: 200 });
  }
}
