// Pindahkan isi bucket Supabase "service-documents" ke disk server (v55).
//
//   set -a; . /etc/sipaling-fisip.env; set +a
//   node scripts/pindah-dokumen.mjs            # salin (aman diulang; yang sudah ada & sama ukurannya dilewati)
//   node scripts/pindah-dokumen.mjs periksa    # bandingkan Supabase vs disk, tanpa mengubah apa pun
//   node scripts/pindah-dokumen.mjs hapus      # hapus dari Supabase HANYA berkas yang sudah ada di disk dengan ukuran sama
//
// Jalankan sebagai pemilik folder dokumen (user "web" di VPS).
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";

const mode = process.argv[2] || "salin";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const kunci = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_DOCUMENT_BUCKET || "service-documents";
const akar = path.resolve(process.env.DOCUMENT_DIR || "/var/lib/sipaling-fisip/dokumen");
if (!url || !kunci) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY kosong. Muat dulu env-nya.");
  process.exit(1);
}
const storage = createClient(url, kunci, { auth: { persistSession: false } }).storage.from(bucket);

async function semuaBerkas(folder = "") {
  const hasil = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(folder, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${folder || "/"}: ${error.message}`);
    for (const b of data || []) {
      const jalur = folder ? `${folder}/${b.name}` : b.name;
      if (b.id === null) hasil.push(...(await semuaBerkas(jalur)));
      else if (b.name !== ".emptyFolderPlaceholder") hasil.push({ jalur, ukuran: Number(b.metadata?.size ?? -1) });
    }
    if (!data || data.length < 1000) break;
  }
  return hasil;
}

const ukuranDisk = (jalur) => fs.stat(path.join(akar, jalur)).then((s) => s.size, () => -1);
const mb = (n) => (n / 1048576).toFixed(1) + " MB";

const daftar = await semuaBerkas();
const total = daftar.reduce((a, b) => a + Math.max(0, b.ukuran), 0);
console.log(`Supabase ${bucket}: ${daftar.length} berkas, ${mb(total)}`);

let sama = 0, disalin = 0, gagal = 0, dihapus = 0;
const siapHapus = [];
for (const [i, b] of daftar.entries()) {
  const tujuan = path.join(akar, b.jalur);
  if (!tujuan.startsWith(akar + path.sep)) { console.log("LEWAT jalur aneh:", b.jalur); gagal++; continue; }
  const ada = await ukuranDisk(b.jalur);
  if (ada >= 0 && ada === b.ukuran) { sama++; siapHapus.push(b.jalur); continue; }
  if (mode !== "salin") { console.log(`BELUM di disk: ${b.jalur}`); gagal++; continue; }
  const { data, error } = await storage.download(b.jalur);
  if (error || !data) { console.log(`GAGAL unduh ${b.jalur}: ${error?.message}`); gagal++; continue; }
  const isi = Buffer.from(await data.arrayBuffer());
  await fs.mkdir(path.dirname(tujuan), { recursive: true });
  await fs.writeFile(tujuan + ".sementara", isi, { mode: 0o640 });
  await fs.rename(tujuan + ".sementara", tujuan);
  disalin++;
  siapHapus.push(b.jalur);
  if (disalin % 25 === 0) console.log(`  ${i + 1}/${daftar.length} …`);
}

if (mode === "hapus") {
  for (let i = 0; i < siapHapus.length; i += 100) {
    const potong = siapHapus.slice(i, i + 100);
    const { error } = await storage.remove(potong);
    if (error) { console.log("GAGAL hapus:", error.message); gagal += potong.length; } else dihapus += potong.length;
  }
}
console.log(`Selesai: sama ${sama}, disalin ${disalin}, dihapus dari Supabase ${dihapus}, bermasalah ${gagal}`);
process.exit(gagal ? 2 : 0);
