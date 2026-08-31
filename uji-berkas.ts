import { bacaTeks, MAKS_MB, MAKS_HURUF } from "./src/lib/berkas";
import { buatZip, type Bita } from "./src/lib/zip";
import { ujiParafrase, MAKS_KATA_PARAFRASE } from "./src/lib/kemiripan";

let gagal = 0;
const ok = (n: string, s: boolean, i = "") => { console.log(`${s ? "  ✓" : "  ✗"} ${n}${i ? ` — ${i}` : ""}`); if (!s) gagal++; };
/**
 * Berkas .docx dibuat di tempat, bukan dibaca dari luar.
 *
 * Sebelumnya berkas ini membaca contoh .docx dari map sementara di mesin yang
 * kebetulan dipakai, lengkap dengan jalur mutlaknya. Uji yang begitu hanya
 * berjalan di satu komputer dan diam-diam gagal di komputer lain.
 *
 * Yang diperiksa penjaganya cuma delapan bita pertama dan akhiran namanya, dan
 * .docx memang berupa arsip zip. Jadi zip sungguhan yang dibangun pembuat zip
 * milik proyek ini sendiri sudah menjadi contoh yang setia.
 */
function docxContoh() {
  const isi = new TextEncoder().encode(
    '<?xml version="1.0"?><w:document><w:body><w:p><w:t>Naskah contoh</w:t></w:p></w:body></w:document>',
  ) as Bita;
  return buatZip([{ nama: "word/document.xml", data: isi }]);
}

async function jalan() {
console.log("\n=== PEMERIKSAAN BERKAS ===\n");

const docx = new File([docxContoh()], "skripsi.docx");
const mulai = Date.now();
const h1 = await bacaTeks(docx);
const lama = Date.now() - mulai;
ok("berkas .docx ditolak", !h1.ok, h1.ok ? "LOLOS" : h1.pesan.slice(0, 60));
ok("ditolak dengan cepat, tanpa membaca utuh", lama < 300, `${lama} ms`);
// Kalimat nasihatnya berubah ketika unggah Word dan PDF ditata ulang. Yang
// dijaga tetap sama: penolakan harus menyebut jenis berkasnya dan memberi
// tahu langkah berikutnya, bukan sekadar berkata "gagal".
ok("pesannya menyebut jenis berkas dan langkah berikutnya",
   !h1.ok && /docx|word/i.test(h1.pesan) && /pilih|salin|tempel|unggah/i.test(h1.pesan));

const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], "naskah.pdf");
ok("berkas PDF ditolak", !(await bacaTeks(pdf)).ok);
const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])], "gambar.png");
ok("gambar PNG ditolak", !(await bacaTeks(png)).ok);
const docLama = new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1])], "lama.doc");
ok("Word lama .doc ditolak", !(await bacaTeks(docLama)).ok);

const teksBiner = new File([new Uint8Array(Array.from({ length: 5000 }, (_, i) => (i % 7 === 0 ? 0 : 65)))], "aneh.txt");
ok("teks yang tampak biner ditolak walau tanpa tanda pengenal", !(await bacaTeks(teksBiner)).ok);

// Batasnya kini per jenis berkas, bukan satu angka untuk semuanya.
const besar = new File(["x".repeat(Math.ceil(MAKS_MB.teks * 1024 * 1024) + 1000)], "besar.txt");
const hBesar = await bacaTeks(besar);
ok("berkas melebihi batas ukuran ditolak", !hBesar.ok, !hBesar.ok ? hBesar.pesan.slice(0, 50) : "");

const NASKAH = "BAB I PENDAHULUAN\nPenelitian ini bertujuan untuk menganalisis literasi digital mahasiswa.\n";
const wajar = new File([NASKAH], "skripsi.txt");
const hWajar = await bacaTeks(wajar);
ok("berkas .txt wajar diterima", hWajar.ok && hWajar.teks === NASKAH && !hWajar.dipangkas);

const panjang = new File(["a".repeat(MAKS_HURUF + 5000)], "panjang.txt");
const hPanjang = await bacaTeks(panjang);
ok("teks sangat panjang dipangkas, bukan ditolak",
   hPanjang.ok && hPanjang.dipangkas && hPanjang.teks.length === MAKS_HURUF);

const kosong = new File([""], "kosong.txt");
ok("berkas kosong tidak meledak", (await bacaTeks(kosong)).ok);

console.log("\n=== BATAS UJI PARAFRASE ===\n");
const pendek = "Literasi digital merupakan kemampuan individu memakai teknologi informasi.";
ok("kalimat pendek diproses", ujiParafrase(pendek, pendek) !== null);
const kepanjangan = "kata ".repeat(MAKS_KATA_PARAFRASE + 50);
const t0 = Date.now();
const hasilPanjang = ujiParafrase(kepanjangan, kepanjangan);
const durasi = Date.now() - t0;
ok("teks melebihi batas dikembalikan null, tidak dihitung", hasilPanjang === null);
ok("penolakan berlangsung seketika", durasi < 100, `${durasi} ms`);
const tepatBatas = "kata ".repeat(MAKS_KATA_PARAFRASE);
const t1 = Date.now();
ujiParafrase(tepatBatas, tepatBatas);
const durasi2 = Date.now() - t1;
ok("tepat di batas masih selesai cepat", durasi2 < 2000, `${durasi2} ms`);

console.log(gagal ? `\n${gagal} UJI GAGAL\n` : "\nSEMUA UJI LULUS\n");

}

void jalan().then(() => process.exit(gagal ? 1 : 0));
