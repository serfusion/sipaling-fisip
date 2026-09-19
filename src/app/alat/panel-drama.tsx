"use client";

// ============================================================
// PANEL NONTON DRAMA DI DALAM CAKRAWALA
//
// Berbeda dari Catatan Uang yang layarnya ikut dipasang di sini, Nonton Drama
// tinggal di SITUS LAIN — sipalingfisip.online — dan panel ini pintunya.
//
// Kenapa tidak dipasang di dalam saja seperti Catatan Uang? Karena isinya
// berbeda jenis. Cakrawala dibuka mahasiswa di ruang baca, kadang di layar
// yang kelihatan orang lain, dan ia halaman tugas akhir; menaruh deretan
// sampul drama di dalamnya mengubah apa yang tampak sedang dikerjakan
// pemiliknya. Situs terpisah membuat keduanya tidak pernah muncul dalam satu
// tangkapan layar yang sama.
//
// Tautannya sengaja ke /drama, BUKAN ke alamat lengkap domainnya. Jalur itu
// dialihkan middleware ke domain yang berlaku (lihat src/lib/situs-drama.ts),
// jadi satu tautan ini tetap benar di produksi, di pratayang penyebaran, dan
// di komputer yang sedang dipakai mengembangkannya.
// ============================================================

import { platformAktif } from "@/lib/drama";
import { hostDramaBawaan } from "@/lib/situs-drama";
import { IKON_DRAMA, Kepala, Rinci } from "./ikon";

const PLATFORM = platformAktif();

export function PanelDrama() {
  const domain = hostDramaBawaan();

  return (
    <section className="al-card">
      <Kepala
        ikon={IKON_DRAMA}
        judul="Nonton Drama"
        sub={`Drama pendek dari ${PLATFORM.length} sumber sekaligus, di ${domain}`}
      />

      <Rinci judul="Kenapa ada di situs lain?">
        <p>
          Halaman ini halaman tugas akhir, dan sering terbuka di layar yang ikut terlihat orang
          lain. Nonton Drama karena itu berdiri di alamatnya sendiri, <b>{domain}</b>, supaya
          keduanya tidak pernah muncul dalam satu layar yang sama.
        </p>
        <p>
          Yang membukanya kode Cakrawala yang <b>sama</b>. Tidak ada kode kedua, tidak ada biaya
          tambahan, dan memasukkannya di sana <b>tidak memotong masa langgananmu</b>, hari yang
          sudah dibeli tetap utuh. Kodenya perlu diketik sekali lagi di sana hanya karena peramban
          tidak pernah membawa kunci satu domain ke domain lain.
        </p>
        <p>
          Daftar judul dan videonya berasal dari API terbuka proyek{" "}
          <a href="https://github.com/Sansekai/SekaiDrama" target="_blank" rel="noreferrer noopener">
            SekaiDrama
          </a>
          . Tidak ada satu pun berkas video yang disimpan di sini, dan sumbernya dapat berubah
          sewaktu-waktu mengikuti proyek itu.
        </p>
      </Rinci>

      <div className="al-drama-sumber">
        <p className="al-drama-judul">Sumber yang sedang hidup</p>
        <div className="al-drama-chip">
          {PLATFORM.map((item) => (
            <span key={item.id} title={item.catatan}>
              <b style={{ background: item.warna }}>{item.inisial}</b>
              {item.nama}
            </span>
          ))}
        </div>
      </div>

      <a className="al-drama-tombol" href="/drama">
        Buka Nonton Drama →
      </a>
      <p className="al-drama-kaki">
        Tombol ini membawamu keluar dari portal, ke {domain}. Masukkan kode Cakrawala-mu sekali di
        sana, dan perangkat itu akan mengingatnya selama langgananmu masih berjalan.
      </p>
    </section>
  );
}
