// ============================================================
// BUAT SOAL DENGAN AI — bagian yang tidak menyentuh jaringan
//
// Berkas ini menyusun perintah untuk model dan MEMERIKSA jawabannya. Ia
// sengaja bebas dari SDK, kunci API, dan basis data, sehingga seluruh
// aturannya dapat diuji tanpa memanggil model sama sekali — dan aturan inilah
// yang paling menentukan mutu soalnya.
//
// PRINSIP YANG PALING PENTING DI SINI:
// Jawaban model TIDAK PERNAH masuk ke bank soal begitu saja. Ia melewati
// rakitSoal() — gerbang yang sama persis dengan berkas Excel dan Word yang
// diunggah dosen. Model dapat keliru menulis kunci "F" pada soal berpilihan
// tiga, dan gerbang itulah yang menolaknya. Membuat jalur pemeriksaan kedua
// khusus untuk AI berarti dua tempat yang harus sama selamanya, dan yang
// kedua pasti tertinggal.
// ============================================================
import { rakitSoal, type HasilImpor, type SoalImpor } from "@/lib/impor-soal";
import { JENIS_LABEL, type JenisSoal } from "@/lib/cbt";

/** Jenis soal yang boleh diminta ke model. */
export const JENIS_AI: JenisSoal[] = ["pg", "pg_kompleks", "penjodohan", "benar_salah", "isian", "essay"];

export type PermintaanAi = {
  /** Naskah yang sudah disarikan dari dokumen dosen, di peramban. */
  teks: string;
  jumlah: number;
  jenis: JenisSoal[];
  tingkat: "campuran" | "mudah" | "sedang" | "sulit";
  materi: string;
  /** Petunjuk tambahan dari dosen, bebas. */
  arahan: string;
};

/** Batas naskah yang dikirim ke model. */
export const MAKS_HURUF = 60_000;
export const MAKS_SOAL = 50;

export function rapikanPermintaan(mentah: Partial<PermintaanAi>): PermintaanAi {
  const jenis = Array.isArray(mentah.jenis)
    ? mentah.jenis.filter((j): j is JenisSoal => JENIS_AI.includes(j))
    : [];
  const jumlah = Number(mentah.jumlah);
  const tingkat = mentah.tingkat;
  return {
    teks: String(mentah.teks ?? "").slice(0, MAKS_HURUF),
    jumlah: Number.isFinite(jumlah) ? Math.max(1, Math.min(Math.round(jumlah), MAKS_SOAL)) : 10,
    jenis: jenis.length > 0 ? jenis : ["pg"],
    tingkat:
      tingkat === "mudah" || tingkat === "sedang" || tingkat === "sulit" ? tingkat : "campuran",
    materi: String(mentah.materi ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    arahan: String(mentah.arahan ?? "").replace(/\r/g, "").trim().slice(0, 1000),
  };
}

/**
 * Skema jawaban yang dituntut dari model.
 *
 * Bentuknya sengaja MENDEKATI kolom template Excel, bukan bentuk basis data:
 * kunci ditulis sebagai huruf ("A", "A,C", "BENAR"), pasangan ditulis sebagai
 * teks. Dengan begitu jawaban model melewati pembaca yang sudah teruji
 * bertahun-tahun menghadapi tulisan dosen — bukan pembaca baru yang belum
 * pernah menghadapi apa pun.
 */
export const SKEMA_JAWABAN = {
  type: "object",
  properties: {
    soal: {
      type: "array",
      items: {
        type: "object",
        properties: {
          jenis: { type: "string", enum: JENIS_AI },
          pertanyaan: { type: "string" },
          pilihan: { type: "array", items: { type: "string" } },
          kunci: { type: "string" },
          pasangan: {
            type: "array",
            items: {
              type: "object",
              properties: { kiri: { type: "string" }, kanan: { type: "string" } },
              required: ["kiri", "kanan"],
              additionalProperties: false,
            },
          },
          bobot: { type: "integer" },
          materi: { type: "string" },
          tingkat: { type: "string", enum: ["mudah", "sedang", "sulit"] },
          pembahasan: { type: "string" },
        },
        required: ["jenis", "pertanyaan", "pilihan", "kunci", "pasangan", "bobot", "materi", "tingkat", "pembahasan"],
        additionalProperties: false,
      },
    },
  },
  required: ["soal"],
  additionalProperties: false,
} as const;

export const PERAN_SISTEM = [
  "Anda penyusun soal ujian untuk perguruan tinggi di Indonesia.",
  "",
  "Aturan yang tidak boleh dilanggar:",
  "1. Soal HANYA boleh bersumber dari naskah yang diberikan. Jangan menambah",
  "   fakta, angka, nama, atau tahun yang tidak ada di dalamnya. Bila naskahnya",
  "   tidak cukup untuk jumlah soal yang diminta, buat lebih sedikit — soal",
  "   karangan yang terdengar meyakinkan jauh lebih merusak daripada soal yang",
  "   kurang jumlahnya.",
  "2. Kunci jawaban WAJIB benar menurut naskah itu. Kunci yang salah",
  "   menyalahkan seluruh mahasiswa yang sebenarnya menjawab benar.",
  "3. Bahasa Indonesia akademik yang lugas. Hindari pertanyaan menjebak,",
  "   kalimat bermakna ganda, dan pengecoh yang sebenarnya juga benar.",
  "4. Pengecoh harus masuk akal — sama panjang, sekelas, dan sejenis dengan",
  "   jawaban benarnya. Pengecoh yang jelas konyol membuat soal tidak mengukur",
  "   apa pun.",
  "5. Jangan memakai 'semua benar', 'semua salah', atau 'A dan B benar'.",
  "6. Sebarkan letak kunci jawaban; jangan menumpuk di huruf yang sama.",
  "",
  "Cara menulis tiap jenis:",
  "- pg           : 4 pilihan, kunci satu huruf, mis. \"C\".",
  "- pg_kompleks  : 4-5 pilihan, kunci beberapa huruf dipisah koma, mis. \"A,C\".",
  "                 WAJIB menyisakan minimal satu pengecoh — jangan menandai",
  "                 seluruh pilihan sebagai benar.",
  "- penjodohan   : isi larik pasangan (kiri dan kanan sebagai TEKS), minimal 3",
  "                 pasangan. Kosongkan kunci. Kolom pilihan boleh diisi",
  "                 pengecoh yang tidak berpasangan dengan apa pun.",
  "- benar_salah  : kosongkan pilihan, kunci ditulis \"BENAR\" atau \"SALAH\".",
  "- isian        : kosongkan pilihan; kunci berisi jawabannya, dan beberapa",
  "                 kemungkinan jawaban dipisah tanda | .",
  "- essay        : kosongkan pilihan dan kunci. Tulis rambu penilaian pada",
  "                 kolom pembahasan.",
  "",
  "Bobot: pilihan ganda dan benar/salah 5, pg kompleks dan penjodohan 9,",
  "isian 5, essay 20 — kecuali dosen meminta lain.",
].join("\n");

/** Susun perintah untuk satu permintaan. */
export function susunPerintah(minta: PermintaanAi): string {
  const daftarJenis = minta.jenis.map((j) => `${j} (${JENIS_LABEL[j]})`).join(", ");
  const bagian = [
    `Buat ${minta.jumlah} soal ujian dari naskah di bawah ini.`,
    "",
    `Jenis soal yang diminta: ${daftarJenis}.`,
    minta.jenis.length > 1
      ? "Sebarkan jumlahnya kira-kira merata di antara jenis-jenis tersebut."
      : "Seluruh soal memakai jenis tersebut.",
    minta.tingkat === "campuran"
      ? "Tingkat kesulitan dicampur: kira-kira 30% mudah, 50% sedang, 20% sulit."
      : `Seluruh soal pada tingkat ${minta.tingkat}.`,
    minta.materi ? `Tulis "${minta.materi}" pada kolom materi setiap soal.` : "",
    minta.arahan ? `\nPermintaan tambahan dari dosen:\n${minta.arahan}` : "",
    "",
    "=== NASKAH ===",
    minta.teks,
    "=== AKHIR NASKAH ===",
  ];
  return bagian.filter((b) => b !== "").join("\n");
}

export type HasilAi = HasilImpor & {
  /** Soal yang diminta tetapi tidak jadi dibuat model. */
  kurang: number;
};

type SoalMentah = {
  jenis?: unknown; pertanyaan?: unknown; pilihan?: unknown; kunci?: unknown;
  pasangan?: unknown; bobot?: unknown; materi?: unknown; tingkat?: unknown; pembahasan?: unknown;
};

/**
 * Periksa jawaban model dan ubah menjadi soal yang siap masuk bank.
 *
 * Tiap soal dilewatkan rakitSoal — gerbang yang sama dengan berkas unggahan
 * dosen. Yang tidak lolos dikembalikan beserta alasannya, TIDAK dibuang
 * diam-diam: dosen berhak tahu bahwa dari dua puluh yang diminta, tiga
 * ditolak karena kuncinya menunjuk pilihan yang tidak ada.
 */
export function periksaJawabanAi(mentah: unknown, diminta: number): HasilAi {
  const soal: SoalImpor[] = [];
  const tolak: Array<{ baris: string; alasan: string }> = [];

  const isi = (mentah as { soal?: unknown })?.soal;
  if (!Array.isArray(isi)) {
    return {
      soal: [],
      tolak: [{ baris: "—", alasan: "Model tidak mengembalikan daftar soal yang dapat dibaca." }],
      kurang: diminta,
    };
  }

  for (const [urut, satu] of isi.entries()) {
    const s = (satu ?? {}) as SoalMentah;
    const nomor = `Soal AI ${urut + 1}`;
    const pertanyaan = String(s.pertanyaan ?? "").trim();

    // Pasangan dikirim model sebagai teks; disatukan menjadi bentuk baris
    // "kiri = kanan" yang sudah dimengerti pembaca berkas dosen.
    const pasangan = Array.isArray(s.pasangan)
      ? s.pasangan
          .map((p) => {
            const isiP = (p ?? {}) as { kiri?: unknown; kanan?: unknown };
            return `${String(isiP.kiri ?? "").trim()} = ${String(isiP.kanan ?? "").trim()}`;
          })
          .filter((b) => b.length > 3)
          .join("\n")
      : "";

    const hasil = rakitSoal({
      jenis: s.jenis,
      pertanyaan,
      pilihan: Array.isArray(s.pilihan) ? s.pilihan.map((x) => String(x ?? "")) : [],
      kunci: s.kunci,
      bobot: s.bobot,
      materi: s.materi,
      tingkat: s.tingkat,
      pembahasan: s.pembahasan,
      pasangan,
    });

    if (hasil.ok) soal.push(hasil.soal);
    else tolak.push({ baris: `${nomor}: ${pertanyaan.slice(0, 48) || "(tanpa pertanyaan)"}`, alasan: hasil.alasan });
  }

  return { soal, tolak, kurang: Math.max(0, diminta - soal.length) };
}

/**
 * Naskah terlalu pendek untuk dijadikan soal?
 *
 * Diperiksa SEBELUM memanggil model, karena panggilan itu berbiaya dan
 * jawabannya sudah dapat ditebak: dari setengah halaman, model akan mengarang.
 */
export function naskahCukup(teks: string, jumlah: number): { ok: true } | { ok: false; pesan: string } {
  const kata = teks.trim().split(/\s+/).filter(Boolean).length;
  if (kata < 120) {
    return {
      ok: false,
      pesan:
        `Naskahnya hanya ${kata} kata — terlalu pendek untuk dijadikan soal. ` +
        "Unggah dokumen yang lebih lengkap, atau tambahkan materinya lebih dulu.",
    };
  }
  // Kira-kira 40 kata per soal. Di bawah itu, yang keluar bukan soal dari
  // naskah melainkan soal dari ingatan model tentang topiknya.
  const wajar = Math.max(1, Math.floor(kata / 40));
  if (jumlah > wajar) {
    return {
      ok: false,
      pesan:
        `Naskah ${kata} kata terlalu tipis untuk ${jumlah} soal. ` +
        `Dari naskah sepanjang ini, sekitar ${wajar} soal masih wajar — lebih dari itu model mulai mengarang.`,
    };
  }
  return { ok: true };
}
