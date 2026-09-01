// ============================================================
// MEMBEDAKAN PERINTAH DARI CATATAN UANG
//
// Di Telegram orang mengetik "/batal". Di WhatsApp garis miring itu hampir
// tidak pernah dipakai; yang diketik hanya "batal". Menerima kata telanjang
// sebagai perintah membuka satu jebakan yang tidak boleh dianggap remeh:
//
//   "bantuan sosial 500k"   -> catatan uang, BUKAN permintaan bantuan
//   "daftar ulang 500k"     -> biaya kuliah, BUKAN pendaftaran buku
//
// Dua aturan yang memisahkannya, dan keduanya dapat diperiksa tanpa menebak:
//
//   1. Perintah satu kata hanya dianggap perintah bila pesannya memang cuma
//      satu kata itu (atau diawali garis miring).
//   2. "daftar" dianggap pendaftaran hanya bila argumennya benar-benar kode
//      buku yang sah bentuknya.
//
// Berkas ini sengaja tidak menyentuh basis data supaya dapat diuji sendiri.
// ============================================================
import { normalisasiKode } from "./buku";

/** Nama baku tiap perintah, sesudah semua sebutan lainnya diseragamkan. */
export type NamaPerintah = "daftar" | "bantuan" | "ringkas" | "batal" | "buku" | "lepas";

const SEBUTAN: Record<string, NamaPerintah> = {
  daftar: "daftar",
  sambung: "daftar",

  bantuan: "bantuan",
  help: "bantuan",
  menu: "bantuan",
  mulai: "bantuan",
  start: "bantuan",
  halo: "bantuan",
  hai: "bantuan",

  ringkas: "ringkas",
  ringkasan: "ringkas",
  bulan: "ringkas",

  batal: "batal",
  undo: "batal",
  hapus: "batal",

  buku: "buku",

  lepas: "lepas",
  putus: "lepas",
};

export type Bacaan = {
  /** null berarti pesannya catatan uang biasa, bukan perintah. */
  nama: NamaPerintah | null;
  /** Kode buku pada perintah daftar. null berarti kodenya tidak terbaca. */
  kode: string | null;
  bergarisMiring: boolean;
  /** Kata pertama sesudah garis miring dan nama bot dibuang. */
  kata: string;
};

export function bacaPerintah(teks: string): Bacaan {
  const potongan = String(teks || "").trim().split(/\s+/);
  const mentah = potongan[0] || "";
  const bergarisMiring = mentah.startsWith("/");
  // Di grup, Telegram menempelkan nama botnya: "/batal@BukuKasBot".
  const kata = mentah.toLowerCase().replace(/^\//, "").replace(/@[\w_]+$/, "");
  const kosong: Bacaan = { nama: null, kode: null, bergarisMiring, kata };

  const nama = SEBUTAN[kata];
  if (!nama) return kosong;

  if (nama === "daftar") {
    const kode = normalisasiKode(potongan.slice(1).join(" "));
    if (kode) return { nama: "daftar", kode, bergarisMiring, kata };
    // Tanpa kode yang sah: hanya dianggap perintah bila memang terlihat
    // seperti percobaan mendaftar, bukan seperti kalimat biasa.
    if (bergarisMiring || potongan.length <= 2) {
      return { nama: "daftar", kode: null, bergarisMiring, kata };
    }
    return kosong;
  }

  if (bergarisMiring || potongan.length === 1) {
    return { nama, kode: null, bergarisMiring, kata };
  }
  return kosong;
}
