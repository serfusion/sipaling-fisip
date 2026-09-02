"use client";

// ============================================================
// PRATINJAU CAKRAWALA — halaman yang tampil selama menu terkunci
//
// Yang dilihat pengunjung di sini hanyalah etalase: nama tiap alat, apa yang
// dikerjakannya, dan gambaran tampilannya. Isi Cakrawala yang sebenarnya
// TIDAK ikut dikirim ke peramban — gerbangnya ada di server (page.tsx),
// sehingga halaman ini tidak dapat dilewati lewat alat pengembang.
// ============================================================

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Ic, IKON } from "./ikon";
import Animasi from "../animasi";
import Tangga, { Lanjutan } from "./tangga";
import BeliAkses from "./beli";
import { BaganAlurPikir, BaganKerangka, ContohGrafik } from "./grafik";
import { susunAlurPikir, susunKerangka } from "@/lib/kerangka";
import { usulkanVisual } from "@/lib/visual";
import {
  MINIMAL_KATA, contohProdi, empatJalur, hitungKataCerita, hitungTahapSiap,
  tafsirkan, tahapCerita,
  type Bacaan, type JalurAlternatif,
} from "@/lib/tafsir-cerita";
import { PENDEKATAN_LABEL } from "@/lib/metodologi";

type ProdiBerdaftar = "komunikasi" | "pemerintahan";

import { KONTAK } from "@/lib/kontak";

type Sorot = {
  id: string;
  ikon: string;
  nama: string;
  /** Satu baris pendek untuk deretan sorotan di kepala halaman. */
  singkat: string;
  /** Pertanyaan pembuka. Mahasiswa berhenti membaca pada keluhannya
      sendiri, bukan pada nama alat yang belum ia kenal. */
  kail: string;
  janji: string;
  rinci: string;
  otomatis: string;
  /** Ajakan pada kartunya. Alatnya masih terkunci, jadi tombolnya
      mengantar ke kotak kode akses, bukan langsung ke alat. */
  tombol: string;
  mock: string;
};

// Keterangan mengikuti apa yang dikerjakan tiap panel di dalam, bukan janji
// yang lebih besar dari alatnya.
const SOROTAN: Sorot[] = [
  {
    id: "judul",
    ikon: IKON.judul,
    nama: "Perumus Judul & Metode",
    singkat: "Judul, rumusan masalah, dan metode",
    kail: "Mau mulai skripsi dari mana?",
    janji: "Bingung menentukan judul?",
    rinci:
      "Masukkan topik yang kamu mau, lalu Cakrawala akan memberikan beberapa pilihan judul, rumusan masalah, dan metode penelitian yang bisa kamu gunakan sebagai bahan pertimbangan.",
    otomatis: "Nggak perlu bengong di depan halaman kosong.",
    tombol: "Coba Perumus Judul",
    mock: "judul",
  },
  {
    id: "referensi",
    ikon: IKON.referensi,
    nama: "Cari Referensi",
    singkat: "Jurnal ilmiah dari katalog OpenAlex",
    kail: "Males cari jurnal?",
    janji: "Cari jurnal cukup dengan memasukkan topik.",
    rinci:
      "Cakrawala membantu mencari penelitian yang sesuai dengan topikmu, lalu menampilkan informasi pentingnya. Jadi kamu nggak perlu buka banyak situs dan mencari satu per satu.",
    otomatis: "Cari jurnal lebih cepat, pilih yang paling cocok.",
    tombol: "Cari Jurnal",
    mock: "referensi",
  },
  {
    id: "kemiripan",
    ikon: IKON.kemiripan,
    nama: "Cek Kemiripan & Parafrase",
    singkat: "Kalimat berisiko dan saran gantinya",
    kail: "Takut tulisanmu mirip dengan orang lain?",
    janji: "Cek tulisanmu sebelum dikumpulkan.",
    rinci:
      "Masukkan tulisan yang ingin diperiksa. Cakrawala membantu menemukan bagian yang memiliki kemiripan dan memberikan saran untuk memperbaikinya.",
    otomatis: "Jadi kamu tahu bagian mana yang perlu diperbaiki.",
    tombol: "Cek Tulisan",
    mock: "kemiripan",
  },
  {
    id: "struktur",
    ikon: IKON.struktur,
    nama: "Struktur Naskah",
    singkat: "BAB I sampai V jadi kerangka IMRaD",
    kail: "Disuruh bikin artikel jurnal?",
    janji: "Skripsimu mau dijadikan artikel?",
    rinci:
      "Masukkan naskahmu dan Cakrawala membantu menyusun bagian-bagiannya menjadi struktur artikel jurnal. Kamu juga bisa melihat bagian mana yang masih kurang atau perlu dikembangkan.",
    otomatis: "Nggak perlu bingung mulai dari bagian mana.",
    tombol: "Cek Struktur Naskah",
    mock: "struktur",
  },
  {
    id: "inggris",
    ikon: IKON.inggris,
    nama: "Naskah Inggris",
    singkat: "Alih bahasa ke ragam jurnal",
    kail: "Pusing bahasa Inggris?",
    janji: "Bantu ubah tulisanmu ke bahasa Inggris.",
    rinci:
      "Masukkan kalimat atau naskah yang ingin diterjemahkan. Cakrawala membantu mengubahnya ke bahasa Inggris yang lebih cocok untuk tulisan akademik.",
    otomatis: "Cocok untuk abstrak, artikel, dan kebutuhan akademik lainnya.",
    tombol: "Coba Naskah Inggris",
    mock: "inggris",
  },
  {
    id: "sitasi",
    ikon: IKON.sitasi,
    nama: "Verifikasi Sitasi",
    singkat: "Daftar pustaka dicek ke Crossref",
    kail: "Daftar pustaka bikin pusing?",
    janji: "Cek apakah referensimu benar-benar ada.",
    rinci:
      "Tempel daftar pustakamu. Cakrawala akan membantu mengecek informasi referensi melalui beberapa sumber data akademik.",
    otomatis: "Nggak perlu mengecek referensi satu per satu.",
    tombol: "Cek Daftar Pustaka",
    mock: "sitasi",
  },
  {
    id: "radar",
    ikon: IKON.radar,
    nama: "Radar Jurnal",
    singkat: "Periksa ISSN sebelum kirim naskah",
    kail: "Sudah punya jurnal tujuan?",
    janji: "Mau tahu jurnalnya jelas atau tidak?",
    rinci:
      "Masukkan ISSN jurnal, lalu Cakrawala membantu menampilkan informasi tentang jurnal tersebut. Kamu bisa menggunakannya sebagai bahan pertimbangan sebelum mengirimkan artikel.",
    otomatis: "Cek dulu sebelum submit.",
    tombol: "Cek Jurnal",
    mock: "radar",
  },
  {
    id: "bahasa",
    ikon: IKON.bahasa,
    nama: "Periksa Bahasa",
    singkat: "Ejaan dan kata baku PUEBI",
    kail: "Takut typo atau salah tulis?",
    janji: "Cek tulisan sebelum dikirim ke dosen.",
    rinci:
      "Cakrawala membantu menemukan kata yang salah, kata yang tidak baku, tanda baca yang kurang tepat, dan kalimat yang kurang efektif. Setiap kesalahan akan diberi saran perbaikan.",
    otomatis: "Biar tulisanmu lebih rapi sebelum bimbingan.",
    tombol: "Periksa Tulisan",
    mock: "bahasa",
  },
  {
    id: "beranda",
    ikon: IKON.dokumen,
    nama: "Project & Laporan",
    singkat: "Naskah tersimpan, hasil siap dicetak",
    kail: "Capek copy-paste berkali-kali?",
    janji: "Simpan pekerjaanmu di satu tempat.",
    rinci:
      "Masukkan naskahmu sekali, lalu gunakan untuk berbagai fitur Cakrawala tanpa harus memasukkan ulang dari awal. Hasilnya juga bisa dibuat menjadi laporan untuk membantu persiapan bimbingan.",
    otomatis: "Sekali masukkan, bisa dipakai untuk banyak kebutuhan.",
    tombol: "Buka Project",
    mock: "beranda",
  },
];

// Daftar tutup pada bagian ringkasan, mengikuti urutan pada naskah.
const RINGKAS = [
  "Menentukan judul",
  "Mencari jurnal",
  "Mengecek kemiripan tulisan",
  "Membuat parafrase",
  "Menyusun artikel",
  "Menerjemahkan naskah",
  "Mengecek daftar pustaka",
  "Mengecek jurnal",
  "Memeriksa bahasa",
  "Menyimpan pekerjaan",
];

/** Gambaran tampilan tiap menu. Digambar dengan elemen biasa, bukan berkas
 *  gambar, supaya halamannya tetap ringan dan tajam di layar mana pun. */
function Mock({ jenis }: { jenis: string }) {
  if (jenis === "judul") {
    return (
      <div className="cw-mock cw-mock-judul">
        <span className="cw-bar cw-bar-l" />
        <span className="cw-bar cw-bar-m" />
        <div className="cw-chips">
          <i className="on">Kualitatif</i>
          <i>Kuantitatif</i>
          <i>Campuran</i>
        </div>
        <span className="cw-bar cw-bar-s" />
      </div>
    );
  }
  if (jenis === "referensi") {
    return (
      <div className="cw-mock cw-mock-ref">
        <div className="cw-search"><Ic d={IKON.referensi} /><span /></div>
        {[92, 78, 64].map((lebar, index) => (
          <div className="cw-row" key={index}>
            <span className="cw-bar" style={{ width: `${lebar}%` }} />
            <i>{2024 - index}</i>
          </div>
        ))}
      </div>
    );
  }
  if (jenis === "kemiripan") {
    return (
      <div className="cw-mock cw-mock-mirip">
        <div className="cw-meter"><b>18%</b><span /></div>
        <div className="cw-lines">
          <span className="cw-bar cw-bar-warn" />
          <span className="cw-bar cw-bar-m" />
          <span className="cw-bar cw-bar-ok" />
        </div>
      </div>
    );
  }
  if (jenis === "struktur") {
    return (
      <div className="cw-mock cw-mock-struktur">
        {[["BAB I", "Intro"], ["BAB III", "Method"], ["BAB IV", "Result"]].map(([kiri, kanan]) => (
          <div className="cw-map" key={kiri}>
            <i>{kiri}</i>
            <em>→</em>
            <b>{kanan}</b>
          </div>
        ))}
      </div>
    );
  }
  if (jenis === "inggris") {
    return (
      <div className="cw-mock cw-mock-inggris">
        <div className="cw-duo">
          <span className="cw-tag">ID</span>
          <span className="cw-bar cw-bar-l" />
        </div>
        <div className="cw-duo">
          <span className="cw-tag cw-tag-en">EN</span>
          <span className="cw-bar cw-bar-m" />
        </div>
        <div className="cw-duo">
          <span className="cw-tag cw-tag-en">EN</span>
          <span className="cw-bar cw-bar-s" />
        </div>
      </div>
    );
  }
  if (jenis === "sitasi") {
    return (
      <div className="cw-mock cw-mock-sitasi">
        {[["ok", "✓"], ["warn", "?"], ["bad", "✕"]].map(([tone, tanda], index) => (
          <div className="cw-cek" key={tone}>
            <i className={`cw-dot cw-dot-${tone}`}>{tanda}</i>
            <span className="cw-bar" style={{ width: `${88 - index * 14}%` }} />
          </div>
        ))}
      </div>
    );
  }
  if (jenis === "radar") {
    return (
      <div className="cw-mock cw-mock-radar">
        <span className="cw-ring cw-ring-1" />
        <span className="cw-ring cw-ring-2" />
        <span className="cw-ring cw-ring-3" />
        <span className="cw-blip cw-blip-a" />
        <span className="cw-blip cw-blip-b" />
        <span className="cw-blip cw-blip-c" />
      </div>
    );
  }
  if (jenis === "bahasa") {
    return (
      <div className="cw-mock cw-mock-bahasa">
        <p>
          <span>Penelitian ini </span>
          <u>mengunakan</u>
          <span> metode </span>
          <u>diskriptif</u>
          <span> kualitatif.</span>
        </p>
        <div className="cw-fix"><i>menggunakan</i><i>deskriptif</i></div>
      </div>
    );
  }
  return (
    <div className="cw-mock cw-mock-project">
      <div className="cw-file"><Ic d={IKON.dokumen} /><span /></div>
      <div className="cw-progress"><i style={{ width: "72%" }} /></div>
      <div className="cw-meta"><span>5 bab</span><span>12.480 kata</span></div>
    </div>
  );
}


/* ==========================================================================
   ETALASE HIDUP: CERITA MASUK, METODE KELUAR

   Bagian ini satu-satunya di halaman kunci yang benar-benar bekerja, bukan
   gambaran tampilan. Alasannya sederhana: menjelaskan bahwa Cakrawala bisa
   menemukan metode dari sebuah cerita tidak pernah semeyakinkan menunjukkan
   ia melakukannya pada cerita pengunjung sendiri.

   Empat contoh disediakan, satu untuk tiap rancangan yang paling sering
   dipakai di FISIP: pengaruh, analisis isi, fenomenologi, dan studi kasus.
   Menekannya bergantian memperlihatkan hal yang paling sulit dijelaskan
   dengan kata-kata, yaitu bahwa jalur kuantitatif dan kualitatif ditentukan
   oleh bentuk pertanyaannya, bukan oleh selera penelitinya.

   Kerangka berpikirnya tidak ditutup, melainkan memudar: bagian atasnya
   terbaca utuh, bagian bawahnya makin kabur. Tidak ada gembok dan tidak ada
   tirai. Yang di halaman ini pun bukan rahasia siapa-siapa, melainkan bagan
   yang disusun dari cerita pengunjung itu sendiri; gembok yang sebenarnya
   ada di server (page.tsx) dan menjaga kesembilan alatnya.
   ========================================================================== */

type HasilCoba = {
  bacaan: Bacaan;
  jalur: JalurAlternatif[];
};

/**
 * Rancangan yang paling sesuai ceritanya, dipakai melengkapi lima tahap
 * terakhir pada tangga. Sebelum tombolnya ditekan hasilnya belum ada, dan
 * kelima tahap itu memang seharusnya masih gelap.
 */
function rancanganTerpilih(hasil: HasilCoba | null) {
  if (!hasil) return null;
  const pas = hasil.jalur.find((j) => j.pas) ?? hasil.jalur[0];
  return pas?.rancangan ?? null;
}

const PRODI_PILIHAN: Array<{ id: ProdiBerdaftar; nama: string; ket: string }> = [
  { id: "komunikasi", nama: "Ilmu Komunikasi", ket: "Pengaruh, analisis isi, framing, semiotika" },
  { id: "pemerintahan", nama: "Ilmu Pemerintahan", ket: "Pengaruh, efektivitas, implementasi kebijakan" },
];

/** Bintang kesulitan. Bukan penilaian mutu, melainkan berat pengerjaannya. */
function Bintang({ nilai }: { nilai: 1 | 2 | 3 }) {
  return (
    <span className="cw-bintang" title={`Berat pengerjaan ${nilai} dari 3`} aria-label={`Berat pengerjaan ${nilai} dari 3`}>
      {"★".repeat(nilai)}
      <i>{"★".repeat(3 - nilai)}</i>
    </span>
  );
}

function EtalaseCoba() {
  // Prodi ditanyakan lebih dulu, dan itu bukan basa-basi. Daftar rancangan
  // kedua prodi memang berbeda: analisis framing dan semiotika tidak ada di
  // skripsi pemerintahan, implementasi kebijakan dan tata kelola tidak ada di
  // skripsi komunikasi. Menjawab tanpa tahu prodinya berarti separuh
  // pengunjung selalu diberi daftar yang salah.
  const [prodi, setProdi] = useState<ProdiBerdaftar | null>(null);
  const [cerita, setCerita] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<HasilCoba | null>(null);
  const [lanjut, setLanjut] = useState("");

  const kata = hitungKataCerita(cerita);
  const cukup = kata >= MINIMAL_KATA;

  // Tangga penyusunan dihitung ulang tiap ketukan papan tik. Membacanya murni
  // penelusuran pola pada teks pendek, jadi cukup murah untuk dijalankan
  // seketika; useMemo di sini menahan perhitungan ulang ketika yang berubah
  // hanya bagian lain dari tampilan.
  const tahap = useMemo(
    () => (prodi && cerita.trim() ? tahapCerita(tafsirkan(cerita, prodi), rancanganTerpilih(hasil)) : null),
    [cerita, prodi, hasil],
  );

  function carikan(teks = cerita, pakai = prodi) {
    if (sibuk || !pakai || hitungKataCerita(teks) < MINIMAL_KATA) return;
    setSibuk(true);
    setHasil(null);
    // Perhitungannya seketika. Jeda pendek ini semata supaya perpindahan dari
    // "menekan tombol" ke "hasil muncul" terbaca sebagai satu kejadian.
    window.setTimeout(() => {
      const bacaan = tafsirkan(teks, pakai);
      setHasil({ bacaan, jalur: empatJalur(bacaan) });
      setSibuk(false);
    }, 700);
  }

  function gantiProdi(id: ProdiBerdaftar) {
    setProdi(id);
    setHasil(null);
    setCerita("");
    setLanjut("");
  }

  /**
   * Sambung tambahan mahasiswa ke ceritanya yang lama, lalu susun ulang.
   *
   * Digabung, bukan diganti: kalimat baru sering hanya berisi satu keping
   * yang kurang ("di Kota Tangerang"), dan membacanya sendirian akan
   * menghapus seluruh yang sudah terbaca sebelumnya.
   */
  function gabungkan() {
    const tambahan = lanjut.trim();
    if (!tambahan || !prodi) return;
    const gabungan = `${cerita.trim()} ${tambahan}`.trim();
    setCerita(gabungan);
    setLanjut("");
    carikan(gabungan, prodi);
  }

  return (
    <section id="coba" className="cw-coba" aria-label="Coba temukan metode penelitianmu">
      <div className="cw-coba-kepala">
        <p className="cw-eyebrow">COBA DULU, TANPA KODE AKSES</p>
        <h2>Ceritakan skripsi atau jurnal yang kamu pikirkan</h2>
        <p className="cw-coba-sub">
          Nggak perlu tahu istilah metodologi. Tulis apa adanya: apa yang kamu lihat, siapa yang mau kamu
          teliti, di mana. Lalu Cakrawala menunjukkan metode mana yang bisa menjawabnya.
        </p>
      </div>

      <div className="cw-prodi">
        <p className="cw-prodi-tanya"><b>Kamu dari prodi apa?</b> Daftar metodenya berbeda, jadi ini ditanyakan lebih dulu.</p>
        <div className="cw-prodi-baris">
          {PRODI_PILIHAN.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`cw-prodi-kartu ${prodi === p.id ? "on" : ""}`}
              aria-pressed={prodi === p.id}
              disabled={sibuk}
              onClick={() => gantiProdi(p.id)}
            >
              <b>{p.nama}</b>
              <small>{p.ket}</small>
            </button>
          ))}
        </div>
      </div>

      {prodi && (
        <>
          <div className="cw-coba-kotak">
            <label htmlFor="cw-cerita">Ceritamu</label>
            <textarea
              id="cw-cerita"
              rows={6}
              value={cerita}
              onChange={(e) => setCerita(e.target.value)}
              placeholder="Aku pengen neliti soal…"
            />
            <div className="cw-coba-baris">
              <span className="cw-coba-hitung">
                {kata} kata{cukup ? "" : ` · minimal ${MINIMAL_KATA} kata`}
              </span>
              <button type="button" className="cw-btn cw-btn-utama" onClick={() => carikan()} disabled={!cukup || sibuk}>
                {sibuk ? "Membaca ceritamu…" : "Carikan metodenya"}
              </button>
            </div>
            {tahap && (
              <Tangga tahap={tahap} siap={hitungTahapSiap(tahap)} />
            )}
            <p className="cw-coba-aman">
              Ceritamu dibaca di perangkat ini juga dan <b>tidak dikirim ke server mana pun</b>.
            </p>
          </div>

          <div className="cw-contoh">
            <p className="cw-contoh-judul">
              Belum kepikiran? Tekan salah satu contoh {PRODI_PILIHAN.find((p) => p.id === prodi)?.nama} ini,
              lalu lihat sendiri hasilnya.
            </p>
            <div className="cw-contoh-baris">
              {contohProdi(prodi).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cw-contoh-kartu ${c.jalur}`}
                  disabled={sibuk}
                  onClick={() => { setCerita(c.cerita); carikan(c.cerita, prodi); }}
                >
                  <b>{c.label}</b>
                  <small>{c.jalur}</small>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {hasil && (
        <>
          <HasilCobaTampil hasil={hasil} />
          <Lanjutan
            pertanyaan={hasil.bacaan.pertanyaan}
            nilai={lanjut}
            onNilai={setLanjut}
            onKirim={gabungkan}
            sibuk={sibuk}
          />
        </>
      )}
    </section>
  );
}

function HasilCobaTampil({ hasil }: { hasil: HasilCoba }) {
  const { bacaan, jalur } = hasil;

  // Yang paling sesuai ceritanya dipilih lebih dulu. Tiga sisanya tetap satu
  // ketukan jauhnya, karena maksud bagian ini justru memperlihatkan bahwa
  // satu topik bisa diteliti lebih dari satu cara.
  const [pilih, setPilih] = useState(() => Math.max(0, jalur.findIndex((j) => j.pas)));
  const j = jalur[pilih] ?? jalur[0];
  const rancangan = j.rancangan;

  const pakaiVariabel = j.masukan.tujuan === "pengaruh" || j.masukan.tujuan === "hubungan";
  const kerangka = pakaiVariabel ? susunKerangka(j.masukan) : null;
  const alur = pakaiVariabel ? null : susunAlurPikir(j.masukan, rancangan.jenis, rancangan.teori);
  const visual = usulkanVisual(rancangan.jenis);
  const hambat = rancangan.peringatan.filter((p) => p.berat === "hambat").length;
  const modelAnjuran = rancangan.model.find((k) => k.anjuran) ?? rancangan.model[0];

  return (
    <div className="cw-hasil">
      {!bacaan.cukup && (
        <p className="cw-hasil-tipis">
          Ceritanya masih terlalu ringkas untuk dibaca dengan yakin. Yang di bawah ini dugaan sementara.
          Tambahkan siapa yang mau kamu teliti dan di mana, lalu coba lagi.
        </p>
      )}

      <div className="cw-hasil-buka">
        <span className="cw-hasil-tanda">EMPAT JUDUL DARI CERITAMU</span>
        <p className="cw-hasil-baca">{bacaan.ringkas}</p>

        <div className="cw-judul-baris">
          {jalur.map((k, i) => (
            <button
              key={k.id}
              type="button"
              className={`cw-judul-kartu ${k.jalur} ${i === pilih ? "on" : ""}`}
              aria-pressed={i === pilih}
              onClick={() => setPilih(i)}
            >
              {k.pas && <span className="cw-judul-pas">paling sesuai ceritamu</span>}
              <b>{k.judul}</b>
              <span className="cw-judul-kaki">
                <span className="cw-judul-metode">{k.metode}</span>
                <small>{k.kerja}</small>
                <Bintang nilai={k.kesulitan} />
              </span>
            </button>
          ))}
        </div>

        <p className="cw-judul-catatan">
          Satu topik memang bisa diteliti lebih dari satu cara. Yang menentukan metodenya adalah bentuk
          pertanyaan yang kamu pilih, bukan selera. Bagian dalam kurung siku isian yang kamu lengkapi sendiri,
          dan bintangnya berat pengerjaan, bukan nilai bagus atau jelek.
        </p>

        {/* Empat lapis yang paling sering tertukar. "Pengaruh" bukan metode,
            "framing" bukan pendekatan, dan menulis keduanya di baris yang sama
            di bab tiga adalah salah satu sebab naskah dipulangkan. */}
        <div className="cw-lapis">
          <div><span>PENDEKATAN</span><p>{PENDEKATAN_LABEL[rancangan.pendekatan]}</p></div>
          <div><span>METODE</span><p>{rancangan.metodePola}</p></div>
          <div>
            <span>MODEL ATAU TEORI</span>
            <p>{modelAnjuran ? modelAnjuran.nama : "Tidak ada lapis model; yang dipilih teori yang menjelaskan variabelnya"}</p>
          </div>
          <div><span>TEKNIK ANALISIS</span><p>{rancangan.analisis[0]?.nama ?? "-"}</p></div>
        </div>

        <div className="cw-hasil-duo">
          <div>
            <b>Rumusan masalah</b>
            <p>{rancangan.rumusan[0]}</p>
          </div>
          <div>
            <b>Nama resmi metodenya di bab metode</b>
            <p>{j.metodeResmi}</p>
          </div>
        </div>

        {hambat > 0 && (
          <p className="cw-hasil-hambat">
            Ada <b>{hambat}</b> hal pada rencanamu yang biasanya bikin pembimbing menyuruh ulang. Rinciannya
            beserta jalan keluarnya ada di dalam Cakrawala.
          </p>
        )}
      </div>

      <div className="cw-separuh">
        <p className="cw-separuh-judul">Kerangka berpikir untuk judul yang kamu pilih</p>

        {/* Bagannya dibuka utuh, tanpa gembok dan tanpa tirai. Inilah yang
            paling meyakinkan: bagan yang benar-benar jadi dari cerita yang
            baru saja diketik pengunjung.

            Pembungkus .al hanya untuk meminjam token warna bagannya; latar
            dan tinggi minimumnya dimatikan lewat .cw .al di berkas gaya. */}
        <div className="cw-separuh-jelas">
          <div className="al">
            {kerangka ? (
              <BaganKerangka kerangka={kerangka} />
            ) : alur ? (
              // Tiga tahap pertama saja. Bagan alur pikir utuh lima tahap dan
              // terlalu jangkung untuk etalase; tahap sisanya memang bagian
              // dari "ini baru separuhnya", bukan sesuatu yang dikarang.
              <BaganAlurPikir alur={{ ...alur, simpul: alur.simpul.slice(0, 3) }} />
            ) : null}
          </div>
        </div>

        {/* Yang di bawahnya memudar, bukan tertutup: kaburnya datang berangsur
            sampai habis di tepi bawah, sehingga terbaca sebagai halaman yang
            masih berlanjut. */}
        <div className="cw-separuh-kabur">
          <div className="al" aria-hidden="true">
            <h4 className="cw-separuh-sub">Visualisasi yang sesuai untuk metode ini</h4>
            <div className="al-visual">
              {visual.slice(0, 3).map((v) => (
                <div key={v.nama} className={`al-visual-kartu ${v.utama ? "utama" : ""}`}>
                  <ContohGrafik jenis={v.grafik} />
                  <div className="al-visual-teks">
                    <b>{v.nama}</b>
                    <p>{v.untuk}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="cw-lanjut">
            <b>Ini baru separuhnya</b>
            <p>
              {kerangka
                ? `Hipotesis bernomor, teknik sampling, uji statistik yang harus dipakai, dan ${visual.length} bentuk visualisasi berikut isi tiap sumbunya`
                : rancangan.model.length > 0
                  ? `Perbandingan ${rancangan.model.length} model ${rancangan.metodePola.toLowerCase()} beserta bentuk tabel temuannya, teknik sampling, cara menjaga keabsahan data, dan ${visual.length} bentuk visualisasi berikut isi tiap sumbunya`
                  : `Dua tahap berikutnya pada bagan ini, teknik sampling, cara menjaga keabsahan data, dan ${visual.length} bentuk visualisasi berikut isi tiap sumbunya`}{" "}
              ada di dalam Cakrawala, siap diubah dan dicetak.
            </p>
            <a className="cw-btn cw-btn-terang" href="#kode">Masuk dengan kode akses →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Keterangan langganan yang baru saja berakhir; null untuk pengunjung baru. */
type Habis = { nomor: string; nama: string | null; sampai: string } | null;

export default function PratinjauCakrawala({ habis = null }: { habis?: Habis }) {
  const [kode, setKode] = useState("");
  const [wa, setWa] = useState("");
  const [nama, setNama] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [tersalin, setTersalin] = useState(false);

  async function bukaKunci(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGalat("");
    const isi = kode.trim();
    if (!isi) {
      setGalat("Kode akses belum diisi.");
      return;
    }
    const nomor = wa.trim();
    if (!nomor) {
      setGalat("Nomor WhatsApp belum diisi. Nomor inilah yang menyimpan langgananmu.");
      return;
    }
    setSibuk(true);
    try {
      const response = await fetch("/api/cakrawala-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: isi, whatsapp: nomor, nama: nama.trim() }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Kode tidak dapat diperiksa.");
      }
      // Gerbangnya ada di server, jadi halaman diminta ulang seutuhnya:
      // cookie pembuka baru terbaca pada permintaan berikutnya, dan
      // muat ulang penuh tidak menyisakan sisa tampilan pratinjau.
      window.location.replace("/alat");
      return;
    } catch (reason: unknown) {
      setGalat(reason instanceof Error ? reason.message : "Kode tidak dapat diperiksa.");
    } finally {
      setSibuk(false);
    }
  }

  function salinKontak() {
    navigator.clipboard
      ?.writeText(KONTAK)
      .then(() => {
        setTersalin(true);
        window.setTimeout(() => setTersalin(false), 2200);
      })
      .catch(() => setTersalin(false));
  }

  return (
    <div className="cw">
      <header className="cw-hero">
        <Animasi nama="flying-book" className="cw-anim-buku" cadangan="📚" />
        <div className="cw-hero-in">
          <Link href="/" className="cw-back">← Portal Mahasiswa</Link>
          <span className="cw-gembok">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            AKSES TERBATAS
          </span>
          <h1>Cakrawala</h1>
          <p className="cw-lead">
            Bikin tugas akhir jadi lebih gampang. Nikmati kemudahan menyusun tugas akhir dengan sistem otomatis
            yang akurat, semudah membalikkan telapak tangan.
          </p>
          <ul className="cw-keluhan" aria-label="Yang biasanya bikin pusing">
            <li>Bingung cari judul?</li>
            <li>Males cari jurnal?</li>
            <li>Pusing urusan sitasi?</li>
            <li>Takut tulisanmu banyak salah?</li>
          </ul>
          <div className="cw-hero-aksi">
            <a className="cw-btn cw-btn-utama" href="#kode">Punya kode? Buka sekarang</a>
            <a className="cw-btn" href="#coba">Coba dulu, gratis</a>
            <a className="cw-btn" href="#beli">Lihat harga</a>
          </div>
          <div className="cw-sorot">
            {SOROTAN.map((item) => (
              <a className="cw-sorot-item" key={item.id} href={`#menu-${item.id}`}>
                <span className="cw-sorot-ic"><Ic d={item.ikon} /></span>
                <span className="cw-sorot-teks">
                  <b>{item.nama}</b>
                  <small>{item.singkat}</small>
                </span>
              </a>
            ))}
          </div>
        </div>
      </header>

      <main className="cw-body">
        <EtalaseCoba />

        <section className="cw-langkah" aria-label="Cara memakai Cakrawala">
          <div className="cw-langkah-kepala">
            <div>
              <p className="cw-eyebrow">NGGAK PERLU JAGO TEKNOLOGI</p>
              <h2>Cakrawala dibuat untuk kamu yang ingin cara simpel dan nggak ribet</h2>
              <p className="cw-langkah-sub">
                Mulai dari mencari ide penelitian, mencari jurnal, mengecek tulisan, sampai memeriksa daftar
                pustaka, semuanya bisa kamu lakukan dari satu tempat.
              </p>
            </div>
            <Animasi nama="digital" className="cw-anim-digital" cadangan="⚙" />
          </div>
          <ol>
            <li><b>1</b><span><strong>Tempel naskah sekali.</strong> Semua alat langsung memakainya, tanpa unggah ulang.</span></li>
            <li><b>2</b><span><strong>Pilih alatnya.</strong> Satu klik, tanpa pengaturan rumit.</span></li>
            <li><b>3</b><span><strong>Ambil hasilnya.</strong> Temuan tampil beserta alasannya, siap dicetak jadi laporan.</span></li>
          </ol>
          <p className="cw-langkah-tutup">
            Kamu yang menentukan penelitianmu. Cakrawala yang bantu mengerjakannya lebih praktis.
          </p>
        </section>

        <section id="etalase" className="cw-etalase" aria-label="Keunggulan tiap menu Cakrawala">
          <div className="cw-etalase-kepala">
            <p className="cw-eyebrow">ISI CAKRAWALA</p>
            <h2>Cakrawala bantu Anda mengurus semuanya dalam satu tempat</h2>
            <p className="cw-etalase-sub">Tinggal masukkan data, klik, dapat hasil.</p>
          </div>
          <div className="cw-grid">
            {SOROTAN.map((item) => (
              <article className="cw-kartu" id={`menu-${item.id}`} key={item.id}>
                <div className="cw-kartu-visual"><Mock jenis={item.mock} /></div>
                <div className="cw-kartu-isi">
                  <span className="cw-kartu-ic"><Ic d={item.ikon} /></span>
                  <p className="cw-kail">{item.kail}</p>
                  <h3>{item.nama}</h3>
                  <p className="cw-kartu-janji">{item.janji}</p>
                  <p className="cw-kartu-rinci">{item.rinci}</p>
                  <span className="cw-otomatis">⚡ {item.otomatis}</span>
                  <a className="cw-kartu-tombol" href="#kode">{item.tombol} →</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="cw-ringkas" aria-label="Ringkasan yang bisa dikerjakan Cakrawala">
          <p className="cw-eyebrow">SATU TEMPAT UNTUK MEMBANTU TUGAS AKHIRMU</p>
          <h2>Dari cari judul sampai mengecek tulisan</h2>
          <p className="cw-ringkas-sub">Cakrawala membantu kamu:</p>
          <ul className="cw-ringkas-daftar">
            {RINGKAS.map((butir) => (
              <li key={butir}>{butir}</li>
            ))}
          </ul>
          <p className="cw-ringkas-tutup">Nggak perlu pindah-pindah alat.</p>
        </section>

        <section id="kode" className="cw-kunci" aria-label="Buka dengan kode akses">
          <div className="cw-kunci-copy">
            {habis ? (
              <>
                <p className="cw-eyebrow">LANGGANANMU SUDAH HABIS</p>
                <h2>Selamat datang kembali{habis.nama ? `, ${habis.nama}` : ""}</h2>
                <p className="cw-habis">
                  Akses untuk nomor <b>{habis.nomor}</b> berakhir pada{" "}
                  <b>
                    {new Date(habis.sampai).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </b>
                  . Perpanjang dengan mengirim pesan ke {KONTAK} — nomormu sudah terdaftar, jadi
                  harinya langsung ditambahkan ke akun yang sama. Semua project dan catatanmu masih
                  utuh di sana.
                </p>
              </>
            ) : (
              <>
                <p className="cw-eyebrow">SUDAH PUNYA KODE AKSES?</p>
                <h2>Langsung masuk ke Cakrawala</h2>
                <p>
                  Masukkan kode akses dan nomor WhatsApp kamu. Langganannya disimpan di nomor itu,
                  jadi ganti HP atau buka di laptop tetap bisa masuk tanpa beli lagi.
                </p>
              </>
            )}
          </div>
          <form className="cw-kunci-form" onSubmit={bukaKunci}>
            <label htmlFor="cakrawala-code">Kode Akses</label>
            <input
              id="cakrawala-code"
              name="code"
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="CKRW-XXXX-XXXX"
              value={kode}
              onChange={(event) => setKode(event.target.value.toUpperCase())}
              disabled={sibuk}
            />

            <label htmlFor="cakrawala-wa">Nomor WhatsApp</label>
            <input
              id="cakrawala-wa"
              name="whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0812xxxxxxxx"
              value={wa}
              onChange={(event) => setWa(event.target.value)}
              disabled={sibuk}
            />

            <label htmlFor="cakrawala-nama">
              Nama <span className="cw-kunci-ops">(boleh dikosongkan)</span>
            </label>
            <div className="cw-kunci-baris">
              <input
                id="cakrawala-nama"
                name="nama"
                type="text"
                autoComplete="name"
                placeholder="Nama panggilan"
                value={nama}
                onChange={(event) => setNama(event.target.value)}
                disabled={sibuk}
              />
              <button type="submit" className="cw-btn cw-btn-utama" disabled={sibuk}>
                {sibuk ? "Memeriksa…" : "Buka Cakrawala"}
              </button>
            </div>
            {galat && <p className="cw-galat" role="alert">{galat}</p>}
            <p className="cw-kunci-catatan">
              Nomor WhatsApp didaftarkan <b>sekali</b> saat kode ditukar, lalu kode itu terkunci pada
              nomor tersebut. Tidak ada OTP dan tidak ada kata sandi — cukup kode dan nomor yang sama.
            </p>
            <p className="cw-kunci-catatan">
              Kalau langganan habis, cukup kirim pesan ke {KONTAK} untuk perpanjang. Nomornya sudah
              terdaftar, jadi kode barunya langsung menambah hari di akun yang sama — web dan
              aplikasi sekaligus.
            </p>
            <p className="cw-kunci-catatan">
              <b>Catatan:</b> jangan bagikan kode aksesmu kepada orang lain. Satu kode hanya dapat
              ditukar satu nomor, dan kode dapat dinonaktifkan sewaktu-waktu.
            </p>
          </form>
        </section>

        {/* Menggantikan ajakan "hubungi saya". Kode akses sekarang keluar
            sendiri sesudah pembayarannya masuk; menghubungi pengelola hanya
            perlu ketika ada yang benar-benar tidak beres. */}
        <BeliAkses
          onAkses={(kodeBaru, nomorBaru) => {
            setKode(kodeBaru);
            // Nomor yang dipakai memesan langsung dibawa ke kotak kode. Kode
            // terkunci pada nomor yang menukarkannya, jadi mengetiknya ulang
            // hanya menambah satu peluang salah ketik yang mengunci akses ke
            // nomor yang salah — dan itu tidak dapat dibatalkan sendiri.
            if (nomorBaru.trim()) setWa(nomorBaru.trim());
          }}
        />

        <section className="cw-cta" aria-label="Hubungi pengembang">
          <div>
            <p className="cw-eyebrow">ADA YANG TIDAK BERES?</p>
            <h2>Kirim pesan ke {KONTAK}</h2>
            <p>
              Sudah membayar tetapi kodenya belum keluar, atau kodenya ditolak? Sebutkan nomor pesanan Anda,
              dan pembayarannya kami telusuri.
            </p>
          </div>
          <button type="button" className="cw-btn cw-btn-terang" onClick={salinKontak}>
            {tersalin ? "Tersalin ✓" : `Salin ${KONTAK}`}
          </button>
        </section>

        <section className="cw-sangkal" aria-label="Batas kemampuan Cakrawala">
          <b>Cakrawala bukan pengganti Dosen.</b>
          <p>Cakrawala hanya membantu. Keputusan tetap di tanganmu.</p>
          <p>Gunakan hasil dari Cakrawala sebagai bahan pertimbangan, bukan sebagai jawaban akhir.</p>
          <p>Tetap periksa kembali informasi, jurnal, dan hasil tulisan sebelum digunakan dalam tugas akhir.</p>
          <p>Cakrawala membantu kamu bekerja lebih cepat. Kamu tetap yang menentukan hasil akhirnya.</p>
        </section>
      </main>

      <footer className="cw-kaki">
        <strong>SiPaling FISIP</strong>
        <span>Cakrawala · Concept by Superfal Dev · © {new Date().getFullYear()}</span>
        <Link href="/">Kembali ke portal →</Link>
      </footer>
    </div>
  );
}
