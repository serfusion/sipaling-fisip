import { getSessionState, isProfileLookupConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isProfileLookupConfigured()) {
    return Response.json({ success: true, configured: false, profile: null });
  }
  // maintenanceLocked memisahkan "belum login" dari "akunnya sah tetapi
  // portalnya sedang ditutup", supaya halaman login dapat menjelaskan yang
  // sebenarnya, bukan menuduh akunnya tidak terdaftar.
  const { profile, tertahanMaintenance } = await getSessionState();
  return Response.json({
    success: true,
    configured: true,
    profile,
    maintenanceLocked: tertahanMaintenance,
  });
}
