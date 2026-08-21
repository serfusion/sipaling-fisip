import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  getSupabasePublishableKey,
  getSupabaseSecretKey,
  getSupabaseUrl,
} from "@/lib/supabase-config";

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function isProfileLookupConfigured() {
  return Boolean(isSupabaseConfigured() && getSupabaseSecretKey());
}

export async function createBrowserClientFromServer() {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();
  if (!url || !publishableKey) return null;

  return createServerClient(
    url,
    publishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(list: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            list.forEach(({ name, value, options }) => {
              // Cookie sesi diperketat: hanya dikirim lewat HTTPS di produksi
              // (secure) dan tidak ikut pada permintaan lintas situs
              // (sameSite lax) sebagai lapisan tambahan terhadap CSRF.
              //
              // httpOnly SENGAJA TIDAK dipasang. Login portal ini dilakukan di
              // peramban lewat @supabase/ssr, sehingga pustaka itu harus dapat
              // membaca dan memperbarui cookie sesinya sendiri; memaksakan
              // httpOnly akan membuat pengguna tampak logout dan gagal sign
              // out. Risiko pencurian cookie lewat XSS ditekan dari sisi lain:
              // CSP ketat, sanitasi HTML template, dan escaping React.
              cookieStore.set(name, value, {
                ...(options ?? {}),
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/",
              } as Record<string, unknown>);
            });
          } catch {
            // noop when called from server component
          }
        },
      },
    },
  );
}

export type Role =
  | "super_admin"
  | "admin"
  | "admin_umum"
  | "admin_akademik"
  | "admin_prodi"
  | "admin_pddikti"
  | "admin_perpustakaan"
  | "admin_laboratorium"
  | "dosen";

const roles: ReadonlySet<string> = new Set<Role>([
  "super_admin",
  "admin",
  "admin_umum",
  "admin_akademik",
  "admin_prodi",
  "admin_pddikti",
  "admin_perpustakaan",
  "admin_laboratorium",
  "dosen",
]);

export type SessionProfile = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  lecturerId: number | null;
};

export async function getCurrentProfile(): Promise<SessionProfile | null> {
  if (!isProfileLookupConfigured()) return null;
  const supabase = await createBrowserClientFromServer();
  if (!supabase) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user?.id || !user.email) return null;

  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();
  if (!url || !secretKey) return null;

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const columns = "id,email,full_name,role,lecturer_id,active";

  // UUID adalah penghubung utama dan tidak berubah walaupun email diganti.
  let { data, error } = await admin
    .from("profiles")
    .select(columns)
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();

  // Fallback untuk data lama yang dahulu hanya dihubungkan melalui email.
  if (!data && !error) {
    const fallback = await admin
      .from("profiles")
      .select(columns)
      .ilike("email", user.email)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data || !roles.has(String(data.role))) return null;
  return {
    id: data.id as string,
    email: data.email as string,
    fullName: data.full_name as string,
    role: data.role as Role,
    lecturerId: (data.lecturer_id as number | null) ?? null,
  };
}

export function hasAtLeast(profile: SessionProfile | null, minimum: Role) {
  if (!profile) return false;
  const order: Record<Role, number> = {
    dosen: 1,
    admin_umum: 2,
    admin_akademik: 2,
    admin_prodi: 2,
    admin_pddikti: 2,
    admin_perpustakaan: 2,
    admin_laboratorium: 2,
    admin: 3,
    super_admin: 4,
  };
  return order[profile.role] >= order[minimum];
}

const serviceByUnitRole: Partial<Record<Role, string>> = {
  admin_umum: "Layanan Umum",
  admin_akademik: "Layanan Akademik",
  admin_prodi: "Layanan Prodi",
  admin_pddikti: "Layanan PDDIKTI",
  admin_perpustakaan: "Layanan Perpustakaan",
  admin_laboratorium: "Layanan Laboratorium",
};

export function serviceTypeForProfile(profile: SessionProfile) {
  return serviceByUnitRole[profile.role] || null;
}

export function canAccessServiceRequest(
  profile: SessionProfile,
  request: { serviceType: string; lecturerId: number | null },
) {
  if (profile.role === "super_admin" || profile.role === "admin") return true;
  if (profile.role === "dosen") {
    return profile.lecturerId !== null && request.lecturerId === profile.lecturerId;
  }
  return serviceTypeForProfile(profile) === request.serviceType;
}
