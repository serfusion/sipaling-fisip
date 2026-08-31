import { susunAbstrak, tarikInti, namaApa, susunApa, kataKunci, nilaiKecocokan, dariOpenAlex, type Karya, type KaryaOpenAlex } from "./src/lib/referensi";

let gagal = 0;
const ok = (n: string, s: boolean, i = "") => {
  console.log(`${s ? "  ✓" : "  ✗"} ${n}${i ? ` — ${i}` : ""}`); if (!s) gagal++;
};

console.log("\n=== ABSTRAK TERBALIK ===\n");
ok("indeks terbalik disusun kembali",
   susunAbstrak({ "This": [0], "study": [1], "examines": [2], "literacy": [3] }) === "This study examines literacy",
   susunAbstrak({ "This": [0], "study": [1], "examines": [2], "literacy": [3] }));
ok("kata berulang di banyak posisi",
   susunAbstrak({ "the": [0, 2], "big": [1], "cat": [3] }) === "the big the cat");
ok("abstrak kosong aman", susunAbstrak(null) === "" && susunAbstrak(undefined) === "");
ok("posisi tidak masuk akal diabaikan",
   susunAbstrak({ "a": [0], "b": [999999] }) === "a");

console.log("\n=== INTI PENELITIAN ===\n");
const ABSTRAK = "Digital literacy has become central to civic life. This study examines the relationship between digital literacy and misinformation resilience among university students. Data were collected through a survey of 412 respondents in three Indonesian universities. Results show that digital literacy significantly predicts resilience to misinformation. These findings suggest that literacy training should begin in the first semester.";
const inti = tarikInti(ABSTRAK);
ok("tujuan ditarik", inti.some(i => i.bidang === "tujuan" && i.kalimat.includes("This study examines")));
ok("metode ditarik", inti.some(i => i.bidang === "metode" && i.kalimat.includes("survey of 412")));
ok("temuan ditarik", inti.some(i => i.bidang === "temuan" && i.kalimat.includes("Results show")));
ok("simpulan ditarik", inti.some(i => i.bidang === "simpulan" && i.kalimat.includes("findings suggest")));
ok("tiap kalimat dipakai sekali", new Set(inti.map(i => i.kalimat)).size === inti.length);
ok("urutan mengikuti alur artikel",
   inti.map(i => i.bidang).join(",") === "tujuan,metode,temuan,simpulan", inti.map(i => i.bidang).join(","));
ok("kalimat diambil apa adanya dari abstrak",
   inti.every(i => ABSTRAK.includes(i.kalimat)));
ok("abstrak tanpa penanda -> kosong",
   tarikInti("Some rambling text that contains none of the usual scholarly signposting whatsoever here.").length === 0);
ok("abstrak kosong aman", tarikInti("").length === 0);

console.log("\n=== GAYA APA ===\n");
ok("nama tunggal", namaApa("Sugiyono") === "Sugiyono", namaApa("Sugiyono"));
ok("nama dua bagian", namaApa("Andreas Kaplan") === "Kaplan, A.", namaApa("Andreas Kaplan"));
ok("nama tiga bagian", namaApa("Andreas M. Kaplan") === "Kaplan, A. M.", namaApa("Andreas M. Kaplan"));

const dasar = {
  id: "x", judul: "Users of the world, unite!", penulis: ["Andreas M. Kaplan", "Michael Haenlein"],
  tahun: 2010, jurnal: "Business Horizons", issn: null, doi: "10.1016/j.bushor.2009.09.003",
  sitasi: 9000, abstrak: "", bisaDiunduh: false, tautanUnduh: null, diDoaj: false,
  bahasa: "en", jenis: "article", volume: "53", nomor: "1", halaman: "59-68",
};
const apa = susunApa(dasar);
ok("dua penulis dipisah ampersand", apa.includes("Kaplan, A. M., & Haenlein, M."), apa);
ok("tanpa titik ganda setelah inisial", !apa.includes("M.. "), apa);
ok("judul bertanda seru tidak ditambahi titik", !apa.includes("unite!."), apa);
ok("terbitan lengkap", apa.includes("Business Horizons, 53(1), 59-68."));
ok("doi menjadi tautan", apa.includes("https://doi.org/10.1016/j.bushor.2009.09.003"));
ok("doi yang sudah berupa tautan tidak digandakan",
   !susunApa({ ...dasar, doi: "https://doi.org/10.1/x" }).includes("doi.org/https"));
ok("tanpa tahun ditandai t.t.", susunApa({ ...dasar, tahun: null }).includes("(t.t.)"));
ok("tanpa penulis tidak mengarang nama", susunApa({ ...dasar, penulis: [] }).includes("[Tanpa nama penulis]"));
ok("satu penulis tanpa ampersand", !susunApa({ ...dasar, penulis: ["Sugiyono"] }).includes("&"));

console.log("\n=== KATA KUNCI DAN PERINGKAT ===\n");
const kk = kataKunci("Bagaimana pengaruh literasi digital terhadap mahasiswa di Indonesia?");
ok("kata tugas dibuang", !kk.includes("yang") && !kk.includes("terhadap") && !kk.includes("bagaimana"), kk.join(","));
ok("kata isi disimpan", kk.includes("literasi") && kk.includes("digital") && kk.includes("mahasiswa"));

const buat = (o: Partial<Karya>): Karya => ({ ...dasar, inti: [], apa: "", ...o } as Karya);
const kunci = ["literasi", "digital"];
const judulCocok = buat({ judul: "Literasi digital mahasiswa", tahun: 2024, sitasi: 5 });
const judulTakCocok = buat({ judul: "Kajian pertanian modern", tahun: 2024, sitasi: 5 });
ok("judul yang cocok menang", nilaiKecocokan(judulCocok, kunci, 2026) > nilaiKecocokan(judulTakCocok, kunci, 2026));

// Di dalam jendela bawaan sepuluh tahun, yang lebih baru harus menang atas
// yang sedikit lebih tua walaupun sitasinya lebih banyak: mahasiswa umumnya
// diwajibkan memakai rujukan mutakhir. Karya lawas yang termasyhur tetap
// dapat muncul, tetapi hanya bila mahasiswa sendiri melebarkan rentang tahun.
const agakBaru = buat({ judul: "Literasi digital", tahun: 2024, sitasi: 10 });
const agakLama = buat({ judul: "Literasi digital", tahun: 2018, sitasi: 50 });
ok("di dalam jendela sepuluh tahun, yang lebih baru menang",
   nilaiKecocokan(agakBaru, kunci, 2026) > nilaiKecocokan(agakLama, kunci, 2026),
   `${nilaiKecocokan(agakBaru, kunci, 2026).toFixed(2)} vs ${nilaiKecocokan(agakLama, kunci, 2026).toFixed(2)}`);
ok("yang dapat diunduh sedikit diunggulkan",
   nilaiKecocokan(buat({ judul: "Literasi digital", tahun: 2024, bisaDiunduh: true }), kunci, 2026) >
   nilaiKecocokan(buat({ judul: "Literasi digital", tahun: 2024, bisaDiunduh: false }), kunci, 2026));


console.log("\n=== PEMETAAN DARI OPENALEX ===\n");

// Bentuk balasan OpenAlex yang sesungguhnya, lengkap dengan bidang bersarang.
const MUATAN: KaryaOpenAlex = {
  id: "https://openalex.org/W2100837269",
  doi: "https://doi.org/10.1016/j.bushor.2009.09.003",
  display_name: "Users of the world, unite! The challenges and opportunities of Social Media",
  publication_year: 2010,
  language: "en",
  type: "article",
  cited_by_count: 9421,
  abstract_inverted_index: { "This": [0], "study": [1], "examines": [2], "social": [3], "media": [4], "adoption": [5], "patterns": [6], "across": [7], "firms": [8], "worldwide": [9], "today": [10] },
  authorships: [
    { author: { display_name: "Andreas M. Kaplan" } },
    { author: { display_name: "Michael Haenlein" } },
  ],
  primary_location: {
    source: { display_name: "Business Horizons", issn_l: "0007-6813", is_in_doaj: false },
  },
  open_access: { is_oa: true, oa_url: "https://example.org/naskah.pdf" },
  biblio: { volume: "53", issue: "1", first_page: "59", last_page: "68" },
};

const k = dariOpenAlex(MUATAN)!;
ok("judul terpetakan", k.judul.startsWith("Users of the world"));
ok("penulis terpetakan", k.penulis.length === 2 && k.penulis[0] === "Andreas M. Kaplan");
ok("tahun, sitasi, bahasa terpetakan", k.tahun === 2010 && k.sitasi === 9421 && k.bahasa === "en");
ok("jurnal dan issn terpetakan", k.jurnal === "Business Horizons" && k.issn === "0007-6813");
ok("status unduh terpetakan", k.bisaDiunduh && k.tautanUnduh === "https://example.org/naskah.pdf");
ok("status doaj terpetakan", k.diDoaj === false);
ok("halaman digabung", k.halaman === "59-68", String(k.halaman));
ok("abstrak tersusun dari indeks terbalik", k.abstrak.startsWith("This study examines social media"), k.abstrak.slice(0, 40));
ok("inti ditarik dari abstrak hasil susunan", k.inti.some(i => i.bidang === "tujuan"));
ok("apa disusun lengkap", k.apa.includes("Kaplan, A. M., & Haenlein, M. (2010)") && k.apa.includes("Business Horizons, 53(1), 59-68"), k.apa);

// Catatan pincang: katalog sebesar OpenAlex selalu memuatnya.
const tanpaJurnal = dariOpenAlex({ ...MUATAN, primary_location: null })!;
ok("tanpa jurnal tidak meledak", tanpaJurnal.jurnal === "" && tanpaJurnal.issn === null);
ok("apa tanpa jurnal tetap sah", !tanpaJurnal.apa.includes("undefined") && !tanpaJurnal.apa.includes("null"), tanpaJurnal.apa);

const tanpaAbstrak = dariOpenAlex({ ...MUATAN, abstract_inverted_index: null })!;
ok("tanpa abstrak tidak meledak", tanpaAbstrak.abstrak === "" && tanpaAbstrak.inti.length === 0);

const tanpaBiblio = dariOpenAlex({ ...MUATAN, biblio: null })!;
ok("tanpa biblio tidak meledak", tanpaBiblio.volume === null && tanpaBiblio.halaman === null);
ok("apa tanpa biblio tetap sah", !tanpaBiblio.apa.includes("undefined"), tanpaBiblio.apa);

const halamanSama = dariOpenAlex({ ...MUATAN, biblio: { first_page: "12", last_page: "12" } })!;
ok("halaman tunggal tidak ditulis 12-12", halamanSama.halaman === "12", String(halamanSama.halaman));

const penulisRusak = dariOpenAlex({ ...MUATAN, authorships: [{ author: null }, { author: { display_name: "  " } }] })!;
ok("penulis kosong disaring", penulisRusak.penulis.length === 0);

ok("tanpa judul dibuang", dariOpenAlex({ ...MUATAN, display_name: null, title: null }) === null);
ok("muatan hampir kosong tidak meledak",
   dariOpenAlex({ display_name: "Judul saja" })?.judul === "Judul saja");
ok("penulis dibatasi supaya tidak berlebihan",
   (dariOpenAlex({ ...MUATAN, authorships: Array.from({ length: 60 }, (_, i) => ({ author: { display_name: `Penulis ${i}` } })) })?.penulis.length ?? 0) <= 25);

console.log(gagal ? `\n${gagal} UJI GAGAL\n` : "\nSEMUA UJI LULUS\n");
process.exit(gagal ? 1 : 0);
