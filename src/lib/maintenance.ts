// ============================================================
// MODE MAINTENANCE — bagian yang aman dipakai di browser
//
// Berkas ini SENGAJA tidak menyentuh database, supaya boleh diimpor dari
// komponen client (panel Super Admin) maupun dari server. Pembacaan ke
// database ada di `maintenance-store.ts`.
// ============================================================

export const MAINTENANCE_KEY = "maintenance_mode";

// ---------------------------------------------------------------------------
// Kunci per kartu layanan
// ---------------------------------------------------------------------------

/**
 * Tujuh kartu layanan pada portal mahasiswa, urut seperti tampil di sana.
 *
 * Nama-namanya harus sama persis dengan serviceTypes di
 * src/app/sipaling-app.tsx dan kunci serviceCatalog di
 * src/app/api/requests/route.ts: yang dikunci adalah nilai serviceType yang
 * benar-benar dikirim formulir.
 */
export const KARTU_LAYANAN = [
  "Layanan Tugas Akhir",
  "Layanan PDDIKTI",
  "Layanan Akademik",
  "Layanan Prodi",
  "Layanan Umum",
  "Layanan Perpustakaan",
  "Layanan Laboratorium",
] as const;

export type KartuLayanan = (typeof KARTU_LAYANAN)[number];

/**
 * Kartu yang terkunci selama Super Admin belum pernah mengaturnya sendiri:
 * semuanya kecuali Perpustakaan, satu-satunya layanan yang sudah berjalan
 * penuh. Begitu daftar kunci tersimpan dari dashboard, daftar inilah yang
 * berhenti berlaku — termasuk bila yang disimpan daftar kosong.
 */
export const KARTU_TERKUNCI_BAWAAN: readonly KartuLayanan[] = KARTU_LAYANAN.filter(
  (kartu) => kartu !== "Layanan Perpustakaan",
);

/**
 * Pengajuan judul tidak punya kartu sendiri. Ia bagian dari kartu Tugas
 * Akhir ("ajukan judul, lalu unggah draft"), jadi ikut terkunci bersamanya.
 */
export const KARTU_PENGAJUAN_JUDUL: KartuLayanan = "Layanan Tugas Akhir";

/**
 * Nama lama yang masih tersimpan pada tiket-tiket awal. Tiket lama ikut
 * terkunci bersama kartu yang kini memegang layanannya.
 */
const NAMA_LAMA: Record<string, KartuLayanan> = {
  "Layanan Skripsi / Jurnal": "Layanan Tugas Akhir",
};

export function kartuUntukLayanan(serviceType: string): KartuLayanan | null {
  if ((KARTU_LAYANAN as readonly string[]).includes(serviceType)) return serviceType as KartuLayanan;
  return NAMA_LAMA[serviceType] ?? null;
}

/**
 * Apakah layanan ini tertutup bagi pengunjung dengan peran tersebut?
 *
 * Super Admin selalu lolos supaya ia dapat menguji kartu yang sedang
 * maintenance sebelum membukanya untuk mahasiswa. Layanan yang tidak
 * dikenal tidak dianggap terkunci: menolak nama asing adalah tugas validasi
 * formulir, bukan tugas kunci ini.
 */
export function layananTertutup(
  serviceType: string,
  lockedServices: readonly string[],
  role?: string | null,
) {
  if (role === PERAN_LOLOS_MAINTENANCE) return false;
  const kartu = kartuUntukLayanan(serviceType);
  return kartu !== null && lockedServices.includes(kartu);
}

export type MaintenanceState = {
  /** Portal mahasiswa ditutup dan diganti halaman kucing tidur. */
  enabled: boolean;
  /** Titik pada huruf "i" kata "maintenance" menjadi tautan rahasia ke /login. */
  secretDoor: boolean;
  /**
   * Admin unit dan dosen boleh memakai sesinya selama portal ditutup.
   *
   * Mati secara bawaan: saat portal ditutup, biasanya justru tidak ada yang
   * boleh menyentuh datanya. Dinyalakan bila memang butuh banyak tangan untuk
   * membereskan sesuatu selagi portal tutup. Super Admin tidak terpengaruh
   * sakelar ini — ia yang memegangnya.
   */
  adminLogin: boolean;
  /** Kalimat kecil di atas kata "maintenance". */
  lead: string;
  /** Kalimat utama yang menjelaskan situasinya. */
  message: string;
  /** Teks pada lencana kuning di bawah pesan. */
  note: string;
  /**
   * Kartu layanan yang sedang dikunci untuk maintenance. Berlaku walaupun
   * portalnya sendiri terbuka: kartunya tampil bergembok dan pengajuannya
   * ditolak server.
   */
  lockedServices: KartuLayanan[];
};

export const DEFAULT_MAINTENANCE: MaintenanceState = {
  enabled: false,
  secretDoor: true,
  adminLogin: false,
  lead: "Ssst… jangan berisik ya.",
  message:
    "Server kami sedang tidur siang ditemani kucing penjaga. Tim admin lagi mengelus-elus mesinnya biar cepat bangun. Data Anda aman, cuma ikut rebahan sebentar.",
  note: "Coba tengok lagi beberapa saat lagi",
  lockedServices: [...KARTU_TERKUNCI_BAWAAN],
};

const LIMIT = { lead: 120, message: 400, note: 90 } as const;

function clean(value: unknown, fallback: string, max: number) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

/**
 * Mengubah apa pun (isi kolom app_settings, body permintaan PUT) menjadi
 * MaintenanceState yang pasti valid. Dipakai di dua sisi sekaligus supaya
 * aturan panjang teks dan nilai bawaan tidak pernah berbeda.
 */
export function normalizeMaintenance(input: unknown): MaintenanceState {
  const raw = (typeof input === "object" && input ? input : {}) as Partial<MaintenanceState>;
  return {
    enabled: raw.enabled === true,
    // Pintu rahasia menyala secara bawaan; hanya mati bila diminta tegas.
    secretDoor: raw.secretDoor !== false,
    // Kebalikannya: izin masuk admin MATI secara bawaan, dan hanya menyala
    // bila diminta tegas. Pengaturan lama yang belum punya kolom ini karena
    // itu terbaca sebagai terkunci — sama seperti perilaku sebelumnya.
    adminLogin: raw.adminLogin === true,
    lead: clean(raw.lead, DEFAULT_MAINTENANCE.lead, LIMIT.lead),
    message: clean(raw.message, DEFAULT_MAINTENANCE.message, LIMIT.message),
    note: clean(raw.note, DEFAULT_MAINTENANCE.note, LIMIT.note),
    // Belum pernah diatur (bukan array) berarti memakai daftar bawaan.
    // Disaring lewat KARTU_LAYANAN supaya nama asing terbuang, tidak ada
    // yang ganda, dan urutannya selalu sama dengan urutan kartu.
    lockedServices: Array.isArray(raw.lockedServices)
      ? KARTU_LAYANAN.filter((kartu) => (raw.lockedServices as unknown[]).includes(kartu))
      : [...KARTU_TERKUNCI_BAWAAN],
  };
}

export function parseMaintenance(value: string | null | undefined): MaintenanceState {
  if (!value) return DEFAULT_MAINTENANCE;
  try {
    return normalizeMaintenance(JSON.parse(value));
  } catch {
    return DEFAULT_MAINTENANCE;
  }
}

// ---------------------------------------------------------------------------
// Siapa yang boleh memakai sesinya ketika portal ditutup
// ---------------------------------------------------------------------------

/**
 * Satu-satunya peran yang lolos saat maintenance menyala.
 *
 * Super Admin yang memegang tombolnya, jadi ia harus tetap bisa masuk untuk
 * mematikannya lagi. Kalau perannya sendiri ikut terkunci, portal yang
 * ditutup tidak akan pernah bisa dibuka dari dalam.
 */
export const PERAN_LOLOS_MAINTENANCE = "super_admin";

/**
 * Apakah sesi ini ditahan karena portal sedang ditutup?
 *
 * Dipisahkan menjadi fungsi murni supaya keputusannya dapat diuji tanpa
 * database maupun sesi sungguhan — ini aturan hak akses, dan aturan hak akses
 * tidak boleh hanya "kelihatannya benar".
 *
 * Belum login BUKAN "tertahan": tidak ada sesi yang ditahan di situ.
 *
 * adminBolehMasuk sengaja berbawaan false. Kalau parameternya lupa diisi di
 * suatu tempat, yang terjadi adalah menutup, bukan membuka.
 */
export function sesiTertahanMaintenance(
  role: string | null | undefined,
  maintenanceAktif: boolean,
  adminBolehMasuk = false,
) {
  if (!role) return false;
  if (role === PERAN_LOLOS_MAINTENANCE) return false;
  if (!maintenanceAktif) return false;
  return adminBolehMasuk !== true;
}
