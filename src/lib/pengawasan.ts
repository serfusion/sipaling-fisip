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
//   4. MENGAKHIRI   — dan inilah yang sebenarnya bergigi. Halaman tidak dapat
//      menahan tangan peserta, tetapi ujiannya ADA DI SINI, dan yang ada di
//      sini dapat ditutup. Lima kali perbuatan yang menuntut tangan, dan
//      ujiannya dikumpulkan paksa oleh server — bukan oleh halaman yang dapat
//      dimatikan peserta.
//      Angka lima itu TIDAK PERNAH dikatakan kepada pesertanya. Teguran yang
//      muncul menyebut sudah berapa kali ia melanggar, tidak pernah tinggal
//      berapa kali lagi, sehingga tidak ada jatah yang dapat dihabiskan
//      dengan tenang sampai satu ketukan sebelum batasnya.
//
// Nomor tiga dan empat yang sebenarnya bekerja pada ujian sertifikasi.
// Pencegahan yang berhasil bukan yang menutup rapat, melainkan yang membuat
// perbuatannya tidak sepadan dengan risikonya.
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
  biasa: "Kuis dan latihan. Hanya mencatat.",
  ketat: "UTS dan UAS. Layar penuh, salin-tempel mati, tanda air. Berhenti otomatis di pelanggaran kelima.",
  sertifikasi: "Sertifikasi dan OSCE. Mode Ketat plus kamera pengawas. Berhenti otomatis di pelanggaran kelima.",
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
      // LIMA, dan angkanya TIDAK PERNAH dikatakan kepada peserta. Lihat
      // pesanPeringatan di bawah — teguran yang muncul menyebut sudah berapa
      // kali, bukan tinggal berapa kali lagi, dan itu bukan kelalaian
      // melainkan seluruh maksudnya.
      //
      // Yang membuat lima tetap adil bukan angkanya melainkan daftar
      // INSIDEN_BERAT di bawah: blur, klik kanan, wajah hilang, dan orang lain
      // TIDAK ikut menghitung. Yang lima kali itu semuanya perbuatan yang
      // menuntut tangan — menekan PrintScreen, menekan F12, berpindah tab,
      // menempel ke kolom jawaban, menutup lensa kamera. Notifikasi sistem
      // yang muncul sendiri merebut fokus dan hanya menghasilkan `blur`, dan
      // blur tidak pernah membawa siapa pun satu langkah pun lebih dekat ke
      // sini.
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
      // Sama dengan Sertifikasi: lima, dan sama-sama tidak pernah disebutkan
      // kepada peserta. Yang membedakan kedua mode ini bukan ambangnya
      // melainkan apa yang diawasi — kamera, layar kedua, dan alat pengembang
      // hanya ada di mode di atas.
      batasPaksa: 5, peringatanLayar: true,
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
  // Klik kanan dan menyalin ikut menghitung mundur. Keduanya dicegah, jadi
  // yang tercatat bukan perbuatan yang berhasil melainkan percobaan yang
  // diulang, dan mengulangnya lima kali bukan kebiasaan tangan.
  "klik_kanan", "salin",
  // Menutup lensa, membekukan gambar, dan mematikan kamera ikut, karena
  // ketiganya menghapus pengawasannya sendiri. Dibiarkan berulang, sisa
  // penjagaan tidak ada artinya.
  "kamera_tertutup", "kamera_beku", "kamera_mati",
  // "blur" sengaja TIDAK ikut: satu notifikasi sistem yang muncul sendiri
  // sudah merebut fokus, dan itu di luar kuasa peserta.
  //
  // "wajah_hilang" dan "orang_lain" juga tidak. Yang pertama terlalu sering
  // terjadi tanpa maksud; yang kedua datang dari pembacaan model, dan
  // menghentikan ujian orang atas dasar tebakan model, tanpa seorang pun
  // melihat gambarnya lebih dulu, adalah hal yang tidak boleh dilakukan
  // sistem ini. Keduanya tetap dicatat dan tetap menurunkan skor; yang
  // memutuskan penguji.
];

export function berat(jenis: JenisInsiden) {
  return INSIDEN_BERAT.includes(jenis);
}

/**
 * Insiden yang SELALU ikut lahir ketika ujiannya ditutup, dan karena itu tidak
 * boleh dicatat atas nama peserta selama detik-detik penutupan.
 *
 * Dua saja, dan keduanya perbuatan halaman, bukan perbuatan orang:
 *
 *   - "fullscreen" — layar penuhnya memang dilepas halaman ujian begitu
 *     jawabannya terkumpul, supaya pesertanya tidak tertinggal terkunci di
 *     layar penuh berisi halaman hasil;
 *   - "blur" — fokusnya berpindah ke layar hasil pada saat yang sama.
 *
 * Keluhan yang melahirkan fungsi ini datang dari peserta sungguhan: "baru mau
 * mengakhiri ujian, malah kena pelanggaran keluar dari layar." Sebab
 * langsungnya kotak window.confirm() yang di Chrome melepas layar penuh
 * sebelum ia digambar — itu sudah diganti kotak yang digambar halaman sendiri
 * (src/app/cbt/ujian/pastikan.tsx) — dan fungsi ini penjaga lapis keduanya,
 * untuk peristiwa penutupan yang tetap datang sesudahnya.
 *
 * Yang TIDAK ada di sini, dan tidak boleh ditambahkan: berpindah tab,
 * tangkapan layar, tempel, alat pengembang. Tak satu pun dilakukan halaman ini
 * atas nama siapa pun, jadi yang tercatat selama pengiriman tetap perbuatan
 * orangnya — juga pada detik terakhir sebuah ujian.
 */
export function milikPengakhiran(jenis: JenisInsiden): boolean {
  return jenis === "fullscreen" || jenis === "blur";
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
 * Hanya bila modenya memang memintanya, dan ambangnya berbeda menurut
 * taruhannya: TIGA pada Sertifikasi/OSCE, lima pada Ketat, dan TIDAK PERNAH
 * pada Biasa — kuis harian tidak boleh berakhir sendiri karena pesertanya
 * berpindah tab tiga kali.
 *
 * Memutus ujian orang adalah tindakan yang tidak dapat dibatalkan, dan yang
 * menjaganya tetap adil bukan ambangnya melainkan INSIDEN_BERAT: yang
 * menghitung mundur hanya perbuatan yang menuntut tangan.
 */
export function harusDipaksa(mode: ModePengawasan, hitungan: HitunganInsiden): boolean {
  const batas = aturanMode(mode).batasPaksa;
  return batas > 0 && jumlahBerat(hitungan) >= batas;
}

/**
 * Teguran yang dibacakan kepada peserta.
 *
 * Ia menyebut SUDAH BERAPA KALI, tidak pernah TINGGAL BERAPA KALI LAGI, dan
 * pergantian itu disengaja.
 *
 * Peringatan yang mengatakan "sisa dua lagi" memberi tahu peserta persis
 * berapa banyak yang masih boleh ia lakukan. Yang terjadi berikutnya dapat
 * ditebak: ia menghabiskan jatahnya dengan tenang dan berhenti satu ketukan
 * sebelum batasnya, dan seluruh penjagaan berubah menjadi anggaran yang
 * dibelanjakan. Angka yang tidak diketahui tidak dapat dianggarkan — yang
 * tersisa baginya hanya berhenti.
 *
 * Yang tetap dikatakan apa adanya: perbuatannya, jumlahnya sampai sekarang,
 * dan bahwa ujiannya dapat berakhir tanpa peringatan lagi. Ancaman yang
 * kabur bukan alasan untuk menjadi ancaman yang tidak jujur.
 */
export function pesanPeringatan(
  mode: ModePengawasan,
  jenis: JenisInsiden,
  hitungan: HitunganInsiden,
): string {
  const dasar = `${INSIDEN_LABEL[jenis]} tercatat dan dilaporkan ke pengawas.`;
  const batas = aturanMode(mode).batasPaksa;
  if (batas <= 0 || !berat(jenis)) return dasar;
  const nomor = jumlahBerat(hitungan);
  if (nomor >= batas) {
    return `${dasar} Batas pelanggaran terlampaui. Ujian dikumpulkan otomatis.`;
  }
  return (
    `${dasar} Ini pelanggaran berat ke-${nomor} kamu pada ujian ini. ` +
    "Ujian dapat dihentikan dan dikumpulkan otomatis tanpa peringatan lagi."
  );
}

// ------------------------------------------------------------
// TEGURAN DI LAYAR
// ------------------------------------------------------------

/**
 * Isi kotak teguran yang menutup soal ketika peserta melanggar.
 *
 * Bentuknya kotak yang harus diakui, bukan pita yang menghilang sendiri, dan
 * itu keputusan yang disengaja: pita di tepi layar berhenti dibaca pada
 * pelanggaran kedua, sedangkan kotak yang menutup soal dan menuntut satu
 * ketukan tidak dapat diabaikan. Ia juga menutup soalnya selama terbuka —
 * pada percobaan tangkapan layar, itu bukan efek samping.
 *
 * DUA hal saja yang ada di dalamnya, dan dua yang sengaja tidak:
 *
 *   ADA    - perbuatannya, disebut apa adanya.
 *   ADA    - pelanggaran ke berapa. Angka yang naik terus, tanpa ujung yang
 *            terlihat, adalah yang membuat orang berhenti.
 *   TIDAK  - berapa batasnya. Peserta yang tahu batasnya membelanjakan
 *            jatahnya sampai satu ketukan sebelum habis; yang tidak tahu
 *            tidak punya jatah untuk dibelanjakan.
 *   TIDAK  - kalimat penjelas apa pun. Kotak ini muncul di tengah ujian pada
 *            orang yang sedang panik, dan dua baris yang harus dibaca lebih
 *            dulu justru membuat angkanya terlewat. Yang menghentikan tangan
 *            orang adalah nomor yang naik, bukan paragraf di bawahnya.
 */
export type Teguran = { judul: string; sebab: string };

/**
 * Kalimat "Terdeteksi ..." di kepala kotak teguran.
 *
 * Terpisah dari INSIDEN_LABEL karena keduanya menjawab pertanyaan yang
 * berbeda. INSIDEN_LABEL menamai baris di lembar pengawasan yang dibaca
 * penguji; yang di bawah ini dibaca peserta pada saat ia baru saja berbuat,
 * dan harus berbunyi seperti sesuatu yang menangkapnya.
 */
export const INSIDEN_TEGUR: Record<JenisInsiden, string> = {
  tangkap: "Terdeteksi percobaan tangkapan layar",
  tab: "Terdeteksi membuka tab atau aplikasi lain",
  klik_kanan: "Terdeteksi klik kanan",
  salin: "Terdeteksi menyalin naskah soal",
  tempel: "Terdeteksi menempel ke kolom jawaban",
  devtools: "Terdeteksi membuka alat pengembang",
  fullscreen: "Terdeteksi keluar dari layar penuh",
  layar_kedua: "Terdeteksi layar kedua",
  blur: "Terdeteksi berpindah dari layar ujian",
  kamera_mati: "Terdeteksi kamera dimatikan",
  kamera_tertutup: "Terdeteksi lensa kamera tertutup",
  kamera_beku: "Terdeteksi gambar kamera tidak berubah",
  wajah_hilang: "Terdeteksi tidak ada orang di depan kamera",
  orang_lain: "Terdeteksi orang lain di depan kamera",
};

export function pesanTeguran(jenis: JenisInsiden, nomor: number): Teguran {
  return {
    judul: nomor > 0 ? `Pelanggaran ke-${nomor}` : "Pelanggaran tercatat",
    sebab: INSIDEN_TEGUR[jenis],
  };
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
