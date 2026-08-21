import { NextResponse, type NextRequest } from "next/server";

// PERLINDUNGAN CSRF UNTUK SELURUH API
//
// Sesi login disimpan pada cookie, sehingga peramban ikut mengirimkannya
// walaupun permintaan dipicu dari situs lain. Karena itu setiap permintaan
// yang MENGUBAH data wajib membuktikan bahwa ia berasal dari domain kita
// sendiri, dengan membandingkan header Origin terhadap host permintaan.
//
// Peramban selalu mengirim Origin pada POST/PUT/PATCH/DELETE, jadi
// permintaan tanpa Origin yang sah ditolak. Metode aman (GET/HEAD) tidak
// diperiksa karena tidak mengubah apa pun.

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Diisi bila ada domain lain yang sah, mis. "https://sipalingfisip.web.id".
// Pisahkan dengan koma pada environment variable ALLOWED_ORIGINS.
function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function hostOf(value: string) {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return "";
  }
}

export function middleware(request: NextRequest) {
  if (!MUTATING.has(request.method)) return NextResponse.next();

  const origin = request.headers.get("origin") || "";
  const requestHost = (request.headers.get("host") || "").toLowerCase();
  const originHost = hostOf(origin);

  const sameSite = Boolean(originHost) && originHost === requestHost;
  const whitelisted = allowedOrigins().some((entry) => hostOf(entry) === originHost && Boolean(originHost));

  if (!sameSite && !whitelisted) {
    return NextResponse.json(
      {
        success: false,
        message: "Permintaan ditolak: asal permintaan tidak dikenali. Muat ulang halaman lalu coba lagi.",
      },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  // Hanya route API yang diperiksa; aset statis dilewati agar tetap cepat.
  matcher: ["/api/:path*"],
};
