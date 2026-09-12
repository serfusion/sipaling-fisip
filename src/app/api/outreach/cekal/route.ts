// Daftar cekal: alamat yang tidak boleh dikirimi lagi, selamanya.
//
// Daftar ini hanya boleh TUMBUH secara wajar. Pengeluaran sebuah alamat
// darinya dibatasi Super Admin, dan alasannya bukan birokrasi: alamat masuk
// ke sini karena orangnya menekan "berhenti langganan", karena suratnya
// memantul keras, atau karena ia melaporkan kita sebagai spam. Mengeluarkan
// alamat semacam itu berarti mengirim lagi kepada orang yang sudah menolak —
// yang merupakan hal paling merusak yang dapat dilakukan sistem ini terhadap
// reputasi domainnya sendiri.

import { ALASAN_CEKAL, rapikanEmail, type AlasanCekal } from "@/lib/outreach";
import { gerbangOus } from "@/lib/outreach-gerbang";
import { catatAudit, daftarCekal, hapusCekal, tambahCekal } from "@/lib/outreach-store";
import { explainServerError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const gerbang = await gerbangOus("lihat");
  if (!gerbang.ok) return gerbang.jawab;
  try {
    return Response.json({ success: true, suppression: await daftarCekal(200) });
  } catch (galat: unknown) {
    console.error("daftar cekal outreach", galat);
    return Response.json(
      { success: false, message: explainServerError(galat, "Daftar cekal belum dapat dimuat.") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const gerbang = await gerbangOus("pakai");
  if (!gerbang.ok) return gerbang.jawab;
  const { pelaku } = gerbang.ctx;

  try {
    const badan = (await request.json()) as { email?: string; alasan?: string; catatan?: string };
    const email = rapikanEmail(badan.email);
    if (!email) {
      return Response.json({ success: false, message: "Alamat email tidak sah." }, { status: 400 });
    }
    const alasan = (ALASAN_CEKAL as readonly string[]).includes(String(badan.alasan))
      ? (badan.alasan as AlasanCekal)
      : "manual";

    await tambahCekal({ email, alasan, sumber: pelaku.nama, catatan: badan.catatan?.slice(0, 500) ?? null });
    await catatAudit({ pelaku, tindakan: "cekal.tambah", jenis: "cekal", keterangan: { email, alasan } });
    return Response.json({ success: true });
  } catch (galat: unknown) {
    console.error("tambah cekal outreach", galat);
    return Response.json(
      { success: false, message: explainServerError(galat, "Alamat belum dapat dicekal.") },
      { status: 500 },
    );
  }
}

// HANYA SUPER ADMIN — lihat catatan di kepala berkas.
export async function DELETE(request: Request) {
  const gerbang = await gerbangOus("atur");
  if (!gerbang.ok) return gerbang.jawab;
  const { pelaku } = gerbang.ctx;

  try {
    const alamat = new URL(request.url);
    const email = rapikanEmail(alamat.searchParams.get("email"));
    if (!email) {
      return Response.json({ success: false, message: "Alamat email tidak sah." }, { status: 400 });
    }
    await hapusCekal(email);
    await catatAudit({ pelaku, tindakan: "cekal.hapus", jenis: "cekal", keterangan: { email } });
    return Response.json({ success: true });
  } catch (galat: unknown) {
    console.error("hapus cekal outreach", galat);
    return Response.json(
      { success: false, message: explainServerError(galat, "Alamat belum dapat dikeluarkan dari daftar cekal.") },
      { status: 500 },
    );
  }
}
