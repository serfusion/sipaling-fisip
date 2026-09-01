// ============================================================
// PERCAKAPAN CATATAN UANG
//
// Satu otak untuk semua kanal pesan. Telegram dan WhatsApp hanya mengurus
// protokolnya masing-masing (tanda tangan, bentuk muatan, cara mengirim
// balasan); apa yang terjadi pada pesannya diputuskan di sini.
//
// Alasannya bukan kerapian belaka. Kalau tiap kanal menyimpan aturannya
// sendiri, "kemarin -20k grab" bisa tercatat berbeda di WhatsApp dan di
// Telegram, dan yang berbeda adalah catatan keuangan orang.
// ============================================================
import { labelBulan, rupiah } from "./format";
import { bacaPerintah } from "./perintah";
import { kategoriDari } from "./kategori";
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
} from "./simpan";
import { uraiPesan } from "./urai-pesan";

export type Kanal = "telegram" | "whatsapp";

export type Balasan = {
  /** Teks yang dikirim balik ke pengirimnya. Kosong berarti tidak usah dibalas. */
  teks: string;
  /** Berapa baris yang benar-benar tersimpan. Dipakai untuk pencatatan log. */
  tercatat: number;
};

function bantuan(kanal: Kanal) {
  const awalan = kanal === "telegram" ? "/" : "";
  return [
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
    `  ${awalan}daftar KODE - sambungkan percakapan ini ke buku kas`,
    `  ${awalan}ringkas - ringkasan bulan ini`,
    `  ${awalan}batal - hapus catatan terakhir`,
    `  ${awalan}buku - lihat buku yang tersambung`,
    `  ${awalan}lepas - putuskan sambungan`,
  ].join("\n");
}

function belumTersambung(kanal: Kanal) {
  const awalan = kanal === "telegram" ? "/" : "";
  return [
    "Percakapan ini belum tersambung ke buku kas.",
    "",
    "Buka halaman Catatan Uang di portal, buat buku, lalu kirim ke sini:",
    `  ${awalan}daftar UNG-XXXX-XXXX-XXXX`,
    "",
    "Kirim kodenya di percakapan pribadi seperti ini, jangan di grup.",
  ].join("\n");
}

/** Ringkasan bulan berjalan, dipakai perintah ringkas dan ekor tiap catatan. */
async function ringkasanBulanIni(bookId: number, rinci: boolean) {
  const bulan = tanggalWib().slice(0, 7);
  const isi = await isiBulan(bookId, bulan);
  const r = ringkas(bulan, isi);

  if (!rinci) {
    return `${labelBulan(bulan)}: masuk ${rupiah(r.masuk)}, keluar ${rupiah(r.keluar)}, sisa ${rupiah(r.sisa)}`;
  }

  const rincian = r.perKategori.keluar
    .slice(0, 6)
    .map((k) => `  ${k.ikon} ${k.nama}: ${rupiah(k.nilai)}`)
    .join("\n");

  return [
    labelBulan(bulan),
    `Masuk   ${rupiah(r.masuk)}`,
    `Keluar  ${rupiah(r.keluar)}`,
    `Sisa    ${rupiah(r.sisa)}`,
    r.jumlahBaris
      ? `\nPengeluaran terbesar per kategori:\n${rincian}`
      : "\nBelum ada catatan bulan ini.",
  ].join("\n");
}

/**
 * Membaca satu pesan masuk dan mengembalikan balasannya.
 *
 * Tidak pernah melempar untuk hal yang wajar (kode salah, buku belum
 * tersambung, kalimat tidak terbaca): semuanya dijawab dengan kalimat yang
 * dapat dibacakan langsung ke pengirimnya.
 */
export async function layaniPesan(masukan: {
  kanal: Kanal;
  externalId: string;
  teks: string;
  label: string;
}): Promise<Balasan> {
  const { kanal, externalId, label } = masukan;
  const teks = String(masukan.teks ?? "").trim();
  if (!teks) return { teks: "", tercatat: 0 };

  const perintah = bacaPerintah(teks);

  // ---------- DAFTAR ----------
  if (perintah.nama === "daftar") {
    if (!perintah.kode) {
      return {
        tercatat: 0,
        teks: "Kodenya tidak terbaca. Bentuknya seperti ini:\n  daftar UNG-7HQ4-M2XB-9KDT",
      };
    }

    const bukuBaru = await bukuDariKode(perintah.kode);
    if (!bukuBaru) return { teks: "Buku dengan kode itu tidak ada. Periksa lagi salinannya.", tercatat: 0 };

    await sambungkanKanal({ bookId: bukuBaru.id, kind: kanal, externalId, label });
    return {
      tercatat: 0,
      teks: [
        `Tersambung ke buku "${bukuBaru.name}".`,
        "",
        "Mulai sekarang tinggal kirim pesannya, mis:",
        "  -beli nasi uduk 10k",
        "  +honor guru 100k",
        "",
        "Kalau kodenya tadi terkirim di grup, buat buku baru lewat halaman portal:",
        "kode yang sudah terlihat orang lain tidak dapat ditarik kembali.",
      ].join("\n"),
    };
  }

  if (perintah.nama === "bantuan") {
    const buku = await bukuDariKanal(kanal, externalId);
    const kepala = buku
      ? `Percakapan ini tersambung ke buku "${buku.name}".`
      : belumTersambung(kanal);
    return { teks: `${kepala}\n\n${bantuan(kanal)}`, tercatat: 0 };
  }

  const buku = await bukuDariKanal(kanal, externalId);
  if (!buku) return { teks: belumTersambung(kanal), tercatat: 0 };

  if (perintah.nama === "lepas") {
    await lepasKanal(kanal, externalId);
    return {
      tercatat: 0,
      teks: `Sambungan ke buku "${buku.name}" diputus. Catatan yang sudah masuk tetap ada.`,
    };
  }

  if (perintah.nama === "buku") {
    return { teks: `Buku "${buku.name}"\nKode: ${buku.code}`, tercatat: 0 };
  }

  if (perintah.nama === "ringkas") {
    const isi = await ringkasanBulanIni(buku.id, true);
    return { teks: `${buku.name}\n${isi}`, tercatat: 0 };
  }

  if (perintah.nama === "batal") {
    const terakhir = await catatanTerakhir(buku.id);
    if (!terakhir) return { teks: "Belum ada catatan yang bisa dibatalkan.", tercatat: 0 };
    await hapusCatatan(buku.id, terakhir.id);
    return {
      tercatat: 0,
      teks: `Dibatalkan: ${terakhir.direction} ${rupiah(Number(terakhir.amount))} - ${terakhir.note}`,
    };
  }

  // Perintah bergaris miring yang tidak dikenal dijawab dengan bantuan.
  // Tanpa ini, "/statistik" akan berakhir sebagai percobaan mencatat uang.
  if (perintah.bergarisMiring && !uraiPesan(teks).ok) {
    return { teks: `Perintah "${perintah.kata}" tidak dikenal.\n\n${bantuan(kanal)}`, tercatat: 0 };
  }

  // ---------- MENCATAT ----------
  const hasil = await catatPesan({ bookId: buku.id, pesan: teks, sumber: kanal });

  const baris: string[] = [];
  for (const { baris: isi, hasil: urai } of hasil.tersimpan) {
    const kategori = kategoriDari(isi.category);
    const arah = isi.direction === "masuk" ? "masuk" : "keluar";
    baris.push(`${arah === "masuk" ? "🟢" : "🔴"} ${arah} ${rupiah(Number(isi.amount))} - ${isi.note}`);
    baris.push(`   ${kategori.ikon} ${kategori.nama} - ${isi.entryDate}`);
    for (const tambahan of urai.catatanTambahan) baris.push(`   ${tambahan}`);
  }
  for (const gagal of hasil.gagal) {
    baris.push(`⚠️ ${gagal.baris ? `"${gagal.baris}": ` : ""}${gagal.alasan}`);
  }

  if (hasil.tersimpan.length > 0) {
    baris.push("");
    baris.push(await ringkasanBulanIni(buku.id, false));
  } else {
    baris.push("");
    baris.push("Contoh yang terbaca: -beli nasi uduk 10k");
  }

  return { teks: baris.join("\n"), tercatat: hasil.tersimpan.length };
}
