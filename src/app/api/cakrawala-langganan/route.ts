// ============================================================
// PANEL LANGGANAN CAKRAWALA — hanya untuk Super Admin
//
// Inilah tempat perpanjangan lewat WhatsApp mendarat. Mahasiswa yang
// langganannya habis cukup mengirim pesan; harinya ditambahkan di sini, dan
// karena langganan menempel pada nomornya, penambahan itu langsung berlaku di
// web maupun di aplikasi tanpa kode baru dan tanpa pendaftaran ulang.
// ============================================================
import { getCurrentProfile } from "@/lib/supabase-server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { db } from "@/db";
import { cakrawalaAccounts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  akunDariWa,
  daftarAkun,
  jumlahAktif,
  perpanjang,
  rapikanWa,
} from "@/lib/akun-cakrawala";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function hanyaSuperAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    return Response.json(
      { success: false, message: "Daftar langganan hanya dapat dibuka Super Admin." },
      { status: 403 },
    );
  }
  return null;
}

export async function GET() {
  const tolak = await hanyaSuperAdmin();
  if (tolak) return tolak;

  try {
    const [akun, aktif] = await Promise.all([daftarAkun(), jumlahAktif()]);
    return Response.json({
      success: true,
      aktif,
      total: akun.length,
      akun: akun.map((a) => ({
        id: a.id,
        whatsapp: a.whatsapp,
        nama: a.name,
        sampai: a.expiresAt.toISOString(),
        kodeTerakhir: a.lastCode,
        jumlahTukar: a.redeemCount,
        dibuat: a.createdAt.toISOString(),
        terakhirDipakai: a.lastSeenAt ? a.lastSeenAt.toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("baca langganan cakrawala", error);
    return Response.json(
      { success: false, message: "Daftar langganan belum dapat dibaca. Coba lagi." },
      { status: 500 },
    );
  }
}

/**
 * Menambah hari, atau menghentikan langganan sekarang juga.
 *
 * Perpanjangan menerima nomor apa adanya lalu meluruskannya — yang dibaca
 * Super Admin di WhatsApp bisa saja "0812…" sedangkan yang tersimpan "62812…",
 * dan mengetiknya persis bukan pekerjaan manusia.
 */
export async function PATCH(request: Request) {
  const tolak = await hanyaSuperAdmin();
  if (tolak) return tolak;

  const limit = rateLimit({ request, name: "cakrawala-langganan", limit: 60, windowMs: 10 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  try {
    const body = (await request.json()) as {
      aksi?: "perpanjang" | "hentikan";
      whatsapp?: string;
      hari?: number;
      nama?: string;
    };

    const wa = rapikanWa(body.whatsapp);
    if (!wa) {
      return Response.json(
        { success: false, message: "Nomor WhatsApp belum benar." },
        { status: 400 },
      );
    }

    const akun = await akunDariWa(wa);
    if (!akun) {
      return Response.json(
        { success: false, message: "Nomor ini belum pernah menukarkan kode." },
        { status: 404 },
      );
    }

    if (body.aksi === "hentikan") {
      // Bukan dihapus. Barisnya tetap ada supaya penukaran kodenya masih dapat
      // ditelusuri, dan supaya orang yang membayar lagi kembali ke akun yang
      // sama — bukan ke akun kedua yang kehilangan seluruh riwayatnya.
      const berhenti = new Date();
      await db
        .update(cakrawalaAccounts)
        .set({ expiresAt: berhenti })
        .where(eq(cakrawalaAccounts.id, akun.id));
      return Response.json({ success: true, sampai: berhenti.toISOString() });
    }

    const hari = Number(body.hari);
    if (!Number.isInteger(hari) || hari < 1 || hari > 3650) {
      return Response.json(
        { success: false, message: "Jumlah hari harus antara 1 dan 3650." },
        { status: 400 },
      );
    }

    const sampai = perpanjang(akun.expiresAt, hari);
    const nama = String(body.nama ?? "").trim().slice(0, 120);
    await db
      .update(cakrawalaAccounts)
      .set({
        expiresAt: sampai,
        redeemCount: sql`${cakrawalaAccounts.redeemCount} + 1`,
        ...(nama ? { name: nama } : {}),
      })
      .where(eq(cakrawalaAccounts.id, akun.id));

    return Response.json({ success: true, sampai: sampai.toISOString(), whatsapp: wa });
  } catch (error) {
    console.error("ubah langganan cakrawala", error);
    return Response.json(
      { success: false, message: "Langganan belum dapat diubah. Coba lagi." },
      { status: 500 },
    );
  }
}
