// Menerjemahkan error teknis (PostgreSQL, jaringan, Supabase Storage) menjadi
// pesan Bahasa Indonesia yang jelas, supaya penyebab kegagalan langsung
// terlihat di layar — bukan sekadar "Silakan coba lagi".

type PgLikeError = {
  code?: string;
  message?: string;
  errno?: string | number;
  cause?: unknown;
};

function flatten(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let i = 0; i < 5 && current; i++) {
    const e = current as PgLikeError;
    if (e.message) parts.push(String(e.message));
    if (e.code) parts.push(String(e.code));
    current = e.cause;
  }
  return parts.join(" | ");
}

export function explainServerError(error: unknown, fallback: string): string {
  const text = flatten(error);
  const lower = text.toLowerCase();

  if (lower.includes("database_url belum diatur") || lower.includes("database_url tidak valid")) {
    return (error as Error).message;
  }
  if (lower.includes("supabase storage belum dikonfigurasi")) {
    return "Konfigurasi belum lengkap: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY belum diatur di environment variables hosting.";
  }
  if (lower.includes("bucket not found")) {
    return "Bucket Supabase Storage \"service-documents\" belum dibuat. Jalankan supabase-storage-migration.sql atau buat bucket lewat Dashboard → Storage.";
  }
  if (lower.includes("upload ke supabase storage gagal") || lower.includes("isi file tidak sesuai")) {
    return (error as Error).message;
  }
  if (lower.includes("password authentication failed") || lower.includes("28p01")) {
    return "Koneksi database ditolak: password pada DATABASE_URL salah. Reset password database di Supabase → Settings → Database, lalu perbarui DATABASE_URL.";
  }
  if (lower.includes("tenant or user not found")) {
    return "Koneksi pooler ditolak: format username DATABASE_URL salah. Gunakan connection string persis dari Supabase → Connect → Transaction pooler (username berformat postgres.xxxx).";
  }
  if (/relation .* does not exist|42p01/.test(lower)) {
    return "Tabel database belum dibuat. Jalankan isi file supabase-setup.sql lalu supabase-update-v2.sql di Supabase → SQL Editor.";
  }
  if (/column .* does not exist|42703/.test(lower)) {
    return "Struktur tabel belum ter-update. Jalankan supabase-update-v2.sql dan supabase-storage-migration.sql di Supabase → SQL Editor.";
  }
  if (
    lower.includes("enetunreach") ||
    lower.includes("ehostunreach") ||
    lower.includes("enotfound") ||
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("connection timeout") ||
    lower.includes("timeout exceeded when trying to connect")
  ) {
    return "Server tidak dapat terhubung ke database. Pastikan DATABASE_URL memakai Transaction pooler Supabase (host ...pooler.supabase.com, port 6543), BUKAN koneksi langsung db.xxx.supabase.co:5432.";
  }
  if (lower.includes("self-signed certificate") || lower.includes("certificate")) {
    return "Koneksi TLS database gagal. Pakai versi kode terbaru (SSL Supabase sudah ditangani otomatis) lalu deploy ulang.";
  }
  return fallback;
}
