// ============================================================
// MODE MAINTENANCE — bagian yang aman dipakai di browser
//
// Berkas ini SENGAJA tidak menyentuh database, supaya boleh diimpor dari
// komponen client (panel Super Admin) maupun dari server. Pembacaan ke
// database ada di `maintenance-store.ts`.
// ============================================================

export const MAINTENANCE_KEY = "maintenance_mode";

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
};

export const DEFAULT_MAINTENANCE: MaintenanceState = {
  enabled: false,
  secretDoor: true,
  adminLogin: false,
  lead: "Ssst… jangan berisik ya.",
  message:
    "Server kami sedang tidur siang ditemani kucing penjaga. Tim admin lagi mengelus-elus mesinnya biar cepat bangun. Data Anda aman, cuma ikut rebahan sebentar.",
  note: "Coba tengok lagi beberapa saat lagi",
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
