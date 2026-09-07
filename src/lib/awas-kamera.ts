// ============================================================
// PEMERIKSAAN CUPLIKAN KAMERA — YANG MURAH DULU
//
// Berkas ini menjawab satu pertanyaan: cuplikan mana yang PERLU dilihat model,
// dan mana yang sudah dapat diputuskan tanpa model sama sekali.
//
// Pertanyaannya soal uang. Satu ujian sertifikasi empat puluh peserta selama
// sembilan puluh menit, dengan cuplikan tiap dua puluh detik, menghasilkan
// sepuluh ribu gambar. Mengirim semuanya ke model bukan hanya mahal — ia juga
// tidak perlu, karena sebagian besar keadaan yang benar-benar hendak dicegah
// terbaca dari angka mentah gambarnya:
//
//   LENSA TERTUTUP   seluruh gambarnya gelap merata. Selotip di atas kamera
//                    laptop adalah cara paling tua dan paling sering dipakai
//                    untuk mematikan pengawasan.
//   GAMBAR BEKU      dua cuplikan berjarak dua puluh detik yang identik piksel
//                    demi piksel. Manusia hidup selalu bergerak sedikit; yang
//                    tidak bergerak sama sekali adalah foto yang dipasang di
//                    depan lensa, atau aliran video yang diputar ulang.
//
// Keduanya dikenali di sini, di perangkat pesertanya, tanpa satu pun panggilan
// model dan tanpa satu byte gambar meninggalkan perangkatnya.
//
// Yang TIDAK dapat dijawab di sini adalah pertanyaan yang sebenarnya menarik:
// berapa orang di depan layar, dan apa yang dipegangnya. Itu menuntut model,
// dan untuk itulah jatah yang kecil dan berbatas ada.
//
// SATU ATURAN YANG BERLAKU DI SELURUH BERKAS INI: yang ragu memilih diam.
// Ambang di bawah sengaja dipasang longgar, karena tuduhan palsu pada ujian
// sertifikasi merugikan orang yang tidak berbuat apa-apa, dan ia tidak punya
// cara membuktikan dirinya.
// ============================================================

/** Ringkasan satu cuplikan, dihitung dari pikselnya. */
export type CiriCuplikan = {
  /** Rata-rata terang 0–255. */
  terang: number;
  /** Sebaran terang. Gambar gelap merata bernilai hampir nol. */
  ragam: number;
  /** Beda rata-rata terhadap cuplikan sebelumnya, 0–255. null = belum ada. */
  beda: number | null;
};

/**
 * Ambang gelap.
 *
 * Ruangan remang-remang pada malam hari masih berada jauh di atas angka ini.
 * Yang di bawahnya praktis hitam — lensa tertutup, atau kamera menghadap meja.
 */
export const AMBANG_GELAP = 18;

/**
 * Ambang keseragaman.
 *
 * Gelap saja tidak cukup: ruangan gelap dengan wajah yang disorot layar tetap
 * punya sebaran. Yang gelap DAN rata adalah permukaan yang menempel di lensa.
 */
export const AMBANG_RAGAM = 6;

/**
 * Ambang gerak.
 *
 * Nol tidak dipakai. Sensor kamera selalu menghasilkan derau kecil, jadi dua
 * cuplikan berturut-turut tidak pernah benar-benar identik; ambang di atas nol
 * inilah yang membedakan "tidak bergerak" dari "sama persis".
 */
export const AMBANG_BEKU = 0.6;

/** Berapa cuplikan berturut-turut yang harus beku sebelum dilaporkan. */
export const BEKU_BERTURUT = 3;

export type PutusanCuplikan =
  | { tindakan: "abaikan" }
  | { tindakan: "catat"; jenis: "kamera_tertutup" | "kamera_beku"; alasan: string }
  | { tindakan: "periksa"; alasan: string };

/**
 * Apa yang harus dilakukan terhadap satu cuplikan.
 *
 * Tiga kemungkinan, dan urutannya menentukan biaya:
 *
 *   catat    — sudah pasti bermasalah, tanpa model. Gratis.
 *   periksa  — meragukan; kirim ke model bila jatahnya masih ada.
 *   abaikan  — wajar. Cuplikannya dibuang di tempat, tidak dikirim ke mana pun.
 *
 * `wajahTerbaca` datang dari FaceDetector peramban bila ada. Ia TIDAK ada di
 * sebagian besar peramban, dan nilainya null berarti "tidak tahu" — yang
 * ditangani sebagai tidak tahu, bukan sebagai tidak ada wajah.
 */
export function putuskanCuplikan(
  ciri: CiriCuplikan,
  bekuBerturut: number,
  wajahTerbaca: number | null,
  /** Cuplikan berkala yang memang dijadwalkan diperiksa model. */
  jadwalnya = false,
): PutusanCuplikan {
  // 1. Lensa tertutup. Gelap DAN rata — dua syarat, karena masing-masing
  //    sendirian terlalu sering benar pada ruangan yang memang gelap.
  if (ciri.terang < AMBANG_GELAP && ciri.ragam < AMBANG_RAGAM) {
    return {
      tindakan: "catat",
      jenis: "kamera_tertutup",
      alasan: `gambar gelap merata (terang ${ciri.terang.toFixed(0)}, ragam ${ciri.ragam.toFixed(1)})`,
    };
  }

  // 2. Gambar beku. Menuntut BEBERAPA cuplikan berturut-turut, bukan satu:
  //    satu cuplikan yang kebetulan sama dapat terjadi karena aliran videonya
  //    tersendat sesaat, dan itu bukan kecurangan siapa pun.
  if (bekuBerturut >= BEKU_BERTURUT) {
    return {
      tindakan: "catat",
      jenis: "kamera_beku",
      alasan: `gambar tidak berubah pada ${bekuBerturut} cuplikan berturut-turut`,
    };
  }

  // 3. Peramban yang punya FaceDetector sudah menjawab sebagian pertanyaannya.
  //    Yang menarik justru "lebih dari satu", bukan "tidak ada" — tidak ada
  //    wajah terlalu sering berarti peserta sedang menunduk membaca soal.
  if (wajahTerbaca !== null && wajahTerbaca > 1) {
    return { tindakan: "periksa", alasan: `terbaca ${wajahTerbaca} wajah di perangkat` };
  }
  if (wajahTerbaca === 0) {
    return { tindakan: "periksa", alasan: "tidak ada wajah terbaca di perangkat" };
  }

  // 4. Pemeriksaan berkala. Peserta yang duduk rapi sepanjang ujian tetap
  //    harus sesekali dilihat: seluruh pemeriksaan murah di atas tidak dapat
  //    melihat orang kedua yang duduk diam di sebelahnya.
  if (jadwalnya) return { tindakan: "periksa", alasan: "pemeriksaan berkala" };

  return { tindakan: "abaikan" };
}

/**
 * Ciri satu cuplikan dari piksel RGBA mentah.
 *
 * Dihitung dengan loncatan, bukan piksel demi piksel. Gambar 320×240 berisi
 * 76.800 piksel, dan ini berjalan tiap dua puluh detik di ponsel yang sedang
 * dipakai mengerjakan ujian — mengambil setiap piksel keenam belas
 * menghasilkan angka yang sama untuk keperluan ini dengan biaya jauh lebih
 * ringan.
 */
export function ciriCuplikan(
  piksel: Uint8ClampedArray,
  sebelumnya: Uint8ClampedArray | null,
  loncat = 16,
): CiriCuplikan {
  const langkah = Math.max(4, Math.floor(loncat) * 4);
  let jumlah = 0;
  let n = 0;
  const terangnya: number[] = [];

  for (let i = 0; i < piksel.length; i += langkah) {
    // Terang menurut bobot mata: hijau paling terasa, biru paling tidak.
    const t = 0.299 * piksel[i] + 0.587 * piksel[i + 1] + 0.114 * piksel[i + 2];
    terangnya.push(t);
    jumlah += t;
    n += 1;
  }
  if (n === 0) return { terang: 0, ragam: 0, beda: null };

  const rata = jumlah / n;
  let kuadrat = 0;
  for (const t of terangnya) kuadrat += (t - rata) * (t - rata);
  const ragam = Math.sqrt(kuadrat / n);

  let beda: number | null = null;
  if (sebelumnya && sebelumnya.length === piksel.length) {
    let selisih = 0;
    let m = 0;
    for (let i = 0; i < piksel.length; i += langkah) {
      const a = 0.299 * piksel[i] + 0.587 * piksel[i + 1] + 0.114 * piksel[i + 2];
      const b = 0.299 * sebelumnya[i] + 0.587 * sebelumnya[i + 1] + 0.114 * sebelumnya[i + 2];
      selisih += Math.abs(a - b);
      m += 1;
    }
    beda = m === 0 ? null : selisih / m;
  }

  return { terang: rata, ragam, beda };
}

/** Apakah cuplikan ini tidak berubah dari yang sebelumnya. */
export function beku(ciri: CiriCuplikan): boolean {
  return ciri.beda !== null && ciri.beda < AMBANG_BEKU;
}

// ------------------------------------------------------------
// PEMBACAAN MODEL
// ------------------------------------------------------------

/** Bentuk jawaban yang diminta dari model. Ditegakkan skema, bukan diminta. */
export type BacaanModel = {
  /** Berapa orang terlihat. -1 berarti model tidak dapat memastikan. */
  orang: number;
  /** Wajah tertutup masker/topi sampai tidak dapat dicocokkan. */
  tertutup: boolean;
  /** Ponsel, tablet, atau layar lain terlihat dalam bingkai. */
  perangkatLain: boolean;
  /** Keterangan satu kalimat, bahasa Indonesia, untuk dibaca penguji. */
  catatan: string;
};

export const SKEMA_BACAAN = {
  type: "object",
  additionalProperties: false,
  required: ["orang", "tertutup", "perangkatLain", "catatan"],
  properties: {
    orang: { type: "integer", minimum: -1, maximum: 20 },
    tertutup: { type: "boolean" },
    perangkatLain: { type: "boolean" },
    catatan: { type: "string", maxLength: 180 },
  },
} as const;

export type PutusanBacaan = { jenis: "wajah_hilang" | "orang_lain"; catatan: string } | null;

/**
 * Ubah bacaan model menjadi insiden — atau menjadi tidak ada sama sekali.
 *
 * Di sinilah kehati-hatian yang disebut di kepala berkas ini benar-benar
 * dijalankan, dan ia berarti membuang sebagian kemampuan model dengan sengaja:
 *
 *   orang = -1  model tidak yakin. TIDAK dilaporkan. Ketidakyakinan model
 *               bukan bukti apa pun, dan mencatatnya sebagai insiden berarti
 *               menghukum peserta atas keterbatasan alatnya.
 *   orang = 0   dilaporkan ringan. Peserta menunduk membaca soal menghasilkan
 *               pembacaan yang sama persis.
 *   orang > 1   dilaporkan. Inilah yang benar-benar dicari.
 *
 * `perangkatLain` sengaja TIDAK menghasilkan insidennya sendiri. Yang terlihat
 * sebagai ponsel di sudut meja sering kali kalkulator yang memang diizinkan,
 * botol minum, atau bingkai foto — dan sistem yang menuduh peserta memegang
 * ponsel padahal itu gelas akan berhenti dipercaya pada hari pertama. Ia ikut
 * dalam catatan supaya penguji melihatnya sendiri di gambarnya.
 */
export function bacaanKeInsiden(bacaan: BacaanModel): PutusanBacaan {
  const tambahan = bacaan.perangkatLain ? " Terlihat perangkat lain dalam bingkai." : "";
  const catatan = `${String(bacaan.catatan || "").slice(0, 180)}${tambahan}`.trim();

  if (bacaan.orang < 0) return null;
  if (bacaan.orang > 1) return { jenis: "orang_lain", catatan };
  if (bacaan.orang === 0) return { jenis: "wajah_hilang", catatan };
  return null;
}
