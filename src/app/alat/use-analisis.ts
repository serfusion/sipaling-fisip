"use client";

import { useEffect, useState } from "react";
import { Dibatalkan, jalankanTugas } from "@/lib/pekerja-klien";
import type { NamaTugas, PetaTugas } from "@/lib/pekerja-pesan";

export type Keadaan<K extends NamaTugas> = {
  hasil: PetaTugas[K]["jawab"] | null;
  /** Perhitungan sedang berjalan di pekerja latar. */
  sibuk: boolean;
  galat: string;
};

type Simpanan<K extends NamaTugas> = {
  /** Muatan yang menghasilkan isi di bawah ini. Dipakai untuk memastikan
   *  hasil lama tidak ikut tampil setelah naskahnya berubah. */
  untuk: object | null;
  hasil: PetaTugas[K]["jawab"] | null;
  galat: string;
};

/**
 * Jalankan satu pemeriksaan naskah di pekerja latar, lalu kembalikan hasilnya.
 *
 * Sebelumnya pemeriksaan dijalankan langsung saat panel digambar. Pada naskah
 * satu bab itu tidak terasa; pada skripsi utuh, membuka alatnya membekukan
 * layar beberapa detik dan tidak ada satu pun tanda bahwa sesuatu sedang
 * dikerjakan. Sekarang panel muncul seketika, hasilnya menyusul, dan ada
 * keterangan "sedang memeriksa" selama itu.
 *
 * `muatan` harus stabil antar-render, jadi bungkus dengan useMemo di pemanggil:
 * perubahan rujukannya itulah yang memicu pemeriksaan ulang. Kirim null bila
 * memang belum ada yang perlu diperiksa.
 */
export function useAnalisis<K extends NamaTugas>(
  nama: K,
  muatan: PetaTugas[K]["minta"] | null,
): Keadaan<K> {
  const [simpanan, setSimpanan] = useState<Simpanan<K>>({ untuk: null, hasil: null, galat: "" });

  useEffect(() => {
    if (!muatan) return;

    const kendali = new AbortController();

    // Ditunda sejenak supaya mengetik di kotak naskah tidak mengirim satu
    // permintaan per huruf. Yang dipakai hanya permintaan terakhir.
    const jam = window.setTimeout(() => {
      jalankanTugas(nama, muatan, { sinyal: kendali.signal })
        .then((hasil) => {
          if (!kendali.signal.aborted) setSimpanan({ untuk: muatan, hasil, galat: "" });
        })
        .catch((alasan: unknown) => {
          if (kendali.signal.aborted || alasan instanceof Dibatalkan) return;
          setSimpanan({
            untuk: muatan,
            hasil: null,
            galat: alasan instanceof Error ? alasan.message : "Pemeriksaan tidak dapat diselesaikan.",
          });
        });
    }, 250);

    return () => {
      window.clearTimeout(jam);
      kendali.abort();
    };
  }, [nama, muatan]);

  // Yang tersimpan hanya sah untuk muatan yang menghasilkannya. Selama muatan
  // baru belum selesai diperiksa, alat menampilkan keadaan "sedang memeriksa",
  // bukan hasil naskah sebelumnya.
  const cocok = muatan !== null && simpanan.untuk === muatan;
  return {
    hasil: cocok ? simpanan.hasil : null,
    galat: cocok ? simpanan.galat : "",
    sibuk: muatan !== null && !cocok,
  };
}
