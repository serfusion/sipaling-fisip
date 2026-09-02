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

// JALUR YANG SENGAJA DILEWATKAN
//
// Perlindungan di berkas ini berdiri di atas satu asumsi: yang memberi
// wewenang adalah cookie, dan cookie dikirim peramban secara otomatis, juga
// ketika permintaannya dipicu situs lain.
//
// Asumsi itu TIDAK berlaku untuk webhook. Yang mengetuk bukan peramban
// melainkan server lain (Telegram, Meta, gerbang WhatsApp, gerbang
// pembayaran); ia tidak pernah mengirim Origin, dan wewenangnya datang dari
// tanda tangan atau kata sandi di dalam permintaannya sendiri. Tanpa daftar
// ini, seluruh jalur pesan masuk menjawab 403 dan tidak ada satu pun catatan
// yang pernah sampai.
//
// Menambah jalur baru ke daftar ini hanya sah bila DUA-DUANYA benar:
//   1. jalur itu memeriksa kuncinya sendiri, dan
//   2. jalur itu tidak pernah mengambil wewenang dari cookie.
//
// Yang tidak boleh masuk sini, sebagai contoh, adalah /api/uang/buku/cakrawala:
// ia membaca cookie akses Cakrawala, jadi ia justru jenis jalur yang
// perlindungan ini dibuat untuknya.
const TANPA_ORIGIN = [
  "/api/cakrawala-webhook", // tanda tangan HMAC dari gerbang pembayaran
  "/api/cakrawala-mutasi", // kunci CAKRAWALA_MUTASI_SECRET, dari ponsel pemilik
  "/api/uang/telegram", // secret_token yang dipasang saat mendaftarkan webhook
  "/api/uang/whatsapp", // tanda tangan Meta, atau kata sandi gerbang
  "/api/uang/catat", // kode buku di dalam badan permintaan, dan itu bukan cookie
];

/**
 * Apakah jalur ini memeriksa kuncinya sendiri?
 *
 * Dicocokkan persis atau sebagai ruas penuh, BUKAN sekadar awalan huruf.
 * "/api/uang/catatan" berawalan sama dengan "/api/uang/catat", dan ia
 * penghapus catatan yang tidak boleh ikut terbuka.
 */
function memeriksaSendiri(path: string) {
  return TANPA_ORIGIN.some((jalur) => path === jalur || path.startsWith(`${jalur}/`));
}

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
  if (memeriksaSendiri(request.nextUrl.pathname)) return NextResponse.next();

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
