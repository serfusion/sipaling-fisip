// ============================================================
// REKAMAN SUARA UJIAN — PENYIMPANAN, TRANSKRIP, DAN PENANDAAN
//
// Mikrofon peserta menyala sepanjang ujian, suaranya dikirim sepotong demi
// sepotong, dan sesudah ujian dosen dapat memutarnya. Bila portal tersambung
// ke model yang dapat mendengar, rekamannya juga dapat ditranskripsikan dan
// penggal yang mencurigakan ditandai beserta jamnya.
//
// ------------------------------------------------------------
// EMPAT BATAS YANG MEMBENTUK RANCANGAN INI
// ------------------------------------------------------------
//
//   1. MATI SECARA BAWAAN. Merekam suara orang adalah keputusan yang harus
//      diambil dengan sadar oleh dosennya, dan pesertanya harus diberi tahu
//      sebelum ujian dimulai — bukan menemukan lampu mikrofon menyala.
//
//   2. POTONGAN, BUKAN SATU BERKAS. Jaringan kampus putus, dan rekaman yang
//      baru dikirim pada akhir ujian akan hilang seluruhnya ketika itu terjadi.
//      Yang sudah sampai tetap ada; yang hilang hanya potongan terakhir.
//
//   3. MIKROFON YANG GAGAL TIDAK PERNAH MENGHENTIKAN UJIAN. Izin ditolak,
//      perangkat tanpa mikrofon, peramban yang tidak mendukung — semuanya
//      DICATAT lalu ujiannya diteruskan. Menghentikan ujian seseorang karena
//      mikrofonnya bermasalah menghukum peserta atas perangkatnya, dan yang
//      paling sering mengalaminya adalah yang perangkatnya paling murah.
//
//   4. KATA KUNCI TIDAK PERNAH MENJADI VONIS. "Kita tidak boleh membuka
//      Google" memuat kata yang dicari dan artinya justru kebalikannya.
//      Karena itu penandaan melewati dua tahap: kata ditemukan, lalu
//      KONTEKSNYA dibaca. Yang keluar adalah tingkat risiko, bukan tuduhan.
//
// Berkas ini murni. Pengunggahan dan pemanggilan model ada di route-nya.
// ============================================================

export type StatusRekaman = "menunggu" | "merekam" | "selesai" | "gagal" | "ditolak";

export const STATUS_REKAMAN_LABEL: Record<StatusRekaman, string> = {
  menunggu: "Belum mulai",
  merekam: "Sedang merekam",
  selesai: "Selesai",
  gagal: "Gagal",
  ditolak: "Izin ditolak",
};

export type StatusTranskrip = "belum" | "berjalan" | "selesai" | "gagal" | "tidak_tersedia";

export const STATUS_TRANSKRIP_LABEL: Record<StatusTranskrip, string> = {
  belum: "Belum ditranskripsikan",
  berjalan: "Sedang diproses",
  selesai: "Selesai",
  gagal: "Gagal",
  tidak_tersedia: "Tidak tersedia di portal ini",
};

/** Hasil pembacaan transkrip satu rekaman. */
export type StatusTanda = "bersih" | "tinjau" | "mencurigakan";

export const STATUS_TANDA_LABEL: Record<StatusTanda, string> = {
  bersih: "Bersih",
  tinjau: "Perlu ditinjau",
  mencurigakan: "Mencurigakan",
};

export const STATUS_TANDA_WARNA: Record<StatusTanda, string> = {
  bersih: "#15803d",
  tinjau: "#b45309",
  mencurigakan: "#b91c1c",
};

export type Risiko = "bersih" | "rendah" | "tinggi";

// ------------------------------------------------------------
// PENYIMPANAN
// ------------------------------------------------------------

export const BUCKET_REKAMAN = process.env.SUPABASE_CBT_REKAMAN_BUCKET || "cbt-rekaman";

/**
 * Bentuk WebM/Opus, yang didukung MediaRecorder di hampir semua peramban.
 *
 * Safari masih menghasilkan MP4/AAC pada sebagian versi. Keduanya diterima —
 * yang menentukan bukan bentuknya melainkan bahwa suaranya sampai.
 */
export const JENIS_REKAMAN = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"] as const;

export function jenisDiterima(mime: unknown): boolean {
  const bersih = String(mime ?? "").split(";")[0].trim().toLowerCase();
  return (JENIS_REKAMAN as readonly string[]).includes(bersih);
}

/** Map penyimpanan satu attempt. */
export function mapRekaman(examId: number, attemptId: number): string {
  return `ujian-${examId}/attempt-${attemptId}`;
}

/**
 * Nama satu potongan, bernomor rata kiri dengan nol.
 *
 * Nol di depan bukan kerapian: daftar objek Storage terurut sebagai TEKS, dan
 * tanpa itu potongan ke-10 berdiri di antara ke-1 dan ke-2. Rekaman yang
 * disusun ulang dari urutan itu akan melompat-lompat tanpa ada yang tahu
 * sebabnya.
 */
export function namaPotongan(urut: number, mime = "audio/webm"): string {
  const nomor = String(Math.max(0, Math.floor(urut))).padStart(5, "0");
  const akhiran = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("mpeg") ? "mp3" : "webm";
  return `${nomor}.${akhiran}`;
}

export function jalurPotongan(examId: number, attemptId: number, urut: number, mime?: string): string {
  return `${mapRekaman(examId, attemptId)}/${namaPotongan(urut, mime)}`;
}

/** Panjang satu potongan. Dua puluh detik: cukup pendek untuk tidak banyak hilang. */
export const DETIK_POTONGAN = 20;

/** Batas ukuran satu potongan yang diterima server. */
export const MAKS_BITA_POTONGAN = 3_000_000;

/**
 * Batas panjang rekaman yang disimpan, dalam detik.
 *
 * Empat jam. Ujian terpanjang yang masuk akal masih di bawahnya, dan batas ini
 * yang menahan satu tab yang tertinggal terbuka semalaman dari mengisi
 * penyimpanan portal sendirian.
 */
export const MAKS_DETIK_REKAMAN = 4 * 60 * 60;

// ------------------------------------------------------------
// KATA KUNCI
// ------------------------------------------------------------

/**
 * Daftar bawaan kata dan frasa yang ditandai.
 *
 * Yang dicari bukan nama aplikasinya, melainkan PERBUATAN membukanya —
 * "buka google", bukan "google". Kata "google" sendirian muncul pada hampir
 * semua kuliah metodologi, dan daftar yang memuatnya akan menandai seluruh
 * kelas.
 *
 * Dosen dapat menambah dan mengurangi daftar ini per ujian. Yang di sini hanya
 * titik berangkatnya, supaya menyalakan fiturnya tidak menuntut pekerjaan
 * menyusun daftar lebih dulu.
 */
export const KATA_BAWAAN: string[] = [
  "buka google",
  "cari di google",
  "googling",
  "buka chatgpt",
  "buka chat gpt",
  "tanya chatgpt",
  "tanya gpt",
  "lihat chatgpt",
  "buka claude",
  "tanya claude",
  "buka gemini",
  "tanya gemini",
  "buka browser",
  "buka whatsapp",
  "buka wa",
  "kirim fotonya",
  "fotoin soalnya",
  "screenshot soalnya",
  "jawaban nomor",
  "nomor berapa jawabannya",
  "kasih tau jawabannya",
  "kasih tahu jawabannya",
  "bacain soalnya",
  "copy paste",
  "salin jawaban",
];

/**
 * Kata yang membalik arti kalimat di sekitarnya.
 *
 * Ditemukan sebelum kata kunci, ia menurunkan risikonya. Inilah satu-satunya
 * hal yang membedakan mahasiswa yang menjelaskan larangan dari mahasiswa yang
 * melanggarnya — dan tanpanya keduanya tercatat sama.
 */
const PEMBALIK = [
  "tidak boleh", "gak boleh", "nggak boleh", "ga boleh", "jangan", "dilarang",
  "tanpa", "bukan", "tidak akan", "gak akan", "nggak usah", "tidak usah",
  "haram", "kalau kita", "seandainya", "misalnya kalau", "tidak pernah",
];

/**
 * Kata yang menandakan kalimat itu ditujukan kepada ORANG LAIN.
 *
 * "Coba buka google" pada ruang ujian yang seharusnya sunyi adalah hal yang
 * lain sama sekali daripada kata yang sama di dalam gumaman. Penanda perintah
 * menaikkan risikonya.
 */
const PERINTAH = [
  "coba", "tolong", "ayo", "cepat", "cepetan", "sini", "bantu", "bantuin",
  "eh", "woi", "bro", "sis", "dong", "deh", "gih", "buruan", "please",
];

export function rapikanKata(daftar: unknown): string[] {
  const mentah = Array.isArray(daftar)
    ? daftar
    : String(daftar ?? "").split(/[\n,;]+/);
  const bersih = mentah
    .map((k) => String(k ?? "").toLowerCase().replace(/\s+/g, " ").trim())
    .filter((k) => k.length >= 3 && k.length <= 80);
  return [...new Set(bersih)].slice(0, 100);
}

/**
 * Teks transkrip yang diseragamkan untuk dicocokkan.
 *
 * Tanda baca dibuang karena pengubah suara ke teks menaruhnya sekenanya:
 * "buka, google" dan "buka google" adalah ucapan yang sama.
 */
export function normalUcapan(teks: string): string {
  return String(teks ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Temuan = {
  keyword: string;
  risk: Risiko;
  reason: string;
};

/**
 * Periksa satu penggal ucapan terhadap daftar kata kunci.
 *
 * Dua tahap, persis seperti yang diminta rancangan:
 *
 *   tahap 1  kata kunci ditemukan?
 *   tahap 2  konteksnya bagaimana?
 *
 * Tahap kedua yang membuatnya layak dipakai. Tanpa itu, dosen akan menerima
 * dua puluh penandaan yang sembilan belas di antaranya keliru — lalu berhenti
 * membaca kolom itu sama sekali, termasuk yang kedua puluh.
 */
export function periksaUcapan(teks: string, kata: string[] = KATA_BAWAAN): Temuan | null {
  const isi = normalUcapan(teks);
  if (!isi) return null;

  const ketemu = kata.find((k) => isi.includes(normalUcapan(k)));
  if (!ketemu) return null;

  const posisi = isi.indexOf(normalUcapan(ketemu));
  // Enam kata sebelum kata kuncinya. Cukup untuk menangkap "kita tidak boleh"
  // dan tidak sampai menyeret kalimat sebelumnya yang membicarakan hal lain.
  const sebelum = isi.slice(Math.max(0, posisi - 60), posisi);

  const dibalik = PEMBALIK.some((p) => sebelum.includes(p));
  if (dibalik) {
    return {
      keyword: ketemu,
      risk: "rendah",
      reason:
        `Kata "${ketemu}" terdengar, tetapi kalimat sebelumnya berisi kata pengingkar ` +
        "— kemungkinan peserta sedang membicarakan larangannya, bukan melakukannya.",
    };
  }

  const memerintah = PERINTAH.some((p) => sebelum.includes(` ${p} `) || sebelum.trim().endsWith(p) || isi.startsWith(`${p} `));
  if (memerintah) {
    return {
      keyword: ketemu,
      risk: "tinggi",
      reason: `Kata "${ketemu}" terdengar dalam bentuk perintah atau ajakan kepada orang lain.`,
    };
  }

  return {
    keyword: ketemu,
    risk: "tinggi",
    reason: `Kata "${ketemu}" terdengar tanpa konteks yang meniadakannya.`,
  };
}

export type Penggal = {
  startSec: number;
  endSec: number;
  text: string;
};

export type PenggalTertanda = Penggal & {
  keyword: string | null;
  risk: Risiko;
  reason: string | null;
};

/** Tandai seluruh penggal transkrip sekaligus. */
export function tandaiTranskrip(penggal: Penggal[], kata: string[] = KATA_BAWAAN): PenggalTertanda[] {
  const daftar = kata.length > 0 ? kata : KATA_BAWAAN;
  return penggal.map((p) => {
    const temuan = periksaUcapan(p.text, daftar);
    return {
      ...p,
      keyword: temuan?.keyword ?? null,
      risk: temuan?.risk ?? "bersih",
      reason: temuan?.reason ?? null,
    };
  });
}

/**
 * Keadaan menyeluruh satu rekaman dari penggal-penggalnya.
 *
 * Tangganya mengikuti rancangan, dan angkanya sengaja tidak ketat:
 *
 *   tanpa penandaan            → bersih
 *   satu-dua berisiko rendah   → perlu ditinjau
 *   ada yang berisiko tinggi   → perlu ditinjau
 *   tiga atau lebih yang tinggi→ mencurigakan
 *
 * Satu penandaan berisiko tinggi TIDAK langsung berarti mencurigakan, dan itu
 * disengaja. Pengubah suara ke teks salah dengar, dan satu salah dengar tidak
 * boleh cukup untuk menaruh kata "mencurigakan" pada laporan ujian seseorang.
 */
export function statusTanda(penggal: PenggalTertanda[]): { status: StatusTanda; jumlah: number } {
  const tinggi = penggal.filter((p) => p.risk === "tinggi").length;
  const rendah = penggal.filter((p) => p.risk === "rendah").length;
  const jumlah = tinggi + rendah;
  if (tinggi >= 3) return { status: "mencurigakan", jumlah };
  if (tinggi >= 1 || rendah >= 1) return { status: "tinjau", jumlah };
  return { status: "bersih", jumlah };
}

/** Jam di dalam rekaman, sebagaimana ditampilkan pada pemutar: 01:23:45. */
export function ejaJamRekaman(detik: number): string {
  const total = Math.max(0, Math.floor(Number(detik) || 0));
  const j = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const d = total % 60;
  const dua = (n: number) => String(n).padStart(2, "0");
  return j > 0 ? `${dua(j)}:${dua(m)}:${dua(d)}` : `${dua(m)}:${dua(d)}`;
}

/**
 * Skema transkrip yang diminta ke model pendengar.
 *
 * Penggalnya diminta PENDEK — sekitar satu kalimat — karena yang dipakai dosen
 * adalah lompatan ke satu titik waktu. Penggal satu menit membuat dosen
 * mendengarkan satu menit untuk menemukan tiga kata.
 */
export const SKEMA_TRANSKRIP = {
  type: "object",
  additionalProperties: false,
  required: ["penggal"],
  properties: {
    penggal: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["mulai", "selesai", "teks"],
        properties: {
          mulai: { type: "number", description: "Detik sejak awal potongan ini." },
          selesai: { type: "number", description: "Detik sejak awal potongan ini." },
          teks: { type: "string", description: "Apa yang terdengar, apa adanya." },
        },
      },
    },
    adaSuara: {
      type: "boolean",
      description: "False bila potongan ini sunyi atau hanya berisi derau.",
    },
  },
} as const;

export const SISTEM_TRANSKRIP = `Anda mengubah rekaman suara ruang ujian menjadi teks.

Tuliskan APA ADANYA yang terdengar, dalam bahasa aslinya (biasanya Bahasa Indonesia,
kadang bercampur bahasa daerah atau Inggris). Jangan merapikan, jangan meringkas, dan
jangan menerjemahkan.

Pecah menjadi penggal pendek, kira-kira satu kalimat atau satu ucapan per penggal, masing-masing
dengan detik mulai dan selesainya terhitung dari awal potongan ini.

Bila sebuah bagian tidak terdengar jelas, tulis bagian itu sebagai [tidak jelas] — JANGAN menebak.
Tebakan pada rekaman ujian dapat menjadi dasar tuduhan terhadap orang yang tidak mengatakannya.

Bila tidak ada suara manusia sama sekali, kembalikan penggal kosong dan adaSuara bernilai false.

Anda TIDAK menilai, tidak menyimpulkan, dan tidak menuduh. Anda hanya menuliskan.`;

export type HasilTranskrip = { penggal: Penggal[]; adaSuara: boolean };

/**
 * Baca jawaban model menjadi penggal yang jamnya sudah digeser.
 *
 * `geser` adalah detik awal potongan ini di dalam rekaman utuh. Model hanya
 * mendengar satu potongan dan menghitung dari nol; tanpa pergeseran ini,
 * seluruh penandaan pada potongan kedua dan seterusnya akan menunjuk menit
 * pertama rekaman.
 */
export function bacaTranskrip(isi: unknown, geser = 0): HasilTranskrip {
  const data = (isi ?? {}) as { penggal?: unknown; adaSuara?: unknown };
  const mentah = Array.isArray(data.penggal) ? data.penggal : [];
  const penggal: Penggal[] = [];
  for (const p of mentah.slice(0, 400)) {
    const baris = p as { mulai?: unknown; selesai?: unknown; teks?: unknown };
    const teks = String(baris.teks ?? "").trim().slice(0, 1000);
    if (!teks) continue;
    const mulai = Math.max(0, Math.round(Number(baris.mulai) || 0));
    const selesai = Math.max(mulai, Math.round(Number(baris.selesai) || mulai));
    penggal.push({ startSec: geser + mulai, endSec: geser + selesai, text: teks });
  }
  return { penggal, adaSuara: penggal.length > 0 && data.adaSuara !== false };
}
