import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  buktiKosong,
  entropiTernormalkan,
  median,
  nilaiJurnal,
  type Bukti,
} from "@/lib/journal-radar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// RADAR JURNAL: pengumpul bukti.
//
// Seluruh sumber di sini gratis, publik, dan tidak menuntut kunci API:
//   DOAJ     https://doaj.org/api/search/journals/issn:XXXX-XXXX
//   Crossref https://api.crossref.org/journals/XXXX-XXXX
//   OpenAlex https://api.openalex.org/sources/issn:XXXX-XXXX
//
// Crossref dan OpenAlex meminta alamat surel kontak pada permintaan agar
// masuk ke "polite pool" yang lebih stabil. Diisi lewat RADAR_CONTACT_EMAIL.
//
// Tanpa login: alat ini memang ditujukan untuk mahasiswa yang belum tentu
// punya akun. Yang membatasi penyalahgunaan adalah pembatas laju di bawah.

const KONTAK = process.env.RADAR_CONTACT_EMAIL || "";
const BATAS_WAKTU_MS = 9_000;
const UA = "SiPalingFISIP-RadarJurnal/1.0 (https://www.sipalingfisip.web.id)";

type Json = Record<string, unknown>;

/** Ambil JSON dengan batas waktu. Mengembalikan null bila sumber gagal. */
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
    // Satu sumber yang gagal tidak boleh menggagalkan seluruh pemeriksaan.
    // pemeriksaan yang tidak terjadi dilaporkan apa adanya kepada pengguna.
    return null;
  } finally {
    clearTimeout(jam);
  }
}

function berkontak(url: string) {
  if (!KONTAK) return url;
  return `${url}${url.includes("?") ? "&" : "?"}mailto=${encodeURIComponent(KONTAK)}`;
}

const POLA_ISSN = /^\d{4}-\d{3}[\dxX]$/;

function bakukanIssn(nilai: string) {
  const bersih = nilai.trim().toUpperCase().replace(/\s+/g, "");
  const berstrip = /^\d{8}$/.test(bersih) ? `${bersih.slice(0, 4)}-${bersih.slice(4)}` : bersih;
  return POLA_ISSN.test(berstrip) ? berstrip : null;
}

function angka(nilai: unknown): number | null {
  const n = Number(nilai);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// DOAJ
// ---------------------------------------------------------------------------
async function periksaDoaj(issn: string, bukti: Bukti) {
  const data = await ambil(`https://doaj.org/api/search/journals/issn:${encodeURIComponent(issn)}`);
  if (!data) return;

  const hasil = Array.isArray(data.results) ? (data.results as Json[]) : [];
  if (hasil.length === 0) {
    bukti.doajTerdaftar = false;
    return;
  }

  bukti.doajTerdaftar = true;
  const bibjson = (hasil[0].bibjson ?? {}) as Json;

  if (!bukti.nama) {
    const judul = bibjson.title;
    if (typeof judul === "string") bukti.nama = judul;
  }

  // DOAJ mencatat jenis telaah sejawat sebagai bagian penilaian transparansi.
  const editorial = (bibjson.editorial ?? {}) as Json;
  const telaah = editorial.review_process;
  bukti.doajTelaahDinyatakan = Array.isArray(telaah)
    ? telaah.length > 0
    : typeof telaah === "string"
      ? telaah.trim().length > 0
      : false;

  // Biaya publikasi: dianggap terungkap bila DOAJ punya catatan APC yang tegas,
  // baik berbayar dengan nominal maupun dinyatakan tanpa biaya.
  const apc = (bibjson.apc ?? {}) as Json;
  const adaApc = apc.has_apc;
  if (adaApc === false) {
    bukti.doajBiayaDiungkap = true;
  } else if (adaApc === true) {
    const daftar = Array.isArray(apc.max) ? (apc.max as Json[]) : [];
    bukti.doajBiayaDiungkap = daftar.some((baris) => angka(baris.price) !== null);
  }
}

// ---------------------------------------------------------------------------
// Crossref: pendaftaran DOI dan kecepatan telaah
// ---------------------------------------------------------------------------
async function periksaCrossref(issn: string, bukti: Bukti) {
  const jurnal = await ambil(berkontak(`https://api.crossref.org/journals/${encodeURIComponent(issn)}`));
  if (!jurnal) return;

  const pesan = (jurnal.message ?? {}) as Json;
  const jumlah = angka((pesan.counts as Json | undefined)?.["total-dois"]);
  bukti.crossrefMenyetorDoi = jumlah !== null && jumlah > 0;
  bukti.crossrefJumlahKarya = jumlah;
  if (!bukti.nama && typeof pesan.title === "string") bukti.nama = pesan.title;

  // Kecepatan telaah hanya dapat dihitung bila penerbit menyetorkan riwayat
  // tanggalnya. Banyak yang tidak, dan itu dilaporkan sebagai tak terperiksa.
  const karya = await ambil(
    berkontak(
      `https://api.crossref.org/journals/${encodeURIComponent(issn)}/works` +
        `?rows=200&sort=published&order=desc&select=created,published-print,published-online,issued`,
    ),
  );
  if (!karya) return;

  const daftar = ((karya.message as Json | undefined)?.items ?? []) as Json[];
  const selisih: number[] = [];
  for (const item of daftar) {
    const dibuat = bagianTanggal(item.created);
    const terbit = bagianTanggal(item["published-online"]) ?? bagianTanggal(item["published-print"]) ?? bagianTanggal(item.issued);
    if (dibuat === null || terbit === null) continue;
    const hari = Math.round((terbit - dibuat) / 86_400_000);
    // Nilai negatif berarti terbit mendahului pendaftaran DOI, jadi abaikan.
    if (hari >= 0 && hari < 1500) selisih.push(hari);
  }

  if (selisih.length > 0) {
    bukti.medianHariTelaah = median(selisih);
    bukti.sampelHariTelaah = selisih.length;
  }
}

function bagianTanggal(nilai: unknown): number | null {
  if (!nilai || typeof nilai !== "object") return null;
  const bagian = (nilai as Json)["date-parts"];
  if (!Array.isArray(bagian) || !Array.isArray(bagian[0])) return null;
  const [tahun, bulan, hari] = bagian[0] as number[];
  if (!tahun) return null;
  return Date.UTC(tahun, (bulan ?? 1) - 1, hari ?? 1);
}

// ---------------------------------------------------------------------------
// OpenAlex: perilaku penerbitan
// ---------------------------------------------------------------------------
async function periksaOpenAlex(issn: string, bukti: Bukti) {
  const sumber = await ambil(berkontak(`https://api.openalex.org/sources/issn:${encodeURIComponent(issn)}`));
  if (!sumber) return;

  if (!bukti.nama && typeof sumber.display_name === "string") bukti.nama = sumber.display_name;
  if (!bukti.situs && typeof sumber.homepage_url === "string") bukti.situs = sumber.homepage_url;

  // Riwayat volume dan sitasi diri.
  const perTahun = Array.isArray(sumber.counts_by_year) ? (sumber.counts_by_year as Json[]) : [];
  const berurut = perTahun
    .map((b) => ({ tahun: angka(b.year) ?? 0, karya: angka(b.works_count) ?? 0 }))
    .filter((b) => b.tahun > 0)
    .sort((a, b) => b.tahun - a.tahun);

  if (berurut.length >= 2 && berurut[1].karya > 0) {
    bukti.rasioLonjakanVolume = berurut[0].karya / berurut[1].karya;
  }

  // Sitasi diri sengaja belum dihitung: OpenAlex tidak menyediakannya langsung
  // dan menghitungnya menuntut penelusuran seluruh sitasi masuk. Sampai itu
  // dikerjakan, pemeriksaan ini dilaporkan sebagai tidak dilakukan.

  // Tahun terbit paling awal dari riwayat yang tersedia.
  if (berurut.length > 0) {
    const paling = berurut[berurut.length - 1];
    bukti.tahunTerbitAwal = paling.tahun;
  }

  const idSumber = typeof sumber.id === "string" ? sumber.id.split("/").pop() : null;
  if (!idSumber) return;

  // Sebaran topik dan negara penulis dari artikel dua tahun terakhir.
  const tahunIni = new Date().getFullYear();
  const karya = await ambil(
    berkontak(
      `https://api.openalex.org/works?filter=primary_location.source.id:${idSumber},` +
        `from_publication_date:${tahunIni - 1}-01-01&per-page=200&select=topics,authorships`,
    ),
  );
  if (!karya) return;

  const daftar = Array.isArray(karya.results) ? (karya.results as Json[]) : [];
  if (daftar.length < 10) return; // sampel terlalu kecil untuk disimpulkan

  const perTopik = new Map<string, number>();
  const perNegara = new Map<string, number>();

  for (const item of daftar) {
    const topik = Array.isArray(item.topics) ? (item.topics as Json[]) : [];
    const bidang = (topik[0]?.field as Json | undefined)?.display_name;
    if (typeof bidang === "string") perTopik.set(bidang, (perTopik.get(bidang) ?? 0) + 1);

    const penulis = Array.isArray(item.authorships) ? (item.authorships as Json[]) : [];
    for (const a of penulis) {
      const negara = Array.isArray(a.countries) ? (a.countries as string[]) : [];
      for (const n of negara) perNegara.set(n, (perNegara.get(n) ?? 0) + 1);
    }
  }

  if (perTopik.size > 0) {
    bukti.entropiCakupan = entropiTernormalkan([...perTopik.values()]);
  }
  if (perNegara.size > 0) {
    const total = [...perNegara.values()].reduce((a, b) => a + b, 0);
    const terbanyak = Math.max(...perNegara.values());
    if (total > 0) bukti.pemusatanNegara = terbanyak / total;
  }
}

// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Pemeriksaan memanggil beberapa API luar, jadi lajunya dibatasi ketat.
  const batas = rateLimit({ request, name: "journal-radar", limit: 12, windowMs: 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  let muatan: { issn?: unknown; nama?: unknown; sinta?: unknown; metrik?: unknown };
  try {
    muatan = (await request.json()) as typeof muatan;
  } catch {
    return Response.json({ success: false, message: "Permintaan tidak terbaca." }, { status: 400 });
  }

  const issn = typeof muatan.issn === "string" ? bakukanIssn(muatan.issn) : null;
  if (!issn) {
    return Response.json(
      {
        success: false,
        message: "Masukkan ISSN yang sah, misalnya 2089-3477. ISSN ada di halaman depan jurnal.",
      },
      { status: 400 },
    );
  }

  const bukti = buktiKosong(typeof muatan.nama === "string" ? muatan.nama.slice(0, 200) : "", [issn]);

  // Jawaban pengguna atas hal yang tidak dapat diperiksa otomatis.
  if (muatan.sinta === true) bukti.sintaTerakreditasi = true;
  if (Array.isArray(muatan.metrik)) {
    bukti.metrikPalsu = (muatan.metrik as unknown[]).filter((m): m is string => typeof m === "string").slice(0, 10);
  }

  try {
    // Ketiganya berjalan bersamaan; masing-masing sudah menelan kegagalannya.
    await Promise.all([periksaDoaj(issn, bukti), periksaCrossref(issn, bukti), periksaOpenAlex(issn, bukti)]);

    if (!bukti.nama) bukti.nama = `Jurnal dengan ISSN ${issn}`;

    return Response.json({ success: true, hasil: nilaiJurnal(bukti), bukti });
  } catch (error: unknown) {
    console.error("journal-radar", error);
    return Response.json(
      { success: false, message: "Pemeriksaan gagal diselesaikan. Coba lagi sebentar lagi." },
      { status: 500 },
    );
  }
}
