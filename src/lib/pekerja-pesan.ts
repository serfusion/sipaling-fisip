// SURAT-MENYURAT DENGAN PEKERJA LATAR
//
// Hanya bentuk pesannya yang ditulis di sini, tanpa satu baris pun kode yang
// berjalan. Dua sisi memakainya: utas utama yang mengirim permintaan, dan
// pekerja latar yang menjawabnya. Dipisahkan supaya utas utama tidak ikut
// memuat pustaka berat milik pekerja hanya untuk mengetahui bentuk pesannya.

import type { JenisBerkas } from "./berkas";
import type { HasilEkstrak } from "./ekstrak-naskah";
import type { Ringkasan as RingkasanBahasa } from "./bahasa-check";
import type { periksaInggris } from "./manuscript";
import type { TemuanFrasa } from "./frasa-akademik";
import type { HasilKemiripan, Sumber, Temuan as TemuanSitasi } from "./kemiripan";

export type PetaTugas = {
  /** Ambil teks dari berkas Word, PDF, atau teks polos. */
  berkas: { minta: { jenis: JenisBerkas; berkas: File }; jawab: HasilEkstrak };
  /** Periksa ragam ilmiah Bahasa Indonesia. */
  bahasa: { minta: { teks: string }; jawab: RingkasanBahasa };
  /** Periksa ragam akademik Inggris. */
  inggris: { minta: { teks: string }; jawab: ReturnType<typeof periksaInggris> };
  /** Cari padanan frasa akademik pada naskah Indonesia. */
  frasa: { minta: { teks: string }; jawab: TemuanFrasa[] };
  /** Cocokkan sitasi dalam teks dengan daftar pustaka. */
  sitasi: { minta: { naskah: string; daftarPustaka: string }; jawab: TemuanSitasi[] };
  /** Bandingkan naskah dengan sumber yang ditempel pengguna. */
  kemiripan: { minta: { naskah: string; sumber: Sumber[] }; jawab: HasilKemiripan };
};

export type NamaTugas = keyof PetaTugas;

export type Permintaan = {
  [K in NamaTugas]: { id: number; tugas: K } & PetaTugas[K]["minta"];
}[NamaTugas];

export type Balasan =
  | { id: number; jenis: "kemajuan"; nilai: number; pesan: string }
  | { id: number; jenis: "selesai"; hasil: unknown }
  | { id: number; jenis: "gagal"; pesan: string };
