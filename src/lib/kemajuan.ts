// ============================================================
// KEMAJUAN UNGGAHAN — angka dan kalimatnya
//
// Sebelum berkas ini ada, satu-satunya kabar yang didapat mahasiswa saat
// mengunggah empat PDF skripsi adalah satu baris teks yang berganti empat
// kali. Berkas 25 MB pada jaringan ponsel memakan waktu bermenit-menit, dan
// selama itu layar tidak bergerak sama sekali — tidak ada cara membedakan
// "sedang naik" dari "sudah menggantung".
//
// Yang dihitung di sini dipakai dua tempat: kalimat status (dibacakan pembaca
// layar) dan bilah kemajuan (dilihat mata). Keduanya membaca angka yang sama
// supaya tidak mungkin berselisih.
//
// SENGAJA bebas dari React, DOM, dan jaringan supaya dapat diuji langsung.
// ============================================================

export type TahapUnggah =
  /** Meminta izin unggah untuk satu bagian. Singkat, tetapi bukan nol pada jaringan lambat. */
  | "izin"
  /** Bita berkas sedang berpindah ke penyimpanan. Inilah tahap yang panjang. */
  | "unggah"
  /** Seluruh berkas sudah di penyimpanan; formulirnya sedang disimpan. */
  | "simpan";

export type Kemajuan = {
  tahap: TahapUnggah;
  /** Berkas ke-berapa yang sedang dikerjakan, mulai dari 0. */
  indeks: number;
  /** Jumlah berkas yang harus naik. */
  total: number;
  /** Nama berkas yang sedang dikerjakan. */
  nama: string;
  /** Bita yang sudah terkirim, dihitung untuk SELURUH berkas. */
  bita: number;
  /** Jumlah bita seluruh berkas. */
  bitaTotal: number;
  /** Bita yang sudah terkirim untuk berkas yang sedang dikerjakan saja. */
  bitaBerkas: number;
  /** Percobaan penyimpanan yang sedang berjalan (1 untuk yang pertama). */
  percobaan: number;
  /** Berapa kali penyimpanan akan dicoba sebelum menyerah. */
  maksPercobaan: number;
};

export function kemajuanAwal(total: number, bitaTotal: number, nama = ""): Kemajuan {
  return {
    tahap: "izin",
    indeks: 0,
    total,
    nama,
    bita: 0,
    bitaTotal,
    bitaBerkas: 0,
    percobaan: 1,
    maksPercobaan: 1,
  };
}

/**
 * Persentase bita yang sudah terkirim, 0 sampai 100.
 *
 * Dibulatkan ke bawah supaya tidak pernah menulis "100%" ketika masih ada
 * bita yang belum sampai — angka 100 yang bertahan lama justru membuat orang
 * menyimpulkan portalnya menggantung.
 */
export function persenBita(bita: number, bitaTotal: number) {
  if (!Number.isFinite(bita) || !Number.isFinite(bitaTotal) || bitaTotal <= 0) return 0;
  const persen = Math.floor((bita / bitaTotal) * 100);
  return Math.max(0, Math.min(100, persen));
}

/**
 * Persentase yang ditampilkan bilah kemajuan.
 *
 * Tahap "simpan" TIDAK pernah menampilkan 100: penyimpanan pengajuan belum
 * tentu selesai, dan bilah yang penuh sementara layar masih menunggu adalah
 * bentuk lain dari berbohong. Ia berhenti di 99 sampai jawabannya datang.
 */
export function persenTampil(k: Kemajuan) {
  if (k.tahap === "simpan") return 99;
  return persenBita(k.bita, k.bitaTotal);
}

/** Ukuran berkas yang mudah dibaca, dengan koma seperti kebiasaan Indonesia. */
export function ejaBita(bita: number) {
  if (!Number.isFinite(bita) || bita <= 0) return "0 KB";
  if (bita < 1024 * 1024) return `${Math.max(1, Math.round(bita / 1024))} KB`;
  return `${(bita / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Kalimat status untuk satu keadaan kemajuan.
 *
 * `kerja` membedakan pengajuan dari revisi: kalimatnya menyebut yang sedang
 * disimpan, bukan kata umum "data", supaya mahasiswa tahu proses mana yang
 * sedang berjalan bila ia membuka dua tab sekaligus.
 */
export function kalimatKemajuan(k: Kemajuan, kerja: "pengajuan" | "revisi" = "pengajuan") {
  const nomor = Math.min(k.indeks + 1, k.total);

  // Pengajuan tanpa unggahan bagian (layanan biasa, absensi) tidak punya berkas
  // untuk dihitung. Ia tidak boleh pernah menulis "berkas 1 dari 0", apa pun
  // tahap yang sedang tercatat.
  if (k.total === 0) {
    const dasarKosong = `Mengirim ${kerja}…`;
    return k.percobaan > 1 ? `${dasarKosong} (percobaan ${k.percobaan} dari ${k.maksPercobaan})` : dasarKosong;
  }

  if (k.tahap === "izin") {
    return `Menyiapkan berkas ${nomor} dari ${k.total}…`;
  }
  if (k.tahap === "unggah") {
    const persen = persenBita(k.bita, k.bitaTotal);
    return `Mengunggah berkas ${nomor} dari ${k.total} — ${k.nama} (${persen}%)`;
  }
  const dasar = `Semua berkas terunggah. Menyimpan ${kerja}…`;
  if (k.percobaan > 1) {
    return `${dasar} (percobaan ${k.percobaan} dari ${k.maksPercobaan})`;
  }
  return dasar;
}

/**
 * Keadaan satu baris berkas pada daftar kemajuan.
 *
 * Yang sudah lewat ditandai selesai, yang sedang dikerjakan menunjukkan
 * persentasenya sendiri, sisanya menunggu. Tahap "simpan" berarti keempatnya
 * sudah sampai — tanpa aturan ini berkas terakhir tetap tampak "sedang naik"
 * selama penyimpanan berlangsung.
 */
export function keadaanBerkas(k: Kemajuan, urut: number): "selesai" | "jalan" | "tunggu" {
  if (k.tahap === "simpan") return "selesai";
  if (urut < k.indeks) return "selesai";
  if (urut === k.indeks) return "jalan";
  return "tunggu";
}
