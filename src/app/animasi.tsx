"use client";

// ============================================================
// ANIMASI LOTTIE — pemutar kecil yang dipakai bersama
//
// Berkas animasinya ada di /public/animations. Pemutarnya diimpor saat
// dibutuhkan saja supaya halaman yang tidak memakai animasi tidak ikut
// menanggung ukurannya.
//
// DUA HAL YANG MENJAGA HALAMAN TETAP RINGAN DI PONSEL:
//
// 1. Animasi baru dibuat ketika kotaknya masuk layar, dan DIJEDA begitu
//    keluar layar. Sembilan kartu menu Cakrawala memakai animasi yang sama;
//    bila semuanya berjalan bersamaan, separuh main thread ponsel kelas bawah
//    habis untuk menggambar animasi yang tidak sedang dilihat siapa pun.
//    Hasil ukuran pada throttle CPU 6× (setara ponsel kelas bawah):
//    1 animasi ±17% main thread, 3 animasi ±28%, 9 animasi ±54%.
//
// 2. Berkas JSON-nya diambil SEKALI per nama animasi, lalu dipakai bersama
//    seluruh kotak. Tanpa ini, sembilan kartu berarti sembilan permintaan.
// ============================================================

import { useEffect, useRef, useState } from "react";

export type NamaAnimasi = "flying-book" | "digital" | "books";

type Props = {
  nama: NamaAnimasi;
  /** Kelas pembungkus; ukuran diatur dari CSS pemanggilnya. */
  className?: string;
  /** Lambang yang tampil bila berkas animasi gagal dimuat. */
  cadangan?: string;
};

// Satu permintaan per nama animasi, dipakai bersama semua kotak di halaman.
const berkas = new Map<NamaAnimasi, Promise<unknown>>();

function ambilBerkas(nama: NamaAnimasi) {
  let janji = berkas.get(nama);
  if (!janji) {
    janji = fetch(`/animations/${nama}.json`).then((response) => {
      if (!response.ok) throw new Error(`animasi ${nama} tidak dapat dimuat`);
      return response.json();
    });
    // Bila gagal, permintaan berikutnya boleh mencoba lagi.
    janji.catch(() => berkas.delete(nama));
    berkas.set(nama, janji);
  }
  return janji;
}

export default function Animasi({ nama, className = "", cadangan = "✦" }: Props) {
  const kotakRef = useRef<HTMLDivElement | null>(null);
  const panggungRef = useRef<HTMLDivElement | null>(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    const kotak = kotakRef.current;
    if (!kotak) return;

    type Pemutar = { destroy: () => void; play: () => void; pause: () => void; goToAndStop: (v: number, f?: boolean) => void };
    let animasi: Pemutar | null = null;
    let dibatalkan = false;
    let sedangDimuat = false;
    let tampak = false;
    // Perangkat yang mematikan animasi tetap melihat gambarnya, hanya diam.
    const diam = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    async function siapkan() {
      if (animasi || sedangDimuat || dibatalkan) return;
      sedangDimuat = true;
      try {
        // Build "light" = perender SVG tanpa expression. Ketiga animasi di
        // sini tidak memakai expression, mask, maupun matte.
        const [mod, data] = await Promise.all([
          import("lottie-web/build/player/lottie_light"),
          ambilBerkas(nama),
        ]);
        const lottie = mod.default ?? (mod as unknown as typeof mod.default);
        if (dibatalkan || !panggungRef.current) return;

        animasi = lottie.loadAnimation({
          container: panggungRef.current,
          renderer: "svg",
          loop: true,
          autoplay: !diam,
          // Lottie mengubah data yang diberikan kepadanya, jadi tiap kotak
          // mendapat salinannya sendiri dari satu berkas yang sama.
          animationData: JSON.parse(JSON.stringify(data)),
          rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
        }) as unknown as Pemutar;

        // Kotaknya bisa saja sudah tergulung keluar layar selama pemutar dan
        // berkasnya dimuat; jangan biarkan animasi berjalan tanpa penonton.
        if (diam) animasi.goToAndStop(0, true);
        else if (!tampak) animasi.pause();
      } catch {
        if (!dibatalkan) setGagal(true);
      } finally {
        sedangDimuat = false;
      }
    }

    // Tanpa IntersectionObserver (peramban lama), animasinya langsung jalan.
    if (typeof IntersectionObserver === "undefined") {
      tampak = true;
      void siapkan();
      return () => {
        dibatalkan = true;
        animasi?.destroy();
      };
    }

    const pengamat = new IntersectionObserver(
      (entries) => {
        tampak = entries.some((entry) => entry.isIntersecting);
        if (tampak) {
          if (!animasi) void siapkan();
          else if (!diam) animasi.play();
        } else {
          animasi?.pause();
        }
      },
      // Mulai sedikit sebelum masuk layar supaya tidak terlihat "baru hidup".
      { rootMargin: "200px" },
    );
    pengamat.observe(kotak);

    return () => {
      dibatalkan = true;
      pengamat.disconnect();
      animasi?.destroy();
    };
  }, [nama]);

  return (
    <div className={`anim ${className}`} ref={kotakRef} aria-hidden="true">
      {gagal ? <span className="anim-cadangan">{cadangan}</span> : <div className="anim-stage" ref={panggungRef} />}
    </div>
  );
}
