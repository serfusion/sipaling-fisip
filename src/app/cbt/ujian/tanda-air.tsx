"use client";

// ============================================================
// TANDA AIR FORENSIK
//
// Inilah bagian yang sebenarnya bekerja pada ujian sertifikasi, dan ia bekerja
// justru karena TIDAK mencoba melarang apa-apa.
//
// Tangkapan layar tetap dapat diambil — lewat Print Screen, alat potong, atau
// ponsel kedua yang diarahkan ke monitor. Yang berubah adalah apa yang
// tertangkap: nama, nomor peserta, kode ujian, dan jamnya, tercetak di seluruh
// permukaan, sehingga satu potongan kecil pun cukup untuk menunjuk orangnya.
//
// Pencegahan yang berhasil bukan yang menutup rapat, melainkan yang membuat
// perbuatannya tidak sepadan dengan risikonya. Peserta yang melihat namanya
// sendiri tercetak di atas soal tahu persis apa yang akan terjadi bila lembar
// itu beredar — dan itu menghentikan lebih banyak orang daripada larangan mana
// pun yang tidak dapat ditegakkan.
//
// Tiga hal yang menentukan bentuknya:
//
//   1. HARUS TERBACA DI TANGKAPAN LAYAR, tetapi TIDAK MENGGANGGU YANG MEMBACA
//      SOAL. Kekontrasannya dipilih di antara keduanya: cukup samar untuk
//      diabaikan mata yang sedang membaca, cukup tegas untuk tersalin utuh ke
//      dalam gambar.
//   2. TIDAK PERNAH MENGHALANGI KETUKAN. pointer-events: none, tanpa kecuali.
//      Tanda air yang menelan ketukan tombol jawaban akan merusak ujian yang
//      hendak dijaganya.
//   3. TIDAK DAPAT DIMATIKAN DARI LUAR TANPA JEJAK. Ia digambar ulang tiap
//      kali komponennya digambar; menghapusnya lewat alat pengembang menuntut
//      alat pengembang, dan itu sendiri sudah dicatat sebagai insiden.
// ============================================================

import { tandaAir, type Peserta } from "@/lib/pengawasan";

/**
 * Berapa banyak baris ditumpuk, dan berapa salinan per baris.
 *
 * Angkanya dihitung untuk BIDANG YANG DIPUTAR, bukan untuk layarnya. Bidang
 * itu dua kali lebih lebar dan dua kali lebih tinggi daripada layar (lihat
 * .uj-air-dalam di globals.css), jadi hanya sekitar seperempatnya yang
 * benar-benar terlihat — dan itu memang yang dibutuhkan supaya sudut layar
 * tidak ada yang kosong sesudah diputar.
 */
const BARIS = 22;
const PER_BARIS = 5;

export default function TandaAir({ peserta, saat }: { peserta: Peserta; saat?: Date }) {
  const teks = tandaAir(peserta, saat);
  if (!teks) return null;

  return (
    <div className="uj-air" aria-hidden="true">
      {/* Bidang di dalam sinilah yang diputar, bukan tiap barisnya sendiri.
          Memutar tiap baris membuat ujung-ujungnya berjalan keluar bingkai
          dengan jarak yang berbeda-beda, dan hasilnya tanda air yang menumpuk
          di satu sudut sementara sudut seberangnya bersih — persis sudut yang
          akan dipilih orang untuk memotong tangkapan layarnya. */}
      <div className="uj-air-dalam">
        {Array.from({ length: BARIS }, (_, i) => (
          <div key={i} className="uj-air-baris">
            {/* Diulang beberapa kali dalam satu baris supaya potongan selebar
                apa pun — termasuk potongan sempit yang sengaja dipilih untuk
                membuang tandanya — tetap memuat setidaknya satu salinan utuh. */}
            {Array.from({ length: PER_BARIS }, (_, k) => (
              <span key={k}>{teks}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
