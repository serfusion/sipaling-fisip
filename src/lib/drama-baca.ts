// ============================================================
// MEMBACA JAWABAN API HULU
//
// Sepuluh platform, sepuluh bentuk jawaban. Ada yang memanggil judulnya
// bookName, ada title, ada name; ada yang menaruh daftarnya di collections,
// di rows, di records, atau langsung sebagai larik di akar. Proyek hulu
// menjawabnya dengan sepuluh tipe TypeScript dan sepuluh komponen layar yang
// hampir sama.
//
// Di sini jalannya dibalik: SATU pembaca yang menerima bentuk apa pun, lalu
// memulangkan bentuk yang sama untuk semuanya. Yang dicari bukan "bentuk yang
// benar" melainkan "nilai yang masuk akal" — id, judul, sampul, jumlah
// episode, dan tautan yang dapat diputar.
//
// Itu pilihan yang disengaja, dan alasannya praktis. API hulu berubah tanpa
// memberi tahu. Pembaca yang menuntut bentuk persis akan mati total pada hari
// satu nama kolom berganti; pembaca yang mencari nilai masih memulangkan
// sebagian besar isinya, dan yang hilang cukup satu kolom.
//
// Berkas ini MURNI dan tidak menyentuh jaringan, jadi seluruh perilakunya
// dapat dibuktikan di uji-drama.ts tanpa memanggil hulu satu kali pun.
// ============================================================

export type Kartu = {
  id: string;
  judul: string;
  sampul: string;
  /** 0 berarti jumlahnya tidak disebutkan hulu, bukan "tidak ada episode". */
  episode: number;
  ringkasan: string;
  label: string[];
};

export type Aliran = {
  url: string;
  /** Perlu pemutar HLS, bukan sekadar <video src>. */
  hls: boolean;
  /** Mutu bila hulu menyebutkannya, mis. "720p". */
  mutu: string;
  /**
   * Tautan yang belum dapat dibuka apa adanya dan harus disiapkan dulu oleh
   * API hulu (mis. videoPath DramaBox).
   */
  lewatHulu: boolean;
};

export type Episode = {
  nomor: number;
  nama: string;
  /** Id episode, untuk platform yang menomori episodenya dengan id sendiri. */
  id: string;
  aliran: Aliran[];
};

export type Rinci = {
  id: string;
  judul: string;
  sampul: string;
  ringkasan: string;
  episode: number;
  label: string[];
  daftar: Episode[];
};

// ============================================================
// ALAT BANTU
// ============================================================

type Objek = Record<string, unknown>;

function objek(nilai: unknown): Objek | null {
  return typeof nilai === "object" && nilai !== null && !Array.isArray(nilai)
    ? (nilai as Objek)
    : null;
}

function teks(nilai: unknown): string {
  if (typeof nilai === "string") return nilai.trim();
  if (typeof nilai === "number" && Number.isFinite(nilai)) return String(nilai);
  return "";
}

function angka(nilai: unknown): number {
  const n = typeof nilai === "string" ? Number(nilai.replace(/[^\d.-]/g, "")) : Number(nilai);
  return Number.isFinite(n) ? n : 0;
}

/** Nilai pertama yang terisi di antara beberapa nama kolom yang mungkin. */
function pilih(sumber: Objek, nama: readonly string[]): unknown {
  for (const kunci of nama) {
    const nilai = sumber[kunci];
    if (nilai !== undefined && nilai !== null && nilai !== "") return nilai;
  }
  return undefined;
}

/** Sampul kadang datang sebagai larik alamat; yang dipakai yang pertama. */
function gambar(nilai: unknown): string {
  if (Array.isArray(nilai)) {
    for (const isi of nilai) {
      const satu = gambar(isi);
      if (satu) return satu;
    }
    return "";
  }
  const nilaiTeks = teks(nilai);
  if (nilaiTeks.startsWith("//")) return `https:${nilaiTeks}`;
  // Hulu sesekali memulangkan alamatnya lewat http; peramban menolak isi
  // http di halaman https, jadi dinaikkan di sini, bukan di layar.
  if (nilaiTeks.startsWith("http://")) return `https://${nilaiTeks.slice(7)}`;
  return nilaiTeks;
}

function daftarTeks(nilai: unknown): string[] {
  if (!Array.isArray(nilai)) {
    const satu = teks(nilai);
    return satu ? [satu] : [];
  }
  const hasil: string[] = [];
  for (const isi of nilai) {
    if (typeof isi === "string" || typeof isi === "number") {
      const satu = teks(isi);
      if (satu) hasil.push(satu);
      continue;
    }
    const sebagaiObjek = objek(isi);
    if (sebagaiObjek) {
      const satu = teks(pilih(sebagaiObjek, ["tagName", "name", "title", "label", "typeTwoName"]));
      if (satu) hasil.push(satu);
    }
  }
  return hasil.slice(0, 8);
}

// ============================================================
// NAMA KOLOM YANG PERNAH DIPAKAI HULU
//
// Disusun menurut seberapa pasti maknanya, bukan menurut abjad: yang di depan
// adalah nama yang hanya mungkin berarti satu hal. "id" ditaruh belakangan
// justru karena ia dapat berarti apa saja.
// ============================================================

const KUNCI_ID = [
  "collection_id",
  "collectionId",
  "bookId",
  "book_id",
  "playlet_id",
  "playletId",
  "shortPlayId",
  "short_play_id",
  "dramaId",
  "drama_id",
  "videoId",
  "video_id",
  "fileId",
  "key",
  "bookid",
  "id",
] as const;

const KUNCI_JUDUL = [
  "bookName",
  "book_name",
  "title",
  "dramaName",
  "playlet_name",
  "playletName",
  "shortPlayName",
  "collection_title",
  "name",
] as const;

const KUNCI_SAMPUL = [
  "coverWap",
  "cover_wap",
  "cover",
  "coverUrl",
  "cover_url",
  "verticalCover",
  "vertical_cover",
  "book_pic",
  "poster",
  "image",
  "img",
  "pic",
  "thumbnail",
] as const;

const KUNCI_EPISODE = [
  "total_episodes",
  "totalEpisodes",
  "chapterCount",
  "chapter_count",
  "episodeCount",
  "episode_count",
  "total_episode",
  "totalEpisode",
  "episodeTotal",
  "episodes",
] as const;

const KUNCI_RINGKASAN = [
  "introduction",
  "description",
  "book_intro",
  "intro",
  "summary",
  "desc",
] as const;

const KUNCI_LABEL = ["tags", "tagNames", "labels", "typeTwoNames", "categories"] as const;

const KUNCI_NOMOR = [
  "episodeNumber",
  "episode_number",
  "chapterIndex",
  "chapter_index",
  "index",
  "episode",
  "number",
  "seq",
  "sort",
] as const;

const KUNCI_NAMA_EPISODE = ["chapterName", "episodeName", "name", "title", "indexStr"] as const;

/**
 * Nama kolom id pada sebuah EPISODE, bukan pada judulnya.
 *
 * Dipisahkan dari KUNCI_ID karena keduanya berbeda arti dan kerap muncul
 * bersamaan: satu jawaban episode dapat membawa bookId judulnya sekaligus
 * chapterId episodenya, dan yang dibutuhkan layar untuk memutar adalah yang
 * kedua. Nama judul tetap disertakan di belakang sebagai cadangan, untuk
 * platform yang memang hanya menomori dengan satu id.
 */
const KUNCI_ID_EPISODE = [
  "chapterId",
  "chapter_id",
  "episodeId",
  "episode_id",
  "videoId",
  "video_id",
  "fileId",
  "file_id",
  ...KUNCI_ID,
] as const;

/** Nama kolom tempat daftar judul biasa ditaruh. */
const KUNCI_DAFTAR = [
  "collections",
  "results",
  "records",
  "rows",
  "books",
  "items",
  "list",
  "dramas",
  "recommends",
  "data",
] as const;

/** Nama kolom tempat daftar episode biasa ditaruh. */
const KUNCI_DAFTAR_EPISODE = [
  "chapterList",
  "chapters",
  // GoodShort menaruh seluruh episodenya di sini, dan namanya tidak
  // menyerupai satu pun nama lain di daftar ini. Tanpa barisnya, jawaban
  // GoodShort jatuh ke penelusuran umum — yang menemukan larik lain lebih
  // dulu, dan berakhir sebagai judul tanpa satu pun episode.
  "downloadList",
  "episodeList",
  "episode_list",
  "episodes",
  "videoList",
  "videos",
  "multiVideos",
  "list",
] as const;

// ============================================================
// MENCARI DAFTAR DI DALAM JAWABAN
// ============================================================

function larikObjek(nilai: unknown): Objek[] | null {
  if (!Array.isArray(nilai) || nilai.length === 0) return null;
  const isi = nilai.filter((item): item is Objek => objek(item) !== null);
  return isi.length ? isi : null;
}

/**
 * Larik judul pertama yang ditemukan di dalam jawaban.
 *
 * Dicari berjenjang, bukan sekaligus: nama kolom yang sudah dikenal dicoba
 * lebih dulu di tiap lapis, baru sesudahnya seluruh lapis itu ditelusuri.
 * Tanpa urutan itu, jawaban yang membawa larik "banners" di atas larik
 * isinya akan terbaca sebagai daftar judul — dan yang tampil di layar adalah
 * sederet spanduk tanpa nama.
 */
export function cariLarik(payload: unknown, kunciDikenal: readonly string[] = KUNCI_DAFTAR): Objek[] {
  const langsung = larikObjek(payload);
  if (langsung) return langsung;

  let lapis: unknown[] = [payload];
  for (let dalam = 0; dalam < 5 && lapis.length; dalam++) {
    const berikut: unknown[] = [];

    for (const simpul of lapis) {
      const isi = objek(simpul);
      if (!isi) continue;
      for (const kunci of kunciDikenal) {
        const ketemu = larikObjek(isi[kunci]);
        if (ketemu) return ketemu;
      }
    }

    for (const simpul of lapis) {
      const isi = objek(simpul);
      if (isi) {
        for (const nilai of Object.values(isi)) {
          const ketemu = larikObjek(nilai);
          if (ketemu && ketemu.some((item) => teks(pilih(item, KUNCI_ID)) !== "")) return ketemu;
          berikut.push(nilai);
        }
        continue;
      }
      if (Array.isArray(simpul)) berikut.push(...simpul.slice(0, 40));
    }

    lapis = berikut.slice(0, 200);
  }

  return [];
}

// ============================================================
// KARTU JUDUL
// ============================================================

export function bacaKartu(item: Objek): Kartu | null {
  const id = teks(pilih(item, KUNCI_ID));
  const judul = teks(pilih(item, KUNCI_JUDUL));
  if (!id || !judul) return null;

  const jumlah = pilih(item, KUNCI_EPISODE);
  return {
    id,
    judul,
    sampul: gambar(pilih(item, KUNCI_SAMPUL)),
    // "episodes" kadang berisi lariknya, bukan jumlahnya.
    episode: Array.isArray(jumlah) ? jumlah.length : Math.max(0, Math.floor(angka(jumlah))),
    ringkasan: teks(pilih(item, KUNCI_RINGKASAN)).slice(0, 600),
    label: daftarTeks(pilih(item, KUNCI_LABEL)),
  };
}

/** Daftar kartu dari sebuah jawaban, tanpa kembar dan tanpa yang cacat. */
export function bacaDaftar(payload: unknown): Kartu[] {
  const hasil: Kartu[] = [];
  const terlihat = new Set<string>();
  for (const item of cariLarik(payload)) {
    const kartu = bacaKartu(item);
    if (!kartu || terlihat.has(kartu.id)) continue;
    terlihat.add(kartu.id);
    hasil.push(kartu);
    if (hasil.length >= 120) break;
  }
  return hasil;
}

/** Nama kolom yang berarti "masih ada lagi" bila bernilai benar. */
const KUNCI_MASIH_ADA = ["has_more", "hasMore", "hasNext", "has_next", "more"] as const;

/** Nama kolom yang berarti "sudah habis" bila bernilai benar. */
const KUNCI_SUDAH_HABIS = ["isEnd", "is_end", "isLast", "completed", "finished", "noMore", "no_more"] as const;

/** Nama kolom yang membawa penanda potongan berikutnya. */
const KUNCI_PENANDA = [
  "next_cursor",
  "nextCursor",
  "cursor",
  "next_offset",
  "nextOffset",
  "next",
  "offset",
] as const;

/**
 * Simpul-simpul tempat keterangan penomoran biasa bersembunyi.
 *
 * Dicari berlapis karena hulu tidak sepakat menaruhnya di mana: PineDrama
 * menaruh has_more di akar, FreeReels di `data.page_info`, GoodShort menyebut
 * `data.current` dan `data.pages` alih-alih has_more sama sekali. Membaca akar
 * saja berarti dua dari tiga platform itu selalu terbaca "masih ada" — dan
 * gulir tak berhingganya tidak pernah berhenti sendiri.
 */
function simpulHalaman(payload: unknown): Objek[] {
  const akar = objek(payload);
  if (!akar) return [];
  const hasil: Objek[] = [akar];
  for (const kunci of ["data", "page_info", "pageInfo", "page", "meta", "result"]) {
    const isi = objek(akar[kunci]);
    if (!isi) continue;
    hasil.push(isi);
    for (const dalam of ["page_info", "pageInfo", "page", "meta"]) {
      const lebihDalam = objek(isi[dalam]);
      if (lebihDalam) hasil.push(lebihDalam);
    }
  }
  return hasil;
}

export type Halaman = {
  /** Penanda potongan berikutnya bila hulu menyebutkannya; boleh kosong. */
  kursor: string;
  /** Benar bila hulu sendiri sudah menyatakan tidak ada potongan lagi. */
  habis: boolean;
};

/**
 * Keterangan penomoran di dalam sebuah jawaban daftar.
 *
 * Yang dijawab dua hal yang berbeda, dan memisahkannya penting: "penanda
 * berikutnya" dan "sudah habis". Daftar berhalaman biasa tidak punya penanda
 * sama sekali — nomornya kita hitung sendiri — tetapi tetap punya akhir; dan
 * memperlakukan penanda kosong sebagai akhir akan menghentikan DramaBox di
 * halaman pertama.
 */
export function bacaHalaman(payload: unknown): Halaman {
  const simpul = simpulHalaman(payload);
  let kursor = "";
  let habis = false;

  for (const isi of simpul) {
    if (!kursor) {
      const penanda = teks(pilih(isi, KUNCI_PENANDA));
      // Geseran nol adalah geseran awal, bukan penanda berikutnya; hulu
      // memulangkannya pada jawaban yang justru sudah habis.
      if (penanda && penanda !== "0") kursor = penanda.slice(0, 200);
    }
    if (pilih(isi, KUNCI_MASIH_ADA) === false) habis = true;
    if (pilih(isi, KUNCI_SUDAH_HABIS) === true) habis = true;

    // Bentuk GoodShort: nomor halaman sekarang dan jumlah halaman seluruhnya.
    const sekarang = Math.floor(angka(pilih(isi, ["current", "currentPage", "page_num", "pageNum"])));
    const seluruh = Math.floor(angka(pilih(isi, ["pages", "totalPages", "total_pages", "pageCount"])));
    if (sekarang > 0 && seluruh > 0 && sekarang >= seluruh) habis = true;
  }

  if (habis) return { kursor: "", habis: true };
  return { kursor, habis: false };
}

/**
 * Penanda halaman berikutnya, untuk platform yang memakai kursor.
 *
 * Kosong berarti "sudah habis" — dan itu juga jawaban yang benar ketika
 * hulu menyebut has_more bernilai salah.
 */
export function bacaKursor(payload: unknown): string {
  return bacaHalaman(payload).kursor;
}

// ============================================================
// TAUTAN VIDEO
// ============================================================

/** Nama kolom yang isinya memang tautan video, menurut seberapa disukai. */
const KUNCI_ALIRAN: Record<string, number> = {
  best_url: 100,
  hlsUrl: 95,
  hls_url: 95,
  m3u8Url: 90,
  external_audio_h264_m3u8: 88,
  external_audio_h265_m3u8: 86,
  streamUrl: 84,
  stream_url: 84,
  videoUrl: 82,
  video_url: 82,
  // NetShort menamai tautan episodenya "playVoucher", dan cadangannya
  // "playVoucherBak". Namanya tidak menyebut video sama sekali, jadi tanpa
  // dua baris ini seluruh episode NetShort terbaca sebagai episode tanpa
  // tautan — persis keluhan "judulnya ada, videonya tidak jalan".
  playVoucher: 83,
  playVoucherBak: 66,
  main_url: 78,
  // Melolo memulangkan alamat yang sudah dipulihkan hulu di kolom terpisah;
  // yang belum dipulihkan tidak selalu dapat dibuka.
  main_url_decoded: 80,
  playUrl: 76,
  indo_hd_cdn_urls: 75,
  indo_cdn_urls: 72,
  filePath: 74,
  mp4: 70,
  backupUrl: 60,
  videoPath: 58,
  url: 50,
};

function tampakTautan(nilai: string): boolean {
  return /^https?:\/\//i.test(nilai) || nilai.startsWith("//");
}

function berbentukVideo(nilai: string): boolean {
  return /\.(m3u8|mp4|ts)(\?|$)/i.test(nilai);
}

/** Teks yang memang berarti mutu gambar, mis. "720p"; kosong bila bukan. */
function mutuTeks(nilai: unknown): string {
  const sebagaiTeks = teks(nilai);
  if (/^\d{3,4}p?$/i.test(sebagaiTeks)) return sebagaiTeks.endsWith("p") ? sebagaiTeks : `${sebagaiTeks}p`;
  return /\d{3,4}p/i.test(sebagaiTeks) ? sebagaiTeks : "";
}

/**
 * Mutu sebuah tautan, dari objek yang membawanya dan dari nama kolomnya.
 *
 * Nama kolomnya ikut dibaca karena ShortMax memulangkan tautannya sebagai
 * objek yang KUNCInya adalah mutunya — `{ "720p": "https://…" }` — sehingga
 * membaca isinya saja memulangkan tombol mutu tanpa nama.
 *
 * Cara memampatkan gambarnya ikut disebut bila hulu menyebutkannya. Itu bukan
 * hiasan: H265 memang lebih kecil, dan memang tidak dapat diputar di banyak
 * peramban — yang membuka perlu tahu tombol mana yang ia tekan.
 */
function mutuDari(induk: Objek, dariKunci = ""): string {
  const dasar =
    mutuTeks(pilih(induk, ["type", "quality", "resolution", "definition", "name", "label"])) ||
    mutuTeks(dariKunci);
  const sandi = teks(pilih(induk, ["encode", "codec", "encodeType"])).toUpperCase();
  const cocok = sandi === "H264" || sandi === "H265" || sandi === "AVC" || sandi === "HEVC";
  if (!cocok) return dasar;
  return dasar ? `${dasar} ${sandi}` : sandi;
}

/**
 * Seberapa besar kemungkinan sebuah tautan benar-benar dapat diputar peramban.
 *
 * Hulu memilih H264 lebih dulu "untuk kecocokan", dan alasannya nyata: Chrome
 * di Windows tidak memutar H265 sama sekali. Tautan H265 tidak dibuang — ia
 * hanya ditaruh di belakang, supaya yang dicoba pertama adalah yang paling
 * mungkin jalan, dan yang lain tetap tersedia sebagai tombol mutu.
 */
function condongSandi(induk: Objek): number {
  const sandi = teks(pilih(induk, ["encode", "codec", "encodeType"])).toUpperCase();
  if (sandi === "H265" || sandi === "HEVC") return -25;
  if (sandi === "H264" || sandi === "AVC") return 6;
  return 0;
}

/**
 * Yang perlu diketahui pembaca tentang platform yang sedang dibaca.
 *
 * Isinya sengaja sedikit: pembaca ini tetap tidak boleh tahu nama platform
 * apa pun. Yang diterimanya data dari tabel, bukan percabangan menurut nama —
 * sehingga menambah platform kesebelas tetap berarti menyunting tabel, bukan
 * menyunting berkas ini.
 */
export type OpsiAliran = {
  /** Nama kolom yang nilainya selalu harus disiapkan API hulu lebih dulu. */
  kunciLewatHulu?: readonly string[];
};

/**
 * Seluruh tautan yang dapat diputar di dalam sebuah jawaban episode.
 *
 * Ditelusuri, bukan dibaca dari jalur yang ditentukan, karena letaknya
 * berbeda-beda di tiap platform — dan berpindah sendiri saat hulu berubah.
 * Yang menentukan urutannya nama kolomnya, lalu bentuk berkasnya: pemutar
 * HLS menerima keduanya, tetapi .m3u8 yang datang lebih dulu berarti mutu
 * dapat berpindah sendiri saat jaringannya turun.
 */
export function kumpulkanAliran(payload: unknown, opsi: OpsiAliran = {}): Aliran[] {
  type Temuan = { url: string; nilai: number; mutu: string; lewatHulu: boolean };
  const temuan: Temuan[] = [];
  const selaluLewatHulu = new Set(opsi.kunciLewatHulu ?? []);

  /** Satu nilai teks, dinilai menurut nama kolom tempat ia ditemukan. */
  function catat(kunci: string, nilai: string, induk: Objek, dalam: number) {
    const bersih = gambar(nilai);
    if (!bersih) return;

    const prioritas = KUNCI_ALIRAN[kunci];
    const kenalNama = prioritas !== undefined;
    const mutu = mutuDari(induk, kunci);

    // Kolom yang tabel platformnya sebut selalu perlu disiapkan hulu tidak
    // pernah dibuka apa adanya, walau nilainya sudah berbentuk alamat utuh.
    // Itu bukan kehati-hatian berlebih: videoPath DramaBox dan filePath
    // GoodShort memang kadang datang sebagai alamat yang tampak wajar, dan
    // sama-sama menjawab 403 ketika benar-benar dibuka tanpa disiapkan.
    if (selaluLewatHulu.has(kunci) && bersih.length > 8 && !bersih.includes(" ")) {
      temuan.push({ url: bersih, nilai: (prioritas ?? 40) - dalam, mutu, lewatHulu: true });
      return;
    }

    if (tampakTautan(bersih) && (kenalNama || berbentukVideo(bersih))) {
      temuan.push({
        url: bersih,
        nilai: (prioritas ?? 40) + (berbentukVideo(bersih) ? 5 : 0) + condongSandi(induk) - dalam,
        mutu,
        lewatHulu: false,
      });
      return;
    }

    // Bukan alamat, tetapi berada di kolom yang memang berisi video: inilah
    // bentuk videoPath DramaBox yang masih perlu disiapkan hulu.
    if (kenalNama && bersih.length > 16 && !bersih.includes(" ")) {
      temuan.push({ url: bersih, nilai: (prioritas ?? 40) - 20 - dalam, mutu, lewatHulu: true });
    }
  }

  /**
   * `dariKunci` adalah nama kolom yang membawa simpul ini. Ia ikut diturunkan
   * karena larik alamat — indo_hd_cdn_urls milik PineDrama, misalnya — berisi
   * teks telanjang: maknanya ada pada nama lariknya, bukan pada isinya.
   */
  function telusuri(simpul: unknown, dariKunci: string, induk: Objek | null, dalam: number) {
    if (dalam > 6 || temuan.length > 60) return;

    if (Array.isArray(simpul)) {
      for (const isi of simpul.slice(0, 40)) {
        if (typeof isi === "string") catat(dariKunci, isi, induk ?? {}, dalam);
        else telusuri(isi, dariKunci, induk, dalam + 1);
      }
      return;
    }

    const isi = objek(simpul);
    if (!isi) return;

    for (const [kunci, nilai] of Object.entries(isi)) {
      if (typeof nilai === "string") {
        catat(kunci, nilai, isi, dalam);
        continue;
      }
      if (Array.isArray(nilai) || objek(nilai)) telusuri(nilai, kunci, isi, dalam + 1);
    }
  }

  telusuri(payload, "", null, 0);

  const terlihat = new Set<string>();
  return temuan
    .sort((a, b) => b.nilai - a.nilai)
    .filter((item) => {
      if (terlihat.has(item.url)) return false;
      terlihat.add(item.url);
      return true;
    })
    .slice(0, 8)
    .map(({ url, mutu, lewatHulu }) => ({
      url,
      hls: /\.m3u8(\?|$)/i.test(url),
      mutu,
      lewatHulu,
    }));
}

// ============================================================
// EPISODE
// ============================================================

function bacaSatuEpisode(item: Objek, urutan: number, opsi: OpsiAliran): Episode {
  const nomorMentah = pilih(item, KUNCI_NOMOR);
  const nomor = Math.floor(angka(nomorMentah));
  return {
    // Sebagian platform menomori dari nol, sebagian dari satu, dan sebagian
    // tidak menomori sama sekali. Yang dipakai di layar selalu mulai dari
    // satu; urutannyalah yang menjadi patokan terakhir.
    nomor: nomor > 0 ? nomor : urutan + 1,
    nama: teks(pilih(item, KUNCI_NAMA_EPISODE)),
    id: teks(pilih(item, KUNCI_ID_EPISODE)),
    aliran: kumpulkanAliran(item, opsi),
  };
}

/** Daftar episode di dalam sebuah jawaban rinci atau jawaban daftar episode. */
export function bacaDaftarEpisode(payload: unknown, opsi: OpsiAliran = {}): Episode[] {
  const larik = cariLarik(payload, KUNCI_DAFTAR_EPISODE);
  const hasil = larik.map((item, urutan) => bacaSatuEpisode(item, urutan, opsi));

  // Nomor kembar berarti nomor yang terbaca bukan nomor episode (mis. kolom
  // "sort" yang selalu nol). Dalam keadaan itu urutannyalah yang benar.
  const nomor = new Set(hasil.map((item) => item.nomor));
  if (hasil.length > 1 && nomor.size < hasil.length) {
    return hasil.map((item, urutan) => ({ ...item, nomor: urutan + 1 }));
  }
  return hasil;
}

/**
 * Satu episode dari jawaban yang memang hanya berisi satu.
 *
 * Bila jawabannya justru membawa daftar, yang diambil yang pertama — itulah
 * yang dikirim hulu ketika episode yang diminta tidak ada.
 */
export function bacaEpisodeTunggal(payload: unknown, nomor: number, opsi: OpsiAliran = {}): Episode {
  const aliran = kumpulkanAliran(payload, opsi);
  if (aliran.length) {
    const isi = objek(payload) ?? {};
    return {
      nomor,
      nama: teks(pilih(isi, KUNCI_NAMA_EPISODE)),
      id: teks(pilih(isi, KUNCI_ID_EPISODE)),
      aliran,
    };
  }
  const daftar = bacaDaftarEpisode(payload, opsi);
  return daftar[0] ?? { nomor, nama: "", id: "", aliran: [] };
}

// ============================================================
// RINCI
// ============================================================

/**
 * Halaman rinci sebuah judul.
 *
 * Judul dan sampulnya dicari di akar jawaban lebih dulu, lalu di objek yang
 * bersarang — sebagian platform membungkusnya dalam "book", sebagian tidak.
 * Kartu yang dikirim layar dipakai sebagai cadangan terakhir, supaya nama
 * judulnya tidak pernah kosong walau jawaban rincinya mengecewakan.
 */
export function bacaRinci(
  payload: unknown,
  id: string,
  cadangan?: Kartu | null,
  opsi: OpsiAliran = {},
): Rinci {
  const akar = objek(payload) ?? {};
  const kandidat: Objek[] = [akar];
  for (const kunci of ["data", "book", "detail", "result", "info", "collection", "drama"]) {
    const isi = objek(akar[kunci]);
    if (isi) {
      kandidat.push(isi);
      for (const kunciDalam of ["book", "detail", "info", "collection"]) {
        const lebihDalam = objek(isi[kunciDalam]);
        if (lebihDalam) kandidat.push(lebihDalam);
      }
    }
  }

  function ambil(nama: readonly string[]): unknown {
    for (const sumber of kandidat) {
      const nilai = pilih(sumber, nama);
      if (nilai !== undefined) return nilai;
    }
    return undefined;
  }

  const daftar = bacaDaftarEpisode(payload, opsi);
  const jumlahMentah = ambil(KUNCI_EPISODE);
  const jumlah = Array.isArray(jumlahMentah) ? jumlahMentah.length : Math.floor(angka(jumlahMentah));

  return {
    id: teks(ambil(KUNCI_ID)) || id,
    judul: teks(ambil(KUNCI_JUDUL)) || cadangan?.judul || "",
    sampul: gambar(ambil(KUNCI_SAMPUL)) || cadangan?.sampul || "",
    ringkasan: (teks(ambil(KUNCI_RINGKASAN)) || cadangan?.ringkasan || "").slice(0, 2000),
    // Jumlah yang disebut hulu dipercaya lebih dulu; daftar episode kerap
    // dipotong sepuluh pertama pada jawaban rinci.
    episode: Math.max(jumlah > 0 ? jumlah : 0, daftar.length, cadangan?.episode ?? 0),
    label: daftarTeks(ambil(KUNCI_LABEL)).length
      ? daftarTeks(ambil(KUNCI_LABEL))
      : (cadangan?.label ?? []),
    daftar,
  };
}
