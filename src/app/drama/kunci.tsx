"use client";

// ============================================================
// LAYAR KUNCI SITUS DRAMA
//
// Yang dibuka di sini kode Cakrawala yang SAMA dengan yang dipakai di portal.
// Tidak ada kode kedua, tidak ada pendaftaran kedua, dan tidak ada harga
// kedua — sengaja, karena menu ini bonus langganan, bukan barang jualan yang
// berdiri sendiri.
//
// Kenapa kodenya perlu diketik lagi di sini, padahal sudah pernah diketik di
// portal? Karena ini domain lain, dan peramban tidak pernah mengirim cookie
// satu domain ke domain lain. Yang diketik ulang hanya kodenya; hari
// langganannya TIDAK dipotong lagi — jalur /api/cakrawala-access mengenali
// nomor yang sudah pernah menukarkan kode itu dan sekadar memulangkan
// sesinya. Itu sebabnya nomor WhatsApp ikut diminta di sini: nomor itulah
// yang menyimpan langganannya, bukan kodenya.
// ============================================================

import { useState, type FormEvent } from "react";
import { KONTAK } from "@/lib/kontak";

type Props = {
  /** Alamat portal, untuk tautan balik yang benar dari domain ini. */
  portal: string;
  /** Keterangan langganan yang baru saja berakhir, bila pengunjungnya dikenali. */
  habis: { nomor: string; nama: string | null; sampai: string } | null;
};

export default function KunciDrama({ portal, habis }: Props) {
  const [kode, setKode] = useState("");
  const [wa, setWa] = useState("");
  const [nama, setNama] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function buka(peristiwa: FormEvent<HTMLFormElement>) {
    peristiwa.preventDefault();
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
      const jawab = await fetch("/api/cakrawala-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: isi, whatsapp: nomor, nama: nama.trim() }),
      });
      const isiJawab = (await jawab.json()) as { success?: boolean; message?: string };
      if (!jawab.ok || !isiJawab.success) {
        throw new Error(isiJawab.message || "Kode tidak dapat diperiksa.");
      }
      // Gerbangnya ada di server, jadi halamannya diminta ulang seutuhnya:
      // cookie pembuka baru terbaca pada permintaan berikutnya.
      window.location.replace("/");
      return;
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Kode tidak dapat diperiksa.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="dk">
      <header className="dk-hero">
        <a className="dk-back" href={portal}>← Portal SiPaling FISIP</a>
        <span className="dk-gembok">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          KHUSUS PEMEGANG KODE
        </span>
        <h1>Nonton Drama</h1>
        <p className="dk-lead">
          Drama pendek dari sembilan sumber sekaligus — cari judulnya, pilih episodenya, langsung
          jalan. Gratis untuk yang langganan Cakrawala, tanpa tambahan biaya apa pun.
        </p>
      </header>

      <main className="dk-body">
        <section className="dk-kartu" id="kode">
          <h2>Buka dengan kode Cakrawala</h2>
          <p className="dk-sub">
            Pakai kode yang sama dengan yang kamu pakai di portal. Membukanya di sini{" "}
            <b>tidak memotong masa langgananmu</b> — hari yang sudah kamu beli tetap utuh.
          </p>

          {habis && (
            <p className="dk-habis">
              {habis.nama ? `Halo ${habis.nama}, ` : ""}langganan pada nomor {habis.nomor} berakhir{" "}
              {new Date(habis.sampai).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.
              Kirim pesan ke {KONTAK} untuk memperpanjang; nomormu sudah terdaftar.
            </p>
          )}

          <form onSubmit={buka} className="dk-form">
            <label>
              <span>Kode akses</span>
              <input
                value={kode}
                onChange={(peristiwa) => setKode(peristiwa.target.value)}
                placeholder="CKRW-XXXX-XXXX"
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <label>
              <span>Nomor WhatsApp</span>
              <input
                value={wa}
                onChange={(peristiwa) => setWa(peristiwa.target.value)}
                placeholder="0812xxxxxxx"
                inputMode="tel"
                autoComplete="tel"
              />
            </label>

            <label>
              <span>Nama <small>(boleh dikosongkan)</small></span>
              <input
                value={nama}
                onChange={(peristiwa) => setNama(peristiwa.target.value)}
                placeholder="Nama panggilan"
                autoComplete="name"
              />
            </label>

            {galat && <p className="dk-galat" role="alert">{galat}</p>}

            <button type="submit" className="dk-btn" disabled={sibuk}>
              {sibuk ? "Memeriksa…" : "Buka Nonton Drama"}
            </button>
          </form>
        </section>

        <section className="dk-kartu dk-kartu-lain">
          <h2>Belum punya kode?</h2>
          <p className="dk-sub">
            Kode dibagikan bersama langganan Cakrawala di portal — sembilan alat bantu tugas akhir,
            catatan uang bulanan, dan menu ini. Satu kode untuk semuanya.
          </p>
          <div className="dk-aksi">
            <a className="dk-btn dk-btn-lain" href={`${portal}/alat`}>Lihat Cakrawala di portal →</a>
            <span className="dk-kontak">Atau kirim pesan ke {KONTAK}</span>
          </div>
        </section>
      </main>

      <footer className="dk-kaki">
        <strong>SiPaling FISIP</strong>
        <span>Nonton Drama · bonus untuk pemegang kode Cakrawala</span>
      </footer>
    </div>
  );
}
