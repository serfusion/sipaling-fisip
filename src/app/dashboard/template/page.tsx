import { getCurrentProfile } from "@/lib/supabase-server";
import TemplateApp from "./template-app";

export const dynamic = "force-dynamic";

export default async function TemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ jenis?: string }>;
}) {
  const profile = await getCurrentProfile();
  const params = await searchParams;
  return <TemplateApp profile={profile} initialJenis={params.jenis} />;
}
