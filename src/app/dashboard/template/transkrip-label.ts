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
// ============================================================

export function labelTranskrip(EN: boolean) {
  return EN
    ? {
        title: "TRANSKRIP NILAI", subtitle: "OFFICIAL ACADEMIC TRANSCRIPT",
        noij: "NOMOR IJAZAH NASIONAL/|NATIONAL DIPLOMA NUMBER",
        nppt: "NOMOR POKOK PERGURUAN TINGGI/|NATIONAL HIGHER EDUCATION INSTITUTION CODE",
        yud: "TANGGAL YUDISIUM/|DATE OF DEGREE CONFERRAL", akred: "TERAKREDITASI/|ACCREDITATION",
        nama: "NAMA MAHASISWA/|STUDENT NAME",
        // Tiga label ini dicetak KUI pada satu baris, tidak bertingkat seperti
        // label kolom kiri. Dirender dengan <BiIn>, bukan <Lbl>.
        fak: "FAKULTAS /|FACULTY",
        fakval: "ILMU SOSIAL DAN ILMU POLITIK/|SOCIAL AND POLITICAL SCIENCES",
        nim: "NOMOR INDUK MAHASISWA/|STUDENT IDENTIFICATION NUMBER",
        npps: "NOMOR POKOK PROGRAM STUDI/|NATIONAL STUDY PROGRAM CODE",
        prodi: "PROGRAM STUDI/|STUDY PROGRAM",
        ttl: "TEMPAT, TGL LAHIR/|PLACE, DATE OF BIRTH",
        jenjangLbl: "JENJANG /|DEGREE LEVEL", kons: "KONSENTRASI /|CONCENTRATION",
        th: ["NO", "KODE MK|Course", "NAMA MATA KULIAH|Descriptions", "K|CR", "HM|LG", "AM|GP", "M|QP"],
        totKredit: "Total Kredit / Total Credits", totNilai: "Total Nilai / Total Quality Points",
        ipkLbl: "Indeks Prestasi Kumulatif / Cumulative Grade Point Average (GPA)",
        predLbl: "Predikat Kelulusan / Graduation Honors",
        judul: "JUDUL SKRIPSI/|THESIS TITLE:", ket: "",
        ketval: "K = Kredit/Credits (CR) · HM = Huruf Mutu/Letter Grade (LG) · AM = Angka Mutu/Grade Point (GP) · M = Mutu Kredit/Quality Points (QP) = K × AM",
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
        ketval: "K = Kredit/SKS · HM = Huruf Mutu (A,B,C,D) · AM = Angka Mutu (1,2,3,4) · M = Mutu Kredit (K × AM)",
        meng: "Mengetahui,", rektor: "Rektor,", dekan: "Dekan,",
      };
}
