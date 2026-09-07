"use client";

// ============================================================
// KOTAK TEGURAN
//
// Yang muncul di depan soal ketika peserta melakukan sesuatu yang ikut
// menghitung mundur ke pengumpulan paksa: menekan tombol tangkapan layar,
// membuka tab lain, keluar dari layar penuh, menempel ke kolom jawaban,
// membuka alat pengembang, menutup lensa kamera.
//
// EMPAT hal yang menentukan bentuknya, dan tak satu pun hiasan:
//
//   1. MENUTUP SOAL. Sama seperti tirai, dan pada percobaan tangkapan layar
//      itu bukan efek samping — gambar yang jadi berisi teguran ini, bukan
//      soal.
//   2. MENUNTUT SATU KETUKAN. Pita di tepi layar berhenti dibaca pada
//      pelanggaran kedua. Kotak yang tidak hilang sampai diakui tidak dapat
//      dilewatkan begitu saja, dan ketukan itu sendiri memakan waktu ujian.
//   3. MENYEBUT ANGKANYA, TANPA UJUNG. "Pelanggaran ke-3" tanpa pernah
//      mengatakan berapa batasnya. Peserta yang tahu batasnya membelanjakan
//      jatahnya dengan tenang sampai satu ketukan sebelum habis; yang tidak
//      tahu tidak punya jatah untuk dibelanjakan. Ketidakpastian itulah
//      ancamannya, dan ia tidak berbohong satu kata pun — ujiannya memang
//      dapat berakhir pada ketukan berikutnya.
//   4. MENANDAI. Identitas peserta dicetak terang di dalamnya, sehingga
//      tangkapan layar yang tetap berhasil diambil menunjuk satu orang.
//
// Yang TIDAK dikerjakan kotak ini: memutuskan apa pun. Keputusan mengakhiri
// ujian dibuat server dan sampai lewat jalan lain (lihat `dipaksa` di
// ujian-app.tsx). Kotak yang memutuskan sendiri akan selalu dapat dimatikan
// oleh peserta yang mematikan JavaScript-nya.
// ============================================================

import { pesanTeguran, tandaAir, type JenisInsiden, type Peserta } from "@/lib/pengawasan";

export type IsiTeguran = { jenis: JenisInsiden; nomor: number };

export default function Teguran(
  { isi, peserta, tutup }: { isi: IsiTeguran; peserta: Peserta; tutup: () => void },
) {
  const pesan = pesanTeguran(isi.jenis, isi.nomor);
  const tanda = tandaAir(peserta);

  return (
    <div className="uj-tegur" role="alertdialog" aria-modal="true" aria-live="assertive">
      <div className="uj-tegur-kotak">
        <div className="uj-tegur-lambang" aria-hidden="true">⚠</div>
        <b className="uj-tegur-judul">{pesan.judul}</b>
        <div className="uj-tegur-sebab">{pesan.sebab}</div>
        <p className="uj-tegur-ancaman">{pesan.ancaman}</p>
        {/* Tombolnya HARUS di dalam kotak: kotak ini menelan ketukan, dan
            tombol apa pun di baliknya tidak dapat ditekan lagi. */}
        <button type="button" className="btn btn-primary uj-tegur-aku" onClick={tutup}>
          Saya mengerti, lanjutkan ujian
        </button>
        {tanda && <span className="uj-tegur-tanda">{tanda}</span>}
      </div>
    </div>
  );
}
