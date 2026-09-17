// ============================================================
// KEMIRIPAN JAWABAN ANTARPESERTA
//
// Membandingkan jawaban satu peserta dengan jawaban peserta lain pada SOAL
// YANG SAMA di ujian yang sama. Bukan dengan internet, bukan dengan korpus
// mana pun — hanya dengan teman sekelasnya, yang memang satu-satunya
// perbandingan yang masuk akal untuk soal esai buatan dosennya sendiri.
//
// ------------------------------------------------------------
// APA YANG DIKATAKAN ANGKA INI, DAN APA YANG TIDAK
// ------------------------------------------------------------
// Kemiripan BUKAN bukti menyontek, dan berkas ini tidak pernah menyebutnya
// begitu. Dua mahasiswa yang belajar dari catatan kuliah yang sama akan
// menjawab dengan kalimat yang mirip, dan itu justru tanda keduanya hadir.
// Yang dihasilkan di sini adalah urutan: lembar mana yang layak dibaca dosen
// lebih dulu. Keputusannya tetap pada manusia yang membacanya.
//
// Karena itu pula seluruh label di sini berbunyi "perlu ditinjau", bukan
// "terbukti". Perbedaan kata itu adalah perbedaan antara alat bantu dan
// tuduhan yang dikeluarkan mesin.
//
// ------------------------------------------------------------
// EMPAT SINYAL, DAN KENAPA TIDAK CUKUP SATU
// ------------------------------------------------------------
//
//   1. KATA BERSAMA (cosine atas TF-IDF). Menangkap jawaban yang isinya sama.
//      Sendirian ia menuduh dua orang yang memakai istilah teknis yang sama —
//      padahal istilah itu memang satu-satunya yang benar.
//   2. URUTAN KATA (Jaccard atas 4-gram). Menangkap kalimat yang disalin utuh.
//      Inilah sinyal yang paling sulit terjadi secara kebetulan: dua orang
//      dapat memakai kata yang sama, tetapi tidak dalam urutan yang sama
//      sepanjang empat kata berturut-turut, berkali-kali.
//   3. FRASA LANGKA BERSAMA. Frasa yang hanya muncul pada dua lembar dan tidak
//      pada yang lain. Kalimat khas yang dibagikan lewat pesan singkat
//      meninggalkan jejak persis seperti ini.
//   4. POLA PENULISAN. Panjang yang hampir sama, jumlah kalimat yang sama,
//      salah ketik yang sama. Yang terakhir itu yang paling berbicara: dua
//      orang boleh berpikir sama, tetapi tidak salah mengetik dengan cara yang
//      sama.
//
// Kemiripan semantik lewat embedding sengaja TIDAK dipakai. Ia menuntut
// layanan vektor tersendiri beserta biayanya, sementara sinyal 2 dan 3 sudah
// menangkap perkara yang sebenarnya dicari — jawaban yang berpindah tangan.
// Jawaban yang benar-benar ditulis ulang dengan kata sendiri memang SEHARUSNYA
// lolos: itu namanya belajar.
//
// Seluruh berkas ini murni dan berjalan di server tanpa satu pun panggilan
// model, sehingga pemeriksaannya tidak menunda pengumpulan dan tidak berbiaya.
// ============================================================

/** Jawaban sependek ini tidak dibandingkan sama sekali. */
export const MIN_KATA = 12;

/** Panjang n-gram untuk sidik urutan kata. */
const N_GRAM = 4;

/** Frasa dianggap langka bila muncul pada tidak lebih dari sekian lembar. */
const BATAS_LANGKA = 2;
const PANJANG_FRASA = 6;

export type StatusMirip = "bersih" | "rendah" | "tinjau" | "tinggi";

export const STATUS_MIRIP_LABEL: Record<StatusMirip, string> = {
  bersih: "Bersih",
  rendah: "Kemiripan rendah",
  tinjau: "Perlu ditinjau",
  tinggi: "Kemiripan tinggi",
};

/**
 * Warna lencana tiap status.
 *
 * Ada di sini, bukan di panelnya, karena status yang sama muncul di papan
 * pantau, di lembar per peserta, dan di laporan cetak. Tiga tempat yang
 * memilih warnanya sendiri pada akhirnya akan mewarnai keadaan yang sama
 * dengan tiga warna berbeda — pada dokumen yang justru dibaca ketika hasil
 * ujian dipersoalkan.
 */
export const STATUS_MIRIP_WARNA: Record<StatusMirip, string> = {
  bersih: "#15803d",
  rendah: "#65a30d",
  tinjau: "#b45309",
  tinggi: "#b91c1c",
};

export type Ambang = { tinjau: number; tinggi: number };

export const AMBANG_BAWAAN: Ambang = { tinjau: 30, tinggi: 60 };

/**
 * Ambang yang sudah dibersihkan.
 *
 * Dosen boleh menyetelnya per ujian, dan setelan yang terbalik — "tinjau" di
 * atas "tinggi" — harus tetap menghasilkan urutan yang masuk akal, bukan
 * membuat seluruh jawaban berstatus tinggi atau tak satu pun.
 */
export function rapikanAmbang(masukan: Partial<Ambang> | null | undefined): Ambang {
  const tinjau = Math.max(1, Math.min(99, Math.round(Number(masukan?.tinjau) || AMBANG_BAWAAN.tinjau)));
  const tinggi = Math.max(1, Math.min(100, Math.round(Number(masukan?.tinggi) || AMBANG_BAWAAN.tinggi)));
  return tinggi <= tinjau ? { tinjau, tinggi: Math.min(100, tinjau + 10) } : { tinjau, tinggi };
}

export function statusMirip(skor: number, ambang: Ambang = AMBANG_BAWAAN): StatusMirip {
  const a = rapikanAmbang(ambang);
  if (skor >= a.tinggi) return "tinggi";
  if (skor >= a.tinjau) return "tinjau";
  // Di bawah separuh ambang tinjau, kemiripannya memang tidak berarti apa-apa.
  // Membedakan "rendah" dari "bersih" tetap berguna: dosen yang membandingkan
  // dua kelas dapat melihat mana yang seluruhnya nol dan mana yang merambat.
  if (skor >= Math.round(a.tinjau / 2)) return "rendah";
  return "bersih";
}

// ------------------------------------------------------------
// NORMALISASI
// ------------------------------------------------------------

/**
 * Teks jawaban yang sudah diseragamkan.
 *
 * Huruf kecil, tanpa tanda baca, spasi tunggal. Yang sengaja TIDAK dikerjakan:
 * pembuangan kata umum (stopword) dan pemotongan imbuhan. Keduanya lazim pada
 * pengolahan teks dan keduanya merugikan di sini — justru kata sambung dan
 * imbuhan yang dipilih penulis membuat dua kalimat yang bermakna sama menjadi
 * dua kalimat yang berbeda. Membuangnya berarti membuang pembedanya.
 */
export function normalkan(teks: string): string {
  return String(teks ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function kataDari(teks: string): string[] {
  const bersih = normalkan(teks);
  return bersih ? bersih.split(" ") : [];
}

export function ngram(kata: string[], n = N_GRAM): string[] {
  if (kata.length < n) return [];
  const hasil: string[] = [];
  for (let i = 0; i <= kata.length - n; i += 1) hasil.push(kata.slice(i, i + n).join(" "));
  return hasil;
}

// ------------------------------------------------------------
// SIDIK SATU JAWABAN
// ------------------------------------------------------------

export type Sidik = {
  attemptId: number;
  kata: string[];
  /** Berapa kali tiap kata muncul. */
  hitung: Map<string, number>;
  /** Himpunan n-gram, untuk Jaccard. */
  gram: Set<string>;
  /** Frasa panjang, untuk mencari yang langka. */
  frasa: Set<string>;
  jumlahKata: number;
  jumlahKalimat: number;
};

export function sidikJawaban(attemptId: number, teks: string): Sidik {
  const kata = kataDari(teks);
  const hitung = new Map<string, number>();
  for (const k of kata) hitung.set(k, (hitung.get(k) ?? 0) + 1);
  return {
    attemptId,
    kata,
    hitung,
    gram: new Set(ngram(kata, N_GRAM)),
    frasa: new Set(ngram(kata, PANJANG_FRASA)),
    jumlahKata: kata.length,
    // Kalimat dihitung dari teks ASLI, sebelum tanda bacanya dibuang.
    jumlahKalimat: Math.max(1, String(teks ?? "").split(/[.!?]+\s/).filter((s) => s.trim()).length),
  };
}

// ------------------------------------------------------------
// SINYAL
// ------------------------------------------------------------

/**
 * Berapa lembar yang memuat tiap kata — dasar pembobotan TF-IDF.
 *
 * Kata yang muncul di seluruh lembar (karena ada di pertanyaannya) hampir
 * tidak berbobot. Kata yang hanya muncul di dua lembar berbobot besar. Tanpa
 * pembobotan ini, tiga puluh jawaban atas pertanyaan yang sama akan
 * seluruhnya terlihat mirip satu sama lain — karena memang menjawab pertanyaan
 * yang sama.
 */
export function hitungDf(sidik: Sidik[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const s of sidik) {
    for (const kata of new Set(s.kata)) df.set(kata, (df.get(kata) ?? 0) + 1);
  }
  return df;
}

function bobotTfIdf(s: Sidik, df: Map<string, number>, jumlahDok: number): Map<string, number> {
  const bobot = new Map<string, number>();
  for (const [kata, tf] of s.hitung) {
    const muncul = df.get(kata) ?? 1;
    // idf halus: +1 di atas dan di bawah, supaya kata yang ada di semua lembar
    // bernilai kecil tetapi tidak nol — nol membuat dua jawaban yang seluruh
    // katanya umum berjarak tak terhingga, dan itu bukan jawabannya.
    const idf = Math.log((jumlahDok + 1) / (muncul + 1)) + 1;
    bobot.set(kata, (1 + Math.log(tf)) * idf);
  }
  return bobot;
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let atas = 0;
  let na = 0;
  let nb = 0;
  // Ditelusuri dari yang LEBIH PENDEK. Jawaban tiga kata yang dibandingkan
  // dengan esai dua ribu kata tidak perlu menyentuh dua ribu kata itu.
  const [kecil, besar] = a.size <= b.size ? [a, b] : [b, a];
  for (const [kata, nilai] of kecil) {
    const lawan = besar.get(kata);
    if (lawan !== undefined) atas += nilai * lawan;
  }
  for (const nilai of a.values()) na += nilai * nilai;
  for (const nilai of b.values()) nb += nilai * nilai;
  if (na === 0 || nb === 0) return 0;
  return atas / (Math.sqrt(na) * Math.sqrt(nb));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [kecil, besar] = a.size <= b.size ? [a, b] : [b, a];
  let irisan = 0;
  for (const isi of kecil) if (besar.has(isi)) irisan += 1;
  const gabungan = a.size + b.size - irisan;
  return gabungan === 0 ? 0 : irisan / gabungan;
}

/**
 * Kata yang ejaannya tidak lazim dan muncul pada kedua lembar.
 *
 * Dicari dengan cara yang tidak menuntut kamus: kata yang muncul di lembar ini
 * dan lembar itu, TETAPI tidak muncul di lembar mana pun yang lain. Salah ketik
 * bersifat pribadi — "mengunakan" milik satu orang. Dua lembar yang memuat
 * salah ketik yang sama persis, pada kata yang tidak dipakai siapa pun lagi,
 * hampir selalu punya satu asal.
 *
 * Kata pendek dilewati: nama orang dan singkatan akan memenuhi daftarnya tanpa
 * mengatakan apa-apa.
 */
export function kataLangkaBersama(a: Sidik, b: Sidik, df: Map<string, number>): string[] {
  const hasil: string[] = [];
  for (const kata of a.hitung.keys()) {
    if (kata.length < 6) continue;
    if (!b.hitung.has(kata)) continue;
    if ((df.get(kata) ?? 0) > BATAS_LANGKA) continue;
    hasil.push(kata);
  }
  return hasil.slice(0, 20);
}

export function frasaLangkaBersama(a: Sidik, b: Sidik, dfFrasa: Map<string, number>): string[] {
  const hasil: string[] = [];
  for (const frasa of a.frasa) {
    if (!b.frasa.has(frasa)) continue;
    if ((dfFrasa.get(frasa) ?? 0) > BATAS_LANGKA) continue;
    hasil.push(frasa);
  }
  return hasil.slice(0, 10);
}

/**
 * Kemiripan bentuk: panjang dan jumlah kalimat.
 *
 * Sinyal paling lemah dari keempatnya, dan bobotnya paling kecil. Ia tidak
 * pernah cukup sendirian — dua jawaban berisi seratus kata dalam lima kalimat
 * adalah kejadian yang biasa. Nilainya muncul ketika ia menyertai tiga sinyal
 * lain: jawaban yang isinya mirip DAN bentuknya persis sama.
 */
export function miripBentuk(a: Sidik, b: Sidik): number {
  const panjang = Math.min(a.jumlahKata, b.jumlahKata) / Math.max(a.jumlahKata, b.jumlahKata, 1);
  const kalimat = Math.min(a.jumlahKalimat, b.jumlahKalimat) / Math.max(a.jumlahKalimat, b.jumlahKalimat, 1);
  return (panjang + kalimat) / 2;
}

// ------------------------------------------------------------
// SKOR GABUNGAN
// ------------------------------------------------------------

export type Sinyal = {
  /** 0–100, kesamaan kata berbobot. */
  kata: number;
  /** 0–100, kesamaan urutan empat kata berturut-turut. */
  urutan: number;
  /** 0–100, dari banyaknya frasa langka yang dipakai bersama. */
  frasa: number;
  /** 0–100, kesamaan panjang dan jumlah kalimat. */
  bentuk: number;
  /** Frasa yang hanya muncul pada kedua lembar ini. */
  frasaBersama: string[];
  /** Kata tak lazim yang hanya muncul pada kedua lembar ini. */
  kataBersama: string[];
  /** Benar bila ada kalimat yang sama persis. */
  salinanUtuh: boolean;
};

export type PasanganMirip = {
  a: number;
  b: number;
  skor: number;
  status: StatusMirip;
  sinyal: Sinyal;
};

const BOBOT = { kata: 0.35, urutan: 0.4, frasa: 0.15, bentuk: 0.1 };

/**
 * Skor akhir sepasang jawaban, 0–100.
 *
 * Urutan kata berbobot paling besar (0,40) karena ia yang paling sulit terjadi
 * kebetulan. Bentuk paling kecil (0,10) karena ia paling mudah.
 *
 * Satu aturan yang berdiri di atas pembobotan: jawaban yang SAMA PERSIS
 * langsung bernilai seratus, tanpa melewati rumus. Rumus berbobot pada dua
 * teks identik menghasilkan angka sembilan puluhan — dan angka sembilan puluhan
 * pada dua lembar yang sama huruf demi huruf akan membuat yang membacanya
 * mengira masih ada bedanya.
 */
export function skorPasangan(a: Sidik, b: Sidik, df: Map<string, number>, dfFrasa: Map<string, number>, jumlahDok: number): PasanganMirip {
  const samaPersis = a.kata.length === b.kata.length && a.kata.join(" ") === b.kata.join(" ");

  const kataSkor = cosine(bobotTfIdf(a, df, jumlahDok), bobotTfIdf(b, df, jumlahDok));
  const urutanSkor = jaccard(a.gram, b.gram);
  const frasaBersama = frasaLangkaBersama(a, b, dfFrasa);
  const kataBersama = kataLangkaBersama(a, b, df);
  // Tiga frasa langka bersama sudah cukup untuk menjadikan sinyal ini penuh.
  // Di atas itu tidak menambah apa-apa: yang membedakan bukan berapa banyak,
  // melainkan bahwa ada sama sekali.
  const frasaSkor = Math.min(1, frasaBersama.length / 3);
  const bentukSkor = miripBentuk(a, b);

  const gabung =
    kataSkor * BOBOT.kata + urutanSkor * BOBOT.urutan + frasaSkor * BOBOT.frasa + bentukSkor * BOBOT.bentuk;

  const skor = samaPersis ? 100 : Math.round(Math.max(0, Math.min(1, gabung)) * 100);

  return {
    a: a.attemptId,
    b: b.attemptId,
    skor,
    status: "bersih",
    sinyal: {
      kata: Math.round(kataSkor * 100),
      urutan: Math.round(urutanSkor * 100),
      frasa: Math.round(frasaSkor * 100),
      bentuk: Math.round(bentukSkor * 100),
      frasaBersama,
      kataBersama,
      salinanUtuh: samaPersis || frasaBersama.length >= 3,
    },
  };
}

export type JawabanBanding = { attemptId: number; teks: string };

/**
 * Bandingkan seluruh jawaban atas SATU soal, satu sama lain.
 *
 * Pasangan yang skornya di bawah ambang bawah dibuang di sini, bukan disimpan
 * lalu disaring saat dibaca: tiga puluh peserta menghasilkan 435 pasang untuk
 * satu soal saja, dan hampir seluruhnya bernilai nol.
 */
export function bandingkanSoal(
  jawaban: JawabanBanding[],
  ambang: Ambang = AMBANG_BAWAAN,
): PasanganMirip[] {
  const a = rapikanAmbang(ambang);
  // Jawaban yang terlalu pendek dibuang lebih dulu. "Ya", "setuju", dan
  // "tidak tahu" akan mirip seratus persen satu sama lain, dan menandainya
  // sebagai indikasi kecurangan hanya menghasilkan derau yang membuat dosen
  // berhenti mempercayai seluruh kolomnya.
  const sidik = jawaban
    .filter((j) => String(j.teks ?? "").trim())
    .map((j) => sidikJawaban(j.attemptId, j.teks))
    .filter((s) => s.jumlahKata >= MIN_KATA);

  if (sidik.length < 2) return [];

  const df = hitungDf(sidik);
  const dfFrasa = new Map<string, number>();
  for (const s of sidik) {
    for (const f of s.frasa) dfFrasa.set(f, (dfFrasa.get(f) ?? 0) + 1);
  }

  const batasSimpan = Math.max(1, Math.round(a.tinjau / 2));
  const hasil: PasanganMirip[] = [];
  for (let i = 0; i < sidik.length; i += 1) {
    for (let j = i + 1; j < sidik.length; j += 1) {
      // attemptId yang lebih kecil selalu menjadi `a`, supaya satu pasangan
      // hanya punya satu bentuk penyimpanan — dan indeks uniknya bekerja.
      const [kiri, kanan] = sidik[i].attemptId <= sidik[j].attemptId ? [sidik[i], sidik[j]] : [sidik[j], sidik[i]];
      const pasang = skorPasangan(kiri, kanan, df, dfFrasa, sidik.length);
      if (pasang.skor < batasSimpan) continue;
      pasang.status = statusMirip(pasang.skor, a);
      hasil.push(pasang);
    }
  }
  return hasil.sort((x, y) => y.skor - x.skor);
}

/**
 * Ringkas hasil per peserta: berapa kemiripan TERTINGGI yang ia punya.
 *
 * Tertinggi, bukan rata-rata. Peserta yang satu jawabannya identik dengan
 * teman sebangku dan sembilan lainnya asli punya persoalan yang tidak
 * tertangkap oleh rata-rata — dan justru persoalan itu yang dicari.
 */
export function ringkasPerPeserta(
  pasangan: PasanganMirip[],
  ambang: Ambang = AMBANG_BAWAAN,
): Map<number, { skor: number; status: StatusMirip; lawan: number }> {
  const hasil = new Map<number, { skor: number; status: StatusMirip; lawan: number }>();
  const catat = (siapa: number, lawan: number, skor: number) => {
    const ada = hasil.get(siapa);
    if (ada && ada.skor >= skor) return;
    hasil.set(siapa, { skor, status: statusMirip(skor, ambang), lawan });
  };
  for (const p of pasangan) {
    catat(p.a, p.b, p.skor);
    catat(p.b, p.a, p.skor);
  }
  return hasil;
}

/**
 * Kalimat pada kedua jawaban yang sama persis, untuk ditunjukkan berdampingan.
 *
 * Inilah yang benar-benar dibaca dosen. Angka 74% tidak dapat dibawa ke sidang
 * akademik; dua kalimat yang sama huruf demi huruf, ditampilkan bersebelahan,
 * bisa.
 */
export function kalimatSama(teksA: string, teksB: string, minKata = 8): string[] {
  const pecah = (t: string) =>
    String(t ?? "")
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => kataDari(s).length >= minKata);

  const petaB = new Map<string, string>();
  for (const kalimat of pecah(teksB)) petaB.set(normalkan(kalimat), kalimat);

  const hasil: string[] = [];
  for (const kalimat of pecah(teksA)) {
    const kunci = normalkan(kalimat);
    if (petaB.has(kunci)) hasil.push(kalimat);
    if (hasil.length >= 10) break;
  }
  return hasil;
}
