"use client";

import { useState } from "react";
import Link from "next/link";
import { Ic, IKON } from "./ikon";
import { useProject } from "./use-project";
import { PanelBeranda, type Tab } from "./panel-beranda";
import { PanelStruktur, PanelInggris } from "./panel-naskah";
import { PanelJudul } from "./panel-judul";
import { PanelReferensi } from "./panel-referensi";
import { PanelKemiripan } from "./panel-kemiripan";
import { PanelSitasi, PanelRadar, PanelBahasa } from "./panel-periksa";
import { JENIS_LABEL } from "@/lib/project";

const MENU: Array<{ id: Tab; label: string; sub: string; ikon: string }> = [
  { id: "beranda", label: "Beranda", sub: "Project dan naskah", ikon: IKON.beranda },
  { id: "judul", label: "Judul dan Metode", sub: "Sebelum judul ditetapkan", ikon: IKON.judul },
  { id: "referensi", label: "Cari Referensi", sub: "Jurnal ilmiah yang sahih", ikon: IKON.referensi },
  { id: "kemiripan", label: "Cek Kemiripan", sub: "Sitasi dan parafrase", ikon: IKON.kemiripan },
  { id: "struktur", label: "Struktur Naskah", sub: "Bab skripsi ke IMRaD", ikon: IKON.struktur },
  { id: "inggris", label: "Naskah Inggris", sub: "Padanan ragam jurnal", ikon: IKON.inggris },
  { id: "sitasi", label: "Verifikasi Sitasi", sub: "Cek referensi fiktif", ikon: IKON.sitasi },
  { id: "radar", label: "Radar Jurnal", sub: "Sebelum kirim naskah", ikon: IKON.radar },
  { id: "bahasa", label: "Periksa Bahasa", sub: "Ragam ilmiah Indonesia", ikon: IKON.bahasa },
];

export default function AlatApp() {
  const [tab, setTab] = useState<Tab>("beranda");
  const p = useProject();
  const { aktif, jumlahKata } = p;

  return (
    <div className="al">
      <header className="al-top">
        <div className="al-top-in">
          <Link href="/" className="al-back">← Portal Mahasiswa</Link>
          <p className="al-eyebrow">ONE FOR ALL &middot; SIPALING FISIP</p>
          <h1>Cakrawala</h1>
          <p>
Be Your Self, Kamu adalah Pencipta Masa Depanmu Sendiri
          </p>

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
              <button type="button" className="al-aktif-ganti" onClick={() => setTab("beranda")}>
                Ganti project
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="al-body">
        <nav className="al-side" aria-label="Pilih alat">
          {MENU.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`al-nav ${tab === m.id ? "on" : ""}`}
              aria-current={tab === m.id ? "page" : undefined}
              onClick={() => setTab(m.id)}
            >
              <Ic d={m.ikon} />
              {m.label}
              <span className="al-nav-sub">{m.sub}</span>
            </button>
          ))}
        </nav>

        <main>
          {p.galat && <p className="al-galat" role="alert">{p.galat}</p>}

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
              keAlat={setTab}
            />
          )}
          {tab === "judul" && <PanelJudul project={p.aktif} ubah={p.ubah} keAlat={setTab} />}
          {tab === "referensi" && <PanelReferensi project={p.aktif} ubah={p.ubah} />}
          {tab === "kemiripan" && <PanelKemiripan project={p.aktif} ubah={p.ubah} />}
          {tab === "struktur" && <PanelStruktur project={p.aktif} />}
          {tab === "inggris" && <PanelInggris project={p.aktif} ubah={p.ubah} />}
          {tab === "sitasi" && <PanelSitasi project={p.aktif} ubah={p.ubah} />}
          {tab === "radar" && <PanelRadar project={p.aktif} ubah={p.ubah} />}
          {tab === "bahasa" && <PanelBahasa project={p.aktif} />}
        </main>
      </div>
    </div>
  );
}
