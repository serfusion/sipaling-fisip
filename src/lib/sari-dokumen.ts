// ============================================================
// MENYARIKAN TEKS DARI DOKUMEN — di peramban, bukan di server
//
// Sama seperti pengimpor soal dan pengimpor transkrip: berkasnya diurai di
// komputer dosennya sendiri, dan yang berangkat ke server hanya teksnya.
// Bahan ujian adalah bahan yang belum diujikan; ia tidak perlu singgah di
// tempat lain hanya untuk dijadikan soal.
//
// Tiga bentuk yang didukung, dan ketiganya memang yang dipakai dosen:
//   .docx  lewat mammoth, pustaka yang sudah ada untuk template surat
//   .pdf   lewat pdfjs-dist, yang sudah ada untuk pemeriksa naskah
//   .pptx  lewat pembaca zip sendiri — sebuah pptx adalah zip berisi satu XML
//          per salindia
// ============================================================
import { bacaZip } from "@/lib/baca-zip";

export type HasilSari = {
  teks: string;
  /** Jumlah kata, untuk ditunjukkan sebelum dosen menekan "buat soal". */
  kata: number;
  /** Halaman untuk PDF, salindia untuk PPTX, 0 untuk yang lain. */
  bagian: number;
  jenis: "docx" | "pdf" | "pptx";
};

function rapikan(teks: string) {
  return teks
    .replace(/\r/g, "")
    // Tiga baris kosong beruntun atau lebih dipadatkan jadi satu jeda.
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function hitungKata(teks: string) {
  return teks.trim().split(/\s+/).filter(Boolean).length;
}

async function dariDocx(berkas: File): Promise<HasilSari> {
  const mammoth = await import("mammoth");
  const hasil = await mammoth.extractRawText({ arrayBuffer: await berkas.arrayBuffer() });
  const teks = rapikan(hasil.value || "");
  return { teks, kata: hitungKata(teks), bagian: 0, jenis: "docx" };
}

async function dariPdf(berkas: File): Promise<HasilSari> {
  const pdfjs = await import("pdfjs-dist");
  // Pekerja dimatikan: memuat berkas pekerja terpisah menuntut penyajian
  // berkas statis tambahan, dan CSP portal ini melarang skrip dari luar.
  // Untuk dokumen bahan ajar yang beberapa puluh halaman, menguraikannya di
  // untai utama masih dalam batas wajar.
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await berkas.arrayBuffer()),
    disableWorker: true,
    isEvalSupported: false,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;

  const potongan: string[] = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const halaman = await pdf.getPage(n);
    const isi = await halaman.getTextContent();
    const baris = isi.items
      .map((item) => (typeof item === "object" && item && "str" in item ? String(item.str) : ""))
      .join(" ");
    if (baris.trim()) potongan.push(baris);
  }
  const teks = rapikan(potongan.join("\n\n"));
  return { teks, kata: hitungKata(teks), bagian: pdf.numPages, jenis: "pdf" };
}

/** Urutkan salindia menurut nomornya, bukan menurut abjad namanya. */
function nomorSalindia(nama: string) {
  const cocok = nama.match(/slide(\d+)\.xml$/i);
  return cocok ? Number(cocok[1]) : 0;
}

async function dariPptx(berkas: File): Promise<HasilSari> {
  const isi = await bacaZip(
    await berkas.arrayBuffer(),
    // Hanya salindia dan catatannya. Gambar, tema, dan font di dalam arsip
    // tidak ada gunanya di sini dan hanya menghabiskan memori bila ikut
    // dimekarkan.
    (nama) => /^ppt\/(slides|notesSlides)\/[^/]+\.xml$/i.test(nama),
  );

  const salindia = isi
    .filter((b) => /^ppt\/slides\//i.test(b.nama))
    .sort((a, b) => nomorSalindia(a.nama) - nomorSalindia(b.nama));
  const catatan = new Map(
    isi.filter((b) => /^ppt\/notesSlides\//i.test(b.nama)).map((b) => [nomorSalindia(b.nama), b]),
  );

  const potongan: string[] = [];
  for (const [urut, berkasSalindia] of salindia.entries()) {
    const nomor = nomorSalindia(berkasSalindia.nama) || urut + 1;
    const kumpul: string[] = [];
    for (const sumber of [berkasSalindia, catatan.get(nomor)]) {
      if (!sumber) continue;
      const xml = new TextDecoder().decode(sumber.data as BlobPart as never as Uint8Array);
      // <a:t> adalah simpul teks pada OOXML presentasi. Tidak dipakai pengurai
      // XML penuh: yang dibutuhkan hanya isi teksnya, dan pengurai penuh
      // membawa seluruh pohon dokumen yang tidak akan dibaca siapa pun.
      const teksnya = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
        .map((m) => m[1]
          .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"))
        .join(" ")
        .trim();
      if (teksnya) kumpul.push(teksnya);
    }
    if (kumpul.length > 0) potongan.push(`[Salindia ${nomor}] ${kumpul.join("\n")}`);
  }

  const teks = rapikan(potongan.join("\n\n"));
  return { teks, kata: hitungKata(teks), bagian: salindia.length, jenis: "pptx" };
}

/** Sarikan teks dari satu berkas, apa pun bentuknya di antara ketiganya. */
export async function sarikanDokumen(berkas: File): Promise<HasilSari> {
  const nama = berkas.name.toLowerCase();
  if (nama.endsWith(".docx")) return dariDocx(berkas);
  if (nama.endsWith(".pdf")) return dariPdf(berkas);
  if (nama.endsWith(".pptx")) return dariPptx(berkas);
  if (nama.endsWith(".doc") || nama.endsWith(".ppt")) {
    throw new Error(
      "Bentuk lama (.doc / .ppt) belum dapat dibaca. Buka di Word atau PowerPoint, " +
        "lalu simpan ulang sebagai .docx atau .pptx.",
    );
  }
  throw new Error("Berkasnya harus .docx, .pptx, atau .pdf.");
}
