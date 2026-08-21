import Link from "next/link";
import SipalingApp from "./sipaling-app";
import MaintenanceScreen from "./maintenance-screen";
import { readMaintenanceState } from "@/lib/maintenance-store";
import { getCurrentProfile } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// Halaman utama TIDAK boleh bergantung pada database.
// Sebelumnya ada `await db.execute(select 1)` di sini sehingga seluruh
// homepage error 500 ketika database bermasalah. Sekarang halaman selalu
// tampil; jika database bermasalah, pesan error yang jelas muncul di form.
//
// Pembacaan status maintenance di bawah mengikuti aturan yang sama:
// readMaintenanceState() gagal-terbuka, jadi database bermasalah TIDAK
// pernah membuat portal ikut tertutup.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const wantsPreview = params?.preview === "maintenance";
  const state = await readMaintenanceState();

  // Jalur cepat untuk 99% kunjungan: tidak ada maintenance, tidak ada
  // pratinjau, jadi tidak perlu memanggil Supabase sama sekali.
  if (!state.enabled && !wantsPreview) return <SipalingApp />;

  const profile = await getCurrentProfile();

  // Pratinjau khusus Super Admin — dipanggil dari panel dashboard lewat
  // /?preview=maintenance. Tanpa ini Super Admin tidak akan pernah melihat
  // halaman kucingnya, karena akun yang login selalu dilewatkan.
  if (wantsPreview && profile?.role === "super_admin") {
    return <MaintenanceScreen state={{ ...state, enabled: true }} preview />;
  }

  if (!state.enabled) return <SipalingApp />;

  // Dosen dan admin yang sudah login tetap dapat memakai portal selama
  // maintenance: merekalah yang sedang membereskan sesuatu di baliknya.
  if (profile) {
    return (
      <>
        <div className="mt-bypass-bar">
          <span className="mt-bypass-dot" aria-hidden="true" />
          <b>Mode maintenance sedang menyala.</b>
          <span>Pengunjung umum melihat halaman istirahat — Anda dilewatkan karena sudah login.</span>
          <Link href="/dashboard">Buka dashboard →</Link>
        </div>
        <SipalingApp />
      </>
    );
  }

  return <MaintenanceScreen state={state} />;
}
