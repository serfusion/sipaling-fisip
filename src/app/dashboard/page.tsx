import type { Metadata } from "next";
import DashboardApp from "./dashboard-app";
import { getCurrentProfile } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Dashboard Dosen/Admin | SiPaling FISIP",
  description: "Kelola pengajuan layanan SiPaling FISIP.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  return <DashboardApp profile={profile} />;
}
