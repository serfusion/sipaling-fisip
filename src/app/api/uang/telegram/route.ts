// ============================================================
// JALUR TELEGRAM
//
// Inilah bagian "tinggal kirim pesan": satu bot Telegram diarahkan ke alamat
// ini, lalu apa pun yang diketik pemiliknya di percakapan itu langsung
// menjadi baris di bukunya.
//
// Cara memasangnya ada di UPDATE-V14-CATATAN-UANG.md. Ringkasnya: buat bot
// lewat @BotFather, isi dua environment variable, lalu daftarkan alamat ini
// sebagai webhook beserta secret_token-nya.
//
// TIDUR TANPA KUNCI: tanpa TELEGRAM_BOT_TOKEN dan TELEGRAM_WEBHOOK_SECRET,
// jalur ini menjawab 404 untuk siapa pun. Sama seperti webhook pembayaran
// Cakrawala, jalur yang belum dipakai tidak perlu memberi tahu bahwa ia ada.
// ============================================================
import { timingSafeEqual } from "node:crypto";
import { normalisasiKode } from "@/lib/uang/buku";
import { kategoriDari } from "@/lib/uang/kategori";
import { labelBulan, rupiah } from "@/lib/uang/format";
import {
  bukuDariKanal,
  bukuDariKode,
  catatPesan,
  catatanTerakhir,
  hapusCatatan,
  isiBulan,
  lepasKanal,
  ringkas,
  sambungkanKanal,
  tanggalWib,
} from "@/lib/uang/simpan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KANAL = "telegram";

type PesanMasuk = {
  message_id?: number;
  text?: string;
  chat?: { id?: number | string; type?: string; title?: string };
  from?: { first_name?: string; username?: string };
};

type Kiriman = { update_id?: number; message?: PesanMasuk; edited_message?: PesanMasuk };

/**
 * Nomor kiriman yang baru saja dikerjakan.
 *
 * Telegram mengirim ulang kiriman yang tidak dijawab tepat waktu, dan tanpa
 * penyaring ini satu "beli kopi 15k" dapat tercatat dua kali. Penyaringnya
 * hanya berlaku selama proses ini hidup, jadi ia peredam, bukan jaminan;
 * jaminannya datang dari menjawab cepat dan selalu dengan 200.
 */
const sudahDikerjakan = new Set<number>();

function pernahDikerjakan(nomor: number | undefined) {
  if (typeof nomor !== "number") return false;
  if (sudahDikerjakan.has(nomor)) return true;
  sudahDikerjakan.add(nomor);
  if (sudahDikerjakan.size > 500) {
    for (const lama of sudahDikerjakan) {
      sudahDikerjakan.delete(lama);
      if (sudahDikerjakan.size <= 250) break;
    }
  }
  return false;
}

function tandaCocok(kirim: string, simpan: string) {
  const a = Buffer.from(kirim, "utf8");
  const b = Buffer.from(simpan, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function balas(token: string, chatId: string, teks: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: teks.slice(0, 3_900),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    // Balasan yang gagal terkirim tidak boleh membatalkan pencatatannya.
    // Uangnya sudah tercatat; yang hilang cuma kabarnya.
    console.error("balas telegram", error);
  }
}

const BANTUAN = [
  "Cara pakai:",
  "",
  "  -beli nasi uduk 10k",
  "  +honor guru 100k",
  "  kemarin -20k grab ke kampus",
  "  -35rb bensin #transportasi",
  "",
  "Tanda minus berarti uang keluar, plus berarti uang masuk. Tanpa tanda,",
  "arahnya ditebak dari kalimatnya sendiri.",
  "",
  "Nominal boleh ditulis 10k, 10rb, 10.000, atau 1,5jt.",
  "Beberapa catatan sekaligus: tulis satu per baris.",
  "",
  "Perintah:",
  "  /daftar KODE - sambungkan percakapan ini ke buku kas",
  "  /ringkas - ringkasan bulan ini",
  "  /batal - hapus catatan terakhir",
  "  /buku - lihat buku yang tersambung",
  "  /lepas - putuskan sambungan",
].join("\n");

export async function POST(request: Request) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const kunci = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  if (!token || !kunci) {
    return Response.json({ success: false, message: "Tidak tersedia." }, { status: 404 });
  }

  const kirimTanda = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!tandaCocok(kirimTanda, kunci)) {
    return Response.json({ success: false, message: "Tanda tangan tidak sah." }, { status: 401 });
  }

  let kiriman: Kiriman;
  try {
    kiriman = (await request.json()) as Kiriman;
  } catch {
    return Response.json({ ok: true });
  }

  const pesan = kiriman.message ?? kiriman.edited_message;
  const chatId = pesan?.chat?.id;
  const teks = String(pesan?.text ?? "").trim();

  // Kiriman tanpa teks (stiker, foto, orang masuk grup) dijawab ramah dengan
  // 200 supaya Telegram berhenti mengulanginya.
  if (chatId === undefined || chatId === null || !teks) return Response.json({ ok: true });
  if (pernahDikerjakan(kiriman.update_id)) return Response.json({ ok: true });

  const chat = String(chatId);
  const label = pesan?.chat?.title || pesan?.from?.first_name || pesan?.from?.username || "Telegram";

  try {
    await kerjakan({ token, chat, teks, label });
  } catch (error) {
    console.error("telegram catatan uang", error);
    await balas(token, chat, "Ada yang bermasalah di sisi server. Catatannya belum tersimpan, coba kirim ulang sebentar lagi.");
  }

  // SELALU 200. Balasan selain itu membuat Telegram mengirim ulang kiriman
  // yang sama, dan yang terulang adalah pencatatan uang orang.
  return Response.json({ ok: true });
}

async function kerjakan(masukan: { token: string; chat: string; teks: string; label: string }) {
  const { token, chat, teks, label } = masukan;
  const perintah = teks.toLowerCase().split(/\s+/)[0].replace(/@[\w_]+$/, "");

  if (["/start", "/mulai", "/help", "/bantuan"].includes(perintah)) {
    const buku = await bukuDariKanal(KANAL, chat);
    const kepala = buku
      ? `Percakapan ini tersambung ke buku "${buku.name}".`
      : [
          "Percakapan ini belum tersambung ke buku mana pun.",
          "",
          "Buka halaman catatan uang di portal, buat buku, lalu kirim ke sini:",
          "  /daftar UNG-XXXX-XXXX-XXXX",
          "",
          "Kirim kodenya di percakapan pribadi seperti ini, jangan di grup.",
        ].join("\n");
    await balas(token, chat, `${kepala}\n\n${BANTUAN}`);
    return;
  }

  if (perintah === "/daftar") {
    // Argumennya diambil dari potongan kata, bukan dari panjang perintahnya:
    // Telegram menempelkan nama bot pada perintah di grup ("/daftar@BotKu"),
    // dan memotong sepanjang perintah yang sudah dibersihkan akan menyisakan
    // nama botnya di dalam kode.
    const kode = normalisasiKode(teks.split(/\s+/).slice(1).join(" "));
    if (!kode) {
      await balas(token, chat, "Kodenya tidak terbaca. Bentuknya seperti ini: /daftar UNG-7HQ4-M2XB-9KDT");
      return;
    }
    const buku = await bukuDariKode(kode);
    if (!buku) {
      await balas(token, chat, "Buku dengan kode itu tidak ada. Periksa lagi salinannya.");
      return;
    }
    await sambungkanKanal({ bookId: buku.id, kind: KANAL, externalId: chat, label });
    await balas(
      token,
      chat,
      [
        `Tersambung ke buku "${buku.name}".`,
        "",
        "Mulai sekarang tinggal kirim pesannya, mis:",
        "  -beli nasi uduk 10k",
        "  +honor guru 100k",
        "",
        "Kalau kodenya tadi terkirim di grup, buat buku baru lewat halaman portal:",
        "kode yang sudah terlihat orang lain tidak dapat ditarik kembali.",
      ].join("\n"),
    );
    return;
  }

  const buku = await bukuDariKanal(KANAL, chat);
  if (!buku) {
    await balas(
      token,
      chat,
      "Percakapan ini belum tersambung ke buku kas. Kirim /daftar diikuti kode bukunya.",
    );
    return;
  }

  if (perintah === "/lepas") {
    await lepasKanal(KANAL, chat);
    await balas(token, chat, `Sambungan ke buku "${buku.name}" diputus. Catatan yang sudah masuk tetap ada.`);
    return;
  }

  if (perintah === "/buku") {
    await balas(token, chat, `Buku "${buku.name}"\nKode: ${buku.code}`);
    return;
  }

  if (["/ringkas", "/bulan", "/ringkasan"].includes(perintah)) {
    const bulan = tanggalWib().slice(0, 7);
    const isi = await isiBulan(buku.id, bulan);
    const r = ringkas(bulan, isi);
    const rinci = r.perKategori.keluar
      .slice(0, 6)
      .map((k) => `  ${k.ikon} ${k.nama}: ${rupiah(k.nilai)}`)
      .join("\n");
    await balas(
      token,
      chat,
      [
        `${labelBulan(bulan)} - ${buku.name}`,
        `Masuk   ${rupiah(r.masuk)}`,
        `Keluar  ${rupiah(r.keluar)}`,
        `Sisa    ${rupiah(r.sisa)}`,
        r.jumlahBaris ? `\nPengeluaran terbesar per kategori:\n${rinci}` : "\nBelum ada catatan bulan ini.",
      ].join("\n"),
    );
    return;
  }

  if (["/batal", "/hapus", "/undo"].includes(perintah)) {
    const terakhir = await catatanTerakhir(buku.id);
    if (!terakhir) {
      await balas(token, chat, "Belum ada catatan yang bisa dibatalkan.");
      return;
    }
    await hapusCatatan(buku.id, terakhir.id);
    await balas(
      token,
      chat,
      `Dibatalkan: ${terakhir.direction} ${rupiah(Number(terakhir.amount))} - ${terakhir.note}`,
    );
    return;
  }

  if (perintah.startsWith("/")) {
    await balas(token, chat, `Perintah "${perintah}" tidak dikenal.\n\n${BANTUAN}`);
    return;
  }

  const hasil = await catatPesan({ bookId: buku.id, pesan: teks, sumber: KANAL });

  const baris: string[] = [];
  for (const { baris: isi, hasil: urai } of hasil.tersimpan) {
    const kategori = kategoriDari(isi.category);
    const arah = isi.direction === "masuk" ? "masuk" : "keluar";
    baris.push(
      `${isi.direction === "masuk" ? "🟢" : "🔴"} ${arah} ${rupiah(Number(isi.amount))} - ${isi.note}`,
    );
    baris.push(`   ${kategori.ikon} ${kategori.nama} - ${isi.entryDate}`);
    for (const tambahan of urai.catatanTambahan) baris.push(`   ${tambahan}`);
  }
  for (const gagal of hasil.gagal) {
    baris.push(`⚠️ ${gagal.baris ? `"${gagal.baris}": ` : ""}${gagal.alasan}`);
  }

  if (hasil.tersimpan.length > 0) {
    const bulan = tanggalWib().slice(0, 7);
    const isi = await isiBulan(buku.id, bulan);
    const r = ringkas(bulan, isi);
    baris.push("");
    baris.push(`${labelBulan(bulan)}: masuk ${rupiah(r.masuk)}, keluar ${rupiah(r.keluar)}, sisa ${rupiah(r.sisa)}`);
  } else if (hasil.gagal.length > 0) {
    baris.push("");
    baris.push("Contoh yang terbaca: -beli nasi uduk 10k");
  }

  await balas(token, chat, baris.join("\n"));
}
