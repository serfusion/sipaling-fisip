// ============================================================
// PESAN UNTUK JAWABAN YANG TIDAK TERBACA
//
// Sebelum berkas ini ada, setiap jawaban yang gagal diurai menjadi satu
// kalimat yang sama: "Terjadi gangguan. Silakan coba lagi." Kalimat itu
// benar, dan sama sekali tidak berguna.
//
// Yang paling sering menghasilkannya BUKAN galat di dalam kode portal,
// melainkan jawaban yang tidak pernah sampai ke kode portal sama sekali:
//
//   413  — badan permintaan melebihi batas fungsi serverless (Vercel
//          memotongnya pada 4,5 MB, jauh sebelum route API dipanggil);
//   504  — fungsi dihentikan karena kelamaan, biasanya saat mengunggah
//          berkas besar satu per satu di dalam satu permintaan;
//   502  — fungsi mati di tengah jalan.
//
// Ketiganya dijawab Vercel dengan halaman HTML, bukan JSON. response.json()
// gagal, payload menjadi null, dan yang tersisa hanya kalimat serbaguna itu.
// Mahasiswa melapor "error", admin memeriksa log aplikasi dan tidak menemukan
// apa pun — karena memang tidak pernah ada permintaan yang masuk.
//
// Sekarang kode HTTP-nya diterjemahkan menjadi kalimat yang menyebut sebab
// dan jalan keluarnya. Nomor kodenya tetap disebut supaya laporan mahasiswa
// dapat dicocokkan dengan log tanpa menebak.
// ============================================================

const PESAN: Record<number, string> = {
  400: "Isian belum diterima server. Periksa kembali data dan berkas yang dipilih.",
  401: "Sesi Anda sudah berakhir. Muat ulang halaman ini lalu coba lagi.",
  403: "Permintaan ini tidak diizinkan untuk perangkat Anda.",
  404: "Alamat layanan tidak ditemukan. Muat ulang halaman ini lalu coba lagi.",
  408: "Server berhenti menunggu karena kiriman terlalu lama. Periksa jaringan Anda lalu coba lagi.",
  413:
    "Berkas yang dikirim terlalu besar untuk satu kali kiriman. " +
    "Perkecil ukuran berkasnya (simpan ulang sebagai PDF teks, bukan hasil pindai foto), lalu coba lagi.",
  429: "Terlalu banyak permintaan dari perangkat ini. Tunggu beberapa menit lalu coba lagi.",
  500: "Server gagal memproses permintaan ini. Coba lagi beberapa saat lagi.",
  502: "Server berhenti di tengah proses. Coba lagi beberapa saat lagi.",
  503: "Layanan sedang tidak dapat dihubungi. Coba lagi beberapa saat lagi.",
  504:
    "Server terlalu lama memproses kiriman lalu dihentikan. " +
    "Biasanya karena berkasnya besar; perkecil ukurannya lalu coba lagi.",
};

/**
 * Kalimat untuk jawaban yang tidak membawa pesan apa pun.
 *
 * Dipakai HANYA sebagai cadangan: bila server portal sempat menjawab, pesan
 * miliknya sendiri selalu lebih tepat dan itulah yang ditampilkan.
 */
export function pesanStatusHttp(status: number): string {
  const dikenal = PESAN[status];
  if (dikenal) return `${dikenal} (kode ${status})`;
  if (status >= 500) return `Server sedang bermasalah (kode ${status}). Coba lagi beberapa saat lagi.`;
  if (status >= 400) return `Permintaan ditolak server (kode ${status}). Periksa kembali isian Anda.`;
  // Status 2xx yang badannya tetap tidak terbaca: jarang, tetapi pernah
  // terjadi saat jawaban terpotong di tengah jalan.
  return "Jawaban server tidak terbaca. Muat ulang halaman ini lalu coba lagi.";
}
