"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase-config";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) return null;

  if (!browserClient) {
    // @supabase/ssr menyimpan sesi pada cookie. Cookie ini kemudian dapat
    // dibaca oleh Server Components dan route /api/auth/me.
    browserClient = createBrowserClient(url, publishableKey);
  }

  return browserClient;
}
