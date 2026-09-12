// ============================================================
// OUTREACH ULTRAMAILER SYSTEM (OUS)
// Bagian yang AMAN dipakai di peramban: tidak menyentuh basis data, tidak
// menyentuh jaringan, tidak membaca sesi. Seluruh isinya fungsi murni,
// sehingga panel dashboard dan pekerja antrean memakai aturan yang sama
// persis — dan aturannya dapat diuji tanpa menyalakan server.
//
//   outreach.ts        (berkas ini) — aturan: sah/tidak, dedup, gabung
//                                     naskah, jatah harian, jeda coba ulang
//   outreach-store.ts               — basis data
//   outreach-kirim.ts               — penyedia email
//
// ------------------------------------------------------------
// SATU HAL YANG HARUS JUJUR DITULIS DI PALING ATAS
// ------------------------------------------------------------
// Tidak ada perangkat lunak yang dapat MENJAMIN sebuah email tidak masuk
// folder spam. Yang memutuskan itu penyedia penerima — Gmail, Outlook,
// Yahoo, server kampus — dan penilaiannya memakai reputasi domain pengirim
// yang dibangun berminggu-minggu, bukan kode di dalam berkas ini.
//
// Yang benar-benar menentukan, berurutan dari yang paling besar dampaknya:
//
//   1. Domain pengirim terautentikasi   — SPF, DKIM, DMARC (di DNS, bukan di sini)
//   2. Volume kecil dan rata            — inilah yang dikerjakan berkas ini
//   3. Satu email satu penerima         — bukan BCC massal
//   4. Berhenti langganan yang berfungsi — dan dihormati selamanya
//   5. Pantulan & keluhan langsung dihentikan
//   6. Isi surat yang wajar, bukan iklan berteriak
//
// Nomor 2 sampai 6 ditegakkan oleh kode. Nomor 1 dikerjakan sekali di panel
// DNS, dan tanpanya seluruh sisanya hampir tidak ada artinya. Itulah sebabnya
// panel OUS menolak menyalakan pengiriman sungguhan sebelum alamat pengirim
// memakai domain yang memang diverifikasi di penyedia email.
// ============================================================

/** Kunci baris pengaturan OUS di tabel app_settings. */
export const OUS_KEY = "outreach_ous";

// ------------------------------------------------------------
// 1. PENGATURAN & SAKLAR SUPER ADMIN
// ------------------------------------------------------------

export type OusState = {
  /**
   * SAKLAR UTAMA. Dipegang Super Admin seorang diri.
   *
   * MATI secara bawaan, dan itu disengaja: sistem yang dapat mengirim ribuan
   * email atas nama fakultas tidak boleh hidup hanya karena kodenya sudah
   * ter-deploy. Ia hidup ketika seseorang yang berwenang menyalakannya.
   */
  enabled: boolean;
  /**
   * Mode simulasi: seluruh alur berjalan, surat dirender, antrean bergerak,
   * statistik terisi — tetapi TIDAK ADA email yang benar-benar keluar.
   *
   * MENYALA secara bawaan. Kampanye pertama yang keliru alamatnya lebih baik
   * tersimpan di layar daripada telanjur mendarat di 300 kotak masuk.
   */
  simulasi: boolean;
  /** Email dosen yang dibukakan menu OUS di dashboardnya. */
  dosen: string[];
  /** Jatah kirim per hari. Dibatasi 10..100 — lihat catatan pada BATAS. */
  hariMaks: number;
  /** Jatah kirim per jam. Meratakan kiriman supaya tidak menumpuk sekaligus. */
  jamMaks: number;
  /** Jeda minimal antar email, dalam detik. */
  jedaDetik: number;
  /** Pemanasan bertahap untuk domain yang masih baru. */
  pemanasan: boolean;
  /** Tanggal (ISO) pengiriman pertama. Dasar hitungan hari pemanasan. */
  pemanasanMulai: string | null;
  /** Jam mulai dan selesai pengiriman, waktu Indonesia Barat (0..23). */
  jamMulai: number;
  jamSelesai: number;
  /** Identitas pengirim. Konsisten dari kampanye ke kampanye. */
  fromName: string;
  fromEmail: string;
  replyTo: string;
  /** Nama dan alamat jurnal, dipakai sebagai nilai bawaan mail merge. */
  jurnalNama: string;
  jurnalUrl: string;
};

/**
 * Batas keras yang tidak dapat dilampaui lewat layar mana pun.
 *
 * hariMaks berhenti di 100 karena itulah angka yang diminta pemilik sistem,
 * dan kebetulan ia juga angka yang masuk akal: pengiriman dingin di atas
 * seratus surat sehari dari domain kampus yang belum pernah mengirim apa-apa
 * adalah cara tercepat masuk daftar hitam. Yang butuh lebih banyak, mengirim
 * lebih lama — bukan lebih deras.
 */
export const BATAS = {
  hariMin: 10,
  hariMaks: 100,
  jamMin: 1,
  jamMaks: 30,
  jedaMin: 20,
  jedaMaks: 600,
  /** Satu kampanye tidak boleh lebih besar dari ini. */
  penerimaPerKampanye: 5000,
  /** Percobaan kirim maksimum untuk satu penerima. */
  cobaMaks: 3,
} as const;

export const DEFAULT_OUS: OusState = {
  enabled: false,
  simulasi: true,
  // Dosen pengurus jurnal NYIMAK. Daftarnya tetap dapat diubah Super Admin
  // dari panel; yang ditulis di sini hanyalah keadaan awal pemasangan.
  dosen: ["basit@umt.ac.id"],
  hariMaks: 60,
  jamMaks: 12,
  jedaDetik: 45,
  pemanasan: true,
  pemanasanMulai: null,
  jamMulai: 8,
  jamSelesai: 17,
  fromName: "NYIMAK Editorial Team",
  fromEmail: "",
  replyTo: "",
  jurnalNama: "NYIMAK: Journal of Communication",
  jurnalUrl: "https://jurnal.umt.ac.id/index.php/nyimak",
};

function angka(nilai: unknown, bawaan: number, min: number, maks: number) {
  const n = typeof nilai === "number" ? nilai : Number(nilai);
  if (!Number.isFinite(n)) return bawaan;
  return Math.min(maks, Math.max(min, Math.round(n)));
}

function teks(nilai: unknown, bawaan: string, maks: number) {
  if (typeof nilai !== "string") return bawaan;
  const rapi = nilai.replace(/\s+/g, " ").trim();
  return rapi ? rapi.slice(0, maks) : bawaan;
}

/**
 * Mengubah apa pun menjadi OusState yang pasti sah.
 *
 * Dipakai di dua sisi — saat membaca baris app_settings dan saat menerima
 * badan permintaan PUT — supaya batas angkanya tidak pernah berbeda antara
 * "yang tersimpan" dan "yang dikirim dari layar".
 */
export function normalkanOus(masukan: unknown): OusState {
  const raw = (typeof masukan === "object" && masukan ? masukan : {}) as Partial<OusState>;
  const jamMulai = angka(raw.jamMulai, DEFAULT_OUS.jamMulai, 0, 23);
  const jamSelesai = angka(raw.jamSelesai, DEFAULT_OUS.jamSelesai, 0, 23);
  return {
    // Keduanya hanya menyala bila diminta tegas. Pengaturan lama yang belum
    // punya kolomnya karena itu terbaca sebagai "mati" dan "simulasi" —
    // keadaan paling aman yang bisa dibaca dari data yang tidak lengkap.
    enabled: raw.enabled === true,
    simulasi: raw.simulasi !== false,
    dosen: daftarEmail(raw.dosen),
    hariMaks: angka(raw.hariMaks, DEFAULT_OUS.hariMaks, BATAS.hariMin, BATAS.hariMaks),
    jamMaks: angka(raw.jamMaks, DEFAULT_OUS.jamMaks, BATAS.jamMin, BATAS.jamMaks),
    jedaDetik: angka(raw.jedaDetik, DEFAULT_OUS.jedaDetik, BATAS.jedaMin, BATAS.jedaMaks),
    pemanasan: raw.pemanasan !== false,
    pemanasanMulai: typeof raw.pemanasanMulai === "string" && raw.pemanasanMulai ? raw.pemanasanMulai : null,
    // Jendela terbalik (mis. mulai 20, selesai 6) tidak ditolak melainkan
    // dirapikan menjadi satu hari penuh: yang salah setel lebih baik mengirim
    // kapan saja daripada tidak pernah mengirim sama sekali tanpa keterangan.
    jamMulai: jamSelesai > jamMulai ? jamMulai : 0,
    jamSelesai: jamSelesai > jamMulai ? jamSelesai : 23,
    fromName: teks(raw.fromName, DEFAULT_OUS.fromName, 80),
    fromEmail: rapikanEmail(raw.fromEmail) || "",
    replyTo: rapikanEmail(raw.replyTo) || "",
    jurnalNama: teks(raw.jurnalNama, DEFAULT_OUS.jurnalNama, 120),
    jurnalUrl: teks(raw.jurnalUrl, DEFAULT_OUS.jurnalUrl, 300),
  };
}

export function parseOus(nilai: string | null | undefined): OusState {
  if (!nilai) return DEFAULT_OUS;
  try {
    return normalkanOus(JSON.parse(nilai));
  } catch {
    return DEFAULT_OUS;
  }
}

function daftarEmail(nilai: unknown): string[] {
  const isi = Array.isArray(nilai) ? nilai : [];
  const keluar: string[] = [];
  for (const item of isi) {
    const email = rapikanEmail(item);
    if (email && !keluar.includes(email)) keluar.push(email);
    if (keluar.length >= 50) break;
  }
  return keluar;
}

// ------------------------------------------------------------
// 2. SIAPA YANG BOLEH MEMAKAI OUS
// ------------------------------------------------------------

/**
 * Peran yang selalu dipertimbangkan, tanpa perlu masuk daftar dosen.
 *
 * Dosen TIDAK ada di sini dengan sengaja: menu ini terbuka untuk dosen yang
 * memang mengurus jurnal, satu per satu, bukan untuk seluruh dosen fakultas.
 */
const PERAN_OUS = new Set(["super_admin", "admin"]);

/**
 * Bolehkah orang ini MEMAKAI OUS — membuat kampanye dan mengirim?
 *
 * Perhatikan bahwa saklar utama diperiksa untuk SEMUA peran, Super Admin
 * sekalipun. Saklar yang pemegangnya sendiri kebal bukan saklar; ia sekadar
 * pagar untuk orang lain. Yang membedakan Super Admin hanyalah ia dapat
 * membuka panelnya untuk menyalakan kembali — lihat bolehLihatOus.
 */
export function bolehPakaiOus(
  profil: { role: string; email: string } | null | undefined,
  state: OusState,
): boolean {
  if (!profil) return false;
  if (!state.enabled) return false;
  if (PERAN_OUS.has(profil.role)) return true;
  if (profil.role !== "dosen") return false;
  const email = rapikanEmail(profil.email);
  return Boolean(email) && state.dosen.includes(email);
}

/**
 * Bolehkah orang ini MELIHAT menu OUS?
 *
 * Sama dengan di atas, kecuali satu perkecualian: Super Admin tetap melihat
 * menunya ketika saklarnya mati, sebab di situlah saklarnya berada. Tanpa
 * perkecualian ini, OUS yang sekali dimatikan tidak akan pernah dapat
 * dinyalakan kembali dari dalam sistemnya sendiri — persis kekeliruan yang
 * sudah dihindari mode maintenance.
 */
export function bolehLihatOus(
  profil: { role: string; email: string } | null | undefined,
  state: OusState,
): boolean {
  if (!profil) return false;
  if (profil.role === "super_admin") return true;
  return bolehPakaiOus(profil, state);
}

/** Hanya Super Admin yang boleh mengubah saklar dan pengaturan OUS. */
export function bolehAturOus(profil: { role: string } | null | undefined): boolean {
  return profil?.role === "super_admin";
}

// ------------------------------------------------------------
// 3. ALAMAT EMAIL: RAPIKAN, PERIKSA, SARING
// ------------------------------------------------------------

/**
 * Panjang maksimum menurut RFC 5321: 64 huruf sebelum @, 254 seluruhnya.
 * Alamat yang lebih panjang ditolak server penerima, jadi menahannya di sini
 * menghemat satu pantulan yang ikut menggerus reputasi domain.
 */
const MAKS_LOKAL = 64;
const MAKS_EMAIL = 254;

/**
 * Pola alamat email.
 *
 * SENGAJA tidak memakai pola "lengkap" RFC 5322 yang panjangnya ratusan
 * karakter: yang itu menerima bentuk-bentuk sah yang tidak pernah dipakai
 * manusia, dan tetap tidak dapat membuktikan alamatnya hidup. Yang dipakai
 * di sini menolak yang jelas-jelas rusak — itu saja tugasnya.
 */
const POLA_EMAIL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

/**
 * Membuang spasi, kurung sudut, dan huruf besar.
 *
 *   " John Smith <JOHN@University.EDU> "  →  "john@university.edu"
 *   "JOHN@UNIVERSITY.EDU"                 →  "john@university.edu"
 *
 * Mengembalikan "" bila bentuknya tidak sah. Pemanggil karena itu cukup
 * memeriksa nilai kosong, bukan memanggil dua fungsi berturut-turut.
 */
export function rapikanEmail(nilai: unknown): string {
  if (typeof nilai !== "string") return "";
  let isi = nilai.trim();
  const kurung = isi.match(/<([^>]+)>\s*$/);
  if (kurung) isi = kurung[1].trim();
  isi = isi.replace(/^mailto:/i, "").trim();
  // Tanda baca yang ikut tersalin dari daftar: "john@abc.edu," atau "…;"
  isi = isi.replace(/[;,.]+$/, "").trim();
  const email = isi.toLowerCase();
  if (!email || email.length > MAKS_EMAIL) return "";
  const at = email.lastIndexOf("@");
  if (at < 1 || email.slice(0, at).length > MAKS_LOKAL) return "";
  if (email.includes("..")) return "";
  if (!POLA_EMAIL.test(email)) return "";
  return email;
}

/** Bentuk alamatnya sah? Tidak berarti alamatnya hidup — itu soal lain. */
export function emailSah(nilai: unknown): boolean {
  return rapikanEmail(nilai) !== "";
}

/** Nama domain sesudah tanda @, untuk pengelompokan dan penjagaan laju. */
export function domainEmail(nilai: string): string {
  const email = rapikanEmail(nilai);
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(at + 1) : "";
}

/**
 * Menyamarkan alamat untuk ditampilkan di layar yang tidak perlu melihatnya
 * utuh: "john.smith@university.edu" → "jo•••••••@university.edu".
 */
export function samarkanEmail(nilai: string): string {
  const email = rapikanEmail(nilai);
  if (!email) return "";
  const at = email.lastIndexOf("@");
  const lokal = email.slice(0, at);
  const sisa = email.slice(at);
  if (lokal.length <= 2) return `${lokal[0] || ""}•${sisa}`;
  return `${lokal.slice(0, 2)}${"•".repeat(Math.min(7, lokal.length - 2))}${sisa}`;
}

// ------------------------------------------------------------
// 4. PEMBACA DAFTAR PENERIMA
// ------------------------------------------------------------

export type Penerima = {
  email: string;
  name: string | null;
  institution: string | null;
  field: string | null;
  country: string | null;
};

function bersihkanKolom(nilai: string | undefined | null, maks = 160): string | null {
  if (typeof nilai !== "string") return null;
  const rapi = nilai.replace(/\s+/g, " ").trim().slice(0, maks);
  return rapi || null;
}

/**
 * Membaca daftar yang ditempel admin ke dalam kotak teks.
 *
 * Menerima apa adanya bentuk yang benar-benar beredar di surel undangan:
 *
 *   john@university.edu
 *   John Smith <john@university.edu>
 *   "Jane Lee" <jane@university.edu>
 *   a@x.edu, b@y.edu; c@z.edu
 *
 * Yang tidak terbaca TIDAK dibuang diam-diam — ia dikembalikan pada daftar
 * `tidakSah` supaya orangnya dapat melihat baris mana yang bermasalah.
 */
export function uraiTempelan(teksMasuk: string): { penerima: Penerima[]; tidakSah: string[] } {
  const penerima: Penerima[] = [];
  const tidakSah: string[] = [];
  if (typeof teksMasuk !== "string") return { penerima, tidakSah };

  // Baris dipecah dulu, lalu koma/titik-koma di dalam satu baris. Nama yang
  // memuat koma ("Lee, Jane <jane@x.edu>") karena itu ikut terpotong; yang
  // tersisa tetap alamatnya, dan alamat itulah yang menentukan.
  const potongan = teksMasuk
    .split(/[\r\n]+/)
    .flatMap((baris) => (baris.includes("<") ? [baris] : baris.split(/[;,]/)))
    .map((item) => item.trim())
    .filter(Boolean);

  for (const item of potongan) {
    const email = rapikanEmail(item);
    if (!email) {
      tidakSah.push(item.slice(0, 120));
      continue;
    }
    // Nama diambil dari bagian sebelum kurung sudut, bila ada.
    const kurung = item.match(/^(.*?)<[^>]+>\s*$/);
    const nama = kurung ? kurung[1].replace(/["']/g, "").trim() : "";
    penerima.push({
      email,
      name: bersihkanKolom(nama),
      institution: null,
      field: null,
      country: null,
    });
  }
  return { penerima, tidakSah };
}

/**
 * Pembaca CSV kecil yang mengerti tanda kutip dan pemisah koma maupun titik
 * koma. Sengaja ditulis sendiri, bukan menarik pustaka: yang dibaca adalah
 * berkas daftar alamat berkolom sedikit, dan pustaka CSV penuh membawa
 * permukaan serangan yang tidak sebanding dengan tiga puluh baris ini.
 */
function baris(teksMasuk: string, pemisah: string): string[][] {
  const hasil: string[][] = [];
  let sel = "";
  let larik: string[] = [];
  let dalamKutip = false;

  for (let i = 0; i < teksMasuk.length; i++) {
    const huruf = teksMasuk[i];
    if (dalamKutip) {
      if (huruf === '"') {
        if (teksMasuk[i + 1] === '"') {
          sel += '"';
          i++;
        } else dalamKutip = false;
      } else sel += huruf;
      continue;
    }
    if (huruf === '"') {
      dalamKutip = true;
      continue;
    }
    if (huruf === pemisah) {
      larik.push(sel);
      sel = "";
      continue;
    }
    if (huruf === "\n") {
      larik.push(sel);
      hasil.push(larik);
      larik = [];
      sel = "";
      continue;
    }
    if (huruf === "\r") continue;
    sel += huruf;
  }
  if (sel || larik.length) {
    larik.push(sel);
    hasil.push(larik);
  }
  return hasil.filter((item) => item.some((kolom) => kolom.trim() !== ""));
}

const JUDUL_KOLOM: Record<string, keyof Penerima> = {
  email: "email",
  "e-mail": "email",
  alamat: "email",
  mail: "email",
  name: "name",
  nama: "name",
  fullname: "name",
  "full name": "name",
  institution: "institution",
  institusi: "institution",
  affiliation: "institution",
  university: "institution",
  field: "field",
  bidang: "field",
  topic: "field",
  research: "field",
  country: "country",
  negara: "country",
};

/**
 * Membaca berkas CSV berkolom `email` beserta kolom pelengkap.
 *
 * Baris judul dikenali dari isinya, bukan dari keberadaannya: berkas tanpa
 * judul yang baris pertamanya sudah berupa alamat tetap terbaca utuh, dan
 * alamat pertama tidak ikut hilang menjadi "judul kolom".
 */
export function uraiCsv(teksMasuk: string): { penerima: Penerima[]; tidakSah: string[] } {
  const penerima: Penerima[] = [];
  const tidakSah: string[] = [];
  if (typeof teksMasuk !== "string" || !teksMasuk.trim()) return { penerima, tidakSah };

  const pemisah = (teksMasuk.match(/;/g)?.length || 0) > (teksMasuk.match(/,/g)?.length || 0) ? ";" : ",";
  const semua = baris(teksMasuk, pemisah);
  if (semua.length === 0) return { penerima, tidakSah };

  const kepala = semua[0].map((kolom) => kolom.trim().toLowerCase());
  const adaJudul = kepala.some((kolom) => JUDUL_KOLOM[kolom] === "email") && !emailSah(semua[0][0]);
  const peta = adaJudul
    ? kepala.map((kolom) => JUDUL_KOLOM[kolom] || null)
    : semua[0].map((_, i) => (i === 0 ? ("email" as const) : null));

  for (const larik of semua.slice(adaJudul ? 1 : 0)) {
    const isi: Record<string, string> = {};
    peta.forEach((kunci, i) => {
      if (kunci) isi[kunci] = (larik[i] || "").trim();
    });
    // Berkas tanpa judul yang kolom pertamanya bukan alamat: cari alamat di
    // kolom mana pun, supaya berkas ekspor apa adanya tetap dapat dipakai.
    const email = rapikanEmail(isi.email) || rapikanEmail(larik.find((kolom) => emailSah(kolom)));
    if (!email) {
      tidakSah.push(larik.join(pemisah).slice(0, 120));
      continue;
    }
    penerima.push({
      email,
      name: bersihkanKolom(isi.name),
      institution: bersihkanKolom(isi.institution),
      field: bersihkanKolom(isi.field),
      country: bersihkanKolom(isi.country, 80),
    });
  }
  return { penerima, tidakSah };
}

export type RingkasanPenerima = {
  /** Baris yang terbaca dari tempelan/CSV, sebelum apa pun disaring. */
  total: number;
  /** Siap dikirimi. */
  valid: Penerima[];
  /** Alamat yang sama muncul lebih dari sekali. */
  duplikat: string[];
  /** Bentuk alamatnya rusak. */
  tidakSah: string[];
  /** Pernah berhenti langganan, memantul keras, atau mengadu. */
  tercekal: string[];
};

/**
 * Menyaring daftar mentah menjadi daftar yang benar-benar akan dikirimi.
 *
 * Urutannya penting dan disengaja: bentuk rusak dibuang dulu, lalu duplikat,
 * baru daftar cekal. Alamat yang sama ditempel dua kali dan kebetulan ada di
 * daftar cekal karena itu dihitung SEKALI sebagai tercekal, bukan sekali
 * sebagai duplikat dan sekali lagi sebagai tercekal — angka yang muncul di
 * layar harus dapat dijumlahkan kembali menjadi totalnya.
 *
 * Penerima yang muncul dua kali dengan data berbeda digabung, bukan dibuang:
 * baris kedua sering justru yang membawa nama dan institusinya.
 */
export function saringPenerima(
  mentah: Penerima[],
  tidakSahAwal: string[],
  cekal: Iterable<string> = [],
): RingkasanPenerima {
  const daftarCekal = new Set<string>();
  for (const item of cekal) {
    const email = rapikanEmail(item);
    if (email) daftarCekal.add(email);
  }

  const terlihat = new Map<string, Penerima>();
  const duplikat: string[] = [];
  const tercekal: string[] = [];

  for (const item of mentah) {
    const email = rapikanEmail(item.email);
    if (!email) continue;
    if (daftarCekal.has(email)) {
      if (!tercekal.includes(email)) tercekal.push(email);
      continue;
    }
    const sudah = terlihat.get(email);
    if (sudah) {
      duplikat.push(email);
      // Kolom yang tadinya kosong diisi dari baris berikutnya.
      terlihat.set(email, {
        email,
        name: sudah.name || item.name,
        institution: sudah.institution || item.institution,
        field: sudah.field || item.field,
        country: sudah.country || item.country,
      });
      continue;
    }
    terlihat.set(email, { ...item, email });
  }

  return {
    total: mentah.length + tidakSahAwal.length,
    valid: [...terlihat.values()],
    duplikat,
    tidakSah: tidakSahAwal,
    tercekal,
  };
}

// ------------------------------------------------------------
// 5. MESIN MAIL MERGE
// ------------------------------------------------------------

/** Peubah yang dikenali naskah. Ditampilkan di layar penyunting template. */
export const PEUBAH = [
  "name",
  "institution",
  "field",
  "country",
  "journal_name",
  "submission_url",
  "unsubscribe_url",
  "sender_name",
] as const;

/**
 * Nilai pengganti ketika datanya kosong.
 *
 * Inilah bagian yang paling sering dikerjakan asal-asalan, dan akibatnya
 * terbaca jelas oleh penerimanya: "Dear ," atau "invite  to consider" adalah
 * tanda surat massal yang bahkan pengirimnya tidak membaca ulang. Kolom yang
 * tidak punya pengganti wajar dikosongkan beserta kalimatnya — lihat
 * gabungNaskah.
 */
const BAWAAN_PEUBAH: Record<string, string> = {
  name: "Researcher",
  institution: "your institution",
  field: "your field of research",
  country: "",
};

const POLA_PEUBAH = /\{\{\s*([a-z_][a-z0-9_]*)\s*(?:\|([^}]*))?\}\}/gi;

/** Meloloskan huruf yang berarti sesuatu di dalam HTML. */
export function lolosHtml(nilai: string): string {
  return nilai
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type DataMerge = Record<string, string | null | undefined>;

/**
 * Menggabungkan naskah dengan data satu penerima.
 *
 * Urutan pencarian nilai untuk {{x|cadangan}}:
 *   1. data[x] bila terisi
 *   2. "cadangan" yang ditulis di naskah
 *   3. BAWAAN_PEUBAH[x]
 *   4. string kosong
 *
 * `html` menentukan apakah nilainya diloloskan. Ini BUKAN sekadar kerapian:
 * nama penerima datang dari berkas CSV yang ditempel orang, dan naskah HTML
 * yang menyisipkannya mentah-mentah adalah lubang penyuntikan skrip yang
 * kebetulan dikirimkan ke ratusan kotak masuk.
 */
export function gabungNaskah(naskah: string, data: DataMerge, html = false): string {
  if (typeof naskah !== "string") return "";
  return naskah.replace(POLA_PEUBAH, (_cocok, nama: string, cadangan?: string) => {
    const kunci = nama.toLowerCase();
    const nilai = data[kunci];
    const isi =
      (typeof nilai === "string" && nilai.trim() ? nilai.trim() : "") ||
      (typeof cadangan === "string" && cadangan.trim() ? cadangan.trim() : "") ||
      BAWAAN_PEUBAH[kunci] ||
      "";
    return html ? lolosHtml(isi) : isi;
  });
}

/** Peubah yang dipakai sebuah naskah, untuk ditunjukkan di penyunting. */
export function peubahDipakai(naskah: string): string[] {
  const keluar: string[] = [];
  const pola = new RegExp(POLA_PEUBAH.source, "gi");
  let cocok = pola.exec(naskah);
  while (cocok) {
    const nama = cocok[1].toLowerCase();
    if (!keluar.includes(nama)) keluar.push(nama);
    cocok = pola.exec(naskah);
  }
  return keluar;
}

/**
 * Versi teks biasa dari naskah HTML.
 *
 * Setiap surat dikirim dengan DUA badan sekaligus. Alasannya bukan kerapian:
 * surat yang hanya berisi HTML adalah salah satu penanda yang paling sering
 * dipakai penyaring spam, dan sebagian penerima — terutama di server kampus
 * yang tua — memang membaca versi teksnya.
 */
export function keTeksBiasa(html: string): string {
  if (typeof html !== "string") return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_c, tautan: string, isi: string) =>
      `${isi.replace(/<[^>]+>/g, "").trim()} ( ${tautan} )`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<hr\s*\/?>/gi, "\n----------\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((item) => item.trim())
    .join("\n")
    .trim();
}

// ------------------------------------------------------------
// 6. PEMERIKSA NADA — supaya suratnya tidak terbaca seperti iklan
// ------------------------------------------------------------

/**
 * Kata dan bentuk yang paling sering menaikkan skor spam.
 *
 * Daftar ini BUKAN aturan penyaring mana pun; tidak ada penyaring yang
 * menerbitkan aturannya. Ia rangkuman dari hal-hal yang sudah lama diketahui
 * membuat sebuah surat terbaca seperti iklan, dan gunanya di sini sederhana:
 * menunjukkannya kepada penulisnya SEBELUM kampanye berjalan.
 */
const KATA_RISIKO = [
  "act now", "apply now", "best price", "buy now", "cash bonus", "cheap",
  "click here", "congratulations you", "credit card", "discount", "don't delete",
  "double your", "earn money", "exclusive deal", "fast cash", "free access",
  "free gift", "free money", "guarantee", "guaranteed", "hurry", "instant",
  "limited offer", "limited slots", "limited time", "lowest price", "make money",
  "no cost", "no fees", "no obligation", "once in a lifetime", "order now",
  "paid publication", "pay now", "risk free", "special promotion", "this is not spam",
  "urgent", "while supplies last", "winner", "you have been selected",
];

export type Temuan = {
  /** "berat" menahan kampanye; "ringan" hanya peringatan di layar. */
  tingkat: "berat" | "ringan";
  pesan: string;
};

export type HasilNada = {
  /** 0 = bersih, 100 = hampir pasti dianggap sampah. */
  skor: number;
  temuan: Temuan[];
  /** Ada temuan berat — panel menolak menjalankan kampanyenya. */
  tertahan: boolean;
};

/**
 * Berapa bagian dari hurufnya yang kapital.
 *
 * `minimal` ada karena ambang yang tepat berbeda antara subjek dan badan
 * surat. Badan surat butuh contoh yang cukup panjang sebelum rasionya berarti
 * apa-apa; subjek justru sebaliknya — "PUBLISH NOW!!!" hanya empat belas
 * huruf, dan itulah bentuk yang paling perlu ditegur. Ambang tunggal 20 huruf
 * membuat subjek pendek yang berteriak lolos begitu saja.
 */
function rasioHurufBesar(isi: string, minimal = 20): number {
  const huruf = isi.replace(/[^A-Za-z]/g, "");
  if (huruf.length < minimal) return 0;
  const besar = isi.replace(/[^A-Z]/g, "").length;
  return besar / huruf.length;
}

/**
 * Memeriksa subjek dan badan surat terhadap hal-hal yang membuatnya terbaca
 * seperti sampah. Menghasilkan skor dan daftar temuan yang dapat dibaca.
 *
 * Perhatikan apa yang dijadikan temuan BERAT: tidak ada tautan berhenti
 * langganan, dan subjek berteriak. Keduanya bukan soal selera — yang pertama
 * adalah kewajiban pada hampir semua yurisdiksi dan syarat semua penyedia,
 * yang kedua adalah penanda paling kasar yang ada.
 */
export function periksaNada(subjek: string, html: string, teksBiasa = ""): HasilNada {
  const temuan: Temuan[] = [];
  const isiTeks = teksBiasa || keTeksBiasa(html);
  const gabungan = `${subjek}\n${isiTeks}`.toLowerCase();
  let skor = 0;

  const berat = (pesan: string, nilai: number) => {
    temuan.push({ tingkat: "berat", pesan });
    skor += nilai;
  };
  const ringan = (pesan: string, nilai: number) => {
    temuan.push({ tingkat: "ringan", pesan });
    skor += nilai;
  };

  // --- subjek ---
  const subjekRapi = (subjek || "").trim();
  if (!subjekRapi) berat("Subjek masih kosong.", 30);
  else {
    if (subjekRapi.length > 78) ringan(`Subjek terlalu panjang (${subjekRapi.length} huruf, sebaiknya di bawah 78).`, 8);
    if (subjekRapi.length < 15) ringan("Subjek terlalu pendek; subjek sangat pendek sering dibaca sebagai surat massal.", 6);
    if (rasioHurufBesar(subjekRapi, 12) > 0.6) berat("Subjek ditulis hampir seluruhnya dengan HURUF BESAR.", 25);
    if ((subjekRapi.match(/!/g) || []).length >= 2) berat("Subjek memuat lebih dari satu tanda seru.", 20);
    if (/^(re|fwd):/i.test(subjekRapi)) ringan('Subjek diawali "Re:" atau "Fwd:" padahal ini surat pertama.', 12);
    if (/[\u{1F300}-\u{1FAFF}]/u.test(subjekRapi)) ringan("Subjek memuat emoji; pada surat akademik ini menurunkan kesan resmi.", 5);
  }

  // --- badan ---
  if (isiTeks.length < 200) ringan("Isi surat sangat pendek; surat yang terlalu ringkas sering ditandai sebagai massal.", 10);
  if (isiTeks.length > 8000) ringan("Isi surat sangat panjang; undangan yang baik jarang melebihi satu layar.", 4);
  if ((isiTeks.match(/!/g) || []).length >= 4) ringan("Terlalu banyak tanda seru pada isi surat.", 8);
  if (rasioHurufBesar(isiTeks) > 0.35) ringan("Terlalu banyak HURUF BESAR pada isi surat.", 10);

  const tautan = html.match(/href\s*=\s*["'][^"']+["']/gi) || [];
  if (tautan.length > 6) ringan(`Ada ${tautan.length} tautan di dalam surat; sebaiknya paling banyak tiga.`, 10);
  if (/https?:\/\/(bit\.ly|tinyurl|goo\.gl|t\.co|is\.gd|cutt\.ly)/i.test(html)) {
    berat("Memakai pemendek tautan. Hampir semua penyaring memperlakukannya sebagai penyamaran alamat.", 25);
  }
  if (/<img\b/i.test(html) && isiTeks.length < 120) {
    berat("Surat hampir seluruhnya gambar tanpa teks yang cukup.", 20);
  }

  const ketemu = KATA_RISIKO.filter((kata) => gabungan.includes(kata));
  if (ketemu.length > 0) {
    const daftar = ketemu.slice(0, 5).join(", ");
    ringan(`Memuat ungkapan berisiko: ${daftar}${ketemu.length > 5 ? ", …" : ""}.`, Math.min(30, ketemu.length * 7));
  }

  // --- kewajiban ---
  if (!/\{\{\s*unsubscribe_url\s*\}\}/i.test(html) && !/unsubscribe/i.test(html)) {
    berat("Tidak ada tautan berhenti langganan. Kampanye tidak dapat dijalankan tanpa ini.", 35);
  }
  if (!/\{\{\s*name/i.test(html)) {
    ringan("Surat tidak menyapa penerimanya dengan {{name}}; personalisasi menurunkan risiko spam.", 6);
  }

  return { skor: Math.min(100, skor), temuan, tertahan: temuan.some((item) => item.tingkat === "berat") };
}

/** Pita risiko untuk ditampilkan sebagai lencana berwarna. */
export function pitaNada(skor: number): "baik" | "sedang" | "buruk" {
  if (skor <= 15) return "baik";
  if (skor <= 40) return "sedang";
  return "buruk";
}

// ------------------------------------------------------------
// 7. JATAH HARIAN, PEMANASAN, DAN JENDELA KIRIM
// ------------------------------------------------------------

/**
 * Jatah hari ini untuk domain yang sedang dipanaskan.
 *
 * Pemanasan adalah satu-satunya cara domain baru membangun reputasi tanpa
 * dicurigai: mulai kecil, naik perlahan, jangan pernah melonjak. Tabelnya
 * dibuat lambat dengan sengaja — dua minggu pertama adalah bagian termurah
 * dari seluruh proses, dan bagian yang paling mahal bila dilewatkan.
 *
 *   hari 1–2  : 20 per hari
 *   hari 3–4  : 30
 *   hari 5–6  : 40
 *   hari 7–9  : 50
 *   hari 10+  : sesuai jatah penuh
 */
export function jatahPemanasan(hariKe: number): number {
  if (hariKe <= 2) return 20;
  if (hariKe <= 4) return 30;
  if (hariKe <= 6) return 40;
  if (hariKe <= 9) return 50;
  return BATAS.hariMaks;
}

/** Berapa hari sistem ini sudah mengirim, dihitung dari kiriman pertama. */
export function hariPemanasan(mulai: string | null, sekarang: Date): number {
  if (!mulai) return 1;
  const awal = new Date(mulai);
  if (Number.isNaN(awal.getTime())) return 1;
  const selisih = Math.floor((sekarang.getTime() - awal.getTime()) / 86_400_000);
  return Math.max(1, selisih + 1);
}

/** Jatah yang benar-benar berlaku hari ini: yang disetel, dipotong pemanasan. */
export function jatahHariIni(state: OusState, sekarang: Date): number {
  if (!state.pemanasan) return state.hariMaks;
  return Math.min(state.hariMaks, jatahPemanasan(hariPemanasan(state.pemanasanMulai, sekarang)));
}

/**
 * Jam berapa sekarang di Indonesia Barat?
 *
 * Dihitung dari UTC, BUKAN dari zona waktu mesinnya. Fungsi serverless
 * berjalan dengan TZ=UTC, dan jendela kirim "08:00–17:00" yang diam-diam
 * berarti 15:00–24:00 WIB adalah jenis kekeliruan yang baru ketahuan setelah
 * seluruh kampanye terkirim tengah malam.
 */
export function jamWib(waktu: Date): number {
  return (waktu.getUTCHours() + 7) % 24;
}

/** Nama hari dalam sepekan menurut WIB (0 = Minggu). */
export function hariWib(waktu: Date): number {
  const wib = new Date(waktu.getTime() + 7 * 3_600_000);
  return wib.getUTCDay();
}

export type KeadaanAntrean = {
  /** Terkirim dalam 24 jam terakhir. */
  hariIni: number;
  /** Terkirim dalam 60 menit terakhir. */
  jamIni: number;
  /** Detik sejak kiriman terakhir. Null bila belum pernah mengirim. */
  sejakTerakhir: number | null;
};

export type IzinKirim = {
  boleh: boolean;
  /** Berapa pucuk yang boleh diambil pada putaran ini. */
  jatah: number;
  /** Alasan, untuk ditampilkan di layar dan dicatat di log. */
  alasan: string;
};

/**
 * Bolehkah pekerja mengambil surat berikutnya sekarang?
 *
 * Inilah gerbang yang membuat "50–100 per hari" menjadi kenyataan, dan ia
 * memeriksa EMPAT hal berurutan dari yang paling menentukan:
 *
 *   1. jendela jam   — tidak mengirim tengah malam
 *   2. jatah harian  — termasuk potongan pemanasan
 *   3. jatah per jam — supaya tidak habis dalam sepuluh menit
 *   4. jeda          — jarak minimal antar pucuk
 *
 * Yang ditolak TIDAK ditandai gagal; ia tetap menunggu di antrean dan diambil
 * pada putaran berikutnya. Penundaan bukan kegagalan.
 */
export function izinKirim(state: OusState, keadaan: KeadaanAntrean, sekarang: Date): IzinKirim {
  if (!state.enabled) return { boleh: false, jatah: 0, alasan: "Saklar OUS sedang dimatikan Super Admin." };

  const jam = jamWib(sekarang);
  if (jam < state.jamMulai || jam >= state.jamSelesai) {
    return {
      boleh: false,
      jatah: 0,
      alasan: `Di luar jam kirim (${state.jamMulai}.00–${state.jamSelesai}.00 WIB). Antrean dilanjutkan besok pagi.`,
    };
  }

  const jatahHari = jatahHariIni(state, sekarang);
  const sisaHari = jatahHari - keadaan.hariIni;
  if (sisaHari <= 0) {
    return { boleh: false, jatah: 0, alasan: `Jatah hari ini sudah habis (${jatahHari} surat).` };
  }

  const sisaJam = state.jamMaks - keadaan.jamIni;
  if (sisaJam <= 0) {
    return { boleh: false, jatah: 0, alasan: `Jatah jam ini sudah habis (${state.jamMaks} surat per jam).` };
  }

  if (keadaan.sejakTerakhir !== null && keadaan.sejakTerakhir < state.jedaDetik) {
    const sisa = state.jedaDetik - keadaan.sejakTerakhir;
    return { boleh: false, jatah: 0, alasan: `Menunggu jeda antar surat (${sisa} detik lagi).` };
  }

  return { boleh: true, jatah: Math.max(1, Math.min(sisaHari, sisaJam)), alasan: "" };
}

/**
 * Jeda sebenarnya sebelum surat berikutnya, beserta guncangan acak.
 *
 * Guncangan bukan hiasan: pengiriman yang jaraknya persis sama tiap kali
 * adalah pola mesin, dan pola mesin justru yang dicari penyaring. Rentangnya
 * 80%–130% dari jeda yang disetel.
 */
export function jedaBerikutnya(state: OusState, acak = Math.random()): number {
  const dasar = state.jedaDetik * 1000;
  return Math.round(dasar * (0.8 + acak * 0.5));
}

// ------------------------------------------------------------
// 8. COBA ULANG
// ------------------------------------------------------------

/** Galat yang layak dicoba lagi: gangguan sesaat, bukan penolakan alamat. */
export function galatSementara(kode: string | number | null | undefined): boolean {
  const angkaKode = typeof kode === "number" ? kode : Number(String(kode || "").match(/\d{3}/)?.[0]);
  if (Number.isFinite(angkaKode)) {
    if (angkaKode === 429) return true;
    if (angkaKode >= 500) return true;
    // 4xx lainnya adalah penolakan: alamat salah, ditolak, atau dicekal.
    return false;
  }
  const isi = String(kode || "").toLowerCase();
  return /timeout|timedout|econnreset|enotfound|network|socket|temporar|try again|rate.?limit/.test(isi);
}

/**
 * Berapa lama menunggu sebelum percobaan ke-n.
 *
 *   percobaan 1 gagal → 5 menit
 *   percobaan 2 gagal → 30 menit
 *   percobaan 3 gagal → menyerah, ditandai gagal
 *
 * Ditambah guncangan supaya seluruh antrean yang gagal bersamaan tidak
 * kembali mengetuk penyedia pada detik yang sama persis.
 */
export function jedaCobaUlang(percobaan: number, acak = Math.random()): number | null {
  if (percobaan >= BATAS.cobaMaks) return null;
  const dasar = percobaan <= 1 ? 5 * 60_000 : 30 * 60_000;
  return Math.round(dasar * (0.85 + acak * 0.3));
}

// ------------------------------------------------------------
// 9. STATUS
// ------------------------------------------------------------

export const STATUS_PENERIMA = [
  "queued", "sending", "sent", "delivered", "failed", "bounced", "unsubscribed", "cancelled",
] as const;
export type StatusPenerima = (typeof STATUS_PENERIMA)[number];

export const STATUS_PENERIMA_LABEL: Record<StatusPenerima, string> = {
  queued: "Antre",
  sending: "Mengirim",
  sent: "Terkirim",
  delivered: "Sampai",
  failed: "Gagal",
  bounced: "Memantul",
  unsubscribed: "Berhenti langganan",
  cancelled: "Dibatalkan",
};

export const STATUS_KAMPANYE = [
  "draft", "queued", "sending", "paused", "completed", "cancelled",
] as const;
export type StatusKampanye = (typeof STATUS_KAMPANYE)[number];

export const STATUS_KAMPANYE_LABEL: Record<StatusKampanye, string> = {
  draft: "Draf",
  queued: "Menunggu antrean",
  sending: "Sedang mengirim",
  paused: "Dijeda",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

/** Alasan sebuah alamat masuk daftar cekal. */
export const ALASAN_CEKAL = [
  "unsubscribe", "hard_bounce", "complaint", "manual", "invalid",
] as const;
export type AlasanCekal = (typeof ALASAN_CEKAL)[number];

export const ALASAN_CEKAL_LABEL: Record<AlasanCekal, string> = {
  unsubscribe: "Berhenti langganan",
  hard_bounce: "Pantulan keras",
  complaint: "Melaporkan sebagai spam",
  manual: "Dicekal admin",
  invalid: "Alamat tidak sah",
};

/**
 * Peristiwa penyedia yang membuat sebuah alamat dicekal SELAMANYA.
 *
 * Pantulan LUNAK (kotak penuh, server sibuk) sengaja tidak ada di sini: itu
 * keadaan sementara, dan mencekal alamat yang kotak masuknya kebetulan penuh
 * berarti kehilangan penerima yang sah untuk seterusnya.
 */
export function cekalDariPeristiwa(jenis: string): AlasanCekal | null {
  const isi = String(jenis || "").toLowerCase();
  if (isi.includes("complain") || isi.includes("spam")) return "complaint";
  if (isi.includes("unsubscrib")) return "unsubscribe";
  if (isi.includes("bounce")) {
    if (isi.includes("soft")) return null;
    return "hard_bounce";
  }
  return null;
}

/** Status penerima yang harus dicatat untuk sebuah peristiwa penyedia. */
export function statusDariPeristiwa(jenis: string): StatusPenerima | null {
  const isi = String(jenis || "").toLowerCase();
  if (isi.includes("deliver")) return "delivered";
  if (isi.includes("complain") || isi.includes("spam")) return "bounced";
  if (isi.includes("unsubscrib")) return "unsubscribed";
  if (isi.includes("bounce")) return isi.includes("soft") ? null : "bounced";
  if (isi.includes("sent") || isi.includes("accept")) return "sent";
  return null;
}

// ------------------------------------------------------------
// 10. TOKEN & TAUTAN
// ------------------------------------------------------------

/**
 * Token acak untuk tautan berhenti langganan.
 *
 * Dibuat dari crypto, BUKAN Math.random: tautan yang dapat ditebak berarti
 * siapa pun dapat memberhentikan langganan orang lain. Memakai Web Crypto
 * yang tersedia di peramban maupun Node modern, sehingga berkas ini tetap
 * dapat diimpor dari kedua sisi.
 */
export function buatToken(panjang = 32): string {
  const bytes = new Uint8Array(Math.ceil(panjang / 2));
  const acak = (globalThis as { crypto?: Crypto }).crypto;
  if (acak?.getRandomValues) acak.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, panjang);
}

/**
 * Tautan berhenti langganan.
 *
 * Perhatikan bahwa yang dibawa hanya TOKEN. Bentuk lama `?email=john@x.edu`
 * membocorkan alamat penerima ke setiap perantara yang dilewati tautannya —
 * termasuk ke log server mana pun yang kebetulan mencatat URL lengkap.
 */
export function tautanBerhenti(asal: string, token: string): string {
  const pangkal = String(asal || "").replace(/\/+$/, "");
  return `${pangkal}/email/berhenti?t=${encodeURIComponent(token)}`;
}

/** Kode kampanye yang pendek dan dapat dibaca di telepon. */
export function kodeKampanye(acak: () => number = Math.random): string {
  const huruf = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let keluar = "";
  for (let i = 0; i < 8; i++) keluar += huruf[Math.floor(acak() * huruf.length)];
  return keluar;
}

// ------------------------------------------------------------
// 11. STATISTIK
// ------------------------------------------------------------

export type HitungKampanye = {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
  unsubscribed: number;
};

/**
 * Angka turunan yang ditampilkan pada kartu statistik.
 *
 * Laju sampai dihitung terhadap yang SUDAH DIPROSES, bukan terhadap seluruh
 * penerima. Kampanye yang baru berjalan seperlima jalan jika tidak begitu
 * akan menampilkan "laju sampai 19%" — angka yang benar secara aritmetika
 * dan menyesatkan bagi siapa pun yang membacanya.
 */
export function ringkasanKampanye(hitung: HitungKampanye) {
  const diproses = hitung.sent + hitung.delivered + hitung.failed + hitung.bounced + hitung.unsubscribed;
  const persen = (nilai: number) => (diproses > 0 ? Math.round((nilai / diproses) * 1000) / 10 : 0);
  return {
    diproses,
    sisa: Math.max(0, hitung.total - diproses),
    kemajuan: hitung.total > 0 ? Math.round((diproses / hitung.total) * 100) : 0,
    lajuSampai: persen(hitung.delivered),
    lajuPantul: persen(hitung.bounced),
    lajuGagal: persen(hitung.failed),
  };
}

/**
 * Berapa hari kampanye ini akan berjalan dengan jatah yang berlaku.
 *
 * Ditampilkan SEBELUM tombol jalankan ditekan. Seribu alamat pada jatah 60
 * per hari berarti tujuh belas hari, dan itu harus diketahui di muka — bukan
 * ditemukan sendiri pada hari keempat.
 */
export function perkiraanHari(jumlah: number, jatahHarian: number): number {
  if (jumlah <= 0) return 0;
  return Math.max(1, Math.ceil(jumlah / Math.max(1, jatahHarian)));
}
