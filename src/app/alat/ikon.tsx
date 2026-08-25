// Ikon garis untuk seluruh halaman Cakrawala. Satu komponen, satu jalur path,
// supaya tidak ada berkas SVG terpisah yang harus ikut dimuat.

export function Ic({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export const IKON = {
  beranda: "M4 11l8-7 8 7M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9",
  struktur: "M4 5h7M4 10h11M4 15h7M4 20h13M18 4v9M18 4l-2 2M18 4l2 2",
  inggris: "M4 5h11M9 3v2c0 5-2 8-5 10M8 10c1 3 3 5 6 6M13 21l4-9 4 9M14.5 18h5",
  sitasi: "M9 12h6M9 16h4M14 3v4a1 1 0 0 0 1 1h4M5 8V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3",
  radar: "M12 21a9 9 0 1 0-9-9M12 17a5 5 0 1 0-5-5M12 12l9-9",
  bahasa: "M12 20h9M3 20l6-15 6 15M6 15h6M17 4v6M17 4l-2 2M17 4l2 2",
  centang: "M4 12.5l5 5L20 6.5",
  tambah: "M12 5v14M5 12h14",
  unduh: "M12 4v11M8 11l4 4 4-4M4 20h16",
  unggah: "M12 20V9M8 13l4-4 4 4M4 4h16",
  hapus: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13",
  dokumen: "M14 3v4a1 1 0 0 0 1 1h4M6 3h9l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
  judul: "M4 6h9M4 11h6M12.5 20l6.5-6.5a2.1 2.1 0 0 0-3-3L9.5 17 9 20z",
  referensi: "M11 19a8 8 0 1 1 8-8 8 8 0 0 1-8 8zM21 21l-4.3-4.3",
  kemiripan: "M9 7H6a5 5 0 0 0 0 10h3M15 7h3a5 5 0 0 1 0 10h-3M8 12h8",
};

/** Kepala kartu: ikon berbingkai lembut, judul, satu baris penjelas. */
export function Kepala({ ikon, judul, sub }: { ikon: string; judul: string; sub: string }) {
  return (
    <div className="al-head">
      <span className="al-head-ic"><Ic d={ikon} /></span>
      <div>
        <h2>{judul}</h2>
        <p>{sub}</p>
      </div>
    </div>
  );
}

/**
 * Penjelasan yang dapat dibuka-tutup.
 *
 * Keterangan panjang menutupi alatnya dan membuat halaman melelahkan dibaca.
 * Yang tampak hanyalah satu baris inti; alasan dan latar belakangnya
 * disembunyikan di sini sampai pengguna memang menginginkannya.
 */
export function Rinci({
  judul = "Kenapa ini penting?", children,
}: { judul?: string; children: React.ReactNode }) {
  return (
    <details className="al-rinci">
      <summary>{judul}</summary>
      <div className="al-rinci-isi">{children}</div>
    </details>
  );
}
