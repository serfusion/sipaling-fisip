// Pengaturan dan SAKLAR Outreach Ultramailer.
//
// Bandingkan dengan /api/maintenance: pola wewenangnya sama persis, dan itu
// disengaja. Keduanya adalah tombol yang akibatnya menyebar ke luar sistem —
// yang satu menutup portal bagi seluruh mahasiswa, yang satu lagi mengirim
// surat atas nama fakultas ke alamat orang yang tidak pernah meminta.

import { normalkanOus } from "@/lib/outreach";
import { periksaKesiapan, penyediaTerpasang } from "@/lib/outreach-kirim";
import { gerbangOus } from "@/lib/outreach-gerbang";
import { catatAudit, pastikanTemplateBawaan, ringkasanOus, tulisOus } from "@/lib/outreach-store";
import { explainServerError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const gerbang = await gerbangOus("lihat");
  if (!gerbang.ok) return gerbang.jawab;
  const { state, profil } = gerbang.ctx;

  try {
    // Naskah bawaan disalin saat panel pertama dibuka, bukan lewat migrasi
    // SQL: isinya panjang, dan berkas migrasi yang memuat empat naskah HTML
    // hampir pasti salah disalin oleh yang menjalankannya.
    await pastikanTemplateBawaan(profil.fullName);
  } catch (galat) {
    // Tabelnya boleh saja belum dibuat. Panel tetap terbuka dan menampilkan
    // pesan migrasi dari pemanggilan berikutnya, bukan gagal seluruhnya.
    console.error("siapkan template outreach", galat);
  }

  let ringkasan = null;
  try {
    ringkasan = await ringkasanOus();
  } catch (galat) {
    console.error("ringkasan outreach", galat);
  }

  return Response.json({
    success: true,
    state,
    kesiapan: periksaKesiapan(state),
    penyedia: penyediaTerpasang(),
    ringkasan,
    // Dipakai panel untuk memutuskan apa yang boleh ditampilkan. Peran dikirim
    // apa adanya; yang menegakkan wewenang tetap server pada tiap permintaan.
    peran: profil.role,
    email: profil.email,
  });
}

// HANYA SUPER ADMIN.
export async function PUT(request: Request) {
  const gerbang = await gerbangOus("atur");
  if (!gerbang.ok) return gerbang.jawab;
  const { pelaku, state: sebelum } = gerbang.ctx;

  try {
    const badan = await request.json();
    const baru = normalkanOus({ ...sebelum, ...badan });

    // Mode simulasi tidak boleh dimatikan selama masih ada penghalang.
    // Menolaknya di sini, bukan hanya menyembunyikan tombolnya di layar:
    // layar dapat dilewati, dan yang dipertaruhkan adalah reputasi domain
    // kampus yang butuh berbulan-bulan untuk dipulihkan.
    if (!baru.simulasi) {
      const kesiapan = periksaKesiapan(baru);
      if (!kesiapan.siap) {
        return Response.json(
          {
            success: false,
            message: `Mode simulasi belum boleh dimatikan. ${kesiapan.penghalang[0]}`,
            kesiapan,
          },
          { status: 400 },
        );
      }
    }

    const tersimpan = await tulisOus(baru);
    await catatAudit({
      pelaku,
      tindakan: "pengaturan.ubah",
      jenis: "pengaturan",
      keterangan: {
        saklar: { dari: sebelum.enabled, jadi: tersimpan.enabled },
        simulasi: { dari: sebelum.simulasi, jadi: tersimpan.simulasi },
        hariMaks: tersimpan.hariMaks,
        dosen: tersimpan.dosen.length,
      },
    });

    return Response.json({
      success: true,
      state: tersimpan,
      kesiapan: periksaKesiapan(tersimpan),
    });
  } catch (galat: unknown) {
    console.error("simpan pengaturan outreach", galat);
    return Response.json(
      { success: false, message: explainServerError(galat, "Pengaturan Outreach belum tersimpan.") },
      { status: 500 },
    );
  }
}
