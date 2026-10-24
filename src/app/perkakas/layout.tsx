import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { TabAlat } from "./tab-alat";

export const metadata: Metadata = {
  title: "Alat · SiPaling FISIP",
  description: "Perkakas tambahan SiPaling FISIP untuk mahasiswa, dimulai dari Theater Drama.",
};

// Kepala dan baris tab dipasang sekali di sini, sehingga berpindah alat hanya
// mengganti isinya — kepala halaman tidak ikut berkedip dan baris tabnya
// tidak ikut tergulir kembali ke awal.
export default function LayoutAlat({ children }: { children: ReactNode }) {
  return (
    <div className="pk">
      <header className="pk-atas">
        <div className="pk-atas-in">
          <Link href="/" className="pk-balik">← Portal Mahasiswa</Link>
          <h1>Alat</h1>
          <p className="pk-lead">Perkakas tambahan SiPaling FISIP, satu tab untuk tiap alat.</p>
        </div>
        <div className="pk-tab-wadah">
          <TabAlat />
        </div>
      </header>
      {children}
    </div>
  );
}
