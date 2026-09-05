// ============================================================
// UJI: pembuat soal AI dan penyari dokumen
//
// Yang diuji di sini SELURUHNYA bebas jaringan. Panggilan ke model tidak
// ditiru-tiru; yang diperiksa adalah dua hal yang menentukan dan tidak
// bergantung pada model mana pun:
//
//   1. Jawaban model DIPERIKSA sebelum masuk bank soal — lewat gerbang yang
//      sama dengan berkas unggahan dosen. Model yang keliru menulis kunci
//      tidak boleh menghasilkan soal yang menyalahkan mahasiswa.
//   2. Pembaca zip untuk .pptx benar-benar membuka arsip terpampat.
// ============================================================
import { readFileSync } from "node:fs";
import { bacaZip } from "./src/lib/baca-zip";
import {
  MAKS_SOAL, naskahCukup, periksaJawabanAi, rapikanPermintaan, susunPerintah, SKEMA_JAWABAN,
} from "./src/lib/ai-soal";

let lulus = 0;
let gagal = 0;
function cek(nama: string, syarat: boolean, ket = "") {
  if (syarat) { lulus += 1; console.log(`  ok    ${nama}`); }
  else { gagal += 1; console.log(`  GAGAL ${nama}${ket ? " — " + ket : ""}`); }
}
function bagian(j: string) { console.log(`\n== ${j} ==`); }

const NASKAH = "kata ".repeat(600);

// ---------- PERMINTAAN ----------
bagian("Merapikan permintaan dosen");
const m1 = rapikanPermintaan({ jumlah: 999, jenis: ["pg", "sihir" as never], tingkat: "aneh" as never });
cek("jumlah dipagari batas atas", m1.jumlah === MAKS_SOAL, String(m1.jumlah));
cek("jenis karangan dibuang", m1.jenis.join(",") === "pg", m1.jenis.join(","));
cek("tingkat tak dikenal jadi campuran", m1.tingkat === "campuran");
const m2 = rapikanPermintaan({ jumlah: 0, jenis: [] });
cek("jumlah nol dinaikkan ke satu", m2.jumlah === 1, String(m2.jumlah));
cek("tanpa jenis jatuh ke pg", m2.jenis.join(",") === "pg");
const m3 = rapikanPermintaan({ teks: "x".repeat(200_000) });
cek("naskah raksasa dipotong", m3.teks.length === 60_000, String(m3.teks.length));

bagian("Perintah yang disusun");
const perintah = susunPerintah(rapikanPermintaan({
  teks: "Isi materi kuliah.", jumlah: 5, jenis: ["pg", "penjodohan"],
  tingkat: "sulit", materi: "Teori Komunikasi", arahan: "Fokus pada bab 2.",
}));
cek("menyebut jumlah soal", perintah.includes("Buat 5 soal"));
cek("menyebut jenis yang diminta", perintah.includes("penjodohan"));
cek("menyebut tingkat", perintah.includes("tingkat sulit"));
cek("membawa arahan dosen", perintah.includes("Fokus pada bab 2."));
cek("naskah dibatasi penanda yang jelas",
    perintah.includes("=== NASKAH ===") && perintah.includes("=== AKHIR NASKAH ==="));

// ---------- NASKAH CUKUP ----------
bagian("Menahan naskah yang terlalu tipis");
cek("naskah setengah halaman ditolak", !naskahCukup("cuma sedikit kata saja di sini", 10).ok);
const tipis = naskahCukup("kata ".repeat(200), 20);
cek("200 kata untuk 20 soal ditolak", !tipis.ok);
cek("penolakannya menyebut angka yang wajar",
    !tipis.ok && /sekitar \d+ soal/.test(tipis.pesan), !tipis.ok ? tipis.pesan : "");
cek("naskah tebal untuk sedikit soal diterima", naskahCukup(NASKAH, 10).ok);

// ---------- MEMERIKSA JAWABAN MODEL ----------
bagian("Jawaban model diperiksa, bukan dipercaya");

const jawabanBaik = {
  soal: [
    { jenis: "pg", pertanyaan: "Siapa perumus agenda setting?",
      pilihan: ["McCombs & Shaw", "Lasswell", "Habermas", "Gerbner"],
      kunci: "A", pasangan: [], bobot: 5, materi: "Teori", tingkat: "sedang", pembahasan: "1972." },
    { jenis: "pg_kompleks", pertanyaan: "Mana yang teori komunikasi massa?",
      pilihan: ["Agenda setting", "Kultivasi", "Fotosintesis", "Spiral of silence"],
      kunci: "A,B,D", pasangan: [], bobot: 9, materi: "Teori", tingkat: "sulit", pembahasan: "" },
    { jenis: "penjodohan", pertanyaan: "Jodohkan teori dan perumusnya.",
      pilihan: [], kunci: "",
      pasangan: [
        { kiri: "Agenda setting", kanan: "McCombs & Shaw" },
        { kiri: "Spiral of silence", kanan: "Noelle-Neumann" },
        { kiri: "Kultivasi", kanan: "Gerbner" },
      ],
      bobot: 9, materi: "Teori", tingkat: "sedang", pembahasan: "" },
    { jenis: "benar_salah", pertanyaan: "Opini publik dapat dibentuk media.",
      pilihan: [], kunci: "BENAR", pasangan: [], bobot: 5, materi: "Teori", tingkat: "mudah", pembahasan: "" },
    { jenis: "essay", pertanyaan: "Jelaskan peran media dalam kampanye.",
      pilihan: [], kunci: "", pasangan: [], bobot: 20, materi: "Teori", tingkat: "sulit", pembahasan: "Rambu." },
  ],
};
const baik = periksaJawabanAi(jawabanBaik, 5);
cek("lima soal sah semuanya lolos", baik.soal.length === 5 && baik.tolak.length === 0,
    JSON.stringify(baik.tolak));
cek("tidak ada yang kurang", baik.kurang === 0);
cek('kunci "A" jadi indeks 0', baik.soal[0]?.kunci === "0", baik.soal[0]?.kunci);
cek('kunci "A,B,D" jadi "0,1,3"', baik.soal[1]?.kunci === "0,1,3", baik.soal[1]?.kunci);
cek("penjodohan jadi pasangan berindeks",
    baik.soal[2]?.pasangan.length === 3 && baik.soal[2]?.pilihan.length === 3,
    JSON.stringify(baik.soal[2]));
cek("pasangan menunjuk pilihan yang benar",
    baik.soal[2]?.pilihan[baik.soal[2].pasangan[0].kanan] === "McCombs & Shaw",
    JSON.stringify(baik.soal[2]?.pilihan));
cek('"BENAR" jadi indeks 0 dengan pilihan terisi sendiri',
    baik.soal[3]?.kunci === "0" && baik.soal[3]?.pilihan.join("/") === "Benar/Salah",
    JSON.stringify(baik.soal[3]));

bagian("Model yang keliru ditahan di gerbang");
const jawabanBuruk = {
  soal: [
    // Kunci menunjuk pilihan yang tidak ada — inilah kekeliruan yang paling
    // berbahaya, karena soalnya tampak beres lalu menyalahkan semua orang.
    { jenis: "pg", pertanyaan: "Kunci di luar jangkauan", pilihan: ["Satu", "Dua"],
      kunci: "F", pasangan: [], bobot: 5, materi: "", tingkat: "sedang", pembahasan: "" },
    // Seluruh pilihan ditandai benar.
    { jenis: "pg_kompleks", pertanyaan: "Semua benar", pilihan: ["A", "B"],
      kunci: "A,B", pasangan: [], bobot: 9, materi: "", tingkat: "sedang", pembahasan: "" },
    // Pilihan cuma satu.
    { jenis: "pg", pertanyaan: "Cuma satu pilihan", pilihan: ["Sendirian"],
      kunci: "A", pasangan: [], bobot: 5, materi: "", tingkat: "sedang", pembahasan: "" },
    // Penjodohan dengan satu pasangan.
    { jenis: "penjodohan", pertanyaan: "Sepasang saja", pilihan: [], kunci: "",
      pasangan: [{ kiri: "A", kanan: "B" }], bobot: 9, materi: "", tingkat: "sedang", pembahasan: "" },
    // Pertanyaan kosong.
    { jenis: "pg", pertanyaan: "", pilihan: ["A", "B"], kunci: "A",
      pasangan: [], bobot: 5, materi: "", tingkat: "sedang", pembahasan: "" },
    // Yang ini sah, dan HARUS tetap lolos di tengah yang rusak.
    { jenis: "isian", pertanyaan: "Sebutkan istilahnya.", pilihan: [], kunci: "agenda setting",
      pasangan: [], bobot: 5, materi: "", tingkat: "sedang", pembahasan: "" },
  ],
};
const buruk = periksaJawabanAi(jawabanBuruk, 6);
cek("lima soal cacat ditolak", buruk.tolak.length === 5, JSON.stringify(buruk.tolak.map((t) => t.alasan)));
cek("satu soal sah tetap lolos", buruk.soal.length === 1, JSON.stringify(buruk.soal));
cek("kekurangannya dihitung", buruk.kurang === 5, String(buruk.kurang));
cek("alasan penolakan disebutkan, bukan dibuang diam-diam",
    buruk.tolak.every((t) => t.alasan.length > 5));
cek("kunci di luar jangkauan disebut alasannya",
    buruk.tolak.some((t) => /pilihan yang tidak ada/.test(t.alasan)),
    JSON.stringify(buruk.tolak.map((t) => t.alasan)));
cek("seluruh pilihan benar disebut alasannya",
    buruk.tolak.some((t) => /tidak mengukur apa pun/.test(t.alasan)));

bagian("Jawaban yang bentuknya kacau");
cek("bukan objek", periksaJawabanAi(null, 5).soal.length === 0);
cek("tanpa medan soal", periksaJawabanAi({ hasil: [] }, 5).tolak.length === 1);
cek("soal bukan larik", periksaJawabanAi({ soal: "bukan larik" }, 5).soal.length === 0);
cek("larik kosong bukan galat, hanya kurang",
    periksaJawabanAi({ soal: [] }, 5).kurang === 5);
cek("unsur null di dalam larik tidak menjatuhkan sisanya",
    periksaJawabanAi({ soal: [null, jawabanBaik.soal[0]] }, 2).soal.length === 1);

bagian("Skema yang dituntut dari model");
const skema = JSON.parse(JSON.stringify(SKEMA_JAWABAN));
cek("menuntut medan soal", skema.required.includes("soal"));
cek("melarang medan tambahan", skema.additionalProperties === false);
cek("jenis dibatasi enam pilihan", skema.properties.soal.items.properties.jenis.enum.length === 6);
cek("tiap soal menuntut kunci dan pasangan",
    skema.properties.soal.items.required.includes("kunci") &&
    skema.properties.soal.items.required.includes("pasangan"));

// ---------- PEMBACA ZIP / PPTX ----------
bagian("Pembaca zip — .pptx sungguhan yang terpampat deflate");
const S = "/tmp/claude-0/-home-user-sipaling-fisip/43787386-10d9-5ffb-abce-64323d97478e/scratchpad";
const mentah = readFileSync(`${S}/bahan.pptx`);
const buf = mentah.buffer.slice(mentah.byteOffset, mentah.byteOffset + mentah.byteLength) as ArrayBuffer;

async function jalan() {
  const semua = await bacaZip(buf);
  // Enam: [Content_Types], tiga salindia, satu catatan, satu gambar.
  cek("seluruh isi arsip terbaca", semua.length === 6, semua.map((b) => b.nama).join(", "));

  const hanyaSalindia = await bacaZip(buf, (n) => /^ppt\/slides\/[^/]+\.xml$/i.test(n));
  cek("saringan bekerja — gambar tidak ikut dimekarkan", hanyaSalindia.length === 3,
      hanyaSalindia.map((b) => b.nama).join(", "));

  const satu = semua.find((b) => b.nama === "ppt/slides/slide1.xml");
  const xml = new TextDecoder().decode(satu!.data);
  cek("isi terpampat benar-benar mekar", xml.includes("Teori Agenda Setting"), xml.slice(0, 60));
  cek("entitas XML utuh di dalam berkas", xml.includes("McCombs &amp; Shaw"));

  // Inilah alasan urutan dibaca dari nomornya: abjad menaruh slide10 sebelum slide2.
  const urutAbjad = hanyaSalindia.map((b) => b.nama).sort();
  cek("abjad memang keliru urutannya (slide10 sebelum slide2)",
      urutAbjad[1] === "ppt/slides/slide10.xml", urutAbjad.join(", "));

  const rusak = new Uint8Array([1, 2, 3, 4]).buffer;
  let ditolak = false;
  try { await bacaZip(rusak); } catch { ditolak = true; }
  cek("berkas yang bukan zip ditolak dengan jelas", ditolak);

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  if (gagal > 0) process.exit(1);
}

void jalan();
