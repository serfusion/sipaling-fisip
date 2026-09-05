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
import { MEDIA_KOSONG, type JenisSoal, type Media, type Pasangan } from "@/lib/cbt";

export type SoalImpor = {
  jenis: JenisSoal;
  pertanyaan: string;
  pilihan: string[];
  /**
   * pg / benar_salah : indeks pilihan benar
   * pg_kompleks      : beberapa indeks dipisah koma
   * isian            : teks kunci
   * penjodohan       : kosong — kuncinya ada pada `pasangan`
   */
  kunci: string;
  pasangan: Pasangan[];
  media: Media;
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
  if (!isi) return "pg";
  // Diperiksa SEBELUM "pg", karena "pgkompleks" juga berawalan "pg" — dan
  // kalau urutannya terbalik, seluruh soal jawaban jamak diam-diam berubah
  // menjadi pilihan ganda biasa yang hanya menerima satu jawaban.
  if (isi.startsWith("pgkompleks") || isi.startsWith("pilihangandakompleks") ||
      isi.startsWith("kompleks") || isi.startsWith("jamak") || isi.startsWith("pgk")) {
    return "pg_kompleks";
  }
  if (isi.startsWith("jodoh") || isi.startsWith("penjodohan") || isi.startsWith("menjodohkan") ||
      isi.startsWith("pasangan") || isi.startsWith("matching")) {
    return "penjodohan";
  }
  if (isi.startsWith("pg") || isi.startsWith("pilihanganda")) return "pg";
  if (isi.startsWith("benar") || isi.startsWith("bs") || isi.startsWith("truefalse")) return "benar_salah";
  if (isi.startsWith("isian") || isi.startsWith("singkat")) return "isian";
  if (isi.startsWith("essay") || isi.startsWith("esai") || isi.startsWith("uraian")) return "essay";
  return "pg";
}

/** Baca jenis media dari tulisan bebas dosen. */
export function bacaMedia(jenisMentah: unknown, urlMentah: unknown, keterangan: unknown): Media {
  const url = teks(urlMentah);
  if (!url) return { ...MEDIA_KOSONG };
  const isi = teks(jenisMentah).toLowerCase();

  // Jenisnya boleh dikosongkan: yang berakhiran .mp4 sudah jelas video, dan
  // menuntut dosen menuliskannya lagi hanya menambah satu kolom yang sering
  // salah isi.
  const jenis: Media["jenis"] =
    isi.startsWith("video") || isi.startsWith("film")
      ? "video"
      : isi.startsWith("gambar") || isi.startsWith("image") || isi.startsWith("foto")
        ? "gambar"
        : /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url) || /youtu\.?be|vimeo/i.test(url)
          ? "video"
          : "gambar";
  return { jenis, url: url.slice(0, 1000), keterangan: teks(keterangan).slice(0, 240) };
}

/**
 * Baca kunci PG kompleks: "A,C" atau "AC" atau "1,3" menjadi "0,2".
 *
 * Ditulis dosen dengan segala bentuk, dan semuanya diterima selama menunjuk
 * pilihan yang benar-benar ada.
 */
export function bacaKunciJamak(
  mentah: unknown,
  pilihan: string[],
): { ok: true; kunci: string } | { ok: false; alasan: string } {
  const isi = teks(mentah);
  if (!isi) return { ok: false, alasan: "kunci jawaban kosong" };

  const nomor = new Set<number>();
  for (const potong of isi.split(/[,;/|\s]+/).filter(Boolean)) {
    const huruf = potong.toUpperCase().replace(/[^A-F]/g, "");
    if (huruf.length >= 1) {
      // "AC" ditulis menyatu tanpa pemisah.
      for (const h of huruf) {
        const n = HURUF.indexOf(h);
        if (n >= 0 && n < pilihan.length) nomor.add(n);
        else return { ok: false, alasan: `kunci "${potong}" menunjuk pilihan yang tidak ada` };
      }
      continue;
    }
    const angka = Number(potong.replace(/[^0-9]/g, ""));
    if (!Number.isInteger(angka)) return { ok: false, alasan: `kunci "${potong}" tidak terbaca` };
    // Dosen menomori mulai 1; sistem menyimpan mulai 0.
    const n = angka - 1;
    if (n < 0 || n >= pilihan.length) return { ok: false, alasan: `kunci "${potong}" menunjuk pilihan yang tidak ada` };
    nomor.add(n);
  }

  if (nomor.size === 0) return { ok: false, alasan: "kunci jawaban kosong" };
  if (nomor.size === pilihan.length) {
    return { ok: false, alasan: "seluruh pilihan ditandai benar, soal seperti ini tidak mengukur apa pun" };
  }
  return { ok: true, kunci: [...nomor].sort((a, b) => a - b).join(",") };
}

/**
 * Baca pasangan penjodohan dari satu sel.
 *
 * Bentuknya "kiri = kanan" per baris, mis.
 *   Agenda setting = McCombs & Shaw
 *   Spiral of silence = Noelle-Neumann
 *
 * Kolom kanan menjadi daftar pilihan; pengecoh boleh ditambahkan lewat kolom
 * PILIHAN biasa dan tetap ikut teracak bersama jawaban yang benar.
 */
export function bacaPasangan(
  mentah: unknown,
  pengecoh: string[] = [],
): { ok: true; pasangan: Pasangan[]; pilihan: string[] } | { ok: false; alasan: string } {
  const baris = teks(mentah)
    .split(/\n|;/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (baris.length === 0) return { ok: false, alasan: "pasangan penjodohan kosong" };

  const pilihan: string[] = [];
  const pasangan: Pasangan[] = [];
  for (const b of baris) {
    const pisah = b.split(/\s*(?:=|->|=>|:|\|)\s*/);
    if (pisah.length < 2) return { ok: false, alasan: `pasangan "${b.slice(0, 40)}" tidak punya sisi kanan` };
    const kiri = pisah[0].trim();
    const kanan = pisah.slice(1).join(" ").trim();
    if (!kiri || !kanan) return { ok: false, alasan: `pasangan "${b.slice(0, 40)}" belum lengkap` };

    // Jawaban yang sama boleh dipakai dua pasangan sekaligus; ia cukup masuk
    // daftar pilihan satu kali.
    let index = pilihan.findIndex((p) => p.toLowerCase() === kanan.toLowerCase());
    if (index < 0) { pilihan.push(kanan); index = pilihan.length - 1; }
    pasangan.push({ kiri, kanan: index });
  }

  if (pasangan.length < 2) return { ok: false, alasan: "penjodohan perlu minimal dua pasangan" };

  for (const p of pengecoh.map(teks).filter(Boolean)) {
    if (!pilihan.some((x) => x.toLowerCase() === p.toLowerCase())) pilihan.push(p);
  }
  return { ok: true, pasangan, pilihan };
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
    return { ok: false, alasan: `kunci "${isi}" tidak terbaca: tulis BENAR atau SALAH` };
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

/**
 * Rakit satu soal dari bagian-bagiannya, atau tolak dengan alasan.
 *
 * DIEKSPOR, dan itu disengaja: soal yang dibuat AI melewati gerbang yang
 * PERSIS SAMA dengan soal yang diunggah dosen dari Excel atau Word. Membuat
 * jalur pemeriksaan kedua khusus untuk AI berarti dua tempat yang harus sama
 * selamanya — dan yang kedua akan tertinggal pada perubahan berikutnya.
 */
export function rakitSoal(
  bagian: {
    jenis: unknown; pertanyaan: unknown; pilihan: string[]; kunci: unknown;
    bobot: unknown; materi: unknown; tingkat: unknown; pembahasan: unknown;
    pasangan?: unknown; mediaJenis?: unknown; mediaUrl?: unknown; mediaKet?: unknown;
  },
): { ok: true; soal: SoalImpor } | { ok: false; alasan: string } {
  const jenis = bacaJenis(bagian.jenis);
  const pertanyaan = teks(bagian.pertanyaan);
  if (pertanyaan.length < 3) return { ok: false, alasan: "pertanyaan kosong" };

  const media = bacaMedia(bagian.mediaJenis, bagian.mediaUrl, bagian.mediaKet);
  const sisanya = {
    bobot: bacaBobot(bagian.bobot),
    materi: teks(bagian.materi).slice(0, 120),
    tingkat: bacaTingkat(bagian.tingkat),
    pembahasan: teks(bagian.pembahasan).slice(0, 2000),
    media,
  };

  let pilihan = bagian.pilihan.map(teks).filter((p) => p.length > 0);

  // Penjodohan berdiri sendiri: kolom kanannya lahir dari sel PASANGAN, dan
  // kolom PILIHAN — bila diisi — hanya menambahkan pengecoh.
  if (jenis === "penjodohan") {
    const hasil = bacaPasangan(bagian.pasangan, pilihan);
    if (!hasil.ok) return { ok: false, alasan: hasil.alasan };
    return {
      ok: true,
      soal: { jenis, pertanyaan, pilihan: hasil.pilihan, kunci: "", pasangan: hasil.pasangan, ...sisanya },
    };
  }

  if (jenis === "benar_salah" && pilihan.length === 0) pilihan = ["Benar", "Salah"];
  if (jenis === "isian" || jenis === "essay") pilihan = [];

  if ((jenis === "pg" || jenis === "pg_kompleks" || jenis === "benar_salah") && pilihan.length < 2) {
    return { ok: false, alasan: "pilihan jawaban kurang dari dua" };
  }

  const kunci = jenis === "pg_kompleks"
    ? bacaKunciJamak(bagian.kunci, pilihan)
    : bacaKunci(jenis, bagian.kunci, pilihan);
  if (!kunci.ok) return { ok: false, alasan: kunci.alasan };

  return {
    ok: true,
    soal: { jenis, pertanyaan, pilihan, kunci: kunci.kunci, pasangan: [], ...sisanya },
  };
}

// ---------- EXCEL ----------

export const KOLOM_EXCEL = [
  "NO", "JENIS", "PERTANYAAN",
  "PILIHAN A", "PILIHAN B", "PILIHAN C", "PILIHAN D", "PILIHAN E",
  "KUNCI", "PASANGAN", "MEDIA", "BOBOT", "MATERI", "TINGKAT", "PEMBAHASAN",
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
      tolak: [{ baris: "-", alasan: "Baris judul kolom tidak ditemukan. Pakai template yang diunduh dari dashboard." }],
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
  const kPasangan = cari(/^PASANGAN/);
  const kMedia = cari(/^MEDIA$|^MEDIA URL|^TAUTAN MEDIA/);
  const kMediaJenis = cari(/^JENIS MEDIA/);
  const kMediaKet = cari(/^KETERANGAN MEDIA/);
  const kPilihan = HURUF.map((h) => judul.findIndex((s) => s === `PILIHAN ${h}` || s === h));

  for (let i = kepala + 1; i < aoa.length; i += 1) {
    const baris = aoa[i] || [];
    const ambil = (kolom: number) => (kolom >= 0 ? baris[kolom] : "");
    const pertanyaan = teks(ambil(kTanya));
    // Baris kosong dilewati diam-diam: template selalu berisi baris sisa di
    // bawah, dan mengeluhkannya membuat daftar tolak penuh oleh yang bukan
    // kesalahan siapa pun.
    if (!pertanyaan) continue;

    const hasil = rakitSoal({
      jenis: ambil(kJenis),
      pertanyaan,
      pilihan: kPilihan.map((k) => teks(ambil(k))),
      kunci: ambil(kKunci),
      bobot: ambil(kBobot),
      materi: ambil(kMateri),
      tingkat: ambil(kTingkat),
      pembahasan: ambil(kBahas),
      pasangan: ambil(kPasangan),
      mediaJenis: ambil(kMediaJenis),
      mediaUrl: ambil(kMedia),
      mediaKet: ambil(kMediaKet),
    });

    if (hasil.ok) soal.push(hasil.soal);
    else tolak.push({ baris: `Baris ${i + 1}: ${pertanyaan.slice(0, 48)}`, alasan: hasil.alasan });
  }

  return { soal, tolak };
}

// ---------- WORD ----------

const POLA_NOMOR = /^(?:soal\s*)?(\d{1,3})\s*[.)]\s*(.*)$/i;
const POLA_OPSI = /^([A-Fa-f])\s*[.)]\s*(.*)$/;
const POLA_LABEL =
  /^(kunci|jawaban|bobot|nilai|materi|tingkat|pembahasan|jenis|pasangan|jodoh|media|gambar|video|keterangan)\s*[:：]\s*(.*)$/i;
/** Baris pasangan penjodohan: "Agenda setting = McCombs & Shaw". */
const POLA_JODOH = /^(.{2,120}?)\s*(?:=|->|=>)\s*(.{1,160})$/;

/**
 * Apakah kunci ini berupa DAFTAR jawaban, bukan satu jawaban?
 *
 * Syaratnya sengaja ketat: harus ada pemisah, DAN setiap bagiannya harus satu
 * huruf pilihan. Tanpa syarat kedua, "KUNCI: Jakarta, Indonesia" — dosen yang
 * menyalin teks jawabannya utuh — ikut terbaca sebagai jawaban jamak lalu
 * ditolak. Tanpa syarat pertama, "KUNCI: BENAR" ikut terbaca begitu, dan
 * seluruh soal Benar/Salah pada template bawaan gugur.
 *
 * Yang menulis "AC" menyatu tanpa pemisah tetap dapat memakainya — asalkan
 * jenisnya ditulis tegas sebagai PG Kompleks.
 */
function kunciBerdaftar(kunci: string): boolean {
  const bagian = teks(kunci).split(/[,;/|]/).map((b) => b.trim()).filter(Boolean);
  if (bagian.length < 2) return false;
  return bagian.every((b) => /^[A-Fa-f]$/.test(b.replace(/[^A-Za-z]/g, "")));
}

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
    pasangan: string[]; mediaUrl: string; mediaJenis: string; mediaKet: string;
  };
  let kini: Kumpul | null = null;
  // Ke mana baris lanjutan menempel: pertanyaan, pilihan terakhir, atau
  // pembahasan. Tanpa ini, pertanyaan dua baris kehilangan baris keduanya.
  let sambung: "tanya" | "opsi" | "bahas" | "jodoh" = "tanya";

  const tutup = () => {
    if (!kini) return;
    // Jenisnya ditebak dari bentuk soalnya bila dosen tidak menuliskannya.
    // Adanya baris pasangan sudah cukup menjadi tanda penjodohan; menuntut
    // baris "JENIS: PENJODOHAN" hanya menambah satu hal lagi yang terlupa.
    const tebakan =
      kini.pasangan.length >= 2
        ? "penjodohan"
        : kini.pilihan.length >= 2
          ? kunciBerdaftar(kini.kunci) ? "pg_kompleks" : "pg"
          : kini.kunci ? "isian" : "essay";

    const hasil = rakitSoal({
      jenis: kini.jenis || tebakan,
      pertanyaan: kini.pertanyaan.join(" ").trim(),
      pilihan: kini.pilihan,
      kunci: kini.kunci,
      bobot: kini.bobot,
      materi: kini.materi,
      tingkat: kini.tingkat,
      pembahasan: kini.pembahasan,
      pasangan: kini.pasangan.join("\n"),
      mediaUrl: kini.mediaUrl,
      mediaJenis: kini.mediaJenis,
      mediaKet: kini.mediaKet,
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
        pasangan: [], mediaUrl: "", mediaJenis: "", mediaKet: "",
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
      else if (nama === "pasangan" || nama === "jodoh") {
        // "PASANGAN:" boleh berdiri sendiri sebagai judul, pasangannya
        // menyusul baris demi baris di bawahnya.
        if (nilai) kini.pasangan.push(nilai);
        sambung = "jodoh";
      } else if (nama === "media" || nama === "gambar" || nama === "video") {
        kini.mediaUrl = nilai;
        kini.mediaJenis = nama === "media" ? "" : nama;
      } else if (nama === "keterangan") kini.mediaKet = nilai;
      else if (nama === "pembahasan") { kini.pembahasan = nilai; sambung = "bahas"; }
      continue;
    }

    // Baris pasangan hanya dikumpulkan sesudah label PASANGAN. Tanpa syarat
    // itu, pertanyaan biasa yang kebetulan memuat "=" ikut tertangkap.
    if (sambung === "jodoh" && POLA_JODOH.test(isi)) {
      kini.pasangan.push(isi);
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
      baris: "-",
      alasan: "Tidak ada soal bernomor yang terbaca. Tiap soal diawali \"1.\", \"2.\", dan seterusnya.",
    });
  }
  return { soal, tolak };
}
