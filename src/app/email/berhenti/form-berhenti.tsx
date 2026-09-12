"use client";

import { useState } from "react";

type Keadaan = "siap" | "kirim" | "selesai" | "galat";

export default function FormBerhenti({ token }: { token: string }) {
  const [keadaan, setKeadaan] = useState<Keadaan>(token ? "siap" : "galat");

  async function berhenti() {
    setKeadaan("kirim");
    try {
      const jawaban = await fetch(`/api/outreach/berhenti?t=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      });
      // Jalur ini selalu menjawab 200 untuk token sah maupun tidak. Halaman
      // pun menampilkan kalimat yang sama — memberi tahu bahwa sebuah token
      // "tidak dikenali" sama saja dengan menyediakan alat untuk menebak
      // token mana yang ada di dalam sistem.
      setKeadaan(jawaban.ok ? "selesai" : "galat");
    } catch {
      setKeadaan("galat");
    }
  }

  return (
    <main className="unsub-layar">
      <div className="unsub-kartu">
        <p className="unsub-eyebrow">FISIP UNIVERSITAS MUHAMMADIYAH TANGERANG</p>

        {keadaan === "selesai" ? (
          <>
            <h1>Anda sudah dikeluarkan dari daftar.</h1>
            <p>
              Kami tidak akan mengirimkan undangan jurnal ke alamat ini lagi. Surat yang mungkin
              sudah telanjur mengantre juga ikut dibatalkan.
            </p>
            <p className="unsub-maaf">Maaf telah mengganggu waktu Anda.</p>
          </>
        ) : keadaan === "galat" ? (
          <>
            <h1>Tautan ini tidak dapat diproses.</h1>
            <p>
              Tautannya mungkin sudah kedaluwarsa atau tersalin tidak utuh. Balas saja surat yang
              Anda terima dengan satu kata &ldquo;unsubscribe&rdquo;, dan kami akan
              mengeluarkannya secara manual.
            </p>
          </>
        ) : (
          <>
            <h1>Berhenti menerima undangan jurnal?</h1>
            <p>
              Satu ketukan, dan alamat Anda tidak akan pernah dikirimi undangan dari jurnal yang
              dikelola fakultas kami lagi. Tidak ada pertanyaan lanjutan.
            </p>
            <button type="button" className="unsub-tombol" onClick={() => void berhenti()} disabled={keadaan === "kirim"}>
              {keadaan === "kirim" ? "Memproses…" : "Ya, berhentikan"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
