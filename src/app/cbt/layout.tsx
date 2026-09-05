import type { Metadata } from "next";
import type { ReactNode } from "react";

// ============================================================
// TATA LETAK SITUS CBT
//
// CBT berdiri sebagai situs tersendiri, terpisah dari portal layanan
// akademik. Bukan sekadar rapi: yang membukanya adalah mahasiswa yang sedang
// ujian, dan satu-satunya hal yang boleh ada di layarnya adalah ujian itu.
// Menu layanan surat, Cakrawala, dan Catatan Uang tidak punya urusan di sana.
//
// Ia dapat dipasang pada subdomainnya sendiri — atur CBT_HOST, dan middleware
// mengarahkan seluruh permintaan dari tuan rumah itu ke sini.
// ============================================================

export const metadata: Metadata = {
  title: "SiPaling CBT — Ujian Berbasis Komputer",
  description:
    "Sistem ujian berbasis komputer FISIP. Mahasiswa masuk dengan kode ujian, nama, dan NIM — tanpa membuat akun.",
  robots: { index: false, follow: false },
};

export default function TataLetakCbt({ children }: { children: ReactNode }) {
  return <div className="situs-cbt">{children}</div>;
}
