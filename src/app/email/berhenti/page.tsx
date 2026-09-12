// ============================================================
// HALAMAN BERHENTI LANGGANAN
//
// Halaman ini dilihat PENERIMA — peneliti di luar kampus yang tidak punya
// akun, tidak pernah mendaftar, dan sedang meminta agar tidak dikirimi lagi.
// Karena itu bentuknya sesederhana mungkin: satu kalimat, satu tombol, dan
// tidak ada satu pun tawaran untuk "tetap berlangganan dengan frekuensi
// lebih jarang".
//
// Yang tidak ada di sini juga disengaja: alamat emailnya TIDAK ditampilkan.
// Tautannya hanya membawa token, dan token itu dapat sampai ke tangan orang
// lain — diteruskan, tersalin, terbaca di layar bersama. Halaman yang
// menampilkan alamatnya akan membocorkannya kepada siapa pun yang membuka
// tautannya.
// ============================================================

import type { Metadata } from "next";
import FormBerhenti from "./form-berhenti";

export const metadata: Metadata = {
  title: "Berhenti Langganan | SiPaling FISIP",
  description: "Berhenti menerima undangan jurnal dari FISIP Universitas Muhammadiyah Tangerang.",
  // Halaman bertoken tidak boleh masuk mesin pencari.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function HalamanBerhenti({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  return <FormBerhenti token={t || ""} />;
}
