// ============================================================
// PENYIMPANAN DOKUMEN DI DISK SERVER (v55)
//
// Bucket "service-documents" melewati kuota 1 GB Supabase gratis (Nov 2026),
// sementara portal kini berjalan di VPS sendiri yang disknya lapang. Dengan
// DOCUMENT_STORAGE=lokal, berkas dokumen disimpan di DOCUMENT_DIR (bawaan
// /var/lib/sipaling-fisip/dokumen) — basis data, akun, dan bucket CBT tetap
// di Supabase.
//
// Bentuknya meniru Supabase Storage sedekat mungkin supaya pemanggil tidak
// berubah: jalur yang sama ("requests/…", "revisions/transit/…"), tautan
// unduh & izin unggah bertanda tangan yang kedaluwarsa, list/remove dengan
// bentuk jawaban yang sama. Tanda tangannya HMAC-SHA256 atas
// aksi + jalur + kedaluwarsa (+ nama unduhan), jadi tautan tidak dapat
// diubah untuk membuka berkas lain.
// ============================================================
import { createHmac, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const AWALAN_URL = "/api/dokumen";

export function pakaiPenyimpananLokal() {
  return (process.env.DOCUMENT_STORAGE || "").trim().toLowerCase() === "lokal";
}

export function folderDokumen() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DOCUMENT_DIR || "/var/lib/sipaling-fisip/dokumen");
}

function kunciTanda() {
  const kunci =
    process.env.DOCUMENT_SIGNING_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.CRON_SECRET || "";
  if (!kunci) throw new Error("DOCUMENT_SIGNING_SECRET belum diatur untuk penyimpanan lokal.");
  return kunci;
}

/** Jalur berkas di disk, atau null bila jalurnya mencoba keluar dari folder dokumen. */
export function berkasDisk(jalur: string): string | null {
  if (!jalur || jalur.length > 400 || jalur.includes("\0") || jalur.includes("\\")) return null;
  if (jalur.split("/").some((b) => !b || b === "." || b === "..")) return null;
  const akar = folderDokumen();
  const penuh = path.resolve(/*turbopackIgnore: true*/ akar, jalur);
  return penuh.startsWith(akar + path.sep) ? penuh : null;
}

export function tandaTangan(aksi: "get" | "put", jalur: string, kedaluwarsa: number, unduh = "") {
  return createHmac("sha256", kunciTanda()).update(`${aksi}\n${jalur}\n${kedaluwarsa}\n${unduh}`).digest("base64url");
}

export function tandaSah(aksi: "get" | "put", jalur: string, kedaluwarsa: number, tanda: string, unduh = "") {
  if (!Number.isFinite(kedaluwarsa) || kedaluwarsa < Math.floor(Date.now() / 1000)) return false;
  const harap = Buffer.from(tandaTangan(aksi, jalur, kedaluwarsa, unduh));
  const dapat = Buffer.from(tanda || "");
  return harap.length === dapat.length && timingSafeEqual(harap, dapat);
}

function kodeJalur(jalur: string) {
  return jalur.split("/").map(encodeURIComponent).join("/");
}

/** Tautan unduh relatif (berlaku di domain portal mana pun yang melayani). */
export function urlUnduhLokal(jalur: string, detik: number, unduh?: string) {
  const e = Math.floor(Date.now() / 1000) + detik;
  const q = new URLSearchParams({ e: String(e), t: tandaTangan("get", jalur, e, unduh || "") });
  if (unduh) q.set("d", unduh);
  return `${AWALAN_URL}/${kodeJalur(jalur)}?${q}`;
}

/** Izin unggah (PUT) untuk satu jalur, berlaku 2 jam seperti milik Supabase. */
export function izinUnggahLokal(jalur: string, detik = 7200) {
  const e = Math.floor(Date.now() / 1000) + detik;
  const t = tandaTangan("put", jalur, e);
  return { url: `${AWALAN_URL}/${kodeJalur(jalur)}?${new URLSearchParams({ e: String(e), t })}`, token: t };
}

type Galat = { message: string } | null;

async function tulisAtomik(tujuan: string, isi: Buffer | AsyncIterable<Uint8Array>, timpa: boolean, maks?: number) {
  await fs.mkdir(path.dirname(tujuan), { recursive: true });
  if (!timpa) {
    const ada = await fs.stat(tujuan).then(() => true, () => false);
    if (ada) throw new Error("The resource already exists");
  }
  const sementara = `${tujuan}.${process.pid}.${Date.now()}.sementara`;
  const pegangan = await fs.open(sementara, "w", 0o640);
  let total = 0;
  try {
    if (Buffer.isBuffer(isi)) {
      await pegangan.write(isi);
      total = isi.length;
    } else {
      for await (const potongan of isi) {
        total += potongan.length;
        if (maks && total > maks) throw new Error("Berkas melebihi batas ukuran.");
        await pegangan.write(potongan);
      }
    }
  } catch (galat) {
    await pegangan.close();
    await fs.rm(sementara, { force: true });
    throw galat;
  }
  await pegangan.close();
  await fs.rename(sementara, tujuan);
  return total;
}

/** Tulis aliran badan permintaan ke jalur (dipakai rute PUT). */
export async function simpanAliran(jalur: string, aliran: AsyncIterable<Uint8Array>, maks: number) {
  const tujuan = berkasDisk(jalur);
  if (!tujuan) throw new Error("Jalur tidak sah.");
  return tulisAtomik(tujuan, aliran, true, maks);
}

/** Pengganti supabase.storage.from(bucket) untuk upload / remove / list. */
export const bucketLokal = {
  async upload(jalur: string, isi: Buffer, opsi?: { upsert?: boolean }): Promise<{ data: { path: string } | null; error: Galat }> {
    const tujuan = berkasDisk(jalur);
    if (!tujuan) return { data: null, error: { message: "Jalur tidak sah." } };
    try {
      await tulisAtomik(tujuan, isi, Boolean(opsi?.upsert));
      return { data: { path: jalur }, error: null };
    } catch (galat: unknown) {
      return { data: null, error: { message: galat instanceof Error ? galat.message : String(galat) } };
    }
  },

  async remove(jalur: string[]): Promise<{ data: unknown[]; error: Galat }> {
    try {
      for (const j of jalur) {
        const p = berkasDisk(j);
        if (p) await fs.rm(p, { force: true });
      }
      return { data: [], error: null };
    } catch (galat: unknown) {
      return { data: [], error: { message: galat instanceof Error ? galat.message : String(galat) } };
    }
  },

  /** Seperti Supabase: folder ber-id null, berkas ber-id terisi; urut nama. */
  async list(
    folder = "",
    opsi?: { limit?: number; offset?: number },
  ): Promise<{ data: Array<{ name: string; id: string | null }> | null; error: Galat }> {
    const akar = folderDokumen();
    const dir = folder ? berkasDisk(folder.replace(/\/+$/, "")) : akar;
    if (!dir) return { data: null, error: { message: "Jalur tidak sah." } };
    try {
      const isi = (await fs.readdir(dir, { withFileTypes: true }))
        .filter((d) => !d.name.endsWith(".sementara"))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      const awal = opsi?.offset || 0;
      const potong = isi.slice(awal, awal + (opsi?.limit || 100));
      return { data: potong.map((d) => ({ name: d.name, id: d.isDirectory() ? null : d.name })), error: null };
    } catch (galat: unknown) {
      if ((galat as { code?: string }).code === "ENOENT") return { data: [], error: null };
      return { data: null, error: { message: galat instanceof Error ? galat.message : String(galat) } };
    }
  },
};

/** Ukuran + beberapa bita pertama sebuah berkas (pengganti baca kepala lewat Range). */
export async function kepalaLokal(jalur: string, n = 16) {
  const p = berkasDisk(jalur);
  if (!p) return null;
  try {
    const pegangan = await fs.open(p, "r");
    try {
      const { size } = await pegangan.stat();
      const buf = Buffer.alloc(Math.min(n, size));
      await pegangan.read(buf, 0, buf.length, 0);
      return { ukuran: size, kepala: new Uint8Array(buf) };
    } finally {
      await pegangan.close();
    }
  } catch {
    return null;
  }
}
