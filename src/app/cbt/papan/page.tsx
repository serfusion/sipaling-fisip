import type { Metadata } from "next";
import { headers } from "next/headers";
import { awalanCbt } from "@/lib/situs-cbt";
import PapanNilai from "./papan-nilai";

export const metadata: Metadata = {
  title: "Papan Nilai Tugas · SiPaling CBT",
  description: "Nilai tugas yang sudah diterbitkan pengajar, diurutkan dari tertinggi. Keterangan nilai hanya terbuka dengan kode SIPALING-TUGAS pemiliknya.",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const kepala = await headers();
  return <PapanNilai awalan={awalanCbt(kepala.get("host"))} />;
}
