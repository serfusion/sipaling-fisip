import { periksaInggris, petakanNaskah } from "./src/lib/manuscript";

let gagal = 0;
const ok = (n: string, s: boolean, i = "") => { console.log(`${s ? "  ✓" : "  ✗"} ${n}${i ? ` — ${i}` : ""}`); if (!s) gagal++; };

console.log("\n=== PEMERIKSA INGGRIS ===\n");

const buruk = `In this modern era, social media cannot be separated from human being daily life. As we know, many experts say that digital literacy is very important. In this research, the researcher want to do a research about it. Based on the explanation above, this study proves that literacy clearly shows a positive effect. The result give impact to society.`;
const r = periksaInggris(buruk);
const punya = (frasa: string) => r.temuan.some((t) => t.kutipan.toLowerCase().includes(frasa));

ok('"in this modern era" tertangkap', punya("modern era"));
ok('"cannot be separated from" tertangkap', punya("cannot be separated"));
ok('"as we know" tertangkap', punya("as we know"));
ok('"many experts say" tertangkap', punya("many experts say"));
ok('"do a research" tertangkap', punya("research"), r.temuan.filter(t => t.kutipan.includes("research")).map(t=>t.kutipan).join(" | "));
ok('"based on the explanation above" tertangkap', punya("explanation above"));
ok('"proves" tertangkap sebagai klaim mutlak',
   r.temuan.some((t) => t.aturan === "Klaim terlalu kuat" && /prove/i.test(t.kutipan)));
ok('"clearly shows" tertangkap', punya("clearly shows"));
ok('"give impact to" tertangkap', punya("give impact"));
ok('"very important" tertangkap', punya("very important"));
ok("delapan aturan atau lebih menyala", r.perAturan.length >= 2, r.perAturan.map(a=>`${a.aturan}:${a.jumlah}`).join(" | "));

const bagus = `This study examines the relationship between digital literacy and misinformation resilience among undergraduate students. Survey data were collected from 247 respondents at a private university in Banten Province. The results indicate a moderate negative association between literacy scores and susceptibility to false claims. These findings are consistent with earlier work by Nasrullah (2017), although the effect size observed here is smaller.`;
const rb = periksaInggris(bagus);
ok("naskah yang baik nyaris bersih",
   rb.temuan.filter((t) => t.berat === "ganti").length === 0,
   rb.temuan.map((t) => `${t.aturan}:"${t.kutipan}"`).join(" | ") || "bersih");
ok("kadar pasif dihitung", rb.kalimatPasifPersen > 0 && rb.kalimatPasifPersen <= 100, `${rb.kalimatPasifPersen}%`);

const bertele = periksaInggris("In order to analyse the data, due to the fact that the sample is able to represent the population.");
ok("frasa bertele-tele tertangkap",
   bertele.temuan.filter((t) => t.aturan === "Bertele-tele").length === 3,
   bertele.temuan.filter(t=>t.aturan==="Bertele-tele").map(t=>t.kutipan).join(" | "));

console.log("\n=== PEMETA BAB → IMRaD ===\n");

const skripsi = `BAB I PENDAHULUAN
1.1 Latar Belakang
${"kata ".repeat(1200)}
1.2 Rumusan Masalah
${"kata ".repeat(150)}
1.3 Tujuan Penelitian
${"kata ".repeat(120)}
1.4 Manfaat Penelitian
${"kata ".repeat(200)}
1.5 Sistematika Penulisan
${"kata ".repeat(300)}
BAB II TINJAUAN PUSTAKA
2.1 Landasan Teori
${"kata ".repeat(4500)}
2.2 Penelitian Terdahulu
${"kata ".repeat(900)}
2.3 Kerangka Pemikiran
${"kata ".repeat(400)}
BAB III METODE PENELITIAN
3.1 Populasi dan Sampel
${"kata ".repeat(600)}
3.2 Teknik Analisis Data
${"kata ".repeat(700)}
BAB IV HASIL PENELITIAN
${"kata ".repeat(2600)}
4.2 Pembahasan
${"kata ".repeat(1800)}
BAB V KESIMPULAN
${"kata ".repeat(500)}
5.2 Saran
${"kata ".repeat(300)}
DAFTAR PUSTAKA
${"kata ".repeat(1500)}`;

const p = petakanNaskah(skripsi, 7000);
const cari = (frasa: string) => p.bagian.find((b) => b.judul.toLowerCase().includes(frasa));

ok("latar belakang -> introduction", cari("latar belakang")?.bagian === "introduction");
ok("landasan teori -> literature", cari("landasan teori")?.bagian === "literature");
ok("penelitian terdahulu -> literature", cari("terdahulu")?.bagian === "literature");
ok("populasi -> methods", cari("populasi")?.bagian === "methods");
ok("hasil -> results", cari("hasil")?.bagian === "results");
ok("pembahasan -> discussion", cari("pembahasan")?.bagian === "discussion");
ok("saran -> conclusion", cari("saran")?.bagian === "conclusion");
ok("SISTEMATIKA PENULISAN dibuang", cari("sistematika")?.bagian === "dibuang", cari("sistematika")?.catatan);
ok("MANFAAT PENELITIAN dibuang", cari("manfaat")?.bagian === "dibuang");
ok("DAFTAR PUSTAKA dibuang", cari("daftar pustaka")?.bagian === "dibuang");

ok("target bagian dibuang = 0", cari("sistematika")?.targetKata === 0);
ok("pemampatan besar terhitung", p.pemampatan > 0.5, `${Math.round(p.pemampatan * 100)}% dipangkas`);
ok("landasan teori dipangkas paling banyak",
   (cari("landasan teori")?.targetKata ?? 99999) < (cari("landasan teori")?.jumlahKata ?? 0) / 4,
   `${cari("landasan teori")?.jumlahKata} -> ${cari("landasan teori")?.targetKata} kata`);
ok("total target mendekati 7000", Math.abs(p.totalKataTarget - 7000) < 900, `${p.totalKataTarget} kata`);

console.log(gagal === 0 ? "\nSEMUA UJI LULUS\n" : `\n${gagal} UJI GAGAL\n`);
process.exit(gagal === 0 ? 0 : 1);
