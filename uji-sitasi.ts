import { uraiDaftar, uraiRujukan, kemiripanJudul, kenaliJenis, simpulkan, ringkas, dapatDiperiksa, type Temuan } from "./src/lib/citation-check";

let gagal = 0;
const ok = (n: string, s: boolean, info = "") => { console.log(`${s ? "  ✓" : "  ✗"} ${n}${info ? ` — ${info}` : ""}`); if (!s) gagal++; };

console.log("\n=== PENGURAI ===\n");

const daftar = `Sugiyono. (2019). Metode Penelitian Kuantitatif, Kualitatif, dan R&D. Bandung: Alfabeta.

Nasrullah, R. (2017). Media Sosial: Perspektif Komunikasi, Budaya, dan Sosioteknologi. Bandung:
    Simbiosa Rekatama Media.

Kaplan, A. M., & Haenlein, M. (2010). Users of the world, unite! The challenges and opportunities
    of Social Media. Business Horizons, 53(1), 59-68. https://doi.org/10.1016/j.bushor.2009.093.003

Putri, A. (2021). Pengaruh literasi digital terhadap penyebaran hoaks. Skripsi, Universitas
    Muhammadiyah Tangerang.

Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.

Kementerian Kominfo. (2023). Laporan literasi digital nasional. Diakses dari https://kominfo.go.id/laporan`;

const r = uraiDaftar(daftar);
ok("enam entri terurai", r.length === 6, `${r.length} entri`);
ok("indentasi gantung digabung", r[1].mentah.includes("Simbiosa"), r[1].mentah.slice(0, 60));
ok("DOI terambil", r[2].doi === "10.1016/j.bushor.2009.093.003", String(r[2].doi));
ok("tahun terambil", r[2].tahun === 2010, String(r[2].tahun));
ok("penulis pertama terambil", r[2].penulisPertama === "Kaplan", String(r[2].penulisPertama));
ok("judul terambil", (r[2].judul ?? "").startsWith("Users of the world"), String(r[2].judul).slice(0, 45));

console.log("\n=== JENIS RUJUKAN (yang paling menentukan) ===\n");
ok("buku dikenali", r[0].jenis === "buku", r[0].jenis);
ok("artikel jurnal dikenali", r[2].jenis === "artikel-jurnal", r[2].jenis);
ok("skripsi dikenali", r[3].jenis === "skripsi-tesis", r[3].jenis);
ok("peraturan dikenali", r[4].jenis === "peraturan", r[4].jenis);
ok("laman web dikenali", r[5].jenis === "laman-web", r[5].jenis);
ok("buku TIDAK diperiksa otomatis", !dapatDiperiksa("buku"));
ok("peraturan TIDAK diperiksa otomatis", !dapatDiperiksa("peraturan"));
ok("artikel jurnal diperiksa", dapatDiperiksa("artikel-jurnal"));

console.log("\n=== KEMIRIPAN JUDUL ===\n");
ok("judul identik = 1", kemiripanJudul("Users of the world, unite!", "Users of the world unite") === 1);
const beda = kemiripanJudul("Pengaruh literasi digital terhadap hoaks", "Dampak media sosial pada remaja");
ok("judul beda rendah", beda < 0.25, beda.toFixed(2));
const mirip = kemiripanJudul(
  "The challenges and opportunities of social media",
  "Users of the world, unite! The challenges and opportunities of Social Media");
ok("subjudul terpotong tetap mirip", mirip > 0.6, mirip.toFixed(2));

console.log("\n=== PUTUSAN ===\n");

const artikel = uraiRujukan("Kaplan, A. M. (2010). Users of the world unite. Business Horizons, 53(1), 59-68.", 1);

const cocok: Temuan = { judul: "Users of the world, unite! ", tahun: 2010, penulisPertama: "Kaplan", doi: "10.1016/x", sumber: "Crossref", kemiripanJudul: 0.95 };
ok("cocok penuh -> terverifikasi", simpulkan(artikel, cocok).putusan === "terverifikasi");

const tahunBeda: Temuan = { ...cocok, tahun: 2015 };
const h2 = simpulkan(artikel, tahunBeda);
ok("tahun beda -> beda-rincian", h2.putusan === "beda-rincian", h2.selisih[0]);

const penulisBeda: Temuan = { ...cocok, penulisPertama: "Wijaya" };
ok("penulis beda -> beda-rincian", simpulkan(artikel, penulisBeda).putusan === "beda-rincian");

const h4 = simpulkan(artikel, null);
ok("tidak ada kandidat -> tidak-ditemukan", h4.putusan === "tidak-ditemukan");
ok("pesan tidak menuduh mahasiswa", !h4.pesan.toLowerCase().includes("palsu") && !h4.pesan.toLowerCase().includes("memalsukan"), h4.pesan.slice(0, 60));

const buku = uraiRujukan("Sugiyono. (2019). Metode Penelitian Kuantitatif. Bandung: Alfabeta.", 2);
const h5 = simpulkan(buku, null);
ok("BUKU tidak ditemukan -> tak-dapat-diperiksa, BUKAN tuduhan", h5.putusan === "tak-dapat-diperiksa", h5.pesan.slice(0, 50));

const h6 = simpulkan(artikel, null, true);
ok("jaringan gagal -> tak-dapat-diperiksa", h6.putusan === "tak-dapat-diperiksa");
ok("jaringan gagal dinyatakan bukan bukti", h6.pesan.includes("bukan tanda apa pun"));

console.log("\n=== RINGKASAN ===\n");
const ring = ringkas([simpulkan(artikel, cocok), h4, h5]);
ok("ringkasan menghitung benar", ring.terverifikasi === 1 && ring.tidakDitemukan === 1 && ring.takDapatDiperiksa === 1,
   `${ring.terverifikasi}/${ring.tidakDitemukan}/${ring.takDapatDiperiksa}`);
ok("ringkasan tidak memakai kata menuduh",
   !JSON.stringify(ring).toLowerCase().includes("palsu"), ring.pesan);

console.log("\n=== KEPASTIAN PUTUSAN ===\n");
{
  const rujukan = uraiDaftar(
    "Wijaya, B. S. (2021). Kerangka literasi algoritmik untuk mahasiswa Asia Tenggara. Jurnal Komunikasi Digital, 14(3), 201-219."
  )[0];

  // Judul cocok 100%, tahun dan penulis cocok.
  const persis = { judul: "Kerangka literasi algoritmik untuk mahasiswa Asia Tenggara", tahun: 2021,
    penulisPertama: "Wijaya", doi: "10.1/x", sumber: "Crossref" as const, kemiripanJudul: 1 };
  ok("judul persis -> terverifikasi", simpulkan(rujukan, persis).putusan === "terverifikasi");

  // Inilah yang dulu keliru: kemiripan di antara ambang kuat dan 95%,
  // tahun dan penulis cocok, tetapi selalu jatuh ke "beda rincian".
  for (const m of [0.83, 0.86, 0.9, 0.94]) {
    const h = simpulkan(rujukan, { ...persis, kemiripanJudul: m });
    ok(`kemiripan ${m} dengan tahun & penulis cocok -> terverifikasi`,
       h.putusan === "terverifikasi", `${h.putusan}, catatan: ${h.catatan.length}`);
  }

  // Kemiripan judul yang tidak persis menjadi catatan, bukan selisih.
  const c = simpulkan(rujukan, { ...persis, kemiripanJudul: 0.9 });
  ok("kemiripan tak persis jadi catatan, bukan selisih", c.selisih.length === 0 && c.catatan.length === 1,
     `selisih=${c.selisih.length} catatan=${c.catatan.length}`);

  // Selisih sungguhan tetap menurunkan putusan.
  ok("tahun beda -> beda rincian",
     simpulkan(rujukan, { ...persis, tahun: 2019 }).putusan === "beda-rincian");
  ok("penulis beda -> beda rincian",
     simpulkan(rujukan, { ...persis, penulisPertama: "Nugroho" }).putusan === "beda-rincian");

  // Sumber mana pun, putusan harus sama bila metadatanya sama.
  const dariCrossref = simpulkan(rujukan, { ...persis, kemiripanJudul: 0.88, sumber: "Crossref" as const });
  const dariOpenAlex = simpulkan(rujukan, { ...persis, kemiripanJudul: 0.88, sumber: "OpenAlex" as const });
  ok("sumber tidak mengubah putusan", dariCrossref.putusan === dariOpenAlex.putusan,
     `${dariCrossref.putusan} vs ${dariOpenAlex.putusan}`);

  // Diulang berkali-kali harus tetap sama.
  const berulang = new Set(Array.from({ length: 30 }, () =>
    simpulkan(rujukan, { ...persis, kemiripanJudul: 0.88 }).putusan));
  ok("tiga puluh kali pemeriksaan -> satu putusan", berulang.size === 1, [...berulang].join(","));

  // Di bawah ambang lemah tetap tidak ditemukan.
  ok("kemiripan 0.4 -> tidak ditemukan",
     simpulkan(rujukan, { ...persis, kemiripanJudul: 0.4 }).putusan === "tidak-ditemukan");
  ok("tanpa kandidat -> tidak ditemukan", simpulkan(rujukan, null).putusan === "tidak-ditemukan");
  ok("jaringan gagal -> tak dapat diperiksa",
     simpulkan(rujukan, null, true).putusan === "tak-dapat-diperiksa");
}

console.log(gagal === 0 ? "\nSEMUA UJI LULUS\n" : `\n${gagal} UJI GAGAL\n`);
process.exit(gagal === 0 ? 0 : 1);
