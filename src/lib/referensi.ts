// CARI REFERENSI
//
// Mahasiswa Indonesia menghadapi dua tembok sekaligus: kebanyakan jurnal
// bermutu terkunci di balik langganan yang kampusnya tidak beli, dan mesin
// pencari biasa mencampur artikel ilmiah dengan blog, makalah tak terbit,
// serta jurnal yang tidak jelas penerbitnya. Akibatnya daftar pustaka
// skripsi kerap berisi sumber yang tidak dapat dipertanggungjawabkan.
//
// Alat ini mencari ke OpenAlex, katalog terbuka berisi lebih dari dua ratus
// juta karya ilmiah, gratis dan tanpa kunci API. Yang ditampilkan bukan
// sekadar daftar judul:
//   - inti penelitian ditarik dari abstraknya (kalimat aslinya, bukan
//     ringkasan buatan mesin, supaya tidak ada yang dikarang);
//   - ditandai mana yang naskah lengkapnya dapat diunduh gratis;
//   - ditandai mana yang terbit di jurnal terdaftar DOAJ;
//   - entri daftar pustaka gaya APA disusunkan agar dapat langsung disalin.

export type Karya = {
  id: string;
  judul: string;
  penulis: string[];
  tahun: number | null;
  jurnal: string;
  issn: string | null;
  doi: string | null;
  sitasi: number;
  abstrak: string;
  bisaDiunduh: boolean;
  tautanUnduh: string | null;
  diDoaj: boolean;
  bahasa: string | null;
  jenis: string;
  volume: string | null;
  nomor: string | null;
  halaman: string | null;
  inti: Inti[];
  apa: string;
};

export type BidangInti = "tujuan" | "metode" | "temuan" | "simpulan";

export const INTI_LABEL: Record<BidangInti, string> = {
  tujuan: "Yang diteliti",
  metode: "Cara penelitiannya",
  temuan: "Yang ditemukan",
  simpulan: "Simpulan dan implikasi",
};

export type Inti = { bidang: BidangInti; kalimat: string };

/**
 * OpenAlex menyimpan abstrak sebagai indeks terbalik (kata -> daftar posisi)
 * karena alasan hak cipta. Susun kembali menjadi kalimat.
 */
export function susunAbstrak(indeks: Record<string, number[]> | null | undefined): string {
  if (!indeks) return "";
  const kata: string[] = [];
  for (const [k, posisi] of Object.entries(indeks)) {
    if (!Array.isArray(posisi)) continue;
    for (const p of posisi) if (Number.isInteger(p) && p >= 0 && p < 20000) kata[p] = k;
  }
  return kata.filter((k) => k !== undefined).join(" ").replace(/\s+/g, " ").trim();
}

// Penanda yang dipakai penulis jurnal untuk menyatakan tujuan, cara, dan
// temuan. Sengaja hanya kalimat asli yang diambil: begitu kalimat disusun
// ulang oleh mesin, ia dapat menyatakan hal yang tidak ada di sumbernya.
const PENANDA: Array<{ bidang: BidangInti; pola: RegExp }> = [
  { bidang: "tujuan", pola: /\b(this (?:study|paper|article|research|work)|the (?:present )?(?:study|paper))\b[^.]{0,120}?\b(examin|investigat|explor|analy[sz]|aim|seek|assess|evaluat|address|propos|argu)/i },
  { bidang: "tujuan", pola: /\b(the (?:purpose|aim|objective|goal) of this)\b/i },
  { bidang: "tujuan", pola: /\bwe (?:examine|investigate|explore|analy[sz]e|assess|study|propose)\b/i },
  { bidang: "metode", pola: /\b(?:data (?:were|was) collected|using a (?:survey|questionnaire|sample)|a (?:survey|questionnaire) of|semi-structured interview|content analysis|regression analysis|structural equation|participants|respondents were|sample of \d|we (?:surveyed|interviewed|conducted|collected))\b/i },
  { bidang: "metode", pola: /\b(?:qualitative|quantitative|mixed-methods?|ethnograph|case study|experimental) (?:approach|design|method|study)\b/i },
  { bidang: "temuan", pola: /\b(?:results? (?:show|showed|indicate|indicated|suggest|reveal|revealed)|findings? (?:show|suggest|indicate|reveal)|we find|we found|the analysis (?:shows|revealed))\b/i },
  { bidang: "temuan", pola: /\b(?:significant(?:ly)? (?:positive|negative|effect|association|relationship|difference))\b/i },
  { bidang: "simpulan", pola: /\b(?:we conclude|the study concludes|these findings (?:suggest|imply)|implications for|this (?:study|paper) contributes)\b/i },
];

function pecahKalimat(teks: string) {
  return teks
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((k) => k.trim())
    .filter((k) => k.length >= 30 && k.length <= 420);
}

/** Tarik satu kalimat asli untuk tiap bidang, mengikuti urutan penulisan artikel. */
export function tarikInti(abstrak: string): Inti[] {
  if (!abstrak) return [];
  const kalimat = pecahKalimat(abstrak);
  const urut: BidangInti[] = ["tujuan", "metode", "temuan", "simpulan"];
  const hasil: Inti[] = [];
  const terpakai = new Set<number>();

  for (const bidang of urut) {
    const pola = PENANDA.filter((p) => p.bidang === bidang);
    for (let i = 0; i < kalimat.length; i += 1) {
      if (terpakai.has(i)) continue;
      if (!pola.some((p) => p.pola.test(kalimat[i]))) continue;
      terpakai.add(i);
      hasil.push({ bidang, kalimat: kalimat[i] });
      break;
    }
  }
  return hasil;
}

/** "Andreas M. Kaplan" -> "Kaplan, A. M." mengikuti gaya APA. */
export function namaApa(lengkap: string) {
  const bagian = lengkap.trim().split(/\s+/).filter(Boolean);
  if (bagian.length === 0) return "";
  if (bagian.length === 1) return bagian[0];
  const keluarga = bagian[bagian.length - 1];
  const inisial = bagian
    .slice(0, -1)
    .map((n) => `${n.charAt(0).toUpperCase()}.`)
    .join(" ");
  return `${keluarga}, ${inisial}`;
}

/** Entri daftar pustaka gaya APA edisi ketujuh. */
export function susunApa(k: Omit<Karya, "apa" | "inti">) {
  const nama = k.penulis.map(namaApa).filter(Boolean);
  let penulis: string;
  if (nama.length === 0) penulis = "[Tanpa nama penulis]";
  else if (nama.length === 1) penulis = nama[0];
  else if (nama.length <= 20) penulis = `${nama.slice(0, -1).join(", ")}, & ${nama[nama.length - 1]}`;
  else penulis = `${nama.slice(0, 19).join(", ")}, ... ${nama[nama.length - 1]}`;

  // Titik ganda mudah muncul di sini: inisial penulis sudah berakhir titik
  // ("Haenlein, M."), dan judul artikel kerap berakhir tanda seru atau tanya
  // ("Users of the world, unite!"). Keduanya tidak boleh ditambahi titik lagi.
  const titik = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

  const tahun = k.tahun ? `(${k.tahun})` : "(t.t.)";
  const judul = k.judul.replace(/\s+/g, " ").trim();
  const bagian = [`${titik(penulis)} ${tahun}. ${titik(judul)}`];

  if (k.jurnal) {
    let terbitan = k.jurnal;
    if (k.volume) terbitan += `, ${k.volume}`;
    if (k.nomor) terbitan += `(${k.nomor})`;
    if (k.halaman) terbitan += `, ${k.halaman}`;
    bagian.push(titik(terbitan));
  }
  if (k.doi) bagian.push(`https://doi.org/${k.doi.replace(/^https?:\/\/doi\.org\//, "")}`);

  return bagian.join(" ");
}

// ---------------------------------------------------------------------------
// Penyaringan dan pemeringkatan
// ---------------------------------------------------------------------------

export type Saringan = {
  tahunMinimal: number;
  hanyaBisaDiunduh: boolean;
  hanyaDoaj: boolean;
  bahasa: "semua" | "en" | "id";
};

export const SARINGAN_BAWAAN: Saringan = {
  tahunMinimal: new Date().getFullYear() - 10,
  hanyaBisaDiunduh: false,
  hanyaDoaj: false,
  bahasa: "semua",
};

/**
 * Peringkat gabungan: kecocokan kata kunci, kesegaran, dan seberapa sering
 * dirujuk. Jumlah sitasi ditekan lewat logaritma supaya artikel lama yang
 * sangat termasyhur tidak selalu menenggelamkan penelitian terbaru yang
 * justru lebih dekat dengan topik mahasiswa.
 */
export function nilaiKecocokan(k: Karya, kunci: string[], tahunKini: number) {
  const judul = k.judul.toLowerCase();
  const abstrak = k.abstrak.toLowerCase();
  let cocok = 0;
  for (const kata of kunci) {
    if (kata.length < 3) continue;
    if (judul.includes(kata)) cocok += 3;
    else if (abstrak.includes(kata)) cocok += 1;
  }
  const usia = k.tahun ? Math.max(0, tahunKini - k.tahun) : 25;
  const segar = Math.max(0, 10 - usia) / 10;
  const pengaruh = Math.log10(1 + Math.max(0, k.sitasi));
  return cocok * 2 + segar * 4 + pengaruh + (k.bisaDiunduh ? 1 : 0) + (k.diDoaj ? 0.5 : 0);
}

export function kataKunci(pertanyaan: string) {
  const buang = new Set([
    "yang", "dan", "atau", "untuk", "pada", "dari", "dengan", "dalam", "ke", "di",
    "apakah", "bagaimana", "terhadap", "adalah", "ini", "itu", "the", "and", "of",
    "in", "on", "for", "to", "a", "an", "is", "are", "how", "what", "does", "do",
  ]);
  return pertanyaan
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((k) => k.length >= 3 && !buang.has(k))
    .slice(0, 12);
}

// ---------------------------------------------------------------------------
// Pemetaan dari OpenAlex
// ---------------------------------------------------------------------------

export type KaryaOpenAlex = {
  id?: string;
  doi?: string | null;
  display_name?: string | null;
  title?: string | null;
  publication_year?: number | null;
  language?: string | null;
  type?: string | null;
  cited_by_count?: number | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: Array<{ author?: { display_name?: string | null } | null }> | null;
  primary_location?: {
    source?: { display_name?: string | null; issn_l?: string | null; is_in_doaj?: boolean | null } | null;
  } | null;
  open_access?: { is_oa?: boolean | null; oa_url?: string | null } | null;
  biblio?: { volume?: string | null; issue?: string | null; first_page?: string | null; last_page?: string | null } | null;
};

function gagal(pesan: string, kode = 400) {
  return Response.json({ success: false, message: pesan }, { status: kode });
}

function halaman(b: KaryaOpenAlex["biblio"]) {
  const awal = b?.first_page?.trim();
  const akhir = b?.last_page?.trim();
  if (awal && akhir && awal !== akhir) return `${awal}-${akhir}`;
  return awal || null;
}

/**
 * Ubah satu karya OpenAlex menjadi bentuk yang dipakai antarmuka.
 *
 * Seluruh bidang diperlakukan sebagai mungkin tidak ada. Katalog sebesar
 * OpenAlex selalu memuat catatan yang pincang: artikel tanpa jurnal, tanpa
 * abstrak, tanpa halaman. Satu catatan pincang tidak boleh menggagalkan
 * seluruh pencarian mahasiswa.
 */
export function dariOpenAlex(w: KaryaOpenAlex): Karya | null {
  const judul = (w.display_name ?? w.title ?? "").trim();
  if (!judul) return null;

  const sumber = w.primary_location?.source ?? null;
  const dasar = {
    id: w.id ?? judul,
    judul,
    penulis: (w.authorships ?? [])
      .map((a) => a?.author?.display_name?.trim() ?? "")
      .filter(Boolean)
      .slice(0, 25),
    tahun: typeof w.publication_year === "number" ? w.publication_year : null,
    jurnal: sumber?.display_name?.trim() ?? "",
    issn: sumber?.issn_l ?? null,
    doi: w.doi ?? null,
    sitasi: typeof w.cited_by_count === "number" ? w.cited_by_count : 0,
    abstrak: susunAbstrak(w.abstract_inverted_index),
    bisaDiunduh: Boolean(w.open_access?.is_oa && w.open_access?.oa_url),
    tautanUnduh: w.open_access?.oa_url ?? null,
    diDoaj: Boolean(sumber?.is_in_doaj),
    bahasa: w.language ?? null,
    jenis: w.type ?? "article",
    volume: w.biblio?.volume?.trim() || null,
    nomor: w.biblio?.issue?.trim() || null,
    halaman: halaman(w.biblio),
  };

  return { ...dasar, inti: tarikInti(dasar.abstrak), apa: susunApa(dasar) };
}
