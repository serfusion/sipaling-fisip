// ============================================================
// CBT — ATURAN UJIAN, DI LUAR BASIS DATA
//
// Seluruh keputusan yang menentukan nasib nilai mahasiswa tinggal di sini:
// kapan ujian terbuka, soal mana yang keluar, dan berapa nilainya. Dipisahkan
// dari route dan dari React supaya dapat diuji tanpa satu pun server hidup —
// karena kesalahan di berkas ini tidak terlihat sampai sudah terlambat, ketika
// nilai sudah keluar dan mahasiswanya sudah pulang.
//
// Dua aturan yang tidak boleh dilanggar oleh apa pun yang memanggil berkas ini:
//
//   1. WAKTU DIHITUNG DARI SERVER. Jam di peramban mahasiswa dapat diputar
//      mundur; kalau batas waktunya dihitung di sana, ujian enam puluh menit
//      dapat dikerjakan semalaman.
//   2. KUNCI JAWABAN TIDAK PERNAH IKUT KE PERAMBAN sebelum ujiannya selesai.
//      Yang dikirim ke mahasiswa hanya pertanyaan dan pilihannya.
// ============================================================

/**
 * Baca satu parameter alamat sebagai bilangan bulat, atau null.
 *
 * Number(null) bernilai 0, dan Number.isInteger(0) bernilai true. Karena itu
 * `Number.isInteger(Number(params.get("x")))` LOLOS untuk parameter yang tidak
 * dikirim sama sekali — dan itu pernah membuat daftar peserta monitoring tidak
 * pernah tampil: ketiadaan parameter "attempt" terbaca sebagai attempt nomor
 * nol, cabang rincian satu mahasiswa diambil, dan jawabannya selalu 404.
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

/** Soal yang dapat dinilai mesin. Essay selalu menunggu dosen. */
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
 * teksnya akan membuat penilaian pecah begitu dosen membetulkan satu huruf di
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

/** Soal sebagaimana dikirim ke mahasiswa: TANPA kunci dan tanpa pembahasan. */
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

/**
 * Kapan attempt ini harus berakhir.
 *
 * Yang lebih dulu antara "durasi sejak mulai" dan "jam tutup ujian". Mahasiswa
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
 * Urutan soal harus tetap sama setiap kali halaman dimuat ulang: mahasiswa
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
 * Susun paket soal untuk satu mahasiswa.
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
      // mahasiswa dapat menyebut "nomor 3" dan pengawas tahu yang mana.
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
 * sampai mahasiswa.
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

export type HasilSatuSoal = { benar: boolean | null; poin: number };

/**
 * Nilai satu jawaban.
 *
 * `benar: null` berarti belum dapat dinilai mesin — essay, yang menunggu
 * dosen. Ia dibedakan dari `false` dengan sengaja: essay yang belum dikoreksi
 * bukan jawaban yang salah, dan menghitungnya sebagai salah membuat nilai
 * sementara mahasiswa terlihat jauh lebih rendah daripada yang sebenarnya.
 *
 * `petaPilihan` diperlukan karena pilihan yang dilihat mahasiswa sudah diacak:
 * yang ia pilih nomor 2 pada layarnya bisa jadi pilihan nomor 4 pada banknya.
 */
export function nilaiJawaban(soal: Soal, jawaban: string, petaPilihan?: number[]): HasilSatuSoal {
  const isi = String(jawaban ?? "").trim();
  if (soal.jenis === "essay") return { benar: null, poin: 0 };
  if (!isi) return { benar: false, poin: 0 };

  // Nomor pilihan yang dilihat mahasiswa dikembalikan ke nomor pada banknya.
  const keAsli = (tampil: number) =>
    petaPilihan && petaPilihan.length > tampil && tampil >= 0 ? petaPilihan[tampil] : tampil;

  if (soal.jenis === "pg" || soal.jenis === "benar_salah") {
    const dipilih = Number(isi);
    if (!Number.isInteger(dipilih) || dipilih < 0) return { benar: false, poin: 0 };
    const benar = String(keAsli(dipilih)) === String(soal.kunci).trim();
    return { benar, poin: benar ? soal.bobot : 0 };
  }

  if (soal.jenis === "pg_kompleks") {
    const kunci = uraiKunciJamak(soal.kunci);
    if (kunci.size === 0) return { benar: false, poin: 0 };

    const dipilih = new Set(
      isi.split(",")
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0)
        .map(keAsli),
    );

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
  /** Essay yang menunggu dosen. */
  tertunda: number;
  /**
   * Dijawab sebagian benar — hanya mungkin pada PG kompleks dan penjodohan.
   *
   * Dihitung terpisah karena memasukkannya ke "salah" membuat mahasiswa yang
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

// ---------- IDENTITAS MAHASISWA ----------

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
 * pemisah. Ini BUKAN pengenal yang aman dipakai sendirian — dua mahasiswa
 * boleh saja benar-benar bernama sama — melainkan penanda yang membuat
 * pendaftaran kedua dengan NIM berbeda tertahan untuk diperiksa manusia.
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
 * Penanda perangkat dari peramban mahasiswa.
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
 * NIM saja tidak cukup. Yang benar-benar terjadi di ruang ujian adalah dua hal
 * lain: satu orang mendaftar ulang dengan NIM yang digeser satu angka, dan satu
 * ponsel dipakai bergantian oleh dua orang yang duduk bersebelahan. Karena itu
 * nama dan perangkat ikut diperiksa.
 *
 * Yang TIDAK diperiksa di sini adalah baris milik NIM yang sama — orang yang
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
          `Nama ini sudah terdaftar pada ujian tersebut dengan NIM ${kembar.nim}. ` +
          "Bila NIM Anda salah ketik, hubungi pengawas.",
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
 * Periksa identitas mahasiswa yang hendak masuk.
 *
 * Tanpa akun, inilah satu-satunya gerbang. Ia sengaja longgar pada hal yang
 * tidak penting (huruf besar-kecil, spasi berlebih) dan ketat pada yang
 * penting (NIM harus angka, token harus persis), karena mahasiswa mengetiknya
 * sambil gugup lima menit sebelum ujian dimulai.
 */
export function periksaMasuk(
  masukan: { nama?: unknown; nim?: unknown; token?: unknown },
  ujian: { token: string | null; nimMin: number },
): HasilMasuk {
  const nama = rapikanNama(masukan.nama);
  if (nama.length < 3) return { ok: false, pesan: "Nama lengkap belum diisi." };

  const nim = rapikanNim(masukan.nim);
  if (!nim) return { ok: false, pesan: "NIM belum diisi." };
  if (nim.length < ujian.nimMin) {
    return { ok: false, pesan: `NIM sepertinya kurang lengkap, minimal ${ujian.nimMin} angka.` };
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
 * lecturerId saja, dan itu mengunci dosen yang akun profilnya belum
 * tersambung ke baris dosen: ia membuat ujian, lalu tidak pernah dapat
 * membukanya lagi karena lecturerId-nya null di kedua sisi.
 *
 * Nama pembuat dipakai sebagai cadangan HANYA untuk baris lama yang lahir
 * sebelum kolom created_by_id ada. Tanpa itu, semua ujian yang sudah terlanjur
 * tersimpan menjadi ujian tanpa pemilik yang tidak dapat diaktifkan siapa pun.
 */
export function pemilik(profile: Pemakai, ujian: Kepemilikan) {
  if (ujian.createdById) return ujian.createdById === profile.id;

  // Mulai di sini semuanya soal baris lama. Baris dosen dipakai HANYA bila
  // kedua sisi memilikinya; ujian lama yang lecturerId-nya kosong — dibuat
  // ketika akun dosennya belum tersambung — jatuh ke pencocokan nama, supaya
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
 * tidak berhak mengaktifkan dan non aktifkan, hanya dosen saja". Admin yang
 * ingin mengadakan ujian seleksi membuatnya sendiri — dan ujian itu miliknya,
 * jadi jalur ini tetap terbuka baginya tanpa menyentuh kelas dosen lain.
 */
export function bolehUbah(profile: Pemakai, ujian: Kepemilikan) {
  return pemilik(profile, ujian);
}

/** Boleh MENGHAPUS ujian. Pemiliknya, dan admin — itu bagian tugas mereka. */
export function bolehHapus(profile: Pemakai, ujian: Kepemilikan) {
  return PEMANTAU.includes(profile.role) || pemilik(profile, ujian);
}
