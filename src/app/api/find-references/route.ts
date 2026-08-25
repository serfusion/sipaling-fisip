import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  dariOpenAlex,
  kataKunci,
  nilaiKecocokan,
  type Karya,
  type KaryaOpenAlex,
  type Saringan,
} from "@/lib/referensi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CARI REFERENSI: pengambil data.
//
// Sumber: OpenAlex (https://api.openalex.org/works). Gratis, publik, tanpa
// kunci API, dan menyertakan jumlah sitasi, tautan naskah terbuka, serta
// keterangan apakah jurnalnya terdaftar di DOAJ. Karena itu satu permintaan
// sudah cukup; tidak perlu memanggil DOAJ secara terpisah.
//
// OpenAlex meminta alamat surel kontak agar permintaan masuk ke "polite pool"
// yang lebih stabil. Diisi lewat RADAR_CONTACT_EMAIL, sama seperti Radar Jurnal.

const KONTAK = process.env.RADAR_CONTACT_EMAIL || "";
// Dapat diarahkan ke tiruan saat pengujian; bawaannya katalog sesungguhnya.
const DASAR = process.env.OPENALEX_BASE_URL || "https://api.openalex.org";
const BATAS_WAKTU_MS = 10_000;
const UA = "SiPalingFISIP-CariReferensi/1.0 (https://www.sipalingfisip.web.id)";
const MAKS_HASIL = 25;

type Json = Record<string, unknown>;

function gagal(pesan: string, kode = 400) {
  return Response.json({ success: false, message: pesan }, { status: kode });
}

export async function POST(request: Request) {
  const batas = rateLimit({ request, name: "find-references", limit: 20, windowMs: 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  let badan: Json;
  try {
    badan = (await request.json()) as Json;
  } catch {
    return gagal("Permintaan tidak terbaca.");
  }

  const pertanyaan = typeof badan.pertanyaan === "string" ? badan.pertanyaan.trim() : "";
  if (pertanyaan.length < 3) return gagal("Tuliskan topik atau pertanyaan penelitian Anda lebih dahulu.");
  if (pertanyaan.length > 300) return gagal("Topik terlalu panjang. Ringkas menjadi paling banyak 300 huruf.");

  const s = (badan.saringan ?? {}) as Partial<Saringan>;
  const tahunKini = new Date().getFullYear();
  const tahunMinimal =
    typeof s.tahunMinimal === "number" && s.tahunMinimal >= 1900 && s.tahunMinimal <= tahunKini
      ? Math.floor(s.tahunMinimal)
      : tahunKini - 10;
  const bahasa = s.bahasa === "en" || s.bahasa === "id" ? s.bahasa : "semua";

  // Saringan inti selalu dipakai; saringan lanjutan dipisahkan karena bila
  // salah satu namanya tidak dikenali katalog, OpenAlex menolak seluruh
  // permintaan. Lebih baik mahasiswa menerima hasil tanpa satu saringan
  // daripada menerima layar galat.
  const saringInti = [`from_publication_date:${tahunMinimal}-01-01`, "type:article"];
  const saringLanjut = [
    ...(s.hanyaBisaDiunduh ? ["is_oa:true"] : []),
    ...(s.hanyaDoaj ? ["primary_location.source.is_in_doaj:true"] : []),
    ...(bahasa !== "semua" ? [`language:${bahasa}`] : []),
  ];

  function alamatUntuk(saring: string[]) {
    const alamat = new URL(`${DASAR}/works`);
    alamat.searchParams.set("search", pertanyaan);
    alamat.searchParams.set("filter", saring.join(","));
    alamat.searchParams.set("per_page", String(MAKS_HASIL));
    alamat.searchParams.set("sort", "relevance_score:desc");
    if (KONTAK) alamat.searchParams.set("mailto", KONTAK);
    return alamat.toString();
  }

  const kendali = new AbortController();
  const jam = setTimeout(() => kendali.abort(), BATAS_WAKTU_MS);
  const ambil = (url: string) =>
    fetch(url, {
      signal: kendali.signal,
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
    });

  try {
    let balasan = await ambil(alamatUntuk([...saringInti, ...saringLanjut]));
    let saringanDilepas = false;

    // 400 dan 403 dari OpenAlex menandakan saringan yang ditolak, bukan
    // gangguan jaringan. Coba sekali lagi tanpa saringan lanjutan.
    if (!balasan.ok && saringLanjut.length > 0 && (balasan.status === 400 || balasan.status === 403)) {
      balasan = await ambil(alamatUntuk(saringInti));
      saringanDilepas = balasan.ok;
    }

    if (!balasan.ok) {
      return gagal(
        balasan.status === 429
          ? "Katalog OpenAlex sedang membatasi permintaan. Coba lagi sebentar lagi."
          : "Katalog OpenAlex sedang tidak dapat dihubungi. Ini gangguan sementara di sisi mereka, bukan kesalahan Anda.",
        502,
      );
    }

    const data = (await balasan.json()) as { results?: KaryaOpenAlex[] };
    const kunci = kataKunci(pertanyaan);
    const hasil = (data.results ?? [])
      .map(dariOpenAlex)
      .filter((k): k is Karya => k !== null)
      .sort((a, b) => nilaiKecocokan(b, kunci, tahunKini) - nilaiKecocokan(a, kunci, tahunKini));

    return Response.json({
      success: true,
      hasil,
      ringkasan: {
        total: hasil.length,
        bisaDiunduh: hasil.filter((k) => k.bisaDiunduh).length,
        diDoaj: hasil.filter((k) => k.diDoaj).length,
        adaAbstrak: hasil.filter((k) => k.abstrak.length > 0).length,
        kunci,
        saringanDilepas,
      },
    });
  } catch (alasan: unknown) {
    const putus = alasan instanceof Error && alasan.name === "AbortError";
    return gagal(
      putus
        ? "Pencarian melebihi batas waktu. Coba persempit topiknya."
        : "Pencarian gagal dijalankan. Periksa sambungan internet Anda.",
      502,
    );
  } finally {
    clearTimeout(jam);
  }
}
