// ============================================================
// TAUTAN UJIAN CBT — satu tempat yang menyusun alamat yang dibagikan
//
// Dulu alamatnya dirakit di dalam panel dosen, satu baris di tengah berkas
// dua ribu lima ratus baris, dan hasilnya `${origin}/ujian?kode=...`. Itu
// benar HANYA selama CBT dibuka dari domain utama. Begitu CBT_HOST diisi dan
// ujian tinggal di subdomainnya sendiri, tautan yang tersalin ke grup kelas
// masih menunjuk domain lama — dan yang menemukannya bukan penulis kodenya,
// melainkan tiga puluh mahasiswa lima menit sebelum ujian.
//
// Berkas ini menutup itu: SATU penyusun alamat, dipakai server maupun
// peramban, dan seluruhnya fungsi murni supaya dapat diuji tanpa menyalakan
// apa pun.
//
// Bentuk tautannya SENGAJA pendek:
//
//     https://sipalingfisip.web.id/cbt/u/K7M2QX     (domain utama)
//     https://cbt.sipalingfisip.web.id/u/K7M2QX     (subdomain CBT)
//
// Bukan demi cantik. Tautan itu dibacakan di depan kelas, diketik ulang oleh
// mahasiswa yang salinannya gagal, dan dicetak sebagai QR pada poster ruang
// ujian. `?kode=` yang panjang gagal pada ketiganya.
// ============================================================

/** Kode ujian pada alamat: huruf besar dan angka saja. */
const POLA_KODE = /^[A-Z0-9]{4,12}$/;

/**
 * Bersihkan kode ujian sebelum ia masuk ke sebuah alamat.
 *
 * Mengembalikan tali kosong bila kodenya tidak masuk akal — dan pemanggilnya
 * memperlakukan itu sebagai "tanpa kode", bukan sebagai galat. Kode yang
 * ditempel mahasiswa kerap membawa spasi, tanda hubung, atau huruf kecil;
 * ketiganya dirapikan, bukan ditolak.
 */
export function rapikanKodeTautan(masukan: unknown): string {
  if (typeof masukan !== "string") return "";
  const bersih = masukan.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return POLA_KODE.test(bersih) ? bersih : "";
}

/**
 * Rapikan sebuah asal menjadi "protokol//tuan-rumah", tanpa jalur dan tanpa
 * garis miring di ujung.
 *
 * Yang dijaga di sini bukan kerapian, melainkan bahwa alamat yang tersalin ke
 * grup kelas benar-benar alamat: nilai yang bukan http/https ditolak, sebab
 * `javascript:` yang terselip ke environment variable lalu tercetak sebagai
 * tautan adalah hal yang tidak boleh mungkin terjadi.
 */
export function rapikanAsal(nilai: string | null | undefined): string {
  const isi = String(nilai ?? "").trim();
  if (!isi) return "";
  try {
    const alamat = new URL(isi.includes("://") ? isi : `https://${isi}`);
    if (alamat.protocol !== "http:" && alamat.protocol !== "https:") return "";
    return `${alamat.protocol}//${alamat.host}`;
  } catch {
    return "";
  }
}

/**
 * Pangkal seluruh alamat situs CBT.
 *
 * `asalKhusus` adalah subdomain CBT bila ada (CBT_HOST / NEXT_PUBLIC_CBT_URL).
 * Pada subdomain itu akar situsnya SUDAH situs CBT — middleware menuliskan
 * ulang "/" menjadi "/cbt" — jadi awalan "/cbt" tidak boleh ikut, kalau tidak
 * alamatnya menjadi /cbt/cbt.
 *
 * Tanpa subdomain, pangkalnya domain utama ditambah "/cbt".
 */
export function pangkalCbt(asalPeramban?: string | null, asalKhusus?: string | null): string {
  const khusus = rapikanAsal(asalKhusus);
  if (khusus) return khusus;
  const asal = rapikanAsal(asalPeramban);
  return asal ? `${asal}/cbt` : "/cbt";
}

/** Pintu masuk situs CBT — layar yang meminta kode ujian. */
export function tautanMasukCbt(asalPeramban?: string | null, asalKhusus?: string | null): string {
  return pangkalCbt(asalPeramban, asalKhusus);
}

/**
 * Tautan yang dibagikan ke mahasiswa.
 *
 * Kode yang tidak sah menghasilkan alamat pintu masuk, bukan alamat cacat:
 * mahasiswa mendarat pada layar yang meminta kode, dan itu jauh lebih baik
 * daripada halaman 404.
 */
export function tautanUjian(kode: unknown, asalPeramban?: string | null, asalKhusus?: string | null): string {
  const bersih = rapikanKodeTautan(kode);
  const pangkal = pangkalCbt(asalPeramban, asalKhusus);
  return bersih ? `${pangkal}/u/${bersih}` : `${pangkal}/ujian`;
}

/**
 * Alamat yang sama tanpa "https://" di depannya — untuk dicetak pada poster.
 *
 * Poster dibaca dari jarak lima meter, dan tujuh huruf pertama yang sama pada
 * setiap alamat di dunia tidak membantu siapa pun mengetiknya.
 */
export function tautanRingkas(alamat: string): string {
  return alamat.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// ---------- ASAL MENURUT PERMINTAAN YANG MASUK ----------

/**
 * Asal yang dilihat pemanggil, dibaca dari header permintaan.
 *
 * Di belakang proxy (Vercel), protokol aslinya hanya ada pada
 * x-forwarded-proto; `new URL(request.url).protocol` di sana kerap "http:"
 * dan tautan http yang tersebar ke grup kelas adalah cacat yang tidak
 * kelihatan sampai ada yang mengeluh.
 */
export function asalPermintaan(request: Request): string {
  const kepala = request.headers;
  const host = (kepala.get("x-forwarded-host") || kepala.get("host") || "").split(",")[0]?.trim();
  if (!host) {
    try {
      return rapikanAsal(new URL(request.url).origin);
    } catch {
      return "";
    }
  }
  const proto = (kepala.get("x-forwarded-proto") || "").split(",")[0]?.trim()
    || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return rapikanAsal(`${proto}://${host}`);
}

/**
 * Subdomain CBT menurut environment, bila memang dipasang.
 *
 * CBT_HOST menyimpan tuan rumahnya saja ("cbt.sipalingfisip.web.id"), sama
 * seperti yang dibaca middleware; protokolnya diambil dari permintaan yang
 * sedang berjalan supaya pengembangan di localhost tidak tiba-tiba
 * menghasilkan https.
 */
export function asalCbtEnv(protokolDari?: string | null): string {
  const dariUrl = rapikanAsal(process.env.NEXT_PUBLIC_CBT_URL);
  if (dariUrl) return dariUrl;
  const host = (process.env.CBT_HOST || "").trim().toLowerCase();
  if (!host) return "";
  const proto = rapikanAsal(protokolDari).startsWith("http://") ? "http" : "https";
  return rapikanAsal(`${proto}://${host}`);
}

// ---------- PESAN SIAP TEMPEL ----------

export type UjianTautan = {
  kode: string;
  judul: string;
  mataKuliah: string;
  kelas?: string | null;
  token?: string | null;
  jumlahSoal: number;
  durasi: number;
  mulai?: string | null;
  selesai?: string | null;
};

function jamRapi(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Pesan siap tempel untuk grup kelas.
 *
 * Menyalin tautannya saja lalu mengetik sendiri jam dan jumlah soalnya di grup
 * adalah pekerjaan yang paling sering salah ketik — dan salah ketiknya baru
 * ketahuan ketika kelas sudah berkumpul.
 */
export function pesanGrupUjian(u: UjianTautan, tautan: string, kredit: string): string {
  const baris = [
    `*${u.judul}*`,
    `${u.mataKuliah}${u.kelas ? ` · Kelas ${u.kelas}` : ""}`,
    "",
    `Tautan ujian : ${tautan}`,
    `Kode ujian   : ${u.kode}`,
  ];
  if (u.token) baris.push(`Kode pengawas: ${u.token}`);
  baris.push(
    "",
    `Jumlah soal  : ${u.jumlahSoal}`,
    `Waktu        : ${u.durasi} menit`,
  );
  const mulai = jamRapi(u.mulai);
  const tutup = jamRapi(u.selesai);
  if (mulai) baris.push(`Dibuka       : ${mulai}`);
  if (tutup) baris.push(`Ditutup      : ${tutup}`);
  baris.push(
    "",
    "Tidak perlu membuat akun. Buka tautannya, isi nama dan NIM, lalu mulai.",
    "Lama pengerjaannya tertulis di layar sebelum tombol Mulai Ujian ditekan.",
    "",
    kredit,
  );
  return baris.join("\n");
}

/** Alamat WhatsApp yang membuka daftar obrolan dengan pesannya sudah terisi. */
export function tautanWhatsApp(pesan: string): string {
  return `https://wa.me/?text=${encodeURIComponent(pesan)}`;
}
