// Berkas pekerja pdf.js tidak menyertakan berkas tipe sendiri. Yang dipakai
// darinya hanya satu: penangan pesan yang dipasang ke globalThis supaya
// pdf.js mengurai di dalam pekerja kita, bukan menyalakan pekerja tambahan.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
