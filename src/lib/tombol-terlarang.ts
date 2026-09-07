// ============================================================
// TOMBOL YANG DICEGAT SELAMA UJIAN
//
// Berkas ini menjawab satu pertanyaan saja: satu ketukan papan ketik yang baru
// saja terjadi, apakah ia sesuatu yang tidak boleh dilakukan selama ujian, dan
// kalau ya — apa namanya, seberapa berat, dan apakah pencegahannya SUNGGUHAN.
//
// Yang terakhir itu yang paling penting, dan karena itu ia menjadi satu kolom
// tersendiri: `benarTercegah`.
//
//   BENAR-BENAR DAPAT DIBATALKAN halaman web:
//     Ctrl+P (pratayang cetak), Ctrl+S (simpan halaman), Ctrl+U (lihat sumber),
//     Ctrl+R dan F5 (muat ulang), Ctrl+A (sorot semua).
//     Untuk kelima ini preventDefault sungguh menggagalkan perbuatannya.
//
//   TIDAK DAPAT DIBATALKAN, apa pun yang dikerjakan halaman:
//     PrintScreen dan alat potong sistem (Win+Shift+S, Cmd+Shift+3/4/5) —
//       sistem operasi yang menanganinya, dan sebagian tidak pernah sampai ke
//       halaman sama sekali.
//     F12 dan Ctrl+Shift+I/J/C — peramban memakainya lebih dulu untuk dirinya
//       sendiri. preventDefault tetap dipanggil karena sebagian peramban lama
//       menghormatinya, tetapi TIDAK BOLEH dijanjikan.
//     F11 — layar penuh peramban. Yang menjaganya bukan tombol ini melainkan
//       peristiwa fullscreenchange, yang menyala apa pun cara keluarnya.
//
// Yang tidak dapat dibatalkan tetap dicatat, dan pencatatannya bukan hiasan:
// tiga kali menekannya mengumpulkan ujian sertifikasi secara paksa. Halaman
// tidak dapat menghalangi tangan peserta, tetapi dapat mengakhiri ujiannya.
//
// SATU HAL YANG SENGAJA TIDAK ADA DI SINI: Ctrl+T, Ctrl+N, Ctrl+W, Alt+Tab,
// dan tombol Windows. Semuanya ditangani peramban atau sistem sebelum halaman
// melihatnya; menuliskannya di daftar ini hanya akan menjadi janji yang tidak
// pernah ditepati satu baris kode pun.
// ============================================================

import type { JenisInsiden } from "./pengawasan";

/** Apa yang sedang diusahakan peserta dengan ketukan itu. */
export type GolonganTombol =
  /** Menyalin isi ujian keluar: tangkapan layar, cetak, simpan halaman. */
  | "tangkap"
  /** Membuka alat pengembang atau sumber halaman. */
  | "devtools"
  /** Memuat ulang halaman ujian di tengah pengerjaan. */
  | "muat_ulang"
  /** Menyorot seluruh naskah sekaligus — langkah pertama menyalinnya. */
  | "pilih_semua"
  /** Menyalakan atau mematikan layar penuh peramban lewat F11. */
  | "layar_penuh";

/** Bentuk peristiwa papan ketik yang dibutuhkan, tanpa DOM. */
export type Isyarat = {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
};

export type PutusanTombol = {
  golongan: GolonganTombol;
  /** Nama yang dicatat dan dibacakan, mis. "Ctrl+Shift+I". */
  nama: string;
  /**
   * Insiden yang dilaporkan ke server, atau null bila ketukan itu dicegah
   * tanpa dicatat.
   *
   * Null bukan kelalaian. Memuat ulang halaman dan menyorot seluruh teks
   * dilakukan orang yang panik sama seringnya dengan orang yang curang, dan
   * keduanya sudah gagal begitu dicegah — memotong skor integritas untuk itu
   * hanya menghukum peserta yang gugup.
   */
  insiden: JenisInsiden | null;
  /** Soalnya ditutup tirai sesaat sesudah ketukan ini. */
  tirai: boolean;
  /**
   * preventDefault SUNGGUH membatalkan perbuatannya di peramban.
   *
   * False berarti ketukannya tetap berhasil dan yang tersisa hanya catatan.
   * Dipakai kalimat di layar peserta supaya tidak pernah menulis "diblokir"
   * untuk sesuatu yang nyatanya tidak terblokir.
   */
  benarTercegah: boolean;
};

export const PESAN_TOMBOL: Record<GolonganTombol, string> = {
  tangkap:
    "Percobaan menyalin isi layar dicatat pengawas beserta jamnya.",
  devtools:
    "Alat pengembang tidak boleh dibuka selama ujian. Percobaannya dicatat pengawas.",
  muat_ulang:
    "Halaman ujian tidak dapat dimuat ulang. Jawabanmu tersimpan sendiri; " +
    "pakai tombol di layar untuk berpindah soal.",
  pilih_semua:
    "Menyorot seluruh naskah soal dimatikan selama ujian.",
  layar_penuh:
    "Ujian ini harus tetap dalam layar penuh.",
};

// ------------------------------------------------------------
// PENGENAL KETUKAN
// ------------------------------------------------------------

/**
 * Satu huruf ditekan?
 *
 * `key` DAN `code` sama-sama diperiksa, dan itu bukan kelebihan kehati-hatian.
 * Papan ketik bertata letak bukan-Latin — Arab, Sirilik, Yunani — mengirim
 * `key` dalam aksaranya sendiri untuk tombol fisik yang sama, sehingga
 * Ctrl+Shift+I di sana tidak pernah terbaca kalau hanya `key` yang dibaca.
 * `code` menamai tombol fisiknya dan tidak berubah.
 */
function huruf(t: Isyarat, h: string): boolean {
  return String(t.key ?? "").toLowerCase() === h || t.code === `Key${h.toUpperCase()}`;
}

function angka(t: Isyarat, a: string): boolean {
  return String(t.key ?? "") === a || t.code === `Digit${a}`;
}

function salahSatuHuruf(t: Isyarat, daftar: string[]): string {
  return daftar.find((h) => huruf(t, h)) ?? "";
}

/** Nama ketukan seperti yang ditulis orang: Ctrl+Shift+I, bukan I+Shift+Ctrl. */
function sebut(t: Isyarat, dasar: string): string {
  const bagian: string[] = [];
  if (t.ctrlKey) bagian.push("Ctrl");
  if (t.altKey) bagian.push("Alt");
  if (t.shiftKey) bagian.push("Shift");
  if (t.metaKey) bagian.push("Meta");
  bagian.push(dasar);
  return bagian.join("+");
}

/** Huruf yang membuka alat pengembang di Chrome, Firefox, dan Edge. */
const HURUF_DEVTOOLS = ["i", "j", "c", "k", "e", "m", "p"];

/**
 * Periksa satu ketukan.
 *
 * @param mengetik peserta sedang berada di kolom isian atau essay. Hanya satu
 *   golongan yang dibebaskan olehnya — `pilih_semua` — karena orang yang
 *   menulis jawaban panjang HARUS dapat menyorot kalimatnya sendiri untuk
 *   membetulkannya. Melarang itu tidak menghalangi kecurangan apa pun dan
 *   hanya membuat menulis essay menjadi siksaan.
 *
 * @returns null bila ketukannya biasa saja. Urutan pemeriksaannya berarti:
 *   Meta+Shift+S adalah alat potong, BUKAN "simpan halaman", jadi alat potong
 *   diperiksa lebih dulu.
 */
export function periksaTombol(t: Isyarat, mengetik = false): PutusanTombol | null {
  const kunci = String(t.key ?? "");
  const ctrlAtauCmd = Boolean(t.ctrlKey || t.metaKey);

  // ---------- 1. TANGKAPAN LAYAR SISTEM ----------
  // Tidak dapat dibatalkan. PrintScreen sering hanya muncul pada keyup karena
  // penekanannya dicegat sistem sebelum keydown sampai ke halaman.
  if (kunci === "PrintScreen" || kunci === "Print" || t.code === "PrintScreen") {
    return {
      golongan: "tangkap", nama: "PrintScreen",
      insiden: "tangkap", tirai: true, benarTercegah: false,
    };
  }

  // ---------- 2. ALAT POTONG ----------
  // Win+Shift+S di Windows, Cmd+Shift+3/4/5 di macOS. Yang macOS sering tidak
  // pernah sampai ke sini sama sekali — sistemnya menelannya lebih dulu — dan
  // itu memang batasnya. Yang Windows sampai, dan tiraïnya hampir selalu
  // menang karena sesudah pintasannya ditekan orangnya masih harus menyeret
  // kotak seleksi.
  if (t.metaKey && t.shiftKey) {
    const s = huruf(t, "s");
    const n = ["3", "4", "5"].find((a) => angka(t, a)) ?? "";
    if (s || n) {
      return {
        golongan: "tangkap", nama: sebut(t, s ? "S" : n),
        insiden: "tangkap", tirai: true, benarTercegah: false,
      };
    }
  }

  // ---------- 3. CETAK ----------
  // Satu-satunya jalan penyalinan yang benar-benar DAPAT dihentikan, dan
  // sekaligus yang paling merugikan bila lolos: pratayang cetak menyalin
  // SELURUH naskah — termasuk yang tergulung jauh di luar layar — menjadi satu
  // PDF rapi, sedangkan tangkapan layar hanya mendapat satu layar.
  if (ctrlAtauCmd && !t.shiftKey && huruf(t, "p")) {
    return {
      golongan: "tangkap", nama: sebut(t, "P"),
      insiden: "tangkap", tirai: true, benarTercegah: true,
    };
  }

  // ---------- 4. SIMPAN HALAMAN ----------
  // Ctrl+S menuliskan seluruh naskah soal ke berkas. Tirai tidak dipasang:
  // yang disalin bukan gambar layar melainkan isi halamannya, jadi menutupinya
  // tidak mengubah apa pun. Yang menghentikannya preventDefault, dan itu
  // sungguh berhasil.
  if (ctrlAtauCmd && !t.shiftKey && !t.altKey && huruf(t, "s")) {
    return {
      golongan: "tangkap", nama: sebut(t, "S"),
      insiden: "tangkap", tirai: false, benarTercegah: true,
    };
  }

  // ---------- 5. LIHAT SUMBER HALAMAN ----------
  if (ctrlAtauCmd && !t.shiftKey && huruf(t, "u")) {
    return {
      golongan: "devtools", nama: sebut(t, "U"),
      insiden: "devtools", tirai: false, benarTercegah: true,
    };
  }

  // ---------- 6. ALAT PENGEMBANG ----------
  // F12, Ctrl+Shift+I/J/C/K/E/M/P, dan Cmd+Opt+I/J/C di macOS.
  //
  // TIDAK ADA yang benar-benar tercegah di sini, dan itu ditulis apa adanya
  // pada benarTercegah. Peramban memakai pintasan ini untuk dirinya sendiri
  // dan tidak menyerahkannya kepada halaman. Yang menahan peserta bukan
  // pencegahannya melainkan akibatnya: tiap ketukan tercatat berbobot tiga
  // puluh angka, dan tiga di antaranya mengakhiri ujian sertifikasi.
  const f12 = kunci === "F12" || t.code === "F12";
  const chromium = ctrlAtauCmd && t.shiftKey ? salahSatuHuruf(t, HURUF_DEVTOOLS) : "";
  const mac = t.metaKey && t.altKey ? salahSatuHuruf(t, ["i", "j", "c", "u"]) : "";
  if (f12 || chromium || mac) {
    const dasar = f12 ? "F12" : (chromium || mac).toUpperCase();
    return {
      golongan: "devtools", nama: f12 ? "F12" : sebut(t, dasar),
      insiden: "devtools", tirai: true, benarTercegah: false,
    };
  }

  // ---------- 7. MUAT ULANG ----------
  // Dicegah, tetapi TIDAK dicatat sebagai pelanggaran. Peserta yang layarnya
  // terasa macet menekan F5 karena panik, bukan karena curang — dan lagi pula
  // memuat ulang tidak menghapus apa pun: seluruh hitungan insiden disimpan
  // server, bukan di halaman ini.
  if (kunci === "F5" || t.code === "F5" || (ctrlAtauCmd && huruf(t, "r"))) {
    return {
      golongan: "muat_ulang", nama: kunci === "F5" || t.code === "F5" ? sebut(t, "F5") : sebut(t, "R"),
      insiden: null, tirai: false, benarTercegah: true,
    };
  }

  // ---------- 8. SOROT SEMUA ----------
  if (ctrlAtauCmd && !t.shiftKey && !t.altKey && huruf(t, "a")) {
    if (mengetik) return null;
    return {
      golongan: "pilih_semua", nama: sebut(t, "A"),
      insiden: null, tirai: false, benarTercegah: true,
    };
  }

  // ---------- 9. F11 ----------
  // Dicatat sebagai upaya, bukan sebagai pelanggaran: keluar dari layar penuh
  // sudah punya penjaganya sendiri lewat fullscreenchange, yang menyala apa pun
  // cara keluarnya — termasuk Escape, yang tidak pernah dapat dicegat.
  // Melaporkannya dari sini juga akan menghitung satu perbuatan dua kali.
  if (kunci === "F11" || t.code === "F11") {
    return {
      golongan: "layar_penuh", nama: "F11",
      insiden: null, tirai: false, benarTercegah: false,
    };
  }

  return null;
}
