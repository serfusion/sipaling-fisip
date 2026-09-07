// UJI PEMERIKSAAN CUPLIKAN KAMERA
//
// Dua hal yang dijaga di sini, dan yang KEDUA jauh lebih penting daripada yang
// pertama:
//
//   1. yang benar-benar bermasalah tertangkap tanpa memanggil model,
//   2. yang tidak bermasalah TIDAK PERNAH dituduh.
//
// Nomor dua lebih penting karena kerugiannya tidak seimbang. Satu peserta
// curang yang lolos merugikan mutu ujian; satu peserta jujur yang dituduh
// kehilangan sertifikasinya, dan ia tidak punya cara membuktikan dirinya.

import {
  AMBANG_BEKU, AMBANG_GELAP, BEKU_BERTURUT, bacaanKeInsiden, beku,
  ciriCuplikan, putuskanCuplikan, type CiriCuplikan,
} from "./src/lib/awas-kamera";

let lulus = 0;
const gagal: string[] = [];
function benar(nama: string, syarat: boolean, info = "") {
  if (syarat) lulus += 1;
  else gagal.push(`${nama}${info ? ` — ${info}` : ""}`);
}
const sama = (nama: string, dapat: unknown, harap: unknown) =>
  benar(nama, dapat === harap, `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);

/** Bikin gambar RGBA seragam dengan derau sebesar `derau`. */
function gambar(terang: number, derau = 0, piksel = 4096): Uint8ClampedArray {
  const data = new Uint8ClampedArray(piksel * 4);
  for (let i = 0; i < piksel; i += 1) {
    // Derau berpola tetap, bukan acak: uji yang hasilnya berubah tiap
    // dijalankan tidak dapat dipakai menjaga apa pun.
    const n = derau === 0 ? 0 : ((i * 37) % (derau * 2)) - derau;
    const v = Math.max(0, Math.min(255, terang + n));
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  return data;
}

console.log("\n=== CIRI CUPLIKAN ===\n");

const terang = ciriCuplikan(gambar(180, 30), null);
benar("gambar terang terbaca terang", terang.terang > 150, String(terang.terang));
benar("gambar berpola punya ragam", terang.ragam > 5, String(terang.ragam));
sama("tanpa pembanding, beda null", terang.beda, null);

const gelap = ciriCuplikan(gambar(4, 0), null);
benar("lensa tertutup terbaca gelap", gelap.terang < AMBANG_GELAP, String(gelap.terang));
benar("dan rata", gelap.ragam < 1, String(gelap.ragam));

const a = gambar(120, 20);
const kembar = ciriCuplikan(a, a);
benar("gambar identik: beda nol", (kembar.beda ?? 9) < 0.001, String(kembar.beda));
benar("dan dinyatakan beku", beku(kembar));

const berubah = ciriCuplikan(gambar(120, 20), gambar(150, 20));
benar("gambar berubah: beda terasa", (berubah.beda ?? 0) > AMBANG_BEKU, String(berubah.beda));
benar("dan TIDAK dinyatakan beku", !beku(berubah));

// Manusia yang duduk diam pun menghasilkan derau sensor. Ambangnya harus di
// atas nol, bukan tepat nol.
const nyaris = ciriCuplikan(gambar(120, 20), gambar(120, 20));
benar("dua gambar berpola sama: tetap beku", beku(nyaris), String(nyaris.beda));

console.log("=== PUTUSAN TANPA MODEL ===\n");

const wajar: CiriCuplikan = { terang: 130, ragam: 40, beda: 12 };
const tertutup: CiriCuplikan = { terang: 6, ragam: 2, beda: 0.1 };

sama("cuplikan wajar: abaikan", putuskanCuplikan(wajar, 0, null).tindakan, "abaikan");
const p1 = putuskanCuplikan(tertutup, 0, null);
sama("lensa tertutup: dicatat tanpa model", p1.tindakan, "catat");
sama("jenisnya kamera_tertutup", p1.tindakan === "catat" ? p1.jenis : "", "kamera_tertutup");
benar("alasannya menyebut angkanya",
  p1.tindakan === "catat" && p1.alasan.includes("terang"),
  p1.tindakan === "catat" ? p1.alasan : "");

// Ruangan yang memang gelap TAPI masih bersebaran bukan lensa tertutup.
// Mahasiswa yang mengerjakan malam hari dengan lampu mati tidak boleh dituduh
// menutup kameranya.
const remang: CiriCuplikan = { terang: 14, ragam: 22, beda: 8 };
sama("ruangan gelap tapi bersebaran: bukan lensa tertutup",
  putuskanCuplikan(remang, 0, null).tindakan, "abaikan");
// Dan ruangan terang yang rata (dinding putih di belakang) juga bukan.
const dinding: CiriCuplikan = { terang: 200, ragam: 3, beda: 5 };
sama("dinding putih rata: bukan lensa tertutup",
  putuskanCuplikan(dinding, 0, null).tindakan, "abaikan");

// Beku menuntut BEBERAPA kali berturut-turut. Satu kali adalah aliran video
// yang tersendat, dan itu terjadi pada jaringan kampus setiap hari.
sama("beku sekali: belum dilaporkan", putuskanCuplikan(wajar, 1, null).tindakan, "abaikan");
sama("beku dua kali: belum dilaporkan", putuskanCuplikan(wajar, 2, null).tindakan, "abaikan");
const p2 = putuskanCuplikan(wajar, BEKU_BERTURUT, null);
sama("beku berturut-turut: dicatat", p2.tindakan, "catat");
sama("jenisnya kamera_beku", p2.tindakan === "catat" ? p2.jenis : "", "kamera_beku");

console.log("=== KAPAN MODEL DIPANGGIL ===\n");

sama("dua wajah terbaca: kirim ke model",
  putuskanCuplikan(wajar, 0, 2).tindakan, "periksa");
sama("tidak ada wajah terbaca: kirim ke model",
  putuskanCuplikan(wajar, 0, 0).tindakan, "periksa");
sama("satu wajah terbaca: tidak perlu model",
  putuskanCuplikan(wajar, 0, 1).tindakan, "abaikan");
// Peramban tanpa FaceDetector mengembalikan null. Itu berarti TIDAK TAHU, dan
// tidak tahu tidak boleh berubah menjadi tuduhan maupun menjadi panggilan
// model tiap dua puluh detik.
sama("peramban tanpa FaceDetector: tidak menuduh apa-apa",
  putuskanCuplikan(wajar, 0, null).tindakan, "abaikan");
sama("pemeriksaan berkala tetap jalan", putuskanCuplikan(wajar, 0, null, true).tindakan, "periksa");
// Yang sudah pasti bermasalah tidak perlu ikut menghabiskan jatah model.
sama("lensa tertutup tidak menghabiskan jatah model walau terjadwal",
  putuskanCuplikan(tertutup, 0, null, true).tindakan, "catat");

console.log("=== BACAAN MODEL MENJADI INSIDEN ===\n");

sama("satu orang: bukan insiden",
  bacaanKeInsiden({ orang: 1, tertutup: false, perangkatLain: false, catatan: "wajar" }), null);
// Inilah pemeriksaan yang paling penting di berkas ini.
sama("model tidak yakin: TIDAK dilaporkan sama sekali",
  bacaanKeInsiden({ orang: -1, tertutup: false, perangkatLain: true, catatan: "buram" }), null);

const dua = bacaanKeInsiden({ orang: 2, tertutup: false, perangkatLain: false, catatan: "dua orang di depan layar" });
sama("dua orang: orang_lain", dua?.jenis, "orang_lain");
benar("catatannya ikut", (dua?.catatan ?? "").includes("dua orang"), dua?.catatan);

const kosong = bacaanKeInsiden({ orang: 0, tertutup: false, perangkatLain: false, catatan: "kursi kosong" });
sama("tidak ada orang: wajah_hilang", kosong?.jenis, "wajah_hilang");

// Perangkat lain TIDAK menjadi insiden sendiri — kalkulator, botol minum, dan
// bingkai foto terlalu sering terbaca sebagai ponsel. Ia hanya ikut sebagai
// keterangan supaya penguji melihat sendiri gambarnya.
sama("ponsel terlihat tapi satu orang: tetap bukan insiden",
  bacaanKeInsiden({ orang: 1, tertutup: false, perangkatLain: true, catatan: "ada benda di meja" }), null);
const ponsel = bacaanKeInsiden({ orang: 2, tertutup: false, perangkatLain: true, catatan: "dua orang" });
benar("tetapi ikut disebut pada insiden yang memang ada",
  (ponsel?.catatan ?? "").includes("perangkat lain"), ponsel?.catatan);

// Catatan dari model adalah teks dari luar. Ia masuk ke basis data dan
// ditampilkan di layar dosen, jadi panjangnya dibatasi.
const panjang = bacaanKeInsiden({
  orang: 2, tertutup: false, perangkatLain: false, catatan: "x".repeat(500),
});
benar("catatan dipotong", (panjang?.catatan ?? "").length <= 190, String(panjang?.catatan.length));

console.log(`\n${lulus} periksa lulus`);
if (gagal.length > 0) {
  console.error(`\n${gagal.length} GAGAL:`);
  gagal.forEach((g) => console.error("  ✗ " + g));
  process.exit(1);
}
console.log("SEMUA UJI LULUS");
