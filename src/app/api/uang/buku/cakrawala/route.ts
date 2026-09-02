// ============================================================
// BUKU KAS UNTUK PELANGGAN CAKRAWALA
//
// Pelanggan Cakrawala mendapat Catatan Uang tanpa perlu mengurus kode buku
// sendiri. Yang menyamakan bukunya antar perangkat adalah sidik kode
// aksesnya, bukan kodenya sendiri: kode akses tidak pernah ikut tersimpan di
// tabel catatan uang, jadi bocornya satu tabel tidak membuka menu Cakrawala.
// ============================================================
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { explainServerError } from "@/lib/api-errors";
import { CAKRAWALA_COOKIE, rapikanKode } from "@/lib/cakrawala";
import { cakrawalaAccess } from "@/lib/cakrawala-store";
import { getCurrentProfile } from "@/lib/supabase-server";
import { tolak } from "@/lib/uang/gerbang";
import { bukuUntukPemilik } from "@/lib/uang/simpan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Penanda pemilik untuk pengunjung Cakrawala saat ini.
 *
 * Kode aksesnya di-hash bersama satu kata tambahan dari environment. Tanpa
 * kata itu pun jalur ini tetap berjalan; ia hanya membuat sidiknya tidak
 * dapat dihitung ulang oleh siapa pun yang kebetulan melihat daftar kode.
 */
async function penandaPemilik(): Promise<string | null> {
  const jar = await cookies();
  const kode = rapikanKode(jar.get(CAKRAWALA_COOKIE)?.value);
  if (kode) {
    const garam = process.env.UANG_GARAM || "sipaling-uang";
    return `cw:${createHash("sha256").update(`${garam}:${kode}`).digest("hex").slice(0, 40)}`;
  }

  // Super Admin masuk tanpa kode. Penandanya id profilnya sendiri, supaya ia
  // tetap mendapat buku yang sama tiap kali membuka panelnya.
  const profile = await getCurrentProfile();
  if (profile?.role === "super_admin") return `sa:${profile.id}`.slice(0, 80);

  return null;
}

export async function POST() {
  const akses = await cakrawalaAccess();
  if (!akses.allowed) {
    return tolak("Catatan Uang di dalam Cakrawala hanya untuk pemegang akses.", 403);
  }

  const penanda = await penandaPemilik();
  if (!penanda) {
    // Terjadi ketika kunci Cakrawala sedang dimatikan: semua orang masuk,
    // dan tidak ada yang menandai siapa mereka. Bukunya dibuat sendiri lewat
    // gerbang biasa, dan layarnya sudah tahu harus menampilkan itu.
    return Response.json(
      {
        success: false,
        perluBuatSendiri: true,
        message: "Buat atau buka buku kas dengan kode, lalu ia akan diingat di perangkat ini.",
      },
      { status: 409 },
    );
  }

  try {
    const buku = await bukuUntukPemilik(penanda, "Catatan uang saya");
    return Response.json({
      success: true,
      buku: { kode: buku.code, nama: buku.name, dibuat: buku.createdAt },
    });
  } catch (error) {
    console.error("buku uang cakrawala", error);
    return tolak(explainServerError(error, "Buku gagal disiapkan. Coba lagi sebentar."), 500);
  }
}
