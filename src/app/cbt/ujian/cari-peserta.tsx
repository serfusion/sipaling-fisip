"use client";

// ============================================================
// PENCARIAN PESERTA — LAYAR MASUK UJIAN
//
// Satu kotak isian yang menjadi dua hal sekaligus, dan itulah seluruh
// rancangannya: ia kolom NAMA biasa, dan sementara diketik ia juga MENCARI.
//
// Peserta tidak perlu tahu mana yang sedang terjadi. Yang namanya ada di
// daftar mengetik satu huruf, melihat namanya muncul, dan menekannya — nomor
// induknya terisi sendiri. Yang namanya belum diimpor mengetik namanya sampai
// habis dan mengisi nomornya sendiri, persis seperti sebelum V1. Tidak ada
// tombol "cari", tidak ada pilihan "saya tidak ada di daftar", tidak ada
// keadaan yang salah.
//
// Itu syarat yang menentukan. Portal yang daftar mahasiswanya belum diimpor —
// dan pada hari pertama, itu berarti semua portal — harus tetap menjalankan
// ujiannya seperti kemarin.
//
// ------------------------------------------------------------
// YANG DIJAGA DI SINI, DAN KENAPA
// ------------------------------------------------------------
//   • DEBOUNCE. Ketikan yang masih berlanjut tidak dikirim. Tanpa ini, tiga
//     puluh peserta yang mengetik "Muhammad" bersamaan menghasilkan 240
//     permintaan dalam beberapa detik — lewat jaringan kampus yang sedang
//     menanggung ketiga puluhnya.
//   • JAWABAN YANG SUDAH BASI DIBUANG. Permintaan untuk "bu" dapat tiba
//     SESUDAH permintaan untuk "budi", dan daftar yang muncul akan menjadi
//     daftar yang salah. Yang dipakai hanya jawaban atas ketikan terakhir.
//   • GAGAL DENGAN DIAM. Pencarian yang tidak menjawab tidak menampilkan
//     apa-apa dan tidak menghalangi apa-apa. Kolomnya tetap kolom nama biasa,
//     dan ujiannya tetap dapat dimulai.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";

/** Menunggu sekian milidetik sesudah ketikan terakhir sebelum bertanya. */
const JEDA_KETIK = 220;

export type SaranPeserta = {
  nim: string;
  nama: string;
  kelas?: string;
  prodi?: string;
};

type Sifat = {
  /** Kode ujian yang sedang dibuka — tanpa ini pencarian tidak dijalankan. */
  kode: string;
  nama: string;
  setNama: (nilai: string) => void;
  nim: string;
  setNim: (nilai: string) => void;
  /** Dipanggil ketika peserta memilih satu nama dari daftar. */
  onPilih?: (saran: SaranPeserta) => void;
};

export default function CariPeserta({ kode, nama, setNama, nim, setNim, onPilih }: Sifat) {
  const [saran, setSaran] = useState<SaranPeserta[]>([]);
  const [buka, setBuka] = useState(false);
  const [sorot, setSorot] = useState(-1);
  const [mencari, setMencari] = useState(false);

  /**
   * Nomor permintaan terakhir yang dikirim.
   *
   * Jawaban yang nomornya bukan yang terakhir DIBUANG. Inilah satu-satunya
   * penjaga terhadap daftar yang muncul untuk ketikan yang sudah lama diganti
   * — dan pada jaringan yang tersendat, jawaban memang tiba tidak berurutan.
   */
  const giliranRef = useRef(0);
  const waktuRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kotakRef = useRef<HTMLDivElement | null>(null);

  /**
   * Ditekan sendiri oleh peserta, bukan ditebak dari daftar.
   *
   * Sekali ia memilih satu nama, pencarian berhenti sampai ia benar-benar
   * mengubah ketikannya lagi. Tanpa penanda ini, memilih "Budi Santoso" akan
   * langsung memicu pencarian untuk "Budi Santoso" dan daftarnya terbuka
   * kembali menutupi kolom berikutnya.
   */
  const dipilihRef = useRef("");

  const cari = useCallback(async (q: string) => {
    const giliran = giliranRef.current + 1;
    giliranRef.current = giliran;
    setMencari(true);
    try {
      const jawab = await fetch(
        `/api/cbt/mahasiswa?kode=${encodeURIComponent(kode)}&q=${encodeURIComponent(q)}`,
        { cache: "no-store" },
      );
      const data = await jawab.json();
      if (giliran !== giliranRef.current) return;
      const isi: SaranPeserta[] = jawab.ok && data.success && Array.isArray(data.mahasiswa) ? data.mahasiswa : [];
      setSaran(isi);
      setBuka(isi.length > 0);
      setSorot(-1);
    } catch {
      // Daftar yang tidak dapat dibuka bukan halangan. Kolomnya kembali
      // menjadi kolom nama biasa, dan peserta mengetik nomornya sendiri.
      if (giliran === giliranRef.current) { setSaran([]); setBuka(false); }
    } finally {
      if (giliran === giliranRef.current) setMencari(false);
    }
  }, [kode]);

  // Ketikan → tunggu sebentar → cari.
  useEffect(() => {
    if (waktuRef.current) clearTimeout(waktuRef.current);
    const q = nama.trim();
    if (!kode || q.length < 1 || q === dipilihRef.current) {
      setSaran([]); setBuka(false);
      return;
    }
    waktuRef.current = setTimeout(() => void cari(q), JEDA_KETIK);
    return () => { if (waktuRef.current) clearTimeout(waktuRef.current); };
  }, [nama, kode, cari]);

  // Menekan di luar kotak menutup daftarnya. Daftar yang menggantung di atas
  // tombol MULAI UJIAN akan menerima tekanan yang ditujukan untuk tombolnya.
  useEffect(() => {
    if (!buka) return;
    const tutup = (e: MouseEvent | TouchEvent) => {
      if (kotakRef.current && !kotakRef.current.contains(e.target as Node)) setBuka(false);
    };
    document.addEventListener("mousedown", tutup);
    document.addEventListener("touchstart", tutup);
    return () => {
      document.removeEventListener("mousedown", tutup);
      document.removeEventListener("touchstart", tutup);
    };
  }, [buka]);

  function pilih(s: SaranPeserta) {
    dipilihRef.current = s.nama;
    setNama(s.nama);
    setNim(s.nim);
    setSaran([]);
    setBuka(false);
    setSorot(-1);
    onPilih?.(s);
  }

  function tombol(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!buka || saran.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSorot((n) => (n + 1) % saran.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSorot((n) => (n <= 0 ? saran.length - 1 : n - 1));
    } else if (e.key === "Enter" && sorot >= 0) {
      // Enter hanya menangkap ketika ada yang DISOROT. Tanpa syarat itu,
      // peserta yang menekan Enter untuk memulai ujian akan memilih nama
      // pertama di daftar — yang belum tentu namanya.
      e.preventDefault();
      pilih(saran[sorot]);
    } else if (e.key === "Escape") {
      setBuka(false);
    }
  }

  return (
    <div className="uj-cari" ref={kotakRef}>
      <label htmlFor="uj-nama">Nama Lengkap</label>
      <div className="uj-cari-kotak">
        <input
          id="uj-nama"
          className="uj-input"
          value={nama}
          onChange={(e) => { dipilihRef.current = ""; setNama(e.target.value); }}
          onKeyDown={tombol}
          onFocus={() => { if (saran.length > 0) setBuka(true); }}
          placeholder="Ketik namamu, daftar muncul sendiri"
          autoComplete="off"
          role="combobox"
          aria-expanded={buka}
          aria-autocomplete="list"
          aria-controls="uj-cari-daftar"
        />
        {mencari && <span className="uj-cari-sibuk" aria-hidden="true" />}
      </div>

      {buka && saran.length > 0 && (
        <ul className="uj-cari-daftar" id="uj-cari-daftar" role="listbox">
          {saran.map((s, urut) => (
            <li key={s.nim} role="option" aria-selected={urut === sorot}>
              <button
                type="button"
                className={urut === sorot ? "on" : ""}
                // onMouseDown, bukan onClick: kolomnya kehilangan fokus lebih
                // dulu pada onClick, daftarnya tertutup, dan tekanannya jatuh
                // ke tempat yang sudah tidak ada apa-apanya.
                onMouseDown={(e) => { e.preventDefault(); pilih(s); }}
                onMouseEnter={() => setSorot(urut)}
              >
                <span className="uj-cari-nim">{s.nim}</span>
                <span className="uj-cari-nama">{s.nama}</span>
                {(s.kelas || s.prodi) && (
                  <span className="uj-cari-kelas">{[s.kelas, s.prodi].filter(Boolean).join(" · ")}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <label htmlFor="uj-nim">NIM / Nomor Peserta</label>
      <input
        id="uj-nim"
        className="uj-input"
        value={nim}
        onChange={(e) => setNim(e.target.value.replace(/\D/g, ""))}
        placeholder="Nomor induk atau nomor peserta"
        inputMode="numeric"
        autoComplete="off"
      />
      <p className="uj-cari-bantu">
        Namamu tidak muncul? Ketik saja nama dan nomormu sendiri, sama sahnya.
      </p>
    </div>
  );
}
