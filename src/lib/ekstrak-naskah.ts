// PENGAMBILAN TEKS DARI WORD DAN PDF
//
// Berkas ini tidak dijalankan di utas utama selama peramban mendukung Web
// Worker: seluruh isinya pekerjaan berat yang, bila dikerjakan di tempat
// halaman digambar, membuat layar berhenti menanggapi selama beberapa detik.
// Membuka skripsi 250 halaman berarti membongkar zip, mengurai XML, atau
// menyusun ulang ratusan ribu potongan teks, semuanya sekaligus.
//
// Dua pustaka dipakai, keduanya dimuat hanya saat benar-benar dibutuhkan:
//
//   mammoth   membongkar .docx (yang sebenarnya zip berisi XML) dan
//             mengembalikan teksnya paragraf demi paragraf.
//   pdf.js    membaca lapisan teks PDF. Yang diambil hanya teksnya, bukan
//             gambarnya, sehingga tidak perlu kanvas maupun berkas fon.
//
// Naskah tidak pernah meninggalkan perangkat. Tidak ada satu pun permintaan
// jaringan di berkas ini.

import { MAKS_HURUF, type JenisBerkas } from "./berkas";

export type Kemajuan = (nilai: number, pesan: string) => void;

export type HasilEkstrak = {
  teks: string;
  /** Dipotong karena melewati MAKS_HURUF. */
  dipangkas: boolean;
  /** Keterangan tambahan yang perlu dibaca pengguna, bila ada. */
  catatan: string | null;
};

/** Kesalahan yang pesannya memang ditujukan kepada pengguna. */
export class GalatBerkas extends Error {}

// ---------------------------------------------------------------------------
// Teks polos
// ---------------------------------------------------------------------------

function bacaTeksPolos(data: ArrayBuffer): string {
  // fatal:false supaya berkas dengan pengodean tak lazim tetap terbaca
  // sebisanya, bukan gagal total. Bagian yang tidak dikenali menjadi aksara
  // pengganti, dan pemanggilnya yang memutuskan apakah hasilnya masuk akal.
  return new TextDecoder("utf-8", { fatal: false }).decode(data);
}

// ---------------------------------------------------------------------------
// Word (.docx)
// ---------------------------------------------------------------------------

async function bacaDocx(data: ArrayBuffer, lapor: Kemajuan): Promise<HasilEkstrak> {
  lapor(0.2, "Membuka dokumen Word…");
  const mammoth = await import("mammoth");

  lapor(0.35, "Mengambil teks paragraf demi paragraf…");
  let nilai: string;
  try {
    // extractRawText, bukan convertToHtml: yang dibutuhkan kotak naskah hanya
    // teksnya, dan tiap paragraf sudah jatuh pada barisnya sendiri, persis
    // seperti yang diperlukan pengurai bab untuk mengenali judul.
    const hasil = await mammoth.extractRawText({ arrayBuffer: data });
    nilai = hasil.value;
  } catch {
    throw new GalatBerkas(
      "Berkas Word ini tidak dapat dibuka. Bila terkunci kata sandi, buka kuncinya dulu lewat " +
        "Berkas → Info → Lindungi Dokumen. Bila aslinya .doc lama yang namanya diubah menjadi " +
        ".docx, simpan ulang lewat Berkas → Simpan Sebagai.",
    );
  }

  lapor(0.9, "Merapikan naskah…");
  const teks = rapikanUmum(nilai);
  if (!teks.trim()) {
    throw new GalatBerkas(
      "Dokumen Word ini tidak memuat teks yang dapat dibaca. Bila isinya gambar hasil pindaian, " +
        "teksnya perlu diketik ulang lebih dulu.",
    );
  }
  return potong(teks, null);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

async function bacaPdf(data: ArrayBuffer, lapor: Kemajuan): Promise<HasilEkstrak> {
  lapor(0.05, "Membuka PDF…");

  const [pdfjs, pekerjaPdf] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ]);

  // pdf.js biasanya menyalakan pekerjanya sendiri dari berkas terpisah yang
  // harus diunduh. Dengan penangan pesannya dipasang di sini, pdf.js memakai
  // jalur "pekerja semu": penguraian berjalan di utas tempat berkas ini
  // dijalankan, yaitu pekerja kita sendiri, bukan utas utama. Tidak ada
  // berkas tambahan yang diunduh, dan tidak ada aturan CSP yang dilanggar.
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = {
    WorkerMessageHandler: pekerjaPdf.WorkerMessageHandler,
  };

  // Yang diambil hanya teks, bukan gambar. Karena itu penggambaran fon,
  // fon bawaan sistem, dan pemecah gambar berbasis WebAssembly semuanya
  // dimatikan: ketiganya perlu mengunduh berkas tambahan yang di portal ini
  // ditutup Content-Security-Policy, dan tak satu pun memengaruhi teks.
  const tugas = pdfjs.getDocument({
    data: new Uint8Array(data),
    disableFontFace: true,
    useSystemFonts: false,
    useWasm: false,
    verbosity: 0,
  });

  let dokumen;
  try {
    dokumen = await tugas.promise;
  } catch (alasan: unknown) {
    void tugas.destroy();
    const nama = (alasan as { name?: string })?.name ?? "";
    if (nama === "PasswordException") {
      throw new GalatBerkas(
        "PDF ini terkunci kata sandi. Buka kuncinya dulu, simpan ulang tanpa sandi, lalu unggah kembali.",
      );
    }
    if (nama === "InvalidPDFException") {
      throw new GalatBerkas("Berkas PDF ini rusak atau tidak lengkap. Unduh atau ekspor ulang dari sumbernya.");
    }
    throw new GalatBerkas("PDF ini tidak dapat dibuka. Coba ekspor ulang dari Word, lalu unggah lagi.");
  }

  const jumlahHalaman = dokumen.numPages;
  const potongan: string[] = [];
  let panjang = 0;
  let halamanTerbaca = 0;

  try {
    for (let n = 1; n <= jumlahHalaman; n += 1) {
      const halaman = await dokumen.getPage(n);
      const isi = await halaman.getTextContent();

      let baris = "";
      for (const butir of isi.items) {
        if (!("str" in butir)) continue;
        baris += butir.str;
        if (butir.hasEOL) baris += "\n";
      }
      halaman.cleanup();

      potongan.push(baris);
      panjang += baris.length;
      halamanTerbaca = n;

      lapor(0.05 + 0.85 * (n / jumlahHalaman), `Membaca halaman ${n} dari ${jumlahHalaman}…`);

      // Berhenti begitu batas terlampaui: melanjutkan hanya menghabiskan waktu
      // dan memori untuk teks yang tetap akan dipotong.
      if (panjang > MAKS_HURUF) break;
    }
  } finally {
    await tugas.destroy();
  }

  lapor(0.95, "Merapikan naskah…");
  const teks = rapikanPdf(potongan.join("\n"));

  const hurufPerHalaman = halamanTerbaca > 0 ? teks.replace(/\s+/g, "").length / halamanTerbaca : 0;
  if (hurufPerHalaman < 40) {
    throw new GalatBerkas(
      `PDF ini tidak punya lapisan teks: ${jumlahHalaman} halamannya berupa gambar hasil pindaian atau foto, ` +
        "sehingga tidak ada huruf yang bisa diambil. Unggah berkas Word aslinya, atau PDF yang diekspor " +
        "langsung dari Word, bukan hasil pindai.",
    );
  }

  const catatan =
    halamanTerbaca < jumlahHalaman
      ? `Hanya ${halamanTerbaca} dari ${jumlahHalaman} halaman yang dimuat karena naskahnya melewati batas panjang.`
      : null;

  return potong(teks, catatan);
}

// ---------------------------------------------------------------------------
// Perapian
// ---------------------------------------------------------------------------

/** Aksara tak terlihat yang tidak berarti apa pun di kotak naskah, tetapi
 *  membuat pencocokan pola dan hitungan kata meleset: spasi tanpa pemutus,
 *  spasi selebar nol, penanda urutan byte, dan tanda hubung lunak. */
const AKSARA_SIASIA = /[\u200B-\u200D\uFEFF\u00AD]/g;

/** Rapikan hal yang sama pada semua sumber: akhir baris, spasi ganda, dan
 *  baris kosong yang bertumpuk. */
function rapikanUmum(teks: string) {
  return teks
    .replace(/\r\n?/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(AKSARA_SIASIA, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const HANYA_NOMOR = /^(?:[ivxlcdm]{1,7}|\d{1,4})$/i;

/**
 * Rapikan teks hasil PDF.
 *
 * PDF tidak menyimpan paragraf, hanya baris. Satu paragraf yang di layar
 * tampak utuh sebenarnya tersimpan sebagai belasan baris terpisah, dan nomor
 * halaman ikut terbawa sebagai barisnya sendiri. Dibiarkan apa adanya,
 * pengurai bab akan mengira hampir tiap baris adalah judul.
 */
function rapikanPdf(mentah: string) {
  const baris = rapikanUmum(mentah).split("\n");
  const hasil: string[] = [];

  for (const asal of baris) {
    const b = asal.trim();

    // Nomor halaman, termasuk angka Romawi pada halaman muka.
    if (HANYA_NOMOR.test(b)) continue;

    if (!b) {
      if (hasil.length > 0 && hasil[hasil.length - 1] !== "") hasil.push("");
      continue;
    }

    const sebelum = hasil.length > 0 ? hasil[hasil.length - 1] : "";
    const sambung =
      sebelum !== "" &&
      // Baris sebelumnya belum selesai sebagai kalimat…
      !/[.:;!?”"')\]]$/.test(sebelum) &&
      // …dan baris ini jelas lanjutannya, karena diawali huruf kecil.
      /^\p{Ll}/u.test(b);

    if (sambung) {
      // Tanda hubung di ujung baris dipertahankan: dalam bahasa Indonesia ia
      // jauh lebih sering menandai kata ulang ("kata-" + "kata") daripada
      // pemenggalan suku kata.
      hasil[hasil.length - 1] = sebelum.endsWith("-") ? sebelum + b : `${sebelum} ${b}`;
    } else {
      hasil.push(b);
    }
  }

  return hasil.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function potong(teks: string, catatan: string | null): HasilEkstrak {
  if (teks.length <= MAKS_HURUF) return { teks, dipangkas: false, catatan };
  return { teks: teks.slice(0, MAKS_HURUF), dipangkas: true, catatan };
}

// ---------------------------------------------------------------------------
// Pintu masuk
// ---------------------------------------------------------------------------

export async function ekstrakNaskah(
  jenis: JenisBerkas,
  berkas: Blob,
  lapor: Kemajuan,
): Promise<HasilEkstrak> {
  // Berkasnya baru dibaca ke memori di sini, bukan di utas utama: satu PDF 40
  // MB berarti 40 MB yang tidak perlu disalin bolak-balik antar-utas, dan
  // pembacaannya pun tidak mengganggu halaman.
  lapor(0.05, "Membuka berkas…");
  let data: ArrayBuffer;
  try {
    data = await berkas.arrayBuffer();
  } catch {
    throw new GalatBerkas("Berkas tidak dapat dibaca sampai selesai. Coba pilih ulang.");
  }

  if (jenis === "docx") return bacaDocx(data, lapor);
  if (jenis === "pdf") return bacaPdf(data, lapor);

  lapor(0.5, "Membaca berkas…");
  const isi = rapikanUmum(bacaTeksPolos(data));
  if (!isi.trim()) throw new GalatBerkas("Berkas ini kosong.");
  return potong(isi, null);
}
