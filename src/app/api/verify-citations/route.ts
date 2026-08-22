import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  dapatDiperiksa,
  kemiripanJudul,
  ringkas,
  simpulkan,
  uraiDaftar,
  type HasilRujukan,
  type Rujukan,
  type Temuan,
} from "@/lib/citation-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// VERIFIKASI SITASI: pencarian ke pangkalan data sitasi publik.
//
//   Crossref https://api.crossref.org/works/{doi}
//            https://api.crossref.org/works?query.bibliographic=...
//   OpenAlex https://api.openalex.org/works?filter=doi:...  / search=...
//
// Keduanya gratis dan tidak menuntut kunci. Alamat kontak pada parameter
// mailto memasukkan permintaan ke "polite pool" yang lebih stabil.

const KONTAK = process.env.RADAR_CONTACT_EMAIL || "";
const BATAS_WAKTU_MS = 8_000;
const MAKS_RUJUKAN = 80;
const UA = "SiPalingFISIP-VerifikasiSitasi/1.0 (https://www.sipalingfisip.web.id)";

type Json = Record<string, unknown>;

async function ambil(url: string): Promise<Json | null> {
  const kendali = new AbortController();
  const jam = setTimeout(() => kendali.abort(), BATAS_WAKTU_MS);
  try {
    const balasan = await fetch(url, {
      signal: kendali.signal,
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
    });
    if (!balasan.ok) return null;
    return (await balasan.json()) as Json;
  } catch {
    return null;
  } finally {
    clearTimeout(jam);
  }
}

function berkontak(url: string) {
  if (!KONTAK) return url;
  return `${url}${url.includes("?") ? "&" : "?"}mailto=${encodeURIComponent(KONTAK)}`;
}

function teks(nilai: unknown): string | null {
  if (typeof nilai === "string") return nilai;
  if (Array.isArray(nilai) && typeof nilai[0] === "string") return nilai[0];
  return null;
}

function tahunCrossref(item: Json): number | null {
  for (const kunci of ["published-print", "published-online", "issued", "created"]) {
    const bagian = (item[kunci] as Json | undefined)?.["date-parts"];
    if (Array.isArray(bagian) && Array.isArray(bagian[0])) {
      const t = Number((bagian[0] as number[])[0]);
      if (Number.isFinite(t)) return t;
    }
  }
  return null;
}

function penulisCrossref(item: Json): string | null {
  const daftar = item.author;
  if (!Array.isArray(daftar) || daftar.length === 0) return null;
  const pertama = daftar[0] as Json;
  const keluarga = teks(pertama.family) ?? teks(pertama.name);
  return keluarga;
}

function jadikanTemuan(item: Json, judulRujukan: string | null): Temuan {
  const judul = teks(item.title);
  return {
    judul,
    tahun: tahunCrossref(item),
    penulisPertama: penulisCrossref(item),
    doi: teks(item.DOI),
    sumber: "Crossref",
    kemiripanJudul: judul && judulRujukan ? kemiripanJudul(judulRujukan, judul) : 0,
  };
}

/** Cari lewat DOI: jalur paling meyakinkan bila DOI tersedia. */
async function lewatDoi(rujukan: Rujukan): Promise<Temuan | null> {
  if (!rujukan.doi) return null;
  const data = await ambil(berkontak(`https://api.crossref.org/works/${encodeURIComponent(rujukan.doi)}`));
  const item = data?.message as Json | undefined;
  if (!item) return null;
  const temuan = jadikanTemuan(item, rujukan.judul);
  // DOI yang berhasil di-resolve sudah membuktikan karyanya ada. Bila judul
  // tidak dapat dibandingkan, anggap cocok agar tidak salah menuduh.
  if (temuan.judul && !rujukan.judul) temuan.kemiripanJudul = 1;
  return temuan;
}

/** Cari lewat teks bibliografis. */
async function lewatJudul(rujukan: Rujukan): Promise<Temuan | null> {
  const kueri = rujukan.judul || rujukan.mentah;
  if (kueri.length < 8) return null;

  const data = await ambil(
    berkontak(
      `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(kueri.slice(0, 300))}&rows=4&select=title,author,DOI,issued,published-print,published-online,created`,
    ),
  );
  const daftar = (data?.message as Json | undefined)?.items;
  if (!Array.isArray(daftar) || daftar.length === 0) return null;

  let terbaik: Temuan | null = null;
  for (const item of daftar as Json[]) {
    const kandidat = jadikanTemuan(item, rujukan.judul);
    if (!terbaik || kandidat.kemiripanJudul > terbaik.kemiripanJudul) terbaik = kandidat;
  }
  return terbaik;
}

/** Cadangan ke OpenAlex bila Crossref tidak menemukan apa pun. */
async function lewatOpenAlex(rujukan: Rujukan): Promise<Temuan | null> {
  const kueri = rujukan.judul;
  if (!kueri || kueri.length < 8) return null;

  const data = await ambil(
    berkontak(
      `https://api.openalex.org/works?search=${encodeURIComponent(kueri.slice(0, 250))}&per-page=3&select=title,publication_year,doi,authorships`,
    ),
  );
  const daftar = data?.results;
  if (!Array.isArray(daftar) || daftar.length === 0) return null;

  let terbaik: Temuan | null = null;
  for (const item of daftar as Json[]) {
    const judul = teks(item.title);
    const penulis = Array.isArray(item.authorships) ? (item.authorships as Json[]) : [];
    const nama = teks((penulis[0]?.author as Json | undefined)?.display_name);
    const kandidat: Temuan = {
      judul,
      tahun: Number(item.publication_year) || null,
      penulisPertama: nama,
      doi: typeof item.doi === "string" ? item.doi.replace("https://doi.org/", "") : null,
      sumber: "OpenAlex",
      kemiripanJudul: judul ? kemiripanJudul(kueri, judul) : 0,
    };
    if (!terbaik || kandidat.kemiripanJudul > terbaik.kemiripanJudul) terbaik = kandidat;
  }
  return terbaik;
}

async function periksaSatu(rujukan: Rujukan): Promise<HasilRujukan> {
  // Jenis yang memang tidak ada di pangkalan data sitasi tidak dicari sama
  // sekali, supaya tidak membuang kuota dan tidak salah menuduh.
  if (!dapatDiperiksa(rujukan.jenis)) return simpulkan(rujukan, null);

  try {
    const lewatDoiHasil = await lewatDoi(rujukan);
    if (lewatDoiHasil) return simpulkan(rujukan, lewatDoiHasil);

    const crossref = await lewatJudul(rujukan);
    if (crossref && crossref.kemiripanJudul >= 0.82) return simpulkan(rujukan, crossref);

    const openalex = await lewatOpenAlex(rujukan);
    const terbaik =
      openalex && (!crossref || openalex.kemiripanJudul > crossref.kemiripanJudul) ? openalex : crossref;

    return simpulkan(rujukan, terbaik);
  } catch {
    return simpulkan(rujukan, null, true);
  }
}

/** Jalankan berkelompok agar tidak membanjiri API pihak ketiga. */
async function berkelompok<T, H>(daftar: T[], ukuran: number, kerja: (x: T) => Promise<H>): Promise<H[]> {
  const hasil: H[] = [];
  for (let i = 0; i < daftar.length; i += ukuran) {
    hasil.push(...(await Promise.all(daftar.slice(i, i + ukuran).map(kerja))));
  }
  return hasil;
}

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "verify-citations", limit: 6, windowMs: 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  let muatan: { daftar?: unknown };
  try {
    muatan = (await request.json()) as typeof muatan;
  } catch {
    return Response.json({ success: false, message: "Permintaan tidak terbaca." }, { status: 400 });
  }

  const teksDaftar = typeof muatan.daftar === "string" ? muatan.daftar : "";
  if (teksDaftar.trim().length < 20) {
    return Response.json(
      { success: false, message: "Tempelkan dulu daftar pustaka Anda." },
      { status: 400 },
    );
  }

  const rujukan = uraiDaftar(teksDaftar.slice(0, 120_000));
  if (rujukan.length === 0) {
    return Response.json(
      {
        success: false,
        message: "Tidak ada rujukan yang bisa diurai. Pastikan tiap rujukan berdiri di barisnya sendiri.",
      },
      { status: 400 },
    );
  }

  const dipakai = rujukan.slice(0, MAKS_RUJUKAN);

  try {
    const hasil = await berkelompok(dipakai, 5, periksaSatu);
    return Response.json({
      success: true,
      hasil,
      ringkasan: ringkas(hasil),
      dipotong: rujukan.length > MAKS_RUJUKAN ? rujukan.length - MAKS_RUJUKAN : 0,
    });
  } catch (error: unknown) {
    console.error("verify-citations", error);
    return Response.json(
      { success: false, message: "Pemeriksaan gagal diselesaikan. Coba lagi sebentar lagi." },
      { status: 500 },
    );
  }
}
