"use client";

// SISI UTAS UTAMA DARI PEKERJA LATAR
//
// Satu pekerja dipakai bersama seluruh alat Cakrawala dan baru dinyalakan
// saat pertama kali dibutuhkan, sehingga membuka halaman tidak jadi lebih
// lambat karenanya.
//
// Ada jalur cadangan yang sengaja dipertahankan: bila peramban tidak
// mengenal Web Worker, atau berkas pekerjanya gagal dimuat, perhitungan
// dikerjakan di utas utama. Layar akan tersendat sebentar, tetapi tersendat
// sebentar jauh lebih baik daripada alatnya tidak jalan sama sekali di
// perangkat itu.

import {
  MAKS_MB,
  alasanTolak,
  ejaUkuran,
  kenaliJenis,
  type HasilBaca,
  type JenisBerkas,
} from "./berkas";
import type { NamaTugas, PetaTugas, Balasan, Permintaan } from "./pekerja-pesan";

/** Pekerjanya sendiri yang bermasalah, bukan tugasnya. Hanya dipakai di dalam
 *  berkas ini, sebagai tanda supaya tugasnya diulang di utas utama. */
class GalatPekerja extends Error {}

/** Pengguna menekan Batalkan. Bukan kegagalan, jadi tidak perlu dilaporkan
 *  sebagai kesalahan di layar. */
export class Dibatalkan extends Error {}

type Tertunda = {
  selesai: (nilai: unknown) => void;
  gagal: (alasan: Error) => void;
  lapor?: (nilai: number, pesan: string) => void;
};

const tertunda = new Map<number, Tertunda>();
let pekerja: Worker | null = null;
let pekerjaTakDapatDipakai = false;
let nomor = 0;

function terimaBalasan(pesan: Balasan) {
  const menunggu = tertunda.get(pesan.id);
  if (!menunggu) return; // Tugas yang sudah ditinggalkan; hasilnya diabaikan.
  if (pesan.jenis === "kemajuan") {
    menunggu.lapor?.(pesan.nilai, pesan.pesan);
    return;
  }
  tertunda.delete(pesan.id);
  if (pesan.jenis === "selesai") menunggu.selesai(pesan.hasil);
  else menunggu.gagal(new Error(pesan.pesan));
}

/** Buang pekerja yang sedang berjalan, lalu beri tahu semua yang menunggu. */
function bubarkan(alasan: Error) {
  const sedang = [...tertunda.values()];
  tertunda.clear();
  pekerja?.terminate();
  pekerja = null;
  for (const t of sedang) t.gagal(alasan);
}

function ambilPekerja(): Worker | null {
  if (pekerjaTakDapatDipakai) return null;
  if (pekerja) return pekerja;
  if (typeof Worker === "undefined") {
    pekerjaTakDapatDipakai = true;
    return null;
  }
  try {
    const baru = new Worker(new URL("./pekerja-naskah.ts", import.meta.url));
    baru.onmessage = (peristiwa: MessageEvent<Balasan>) => terimaBalasan(peristiwa.data);
    baru.onerror = () => {
      // Berkas pekerjanya sendiri gagal dimuat atau dijalankan. Sekali ini
      // terjadi, mencoba lagi tidak ada gunanya: seluruh sisa sesi memakai
      // utas utama.
      pekerjaTakDapatDipakai = true;
      bubarkan(new GalatPekerja("Pekerja latar tidak dapat dijalankan."));
    };
    pekerja = baru;
    return baru;
  } catch {
    pekerjaTakDapatDipakai = true;
    return null;
  }
}

export type OpsiTugas = {
  lapor?: (nilai: number, pesan: string) => void;
  sinyal?: AbortSignal;
};

function lewatPekerja<K extends NamaTugas>(
  wadah: Worker,
  nama: K,
  muatan: PetaTugas[K]["minta"],
  opsi: OpsiTugas,
): Promise<PetaTugas[K]["jawab"]> {
  return new Promise((selesai, gagal) => {
    nomor += 1;
    const id = nomor;
    tertunda.set(id, {
      selesai: (nilai) => selesai(nilai as PetaTugas[K]["jawab"]),
      gagal,
      lapor: opsi.lapor,
    });

    opsi.sinyal?.addEventListener(
      "abort",
      () => {
        if (!tertunda.delete(id)) return;
        // Menghentikan mammoth atau pdf.js di tengah jalan hanya mungkin
        // dengan mematikan pekerjanya. Untuk pemeriksaan naskah yang cepat
        // itu berlebihan: hasilnya cukup diabaikan, dan pekerjanya tetap
        // hangat untuk permintaan berikutnya.
        //
        // Tugas lain yang kebetulan sedang menumpang pekerja yang sama ikut
        // terhenti, jadi mereka diberi tahu apa adanya, bukan sebagai
        // "dibatalkan", karena bukan mereka yang dibatalkan pengguna.
        if (nama === "berkas") {
          bubarkan(new Error("Pemeriksaan terhenti karena pembacaan berkas dibatalkan. Coba jalankan lagi."));
        }
        gagal(new Dibatalkan("Dibatalkan."));
      },
      { once: true },
    );

    const permintaan = { id, tugas: nama, ...muatan } as Permintaan;
    try {
      wadah.postMessage(permintaan);
    } catch {
      tertunda.delete(id);
      gagal(new GalatPekerja("Permintaan tidak dapat dikirim ke pekerja latar."));
    }
  });
}

/** Jalur cadangan: kerjakan di utas utama. Hanya dipakai bila pekerja latar
 *  memang tidak tersedia di peramban itu. */
async function lewatUtasUtama<K extends NamaTugas>(
  nama: K,
  muatan: PetaTugas[K]["minta"],
  opsi: OpsiTugas,
): Promise<PetaTugas[K]["jawab"]> {
  type Jawab = PetaTugas[K]["jawab"];

  if (nama === "berkas") {
    const { jenis, berkas } = muatan as PetaTugas["berkas"]["minta"];
    const { ekstrakNaskah, GalatBerkas } = await import("./ekstrak-naskah");
    try {
      return (await ekstrakNaskah(jenis, berkas, (nilai, pesan) => opsi.lapor?.(nilai, pesan))) as Jawab;
    } catch (alasan: unknown) {
      throw alasan instanceof GalatBerkas
        ? new Error(alasan.message)
        : new Error("Berkas ini tidak dapat diproses. Coba simpan ulang dari aplikasi aslinya, lalu unggah lagi.");
    }
  }

  if (nama === "bahasa") {
    const { periksaBahasa } = await import("./bahasa-check");
    return periksaBahasa((muatan as PetaTugas["bahasa"]["minta"]).teks) as Jawab;
  }
  if (nama === "inggris") {
    const { periksaInggris } = await import("./manuscript");
    return periksaInggris((muatan as PetaTugas["inggris"]["minta"]).teks) as Jawab;
  }
  if (nama === "frasa") {
    const { cariFrasa } = await import("./frasa-akademik");
    return cariFrasa((muatan as PetaTugas["frasa"]["minta"]).teks) as Jawab;
  }
  if (nama === "sitasi") {
    const { periksaSitasi } = await import("./kemiripan");
    const m = muatan as PetaTugas["sitasi"]["minta"];
    return periksaSitasi(m.naskah, m.daftarPustaka) as Jawab;
  }

  const { bandingkanSumber } = await import("./kemiripan");
  const m = muatan as PetaTugas["kemiripan"]["minta"];
  return bandingkanSumber(m.naskah, m.sumber) as Jawab;
}

/** Kerjakan satu tugas berat, di pekerja latar bila peramban mendukungnya. */
export async function jalankanTugas<K extends NamaTugas>(
  nama: K,
  muatan: PetaTugas[K]["minta"],
  opsi: OpsiTugas = {},
): Promise<PetaTugas[K]["jawab"]> {
  if (opsi.sinyal?.aborted) throw new Dibatalkan("Dibatalkan.");

  const wadah = ambilPekerja();
  if (wadah) {
    try {
      return await lewatPekerja(wadah, nama, muatan, opsi);
    } catch (alasan: unknown) {
      if (!(alasan instanceof GalatPekerja)) throw alasan;
      // Pekerjanya yang gagal, bukan tugasnya. Diulang di utas utama.
    }
  }
  return lewatUtasUtama(nama, muatan, opsi);
}

// ---------------------------------------------------------------------------
// Membaca berkas naskah
// ---------------------------------------------------------------------------

/**
 * Baca naskah dari berkas Word, PDF, atau teks polos.
 *
 * Urutannya sengaja: jenis dan ukuran diperiksa dari delapan byte pertama,
 * sebelum apa pun dimuat ke memori. Berkas 40 MB yang salah pilih karena itu
 * tidak pernah sempat dibaca, apalagi diurai. Berkas yang lolos diserahkan ke
 * pekerja latar apa adanya: yang berpindah antar-utas hanya rujukannya,
 * bukan salinan isinya.
 */
export async function bacaNaskah(
  berkas: File,
  opsi: OpsiTugas = {},
): Promise<HasilBaca> {
  let awal: Uint8Array;
  try {
    awal = new Uint8Array(await berkas.slice(0, 8).arrayBuffer());
  } catch {
    return { ok: false, pesan: "Berkas tidak dapat dibuka. Coba pilih ulang." };
  }

  const jenis: JenisBerkas = kenaliJenis(awal, berkas.name);
  const tolak = alasanTolak(jenis);
  if (tolak) return { ok: false, pesan: tolak };

  const mb = berkas.size / (1024 * 1024);
  if (mb > MAKS_MB[jenis]) {
    const saran =
      jenis === "pdf"
        ? "PDF sebesar ini hampir selalu hasil pindaian, yang memang tidak punya lapisan teks. Unggah berkas Word aslinya, atau PDF yang diekspor langsung dari Word."
        : jenis === "docx"
          ? "Kecilkan dulu berkasnya lewat Word: pilih sebuah gambar, buka tab Format Gambar, lalu Kompres Gambar."
          : "Naskah berbentuk teks polos hampir tidak pernah sebesar ini. Periksa lagi berkas yang Anda pilih.";
    return {
      ok: false,
      pesan: `Berkas ini ${ejaUkuran(berkas.size)}, melebihi batas ${MAKS_MB[jenis]} MB. ${saran}`,
    };
  }

  if (berkas.size === 0) return { ok: false, pesan: "Berkas ini kosong." };

  try {
    const hasil = await jalankanTugas("berkas", { jenis, berkas }, opsi);
    return { ok: true, teks: hasil.teks, dipangkas: hasil.dipangkas, jenis, catatan: hasil.catatan };
  } catch (alasan: unknown) {
    if (alasan instanceof Dibatalkan) throw alasan;
    return {
      ok: false,
      pesan: alasan instanceof Error ? alasan.message : "Berkas ini tidak dapat dibaca.",
    };
  }
}
