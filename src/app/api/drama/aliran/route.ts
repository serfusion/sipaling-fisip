// ============================================================
// PENERUS ALIRAN VIDEO
//
// Potongan video dan daftar putarnya lewat sini, bukan diminta peramban
// langsung ke server platform sumber. Alasannya dua: peramban menolak isi
// dari asal lain (CORS), dan alamat halaman kita tidak perlu ikut terkirim
// ke server orang lain pada tiap potongan.
//
// TIGA ATURAN YANG MENENTUKAN APAKAH VIDEONYA JADI DIPUTAR ATAU TIDAK, dan
// ketiganya pernah dilanggar di sini:
//
//   1. POTONGAN VIDEO TIDAK PERNAH DIBACA SEBAGAI TEKS. Hanya daftar putar
//      yang dibaca begitu, dan yang menentukan bukan panjangnya melainkan
//      awal berkasnya. Membaca bita sebagai UTF-8 mengganti tiap bita yang
//      bukan huruf sah dengan tanda tanya, dan itu tidak dapat dikembalikan.
//   2. YANG MEMINTA HARUS TAMPAK SEPERTI PERAMBAN. Sebagian besar CDN video
//      menjawab 403 untuk permintaan tanpa Referer yang masuk akal — hulu
//      mengirim keduanya, dan itulah sebabnya permintaannya dilayani.
//   3. BATAS WAKTU HANYA UNTUK KEPALANYA. Menghitung mundur sampai seluruh
//      berkas selesai berarti memutus tontonan yang sedang berjalan ketika
//      berkasnya kebetulan besar atau jaringannya kebetulan pelan.
//
// Selebihnya penerusan biasa: apa yang dikirim hulu diteruskan apa adanya,
// dan daftar putar dituliskan ulang supaya potongannya ikut lewat sini.
// ============================================================
import { cakrawalaAccess } from "@/lib/cakrawala-store";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { alamatAliranHulu, cariPlatform, UA_HULU } from "@/lib/drama";
import { jenisIsi, tampakDaftarPutar, tautanAman, tulisUlangDaftarPutar } from "@/lib/drama-aliran";
import { pembukaWadah } from "@/lib/drama-wadah";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Berapa lama menunggu KEPALA jawaban, bukan seluruh berkasnya.
 *
 * Sesudah kepalanya tiba, hitungannya dihentikan dan isinya dialirkan
 * selama apa pun. Tanpa pemisahan itu, satu berkas mp4 utuh di jaringan
 * pelan akan terputus di tengah menonton — dan yang terlihat di layar bukan
 * pesan galat, melainkan video yang berhenti sendiri.
 */
const SABAR_KEPALA_MS = 20_000;

/**
 * User-Agent yang dipakai untuk meminta VIDEONYA.
 *
 * Bukan UA_HULU. Yang dipanggil di sini bukan API hulu melainkan CDN milik
 * platformnya, dan hulu sendiri memakai dua nama yang berbeda untuk dua
 * tujuan itu: okhttp untuk API-nya, peramban untuk videonya. Sebagian CDN
 * menolak okhttp dengan 403, dan penolakan itulah yang di layar terbaca
 * sebagai "videonya tidak bisa diputar".
 */
const UA_PERAMBAN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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

  const namaJalur = alamat.pathname.toLowerCase();
  const pastiDaftar = namaJalur.endsWith(".m3u8");

  // Potongan yang wadahnya harus dibuka selalu diminta UTUH. Wadahnya dibaca
  // dari kepala berkasnya, jadi potongan yang datang sepenggal tidak dapat
  // dibuka sama sekali — dan pemutar HLS memang tidak pernah meminta
  // sepenggal potongan.
  const wadah = pembukaWadah(platform?.bungkusSegmen);
  const jangkauan = wadah ? null : request.headers.get("range");

  // Permintaan ke API hulu tetap memakai nama hulu; permintaan ke CDN memakai
  // nama peramban. Keduanya meniru permintaan yang sudah terbukti dilayani.
  const kepalaMinta: Record<string, string> = {
    "User-Agent": lewatHulu ? UA_HULU : UA_PERAMBAN,
    Accept: "*/*",
    // Sebagian server potongan menolak permintaan yang isinya dipadatkan
    // di tengah jalan; identity membuat panjangnya tetap dapat dipercaya.
    "Accept-Encoding": "identity",
    // Perujuk diisi asal tautannya sendiri, bukan alamat kita. Banyak CDN
    // memeriksanya, dan yang dicarinya nama mereka sendiri. Asal kita justru
    // yang ditolak — karena itu Origin sengaja tidak ikut dikirim.
    Referer: `${alamat.origin}/`,
    ...(jangkauan ? { Range: jangkauan } : {}),
  };

  try {
    const jawab = await ambilDenganSatuUlangan(alamat.href, kepalaMinta);

    if (!jawab.ok && jawab.status !== 206) {
      return new Response("Sumber videonya menolak permintaan.", { status: 502 });
    }

    const jenis = jenisIsi(jawab.url || alamat.href, jawab.headers.get("content-type"));
    const panjang = Number(jawab.headers.get("content-length") || 0);

    // Isi dibaca utuh hanya bila ia MUNGKIN daftar putar — atau bila
    // potongannya memang perlu dibuka wadahnya lebih dulu, yang tidak dapat
    // dikerjakan sambil mengalir. Selebihnya dialirkan apa adanya supaya
    // tidak ada berkas besar yang singgah di memori.
    const mungkinDaftar =
      pastiDaftar || jenis.includes("mpegurl") || (panjang > 0 && panjang < BATAS_DAFTAR);

    if (mungkinDaftar || wadah) {
      const bita = Buffer.from(await jawab.arrayBuffer());

      // Diperiksa dari ISINYA, bukan dari jenis atau panjang yang disebut
      // hulu. Keduanya berbohong cukup sering, dan yang salah tebak di sini
      // adalah berkas video yang rusak permanen.
      if (tampakDaftarPutar(bita)) {
        return new Response(
          tulisUlangDaftarPutar(bita.toString("utf8"), jawab.url || alamat.href, platform?.id),
          {
            status: 200,
            headers: {
              "Content-Type": "application/vnd.apple.mpegurl",
              "Cache-Control": "no-store",
            },
          },
        );
      }

      const isi = wadah ? wadah(bita) : bita;
      return new Response(new Uint8Array(isi), {
        status: jawab.status,
        headers: teruskanKepala(jawab, jenis, { panjang: isi.length, diubah: isi.length !== bita.length }),
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
 * Minta sekali, dan bila gagal karena keadaan sesaat, minta sekali lagi.
 *
 * Satu ulangan, bukan lebih. Kegagalan pertama ke CDN video kerap benar-benar
 * sesaat — sambungan yang putus saat dibuka, atau 5xx yang hilang sendiri
 * sedetik kemudian — dan menyerah pada percobaan pertama itulah yang di layar
 * terbaca sebagai "kadang bisa, kadang tidak". Ulangan kedua tidak dilakukan:
 * yang gagal dua kali biasanya memang gagal, dan menahan pemutar lebih lama
 * hanya menunda pesan yang sama.
 *
 * Batas waktunya berlaku untuk KEPALA jawaban saja. Begitu kepalanya tiba,
 * pengatur waktunya dilepas, dan isinya boleh mengalir selama apa pun.
 */
async function ambilDenganSatuUlangan(alamat: string, kepala: Record<string, string>): Promise<Response> {
  let terakhir: unknown = null;

  for (let percobaan = 0; percobaan < 2; percobaan += 1) {
    const kendali = new AbortController();
    const pengatur = setTimeout(() => kendali.abort(new DOMException("Timeout", "TimeoutError")), SABAR_KEPALA_MS);
    try {
      const jawab = await fetch(alamat, {
        headers: kepala,
        cache: "no-store",
        redirect: "follow",
        signal: kendali.signal,
      });
      clearTimeout(pengatur);
      if (jawab.ok || jawab.status === 206) return jawab;
      // 4xx selain 429 adalah jawaban, bukan kecelakaan: mengulanginya
      // menghasilkan penolakan yang sama dan menunda pesan ke pengunjung.
      if (jawab.status < 500 && jawab.status !== 429) return jawab;
      terakhir = new Error(`hulu ${jawab.status}`);
    } catch (error: unknown) {
      clearTimeout(pengatur);
      terakhir = error;
    }
  }

  throw terakhir instanceof Error ? terakhir : new Error("Gagal menghubungi sumber video.");
}

/**
 * Kepala jawaban yang perlu ikut diteruskan.
 *
 * Hanya yang menentukan cara memutarnya: jenis isi, panjang, dan keterangan
 * jangkauan — tanpa yang terakhir, menggeser waktu putar pada berkas mp4
 * berhenti bekerja. Kepala lain dari hulu sengaja tidak diteruskan; di
 * antaranya ada yang memasang cookie, dan cookie milik server orang lain
 * tidak punya urusan di domain ini.
 *
 * `panjangSendiri` diisi ketika isinya sudah dibaca — dan wajib diisi ketika
 * isinya berubah panjang karena wadahnya dibuka. Meneruskan panjang dari hulu
 * untuk isi yang tidak lagi sepanjang itu membuat peramban menunggu bita yang
 * tidak akan pernah datang.
 */
function teruskanKepala(
  jawab: Response,
  jenis: string,
  sendiri?: { panjang: number; diubah: boolean },
): HeadersInit {
  const kepala: Record<string, string> = {
    "Content-Type": jenis,
    "Cache-Control": "public, max-age=1800",
  };

  if (sendiri) kepala["Content-Length"] = String(sendiri.panjang);
  else {
    const panjang = jawab.headers.get("content-length");
    if (panjang) kepala["Content-Length"] = panjang;
  }

  const jangkauan = jawab.headers.get("content-range");
  // Keterangan jangkauan menyebut bita ke berapa sampai ke berapa dari berkas
  // aslinya. Begitu isinya diubah panjangnya, angka itu tidak lagi menunjuk
  // apa pun — dan peramban yang mempercayainya akan menunggu bita yang tidak
  // akan pernah datang.
  if (jangkauan && !sendiri?.diubah) kepala["Content-Range"] = jangkauan;
  if (jawab.headers.get("accept-ranges")) kepala["Accept-Ranges"] = "bytes";
  return kepala;
}
