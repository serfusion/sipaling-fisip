"use client";

// ============================================================
// REKAMAN SUARA — LAYAR PESERTA
//
// Menyala hanya pada ujian yang dosennya memang menyalakan perekaman.
// Empat hal menentukan rancangannya, dan tiga di antaranya justru MEMBATASI
// apa yang dikerjakannya.
//
//   1. TIDAK MENGGAMBAR APA PUN. Atas permintaan pemilik sistem, layar
//      peserta tidak memuat satu pun tanda bahwa suaranya direkam: tidak ada
//      lencana, tidak ada pemberitahuan sebelum mulai, tidak ada pesan galat
//      ketika mikrofonnya gagal.
//
//      Satu hal yang tetap TIDAK dapat disembunyikan kode mana pun: kotak
//      izin mikrofon milik peramban, yang muncul sendiri pada permintaan
//      pertama. Pemberitahuan kepada yang direkam juga diwajibkan sebagian
//      besar aturan perlindungan data; tempatnya sekarang di tata tertib
//      ujian, di luar layar ini.
//
//   2. POTONGAN, BUKAN SATU BERKAS. Dua puluh detik sekali, langsung dikirim.
//      Jaringan kampus putus, dan rekaman yang baru dikirim pada akhir ujian
//      akan hilang seluruhnya ketika itu terjadi. Yang sudah sampai tetap ada.
//
//   3. MIKROFON YANG GAGAL TIDAK PERNAH MENGHENTIKAN UJIAN. Izin ditolak,
//      perangkat tanpa mikrofon, peramban yang tidak mengenal MediaRecorder —
//      semuanya DICATAT lalu ujiannya diteruskan. Menghentikan ujian seseorang
//      karena mikrofonnya bermasalah menghukum peserta atas perangkatnya, dan
//      yang paling sering mengalaminya adalah yang perangkatnya paling murah.
//
//   4. SUARANYA TIDAK DIPERIKSA DI SINI. Tidak ada pengenalan kata, tidak ada
//      panggilan model, tidak ada apa pun yang berjalan di perangkat peserta
//      selain merekam dan mengirim. Pemeriksaan berjalan nanti, di server,
//      ketika dosen memintanya — dan pada perangkat yang sudah menanggung satu
//      ujian, itu perbedaan antara berjalan lancar dan tersendat.
// ============================================================

import { useCallback, useEffect, useRef } from "react";

/** Panjang satu potongan. Sama dengan DETIK_POTONGAN di src/lib/rekaman.ts. */
const DETIK_POTONGAN = 20;

/**
 * Bentuk yang dicoba, berurutan.
 *
 * WebM/Opus lebih dulu karena paling kecil dan didukung hampir semua peramban.
 * MP4 ada untuk Safari, yang pada sebagian versi hanya menghasilkan itu.
 * Yang terakhir tanpa penyebutan bentuk sama sekali — biar perambannya sendiri
 * yang memilih, dan itu lebih baik daripada tidak merekam apa-apa.
 */
const BENTUK = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg", ""];

type Sifat = {
  /** Menyala hanya saat peserta benar-benar sedang mengerjakan. */
  aktif: boolean;
  kunciSesi: string;
  /**
   * Dipanggil sekali begitu kotak izin mikrofon selesai — diizinkan, ditolak,
   * atau gagal; ketiganya sama saja bagi yang menunggunya.
   *
   * Yang menunggu adalah penjaga layar. Selama kotak izin peramban berdiri di
   * atas halaman, fokus jendela ada padanya, dan fokus yang hilang karena
   * kotak itu pernah tercatat sebagai pelanggaran atas nama peserta yang belum
   * melihat satu soal pun.
   */
  selesaiIzin?: () => void;
};

function bentukTerdukung(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const b of BENTUK) {
    if (b === "") return "";
    try {
      if (MediaRecorder.isTypeSupported(b)) return b;
    } catch {
      // isTypeSupported sendiri dapat melempar pada peramban tertentu.
    }
  }
  return "";
}

export default function MikrofonPengawas({ aktif, kunciSesi, selesaiIzin }: Sifat) {
  const aliranRef = useRef<MediaStream | null>(null);
  const perekamRef = useRef<MediaRecorder | null>(null);
  const kunciRef = useRef(kunciSesi);
  const berhentiRef = useRef(false);

  useEffect(() => { kunciRef.current = kunciSesi; }, [kunciSesi]);

  const selesaiRef = useRef(selesaiIzin);
  useEffect(() => { selesaiRef.current = selesaiIzin; }, [selesaiIzin]);

  /** Laporkan mikrofon yang gagal. Selalu diam — peserta tidak perlu cemas. */
  const laporGagal = useCallback(async (jenis: "ditolak" | "gagal", sebab: string) => {
    try {
      await fetch("/api/cbt/rekaman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "gagal", kunciSesi: kunciRef.current, jenis, sebab }),
        keepalive: true,
      });
    } catch {
      // Laporan yang gagal terkirim tidak berakibat apa pun di layar
      // peserta — tidak ada yang ditampilkan di sana.
    }
  }, []);

  /** Kirim satu potongan. Gagal kirim tidak menghentikan rekaman berikutnya. */
  const kirim = useCallback(async (blob: Blob) => {
    if (blob.size === 0) return;
    try {
      const bita = new Uint8Array(await blob.arrayBuffer());
      // Disusun per potongan 8 KB, bukan lewat spread satu kali. String.fromCharCode
      // dengan seratus ribu argumen sekaligus melampaui batas tumpukan
      // argumen peramban, dan yang terjadi adalah galat pada potongan yang
      // kebetulan besar — tidak pada yang kecil, jadi ia lolos dari pengujian.
      let biner = "";
      for (let i = 0; i < bita.length; i += 8192) {
        biner += String.fromCharCode(...bita.subarray(i, i + 8192));
      }
      const jawab = await fetch("/api/cbt/rekaman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "potongan",
          kunciSesi: kunciRef.current,
          jenis: blob.type ? blob.type.split(";")[0] : "audio/webm",
          detik: DETIK_POTONGAN,
          data: btoa(biner),
        }),
      });
      const data = await jawab.json().catch(() => ({}));
      // Server dapat menyuruh berhenti: dosennya mematikan saklar, atau batas
      // panjang rekaman tercapai. Peramban menurut, tanpa memberi tahu peserta
      // apa pun — yang berubah bukan urusannya.
      if (data?.berhenti) {
        berhentiRef.current = true;
        try { perekamRef.current?.stop(); } catch { /* sudah berhenti */ }
      }
    } catch {
      // Potongan yang hilang adalah dua puluh detik. Yang berikutnya tetap
      // dikirim dua puluh detik lagi.
    }
  }, []);

  // ---------- NYALAKAN / MATIKAN ----------
  useEffect(() => {
    if (!aktif || !kunciSesi) return;

    let hidup = true;
    berhentiRef.current = false;

    const matikan = () => {
      try { perekamRef.current?.stop(); } catch { /* sudah berhenti */ }
      perekamRef.current = null;
      for (const jalur of aliranRef.current?.getTracks() ?? []) {
        try { jalur.stop(); } catch { /* diabaikan */ }
      }
      aliranRef.current = null;
    };

    void (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        void laporGagal("gagal", "Peramban tidak mendukung perekaman.");
        selesaiRef.current?.();
        return;
      }

      let aliran: MediaStream;
      try {
        aliran = await navigator.mediaDevices.getUserMedia({
          audio: {
            // Peredam gaung dan derau dinyalakan. Yang direkam ruang ujian
            // yang sunyi, dan yang perlu terdengar adalah suara orang — bukan
            // kipas angin dan dengung lampu selama sembilan puluh menit.
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (galat: unknown) {
        const nama = (galat as { name?: string })?.name ?? "";
        const ditolak = nama === "NotAllowedError" || nama === "SecurityError";
        void laporGagal(ditolak ? "ditolak" : "gagal", nama || "getUserMedia gagal");
        selesaiRef.current?.();
        return;
      }

      // Izin sudah selesai — penjaga layar boleh kembali menghitung
      // kehilangan fokus sebagai pelanggaran.
      selesaiRef.current?.();

      if (!hidup) {
        for (const jalur of aliran.getTracks()) jalur.stop();
        return;
      }
      aliranRef.current = aliran;

      const bentuk = bentukTerdukung();
      let perekam: MediaRecorder;
      try {
        perekam = bentuk ? new MediaRecorder(aliran, { mimeType: bentuk }) : new MediaRecorder(aliran);
      } catch {
        void laporGagal("gagal", "MediaRecorder tidak dapat dibuat.");
        for (const jalur of aliran.getTracks()) jalur.stop();
        return;
      }

      perekamRef.current = perekam;
      perekam.ondataavailable = (e) => { if (e.data && e.data.size > 0) void kirim(e.data); };
      perekam.onerror = () => {
        void laporGagal("gagal", "Perekam berhenti dengan galat.");
      };

      // Potongan dihasilkan sendiri tiap DETIK_POTONGAN detik. `timeslice`
      // pada start() adalah satu-satunya cara memperoleh potongan yang
      // MASING-MASING dapat diputar sendiri; memanggil stop/start berulang
      // akan menghasilkan kepingan tanpa kepala wadah yang tidak dapat dibuka
      // pemutar mana pun.
      try {
        perekam.start(DETIK_POTONGAN * 1000);
      } catch {
        void laporGagal("gagal", "Perekam tidak dapat dimulai.");
      }
    })();

    return () => {
      hidup = false;
      matikan();
      // Tutup rekamannya di server. keepalive supaya permintaan ini tetap
      // terkirim walau halamannya sedang ditutup — dan halaman ujian memang
      // ditutup tepat sesudah peserta menekan kumpulkan.
      try {
        void fetch("/api/cbt/rekaman", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aksi: "tutup", kunciSesi: kunciRef.current }),
          keepalive: true,
        });
      } catch {
        // Rekaman yang tidak sempat ditutup tetap lengkap isinya; yang
        // tertinggal hanya statusnya, dan dosen tetap dapat memutarnya.
      }
    };
  }, [aktif, kunciSesi, kirim, laporGagal]);

  // TIDAK menggambar apa pun. Perekamannya berjalan di effect di atas;
  // keadaan dan jamnya tetap dihitung karena pengajar membacanya lewat laporan
  // server, bukan karena ada yang ditampilkan di sini.
  return null;
}
