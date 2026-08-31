// KERANGKA BERPIKIR DAN HIPOTESIS
//
// Bagan kerangka berpikir adalah salah satu bagian yang paling sering
// disuruh ulang oleh pembimbing, biasanya karena panah dan nomor hipotesisnya
// tidak sejalan dengan rumusan masalah. Di sini keduanya disusun dari
// variabel yang sama, sehingga tidak mungkin berselisih.
//
// Penomoran mengikuti urutan yang lazim pada skripsi Indonesia: pengaruh
// langsung tiap variabel bebas lebih dulu, lalu variabel antara, lalu
// pengaruh tidak langsung, dan terakhir pengaruh serentak.

import type { Jenis, Masukan } from "./metodologi";

export type Jalur = {
  kode: string;
  dari: string;
  ke: string;
  lewat?: string;
  bunyi: string;
  jenis: "langsung" | "tak-langsung" | "serentak";
};

export type Kotak = { id: string; label: string; peran: "bebas" | "antara" | "terikat" };

export type Kerangka = {
  kotak: Kotak[];
  jalur: Jalur[];
  adaAntara: boolean;
  /** Rumusan masalah yang selaras dengan tiap jalur. */
  rumusan: string[];
};

function bersih(t: string | undefined, bawaan: string) {
  const b = (t ?? "").trim();
  return b || bawaan;
}

/**
 * Susun bagan kerangka berpikir beserta hipotesisnya.
 *
 * Bentuknya mengikuti jumlah variabel yang diisi mahasiswa, bukan satu
 * cetakan tetap: satu X tanpa variabel antara menghasilkan bagan sederhana,
 * dua X dengan variabel antara menghasilkan bagan mediasi lengkap.
 */
export function susunKerangka(m: Masukan): Kerangka {
  const X1 = bersih(m.variabelX, "Variabel Bebas");
  const X2 = (m.variabelX2 ?? "").trim();
  const Z = (m.variabelZ ?? "").trim();
  const Y = bersih(m.variabelY, "Variabel Terikat");

  const kotak: Kotak[] = [{ id: "X1", label: X1, peran: "bebas" }];
  if (X2) kotak.push({ id: "X2", label: X2, peran: "bebas" });
  if (Z) kotak.push({ id: "Z", label: Z, peran: "antara" });
  kotak.push({ id: "Y", label: Y, peran: "terikat" });

  const bebas = X2 ? [{ id: "X1", nama: X1 }, { id: "X2", nama: X2 }] : [{ id: "X1", nama: X1 }];
  const jalur: Jalur[] = [];
  let n = 0;
  const kode = () => `H${(n += 1)}`;

  // 1. Pengaruh langsung tiap variabel bebas terhadap variabel terikat.
  for (const b of bebas) {
    jalur.push({
      kode: kode(), dari: b.id, ke: "Y", jenis: "langsung",
      bunyi: `${b.nama} berpengaruh terhadap ${Y}.`,
    });
  }

  if (Z) {
    // 2. Pengaruh tiap variabel bebas terhadap variabel antara.
    for (const b of bebas) {
      jalur.push({
        kode: kode(), dari: b.id, ke: "Z", jenis: "langsung",
        bunyi: `${b.nama} berpengaruh terhadap ${Z}.`,
      });
    }
    // 3. Pengaruh variabel antara terhadap variabel terikat.
    jalur.push({
      kode: kode(), dari: "Z", ke: "Y", jenis: "langsung",
      bunyi: `${Z} berpengaruh terhadap ${Y}.`,
    });
    // 4. Pengaruh tidak langsung lewat variabel antara.
    for (const b of bebas) {
      jalur.push({
        kode: kode(), dari: b.id, ke: "Y", lewat: "Z", jenis: "tak-langsung",
        bunyi: `${b.nama} berpengaruh terhadap ${Y} melalui ${Z}.`,
      });
    }
  }

  // 5. Pengaruh serentak, hanya bila variabel bebasnya lebih dari satu.
  if (X2) {
    jalur.push({
      kode: kode(), dari: "X1+X2", ke: "Y", jenis: "serentak",
      bunyi: `${X1} dan ${X2} secara serentak berpengaruh terhadap ${Y}.`,
    });
  }

  const rumusan = jalur.map((j) =>
    j.jenis === "serentak"
      ? `Apakah ${X1} dan ${X2} secara serentak berpengaruh terhadap ${Y}?`
      : j.lewat
        ? `Apakah ${namaKotak(kotak, j.dari)} berpengaruh terhadap ${Y} melalui ${Z}?`
        : `Apakah ${namaKotak(kotak, j.dari)} berpengaruh terhadap ${namaKotak(kotak, j.ke)}?`,
  );

  return { kotak, jalur, adaAntara: Boolean(Z), rumusan };
}

export function namaKotak(kotak: Kotak[], id: string) {
  return kotak.find((k) => k.id === id)?.label ?? id;
}

/** Penanda variabel seperti yang lazim ditulis pada bagan skripsi. */
export function tanda(id: string) {
  return { X1: "X1", X2: "X2", Z: "Z", Y: "Y" }[id] ?? id;
}

// ---------------------------------------------------------------------------
// ALUR PIKIR UNTUK RANCANGAN YANG TIDAK MENGUJI VARIABEL
// ---------------------------------------------------------------------------
//
// Bagan kotak-dan-panah di atas hanya sah bila ada variabel yang diuji
// pengaruh atau hubungannya. Penelitian kualitatif, deskriptif, analisis isi,
// dan evaluasi tetap wajib punya kerangka berpikir, hanya bentuknya berbeda:
// bukan jalur antarvariabel, melainkan alur penalaran dari fenomena sampai
// temuan yang diharapkan.
//
// Memaksakan bagan variabel pada rancangan kualitatif adalah kekeliruan yang
// sering terjadi, dan penguji langsung menanyakannya: "mana variabel bebas
// Anda?", padahal penelitiannya memang tidak punya.

export type Simpul = {
  /** Nama tahap pada bagan. */
  tahap: string;
  isi: string;
};

export type AlurPikir = {
  simpul: Simpul[];
  catatan: string;
};

const HARAPAN: Record<Jenis, string> = {
  "kuantitatif-eksplanatif": "Besar dan arah pengaruh, beserta taraf signifikansinya",
  "kuantitatif-korelasional": "Kekuatan dan arah hubungan antarvariabel",
  "kuantitatif-komparatif": "Ada tidaknya perbedaan yang bermakna antar kelompok",
  "kuantitatif-deskriptif": "Peta keadaan per indikator, bukan satu angka tunggal",
  "kualitatif-deskriptif": "Tema yang berulang beserta kutipan pendukungnya",
  fenomenologi: "Esensi pengalaman yang dihidupi para informan",
  "studi-kasus": "Pola yang menjelaskan kasus, dijodohkan dengan teori",
  "analisis-isi": "Kecenderungan kategori beserta angka kemunculannya",
  "analisis-framing": "Bingkai yang dipakai tiap media, ditunjukkan dari potongan beritanya",
  semiotika: "Makna di balik tanda, ditunjukkan dari potongan yang dianalisis",
  "uses-gratifications": "Motif mana yang paling kuat mendorong penggunaannya",
  "efektivitas-program": "Capaian dibanding tolok ukur resmi, dan penyebab selisihnya",
  "strategi-komunikasi": "Tahap strategi yang dijalankan beserta hambatannya",
  "implementasi-kebijakan": "Aspek mana yang membuat kebijakannya berjalan atau tersendat",
  "peran-pemerintah": "Peran yang benar-benar dijalankan, dan yang belum",
  "analisis-kebijakan": "Persoalan pada isi kebijakan dan pada pelaksanaannya",
  governance: "Prinsip tata kelola yang sudah dan belum berjalan",
  "strategi-pemerintah": "Strategi yang ditempuh beserta hambatan pelaksanaannya",
};

const CARA: Record<Jenis, string> = {
  "kuantitatif-eksplanatif": "Kuesioner diuji lebih dulu, lalu regresi",
  "kuantitatif-korelasional": "Kuesioner, lalu uji korelasi",
  "kuantitatif-komparatif": "Kuesioner pada tiap kelompok, lalu uji beda",
  "kuantitatif-deskriptif": "Kuesioner, lalu distribusi frekuensi",
  "kualitatif-deskriptif": "Wawancara dan dokumen, lalu pengodean tematik",
  fenomenologi: "Wawancara mendalam, lalu reduksi dan horizonalisasi",
  "studi-kasus": "Wawancara, dokumen, observasi, lalu analisis tematik",
  "analisis-isi": "Lembar koding dan koder kedua, lalu uji reliabilitas",
  "analisis-framing": "Berita dibedah dengan perangkat framing model yang dipilih",
  semiotika: "Potongan tanda dibaca pada tiap tataran model yang dipilih",
  "uses-gratifications": "Kuesioner motif, lalu peringkat tiap motif",
  "efektivitas-program": "Kuesioner indikator efektivitas, lalu skor per indikator",
  "strategi-komunikasi": "Wawancara dan dokumen, ditata menurut tahap model strategi",
  "implementasi-kebijakan": "Wawancara pelaksana dan dokumen, ditata per aspek model",
  "peran-pemerintah": "Wawancara pemerintah dan masyarakat, ditata per peran",
  "analisis-kebijakan": "Naskah kebijakan ditelaah, lalu diperiksa silang dengan pelaksananya",
  governance: "Wawancara dan dokumen, dinilai per prinsip tata kelola",
  "strategi-pemerintah": "Wawancara dan dokumen, ditata menurut tahap penyusunan strategi",
};

/**
 * Susun alur penalaran penelitian, dari fenomena sampai temuan yang
 * diharapkan.
 *
 * Isinya diambil dari masukan yang sama dengan yang dipakai merancang metode,
 * sehingga bagan ini tidak mungkin bercerita lain daripada bab metodenya.
 */
/** Nama teori untuk kotak bagan.
 *
 *  Ketika program studinya belum terbaca, `bangunTeori` mengembalikan kalimat
 *  anjuran, bukan nama teori. Kalimat itu benar sebagai saran tetapi janggal
 *  dicetak di dalam kotak bagan, jadi diringkas menjadi penanda. */
function namaTeori(teori: string[]) {
  const utama = teori.slice(0, 2).filter((t) => !/dosen pembimbing/i.test(t));
  return utama.join(" · ") || "Ditetapkan bersama dosen pembimbing";
}

export function susunAlurPikir(m: Masukan, jenis: Jenis, teori: string[]): AlurPikir {
  const X = bersih(m.variabelX, "gagasan yang diteliti");
  const Y = (m.variabelY ?? "").trim();
  const siapa = (m.objek ?? "").trim();
  const tempat = (m.lokasi ?? "").trim();

  // Nama lembaga sering sudah menempel pada gagasannya sendiri: "humas Dinas
  // Kominfo Kota Serang" sudah menyebut lembaganya. Menambahkan "pada Dinas
  // Kominfo Kota Serang" di belakangnya hanya mencetak nama yang sama dua kali
  // di dalam satu kotak.
  const terpakai: string[] = [X];
  const belumDisebut = (bagian: string) =>
    bagian !== "" && !terpakai.some((t) => t.toLowerCase().includes(bagian.toLowerCase()));
  const fenomena = [X];
  if (belumDisebut(siapa)) { fenomena.push(`pada ${siapa}`); terpakai.push(siapa); }
  if (belumDisebut(tempat)) fenomena.push(`di ${tempat}`);

  const fokus =
    jenis === "analisis-isi"
      ? `Apa yang terkandung dalam ${Y || "teks yang dipilih"} ketika membicarakan ${X}`
      : jenis === "analisis-framing"
        ? `Bagaimana ${Y || "media yang dipilih"} membingkai ${X}`
        : jenis === "semiotika"
          ? `Makna apa yang terbangun di balik tanda tentang ${X} dalam ${Y || "teks yang dipilih"}`
      : jenis === "efektivitas-program"
        ? `Sejauh mana ${X} mencapai sasaran yang ditetapkan`
      : jenis === "implementasi-kebijakan"
        ? `Aspek mana yang membuat ${X} berjalan atau tersendat di lapangan`
      : jenis === "peran-pemerintah"
        ? `Peran apa yang benar-benar dijalankan ${siapa || "pemerintah"} dalam ${X}`
      : jenis === "analisis-kebijakan"
        ? `Persoalan apa yang terkandung dalam ${X} dan dalam pelaksanaannya`
      : jenis === "governance"
        ? `Prinsip tata kelola mana yang sudah dan belum berjalan dalam ${X}`
        : jenis === "fenomenologi"
          ? `Bagaimana ${siapa || "informan"} memaknai pengalaman ${X}`
          : jenis === "studi-kasus" || jenis === "strategi-komunikasi" || jenis === "strategi-pemerintah"
            // Pada cerita berbentuk proses, Y berisi kegiatannya, bukan
            // akibatnya. "Bagaimana A bertaut dengan mengelola akun resminya"
            // tidak berbunyi; yang ditanyakan studi kasus memang bagaimana
            // kegiatan itu dijalankan.
            ? `Bagaimana ${X} dijalankan${Y ? `, khususnya dalam ${Y}` : ""}`
            : Y
              ? `Bagaimana ${X} bertaut dengan ${Y}`
              : `Bagaimana ${X} berlangsung sebenarnya`;

  return {
    simpul: [
      { tahap: "Fenomena", isi: fenomena.join(" ") },
      { tahap: "Teori dan konsep", isi: namaTeori(teori) },
      { tahap: "Fokus penelitian", isi: fokus },
      { tahap: "Cara memeriksa", isi: CARA[jenis] },
      { tahap: "Temuan yang diharapkan", isi: HARAPAN[jenis] },
    ],
    catatan:
      "Rancangan ini tidak menguji hubungan antarvariabel, jadi kerangka berpikirnya berbentuk alur " +
      "penalaran, bukan kotak X dan Y. Memaksakan bagan variabel di sini justru akan ditanyakan penguji.",
  };
}
