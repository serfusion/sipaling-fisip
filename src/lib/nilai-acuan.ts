// ============================================================
// PENILAIAN ESAI DARI JAWABAN ACUAN DOSEN
//
// Rubrik menilai BENTUK jawaban: berapa panjang, berapa tersusun, berapa
// istilah soal yang muncul. Tidak satu pun di antaranya tahu apakah isinya
// benar, dan itulah batas yang tidak dapat dilewati rubrik betapa pun rapi
// deskriptornya disusun. Jawaban dua ratus kata yang melantur mendapat angka
// yang sama dengan jawaban dua ratus kata yang tepat.
//
// Berkas ini menempuh jalan yang lain: dosen menuliskan JAWABAN ACUAN, lalu
// jawaban peserta diukur kedekatannya dengan acuan itu. Yang diukur bukan lagi
// panjang, melainkan apakah yang dibicarakan peserta sama dengan yang
// dibicarakan dosen.
//
// ------------------------------------------------------------
// CARANYA: COSINE SIMILARITY ATAS BOBOT KATA TF-IDF
// ------------------------------------------------------------
//
// Tiap jawaban diubah menjadi vektor bobot kata, lalu diukur sudut di antara
// dua vektor. Nol berarti tidak ada satu kata berbobot pun yang sama; satu
// berarti kedua jawaban memakai kata yang sama dengan perbandingan yang sama.
//
// Bobot tiap kata dihitung TF-IDF:
//
//   bobot(kata) = (1 + log tf) x ( log((N + 1) / (df + 1)) + 1 )
//
//   tf = berapa kali kata itu muncul di dalam satu jawaban
//   df = berapa jawaban di seluruh kelas yang memuat kata itu
//   N  = jumlah jawaban yang dibandingkan, termasuk acuan dosen
//
// Bagian df itulah yang menentukan segalanya, dan tanpanya seluruh gagasan
// runtuh. Pertanyaan "jelaskan manfaat energi terbarukan" membuat kata
// "energi", "terbarukan", dan "manfaat" muncul di HAMPIR SETIAP lembar. Tanpa
// pembobotan, tiga puluh jawaban akan terlihat mirip dengan acuan hanya karena
// semuanya menjawab pertanyaan yang sama, dan yang menyalin pertanyaannya
// kembali akan bernilai setinggi yang benar-benar menguraikan.
//
// Dengan pembobotan, kata yang ada di semua lembar nyaris tidak berbobot, dan
// yang menentukan nilai adalah kata yang hanya muncul pada lembar yang
// benar-benar tahu jawabannya.
//
// Mesin hitungnya bukan mesin baru. hitungDf, bobotTfIdf, dan cosine dipakai
// apa adanya dari src/lib/mirip-jawaban.ts, tempat ketiganya sudah bekerja
// membandingkan peserta dengan peserta. Di sini ketiganya membandingkan
// peserta dengan acuan dosen. Satu mesin, dua kegunaan, dan yang kedua tidak
// menambah satu baris pun rumus yang harus dipercaya terpisah.
//
// ------------------------------------------------------------
// KENAPA NILAI PENUH TIDAK MENUNGGU KEMIRIPAN SERATUS PERSEN
// ------------------------------------------------------------
// Kemiripan satu hanya dicapai jawaban yang menyalin acuan kata demi kata.
// Menuntutnya berarti memberi nilai tertinggi kepada yang menghafal dan
// menghukum yang memahami lalu menuliskannya dengan kalimat sendiri, padahal
// yang kedua itulah yang sedang diuji.
//
// Karena itu ada dua ambang, dan keduanya dapat diatur dosen per acuan:
//
//   di bawah ambangNol    nilainya 0
//   di atas ambangPenuh   nilainya 100
//   di antaranya          naik lurus
//
// Bawaannya 15 dan 65. Angka 65 bukan tebakan: parafrase yang benar atas satu
// jawaban acuan lazimnya jatuh di kisaran 0,45 sampai 0,75 pada pembobotan
// ini, sedangkan jawaban yang membicarakan hal lain jarang melewati 0,25.
//
// ------------------------------------------------------------
// SATU HAL YANG TIDAK DIKERJAKAN BERKAS INI
// ------------------------------------------------------------
// Sama seperti rubrik, berkas ini tidak pernah memutuskan nilai akhir sendiri
// dan tidak menyimpan apa pun. Ia menghitung dan menyertakan alasannya;
// yang menandatangani tetap dosen. Kata yang membuat sebuah jawaban bernilai
// tinggi ikut dikembalikan supaya dosen dapat membaca dasar angkanya, bukan
// angkanya saja.
// ============================================================
import { bobotTfIdf, cosine, hitungDf, kataDari, sidikJawaban, type Sidik } from "@/lib/mirip-jawaban";
import { KATA_UMUM } from "@/lib/nilai-lokal";

/** Satu jawaban acuan untuk satu soal. */
export type ButirAcuan = {
  /** Nomor soal yang dijawab butir ini, mengikuti urutan bank soal. */
  nomor: number;
  /** Pertanyaannya, disalin sekadar untuk dibaca. Tidak ikut dinilai. */
  pertanyaan: string;
  /** Jawaban acuan dosen. Inilah yang dibandingkan. */
  jawaban: string;
  /** Bobot butir ini terhadap nilai akhir, persen. Jumlah seluruh butir 100. */
  bobot: number;
  /**
   * Kata atau istilah yang HARUS muncul, betapa pun tinggi kemiripannya.
   *
   * Ada jawaban yang tidak boleh dinilai benar tanpa menyebut satu istilah
   * tertentu, dan cosine tidak dapat menjamin itu: sebuah jawaban dapat
   * berdekatan dengan acuan lewat kata-kata di sekitarnya sambil melewatkan
   * istilah intinya. Daftar ini yang menjaganya.
   *
   * Kosong berarti tidak ada syarat, dan itu keadaan bawaannya.
   */
  wajib: string[];
};

export type Acuan = {
  nama: string;
  keterangan: string;
  /** Kemiripan persen yang di bawahnya bernilai nol. */
  ambangNol: number;
  /** Kemiripan persen yang di atasnya bernilai seratus. */
  ambangPenuh: number;
  butir: ButirAcuan[];
};

/** Batas wajar supaya satu acuan tetap dapat dipakai manusia. */
export const MAKS_BUTIR = 50;
export const MAKS_WAJIB = 12;

/** Ambang bawaan. Lihat keterangan panjang di kepala berkas. */
export const AMBANG_NOL_BAWAAN = 15;
export const AMBANG_PENUH_BAWAAN = 65;

/**
 * Jawaban yang lebih pendek dari ini tidak dinilai dengan cosine.
 *
 * Pada jawaban tiga kata, satu kata yang kebetulan sama sudah mengangkat
 * kemiripannya ke angka yang tinggi, dan satu kata yang kebetulan berbeda
 * menjatuhkannya ke nol. Keduanya bukan pembacaan, melainkan kebetulan.
 * Jawaban sependek itu ditandai untuk dibaca dosen, bukan dinilai mesin.
 */
export const MIN_KATA_ACUAN = 8;

// ------------------------------------------------------------
// PEMBACAAN DAN PEMERIKSAAN
// ------------------------------------------------------------

/**
 * Baca butir dari kolom JSON, tanpa pernah melempar galat.
 *
 * Alasannya sama persis dengan bacaKriteria di src/lib/rubrik.ts: acuan yang
 * JSON-nya rusak harus tetap TAMPIL supaya dosen dapat memperbaikinya.
 * Melempar galat di sini berarti panel penilaian menolak terbuka karena satu
 * baris cacat, dan yang kehilangan akses justru satu-satunya orang yang dapat
 * membetulkannya.
 */
export function bacaButir(json: string | null | undefined): ButirAcuan[] {
  try {
    const isi = JSON.parse(String(json || "[]"));
    if (!Array.isArray(isi)) return [];
    return isi.slice(0, MAKS_BUTIR).map(bersihkanButir).filter((b) => b.jawaban !== "");
  } catch {
    return [];
  }
}

/**
 * Jepit satu butir ke bentuk yang masuk akal.
 *
 * Dipakai pembaca JSON DAN jalur API, sehingga yang datang dari basis data dan
 * yang datang dari peramban melewati jepitan yang sama. Dua jepitan terpisah
 * berarti dua tempat yang dapat berbeda diam-diam.
 */
export function bersihkanButir(masukan: unknown): ButirAcuan {
  const baris = (masukan ?? {}) as Partial<ButirAcuan>;
  return {
    nomor: Math.max(0, Math.min(999, Math.round(Number(baris.nomor) || 0))),
    pertanyaan: String(baris.pertanyaan ?? "").trim().slice(0, 2000),
    // Empat ribu aksara sudah jauh melampaui jawaban acuan mana pun. Yang
    // dijaga batas ini bukan kerapian melainkan ongkos: acuan sepanjang satu
    // bab akan dibandingkan dengan tiap lembar di kelas, tiap kali dinilai.
    jawaban: String(baris.jawaban ?? "").trim().slice(0, 4000),
    bobot: Math.max(0, Math.min(100, Math.round(Number(baris.bobot) || 0))),
    wajib: (Array.isArray(baris.wajib) ? baris.wajib : [])
      .map((w) => String(w ?? "").trim().toLowerCase().slice(0, 60))
      .filter((w) => w !== "")
      .slice(0, MAKS_WAJIB),
  };
}

export type PeriksaAcuan = { ok: true } | { ok: false; pesan: string };

/**
 * Apakah satu acuan layak disimpan.
 *
 * Pemeriksaan yang sama dijalankan di layar DAN di server. Yang di layar
 * menjawab lebih cepat; yang di server yang menentukan, karena halaman dapat
 * diubah dari alat pengembang.
 */
export function periksaAcuan(a: Acuan): PeriksaAcuan {
  if (!a.nama.trim()) return { ok: false, pesan: "Nama acuan belum diisi." };
  if (a.butir.length === 0) return { ok: false, pesan: "Belum ada satu pun jawaban acuan." };
  if (a.butir.length > MAKS_BUTIR) {
    return { ok: false, pesan: `Jawaban acuan paling banyak ${MAKS_BUTIR} butir.` };
  }
  if (a.ambangNol >= a.ambangPenuh) {
    return { ok: false, pesan: "Ambang nilai penuh harus lebih tinggi daripada ambang nilai nol." };
  }

  const nomor = new Set<number>();
  for (const b of a.butir) {
    if (!b.jawaban.trim()) return { ok: false, pesan: `Butir nomor ${b.nomor} belum ada jawaban acuannya.` };
    if (kataDari(b.jawaban).length < MIN_KATA_ACUAN) {
      return {
        ok: false,
        pesan:
          `Jawaban acuan nomor ${b.nomor} hanya ${kataDari(b.jawaban).length} kata. ` +
          `Paling sedikit ${MIN_KATA_ACUAN} kata, supaya pembandingannya bukan kebetulan.`,
      };
    }
    if (nomor.has(b.nomor)) return { ok: false, pesan: `Nomor ${b.nomor} muncul dua kali.` };
    nomor.add(b.nomor);
  }

  const jumlah = a.butir.reduce((n, b) => n + b.bobot, 0);
  if (jumlah !== 100) return { ok: false, pesan: `Jumlah bobot ${jumlah}%, harus tepat 100%.` };
  return { ok: true };
}

/** Bagi rata seratus persen ke sejumlah butir, sisanya ke butir terakhir. */
export function ratakanBobotButir(jumlah: number): number[] {
  if (jumlah <= 0) return [];
  const dasar = Math.floor(100 / jumlah);
  const bobot = Array.from({ length: jumlah }, () => dasar);
  bobot[jumlah - 1] += 100 - dasar * jumlah;
  return bobot;
}

/** Acuan kosong, siap diisi dari layar. */
export function acuanKosong(): Acuan {
  return {
    nama: "",
    keterangan: "",
    ambangNol: AMBANG_NOL_BAWAAN,
    ambangPenuh: AMBANG_PENUH_BAWAAN,
    butir: [],
  };
}

// ------------------------------------------------------------
// PENILAIAN
// ------------------------------------------------------------

export type HasilButir = {
  nomor: number;
  bobot: number;
  /** Kemiripan dengan acuan, 0 sampai 100. */
  kemiripan: number;
  /** Nilai butir ini sesudah kurva dan syarat kata wajib, 0 sampai 100. */
  nilai: number;
  jumlahKata: number;
  wajibKena: number;
  wajibTotal: number;
  /** Kata berbobot tertinggi yang dipakai kedua jawaban. Dasar angkanya. */
  kataBersama: string[];
  /** Istilah wajib yang tidak muncul. Kosong bila semuanya ada. */
  wajibHilang: string[];
  /** Terlalu pendek untuk dibandingkan, jadi diserahkan kepada dosen. */
  perluDibaca: boolean;
  alasan: string;
};

export type HasilAcuan = {
  /** Nilai akhir 0 sampai 100, hasil penjumlahan terbobot tiap butir. */
  nilai: number;
  butir: HasilButir[];
  alasan: string;
};

/**
 * Ubah kemiripan menjadi nilai lewat dua ambang.
 *
 * Terpisah sebagai fungsi sendiri supaya dapat diuji tanpa menyiapkan korpus,
 * dan supaya ada satu tempat yang dapat ditunjuk ketika ada yang bertanya
 * "kemiripan 52% itu nilainya berapa".
 */
export function kurvaNilai(kemiripan: number, ambangNol: number, ambangPenuh: number): number {
  const bawah = Math.max(0, Math.min(99, ambangNol));
  const atas = Math.max(bawah + 1, Math.min(100, ambangPenuh));
  if (kemiripan <= bawah) return 0;
  if (kemiripan >= atas) return 100;
  return Math.round(((kemiripan - bawah) / (atas - bawah)) * 100);
}

/**
 * Berapa istilah wajib yang benar-benar muncul.
 *
 * Dicocokkan atas teks yang sudah dinormalkan, bukan atas teks asli, supaya
 * "Analisis SWOT" pada acuan tetap bertemu "analisis swot" pada jawaban.
 * Istilah yang terdiri lebih dari satu kata ikut tertangkap karena yang
 * dicari adalah potongan tali pada kalimat yang sudah berspasi tunggal.
 */
export function istilahWajibHilang(jawaban: string, wajib: string[]): string[] {
  if (wajib.length === 0) return [];
  const rata = ` ${kataDari(jawaban).join(" ")} `;
  return wajib.filter((w) => {
    const cari = kataDari(w).join(" ");
    return cari === "" ? false : !rata.includes(` ${cari} `);
  });
}

/**
 * Kata berbobot tertinggi yang dipakai kedua jawaban sekaligus.
 *
 * Ini menyusun ALASAN, bukan nilai. Kata sambung dan kata tanya dibuang di
 * sini dan hanya di sini: pada perhitungan cosine keduanya tetap ikut dengan
 * bobot kecilnya masing-masing, sebagaimana mestinya. Yang tidak boleh
 * terjadi adalah dosen membaca "kata penentu: dan, tidak, karena" lalu
 * menyimpulkan angkanya disusun dari kata sambung. Ia akan berhenti percaya
 * pada seluruh kolom itu, dan ia benar untuk berhenti percaya.
 *
 * Kata sepanjang dua huruf ikut dibuang. Pada teks Indonesia sisanya adalah
 * imbuhan lepas dan potongan singkatan, dan tidak satu pun di antaranya
 * menerangkan apa pun kepada yang membacanya.
 */
function kataBersamaTeratas(
  peserta: Map<string, number>,
  acuan: Map<string, number>,
  banyak = 6,
): string[] {
  const bersama: Array<[string, number]> = [];
  for (const [kata, bobot] of peserta) {
    if (kata.length <= 2 || KATA_UMUM.has(kata)) continue;
    const lawan = acuan.get(kata);
    // Perkalian kedua bobotnya, bukan salah satunya: yang pantas disebut
    // adalah kata yang berbobot pada KEDUA lembar, bukan kata yang kebetulan
    // diulang sepuluh kali oleh pesertanya sendiri.
    if (lawan !== undefined) bersama.push([kata, bobot * lawan]);
  }
  return bersama
    .sort((a, b) => b[1] - a[1])
    .slice(0, banyak)
    .map(([kata]) => kata);
}

/** Satu jawaban peserta yang hendak dinilai. */
export type JawabanPeserta = { attemptId: number; teks: string };

/**
 * Nilai SELURUH jawaban atas satu soal sekaligus.
 *
 * Sengaja tidak ada fungsi yang menilai satu peserta sendirian, dan itu bukan
 * kelalaian: df hanya berarti bila dihitung atas seluruh lembar yang
 * dibandingkan. Menilai satu peserta terpisah berarti menghitung df dari satu
 * dokumen, dan idf dari satu dokumen bernilai sama untuk setiap kata. Yang
 * tersisa dari TF-IDF adalah TF-nya saja, dan bersamanya hilang seluruh alasan
 * memakai TF-IDF sejak awal.
 *
 * Acuan dosen ikut masuk korpus sebagai satu dokumen. Ia memang salah satu
 * jawaban atas pertanyaan yang sama, dan mengeluarkannya membuat kata yang
 * hanya ada di acuan dan di satu lembar terlihat lebih langka daripada
 * sesungguhnya.
 */
export function nilaiSoal(
  jawaban: JawabanPeserta[],
  butir: ButirAcuan,
  ambangNol = AMBANG_NOL_BAWAAN,
  ambangPenuh = AMBANG_PENUH_BAWAAN,
): Map<number, HasilButir> {
  const hasil = new Map<number, HasilButir>();
  if (jawaban.length === 0) return hasil;

  // attemptId -1 dipakai acuan dosen. Nomor negatif tidak pernah menjadi id
  // baris sungguhan, jadi ia tidak dapat bertabrakan dengan peserta mana pun.
  const sidikAcuan = sidikJawaban(-1, butir.jawaban);
  const sidikPeserta = jawaban.map((j) => sidikJawaban(j.attemptId, j.teks));
  const semua: Sidik[] = [sidikAcuan, ...sidikPeserta];

  const df = hitungDf(semua);
  const jumlahDok = semua.length;
  const bobotAcuan = bobotTfIdf(sidikAcuan, df, jumlahDok);

  for (const s of sidikPeserta) {
    const teks = jawaban.find((j) => j.attemptId === s.attemptId)?.teks ?? "";
    const hilang = istilahWajibHilang(teks, butir.wajib);
    const wajibKena = butir.wajib.length - hilang.length;

    // Jawaban yang terlalu pendek tidak dinilai, melainkan diserahkan kepada
    // dosen. Angka yang dihitung dari lima kata bukan pembacaan.
    if (s.jumlahKata < MIN_KATA_ACUAN) {
      hasil.set(s.attemptId, {
        nomor: butir.nomor,
        bobot: butir.bobot,
        kemiripan: 0,
        nilai: 0,
        jumlahKata: s.jumlahKata,
        wajibKena,
        wajibTotal: butir.wajib.length,
        kataBersama: [],
        wajibHilang: hilang,
        perluDibaca: true,
        alasan:
          s.jumlahKata === 0
            ? "Tidak dijawab."
            : `Hanya ${s.jumlahKata} kata, terlalu pendek untuk dibandingkan dengan acuan. Mohon dibaca dosen.`,
      });
      continue;
    }

    const bobotPeserta = bobotTfIdf(s, df, jumlahDok);
    const kemiripan = Math.round(cosine(bobotPeserta, bobotAcuan) * 100);
    const dasar = kurvaNilai(kemiripan, ambangNol, ambangPenuh);

    // Istilah wajib yang hilang memotong nilai menurut bagiannya yang muncul,
    // bukan menjatuhkannya ke nol. Dari tiga istilah yang diminta, peserta
    // yang menyebut dua di antaranya memang tidak lengkap, tetapi ia jelas
    // bukan peserta yang tidak menyebut satu pun.
    const bagianWajib = butir.wajib.length === 0 ? 1 : wajibKena / butir.wajib.length;
    const nilai = Math.round(dasar * bagianWajib);

    const bersama = kataBersamaTeratas(bobotPeserta, bobotAcuan);
    const potongan: string[] = [`${kemiripan}% mirip acuan`, `${s.jumlahKata} kata`];
    if (butir.wajib.length > 0) potongan.push(`${wajibKena} dari ${butir.wajib.length} istilah wajib`);
    if (hilang.length > 0) potongan.push(`belum menyebut: ${hilang.join(", ")}`);
    if (bersama.length > 0) potongan.push(`kata penentu: ${bersama.join(", ")}`);

    hasil.set(s.attemptId, {
      nomor: butir.nomor,
      bobot: butir.bobot,
      kemiripan,
      nilai,
      jumlahKata: s.jumlahKata,
      wajibKena,
      wajibTotal: butir.wajib.length,
      kataBersama: bersama,
      wajibHilang: hilang,
      perluDibaca: false,
      alasan: potongan.join(" · "),
    });
  }

  return hasil;
}

/**
 * Gabungkan hasil tiap butir menjadi satu nilai akhir 0 sampai 100.
 *
 * Bobot yang dipakai adalah bobot butir yang BENAR-BENAR dinilai, bukan
 * seratus persen apa adanya. Soal yang butirnya tidak ada di acuan tidak boleh
 * diam-diam menjadi nol bagi seluruh peserta: yang terjadi bukan peserta gagal
 * menjawabnya melainkan dosen belum menuliskan acuannya.
 */
export function gabungButir(butir: HasilButir[]): HasilAcuan {
  const terpakai = butir.filter((b) => !b.perluDibaca);
  const bobotTerpakai = terpakai.reduce((n, b) => n + b.bobot, 0);

  if (terpakai.length === 0 || bobotTerpakai === 0) {
    return {
      nilai: 0,
      butir,
      alasan:
        butir.length === 0
          ? "Belum ada butir acuan yang cocok dengan soal ujian ini."
          : "Seluruh jawaban terlalu pendek untuk dibandingkan. Mohon dibaca dosen.",
    };
  }

  const terbobot = terpakai.reduce((n, b) => n + b.nilai * b.bobot, 0);
  const nilai = Math.round(terbobot / bobotTerpakai);
  const belum = butir.length - terpakai.length;

  const potongan = [`${terpakai.length} butir dinilai`, `bobot terpakai ${bobotTerpakai}%`];
  if (belum > 0) potongan.push(`${belum} butir diserahkan kepada dosen`);
  return { nilai, butir, alasan: potongan.join(" · ") };
}
