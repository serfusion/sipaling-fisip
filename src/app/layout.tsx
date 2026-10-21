import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SiPaling FISIP | Layanan Akademik",
  description: "Sistem Pelayanan Akademik Lingkungan FISIP untuk mahasiswa, dosen, dan admin.",
};

// Font dimuat lewat <link> stylesheet, BUKAN next/font/google.
// Alasan: next/font mengunduh font saat `next build`; jika server build
// gagal mengakses fonts.googleapis.com, seluruh deploy ikut gagal.
// Dengan cara ini build selalu sukses dan browser pengguna yang memuat font.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Mode baca Cakrawala dipasang sebagai atribut data-cakrawala pada <html>
    // oleh skrip kecil di /alat, sebelum React menghidrasi halaman. React
    // membandingkan atribut <html> hasil server dengan yang ada di peramban,
    // jadi atribut tambahan itu perlu dinyatakan wajar di sini.
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: layout.tsx berlaku untuk seluruh halaman */}
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Iklan In-Page Push, tag inline persis seperti dari jaringan iklan.
            Ditulis langsung di HTML server (bukan lewat useEffect atau
            next/script) agar pemeriksa pemasangannya, yang mencocokkan HTML
            mentah, menemukannya apa adanya. JANGAN diubah satu karakter pun.

            Di halaman CBT potongan ini ikut berjalan ('unsafe-inline'), tetapi
            skrip nap5k.com yang disisipkannya ditolak peramban: CSP ketat CBT
            (headers() di next.config.ts) tidak membuka script-src https:. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(s){s.dataset.zone='12084733',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))",
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
