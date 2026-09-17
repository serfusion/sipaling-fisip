import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase-config";

export const DOCUMENT_BUCKET = process.env.SUPABASE_DOCUMENT_BUCKET || "service-documents";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function getStorageClient() {
  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();
  if (!url || !secretKey) {
    throw new Error("Supabase Storage belum dikonfigurasi di environment variables.");
  }
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function safeSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "document";
}

// Ekstensi yang dikenali beserta cara memverifikasi isinya (magic bytes),
// supaya file yang hanya "berganti nama ekstensi" tidak lolos.
const CONTENT_CHECKS: Record<string, (bytes: Buffer) => boolean> = {
  pdf: (b) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46, // %PDF
  docx: (b) => b.length > 2 && b[0] === 0x50 && b[1] === 0x4b, // PK (docx = zip)
  jpg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
};

export function documentExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  return "docx";
}

/** Jalur tetap sebuah dokumen di dalam folder tiketnya. */
export function buatJalurDokumen(input: {
  folder: "requests" | "revisions" | "proposals";
  ticket: string;
  fileName: string;
}) {
  const extension = documentExtension(input.fileName);
  const baseName = safeSegment(input.fileName.replace(/\.[^.]+$/, ""));
  return `${input.folder}/${safeSegment(input.ticket)}/${Date.now()}-${crypto.randomUUID()}-${baseName}.${extension}`;
}

export async function uploadDocument(input: {
  folder: "requests" | "revisions" | "proposals";
  ticket: string;
  file: File;
  contentType: string;
}) {
  const extension = documentExtension(input.file.name);
  const path = buatJalurDokumen({ folder: input.folder, ticket: input.ticket, fileName: input.file.name });
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const isValidContent = CONTENT_CHECKS[extension];
  if (!isValidContent || !isValidContent(bytes)) {
    throw new Error("Isi file tidak sesuai dengan format " + extension.toUpperCase() + ". Silakan unggah file asli.");
  }
  const supabase = getStorageClient();
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, bytes, {
    contentType: input.contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    throw new Error(`Upload ke Supabase Storage gagal: ${error.message}`);
  }
  return path;
}

export async function removeDocument(path: string | null | undefined) {
  if (!path) return;
  const supabase = getStorageClient();
  await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
}

/**
 * Izin unggah langsung dari peramban ke Supabase Storage.
 *
 * Jalurnya ditentukan pemanggil (server), bukan peramban, dan tokennya hanya
 * berlaku untuk jalur itu. Dengan begitu berkas sebesar apa pun dapat naik
 * tanpa melewati fungsi serverless — yang badannya dipotong pada 4,5 MB.
 */
export async function buatIzinUnggah(path: string) {
  const supabase = getStorageClient();
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl || !data?.token) {
    throw new Error(`Izin unggah gagal dibuat: ${error?.message || "jawaban Storage tidak lengkap."}`);
  }
  return { url: data.signedUrl, token: data.token, path };
}

/**
 * Baca ukuran dan beberapa bita pertama sebuah benda di penyimpanan.
 *
 * SENGAJA hanya potongan pertama: berkas skripsi utuh boleh 25 MB, dan
 * menariknya seluruhnya ke dalam fungsi hanya untuk melihat empat bita
 * pertamanya akan menghabiskan memori sekaligus waktu jalan. Permintaan
 * memakai header Range, dan bacaannya tetap dihentikan sendiri seandainya
 * Range tidak dilayani.
 */
async function bacaKepalaObjek(path: string) {
  const supabase = getStorageClient();
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return null;

  const jawaban = await fetch(data.signedUrl, { headers: { Range: "bytes=0-15" } });
  if (!jawaban.ok) return null;

  // "bytes 0-15/1048576" — angka sesudah garis miring adalah ukuran utuhnya.
  const rentang = jawaban.headers.get("content-range") || "";
  const cocok = /\/(\d+)\s*$/.exec(rentang);
  const ukuran = cocok ? Number(cocok[1]) : Number(jawaban.headers.get("content-length") || 0);

  const pembaca = jawaban.body?.getReader();
  if (!pembaca) return { ukuran, kepala: new Uint8Array() };

  // Dibaca sampai cukup untuk mengenali formatnya, lalu DIHENTIKAN. Potongan
  // pertama hampir selalu sudah memuat keenambelas bita yang diminta, tetapi
  // aliran boleh saja memecahnya lebih kecil — dan empat bita pertama itulah
  // satu-satunya yang menentukan.
  const potongan: Uint8Array[] = [];
  let terkumpul = 0;
  while (terkumpul < 8) {
    const { value, done } = await pembaca.read();
    if (done) break;
    if (value) {
      potongan.push(value);
      terkumpul += value.length;
    }
  }
  await pembaca.cancel().catch(() => undefined);

  const kepala = new Uint8Array(terkumpul);
  let posisi = 0;
  for (const p of potongan) {
    kepala.set(p, posisi);
    posisi += p.length;
  }
  return { ukuran, kepala };
}

/**
 * Pemeriksaan berkas yang diunggah peramban langsung ke penyimpanan.
 *
 * Berkas yang tidak melewati server tidak pernah diperiksa server — kecuali
 * di sini. Yang diperiksa persis sama dengan yang diperiksa uploadDocument
 * pada jalur lama: ukurannya, dan isinya benar-benar PDF (bukan berkas lain
 * yang ekstensinya diganti).
 */
export async function periksaObjekPdf(
  path: string,
  maksBita: number,
  namaBagian: string,
): Promise<{ ok: true; ukuran: number } | { ok: false; pesan: string }> {
  const kepala = await bacaKepalaObjek(path);
  if (!kepala) {
    return {
      ok: false,
      pesan: `Berkas "${namaBagian}" tidak ditemukan di penyimpanan. Pilih ulang berkasnya lalu kirim lagi.`,
    };
  }
  if (kepala.ukuran <= 0) {
    return { ok: false, pesan: `Berkas "${namaBagian}" kosong. Pilih ulang berkasnya lalu kirim lagi.` };
  }
  if (kepala.ukuran > maksBita) {
    const mb = (kepala.ukuran / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      pesan:
        `Berkas "${namaBagian}" berukuran ${mb} MB, melebihi batas ` +
        `${Math.round(maksBita / (1024 * 1024))} MB.`,
    };
  }
  if (!CONTENT_CHECKS.pdf(Buffer.from(kepala.kepala))) {
    return {
      ok: false,
      pesan: `Isi berkas "${namaBagian}" bukan PDF. Silakan unggah berkas PDF yang asli.`,
    };
  }
  return { ok: true, ukuran: kepala.ukuran };
}

/**
 * Pindahkan benda di dalam bucket, tanpa menariknya ke dalam fungsi.
 *
 * Dipakai untuk memindahkan berkas dari folder transit ke folder tiket
 * sesudah formulirnya benar-benar terkirim. Dengan begitu apa pun yang masih
 * tertinggal di transit dapat dipastikan yatim, dan boleh disapu.
 */
export async function moveDocument(dari: string, ke: string) {
  const supabase = getStorageClient();
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).move(dari, ke);
  if (error) {
    throw new Error(`Pemindahan berkas di penyimpanan gagal: ${error.message}`);
  }
  return ke;
}

export async function createDocumentDownloadUrl(path: string, fileName: string) {
  const supabase = getStorageClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(path, 60, { download: fileName });
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Tautan unduhan tidak dapat dibuat.");
  }
  return data.signedUrl;
}
