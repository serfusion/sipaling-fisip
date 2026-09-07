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
// Karena itu berkas ini TIDAK berpura-pura melarang. Yang dikerjakannya tiga:
//
//   MENYULITKAN — salin, potong, tempel, klik kanan, seret, dan seleksi teks
//                 dimatikan. Ini menutup jalan yang paling sering benar-benar
//                 dipakai: menyalin soal ke ChatGPT lalu menempelkan
//                 jawabannya kembali. Yang tersisa adalah mengetik ulang soal
//                 dengan tangan, dan itu memakan waktu ujian yang sama.
//   MENCATAT    — tiap percobaan dilaporkan ke server beserta jam servernya.
//   MENANDAI    — identitas peserta ditumpuk di atas layarnya (lihat
//                 tanda-air.tsx), sehingga tangkapan layar yang tetap berhasil
//                 diambil menunjuk satu orang.
//
// Satu keputusan yang berulang di seluruh berkas ini: DETEKSI YANG RAGU LEBIH
// BAIK DIAM. Tuduhan palsu pada ujian sertifikasi jauh lebih mahal daripada
// satu kecurangan yang lolos, karena yang dirugikan adalah peserta yang jujur
// dan ia tidak punya cara membuktikan dirinya.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { aturanMode, type JenisInsiden, type ModePengawasan } from "@/lib/pengawasan";

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
};

type Opsi = {
  /** Hanya menyala saat mahasiswa benar-benar sedang mengerjakan. */
  aktif: boolean;
  mode: ModePengawasan;
  /** Melaporkan satu insiden ke server. Balasannya dipakai sebagai peringatan. */
  lapor: (jenis: JenisInsiden, detail?: string) => Promise<string> | void;
};

/** Elemen yang memang boleh menerima ketikan. Seleksi di dalamnya dibiarkan. */
function bolehMengetik(sasaran: EventTarget | null): boolean {
  const el = sasaran as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable === true;
}

export function usePenjaga({ aktif, mode, lapor }: Opsi): Penjaga {
  const aturan = aturanMode(mode);

  const [peringatan, setPeringatan] = useState("");
  const [keluarLayarPenuh, setKeluarLayarPenuh] = useState(false);

  // Pendengar peristiwa dipasang sekali dan hidup sepanjang ujian, sedangkan
  // `lapor` berganti tiap kali komponennya digambar ulang. Tanpa salinan ini
  // pendengar yang sudah terpasang memanggil versi lama yang memegang kunci
  // sesi basi — dan laporannya ditolak server persis ketika ia paling
  // dibutuhkan.
  const laporRef = useRef(lapor);
  useEffect(() => { laporRef.current = lapor; }, [lapor]);

  // Keadaan yang hanya boleh dilaporkan SEKALI. Layar kedua dan alat pengembang
  // bukan perbuatan berulang; melaporkannya tiap dua detik akan menghabiskan
  // skor integritas peserta dalam satu menit karena satu hal yang sama.
  const sudahRef = useRef<Set<string>>(new Set());

  const kirim = useCallback((jenis: JenisInsiden, detail?: string) => {
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
      setKeluarLayarPenuh(!di);
      if (!di) kirim("fullscreen");
    }
    document.addEventListener("fullscreenchange", berubah);
    return () => document.removeEventListener("fullscreenchange", berubah);
  }, [aktif, aturan.layarPenuh, kirim]);

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
      if (document.visibilityState === "hidden") kirim("tab");
    }
    document.addEventListener("visibilitychange", sembunyi);
    return () => document.removeEventListener("visibilitychange", sembunyi);
  }, [aktif, kirim]);

  useEffect(() => {
    if (!aktif || !aturan.jagaLingkungan) return;
    function hilang() { kirim("blur"); }
    window.addEventListener("blur", hilang);
    return () => window.removeEventListener("blur", hilang);
  }, [aktif, aturan.jagaLingkungan, kirim]);

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
      // Kolom essay dikecualikan. Mahasiswa yang mengetik jawaban panjang
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

  // ---------- TOMBOL TANGKAPAN LAYAR ----------
  useEffect(() => {
    if (!aktif || !aturan.jagaTangkapanLayar) return;

    function tekan(e: KeyboardEvent) {
      const kunci = e.key;
      // Windows dan Linux. PrintScreen sering hanya muncul pada keyup, karena
      // penekanannya dicegat sistem operasi sebelum keydown sampai ke halaman.
      const cetak = kunci === "PrintScreen" || kunci === "Print";
      // Windows: Win+Shift+S membuka alat potong. macOS: Cmd+Shift+3/4/5.
      // Yang macOS sering TIDAK PERNAH sampai ke sini — sistemnya menelan
      // kombinasi itu lebih dulu — dan itu memang batasnya.
      const potong = e.metaKey && e.shiftKey && ["s", "S", "3", "4", "5"].includes(kunci);
      if (!cetak && !potong) return;

      e.preventDefault();
      kirim("tangkap", cetak ? "PrintScreen" : `Meta+Shift+${kunci}`);

      // Di Windows, PrintScreen menyalin layar ke papan klip. Menimpanya
      // adalah satu-satunya tindakan nyata yang dapat dilakukan halaman ini,
      // dan ia hanya berhasil bila halamannya sedang fokus dan perambannya
      // mengizinkan. Gagal pun tidak apa-apa: laporannya sudah terkirim.
      try {
        void navigator.clipboard?.writeText(
          "Tangkapan layar selama ujian dilarang dan sudah dicatat pengawas.",
        ).catch(() => undefined);
      } catch { /* papan klip tidak selalu tersedia; diabaikan */ }
    }

    window.addEventListener("keyup", tekan);
    window.addEventListener("keydown", tekan);
    return () => {
      window.removeEventListener("keyup", tekan);
      window.removeEventListener("keydown", tekan);
    };
  }, [aktif, aturan.jagaTangkapanLayar, kirim]);

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

  return { mulaiLayarPenuh, akhiriLayarPenuh, peringatan, keluarLayarPenuh, ulangiLayarPenuh };
}
