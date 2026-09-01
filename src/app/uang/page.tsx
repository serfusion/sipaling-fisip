import type { Metadata, Viewport } from "next";
import UangApp from "./uang-app";

export const metadata: Metadata = {
  title: "Catatan Uang | SiPaling FISIP",
  description:
    "Catat pemasukan dan pengeluaran bulanan cukup dengan mengirim pesan, mis. +honor guru 100k atau -beli nasi uduk 10k.",
  // Halaman ini dapat dipasang sebagai aplikasi tersendiri. Manifesnya
  // menunjuk balik ke /uang saja, jadi yang terpasang di layar utama adalah
  // Catatan Uang, bukan seluruh portal.
  manifest: "/manifest-uang.webmanifest",
  applicationName: "Catatan Uang",
  appleWebApp: { capable: true, title: "Catatan Uang", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/images/uang/ikon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/uang/ikon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/images/uang/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a2a5e",
  // Kotak tulis berada di dekat papan ketik. Tanpa viewport-fit, tepi bawah
  // layar ponsel modern memakan tombol kirimnya.
  viewportFit: "cover",
};

// Seluruh halaman berjalan di peramban: bukunya dikunci oleh kode yang
// disimpan di perangkat masing-masing, jadi tidak ada yang perlu dirender
// lebih dulu di server. Pengurai pesannya pun berkas yang sama dengan yang
// dipakai server, sehingga pratinjau sambil mengetik tidak pernah berbeda
// hasilnya dengan yang benar-benar tersimpan.
export default function HalamanUang() {
  return <UangApp />;
}
