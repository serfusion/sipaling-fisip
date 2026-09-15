// ============================================================
// MENERUSKAN ALIRAN VIDEO
//
// Layar menonton tidak pernah memanggil alamat video milik platform sumber
// secara langsung. Dua alasan, dan keduanya praktis:
//
//   1. CORS. Alamat itu dilayani untuk aplikasi platformnya, bukan untuk
//      halaman kita, jadi peramban menolaknya sebelum sempat diputar.
//   2. Perujuk. Alamat kita akan ikut terkirim sebagai Referer ke server
//      orang lain pada tiap potongan video; melewatkan permintaannya lewat
//      sini membuat itu tidak terjadi.
//
// Berkas ini berisi bagian yang MURNI dari penerusan itu — memeriksa alamat
// dan menuliskan ulang daftar putar — supaya seluruh aturannya dapat
// dibuktikan di uji-drama.ts tanpa membuka satu pun sambungan.
// ============================================================

/** Jalur penerus di situs ini. */
export const JALUR_ALIRAN = "/api/drama/aliran";

/**
 * Alamat yang boleh diteruskan.
 *
 * Penerus yang menerima alamat apa pun adalah pintu untuk menembak jaringan
 * dalam dari luar: siapa pun yang punya kode akses dapat menyuruh server ini
 * membuka alamat yang hanya dapat dicapai dari dalam. Karena itu yang di
 * bawah ditolak lebih dulu, sebelum sambungannya dibuka.
 *
 * Yang TIDAK dijanjikan di sini: perlindungan terhadap nama domain yang
 * sengaja diarahkan ke alamat dalam. Menutup celah itu menuntut pemeriksaan
 * pada tahap penyambungan, bukan pada teks alamatnya, dan itu pekerjaan yang
 * berbeda. Yang menahan penyalahgunaannya sekarang adalah gerbang Cakrawala
 * di depan penerus ini: yang memanggilnya bukan orang lewat.
 */
export function tautanAman(mentah: string): URL | null {
  if (!mentah || mentah.length > 2048) return null;

  let alamat: URL;
  try {
    alamat = new URL(mentah);
  } catch {
    return null;
  }

  if (alamat.protocol !== "https:" && alamat.protocol !== "http:") return null;
  // Nama pengguna dan sandi di dalam alamat tidak pernah dipakai pemutar
  // video, dan selalu dipakai untuk menyamarkan tujuan sebenarnya.
  if (alamat.username || alamat.password) return null;

  const tuan = alamat.hostname.toLowerCase();
  if (!tuan || tuan === "localhost" || tuan.endsWith(".localhost")) return null;
  if (tuan.endsWith(".internal") || tuan.endsWith(".local")) return null;
  if (!tuan.includes(".")) return null;

  // Alamat IP yang menunjuk ke dalam jaringan sendiri.
  const ipv4 = tuan.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return null;
    if (a === 169 && b === 254) return null; // termasuk alamat metadata awan
    if (a === 172 && b >= 16 && b <= 31) return null;
    if (a === 192 && b === 168) return null;
    if (a >= 224) return null;
  }
  if (tuan.startsWith("[")) return null; // IPv6 apa adanya tidak pernah perlu

  return alamat;
}

/**
 * Alamat penerus untuk sebuah tautan.
 *
 * `lewatHulu` dipakai untuk tautan yang belum dapat dibuka apa adanya dan
 * harus disiapkan dulu oleh API hulu — videoPath DramaBox yang masih
 * tersandi, atau berkas GoodShort yang alamat akhirnya baru diketahui hulu.
 * Penanda itu SENGAJA tidak ikut pada alamat potongan hasil penulisan ulang:
 * yang perlu disiapkan hanya daftar putar yang pertama, dan potongan
 * sesudahnya sudah beralamat biasa.
 */
export function alamatPenerus(tautan: string, platform?: string, lewatHulu = false): string {
  const kueri = new URLSearchParams({ url: tautan });
  if (platform) kueri.set("platform", platform);
  if (lewatHulu) kueri.set("hulu", "1");
  return `${JALUR_ALIRAN}?${kueri.toString()}`;
}

/** Isi ini daftar putar HLS? */
export function daftarPutar(isi: string): boolean {
  return isi.trimStart().startsWith("#EXTM3U");
}

/**
 * Apakah sebuah jawaban boleh dibaca sebagai teks?
 *
 * Pertanyaannya terdengar remeh dan tidak. Daftar putar HARUS dibaca sebagai
 * teks — isinya memang disunting sebelum diteruskan. Potongan video TIDAK
 * BOLEH, dan bukan karena boros: membaca deretan bita sebagai UTF-8 mengganti
 * tiap bita yang bukan huruf sah dengan tanda tanya, dan bita yang sudah
 * diganti tidak dapat dikembalikan. Yang sampai ke pemutar bukan video yang
 * rusak sebagian, melainkan berkas yang tidak lagi berbentuk video sama
 * sekali.
 *
 * Karena itu yang diperiksa awal berkasnya, bukan panjangnya dan bukan jenis
 * yang disebut hulu: daftar putar HLS selalu dibuka "#EXTM3U", dan tidak ada
 * potongan video yang kebetulan dibuka begitu.
 */
export function tampakDaftarPutar(bita: Uint8Array): boolean {
  const kepala = bita.subarray(0, 64);
  let awal = 0;
  // Ruang kosong dan penanda urutan bita di depan berkas dilewati; keduanya
  // sah di daftar putar dan keduanya membuat perbandingan mentah meleset.
  while (awal < kepala.length && (kepala[awal] === 0x20 || kepala[awal] === 0x09 ||
         kepala[awal] === 0x0a || kepala[awal] === 0x0d)) awal += 1;
  if (kepala[awal] === 0xef && kepala[awal + 1] === 0xbb && kepala[awal + 2] === 0xbf) awal += 3;

  const tanda = "#EXTM3U";
  for (let nomor = 0; nomor < tanda.length; nomor += 1) {
    if (kepala[awal + nomor] !== tanda.charCodeAt(nomor)) return false;
  }
  return true;
}

/**
 * Tuliskan ulang daftar putar HLS supaya seluruh isinya ikut lewat penerus.
 *
 * Yang diubah dua macam baris: baris alamat potongan video, dan atribut
 * URI="" di dalam tag (di antaranya kunci enkripsi HLS dan daftar putar
 * bermutu lain). Bila hanya barisnya yang diubah, potongan videonya lewat
 * sini tetapi kuncinya diminta langsung ke server sumber — dan permintaan
 * itulah yang ditolak peramban.
 *
 * Baris yang tidak dapat diubah menjadi alamat utuh dibiarkan apa adanya.
 * Daftar putar yang cacat sebagian masih dapat diputar sebagian; daftar putar
 * yang dibuang seluruhnya tidak.
 */
export function tulisUlangDaftarPutar(isi: string, asal: string, platform?: string): string {
  const dasar = tautanAman(asal);
  if (!dasar) return isi;

  function utuh(nilai: string): string | null {
    try {
      return new URL(nilai, dasar!.href).href;
    } catch {
      return null;
    }
  }

  return isi
    .split(/\r?\n/)
    .map((baris) => {
      const bersih = baris.trim();
      if (!bersih) return baris;

      if (bersih.startsWith("#")) {
        return baris.replace(/URI="([^"]*)"/g, (utuhnya, alamat: string) => {
          const jadi = utuh(alamat);
          return jadi ? `URI="${alamatPenerus(jadi, platform)}"` : utuhnya;
        });
      }

      const jadi = utuh(bersih);
      return jadi ? alamatPenerus(jadi, platform) : baris;
    })
    .join("\n");
}

/**
 * Jenis isi untuk jawaban penerus.
 *
 * Diambil dari jawaban hulu bila ia menyebutkannya; bila tidak, disimpulkan
 * dari akhiran alamatnya. Pemutar HLS menolak daftar putar yang dikirim
 * sebagai teks biasa, jadi tebakan ini bukan hiasan.
 */
export function jenisIsi(alamat: string, dariHulu: string | null): string {
  const bersih = (dariHulu || "").split(";")[0].trim().toLowerCase();
  const masukAkal = bersih && bersih !== "application/octet-stream" && bersih !== "text/plain";
  if (masukAkal) return dariHulu!;

  const jalur = alamat.split("?")[0].toLowerCase();
  if (jalur.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (jalur.endsWith(".ts")) return "video/mp2t";
  if (jalur.endsWith(".mp4")) return "video/mp4";
  if (jalur.endsWith(".m4s")) return "video/iso.segment";
  if (jalur.endsWith(".vtt")) return "text/vtt";
  if (jalur.endsWith(".key")) return "application/octet-stream";
  return "application/octet-stream";
}
