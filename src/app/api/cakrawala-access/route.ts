import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/supabase-server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  CAKRAWALA_COOKIE,
  CAKRAWALA_COOKIE_MAX_AGE,
  CAKRAWALA_MAX_CODES,
  buatKodeCakrawala,
  normalizeCakrawala,
  rapikanKode,
  type CakrawalaCode,
} from "@/lib/cakrawala";
import { readCakrawalaState, verifyCakrawalaCode, writeCakrawalaState } from "@/lib/cakrawala-store";
import {
  AKUN_COOKIE,
  akunAktif,
  akunDariToken,
  akunDariWa,
  pemilikKode,
  rapikanWa,
  samarkanWa,
  tukarkanKode,
  umurCookieAkun,
  type Akun,
} from "@/lib/akun-cakrawala";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Status kunci boleh dibaca siapa saja — halaman utama memakainya untuk
// menandai menu Cakrawala. Daftar kodenya TIDAK pernah ikut terkirim kecuali
// yang meminta adalah Super Admin.
export async function GET() {
  const state = await readCakrawalaState();
  const langganan = await langgananSaya();
  const profile = await getCurrentProfile();
  if (profile?.role === "super_admin") {
    return Response.json({ success: true, locked: state.locked, codes: state.codes, langganan });
  }
  return Response.json({ success: true, locked: state.locked, langganan });
}

/**
 * Langganan milik pengunjung ini, bila cookie sesinya masih membawa akun.
 *
 * Nomornya disamarkan sebelum keluar. Yang meminta memang pemiliknya, tetapi
 * jawaban ini juga terbaca oleh apa pun yang kebetulan membaca layar atau
 * lalu lintas jaringannya — dan nomor WhatsApp utuh tidak perlu ada di sana.
 */
async function langgananSaya() {
  try {
    const jar = await cookies();
    const token = jar.get(AKUN_COOKIE)?.value ?? "";
    if (!token) return null;
    const akun = await akunDariToken(token);
    if (!akun) return null;
    return {
      nomor: samarkanWa(akun.whatsapp),
      nama: akun.name,
      sampai: akun.expiresAt.toISOString(),
      aktif: akunAktif(akun),
    };
  } catch (error) {
    // Ketiadaan keterangan langganan tidak boleh menggagalkan pembacaan kunci.
    console.error("baca langganan cakrawala", error);
    return null;
  }
}

// Membuka kunci dengan kode. Terbuka untuk umum, karena memang inilah pintu
// masuknya — dibatasi lajunya supaya kode tidak dapat ditebak beruntun.
//
// Sejak langganan menempel pada NOMOR WHATSAPP, pintu ini melakukan dua hal
// sekaligus: memeriksa kodenya, dan mendaftarkan nomor yang menukarkannya.
// Nomor itulah yang membuat perpanjangan punya tempat menempel, dan yang
// membuat aplikasi nanti mengenali pelanggan yang sama dengan web.
export async function POST(request: Request) {
  const limit = rateLimit({ request, name: "cakrawala-unlock", limit: 10, windowMs: 10 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  try {
    const body = (await request.json()) as { code?: string; whatsapp?: string; nama?: string };
    const kode = rapikanKode(body.code);
    if (!kode) {
      return Response.json({ success: false, message: "Kode akses belum diisi." }, { status: 400 });
    }

    const wa = rapikanWa(body.whatsapp);
    if (!wa) {
      return Response.json(
        {
          success: false,
          message: "Nomor WhatsApp belum benar. Tulis seperti 0812xxxxxxx atau 62812xxxxxxx.",
        },
        { status: 400 },
      );
    }
    const nama = String(body.nama ?? "").trim().slice(0, 120) || undefined;

    // Penguncian kode diperiksa LEBIH DULU, sebelum verifyCakrawalaCode
    // memotong kuota pemakaiannya. Orang yang menebak kode milik orang lain
    // tidak boleh menghabiskan jatah perangkat pemiliknya hanya dengan mencoba.
    const pemilik = await pemilikKode(kode);

    if (pemilik && pemilik !== wa) {
      return Response.json(
        {
          success: false,
          message:
            "Kode ini sudah terdaftar pada nomor WhatsApp lain. Satu kode hanya untuk satu nomor.",
        },
        { status: 400 },
      );
    }

    // Nomor yang sama masuk lagi — ponsel baru, peramban baru, atau cookie
    // yang terhapus. Sesinya dikembalikan tanpa menambah hari dan tanpa
    // memotong kuota: harinya sudah diberikan pada penukaran yang pertama.
    if (pemilik === wa) {
      const akun = await akunDariWa(wa);
      if (!akun) {
        return Response.json(
          { success: false, message: "Akun untuk kode ini tidak ditemukan. Hubungi pengelola." },
          { status: 400 },
        );
      }
      if (!akunAktif(akun)) {
        return Response.json(
          {
            success: false,
            message: "Langganan pada nomor ini sudah berakhir. Perpanjang dulu untuk masuk lagi.",
          },
          { status: 400 },
        );
      }
      await pasangSesi(akun, kode);
      return Response.json({
        success: true,
        message: "Selamat datang kembali di Cakrawala.",
        sampai: akun.expiresAt.toISOString(),
        baru: false,
      });
    }

    // Penukaran pertama. Baru di sini kodenya diperiksa dan kuotanya dipotong.
    const hasil = await verifyCakrawalaCode(kode);
    if (!hasil.ok) {
      return Response.json({ success: false, message: hasil.message }, { status: 400 });
    }

    const tukar = await tukarkanKode(hasil.code, wa, hasil.hari, nama);
    if (!tukar.ok) {
      return Response.json({ success: false, message: tukar.pesan }, { status: 400 });
    }

    await pasangSesi(tukar.akun, hasil.code, hasil.umurCookie);
    return Response.json({
      success: true,
      message: "Kode diterima. Selamat datang di Cakrawala.",
      sampai: tukar.sampai.toISOString(),
      baru: tukar.baru,
    });
  } catch (error: unknown) {
    console.error("buka kunci cakrawala", error);
    return Response.json({ success: false, message: "Kode belum dapat diperiksa. Coba lagi." }, { status: 500 });
  }
}

/**
 * Pasang cookie sesi akun, dan cookie kode lama di sampingnya.
 *
 * Keduanya dipasang dengan sengaja. Kunci akun adalah jalan masuk yang
 * sebenarnya, tetapi cookie kode masih dipakai buku kas Catatan Uang untuk
 * mengenali pemiliknya; menghapusnya sekarang akan memutus orang dari
 * catatannya sendiri.
 */
async function pasangSesi(akun: Akun, kode: string, umurKode?: number) {
  const jar = await cookies();
  const aman = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  jar.set(AKUN_COOKIE, akun.token, { ...aman, maxAge: umurCookieAkun(akun) });
  jar.set(CAKRAWALA_COOKIE, kode, {
    ...aman,
    // Umurnya mengikuti masa berlaku kodenya, bukan selalu tiga puluh hari.
    // Paket tiga hari yang cookie-nya hidup sebulan membuat penggunanya
    // dilempar keluar tanpa penjelasan di tengah jalan.
    maxAge: umurKode ?? CAKRAWALA_COOKIE_MAX_AGE,
  });
}

// HANYA SUPER ADMIN. Menyalakan/mematikan kunci, membuat kode, dan
// menonaktifkan atau menghapus kode yang sudah ada.
export async function PUT(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    return Response.json(
      { success: false, message: "Kunci Cakrawala hanya dapat diatur oleh Super Admin." },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as {
      action?: "toggle" | "generate" | "disable" | "enable" | "remove";
      locked?: boolean;
      label?: string;
      maxUses?: number;
      hariBerlaku?: number;
      code?: string;
    };
    const state = await readCakrawalaState();
    const action = body.action || "toggle";
    let codes: CakrawalaCode[] = state.codes;
    let locked = state.locked;
    let created: string | null = null;

    if (action === "toggle") {
      locked = body.locked !== false;
    } else if (action === "generate") {
      if (codes.length >= CAKRAWALA_MAX_CODES) {
        return Response.json(
          {
            success: false,
            message: `Jumlah kode sudah mencapai batas ${CAKRAWALA_MAX_CODES}. Hapus kode lama sebelum membuat yang baru.`,
          },
          { status: 400 },
        );
      }
      // Masa berlaku boleh ditentukan sendiri; 0 atau kosong berarti tanpa
      // batas waktu, seperti perilaku sebelum paket berbayar ada.
      const hariBerlaku =
        Number.isInteger(body.hariBerlaku) && Number(body.hariBerlaku) > 0
          ? Math.min(Number(body.hariBerlaku), 3650)
          : 0;

      // Diulang bila kebetulan tabrakan dengan kode yang sudah ada.
      let kode = buatKodeCakrawala();
      for (let attempt = 0; attempt < 5 && codes.some((item) => item.code === kode); attempt++) {
        kode = buatKodeCakrawala();
      }
      created = kode;
      codes = [
        {
          code: kode,
          label: typeof body.label === "string" ? body.label : "",
          active: true,
          maxUses: Number.isInteger(body.maxUses) && Number(body.maxUses) > 0 ? Number(body.maxUses) : 0,
          uses: 0,
          // Kode yang dibuat sendiri dari panel tidak berbatas waktu. Yang
          // berbatas hanya kode yang lahir dari pembelian paket, dan itu
          // diterbitkan lewat jalur pesanan, bukan di sini.
          expiresAt: hariBerlaku > 0
            ? new Date(Date.now() + hariBerlaku * 24 * 60 * 60_000).toISOString()
            : null,
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
          orderCode: null,
        },
        ...codes,
      ];
    } else {
      const target = rapikanKode(body.code);
      if (!target || !codes.some((item) => item.code === target)) {
        return Response.json({ success: false, message: "Kode tidak ditemukan." }, { status: 404 });
      }
      if (action === "remove") {
        codes = codes.filter((item) => item.code !== target);
      } else {
        codes = codes.map((item) =>
          item.code === target ? { ...item, active: action === "enable" } : item,
        );
      }
    }

    const next = normalizeCakrawala({ locked, codes });
    await writeCakrawalaState(next);
    return Response.json({ success: true, locked: next.locked, codes: next.codes, created });
  } catch (error: unknown) {
    console.error("atur kunci cakrawala", error);
    return Response.json(
      { success: false, message: "Pengaturan Cakrawala belum tersimpan. Coba simpan ulang." },
      { status: 500 },
    );
  }
}
