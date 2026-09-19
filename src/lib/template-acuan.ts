// ============================================================
// TEMPLATE JAWABAN ACUAN YANG DAPAT DIUNDUH, DAN PEMBACANYA
//
// Alurnya sengaja dibuat sama persis dengan impor soal: unduh template, isi di
// komputer, unggah sekali untuk seluruh butir. Bukan karena rapi, melainkan
// karena itulah satu-satunya bentuk yang benar-benar dipakai.
//
// Menulis jawaban acuan adalah pekerjaan mengarang, bukan pekerjaan mengisi
// borang. Satu butir memakan dua sampai empat kalimat yang harus dipikirkan,
// dan dua puluh butir berarti satu jam mengetik. Menuntutnya dikerjakan di
// dalam kotak isian di halaman web berarti menuntut satu jam tanpa boleh
// menutup tab, tanpa pemeriksa ejaan yang biasa dipakai, dan dengan risiko
// sambungan putus di butir ketujuh belas. Yang terjadi kemudian bukan dosen
// mengisinya dengan susah payah, melainkan dosen tidak mengisinya sama sekali.
//
// Di dalam Word atau Excel, pekerjaan yang sama dapat ditinggal, disimpan,
// dilanjutkan besok, dan disalin dari berkas soal yang sudah ada.
//
// ------------------------------------------------------------
// DUA BENTUK, DAN KENAPA KEDUANYA ADA
// ------------------------------------------------------------
// Excel untuk yang jawaban acuannya pendek dan butirnya banyak: satu baris per
// butir, terlihat sekaligus, mudah disalin dari lembar lain.
//
// Word untuk yang jawaban acuannya berupa paragraf. Sel Excel dapat memuat
// paragraf, tetapi mengetik paragraf di dalam sel adalah pekerjaan yang
// menyiksa, dan yang tersiksa akan memendekkan jawabannya sampai muat. Jawaban
// acuan yang dipendekkan supaya muat di dalam sel adalah jawaban acuan yang
// lebih buruk, dan seluruh penilaian bergantung padanya.
//
// Perakit .docx dan .xlsx-nya sudah ada di src/lib/template-soal.ts dan
// src/lib/template-xlsx.ts. Yang ditambahkan di sini hanya isinya.
// ============================================================
import { buatDocxTemplate } from "@/lib/template-soal";
import { buatXlsx, GAYA, hurufKolom, type Baris } from "@/lib/template-xlsx";
import { MAKS_BUTIR, MAKS_WAJIB, bersihkanButir, type ButirAcuan } from "@/lib/nilai-acuan";

export const KOLOM_ACUAN = ["NO", "PERTANYAAN", "JAWABAN ACUAN", "BOBOT", "ISTILAH WAJIB"];

export type HasilImporAcuan = {
  butir: ButirAcuan[];
  tolak: Array<{ baris: string; alasan: string }>;
};

/** Satu baris contoh untuk tiap keadaan yang mungkin membingungkan. */
const CONTOH_ACUAN: Array<Array<string | number>> = [
  [
    1,
    "Jelaskan manfaat energi terbarukan bagi lingkungan.",
    "Energi terbarukan menekan emisi gas rumah kaca karena tidak membakar bahan bakar fosil. " +
      "Tenaga surya dan angin mengurangi pencemaran udara serta memperlambat pemanasan global. " +
      "Sumbernya tidak habis sehingga ketergantungan pada batu bara berkurang.",
    50,
    "gas rumah kaca, bahan bakar fosil",
  ],
  [
    2,
    "Apa yang dimaksud agenda setting dalam komunikasi massa?",
    "Agenda setting adalah kemampuan media massa menentukan isu apa yang dianggap penting oleh khalayak. " +
      "Media tidak memberi tahu orang apa yang harus dipikirkan, melainkan tentang apa mereka berpikir. " +
      "Isu yang sering diberitakan akan dianggap lebih penting daripada isu yang jarang muncul.",
    50,
    "",
  ],
];

const PETUNJUK_ACUAN: string[] = [
  "KOLOM NO",
  "Nomor soal esai menurut urutan bank soal. Butir yang nomornya tidak ada di bank soal dilewati saat menilai.",
  "",
  "KOLOM PERTANYAAN",
  "Disalin sekadar supaya Anda tahu sedang menjawab soal yang mana. Kolom ini TIDAK ikut dinilai.",
  "",
  "KOLOM JAWABAN ACUAN",
  "Inilah yang dibandingkan dengan jawaban peserta. Tulis seperti Anda menulis jawaban terbaik yang Anda harapkan.",
  "Paling sedikit delapan kata. Di bawah itu pembandingannya bukan pembacaan melainkan kebetulan.",
  "Tulis dengan kalimat penuh, bukan daftar kata kunci. Yang diukur adalah kedekatan makna,",
  "dan sederet kata tanpa kalimat membuat hampir semua jawaban terlihat berjauhan darinya.",
  "",
  "KOLOM BOBOT",
  "Persen sumbangan butir ini terhadap nilai esai. Jumlah seluruh baris harus tepat 100.",
  "Kosongkan seluruh kolom bobot bila Anda ingin dibagi rata sendiri.",
  "",
  "KOLOM ISTILAH WAJIB",
  "Istilah yang harus muncul betapa pun tinggi kemiripannya. Dipisah tanda koma. Boleh dikosongkan.",
  "Yang tidak menyebutnya kehilangan nilai menurut bagiannya, bukan jatuh ke nol.",
  "Pakai hemat. Istilah wajib yang terlalu banyak mengubah penilaian makna kembali menjadi pencocokan kata.",
  "",
  "CARA MENILAINYA",
  "Jawaban peserta dan jawaban acuan sama-sama diubah menjadi vektor bobot kata TF-IDF,",
  "lalu diukur sudut di antara keduanya (cosine similarity).",
  "Parafrase yang benar tetap bernilai tinggi meskipun kalimatnya berbeda dari acuan.",
  "Jawaban panjang yang membicarakan hal lain tidak terbantu oleh panjangnya.",
  "",
  "BARIS KOSONG",
  "Baris yang kolom JAWABAN ACUAN-nya kosong dilewati diam-diam, bukan ditolak.",
];

const NASKAH_ACUAN_WORD = [
  "TEMPLATE JAWABAN ACUAN DOSEN",
  "",
  "Hapus dua contoh di bawah, lalu tulis jawaban acuan Anda sendiri dengan bentuk yang sama.",
  "",
  "Bentuk tiap butir:",
  "1. Tulis pertanyaannya di sini.",
  "Jawaban: tulis jawaban acuan Anda di sini, dengan kalimat penuh.",
  "Bobot: 50",
  "Wajib: istilah satu, istilah dua",
  "",
  "Baris Bobot dan Wajib boleh dihilangkan. Tanpa Bobot, seluruh butir dibagi rata.",
  "Jawaban acuan paling sedikit delapan kata.",
  "",
  "CONTOH, HAPUS BAGIAN INI",
  "",
  "1. Jelaskan manfaat energi terbarukan bagi lingkungan.",
  "Jawaban: Energi terbarukan menekan emisi gas rumah kaca karena tidak membakar bahan bakar fosil. " +
    "Tenaga surya dan angin mengurangi pencemaran udara serta memperlambat pemanasan global. " +
    "Sumbernya tidak habis sehingga ketergantungan pada batu bara berkurang.",
  "Bobot: 50",
  "Wajib: gas rumah kaca, bahan bakar fosil",
  "",
  "2. Apa yang dimaksud agenda setting dalam komunikasi massa?",
  "Jawaban: Agenda setting adalah kemampuan media massa menentukan isu apa yang dianggap penting oleh khalayak. " +
    "Media tidak memberi tahu orang apa yang harus dipikirkan, melainkan tentang apa mereka berpikir. " +
    "Isu yang sering diberitakan akan dianggap lebih penting daripada isu yang jarang muncul.",
  "Bobot: 50",
];

/** Template Word, untuk jawaban acuan yang berupa paragraf. */
export function buatDocxAcuan(): Blob {
  return buatDocxTemplate(NASKAH_ACUAN_WORD);
}

/** Template Excel, untuk butir yang banyak dan jawabannya pendek. */
export function buatXlsxAcuan(): Blob {
  const kolomTerakhir = hurufKolom(KOLOM_ACUAN.length);
  const tengah = (i: number) => i === 0 || i === 3;

  const baris: Baris[] = [
    {
      tinggi: 30,
      sel: KOLOM_ACUAN.map((_, i) =>
        i === 0 ? { nilai: "TEMPLATE JAWABAN ACUAN DOSEN", gaya: GAYA.judul } : { nilai: "", gaya: GAYA.judul },
      ),
    },
    {
      tinggi: 20,
      sel: KOLOM_ACUAN.map((_, i) =>
        i === 0
          ? {
              nilai:
                "Hapus dua baris contoh berwarna abu di bawah, lalu tulis jawaban acuan Anda sendiri. " +
                "Petunjuk lengkap ada pada lembar sebelah.",
              gaya: GAYA.anak,
            }
          : { nilai: "", gaya: GAYA.anak },
      ),
    },
    { tinggi: 34, sel: KOLOM_ACUAN.map((k) => ({ nilai: k, gaya: GAYA.kepala })) },
    ...CONTOH_ACUAN.map((c) => ({
      tinggi: 64,
      sel: KOLOM_ACUAN.map((_, i) => ({
        nilai: c[i] ?? "",
        gaya: tengah(i) ? GAYA.contohTengah : GAYA.contoh,
      })),
    })),
    // Dua puluh baris kosong yang sudah bergaris, supaya yang mengisi mengetik
    // ke DALAM tabel dan bukan ke ruang kosong di bawahnya.
    ...Array.from({ length: 20 }, () => ({
      sel: KOLOM_ACUAN.map((_, i) => ({ nilai: "", gaya: tengah(i) ? GAYA.isiTengah : GAYA.isi })),
    })),
  ];

  const petunjuk: Baris[] = [
    { tinggi: 30, sel: [{ nilai: "PETUNJUK PENGISIAN JAWABAN ACUAN", gaya: GAYA.petunjukJudul }] },
    { sel: [{ nilai: "", gaya: GAYA.petunjukIsi }] },
    ...PETUNJUK_ACUAN.map((p) => ({
      sel: [{ nilai: p, gaya: /^[A-Z ]+$/.test(p) && p !== "" ? GAYA.petunjukTebal : GAYA.petunjukIsi }],
    })),
  ];

  return buatXlsx([
    {
      nama: "Acuan",
      baris,
      lebar: [5, 44, 78, 8, 30],
      beku: 3,
      saring: `A3:${kolomTerakhir}3`,
      gabung: [`A1:${kolomTerakhir}1`, `A2:${kolomTerakhir}2`],
    },
    { nama: "Petunjuk", baris: petunjuk, lebar: [104], gabung: ["A1:A1"] },
  ]);
}

// ------------------------------------------------------------
// PEMBACA BERKAS YANG DIUNGGAH
// ------------------------------------------------------------

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/** Pecah daftar istilah wajib yang diketik dalam satu sel. */
function pecahWajib(mentah: unknown): string[] {
  return teks(mentah)
    .split(/[,;\n]/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w !== "")
    .slice(0, MAKS_WAJIB);
}

/**
 * Bagi bobot yang belum terisi.
 *
 * Dosen yang mengosongkan SELURUH kolom bobot bermaksud "bagi rata", dan itu
 * maksud yang lumrah. Yang mengisi sebagian bermaksud lain, dan menebaknya
 * berbahaya: bobot yang ditebak diam-diam adalah nilai yang berubah tanpa ada
 * yang memutuskannya. Karena itu hanya keadaan "semuanya kosong" yang
 * ditangani sendiri, sisanya diperiksa periksaAcuan dan dikeluhkan terbuka.
 */
function ratakanBila(butir: ButirAcuan[]): ButirAcuan[] {
  if (butir.length === 0) return butir;
  if (butir.some((b) => b.bobot > 0)) return butir;
  const dasar = Math.floor(100 / butir.length);
  return butir.map((b, i) => ({
    ...b,
    bobot: i === butir.length - 1 ? dasar + (100 - dasar * butir.length) : dasar,
  }));
}

/**
 * Lembar Excel sebagaimana dibaca SheetJS: baris berisi sel apa adanya.
 *
 * Boolean ikut disebut karena sel Excel memang dapat berisi TRUE dan FALSE,
 * dan pembaca yang tidak menyebutnya akan menolak berkas yang sah. Seluruh
 * sel melewati teks() sebelum dipakai, jadi jenisnya tidak pernah sampai ke
 * bagian yang menghitung.
 */
export type AoaAcuan = Array<Array<string | number | boolean | null | undefined>>;

/**
 * Baca lembar jawaban acuan dari Excel.
 *
 * Kolomnya dicari dari NAMANYA, bukan dari urutannya, persis seperti
 * imporDariExcel di src/lib/impor-soal.ts. Yang menyisipkan kolom catatan
 * sendiri atau menggeser urutannya tetap terbaca; yang bergantung pada urutan
 * kolom akan rusak pada berkas kedua yang diunggah orang.
 */
export function acuanDariExcel(aoa: AoaAcuan): HasilImporAcuan {
  const butir: ButirAcuan[] = [];
  const tolak: Array<{ baris: string; alasan: string }> = [];

  let kepala = -1;
  for (let i = 0; i < Math.min(aoa.length, 20); i += 1) {
    const baris = (aoa[i] || []).map((s) => teks(s).toUpperCase());
    if (baris.some((s) => s.startsWith("JAWABAN"))) { kepala = i; break; }
  }
  if (kepala < 0) {
    return {
      butir: [],
      tolak: [{
        baris: "-",
        alasan: "Baris judul kolom tidak ditemukan. Pakai template yang diunduh dari halaman ini.",
      }],
    };
  }

  const judul = (aoa[kepala] || []).map((s) => teks(s).toUpperCase());
  const cari = (pola: RegExp) => judul.findIndex((s) => pola.test(s));
  const kNomor = cari(/^NO$|^NOMOR/);
  const kTanya = cari(/^PERTANYAAN/);
  const kJawab = cari(/^JAWABAN/);
  const kBobot = cari(/^BOBOT/);
  const kWajib = cari(/^ISTILAH WAJIB|^WAJIB/);

  let urut = 0;
  for (let i = kepala + 1; i < aoa.length; i += 1) {
    const baris = aoa[i] || [];
    const ambil = (kolom: number) => (kolom >= 0 ? baris[kolom] : "");
    const jawaban = teks(ambil(kJawab));
    // Baris kosong dilewati diam-diam. Template selalu menyisakan baris
    // bergaris di bawah, dan mengeluhkannya membuat daftar tolak penuh oleh
    // yang bukan kesalahan siapa pun.
    if (!jawaban) continue;

    urut += 1;
    if (butir.length >= MAKS_BUTIR) {
      tolak.push({ baris: `Baris ${i + 1}`, alasan: `Melebihi batas ${MAKS_BUTIR} butir, sisanya tidak dibaca.` });
      break;
    }

    // Nomor yang kosong diisi urutan kemunculannya. Berkas yang kolom NO-nya
    // dibiarkan kosong tetap terbaca sebagai butir 1, 2, 3, dan itu yang
    // dimaksud orang yang membiarkannya kosong.
    const nomor = Number(teks(ambil(kNomor))) || urut;
    butir.push(bersihkanButir({
      nomor,
      pertanyaan: teks(ambil(kTanya)),
      jawaban,
      bobot: Number(teks(ambil(kBobot))) || 0,
      wajib: pecahWajib(ambil(kWajib)),
    }));
  }

  return { butir: ratakanBila(butir), tolak };
}

// ---------- WORD ----------

const POLA_NOMOR = /^(?:soal\s*)?(\d{1,3})\s*[.)]\s*(.*)$/i;
const POLA_LABEL = /^(jawaban|acuan|bobot|nilai|wajib|istilah|istilah wajib)\s*[:：]\s*(.*)$/i;

/**
 * Baca jawaban acuan dari naskah Word yang sudah diubah menjadi teks.
 *
 * Yang masuk ke sini adalah hasil mammoth di peramban, sama seperti pengimpor
 * soal. Bentuk yang dikenali sengaja longgar: nomor bertitik memulai butir
 * baru, baris berlabel mengisi medannya, dan baris polos di antaranya
 * disambung ke jawaban yang sedang berjalan.
 *
 * Yang terakhir itu yang penting. Jawaban acuan berupa paragraf akan dipecah
 * Word menjadi beberapa baris, dan pembaca yang hanya menerima satu baris per
 * label akan memotong jawaban acuan pada titik pertama tanpa mengatakan apa
 * pun. Nilai seluruh kelas kemudian dihitung dari sepertiga acuan yang
 * dimaksud dosen.
 */
export function acuanDariWord(mentah: string): HasilImporAcuan {
  const baris = String(mentah ?? "")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter((b) => b !== "");

  const butir: ButirAcuan[] = [];
  const tolak: Array<{ baris: string; alasan: string }> = [];

  let kini: { nomor: number; pertanyaan: string; jawaban: string[]; bobot: number; wajib: string[] } | null = null;
  /** Baris polos sedang menyambung jawaban, bukan pertanyaan. */
  let sedangJawab = false;

  function tutup() {
    if (!kini) return;
    const jawaban = kini.jawaban.join(" ").trim();
    if (!jawaban) {
      tolak.push({ baris: `Nomor ${kini.nomor}`, alasan: "Tidak ada baris \"Jawaban:\" pada butir ini." });
      kini = null;
      return;
    }
    if (butir.length >= MAKS_BUTIR) { kini = null; return; }
    butir.push(bersihkanButir({
      nomor: kini.nomor,
      pertanyaan: kini.pertanyaan.trim(),
      jawaban,
      bobot: kini.bobot,
      wajib: kini.wajib,
    }));
    kini = null;
  }

  for (const b of baris) {
    const nomor = POLA_NOMOR.exec(b);
    if (nomor) {
      tutup();
      kini = { nomor: Number(nomor[1]) || butir.length + 1, pertanyaan: nomor[2] || "", jawaban: [], bobot: 0, wajib: [] };
      sedangJawab = false;
      continue;
    }

    const label = POLA_LABEL.exec(b);
    if (label && kini) {
      const nama = label[1].toLowerCase();
      const isi = label[2] || "";
      if (nama === "jawaban" || nama === "acuan") { kini.jawaban.push(isi); sedangJawab = true; }
      else if (nama === "bobot" || nama === "nilai") { kini.bobot = Number(isi.replace(/[^\d]/g, "")) || 0; sedangJawab = false; }
      else { kini.wajib = pecahWajib(isi); sedangJawab = false; }
      continue;
    }

    // Baris polos. Menyambung jawaban bila jawabannya sudah dimulai, dan
    // menyambung pertanyaan bila belum.
    if (kini) {
      if (sedangJawab) kini.jawaban.push(b);
      else kini.pertanyaan = `${kini.pertanyaan} ${b}`.trim();
    }
  }
  tutup();

  if (butir.length === 0 && tolak.length === 0) {
    tolak.push({
      baris: "-",
      alasan:
        "Tidak ada butir yang terbaca. Tiap butir dimulai nomor bertitik, " +
        "lalu baris \"Jawaban:\" di bawahnya.",
    });
  }

  return { butir: ratakanBila(butir), tolak };
}
