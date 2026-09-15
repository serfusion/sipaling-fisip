// Uji menu Nonton Drama: alamat situsnya, tabel sumbernya, pembaca
// jawabannya, dan penerus alirannya.
//
// Semuanya fungsi murni, jadi seluruhnya dapat dibuktikan di sini tanpa
// menyalakan server dan tanpa memanggil API hulu satu kali pun. Itu bukan
// kebetulan melainkan syarat: API hulu milik orang lain, dapat mati kapan
// saja, dan uji yang ikut mati bersamanya berhenti dipercaya orang.
//
//   npx tsx uji-drama.ts
import {
  adalahHostDrama,
  asalDrama,
  hostDramaBawaan,
  jalurMilikDrama,
  rencanaDrama,
  tanpaAwalanDrama,
  tautanDrama,
} from "@/lib/situs-drama";
import { rencanaSitus } from "@/lib/situs";
import {
  alamatAliranHulu,
  alamatAliranHuluSemua,
  alamatHulu,
  alamatHuluSemua,
  API_HULU_BAWAAN,
  barisDaftar,
  cariPlatform,
  daftarApiHulu,
  gulirBerikut,
  penomoran,
  PLATFORM,
  platformAktif,
  platformTerbuka,
} from "@/lib/drama";
import {
  ambilJawaban,
  isiSimpanan,
  kosongkanSimpanan,
  kunciSimpanan,
  nilaiCatatan,
  simpanJawaban,
  umurSimpanan,
  usiaDetik,
} from "@/lib/drama-simpanan";
import {
  bacaDaftar,
  bacaDaftarEpisode,
  bacaEpisodeTunggal,
  bacaHalaman,
  bacaKartu,
  bacaKursor,
  bacaRinci,
  kumpulkanAliran,
} from "@/lib/drama-baca";
import {
  alamatPenerus,
  jenisIsi,
  tampakDaftarPutar,
  tautanAman,
  tulisUlangDaftarPutar,
} from "@/lib/drama-aliran";
import { berwadahShortmax, bukaWadahShortmax } from "@/lib/drama-wadah";
import { createCipheriv, randomBytes } from "node:crypto";

let lulus = 0;
let gagal = 0;
function cek(nama: string, syarat: boolean, keterangan = "") {
  if (syarat) { lulus += 1; console.log(`  ok   ${nama}`); }
  else { gagal += 1; console.log(`  GAGAL ${nama}${keterangan ? " — " + keterangan : ""}`); }
}

function sama(nama: string, dapat: unknown, harap: unknown) {
  cek(nama, JSON.stringify(dapat) === JSON.stringify(harap), `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);
}

const DRAMA = "sipalingfisip.online";
const PORTAL = "www.sipalingfisip.web.id";
const CBT = "cbt.sipalingfisip.web.id";

// ============================================================
console.log("\n== MENGENALI SITUS DRAMA ==");
// ============================================================
sama("nama bawaannya", hostDramaBawaan(), DRAMA);
cek("domainnya dikenali", adalahHostDrama(DRAMA));
cek("bentuk www ikut dikenali", adalahHostDrama(`www.${DRAMA}`));
cek("huruf besar tidak menipu", adalahHostDrama("SiPalingFisip.Online"));
cek("porta ikut dibuang", adalahHostDrama(`${DRAMA}:443`));
cek("portal bukan situs drama", !adalahHostDrama(PORTAL));
cek("subdomain CBT bukan situs drama", !adalahHostDrama(CBT));
cek("nama yang mirip tidak ikut", !adalahHostDrama("sipalingfisip.online.example.com"));
cek("kosong bukan situs drama", !adalahHostDrama(null));

console.log("\n== JALUR MILIK SITUS DRAMA ==");
cek("akarnya milik drama", jalurMilikDrama("/"));
cek("halaman lain bukan", !jalurMilikDrama("/login"));
sama("awalan /drama dibuang", tanpaAwalanDrama("/drama"), "/");
sama("awalan /drama pada jalur dalam", tanpaAwalanDrama("/drama/apa"), "/apa");
sama("jalur lain tidak disentuh", tanpaAwalanDrama("/alat"), "/alat");

console.log("\n== ALAMAT YANG DIPAKAI TOMBOL ==");
sama("dari portal", asalDrama(PORTAL), `https://${DRAMA}`);
sama("dari domain drama sendiri", asalDrama(DRAMA), `https://${DRAMA}`);
sama("localhost tidak punya domain drama", asalDrama("localhost:3000"), "");
sama("pratayang penyebaran juga tidak", asalDrama("sipaling-fisip-abc.vercel.app"), "");
sama("alamat IP juga tidak", asalDrama("127.0.0.1:3000"), "");
sama("tautan di produksi", tautanDrama(PORTAL), `https://${DRAMA}`);
sama("tautan saat dikembangkan", tautanDrama("localhost:3000"), "/drama");

// ============================================================
console.log("\n== RENCANA RUTE: DI DOMAIN DRAMA ==");
// ============================================================
sama("akar ditulis ulang ke /drama",
  rencanaDrama(DRAMA, "/"), { tindakan: "tulis-ulang", pathname: "/drama" });
sama("/drama dirapikan kembali ke akar",
  rencanaDrama(DRAMA, "/drama"), { tindakan: "alih", host: "", pathname: "/" });
sama("halaman portal dialihkan ke portal",
  rencanaDrama(DRAMA, "/login"), { tindakan: "alih", host: PORTAL, pathname: "/login" });
sama("halaman Cakrawala juga",
  rencanaDrama(DRAMA, "/alat"), { tindakan: "alih", host: PORTAL, pathname: "/alat" });
sama("API dipakai bersama, tidak disentuh", rencanaDrama(DRAMA, "/api/drama/pinedrama/populer"), null);
sama("bundel Next.js tidak disentuh", rencanaDrama(DRAMA, "/_next/static/chunk.js"), null);
sama("berkas statis tidak disentuh", rencanaDrama(DRAMA, "/images/latar.png"), null);

console.log("\n== RENCANA RUTE: DI DOMAIN LAIN ==");
sama("/drama di portal dialihkan ke domain drama",
  rencanaDrama(PORTAL, "/drama"), { tindakan: "alih", host: DRAMA, pathname: "/" });
sama("/drama di subdomain CBT juga",
  rencanaDrama(CBT, "/drama"), { tindakan: "alih", host: DRAMA, pathname: "/" });
sama("halaman portal lain bukan urusan drama", rencanaDrama(PORTAL, "/alat"), null);
sama("akar portal bukan urusan drama", rencanaDrama(PORTAL, "/"), null);
sama("di localhost /drama tetap dilayani di tempat", rencanaDrama("localhost:3000", "/drama"), null);
sama("di pratayang penyebaran juga", rencanaDrama("sipaling-fisip-abc.vercel.app", "/drama"), null);

console.log("\n== ATURAN CBT TIDAK IKUT BERUBAH ==");
// Yang di bawah membuktikan penambahan situs drama tidak menggeser satu pun
// aturan yang sudah menentukan ke mana peserta ujian mendarat.
sama("akar subdomain CBT tetap ke /cbt",
  rencanaSitus(CBT, "/"), { tindakan: "tulis-ulang", pathname: "/cbt" });
sama("/ujian di subdomain CBT tetap ditulis ulang",
  rencanaSitus(CBT, "/ujian"), { tindakan: "tulis-ulang", pathname: "/cbt/ujian" });
sama("/cbt di portal tetap dialihkan ke subdomain",
  rencanaSitus(PORTAL, "/cbt"), { tindakan: "alih", host: CBT, pathname: "/" });
sama("halaman portal biasa tetap lewat", rencanaSitus(PORTAL, "/dashboard"), { tindakan: "lewat" });
sama("akar domain drama lewat rencanaSitus",
  rencanaSitus(DRAMA, "/"), { tindakan: "tulis-ulang", pathname: "/drama" });

console.log("\n== DOMAIN DRAMA DAPAT DIPINDAH ==");
{
  const semula = process.env.NEXT_PUBLIC_DRAMA_HOST;
  process.env.NEXT_PUBLIC_DRAMA_HOST = "nonton.contoh.id";

  cek("domain baru dikenali", adalahHostDrama("nonton.contoh.id"));
  cek("domain lama berhenti dikenali", !adalahHostDrama(DRAMA));
  sama("tombol ikut menunjuk domain baru", asalDrama(PORTAL), "https://nonton.contoh.id");
  sama("/drama di portal ikut ke domain baru",
    rencanaDrama(PORTAL, "/drama"), { tindakan: "alih", host: "nonton.contoh.id", pathname: "/" });

  if (semula === undefined) delete process.env.NEXT_PUBLIC_DRAMA_HOST;
  else process.env.NEXT_PUBLIC_DRAMA_HOST = semula;
}

// ============================================================
console.log("\n== TABEL SUMBER ==");
// ============================================================
cek("ada platform yang hidup", platformAktif().length >= 8);
cek("dramanova dimatikan seperti di hulu", cariPlatform("dramanova")?.aktif === false);
sama("platform yang dimatikan tidak dapat dibuka", platformTerbuka("dramanova"), null);
sama("nama yang tidak ada juga tidak", platformTerbuka("tidakada"), null);
cek("platform yang hidup dapat dibuka", platformTerbuka("pinedrama")?.id === "pinedrama");

for (const platform of PLATFORM) {
  const titik = Object.entries(platform.titik);
  cek(`${platform.id}: punya titik`, titik.length > 0);
  cek(`${platform.id}: punya cara membuka satu judul`, Boolean(platform.titik.rinci));
  cek(`${platform.id}: punya pencarian`, Boolean(platform.titik.cari));
  cek(
    `${platform.id}: tiap titik mencatat berkas hulunya`,
    titik.every(([, isi]) => Boolean(isi?.berkas)),
  );
  cek(
    `${platform.id}: inisialnya dua huruf`,
    platform.inisial.length === 2 && /^[A-Z]{2}$/.test(platform.inisial),
  );
}

{
  const inisial = PLATFORM.map((item) => item.inisial);
  cek("tidak ada inisial kembar", new Set(inisial).size === inisial.length);
  const id = PLATFORM.map((item) => item.id);
  cek("tidak ada id kembar", new Set(id).size === id.length);
}

console.log("\n== MENYUSUN ALAMAT HULU ==");
{
  const pine = cariPlatform("pinedrama")!;
  sama("daftar populer PineDrama",
    alamatHulu(pine, "populer"), "https://api.sansekai.my.id/api/pinedrama/trending?cursor=1");
  sama("halaman berikutnya memakai kursor dari hulu",
    alamatHulu(pine, "lainnya", { halaman: "MTIz" }), "https://api.sansekai.my.id/api/pinedrama/foryou?cursor=MTIz");
  sama("rincian memakai collection_id",
    alamatHulu(pine, "rinci", { id: "77" }), "https://api.sansekai.my.id/api/pinedrama/detail?collection_id=77");
  sama("episode membawa nomornya",
    alamatHulu(pine, "episode", { id: "77", episode: 3 }),
    "https://api.sansekai.my.id/api/pinedrama/get-episode?collection_id=77&episodeNumber=3");
  sama("rincian tanpa id ditolak", alamatHulu(pine, "rinci", {}), null);
  sama("episode tanpa nomor ditolak", alamatHulu(pine, "episode", { id: "77" }), null);
  sama("episode bernomor nol ditolak", alamatHulu(pine, "episode", { id: "77", episode: 0 }), null);
  sama("pencarian kosong ditolak", alamatHulu(pine, "cari", { cari: "   " }), null);
  sama("PineDrama tidak punya daftar terbaru", alamatHulu(pine, "terbaru"), null);

  sama("kata pencarian disandikan",
    alamatHulu(pine, "cari", { cari: "cinta & rindu" }),
    "https://api.sansekai.my.id/api/pinedrama/search?query=cinta+%26+rindu");

  const box = cariPlatform("dramabox")!;
  sama("DramaBox mengambil seluruh episode sekaligus",
    alamatHulu(box, "episode", { id: "9" }), "https://api.sansekai.my.id/api/dramabox/get-allepisode?bookId=9");
  sama("penyiapan tautan videonya lewat hulu",
    alamatAliranHulu(box, "abc123"), "https://api.sansekai.my.id/api/dramabox/decrypt-video?url=abc123");

  const flick = cariPlatform("flickreels")!;
  sama("platform tanpa jalur aliran tidak mengarang satu",
    alamatAliranHulu(flick, "abc"), null);

  const melolo = cariPlatform("melolo")!;
  sama("Melolo memakai geseran, bukan nomor halaman",
    alamatHulu(melolo, "lainnya"), "https://api.sansekai.my.id/api/melolo/foryou?offset=0");

  sama("baris yang digambar hanya yang dilayani",
    barisDaftar(pine).map((item) => item.aksi), ["populer", "lainnya"]);
  sama("DramaBox menggambar ketiganya",
    barisDaftar(box).map((item) => item.aksi), ["populer", "terbaru", "lainnya"]);
}

console.log("\n== ALAMAT API HULU DAPAT DIPINDAH ==");
{
  const semula = process.env.DRAMA_API_BASE;
  process.env.DRAMA_API_BASE = "https://api.contoh.id/v2/";
  sama("seluruh alamat ikut pindah",
    alamatHulu(cariPlatform("dramabox")!, "terbaru"), "https://api.contoh.id/v2/dramabox/latest");
  if (semula === undefined) delete process.env.DRAMA_API_BASE;
  else process.env.DRAMA_API_BASE = semula;
}

// ============================================================
console.log("\n== HULU BOLEH LEBIH DARI SATU ==");
//
// Satu alamat hulu berarti satu titik yang, begitu mati, mematikan seluruh
// menu. Yang diuji di sini bukan kerapian penguraiannya melainkan janjinya:
// menyetel cadangan benar-benar melahirkan alamat kedua yang dapat dicoba.
// ============================================================
{
  const semula = process.env.DRAMA_API_BASE;
  const pakai = (nilai: string | undefined) => {
    if (nilai === undefined) delete process.env.DRAMA_API_BASE;
    else process.env.DRAMA_API_BASE = nilai;
  };

  pakai(undefined);
  sama("tanpa setelan, satu alamat bawaan", daftarApiHulu(), [API_HULU_BAWAAN]);

  pakai("https://satu.contoh/api, https://dua.contoh/api");
  sama("dipisah koma", daftarApiHulu(), ["https://satu.contoh/api", "https://dua.contoh/api"]);

  pakai("https://satu.contoh/api/   https://dua.contoh/api//");
  sama("dipisah spasi, garis miring di ekor dibuang",
    daftarApiHulu(), ["https://satu.contoh/api", "https://dua.contoh/api"]);

  pakai("https://satu.contoh/api,https://satu.contoh/api");
  sama("alamat kembar dibuang", daftarApiHulu(), ["https://satu.contoh/api"]);

  pakai("   ");
  sama("setelan kosong kembali ke bawaan", daftarApiHulu(), [API_HULU_BAWAAN]);

  pakai("https://satu.contoh/api, https://dua.contoh/api");
  const box = cariPlatform("dramabox")!;
  sama("tiap hulu dapat alamatnya sendiri",
    alamatHuluSemua(box, "terbaru"),
    ["https://satu.contoh/api/dramabox/latest", "https://dua.contoh/api/dramabox/latest"]);
  sama("yang pertama tetap yang dipulangkan alamatHulu",
    alamatHulu(box, "terbaru"), "https://satu.contoh/api/dramabox/latest");
  sama("penyiapan tautan video ikut punya cadangan",
    alamatAliranHuluSemua(box, "abc"),
    [
      "https://satu.contoh/api/dramabox/decrypt-video?url=abc",
      "https://dua.contoh/api/dramabox/decrypt-video?url=abc",
    ]);

  const pine = cariPlatform("pinedrama")!;
  sama("permintaan yang tidak dilayani tetap kosong, bukan daftar alamat",
    alamatHuluSemua(pine, "terbaru"), []);
  sama("rincian tanpa id juga kosong", alamatHuluSemua(pine, "rinci", {}), []);
  sama("platform tanpa jalur aliran tidak mengarang cadangan",
    alamatAliranHuluSemua(cariPlatform("flickreels")!, "abc"), []);

  pakai(semula);
}

// ============================================================
console.log("\n== UMUR SIMPANAN JAWABAN ==");
//
// Angka-angkanya mengikuti seberapa cepat isinya benar-benar berubah. Yang
// paling penting dibuktikan di sini yang PALING PENDEK: tautan video
// bertanda tangan dan kedaluwarsa sendiri, jadi menyimpannya selama daftar
// judul berarti menukar satu pesan galat dengan video yang berhenti sendiri.
// ============================================================
{
  const daftar = umurSimpanan("populer");
  const rinci = umurSimpanan("rinci");
  const episode = umurSimpanan("episode");

  cek("episode disimpan paling sebentar", episode.basiMs < rinci.basiMs && episode.basiMs < daftar.basiMs);
  cek("daftar judul boleh basi paling lama", daftar.basiMs >= rinci.basiMs);
  cek("seluruhnya punya masa segar lebih pendek daripada masa basi",
    daftar.segarMs < daftar.basiMs && rinci.segarMs < rinci.basiMs && episode.segarMs < episode.basiMs);
  sama("pencarian sama umurnya dengan daftar lain", umurSimpanan("cari"), umurSimpanan("terbaru"));
}

console.log("\n== MENILAI CATATAN SIMPANAN ==");
{
  const umur = { segarMs: 1_000, basiMs: 10_000 };
  sama("baru disimpan", nilaiCatatan(1_000, 1_000, umur), "segar");
  sama("tepat di batas segar", nilaiCatatan(1_000, 2_000, umur), "segar");
  sama("sedetik sesudahnya sudah basi", nilaiCatatan(1_000, 2_001, umur), "basi");
  sama("tepat di batas basi masih terpakai", nilaiCatatan(1_000, 11_000, umur), "basi");
  sama("lewat dari itu tidak terpakai lagi", nilaiCatatan(1_000, 11_001, umur), "kedaluwarsa");
  // Jam mesin yang mundur di tengah jalan tidak boleh menghapus simpanan
  // justru pada saat ia paling dibutuhkan.
  sama("catatan dari masa depan dianggap segar", nilaiCatatan(9_000, 1_000, umur), "segar");

  sama("usia dibulatkan ke bawah", usiaDetik(1_000, 6_900), 5);
  sama("usia tidak pernah negatif", usiaDetik(9_000, 1_000), 0);
}

console.log("\n== LEMARI SIMPANAN ==");
{
  kosongkanSimpanan();
  const umur = { segarMs: 1_000, basiMs: 10_000 };
  const kunci = kunciSimpanan("dramabox", "populer", "/dramabox/trending");

  sama("kunci memuat platform dan aksinya", kunci, "dramabox:populer:/dramabox/trending");
  sama("yang belum pernah disimpan tidak ada", ambilJawaban(kunci, umur, 1_000), null);

  simpanJawaban(kunci, { daftar: ["a"] }, 1_000);
  sama("yang baru disimpan kembali utuh dan segar",
    ambilJawaban(kunci, umur, 1_500), { isi: { daftar: ["a"] }, nilai: "segar", usiaDetik: 0 });
  sama("sesudah masa segar habis, masih terpakai sebagai basi",
    ambilJawaban(kunci, umur, 6_000), { isi: { daftar: ["a"] }, nilai: "basi", usiaDetik: 5 });
  sama("yang sudah terlalu tua tidak dipulangkan sama sekali",
    ambilJawaban(kunci, umur, 60_000), null);
  sama("dan sekaligus dibuang dari lemarinya", isiSimpanan(), 0);

  // Menyimpan ulang kunci yang sama menyegarkan waktunya, bukan menambah
  // catatan kedua.
  simpanJawaban(kunci, { daftar: ["a"] }, 1_000);
  simpanJawaban(kunci, { daftar: ["b"] }, 5_000);
  sama("satu kunci tetap satu catatan", isiSimpanan(), 1);
  sama("yang tersimpan yang terakhir",
    ambilJawaban(kunci, umur, 5_000), { isi: { daftar: ["b"] }, nilai: "segar", usiaDetik: 0 });
  kosongkanSimpanan();
}

// ============================================================
console.log("\n== MEMBACA DAFTAR JUDUL ==");
// ============================================================
{
  // Bentuk PineDrama: larik di bawah "collections".
  const pine = {
    has_more: true,
    cursor: "MTA=",
    collections: [
      { collection_id: "12", title: "Bos Muda", cover: "https://x/1.jpg", total_episodes: 60, tags: ["CEO"] },
      { collection_id: "13", title: "Balas Dendam", cover: "https://x/2.jpg", total_episodes: 74 },
    ],
  };
  const dari = bacaDaftar(pine);
  sama("dua judul terbaca", dari.length, 2);
  sama("id terbaca", dari[0].id, "12");
  sama("judul terbaca", dari[0].judul, "Bos Muda");
  sama("jumlah episode terbaca", dari[0].episode, 60);
  sama("label terbaca", dari[0].label, ["CEO"]);
  sama("kursor terbaca", bacaKursor(pine), "MTA=");

  // Bentuk DramaBox: larik telanjang, nama kolom lain.
  const box = [
    { bookId: "A1", bookName: "Istri Rahasia", coverWap: "https://x/3.jpg", chapterCount: 80, introduction: "Ringkas." },
  ];
  const dariBox = bacaDaftar(box);
  sama("larik telanjang ikut terbaca", dariBox.length, 1);
  sama("coverWap terbaca sebagai sampul", dariBox[0].sampul, "https://x/3.jpg");
  sama("introduction terbaca sebagai ringkasan", dariBox[0].ringkasan, "Ringkas.");

  // Bentuk berlapis: data.records.
  const berlapis = { code: 0, data: { records: [{ shortPlayId: 9, shortPlayName: "Tuan Tanah", cover: "//x/4.jpg" }] } };
  const dariLapis = bacaDaftar(berlapis);
  sama("larik berlapis ditemukan", dariLapis.length, 1);
  sama("id berupa angka tetap terbaca", dariLapis[0].id, "9");
  sama("alamat tanpa protokol dinaikkan ke https", dariLapis[0].sampul, "https://x/4.jpg");

  sama("jawaban kosong menghasilkan daftar kosong", bacaDaftar({ data: [] }), []);
  sama("jawaban tanpa bentuk yang dikenal juga", bacaDaftar({ pesan: "galat" }), []);
  sama("kursor hilang saat hulu bilang sudah habis", bacaKursor({ has_more: false, cursor: "x" }), "");

  sama("judul tanpa id dibuang", bacaKartu({ title: "Tanpa Id" }), null);
  sama("judul tanpa nama dibuang", bacaKartu({ bookId: "1" }), null);

  const kembar = bacaDaftar([{ bookId: "1", bookName: "A" }, { bookId: "1", bookName: "A" }]);
  sama("judul kembar hanya dihitung sekali", kembar.length, 1);

  // Spanduk di atas isinya tidak boleh terbaca sebagai daftar judul.
  const adaSpanduk = {
    banners: [{ image: "https://x/b.jpg" }],
    data: { list: [{ bookId: "7", bookName: "Yang Benar" }] },
  };
  sama("spanduk tanpa judul dilewati", bacaDaftar(adaSpanduk).map((item) => item.id), ["7"]);
}

// ============================================================
console.log("\n== MEMBACA EPISODE DAN TAUTAN VIDEO ==");
// ============================================================
{
  const satu = { best_url: "https://cdn/a.mp4", main: { indo_cdn_urls: ["https://cdn/b.mp4"] } };
  const aliran = kumpulkanAliran(satu);
  sama("best_url didahulukan", aliran[0].url, "https://cdn/a.mp4");
  cek("tautan cadangan ikut terbawa", aliran.some((item) => item.url === "https://cdn/b.mp4"));
  cek("mp4 tidak ditandai HLS", aliran[0].hls === false);

  const hls = kumpulkanAliran({ episode: { videoUrl: "https://cdn/master.m3u8" } });
  sama("tautan m3u8 ditemukan walau bersarang", hls[0].url, "https://cdn/master.m3u8");
  cek("m3u8 ditandai HLS", hls[0].hls);

  const mutu = kumpulkanAliran({ multiVideos: [{ type: "720p", filePath: "https://cdn/720.m3u8" }] });
  sama("mutu ikut terbaca", mutu[0].mutu, "720p");

  const tersandi = kumpulkanAliran({
    cdnList: [{ isDefault: 1, videoPathList: [{ quality: 720, videoPath: "u0J2kQ7xAbcdEfgh1234" }] }],
  });
  sama("videoPath yang bukan alamat tetap terbawa", tersandi.length, 1);
  cek("dan ditandai perlu disiapkan hulu", tersandi[0].lewatHulu);

  sama("jawaban tanpa tautan menghasilkan daftar kosong", kumpulkanAliran({ pesan: "kosong" }), []);

  const daftar = bacaDaftarEpisode({
    chapterList: [
      { chapterId: "c1", chapterName: "Ep 1", chapterIndex: 1, mp4: "https://cdn/1.mp4" },
      { chapterId: "c2", chapterName: "Ep 2", chapterIndex: 2, mp4: "https://cdn/2.mp4" },
    ],
  });
  sama("dua episode terbaca", daftar.length, 2);
  sama("nomornya terbaca", daftar.map((item) => item.nomor), [1, 2]);
  sama("id episode terbaca", daftar[1].id, "c2");
  sama("tautannya ikut", daftar[1].aliran[0].url, "https://cdn/2.mp4");

  const tanpaNomor = bacaDaftarEpisode({ episodes: [{ id: "a", sort: 0 }, { id: "b", sort: 0 }] });
  sama("nomor kembar diganti urutan", tanpaNomor.map((item) => item.nomor), [1, 2]);

  const tunggal = bacaEpisodeTunggal({ episode: { videoUrl: "https://cdn/x.m3u8" } }, 5);
  sama("episode tunggal memakai nomor yang diminta", tunggal.nomor, 5);
  sama("dan membawa tautannya", tunggal.aliran[0].url, "https://cdn/x.m3u8");
}

// ============================================================
console.log("\n== MEMBACA RINCIAN JUDUL ==");
// ============================================================
{
  const rinci = bacaRinci(
    {
      data: {
        book: { bookId: "A1", bookName: "Istri Rahasia", cover: "https://x/3.jpg", chapterCount: 80, introduction: "Ceritanya." },
        chapterList: [{ chapterId: "c1", chapterIndex: 1 }],
      },
    },
    "A1",
  );
  sama("judul dari objek bersarang terbaca", rinci.judul, "Istri Rahasia");
  sama("sampulnya juga", rinci.sampul, "https://x/3.jpg");
  sama("jumlah episode dari hulu dipercaya", rinci.episode, 80);
  sama("daftar episodenya ikut", rinci.daftar.length, 1);

  const miskin = bacaRinci({}, "A1", {
    id: "A1", judul: "Dari Kartu", sampul: "https://x/9.jpg", episode: 12, ringkasan: "Ringkas", label: ["Cinta"],
  });
  sama("kartu dipakai saat rincian kosong", miskin.judul, "Dari Kartu");
  sama("jumlah episodenya juga", miskin.episode, 12);
  sama("id tetap terisi", miskin.id, "A1");
}

// ============================================================
console.log("\n== TAUTAN VIDEO YANG PERNAH HILANG ==");
//
// Tiap pemeriksaan di bawah ini mewakili satu platform yang daftarnya tampil
// rapi tetapi videonya tidak pernah jalan. Semuanya sebab yang sama: nama
// kolom yang dipakai hulu tidak tercatat di pembaca, sehingga episodenya
// terbaca sebagai episode tanpa tautan sama sekali.
// ============================================================
{
  const netshort = kumpulkanAliran({
    episodeList: [{ episodeId: "e9", playVoucher: "https://cdn/ns.m3u8", playVoucherBak: "https://cdn/ns2.m3u8" }],
  });
  sama("NetShort: playVoucher terbaca", netshort[0]?.url, "https://cdn/ns.m3u8");
  cek("NetShort: cadangannya ikut terbawa", netshort.some((item) => item.url === "https://cdn/ns2.m3u8"));

  const melolo = kumpulkanAliran({ data: { main_url_decoded: "https://cdn/ml.mp4", main_url: "tersandi" } });
  sama("Melolo: alamat yang sudah dipulihkan didahulukan", melolo[0]?.url, "https://cdn/ml.mp4");

  const goodshort = bacaDaftarEpisode(
    {
      data: {
        bookName: "Judul",
        downloadList: [
          { chapterId: "g1", chapterIndex: 1, multiVideos: [{ type: "720p", filePath: "https://cdn/gs.m3u8" }] },
        ],
      },
    },
    { kunciLewatHulu: ["filePath"] },
  );
  sama("GoodShort: downloadList terbaca sebagai daftar episode", goodshort.length, 1);
  sama("GoodShort: tautannya ikut", goodshort[0]?.aliran[0]?.url, "https://cdn/gs.m3u8");
  cek("GoodShort: filePath selalu disiapkan hulu walau sudah berbentuk alamat",
    goodshort[0]?.aliran[0]?.lewatHulu === true);

  const dramabox = kumpulkanAliran(
    { cdnList: [{ videoPathList: [{ quality: 720, videoPath: "https://cdn/db.mp4" }] }] },
    { kunciLewatHulu: ["videoPath"] },
  );
  cek("DramaBox: videoPath berbentuk alamat pun tetap lewat hulu", dramabox[0]?.lewatHulu === true);

  const tanpaTabel = kumpulkanAliran({ cdnList: [{ videoPathList: [{ videoPath: "https://cdn/db.mp4" }] }] });
  cek("dan tanpa keterangan tabel, alamat biasa tetap dibuka apa adanya",
    tanpaTabel[0]?.lewatHulu === false);

  const shortmax = kumpulkanAliran({ episode: { videoUrl: { "1080p": "https://cdn/a.m3u8", "540p": "https://cdn/b.m3u8" } } });
  sama("ShortMax: mutu terbaca dari nama kuncinya", shortmax[0]?.mutu, "1080p");
  sama("dan mutu kedua juga", shortmax[1]?.mutu, "540p");

  const reelshort = kumpulkanAliran({
    videoList: [
      { url: "https://cdn/h265.m3u8", encode: "H265", quality: 1080 },
      { url: "https://cdn/h264.m3u8", encode: "H264", quality: 720 },
    ],
  });
  sama("ReelShort: H264 didahulukan karena H265 tidak diputar banyak peramban",
    reelshort[0]?.url, "https://cdn/h264.m3u8");
  cek("tetapi H265 tidak dibuang, hanya ditaruh di belakang",
    reelshort.some((item) => item.url === "https://cdn/h265.m3u8"));
  sama("cara memampatkannya ikut disebut di tombol mutu", reelshort[0]?.mutu, "720p H264");
}

// ============================================================
console.log("\n== PENOMORAN DAN GULIR TAK BERHINGGA ==");
// ============================================================
{
  sama("hulu bilang masih ada, kursornya dipulangkan",
    bacaHalaman({ has_more: true, cursor: "MTA=" }), { kursor: "MTA=", habis: false });
  sama("hulu bilang habis, kursornya dibuang",
    bacaHalaman({ has_more: false, cursor: "MTA=" }), { kursor: "", habis: true });
  sama("Melolo: next_offset terbaca sebagai penanda",
    bacaHalaman({ has_more: true, next_offset: 20 }), { kursor: "20", habis: false });
  sama("FreeReels: has_more bersarang di data.page_info ikut terbaca",
    bacaHalaman({ data: { page_info: { has_more: false, next: "x" } } }), { kursor: "", habis: true });
  sama("GoodShort: halaman terakhir dikenali dari current dan pages",
    bacaHalaman({ data: { current: 3, pages: 3, records: [] } }), { kursor: "", habis: true });
  cek("GoodShort: halaman tengah belum habis",
    bacaHalaman({ data: { current: 2, pages: 5 } }).habis === false);
  sama("ShortMax: isEnd menghentikan daftar", bacaHalaman({ isEnd: true }), { kursor: "", habis: true });
  sama("NetShort: completed juga", bacaHalaman({ completed: true }), { kursor: "", habis: true });
  sama("geseran nol bukan penanda berikutnya", bacaHalaman({ offset: 0 }).kursor, "");
  sama("jawaban tanpa keterangan apa pun belum berarti habis",
    bacaHalaman({ data: [] }), { kursor: "", habis: false });

  const halamanDramaBox = penomoran(cariPlatform("dramabox")!, "lainnya")!;
  sama("DramaBox memakai nomor halaman", halamanDramaBox.kunci, "page");
  sama("halaman kedua dihitung sendiri saat hulu tidak menyebutkannya",
    gulirBerikut(halamanDramaBox, { potong: 1, kursor: "", habis: false }), "2");
  sama("penanda dari hulu selalu lebih dipercaya",
    gulirBerikut(halamanDramaBox, { potong: 1, kursor: "77", habis: false }), "77");
  sama("hulu bilang habis berarti berhenti",
    gulirBerikut(halamanDramaBox, { potong: 1, kursor: "2", habis: true }), null);
  sama("batas potongan menghentikannya juga",
    gulirBerikut(halamanDramaBox, { potong: halamanDramaBox.batas, kursor: "9", habis: false }), null);

  const halamanMelolo = penomoran(cariPlatform("melolo")!, "lainnya")!;
  sama("Melolo bergeser, bukan berhalaman", halamanMelolo.kunci, "offset");
  sama("geserannya melompat sebanyak langkahnya",
    gulirBerikut(halamanMelolo, { potong: 2, kursor: "", habis: false }), "40");

  const halamanPine = penomoran(cariPlatform("pinedrama")!, "lainnya")!;
  sama("PineDrama memakai kursor", halamanPine.kunci, "cursor");
  sama("kursor yang habis tidak dapat ditebak sendiri",
    gulirBerikut(halamanPine, { potong: 1, kursor: "", habis: false }), null);
  sama("PineDrama berhenti di sepuluh potong, sama seperti hulu", halamanPine.batas, 10);

  sama("baris tanpa penomoran tidak pernah menarik potongan kedua",
    gulirBerikut(null, { potong: 1, kursor: "x", habis: false }), null);
  sama("dan Terbaru DramaBox memang begitu", penomoran(cariPlatform("dramabox")!, "terbaru"), null);
}

// ============================================================
console.log("\n== MEMBEDAKAN DAFTAR PUTAR DARI POTONGAN VIDEO ==");
//
// Inilah pemeriksaan yang menjaga bug terburuk di menu ini: potongan video
// yang dibaca sebagai teks pulang dalam keadaan rusak permanen, dan yang
// tampil di layar bukan pesan galat melainkan pemutar yang diam.
// ============================================================
{
  const huruf = (isi: string) => new Uint8Array(Buffer.from(isi, "utf8"));

  cek("daftar putar dikenali", tampakDaftarPutar(huruf("#EXTM3U\n#EXTINF:6,\na.ts")));
  cek("ruang kosong di depannya dilewati", tampakDaftarPutar(huruf("\n  #EXTM3U\n")));
  cek("penanda urutan bita di depannya juga",
    tampakDaftarPutar(new Uint8Array([0xef, 0xbb, 0xbf, ...huruf("#EXTM3U")])));

  // Potongan MPEG-TS sungguhan: bita pertamanya 0x47, sisanya bita apa saja.
  const potongan = new Uint8Array(1024);
  potongan[0] = 0x47;
  potongan[1] = 0x1f;
  potongan[2] = 0xff;
  cek("potongan video TIDAK dikenali sebagai daftar putar", !tampakDaftarPutar(potongan));
  cek("berkas kosong juga tidak", !tampakDaftarPutar(new Uint8Array(0)));
  cek("teks lain yang kebetulan berawalan pagar juga tidak",
    !tampakDaftarPutar(huruf("#EXTINF:6,\na.ts")));
}

// ============================================================
console.log("\n== MEMBUKA WADAH POTONGAN SHORTMAX ==");
// ============================================================
{
  const biasa = Buffer.alloc(2048);
  biasa[0] = 0x47;
  cek("potongan yang sudah siap tidak dikenali berwadah", !berwadahShortmax(biasa));
  cek("dan dipulangkan apa adanya", bukaWadahShortmax(biasa).equals(biasa));

  const pendek = Buffer.from("shortmax");
  cek("berkas lebih pendek daripada kepalanya bukan wadah", !berwadahShortmax(pendek));

  const lain = Buffer.alloc(2048);
  lain.write("bukanini", 0, "ascii");
  cek("wadah dengan nama lain dilewati", !berwadahShortmax(lain));
  cek("dan isinya tidak disentuh", bukaWadahShortmax(lain).equals(lain));

  // Wadah yang disusun persis seperti yang dikirim platformnya, lalu dibuka.
  // Inilah pemeriksaan yang membuktikan pembukanya benar-benar bekerja — bukan
  // sekadar tidak melempar. Hulu memulihkannya dengan pelucutan ganjal
  // dinyalakan, dan berkas seperti di bawah ini membuat pustakanya melempar;
  // di sini ganjalnya dimatikan, sehingga isinya benar-benar pulih.
  {
    const AWAL = Buffer.from("shortmax00000000", "ascii");
    const kunci = randomBytes(16);

    const asliDepan = Buffer.alloc(1040);
    asliDepan[0] = 0x47;
    for (let nomor = 1; nomor < 1040; nomor += 1) asliDepan[nomor] = (nomor * 7) % 256;
    const asliBelakang = randomBytes(2000);

    const penyandi = createCipheriv("aes-128-cbc", kunci, AWAL);
    penyandi.setAutoPadding(false);
    const tersandi = Buffer.concat([penyandi.update(asliDepan), penyandi.final()]);

    const posisiKunci = 200;
    const kepala = Buffer.alloc(1040);
    kepala.write("shortmax", 0, "ascii");
    kepala.write(String(posisiKunci).padStart(4, "0"), 16, "ascii");
    kunci.copy(kepala, 24 + (posisiKunci - 24));
    tersandi.subarray(0, 16).copy(kepala, 1024);

    const berkas = Buffer.concat([kepala, tersandi.subarray(16), asliBelakang]);
    const hasil = bukaWadahShortmax(berkas);

    cek("wadah utuh dikenali", berwadahShortmax(berkas));
    cek("isinya pulih sebagai potongan video yang sah", hasil[0] === 0x47);
    cek("bagian yang tersandi pulih utuh", hasil.subarray(0, 1040).equals(asliDepan));
    cek("bagian yang tidak tersandi ikut utuh", hasil.subarray(1040).equals(asliBelakang));
    sama("panjang isinya benar", hasil.length, 1040 + 2000);
  }

  // Wadah yang kepalanya cacat: posisi kuncinya menunjuk ke luar kepalanya.
  const cacat = Buffer.alloc(3072);
  cacat.write("shortmax", 0, "ascii");
  cacat.write("9999", 16, "ascii");
  cacat[1040] = 0x47;
  const dibuka = bukaWadahShortmax(cacat);
  sama("kepala yang cacat tetap memulangkan isinya", dibuka.length, 3072 - 1040);
  cek("dan isinya benar-benar isi, bukan kepalanya", dibuka[0] === 0x47);
}

// ============================================================
console.log("\n== PENERUS ALIRAN ==");
// ============================================================
cek("alamat biasa diterima", tautanAman("https://cdn.example.com/a.m3u8") !== null);
cek("http biasa juga", tautanAman("http://cdn.example.com/a.ts") !== null);
sama("bukan alamat ditolak", tautanAman("abc123"), null);
sama("skema file ditolak", tautanAman("file:///etc/passwd"), null);
sama("localhost ditolak", tautanAman("http://localhost/a.ts"), null);
sama("alamat balik ditolak", tautanAman("http://127.0.0.1/a.ts"), null);
sama("jaringan dalam 10.x ditolak", tautanAman("http://10.1.2.3/a.ts"), null);
sama("jaringan dalam 192.168.x ditolak", tautanAman("http://192.168.1.1/a.ts"), null);
sama("jaringan dalam 172.16.x ditolak", tautanAman("http://172.16.0.9/a.ts"), null);
sama("alamat metadata awan ditolak", tautanAman("http://169.254.169.254/latest/meta-data"), null);
sama("nama dengan sandi di dalamnya ditolak", tautanAman("https://a:b@cdn.example.com/a.ts"), null);
sama("nama tanpa titik ditolak", tautanAman("https://intranet/a.ts"), null);
sama("akhiran .internal ditolak", tautanAman("https://db.internal/a.ts"), null);
cek("172.32 bukan jaringan dalam", tautanAman("http://172.32.0.1/a.ts") !== null);

sama("alamat penerus dibentuk benar",
  alamatPenerus("https://cdn/a.m3u8", "dramabox"),
  "/api/drama/aliran?url=https%3A%2F%2Fcdn%2Fa.m3u8&platform=dramabox");
cek("penanda hulu ikut bila diminta",
  alamatPenerus("abc", "dramabox", true).includes("&hulu=1"));
cek("dan tidak ikut bila tidak",
  !alamatPenerus("https://cdn/a.m3u8", "dramabox").includes("hulu="));

{
  const daftar = [
    "#EXTM3U",
    "#EXT-X-KEY:METHOD=AES-128,URI=\"key.bin\"",
    "#EXTINF:6.0,",
    "seg1.ts",
    "#EXTINF:6.0,",
    "https://lain.example.com/seg2.ts",
    "",
  ].join("\n");

  const hasil = tulisUlangDaftarPutar(daftar, "https://cdn.example.com/hls/master.m3u8", "goodshort");
  cek("baris tag dipertahankan", hasil.startsWith("#EXTM3U"));
  cek("potongan relatif menjadi alamat penerus",
    hasil.includes("/api/drama/aliran?url=https%3A%2F%2Fcdn.example.com%2Fhls%2Fseg1.ts"));
  cek("potongan beralamat penuh ikut lewat penerus",
    hasil.includes("url=https%3A%2F%2Flain.example.com%2Fseg2.ts"));
  cek("kunci enkripsi HLS ikut dituliskan ulang",
    hasil.includes("URI=\"/api/drama/aliran?url=https%3A%2F%2Fcdn.example.com%2Fhls%2Fkey.bin"));
  cek("nama platform ikut terbawa", hasil.includes("platform=goodshort"));
  cek("penanda hulu tidak ikut ke potongan", !hasil.includes("hulu=1"));
}

console.log("\n== MENEBAK JENIS ISI ==");
sama("m3u8", jenisIsi("https://x/a.m3u8", null), "application/vnd.apple.mpegurl");
sama("potongan ts", jenisIsi("https://x/a.ts", null), "video/mp2t");
sama("mp4", jenisIsi("https://x/a.mp4", null), "video/mp4");
sama("jenis dari hulu dipercaya bila bercerita", jenisIsi("https://x/a", "video/mp4"), "video/mp4");
sama("octet-stream dari hulu diabaikan", jenisIsi("https://x/a.m3u8", "application/octet-stream"), "application/vnd.apple.mpegurl");
sama("berkas tak dikenal", jenisIsi("https://x/a", null), "application/octet-stream");

console.log(`\n${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
