import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// PENTING: koneksi dibuat secara "lazy" (saat query pertama), BUKAN saat modul
// di-import. Next.js meng-import file route pada saat `next build`, sehingga
// jika kita melempar error di sini ketika DATABASE_URL kosong, seluruh build
// di Netlify/Vercel akan GAGAL dan situs tetap menyajikan versi lama.

const globalForDb = globalThis as typeof globalThis & {
  __sipalingPool?: Pool;
};

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL belum diatur di environment variables hosting (Netlify/Vercel → Site settings → Environment variables).",
    );
  }

  let host = "";
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error(
      "DATABASE_URL tidak valid. Salin ulang connection string dari Supabase → Connect → Transaction pooler (port 6543).",
    );
  }

  // Supabase mewajibkan/mendukung TLS; sertifikatnya kadang tidak dikenali
  // oleh Node di lingkungan serverless, jadi kita relaksasi verifikasinya
  // khusus untuk host Supabase.
  const isSupabase = /supabase\.(co|com)$/i.test(host) || host.includes("pooler.supabase");

  return new Pool({
    connectionString: databaseUrl,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    max: 3, // ramah serverless: tiap instance function cukup sedikit koneksi
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: true,
  });
}

export function getPool(): Pool {
  if (!globalForDb.__sipalingPool) {
    globalForDb.__sipalingPool = createPool();
  }
  return globalForDb.__sipalingPool;
}

// Proxy agar semua pemakaian `db.select()...` yang sudah ada tetap berjalan
// tanpa perlu mengubah file lain, tetapi inisialisasi tetap lazy.
type Db = ReturnType<typeof drizzle>;

let cachedDb: Db | null = null;

function getDb(): Db {
  if (!cachedDb) {
    cachedDb = drizzle(getPool());
  }
  return cachedDb;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const instance = getPool();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
