// ============================================================
// "SAYA SUDAH MEMBAYAR" — klaim dari pembeli
//
// Yang PERLU dikatakan terus terang: menekan tombol bukan bukti membayar.
// Kalau tombolnya sendiri menerbitkan kode, Cakrawala menjadi gratis bagi
// siapa pun yang mau menekannya, dan tidak ada satu pun cara membedakan
// pembeli sungguhan dari orang yang iseng.
//
// Jadi yang dikerjakan di sini adalah semua yang DAPAT dikerjakan tanpa
// mengarang bukti:
//
//   1. Diperiksa ulang ke catatan mutasi. Pemberitahuan dari ponsel pemilik
//      dapat tiba pada saat yang canggung — pesanannya baru saja kedaluwarsa,
//      basis datanya sedang tersendat — dan bila ternyata uangnya memang
//      sudah tercatat, kodenya terbit SEKARANG JUGA tanpa siapa pun menandai
//      apa pun. Inilah jalur yang paling sering menyelamatkan keadaan.
//   2. Bila belum ada catatannya, pesanannya dihidupkan kembali dan masa
//      berlakunya diperpanjang, supaya nominal uniknya tidak didaur ulang
//      sementara uangnya masih di jalan.
//   3. Pesanannya naik ke puncak panel Super Admin dengan penanda mencolok.
// ============================================================
import { rapikanNomorPesanan, paketDari } from "@/lib/paket-cakrawala";
import {
  ambilPesanan, klaimPesanan, lunaskanPesanan, mutasiUntukNominal,
} from "@/lib/pesanan-store";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Longgar, tetapi ada. Menekan tombolnya berkali-kali tidak menambah apa
  // pun, dan yang menekannya ratusan kali sedang mencari celah.
  const batas = rateLimit({ request, name: "cakrawala-klaim", limit: 20, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const body = (await request.json()) as { pesanan?: string };
    const nomor = rapikanNomorPesanan(body.pesanan);
    if (!nomor) {
      return Response.json({ success: false, message: "Nomor pesanan belum diisi." }, { status: 400 });
    }

    const pesanan = await ambilPesanan(nomor);
    if (!pesanan) {
      return Response.json({ success: false, message: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    // Sudah lunas sebelum tombolnya ditekan: kodenya langsung dikembalikan.
    if (pesanan.status === "lunas" && pesanan.accessCode) {
      return Response.json({ success: true, keadaan: "lunas", kode: pesanan.accessCode });
    }
    if (pesanan.status === "batal") {
      return Response.json({ success: false, message: "Pesanan ini sudah dibatalkan." }, { status: 400 });
    }

    // Langkah yang membuat tombol ini bukan sekadar hiasan: cocokkan dengan
    // pemberitahuan uang masuk yang sudah tercatat.
    const mutasi = await mutasiUntukNominal(pesanan.amount);
    if (mutasi) {
      const paket = paketDari(pesanan.packageId);
      if (paket) {
        const terbit = await lunaskanPesanan(pesanan.orderCode, "klaim-mutasi", paket);
        if (terbit.ok) {
          return Response.json({ success: true, keadaan: "lunas", kode: terbit.accessCode });
        }
      }
    }

    const diklaim = await klaimPesanan(nomor);
    if (!diklaim) {
      // Bersamaan dengan pelunasan dari jalur lain. Dibaca ulang supaya
      // pembelinya menerima kodenya, bukan pesan "coba lagi".
      const ulang = await ambilPesanan(nomor);
      if (ulang?.status === "lunas" && ulang.accessCode) {
        return Response.json({ success: true, keadaan: "lunas", kode: ulang.accessCode });
      }
      return Response.json({ success: false, message: "Klaim belum dapat dicatat. Coba lagi." }, { status: 500 });
    }

    return Response.json({
      success: true,
      keadaan: "diperiksa",
      pesanan: nomor,
      // Batas waktunya ikut dikirim supaya layar pembeli dapat berhenti
      // menghitung mundur lima belas menit yang sudah tidak berlaku lagi.
      expiresAt: diklaim.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("klaim cakrawala", error);
    return Response.json({ success: false, message: "Klaim belum dapat diproses." }, { status: 500 });
  }
}
