import {
  rancang, slovin, kuantitatif, kapitalJudul, metodeProdi,
  JENIS_LABEL, PENDEKATAN, TUJUAN_PILIHAN, UNIT_PILIHAN, DATA_PILIHAN,
  type Data, type Jenis, type Masukan, type Prodi,
} from "./src/lib/metodologi";

let gagal = 0;
const ok = (n: string, s: boolean, i = "") => {
  console.log(`${s ? "  ✓" : "  ✗"} ${n}${i ? ` — ${i}` : ""}`); if (!s) gagal++;
};

const dasar: Masukan = {
  variabelX: "literasi digital", variabelY: "kemampuan menyaring informasi",
  objek: "mahasiswa FISIP UMT", lokasi: "Tangerang",
  tujuan: "pengaruh", unit: "individu", data: ["kuesioner"],
  jumlahPopulasi: 0, perkiraanSampel: 100, prodi: "komunikasi",
};

console.log("\n=== PEMILIHAN RANCANGAN ===\n");
ok("pengaruh -> kuantitatif eksplanatif", rancang(dasar).jenis === "kuantitatif-eksplanatif");
ok("makna -> fenomenologi",
   rancang({ ...dasar, tujuan: "makna", data: ["wawancara"] }).jenis === "fenomenologi");
// Penataan metode empat lapis mengarahkan pertanyaan "bagaimana prosesnya"
// pada lembaga ke rancangan strategi, dan namanya mengikuti prodinya.
ok("proses + lembaga -> strategi, sesuai prodinya",
   rancang({ ...dasar, tujuan: "proses", unit: "organisasi", data: ["wawancara"] }).jenis === "strategi-komunikasi");
ok("proses + lembaga pada prodi pemerintahan -> strategi pemerintah",
   rancang({ ...dasar, prodi: "pemerintahan", tujuan: "proses", unit: "organisasi", data: ["wawancara"] })
     .jenis === "strategi-pemerintah");
ok("isi + teks -> analisis isi",
   rancang({ ...dasar, tujuan: "isi", unit: "teks", data: ["dokumen"] }).jenis === "analisis-isi");
// Penataan metode empat lapis mengganti "analisis wacana" dengan semiotika
// untuk jalur makna-atas-teks; maksud ujinya tetap sama.
ok("makna + teks -> semiotika",
   rancang({ ...dasar, tujuan: "makna", unit: "teks", data: ["dokumen"] }).jenis === "semiotika");
ok("gambaran tanpa kuesioner -> kualitatif deskriptif",
   rancang({ ...dasar, tujuan: "gambaran", data: ["wawancara"] }).jenis === "kualitatif-deskriptif");
ok("gambaran dengan kuesioner -> kuantitatif deskriptif",
   rancang({ ...dasar, tujuan: "gambaran", data: ["kuesioner"] }).jenis === "kuantitatif-deskriptif");

console.log("\n=== PERINGATAN KETIDAKCOCOKAN ===\n");
const salahAlat = rancang({ ...dasar, tujuan: "pengaruh", data: ["wawancara"] });
ok("pengaruh + wawancara saja -> dihambat",
   salahAlat.peringatan.some(p => p.berat === "hambat" && p.judul.includes("menuntut angka")),
   salahAlat.peringatan.map(p => p.judul).join(" | "));
ok("peringatan selalu memberi jalan keluar",
   salahAlat.peringatan.every(p => p.jalanKeluar.length > 20));

const maknaKuesioner = rancang({ ...dasar, tujuan: "makna", data: ["kuesioner"] });
ok("makna + kuesioner saja -> dihambat",
   maknaKuesioner.peringatan.some(p => p.berat === "hambat"));

const teksPengaruh = rancang({ ...dasar, tujuan: "pengaruh", unit: "teks", data: ["kuesioner"] });
ok("teks + pengaruh -> unit tidak bertemu",
   teksPengaruh.peringatan.some(p => p.judul.includes("Unit analisis")));

const sampelKecil = rancang({ ...dasar, perkiraanSampel: 15 });
ok("sampel 15 untuk regresi -> dihambat",
   sampelKecil.peringatan.some(p => p.berat === "hambat" && p.judul.includes("15")));
ok("sampel 100 untuk regresi -> tidak dihambat",
   !rancang(dasar).peringatan.some(p => p.judul.includes("belum mencukupi")));

const komparatif = rancang({ ...dasar, tujuan: "perbedaan", perkiraanSampel: 45 });
ok("uji beda menuntut lebih banyak dari regresi",
   komparatif.peringatan.some(p => p.judul.includes("45")), "45 responden untuk dua kelompok");

console.log("\n=== SLOVIN ===\n");
ok("slovin 1000 -> 286", slovin(1000) === 286, String(slovin(1000)));
ok("slovin 100 -> 80", slovin(100) === 80, String(slovin(100)));
ok("slovin 0 -> null", slovin(0) === null);
const sl = rancang({ ...dasar, jumlahPopulasi: 1000, perkiraanSampel: 100 });
ok("sampel di bawah slovin ditandai",
   sl.peringatan.some(p => p.judul.includes("286")), sl.peringatan.map(p => p.judul).join(" | "));

console.log("\n=== KELUARAN TULISAN ===\n");
const r = rancang(dasar);
ok("judul memuat variabel mahasiswa",
   /literasi digital/i.test(r.judul[0]) && r.judul[0].includes("Tangerang"), r.judul[0]);
ok("rumusan masalah berbentuk pertanyaan", r.rumusan.every(x => x.endsWith("?")));
ok("tujuan bukan pertanyaan", r.tujuanTulis.every(x => !x.includes("?")), r.tujuanTulis[0]);
ok("tujuan diturunkan dari rumusan", r.tujuanTulis.length === r.rumusan.length);
ok("analisis menyebut uji asumsi klasik",
   r.analisis.some(a => a.nama.includes("asumsi klasik")));
ok("kuantitatif memakai uji validitas, bukan triangulasi",
   r.keabsahan.some(k => k.includes("Cronbach")) && !r.keabsahan.some(k => k.includes("Triangulasi")));
const kual = rancang({ ...dasar, tujuan: "makna", data: ["wawancara"] });
ok("kualitatif memakai triangulasi, bukan Cronbach",
   kual.keabsahan.some(k => k.includes("Triangulasi")) && !kual.keabsahan.some(k => k.includes("Cronbach")));
ok("analisis isi mewajibkan reliabilitas antar-koder",
   rancang({ ...dasar, tujuan: "isi", unit: "teks", data: ["dokumen"] })
     .analisis.some(a => a.nama.includes("antar-koder")));
ok("teori komunikasi untuk prodi komunikasi",
   r.teori.some(t => t.includes("Stimulus") || t.includes("Uses")), r.teori.join(", "));
ok("teori pemerintahan untuk prodi pemerintahan",
   rancang({ ...dasar, prodi: "pemerintahan", tujuan: "proses", unit: "organisasi", data: ["wawancara"] })
     .teori.some(t => t.includes("Implementasi Kebijakan")));
ok("tiap jenis punya label", Object.values(JENIS_LABEL).every((l) => typeof l === "string" && l.length > 2));
ok("jumlah rancangan sama dengan jumlah labelnya",
   Object.keys(JENIS_LABEL).length === Object.keys(PENDEKATAN).length,
   `${Object.keys(JENIS_LABEL).length} label`);
ok("kuantitatif() konsisten", kuantitatif("kuantitatif-eksplanatif") && !kuantitatif("fenomenologi"));

// Masukan kosong tidak boleh meledak.
const kosong = rancang({ ...dasar, variabelX: "", variabelY: "", objek: "", lokasi: "", data: [], perkiraanSampel: 0 });
ok("masukan kosong tetap menghasilkan rancangan", kosong.judul.length > 0 && kosong.pengumpulan.length > 0);
ok("tanpa cara pengumpulan data diberitahu", kosong.pengumpulan[0].includes("Belum ada"));

console.log("\n=== KAPITALISASI JUDUL ===\n");
ok("kata isi berhuruf kapital", kapitalJudul("pengaruh literasi digital") === "Pengaruh Literasi Digital",
   kapitalJudul("pengaruh literasi digital"));
ok("kata tugas tetap huruf kecil",
   kapitalJudul("pengaruh literasi terhadap kemampuan pada mahasiswa di kampus")
     === "Pengaruh Literasi terhadap Kemampuan pada Mahasiswa di Kampus",
   kapitalJudul("pengaruh literasi terhadap kemampuan pada mahasiswa di kampus"));
ok("akronim tidak dirusak", kapitalJudul("mahasiswa FISIP UMT") === "Mahasiswa FISIP UMT",
   kapitalJudul("mahasiswa FISIP UMT"));
ok("kata tugas di awal tetap kapital", kapitalJudul("dalam kajian ini").startsWith("Dalam"));
ok("judul rancangan sudah dikapitalkan",
   rancang(dasar).judul[0] === "Pengaruh Literasi Digital terhadap Kemampuan Menyaring Informasi pada Mahasiswa FISIP UMT di Tangerang",
   rancang(dasar).judul[0]);


console.log("\n=== TIAP RANCANGAN MASIH BISA DICAPAI ===\n");

// PENTING — CARA MEMINDAI YANG BENAR.
//
// Pemindaian pertama atas berkas ini keliru menyimpulkan studi kasus sudah
// tidak terjangkau, karena tiap kombinasi hanya diberi SATU cara pengumpulan
// data. Padahal syarat studi kasus justru banyaknya bukti: tiga cara atau
// lebih dan salah satunya observasi. Karena itu di sini yang dicoba seluruh
// himpunan bagian datanya, bukan satu per satu.
const dataSemua = DATA_PILIHAN.map((d) => d.id) as Data[];
const himpunanData: Data[][] = [];
for (let topeng = 1; topeng < (1 << dataSemua.length); topeng++) {
  himpunanData.push(dataSemua.filter((_, i) => topeng & (1 << i)));
}
ok("seluruh kombinasi data dicoba", himpunanData.length === 15, `${himpunanData.length} kombinasi`);

const PRODI_UJI: Prodi[] = ["komunikasi", "pemerintahan"];
const terjangkau = new Set<Jenis>();
for (const t of TUJUAN_PILIHAN) {
  for (const u of UNIT_PILIHAN) {
    for (const data of himpunanData) {
      for (const prodi of PRODI_UJI) {
        terjangkau.add(rancang({ ...dasar, tujuan: t.id, unit: u.id, data, prodi }).jenis);
      }
    }
  }
}

// Tidak ada rancangan yang yatim: kalau perumus otomatis tidak pernah
// menghasilkannya, ia harus tetap dapat dipilih sendiri dari daftar prodinya.
// Rancangan yang tidak dua-duanya berarti tertulis di kode tetapi tidak dapat
// dicapai mahasiswa dengan cara apa pun.
const yatim = (Object.keys(JENIS_LABEL) as Jenis[]).filter(
  (j) => !terjangkau.has(j) && !PRODI_UJI.some((p) => metodeProdi(j, p)),
);
ok("tidak ada rancangan yang tak terjangkau sama sekali", yatim.length === 0, yatim.join(", ") || "tidak ada");

// Studi kasus: menuntut lebih dari satu jenis bukti pada satu kasus.
const kasus = { ...dasar, tujuan: "proses" as const, unit: "organisasi" as const };
ok("studi kasus tercapai dengan tiga bukti termasuk observasi",
   rancang({ ...kasus, data: ["wawancara", "dokumen", "observasi"] }).jenis === "studi-kasus");
// Dengan wawancara saja, yang jujur disebut bukan studi kasus. Ini keputusan
// yang disengaja, bukan kelalaian, jadi dikunci di sini supaya tidak
// "diperbaiki" oleh orang yang mengira ini kerusakan.
ok("wawancara saja TIDAK dinaikkan menjadi studi kasus",
   rancang({ ...kasus, data: ["wawancara"] }).jenis !== "studi-kasus",
   rancang({ ...kasus, data: ["wawancara"] }).jenis);
ok("dua bukti tanpa observasi juga belum studi kasus",
   rancang({ ...kasus, data: ["wawancara", "dokumen"] }).jenis !== "studi-kasus");
ok("tiga bukti tanpa observasi belum studi kasus",
   rancang({ ...kasus, data: ["wawancara", "dokumen", "kuesioner"] }).jenis !== "studi-kasus");

console.log(gagal ? `\n${gagal} UJI GAGAL\n` : "\nSEMUA UJI LULUS\n");
process.exit(gagal ? 1 : 0);
