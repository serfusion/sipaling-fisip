import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/supabase-server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  CAKRAWALA_COOKIE,
  CAKRAWALA_COOKIE_MAX_AGE,
  CAKRAWALA_MAX_CODES,
  buatKodeCakrawala,
  normalizeCakrawala,
  rapikanKode,
  type CakrawalaCode,
} from "@/lib/cakrawala";
import { readCakrawalaState, verifyCakrawalaCode, writeCakrawalaState } from "@/lib/cakrawala-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Status kunci boleh dibaca siapa saja — halaman utama memakainya untuk
// menandai menu Cakrawala. Daftar kodenya TIDAK pernah ikut terkirim kecuali
// yang meminta adalah Super Admin.
export async function GET() {
  const state = await readCakrawalaState();
  const profile = await getCurrentProfile();
  if (profile?.role === "super_admin") {
    return Response.json({ success: true, locked: state.locked, codes: state.codes });
  }
  return Response.json({ success: true, locked: state.locked });
}

// Membuka kunci dengan kode. Terbuka untuk umum, karena memang inilah pintu
// masuknya — dibatasi lajunya supaya kode tidak dapat ditebak beruntun.
export async function POST(request: Request) {
  const limit = rateLimit({ request, name: "cakrawala-unlock", limit: 10, windowMs: 10 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  try {
    const body = (await request.json()) as { code?: string };
    const hasil = await verifyCakrawalaCode(rapikanKode(body.code));
    if (!hasil.ok) {
      return Response.json({ success: false, message: hasil.message }, { status: 400 });
    }

    const jar = await cookies();
    jar.set(CAKRAWALA_COOKIE, hasil.code, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CAKRAWALA_COOKIE_MAX_AGE,
    });
    return Response.json({ success: true, message: "Kode diterima. Selamat datang di Cakrawala." });
  } catch (error: unknown) {
    console.error("buka kunci cakrawala", error);
    return Response.json({ success: false, message: "Kode belum dapat diperiksa. Coba lagi." }, { status: 500 });
  }
}

// HANYA SUPER ADMIN. Menyalakan/mematikan kunci, membuat kode, dan
// menonaktifkan atau menghapus kode yang sudah ada.
export async function PUT(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    return Response.json(
      { success: false, message: "Kunci Cakrawala hanya dapat diatur oleh Super Admin." },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as {
      action?: "toggle" | "generate" | "disable" | "enable" | "remove";
      locked?: boolean;
      label?: string;
      maxUses?: number;
      code?: string;
    };
    const state = await readCakrawalaState();
    const action = body.action || "toggle";
    let codes: CakrawalaCode[] = state.codes;
    let locked = state.locked;
    let created: string | null = null;

    if (action === "toggle") {
      locked = body.locked !== false;
    } else if (action === "generate") {
      if (codes.length >= CAKRAWALA_MAX_CODES) {
        return Response.json(
          {
            success: false,
            message: `Jumlah kode sudah mencapai batas ${CAKRAWALA_MAX_CODES}. Hapus kode lama sebelum membuat yang baru.`,
          },
          { status: 400 },
        );
      }
      // Diulang bila kebetulan tabrakan dengan kode yang sudah ada.
      let kode = buatKodeCakrawala();
      for (let attempt = 0; attempt < 5 && codes.some((item) => item.code === kode); attempt++) {
        kode = buatKodeCakrawala();
      }
      created = kode;
      codes = [
        {
          code: kode,
          label: typeof body.label === "string" ? body.label : "",
          active: true,
          maxUses: Number.isInteger(body.maxUses) && Number(body.maxUses) > 0 ? Number(body.maxUses) : 0,
          uses: 0,
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
        },
        ...codes,
      ];
    } else {
      const target = rapikanKode(body.code);
      if (!target || !codes.some((item) => item.code === target)) {
        return Response.json({ success: false, message: "Kode tidak ditemukan." }, { status: 404 });
      }
      if (action === "remove") {
        codes = codes.filter((item) => item.code !== target);
      } else {
        codes = codes.map((item) =>
          item.code === target ? { ...item, active: action === "enable" } : item,
        );
      }
    }

    const next = normalizeCakrawala({ locked, codes });
    await writeCakrawalaState(next);
    return Response.json({ success: true, locked: next.locked, codes: next.codes, created });
  } catch (error: unknown) {
    console.error("atur kunci cakrawala", error);
    return Response.json(
      { success: false, message: "Pengaturan Cakrawala belum tersimpan. Coba simpan ulang." },
      { status: 500 },
    );
  }
}
