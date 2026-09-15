// ============================================================
// DAFTAR SUMBER NONTON DRAMA
//
// Menu Nonton Drama tidak menyimpan satu pun berkas video, dan tidak
// mengambilnya sendiri dari aplikasi mana pun. Yang dilakukannya satu:
// meneruskan pertanyaan ke API terbuka milik proyek SekaiDrama
// (https://github.com/Sansekai/SekaiDrama), lalu merapikan jawabannya menjadi
// bentuk yang sama untuk semua platform.
//
// SELURUH PENGETAHUAN TENTANG API HULU TINGGAL DI BERKAS INI. Alamat, nama
// parameter, dan cara tiap platform menomori episodenya — semuanya di tabel
// di bawah, sebagai data, bukan sebagai percabangan yang tersebar di belasan
// berkas rute seperti di proyek aslinya.
//
// Alasannya bukan kerapian. API hulu berubah sendiri, tanpa memberi tahu:
// dalam riwayat SekaiDrama ada platform yang hilang, kembali, lalu hilang
// lagi dalam hitungan pekan. Bila pengetahuan itu tersebar, tiap perubahan
// kecil menuntut pembacaan ulang seluruh kode. Dengan satu tabel, menyesuaikan
// diri cukup dengan menyunting satu baris — dan itulah yang membuat
// penyelarasan tiga harian (lihat cek-sekaidrama.ts) masuk akal dikerjakan.
//
// Berkas ini MURNI: tidak menyentuh Node, tidak menyentuh basis data, tidak
// mengimpor next/server. Ia boleh dipakai di rute API, di komponen, dan di
// berkas uji yang dijalankan lewat `npx tsx`.
// ============================================================

/**
 * Riwayat hulu yang menjadi acuan penyalinan ini.
 *
 * Dicatat sebagai data supaya cek-sekaidrama.ts dapat membandingkannya dengan
 * keadaan repositori hulu hari ini, lalu melaporkan apa yang berubah. Angka
 * yang diingat dengan tangan adalah angka yang akan salah dalam dua bulan.
 */
export const SUMBER_HULU = {
  pemilik: "Sansekai",
  repo: "SekaiDrama",
  cabang: "main",
  /** Commit hulu yang dibaca saat tabel di bawah disusun. */
  commit: "0481a1c",
  /** Tanggal pembacaan itu, bukan tanggal commit-nya. */
  dibacaPada: "2026-09-13",
  lisensi: "MIT",
} as const;

/** Alamat API hulu. Dapat dipindah lewat environment tanpa mengubah kode. */
export function alamatApiHulu(): string {
  const disetel = (process.env.DRAMA_API_BASE || process.env.NEXT_PUBLIC_DRAMA_API_BASE || "").trim();
  return (disetel || "https://api.sansekai.my.id/api").replace(/\/+$/, "");
}

// ============================================================
// BENTUK TABEL
// ============================================================

export type IdPlatform =
  | "pinedrama"
  | "dramabox"
  | "reelshort"
  | "shortmax"
  | "goodshort"
  | "netshort"
  | "melolo"
  | "freereels"
  | "flickreels"
  | "dramanova";

/** Yang dapat diminta dari sebuah platform. */
export type Aksi = "populer" | "terbaru" | "lainnya" | "cari" | "rinci" | "episode";

/**
 * Cara sebuah daftar panjang diminta sepotong demi sepotong.
 *
 * `batas` adalah berapa potong yang boleh diminta sebelum daftarnya dianggap
 * habis. Angkanya bukan hiasan dan bukan tebakan: hulu memasang batas yang
 * sama pada tiap platform, dan tanpa batas itu gulir tak berhingga akan terus
 * meminta halaman yang sudah lama menjawab isi yang sama.
 *
 * `langkah` hanya berlaku untuk penomoran bergeser: berapa judul yang dilompati
 * tiap potong bila hulu tidak menyebutkan sendiri geseran berikutnya.
 */
export type Penomoran = {
  kunci: "page" | "offset" | "cursor";
  mulai: string;
  batas: number;
  langkah?: number;
};

export type Titik = {
  /** Jalur di API hulu, sesudah alamat dasarnya. */
  jalur: string;
  /**
   * Berkas rute di repositori hulu yang jalur ini disalin darinya, relatif
   * terhadap `src/app/api/` dan tanpa `/route.ts`.
   *
   * Dicatat bukan sebagai keterangan, melainkan sebagai alamat: cek-sekaidrama.ts
   * membaca berkas itu apa adanya di hulu, lalu membandingkan jalur dan nama
   * parameter yang tertulis di sana dengan yang tertulis di sini. Tanpa
   * alamatnya, penyelarasan tiga harian hanya dapat berkata "ada yang
   * berubah"; dengan alamatnya, ia dapat berkata "yang berubah baris ini".
   */
  berkas?: string;
  /** Nama parameter untuk kata kunci pencarian. */
  kunciCari?: string;
  /** Nama parameter untuk pengenal judul. */
  kunciId?: string;
  /** Nama parameter untuk nomor episode. */
  kunciEpisode?: string;
  /** Cara halaman berikutnya diminta; tidak ada berarti sekali ambil habis. */
  halaman?: Penomoran;
};

/**
 * Bagaimana episode sebuah platform dialamatkan.
 *
 *   "nomor"       — diminta satu per satu dengan (id judul, nomor episode)
 *   "semua"       — seluruh episode datang sekaligus dengan id judul saja
 *   "id-episode"  — tiap episode punya id sendiri, diambil dari halaman rinci
 *   "dalam-rinci" — episodenya sudah ikut di jawaban rinci, tidak ada
 *                   permintaan kedua
 */
export type CaraEpisode = "nomor" | "semua" | "id-episode" | "dalam-rinci";

export type Platform = {
  id: IdPlatform;
  nama: string;
  /** Dua huruf untuk lencana di layar; tidak memakai logo milik orang lain. */
  inisial: string;
  /** Warna lencananya, supaya tiap platform tetap dapat dibedakan sekilas. */
  warna: string;
  /**
   * Platform yang dimatikan tetap tertulis di sini, lengkap dengan alasannya.
   * Menghapusnya berarti menghapus pula pengetahuan yang perlu dibaca lagi
   * pada hari API-nya pulih.
   */
  aktif: boolean;
  catatan?: string;
  caraEpisode: CaraEpisode;
  /**
   * Nama parameter id episode untuk platform bercara "id-episode".
   */
  kunciIdEpisode?: string;
  /**
   * Jalur hulu yang menyiapkan tautan video bila tautannya tidak dapat
   * dibuka apa adanya. Yang mengerjakannya API hulu, bukan berkas ini.
   */
  jalurAliran?: string;
  /**
   * Nama kolom yang isinya SELALU harus disiapkan hulu lebih dulu, walau
   * nilainya sudah terlihat seperti alamat biasa.
   *
   * Dicatat di tabel, bukan disimpulkan dari bentuk nilainya, karena
   * bentuknya menipu: videoPath DramaBox dan filePath GoodShort sama-sama
   * kadang datang sebagai alamat utuh yang kelihatan dapat dibuka — dan
   * sama-sama menjawab 403 bila benar-benar dibuka tanpa disiapkan. Hulu
   * sendiri tidak pernah membedakan keduanya: ia selalu melewatkan kolom itu
   * lewat penyiapnya.
   */
  kunciLewatHulu?: readonly string[];
  /**
   * Nama wadah potongan video, bila potongannya tidak datang sebagai berkas
   * yang dapat langsung diputar dan harus dibuka lebih dulu.
   *
   * Yang membukanya penerus aliran kita, bukan berkas ini — lihat
   * `bukaWadahShortmax` di src/lib/drama-aliran.ts.
   */
  bungkusSegmen?: "shortmax";
  titik: Partial<Record<Aksi, Titik>>;
};

/** Halaman bernomor, mulai dari satu. */
function halamanNomor(batas: number): Penomoran {
  return { kunci: "page", mulai: "1", batas };
}
/** Geseran, mulai dari nol, melompat `langkah` judul tiap potong. */
function halamanGeser(batas: number, langkah = 20): Penomoran {
  return { kunci: "offset", mulai: "0", batas, langkah };
}
/** Kursor yang dikirim balik hulu apa adanya. */
function halamanKursor(batas: number): Penomoran {
  return { kunci: "cursor", mulai: "1", batas };
}

// ============================================================
// TABEL PLATFORM
//
// Urutannya urutan tampil. Yang pertama dibuka lebih dulu saat menu dibuka,
// jadi yang paling jarang bermasalah ditaruh di depan — sama seperti pilihan
// hulu, yang menaruh PineDrama sebagai bawaan.
// ============================================================

export const PLATFORM: Platform[] = [
  {
    id: "pinedrama",
    nama: "PineDrama",
    inisial: "PD",
    warna: "#2f9e6b",
    aktif: true,
    caraEpisode: "nomor",
    titik: {
      populer: { jalur: "/pinedrama/trending", berkas: "pinedrama/trending", halaman: halamanKursor(10) },
      lainnya: { jalur: "/pinedrama/foryou", berkas: "pinedrama/foryou", halaman: halamanKursor(10) },
      cari: { jalur: "/pinedrama/search", berkas: "pinedrama/search", kunciCari: "query" },
      rinci: { jalur: "/pinedrama/detail", berkas: "pinedrama/detail", kunciId: "collection_id" },
      episode: {
        jalur: "/pinedrama/get-episode", berkas: "pinedrama/episode",
        kunciId: "collection_id",
        kunciEpisode: "episodeNumber",
      },
    },
  },
  {
    id: "dramabox",
    nama: "DramaBox",
    inisial: "DB",
    warna: "#e0483c",
    aktif: true,
    caraEpisode: "semua",
    jalurAliran: "/dramabox/decrypt-video",
    kunciLewatHulu: ["videoPath"],
    titik: {
      terbaru: { jalur: "/dramabox/latest", berkas: "dramabox/latest" },
      populer: { jalur: "/dramabox/trending", berkas: "dramabox/trending" },
      lainnya: { jalur: "/dramabox/foryou", berkas: "dramabox/foryou", halaman: halamanNomor(100) },
      cari: { jalur: "/dramabox/search", berkas: "dramabox/search", kunciCari: "query" },
      rinci: { jalur: "/dramabox/detail", berkas: "dramabox/detail/[bookId]", kunciId: "bookId" },
      episode: { jalur: "/dramabox/get-allepisode", berkas: "dramabox/allepisode/[bookId]", kunciId: "bookId" },
    },
  },
  {
    id: "reelshort",
    nama: "ReelShort",
    inisial: "RS",
    warna: "#d23f6f",
    aktif: true,
    caraEpisode: "nomor",
    titik: {
      terbaru: { jalur: "/reelshort/homepage", berkas: "reelshort/homepage" },
      lainnya: { jalur: "/reelshort/foryou", berkas: "reelshort/foryou", halaman: halamanNomor(100) },
      cari: { jalur: "/reelshort/search", berkas: "reelshort/search", kunciCari: "query", halaman: halamanNomor(100) },
      rinci: { jalur: "/reelshort/detail", berkas: "reelshort/detail", kunciId: "bookId" },
      episode: {
        jalur: "/reelshort/get-episode", berkas: "reelshort/watch",
        kunciId: "bookId",
        kunciEpisode: "episodeNumber",
      },
    },
  },
  {
    id: "shortmax",
    nama: "ShortMax",
    inisial: "SM",
    warna: "#7a4ddb",
    aktif: true,
    caraEpisode: "nomor",
    // Potongan videonya datang dalam wadah buatan ShortMax sendiri, dan
    // dibuka oleh penerus aliran kita sebelum sampai ke pemutar — sama
    // seperti di hulu.
    bungkusSegmen: "shortmax",
    titik: {
      terbaru: { jalur: "/shortmax/latest", berkas: "shortmax/latest" },
      populer: { jalur: "/shortmax/rekomendasi", berkas: "shortmax/rekomendasi" },
      lainnya: { jalur: "/shortmax/foryou", berkas: "shortmax/foryou", halaman: halamanNomor(100) },
      cari: { jalur: "/shortmax/search", berkas: "shortmax/search", kunciCari: "query" },
      rinci: { jalur: "/shortmax/detail", berkas: "shortmax/detail", kunciId: "shortPlayId" },
      episode: {
        jalur: "/shortmax/get-episode", berkas: "shortmax/episode",
        kunciId: "shortPlayId",
        kunciEpisode: "episodeNumber",
      },
    },
  },
  {
    id: "goodshort",
    nama: "GoodShort",
    inisial: "GS",
    warna: "#e08a2f",
    aktif: true,
    caraEpisode: "semua",
    jalurAliran: "/goodshort/decrypt-stream",
    kunciLewatHulu: ["filePath"],
    titik: {
      terbaru: { jalur: "/goodshort/latest", berkas: "goodshort/latest" },
      populer: { jalur: "/goodshort/trending", berkas: "goodshort/trending" },
      lainnya: { jalur: "/goodshort/foryou", berkas: "goodshort/foryou", halaman: halamanNomor(50) },
      cari: { jalur: "/goodshort/search", berkas: "goodshort/search", kunciCari: "query" },
      rinci: { jalur: "/goodshort/detail", berkas: "goodshort/detail", kunciId: "bookId" },
      episode: { jalur: "/goodshort/get-allepisode", berkas: "goodshort/allepisode", kunciId: "bookId" },
    },
  },
  {
    id: "netshort",
    nama: "NetShort",
    inisial: "NS",
    warna: "#2f7ae0",
    aktif: true,
    caraEpisode: "nomor",
    titik: {
      populer: { jalur: "/netshort/theaters", berkas: "netshort/theaters" },
      lainnya: { jalur: "/netshort/foryou", berkas: "netshort/foryou", halaman: halamanNomor(100) },
      cari: { jalur: "/netshort/search", berkas: "netshort/search", kunciCari: "query" },
      rinci: { jalur: "/netshort/detail", berkas: "netshort/detail", kunciId: "shortPlayId" },
      episode: {
        jalur: "/netshort/get-episode", berkas: "netshort/episode",
        kunciId: "shortPlayId",
        kunciEpisode: "episodeNumber",
      },
    },
  },
  {
    id: "melolo",
    nama: "Melolo",
    inisial: "ML",
    warna: "#c2417f",
    aktif: true,
    // Melolo menomori episodenya dengan id sendiri, bukan dengan urutan. Id
    // itu datang dari jawaban rinci, jadi layar menonton wajib membuka rinci
    // lebih dulu — dan memang itulah jalan masuk yang dipakai pengunjung.
    caraEpisode: "id-episode",
    kunciIdEpisode: "videoId",
    titik: {
      terbaru: { jalur: "/melolo/latest", berkas: "melolo/latest" },
      populer: { jalur: "/melolo/trending", berkas: "melolo/trending" },
      lainnya: { jalur: "/melolo/foryou", berkas: "melolo/foryou", halaman: halamanGeser(6) },
      cari: { jalur: "/melolo/search", berkas: "melolo/search", kunciCari: "query" },
      rinci: { jalur: "/melolo/detail", berkas: "melolo/detail", kunciId: "book_id" },
      episode: { jalur: "/melolo/get-episode", berkas: "melolo/stream", kunciId: "videoId" },
    },
  },
  {
    id: "freereels",
    nama: "FreeReels",
    inisial: "FR",
    warna: "#1f9ba8",
    aktif: true,
    caraEpisode: "dalam-rinci",
    titik: {
      terbaru: { jalur: "/freereels/homepage", berkas: "freereels/home" },
      lainnya: { jalur: "/freereels/foryou", berkas: "freereels/foryou", halaman: halamanGeser(5) },
      cari: { jalur: "/freereels/search", berkas: "freereels/search", kunciCari: "query" },
      rinci: { jalur: "/freereels/detailAndAllEpisode", berkas: "freereels/detail", kunciId: "key" },
    },
  },
  {
    id: "flickreels",
    nama: "FlickReels",
    inisial: "FK",
    warna: "#4a6be0",
    aktif: true,
    caraEpisode: "nomor",
    titik: {
      terbaru: { jalur: "/flickreels/latest", berkas: "flickreels/latest" },
      lainnya: { jalur: "/flickreels/foryou", berkas: "flickreels/foryou", halaman: halamanNomor(50) },
      cari: { jalur: "/flickreels/search", berkas: "flickreels/search", kunciCari: "query" },
      rinci: { jalur: "/flickreels/detail", berkas: "flickreels/detail", kunciId: "playlet_id" },
      episode: {
        jalur: "/flickreels/get-episode", berkas: "flickreels/episode",
        kunciId: "playlet_id",
        kunciEpisode: "episodeNumber",
      },
    },
  },
  {
    id: "dramanova",
    nama: "DramaNova",
    inisial: "DN",
    warna: "#8a8f98",
    // Dimatikan di hulu sejak 12 September 2026 dengan catatan "api lagi
    // error". Tabelnya ditinggalkan utuh supaya menyalakannya kembali kelak
    // cukup mengubah satu kata.
    aktif: false,
    catatan: "Dimatikan di hulu sejak 12 September 2026 — API sumbernya bermasalah.",
    caraEpisode: "id-episode",
    kunciIdEpisode: "fileId",
    titik: {
      // Tanpa penomoran, dan itu memang keadaan di hulu: rute berandanya
      // meneruskan kueri apa pun yang diterimanya tanpa menyebut satu nama
      // parameter pun, sehingga nama yang benar tidak dapat dipastikan tanpa
      // API-nya hidup. Menebaknya berarti menuliskan angka yang diam-diam
      // diabaikan — dan penyelaras tiga harian akan melaporkannya sebagai
      // beda yang tidak pernah dapat dibereskan.
      terbaru: { jalur: "/dramanova/home", berkas: "dramanova/home" },
      cari: { jalur: "/dramanova/search", berkas: "dramanova/search", kunciCari: "query", halaman: halamanNomor(100) },
      rinci: { jalur: "/dramanova/detail", berkas: "dramanova/detail", kunciId: "dramaId" },
      episode: { jalur: "/dramanova/getvideo", berkas: "dramanova/getvideo", kunciId: "fileId" },
    },
  },
];

/** Platform yang boleh dibuka pengunjung hari ini. */
export function platformAktif(): Platform[] {
  return PLATFORM.filter((item) => item.aktif);
}

export function cariPlatform(id: string | null | undefined): Platform | null {
  if (!id) return null;
  return PLATFORM.find((item) => item.id === id) ?? null;
}

/** Platform aktif dengan nama yang cocok; null bila tidak ada atau dimatikan. */
export function platformTerbuka(id: string | null | undefined): Platform | null {
  const platform = cariPlatform(id);
  return platform?.aktif ? platform : null;
}

// ============================================================
// MENYUSUN ALAMAT HULU
// ============================================================

export type Permintaan = {
  /** Pengenal judul, untuk rinci dan episode. */
  id?: string;
  /** Kata kunci pencarian. */
  cari?: string;
  /** Nomor episode, untuk platform bercara "nomor". */
  episode?: number | string;
  /** Penanda halaman berikutnya: nomor halaman, geseran, atau kursor. */
  halaman?: string;
};

/**
 * Alamat hulu untuk sebuah permintaan, atau null bila platform ini memang
 * tidak melayaninya.
 *
 * Mengembalikan null — bukan melempar — karena "PineDrama tidak punya daftar
 * Terbaru" bukan kesalahan yang perlu menghentikan halaman: barisnya cukup
 * tidak digambar.
 */
export function alamatHulu(platform: Platform, aksi: Aksi, minta: Permintaan = {}): string | null {
  const titik = platform.titik[aksi];
  if (!titik) return null;

  const alamat = new URL(`${alamatApiHulu()}${titik.jalur}`);

  if (titik.kunciCari) {
    const kata = (minta.cari ?? "").trim();
    if (!kata) return null;
    alamat.searchParams.set(titik.kunciCari, kata);
  }

  if (titik.kunciId) {
    const id = (minta.id ?? "").trim();
    if (!id) return null;
    alamat.searchParams.set(titik.kunciId, id);
  }

  if (titik.kunciEpisode) {
    const nomor = Number(minta.episode);
    if (!Number.isFinite(nomor) || nomor < 1) return null;
    alamat.searchParams.set(titik.kunciEpisode, String(Math.floor(nomor)));
  }

  if (titik.halaman) {
    // Halaman yang tidak diminta tetap dikirimkan dengan nilai awalnya. Hulu
    // memang mengharapkannya ada, dan menghilangkannya membuat sebagian
    // platform menjawab dengan daftar kosong, bukan dengan halaman pertama.
    alamat.searchParams.set(titik.halaman.kunci, (minta.halaman || titik.halaman.mulai).slice(0, 120));
  }

  return alamat.toString();
}

/** Nama parameter halaman untuk sebuah aksi; kosong bila sekali ambil habis. */
export function penomoran(platform: Platform, aksi: Aksi): Penomoran | null {
  return platform.titik[aksi]?.halaman ?? null;
}

/** Keadaan sebuah daftar yang sedang digulir. */
export type Gulir = {
  /** Berapa potong yang sudah diminta, termasuk yang pertama. */
  potong: number;
  /** Penanda yang dikirim hulu pada potongan terakhir; boleh kosong. */
  kursor: string;
  /** Benar bila hulu sendiri sudah bilang tidak ada lagi. */
  habis: boolean;
};

/**
 * Penanda potongan berikutnya, atau null bila memang tidak ada lagi.
 *
 * Satu fungsi untuk tiga cara penomoran sekaligus, dan itu yang membuat layar
 * tidak perlu tahu bahwa Melolo menghitung geseran sementara DramaBox
 * menghitung halaman. Yang menghentikannya ada tiga, dan ketiganya perlu:
 * hulu bilang habis, batas potongan tercapai, atau penomoran kursor yang
 * kehabisan kursornya — kursor kosong tidak dapat ditebak sendiri, dan
 * menebaknya berarti meminta halaman pertama berulang kali.
 */
export function gulirBerikut(cara: Penomoran | null, sudah: Gulir): string | null {
  if (!cara) return null;
  if (sudah.habis) return null;
  if (sudah.potong >= cara.batas) return null;

  if (cara.kunci === "cursor") return sudah.kursor || null;
  // Geseran dan halaman sama-sama dapat dihitung sendiri, tetapi angka dari
  // hulu selalu lebih dipercaya: ia tahu berapa judul yang benar-benar
  // dikirimkannya, dan kita hanya tahu berapa yang kita minta.
  if (sudah.kursor) return sudah.kursor;
  if (cara.kunci === "offset") return String(sudah.potong * (cara.langkah ?? 20));
  return String(sudah.potong + 1);
}

/** Aksi daftar yang benar-benar dilayani platform ini, menurut urutan tampil. */
export function barisDaftar(platform: Platform): Array<{ aksi: Aksi; judul: string }> {
  const semua: Array<{ aksi: Aksi; judul: string }> = [
    { aksi: "populer", judul: "Lagi Ramai" },
    { aksi: "terbaru", judul: "Baru Masuk" },
    { aksi: "lainnya", judul: "Buat Kamu" },
  ];
  return semua.filter((baris) => Boolean(platform.titik[baris.aksi]));
}

/**
 * Alamat hulu untuk menyiapkan tautan video yang tidak dapat dibuka apa
 * adanya, mis. videoPath DramaBox yang masih tersandi. null bila platform ini
 * memang tidak memerlukannya.
 */
export function alamatAliranHulu(platform: Platform, tautan: string): string | null {
  if (!platform.jalurAliran || !tautan) return null;
  const alamat = new URL(`${alamatApiHulu()}${platform.jalurAliran}`);
  alamat.searchParams.set("url", tautan);
  return alamat.toString();
}

/**
 * User-Agent yang dipakai proyek hulu untuk seluruh permintaannya.
 *
 * Disalin apa adanya: beberapa titik hulu menjawab berbeda untuk peramban
 * biasa, dan meniru permintaan yang sudah terbukti dilayani lebih jujur
 * daripada menebak-nebak sendiri.
 */
export const UA_HULU = "okhttp/4.12.0";
