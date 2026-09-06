import { NextResponse, type NextRequest } from "next/server";
import { rencanaRute } from "@/lib/situs-cbt";

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

// ============================================================
// DUA SITUS, SATU PENYEBARAN
//
// CBT sudah pindah ke subdomainnya sendiri. Sejak itu tuan rumah pada
// permintaanlah yang menentukan situs mana yang dilayani, dan seluruh
// aturannya tinggal di src/lib/situs-cbt.ts — sebagai fungsi murni yang
// dapat diuji tanpa menyalakan server. Yang tersisa di sini hanyalah
// menerjemahkan rencananya menjadi jawaban HTTP.
//
// Pengalihannya SEMENTARA (307), bukan permanen. Pengalihan permanen
// mengendap di peramban mahasiswa sampai cache-nya dibuang, dan bila nama
// subdomainnya ternyata perlu dikoreksi, yang mengendap itu tidak dapat
// ditarik kembali di tengah musim ujian.
// ============================================================

function antarKeSitusnya(request: NextRequest): NextResponse | null {
  const rencana = rencanaRute(request.headers.get("host"), request.nextUrl.pathname);
  if (rencana.tindakan === "lewat") return null;

  const alamat = request.nextUrl.clone();
  alamat.pathname = rencana.pathname;

  if (rencana.tindakan === "tulis-ulang") return NextResponse.rewrite(alamat);

  if (rencana.host) {
    // Pindah tuan rumah. Subdomain sungguhan selalu dilayani lewat HTTPS, dan
    // porta dibuang supaya alamat yang terkirim bersih.
    alamat.protocol = "https:";
    alamat.host = rencana.host;
    alamat.port = "";
  } else {
    // Tetap di tuan rumah yang sama — hanya jalurnya yang dirapikan.
    //
    // Tuan rumahnya diambil dari header Host, BUKAN dari alamat internal
    // permintaan. Di balik Vercel keduanya berbeda: yang internal menunjuk
    // ke mesin yang melayani, dan mengirimkannya sebagai pengalihan berarti
    // menyuruh peramban mahasiswa membuka alamat yang tidak dapat ia capai.
    const tuanRumah = (request.headers.get("host") || "").split(",")[0].trim();
    if (tuanRumah) {
      alamat.host = tuanRumah;
      // Menyetel host tanpa porta TIDAK menghapus porta yang sudah ada, dan
      // porta internal yang ikut terbawa akan menjadi alamat yang tidak
      // dapat dibuka dari luar. Yang dipakai porta dari header Host saja.
      if (!tuanRumah.includes(":")) alamat.port = "";
    }

    const maju = (request.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
    if (maju) alamat.protocol = `${maju}:`;
  }
  return NextResponse.redirect(alamat, 307);
}

export function middleware(request: NextRequest) {
  const keSitusnya = antarKeSitusnya(request);
  if (keSitusnya) return keSitusnya;

  // Perlindungan CSRF tetap HANYA untuk /api, sama seperti sebelum daftar
  // jalurnya diperluas demi subdomain CBT. Memperluasnya diam-diam ke seluruh
  // halaman akan mengubah perilaku jalur yang tidak sedang dikerjakan sama
  // sekali — dan perubahan seperti itu baru ketahuan dari laporan pengguna.
  if (!request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

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
  // Dua tugas sekaligus di sini, dan cakupannya berbeda:
  //   - perlindungan CSRF hanya menyentuh /api
  //   - penulisan ulang subdomain CBT harus menyentuh HALAMAN, bukan API
  //
  // Karena itu daftarnya diperluas ke seluruh jalur, dengan aset statis
  // dikecualikan lewat pola negatif supaya gambar dan berkas Next.js tidak
  // ikut melewati middleware pada tiap permintaan.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf)$).*)"],
};
