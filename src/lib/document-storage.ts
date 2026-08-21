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

export async function uploadDocument(input: {
  folder: "requests" | "revisions" | "proposals";
  ticket: string;
  file: File;
  contentType: string;
}) {
  const extension = documentExtension(input.file.name);
  const baseName = safeSegment(input.file.name.replace(/\.[^.]+$/, ""));
  const path = `${input.folder}/${safeSegment(input.ticket)}/${Date.now()}-${crypto.randomUUID()}-${baseName}.${extension}`;
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
