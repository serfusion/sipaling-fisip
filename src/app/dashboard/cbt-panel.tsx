"use client";

// ============================================================
// PANEL CBT DI DASHBOARD — untuk Dosen, Admin, dan Super Admin
//
// Pembagian wewenangnya kelihatan dari layarnya, bukan hanya dijaga server.
// Yang menentukan bukan PERAN melainkan KEPEMILIKAN:
//
//   Pemilik ujian  — dosen yang membuatnya — menyusun soal, menyetel jadwal,
//                    mengaktifkan dan menonaktifkan, serta mengoreksi essay.
//   Admin dan Super Admin memantau seluruh ujian dan boleh menghapusnya, tetapi
//                    TIDAK memegang tombol aktivasi ujian milik dosen lain.
//                    Untuk ujian seleksi mereka membuatnya sendiri — dan ujian
//                    itu milik mereka, jadi tombolnya terbuka di sana.
//
// Admin bagian — umum, akademik, prodi, PDDIKTI, perpustakaan, laboratorium —
// tidak melihat menu ini sama sekali.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ejaWaktu, JENIS_LABEL, MEDIA_KOSONG, SEMUA_JENIS, STATUS_LABEL, uraiKunciJamak,
  type JenisSoal, type Media, type Pasangan, type StatusUjian,
} from "@/lib/cbt";
import { imporDariExcel, imporDariWord, type SoalImpor, type Aoa } from "@/lib/impor-soal";
import { sarikanDokumen, type HasilSari } from "@/lib/sari-dokumen";
import { JENIS_AI, MAKS_SOAL } from "@/lib/ai-soal";
import {
  beritaAcaraHtml, laporanPesertaHtml, naskahSoalHtml,
  type PesertaCetak, type UjianCetak,
} from "@/lib/cetak-cbt";
import { buatDocxTemplate, buatXlsxTemplate } from "@/lib/template-soal";
import { KREDIT_CBT } from "../cbt/kredit";

type Ujian = {
  id: number; code: string; title: string; courseName: string; className: string | null;
  questionCount: number; durationMinutes: number; passingGrade: number; maxAttempts: number;
  randomQuestions: boolean; randomOptions: boolean; allowBack: boolean; showScore: boolean;
  token: string | null; startAt: string | null; endAt: string | null;
  activatedAt: string | null; activatedBy: string | null;
  description: string | null; instruction: string | null; createdBy: string;
  singleDevice: boolean;
  status: StatusUjian; jumlahBank: number;
  peserta: { total: number; berjalan: number; selesai: number };
  /** Izin yang dihitung server untuk pemanggil ini, per ujian. */
  milik: boolean; bolehUbah: boolean; bolehHapus: boolean;
};

/** Satu jawaban peserta, dibuka dosen untuk dibaca dan dikoreksi. */
type Rincian = {
  nomor: number; id: number; jenis: JenisSoal; pertanyaan: string;
  pilihan: string[]; bobot: number; kunci: string; pembahasan: string | null;
  jawaban: string; jawabanTeks: string;
  benar: boolean | null; poin: number; catatan: string;
};

type Soal = {
  id: number; jenis: JenisSoal; pertanyaan: string; pilihan: string[];
  kunci: string; pasangan: Pasangan[]; media: Media;
  bobot: number; materi: string; tingkat: string; pembahasan: string;
};

type Peserta = {
  id: number; nim: string; nama: string; status: string; terjawab: number;
  nilai: number | null; tertunda: number; sisaDetik: number;
  /** Detik sejak peramban peserta terakhir menyapa. null = belum pernah. */
  diamDetik: number | null;
  keluarFullscreen: number; pindahTab: number; mulai: string; kumpul: string | null;
};

/**
 * Sesudah berapa lama diam seorang peserta dianggap TERPUTUS.
 *
 * Perambannya menyapa tiap sepuluh detik; enam kali lipat dari itu memberi
 * kelonggaran untuk jaringan kampus yang tersendat tanpa membuat papan pantau
 * lambat menyadari layar yang benar-benar mati.
 */
const AMBANG_TERPUTUS = 60;

type Analisis = {
  id: number; pertanyaan: string; dijawab: number; benar: number;
  persen: number; kategori: string; perluDitinjau: boolean;
};

type Statistik = {
  peserta: number; rata: number; tertinggi: number; terendah: number;
  median: number; lulus: number; tidakLulus: number; persenLulus: number;
};

/**
 * Menu "Buat soal dengan AI" DIPADAMKAN.
 *
 * Bukan dihapus: seluruh jalannya masih utuh, dari pembaca dokumen di peramban
 * sampai /api/cbt/ai-soal, dan menyalakannya kembali cukup dengan menyetel
 * tetapan ini menjadi true. Yang dimatikan hanya pintunya di layar dosen,
 * beserta satu permintaan ke server yang tadinya berjalan pada tiap pemuatan
 * panel hanya untuk menanyakan apakah kuncinya terpasang.
 */
const AI_SOAL_TAMPIL = false;

const SOAL_KOSONG = {
  jenis: "pg" as JenisSoal,
  pertanyaan: "",
  pilihan: ["", "", "", ""],
  kunci: "0",
  pasangan: [] as Pasangan[],
  media: { ...MEDIA_KOSONG } as Media,
  bobot: 1,
  // Materi dan tingkat kesulitan tidak lagi punya isian di layar: keduanya
  // hampir tidak pernah diisi, sementara dua kotak itu memakan tempat pada
  // baris yang sama dengan jenis dan bobot. Nilainya tetap ikut terkirim
  // supaya kolomnya di basis data tidak berubah bentuk, dan soal yang datang
  // dari impor Excel atau Word tetap membawa tingkatnya sendiri.
  materi: "",
  tingkat: "sedang",
  pembahasan: "",
};

/**
 * Isi awal formulir untuk tiap jenis soal.
 *
 * Berganti jenis berarti berganti bentuk isian. Membiarkan sisa isian jenis
 * sebelumnya membuat dosen menyimpan soal penjodohan yang kuncinya masih
 * menunjuk pilihan ganda — dan itu baru ketahuan saat mahasiswa mengerjakan.
 */
function bentukJenis(jenis: JenisSoal) {
  if (jenis === "benar_salah") return { pilihan: ["Benar", "Salah"], kunci: "0", pasangan: [] as Pasangan[] };
  if (jenis === "pg") return { pilihan: ["", "", "", ""], kunci: "0", pasangan: [] as Pasangan[] };
  if (jenis === "pg_kompleks") return { pilihan: ["", "", "", ""], kunci: "", pasangan: [] as Pasangan[] };
  if (jenis === "penjodohan") {
    return {
      pilihan: ["", "", ""],
      kunci: "",
      pasangan: [{ kiri: "", kanan: 0 }, { kiri: "", kanan: 1 }] as Pasangan[],
    };
  }
  return { pilihan: [] as string[], kunci: "", pasangan: [] as Pasangan[] };
}

/**
 * SETELAN UJIAN, beserta keterangannya masing-masing.
 *
 * Satu daftar, dipakai dua kali: pada formulir "Buat ujian" dan pada panel
 * "Pengaturan ujian" yang dibuka sesudah ujiannya jadi. Dulu daftarnya hanya
 * ada di formulir pembuatan — artinya satu-satunya kesempatan menyetelnya
 * adalah sebelum ujiannya pernah dipakai sama sekali.
 *
 * Tiap baris membawa KETERANGANNYA sendiri. "Satu perangkat hanya untuk satu
 * peserta" terbaca jelas oleh yang membuatnya, tetapi tidak menjelaskan apa
 * yang terjadi pada mahasiswa yang ponselnya sudah dipakai temannya — dan
 * itulah yang perlu diketahui pengawas pada menit-menit ujian berjalan.
 *
 * `bentuk` menandai setelan yang MENGUBAH BENTUK ujian. Hanya keempat itu yang
 * terkunci selagi ujian berlangsung; aturan yang sama dijaga server pada
 * /api/cbt/ujian.
 */
type KunciSetelan = "randomQuestions" | "randomOptions" | "allowBack" | "showScore" | "singleDevice";

const SETELAN: Array<{ kunci: KunciSetelan; label: string; jelas: string; bentuk: boolean }> = [
  {
    kunci: "randomQuestions",
    label: "Acak urutan soal",
    jelas: "Tiap peserta menerima urutan soal yang berbeda.",
    bentuk: true,
  },
  {
    kunci: "randomOptions",
    label: "Acak urutan pilihan jawaban",
    jelas: "Huruf A sampai D tidak sama antarpeserta, jadi menyalin jawaban sebelah tidak berguna.",
    bentuk: true,
  },
  {
    kunci: "allowBack",
    label: "Boleh kembali ke soal sebelumnya",
    jelas: "Bila centangnya dilepas, soal yang sudah dilewati tidak dapat dibuka lagi.",
    bentuk: false,
  },
  {
    kunci: "showScore",
    label: "Tampilkan nilai setelah selesai",
    jelas: "Nilai langsung terlihat peserta begitu jawabannya dikumpulkan.",
    bentuk: false,
  },
  {
    kunci: "singleDevice",
    label: "Satu perangkat untuk satu peserta",
    jelas: "Mencegah satu ponsel dipakai bergantian. Lepas centangnya bila ada peserta yang terlanjur terblokir.",
    bentuk: false,
  },
];

/** Kabar yang menempel pada satu tombol. */
type Kabar = { keadaan: "jalan" | "oke" | "gagal"; teks: string };

/**
 * Tombol yang mengatakan sendiri apa yang sedang terjadi padanya.
 *
 * Sebelumnya seluruh tombol panel ini hanya berubah menjadi abu-abu saat
 * ditekan, dan kabar hasilnya muncul sebagai pita tipis di puncak panel —
 * sering jauh di luar layar. Yang menekan tombol menatap tombolnya, jadi di
 * situlah kabarnya ditulis: "Menghapus…" lalu "✓ Terhapus", di tempat yang
 * sama, dengan warna yang ikut berganti.
 */
function Tbl({
  kabar, diam, dasar = "btn btn-primary", mati = false, judul, onClick,
}: {
  kabar?: Kabar;
  diam: string;
  dasar?: string;
  mati?: boolean;
  judul?: string;
  onClick: () => void;
}) {
  const rasa =
    kabar?.keadaan === "oke" ? " btn-oke" : kabar?.keadaan === "gagal" ? " btn-gagal" : "";
  return (
    <button
      type="button"
      className={`${dasar}${rasa} cbt-tbl`}
      disabled={mati || kabar?.keadaan === "jalan"}
      title={judul}
      onClick={onClick}
    >
      <span aria-live="polite">{kabar ? kabar.teks : diam}</span>
    </button>
  );
}

/** Deretan centang setelan, sejajar dan masing-masing membawa keterangannya. */
function DaftarSetelan({
  nilai, kunciBentuk = false, ubah,
}: {
  nilai: Record<KunciSetelan, boolean>;
  /** Ujian sedang berlangsung: yang mengubah bentuknya dikunci, sisanya tidak. */
  kunciBentuk?: boolean;
  ubah: (kunci: KunciSetelan, nyala: boolean) => void;
}) {
  return (
    <div className="cbt-sakelar">
      {SETELAN.map((s) => {
        const mati = kunciBentuk && s.bentuk;
        return (
          <label key={s.kunci} className={`cbt-cek${mati ? " mati" : ""}`}>
            <input
              type="checkbox"
              checked={nilai[s.kunci]}
              disabled={mati}
              onChange={(e) => ubah(s.kunci, e.target.checked)}
            />
            <span>{s.label}</span>
            <small>{mati ? `${s.jelas} Terkunci sampai ujian selesai.` : s.jelas}</small>
          </label>
        );
      })}
    </div>
  );
}

/** Salin setelan satu ujian ke bentuk yang dipakai formulir pengaturan. */
function setelanUjian(u: Ujian) {
  return {
    title: u.title,
    courseName: u.courseName,
    className: u.className ?? "",
    instruction: u.instruction ?? "",
    token: u.token ?? "",
    questionCount: u.questionCount,
    durationMinutes: u.durationMinutes,
    passingGrade: u.passingGrade,
    maxAttempts: u.maxAttempts,
    randomQuestions: u.randomQuestions,
    randomOptions: u.randomOptions,
    allowBack: u.allowBack,
    showScore: u.showScore,
    singleDevice: u.singleDevice,
  };
}

/** Ubah tanggal ISO menjadi nilai untuk <input type="datetime-local">. */
function untukInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function jamRapi(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function CbtPanel({ role }: { role: string }) {
  // Peran hanya menentukan SEBUTAN di layar dan siapa yang melihat seluruh
  // daftar. Izin sesungguhnya datang per ujian dari server — lihat pemilik()
  // di src/app/api/cbt/ujian/route.ts.
  const pemantau = role === "super_admin" || role === "admin";

  const [ujian, setUjian] = useState<Ujian[]>([]);
  const [muat, setMuat] = useState(true);
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState<number | null>(null);
  const [tab, setTab] = useState<"soal" | "pantau">("soal");
  const [buatBaru, setBuatBaru] = useState(false);

  const [draf, setDraf] = useState({
    title: "", courseName: "", className: "",
    questionCount: 20, durationMinutes: 60, passingGrade: 60, maxAttempts: 1,
    token: "", instruction: "",
    randomQuestions: true, randomOptions: true, allowBack: true, showScore: true,
    singleDevice: true,
  });

  const [soal, setSoal] = useState<Soal[]>([]);
  const [soalBaru, setSoalBaru] = useState({ ...SOAL_KOSONG });
  const [sunting, setSunting] = useState<number | null>(null);

  const [peserta, setPeserta] = useState<Peserta[]>([]);
  const [statistik, setStatistik] = useState<Statistik | null>(null);
  const [analisis, setAnalisis] = useState<Analisis[]>([]);

  // Koreksi essay: satu peserta yang sedang dibuka, beserta rincian jawabannya.
  const [bukaPeserta, setBukaPeserta] = useState<Peserta | null>(null);
  const [rincian, setRincian] = useState<Rincian[]>([]);
  const [draftKoreksi, setDraftKoreksi] = useState<Record<number, { poin: string; catatan: string }>>({});
  const [muatRincian, setMuatRincian] = useState(false);

  // Berita acara: dua keterangan yang hanya diketahui pengawasnya sendiri.
  const [acara, setAcara] = useState({ pengawas: "", ruang: "", catatan: "" });

  // Impor massal: hasil bacaan berkas ditahan dulu untuk dilihat dosen
  // sebelum benar-benar masuk. Empat puluh soal yang langsung tersimpan tanpa
  // sempat dilihat berarti empat puluh soal yang harus diperiksa satu per satu
  // sesudahnya.
  const [imporSoal, setImporSoal] = useState<SoalImpor[]>([]);
  const [imporTolak, setImporTolak] = useState<Array<{ baris: string; alasan: string }>>([]);
  const [imporNama, setImporNama] = useState("");
  const [tersalin, setTersalin] = useState("");

  const [jadwal, setJadwal] = useState({ mulai: "", selesai: "" });

  // Pengaturan ujian yang sedang dibuka. Terlipat sampai diminta, tetapi
  // isinya selalu disiapkan begitu ujiannya dibuka: yang membukanya karena
  // keadaan mendesak tidak boleh menunggu satu perjalanan ke server lagi.
  const [setel, setSetel] = useState({
    title: "", courseName: "", className: "", instruction: "", token: "",
    questionCount: 0, durationMinutes: 60, passingGrade: 60, maxAttempts: 1,
    randomQuestions: true, randomOptions: true, allowBack: true, showScore: true,
    singleDevice: true,
  });
  const [bukaSetel, setBukaSetel] = useState(false);

  /**
   * Dua bagian panjang yang dilipat sampai diminta.
   *
   * Keduanya jarang dipakai tetapi memakan tinggi layar yang sama besarnya
   * dengan bagian yang dipakai setiap hari. Cetak naskah hanya keluar sekali
   * menjelang ujian, dan sebagian besar soal tidak bergambar sama sekali.
   */
  const [lipatCetak, setLipatCetak] = useState(false);
  const [bukaMedia, setBukaMedia] = useState(false);

  /**
   * KABAR PADA TOMBOLNYA SENDIRI, satu per tombol.
   *
   * Dulu panel ini hanya punya dua tempat berkabar: pita hijau dan pita merah
   * di puncak halaman. Panelnya panjang — tombol "Hapus soal" yang ditekan di
   * dasar bank soal membuat pita itu muncul jauh di luar layar, jadi yang
   * terlihat hanyalah tombol yang berubah abu-abu sebentar. Orang lalu
   * menekannya dua kali karena mengira tekanan pertamanya tidak masuk.
   *
   * Sekarang tiap tombol membawa kabarnya sendiri, dikunci pada namanya:
   * "Menghapus…" saat berjalan, "✓ Terhapus" saat berhasil, "✕ Gagal" saat
   * tidak. Pita di puncak panel tetap ada untuk keterangan panjangnya.
   *
   * `tolakSoal` berisi daftar yang kurang atau salah, dan ia muncul sebagai
   * jendela yang harus ditutup. Sengaja menghalangi: soal yang ditolak
   * diam-diam adalah soal yang dikira sudah masuk sampai pagi hari ujian.
   */
  const [aksi, setAksi] = useState<Record<string, Kabar>>({});
  const [tolakSoal, setTolakSoal] = useState<{ judul: string; rincian: string[] } | null>(null);
  const jamAksi = useRef<Record<string, number>>({});
  useEffect(() => {
    const jam = jamAksi.current;
    return () => { Object.values(jam).forEach((t) => window.clearTimeout(t)); };
  }, []);

  /**
   * Pasang kabar pada satu tombol, dan padamkan sendiri sesudah `redup` milidetik.
   *
   * Penghitung waktunya disimpan per tombol supaya dua tombol yang ditekan
   * beruntun tidak saling memadamkan kabar masing-masing.
   */
  function kabari(kunci: string, keadaan: Kabar["keadaan"], teks: string, redup = 0) {
    setAksi((kini) => ({ ...kini, [kunci]: { keadaan, teks } }));
    if (jamAksi.current[kunci]) window.clearTimeout(jamAksi.current[kunci]);
    delete jamAksi.current[kunci];
    if (redup > 0) {
      jamAksi.current[kunci] = window.setTimeout(() => {
        delete jamAksi.current[kunci];
        setAksi((kini) => {
          const salin = { ...kini };
          delete salin[kunci];
          return salin;
        });
      }, redup);
    }
  }

  /** Sedang berjalan? Dipakai tombol yang bukan <Tbl>, mis. label unggah berkas. */
  const berjalan = (kunci: string) => aksi[kunci]?.keadaan === "jalan";

  // Escape menutup jendela penolakan. Jendela yang menghalangi tetapi hanya
  // dapat ditutup dengan tetikus adalah jebakan bagi yang mengetik cepat.
  useEffect(() => {
    if (!tolakSoal) return;
    const tekan = (e: KeyboardEvent) => { if (e.key === "Escape") setTolakSoal(null); };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [tolakSoal]);

  // ---------- BUAT SOAL DENGAN AI ----------
  const [aiSiap, setAiSiap] = useState<boolean | null>(null);
  const [aiPenyedia, setAiPenyedia] = useState<string[]>([]);
  const [sari, setSari] = useState<HasilSari | null>(null);
  const [sariNama, setSariNama] = useState("");
  const [aiSibuk, setAiSibuk] = useState(false);
  const [aiKabar, setAiKabar] = useState("");
  const [aiAtur, setAiAtur] = useState({
    jumlah: 10,
    jenis: ["pg"] as JenisSoal[],
    tingkat: "campuran" as "campuran" | "mudah" | "sedang" | "sulit",
    arahan: "",
  });

  // Daftarnya ikut DIKEMBALIKAN, bukan hanya disimpan ke state: yang baru
  // menyimpan pengaturan perlu membaca nilai yang benar-benar tersimpan
  // (server membulatkan dan memotongnya) tanpa menunggu gambar berikutnya.
  const muatUjian = useCallback(async () => {
    try {
      const jawab = await fetch("/api/cbt/ujian", { cache: "no-store" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Daftar ujian tidak terbaca.");
      const daftar = (data.ujian || []) as Ujian[];
      setUjian(daftar);
      setGalat("");
      return daftar;
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Daftar ujian tidak terbaca.");
      return null;
    } finally {
      setMuat(false);
    }
  }, []);

  useEffect(() => {
    const tunda = window.setTimeout(() => void muatUjian(), 0);
    return () => window.clearTimeout(tunda);
  }, [muatUjian]);

  // Ditanyakan sekali di awal: menu AI yang tampil lengkap lalu menjawab
  // "belum ada kunci" sesudah dosen mengunggah dokumen dan menunggu satu menit
  // adalah cara paling buruk menyampaikan kabar itu.
  useEffect(() => {
    if (!AI_SOAL_TAMPIL) return;
    const tunda = window.setTimeout(() => {
      fetch("/api/cbt/ai-soal", { cache: "no-store" })
        .then((jawab) => jawab.json())
        .then((data) => {
          if (!data.success) return;
          setAiSiap(Boolean(data.siap));
          setAiPenyedia(data.tersedia || []);
        })
        .catch(() => setAiSiap(false));
    }, 0);
    return () => window.clearTimeout(tunda);
  }, []);

  // Monitoring ujian yang sedang berlangsung menyegar sendiri tiap sepuluh
  // detik: dosen yang harus menekan tombol muat ulang tiap menit tidak sedang
  // memantau apa pun.
  useEffect(() => {
    if (buka === null || tab !== "pantau") return;
    const jam = setInterval(() => void muatHasil(buka), 10_000);
    return () => clearInterval(jam);
  }, [buka, tab]);

  const terbuka = ujian.find((u) => u.id === buka) || null;

  async function muatSoal(id: number) {
    try {
      const jawab = await fetch(`/api/cbt/soal?ujian=${id}`, { cache: "no-store" });
      const data = await jawab.json();
      if (data.success) setSoal(data.soal || []);
    } catch {
      // Daftar soal kosong lebih baik daripada galat merah yang menutup panel.
    }
  }

  async function muatHasil(id: number) {
    try {
      const jawab = await fetch(`/api/cbt/hasil?ujian=${id}`, { cache: "no-store" });
      const data = await jawab.json();
      if (data.success) {
        setPeserta(data.peserta || []);
        setStatistik(data.statistik || null);
        setAnalisis(data.analisis || []);
      }
    } catch {
      // Diabaikan; angka lama tetap tampil sampai pemuatan berikutnya.
    }
  }

  function bukaUjian(u: Ujian) {
    setBuka(u.id);
    setTab("soal");
    setSunting(null);
    setBukaPeserta(null);
    setRincian([]);
    setSoalBaru({ ...SOAL_KOSONG });
    setJadwal({ mulai: untukInput(u.startAt), selesai: untukInput(u.endAt) });
    setSetel(setelanUjian(u));
    setBukaSetel(false);
    setAksi({});
    void muatSoal(u.id);
    void muatHasil(u.id);
  }

  /**
   * Satu perjalanan ke server, dengan kabarnya menempel pada tombol pemanggil.
   *
   * `kunci` adalah nama tombolnya; `label.jalan` yang tertulis selama menunggu
   * dan `label.oke` sesudah berhasil — keduanya menyebut apa yang terjadi,
   * bukan sekadar warna yang berganti. `label.pesan` yang panjang, untuk pita
   * hijau di puncak panel: satu tombol tidak muat memuat kalimat penuh.
   */
  async function kirim(
    kunci: string,
    alamat: string,
    cara: string,
    isi: unknown,
    label: { jalan: string; oke: string; pesan?: string },
  ) {
    kabari(kunci, "jalan", label.jalan);
    setPesan("");
    setGalat("");
    try {
      const jawab = await fetch(alamat, {
        method: cara,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isi),
      });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Belum tersimpan.");
      kabari(kunci, "oke", `✓ ${label.oke}`, 3400);
      setPesan(label.pesan ?? label.oke);
      return data as Record<string, unknown>;
    } catch (alasan: unknown) {
      const sebab = alasan instanceof Error ? alasan.message : "Belum tersimpan.";
      // Sebab lengkapnya tetap di pita merah — tombolnya terlalu sempit untuk
      // satu kalimat — tetapi tombolnya sendiri yang mengatakan ada yang gagal.
      kabari(kunci, "gagal", "✕ Gagal, lihat keterangannya", 6000);
      setGalat(sebab);
      return null;
    }
  }

  async function buatUjian() {
    if (!draf.title.trim() || !draf.courseName.trim()) {
      setGalat("Nama ujian dan mata kuliah wajib diisi.");
      kabari("buat", "gagal", "✕ Nama ujian dan mata kuliah wajib diisi", 5000);
      return;
    }
    const hasil = await kirim("buat", "/api/cbt/ujian", "POST", draf, {
      jalan: "Membuat ujian…",
      oke: "Ujian dibuat",
      pesan: "Ujian dibuat. Sekarang isi soalnya.",
    });
    if (!hasil) return;
    setBuatBaru(false);
    setDraf({ ...draf, title: "", className: "", instruction: "", token: "" });
    await muatUjian();
  }

  /**
   * Simpan pengaturan ujian yang sedang dibuka.
   *
   * Inilah yang selama ini tidak ada: setelan hanya dapat ditentukan pada saat
   * ujian dibuat, dan sesudah itu tidak ada satu pun layar yang memanggil
   * PATCH /api/cbt/ujian. Pengawas yang perlu melepas centang "satu perangkat"
   * di tengah ujian — karena satu mahasiswa terlanjur terblokir oleh ponsel
   * temannya — tidak punya jalan sama sekali.
   */
  async function simpanSetelan() {
    if (!terbuka) return;
    if (!setel.title.trim() || !setel.courseName.trim()) {
      setGalat("Nama ujian dan mata kuliah wajib diisi.");
      kabari("setel", "gagal", "✕ Nama ujian dan mata kuliah wajib diisi", 5000);
      return;
    }
    if (setelanBerubah.length === 0) {
      kabari("setel", "oke", "✓ Tidak ada yang perlu disimpan", 2600);
      return;
    }
    const hasil = await kirim("setel", "/api/cbt/ujian", "PATCH", { id: terbuka.id, ...setel }, {
      jalan: "Menyimpan pengaturan…",
      oke: "Pengaturan tersimpan",
      pesan: "Pengaturan ujian tersimpan.",
    });
    if (!hasil) return;
    // Diambil ulang dari server, bukan dianggap sama dengan yang dikirim:
    // angka di luar batas dibulatkan di sana, dan formulirnya harus
    // memperlihatkan yang benar-benar berlaku.
    const daftar = await muatUjian();
    const baru = daftar?.find((u) => u.id === terbuka.id);
    if (baru) setSetel(setelanUjian(baru));
  }

  /**
   * Periksa soal di peramban, sebelum apa pun dikirim.
   *
   * Aturannya sengaja SAMA dengan rapikanSoal di server. Yang di server tetap
   * berlaku dan tetap menjadi penentu; yang di sini hanya menjaga agar soal
   * yang sudah pasti ditolak tidak sempat muncul di daftar sebagai soal yang
   * seolah-olah tersimpan.
   *
   * Yang dikembalikan DAFTAR, bukan satu kalimat. Dulu pemeriksaan berhenti
   * pada keluhan pertama, jadi dosen yang lupa mengisi pilihan sekaligus lupa
   * menandai kuncinya memperbaikinya satu per satu, menekan tombol, dan
   * menemukan keluhan berikutnya. Sekarang semuanya disebut sekali jalan.
   */
  function periksaSoal(isi: typeof SOAL_KOSONG): string[] {
    const keluhan: string[] = [];
    if (isi.pertanyaan.trim().length < 3) keluhan.push("Pertanyaan belum diisi.");
    const terisi = isi.pilihan.filter((p) => p.trim().length > 0);
    const adaKosong = isi.pilihan.length > terisi.length;

    if (isi.jenis === "pg" || isi.jenis === "benar_salah") {
      if (terisi.length < 2) keluhan.push("Pilihan jawaban minimal dua, dan keduanya harus ada isinya.");
      else if (adaKosong) keluhan.push("Ada kotak pilihan yang masih kosong. Isi atau buang kotaknya.");
      const nomor = Number(isi.kunci);
      if (!Number.isInteger(nomor) || nomor < 0 || nomor >= terisi.length) {
        keluhan.push("Kunci jawaban belum ditandai. Tekan lingkaran huruf di sebelah kiri pilihan yang benar.");
      }
    }
    if (isi.jenis === "pg_kompleks") {
      if (terisi.length < 2) keluhan.push("Pilihan jawaban minimal dua, dan keduanya harus ada isinya.");
      else if (adaKosong) keluhan.push("Ada kotak pilihan yang masih kosong. Isi atau buang kotaknya.");
      const kunci = uraiKunciJamak(isi.kunci);
      if (kunci.size === 0) keluhan.push("Belum ada jawaban yang ditandai benar. Tandai semua yang benar.");
      else if (kunci.size >= terisi.length) {
        keluhan.push("Seluruh pilihan ditandai benar. Sisakan minimal satu pengecoh, kalau tidak soalnya tidak mengukur apa pun.");
      }
    }
    if (isi.jenis === "penjodohan") {
      if (terisi.length < 2) keluhan.push("Kolom jawaban penjodohan minimal dua, dan keduanya harus ada isinya.");
      const lengkap = isi.pasangan.filter(
        (p) => p.kiri.trim().length > 0 && Number.isInteger(p.kanan) && p.kanan >= 0 && p.kanan < terisi.length,
      );
      if (lengkap.length < 2) keluhan.push("Penjodohan perlu minimal dua pasangan yang lengkap: kolom kiri terisi dan jawabannya dipilih.");
    }
    if (isi.jenis === "isian" && !isi.kunci.trim()) {
      keluhan.push("Kunci jawaban isian singkat belum diisi.");
    }
    if (isi.media.jenis && !isi.media.url.trim()) {
      keluhan.push("Media sudah dipilih jenisnya, tetapi tautannya masih kosong. Tempel tautannya, unggah berkasnya, atau kembalikan ke Tanpa media.");
    }
    if (!Number.isInteger(isi.bobot) || isi.bobot < 1 || isi.bobot > 100) {
      keluhan.push("Bobot nilai harus berupa angka 1 sampai 100.");
    }
    return keluhan;
  }

  /** Centang atau lepas satu pilihan sebagai kunci pada PG kompleks. */
  function tandaiKunciJamak(nomor: number) {
    const kini = uraiKunciJamak(soalBaru.kunci);
    if (kini.has(nomor)) kini.delete(nomor);
    else kini.add(nomor);
    setSoalBaru({ ...soalBaru, kunci: [...kini].sort((a, b) => a - b).join(",") });
  }

  /** Unggah satu berkas media untuk soal yang sedang disusun. */
  async function unggahMedia(berkas: File) {
    if (!terbuka) return;
    kabari("media", "jalan", "Mengunggah…");
    setGalat("");
    try {
      const badan = new FormData();
      badan.append("ujian", String(terbuka.id));
      badan.append("berkas", berkas);
      const jawab = await fetch("/api/cbt/media", { method: "POST", body: badan });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Media belum dapat diunggah.");
      setSoalBaru((kini) => ({
        ...kini,
        media: { jenis: data.jenis, url: data.url, keterangan: kini.media.keterangan },
      }));
      setPesan("Media terunggah.");
      kabari("media", "oke", "✓ Media terunggah", 3400);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Media belum dapat diunggah.");
      kabari("media", "gagal", "✕ Gagal mengunggah", 6000);
    }
  }

  /**
   * Simpan satu soal.
   *
   * MENAMBAH soal berjalan optimistis: soalnya muncul di daftar seketika,
   * formulirnya langsung kosong, dan pengirimannya berjalan di belakang.
   * Sebelumnya tombol ini menunggu tiga perjalanan ke server berturut-turut —
   * simpan, muat ulang bank soal, muat ulang daftar ujian — dan dosen yang
   * mengetik dua puluh soal menunggu dua puluh kali.
   *
   * Bila kiriman itu ternyata gagal, soalnya ditarik kembali dari daftar DAN
   * isinya dikembalikan ke formulir. Kegagalan diam-diam yang menelan soal
   * yang sudah diketik jauh lebih buruk daripada menunggu.
   */
  async function simpanSoal() {
    if (!terbuka) return;
    const target = sunting;
    const isi = { ...soalBaru, pilihan: [...soalBaru.pilihan] };

    const keluhan = periksaSoal(isi);
    if (keluhan.length > 0) {
      // Menyebut media yang salah sambil membiarkan bagiannya terlipat berarti
      // menyuruh dosen mencari sendiri isian yang tidak kelihatan.
      if (keluhan.some((k) => k.startsWith("Media"))) setBukaMedia(true);
      setTolakSoal({
        judul: target ? "Perubahan belum dapat disimpan" : "Soal belum dapat ditambahkan",
        rincian: keluhan,
      });
      return;
    }

    if (target) {
      const hasil = await kirim("soal", "/api/cbt/soal", "PATCH", { id: target, ...isi }, {
        jalan: "Menyimpan perubahan…",
        oke: "Perubahan disimpan",
        pesan: "Perubahan soal tersimpan.",
      });
      if (!hasil) return;
      setSoalBaru({ ...SOAL_KOSONG });
      setSunting(null);
      await muatSoal(terbuka.id);
      return;
    }

    // Id sementara bernilai negatif, supaya tidak mungkin bertabrakan dengan
    // id sungguhan dari basis data dan tombol Ubah/Hapus dapat menolaknya.
    const idSementara = -Date.now();
    setSoal((kini) => [...kini, { id: idSementara, ...isi }]);
    setSoalBaru({ ...SOAL_KOSONG });
    setGalat("");
    setPesan("Soal ditambahkan.");
    kabari("soal", "oke", "✓ Berhasil ditambahkan", 2600);

    try {
      const jawab = await fetch("/api/cbt/soal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ujian: terbuka.id, soal: [isi] }),
      });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Soal belum tersimpan.");
      const asli = (data.soal as Soal[] | undefined)?.[0];
      setSoal((kini) =>
        asli ? kini.map((x) => (x.id === idSementara ? asli : x)) : kini.filter((x) => x.id !== idSementara),
      );
      if (!asli) await muatSoal(terbuka.id);
    } catch (alasan: unknown) {
      // Gagal sesudah tombolnya sempat berkata berhasil. Tanda hijau itu
      // ditarik kembali, soalnya dikeluarkan lagi dari daftar, isinya
      // dikembalikan ke formulir, dan alasannya dikatakan di jendela yang
      // harus ditutup: kegagalan yang lewat begitu saja meninggalkan dosen
      // dengan bank soal yang ia kira sudah lengkap.
      kabari("soal", "gagal", "✕ Gagal disimpan", 6000);
      setSoal((kini) => kini.filter((x) => x.id !== idSementara));
      setSoalBaru(isi);
      setPesan("");
      setTolakSoal({
        judul: "Soal gagal disimpan ke server",
        rincian: [
          alasan instanceof Error ? alasan.message : "Soal belum tersimpan.",
          "Isian soalnya sudah dikembalikan ke formulir, jadi tidak ada yang perlu diketik ulang. Periksa sambungan internet, lalu tekan tombolnya lagi.",
        ],
      });
    }
  }

  async function hapusSoal(id: number) {
    if (!terbuka || !window.confirm("Hapus soal ini?")) return;
    const kunci = `soal-${id}`;
    // Soal yang masih dalam perjalanan ke server belum punya id sungguhan.
    if (id < 0) {
      setGalat("Soal ini masih dalam proses penyimpanan. Tunggu sebentar.");
      kabari(kunci, "gagal", "Masih disimpan", 4000);
      return;
    }
    kabari(kunci, "jalan", "Menghapus…");
    try {
      const jawab = await fetch(`/api/cbt/soal?id=${id}`, { method: "DELETE" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Soal belum dapat dihapus.");
      setPesan("Soal dihapus.");
      // Kabar "✓ Terhapus" tidak sempat terbaca — barisnya ikut hilang bersama
      // pemuatan ulang — jadi yang dipakai pita hijau di puncak panel.
      kabari(kunci, "oke", "✓ Terhapus", 2000);
      await muatSoal(terbuka.id);
      await muatUjian();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Soal belum dapat dihapus.");
      kabari(kunci, "gagal", "✕ Gagal", 6000);
    }
  }

  async function aktifkan() {
    if (!terbuka) return;
    if (!jadwal.mulai || !jadwal.selesai) {
      setGalat("Jam mulai dan jam selesai wajib diisi.");
      kabari("aktif", "gagal", "✕ Jam mulai dan selesai wajib diisi", 5000);
      return;
    }
    const perbarui = Boolean(terbuka.activatedAt);
    const hasil = await kirim(
      "aktif",
      "/api/cbt/aktivasi",
      "POST",
      {
        id: terbuka.id,
        aksi: "aktifkan",
        mulai: new Date(jadwal.mulai).toISOString(),
        selesai: new Date(jadwal.selesai).toISOString(),
      },
      perbarui
        ? { jalan: "Memperbarui jadwal…", oke: "Jadwal diperbarui" }
        : {
            jalan: "Mengaktifkan ujian…",
            oke: "Ujian diaktifkan",
            pesan: "Ujian diaktifkan. Ia akan terbuka sendiri pada jam mulainya.",
          },
    );
    if (hasil) await muatUjian();
  }

  async function batalkanAktivasi() {
    if (!terbuka || !window.confirm("Batalkan aktivasi ujian ini?")) return;
    const hasil = await kirim(
      "batal-aktif",
      "/api/cbt/aktivasi",
      "POST",
      { id: terbuka.id, aksi: "batalkan" },
      { jalan: "Membatalkan…", oke: "Dibatalkan", pesan: "Aktivasi dibatalkan." },
    );
    if (hasil) await muatUjian();
  }

  async function hapusUjian() {
    if (!terbuka) return;
    const setuju = window.confirm(
      `Hapus ujian "${terbuka.title}" beserta seluruh soal dan hasilnya?\n\n` +
        "Tindakan ini tidak dapat dibatalkan.",
    );
    if (!setuju) return;
    kabari("hapus-ujian", "jalan", "Menghapus ujian…");
    try {
      const jawab = await fetch(`/api/cbt/ujian?id=${terbuka.id}`, { method: "DELETE" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Ujian belum dapat dihapus.");
      setBuka(null);
      setPesan("Ujian dihapus.");
      kabari("hapus-ujian", "oke", "✓ Terhapus", 2000);
      await muatUjian();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Ujian belum dapat dihapus.");
      kabari("hapus-ujian", "gagal", "✕ Gagal menghapus", 6000);
    }
  }

  // ---------- KOREKSI ESSAY ----------

  /**
   * Buka lembar jawaban satu peserta.
   *
   * Jalur inilah yang membuat soal essay dapat dinilai sama sekali. Rutenya
   * sudah ada sejak awal, tetapi tidak pernah ada layar yang memanggilnya —
   * artinya essay yang dikerjakan mahasiswa menggantung sebagai "menunggu
   * koreksi" selamanya, dan nilainya tidak pernah lengkap.
   */
  async function bukaLembar(p: Peserta) {
    if (!terbuka) return;
    kabari(`lembar-${p.id}`, "jalan", "Membuka…");
    setBukaPeserta(p);
    setRincian([]);
    setDraftKoreksi({});
    setMuatRincian(true);
    try {
      const jawab = await fetch(`/api/cbt/hasil?ujian=${terbuka.id}&attempt=${p.id}`, { cache: "no-store" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Lembar jawaban tidak terbaca.");
      const isi = (data.rincian || []) as Rincian[];
      setRincian(isi);
      // Kotak nilainya diisi lebih dulu dengan poin yang sudah ada, supaya
      // dosen yang hanya membetulkan satu angka tidak perlu mengetik ulang
      // seluruhnya.
      setDraftKoreksi(
        Object.fromEntries(
          isi.filter((r) => r.jenis === "essay").map((r) => [r.id, { poin: String(r.poin ?? 0), catatan: r.catatan || "" }]),
        ),
      );
      kabari(`lembar-${p.id}`, "oke", "✓ Terbuka di bawah", 2600);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Lembar jawaban tidak terbaca.");
      kabari(`lembar-${p.id}`, "gagal", "✕ Gagal dibuka", 6000);
      setBukaPeserta(null);
    } finally {
      setMuatRincian(false);
    }
  }

  async function koreksi(questionId: number, bobot: number) {
    if (!terbuka || !bukaPeserta) return;
    const draf = draftKoreksi[questionId];
    const poin = Number(draf?.poin);
    const kunci = `koreksi-${questionId}`;
    if (!Number.isFinite(poin) || poin < 0 || poin > bobot) {
      setGalat(`Nilai untuk soal ini harus antara 0 dan ${bobot}.`);
      kabari(kunci, "gagal", `✕ Nilai harus 0–${bobot}`, 5000);
      return;
    }
    const hasil = await kirim(
      kunci,
      "/api/cbt/hasil",
      "PATCH",
      { ujian: terbuka.id, attempt: bukaPeserta.id, soal: questionId, poin, catatan: draf?.catatan ?? "" },
      { jalan: "Menyimpan nilai…", oke: "Nilai tersimpan", pesan: "Koreksi tersimpan." },
    );
    if (!hasil) return;
    // Ditandai selesai di layar tanpa memuat ulang seluruh lembar, lalu daftar
    // pesertanya disegarkan supaya nilai barunya ikut terbaca.
    setRincian((kini) =>
      kini.map((r) => (r.id === questionId ? { ...r, benar: poin > 0, poin, catatan: draf?.catatan ?? "" } : r)),
    );
    await muatHasil(terbuka.id);
  }

  // ---------- TEMPLATE & IMPOR MASSAL ----------

  function unduh(isi: Blob, nama: string) {
    const alamat = URL.createObjectURL(isi);
    const tautan = document.createElement("a");
    tautan.href = alamat;
    tautan.download = nama;
    tautan.click();
    URL.revokeObjectURL(alamat);
  }

  /**
   * Dua template, dan hanya dua: .xlsx dan .docx.
   *
   * Keduanya dirakit sendiri di src/lib — bukan lewat SheetJS — karena edisi
   * komunitasnya tidak dapat menulis gaya sel, dan template tanpa warna, tanpa
   * baris kepala yang dibekukan, dan tanpa contoh yang dapat dibedakan adalah
   * template yang salah diisi.
   */
  function unduhTemplateExcel() {
    unduh(buatXlsxTemplate(), "Template-Soal-SiPaling.xlsx");
    setPesan("Template Excel terunduh. Isi lembar \"Soal\", lalu unggah kembali di sini.");
    kabari("tpl-xlsx", "oke", "✓ Template terunduh", 3400);
  }

  function unduhTemplateWord() {
    unduh(buatDocxTemplate(), "Template-Soal-SiPaling.docx");
    setPesan("Template Word terunduh. Tulis soalnya, lalu unggah kembali di sini.");
    kabari("tpl-docx", "oke", "✓ Template terunduh", 3400);
  }

  /**
   * Baca berkas soal yang diunggah dosen.
   *
   * Seluruhnya diurai DI PERAMBAN, sama seperti pengimpor transkrip: berkas
   * soal memuat kunci jawaban, dan tidak ada alasan ia singgah di server
   * sebelum dosennya sendiri melihat hasil bacaannya.
   */
  async function bacaBerkasSoal(berkas: File) {
    setPesan("");
    setGalat("");
    setImporNama(berkas.name);
    try {
      const nama = berkas.name.toLowerCase();
      if (nama.endsWith(".docx")) {
        // Modul yang sama dipakai pengimpor template surat; jenisnya sudah
        // dikenali TypeScript lewat jalur ini, tidak lewat build browser-nya.
        const mammoth = await import("mammoth");
        const hasil = await mammoth.extractRawText({ arrayBuffer: await berkas.arrayBuffer() });
        const bacaan = imporDariWord(hasil.value || "");
        setImporSoal(bacaan.soal);
        setImporTolak(bacaan.tolak);
      } else if (nama.endsWith(".xlsx") || nama.endsWith(".xls") || nama.endsWith(".csv")) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(new Uint8Array(await berkas.arrayBuffer()), { type: "array" });
        const sheet = wb.Sheets["Soal"] ?? wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(sheet as Parameters<typeof XLSX.utils.sheet_to_json>[0], {
          header: 1, defval: "", raw: false,
        }) as Aoa;
        const bacaan = imporDariExcel(aoa);
        setImporSoal(bacaan.soal);
        setImporTolak(bacaan.tolak);
      } else {
        throw new Error("Berkasnya harus .xlsx, .xls, .csv, atau .docx.");
      }
    } catch (alasan: unknown) {
      setImporSoal([]);
      setImporTolak([]);
      setGalat(alasan instanceof Error ? alasan.message : "Berkas tidak dapat dibaca.");
    }
  }

  // ---------- BUAT SOAL DENGAN AI ----------

  /**
   * Sarikan dokumen yang diunggah dosen — SELURUHNYA di peramban.
   *
   * Yang berangkat ke server nanti hanya teksnya. Bahan ujian adalah bahan
   * yang belum diujikan; ia tidak perlu singgah di tempat lain hanya untuk
   * dijadikan soal.
   */
  async function bacaBahanAi(berkas: File) {
    setAiKabar("");
    setGalat("");
    setSari(null);
    setSariNama(berkas.name);
    setAiSibuk(true);
    try {
      const hasil = await sarikanDokumen(berkas);
      if (hasil.kata < 120) {
        throw new Error(
          `Hanya ${hasil.kata} kata yang terbaca dari berkas ini. ` +
            "Bila ini PDF hasil pindaian, teksnya berupa gambar dan belum dapat dibaca, " +
            "pakai dokumen aslinya.",
        );
      }
      setSari(hasil);
      // Jumlah soal disarankan dari panjang naskahnya, bukan dibiarkan pada
      // angka bawaan yang mungkin jauh melampaui isinya.
      const wajar = Math.max(1, Math.min(Math.floor(hasil.kata / 60), MAKS_SOAL));
      setAiAtur((kini) => ({ ...kini, jumlah: Math.min(kini.jumlah, wajar) || wajar }));
      setAiKabar(
        `${hasil.kata.toLocaleString("id-ID")} kata terbaca` +
          (hasil.bagian > 0 ? ` dari ${hasil.bagian} ${hasil.jenis === "pptx" ? "salindia" : "halaman"}` : "") +
          `. Sekitar ${wajar} soal masih wajar dari naskah sepanjang ini.`,
      );
    } catch (alasan: unknown) {
      setSariNama("");
      setGalat(alasan instanceof Error ? alasan.message : "Dokumen tidak dapat dibaca.");
    } finally {
      setAiSibuk(false);
    }
  }

  async function buatSoalAi() {
    if (!terbuka || !sari) return;
    setAiSibuk(true);
    setGalat("");
    setPesan("");
    try {
      const jawab = await fetch("/api/cbt/ai-soal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ujian: terbuka.id,
          teks: sari.teks,
          jumlah: aiAtur.jumlah,
          jenis: aiAtur.jenis,
          tingkat: aiAtur.tingkat,
          materi: terbuka.courseName,
          arahan: aiAtur.arahan,
        }),
      });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) {
        if (Array.isArray(data.tolak) && data.tolak.length > 0) setImporTolak(data.tolak);
        throw new Error(data.message || "Soal belum dapat dibuat.");
      }
      // Hasilnya masuk ke pratinjau impor yang sudah ada — bukan langsung ke
      // bank soal. Dosen yang memutuskan, dan ia melihatnya lebih dulu.
      setImporSoal(data.soal || []);
      setImporTolak(data.tolak || []);
      setImporNama(`Dibuat AI dari ${sariNama}`);
      setAiKabar(
        `${(data.soal || []).length} soal dibuat` +
          (data.kurang > 0 ? `, ${data.kurang} kurang dari yang diminta` : "") +
          `. Periksa dulu di bawah, lalu masukkan ke bank soal.`,
      );
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Soal belum dapat dibuat.");
    } finally {
      setAiSibuk(false);
    }
  }

  async function terbitkanImpor() {
    if (!terbuka || imporSoal.length === 0) return;
    const hasil = await kirim(
      "impor",
      "/api/cbt/soal",
      "POST",
      { ujian: terbuka.id, soal: imporSoal },
      {
        jalan: `Memasukkan ${imporSoal.length} soal…`,
        oke: `${imporSoal.length} soal masuk`,
        pesan: `${imporSoal.length} soal masuk ke bank soal.`,
      },
    );
    if (!hasil) return;
    setImporSoal([]);
    setImporTolak([]);
    setImporNama("");
    await muatSoal(terbuka.id);
    await muatUjian();
  }

  // ---------- LEMBAR CETAK ----------

  /**
   * Buka satu berkas cetak pada jendelanya sendiri.
   *
   * Cara yang sama dipakai surat tugas dan laporan antrean di portal ini, jadi
   * dosennya sudah mengenalnya: tekan Cetak, lalu pilih "Simpan sebagai PDF".
   */
  function bukaCetak(html: string, kunciTombol: string) {
    const jendela = window.open("", "_blank");
    if (!jendela) {
      setGalat("Popup diblokir peramban. Izinkan popup untuk situs ini, lalu coba lagi.");
      kabari(kunciTombol, "gagal", "✕ Popup diblokir", 6000);
      return;
    }
    jendela.document.write(html);
    jendela.document.close();
    kabari(kunciTombol, "oke", "✓ Dibuka di tab baru", 3400);
  }

  function keteranganUjian(): UjianCetak | null {
    if (!terbuka) return null;
    return {
      judul: terbuka.title,
      mataKuliah: terbuka.courseName,
      kelas: terbuka.className,
      kode: terbuka.code,
      durasi: terbuka.durationMinutes,
      jumlahSoal: terbuka.questionCount || soal.length,
      instruksi: terbuka.instruction,
      mulai: terbuka.startAt,
      selesai: terbuka.endAt,
    };
  }

  function cetakNaskah(denganKunci: boolean) {
    const kunciTombol = denganKunci ? "naskah-kunci" : "naskah";
    const info = keteranganUjian();
    if (!info || soal.length === 0) {
      setGalat("Bank soalnya masih kosong, belum ada yang dapat dicetak.");
      kabari(kunciTombol, "gagal", "✕ Bank soal masih kosong", 5000);
      return;
    }
    if (denganKunci) {
      const setuju = window.confirm(
        "Berkas ini memuat KUNCI JAWABAN dan hanya untuk pengawas.\n\n" +
          "Jangan sampai tercetak bersama naskah mahasiswa. Lanjutkan?",
      );
      if (!setuju) return;
    }
    bukaCetak(naskahSoalHtml(info, soal, { denganKunci }), kunciTombol);
  }

  function cetakBeritaAcara(kunciTombol = "acara") {
    const info = keteranganUjian();
    if (!info) return;
    bukaCetak(
      beritaAcaraHtml(info, {
        pengawas: acara.pengawas,
        ruang: acara.ruang,
        catatan: acara.catatan,
        hadir: peserta.length,
        terdaftar: peserta.length,
        selesai: peserta.filter((p) => p.status !== "berjalan").length,
        berjalan: peserta.filter((p) => p.status === "berjalan").length,
        pelanggaran: peserta.reduce((n, p) => n + p.pindahTab + p.keluarFullscreen, 0),
        peserta: peserta.map((p) => ({
          nim: p.nim, nama: p.nama, status: p.status,
          pindahTab: p.pindahTab, keluarFullscreen: p.keluarFullscreen,
        })),
      }),
      kunciTombol,
    );
  }

  function cetakLaporanPeserta() {
    const info = keteranganUjian();
    if (!info || !bukaPeserta || !terbuka) return;
    const orang: PesertaCetak = {
      nim: bukaPeserta.nim, nama: bukaPeserta.nama, nilai: bukaPeserta.nilai,
      benar: rincian.filter((r) => r.benar === true).length,
      sebagian: rincian.filter((r) => r.benar === false && r.poin > 0).length,
      salah: rincian.filter((r) => r.benar === false && r.poin <= 0).length,
      kosong: rincian.filter((r) => !r.jawabanTeks).length,
      tertunda: bukaPeserta.tertunda,
      mulai: bukaPeserta.mulai, kumpul: bukaPeserta.kumpul,
      pindahTab: bukaPeserta.pindahTab, keluarFullscreen: bukaPeserta.keluarFullscreen,
    };
    bukaCetak(
      laporanPesertaHtml(
        info, orang,
        rincian.map((r) => ({
          nomor: r.nomor, jenis: r.jenis, pertanyaan: r.pertanyaan,
          jawabanTeks: r.jawabanTeks, benar: r.benar, poin: r.poin, bobot: r.bobot,
          catatan: r.catatan,
        })),
        terbuka.passingGrade,
      ),
      "laporan",
    );
  }

  // ---------- BAGIKAN ----------

  function alamatUjian(kode: string) {
    if (typeof window === "undefined") return `/ujian?kode=${kode}`;
    return `${window.location.origin}/ujian?kode=${kode}`;
  }

  function pesanGrup(u: Ujian) {
    return [
      `*${u.title}*`,
      `${u.courseName}${u.className ? ` · Kelas ${u.className}` : ""}`,
      "",
      `Tautan ujian : ${alamatUjian(u.code)}`,
      `Kode ujian   : ${u.code}`,
      ...(u.token ? [`Kode pengawas: ${u.token}`] : []),
      "",
      `Jumlah soal  : ${u.questionCount || u.jumlahBank}`,
      `Waktu        : ${u.durationMinutes} menit`,
      ...(u.startAt ? [`Dibuka       : ${jamRapi(u.startAt)}`] : []),
      ...(u.endAt ? [`Ditutup      : ${jamRapi(u.endAt)}`] : []),
      "",
      "Tidak perlu membuat akun. Buka tautannya, isi nama dan NIM, lalu mulai.",
      "Lama pengerjaannya tertulis di layar sebelum tombol Mulai Ujian ditekan.",
      "",
      KREDIT_CBT,
    ].join("\n");
  }

  function salin(teks: string, penanda: string) {
    navigator.clipboard
      ?.writeText(teks)
      .then(() => {
        setTersalin(penanda);
        window.setTimeout(() => setTersalin(""), 2200);
      })
      .catch(() => setGalat("Penyalinan gagal. Salin manual dari kotaknya."));
  }

  function unduhNilai() {
    if (!terbuka || peserta.length === 0) return;
    const baris = [
      ["NIM", "Nama", "Nilai", "Benar", "Status", "Mulai", "Kumpul"].join(","),
      ...peserta.map((p) =>
        [
          p.nim,
          `"${p.nama.replace(/"/g, '""')}"`,
          p.nilai ?? "",
          p.terjawab,
          p.status,
          jamRapi(p.mulai),
          jamRapi(p.kumpul),
        ].join(","),
      ),
    ].join("\n");
    // BOM di depan supaya Excel membaca huruf beraksen dengan benar.
    const berkas = new Blob([`﻿${baris}`], { type: "text/csv;charset=utf-8" });
    const alamat = URL.createObjectURL(berkas);
    const tautan = document.createElement("a");
    tautan.href = alamat;
    tautan.download = `nilai-${terbuka.code}.csv`;
    tautan.click();
    URL.revokeObjectURL(alamat);
    kabari("csv", "oke", "✓ CSV terunduh", 3400);
  }

  // ---------- DAFTAR UJIAN ----------
  if (buka === null) {
    return (
      <section>
        <p className="section-eyebrow">{pemantau ? "DOSEN & ADMIN" : "DOSEN"}</p>
        <h2 className="dsh-title">Ujian Online (CBT)</h2>

        {pesan && <div className="dsh-ok">{pesan}</div>}
        {galat && <div className="dsh-error">{galat}</div>}

        <div className="panel cbt-kepala">
          <div>
            <b>Mahasiswa tidak perlu akun</b>
            <span>
              Mereka cukup membuka <code>/ujian</code>, memasukkan kode ujian, nama, dan NIM.
              {" Ujian baru terbuka setelah dosen pemiliknya mengaktifkan dan jam mulainya tiba."}
              {pemantau
                ? " Anda memantau seluruh ujian dan dapat menghapusnya, tetapi aktivasi ujian milik dosen lain bukan di tangan Anda. Buat ujian sendiri bila perlu mengadakan seleksi."
                : ""}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setBuatBaru((b) => !b)}>
            {buatBaru ? "Tutup" : "+ Buat ujian"}
          </button>
        </div>

        {buatBaru && (
          <div className="panel cbt-form">
            <div className="cbt-baris">
              <label><span>Nama ujian *</span>
                <input value={draf.title} onChange={(e) => setDraf({ ...draf, title: e.target.value })} placeholder="UTS Komunikasi Politik" />
              </label>
              <label><span>Mata kuliah *</span>
                <input value={draf.courseName} onChange={(e) => setDraf({ ...draf, courseName: e.target.value })} placeholder="Komunikasi Politik" />
              </label>
              <label><span>Kelas</span>
                <input value={draf.className} onChange={(e) => setDraf({ ...draf, className: e.target.value })} placeholder="A / Reguler" />
              </label>
            </div>

            {/* Dua angka inilah yang ditentukan dosen, dan blueprint-nya
                menyebutnya khusus: berapa soal, dan berapa lama. */}
            <div className="cbt-baris">
              <label><span>Jumlah soal yang dikerjakan</span>
                <input type="number" min={1} max={500} value={draf.questionCount} onChange={(e) => setDraf({ ...draf, questionCount: Number(e.target.value) })} />
              </label>
              <label><span>Durasi (menit)</span>
                <input type="number" min={1} max={600} value={draf.durationMinutes} onChange={(e) => setDraf({ ...draf, durationMinutes: Number(e.target.value) })} />
              </label>
              <label><span>Nilai minimal lulus</span>
                <input type="number" min={0} max={100} value={draf.passingGrade} onChange={(e) => setDraf({ ...draf, passingGrade: Number(e.target.value) })} />
              </label>
              <label><span>Kode tambahan (opsional)</span>
                <input value={draf.token} onChange={(e) => setDraf({ ...draf, token: e.target.value.toUpperCase() })} placeholder="Dibacakan pengawas" />
              </label>
            </div>

            <label className="cbt-lebar"><span>Instruksi untuk mahasiswa</span>
              <textarea rows={3} value={draf.instruction} onChange={(e) => setDraf({ ...draf, instruction: e.target.value })} placeholder="Kerjakan sendiri. Tidak boleh membuka catatan." />
            </label>

            <DaftarSetelan nilai={draf} ubah={(kunci, nyala) => setDraf({ ...draf, [kunci]: nyala })} />
            <p className="cbt-catatan">
              Seluruh setelan ini masih dapat diubah sesudah ujiannya jadi, lewat
              <b> ⚙ Pengaturan ujian</b> di dalam ujiannya.
            </p>

            <Tbl kabar={aksi.buat} diam="Simpan ujian" onClick={() => void buatUjian()} />
          </div>
        )}

        {muat ? (
          <div className="dempty">Memuat ujian…</div>
        ) : ujian.length === 0 ? (
          <div className="dempty">Belum ada ujian. Tekan &ldquo;Buat ujian&rdquo; untuk memulai.</div>
        ) : (
          <div className="cbt-daftar">
            {ujian.map((u) => (
              <button type="button" key={u.id} className="cbt-kartu" onClick={() => bukaUjian(u)}>
                <div className="cbt-kartu-atas">
                  <span className={`pill cbt-${u.status}`}>{STATUS_LABEL[u.status]}</span>
                  <code>{u.code}</code>
                </div>
                {!u.milik && <span className="cbt-punya-lain">Milik {u.createdBy} · Anda memantau</span>}
                <b>{u.title}</b>
                <span className="cbt-mk">{u.courseName}{u.className ? ` · ${u.className}` : ""}</span>
                <div className="cbt-angka">
                  <span><b>{u.questionCount || u.jumlahBank}</b> soal</span>
                  <span><b>{u.durationMinutes}</b> menit</span>
                  <span><b>{u.peserta.total}</b> peserta</span>
                  {u.peserta.berjalan > 0 && <span className="cbt-hidup"><b>{u.peserta.berjalan}</b> mengerjakan</span>}
                </div>
                {u.startAt && <small className="cbt-jadwal">{jamRapi(u.startAt)} → {jamRapi(u.endAt)}</small>}
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (!terbuka) return <div className="dempty">Ujian tidak ditemukan.</div>;

  // ---------- SATU UJIAN ----------
  // Dua sebab soal tidak boleh diubah, dan keduanya menutup tombol yang sama:
  // ujiannya sedang berlangsung, atau ini bukan ujian Anda.
  const sedangBerlangsung = terbuka.status === "berlangsung";
  const terkunci = sedangBerlangsung || !terbuka.bolehUbah;

  // Setelan yang isinya berbeda dari yang tersimpan di server. Dipakai dua
  // kali: menyebut jumlahnya pada kepala panel yang terlipat — supaya
  // perubahan yang belum disimpan tidak hilang di balik lipatan — dan menahan
  // pengiriman yang tidak mengubah apa pun.
  const setelanAsli = setelanUjian(terbuka);
  const setelanBerubah = (Object.keys(setelanAsli) as Array<keyof typeof setelanAsli>).filter(
    (k) => setel[k] !== setelanAsli[k],
  );

  return (
    <section>
      <button type="button" className="text-action" onClick={() => { setBuka(null); void muatUjian(); }}>
        ← Semua ujian
      </button>
      <h2 className="dsh-title cbt-judul">{terbuka.title}</h2>
      <p className="cbt-sub">
        {terbuka.courseName}{terbuka.className ? ` · ${terbuka.className}` : ""} ·
        kode ujian <code>{terbuka.code}</code>
      </p>

      {pesan && <div className="dsh-ok">{pesan}</div>}
      {galat && <div className="dsh-error">{galat}</div>}

      {/* ---------- BAGIKAN KE MAHASISWA ---------- */}
      {soal.length > 0 && (
        <div className="panel cbt-bagi">
          <div className="cbt-bagi-kepala">
            <b>Bagikan ke mahasiswa</b>
            <span>
              Tempel salah satu ke grup kelas. Mahasiswa tidak perlu membuat akun.
              {!terbuka.activatedAt && " Ujian baru dapat dimasuki setelah diaktifkan dan jam mulainya tiba."}
            </span>
          </div>

          <div className="cbt-bagi-baris">
            <div className="cbt-bagi-kotak">
              <small>Tautan ujian</small>
              <code>{alamatUjian(terbuka.code)}</code>
            </div>
            <button type="button" className="btn btn-light btn-mini" onClick={() => salin(alamatUjian(terbuka.code), "tautan")}>
              {tersalin === "tautan" ? "Tersalin ✓" : "Salin tautan"}
            </button>
          </div>

          <div className="cbt-bagi-baris">
            <div className="cbt-bagi-kotak cbt-bagi-kode">
              <small>Kode ujian</small>
              <code>{terbuka.code}</code>
            </div>
            {terbuka.token && (
              <div className="cbt-bagi-kotak cbt-bagi-kode">
                <small>Kode pengawas</small>
                <code>{terbuka.token}</code>
              </div>
            )}
            <button type="button" className="btn btn-light btn-mini" onClick={() => salin(terbuka.code, "kode")}>
              {tersalin === "kode" ? "Tersalin ✓" : "Salin kode"}
            </button>
          </div>

          {/* Satu tombol yang menyalin pesan siap tempel. Menyalin tautan lalu
              mengetik sendiri jam dan jumlah soalnya di grup adalah pekerjaan
              yang paling sering salah ketik. */}
          <button type="button" className="btn btn-primary cbt-bagi-pesan" onClick={() => salin(pesanGrup(terbuka), "pesan")}>
            {tersalin === "pesan" ? "Pesan tersalin ✓" : "📋 Salin pesan siap tempel untuk grup"}
          </button>
          <pre className="cbt-bagi-pratinjau">{pesanGrup(terbuka)}</pre>
        </div>
      )}

      {/* ---------- CETAK NASKAH SOAL (CADANGAN) ----------
          Terlipat sampai diminta. Isinya panjang dan hanya dipakai sekali,
          menjelang ujian; dibiarkan terbuka ia mendorong bank soal jauh ke
          bawah setiap kali panel ini dibuka. */}
      {soal.length > 0 && (
        <div className="panel cbt-cetak">
          <button type="button" className="cbt-lipat" aria-expanded={lipatCetak} onClick={() => setLipatCetak(!lipatCetak)}>
            <b>🖨 Cetak naskah soal</b>
            <span>{lipatCetak ? "▲ Sembunyikan" : "▼ Tampilkan"}</span>
          </button>
          {lipatCetak && (
            <div className="cbt-lipat-isi">
              <p className="cbt-catatan">
                Cadangan tercetak untuk keadaan darurat: listrik padam, jaringan mati, atau
                laboratorium tidak dapat dipakai. Tekan Cetak pada jendela yang terbuka, lalu pilih
                <b> Simpan sebagai PDF</b> bila ingin berkasnya saja.
              </p>
              <div className="cbt-impor-tombol">
                <Tbl kabar={aksi.naskah} diam="Naskah untuk mahasiswa" onClick={() => cetakNaskah(false)} />
                <Tbl
                  kabar={aksi["naskah-kunci"]}
                  dasar="btn btn-light"
                  diam="Naskah + kunci (pengawas)"
                  onClick={() => cetakNaskah(true)}
                />
              </div>
              <p className="cbt-catatan">
                Naskah untuk mahasiswa TIDAK memuat kunci jawaban, pembahasan, maupun rambu penilaian
                essay, dan sudah termasuk lembar identitas serta ruang menulis. Soal yang memakai
                gambar atau video ditandai, karena medianya tidak dapat ikut tercetak.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---------- GERBANG AKTIVASI ---------- */}
      <div className="panel cbt-aktivasi" data-aktif={terbuka.activatedAt ? "1" : undefined}>
        <div className="cbt-aktivasi-kepala">
          <div>
            <b>{terbuka.activatedAt ? "Ujian sudah diaktifkan" : "Belum diaktifkan"}</b>
            <span>
              {terbuka.activatedAt
                ? `Dibuka sendiri ${jamRapi(terbuka.startAt)} sampai ${jamRapi(terbuka.endAt)}. Diaktifkan oleh ${terbuka.activatedBy ?? "-"}.`
                : terbuka.bolehUbah
                  ? "Setel jam mulai dan jam selesai, lalu aktifkan. Pada jam mulainya ujian terbuka sendiri, tidak ada tombol yang perlu ditekan lagi."
                  : `Ujian ini milik ${terbuka.createdBy}. Hanya dosen pemiliknya yang dapat menjadwalkan dan mengaktifkannya.`}
            </span>
          </div>
          <span className={`pill cbt-${terbuka.status}`}>{STATUS_LABEL[terbuka.status]}</span>
        </div>

        {terbuka.bolehUbah ? (
          <div className="cbt-baris cbt-jadwal-form">
            <label><span>Jam mulai</span>
              <input type="datetime-local" value={jadwal.mulai} onChange={(e) => setJadwal({ ...jadwal, mulai: e.target.value })} />
            </label>
            <label><span>Jam selesai</span>
              <input type="datetime-local" value={jadwal.selesai} onChange={(e) => setJadwal({ ...jadwal, selesai: e.target.value })} />
            </label>
            <div className="cbt-jadwal-aksi">
              <Tbl
                kabar={aksi.aktif}
                diam={terbuka.activatedAt ? "Perbarui jadwal" : "Aktifkan ujian"}
                onClick={() => void aktifkan()}
              />
              {terbuka.activatedAt && (
                <Tbl
                  kabar={aksi["batal-aktif"]}
                  dasar="btn btn-danger btn-mini"
                  diam="Batalkan"
                  onClick={() => void batalkanAktivasi()}
                />
              )}
            </div>
          </div>
        ) : (
          <p className="cbt-catatan">
            Jadwal dan aktivasi ujian ini dipegang dosen pemiliknya. Anda dapat memantau peserta dan
            nilainya di tab sebelah{terbuka.bolehHapus ? ", dan menghapus ujian ini bila memang perlu" : ""}.
            Untuk ujian seleksi, buatlah ujian sendiri: ujian yang Anda buat menjadi milik Anda,
            beserta tombol aktivasinya.
          </p>
        )}

        {terbuka.bolehHapus && (
          <div className="cbt-hapus-ujian">
            <Tbl
              kabar={aksi["hapus-ujian"]}
              dasar="btn btn-danger btn-mini"
              diam="Hapus ujian ini"
              onClick={() => void hapusUjian()}
            />
            <span>Soal dan seluruh hasilnya ikut terhapus. Tidak dapat dibatalkan.</span>
          </div>
        )}
      </div>

      {/* ---------- PENGATURAN UJIAN ----------
          Dulu setelan hanya dapat ditentukan sekali, pada formulir pembuatan,
          dan sesudah itu tidak ada layar mana pun yang dapat mengubahnya. Yang
          paling mahal justru terjadi saat ujian berjalan: satu mahasiswa
          terblokir karena ponselnya sudah dipakai temannya, dan centang "satu
          perangkat" tidak dapat dilepas sampai ujiannya usai — artinya orang
          itu tidak ikut ujian sama sekali. Sekarang panel ini terbuka
          sewaktu-waktu; yang tetap dikunci selama ujian berlangsung hanya
          setelan yang mengubah BENTUK ujiannya. */}
      {terbuka.bolehUbah && (
        <div className="panel cbt-setel">
          <button
            type="button"
            className="cbt-lipat"
            aria-expanded={bukaSetel}
            onClick={() => setBukaSetel(!bukaSetel)}
          >
            <b>⚙ Pengaturan ujian</b>
            <span>
              {setelanBerubah.length > 0 && (
                <i className="cbt-setel-tanda">{setelanBerubah.length} belum disimpan</i>
              )}
              {bukaSetel ? "▲ Sembunyikan" : "▼ Ubah setelan"}
            </span>
          </button>

          {bukaSetel && (
            <div className="cbt-lipat-isi">
              <p className="cbt-catatan">
                Boleh diubah sewaktu-waktu, termasuk saat keadaan mendesak.
                {sedangBerlangsung
                  ? " Ujian ini SEDANG BERLANGSUNG, jadi jumlah soal, durasi, dan dua pengacakan dikunci dulu — mengubahnya di tengah jalan membuat sebagian peserta mengerjakan ujian yang berbeda dari sebagian yang lain. Selebihnya, termasuk “satu perangkat”, tetap dapat diubah sekarang juga."
                  : " Perubahan berlaku untuk peserta yang masuk sesudah disimpan."}
              </p>

              <div className="cbt-baris">
                <label><span>Nama ujian *</span>
                  <input value={setel.title} onChange={(e) => setSetel({ ...setel, title: e.target.value })} />
                </label>
                <label><span>Mata kuliah *</span>
                  <input value={setel.courseName} onChange={(e) => setSetel({ ...setel, courseName: e.target.value })} />
                </label>
                <label><span>Kelas</span>
                  <input value={setel.className} onChange={(e) => setSetel({ ...setel, className: e.target.value })} placeholder="A / Reguler" />
                </label>
              </div>

              <div className="cbt-baris">
                <label className={sedangBerlangsung ? "mati" : ""}>
                  <span>Jumlah soal yang dikerjakan{sedangBerlangsung ? " · terkunci" : ""}</span>
                  <input
                    type="number" min={1} max={500} value={setel.questionCount} disabled={sedangBerlangsung}
                    onChange={(e) => setSetel({ ...setel, questionCount: Number(e.target.value) })}
                  />
                </label>
                <label className={sedangBerlangsung ? "mati" : ""}>
                  <span>Durasi (menit){sedangBerlangsung ? " · terkunci" : ""}</span>
                  <input
                    type="number" min={1} max={600} value={setel.durationMinutes} disabled={sedangBerlangsung}
                    onChange={(e) => setSetel({ ...setel, durationMinutes: Number(e.target.value) })}
                  />
                </label>
                <label><span>Nilai minimal lulus</span>
                  <input
                    type="number" min={0} max={100} value={setel.passingGrade}
                    onChange={(e) => setSetel({ ...setel, passingGrade: Number(e.target.value) })}
                  />
                </label>
                <label><span>Kode pengawas (opsional)</span>
                  <input
                    value={setel.token}
                    onChange={(e) => setSetel({ ...setel, token: e.target.value.toUpperCase() })}
                    placeholder="Dibacakan pengawas"
                  />
                </label>
              </div>

              <label className="cbt-lebar"><span>Instruksi untuk mahasiswa</span>
                <textarea
                  rows={3} value={setel.instruction}
                  onChange={(e) => setSetel({ ...setel, instruction: e.target.value })}
                  placeholder="Kerjakan sendiri. Tidak boleh membuka catatan."
                />
              </label>

              <DaftarSetelan
                nilai={setel}
                kunciBentuk={sedangBerlangsung}
                ubah={(kunci, nyala) => setSetel({ ...setel, [kunci]: nyala })}
              />

              <div className="cbt-form-aksi">
                <Tbl
                  kabar={aksi.setel}
                  diam={
                    setelanBerubah.length > 0
                      ? `Simpan ${setelanBerubah.length} perubahan`
                      : "Simpan pengaturan"
                  }
                  onClick={() => void simpanSetelan()}
                />
                {setelanBerubah.length > 0 && (
                  <button type="button" className="btn btn-light" onClick={() => setSetel(setelanUjian(terbuka))}>
                    Kembalikan seperti semula
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="cbt-tab">
        <button type="button" className={tab === "soal" ? "on" : ""} onClick={() => setTab("soal")}>
          Bank soal ({soal.length})
        </button>
        <button type="button" className={tab === "pantau" ? "on" : ""} onClick={() => { setTab("pantau"); void muatHasil(terbuka.id); }}>
          Monitoring & nilai ({peserta.length})
        </button>
      </div>

      {tab === "soal" ? (
        <>
          {sedangBerlangsung && (
            <div className="dsh-error">
              Ujian sedang berlangsung. Soal dikunci sampai selesai, mengubahnya sekarang berarti
              sebagian mahasiswa mengerjakan ujian yang berbeda dari sebagian yang lain.
            </div>
          )}
          {!terbuka.bolehUbah && !sedangBerlangsung && (
            <div className="dsh-note">
              Bank soal ini milik <b>{terbuka.createdBy}</b> dan hanya dapat dibaca dari sini.
              Menyunting soal kelas dosen lain bukan wewenang yang ada pada peran Anda.
            </div>
          )}

          {/* ---------- BUAT SOAL DENGAN AI (DIPADAMKAN) ---------- */}
          {AI_SOAL_TAMPIL && (
          <div className="panel cbt-ai">
            <div className="cbt-impor-kepala">
              <b>✨ Buat soal dengan AI</b>
              <span>
                Unggah bahan ajar (Word, PowerPoint, atau PDF) lalu biarkan soalnya disusun dari
                isi dokumen itu. Dokumennya dibaca di komputer Anda sendiri; yang dikirim ke server
                hanya teksnya. Soal yang keluar TIDAK langsung masuk bank: Anda memeriksanya dulu.
              </span>
            </div>

            {aiSiap === false ? (
              <p className="cbt-catatan">
                Pembuat soal AI belum tersambung ke model mana pun. Pasang <code>ANTHROPIC_API_KEY</code>
                {" "}(Claude) atau <code>GEMINI_API_KEY</code> pada environment Vercel, lalu deploy ulang.
                Menu lain tetap berjalan tanpa itu.
              </p>
            ) : (
              <>
                <div className="cbt-impor-tombol">
                  <label className={`btn btn-primary cbt-unggah ${terkunci || aiSibuk ? "mati" : ""}`}>
                    {aiSibuk && !sari ? "Membaca…" : "⇧ Unggah bahan (.docx / .pptx / .pdf)"}
                    <input
                      type="file"
                      accept=".docx,.pptx,.pdf"
                      disabled={terkunci || aiSibuk}
                      onChange={(e) => {
                        const berkas = e.target.files?.[0];
                        e.target.value = "";
                        if (berkas) void bacaBahanAi(berkas);
                      }}
                    />
                  </label>
                  {sariNama && <span className="cbt-impor-nama">{sariNama}</span>}
                  {aiPenyedia.length > 0 && (
                    <span className="cbt-impor-nama">
                      model: {aiPenyedia.includes("claude") ? "Claude" : "Gemini"}
                    </span>
                  )}
                </div>

                {aiKabar && <p className="cbt-ai-kabar">{aiKabar}</p>}

                {sari && (
                  <>
                    <div className="cbt-baris cbt-ai-atur">
                      <label><span>Jumlah soal</span>
                        <input
                          type="number" min={1} max={MAKS_SOAL} value={aiAtur.jumlah}
                          onChange={(e) => setAiAtur({ ...aiAtur, jumlah: Number(e.target.value) })}
                        />
                      </label>
                      <label><span>Tingkat kesulitan</span>
                        <select
                          value={aiAtur.tingkat}
                          onChange={(e) => setAiAtur({ ...aiAtur, tingkat: e.target.value as typeof aiAtur.tingkat })}
                        >
                          <option value="campuran">Campuran (30% mudah, 50% sedang, 20% sulit)</option>
                          <option value="mudah">Mudah semua</option>
                          <option value="sedang">Sedang semua</option>
                          <option value="sulit">Sulit semua</option>
                        </select>
                      </label>
                    </div>

                    <div className="cbt-ai-jenis">
                      <span className="cbt-opsi-judul">Jenis soal yang dibuat</span>
                      <div className="cbt-sakelar">
                        {JENIS_AI.map((j) => (
                          <label key={j} className="cbt-cek">
                            <input
                              type="checkbox"
                              checked={aiAtur.jenis.includes(j)}
                              onChange={(e) =>
                                setAiAtur({
                                  ...aiAtur,
                                  jenis: e.target.checked
                                    ? [...aiAtur.jenis, j]
                                    // Minimal satu jenis harus tersisa; tanpa itu
                                    // permintaannya kosong dan model menebak sendiri.
                                    : aiAtur.jenis.length > 1
                                      ? aiAtur.jenis.filter((x) => x !== j)
                                      : aiAtur.jenis,
                                })
                              }
                            />
                            <span>{JENIS_LABEL[j]}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <label className="cbt-lebar"><span>Arahan tambahan (opsional)</span>
                      <textarea
                        rows={2} value={aiAtur.arahan}
                        onChange={(e) => setAiAtur({ ...aiAtur, arahan: e.target.value })}
                        placeholder="Mis. fokus pada bab 2 dan 3; hindari soal hafalan tahun."
                      />
                    </label>

                    <div className="cbt-impor-aksi">
                      <button
                        type="button" className="btn btn-primary"
                        disabled={aiSibuk || terkunci}
                        onClick={() => void buatSoalAi()}
                      >
                        {aiSibuk ? "Menyusun soal… (bisa satu menit)" : `✨ Buat ${aiAtur.jumlah} soal`}
                      </button>
                      <button type="button" className="btn btn-light" onClick={() => {
                        setSari(null); setSariNama(""); setAiKabar("");
                      }}>
                        Ganti bahan
                      </button>
                    </div>
                    <p className="cbt-catatan">
                      Soal buatan mesin tetap perlu dibaca dosennya. Yang paling sering keliru bukan
                      tata bahasanya, melainkan kunci jawaban pada soal yang tampak benar.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
          )}

          {/* ---------- IMPOR MASSAL ---------- */}
          <div className="panel cbt-impor">
            <div className="cbt-impor-kepala">
              <b>Buat soal lewat Excel atau Word</b>
              <span>
                Unduh templatenya, isi di komputer sendiri, lalu unggah sekali untuk seluruh soal.
                Empat puluh soal lewat formulir satuan berarti empat puluh kali mengisi dan menunggu.
              </span>
            </div>

            <div className="cbt-impor-tombol">
              <Tbl kabar={aksi["tpl-xlsx"]} dasar="btn btn-light" diam="⇩ Template Excel (.xlsx)" onClick={() => unduhTemplateExcel()} />
              <Tbl kabar={aksi["tpl-docx"]} dasar="btn btn-light" diam="⇩ Template Word (.docx)" onClick={() => unduhTemplateWord()} />
              <label className={`btn btn-primary cbt-unggah ${terkunci ? "mati" : ""}`}>
                ⇧ Unggah soal
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.docx"
                  disabled={terkunci}
                  onChange={(e) => {
                    const berkas = e.target.files?.[0];
                    e.target.value = "";
                    if (berkas) void bacaBerkasSoal(berkas);
                  }}
                />
              </label>
            </div>

            {(imporSoal.length > 0 || imporTolak.length > 0) && (
              <div className="cbt-impor-hasil">
                <div className="cbt-impor-angka">
                  <span className="cbt-impor-ok"><b>{imporSoal.length}</b> soal terbaca</span>
                  {imporTolak.length > 0 && (
                    <span className="cbt-impor-gagal"><b>{imporTolak.length}</b> baris perlu diperbaiki</span>
                  )}
                  {imporNama && <span className="cbt-impor-nama">{imporNama}</span>}
                </div>

                {imporTolak.length > 0 && (
                  <ul className="cbt-impor-tolak">
                    {imporTolak.slice(0, 8).map((t, i) => (
                      <li key={i}><b>{t.baris}</b>: {t.alasan}</li>
                    ))}
                    {imporTolak.length > 8 && <li>…dan {imporTolak.length - 8} lagi.</li>}
                  </ul>
                )}

                {imporSoal.length > 0 && (
                  <>
                    <ol className="cbt-impor-pratinjau">
                      {imporSoal.slice(0, 5).map((q, i) => (
                        <li key={i}>
                          <span className={`pill cbt-t-${q.tingkat}`}>{JENIS_LABEL[q.jenis]} · {q.bobot} poin</span>
                          <p>{q.pertanyaan.slice(0, 110)}{q.pertanyaan.length > 110 ? "…" : ""}</p>
                          {q.pilihan.length > 0 && (
                            <small>Kunci: {String.fromCharCode(65 + Number(q.kunci))}. {q.pilihan[Number(q.kunci)]}</small>
                          )}
                          {q.jenis === "isian" && <small>Kunci: {q.kunci}</small>}
                        </li>
                      ))}
                      {imporSoal.length > 5 && <li className="cbt-impor-sisa">…dan {imporSoal.length - 5} soal lagi.</li>}
                    </ol>
                    <div className="cbt-impor-aksi">
                      <Tbl
                        kabar={aksi.impor}
                        diam={`Masukkan ${imporSoal.length} soal ke bank`}
                        mati={terkunci}
                        onClick={() => void terbitkanImpor()}
                      />
                      <button type="button" className="btn btn-light" onClick={() => { setImporSoal([]); setImporTolak([]); setImporNama(""); }}>
                        Batal
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="panel cbt-form">
            <b className="cbt-form-judul">{sunting ? "Ubah soal" : "Tambah soal satu per satu"}</b>

            <div className="cbt-baris">
              <label><span>Jenis</span>
                <select value={soalBaru.jenis} onChange={(e) => {
                  const jenis = e.target.value as JenisSoal;
                  setSoalBaru((s) => ({ ...s, jenis, ...bentukJenis(jenis) }));
                }}>
                  {SEMUA_JENIS.map((j) => (
                    <option key={j} value={j}>{JENIS_LABEL[j]}</option>
                  ))}
                </select>
              </label>
              <label><span>Bobot nilai</span>
                <input type="number" min={1} max={100} value={soalBaru.bobot} onChange={(e) => setSoalBaru({ ...soalBaru, bobot: Number(e.target.value) })} />
              </label>
            </div>

            <label className="cbt-lebar"><span>Pertanyaan *</span>
              <textarea rows={3} value={soalBaru.pertanyaan} onChange={(e) => setSoalBaru({ ...soalBaru, pertanyaan: e.target.value })} />
            </label>

            {/* ---------- MEDIA: GAMBAR ATAU VIDEO ----------
                Terlipat sampai diminta. Sebagian besar soal tidak bergambar,
                dan bagian ini berdiri persis di antara pertanyaan dan pilihan
                jawaban: dua isian yang justru selalu dipakai. */}
            <div className="cbt-media-edit">
              <button type="button" className="cbt-lipat" aria-expanded={bukaMedia} onClick={() => setBukaMedia(!bukaMedia)}>
                <b>Media soal (opsional)</b>
                <span>
                  {soalBaru.media.jenis && soalBaru.media.url
                    ? bukaMedia ? "▲ Sembunyikan" : "▼ Terpasang, tampilkan"
                    : bukaMedia ? "▲ Sembunyikan" : "▼ Tampilkan"}
                </span>
              </button>
              {bukaMedia && (
              <div className="cbt-media-baris">
                <select
                  value={soalBaru.media.jenis}
                  onChange={(e) =>
                    setSoalBaru({ ...soalBaru, media: { ...soalBaru.media, jenis: e.target.value as Media["jenis"] } })
                  }
                >
                  <option value="">Tanpa media</option>
                  <option value="gambar">Gambar</option>
                  <option value="video">Video</option>
                </select>
                <input
                  value={soalBaru.media.url}
                  onChange={(e) => setSoalBaru({ ...soalBaru, media: { ...soalBaru.media, url: e.target.value } })}
                  placeholder="Tempel tautan gambar / YouTube / Drive, atau unggah berkas →"
                />
                <label
                  className={`btn btn-light btn-mini cbt-unggah ${terkunci || berjalan("media") ? "mati" : ""} ${
                    aksi.media?.keadaan === "oke" ? "btn-oke" : aksi.media?.keadaan === "gagal" ? "btn-gagal" : ""
                  }`}
                >
                  {aksi.media ? aksi.media.teks : "⇧ Unggah"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"
                    disabled={terkunci || berjalan("media")}
                    onChange={(e) => {
                      const berkas = e.target.files?.[0];
                      e.target.value = "";
                      if (berkas) void unggahMedia(berkas);
                    }}
                  />
                </label>
              </div>
              )}
              {bukaMedia && soalBaru.media.jenis && (
                <input
                  className="cbt-media-ket-edit"
                  value={soalBaru.media.keterangan}
                  onChange={(e) => setSoalBaru({ ...soalBaru, media: { ...soalBaru.media, keterangan: e.target.value } })}
                  placeholder="Keterangan gambar/video (opsional)"
                />
              )}
              {bukaMedia && (
                <p className="cbt-catatan">
                  Gambar maksimal 5 MB, video 50 MB. Video panjang lebih baik ditempel sebagai tautan
                  YouTube atau Google Drive, sebab tautan sematan tidak punya batas ukuran dan tidak
                  memakan kuota penyimpanan.
                </p>
              )}
            </div>

            {(soalBaru.jenis === "pg" || soalBaru.jenis === "pg_kompleks" ||
              soalBaru.jenis === "benar_salah" || soalBaru.jenis === "penjodohan") && (
              <div className="cbt-opsi-edit">
                <span className="cbt-opsi-judul">
                  {soalBaru.jenis === "penjodohan"
                    ? "Kolom jawaban (kanan), boleh diberi pengecoh yang tidak berpasangan"
                    : soalBaru.jenis === "pg_kompleks"
                      ? "Pilihan jawaban: tandai SEMUA yang benar, sisakan minimal satu pengecoh"
                      : "Pilihan jawaban: tekan lingkarannya untuk menandai kunci"}
                </span>
                {soalBaru.pilihan.map((p, i) => (
                  <div key={i} className="cbt-opsi-baris">
                    {soalBaru.jenis === "penjodohan" ? (
                      <span className="cbt-kunci cbt-kunci-mati">{String.fromCharCode(65 + i)}</span>
                    ) : (
                      <button
                        type="button"
                        className={`cbt-kunci ${
                          soalBaru.jenis === "pg_kompleks"
                            ? uraiKunciJamak(soalBaru.kunci).has(i) ? "on" : ""
                            : soalBaru.kunci === String(i) ? "on" : ""
                        }`}
                        onClick={() =>
                          soalBaru.jenis === "pg_kompleks"
                            ? tandaiKunciJamak(i)
                            : setSoalBaru({ ...soalBaru, kunci: String(i) })
                        }
                        title="Tandai sebagai kunci jawaban"
                      >
                        {String.fromCharCode(65 + i)}
                      </button>
                    )}
                    <input
                      value={p}
                      onChange={(e) => {
                        const berikut = [...soalBaru.pilihan];
                        berikut[i] = e.target.value;
                        setSoalBaru({ ...soalBaru, pilihan: berikut });
                      }}
                      placeholder={`Pilihan ${String.fromCharCode(65 + i)}`}
                    />
                    {soalBaru.jenis !== "benar_salah" && soalBaru.pilihan.length > 2 && (
                      <button type="button" className="cbt-buang" onClick={() => {
                        const berikut = soalBaru.pilihan.filter((_, n) => n !== i);
                        // Kunci dan pasangan ikut disetel ulang: keduanya
                        // menunjuk pilihan LEWAT NOMOR, dan menghapus satu
                        // pilihan menggeser seluruh nomor di bawahnya.
                        setSoalBaru({
                          ...soalBaru,
                          pilihan: berikut,
                          kunci: soalBaru.jenis === "pg_kompleks" ? "" : "0",
                          pasangan: soalBaru.pasangan.map((x) => ({
                            ...x,
                            kanan: x.kanan >= berikut.length ? 0 : x.kanan,
                          })),
                        });
                      }}>✕</button>
                    )}
                  </div>
                ))}
                {soalBaru.jenis !== "benar_salah" && soalBaru.pilihan.length < 8 && (
                  <button type="button" className="btn btn-light btn-mini" onClick={() => setSoalBaru({ ...soalBaru, pilihan: [...soalBaru.pilihan, ""] })}>
                    + Tambah pilihan
                  </button>
                )}
              </div>
            )}

            {/* ---------- PASANGAN PENJODOHAN ---------- */}
            {soalBaru.jenis === "penjodohan" && (
              <div className="cbt-opsi-edit">
                <span className="cbt-opsi-judul">Pasangan: kolom kiri dan jawaban yang benar</span>
                {soalBaru.pasangan.map((pas, i) => (
                  <div key={i} className="cbt-jodoh-edit">
                    <span className="cbt-jodoh-no">{i + 1}</span>
                    <input
                      value={pas.kiri}
                      onChange={(e) => {
                        const berikut = [...soalBaru.pasangan];
                        berikut[i] = { ...berikut[i], kiri: e.target.value };
                        setSoalBaru({ ...soalBaru, pasangan: berikut });
                      }}
                      placeholder={`Pertanyaan baris ${i + 1}`}
                    />
                    <select
                      value={String(pas.kanan)}
                      onChange={(e) => {
                        const berikut = [...soalBaru.pasangan];
                        berikut[i] = { ...berikut[i], kanan: Number(e.target.value) };
                        setSoalBaru({ ...soalBaru, pasangan: berikut });
                      }}
                    >
                      {soalBaru.pilihan.map((opsi, n) => (
                        <option key={n} value={String(n)}>
                          {String.fromCharCode(65 + n)}. {opsi.slice(0, 40) || "(kosong)"}
                        </option>
                      ))}
                    </select>
                    {soalBaru.pasangan.length > 2 && (
                      <button type="button" className="cbt-buang" onClick={() =>
                        setSoalBaru({ ...soalBaru, pasangan: soalBaru.pasangan.filter((_, n) => n !== i) })
                      }>✕</button>
                    )}
                  </div>
                ))}
                {soalBaru.pasangan.length < 10 && (
                  <button type="button" className="btn btn-light btn-mini" onClick={() =>
                    setSoalBaru({ ...soalBaru, pasangan: [...soalBaru.pasangan, { kiri: "", kanan: 0 }] })
                  }>
                    + Tambah pasangan
                  </button>
                )}
              </div>
            )}

            {soalBaru.jenis === "isian" && (
              <label className="cbt-lebar"><span>Kunci jawaban: pisahkan beberapa kemungkinan dengan |</span>
                <input value={soalBaru.kunci} onChange={(e) => setSoalBaru({ ...soalBaru, kunci: e.target.value })} placeholder="komunikasi massa|mass communication" />
              </label>
            )}

            {soalBaru.jenis === "essay" && (
              <p className="cbt-catatan">Essay dikoreksi dosen di tab Monitoring &amp; nilai setelah ujian selesai.</p>
            )}

            <div className="cbt-form-aksi">
              <Tbl
                kabar={aksi.soal}
                diam={sunting ? "Simpan perubahan" : "+ Tambah ke bank soal"}
                mati={terkunci}
                onClick={() => void simpanSoal()}
              />
              {sunting && (
                <button type="button" className="btn btn-light" onClick={() => { setSunting(null); setSoalBaru({ ...SOAL_KOSONG }); }}>
                  Batal
                </button>
              )}
            </div>
          </div>

          {soal.length === 0 ? (
            <div className="dempty">Bank soal masih kosong.</div>
          ) : (
            <ol className="cbt-soal-daftar">
              {soal.map((s) => (
                <li key={s.id} className="cbt-soal-item">
                  <div className="cbt-soal-kepala">
                    <span className={`pill cbt-t-${s.tingkat}`}>{JENIS_LABEL[s.jenis]} · {s.bobot} poin</span>
                    <span className="cbt-soal-aksi">
                      <button type="button" disabled={terkunci} onClick={() => {
                        setSunting(s.id);
                        setSoalBaru({
                          ...s,
                          pilihan: s.pilihan.length ? s.pilihan : ["", ""],
                          pasangan: s.pasangan ?? [],
                          media: s.media ?? { ...MEDIA_KOSONG },
                        });
                        // Soal yang sudah bergambar dibuka lipatannya sendiri.
                        // Media yang tersembunyi di balik lipatan tertutup akan
                        // dikira tidak ada, lalu ikut terhapus tanpa disengaja.
                        if (s.media?.jenis && s.media.url) setBukaMedia(true);
                        // Formulirnya ada JAUH DI ATAS daftar ini. Tanpa kabar,
                        // yang menekan Ubah hanya melihat tombolnya berkedip
                        // dan mengira tekanannya tidak masuk.
                        kabari(`ubah-${s.id}`, "oke", "✓ Dibuka di formulir ↑", 2600);
                        setPesan("Soal dibuka pada formulir “Ubah soal” di atas daftar ini.");
                        setGalat("");
                      }}>
                        {aksi[`ubah-${s.id}`] ? aksi[`ubah-${s.id}`].teks : "Ubah"}
                      </button>
                      <button
                        type="button"
                        className={aksi[`soal-${s.id}`]?.keadaan === "gagal" ? "cbt-aksi-gagal" : ""}
                        disabled={terkunci || aksi[`soal-${s.id}`]?.keadaan === "jalan"}
                        onClick={() => void hapusSoal(s.id)}
                      >
                        {aksi[`soal-${s.id}`] ? aksi[`soal-${s.id}`].teks : "Hapus"}
                      </button>
                    </span>
                  </div>
                  <p className="cbt-soal-tanya">{s.pertanyaan}</p>
                  {s.media?.jenis && s.media.url && (
                    <p className="cbt-soal-media">
                      {s.media.jenis === "video" ? "🎬" : "🖼"} {s.media.keterangan || s.media.url}
                    </p>
                  )}
                  {s.pilihan.length > 0 && s.jenis !== "penjodohan" && (
                    <ul className="cbt-soal-opsi">
                      {s.pilihan.map((p, i) => {
                        const kunci = s.jenis === "pg_kompleks"
                          ? uraiKunciJamak(s.kunci).has(i)
                          : s.kunci === String(i);
                        return (
                          <li key={i} className={kunci ? "kunci" : ""}>
                            <b>{String.fromCharCode(65 + i)}.</b> {p}{kunci && <i> ← kunci</i>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {s.jenis === "penjodohan" && (
                    <ul className="cbt-soal-opsi">
                      {(s.pasangan || []).map((pas, i) => (
                        <li key={i} className="kunci">
                          <b>{i + 1}.</b> {pas.kiri} <i>↔ {s.pilihan[pas.kanan] ?? "-"}</i>
                        </li>
                      ))}
                      {s.pilihan.length > (s.pasangan || []).length && (
                        <li>
                          <i>
                            Pengecoh: {s.pilihan
                              .filter((_, n) => !(s.pasangan || []).some((pas) => pas.kanan === n))
                              .join(", ")}
                          </i>
                        </li>
                      )}
                    </ul>
                  )}
                  {s.jenis === "isian" && <p className="cbt-soal-kunci">Kunci: {s.kunci}</p>}
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <>
          {statistik && statistik.peserta > 0 && (
            <div className="psn-angka cbt-statistik">
              <div><b>{statistik.peserta}</b><span>selesai</span></div>
              <div><b>{statistik.rata}</b><span>rata-rata</span></div>
              <div><b>{statistik.tertinggi}</b><span>tertinggi</span></div>
              <div><b>{statistik.terendah}</b><span>terendah</span></div>
              <div><b>{statistik.persenLulus}%</b><span>lulus</span></div>
            </div>
          )}

          <div className="panel psn-panel">
            <div className="psn-kepala">
              <div>
                <b>Peserta</b>
                <span>
                  Menyegar sendiri tiap 10 detik selama tab ini terbuka.
                  {(() => {
                    const putus = peserta.filter(
                      (p) => p.status === "berjalan" && p.diamDetik !== null && p.diamDetik > AMBANG_TERPUTUS,
                    ).length;
                    return putus > 0
                      ? ` ${putus} peserta tampak terputus, layarnya tidak menyapa lebih dari semenit.`
                      : "";
                  })()}
                </span>
              </div>
              <span className="cbt-pantau-aksi">
                <Tbl
                  kabar={aksi.csv}
                  dasar="btn btn-light btn-mini"
                  diam="⇩ Unduh nilai (CSV)"
                  mati={peserta.length === 0}
                  onClick={() => void unduhNilai()}
                />
                <Tbl
                  kabar={aksi["acara-atas"]}
                  dasar="btn btn-light btn-mini"
                  diam="🖨 Berita acara"
                  mati={peserta.length === 0}
                  onClick={() => cetakBeritaAcara("acara-atas")}
                />
              </span>
            </div>

            {peserta.length === 0 ? (
              <div className="dempty">Belum ada yang masuk ke ujian ini.</div>
            ) : (
              <div className="qtable-wrap">
                <table className="qt">
                  <thead>
                    <tr><th>Mahasiswa</th><th>Status</th><th>Progres</th><th>Sisa waktu</th><th>Nilai</th><th>Catatan</th><th /></tr>
                  </thead>
                  <tbody>
                    {peserta.map((p) => (
                      <tr key={p.id} className={bukaPeserta?.id === p.id ? "cbt-baris-buka" : ""}>
                        <td><b>{p.nama}</b><small className="psn-nama">{p.nim}</small></td>
                        <td>
                          <span className={`pill cbt-p-${p.status}`}>
                            {p.status === "berjalan" ? "Mengerjakan" : p.status === "waktu_habis" ? "Waktu habis" : "Selesai"}
                          </span>
                          {p.status === "berjalan" && p.diamDetik !== null && p.diamDetik > AMBANG_TERPUTUS && (
                            <small className="cbt-putus">⚠ terputus {Math.round(p.diamDetik / 60)} menit</small>
                          )}
                        </td>
                        <td>{p.terjawab}/{terbuka.questionCount || soal.length}</td>
                        <td>
                          {p.status === "berjalan" ? (
                            <span className={p.sisaDetik <= 300 ? "cbt-genting" : ""}>{ejaWaktu(p.sisaDetik)}</span>
                          ) : (
                            <small className="psn-nama">-</small>
                          )}
                        </td>
                        <td>
                          {p.nilai === null ? "-" : <b>{p.nilai}</b>}
                          {p.tertunda > 0 && <small className="psn-nama">{p.tertunda} essay menunggu</small>}
                        </td>
                        <td>
                          {p.pindahTab > 0 || p.keluarFullscreen > 0 ? (
                            <small className="cbt-langgar">
                              {p.pindahTab > 0 && `pindah tab ${p.pindahTab}×`}
                              {p.pindahTab > 0 && p.keluarFullscreen > 0 && " · "}
                              {p.keluarFullscreen > 0 && `keluar layar penuh ${p.keluarFullscreen}×`}
                            </small>
                          ) : (
                            <small className="psn-nama">-</small>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`text-action${aksi[`lembar-${p.id}`]?.keadaan === "gagal" ? " cbt-aksi-gagal" : ""}`}
                            onClick={() => void bukaLembar(p)}
                            disabled={p.status === "berjalan" || aksi[`lembar-${p.id}`]?.keadaan === "jalan"}
                            title={p.status === "berjalan" ? "Menunggu sampai dikumpulkan" : "Buka lembar jawabannya"}
                          >
                            {aksi[`lembar-${p.id}`]
                              ? aksi[`lembar-${p.id}`].teks
                              : p.tertunda > 0 ? `Koreksi ${p.tertunda} essay` : "Lihat jawaban"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ---------- BERITA ACARA ---------- */}
          {peserta.length > 0 && (
            <div className="panel cbt-acara">
              <div className="cbt-impor-kepala">
                <b>Berita acara pelaksanaan</b>
                <span>
                  Angka kehadiran dan daftar pelanggaran diambil sendiri dari sistem. Tiga isian di
                  bawah hanya diketahui pengawasnya, jadi ia yang menuliskannya.
                </span>
              </div>
              <div className="cbt-baris">
                <label><span>Nama pengawas</span>
                  <input value={acara.pengawas} onChange={(e) => setAcara({ ...acara, pengawas: e.target.value })} placeholder="Nama lengkap pengawas" />
                </label>
                <label><span>Ruang / moda</span>
                  <input value={acara.ruang} onChange={(e) => setAcara({ ...acara, ruang: e.target.value })} placeholder="Lab Komputer 2, kosongkan bila daring" />
                </label>
              </div>
              <label className="cbt-lebar"><span>Catatan kejadian selama ujian</span>
                <textarea rows={2} value={acara.catatan} onChange={(e) => setAcara({ ...acara, catatan: e.target.value })} placeholder="Mis. listrik padam 5 menit pukul 09.20; dua mahasiswa terlambat masuk." />
              </label>
              <Tbl kabar={aksi.acara} diam="🖨 Buat berita acara" onClick={() => cetakBeritaAcara()} />
            </div>
          )}

          {/* ---------- LEMBAR JAWABAN & KOREKSI ESSAY ---------- */}
          {bukaPeserta && (
            <div className="panel psn-panel cbt-lembar">
              <div className="psn-kepala">
                <div>
                  <b>{bukaPeserta.nama}</b>
                  <span>
                    {bukaPeserta.nim} · {bukaPeserta.nilai === null ? "belum dinilai" : `nilai ${bukaPeserta.nilai}`}
                    {bukaPeserta.tertunda > 0 && ` · ${bukaPeserta.tertunda} essay menunggu koreksi`}
                  </span>
                </div>
                <span className="cbt-pantau-aksi">
                  <Tbl
                    kabar={aksi.laporan}
                    dasar="btn btn-light btn-mini"
                    diam="🖨 Cetak laporan"
                    mati={rincian.length === 0}
                    onClick={() => cetakLaporanPeserta()}
                  />
                  <button type="button" className="btn btn-light btn-mini" onClick={() => { setBukaPeserta(null); setRincian([]); }}>
                    Tutup
                  </button>
                </span>
              </div>

              {muatRincian ? (
                <div className="dempty">Memuat lembar jawaban…</div>
              ) : rincian.length === 0 ? (
                <div className="dempty">Lembar jawabannya kosong.</div>
              ) : (
                <ol className="cbt-lembar-daftar">
                  {rincian.map((r) => {
                    const belumDikoreksi = r.jenis === "essay" && r.benar === null;
                    return (
                      <li key={r.id} className={belumDikoreksi ? "cbt-perlu-koreksi" : ""}>
                        <div className="cbt-lembar-kepala">
                          <span className="cbt-lembar-nomor">Soal {r.nomor}</span>
                          <span className={`pill cbt-p-${r.benar === null ? "waktu_habis" : r.benar ? "selesai" : "berjalan"}`}>
                            {r.benar === null ? "Menunggu koreksi" : r.benar ? "Benar" : "Salah"}
                          </span>
                          <span className="cbt-lembar-poin">{r.poin} / {r.bobot} poin</span>
                        </div>
                        <p className="cbt-soal-tanya">{r.pertanyaan}</p>

                        <div className="cbt-lembar-jawab">
                          <small>Jawaban mahasiswa</small>
                          <p>{r.jawabanTeks || <i>tidak dijawab</i>}</p>
                        </div>

                        {r.jenis !== "essay" && r.kunci !== "" && (
                          <p className="cbt-soal-kunci">
                            Kunci: {r.pilihan.length > 0 ? (r.pilihan[Number(r.kunci)] ?? r.kunci) : r.kunci}
                          </p>
                        )}

                        {/* Kotak nilai hanya untuk essay, dan hanya bagi dosen
                            pemiliknya — inilah satu-satunya jalan agar essay
                            yang dikerjakan mahasiswa berhenti menggantung
                            sebagai "menunggu koreksi". */}
                        {r.jenis === "essay" && terbuka.bolehUbah && (
                          <div className="cbt-koreksi">
                            <label>
                              <span>Nilai (0–{r.bobot})</span>
                              <input
                                type="number"
                                min={0}
                                max={r.bobot}
                                value={draftKoreksi[r.id]?.poin ?? "0"}
                                onChange={(e) =>
                                  setDraftKoreksi((kini) => ({
                                    ...kini,
                                    [r.id]: { poin: e.target.value, catatan: kini[r.id]?.catatan ?? "" },
                                  }))
                                }
                              />
                            </label>
                            <label className="cbt-koreksi-catatan">
                              <span>Catatan untuk mahasiswa</span>
                              <input
                                value={draftKoreksi[r.id]?.catatan ?? ""}
                                onChange={(e) =>
                                  setDraftKoreksi((kini) => ({
                                    ...kini,
                                    [r.id]: { poin: kini[r.id]?.poin ?? "0", catatan: e.target.value },
                                  }))
                                }
                                placeholder="Boleh dikosongkan"
                              />
                            </label>
                            <Tbl
                              kabar={aksi[`koreksi-${r.id}`]}
                              dasar="btn btn-primary btn-mini"
                              diam="Simpan nilai"
                              onClick={() => void koreksi(r.id, r.bobot)}
                            />
                          </div>
                        )}

                        {r.catatan && <p className="cbt-lembar-catatan">Catatan dosen: {r.catatan}</p>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}

          {analisis.some((a) => a.dijawab > 0) && (
            <div className="panel psn-panel">
              <div className="psn-kepala">
                <div>
                  <b>Analisis soal</b>
                  <span>
                    Soal yang dijawab benar di bawah 30% ditandai perlu ditinjau, bisa jadi memang
                    sulit, bisa jadi kuncinya yang salah.
                  </span>
                </div>
              </div>
              <ul className="cbt-analisis">
                {analisis.filter((a) => a.dijawab > 0).map((a) => (
                  <li key={a.id} className={a.perluDitinjau ? "tinjau" : ""}>
                    <div className="cbt-analisis-bar"><span style={{ width: `${a.persen}%` }} /></div>
                    <div className="cbt-analisis-teks">
                      <b>{a.persen}% benar</b>
                      <span>{a.pertanyaan.slice(0, 90)}{a.pertanyaan.length > 90 ? "…" : ""}</span>
                      {a.perluDitinjau && <i>⚠ perlu ditinjau</i>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* ---------- JENDELA PENOLAKAN SOAL ----------
          Muncul menghalangi, dan hanya untuk penolakan. Pita merah di kepala
          panel sudah kalah jauh dari pandangan mata yang sedang menatap tombol
          di dasar formulir sepanjang layar, dan soal yang ditolak tanpa
          disadari baru ketahuan pada pagi hari ujian. */}
      {tolakSoal && (
        <div className="cbt-tirai" role="presentation" onClick={() => setTolakSoal(null)}>
          <div
            className="cbt-pop"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cbt-pop-judul"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cbt-pop-kepala">
              <b id="cbt-pop-judul">⚠ {tolakSoal.judul}</b>
              <button type="button" className="cbt-pop-tutup" onClick={() => setTolakSoal(null)} aria-label="Tutup">✕</button>
            </div>
            <p className="cbt-pop-lead">
              {tolakSoal.rincian.length > 1
                ? `Ada ${tolakSoal.rincian.length} hal yang perlu dibereskan dulu:`
                : "Satu hal yang perlu dibereskan dulu:"}
            </p>
            <ul className="cbt-pop-daftar">
              {tolakSoal.rincian.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <p className="cbt-catatan">
              Isian yang sudah diketik tidak hilang. Tutup jendela ini, perbaiki bagian yang
              disebut, lalu tekan tombolnya lagi.
            </p>
            <button type="button" className="btn btn-primary cbt-pop-oke" onClick={() => setTolakSoal(null)}>
              Mengerti, perbaiki dulu
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
