// UJI CATATAN UANG - bagian yang menentukan angka mana yang tercatat.
//
// Seluruh fitur ini bertumpu pada satu tebakan: dari kalimat bebas yang
// diketik orang, mana yang nominalnya, ke mana arah uangnya, dan masuk
// kategori apa. Salah satu saja meleset, yang rusak bukan tampilan melainkan
// catatan keuangan orang, dan barunya ketahuan pada akhir bulan ketika
// angkanya sudah tidak dapat diingat lagi.
//
// Jalankan: npx tsx uji-uang.ts (atau node --experimental-strip-types uji-uang.ts)

import { uraiPesan, uraiBanyak, tanggalWib, bulanWib } from "./src/lib/uang/urai-pesan";
import { tebakArah, tebakKategori, kategoriDari, seragamkan } from "./src/lib/uang/kategori";
import { bentukKode, buatKodeBuku, normalisasiKode, rapikanNamaBuku } from "./src/lib/uang/buku";
import { rupiah, rupiahRingkas, labelBulan, labelHari, geserBulan } from "./src/lib/uang/format";
import { bacaPerintah } from "./src/lib/uang/perintah";
import { bacaMuatanGerbang, bacaMuatanMeta, nomorWa } from "./src/lib/uang/whatsapp";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` - ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

// Jam yang sama untuk semua uji: 15 September 2026 pukul 10.00 WIB.
const SEKARANG = new Date("2026-09-15T03:00:00Z");

function urai(pesan: string) {
  const hasil = uraiPesan(pesan, SEKARANG);
  if (!hasil.ok) throw new Error(`"${pesan}" tidak terbaca: ${hasil.alasan}`);
  return hasil.hasil;
}

console.log("\n=== NOMINAL ===\n");

// Satu angka yang sama boleh ditulis dengan tujuh cara berbeda, dan ketujuhnya
// harus berhenti pada bilangan yang sama. Inilah sebab paling sering catatan
// uang meleset seribu kali lipat.
sama("10k", urai("-jajan 10k").nominal, 10_000);
sama("10rb", urai("-jajan 10rb").nominal, 10_000);
sama("10 ribu", urai("-jajan 10 ribu").nominal, 10_000);
sama("10.000", urai("-jajan 10.000").nominal, 10_000);
sama("10000", urai("-jajan 10000").nominal, 10_000);
sama("Rp10.000", urai("-jajan Rp10.000").nominal, 10_000);
sama("rp 10.000,-", urai("-jajan rp 10.000,-").nominal, 10_000);

sama("1,5jt", urai("+gaji 1,5jt").nominal, 1_500_000);
sama("1.5jt", urai("+gaji 1.5jt").nominal, 1_500_000);
sama("2 juta", urai("+gaji 2 juta").nominal, 2_000_000);
sama("3jt", urai("+gaji 3jt").nominal, 3_000_000);
sama("1.250.000", urai("+gaji 1.250.000").nominal, 1_250_000);
sama("2 miliar", urai("+jual tanah 2 miliar").nominal, 2_000_000_000);

// Angka yang menempel pada satuan barang bukan nominal. Tanpa aturan ini,
// "beli 5kg beras 60rb" tercatat lima rupiah.
sama("angka satuan barang dilewati", urai("-beli 5kg beras 60rb").nominal, 60_000);
sama("angka jumlah dilewati", urai("-beli 3 kopi 45k").nominal, 45_000);
sama("nominal bersatuan menang atas angka telanjang", urai("-20k grab 2x").nominal, 20_000);

// Tanpa satuan sama sekali, yang dipakai angka paling belakang.
sama("angka telanjang terakhir", urai("-nasi 2 telur 15000").nominal, 15_000);

console.log("\n=== ARAH ===\n");

sama("tanda minus di depan", urai("-beli nasi uduk 10k").arah, "keluar");
sama("tanda plus di depan", urai("+honor guru 100k").arah, "masuk");
sama("tanda menempel di nominal", urai("honor guru +100k").arah, "masuk");
sama("tanpa tanda, kata kerja belanja", urai("beli nasi uduk 10k").arah, "keluar");
sama("tanpa tanda, kata gaji", urai("gaji bulan ini 3jt").arah, "masuk");
sama("tanpa tanda, bawaannya keluar", urai("nasi uduk 10k").arah, "keluar");

// "bayar gaji karyawan" adalah uang KELUAR walaupun memuat kata gaji. Kata
// kerja pengeluaran sengaja diperiksa lebih dulu justru untuk kalimat ini.
sama("bayar gaji karyawan tetap keluar", urai("bayar gaji karyawan 2jt").arah, "keluar");
sama("terima transferan masuk", urai("terima transferan 500k").arah, "masuk");
sama("tanda hubung di tengah kata bukan tanda minus", urai("beli e-toll 100k").arah, "keluar");

console.log("\n=== KATEGORI ===\n");

sama("honor guru", urai("+honor guru 100k").kategori, "gaji");
sama("nasi uduk", urai("-beli nasi uduk 10k").kategori, "jajan");
sama("bensin", urai("-bensin 30k").kategori, "transportasi");
sama("listrik", urai("-token listrik 100k").kategori, "tagihan");
sama("obat", urai("-obat batuk 25k").kategori, "kesehatan");
sama("kondangan", urai("-kondangan 100k").kategori, "sosial");
sama("tambal ban", urai("-tambal ban 15k").kategori, "tak-terduga");
sama("nabung", urai("-nabung 500k").kategori, "tabungan");
sama("jual motor", urai("+jual motor lama 5jt").kategori, "usaha");
sama("kata asing jatuh ke lainnya", urai("-zxqvw 10k").kategori, "lainnya");

// Pencocokan berhenti di awal kata. Kalau tidak, "fotokopi" ikut tertangkap
// kata "kopi" dan biaya cetak skripsi masuk ke anggaran jajan.
sama("fotokopi bukan kopi", urai("-fotokopi 5k").kategori, "pendidikan");
sama("kecocokan terpanjang menang", urai("-top up game 50k").kategori, "hiburan");

// Kata yang sama boleh berbeda kategori tergantung arah uangnya.
sama("kado yang diterima", urai("+kado ulang tahun 200k").kategori, "hadiah");
sama("kado yang diberikan", urai("-kado ulang tahun 200k").kategori, "sosial");

console.log("\n=== KATEGORI DITULIS SENDIRI ===\n");

sama("tanda pagar memakai id", urai("-makan 20k #tagihan").kategori, "tagihan");
sama("tanda pagar bertanda hubung", urai("-servis 200k #tak-terduga").kategori, "tak-terduga");
sama("tanda pagar dipaksa", urai("-makan 20k #tagihan").kategoriDipaksa, true);
sama("tanda pagar tidak ikut jadi keterangan", urai("-makan siang 20k #tagihan").catatan, "Makan siang");
sama("kategori lewat titik dua", urai("-servis 200k kat: hiburan").kategori, "hiburan");

// Tanda pagar yang bukan nama kategori tetapi dikenal sebagai kata kunci
// tetap dituruti: "#warung" berarti jajan.
sama("tanda pagar berupa kata kunci", urai("-15k #warung sebelah").kategori, "jajan");

// Tanda yang sama sekali tidak dikenali TIDAK dibuang dari keterangan.
// Membuangnya berarti menghapus kata yang justru paling berarti bagi
// pemiliknya, dan tidak ada apa pun yang didapat sebagai gantinya.
const takDikenal = urai("-15k #ngopi bareng dosen");
benar("tanda tak dikenal tetap di keterangan", takDikenal.catatan.includes("#ngopi"), takDikenal.catatan);
sama("tanda tak dikenal tidak memaksa kategori", takDikenal.kategoriDipaksa, false);

console.log("\n=== TANGGAL ===\n");

sama("bawaannya hari ini", urai("-kopi 15k").tanggal, "2026-09-15");
sama("kemarin", urai("kemarin -20k grab").tanggal, "2026-09-14");
sama("kemarin lusa", urai("kemarin lusa -20k grab").tanggal, "2026-09-13");
sama("tanggal bergaris miring", urai("27/8 -20k grab").tanggal, "2026-08-27");
sama("tanggal lengkap", urai("27/8/2025 -20k grab").tanggal, "2025-08-27");
sama("nama bulan", urai("27 agustus -20k grab").tanggal, "2026-08-27");

// Catatan uang selalu tentang yang sudah lewat. Tanggal 31/12 yang ditulis
// pada September berarti Desember tahun lalu, bukan Desember tiga bulan lagi.
sama("tanggal yang sudah lewat tahunnya", urai("31/12 -50k belanja").tanggal, "2025-12-31");
sama("tanggal tidak ikut jadi keterangan", urai("kemarin -20k grab").catatan, "Grab");

console.log("\n=== KETERANGAN ===\n");

sama("keterangan dirapikan", urai("-beli   nasi   uduk 10k").catatan, "Beli nasi uduk");
sama("nominal dibuang dari keterangan", urai("+honor guru 100k").catatan, "Honor guru");
sama("nominal di depan", urai("+100k honor guru").catatan, "Honor guru");
sama("tanda hubung dipertahankan", urai("-beli oleh-oleh 50k").catatan, "Beli oleh-oleh");
sama("tanpa keterangan", urai("-10k").catatan, "Tanpa keterangan");

console.log("\n=== YANG DITOLAK ===\n");

benar("pesan kosong ditolak", uraiPesan("", SEKARANG).ok === false);
benar("pesan tanpa angka ditolak", uraiPesan("beli nasi uduk", SEKARANG).ok === false);
benar("nol ditolak", uraiPesan("-jajan 0", SEKARANG).ok === false);
benar("nominal kelewat besar ditolak", uraiPesan("+gaji 500 miliar", SEKARANG).ok === false);

const tanpaAngka = uraiPesan("beli nasi uduk", SEKARANG);
benar(
  "alasannya menyebutkan cara menulis nominal",
  !tanpaAngka.ok && tanpaAngka.alasan.includes("10k"),
  !tanpaAngka.ok ? tanpaAngka.alasan : "",
);

// Angka kecil tanpa satuan tetap dicatat apa adanya, TETAPI pengirimnya
// diberi tahu. Menebak sendiri bahwa "10" berarti sepuluh ribu berarti
// mengarang nol yang tidak pernah diketik siapa pun.
const kecil = urai("-nasi 10");
sama("angka kecil dicatat apa adanya", kecil.nominal, 10);
benar("angka kecil diberi peringatan", kecil.catatanTambahan.length > 0);

console.log("\n=== BANYAK BARIS ===\n");

const banyak = uraiBanyak("-kopi 15k\n-parkir 2k\n+honor 100k", SEKARANG);
sama("tiga baris terbaca", banyak.length, 3);
benar("semuanya berhasil", banyak.every((b) => b.hasil.ok));
sama(
  "arahnya masing-masing",
  banyak.map((b) => (b.hasil.ok ? b.hasil.hasil.arah : "?")).join(","),
  "keluar,keluar,masuk",
);

// Satu baris yang gagal tidak boleh menjatuhkan baris lain: kalau ikut jatuh,
// orang harus mengetik ulang seluruh catatan sehari hanya karena satu salah
// ketik.
const campur = uraiBanyak("-kopi 15k; ini bukan catatan; +honor 100k", SEKARANG);
sama("baris gagal tidak menjatuhkan yang lain", campur.filter((b) => b.hasil.ok).length, 2);
sama("baris gagal tetap dilaporkan", campur.filter((b) => !b.hasil.ok).length, 1);

console.log("\n=== TEBAKAN LANGSUNG ===\n");

sama("seragamkan memberi spasi di ujung", seragamkan("Nasi Uduk!"), " nasi uduk ");
sama("tebakArah bawaan keluar", tebakArah("sesuatu yang asing"), "keluar");
sama("tebakKategori menghormati arah", tebakKategori("kado", "masuk"), "hadiah");
sama("kategoriDari yang tidak ada", kategoriDari("entah-apa").id, "lainnya");
sama("kategoriDari kosong", kategoriDari(null).id, "lainnya");

console.log("\n=== KODE BUKU ===\n");

const kode = buatKodeBuku();
benar("kode berbentuk UNG-xxxx-xxxx-xxxx", /^UNG-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(kode), kode);
sama("kode sendiri lolos normalisasi", normalisasiKode(kode), kode);
sama("huruf kecil dimaafkan", normalisasiKode(kode.toLowerCase()), kode);
sama("tanpa tanda hubung dimaafkan", normalisasiKode(kode.replace(/-/g, "")), kode);
sama("spasi dimaafkan", normalisasiKode(` ${kode} `), kode);
sama("awalan UNG boleh hilang", normalisasiKode(kode.slice(4)), kode);
sama("S dibaca 5", normalisasiKode(bentukKode("SSSSSSSSSSSS")), bentukKode("555555555555"));
sama("kode terlalu pendek ditolak", normalisasiKode("UNG-ABC"), null);
sama("kode kosong ditolak", normalisasiKode(""), null);
sama("kode berhuruf terlarang ditolak", normalisasiKode(bentukKode("IIIIIIIIIIII")), null);
benar("dua kode berturut-turut berbeda", buatKodeBuku() !== buatKodeBuku());

sama("nama kosong diberi bawaan", rapikanNamaBuku(""), "Buku kas saya");
sama("nama dirapikan", rapikanNamaBuku("  Uang   Bulanan  "), "Uang Bulanan");
benar("nama panjang dipotong", rapikanNamaBuku("a".repeat(200)).length <= 60);

console.log("\n=== ANGKA DAN TANGGAL DI LAYAR ===\n");

sama("rupiah", rupiah(1_250_000), "Rp1.250.000");
sama("rupiah nol", rupiah(0), "Rp0");
sama("ringkas ribuan", rupiahRingkas(45_000), "Rp45rb");
sama("ringkas jutaan", rupiahRingkas(1_500_000), "Rp1,5jt");
sama("ringkas kecil tetap utuh", rupiahRingkas(9_000), "Rp9.000");
sama("label bulan", labelBulan("2026-09"), "September 2026");
sama("label hari ini", labelHari("2026-09-15", "2026-09-15"), "Hari ini");
sama("label kemarin", labelHari("2026-09-14", "2026-09-15"), "Kemarin");
sama("label tanggal biasa", labelHari("2026-09-01", "2026-09-15"), "Selasa, 1 September 2026");
sama("geser bulan mundur", geserBulan("2026-01", -1), "2025-12");
sama("geser bulan maju", geserBulan("2026-12", 1), "2027-01");

// WIB, bukan UTC. Tanpa pergeseran ini, catatan yang dibuat pukul 06.00 pagi
// di Indonesia masuk ke tanggal kemarin.
sama("tanggal WIB pagi hari", tanggalWib(new Date("2026-09-15T23:30:00Z")), "2026-09-16");
sama("bulan WIB", bulanWib(new Date("2026-09-30T23:30:00Z")), "2026-10");

console.log("\n=== PERINTAH vs CATATAN ===\n");

// Inilah pemisah yang menjaga jalur WhatsApp tetap masuk akal. Di sana orang
// tidak mengetik garis miring, jadi kata biasa harus dapat menjadi perintah
// TANPA menelan kalimat yang sebenarnya catatan uang.
sama("garis miring selalu perintah", bacaPerintah("/batal").nama, "batal");
sama("kata tunggal juga perintah", bacaPerintah("batal").nama, "batal");
sama("sebutan lain diseragamkan", bacaPerintah("ringkasan").nama, "ringkas");
sama("halo dianggap minta bantuan", bacaPerintah("halo").nama, "bantuan");

// "bantuan sosial 500k" adalah uang masuk, bukan permintaan bantuan.
sama("kata perintah di kalimat panjang bukan perintah", bacaPerintah("bantuan sosial 500k").nama, null);
sama("hapus di kalimat panjang bukan perintah", bacaPerintah("hapus tagihan wifi 300k").nama, null);

// "daftar ulang 500k" adalah biaya kuliah. Yang membuat "daftar" menjadi
// perintah bukan katanya, melainkan kode yang sah di belakangnya.
sama("daftar tanpa kode dan berkalimat panjang", bacaPerintah("daftar ulang 500k").nama, null);
sama("daftar bergaris miring tetap perintah", bacaPerintah("/daftar").nama, "daftar");
sama("daftar bergaris miring tanpa kode", bacaPerintah("/daftar").kode, null);

const kodeUji = bentukKode("7HQ4M2XB9KDT");
sama("daftar dengan kode sah", bacaPerintah(`daftar ${kodeUji}`).nama, "daftar");
sama("kodenya ikut terbaca", bacaPerintah(`daftar ${kodeUji}`).kode, kodeUji);
sama("nama bot ikut dibuang", bacaPerintah(`/daftar@BukuKasBot ${kodeUji}`).kode, kodeUji);
sama("catatan biasa bukan perintah", bacaPerintah("-beli nasi uduk 10k").nama, null);
sama("perintah asing dikenali sebagai bergaris miring", bacaPerintah("/statistik").bergarisMiring, true);
sama("perintah asing bukan perintah yang dikenal", bacaPerintah("/statistik").nama, null);

console.log("\n=== NOMOR WHATSAPP ===\n");

// Satu orang yang sama datang dengan tiga penulisan berbeda tergantung
// gerbangnya. Kalau tidak diseragamkan, catatannya terbelah tiga.
sama("nol di depan menjadi 62", nomorWa("08123456789"), "628123456789");
sama("sudah berkode negara", nomorWa("628123456789"), "628123456789");
sama("akhiran c.us dibuang", nomorWa("628123456789@c.us"), "628123456789");
sama("tanda baca dibuang", nomorWa("+62 812-3456-789"), "628123456789");
sama("tanpa nol dan tanpa kode negara", nomorWa("8123456789"), "628123456789");
sama("kosong ditolak", nomorWa(""), null);
sama("bukan nomor ditolak", nomorWa("halo"), null);

console.log("\n=== MUATAN WHATSAPP ===\n");

const muatanMeta = {
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          value: {
            contacts: [{ profile: { name: "Eko" }, wa_id: "628123456789" }],
            messages: [
              { id: "wamid.1", from: "628123456789", type: "text", text: { body: "-beli nasi uduk 10k" } },
            ],
          },
        },
      ],
    },
  ],
};
const dariMeta = bacaMuatanMeta(muatanMeta);
sama("nomor dari meta", dariMeta?.nomor, "628123456789");
sama("teks dari meta", dariMeta?.teks, "-beli nasi uduk 10k");
sama("nama dari meta", dariMeta?.label, "Eko");

// Pemberitahuan "sudah dibaca" datang lewat jalur yang sama dan TIDAK boleh
// dianggap pesan. Kalau dianggap, tiap centang biru menjadi catatan gagal.
sama(
  "pemberitahuan status diabaikan",
  bacaMuatanMeta({ entry: [{ changes: [{ value: { statuses: [{ status: "read" }] } }] }] }),
  null,
);
sama("gambar tanpa teks diabaikan", bacaMuatanMeta({
  entry: [{ changes: [{ value: { messages: [{ id: "x", from: "628123456789", type: "image" }] } }] }],
}), null);

const dariGerbang = bacaMuatanGerbang({ sender: "08123456789", message: "+honor guru 100k", name: "Eko" });
sama("nomor dari gerbang", dariGerbang?.nomor, "628123456789");
sama("teks dari gerbang", dariGerbang?.teks, "+honor guru 100k");

// Tiap gerbang menamai kolomnya sendiri-sendiri; yang lazim dipakai
// diterima semuanya supaya berpindah gerbang tidak berarti menulis ulang.
const namaLain = bacaMuatanGerbang({ pengirim: "628123456789", pesan: "-kopi 15k" });
sama("nama kolom bahasa Indonesia diterima", namaLain?.teks, "-kopi 15k");
sama("muatan kosong ditolak", bacaMuatanGerbang({}), null);
sama("muatan tanpa pesan ditolak", bacaMuatanGerbang({ sender: "08123456789" }), null);

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  x " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
