// ============================================================
// PEKERJA PEMBACA RAR — sumber dari public/vendor/unrar-pekerja.js
//
// Pembaca RAR (node-unrar-js, unrar resmi yang dikompilasi Emscripten)
// membangun fungsinya dengan `new Function`. CSP portal melarang itu di
// halaman mana pun, dan memang harus tetap begitu. Maka pembacanya dijalankan
// di Web Worker tersendiri yang punya CSP-nya sendiri (lihat next.config.ts):
// hanya berkas pekerja ini yang boleh membangun fungsi, dan pekerja tidak
// dapat menyentuh halaman, DOM, maupun penyimpanan halaman.
//
// Dibangun ulang dengan:  npm run pekerja-rar
// (perlu dijalankan HANYA bila versi node-unrar-js dinaikkan).
// ============================================================
import { createExtractorFromData } from "node-unrar-js/esm/index.esm.js";

let wasm = null;
let antrean = Promise.resolve();

async function bongkar(data) {
  wasm ??= await fetch("/vendor/unrar.wasm").then((j) => {
    if (!j.ok) throw new Error("berkas unrar.wasm tidak ditemukan");
    return j.arrayBuffer();
  });
  const ekstraktor = await createExtractorFromData({ wasmBinary: wasm, data });
  const isi = [];
  for (const f of ekstraktor.extract().files) {
    if (f.fileHeader.flags.directory || !f.extraction || f.fileHeader.flags.encrypted) continue;
    isi.push({ nama: f.fileHeader.name.replace(/\\/g, "/"), data: f.extraction });
  }
  return isi;
}

self.onmessage = (e) => {
  const { id, data } = e.data;
  // Satu per satu: pustakanya memakai satu ekstraktor global.
  antrean = antrean.then(async () => {
    try {
      const isi = await bongkar(data);
      self.postMessage({ id, ok: true, isi }, isi.map((x) => x.data.buffer));
    } catch (galat) {
      self.postMessage({ id, ok: false, pesan: String((galat && galat.message) || galat || "gagal") });
    }
  });
};
