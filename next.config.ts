import type { NextConfig } from "next";

// Origin Supabase diambil dari environment agar CSP-nya setepat mungkin.
// Bila belum diatur saat build, dipakai pola wildcard supaya situs tetap
// berfungsi (mis. pada preview yang belum lengkap env-nya).
function supabaseOrigins() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  try {
    const { origin, host } = new URL(raw);
    return { http: origin, ws: `wss://${host}` };
  } catch {
    return { http: "https://*.supabase.co https://*.supabase.com", ws: "wss://*.supabase.co wss://*.supabase.com" };
  }
}

const supabase = supabaseOrigins();

// Content Security Policy.
//
// Catatan jujur soal 'unsafe-inline' pada script-src: Next.js menyisipkan
// skrip hidrasi inline, dan jendela cetak (laporan antrean, surat tugas,
// pratinjau surat) juga memakai skrip inline. Menghapusnya memerlukan CSP
// berbasis nonce yang belum dapat diterapkan pada jendela about:blank hasil
// window.open. Lapisan lain tetap ditegakkan: 'object-src none', 'base-uri
// self', 'frame-ancestors none', 'form-action self', dan connect-src yang
// dikunci sehingga data tidak dapat dikirim ke domain asing.
const csp = [
  "default-src 'self'",
  // React mode pengembangan memakai eval() untuk penyusunan ulang callstack.
  // Produksi tidak memerlukannya, jadi 'unsafe-eval' hanya diberikan saat
  // `next dev`. Tanpa ini, hidrasi gagal dan seluruh halaman mati saat
  // dikembangkan lokal — sementara CSP produksi tetap ketat.
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // https: dibuka untuk gambar dan video sejak soal CBT boleh membawa media.
  // Dosen menempelkan tautan gambar dari mana saja — Wikipedia, situs
  // kampus, penyimpanan awan miliknya sendiri — dan daftar putih tuan rumah
  // akan menolak yang sah jauh lebih sering daripada menahan yang jahat.
  //
  // Yang DILEPAS di sini hanya pemuatan gambar dan media, bukan skrip: berkas
  // gambar tidak menjalankan kode, dan connect-src tetap terkunci sehingga
  // data portal tidak dapat dikirim ke tuan rumah asing.
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${supabase.http} ${supabase.ws}`,
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  // Video sematan pada soal. Daftarnya SEMPIT dan disengaja: iframe adalah
  // halaman asing yang berjalan di dalam layar ujian, jadi ia tidak boleh
  // dibuka selebar img-src di atas.
  "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com " +
    "https://player.vimeo.com https://drive.google.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Paksa HTTPS selama 2 tahun, termasuk subdomain.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Cegah situs ini dibingkai orang lain (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Cegah peramban menebak-nebak tipe konten (MIME sniffing).
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Matikan perangkat keras yang tidak dipakai portal ini.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), browsing-topics=()",
  },
  // Isolasi jendela; 'allow-popups' dipertahankan karena cetak surat memakai window.open.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // Sembunyikan header X-Powered-By agar versi framework tidak terekspos.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Jawaban API tidak boleh singgah di cache peramban maupun CDN:
        // isinya data pribadi mahasiswa, dosen, dan admin.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
