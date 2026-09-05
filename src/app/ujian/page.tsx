import { redirect } from "next/navigation";

// Alamat lama. Ujian pindah ke situs CBT tersendiri, tetapi tautan yang
// sudah terlanjur dibagikan ke grup kelas TIDAK boleh mati — kode ujiannya
// ikut dibawa supaya mahasiswa tetap mendarat pada ujian yang benar.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const kode = typeof params.kode === "string" ? params.kode : "";
  redirect(kode ? `/cbt/ujian?kode=${encodeURIComponent(kode)}` : "/cbt/ujian");
}
