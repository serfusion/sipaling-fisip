import { getCurrentProfile } from "@/lib/supabase-server";
import { normalizeMaintenance } from "@/lib/maintenance";
import { readMaintenanceState, writeMaintenanceState } from "@/lib/maintenance-store";

export const dynamic = "force-dynamic";

// Status maintenance boleh dibaca siapa saja: isinya memang teks yang
// ditampilkan ke pengunjung.
export async function GET() {
  const maintenance = await readMaintenanceState();
  return Response.json({ success: true, maintenance });
}

// HANYA SUPER ADMIN.
//
// Perhatikan bedanya dengan /api/service-status dan /api/announcements yang
// mengizinkan role "admin": menutup seluruh portal adalah tombol paling
// berbahaya di sistem ini, jadi kuncinya dipegang satu peran saja.
export async function PUT(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    return Response.json(
      { success: false, message: "Mode maintenance hanya dapat diubah oleh Super Admin." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    // Validasi dan pemotongan panjang teks dipusatkan di normalizeMaintenance.
    const maintenance = normalizeMaintenance(body);
    await writeMaintenanceState(maintenance);
    return Response.json({ success: true, maintenance });
  } catch (error: unknown) {
    console.error("update maintenance", error);
    return Response.json(
      { success: false, message: "Mode maintenance belum tersimpan. Coba simpan ulang." },
      { status: 500 },
    );
  }
}
