// ============================================================
// ALAMAT SITUS DRAMA — sipalingfisip.online
//
// Situs ketiga di atas penyebaran yang sama:
//
//   portal : www.sipalingfisip.web.id  → layanan akademik, dashboard, login
//   CBT    : cbt.sipalingfisip.web.id  → pintu masuk ujian dan layar ujian
//   drama  : sipalingfisip.online      → Nonton Drama, bonus pemegang kode
//
// Bedanya dengan CBT: drama TIDAK tinggal di subdomain portal, melainkan di
// domain yang sama sekali lain. Karena itu namanya tidak dapat diturunkan
// dari nama portal seperti "cbt." + domain — ia harus dinyatakan. Nilai
// bawaannya ada di bawah, dan NEXT_PUBLIC_DRAMA_HOST menimpanya bila suatu
// saat domainnya berganti.
//
// KONSEKUENSI YANG DISENGAJA: karena domainnya lain, cookie portal tidak
// pernah ikut terkirim ke sini. Peramban memang tidak membagikan cookie
// antardomain, dan itu bukan kekurangan yang perlu diakali — pengunjung
// memasukkan kode Cakrawala-nya sekali lagi di sini, lalu situs ini
// memasang cookie miliknya sendiri. Kodenya sama, basis datanya sama, jadi
// langganan yang sama yang dibaca; yang berbeda hanya di mana cookie-nya
// menempel. Mengakalinya menuntut token yang dioper lewat alamat, dan token
// akses yang berjalan di bilah alamat adalah token yang tersalin ke grup
// WhatsApp.
//
// Semua fungsi di sini murni dan tidak menyentuh Node: middleware berjalan
// di edge, dan sebagian fungsi ini ikut terbawa ke peramban.
// ============================================================

import {
  dipakaiBersama,
  hostPortalBawaan,
  rapikanHost,
  type RencanaRute,
} from "@/lib/situs-cbt";

/**
 * Nama domain situs drama, dipakai bila NEXT_PUBLIC_DRAMA_HOST tidak diisi.
 *
 * Ditulis tanpa "www." karena itulah bentuk yang didaftarkan; bentuk www-nya
 * tetap dikenali oleh adalahHostDrama di bawah.
 */
const HOST_DRAMA_CADANGAN = "sipalingfisip.online";

/** Jalur tempat situs drama sesungguhnya dilayani di dalam penyebaran. */
export const JALUR_DRAMA = "/drama";

/** Nama domain situs drama yang berlaku. */
export function hostDramaBawaan(): string {
  return rapikanHost(process.env.NEXT_PUBLIC_DRAMA_HOST || "") || HOST_DRAMA_CADANGAN;
}

function tanpaWww(host: string) {
  return host.startsWith("www.") ? host.slice(4) : host;
}

/** Alamat host ini melayani situs drama? Bentuk www.* ikut dikenali. */
export function adalahHostDrama(hostMentah: string | null | undefined): boolean {
  const host = tanpaWww(rapikanHost(hostMentah));
  if (!host) return false;
  return host === tanpaWww(hostDramaBawaan());
}

/**
 * Tuan rumah ini domain sungguhan yang punya tetangga?
 *
 * localhost, alamat IP, dan pratayang *.vercel.app tidak. Di sana situs
 * drama tetap dilayani di /drama seperti halaman biasa, sebab mengalihkan
 * ke domain yang tidak terpasang sama saja dengan mematikan menunya bagi
 * yang sedang mengembangkan.
 */
function hostSungguhan(host: string): boolean {
  if (!host || !host.includes(".")) return false;
  if (host.endsWith(".vercel.app")) return false;
  // Alamat IPv4 apa adanya; IPv6 tidak pernah punya titik.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  return true;
}

/**
 * Jalur yang dilayani situs drama pada akarnya.
 *
 * Hanya akar, dan itu disengaja. Seluruh perpindahan di dalamnya — pilih
 * platform, buka rincian, tonton episode — dicatat pada kueri alamat, bukan
 * pada ruas jalur. Satu jalur berarti satu aturan di middleware, dan aturan
 * yang sedikit adalah aturan yang masih benar setahun lagi.
 */
export function jalurMilikDrama(pathname: string): boolean {
  return pathname === "/";
}

/** Buang awalan /drama: "/drama" → "/", "/drama/apa" → "/apa". */
export function tanpaAwalanDrama(pathname: string): string {
  if (pathname === JALUR_DRAMA) return "/";
  if (pathname.startsWith(`${JALUR_DRAMA}/`)) return pathname.slice(JALUR_DRAMA.length);
  return pathname;
}

/**
 * Asal (protokol + host) situs drama, dilihat dari tuan rumah yang sedang
 * dibuka. Kosong berarti "di sini tidak ada domain drama terpisah" — jawaban
 * yang benar untuk localhost dan pratayang penyebaran, dan pemanggilnya lalu
 * memakai jalur /drama seperti halaman biasa.
 */
export function asalDrama(hostMentah: string | null | undefined): string {
  const host = rapikanHost(hostMentah);
  if (!hostSungguhan(host)) return "";
  const drama = hostDramaBawaan();
  return drama ? `https://${drama}` : "";
}

/**
 * Tautan ke situs drama yang aman dipakai di mana pun.
 *
 * Di produksi ia alamat lengkap ke domain drama; di localhost dan pratayang
 * ia jalur /drama. Satu fungsi supaya tidak ada tombol yang lupa memakai
 * cabang yang benar.
 */
export function tautanDrama(hostMentah: string | null | undefined): string {
  return asalDrama(hostMentah) || JALUR_DRAMA;
}

/**
 * Ke mana permintaan ini seharusnya mendarat, bila situs drama yang
 * bersangkutan? null berarti "bukan urusan drama" — penilaiannya lalu
 * diteruskan ke aturan CBT dan portal.
 *
 * Tiga hal yang dikerjakan:
 *
 *   1. Di domain drama, akar DITULISKAN ULANG ke /drama. Penulisan ulang,
 *      bukan pengalihan, supaya alamat di bilah peramban tetap
 *      sipalingfisip.online — itulah alamat yang dibagikan pemiliknya.
 *   2. Di domain drama, /drama adalah alamat kembar dan dirapikan kembali
 *      ke akar. Dua alamat untuk satu halaman selalu berakhir sebagai dua
 *      tangkapan layar yang saling berbeda.
 *   3. Di domain drama, halaman yang bukan miliknya (mis. /login, /alat)
 *      dialihkan ke portal, bukan disodori 404.
 *   4. Di domain portal, /drama dialihkan ke domain drama — inilah yang
 *      membuat menu Cakrawala dan tautan lama tetap mendarat di tempat yang
 *      benar.
 */
export function rencanaDrama(
  hostMentah: string | null | undefined,
  pathname: string,
): RencanaRute | null {
  if (dipakaiBersama(pathname)) return null;

  const host = rapikanHost(hostMentah);
  const drama = hostDramaBawaan();

  // ---------- DI DOMAIN DRAMA ----------
  if (adalahHostDrama(host)) {
    if (pathname === JALUR_DRAMA || pathname.startsWith(`${JALUR_DRAMA}/`)) {
      return { tindakan: "alih", host: "", pathname: tanpaAwalanDrama(pathname) };
    }

    if (jalurMilikDrama(pathname)) {
      return { tindakan: "tulis-ulang", pathname: JALUR_DRAMA };
    }

    // Sisanya milik portal. Nama portalnya diambil dari pengaturan portal,
    // bukan dikarang dari domain drama: keduanya memang dua domain yang
    // tidak punya hubungan nama sama sekali.
    return { tindakan: "alih", host: hostPortalBawaan(), pathname };
  }

  // ---------- DI DOMAIN LAIN ----------
  if (pathname !== JALUR_DRAMA && !pathname.startsWith(`${JALUR_DRAMA}/`)) return null;

  // Tidak ada domain drama untuk tuan rumah ini (localhost, pratayang):
  // /drama tetap dilayani di tempatnya.
  if (!hostSungguhan(host) || !drama || tanpaWww(host) === tanpaWww(drama)) return null;

  return { tindakan: "alih", host: drama, pathname: tanpaAwalanDrama(pathname) };
}
