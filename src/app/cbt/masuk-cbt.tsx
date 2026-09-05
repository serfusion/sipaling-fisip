"use client";

// ============================================================
// HALAMAN DEPAN SITUS CBT
//
// Dua pintu, dan pengunjung memilih lebih dulu siapa dirinya — persis seperti
// rujukan rancangan yang diberikan pemilik portal.
//
//   Siswa       : cukup kode ujian. Nama dan NIM diisi pada layar berikutnya,
//                 sesudah ujiannya ketemu — supaya yang salah kode tidak
//                 terlanjur mengetik identitasnya untuk ujian yang tidak ada.
//   Guru / Admin: masuk lewat akun portal yang sudah ada.
//
// TIDAK ADA PENDAFTARAN SISWA dan tidak ada PIN. Itu keputusan pemilik
// portalnya, dan bukan kekurangan: satu kode yang dibacakan di depan kelas
// jauh lebih tahan daripada tiga puluh PIN yang harus dibagikan lebih dulu.
// ============================================================

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import KreditCbt, { KREDIT_CBT } from "./kredit";

export default function MasukCbt() {
  const router = useRouter();
  const [pintu, setPintu] = useState<"siswa" | "guru">("siswa");
  const [kode, setKode] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function lanjut() {
    const isi = kode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!isi) { setGalat("Kode ujian belum diisi."); return; }
    setSibuk(true); setGalat("");
    try {
      // Kodenya diperiksa DI SINI, sebelum berpindah halaman. Mahasiswa yang
      // salah ketik satu huruf lebih baik tahu sekarang daripada sesudah
      // mengisi nama dan NIM pada layar berikutnya.
      const jawab = await fetch(`/api/cbt/ikut?kode=${encodeURIComponent(isi)}`, { cache: "no-store" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Ujian tidak ditemukan.");
      router.push(`/cbt/ujian?kode=${encodeURIComponent(isi)}`);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Ujian tidak ditemukan.");
      setSibuk(false);
    }
  }

  return (
    <div className="cbtd">
      {/* ---------- KIRI: JENAMA ---------- */}
      <aside className="cbtd-kiri">
        <div className="cbtd-lambang" aria-hidden="true">📝</div>
        <h1>SiPaling CBT</h1>
        <p className="cbtd-sub">
          Ujian Berbasis Komputer, Fakultas Ilmu Sosial dan Ilmu Politik
        </p>
        <ul className="cbtd-nilai">
          <li>Tidak perlu membuat akun. Cukup kode ujian, nama, dan NIM.</li>
          <li>Jawaban tersimpan otomatis tiap sepuluh detik.</li>
          <li>Waktu dihitung di server, jadi aman walau jaringan tersendat.</li>
          <li>Nyaman dikerjakan dari ponsel maupun komputer.</li>
        </ul>
        <p className="cbtd-kaki-kiri">
          Bagian dari <Link href="/">SiPaling FISIP</Link>
        </p>
        <p className="cbtd-kredit-kiri">{KREDIT_CBT}</p>
      </aside>

      {/* ---------- KANAN: PINTU MASUK ---------- */}
      <main className="cbtd-kanan">
        <div className="cbtd-kotak">
          <h2>Masuk</h2>
          <p className="cbtd-lead">Pilih dahulu Anda masuk sebagai siapa.</p>

          <div className="cbtd-tab" role="tablist">
            <button
              type="button" role="tab" aria-selected={pintu === "siswa"}
              className={pintu === "siswa" ? "on" : ""}
              onClick={() => { setPintu("siswa"); setGalat(""); }}
            >
              Mahasiswa
            </button>
            <button
              type="button" role="tab" aria-selected={pintu === "guru"}
              className={pintu === "guru" ? "on" : ""}
              onClick={() => { setPintu("guru"); setGalat(""); }}
            >
              Dosen / Admin
            </button>
          </div>

          {pintu === "siswa" ? (
            <>
              <label htmlFor="cbtd-kode">Kode Ujian</label>
              <input
                id="cbtd-kode"
                className="cbtd-input cbtd-input-kode"
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") void lanjut(); }}
                placeholder="XXXXXX"
                autoComplete="off"
                autoFocus
              />
              <p className="cbtd-bantu">
                Kode diberikan dosen Anda, biasanya lewat grup kelas. Nama dan NIM diisi pada
                langkah berikutnya, bersama <b>lama waktu ujiannya</b> — jadi Anda sempat bersiap
                sebelum menekan Mulai Ujian.
              </p>
              {galat && <p className="cbtd-galat" role="alert">{galat}</p>}
              <button type="button" className="cbtd-btn" disabled={sibuk} onClick={() => void lanjut()}>
                {sibuk ? "Memeriksa…" : "Lanjut"}
              </button>
            </>
          ) : (
            <>
              <p className="cbtd-bantu">
                Dosen dan admin memakai akun portal yang sama dengan layanan akademik. Menu CBT ada
                di dalam dashboard, pada bagian Ujian Online.
              </p>
              <Link href="/login" className="cbtd-btn cbtd-btn-tautan">
                Masuk ke dashboard
              </Link>
              <p className="cbtd-bantu">
                Belum punya akun? Hubungi Super Admin fakultas. Menu CBT hanya terbuka untuk dosen,
                Admin, dan Super Admin. Bukan admin bagian.
              </p>
            </>
          )}

          <p className="cbtd-versi">Sistem Ujian Berbasis Komputer</p>
          <KreditCbt />
        </div>
      </main>
    </div>
  );
}
