// ============================================================
// DAFTAR ALAT
//
// Menu Alat berdiri di sebelah Cakrawala dan memang dibuat untuk bertambah.
// Bedanya dengan Cakrawala: yang di sana bekerja pada naskah tugas akhir,
// yang di sini perkakas lain milik mahasiswa yang tidak ada hubungannya
// dengan naskah itu.
//
// Tiap alat punya halamannya sendiri (/perkakas/<id>), bukan tab yang
// digambar bergantian di satu halaman. Alasannya praktis: tiap alat membawa
// gerbang aksesnya sendiri di server, judul halamannya sendiri, dan bundel
// JavaScript-nya sendiri — pemutar video Theater Drama tidak ikut dimuat oleh
// orang yang membuka alat lain.
//
// Menambah alat baru: satu baris di sini, satu folder halaman di sebelahnya.
// Baris tab, alamat /perkakas, dan tombol Alat di portal mengikuti sendiri.
// ============================================================

import { IKON_DRAMA } from "@/app/alat/ikon";

export type Alat = {
  id: string;
  href: string;
  label: string;
  sub: string;
  ikon: string;
};

export const DAFTAR_ALAT: Alat[] = [
  {
    id: "drama",
    href: "/perkakas/drama",
    label: "Theater Drama",
    sub: "Drama pendek dari banyak sumber",
    ikon: IKON_DRAMA,
  },
];
