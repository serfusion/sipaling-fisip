"use client";

import { useEffect, useState, type ReactNode } from "react";
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
 */

export type Angka = { nilai: string; label: string; nada?: "ok" | "warn" | "bad" };

export function LaporanCetak({
  judul, project, angka, children,
}: {
  judul: string;
  project: Project | null;
  angka?: Angka[];
  children: ReactNode;
}) {
  const [siap, setSiap] = useState(false);

  // Portal hanya boleh dipasang setelah komponen menempel di peramban:
  // document tidak ada saat halaman disusun di server.
  useEffect(() => {
    const jam = window.setTimeout(() => setSiap(true), 0);
    return () => window.clearTimeout(jam);
  }, []);

  if (!siap) return null;

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
  return (
    <div className="al-cetak-baris">
      <button type="button" className="al-print" onClick={() => window.print()}>
        Cetak atau simpan sebagai PDF
      </button>
      <small>{apa}</small>
    </div>
  );
}
