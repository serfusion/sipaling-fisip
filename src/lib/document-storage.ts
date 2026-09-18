import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase-config";

export const DOCUMENT_BUCKET = process.env.SUPABASE_DOCUMENT_BUCKET || "service-documents";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/**
 * Batas waktu SATU panggilan ke Supabase Storage.
 *
 * Tanpa batas ini, satu panggilan yang menggantung akan menahan seluruh fungsi
 * sampai platform-nya sendiri yang memutus — dan yang diterima mahasiswa
 * bukan pesan portal melainkan halaman galat 504 milik Vercel, tanpa satu pun
 * keterangan tentang apa yang sebenarnya lambat.
 *
 * 20 detik: cukup longgar untuk unggahan jalur cadangan (≤4 MB lewat fungsi),
 * dan cukup ketat untuk menyisakan waktu bagi pesan portal di dalam anggaran
 * 60 detik milik fungsinya.
 */
const BATAS_PANGGILAN_MS = 20_000;

/** Batas waktu pembacaan kepala berkas; hanya 16 bita, jadi jauh lebih ketat. */
const BATAS_BACA_KEPALA_MS = 10_000;

/**
 * Satu klien untuk seluruh proses.
 *
 * Sebelumnya klien dibuat ULANG pada setiap panggilan. Untuk penyerahan
 * skripsi itu berarti belasan klien dalam satu permintaan — masing-masing
 * dengan pemasangan TLS-nya sendiri ke Supabase, dan seluruhnya menumpuk di
 * jalur kritis yang anggarannya 60 detik.
 */
let klienTersimpan: ReturnType<typeof createClient> | null = null;

/** fetch dengan batas waktu, dipakai seluruh panggilan Storage. */
function fetchBerbatas(masukan: RequestInfo | URL, awalan?: RequestInit) {
  // Pemanggil yang sudah membawa signal-nya sendiri dibiarkan: ia punya batas
  // waktu yang lebih tepat untuk kerjanya (lihat bacaKepalaObjek).
  if (awalan?.signal) return fetch(masukan, awalan);
  return fetch(masukan, { ...awalan, signal: AbortSignal.timeout(BATAS_PANGGILAN_MS) });
}

function getStorageClient() {
  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();
  if (!url || !secretKey) {
    throw new Error("Supabase Storage belum dikonfigurasi di environment variables.");
  }
  if (!klienTersimpan) {
    klienTersimpan = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: fetchBerbatas as typeof fetch },
    });
  }
  return klienTersimpan;
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

type KepalaObjek =
  | { ok: true; ukuran: number; kepala: Uint8Array }
  /** "hilang": bendanya tidak ada. "lambat": penyimpanan tidak menjawab tepat waktu. */
  | { ok: false; sebab: "hilang" | "lambat" };

/**
 * Baca ukuran dan beberapa bita pertama sebuah benda di penyimpanan.
 *
 * SENGAJA hanya potongan pertama: berkas skripsi utuh boleh 25 MB, dan
 * menariknya seluruhnya ke dalam fungsi hanya untuk melihat empat bita
 * pertamanya akan menghabiskan memori sekaligus waktu jalan. Permintaan
 * memakai header Range, dan bacaannya tetap dihentikan sendiri seandainya
 * Range tidak dilayani.
 */
async function bacaKepalaObjek(path: string): Promise<KepalaObjek> {
  const supabase = getStorageClient();
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    // Batas waktu dari fetchBerbatas muncul di sini sebagai error biasa, dan
    // dibedakan dari "tidak ada": yang satu kesalahan mahasiswa, yang lain
    // bukan sama sekali.
    return { ok: false, sebab: lambat(error) ? "lambat" : "hilang" };
  }

  let jawaban: Response;
  try {
    jawaban = await fetch(data.signedUrl, {
      headers: { Range: "bytes=0-15" },
      signal: AbortSignal.timeout(BATAS_BACA_KEPALA_MS),
    });
  } catch (galat: unknown) {
    return { ok: false, sebab: lambat(galat) ? "lambat" : "hilang" };
  }
  if (!jawaban.ok) return { ok: false, sebab: "hilang" };

  // "bytes 0-15/1048576" — angka sesudah garis miring adalah ukuran utuhnya.
  const rentang = jawaban.headers.get("content-range") || "";
  const cocok = /\/(\d+)\s*$/.exec(rentang);
  const ukuran = cocok ? Number(cocok[1]) : Number(jawaban.headers.get("content-length") || 0);

  const pembaca = jawaban.body?.getReader();
  if (!pembaca) return { ok: true, ukuran, kepala: new Uint8Array() };

  // Dibaca sampai cukup untuk mengenali formatnya, lalu DIHENTIKAN. Potongan
  // pertama hampir selalu sudah memuat keenambelas bita yang diminta, tetapi
  // aliran boleh saja memecahnya lebih kecil — dan empat bita pertama itulah
  // satu-satunya yang menentukan.
  const potongan: Uint8Array[] = [];
  let terkumpul = 0;
  try {
    while (terkumpul < 8) {
      const { value, done } = await pembaca.read();
      if (done) break;
      if (value) {
        potongan.push(value);
        terkumpul += value.length;
      }
    }
  } catch (galat: unknown) {
    return { ok: false, sebab: lambat(galat) ? "lambat" : "hilang" };
  } finally {
    await pembaca.cancel().catch(() => undefined);
  }

  const kepala = new Uint8Array(terkumpul);
  let posisi = 0;
  for (const p of potongan) {
    kepala.set(p, posisi);
    posisi += p.length;
  }
  return { ok: true, ukuran, kepala };
}

/** Kegagalan ini karena waktunya habis, bukan karena bendanya tidak ada? */
function lambat(galat: unknown) {
  const nama = (galat as { name?: string } | null)?.name || "";
  const pesan = String((galat as { message?: string } | null)?.message || "").toLowerCase();
  return (
    nama === "TimeoutError" ||
    nama === "AbortError" ||
    pesan.includes("timeout") ||
    pesan.includes("aborted") ||
    pesan.includes("fetch failed")
  );
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
  if (!kepala.ok) {
    if (kepala.sebab === "lambat") {
      return {
        ok: false,
        pesan:
          `Penyimpanan tidak menjawab saat memeriksa berkas "${namaBagian}". ` +
          "Ini gangguan sementara di sisi penyimpanan, bukan berkas Anda. Kirim lagi beberapa saat lagi.",
      };
    }
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

// CATATAN: moveDocument DIHAPUS pada v45.
//
// Dulu berkas penyerahan dipindahkan dari folder transit ke folder tiketnya
// pada detik formulirnya masuk. Pemindahan di Supabase Storage adalah SALINAN
// seluruh isi berkas, dan untuk satu penyerahan itu berarti menyalin sampai
// 55 MB — empat kali, berurutan, di dalam satu fungsi serverless yang
// anggarannya 60 detik. Itulah yang membuat penyerahan berkas besar berakhir
// sebagai galat 504, dan yang lebih buruk: percobaan berikutnya tidak lagi
// menemukan berkasnya di transit, sehingga TIDAK ADA percobaan yang bisa
// berhasil.
//
// Sekarang jalur transitnya dicatat apa adanya. Penyapu di /api/cleanup sudah
// sejak awal menolak menghapus jalur yang masih ditunjuk basis data, jadi
// berkas yang sudah diklaim tiket aman di tempatnya.

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
