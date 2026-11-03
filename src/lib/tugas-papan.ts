// ============================================================
// PAPAN NILAI TUGAS — gerbang plagiasi, peringkat, nilai kritis, keterangan
//
// Permintaan pemilik portal, dirangkum:
//
//   - Seluruh nilai diterbitkan di CBT dan dapat dilihat semua orang, seperti
//     mading, DIURUTKAN dari yang tertinggi.
//   - Nilai di bawah batas kritis (diatur dosen di langkah "Penilaian AI &
//     laporan PDF") tampil merah, dan di sebelahnya ada KETERANGAN.
//   - Kiriman yang terindikasi plagiasi DITANDAI di papan, juga dengan
//     keterangan.
//   - Keterangan itu terkunci. Yang dapat membukanya hanya pemilik kode
//     SIPALING-TUGAS baris itu, "ibarat kata sandi". Orang lain melihat bahwa
//     ada keterangan, tetapi tidak melihat isinya.
//
// Berkas ini memutuskan apa yang tampil untuk SEMUA ORANG (barisPublik) dan
// apa yang hanya untuk PEMILIK KODE (keteranganNilai), supaya batas keduanya
// tertulis di satu tempat dan dapat diuji. Jalur API tinggal memanggilnya.
//
// SELURUHNYA FUNGSI MURNI, diuji di uji-tugas-cbt.ts.
// ============================================================
import { STATUS_MIRIP_LABEL, type StatusMirip } from "@/lib/mirip-jawaban";
import {
  ejaNilai, hitungNilaiTugas, predikatTugas, rapikanSkala, type RubrikTugas, type TingkatPredikat,
} from "@/lib/tugas-rubrik";
import { samarkanNim } from "@/lib/tugas-kode";
import type { DataLaporan } from "@/lib/tugas-template";

// ------------------------------------------------------------
// GERBANG PLAGIASI
// ------------------------------------------------------------

export type TindakanPlagiasi = "tahan" | "nol" | "catat";

export const TINDAKAN_PLAGIASI: TindakanPlagiasi[] = ["tahan", "nol", "catat"];

export const TINDAKAN_LABEL: Record<TindakanPlagiasi, string> = {
  tahan: "Tahan nilainya sampai ditinjau dosen",
  nol: "Beri nilai 0 (dapat dipulihkan dosen)",
  catat: "Tetap dinilai, beri keterangan",
};

export function rapikanTindakan(masuk: unknown): TindakanPlagiasi {
  return TINDAKAN_PLAGIASI.includes(masuk as TindakanPlagiasi) ? (masuk as TindakanPlagiasi) : "tahan";
}

export type Putusan = "" | "lolos" | "plagiasi";

export function rapikanPutusan(masuk: unknown): Putusan {
  return masuk === "lolos" || masuk === "plagiasi" ? masuk : "";
}

export type KeadaanPlagiasi = { status: StatusMirip | string; skor: number; putusan: Putusan | string };

export type HasilGerbang =
  | { lanjut: true; catatan: string }
  | { lanjut: false; tindakan: "tahan" | "nol"; alasan: string };

/** Kiriman ini sedang terindikasi plagiasi (belum diloloskan dosen)? */
export function terindikasi(k: KeadaanPlagiasi): boolean {
  if (k.putusan === "plagiasi") return true;
  if (k.putusan === "lolos") return false;
  return k.status === "tinggi";
}

/**
 * Gerbang sebelum penilaian AI.
 *
 *   putusan dosen "plagiasi"   → nilai 0, tanpa memanggil AI
 *   putusan dosen "lolos"      → dinilai seperti biasa
 *   kemiripan "tinggi", lalu menurut tindakan tugas:
 *     tahan → tidak dinilai sampai dosen memutuskan
 *     nol   → nilai 0 sampai dosen memulihkan
 *     catat → dinilai, keterangannya tetap ada
 *   selebihnya                 → dinilai seperti biasa
 *
 * Gerbang ini yang menghemat kuota AI: kiriman yang ditahan atau dinolkan
 * tidak pernah dikirim ke model.
 */
export function gerbangPlagiasi(k: KeadaanPlagiasi, tindakan: TindakanPlagiasi): HasilGerbang {
  const persen = `${Math.round(Number(k.skor) || 0)}%`;
  if (k.putusan === "plagiasi") {
    return { lanjut: false, tindakan: "nol", alasan: `Dinyatakan plagiasi oleh dosen (kesamaan isi ${persen}).` };
  }
  if (k.putusan === "lolos" || k.status !== "tinggi") return { lanjut: true, catatan: "" };
  if (tindakan === "tahan") {
    return { lanjut: false, tindakan: "tahan", alasan: `Terindikasi plagiasi (kesamaan isi ${persen}); menunggu tinjauan dosen.` };
  }
  if (tindakan === "nol") {
    return { lanjut: false, tindakan: "nol", alasan: `Terindikasi plagiasi (kesamaan isi ${persen}); nilai 0 sampai ditinjau dosen.` };
  }
  return { lanjut: true, catatan: `Terindikasi plagiasi (kesamaan isi ${persen}).` };
}

/**
 * Nilai yang BERLAKU untuk satu kiriman, sesudah gerbang plagiasi.
 *
 * Hasil AI dan skornya tetap tersimpan apa adanya di basis data; yang
 * berubah hanya nilai yang ditampilkan dan diterbitkan. Karena itu dosen
 * yang meloloskan kiriman sesudah meninjaunya langsung mengembalikan nilai
 * aslinya, tanpa menilai ulang dan tanpa memakai kuota AI lagi.
 *
 *   putusan "plagiasi"                     → 0
 *   terindikasi, belum diputus, tindakan:
 *     tahan → ditahan (tanpa nilai)   nol → 0   catat → nilai aslinya
 *   sudah dinilai                          → nilai aslinya
 *   selebihnya                             → belum dinilai
 */
export function nilaiEfektif(
  k: { status: string; nilai: number | null; plagiasi: KeadaanPlagiasi },
  tindakan: TindakanPlagiasi,
): { nilai: number | null; keadaan: "dinilai" | "ditahan" | "belum"; nol: boolean } {
  if (k.plagiasi.putusan === "plagiasi") return { nilai: 0, keadaan: "dinilai", nol: true };
  if (terindikasi(k.plagiasi)) {
    if (tindakan === "tahan") return { nilai: null, keadaan: "ditahan", nol: false };
    if (tindakan === "nol") return { nilai: 0, keadaan: "dinilai", nol: true };
  }
  if (k.status === "dinilai" && k.nilai !== null && Number.isFinite(Number(k.nilai))) {
    return { nilai: Number(k.nilai), keadaan: "dinilai", nol: false };
  }
  return { nilai: null, keadaan: "belum", nol: false };
}

// ------------------------------------------------------------
// NILAI KRITIS
// ------------------------------------------------------------

export const BATAS_KRITIS_BAWAAN = 60;

export function rapikanBatasKritis(masuk: unknown): number {
  const teks = String(masuk ?? "").trim().replace(",", ".");
  // Kosong bukan nol: isian yang dikosongkan berarti "pakai bawaan".
  if (!teks) return BATAS_KRITIS_BAWAAN;
  const n = Math.round(Number(teks));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : BATAS_KRITIS_BAWAAN;
}

/** Merah: sudah bernilai dan di bawah batas kritis. */
export function nilaiKritis(nilai: number | null | undefined, batas: number): boolean {
  return nilai !== null && nilai !== undefined && Number.isFinite(Number(nilai)) && Number(nilai) < batas;
}

// ------------------------------------------------------------
// PERINGKAT DAN BARIS PUBLIK
// ------------------------------------------------------------

/** Satu kiriman, sebanyak yang dibutuhkan papan. */
export type KirimanPapan = {
  id: number;
  nama: string;
  nim: string;
  /** "masuk" | "dinilai" | "ditahan" | "gagal" */
  status: string;
  nilai: number | null;
  plagiasi: KeadaanPlagiasi;
  /** Hasil penilaian lolos gerbang isi (bukan kiriman kosong/tugas lain). */
  gerbangIsiLolos?: boolean;
};

export type PenandaPublik = "" | "terindikasi" | "plagiasi" | "ditahan";

/** Baris papan untuk SEMUA ORANG. Tanpa kode, tanpa isi keterangan. */
export type BarisPublik = {
  /** id kiriman, dipakai untuk membuka keterangan dengan kode. */
  baris: number;
  peringkat: number | null;
  nama: string;
  nimSamar: string;
  /** "80.60" atau null. */
  nilai: string | null;
  predikat: string;
  kritis: boolean;
  penanda: PenandaPublik;
  /** Ada keterangan terkunci di sebelah nilainya. */
  terkunci: boolean;
  /** "Dinilai", "Ditahan", "Belum dinilai". */
  keadaan: string;
};

export type RingkasPapan = {
  dinilai: number;
  rata: number | null;
  tertinggi: number | null;
  terendah: number | null;
  kritis: number;
  ditandai: number;
};

/**
 * Susun papan satu tugas: peringkat dari nilai tertinggi.
 *
 * Peringkat bersama untuk nilai yang sama (1, 2, 2, 4), dibaca sampai dua
 * desimal seperti yang tercetak. Kiriman yang ditahan atau belum dinilai
 * tidak berperingkat dan ditaruh di bawah, supaya mahasiswanya tetap melihat
 * kirimannya tercatat.
 */
export function susunPapan(
  kirimanMentah: KirimanPapan[],
  aturan: { batasKritis: number; skala?: TingkatPredikat[]; tindakan?: TindakanPlagiasi },
): { baris: BarisPublik[]; ringkas: RingkasPapan } {
  const skala = rapikanSkala(aturan.skala ?? []);
  const batas = rapikanBatasKritis(aturan.batasKritis);
  const tindakan = rapikanTindakan(aturan.tindakan);
  const bulat = (n: number) => Math.round(n * 100) / 100;

  // Nilai yang berlaku (sesudah gerbang plagiasi) dipakai untuk segalanya.
  const kiriman = kirimanMentah.map((k) => {
    const ef = nilaiEfektif(k, tindakan);
    return { ...k, nilai: ef.nilai, status: ef.keadaan };
  });
  const ditahan = (k: KirimanPapan) => k.status === "ditahan";
  const bernilai = kiriman
    .filter((k) => k.status === "dinilai" && k.nilai !== null)
    .sort((a, b) => bulat(Number(b.nilai)) - bulat(Number(a.nilai)) || a.nama.localeCompare(b.nama, "id"));
  const sisa = kiriman
    .filter((k) => !bernilai.includes(k))
    .sort((a, b) => Number(ditahan(b)) - Number(ditahan(a)) || a.nama.localeCompare(b.nama, "id"));

  const penanda = (k: KirimanPapan): PenandaPublik => {
    if (k.plagiasi.putusan === "plagiasi") return "plagiasi";
    if (terindikasi(k.plagiasi)) return "terindikasi";
    if (ditahan(k)) return "ditahan";
    return "";
  };

  const baris: BarisPublik[] = [];
  let peringkat = 0;
  let nilaiLalu: number | null = null;
  bernilai.forEach((k, i) => {
    const n = bulat(Number(k.nilai));
    if (nilaiLalu === null || n !== nilaiLalu) peringkat = i + 1;
    nilaiLalu = n;
    const kritis = nilaiKritis(n, batas);
    const p = penanda(k);
    baris.push({
      baris: k.id, peringkat, nama: k.nama || "(tanpa nama)", nimSamar: samarkanNim(k.nim),
      nilai: ejaNilai(n), predikat: predikatTugas(n, skala).huruf, kritis, penanda: p,
      terkunci: kritis || p !== "" || k.gerbangIsiLolos === false,
      keadaan: "Dinilai",
    });
  });
  for (const k of sisa) {
    const p = penanda(k);
    baris.push({
      baris: k.id, peringkat: null, nama: k.nama || "(tanpa nama)", nimSamar: samarkanNim(k.nim),
      nilai: null, predikat: "", kritis: false, penanda: p,
      terkunci: p !== "",
      keadaan: ditahan(k) ? "Ditahan" : "Belum dinilai",
    });
  }

  const angka = bernilai.map((k) => bulat(Number(k.nilai)));
  const ringkas: RingkasPapan = {
    dinilai: angka.length,
    rata: angka.length ? bulat(angka.reduce((a, b) => a + b, 0) / angka.length) : null,
    tertinggi: angka.length ? Math.max(...angka) : null,
    terendah: angka.length ? Math.min(...angka) : null,
    kritis: angka.filter((n) => nilaiKritis(n, batas)).length,
    ditandai: baris.filter((b) => b.penanda === "terindikasi" || b.penanda === "plagiasi").length,
  };
  return { baris, ringkas };
}

export const PENANDA_LABEL: Record<Exclude<PenandaPublik, "">, string> = {
  terindikasi: "Terindikasi plagiasi",
  plagiasi: "Plagiasi",
  ditahan: "Ditahan",
};

// ------------------------------------------------------------
// KETERANGAN — HANYA UNTUK PEMILIK KODE
// ------------------------------------------------------------

export type HasilUntukKeterangan = {
  gerbang?: { lolos: boolean; alasan: string };
  kriteria?: Array<{ urut: number; skor: number | null; capaian: string }>;
  perbaikan?: Array<{ aspek: string; uraian: string }>;
  catatan?: string;
};

export type BagianKeterangan = { judul: string; isi: string[] };

export type Keterangan = {
  /** Satu kalimat di bagian atas, mis. "Nilai 54.20 di bawah batas kritis 60." */
  ringkas: string;
  bagian: BagianKeterangan[];
  /** Nada keterangan untuk tampilan. */
  nada: "bahaya" | "waspada" | "biasa";
};

/**
 * Isi keterangan nilai untuk pemilik kode: KENAPA nilainya seperti itu.
 *
 * Disusun dari yang sudah ada, tanpa memanggil model lagi:
 *   - indikasi plagiasi (persen, status tinjauan dosen, kalimat yang sama),
 *   - kiriman yang tidak lolos gerbang isi (kosong, tugas lain),
 *   - kriteria dengan skor terendah beserta deskripsi capaiannya,
 *   - area perbaikan dan catatan tindak lanjut dari umpan balik.
 */
export function keteranganNilai(masuk: {
  /** Nilai yang BERLAKU (nilaiEfektif), bukan skor mentah. */
  nilai: number | null;
  /** Keadaan dari nilaiEfektif: "dinilai" | "ditahan" | "belum". */
  status: string;
  batasKritis: number;
  rubrik: RubrikTugas;
  hasil: HasilUntukKeterangan | null;
  plagiasi: KeadaanPlagiasi;
  /** Kalimat yang sama persis dengan kiriman lain, dari teks pemilik sendiri. */
  kalimatSama?: string[];
}): Keterangan {
  const batas = rapikanBatasKritis(masuk.batasKritis);
  const bagian: BagianKeterangan[] = [];
  const kritis = nilaiKritis(masuk.nilai, batas);
  const persen = Math.round(Number(masuk.plagiasi.skor) || 0);
  const ditandai = terindikasi(masuk.plagiasi);
  const diloloskan = masuk.plagiasi.putusan === "lolos" && persen > 0;

  let ringkas: string;
  if (masuk.plagiasi.putusan === "plagiasi") {
    ringkas = `Kiriman ini dinyatakan PLAGIASI oleh dosen: ${persen}% isinya sama dengan kiriman lain pada tugas ini.`;
  } else if (masuk.status === "ditahan") {
    ringkas = `Nilai ditahan: kiriman ini terindikasi plagiasi (${persen}% isinya sama dengan kiriman lain) dan sedang menunggu tinjauan dosen.`;
  } else if (ditandai) {
    ringkas = `Kiriman ini terindikasi plagiasi: ${persen}% isinya sama dengan kiriman lain pada tugas ini.`;
  } else if (masuk.nilai === null) {
    ringkas = "Kiriman ini sudah diterima dan belum dinilai.";
  } else if (kritis) {
    ringkas = `Nilai ${ejaNilai(masuk.nilai)} berada di bawah batas kritis ${batas}.`;
  } else {
    ringkas = `Nilai ${ejaNilai(masuk.nilai)}, di atas batas kritis ${batas}.`;
  }

  if (ditandai || masuk.plagiasi.putusan === "plagiasi") {
    const isi = [
      `Sekitar ${persen}% isi kiriman ini sama persis (lima kata berturut-turut atau lebih) dengan kiriman mahasiswa lain pada tugas yang sama.`,
      masuk.plagiasi.putusan === "plagiasi"
        ? "Dosen sudah meninjau dan menetapkannya sebagai plagiasi, sehingga nilainya 0."
        : "Ini indikasi dari pemeriksaan otomatis, bukan putusan. Dosen akan meninjau kedua kiriman berdampingan.",
      "Bila Anda merasa kesamaan ini wajar (mis. mengutip sumber yang sama dengan benar), sampaikan kepada dosen dengan menyebut kode kiriman Anda.",
    ];
    bagian.push({ judul: "Indikasi plagiasi", isi });
    if (masuk.kalimatSama?.length) {
      const pendek = (k: string) => (k.length > 280 ? `${k.slice(0, 277).trimEnd()}…` : k);
      bagian.push({ judul: "Contoh kalimat Anda yang sama persis dengan kiriman lain", isi: masuk.kalimatSama.slice(0, 3).map(pendek) });
    }
  } else if (diloloskan) {
    bagian.push({
      judul: "Pemeriksaan plagiasi",
      isi: [`Ada kesamaan isi ${persen}% dengan kiriman lain, tetapi dosen sudah meninjaunya dan menyatakannya bukan plagiasi.`],
    });
  }

  const h = masuk.hasil;
  if (h?.gerbang && h.gerbang.lolos === false) {
    bagian.push({
      judul: "Kiriman tidak dapat dinilai",
      isi: [h.gerbang.alasan || "Kiriman kosong, tidak terbaca, atau bukan pengerjaan tugas ini."],
    });
  }

  if (h?.kriteria?.length && masuk.nilai !== null) {
    const daftar = masuk.rubrik.kriteria
      .map((k, i) => ({ k, h: h.kriteria?.find((x) => x.urut === i) ?? h.kriteria?.[i] }))
      .filter((x) => x.h && x.h.skor !== null && x.h.skor !== undefined)
      .sort((a, b) => Number(a.h!.skor) - Number(b.h!.skor));
    const rendah = daftar.filter((x) => Number(x.h!.skor) < batas);
    const tampil = (rendah.length ? rendah : daftar.slice(0, 2)).slice(0, 4);
    if (tampil.length) {
      bagian.push({
        judul: rendah.length ? "Kriteria yang menurunkan nilai" : "Kriteria dengan skor terendah",
        isi: tampil.map((x) => `${x.k.nama} (bobot ${x.k.bobot}%): skor ${x.h!.skor}. ${x.h!.capaian}`.trim()),
      });
    }
  }

  if (h?.perbaikan?.length) {
    bagian.push({
      judul: "Yang perlu diperbaiki",
      isi: h.perbaikan.map((p) => (p.aspek ? `${p.aspek}: ${p.uraian}` : p.uraian)),
    });
  }
  if (h?.catatan) bagian.push({ judul: "Catatan dan saran tindak lanjut", isi: [h.catatan] });

  const nada: Keterangan["nada"] = ditandai || masuk.plagiasi.putusan === "plagiasi" || kritis
    ? "bahaya"
    : masuk.status === "ditahan" || masuk.nilai === null ? "waspada" : "biasa";
  return { ringkas, bagian, nada };
}

/** Label status kemiripan untuk dosen, mis. "Kemiripan tinggi 72%". */
export function labelKemiripan(status: string, skor: number): string {
  const label = STATUS_MIRIP_LABEL[status as StatusMirip] ?? "Bersih";
  return status === "bersih" ? label : `${label} ${Math.round(skor)}%`;
}

// ------------------------------------------------------------
// DATA LAPORAN PDF
// ------------------------------------------------------------

export type HasilUntukLaporan = HasilUntukKeterangan & {
  judul?: string;
  kelebihan?: string[];
  bagianTambahan?: Array<{ judul: string; isi: string }>;
};

/** "3 November 2026", waktu Indonesia bagian barat. */
export function tanggalLaporan(waktu: string | Date | null | undefined): string {
  const d = waktu ? new Date(waktu) : new Date();
  return (Number.isFinite(d.getTime()) ? d : new Date())
    .toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
}

/**
 * Data satu laporan PDF, dari hasil tersimpan dan keadaan gerbangnya.
 *
 * Dipakai DUA tempat yang harus menghasilkan laporan yang sama persis: panel
 * dosen (PDF per mahasiswa dan zip arsip) dan papan nilai (laporan yang
 * diunduh mahasiswa dengan kodenya). Satu fungsi, supaya laporan yang
 * dipegang mahasiswa tidak pernah berbeda dari yang dipegang dosennya.
 *
 * Kiriman yang bernilai 0 karena plagiasi dicetak dengan skor 0 di setiap
 * kriteria; umpan balik mutunya tetap dicetak bila ada, karena tetap berguna.
 */
export function susunDataLaporan(m: {
  tugas: DataLaporan["tugas"];
  mahasiswa: DataLaporan["mahasiswa"];
  rubrik: RubrikTugas;
  skala: TingkatPredikat[];
  hasil: HasilUntukLaporan | null;
  status: string;
  plagiasi: KeadaanPlagiasi;
  tindakan: TindakanPlagiasi;
  batasKritis: number;
  dinilai?: string | null;
  kode?: string;
}): DataLaporan {
  const h = m.hasil ?? {};
  const skorAsli = m.rubrik.kriteria.map((_, i) => {
    const k = h.kriteria?.find((x) => x.urut === i) ?? h.kriteria?.[i];
    return k?.skor ?? null;
  });
  const hitung = hitungNilaiTugas(m.rubrik, skorAsli);
  const ef = nilaiEfektif({ status: m.status, nilai: hitung.nilai, plagiasi: m.plagiasi }, m.tindakan);
  const nol = ef.nol;
  const nilai = nol ? 0 : hitung.nilai;
  const persen = Math.round(Number(m.plagiasi.skor) || 0);
  const batas = rapikanBatasKritis(m.batasKritis);

  const keterangan: string[] = [];
  if (m.plagiasi.putusan === "plagiasi") {
    keterangan.push(`Dinyatakan PLAGIASI oleh dosen: ${persen}% isi kiriman ini sama dengan kiriman lain. Nilai 0.`);
  } else if (terindikasi(m.plagiasi)) {
    keterangan.push(
      `Terindikasi plagiasi: ${persen}% isi kiriman ini sama dengan kiriman lain` +
        (nol ? "; nilai 0 sampai ditinjau dosen." : "; menunggu tinjauan dosen."),
    );
  }
  if (nilaiKritis(nilai, batas)) keterangan.push(`Nilai berada di bawah batas kritis ${batas}.`);

  const capaian = m.rubrik.kriteria.map((_, i) => {
    if (nol) return "Tidak dinilai: kiriman terindikasi atau dinyatakan plagiasi.";
    const k = h.kriteria?.find((x) => x.urut === i) ?? h.kriteria?.[i];
    return k?.capaian ?? "";
  });

  return {
    tugas: m.tugas,
    mahasiswa: m.mahasiswa,
    judulKarya: h.judul ?? "",
    rubrik: m.rubrik,
    skor: nol ? m.rubrik.kriteria.map(() => 0) : skorAsli,
    capaian,
    nilai,
    rataBiasa: hitung.rataBiasa,
    predikat: predikatTugas(nilai, m.skala),
    kelebihan: h.kelebihan ?? [],
    perbaikan: h.perbaikan ?? [],
    catatan: h.catatan ?? "",
    bagianTambahan: h.bagianTambahan ?? [],
    tanggal: tanggalLaporan(m.dinilai),
    kode: m.kode,
    keterangan,
  };
}
