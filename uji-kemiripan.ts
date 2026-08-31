import {
  bandingkanSumber, periksaSitasi, ujiParafrase, ambilSitasi, ambilRujukan,
} from "./src/lib/kemiripan";

let gagal = 0;
const ok = (n: string, s: boolean, i = "") => {
  console.log(`${s ? "  ✓" : "  ✗"} ${n}${i ? ` — ${i}` : ""}`); if (!s) gagal++;
};

console.log("\n=== KEMIRIPAN DENGAN SUMBER ===\n");

const SUMBER = `Literasi digital merupakan kemampuan individu untuk menggunakan teknologi informasi dan komunikasi secara efektif dalam mencari, mengevaluasi, dan membuat informasi. Kemampuan ini menjadi semakin penting seiring meningkatnya arus informasi yang diterima masyarakat setiap hari.`;

// Disalin utuh.
const SALIN = `Menurut kajian terdahulu, literasi digital merupakan kemampuan individu untuk menggunakan teknologi informasi dan komunikasi secara efektif dalam mencari, mengevaluasi, dan membuat informasi.`;
const h1 = bandingkanSumber(SALIN, [{ nama: "Sumber A", teks: SUMBER }]);
ok("salinan utuh terdeteksi", h1.persenGabungan > 60, `${h1.persenGabungan}%`);
ok("rentang salinan dilaporkan", h1.perSumber[0].rentang.length > 0 &&
   h1.perSumber[0].rentang[0].jumlahKata >= 8, `${h1.perSumber[0].rentang[0]?.jumlahKata} kata`);

// Ditulis ulang sungguhan.
const TULIS_ULANG = `Kecakapan warga dalam memanfaatkan perangkat digital kini menentukan seberapa baik mereka memilah kabar yang benar dari yang menyesatkan. Tanpa bekal itu, derasnya kabar harian justru membuat orang lebih mudah tersesat.`;
const h2 = bandingkanSumber(TULIS_ULANG, [{ nama: "Sumber A", teks: SUMBER }]);
ok("tulisan sendiri tidak dituduh", h2.persenGabungan === 0, `${h2.persenGabungan}%`);

// Kutipan langsung yang ditandai benar dihitung terpisah.
const DIKUTIP = `Ia menulis, “literasi digital merupakan kemampuan individu untuk menggunakan teknologi informasi dan komunikasi secara efektif dalam mencari, mengevaluasi, dan membuat informasi” dalam bukunya.`;
const h3 = bandingkanSumber(DIKUTIP, [{ nama: "Sumber A", teks: SUMBER }]);
ok("kutipan bertanda dipisahkan dari kemiripan telanjang",
   h3.persenGabungan > 0 && h3.persenTanpaKutipan < h3.persenGabungan,
   `gabungan ${h3.persenGabungan}% vs tanpa kutipan ${h3.persenTanpaKutipan}%`);

// Naskah kosong tidak boleh meledak.
const h4 = bandingkanSumber("", [{ nama: "A", teks: SUMBER }]);
ok("naskah kosong aman", h4.persenGabungan === 0 && h4.jumlahKataNaskah === 0);
ok("tanpa sumber aman", bandingkanSumber(SALIN, []).persenGabungan === 0);

// Pengulangan internal antar bab.
const jauh = "kata ".repeat(200);
const ULANG = `Teori difusi inovasi menjelaskan bagaimana gagasan baru menyebar di dalam masyarakat luas. ${jauh} Teori difusi inovasi menjelaskan bagaimana gagasan baru menyebar di dalam masyarakat luas.`;
const h5 = bandingkanSumber(ULANG, []);
ok("bab yang disalin ke bab lain terdeteksi", h5.pengulanganInternal.length > 0,
   `${h5.pengulanganInternal[0]?.jumlahKata ?? 0} kata`);
const h6 = bandingkanSumber("Kalimat pertama yang biasa saja. Kalimat kedua yang juga biasa saja.", []);
ok("naskah wajar tidak dianggap mengulang", h6.pengulanganInternal.length === 0);

console.log("\n=== SITASI ===\n");

const NASKAH_BENAR = `Literasi digital berkembang pesat (Sugiyono, 2019). Kaplan dan Haenlein (2010) menyebutnya sebagai kemampuan dasar. Menurut aturan yang berlaku (Undang-Undang Nomor 27 Tahun 2022), data pribadi dilindungi.`;
const PUSTAKA_BENAR = `Sugiyono. (2019). Metode Penelitian Kuantitatif, Kualitatif, dan R&D. Bandung: Alfabeta.
Kaplan, A. M., & Haenlein, M. (2010). Users of the world, unite! Business Horizons, 53(1), 59-68.`;

const t1 = periksaSitasi(NASKAH_BENAR, PUSTAKA_BENAR);
ok("naskah yang benar tidak menghasilkan tuduhan", t1.length === 0,
   t1.map(t => `${t.jenis}: ${t.kutipan}`).join(" | ") || "bersih");

const s = ambilSitasi(NASKAH_BENAR);
ok("sitasi kurung dikenali", s.some(x => x.nama === "sugiyono" && x.tahun === "2019"));
ok("sitasi naratif dikenali", s.some(x => x.nama === "kaplan" && x.tahun === "2010"),
   s.map(x => `${x.nama}/${x.tahun}`).join(", "));
ok("undang-undang bukan sitasi penulis", !s.some(x => x.nama.includes("undang")),
   s.map(x => x.nama).join(", "));
ok("rujukan terurai", ambilRujukan(PUSTAKA_BENAR).length === 2);

const t2 = periksaSitasi(`Hal ini dijelaskan lebih jauh (Nugroho, 2021).`, PUSTAKA_BENAR);
ok("sitasi tanpa entri ditandai", t2.some(t => t.jenis === "sitasi-tanpa-rujukan"));
ok("rujukan tak disitasi ditandai", t2.some(t => t.jenis === "rujukan-tak-disitasi"));

const t3 = periksaSitasi(`Beliau menegaskan, “informasi harus diverifikasi sebelum dibagikan kepada orang lain” (Sugiyono, 2019).`, PUSTAKA_BENAR);
ok("kutipan langsung tanpa halaman ditandai", t3.some(t => t.jenis === "kutipan-tanpa-halaman"));

const t4 = periksaSitasi(`Beliau menegaskan, “informasi harus diverifikasi sebelum dibagikan kepada orang lain” (Sugiyono, 2019, hlm. 45).`, PUSTAKA_BENAR);
ok("kutipan dengan halaman TIDAK ditandai", !t4.some(t => t.jenis === "kutipan-tanpa-halaman"),
   t4.map(t => t.jenis).join(",") || "bersih");

const t5 = periksaSitasi(`Beliau menegaskan, “informasi harus diverifikasi sebelum dibagikan kepada siapa pun” (Sugiyono, 2019: 45).`, PUSTAKA_BENAR);
ok("gaya halaman titik dua juga diterima", !t5.some(t => t.jenis === "kutipan-tanpa-halaman"));

const t6 = periksaSitasi(`Ia berkata “${"kata ".repeat(30)}” lalu selesai.`, "");
ok("kutipan berlebih ditandai", t6.some(t => t.jenis === "kutipan-berlebih"));
ok("tanpa daftar pustaka, sitasi tidak dituduh yatim",
   !periksaSitasi(NASKAH_BENAR, "").some(t => t.jenis === "sitasi-tanpa-rujukan"));

console.log("\n=== UJI PARAFRASE ===\n");

const ASLI = "Literasi digital merupakan kemampuan individu untuk menggunakan teknologi informasi secara efektif dalam kehidupan sehari-hari.";

const p1 = ujiParafrase(ASLI, "Literasi digital merupakan kemampuan individu untuk menggunakan teknologi informasi secara efektif dalam kehidupan sehari-hari.");
ok("salinan persis -> salin", p1?.putusan === "salin", p1?.putusan);

const p2 = ujiParafrase(ASLI, "Literasi digital adalah kecakapan seseorang untuk memakai teknologi informasi secara efisien pada kehidupan sehari-hari.");
ok("tukar sinonim urutan tetap -> tukar-sinonim", p2?.putusan === "tukar-sinonim",
   `${p2?.putusan} (${p2?.persenKataSama}% sama, urutan ${p2?.urutanTerjaga}%)`);

const p3 = ujiParafrase(ASLI, "Dalam keseharian, seseorang disebut cakap secara digital bila ia sanggup memanfaatkan perangkat teknologi dengan tepat guna.");
ok("susunan diubah -> parafrase baik", p3?.putusan === "parafrase-baik",
   `${p3?.putusan} (${p3?.persenKataSama}% sama, deret ${p3?.runTerpanjang})`);

ok("teks terlalu pendek dikembalikan null", ujiParafrase("dua kata", "tiga kata saja") === null);
ok("tiap putusan memberi saran", [p1, p2, p3].every(p => (p?.saran.length ?? 0) > 0));

console.log(gagal ? `\n${gagal} UJI GAGAL\n` : "\nSEMUA UJI LULUS\n");
process.exit(gagal ? 1 : 0);
