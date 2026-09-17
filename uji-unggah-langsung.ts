// Uji jalur unggah langsung: bentuk jalur transit, tanda tangannya,
// pembacaan formulir, dan penyapu ruang transit.
//
// Seluruhnya berjalan tanpa Supabase maupun basis data.
process.env.UNGGAH_SECRET = process.env.UNGGAH_SECRET || "rahasia-untuk-uji-saja";

import {
  BATAS_AMAN_MULTIPART,
  hariTransit,
  jalurTransit,
  jalurTransitSah,
  isFolderTransit,
  muatLewatServerless,
  namaJalurAman,
  totalBita,
} from "./src/lib/unggah-langsung";
import { izinkanJalur, periksaKlaimJalur, tandaiJalur } from "./src/lib/unggah-tanda";
import { bacaBagianDariForm } from "./src/lib/unggah-klaim";
import { hariKedaluwarsa, sapuTransit } from "./src/lib/sapu-transit";
import { BAGIAN_PENYERAHAN } from "./src/lib/bukti-penyerahan";
import { pesanStatusHttp } from "./src/lib/pesan-http";

let gagal = 0;
const ok = (n: string, s: boolean, i = "") => {
  console.log(`${s ? "  ✓" : "  ✗"} ${n}${i ? ` — ${i}` : ""}`);
  if (!s) gagal++;
};

// ------------------------------------------------------------
console.log("\n=== BENTUK JALUR TRANSIT ===\n");

const jalur = jalurTransit("requests", "cover", "Cover Skripsi Fitri.pdf");
ok("jalur berada di folder transit", jalur.startsWith("requests/transit/"), jalur);
ok("jalur memuat tanggal hari ini", jalur.includes(hariTransit()));
ok("jalur diakui sah", jalurTransitSah(jalur, "requests"));
ok("jalur requests tidak diakui milik revisions", !jalurTransitSah(jalur, "revisions"));
ok("jalur revisions punya bentuknya sendiri",
   jalurTransitSah(jalurTransit("revisions", "full", "skripsi.pdf"), "revisions"));

ok("nama berkas dibersihkan", namaJalurAman("Skripsi/../../rahasia .pdf").indexOf("/") === -1,
   namaJalurAman("Skripsi/../../rahasia .pdf"));
ok("nama kosong tetap menghasilkan sesuatu", namaJalurAman("   .pdf") === "dokumen",
   namaJalurAman("   .pdf"));
ok("dua jalur berturut-turut tidak pernah sama",
   jalurTransit("requests", "isi", "a.pdf") !== jalurTransit("requests", "isi", "a.pdf"));

ok("jalur di luar folder transit ditolak",
   !jalurTransitSah("requests/SIPALING-PERPUS-123/berkas.pdf", "requests"));
ok("jalur dengan titik ganda ditolak",
   !jalurTransitSah("requests/transit/2026-09-17/../../rahasia.pdf", "requests"));
ok("jalur bukan PDF ditolak",
   !jalurTransitSah(`requests/transit/${hariTransit()}/${crypto.randomUUID()}-cover-a.docx`, "requests"));
ok("jalur kosong ditolak", !jalurTransitSah("", "requests"));
ok("folder yang dikenal hanya requests dan revisions",
   isFolderTransit("requests") && isFolderTransit("revisions") && !isFolderTransit("proposals"));

// ------------------------------------------------------------
console.log("\n=== TANDA TANGAN JALUR ===\n");

const izin = izinkanJalur(jalur);
ok("izin baru berlaku", periksaKlaimJalur({ jalur, folder: "requests", ...izin }).ok);
ok("izin berumur sekitar dua jam",
   izin.kedaluwarsa - Date.now() > 100 * 60_000 && izin.kedaluwarsa - Date.now() <= 120 * 60_000);

const tandaSalah = periksaKlaimJalur({ jalur, folder: "requests", tanda: "palsu", kedaluwarsa: izin.kedaluwarsa });
ok("tanda tangan karangan ditolak", !tandaSalah.ok);
ok("penolakannya menyuruh memilih ulang", !tandaSalah.ok && /pilih ulang/i.test(tandaSalah.pesan),
   !tandaSalah.ok ? tandaSalah.pesan : "");

const jalurLain = jalurTransit("requests", "cover", "punya-orang-lain.pdf");
ok("tanda tangan milik jalur lain tidak berlaku di jalur ini",
   !periksaKlaimJalur({ jalur: jalurLain, folder: "requests", ...izin }).ok);

const kadaluwarsa = Date.now() - 1000;
ok("izin yang sudah lewat waktunya ditolak",
   !periksaKlaimJalur({ jalur, folder: "requests", tanda: tandaiJalur(jalur, kadaluwarsa), kedaluwarsa: kadaluwarsa }).ok);
ok("memperpanjang waktu tanpa menandatangani ulang tidak berhasil",
   !periksaKlaimJalur({ jalur, folder: "requests", tanda: izin.tanda, kedaluwarsa: izin.kedaluwarsa + 60_000 }).ok);
ok("tanda tangan requests tidak dapat dipakai di formulir revisi",
   !periksaKlaimJalur({ jalur, folder: "revisions", ...izin }).ok);

// ------------------------------------------------------------
console.log("\n=== MEMBACA FORMULIR ===\n");

function formLengkap(ubah: (f: FormData, izinPer: Record<string, { jalur: string; tanda: string; kedaluwarsa: number }>) => void = () => {}) {
  const f = new FormData();
  const semua: Record<string, { jalur: string; tanda: string; kedaluwarsa: number }> = {};
  for (const b of BAGIAN_PENYERAHAN) {
    const j = jalurTransit("requests", b.id, `${b.id}.pdf`);
    const z = izinkanJalur(j);
    semua[b.id] = { jalur: j, ...z };
    f.set(`bagian_${b.id}_jalur`, j);
    f.set(`bagian_${b.id}_tanda`, z.tanda);
    f.set(`bagian_${b.id}_kedaluwarsa`, String(z.kedaluwarsa));
    f.set(`bagian_${b.id}_nama`, `${b.id}.pdf`);
    f.set(`bagian_${b.id}_ukuran`, String(2 * 1024 * 1024));
  }
  ubah(f, semua);
  return f;
}

const baik = bacaBagianDariForm(formLengkap(), "requests", BAGIAN_PENYERAHAN);
ok("empat bagian terbaca", baik.ok && baik.daftar.length === 4);
ok("urutannya mengikuti daftar bagian",
   baik.ok && baik.daftar.map((b) => b.id).join(",") === BAGIAN_PENYERAHAN.map((b) => b.id).join(","));
ok("semuanya ditandai sebagai jalur transit", baik.ok && baik.daftar.every((b) => b.transit && !b.berkas));
ok("seluruh jalurnya masuk daftar sapu", baik.sapu.length === 4);

const tanpaSatu = bacaBagianDariForm(
  formLengkap((f) => { f.delete("bagian_full_jalur"); }),
  "requests",
  BAGIAN_PENYERAHAN,
);
ok("bagian yang hilang ditolak", !tanpaSatu.ok);
ok("penolakannya menyebut bagian mana", !tanpaSatu.ok && tanpaSatu.pesan.includes("Skripsi full"),
   !tanpaSatu.ok ? tanpaSatu.pesan : "");

const dipalsukan = bacaBagianDariForm(
  formLengkap((f) => { f.set("bagian_isi_tanda", "tanda-karangan"); }),
  "requests",
  BAGIAN_PENYERAHAN,
);
ok("satu tanda tangan palsu menggagalkan seluruh kiriman", !dipalsukan.ok);
ok("jalur yang tanda tangannya gagal TIDAK ikut disapu",
   !dipalsukan.ok && dipalsukan.sapu.length === 1,
   `disapu: ${dipalsukan.sapu.length}`);

const kebesaran = bacaBagianDariForm(
  formLengkap((f) => { f.set("bagian_cover_ukuran", String(14 * 1024 * 1024)); }),
  "requests",
  BAGIAN_PENYERAHAN,
);
ok("ukuran di atas batas bagian ditolak", !kebesaran.ok);
ok("berkas utuh 20 MB tetap diterima",
   bacaBagianDariForm(
     formLengkap((f) => { f.set("bagian_full_ukuran", String(20 * 1024 * 1024)); }),
     "requests",
     BAGIAN_PENYERAHAN,
   ).ok);

const namaBukanPdf = bacaBagianDariForm(
  formLengkap((f) => { f.set("bagian_pustaka_nama", "pustaka.docx"); }),
  "requests",
  BAGIAN_PENYERAHAN,
);
ok("nama berkas bukan PDF ditolak", !namaBukanPdf.ok);

// Jalur cadangan: berkasnya ikut di badan permintaan, seperti versi lama.
const pdf = (nama: string, mb: number) =>
  new File([new Uint8Array(Math.round(mb * 1024 * 1024))], nama, { type: "application/pdf" });
const formLama = new FormData();
for (const b of BAGIAN_PENYERAHAN) formLama.set(`bagian_${b.id}`, pdf(`${b.id}.pdf`, 0.2));
const lama = bacaBagianDariForm(formLama, "requests", BAGIAN_PENYERAHAN);
ok("kiriman lama yang membawa berkasnya tetap dilayani", lama.ok && lama.daftar.length === 4);
ok("kiriman lama tidak meninggalkan jalur transit", lama.sapu.length === 0);
ok("kiriman lama membawa File, bukan jalur", lama.ok && lama.daftar.every((b) => b.berkas && !b.transit));

// ------------------------------------------------------------
console.log("\n=== BATAS FUNGSI SERVERLESS ===\n");

ok("empat berkas kecil masih muat lewat jalur cadangan",
   muatLewatServerless([pdf("a.pdf", 0.5), pdf("b.pdf", 0.5)]).ok);
const terlaluBesar = muatLewatServerless([pdf("a.pdf", 3), pdf("b.pdf", 3)]);
ok("enam MB TIDAK muat lewat jalur cadangan", !terlaluBesar.ok);
ok("pesannya menyebut ukuran totalnya", !terlaluBesar.ok && terlaluBesar.pesan.includes("6.0 MB"),
   !terlaluBesar.ok ? terlaluBesar.pesan.slice(0, 70) : "");
ok("batas amannya di bawah batas Vercel 4,5 MB", BATAS_AMAN_MULTIPART < 4_500_000);
ok("total bita menjumlahkan yang ada saja", totalBita([pdf("a.pdf", 1), null]) === 1024 * 1024);

// ------------------------------------------------------------
console.log("\n=== PESAN JAWABAN YANG TIDAK TERBACA ===\n");

ok("413 menjelaskan berkas terlalu besar", /terlalu besar/i.test(pesanStatusHttp(413)), pesanStatusHttp(413).slice(0, 60));
ok("504 menjelaskan server kelamaan", /lama/i.test(pesanStatusHttp(504)));
ok("429 menjelaskan terlalu banyak permintaan", /banyak permintaan/i.test(pesanStatusHttp(429)));
ok("setiap pesan menyebut kode aslinya", pesanStatusHttp(413).includes("413") && pesanStatusHttp(502).includes("502"));
ok("kode 5xx tak dikenal tetap dapat pesan", pesanStatusHttp(599).includes("599"));
ok("tidak ada lagi kalimat 'Terjadi gangguan'",
   ![400, 401, 403, 404, 408, 413, 429, 500, 502, 503, 504, 599, 200].some((k) =>
     pesanStatusHttp(k).includes("Terjadi gangguan")));

// ------------------------------------------------------------
console.log("\n=== PENYAPU RUANG TRANSIT ===\n");

const kemarin = hariTransit(Date.now() - 2 * 24 * 3600_000);
const hariIni = hariTransit();
ok("folder kemarin kedaluwarsa", hariKedaluwarsa([kemarin, hariIni]).join(",") === kemarin);
ok("folder hari ini tidak ikut disapu", !hariKedaluwarsa([hariIni]).length);
ok("nama folder aneh diabaikan", !hariKedaluwarsa(["sampah", ".emptyFolderPlaceholder"]).length);

function penyimpananPalsu(isi: Record<string, Array<{ name: string; id: string | null }>>) {
  const dihapus: string[] = [];
  return {
    dihapus,
    list: async (p: string) => ({ data: isi[p] ?? [], error: null }),
    remove: async (p: string[]) => { dihapus.push(...p); return { error: null }; },
  };
}

const palsu = penyimpananPalsu({
  "requests/transit": [
    { name: kemarin, id: null },
    { name: hariIni, id: null },
  ],
  [`requests/transit/${kemarin}`]: [
    { name: "yatim.pdf", id: "1" },
    { name: "sudah-dipakai.pdf", id: "2" },
  ],
  [`requests/transit/${hariIni}`]: [{ name: "baru.pdf", id: "3" }],
});
async function ujiPenyapu() {
  const disapu = await sapuTransit(palsu, async (daftar) =>
    new Set(daftar.filter((j) => j.endsWith("sudah-dipakai.pdf"))),
  );
  ok("hanya berkas yatim yang dihapus", disapu === 1, `dihapus: ${disapu}`);
  ok("yang dihapus memang yang yatim", palsu.dihapus.length === 1 && palsu.dihapus[0].endsWith("yatim.pdf"),
     palsu.dihapus.join(","));
  ok("berkas yang masih ditunjuk basis data tidak disentuh",
     !palsu.dihapus.some((j) => j.includes("sudah-dipakai")));
  ok("berkas hari ini tidak disentuh", !palsu.dihapus.some((j) => j.includes("baru.pdf")));
}

ujiPenyapu().then(() => {
  console.log(gagal ? `\n${gagal} UJI GAGAL\n` : "\nSEMUA UJI LULUS\n");
  process.exit(gagal ? 1 : 0);
});
