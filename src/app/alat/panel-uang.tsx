"use client";

// ============================================================
// PANEL CATATAN UANG DI DALAM CAKRAWALA
//
// Sengaja berdiri di kelompok menu yang lain, bukan di antara sembilan alat
// naskah. Alasannya bukan tata letak: alat naskah bekerja pada project
// skripsi, sedangkan yang ini bekerja pada uang pribadi pemiliknya. Dua hal
// yang tidak pernah berpotongan tidak boleh terlihat sederajat, supaya tidak
// ada yang menyangka catatan belanjanya ikut terbaca dosen pembimbing.
//
// Layarnya sendiri berkas yang sama persis dengan halaman /uang. Yang berbeda
// hanya dua: bukunya disiapkan sendiri dari langganan Cakrawala, dan
// warnanya menumpang palet Cakrawala lewat token --ug-* di globals.css.
// ============================================================

import UangApp from "../uang/uang-app";
import { IKON_UANG, Kepala, Rinci } from "./ikon";

export function PanelUang() {
  return (
    <section className="al-card">
      <Kepala
        ikon={IKON_UANG}
        judul="Catatan Uang"
        sub="Tulis satu pesan, pemasukan dan pengeluaran bulanan tercatat sendiri"
      />

      <Rinci judul="Kenapa ada di sini?">
        <p>
          Ini satu-satunya alat Cakrawala yang tidak ada hubungannya dengan skripsi, dan memang
          diletakkan terpisah karena itu. Ia ikut dalam langganan yang sama: begitu menu ini dibuka,
          buku kasnya sudah disiapkan atas nama kode akses Anda, jadi tidak ada kode kedua yang
          perlu diingat dan tidak ada pendaftaran ulang di ponsel.
        </p>
        <p>
          Catatannya milik pribadi. Ia tidak pernah muncul di project, tidak ikut ke laporan, dan
          tidak terlihat oleh dosen maupun admin portal.
        </p>
      </Rinci>

      <UangApp dalam />
    </section>
  );
}
