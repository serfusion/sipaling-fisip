import type { Metadata } from "next";
import LoginPage from "./login-page";

export const metadata: Metadata = {
  title: "Login | SiPaling FISIP",
  description: "Login untuk dosen dan admin SiPaling FISIP.",
};

export const dynamic = "force-dynamic";

// Penanda ?timeout=1 dipasang useAutoLogout ketika sesi berakhir karena diam.
// Dibaca di server supaya halaman kliennya tidak perlu useSearchParams
// sekaligus Suspense hanya untuk satu pemberitahuan.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <LoginPage habisWaktu={params.timeout === "1"} />;
}
