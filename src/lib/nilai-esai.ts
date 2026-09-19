// ============================================================
// PENILAIAN ESAI DENGAN RUBRIK — PERINTAH, SKEMA, DAN PEMBACAAN
//
// Yang diminta ke model BUKAN "berapa nilai jawaban ini". Model diminta
// memilih LEVEL untuk tiap kriteria rubrik, beserta alasan yang mengutip
// jawabannya. Nilainya dihitung kemudian oleh rumus di src/lib/rubrik.ts.
//
// Perbedaan itu yang menentukan, dan ada tiga sebabnya:
//
//   1. NILAI YANG DAPAT DITERANGKAN. Dosen yang membuka lembar penilaian
//      melihat "Argumentasi: level 3 — karena ...", bukan angka 82 yang tidak
//      dapat dibantah maupun dibenarkan.
//   2. KOREKSI YANG MURAH. Dosen yang tidak setuju mengubah satu level, dan
//      nilainya ikut berubah sendiri. Kalau model yang memberi angka akhir,
//      ketidaksetujuan pada satu kriteria berarti mengarang ulang angkanya.
//   3. RUMUS YANG DAPAT DIUJI. Pembobotan berjalan di kode, bukan di kepala
//      model — dan kode yang menghitungnya diuji tanpa satu pun panggilan model.
//
// ------------------------------------------------------------
// YANG DISIMPAN BERSAMA HASILNYA
// ------------------------------------------------------------
// Versi rubrik, versi perintah, dan nama model ikut dicatat. Penilaian yang
// tidak dapat direproduksi bukan penilaian yang dapat dipertanggungjawabkan,
// dan pertanyaan "waktu itu dinilai pakai apa" muncul justru berbulan-bulan
// kemudian, ketika semuanya sudah berubah.
// ============================================================

import { mintaJson, penyediaTersedia, type NamaPenyedia } from "@/lib/ai-penyedia";
import type { Rubrik } from "@/lib/rubrik";

/**
 * Versi perintah. NAIKKAN tiap kali kalimat perintah di bawah diubah.
 *
 * Tercatat bersama tiap penilaian, supaya perbedaan hasil antara dua peserta
 * yang dinilai pada minggu berbeda dapat ditelusuri ke sebabnya.
 */
export const VERSI_PERINTAH = "esai-1";

/** Panjang jawaban yang ikut dikirim. Sisanya dipotong, dan itu dikatakan. */
const MAKS_JAWABAN = 12_000;

const SISTEM = `Anda pemeriksa esai yang bekerja dengan rubrik, membantu dosen di perguruan tinggi Indonesia.

TUGAS ANDA
Untuk SETIAP kriteria rubrik, pilih satu level yang paling sesuai dengan jawaban mahasiswa,
lalu terangkan alasannya. Anda TIDAK memberi nilai akhir, nilai dihitung sistem dari level
yang Anda pilih.

CARA MEMILIH LEVEL
- Bacalah deskriptor tiap level apa adanya. Pilih level yang deskriptornya paling menggambarkan
  jawaban yang ada di hadapan Anda, bukan level yang Anda rasa pantas diterima mahasiswa.
- Bila jawaban berada di antara dua level, pilih yang LEBIH RENDAH, dan katakan pada alasan apa
  yang kurang untuk naik satu level. Dosen dapat menaikkannya; ia tidak dapat mengetahui apa yang
  Anda diamkan.
- Jawaban kosong atau yang hanya mengulang pertanyaan mendapat level terendah pada semua kriteria.

CARA MENULIS ALASAN
- Satu sampai tiga kalimat bahasa Indonesia, ditujukan kepada DOSEN.
- Kutip bagian jawaban yang menjadi dasarnya, secukupnya. Alasan yang tidak menunjuk apa pun
  di dalam jawaban tidak dapat diperiksa siapa pun.
- Sebut yang sudah terpenuhi DAN yang belum. Umpan balik yang hanya memuji tidak berguna bagi
  mahasiswa yang membacanya nanti.

KEYAKINAN
Isi "keyakinan" 0–100 dengan kejujuran. Turunkan bila jawabannya sangat pendek, bila bidangnya
di luar yang dapat Anda nilai, atau bila rubriknya menuntut pengetahuan tentang materi kuliah
yang tidak ada di hadapan Anda. Keyakinan rendah bukan kegagalan, ia tanda bagi dosen untuk
membaca sendiri, dan itu memang tugasnya.

YANG TIDAK BOLEH ANDA LAKUKAN
- Jangan menuduh menyontek, menjiplak, atau memakai AI. Itu bukan pekerjaan Anda dan tidak dapat
  Anda ketahui dari satu jawaban.
- Jangan menilai mahasiswanya. Yang dinilai jawabannya.
- Jangan menambah kriteria yang tidak ada di rubrik.`;

/** Skema jawaban model. Ditegakkan penyedia, bukan diminta sebagai imbauan. */
export function skemaPenilaian(jumlahKriteria: number) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["kriteria", "ringkasan", "keyakinan"],
    properties: {
      kriteria: {
        type: "array",
        minItems: jumlahKriteria,
        maxItems: jumlahKriteria,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["urut", "level", "alasan", "terpenuhi", "belum"],
          properties: {
            urut: { type: "integer", description: "Nomor urut kriteria, mulai 0." },
            level: { type: "integer", description: "Level yang dipilih, sesuai skala rubrik." },
            alasan: { type: "string", description: "1–3 kalimat untuk dosen, mengutip jawaban." },
            terpenuhi: {
              type: "array",
              items: { type: "string" },
              description: "Hal yang sudah dipenuhi jawaban pada kriteria ini.",
            },
            belum: {
              type: "array",
              items: { type: "string" },
              description: "Hal yang belum dipenuhi, yang membuatnya tidak naik level.",
            },
          },
        },
      },
      ringkasan: {
        type: "string",
        description: "Umpan balik menyeluruh 2–4 kalimat, yang layak dibaca mahasiswanya sendiri.",
      },
      saran: {
        type: "array",
        items: { type: "string" },
        description: "Saran perbaikan yang konkret, paling banyak empat.",
      },
      keyakinan: { type: "integer", description: "0–100." },
      perluDosen: {
        type: "boolean",
        description: "True bila penilaian ini sebaiknya dibaca dosen lebih dulu sebelum dipakai.",
      },
    },
  } as const;
}

export type PenilaianKriteria = {
  urut: number;
  level: number;
  alasan: string;
  terpenuhi: string[];
  belum: string[];
};

export type PenilaianEsai = {
  kriteria: PenilaianKriteria[];
  ringkasan: string;
  saran: string[];
  keyakinan: number;
  perluDosen: boolean;
  model: string;
  penyedia: NamaPenyedia;
  versiPerintah: string;
};

/**
 * Susun perintah untuk satu jawaban.
 *
 * Rubriknya ditulis lengkap ke dalam perintah — nama kriteria, bobot, dan
 * deskriptor tiap level. Bobotnya IKUT walaupun model tidak memakainya
 * menghitung: kriteria berbobot 30% memang layak dibaca lebih teliti daripada
 * yang berbobot 10%, dan model yang tidak tahu bobotnya membagi perhatiannya
 * rata.
 */
export function susunPerintah(input: {
  rubrik: Rubrik;
  pertanyaan: string;
  jawaban: string;
  mataKuliah?: string;
  /** Pembahasan/kunci dari dosen, bila ada. Sangat menaikkan ketepatan. */
  acuan?: string;
}): string {
  const { rubrik } = input;
  const jawaban = String(input.jawaban ?? "").trim();
  const dipotong = jawaban.length > MAKS_JAWABAN;

  const baris: string[] = [];
  baris.push(`MATA KULIAH: ${input.mataKuliah || "(tidak disebutkan)"}`);
  baris.push("");
  baris.push("PERTANYAAN:");
  baris.push(input.pertanyaan.trim() || "(pertanyaan tidak tersedia)");
  baris.push("");

  if (input.acuan && input.acuan.trim()) {
    baris.push("ACUAN JAWABAN DARI DOSEN (pakai sebagai pembanding, bukan sebagai jawaban yang harus disalin):");
    baris.push(input.acuan.trim().slice(0, 4000));
    baris.push("");
  }

  baris.push(`RUBRIK: ${rubrik.nama}`);
  baris.push(`Skala level: ${rubrik.skalaMin} sampai ${rubrik.skalaMax}.`);
  baris.push("");
  rubrik.kriteria.forEach((k, urut) => {
    baris.push(`Kriteria ${urut}: ${k.nama} (bobot ${k.bobot}%)`);
    for (const l of k.levels) {
      baris.push(`  Level ${l.level}: ${l.deskriptor.trim() || "(deskriptor belum diisi dosen)"}`);
    }
    baris.push("");
  });

  baris.push("JAWABAN MAHASISWA:");
  baris.push(jawaban ? jawaban.slice(0, MAKS_JAWABAN) : "(kosong, mahasiswa tidak menulis apa pun)");
  if (dipotong) {
    baris.push("");
    baris.push("(Jawaban dipotong karena sangat panjang. Nilailah bagian yang terlihat, dan turunkan keyakinan Anda.)");
  }
  baris.push("");
  baris.push(
    `Berikan satu penilaian untuk masing-masing dari ${rubrik.kriteria.length} kriteria di atas, ` +
      "berurutan dari urut 0.",
  );
  return baris.join("\n");
}

/**
 * Pastikan jawaban model masuk akal sebelum dipakai.
 *
 * Yang diperiksa bukan bentuk JSON-nya — penyedia sudah menegakkannya — melainkan
 * ISINYA: jumlah kriteria yang benar, level yang berada di dalam skala, dan
 * urutan yang lengkap. Model yang melewatkan satu kriteria akan menghasilkan
 * nilai yang terlihat wajar dan diam-diam salah, karena kriteria yang hilang
 * dihitung nol.
 */
export function bacaPenilaian(isi: unknown, rubrik: Rubrik): PenilaianKriteria[] {
  const data = (isi ?? {}) as { kriteria?: unknown };
  const mentah = Array.isArray(data.kriteria) ? data.kriteria : [];

  const peta = new Map<number, PenilaianKriteria>();
  for (const baris of mentah) {
    const k = baris as Partial<PenilaianKriteria>;
    const urut = Number(k.urut);
    if (!Number.isInteger(urut) || urut < 0 || urut >= rubrik.kriteria.length) continue;
    const level = Math.round(Number(k.level));
    if (!Number.isFinite(level)) continue;
    peta.set(urut, {
      urut,
      // Dijepit ke dalam skala. Model yang menjawab level 5 pada rubrik 1–4
      // bukan alasan menolak seluruh penilaian; ia alasan memakai 4.
      level: Math.max(rubrik.skalaMin, Math.min(rubrik.skalaMax, level)),
      alasan: String(k.alasan ?? "").slice(0, 2000),
      terpenuhi: Array.isArray(k.terpenuhi) ? k.terpenuhi.map((t) => String(t).slice(0, 300)).slice(0, 8) : [],
      belum: Array.isArray(k.belum) ? k.belum.map((t) => String(t).slice(0, 300)).slice(0, 8) : [],
    });
  }

  // Kriteria yang tidak dijawab model dikembalikan sebagai level terendah
  // dengan alasan yang mengatakan apa adanya — BUKAN dibuang. Kriteria yang
  // hilang dari daftar akan tampak seperti kriteria yang belum sempat dinilai,
  // dan dosen tidak akan tahu bedanya dari yang memang belum diproses.
  return rubrik.kriteria.map((_, urut) =>
    peta.get(urut) ?? {
      urut,
      level: rubrik.skalaMin,
      alasan: "Model tidak memberi penilaian untuk kriteria ini. Mohon dinilai dosen.",
      terpenuhi: [],
      belum: [],
    },
  );
}

/**
 * Nilai satu jawaban esai dengan rubrik.
 *
 * Melempar GalatModel bila tidak ada penyedia yang terpasang — dan pesannya
 * menyebut apa yang harus dipasang, bukan "terjadi kesalahan".
 */
export async function nilaiEsai(input: {
  rubrik: Rubrik;
  pertanyaan: string;
  jawaban: string;
  mataKuliah?: string;
  acuan?: string;
  penyedia?: NamaPenyedia;
}): Promise<PenilaianEsai> {
  const jawab = await mintaJson({
    sistem: SISTEM,
    perintah: susunPerintah(input),
    skema: skemaPenilaian(input.rubrik.kriteria.length) as unknown as Record<string, unknown>,
    penyedia: input.penyedia,
    // Penilaian esai adalah pekerjaan yang hasilnya menempel pada transkrip
    // seseorang. Di sinilah usaha model memang layak dibayar penuh.
    usaha: "high",
    maksKeluaran: 8_000,
  });

  const isi = (jawab.isi ?? {}) as {
    ringkasan?: unknown; saran?: unknown; keyakinan?: unknown; perluDosen?: unknown;
  };
  const keyakinan = Math.max(0, Math.min(100, Math.round(Number(isi.keyakinan) || 0)));

  return {
    kriteria: bacaPenilaian(jawab.isi, input.rubrik),
    ringkasan: String(isi.ringkasan ?? "").slice(0, 3000),
    saran: Array.isArray(isi.saran) ? isi.saran.map((s) => String(s).slice(0, 400)).slice(0, 4) : [],
    keyakinan,
    // Keyakinan di bawah 70 selalu ditandai perlu dibaca dosen, apa pun yang
    // dikatakan model tentang dirinya sendiri. Model bukan hakim yang baik
    // atas kelayakan penilaiannya sendiri, dan biaya salah di sini ditanggung
    // mahasiswa.
    perluDosen: Boolean(isi.perluDosen) || keyakinan < 70,
    model: jawab.model,
    penyedia: jawab.penyedia,
    versiPerintah: VERSI_PERINTAH,
  };
}

/** Apakah penilaian AI dapat ditawarkan sama sekali di portal ini. */
export function aiSiap(): boolean {
  return penyediaTersedia().length > 0;
}
