// ============================================================
// DAFTAR DAN RINCIAN NONTON DRAMA
//
// Satu jalur untuk seluruh platform dan seluruh jenis permintaan. Yang
// membedakannya hanya isi tabel di src/lib/drama.ts, dan itu disengaja:
// proyek asalnya memakai delapan puluh berkas rute yang isinya hampir sama,
// dan setiap kali API hulu berubah, kedelapan puluhnya harus dibaca ulang.
//
// LIMA HAL YANG DIKERJAKAN DI SINI, dan tidak satu pun boleh hilang:
//
//   1. Gerbang. Menu ini bonus bagi pemegang kode Cakrawala, jadi jalurnya
//      ikut terkunci. Tanpa ini, seluruh isinya dapat diambil siapa pun yang
//      menebak alamatnya — dan situs ini berubah menjadi API umum yang
//      tagihannya kita yang bayar.
//   2. Pembatas laju, supaya satu perangkat tidak dapat memeras hulu lewat
//      kita.
//   3. Simpanan. Jawaban hulu yang berhasil diingat sebentar, dan dipakai
//      kembali ketika hulu sedang mati. Inilah yang menutup keluhan "selalu
//      bilang sumbernya tidak menjawab": gangguan hulu yang berlangsung satu
//      menit tidak lagi sampai ke layar sebagai menu yang rusak.
//   4. Anggaran waktu. Seluruh percobaan ke hulu harus selesai SEBELUM
//      Vercel menghentikan fungsi ini — lihat catatan pada `maxDuration` di
//      bawah, karena inilah kesalahan yang paling lama tidak terlihat.
//   5. Perapian jawaban, supaya layar tidak perlu tahu sepuluh bentuk
//      jawaban yang berbeda.
// ============================================================
import { cakrawalaAccess } from "@/lib/cakrawala-store";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  alamatHuluSemua,
  platformTerbuka,
  UA_HULU,
  type Aksi,
  type Permintaan,
  type Platform,
} from "@/lib/drama";
import {
  ambilJawaban,
  kunciSimpanan,
  simpanJawaban,
  umurSimpanan,
} from "@/lib/drama-simpanan";
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

/**
 * Berapa lama fungsi ini boleh hidup.
 *
 * WAJIB DISEBUTKAN, dan bukan sekadar kerapian. Tanpa baris ini Vercel
 * memakai bawaannya — sepuluh sampai lima belas detik menurut paketnya —
 * sementara di bawah kita menunggu hulu jauh lebih lama dan mencoba lagi
 * sesudahnya. Yang terjadi: batas waktu kita sendiri TIDAK PERNAH sempat
 * menyala, ulangannya tidak pernah sempat dikerjakan, dan yang sampai ke
 * peramban adalah galat gerbang Vercel yang tidak berbentuk JSON sama sekali
 * — sehingga layar pun tidak dapat menjelaskan apa yang terjadi.
 *
 * Angkanya diberi kelonggaran di atas ANGGARAN_MS di bawah, supaya yang
 * menghentikan percobaan tetap anggaran kita sendiri, yang tahu cara
 * memulangkan simpanan, dan bukan gerbang yang tidak tahu apa-apa.
 */
export const maxDuration = 30;

const AKSI_SAH = new Set<Aksi>(["populer", "terbaru", "lainnya", "cari", "rinci", "episode"]);

/** Berapa lama menunggu SATU percobaan sebelum menyerah dan mencoba lagi. */
const SABAR_MS = 7_000;

/**
 * Seluruh waktu yang boleh dihabiskan untuk bertanya ke hulu.
 *
 * Dihitung dari awal, bukan per percobaan: tiga percobaan yang masing-masing
 * boleh tujuh detik dapat menghabiskan dua puluh satu detik, dan itu sudah
 * melewati batas fungsi pada sebagian paket. Yang menahannya angka ini.
 */
const ANGGARAN_MS = 20_000;

/** Berapa kali hulu ditanya, termasuk percobaan pertama. */
const MAKS_PERCOBAAN = 3;

/**
 * Jeda sebelum percobaan berikutnya.
 *
 * Bukan nol, dan itu perlu. Hulu yang barusan menjawab 502 biasanya sedang
 * kewalahan; menanyainya lagi pada milidetik yang sama menambah beban pada
 * mesin yang justru sedang tidak sanggup — lalu gagal karena alasan yang
 * sama. Jeda pendek membuat ulangan benar-benar berguna, dan tetap tidak
 * terasa oleh pengunjung.
 */
const JEDA_ULANG_MS = [400, 1_200];

function tolak(pesan: string, status: number) {
  return Response.json({ success: false, message: pesan }, { status });
}

function tidur(ms: number) {
  return new Promise((selesai) => setTimeout(selesai, ms));
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
  const alamatSemua = alamatHuluSemua(platform, aksi, minta);
  if (!alamatSemua.length) {
    return tolak(
      aksi === "cari" ? "Kata pencarian belum diisi." : "Permintaan ini tidak dilayani platform tersebut.",
      400,
    );
  }

  const umur = umurSimpanan(aksi);
  const kunci = kunciPermintaan(platform, aksi, alamatSemua[0]);

  // Simpanan yang masih segar dipakai TANPA menanyai hulu sama sekali. Dua
  // untungnya sekaligus: layar terbuka seketika, dan mesin hulu yang dibayari
  // donasi tidak ditanyai hal yang sama berulang-ulang oleh pengunjung yang
  // berpindah-pindah platform.
  const segar = ambilJawaban<Rapi>(kunci, umur);
  if (segar?.nilai === "segar") {
    return Response.json({ success: true, ...segar.isi });
  }

  /** Satu pintu untuk setiap kegagalan: simpanan basi dulu, galat belakangan. */
  function menyerah(pesan: string, status: number) {
    const basi = ambilJawaban<Rapi>(kunci, umur);
    if (basi) {
      // Yang dipulangkan tetap jawaban yang sah, bukan galat berbungkus
      // sukses: layar memang dapat menggambarnya, dan penanda di bawah yang
      // memberi tahu pengunjung bahwa isinya tidak lagi mutakhir.
      return Response.json({ success: true, ...basi.isi, basi: true, usia: basi.usiaDetik });
    }
    return tolak(pesan, status);
  }

  const mulai = Date.now();

  try {
    const hasil = await tanyaHulu(alamatSemua, mulai);

    if (hasil.jenis === "putus") {
      console.error(`drama ${platform.id}/${aksi}`, hasil.sebab);
      return menyerah(
        hasil.habisWaktu
          ? "Sumber dramanya terlalu lama menjawab. Coba lagi sebentar lagi, atau pilih platform lain di atas."
          : "Sumber dramanya sedang tidak dapat dihubungi. Coba lagi sebentar lagi, atau pilih platform lain di atas.",
        504,
      );
    }

    const jawab = hasil.jawab;

    if (!jawab.ok) {
      // Nama platformnya ikut dicatat supaya yang mati dapat dikenali dari
      // log tanpa menebak — dan itulah yang dibaca penyelarasan tiga harian.
      console.error(`drama ${platform.id}/${aksi} hulu ${jawab.status}`);
      return menyerah(pesanTolakan(platform, aksi, jawab.status), jawab.status === 404 ? 404 : 502);
    }

    const teks = await jawab.text();
    if (!teks.trim()) {
      console.error(`drama ${platform.id}/${aksi} jawaban kosong`);
      return menyerah("Sumber dramanya menjawab kosong. Coba lagi sebentar lagi.", 502);
    }

    let isi: unknown;
    try {
      isi = JSON.parse(teks);
    } catch {
      console.error(`drama ${platform.id}/${aksi} jawaban tidak terbaca`);
      return menyerah("Jawaban sumber dramanya tidak terbaca. Coba lagi sebentar lagi.", 502);
    }

    const rapi = rapikan(platform, aksi, isi, minta);
    simpanJawaban(kunci, rapi);
    return Response.json({ success: true, ...rapi });
  } catch (error: unknown) {
    console.error(`drama ${platform.id}/${aksi}`, error);
    return menyerah("Sumber dramanya sedang tidak dapat dihubungi. Coba lagi sebentar lagi.", 504);
  }
}

/**
 * Kunci simpanan sebuah permintaan.
 *
 * Yang dipakai jalur dan kueri hulu, TANPA alamat dasarnya. Itu disengaja:
 * ketika satu alamat hulu mati dan permintaan berikutnya dilayani cadangan,
 * keduanya menjawab pertanyaan yang sama — dan simpanan yang memilah menurut
 * alamat dasar akan menganggapnya dua pertanyaan berbeda, lalu kehilangan
 * seluruh isinya tepat pada saat cadangan mulai dipakai.
 */
function kunciPermintaan(platform: Platform, aksi: Aksi, alamat: string): string {
  try {
    const pecah = new URL(alamat);
    return kunciSimpanan(platform.id, aksi, `${pecah.pathname}${pecah.search}`);
  } catch {
    return kunciSimpanan(platform.id, aksi, alamat);
  }
}

/** Pesan untuk jawaban hulu yang bukan keberhasilan. */
function pesanTolakan(platform: Platform, aksi: Aksi, status: number): string {
  if (status === 404) {
    return aksi === "rinci" || aksi === "episode"
      ? `Judul ini sudah tidak ada di ${platform.nama}.`
      : `Daftar ini sudah tidak dilayani ${platform.nama}.`;
  }
  if (status === 429) {
    return "Sumber dramanya sedang membatasi permintaan. Tunggu sebentar, lalu coba lagi.";
  }
  return "Sumber dramanya sedang tidak menjawab. Coba lagi sebentar lagi, atau pilih platform lain di atas.";
}

type HasilHulu =
  | { jenis: "jawab"; jawab: Response }
  | { jenis: "putus"; habisWaktu: boolean; sebab: unknown };

/**
 * Bertanya ke hulu, dan bila jawabannya kegagalan sesaat, bertanya lagi.
 *
 * Ini yang menutup keluhan "kadang bisa, kadang tidak". API hulu sesekali
 * menjawab 5xx atau memutus sambungan pada permintaan pertama, lalu menjawab
 * wajar sedetik kemudian; yang menyerah pada percobaan pertama memulangkan
 * layar kosong untuk gangguan yang sudah lewat.
 *
 * Yang diulang HANYA kegagalan yang memang sesaat: 404 berarti judulnya tidak
 * ada, dan menanyakannya tiga kali tetap tidak ada.
 *
 * Bila alamat hulu lebih dari satu, percobaan berikutnya jatuh ke alamat
 * BERIKUTNYA, bukan ke alamat yang barusan gagal. Mesin yang sedang mati
 * tidak menjadi hidup karena ditanya dua kali, dan cadangan yang ditanya
 * belakangan sama saja dengan cadangan yang tidak ada.
 */
async function tanyaHulu(daftarAlamat: string[], mulai: number): Promise<HasilHulu> {
  let terakhir: unknown = null;
  let habisWaktu = false;

  for (let percobaan = 0; percobaan < MAKS_PERCOBAAN; percobaan += 1) {
    const terpakai = Date.now() - mulai;
    const tersisa = ANGGARAN_MS - terpakai;
    // Percobaan yang tidak punya waktu lagi tidak dimulai. Memulainya berarti
    // menahan fungsi ini sampai Vercel yang menghentikannya — dan yang
    // dihentikan gerbang tidak sempat memulangkan simpanan.
    if (tersisa < 1_500) break;

    if (percobaan > 0) {
      const jeda = Math.min(JEDA_ULANG_MS[percobaan - 1] ?? 1_200, Math.max(0, tersisa - 1_500));
      if (jeda > 0) await tidur(jeda);
    }

    const alamat = daftarAlamat[percobaan % daftarAlamat.length];
    const sabar = Math.min(SABAR_MS, ANGGARAN_MS - (Date.now() - mulai));
    if (sabar < 1_000) break;

    try {
      const jawab = await fetch(alamat, {
        headers: { "User-Agent": UA_HULU, Accept: "application/json,*/*" },
        cache: "no-store",
        signal: AbortSignal.timeout(sabar),
      });
      // Jawaban yang bercerita dipulangkan apa adanya: 404 berarti judulnya
      // memang tidak ada, dan mengulanginya hanya menunda pesan yang sama.
      if (jawab.ok || (jawab.status < 500 && jawab.status !== 429)) {
        return { jenis: "jawab", jawab };
      }
      terakhir = new Error(`hulu ${jawab.status}`);
      habisWaktu = false;
      // Percobaan terakhir memulangkan jawaban hulu apa adanya, supaya
      // statusnya — dan bukan tebakan kita — yang menentukan pesannya.
      if (percobaan === MAKS_PERCOBAAN - 1) return { jenis: "jawab", jawab };
      // Jawaban gagal tetap perlu dihabiskan isinya supaya sambungannya
      // dilepas dan tidak menggantung sampai fungsi ini berakhir.
      void jawab.body?.cancel();
    } catch (error: unknown) {
      terakhir = error;
      habisWaktu = error instanceof Error && error.name === "TimeoutError";
    }
  }

  return { jenis: "putus", habisWaktu, sebab: terakhir };
}

/** Bentuk jawaban yang sudah dirapikan, sebagaimana disimpan dan dipulangkan. */
type Rapi = Record<string, unknown>;

/** Merapikan jawaban hulu menjadi bentuk yang sama untuk seluruh platform. */
function rapikan(platform: Platform, aksi: Aksi, isi: unknown, minta: Permintaan): Rapi {
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
