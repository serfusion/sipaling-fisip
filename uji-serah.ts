import { BAGIAN_PENYERAHAN, batasBagianMb, periksaBerkasBagian, MAKS_BAGIAN_MB, MAKS_FULL_MB } from "./src/lib/bukti-penyerahan";

let gagal = 0;
const ok = (n: string, s: boolean, i = "") => { console.log(`${s ? "  ✓" : "  ✗"} ${n}${i ? ` — ${i}` : ""}`); if (!s) gagal++; };
const berkas = (name: string, mb: number) => ({ name, size: Math.round(mb * 1024 * 1024) });

console.log("\n=== PEMERIKSA BERKAS PENYERAHAN ===\n");
ok("empat bagian terdaftar", BAGIAN_PENYERAHAN.length === 4,
   BAGIAN_PENYERAHAN.map(b => b.id).join(","));
ok("batas bagian biasa 10 MB", batasBagianMb("cover") === MAKS_BAGIAN_MB && MAKS_BAGIAN_MB === 10);
ok("batas berkas utuh lebih besar", batasBagianMb("full") === MAKS_FULL_MB && MAKS_FULL_MB === 25);

ok("PDF wajar diterima", periksaBerkasBagian("cover", berkas("cover.pdf", 2)).ok);
ok("berkas utuh 20 MB diterima", periksaBerkasBagian("full", berkas("skripsi.pdf", 20)).ok);

const kosong = periksaBerkasBagian("isi", null);
ok("berkas belum dipilih ditolak", !kosong.ok && kosong.pesan.includes("belum dipilih"),
   !kosong.ok ? kosong.pesan : "");

const bukanPdf = periksaBerkasBagian("cover", berkas("cover.docx", 1));
ok("bukan PDF ditolak", !bukanPdf.ok && bukanPdf.pesan.includes("harus PDF"));
ok("penolakan menyebut nama bagiannya", !bukanPdf.ok && bukanPdf.pesan.includes("Cover sampai daftar isi"),
   !bukanPdf.ok ? bukanPdf.pesan : "");

const kebesaran = periksaBerkasBagian("cover", berkas("cover.pdf", 14));
ok("bagian melebihi 10 MB ditolak", !kebesaran.ok);
ok("pesannya menyebut ukuran dan batasnya",
   !kebesaran.ok && kebesaran.pesan.includes("14.0 MB") && kebesaran.pesan.includes("10 MB"),
   !kebesaran.ok ? kebesaran.pesan.slice(0, 90) : "");
ok("pesannya memberi tahu sebab yang paling sering",
   !kebesaran.ok && /pindai|foto/i.test(kebesaran.pesan));

ok("berkas utuh 14 MB TIDAK ditolak", periksaBerkasBagian("full", berkas("skripsi.pdf", 14)).ok,
   "batasnya berbeda dari bagian biasa");
ok("berkas utuh 30 MB ditolak", !periksaBerkasBagian("full", berkas("skripsi.pdf", 30)).ok);

ok("huruf besar pada ekstensi tetap diterima", periksaBerkasBagian("cover", berkas("COVER.PDF", 1)).ok);
ok("nama tanpa ekstensi ditolak", !periksaBerkasBagian("cover", berkas("cover", 1)).ok);
ok("tepat di batas diterima", periksaBerkasBagian("cover", berkas("c.pdf", 10)).ok);
ok("sedikit di atas batas ditolak", !periksaBerkasBagian("cover", { name: "c.pdf", size: 10 * 1024 * 1024 + 1 }).ok);
ok("keterangan tiap bagian menyebut batasnya",
   BAGIAN_PENYERAHAN.every(b => b.keterangan.includes("MB")));

console.log(gagal ? `\n${gagal} UJI GAGAL\n` : "\nSEMUA UJI LULUS\n");
process.exit(gagal ? 1 : 0);
