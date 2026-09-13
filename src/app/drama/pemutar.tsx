"use client";

// ============================================================
// PEMUTAR EPISODE
//
// Satu episode kerap datang dengan beberapa tautan sekaligus: daftar putar
// HLS, berkas mp4 cadangan, kadang beberapa mutu. Pemutar ini mencobanya
// BERURUTAN — tautan yang gagal tidak berakhir sebagai layar hitam, melainkan
// sebagai satu percobaan berikutnya. Itulah bedanya dengan memilih satu
// tautan di muka: tautan pertama sering yang paling cepat, dan sama seringnya
// yang lebih dulu mati.
//
// hls.js dimuat dengan impor dinamis, bukan di atas berkas. Pustakanya besar,
// dan sebagian besar pengunjung portal tidak pernah membuka menu ini; memuat
// -nya di muka berarti seluruh portal ikut menanggung berat yang hanya
// dipakai satu menu. Peramban yang sudah dapat memutar HLS sendiri (Safari,
// iOS) bahkan tidak memuatnya sama sekali.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { alamatPenerus } from "@/lib/drama-aliran";
import type { Aliran } from "@/lib/drama-baca";

type Props = {
  aliran: Aliran[];
  platform: string;
  /** Platform yang potongan videonya berwadah khusus; lihat catatan di rute aliran. */
  wadahTersandi?: boolean;
  onSelesai?: () => void;
};

export function Pemutar({ aliran, platform, wadahTersandi = false, onSelesai }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Keadaan pemutar disimpan BERSAMA episode yang berlaku baginya, bukan
  // disetel ulang oleh effect saat episodenya berganti. Episode baru berarti
  // mulai lagi dari tautan pertama — dan menurunkannya saat menggambar
  // membuat itu terjadi seketika, tanpa satu gambar pun sempat memakai
  // keadaan episode sebelumnya.
  const kunciAliran = aliran.map((item) => item.url).join("|");
  const [simpanan, setSimpanan] = useState({ untuk: kunciAliran, urutan: 0, gagal: false, memuat: true });
  const keadaan =
    simpanan.untuk === kunciAliran ? simpanan : { untuk: kunciAliran, urutan: 0, gagal: false, memuat: true };
  const { urutan, gagal, memuat } = keadaan;

  const pilihan = aliran[urutan] ?? null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !pilihan) return;

    const sumber = alamatPenerus(pilihan.url, platform, pilihan.lewatHulu);
    let hidup = true;
    let lepaskan: (() => void) | null = null;

    /** Coba tautan berikutnya; bila habis, barulah menyerah. */
    function berikutnya() {
      if (!hidup) return;
      setSimpanan((sekarang) => {
        const dasar = sekarang.untuk === kunciAliran ? sekarang : keadaan;
        if (dasar.urutan + 1 < aliran.length) {
          return { ...dasar, untuk: kunciAliran, urutan: dasar.urutan + 1, memuat: true };
        }
        return { ...dasar, untuk: kunciAliran, gagal: true, memuat: false };
      });
    }

    function tandaiSiap() {
      if (!hidup) return;
      setSimpanan((sekarang) => {
        const dasar = sekarang.untuk === kunciAliran ? sekarang : keadaan;
        return { ...dasar, untuk: kunciAliran, memuat: false };
      });
    }

    const butuhHls = pilihan.hls || sumber.includes(".m3u8");
    const bisaSendiri = video.canPlayType("application/vnd.apple.mpegurl") !== "";

    if (butuhHls && !bisaSendiri) {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (!hidup) return;
          if (!Hls.isSupported()) {
            video.src = sumber;
            return;
          }
          const hls = new Hls({ enableWorker: true });
          hls.loadSource(sumber);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            tandaiSiap();
            void video.play().catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (_peristiwa, data) => {
            if (!data.fatal) return;
            hls.destroy();
            berikutnya();
          });
          lepaskan = () => hls.destroy();
        })
        .catch(() => berikutnya());
    } else {
      video.src = sumber;
      void video.play().catch(() => {});
    }

    function siap() {
      tandaiSiap();
    }
    function salah() {
      berikutnya();
    }

    video.addEventListener("canplay", siap);
    video.addEventListener("error", salah);

    return () => {
      hidup = false;
      video.removeEventListener("canplay", siap);
      video.removeEventListener("error", salah);
      lepaskan?.();
      // Sumber dikosongkan supaya unduhan episode lama berhenti begitu
      // pengunjung berpindah — di ponsel, itu kuota yang benar-benar terpakai.
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilihan?.url, pilihan?.lewatHulu, platform, aliran.length, kunciAliran]);

  if (!aliran.length) {
    return (
      <div className="dr-kosong dr-kosong-video">
        <p>Episode ini tidak menyertakan tautan video.</p>
        <small>Biasanya berarti episodenya berbayar di aplikasi aslinya, atau sumbernya sedang bermasalah.</small>
      </div>
    );
  }

  return (
    <div className="dr-pemutar">
      <video
        ref={videoRef}
        className="dr-video"
        controls
        playsInline
        preload="metadata"
        onEnded={onSelesai}
        onWaiting={() => setSimpanan({ ...keadaan, memuat: true })}
        onPlaying={() => setSimpanan({ ...keadaan, memuat: false })}
      />

      {memuat && !gagal && <span className="dr-muat" aria-hidden="true" />}

      {gagal && (
        <div className="dr-kosong dr-kosong-video">
          <p>Video ini tidak dapat diputar di sini.</p>
          <small>
            {wadahTersandi
              ? "Potongan video platform ini dibungkus wadah khusus buatan aplikasinya, dan pembukanya tidak disertakan di sini. Coba platform lain untuk judul serupa."
              : "Sumbernya menolak atau tautannya sudah kedaluwarsa. Coba episode lain, atau buka lagi beberapa saat lagi."}
          </small>
        </div>
      )}

      {aliran.length > 1 && (
        <div className="dr-mutu" role="group" aria-label="Pilih sumber video">
          {aliran.map((item, nomor) => (
            <button
              key={item.url}
              type="button"
              className={`dr-mutu-btn ${nomor === urutan ? "on" : ""}`}
              onClick={() => setSimpanan({ untuk: kunciAliran, urutan: nomor, gagal: false, memuat: true })}
            >
              {item.mutu || (item.hls ? `HLS ${nomor + 1}` : `Sumber ${nomor + 1}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
