// ============================================================
// DAFTAR DAN RINCIAN NONTON DRAMA
//
// Satu jalur untuk seluruh platform dan seluruh jenis permintaan. Yang
// membedakannya hanya isi tabel di src/lib/drama.ts, dan itu disengaja:
// proyek asalnya memakai delapan puluh berkas rute yang isinya hampir sama,
// dan setiap kali API hulu berubah, kedelapan puluhnya harus dibaca ulang.
//
// TIGA HAL YANG DIKERJAKAN DI SINI, dan tidak satu pun boleh hilang:
//
//   1. Gerbang. Menu ini bonus bagi pemegang kode Cakrawala, jadi jalurnya
//      ikut terkunci. Tanpa ini, seluruh isinya dapat diambil siapa pun yang
//      menebak alamatnya — dan situs ini berubah menjadi API umum yang
//      tagihannya kita yang bayar.
//   2. Pembatas laju, supaya satu perangkat tidak dapat memeras hulu lewat
//      kita.
//   3. Perapian jawaban, supaya layar tidak perlu tahu sepuluh bentuk
//      jawaban yang berbeda.
// ============================================================
import { cakrawalaAccess } from "@/lib/cakrawala-store";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  alamatHulu,
  platformTerbuka,
  UA_HULU,
  type Aksi,
  type Permintaan,
  type Platform,
} from "@/lib/drama";
import {
  bacaDaftar,
  bacaDaftarEpisode,
  bacaEpisodeTunggal,
  bacaHalaman,
  bacaRinci,
  type OpsiAliran,
} from "@/lib/drama-baca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AKSI_SAH = new Set<Aksi>(["populer", "terbaru", "lainnya", "cari", "rinci", "episode"]);

/** Berapa lama menunggu hulu sebelum menyerah. */
const SABAR_MS = 15_000;

function tolak(pesan: string, status: number) {
  return Response.json({ success: false, message: pesan }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string; aksi: string }> },
) {
  // Gerbang lebih dulu, sebelum apa pun yang memakan waktu. Pengunjung yang
  // tidak berhak tidak boleh dapat mengukur apa pun dari lamanya jawaban.
  const akses = await cakrawalaAccess();
  if (!akses.allowed) {
    return tolak("Menu Nonton Drama hanya untuk pemegang kode Cakrawala.", 403);
  }

  const batas = rateLimit({ request, name: "drama-daftar", limit: 120, windowMs: 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  const { platform: namaPlatform, aksi: namaAksi } = await params;
  const platform = platformTerbuka(namaPlatform);
  if (!platform) return tolak("Platform ini tidak dikenali atau sedang dimatikan.", 404);

  const aksi = namaAksi as Aksi;
  if (!AKSI_SAH.has(aksi)) return tolak("Permintaan tidak dikenali.", 404);

  const kueri = new URL(request.url).searchParams;
  const minta: Permintaan = {
    id: kueri.get("id") ?? undefined,
    cari: (kueri.get("cari") ?? "").slice(0, 120),
    episode: kueri.get("episode") ?? undefined,
    halaman: kueri.get("halaman") ?? undefined,
  };

  // Platform bercara "id-episode" mengambil episodenya dengan id episode,
  // bukan dengan id judul. Id itu datang dari halaman rinci, dan layar
  // mengirimkannya lewat parameter yang sama.
  const alamat = alamatHulu(platform, aksi, minta);
  if (!alamat) {
    return tolak(
      aksi === "cari" ? "Kata pencarian belum diisi." : "Permintaan ini tidak dilayani platform tersebut.",
      400,
    );
  }

  try {
    const jawab = await tanyaHulu(alamat);

    if (!jawab.ok) {
      // Kode dari hulu diteruskan apa adanya bila ia bercerita (404 berarti
      // judulnya memang tidak ada), selain itu dijadikan 502: yang gagal
      // bukan permintaan pengunjung, melainkan sambungan kita ke hulu.
      const status = jawab.status === 404 ? 404 : 502;
      return tolak("Sumber dramanya sedang tidak menjawab. Coba lagi sebentar lagi.", status);
    }

    const teks = await jawab.text();
    if (!teks.trim()) return tolak("Sumber dramanya menjawab kosong.", 502);

    let isi: unknown;
    try {
      isi = JSON.parse(teks);
    } catch {
      return tolak("Jawaban sumber dramanya tidak terbaca.", 502);
    }

    return Response.json({ success: true, ...rapikan(platform, aksi, isi, minta) });
  } catch (error: unknown) {
    // Nama platform ikut dicatat supaya yang mati dapat dikenali dari log
    // tanpa menebak — dan itulah yang dibaca penyelarasan tiga harian.
    console.error(`drama ${platform.id}/${aksi}`, error);
    const habisWaktu = error instanceof Error && error.name === "TimeoutError";
    return tolak(
      habisWaktu
        ? "Sumber dramanya terlalu lama menjawab. Coba lagi sebentar lagi."
        : "Sumber dramanya sedang tidak dapat dihubungi.",
      504,
    );
  }
}

/**
 * Bertanya ke hulu, dan bila jawabannya kegagalan sesaat, bertanya sekali lagi.
 *
 * Ini yang menutup keluhan "kadang bisa, kadang tidak". API hulu sesekali
 * menjawab 5xx atau memutus sambungan pada permintaan pertama, lalu menjawab
 * wajar sedetik kemudian; yang menyerah pada percobaan pertama memulangkan
 * layar kosong untuk gangguan yang sudah lewat.
 *
 * Satu ulangan, bukan lebih, dan hanya untuk kegagalan yang memang sesaat:
 * 404 berarti judulnya tidak ada, dan menanyakannya dua kali tetap tidak ada.
 */
async function tanyaHulu(alamat: string): Promise<Response> {
  let terakhir: unknown = null;

  for (let percobaan = 0; percobaan < 2; percobaan += 1) {
    try {
      const jawab = await fetch(alamat, {
        headers: { "User-Agent": UA_HULU, Accept: "application/json,*/*" },
        cache: "no-store",
        signal: AbortSignal.timeout(SABAR_MS),
      });
      if (jawab.ok || (jawab.status < 500 && jawab.status !== 429)) return jawab;
      terakhir = jawab;
    } catch (error: unknown) {
      terakhir = error;
    }
  }

  if (terakhir instanceof Response) return terakhir;
  throw terakhir instanceof Error ? terakhir : new Error("Sumber dramanya tidak dapat dihubungi.");
}

/** Merapikan jawaban hulu menjadi bentuk yang sama untuk seluruh platform. */
function rapikan(platform: Platform, aksi: Aksi, isi: unknown, minta: Permintaan) {
  // Yang diteruskan ke pembaca bukan nama platformnya, melainkan sepotong
  // datanya. Pembaca jawaban tetap tidak boleh mengenal satu pun nama
  // platform — itu yang membuat platform kesebelas cukup ditambahkan di tabel.
  const opsi: OpsiAliran = { kunciLewatHulu: platform.kunciLewatHulu };

  if (aksi === "rinci") {
    return { rinci: bacaRinci(isi, minta.id ?? "", null, opsi) };
  }

  if (aksi === "episode") {
    const nomor = Math.max(1, Math.floor(Number(minta.episode) || 1));
    const daftar = bacaDaftarEpisode(isi, opsi);
    // Jawaban yang membawa banyak episode sekaligus (DramaBox, GoodShort)
    // dipulangkan utuh, dengan nama kolom sendiri. Menumpangkannya pada
    // "daftar" yang dipakai daftar JUDUL akan membuat layar menerima dua
    // bentuk berbeda di bawah satu nama — dan bentuk yang salah tafsir di
    // sana berakhir sebagai deretan kartu tanpa gambar.
    if (daftar.length > 1) return { daftarEpisode: daftar };
    return { episode: bacaEpisodeTunggal(isi, nomor, opsi) };
  }

  // "habis" dipulangkan terpisah dari "kursor" karena keduanya menjawab
  // pertanyaan yang berbeda, dan gulir tak berhingga memerlukan keduanya:
  // daftar berhalaman biasa tidak punya kursor sama sekali, tetapi tetap
  // punya akhir.
  const halaman = bacaHalaman(isi);
  return { daftar: bacaDaftar(isi), kursor: halaman.kursor, habis: halaman.habis };
}
