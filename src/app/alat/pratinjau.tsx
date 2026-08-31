"use client";

// ============================================================
// PRATINJAU CAKRAWALA — halaman yang tampil selama menu terkunci
//
// Yang dilihat pengunjung di sini hanyalah etalase: nama tiap alat, apa yang
// dikerjakannya, dan gambaran tampilannya. Isi Cakrawala yang sebenarnya
// TIDAK ikut dikirim ke peramban — gerbangnya ada di server (page.tsx),
// sehingga halaman ini tidak dapat dilewati lewat alat pengembang.
// ============================================================

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Ic, IKON } from "./ikon";
import Animasi from "../animasi";
import { BaganAlurPikir, BaganKerangka, ContohGrafik } from "./grafik";
import { susunAlurPikir, susunKerangka, type AlurPikir, type Kerangka } from "@/lib/kerangka";
import { JENIS_LABEL, rancang, type Rancangan } from "@/lib/metodologi";
import { usulkanVisual, type Usul } from "@/lib/visual";
import { CONTOH_CERITA, MINIMAL_KATA, hitungKataCerita, tafsirkan, type Bacaan } from "@/lib/tafsir-cerita";

const KONTAK = "@superfaldev";

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

   Yang dibuka: metodenya, paradigmanya, satu usulan judul, dan rumusan
   masalahnya. Yang diburamkan: kerangka berpikir, visualisasi yang sesuai,
   dan daftar ketidakcocokan judul-metode.

   Buram di sini penanda, bukan gembok. Gembok yang sebenarnya ada di server
   (page.tsx) dan menjaga kesembilan alatnya; yang diburamkan di halaman ini
   hanyalah bagan yang disusun dari cerita pengunjung itu sendiri.
   ========================================================================== */

type HasilCoba = {
  bacaan: Bacaan;
  rancangan: Rancangan;
  kerangka: Kerangka | null;
  alur: AlurPikir | null;
  visual: Usul[];
};

function EtalaseCoba() {
  const [cerita, setCerita] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<HasilCoba | null>(null);

  const kata = hitungKataCerita(cerita);
  const cukup = kata >= MINIMAL_KATA;

  function carikan() {
    if (!cukup || sibuk) return;
    setSibuk(true);
    setHasil(null);
    // Perhitungannya seketika. Jeda pendek ini semata supaya perpindahan dari
    // "menekan tombol" ke "hasil muncul" terbaca sebagai satu kejadian.
    window.setTimeout(() => {
      const bacaan = tafsirkan(cerita);
      const rancangan = rancang(bacaan.masukan);
      const pakaiVariabel = bacaan.masukan.tujuan === "pengaruh" || bacaan.masukan.tujuan === "hubungan";
      setHasil({
        bacaan,
        rancangan,
        kerangka: pakaiVariabel ? susunKerangka(bacaan.masukan) : null,
        alur: pakaiVariabel ? null : susunAlurPikir(bacaan.masukan, rancangan.jenis, rancangan.teori),
        visual: usulkanVisual(rancangan.jenis),
      });
      setSibuk(false);
    }, 700);
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
          <button type="button" className="cw-link" onClick={() => setCerita(CONTOH_CERITA)}>
            Isi dengan contoh
          </button>
          <button type="button" className="cw-btn cw-btn-utama" onClick={carikan} disabled={!cukup || sibuk}>
            {sibuk ? "Membaca ceritamu…" : "Carikan metodenya"}
          </button>
        </div>
        <p className="cw-coba-aman">
          Ceritamu dibaca di perangkat ini juga dan <b>tidak dikirim ke server mana pun</b>.
        </p>
      </div>

      {hasil && <HasilCobaTampil hasil={hasil} />}
    </section>
  );
}

function HasilCobaTampil({ hasil }: { hasil: HasilCoba }) {
  const { bacaan, rancangan, kerangka, alur, visual } = hasil;
  const hambat = rancangan.peringatan.filter((p) => p.berat === "hambat").length;

  return (
    <div className="cw-hasil">
      {!bacaan.cukup && (
        <p className="cw-hasil-tipis">
          Ceritanya masih terlalu ringkas untuk dibaca dengan yakin. Yang di bawah ini dugaan sementara.
          Tambahkan siapa yang mau kamu teliti dan di mana, lalu coba lagi.
        </p>
      )}

      <div className="cw-hasil-buka">
        <span className="cw-hasil-tanda">{bacaan.cukup ? "METODE YANG COCOK" : "DUGAAN SEMENTARA"}</span>
        <h3>{JENIS_LABEL[rancangan.jenis]}</h3>
        <p className="cw-hasil-baca">{bacaan.ringkas}</p>
        <p className="cw-hasil-paradigma">{rancangan.paradigma}</p>

        <div className="cw-hasil-duo">
          <div>
            <b>Usulan judul</b>
            <p>{rancangan.judul[0]}</p>
          </div>
          <div>
            <b>Rumusan masalah</b>
            <p>{rancangan.rumusan[0]}</p>
          </div>
        </div>

        {hambat > 0 && (
          <p className="cw-hasil-hambat">
            ⚠ Ada <b>{hambat}</b> hal pada rencanamu yang biasanya bikin pembimbing menyuruh ulang. Rinciannya
            beserta jalan keluarnya ada di dalam Cakrawala.
          </p>
        )}
      </div>

      <div className="cw-kunci-lapis">
        <div className="cw-buram" aria-hidden="true">
          {/* Pembungkus .al hanya untuk meminjam token warna bagannya; latar
              dan tinggi minimumnya dimatikan lewat .cw .al di berkas gaya. */}
          <div className="al cw-buram-isi">
            <div>
              <h4>Kerangka berpikir</h4>
              {kerangka ? <BaganKerangka kerangka={kerangka} /> : alur ? <BaganAlurPikir alur={alur} /> : null}
            </div>
            <div>
              <h4>Visualisasi yang sesuai</h4>
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
          </div>
        </div>

        <div className="cw-kunci-tirai">
          <span className="cw-gembok cw-gembok-kecil">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            TERKUNCI
          </span>
          <b>Kerangka berpikirmu sudah jadi, tinggal dilihat</b>
          <p>
            Bagan kerangka berpikir dan {visual.length} bentuk visualisasi yang sesuai untuk metode ini sudah
            tersusun dari ceritamu barusan, lengkap dengan apa yang diletakkan di tiap sumbunya. Buka dengan kode
            akses untuk melihatnya, mengubahnya, dan mencetaknya.
          </p>
          <a className="cw-btn cw-btn-terang" href="#kode">Buka dengan kode akses →</a>
        </div>
      </div>
    </div>
  );
}

export default function PratinjauCakrawala() {
  const [kode, setKode] = useState("");
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
    setSibuk(true);
    try {
      const response = await fetch("/api/cakrawala-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: isi }),
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
            <p className="cw-eyebrow">SUDAH PUNYA KODE AKSES?</p>
            <h2>Langsung masuk ke Cakrawala</h2>
            <p>Masukkan kode akses yang kamu punya untuk mulai menggunakan Cakrawala.</p>
          </div>
          <form className="cw-kunci-form" onSubmit={bukaKunci}>
            <label htmlFor="cakrawala-code">Kode Akses</label>
            <div className="cw-kunci-baris">
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
              <button type="submit" className="cw-btn cw-btn-utama" disabled={sibuk}>
                {sibuk ? "Memeriksa…" : "Buka Cakrawala"}
              </button>
            </div>
            {galat && <p className="cw-galat" role="alert">{galat}</p>}
            <p className="cw-kunci-catatan">
              Setelah kode berhasil digunakan, akses akan tersimpan di perangkat selama 30 hari.
            </p>
            <p className="cw-kunci-catatan">
              <b>Catatan:</b> jangan bagikan kode aksesmu kepada orang lain. Kode dapat dinonaktifkan
              sewaktu-waktu.
            </p>
          </form>
        </section>

        <section className="cw-cta" aria-label="Hubungi pengembang">
          <div>
            <p className="cw-eyebrow">BELUM PUNYA KODE AKSES?</p>
            <h2>Mau coba Cakrawala?</h2>
            <p>
              Cakrawala tersedia dengan akses terbatas. Hubungi kami untuk mendapatkan informasi mengenai akses
              dan paket yang tersedia.
            </p>
          </div>
          <button type="button" className="cw-btn cw-btn-terang" onClick={salinKontak}>
            {tersalin ? "Tersalin ✓" : `${KONTAK} — Hubungi Saya`}
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
