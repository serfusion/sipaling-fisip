import { createBrowserClientFromServer, isSupabaseConfigured } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function POST() {
  if (isSupabaseConfigured()) {
    const supabase = await createBrowserClientFromServer();
    if (supabase) {
      await supabase.auth.signOut();
    }
  }
  redirect("/login");
}
