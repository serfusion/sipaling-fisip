"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MaintenanceState } from "@/lib/maintenance";

// Kalimat yang bergantian setiap beberapa detik. Sengaja ditanam di kode,
// bukan di database: yang perlu diubah Super Admin hanya pesan utamanya.
const JOKES = [
  "Kucingnya bilang “meow”. Kira-kira artinya: sabar sebentar ya.",
  "Admin sedang mengelus server supaya cepat pulih.",
  "Jangan di-refresh terus, nanti kucingnya bangun.",
  "Teknisi sudah dikirim. Kucingnya belum.",
  "Tenang, bukan HP Anda yang rusak.",
  "Data Anda aman, cuma sedang ikut rebahan.",
];

// Kotak potong animasi. Kanvas aslinya 3840×2160 dengan banyak ruang kosong;
// angka ini hasil pengukuran kotak gambar kucingnya + sedikit ruang napas.
const CAT_VIEWBOX = "867 244 2015 1654";

export default function MaintenanceScreen({
  state,
  preview = false,
}: {
  state: MaintenanceState;
  preview?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [animFailed, setAnimFailed] = useState(false);
  const [joke, setJoke] = useState(0);

  useEffect(() => {
    let animation: { destroy: () => void; goToAndStop: (v: number, f?: boolean) => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        // Diimpor saat dibutuhkan saja (±168 KB) supaya tidak ikut membebani
        // halaman lain. Build "light" = perender SVG tanpa expression, dan
        // animasi kucing ini memang tidak memakai expression/mask/efek.
        const mod = await import("lottie-web/build/player/lottie_light");
        const lottie = mod.default ?? (mod as unknown as typeof mod.default);
        if (cancelled || !stageRef.current) return;

        animation = lottie.loadAnimation({
          container: stageRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          path: "/animations/sleeping-cat.json",
          rendererSettings: {
            viewBoxSize: CAT_VIEWBOX,
            viewBoxOnly: true,
            preserveAspectRatio: "xMidYMid meet",
          },
        });

        // Hormati pengguna yang mematikan animasi di setelan perangkatnya:
        // kucingnya tetap tampil, hanya tidak bergerak.
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
          animation.goToAndStop(45, true);
        }
      } catch {
        // Jaringan/berkas animasi bermasalah — halaman tetap harus tampil.
        if (!cancelled) setAnimFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setJoke((n) => (n + 1) % JOKES.length), 4500);
    return () => window.clearInterval(timer);
  }, []);

  const year = new Date().getFullYear();

  return (
    <div className="mt-shell">
      {preview && (
        <div className="mt-preview-bar">
          <b>PRATINJAU</b>
          <span>Beginilah tampilan portal saat mode maintenance menyala.</span>
          <Link href="/dashboard">← Kembali ke dashboard</Link>
        </div>
      )}

      <div className="mt-card">
        <div className="mt-kicker">🐾 SiPaling FISIP sedang istirahat</div>

        <div className="mt-stage" data-fallback={animFailed ? "1" : undefined}>
          <div className="mt-stage-anim" ref={stageRef} aria-hidden="true" />
          <div className="mt-stage-fallback" aria-hidden="true">🐈💤</div>
        </div>

        <p className="mt-lead">{state.lead}</p>

        {/*
          Kata "maintenance" dirakit tangan supaya titik pada huruf "i" bisa
          menjadi elemen tersendiri — dan, bila Super Admin mengizinkan,
          menjadi pintu rahasia ke halaman login.

          Batangnya memakai glif "ı" (i tanpa titik) dari font yang sama, jadi
          bentuk dan ketebalannya persis huruf aslinya; padding kecil pada
          batang mengganti selisih lebar "ı" vs "i". Titiknya dikunci ke garis
          dasar lewat .mt-i-anchor (kotak 0×0 dengan vertical-align: baseline),
          lalu diletakkan 0,6em di atasnya — hasil pengukuran langsung pada
          Plus Jakarta Sans 800, yang titik "i"-nya berbentuk KOTAK, bukan
          bulat.
        */}
        {/* aria-label memastikan pembaca layar dan mesin telusur tetap
            menerima kata "maintenance" yang utuh, walau batang huruf i-nya
            memakai glif tanpa titik. */}
        <h1 className="mt-word" aria-label="maintenance">
          ma
          <span className="mt-i">
            <span className="mt-i-anchor">
              {state.secretDoor ? (
                <Link
                  href="/login"
                  className="mt-i-dot"
                  // Tetap rahasia: tidak masuk urutan Tab, tidak dibacakan
                  // pembaca layar, tanpa tooltip. Pintu resmi tetap /login.
                  aria-hidden="true"
                  tabIndex={-1}
                />
              ) : (
                <span className="mt-i-dot" />
              )}
            </span>
            <span className="mt-i-stem">ı</span>
          </span>
          ntenance
        </h1>

        <p className="mt-msg">{state.message}</p>

        <div className="mt-rotate">
          <span key={joke}>{JOKES[joke]}</span>
        </div>

        {state.note && <div className="mt-note">⏳ {state.note}</div>}

        <div className="mt-foot">
          <b>SiPaling FISIP</b>
          <span>Fakultas Ilmu Sosial dan Ilmu Politik</span>
          <span>© {year}</span>
        </div>
      </div>
    </div>
  );
}
