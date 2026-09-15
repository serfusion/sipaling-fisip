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
// TETAPI BERPINDAH TAUTAN BUKAN LANGKAH PERTAMA. Sebagian besar kegagalan
// HLS sifatnya sesaat: satu potongan yang gagal diunduh, atau penyangga yang
// tersendat. Pustaka hls.js dapat pulih sendiri dari keduanya bila diminta —
// dan pemutar yang langsung pindah ke tautan berikutnya membuang tautan yang
// sebenarnya masih baik, lalu kehabisan tautan, lalu menampilkan pesan gagal
// untuk gangguan yang sudah lewat. Urutannya di sini: pulihkan dulu, pindah
// belakangan, menyerah paling akhir.
//
// hls.js dimuat dengan impor dinamis, bukan di atas berkas. Pustakanya besar,
// dan sebagian besar pengunjung portal tidak pernah membuka menu ini; memuat
// -nya di muka berarti seluruh portal ikut menanggung berat yang hanya
// dipakai satu menu. Peramban yang sudah dapat memutar HLS sendiri (Safari,
// iOS) bahkan tidak memuatnya sama sekali.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { alamatPenerus } from "@/lib/drama-aliran";
import type { Aliran } from "@/lib/drama-baca";

type Props = {
  aliran: Aliran[];
  platform: string;
  onSelesai?: () => void;
};

/**
 * Berapa kali sebuah tautan boleh dipulihkan sebelum ditinggalkan.
 *
 * Tiga, dan angkanya bukan selera: satu untuk potongan yang gagal sekali, satu
 * untuk jaringan yang goyah sebentar, satu sisa. Yang gagal lebih dari itu
 * bukan gangguan sesaat lagi, dan menahannya lebih lama berarti pengunjung
 * menatap pemutar diam tanpa tahu apa yang sedang terjadi.
 */
const BATAS_PULIH = 3;

type Keadaan = {
  /** Episode yang keadaan ini berlaku baginya, dikenali dari daftar tautannya. */
  untuk: string;
  /** Tautan ke berapa yang sedang dicoba. */
  urutan: number;
  /** Berapa kali percobaan ini sudah dimulai ulang, untuk memaksa muat ulang. */
  ulang: number;
  gagal: boolean;
  memuat: boolean;
};

function awal(untuk: string, urutan = 0): Keadaan {
  return { untuk, urutan, ulang: 0, gagal: false, memuat: true };
}

export function Pemutar({ aliran, platform, onSelesai }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Keadaan pemutar disimpan BERSAMA episode yang berlaku baginya, bukan
  // disetel ulang oleh effect saat episodenya berganti. Episode baru berarti
  // mulai lagi dari tautan pertama — dan menurunkannya saat menggambar
  // membuat itu terjadi seketika, tanpa satu gambar pun sempat memakai
  // keadaan episode sebelumnya.
  const kunciAliran = aliran.map((item) => item.url).join("|");
  const [simpanan, setSimpanan] = useState<Keadaan>(() => awal(kunciAliran));
  const keadaan = simpanan.untuk === kunciAliran ? simpanan : awal(kunciAliran);
  const { urutan, ulang, gagal, memuat } = keadaan;

  const pilihan = aliran[urutan] ?? null;

  /** Ubah keadaan tanpa pernah menimpa keadaan episode yang sudah berganti. */
  const ubah = useCallback(
    (ganti: (dasar: Keadaan) => Keadaan) => {
      setSimpanan((sekarang) => ganti(sekarang.untuk === kunciAliran ? sekarang : awal(kunciAliran)));
    },
    [kunciAliran],
  );

  const cobaLagi = useCallback(() => {
    // Mulai lagi dari tautan pertama, bukan dari tautan yang barusan gagal:
    // yang pertama biasanya yang terbaik, dan yang membuatnya gagal tadi
    // sering sudah tidak ada lagi saat pengunjung menekan tombol ini.
    //
    // `ulang` naik supaya keadaannya benar-benar berbeda dari sebelumnya.
    // Tanpa itu, menekan tombol ini sesudah tautan PERTAMA yang gagal tidak
    // mengubah apa pun — dan tombol yang tidak mengubah apa pun adalah tombol
    // yang tampak rusak.
    ubah((dasar) => ({ ...awal(kunciAliran), ulang: dasar.ulang + 1 }));
  }, [kunciAliran, ubah]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !pilihan) return;

    const sumber = alamatPenerus(pilihan.url, platform, pilihan.lewatHulu);
    let hidup = true;
    let lepaskan: (() => void) | null = null;
    let sudahPulih = 0;

    /** Coba tautan berikutnya; bila habis, barulah menyerah. */
    function berikutnya() {
      if (!hidup) return;
      ubah((dasar) =>
        dasar.urutan + 1 < aliran.length
          ? { ...dasar, untuk: kunciAliran, urutan: dasar.urutan + 1, ulang: 0, memuat: true }
          : { ...dasar, untuk: kunciAliran, gagal: true, memuat: false },
      );
    }

    function tandaiSiap() {
      if (!hidup) return;
      ubah((dasar) => ({ ...dasar, untuk: kunciAliran, memuat: false }));
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
          const hls = new Hls({
            enableWorker: true,
            // Daftar putar yang lewat penerus kita boleh dicoba ulang beberapa
            // kali sebelum dianggap mati; bawaannya menyerah terlalu cepat
            // untuk sambungan ponsel.
            manifestLoadingMaxRetry: 3,
            levelLoadingMaxRetry: 3,
            fragLoadingMaxRetry: 4,
            fragLoadingRetryDelay: 800,
          });
          hls.loadSource(sumber);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            tandaiSiap();
            void video.play().catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (_peristiwa, data) => {
            if (!data.fatal) return;

            // Dua jenis kegagalan yang pustakanya memang dapat pulih sendiri,
            // dan keduanya jenis yang paling sering terjadi. Yang ketiga
            // tidak dapat, dan hanya yang ketiga yang layak menghabiskan
            // sebuah tautan.
            if (sudahPulih < BATAS_PULIH && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              sudahPulih += 1;
              hls.startLoad();
              return;
            }
            if (sudahPulih < BATAS_PULIH && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              sudahPulih += 1;
              hls.recoverMediaError();
              return;
            }

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
  }, [pilihan?.url, pilihan?.lewatHulu, platform, aliran.length, kunciAliran, ulang, ubah]);

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
        onWaiting={() => ubah((dasar) => ({ ...dasar, memuat: true }))}
        onPlaying={() => ubah((dasar) => ({ ...dasar, memuat: false }))}
      />

      {memuat && !gagal && <span className="dr-muat" aria-hidden="true" />}

      {gagal && (
        <div className="dr-kosong dr-kosong-video">
          <p>Video ini tidak dapat diputar di sini.</p>
          <small>
            Sumbernya menolak atau tautannya sudah kedaluwarsa. Coba lagi sebentar lagi, atau pilih episode lain.
          </small>
          <div className="dr-kosong-aksi">
            <button type="button" className="dr-mini" onClick={cobaLagi}>
              Coba lagi
            </button>
          </div>
        </div>
      )}

      {aliran.length > 1 && (
        <div className="dr-mutu" role="group" aria-label="Pilih sumber video">
          {aliran.map((item, nomor) => (
            <button
              key={item.url}
              type="button"
              className={`dr-mutu-btn ${nomor === urutan ? "on" : ""}`}
              onClick={() => ubah(() => awal(kunciAliran, nomor))}
            >
              {item.mutu || (item.hls ? `HLS ${nomor + 1}` : `Sumber ${nomor + 1}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
