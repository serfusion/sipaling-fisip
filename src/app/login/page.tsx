import type { Metadata } from "next";
import LoginPage from "./login-page";

export const metadata: Metadata = {
  title: "Login | SiPaling FISIP",
  description: "Login untuk dosen dan admin SiPaling FISIP.",
};

export const dynamic = "force-dynamic";

export default function Page() {
  return <LoginPage />;
}
