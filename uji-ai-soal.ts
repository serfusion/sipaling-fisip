// ============================================================
// UJI: pembuat soal AI dan penyari dokumen
//
// Yang diuji di sini SELURUHNYA bebas jaringan. Panggilan ke model tidak
// ditiru-tiru; yang diperiksa adalah dua hal yang menentukan dan tidak
// bergantung pada model mana pun:
//
//   1. Jawaban model DIPERIKSA sebelum masuk bank soal — lewat gerbang yang
//      sama dengan berkas unggahan pengajar. Model yang keliru menulis kunci
//      tidak boleh menghasilkan soal yang menyalahkan peserta.
//   2. Pembaca zip untuk .pptx benar-benar membuka arsip terpampat.
// ============================================================
import { crc32, deflateRawSync } from "node:zlib";
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
bagian("Merapikan permintaan pengajar");
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
cek("membawa arahan pengajar", perintah.includes("Fokus pada bab 2."));
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

// Bahannya DIRAKIT DI SINI, bukan dibaca dari berkas di luar repositori.
//
// Sebelumnya ia menumpang pada folder sementara milik satu sesi kerja, dan
// begitu folder itu hilang seluruh berkas uji ini mati sebelum satu pun
// periksa di bawahnya sempat berjalan — termasuk yang tidak ada hubungannya
// dengan zip. Merakitnya di tempat membuat ujinya berdiri sendiri.
//
// Yang dirakit bukan zip tiruan: pemampatannya deflate sungguhan dari zlib,
// dan susunan kepalanya mengikuti spesifikasi yang sama dengan yang ditulis
// PowerPoint. Satu hal sengaja dibuat lebih keras daripada .pptx biasa, yaitu
// bagian tambahan pada kepala lokal yang berbeda panjang dari yang tercatat
// di direktori pusat. Justru itu kasus yang pembacanya klaim tangani, dan
// tanpa bahan yang memuatnya klaim itu tidak pernah benar-benar diperiksa.

type Bahan = { nama: string; isi: Uint8Array; pampat: boolean };

function rakitZip(bahan: Bahan[]): ArrayBuffer {
  const potongan: Buffer[] = [];
  const pusat: Buffer[] = [];
  let letak = 0;
  // Stempel waktu bergaya Unix: hanya ada di kepala lokal, seperti yang
  // ditulis banyak pembuat zip.
  const tambahanLokal = Buffer.from([0x55, 0x54, 0x05, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]);

  for (const b of bahan) {
    const data = b.pampat ? deflateRawSync(b.isi) : Buffer.from(b.isi);
    const nama = Buffer.from(b.nama, "utf8");
    const sum = crc32(b.isi);

    const lokal = Buffer.alloc(30);
    lokal.writeUInt32LE(0x04034b50, 0);
    lokal.writeUInt16LE(20, 4);
    lokal.writeUInt16LE(b.pampat ? 8 : 0, 8);
    lokal.writeUInt32LE(sum, 14);
    lokal.writeUInt32LE(data.length, 18);
    lokal.writeUInt32LE(b.isi.length, 22);
    lokal.writeUInt16LE(nama.length, 26);
    lokal.writeUInt16LE(tambahanLokal.length, 28);

    const kepala = Buffer.alloc(46);
    kepala.writeUInt32LE(0x02014b50, 0);
    kepala.writeUInt16LE(20, 4);
    kepala.writeUInt16LE(20, 6);
    kepala.writeUInt16LE(b.pampat ? 8 : 0, 10);
    kepala.writeUInt32LE(sum, 16);
    kepala.writeUInt32LE(data.length, 20);
    kepala.writeUInt32LE(b.isi.length, 24);
    kepala.writeUInt16LE(nama.length, 28);
    kepala.writeUInt16LE(0, 30); // sengaja nol: berbeda dari kepala lokal
    kepala.writeUInt32LE(letak, 42);

    potongan.push(lokal, nama, tambahanLokal, data);
    pusat.push(kepala, nama);
    letak += 30 + nama.length + tambahanLokal.length + data.length;
  }

  const isiPusat = Buffer.concat(pusat);
  const ekor = Buffer.alloc(22);
  ekor.writeUInt32LE(0x06054b50, 0);
  ekor.writeUInt16LE(bahan.length, 8);
  ekor.writeUInt16LE(bahan.length, 10);
  ekor.writeUInt32LE(isiPusat.length, 12);
  ekor.writeUInt32LE(letak, 16);

  const semua = Buffer.concat([...potongan, isiPusat, ekor]);
  return semua.buffer.slice(semua.byteOffset, semua.byteOffset + semua.byteLength) as ArrayBuffer;
}

const teks = (s: string) => new TextEncoder().encode(s);

/** Satu salindia, sesederhana yang masih berbentuk salindia sungguhan. */
function salindia(...baris: string[]): Uint8Array {
  return teks(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld><p:spTree><p:sp><p:txBody>` +
    baris.map((b) => `<a:p><a:r><a:t>${b}</a:t></a:r></a:p>`).join("") +
    `</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
  );
}

// PNG 1x1 yang sah. Disimpan apa adanya, tanpa deflate, persis perlakuan
// PowerPoint terhadap gambar yang sudah termampat.
const GAMBAR = new Uint8Array(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
));

const buf = rakitZip([
  { nama: "[Content_Types].xml", isi: teks('<?xml version="1.0"?><Types/>'), pampat: true },
  // Entitas XML ditulis apa adanya: "&amp;" harus sampai utuh ke pembacanya,
  // tidak berubah jadi "&" di tengah jalan.
  {
    nama: "ppt/slides/slide1.xml",
    isi: salindia("Teori Agenda Setting", "Dirumuskan McCombs &amp; Shaw pada 1972."),
    pampat: true,
  },
  { nama: "ppt/slides/slide2.xml", isi: salindia("Fungsi Media Massa"), pampat: true },
  // slide10 ada justru supaya urutan abjad terbukti keliru di uji bawah.
  { nama: "ppt/slides/slide10.xml", isi: salindia("Studi Kasus Pemilu"), pampat: true },
  { nama: "ppt/notesSlides/notesSlide1.xml", isi: salindia("Catatan pengajar."), pampat: true },
  { nama: "ppt/media/image1.png", isi: GAMBAR, pampat: false },
]);

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
