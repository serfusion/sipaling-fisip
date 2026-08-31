// PEKERJA LATAR CAKRAWALA
//
// Semua pekerjaan berat Cakrawala dikumpulkan di berkas ini, dan berkas ini
// dijalankan pada utas terpisah. Alasannya satu: peramban menggambar halaman
// dan menjalankan JavaScript pada utas yang sama. Selama satu perhitungan
// panjang berjalan di sana, tidak ada yang bergerak: gulir mati, tombol
// tidak menanggapi, dan sebagian ponsel memunculkan tawaran menutup halaman.
//
// Naskah skripsi utuh berukuran ratusan ribu huruf. Memeriksa ejaannya
// berarti menyisir seluruh naskah dua ratus kali, sekali untuk tiap pola;
// membuka PDF 250 halaman berarti menguraikan tiap halamannya. Di utas utama
// keduanya membekukan layar beberapa detik. Di sini keduanya tidak terasa.
//
// Naskah tetap tidak meninggalkan perangkat: pekerja latar berjalan di dalam
// peramban pengguna, bukan di server.

import { ekstrakNaskah, GalatBerkas } from "./ekstrak-naskah";
import { periksaBahasa } from "./bahasa-check";
import { periksaInggris } from "./manuscript";
import { cariFrasa } from "./frasa-akademik";
import { bandingkanSumber, periksaSitasi } from "./kemiripan";
import type { Balasan, Permintaan } from "./pekerja-pesan";

const konteks = globalThis as unknown as {
  postMessage(pesan: Balasan): void;
  addEventListener(jenis: "message", penangan: (peristiwa: MessageEvent<Permintaan>) => void): void;
};

function kirim(pesan: Balasan) {
  konteks.postMessage(pesan);
}

async function kerjakan(minta: Permintaan): Promise<unknown> {
  switch (minta.tugas) {
    case "berkas":
      return ekstrakNaskah(minta.jenis, minta.berkas, (nilai, pesan) =>
        kirim({ id: minta.id, jenis: "kemajuan", nilai, pesan }),
      );
    case "bahasa":
      return periksaBahasa(minta.teks);
    case "inggris":
      return periksaInggris(minta.teks);
    case "frasa":
      return cariFrasa(minta.teks);
    case "sitasi":
      return periksaSitasi(minta.naskah, minta.daftarPustaka);
    case "kemiripan":
      return bandingkanSumber(minta.naskah, minta.sumber);
  }
}

konteks.addEventListener("message", (peristiwa) => {
  const minta = peristiwa.data;
  void (async () => {
    try {
      const hasil = await kerjakan(minta);
      kirim({ id: minta.id, jenis: "selesai", hasil });
    } catch (alasan: unknown) {
      // Pesan GalatBerkas memang ditulis untuk dibaca pengguna. Kesalahan lain
      // tidak: isinya nama fungsi dan jejak tumpukan, yang hanya membuat
      // mahasiswa bingung tanpa memberi tahu apa yang harus dilakukan.
      const pesan =
        alasan instanceof GalatBerkas
          ? alasan.message
          : "Berkas ini tidak dapat diproses. Coba simpan ulang dari aplikasi aslinya, lalu unggah lagi.";
      kirim({ id: minta.id, jenis: "gagal", pesan });
    }
  })();
});
