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
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: layout.tsx berlaku untuk seluruh halaman */}
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
