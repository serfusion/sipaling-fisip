// PENGENAL BERKAS NASKAH
//
// Atribut accept pada kotak unggah hanyalah saran: pengguna tetap dapat
// memilih berkas jenis apa pun, dan pada ponsel pemilih berkas kerap
// mengabaikannya sama sekali. Karena itu jenis berkas ditentukan di sini,
// dari tanda pengenal pada byte pertamanya — bukan dari namanya.
//
// Yang dapat dibaca: Word (.docx), PDF, dan teks polos. Ketiganya diurai di
// perangkat pengguna, di dalam pekerja latar, sehingga halaman tidak pernah
// berhenti menanggapi walau naskahnya ratusan halaman. Yang tidak dapat
// dibaca ditolak dengan penjelasan yang memberi tahu apa yang harus
// dilakukan, bukan sekadar "gagal".

export type JenisBerkas =
  | "teks"
  | "docx"
  | "pdf"
  | "doc"
  | "rtf"
  | "odt"
  | "kantor-lain"
  | "gambar"
  | "arsip";

/** Batas ukuran per jenis, dalam MB.
 *
 *  Angkanya berbeda-beda karena isinya berbeda: satu halaman teks polos
 *  sekitar dua kilobita, sedangkan satu halaman PDF hasil ekspor Word dengan
 *  gambar dan lampiran dapat mencapai ratusan kilobita. Batas yang sama untuk
 *  keduanya akan menolak skripsi yang sepenuhnya wajar. */
export const MAKS_MB: Record<JenisBerkas, number> = {
  teks: 5,
  docx: 25,
  pdf: 40,
  doc: 25,
  rtf: 25,
  odt: 25,
  "kantor-lain": 25,
  gambar: 25,
  arsip: 25,
};

/** Batas jumlah huruf yang dimuat ke kotak naskah.
 *
 *  Sejuta huruf kira-kira 150 ribu kata — jauh di atas skripsi mana pun,
 *  termasuk lampirannya. Batas ini bukan soal kemampuan mengurai, melainkan
 *  soal kotak teks di peramban: di atas angka ini mengetik di dalamnya mulai
 *  terasa berat pada ponsel kelas menengah. */
export const MAKS_HURUF = 1_000_000;

/** Daftar untuk atribut accept. Tipe MIME disertakan karena sebagian pemilih
 *  berkas di Android hanya mengenali MIME, bukan akhiran nama. */
export const ACCEPT_NASKAH = [
  ".docx",
  ".pdf",
  ".txt",
  ".md",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
].join(",");

type Tanda = { awal: number[]; jenis: JenisBerkas };

/** Tanda pengenal pada awal berkas. Diperiksa berurutan; yang lebih khusus
 *  didahulukan. */
const TANDA: Tanda[] = [
  { awal: [0x25, 0x50, 0x44, 0x46], jenis: "pdf" }, // %PDF
  { awal: [0xd0, 0xcf, 0x11, 0xe0], jenis: "doc" }, // OLE: .doc, .xls, .ppt lama
  { awal: [0x7b, 0x5c, 0x72, 0x74], jenis: "rtf" }, // {\rt
  { awal: [0x89, 0x50, 0x4e, 0x47], jenis: "gambar" },
  { awal: [0xff, 0xd8, 0xff], jenis: "gambar" },
  { awal: [0x47, 0x49, 0x46, 0x38], jenis: "gambar" },
];

const AKHIRAN_ZIP: Array<[RegExp, JenisBerkas]> = [
  [/\.docx$/i, "docx"],
  [/\.odt$/i, "odt"],
  [/\.(?:xlsx|xlsm|pptx|ods|odp)$/i, "kantor-lain"],
];

/**
 * Kenali jenis berkas dari byte pertamanya, dibantu akhiran namanya.
 *
 * Nama berkas hanya dipakai untuk memilah sesama arsip zip: .docx, .odt, dan
 * .xlsx punya tanda pengenal yang sama persis, sehingga byte saja tidak cukup
 * untuk membedakannya.
 */
export function kenaliJenis(awal: Uint8Array, nama: string): JenisBerkas {
  for (const t of TANDA) {
    if (t.awal.every((b, i) => awal[i] === b)) return t.jenis;
  }

  // PK\x03\x04 — seluruh berkas Office modern dan OpenDocument adalah zip.
  if (awal[0] === 0x50 && awal[1] === 0x4b && awal[2] === 0x03 && awal[3] === 0x04) {
    for (const [pola, jenis] of AKHIRAN_ZIP) if (pola.test(nama)) return jenis;
    // Tanpa akhiran yang dikenali, dicoba sebagai .docx. Bila ternyata bukan,
    // pengurainya akan berkata begitu dengan jelas.
    return /\.zip$/i.test(nama) ? "arsip" : "docx";
  }

  return "teks";
}

/** Alasan penolakan untuk jenis yang tidak dapat dibaca, atau null bila dapat. */
export function alasanTolak(jenis: JenisBerkas): string | null {
  switch (jenis) {
    case "teks":
    case "docx":
    case "pdf":
      return null;
    case "doc":
      return (
        "Ini berkas Word versi lama (.doc). Buka di Word lalu simpan ulang lewat " +
        "Berkas → Simpan Sebagai → Word Document (.docx), dan unggah berkas .docx itu."
      );
    case "rtf":
      return (
        "Ini berkas Rich Text (.rtf). Buka di Word lalu simpan ulang sebagai " +
        "Word Document (.docx) atau PDF, dan unggah berkas itu."
      );
    case "odt":
      return (
        "Ini berkas OpenDocument (.odt) dari LibreOffice atau OpenOffice. Simpan ulang " +
        "lewat Berkas → Simpan Sebagai dengan jenis Word (.docx) atau ekspor ke PDF."
      );
    case "kantor-lain":
      return (
        "Ini berkas lembar sebar atau presentasi, bukan naskah. Yang dibutuhkan di sini " +
        "naskah skripsi dalam bentuk Word (.docx), PDF, atau teks."
      );
    case "gambar":
      return (
        "Ini berkas gambar. Foto halaman skripsi tidak dapat dibaca sebagai teks. " +
        "Unggah berkas Word atau PDF aslinya."
      );
    case "arsip":
      return (
        "Ini berkas terkompresi (.zip). Keluarkan dulu isinya, lalu unggah berkas " +
        "Word atau PDF yang ada di dalamnya."
      );
  }
}

export const JENIS_LABEL_BERKAS: Record<JenisBerkas, string> = {
  teks: "teks polos",
  docx: "Word (.docx)",
  pdf: "PDF",
  doc: "Word lama (.doc)",
  rtf: "Rich Text (.rtf)",
  odt: "OpenDocument (.odt)",
  "kantor-lain": "lembar sebar atau presentasi",
  gambar: "gambar",
  arsip: "arsip terkompresi",
};

/** Ukuran berkas dalam kata-kata manusia. */
export function ejaUkuran(byte: number) {
  if (byte < 1024 * 1024) return `${Math.max(1, Math.round(byte / 1024))} KB`;
  return `${(byte / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export type HasilBaca =
  | { ok: true; teks: string; dipangkas: boolean; jenis: JenisBerkas; catatan: string | null }
  | { ok: false; pesan: string };

/**
 * Apakah teks ini tampak biner?
 *
 * Berkas biner yang dipaksa dibaca sebagai teks menghasilkan banyak aksara
 * kendali dan pengganti. Cukup periksa cuplikan awalnya; tidak perlu
 * menyisir seluruh isi.
 */
export function tampakBiner(teks: string) {
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
 * Baca berkas teks polos, atau tolak dengan alasan yang jelas.
 *
 * Dipakai untuk berkas cadangan .json, yang selalu kecil dan selalu teks.
 * Naskah skripsi lewat jalur lain: lihat `bacaNaskah` di pekerja-klien.ts.
 */
export async function bacaTeks(berkas: File): Promise<HasilBaca> {
  const mb = berkas.size / (1024 * 1024);
  if (mb > MAKS_MB.teks) {
    return {
      ok: false,
      pesan:
        `Berkas ini ${mb.toFixed(1)} MB, melebihi batas ${MAKS_MB.teks} MB untuk berkas teks. ` +
        "Ukuran sebesar ini menandakan berkasnya bukan teks polos.",
    };
  }

  let awal: Uint8Array;
  try {
    awal = new Uint8Array(await berkas.slice(0, 8).arrayBuffer());
  } catch {
    return { ok: false, pesan: "Berkas tidak dapat dibuka. Coba pilih ulang." };
  }

  const jenis = kenaliJenis(awal, berkas.name);
  if (jenis !== "teks") {
    return {
      ok: false,
      pesan: `Ini berkas ${JENIS_LABEL_BERKAS[jenis]}, bukan teks polos. Pilih berkas yang benar.`,
    };
  }

  let isi: string;
  try {
    isi = await berkas.text();
  } catch {
    return { ok: false, pesan: "Berkas tidak dapat dibaca. Coba pilih ulang." };
  }

  if (tampakBiner(isi)) {
    return { ok: false, pesan: "Isi berkas ini bukan teks yang dapat dibaca." };
  }

  if (isi.length > MAKS_HURUF) {
    return { ok: true, teks: isi.slice(0, MAKS_HURUF), dipangkas: true, jenis, catatan: null };
  }
  return { ok: true, teks: isi, dipangkas: false, jenis, catatan: null };
}
