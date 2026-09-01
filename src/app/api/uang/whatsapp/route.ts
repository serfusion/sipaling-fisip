// ============================================================
// JALUR WHATSAPP
//
// Pintu utama "cukup di WhatsApp saja": pemiliknya mengirim
// "-beli nasi uduk 10k" ke nomor bot, dan catatannya sudah ada di web,
// di aplikasi, dan di panel Cakrawala sebelum ia sempat membukanya.
//
// Dua cara pasang, keduanya dilayani berkas ini:
//
//   RESMI (Meta WhatsApp Cloud API)
//     WHATSAPP_VERIFY_TOKEN  kata sandi saat mendaftarkan webhook
//     WHATSAPP_APP_SECRET    untuk memeriksa tanda tangan tiap kiriman
//     WHATSAPP_TOKEN         token pengirim balasan
//     WHATSAPP_PHONE_ID      nomor pengirimnya
//
//   GERBANG (Fonnte, Wablas, Watzap, dan sebangsanya)
//     WA_GATEWAY_SECRET      kata sandi bersama, dikirim gerbangnya
//     WA_GATEWAY_KIRIM_URL   alamat untuk mengirim balasan (opsional)
//     WA_GATEWAY_TOKEN       tokennya (opsional)
//
// TIDUR TANPA KUNCI: tanpa salah satu di antaranya, jalur ini menjawab 404
// untuk siapa pun.
// ============================================================
import { createHmac } from "node:crypto";
import { layaniPesan } from "@/lib/uang/percakapan";
import { pernahDikerjakan, tandaCocok } from "@/lib/uang/pesan-masuk";
import {
  bacaMuatanGerbang,
  bacaMuatanMeta,
  balasLewatGerbang,
  balasLewatMeta,
  uraiBadan,
  type PesanWa,
} from "@/lib/uang/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KANAL = "whatsapp";

function kunciResmi() {
  return {
    verify: (process.env.WHATSAPP_VERIFY_TOKEN || "").trim(),
    rahasia: (process.env.WHATSAPP_APP_SECRET || "").trim(),
    token: (process.env.WHATSAPP_TOKEN || "").trim(),
  };
}

function kunciGerbang() {
  return (process.env.WA_GATEWAY_SECRET || "").trim();
}

/**
 * Pendaftaran webhook Meta: mereka memanggil dengan GET dan menunggu
 * tantangannya dikembalikan apa adanya. Hanya itu isi jalur GET ini.
 */
export async function GET(request: Request) {
  const { verify } = kunciResmi();
  if (!verify) return new Response("Tidak tersedia.", { status: 404 });

  const alamat = new URL(request.url);
  const mode = alamat.searchParams.get("hub.mode");
  const kirim = alamat.searchParams.get("hub.verify_token") || "";
  const tantangan = alamat.searchParams.get("hub.challenge") || "";

  if (mode === "subscribe" && tandaCocok(kirim, verify)) {
    return new Response(tantangan, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response("Tanda tangan tidak sah.", { status: 401 });
}

export async function POST(request: Request) {
  const resmi = kunciResmi();
  const gerbang = kunciGerbang();
  if (!resmi.verify && !gerbang) {
    return Response.json({ success: false, message: "Tidak tersedia." }, { status: 404 });
  }

  const jenis = request.headers.get("content-type") || "";
  let mentah = "";
  let muatan: Record<string, unknown> | null = null;

  if (jenis.toLowerCase().includes("multipart/form-data")) {
    // Sebagian gerbang mengirim sebagai unggahan formulir. Badannya tidak
    // dibaca sebagai teks karena tanda tangan Meta tidak pernah datang dalam
    // bentuk ini, jadi tidak ada yang perlu dihitung ulang dari aslinya.
    try {
      const form = await request.formData();
      muatan = Object.fromEntries(
        [...form.entries()].map(([kunci, nilai]) => [kunci, typeof nilai === "string" ? nilai : ""]),
      );
    } catch {
      return Response.json({ ok: true });
    }
  } else {
    try {
      mentah = await request.text();
    } catch {
      return Response.json({ ok: true });
    }
    if (mentah.length > 64_000) {
      return Response.json({ success: false, message: "Permintaan terlalu besar." }, { status: 413 });
    }
    muatan = uraiBadan(jenis, mentah);
  }

  if (!muatan) {
    return Response.json({ success: false, message: "Muatan tidak terbaca." }, { status: 400 });
  }

  // ---------- Siapa yang mengirim, dan apakah ia berhak ----------
  const bentukMeta = "entry" in muatan;
  let pesan: PesanWa | null = null;
  let lewatMeta = false;

  if (bentukMeta && resmi.verify) {
    // Tanda tangan Meta menutup satu-satunya celah yang tersisa: tanpa itu,
    // siapa pun yang tahu alamat ini dapat mengarang pesan atas nama nomor
    // orang lain dan menulisi bukunya.
    if (resmi.rahasia) {
      const kirim = (request.headers.get("x-hub-signature-256") || "").replace(/^sha256=/, "");
      const hitung = createHmac("sha256", resmi.rahasia).update(mentah, "utf8").digest("hex");
      if (!tandaCocok(kirim, hitung)) {
        return Response.json({ success: false, message: "Tanda tangan tidak sah." }, { status: 401 });
      }
    } else {
      console.error("whatsapp: WHATSAPP_APP_SECRET belum diisi, kiriman tidak dapat diperiksa");
      return Response.json({ success: false, message: "Belum siap." }, { status: 503 });
    }
    pesan = bacaMuatanMeta(muatan);
    lewatMeta = true;
  } else if (gerbang) {
    // Kata sandinya boleh datang dari tiga tempat, dan itu memang disengaja.
    // Kebanyakan gerbang WhatsApp murah TIDAK menyediakan tempat menambahkan
    // header sendiri; yang selalu bisa hanyalah menempelkannya pada alamat
    // webhooknya. Menuntut header berarti separuh gerbang tidak dapat dipakai
    // sama sekali.
    //
    // Harganya jujur: kata sandi di dalam alamat ikut tercatat di log server
    // dan log gerbangnya. Karena itu ia hanya membuka pencatatan uang, tidak
    // pernah membuka bacaannya, dan buku yang dituju tetap ditentukan nomor
    // pengirimnya, bukan oleh kata sandi ini.
    let dariAlamat = "";
    try {
      const alamat = new URL(request.url);
      dariAlamat = alamat.searchParams.get("secret") || alamat.searchParams.get("kunci") || "";
    } catch {
      dariAlamat = "";
    }

    const kirim =
      request.headers.get("x-uang-secret") ||
      request.headers.get("x-webhook-secret") ||
      dariAlamat ||
      (typeof muatan.secret === "string" ? muatan.secret : "") ||
      (typeof muatan.rahasia === "string" ? muatan.rahasia : "");

    if (!tandaCocok(kirim, gerbang)) {
      return Response.json({ success: false, message: "Tanda tangan tidak sah." }, { status: 401 });
    }
    pesan = bacaMuatanGerbang(muatan);
  } else {
    return Response.json({ success: false, message: "Tidak tersedia." }, { status: 404 });
  }

  // Kiriman yang bukan pesan teks (status terkirim, gambar, stiker) dijawab
  // 200 supaya penyedianya berhenti mengulanginya.
  if (!pesan) return Response.json({ ok: true });
  if (pernahDikerjakan(KANAL, pesan.id)) return Response.json({ ok: true });

  const balas = lewatMeta ? balasLewatMeta : balasLewatGerbang;

  try {
    const jawab = await layaniPesan({
      kanal: KANAL,
      externalId: pesan.nomor,
      teks: pesan.teks,
      label: pesan.label,
    });
    await balas(pesan.nomor, jawab.teks);
  } catch (error) {
    console.error("whatsapp catatan uang", error);
    await balas(
      pesan.nomor,
      "Ada yang bermasalah di sisi server. Catatannya belum tersimpan, coba kirim ulang sebentar lagi.",
    );
  }

  // SELALU 200, dengan alasan yang sama seperti Telegram: balasan selain itu
  // membuat kirimannya diulang, dan yang terulang adalah pencatatan uang.
  return Response.json({ ok: true });
}
