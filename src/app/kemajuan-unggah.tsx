"use client";

// ============================================================
// PANEL KEMAJUAN UNGGAHAN
//
// Yang dilaporkan mahasiswa: "menunggu lama lalu muncul error, tidak tahu
// sampai mana prosesnya". Sebelum panel ini, satu-satunya tanda bahwa portal
// masih bekerja adalah satu baris teks yang berganti empat kali — dan pada
// berkas 25 MB, satu baris itu dapat diam selama beberapa menit.
//
// Panel ini menjawab tiga pertanyaan yang muncul selama menunggu, dan
// ketiganya harus terjawab tanpa mahasiswa perlu menebak:
//
//   1. Apakah masih berjalan?  → bilah yang bergerak, dan lingkaran berputar.
//   2. Sudah sampai mana?      → persentase bita yang sudah benar-benar naik,
//                                bukan "berkas ke-2 dari 4" yang diam saja.
//   3. Berkas mana sekarang?   → daftar empat bagian, masing-masing bertanda
//                                selesai / sedang naik / menunggu.
//
// Tahap terakhir ("Menyimpan pengajuan…") tidak punya angka yang dapat
// diukur — yang ditunggu jawaban server. Bilahnya karena itu berganti menjadi
// gerakan bergaris yang tidak pernah mencapai ujung: menunggu, dan mengaku
// sedang menunggu.
//
// Pembaca layar mendapat kalimatnya lewat aria-live pada satu simpul yang
// isinya berubah, BUKAN dari angka di dalam bilah: membacakan setiap
// persentase akan mengubah pembaca layar menjadi pencacah.
// ============================================================

import {
  ejaBita,
  kalimatKemajuan,
  keadaanBerkas,
  persenBita,
  persenTampil,
  type Kemajuan,
} from "@/lib/kemajuan";

export type BerkasAntre = {
  /** Nama bagian, seperti "BAB I sampai BAB V". */
  label: string;
  /** Nama berkas yang dipilih mahasiswa. */
  nama: string;
  ukuran: number;
};

export default function KemajuanUnggah({
  kemajuan,
  antrean,
  kerja = "pengajuan",
}: {
  kemajuan: Kemajuan | null;
  antrean: BerkasAntre[];
  kerja?: "pengajuan" | "revisi";
}) {
  if (!kemajuan) return null;

  const persen = persenTampil(kemajuan);
  const menyimpan = kemajuan.tahap === "simpan";
  const kalimat = kalimatKemajuan(kemajuan, kerja);

  return (
    <section className="unggah-panel" aria-label={`Kemajuan pengiriman ${kerja}`}>
      <header className="unggah-kepala">
        <span className="unggah-putar" aria-hidden="true" />
        <div className="unggah-judul">
          {/* Satu simpul untuk pembaca layar; isinya kalimat utuh, bukan angka. */}
          <b role="status" aria-live="polite">
            {kalimat}
          </b>
          <small>
            {kemajuan.bitaTotal <= 0
              ? "Sedang menunggu jawaban server."
              : menyimpan
                ? "Berkas sudah aman di penyimpanan. Tinggal menunggu server menyimpan datanya."
                : `${ejaBita(kemajuan.bita)} dari ${ejaBita(kemajuan.bitaTotal)} terkirim`}
          </small>
        </div>
        <span className="unggah-persen" aria-hidden="true">
          {persen}%
        </span>
      </header>

      <div
        className={`unggah-bar${menyimpan ? " unggah-bar-menunggu" : ""}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        // Tahap menyimpan tidak punya nilai yang dapat diukur; progressbar
        // tanpa aria-valuenow adalah cara baku menyebut "belum tentu".
        aria-valuenow={menyimpan ? undefined : persen}
        aria-label={kalimat}
      >
        <span className="unggah-bar-isi" style={{ width: `${Math.max(persen, 3)}%` }} />
      </div>

      {antrean.length > 0 && (
        <ul className="unggah-daftar">
          {antrean.map((berkas, urut) => {
            const keadaan = keadaanBerkas(kemajuan, urut);
            const persenBerkas =
              keadaan === "selesai"
                ? 100
                : keadaan === "jalan"
                  ? persenBita(kemajuan.bitaBerkas, berkas.ukuran)
                  : 0;
            return (
              <li key={`${berkas.label}-${urut}`} className={`unggah-baris unggah-${keadaan}`}>
                <span className="unggah-tanda" aria-hidden="true">
                  {keadaan === "selesai" ? "✓" : keadaan === "jalan" ? "↑" : "·"}
                </span>
                <span className="unggah-nama">
                  <b>{berkas.label}</b>
                  <small>
                    {berkas.nama} · {ejaBita(berkas.ukuran)}
                  </small>
                </span>
                <span className="unggah-keadaan">
                  {keadaan === "selesai" ? "selesai" : keadaan === "jalan" ? `${persenBerkas}%` : "menunggu"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="unggah-catatan">
        Jangan tutup atau muat ulang halaman ini sampai nomor tiket muncul. Berkas besar memang lama;
        selama angka di atas masih bergerak, prosesnya sedang berjalan.
      </p>
    </section>
  );
}
