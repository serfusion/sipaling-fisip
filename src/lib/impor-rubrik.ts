// ============================================================
// IMPOR RUBRIK DARI EXCEL DAN WORD
//
// KENAPA ADA. Menyusun satu rubrik lewat formulir berarti mengisi satu nama,
// satu keterangan, lalu — untuk lima kriteria berskala 1–4 — dua puluh kotak
// deskriptor satu per satu. Dosen yang sudah punya rubriknya di Word atau
// Excel (dan hampir semuanya punya, karena rubrik adalah lampiran RPS)
// mengerjakan ulang pekerjaan yang sudah selesai.
//
// Yang dibutuhkan hanya jalan supaya berkas itu masuk apa adanya.
//
// SATU BERKAS = SATU RUBRIK. Berbeda dari impor soal yang memasukkan empat
// puluh baris sekaligus, rubrik diunggah satu per satu. Alasannya bukan teknis
// melainkan karena rubrik selalu dibaca ulang sebelum dipakai: yang diimpor
// mendarat di formulir penyusun, dosen memeriksa bobot dan deskriptornya, baru
// menekan simpan. Empat rubrik sekaligus berarti empat pemeriksaan yang
// ditumpuk menjadi satu, dan yang ditumpuk tidak diperiksa.
//
// HASILNYA TIDAK PERNAH LANGSUNG DISIMPAN. Berkas ini hanya membaca; yang
// menyimpan tetap dosen lewat tombol "Simpan rubrik", dengan seluruh
// pemeriksaan periksaRubrik() berlaku seperti biasa.
//
// SENGAJA bebas dari React, database, dan pembaca berkas. Yang masuk ke sini
// sudah berupa baris-baris sel (dari Excel) atau untai teks (dari Word),
// sehingga seluruh aturannya dapat diuji tanpa satu pun berkas sungguhan.
// ============================================================
import {
  MAKS_KRITERIA,
  MAKS_LEVEL,
  ratakanBobot,
  type KriteriaRubrik,
  type LevelRubrik,
  type Rubrik,
} from "@/lib/rubrik";

/** Baris sel apa adanya dari SheetJS. Bentuknya sama dengan pengimpor lain —
 *  termasuk boolean, yang muncul ketika satu sel diisi TRUE/FALSE oleh Excel. */
export type Aoa = Array<Array<string | number | boolean | null | undefined>>;

export type HasilImporRubrik =
  | {
      ok: true;
      rubrik: Rubrik;
      /**
       * Hal yang dibetulkan atau ditebak pembaca, untuk ditampilkan apa adanya.
       *
       * BUKAN galat: rubriknya terbaca dan formulirnya terisi. Tetapi dosen
       * harus tahu apa yang tidak ia tulis sendiri — bobot yang dibagi rata,
       * skala yang ditebak dari kolom yang terisi, kriteria yang dipotong
       * karena melewati batas.
       */
      catatan: string[];
    }
  | { ok: false; pesan: string };

/** Level paling sedikit yang masih masuk akal sebagai rubrik. */
const MIN_LEVEL = 3;

const teks = (nilai: unknown) => String(nilai ?? "").replace(/\r/g, "").trim();

/** Angka bobot dari tulisan bebas: "30", "30%", "30 %", "0,3" tetap dibaca 30. */
export function bacaBobot(nilai: unknown): number {
  const isi = teks(nilai).replace(/%/g, "").replace(/,/g, ".").trim();
  if (!isi) return 0;
  const angka = Number(isi);
  if (!Number.isFinite(angka) || angka <= 0) return 0;
  // Bobot yang ditulis sebagai pecahan (0,3 untuk 30%) dikembalikan ke persen.
  // Batasnya 1: bobot 1% ada dan sah, sedangkan bobot 0,99% tidak pernah ada
  // pada rubrik yang disusun manusia.
  const persen = angka < 1 ? angka * 100 : angka;
  return Math.max(0, Math.min(100, Math.round(persen)));
}

/**
 * Susun rubrik utuh dari kriteria yang sudah terbaca.
 *
 * Di sinilah dua tebakan dikerjakan, dan keduanya dilaporkan lewat `catatan`:
 *
 *   SKALA — diambil dari level TERTINGGI yang punya deskriptor, bukan dari
 *   jumlah kolom pada berkasnya. Template selalu membawa enam kolom LEVEL
 *   supaya rubrik berskala 1–6 tetap muat; kolom yang dibiarkan kosong berarti
 *   level itu tidak ada, bukan level tanpa keterangan.
 *
 *   BOBOT — bila SELURUHNYA kosong, dibagi rata. Rubrik tanpa bobot adalah
 *   rubrik yang tiap kriterianya dianggap sama penting, dan itu memang yang
 *   paling sering dimaksud; memaksa dosen mengisi 25/25/25/25 dengan tangan
 *   hanya memindahkan pekerjaan yang dapat dihitung.
 */
export function rakitRubrik(input: {
  nama: string;
  keterangan: string;
  kriteria: Array<{ nama: string; bobot: number; deskriptor: string[] }>;
  /** Level tertinggi yang disebut berkasnya sendiri, bila ada. */
  skalaDisebut?: number;
}): HasilImporRubrik {
  const catatan: string[] = [];

  const dipakai = input.kriteria.filter((k) => k.nama.trim() !== "");
  if (dipakai.length === 0) {
    return {
      ok: false,
      pesan:
        "Tidak ada satu kriteria pun yang terbaca dari berkas itu. " +
        "Pastikan kolom KRITERIA sudah terisi, atau pakai template yang diunduh di sini.",
    };
  }

  let kriteria = dipakai;
  if (kriteria.length > MAKS_KRITERIA) {
    catatan.push(
      `Berkasnya memuat ${kriteria.length} kriteria; hanya ${MAKS_KRITERIA} yang pertama dipakai.`,
    );
    kriteria = kriteria.slice(0, MAKS_KRITERIA);
  }

  // --- skala ---
  let tertinggi = 0;
  for (const k of kriteria) {
    k.deskriptor.forEach((d, i) => {
      if (d.trim() !== "") tertinggi = Math.max(tertinggi, i + 1);
    });
  }
  const disebut = Math.round(Number(input.skalaDisebut) || 0);
  if (disebut >= MIN_LEVEL && disebut <= MAKS_LEVEL) {
    // Yang DITULIS dosen menang atas yang ditebak dari isi: rubrik berskala
    // 1–5 yang level 5-nya belum ditulis deskriptornya tetap rubrik 1–5.
    if (disebut !== tertinggi && tertinggi > 0) {
      catatan.push(`Skala dipakai 1–${disebut} sesuai yang tertulis di berkasnya.`);
    }
    tertinggi = disebut;
  }
  // Skala yang terbaca wajar dari kolom yang terisi TIDAK dicatat. Ia sudah
  // terlihat pada pilihan "Level tertinggi" di formulir, dan catatan yang muncul
  // pada setiap unggahan yang benar melatih orang mengabaikan catatan — termasuk
  // yang berisi hal yang sungguh perlu dibetulkan.

  const skalaMax = Math.max(MIN_LEVEL, Math.min(MAKS_LEVEL, tertinggi || MIN_LEVEL + 1));
  if (tertinggi > 0 && skalaMax !== tertinggi) {
    catatan.push(
      `Level dijadikan ${skalaMax} tingkat — batasnya ${MIN_LEVEL} sampai ${MAKS_LEVEL}. ` +
        "Deskriptor yang belum ada dibiarkan kosong.",
    );
  }
  if (tertinggi === 0) {
    catatan.push(
      "Tidak ada satu deskriptor pun yang terbaca. Kriterianya tetap masuk, " +
        "tetapi level-levelnya perlu Anda isi sendiri.",
    );
  }

  // --- bobot ---
  const jumlahBobot = kriteria.reduce((n, k) => n + k.bobot, 0);
  let bobot = kriteria.map((k) => k.bobot);
  if (jumlahBobot === 0) {
    bobot = ratakanBobot(kriteria.length);
    catatan.push(
      `Kolom BOBOT kosong, jadi dibagi rata: ${bobot.join(" / ")}%. Ubah bila tidak sama penting.`,
    );
  } else if (jumlahBobot !== 100) {
    catatan.push(
      `Jumlah bobot pada berkasnya ${jumlahBobot}%, bukan 100%. ` +
        "Betulkan di formulir sebelum menyimpan, atau tekan Ratakan.",
    );
  }

  const hasil: KriteriaRubrik[] = kriteria.map((k, urut) => {
    const levels: LevelRubrik[] = Array.from({ length: skalaMax }, (_, i) => ({
      level: i + 1,
      deskriptor: (k.deskriptor[i] ?? "").slice(0, 2000),
    }));
    return { nama: k.nama.slice(0, 160), bobot: bobot[urut] ?? 0, levels };
  });

  if (!input.nama.trim()) {
    catatan.push("Nama rubrik tidak terbaca dari berkasnya; isi sendiri di formulir.");
  }

  return {
    ok: true,
    rubrik: {
      nama: input.nama.trim().slice(0, 160),
      keterangan: input.keterangan.trim().slice(0, 1000),
      skalaMin: 1,
      skalaMax,
      kriteria: hasil,
    },
    catatan,
  };
}

// ------------------------------------------------------------
// EXCEL
// ------------------------------------------------------------

/** Nama kolom pada lembar "Rubrik". Levelnya ditambahkan sesuai MAKS_LEVEL. */
export const KOLOM_RUBRIK = [
  "KRITERIA",
  "BOBOT %",
  ...Array.from({ length: MAKS_LEVEL }, (_, i) => `LEVEL ${i + 1}`),
];

/**
 * Nilai satu keterangan berlabel, mis. "NAMA RUBRIK".
 *
 * Dua bentuk dilayani, karena keduanya sama wajar ditulis orang:
 *
 *   A1: "NAMA RUBRIK"          B1: "Rubrik Esai Metodologi"
 *   A1: "NAMA RUBRIK: Rubrik Esai Metodologi"
 *
 * Yang pertama bentuk template; yang kedua bentuk yang diketik sendiri ketika
 * seseorang menyalin rubriknya dari Word ke satu kolom.
 */
export function bacaLabel(aoa: Aoa, label: RegExp, batasBaris = 12): string {
  for (let i = 0; i < Math.min(aoa.length, batasBaris); i += 1) {
    const baris = aoa[i] || [];
    for (let j = 0; j < baris.length; j += 1) {
      const sel = teks(baris[j]);
      // Dicocokkan pada tulisan ASLINYA dengan pola yang mengabaikan besar
      // kecilnya huruf. Mencocokkan pada hasil toUpperCase lalu memotong yang
      // asli sepanjang itu bergantung pada anggapan bahwa huruf besar selalu
      // sepanjang huruf kecilnya — anggapan yang tidak selalu benar.
      const cocok = label.exec(sel);
      if (!cocok) continue;
      // Sisa tulisan pada sel yang sama, sesudah label dan tanda pemisahnya.
      const sisa = sel.slice(cocok[0].length).replace(/^\s*[:=]\s*/, "").trim();
      if (sisa) return sisa;
      // Kalau tidak, nilainya ada di sel berikutnya yang tidak kosong.
      for (let k = j + 1; k < baris.length; k += 1) {
        const lanjut = teks(baris[k]);
        if (lanjut) return lanjut;
      }
    }
  }
  return "";
}

/**
 * Baca lembar rubrik.
 *
 * Kolomnya dicari dari NAMANYA, bukan dari urutannya — aturan yang sama dengan
 * pengimpor soal, dan alasannya sama: dosen menyisipkan kolom catatannya
 * sendiri, menggeser urutan, atau menghapus kolom LEVEL yang tidak dipakai.
 */
export function imporRubrikExcel(aoa: Aoa): HasilImporRubrik {
  let kepala = -1;
  for (let i = 0; i < Math.min(aoa.length, 30); i += 1) {
    const baris = (aoa[i] || []).map((s) => teks(s).toUpperCase());
    if (baris.some((s) => s.startsWith("KRITERIA")) && baris.some((s) => /^LEVEL\s*\d/.test(s))) {
      kepala = i;
      break;
    }
  }
  if (kepala < 0) {
    return {
      ok: false,
      pesan:
        "Baris judul kolom tidak ditemukan. Lembar rubrik harus punya kolom KRITERIA " +
        "dan kolom LEVEL 1 sampai LEVEL 4. Pakai template yang diunduh di sini.",
    };
  }

  const judul = (aoa[kepala] || []).map((s) => teks(s).toUpperCase());
  const kNama = judul.findIndex((s) => s.startsWith("KRITERIA"));
  const kBobot = judul.findIndex((s) => s.startsWith("BOBOT"));
  const kLevel = Array.from({ length: MAKS_LEVEL }, (_, i) =>
    judul.findIndex((s) => new RegExp(`^LEVEL\\s*0?${i + 1}\\b`).test(s) || s === String(i + 1)),
  );

  const kriteria: Array<{ nama: string; bobot: number; deskriptor: string[] }> = [];
  for (let i = kepala + 1; i < aoa.length; i += 1) {
    const baris = aoa[i] || [];
    const ambil = (kolom: number) => (kolom >= 0 ? baris[kolom] : "");
    const nama = teks(ambil(kNama));
    // Baris kosong dilewati diam-diam: template selalu menyisakan baris
    // bergaris di bawah supaya dosen mengetik ke dalam tabel.
    if (!nama) continue;
    kriteria.push({
      nama,
      bobot: bacaBobot(ambil(kBobot)),
      deskriptor: kLevel.map((k) => teks(ambil(k))),
    });
  }

  // Keterangan rubriknya dicari di SELURUH lembar, bukan hanya di atas tabel:
  // sebagian orang menaruhnya di bawah, sesudah kriterianya.
  // Labelnya HARUS berhenti di situ — diikuti tanda titik dua, tanda sama
  // dengan, atau habis selnya. Tanpa jangkar itu, kriteria bernama "Nama dan
  // gelar" akan dibaca sebagai label "NAMA", dan yang diambil sebagai nama
  // rubrik adalah sel berikutnya pada barisnya: bobotnya.
  return rakitRubrik({
    nama: bacaLabel(aoa, /^(NAMA RUBRIK|JUDUL RUBRIK|NAMA)\s*(?=[:=]|$)/i, aoa.length),
    keterangan: bacaLabel(aoa, /^(KETERANGAN|DESKRIPSI)\s*(?=[:=]|$)/i, aoa.length),
    kriteria,
    skalaDisebut:
      Number(
        bacaLabel(aoa, /^(LEVEL TERTINGGI|SKALA)\s*(?=[:=]|$)/i, aoa.length).replace(/\D+/g, ""),
      ) || 0,
  });
}

// ------------------------------------------------------------
// WORD
// ------------------------------------------------------------

/**
 * Baca rubrik dari naskah Word.
 *
 * Bentuknya berlabel per baris, bukan tabel — dan itu keputusan yang perlu
 * diterangkan. Pembaca .docx portal mengambil TEKSNYA saja; tabel Word
 * kehilangan susunan barisnya begitu teksnya diambil, sehingga "mana kolom
 * level 2" tidak lagi dapat dipastikan. Rubrik yang salah kolom lebih buruk
 * daripada rubrik yang ditolak: angkanya tetap keluar, hanya artinya yang
 * bergeser.
 *
 *   NAMA RUBRIK: Rubrik Esai Metodologi
 *   KETERANGAN: Untuk soal esai metodologi penelitian
 *   LEVEL TERTINGGI: 4
 *
 *   KRITERIA: Ketepatan Konsep
 *   BOBOT: 30
 *   LEVEL 1: Konsepnya keliru.
 *   LEVEL 2: Sebagian tepat.
 *   ...
 *
 * Baris tanpa label dianggap SAMBUNGAN dari deskriptor sebelumnya, supaya
 * deskriptor panjang yang dipotong Enter tidak hilang separuh.
 */
export function imporRubrikWord(naskah: string): HasilImporRubrik {
  const baris = String(naskah || "").split(/\r?\n/);

  let nama = "";
  let keterangan = "";
  let skalaDisebut = 0;
  const kriteria: Array<{ nama: string; bobot: number; deskriptor: string[] }> = [];
  /** Level yang baru saja diisi, untuk menampung baris sambungannya. */
  let levelTerakhir = -1;

  // Seluruh pola di bawah mengabaikan besar kecilnya huruf dan dicocokkan pada
  // tulisan ASLINYA — nilainya diambil dengan memotong sepanjang yang cocok,
  // jadi huruf aslinya tidak pernah ikut berubah.
  const label = (isi: string, pola: RegExp) => {
    const cocok = pola.exec(isi);
    return cocok ? isi.slice(cocok[0].length).replace(/^\s*[:=]\s*/, "").trim() : null;
  };

  for (const mentah of baris) {
    const isi = mentah.replace(/\r/g, "").trim();
    if (!isi) { levelTerakhir = -1; continue; }

    const nilaiNama = label(isi, /^(NAMA RUBRIK|JUDUL RUBRIK)\s*[:=]/i);
    if (nilaiNama !== null) {
      nama = nilaiNama;
      levelTerakhir = -1;
      continue;
    }
    const nilaiKet = label(isi, /^(KETERANGAN|DESKRIPSI)\s*[:=]/i);
    if (nilaiKet !== null) {
      keterangan = nilaiKet;
      levelTerakhir = -1;
      continue;
    }
    const nilaiSkala = label(isi, /^(LEVEL TERTINGGI|SKALA)\s*[:=]/i);
    if (nilaiSkala !== null) {
      skalaDisebut = Number(nilaiSkala.replace(/\D+/g, "")) || 0;
      levelTerakhir = -1;
      continue;
    }

    // "KRITERIA:", "KRITERIA 1:", "KRITERIA 1." — ketiganya sama wajar ditulis.
    const kepalaKriteria = /^KRITERIA\s*\d*\s*[:=.]/i.exec(isi);
    if (kepalaKriteria) {
      kriteria.push({ nama: isi.slice(kepalaKriteria[0].length).trim(), bobot: 0, deskriptor: [] });
      levelTerakhir = -1;
      continue;
    }

    const sedang = kriteria[kriteria.length - 1];
    if (!sedang) continue;

    const nilaiBobot = label(isi, /^BOBOT\s*[:=]/i);
    if (nilaiBobot !== null) {
      sedang.bobot = bacaBobot(nilaiBobot);
      levelTerakhir = -1;
      continue;
    }

    const kepalaLevel = /^LEVEL\s*(\d+)\s*[:=.]/i.exec(isi);
    if (kepalaLevel) {
      const nomor = Number(kepalaLevel[1]);
      if (nomor >= 1 && nomor <= MAKS_LEVEL) {
        sedang.deskriptor[nomor - 1] = isi.slice(kepalaLevel[0].length).trim();
        levelTerakhir = nomor - 1;
      }
      continue;
    }

    // Baris tanpa label: sambungan deskriptor yang dipotong Enter.
    if (levelTerakhir >= 0) {
      sedang.deskriptor[levelTerakhir] = `${sedang.deskriptor[levelTerakhir] ?? ""} ${isi}`.trim();
    }
  }

  if (kriteria.length === 0) {
    return {
      ok: false,
      pesan:
        "Tidak ada baris \"KRITERIA:\" yang terbaca dari berkas Word itu. " +
        "Rubrik dari Word harus ditulis berlabel per baris — unduh template Word di sini untuk " +
        "melihat bentuknya. Rubrik yang sudah berbentuk TABEL lebih baik diunggah lewat Excel, " +
        "karena tabel Word kehilangan susunan kolomnya saat teksnya dibaca.",
    };
  }

  // Deskriptor yang lubang di tengahnya (level 2 kosong, level 3 terisi) tetap
  // dilayani: array-nya dirapatkan menjadi panjang seragam di rakitRubrik.
  for (const k of kriteria) {
    for (let i = 0; i < k.deskriptor.length; i += 1) {
      if (typeof k.deskriptor[i] !== "string") k.deskriptor[i] = "";
    }
  }

  return rakitRubrik({ nama, keterangan, kriteria, skalaDisebut });
}
