import type { Metadata } from "next";
import AlatApp from "./alat-app";

export const metadata: Metadata = {
  title: "Cakrawala · SiPaling FISIP",
  description:
    "Empat pemeriksa untuk naskah Anda: verifikasi sitasi, radar jurnal, alih bentuk skripsi ke artikel Inggris, dan pemeriksa ragam ilmiah Bahasa Indonesia. Gratis, tanpa akun.",
};

export default function Page() {
  return <AlatApp />;
}
