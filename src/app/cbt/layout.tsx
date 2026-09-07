import type { Metadata } from "next";
import type { ReactNode } from "react";

// ============================================================
// TATA LETAK SITUS CBT
//
// CBT berdiri sebagai situs tersendiri, terpisah dari portal layanan
// akademik yang menumpanginya. Bukan sekadar rapi: yang membukanya adalah
// peserta yang sedang ujian, dan satu-satunya hal yang boleh ada di layarnya
// adalah ujian itu. Menu portal induknya tidak punya urusan di sana.
//
// Ia juga berdiri sendiri sebagai PRODUK: tidak ada nama lembaga, fakultas,
// maupun program studi yang tertanam di dalamnya. Yang membedakan satu
// pemasangan dari yang lain hanyalah isi ujiannya dan satu pengaturan nama
// penyelenggara pada kop cetak — selebihnya sama untuk siapa pun yang
// memakainya.
//
// Ia dapat dipasang pada subdomainnya sendiri — atur CBT_HOST, dan middleware
// mengarahkan seluruh permintaan dari tuan rumah itu ke sini.
// ============================================================

export const metadata: Metadata = {
  title: "SiPaling CBT: Ujian Berbasis Komputer",
  description:
    "Sistem ujian berbasis komputer. Peserta masuk dengan kode ujian, nama, dan NIM, tanpa membuat akun.",
  robots: { index: false, follow: false },
};

export default function TataLetakCbt({ children }: { children: ReactNode }) {
  return <div className="situs-cbt">{children}</div>;
}
