// CEK KEMIRIPAN DAN PARAFRASE
//
// Alat ini BUKAN Turnitin dan tidak berpura-pura menjadi Turnitin. Nilai
// Turnitin terletak pada korpusnya: jutaan skripsi mahasiswa dan jurnal
// berlangganan yang tidak dapat diakses siapa pun dari luar. Angka kemiripan
// yang dihasilkan di sini tidak akan sama dengan angka Turnitin, dan
// menyatakan sebaliknya akan menyesatkan mahasiswa tepat pada saat mereka
// paling tidak mampu menanggung akibatnya.
//
// Yang dikerjakan di sini justru pekerjaan yang bisa mahasiswa selesaikan
// sendiri sebelum unggahan Turnitin yang jatahnya sering hanya sekali:
//
//   1. Membandingkan naskah dengan sumber yang mahasiswa TEMPEL sendiri.
//      Ini kemiripan yang sesungguhnya, hanya saja lingkupnya jujur:
//      sebatas sumber yang memang dipakai.
//   2. Memeriksa hal-hal yang ditandai pembimbing dan penguji tanpa perlu
//      korpus apa pun: kutipan langsung tanpa nomor halaman, sitasi yang
//      tidak ada di daftar pustaka, rujukan yang tidak pernah disitasi,
//      kutipan yang porsinya berlebihan, dan bab yang disalin ke bab lain.
//   3. Menguji satu parafrase terhadap kalimat aslinya, supaya mahasiswa
//      belajar membedakan parafrase dari tukar-sinonim.
//
// Seluruhnya berjalan di perangkat. Naskah tidak dikirim ke mana pun.

const PANJANG_SIDIK = 8; // kata berurutan yang dianggap verbatim
const JARAK_ULANG_MINIMAL = 150; // kata; di bawah ini pengulangan masih wajar

export type Token = { kata: string; mulai: number; akhir: number };

/** Pecah teks menjadi kata beserta letaknya, supaya kutipan asli dapat diambil utuh. */
export function tokenkan(teks: string): Token[] {
  const token: Token[] = [];
  for (const m of teks.matchAll(/[\p{L}\p{N}]+/gu)) {
    const nilai = m[0];
    if (typeof m.index !== "number") continue;
    token.push({ kata: nilai.toLowerCase(), mulai: m.index, akhir: m.index + nilai.length });
  }
  return token;
}

/** Rentang teks yang berada di dalam tanda kutip, termasuk tanda kutip tipografis. */
export function rentangKutip(teks: string): Array<[number, number]> {
  const rentang: Array<[number, number]> = [];
  for (const m of teks.matchAll(/[“"]([^“”"]{1,4000})[”"]/g)) {
    if (typeof m.index === "number") rentang.push([m.index, m.index + m[0].length]);
  }
  return rentang;
}

function didalam(rentang: Array<[number, number]>, posisi: number) {
  return rentang.some(([a, b]) => posisi >= a && posisi < b);
}

function sidik(token: Token[], mulai: number) {
  let s = "";
  for (let i = 0; i < PANJANG_SIDIK; i += 1) s += (i ? " " : "") + token[mulai + i].kata;
  return s;
}

// ---------------------------------------------------------------------------
// 1. Kemiripan dengan sumber yang ditempel
// ---------------------------------------------------------------------------

export type Rentang = {
  mulaiKata: number;
  jumlahKata: number;
  kutipan: string;
  dalamKutip: boolean;
};

export type HasilSumber = {
  nama: string;
  jumlahKataSumber: number;
  kataCocok: number;
  persen: number;
  rentang: Rentang[];
};

export type Sumber = { nama: string; teks: string };

export type HasilKemiripan = {
  jumlahKataNaskah: number;
  kataCocokUnik: number;
  persenGabungan: number;
  persenTanpaKutipan: number;
  perSumber: HasilSumber[];
  kataDalamKutip: number;
  persenKutipan: number;
  pengulanganInternal: Rentang[];
};

/** Gabungkan indeks kata yang cocok menjadi rentang yang bersambung. */
function jadikanRentang(teks: string, token: Token[], cocok: Set<number>, kutip: Array<[number, number]>): Rentang[] {
  const urut = [...cocok].sort((a, b) => a - b);
  const hasil: Rentang[] = [];
  let i = 0;
  while (i < urut.length) {
    let j = i;
    while (j + 1 < urut.length && urut[j + 1] === urut[j] + 1) j += 1;
    const awal = urut[i];
    const akhir = urut[j];
    hasil.push({
      mulaiKata: awal,
      jumlahKata: akhir - awal + 1,
      kutipan: teks.slice(token[awal].mulai, token[akhir].akhir),
      dalamKutip: didalam(kutip, token[awal].mulai),
    });
    i = j + 1;
  }
  return hasil.sort((a, b) => b.jumlahKata - a.jumlahKata);
}

export function bandingkanSumber(naskah: string, sumber: Sumber[]): HasilKemiripan {
  const token = tokenkan(naskah);
  const kutip = rentangKutip(naskah);
  const kataDalamKutip = token.filter((t) => didalam(kutip, t.mulai)).length;

  const cocokGabungan = new Set<number>();
  const perSumber: HasilSumber[] = [];

  for (const s of sumber) {
    const tokenSumber = tokenkan(s.teks);
    const peta = new Set<string>();
    for (let i = 0; i + PANJANG_SIDIK <= tokenSumber.length; i += 1) peta.add(sidik(tokenSumber, i));

    const cocok = new Set<number>();
    for (let i = 0; i + PANJANG_SIDIK <= token.length; i += 1) {
      if (!peta.has(sidik(token, i))) continue;
      for (let k = 0; k < PANJANG_SIDIK; k += 1) {
        cocok.add(i + k);
        cocokGabungan.add(i + k);
      }
    }

    perSumber.push({
      nama: s.nama,
      jumlahKataSumber: tokenSumber.length,
      kataCocok: cocok.size,
      persen: token.length ? Math.round((cocok.size / token.length) * 1000) / 10 : 0,
      rentang: jadikanRentang(naskah, token, cocok, kutip),
    });
  }

  // Kemiripan yang berasal dari kutipan langsung yang ditandai dengan benar
  // tetap dihitung terpisah: itu bukan pelanggaran, hanya perlu diketahui.
  let cocokTanpaKutip = 0;
  for (const i of cocokGabungan) if (!didalam(kutip, token[i].mulai)) cocokTanpaKutip += 1;

  return {
    jumlahKataNaskah: token.length,
    kataCocokUnik: cocokGabungan.size,
    persenGabungan: token.length ? Math.round((cocokGabungan.size / token.length) * 1000) / 10 : 0,
    persenTanpaKutipan: token.length ? Math.round((cocokTanpaKutip / token.length) * 1000) / 10 : 0,
    perSumber: perSumber.sort((a, b) => b.persen - a.persen),
    kataDalamKutip,
    persenKutipan: token.length ? Math.round((kataDalamKutip / token.length) * 1000) / 10 : 0,
    pengulanganInternal: cariPengulangan(naskah, token, kutip),
  };
}

/** Bagian naskah yang muncul dua kali pada jarak berjauhan: bab yang disalin ke bab lain. */
function cariPengulangan(teks: string, token: Token[], kutip: Array<[number, number]>): Rentang[] {
  const pertama = new Map<string, number>();
  const ulang = new Set<number>();
  for (let i = 0; i + PANJANG_SIDIK <= token.length; i += 1) {
    const s = sidik(token, i);
    const awal = pertama.get(s);
    if (awal === undefined) {
      pertama.set(s, i);
    } else if (i - awal >= JARAK_ULANG_MINIMAL) {
      for (let k = 0; k < PANJANG_SIDIK; k += 1) ulang.add(i + k);
    }
  }
  return jadikanRentang(teks, token, ulang, kutip).slice(0, 20);
}

// ---------------------------------------------------------------------------
// 2. Pemeriksaan mandiri: sitasi dan kutipan
// ---------------------------------------------------------------------------

export type JenisTemuan =
  | "kutipan-tanpa-halaman"
  | "sitasi-tanpa-rujukan"
  | "rujukan-tak-disitasi"
  | "kutipan-berlebih";

export type Temuan = {
  jenis: JenisTemuan;
  berat: "salah" | "sebaiknya" | "periksa";
  kutipan: string;
  pesan: string;
  saran?: string;
};

export const TEMUAN_LABEL: Record<JenisTemuan, string> = {
  "kutipan-tanpa-halaman": "Kutipan tanpa halaman",
  "sitasi-tanpa-rujukan": "Sitasi tidak ada di daftar pustaka",
  "rujukan-tak-disitasi": "Rujukan tidak pernah disitasi",
  "kutipan-berlebih": "Porsi kutipan langsung",
};

/** Nama keluarga penulis pertama, dibakukan supaya dapat dibandingkan. */
function bakukanNama(nama: string) {
  return nama
    .toLowerCase()
    .replace(/[^\p{L}\s-]/gu, "")
    .replace(/\b(dkk|et al|and|dan)\b/g, "")
    .trim()
    .split(/\s+/)[0] ?? "";
}

export type Sitasi = { nama: string; tahun: string; mentah: string; adaHalaman: boolean; posisi: number };

/**
 * Ambil sitasi dalam teks bergaya APA.
 *
 * Sengaja hanya menangkap bentuk kurung "(Nama, 2019)" dan bentuk naratif
 * "Nama (2019)". Peraturan dan undang-undang dilewati karena bukan sitasi
 * penulis dan akan selalu dilaporkan keliru bila ikut ditangkap.
 */
export function ambilSitasi(teks: string): Sitasi[] {
  const hasil: Sitasi[] = [];
  const lihat = new Set<string>();

  const tambah = (nama: string, tahun: string, mentah: string, adaHalaman: boolean, posisi: number) => {
    const kunci = `${bakukanNama(nama)}|${tahun}`;
    if (!kunci.startsWith("|") && !lihat.has(kunci)) {
      lihat.add(kunci);
      hasil.push({ nama: bakukanNama(nama), tahun, mentah, adaHalaman, posisi });
    }
  };

  // (Sugiyono, 2019), (Sugiyono, 2019: 45), (Kaplan & Haenlein, 2010, hlm. 12)
  for (const m of teks.matchAll(/\(([^()]{2,120}?),\s*(\d{4})([^()]{0,40})\)/g)) {
    const nama = m[1];
    if (/undang|peraturan|permen|perpres|nomor\s+\d/i.test(nama)) continue;
    const ekor = m[3] ?? "";
    tambah(nama, m[2], m[0], /\d/.test(ekor), m.index ?? 0);
  }

  // Sugiyono (2019) menyatakan ...
  for (const m of teks.matchAll(/\b([A-Z][\p{L}'-]+(?:\s+(?:dan|&|dkk\.?|et\s+al\.?)\s*[\p{L}'-]*)?)\s*\((\d{4})[^)]{0,40}\)/gu)) {
    if (/undang|peraturan/i.test(m[1])) continue;
    tambah(m[1], m[2], m[0], false, m.index ?? 0);
  }

  return hasil;
}

export type Rujukan = { nama: string; tahun: string; mentah: string };

/** Ambil nama keluarga dan tahun dari tiap entri daftar pustaka. */
export function ambilRujukan(daftar: string): Rujukan[] {
  const hasil: Rujukan[] = [];
  for (const baris of daftar.split(/\n\s*\n|\n/)) {
    const b = baris.trim();
    if (b.length < 15) continue;
    const tahun = b.match(/\((\d{4})[a-z]?\)|\b(19|20)\d{2}\b/);
    if (!tahun) continue;
    const nama = bakukanNama(b.split(/[,.(]/)[0] ?? "");
    if (!nama) continue;
    hasil.push({ nama, tahun: tahun[1] ?? tahun[0], mentah: b });
  }
  return hasil;
}

export function periksaSitasi(naskah: string, daftarPustaka: string): Temuan[] {
  const temuan: Temuan[] = [];
  const token = tokenkan(naskah);
  const kutip = rentangKutip(naskah);

  // a. Kutipan langsung tanpa nomor halaman.
  for (const m of naskah.matchAll(/[“"]([^“”"]{25,600})[”"]\s*\(([^()]{2,120}?),\s*(\d{4})([^()]{0,40})\)/g)) {
    const ekor = m[4] ?? "";
    if (/\d/.test(ekor)) continue;
    temuan.push({
      jenis: "kutipan-tanpa-halaman",
      berat: "salah",
      kutipan: `“${m[1].slice(0, 90)}${m[1].length > 90 ? "…" : ""}” (${m[2]}, ${m[3]})`,
      pesan:
        "Kutipan langsung wajib menyertakan nomor halaman. Tanpa halaman, pembaca tidak dapat menelusuri kalimat ini ke sumbernya, dan penguji akan menanyakannya.",
      saran: `(${m[2]}, ${m[3]}, hlm. …)`,
    });
  }

  // b. Sitasi yang tidak ada di daftar pustaka, dan sebaliknya.
  const sitasi = ambilSitasi(naskah);
  const rujukan = ambilRujukan(daftarPustaka);

  if (rujukan.length > 0) {
    for (const s of sitasi) {
      const ada = rujukan.some((r) => r.nama === s.nama && r.tahun === s.tahun);
      const namaAda = rujukan.some((r) => r.nama === s.nama);
      if (ada) continue;
      temuan.push({
        jenis: "sitasi-tanpa-rujukan",
        berat: namaAda ? "periksa" : "salah",
        kutipan: s.mentah.slice(0, 90),
        pesan: namaAda
          ? `Nama "${s.nama}" ada di daftar pustaka tetapi tahunnya berbeda. Salah satu dari keduanya perlu dibetulkan.`
          : `Sitasi ini tidak menemukan pasangannya di daftar pustaka. Setiap sitasi dalam teks wajib punya entri.`,
      });
    }

    for (const r of rujukan) {
      if (sitasi.some((s) => s.nama === r.nama && s.tahun === r.tahun)) continue;
      temuan.push({
        jenis: "rujukan-tak-disitasi",
        berat: "sebaiknya",
        kutipan: r.mentah.slice(0, 110),
        pesan:
          "Entri ini ada di daftar pustaka tetapi tidak pernah disitasi dalam naskah. Daftar pustaka bukan daftar bacaan: yang tidak dipakai sebaiknya dikeluarkan.",
      });
    }
  }

  // c. Porsi kutipan langsung.
  const kataKutip = token.filter((t) => didalam(kutip, t.mulai)).length;
  const persen = token.length ? Math.round((kataKutip / token.length) * 1000) / 10 : 0;
  if (persen >= 10) {
    temuan.push({
      jenis: "kutipan-berlebih",
      berat: persen >= 20 ? "salah" : "sebaiknya",
      kutipan: `${persen}% dari naskah`,
      pesan:
        `Sekitar ${persen}% naskah berada di dalam tanda kutip. Kutipan langsung yang terlalu banyak membuat suara Anda sendiri hilang, dan angka kemiripan tetap tinggi walaupun semuanya disitasi dengan benar.`,
      saran: "Ubah sebagian menjadi parafrase, sisakan kutipan langsung untuk definisi dan pernyataan yang memang harus utuh.",
    });
  }

  return temuan;
}

// ---------------------------------------------------------------------------
// 3. Uji parafrase
// ---------------------------------------------------------------------------

export type PutusanParafrase = "salin" | "tukar-sinonim" | "parafrase-lemah" | "parafrase-baik";

export const PARAFRASE_LABEL: Record<PutusanParafrase, string> = {
  salin: "Masih salinan",
  "tukar-sinonim": "Baru tukar sinonim",
  "parafrase-lemah": "Parafrase belum cukup jauh",
  "parafrase-baik": "Parafrase memadai",
};

export type HasilParafrase = {
  jumlahKataAsli: number;
  jumlahKataBaru: number;
  persenKataSama: number;
  runTerpanjang: number;
  kutipanRun: string;
  urutanTerjaga: number;
  putusan: PutusanParafrase;
  pesan: string;
  saran: string[];
};

/** Panjang deret kata berurutan terpanjang yang sama persis. */
function runTerpanjang(a: string[], b: string[]) {
  let terbaik = 0;
  let indeks = 0;
  const baris = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    let sebelumnya = 0;
    for (let j = 1; j <= b.length; j += 1) {
      const simpan = baris[j];
      baris[j] = a[i - 1] === b[j - 1] ? sebelumnya + 1 : 0;
      if (baris[j] > terbaik) { terbaik = baris[j]; indeks = i; }
      sebelumnya = simpan;
    }
  }
  return { panjang: terbaik, akhir: indeks };
}

/** Panjang subbarisan sama terpanjang; dipakai untuk menakar apakah urutan kata dipertahankan. */
function subbarisan(a: string[], b: string[]) {
  let sebelum = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    const kini = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      kini[j] = a[i - 1] === b[j - 1] ? sebelum[j - 1] + 1 : Math.max(sebelum[j], kini[j - 1]);
    }
    sebelum = kini;
  }
  return sebelum[b.length];
}

/**
 * Batas kata untuk uji parafrase.
 *
 * Deret terpanjang dan subbarisan terpanjang keduanya berbiaya n kali m.
 * Pada dua teks seribu kata itu berarti sejuta sel, dan peramban berhenti
 * menanggapi. Alat ini memang untuk satu kalimat, bukan satu bab, jadi
 * batasnya ditetapkan tegas dan dinyatakan kepada pengguna.
 */
export const MAKS_KATA_PARAFRASE = 400;

export function ujiParafrase(asli: string, baru: string): HasilParafrase | null {
  const ta = tokenkan(asli).map((t) => t.kata);
  const tb = tokenkan(baru).map((t) => t.kata);
  if (ta.length < 5 || tb.length < 5) return null;
  if (ta.length > MAKS_KATA_PARAFRASE || tb.length > MAKS_KATA_PARAFRASE) return null;

  // Kesamaan kata dihitung sebagai multihimpunan supaya pengulangan tidak
  // membesarkan angkanya secara palsu.
  const hitung = new Map<string, number>();
  for (const k of ta) hitung.set(k, (hitung.get(k) ?? 0) + 1);
  let sama = 0;
  for (const k of tb) {
    const n = hitung.get(k) ?? 0;
    if (n > 0) { sama += 1; hitung.set(k, n - 1); }
  }
  const persenKataSama = Math.round((sama / Math.max(ta.length, tb.length)) * 1000) / 10;

  const run = runTerpanjang(ta, tb);
  const kutipanRun = run.panjang > 0 ? ta.slice(run.akhir - run.panjang, run.akhir).join(" ") : "";
  const urutanTerjaga = Math.round((subbarisan(ta, tb) / Math.min(ta.length, tb.length)) * 1000) / 10;

  let putusan: PutusanParafrase;
  let pesan: string;
  const saran: string[] = [];

  if (run.panjang >= PANJANG_SIDIK) {
    putusan = "salin";
    pesan = `Ada ${run.panjang} kata berurutan yang sama persis dengan kalimat asli. Deret sepanjang ini yang ditandai pemeriksa kemiripan mana pun.`;
    saran.push("Tutup teks aslinya, lalu tulis ulang dari ingatan. Itu cara paling cepat memutus deret kata yang sama.");
    saran.push("Bila kalimatnya memang harus utuh, jadikan kutipan langsung bertanda kutip beserta nomor halamannya.");
  } else if (urutanTerjaga >= 45 && persenKataSama >= 45) {
    // Ambang ditera pada contoh nyata: patchwriting jatuh di kisaran 60-73%
    // pada kedua sinyal, sedangkan parafrase yang sungguh disusun ulang
    // berada di 13-33%. Celah di antaranya lebar, jadi 45% aman di kedua sisi.
    // Urutan kata yang bertahan adalah pembedanya: ketika susunan kalimat
    // benar-benar diubah, urutan turun lebih cepat daripada kesamaan kata.
    putusan = "tukar-sinonim";
    pesan = `${persenKataSama}% kata masih sama dan urutannya sebagian besar tidak berubah. Mengganti kata dengan sinonim sambil mempertahankan susunan kalimat bukan parafrase; dalam pedoman akademik ini disebut patchwriting.`;
    saran.push("Ubah susunannya, bukan kata-katanya: pindahkan anak kalimat ke depan, gabungkan dua kalimat, atau pecah satu kalimat panjang.");
    saran.push("Ubah bentuk kalimat aktif ke pasif atau sebaliknya.");
  } else if (persenKataSama >= 50) {
    putusan = "parafrase-lemah";
    pesan = `${persenKataSama}% kata masih sama. Sebagian istilah teknis memang tidak boleh diganti, tetapi angka ini biasanya menandakan kalimatnya belum benar-benar disusun ulang.`;
    saran.push("Periksa apakah kata yang sama itu memang istilah teknis. Bila bukan, susun ulang kalimatnya.");
  } else {
    putusan = "parafrase-baik";
    pesan = `${persenKataSama}% kata sama, deret terpanjang ${run.panjang} kata. Susunannya sudah cukup jauh dari kalimat asli.`;
    saran.push("Tetap sertakan sitasi. Parafrase yang baik pun tetap gagasan orang lain.");
  }

  return {
    jumlahKataAsli: ta.length,
    jumlahKataBaru: tb.length,
    persenKataSama,
    runTerpanjang: run.panjang,
    kutipanRun,
    urutanTerjaga,
    putusan,
    pesan,
    saran,
  };
}
