"use client";

// ============================================================
// KOTAK PASTIKAN
//
// Pertanyaan yang berdiri sebelum satu perbuatan yang tidak dapat ditarik
// kembali: mengumpulkan ujian, atau meninggalkan halamannya.
//
// KENAPA IA DIGAMBAR SENDIRI DAN BUKAN window.confirm()
//
// Inilah seluruh sebab keberadaan berkas ini, dan ia datang dari keluhan
// peserta sungguhan: "baru mau mengakhiri ujian, malah kena pelanggaran keluar
// dari layar."
//
// Kotak bawaan peramban — confirm(), alert(), prompt() — BUKAN lapisan di
// dalam halaman. Ia milik peramban, berdiri di luar dokumen, dan karena itu:
//
//   - Chrome MELEPAS LAYAR PENUH sebelum menggambarnya. Halaman ujian yang
//     tadinya layar penuh mendapat satu `fullscreenchange` yang tidak pernah
//     diminta siapa pun, dan penjaga membacanya sebagai peserta yang keluar
//     dari layar penuh: satu pelanggaran berat, satu kotak teguran, satu
//     langkah lebih dekat ke pengumpulan paksa — untuk satu ketukan pada
//     tombol "AKHIRI UJIAN".
//   - sebagian peramban lain melepas FOKUS jendelanya selama kotak itu
//     berdiri, dan peserta yang membaca pertanyaannya lebih dari satu setengah
//     detik mendapat catatan "jendela kehilangan fokus" sebagai gantinya.
//
// Kotak ini tidak melakukan keduanya. Ia satu <div> di dalam dokumen yang sama:
// layar penuhnya tidak pernah lepas, fokusnya tidak pernah keluar, dan tidak
// ada satu peristiwa pun yang sampai ke penjaga.
//
// TIGA hal lagi yang menentukan bentuknya:
//
//   1. TIDAK MENIDURKAN PENJAGA. Selama kotak ini terbuka, ujiannya MASIH
//      diawasi sepenuhnya. Menjeda pengawasan selama sebuah kotak konfirmasi
//      terbuka akan membuka jalan curang yang paling murah yang dapat
//      dibayangkan: tekan "Akhiri", pindah tab mencari jawaban selama kotaknya
//      menunggu, lalu tekan "Belum".
//   2. DI BAWAH TIRAI. Tirai layar penuh dan kotak teguran tetap menang atas
//      kotak ini (z-index 60 dan 70 lawan 55). Peserta yang membuka kotak ini
//      lalu keluar dari layar penuh tidak boleh mendapati soalnya terbuka di
//      belakang sebuah kotak yang dapat ia biarkan terbuka.
//   3. TANPA TOMBOL ESC. Esc di dalam layar penuh dimiliki peramban, bukan
//      halaman: menekannya KELUAR dari layar penuh, dan itu persis pelanggaran
//      yang sedang diperbaiki berkas ini. Kotak ini karena itu hanya punya dua
//      jalan keluar, dan keduanya tombol.
// ============================================================

import { useEffect, useRef } from "react";
import type { Pastikan as IsiPastikan } from "@/lib/pastikan";

export type { Pastikan as IsiPastikan } from "@/lib/pastikan";

export default function Pastikan(
  { isi, sibuk, ya, tidak }: {
    isi: IsiPastikan;
    /** Sedang mengirim ke server — tombolnya dikunci supaya tidak ditekan dua kali. */
    sibuk?: boolean;
    ya: () => void;
    tidak: () => void;
  },
) {
  const batalRef = useRef<HTMLButtonElement>(null);

  // Fokus pindah ke tombol BATAL, bukan ke tombol yang menutup ujian.
  //
  // Dua hal sekaligus: peserta yang menekan Enter karena terbiasa dengan kotak
  // bawaan peramban tidak akan mengumpulkan ujiannya tanpa membaca, dan fokus
  // yang berpindah ke dalam kotak ini menahan tombol di belakangnya menerima
  // ketukan papan ketik berikutnya.
  //
  // Fokus yang berpindah DI DALAM dokumen tidak pernah memicu blur pada window,
  // jadi ia tidak pernah menjadi catatan atas nama peserta.
  useEffect(() => { batalRef.current?.focus(); }, []);

  return (
    <div
      className={`uj-pastikan uj-pastikan-${isi.nada}`}
      role="alertdialog"
      aria-modal="true"
      aria-label={isi.judul}
    >
      <div className="uj-pastikan-kotak">
        <b className="uj-pastikan-judul">{isi.judul}</b>
        {isi.rincian && <div className="uj-pastikan-rincian">{isi.rincian}</div>}
        {isi.kalimat.map((k, i) => (
          <p key={i} className="uj-pastikan-teks">{k}</p>
        ))}
        {/* Tombol batal ditulis LEBIH DULU di dalam dokumen — ia yang menerima
            fokus pertama dan ia yang dibaca pembaca layar lebih dulu. Yang
            menutup ujian berdiri di kanan, tempat mata membaca terakhir. */}
        <div className="uj-pastikan-tombol">
          <button
            ref={batalRef}
            type="button"
            className="btn uj-pastikan-batal"
            disabled={sibuk}
            onClick={tidak}
          >
            {isi.tidak}
          </button>
          <button
            type="button"
            className="btn uj-pastikan-ya"
            disabled={sibuk}
            onClick={ya}
          >
            {sibuk ? "Mengumpulkan…" : isi.ya}
          </button>
        </div>
      </div>
    </div>
  );
}
