"use client";

import { useState } from "react";

/**
 * Tampilkan daftar panjang sepotong demi sepotong.
 *
 * Periksa Bahasa pada skripsi utuh dapat menghasilkan beberapa ribu temuan.
 * Digambar sekaligus, tiap temuan menjadi lima elemen, dan halaman berhenti
 * menanggapi selama peramban menyusunnya, padahal tidak ada yang membaca
 * temuan ke-1.400 sebelum membereskan yang pertama.
 *
 * Yang dipakai bukan penggulung maya: urutannya penting, hasilnya harus dapat
 * dicari dengan Ctrl+F, dan menambah potongan atas permintaan pengguna sudah
 * cukup. Yang ditampilkan lebih dulu selalu bagian awal, karena temuan
 * memang diurutkan mengikuti letaknya di naskah.
 */
export function useSebagian<T>(daftar: T[], langkah = 150) {
  // Batasnya disimpan bersama daftar yang berlaku baginya. Dengan begitu
  // daftar baru (hasil pemeriksaan ulang atau ganti saringan) otomatis
  // kembali ke potongan pertama, tanpa perlu effect yang menyetel ulang.
  const [simpanan, setSimpanan] = useState<{ untuk: T[] | null; batas: number }>({
    untuk: null,
    batas: langkah,
  });

  const batas = simpanan.untuk === daftar ? simpanan.batas : langkah;
  const tampil = batas >= daftar.length ? daftar : daftar.slice(0, batas);

  return {
    tampil,
    sisa: daftar.length - tampil.length,
    lagi: () => setSimpanan({ untuk: daftar, batas: batas + langkah }),
    semua: () => setSimpanan({ untuk: daftar, batas: daftar.length }),
  };
}

export function LebihBanyak({
  sisa, lagi, semua, satuan = "temuan",
}: { sisa: number; lagi: () => void; semua: () => void; satuan?: string }) {
  if (sisa <= 0) return null;
  return (
    <div className="al-lebih">
      <span>
        Masih ada {sisa.toLocaleString("id-ID")} {satuan} lagi.
      </span>
      <button type="button" className="al-mini" onClick={lagi}>Tampilkan lebih banyak</button>
      <button type="button" className="al-link" onClick={semua}>Tampilkan semua</button>
    </div>
  );
}
