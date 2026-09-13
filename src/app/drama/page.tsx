import type { Metadata } from "next";
import { headers } from "next/headers";
import { cakrawalaAccess } from "@/lib/cakrawala-store";
import { adalahHostDrama } from "@/lib/situs-drama";
import { hostPortalBawaan } from "@/lib/situs-cbt";
import DramaApp from "./drama-app";
import KunciDrama from "./kunci";

export const metadata: Metadata = {
  title: "Nonton Drama · SiPaling FISIP",
  description:
    "Drama pendek dari sembilan sumber sekaligus, bonus untuk pemegang kode Cakrawala. Cari judulnya, pilih episodenya, langsung jalan.",
  // Situs ini dibuka dengan kode, dan isinya milik platform lain. Tidak ada
  // gunanya ia muncul di hasil pencarian — yang datang dari sana hanya akan
  // mendarat di layar kunci.
  robots: { index: false, follow: false },
};

// Selalu dihitung ulang: yang menentukan isinya cookie pembuka, dan cookie
// itu berbeda pada tiap pengunjung.
export const dynamic = "force-dynamic";

export default async function Page() {
  // Gerbangnya di server, bukan di peramban. Bila hanya disembunyikan lewat
  // state React, seluruh daftar judul tetap ikut terkirim ke pengunjung yang
  // belum membuka kunci.
  const akses = await cakrawalaAccess();

  if (!akses.allowed) {
    // Tautan balik ke portal ditulis lengkap HANYA bila halaman ini sedang
    // dibuka dari domain drama. Di localhost dan pratayang penyebaran,
    // keduanya satu situs, dan alamat lengkap ke domain produksi di sana
    // berarti melempar yang sedang mengembangkan keluar dari mesinnya sendiri.
    const tuan = (await headers()).get("host");
    const portal = adalahHostDrama(tuan) ? `https://${hostPortalBawaan()}` : "";
    return <KunciDrama portal={portal} habis={akses.habis} />;
  }

  return <DramaApp />;
}
