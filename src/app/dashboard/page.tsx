import type { Metadata } from "next";
import DashboardApp from "./dashboard-app";
import { getSessionState } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Dashboard Dosen/Admin | SiPaling FISIP",
  description: "Kelola pengajuan layanan SiPaling FISIP.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { profile, tertahanMaintenance } = await getSessionState();
  const params = await searchParams;
  return <DashboardApp profile={profile} maintenanceLocked={tertahanMaintenance} initialView={params.view} />;
}
