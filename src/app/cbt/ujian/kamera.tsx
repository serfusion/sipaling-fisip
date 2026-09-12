"use client";

// ============================================================
// KAMERA PENGAWASAN — LAYAR PESERTA
//
// Dipakai hanya pada mode Sertifikasi/OSCE. Tiga hal yang menentukan
// rancangannya, dan dua di antaranya justru MEMBATASI apa yang dikerjakannya.
//
//   1. PESERTA HARUS MELIHAT DIRINYA SENDIRI. Gambar kameranya ditampilkan
//      kecil di sudut, menyala, sepanjang ujian. Pengawasan yang disembunyikan
//      dari orang yang diawasi bukan hanya persoalan hukum di banyak tempat —
//      ia juga membuang seluruh daya cegahnya. Yang menghentikan orang bukan
//      kamera yang diam-diam merekam, melainkan kamera yang jelas terlihat.
//
//   2. YANG MURAH DIKERJAKAN DI SINI. Lensa tertutup dan gambar beku dikenali
//      dari piksel di perangkat ini juga, tanpa satu byte pun meninggalkan
//      perangkatnya dan tanpa satu panggilan model. Hanya cuplikan yang
//      benar-benar meragukan yang dikirim — dan itulah sebabnya pengawasan ini
//      tidak menghabiskan tagihan.
//
//   3. KAMERA YANG GAGAL TIDAK PERNAH MENGHENTIKAN UJIAN. Izin ditolak, kamera
//      dipakai aplikasi lain, perangkat tanpa kamera sama sekali — semuanya
//      DICATAT lalu ujiannya diteruskan. Menghentikan ujian sertifikasi orang
//      karena kameranya bermasalah menghukum peserta atas perangkatnya, dan
//      yang paling sering mengalaminya adalah yang perangkatnya paling murah.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  beku, ciriCuplikan, putuskanCuplikan, type CiriCuplikan,
} from "@/lib/awas-kamera";
import type { JenisInsiden } from "@/lib/pengawasan";

/** Selang antarcuplikan. */
const JEDA_CUPLIK_MS = 20_000;
/** Selang pemeriksaan model berkala, di luar yang dipicu kecurigaan. */
const JEDA_BERKALA_MS = 5 * 60_000;
/** Ukuran cuplikan. Kecil dengan sengaja — cukup untuk menghitung orang. */
const LEBAR = 320;
const TINGGI = 240;

type Sifat = {
  /** Menyala hanya saat peserta benar-benar sedang mengerjakan. */
  aktif: boolean;
  kunciSesi: string;
  /** Melaporkan insiden yang sudah pasti, tanpa gambar dan tanpa model. */
  lapor: (jenis: JenisInsiden, detail?: string) => void;
  /**
   * Dipanggil sekali begitu kotak izin kamera selesai — diizinkan, ditolak,
   * atau gagal; ketiganya sama saja bagi yang menunggunya.
   *
   * Yang menunggu adalah penjaga layar: selama kotak izin peramban berdiri di
   * atas halaman, fokus jendela ada padanya, dan fokus yang hilang karena kotak
   * itu pernah tercatat sebagai pelanggaran atas nama peserta yang belum
   * melihat satu soal pun. Lihat `tenang` di penjaga.ts.
   */
  selesaiIzin?: () => void;
};

type Keadaan = "menunggu" | "hidup" | "ditolak" | "gagal";

export default function KameraPengawas({ aktif, kunciSesi, lapor, selesaiIzin }: Sifat) {
  const [keadaan, setKeadaan] = useState<Keadaan>("menunggu");
  const [pesan, setPesan] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const aliranRef = useRef<MediaStream | null>(null);
  const kanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sebelumnyaRef = useRef<Uint8ClampedArray | null>(null);
  const bekuBerturutRef = useRef(0);
  const berkalaRef = useRef(0);
  const laporRef = useRef(lapor);
  const kunciRef = useRef(kunciSesi);
  // Keadaan yang hanya dilaporkan sekali per giliran, supaya lensa yang
  // tertutup sepanjang ujian tidak menghasilkan dua ratus catatan yang sama.
  const catatTerakhirRef = useRef<Record<string, number>>({});

  useEffect(() => { laporRef.current = lapor; }, [lapor]);
  useEffect(() => { kunciRef.current = kunciSesi; }, [kunciSesi]);

  // Disalin ke ref supaya menyalakan kamera tidak bergantung pada identitas
  // fungsinya: pemanggil yang menggambar ulang akan mematikan lalu menyalakan
  // kameranya sendiri — lampu kamera yang berkedip di tengah ujian.
  const selesaiRef = useRef(selesaiIzin);
  useEffect(() => { selesaiRef.current = selesaiIzin; }, [selesaiIzin]);

  /** Laporkan satu keadaan, paling sering sekali tiap dua menit. */
  const laporSekali = useCallback((jenis: JenisInsiden, detail: string) => {
    const kini = Date.now();
    const lalu = catatTerakhirRef.current[jenis] ?? 0;
    if (kini - lalu < 120_000) return;
    catatTerakhirRef.current[jenis] = kini;
    laporRef.current(jenis, detail);
  }, []);

  // ---------- NYALAKAN ----------
  useEffect(() => {
    if (!aktif) return;
    let hidup = true;

    void (async () => {
      try {
        const aliran = await navigator.mediaDevices.getUserMedia({
          video: { width: LEBAR, height: TINGGI, facingMode: "user" },
          audio: false,
        });
        // Kotak izinnya sudah ditekan. Dikabarkan SEBELUM apa pun yang lain,
        // termasuk sebelum penjaga `hidup`: yang menunggu kabar ini hanya ingin
        // tahu bahwa fokus jendela sudah kembali ke halaman, dan itu benar
        // bahkan ketika komponennya telanjur dilepas.
        selesaiRef.current?.();
        if (!hidup) {
          aliran.getTracks().forEach((t) => t.stop());
          return;
        }
        aliranRef.current = aliran;
        if (videoRef.current) {
          videoRef.current.srcObject = aliran;
          void videoRef.current.play().catch(() => undefined);
        }
        setKeadaan("hidup");

        // Kamera yang dimatikan di tengah ujian — izin dicabut lewat setelan
        // peramban, atau kabel webcam dicabut — memicu "ended" pada jalurnya.
        aliran.getVideoTracks().forEach((jalur) => {
          jalur.addEventListener("ended", () => {
            setKeadaan("gagal");
            setPesan("Kamera terputus. Sambungkan kembali; kejadian ini dicatat.");
            laporSekali("kamera_mati", "jalur kamera berhenti di tengah ujian");
          });
        });
      } catch (alasan: unknown) {
        // Ditolak pun kotak izinnya sudah ditutup, dan fokusnya sudah kembali.
        selesaiRef.current?.();
        if (!hidup) return;
        const nama = alasan instanceof Error ? alasan.name : "";
        const ditolak = nama === "NotAllowedError" || nama === "SecurityError";
        setKeadaan(ditolak ? "ditolak" : "gagal");
        setPesan(
          ditolak
            ? "Izin kamera ditolak. Ujian tetap berjalan, tetapi ketiadaan kamera dicatat pengawas."
            : "Kamera tidak dapat dibuka. Ujian tetap berjalan, dan kejadian ini dicatat.",
        );
        laporSekali("kamera_mati", ditolak ? "izin kamera ditolak" : `kamera gagal dibuka (${nama})`);
      }
    })();

    return () => {
      hidup = false;
      aliranRef.current?.getTracks().forEach((t) => t.stop());
      aliranRef.current = null;
    };
  }, [aktif, laporSekali]);

  /** Ambil satu cuplikan dan periksa. */
  const cuplik = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    if (!kanvasRef.current) {
      kanvasRef.current = document.createElement("canvas");
      kanvasRef.current.width = LEBAR;
      kanvasRef.current.height = TINGGI;
    }
    const kanvas = kanvasRef.current;
    const ctx = kanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, LEBAR, TINGGI);

    let ciri: CiriCuplikan;
    let piksel: Uint8ClampedArray;
    try {
      piksel = ctx.getImageData(0, 0, LEBAR, TINGGI).data;
      ciri = ciriCuplikan(piksel, sebelumnyaRef.current);
    } catch {
      // Kanvas yang "ternoda" oleh sumber lintas-asal menolak dibaca. Tidak
      // terjadi pada aliran kamera sendiri, tetapi gagal membaca piksel bukan
      // alasan menghentikan apa pun.
      return;
    }
    sebelumnyaRef.current = piksel;
    bekuBerturutRef.current = beku(ciri) ? bekuBerturutRef.current + 1 : 0;

    // FaceDetector hanya ada di sebagian peramban. Yang tidak punya menjawab
    // null — "tidak tahu" — dan tidak tahu tidak pernah menjadi tuduhan.
    let wajah: number | null = null;
    const Pendeteksi = (window as unknown as {
      FaceDetector?: new (opsi?: unknown) => { detect: (s: CanvasImageSource) => Promise<unknown[]> };
    }).FaceDetector;
    if (Pendeteksi) {
      try {
        const hasil = await new Pendeteksi({ fastMode: true }).detect(kanvas);
        wajah = Array.isArray(hasil) ? hasil.length : null;
      } catch {
        wajah = null;
      }
    }

    const kini = Date.now();
    const jadwalnya = kini - berkalaRef.current >= JEDA_BERKALA_MS;
    const putusan = putuskanCuplikan(ciri, bekuBerturutRef.current, wajah, jadwalnya);

    // ---------- SUDAH PASTI: DICATAT DI SINI, TANPA GAMBAR ----------
    if (putusan.tindakan === "catat") {
      laporSekali(putusan.jenis, putusan.alasan);
      // Hitungannya disetel ulang, supaya lensa yang dibuka lagi lalu ditutup
      // lagi terbaca sebagai dua kejadian, bukan satu yang tidak habis-habis.
      bekuBerturutRef.current = 0;
      return;
    }
    if (putusan.tindakan === "abaikan") return;

    // ---------- MERAGUKAN: DIKIRIM KE MODEL ----------
    berkalaRef.current = kini;
    const jpeg = kanvas.toDataURL("image/jpeg", 0.6).split(",")[1] || "";
    if (!jpeg) return;
    try {
      const jawab = await fetch("/api/cbt/awasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kunciSesi: kunciRef.current, cuplikan: [jpeg] }),
      });
      const data = await jawab.json();
      if (data?.pesan) setPesan(String(data.pesan));
    } catch {
      // Jaringan yang terputus bukan urusan peserta. Yang hilang satu
      // pemeriksaan; yang tidak boleh hilang pekerjaannya.
    }
  }, [laporSekali]);

  // ---------- DENYUT CUPLIKAN ----------
  // Diletakkan SESUDAH `cuplik` dideklarasikan. Effect yang memanggil fungsi
  // yang dideklarasikan di bawahnya ditolak React Compiler.
  useEffect(() => {
    if (!aktif || keadaan !== "hidup") return;
    const jam = window.setInterval(() => { void cuplik(); }, JEDA_CUPLIK_MS);
    return () => window.clearInterval(jam);
  }, [aktif, keadaan, cuplik]);

  if (!aktif) return null;

  return (
    <div className={`uj-kam uj-kam-${keadaan}`}>
      {/* muted dan playsInline wajib: tanpa keduanya sebagian peramban seluler
          menolak memutar aliran kamera tanpa ketukan, dan yang tampil hanya
          kotak hitam sepanjang ujian. */}
      <video ref={videoRef} muted playsInline className="uj-kam-video" />
      <div className="uj-kam-kabar">
        <span className="uj-kam-titik" aria-hidden="true" />
        <span>
          {keadaan === "hidup"
            ? "Kamera pengawas menyala"
            : keadaan === "menunggu"
              ? "Meminta izin kamera…"
              : "Kamera tidak aktif"}
        </span>
      </div>
      {pesan && <p className="uj-kam-pesan">{pesan}</p>}
    </div>
  );
}
