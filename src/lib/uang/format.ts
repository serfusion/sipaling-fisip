// Perapian angka dan tanggal untuk catatan uang. Dipakai di server maupun di
// peramban, jadi tidak boleh menyentuh apa pun selain masukannya sendiri.

/** "Rp10.000". Selalu bulat: rupiah pecahan tidak pernah dicatat di sini. */
export function rupiah(nilai: number) {
  const bulat = Math.round(Number(nilai) || 0);
  return `Rp${bulat.toLocaleString("id-ID")}`;
}

/** "10rb", "1,5jt", "12,3jt". Untuk kartu ringkasan yang sempit. */
export function rupiahRingkas(nilai: number) {
  const bulat = Math.abs(Math.round(Number(nilai) || 0));
  if (bulat >= 1_000_000_000) return `Rp${bersihkan(bulat / 1_000_000_000)}M`;
  if (bulat >= 1_000_000) return `Rp${bersihkan(bulat / 1_000_000)}jt`;
  if (bulat >= 10_000) return `Rp${bersihkan(bulat / 1_000)}rb`;
  return rupiah(bulat);
}

function bersihkan(angka: number) {
  return angka.toFixed(angka >= 100 ? 0 : 1).replace(/[.,]0$/, "").replace(".", ",");
}

export const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** "2026-09" menjadi "September 2026". */
export function labelBulan(bulan: string) {
  const [tahun, nomor] = bulan.split("-");
  const nama = NAMA_BULAN[Number(nomor) - 1];
  return nama ? `${nama} ${tahun}` : bulan;
}

/** "2026-09-01" menjadi "Selasa, 1 September 2026". */
export function labelTanggal(tanggal: string) {
  const waktu = new Date(`${tanggal}T00:00:00Z`);
  if (Number.isNaN(waktu.getTime())) return tanggal;
  const hari = NAMA_HARI[waktu.getUTCDay()];
  return `${hari}, ${waktu.getUTCDate()} ${NAMA_BULAN[waktu.getUTCMonth()]} ${waktu.getUTCFullYear()}`;
}

/** "Hari ini", "Kemarin", atau tanggal panjangnya. */
export function labelHari(tanggal: string, hariIni: string) {
  if (tanggal === hariIni) return "Hari ini";
  const selisih = (Date.parse(`${hariIni}T00:00:00Z`) - Date.parse(`${tanggal}T00:00:00Z`)) / 86_400_000;
  if (selisih === 1) return "Kemarin";
  return labelTanggal(tanggal);
}

/** Bulan sebelum atau sesudah "YYYY-MM". */
export function geserBulan(bulan: string, langkah: number) {
  const tahun = Number(bulan.slice(0, 4));
  const nomor = Number(bulan.slice(5, 7)) - 1 + langkah;
  const waktu = new Date(Date.UTC(tahun, nomor, 1));
  return waktu.toISOString().slice(0, 7);
}
