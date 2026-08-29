"use client";

// KOTAK "PILIH FILE"
//
// Kontrol berkas bawaan peramban tampil berbeda-beda: Chrome menampilkan
// tombol kecil bertuliskan "Choose File", Safari iOS hampir tidak terlihat
// sebagai tombol sama sekali, dan tak satu pun memberi tahu berkas mana yang
// sudah terpilih dengan jelas. Di ponsel, sebagian pengguna tidak sadar
// bagian itu bisa ditekan.
//
// Karena itu kotaknya digambar sendiri, dan input aslinya ditumpangkan
// setransparan mungkin tepat di atasnya. Bukan disembunyikan dengan
// display:none: input yang tidak punya ukuran tidak dapat difokuskan, dan
// peramban lalu gagal menampilkan pesan "wajib diisi" pada berkas yang
// dilewatkan. Dengan cara ini seluruh permukaan kotak dapat ditekan,
// pemeriksaan bawaan tetap berjalan, dan tampilannya sama di mana pun.

export default function PilihBerkas({
  id,
  name,
  accept,
  required = false,
  terpilih,
  onPilih,
  catatan,
}: {
  id: string;
  name?: string;
  accept?: string;
  required?: boolean;
  /** Keterangan berkas terpilih. Dipegang induk supaya tombol Reset di
   *  formulir tetap dapat mengosongkannya. */
  terpilih: string;
  onPilih: (berkas: File | null) => void;
  catatan?: string;
}) {
  return (
    <div className="pilih-berkas">
      <div className={`pb-kotak${terpilih ? " pb-isi" : ""}`}>
        <span className="pb-ikon" aria-hidden="true">
          {terpilih ? "📄" : "📁"}
        </span>
        <span className="pb-teks">
          <b>{terpilih ? "Ganti file" : "Pilih file"}</b>
          <small>{terpilih || "Belum ada file dipilih"}</small>
        </span>
        <span className="pb-aksi" aria-hidden="true">Telusuri</span>
        <input
          id={id}
          name={name}
          type="file"
          accept={accept}
          required={required}
          className="pb-input"
          onChange={(event) => onPilih(event.target.files?.[0] ?? null)}
        />
      </div>
      {catatan && <p className="helper">{catatan}</p>}
    </div>
  );
}

/**
 * Nama berkas beserta ukurannya, seperti yang tampil di dalam kotak.
 *
 * Berkas di bawah satu megabita dieja dalam KB. Kalau semuanya dipaksa MB,
 * lampiran kecil tampil sebagai "0,00 MB" dan terbaca seperti berkas rusak.
 */
export function keteranganBerkas(berkas: File | null) {
  if (!berkas) return "";
  const ukuran =
    berkas.size < 1024 * 1024
      ? `${Math.max(1, Math.round(berkas.size / 1024))} KB`
      : `${(berkas.size / 1024 / 1024).toFixed(2).replace(".", ",")} MB`;
  return `${berkas.name} · ${ukuran}`;
}
