import type { Metadata } from "next";
import UjianApp from "../../ujian/ujian-app";
import { rapikanKodeTautan } from "@/lib/tautan-cbt";

// ============================================================
// TAUTAN PENDEK UJIAN — /cbt/u/K7M2QX
//
// Bentuk inilah yang dibagikan ke grup kelas, dicetak sebagai QR pada poster
// ruang ujian, dan dibacakan di depan kelas ketika salinannya gagal terkirim.
// "?kode=" yang panjang gagal pada ketiga hal itu.
//
// Ia MERENDER ujiannya langsung, bukan mengalihkan ke /cbt/ujian. Satu
// lompatan pengalihan terdengar sepele sampai tiga puluh ponsel membukanya
// serentak pada jaringan kampus, lima menit sebelum ujian dimulai.
// ============================================================

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kode: string }>;
}): Promise<Metadata> {
  const { kode } = await params;
  const bersih = rapikanKodeTautan(kode);
  return {
    title: bersih ? `Ujian ${bersih} · SiPaling CBT` : "Kerjakan Ujian · SiPaling CBT",
    description: "Masuk dengan nama dan NIM. Tanpa membuat akun.",
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  // Kode yang tidak masuk akal dikirim sebagai tali kosong, dan layar ujiannya
  // membuka pintu "masukkan kode" seperti biasa. Alamat yang salah ketik lebih
  // baik mendarat pada kotak kode daripada pada halaman 404.
  return <UjianApp kodeAwal={rapikanKodeTautan(kode)} />;
}
