import type { Metadata } from "next";
import AlatApp from "./alat-app";
import PratinjauCakrawala from "./pratinjau";
import { cakrawalaAccess } from "@/lib/cakrawala-store";

export const metadata: Metadata = {
  title: "Cakrawala · SiPaling FISIP",
  description:
    "Sembilan alat naskah tugas akhir: perumus judul dan metode, cari referensi, cek kemiripan dan parafrase, struktur naskah, naskah Inggris, verifikasi sitasi, radar jurnal, dan periksa bahasa.",
};

// Halaman ini selalu dihitung ulang: status kuncinya dapat berubah kapan saja
// dari dashboard Super Admin, dan cookie pembuka berbeda tiap pengunjung.
export const dynamic = "force-dynamic";

export default async function Page() {
  // Gerbangnya di server, bukan di peramban. Bila hanya disembunyikan lewat
  // CSS atau state React, seluruh isi Cakrawala tetap ikut terkirim ke
  // pengunjung dan tinggal dibuka lewat alat pengembang.
  const akses = await cakrawalaAccess();
  if (!akses.allowed) return <PratinjauCakrawala />;
  return <AlatApp />;
}
