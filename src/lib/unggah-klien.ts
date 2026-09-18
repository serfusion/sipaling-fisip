// ============================================================
// SISI PERAMBAN DARI UNGGAH LANGSUNG
//
// Satu per satu, bukan sekaligus. Bukan karena lebih cepat — justru sedikit
// lebih lambat — melainkan karena mahasiswa harus tahu berkas KEBERAPA yang
// sedang naik. Empat unggahan paralel yang berhenti di tengah hanya
// menyisakan satu bilah putar tanpa keterangan, dan itulah bentuk lama dari
// keluhan "uploadnya gagal terus".
//
// Kalau pemberi izin tidak menjawab (penyimpanan belum diatur, endpoint-nya
// belum ter-deploy), fungsi ini TIDAK menggagalkan pengisian: ia meminta
// pemanggilnya berpindah ke jalur cadangan — kirim berkas lewat API seperti
// dulu — yang masih sanggup melayani berkas kecil.
//
// KEMAJUAN PER BITA (v45). Unggahan skripsi 25 MB pada jaringan ponsel
// memakan waktu bermenit-menit. Sebelum ini yang terlihat di layar hanya satu
// baris teks yang tidak bergerak selama itu, dan tidak ada cara membedakan
// "sedang naik" dari "sudah menggantung" — mahasiswa lalu menekan kirim lagi,
// atau menutup tabnya tepat sebelum selesai.
//
// Karena itu unggahannya dikerjakan XMLHttpRequest, bukan fetch: hanya XHR
// yang melaporkan berapa bita badan permintaan yang sudah terkirim. Angka itu
// yang menggerakkan bilah kemajuan dan persentasenya.
// ============================================================
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { pesanStatusHttp } from "@/lib/pesan-http";
import type { BagianTerunggah, FolderTransit, IzinUnggah } from "@/lib/unggah-langsung";
import { kemajuanAwal, type Kemajuan } from "@/lib/kemajuan";

export type HasilUnggahBagian =
  | { mode: "langsung"; hasil: BagianTerunggah[] }
  | { mode: "cadangan"; alasan: string };

/** Berkas PDF selalu dititipkan dengan jenis yang benar, bukan yang dilaporkan peramban.
 *
 *  Bucket penyimpanan menolak jenis yang tidak ada di daftarnya, dan sebagian
 *  komputer melaporkan PDF sebagai "application/octet-stream" karena catatan
 *  asosiasi berkasnya rusak. Ekstensi dan isinya sudah diperiksa di tempat
 *  lain, jadi jenisnya tidak perlu ditebak dari laporan itu. */
const JENIS_PDF = "application/pdf";

/**
 * Berapa lama unggahan boleh berhenti bergerak sebelum dianggap mati.
 *
 * XHR tidak punya batas waktu bawaan, dan itu memang yang diinginkan untuk
 * berkas besar: 25 MB pada jaringan lambat memang butuh waktu lama, dan
 * memutusnya karena "sudah dua menit" akan menggagalkan unggahan yang
 * sebenarnya berjalan baik.
 *
 * Yang DIPUTUS adalah unggahan yang berhenti bergerak: wifi kampus yang
 * berpindah pemancar, atau ponsel yang kehilangan sinyal, sering meninggalkan
 * sambungan yang tidak pernah gagal maupun selesai. Tanpa pengawas ini, layar
 * mahasiswa menunggu tanpa akhir pada satu angka persen yang sama.
 */
const BATAS_MACET_MS = 45_000;

/**
 * Berapa lama penyimpanan boleh berpikir SESUDAH bita terakhir terkirim.
 *
 * Ini bukan pengawas yang sama dengan di atas, dan perbedaannya penting:
 * sesudah bita terakhir naik, laporan kemajuan berhenti sama sekali — yang
 * ditunggu sekarang Supabase menuliskan berkasnya. Bila pengawas 45 detik di
 * atas tetap berjalan pada tahap ini, unggahan 25 MB yang BERHASIL akan
 * dibatalkan hanya karena penyimpanan sedang lambat menjawab.
 */
const BATAS_JAWABAN_MS = 180_000;

/**
 * Terjemahkan keluhan Supabase Storage yang paling sering muncul.
 *
 * Aslinya bahasa Inggris dan menyebut istilah yang tidak berarti apa-apa bagi
 * mahasiswa. Yang pertama di bawah ini khususnya: ia muncul ketika batas
 * ukuran BUCKET belum dinaikkan ke 25 MB, dan yang harus bertindak adalah
 * admin — bukan mahasiswa yang berkasnya memang sah.
 */
function terjemahkanGalatStorage(pesan: string) {
  const kecil = pesan.toLowerCase();
  if (kecil.includes("maximum allowed size") || kecil.includes("payload too large")) {
    return (
      "Penyimpanan menolak karena batas ukurannya belum dinaikkan. " +
      "Beri tahu admin untuk menjalankan supabase-update-v43-unggah-langsung.sql."
    );
  }
  if (kecil.includes("mime type") || kecil.includes("invalid_mime_type")) {
    return "Penyimpanan hanya menerima berkas PDF. Simpan ulang berkasnya sebagai PDF.";
  }
  if (kecil.includes("jwt") || kecil.includes("expired") || kecil.includes("invalid signature")) {
    return "Izin unggahnya sudah kedaluwarsa. Pilih ulang berkasnya lalu kirim lagi.";
  }
  return pesan;
}

/** Laporan bita: dipanggil berkali-kali selama satu berkas naik. */
type LaporBita = (terkirim: number) => void;

/**
 * Unggah dengan XMLHttpRequest. JALUR UTAMA, karena hanya ia yang melaporkan
 * kemajuan bita — dan pada berkas puluhan MB, kemajuan itulah yang membedakan
 * "sabar menunggu" dari "menyerah lalu mengulang dari nol".
 *
 * Isinya PUT biasa ke URL bertanda tangan milik Supabase, persis seperti yang
 * dilakukan pustaka Supabase sendiri.
 */
function lewatXhr(izin: IzinUnggah, berkas: File, lapor?: LaporBita) {
  return new Promise<string | null>((selesai) => {
    const xhr = new XMLHttpRequest();
    let pengawas = 0;
    let sudahSelesai = false;

    const tutup = (galat: string | null) => {
      if (sudahSelesai) return;
      sudahSelesai = true;
      window.clearTimeout(pengawas);
      selesai(galat);
    };

    // Pengawas macet: disetel ulang setiap kali ada bita baru terkirim.
    const segarkanPengawas = () => {
      window.clearTimeout(pengawas);
      pengawas = window.setTimeout(() => {
        xhr.abort();
        tutup("Unggahan berhenti bergerak selama 45 detik — jaringan Anda kemungkinan terputus.");
      }, BATAS_MACET_MS);
    };

    // Bita terakhir sudah terkirim: pengawas kemajuan tidak lagi berlaku,
    // karena memang tidak akan ada kemajuan lagi untuk diawasi.
    const tungguJawaban = () => {
      window.clearTimeout(pengawas);
      pengawas = window.setTimeout(() => {
        xhr.abort();
        tutup("Penyimpanan tidak menjawab sesudah berkas selesai dikirim. Coba kirim lagi.");
      }, BATAS_JAWABAN_MS);
    };

    xhr.open("PUT", izin.url, true);
    // Bentuk permintaannya sama persis dengan yang dikirim pustaka Supabase
    // sendiri ketika badannya bukan Blob: badan mentah, jenis dan cache-control
    // sebagai header. Yang membuatnya lebih baik untuk portal ini: jenisnya
    // DIPAKSA "application/pdf", sementara pustaka Supabase pada peramban
    // membungkusnya sebagai multipart dan memakai jenis yang dilaporkan
    // komputer mahasiswa — yang pada sebagian komputer "octet-stream", dan
    // ditolak bucket yang hanya menerima PDF.
    xhr.setRequestHeader("content-type", JENIS_PDF);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    // upsert: percobaan berikutnya menimpa sisa percobaan yang terputus.
    // Jalurnya unik per izin, jadi tidak ada berkas orang lain yang mungkin
    // tertimpa.
    xhr.setRequestHeader("x-upsert", "true");

    xhr.upload.onprogress = (kabar) => {
      segarkanPengawas();
      if (kabar.lengthComputable) lapor?.(kabar.loaded);
    };
    xhr.upload.onloadend = () => {
      // Seluruh bita sudah keluar dari perangkat mahasiswa. Angkanya
      // dipenuhkan di sini supaya baris berkasnya berhenti pada 100% sementara
      // penyimpanan menyelesaikan pekerjaannya — bukan berhenti pada 98%
      // seakan-akan ada yang tertinggal.
      lapor?.(berkas.size);
      tungguJawaban();
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        lapor?.(berkas.size);
        return tutup(null);
      }
      const teks = (xhr.responseText || "").slice(0, 200);
      tutup(teks ? terjemahkanGalatStorage(teks) : pesanStatusHttp(xhr.status));
    };
    xhr.onerror = () => tutup("Sambungan ke penyimpanan terputus saat berkas sedang naik.");
    xhr.onabort = () => tutup("Unggahan dihentikan.");

    segarkanPengawas();
    xhr.send(berkas);
  });
}

/** Unggah lewat pustaka Supabase. Cadangan bila XHR ditolak peramban atau
 *  perantara jaringannya (sebagian proxy kampus memperlakukan PUT berbeda). */
async function lewatKlien(izin: IzinUnggah, berkas: File) {
  const klien = getSupabaseBrowserClient();
  if (!klien) return "Kunci Supabase peramban belum diatur.";
  const { error } = await klien.storage
    .from(izin.bucket)
    .uploadToSignedUrl(izin.jalur, izin.token, berkas, { contentType: JENIS_PDF, upsert: true });
  return error ? terjemahkanGalatStorage(error.message) : null;
}

/** Unggah dengan fetch biasa ke URL bertanda tangan. Percobaan terakhir. */
async function lewatFetch(izin: IzinUnggah, berkas: File) {
  const jawaban = await fetch(izin.url, {
    method: "PUT",
    body: berkas,
    headers: { "content-type": JENIS_PDF, "cache-control": "max-age=3600", "x-upsert": "true" },
  });
  if (jawaban.ok) return null;
  const teks = await jawaban.text().catch(() => "");
  return teks ? terjemahkanGalatStorage(teks.slice(0, 200)) : pesanStatusHttp(jawaban.status);
}

async function kirimSatuBerkas(izin: IzinUnggah, berkas: File, lapor?: LaporBita) {
  // Tiga percobaan, dan masing-masing memakai cara yang berbeda. Yang pertama
  // melaporkan kemajuan; dua berikutnya menjawab keadaan ketika XHR atau
  // pustaka Supabase sendiri yang tidak dapat dipakai. Meminta mahasiswa
  // memilih ulang empat berkas karena satu putus di detik terakhir adalah cara
  // tercepat membuat orang berhenti memakai portal.
  const cara = [
    (i: IzinUnggah, b: File) => lewatXhr(i, b, lapor),
    lewatKlien,
    lewatFetch,
  ];
  let galatTerakhir = "";

  for (const jalan of cara) {
    // Percobaan baru berarti bita berkas ini dihitung dari nol lagi; tanpa ini
    // bilah kemajuan melompat mundur-maju tanpa penjelasan.
    lapor?.(0);
    try {
      const galat = await jalan(izin, berkas);
      if (!galat) return;
      galatTerakhir = galat;
    } catch (galat: unknown) {
      galatTerakhir = galat instanceof Error ? galat.message : String(galat);
    }
  }

  throw new Error(
    `Berkas "${berkas.name}" gagal diunggah ke penyimpanan. ${galatTerakhir} ` +
      "Periksa sambungan internet Anda lalu kirim lagi.",
  );
}

/**
 * Unggah seluruh bagian langsung ke penyimpanan.
 *
 * `lapor` dipanggil setiap kali kemajuannya berubah — termasuk di tengah satu
 * berkas, setiap potongan bita yang terkirim — supaya layar dapat menulis
 * "Mengunggah berkas 2 dari 4 (37%)" dan menggerakkan bilahnya.
 */
export async function unggahBagianLangsung(
  folder: FolderTransit,
  daftar: Array<{ id: string; berkas: File }>,
  lapor?: (kemajuan: Kemajuan) => void,
): Promise<HasilUnggahBagian> {
  const hasil: BagianTerunggah[] = [];
  const bitaTotal = daftar.reduce((jumlah, item) => jumlah + item.berkas.size, 0);
  // Bita milik berkas yang sudah SELESAI. Berkas yang sedang naik dihitung
  // terpisah supaya percobaan ulang tidak pernah mengurangi angka ini.
  let bitaSelesai = 0;

  const kabarkan = (kemajuan: Partial<Kemajuan> & Pick<Kemajuan, "tahap" | "indeks" | "nama">) => {
    lapor?.({ ...kemajuanAwal(daftar.length, bitaTotal), ...kemajuan });
  };

  for (const [urut, item] of daftar.entries()) {
    kabarkan({ tahap: "izin", indeks: urut, nama: item.berkas.name, bita: bitaSelesai, bitaBerkas: 0 });

    const jawaban = await fetch("/api/unggah/bagian", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder,
        bagian: item.id,
        nama: item.berkas.name,
        ukuran: item.berkas.size,
      }),
    });
    const payload = (await jawaban.json().catch(() => null)) as
      | { success?: boolean; message?: string; izin?: IzinUnggah }
      | null;

    // 503 berarti penyimpanan atau endpoint-nya sedang tidak siap; 404 berarti
    // halaman lama yang masih terbuka memanggil endpoint yang belum ada.
    // Keduanya bukan kesalahan mahasiswa, jadi pengisiannya tidak dibuang.
    if (jawaban.status === 503 || jawaban.status === 404) {
      return { mode: "cadangan", alasan: payload?.message || "Unggahan langsung sedang tidak tersedia." };
    }
    if (!jawaban.ok || !payload?.success || !payload.izin) {
      throw new Error(payload?.message || pesanStatusHttp(jawaban.status));
    }

    await kirimSatuBerkas(payload.izin, item.berkas, (terkirim) => {
      const bitaBerkas = Math.min(terkirim, item.berkas.size);
      kabarkan({
        tahap: "unggah",
        indeks: urut,
        nama: item.berkas.name,
        bita: bitaSelesai + bitaBerkas,
        bitaBerkas,
      });
    });
    bitaSelesai += item.berkas.size;

    hasil.push({
      id: item.id,
      nama: item.berkas.name,
      ukuran: item.berkas.size,
      jalur: payload.izin.jalur,
      tanda: payload.izin.tanda,
      kedaluwarsa: payload.izin.kedaluwarsa,
    });
    kabarkan({
      tahap: "unggah",
      indeks: Math.min(urut + 1, daftar.length - 1),
      nama: item.berkas.name,
      bita: bitaSelesai,
      bitaBerkas: item.berkas.size,
    });
  }

  return { mode: "langsung", hasil };
}

/** Tempelkan hasil unggahan ke FormData yang akan dikirim ke API. */
export function tempelkanBagian(formData: FormData, hasil: BagianTerunggah[]) {
  for (const b of hasil) {
    formData.delete(`bagian_${b.id}`);
    formData.set(`bagian_${b.id}_jalur`, b.jalur);
    formData.set(`bagian_${b.id}_tanda`, b.tanda);
    formData.set(`bagian_${b.id}_kedaluwarsa`, String(b.kedaluwarsa));
    formData.set(`bagian_${b.id}_nama`, b.nama);
    formData.set(`bagian_${b.id}_ukuran`, String(b.ukuran));
  }
}
