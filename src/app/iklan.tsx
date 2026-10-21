"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { adalahHostCbt } from "@/lib/situs-cbt";

const ZONA_IKLAN = "12084733";
const SKRIP_IKLAN = "https://nap5k.com/tag.min.js";

/** Halaman CBT — pintu masuk dan layar ujian — tidak boleh memuat iklan. */
function halamanCbt(pathname: string): boolean {
  if (typeof window !== "undefined" && adalahHostCbt(window.location.hostname)) return true;
  return pathname === "/cbt" || pathname.startsWith("/cbt/") || pathname === "/ujian" || pathname.startsWith("/ujian/");
}

/**
 * Iklan In-Page Push, dipasang di seluruh situs KECUALI CBT.
 *
 * Penjaganya dua lapis: komponen ini tidak menyisipkan skrip di halaman CBT,
 * dan CSP halaman CBT tetap yang ketat (lihat headers() di next.config.ts),
 * sehingga skrip iklan yang lolos pun ditolak peramban di sana.
 *
 * Skrip iklan tidak dapat dicabut setelah termuat. Bila pengguna berpindah
 * dari portal ke /cbt lewat navigasi klien, halaman dimuat ulang penuh agar
 * layar ujian bersih dari iklan.
 */
export default function Iklan() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    const terpasang = document.getElementById("iklan-inpage-push");
    if (halamanCbt(pathname)) {
      if (terpasang) window.location.reload();
      return;
    }
    if (terpasang) return;
    const s = document.createElement("script");
    s.id = "iklan-inpage-push";
    s.dataset.zone = ZONA_IKLAN;
    s.src = SKRIP_IKLAN;
    s.async = true;
    document.body.appendChild(s);
  }, [pathname]);

  return null;
}
