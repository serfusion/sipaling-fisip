// Uji alamat situs CBT sesudah ia pindah ke subdomainnya sendiri.
//
// Yang diuji di sini menentukan ke mana mahasiswa mendarat saat membuka
// tautan ujian dari grup kelas — jadi salahnya tidak terasa sebagai bug
// kecil, melainkan sebagai satu kelas yang tidak bisa mulai ujian. Semuanya
// fungsi murni, sehingga dapat dibuktikan di sini tanpa menyalakan server.
import {
  adalahHostCbt,
  asalCbt,
  asalPortal,
  dipakaiBersama,
  hostCbtUntuk,
  hostPortalUntuk,
  rapikanHost,
  rencanaRute,
  tanpaAwalanCbt,
} from "@/lib/situs-cbt";

let lulus = 0;
let gagal = 0;
function cek(nama: string, syarat: boolean, keterangan = "") {
  if (syarat) { lulus += 1; console.log(`  ok   ${nama}`); }
  else { gagal += 1; console.log(`  GAGAL ${nama}${keterangan ? " — " + keterangan : ""}`); }
}

function sama(nama: string, dapat: unknown, harap: unknown) {
  cek(nama, JSON.stringify(dapat) === JSON.stringify(harap), `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);
}

const PORTAL = "www.sipalingfisip.web.id";
const CBT = "cbt.sipalingfisip.web.id";

console.log("\n== MEMBACA HEADER HOST ==");
sama("porta dibuang", rapikanHost("localhost:3000"), "localhost");
sama("huruf besar diturunkan", rapikanHost("CBT.SipalingFisip.web.id"), "cbt.sipalingfisip.web.id");
sama("titik di ujung dibuang", rapikanHost("cbt.sipalingfisip.web.id."), "cbt.sipalingfisip.web.id");
sama("host bertumpuk diambil yang pertama", rapikanHost("cbt.sipalingfisip.web.id, proxy.internal"), CBT);
sama("kosong tetap kosong", rapikanHost(null), "");

console.log("\n== MENGENALI SITUS CBT ==");
cek("subdomain cbt dikenali", adalahHostCbt(CBT));
cek("bentuk www.cbt ikut dikenali", adalahHostCbt(`www.${CBT}`));
cek("huruf besar tidak menipu", adalahHostCbt("CBT.sipalingfisip.web.id"));
cek("portal bukan situs CBT", !adalahHostCbt(PORTAL));
cek("domain telanjang bukan situs CBT", !adalahHostCbt("sipalingfisip.web.id"));
cek("nama yang kebetulan berawalan cbt tidak ikut", !adalahHostCbt("cbtx.sipalingfisip.web.id"));
cek("localhost bukan situs CBT", !adalahHostCbt("localhost"));

console.log("\n== MENCARI SUBDOMAIN CBT ==");
sama("dari portal www", hostCbtUntuk(PORTAL), CBT);
sama("dari domain telanjang", hostCbtUntuk("sipalingfisip.web.id"), CBT);
sama("dari dirinya sendiri", hostCbtUntuk(CBT), CBT);
sama("localhost tidak punya subdomain", hostCbtUntuk("localhost:3000"), "");
sama("pratayang penyebaran tidak punya subdomain", hostCbtUntuk("sipaling-fisip-abc123.vercel.app"), "");
sama("alamat IP tidak punya subdomain", hostCbtUntuk("127.0.0.1:3000"), "");

console.log("\n== JALAN PULANG KE PORTAL ==");
sama("dari subdomain CBT", hostPortalUntuk(CBT), PORTAL);
sama("dari bentuk www.cbt", hostPortalUntuk(`www.${CBT}`), PORTAL);
sama("dari portal, tetap dirinya", hostPortalUntuk(PORTAL), PORTAL);

console.log("\n== ASAL UNTUK TAUTAN ==");
sama("tautan ujian dari dashboard", asalCbt(PORTAL), `https://${CBT}`);
sama("di lokal, tidak ada asal CBT", asalCbt("localhost:3000"), "");
sama("tautan portal dari situs CBT", asalPortal(CBT), `https://${PORTAL}`);
sama("di portal, tautan portal tetap relatif", asalPortal(PORTAL), "");

console.log("\n== JALUR MILIK BERSAMA ==");
cek("/api dilewatkan", dipakaiBersama("/api/cbt/ikut"));
cek("bundel Next dilewatkan", dipakaiBersama("/_next/static/chunk.js"));
cek("berkas statis dilewatkan", dipakaiBersama("/uang-sw.js"));
cek("manifest dilewatkan", dipakaiBersama("/manifest-uang.webmanifest"));
cek("halaman biasa tidak", !dipakaiBersama("/dashboard"));
cek("akar tidak", !dipakaiBersama("/"));

console.log("\n== MEMBUANG AWALAN /cbt ==");
sama("/cbt menjadi akar", tanpaAwalanCbt("/cbt"), "/");
sama("/cbt/ujian menjadi /ujian", tanpaAwalanCbt("/cbt/ujian"), "/ujian");
sama("jalur lain tidak disentuh", tanpaAwalanCbt("/dashboard"), "/dashboard");

console.log("\n== RUTE DI SUBDOMAIN CBT ==");
sama("akar menampilkan pintu masuk CBT",
  rencanaRute(CBT, "/"), { tindakan: "tulis-ulang", pathname: "/cbt" });
sama("/ujian menampilkan layar ujian",
  rencanaRute(CBT, "/ujian"), { tindakan: "tulis-ulang", pathname: "/cbt/ujian" });
sama("bentuk www.cbt diperlakukan sama",
  rencanaRute(`www.${CBT}`, "/ujian"), { tindakan: "tulis-ulang", pathname: "/cbt/ujian" });
sama("alamat kembar /cbt dirapikan ke akar",
  rencanaRute(CBT, "/cbt"), { tindakan: "alih", host: "", pathname: "/" });
sama("alamat kembar /cbt/ujian dirapikan",
  rencanaRute(CBT, "/cbt/ujian"), { tindakan: "alih", host: "", pathname: "/ujian" });
sama("/login diantar ke portal",
  rencanaRute(CBT, "/login"), { tindakan: "alih", host: PORTAL, pathname: "/login" });
sama("/dashboard diantar ke portal",
  rencanaRute(CBT, "/dashboard"), { tindakan: "alih", host: PORTAL, pathname: "/dashboard" });
sama("API tidak disentuh", rencanaRute(CBT, "/api/cbt/ikut"), { tindakan: "lewat" });
sama("bundel Next tidak disentuh", rencanaRute(CBT, "/_next/static/a.js"), { tindakan: "lewat" });

console.log("\n== RUTE DI DOMAIN PORTAL ==");
sama("/cbt pindah ke subdomain",
  rencanaRute(PORTAL, "/cbt"), { tindakan: "alih", host: CBT, pathname: "/" });
sama("/cbt/ujian pindah ke subdomain",
  rencanaRute(PORTAL, "/cbt/ujian"), { tindakan: "alih", host: CBT, pathname: "/ujian" });
sama("tautan lama /ujian ikut pindah",
  rencanaRute(PORTAL, "/ujian"), { tindakan: "alih", host: CBT, pathname: "/ujian" });
sama("dashboard tetap di portal", rencanaRute(PORTAL, "/dashboard"), { tindakan: "lewat" });
sama("akar portal tetap portal", rencanaRute(PORTAL, "/"), { tindakan: "lewat" });
sama("layanan lain tidak tersenggol", rencanaRute(PORTAL, "/alat"), { tindakan: "lewat" });

console.log("\n== RUTE SAAT DIKEMBANGKAN LOKAL ==");
sama("/cbt tetap dilayani di tempatnya", rencanaRute("localhost:3000", "/cbt"), { tindakan: "lewat" });
sama("/ujian tetap dilayani di tempatnya", rencanaRute("localhost:3000", "/ujian"), { tindakan: "lewat" });
sama("pratayang penyebaran juga", rencanaRute("sipaling-fisip-abc.vercel.app", "/cbt"), { tindakan: "lewat" });


// ---------- DOMAIN TIDAK TERTANAM DI KODE ----------
//
// CBT ini satu produk yang sama untuk siapa pun yang memasangnya, jadi tidak
// boleh ada nama domain yang WAJIB ada di dalam kodenya. Yang di bawah
// membuktikan seluruh perhitungan host ikut berpindah begitu
// NEXT_PUBLIC_PORTAL_HOST disetel — tanpa satu baris pun diubah.
{
  const semula = process.env.NEXT_PUBLIC_PORTAL_HOST;
  process.env.NEXT_PUBLIC_PORTAL_HOST = "www.ujikompetensi.id";

  sama("subdomain CBT ikut domain yang disetel",
    hostCbtUntuk("www.ujikompetensi.id"), "cbt.ujikompetensi.id");
  sama("dari domain telanjang juga",
    hostCbtUntuk("ujikompetensi.id"), "cbt.ujikompetensi.id");
  sama("arah baliknya ikut",
    hostPortalUntuk("cbt.ujikompetensi.id"), "www.ujikompetensi.id");
  // Dan domain yang lama berhenti dikenali, karena ia memang bukan lagi
  // milik pemasangan ini.
  sama("domain lama tidak lagi mengarang subdomain",
    hostCbtUntuk("www.sipalingfisip.web.id"), "");

  if (semula === undefined) delete process.env.NEXT_PUBLIC_PORTAL_HOST;
  else process.env.NEXT_PUBLIC_PORTAL_HOST = semula;
}

console.log(`\n${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
