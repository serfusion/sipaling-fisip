// ============================================================
// KUNCI MENU CAKRAWALA — sisi server (baca/tulis ke tabel app_settings)
// ============================================================
import { cookies } from "next/headers";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  CAKRAWALA_COOKIE,
  CAKRAWALA_KEY,
  DEFAULT_CAKRAWALA,
  kodeBerlaku,
  parseCakrawala,
  rapikanKode,
  type CakrawalaState,
} from "@/lib/cakrawala";
import { getCurrentProfile } from "@/lib/supabase-server";

/**
 * Membaca status kunci Cakrawala.
 *
 * SENGAJA GAGAL-TERTUTUP — kebalikan dari mode maintenance. Bila database
 * bermasalah, fungsi ini mengembalikan status "terkunci, tanpa kode": lebih
 * baik halaman pratinjau yang tampil daripada seluruh isi Cakrawala terbuka
 * untuk umum hanya karena satu baris pengaturan gagal dibaca.
 */
export async function readCakrawalaState(): Promise<CakrawalaState> {
  try {
    const rows = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, CAKRAWALA_KEY))
      .limit(1);
    return parseCakrawala(rows[0]?.value);
  } catch {
    return DEFAULT_CAKRAWALA;
  }
}

export async function writeCakrawalaState(state: CakrawalaState) {
  const value = JSON.stringify(state);
  await db
    .insert(appSettings)
    .values({ key: CAKRAWALA_KEY, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

/**
 * Memeriksa satu kode dan mencatat pemakaiannya.
 *
 * Kode disimpan apa adanya, bukan sebagai hash: pemiliknya memang perlu
 * membacanya kembali di dashboard untuk dibagikan ulang, dan yang dijaga di
 * sini adalah akses ke sebuah menu — bukan kata sandi akun.
 */
export async function verifyCakrawalaCode(input: string) {
  const kode = rapikanKode(input);
  if (!kode) return { ok: false as const, message: "Kode belum diisi." };

  const state = await readCakrawalaState();
  const index = state.codes.findIndex((item) => item.code === kode);
  if (index < 0) {
    return { ok: false as const, message: "Kode tidak dikenali. Periksa kembali penulisannya." };
  }
  const found = state.codes[index];
  if (!found.active) {
    return { ok: false as const, message: "Kode ini sudah dinonaktifkan." };
  }
  if (!kodeBerlaku(found)) {
    return { ok: false as const, message: "Kuota pemakaian kode ini sudah habis." };
  }

  const codes = [...state.codes];
  codes[index] = { ...found, uses: found.uses + 1, lastUsedAt: new Date().toISOString() };
  try {
    await writeCakrawalaState({ ...state, codes });
  } catch (error) {
    // Pencatatan pemakaian bersifat pelengkap; kode yang sah tidak boleh
    // ditolak hanya karena penghitungnya gagal disimpan.
    console.error("catat pemakaian kode cakrawala", error);
  }
  return { ok: true as const, code: kode };
}

/**
 * Apakah pengunjung ini boleh masuk ke Cakrawala?
 *
 * Tiga jalan masuk: kunci memang sedang mati, perangkat ini menyimpan cookie
 * berisi kode yang masih berlaku, atau yang membuka adalah Super Admin —
 * merekalah yang memegang kuncinya, jadi tidak masuk akal bila terkunci di
 * luar oleh pengaturannya sendiri.
 */
export async function cakrawalaAccess() {
  const state = await readCakrawalaState();
  if (!state.locked) return { allowed: true as const, state, reason: "terbuka" as const };

  const jar = await cookies();
  const kode = rapikanKode(jar.get(CAKRAWALA_COOKIE)?.value);
  if (kode) {
    // Cukup diperiksa masih aktif, BUKAN kuotanya. Batas pemakaian mengatur
    // berapa kali sebuah kode boleh ditukar menjadi akses; perangkat yang
    // sudah menukarnya tidak boleh ikut terlempar keluar begitu kuotanya
    // habis — kode sekali pakai justru dibuat untuk satu orang yang datang
    // berkali-kali. Untuk menutup akses, kode dinonaktifkan atau dihapus.
    const found = state.codes.find((item) => item.code === kode);
    if (found?.active) {
      return { allowed: true as const, state, reason: "kode" as const };
    }
  }

  const profile = await getCurrentProfile();
  if (profile?.role === "super_admin") {
    return { allowed: true as const, state, reason: "super_admin" as const };
  }

  return { allowed: false as const, state, reason: "terkunci" as const };
}
