// ============================================================
// PENGAWASAN UJIAN — APA YANG BENAR-BENAR DAPAT DIJANJIKAN
//
// Satu hal harus jujur dikatakan lebih dulu, karena seluruh rancangan ini
// berdiri di atasnya:
//
//   PERAMBAN TIDAK DAPAT MELARANG TANGKAPAN LAYAR. Titik.
//
// Tidak ada satu pun API web yang dapat menahan tombol Print Screen, alat
// potong bawaan sistem, perekam layar, apalagi ponsel kedua yang diarahkan ke
// monitor. Siapa pun yang menjanjikan sebaliknya sedang menjual sesuatu yang
// tidak ada. Yang DAPAT dilakukan ada tiga, dan ketiganya nyata:
//
//   1. MENYULITKAN  — salin, potong, tempel, klik kanan, dan seleksi teks
//      dimatikan. Ini menutup jalan yang paling sering dipakai: menyalin soal
//      ke ChatGPT lalu menempelkan jawabannya kembali.
//   2. MENCATAT     — setiap percobaan ditulis lengkap dengan jamnya. Yang
//      lolos pun meninggalkan jejak yang dapat dibaca penguji.
//   3. MENANDAI     — nama, nomor peserta, dan jamnya ditumpuk samar di atas
//      layarnya. Tangkapan layar tetap bisa diambil, tetapi setiap lembar yang
//      bocor menunjuk satu orang, dan orang itu tahu ia tertulis di sana.
//
// Nomor tiga itu yang sebenarnya bekerja pada ujian sertifikasi. Pencegahan
// yang berhasil bukan yang menutup rapat, melainkan yang membuat perbuatannya
// tidak sepadan dengan risikonya.
// ============================================================

/**
 * Seberapa ketat ujian ini diawasi.
 *
 * Sengaja hanya tiga, dan dipilih dari satu daftar pilih. Pengajar tidak
 * seharusnya diminta mencentang sebelas kotak yang tidak ia mengerti akibatnya;
 * yang ia tahu adalah ujiannya kuis harian, UAS, atau uji sertifikasi.
 */
export type ModePengawasan = "biasa" | "ketat" | "sertifikasi";

export const SEMUA_MODE: ModePengawasan[] = ["biasa", "ketat", "sertifikasi"];

export const MODE_LABEL: Record<ModePengawasan, string> = {
  biasa: "Biasa",
  ketat: "Ketat",
  sertifikasi: "Sertifikasi / OSCE",
};

export const MODE_KETERANGAN: Record<ModePengawasan, string> = {
  biasa:
    "Kuis dan latihan. Pindah tab tetap dicatat, selebihnya dibiarkan — " +
    "peserta boleh menyalin soal untuk dibaca ulang.",
  ketat:
    "UTS dan UAS. Layar penuh diwajibkan, salin-tempel dimatikan, dan " +
    "identitas peserta tercetak samar di seluruh layarnya.",
  sertifikasi:
    "Uji sertifikasi profesi dan OSCE. Seluruh penjagaan mode Ketat, ditambah " +
    "pengawasan lingkungan, dan ujian dikumpulkan paksa sesudah beberapa kali " +
    "pelanggaran berat.",
};

/**
 * Apakah kamera pengawas benar-benar menyala untuk satu ujian.
 *
 * DUA syarat, dan keduanya harus benar:
 *
 *   1. modenya memang memakai kamera — hanya Sertifikasi/OSCE. Kuis harian
 *      yang menyalakan webcam bukan sesuatu yang diinginkan siapa pun, dan
 *      membiarkannya mungkin terjadi karena satu saklar tergeser lebih buruk
 *      daripada keluwesan yang didapat.
 *   2. saklarnya tidak dimatikan Admin atau Super Admin.
 *
 * Saklarnya menyala secara bawaan, jadi ujian sertifikasi tetap terawasi
 * tanpa ada yang perlu menekan apa pun. Ia ada untuk MEMATIKAN — kelas yang
 * separuh pesertanya tidak punya kamera, atau ujian yang memang tidak boleh
 * merekam wajah — dan yang memegangnya bukan pengajar pemilik ujiannya melainkan
 * Admin, karena merekam wajah orang adalah keputusan lembaga.
 */
export function kameraMenyala(mode: ModePengawasan, saklar: boolean): boolean {
  return aturanMode(mode).kamera && saklar !== false;
}

export function rapikanMode(masukan: unknown): ModePengawasan {
  const teks = String(masukan ?? "").trim().toLowerCase();
  return (SEMUA_MODE as string[]).includes(teks) ? (teks as ModePengawasan) : "biasa";
}

export type AturanPengawasan = {
  /** Ujian dijalankan dalam layar penuh; keluar darinya dicatat. */
  layarPenuh: boolean;
  /** Salin, potong, tempel, klik kanan, seret, dan seleksi teks dimatikan. */
  kunciSalin: boolean;
  /** Identitas peserta ditumpuk samar di atas layar. */
  tandaAir: boolean;
  /** Tombol tangkapan layar dicegat dan dicatat — dicegat, bukan dicegah. */
  jagaTangkapanLayar: boolean;
  /** Layar kedua dan alat pengembang ikut diperiksa. */
  jagaLingkungan: boolean;
  /**
   * Berapa pelanggaran BERAT sebelum ujiannya dikumpulkan paksa.
   * 0 berarti tidak pernah dipaksa — hanya dicatat.
   */
  batasPaksa: number;
  /** Kamera peserta dinyalakan dan diawasi selama ujian. */
  kamera: boolean;
  /**
   * Berapa kali paling banyak satu peserta boleh diperiksa MODEL selama satu
   * ujian.
   *
   * Ada dan sengaja kecil, karena batas ini adalah batas UANG. Tanpa ia,
   * satu ujian empat puluh peserta selama sembilan puluh menit dapat
   * menghasilkan ribuan panggilan model, dan tagihannya baru terlihat pada
   * akhir bulan. Yang murah dikerjakan di perangkat peserta lebih dulu
   * (lihat src/lib/awas-kamera.ts); jatah ini hanya untuk yang benar-benar
   * meragukan.
   */
  jatahAi: number;
  /** Peringatan di layar tiap kali ada pelanggaran. */
  peringatanLayar: boolean;
};

export function aturanMode(mode: ModePengawasan): AturanPengawasan {
  if (mode === "sertifikasi") {
    return {
      layarPenuh: true, kunciSalin: true, tandaAir: true,
      jagaTangkapanLayar: true, jagaLingkungan: true,
      // Lima, bukan tiga. Satu notifikasi sistem yang muncul sendiri sudah
      // merebut fokus, dan mengumpulkan paksa ujian sertifikasi orang karena
      // hal itu jauh lebih merugikan daripada satu peserta curang yang lolos.
      batasPaksa: 5,
      peringatanLayar: true,
      kamera: true,
      jatahAi: 12,
    };
  }
  if (mode === "ketat") {
    return {
      layarPenuh: true, kunciSalin: true, tandaAir: true,
      jagaTangkapanLayar: true, jagaLingkungan: false,
      batasPaksa: 0, peringatanLayar: true,
      kamera: false, jatahAi: 0,
    };
  }
  return {
    layarPenuh: false, kunciSalin: false, tandaAir: false,
    jagaTangkapanLayar: false, jagaLingkungan: false,
    batasPaksa: 0, peringatanLayar: false,
    kamera: false, jatahAi: 0,
  };
}

// ------------------------------------------------------------
// INSIDEN
// ------------------------------------------------------------

/**
 * Jenis kejadian yang dicatat. Namanya tetap, karena ia tersimpan di basis
 * data dan dibaca kembali berbulan-bulan kemudian saat hasil ujian digugat.
 */
export type JenisInsiden =
  | "tab"          // halaman disembunyikan — pindah tab atau pindah aplikasi
  | "fullscreen"   // keluar dari layar penuh
  | "blur"         // jendela kehilangan fokus tanpa disembunyikan
  | "salin"        // menyalin atau memotong teks soal
  | "tempel"       // menempelkan sesuatu ke kolom jawaban
  | "tangkap"      // menekan tombol tangkapan layar
  | "klik_kanan"   // membuka menu klik kanan
  | "devtools"     // alat pengembang peramban terbuka
  | "layar_kedua"  // terdeteksi lebih dari satu layar
  // ---------- DARI KAMERA ----------
  // Tiga yang pertama dikenali di perangkat peserta tanpa model sama sekali,
  // dan karena itu tidak berbiaya. Dua yang terakhir menuntut model, dan
  // hanya dipanggil ketika yang murah sudah tidak dapat memutuskan.
  | "kamera_mati"      // izin kamera dicabut atau perangkatnya dilepas
  | "kamera_tertutup"  // lensa tertutup: gambarnya gelap merata
  | "kamera_beku"      // gambarnya tidak berubah sama sekali — foto, bukan orang
  | "wajah_hilang"     // tidak ada orang di depan layar
  | "orang_lain";      // lebih dari satu orang, atau orang yang berbeda

export const SEMUA_INSIDEN: JenisInsiden[] = [
  "tab", "fullscreen", "blur", "salin", "tempel",
  "tangkap", "klik_kanan", "devtools", "layar_kedua",
  "kamera_mati", "kamera_tertutup", "kamera_beku", "wajah_hilang", "orang_lain",
];

export const INSIDEN_LABEL: Record<JenisInsiden, string> = {
  tab: "Pindah tab atau aplikasi",
  fullscreen: "Keluar dari layar penuh",
  blur: "Jendela kehilangan fokus",
  salin: "Menyalin teks soal",
  tempel: "Menempel ke kolom jawaban",
  tangkap: "Menekan tombol tangkapan layar",
  klik_kanan: "Membuka menu klik kanan",
  devtools: "Alat pengembang terbuka",
  layar_kedua: "Terdeteksi layar kedua",
  kamera_mati: "Kamera dimatikan atau izinnya dicabut",
  kamera_tertutup: "Lensa kamera tertutup",
  kamera_beku: "Gambar kamera tidak berubah",
  wajah_hilang: "Tidak ada orang di depan kamera",
  orang_lain: "Terdeteksi orang lain di depan kamera",
};

export function rapikanInsiden(masukan: unknown): JenisInsiden | null {
  const teks = String(masukan ?? "").trim().toLowerCase();
  return (SEMUA_INSIDEN as string[]).includes(teks) ? (teks as JenisInsiden) : null;
}

/**
 * Bobot tiap insiden terhadap skor integritas.
 *
 * Urutannya bukan selera. Yang paling berat adalah yang paling sulit terjadi
 * tanpa sengaja: alat pengembang tidak terbuka sendiri, dan menempel ke kolom
 * essay hampir selalu berarti jawabannya disusun di tempat lain. Yang paling
 * ringan adalah yang paling sering terjadi tanpa maksud apa-apa — jendela
 * kehilangan fokus karena notifikasi, dan klik kanan karena kebiasaan.
 */
export const BOBOT_INSIDEN: Record<JenisInsiden, number> = {
  // Menutup lensa dan membekukan gambar adalah perbuatan yang tidak mungkin
  // terjadi tanpa maksud, dan keduanya menghapus seluruh pengawasan sekaligus.
  kamera_tertutup: 35,
  kamera_beku: 35,
  kamera_mati: 30,
  devtools: 30,
  orang_lain: 30,
  tempel: 25,
  tangkap: 20,
  layar_kedua: 15,
  // Lebih ringan daripada dugaan orang, dan itu disengaja. Peserta menunduk
  // membaca soal di kertas buram, membetulkan posisi duduk, atau kameranya
  // menyorot dahi saja — ketiganya menghasilkan "wajah hilang" yang sama
  // sekali bukan kecurangan.
  wajah_hilang: 8,
  tab: 10,
  fullscreen: 10,
  salin: 8,
  blur: 3,
  klik_kanan: 2,
};

/**
 * Pelanggaran yang ikut dihitung menuju pengumpulan paksa.
 *
 * Blur dan klik kanan sengaja DI LUAR daftar ini. Keduanya terjadi tanpa
 * kehendak peserta — satu notifikasi sistem sudah cukup — dan memaksa
 * mengumpulkan ujian sertifikasi karena hal itu adalah kesalahan yang jauh
 * lebih mahal daripada yang hendak dicegahnya.
 */
export const INSIDEN_BERAT: JenisInsiden[] = [
  "tab", "fullscreen", "tangkap", "tempel", "devtools",
  // Menutup lensa, membekukan gambar, dan mematikan kamera ikut, karena
  // ketiganya menghapus pengawasannya sendiri — dibiarkan berulang, sisa
  // penjagaan tidak ada artinya.
  "kamera_tertutup", "kamera_beku", "kamera_mati",
  // "wajah_hilang" dan "orang_lain" sengaja TIDAK ikut. Yang pertama terlalu
  // sering terjadi tanpa maksud; yang kedua datang dari pembacaan model, dan
  // menghentikan ujian sertifikasi orang atas dasar tebakan model — tanpa
  // seorang pun melihat gambarnya lebih dulu — adalah hal yang tidak boleh
  // dilakukan sistem ini. Keduanya tetap dicatat dan tetap menurunkan skor;
  // yang memutuskan penguji.
];

export function berat(jenis: JenisInsiden) {
  return INSIDEN_BERAT.includes(jenis);
}

export type HitunganInsiden = Partial<Record<JenisInsiden, number>>;

/**
 * Skor integritas 0–100. Seratus berarti tidak ada satu pun catatan.
 *
 * Angka ini BUKAN vonis, dan tidak pernah mengubah nilai ujian. Ia hanya
 * mengurutkan: peserta mana yang lembar pengawasannya perlu dibaca penguji
 * lebih dulu. Yang memutuskan tetap manusia, dengan garis waktu insidennya di
 * depan mata — bukan angka ini sendirian.
 */
export function skorIntegritas(hitungan: HitunganInsiden): number {
  let kurang = 0;
  for (const jenis of SEMUA_INSIDEN) {
    const n = Math.max(0, Math.floor(hitungan[jenis] ?? 0));
    kurang += n * BOBOT_INSIDEN[jenis];
  }
  return Math.max(0, Math.min(100, 100 - kurang));
}

export type TingkatIntegritas = "bersih" | "wajar" | "tinjau" | "diragukan";

export const TINGKAT_LABEL: Record<TingkatIntegritas, string> = {
  bersih: "Bersih",
  wajar: "Wajar",
  tinjau: "Perlu ditinjau",
  diragukan: "Diragukan",
};

export function tingkatIntegritas(skor: number): TingkatIntegritas {
  if (skor >= 100) return "bersih";
  if (skor >= 80) return "wajar";
  if (skor >= 50) return "tinjau";
  return "diragukan";
}

/** Berapa pelanggaran berat yang sudah terkumpul. */
export function jumlahBerat(hitungan: HitunganInsiden): number {
  let n = 0;
  for (const jenis of INSIDEN_BERAT) n += Math.max(0, Math.floor(hitungan[jenis] ?? 0));
  return n;
}

/**
 * Apakah ujiannya harus dikumpulkan paksa sekarang.
 *
 * Hanya bila modenya memang memintanya. Mode biasa dan ketat mencatat tanpa
 * pernah memutus: memutus ujian orang adalah tindakan yang tidak dapat
 * dibatalkan, dan hanya ujian sertifikasi yang aturannya memang begitu.
 */
export function harusDipaksa(mode: ModePengawasan, hitungan: HitunganInsiden): boolean {
  const batas = aturanMode(mode).batasPaksa;
  return batas > 0 && jumlahBerat(hitungan) >= batas;
}

/**
 * Peringatan yang dibacakan kepada peserta, beserta sisa kesempatannya.
 *
 * Sisa kesempatan ikut disebut dengan sengaja. Peringatan yang tidak
 * mengatakan "tinggal dua lagi" tidak mengubah perilaku siapa pun; yang
 * menyebutkannya membuat peserta berhenti sebelum terlambat — dan itu tujuan
 * seluruh penjagaan ini, bukan menangkap sebanyak-banyaknya.
 */
export function pesanPeringatan(
  mode: ModePengawasan,
  jenis: JenisInsiden,
  hitungan: HitunganInsiden,
): string {
  const dasar = `${INSIDEN_LABEL[jenis]} tercatat dan dilaporkan ke pengawas.`;
  const batas = aturanMode(mode).batasPaksa;
  if (batas <= 0 || !berat(jenis)) return dasar;
  const sisa = batas - jumlahBerat(hitungan);
  if (sisa <= 0) return `${dasar} Batas pelanggaran terlampaui — ujian dikumpulkan otomatis.`;
  return `${dasar} Sisa ${sisa} kali lagi sebelum ujian dikumpulkan otomatis.`;
}

// ------------------------------------------------------------
// TANDA AIR
// ------------------------------------------------------------

export type Peserta = { nama: string; nim: string; kode: string };

/**
 * Tulisan yang ditumpuk samar di atas layar ujian.
 *
 * Isinya dipilih supaya satu potongan tangkapan layar pun cukup untuk
 * menunjuk orangnya: nama dan nomornya menjawab "siapa", kode ujian menjawab "ujian
 * yang mana", dan jamnya menjawab "kapan" — yang membedakan bocoran saat ujian
 * berlangsung dari lembar yang memang dibagikan sesudahnya.
 */
export function tandaAir(peserta: Peserta, saat: Date = new Date()): string {
  const jam = saat.toLocaleString("id-ID", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const bagian = [peserta.nama, peserta.nim, peserta.kode, jam]
    .map((b) => String(b ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return bagian.join(" · ");
}
