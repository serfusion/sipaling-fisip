import type { Metadata } from "next";
import AlatApp from "./alat-app";

export const metadata: Metadata = {
  title: "Alat Bantu Akademik — SiPaling FISIP",
  description:
    "Radar Jurnal untuk memeriksa risiko jurnal sebelum mengirim naskah, dan pemeriksa ragam ilmiah Bahasa Indonesia. Gratis, tanpa akun.",
};

export default function Page() {
  return <AlatApp />;
}
