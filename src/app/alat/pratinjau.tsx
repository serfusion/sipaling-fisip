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

const KONTAK = "@superfaldev";

type Sorot = {
  id: string;
  ikon: string;
  nama: string;
  janji: string;
  rinci: string;
  otomatis: string;
  mock: string;
};

// Deskripsi mengikuti apa yang benar-benar dikerjakan tiap panel di dalam,
// bukan janji yang lebih besar dari alatnya.
const SOROTAN: Sorot[] = [
  {
    id: "judul",
    ikon: IKON.judul,
    nama: "Perumus Judul dan Metode",
    janji: "Dari “ingin meneliti apa” menjadi judul yang siap diajukan",
    rinci:
      "Katakan topik, lokasi, dan siapa yang diteliti. Cakrawala menyusun beberapa alternatif judul sekaligus menunjukkan metode mana yang benar-benar sanggup menjawabnya.",
    otomatis: "Judul, rumusan masalah, dan usulan metode tersusun sendiri",
    mock: "judul",
  },
  {
    id: "referensi",
    ikon: IKON.referensi,
    nama: "Cari Referensi",
    janji: "Jurnal ilmiah yang sahih, bukan hasil pencarian acak",
    rinci:
      "Tuliskan topik Anda, lalu katalog OpenAlex disisir langsung. Inti tiap penelitian ditampilkan ringkas supaya Anda tahu mana yang layak dibaca utuh.",
    otomatis: "Pencarian, penyaringan, dan ringkasan berjalan sekali klik",
    mock: "referensi",
  },
  {
    id: "kemiripan",
    ikon: IKON.kemiripan,
    nama: "Cek Kemiripan dan Parafrase",
    janji: "Bereskan sendiri sebelum jatah unggah Turnitin terpakai",
    rinci:
      "Kalimat yang berisiko dianggap mirip ditandai beserta alasannya, lengkap dengan contoh parafrase yang tetap menjaga makna aslinya.",
    otomatis: "Penandaan kalimat dan saran perbaikan muncul otomatis",
    mock: "kemiripan",
  },
  {
    id: "struktur",
    ikon: IKON.struktur,
    nama: "Struktur Naskah",
    janji: "BAB I sampai V berubah menjadi kerangka artikel jurnal",
    rinci:
      "Tiap bab dipetakan ke bagian IMRaD beserta target jumlah katanya, sehingga terlihat bagian mana yang harus dipangkas dan mana yang masih kurang.",
    otomatis: "Pemetaan bab dan hitungan kata dikerjakan sendiri",
    mock: "struktur",
  },
  {
    id: "inggris",
    ikon: IKON.inggris,
    nama: "Naskah Inggris",
    janji: "Padanan ragam jurnal, bukan terjemahan kata per kata",
    rinci:
      "Rumusan baku skripsi Anda dialihkan ke padanan yang lazim dipakai jurnal berbahasa Inggris, lalu ragam hasilnya diperiksa ulang.",
    otomatis: "Alih bahasa dan pemeriksaan ragam sekali jalan",
    mock: "inggris",
  },
  {
    id: "sitasi",
    ikon: IKON.sitasi,
    nama: "Verifikasi Sitasi",
    janji: "Pastikan tiap referensi benar-benar ada",
    rinci:
      "Tempel daftar pustaka Anda. Tiap entri dicari datanya ke Crossref dan OpenAlex, lalu ditandai: nyata, meragukan, atau tidak ditemukan.",
    otomatis: "Seluruh daftar pustaka diperiksa sekaligus",
    mock: "sitasi",
  },
  {
    id: "radar",
    ikon: IKON.radar,
    nama: "Radar Jurnal",
    janji: "Periksa jurnalnya dulu, baru kirim naskah",
    rinci:
      "Masukkan ISSN. DOAJ, Crossref, dan OpenAlex diperiksa bersamaan, lalu tanda bahayanya ditampilkan beserta bukti angkanya.",
    otomatis: "Tiga sumber diperiksa serentak dalam hitungan detik",
    mock: "radar",
  },
  {
    id: "bahasa",
    ikon: IKON.bahasa,
    nama: "Periksa Bahasa",
    janji: "Ragam ilmiah Indonesia menurut PUEBI dan KBBI",
    rinci:
      "Ejaan, kata tidak baku, tanda baca, dan kalimat yang berputar-putar ditandai satu per satu beserta usul perbaikannya.",
    otomatis: "Temuan langsung muncul sambil naskah ditempel",
    mock: "bahasa",
  },
  {
    id: "beranda",
    ikon: IKON.dokumen,
    nama: "Project & Laporan",
    janji: "Tempel naskah sekali, dipakai seluruh alat",
    rinci:
      "Naskah tersimpan di perangkat Anda sendiri, bukan di server kami. Hasil tiap alat dapat dicetak menjadi laporan rapi untuk dibawa ke bimbingan.",
    otomatis: "Naskah dan hasil tersimpan sendiri, siap dicetak",
    mock: "beranda",
  },
];

const ANGKA = [
  { nilai: "9", label: "alat dalam satu tempat" },
  { nilai: "3", label: "katalog ilmiah dunia disisir langsung" },
  { nilai: "0", label: "naskah yang dititipkan ke server" },
  { nilai: "1×", label: "tempel naskah untuk semua alat" },
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
            Sembilan alat yang mengerjakan bagian paling melelahkan dari menulis tugas akhir — merumuskan judul,
            mencari referensi, memeriksa kemiripan, sampai memastikan jurnal tujuan bukan jurnal abal-abal.
            Semuanya otomatis, semudah membalikkan telapak tangan.
          </p>
          <div className="cw-hero-aksi">
            <a className="cw-btn cw-btn-utama" href="#kode">Punya kode? Buka sekarang</a>
            <a className="cw-btn" href="#etalase">Lihat isinya dulu</a>
          </div>
          <div className="cw-angka">
            {ANGKA.map((item) => (
              <div key={item.label}>
                <b>{item.nilai}</b>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="cw-body">
        <section className="cw-langkah" aria-label="Cara memakai Cakrawala">
          <div className="cw-langkah-kepala">
            <p className="cw-eyebrow">SEMUDAH MEMBALIKKAN TELAPAK TANGAN</p>
            <h2>Tiga langkah, sisanya dikerjakan sendiri</h2>
          </div>
          <ol>
            <li><b>1</b><span><strong>Tempel naskah sekali.</strong> Seluruh alat langsung memakainya, tidak perlu unggah berulang.</span></li>
            <li><b>2</b><span><strong>Pilih alatnya.</strong> Satu klik, tanpa pengaturan yang membingungkan.</span></li>
            <li><b>3</b><span><strong>Ambil hasilnya.</strong> Temuan tampil beserta alasannya, dan siap dicetak jadi laporan.</span></li>
          </ol>
        </section>

        <section id="etalase" className="cw-etalase" aria-label="Keunggulan tiap menu Cakrawala">
          <div className="cw-etalase-kepala">
            <p className="cw-eyebrow">ISI CAKRAWALA</p>
            <h2>Setiap menu, dan apa yang dikerjakannya untuk Anda</h2>
            <p className="cw-etalase-sub">
              Gambaran tampilan di bawah ini diambil dari bentuk asli tiap panel. Yang terkunci hanyalah pintunya —
              alatnya sendiri sudah jadi dan berjalan.
            </p>
          </div>
          <div className="cw-grid">
            {SOROTAN.map((item) => (
              <article className="cw-kartu" key={item.id}>
                <div className="cw-kartu-visual"><Mock jenis={item.mock} /></div>
                <div className="cw-kartu-isi">
                  <span className="cw-kartu-ic"><Ic d={item.ikon} /></span>
                  <h3>{item.nama}</h3>
                  <p className="cw-kartu-janji">{item.janji}</p>
                  <p className="cw-kartu-rinci">{item.rinci}</p>
                  <span className="cw-otomatis">⚡ {item.otomatis}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="kode" className="cw-kunci" aria-label="Buka dengan kode akses">
          <div className="cw-kunci-copy">
            <p className="cw-eyebrow">PINTU MASUK</p>
            <h2>Punya kode akses?</h2>
            <p>
              Masukkan kode yang Anda terima. Sekali dibuka, perangkat ini diingat selama 30 hari, jadi Anda tidak
              perlu mengetiknya setiap kali datang.
            </p>
          </div>
          <form className="cw-kunci-form" onSubmit={bukaKunci}>
            <label htmlFor="cakrawala-code">Kode Akses Cakrawala</label>
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
              Kode bersifat pribadi. Bila kode Anda ditolak padahal baru diterima, hubungi pemberi kodenya —
              kode dapat dinonaktifkan sewaktu-waktu.
            </p>
          </form>
        </section>

        <section className="cw-cta" aria-label="Hubungi pengembang">
          <div>
            <p className="cw-eyebrow">BELUM PUNYA KODE?</p>
            <h2>Wanna? Contact Me {KONTAK}</h2>
            <p>
              Cakrawala dibuka terbatas supaya setiap penggunanya benar-benar terbantu. Kirim pesan, sebutkan
              kebutuhan Anda, dan kode akses akan diberikan.
            </p>
          </div>
          <button type="button" className="cw-btn cw-btn-terang" onClick={salinKontak}>
            {tersalin ? "Tersalin ✓" : `Salin ${KONTAK}`}
          </button>
        </section>

        <p className="cw-sangkal">
          <b>Cakrawala alat bantu, bukan penentu.</b> Semua yang keluar di dalamnya adalah gambaran awal untuk
          diperiksa sendiri. Alat ini tidak menilai, tidak meluluskan, dan tidak menggantikan pembacaan dosen
          pembimbing maupun penguji.
        </p>
      </main>

      <footer className="cw-kaki">
        <strong>SiPaling FISIP</strong>
        <span>Cakrawala · Concept Superfal Dev · © {new Date().getFullYear()}</span>
        <Link href="/">Kembali ke portal →</Link>
      </footer>
    </div>
  );
}
