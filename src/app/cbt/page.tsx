import type { Metadata } from "next";
import { headers } from "next/headers";
import { asalPortal } from "@/lib/situs-cbt";
import MasukCbt from "./masuk-cbt";

export const metadata: Metadata = {
  title: "Masuk · SiPaling CBT",
  description: "Pilih masuk sebagai peserta dengan kode ujian, atau sebagai pengajar dan admin.",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  // Tautan yang keluar dari situs CBT — ke beranda portal dan ke halaman
  // masuk pengajar — harus membawa tuan rumah portal secara lengkap, sebab di
  // subdomain ini "/" berarti pintu masuk ujian, bukan beranda portal.
  //
  // Tuan rumahnya dibaca DI SERVER dan diturunkan sebagai properti. Kalau
  // dihitung di peramban sesudah halaman terpasang, penanda yang disusun
  // server dan yang disusun peramban berbeda sesaat — dan React menjawab
  // perbedaan itu dengan membuang seluruh pohon lalu menyusunnya ulang.
  const kepala = await headers();
  return <MasukCbt portal={asalPortal(kepala.get("host"))} />;
}
