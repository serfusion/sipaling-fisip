"use client";

// ============================================================
// TIRAI LAYAR UJIAN
//
// Satu bidang gelap yang menutup seluruh soal begitu ada isyarat tangkapan
// layar, atau begitu halaman ujiannya ditinggalkan.
//
// APA YANG SEBENARNYA DIKERJAKANNYA — dan ini harus dimengerti sebelum ia
// dijanjikan kepada siapa pun:
//
//   Ia TIDAK menggagalkan tangkapan layar. Ia MENGOSONGKAN ISINYA.
//
// Peramban tidak punya jalan untuk menolak Print Screen; yang ada di
// tangannya hanya kuas gambar. Maka yang dikerjakan komponen ini adalah
// memastikan bahwa pada saat gambarnya diambil, yang ada di layar bukan soal
// melainkan bidang gelap bertuliskan nama peserta dan peringatan.
//
// Untuk alat potong — Win+Shift+S di Windows, Cmd+Shift+4 di macOS — ini
// hampir selalu menang, karena sesudah pintasannya ditekan orangnya masih
// harus menyeret kotak seleksi. Untuk Print Screen ia sering kalah, karena
// sistem menyalin layar pada saat tombolnya turun. Untuk tombol Volume+Power
// di ponsel ia tidak pernah tahu sama sekali — tidak ada peristiwa web untuk
// itu, dan di situlah aplikasi ujian di lockdown/ mengambil alih dengan
// penolakan sungguhan dari sistem operasinya.
//
// TIGA HAL YANG MENENTUKAN BENTUKNYA:
//
//   1. PEKAT, BUKAN BURAM. Latar buram (backdrop-filter) masih menyisakan
//      bentuk paragraf soal yang terbaca pada tangkapan layar beresolusi
//      tinggi, dan sebagian peramban ponsel mengabaikannya sama sekali.
//   2. MENELAN KETUKAN. Kebalikan dari tanda air. Selama tirai tertutup,
//      tombol jawaban di baliknya TIDAK boleh dapat ditekan — kalau bisa,
//      tirai justru menjadi tempat menekan tombol tanpa terlihat.
//   3. MENGATAKAN SEBABNYA. Peserta yang layarnya menggelap tanpa keterangan
//      akan mengira ujiannya rusak, lalu memuat ulang halaman di tengah
//      ujian. Yang tertulis di sini menjawabnya sebelum tangannya bergerak.
// ============================================================

import { PESAN_TIRAI, type SebabTirai } from "@/lib/kunci-layar";
import { tandaAir, type Peserta } from "@/lib/pengawasan";

export default function Tirai({ sebab, peserta }: { sebab: SebabTirai; peserta: Peserta }) {
  const pesan = PESAN_TIRAI[sebab];
  const tanda = tandaAir(peserta);

  return (
    <div className="uj-tirai" role="alert" aria-live="assertive">
      <div className="uj-tirai-isi">
        <div className="uj-tirai-lambang" aria-hidden="true">🔒</div>
        <b>{pesan.judul}</b>
        <p>{pesan.isi}</p>
        {/* Identitas peserta dicetak TERANG di sini, bukan samar seperti pada
            tanda air biasa. Kalau tangkapan layarnya tetap jadi, inilah yang
            tertangkap — dan gambar yang isinya hanya nama pengambilnya sendiri
            beserta peringatan adalah gambar yang tidak seorang pun mau
            sebarkan. */}
        {tanda && <span className="uj-tirai-tanda">{tanda}</span>}
      </div>
    </div>
  );
}
