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
// baris karena bagian Inggrisnya turun ke bawah: yang tercetak berbunyi
// "NAMA MAHASISWA /". Aturan itu dikunci uji, bukan kesepakatan lisan.
// ============================================================

export function labelTranskrip(EN: boolean) {
  return EN
    ? {
        title: "TRANSKRIP NILAI", subtitle: "OFFICIAL ACADEMIC TRANSCRIPT",
        noij: "NOMOR IJAZAH NASIONAL /|NATIONAL DIPLOMA NUMBER",
        nppt: "NOMOR POKOK PERGURUAN TINGGI /|NATIONAL HIGHER EDUCATION INSTITUTION CODE",
        yud: "TANGGAL YUDISIUM /|DATE OF DEGREE CONFERRAL", akred: "TERAKREDITASI /|ACCREDITATION",
        nama: "NAMA MAHASISWA /|STUDENT NAME",
        // Tiga label ini dicetak KUI pada satu baris, tidak bertingkat seperti
        // label kolom kiri. Dirender dengan <BiIn>, bukan <Lbl>.
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
 * Nomor SK tidak pernah ikut dirapikan spasinya: "156/AK.03.05/2026" adalah
 * nomor, bukan pasangan dwibahasa.
 */
export function pecahAkreditasi(nilai: string): [peringkat: string, sk: string] {
  const bersih = String(nilai || "").replace(/\s+/g, " ").trim();
  if (!bersih) return ["", ""];

  const paksa = bersih.indexOf("|");
  if (paksa >= 0) {
    return [bersih.slice(0, paksa).trim().replace(/^"|"$/g, ""), bersih.slice(paksa + 1).trim()];
  }

  const batas = bersih.search(/\b(LAMSPAK|BAN-PT|NOMOR|NO\.|SK)\b/i);
  // Tanpa peringkat di depannya tidak ada yang perlu dipenggal: seluruhnya
  // tetap satu baris, supaya isian lama yang hanya memuat nomor SK tidak
  // tiba-tiba tercetak dengan baris atas yang kosong.
  if (batas <= 0) return [bersih.replace(/^"|"$/g, ""), ""];
  return [bersih.slice(0, batas).trim().replace(/^"|"$/g, ""), bersih.slice(batas).trim()];
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
