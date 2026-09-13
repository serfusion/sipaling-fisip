// ============================================================
// PENERUS ALIRAN VIDEO
//
// Potongan video dan daftar putarnya lewat sini, bukan diminta peramban
// langsung ke server platform sumber. Alasannya dua: peramban menolak isi
// dari asal lain (CORS), dan alamat halaman kita tidak perlu ikut terkirim
// ke server orang lain pada tiap potongan.
//
// YANG SENGAJA TIDAK ADA DI SINI: pembongkar wadah khusus buatan platform.
// Proyek asalnya menyertakan satu — potongan ShortMax datang dalam wadah
// dengan kunci yang tertanam di dalam berkasnya sendiri, dan kodenya
// membongkar wadah itu sebelum memutarnya. Menyalin bagian itu berarti
// menulis kode yang satu-satunya guna adalah melepas pengaman isi milik
// orang lain, dan itu tidak disalin. Akibatnya jujur dan terbatas: daftar
// judul ShortMax tetap dapat dijelajahi, pemutarannya yang belum tentu
// jalan, dan layar menontonnya mengatakan itu apa adanya — lihat tanda
// `wadahTersandi` di src/lib/drama.ts.
//
// Selebihnya penerusan biasa: apa yang dikirim hulu diteruskan apa adanya,
// dan daftar putar dituliskan ulang supaya potongannya ikut lewat sini.
// ============================================================
import { cakrawalaAccess } from "@/lib/cakrawala-store";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { alamatAliranHulu, cariPlatform, UA_HULU } from "@/lib/drama";
import { daftarPutar, jenisIsi, tautanAman, tulisUlangDaftarPutar } from "@/lib/drama-aliran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daftar putar kecil dan cepat; potongan video besar dan lambat. */
const SABAR_DAFTAR_MS = 15_000;
const SABAR_POTONGAN_MS = 45_000;

/** Batas isi yang boleh dibaca utuh ke memori sebelum dituliskan ulang. */
const BATAS_DAFTAR = 4 * 1024 * 1024;

export async function GET(request: Request) {
  const akses = await cakrawalaAccess();
  if (!akses.allowed) {
    return new Response("Menu Nonton Drama hanya untuk pemegang kode Cakrawala.", { status: 403 });
  }

  // Batasnya longgar, dan memang harus: satu menit menonton HLS berarti
  // puluhan potongan. Yang ditahan di sini bukan penonton, melainkan
  // pengunduhan beruntun seluruh judul.
  const batas = rateLimit({ request, name: "drama-aliran", limit: 900, windowMs: 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  const kueri = new URL(request.url).searchParams;
  const mentah = kueri.get("url") || "";
  const platform = cariPlatform(kueri.get("platform"));
  const lewatHulu = kueri.get("hulu") === "1";

  // Tautan yang perlu disiapkan hulu dibungkus alamat hulu kita sendiri —
  // jadi yang diperiksa keamanannya alamat hasilnya, bukan isian mentahnya.
  const tujuan = lewatHulu && platform ? alamatAliranHulu(platform, mentah) : mentah;
  const alamat = tujuan ? tautanAman(tujuan) : null;
  if (!alamat) return new Response("Alamat video tidak sah.", { status: 400 });

  const jangkauan = request.headers.get("range");
  const daftar = alamat.pathname.toLowerCase().endsWith(".m3u8");

  try {
    const jawab = await fetch(alamat.href, {
      headers: {
        "User-Agent": UA_HULU,
        Accept: "*/*",
        // Sebagian server potongan menolak permintaan yang isinya dipadatkan
        // di tengah jalan; identity membuat panjangnya tetap dapat dipercaya.
        "Accept-Encoding": "identity",
        ...(jangkauan ? { Range: jangkauan } : {}),
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(daftar ? SABAR_DAFTAR_MS : SABAR_POTONGAN_MS),
    });

    if (!jawab.ok && jawab.status !== 206) {
      return new Response("Sumber videonya menolak permintaan.", { status: 502 });
    }

    const jenis = jenisIsi(alamat.href, jawab.headers.get("content-type"));
    const panjang = Number(jawab.headers.get("content-length") || 0);

    // Daftar putar dibaca utuh karena isinya memang harus disunting; potongan
    // video dialirkan apa adanya supaya tidak ada berkas besar yang singgah
    // di memori.
    const mungkinDaftar = daftar || jenis.includes("mpegurl") || (panjang > 0 && panjang < BATAS_DAFTAR);
    if (mungkinDaftar) {
      const isi = await jawab.text();
      if (daftarPutar(isi)) {
        return new Response(
          tulisUlangDaftarPutar(isi, jawab.url || alamat.href, platform?.id),
          {
            status: 200,
            headers: {
              "Content-Type": "application/vnd.apple.mpegurl",
              "Cache-Control": "no-store",
            },
          },
        );
      }
      return new Response(isi, {
        status: jawab.status,
        headers: teruskanKepala(jawab, jenis),
      });
    }

    return new Response(jawab.body, {
      status: jawab.status,
      headers: teruskanKepala(jawab, jenis),
    });
  } catch (error: unknown) {
    console.error("drama aliran", error);
    const habisWaktu = error instanceof Error && error.name === "TimeoutError";
    return new Response(
      habisWaktu ? "Videonya terlalu lama dimuat." : "Videonya tidak dapat dimuat.",
      { status: 504 },
    );
  }
}

/**
 * Kepala jawaban yang perlu ikut diteruskan.
 *
 * Hanya yang menentukan cara memutarnya: jenis isi, panjang, dan keterangan
 * jangkauan — tanpa yang terakhir, menggeser waktu putar pada berkas mp4
 * berhenti bekerja. Kepala lain dari hulu sengaja tidak diteruskan; di
 * antaranya ada yang memasang cookie, dan cookie milik server orang lain
 * tidak punya urusan di domain ini.
 */
function teruskanKepala(jawab: Response, jenis: string): HeadersInit {
  const kepala: Record<string, string> = {
    "Content-Type": jenis,
    "Cache-Control": "public, max-age=1800",
  };
  const panjang = jawab.headers.get("content-length");
  if (panjang) kepala["Content-Length"] = panjang;
  const jangkauan = jawab.headers.get("content-range");
  if (jangkauan) kepala["Content-Range"] = jangkauan;
  if (jawab.headers.get("accept-ranges")) kepala["Accept-Ranges"] = "bytes";
  return kepala;
}
