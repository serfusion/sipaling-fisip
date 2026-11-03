import type { Metadata } from "next";
import { headers } from "next/headers";
import { awalanCbt } from "@/lib/situs-cbt";
import KumpulTugas from "./kumpul-tugas";

export const metadata: Metadata = {
  title: "Kumpulkan Tugas · SiPaling CBT",
  description: "Kumpulkan tugas dalam bentuk PDF dengan kode tugas dari pengajar, dan terima kode SIPALING-TUGAS untuk melacak nilai.",
};

// Halaman ini membaca keadaan tugas yang dapat berubah kapan saja (dibuka,
// ditutup, lewat batas waktu), jadi tidak pernah disimpan di cache.
export const dynamic = "force-dynamic";

export default async function Page() {
  // Awalan jalur dihitung DI SERVER dari tuan rumahnya: "" di subdomain CBT,
  // "/cbt" di portal. Tautan ke papan nilai dan pintu masuk memakainya.
  const kepala = await headers();
  return <KumpulTugas awalan={awalanCbt(kepala.get("host"))} />;
}
