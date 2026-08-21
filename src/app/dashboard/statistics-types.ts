// Bentuk data yang dikirim /api/statistics.

export type StatUnit = {
  unit: string;
  tiket: number;
  medianHari: number | null;
  tuntasPersen: number | null;
  menggantung: number;
};

export type Statistics = {
  ringkasan: {
    tiketBulanIni: number;
    tiketBulanLalu: number;
    deltaPersen: number | null;
    mahasiswaUnik: number;
    menggantung: number;
    medianHari: number | null;
    tuntasPersen: number | null;
  };
  cincin: {
    tuntas: number | null;
    judulLolos: number | null;
    dosenMembimbing: number | null;
    dosenLuaran: number | null;
  };
  unit: StatUnit[];
  corong: {
    diajukan: number;
    lolosBerkas: number;
    diterima: number;
    ditolakDosen: number;
    ditolakProdi: number;
  };
  bimbingan: {
    totalDosen: number;
    membimbing: number;
    belum: number;
    top: Array<{ nama: string; jumlah: number }>;
  };
  prodi: Array<{
    prodi: string;
    tiket: number;
    mahasiswa: number;
    tiketPerMahasiswa: number;
    pengajuan: number;
    diterima: number;
  }>;
  peta: Array<{ hari: number; jam: number; jumlah: number }>;
  pddikti: Array<{ bulan: string; jumlah: number }>;
  luaran: Array<{ tahun: string; kategori: string; jumlah: number }>;
  komposisi: Array<{ kategori: string; jumlah: number }>;
  cakupan: { totalDosen: number; punyaLuaran: number };
};

export type Severity = "ok" | "warn" | "crit" | "calm";

// Unit bervolume rendah (PDDIKTI, Laboratorium) tidak boleh dinilai dengan
// ukuran yang sama seperti unit ramai — sepi di sana memang wajar.
const VOLUME_RENDAH = 15;

export function unitSeverity(u: StatUnit): { sev: Severity; label: string } {
  if (u.menggantung >= 2 || (u.tuntasPersen !== null && u.tuntasPersen < 75)) {
    return { sev: "crit", label: "Tertahan" };
  }
  if ((u.medianHari !== null && u.medianHari > 2.5) || (u.tuntasPersen !== null && u.tuntasPersen < 90)) {
    return { sev: "warn", label: "Melambat" };
  }
  if (u.tiket < VOLUME_RENDAH) return { sev: "calm", label: "Wajar sepi" };
  return { sev: "ok", label: "Sehat" };
}

export const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function labelBulan(kode: string) {
  const [tahun, bulan] = kode.split("-");
  const index = Number(bulan) - 1;
  return `${BULAN_PENDEK[index] ?? kode} ${String(tahun).slice(2)}`;
}

export const HARI_KERJA = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
export const JAM_KERJA = [8, 9, 10, 11, 12, 13, 14, 15, 16];

export function angka(value: number | null, satuan = "") {
  if (value === null) return "—";
  const teks = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
  return satuan ? `${teks} ${satuan}` : teks;
}
