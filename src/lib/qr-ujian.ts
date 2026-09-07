// ============================================================
// KODE QR UJIAN
//
// Satu masalah kecil yang menghabiskan sepuluh menit pertama tiap ujian: kode
// ujian yang diketik salah. "0" dan "O", "1" dan "I", huruf besar yang berubah
// jadi huruf kecil oleh papan ketik ponsel. Pengajar sudah menempelkan
// tautannya ke grup kelas, tetapi selalu ada peserta yang tidak membuka grup —
// duduk di ruang ujian, menatap papan tulis, mengetik ulang apa yang tertulis
// di sana.
//
// Kode QR menghapus pengetikan itu seluruhnya. Yang dipindai bukan kodenya
// melainkan TAUTAN LENGKAPNYA, sehingga kamera ponsel mana pun langsung
// membuka halaman ujian dengan kodenya sudah terisi.
//
// Dua keputusan yang menentukan bentuk berkas ini:
//
//   1. PUSTAKANYA DIMUAT SAAT DIBUTUHKAN, bukan ikut terkirim bersama panel
//      dashboard. Penggambar QR berukuran puluhan kilobita dan hanya dipakai
//      oleh satu kotak kecil pada satu panel; memuatnya di muka membuat
//      seluruh dashboard — termasuk halaman yang tidak ada hubungannya dengan
//      CBT — ikut menunggunya.
//   2. HASILNYA PNG, bukan SVG. Gambar inilah yang akan diunduh pengajar lalu
//      ditempelkan ke grup kelas, dimasukkan ke salindia, dan dicetak sebagai
//      poster. SVG lebih tajam tetapi tidak dapat ditempel ke percakapan
//      WhatsApp, dan itu justru tujuan yang paling sering.
// ============================================================

/**
 * Ukuran sisi gambar QR dalam piksel.
 *
 * Besar dengan sengaja. Ia dipakai kembali di tiga tempat sekaligus — kotak
 * kecil pada panel, poster A4, dan kop naskah soal — dan mengecilkan gambar
 * selalu bisa, membesarkannya tidak. Seribu piksel di atas kertas A4 berarti
 * sekitar 250 titik per inci pada tempelan selebar sepuluh sentimeter, cukup
 * untuk dipindai dari bangku paling belakang.
 */
const SISI = 1024;

/**
 * Tingkat koreksi galat "M": sekitar 15% permukaan boleh rusak dan kodenya
 * tetap terbaca.
 *
 * Bukan "L" yang paling rapat. Poster QR akan ditempel di dinding ruang ujian,
 * tersenggol, terlipat di sudutnya, dan difoto dari samping oleh peserta yang
 * duduk di deretan pinggir. Kerapatan yang lebih tinggi hanya menghemat
 * beberapa piksel dan membayarnya dengan kode yang gagal dipindai persis pada
 * saat semua orang sedang menunggu.
 */
const KOREKSI = "M" as const;

/**
 * Gambar satu kode QR sebagai PNG data URL.
 *
 * Mengembalikan tali kosong bila gagal, dan TIDAK melempar. Kode QR adalah
 * kemudahan, bukan syarat: ujian yang kodenya gagal digambar tetap dapat
 * dibagikan lewat tautan dan kode ujiannya. Melempar dari sini akan
 * menjatuhkan seluruh panel pengajar beberapa menit sebelum ujian dimulai,
 * dan yang hilang jauh lebih besar daripada yang dijaga.
 */
export async function gambarQr(teks: string): Promise<string> {
  const isi = String(teks ?? "").trim();
  if (!isi) return "";
  try {
    const QRCode = (await import("qrcode")).default;
    return await QRCode.toDataURL(isi, {
      width: SISI,
      // Dua modul kosong di tepinya. Nol membuat kode menempel rapat ke tepi
      // gambar, dan pemindai membutuhkan bidang tenang di sekelilingnya untuk
      // menemukan batas kodenya.
      margin: 2,
      errorCorrectionLevel: KOREKSI,
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch {
    return "";
  }
}

/**
 * Nama berkas untuk QR yang diunduh.
 *
 * Memuat kode ujiannya, karena pengajar yang mengampu empat kelas akan
 * mengunduh empat berkas dalam satu sore. "qr-ujian.png (3)" tidak memberi
 * tahu siapa pun kelas mana yang mana.
 */
export function namaBerkasQr(kode: string): string {
  const bersih = String(kode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return bersih ? `qr-ujian-${bersih}.png` : "qr-ujian.png";
}
