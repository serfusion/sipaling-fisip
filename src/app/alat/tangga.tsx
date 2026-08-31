"use client";

// TANGGA PENYUSUNAN — deretan tahap yang menyala sambil mahasiswa mengetik
//
// Mahasiswa yang bingung tidak kekurangan penjelasan, ia kekurangan gambaran
// tentang sudah sampai mana dirinya. Deretan ini memperlihatkan dua belas
// tahap yang sama yang ditanyakan dosen pembimbing pada pertemuan pertama,
// dan menyalakannya satu per satu dari kalimat yang sedang ia tulis.
//
// Yang belum terisi SENGAJA dibiarkan gelap. Mengisinya dengan tebakan yang
// terlihat meyakinkan membuat mahasiswa mengira rancangannya sudah lengkap
// padahal lokasinya belum pernah ia sebut.

import type { Tahap } from "@/lib/tafsir-cerita";

export default function Tangga({
  tahap,
  siap,
  ringkas = false,
}: {
  tahap: Tahap[];
  /** Berapa yang sudah menyala, untuk kalimat "7 dari 12". */
  siap: number;
  /** Tanpa judul dan keterangan — dipakai di tempat yang sudah sempit. */
  ringkas?: boolean;
}) {
  const belumMetode = tahap.some((t) => t.susulan && !t.siap);

  return (
    <div className="tangga">
      {!ringkas && (
        <div className="tangga-kepala">
          <b>Tangga penyusunan</b>
          <span>{siap} dari {tahap.length} terisi</span>
        </div>
      )}
      <ol className="tangga-baris">
        {tahap.map((t) => (
          <li
            key={t.id}
            className={`tangga-butir ${t.siap ? "isi" : t.susulan ? "nanti" : "kosong"}`}
            title={t.siap ? `${t.label}: ${t.isi}` : `${t.label} belum terbaca dari ceritamu`}
          >
            <span className="tangga-tanda" aria-hidden="true">{t.siap ? "✓" : "○"}</span>
            <span className="tangga-label">{t.label}</span>
            {t.siap && <span className="tangga-isi">{t.isi}</span>}
          </li>
        ))}
      </ol>
      {!ringkas && belumMetode && (
        <p className="tangga-catatan">
          Yang masih abu-abu belum tentu kurang. Pendekatan, metode, teori, sampling, dan judul memang baru
          terisi setelah rancangannya disusun.
        </p>
      )}
    </div>
  );
}

/**
 * Kotak lanjutan sesudah hasil keluar.
 *
 * Rancangan pertama hampir tidak pernah yang dipakai. Yang berguna justru
 * ronde kedua: mahasiswa membaca hasilnya, sadar ada yang belum ia sebut,
 * lalu menambahkannya. Kotak ini menyambung tambahan itu ke ceritanya yang
 * lama, bukan menggantinya, sehingga metodenya disusun ulang dari cerita yang
 * makin lengkap dan bukan dari potongan yang berdiri sendiri.
 */
export function Lanjutan({
  pertanyaan,
  nilai,
  onNilai,
  onKirim,
  sibuk,
}: {
  /** Yang belum terbaca, ditawarkan sebagai bahan jawaban. */
  pertanyaan: string[];
  nilai: string;
  onNilai: (teks: string) => void;
  onKirim: () => void;
  sibuk: boolean;
}) {
  return (
    <div className="lanjut">
      <b className="lanjut-tanya">Ada yang ingin kamu tanyakan atau tambahkan?</b>
      <p className="lanjut-sub">
        Tulis saja apa adanya. Tambahanmu disambung ke ceritamu yang tadi, lalu metodenya disusun ulang dari
        keduanya.
      </p>

      {pertanyaan.length > 0 && (
        <div className="lanjut-usul">
          <span>Yang belum ketemu di ceritamu:</span>
          <div className="lanjut-chip">
            {pertanyaan.slice(0, 4).map((q) => (
              <button
                key={q}
                type="button"
                disabled={sibuk}
                onClick={() => onNilai(`${nilai ? `${nilai.trim()} ` : ""}${q} `)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        rows={3}
        value={nilai}
        disabled={sibuk}
        onChange={(e) => onNilai(e.target.value)}
        placeholder="Misalnya: penelitiannya di Kota Tangerang, respondennya mahasiswa semester 5."
      />
      <button type="button" className="lanjut-btn" disabled={sibuk || !nilai.trim()} onClick={onKirim}>
        {sibuk ? "Menyusun ulang…" : "Gabungkan dan susun ulang"}
      </button>
    </div>
  );
}
