"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ic } from "@/app/alat/ikon";
import { DAFTAR_ALAT } from "./daftar-alat";

/**
 * Baris tab menu Alat.
 *
 * Tab yang menyala dibaca dari alamat, bukan dari state. Tiap alat memang
 * halaman sendiri, jadi alamat itulah satu-satunya sumber kebenaran — dan
 * tautan yang dibagikan ke teman langsung membuka tab yang benar.
 */
export function TabAlat() {
  const jalur = usePathname();

  return (
    <nav className="pk-tab" aria-label="Pilih alat">
      {DAFTAR_ALAT.map((alat) => {
        const nyala = jalur === alat.href || jalur.startsWith(`${alat.href}/`);
        return (
          <Link
            key={alat.id}
            href={alat.href}
            className={`pk-tab-btn ${nyala ? "on" : ""}`}
            aria-current={nyala ? "page" : undefined}
          >
            <span className="pk-tab-ic"><Ic d={alat.ikon} /></span>
            <span className="pk-tab-teks">
              <b>{alat.label}</b>
              <small>{alat.sub}</small>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
