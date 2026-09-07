// ============================================================
// ALAMAT SITUS CBT
//
// CBT tidak lagi menumpang di /cbt pada domain portal. Ia pindah ke
// subdomainnya sendiri, dan sejak itu ada dua situs di atas SATU penyebaran
// yang sama:
//
//   portal : <domain>      → layanan akademik, dashboard, login
//   CBT    : cbt.<domain>  → pintu masuk ujian dan layar ujian
//
// TIDAK ADA nama domain yang wajib tertanam di sini. Nama yang berlaku
// diambil dari header Host tiap permintaan; NEXT_PUBLIC_PORTAL_HOST dan
// NEXT_PUBLIC_CBT_HOST memaksanya bila perlu, dan nama yang tertulis di bawah
// hanyalah cadangan terakhir untuk penyebaran yang sekarang. Memasang CBT ini
// di domain lain karena itu tidak menuntut satu baris kode pun diubah.
//
// Yang membedakan keduanya hanyalah tuan rumah pada permintaan, jadi
// pengetahuan tentang "host mana milik siapa" harus tinggal di SATU tempat.
// Berkas inilah tempatnya: middleware memakainya untuk menuliskan ulang dan
// mengalihkan, panel pengajar memakainya untuk menyusun tautan ujian yang
// dibagikan ke grup kelas, dan halaman CBT memakainya untuk menunjuk balik
// ke portal.
//
// Semua fungsi di sini murni dan tidak menyentuh Node, sebab middleware
// berjalan di edge dan sebagiannya ikut terbawa ke peramban.
// ============================================================

/**
 * Tuan rumah portal, dipakai bila tidak ada petunjuk lain.
 *
 * Nama di bawah hanyalah CADANGAN TERAKHIR untuk penyebaran yang sekarang.
 * Nama sesungguhnya diambil dari header Host tiap permintaan, dan bila perlu
 * dipaksa lewat NEXT_PUBLIC_PORTAL_HOST — jadi memasang CBT ini di domain
 * mana pun tidak menuntut satu baris kode pun diubah.
 *
 * Ditulis lengkap dengan "www." karena itulah alamat yang dilayani Vercel;
 * yang tanpa www dialihkan oleh Vercel sendiri.
 */
const HOST_PORTAL_CADANGAN = "www.sipalingfisip.web.id";

/** Tuan rumah portal yang berlaku: yang disetel, atau cadangan di atas. */
export function hostPortalBawaan(): string {
  return rapikanHost(process.env.NEXT_PUBLIC_PORTAL_HOST || "") || HOST_PORTAL_CADANGAN;
}

/**
 * Domain yang subdomain CBT-nya sudah hidup.
 *
 * Diturunkan dari host portal yang berlaku, bukan ditulis kedua kalinya —
 * dua tempat yang harus diubah bersama-sama adalah satu tempat yang akan
 * terlupa.
 */
function domainPortal(): string {
  return tanpaWww(hostPortalBawaan());
}

/** Awalan yang menandai sebuah host sebagai situs CBT. */
const AWALAN_CBT = "cbt.";

/**
 * Rapikan nilai header Host menjadi nama tuan rumah saja.
 *
 * Yang dibuang: spasi, huruf besar, nomor porta, titik di ujung, dan — bila
 * ada proksi yang menumpuk nilai — semua kecuali yang pertama.
 */
export function rapikanHost(nilai: string | null | undefined): string {
  return (nilai || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .split(":")[0]
    .replace(/\.$/, "");
}

function tanpaWww(host: string) {
  return host.startsWith("www.") ? host.slice(4) : host;
}

/**
 * Host CBT yang ditetapkan lewat environment; kosong bila tidak diatur.
 *
 * Dua nama dibaca sekaligus dan itu disengaja: NEXT_PUBLIC_CBT_HOST ikut
 * sampai ke peramban sehingga panel pengajar dapat menyusun tautan ujian,
 * sedangkan CBT_HOST — nama yang lebih dulu ada — tetap dihormati supaya
 * penyebaran yang sudah memakainya tidak perlu diubah.
 *
 * Pengaturan ini adalah katup penyelamat: bila domain CBT di Vercel ternyata
 * bernama lain (mis. www.cbt.sipalingfisip.web.id), isikan nama itu di sini
 * dan seluruh tautan langsung ikut.
 */
export function hostCbtDisetel(): string {
  return rapikanHost(process.env.NEXT_PUBLIC_CBT_HOST || process.env.CBT_HOST || "");
}

/** Alamat host ini melayani situs CBT? */
export function adalahHostCbt(hostMentah: string | null | undefined): boolean {
  const host = rapikanHost(hostMentah);
  if (!host) return false;

  const disetel = hostCbtDisetel();
  if (disetel && tanpaWww(host) === tanpaWww(disetel)) return true;

  // Tanpa pengaturan pun subdomain cbt.* dikenali, termasuk bentuk
  // www.cbt.* yang kerap ikut terdaftar sendiri saat domain ditambahkan.
  return tanpaWww(host).startsWith(AWALAN_CBT);
}

/**
 * Host CBT untuk sebuah host portal.
 *
 * Kosong berarti "tidak ada subdomain CBT di sini" — dan itu jawaban yang
 * benar untuk localhost serta pratayang *.vercel.app, yang memang tidak
 * punya subdomain sendiri. Pemanggilnya lalu tetap memakai jalur /cbt
 * seperti dahulu, sehingga pengembangan lokal tidak ikut pindah alamat.
 */
export function hostCbtUntuk(hostMentah: string | null | undefined): string {
  const host = rapikanHost(hostMentah);
  if (!host) return "";
  if (adalahHostCbt(host)) return host;

  const disetel = hostCbtDisetel();
  if (disetel) return disetel;

  // Hanya domain sungguhan yang punya subdomain CBT. localhost, alamat IP,
  // dan pratayang penyebaran tidak, jadi jangan mengarang alamat untuk
  // mereka: yang lahir dari karangan itu adalah tautan yang mati.
  const domain = domainPortal();
  const inti = tanpaWww(host);
  if (inti !== domain && !inti.endsWith(`.${domain}`)) return "";

  return `${AWALAN_CBT}${domain}`;
}

/**
 * Host portal untuk sebuah host CBT — arah sebaliknya.
 *
 * Dipakai saat pengunjung situs CBT meminta halaman yang bukan miliknya
 * (mis. /login atau /dashboard): ia diantar ke portal, bukan disodori 404.
 */
export function hostPortalUntuk(hostMentah: string | null | undefined): string {
  const host = rapikanHost(hostMentah);
  if (!host || !adalahHostCbt(host)) return host;

  const inti = tanpaWww(host);
  const sisa = inti.startsWith(AWALAN_CBT) ? inti.slice(AWALAN_CBT.length) : "";
  if (!sisa || !sisa.includes(".")) return hostPortalBawaan();
  return sisa === domainPortal() ? hostPortalBawaan() : sisa;
}

/**
 * Jalur yang dilayani situs CBT pada akarnya.
 *
 * Akar adalah pintu masuk, dan /ujian adalah layar ujian — alamat yang
 * sudah terlanjur dibagikan ke grup kelas sejak sebelum pindah, sehingga ia
 * wajib tetap mendarat pada ujian yang benar.
 */
export function jalurMilikCbt(pathname: string): boolean {
  return pathname === "/" || pathname === "/ujian" || pathname.startsWith("/ujian/");
}

/**
 * Jalur milik CBT pada domain portal, yaitu yang kini pindah.
 */
export function jalurCbtLama(pathname: string): boolean {
  return (
    pathname === "/cbt" ||
    pathname.startsWith("/cbt/") ||
    pathname === "/ujian" ||
    pathname.startsWith("/ujian/")
  );
}

/**
 * Buang awalan /cbt dari sebuah jalur: "/cbt/ujian" → "/ujian", "/cbt" → "/".
 *
 * Di subdomain, /cbt adalah alamat kembar untuk halaman yang sama, dan dua
 * alamat untuk satu halaman selalu berakhir sebagai satu tangkapan layar
 * yang membingungkan di grup kelas.
 */
export function tanpaAwalanCbt(pathname: string): string {
  if (pathname === "/cbt") return "/";
  if (pathname.startsWith("/cbt/")) return pathname.slice(4);
  return pathname;
}

/**
 * Asal (protokol + host) situs CBT, dilihat dari tuan rumah yang sedang
 * dibuka. Kosong bila tidak ada subdomain CBT untuknya — dan pemanggilnya
 * lalu memakai alamat relatif seperti dahulu.
 */
export function asalCbt(hostMentah: string | null | undefined): string {
  const host = hostCbtUntuk(hostMentah);
  // Subdomain sungguhan selalu https; hanya pengembangan lokal yang tidak,
  // dan di sana hostCbtUntuk sudah memulangkan kosong.
  return host ? `https://${host}` : "";
}

/**
 * Asal portal, dilihat dari tuan rumah yang sedang dibuka. Kosong bila
 * pengunjungnya memang sudah berada di portal.
 */
export function asalPortal(hostMentah: string | null | undefined): string {
  const host = rapikanHost(hostMentah);
  if (!adalahHostCbt(host)) return "";
  const portal = hostPortalUntuk(host);
  return portal && portal !== host ? `https://${portal}` : "";
}

// ============================================================
// RENCANA RUTE
//
// Keputusan "permintaan ini dilayani di mana" dipisahkan dari middleware dan
// dijadikan fungsi murni: masuknya tuan rumah dan jalur, keluarnya rencana.
// Middleware tinggal menerjemahkan rencana itu menjadi jawaban HTTP.
//
// Alasannya satu, dan praktis: rencana yang murni dapat diuji tanpa
// menyalakan server, sehingga aturan yang menentukan ke mana peserta
// mendarat di tengah musim ujian tidak perlu dibuktikan lewat percobaan
// manual di produksi.
// ============================================================

export type RencanaRute =
  /** Biarkan lewat; permintaan sudah berada di tempatnya. */
  | { tindakan: "lewat" }
  /** Layani berkas lain tanpa mengubah alamat di bilah peramban. */
  | { tindakan: "tulis-ulang"; pathname: string }
  /** Antar ke alamat lain; host kosong berarti tuan rumah yang sama. */
  | { tindakan: "alih"; host: string; pathname: string };

/**
 * Jalur yang dipakai bersama kedua situs, jadi tidak boleh disentuh.
 *
 * /api dipanggil dari kedua sisi dengan alamat relatif, dan bundel Next.js
 * dilayani dari penyebaran yang sama. Berkas dikenali dari titik pada ruas
 * terakhir — cara sederhana yang menahan /uang-sw.js dan
 * /manifest-uang.webmanifest agar tidak ikut dialihkan.
 */
export function dipakaiBersama(pathname: string): boolean {
  if (pathname === "/api" || pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  return pathname.slice(pathname.lastIndexOf("/") + 1).includes(".");
}

/**
 * Ke mana permintaan ini seharusnya mendarat?
 *
 * Tiga hal yang dikerjakan, dan ketiganya perlu:
 *
 *   1. Di subdomain CBT, akar dan /ujian DITULISKAN ULANG ke /cbt/… —
 *      penulisan ulang, bukan pengalihan, sehingga alamat di bilah peramban
 *      tetap subdomainnya.
 *   2. Di subdomain CBT, halaman yang bukan milik CBT (mis. /login dan
 *      /dashboard) DIALIHKAN ke portal. Tanpa ini, tombol "Masuk ke
 *      dashboard" pada pintu CBT berakhir di 404.
 *   3. Di domain portal, /cbt dan /ujian DIALIHKAN ke subdomain. Inilah yang
 *      membuat kata "pindah" benar-benar berarti pindah — sekaligus menjaga
 *      tautan ujian yang sudah terlanjur dibagikan ke grup kelas tetap hidup.
 */
export function rencanaRute(hostMentah: string | null | undefined, pathname: string): RencanaRute {
  if (dipakaiBersama(pathname)) return { tindakan: "lewat" };

  const host = rapikanHost(hostMentah);

  // ---------- DI SUBDOMAIN CBT ----------
  if (adalahHostCbt(host)) {
    // /cbt di subdomain adalah alamat kembar: cbt.…/cbt/ujian dan
    // cbt.…/ujian menampilkan layar yang sama persis. Yang kembar dirapikan
    // menjadi satu bentuk, supaya tangkapan layar yang beredar di grup kelas
    // tidak saling berbeda.
    if (pathname === "/cbt" || pathname.startsWith("/cbt/")) {
      return { tindakan: "alih", host: "", pathname: tanpaAwalanCbt(pathname) };
    }

    if (jalurMilikCbt(pathname)) {
      return { tindakan: "tulis-ulang", pathname: pathname === "/" ? "/cbt" : `/cbt${pathname}` };
    }

    const portal = hostPortalUntuk(host);
    if (!portal || portal === host) return { tindakan: "lewat" };
    return { tindakan: "alih", host: portal, pathname };
  }

  // ---------- DI DOMAIN PORTAL ----------
  if (!jalurCbtLama(pathname)) return { tindakan: "lewat" };

  // Kosong berarti tidak ada subdomain CBT untuk tuan rumah ini — localhost
  // dan pratayang penyebaran. Di sana CBT tetap dilayani di /cbt seperti
  // dahulu, sebab mengalihkannya ke alamat yang tidak ada sama saja dengan
  // mematikan CBT bagi yang sedang mengembangkannya.
  const cbt = hostCbtUntuk(host);
  if (!cbt || cbt === host) return { tindakan: "lewat" };

  return { tindakan: "alih", host: cbt, pathname: tanpaAwalanCbt(pathname) };
}
