// MEMBACA CERITA MAHASISWA
//
// Mahasiswa yang bingung tidak datang dengan variabel bebas dan variabel
// terikat. Ia datang dengan kalimat seperti "aku pengen neliti soal anak
// muda yang kena FOMO gara-gara TikTok, tapi bingung metodenya apa". Formulir
// tujuh langkah menuntut ia sudah tahu jawabannya sebelum bertanya, dan di
// situlah kebanyakan orang berhenti.
//
// Berkas ini membaca kalimat itu dan mengeluarkan isian yang sama dengan yang
// biasa diisi tangan, lengkap dengan potongan kalimat yang menjadi dasarnya.
//
// TIDAK ADA MODEL BAHASA DI SINI, dan itu disengaja. Yang bekerja adalah
// kamus dan pola: kosakata metodologi Indonesia jumlahnya terbatas, dan
// "pengaruh A terhadap B" selalu berarti hal yang sama. Akibatnya:
//
//   - naskah tidak pernah meninggalkan perangkat, sama seperti alat lain;
//   - tidak ada yang dikarang. Kalau sesuatu tidak ditemukan, ia dinyatakan
//     tidak ditemukan lalu ditanyakan, bukan ditebak diam-diam;
//   - tiap tafsiran dapat ditunjukkan asalnya di kalimat mahasiswa sendiri.
//
// Yang keluar dari sini tetap dugaan, dan mahasiswa dapat membetulkannya
// lewat formulir yang sama seperti sebelumnya.

import type { Data, Masukan, Prodi, Tujuan, Unit } from "./metodologi";

export type Yakin = "kuat" | "sedang" | "terka";

export type Temuan = {
  bidang: string;
  nilai: string;
  /** Potongan kalimat mahasiswa yang menjadi dasarnya. */
  bukti: string | null;
  yakin: Yakin;
};

export type Bacaan = {
  masukan: Masukan;
  temuan: Temuan[];
  /** Yang belum terbaca, ditulis sebagai pertanyaan yang bisa dijawab. */
  pertanyaan: string[];
  /** Satu paragraf: cerita mahasiswa dibacakan ulang dalam bahasa metode. */
  ringkas: string;
  /** Cukup untuk disusun menjadi rancangan? */
  cukup: boolean;
  jumlahKata: number;
};

export const MINIMAL_KATA = 12;

export const CONTOH_CERITA =
  "Aku mau meneliti soal mahasiswa yang sekarang kebanyakan cari berita dari TikTok. " +
  "Kayaknya makin sering mereka buka TikTok, makin turun minat baca berita di media " +
  "resmi. Aku pengen tahu apakah terpaan konten berita di TikTok itu benar-benar " +
  "berpengaruh terhadap minat baca berita pada mahasiswa Ilmu Komunikasi di " +
  "Universitas Serang Raya. Rencananya sebar kuesioner, populasinya sekitar 600 " +
  "mahasiswa, target responden 100 orang.";

// ---------------------------------------------------------------------------
// Perkakas kecil
// ---------------------------------------------------------------------------

/** Kata yang tidak boleh menjadi ujung sebuah frasa variabel. */
const EKOR_BUANG = new RegExp(
  "\\s+(?:yang|itu|ini|nya|adalah|akan|bisa|dapat|sangat|sudah|masih|juga|dan|atau|" +
    "dengan|untuk|dari|pada|di|ke|dalam|terhadap|karena|sehingga|tapi|tetapi|kalau|" +
    "jika|serta|maupun|lebih|paling|banyak|para|si|sang|mereka|kita|kami|saya|anda|" +
    "benar-benar|beneran|memang|sebenarnya|sih|nih|tuh|banget|sekali|tuh)$",
  "i",
);

const KEPALA_BUANG = new RegExp(
  "^(?:soal|tentang|mengenai|masalah|perihal|kaitan|hal|adanya|si|sang|para|" +
    "bagaimana|apakah|seberapa|adanya|tahu|ingin|pengen|kepengen|mau|bahwa|kalau|" +
    "jika|ternyata|memang|benarkah|makin|semakin|lebih|sering|tinggi|rendah|naik|" +
    "turun|banyak|kurang|nggak|ya|gak|tidak|jadi|menjadi)\\s+",
  "i",
);

/** Rapikan sebuah frasa hasil tangkapan pola supaya layak jadi nama variabel. */
function rapikanFrasa(mentah: string | undefined, maksKata = 8): string {
  if (!mentah) return "";
  let f = mentah
    .replace(/["“”'’()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Potong pada tanda baca atau kata sambung yang mengakhiri gagasan.
  // Titik dan koma di antara angka ("Kompas.com", "1.200") bukan tanda
  // pemenggal kalimat, jadi tidak boleh memotong frasa di situ.
  f = f.split(/[;:!?]|[.,](?=\s|$)|\bkarena\b|\bsehingga\b|\bsedangkan\b|\btapi\b|\btetapi\b/i)[0].trim();

  // Kata pengantar yang terakhir menandai awal gagasannya. Dipakai serakah
  // dengan sengaja: pada "Aku pengen tahu apakah terpaan konten berita…",
  // yang menjadi variabel adalah bagian sesudah "apakah", bukan sesudah "tahu".
  f = f.replace(/^.*\b(?:apakah|bahwa|kalau|jika|yaitu|yakni|ternyata|tahu|soal|bahwasanya)\s+/i, "");

  let sebelum = "";
  while (f !== sebelum) {
    sebelum = f;
    f = f.replace(KEPALA_BUANG, "").replace(EKOR_BUANG, "").trim();
  }

  const kata = f.split(/\s+/).filter(Boolean);
  if (kata.length > maksKata) f = kata.slice(0, maksKata).join(" ");
  return f.trim();
}

/** Kalimat tempat sebuah pola ditemukan, untuk ditunjukkan sebagai bukti. */
function kalimatSekitar(teks: string, posisi: number) {
  // Titik pemisah kalimat saja: titik di dalam "Kompas.com" tidak mengakhiri
  // apa pun, dan memotong di situ menghasilkan bukti yang terpenggal.
  const pemisah = /[.!?](?=\s|$)/g;
  let awal = 0;
  let akhir = teks.length;
  for (const m of teks.matchAll(pemisah)) {
    const i = m.index ?? 0;
    if (i < posisi) awal = i + 1;
    else { akhir = i + 1; break; }
  }
  const potong = teks.slice(awal, akhir).trim();
  return potong.length > 180 ? `${potong.slice(0, 177)}…` : potong;
}

type Cocok = { nilai: string; bukti: string; posisi: number };

// ---------------------------------------------------------------------------
// 1. Apa yang ingin diketahui
// ---------------------------------------------------------------------------

type Isyarat = { pola: RegExp; bobot: number };

const ISYARAT_TUJUAN: Record<Tujuan, Isyarat[]> = {
  pengaruh: [
    { pola: /\bpengaruh(?:nya)?\b/gi, bobot: 3 },
    { pola: /\b(?:mem|di)pengaruhi\b/gi, bobot: 3 },
    { pola: /\bberpengaruh\b/gi, bobot: 3 },
    { pola: /\bdampak(?:nya)?\b/gi, bobot: 2 },
    { pola: /\befek(?:nya)?\b/gi, bobot: 2 },
    { pola: /\bakibat(?:nya)?\b/gi, bobot: 1 },
    { pola: /\bberdampak\b/gi, bobot: 2 },
    { pola: /\bkontribusi\b/gi, bobot: 1 },
    { pola: /\bgara-gara\b/gi, bobot: 1 },
    { pola: /\bmakin\s+\w+\s+makin\b/gi, bobot: 2 },
    { pola: /\bsemakin\s+\w+\s+semakin\b/gi, bobot: 2 },
  ],
  hubungan: [
    { pola: /\bhubungan(?:nya)?\b/gi, bobot: 3 },
    { pola: /\bkorelasi\b/gi, bobot: 3 },
    { pola: /\bketerkaitan\b/gi, bobot: 3 },
    { pola: /\bkaitan(?:nya)?\b/gi, bobot: 2 },
    { pola: /\bberkaitan\s+dengan\b/gi, bobot: 2 },
    { pola: /\bberhubungan\b/gi, bobot: 2 },
  ],
  perbedaan: [
    { pola: /\bperbedaan\b/gi, bobot: 3 },
    { pola: /\bmembandingkan\b/gi, bobot: 3 },
    { pola: /\bperbandingan\b/gi, bobot: 3 },
    { pola: /\bkomparasi\b/gi, bobot: 3 },
    { pola: /\bdibandingkan\s+(?:dengan|antara)\b/gi, bobot: 2 },
    { pola: /\bbeda(?:nya)?\s+(?:antara|dengan)\b/gi, bobot: 2 },
  ],
  gambaran: [
    { pola: /\bgambaran\b/gi, bobot: 3 },
    { pola: /\bseberapa\s+(?:banyak|besar|tinggi|sering)\b/gi, bobot: 2 },
    { pola: /\btingkat\s+\w+/gi, bobot: 2 },
    { pola: /\bmendeskripsikan\b/gi, bobot: 2 },
    { pola: /\bbagaimana\s+(?:kondisi|keadaan)\b/gi, bobot: 2 },
    { pola: /\bpotret\b/gi, bobot: 1 },
  ],
  makna: [
    { pola: /\bmakna(?:nya)?\b/gi, bobot: 3 },
    { pola: /\bmemaknai\b/gi, bobot: 3 },
    { pola: /\bpengalaman\b/gi, bobot: 3 },
    { pola: /\bfenomenologi\b/gi, bobot: 4 },
    { pola: /\bpersepsi\b/gi, bobot: 2 },
    { pola: /\bdirasakan\b/gi, bobot: 2 },
    { pola: /\bmotif\b/gi, bobot: 2 },
    { pola: /\bpandangan\s+(?:mereka|informan)\b/gi, bobot: 2 },
    { pola: /\bkenapa\s+(?:mereka|orang)\b/gi, bobot: 2 },
  ],
  proses: [
    { pola: /\bstrategi\b/gi, bobot: 3 },
    { pola: /\bimplementasi\b/gi, bobot: 3 },
    { pola: /\bpenerapan\b/gi, bobot: 3 },
    { pola: /\bpelaksanaan\b/gi, bobot: 3 },
    { pola: /\bupaya\b/gi, bobot: 2 },
    { pola: /\bperan(?:an)?\b/gi, bobot: 2 },
    { pola: /\bmekanisme\b/gi, bobot: 2 },
    { pola: /\bproses\b/gi, bobot: 2 },
    { pola: /\bbagaimana\s+\w+\s+(?:menjalankan|melakukan|mengelola)\b/gi, bobot: 3 },
    { pola: /\bhambatan\b/gi, bobot: 1 },
  ],
  isi: [
    { pola: /\banalisis\s+isi\b/gi, bobot: 4 },
    { pola: /\banalisis\s+wacana\b/gi, bobot: 4 },
    { pola: /\bsemiotika\b/gi, bobot: 4 },
    { pola: /\bframing\b/gi, bobot: 3 },
    { pola: /\bpembingkaian\b/gi, bobot: 3 },
    { pola: /\bpemberitaan\b/gi, bobot: 3 },
    { pola: /\brepresentasi\b/gi, bobot: 3 },
    { pola: /\bisi\s+(?:pesan|berita|konten)\b/gi, bobot: 3 },
    { pola: /\bnarasi\b/gi, bobot: 1 },
  ],
  evaluasi: [
    { pola: /\bevaluasi\b/gi, bobot: 4 },
    { pola: /\befektivitas\b/gi, bobot: 3 },
    { pola: /\bkeberhasilan\b/gi, bobot: 3 },
    { pola: /\bberhasil\s+(?:atau\s+tidak|apa\s+tidak)\b/gi, bobot: 3 },
    { pola: /\bcapaian\b/gi, bobot: 2 },
    { pola: /\bsudah\s+(?:tepat\s+sasaran|berjalan\s+baik)\b/gi, bobot: 2 },
    { pola: /\btepat\s+sasaran\b/gi, bobot: 2 },
  ],
};

/** Bila skornya seri, yang lebih khusus didahulukan. */
const URUT_TUJUAN: Tujuan[] = [
  "evaluasi", "isi", "makna", "perbedaan", "pengaruh", "hubungan", "proses", "gambaran",
];

function bacaTujuan(t: string): { tujuan: Tujuan; bukti: string | null; yakin: Yakin } {
  const skor = new Map<Tujuan, number>();
  let buktiTerbaik: string | null = null;
  let bobotBukti = 0;

  for (const [tujuan, isyarat] of Object.entries(ISYARAT_TUJUAN) as Array<[Tujuan, Isyarat[]]>) {
    let jumlah = 0;
    for (const { pola, bobot } of isyarat) {
      for (const m of t.matchAll(pola)) {
        jumlah += bobot;
        if (bobot > bobotBukti && typeof m.index === "number") {
          bobotBukti = bobot;
          buktiTerbaik = kalimatSekitar(t, m.index);
        }
      }
    }
    if (jumlah > 0) skor.set(tujuan, jumlah);
  }

  if (skor.size === 0) {
    return { tujuan: "gambaran", bukti: null, yakin: "terka" };
  }

  const tertinggi = Math.max(...skor.values());
  const pemenang = URUT_TUJUAN.find((j) => skor.get(j) === tertinggi) ?? "gambaran";
  const beda = tertinggi - Math.max(0, ...[...skor.values()].filter((v) => v !== tertinggi));
  const yakin: Yakin = tertinggi >= 3 && beda >= 2 ? "kuat" : tertinggi >= 2 ? "sedang" : "terka";
  return { tujuan: pemenang, bukti: buktiTerbaik, yakin };
}

// ---------------------------------------------------------------------------
// 2. Yang diteliti itu apa
// ---------------------------------------------------------------------------

const KATA_UNIT: Record<Unit, RegExp[]> = {
  teks: [
    /\b(?:berita|pemberitaan|artikel|headline|judul berita)\b/gi,
    /\b(?:tiktok|instagram|twitter|facebook|youtube|whatsapp|threads)\b/gi,
    /\b(?:iklan|film|sinetron|poster|meme|konten|unggahan|postingan|caption|komentar warganet)\b/gi,
    /\b(?:media massa|media online|portal berita|surat kabar|koran|majalah|kanal)\b/gi,
    /\b(?:kompas|detik|tribun|tempo|liputan6|cnn indonesia|antara)\b/gi,
  ],
  kebijakan: [
    /\b(?:kebijakan|peraturan daerah|perda|perbup|perwal|undang-undang|permen)\b/gi,
    /\b(?:program|bantuan sosial|bansos|blt|pkh|subsidi|dana desa|jkn|bpjs)\b/gi,
    /\b(?:layanan publik|pelayanan publik|e-government|smart city|samsat|adminduk)\b/gi,
  ],
  organisasi: [
    /\b(?:dinas|badan|kantor|kecamatan|kelurahan|pemerintah desa|pemdes|pemda|pemkot|pemkab)\b/gi,
    /\b(?:dprd|dpr|kpu|bawaslu|bpbd|dukcapil|puskesmas|rsud)\b/gi,
    /\b(?:perusahaan|pt |cv |umkm|startup|bank|hotel|koperasi)\b/gi,
    /\b(?:partai|ormas|lsm|komunitas|organisasi|humas|public relations|divisi)\b/gi,
    /\b(?:sekolah|kampus|universitas|fakultas|yayasan)\b/gi,
  ],
  individu: [
    /\b(?:mahasiswa|siswa|pelajar|remaja|anak muda|gen ?z|generasi z|milenial)\b/gi,
    /\b(?:warga|masyarakat|penduduk|ibu rumah tangga|petani|nelayan|pedagang)\b/gi,
    /\b(?:pegawai|karyawan|asn|pns|aparatur|guru|dosen|perawat|staf)\b/gi,
    /\b(?:pemilih|konstituen|responden|informan|pelanggan|konsumen|pengguna|followers|netizen)\b/gi,
  ],
};

/** Yang lebih khusus didahulukan bila skornya seri. */
const URUT_UNIT: Unit[] = ["teks", "kebijakan", "organisasi", "individu"];

function bacaUnit(t: string, tujuan: Tujuan): { unit: Unit; bukti: string | null; yakin: Yakin } {
  const skor = new Map<Unit, number>();
  const bukti = new Map<Unit, string>();

  for (const [unit, pola] of Object.entries(KATA_UNIT) as Array<[Unit, RegExp[]]>) {
    let jumlah = 0;
    for (const p of pola) {
      for (const m of t.matchAll(p)) {
        jumlah += 1;
        if (!bukti.has(unit) && typeof m.index === "number") bukti.set(unit, kalimatSekitar(t, m.index));
      }
    }
    if (jumlah > 0) skor.set(unit, jumlah);
  }

  // Yang diteliti adalah orangnya, walaupun media disebut-sebut: "pengaruh
  // TikTok terhadap mahasiswa" mengukur mahasiswa, bukan TikTok. Yang
  // menentukan bukan kata mana yang paling sering muncul, melainkan apakah
  // pertanyaannya menuntut pengukuran pada orang.
  const keOrang: Tujuan[] = ["pengaruh", "hubungan", "perbedaan"];
  if (keOrang.includes(tujuan) && (skor.get("individu") ?? 0) > 0) {
    return { unit: "individu", bukti: bukti.get("individu") ?? null, yakin: "kuat" };
  }
  if (tujuan === "isi") {
    return { unit: "teks", bukti: bukti.get("teks") ?? null, yakin: (skor.get("teks") ?? 0) > 0 ? "kuat" : "sedang" };
  }
  if (tujuan === "evaluasi" && (skor.get("kebijakan") ?? 0) > 0) {
    return { unit: "kebijakan", bukti: bukti.get("kebijakan") ?? null, yakin: "kuat" };
  }

  if (skor.size === 0) return { unit: "individu", bukti: null, yakin: "terka" };
  const tertinggi = Math.max(...skor.values());
  const unit = URUT_UNIT.find((u) => skor.get(u) === tertinggi) ?? "individu";
  return { unit, bukti: bukti.get(unit) ?? null, yakin: tertinggi >= 2 ? "kuat" : "sedang" };
}

// ---------------------------------------------------------------------------
// 3. Cara mengumpulkan data
// ---------------------------------------------------------------------------

// Sengaja tanpa bendera global: String.match pada pola global tidak
// mengembalikan letak temuannya, sehingga kalimat buktinya tidak dapat diambil.
const KATA_DATA: Record<Data, RegExp[]> = {
  kuesioner: [/\b(?:kuesioner|kuisioner|angket|survei|survey|skala likert|sebar\w*\s+(?:ke\s+)?\w*responden)\b/i],
  wawancara: [/\b(?:wawancara|interview|narasumber|informan|ngobrol dengan|tanya langsung)\b/i],
  dokumen: [/\b(?:dokumen|arsip|data sekunder|laporan (?:resmi|tahunan|dinas)|notula|unggahan|postingan|dokumentasi)\b/i],
  observasi: [/\b(?:observasi|pengamatan|mengamati|turun ke lapangan|ikut kegiatan)\b/i],
};

/** Bila tidak disebut sama sekali, cara yang memang dituntut tujuannya. */
const DATA_BAWAAN: Record<Tujuan, Data[]> = {
  pengaruh: ["kuesioner"],
  hubungan: ["kuesioner"],
  perbedaan: ["kuesioner"],
  gambaran: ["kuesioner"],
  makna: ["wawancara"],
  proses: ["wawancara", "dokumen"],
  isi: ["dokumen"],
  evaluasi: ["wawancara", "dokumen"],
};

function bacaData(t: string, tujuan: Tujuan): { data: Data[]; bukti: string | null; yakin: Yakin } {
  const ketemu: Data[] = [];
  let bukti: string | null = null;
  for (const [jenis, pola] of Object.entries(KATA_DATA) as Array<[Data, RegExp[]]>) {
    for (const p of pola) {
      const m = t.match(p);
      if (m && typeof m.index === "number") {
        ketemu.push(jenis);
        if (!bukti) bukti = kalimatSekitar(t, m.index);
        break;
      }
    }
  }
  if (ketemu.length > 0) return { data: ketemu, bukti, yakin: "kuat" };
  return { data: DATA_BAWAAN[tujuan], bukti: null, yakin: "terka" };
}

// ---------------------------------------------------------------------------
// 4. Variabel
// ---------------------------------------------------------------------------

/** Batas kanan sebuah frasa variabel.
 *
 *  Tanda baca hanya menghentikan frasa bila ia memang mengakhiri kata:
 *  "Kompas.com" dan "1.200" harus lewat utuh. Keterangan waktu ikut
 *  menghentikan, karena "selama Januari sampai Maret" bukan bagian dari nama
 *  variabel maupun nama media. */
const HENTI =
  "(?=\\s*(?:[.,;:](?=\\s|$)|$|\\bdi\\b|\\bpada\\b|\\bdalam\\b|\\bselama\\b|\\bsejak\\b|" +
  "\\bperiode\\b|\\bedisi\\b|\\bsepanjang\\b|\\bkarena\\b|\\bsehingga\\b|\\bdengan demikian\\b))";

/** Batas kiri untuk pola yang variabel bebasnya berada di depan kata kerja.
 *
 *  Tanpa ini, "Aku pengen tahu apakah terpaan konten berita di TikTok itu
 *  benar-benar berpengaruh terhadap …" menghasilkan variabel bebas yang
 *  diawali "Aku pengen tahu apakah". Yang dicari adalah awal gagasannya, dan
 *  gagasan selalu dimulai sesudah tanda baca atau kata pengantar semacam ini. */
const MULAI =
  "(?:^|[.,;:]\\s*|\\b(?:apakah|bahwa|kalau|jika|yaitu|yakni|ternyata|tahu|soal|bahwasanya)\\s+)";

type PolaVariabel = {
  pola: RegExp;
  /** Tangkapan pertama sebenarnya variabel terikat, bukan bebas. Terjadi pada
   *  rumusan komparatif: "membandingkan Y antara kelompok A dan B". */
  balik?: boolean;
};

// \b di depan "pengaruh" penting: tanpa itu, pola ini ikut tersulut di tengah
// kata "berpengaruh", lalu menangkap potongan kalimat yang salah.
const POLA_DUA_VARIABEL: PolaVariabel[] = [
  { pola: new RegExp(`\\bpengaruh(?:nya)?\\s+(?:dari\\s+)?(.{3,70}?)\\s+(?:terhadap|pada|atas|ke)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`\\bdampak(?:nya)?\\s+(?:dari\\s+)?(.{3,70}?)\\s+(?:terhadap|pada|bagi|atas)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`\\befek(?:nya)?\\s+(?:dari\\s+)?(.{3,70}?)\\s+(?:terhadap|pada|bagi)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`\\bhubungan(?:nya)?\\s+(?:antara\\s+)?(.{3,70}?)\\s+(?:dengan|dan|terhadap)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`\\bkorelasi\\s+(?:antara\\s+)?(.{3,70}?)\\s+(?:dengan|dan)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`\\bketerkaitan\\s+(?:antara\\s+)?(.{3,70}?)\\s+(?:dengan|dan)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`\\bmembandingkan\\s+(.{3,70}?)\\s+(?:antara|pada)\\s+(.{3,70}?)${HENTI}`, "i"), balik: true },
  { pola: new RegExp(`\\bperbandingan\\s+(.{3,70}?)\\s+(?:antara|pada)\\s+(.{3,70}?)${HENTI}`, "i"), balik: true },
  { pola: new RegExp(`\\bperbedaan\\s+(.{3,70}?)\\s+antara\\s+(.{3,70}?)${HENTI}`, "i"), balik: true },
  { pola: new RegExp(`${MULAI}(.{3,70}?)\\s+(?:mem|di)pengaruhi\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`${MULAI}(.{3,70}?)\\s+berpengaruh\\s+(?:terhadap|pada)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`${MULAI}(.{3,70}?)\\s+berdampak\\s+(?:terhadap|pada|bagi)\\s+(.{3,70}?)${HENTI}`, "i") },
  { pola: new RegExp(`${MULAI}(.{3,70}?)\\s+berkaitan\\s+dengan\\s+(.{3,70}?)${HENTI}`, "i") },
  // "makin sering buka TikTok, makin turun minat baca"
  { pola: new RegExp(`(?:makin|semakin)\\s+(.{3,60}?)\\s*,\\s*(?:makin|semakin)\\s+(.{3,60}?)${HENTI}`, "i") },
];

/** Untuk rancangan berbasis teks: gagasan yang diteliti dan medianya. */
const POLA_TEKS: PolaVariabel[] = [
  { pola: new RegExp(`(?:pemberitaan|berita|representasi|citra|framing|pembingkaian|narasi|konten|wacana)\\s+(?:tentang\\s+|soal\\s+|mengenai\\s+)?(.{3,70}?)\\s+(?:di|pada|dalam|oleh)\\s+(.{3,60}?)${HENTI}`, "i") },
  { pola: new RegExp(`analisis\\s+(?:isi|wacana|semiotika)\\s+(?:pada\\s+|terhadap\\s+)?(.{3,70}?)\\s+(?:di|pada|dalam)\\s+(.{3,60}?)${HENTI}`, "i") },
];

/** Untuk rancangan proses dan evaluasi: apa yang dikerjakan dan sasarannya. */
const POLA_PROSES: PolaVariabel[] = [
  { pola: new RegExp(`(?:strategi|upaya|peran|peranan|implementasi|penerapan|pelaksanaan|evaluasi)\\s+(.{3,70}?)\\s+(?:dalam|untuk|terhadap|guna)\\s+(.{3,70}?)${HENTI}`, "i") },
];

/** Satu gagasan saja, tanpa lawan. Dipakai pada rancangan yang memang tidak
 *  berpasangan variabel: proses, evaluasi, dan gambaran. */
const POLA_SATU: RegExp[] = [
  new RegExp(`(?:strategi|upaya|peranan|peran|implementasi|penerapan|pelaksanaan|evaluasi|efektivitas|gambaran|tingkat)\\s+(?:dari\\s+|program\\s+)?(.{3,70}?)${HENTI}`, "i"),
];

/**
 * Kosakata variabel yang paling sering muncul pada skripsi FISIP.
 *
 * Dipakai hanya sebagai jaring terakhir, ketika mahasiswa tidak menulis
 * hubungan antarvariabel secara terang-terangan. Urutannya penting: yang
 * lebih panjang lebih dulu, supaya "kualitas pelayanan publik" tidak keburu
 * tertangkap sebagai "pelayanan publik".
 */
const KONSEP = [
  "kualitas pelayanan publik", "kualitas pelayanan", "pelayanan publik",
  "partisipasi masyarakat", "partisipasi politik", "perilaku memilih", "pilihan politik",
  "literasi digital", "literasi media", "literasi politik", "minat baca", "minat beli",
  "terpaan media", "terpaan iklan", "intensitas penggunaan media sosial",
  "penggunaan media sosial", "media sosial", "konten digital",
  "citra lembaga", "citra perusahaan", "citra diri", "brand awareness", "brand image",
  "kepuasan masyarakat", "kepuasan kerja", "kepuasan pelanggan",
  "kinerja pegawai", "kinerja aparatur", "kinerja organisasi", "kinerja karyawan",
  "motivasi kerja", "disiplin kerja", "budaya organisasi", "gaya kepemimpinan", "kepemimpinan",
  "komunikasi organisasi", "komunikasi interpersonal", "komunikasi pemasaran", "komunikasi politik",
  "efektivitas komunikasi", "strategi komunikasi", "strategi humas", "hubungan masyarakat",
  "akuntabilitas", "transparansi", "good governance", "e-government", "digitalisasi",
  "kualitas informasi", "kepercayaan publik", "kepercayaan masyarakat",
  "kesadaran hukum", "kepatuhan", "loyalitas", "keputusan pembelian",
  "perilaku konsumtif", "gaya hidup", "konsep diri", "kecemasan sosial",
  "fear of missing out", "fomo", "kesehatan mental", "kesejahteraan psikologis",
  "prestasi belajar", "hasil belajar", "motivasi belajar",
  "efektivitas program", "implementasi kebijakan", "pengawasan", "pemberdayaan masyarakat",
];

function cariKonsep(t: string): Array<{ nilai: string; posisi: number }> {
  const rendah = t.toLowerCase();
  const hasil: Array<{ nilai: string; posisi: number }> = [];
  const dipakai: Array<[number, number]> = [];

  for (const k of KONSEP) {
    let dari = 0;
    for (;;) {
      const p = rendah.indexOf(k, dari);
      if (p < 0) break;
      dari = p + k.length;
      // Lewati bila sudah tertutup konsep lain yang lebih panjang.
      if (dipakai.some(([a, b]) => p >= a && p < b)) continue;
      dipakai.push([p, p + k.length]);
      hasil.push({ nilai: t.slice(p, p + k.length), posisi: p });
    }
  }
  return hasil.sort((a, b) => a.posisi - b.posisi);
}

type Variabel = { x: string; y: string; bukti: string | null; yakin: Yakin };

/**
 * Ganti frasa tangkapan dengan istilah bakunya bila ada.
 *
 * Mahasiswa menulis "makin tinggi kecemasan sosial mereka"; yang pantas
 * tercetak di bagan kerangka berpikir adalah "kecemasan sosial". Penggantian
 * hanya dilakukan bila istilah bakunya memang menjadi bagian terbesar frasa
 * itu, supaya "terpaan konten berita di TikTok" tidak ikut disusutkan menjadi
 * "media sosial".
 */
function bakukan(frasa: string): string {
  if (!frasa) return frasa;
  const konsep = cariKonsep(frasa);
  if (konsep.length === 0) return frasa;
  const terpanjang = konsep.reduce((a, b) => (b.nilai.length > a.nilai.length ? b : a));
  return terpanjang.nilai.length >= frasa.length * 0.6 ? terpanjang.nilai : frasa;
}

function cocokkanPola(t: string, daftar: PolaVariabel[]): Variabel | null {
  for (const { pola, balik } of daftar) {
    const m = t.match(pola);
    if (!m || typeof m.index !== "number") continue;
    const satu = bakukan(rapikanFrasa(m[1]));
    const dua = bakukan(rapikanFrasa(m[2]));
    if (satu.length < 3 || dua.length < 3) continue;
    if (satu.toLowerCase() === dua.toLowerCase()) continue;
    // Letak tangkapan pertama, bukan letak awal kecocokan: pola yang
    // variabelnya berada di depan kata kerja dimulai dari batas kalimat
    // SEBELUMNYA, sehingga kalimat buktinya akan meleset satu kalimat.
    const letak = m.index + Math.max(0, m[0].indexOf(m[1]));
    return {
      x: balik ? dua : satu,
      y: balik ? satu : dua,
      bukti: kalimatSekitar(t, letak),
      yakin: "kuat",
    };
  }
  return null;
}

function bacaVariabel(t: string, tujuan: Tujuan): Variabel {
  const urutan =
    tujuan === "isi" ? [...POLA_TEKS, ...POLA_DUA_VARIABEL]
      : tujuan === "proses" || tujuan === "evaluasi" ? [...POLA_PROSES, ...POLA_DUA_VARIABEL]
        : [...POLA_DUA_VARIABEL, ...POLA_TEKS, ...POLA_PROSES];

  const berpasangan = cocokkanPola(t, urutan);
  if (berpasangan) return berpasangan;

  // Fenomenologi: yang dicari pengalamannya, bukan orang yang mengalaminya.
  // Orangnya sudah tercatat tersendiri sebagai populasi.
  if (tujuan === "makna") {
    const m = t.match(new RegExp(`(?:pengalaman|makna|persepsi|motif)\\s+(?:dari\\s+)?(.{3,70}?)${HENTI}`, "i"));
    if (m && typeof m.index === "number") {
      let x = rapikanFrasa(m[1]);
      const anak = x.match(new RegExp(`^(?:${KATA_ORANG})[\\w\\s]*?\\s+yang\\s+(.+)$`, "i"));
      if (anak) x = rapikanFrasa(anak[1]);
      if (x.length >= 3) return { x, y: "", bukti: kalimatSekitar(t, m.index), yakin: "kuat" };
    }
  }

  // Rancangan yang memang tidak berpasangan variabel: satu gagasan sudah cukup.
  if (tujuan === "proses" || tujuan === "evaluasi" || tujuan === "gambaran") {
    for (const p of POLA_SATU) {
      const m = t.match(p);
      if (!m || typeof m.index !== "number") continue;
      const x = bakukan(rapikanFrasa(m[1]));
      if (x.length >= 3) return { x, y: "", bukti: kalimatSekitar(t, m.index), yakin: "kuat" };
    }
  }

  // Jaring berikutnya: dua konsep FISIP pertama yang muncul di cerita.
  const konsep = cariKonsep(t);
  if (konsep.length >= 2) {
    return {
      x: konsep[0].nilai,
      y: konsep[1].nilai,
      bukti: kalimatSekitar(t, konsep[0].posisi),
      yakin: "sedang",
    };
  }
  if (konsep.length === 1) {
    return { x: konsep[0].nilai, y: "", bukti: kalimatSekitar(t, konsep[0].posisi), yakin: "terka" };
  }

  // Benar-benar tidak ada penanda: ambil frasa sesudah kata kerja meneliti.
  const sesudah = t.match(
    /(?:meneliti|teliti|membahas|mengkaji|mengangkat|bahas|angkat)\s+(?:tentang\s+|soal\s+|mengenai\s+)?(.{4,70})/i,
  );
  if (sesudah && typeof sesudah.index === "number") {
    const x = rapikanFrasa(sesudah[1]);
    if (x.length >= 3) return { x, y: "", bukti: kalimatSekitar(t, sesudah.index), yakin: "terka" };
  }
  return { x: "", y: "", bukti: null, yakin: "terka" };
}

// ---------------------------------------------------------------------------
// 5. Siapa yang diteliti dan di mana
// ---------------------------------------------------------------------------

const KATA_ORANG =
  "mahasiswa|siswa|pelajar|remaja|anak muda|generasi z|gen z|milenial|warga|masyarakat|" +
  "penduduk|ibu rumah tangga|petani|nelayan|pedagang|pelaku umkm|umkm|pegawai|karyawan|" +
  "asn|pns|aparatur|guru|dosen|perawat|staf|pemilih pemula|pemilih|konstituen|pelanggan|" +
  "konsumen|pengguna|followers|pengikut|anggota|kader|santri|alumni";

const POLA_OBJEK: RegExp[] = [
  new RegExp(`(?:pada|terhadap|di kalangan|kepada|buat|untuk)\\s+((?:${KATA_ORANG})[\\w\\s]{0,40}?)${HENTI}`, "i"),
  new RegExp(`((?:${KATA_ORANG})[\\w\\s]{0,40}?)${HENTI}`, "i"),
];

/** Nama tempat sungguhan diawali penanda ini, sehingga "di TikTok" tidak
 *  keliru dibaca sebagai lokasi penelitian. */
const PENANDA_TEMPAT =
  "kota|kabupaten|kab\\.|provinsi|kecamatan|kelurahan|desa|dusun|universitas|univ\\.|" +
  "institut|sekolah tinggi|politeknik|kampus|fakultas|sma|smk|smp|sd|madrasah|pondok|" +
  "dinas|badan|kantor|balai|puskesmas|rsud|rumah sakit|pemerintah kota|pemerintah kabupaten|" +
  "pemkot|pemkab|pemda|pemdes|dprd|kpu|bawaslu|pt |cv ";

const POLA_LOKASI: RegExp[] = [
  new RegExp(`\\bdi\\s+((?:${PENANDA_TEMPAT})[\\w\\s.'-]{2,50}?)${HENTI}`, "i"),
  // "di Serang", "di Banten": satu sampai tiga kata berhuruf kapital.
  /\bdi\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){0,2})\b/,
];

/** Nama layanan dan media yang sering muncul sesudah "di", tetapi bukan lokasi. */
const BUKAN_TEMPAT = new Set(
  ("tiktok instagram twitter facebook youtube whatsapp threads telegram shopee tokopedia " +
    "google kompas detik tribun tempo liputan6 antara cnn media sosial medsos indonesia " +
    "internet online daring rumah sana situ")
    .split(" "),
);

function bacaObjek(t: string): Cocok | null {
  for (const p of POLA_OBJEK) {
    const m = t.match(p);
    if (m && typeof m.index === "number") {
      // Anak kalimat "yang …" menerangkan populasinya, bukan menamainya.
      // "ibu rumah tangga yang jadi penjual online" sebagai nama populasi
      // membuat judul usulan berbunyi janggal ketika keterangannya diulang.
      const nilai = rapikanFrasa(m[1].split(/\s+yang\s+/i)[0], 7);
      if (nilai.length >= 4) return { nilai, bukti: kalimatSekitar(t, m.index), posisi: m.index };
    }
  }
  return null;
}

function bacaLokasi(t: string): Cocok | null {
  for (const p of POLA_LOKASI) {
    for (const m of t.matchAll(new RegExp(p.source, p.flags.includes("g") ? p.flags : `${p.flags}g`))) {
      if (typeof m.index !== "number") continue;
      const nilai = rapikanFrasa(m[1], 6);
      if (nilai.length < 3) continue;
      if (BUKAN_TEMPAT.has(nilai.toLowerCase())) continue;
      return { nilai, bukti: kalimatSekitar(t, m.index), posisi: m.index };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 6. Angka populasi dan sampel
// ---------------------------------------------------------------------------

function angka(teks: string) {
  const bersih = teks.replace(/[.\s]/g, "").replace(/,/g, "");
  const n = Number(bersih);
  return Number.isFinite(n) ? n : 0;
}

function bacaAngka(t: string): { populasi: number; sampel: number; bukti: string | null } {
  let populasi = 0;
  let sampel = 0;
  let bukti: string | null = null;

  const ambil = (pola: RegExp) => {
    const m = t.match(pola);
    if (!m || typeof m.index !== "number") return 0;
    if (!bukti) bukti = kalimatSekitar(t, m.index);
    return angka(m[1]);
  };

  populasi = ambil(/populasi\w*\s*(?:sekitar|kurang lebih|kira-kira|ada|nya)?\s*(\d[\d.,]*)/i);
  sampel = ambil(/(?:sampel|responden|target)\w*\s*(?:sekitar|kurang lebih|kira-kira|ada|nya)?\s*(\d[\d.,]*)/i)
    || ambil(/(\d[\d.,]*)\s*(?:orang\s+)?responden/i);

  if (!populasi && !sampel) {
    // Tidak ada penanda: kumpulkan angka yang diikuti kata benda orang, lalu
    // yang terbesar dianggap populasi dan yang terkecil sampel.
    const semua: number[] = [];
    for (const m of t.matchAll(new RegExp(`(\\d[\\d.,]*)\\s*(?:orang|${KATA_ORANG})`, "gi"))) {
      const n = angka(m[1]);
      if (n > 0) {
        semua.push(n);
        if (!bukti && typeof m.index === "number") bukti = kalimatSekitar(t, m.index);
      }
    }
    if (semua.length === 1) {
      if (semua[0] >= 300) populasi = semua[0];
      else sampel = semua[0];
    } else if (semua.length >= 2) {
      populasi = Math.max(...semua);
      sampel = Math.min(...semua);
    }
  }

  return { populasi, sampel, bukti };
}

// ---------------------------------------------------------------------------
// 7. Program studi
// ---------------------------------------------------------------------------

const KATA_PRODI: Record<Exclude<Prodi, "lain">, RegExp> = {
  komunikasi:
    /\b(?:komunikasi|jurnalistik|humas|public relations|periklanan|media|penyiaran|broadcasting|pemasaran|branding|khalayak|audiens)\b/i,
  pemerintahan:
    /\b(?:pemerintahan|kebijakan publik|birokrasi|otonomi daerah|desa|kelurahan|kecamatan|dprd|asn|pelayanan publik|governance|politik lokal)\b/i,
};

function bacaProdi(t: string, bawaan: Prodi): Prodi {
  const k = KATA_PRODI.komunikasi.test(t);
  const p = KATA_PRODI.pemerintahan.test(t);
  if (k && !p) return "komunikasi";
  if (p && !k) return "pemerintahan";
  return bawaan;
}

// ---------------------------------------------------------------------------
// Pembacaan utuh
// ---------------------------------------------------------------------------

const LABEL_TUJUAN: Record<Tujuan, string> = {
  pengaruh: "Pengaruh, apakah A memengaruhi B",
  hubungan: "Hubungan, apakah A berkaitan dengan B",
  perbedaan: "Perbedaan antar kelompok",
  gambaran: "Gambaran keadaan",
  makna: "Makna dan pengalaman",
  proses: "Proses dan strategi",
  isi: "Isi pesan atau teks",
  evaluasi: "Evaluasi program",
};

const LABEL_UNIT: Record<Unit, string> = {
  individu: "Orang",
  organisasi: "Lembaga",
  teks: "Teks atau media",
  kebijakan: "Kebijakan atau program",
};

const LABEL_DATA: Record<Data, string> = {
  kuesioner: "kuesioner",
  wawancara: "wawancara mendalam",
  dokumen: "dokumen atau arsip",
  observasi: "pengamatan langsung",
};

export function hitungKataCerita(cerita: string) {
  const b = cerita.trim();
  return b ? b.split(/\s+/).length : 0;
}

/**
 * Baca cerita mahasiswa menjadi isian rancangan.
 *
 * `prodiBawaan` dipakai hanya bila ceritanya sendiri tidak memberi petunjuk;
 * biasanya diisi dari program studi yang tercatat pada project.
 */
export function tafsirkan(cerita: string, prodiBawaan: Prodi = "lain"): Bacaan {
  // Tanda baca dirapikan supaya pemenggal kalimat dan pola tidak tersandung
  // pada tulisan yang memang ditulis apa adanya di kotak cerita.
  // Spasi disisipkan sesudah tanda baca yang menempel pada kata berikutnya.
  // Titik hanya dipisah bila disusul huruf kapital, yaitu ketika ia memang
  // mengakhiri kalimat; dengan begitu "Kompas.com" dan "1.200" tetap utuh.
  const t = cerita
    .replace(/\s+/g, " ")
    .replace(/([,;:])(?=[^\s\d])/g, "$1 ")
    .replace(/\.(?=[A-Z])/g, ". ")
    .trim();
  const jumlahKata = hitungKataCerita(cerita);

  const tujuan = bacaTujuan(t);
  const unit = bacaUnit(t, tujuan.tujuan);
  const data = bacaData(t, tujuan.tujuan);
  const variabel = bacaVariabel(t, tujuan.tujuan);
  const objek = bacaObjek(t);
  const lokasi = bacaLokasi(t);
  const bilangan = bacaAngka(t);
  const prodi = bacaProdi(t, prodiBawaan);

  const masukan: Masukan = {
    variabelX: variabel.x,
    variabelX2: "",
    variabelZ: "",
    variabelY: variabel.y,
    objek: objek?.nilai ?? "",
    lokasi: lokasi?.nilai ?? "",
    tujuan: tujuan.tujuan,
    unit: unit.unit,
    data: data.data,
    jumlahPopulasi: bilangan.populasi,
    perkiraanSampel: bilangan.sampel,
    prodi,
  };

  const temuan: Temuan[] = [
    { bidang: "Yang ingin diketahui", nilai: LABEL_TUJUAN[tujuan.tujuan], bukti: tujuan.bukti, yakin: tujuan.yakin },
    { bidang: "Yang diteliti", nilai: LABEL_UNIT[unit.unit], bukti: unit.bukti, yakin: unit.yakin },
  ];

  if (variabel.x) {
    temuan.push({
      bidang: tujuan.tujuan === "isi" ? "Gagasan yang ditelusuri" : "Variabel bebas (X)",
      nilai: variabel.x,
      bukti: variabel.bukti,
      yakin: variabel.yakin,
    });
  }
  if (variabel.y) {
    temuan.push({
      bidang: tujuan.tujuan === "isi" ? "Media yang diperiksa" : "Variabel terikat (Y)",
      nilai: variabel.y,
      bukti: variabel.bukti,
      yakin: variabel.yakin,
    });
  }
  if (objek) {
    temuan.push({ bidang: "Siapa yang diteliti", nilai: objek.nilai, bukti: objek.bukti, yakin: "sedang" });
  }
  if (lokasi) {
    temuan.push({ bidang: "Lokasi", nilai: lokasi.nilai, bukti: lokasi.bukti, yakin: "sedang" });
  }
  temuan.push({
    bidang: "Cara mengumpulkan data",
    nilai: data.data.map((d) => LABEL_DATA[d]).join(", "),
    bukti: data.bukti,
    yakin: data.yakin,
  });
  if (bilangan.populasi || bilangan.sampel) {
    temuan.push({
      bidang: "Jumlah",
      nilai: [
        bilangan.populasi ? `populasi ${bilangan.populasi.toLocaleString("id-ID")}` : null,
        bilangan.sampel ? `sampel ${bilangan.sampel.toLocaleString("id-ID")}` : null,
      ].filter(Boolean).join(", "),
      bukti: bilangan.bukti,
      yakin: "sedang",
    });
  }

  // Yang ditanyakan hanya yang memang dituntut rancangannya. Menanyakan
  // variabel terikat pada penelitian fenomenologi, misalnya, justru
  // menyesatkan: rancangan itu tidak punya variabel terikat.
  const berpasangan: Tujuan[] = ["pengaruh", "hubungan", "perbedaan"];
  const pertanyaan: string[] = [];

  if (!variabel.x) {
    pertanyaan.push("Gagasan utama yang Anda teliti apa? Sebutkan satu istilahnya, misalnya “literasi digital”.");
  }
  if (!variabel.y && berpasangan.includes(tujuan.tujuan)) {
    pertanyaan.push("Yang Anda ingin lihat berubah atau terpengaruh itu apa? Itulah variabel terikatnya.");
  }
  if (!objek && unit.unit !== "teks") {
    pertanyaan.push("Siapa yang akan Anda teliti? Mahasiswa, warga, pegawai, atau pihak lain?");
  }
  if (unit.unit === "teks" && !/\b(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|\d{4})\b/i.test(t)) {
    pertanyaan.push("Teksnya diambil dari rentang waktu kapan? Analisis isi menuntut periode yang ditetapkan lebih dulu.");
  }
  if (!lokasi && unit.unit !== "teks") {
    pertanyaan.push("Penelitiannya di mana? Sebutkan kampus, kantor, desa, atau kotanya.");
  }
  if (data.yakin === "terka" && tujuan.tujuan !== "isi") {
    pertanyaan.push(
      `Datanya mau diambil bagaimana? Belum disebut, jadi untuk sementara diisi ${data.data.map((d) => LABEL_DATA[d]).join(" dan ")}.`,
    );
  }
  if (
    berpasangan.includes(tujuan.tujuan) &&
    data.data.includes("kuesioner") &&
    !bilangan.populasi &&
    !bilangan.sampel
  ) {
    pertanyaan.push("Kira-kira berapa orang populasinya? Angka itu yang menentukan berapa responden yang harus dikejar.");
  }

  const ringkas = susunRingkas(masukan, tujuan.tujuan);
  const cukup = jumlahKata >= MINIMAL_KATA && Boolean(variabel.x || objek);

  return { masukan, temuan, pertanyaan, ringkas, cukup, jumlahKata };
}

function susunRingkas(m: Masukan, tujuan: Tujuan): string {
  const X = m.variabelX || "gagasan yang Anda sebut";
  const Y = m.variabelY || "hal yang terpengaruh";
  const siapa = m.objek ? ` pada ${m.objek}` : "";
  const tempat = m.lokasi ? ` di ${m.lokasi}` : "";
  const cara = m.data.map((d) => LABEL_DATA[d]).join(" dan ");

  const inti: Record<Tujuan, string> = {
    pengaruh: `apakah ${X} benar-benar memengaruhi ${Y}`,
    hubungan: `apakah ${X} berkaitan dengan ${Y}`,
    perbedaan: `apakah ${Y} berbeda antar kelompok yang Anda bandingkan`,
    gambaran: `bagaimana keadaan ${X} sebenarnya`,
    makna: `bagaimana ${X} dimaknai oleh orang yang mengalaminya`,
    proses: `bagaimana ${X} dijalankan${m.variabelY ? ` untuk ${Y}` : ""}`,
    isi: `apa yang sebenarnya terkandung dalam ${Y || "media yang Anda sebut"} ketika membicarakan ${X}`,
    evaluasi: `sejauh mana ${X} mencapai sasarannya`,
  };

  return `Yang Anda cari adalah ${inti[tujuan]}${siapa}${tempat}, dan datanya diambil lewat ${cara}.`;
}
