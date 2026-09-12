// ============================================================
// KALIMAT KOTAK PASTIKAN
//
// Dua pertanyaan yang harus dijawab peserta sebelum satu perbuatan yang tidak
// dapat ditarik kembali dijalankan: "kumpulkan sekarang?" dan "keluar dari
// halaman ujian?".
//
// Kalimatnya tinggal di sini, di luar komponen, karena satu alasan yang tidak
// terlihat dari layar: dahulu keduanya ditanyakan window.confirm(), dan kotak
// bawaan peramban itulah yang MELAHIRKAN PELANGGARAN atas nama peserta yang
// hanya menekan "AKHIRI UJIAN".
//
//   Chrome MELEPAS LAYAR PENUH setiap kali sebuah kotak JavaScript berdiri di
//   atas halaman yang sedang layar penuh. Pelepasan itu mengirim
//   `fullscreenchange`, dan penjaga ujian membacanya persis seperti peserta
//   yang menekan Esc untuk mengintip jendela lain: satu pelanggaran berat,
//   satu kotak teguran, satu langkah lebih dekat ke pengumpulan paksa.
//
//   Sebagian peramban lain melepas FOKUS jendelanya selama kotak itu berdiri.
//   Peserta yang membaca pertanyaannya lebih dari satu setengah detik —
//   dan pertanyaan "yakin mau mengumpulkan?" memang dibaca lebih lama dari itu
//   — mendapat catatan "jendela kehilangan fokus" sebagai gantinya.
//
// Karena itu pertanyaannya sekarang digambar halaman ini sendiri (lihat
// src/app/cbt/ujian/pastikan.tsx): satu lapisan di dalam dokumen yang sama,
// tidak pernah melepas layar penuh, tidak pernah memindahkan fokus keluar.
//
// Yang TIDAK dilakukan: menghapus pertanyaannya. Ketukan pada "AKHIRI UJIAN"
// tidak dapat ditarik kembali — attempt-nya ditutup server dan lembarnya tidak
// pernah terbuka lagi — dan tombol itu duduk persis di tempat tombol "SOAL
// SELANJUTNYA" berada satu soal sebelumnya. Tangan yang sudah hafal letaknya
// akan menekannya tanpa membaca, dan peserta yang kehilangan sepuluh menit
// sisa waktunya karena satu ketukan hafal jauh lebih dirugikan daripada
// peserta yang harus menekan dua kali.
// ============================================================

/** Satu pertanyaan beserta dua jalan keluarnya. */
export type Pastikan = {
  /** Menentukan warna kotaknya: merah untuk yang menutup ujian. */
  nada: "akhir" | "keluar";
  judul: string;
  /**
   * Angka-angka yang harus terbaca sebelum jawabannya dipilih — soal yang
   * masih kosong dan soal yang ditandai ragu-ragu. Kosong berarti tidak ada
   * yang perlu diperingatkan, dan barisnya tidak digambar sama sekali.
   */
  rincian: string;
  /** Akibat yang tidak dapat ditarik kembali, satu paragraf per kalimat. */
  kalimat: string[];
  /** Tulisan pada tombol yang menjalankan perbuatannya. */
  ya: string;
  /** Tulisan pada tombol yang membatalkan. */
  tidak: string;
};

/**
 * Rincian soal yang belum selesai, dalam satu kalimat.
 *
 * Dipisah dari penyusun kotaknya supaya ia dapat diuji sendiri: inilah satu-
 * satunya bagian kotak ini yang isinya berubah-ubah, dan yang salah di sini
 * bukan kalimat yang jelek melainkan peserta yang mengumpulkan ujian sambil
 * mengira seluruh soalnya sudah terjawab.
 */
export function rincianSisa(kosong: number, ragu: number): string {
  const bagian = [
    kosong > 0 ? `${kosong} soal belum dijawab` : null,
    ragu > 0 ? `${ragu} soal ditandai ragu-ragu` : null,
  ].filter(Boolean);
  return bagian.join(" dan ");
}

/**
 * Pertanyaan sebelum ujian dikumpulkan.
 *
 * Kalimatnya menyebut akibatnya apa adanya dan tidak satu pun menakut-nakuti:
 * yang berakhir memang berakhir, dan peserta berhak tahu itu sebelum menekan,
 * bukan sesudah.
 */
export function pastikanKumpul({ kosong, ragu }: { kosong: number; ragu: number }): Pastikan {
  const rincian = rincianSisa(kosong, ragu);
  return {
    nada: "akhir",
    judul: "Kumpulkan jawaban dan akhiri ujian?",
    rincian: rincian ? `Masih ada ${rincian}.` : "",
    kalimat: [
      "Jawabanmu dikumpulkan dan ujian ditutup. Lembar ini tidak dapat dibuka lagi, " +
        "dan sisa waktunya tidak dapat dipakai lagi.",
    ],
    ya: "Ya, kumpulkan sekarang",
    // "Belum", bukan "Batal". Yang ditanyakan kotak ini bukan perintah yang
    // dapat gagal melainkan kesiapan orangnya, dan kata yang menjawabnya
    // adalah kata yang sama yang ada di kepalanya: belum.
    tidak: rincian ? "Belum, kembali ke soal" : "Belum, periksa lagi",
  };
}

/**
 * Pertanyaan sebelum peserta meninggalkan halaman ujian tanpa mengumpulkan.
 *
 * Ujiannya TIDAK ditutup — attempt-nya tetap berjalan di server beserta sisa
 * waktunya, dan peserta dapat masuk lagi dengan nomor yang sama untuk menemukan
 * lembar yang persis sama. Yang dihapus hanya ingatan peramban ini.
 *
 * Karena itu satu kalimat di dalamnya ditulis dengan huruf besar dan tidak
 * boleh dihaluskan: waktunya terus berjalan. Peserta yang mengira keluar
 * berarti menjeda akan kembali ke lembar yang sisa waktunya sudah habis, dan
 * tidak ada satu pun cara memulihkan menit-menit itu untuknya.
 */
export function pastikanKeluar(): Pastikan {
  return {
    nada: "keluar",
    judul: "Keluar dari halaman ujian?",
    rincian: "WAKTU UJIAN TERUS BERJALAN selama kamu di luar.",
    kalimat: [
      "Jawaban yang sudah tersimpan tidak hilang, dan kamu dapat masuk lagi dengan nomor peserta " +
        "yang sama untuk melanjutkan lembar yang sama.",
      "Ujian ini tidak ikut dikumpulkan.",
    ],
    ya: "Ya, keluar",
    tidak: "Batal, lanjut mengerjakan",
  };
}
