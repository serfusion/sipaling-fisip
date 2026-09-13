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
  alamatHulu,
  barisDaftar,
  cariPlatform,
  PLATFORM,
  platformAktif,
  platformTerbuka,
} from "@/lib/drama";
import {
  bacaDaftar,
  bacaDaftarEpisode,
  bacaEpisodeTunggal,
  bacaKartu,
  bacaKursor,
  bacaRinci,
  kumpulkanAliran,
} from "@/lib/drama-baca";
import { alamatPenerus, jenisIsi, tautanAman, tulisUlangDaftarPutar } from "@/lib/drama-aliran";

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
