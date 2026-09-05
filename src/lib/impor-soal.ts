// ============================================================
// IMPOR SOAL DARI EXCEL DAN WORD
//
// Menambah soal satu per satu lewat formulir itu benar, tetapi lambat: empat
// puluh soal berarti empat puluh kali mengisi, menekan, dan menunggu. Dosen
// sudah punya soalnya di Word atau Excel; yang dibutuhkan hanya jalan supaya
// berkas itu masuk apa adanya.
//
// Berkas ini SENGAJA bebas dari database, React, dan pembaca berkas. Yang
// masuk ke sini sudah berupa baris-baris sel (dari Excel) atau untai teks
// (dari Word), sehingga seluruh aturannya dapat diuji tanpa satu pun berkas
// sungguhan — dan aturan inilah yang paling mudah salah.
//
// PRINSIPNYA: satu baris rusak TIDAK menggagalkan seluruh berkas. Yang sah
// tetap masuk, yang bermasalah dikembalikan beserta nomor barisnya, supaya
// dosen memperbaiki tiga baris — bukan mengunggah ulang empat puluh soal.
// ============================================================
import type { JenisSoal } from "@/lib/cbt";

export type SoalImpor = {
  jenis: JenisSoal;
  pertanyaan: string;
  pilihan: string[];
  /** Indeks pilihan benar (pg/benar_salah) atau teks kunci (isian). */
  kunci: string;
  bobot: number;
  materi: string;
  tingkat: "mudah" | "sedang" | "sulit";
  pembahasan: string;
};

export type HasilImpor = {
  soal: SoalImpor[];
  /** Baris yang ditolak beserta alasannya, untuk ditampilkan apa adanya. */
  tolak: Array<{ baris: string; alasan: string }>;
};

const HURUF = ["A", "B", "C", "D", "E", "F"];

const teks = (nilai: unknown) => String(nilai ?? "").replace(/\r/g, "").trim();

/** Baca jenis soal dari tulisan bebas dosen. */
export function bacaJenis(nilai: unknown): JenisSoal {
  const isi = teks(nilai).toLowerCase().replace(/[^a-z]/g, "");
  if (!isi || isi.startsWith("pg") || isi.startsWith("pilihanganda")) return "pg";
  if (isi.startsWith("benar") || isi.startsWith("bs") || isi.startsWith("truefalse")) return "benar_salah";
  if (isi.startsWith("isian") || isi.startsWith("singkat")) return "isian";
  if (isi.startsWith("essay") || isi.startsWith("esai") || isi.startsWith("uraian")) return "essay";
  return "pg";
}

export function bacaTingkat(nilai: unknown): "mudah" | "sedang" | "sulit" {
  const isi = teks(nilai).toLowerCase();
  if (isi.startsWith("mudah") || isi.startsWith("easy")) return "mudah";
  if (isi.startsWith("sulit") || isi.startsWith("sukar") || isi.startsWith("hard")) return "sulit";
  return "sedang";
}

export function bacaBobot(nilai: unknown): number {
  const n = Number(teks(nilai).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.min(Math.round(n), 100));
}

/**
 * Ubah kunci yang ditulis dosen menjadi bentuk yang disimpan sistem.
 *
 * Dosen menulis "B", "b", "b." atau bahkan menyalin teks jawabannya utuh.
 * Ketiganya diterima; yang ditolak hanya yang benar-benar tidak menunjuk ke
 * mana pun — karena kunci yang salah menyalahkan seluruh mahasiswa yang
 * sebenarnya menjawab benar, dan itu baru ketahuan sesudah nilai keluar.
 */
export function bacaKunci(
  jenis: JenisSoal,
  mentah: unknown,
  pilihan: string[],
): { ok: true; kunci: string } | { ok: false; alasan: string } {
  const isi = teks(mentah);

  if (jenis === "essay") return { ok: true, kunci: "" };

  if (jenis === "isian") {
    if (!isi) return { ok: false, alasan: "kunci jawaban isian singkat kosong" };
    return { ok: true, kunci: isi };
  }

  if (jenis === "benar_salah") {
    const bersih = isi.toLowerCase().replace(/[^a-z]/g, "");
    if (bersih.startsWith("benar") || bersih === "b" || bersih === "true" || bersih === "a") {
      return { ok: true, kunci: "0" };
    }
    if (bersih.startsWith("salah") || bersih === "s" || bersih === "false") {
      return { ok: true, kunci: "1" };
    }
    return { ok: false, alasan: `kunci "${isi}" tidak terbaca — tulis BENAR atau SALAH` };
  }

  // Pilihan ganda. Satu huruf dulu, karena itu yang paling sering ditulis.
  const huruf = isi.toUpperCase().replace(/[^A-F]/g, "");
  if (huruf.length === 1) {
    const nomor = HURUF.indexOf(huruf);
    if (nomor >= 0 && nomor < pilihan.length) return { ok: true, kunci: String(nomor) };
    return { ok: false, alasan: `kunci "${isi}" menunjuk pilihan yang tidak ada` };
  }

  // Dosen menyalin teks jawabannya utuh: dicocokkan dengan daftar pilihannya.
  const cocok = pilihan.findIndex((p) => p.trim().toLowerCase() === isi.toLowerCase());
  if (cocok >= 0) return { ok: true, kunci: String(cocok) };

  if (!isi) return { ok: false, alasan: "kunci jawaban kosong" };
  return { ok: false, alasan: `kunci "${isi}" tidak cocok dengan pilihan mana pun` };
}

/** Rakit satu soal dari bagian-bagiannya, atau tolak dengan alasan. */
function rakit(
  bagian: {
    jenis: unknown; pertanyaan: unknown; pilihan: string[]; kunci: unknown;
    bobot: unknown; materi: unknown; tingkat: unknown; pembahasan: unknown;
  },
): { ok: true; soal: SoalImpor } | { ok: false; alasan: string } {
  const jenis = bacaJenis(bagian.jenis);
  const pertanyaan = teks(bagian.pertanyaan);
  if (pertanyaan.length < 3) return { ok: false, alasan: "pertanyaan kosong" };

  let pilihan = bagian.pilihan.map(teks).filter((p) => p.length > 0);
  if (jenis === "benar_salah" && pilihan.length === 0) pilihan = ["Benar", "Salah"];
  if (jenis === "isian" || jenis === "essay") pilihan = [];

  if ((jenis === "pg" || jenis === "benar_salah") && pilihan.length < 2) {
    return { ok: false, alasan: "pilihan jawaban kurang dari dua" };
  }

  const kunci = bacaKunci(jenis, bagian.kunci, pilihan);
  if (!kunci.ok) return { ok: false, alasan: kunci.alasan };

  return {
    ok: true,
    soal: {
      jenis,
      pertanyaan,
      pilihan,
      kunci: kunci.kunci,
      bobot: bacaBobot(bagian.bobot),
      materi: teks(bagian.materi).slice(0, 120),
      tingkat: bacaTingkat(bagian.tingkat),
      pembahasan: teks(bagian.pembahasan).slice(0, 2000),
    },
  };
}

// ---------- EXCEL ----------

export const KOLOM_EXCEL = [
  "NO", "JENIS", "PERTANYAAN",
  "PILIHAN A", "PILIHAN B", "PILIHAN C", "PILIHAN D", "PILIHAN E",
  "KUNCI", "BOBOT", "MATERI", "TINGKAT", "PEMBAHASAN",
];

export type Aoa = Array<Array<string | number | null | undefined>>;

/**
 * Baca sheet soal.
 *
 * Kolomnya dicari dari NAMANYA, bukan dari urutannya. Dosen menyisipkan kolom
 * catatan sendiri, menggeser urutan, atau menghapus kolom yang tidak dipakai —
 * dan berkasnya tetap terbaca. Yang bergantung pada urutan kolom akan rusak
 * pada berkas kedua yang diunggah orang.
 */
export function imporDariExcel(aoa: Aoa): HasilImpor {
  const soal: SoalImpor[] = [];
  const tolak: Array<{ baris: string; alasan: string }> = [];

  let kepala = -1;
  for (let i = 0; i < Math.min(aoa.length, 20); i += 1) {
    const baris = (aoa[i] || []).map((s) => teks(s).toUpperCase());
    if (baris.some((s) => s.startsWith("PERTANYAAN")) && baris.some((s) => s.startsWith("KUNCI"))) {
      kepala = i;
      break;
    }
  }
  if (kepala < 0) {
    return {
      soal: [],
      tolak: [{ baris: "—", alasan: "Baris judul kolom tidak ditemukan. Pakai template yang diunduh dari dashboard." }],
    };
  }

  const judul = (aoa[kepala] || []).map((s) => teks(s).toUpperCase());
  const cari = (pola: RegExp) => judul.findIndex((s) => pola.test(s));
  const kJenis = cari(/^JENIS/);
  const kTanya = cari(/^PERTANYAAN/);
  const kKunci = cari(/^KUNCI/);
  const kBobot = cari(/^BOBOT/);
  const kMateri = cari(/^MATERI/);
  const kTingkat = cari(/^TINGKAT/);
  const kBahas = cari(/^PEMBAHASAN/);
  const kPilihan = HURUF.map((h) => judul.findIndex((s) => s === `PILIHAN ${h}` || s === h));

  for (let i = kepala + 1; i < aoa.length; i += 1) {
    const baris = aoa[i] || [];
    const ambil = (kolom: number) => (kolom >= 0 ? baris[kolom] : "");
    const pertanyaan = teks(ambil(kTanya));
    // Baris kosong dilewati diam-diam: template selalu berisi baris sisa di
    // bawah, dan mengeluhkannya membuat daftar tolak penuh oleh yang bukan
    // kesalahan siapa pun.
    if (!pertanyaan) continue;

    const hasil = rakit({
      jenis: ambil(kJenis),
      pertanyaan,
      pilihan: kPilihan.map((k) => teks(ambil(k))),
      kunci: ambil(kKunci),
      bobot: ambil(kBobot),
      materi: ambil(kMateri),
      tingkat: ambil(kTingkat),
      pembahasan: ambil(kBahas),
    });

    if (hasil.ok) soal.push(hasil.soal);
    else tolak.push({ baris: `Baris ${i + 1}: ${pertanyaan.slice(0, 48)}`, alasan: hasil.alasan });
  }

  return { soal, tolak };
}

// ---------- WORD ----------

const POLA_NOMOR = /^(?:soal\s*)?(\d{1,3})\s*[.)]\s*(.*)$/i;
const POLA_OPSI = /^([A-Fa-f])\s*[.)]\s*(.*)$/;
const POLA_LABEL = /^(kunci|jawaban|bobot|nilai|materi|tingkat|pembahasan|jenis)\s*[:：]\s*(.*)$/i;

/**
 * Baca naskah soal dari Word.
 *
 * Bentuknya sengaja yang paling sering dipakai dosen sendiri: nomor, lalu
 * pilihan berhuruf, lalu baris "KUNCI: B". Tidak ada tabel dan tidak ada gaya
 * khusus yang harus dijaga — dan itu penting, karena berkas Word yang
 * bentuknya harus persis akan gagal pada dokumen kedua.
 */
export function imporDariWord(mentah: string): HasilImpor {
  const soal: SoalImpor[] = [];
  const tolak: Array<{ baris: string; alasan: string }> = [];

  const baris = String(mentah || "").replace(/\r/g, "").split("\n");
  type Kumpul = {
    nomor: string; pertanyaan: string[]; pilihan: string[];
    kunci: string; bobot: string; materi: string; tingkat: string; pembahasan: string; jenis: string;
  };
  let kini: Kumpul | null = null;
  // Ke mana baris lanjutan menempel: pertanyaan, pilihan terakhir, atau
  // pembahasan. Tanpa ini, pertanyaan dua baris kehilangan baris keduanya.
  let sambung: "tanya" | "opsi" | "bahas" = "tanya";

  const tutup = () => {
    if (!kini) return;
    const hasil = rakit({
      jenis: kini.jenis || (kini.pilihan.length >= 2 ? "pg" : kini.kunci ? "isian" : "essay"),
      pertanyaan: kini.pertanyaan.join(" ").trim(),
      pilihan: kini.pilihan,
      kunci: kini.kunci,
      bobot: kini.bobot,
      materi: kini.materi,
      tingkat: kini.tingkat,
      pembahasan: kini.pembahasan,
    });
    if (hasil.ok) soal.push(hasil.soal);
    else {
      tolak.push({
        baris: `Soal ${kini.nomor}: ${kini.pertanyaan.join(" ").slice(0, 48)}`,
        alasan: hasil.alasan,
      });
    }
    kini = null;
  };

  for (const asli of baris) {
    const isi = asli.trim();
    if (!isi) continue;

    const nomor = POLA_NOMOR.exec(isi);
    if (nomor) {
      tutup();
      kini = {
        nomor: nomor[1], pertanyaan: nomor[2] ? [nomor[2]] : [], pilihan: [],
        kunci: "", bobot: "", materi: "", tingkat: "", pembahasan: "", jenis: "",
      };
      sambung = "tanya";
      continue;
    }
    if (!kini) continue;

    const label = POLA_LABEL.exec(isi);
    if (label) {
      const nama = label[1].toLowerCase();
      const nilai = label[2].trim();
      if (nama === "kunci" || nama === "jawaban") kini.kunci = nilai;
      else if (nama === "bobot" || nama === "nilai") kini.bobot = nilai;
      else if (nama === "materi") kini.materi = nilai;
      else if (nama === "tingkat") kini.tingkat = nilai;
      else if (nama === "jenis") kini.jenis = nilai;
      else if (nama === "pembahasan") { kini.pembahasan = nilai; sambung = "bahas"; }
      continue;
    }

    const opsi = POLA_OPSI.exec(isi);
    if (opsi) {
      kini.pilihan.push(opsi[2].trim());
      sambung = "opsi";
      continue;
    }

    // Baris lanjutan.
    if (sambung === "opsi" && kini.pilihan.length > 0) {
      kini.pilihan[kini.pilihan.length - 1] += ` ${isi}`;
    } else if (sambung === "bahas") {
      kini.pembahasan += ` ${isi}`;
    } else {
      kini.pertanyaan.push(isi);
    }
  }
  tutup();

  if (soal.length === 0 && tolak.length === 0) {
    tolak.push({
      baris: "—",
      alasan: "Tidak ada soal bernomor yang terbaca. Tiap soal diawali \"1.\", \"2.\", dan seterusnya.",
    });
  }
  return { soal, tolak };
}
