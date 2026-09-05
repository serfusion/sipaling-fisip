import type { Metadata } from "next";
import UjianApp from "./ujian-app";

export const metadata: Metadata = {
  title: "Kerjakan Ujian · SiPaling CBT",
  description: "Masuk dengan nama, NIM, dan kode ujian. Tanpa membuat akun.",
};

// Halaman ini tidak pernah boleh disimpan di cache mana pun: isinya bergantung
// pada jam server, dan ujian yang tampil "belum dibuka" dari cache lima menit
// lalu berarti mahasiswa menatap layar yang salah pada saat yang paling genting.
export const dynamic = "force-dynamic";

export default function Page() {
  return <UjianApp />;
}
