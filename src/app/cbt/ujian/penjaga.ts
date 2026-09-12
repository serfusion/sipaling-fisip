"use client";

// ============================================================
// PENJAGA LAYAR UJIAN
//
// Yang harus jelas sebelum satu baris pun dibaca:
//
//   PERAMBAN TIDAK DAPAT MELARANG TANGKAPAN LAYAR.
//
// Print Screen ditangani sistem operasi, bukan halaman. Alat potong bawaan
// Windows dan Cmd+Shift+4 di macOS bahkan tidak pernah sampai ke peramban.
// Dan tidak ada satu pun baris kode yang dapat menghalangi ponsel kedua yang
// diarahkan ke monitor.
//
// Karena itu berkas ini TIDAK berpura-pura melarang. Yang dikerjakannya lima:
//
//   MENYULITKAN — salin, potong, tempel, klik kanan, seret, dan seleksi teks
//                 dimatikan. Ini menutup jalan yang paling sering benar-benar
//                 dipakai: menyalin soal ke ChatGPT lalu menempelkan
//                 jawabannya kembali. Yang tersisa adalah mengetik ulang soal
//                 dengan tangan, dan itu memakan waktu ujian yang sama.
//   MENCEGAH    — dan sebagian benar-benar tercegah, bukan sekadar dicatat:
//                 Ctrl+P, Ctrl+S, Ctrl+U, Ctrl+R, dan Ctrl+A dibatalkan
//                 sungguhan. Yang tidak — PrintScreen, alat potong, F12 —
//                 ditandai apa adanya pada `benarTercegah` di
//                 src/lib/tombol-terlarang.ts, supaya kalimat yang sampai ke
//                 peserta tidak pernah menjanjikan lebih dari yang ada.
//   MENGOSONGKAN— begitu ada isyarat tangkapan layar, halamannya ditinggalkan,
//                 atau layar penuhnya dilepas, SOALNYA DITUTUP tirai gelap. Tangkapannya
//                 tetap terjadi; yang berubah isinya. Ini satu-satunya hal
//                 yang benar-benar dapat dikerjakan halaman web terhadap
//                 tangkapan layar, dan batasnya tertulis apa adanya pada
//                 SebabTirai di src/lib/kunci-layar.ts.
//   MENCATAT    — tiap percobaan dilaporkan ke server beserta jam servernya.
//   MENANDAI    — identitas peserta ditumpuk di atas layarnya (lihat
//                 tanda-air.tsx), sehingga tangkapan layar yang tetap berhasil
//                 diambil menunjuk satu orang.
//   MENGAKHIRI  — dan inilah yang bergigi. Halaman tidak dapat menahan tangan
//                 peserta, tetapi ujiannya ada di sini, dan yang ada di sini
//                 dapat ditutup. Tiga perbuatan berat pada ujian sertifikasi
//                 dan ujiannya dikumpulkan paksa — oleh SERVER, sesudah
//                 laporan yang dikirim dari sini sampai. Keputusannya sengaja
//                 tidak pernah dibuat di halaman ini: peserta yang mematikan
//                 JavaScript-nya akan selalu memutuskan bahwa ia bersih.
//
// Yang BENAR-BENAR menolak tangkapan layar ada satu tingkat di bawah ini:
// aplikasi ujian di lockdown/, tempat sistem operasinya sendiri yang menolak
// (FLAG_SECURE di Android, WDA_EXCLUDEFROMCAPTURE di Windows). Berkas ini
// mengenali aplikasi itu dan menyampaikannya ke layar, tetapi tidak pernah
// mengaku-aku memilikinya.
//
// Satu keputusan yang berulang di seluruh berkas ini: DETEKSI YANG RAGU LEBIH
// BAIK DIAM. Tuduhan palsu pada ujian sertifikasi jauh lebih mahal daripada
// satu kecurangan yang lolos, karena yang dirugikan adalah peserta yang jujur
// dan ia tidak punya cara membuktikan dirinya.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { aturanMode, milikPengakhiran, type JenisInsiden, type ModePengawasan } from "@/lib/pengawasan";
import { PESAN_TOMBOL, periksaTombol } from "@/lib/tombol-terlarang";
import {
  bacaKlien, TIRAI_MS, type JembatanKlien, type JenisKlien, type SebabTirai,
} from "@/lib/kunci-layar";

/**
 * Berapa lama sesudah layar ujian terbuka semua laporan lingkungan ditahan.
 *
 * Detik-detik pertama sebuah ujian BUKAN detik yang tenang, dan tidak satu pun
 * yang terjadi di dalamnya dilakukan pesertanya:
 *
 *   - permintaan layar penuh berpindah mode tampilan, dan sebagian peramban
 *     melepas fokus jendelanya sesaat ketika itu terjadi;
 *   - kotak izin kamera muncul di atas halaman dan MENGAMBIL fokusnya sampai
 *     ditekan — pada mode Sertifikasi ini selalu terjadi;
 *   - Chrome bahkan melepas layar penuh sendiri ketika menampilkan kotak izin.
 *
 * Ketiganya dahulu tercatat sebagai pelanggaran pada peserta yang belum melihat
 * satu soal pun. Itulah keluhan yang memperbaiki berkas ini: "baru masuk sudah
 * kehilangan fokus, padahal tidak melakukan apa-apa."
 *
 * Lima detik dipilih karena yang ditahan hanyalah laporannya, bukan
 * penjagaannya: tirai layar penuh tetap menutup soal dan tetap menuntut peserta
 * kembali, dan berpindah tab tetap dicatat apa adanya sejak detik pertama.
 */
const JEDA_MULA_MS = 5000;

/**
 * Berapa lama fokus harus benar-benar hilang sebelum ia dilaporkan.
 *
 * Blur yang datang lalu pulih dalam sekejap bukan orang yang pergi: ia
 * peralihan layar penuh, kotak izin yang menutup sendiri, notifikasi yang
 * lewat, atau ketukan pada bingkai video soal. Yang benar-benar berpindah ke
 * jendela lain tidak kembali dalam satu setengah detik — dan itulah yang tetap
 * tercatat.
 */
const TUNDA_BLUR_MS = 1500;

export type Penjaga = {
  /** Dipanggil dari tombol "Mulai Ujian" — layar penuh menuntut ketukan orang. */
  mulaiLayarPenuh: () => void;
  /** Keluar dari layar penuh saat ujian selesai, supaya tidak terkunci. */
  akhiriLayarPenuh: () => void;
  /** Peringatan terakhir untuk dibacakan ke peserta. Kosong berarti tidak ada. */
  peringatan: string;
  /** Sedang di luar layar penuh padahal ujiannya menuntutnya. */
  keluarLayarPenuh: boolean;
  /** Minta layar penuh lagi, dari tombol di pita peringatan. */
  ulangiLayarPenuh: () => void;
  /**
   * Soal sedang ditutup tirai, dan sebabnya. Null berarti layar terbuka.
   */
  tirai: SebabTirai | null;
  /** Perangkat yang dipakai peserta: peramban biasa, atau aplikasi terkunci. */
  klien: JenisKlien;
};

type Opsi = {
  /** Hanya menyala saat peserta benar-benar sedang mengerjakan. */
  aktif: boolean;
  mode: ModePengawasan;
  /**
   * Layarnya sudah tenang: tidak ada lagi kotak izin peramban yang menunggu
   * ditekan.
   *
   * Selama ia masih false, fokus yang hilang BUKAN peserta yang pergi
   * melainkan kotak izin kamera yang sedang berdiri di atas halaman dan
   * memegang fokusnya. Jeda mula lima detik tidak cukup menutup itu — peserta
   * yang membaca dulu kotak izinnya menekan "Izinkan" pada detik kesepuluh,
   * dan dahulu detik-detik itu menjadi pelanggaran atas namanya.
   *
   * Pemanggil yang tidak memakai kamera cukup mengisinya true.
   */
  tenang?: boolean;
  /**
   * Peserta sudah menekan "kumpulkan", dan pengumpulannya sedang berjalan.
   *
   * Sejak ketukan itu, dua hal yang terjadi pada layar BUKAN LAGI PERBUATAN
   * PESERTA melainkan perbuatan halaman ini sendiri: layar penuhnya dilepas
   * begitu ujiannya ditutup, dan fokusnya berpindah ke layar hasil. Keduanya
   * karena itu berhenti dilaporkan selama keadaan ini menyala.
   *
   * Yang TIDAK ikut berhenti: berpindah tab, tangkapan layar, tempel, alat
   * pengembang. Semuanya tetap perbuatan peserta, juga pada detik-detik
   * pengiriman, dan semuanya tetap tercatat apa adanya.
   *
   * Ia menyala hanya selama pengiriman berlangsung. Pengumpulan yang gagal —
   * jaringan putus, jawaban yang belum sampai — mengembalikannya ke false di
   * pemanggil, karena pesertanya kembali mengerjakan dan penjagaannya harus
   * kembali penuh.
   */
  mengakhiri?: boolean;
  /** Melaporkan satu insiden ke server. Balasannya dipakai sebagai peringatan. */
  lapor: (jenis: JenisInsiden, detail?: string) => Promise<string> | void;
};

/** Elemen yang memang boleh menerima ketikan. Seleksi di dalamnya dibiarkan. */
function bolehMengetik(sasaran: EventTarget | null): boolean {
  const el = sasaran as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable === true;
}

export function usePenjaga({ aktif, mode, tenang = true, mengakhiri = false, lapor }: Opsi): Penjaga {
  const aturan = aturanMode(mode);

  const [peringatan, setPeringatan] = useState("");
  const [keluarLayarPenuh, setKeluarLayarPenuh] = useState(false);
  const [tirai, setTirai] = useState<SebabTirai | null>(null);

  /**
   * Perangkat peserta, dikenali SEKALI pada gambar pertama lalu tidak pernah
   * dibaca ulang.
   *
   * Dibaca lewat penginisialisasi useState, bukan effect, karena nilainya
   * menentukan kalimat yang tertulis di layar sejak detik pertama: layar yang
   * mula-mula berkata "tangkapan layar dicatat" lalu berganti sendiri menjadi
   * "diblokir sistem" satu gambar kemudian terbaca seperti sistem yang tidak
   * yakin pada penjagaannya sendiri.
   *
   * Penjaga `typeof window` ada karena halaman ujian ini digambar server lebih
   * dulu; di sana tidak ada navigator maupun jembatan aplikasi.
   */
  const [klien] = useState<JenisKlien>(() => {
    if (typeof window === "undefined") return "peramban";
    const jendela = window as Window & { SipalingLockdown?: JembatanKlien };
    return bacaKlien({ ua: navigator.userAgent, jembatan: jendela.SipalingLockdown ?? null });
  });

  // Penghitung waktu tirai disimpan supaya isyarat kedua yang datang beruntun
  // MEMPERPANJANG tutupnya, bukan membuka layarnya lebih cepat karena
  // penghitung yang lama terlanjur habis. Menekan Print Screen tiga kali
  // berturut-turut adalah persis yang dilakukan orang ketika yang pertama
  // gagal.
  const jamTiraiRef = useRef<number | null>(null);

  /**
   * Tutup soal sesaat.
   *
   * Ini BUKAN pelarangan. Tangkapan layarnya tetap terjadi; yang berubah
   * hanyalah apa yang ada di dalamnya — bidang gelap, bukan soal. Batas
   * keberhasilannya ditulis apa adanya pada SebabTirai di
   * src/lib/kunci-layar.ts, dan tidak boleh dijanjikan lebih dari itu.
   */
  const tutupSesaat = useCallback(() => {
    setTirai("tangkap");
    if (jamTiraiRef.current) window.clearTimeout(jamTiraiRef.current);
    jamTiraiRef.current = window.setTimeout(() => {
      jamTiraiRef.current = null;
      setTirai((kini) => (kini === "tangkap" ? null : kini));
    }, TIRAI_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (jamTiraiRef.current) window.clearTimeout(jamTiraiRef.current);
    };
  }, []);

  // Pendengar peristiwa dipasang sekali dan hidup sepanjang ujian, sedangkan
  // `lapor` berganti tiap kali komponennya digambar ulang. Tanpa salinan ini
  // pendengar yang sudah terpasang memanggil versi lama yang memegang kunci
  // sesi basi — dan laporannya ditolak server persis ketika ia paling
  // dibutuhkan.
  const laporRef = useRef(lapor);
  useEffect(() => { laporRef.current = lapor; }, [lapor]);

  /**
   * Jam ketika layar mengerjakan terbuka. Nol berarti belum terbuka.
   *
   * Disimpan di ref, bukan keadaan, karena yang membacanya pendengar peristiwa
   * yang terpasang sekali dan hidup sepanjang ujian — keadaan yang dibaca dari
   * sana selalu nilai gambar pertama.
   */
  const sejakAktifRef = useRef(0);
  useEffect(() => { sejakAktifRef.current = aktif ? Date.now() : 0; }, [aktif]);

  // Dibaca dari dalam pendengar peristiwa, jadi ia harus selalu nilai terbaru.
  const tenangRef = useRef(tenang);
  useEffect(() => { tenangRef.current = tenang; }, [tenang]);

  // Dibaca dari dalam pendengar peristiwa, jadi ia harus selalu nilai terbaru.
  const mengakhiriRef = useRef(mengakhiri);
  useEffect(() => { mengakhiriRef.current = mengakhiri; }, [mengakhiri]);

  /**
   * Sedang di dalam detik-detik pembukaan yang tidak boleh dituduhkan kepada
   * siapa pun — lihat JEDA_MULA_MS dan `tenang` di atas.
   */
  const masaMula = useCallback(() => {
    const sejak = sejakAktifRef.current;
    if (sejak === 0) return true;
    if (!tenangRef.current) return true;
    return Date.now() - sejak < JEDA_MULA_MS;
  }, []);

  // Keadaan yang hanya boleh dilaporkan SEKALI. Layar kedua dan alat pengembang
  // bukan perbuatan berulang; melaporkannya tiap dua detik akan menghabiskan
  // skor integritas peserta dalam satu menit karena satu hal yang sama.
  const sudahRef = useRef<Set<string>>(new Set());

  const kirim = useCallback((jenis: JenisInsiden, detail?: string) => {
    // Ujian yang sedang ditutup melepas layar penuhnya sendiri dan memindahkan
    // fokusnya sendiri. Keduanya berhenti dicatat sejak peserta menekan
    // "kumpulkan"; sisanya tetap dicatat. Daftarnya di src/lib/pengawasan.ts.
    if (mengakhiriRef.current && milikPengakhiran(jenis)) return;
    const hasil = laporRef.current(jenis, detail);
    if (hasil && typeof (hasil as Promise<string>).then === "function") {
      void (hasil as Promise<string>).then((pesan) => {
        if (pesan) setPeringatan(pesan);
      });
    }
  }, []);

  const sekaliSaja = useCallback((jenis: JenisInsiden, detail?: string) => {
    if (sudahRef.current.has(jenis)) return;
    sudahRef.current.add(jenis);
    kirim(jenis, detail);
  }, [kirim]);

  // ---------- LAYAR PENUH ----------
  const mulaiLayarPenuh = useCallback(() => {
    if (!aturan.layarPenuh) return;
    // HARUS dari ketukan orang. Peramban menolak permintaan layar penuh yang
    // datang dari effect atau timer, dan penolakannya diam — jadi kalau ini
    // dipanggil dari tempat yang salah, ujiannya berjalan tanpa layar penuh
    // dan tidak ada yang memberi tahu siapa pun.
    void document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => undefined);
  }, [aturan.layarPenuh]);

  const akhiriLayarPenuh = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
  }, []);

  const ulangiLayarPenuh = useCallback(() => {
    setKeluarLayarPenuh(false);
    mulaiLayarPenuh();
  }, [mulaiLayarPenuh]);

  useEffect(() => {
    if (!aktif || !aturan.layarPenuh) return;
    function berubah() {
      const di = Boolean(document.fullscreenElement);
      // Tirainya dipasang SELALU, juga pada detik-detik pembukaan. Yang ditahan
      // masa mula hanya laporannya; soal yang terbuka di luar layar penuh tetap
      // tidak boleh terlihat, dan pesertanya tetap diminta kembali.
      setKeluarLayarPenuh(!di);
      if (!di && !masaMula()) kirim("fullscreen");
    }
    document.addEventListener("fullscreenchange", berubah);
    return () => document.removeEventListener("fullscreenchange", berubah);
  }, [aktif, aturan.layarPenuh, masaMula, kirim]);

  // ---------- PINDAH TAB DAN HILANG FOKUS ----------
  //
  // Dua peristiwa yang berbeda, dan bedanya penting. `visibilitychange`
  // berarti halamannya benar-benar tersembunyi — pindah tab, pindah aplikasi,
  // layar dikunci. `blur` hanya berarti fokus pindah, dan itu terjadi juga
  // karena notifikasi yang muncul sendiri. Karena itu bobotnya jauh berbeda,
  // dan blur tidak pernah ikut menghitung mundur ke pemutusan ujian.
  useEffect(() => {
    if (!aktif) return;
    function sembunyi() {
      if (document.visibilityState === "hidden") {
        kirim("tab");
        // Tirai dipasang PADA SAAT halamannya disembunyikan, bukan sesudah ia
        // kembali. Inilah yang menutup perekam layar yang dinyalakan dari
        // aplikasi lain, baris notifikasi yang ditarik untuk menekan tombol
        // rekam, dan pratinjau aplikasi yang muncul di layar "aplikasi
        // terakhir" ponsel — ketiganya menangkap halaman ini dalam keadaan
        // tersembunyi, dan ketiganya nyata.
        //
        // Dipasang hanya bila modenya memang menjaga tangkapan layar. Pada
        // mode Biasa peserta memang boleh berpindah aplikasi.
        if (aturan.jagaTangkapanLayar) setTirai("pergi");
        return;
      }
      // Kembali ke depan → tirai "pergi" dibuka sendiri. Tirai "tangkap"
      // dibiarkan, karena ia punya penghitung waktunya sendiri dan menutup
      // untuk alasan yang belum selesai.
      setTirai((kini) => (kini === "pergi" ? null : kini));
    }
    document.addEventListener("visibilitychange", sembunyi);
    return () => document.removeEventListener("visibilitychange", sembunyi);
  }, [aktif, aturan.jagaTangkapanLayar, kirim]);

  // Blur melewati TIGA saringan sebelum ia menjadi catatan atas nama peserta,
  // dan ketiganya lahir dari keluhan yang sama: "baru masuk sudah kehilangan
  // fokus, padahal tidak melakukan apa-apa."
  //
  //   1. MASA MULA — peralihan layar penuh dan kotak izin kamera keduanya
  //      merebut fokus pada detik-detik pertama, dan keduanya bukan perbuatan
  //      peserta.
  //   2. BINGKAI SOAL — fokus yang berpindah ke <iframe> DI DALAM halaman ini
  //      juga memicu blur pada window. Peserta yang menekan tombol putar pada
  //      video soalnya sedang mengerjakan soal itu, bukan meninggalkannya.
  //   3. TUNDAAN — yang pulih sendiri dalam satu setengah detik bukan orang
  //      yang pergi. Yang benar-benar pindah ke jendela lain tidak kembali
  //      secepat itu, dan ia tetap tercatat.
  //
  // Halaman yang tersembunyi juga disaring di sini: berpindah tab memicu blur
  // DAN visibilitychange sekaligus, dan yang kedua sudah mencatatnya sebagai
  // "tab" — yang jauh lebih berat. Tanpa saringan itu satu perbuatan tercatat
  // dua kali.
  useEffect(() => {
    if (!aktif || !aturan.jagaLingkungan) return;
    let jam: number | null = null;
    function batalkan() {
      if (jam !== null) { window.clearTimeout(jam); jam = null; }
    }
    function hilang() {
      if (masaMula()) return;
      const fokus = document.activeElement;
      if (fokus && fokus.tagName === "IFRAME") return;
      batalkan();
      jam = window.setTimeout(() => {
        jam = null;
        if (document.hasFocus()) return;
        if (document.visibilityState === "hidden") return;
        kirim("blur");
      }, TUNDA_BLUR_MS);
    }
    window.addEventListener("blur", hilang);
    window.addEventListener("focus", batalkan);
    return () => {
      batalkan();
      window.removeEventListener("blur", hilang);
      window.removeEventListener("focus", batalkan);
    };
  }, [aktif, aturan.jagaLingkungan, masaMula, kirim]);

  // ---------- SALIN, POTONG, TEMPEL, KLIK KANAN ----------
  useEffect(() => {
    if (!aktif || !aturan.kunciSalin) return;

    function tolakSalin(e: Event) {
      e.preventDefault();
      kirim("salin");
    }
    function tolakTempel(e: Event) {
      e.preventDefault();
      kirim("tempel");
    }
    function tolakMenu(e: Event) {
      e.preventDefault();
      kirim("klik_kanan");
    }
    function tolakSeret(e: Event) { e.preventDefault(); }
    function tolakSeleksi(e: Event) {
      // Kolom essay dikecualikan. Peserta yang mengetik jawaban panjang
      // HARUS dapat menyorot kalimatnya sendiri untuk membetulkannya; melarang
      // itu tidak menghalangi kecurangan apa pun dan hanya membuat menulis
      // essay menjadi siksaan.
      if (bolehMengetik(e.target)) return;
      e.preventDefault();
    }

    document.addEventListener("copy", tolakSalin);
    document.addEventListener("cut", tolakSalin);
    document.addEventListener("paste", tolakTempel);
    document.addEventListener("contextmenu", tolakMenu);
    document.addEventListener("dragstart", tolakSeret);
    document.addEventListener("selectstart", tolakSeleksi);
    return () => {
      document.removeEventListener("copy", tolakSalin);
      document.removeEventListener("cut", tolakSalin);
      document.removeEventListener("paste", tolakTempel);
      document.removeEventListener("contextmenu", tolakMenu);
      document.removeEventListener("dragstart", tolakSeret);
      document.removeEventListener("selectstart", tolakSeleksi);
    };
  }, [aktif, aturan.kunciSalin, kirim]);

  // ---------- TOMBOL YANG DICEGAT ----------
  //
  // Daftar lengkapnya beserta batas kejujurannya ada di
  // src/lib/tombol-terlarang.ts. Yang dikerjakan di sini hanya empat: mencegah,
  // menutup soal, mencatat, dan memberi tahu.
  useEffect(() => {
    if (!aktif || !aturan.jagaTangkapanLayar) return;

    // Satu penekanan tombol = SATU insiden.
    //
    // Pendengarnya terpasang pada keydown DAN keyup, dan itu memang perlu:
    // PrintScreen di Windows sering hanya sampai pada keyup karena
    // penekanannya dicegat sistem lebih dulu, sedangkan Win+Shift+S sampai
    // pada keduanya. Tanpa penjaga ini, satu ketukan Win+Shift+S tercatat dua
    // kali dan memotong empat puluh angka dari skor integritas peserta untuk
    // satu perbuatan — pada ujian sertifikasi, dua ketukan seperti itu sudah
    // cukup mengumpulkan ujiannya secara paksa.
    //
    // Jamnya disimpan PER NAMA KETUKAN, bukan satu untuk semuanya. Satu
    // penghitung bersama membuat F12 yang ditekan setengah detik sesudah
    // PrintScreen hilang tanpa jejak — dua perbuatan berbeda yang tercatat
    // satu.
    const terakhir = new Map<string, number>();

    function tekan(e: KeyboardEvent) {
      const putusan = periksaTombol(e, bolehMengetik(e.target));
      if (!putusan) return;

      // preventDefault dipanggil untuk SEMUANYA, termasuk yang sudah diketahui
      // tidak akan dihormati peramban. Ia tidak merugikan apa pun, dan sebagian
      // peramban lama maupun aplikasi ujian terkunci di lockdown/ memang
      // menghormatinya. Yang tidak boleh adalah MENGAKU tercegah — itu
      // diurus benarTercegah, bukan baris ini.
      e.preventDefault();
      e.stopPropagation();

      // Tombol yang ditahan sehingga berulang sendiri bukan tiga perbuatan.
      // Tanpa baris ini, menahan F12 satu setengah detik sudah cukup
      // mengumpulkan paksa ujian sertifikasi seseorang.
      if (e.repeat) return;

      // Setengah detik: cukup lebar untuk menyatukan keydown dan keyup dari
      // satu ketukan, cukup sempit untuk tetap mencatat orang yang menekan
      // tombolnya berulang-ulang dengan sengaja — dan menekannya tiga kali
      // dengan sengaja memang mengakhiri ujian sertifikasi.
      const sekarang = Date.now();
      if (sekarang - (terakhir.get(putusan.nama) ?? 0) < 500) return;
      terakhir.set(putusan.nama, sekarang);

      // Soalnya ditutup SEKARANG JUGA, sebelum apa pun yang lain.
      //
      // Untuk alat potong — Win+Shift+S dan Cmd+Shift+4 — ini hampir selalu
      // menang: sesudah pintasannya ditekan, orangnya masih harus menyeret
      // kotak seleksi, dan itu jauh lebih lama daripada satu gambar ulang.
      // Untuk Print Screen sering TIDAK sempat: sistem sudah menyalin layarnya
      // pada saat tombolnya turun. Keduanya tetap dijalankan lewat jalan yang
      // sama, karena yang kalah pun tidak merugikan apa pun — dan yang
      // menang menyelamatkan satu soal.
      if (putusan.tirai) tutupSesaat();

      if (putusan.insiden) {
        kirim(putusan.insiden, putusan.nama);
      } else {
        // Tidak dilaporkan, jadi tidak ada balasan server yang dapat
        // dibacakan. Kalimatnya ditulis di sini supaya peserta yang menekan F5
        // tidak mengira halamannya rusak lalu menekannya sepuluh kali lagi.
        setPeringatan(PESAN_TOMBOL[putusan.golongan]);
      }

      // Di Windows, PrintScreen menyalin layar ke papan klip. Menimpanya
      // adalah satu-satunya tindakan nyata yang dapat dilakukan halaman ini,
      // dan ia hanya berhasil bila halamannya sedang fokus dan perambannya
      // mengizinkan. Gagal pun tidak apa-apa: laporannya sudah terkirim.
      if (putusan.golongan === "tangkap" && !putusan.benarTercegah) {
        try {
          void navigator.clipboard?.writeText(
            "Tangkapan layar selama ujian dilarang dan sudah dicatat pengawas.",
          ).catch(() => undefined);
        } catch { /* papan klip tidak selalu tersedia; diabaikan */ }
      }
    }

    // ---------- MENU CETAK ----------
    // Ctrl+P dicegat pendengar di atas, tetapi menu Cetak peramban tidak
    // pernah melewati papan ketik sama sekali — pendengar tombol mana pun
    // tidak akan tahu. `beforeprint` yang menangkapnya, dan aturan @media
    // print di globals.css yang benar-benar mengosongkan hasil cetaknya.
    function sebelumCetak() {
      kirim("tangkap", "cetak halaman");
      tutupSesaat();
    }

    // Kursor meninggalkan halaman ke arah bilah sistem — awal dari hampir
    // setiap alat potong yang dibuka lewat menu, bukan lewat pintasan. Murah,
    // dan menutup jeda sebelum fokus benar-benar berpindah.
    function keluarHalaman(e: MouseEvent) {
      if (e.relatedTarget === null) tutupSesaat();
    }

    // Fase TANGKAP, dan pada window sekaligus dokumen: satu penangan lain yang
    // memanggil stopPropagation lebih dulu akan membuat pendengar biasa tidak
    // pernah terpanggil sama sekali.
    const pilihan = { capture: true } as const;
    window.addEventListener("keyup", tekan, pilihan);
    window.addEventListener("keydown", tekan, pilihan);
    document.addEventListener("keydown", tekan, pilihan);
    window.addEventListener("beforeprint", sebelumCetak);
    document.addEventListener("mouseout", keluarHalaman);
    return () => {
      window.removeEventListener("keyup", tekan, pilihan);
      window.removeEventListener("keydown", tekan, pilihan);
      document.removeEventListener("keydown", tekan, pilihan);
      window.removeEventListener("beforeprint", sebelumCetak);
      document.removeEventListener("mouseout", keluarHalaman);
    };
  }, [aktif, aturan.jagaTangkapanLayar, kirim, tutupSesaat]);

  // ---------- LINGKUNGAN: LAYAR KEDUA ----------
  //
  // Monitor kedua adalah susunan curang yang paling sering dipakai: soal di
  // satu layar, jawaban di layar sebelahnya. `isExtended` menjawabnya tanpa
  // meminta izin apa pun dan tanpa tahu isi layarnya — hanya "ada lebih dari
  // satu layar" atau tidak.
  //
  // Ia hanya ada di peramban berbasis Chromium. Di peramban lain nilainya
  // undefined, dan yang benar dilakukan adalah DIAM, bukan menebak.
  useEffect(() => {
    if (!aktif || !aturan.jagaLingkungan) return;
    const layar = window.screen as Screen & { isExtended?: boolean };
    if (layar.isExtended === true) sekaliSaja("layar_kedua");
  }, [aktif, aturan.jagaLingkungan, sekaliSaja]);

  // ---------- LINGKUNGAN: ALAT PENGEMBANG ----------
  //
  // Caranya sengaja yang paling sunyi dan paling sedikit salahnya: sebuah
  // objek dicetak ke konsol, dan salah satu propertinya berupa getter. Getter
  // itu hanya terpanggil bila ADA yang menggambar objeknya — dan satu-satunya
  // yang menggambarnya adalah panel konsol yang terbuka.
  //
  // Cara yang lebih populer — membandingkan outerHeight dengan innerHeight —
  // sengaja TIDAK dipakai. Ia ikut menyala karena bilah markah, karena zoom,
  // dan karena bilah terjemahan; dan tuduhan palsu berbobot tiga puluh poin
  // pada ujian sertifikasi adalah kerugian yang tidak sepadan dengan
  // tambahan deteksinya.
  useEffect(() => {
    if (!aktif || !aturan.jagaLingkungan) return;
    let hidup = true;
    const umpan = new Image();
    Object.defineProperty(umpan, "id", {
      get() {
        if (hidup) sekaliSaja("devtools");
        return "";
      },
    });
    const jam = window.setInterval(() => {
      // console.log dipakai apa adanya. Ia tidak terlihat siapa pun kecuali
      // orang yang memang sedang membuka konsolnya — dan itu justru intinya.
      console.log(umpan);
      console.clear();
    }, 3000);
    return () => { hidup = false; window.clearInterval(jam); };
  }, [aktif, aturan.jagaLingkungan, sekaliSaja]);

  // Peringatan menghilang sendiri. Pita merah yang menetap sepanjang ujian
  // berhenti dibaca pada menit kedua, dan yang tertinggal hanya satu hal yang
  // menutupi soal.
  useEffect(() => {
    if (!peringatan) return;
    const jam = window.setTimeout(() => setPeringatan(""), 6000);
    return () => window.clearTimeout(jam);
  }, [peringatan]);

  // Keluar dari layar penuh MENUTUP SOALNYA dan menahannya tertutup — bukan
  // sekadar memasang pita peringatan yang dapat dibiarkan sambil terus membaca
  // soal di jendela biasa lengkap dengan bilah alamat yang siap ditangkap.
  //
  // Tirai ini menang atas tirai lain karena ia satu-satunya yang tidak membuka
  // dirinya sendiri: yang lain berakhir sesudah dua detik, dan berakhirnya di
  // sini berarti soal terbuka lagi pada layar yang masih di luar layar penuh.
  //
  // Ia hanya mungkin muncul SESUDAH satu peristiwa fullscreenchange menyatakan
  // layar penuhnya keluar — artinya layar penuh pernah berhasil di perangkat
  // itu, jadi menyalakannya kembali pun akan berhasil. Peramban yang memang
  // tidak punya layar penuh (Safari di iPhone) tidak pernah mengirim
  // peristiwa itu, dan pesertanya tidak pernah terkurung di balik tirai yang
  // tidak dapat dibukanya.
  const diLuarLayarPenuh = aktif && aturan.layarPenuh && keluarLayarPenuh;

  return {
    mulaiLayarPenuh, akhiriLayarPenuh, peringatan,
    keluarLayarPenuh: diLuarLayarPenuh, ulangiLayarPenuh, klien,
    // Disaring di sini, bukan dibersihkan lewat effect ketika ujiannya
    // berakhir. Tirai yang tertinggal menutupi halaman hasil membuat peserta
    // mengira ujiannya menggantung — dan menutupnya lewat effect berarti ada
    // satu gambar di antaranya tempat bidang gelap itu masih ada.
    tirai: diLuarLayarPenuh ? "layar" : aktif ? tirai : null,
  };
}
