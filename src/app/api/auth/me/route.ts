import { getCurrentProfile } from "@/lib/supabase-server";
import { isProfileLookupConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isProfileLookupConfigured()) {
    return Response.json({ success: true, configured: false, profile: null });
  }
  const profile = await getCurrentProfile();
  return Response.json({ success: true, configured: true, profile });
}
