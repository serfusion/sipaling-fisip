import type { Metadata } from "next";
import { cakrawalaAccess } from "@/lib/cakrawala-store";
import DramaApp from "@/app/drama/drama-app";
import KunciDrama from "@/app/drama/kunci";

export const metadata: Metadata = {
  title: "Theater Drama · Alat · SiPaling FISIP",
  description:
    "Drama pendek dari sembilan sumber sekaligus, untuk pemegang kode Cakrawala. Cari judulnya, pilih episodenya, langsung jalan.",
  // Tab ini dibuka dengan kode, dan isinya milik platform lain. Tidak ada
  // gunanya ia muncul di hasil pencarian — yang datang dari sana hanya akan
  // mendarat di layar kunci.
  robots: { index: false, follow: false },
};

// Selalu dihitung ulang: yang menentukan isinya cookie pembuka, dan cookie
// itu berbeda pada tiap pengunjung.
export const dynamic = "force-dynamic";

// ============================================================
// THEATER DRAMA — tab pertama menu Alat
//
// Layar yang SAMA dengan Nonton Drama di sipalingfisip.online, bukan salinan
// berkasnya: daftar, pencarian, rincian, pemutar, dan jalur /api/drama yang
// dipakai keduanya satu. Nonton Drama di menu Cakrawala tetap ada seperti
// sebelumnya; tab ini pintu kedua yang tidak menuntut pindah domain.
//
// Bedanya justru di situ. Tab ini tinggal di domain portal, domain yang sama
// dengan Cakrawala, jadi cookie pembukanya pun sama: siapa pun yang sudah
// membuka Cakrawala di perangkat ini langsung menonton tanpa mengetik kode
// lagi — dan tidak bergantung pada domain drama yang terpasang di Vercel.
// ============================================================

export default async function Page() {
  // Gerbangnya di server, bukan di peramban. Bila hanya disembunyikan lewat
  // state React, seluruh daftar judul tetap ikut terkirim ke pengunjung yang
  // belum membuka kunci.
  const akses = await cakrawalaAccess();
  if (!akses.allowed) return <KunciDrama portal="" habis={akses.habis} dalamAlat />;
  return <DramaApp merek={{ judul: "Theater Drama", sub: "Untuk pemegang kode Cakrawala" }} />;
}
