// UJI: KAPAN BERKAS MEDIA SOAL BOLEH DIBUANG
//
// Salah menghapus di sini tidak dapat dibatalkan, dan yang hilang bukan milik
// yang menjalankan penyapunya melainkan gambar soal seorang pengajar. Karena
// itu dua arah dijaga sama ketatnya:
//
//   1. Yang memang sampah HARUS terbuang. Bucket yang tidak pernah menyusut
//      adalah tagihan yang naik terus tanpa ada yang menyadarinya.
//   2. Yang BUKAN milik kita, yang masih dipakai, dan yang umurnya tidak
//      dapat dibaca TIDAK BOLEH tersentuh sama sekali.

import {
  HARI_SIMPAN_MEDIA, bacaUrlMedia, jalurDariSoal, jalurMedia, mapUjian,
  sapuMedia, umurMedia,
} from "./src/lib/media-cbt";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` -> ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, JSON.stringify(dapat) === JSON.stringify(harap),
    `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

const BUCKET = "cbt-media";
const PUBLIK = "https://proyek.supabase.co/storage/v1/object/public";
const HARI = 24 * 3600 * 1000;

console.log("\n=== MENGENALI BERKAS SENDIRI ===\n");

sama("URL publik dikenali",
  jalurMedia(`${PUBLIK}/${BUCKET}/ujian-7/1757000000000-abc.png`, BUCKET),
  "ujian-7/1757000000000-abc.png");
// Pengajar boleh menempelkan tautan dari mana saja. Menghapus sesuatu karena
// salah mengenali tautan luar sebagai berkas sendiri adalah kesalahan yang
// tidak ada jalan kembalinya.
sama("tautan YouTube bukan milik kita",
  jalurMedia("https://youtu.be/abcdef", BUCKET), null);
sama("gambar dari situs lain bukan milik kita",
  jalurMedia("https://situs-lain.test/gambar.png", BUCKET), null);
sama("bucket lain tidak ikut tersentuh",
  jalurMedia(`${PUBLIK}/berkas-layanan/ujian-7/x.png`, BUCKET), null);
sama("kosong menghasilkan null", jalurMedia("", BUCKET), null);
sama("null menghasilkan null", jalurMedia(null, BUCKET), null);
sama("bucket kosong menghasilkan null",
  jalurMedia(`${PUBLIK}/${BUCKET}/ujian-1/a.png`, ""), null);
// Pemuat gambar sering menambahkan ?t=... Jalur yang ikut membawanya tidak
// akan pernah cocok dengan objek mana pun, dan berkasnya tertinggal.
sama("tanda tanya dibuang",
  jalurMedia(`${PUBLIK}/${BUCKET}/ujian-3/1757000000000-b.jpg?t=99`, BUCKET),
  "ujian-3/1757000000000-b.jpg");
sama("pagar dibuang",
  jalurMedia(`${PUBLIK}/${BUCKET}/ujian-3/a.jpg#awal`, BUCKET), "ujian-3/a.jpg");
sama("aksara tersandi dipulihkan",
  jalurMedia(`${PUBLIK}/${BUCKET}/ujian-3/nama%20berkas.png`, BUCKET),
  "ujian-3/nama berkas.png");
// Naik satu tingkat harus mustahil: jalur ini diserahkan apa adanya ke
// perintah hapus Storage.
sama("jalur yang naik tingkat ditolak",
  jalurMedia(`${PUBLIK}/${BUCKET}/../rahasia/a.png`, BUCKET), null);
sama("jalur berawalan garis miring ditolak",
  jalurMedia(`${PUBLIK}/${BUCKET}//etc/passwd`, BUCKET), null);

console.log("=== DUA RUPA SOAL YANG SAMA ===\n");

// Baris basis data memakai kolom mediaUrl; bentuk yang dipakai halaman memakai
// objek media. Menerima satu bentuk saja berarti separuh pemanggilnya
// diam-diam tidak menemukan berkas apa pun.
sama("bentuk basis data terbaca",
  jalurDariSoal([{ mediaUrl: `${PUBLIK}/${BUCKET}/ujian-1/a.png` }], BUCKET),
  ["ujian-1/a.png"]);
sama("bentuk halaman terbaca",
  jalurDariSoal([{ media: { jenis: "gambar", url: `${PUBLIK}/${BUCKET}/ujian-1/b.png` } }], BUCKET),
  ["ujian-1/b.png"]);
sama("media bertali JSON terbaca",
  jalurDariSoal([{ media: `{"jenis":"gambar","url":"${PUBLIK}/${BUCKET}/ujian-1/c.png"}` }], BUCKET),
  ["ujian-1/c.png"]);
sama("soal tanpa media dilewati", jalurDariSoal([{ mediaUrl: null }, null, undefined], BUCKET), []);
sama("berkas yang sama tidak dihitung dua kali",
  jalurDariSoal(
    [{ mediaUrl: `${PUBLIK}/${BUCKET}/ujian-1/a.png` }, { mediaUrl: `${PUBLIK}/${BUCKET}/ujian-1/a.png` }],
    BUCKET,
  ),
  ["ujian-1/a.png"]);
sama("media rusak tidak melempar galat", bacaUrlMedia("{bukan json"), "");
sama("media {} terbaca kosong", bacaUrlMedia("{}"), "");
sama("map ujian dinamai tetap", mapUjian(12), "ujian-12");

console.log("=== UMUR BERKAS ===\n");

const KINI = 1_760_000_000_000;
benar("umur terbaca dari cap waktu pada namanya",
  umurMedia("ujian-1/1757000000000-a.png", KINI) === KINI - 1_757_000_000_000);
// Yang tidak dapat dibaca TIDAK PERNAH disapu. Menebak umur berkas lalu
// menghapusnya adalah kesalahan yang tidak ada jalan kembalinya.
sama("nama tanpa cap waktu tidak dapat dibaca", umurMedia("ujian-1/gambar.png", KINI), null);
sama("cap waktu terlalu pendek tidak dibaca", umurMedia("ujian-1/123-a.png", KINI), null);
// Jam server yang pernah meleset tidak boleh menghasilkan umur negatif yang
// lolos perbandingan.
sama("cap waktu dari masa depan dianggap baru",
  umurMedia(`ujian-1/${KINI + 5 * HARI}-a.png`, KINI), 0);

console.log("=== PENYAPU HARIAN ===\n");

const tua = `ujian-1/${KINI - 40 * HARI}-tua.png`;
const muda = `ujian-1/${KINI - 3 * HARI}-muda.png`;
const tuaDipakai = `ujian-2/${KINI - 90 * HARI}-dipakai.png`;
const takTerbaca = "ujian-3/gambar-lama.png";
const isi = [{ jalur: tua }, { jalur: muda }, { jalur: tuaDipakai }, { jalur: takTerbaca }];

sama("hanya yang tua dan yatim yang disapu",
  sapuMedia(isi, [tuaDipakai], KINI), [tua]);
// Bank soal disusun sekali lalu dipakai ulang tiap semester. Gambar yang
// hilang sendiri sesudah sebulan berarti naskah ujian yang kosong pada hari
// pelaksanaan tanpa seorang pun tahu sebabnya.
benar("yang masih dipakai tidak disapu walau sembilan puluh hari",
  !sapuMedia(isi, [tuaDipakai], KINI).includes(tuaDipakai));
benar("yang belum sebulan tidak disapu", !sapuMedia(isi, [], KINI).includes(muda));
benar("yang umurnya tidak terbaca tidak pernah disapu",
  !sapuMedia(isi, [], KINI).includes(takTerbaca));

// Persis di ambangnya, dari kedua sisi.
const tepat = `ujian-9/${KINI - HARI_SIMPAN_MEDIA * HARI}-tepat.png`;
const kurangSehari = `ujian-9/${KINI - (HARI_SIMPAN_MEDIA - 1) * HARI}-kurang.png`;
sama("tepat sebulan disapu", sapuMedia([{ jalur: tepat }], [], KINI), [tepat]);
sama("kurang sehari belum disapu", sapuMedia([{ jalur: kurangSehari }], [], KINI), []);

// Cap waktu dari Storage lebih dipercaya daripada nama berkasnya: berkas yang
// dipindahkan tangan membawa nama lama tetapi created_at yang baru.
sama("cap waktu Storage menang atas nama",
  sapuMedia([{ jalur: tua, dibuat: new Date(KINI - 2 * HARI).toISOString() }], [], KINI), []);
sama("cap waktu Storage juga dapat menyapu",
  sapuMedia([{ jalur: takTerbaca, dibuat: new Date(KINI - 60 * HARI).toISOString() }], [], KINI),
  [takTerbaca]);

// Aturan keras, hanya dari CBT_SAPU_SEMUA_MEDIA=1.
benar("sapuSemua ikut membuang yang masih dipakai",
  sapuMedia(isi, [tuaDipakai], KINI, { sapuSemua: true }).includes(tuaDipakai));
benar("sapuSemua tetap tidak menyentuh yang masih muda",
  !sapuMedia(isi, [], KINI, { sapuSemua: true }).includes(muda));
benar("sapuSemua tetap tidak menyentuh yang umurnya tidak terbaca",
  !sapuMedia(isi, [], KINI, { sapuSemua: true }).includes(takTerbaca));

sama("bucket kosong tidak menghasilkan apa-apa", sapuMedia([], [], KINI), []);
sama("objek tanpa jalur dilewati", sapuMedia([{ jalur: "" }], [], KINI), []);
sama("umur simpannya sebulan", HARI_SIMPAN_MEDIA, 30);

console.log("");
if (gagal.length) {
  console.log(`${gagal.length} GAGAL:`);
  for (const g of gagal) console.log(`  - ${g}`);
  process.exit(1);
}
console.log(`${lulus} periksa lulus`);
console.log("SEMUA UJI LULUS");
