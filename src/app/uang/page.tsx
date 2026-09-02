import type { Metadata, Viewport } from "next";
import Link from "next/link";
import UangApp from "./uang-app";
import { cakrawalaAccess } from "@/lib/cakrawala-store";

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

// Status kuncinya berubah sewaktu-waktu dan cookie pembukanya berbeda tiap
// pengunjung, jadi halaman ini tidak boleh disimpan sebagai hasil jadi.
export const dynamic = "force-dynamic";

/**
 * Catatan Uang bagian dari Cakrawala, bukan halaman umum.
 *
 * Gerbangnya di SERVER dan sama persis dengan yang menjaga /alat. Membuang
 * tombolnya dari portal saja tidak menjadikannya eksklusif — alamatnya tetap
 * dapat dibuka siapa pun yang pernah melihatnya sekali, dan alamat semacam
 * itu selalu beredar. Yang menutup pintu adalah pemeriksaan ini.
 *
 * Kalau kelak dipasang sebagai aplikasi tersendiri di layar utama, aplikasi
 * itu ikut terkunci ketika langganannya habis — dan memang itu maksudnya.
 */
export default async function HalamanUang() {
  const akses = await cakrawalaAccess();
  if (!akses.allowed) {
    return (
      <div className="uang-kunci">
        <div className="uang-kunci-kotak">
          <span className="uang-kunci-gembok" aria-hidden="true">🔒</span>
          <h1>Catatan Uang bagian dari Cakrawala</h1>
          <p>
            Fitur ini terbuka untuk pemegang kode akses Cakrawala. Masukkan kode Anda, atau lihat dulu
            isinya beserta harganya.
          </p>
          <Link href="/alat#kode" className="uang-kunci-utama">Saya punya kode akses</Link>
          <Link href="/alat#beli" className="uang-kunci-lain">Lihat isi dan harganya →</Link>
          <Link href="/" className="uang-kunci-balik">← Kembali ke portal mahasiswa</Link>
        </div>
      </div>
    );
  }
  return <UangApp />;
}
