"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { JENIS_LABEL, type Project } from "@/lib/project";

/**
 * LAPORAN CETAK CAKRAWALA
 *
 * Halaman ini tidak dapat sekadar dicetak apa adanya. Berkas gaya global
 * memuat aturan cetak untuk surat dan transkrip yang menyembunyikan seluruh
 * isi body lewat visibility, lalu menampilkan kembali hanya .print-area.
 * Cakrawala berada di luar area itu, sehingga hasil cetaknya kosong.
 *
 * Karena itu laporan disusun sebagai dokumen tersendiri, dikirim ke body
 * lewat portal supaya berada di luar .al. Saat dicetak, antarmuka layar
 * disembunyikan seluruhnya dan hanya dokumen ini yang tampil, sehingga tidak
 * ada halaman kosong dari sisa tinggi antarmuka.
 *
 * Rancangannya bertumpu pada garis dan tebal huruf, bukan pada blok warna.
 * Peramban mematikan pencetakan latar belakang secara bawaan; laporan yang
 * mengandalkan warna blok akan tampak rusak bagi kebanyakan pengguna.
 *
 * LAPORAN HANYA DISUSUN SAAT AKAN DICETAK. Sebelumnya ia selalu ada di
 * halaman, hanya disembunyikan dengan display:none. Pada naskah satu bab itu
 * tidak terasa. Pada skripsi utuh, Periksa Bahasa dapat menghasilkan ribuan
 * temuan, dan tiap temuan menjadi beberapa elemen — puluhan ribu elemen
 * tersembunyi yang tidak pernah dilihat siapa pun, tetapi tetap harus disusun,
 * ditata, dan disimpan peramban. Di situlah halaman mulai terasa berat dan
 * ponsel kehabisan memori. Sekarang tidak ada satu pun elemen laporan yang
 * dibuat sampai tombol Cetak ditekan.
 */

type IsiKonteks = { cetak: boolean; mulai: () => void };

const KonteksCetak = createContext<IsiKonteks>({ cetak: false, mulai: () => {} });

/** Dipasang sekali di sekeliling seluruh alat. Menyimpan satu keadaan:
 *  apakah laporan sedang dibutuhkan. */
export function PenyediaCetak({ children }: { children: ReactNode }) {
  const [cetak, setCetak] = useState(false);
  const mulai = useCallback(() => setCetak(true), []);

  useEffect(() => {
    if (!cetak) return;

    let sudah = false;
    let jam = 0;
    const tutup = () => {
      if (sudah) return;
      sudah = true;
      setCetak(false);
    };

    // Laporan dibongkar setelah jendela cetak ditutup. Peramban lama yang
    // tidak mengenal afterprint dilayani jam cadangan; menyetel jam pada
    // peramban yang mengenalnya justru berbahaya, karena laporan bisa hilang
    // selagi pratinjau cetaknya masih terbuka.
    const adaAfterPrint = "onafterprint" in window;
    if (adaAfterPrint) window.addEventListener("afterprint", tutup);

    // Dua bingkai: yang pertama menempelkan laporan ke halaman, yang kedua
    // memastikan peramban sempat menatanya sebelum jendela cetak dibuka.
    const bingkai = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (sudah) return;
        try {
          window.print();
        } catch {
          // Sebagian peramban dalam mode tersemat menolak membuka jendela
          // cetak. Laporannya tetap dibongkar supaya halaman tidak tertinggal
          // dalam keadaan "sedang mencetak".
          tutup();
          return;
        }
        if (!adaAfterPrint) jam = window.setTimeout(tutup, 1500);
      });
    });

    return () => {
      sudah = true;
      if (adaAfterPrint) window.removeEventListener("afterprint", tutup);
      cancelAnimationFrame(bingkai);
      if (jam) window.clearTimeout(jam);
    };
  }, [cetak]);

  return <KonteksCetak.Provider value={{ cetak, mulai }}>{children}</KonteksCetak.Provider>;
}

export type Angka = { nilai: string; label: string; nada?: "ok" | "warn" | "bad" };

export function LaporanCetak({
  judul, project, angka, children,
}: {
  judul: string;
  project: Project | null;
  angka?: Angka[];
  children: ReactNode;
}) {
  const { cetak } = useContext(KonteksCetak);

  if (!cetak || typeof document === "undefined") return null;

  const tanggal = new Date().toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
  const jam = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return createPortal(
    <div className="al-lap" role="document">
      <header className="lap-kop">
        <div>
          <p className="lap-merek">ONE FOR ALL · SIPALING FISIP</p>
          <h1>Cakrawala</h1>
        </div>
        <div className="lap-kop-kanan">
          <b>{judul}</b>
          <span>{tanggal} · {jam} WIB</span>
        </div>
      </header>

      {project && (
        <div className="lap-meta">
          <b>{project.nama}</b>
          <span>
            {JENIS_LABEL[project.jenis]}
            {project.prodi ? ` · ${project.prodi}` : ""}
            {project.bab.length > 0
              ? ` · ${project.bab.length} bab · ${project.bab
                  .reduce((n, x) => n + x.jumlahKata, 0)
                  .toLocaleString("id-ID")} kata`
              : ""}
          </span>
        </div>
      )}

      {angka && angka.length > 0 && (
        <div className="lap-angka">
          {angka.map((a) => (
            <div key={a.label} className={a.nada ?? ""}>
              <b>{a.nilai}</b>
              <span>{a.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="lap-isi">{children}</div>

      <div className="lap-sangkal">
        <b>Cakrawala alat bantu, bukan penentu.</b> Laporan ini gambaran awal untuk diperiksa sendiri, bukan patokan
        yang dapat dijadikan pegangan, dan bukan penilaian atas mutu karya. Keputusan akademik tetap ada pada dosen
        pembimbing dan penguji.
      </div>

      <footer className="lap-kaki">
        <span>Cakrawala · sipalingfisip.web.id</span>
        <span className="lap-kaki-dev">Superfal Dev</span>
      </footer>
    </div>,
    document.body,
  );
}

/** Judul bagian di dalam laporan. */
export function Bagian({ children }: { children: ReactNode }) {
  return <h2 className="lap-bagian">{children}</h2>;
}

/** Satu butir temuan, tidak dipenggal antar halaman. */
export function Butir({
  nada = "abu", tanda, kanan, kutipan, children,
}: {
  nada?: "ok" | "warn" | "bad" | "abu";
  tanda?: string;
  kanan?: string;
  kutipan?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`lap-butir ${nada}`}>
      {(tanda || kanan) && (
        <p className="lap-butir-atas">
          {tanda && <span className="lap-tanda">{tanda}</span>}
          {kanan && <span className="lap-kanan">{kanan}</span>}
        </p>
      )}
      {kutipan && <p className="lap-kutip">{kutipan}</p>}
      {children}
    </div>
  );
}

/** Catatan penutup, dibedakan dari isi laporan. */
export function Catatan({ children }: { children: ReactNode }) {
  return <div className="lap-catatan">{children}</div>;
}

/** Tombol cetak, sekaligus penjelasan singkat apa yang akan tercetak. */
export function TombolCetak({ apa }: { apa: string }) {
  const { cetak, mulai } = useContext(KonteksCetak);
  return (
    <div className="al-cetak-baris">
      <button type="button" className="al-print" onClick={mulai} disabled={cetak}>
        {cetak ? "Menyiapkan laporan…" : "Cetak atau simpan sebagai PDF"}
      </button>
      <small>{apa}</small>
    </div>
  );
}
