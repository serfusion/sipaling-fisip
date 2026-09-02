// ============================================================
// PERINTAH PESANAN LEWAT PESAN SINGKAT
//
// Satu balasan di Telegram menerbitkan kode akses. Tidak perlu membuka
// dashboard, tidak perlu aplikasi tambahan, dan bekerja dari layar kunci.
//
// Ini BUKAN pengganti jembatan mutasi otomatis — yang benar-benar otomatis
// tetap jalur pemberitahuan DANA. Ini penambal jarak antara "mahasiswa sudah
// membayar" dan "pemiliknya sempat membuka dashboard", dan jarak itulah yang
// selama ini terasa seperti pembayaran yang menggantung.
//
// Bebas dari lapisan Telegram maupun WhatsApp dengan sengaja: keduanya boleh
// memanggilnya, dan pengujiannya tidak perlu memalsukan satu pun kiriman bot.
// ============================================================
import { paketDari, rapikanNomorPesanan } from "@/lib/paket-cakrawala";
import { ambilPesanan, lunaskanPesanan } from "@/lib/pesanan-store";

/** Bentuk nomor pesanan: PSN- diikuti enam huruf/angka. */
const POLA_NOMOR = /^PSN-[A-Z0-9]{4,12}$/;

function berbentukNomorPesanan(teks: string) {
  return POLA_NOMOR.test(rapikanNomorPesanan(teks));
}

/** Perintah yang dikenali, atau null bila pesannya bukan untuk jalur ini. */
export type PerintahPesanan =
  | { jenis: "lunas"; nomor: string }
  | { jenis: "cek"; nomor: string }
  | { jenis: "bantuan" };

/**
 * Baca satu pesan menjadi perintah.
 *
 * Sengaja tanpa garis miring: orang tidak mengetik "/" di aplikasi pesan.
 * Yang tidak dikenali mengembalikan null, dan pemanggilnya meneruskan pesan
 * itu ke jalur lain — pesan biasa tidak boleh tertelan menjadi perintah.
 */
export function bacaPerintahPesanan(teks: string): PerintahPesanan | null {
  const isi = String(teks || "").trim();
  if (!isi) return null;

  const kata = isi.split(/\s+/);
  const awal = kata[0]?.toLowerCase() ?? "";

  if (awal === "lunas" || awal === "terbitkan") {
    const nomor = rapikanNomorPesanan(kata[1]);
    return nomor ? { jenis: "lunas", nomor } : { jenis: "bantuan" };
  }
  if (awal === "cek" || awal === "pesanan") {
    const nomor = rapikanNomorPesanan(kata[1]);
    return nomor ? { jenis: "cek", nomor } : { jenis: "bantuan" };
  }
  // Nomor pesanan yang ditempel sendirian dibaca sebagai permintaan cek.
  // Menempel nomor adalah yang paling sering dilakukan orang, dan menolaknya
  // hanya karena tidak ada kata perintahnya terasa seperti kerusakan.
  //
  // Bentuknya WAJIB benar-benar nomor pesanan, bukan sembarang satu kata.
  // rapikanNomorPesanan hanya merapikan; ia menerima apa pun. Tanpa
  // pemeriksaan bentuk di sini, "ringkas" — perintah Catatan Uang yang dipakai
  // di chat yang sama — tertelan menjadi permintaan cek pesanan, dan fitur
  // yang sama sekali lain berhenti bekerja bagi pemiliknya.
  if (kata.length === 1 && berbentukNomorPesanan(isi)) {
    return { jenis: "cek", nomor: rapikanNomorPesanan(isi) };
  }
  return null;
}

/**
 * Kerjakan perintahnya. Mengembalikan balasan siap kirim.
 *
 * Pemanggilnya WAJIB memastikan lebih dulu bahwa yang mengirim adalah
 * pemiliknya. Fungsi ini tidak mengenal siapa pun.
 */
export async function layaniPerintahPesanan(perintah: PerintahPesanan): Promise<string> {
  if (perintah.jenis === "bantuan") {
    return [
      "Perintah pesanan Cakrawala:",
      "",
      "  lunas PSN-XXXXXX   → terbitkan kode aksesnya",
      "  cek PSN-XXXXXX     → lihat status pesanannya",
      "",
      "Nomor pesanannya boleh ditempel sendirian untuk melihat statusnya.",
    ].join("\n");
  }

  const pesanan = await ambilPesanan(perintah.nomor);
  if (!pesanan) return `Pesanan ${perintah.nomor} tidak ditemukan.`;

  const ringkas = [
    `Pesanan : ${pesanan.orderCode}`,
    `Paket   : ${pesanan.packageName} · ${pesanan.days} hari`,
    `Nominal : Rp ${pesanan.amount.toLocaleString("id-ID")}`,
    `Status  : ${pesanan.status}`,
    ...(pesanan.buyerName ? [`Nama    : ${pesanan.buyerName}`] : []),
  ];

  if (perintah.jenis === "cek") {
    if (pesanan.status === "lunas" && pesanan.accessCode) {
      return [...ringkas, `Kode    : ${pesanan.accessCode}`].join("\n");
    }
    if (pesanan.claimedAt) {
      ringkas.push("", "Pembelinya sudah menekan \"Saya sudah membayar\".");
      ringkas.push(`Kalau nominalnya cocok di mutasi, balas: lunas ${pesanan.orderCode}`);
    }
    return ringkas.join("\n");
  }

  // ---- lunas ----
  if (pesanan.status === "batal") return `Pesanan ${pesanan.orderCode} sudah dibatalkan.`;
  if (pesanan.status === "lunas" && pesanan.accessCode) {
    // Perintah yang sama dikirim dua kali TIDAK menerbitkan kode kedua.
    return [`Pesanan ${pesanan.orderCode} memang sudah lunas.`, `Kode: ${pesanan.accessCode}`].join("\n");
  }

  const paket = paketDari(pesanan.packageId);
  if (!paket) return `Paket "${pesanan.packageId}" tidak dikenali. Tandai lunas lewat dashboard.`;

  const hasil = await lunaskanPesanan(pesanan.orderCode, "telegram", paket);
  if (!hasil.ok) return `Gagal: ${hasil.pesan}`;

  return [
    "✅ Kode akses terbit.",
    "",
    `Pesanan : ${pesanan.orderCode}`,
    `Kode    : ${hasil.accessCode}`,
    "",
    "Kodenya sudah muncul sendiri di layar pembelinya.",
  ].join("\n");
}
