// ============================================================
// UJI PENYUSUN TAUTAN CBT DAN POSTER QR
//
// Yang diperiksa di sini adalah hal yang tidak pernah kelihatan dari layar
// pengembang: tautan yang tersalin ke grup kelas menunjuk domain yang benar,
// baik ketika CBT tinggal di /cbt pada domain utama maupun ketika ia dipasang
// pada subdomainnya sendiri.
//
//   npx tsx uji-tautan-cbt.ts
//
// Tidak menyentuh basis data, tidak menyentuh jaringan.
// ============================================================
import {
  asalCbtEnv, asalPermintaan, pangkalCbt, pesanGrupUjian, rapikanAsal,
  rapikanKodeTautan, tautanMasukCbt, tautanRingkas, tautanUjian, tautanWhatsApp,
} from "@/lib/tautan-cbt";
import { posterTautanHtml, type UjianCetak } from "@/lib/cetak-cbt";

let lulus = 0;
let gagal = 0;
function cek(nama: string, syarat: boolean, keterangan = "") {
  if (syarat) { lulus += 1; console.log(`  ok   ${nama}`); }
  else { gagal += 1; console.log(`  GAGAL ${nama}${keterangan ? " — " + keterangan : ""}`); }
}

const UTAMA = "https://sipalingfisip.web.id";
const SUB = "https://cbt.sipalingfisip.web.id";

console.log("\n== KODE PADA ALAMAT ==");
cek("huruf kecil dinaikkan", rapikanKodeTautan("k7m2qx") === "K7M2QX");
cek("spasi dan tanda hubung dibuang", rapikanKodeTautan(" k7m-2qx ") === "K7M2QX");
cek("kode terlalu pendek ditolak", rapikanKodeTautan("AB") === "");
cek("bukan tali ditolak", rapikanKodeTautan(null) === "");
// Jalur yang tidak boleh mungkin: kode yang membawa garis miring lalu menjadi
// alamat lain sama sekali. Garis miring dan titiknya DIBUANG, bukan ditolak —
// yang penting hasilnya tidak pernah dapat keluar dari /cbt/u/.
cek("garis miring dan titik dibuang dari kode",
    rapikanKodeTautan("AB/../login") === "ABLOGIN", rapikanKodeTautan("AB/../login"));
cek("tautan hasilnya tidak dapat keluar dari /cbt/u/",
    tautanUjian("AB/../login", UTAMA) === `${UTAMA}/cbt/u/ABLOGIN`,
    tautanUjian("AB/../login", UTAMA));
cek("titik dua tidak lolos", rapikanKodeTautan("AB:CD") === "ABCD");

console.log("\n== ASAL ==");
cek("garis miring di ujung dibuang", rapikanAsal(`${UTAMA}/`) === UTAMA, rapikanAsal(`${UTAMA}/`));
cek("jalur dibuang", rapikanAsal(`${UTAMA}/dashboard?x=1`) === UTAMA, rapikanAsal(`${UTAMA}/dashboard?x=1`));
cek("tanpa protokol dianggap https", rapikanAsal("cbt.sipalingfisip.web.id") === SUB, rapikanAsal("cbt.sipalingfisip.web.id"));
cek("http tetap http", rapikanAsal("http://localhost:3000") === "http://localhost:3000");
// INI yang paling penting dari seluruh berkas ini.
cek("javascript: ditolak", rapikanAsal("javascript:alert(1)") === "", rapikanAsal("javascript:alert(1)"));
cek("data: ditolak", rapikanAsal("data:text/html,x") === "");
cek("kosong tetap kosong", rapikanAsal("") === "" && rapikanAsal(null) === "");

console.log("\n== PANGKAL DAN TAUTAN ==");
cek("tanpa subdomain, pangkalnya /cbt", pangkalCbt(UTAMA) === `${UTAMA}/cbt`, pangkalCbt(UTAMA));
// Kalau ini salah, alamatnya menjadi /cbt/cbt dan seluruh kelas mendarat di 404.
cek("dengan subdomain, awalan /cbt TIDAK ikut", pangkalCbt(UTAMA, SUB) === SUB, pangkalCbt(UTAMA, SUB));
cek("tautan pendek pada domain utama",
    tautanUjian("K7M2QX", UTAMA) === `${UTAMA}/cbt/u/K7M2QX`, tautanUjian("K7M2QX", UTAMA));
cek("tautan pendek pada subdomain",
    tautanUjian("K7M2QX", UTAMA, SUB) === `${SUB}/u/K7M2QX`, tautanUjian("K7M2QX", UTAMA, SUB));
cek("kode dirapikan lebih dulu",
    tautanUjian(" k7m2qx ", UTAMA) === `${UTAMA}/cbt/u/K7M2QX`, tautanUjian(" k7m2qx ", UTAMA));
cek("kode cacat jatuh ke pintu ujian, bukan alamat rusak",
    tautanUjian("!!", UTAMA) === `${UTAMA}/cbt/ujian`, tautanUjian("!!", UTAMA));
cek("tanpa asal tetap alamat relatif yang sah",
    tautanUjian("K7M2QX") === "/cbt/u/K7M2QX", tautanUjian("K7M2QX"));
cek("pintu masuk CBT", tautanMasukCbt(UTAMA) === `${UTAMA}/cbt`, tautanMasukCbt(UTAMA));
cek("bentuk ringkas membuang https://",
    tautanRingkas(`${UTAMA}/cbt/u/K7M2QX`) === "sipalingfisip.web.id/cbt/u/K7M2QX",
    tautanRingkas(`${UTAMA}/cbt/u/K7M2QX`));

console.log("\n== ASAL DARI PERMINTAAN ==");
function permintaan(kepala: Record<string, string>) {
  return new Request("http://dalam/api/cbt/tautan", { headers: kepala });
}
cek("host + x-forwarded-proto dipakai",
    asalPermintaan(permintaan({ host: "sipalingfisip.web.id", "x-forwarded-proto": "https" })) === UTAMA,
    asalPermintaan(permintaan({ host: "sipalingfisip.web.id", "x-forwarded-proto": "https" })));
// Di belakang proxy Vercel, protokol pada request.url kerap "http:" — tautan
// http yang tersebar ke grup kelas adalah cacat yang tidak kelihatan.
cek("tanpa x-forwarded-proto, domain sungguhan tetap https",
    asalPermintaan(permintaan({ host: "sipalingfisip.web.id" })) === UTAMA,
    asalPermintaan(permintaan({ host: "sipalingfisip.web.id" })));
cek("localhost tetap http",
    asalPermintaan(permintaan({ host: "localhost:3000" })) === "http://localhost:3000",
    asalPermintaan(permintaan({ host: "localhost:3000" })));
cek("x-forwarded-host didahulukan",
    asalPermintaan(permintaan({ host: "dalam", "x-forwarded-host": "cbt.sipalingfisip.web.id" })) === SUB,
    asalPermintaan(permintaan({ host: "dalam", "x-forwarded-host": "cbt.sipalingfisip.web.id" })));

console.log("\n== SUBDOMAIN DARI ENVIRONMENT ==");
delete process.env.NEXT_PUBLIC_CBT_URL;
delete process.env.CBT_HOST;
cek("tanpa environment, tidak ada subdomain", asalCbtEnv(UTAMA) === "");
process.env.CBT_HOST = "cbt.sipalingfisip.web.id";
cek("CBT_HOST menjadi asal https", asalCbtEnv(UTAMA) === SUB, asalCbtEnv(UTAMA));
cek("di localhost, CBT_HOST tetap http",
    asalCbtEnv("http://localhost:3000") === "http://cbt.sipalingfisip.web.id",
    asalCbtEnv("http://localhost:3000"));
process.env.NEXT_PUBLIC_CBT_URL = "https://ujian.kampus.ac.id/";
cek("NEXT_PUBLIC_CBT_URL mengalahkan CBT_HOST",
    asalCbtEnv(UTAMA) === "https://ujian.kampus.ac.id", asalCbtEnv(UTAMA));
delete process.env.NEXT_PUBLIC_CBT_URL;
delete process.env.CBT_HOST;

console.log("\n== PESAN SIAP TEMPEL ==");
const contoh = {
  kode: "K7M2QX", judul: "UTS Sosiologi Politik", mataKuliah: "Sosiologi Politik",
  kelas: "A", token: "Z9P4", jumlahSoal: 40, durasi: 90,
  mulai: "2026-04-20T02:00:00.000Z", selesai: null,
};
const alamat = tautanUjian(contoh.kode, UTAMA);
const pesan = pesanGrupUjian(contoh, alamat, "Kredit CBT");
cek("memuat tautannya", pesan.includes(alamat));
cek("memuat kode ujiannya", pesan.includes("K7M2QX"));
cek("memuat kode pengawasnya", pesan.includes("Z9P4"));
cek("memuat jumlah soal dan waktunya", pesan.includes("40") && pesan.includes("90 menit"));
cek("jam tutup yang kosong tidak dicetak", !pesan.includes("Ditutup"));
cek("kreditnya di baris terakhir", pesan.trimEnd().endsWith("Kredit CBT"));
const tanpaToken = pesanGrupUjian({ ...contoh, token: null }, alamat, "Kredit CBT");
cek("tanpa kode pengawas, barisnya hilang sama sekali", !tanpaToken.includes("Kode pengawas"));
cek("tautan WhatsApp membawa pesannya",
    tautanWhatsApp("halo dunia") === "https://wa.me/?text=halo%20dunia",
    tautanWhatsApp("halo dunia"));

console.log("\n== POSTER QR ==");
const cetak: UjianCetak = {
  judul: "UTS Sosiologi <Politik>", mataKuliah: "Sosiologi Politik", kelas: "A",
  kode: "K7M2QX", durasi: 90, jumlahSoal: 40,
  mulai: "2026-04-20T02:00:00.000Z", selesai: null,
};
const qr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>';
const poster = posterTautanHtml(cetak, { tautan: alamat, qrSvg: qr });
cek("QR-nya masuk apa adanya", poster.includes(qr));
cek("alamatnya tercetak tanpa https://", poster.includes("sipalingfisip.web.id/cbt/u/K7M2QX"));
cek("kode ujiannya tercetak", poster.includes("K7M2QX"));
// Judul ujian ditulis dosen, dan tanda kurung siku muncul wajar di sana.
// Tanpa pelolosan, sisa posternya hilang diam-diam.
cek("tanda kurung siku pada judul dilolos-kan", poster.includes("UTS Sosiologi &lt;Politik&gt;"));
cek("tidak ada judul mentah yang bocor", !poster.includes("<Politik>"));
cek("jam tutup yang kosong tidak dicetak", !poster.includes("Ditutup"));
cek("ada tombol cetak", poster.includes("window.print()"));

console.log(`\n${gagal === 0 ? "SEMUA LULUS" : "ADA YANG GAGAL"}: ${lulus} lulus, ${gagal} gagal.`);
process.exit(gagal === 0 ? 0 : 1);
