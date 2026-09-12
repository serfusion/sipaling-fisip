// ============================================================
// OUS — PERAKIT SURAT DAN PENGANTAR KE PENYEDIA
//
// Dua pekerjaan, dan keduanya sengaja dipisahkan:
//
//   rakitSurat()  — menyusun satu surat utuh dari naskah kampanye + data
//                   penerima. Tidak menyentuh jaringan sama sekali, sehingga
//                   hasilnya dapat diperiksa dalam uji tanpa mengirim apa pun.
//   kirimSurat()  — menyerahkannya ke API penyedia.
//
// ------------------------------------------------------------
// KENAPA API PENYEDIA, BUKAN SMTP SENDIRI
// ------------------------------------------------------------
// Server SMTP buatan sendiri berarti menanggung sendiri seluruh urusan yang
// menentukan apakah surat sampai: reputasi alamat IP, penandatanganan DKIM,
// penanganan pantulan, daftar cekal, umpan balik keluhan. Penyedia
// transaksional sudah mengerjakan semuanya dan menjualnya sebagai satu
// permintaan HTTPS. Blueprint menyebutnya dengan tegas, dan alasannya benar.
//
// Yang dipakai di sini Resend, karena bentuk permintaannya paling sederhana.
// Pindah ke penyedia lain berarti mengganti satu fungsi di bawah — bukan
// membongkar antrean, statistik, maupun panelnya.
// ============================================================

import {
  domainEmail,
  gabungNaskah,
  keTeksBiasa,
  tautanBerhenti,
  type OusState,
} from "@/lib/outreach";
import { pastikanKakiBerhenti, rangkaEmail } from "@/lib/outreach-template";

/** Alamat pangkal portal, dipakai menyusun tautan berhenti langganan. */
export function asalPortal(): string {
  const disetel = process.env.NEXT_PUBLIC_PORTAL_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  if (disetel) return disetel.replace(/\/+$/, "");
  const host = process.env.NEXT_PUBLIC_PORTAL_HOST || "www.sipalingfisip.web.id";
  return `https://${host.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
}

export type BahanSurat = {
  /**
   * Penanda unik baris antrean ini.
   *
   * Menjadi kunci idempotensi ke penyedia, jadi ia harus berbeda untuk tiap
   * SURAT — bukan untuk tiap penerima. Memakai alamat emailnya saja membuat
   * kampanye kedua kepada orang yang sama ditolak penyedia sebagai kiriman
   * berulang, dan yang terjadi adalah surat yang tidak pernah sampai tanpa
   * satu pun pesan galat.
   */
  idem: string;
  email: string;
  name: string | null;
  institution: string | null;
  field: string | null;
  country: string | null;
  unsubscribeToken: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
};

export type Surat = {
  /** Kunci idempotensi, diteruskan apa adanya ke penyedia. */
  idem: string;
  from: string;
  to: string;
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
};

/**
 * Menyusun satu surat yang siap dikirim.
 *
 * Tiga hal dipasang di sini dan TIDAK dapat dilewati dari layar mana pun:
 *
 *   1. Kaki berhenti langganan. Ditambal bila naskahnya kehilangan tautannya.
 *   2. Badan teks biasa. Surat yang hanya berisi HTML adalah salah satu
 *      penanda yang paling sering dipakai penyaring.
 *   3. Kepala List-Unsubscribe. Inilah yang membuat tombol "berhenti
 *      langganan" muncul di baris atas Gmail — dan orang yang menekan tombol
 *      itu tidak menekan tombol "laporkan spam" yang ada di sebelahnya.
 *      Satu keluhan spam merusak reputasi domain jauh lebih dalam daripada
 *      seratus orang yang berhenti langganan.
 */
export function rakitSurat(bahan: BahanSurat, state: OusState, asal = asalPortal()): Surat {
  const tautan = tautanBerhenti(asal, bahan.unsubscribeToken);
  const data = {
    name: bahan.name,
    institution: bahan.institution,
    field: bahan.field,
    country: bahan.country,
    journal_name: state.jurnalNama,
    submission_url: state.jurnalUrl,
    sender_name: state.fromName,
    unsubscribe_url: tautan,
  };

  const isiHtml = gabungNaskah(pastikanKakiBerhenti(bahan.bodyHtml), data, true);
  const subjek = gabungNaskah(bahan.subject, data).replace(/\s+/g, " ").trim().slice(0, 300);
  const html = rangkaEmail(isiHtml, subjek);
  const teks = bahan.bodyText
    ? gabungNaskah(bahan.bodyText, data)
    : keTeksBiasa(isiHtml);

  return {
    idem: `${bahan.idem}:${bahan.email}`.slice(0, 250),
    from: `${bahan.fromName} <${bahan.fromEmail}>`,
    to: bahan.email,
    replyTo: bahan.replyTo || null,
    subject: subjek,
    html,
    text: teks,
    headers: {
      // Satu klik dari dalam kotak masuk, tanpa penerima perlu membuka apa pun.
      "List-Unsubscribe": `<${asal}/api/outreach/berhenti?t=${encodeURIComponent(bahan.unsubscribeToken)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

// ------------------------------------------------------------
// PENYEDIA
// ------------------------------------------------------------

export type Penyedia = "resend" | "mock";

export function penyediaTerpasang(): Penyedia {
  const kunci = process.env.OUTREACH_API_KEY || "";
  const pilihan = (process.env.OUTREACH_PROVIDER || "resend").toLowerCase();
  // Tanpa kunci API tidak ada penyedia. Yang dikembalikan "mock", dan pemanggil
  // memperlakukan seluruh kampanyenya sebagai simulasi — bukan gagal satu per
  // satu dengan pesan galat yang membingungkan.
  if (!kunci) return "mock";
  return pilihan === "mock" ? "mock" : "resend";
}

export type HasilKirim =
  | { ok: true; messageId: string; simulasi: boolean }
  | { ok: false; kode: string; pesan: string };

/** Nomor pesan tiruan, supaya jalur simulasi tetap punya jejak yang unik. */
function nomorTiruan(): string {
  return `sim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Mengirim satu surat.
 *
 * `simulasi` sengaja menjadi parameter, bukan dibaca sendiri dari pengaturan:
 * yang menentukan adalah nilai yang DIBEKUKAN pada kampanyenya, dan fungsi
 * ini tidak boleh punya pendapat sendiri tentang itu.
 */
export async function kirimSurat(surat: Surat, simulasi: boolean): Promise<HasilKirim> {
  const penyedia = penyediaTerpasang();
  if (simulasi || penyedia === "mock") {
    return { ok: true, messageId: nomorTiruan(), simulasi: true };
  }

  const kunci = process.env.OUTREACH_API_KEY || "";
  try {
    const jawaban = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kunci}`,
        "Content-Type": "application/json",
        // Satu baris antrean tidak boleh terkirim dua kali walau permintaannya
        // sampai dua kali karena jaringan putus sesudah penyedia menerimanya.
        "Idempotency-Key": surat.idem,
      },
      body: JSON.stringify({
        from: surat.from,
        to: [surat.to],
        subject: surat.subject,
        html: surat.html,
        text: surat.text,
        ...(surat.replyTo ? { reply_to: surat.replyTo } : {}),
        headers: surat.headers,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const isi = (await jawaban.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!jawaban.ok) {
      return {
        ok: false,
        kode: String(jawaban.status),
        // Pesan penyedia ikut disimpan apa adanya, TANPA kunci API di
        // dalamnya — yang dikirim balik penyedia memang tidak pernah memuat
        // kuncinya, dan itu satu-satunya alasan pesan ini aman disimpan.
        pesan: (isi.message || isi.name || `Penyedia menolak (${jawaban.status}).`).slice(0, 500),
      };
    }
    if (!isi.id) {
      return { ok: false, kode: "tanpa-id", pesan: "Penyedia menerima surat tetapi tidak mengembalikan nomor pesan." };
    }
    return { ok: true, messageId: isi.id, simulasi: false };
  } catch (galat: unknown) {
    const pesan = galat instanceof Error ? galat.message : String(galat);
    return { ok: false, kode: "jaringan", pesan: pesan.slice(0, 500) };
  }
}

// ------------------------------------------------------------
// KESIAPAN KIRIM SUNGGUHAN
// ------------------------------------------------------------

export type Kesiapan = {
  siap: boolean;
  /** Hal-hal yang HARUS dibereskan sebelum kiriman sungguhan boleh menyala. */
  penghalang: string[];
  /** Hal yang sebaiknya diperiksa, tetapi tidak menahan. */
  catatan: string[];
};

/**
 * Apakah sistem ini siap mengirim surat SUNGGUHAN?
 *
 * Panel memakai ini untuk menolak mematikan mode simulasi selama masih ada
 * penghalang. Perhatikan bahwa SPF/DKIM/DMARC tidak dapat diperiksa dari
 * sini — keduanya ada di DNS, dan yang dapat dilakukan kode hanyalah menolak
 * berpura-pura sudah memeriksanya. Karena itu ia muncul sebagai catatan yang
 * harus dibaca manusia, bukan sebagai centang hijau yang dibuat-buat.
 */
export function periksaKesiapan(state: OusState): Kesiapan {
  const penghalang: string[] = [];
  const catatan: string[] = [];

  if (!state.fromEmail) {
    penghalang.push("Alamat pengirim belum diisi di pengaturan OUS.");
  } else {
    const domain = domainEmail(state.fromEmail);
    if (/gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|icloud\.com/i.test(domain)) {
      penghalang.push(
        `Alamat pengirim memakai ${domain}. Penyedia gratis menolak penandatanganan DKIM atas nama Anda, dan DMARC penerima akan menolak suratnya. Pakai alamat pada domain resmi jurnal atau kampus.`,
      );
    }
  }

  if (penyediaTerpasang() === "mock") {
    penghalang.push("OUTREACH_API_KEY belum diatur di environment variables hosting.");
  }
  if (!process.env.OUTREACH_WEBHOOK_SECRET) {
    catatan.push(
      "OUTREACH_WEBHOOK_SECRET belum diatur. Tanpa webhook, status hanya sampai \"terkirim\": pantulan dan keluhan tidak akan pernah tercatat, dan alamat mati tidak terbuang sendiri.",
    );
  }
  if (!state.replyTo) {
    catatan.push("Reply-To belum diisi. Balasan penerima akan masuk ke alamat pengirim.");
  }

  catatan.push(
    "Pastikan SPF, DKIM, dan DMARC domain pengirim sudah lulus di panel penyedia email. Ini tidak dapat diperiksa dari dalam portal, dan tanpanya seluruh pengaturan lain hampir tidak berarti.",
  );

  return { siap: penghalang.length === 0, penghalang, catatan };
}

// ------------------------------------------------------------
// TANDA TANGAN WEBHOOK
// ------------------------------------------------------------

function samaWaktuTetap(a: string, b: string) {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

/**
 * Memeriksa tanda tangan webhook penyedia.
 *
 * Webhook adalah satu-satunya jalan masuk OUS yang tidak memakai cookie, dan
 * yang mengetuk bukan peramban. Tanpa pemeriksaan ini, siapa pun yang tahu
 * alamatnya dapat mengarang peristiwa "pantulan keras" untuk alamat mana pun
 * dan mencekalnya dari sistem ini selamanya.
 *
 * Bentuk yang dipakai: HMAC-SHA256 atas "<timestamp>.<badan mentah>", persis
 * seperti yang dikirim Svix (dipakai Resend). Kepala tanda tangannya boleh
 * memuat beberapa nilai dipisah spasi; salah satu cocok sudah cukup.
 */
export async function tandaTanganSah(
  badanMentah: string,
  kepala: { id: string; timestamp: string; signature: string },
  rahasia: string,
): Promise<boolean> {
  if (!rahasia) return false;
  if (!kepala.signature || !kepala.timestamp) return false;

  // Tanda tangan yang sah pun ditolak bila usianya lewat lima menit: tanpa
  // ini, satu permintaan yang pernah terekam dapat dikirim ulang kapan saja.
  const detik = Number(kepala.timestamp);
  if (!Number.isFinite(detik) || Math.abs(Date.now() / 1000 - detik) > 300) return false;

  const kunciMentah = rahasia.startsWith("whsec_") ? rahasia.slice(6) : rahasia;
  let bahanKunci: Uint8Array;
  try {
    // Svix membagikan rahasianya dalam base64.
    const biner = atob(kunciMentah);
    bahanKunci = Uint8Array.from(biner, (huruf) => huruf.charCodeAt(0));
  } catch {
    bahanKunci = new TextEncoder().encode(kunciMentah);
  }

  const kunci = await crypto.subtle.importKey(
    "raw",
    bahanKunci as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const tandaTangan = await crypto.subtle.sign(
    "HMAC",
    kunci,
    new TextEncoder().encode(`${kepala.id}.${kepala.timestamp}.${badanMentah}`) as unknown as ArrayBuffer,
  );
  const harapan = btoa(String.fromCharCode(...new Uint8Array(tandaTangan)));

  return kepala.signature
    .split(/\s+/)
    .map((bagian) => (bagian.includes(",") ? bagian.split(",")[1] : bagian))
    .some((nilai) => samaWaktuTetap(nilai, harapan));
}
