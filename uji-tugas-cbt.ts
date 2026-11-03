// UJI v54 — TUGAS LEWAT CBT: kode kiriman, PDF → .md, plagiasi, gerbang,
// papan nilai, keterangan terkunci, laporan PDF elegan, dan Arsip Drive.
//
//   npx tsx uji-tugas-cbt.ts
//
// Berdiri sendiri: tanpa jaringan, tanpa basis data, tanpa berkas dari luar.
// PDF contoh dibuat oleh penulis PDF portal sendiri lalu dibaca balik dengan
// pdf.js, jalur yang sama dengan yang dipakai peramban mahasiswa.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ABJAD_KODE, AWALAN_RESI, buatKodeArsip, buatKodeResi, buatKodeTugas, rapikanKodeArsip, rapikanKodeResi,
  rapikanKodeTugas, samarkanNim, sidikBerkas, sidikSah, tautanDriveSah,
} from "./src/lib/tugas-kode";
import { hitungKata, pdfKeMarkdown, susunMarkdown, type ButirTeks, type HalamanTeks } from "./src/lib/pdf-markdown";
import { cuplikanSama, periksaPlagiasi, teksBanding } from "./src/lib/tugas-plagiasi";
import {
  gerbangPlagiasi, keteranganNilai, nilaiEfektif, nilaiKritis, rapikanBatasKritis, rapikanTindakan, susunDataLaporan,
  susunPapan, terindikasi, type KirimanPapan,
} from "./src/lib/tugas-papan";
import {
  KAKI_SPF, TEMPLATE_BAWAAN, analisisTemplate, buatLaporanPdf, isiTemplate, uraiMarkdown,
} from "./src/lib/tugas-template";
import { buatPdf } from "./src/lib/pdf-sederhana";
import { SKALA_BAWAAN, type RubrikTugas } from "./src/lib/tugas-rubrik";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, JSON.stringify(dapat) === JSON.stringify(harap), `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);
const memuat = (nama: string, teks: string, cari: string) =>
  benar(nama, teks.includes(cari), `"${cari}" tidak ditemukan dalam: ${teks.slice(0, 400).replace(/\n/g, " ⏎ ")}…`);

/** Teks PDF lewat pdf.js, seperti di peramban. */
async function teksPdf(pdf: Uint8Array): Promise<string> {
  const [pdfjs, pekerja] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ]);
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = { WorkerMessageHandler: pekerja.WorkerMessageHandler };
  const dok = await pdfjs.getDocument({ data: new Uint8Array(pdf), disableFontFace: true, useSystemFonts: false, useWasm: false, verbosity: 0 }).promise;
  let teks = "";
  for (let n = 1; n <= dok.numPages; n += 1) {
    const isi = await (await dok.getPage(n)).getTextContent();
    for (const b of isi.items) if ("str" in b) teks += b.str + (b.hasEOL ? "\n" : "");
    teks += "\n";
  }
  await dok.loadingTask.destroy();
  return teks.replace(/[ \t]+/g, " ");
}

function xrefSah(pdf: Uint8Array): boolean {
  const s = Buffer.from(pdf).toString("latin1");
  const awal = Number((s.match(/startxref\n(\d+)/) ?? [])[1]);
  if (!s.startsWith("%PDF-") || s.slice(awal, awal + 4) !== "xref") return false;
  const baris = s.slice(awal).split("\n");
  const jumlah = Number(baris[1].split(" ")[1]);
  for (let id = 1; id < jumlah; id += 1) {
    if (!s.startsWith(`${id} 0 obj`, Number(baris[2 + id].slice(0, 10)))) return false;
  }
  return true;
}

/** Kata acak yang dapat diulang: dokumen "karangan" berbeda per benih. */
const karangan = (benih: number, n: number) =>
  Array.from({ length: n }, (_, i) => `kata${(benih * 7919 + i * 104729) % 100_003}`).join(" ");

async function main() {
  // ============================================================
  console.log("\n=== KODE KIRIMAN, KODE TUGAS, TAUTAN PENDEK ===\n");
  // ============================================================
  const kode = Array.from({ length: 3000 }, buatKodeResi);
  benar("kode kiriman berbentuk SIPALING-TUGAS-XXXXXXXX", kode.every((k) => /^SIPALING-TUGAS-[A-Z0-9]{8}$/.test(k)), kode[0]);
  benar("hanya huruf abjad kode (tanpa I, L, O, U, 0, 1)", kode.every((k) => [...k.slice(AWALAN_RESI.length)].every((h) => ABJAD_KODE.includes(h))));
  sama("3.000 kode tanpa kembar", new Set(kode).size, kode.length);
  sama("abjad 30 huruf", ABJAD_KODE.length, 30);
  const kodeContoh = "SIPALING-TUGAS-H7KQ3MXP";
  sama("diketik huruf kecil berspasi", rapikanKodeResi("sipaling tugas h7kq 3mxp"), kodeContoh);
  sama("tanpa awalan, bertanda pisah", rapikanKodeResi("H7KQ-3MXP"), kodeContoh);
  sama("bentuk resmi tetap", rapikanKodeResi(kodeContoh), kodeContoh);
  sama("huruf di luar abjad tidak ditebak (O dan 0)", rapikanKodeResi("H7KQ3MX0"), "");
  sama("panjang salah ditolak (bentuk SIPALING-TUGAS-001)", rapikanKodeResi("SIPALING-TUGAS-001"), "");
  sama("kosong ditolak", rapikanKodeResi(""), "");
  benar("kode pengumpulan 6 huruf", Array.from({ length: 200 }, buatKodeTugas).every((k) => /^[A-Z0-9]{6}$/.test(k)));
  sama("kode pengumpulan dirapikan", rapikanKodeTugas(" tgs-234 "), "TGS234");
  benar("kode tautan pendek 7 huruf", /^[A-Z0-9]{7}$/.test(buatKodeArsip()));
  sama("kode tautan pendek huruf kecil diterima", rapikanKodeArsip("k7q2xmp"), "K7Q2XMP");
  sama("kode tautan pendek terlalu pendek ditolak", rapikanKodeArsip("ab"), "");

  sama("NIM disamarkan", samarkanNim("23702010192"), "2370•••••92");
  sama("NIM pendek disamarkan", samarkanNim("123456"), "12•••6");
  sama("NIM kosong tetap kosong", samarkanNim(""), "");

  sama("Drive: folder diterima", tautanDriveSah(" https://drive.google.com/drive/folders/1AbC "), "https://drive.google.com/drive/folders/1AbC");
  benar("Docs diterima", tautanDriveSah("https://docs.google.com/document/d/abc/edit") !== "");
  sama("http ditolak", tautanDriveSah("http://drive.google.com/x"), "");
  sama("domain lain ditolak", tautanDriveSah("https://evil.example.com/drive.google.com"), "");
  sama("domain tiruan ditolak", tautanDriveSah("https://drive.google.com.evil.com/x"), "");
  sama("userinfo ditolak", tautanDriveSah("https://drive.google.com@evil.com/x"), "");
  sama("javascript: ditolak", tautanDriveSah("javascript:alert(1)"), "");
  sama("berspasi di tengah ditolak", tautanDriveSah("https://drive.google.com/a b"), "");

  sama("SHA-256 sesuai vektor baku", await sidikBerkas(new TextEncoder().encode("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  benar("bentuk sidik diperiksa", sidikSah("a".repeat(64)) && !sidikSah("A".repeat(64)) && !sidikSah("abc"));

  // ============================================================
  console.log("\n=== PDF → MARKDOWN ===\n");
  // ============================================================
  const b = (teks: string, x: number, y: number, ukuran = 11, lebar?: number): ButirTeks =>
    ({ teks, x, y, ukuran, lebar: lebar ?? teks.length * ukuran * 0.5 });
  const halaman = (nomor: number, butir: ButirTeks[]): HalamanTeks => ({ nomor, lebar: 595, tinggi: 842, butir });
  const md = susunMarkdown([
    halaman(1, [
      b("Kop Universitas Contoh", 72, 812, 9),
      b("Proposal Kampanye Hijau", 72, 760, 20),
      b("BAB I PENDAHULUAN", 72, 720),
      b("Kampus menghasilkan sampah plastik setiap bulan dan sebagian besar mahasiswa belum memilah sampah karena", 72, 700, 11, 430),
      b("fasilitas yang kurang serta kampanye yang belum konsis-", 72, 686, 11, 300),
      b("ten dari tahun ke tahun.", 72, 672, 11, 140),
      b("Paragraf kedua dimulai setelah jarak.", 72, 640, 11, 220),
      b("• Menurunkan sampah plastik", 80, 610),
      b("• Melibatkan 1.000 mahasiswa", 80, 596),
      b("1. Konferensi pers", 80, 570),
      b("Media", 72, 540), b("Tier", 260, 540), b("Jurnalis", 400, 540),
      b("Kompas", 72, 526), b("1", 260, 526), b("Rina", 400, 526),
      b("1", 290, 40, 9),
    ]),
    halaman(2, [b("Kop Universitas Contoh", 72, 812, 9), b("Isi halaman dua yang cukup panjang untuk badan teks.", 72, 760, 11, 300), b("2", 290, 40, 9)]),
    halaman(3, [b("Kop Universitas Contoh", 72, 812, 9), b("Isi halaman tiga.", 72, 760, 11, 120), b("3", 290, 40, 9)]),
  ]);
  memuat("penanda halaman", md, "[Halaman 1]");
  memuat("penanda halaman berikutnya", md, "[Halaman 3]");
  memuat("judul besar menjadi #", md, "# Proposal Kampanye Hijau");
  memuat("BAB I menjadi judul ##", md, "## BAB I PENDAHULUAN");
  memuat("kata terpenggal disambung", md, "belum konsisten dari tahun ke tahun.");
  benar("baris sepenggal paragraf disatukan", md.includes("belum memilah sampah karena fasilitas yang kurang"));
  memuat("paragraf baru sesudah jarak", md, "\n\nParagraf kedua dimulai setelah jarak.");
  memuat("butir berpoin", md, "- Menurunkan sampah plastik\n- Melibatkan 1.000 mahasiswa");
  memuat("butir bernomor dipisah dari butir berpoin", md, "\n\n1. Konferensi pers");
  memuat("tabel Markdown", md, "| Media | Tier | Jurnalis |\n| --- | --- | --- |\n| Kompas | 1 | Rina |");
  benar("kop yang berulang di tiap halaman dibuang", !md.includes("Kop Universitas Contoh"), md.slice(0, 200));
  benar("nomor halaman dibuang", !/\n\n[123]\n/.test(md) && !md.trim().endsWith("3"));
  sama("hitung kata mengabaikan penanda halaman", hitungKata("[Halaman 1]\n\nSatu dua tiga."), 3);
  sama("halaman kosong tidak menghasilkan apa-apa", susunMarkdown([halaman(1, [])]), "");

  // Pulang-pergi sungguhan: PDF dari penulis PDF portal, dibaca pdf.js.
  const pdfMhs = buatPdf([
    { jenis: "judul", tingkat: 1, teks: "Proposal Program Public Relations GOJEK SIGAP 2026" },
    { jenis: "paragraf", teks: "Afifah Meilina, NIM 23702010192." },
    { jenis: "judul", tingkat: 2, teks: "1. Latar Belakang" },
    { jenis: "paragraf", teks: "Survei terhadap 325 pengguna menunjukkan 61% mengeluhkan keterlambatan pickup. ".repeat(4) },
    { jenis: "daftar", butir: ["Konferensi pers di Jakarta", "Media kit untuk 25 jurnalis"] },
    { jenis: "tabel", lebar: [1, 1], kepala: true, baris: [["Media", "Tier"], ["Kompas", "1"], ["Detik", "1"]] },
    ...Array.from({ length: 30 }, (_, i) => ({ jenis: "paragraf" as const, teks: `Paragraf rencana ${i + 1}: ${"kegiatan komunikasi terukur ".repeat(8)}` })),
  ]);
  const hasilMd = await pdfKeMarkdown(pdfMhs);
  benar("PDF berhalaman banyak terbaca semua", hasilMd.halaman >= 2, `${hasilMd.halaman} halaman`);
  memuat("judul PDF menjadi judul Markdown", hasilMd.markdown, "# Proposal Program Public Relations GOJEK SIGAP 2026");
  memuat("sub-judul PDF", hasilMd.markdown, "1. Latar Belakang");
  memuat("butir PDF", hasilMd.markdown, "- Konferensi pers di Jakarta");
  memuat("tabel PDF", hasilMd.markdown, "| Media | Tier |");
  memuat("penanda halaman 2 PDF", hasilMd.markdown, "[Halaman 2]");
  benar("jumlah kata wajar", hasilMd.kata > 400, String(hasilMd.kata));
  benar("tanpa catatan pindaian untuk PDF berteks", hasilMd.catatan.length === 0, hasilMd.catatan.join(" "));
  let galatPdf = "";
  try { await pdfKeMarkdown(new TextEncoder().encode("ini bukan pdf")); } catch (e) { galatPdf = (e as Error).message; }
  memuat("bukan PDF: galat yang dapat dibaca orang", galatPdf, "bukan PDF");

  // ============================================================
  console.log("\n=== PLAGIASI ANTARKIRIMAN ===\n");
  // ============================================================
  const tmpl = "Petunjuk pengerjaan: jawablah seluruh bagian proposal dengan lengkap sesuai rubrik dosen pengampu mata kuliah.";
  const A = karangan(1, 600);
  const kataA = A.split(" ");
  const B = `${kataA.slice(0, 300).join(" ")} ${karangan(2, 300)}`;
  const ringkasan = kataA.slice(100, 220).join(" ");
  const dok = [
    { id: 1, teks: `${tmpl} ${A}` },
    { id: 2, teks: `${tmpl} ${B}` },
    { id: 3, teks: `${tmpl} ${karangan(3, 600)}` },
    { id: 4, teks: `${tmpl} ${karangan(4, 600)}` },
    { id: 5, teks: `${tmpl} ${karangan(5, 600)}`, sidikBerkas: "c".repeat(64) },
    { id: 6, teks: `isi lain sama sekali ${karangan(6, 500)}`, sidikBerkas: "c".repeat(64) },
    { id: 7, teks: ringkasan },
    { id: 8, teks: "jawaban singkat yang sama persis ditulis oleh dua mahasiswa berbeda di kelas ini" },
    { id: 9, teks: "Jawaban singkat yang SAMA persis ditulis oleh dua mahasiswa berbeda di kelas ini." },
  ];
  const h = periksaPlagiasi(dok);
  const pas = (a: number, x: number) => h.pasangan.find((p) => p.a === a && p.b === x);
  const p12 = pas(1, 2);
  benar("separuh isi disalin: ±50%, terindikasi", Boolean(p12 && p12.skor >= 48 && p12.skor <= 52 && p12.status === "tinggi"), JSON.stringify(p12));
  const p17 = pas(1, 7);
  benar("ringkasan yang seluruhnya disalin: 100% dari sisi ringkasan", Boolean(p17 && p17.bagianB === 100 && p17.bagianA < 30 && p17.skor === 100), JSON.stringify(p17));
  const p56 = pas(5, 6);
  benar("berkas identik (SHA-256 sama): 100% walau teks beda", Boolean(p56 && p56.skor === 100 && p56.sinyal.kembar === "berkas"), JSON.stringify(p56));
  benar("templat yang dipakai separuh kelas tidak dihitung", !pas(3, 4), JSON.stringify(pas(3, 4)));
  benar("urutan kata umum tercatat", h.umum > 0, String(h.umum));
  sama("kiriman bersih tetap bersih", h.ringkas.get(3), { skor: 0, status: "bersih", lawan: null });
  benar("teks pendek sama persis tetap tertangkap", pas(8, 9)?.sinyal.kembar === "teks");
  sama("ringkasan per kiriman memakai yang tertinggi", h.ringkas.get(1)?.lawan, 7);
  benar("pasangan diurutkan dari tertinggi", h.pasangan.every((p, i, s) => i === 0 || s[i - 1].skor >= p.skor));
  benar("a selalu id yang lebih kecil", h.pasangan.every((p) => p.a < p.b));
  const soal = karangan(99, 80);
  const duaDok = [{ id: 1, teks: `${soal} ${karangan(11, 200)}` }, { id: 2, teks: `${soal} ${karangan(12, 200)}` }];
  benar("templat pendek bersama (±5%) di bawah ambang simpan", periksaPlagiasi([{ id: 1, teks: `${tmpl} ${karangan(11, 200)}` }, { id: 2, teks: `${tmpl} ${karangan(12, 200)}` }]).pasangan.length === 0);
  benar("dua kiriman: soal panjang yang disalin ikut terhitung", (periksaPlagiasi(duaDok).pasangan[0]?.skor ?? 0) >= 20, JSON.stringify(periksaPlagiasi(duaDok).pasangan[0]));
  sama("petunjuk dosen (abaikan) tidak dihitung", periksaPlagiasi(duaDok, {}, { abaikan: [soal] }).pasangan.length, 0);
  const ambangKetat = periksaPlagiasi(dok, { tinjau: 10, tinggi: 90 });
  sama("ambang dari dosen dipakai", ambangKetat.pasangan.find((p) => p.a === 1 && p.b === 2)?.status, "tinjau");
  sama("teks banding membuang penanda halaman dan tanda Markdown", teksBanding("[Halaman 2]\n# Judul **tebal** | sel |").replace(/\s+/g, " ").trim(), "Judul tebal sel");
  const kalimat = cuplikanSama(
    "Kalimat pertama ini disalin utuh dari teman sekelas tanpa diubah sedikit pun. Lainnya beda.",
    "Pembuka lain. Kalimat pertama ini disalin utuh dari teman sekelas tanpa diubah sedikit pun.",
  );
  sama("kalimat yang sama persis ditunjukkan", kalimat, ["Kalimat pertama ini disalin utuh dari teman sekelas tanpa diubah sedikit pun."]);

  const banyak = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, teks: `${tmpl} ${karangan(100 + i, 1500)}` }));
  banyak[50].teks = banyak[10].teks;
  const mulai = Date.now();
  const hBanyak = periksaPlagiasi(banyak);
  const lama = Date.now() - mulai;
  benar("120 kiriman × 1.500 kata selesai di bawah 4 detik", lama < 4000, `${lama} ms`);
  benar("salinan di tengah 120 kiriman tetap tertangkap", hBanyak.pasangan.some((p) => p.a === 11 && p.b === 51 && p.skor === 100));

  // ============================================================
  console.log("\n=== GERBANG PLAGIASI DAN NILAI YANG BERLAKU ===\n");
  // ============================================================
  const tinggi = { status: "tinggi", skor: 72, putusan: "" };
  sama("tahan: tidak dinilai AI", gerbangPlagiasi(tinggi, "tahan").lanjut, false);
  sama("nol: tidak dinilai AI", gerbangPlagiasi(tinggi, "nol"), { lanjut: false, tindakan: "nol", alasan: "Terindikasi plagiasi (kesamaan isi 72%); nilai 0 sampai ditinjau dosen." });
  sama("catat: tetap dinilai dengan catatan", gerbangPlagiasi(tinggi, "catat"), { lanjut: true, catatan: "Terindikasi plagiasi (kesamaan isi 72%)." });
  sama("diloloskan dosen: dinilai", gerbangPlagiasi({ ...tinggi, putusan: "lolos" }, "tahan").lanjut, true);
  sama("dinyatakan plagiasi: nol walau tindakan catat", gerbangPlagiasi({ ...tinggi, putusan: "plagiasi" }, "catat").lanjut, false);
  sama("kemiripan rendah: dinilai", gerbangPlagiasi({ status: "tinjau", skor: 30, putusan: "" }, "tahan").lanjut, true);
  sama("tindakan asing jatuh ke tahan", rapikanTindakan("hapus"), "tahan");
  benar("terindikasi hanya tinggi tanpa putusan lolos", terindikasi(tinggi) && !terindikasi({ ...tinggi, putusan: "lolos" }) && !terindikasi({ status: "tinjau", skor: 40, putusan: "" }));

  const dinilai = { status: "dinilai", nilai: 82.5 };
  sama("nilai asli bila bersih", nilaiEfektif({ ...dinilai, plagiasi: { status: "bersih", skor: 0, putusan: "" } }, "tahan"), { nilai: 82.5, keadaan: "dinilai", nol: false });
  sama("terindikasi + tahan: nilai disembunyikan", nilaiEfektif({ ...dinilai, plagiasi: tinggi }, "tahan"), { nilai: null, keadaan: "ditahan", nol: false });
  sama("terindikasi + nol: 0", nilaiEfektif({ ...dinilai, plagiasi: tinggi }, "nol"), { nilai: 0, keadaan: "dinilai", nol: true });
  sama("terindikasi + catat: nilai asli", nilaiEfektif({ ...dinilai, plagiasi: tinggi }, "catat").nilai, 82.5);
  sama("diloloskan: nilai asli kembali tanpa dinilai ulang", nilaiEfektif({ ...dinilai, plagiasi: { ...tinggi, putusan: "lolos" } }, "tahan").nilai, 82.5);
  sama("dinyatakan plagiasi: 0", nilaiEfektif({ ...dinilai, plagiasi: { ...tinggi, putusan: "plagiasi" } }, "catat").nilai, 0);
  sama("belum dinilai", nilaiEfektif({ status: "masuk", nilai: null, plagiasi: { status: "bersih", skor: 0, putusan: "" } }, "tahan").keadaan, "belum");

  sama("batas kritis bawaan 60", rapikanBatasKritis(undefined), 60);
  sama("batas kritis dikosongkan berarti bawaan, bukan 0", rapikanBatasKritis(""), 60);
  sama("batas kritis 0 tetap 0", rapikanBatasKritis(0), 0);
  sama("batas kritis dengan koma", rapikanBatasKritis("70,4"), 70);
  sama("batas kritis di luar 0–100 jatuh ke bawaan", rapikanBatasKritis(140), 60);
  benar("kritis: di bawah batas", nilaiKritis(59.99, 60) && !nilaiKritis(60, 60) && !nilaiKritis(null, 60));

  // ============================================================
  console.log("\n=== PAPAN NILAI (untuk semua orang) ===\n");
  // ============================================================
  const bersih = { status: "bersih", skor: 0, putusan: "" };
  const kiriman: KirimanPapan[] = [
    { id: 1, nama: "Budi", nim: "23702010200", status: "dinilai", nilai: 80.6, plagiasi: { ...tinggi, skor: 52, putusan: "lolos" } },
    { id: 2, nama: "Ani", nim: "23702010201", status: "dinilai", nilai: 80.6, plagiasi: bersih },
    { id: 3, nama: "Cici", nim: "23702010202", status: "dinilai", nilai: 55, plagiasi: bersih },
    { id: 4, nama: "Dedi", nim: "23702010203", status: "dinilai", nilai: 90, plagiasi: tinggi },
    { id: 5, nama: "Eka", nim: "23702010204", status: "dinilai", nilai: 75, plagiasi: { ...tinggi, putusan: "plagiasi" } },
    { id: 6, nama: "Fani", nim: "23702010205", status: "masuk", nilai: null, plagiasi: bersih },
    { id: 7, nama: "Gita", nim: "23702010206", status: "dinilai", nilai: 30, plagiasi: bersih, gerbangIsiLolos: false },
  ];
  const papan = susunPapan(kiriman, { batasKritis: 60, skala: SKALA_BAWAAN, tindakan: "tahan" });
  const baris = (id: number) => papan.baris.find((x) => x.baris === id)!;
  sama("diurutkan dari tertinggi, nilai sama berbagi peringkat",
    papan.baris.map((x) => [x.nama, x.peringkat]),
    [["Ani", 1], ["Budi", 1], ["Cici", 3], ["Gita", 4], ["Eka", 5], ["Dedi", null], ["Fani", null]]);
  sama("nilai dua desimal seperti laporan", baris(2).nilai, "80.60");
  benar("nilai di bawah batas kritis merah dan terkunci", baris(3).kritis && baris(3).terkunci);
  benar("nilai aman tidak terkunci", !baris(2).terkunci && !baris(2).kritis);
  sama("terindikasi + tahan: ditahan, tanpa nilai, ditandai", [baris(4).nilai, baris(4).keadaan, baris(4).penanda, baris(4).terkunci], [null, "Ditahan", "terindikasi", true]);
  sama("dinyatakan plagiasi: 0, merah, ditandai", [baris(5).nilai, baris(5).kritis, baris(5).penanda], ["0.00", true, "plagiasi"]);
  sama("diloloskan dosen: tanpa penanda", [baris(1).penanda, baris(1).terkunci], ["", false]);
  benar("tidak lolos gerbang isi: keterangan terkunci", baris(7).terkunci);
  sama("belum dinilai: tetap tercatat, tanpa peringkat", [baris(6).keadaan, baris(6).peringkat, baris(6).terkunci], ["Belum dinilai", null, false]);
  sama("NIM disamarkan di papan", baris(2).nimSamar, "2370•••••01");
  benar("papan tidak memuat kode kiriman atau isi keterangan", !JSON.stringify(papan).includes("SIPALING-TUGAS") && !JSON.stringify(papan).includes("ringkas\":\"Nilai"));
  // (80,6 + 80,6 + 55 + 30 + 0) ÷ 5; yang ditahan dan belum dinilai tidak ikut.
  sama("ringkasan papan", papan.ringkas, { dinilai: 5, rata: 49.24, tertinggi: 80.6, terendah: 0, kritis: 3, ditandai: 2 });
  const papanNol = susunPapan(kiriman, { batasKritis: 60, tindakan: "nol" });
  sama("tindakan nol: yang terindikasi tampil 0 dan merah", [papanNol.baris.find((x) => x.baris === 4)?.nilai, papanNol.baris.find((x) => x.baris === 4)?.kritis], ["0.00", true]);

  // ============================================================
  console.log("\n=== KETERANGAN (hanya untuk pemilik kode) ===\n");
  // ============================================================
  const rubrik: RubrikTugas = { nama: "R", kriteria: [{ nama: "Konsep", bobot: 50, deskripsi: "" }, { nama: "Kerapian", bobot: 50, deskripsi: "" }] };
  const hasil = {
    gerbang: { lolos: true, alasan: "" },
    kriteria: [{ urut: 0, skor: 70, capaian: "Konsep cukup jelas." }, { urut: 1, skor: 40, capaian: "Banyak salah ketik." }],
    perbaikan: [{ aspek: "Kerapian", uraian: "Periksa ejaan." }],
    catatan: "Lakukan penyuntingan akhir.",
    kelebihan: ["Topik relevan."], judul: "Kampanye Hijau",
  };
  const ketKritis = keteranganNilai({ nilai: 55, status: "dinilai", batasKritis: 60, rubrik, hasil, plagiasi: bersih });
  sama("ringkasan nilai kritis", ketKritis.ringkas, "Nilai 55.00 berada di bawah batas kritis 60.");
  memuat("kriteria yang menurunkan nilai disebut", JSON.stringify(ketKritis), "Kerapian (bobot 50%): skor 40. Banyak salah ketik.");
  benar("kriteria di atas batas tidak disebut sebagai penurun", !JSON.stringify(ketKritis.bagian[0]).includes("Konsep"));
  memuat("area perbaikan ikut", JSON.stringify(ketKritis), "Kerapian: Periksa ejaan.");
  sama("nada bahaya untuk nilai merah", ketKritis.nada, "bahaya");
  const ketPlagiasi = keteranganNilai({
    nilai: null, status: "ditahan", batasKritis: 60, rubrik, hasil: null, plagiasi: tinggi,
    kalimatSama: ["Kalimat yang sama. ".repeat(30)],
  });
  memuat("ditahan karena plagiasi", ketPlagiasi.ringkas, "Nilai ditahan: kiriman ini terindikasi plagiasi (72%");
  memuat("bukan putusan, ditinjau dosen", JSON.stringify(ketPlagiasi), "bukan putusan");
  benar("contoh kalimat dipendekkan", ketPlagiasi.bagian[1].isi[0].length <= 281 && ketPlagiasi.bagian[1].isi[0].endsWith("…"));
  const ketDiputus = keteranganNilai({ nilai: 0, status: "dinilai", batasKritis: 60, rubrik, hasil, plagiasi: { ...tinggi, putusan: "plagiasi" } });
  memuat("dinyatakan plagiasi", ketDiputus.ringkas, "dinyatakan PLAGIASI oleh dosen");
  const ketLolos = keteranganNilai({ nilai: 82, status: "dinilai", batasKritis: 60, rubrik, hasil, plagiasi: { ...tinggi, putusan: "lolos" } });
  memuat("diloloskan dosen: dijelaskan", JSON.stringify(ketLolos), "bukan plagiasi");
  sama("nilai aman: nada biasa", ketLolos.nada, "biasa");
  const ketGerbang = keteranganNilai({ nilai: 0, status: "dinilai", batasKritis: 60, rubrik, hasil: { ...hasil, gerbang: { lolos: false, alasan: "Hanya sampul tanpa isi." } }, plagiasi: bersih });
  memuat("tidak lolos gerbang isi: alasannya disebut", JSON.stringify(ketGerbang), "Hanya sampul tanpa isi.");

  // ============================================================
  console.log("\n=== LAPORAN PDF: ELEGAN, KODE KIRIMAN, KAKI SPF ===\n");
  // ============================================================
  sama("kaki laporan sesuai permintaan", KAKI_SPF, "Disusun menggunakan Software SPF");
  const an = analisisTemplate(uraiMarkdown(TEMPLATE_BAWAAN));
  memuat("template bawaan memuat baris Kode Kiriman", TEMPLATE_BAWAAN, "| **Kode Kiriman** |  |");
  sama("baris Kode Kiriman dikenali (bukan label asing)", an.labelAsing, []);
  const dasarData = {
    tugas: { mataKuliah: "Public Relations", nomor: "2", nama: "Proposal Program PR", dosen: "Dr. Contoh" },
    mahasiswa: { nama: "Cici", nim: "23702010202" }, rubrik, skala: SKALA_BAWAAN, hasil, status: "dinilai",
    tindakan: "tahan" as const, batasKritis: 60, dinilai: "2026-11-03T03:00:00Z", kode: "SIPALING-TUGAS-H7KQ3MXP",
  };
  const dataKritis = susunDataLaporan({ ...dasarData, plagiasi: bersih });
  sama("data laporan: nilai dari skor × bobot", dataKritis.nilai, 55);
  sama("data laporan: keterangan nilai kritis", dataKritis.keterangan, ["Nilai berada di bawah batas kritis 60."]);
  sama("data laporan: tanggal WIB", dataKritis.tanggal, "3 November 2026");
  const dataNol = susunDataLaporan({ ...dasarData, plagiasi: { ...tinggi, putusan: "plagiasi" } });
  sama("data laporan plagiasi: skor 0 tiap kriteria", [dataNol.nilai, dataNol.skor], [0, [0, 0]]);
  memuat("data laporan plagiasi: keterangan", (dataNol.keterangan ?? []).join(" "), "Dinyatakan PLAGIASI oleh dosen");
  const isi = JSON.stringify(isiTemplate(uraiMarkdown(TEMPLATE_BAWAAN), dataKritis));
  memuat("kode kiriman di tabel informasi", isi, "[\"Kode Kiriman\",\"SIPALING-TUGAS-H7KQ3MXP\"]");
  memuat("nilai akhir dalam kotak sorot", isi, "\"teks\":\"**NILAI AKHIR: 55.00 / 100**\",\"sorot\":\"nilai\"");
  memuat("keterangan dalam kotak bahaya", isi, "\"teks\":\"Nilai berada di bawah batas kritis 60.\",\"sorot\":\"bahaya\"");
  memuat("penanda {{kode}}", JSON.stringify(isiTemplate(uraiMarkdown("# Laporan {{kode}}"), dataKritis)), "Laporan SIPALING-TUGAS-H7KQ3MXP");
  const tanpaPredikat = JSON.stringify(isiTemplate(uraiMarkdown("# Laporan\n\nIsi bebas."), dataKritis));
  memuat("template tanpa predikat tetap memuat keterangan", tanpaPredikat, "Nilai berada di bawah batas kritis 60.");

  const pdf = buatLaporanPdf(TEMPLATE_BAWAAN, dataKritis, { kaki: KAKI_SPF });
  benar("PDF sah (xref)", xrefSah(pdf));
  const teks = await teksPdf(pdf);
  memuat("PDF: pita kepala", teks, "LAPORAN PENILAIAN TUGAS");
  memuat("PDF: kode kiriman", teks, "SIPALING-TUGAS-H7KQ3MXP");
  memuat("PDF: kaki SPF", teks, "Disusun menggunakan Software SPF");
  benar("PDF: tidak lagi menyebut bantuan AI", !/bantuan AI/i.test(teks));
  memuat("PDF: keterangan nilai kritis", teks, "Nilai berada di bawah batas kritis 60.");
  memuat("PDF: nilai akhir", teks, "NILAI AKHIR: 55.00 / 100");
  benar("PDF: tidak ada bintang Markdown tersisa", !teks.includes("*"));
  const mentah = Buffer.from(pdf).toString("latin1");
  benar("PDF berwarna (biru tua pita & kepala tabel)", mentah.includes("0.12 0.18 0.42 rg"));
  benar("PDF: jarak huruf pita dikembalikan ke 0", (mentah.match(/0\.6 Tc/g) ?? []).length === (mentah.match(/ 0 Tc ET/g) ?? []).length);
  sama("PDF: produsen", /\/Producer <FEFF[0-9A-F]+>/.test(mentah), true);

  // ============================================================
  console.log("\n=== SQL v54 DAN JALUR TERBUKA ===\n");
  // ============================================================
  const sqlV54 = readFileSync(join(__dirname, "supabase-update-v54-tugas-cbt.sql"), "utf8");
  for (const t of ["cbt_tasks", "cbt_task_submissions", "cbt_task_similarity", "drive_archives"]) {
    memuat(`SQL: ${t} dibuat aman diulang`, sqlV54, `CREATE TABLE IF NOT EXISTS public.${t}`);
    benar(`SQL: RLS ${t} dinyalakan`, new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`).test(sqlV54));
  }
  memuat("SQL: tautan arsip hanya Google Drive", sqlV54, "drive_url ~* '^https://(drive|docs)\\.google\\.com/'");
  memuat("SQL: satu NIM satu kiriman CBT", sqlV54, "WHERE source = 'cbt' AND nim <> ''");
  memuat("SQL: kode kiriman unik", sqlV54, "receipt            VARCHAR(40)  NOT NULL UNIQUE");
  const middleware = readFileSync(join(__dirname, "src/middleware.ts"), "utf8");
  benar("CSRF tetap menjaga jalur pengumpulan & papan", !/\/api\/cbt\/kumpul|\/api\/cbt\/papan|\/api\/arsip-drive/.test(middleware));
  const tautanPendek = readFileSync(join(__dirname, "src/app/s/[kode]/route.ts"), "utf8");
  memuat("tautan pendek memeriksa ulang tujuan Drive", tautanPendek, "tautanDriveSah(a.url)");
  const arsipDrive = readFileSync(join(__dirname, "src/app/api/arsip-drive/route.ts"), "utf8");
  memuat("hapus Arsip Drive hanya Super Admin", arsipDrive, 'if (profile.role !== "super_admin") return tolak("Hanya Super Admin');
  const papanRoute = readFileSync(join(__dirname, "src/app/api/cbt/papan/route.ts"), "utf8");
  memuat("papan: kode harus milik baris yang dibuka", papanRoute, "Number(body.baris) !== k.id");
  memuat("papan: tugas yang belum terbit tidak tampil", papanRoute, "if (!t || !t.published)");

  // ============================================================
  console.log(`\n${lulus} periksa lulus, ${gagal.length} gagal.`);
  if (gagal.length) {
    for (const g of gagal) console.log(`  ✕ ${g}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
