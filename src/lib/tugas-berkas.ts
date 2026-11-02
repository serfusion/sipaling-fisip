// ============================================================
// BERKAS TUGAS MAHASISWA — dibongkar, dikelompokkan, dan disarikan
// di PERAMBAN dosen
//
// Tugas yang sudah terkumpul di Google Drive turun sebagai satu .zip (unduhan
// folder Drive), kadang berisi .rar milik mahasiswa yang mengumpulkan lebih
// dari satu berkas. Isinya campur: PDF, Word (.docx dan .doc lama), Excel
// (.xlsx dan .xls lama), PowerPoint, gambar. Seluruhnya dibongkar DI SINI,
// di komputer dosen:
//
//   1. bongkar   arsip zip dan rar dibuka, bertingkat (zip di dalam zip,
//                rar di dalam zip), sampai tiga lapis;
//   2. kelompok  berkas dikelompokkan per mahasiswa: satu map atau satu
//                arsip = satu mahasiswa, selebihnya satu berkas = satu
//                mahasiswa. Nama dan NIM ditebak dari nama berkasnya
//                ("Proposal_Afifah Meilina_23702010192.pdf") dan dapat
//                dibetulkan dosen sebelum dinilai;
//   3. sarikan   teks tiap berkas diambil, ditambah lampiran visual yang
//                muat: PDF aslinya bila cukup kecil, atau gambar halaman
//                yang memuat gambar, dan gambar di dalam Word/PowerPoint.
//
// Yang dikirim ke server hanya hasil langkah 3 untuk SATU mahasiswa per
// permintaan. Arsip ratusan MB tidak pernah melewati batas unggah fungsi
// serverless (4,5 MB), dan berkas mahasiswa tidak disimpan di mana pun.
//
// Fungsi yang membutuhkan kanvas (menggambar halaman PDF, mengecilkan gambar)
// hanya berjalan di peramban; selebihnya murni dan diuji di Node oleh
// uji-penilaian-tugas.ts.
// ============================================================
import { bacaZip } from "@/lib/baca-zip";

export type BerkasTugas = {
  /** Jalur lengkap untuk ditampilkan, mis. "Tugas2.zip › Afifah/proposal.pdf". */
  jalur: string;
  /** Segmen jalur relatif terhadap wadah teratasnya; arsip bertingkat ikut menjadi segmen. */
  segmen: string[];
  /** Nomor wadah teratas (berkas atau arsip yang dipilih dosen). */
  wadah: number;
  nama: string;
  data: Uint8Array;
};

export type Kiriman = {
  id: string;
  /** Nama map/arsip/berkas yang menjadi dasar kelompok. */
  sumber: string;
  nama: string;
  nim: string;
  berkas: BerkasTugas[];
};

/** Bentuk berkas yang dikenali, menurut akhiran namanya. */
export type JenisBerkas =
  | "pdf" | "docx" | "doc" | "xlsx" | "xls" | "csv" | "pptx" | "odt" | "odp" | "rtf" | "teks" | "html"
  | "gambar" | "zip" | "rar" | "7z" | "lain";

export function jenisBerkas(nama: string): JenisBerkas {
  const a = (nama.toLowerCase().match(/\.([a-z0-9]+)$/) ?? [])[1] ?? "";
  if (a === "pdf") return "pdf";
  if (["docx", "docm", "dotx"].includes(a)) return "docx";
  if (["doc", "dot"].includes(a)) return "doc";
  if (["xlsx", "xlsm", "xlsb", "ods"].includes(a)) return "xlsx";
  if (a === "xls") return "xls";
  if (["csv", "tsv"].includes(a)) return "csv";
  if (["pptx", "ppsx", "pptm"].includes(a)) return "pptx";
  if (a === "odt") return "odt";
  if (a === "odp") return "odp";
  if (a === "rtf") return "rtf";
  if (["txt", "md", "markdown", "json"].includes(a)) return "teks";
  if (["html", "htm"].includes(a)) return "html";
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(a)) return "gambar";
  if (a === "zip") return "zip";
  if (a === "rar") return "rar";
  if (a === "7z") return "7z";
  return "lain";
}

/** Berkas sampah sistem yang ikut terbawa arsip dan tidak pernah tugas. */
export function berkasSampah(jalur: string): boolean {
  const bagian = jalur.split("/");
  const nama = bagian[bagian.length - 1] ?? "";
  return bagian.some((b) => b === "__MACOSX" || b === ".git") ||
    /^(\.DS_Store|Thumbs\.db|desktop\.ini|\.gitkeep)$/i.test(nama) ||
    nama.startsWith("~$") || nama.startsWith("._") || nama === "";
}

// ------------------------------------------------------------
// 1. BONGKAR ARSIP
// ------------------------------------------------------------

/** Berkas WebAssembly pembaca RAR, disalin dari node-unrar-js ke public/ (npm run pekerja-rar). */
export const ALAMAT_WASM_RAR = "/vendor/unrar.wasm";
/** Pekerja pembaca RAR, dibangun dari vendor-src/unrar-pekerja.mjs. */
export const ALAMAT_PEKERJA_RAR = "/vendor/unrar-pekerja.js";

type IsiArsipRar = Array<{ nama: string; data: Uint8Array }>;

let pekerjaRar: Worker | null = null;
let nomorRar = 0;
const tungguRar = new Map<number, { selesai: (isi: IsiArsipRar) => void; gagal: (e: Error) => void }>();

/**
 * Bongkar RAR di Web Worker.
 *
 * Pustaka unrar (Emscripten) membangun fungsi dengan `new Function`, yang
 * ditolak CSP halaman portal. Pekerja punya CSP sendiri yang mengizinkannya,
 * terpisah dari halaman (lihat next.config.ts).
 */
function rarLewatPekerja(data: Uint8Array): Promise<IsiArsipRar> {
  if (!pekerjaRar) {
    pekerjaRar = new Worker(ALAMAT_PEKERJA_RAR);
    pekerjaRar.onmessage = (e: MessageEvent<{ id: number; ok: boolean; isi?: IsiArsipRar; pesan?: string }>) => {
      const t = tungguRar.get(e.data.id);
      if (!t) return;
      tungguRar.delete(e.data.id);
      if (e.data.ok) t.selesai(e.data.isi ?? []);
      else t.gagal(new Error(e.data.pesan || "gagal"));
    };
    pekerjaRar.onerror = (e) => {
      const pesan = e.message || "Pembaca RAR tidak dapat dijalankan di peramban ini.";
      for (const t of tungguRar.values()) t.gagal(new Error(pesan));
      tungguRar.clear();
      pekerjaRar?.terminate();
      pekerjaRar = null;
    };
  }
  const id = (nomorRar += 1);
  const salin = new Uint8Array(data.byteLength);
  salin.set(data);
  return new Promise((selesai, gagal) => {
    tungguRar.set(id, { selesai, gagal });
    pekerjaRar!.postMessage({ id, data: salin.buffer }, [salin.buffer]);
  });
}

/** Bongkar RAR: lewat pekerja di peramban, langsung di Node (uji) bila wasm diberikan. */
async function bacaRar(data: Uint8Array, wasm?: ArrayBuffer): Promise<IsiArsipRar> {
  let isi: IsiArsipRar;
  try {
    if (wasm) {
      const { createExtractorFromData } = await import("node-unrar-js");
      const salin = new Uint8Array(data.byteLength);
      salin.set(data);
      const ekstraktor = await createExtractorFromData({ wasmBinary: wasm, data: salin.buffer });
      isi = [];
      for (const f of ekstraktor.extract().files) {
        if (f.fileHeader.flags.directory || !f.extraction || f.fileHeader.flags.encrypted) continue;
        isi.push({ nama: f.fileHeader.name.replace(/\\/g, "/"), data: f.extraction });
      }
    } else {
      isi = await rarLewatPekerja(data);
    }
  } catch (galat) {
    const pesan = String((galat as Error)?.message ?? galat ?? "");
    if (/password/i.test(pesan)) throw new Error("Arsip RAR ini dikunci kata sandi.");
    throw new Error(`Arsip RAR ini rusak atau bukan RAR yang sah${pesan ? ` (${pesan.slice(0, 120)})` : ""}.`);
  }
  return isi;
}

export type Masukan = { nama: string; data: Uint8Array; /** webkitRelativePath bila dari pilihan map. */ jalur?: string };

export type HasilBongkar = { berkas: BerkasTugas[]; peringatan: string[] };

const KEDALAMAN_MAKS = 3;

/**
 * Bongkar seluruh masukan menjadi daftar berkas datar.
 *
 * Arsip di dalam arsip ikut dibongkar sampai tiga lapis; nama arsipnya
 * menjadi satu segmen jalur, sehingga "Afifah_237.rar" di dalam unduhan
 * Drive tetap dikenali sebagai kiriman satu mahasiswa.
 */
export async function bongkar(
  masukan: Masukan[],
  opsi: { wasmRar?: ArrayBuffer; lapor?: (pesan: string) => void } = {},
): Promise<HasilBongkar> {
  const berkas: BerkasTugas[] = [];
  const peringatan: string[] = [];

  async function masuk(segmen: string[], data: Uint8Array, wadah: number, tampil: string, lapis: number) {
    const nama = segmen[segmen.length - 1] ?? "";
    if (berkasSampah(segmen.join("/"))) return;
    const jenis = jenisBerkas(nama);
    if ((jenis === "zip" || jenis === "rar") && lapis < KEDALAMAN_MAKS) {
      opsi.lapor?.(`Membuka ${nama}…`);
      try {
        let isi: Array<{ nama: string; data: Uint8Array }>;
        if (jenis === "zip") {
          const salin = new Uint8Array(data.byteLength);
          salin.set(data);
          isi = await bacaZip(salin.buffer, (n) => !n.endsWith("/") && !berkasSampah(n));
        } else {
          isi = await bacaRar(data, opsi.wasmRar);
        }
        if (isi.length === 0) peringatan.push(`${tampil}: arsipnya kosong atau seluruh isinya terkunci sandi.`);
        for (const x of isi) {
          const dalam = x.nama.split("/").filter(Boolean);
          await masuk([...segmen, ...dalam], x.data, wadah, `${tampil} › ${x.nama}`, lapis + 1);
        }
      } catch (galat) {
        peringatan.push(`${tampil}: ${(galat as Error)?.message || "arsip tidak dapat dibuka."}`);
      }
      return;
    }
    if (jenis === "7z") {
      peringatan.push(`${tampil}: arsip .7z belum dapat dibuka. Simpan ulang sebagai .zip atau .rar.`);
      return;
    }
    berkas.push({ jalur: tampil, segmen, wadah, nama, data });
  }

  for (const [i, m] of masukan.entries()) {
    const segmen = (m.jalur || m.nama).split("/").filter(Boolean);
    await masuk(segmen, m.data, i, m.jalur || m.nama, 0);
  }
  return { berkas, peringatan };
}

// ------------------------------------------------------------
// 2. KELOMPOKKAN PER MAHASISWA
// ------------------------------------------------------------

const KATA_BUANG = new Set([
  "tugas", "tgs", "task", "uts", "uas", "quiz", "kuis", "proposal", "laporan", "makalah", "paper", "final",
  "revisi", "rev", "copy", "of", "salinan", "file", "responses", "response", "jawaban", "pdf", "docx", "doc",
  "xlsx", "xls", "pptx", "rar", "zip", "nim", "nama", "kelas", "kelompok", "fix", "new", "baru", "draft",
  "submission", "assignment", "ke", "dan", "the", "untitled", "document", "dokumen", "lampiran",
]);

/**
 * Tebak nama dan NIM dari nama berkas atau map.
 *
 *   "Proposal_Afifah Meilina_23702010192.pdf"     → Afifah Meilina, 23702010192
 *   "23702010192 - AFIFAH MEILINA.docx"           → Afifah Meilina, 23702010192
 *   "Tugas 2 PR - Afifah Meilina.pdf"             → Afifah Meilina (pola Google Form)
 *
 * `buang` berisi kata dari nama tugas dan mata kuliah, supaya "Proposal
 * Program PR" tidak ikut menjadi nama orang.
 */
export function tebakIdentitas(teks: string, buang: string[] = []): { nama: string; nim: string } {
  const tanpaAkhiran = teks.replace(/\.[a-z0-9]{2,5}$/i, "");
  const datar = tanpaAkhiran.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  const nimCocok = [...datar.matchAll(/(?<!\d)(\d{8,15})(?!\d)/g)].map((m) => m[1]);
  const nim = nimCocok.sort((a, b) => b.length - a.length)[0] ?? "";

  const kataBuang = new Set([...KATA_BUANG, ...buang.flatMap((b) => b.toLowerCase().split(/[^a-z0-9]+/)).filter((k) => k.length >= 2)]);
  const rapikan = (s: string) => s
    .replace(/(?<!\d)\d+(?!\d)/g, " ")
    .replace(/[^\p{L}\s'.]/gu, " ")
    .split(/\s+/)
    .filter((k) => k && !kataBuang.has(k.toLowerCase().replace(/\.$/, "")) && k.replace(/[.']/g, "").length >= 2)
    .map((k) => k.charAt(0).toUpperCase() + k.slice(1).toLowerCase())
    .join(" ")
    .trim();

  // Pola Google Form: "<nama berkas asli> - <nama pengirim>".
  const bagian = datar.split(/\s+[-–—]\s+/);
  if (bagian.length > 1) {
    const akhir = bagian[bagian.length - 1].trim();
    if (/^[\p{L}\s'.]{3,60}$/u.test(akhir) && akhir.split(/\s+/).length <= 6) {
      const nama = rapikan(akhir);
      if (nama) return { nama, nim };
    }
  }

  // Nama berkas yang dipotong garis bawah atau tanda pisah:
  // "Anggaran_Budi Santoso_23702010200" → bagian yang paling mirip nama
  // orang (dua sampai lima kata), diutamakan yang bersebelahan dengan NIM.
  const potong = tanpaAkhiran.split(/_+|\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
  if (potong.length > 1) {
    const iNim = potong.findIndex((p) => nim && p.includes(nim));
    let terbaik = { skor: -1, nama: "" };
    potong.forEach((p, i) => {
      const nama = rapikan(p);
      const kata = nama ? nama.split(" ").length : 0;
      if (!kata) return;
      let skor = kata >= 2 && kata <= 5 ? 10 + kata : kata;
      if (iNim >= 0 && Math.abs(i - iNim) <= 1) skor += 3;
      if (skor > terbaik.skor) terbaik = { skor, nama };
    });
    if (terbaik.skor >= 10) return { nama: terbaik.nama.slice(0, 120), nim };
  }
  return { nama: rapikan(datar.replace(/[-–—]/g, " ")).slice(0, 120), nim };
}

/**
 * Kelompokkan berkas menjadi kiriman per mahasiswa.
 *
 * Map akar yang sama untuk seluruh isi satu wadah (folder unduhan Drive)
 * dibuang lebih dulu. Sesudah itu: berkas di dalam map atau arsip menjadi
 * satu kiriman per map/arsip; berkas lepas menjadi satu kiriman masing-masing.
 */
export function kelompokkan(berkas: BerkasTugas[], buang: string[] = []): Kiriman[] {
  const perWadah = new Map<number, BerkasTugas[]>();
  for (const b of berkas) perWadah.set(b.wadah, [...(perWadah.get(b.wadah) ?? []), b]);

  const kelompok = new Map<string, { sumber: string; berkas: BerkasTugas[] }>();
  for (const [wadah, daftar] of perWadah) {
    const relatif = daftar.map((b) => [...b.segmen]);
    // Buang akar bersama: wadah itu sendiri (arsip unduhan) dan map pembungkus.
    while (relatif.every((s) => s.length > 1) && relatif.every((s) => s[0] === relatif[0][0])) {
      relatif.forEach((s) => s.shift());
    }
    daftar.forEach((b, i) => {
      const s = relatif[i];
      const sumber = s.length > 1 ? s[0] : s[0] ?? b.nama;
      const kunci = `${wadah}/${sumber}`;
      const ada = kelompok.get(kunci);
      if (ada) ada.berkas.push(b);
      else kelompok.set(kunci, { sumber, berkas: [b] });
    });
  }

  return [...kelompok.entries()].map(([kunci, k]) => {
    let idn = tebakIdentitas(k.sumber, buang);
    // Map tanpa nama orang ("Tugas 2"): coba nama berkas di dalamnya.
    if (!idn.nama || !idn.nim) {
      for (const b of k.berkas) {
        const lain = tebakIdentitas(b.nama, buang);
        idn = { nama: idn.nama || lain.nama, nim: idn.nim || lain.nim };
        if (idn.nama && idn.nim) break;
      }
    }
    return { id: kunci, sumber: k.sumber.replace(/\.(zip|rar)$/i, ""), nama: idn.nama, nim: idn.nim, berkas: k.berkas };
  }).sort((a, b) => a.nama.localeCompare(b.nama, "id") || a.sumber.localeCompare(b.sumber, "id"));
}

// ------------------------------------------------------------
// 3. SARIKAN TEKS
// ------------------------------------------------------------

export type SariBerkas = {
  nama: string;
  jenis: JenisBerkas;
  teks: string;
  /** Halaman PDF, salindia, atau lembar Excel. */
  bagian: number;
  /** Gambar yang tertanam (Word/PowerPoint) atau halaman PDF yang memuat gambar. */
  gambar: Array<{ nama: string; data: Uint8Array; jenis: string }>;
  /** Halaman PDF yang memuat gambar (1-based), untuk digambar bila PDF terlalu besar. */
  halamanBergambar: number[];
  catatan: string[];
};

const dekode = (d: Uint8Array, label = "utf-8") => new TextDecoder(label).decode(d);

/** Teks polos dengan pilihan penyandian: UTF-8, atau Windows-1252 bila UTF-8 jelas keliru. */
export function teksPolos(d: Uint8Array): string {
  if (d[0] === 0xff && d[1] === 0xfe) return dekode(d.subarray(2), "utf-16le");
  if (d[0] === 0xfe && d[1] === 0xff) return dekode(d.subarray(2), "utf-16be");
  const utf8 = dekode(d);
  const rusak = (utf8.match(/�/g) ?? []).length;
  return rusak > 3 && rusak > utf8.length / 200 ? dekode(d, "windows-1252") : utf8;
}

const entitasHtml = (t: string) => t
  .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"")
  .replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, "&");

/**
 * HTML (keluaran mammoth, atau berkas .html) menjadi teks yang tetap
 * menyimpan susunan tabel: satu baris tabel satu baris teks, sel dipisah " | ".
 * Tanpa DOM, supaya sama di peramban dan di Node.
 */
export function htmlKeTeks(html: string): string {
  return entitasHtml(String(html ?? "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<img[^>]*>/gi, " [gambar] ")
    // Paragraf di dalam sel tabel tidak memecah baris tabelnya.
    .replace(/<t([dh])[^>]*>([\s\S]*?)<\/t\1>/gi, (_, __, isi: string) =>
      isi.replace(/<\/p>\s*<p[^>]*>/gi, " / ").replace(/<\/?p[^>]*>/gi, "").replace(/<br\s*\/?>/gi, " ") + " | ")
    .replace(/\s*\|\s*<\/tr>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|div|table|ul|ol)>/gi, "\n")
    .replace(/<h[1-6][^>]*>/gi, "\n## ")
    .replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+\|/g, " |")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Ambil tabel-tabel dari HTML sebagai larik baris × sel. */
export function tabelDariHtml(html: string): string[][][] {
  return [...String(html ?? "").matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)].map((t) =>
    [...t[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
      [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        entitasHtml(c[1].replace(/<\/p>\s*<p[^>]*>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).trim(),
      ),
    ),
  );
}

/** XML (OOXML/ODF) menjadi teks: paragraf menjadi baris. */
function xmlKeTeks(xml: string): string {
  return entitasHtml(xml
    .replace(/<\/(w:p|a:p|text:p|text:h|table:table-row)>/g, "\n")
    .replace(/<(w:tab|text:tab)\/?>/g, "\t")
    .replace(/<\/table:table-cell>/g, " | ")
    .replace(/<[^>]+>/g, ""))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const JENIS_GAMBAR: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
};

function jenisGambar(nama: string): string | null {
  const a = (nama.toLowerCase().match(/\.([a-z0-9]+)$/) ?? [])[1] ?? "";
  return JENIS_GAMBAR[a] ?? null;
}

/** Gambar yang tertanam di dalam berkas Office/ODF (zip). */
async function gambarTertanam(data: Uint8Array, awalan: RegExp): Promise<SariBerkas["gambar"]> {
  try {
    const salin = new Uint8Array(data.byteLength);
    salin.set(data);
    const isi = await bacaZip(salin.buffer, (n) => awalan.test(n) && jenisGambar(n) !== null);
    return isi
      // Ikon dan logo kecil tidak membantu model menilai apa pun.
      .filter((g) => g.data.length >= 12_000)
      .map((g) => ({ nama: g.nama.split("/").pop() ?? g.nama, data: g.data, jenis: jenisGambar(g.nama)! }));
  } catch {
    return [];
  }
}

async function dariDocx(b: BerkasTugas): Promise<SariBerkas> {
  const mammoth = await import("mammoth");
  const salin = new Uint8Array(b.data.byteLength);
  salin.set(b.data);
  const masukan = typeof window === "undefined"
    ? ({ buffer: Buffer.from(salin) } as unknown as { arrayBuffer: ArrayBuffer })
    : { arrayBuffer: salin.buffer };
  const { value } = await mammoth.convertToHtml(masukan, {
    // Gambar diambil terpisah dari zip-nya; di dalam teks cukup penandanya.
    convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
  });
  const gambar = await gambarTertanam(b.data, /^word\/media\//i);
  return { nama: b.nama, jenis: "docx", teks: htmlKeTeks(value), bagian: 0, gambar, halamanBergambar: [], catatan: [] };
}

/**
 * Word 97–2003 (.doc): teks diambil dari tabel potongan (piece table) di
 * dalam berkas majemuk OLE, seperti yang dikerjakan Word sendiri.
 *
 * Pembaca berkas majemuknya meminjam milik pustaka xlsx yang sudah ada.
 * Kode bidang (HYPERLINK, PAGE, dsb.) dibuang dan hanya hasil tampilnya
 * yang disimpan.
 */
export async function teksDoc(data: Uint8Array): Promise<string> {
  const XLSX = await import("xlsx");
  // Bentuk ESM menyebut CFB sebagai ekspor bernama; bentuk CommonJS (Node)
  // hanya menaruhnya di objek bawaan.
  const CFB = XLSX.CFB ?? (XLSX as unknown as { default?: typeof XLSX }).default?.CFB;
  if (!CFB) throw new Error("Pembaca berkas Word lama tidak tersedia.");
  const cfb = CFB.read(data, { type: "array" } as never);
  const ambil = (nama: string): Uint8Array | null => {
    const e = CFB.find(cfb, nama) as { content?: ArrayLike<number> } | null;
    return e?.content ? Uint8Array.from(e.content as ArrayLike<number>) : null;
  };
  const wd = ambil("WordDocument");
  if (!wd || wd.length < 0x1aa) throw new Error("Berkas .doc ini tidak dikenali sebagai dokumen Word.");
  const dv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
  if (dv.getUint16(0, true) !== 0xa5ec) throw new Error("Berkas .doc ini tidak dikenali sebagai dokumen Word.");
  const bendera = dv.getUint16(0x0a, true);
  if (bendera & 0x0100) throw new Error("Dokumen Word ini dikunci kata sandi.");
  const tabel = ambil(bendera & 0x0200 ? "1Table" : "0Table");
  const fcClx = dv.getUint32(0x01a2, true);
  const lcbClx = dv.getUint32(0x01a6, true);

  let teks = "";
  if (tabel && lcbClx > 0 && fcClx + lcbClx <= tabel.length) {
    const tv = new DataView(tabel.buffer, tabel.byteOffset, tabel.byteLength);
    let p = fcClx;
    // Lewati Prc (0x01) sampai Pcdt (0x02).
    while (p < fcClx + lcbClx && tabel[p] === 0x01) p += 3 + tv.getInt16(p + 1, true);
    if (tabel[p] === 0x02) {
      const lcb = tv.getUint32(p + 1, true);
      const awal = p + 5;
      const n = Math.floor((lcb - 4) / 12);
      for (let i = 0; i < n; i += 1) {
        const cpAwal = tv.getUint32(awal + i * 4, true);
        const cpAkhir = tv.getUint32(awal + (i + 1) * 4, true);
        const pcd = awal + (n + 1) * 4 + i * 8;
        const fcMentah = tv.getUint32(pcd + 2, true);
        const mampat = (fcMentah & 0x40000000) !== 0;
        const fc = fcMentah & 0x3fffffff;
        const panjang = cpAkhir - cpAwal;
        if (panjang <= 0) continue;
        if (mampat) {
          const mulai = fc / 2;
          teks += dekode(wd.subarray(mulai, Math.min(wd.length, mulai + panjang)), "windows-1252");
        } else {
          teks += dekode(wd.subarray(fc, Math.min(wd.length, fc + panjang * 2)), "utf-16le");
        }
      }
    }
  }
  if (!teks.trim()) {
    // Cadangan untuk berkas yang tabel potongannya tidak terbaca: ambil
    // untaian huruf yang panjang. Kasar, tetapi lebih baik daripada kosong.
    teks = (dekode(wd, "windows-1252").match(/[\x20-\x7e\xa0-\xff\r\n\t]{20,}/g) ?? []).join("\n");
  }
  // Kode bidang: \x13 instruksi \x14 hasil \x15 → hasilnya saja.
  teks = teks.replace(/\x13[^\x13\x14\x15]*\x14([^\x13\x15]*)\x15/g, "$1").replace(/\x13[^\x13\x15]*\x15/g, "");
  return teks
    .replace(/\r/g, "\n").replace(/\x07/g, " | ").replace(/[\x0b\x0c]/g, "\n")
    .replace(/[\x00-\x08\x0e-\x1f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function dariLembar(b: BerkasTugas): Promise<SariBerkas> {
  const XLSX = await import("xlsx");
  const kerja = XLSX.read(b.data, { type: "array", cellDates: true });
  const potong: string[] = [];
  for (const nama of kerja.SheetNames.slice(0, 20)) {
    const csv = XLSX.utils.sheet_to_csv(kerja.Sheets[nama], { blankrows: false });
    const baris = csv.split("\n").filter((x) => x.replace(/,/g, "").trim());
    if (baris.length === 0) continue;
    potong.push(`[Lembar: ${nama}]\n${baris.slice(0, 1500).join("\n")}${baris.length > 1500 ? `\n(${baris.length - 1500} baris lagi tidak disertakan)` : ""}`);
  }
  return {
    nama: b.nama, jenis: jenisBerkas(b.nama), teks: potong.join("\n\n"), bagian: kerja.SheetNames.length,
    gambar: [], halamanBergambar: [], catatan: [],
  };
}

async function dariPptx(b: BerkasTugas): Promise<SariBerkas> {
  const salin = new Uint8Array(b.data.byteLength);
  salin.set(b.data);
  const isi = await bacaZip(salin.buffer, (n) => /^ppt\/(slides|notesSlides)\/[^/]+\.xml$/i.test(n));
  const nomor = (n: string) => Number((n.match(/(\d+)\.xml$/) ?? [])[1] ?? 0);
  const salindia = isi.filter((x) => /^ppt\/slides\//i.test(x.nama)).sort((a, c) => nomor(a.nama) - nomor(c.nama));
  const catatan = new Map(isi.filter((x) => /notesSlides/i.test(x.nama)).map((x) => [nomor(x.nama), x]));
  const potong = salindia.map((s) => {
    const n = nomor(s.nama);
    const t = [s, catatan.get(n)].filter(Boolean)
      .map((x) => [...dekode(x!.data).matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => entitasHtml(m[1])).join(" ").trim())
      .filter(Boolean).join("\n");
    return t ? `[Salindia ${n}] ${t}` : "";
  }).filter(Boolean);
  const gambar = await gambarTertanam(b.data, /^ppt\/media\//i);
  return { nama: b.nama, jenis: "pptx", teks: potong.join("\n\n"), bagian: salindia.length, gambar, halamanBergambar: [], catatan: [] };
}

async function dariOdf(b: BerkasTugas): Promise<SariBerkas> {
  const salin = new Uint8Array(b.data.byteLength);
  salin.set(b.data);
  const isi = await bacaZip(salin.buffer, (n) => n === "content.xml");
  const gambar = await gambarTertanam(b.data, /^Pictures\//);
  return {
    nama: b.nama, jenis: jenisBerkas(b.nama), teks: isi[0] ? xmlKeTeks(dekode(isi[0].data)) : "",
    bagian: 0, gambar, halamanBergambar: [], catatan: [],
  };
}

/** RTF menjadi teks: kata kendali dibuang, \'xx dan \uN dibaca. */
export function teksRtf(rtf: string): string {
  let s = rtf.replace(/\{\\\*[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, "");
  s = s.replace(/\{\\(fonttbl|colortbl|stylesheet|info|pict)[\s\S]*?\}\s*\}/g, "");
  s = s.replace(/\\u(-?\d+)\??/g, (_, n: string) => String.fromCharCode((Number(n) + 65536) % 65536));
  s = s.replace(/\\'([0-9a-f]{2})/gi, (_, h: string) => new TextDecoder("windows-1252").decode(new Uint8Array([parseInt(h, 16)])));
  s = s.replace(/\\(par|line)\b ?/g, "\n").replace(/\\tab\b ?/g, "\t").replace(/\\cell\b ?/g, " | ").replace(/\\row\b ?/g, "\n");
  s = s.replace(/\\[a-z]+-?\d* ?/gi, "").replace(/\\([{}\\])/g, "$1").replace(/[{}]/g, "");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsSiap: Promise<PdfJs> | null = null;

/** pdf.js dengan pekerja semu, sama seperti pemeriksa naskah (lihat ekstrak-naskah.ts). */
async function pdfjs(): Promise<PdfJs> {
  pdfjsSiap ??= (async () => {
    const [pdf, pekerja] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.mjs"),
    ]);
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = { WorkerMessageHandler: pekerja.WorkerMessageHandler };
    return pdf;
  })();
  return pdfjsSiap;
}

async function bukaPdf(data: Uint8Array) {
  const pdf = await pdfjs();
  const salin = new Uint8Array(data.byteLength);
  salin.set(data);
  const tugas = pdf.getDocument({ data: salin, disableFontFace: true, useSystemFonts: false, useWasm: false, verbosity: 0 });
  try {
    return { pdf, dok: await tugas.promise };
  } catch (alasan) {
    void tugas.destroy();
    const nama = (alasan as { name?: string })?.name ?? "";
    if (nama === "PasswordException") throw new Error("PDF ini dikunci kata sandi.");
    throw new Error("PDF ini rusak atau tidak dapat dibuka.");
  }
}

async function dariPdf(b: BerkasTugas): Promise<SariBerkas> {
  const { pdf, dok } = await bukaPdf(b.data);
  const potong: string[] = [];
  const halamanBergambar: number[] = [];
  const opsGambar = new Set([pdf.OPS.paintImageXObject, pdf.OPS.paintInlineImageXObject, pdf.OPS.paintImageXObjectRepeat]);
  try {
    for (let n = 1; n <= dok.numPages; n += 1) {
      const hal = await dok.getPage(n);
      const isi = await hal.getTextContent();
      let baris = "";
      for (const butir of isi.items) {
        if (!("str" in butir)) continue;
        baris += butir.str;
        baris += butir.hasEOL ? "\n" : "";
      }
      try {
        const ops = await hal.getOperatorList();
        if (ops.fnArray.some((f) => opsGambar.has(f))) halamanBergambar.push(n);
      } catch {
        // Daftar perintah gambar hanya tambahan; teksnya tetap terbaca.
      }
      hal.cleanup();
      potong.push(`[Halaman ${n}]\n${baris.trim()}`);
    }
  } finally {
    void dok.loadingTask.destroy();
  }
  const teks = potong.join("\n\n");
  const catatan: string[] = [];
  if (teks.replace(/\[Halaman \d+\]/g, "").trim().length < 40 * dok.numPages) {
    catatan.push("Teksnya sangat sedikit; kemungkinan PDF hasil pindaian, jadi halamannya dibaca sebagai gambar.");
  }
  return { nama: b.nama, jenis: "pdf", teks, bagian: dok.numPages, gambar: [], halamanBergambar, catatan };
}

/** Sarikan satu berkas apa pun bentuknya. Tidak pernah melempar galat. */
export async function sarikanBerkas(b: BerkasTugas): Promise<SariBerkas> {
  const jenis = jenisBerkas(b.nama);
  const kosong = (catatan: string): SariBerkas => ({ nama: b.nama, jenis, teks: "", bagian: 0, gambar: [], halamanBergambar: [], catatan: [catatan] });
  try {
    switch (jenis) {
      case "pdf": return await dariPdf(b);
      case "docx": return await dariDocx(b);
      case "doc": return { ...kosong(""), teks: await teksDoc(b.data), catatan: [] };
      case "xlsx": case "xls": case "csv": return await dariLembar(b);
      case "pptx": return await dariPptx(b);
      case "odt": case "odp": return await dariOdf(b);
      case "rtf": return { ...kosong(""), teks: teksRtf(teksPolos(b.data)), catatan: [] };
      case "teks": return { ...kosong(""), teks: teksPolos(b.data).trim(), catatan: [] };
      case "html": return { ...kosong(""), teks: htmlKeTeks(teksPolos(b.data)), catatan: [] };
      case "gambar": return { ...kosong(""), gambar: [{ nama: b.nama, data: b.data, jenis: jenisGambar(b.nama) ?? "image/png" }], catatan: [] };
      default: return kosong("Bentuk berkas ini tidak dikenali dan dilewati.");
    }
  } catch (galat) {
    return kosong(`Tidak dapat dibaca: ${(galat as Error)?.message || "galat tidak dikenal"}`);
  }
}

// ------------------------------------------------------------
// 4. RAKIT KIRIMAN UNTUK SERVER
// ------------------------------------------------------------

/** Batas lampiran visual per mahasiswa (bita asli). Server menerima ± 4,3 MB base64. */
export const BATAS_LAMPIRAN = 2_900_000;
/** PDF asli dilampirkan utuh bila tidak lebih besar dari ini. */
export const BATAS_PDF_UTUH = 2_600_000;
const MAKS_GAMBAR = 8;
const MAKS_TEKS = 150_000;

export type Lampiran = { jenis: string; data: string; nama?: string };

export type KirimanSiap = {
  teks: string;
  lampiran: Lampiran[];
  keteranganLampiran: string;
  berkas: string[];
  catatan: string[];
  /** Ringkasan per berkas untuk layar dosen. */
  ringkas: Array<{ nama: string; jenis: JenisBerkas; kata: number; bagian: number; catatan: string[] }>;
};

/** Alat yang hanya ada di peramban; uji Node berjalan tanpanya. */
export type AlatGambar = {
  /**
   * Kecilkan gambar, sisi terpanjang paling banyak `sisi` piksel. Hasilnya
   * JPEG, kecuali gambar asli sudah cukup kecil (tangkapan layar PNG sering
   * lebih kecil daripada JPEG-nya). null = gambar tidak layak dikirim.
   */
  kecilkan?: (data: Uint8Array, jenis: string, sisi: number) => Promise<{ data: Uint8Array; jenis: string } | null>;
  /** Gambar satu halaman PDF menjadi JPEG. */
  gambarHalaman?: (pdf: Uint8Array, halaman: number, sisi: number) => Promise<Uint8Array | null>;
};

export function keBase64(data: Uint8Array): string {
  let biner = "";
  const potong = 0x8000;
  for (let i = 0; i < data.length; i += potong) {
    biner += String.fromCharCode(...data.subarray(i, i + potong));
  }
  return btoa(biner);
}

const hitungKata = (t: string) => (t.match(/\S+/g) ?? []).length;

/**
 * Sarikan seluruh berkas satu mahasiswa dan rakit kirimannya.
 *
 * Urutan lampiran visual, selama muat di BATAS_LAMPIRAN:
 *   1. PDF asli, utuh, bila tidak lebih dari BATAS_PDF_UTUH;
 *   2. bila terlalu besar: gambar halaman yang memuat gambar (atau halaman
 *      pertama bila PDF-nya hasil pindaian);
 *   3. gambar yang tertanam di Word/PowerPoint, dan berkas gambar lepas.
 */
export async function siapkanKiriman(k: Kiriman, alat: AlatGambar = {}): Promise<KirimanSiap> {
  const sari: Array<SariBerkas & { asli: BerkasTugas }> = [];
  for (const b of k.berkas) sari.push({ ...(await sarikanBerkas(b)), asli: b });

  // ---------- teks ----------
  const bagianTeks = sari.filter((s) => s.teks.trim());
  const jatah = Math.max(20_000, Math.floor(MAKS_TEKS / Math.max(1, bagianTeks.length)));
  let teks = bagianTeks.map((s) => {
    const label = s.jenis === "pdf" ? `PDF, ${s.bagian} halaman` : s.jenis.toUpperCase();
    const isi = s.teks.length > jatah ? `${s.teks.slice(0, jatah)}\n(… sisa berkas ini dipotong)` : s.teks;
    return `===== BERKAS: ${s.nama} (${label}) =====\n${isi}`;
  }).join("\n\n");
  if (teks.length > MAKS_TEKS) teks = teks.slice(0, MAKS_TEKS);

  // ---------- lampiran visual ----------
  const lampiran: Lampiran[] = [];
  const keterangan: string[] = [];
  let sisa = BATAS_LAMPIRAN;
  let jumlahGambar = 0;
  const tambahGambar = async (data: Uint8Array, jenis: string, nama: string) => {
    if (jumlahGambar >= MAKS_GAMBAR) return false;
    let isi: Uint8Array | null = data;
    let jenisAkhir = jenis;
    if (alat.kecilkan) {
      const kecil = await alat.kecilkan(data, jenis, 1400).catch(() => null);
      isi = kecil?.data ?? null;
      jenisAkhir = kecil?.jenis ?? jenis;
    } else if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(jenis) || data.length > 600_000) {
      isi = null;
    }
    if (!isi || isi.length > sisa) return false;
    lampiran.push({ jenis: jenisAkhir, data: keBase64(isi), nama });
    sisa -= isi.length;
    jumlahGambar += 1;
    return true;
  };

  for (const s of sari.filter((x) => x.jenis === "pdf")) {
    if (s.asli.data.length <= Math.min(BATAS_PDF_UTUH, sisa)) {
      lampiran.push({ jenis: "application/pdf", data: keBase64(s.asli.data), nama: s.nama });
      sisa -= s.asli.data.length;
      keterangan.push(`PDF asli "${s.nama}" terlampir utuh`);
      continue;
    }
    if (!alat.gambarHalaman) continue;
    const pindaian = s.catatan.some((c) => /pindaian/.test(c));
    const halaman = (pindaian ? Array.from({ length: s.bagian }, (_, i) => i + 1) : s.halamanBergambar).slice(0, 6);
    const tergambar: number[] = [];
    for (const n of halaman) {
      const jpg = await alat.gambarHalaman(s.asli.data, n, 1400).catch(() => null);
      if (jpg && await tambahGambar(jpg, "image/jpeg", `${s.nama} halaman ${n}`)) tergambar.push(n);
    }
    if (tergambar.length) {
      keterangan.push(`gambar halaman ${tergambar.join(", ")} dari "${s.nama}" (PDF terlalu besar untuk dilampirkan utuh)`);
    }
  }
  for (const s of sari) {
    const awal = jumlahGambar;
    for (const g of s.gambar) await tambahGambar(g.data, g.jenis, s.jenis === "gambar" ? s.nama : `${s.nama}: ${g.nama}`);
    if (jumlahGambar > awal) {
      keterangan.push(s.jenis === "gambar" ? `berkas gambar "${s.nama}"` : `${jumlahGambar - awal} gambar yang tertanam di "${s.nama}"`);
    }
  }

  const catatan = sari.flatMap((s) => s.catatan.filter(Boolean).map((c) => `${s.nama}: ${c}`));
  if (!teks.trim() && lampiran.length === 0) catatan.push("Tidak ada teks maupun gambar yang dapat dibaca dari kiriman ini.");

  return {
    teks,
    lampiran,
    keteranganLampiran: keterangan.length ? `${keterangan.join("; ")}. Lampiran ini adalah tampilan asli dokumen yang sama.` : "",
    berkas: k.berkas.map((b) => b.segmen.slice(-2).join("/")),
    catatan,
    ringkas: sari.map((s) => ({ nama: s.nama, jenis: s.jenis, kata: hitungKata(s.teks), bagian: s.bagian, catatan: s.catatan })),
  };
}

// ------------------------------------------------------------
// ALAT GAMBAR UNTUK PERAMBAN
// ------------------------------------------------------------

async function kanvasKeJpeg(kanvas: HTMLCanvasElement, mutu = 0.62): Promise<Uint8Array | null> {
  const blob = await new Promise<Blob | null>((r) => kanvas.toBlob(r, "image/jpeg", mutu));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

/** Alat gambar sungguhan, memakai kanvas peramban. */
export function alatGambarPeramban(): AlatGambar {
  return {
    async kecilkan(data, jenis, sisi) {
      const salin = new Uint8Array(data.byteLength);
      salin.set(data);
      const bmp = await createImageBitmap(new Blob([salin], { type: jenis }));
      const skala = Math.min(1, sisi / Math.max(bmp.width, bmp.height));
      // Gambar mungil (ikon, garis hiasan) tidak membantu penilaian.
      if (bmp.width < 160 || bmp.height < 120) { bmp.close(); return null; }
      const kanvas = document.createElement("canvas");
      kanvas.width = Math.max(1, Math.round(bmp.width * skala));
      kanvas.height = Math.max(1, Math.round(bmp.height * skala));
      const ctx = kanvas.getContext("2d");
      if (!ctx) { bmp.close(); return null; }
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, kanvas.width, kanvas.height);
      ctx.drawImage(bmp, 0, 0, kanvas.width, kanvas.height);
      bmp.close();
      const jpg = await kanvasKeJpeg(kanvas);
      // Gambar yang tidak perlu dikecilkan dan sudah lebih ringkas dari
      // JPEG-nya dikirim apa adanya.
      const asliBoleh = skala === 1 && ["image/png", "image/jpeg", "image/webp"].includes(jenis);
      if (asliBoleh && (!jpg || data.length <= jpg.length)) return { data, jenis };
      return jpg ? { data: jpg, jenis: "image/jpeg" } : null;
    },
    async gambarHalaman(pdfData, nomor, sisi) {
      const { dok } = await bukaPdf(pdfData);
      try {
        const hal = await dok.getPage(nomor);
        const dasar = hal.getViewport({ scale: 1 });
        const skala = Math.min(2, sisi / Math.max(dasar.width, dasar.height));
        const vp = hal.getViewport({ scale: skala });
        const kanvas = document.createElement("canvas");
        kanvas.width = Math.ceil(vp.width);
        kanvas.height = Math.ceil(vp.height);
        await hal.render({ canvas: kanvas, viewport: vp }).promise;
        hal.cleanup();
        return kanvasKeJpeg(kanvas);
      } finally {
        void dok.loadingTask.destroy();
      }
    },
  };
}

// ------------------------------------------------------------
// 5. RUBRIK DARI BERKAS DOSEN
// ------------------------------------------------------------

export type HasilBacaRubrik =
  | { ok: true; rubrik: import("@/lib/tugas-rubrik").RubrikTugas; catatan: string[]; cara: string }
  /** Tidak ada tabel yang dikenali: teksnya diserahkan ke AI untuk disusun. */
  | { ok: false; teks: string; catatan: string[] };

/**
 * Baca rubrik tugas dari berkas apa pun yang diunggah dosen.
 *
 * Urutannya dari yang paling pasti:
 *   1. template rubrik portal (lembar "Rubrik" Excel, atau Word berlabel);
 *   2. tabel apa pun yang punya kolom "Kriteria" (Excel atau tabel Word);
 *   3. selebihnya teks, untuk disusun AI (PDF, PowerPoint, teks bebas).
 */
export async function rubrikDariBerkas(nama: string, data: Uint8Array): Promise<HasilBacaRubrik> {
  const { bacaTabelRubrik, dariRubrikLevel } = await import("@/lib/tugas-rubrik");
  const { imporRubrikExcel, imporRubrikWord } = await import("@/lib/impor-rubrik");
  const jenis = jenisBerkas(nama);
  const berkas: BerkasTugas = { jalur: nama, segmen: [nama], wadah: 0, nama, data };

  if (jenis === "xlsx" || jenis === "xls" || jenis === "csv") {
    const XLSX = await import("xlsx");
    const kerja = XLSX.read(data, { type: "array" });
    const lembar = kerja.SheetNames.map((n) => ({
      n, aoa: XLSX.utils.sheet_to_json(kerja.Sheets[n], { header: 1, raw: false, defval: "" }) as string[][],
    }));
    const templat = lembar.find((l) => /^rubrik$/i.test(l.n));
    if (templat) {
      const h = imporRubrikExcel(templat.aoa);
      if (h.ok) return { ok: true, rubrik: dariRubrikLevel(h.rubrik), catatan: h.catatan, cara: "template rubrik portal" };
    }
    for (const l of lembar) {
      const t = bacaTabelRubrik(l.aoa);
      if (t) return { ok: true, rubrik: t.rubrik, catatan: t.catatan, cara: `tabel di lembar "${l.n}"` };
    }
    return { ok: false, teks: (await dariLembar(berkas)).teks, catatan: [] };
  }

  if (jenis === "docx") {
    const mammoth = await import("mammoth");
    const salin = new Uint8Array(data.byteLength);
    salin.set(data);
    const masukan = typeof window === "undefined"
      ? ({ buffer: Buffer.from(salin) } as unknown as { arrayBuffer: ArrayBuffer })
      : { arrayBuffer: salin.buffer };
    const { value: html } = await mammoth.convertToHtml(masukan);
    const tabel = tabelDariHtml(html)
      .map((t) => bacaTabelRubrik(t))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .sort((a, b) => b.rubrik.kriteria.length - a.rubrik.kriteria.length);
    if (tabel[0]) return { ok: true, rubrik: tabel[0].rubrik, catatan: tabel[0].catatan, cara: "tabel di dokumen Word" };
    const { value: mentah } = await mammoth.extractRawText(masukan);
    const h = imporRubrikWord(mentah);
    if (h.ok) return { ok: true, rubrik: dariRubrikLevel(h.rubrik), catatan: h.catatan, cara: "template rubrik portal" };
    return { ok: false, teks: htmlKeTeks(html), catatan: [] };
  }

  const sari = await sarikanBerkas(berkas);
  if (jenis === "doc" || jenis === "teks" || jenis === "rtf") {
    const h = imporRubrikWord(sari.teks);
    if (h.ok) return { ok: true, rubrik: dariRubrikLevel(h.rubrik), catatan: h.catatan, cara: "template rubrik portal" };
  }
  return { ok: false, teks: sari.teks, catatan: sari.catatan };
}
