// PROJECT CAKRAWALA — batang yang membuat alat saling tersambung.
//
// Tanpa berkas ini tiap alat berdiri sendiri: mahasiswa menempelkan naskah
// yang sama berkali-kali dan tidak ada yang mengingat apa pun. Dengan project,
// naskah diunggah sekali lalu dipakai bersama, dan kemajuannya menumpuk.
//
// PENYIMPANAN: IndexedDB di perangkat pengguna, tanpa akun.
// Naskah skripsi kerap memuat data responden, jadi bawaannya tidak pernah
// dikirim ke server. Yang perlu diketahui pengguna, dan dinyatakan terbuka di
// antarmuka: peramban dapat membuang penyimpanan lokal. Safari membuangnya
// setelah tujuh hari tanpa situs ini dibuka. Karena itu tersedia ekspor
// cadangan, dan navigator.storage.persist() diminta sejak awal.

import type { Masukan } from "./metodologi";

export type JenisProject = "skripsi" | "jurnal" | "makalah";

export type Bab = {
  id: string;
  judul: string;
  isi: string;
  jumlahKata: number;
};

export type Project = {
  id: string;
  nama: string;
  jenis: JenisProject;
  prodi: string;
  /** Kode tiket pengajuan judul bila project berasal dari sana. */
  kodeTiket: string | null;
  bab: Bab[];
  /** Daftar pustaka mentah, dipakai bersama oleh Verifikasi Sitasi. */
  daftarPustaka: string;
  /** ISSN jurnal tujuan, dipakai Radar Jurnal. */
  issnTujuan: string;
  /** Naskah Inggris yang sedang dikerjakan. */
  naskahInggris: string;
  /** Topik atau pertanyaan penelitian, dipakai Cari Referensi. */
  topik: string;
  /** Masukan Perumus Judul, disimpan agar tidak perlu diisi ulang. */
  rancangan: Masukan | null;
  /** Sumber yang ditempel mahasiswa untuk pembanding kemiripan. */
  sumberBanding: Array<{ nama: string; teks: string }>;
  dibuat: number;
  diubah: number;
};

export type RingkasProject = Pick<Project, "id" | "nama" | "jenis" | "diubah"> & {
  jumlahBab: number;
  jumlahKata: number;
};

const NAMA_DB = "cakrawala";
const VERSI_DB = 1;
const TOKO = "projects";

// ---------------------------------------------------------------------------
// Lapisan IndexedDB
// ---------------------------------------------------------------------------

function bukaDb(): Promise<IDBDatabase> {
  return new Promise((selesai, gagal) => {
    if (typeof indexedDB === "undefined") {
      gagal(new Error("Peramban ini tidak mendukung penyimpanan lokal."));
      return;
    }
    const permintaan = indexedDB.open(NAMA_DB, VERSI_DB);
    permintaan.onupgradeneeded = () => {
      const db = permintaan.result;
      if (!db.objectStoreNames.contains(TOKO)) {
        const toko = db.createObjectStore(TOKO, { keyPath: "id" });
        toko.createIndex("diubah", "diubah");
      }
    };
    permintaan.onsuccess = () => selesai(permintaan.result);
    permintaan.onerror = () => gagal(permintaan.error ?? new Error("Penyimpanan lokal tidak dapat dibuka."));
  });
}

async function jalankan<T>(mode: IDBTransactionMode, kerja: (toko: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await bukaDb();
  try {
    return await new Promise<T>((selesai, gagal) => {
      const transaksi = db.transaction(TOKO, mode);
      const permintaan = kerja(transaksi.objectStore(TOKO));
      permintaan.onsuccess = () => selesai(permintaan.result);
      permintaan.onerror = () => gagal(permintaan.error ?? new Error("Penyimpanan gagal."));
    });
  } finally {
    db.close();
  }
}

/**
 * Minta peramban mempertahankan penyimpanan ini.
 *
 * Bukan jaminan. Chrome mengabulkannya berdasarkan keterlibatan pengguna,
 * dan Safari tidak menyediakannya sama sekali. Karena itu ekspor cadangan
 * tetap wajib ada, dan kegagalan di sini tidak boleh menghentikan apa pun.
 */
export async function mintaPenyimpananTetap(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Operasi project
// ---------------------------------------------------------------------------

function idBaru() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `p-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function hitungKata(teks: string) {
  const bersih = teks.trim();
  return bersih ? bersih.split(/\s+/).length : 0;
}

export function projectBaru(nama: string, jenis: JenisProject, prodi = ""): Project {
  const kini = Date.now();
  return {
    id: idBaru(),
    nama: nama.trim() || "Project tanpa nama",
    jenis,
    prodi,
    kodeTiket: null,
    bab: [],
    daftarPustaka: "",
    issnTujuan: "",
    naskahInggris: "",
    topik: "",
    rancangan: null,
    sumberBanding: [],
    dibuat: kini,
    diubah: kini,
  };
}

export async function simpanProject(project: Project): Promise<void> {
  const disimpan = { ...project, diubah: Date.now() };
  await jalankan("readwrite", (toko) => toko.put(disimpan) as IDBRequest<IDBValidKey>);
}

/**
 * Isi bidang yang belum ada pada project lama.
 *
 * Project disimpan di perangkat pengguna dan tidak ikut termigrasi ketika
 * aplikasi diperbarui. Tanpa pelengkapan ini, project yang dibuat sebelum
 * suatu bidang ditambahkan akan membuat alat yang membacanya gagal.
 */
function lengkapi(p: Project): Project {
  return {
    ...p,
    daftarPustaka: p.daftarPustaka ?? "",
    issnTujuan: p.issnTujuan ?? "",
    naskahInggris: p.naskahInggris ?? "",
    topik: p.topik ?? "",
    rancangan: p.rancangan ?? null,
    sumberBanding: Array.isArray(p.sumberBanding) ? p.sumberBanding : [],
    bab: Array.isArray(p.bab) ? p.bab : [],
  };
}

export async function ambilProject(id: string): Promise<Project | null> {
  const hasil = await jalankan("readonly", (toko) => toko.get(id) as IDBRequest<Project | undefined>);
  return hasil ? lengkapi(hasil) : null;
}

export async function daftarProject(): Promise<RingkasProject[]> {
  const semua = await jalankan("readonly", (toko) => toko.getAll() as IDBRequest<Project[]>);
  return semua
    .map((p) => ({
      id: p.id,
      nama: p.nama,
      jenis: p.jenis,
      diubah: p.diubah,
      jumlahBab: p.bab.length,
      jumlahKata: p.bab.reduce((n, b) => n + b.jumlahKata, 0),
    }))
    .sort((a, b) => b.diubah - a.diubah);
}

export async function hapusProject(id: string): Promise<void> {
  await jalankan("readwrite", (toko) => toko.delete(id) as IDBRequest<undefined>);
}

// ---------------------------------------------------------------------------
// Pengurai bab
// ---------------------------------------------------------------------------

// Judul bab dan subbab pada skripsi Indonesia. Sengaja longgar: lebih baik
// mengenali terlalu banyak judul lalu digabung pengguna, daripada melewatkan
// bab dan membuat seluruh naskah masuk ke satu blok.
const POLA_JUDUL =
  /^\s*(?:BAB\s+[IVXLC]+\b.*|(?:\d+\.){1,3}\s*\S.*|[A-Z][A-Z\s,&()-]{4,}|[A-Z]\.\s+\S.*)\s*$/;

/**
 * Pecah naskah menjadi bab berdasarkan judulnya.
 *
 * Teks sebelum judul pertama tidak dibuang: ia disimpan sebagai bagian
 * "Bagian awal" supaya tidak ada isi yang hilang tanpa disadari.
 */
export function uraiBab(teks: string): Bab[] {
  const baris = teks.split(/\r?\n/);
  const bab: Bab[] = [];
  let judul: string | null = null;
  let isi: string[] = [];

  const tutup = () => {
    const teksIsi = isi.join("\n").trim();
    if (judul === null && !teksIsi) return;
    bab.push({
      id: idBaru(),
      judul: judul ?? "Bagian awal",
      isi: teksIsi,
      jumlahKata: hitungKata(teksIsi),
    });
    judul = null;
    isi = [];
  };

  for (const b of baris) {
    const bersih = b.trim();
    const tampakJudul = bersih.length > 0 && bersih.length <= 90 && POLA_JUDUL.test(bersih);
    if (tampakJudul) {
      tutup();
      judul = bersih;
    } else {
      isi.push(b);
    }
  }
  tutup();

  // Judul tanpa satu pun kata di bawahnya adalah wadah, bukan bab: "BAB I
  // PENDAHULUAN" yang langsung diikuti "1.1 Latar Belakang" tidak memuat isi
  // apa pun. Membiarkannya membuat jumlah bab di Beranda tidak sama dengan
  // yang dipetakan Struktur Naskah, dan itu membingungkan.
  return bab.filter((b) => b.jumlahKata > 0);
}

// ---------------------------------------------------------------------------
// Cadangan
// ---------------------------------------------------------------------------

export type Cadangan = { versi: 1; dibuat: number; projects: Project[] };

export async function buatCadangan(): Promise<Cadangan> {
  const semua = await jalankan("readonly", (toko) => toko.getAll() as IDBRequest<Project[]>);
  return { versi: 1, dibuat: Date.now(), projects: semua };
}

/** Kembalikan jumlah project yang berhasil dipulihkan. */
export async function pulihkanCadangan(isi: string): Promise<number> {
  let data: unknown;
  try {
    data = JSON.parse(isi);
  } catch {
    throw new Error("Berkas cadangan tidak terbaca. Pastikan berkas .json yang benar.");
  }

  const cadangan = data as Partial<Cadangan>;
  if (cadangan?.versi !== 1 || !Array.isArray(cadangan.projects)) {
    throw new Error("Berkas ini bukan cadangan Cakrawala.");
  }

  let jumlah = 0;
  for (const p of cadangan.projects) {
    if (!p || typeof p.id !== "string" || !Array.isArray(p.bab)) continue;
    // Id dibuat ulang agar cadangan yang dipulihkan di perangkat yang sudah
    // punya project tidak menimpa pekerjaan yang ada di sana.
    await simpanProject(lengkapi({ ...(p as Project), id: idBaru() }));
    jumlah += 1;
  }
  return jumlah;
}

export const JENIS_LABEL: Record<JenisProject, string> = {
  skripsi: "Skripsi",
  jurnal: "Artikel jurnal",
  makalah: "Makalah",
};

export function waktuRelatif(stempel: number) {
  const detik = Math.floor((Date.now() - stempel) / 1000);
  if (detik < 60) return "baru saja";
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari < 30) return `${hari} hari lalu`;
  return new Date(stempel).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
