"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import Link from "next/link";
import { Ic, IKON, IKON_UANG } from "./ikon";
import { useProject } from "./use-project";
import { PanelBeranda, type Tab } from "./panel-beranda";
import { PanelStruktur, PanelInggris } from "./panel-naskah";
import { PanelJudul } from "./panel-judul";
import { PanelReferensi } from "./panel-referensi";
import { PanelKemiripan } from "./panel-kemiripan";
import { PanelSitasi, PanelRadar, PanelBahasa } from "./panel-periksa";
import { PanelUang } from "./panel-uang";
import { JENIS_LABEL } from "@/lib/project";
import { PenyediaCetak } from "./laporan";
import Animasi from "../animasi";

type Menu = { id: Tab; label: string; sub: string; ikon: string };

const MENU: Menu[] = [
  { id: "beranda", label: "Project & Laporan", sub: "Beranda, naskah, dan laporan", ikon: IKON.beranda },
  { id: "judul", label: "Perumus Judul & Metode", sub: "Sebelum judul ditetapkan", ikon: IKON.judul },
  { id: "referensi", label: "Cari Referensi", sub: "Jurnal ilmiah yang sahih", ikon: IKON.referensi },
  { id: "kemiripan", label: "Cek Kemiripan & Parafrase", sub: "Sitasi dan parafrase", ikon: IKON.kemiripan },
  { id: "struktur", label: "Struktur Naskah", sub: "Bab skripsi ke IMRaD", ikon: IKON.struktur },
  { id: "inggris", label: "Naskah Inggris", sub: "Padanan ragam jurnal", ikon: IKON.inggris },
  { id: "sitasi", label: "Verifikasi Sitasi", sub: "Cek referensi fiktif", ikon: IKON.sitasi },
  { id: "radar", label: "Radar Jurnal", sub: "Sebelum kirim naskah", ikon: IKON.radar },
  { id: "bahasa", label: "Periksa Bahasa", sub: "Ragam ilmiah Indonesia", ikon: IKON.bahasa },
];

// FREE VIP TOOLS — wadah alat bonus, dan memang dibuat untuk bertambah.
//
// SENGAJA dipisah dari alat di atas. Yang di atas bekerja pada naskah tugas
// akhir; yang di sini pada hidup pemiliknya di luar itu. Menaruh keduanya
// dalam satu daftar membuat orang menyangka catatan belanjanya ikut menjadi
// bagian dari project skripsinya.
//
// "Free" di sini berarti gratis BAGI pemegang kode, bukan gratis untuk umum —
// itulah yang dijelaskan baris keterangan di bawah judulnya, karena "Free VIP"
// berdiri sendiri memang terbaca bertentangan.
//
// Menambah alat baru cukup menambah satu baris di sini; sisanya mengikuti.
const MENU_BONUS: Menu[] = [
  { id: "uang", label: "Catatan Uang Bulanan", sub: "Pemasukan dan pengeluaran", ikon: IKON_UANG },
];

type Tema = "malam" | "terang";

// Mode baca disimpan di luar React: skrip kecil di page.tsx sudah
// memasangnya pada <html> sebelum halaman digambar, jadi React membacanya
// dari sana, bukan sebaliknya. useSyncExternalStore-lah cara membaca sumber
// di luar React tanpa membuat render bertingkat.
const PENDENGAR_TEMA = new Set<() => void>();

function langgananTema(beriTahu: () => void) {
  PENDENGAR_TEMA.add(beriTahu);
  return () => {
    PENDENGAR_TEMA.delete(beriTahu);
  };
}

function bacaTema(): Tema {
  return document.documentElement.dataset.cakrawala === "terang" ? "terang" : "malam";
}

// Di server tidak ada <html> yang bisa dibaca; bawaannya mode malam, sama
// seperti yang dipakai skrip di page.tsx bila tidak ada pilihan tersimpan.
function temaBawaan(): Tema {
  return "malam";
}

function simpanTema(berikut: Tema) {
  if (berikut === "terang") document.documentElement.dataset.cakrawala = "terang";
  else delete document.documentElement.dataset.cakrawala;
  try {
    window.localStorage.setItem("cakrawala-tema", berikut);
  } catch {
    // Penyimpanan diblokir (mode penyamaran): modenya tetap berganti, hanya
    // tidak diingat pada kunjungan berikutnya.
  }
  PENDENGAR_TEMA.forEach((beriTahu) => beriTahu());
}

/** Gembok yang kaitnya terangkat — kebalikan lencana terkunci di layar
 *  kunci. Kaitnya diberi kelas sendiri supaya CSS dapat menganimasikannya. */
function GembokTerbuka() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path className="al-kait" d="M8 10V7a4 4 0 0 1 8 0" />
    </svg>
  );
}

const IKON_BULAN = "M20 13.5A8.2 8.2 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5z";
const IKON_MATAHARI = "M12 6.5A5.5 5.5 0 1 0 17.5 12 5.5 5.5 0 0 0 12 6.5zM12 1.5v2M12 20.5v2M3.9 3.9l1.5 1.5M18.6 18.6l1.5 1.5M1.5 12h2M20.5 12h2M3.9 20.1l1.5-1.5M18.6 5.4l1.5-1.5";

/** Keterangan langganan yang ditampilkan di kepala halaman. */
type Masa = { nomor: string; sampai: string; aktif: boolean } | null;

export default function AlatApp() {
  const [tab, setTab] = useState<Tab>("beranda");
  const [masa, setMasa] = useState<Masa>(null);
  const tema = useSyncExternalStore(langgananTema, bacaTema, temaBawaan);
  const kerjaRef = useRef<HTMLDivElement | null>(null);
  const sisiRef = useRef<HTMLElement | null>(null);
  const p = useProject();
  const { aktif, jumlahKata } = p;

  // Sisa langganan dibaca sekali saat halaman terbuka.
  //
  // Ia tidak menjaga apa pun — gerbangnya ada di server dan sudah dilewati
  // sebelum layar ini digambar. Gunanya satu: memberi tahu pemiliknya kapan
  // masanya habis SEBELUM ia kehilangan akses di tengah mengerjakan bab,
  // karena itulah yang membuat orang memperpanjang tepat waktu.
  useEffect(() => {
    let hidup = true;
    fetch("/api/cakrawala-access", { cache: "no-store" })
      .then((jawab) => jawab.json())
      .then((isi: { langganan?: Masa }) => {
        if (hidup && isi.langganan) setMasa(isi.langganan);
      })
      .catch(() => {
        // Kepala halaman tanpa keterangan masa masih berguna sepenuhnya.
      });
    return () => {
      hidup = false;
    };
  }, []);

  // Di ponsel daftar alat adalah baris yang digulir menyamping. Alat yang
  // dipilih dari tempat lain (ubin "Lanjutkan ke", misalnya) bisa berada di
  // luar layar, sehingga tidak ada tanda alat mana yang sedang terbuka.
  useEffect(() => {
    if (window.innerWidth >= 920) return;
    sisiRef.current
      ?.querySelector<HTMLElement>(".al-nav.on")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [tab]);

  // Di ponsel daftar alat berada DI ATAS isinya. Tanpa ini, menekan alat
  // lain tidak mengubah apa pun yang terlihat: isinya berganti jauh di bawah
  // layar. Yang digulir adalah seluruh ruang kerja, bukan isinya saja, supaya
  // baris alat ikut menempel di tepi atas.
  function pilihTab(t: Tab) {
    setTab(t);
    if (typeof window !== "undefined" && window.innerWidth < 920) {
      kerjaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="al">
      <header className="al-top">
        <Animasi nama="flying-book" className="al-anim-buku" cadangan="📚" />
        <div className="al-top-in">
          <div className="al-top-baris">
            <Link href="/" className="al-back">← Portal Mahasiswa</Link>
            <button
              type="button"
              className="al-tema"
              onClick={() => simpanTema(tema === "malam" ? "terang" : "malam")}
              aria-pressed={tema === "terang"}
              title={tema === "malam" ? "Ganti ke mode terang" : "Ganti ke mode malam"}
            >
              <span className="al-tema-rel">
                <span className="al-tema-knop">
                  <Ic d={tema === "terang" ? IKON_MATAHARI : IKON_BULAN} />
                </span>
              </span>
              {tema === "malam" ? "Mode Terang" : "Mode Malam"}
            </button>
          </div>

          <div className="al-tanda">
            <span className="al-buka">
              <GembokTerbuka />
              AKSES TERBUKA
            </span>
            {masa?.aktif && <SisaLangganan masa={masa} />}
          </div>
          <h1>Cakrawala</h1>
          <p className="al-lead">Be Your Self, Kamu adalah Pencipta Masa Depanmu Sendiri</p>

          {aktif && (
            <div className="al-aktif">
              <span className="al-aktif-ic"><Ic d={IKON.dokumen} /></span>
              <span className="al-aktif-teks">
                <b>{aktif.nama}</b>
                <span>
                  {JENIS_LABEL[aktif.jenis]} · {aktif.bab.length} bab ·{" "}
                  {jumlahKata.toLocaleString("id-ID")} kata
                </span>
              </span>
              <button type="button" className="al-aktif-ganti" onClick={() => pilihTab("beranda")}>
                Ganti project
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="al-body" ref={kerjaRef}>
        <nav className="al-side" aria-label="Pilih alat" ref={sisiRef}>
          {/* Jumlahnya dihitung, tidak diketik. "Sembilan alat" yang ditulis
              tangan akan berbohong pada hari alat kesepuluh ditambahkan. */}
          <p className="al-side-judul">{MENU.length} alat naskah</p>
          {MENU.map((m, urutan) => (
            <button
              key={m.id}
              type="button"
              className={`al-nav ${tab === m.id ? "on" : ""}`}
              aria-current={tab === m.id ? "page" : undefined}
              onClick={() => pilihTab(m.id)}
              style={{ "--urutan": urutan } as CSSProperties}
            >
              <span className="al-nav-ic"><Ic d={m.ikon} /></span>
              <span className="al-nav-teks">
                <b>{m.label}</b>
                <small className="al-nav-sub">{m.sub}</small>
              </span>
            </button>
          ))}

          {/* Pemisah yang terlihat di ponsel, tempat judul kelompok
              disembunyikan supaya baris alatnya tetap dapat digulir. */}
          <span className="al-side-pisah" aria-hidden="true" />
          <p className="al-side-judul al-side-judul-lain">
            Free VIP Tools
            <small>Bonus untuk pemegang kode</small>
          </p>
          {MENU_BONUS.map((m, urutan) => (
            <button
              key={m.id}
              type="button"
              className={`al-nav al-nav-lain ${tab === m.id ? "on" : ""}`}
              aria-current={tab === m.id ? "page" : undefined}
              onClick={() => pilihTab(m.id)}
              style={{ "--urutan": MENU.length + urutan } as CSSProperties}
            >
              <span className="al-nav-ic"><Ic d={m.ikon} /></span>
              <span className="al-nav-teks">
                <b>{m.label}</b>
                <small className="al-nav-sub">{m.sub}</small>
              </span>
            </button>
          ))}
        </nav>

        <main>
          {p.galat && <p className="al-galat" role="alert">{p.galat}</p>}

          {/* Laporan cetak baru disusun saat tombol Cetak ditekan. Penyedianya
              berada di luar pembungkus berkunci supaya keadaan "sedang
              mencetak" tidak ikut disetel ulang tiap ganti alat. */}
          <PenyediaCetak>
          {/* Kunci pada pembungkus: tiap alat masuk sebagai panel baru,
              sehingga gerak masuknya terulang di tiap perpindahan. */}
          <div className="al-panel" key={tab}>
            {tab === "beranda" && (
              <PanelBeranda
                daftar={p.daftar}
                aktif={p.aktif}
                siap={p.siap}
                pilih={p.pilih}
                buat={p.buat}
                hapus={p.hapus}
                gantiNaskah={p.gantiNaskah}
                muatDaftar={p.muatDaftar}
                keAlat={pilihTab}
              />
            )}
            {tab === "judul" && <PanelJudul project={p.aktif} ubah={p.ubah} keAlat={pilihTab} />}
            {tab === "referensi" && <PanelReferensi project={p.aktif} ubah={p.ubah} />}
            {tab === "kemiripan" && <PanelKemiripan project={p.aktif} ubah={p.ubah} />}
            {tab === "struktur" && <PanelStruktur project={p.aktif} />}
            {tab === "inggris" && <PanelInggris project={p.aktif} ubah={p.ubah} />}
            {tab === "sitasi" && <PanelSitasi project={p.aktif} ubah={p.ubah} />}
            {tab === "radar" && <PanelRadar project={p.aktif} ubah={p.ubah} />}
            {tab === "bahasa" && <PanelBahasa project={p.aktif} />}
            {tab === "uang" && <PanelUang />}
          </div>
          </PenyediaCetak>

          <section className="al-sangkal">
            <b>Cakrawala bukan pengganti Dosen.</b> Cakrawala hanya membantu, keputusan tetap di tanganmu. Gunakan
            hasil dari Cakrawala sebagai bahan pertimbangan, bukan sebagai jawaban akhir. Tetap periksa kembali
            informasi, jurnal, dan hasil tulisan sebelum digunakan dalam tugas akhir. Cakrawala membantu kamu
            bekerja lebih cepat; kamu tetap yang menentukan hasil akhirnya.
          </section>
        </main>
      </div>

      <footer className="al-kaki">
        <strong>SiPaling FISIP</strong>
        <span>Cakrawala · Concept by Superfal Dev</span>
        <Link href="/">Kembali ke portal →</Link>
      </footer>
    </div>
  );
}

/**
 * Sisa langganan, ditulis dalam hari.
 *
 * Dibulatkan ke ATAS: sisa dua belas jam adalah "1 hari lagi", bukan nol.
 * Angka nol pada layar orang yang aksesnya masih hidup membuatnya menyangka
 * sudah terkunci dan berhenti bekerja hari itu juga.
 */
function sisaHari(sampai: string) {
  const selisih = new Date(sampai).getTime() - Date.now();
  return Math.max(1, Math.ceil(selisih / (24 * 60 * 60_000)));
}

function SisaLangganan({ masa }: { masa: NonNullable<Masa> }) {
  const hari = sisaHari(masa.sampai);
  const dekat = hari <= 7;
  return (
    <span className={`al-masa${dekat ? " al-masa-dekat" : ""}`} title={`Nomor ${masa.nomor}`}>
      {dekat ? "⚠ " : ""}
      Langganan {hari === 1 ? "tinggal 1 hari" : `${hari} hari lagi`}
      {dekat && <small>Perpanjang lewat WhatsApp, nomormu sudah terdaftar</small>}
    </span>
  );
}
