// ============================================================
// CBT — ATURAN UJIAN, DI LUAR BASIS DATA
//
// Seluruh keputusan yang menentukan nasib nilai peserta tinggal di sini:
// kapan ujian terbuka, soal mana yang keluar, dan berapa nilainya. Dipisahkan
// dari route dan dari React supaya dapat diuji tanpa satu pun server hidup —
// karena kesalahan di berkas ini tidak terlihat sampai sudah terlambat, ketika
// nilai sudah keluar dan pesertanya sudah pulang.
//
// Dua aturan yang tidak boleh dilanggar oleh apa pun yang memanggil berkas ini:
//
//   1. WAKTU DIHITUNG DARI SERVER. Jam di peramban peserta dapat diputar
//      mundur; kalau batas waktunya dihitung di sana, ujian enam puluh menit
//      dapat dikerjakan semalaman.
//   2. KUNCI JAWABAN TIDAK PERNAH IKUT KE PERAMBAN sebelum ujiannya selesai.
//      Yang dikirim ke peserta hanya pertanyaan dan pilihannya.
// ============================================================

/**
 * Baca satu parameter alamat sebagai bilangan bulat, atau null.
 *
 * Number(null) bernilai 0, dan Number.isInteger(0) bernilai true. Karena itu
 * `Number.isInteger(Number(params.get("x")))` LOLOS untuk parameter yang tidak
 * dikirim sama sekali — dan itu pernah membuat daftar peserta monitoring tidak
 * pernah tampil: ketiadaan parameter "attempt" terbaca sebagai attempt nomor
 * nol, cabang rincian satu peserta diambil, dan jawabannya selalu 404.
 *
 * Satu fungsi supaya kesalahan yang sama tidak lahir lagi di route berikutnya.
 */
export function angkaParam(nilai: string | null | undefined): number | null {
  if (nilai === null || nilai === undefined || String(nilai).trim() === "") return null;
  const angka = Number(nilai);
  return Number.isInteger(angka) && angka > 0 ? angka : null;
}

export type JenisSoal =
  | "pg"
  | "pg_kompleks"
  | "penjodohan"
  | "benar_salah"
  | "isian"
  | "essay";

export const JENIS_LABEL: Record<JenisSoal, string> = {
  pg: "Pilihan ganda",
  pg_kompleks: "PG kompleks (jawaban jamak)",
  penjodohan: "Penjodohan",
  benar_salah: "Benar / Salah",
  isian: "Isian singkat",
  essay: "Essay",
};

export const SEMUA_JENIS: JenisSoal[] = [
  "pg", "pg_kompleks", "penjodohan", "benar_salah", "isian", "essay",
];

/** Soal yang dapat dinilai mesin. Essay selalu menunggu pengajar. */
export function otomatis(jenis: JenisSoal) {
  return jenis !== "essay";
}

/** Jenis yang jawabannya dipilih dari daftar pilihan. */
export function berpilihan(jenis: JenisSoal) {
  return jenis === "pg" || jenis === "pg_kompleks" || jenis === "benar_salah" || jenis === "penjodohan";
}

/**
 * Satu pasangan pada soal penjodohan.
 *
 * `kanan` adalah INDEKS ke dalam daftar pilihan, bukan teksnya. Menyimpan
 * teksnya akan membuat penilaian pecah begitu pengajar membetulkan satu huruf di
 * kolom kanan — dan pecahnya diam-diam, sesudah ujian berlangsung.
 */
export type Pasangan = { kiri: string; kanan: number };

export type JenisMedia = "" | "gambar" | "video";

export type Media = {
  jenis: JenisMedia;
  /** Tautan gambar/video, atau berkas yang diunggah ke Supabase Storage. */
  url: string;
  keterangan: string;
};

export const MEDIA_KOSONG: Media = { jenis: "", url: "", keterangan: "" };

export type Soal = {
  id: number;
  jenis: JenisSoal;
  pertanyaan: string;
  /**
   * Pilihan untuk pg, pg_kompleks, dan benar_salah. Untuk penjodohan ia
   * adalah KOLOM KANAN — dan boleh memuat pengecoh yang tidak berpasangan
   * dengan apa pun. Kosong untuk isian dan essay.
   */
  pilihan: string[];
  /**
   * pg / benar_salah  : indeks pilihan benar, mis. "2"
   * pg_kompleks       : beberapa indeks dipisah koma, mis. "0,2,3"
   * isian             : teks, beberapa kemungkinan dipisah "|"
   * penjodohan        : tidak dipakai — kuncinya ada pada `pasangan`
   * essay             : kosong
   */
  kunci: string;
  /** Hanya untuk penjodohan. */
  pasangan: Pasangan[];
  media: Media;
  bobot: number;
  materi: string;
  tingkat: "mudah" | "sedang" | "sulit";
  pembahasan: string;
};

/** Soal sebagaimana dikirim ke peserta: TANPA kunci dan tanpa pembahasan. */
export type SoalTampil = {
  id: number;
  jenis: JenisSoal;
  pertanyaan: string;
  pilihan: string[];
  /**
   * Kolom kiri penjodohan. Hanya teksnya yang ikut — pasangannya tertinggal
   * di server, tempat satu-satunya yang boleh mengetahui kuncinya.
   */
  kiri: string[];
  media: Media;
  bobot: number;
  /** Peta urutan pilihan yang diacak ke urutan aslinya. */
  petaPilihan: number[];
};

/**
 * Keadaan satu peserta pada ujian yang sedang atau sudah berlangsung.
 *
 * Labelnya ada di sini, bukan di panel pengajar, karena keadaan yang sama
 * dibaca di dua tempat yang berbeda pemakainya: papan pantau di layar, dan
 * berita acara yang dicetak lalu ditandatangani. Dua tempat yang mengarang
 * labelnya sendiri pada akhirnya akan menyebut keadaan yang sama dengan dua
 * nama — pada dokumen yang justru dipakai ketika hasil ujian dipersoalkan.
 */
export type StatusPeserta = "berjalan" | "selesai" | "waktu_habis";

export const STATUS_PESERTA_LABEL: Record<StatusPeserta, string> = {
  berjalan: "Mengerjakan",
  selesai: "Selesai",
  waktu_habis: "Waktu habis",
};

/**
 * Label keadaan peserta dari untai apa pun yang tersimpan.
 *
 * Status dibaca dari kolom varchar, jadi nilai dari versi lama basis data
 * mungkin tidak dikenal lagi. Yang tidak dikenal disebut "Selesai" — sama
 * seperti papan pantau — bukan dibiarkan kosong pada berita acara.
 */
export function labelStatusPeserta(status: string): string {
  return STATUS_PESERTA_LABEL[status as StatusPeserta] ?? STATUS_PESERTA_LABEL.selesai;
}

export type StatusUjian = "draf" | "menunggu" | "terjadwal" | "berlangsung" | "selesai";

export const STATUS_LABEL: Record<StatusUjian, string> = {
  draf: "Draf",
  menunggu: "Menunggu aktivasi",
  terjadwal: "Terjadwal",
  berlangsung: "Sedang berlangsung",
  selesai: "Selesai",
};

export type UjianWaktu = {
  /** Diaktifkan Super Admin / Admin. Tanpa ini ujian tidak pernah terbuka. */
  aktif: boolean;
  mulai: Date | null;
  selesai: Date | null;
};

/**
 * Status ujian pada satu saat.
 *
 * Pembukaannya MURNI dari jam. Admin menyetel "jam 10", dan pada jam sepuluh
 * ujiannya terbuka sendiri — tidak ada tombol yang harus ditekan seseorang
 * pada detik itu, karena orang yang harus menekan tombol pada detik tertentu
 * adalah titik gagal yang paling sering terjadi.
 */
export function statusUjian(u: UjianWaktu, sekarang: Date = new Date()): StatusUjian {
  if (!u.mulai || !u.selesai) return "draf";
  if (!u.aktif) return "menunggu";
  const kini = sekarang.getTime();
  if (kini < u.mulai.getTime()) return "terjadwal";
  if (kini > u.selesai.getTime()) return "selesai";
  return "berlangsung";
}

export function bolehMasuk(u: UjianWaktu, sekarang: Date = new Date()) {
  return statusUjian(u, sekarang) === "berlangsung";
}

// ============================================================
// PELAKSANAAN — SEKALI UJIAN INI BENAR-BENAR DIJALANKAN
//
// Satu ujian dapat dijalankan lebih dari sekali: ujian susulan, ujian ulang,
// atau jadwal yang digeser karena listrik padam. Yang tersimpan di basis data
// hanyalah SATU baris ujian dengan satu jendela jam, jadi tanpa penanda
// tambahan seluruh percobaan dari tahun ajaran lalu masih menempel pada ujian
// yang sama — dan menghabiskan jatah peserta pada pelaksanaan hari ini.
//
// Penandanya activatedAt. Ia disetel ulang ketika pengajar membuka ujian yang
// SEDANG TIDAK BERLANGSUNG, dan sengaja DIBIARKAN ketika ia hanya memperpanjang
// jam ujian yang sedang berjalan. Perbedaan itu yang penting:
//
//   ujian sudah tutup, dijadwalkan ulang  -> pelaksanaan baru, jatah kembali
//   ujian sedang berjalan, jamnya digeser -> pelaksanaan yang sama, jatah tetap
//
// Kalau yang kedua ikut dianggap baru, tiga puluh peserta yang sudah
// mengumpulkan pagi itu dapat masuk lagi dan mengerjakan ulang hanya karena
// pengajarnya menambah sepuluh menit.
// ============================================================

/** Ujian, dilihat dari sisi "sejak kapan pelaksanaan yang sekarang berlaku". */
export type Pelaksanaan = { activatedAt: Date | null };

/**
 * Apakah menyimpan jadwal sekarang berarti MEMULAI pelaksanaan yang baru.
 *
 * Jawabannya diambil dari keadaan ujian SEBELUM jadwal barunya disimpan:
 * selama ia sedang berlangsung, yang terjadi adalah pembetulan jam, bukan
 * pembukaan ujian yang baru.
 */
export function pelaksanaanBaru(statusSebelumnya: StatusUjian): boolean {
  return statusSebelumnya !== "berlangsung";
}

/** Detik nol pelaksanaan yang sedang berlaku. Belum diaktifkan berarti 0. */
export function batasPelaksanaan(ujian: Pelaksanaan): number {
  return ujian.activatedAt ? ujian.activatedAt.getTime() : 0;
}

/**
 * Percobaan yang termasuk pelaksanaan yang sekarang.
 *
 * Dipakai untuk menghitung jatah percobaan dan untuk memeriksa nama/perangkat
 * ganda. Keduanya soal "siapa yang sudah masuk HARI INI", bukan "siapa yang
 * pernah masuk sejak ujian ini dibuat".
 */
export function attemptPelaksanaanIni<T extends { startedAt: Date }>(
  riwayat: T[],
  ujian: Pelaksanaan,
): T[] {
  const batas = batasPelaksanaan(ujian);
  return riwayat.filter((a) => a.startedAt.getTime() >= batas);
}

/**
 * Percobaan yang masih benar-benar hidup: berstatus berjalan DAN batas
 * waktunya belum lewat.
 *
 * Dicari dari SELURUH riwayat, bukan dari pelaksanaan yang sekarang saja.
 * Peserta yang sedang mengerjakan ketika pengajarnya menekan "Perbarui jadwal"
 * harus menemukan lembar yang sama beserta sisa waktunya; kalau ia disaring
 * lebih dulu, layarnya berganti menjadi ujian baru yang kosong dan jawaban
 * yang sudah ia ketik seolah hilang.
 *
 * Yang berstatus berjalan tetapi waktunya sudah habis TIDAK dihitung hidup.
 * Baris seperti itu tertinggal dari peserta yang perambannya tertutup sebelum
 * sempat mengumpulkan, dan membukanya kembali berarti memberi tambahan waktu
 * kepada orang yang jam ujiannya sudah lewat.
 */
export function attemptHidup<T extends { status: string; deadlineAt: Date }>(
  riwayat: T[],
  sekarang: Date = new Date(),
): T | undefined {
  return riwayat.find(
    (a) => a.status === "berjalan" && a.deadlineAt.getTime() > sekarang.getTime(),
  );
}

/**
 * Kapan attempt ini harus berakhir.
 *
 * Yang lebih dulu antara "durasi sejak mulai" dan "jam tutup ujian". Peserta
 * yang masuk sepuluh menit sebelum ujian ditutup tidak mendapat satu jam penuh;
 * dan yang masuk di awal tidak dipotong oleh jam tutup yang masih jauh.
 */
export function batasWaktu(mulaiAttempt: Date, menit: number, tutupUjian: Date | null): Date {
  const dariDurasi = new Date(mulaiAttempt.getTime() + menit * 60_000);
  if (!tutupUjian) return dariDurasi;
  return dariDurasi.getTime() < tutupUjian.getTime() ? dariDurasi : tutupUjian;
}

export function sisaDetik(batas: Date, sekarang: Date = new Date()) {
  return Math.max(0, Math.floor((batas.getTime() - sekarang.getTime()) / 1000));
}

export function ejaWaktu(detik: number) {
  const aman = Math.max(0, Math.floor(detik));
  const jam = Math.floor(aman / 3600);
  const menit = Math.floor((aman % 3600) / 60);
  const sisa = aman % 60;
  const dua = (n: number) => String(n).padStart(2, "0");
  return jam > 0 ? `${dua(jam)}:${dua(menit)}:${dua(sisa)}` : `${dua(menit)}:${dua(sisa)}`;
}

// ---------- PENGACAKAN ----------

/**
 * Pengacak yang DAPAT DIULANG dari benihnya.
 *
 * Urutan soal harus tetap sama setiap kali halaman dimuat ulang: peserta
 * yang jaringannya putus lalu kembali harus menemukan soal nomor 7 yang sama,
 * bukan soal lain. Karena itu urutannya diturunkan dari benih yang disimpan
 * bersama attempt-nya, bukan diacak ulang tiap permintaan.
 */
export function acakBerbenih(benih: number) {
  let x = benih >>> 0 || 1;
  return () => {
    // xorshift32 — cukup untuk mengurutkan soal, dan sama di mana pun.
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 0x100000000;
  };
}

export function kocok<T>(daftar: T[], benih: number): T[] {
  const acak = acakBerbenih(benih);
  const hasil = [...daftar];
  for (let i = hasil.length - 1; i > 0; i -= 1) {
    const j = Math.floor(acak() * (i + 1));
    [hasil[i], hasil[j]] = [hasil[j], hasil[i]];
  }
  return hasil;
}

/** Benih acak untuk satu attempt. */
export function benihBaru() {
  return Math.floor(Math.random() * 0x7fffffff) + 1;
}

export type AturanAcak = { acakSoal: boolean; acakPilihan: boolean; jumlahSoal: number };

/**
 * Susun paket soal untuk satu peserta.
 *
 * Bank soal boleh jauh lebih banyak daripada yang dikerjakan; yang diambil
 * sejumlah `jumlahSoal`. Bila banknya lebih sedikit, yang ada dipakai semua —
 * ujian yang gagal terbuka karena banknya kurang satu soal jauh lebih buruk
 * daripada ujian yang soalnya sedikit.
 */
export function susunPaket(bank: Soal[], aturan: AturanAcak, benih: number): SoalTampil[] {
  const urut = aturan.acakSoal ? kocok(bank, benih) : [...bank];
  const jumlah = aturan.jumlahSoal > 0 ? Math.min(aturan.jumlahSoal, urut.length) : urut.length;
  const dipakai = urut.slice(0, jumlah);

  return dipakai.map((soal, index) => {
    const peta = soal.pilihan.map((_, i) => i);
    const petaPilihan =
      aturan.acakPilihan && soal.pilihan.length > 1 ? kocok(peta, benih + index + 1) : peta;
    return {
      id: soal.id,
      jenis: soal.jenis,
      pertanyaan: soal.pertanyaan,
      pilihan: petaPilihan.map((i) => soal.pilihan[i]),
      // Kolom kiri penjodohan TIDAK ikut diacak bersama kolom kanan. Yang
      // diacak hanya jawabannya; pertanyaannya tetap berurutan supaya
      // peserta dapat menyebut "nomor 3" dan pengawas tahu yang mana.
      kiri: soal.jenis === "penjodohan" ? soal.pasangan.map((p) => p.kiri) : [],
      media: soal.media,
      bobot: soal.bobot,
      petaPilihan,
    };
  });
}

// ---------- PENILAIAN ----------

/** Seragamkan jawaban isian singkat sebelum dibandingkan. */
export function rapikanIsian(teks: string) {
  return String(teks || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Baca kunci PG kompleks: "0,2,3" menjadi himpunan {0,2,3}.
 *
 * Tahan terhadap spasi, koma berlebih, dan tulisan yang bukan angka — berkas
 * impor dari Excel penuh dengan ketiganya.
 */
export function uraiKunciJamak(kunci: string): Set<number> {
  return new Set(
    String(kunci || "")
      .split(/[,;\s]+/)
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0),
  );
}

/**
 * Baca jawaban penjodohan.
 *
 * Bentuknya JSON objek "indeks kiri" → "indeks kanan yang dipilih", mis.
 * {"0":2,"1":0}. Jawaban yang rusak diperlakukan sebagai belum dijawab, bukan
 * sebagai galat: yang rusak biasanya jaringan, dan yang menanggungnya jangan
 * sampai peserta.
 */
export function uraiJodoh(jawaban: string): Map<number, number> {
  const hasil = new Map<number, number>();
  try {
    const isi = JSON.parse(String(jawaban || "{}")) as Record<string, unknown>;
    if (!isi || typeof isi !== "object" || Array.isArray(isi)) return hasil;
    for (const [kiri, kanan] of Object.entries(isi)) {
      const a = Number(kiri);
      const b = Number(kanan);
      if (Number.isInteger(a) && a >= 0 && Number.isInteger(b) && b >= 0) hasil.set(a, b);
    }
  } catch {
    // Bukan JSON. Dianggap belum dijawab.
  }
  return hasil;
}

/**
 * Apakah jawaban ini benar-benar kosong?
 *
 * Tidak cukup memeriksa tali kosong. Penjodohan yang belum disentuh sama
 * sekali tetap tersimpan sebagai "{}", dan itu BUKAN tali kosong — sehingga
 * tanpa pemeriksaan ini soal penjodohan yang tidak dikerjakan siapa pun
 * terbaca "sudah dijawab" pada palet nomor, pada penghitung "x dari y", dan
 * pada laporan.
 */
export function jawabanKosong(jenis: JenisSoal, jawaban: string): boolean {
  const isi = String(jawaban ?? "").trim();
  if (!isi) return true;
  if (jenis === "penjodohan") return uraiJodoh(isi).size === 0;
  if (jenis === "pg_kompleks") return uraiKunciJamak(isi).size === 0;
  return false;
}

// ---------- JAWABAN YANG DAPAT DIBACA ORANG ----------
//
// Jawaban dan kunci tersimpan sebagai NOMOR — "2,3" dan "0,2" — karena itulah
// satu-satunya bentuk yang tetap benar ketika pengajar membetulkan satu huruf
// pada teks pilihannya. Nomor itu benar untuk mesin penilai dan tidak berarti
// apa pun bagi orang: pengajar yang membuka lembar jawaban membaca
// "jawaban 2,3 / kunci 0,2", dua deret angka yang bahkan tidak dapat
// dibandingkan satu sama lain — yang pertama nomor pilihan DI LAYAR PESERTA
// (sudah teracak), yang kedua nomor pada bank soal.
//
// Karena itu penerjemahannya tinggal DI SINI, bersama mesin penilainya, bukan
// di panel React maupun di modul cetak: keduanya membaca jawaban yang sama dan
// keduanya harus mengurutkan pilihan dengan cara yang sama dengan yang dipakai
// ketika nilainya dihitung.

/**
 * Nomor pilihan yang DILIHAT peserta, dikembalikan ke nomornya pada bank soal.
 *
 * Satu fungsi untuk dua jalur yang wajib sepakat: yang menghitung nilai, dan
 * yang menampilkan jawabannya kembali kepada pengajar. Ketika keduanya
 * memetakan sendiri-sendiri, lembar jawaban dapat menyebut pilihan B sementara
 * yang dinilai benar pilihan D — dan yang dipercaya orang adalah lembarnya.
 */
export function keUrutanBank(petaPilihan: number[] | undefined, tampil: number): number {
  return petaPilihan && petaPilihan.length > tampil && tampil >= 0 ? petaPilihan[tampil] : tampil;
}

/**
 * Huruf pilihan: 0 menjadi "A".
 *
 * Di atas 26 pilihan ia beralih ke nomor. String.fromCharCode(65 + 26)
 * menghasilkan "[", dan lembar jawaban yang menyebut kunci "[" tidak dapat
 * dibaca siapa pun.
 */
export function hurufOpsi(indeks: number): string {
  if (!Number.isInteger(indeks) || indeks < 0) return "?";
  return indeks < 26 ? String.fromCharCode(65 + indeks) : `#${indeks + 1}`;
}

/** Secukupnya untuk menyebutkan jawaban — dipakai juga oleh soal hasil impor. */
export type SoalTerbaca = Pick<Soal, "jenis" | "pilihan" | "kunci" | "pasangan">;

/**
 * Satu pilihan sebagaimana disebut di lembar jawaban: "B. Kultivasi".
 *
 * Hurufnya mengikuti urutan BANK SOAL, bukan urutan yang dilihat peserta:
 * pilihan diacak berbeda untuk tiap peserta, jadi huruf yang dilihat peserta
 * tidak ada gunanya bagi pengajar yang membaca satu lembar demi satu lembar —
 * sedangkan huruf bank soal sama dengan yang tercetak pada naskah dan pada
 * daftar bank soal di layarnya.
 *
 * Benar/Salah dikecualikan: "A. Benar" menambah satu huruf yang tidak pernah
 * ditanyakan siapa pun.
 */
function sebutOpsi(soal: SoalTerbaca, indeks: number): string {
  const teks = String(soal.pilihan[indeks] ?? "").trim();
  if (soal.jenis === "benar_salah") return teks || hurufOpsi(indeks);
  return teks ? `${hurufOpsi(indeks)}. ${teks}` : hurufOpsi(indeks);
}

/** Pemisah antar jawaban jamak. Bukan koma: teks pilihan sendiri memuat koma. */
const PEMISAH = "; ";

/**
 * Jawaban peserta sebagai kalimat yang dapat dibaca pengajar.
 *
 * Mengembalikan untai kosong untuk jawaban yang kosong ATAU yang tidak dapat
 * dibaca lagi — sama dengan yang disimpulkan `jawabanKosong`, supaya lembar
 * jawaban tidak menyebut "tidak dijawab" pada butir yang berpoin, atau
 * sebaliknya.
 */
export function jawabanTerbaca(
  soal: SoalTerbaca,
  jawaban: string,
  petaPilihan?: number[],
): string {
  const isi = String(jawaban ?? "").trim();
  if (isi === "") return "";
  if (soal.jenis === "essay" || soal.jenis === "isian") return isi;

  if (soal.jenis === "pg" || soal.jenis === "benar_salah") {
    const tampil = Number(isi);
    if (!Number.isInteger(tampil) || tampil < 0) return "";
    return sebutOpsi(soal, keUrutanBank(petaPilihan, tampil));
  }

  if (soal.jenis === "pg_kompleks") {
    const dipilih = [...uraiKunciJamak(isi)]
      .map((n) => keUrutanBank(petaPilihan, n))
      .sort((a, b) => a - b);
    return dipilih.map((n) => sebutOpsi(soal, n)).join(PEMISAH);
  }

  if (soal.jenis === "penjodohan") {
    const dijawab = uraiJodoh(isi);
    if (dijawab.size === 0) return "";
    // Seluruh pasangan disebut, termasuk yang dilewati peserta. Menampilkan
    // hanya yang terjawab membuat lembar jawaban terlihat lengkap padahal dua
    // pasangan dibiarkan kosong — dan itulah yang ditanyakan ketika nilainya
    // dipersoalkan.
    return soal.pasangan
      .map((pas, urut) => {
        const pilih = dijawab.get(urut);
        const kanan = pilih === undefined ? "(kosong)" : sebutOpsi(soal, keUrutanBank(petaPilihan, pilih));
        return `${pas.kiri} → ${kanan}`;
      })
      .join(PEMISAH);
  }

  return isi;
}

/**
 * Kunci jawaban sebagai kalimat yang dapat dibaca pengajar.
 *
 * Kosong untuk essay — yang tidak punya kunci, dan kunci palsu di lembar
 * koreksi essay hanya akan disalahartikan sebagai jawaban yang dituntut.
 */
export function kunciTerbaca(soal: SoalTerbaca): string {
  if (soal.jenis === "essay") return "";

  if (soal.jenis === "isian") {
    // Beberapa kemungkinan dipisah "|" pada penyimpanannya. Yang dibaca
    // pengajar "agenda setting / pengaturan agenda", bukan pipanya.
    return String(soal.kunci || "")
      .split("|")
      .map((k) => k.trim())
      .filter(Boolean)
      .join(" / ");
  }

  if (soal.jenis === "penjodohan") {
    return soal.pasangan
      .map((pas) => `${pas.kiri} → ${sebutOpsi(soal, pas.kanan)}`)
      .join(PEMISAH);
  }

  if (soal.jenis === "pg_kompleks") {
    return [...uraiKunciJamak(soal.kunci)]
      .sort((a, b) => a - b)
      .map((n) => sebutOpsi(soal, n))
      .join(PEMISAH);
  }

  // Kunci kosong diperiksa SEBELUM Number(): Number("") bernilai 0, dan 0
  // adalah bilangan bulat yang sah — sehingga soal dari bank lama yang
  // kuncinya hilang akan menyebut pilihan A sebagai kunci, dengan tenang, pada
  // lembar yang dipakai mengoreksi.
  const mentah = String(soal.kunci ?? "").trim();
  if (mentah === "") return "";
  const nomor = Number(mentah);
  if (!Number.isInteger(nomor) || nomor < 0) return "";
  return sebutOpsi(soal, nomor);
}

export type HasilSatuSoal = { benar: boolean | null; poin: number };

/**
 * Empat keadaan yang boleh dipakai satu jawaban, beserta warnanya.
 *
 * Ada di sini — bukan di panelnya — karena label dan warna ini muncul di dua
 * layar yang berbeda dan dibaca orang yang berbeda pula, dan keduanya harus
 * mengatakan hal yang sama. Sebelumnya panel pengajar menyimpulkannya sendiri
 * dari `benar` saja, dan kesimpulannya keliru dua kali: jawaban benar sebagian
 * ikut disebut "Salah", dan warnanya dipinjam dari lencana status sehingga
 * yang salah justru tercetak HIJAU.
 *
 * `sebagian` hanya mungkin pada PG kompleks dan penjodohan, yang dinilai per
 * bagian. Ia sengaja tidak dilebur ke "salah": peserta yang benar tiga dari
 * empat pasangan mendapat poin, dan lembar yang mengatakan sebaliknya akan
 * digugat — dengan alasan yang benar.
 */
export type KeadaanJawab = "benar" | "sebagian" | "salah" | "tunggu";

export const KEADAAN_JAWAB_LABEL: Record<KeadaanJawab, string> = {
  benar: "Benar",
  sebagian: "Benar sebagian",
  salah: "Salah",
  tunggu: "Menunggu koreksi",
};

/**
 * Keadaan satu jawaban dari hasil penilaiannya.
 *
 * Urutan pemeriksaannya menentukan. `benar === null` diperiksa PALING DULU:
 * essay yang belum dikoreksi berpoin nol, dan diperiksa sesudah poinnya ia
 * akan terbaca "Salah" — vonis atas jawaban yang belum dibaca siapa pun.
 */
export function keadaanJawab(hasil: HasilSatuSoal): KeadaanJawab {
  if (hasil.benar === null) return "tunggu";
  if (hasil.benar) return "benar";
  return hasil.poin > 0 ? "sebagian" : "salah";
}

/**
 * Nilai satu jawaban.
 *
 * `benar: null` berarti belum dapat dinilai mesin — essay, yang menunggu
 * pengajar. Ia dibedakan dari `false` dengan sengaja: essay yang belum dikoreksi
 * bukan jawaban yang salah, dan menghitungnya sebagai salah membuat nilai
 * sementara peserta terlihat jauh lebih rendah daripada yang sebenarnya.
 *
 * `petaPilihan` diperlukan karena pilihan yang dilihat peserta sudah diacak:
 * yang ia pilih nomor 2 pada layarnya bisa jadi pilihan nomor 4 pada banknya.
 */
export function nilaiJawaban(soal: Soal, jawaban: string, petaPilihan?: number[]): HasilSatuSoal {
  const isi = String(jawaban ?? "").trim();
  if (soal.jenis === "essay") return { benar: null, poin: 0 };
  if (!isi) return { benar: false, poin: 0 };

  // Nomor pilihan yang dilihat peserta dikembalikan ke nomor pada banknya.
  // Lewat fungsi bersama, bukan rumus yang ditulis ulang di sini: lembar
  // jawaban yang dibaca pengajar memetakannya dengan fungsi yang sama, dan
  // dua rumus yang sama pada akhirnya akan berbeda.
  const keAsli = (tampil: number) => keUrutanBank(petaPilihan, tampil);

  if (soal.jenis === "pg" || soal.jenis === "benar_salah") {
    const dipilih = Number(isi);
    if (!Number.isInteger(dipilih) || dipilih < 0) return { benar: false, poin: 0 };
    const benar = String(keAsli(dipilih)) === String(soal.kunci).trim();
    return { benar, poin: benar ? soal.bobot : 0 };
  }

  if (soal.jenis === "pg_kompleks") {
    const kunci = uraiKunciJamak(soal.kunci);
    if (kunci.size === 0) return { benar: false, poin: 0 };

    // Dibaca pembaca yang sama dengan yang membaca kuncinya, dan yang sama
    // pula dengan yang dipakai `jawabanKosong` serta lembar jawaban pengajar.
    const dipilih = new Set([...uraiKunciJamak(isi)].map(keAsli));

    let tepat = 0;
    let keliru = 0;
    for (const n of dipilih) (kunci.has(n) ? (tepat += 1) : (keliru += 1));

    // Penskoran sebagian ala AKM: yang keliru mengurangi yang tepat, dan
    // nilainya tidak pernah turun di bawah nol. Tanpa pengurangan itu,
    // mencentang SELURUH pilihan selalu menghasilkan nilai penuh — dan soal
    // pilihan jamak berhenti mengukur apa pun.
    const bagian = Math.max(0, tepat - keliru) / kunci.size;
    const penuh = tepat === kunci.size && keliru === 0;
    return { benar: penuh, poin: Math.round(bagian * soal.bobot * 100) / 100 };
  }

  if (soal.jenis === "penjodohan") {
    const jumlah = soal.pasangan.length;
    if (jumlah === 0) return { benar: false, poin: 0 };
    const dijawab = uraiJodoh(isi);

    let tepat = 0;
    for (const [urut, pasang] of soal.pasangan.entries()) {
      const pilih = dijawab.get(urut);
      if (pilih === undefined) continue;
      if (keAsli(pilih) === pasang.kanan) tepat += 1;
    }

    // Penjodohan dinilai per pasangan. Semua-atau-tidak sama sekali membuat
    // satu kekeliruan menghapus empat jawaban yang benar.
    return {
      benar: tepat === jumlah,
      poin: Math.round((tepat / jumlah) * soal.bobot * 100) / 100,
    };
  }

  // Isian singkat: beberapa kunci dipisah "|", cocok bila salah satunya sama.
  const kunci = String(soal.kunci || "")
    .split("|")
    .map(rapikanIsian)
    .filter(Boolean);
  const benar = kunci.includes(rapikanIsian(isi));
  return { benar, poin: benar ? soal.bobot : 0 };
}

export type RingkasNilai = {
  /** 0–100. */
  nilai: number;
  benar: number;
  salah: number;
  kosong: number;
  /** Essay yang menunggu pengajar. */
  tertunda: number;
  /**
   * Dijawab sebagian benar — hanya mungkin pada PG kompleks dan penjodohan.
   *
   * Dihitung terpisah karena memasukkannya ke "salah" membuat peserta yang
   * benar tiga dari empat pasangan terbaca gagal total pada laporan, padahal
   * nilainya sudah menghitungnya dengan benar.
   */
  sebagian: number;
  poin: number;
  poinMaks: number;
  lulus: boolean;
};

/**
 * Hitung nilai satu attempt.
 *
 * Nilainya persentase dari bobot, bukan dari jumlah soal: soal essay 20 poin
 * dan soal pilihan ganda 1 poin tidak boleh dihitung sederajat.
 */
export function hitungNilai(
  soal: Soal[],
  jawaban: Record<number, string>,
  peta: Record<number, number[]>,
  passing: number,
  poinEssay: Record<number, number> = {},
): RingkasNilai {
  let benar = 0;
  let salah = 0;
  let kosong = 0;
  let tertunda = 0;
  let sebagian = 0;
  let poin = 0;
  let poinMaks = 0;

  for (const s of soal) {
    poinMaks += s.bobot;
    const mentah = String(jawaban[s.id] ?? "").trim();
    const isi = jawabanKosong(s.jenis, mentah) ? "" : mentah;

    if (s.jenis === "essay") {
      if (!isi) {
        kosong += 1;
        continue;
      }
      const diberi = poinEssay[s.id];
      if (typeof diberi === "number") {
        poin += Math.max(0, Math.min(diberi, s.bobot));
        if (diberi > 0) benar += 1;
        else salah += 1;
      } else {
        tertunda += 1;
      }
      continue;
    }

    if (!isi) {
      kosong += 1;
      continue;
    }
    const hasil = nilaiJawaban(s, isi, peta[s.id]);
    poin += hasil.poin;
    if (hasil.benar) benar += 1;
    else if (hasil.poin > 0) sebagian += 1;
    else salah += 1;
  }

  const nilai = poinMaks > 0 ? Math.round((poin / poinMaks) * 1000) / 10 : 0;
  return { nilai, benar, salah, kosong, tertunda, sebagian, poin, poinMaks, lulus: nilai >= passing };
}

// ---------- IDENTITAS PESERTA ----------

export function rapikanNim(masukan: unknown) {
  return String(masukan ?? "").replace(/\D/g, "").slice(0, 20);
}

export function rapikanNama(masukan: unknown) {
  return String(masukan ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function rapikanToken(masukan: unknown) {
  return String(masukan ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

/**
 * Nama yang sudah diseragamkan, untuk membandingkan dua pendaftaran.
 *
 * "Budi  Santoso", "budi santoso", dan "BUDI SANTOSO." adalah satu orang.
 * Gelar dan tanda baca dibuang; yang tersisa hanya huruf dan satu spasi
 * pemisah. Ini BUKAN pengenal yang aman dipakai sendirian — dua peserta
 * boleh saja benar-benar bernama sama — melainkan penanda yang membuat
 * pendaftaran kedua dengan nomor berbeda tertahan untuk diperiksa manusia.
 */
export function kunciNama(masukan: unknown) {
  return String(masukan ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Penanda perangkat dari peramban peserta.
 *
 * Dibersihkan keras, karena nilainya datang dari luar dan langsung masuk ke
 * basis data: hanya huruf, angka, dan tanda hubung, paling panjang 64.
 */
export function rapikanPerangkat(masukan: unknown) {
  return String(masukan ?? "")
    .replace(/[^A-Za-z0-9-]/g, "")
    .slice(0, 64);
}

export type RiwayatMasuk = {
  nim: string;
  nameKey: string;
  deviceId: string;
  status: string;
};

export type HasilGanda = { ok: true } | { ok: false; pesan: string };

/**
 * Satu orang, satu kali — diperiksa dari tiga sisi.
 *
 * Nomor peserta saja tidak cukup. Yang benar-benar terjadi di ruang ujian ada
 * dua: satu orang mendaftar ulang dengan nomor yang digeser satu angka, dan satu
 * ponsel dipakai bergantian oleh dua orang yang duduk bersebelahan. Karena itu
 * nama dan perangkat ikut diperiksa.
 *
 * Yang TIDAK diperiksa di sini adalah baris milik nomor yang sama — orang yang
 * kembali ke ujiannya sendiri sesudah ponselnya mati bukan peserta kedua, dan
 * jalur itu ditangani pemanggilnya sebelum fungsi ini dipakai.
 *
 * Perangkat hanya diperiksa bila ujiannya memintanya. Di laboratorium, satu
 * komputer memang dipakai bergantian sepanjang hari, dan aturan yang benar di
 * satu ruangan menjadi salah di ruangan sebelah.
 */
export function periksaGanda(
  calon: { nim: string; nameKey: string; deviceId: string },
  riwayat: RiwayatMasuk[],
  aturan: { satuPerangkat: boolean } = { satuPerangkat: true },
): HasilGanda {
  const lain = riwayat.filter((r) => r.nim !== calon.nim);

  if (calon.nameKey) {
    const kembar = lain.find((r) => r.nameKey && r.nameKey === calon.nameKey);
    if (kembar) {
      return {
        ok: false,
        pesan:
          `Nama ini sudah terdaftar pada ujian tersebut dengan nomor ${kembar.nim}. ` +
          "Bila nomor peserta Anda salah ketik, hubungi pengawas.",
      };
    }
  }

  if (aturan.satuPerangkat && calon.deviceId) {
    const sama = lain.find((r) => r.deviceId && r.deviceId === calon.deviceId);
    if (sama) {
      return {
        ok: false,
        pesan:
          "Perangkat ini sudah dipakai peserta lain untuk ujian tersebut. " +
          "Gunakan perangkat Anda sendiri, atau minta pengawas membukakannya.",
      };
    }
  }

  return { ok: true };
}

export type HasilMasuk = { ok: true; nim: string; nama: string } | { ok: false; pesan: string };

/**
 * Periksa identitas peserta yang hendak masuk.
 *
 * Tanpa akun, inilah satu-satunya gerbang. Ia sengaja longgar pada hal yang
 * tidak penting (huruf besar-kecil, spasi berlebih) dan ketat pada yang
 * penting (nomornya harus angka, token harus persis), karena peserta mengetiknya
 * sambil gugup lima menit sebelum ujian dimulai.
 */
export function periksaMasuk(
  masukan: { nama?: unknown; nim?: unknown; token?: unknown },
  ujian: { token: string | null; nimMin: number },
): HasilMasuk {
  const nama = rapikanNama(masukan.nama);
  if (nama.length < 3) return { ok: false, pesan: "Nama lengkap belum diisi." };

  const nim = rapikanNim(masukan.nim);
  if (!nim) return { ok: false, pesan: "Nomor peserta belum diisi." };
  if (nim.length < ujian.nimMin) {
    return { ok: false, pesan: `Nomor peserta sepertinya kurang lengkap, minimal ${ujian.nimMin} angka.` };
  }

  if (ujian.token) {
    const token = rapikanToken(masukan.token);
    if (!token) return { ok: false, pesan: "Ujian ini memakai kode. Masukkan kode ujiannya." };
    if (token !== rapikanToken(ujian.token)) return { ok: false, pesan: "Kode ujian tidak cocok." };
  }

  return { ok: true, nim, nama };
}

/** Kode ujian acak yang mudah dibacakan di depan kelas. */
const ABJAD = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function kodeUjianBaru(panjang = 6) {
  let hasil = "";
  for (let i = 0; i < panjang; i += 1) {
    hasil += ABJAD[Math.floor(Math.random() * ABJAD.length)];
  }
  return hasil;
}

// ---------- ANALISIS ----------

export type AnalisisSoal = {
  id: number;
  pertanyaan: string;
  dijawab: number;
  benar: number;
  persen: number;
  kategori: "mudah" | "sedang" | "sulit";
  perluDitinjau: boolean;
};

/**
 * Seberapa sukar tiap soal menurut hasil sesungguhnya.
 *
 * Soal yang dijawab benar di bawah 30% ditandai perlu ditinjau: bisa jadi
 * memang sulit, bisa jadi pertanyaannya membingungkan atau kuncinya salah —
 * dan yang terakhir itulah yang paling mahal bila tidak ketahuan.
 */
export function analisisSoal(
  soal: Array<{ id: number; pertanyaan: string }>,
  hasil: Array<{ questionId: number; benar: boolean | null }>,
): AnalisisSoal[] {
  return soal.map((s) => {
    const miliknya = hasil.filter((h) => h.questionId === s.id && h.benar !== null);
    const dijawab = miliknya.length;
    const benar = miliknya.filter((h) => h.benar).length;
    const persen = dijawab > 0 ? Math.round((benar / dijawab) * 100) : 0;
    const kategori = persen >= 70 ? "mudah" : persen >= 40 ? "sedang" : "sulit";
    return {
      id: s.id,
      pertanyaan: s.pertanyaan,
      dijawab,
      benar,
      persen,
      kategori,
      perluDitinjau: dijawab >= 5 && persen < 30,
    };
  });
}

export type Statistik = {
  peserta: number;
  rata: number;
  tertinggi: number;
  terendah: number;
  median: number;
  lulus: number;
  tidakLulus: number;
  persenLulus: number;
};

export function statistikNilai(nilai: number[], passing: number): Statistik {
  if (nilai.length === 0) {
    return { peserta: 0, rata: 0, tertinggi: 0, terendah: 0, median: 0, lulus: 0, tidakLulus: 0, persenLulus: 0 };
  }
  const urut = [...nilai].sort((a, b) => a - b);
  const jumlah = urut.reduce((a, b) => a + b, 0);
  const tengah = urut.length % 2 === 1
    ? urut[(urut.length - 1) / 2]
    : (urut[urut.length / 2 - 1] + urut[urut.length / 2]) / 2;
  const lulus = nilai.filter((n) => n >= passing).length;
  const bulat = (n: number) => Math.round(n * 10) / 10;
  return {
    peserta: nilai.length,
    rata: bulat(jumlah / nilai.length),
    tertinggi: urut[urut.length - 1],
    terendah: urut[0],
    median: bulat(tengah),
    lulus,
    tidakLulus: nilai.length - lulus,
    persenLulus: Math.round((lulus / nilai.length) * 100),
  };
}

// ---------- WEWENANG: SIAPA MEMEGANG APA ----------

/**
 * Sekeping profil, secukupnya untuk memutuskan wewenang.
 *
 * Sengaja BUKAN SessionProfile dari supabase-server: mengimpor jenis dari sana
 * menarik seluruh modul sesi ke dalam berkas yang seharusnya bebas basis data,
 * dan dengan itu hilang pula kemungkinan mengujinya. Bentuknya cocok secara
 * struktural, jadi SessionProfile tetap dapat diberikan apa adanya.
 */
export type Pemakai = {
  id: string;
  fullName: string;
  role: string;
  lecturerId: number | null;
};

/** Role yang boleh memakai CBT sama sekali. Admin bagian sengaja di luar. */
export const CBT_ROLES = ["super_admin", "admin", "dosen"];
/** Role yang boleh MEMANTAU seluruh ujian, termasuk milik orang lain. */
export const PEMANTAU = ["super_admin", "admin"];

export function bolehCbt(profile: Pemakai | null) {
  return Boolean(profile && CBT_ROLES.includes(profile.role));
}

export type Kepemilikan = {
  lecturerId: number | null;
  createdBy: string;
  createdById: string | null;
};

/**
 * Ujian ini miliknya sendiri?
 *
 * Kepemilikan ditentukan id profil pembuatnya. Semula ia dilihat dari
 * lecturerId saja, dan itu mengunci pengajar yang akun profilnya belum
 * tersambung ke baris pengajar: ia membuat ujian, lalu tidak pernah dapat
 * membukanya lagi karena lecturerId-nya null di kedua sisi.
 *
 * Nama pembuat dipakai sebagai cadangan HANYA untuk baris lama yang lahir
 * sebelum kolom created_by_id ada. Tanpa itu, semua ujian yang sudah terlanjur
 * tersimpan menjadi ujian tanpa pemilik yang tidak dapat diaktifkan siapa pun.
 */
export function pemilik(profile: Pemakai, ujian: Kepemilikan) {
  if (ujian.createdById) return ujian.createdById === profile.id;

  // Mulai di sini semuanya soal baris lama. Baris pengajar dipakai HANYA bila
  // kedua sisi memilikinya; ujian lama yang lecturerId-nya kosong — dibuat
  // ketika akun pengajarnya belum tersambung — jatuh ke pencocokan nama, supaya
  // penyambungan yang datang belakangan tidak merampas ujiannya sendiri.
  if (profile.role === "dosen" && profile.lecturerId !== null && ujian.lecturerId !== null) {
    return ujian.lecturerId === profile.lecturerId;
  }
  return ujian.createdBy === profile.fullName;
}

/**
 * Boleh MELIHAT ujian ini — daftar peserta, nilai, isi soal.
 *
 * Admin dan Super Admin memantau semuanya. Itu memang tugas mereka, dan
 * memantau tidak mengubah apa pun.
 */
export function bolehPantau(profile: Pemakai, ujian: Kepemilikan) {
  return PEMANTAU.includes(profile.role) || pemilik(profile, ujian);
}

/**
 * Boleh MENGUBAH ujian ini — soal, jadwal, aktivasi.
 *
 * Hanya pemiliknya. Permintaan pemilik portal tegas: "admin dan super admin
 * tidak berhak mengaktifkan dan non aktifkan, hanya pengajar saja". Admin yang
 * ingin mengadakan ujian seleksi membuatnya sendiri — dan ujian itu miliknya,
 * jadi jalur ini tetap terbuka baginya tanpa menyentuh kelas pengajar lain.
 */
export function bolehUbah(profile: Pemakai, ujian: Kepemilikan) {
  return pemilik(profile, ujian);
}

/** Boleh MENGHAPUS ujian. Pemiliknya, dan admin — itu bagian tugas mereka. */
export function bolehHapus(profile: Pemakai, ujian: Kepemilikan) {
  return PEMANTAU.includes(profile.role) || pemilik(profile, ujian);
}

/**
 * Boleh menyalakan atau mematikan KAMERA PENGAWAS.
 *
 * Admin dan Super Admin saja — TIDAK termasuk pengajar pemilik ujiannya, dan
 * itulah satu-satunya wewenang di berkas ini yang justru menjauh dari pemilik.
 *
 * Alasannya berbeda dari wewenang yang lain. Yang lain soal siapa yang tahu
 * kelasnya; yang ini soal merekam wajah orang. Menyalakan kamera pada ujian
 * adalah keputusan lembaga, bukan keputusan satu pengajar atas kelasnya sendiri —
 * yang menanggung akibatnya bila keliru adalah lembaganya, bukan pengajar itu.
 * Karena itu ia dipegang pihak yang sama yang memegang kebijakan portal.
 *
 * Admin bagian — umum, akademik, prodi, PDDIKTI, perpustakaan, laboratorium —
 * tidak termasuk, sama seperti mereka tidak menyentuh menu CBT sama sekali.
 */
export function bolehSaklarKamera(profile: Pemakai | null) {
  return Boolean(profile && PEMANTAU.includes(profile.role));
}
