// ============================================================
// LABEL TRANSKRIP NILAI — dwibahasa
//
// Disalin dari transkrip resmi KUI yang sudah tercetak dan ditandatangani,
// bukan diterjemahkan sendiri di sini. Beberapa label sebelumnya keliru pada
// dokumen yang justru dibuat untuk dibaca di luar negeri:
//
//   Nomor Ijazah Nasional  "DEGREE CERTIFICATE NUMBER"  -> NATIONAL DIPLOMA NUMBER
//   Nama Mahasiswa         "COMPLETE NAME"              -> STUDENT NAME
//   Nomor Induk Mahasiswa  "STUDENT REGISTRATION NUMBER"-> STUDENT IDENTIFICATION NUMBER
//   Jenjang                "COURSE"                     -> DEGREE LEVEL
//   Tanggal Yudisium       "DEGREE CONFERRAL DATE"      -> DATE OF DEGREE CONFERRAL
//   Total Nilai            "Total Grade Points"         -> Total Quality Points
//
// SATU lembar untuk KEDUA prodi: Ilmu Komunikasi dan Ilmu Pemerintahan
// memakai label yang sama persis, hanya isinya yang berbeda.
//
// Dipisah dari komponennya supaya dapat diuji sendirian — label transkrip
// ikut dilegalisir, jadi perubahannya harus tertahan uji, bukan hanya
// terlihat benar di layar.
//
// Pemisah "|" memindahkan bagian Inggris ke baris bawah dengan huruf miring;
// "/" memisahkannya pada baris yang sama.
//
// SETIAP garis miring pada label diapit spasi — "NAMA MAHASISWA / STUDENT
// NAME", bukan "NAMA MAHASISWA/STUDENT NAME". Termasuk yang jatuh di ujung
// baris pada label yang bagian Inggrisnya turun ke bawah: yang tercetak
// berbunyi "NOMOR IJAZAH NASIONAL /". Aturan itu dikunci uji, bukan
// kesepakatan lisan.
// ============================================================

export function labelTranskrip(EN: boolean) {
  return EN
    ? {
        title: "TRANSKRIP NILAI", subtitle: "OFFICIAL ACADEMIC TRANSCRIPT",
        noij: "NOMOR IJAZAH NASIONAL /|NATIONAL DIPLOMA NUMBER",
        nppt: "NOMOR POKOK PERGURUAN TINGGI /|NATIONAL HIGHER EDUCATION INSTITUTION CODE",
        yud: "TANGGAL YUDISIUM /|DATE OF DEGREE CONFERRAL", akred: "TERAKREDITASI /|ACCREDITATION",
        nama: "NAMA MAHASISWA /|STUDENT NAME",
        // Sebaris atau bertingkat ditentukan `LABEL_SEBARIS` di bawah, bukan
        // ditebak di tempat pemakaiannya. Seluruh label biodata menyambung
        // dengan pasangan Inggrisnya; yang bertingkat tinggal label nomor.
        fak: "FAKULTAS /|FACULTY",
        fakval: "ILMU SOSIAL DAN ILMU POLITIK /|SOCIAL AND POLITICAL SCIENCES",
        nim: "NOMOR INDUK MAHASISWA /|STUDENT IDENTIFICATION NUMBER",
        npps: "NOMOR POKOK PROGRAM STUDI /|NATIONAL STUDY PROGRAM CODE",
        prodi: "PROGRAM STUDI /|STUDY PROGRAM",
        ttl: "TEMPAT, TGL LAHIR /|PLACE, DATE OF BIRTH",
        jenjangLbl: "JENJANG /|DEGREE LEVEL", kons: "KONSENTRASI /|CONCENTRATION",
        th: ["NO", "KODE MK|Course", "NAMA MATA KULIAH|Descriptions", "K|CR", "HM|LG", "AM|GP", "M|QP"],
        totKredit: "Total Kredit / Total Credits", totNilai: "Total Nilai / Total Quality Points",
        ipkLbl: "Indeks Prestasi Kumulatif / Cumulative Grade Point Average (GPA)",
        predLbl: "Predikat Kelulusan / Graduation Honors",
        judul: "JUDUL SKRIPSI /|THESIS TITLE:", ket: "",
        ketval: "K = Kredit / Credits (CR) · HM = Huruf Mutu / Letter Grade (LG) · AM = Angka Mutu / Grade Point (GP) · M = Mutu Kredit / Quality Points (QP) = K × AM",
        meng: "Mengetahui / Acknowledged by,", rektor: "Rektor / Rector,", dekan: "Dekan / Dean,",
      }
    : {
        title: "TRANSKRIP NILAI", subtitle: "",
        noij: "NOMOR IJAZAH NASIONAL", nppt: "NOMOR POKOK PERGURUAN TINGGI",
        yud: "TANGGAL YUDISIUM", akred: "TERAKREDITASI",
        nama: "NAMA MAHASISWA",
        jenjangLbl: "JENJANG", fak: "FAKULTAS", fakval: "ILMU SOSIAL DAN ILMU POLITIK",
        nim: "NOMOR INDUK MAHASISWA", npps: "NOMOR POKOK PROGRAM STUDI", prodi: "PROGRAM STUDI",
        ttl: "TEMPAT, TGL LAHIR", kons: "KONSENTRASI",
        th: ["NO", "KODE MK", "NAMA MATA KULIAH", "K", "HM", "AM", "M"],
        totKredit: "Total Kredit", totNilai: "Total Nilai", ipkLbl: "Indeks Prestasi Kumulatif", predLbl: "Predikat Kelulusan",
        judul: "JUDUL SKRIPSI:", ket: "",
        ketval: "K = Kredit / SKS · HM = Huruf Mutu (A,B,C,D) · AM = Angka Mutu (1,2,3,4) · M = Mutu Kredit (K × AM)",
        meng: "Mengetahui,", rektor: "Rektor,", dekan: "Dekan,",
      };
}

/**
 * Peringkat akreditasi yang sedang berlaku untuk kedua prodi FISIP.
 *
 * Tertempel sendiri: admin tidak pernah diminta mengetik "UNGGUL" lagi, baik
 * pada template unduhan, pada lembar kosong di layar, maupun pada berkas
 * SIMAK yang datang hanya membawa nomor SK-nya.
 */
export const PERINGKAT_AKREDITASI = "UNGGUL";

/** Nomor SK akreditasi yang sedang berlaku. */
export const SK_AKREDITASI = "LAMSPAK Nomor 156/AK.03.05/2026";

/**
 * Isian akreditasi bawaan — satu sel, peringkat di depan nomor SK.
 *
 * Dipakai template unduhan MAUPUN lembar kosong di layar. Ditulis sekali di
 * sini: sewaktu tersebar di dua berkas, nomor SK sempat berganti di satu
 * tempat saja dan template unduhan berbulan-bulan membawa nomor lama.
 */
export const AKREDITASI_BAWAAN = `${PERINGKAT_AKREDITASI} ${SK_AKREDITASI}`;

/** Kata yang MEMULAI rujukan SK akreditasi. */
const AWAL_SK = /\b(LAMSPAK|BAN-PT|NOMOR|NO\.|SK)\b/i;

/**
 * Pecah isian akreditasi menjadi peringkat dan nomor SK-nya.
 *
 * Transkrip KUI mencetaknya bertingkat, peringkatnya sendirian di baris atas:
 *
 *     TERAKREDITASI / ACCREDITATION  :  UNGGUL
 *                                       LAMSPAK Nomor 156/AK.03.05/2026
 *
 * Satu isian, bukan dua kolom: berkas dari SIMAK maupun dari KUI menuliskan
 * keduanya pada satu sel, dan memecahnya menjadi dua kolom akan membuat
 * impor Excel kehilangan salah satunya.
 *
 * Pemenggalannya jatuh sebelum kata yang MEMULAI rujukan SK — LAMSPAK,
 * BAN-PT, Nomor, No., SK. Admin dapat memaksanya dengan menulis "|".
 *
 * Isian yang HANYA memuat nomor SK — bentuk yang dikirim SIMAK — tetap
 * tercetak dengan peringkatnya: `PERINGKAT_AKREDITASI` dipasang sendiri di
 * baris atas. Sebelumnya yang seperti itu tercetak tanpa peringkat sama
 * sekali, dan setiap transkrip menuntut koreksi tangan yang sama.
 *
 * Nomor SK tidak pernah ikut dirapikan spasinya: "156/AK.03.05/2026" adalah
 * nomor, bukan pasangan dwibahasa.
 */
export function pecahAkreditasi(nilai: string): [peringkat: string, sk: string] {
  const bersih = String(nilai || "").replace(/\s+/g, " ").trim();
  if (!bersih) return ["", ""];

  // Penggalan yang dipaksa admin dihormati apa adanya — termasuk kalau ia
  // sengaja mengosongkan peringkatnya. Itu satu-satunya jalan keluar dari
  // peringkat bawaan, jadi tidak boleh ikut diisi sendiri.
  const paksa = bersih.indexOf("|");
  if (paksa >= 0) {
    return [bersih.slice(0, paksa).trim().replace(/^"|"$/g, ""), bersih.slice(paksa + 1).trim()];
  }

  const batas = bersih.search(AWAL_SK);
  // Tidak ada rujukan SK sama sekali: seluruhnya peringkat, satu baris.
  if (batas < 0) return [bersih.replace(/^"|"$/g, ""), ""];
  // Langsung dibuka rujukan SK: peringkatnya yang hilang, bukan nomornya.
  if (batas === 0) return [PERINGKAT_AKREDITASI, bersih];
  return [bersih.slice(0, batas).trim().replace(/^"|"$/g, ""), bersih.slice(batas).trim()];
}

/**
 * Lengkapi isian akreditasi dengan peringkatnya, untuk DISIMPAN — bukan
 * untuk dicetak.
 *
 * Yang tercetak sudah diurus `pecahAkreditasi`. Yang ini dipakai di jalur
 * impor supaya kolom Akreditasi di layar, dan isian yang ikut diarsipkan,
 * berbunyi sama dengan yang tercetak: "UNGGUL LAMSPAK Nomor ...", bukan
 * nomor SK sendirian yang membuat admin mengira peringkatnya belum terisi.
 *
 * Tanda kutip bawaan berkas KUI — "UNGGUL" — ikut dibuang di sini, supaya
 * yang tersimpan sama dengan yang tertulis di template unduhan.
 */
export function lengkapiAkreditasi(nilai: string): string {
  const bersih = String(nilai || "").replace(/\s+/g, " ").trim();
  if (!bersih) return "";
  const [peringkat, sk] = pecahAkreditasi(bersih);
  if (!sk) return bersih;
  return bersih.startsWith(peringkat) ? bersih : `${peringkat} ${sk}`;
}

/**
 * Apakah transkrip ini memakai tanda tangan Rektor?
 *
 * Hanya nilai "dekan" yang mematikannya. Isian yang belum pernah menyebut
 * saklar ini — draf dan arsip yang dibuat sebelum saklarnya ada — tetap
 * tercetak dengan dua tanda tangan seperti sedia kala.
 */
export function pakaiRektorDari(ttd: string | undefined): boolean {
  return String(ttd || "").trim().toLowerCase() !== "dekan";
}

/**
 * Label mana yang tercetak SEBARIS, label mana yang BERTINGKAT.
 *
 * Bagian Inggris label TIDAK selalu turun ke baris bawah. Seluruh label
 * BIODATA menyambung dengan pasangan Inggrisnya pada baris yang sama —
 * "NAMA MAHASISWA / STUDENT NAME", bukan "STUDENT NAME" yang dipatahkan
 * sendirian di bawahnya:
 *
 *     NAMA MAHASISWA / STUDENT NAME              :  LUTFI ALHABSY
 *     NOMOR INDUK MAHASISWA /
 *     STUDENT IDENTIFICATION NUMBER              :  2270201140
 *     TEMPAT, TGL LAHIR / PLACE, DATE OF BIRTH   :  TANGERANG, 31 MARET 2001
 *     PROGRAM STUDI / STUDY PROGRAM              :  ILMU KOMUNIKASI
 *     TERAKREDITASI / ACCREDITATION              :  UNGGUL
 *     FAKULTAS / FACULTY                         :  ILMU SOSIAL …
 *     JENJANG / DEGREE LEVEL                     :  SARJANA / …
 *     KONSENTRASI / CONCENTRATION                :  ADVERTISING
 *
 * Yang tersisa BERTINGKAT hanyalah label nomor — nomor ijazah, NPPT,
 * tanggal yudisium, dan nomor pokok program studi — yang pasangan
 * Inggrisnya terlalu panjang ("NATIONAL HIGHER EDUCATION INSTITUTION CODE")
 * sehingga mendorong kolom nilainya ke kanan kalau dipaksa sebaris.
 *
 * Yang menyambung tetap dipatahkan sendiri oleh lebar kolomnya kalau tidak
 * muat — itu patahan alami di tengah label, bukan garis miring yang
 * menggantung di ujung baris.
 *
 * "TERAKREDITASI" sempat ikut dipatahkan padahal pada transkrip acuan ia
 * sebaris — dan patahan yang salah menggeser nomor SK akreditasi satu baris
 * ke bawah, tepat di tempat yang paling sering dibaca pemeriksa ijazah.
 *
 * Didaftar di sini, bukan ditebak dari panjang teksnya: yang tercetak harus
 * sama dengan acuan KUI, dan acuan tidak dapat dihitung dari jumlah huruf.
 */
export const LABEL_SEBARIS = [
  "akred", "fak", "jenjangLbl", "kons", "nama", "nim", "ttl", "prodi",
] as const;

export const LABEL_BERTINGKAT = ["noij", "nppt", "yud", "npps"] as const;

/** Apakah label ini dicetak sebaris dengan pasangan Inggrisnya? */
export function labelSebaris(kunci: string): boolean {
  return (LABEL_SEBARIS as readonly string[]).includes(kunci);
}
