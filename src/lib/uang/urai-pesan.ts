// ============================================================
// PENGURAI PESAN
//
// Satu baris yang diketik orang, mis. "+honor guru 100k" atau
// "-beli nasi uduk 10rb", diubah menjadi satu catatan utuh: arah, nominal,
// tanggal, kategori, dan sisa kalimatnya sebagai keterangan.
//
// Aturan yang dipegang di sini:
//   1. Tanda + dan - di depan SELALU menang atas tebakan apa pun.
//   2. Tanpa tanda, arah ditebak dari kata kerjanya (lihat kategori.ts).
//   3. Nominal yang memakai satuan (10k, 10rb, 1,5jt) atau titik ribuan
//      dimenangkan atas angka telanjang, supaya "beli 3 kopi 45k" tidak
//      pernah tercatat tiga rupiah.
//   4. Apa pun yang tidak terbaca dikembalikan sebagai alasan yang bisa
//      dibacakan ke pengirimnya, BUKAN dibuang diam-diam.
//
// Tidak menyentuh database, jadi aman diimpor dari browser.
// ============================================================

import { type Arah, kategoriDariTanda, tebakArah, tebakKategori } from "./kategori";

/** Selisih WIB terhadap UTC. Portal ini dipakai dari satu zona waktu saja. */
const WIB = 7 * 60 * 60 * 1000;

/** Tanggal WIB dalam bentuk "YYYY-MM-DD". */
export function tanggalWib(waktu: Date = new Date()): string {
  return new Date(waktu.getTime() + WIB).toISOString().slice(0, 10);
}

/** Bulan WIB dalam bentuk "YYYY-MM". */
export function bulanWib(waktu: Date = new Date()): string {
  return tanggalWib(waktu).slice(0, 7);
}

function geserHari(jumlah: number, dari: Date = new Date()) {
  return tanggalWib(new Date(dari.getTime() + jumlah * 24 * 60 * 60 * 1000));
}

const SATUAN: Record<string, number> = {
  k: 1_000,
  rb: 1_000,
  ribu: 1_000,
  ribuan: 1_000,
  jt: 1_000_000,
  juta: 1_000_000,
  jutaan: 1_000_000,
  miliar: 1_000_000_000,
  milyar: 1_000_000_000,
};

// "m" sengaja TIDAK didaftarkan. Di percakapan sehari-hari ia bisa berarti
// juta, bisa berarti miliar, dan menebak salah satunya berarti mencatat
// angka yang meleset seribu kali lipat.

const POLA_NOMINAL =
  /(rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,2})?)(\s*)(k|rb|ribu|ribuan|jt|juta|jutaan|miliar|milyar)?/gi;

/** Nominal terbesar yang masih dianggap masuk akal: seratus miliar rupiah. */
export const NOMINAL_MAKS = 100_000_000_000;

type Calon = { mulai: number; akhir: number; nilai: number; bertanda: boolean };

function keAngka(mentah: string, satuan: string | undefined): number | null {
  const teks = mentah.trim();
  const pengali = satuan ? SATUAN[satuan.toLowerCase()] ?? 1 : 1;

  let angka: number;
  if (/^\d{1,3}([.,]\d{3})+$/.test(teks)) {
    // Titik atau koma sebagai pemisah ribuan: 100.000 dan 1,250,000.
    angka = Number(teks.replace(/[.,]/g, ""));
  } else if (/^\d+[.,]\d+$/.test(teks)) {
    // Pecahan: 1,5jt dan 1.5jt sama-sama satu setengah juta.
    angka = Number(teks.replace(",", "."));
  } else {
    angka = Number(teks);
  }

  if (!Number.isFinite(angka)) return null;
  return Math.round(angka * pengali);
}

/**
 * Kumpulkan semua angka yang mungkin menjadi nominal, lengkap dengan
 * letaknya, supaya potongan yang menang bisa dibuang dari keterangan.
 */
function calonNominal(teks: string): Calon[] {
  const hasil: Calon[] = [];
  for (const cocok of teks.matchAll(POLA_NOMINAL)) {
    const mulai = cocok.index ?? 0;
    const utuh = cocok[0];
    const akhir = mulai + utuh.length;

    // Angka yang menempel pada huruf bukan nominal: "s1", "covid19", "5kg".
    const sebelum = teks[mulai - 1];
    if (sebelum && /[a-z0-9]/i.test(sebelum)) continue;
    const sesudah = teks[akhir];
    if (sesudah && /[a-z]/i.test(sesudah)) continue;

    const nilai = keAngka(cocok[2], cocok[4]);
    if (nilai === null || nilai <= 0) continue;

    hasil.push({
      mulai,
      akhir,
      nilai,
      bertanda: Boolean(cocok[1] || cocok[4]) || /[.,]\d{3}/.test(cocok[2]),
    });
  }
  return hasil;
}

// ---------- TANGGAL ----------

const BULAN_KATA: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, jun: 6,
  jul: 7, agu: 8, ags: 8, sep: 9, okt: 10, nov: 11, des: 12,
};

function bentukTanggal(hari: number, bulan: number, tahun: number): string | null {
  if (hari < 1 || hari > 31 || bulan < 1 || bulan > 12) return null;
  const waktu = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (waktu.getUTCMonth() !== bulan - 1 || waktu.getUTCDate() !== hari) return null;
  return waktu.toISOString().slice(0, 10);
}

/**
 * Tahun untuk tanggal yang ditulis tanpa tahun.
 *
 * Catatan uang hampir selalu tentang yang sudah terjadi. Jadi "31/12" yang
 * diketik pada awal Januari berarti Desember tahun lalu, bukan Desember
 * sebelas bulan lagi.
 */
function tahunMasukAkal(hari: number, bulan: number, hariIni: string): number {
  const tahunIni = Number(hariIni.slice(0, 4));
  const calon = bentukTanggal(hari, bulan, tahunIni);
  if (!calon) return tahunIni;
  const selisihHari = (Date.parse(calon) - Date.parse(hariIni)) / 86_400_000;
  return selisihHari > 31 ? tahunIni - 1 : tahunIni;
}

type Waktu = { tanggal: string; sisa: string };

function ambilTanggal(teks: string, sekarang: Date): Waktu {
  const hariIni = tanggalWib(sekarang);
  const buang = (pola: RegExp, tanggal: string): Waktu => ({
    tanggal,
    sisa: teks.replace(pola, " "),
  });

  const lusa = /\bkemarin\s+lusa\b/i;
  if (lusa.test(teks)) return buang(lusa, geserHari(-2, sekarang));

  const kemarin = /\bkemarin\b/i;
  if (kemarin.test(teks)) return buang(kemarin, geserHari(-1, sekarang));

  const iniHari = /\b(hari ini|tadi pagi|tadi siang|tadi sore|tadi malam|tadi|barusan|sekarang)\b/i;
  if (iniHari.test(teks)) return buang(iniHari, hariIni);

  // 27/8, 27/8/2026, dan bentuk berawalan "tgl".
  const garis = /\b(?:tgl\.?\s*|tanggal\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/i;
  const cocokGaris = teks.match(garis);
  if (cocokGaris) {
    const hari = Number(cocokGaris[1]);
    const bulan = Number(cocokGaris[2]);
    const tahunTulis = cocokGaris[3];
    const tahun = tahunTulis
      ? Number(tahunTulis.length === 2 ? `20${tahunTulis}` : tahunTulis)
      : tahunMasukAkal(hari, bulan, hariIni);
    const jadi = bentukTanggal(hari, bulan, tahun);
    if (jadi) return buang(garis, jadi);
  }

  // 27 agustus, 27 agu 2026.
  const nama = /\b(?:tgl\.?\s*|tanggal\s*)?(\d{1,2})\s+(jan|feb|mar|apr|mei|jun|jul|agu|ags|sep|okt|nov|des)[a-z]*\.?(?:\s+(\d{4}))?\b/i;
  const cocokNama = teks.match(nama);
  if (cocokNama) {
    const hari = Number(cocokNama[1]);
    const bulan = BULAN_KATA[cocokNama[2].toLowerCase()];
    const tahun = cocokNama[3]
      ? Number(cocokNama[3])
      : tahunMasukAkal(hari, bulan, hariIni);
    const jadi = bentukTanggal(hari, bulan, tahun);
    if (jadi) return buang(nama, jadi);
  }

  return { tanggal: hariIni, sisa: teks };
}

// ---------- KATEGORI YANG DITULIS SENDIRI ----------

const POLA_TANDA = /(?:^|\s)#([\p{L}\d]+(?:[-_][\p{L}\d]+)*)/u;
const POLA_KAT = /(?:^|\s)(?:kat|kategori)\s*[:=]\s*([\p{L}\d]+(?:[-\s_][\p{L}\d]+)*)/iu;

// ---------- HASIL ----------

export type Catatan = {
  arah: Arah;
  /** Rupiah bulat. Tidak pernah nol atau negatif. */
  nominal: number;
  catatan: string;
  kategori: string;
  /** True bila kategorinya ditulis sendiri lewat #tanda, bukan ditebak. */
  kategoriDipaksa: boolean;
  /** "YYYY-MM-DD" menurut WIB. */
  tanggal: string;
  /** Hal yang perlu diberitahukan tetapi tidak menggagalkan pencatatan. */
  catatanTambahan: string[];
};

export type HasilUrai =
  | { ok: true; hasil: Catatan }
  | { ok: false; alasan: string };

export const CATATAN_MAKS = 160;

/**
 * Mengurai SATU baris pesan.
 */
export function uraiPesan(pesan: string, sekarang: Date = new Date()): HasilUrai {
  const asli = String(pesan || "").replace(/\s+/g, " ").trim();
  if (!asli) return { ok: false, alasan: "Pesannya kosong." };
  if (asli.length > 400) return { ok: false, alasan: "Pesannya terlalu panjang. Ringkas jadi satu baris saja." };

  let teks = asli;

  // 1. Kategori yang ditulis sendiri.
  let kategoriPaksa: string | null = null;
  const tanda = teks.match(POLA_TANDA);
  if (tanda) {
    kategoriPaksa = kategoriDariTanda(tanda[1]);
    // Tanda yang tidak dikenali TIDAK dibuang: ia tetap kata yang berarti
    // bagi pemiliknya, dan sering justru kata yang menentukan tebakannya.
    if (kategoriPaksa) teks = teks.replace(POLA_TANDA, " ");
  }
  if (!kategoriPaksa) {
    const kat = teks.match(POLA_KAT);
    if (kat) {
      kategoriPaksa = kategoriDariTanda(kat[1]);
      if (kategoriPaksa) teks = teks.replace(POLA_KAT, " ");
    }
  }

  // 2. Tanggal.
  const waktu = ambilTanggal(teks, sekarang);
  teks = waktu.sisa;

  // 3. Nominal. Yang bersatuan selalu menang atas angka telanjang.
  const calon = calonNominal(teks);
  if (calon.length === 0) {
    return {
      ok: false,
      alasan: "Nominalnya tidak ketemu. Tulis angkanya, mis. 10k, 10rb, atau 10.000.",
    };
  }
  // Yang bersatuan diutamakan; di antara sesamanya, yang paling belakang.
  // Orang menaruh nominal di ekor kalimat ("beli nasi uduk 10k") jauh lebih
  // sering daripada di kepalanya.
  const bertanda = calon.filter((c) => c.bertanda);
  const rombongan = bertanda.length > 0 ? bertanda : calon;
  const dipilih = rombongan[rombongan.length - 1];

  if (dipilih.nilai > NOMINAL_MAKS) {
    return { ok: false, alasan: "Nominalnya kelewat besar. Periksa lagi angkanya." };
  }

  // 4. Arah. Tanda di depan baris, atau tanda yang menempel di depan
  //    nominalnya, selalu menang atas tebakan kata.
  let arah: Arah | null = null;
  const depanBaris = asli.trimStart()[0];
  if (depanBaris === "+") arah = "masuk";
  else if (depanBaris === "-") arah = "keluar";

  if (!arah) {
    const sebelumNominal = teks.slice(0, dipilih.mulai).trimEnd();
    const tandaNominal = sebelumNominal[sebelumNominal.length - 1];
    const duaSebelum = sebelumNominal[sebelumNominal.length - 2];
    // Tanda hanya dianggap tanda bila ia berdiri sendiri, supaya "nasi-uduk"
    // dan "e-toll" tidak pernah terbaca sebagai pengurangan.
    if ((tandaNominal === "+" || tandaNominal === "-") && (!duaSebelum || /\s/.test(duaSebelum))) {
      arah = tandaNominal === "+" ? "masuk" : "keluar";
    }
  }

  // 5. Keterangan: sisa kalimat setelah nominal dan tandanya dibuang.
  const catatan = rapikanCatatan(
    `${teks.slice(0, dipilih.mulai)} ${teks.slice(dipilih.akhir)}`,
  );

  const arahAkhir = arah ?? tebakArah(catatan);
  const kategori = kategoriPaksa ?? tebakKategori(catatan, arahAkhir);

  const catatanTambahan: string[] = [];
  if (dipilih.nilai < 1000 && bertanda.length === 0) {
    catatanTambahan.push(
      `Terbaca Rp${dipilih.nilai.toLocaleString("id-ID")}. Kalau maksudnya ribuan, tulis ${dipilih.nilai}k.`,
    );
  }
  if (!catatan) {
    catatanTambahan.push("Tanpa keterangan. Tambahkan satu dua kata supaya mudah dicari nanti.");
  }

  return {
    ok: true,
    hasil: {
      arah: arahAkhir,
      nominal: dipilih.nilai,
      catatan: catatan || "Tanpa keterangan",
      kategori,
      kategoriDipaksa: Boolean(kategoriPaksa),
      tanggal: waktu.tanggal,
      catatanTambahan,
    },
  };
}

function rapikanCatatan(teks: string) {
  const bersih = teks
    // Huruf kendali dari pesan Telegram tidak boleh ikut tersimpan: ia tidak
    // terlihat di layar tetapi merusak balasan dan berkas CSV yang diunduh.
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\brp\.?\b/gi, " ")
    // Tanda di kepala baris dan tanda yang berdiri sendiri saja yang dibuang.
    // Tanda hubung di tengah kata ikut menentukan arti: "e-toll", "oleh-oleh".
    .replace(/^\s*[+\-]\s*/, " ")
    .replace(/(^|\s)[+\-*=]+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:+\-]+|[\s,.;:+\-]+$/g, "")
    .slice(0, CATATAN_MAKS)
    .trim();
  if (!bersih) return "";
  return bersih[0].toUpperCase() + bersih.slice(1);
}

/**
 * Mengurai pesan yang berisi BANYAK baris sekaligus.
 *
 * Satu pesan WhatsApp atau Telegram sering memuat catatan sehari penuh.
 * Tiap baris berdiri sendiri: satu baris yang gagal tidak menjatuhkan
 * baris lain, dan kegagalannya tetap dilaporkan.
 */
export type HasilBanyak = { baris: string; hasil: HasilUrai }[];

export function uraiBanyak(pesan: string, sekarang: Date = new Date()): HasilBanyak {
  return String(pesan || "")
    .split(/[\n;]+/)
    .map((baris) => baris.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((baris) => ({ baris, hasil: uraiPesan(baris, sekarang) }));
}
