"use client";

// ============================================================
// MEDIA PADA SOAL — gambar dan video
//
// Dosen boleh mengunggah berkasnya, boleh juga menempelkan tautan. Keduanya
// berakhir sebagai satu tautan, dan berkas ini yang memutuskan bagaimana
// tautan itu ditampilkan.
//
// TAUTAN YANG DITEMPEL DOSEN ADALAH MASUKAN DARI LUAR, dan diperlakukan
// begitu: hanya http(s) yang dipasang, dan hanya segelintir tuan rumah yang
// boleh masuk sebagai <iframe>. Sisanya dicoba sebagai <video> biasa —
// yang gagal memutar hanya menampilkan kotak kosong, sedangkan iframe dari
// tuan rumah sembarangan adalah halaman asing yang berjalan di dalam layar
// ujian.
// ============================================================

import { useState } from "react";
import type { Media } from "@/lib/cbt";

/** Tuan rumah yang boleh dipasang sebagai iframe, beserta cara menyematkannya. */
function alamatSemat(url: string): string | null {
  let alamat: URL;
  try {
    alamat = new URL(url);
  } catch {
    return null;
  }
  if (alamat.protocol !== "https:" && alamat.protocol !== "http:") return null;
  const host = alamat.hostname.replace(/^www\./, "").toLowerCase();

  // YouTube. Dipakai bentuk -nocookie supaya penonton tidak ikut dilacak;
  // mahasiswa sedang ujian, bukan sedang menonton.
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = alamat.searchParams.get("v");
    if (id) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
    const potong = alamat.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,20})/);
    if (potong) return `https://www.youtube-nocookie.com/embed/${potong[1]}`;
    return null;
  }
  if (host === "youtu.be") {
    const id = alamat.pathname.slice(1).split("/")[0];
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === "youtube-nocookie.com") return alamat.toString();

  if (host === "vimeo.com") {
    const id = alamat.pathname.split("/").filter(Boolean)[0];
    return /^\d+$/.test(id || "") ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === "player.vimeo.com") return alamat.toString();

  // Google Drive: tautan /file/d/<id>/view diubah menjadi /preview.
  if (host === "drive.google.com") {
    const potong = alamat.pathname.match(/\/file\/d\/([\w-]+)/);
    return potong ? `https://drive.google.com/file/d/${potong[1]}/preview` : null;
  }

  return null;
}

export default function MediaSoal({ media }: { media: Media }) {
  const [gagal, setGagal] = useState(false);

  if (!media || !media.jenis || !media.url) return null;

  const keterangan = media.keterangan ? (
    <figcaption className="ck-media-ket">{media.keterangan}</figcaption>
  ) : null;

  // Tautan yang mati TIDAK boleh menyisakan kotak rusak selebar layar.
  // Mahasiswa yang menatapnya di tengah ujian tidak dapat membedakan "gambar
  // ini memang tidak penting" dari "saya kehilangan bagian soalnya"; satu
  // baris jujur menjawab itu, dan pengawas dapat menindaklanjutinya.
  if (gagal) {
    return (
      <p className="ck-media-gagal">
        Media soal ini tidak dapat dimuat{media.keterangan ? ` (${media.keterangan})` : ""}.
        Beri tahu pengawas bila soalnya tidak dapat dikerjakan tanpa media tersebut.
      </p>
    );
  }

  if (media.jenis === "gambar") {
    return (
      <figure className="ck-media">
        {/* next/image tidak dipakai: tautannya dari dosen, tuan rumahnya tidak
            dapat didaftarkan lebih dulu, dan pengoptimalnya justru akan
            menolak gambar yang sah. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.url}
          alt={media.keterangan || "Gambar soal"}
          loading="lazy"
          onError={() => setGagal(true)}
        />
        {keterangan}
      </figure>
    );
  }

  const semat = alamatSemat(media.url);
  if (semat) {
    return (
      <figure className="ck-media ck-media-semat">
        <iframe
          src={semat}
          title={media.keterangan || "Video soal"}
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
        {keterangan}
      </figure>
    );
  }

  return (
    <figure className="ck-media">
      <video src={media.url} controls preload="metadata" playsInline onError={() => setGagal(true)}>
        Peramban ini tidak dapat memutar videonya.
      </video>
      {keterangan}
    </figure>
  );
}
