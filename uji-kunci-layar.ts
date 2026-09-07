// UJI KUNCI TANGKAPAN LAYAR
//
// Yang dijaga di sini bukan "apakah tangkapan layar terblokir" — berkas uji
// tidak dapat menekan Print Screen. Yang dijaga adalah hal yang jauh lebih
// mudah rusak dan jauh lebih mahal bila rusak: SIAPA YANG BOLEH MENGAKU
// TERKUNCI.
//
// Satu kekeliruan di sini menghasilkan layar ujian yang menuliskan "tangkapan
// layar diblokir" kepada peserta yang membukanya dari peramban biasa. Peserta
// pertama akan mengujinya dalam lima detik, ia akan berhasil, dan sejak saat
// itu seluruh peringatan lain di layar itu kehilangan wibawanya — termasuk
// yang sungguh-sungguh ditegakkan.
//
// Karena itu hampir semua pemeriksaan di bawah menguji arah JATUHNYA: masukan
// yang meragukan harus selalu jatuh ke "peramban", yang paling longgar dan
// yang paling sedikit janjinya.

import { readFileSync } from "node:fs";
import {
  KEMAMPUAN, KLIEN_LABEL, PENANDA_KLIEN, PESAN_TIRAI, SEMUA_KLIEN, TIRAI_MS,
  ajakanAplikasi, bacaKlien, bolehMasukKlien, kunciSistem, periksaKunciKlien,
  pesanKunciLayar, rapikanKlien, type JenisKlien,
} from "./src/lib/kunci-layar";
import { KEADAAN_JAWAB_LABEL, keadaanJawab } from "./src/lib/cbt";
import { namaBerkasQr } from "./src/lib/qr-ujian";
import { posterQrHtml } from "./src/lib/cetak-cbt";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

const UA_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/126.0.0.0 Mobile Safari/537.36 SiPalingCBT/1.0.0 (android; kunci-layar)";
const UA_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SiPalingCBT/1.0.0 (windows; kunci-layar)";
const UA_BIASA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/126.0.0.0 Safari/537.36";

console.log("\n=== MENGENALI PERANGKAT ===\n");

sama("peramban biasa tetap peramban", bacaKlien({ ua: UA_BIASA }), "peramban");
sama("aplikasi Android dikenali", bacaKlien({ ua: UA_ANDROID }), "android");
sama("aplikasi Windows dikenali", bacaKlien({ ua: UA_WINDOWS }), "windows");
sama("tanpa User-Agent jatuh ke peramban", bacaKlien({}), "peramban");
sama("User-Agent kosong jatuh ke peramban", bacaKlien({ ua: "" }), "peramban");
sama("User-Agent null jatuh ke peramban", bacaKlien({ ua: null }), "peramban");

// Penanda yang tidak lengkap TIDAK boleh lolos. Ponsel yang namanya kebetulan
// memuat kata "android" ada banyak; yang menentukan adalah susunan lengkapnya.
sama("nama produk saja tidak cukup", bacaKlien({ ua: "Mozilla/5.0 SiPalingCBT" }), "peramban");
sama("kurung kosong tidak cukup",
  bacaKlien({ ua: "Mozilla/5.0 SiPalingCBT/1.0.0 ()" }), "peramban");
sama("kata android tanpa penanda tidak cukup",
  bacaKlien({ ua: "Mozilla/5.0 (Linux; Android 14)" }), "peramban");
sama("sistem yang tidak dikenal jatuh ke peramban",
  bacaKlien({ ua: "SiPalingCBT/1.0.0 (symbian; kunci-layar)" }), "peramban");

// Jembatan didahulukan, karena hanya aplikasinya yang dapat menyuntikkannya.
sama("jembatan mengalahkan User-Agent biasa",
  bacaKlien({ ua: UA_BIASA, jembatan: { jenis: "android" } }), "android");
sama("jembatan kosong tidak menaikkan apa pun",
  bacaKlien({ ua: UA_BIASA, jembatan: {} }), "peramban");
sama("jembatan berisi sampah tidak menaikkan apa pun",
  bacaKlien({ ua: UA_BIASA, jembatan: { jenis: "super-aman" } }), "peramban");
// Dan yang paling penting: jembatan yang mengaku peramban tidak boleh
// MENURUNKAN pengenalan dari User-Agent aplikasinya sendiri.
sama("jembatan tidak menurunkan User-Agent aplikasi",
  bacaKlien({ ua: UA_ANDROID, jembatan: { jenis: "peramban" } }), "android");

benar("penandanya ada di dalam User-Agent contoh", UA_ANDROID.includes(PENANDA_KLIEN));

console.log("\n=== MEMBERSIHKAN MASUKAN ===\n");

for (const k of SEMUA_KLIEN) {
  sama(`klien ${k} bolak-balik utuh`, rapikanKlien(k), k);
  benar(`klien ${k} punya label`, Boolean(KLIEN_LABEL[k]));
  benar(`klien ${k} punya kemampuan`, Boolean(KEMAMPUAN[k]));
}
sama("huruf besar tetap terbaca", rapikanKlien("ANDROID"), "android");
sama("spasi di tepi dibuang", rapikanKlien("  windows "), "windows");
sama("angka jatuh ke peramban", rapikanKlien(7), "peramban");
sama("null jatuh ke peramban", rapikanKlien(null), "peramban");
sama("objek jatuh ke peramban", rapikanKlien({ jenis: "android" }), "peramban");

console.log("\n=== SIAPA YANG BOLEH MENGAKU TERKUNCI ===\n");

// Inti seluruh berkas ini. Peramban TIDAK PERNAH mengunci apa pun, dan tidak
// ada versi berikutnya yang mengubah itu.
benar("peramban tidak mengunci apa pun", !kunciSistem("peramban"));
benar("Android mengunci", kunciSistem("android"));
benar("Windows mengunci", kunciSistem("windows"));

const pesanPeramban = pesanKunciLayar("peramban");
benar("kalimat untuk peramban tidak menjanjikan pemblokiran",
  !pesanPeramban.toLowerCase().includes("diblokir"), pesanPeramban);
benar("kalimat untuk peramban menyebut pencatatan",
  pesanPeramban.toLowerCase().includes("dicatat"), pesanPeramban);
for (const k of ["android", "windows"] as JenisKlien[]) {
  benar(`kalimat untuk ${k} menyebut pemblokiran sistem`,
    pesanKunciLayar(k).toLowerCase().includes("diblokir sistem"), pesanKunciLayar(k));
}
benar("kalimat kedua perangkat terkunci sama persis",
  pesanKunciLayar("android") === pesanKunciLayar("windows"));

// Ajakan memasang aplikasi hanya untuk yang belum memakainya, dan hanya pada
// ujian yang belum mewajibkannya — layar beberapa detik sebelum ujian dimulai
// sudah cukup penuh peringatan.
benar("peramban diajak memasang aplikasi", ajakanAplikasi("peramban", false).length > 20);
sama("yang sudah memakai aplikasi tidak diajak", ajakanAplikasi("android", false), "");
sama("ujian yang mewajibkan tidak mengajak, ia menolak", ajakanAplikasi("peramban", true), "");

console.log("\n=== GERBANG UJIAN YANG MEWAJIBKAN APLIKASI ===\n");

// Ujian biasa: tidak ada yang berubah bagi siapa pun.
benar("tanpa kewajiban, peramban boleh masuk", bolehMasukKlien(false, "peramban", true).ok);
benar("tanpa kewajiban, kunci yang salah pun tidak menghalangi",
  bolehMasukKlien(false, "peramban", false).ok);

// Ujian yang mewajibkan aplikasi.
const tolakPeramban = bolehMasukKlien(true, "peramban", true);
benar("peramban ditolak pada ujian yang mewajibkan aplikasi", !tolakPeramban.ok);
benar("penolakannya menyebut apa yang harus diunduh",
  !tolakPeramban.ok && tolakPeramban.pesan.toLowerCase().includes("unduh"),
  !tolakPeramban.ok ? tolakPeramban.pesan : "");
benar("penolakannya menyebut aplikasinya",
  !tolakPeramban.ok && tolakPeramban.pesan.includes("Aplikasi Ujian Terkunci"));

benar("aplikasi berkunci benar boleh masuk", bolehMasukKlien(true, "android", true).ok);
const tolakKunci = bolehMasukKlien(true, "windows", false);
benar("aplikasi berkunci salah ditolak", !tolakKunci.ok);
benar("penolakan kunci berbeda dari penolakan peramban",
  !tolakKunci.ok && !tolakPeramban.ok && tolakKunci.pesan !== tolakPeramban.pesan);

console.log("\n=== KUNCI BERSAMA ===\n");

// Belum disetel → gerbangnya bersandar pada pengenalan perangkat saja. Ini
// disengaja: kampus yang belum menyiapkan environment-nya mendapat penjagaan
// yang tidak sempurna, BUKAN ujian yang menolak seluruh pesertanya pada pagi
// hari pelaksanaan.
benar("kunci yang belum disetel meloloskan", periksaKunciKlien("", "apa saja"));
benar("kunci undefined meloloskan", periksaKunciKlien(undefined, ""));
benar("kunci null meloloskan", periksaKunciKlien(null, ""));
benar("hanya spasi dianggap belum disetel", periksaKunciKlien("   ", "salah"));

benar("kunci yang cocok lolos", periksaKunciKlien("rahasia-2026", "rahasia-2026"));
benar("kunci yang cocok dengan spasi di tepi lolos",
  periksaKunciKlien("rahasia-2026", "  rahasia-2026  "));
benar("kunci yang salah ditolak", !periksaKunciKlien("rahasia-2026", "rahasia-2025"));
benar("kunci kosong ditolak bila server memintanya", !periksaKunciKlien("rahasia-2026", ""));
benar("kunci undefined ditolak bila server memintanya",
  !periksaKunciKlien("rahasia-2026", undefined));
benar("beda huruf besar-kecil ditolak", !periksaKunciKlien("Rahasia", "rahasia"));

console.log("\n=== TIRAI ===\n");

benar("tirai cukup lama untuk melewati gerakan memotong layar", TIRAI_MS >= 1500);
// Dan cukup pendek untuk tidak terasa sebagai ujian yang macet. Peserta yang
// papan ketiknya menekan Print Screen tanpa sengaja harus kembali membaca
// soalnya sebelum sempat panik.
benar("tirai tidak menutup terlalu lama", TIRAI_MS <= 4000, `${TIRAI_MS} ms`);

for (const sebab of ["tangkap", "pergi"] as const) {
  const p = PESAN_TIRAI[sebab];
  benar(`tirai ${sebab} punya judul`, p.judul.length > 3);
  benar(`tirai ${sebab} menjelaskan sebabnya`, p.isi.length > 40);
  // Peserta yang layarnya menggelap tanpa keterangan akan mengira ujiannya
  // rusak, lalu memuat ulang halaman di tengah ujian.
  benar(`tirai ${sebab} menyebut soal akan kembali`,
    p.isi.toLowerCase().includes("kembali"), p.isi);
}
benar("tirai tangkapan layar menyebut pencatatannya",
  PESAN_TIRAI.tangkap.isi.toLowerCase().includes("dicatat"));

console.log("\n=== BENAR HIJAU, SALAH MERAH ===\n");

// Kekeliruan yang pernah ada dan tidak boleh kembali: lencana hasil dahulu
// meminjam warna lencana status, dan lencana "berjalan" berwarna HIJAU —
// sehingga jawaban SALAH tercetak hijau pada lembar yang dilampirkan ke berita
// acara.
sama("jawaban benar", keadaanJawab({ benar: true, poin: 5 }), "benar");
sama("jawaban salah", keadaanJawab({ benar: false, poin: 0 }), "salah");
sama("benar sebagian bukan salah", keadaanJawab({ benar: false, poin: 6 }), "sebagian");
// Urutan pemeriksaannya menentukan: essay yang belum dikoreksi berpoin nol,
// dan diperiksa sesudah poinnya ia akan terbaca "Salah" — vonis atas jawaban
// yang belum dibaca siapa pun.
sama("essay yang belum dikoreksi menunggu", keadaanJawab({ benar: null, poin: 0 }), "tunggu");
sama("essay bernilai pun tetap menunggu bila belum ditandai",
  keadaanJawab({ benar: null, poin: 12 }), "tunggu");
sama("label benar", KEADAAN_JAWAB_LABEL.benar, "Benar");
sama("label salah", KEADAAN_JAWAB_LABEL.salah, "Salah");
benar("label sebagian tidak berbunyi salah",
  !KEADAAN_JAWAB_LABEL.sebagian.toLowerCase().startsWith("salah"));

console.log("\n=== KODE QR UJIAN ===\n");

sama("nama berkas memuat kode ujiannya", namaBerkasQr("K7M2QX"), "qr-ujian-K7M2QX.png");
sama("huruf kecil dibesarkan", namaBerkasQr("k7m2qx"), "qr-ujian-K7M2QX.png");
sama("tanda baca dibuang", namaBerkasQr("K7M/2Q X"), "qr-ujian-K7M2QX.png");
sama("kode kosong tetap menghasilkan nama", namaBerkasQr(""), "qr-ujian.png");

const ujianContoh = {
  judul: "UAS Komunikasi Massa", mataKuliah: "Komunikasi Massa", kelas: "A",
  kode: "K7M2QX", durasi: 90, jumlahSoal: 40,
  mulai: "2026-09-10T02:00:00.000Z", selesai: "2026-09-10T04:00:00.000Z",
};
const alamat = "https://cbt.contoh.ac.id/ujian?kode=K7M2QX";
const poster = posterQrHtml(ujianContoh, alamat, "data:image/png;base64,iVBORw0KGgo=");

benar("poster memuat gambar QR-nya", poster.includes('<img src="data:image/png;base64,'));
benar("poster tetap mencetak kodenya besar-besar", poster.includes(">K7M2QX<"));
benar("poster mencetak alamatnya", poster.includes(alamat));
benar("poster menyebut jumlah soal dan waktunya",
  poster.includes("40 butir") && poster.includes("90 menit"));

// Poster tanpa QR tetap berguna. Pengajar yang menekan tombolnya tiga menit
// sebelum ujian tidak boleh mendapat halaman kosong hanya karena penggambar
// QR-nya gagal dimuat.
const posterTanpa = posterQrHtml(ujianContoh, alamat, "");
benar("poster tanpa QR tetap memuat kodenya", posterTanpa.includes(">K7M2QX<"));
benar("poster tanpa QR mengatakan apa yang harus dilakukan",
  posterTanpa.includes("Ketik kode ujian"));
benar("poster tanpa QR tidak menyisakan gambar rusak", !posterTanpa.includes("<img"));

// Sumber gambar yang bukan data URL TIDAK boleh masuk ke HTML mentah. Nilainya
// memang datang dari penggambar QR di peramban yang sama, tetapi berkas cetak
// merangkai HTML apa adanya — dan satu sumber gambar yang tidak diperiksa
// adalah satu jalan bagi apa pun yang suatu saat memanggilnya dengan tali dari
// tempat lain.
const posterJahat = posterQrHtml(ujianContoh, alamat, 'x" onerror="alert(1)');
benar("sumber gambar yang bukan data URL ditolak", !posterJahat.includes("onerror"));
const posterLuar = posterQrHtml(ujianContoh, alamat, "https://situs-lain.example/qr.png");
benar("gambar dari situs luar ditolak", !posterLuar.includes("situs-lain.example"));

console.log("\n=== JALUR CETAK DITUTUP DUA LAPIS ===\n");

// Cetak-ke-PDF adalah jalur tangkapan yang paling merugikan sekaligus
// SATU-SATUNYA yang benar-benar dapat dihentikan halaman, bukan sekadar
// ditutupi tirai: pratayang cetak menyalin seluruh naskah termasuk bagian
// yang tergulung di luar layar, sedangkan tangkapan layar hanya mendapat satu
// layar. Kedua lapisnya perlu — pendengar tombol menutup Ctrl+P, aturan
// @media print menutup jalur MENU Cetak yang tidak pernah melewati papan
// ketik sama sekali.
const penjagaTs = readFileSync("./src/app/cbt/ujian/penjaga.ts", "utf8");
benar("lapis 1: Ctrl/Cmd+P dicegat", /ctrlKey \|\| e\.metaKey/.test(penjagaTs));
benar("lapis 1: peristiwa beforeprint ikut dipasang",
  penjagaTs.includes('addEventListener("beforeprint"'));
benar("pendengar tombolnya pada fase tangkap", /capture:\s*true/.test(penjagaTs),
  "penangan lain yang memanggil stopPropagation lebih dulu akan mendahuluinya");

const gaya = readFileSync("./src/app/globals.css", "utf8");
const iBlok = gaya.indexOf("LAYAR UJIAN TIDAK IKUT TERCETAK");
benar("lapis 2: blok aturan cetaknya ada", iBlok > 0);
const blokCetak = iBlok > 0 ? gaya.slice(iBlok) : "";
benar("lapis 2: isi layar ujian dibuang dari hasil cetak",
  /\.uj-kerja > \*,[\s\S]{0,120}display:\s*none/.test(blokCetak));
benar("lapis 2: tanda air dan kamera ikut dibuang",
  blokCetak.includes(".uj-air") && blokCetak.includes(".uj-kam"));
benar("lapis 2: keterangannya tetap tercetak",
  /\.uj-kerja::before[\s\S]{0,220}tidak dapat dicetak/.test(blokCetak),
  "lembar kosong tanpa keterangan terbaca sebagai pencetak yang rusak");
// Aturan cetak surat portal memakai `body * { visibility: hidden }` — tanpa
// memunculkannya kembali, keterangan di atas ikut tersembunyi.
benar("lapis 2: keterangannya dimunculkan kembali dari aturan cetak portal",
  /visibility:\s*visible/.test(blokCetak));
// display:none, BUKAN visibility:hidden — yang tersembunyi masih menempati
// halamannya dan menghasilkan lembar kosong sebanyak soalnya.
benar("isi ujian dibuang, bukan sekadar disembunyikan",
  !/\.uj-kerja > \*[\s\S]{0,80}visibility:\s*hidden/.test(blokCetak));
// Aturan cetak surat portal harus TETAP ada: ia yang dipakai mencetak surat
// tugas dan transkrip, dan blok di atas sengaja tidak menyentuhnya.
benar("aturan cetak surat portal tidak ikut terganggu",
  gaya.includes(".print-area, .print-area * { visibility: visible; }"));

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
