// Pembatas laju sederhana berbasis memori proses.
//
// CATATAN JUJUR SOAL BATASNYA: di Vercel setiap instance serverless punya
// memori sendiri dan bisa didaur ulang kapan saja, jadi penghitung ini
// bersifat "best effort" — cukup meredam banjir permintaan dari satu sumber,
// TETAPI bukan pengganti rate limiting di tepi jaringan. Untuk jaminan yang
// keras, aktifkan rate limiting pada Vercel Firewall/WAF atau pindahkan
// penghitungnya ke penyimpanan bersama (mis. Upstash Redis).

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

function sweep(now: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Masih penuh setelah dibersihkan: kosongkan agar memori tidak membengkak.
  if (buckets.size >= MAX_KEYS) buckets.clear();
}

/** Alamat pemanggil menurut header proxy Vercel. */
export function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return ip.slice(0, 60);
}

export function rateLimit(options: {
  request: Request;
  name: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  sweep(now);
  const key = `${options.name}:${clientKey(options.request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true as const, retryAfter: 0 };
  }
  if (bucket.count >= options.limit) {
    return { ok: false as const, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true as const, retryAfter: 0 };
}

/** Balasan 429 yang seragam beserta header Retry-After. */
export function tooManyRequests(retryAfter: number) {
  return Response.json(
    {
      success: false,
      message: `Terlalu banyak permintaan dari perangkat ini. Coba lagi dalam ${retryAfter} detik.`,
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
