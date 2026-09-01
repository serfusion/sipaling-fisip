import type { Metadata } from "next";
import UangApp from "./uang-app";

export const metadata: Metadata = {
  title: "Catatan Uang | SiPaling FISIP",
  description:
    "Catat pemasukan dan pengeluaran bulanan cukup dengan mengirim pesan, mis. +honor guru 100k atau -beli nasi uduk 10k.",
};

// Seluruh halaman berjalan di peramban: bukunya dikunci oleh kode yang
// disimpan di perangkat masing-masing, jadi tidak ada yang perlu dirender
// lebih dulu di server. Pengurai pesannya pun berkas yang sama dengan yang
// dipakai server, sehingga pratinjau sambil mengetik tidak pernah berbeda
// hasilnya dengan yang benar-benar tersimpan.
export default function HalamanUang() {
  return <UangApp />;
}
