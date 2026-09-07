// ============================================================
// KUNCI TANGKAPAN LAYAR — SIAPA YANG SEBENARNYA DAPAT MENOLAKNYA
//
// Satu kalimat yang harus dibaca lebih dulu, karena seluruh berkas ini berdiri
// di atasnya:
//
//   PERAMBAN TIDAK DAPAT MELARANG TANGKAPAN LAYAR. SISTEM OPERASI DAPAT.
//
// Tidak ada satu pun API web yang menahan Print Screen, alat potong bawaan,
// perekam layar, apalagi tombol Volume+Power di ponsel. Halaman web hanya
// mengetahui hal-hal di sekitarnya — tombol yang tertekan, jendela yang
// kehilangan fokus, halaman yang disembunyikan — dan dari situ ia dapat
// MENUTUP SOALNYA, bukan menggagalkan tangkapannya.
//
// Yang benar-benar menolak ada di lapisan aplikasi, dan keduanya sudah
// disediakan sistem operasinya sendiri:
//
//   ANDROID — FLAG_SECURE pada jendela aplikasi. Sistem menolak tangkapan
//             layar dan perekaman layar, lalu menampilkan pemberitahuannya
//             sendiri: "Tidak dapat mengambil tangkapan layar karena kebijakan
//             keamanan." Halaman ujian tidak perlu berbuat apa-apa.
//   WINDOWS — SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE). Jendela
//             ujian menjadi HITAM pada setiap tangkapan layar dan setiap
//             perekaman — termasuk Snipping Tool, OBS, Zoom share, dan Teams.
//
// Keduanya ada di dalam lockdown/ pada repositori ini, dan keduanya menyapa
// halaman ujian lewat penanda yang dibaca berkas ini.
//
// TIGA HAL YANG TIDAK BOLEH DIJANJIKAN, apa pun yang tertulis di atas:
//
//   1. Ponsel kedua yang diarahkan ke monitor. Tidak ada perangkat lunak yang
//      menghalanginya, tidak akan pernah ada.
//   2. iOS. Apple tidak menyediakan padanan FLAG_SECURE untuk aplikasi biasa;
//      yang mungkin di sana hanya MENDETEKSI tangkapan layar sesudah terjadi.
//   3. Peramban biasa di komputer mana pun. Di situ yang tersisa hanya
//      menyulitkan, mencatat, dan menandai — dan itu memang yang dikerjakan
//      penjaga layarnya.
//
// Karena itu kalimat yang ditampilkan ke peserta HARUS berbeda menurut
// perangkatnya. Mengatakan "tangkapan layar diblokir" pada peramban biasa
// adalah kebohongan yang akan diuji peserta pertama dalam lima detik — dan
// begitu terbukti bohong, seluruh peringatan lain di layar itu ikut kehilangan
// wibawanya.
// ============================================================

/** Perangkat yang dipakai peserta untuk mengerjakan ujian. */
export type JenisKlien = "peramban" | "android" | "windows";

export const SEMUA_KLIEN: JenisKlien[] = ["peramban", "android", "windows"];

export const KLIEN_LABEL: Record<JenisKlien, string> = {
  peramban: "Peramban biasa",
  android: "Exam Browser Android",
  windows: "Exam Browser Windows",
};

/**
 * Penanda yang disisipkan aplikasi ujian ke dalam User-Agent-nya.
 *
 * Bentuk lengkapnya, mis.:
 *   Mozilla/5.0 (…) SiPalingCBT/1.0.0 (android; kunci-layar)
 *
 * Ada DUA jalan pengenalan — penanda ini dan objek jembatan yang disuntikkan
 * aplikasi ke halaman — karena keduanya gagal pada keadaan yang berbeda.
 * User-Agent selamat melewati pemuatan ulang halaman dan terbaca server tanpa
 * satu baris JavaScript pun; objek jembatan bertahan walau ada pengelola
 * jaringan yang menulis ulang User-Agent di tengah jalan.
 */
export const PENANDA_KLIEN = "SiPalingCBT";

/** Apa yang benar-benar dapat ditolak tiap perangkat. */
export type KemampuanKunci = {
  /**
   * Sistem operasi menolak tangkapan layar DAN perekaman layar pada jendela
   * ujian. Inilah satu-satunya yang boleh disebut "diblokir" kepada peserta.
   */
  tangkapan: boolean;
  /** Jendela ujian tidak dapat ditinggalkan begitu saja ke aplikasi lain. */
  kiosk: boolean;
  /** Navigasi ke alamat di luar situs ujian ditolak aplikasinya. */
  allowlist: boolean;
};

export const KEMAMPUAN: Record<JenisKlien, KemampuanKunci> = {
  // Peramban biasa: tidak satu pun. Ini bukan kekurangan yang akan diperbaiki
  // versi berikutnya — memang tidak ada jalannya.
  peramban: { tangkapan: false, kiosk: false, allowlist: false },
  android: { tangkapan: true, kiosk: true, allowlist: true },
  windows: { tangkapan: true, kiosk: true, allowlist: true },
};

/** Tangkapan layar benar-benar ditolak sistem pada perangkat ini? */
export function kunciSistem(klien: JenisKlien): boolean {
  return KEMAMPUAN[klien].tangkapan;
}

/**
 * Bersihkan jenis klien yang datang dari luar.
 *
 * Selalu jatuh ke "peramban" — yang paling longgar — bila tidak dikenali.
 * Arah jatuhnya penting: masukan sembarang tidak boleh membuat sistem
 * MENGIRA ujiannya berjalan di dalam aplikasi terkunci, karena dari situ ia
 * akan menuliskan "tangkapan layar diblokir" pada layar yang tidak memblokir
 * apa pun.
 */
export function rapikanKlien(masukan: unknown): JenisKlien {
  const teks = String(masukan ?? "").trim().toLowerCase();
  return (SEMUA_KLIEN as string[]).includes(teks) ? (teks as JenisKlien) : "peramban";
}

/** Bentuk objek jembatan yang disuntikkan aplikasi ujian ke halaman. */
export type JembatanKlien = {
  jenis?: unknown;
  versi?: unknown;
  /** Aplikasinya menyatakan kunci layar sistem sedang menyala. */
  kunciLayar?: unknown;
  /**
   * Kunci bersama yang dibawa aplikasinya, diteruskan halaman ke server pada
   * saat masuk ujian. Lihat `periksaKunciKlien` untuk batas kekuatannya.
   */
  kunci?: unknown;
};

/**
 * Kenali perangkat dari User-Agent dan objek jembatannya.
 *
 * Objek jembatan didahulukan: ia hanya ada bila aplikasinya sendiri yang
 * menyuntikkannya, sedangkan User-Agent dapat ditulis ulang oleh siapa saja di
 * sepanjang jalan — termasuk oleh pengelola jaringan kampus yang menyisipkan
 * penandanya sendiri.
 *
 * PEMBACAAN INI TIDAK PERNAH MENJADI BUKTI. Siapa pun yang membuka alat
 * pengembang dapat membuat objek jembatan palsu dalam satu baris. Itu sebabnya
 * gerbang di server memakai kunci bersama (lihat `periksaKunciKlien`), dan
 * sebabnya pula alat pengembang yang terbuka sendiri sudah dicatat sebagai
 * insiden.
 */
export function bacaKlien(petunjuk: { ua?: string | null; jembatan?: JembatanKlien | null }): JenisKlien {
  const jembatan = petunjuk.jembatan;
  if (jembatan && typeof jembatan === "object") {
    const jenis = rapikanKlien(jembatan.jenis);
    if (jenis !== "peramban") return jenis;
  }
  const ua = String(petunjuk.ua ?? "");
  if (!ua.includes(PENANDA_KLIEN)) return "peramban";
  // Diambil dari dalam kurung sesudah penandanya, mis. "(android; kunci-layar)".
  const cocok = /SiPalingCBT\/[\w.+-]+\s*\(([^)]*)\)/.exec(ua);
  const isi = (cocok?.[1] ?? "").toLowerCase();
  if (isi.includes("android")) return "android";
  if (isi.includes("windows")) return "windows";
  return "peramban";
}

/**
 * Kunci bersama yang dibawa aplikasi ujian, dibandingkan dengan yang disimpan
 * server.
 *
 * TENTANG SEBERAPA KUAT INI — dan ini harus dikatakan terus terang, bukan
 * dikubur di dalam kode: kunci ini ikut tertanam di dalam berkas aplikasinya.
 * Siapa pun yang membongkar .apk atau .exe-nya dapat menemukannya, lalu masuk
 * dari peramban biasa sambil mengaku sebagai aplikasi terkunci. Itu batasnya,
 * dan tidak ada rancangan sisi-klien yang menghapus batas itu.
 *
 * Yang dikerjakannya tetap nyata: ia mengubah "ketik satu baris di alat
 * pengembang" menjadi "bongkar aplikasinya lebih dulu". Sebagian besar
 * kecurangan berhenti persis di antara keduanya.
 *
 * Kunci yang belum disetel mengembalikan `true`, dan itu disengaja. Kampus
 * yang belum menyiapkan environment-nya tetap mendapat gerbang yang bekerja
 * dari pengenalan perangkat saja — lemah, tetapi ada — alih-alih ujian yang
 * menolak seluruh pesertanya pada pagi hari pelaksanaan.
 */
export function periksaKunciKlien(kunciServer: string | undefined | null, kunciKlien: unknown): boolean {
  const server = String(kunciServer ?? "").trim();
  if (!server) return true;
  return String(kunciKlien ?? "").trim() === server;
}

/**
 * Boleh masuk ujian dengan perangkat ini?
 *
 * Dipanggil server, bukan halaman. Halaman yang memutuskannya sendiri akan
 * selalu menjawab "boleh" bagi siapa pun yang mematikan JavaScript-nya.
 */
export type PutusanKlien = { ok: true } | { ok: false; pesan: string };

/**
 * Perangkat mana yang wajib memakai Exam Browser.
 *
 * Ada karena ruang ujian tidak seragam. Kelas yang seluruhnya memakai ponsel
 * tidak perlu menerima aplikasi Windows, dan laboratorium komputer tidak perlu
 * menyuruh pesertanya memasang aplikasi Android.
 */
export type PerangkatKunci = "semua" | "android" | "windows";

export const SEMUA_PERANGKAT: PerangkatKunci[] = ["semua", "android", "windows"];

export const PERANGKAT_LABEL: Record<PerangkatKunci, string> = {
  semua: "HP dan PC",
  android: "HP Android saja",
  windows: "PC Windows saja",
};

/**
 * Selalu jatuh ke "semua", yang paling longgar.
 *
 * Arah jatuhnya penting: masukan sembarang tidak boleh MEMPERSEMPIT perangkat
 * yang diterima, karena yang tertolak di sana adalah peserta yang datang
 * dengan aplikasi yang benar.
 */
export function rapikanPerangkatKunci(masukan: unknown): PerangkatKunci {
  const teks = String(masukan ?? "").trim().toLowerCase();
  return (SEMUA_PERANGKAT as string[]).includes(teks) ? (teks as PerangkatKunci) : "semua";
}

export function bolehMasukKlien(
  wajibAplikasi: boolean,
  klien: JenisKlien,
  kunciCocok: boolean,
  perangkat: PerangkatKunci = "semua",
): PutusanKlien {
  if (!wajibAplikasi) return { ok: true };

  const namaApl =
    perangkat === "android" ? "Exam Browser untuk HP Android"
      : perangkat === "windows" ? "Exam Browser untuk PC Windows"
        : "aplikasi Exam Browser";

  if (klien === "peramban") {
    return {
      ok: false,
      pesan:
        `Ujian ini hanya dapat dibuka lewat ${namaApl}. Unduh dari tautan yang diberikan ` +
        "pengajarmu, lalu masukkan kode ujian yang sama.",
    };
  }
  // Perangkat yang benar aplikasinya, tetapi bukan perangkat yang diminta.
  // Kalimatnya menyebut yang harus dipakai, bukan yang salah: peserta yang
  // membaca "aplikasi Windows ditolak" masih belum tahu ia harus mengambil
  // ponselnya.
  if (perangkat !== "semua" && klien !== perangkat) {
    return {
      ok: false,
      pesan: `Ujian ini hanya dapat dikerjakan lewat ${namaApl}.`,
    };
  }
  if (!kunciCocok) {
    return {
      ok: false,
      pesan:
        "Exam Browser yang kamu pakai tidak dikenali server. Pastikan aplikasinya diunduh " +
        "dari tautan resmi pengajarmu dan versinya yang terbaru.",
    };
  }
  return { ok: true };
}

// ------------------------------------------------------------
// TIRAI LAYAR
// ------------------------------------------------------------

/**
 * Mengapa soalnya sedang ditutup.
 *
 * Tirai adalah satu-satunya hal yang DAPAT dikerjakan halaman web terhadap
 * tangkapan layar, dan cara kerjanya harus dimengerti supaya tidak dijanjikan
 * berlebihan: ia tidak menggagalkan tangkapannya, ia MENGOSONGKAN ISINYA.
 * Yang tertangkap bukan soal melainkan bidang gelap bertuliskan nama peserta.
 *
 * Seberapa jauh ia berhasil berbeda-beda, dan bedanya jujur:
 *
 *   ALAT POTONG (Win+Shift+S, Cmd+Shift+4) — hampir selalu berhasil. Sesudah
 *     tombolnya ditekan, orangnya masih harus menyeret kotak seleksi, dan itu
 *     memakan waktu yang jauh lebih panjang daripada satu gambar ulang.
 *   PINDAH APLIKASI, TARIK BARIS NOTIFIKASI, LAYAR TERKUNCI — berhasil.
 *     Halamannya disembunyikan lebih dulu, dan itu terbaca peristiwa.
 *   PEREKAM LAYAR yang dimulai dari aplikasi lain — berhasil menutup, karena
 *     memulainya menuntut perpindahan aplikasi.
 *   PRINT SCREEN — sering TIDAK sempat. Sistem menyalin layar pada saat
 *     tombolnya ditekan, sebelum halaman ini sempat digambar ulang. Yang
 *     tersisa di sana hanya catatan insiden dan tanda air.
 *   TOMBOL VOLUME+POWER DI PONSEL — TIDAK terbaca sama sekali. Tidak ada
 *     peristiwa web untuk itu. Inilah yang menuntut aplikasi Android, dan
 *     inilah alasan lockdown/android/ ada.
 */
export type SebabTirai = "tangkap" | "pergi" | "layar";

export const PESAN_TIRAI: Record<SebabTirai, { judul: string; isi: string }> = {
  tangkap: {
    judul: "Soal disembunyikan",
    isi:
      "Percobaan tangkapan layar terdeteksi dan sudah dicatat pengawas beserta jamnya. " +
      "Soal muncul kembali sebentar lagi.",
  },
  pergi: {
    judul: "Soal disembunyikan",
    isi:
      "Layar ujian ditinggalkan. Soal ditutup selama halaman ini tidak di depan, dan " +
      "kepergiannya sudah dicatat pengawas. Soal muncul kembali sendiri begitu layar ini " +
      "kembali ke depan.",
  },
  // Satu-satunya tirai yang TIDAK membuka dirinya sendiri sesudah beberapa
  // detik, dan itu yang membuatnya menjadi penegakan dan bukan sekadar
  // peringatan: selama peserta di luar layar penuh, soalnya memang tidak ada
  // untuk dibaca. Karena ia menetap, ia WAJIB membawa jalan keluarnya sendiri
  // — tombol kembali ke layar penuh di dalam tiraïnya — sebab tirai menelan
  // ketukan, dan tombol apa pun di baliknya tidak dapat ditekan lagi.
  layar: {
    judul: "Ujian ini dikerjakan dalam layar penuh",
    isi:
      "Kamu sedang di luar layar penuh, dan itu sudah dicatat pengawas. Soal ditutup " +
      "sampai layar penuh dinyalakan kembali.",
  },
};

/**
 * Berapa lama tirai menutup sesudah isyarat tangkapan layar, dalam milidetik.
 *
 * Cukup panjang untuk melewati seluruh gerakan memotong layar — menekan
 * pintasannya, menunggu bidangnya redup, menyeret kotak seleksi — dan cukup
 * pendek untuk tidak terasa sebagai ujian yang macet. Peserta yang tidak
 * mengambil tangkapan layar tetapi papan ketiknya menekan Print Screen tanpa
 * sengaja harus kembali membaca soalnya sebelum sempat panik.
 */
export const TIRAI_MS = 2200;

// ------------------------------------------------------------
// APA YANG TIDAK LAGI ADA DI SINI
//
// `pesanKunciLayar` dan `ajakanAplikasi` dibuang. Keduanya menuliskan di layar
// peserta apa saja yang sedang dijaga: "tangkapan layar diawasi", "peramban
// tidak dapat menolak tangkapan layar", "identitasmu tercetak samar".
//
// Layar yang mengumumkan apa saja yang diawasi juga mengumumkan apa saja yang
// TIDAK diawasi, dan itu peta bagi orang yang mencari celahnya. Yang
// menggantikannya adalah kotak teguran yang baru muncul SESUDAH peserta
// berbuat sesuatu (lihat pesanTeguran di src/lib/pengawasan.ts): pada saat itu
// ia sudah tertangkap, jadi tidak ada lagi yang bocor dengan mengatakannya.
// ------------------------------------------------------------
