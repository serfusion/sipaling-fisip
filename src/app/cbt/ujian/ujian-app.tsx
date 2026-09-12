"use client";

// ============================================================
// HALAMAN UJIAN PESERTA — TANPA LOGIN
//
// Empat layar, dan tidak lebih: kode → identitas → mengerjakan → selesai.
// Setiap layar tambahan adalah satu tempat lagi bagi peserta untuk tersesat
// lima menit sebelum ujian dimulai.
//
// Tiga hal yang menentukan rancangannya:
//
//   1. WAKTU DARI SERVER. Angka mundur di layar hanya penunjuk; yang berlaku
//      batas yang disimpan server, dan tiap penyimpanan jawaban mengembalikan
//      sisa waktu yang sebenarnya sehingga jam layar ikut dikoreksi.
//   2. AUTO-SAVE TIDAK BOLEH MENAKUTKAN. Jaringan kampus putus-nyambung.
//      Kegagalan menyimpan ditandai tenang lalu dicoba lagi, bukan
//      dilemparkan sebagai galat merah yang membuat orang berhenti mengerjakan.
//   3. PONSEL DULU. Sebagian besar peserta mengerjakannya dari HP.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { jawabanKosong, uraiJodoh, type JenisSoal, type Media } from "@/lib/cbt";
import {
  bacaKlien, kunciSistem,
  type JembatanKlien,
} from "@/lib/kunci-layar";
import { aturanMode, rapikanMode, type JenisInsiden } from "@/lib/pengawasan";
import { pastikanKeluar, pastikanKumpul } from "@/lib/pastikan";
import { ejaSelisih, jamIndonesia } from "@/lib/waktu-indonesia";
import KreditCbt from "../kredit";
import KameraPengawas from "./kamera";
import MediaSoal from "./media-soal";
import Pastikan, { type IsiPastikan } from "./pastikan";
import { usePenjaga } from "./penjaga";
import RangkaUjian from "./rangka-ujian";
import TandaAir from "./tanda-air";
import Tirai from "./tirai";
import Teguran, { type IsiTeguran } from "./teguran";

type Ujian = {
  kode: string; judul: string; mataKuliah: string; kelas: string | null;
  deskripsi: string | null; instruksi: string | null;
  durasi: number; jumlahSoal: number; pakaiToken: boolean;
  bisaKembali: boolean; tampilkanNilai: boolean;
  status: string; mulai: string | null; selesai: string | null;
  /** Mode pengawasan: "biasa" | "ketat" | "sertifikasi". */
  pengawasan?: string;
  /**
   * Kamera pengawas menyala atau tidak.
   *
   * Datang dari SERVER, bukan disimpulkan dari modenya, karena saklarnya
   * dipegang Admin dan dapat dimatikan pada ujian sertifikasi mana pun.
   */
  kamera?: boolean;
  /** Ujian ini hanya boleh dikerjakan lewat aplikasi Exam Browser. */
  wajibAplikasi?: boolean;
};

type Soal = {
  id: number;
  jenis: JenisSoal;
  pertanyaan: string;
  pilihan: string[];
  /** Kolom kiri penjodohan. Kosong untuk jenis lain. */
  kiri: string[];
  media: Media;
  bobot: number;
};

type Hasil = {
  nilai: number; benar: number; salah: number; kosong: number;
  /** Benar sebagian — hanya pada PG kompleks dan penjodohan. */
  sebagian: number;
  tertunda: number; lulus: boolean; passing: number;
};

const KUNCI_SIMPAN = "sipaling-ujian-sesi";
const KUNCI_PERANGKAT = "sipaling-ujian-perangkat";
const JEDA_SIMPAN_MS = 900;

/**
 * Denyut auto-simpan: sepuluh detik sekali, apa pun yang sedang terjadi.
 *
 * Jeda 900 milidetik di atas menyimpan sesudah mengetik BERHENTI SEJENAK, dan
 * itu menutup hampir semua keadaan — kecuali satu yang justru paling mahal:
 * peserta yang mengetik essay tanpa jeda selama sepuluh menit tidak pernah
 * memicunya sekali pun, karena jedanya disetel ulang pada tiap ketukan. Denyut
 * ini yang menutupnya.
 *
 * Ia juga mengambil ulang SISA WAKTU dari server. Jam peramban dapat meleset,
 * dan laptop yang tutup lalu dibuka lagi melanjutkan hitungan mundurnya dari
 * tempat ia tertidur — sedangkan batas waktu yang berlaku ada di server.
 */
const DENYUT_MS = 10_000;

/**
 * Penanda perangkat, dibuat sekali lalu disimpan di peramban ini.
 *
 * BUKAN sidik jari perangkat sungguhan, dan sengaja tidak. Ia dapat dihapus
 * dengan membersihkan data peramban, dan memang boleh — yang hendak dicegah
 * bukan penyerang yang gigih, melainkan hal yang benar-benar terjadi di ruang
 * ujian: satu ponsel dipakai bergantian oleh dua orang yang duduk
 * bersebelahan.
 *
 * Peramban yang menolak menyimpan apa pun (mode penyamaran, kuota penuh)
 * mengembalikan tali kosong, dan server memperlakukannya sebagai "tidak
 * diketahui" — tidak diperiksa, bukan ditolak. Menolak ujian karena
 * penyimpanan perambannya terkunci berarti menghukum orang yang salah.
 */
function penandaPerangkat() {
  try {
    const ada = window.localStorage.getItem(KUNCI_PERANGKAT) || "";
    if (/^[A-Za-z0-9-]{8,64}$/.test(ada)) return ada;
    const baru = (
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
    )
      .replace(/[^A-Za-z0-9-]/g, "")
      .slice(0, 64);
    window.localStorage.setItem(KUNCI_PERANGKAT, baru);
    return baru;
  } catch {
    return "";
  }
}

/**
 * Perangkat peserta beserta kunci aplikasinya, untuk disertakan ke server.
 *
 * Dibaca dari objek jembatan yang disuntikkan aplikasi Exam Browser ke
 * halaman ini, lalu dari User-Agent-nya bila jembatannya tidak ada. Di peramban
 * biasa keduanya kosong, dan itu jawaban yang benar — bukan kegagalan.
 *
 * Dikirim pada dua permintaan saja: masuk dan lanjut. Keduanya adalah pintu
 * yang dijaga server; menyertakannya pada tiap penyimpanan jawaban hanya
 * menambah muatan pada permintaan yang paling sering terjadi selama ujian.
 */
function bekalKlien() {
  if (typeof window === "undefined") return { klien: "peramban", kunciAplikasi: "" };
  const jendela = window as Window & { SipalingLockdown?: JembatanKlien };
  const jembatan = jendela.SipalingLockdown ?? null;
  return {
    klien: bacaKlien({ ua: navigator.userAgent, jembatan }),
    kunciAplikasi: String(jembatan?.kunci ?? ""),
  };
}

/**
 * Lamanya ujian, dieja seperti orang mengucapkannya.
 *
 * "90 menit" benar tetapi tidak langsung terbayang; "1 jam 30 menit" langsung
 * terbayang. Peserta yang membuka tautannya perlu tahu ia harus menyediakan
 * berapa lama SEBELUM menekan Mulai Ujian, bukan sesudah jam mundur berjalan.
 */
function ejaMenit(menit: number) {
  const utuh = Math.max(0, Math.round(menit));
  if (utuh < 60) return `${utuh} menit`;
  const jam = Math.floor(utuh / 60);
  const sisa = utuh % 60;
  return sisa === 0 ? `${jam} jam` : `${jam} jam ${sisa} menit`;
}

/**
 * Tanggal dan jam pembukaan ujian, dalam jam Indonesia dan 24 jam.
 *
 * Dua hal yang dahulu salah di sini, dan keduanya menimpa peserta yang sedang
 * menunggu: jamnya ditulis menurut ZONA PERANGKAT masing-masing — sehingga
 * ponsel yang zonanya tergeser menampilkan jam pembukaan yang berbeda dari yang
 * dimaksud pengajarnya — dan peramban berbahasa Inggris menuliskannya beserta
 * "AM"/"PM". Keduanya diurus src/lib/waktu-indonesia.ts, lengkap dengan huruf
 * zonanya supaya tidak ada jam yang perlu ditebak.
 */
function tanggalRapi(iso: string | null) {
  return jamIndonesia(iso, { hari: true, panjang: true });
}

export default function UjianApp() {
  const [layar, setLayar] = useState<"kode" | "identitas" | "kerja" | "selesai">("kode");
  const [kode, setKode] = useState("");
  const [ujian, setUjian] = useState<Ujian | null>(null);
  const [nama, setNama] = useState("");
  const [nim, setNim] = useState("");
  const [token, setToken] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const [kunciSesi, setKunciSesi] = useState("");
  const [soal, setSoal] = useState<Soal[]>([]);
  const [jawaban, setJawaban] = useState<Record<number, string>>({});
  const [nomor, setNomor] = useState(0);
  const [sisa, setSisa] = useState(0);
  const [simpanan, setSimpanan] = useState<"aman" | "menyimpan" | "tertunda">("aman");
  const [ditandai, setDitandai] = useState<number[]>([]);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [pesanSelesai, setPesanSelesai] = useState("");
  /**
   * Teguran yang sedang menutup soal, atau null.
   *
   * Ia TIDAK menghilang sendiri — satu-satunya jalan keluarnya tombol di
   * dalamnya. Peringatan yang menghilang sendiri sesudah beberapa detik dapat
   * ditunggu sambil tetap menekan tombol berikutnya; yang menuntut satu
   * ketukan tidak bisa.
   */
  const [teguran, setTeguran] = useState<IsiTeguran | null>(null);
  /**
   * Pertanyaan yang sedang menunggu dijawab peserta, beserta apa yang terjadi
   * bila ia menjawab ya. Null berarti tidak ada.
   *
   * Ia menggantikan window.confirm(), dan itu bukan soal selera: kotak bawaan
   * peramban MELEPAS LAYAR PENUH di Chrome, dan pelepasan itu tercatat sebagai
   * pelanggaran atas nama peserta yang hanya menekan "AKHIRI UJIAN". Sebabnya
   * ditulis lengkap di src/app/cbt/ujian/pastikan.tsx.
   */
  const [pastikan, setPastikan] = useState<{ isi: IsiPastikan; saat: () => void } | null>(null);
  /**
   * Pengumpulan sedang berjalan, dan sejak ketukan itu layar penuh yang lepas
   * maupun fokus yang berpindah adalah perbuatan HALAMAN INI, bukan
   * pesertanya. Lihat `mengakhiri` di penjaga.ts — di sanalah akibatnya.
   *
   * Ia dikembalikan ke false pada tiap jalan gagal, karena pesertanya kembali
   * mengerjakan dan penjagaannya harus kembali penuh.
   */
  const [mengakhiri, setMengakhiri] = useState(false);

  const antreRef = useRef<Map<number, string>>(new Map());
  const jamKirimRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kunciRef = useRef("");

  // Kunci sesi disalin ke ref di dalam effect, bukan saat menggambar.
  // Pemanggil balik jam dan pendengar peristiwa membacanya jauh setelah
  // gambar selesai; tanpa salinan ini mereka memegang nilai yang basi.
  useEffect(() => {
    kunciRef.current = kunciSesi;
  }, [kunciSesi]);

  // ---------- PENGAWASAN ----------
  //
  // Modenya datang dari server bersama keterangan ujiannya, dan aturannya
  // dibaca dari satu berkas yang sama dengan yang dipakai server. Peramban
  // tidak pernah memutuskan sendiri seberapa ketat ia harus menjaga; kalau ia
  // boleh, mengubah satu nilai di alat pengembang sudah cukup untuk
  // melonggarkan seluruh penjagaan.
  const mode = rapikanMode(ujian?.pengawasan);
  const aturan = aturanMode(mode);

  /**
   * Laporkan satu insiden, lalu bacakan balasannya kepada peserta.
   *
   * Server yang memutuskan apakah ujiannya berakhir, bukan halaman ini. Kalau
   * keputusan itu dibuat di peramban, peserta yang mematikan JavaScript-nya
   * mendapat ujian tanpa pengawasan sama sekali — dan yang tercatat di server
   * tetap "bersih".
   */
  const laporInsiden = useCallback(async (jenis: JenisInsiden, detail?: string) => {
    const kunci = kunciRef.current;
    if (!kunci) return "";
    try {
      const jawab = await fetch("/api/cbt/ikut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "langgar", kunciSesi: kunci, jenis, detail }),
      });
      const data = await jawab.json();
      if (data?.dipaksa) {
        // Server sudah menilai dan menutup ujiannya. Yang tersisa bagi halaman
        // ini hanya mengatakannya dengan jujur — bukan mengirim "kumpulkan"
        // sekali lagi, yang hanya akan ditolak dan membuat layarnya menggantung
        // pada galat yang tidak berarti apa-apa bagi pesertanya.
        try { window.localStorage.removeItem(KUNCI_SIMPAN); } catch { /* diabaikan */ }
        setPesanSelesai(
          "Ujian dihentikan pengawas karena pelanggaran berulang. " +
          "Jawaban yang sudah kamu isi tetap tersimpan dan dinilai.",
        );
        setHasil(null);
        setLayar("selesai");
      }
      // Pelanggaran yang ikut menghitung mundur mendapat kotak yang menutup
      // soal dan harus diakui; yang ringan cukup pita yang menghilang sendiri.
      // Pita dikosongkan untuk yang berat supaya keduanya tidak muncul
      // sekaligus — pita di belakang kotak hanya menambah kata yang tidak
      // terbaca siapa pun.
      if (data?.keras) {
        setTeguran({ jenis, nomor: Number(data.nomor) || 0 });
        return "";
      }
      return typeof data?.pesan === "string" ? data.pesan : "";
    } catch {
      // Laporan yang gagal terkirim tidak boleh mengganggu ujiannya. Yang
      // hilang hanya satu catatan; yang tidak boleh hilang adalah pekerjaan
      // pesertanya.
      return "";
    }
  }, []);

  /**
   * Kotak izin kamera sudah ditekan — atau ujian ini memang tidak memakainya.
   *
   * Selama kotak itu masih berdiri, fokus jendela ada padanya, bukan pada
   * halaman ujian. Dahulu detik-detik itu tercatat sebagai "jendela kehilangan
   * fokus" atas nama peserta yang belum melihat satu soal pun, dan itulah
   * keluhan yang melahirkan keadaan ini. Lihat `tenang` di penjaga.ts.
   */
  const pakaiKamera = Boolean(ujian?.kamera);
  const [kameraBeres, setKameraBeres] = useState(false);
  const tenang = !pakaiKamera || kameraBeres;

  // Tetap sama dari gambar ke gambar. Panggilan balik yang lahir baru pada tiap
  // gambar akan membuat kameranya dimatikan lalu dinyalakan lagi — lampu kamera
  // yang berkedip di tengah ujian, dan izin yang ditanyakan dua kali.
  const tandaiKameraBeres = useCallback(() => setKameraBeres(true), []);

  // Jaring pengaman. Kabar "izin selesai" datang dari satu panggilan balik, dan
  // panggilan balik yang karena satu dan lain hal tidak pernah sampai akan
  // mematikan deteksi kehilangan fokus SEPANJANG UJIAN. Dua puluh detik sesudah
  // ujiannya dimulai, penjagaan berjalan penuh apa pun yang terjadi pada
  // kameranya.
  useEffect(() => {
    if (layar !== "kerja" || !pakaiKamera || kameraBeres) return;
    const jam = window.setTimeout(() => setKameraBeres(true), 20_000);
    return () => window.clearTimeout(jam);
  }, [layar, pakaiKamera, kameraBeres]);

  const penjaga = usePenjaga({ aktif: layar === "kerja", mode, tenang, mengakhiri, lapor: laporInsiden });

  /** Jalur laporan untuk kamera. Balasannya tidak dipakai di sana. */
  const laporKamera = useCallback((jenis: JenisInsiden, detail?: string) => {
    void laporInsiden(jenis, detail);
  }, [laporInsiden]);
  const { akhiriLayarPenuh } = penjaga;

  // Layar penuh dilepas begitu ujiannya berakhir — dikumpulkan sendiri,
  // kehabisan waktu, atau dihentikan pengawas. Semuanya bermuara ke layar yang
  // sama, jadi satu effect di sini menutup ketiganya sekaligus; menaruhnya di
  // masing-masing jalur berarti satu jalur akan terlupa, dan pesertanya
  // tertinggal terkunci di layar penuh berisi halaman hasil.
  useEffect(() => {
    if (layar === "selesai") akhiriLayarPenuh();
  }, [layar, akhiriLayarPenuh]);

  // ---------- kode dari alamat: tautan yang dibagikan langsung terbuka ----------
  //
  // Pengajar menempelkan tautannya ke grup kelas; peserta yang menekannya harus
  // langsung melihat ujiannya, bukan layar kosong dengan kode yang sudah
  // terisi tetapi masih menunggu satu ketukan lagi.
  //
  // Ditunda satu tick: membaca window saat menggambar tidak mungkin di server,
  // dan setState sinkron di badan effect memicu gambar bertingkat.
  useEffect(() => {
    const tunda = window.setTimeout(() => {
      const dariAlamat = new URLSearchParams(window.location.search).get("kode");
      if (!dariAlamat) return;
      const bersih = dariAlamat.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
      setKode(bersih);
      if (!bersih) return;
      setSibuk(true);
      fetch(`/api/cbt/ikut?kode=${encodeURIComponent(bersih)}`, { cache: "no-store" })
        .then((jawab) => jawab.json())
        .then((data) => {
          if (data.success) {
            setUjian(data.ujian);
            setLayar("identitas");
          } else {
            setGalat(data.message || "Ujian tidak ditemukan.");
          }
        })
        .catch(() => setGalat("Ujian belum dapat dibuka. Periksa sambungan internetmu."))
        .finally(() => setSibuk(false));
    }, 0);
    return () => window.clearTimeout(tunda);
  }, []);

  // ---------- pulihkan sesi yang tertunda ----------
  //
  // Ponsel mati, peramban tertutup, jaringan putus. Yang tersimpan di
  // perangkat hanya kunci sesinya; seluruh isinya diambil ulang dari server,
  // sehingga jawaban yang sudah masuk tidak mungkin hilang bersama tab.
  useEffect(() => {
    let hidup = true;
    let tersimpan = "";
    try {
      tersimpan = window.localStorage.getItem(KUNCI_SIMPAN) || "";
    } catch {
      return;
    }
    if (!tersimpan) return;

    fetch("/api/cbt/ikut", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: "lanjut", kunciSesi: tersimpan, ...bekalKlien() }),
    })
      .then((jawab) => jawab.json())
      .then((isi) => {
        if (!hidup || !isi.success || isi.selesai) {
          try { window.localStorage.removeItem(KUNCI_SIMPAN); } catch { /* diabaikan */ }
          return;
        }
        setKunciSesi(tersimpan);
        setUjian(isi.ujian);
        setSoal(isi.soal || []);
        setJawaban(isi.jawaban || {});
        setDitandai(isi.ditandai || []);
        setSisa(isi.sisaDetik || 0);
        // Lembar yang dibuka lagi adalah lembar yang dijaga lagi. Tanpa baris
        // ini, peserta yang keluar lewat Logout di tengah ujian lalu masuk
        // kembali membawa `mengakhiri` yang masih menyala — dan layar penuh
        // maupun fokusnya tidak lagi dijaga sama sekali sampai ujiannya habis.
        setMengakhiri(false);
        setLayar("kerja");
      })
      .catch(() => {
        // Gagal memulihkan bukan alasan menampilkan galat: pesertanya
        // mungkin memang sedang membuka halaman ini untuk ujian yang lain.
      });
    return () => { hidup = false; };
  }, []);

  // ---------- menunggu jam pembukaan ----------
  //
  // Dua penghitung yang berbeda, dan keduanya perlu:
  //
  //   JAM LAYAR  — berdetak tiap detik hanya supaya kalimat "terbuka dalam 12
  //                menit" ikut turun. Ia tidak pernah memutuskan apa pun.
  //   KABAR SERVER— tiap lima belas detik keterangan ujiannya diambil ulang,
  //                dan STATUS DARI SERVER itulah yang membuka tombol Mulai.
  //                Jam peramban dapat meleset dan dapat sengaja dilesetkan;
  //                kalau tombolnya dibuka oleh jam perangkat, memundurkan jam
  //                laptop sudah cukup untuk masuk lebih awal — dan peserta yang
  //                jam ponselnya terlambat sendiri akan menatap tombol abu-abu
  //                sesudah ujiannya benar-benar dibuka.
  const [detak, setDetak] = useState(() => Date.now());
  // Seluruh keadaan sebelum "berlangsung" ikut menunggu, bukan hanya
  // "terjadwal": ujian yang belum dijadwalkan sama sekali ("draf") dan yang
  // jadwalnya sudah ada tetapi belum diaktifkan pengajarnya ("menunggu") sama
  // saja bagi peserta yang sudah memegang tautannya — ia menunggu, dan
  // tombolnya harus menyala sendiri begitu pengajarnya menekan aktifkan.
  const menungguJadwal =
    layar === "identitas" && Boolean(ujian) &&
    ujian?.status !== "berlangsung" && ujian?.status !== "selesai";

  useEffect(() => {
    if (!menungguJadwal) return;
    const jam = window.setInterval(() => setDetak(Date.now()), 1000);
    return () => window.clearInterval(jam);
  }, [menungguJadwal]);

  useEffect(() => {
    if (!menungguJadwal || !ujian?.kode) return;
    const kodeIni = ujian.kode;
    const jam = window.setInterval(() => {
      fetch(`/api/cbt/ikut?kode=${encodeURIComponent(kodeIni)}`, { cache: "no-store" })
        .then((jawab) => jawab.json())
        .then((data) => { if (data?.success && data.ujian) setUjian(data.ujian); })
        .catch(() => {
          // Jaringan sedang putus. Tombolnya tetap abu-abu, dan itu jawaban
          // yang benar: yang tidak dapat menghubungi server juga tidak akan
          // dapat memulai ujiannya.
        });
    }, 15_000);
    return () => window.clearInterval(jam);
  }, [menungguJadwal, ujian?.kode]);

  // ---------- jam mundur ----------
  useEffect(() => {
    if (layar !== "kerja") return;
    const jam = setInterval(() => {
      setSisa((kini) => Math.max(0, kini - 1));
    }, 1000);
    return () => clearInterval(jam);
  }, [layar]);


  const kumpulkan = useCallback(async (otomatis: boolean) => {
    if (!kunciRef.current) return;
    setSibuk(true);
    // Sejak baris ini, layar penuh yang lepas dan fokus yang berpindah adalah
    // perbuatan halaman ini — ujiannya sedang ditutup atas permintaan
    // pesertanya sendiri — jadi keduanya berhenti dicatat atas namanya. Yang
    // lain tetap dicatat; lihat `mengakhiri` di penjaga.ts.
    setMengakhiri(true);
    try {
      // Antrean jawaban dikosongkan lebih dulu, supaya yang barusan diketik
      // ikut terkumpul dan bukan tertinggal di dalam jeda pengiriman.
      const antre = Array.from(antreRef.current.entries());
      antreRef.current.clear();
      let tertinggal = 0;
      for (const [id, isi] of antre) {
        try {
          const jawabServer = await fetch("/api/cbt/ikut", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aksi: "jawab", kunciSesi: kunciRef.current, soal: id, jawaban: isi }),
          });
          const data = await jawabServer.json();
          // Lewat batas waktu bukan kegagalan: jawaban itu memang tidak lagi
          // diterima, dan yang sudah tersimpan tetap dihitung.
          if (!data.success && !data.habis) throw new Error("gagal");
        } catch {
          antreRef.current.set(id, isi);
          tertinggal += 1;
        }
      }

      // Jawaban yang belum sampai ke server TIDAK boleh ikut terkumpul diam-
      // diam. Peserta yang menekan "Kumpulkan" sambil melihat palet hijau
      // berhak tahu bahwa sebagian jawabannya masih tertahan di perangkatnya.
      if (tertinggal > 0 && !otomatis) {
        // Ujiannya TIDAK jadi ditutup: pesertanya kembali ke soal, jadi
        // penjagaannya kembali penuh dan pertanyaannya ditutup supaya
        // keterangan galatnya terbaca.
        setMengakhiri(false);
        setPastikan(null);
        setSimpanan("tertunda");
        setGalat(
          `${tertinggal} jawaban belum sampai ke server, sepertinya jaringanmu sedang terputus. ` +
            "Jangan tutup halaman ini; tunggu sebentar lalu tekan Kumpulkan lagi.",
        );
        setSibuk(false);
        return;
      }

      const jawab = await fetch("/api/cbt/ikut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "selesai", kunciSesi: kunciRef.current }),
      });
      const isi = await jawab.json();
      if (!jawab.ok || !isi.success) throw new Error(isi.message || "Ujian belum dapat dikumpulkan.");
      setHasil(isi.hasil ?? null);
      setPesanSelesai(
        otomatis ? "Waktu habis. Jawabanmu sudah dikumpulkan otomatis." : "Jawabanmu sudah dikumpulkan.",
      );
      try { window.localStorage.removeItem(KUNCI_SIMPAN); } catch { /* diabaikan */ }
      setPastikan(null);
      setLayar("selesai");
    } catch (alasan: unknown) {
      // Gagal berarti pesertanya masih mengerjakan. Penjagaan kembali penuh,
      // dan pertanyaannya ditutup supaya keterangan galatnya terbaca.
      setMengakhiri(false);
      setPastikan(null);
      setGalat(alasan instanceof Error ? alasan.message : "Ujian belum dapat dikumpulkan.");
    } finally {
      setSibuk(false);
    }
  }, []);

  // ---------- waktu habis: kumpulkan sendiri ----------
  useEffect(() => {
    if (layar !== "kerja" || sisa > 0) return;
    // Ditunda satu tick: pengumpulan menyetel beberapa keadaan sekaligus, dan
    // menjalankannya sinkron di badan effect memicu gambar bertingkat.
    const tunda = window.setTimeout(() => void kumpulkan(true), 0);
    return () => window.clearTimeout(tunda);
  }, [layar, sisa, kumpulkan]);

  // ---------- peringatan sebelum menutup halaman ----------
  useEffect(() => {
    if (layar !== "kerja") return;
    function cegah(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", cegah);
    return () => window.removeEventListener("beforeunload", cegah);
  }, [layar]);

  async function cekKode() {
    const isi = kode.trim().toUpperCase();
    if (!isi) { setGalat("Kode ujian belum diisi."); return; }
    setSibuk(true); setGalat("");
    try {
      const jawab = await fetch(`/api/cbt/ikut?kode=${encodeURIComponent(isi)}`, { cache: "no-store" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Ujian tidak ditemukan.");
      setUjian(data.ujian);
      setLayar("identitas");
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Ujian tidak ditemukan.");
    } finally {
      setSibuk(false);
    }
  }

  async function mulai() {
    // DIPANGGIL LEBIH DULU, sebelum satu pun await. Peramban hanya mengabulkan
    // permintaan layar penuh selama "izin ketukan" masih berlaku — beberapa
    // detik sesudah tombolnya ditekan — dan satu permintaan jaringan yang
    // lambat sudah cukup menghabiskannya. Meminta sesudah balasan datang akan
    // gagal DIAM-DIAM: ujiannya berjalan tanpa layar penuh dan tidak ada yang
    // memberi tahu siapa pun.
    penjaga.mulaiLayarPenuh();
    setSibuk(true); setGalat("");
    try {
      const jawab = await fetch("/api/cbt/ikut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "masuk", kode: ujian?.kode, nama, nim, token,
          perangkat: penandaPerangkat(),
          ...bekalKlien(),
        }),
      });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Ujian belum dapat dimulai.");
      setKunciSesi(data.kunciSesi);
      try { window.localStorage.setItem(KUNCI_SIMPAN, data.kunciSesi); } catch { /* diabaikan */ }
      setUjian(data.ujian);
      setSoal(data.soal || []);
      setJawaban(data.jawaban || {});
      setDitandai(data.ditandai || []);
      setSisa(data.sisaDetik || 0);
      setNomor(0);
      // Sama seperti pada pemulihan sesi di atas: lembar yang dibuka adalah
      // lembar yang dijaga penuh, apa pun yang terjadi sebelumnya di halaman
      // ini.
      setMengakhiri(false);
      setLayar("kerja");
    } catch (alasan: unknown) {
      // Gagal masuk berarti tidak jadi mengerjakan, jadi layar penuhnya
      // dilepas lagi. Peserta yang terkunci di layar penuh berisi pesan galat
      // akan mengira perangkatnya yang bermasalah.
      penjaga.akhiriLayarPenuh();
      setGalat(alasan instanceof Error ? alasan.message : "Ujian belum dapat dimulai.");
    } finally {
      setSibuk(false);
    }
  }

  /**
   * Simpan jawaban dengan jeda pendek.
   *
   * Mengetik essay berarti puluhan perubahan per detik; mengirim semuanya
   * membanjiri server tanpa menambah keamanan apa pun. Yang dikirim keadaan
   * terakhir sesudah mengetiknya berhenti sejenak — dan seluruh antrean ikut
   * dikosongkan saat mengumpulkan, jadi tidak ada yang tertinggal.
   */
  function jawab(id: number, isi: string) {
    setJawaban((kini) => ({ ...kini, [id]: isi }));
    antreRef.current.set(id, isi);
    setSimpanan("menyimpan");
    if (jamKirimRef.current) clearTimeout(jamKirimRef.current);
    jamKirimRef.current = setTimeout(() => { void kirimAntrean(); }, JEDA_SIMPAN_MS);
  }

  /**
   * Centang atau lepas satu pilihan pada PG kompleks.
   *
   * Jawabannya disimpan sebagai daftar nomor dipisah koma, mis. "0,2". Selalu
   * diurutkan supaya "2,0" dan "0,2" tidak terbaca sebagai dua jawaban yang
   * berbeda ketika dibandingkan dengan yang tersimpan.
   */
  function centang(id: number, nomor: number) {
    const kini = String(jawaban[id] ?? "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    const ada = kini.includes(String(nomor));
    const berikut = ada ? kini.filter((n) => n !== String(nomor)) : [...kini, String(nomor)];
    jawab(id, berikut.map(Number).sort((a, b) => a - b).join(","));
  }

  function tercentang(id: number, nomor: number) {
    return String(jawaban[id] ?? "").split(",").map((n) => n.trim()).includes(String(nomor));
  }

  /** Pasangkan satu baris kiri dengan satu pilihan kanan. */
  function jodohkan(id: number, kiri: number, kanan: string) {
    const kini = uraiJodoh(String(jawaban[id] ?? ""));
    if (kanan === "") kini.delete(kiri);
    else kini.set(kiri, Number(kanan));
    jawab(id, JSON.stringify(Object.fromEntries(kini)));
  }

  function pasanganKini(id: number, kiri: number): string {
    const nilai = uraiJodoh(String(jawaban[id] ?? "")).get(kiri);
    return nilai === undefined ? "" : String(nilai);
  }

  async function kirimAntrean() {
    const antre = Array.from(antreRef.current.entries());
    if (antre.length === 0 || !kunciRef.current) { setSimpanan("aman"); return; }
    antreRef.current.clear();
    let gagal = false;
    for (const [id, isi] of antre) {
      try {
        const jawabServer = await fetch("/api/cbt/ikut", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aksi: "jawab", kunciSesi: kunciRef.current, soal: id, jawaban: isi }),
        });
        const data = await jawabServer.json();
        // Sisa waktu SELALU diambil dari server. Jam di peramban dapat meleset
        // — dan dapat sengaja dilesetkan.
        if (typeof data.sisaDetik === "number") setSisa(data.sisaDetik);
        if (!data.success && !data.habis) throw new Error("gagal");
      } catch {
        // Dikembalikan ke antrean lalu dicoba lagi pada perubahan berikutnya.
        antreRef.current.set(id, isi);
        gagal = true;
      }
    }
    setSimpanan(gagal ? "tertunda" : "aman");
  }

  // ---------- denyut: simpan berkala dan luruskan jamnya ----------
  useEffect(() => {
    if (layar !== "kerja") return;
    const denyut = setInterval(() => {
      if (!kunciRef.current) return;
      // Ada yang tertahan di antrean → kirim. Tidak ada → tetap menyapa server
      // sekali, supaya papan pantau pengajar tahu layar ini masih hidup dan sisa
      // waktunya ikut diluruskan.
      if (antreRef.current.size > 0) {
        void kirimAntrean();
        return;
      }
      fetch("/api/cbt/ikut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "denyut", kunciSesi: kunciRef.current }),
      })
        .then((jawab) => jawab.json())
        .then((data) => {
          if (typeof data?.sisaDetik === "number") setSisa(data.sisaDetik);
        })
        .catch(() => {
          // Jaringan sedang putus. Tidak ada yang perlu dikabarkan: jawaban
          // yang belum terkirim masih ada di antrean, dan denyut berikutnya
          // akan mencobanya lagi.
        });
    }, DENYUT_MS);
    return () => clearInterval(denyut);
    // Bergantung pada layar saja. kirimAntrean dibuat ulang pada tiap gambar,
    // dan memasukkannya ke daftar membuat denyutnya disetel ulang terus-menerus
    // sehingga tidak pernah benar-benar berdenyut. Isinya aman dipegang dari
    // gambar pertama: yang dibacanya hanya ref dan penyetel keadaan, dan
    // keduanya tidak pernah basi.
  }, [layar]);

  function keSoal(index: number) {
    setNomor(index);
  }

  /**
   * Keluar tanpa mengumpulkan.
   *
   * Ujiannya TIDAK ditutup — attempt-nya tetap berjalan di server beserta sisa
   * waktunya, dan peserta dapat masuk lagi dengan nomor yang sama untuk
   * menemukan lembar yang persis sama. Yang dihapus hanya ingatan peramban ini.
   * Waktunya tetap berjalan, dan itu dikatakan terus terang di kotak
   * pastikannya, bukan disembunyikan.
   */
  function keluar() {
    setPastikan({ isi: pastikanKeluar(), saat: jalankanKeluar });
  }

  function jalankanKeluar() {
    setPastikan(null);
    // Layar penuhnya dilepas baris di bawah ini, atas permintaan pesertanya
    // sendiri. Penjagaan memang berhenti begitu layarnya bukan "kerja" lagi,
    // tetapi urutan itu bergantung pada kapan React membereskan gambarnya —
    // dan yang dipertaruhkan sebuah pelanggaran atas nama orang yang tidak
    // melakukan apa-apa. Jadi ia dikatakan terus terang, bukan diandaikan.
    setMengakhiri(true);
    penjaga.akhiriLayarPenuh();
    try { window.localStorage.removeItem(KUNCI_SIMPAN); } catch { /* diabaikan */ }
    setKunciSesi("");
    setSoal([]);
    setJawaban({});
    setDitandai([]);
    setNomor(0);
    setGalat("");
    setLayar("kode");
  }

  /**
   * Pertanyaan sebelum mengumpulkan, beserta jumlah soal yang masih kosong.
   *
   * Digambar halaman ini sendiri, BUKAN window.confirm(). Kotak bawaan peramban
   * melepas layar penuh di Chrome, dan pelepasan itu tercatat sebagai
   * pelanggaran "keluar dari layar penuh" atas nama peserta yang hanya menekan
   * "AKHIRI UJIAN" — keluhan yang melahirkan kotak ini. Selengkapnya di
   * src/app/cbt/ujian/pastikan.tsx.
   */
  function mintaKumpul() {
    setPastikan({
      isi: pastikanKumpul({ kosong: soal.length - terjawab, ragu: ditandai.length }),
      saat: () => void kumpulkan(false),
    });
  }

  async function tandai(id: number) {
    const sudah = ditandai.includes(id);
    setDitandai((kini) => (sudah ? kini.filter((n) => n !== id) : [...kini, id]));
    try {
      await fetch("/api/cbt/ikut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "tandai", kunciSesi: kunciRef.current, soal: id, tandai: !sudah }),
      });
    } catch {
      // Penanda tinjau pelengkap; keadaannya tersinkron pada pemuatan berikutnya.
    }
  }

  /**
   * Keadaan satu soal pada palet nomor. Tiga warna, persis seperti legendanya.
   *
   * Urutannya menentukan: soal yang sudah dijawab LALU ditandai ragu-ragu tetap
   * terbaca oranye, karena itulah yang ingin dilihat peserta — daftar soal
   * yang sengaja ia sisihkan untuk ditengok lagi sebelum mengumpulkan.
   *
   * Soal yang sedang dibuka tidak mendapat warna keempat; ia diberi bingkai
   * pada CSS-nya. Menambah satu warna lagi membuat legendanya tidak lagi
   * terbaca sekali lihat.
   */
  function keadaanSoal(id: number): "ragu" | "isi" | "kosong" {
    if (ditandai.includes(id)) return "ragu";
    if (sudahDijawab(id)) return "isi";
    return "kosong";
  }

  /**
   * Sudah dijawab?
   *
   * Lewat jawabanKosong, bukan sekadar memeriksa tali kosong: penjodohan yang
   * belum disentuh tetap tersimpan sebagai "{}", dan itu akan terbaca hijau
   * pada palet nomor padahal belum dikerjakan sama sekali.
   */
  function sudahDijawab(id: number) {
    const soalnya = soal.find((s) => s.id === id);
    if (!soalnya) return false;
    return !jawabanKosong(soalnya.jenis, String(jawaban[id] ?? ""));
  }

  const terjawab = soal.filter((s) => !jawabanKosong(s.jenis, String(jawaban[s.id] ?? ""))).length;
  const soalKini = soal[nomor];
  const hampirHabis = sisa > 0 && sisa <= 300;

  // ---------- LAYAR: KODE ----------
  if (layar === "kode") {
    return (
      <RangkaUjian
        judul="SiPaling CBT"
        sub="Ujian Berbasis Komputer"
      >
        <h2>Masuk ke ujianmu</h2>
        <p className="cbtd-lead">
          Tidak perlu membuat akun dan tidak perlu kata sandi. Masukkan kode ujian yang diberikan
          pengajarmu.
        </p>
        <label htmlFor="uj-kode">Kode Ujian</label>
        <input
          id="uj-kode"
          className="cbtd-input cbtd-input-kode"
          value={kode}
          onChange={(e) => setKode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") void cekKode(); }}
          placeholder="XXXXXX"
          autoComplete="off"
          inputMode="text"
        />
        {galat && <p className="cbtd-galat" role="alert">{galat}</p>}
        <button type="button" className="cbtd-btn" disabled={sibuk} onClick={() => void cekKode()}>
          {sibuk ? "Memeriksa…" : "Lanjut"}
        </button>
        <KreditCbt rapat />
      </RangkaUjian>
    );
  }

  // ---------- LAYAR: IDENTITAS ----------
  if (layar === "identitas" && ujian) {
    const sudahTutup = ujian.status === "selesai";
    // Belum boleh dikerjakan — apa pun sebabnya. Tiga keadaan bermuara ke sini,
    // dan bagi peserta ketiganya sama: belum dijadwalkan ("draf"), sudah
    // dijadwalkan tetapi belum diaktifkan pengajarnya ("menunggu"), dan sudah
    // diaktifkan tetapi jamnya belum tiba ("terjadwal"). Dahulu hanya yang
    // ketiga yang ditahan, sehingga dua yang pertama menampilkan tombol biru
    // yang tampak siap — lalu server menolaknya sesudah ditekan.
    const belumBuka = !sudahTutup && ujian.status !== "berlangsung";
    const adaJadwal = Boolean(ujian.mulai);

    // Sisa waktu menuju pembukaan, untuk dibacakan di badan tombol dan di kotak
    // kabar. Kosong bila jamnya tidak diketahui atau sudah lewat menurut jam
    // perangkat — yang terakhir bukan berarti terbuka: yang membuka tombolnya
    // tetap status dari server, dan kalimat "0 detik" yang menetap justru
    // membuat orang mengira halamannya menggantung.
    const mulaiMs = ujian.mulai ? Date.parse(ujian.mulai) : Number.NaN;
    const sisaMenuju = Number.isNaN(mulaiMs) ? 0 : Math.round((mulaiMs - detak) / 1000);
    const hitungMundur = belumBuka && sisaMenuju > 0 ? ejaSelisih(sisaMenuju) : "";
    return (
      <RangkaUjian
        lencana={ujian.mataKuliah}
        judul={ujian.judul}
        sub={ujian.kelas ? `Kelas ${ujian.kelas}` : "Ujian Berbasis Komputer"}
        poin={[
          `${ujian.jumlahSoal || "Beberapa"} soal, dikerjakan ${ejaMenit(ujian.durasi)}.`,
          "Waktu baru berjalan setelah tombol Mulai Ujian ditekan.",
          "Jawaban tersimpan otomatis tiap sepuluh detik.",
          "Jaringan sempat terputus tidak menghapus pekerjaanmu.",
        ]}
      >
        <div className="uj-dalam-rangka">
          <div className="uj-fakta">
            <div><b>{ujian.jumlahSoal || "-"}</b><span>soal</span></div>
            <div className="uj-fakta-waktu"><b>{ujian.durasi}</b><span>menit</span></div>
            <div><b>{ujian.pakaiToken ? "Ya" : "Tidak"}</b><span>pakai kode</span></div>
          </div>

          {/* ---------- LAMA UJIAN, DIKATAKAN SEKALI LAGI DENGAN JELAS ----------
              Angka pada kotak fakta di atas mudah terlewat: tiga kotak seukuran
              yang dibaca sekilas. Yang paling ditanyakan peserta saat membuka
              tautannya justru satu hal — ini berapa lama — dan ia perlu tahu
              SEBELUM menekan Mulai Ujian, bukan sesudah jam mundur berjalan. */}
          <div className="uj-waktu">
            <span className="uj-waktu-ikon" aria-hidden="true">⏱</span>
            <div>
              <b>Waktu pengerjaan {ejaMenit(ujian.durasi)}</b>
              <span>
                ⏱️ Waktu dihitung setelah tombol <b>&ldquo;MULAI UJIAN&rdquo;</b> ditekan.
                Pastikan alat tulis, baterai, dan koneksi internet siap.
              </span>
            </div>
          </div>

          {ujian.instruksi && <div className="uj-instruksi"><b>Instruksi</b><p>{ujian.instruksi}</p></div>}

          {/* ---------- PENGAWASAN TIDAK DIUMUMKAN ----------
              Dulu di sini ada kotak "Tangkapan layar diawasi" beserta ajakan
              memakai aplikasi terkunci. Keduanya dibuang atas permintaan
              pemilik sistem, dan alasannya masuk akal: layar yang mengumumkan
              apa saja yang diawasi juga mengumumkan apa saja yang TIDAK
              diawasi, dan itu peta bagi orang yang mencari celahnya.

              Yang tersisa satu-satunya: peserta yang ujiannya mewajibkan Exam
              Browser tetap harus diberi tahu sebelum menekan Mulai. Bukan
              pengumuman pengawasan melainkan syarat masuk, dan menyembunyikan
              syarat masuk hanya membuat orang duduk di ruang ujian dengan
              waktu berjalan sementara ujiannya tidak dapat dibuka. */}
          {ujian.wajibAplikasi && !kunciSistem(penjaga.klien) && (
            <div className="uj-kabar uj-kabar-tutup">
              <b>Ujian ini hanya dapat dibuka lewat aplikasi Exam Browser.</b> Unduh dari
              tautan yang diberikan pengajarmu, lalu masukkan kode ujian yang sama.
            </div>
          )}

          {belumBuka && (
            <div className="uj-kabar uj-kabar-tunggu">
              {adaJadwal ? (
                <>
                  Ujian ini dibuka <b>{tanggalRapi(ujian.mulai)}</b> dan dikerjakan selama{" "}
                  <b>{ejaMenit(ujian.durasi)}</b>.
                  {hitungMundur && <> Terbuka dalam <b>{hitungMundur}</b>.</>}
                </>
              ) : (
                <>Jadwal ujian ini belum disetel pengajarnya.</>
              )}{" "}
              Halaman ini boleh dibiarkan terbuka — tombol Mulai menyala sendiri begitu
              ujiannya dibuka.
            </div>
          )}
          {sudahTutup && <div className="uj-kabar uj-kabar-tutup">Ujian ini sudah ditutup.</div>}

          {/* ---------- ISIAN IDENTITAS ----------
              Dahulu seluruh bagian ini disembunyikan sampai ujiannya terbuka.
              Yang terjadi: peserta membuka tautannya sepuluh menit lebih awal,
              melihat halaman tanpa satu pun kolom isian, dan menutupnya — lalu
              mengetik namanya terburu-buru sesudah ujian berjalan.

              Sekarang kolomnya selalu ada dan boleh diisi lebih dulu; yang
              menunggu jamnya hanya TOMBOLNYA, dan ia menunggu dengan
              terlihat: abu-abu, tidak dapat ditekan, dengan alasannya
              tertulis di badannya sendiri. */}
          {!sudahTutup && (
            <>
              <label htmlFor="uj-nama">Nama Lengkap</label>
              <input id="uj-nama" className="uj-input" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama sesuai daftar hadir" autoComplete="name" />

              <label htmlFor="uj-nim">NIM / Nomor Peserta</label>
              <input id="uj-nim" className="uj-input" value={nim} onChange={(e) => setNim(e.target.value.replace(/\D/g, ""))} placeholder="Nomor induk atau nomor peserta" inputMode="numeric" autoComplete="off" />

              {ujian.pakaiToken && (
                <>
                  <label htmlFor="uj-token">Kode dari Pengawas</label>
                  <input id="uj-token" className="uj-input uj-input-kode" value={token} onChange={(e) => setToken(e.target.value.toUpperCase())} placeholder="XXXXXX" autoComplete="off" />
                </>
              )}

              {galat && <p className="uj-galat" role="alert">{galat}</p>}
              <button
                type="button"
                className="uj-btn uj-btn-utama uj-btn-mulai"
                disabled={sibuk || belumBuka}
                aria-disabled={sibuk || belumBuka}
                onClick={() => void mulai()}
              >
                {belumBuka
                  ? hitungMundur ? `TERBUKA DALAM ${hitungMundur.toUpperCase()}` : "BELUM DIBUKA"
                  : sibuk ? "Menyiapkan…" : "MULAI UJIAN"}
              </button>
              <p className="uj-catatan">
                {belumBuka
                  ? adaJadwal
                    ? `Tombol ini menyala sendiri pada ${tanggalRapi(ujian.mulai)}. Nama dan nomormu boleh diisi dari sekarang.`
                    : "Tombol ini menyala sendiri begitu pengajarmu membuka ujiannya. Nama dan nomormu boleh diisi dari sekarang."
                  : `Waktu ${ejaMenit(ujian.durasi)} mulai berjalan begitu tombol ini ditekan. Jawaban tersimpan otomatis.`}
              </p>
            </>
          )}

          <button type="button" className="uj-btn uj-btn-sunyi" onClick={() => { setLayar("kode"); setGalat(""); }}>
            ← Ganti kode ujian
          </button>
          <KreditCbt rapat />
        </div>
      </RangkaUjian>
    );
  }

  // ---------- LAYAR: SELESAI ----------
  if (layar === "selesai") {
    return (
      <RangkaUjian
        judul="Ujian selesai"
        sub={ujian ? `${ujian.judul} · ${ujian.mataKuliah}` : "Terima kasih sudah mengerjakan."}
        poin={[
          "Jawabanmu sudah tersimpan di server.",
          "Halaman ini boleh ditutup.",
          "Nilai essay menunggu koreksi pengajar bila ada.",
        ]}
      >
        <div className="uj-dalam-rangka uj-kotak-selesai">
          <div className="uj-ceklis" aria-hidden="true">✓</div>
          <h2>Selesai</h2>
          <p className="uj-lead">{pesanSelesai}</p>

          {hasil ? (
            <>
              <div className={`uj-nilai ${hasil.lulus ? "lulus" : "belum"}`}>
                <b>{hasil.nilai}</b>
                <span>{hasil.lulus ? "Lulus" : "Belum mencapai batas"} · batas {hasil.passing}</span>
              </div>
              {/* Hijau untuk benar, merah untuk salah.

                  Empat kotak yang seragam abu-abu menuntut peserta membaca
                  labelnya satu per satu untuk tahu mana kabar baiknya; warna
                  menjawabnya sebelum labelnya terbaca. Kotak "kosong"
                  dibiarkan netral dengan sengaja — soal yang tidak dijawab
                  bukan jawaban yang salah, dan mengecatnya merah menghukum dua
                  kali untuk satu hal yang sama. */}
              <div className="uj-fakta">
                <div className="uj-fakta-benar"><b>{hasil.benar}</b><span>benar</span></div>
                {hasil.sebagian > 0 && (
                  <div className="uj-fakta-sebagian"><b>{hasil.sebagian}</b><span>benar sebagian</span></div>
                )}
                <div className="uj-fakta-salah"><b>{hasil.salah}</b><span>salah</span></div>
                <div><b>{hasil.kosong}</b><span>kosong</span></div>
              </div>
              {hasil.sebagian > 0 && (
                <p className="uj-catatan">
                  Soal pilihan jamak dan penjodohan dinilai per bagian, jadi jawaban yang benar
                  sebagian tetap mendapat nilai.
                </p>
              )}
              {hasil.tertunda > 0 && (
                <p className="uj-catatan">
                  {hasil.tertunda} soal essay menunggu koreksi pengajar, jadi nilai ini masih bisa naik.
                </p>
              )}
            </>
          ) : (
            <p className="uj-catatan">
              Nilaimu diumumkan pengajar setelah seluruh peserta selesai.
            </p>
          )}

          <p className="uj-kaki">Terima kasih. Halaman ini boleh ditutup.</p>
          <KreditCbt rapat />
        </div>
      </RangkaUjian>
    );
  }

  // ---------- LAYAR: MENGERJAKAN ----------
  if (!soalKini) {
    return (
      <RangkaUjian judul="SiPaling CBT" sub="Menyiapkan soal…">
        <p className="cbtd-lead">Menyiapkan soal…</p>
      </RangkaUjian>
    );
  }

  const isi = jawaban[soalKini.id] ?? "";
  const jam = Math.floor(sisa / 3600);
  const menit = Math.floor((sisa % 3600) / 60);
  const detik = sisa % 60;
  const dua = (n: number) => String(n).padStart(2, "0");
  const raguKini = ditandai.includes(soalKini.id);
  const soalTerakhir = nomor >= soal.length - 1;

  const palet = soal.map((s, i) => (
    <button
      key={s.id}
      type="button"
      className={`ck-nomor ${keadaanSoal(s.id)}`}
      onClick={() => keSoal(i)}
      aria-label={`Soal ${i + 1}`}
      aria-current={i === nomor ? "true" : undefined}
    >
      {i + 1}
    </button>
  ));

  const legenda = (
    <ul className="ck-legenda">
      <li><i className="ck-tit hijau" aria-hidden="true" /> Hijau = Sudah dijawab</li>
      <li><i className="ck-tit oranye" aria-hidden="true" /> Orange = Ragu-ragu</li>
      <li><i className="ck-tit abu" aria-hidden="true" /> Abu-abu = Belum dijawab</li>
    </ul>
  );

  return (
    <div className="uj uj-kerja" data-jaga={aturan.kunciSalin ? "1" : undefined}>
      {/* ---------- TANDA AIR ----------
          Digambar paling awal supaya ia berada DI BAWAH seluruh isi layar dan
          tidak pernah menghalangi ketukan. Yang membuatnya tetap terlihat di
          tangkapan layar bukan urutannya, melainkan warnanya. */}
      {aturan.tandaAir && (
        <TandaAir peserta={{ nama, nim, kode: ujian?.kode ?? "" }} />
      )}

      {/* ---------- KAMERA PENGAWAS ----------
          Hanya mode Sertifikasi/OSCE. Gambarnya sengaja TERLIHAT peserta
          sepanjang ujian: pengawasan yang disembunyikan dari orang yang
          diawasi kehilangan seluruh daya cegahnya, dan yang menghentikan orang
          bukan kamera yang diam-diam merekam melainkan kamera yang jelas ada. */}
      {ujian?.kamera && (
        <KameraPengawas
          aktif={layar === "kerja"}
          kunciSesi={kunciSesi}
          lapor={laporKamera}
          selesaiIzin={tandaiKameraBeres}
        />
      )}

      {/* ---------- TIRAI ----------
          Digambar SESUDAH tanda air dan kamera supaya keduanya ikut tertutup,
          dan dengan z-index tertinggi di seluruh layar ujian. Satu lapisan yang
          tidak sengaja berada di atasnya sudah cukup membocorkan potongan soal
          ke dalam gambar — dan yang bocor persis bagian yang dijaga.

          Ia TIDAK menggagalkan tangkapan layar; ia mengosongkan isinya. Yang
          benar-benar menolak adalah aplikasi Exam Browser di lockdown/,
          tempat sistem operasinya sendiri yang menolak. */}
      {penjaga.tirai && (
        <Tirai
          sebab={penjaga.tirai}
          peserta={{ nama, nim, kode: ujian?.kode ?? "" }}
          /* Keluar dari layar penuh menutup soal dan MENAHANNYA tertutup —
             tiraï ini tidak membuka dirinya sendiri seperti dua yang lain.
             Karena itu ia harus membawa jalan keluarnya ke dalam: tirai
             menelan ketukan, jadi pita peringatan berikut tombolnya yang dulu
             ada di sini tidak akan pernah dapat ditekan lagi dari baliknya.
             Dan permintaan layar penuh memang menuntut ketukan orang —
             menekan tombol ini adalah ketukan itu. */
          aksi={penjaga.tirai === "layar" ? {
            label: "Kembali ke layar penuh",
            saat: penjaga.ulangiLayarPenuh,
          } : undefined}
        />
      )}

      {/* ---------- KOTAK TEGURAN ----------
          Di ATAS tirai, dan itu disengaja. Keduanya dapat muncul bersamaan —
          menekan PrintScreen memasang tirai sekaligus melahirkan teguran, dan
          keluar dari layar penuh memasang tirai yang menetap. Yang harus
          terbaca lebih dulu adalah tegurannya; tiraïnya menunggu di belakang
          dan masih ada begitu tegurannya diakui.

          Hanya selama peserta benar-benar mengerjakan. Teguran yang tertinggal
          di atas halaman hasil membuat peserta mengira ujiannya belum
          berakhir. */}
      {layar === "kerja" && teguran && (
        <Teguran
          isi={teguran}
          peserta={{ nama, nim, kode: ujian?.kode ?? "" }}
          tutup={() => setTeguran(null)}
        />
      )}

      {/* ---------- KOTAK PASTIKAN ----------
          Pertanyaan sebelum ujian dikumpulkan atau halamannya ditinggalkan.

          Ia digambar halaman ini sendiri dan BUKAN window.confirm(), dan itu
          seluruh sebab keberadaannya: kotak bawaan peramban melepas layar
          penuh di Chrome, dan pelepasan itu tercatat sebagai pelanggaran
          "keluar dari layar penuh" atas nama peserta yang hanya menekan
          "AKHIRI UJIAN". Selengkapnya di pastikan.tsx.

          DI BAWAH tirai dan kotak teguran — z-index 55 lawan 60 dan 70.
          Peserta yang membuka kotak ini lalu keluar dari layar penuh tetap
          mendapat tiraïnya, bukan soal yang terbuka di belakang sebuah kotak
          yang boleh dibiarkan terbuka. */}
      {pastikan && (
        <Pastikan
          isi={pastikan.isi}
          sibuk={sibuk}
          ya={pastikan.saat}
          tidak={() => setPastikan(null)}
        />
      )}

      {/* ---------- PITA PERINGATAN ----------
          Sisa yang ringan saja — klik kanan, jendela kehilangan fokus. Yang
          berat sudah menjadi kotak teguran di atas. */}
      {penjaga.peringatan && (
        <div className="uj-jaga" role="status">{penjaga.peringatan}</div>
      )}

      {/* ---------- BILAH ATAS ---------- */}
      <header className="ck-bar">
        <div>
          <span className="ck-bar-nama">{nama || "Peserta"}</span>
          <span className="ck-bar-nim">{nim}</span>
        </div>
        <div className="ck-bar-tengah">{ujian?.judul}</div>
        {/* Hanya muncul ketika penguncian sistemnya memang menyala. Lencana
            "tidak dikunci" di atas layar ujian tidak memberi tahu pesertanya
            apa pun yang berguna, dan hanya memberitahu tetangganya bahwa layar
            ini boleh difoto. */}
        {kunciSistem(penjaga.klien) && (
          <span className="ck-kunci" title="Tangkapan layar dan perekaman layar ditolak sistem">
            🔒 Layar terkunci
          </span>
        )}
        <span className={`ck-simpan ck-simpan-${simpanan}`}>
          {simpanan === "aman" ? "✓ Tersimpan" : simpanan === "menyimpan" ? "Menyimpan…" : "Menyimpan ulang…"}
        </span>
        <button type="button" className="ck-logout" onClick={keluar}>Logout</button>
      </header>

      <div className="ck-layar">
        {/* ---------- KARTU SOAL ---------- */}
        <section className="ck-kartu">
          <div className="ck-kartu-kepala">
            <span className="ck-lencana ck-lencana-soal">SOAL NO. {nomor + 1}</span>
            <span
              className={`ck-lencana ck-lencana-waktu ${hampirHabis ? "genting" : ""}`}
              aria-live="polite"
            >
              SISA WAKTU <b>{dua(jam)}:{dua(menit)}:{dua(detik)}</b>
            </span>
          </div>

          <div className="ck-kartu-isi">
            <p className="ck-tanya">{soalKini.pertanyaan}</p>
            <MediaSoal media={soalKini.media} />

            {soalKini.jenis === "pg" || soalKini.jenis === "benar_salah" ? (
              <div className="ck-opsi-daftar" role="radiogroup" aria-label={`Pilihan jawaban soal ${nomor + 1}`}>
                {soalKini.pilihan.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={isi === String(i)}
                    className={`ck-opsi ${isi === String(i) ? "on" : ""}`}
                    onClick={() => jawab(soalKini.id, String(i))}
                  >
                    <span className="ck-bulat" aria-hidden="true"><i /></span>
                    <span className="ck-opsi-huruf">{String.fromCharCode(65 + i)}.</span>
                    <span className="ck-opsi-teks">{p}</span>
                  </button>
                ))}
              </div>
            ) : soalKini.jenis === "pg_kompleks" ? (
              <div className="ck-opsi-daftar" aria-label={`Pilihan jawaban soal ${nomor + 1}`}>
                <p className="ck-petunjuk">Boleh memilih lebih dari satu jawaban.</p>
                {soalKini.pilihan.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    role="checkbox"
                    aria-checked={tercentang(soalKini.id, i)}
                    className={`ck-opsi ${tercentang(soalKini.id, i) ? "on" : ""}`}
                    onClick={() => centang(soalKini.id, i)}
                  >
                    {/* Kotak, bukan lingkaran. Bentuknya sendiri yang harus
                        mengatakan bahwa jawabannya boleh lebih dari satu. */}
                    <span className="ck-kotak" aria-hidden="true">{tercentang(soalKini.id, i) ? "✓" : ""}</span>
                    <span className="ck-opsi-huruf">{String.fromCharCode(65 + i)}.</span>
                    <span className="ck-opsi-teks">{p}</span>
                  </button>
                ))}
              </div>
            ) : soalKini.jenis === "penjodohan" ? (
              <div className="ck-jodoh">
                <p className="ck-petunjuk">Pilih pasangan yang tepat untuk setiap baris.</p>
                {soalKini.kiri.map((kiri, i) => (
                  <div key={i} className="ck-jodoh-baris">
                    <span className="ck-jodoh-nomor">{i + 1}</span>
                    <span className="ck-jodoh-kiri">{kiri}</span>
                    <select
                      className="ck-jodoh-pilih"
                      value={pasanganKini(soalKini.id, i)}
                      onChange={(e) => jodohkan(soalKini.id, i, e.target.value)}
                      aria-label={`Pasangan untuk ${kiri}`}
                    >
                      <option value="">Pilih pasangan</option>
                      {soalKini.pilihan.map((p, n) => (
                        <option key={n} value={String(n)}>{String.fromCharCode(65 + n)}. {p}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : soalKini.jenis === "isian" ? (
              <input
                className="ck-isian"
                value={isi}
                onChange={(e) => jawab(soalKini.id, e.target.value)}
                placeholder="Tulis jawaban singkatmu"
                autoComplete="off"
              />
            ) : (
              <textarea
                className="ck-essay"
                value={isi}
                onChange={(e) => jawab(soalKini.id, e.target.value)}
                placeholder="Tulis jawabanmu di sini"
                rows={10}
              />
            )}

            {!jawabanKosong(soalKini.jenis, isi) && (
              <button type="button" className="ck-hapus" onClick={() => jawab(soalKini.id, "")}>
                Hapus jawaban soal ini
              </button>
            )}

            {galat && <p className="ck-galat" role="alert">{galat}</p>}
          </div>

          <div className="ck-kartu-kaki">
            <button
              type="button"
              className="ck-tbl ck-biru ck-mundur"
              disabled={nomor === 0 || ujian?.bisaKembali === false}
              onClick={() => keSoal(Math.max(0, nomor - 1))}
            >
              ‹ SOAL SEBELUMNYA
            </button>
            <button
              type="button"
              className={`ck-tbl ck-ragu ${raguKini ? "on" : ""}`}
              aria-pressed={raguKini}
              onClick={() => void tandai(soalKini.id)}
            >
              {raguKini ? "✓ RAGU-RAGU" : "RAGU-RAGU"}
            </button>
            {/* Pada soal terakhir tombol ini berhenti menjadi tombol jalan dan
                menjadi tombol akhir. Warnanya ikut berganti merah supaya tangan
                yang sudah hafal letaknya sadar bahwa ketukan berikutnya bukan
                pindah soal lagi, melainkan menutup ujian. */}
            {soalTerakhir ? (
              <button
                type="button"
                className="ck-tbl ck-akhiri ck-maju"
                disabled={sibuk}
                onClick={mintaKumpul}
              >
                {sibuk ? "MENGUMPULKAN…" : "AKHIRI UJIAN"}
              </button>
            ) : (
              <button
                type="button"
                className="ck-tbl ck-biru ck-maju"
                onClick={() => keSoal(Math.min(soal.length - 1, nomor + 1))}
              >
                SOAL SELANJUTNYA ›
              </button>
            )}
          </div>
        </section>

        {/* ---------- PANEL NOMOR SOAL ----------
            Selalu terlihat, di layar lebar maupun di ponsel. Sebelumnya di
            ponsel ia disembunyikan di balik laci yang harus diketuk dulu, dan
            akibatnya satu-satunya penanda soal mana yang sudah dijawab justru
            tidak kelihatan pada layar yang paling banyak dipakai mengerjakan.
            Di ponsel panel ini turun ke bawah kartu soal, mengisi ruang yang
            memang kosong. */}
        <aside className="ck-sisi">
          <div className="ck-panel">
            <div className="ck-panel-kepala">NOMOR SOAL</div>
            <div className="ck-grid">{palet}</div>
            {legenda}
            <p className="ck-ringkas">
              <b>{terjawab}</b> dari <b>{soal.length}</b> soal sudah dijawab
              {ditandai.length > 0 && <> · <b>{ditandai.length}</b> ditandai ragu-ragu</>}
            </p>
          </div>

          {/* Tombol berhenti berdiri di kartunya sendiri, terpisah dan berjarak
              dari tombol jalan — sekali tertekan, ujiannya tidak dapat dibuka
              kembali. */}
          <div className="ck-panel ck-panel-henti">
            <button type="button" className="ck-henti" disabled={sibuk} onClick={mintaKumpul}>
              {sibuk ? "MENGUMPULKAN…" : "HENTIKAN UJIAN"}
            </button>
            <p className="ck-henti-catatan">
              Jawabanmu dikumpulkan dan ujian ditutup. Tidak dapat dibuka lagi.
            </p>
          </div>

          <KreditCbt rapat />
        </aside>
      </div>

    </div>
  );
}
