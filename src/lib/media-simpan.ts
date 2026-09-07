// ============================================================
// MENGHAPUS BERKAS MEDIA SOAL DARI SUPABASE STORAGE
//
// Aturan mana yang boleh dibuang ada di src/lib/media-cbt.ts, yang murni dan
// dapat diuji tanpa jaringan. Berkas ini hanya menjalankan keputusannya.
//
// SATU SIKAP YANG BERLAKU DI SELURUH BERKAS INI: kegagalan menghapus TIDAK
// PERNAH menggagalkan perbuatan yang memicunya. Pengajar yang menekan hapus
// soal harus melihat soalnya hilang; kalau Storage sedang bermasalah, yang
// tertinggal satu berkas yatim, dan penyapu harian akan mengambilnya nanti.
// Kebalikannya — menolak menghapus soal karena berkasnya gagal dibuang —
// menghalangi pekerjaan orang karena hal yang tidak ia sebabkan dan tidak
// dapat ia perbaiki.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase-config";
import { mapUjian } from "@/lib/media-cbt";

export const BUCKET_MEDIA = process.env.SUPABASE_CBT_BUCKET || "cbt-media";

function bucket() {
  const url = getSupabaseUrl();
  const kunci = getSupabaseSecretKey();
  if (!url || !kunci) return null;
  return createClient(url, kunci, { auth: { autoRefreshToken: false, persistSession: false } })
    .storage.from(BUCKET_MEDIA);
}

/** Buang beberapa berkas sekaligus. Mengembalikan berapa yang benar-benar dihapus. */
export async function hapusMedia(jalur: string[]): Promise<number> {
  const daftar = jalur.filter(Boolean);
  if (daftar.length === 0) return 0;
  const b = bucket();
  if (!b) return 0;
  try {
    const { error } = await b.remove(daftar);
    if (error) {
      console.error("hapus media cbt", error.message);
      return 0;
    }
    return daftar.length;
  } catch (galat) {
    console.error("hapus media cbt", galat);
    return 0;
  }
}

/**
 * Buang seluruh isi map satu ujian.
 *
 * Dipanggil ketika ujiannya dihapus. Menghapus map lebih tepat daripada
 * menghapus berkas milik tiap soal satu per satu: soalnya sudah ikut hilang
 * bersama ujiannya, jadi tidak ada lagi yang dapat ditanya berkas mana saja
 * yang tadi ditunjuknya.
 */
export async function hapusMediaUjian(examId: number): Promise<number> {
  const b = bucket();
  if (!b) return 0;
  const map = mapUjian(examId);
  try {
    let dibuang = 0;
    // Storage memberi paling banyak seratus nama sekali minta. Ujian dengan
    // dua ratus soal bergambar akan meninggalkan separuhnya kalau halaman
    // berikutnya tidak ikut diambil.
    for (let halaman = 0; halaman < 50; halaman += 1) {
      const { data, error } = await b.list(map, { limit: 100, offset: 0 });
      if (error || !data || data.length === 0) break;
      const jalur = data.map((o) => `${map}/${o.name}`);
      const { error: galatHapus } = await b.remove(jalur);
      if (galatHapus) break;
      dibuang += jalur.length;
      if (data.length < 100) break;
    }
    return dibuang;
  } catch (galat) {
    console.error("hapus map media ujian", galat);
    return 0;
  }
}

export type ObjekMedia = { jalur: string; dibuat?: string | null };

/**
 * Seluruh isi bucket, map demi map.
 *
 * Supabase Storage tidak punya daftar rekursif, jadi map ujian didaftar lebih
 * dulu lalu isinya masing-masing. Berhenti pada batas yang wajar supaya satu
 * panggilan cron tidak berjalan tanpa ujung ketika bucket-nya sudah besar;
 * yang tersisa akan terambil pada panggilan berikutnya besok.
 */
export async function daftarMedia(batasMap = 200): Promise<ObjekMedia[]> {
  const b = bucket();
  if (!b) return [];
  const hasil: ObjekMedia[] = [];
  try {
    const { data: maps, error } = await b.list("", { limit: batasMap, offset: 0 });
    if (error || !maps) return [];
    for (const m of maps) {
      if (!m.name.startsWith("ujian-")) continue;
      const { data: isi } = await b.list(m.name, { limit: 100, offset: 0 });
      for (const o of isi ?? []) {
        hasil.push({ jalur: `${m.name}/${o.name}`, dibuat: o.created_at ?? null });
      }
    }
  } catch (galat) {
    console.error("daftar media cbt", galat);
  }
  return hasil;
}
