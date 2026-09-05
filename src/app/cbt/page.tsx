import type { Metadata } from "next";
import MasukCbt from "./masuk-cbt";

export const metadata: Metadata = {
  title: "Masuk · SiPaling CBT",
  description: "Pilih masuk sebagai mahasiswa dengan kode ujian, atau sebagai dosen dan admin.",
};

export const dynamic = "force-dynamic";

export default function Page() {
  return <MasukCbt />;
}
