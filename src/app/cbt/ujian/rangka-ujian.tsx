"use client";

// ============================================================
// RANGKA LAYAR UJIAN — sama dengan halaman depan CBT
//
// Layar kode, identitas, dan selesai dahulu berupa kotak putih polos di
// tengah halaman, sementara halaman depannya sudah berlatar biru dua kolom.
// Dua rancangan pada satu situs membuat mahasiswa ragu apakah ia masih berada
// di tempat yang benar — tepat pada saat ia paling tidak ingin ragu.
//
// Kelas yang dipakai SAMA PERSIS dengan halaman depan (cbtd-*), bukan salinan
// yang mirip. Salinan akan menyimpang pada perubahan berikutnya, dan
// menyimpangnya tidak terlihat sampai ada yang membuka keduanya berdampingan.
//
// Layar MENGERJAKAN tidak memakai rangka ini, dan itu disengaja: di sana yang
// dibutuhkan seluruh lebar layar untuk soal dan palet nomor.
// ============================================================

import type { ReactNode } from "react";

export type RangkaUjianProps = {
  /** Judul besar di kolom kiri. */
  judul: string;
  /** Satu baris keterangan di bawah judul. */
  sub: string;
  /** Butir-butir penenang di kolom kiri. Disembunyikan di ponsel. */
  poin?: string[];
  /** Lencana kecil di atas judul, mis. nama mata kuliah. */
  lencana?: string;
  children: ReactNode;
};

const POIN_BAWAAN = [
  "Tidak perlu membuat akun. Cukup kode ujian, nama, dan NIM.",
  "Jawaban tersimpan otomatis tiap sepuluh detik.",
  "Waktu dihitung di server, jadi aman walau jaringan tersendat.",
  "Nyaman dikerjakan dari ponsel maupun komputer.",
];

export default function RangkaUjian({ judul, sub, poin, lencana, children }: RangkaUjianProps) {
  const butir = poin && poin.length > 0 ? poin : POIN_BAWAAN;
  return (
    <div className="cbtd">
      <aside className="cbtd-kiri">
        {lencana ? (
          <span className="cbtd-lencana">{lencana}</span>
        ) : (
          <div className="cbtd-lambang" aria-hidden="true">📝</div>
        )}
        <h1>{judul}</h1>
        <p className="cbtd-sub">{sub}</p>
        <ul className="cbtd-nilai">
          {butir.map((b) => <li key={b}>{b}</li>)}
        </ul>
      </aside>

      <main className="cbtd-kanan">
        <div className="cbtd-kotak">{children}</div>
      </main>
    </div>
  );
}
