// RADAR JURNAL: mesin penilaian risiko jurnal predator.
//
// Berkas ini sengaja hanya berisi fungsi murni: ia menerima bukti yang sudah
// dinormalkan lalu mengembalikan skor beserta rinciannya. Pengambilan data
// dari DOAJ, Crossref, dan OpenAlex ada di route API, supaya logika penilaian
// dapat diuji tanpa jaringan.
//
// Rujukan kriteria: Principles of Transparency and Best Practice in Scholarly
// Publishing, yang dipakai bersama oleh COPE, DOAJ, OASPA, dan WAME, serta daftar
// periksa Think. Check. Submit. Sinyal di bawah adalah penerjemahan prinsip
// tersebut menjadi hal-hal yang dapat dihitung dari data publik.
//
// PENTING: keluaran alat ini adalah PENILAIAN RISIKO, bukan putusan. Menyebut
// sebuah penerbit "predator" adalah tuduhan serius dan pernah berujung pada
// tekanan hukum terhadap pihak yang menerbitkan daftar semacam itu. Karena
// itu tidak ada satu pun label "predator" di sini. Yang ada adalah pita
// risiko, jumlah sinyal, dan bukti yang dapat ditelusuri kembali.

export type Bukti = {
  /** Nama jurnal sebagaimana ditemukan/diketik. */
  nama: string;
  issn: string[];
  situs: string | null;

  // --- Lapisan 1: identitas & pendaftaran ---
  /** Terdaftar di DOAJ. null = pemeriksaan gagal/tidak dilakukan. */
  doajTerdaftar: boolean | null;
  /** DOAJ mencatat proses telaah sejawat yang dinyatakan. */
  doajTelaahDinyatakan: boolean | null;
  /** DOAJ mencatat biaya publikasi diungkap di muka. */
  doajBiayaDiungkap: boolean | null;
  /** Anggota Crossref yang menyetorkan DOI. */
  crossrefMenyetorDoi: boolean | null;
  /** Jumlah total karya yang tercatat di Crossref. */
  crossrefJumlahKarya: number | null;
  /** Ada pada daftar sumber yang dihentikan Scopus. */
  scopusDihentikan: boolean | null;
  /** Terakreditasi SINTA, dikonfirmasi manual oleh pengguna. */
  sintaTerakreditasi: boolean | null;

  // --- Lapisan 2: forensik situs (diisi pengguna atau pengambil halaman) ---
  /** Situs memajang metrik dampak yang tidak diakui. */
  metrikPalsu: string[];
  /** Memajang lencana Scopus/WoS. */
  klaimLencanaIndeks: boolean | null;
  /** Surel kontak resmi memakai layanan gratis. */
  kontakSurelGratis: boolean | null;

  // --- Lapisan 3: perilaku penerbitan ---
  /** Median hari dari naskah diterima sampai disetujui. */
  medianHariTelaah: number | null;
  /** Banyaknya artikel yang dipakai menghitung median di atas. */
  sampelHariTelaah: number;
  /** Entropi topik ternormalkan (0 = satu topik, 1 = tersebar merata). */
  entropiCakupan: number | null;
  /** Rasio artikel tahun terakhir terhadap tahun sebelumnya. */
  rasioLonjakanVolume: number | null;
  /** Porsi sitasi yang berasal dari jurnal itu sendiri (0–1). */
  rasioSitasiDiri: number | null;
  /** Porsi penulis dari satu negara terbanyak (0–1). */
  pemusatanNegara: number | null;
  /** Tahun terbit paling awal yang tercatat. */
  tahunTerbitAwal: number | null;

  // --- Lapisan 4: dewan redaksi ---
  dewanTotal: number | null;
  dewanTerverifikasi: number | null;
};

export type Tingkat = "berat" | "sedang" | "ringan" | "positif";

export type Sinyal = {
  id: string;
  /** Kalimat yang dibaca pengguna. Selalu deskriptif, bukan penghakiman. */
  judul: string;
  /** Bukti konkret di balik sinyal ini. */
  bukti: string;
  sumber: string;
  bobot: number;
  tingkat: Tingkat;
};

export type Pita = "wajar" | "periksa" | "berisiko" | "sangat";

export type Hasil = {
  nama: string;
  issn: string[];
  skor: number;
  pita: Pita;
  /** Kalimat putusan. Tidak pernah memakai kata "predator". */
  putusan: string;
  menyala: number;
  diperiksa: number;
  takTerperiksa: string[];
  sinyal: Sinyal[];
  langkah: string[];
};

export const PITA_LABEL: Record<Pita, string> = {
  wajar: "Wajar, tidak ada tanda bahaya berarti",
  periksa: "Perlu diperiksa, ada yang sebaiknya Anda tanyakan",
  berisiko: "Berisiko, jangan kirim sebelum berkonsultasi",
  sangat: "Sangat berisiko, cari jurnal lain",
};

// Metrik yang dijual sebagai "impact factor" tetapi tidak diterbitkan lembaga
// pengindeks mana pun. Memajangnya adalah salah satu sinyal paling kuat.
export const METRIK_TIDAK_DIAKUI = [
  "global impact factor",
  "universal impact factor",
  "cosmos impact factor",
  "general impact factor",
  "scientific journal impact factor",
  "sjif",
  "infobase index",
  "journal impact factor (jif) international",
  "international impact factor services",
  "iifs",
  "directory of research journals indexing",
  "drji",
  "scientific indexing services",
  "eurasian scientific journal index",
];

const AMBANG = {
  telaahCepatHari: 14,
  sampelTelaahMinimum: 8,
  entropiTinggi: 0.78,
  lonjakanVolume: 5,
  sitasiDiri: 0.4,
  pemusatanNegara: 0.85,
  dewanTakTerverifikasi: 0.4,
} as const;

function pitaDari(skor: number): Pita {
  if (skor >= 45) return "sangat";
  if (skor >= 25) return "berisiko";
  if (skor >= 10) return "periksa";
  return "wajar";
}

/**
 * Hitung penilaian risiko dari bukti yang sudah dinormalkan.
 *
 * Setiap sinyal membawa bobot yang terlihat oleh pengguna. Skor tertutup
 * tidak dapat dipertahankan di hadapan dosen, dan memang tidak seharusnya.
 */
export function nilaiJurnal(bukti: Bukti): Hasil {
  const sinyal: Sinyal[] = [];
  const takTerperiksa: string[] = [];

  const tambah = (s: Sinyal) => sinyal.push(s);

  // ---------- Lapisan 1: identitas & pendaftaran ----------

  if (bukti.scopusDihentikan === true) {
    tambah({
      id: "scopus-dihentikan",
      judul: "Tercantum pada daftar sumber yang dihentikan Scopus",
      bukti: "Elsevier mengeluarkan judul ini dari Scopus. Alasan penghentian biasanya menyangkut mutu penerbitan.",
      sumber: "Daftar sumber dihentikan Scopus",
      bobot: 25,
      tingkat: "berat",
    });
  } else if (bukti.scopusDihentikan === null) {
    takTerperiksa.push("Daftar sumber yang dihentikan Scopus");
  }

  if (bukti.doajTerdaftar === true) {
    tambah({
      id: "doaj-terdaftar",
      judul: "Terdaftar di DOAJ",
      bukti: "Sebelum menerima sebuah jurnal, DOAJ menilainya dengan prinsip transparansi yang sama seperti COPE, OASPA, dan WAME.",
      sumber: "DOAJ",
      bobot: -15,
      tingkat: "positif",
    });
    if (bukti.doajTelaahDinyatakan === true) {
      tambah({
        id: "doaj-telaah",
        judul: "Proses telaah sejawat dinyatakan terbuka",
        bukti: "DOAJ mencatat jenis telaah sejawat yang dipakai jurnal ini.",
        sumber: "DOAJ",
        bobot: -5,
        tingkat: "positif",
      });
    }
    if (bukti.doajBiayaDiungkap === false) {
      tambah({
        id: "biaya-tertutup",
        judul: "Biaya publikasi tidak diungkap di muka",
        bukti: "Jurnal yang benar menyebut seluruh biaya di muka, lengkap dengan apa saja yang dicakup.",
        sumber: "DOAJ",
        bobot: 10,
        tingkat: "sedang",
      });
    }
  } else if (bukti.doajTerdaftar === false) {
    tambah({
      id: "doaj-tidak",
      judul: "Tidak terdaftar di DOAJ",
      bukti: "Ini wajar bila jurnalnya memang bukan akses terbuka. Baru jadi masalah kalau jurnal mengaku akses terbuka.",
      sumber: "DOAJ",
      bobot: 5,
      tingkat: "ringan",
    });
  } else {
    takTerperiksa.push("Pendaftaran DOAJ");
  }

  if (bukti.sintaTerakreditasi === true) {
    tambah({
      id: "sinta",
      judul: "Terakreditasi SINTA",
      bukti: "Dikonfirmasi manual oleh Anda. SINTA tidak punya API publik, jadi status ini tidak bisa diambil otomatis.",
      sumber: "Konfirmasi pengguna",
      bobot: -15,
      tingkat: "positif",
    });
  }

  if (bukti.crossrefMenyetorDoi === false) {
    tambah({
      id: "doi-tidak-disetor",
      judul: "Tidak ada penyetoran DOI ke Crossref",
      bukti: "Ini jadi tanda bahaya kalau jurnalnya tetap mencantumkan DOI pada artikel.",
      sumber: "Crossref",
      bobot: 8,
      tingkat: "ringan",
    });
  } else if (bukti.crossrefMenyetorDoi === true) {
    tambah({
      id: "doi-disetor",
      judul: "DOI benar disetorkan ke Crossref",
      bukti:
        bukti.crossrefJumlahKarya !== null
          ? `${bukti.crossrefJumlahKarya.toLocaleString("id-ID")} karya tercatat.`
          : "Terdaftar sebagai penyetor DOI yang aktif.",
      sumber: "Crossref",
      bobot: -3,
      tingkat: "positif",
    });
  } else {
    takTerperiksa.push("Penyetoran DOI Crossref");
  }

  // ---------- Lapisan 2: forensik situs ----------

  if (bukti.metrikPalsu.length > 0) {
    tambah({
      id: "metrik-palsu",
      judul: "Memajang metrik dampak yang tidak diakui",
      bukti: `Ditemukan: ${bukti.metrikPalsu.join(", ")}. Tidak satu pun metrik ini diterbitkan lembaga pengindeks. Menjualnya justru itulah modelnya.`,
      sumber: "Situs jurnal",
      bobot: 20,
      tingkat: "berat",
    });
  }

  // Memajang lencana Scopus/WoS padahal tidak terdaftar di keduanya bukan
  // kelalaian, melainkan keterangan yang menyesatkan calon penulis.
  const tidakDiIndeksBesar = bukti.scopusDihentikan === true || bukti.doajTerdaftar === false;
  if (bukti.klaimLencanaIndeks === true && tidakDiIndeksBesar) {
    tambah({
      id: "lencana-tanpa-dasar",
      judul: "Memajang lencana pengindeks tanpa dasar",
      bukti: "Situs memajang logo Scopus atau Web of Science, tetapi pendaftarannya tidak ditemukan.",
      sumber: "Situs jurnal + daftar sumber",
      bobot: 20,
      tingkat: "berat",
    });
  }

  if (bukti.kontakSurelGratis === true) {
    tambah({
      id: "surel-gratis",
      judul: "Kontak resmi memakai surel gratis",
      bukti: "Redaksi jurnal yang mapan memakai domain lembaganya sendiri, bukan Gmail atau Yahoo.",
      sumber: "Situs jurnal",
      bobot: 8,
      tingkat: "ringan",
    });
  }

  // ---------- Lapisan 3: perilaku penerbitan ----------

  if (bukti.medianHariTelaah !== null && bukti.sampelHariTelaah >= AMBANG.sampelTelaahMinimum) {
    if (bukti.medianHariTelaah < AMBANG.telaahCepatHari) {
      tambah({
        id: "telaah-terlalu-cepat",
        judul: `Median telaah ${bukti.medianHariTelaah} hari`,
        bukti: `Dihitung dari ${bukti.sampelHariTelaah} artikel yang menyetorkan tanggal diterima dan disetujui. Telaah sejawat ilmu sosial yang sungguhan jarang rampung di bawah dua minggu.`,
        sumber: "Crossref",
        bobot: 20,
        tingkat: "berat",
      });
    } else if (bukti.medianHariTelaah >= 45) {
      tambah({
        id: "telaah-wajar",
        judul: `Median telaah ${bukti.medianHariTelaah} hari`,
        bukti: `Dihitung dari ${bukti.sampelHariTelaah} artikel. Rentang ini wajar untuk telaah sejawat yang benar-benar berjalan.`,
        sumber: "Crossref",
        bobot: -8,
        tingkat: "positif",
      });
    }
  } else {
    takTerperiksa.push("Kecepatan telaah (penerbit tidak menyetorkan tanggal)");
  }

  if (bukti.entropiCakupan !== null) {
    if (bukti.entropiCakupan > AMBANG.entropiTinggi) {
      tambah({
        id: "cakupan-kacau",
        judul: "Cakupan topiknya terlalu melebar",
        bukti: `Keberagaman topik terukur ${(bukti.entropiCakupan * 100).toFixed(0)} dari 100. Jurnal yang benar punya fokus. Yang menerbitkan segala bidang sekaligus biasanya tidak menyeleksi apa pun.`,
        sumber: "Konsep OpenAlex",
        bobot: 15,
        tingkat: "sedang",
      });
    }
  } else {
    takTerperiksa.push("Sebaran cakupan topik");
  }

  if (bukti.rasioLonjakanVolume !== null && bukti.rasioLonjakanVolume >= AMBANG.lonjakanVolume) {
    tambah({
      id: "lonjakan-volume",
      judul: "Volume terbitan melonjak tajam",
      bukti: `Jumlah artikel naik sekitar ${bukti.rasioLonjakanVolume.toFixed(1)}× dibanding tahun sebelumnya.`,
      sumber: "OpenAlex",
      bobot: 12,
      tingkat: "sedang",
    });
  }

  if (bukti.rasioSitasiDiri === null) {
    takTerperiksa.push("Porsi sitasi diri");
  } else if (bukti.rasioSitasiDiri > AMBANG.sitasiDiri) {
    tambah({
      id: "sitasi-diri",
      judul: "Porsi sitasi diri tinggi",
      bukti: `${(bukti.rasioSitasiDiri * 100).toFixed(0)}% sitasi berasal dari jurnal ini sendiri. Lembaga pengindeks memakai ukuran serupa saat menangguhkan sebuah jurnal.`,
      sumber: "OpenAlex",
      bobot: 12,
      tingkat: "sedang",
    });
  }

  if (bukti.pemusatanNegara !== null && bukti.pemusatanNegara > AMBANG.pemusatanNegara) {
    const internasional = /international|internasional|global|world/i.test(bukti.nama);
    tambah({
      id: "pemusatan-negara",
      judul: internasional
        ? "Mengaku internasional, tetapi penulisnya menumpuk di satu negara"
        : "Penulis menumpuk di satu negara",
      bukti: `${(bukti.pemusatanNegara * 100).toFixed(0)}% penulis berasal dari satu negara yang sama.`,
      sumber: "OpenAlex",
      bobot: internasional ? 10 : 6,
      tingkat: "ringan",
    });
  }

  const tahunIni = new Date().getFullYear();
  if (bukti.tahunTerbitAwal !== null && tahunIni - bukti.tahunTerbitAwal >= 5) {
    const adaAnomali = sinyal.some((s) => s.tingkat === "berat");
    if (!adaAnomali) {
      tambah({
        id: "riwayat-panjang",
        judul: `Terbit sejak ${bukti.tahunTerbitAwal} tanpa anomali yang terdeteksi`,
        bukti: "Riwayat terbit yang panjang dan stabil sulit dipalsukan.",
        sumber: "OpenAlex",
        bobot: -10,
        tingkat: "positif",
      });
    }
  }

  // ---------- Lapisan 4: dewan redaksi ----------

  if (bukti.dewanTotal !== null && bukti.dewanTerverifikasi !== null && bukti.dewanTotal > 0) {
    const takTerverifikasi = bukti.dewanTotal - bukti.dewanTerverifikasi;
    const rasio = takTerverifikasi / bukti.dewanTotal;
    if (rasio > AMBANG.dewanTakTerverifikasi) {
      tambah({
        id: "dewan-tak-terverifikasi",
        judul: `${takTerverifikasi} dari ${bukti.dewanTotal} anggota dewan redaksi tidak dapat diverifikasi`,
        bukti: "Nama dan afiliasi yang diklaim tidak punya rekam jejak publikasi. Penerbit yang tidak menjalankan telaah sungguhan kerap mencatut nama akademisi tanpa izin, atau mengarangnya.",
        sumber: "OpenAlex",
        bobot: 18,
        tingkat: "berat",
      });
    } else if (rasio === 0) {
      tambah({
        id: "dewan-terverifikasi",
        judul: "Seluruh anggota dewan redaksi terverifikasi",
        bukti: `${bukti.dewanTotal} nama ditemukan dengan rekam jejak publikasi yang sesuai.`,
        sumber: "OpenAlex",
        bobot: -10,
        tingkat: "positif",
      });
    }
  } else {
    takTerperiksa.push("Verifikasi dewan redaksi");
  }

  // ---------- Skor ----------

  const skorMentah = sinyal.reduce((total, s) => total + s.bobot, 0);
  const skor = Math.max(0, Math.min(100, skorMentah));
  const pita = pitaDari(skor);

  const menyala = sinyal.filter((s) => s.bobot > 0).length;
  const berat = sinyal.filter((s) => s.tingkat === "berat").length;
  const diperiksa = sinyal.length + takTerperiksa.length;

  let putusan: string;
  if (menyala === 0) {
    putusan = "Tidak ada tanda bahaya dari sumber publik yang diperiksa.";
  } else {
    const bagianBerat = berat > 0 ? `, ${berat} di antaranya berbobot berat` : "";
    putusan = `${menyala} dari ${diperiksa} pemeriksaan menyalakan tanda bahaya${bagianBerat}.`;
  }

  // Urutkan: berat dulu, lalu bobot terbesar, sinyal positif di akhir.
  const urutanTingkat: Record<Tingkat, number> = { berat: 0, sedang: 1, ringan: 2, positif: 3 };
  sinyal.sort((a, b) => urutanTingkat[a.tingkat] - urutanTingkat[b.tingkat] || b.bobot - a.bobot);

  return {
    nama: bukti.nama,
    issn: bukti.issn,
    skor,
    pita,
    putusan,
    menyala,
    diperiksa,
    takTerperiksa,
    sinyal,
    langkah: langkahUntuk(pita, sinyal),
  };
}

function langkahUntuk(pita: Pita, sinyal: Sinyal[]): string[] {
  if (pita === "wajar") {
    return [
      "Cocokkan cakupan jurnal dengan topik Anda sebelum mengirim.",
      "Pastikan besaran biaya publikasi tertulis sebelum naskah diserahkan.",
    ];
  }

  const langkah = [
    "Bawa laporan ini ke dosen pembimbing sebelum memutuskan apa pun.",
    "Bandingkan dengan jurnal terakreditasi SINTA yang cakupannya cocok dengan topik Anda.",
  ];

  if (sinyal.some((s) => s.id === "biaya-tertutup")) {
    langkah.push("Minta rincian biaya secara tertulis sebelum mengirim apa pun.");
  }
  if (sinyal.some((s) => s.id === "telaah-terlalu-cepat")) {
    langkah.push("Tanyakan prosedur telaahnya secara tertulis: berapa penelaah, berapa lama, dan bagaimana hasilnya disampaikan.");
  }
  if (pita === "sangat") {
    langkah.push("Jangan kirim naskah ke jurnal ini. Begitu naskah masuk, Anda tidak boleh mengirimkannya ke jurnal lain sampai penarikan dikonfirmasi.");
  }

  return langkah;
}

/** Deteksi penyebutan metrik yang tidak diakui pada teks halaman jurnal. */
export function cariMetrikPalsu(teks: string): string[] {
  const rendah = teks.toLowerCase();
  const temuan = METRIK_TIDAK_DIAKUI.filter((metrik) => rendah.includes(metrik));
  // "sjif" cukup pendek untuk muncul kebetulan; minta konteks impact factor.
  return temuan.filter((metrik) => metrik.length > 4 || /impact\s*factor/.test(rendah));
}

/**
 * Entropi Shannon ternormalkan atas sebaran topik.
 * 0 = seluruh artikel satu topik; 1 = tersebar rata ke semua topik.
 */
export function entropiTernormalkan(jumlahPerTopik: number[]): number | null {
  const dipakai = jumlahPerTopik.filter((n) => n > 0);
  if (dipakai.length < 2) return dipakai.length === 1 ? 0 : null;
  const total = dipakai.reduce((a, b) => a + b, 0);
  const h = -dipakai.reduce((sum, n) => {
    const p = n / total;
    return sum + p * Math.log2(p);
  }, 0);
  return h / Math.log2(dipakai.length);
}

/** Median dari deretan angka. */
export function median(nilai: number[]): number | null {
  if (nilai.length === 0) return null;
  const urut = [...nilai].sort((a, b) => a - b);
  const tengah = Math.floor(urut.length / 2);
  return urut.length % 2 ? urut[tengah] : (urut[tengah - 1] + urut[tengah]) / 2;
}

/** Bukti kosong: seluruh pemeriksaan berstatus belum dilakukan. */
export function buktiKosong(nama: string, issn: string[]): Bukti {
  return {
    nama,
    issn,
    situs: null,
    doajTerdaftar: null,
    doajTelaahDinyatakan: null,
    doajBiayaDiungkap: null,
    crossrefMenyetorDoi: null,
    crossrefJumlahKarya: null,
    scopusDihentikan: null,
    sintaTerakreditasi: null,
    metrikPalsu: [],
    klaimLencanaIndeks: null,
    kontakSurelGratis: null,
    medianHariTelaah: null,
    sampelHariTelaah: 0,
    entropiCakupan: null,
    rasioLonjakanVolume: null,
    rasioSitasiDiri: null,
    pemusatanNegara: null,
    tahunTerbitAwal: null,
    dewanTotal: null,
    dewanTerverifikasi: null,
  };
}
