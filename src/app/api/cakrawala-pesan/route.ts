import QRCode from "qrcode";
import { db } from "@/db";
import { cakrawalaOrders } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { jadikanDinamis, periksaQris } from "@/lib/qris";
import { paketDari, rapikanNomorPesanan, MENIT_BAYAR } from "@/lib/paket-cakrawala";
import {
  ambilPesanan, buatPesanan, lunaskanPesanan, mutasiTerakhir, sapuPesananKedaluwarsa,
} from "@/lib/pesanan-store";
import { getCurrentProfile } from "@/lib/supabase-server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { explainServerError } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PESANAN AKSES CAKRAWALA
//
// POST   buat pesanan, balas dengan QRIS dinamis bernominal unik
// GET    tanyakan status satu pesanan; kodenya keluar setelah lunas
// PATCH  Super Admin menandai lunas, kodenya terbit sendiri
//
// QRIS statisnya TIDAK ditaruh di dalam kode. Ia dibaca dari environment
// supaya dapat diganti tanpa deploy ulang — merchant bisa berganti, dan
// mengganti tujuan uang seharusnya tidak menuntut rilis baru.
function qrisStatis() {
  return (process.env.QRIS_STATIS || "").trim();
}

export async function POST(request: Request) {
  // Tiap pesanan memakan satu penanda dari persediaan yang cuma 999. Tanpa
  // pembatas, satu orang dapat menghabiskannya dalam hitungan detik dan
  // menutup pembelian untuk semua orang.
  const batas = rateLimit({ request, name: "cakrawala-pesan", limit: 6, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const asal = qrisStatis();
    if (!asal) {
      return Response.json(
        { success: false, message: "Pembelian belum dibuka. Hubungi pengelola." },
        { status: 503 },
      );
    }
    // Diperiksa sebelum pesanan dibuat, bukan sesudah. Kalau QRIS-nya salah
    // pasang, lebih baik tidak ada pesanan sama sekali daripada ada pesanan
    // yang QR-nya tidak pernah bisa dipindai.
    const sah = periksaQris(asal);
    if (!sah.sah) {
      console.error("QRIS_STATIS tidak sah:", sah.alasan);
      return Response.json(
        { success: false, message: "Pembelian belum dapat diproses. Hubungi pengelola." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { paket?: string; nama?: string; kontak?: string };
    const paket = paketDari(body.paket);
    if (!paket) return Response.json({ success: false, message: "Paket tidak dikenali." }, { status: 400 });

    const bersih = (nilai: unknown) =>
      typeof nilai === "string" ? nilai.replace(/\s+/g, " ").trim().slice(0, 120) : "";

    const pesan = await buatPesanan({ paket, nama: bersih(body.nama), kontak: bersih(body.kontak) });
    if (!pesan.ok) return Response.json({ success: false, message: pesan.pesan }, { status: 409 });

    const qr = jadikanDinamis(asal, pesan.amount);
    if (!qr.ok) {
      console.error("konversi QRIS gagal:", qr.pesan);
      return Response.json(
        { success: false, message: "QR pembayaran belum dapat dibuat. Coba lagi." },
        { status: 500 },
      );
    }

    // QR digambar di server: pustaka penggambarnya tidak perlu ikut terkirim
    // ke peramban, dan SVG tetap tajam di layar mana pun tanpa berkas gambar.
    let svg = "";
    try {
      svg = await QRCode.toString(qr.qris, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 1,
        width: 320,
      });
    } catch (error) {
      console.error("gambar QR", error);
      return Response.json(
        { success: false, message: "QR pembayaran belum dapat digambar. Coba lagi." },
        { status: 500 },
      );
    }

    return Response.json({
      success: true,
      pesanan: {
        orderCode: pesan.orderCode,
        paket: paket.id,
        namaPaket: paket.nama,
        harga: paket.harga,
        nominal: pesan.amount,
        hari: paket.hari,
        expiresAt: pesan.expiresAt.toISOString(),
        menit: MENIT_BAYAR,
        // Rentetan QRIS mentahnya SENGAJA tidak ikut dikirim. Peramban hanya
        // butuh gambarnya, dan mengirim rentetannya berarti keterangan
        // merchant tersedia untuk disalin-tempel dari alat pengembang oleh
        // siapa pun yang membuka halaman beli. Membaca ulang QR dari gambar
        // memang tetap mungkin, tetapi itu pekerjaan yang jauh berbeda
        // daripada menyorot teks.
        svg,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("buat pesanan cakrawala", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Pesanan belum dapat dibuat.") },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const nomor = rapikanNomorPesanan(params.get("pesanan"));

  // Daftar seluruh pesanan: khusus Super Admin, untuk panel penandaan lunas.
  if (!nomor) {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "super_admin") {
      return Response.json({ success: false, message: "Nomor pesanan wajib diisi." }, { status: 400 });
    }
    await sapuPesananKedaluwarsa();
    // Yang mengaku sudah membayar naik ke puncak, apa pun tanggalnya. Merekalah
    // satu-satunya baris di tabel ini yang ada orang sedang menatap layar
    // menunggunya; sisanya dapat menunggu sampai besok.
    const daftar = await db
      .select()
      .from(cakrawalaOrders)
      .orderBy(desc(cakrawalaOrders.claimedAt), desc(cakrawalaOrders.createdAt))
      .limit(100);
    const jumlah = await db
      .select({
        lunas: sql<number>`count(*) filter (where status = 'lunas')::int`,
        menunggu: sql<number>`count(*) filter (where status = 'menunggu')::int`,
        rupiah: sql<number>`coalesce(sum(amount) filter (where status = 'lunas'), 0)::int`,
      })
      .from(cakrawalaOrders);
    // Mutasi terakhir ikut dikirim. Tanpa ini, jembatan dari ponsel yang
    // salah pasang dan jembatan yang benar tetapi belum ada yang membayar
    // terlihat sama persis dari panel: sunyi — padahal yang pertama perlu
    // diperbaiki hari ini juga.
    let mutasi: Awaited<ReturnType<typeof mutasiTerakhir>> = [];
    try {
      mutasi = await mutasiTerakhir(15);
    } catch (error) {
      console.error("baca mutasi terakhir", error);
    }
    return Response.json({ success: true, daftar, ringkasan: jumlah[0], mutasi });
  }

  // Menanyakan satu pesanan. Terbuka untuk umum — halaman beli menanyakannya
  // berulang kali sambil menunggu — tetapi hanya menjawab nomor yang tepat,
  // dan nomornya dibuat acak justru supaya tidak dapat diterka.
  const batas = rateLimit({ request, name: "cakrawala-lihat", limit: 120, windowMs: 10 * 60_000 });
  if (!batas.ok) return tooManyRequests(batas.retryAfter);

  try {
    const pesanan = await ambilPesanan(nomor);
    if (!pesanan) {
      return Response.json({ success: false, message: "Pesanan tidak ditemukan." }, { status: 404 });
    }
    const lewat = pesanan.status === "menunggu" && pesanan.expiresAt.getTime() < Date.now();
    return Response.json({
      success: true,
      pesanan: {
        orderCode: pesanan.orderCode,
        namaPaket: pesanan.packageName,
        nominal: pesanan.amount,
        hari: pesanan.days,
        status: lewat ? "kedaluwarsa" : pesanan.status,
        expiresAt: pesanan.expiresAt.toISOString(),
        // Supaya halaman yang dibuka ulang tahu bahwa klaimnya sudah tercatat
        // dan tidak menyodorkan tombolnya untuk kedua kali.
        diklaim: Boolean(pesanan.claimedAt),
        // Kode akses HANYA ikut terkirim setelah pesanannya lunas.
        kode: pesanan.status === "lunas" ? pesanan.accessCode : null,
      },
    });
  } catch (error: unknown) {
    console.error("lihat pesanan cakrawala", error);
    return Response.json({ success: false, message: "Pesanan belum dapat dibaca." }, { status: 500 });
  }
}

// HANYA SUPER ADMIN. Menandai lunas — dan kodenya terbit sendiri.
export async function PATCH(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    return Response.json(
      { success: false, message: "Hanya Super Admin yang dapat menandai pesanan lunas." },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as { pesanan?: string; aksi?: string };
    const nomor = rapikanNomorPesanan(body.pesanan);
    if (!nomor) return Response.json({ success: false, message: "Nomor pesanan wajib diisi." }, { status: 400 });

    const pesanan = await ambilPesanan(nomor);
    if (!pesanan) return Response.json({ success: false, message: "Pesanan tidak ditemukan." }, { status: 404 });

    if (body.aksi === "batal") {
      if (pesanan.status === "lunas") {
        return Response.json(
          { success: false, message: "Pesanan yang sudah lunas tidak dapat dibatalkan." },
          { status: 400 },
        );
      }
      await db
        .update(cakrawalaOrders)
        .set({ status: "batal" })
        .where(and(eq(cakrawalaOrders.orderCode, nomor), sql`${cakrawalaOrders.status} <> 'lunas'`));
      return Response.json({ success: true, pesan: "Pesanan dibatalkan." });
    }

    const paket = paketDari(pesanan.packageId);
    if (!paket) return Response.json({ success: false, message: "Paket pesanan ini sudah tidak ada." }, { status: 400 });

    const hasil = await lunaskanPesanan(nomor, "panel", paket);
    if (!hasil.ok) return Response.json({ success: false, message: hasil.pesan }, { status: 500 });

    return Response.json({
      success: true,
      kode: hasil.accessCode,
      pesan: hasil.baru
        ? `Kode ${hasil.accessCode} diterbitkan dan langsung muncul di layar pembelinya.`
        : `Pesanan ini sudah lunas sebelumnya. Kodenya tetap ${hasil.accessCode}.`,
    });
  } catch (error: unknown) {
    console.error("tandai lunas cakrawala", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Pesanan belum dapat ditandai lunas.") },
      { status: 500 },
    );
  }
}
