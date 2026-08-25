"use client";

import { useState } from "react";
import { Ic, IKON, Kepala } from "./ikon";
import { INTI_LABEL, SARINGAN_BAWAAN, type Karya, type Saringan } from "@/lib/referensi";
import type { Project } from "@/lib/project";

type Ringkasan = {
  total: number; bisaDiunduh: number; diDoaj: number; adaAbstrak: number;
  kunci: string[]; saringanDilepas?: boolean;
};

const TAHUN_KINI = new Date().getFullYear();

export function PanelReferensi({
  project, ubah,
}: { project: Project | null; ubah: (p: Partial<Project>) => void }) {
  const [lokal, setLokal] = useState("");
  const [saringan, setSaringan] = useState<Saringan>(SARINGAN_BAWAAN);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [hasil, setHasil] = useState<Karya[] | null>(null);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [ditambah, setDitambah] = useState<Set<string>>(new Set());

  const pertanyaan = project ? project.topik : lokal;
  const setPertanyaan = (n: string) => (project ? ubah({ topik: n }) : setLokal(n));

  async function cari(event: React.FormEvent) {
    event.preventDefault();
    setMemuat(true); setGalat(""); setHasil(null);
    try {
      const balasan = await fetch("/api/find-references", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pertanyaan, saringan }),
      });
      const data = (await balasan.json()) as {
        success?: boolean; message?: string; hasil?: Karya[]; ringkasan?: Ringkasan;
      };
      if (!balasan.ok || !data.success || !data.hasil) throw new Error(data.message || "Pencarian gagal.");
      setHasil(data.hasil); setRingkasan(data.ringkasan ?? null);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Pencarian gagal.");
    } finally { setMemuat(false); }
  }

  /** Tambahkan entri APA ke daftar pustaka project, tanpa menggandakan. */
  function tambahkan(k: Karya) {
    if (!project) return;
    const kini = project.daftarPustaka.trim();
    if (kini.includes(k.judul.slice(0, 40))) return;
    ubah({ daftarPustaka: kini ? `${kini}\n\n${k.apa}` : k.apa });
    setDitambah((s) => new Set(s).add(k.id));
  }

  return (
    <>
      <section className="al-card">
        <Kepala ikon={IKON.referensi} judul="Cari Referensi"
          sub="Tuliskan topik Anda → cari ke katalog OpenAlex → lihat inti tiap penelitian tanpa membaca utuh" />
        <p className="al-note">
          Dua tembok menghadang mahasiswa Indonesia sekaligus: jurnal bermutu terkunci di balik langganan yang
          kampusnya tidak beli, dan mesin pencari biasa mencampur artikel ilmiah dengan blog serta jurnal yang tidak
          jelas penerbitnya. Di sini pencarian menuju <b>OpenAlex</b>, katalog terbuka berisi lebih dari dua ratus juta
          karya ilmiah. Yang naskah lengkapnya <b>dapat diunduh gratis</b> ditandai, begitu pula yang terbit di jurnal
          terdaftar DOAJ.
        </p>

        <form onSubmit={cari}>
          <label className="al-field">
            <span>Topik atau pertanyaan penelitian {project && <em className="al-dari">tersimpan di project</em>}</span>
            <input value={pertanyaan} onChange={(e) => setPertanyaan(e.target.value)}
              placeholder="pengaruh literasi digital terhadap kemampuan menyaring informasi mahasiswa"
              autoComplete="off" required />
            <small>Boleh bahasa Indonesia, tetapi kata kunci bahasa Inggris hampir selalu memberi hasil jauh lebih banyak.</small>
          </label>

          <h3 className="al-h4">Saringan</h3>
          <div className="al-duo-isi">
            <label className="al-field">
              <span>Terbit sejak tahun</span>
              <input type="number" min={1900} max={TAHUN_KINI} value={saringan.tahunMinimal} inputMode="numeric"
                onChange={(e) => setSaringan({ ...saringan, tahunMinimal: Number(e.target.value) || TAHUN_KINI - 10 })} />
              <small>Banyak prodi mewajibkan rujukan sepuluh tahun terakhir.</small>
            </label>
            <label className="al-field">
              <span>Bahasa</span>
              <select value={saringan.bahasa}
                onChange={(e) => setSaringan({ ...saringan, bahasa: e.target.value as Saringan["bahasa"] })}>
                <option value="semua">Semua bahasa</option>
                <option value="en">Inggris saja</option>
                <option value="id">Indonesia saja</option>
              </select>
            </label>
          </div>

          <div className="al-tiles">
            <button type="button" className={`al-tile ${saringan.hanyaBisaDiunduh ? "on" : ""}`}
              aria-pressed={saringan.hanyaBisaDiunduh}
              onClick={() => setSaringan({ ...saringan, hanyaBisaDiunduh: !saringan.hanyaBisaDiunduh })}>
              <b>Hanya yang bisa diunduh gratis</b>
              <small>Naskah lengkapnya terbuka, bukan hanya abstraknya</small>
            </button>
            <button type="button" className={`al-tile ${saringan.hanyaDoaj ? "on" : ""}`}
              aria-pressed={saringan.hanyaDoaj}
              onClick={() => setSaringan({ ...saringan, hanyaDoaj: !saringan.hanyaDoaj })}>
              <b>Hanya jurnal terdaftar DOAJ</b>
              <small>Penyaring paling cepat terhadap penerbit yang meragukan</small>
            </button>
          </div>

          <button type="submit" className="al-btn" disabled={memuat || !pertanyaan.trim()}>
            {memuat ? "Mencari ke OpenAlex…" : "Cari referensi"}
          </button>
        </form>
        {galat && <p className="al-galat" role="alert">{galat}</p>}
      </section>

      {hasil && ringkasan && (
        <section className="al-card">
          <div className="al-stats">
            <div className="al-stat"><b>{ringkasan.total}</b><span>artikel</span></div>
            <div className="al-stat ok"><b>{ringkasan.bisaDiunduh}</b><span>bisa diunduh</span></div>
            <div className="al-stat"><b>{ringkasan.diDoaj}</b><span>terdaftar DOAJ</span></div>
            <div className="al-stat"><b>{ringkasan.adaAbstrak}</b><span>ada abstrak</span></div>
          </div>

          {ringkasan.saringanDilepas && (
            <p className="al-note">
              Katalog menolak sebagian saringan lanjutan yang Anda pilih, jadi hasil ini ditampilkan tanpa saringan
              itu. Periksa sendiri lencana &ldquo;bisa diunduh&rdquo; dan &ldquo;DOAJ&rdquo; pada tiap artikel.
            </p>
          )}

          {hasil.length === 0 ? (
            <p className="al-galat">
              Tidak ada artikel yang cocok. Coba longgarkan saringannya, mundurkan tahun terbit, atau ganti kata
              kuncinya ke bahasa Inggris.
            </p>
          ) : (
            <ul className="al-list">
              {hasil.map((k) => (
                <li key={k.id} className={`al-item ${k.bisaDiunduh ? "ok" : "abu"}`}>
                  <div className="al-item-atas">
                    {k.bisaDiunduh && <span className="al-lencana unduh">Bisa diunduh gratis</span>}
                    {k.diDoaj && <span className="al-lencana doaj">DOAJ</span>}
                    <span className="al-num">{k.sitasi.toLocaleString("id-ID")} sitasi</span>
                  </div>
                  <p className="al-kutip"><b>{k.judul}</b></p>
                  <p className="al-sumber-baris">
                    {k.penulis.slice(0, 3).join("; ")}{k.penulis.length > 3 ? ", dkk." : ""}
                    {k.tahun ? ` · ${k.tahun}` : ""}{k.jurnal ? ` · ${k.jurnal}` : ""}
                  </p>

                  {k.inti.length > 0 ? (
                    <div className="al-inti">
                      {k.inti.map((i) => (
                        <p key={i.bidang}><b>{INTI_LABEL[i.bidang]}:</b> {i.kalimat}</p>
                      ))}
                    </div>
                  ) : k.abstrak ? (
                    <div className="al-inti">
                      <p>{k.abstrak.slice(0, 320)}{k.abstrak.length > 320 ? "…" : ""}</p>
                    </div>
                  ) : (
                    <p className="al-sumber-baris">Abstrak tidak tersedia di katalog untuk artikel ini.</p>
                  )}

                  <div className="al-aksi">
                    {k.tautanUnduh && (
                      <a className="al-mini" href={k.tautanUnduh} target="_blank" rel="noopener noreferrer">
                        <Ic d={IKON.unduh} /> Buka naskahnya
                      </a>
                    )}
                    {k.doi && (
                      <a className="al-mini" href={`https://doi.org/${k.doi.replace(/^https?:\/\/doi\.org\//, "")}`}
                        target="_blank" rel="noopener noreferrer">Halaman jurnal</a>
                    )}
                    {project && (
                      <button type="button" className={`al-mini ${ditambah.has(k.id) ? "sudah" : ""}`}
                        onClick={() => tambahkan(k)} disabled={ditambah.has(k.id)}>
                        {ditambah.has(k.id)
                          ? <><Ic d={IKON.centang} /> Sudah di daftar pustaka</>
                          : <><Ic d={IKON.tambah} /> Tambahkan ke daftar pustaka</>}
                      </button>
                    )}
                  </div>
                  <p className="al-apa">{k.apa}</p>
                </li>
              ))}
            </ul>
          )}

          <p className="al-tail">
            <b>Kalimat inti di atas diambil apa adanya dari abstrak</b>, bukan ringkasan buatan mesin. Itu disengaja:
            ringkasan yang disusun ulang mesin dapat menyatakan hal yang tidak ada di sumbernya, dan Anda yang akan
            menanggungnya di ruang sidang. Tetap baca naskah aslinya sebelum menyitasi.
          </p>
        </section>
      )}
    </>
  );
}
