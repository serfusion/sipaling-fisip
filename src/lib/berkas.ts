// PEMERIKSAAN BERKAS SEBELUM DIBACA
//
// Atribut accept pada kotak unggah hanyalah saran: pengguna tetap dapat
// memilih berkas jenis apa pun, dan pada ponsel pemilih berkas kerap
// mengabaikannya sama sekali. Ketika berkas .docx terpilih, isinya dibaca
// sebagai teks, menghasilkan ratusan ribu huruf sampah biner, lalu pengurai
// bab menyisirnya baris demi baris sampai peramban berhenti menanggapi.
//
// Karena itu berkas diperiksa lebih dulu: jenisnya, ukurannya, dan tanda
// pengenal di awal isinya. Yang tidak lolos ditolak dengan penjelasan yang
// memberi tahu apa yang harus dilakukan, bukan sekadar "gagal".

export const MAKS_UKURAN_MB = 3;
export const MAKS_HURUF = 400_000;

export type HasilBaca =
  | { ok: true; teks: string; dipangkas: boolean }
  | { ok: false; pesan: string };

/** Tanda pengenal di awal berkas, untuk mengenali jenis yang bukan teks. */
const TANDA: Array<{ awal: number[]; nama: string; saran: string }> = [
  {
    awal: [0x50, 0x4b, 0x03, 0x04],
    nama: "Word (.docx), Excel, atau berkas terkompresi",
    saran:
      "Buka naskahnya di Word, tekan Ctrl+A lalu Ctrl+C, dan tempel langsung ke kotak naskah di bawah. " +
      "Cara itu juga menjaga isi naskah tetap di perangkat Anda.",
  },
  {
    awal: [0xd0, 0xcf, 0x11, 0xe0],
    nama: "Word lama (.doc)",
    saran: "Simpan ulang sebagai .txt lewat menu Simpan Sebagai di Word, atau salin isinya lalu tempel di bawah.",
  },
  {
    awal: [0x25, 0x50, 0x44, 0x46],
    nama: "PDF",
    saran: "Buka PDF-nya, pilih seluruh teks, salin, lalu tempel ke kotak naskah di bawah.",
  },
  { awal: [0x89, 0x50, 0x4e, 0x47], nama: "gambar PNG", saran: "Yang dibutuhkan naskah berupa teks, bukan gambar." },
  { awal: [0xff, 0xd8, 0xff], nama: "gambar JPEG", saran: "Yang dibutuhkan naskah berupa teks, bukan gambar." },
];

function cocokTanda(byte: Uint8Array) {
  return TANDA.find((t) => t.awal.every((b, i) => byte[i] === b)) ?? null;
}

/**
 * Apakah teks ini tampak biner?
 *
 * Berkas biner yang dipaksa dibaca sebagai teks menghasilkan banyak aksara
 * kendali dan pengganti. Cukup periksa cuplikan awalnya; tidak perlu
 * menyisir seluruh isi.
 */
function tampakBiner(teks: string) {
  const cuplik = teks.slice(0, 4000);
  if (cuplik.length === 0) return false;
  let aneh = 0;
  for (const huruf of cuplik) {
    const kode = huruf.codePointAt(0) ?? 0;
    if (kode === 0 || kode === 0xfffd || (kode < 32 && kode !== 9 && kode !== 10 && kode !== 13)) aneh += 1;
  }
  return aneh / cuplik.length > 0.02;
}

/**
 * Baca berkas sebagai teks, atau tolak dengan alasan yang jelas.
 *
 * Urutannya sengaja: ukuran diperiksa sebelum apa pun dibaca, lalu tanda
 * pengenal dari delapan byte pertama saja, baru seluruh isinya dibaca.
 * Berkas .docx berukuran besar karena itu tidak pernah sampai dibaca utuh.
 */
export async function bacaTeks(berkas: File): Promise<HasilBaca> {
  const mb = berkas.size / (1024 * 1024);
  if (mb > MAKS_UKURAN_MB) {
    return {
      ok: false,
      pesan:
        `Berkas ini ${mb.toFixed(1)} MB, melebihi batas ${MAKS_UKURAN_MB} MB. Naskah skripsi berbentuk teks ` +
        "biasanya jauh di bawah 1 MB, jadi ukuran sebesar ini menandakan berkasnya bukan teks polos.",
    };
  }

  let awal: Uint8Array;
  try {
    awal = new Uint8Array(await berkas.slice(0, 8).arrayBuffer());
  } catch {
    return { ok: false, pesan: "Berkas tidak dapat dibuka. Coba pilih ulang." };
  }

  const tanda = cocokTanda(awal);
  if (tanda) {
    return { ok: false, pesan: `Ini berkas ${tanda.nama}, bukan teks polos. ${tanda.saran}` };
  }

  let isi: string;
  try {
    isi = await berkas.text();
  } catch {
    return { ok: false, pesan: "Berkas tidak dapat dibaca. Coba pilih ulang." };
  }

  if (tampakBiner(isi)) {
    return {
      ok: false,
      pesan:
        "Isi berkas ini bukan teks yang dapat dibaca. Buka naskahnya di aplikasi aslinya, salin teksnya, " +
        "lalu tempel ke kotak naskah di bawah.",
    };
  }

  if (isi.length > MAKS_HURUF) {
    return {
      ok: true,
      teks: isi.slice(0, MAKS_HURUF),
      dipangkas: true,
    };
  }

  return { ok: true, teks: isi, dipangkas: false };
}
