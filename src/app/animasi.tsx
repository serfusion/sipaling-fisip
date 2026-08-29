"use client";

// ============================================================
// ANIMASI LOTTIE — pemutar kecil yang dipakai bersama
//
// Berkas animasinya ada di /public/animations. Pemutarnya diimpor saat
// dibutuhkan saja supaya halaman yang tidak memakai animasi tidak ikut
// menanggung ukurannya.
// ============================================================

import { useEffect, useRef, useState } from "react";

export type NamaAnimasi = "flying-book" | "digital";

type Props = {
  nama: NamaAnimasi;
  /** Kelas pembungkus; ukuran diatur dari CSS pemanggilnya. */
  className?: string;
  /** Lambang yang tampil bila berkas animasi gagal dimuat. */
  cadangan?: string;
};

export default function Animasi({ nama, className = "", cadangan = "✦" }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    let animation: { destroy: () => void; goToAndStop: (v: number, f?: boolean) => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        // Build "light" = perender SVG tanpa expression. Kedua animasi di
        // sini memang tidak memakai expression, mask, maupun matte.
        const mod = await import("lottie-web/build/player/lottie_light");
        const lottie = mod.default ?? (mod as unknown as typeof mod.default);
        if (cancelled || !stageRef.current) return;

        animation = lottie.loadAnimation({
          container: stageRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          path: `/animations/${nama}.json`,
          rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
        });

        // Hormati setelan perangkat yang mematikan animasi: gambarnya tetap
        // tampil, hanya berhenti pada satu bingkai.
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
          animation.goToAndStop(0, true);
        }
      } catch {
        if (!cancelled) setGagal(true);
      }
    })();

    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, [nama]);

  return (
    <div className={`anim ${className}`} aria-hidden="true">
      {gagal ? <span className="anim-cadangan">{cadangan}</span> : <div className="anim-stage" ref={stageRef} />}
    </div>
  );
}
