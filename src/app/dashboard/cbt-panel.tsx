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

import { useCallback, useEffect, useState } from "react";
import {
  JENIS_LABEL, MEDIA_KOSONG, SEMUA_JENIS, STATUS_LABEL, uraiKunciJamak,
  type JenisSoal, type Media, type Pasangan, type StatusUjian,
} from "@/lib/cbt";
import { imporDariExcel, imporDariWord, type SoalImpor, type Aoa } from "@/lib/impor-soal";
import { buatDocxTemplate, buatXlsxTemplate } from "@/lib/template-soal";

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
  keluarFullscreen: number; pindahTab: number; mulai: string; kumpul: string | null;
};

type Analisis = {
  id: number; pertanyaan: string; dijawab: number; benar: number;
  persen: number; kategori: string; perluDitinjau: boolean;
};

type Statistik = {
  peserta: number; rata: number; tertinggi: number; terendah: number;
  median: number; lulus: number; tidakLulus: number; persenLulus: number;
};

const SOAL_KOSONG = {
  jenis: "pg" as JenisSoal,
  pertanyaan: "",
  pilihan: ["", "", "", ""],
  kunci: "0",
  pasangan: [] as Pasangan[],
  media: { ...MEDIA_KOSONG } as Media,
  bobot: 1,
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

/** Ubah tanggal ISO menjadi nilai untuk <input type="datetime-local">. */
function untukInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function jamRapi(iso: string | null) {
  if (!iso) return "—";
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

  // Impor massal: hasil bacaan berkas ditahan dulu untuk dilihat dosen
  // sebelum benar-benar masuk. Empat puluh soal yang langsung tersimpan tanpa
  // sempat dilihat berarti empat puluh soal yang harus diperiksa satu per satu
  // sesudahnya.
  const [imporSoal, setImporSoal] = useState<SoalImpor[]>([]);
  const [imporTolak, setImporTolak] = useState<Array<{ baris: string; alasan: string }>>([]);
  const [imporNama, setImporNama] = useState("");
  const [tersalin, setTersalin] = useState("");

  const [jadwal, setJadwal] = useState({ mulai: "", selesai: "" });
  const [sibuk, setSibuk] = useState(false);

  const muatUjian = useCallback(async () => {
    try {
      const jawab = await fetch("/api/cbt/ujian", { cache: "no-store" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Daftar ujian tidak terbaca.");
      setUjian(data.ujian || []);
      setGalat("");
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Daftar ujian tidak terbaca.");
    } finally {
      setMuat(false);
    }
  }, []);

  useEffect(() => {
    const tunda = window.setTimeout(() => void muatUjian(), 0);
    return () => window.clearTimeout(tunda);
  }, [muatUjian]);

  // Monitoring ujian yang sedang berlangsung menyegar sendiri: dosen yang
  // harus menekan tombol muat ulang tiap menit tidak sedang memantau apa pun.
  useEffect(() => {
    if (buka === null || tab !== "pantau") return;
    const jam = setInterval(() => void muatHasil(buka), 15_000);
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
    void muatSoal(u.id);
    void muatHasil(u.id);
  }

  async function kirim(alamat: string, cara: string, isi: unknown, sukses: string) {
    setSibuk(true);
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
      setPesan(sukses);
      return data as Record<string, unknown>;
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Belum tersimpan.");
      return null;
    } finally {
      setSibuk(false);
    }
  }

  async function buatUjian() {
    if (!draf.title.trim() || !draf.courseName.trim()) {
      setGalat("Nama ujian dan mata kuliah wajib diisi.");
      return;
    }
    const hasil = await kirim("/api/cbt/ujian", "POST", draf, "Ujian dibuat. Sekarang isi soalnya.");
    if (!hasil) return;
    setBuatBaru(false);
    setDraf({ ...draf, title: "", className: "", instruction: "", token: "" });
    await muatUjian();
  }

  /**
   * Periksa soal di peramban, sebelum apa pun dikirim.
   *
   * Aturannya sengaja SAMA dengan rapikanSoal di server. Yang di server tetap
   * berlaku dan tetap menjadi penentu; yang di sini hanya menjaga agar soal
   * yang sudah pasti ditolak tidak sempat muncul di daftar sebagai soal yang
   * seolah-olah tersimpan.
   */
  function periksaSoal(isi: typeof SOAL_KOSONG): string {
    if (isi.pertanyaan.trim().length < 3) return "Pertanyaan belum diisi.";
    const terisi = isi.pilihan.filter((p) => p.trim().length > 0);

    if (isi.jenis === "pg" || isi.jenis === "benar_salah") {
      if (terisi.length < 2) return "Pilihan jawaban minimal dua.";
      const nomor = Number(isi.kunci);
      if (!Number.isInteger(nomor) || nomor < 0 || nomor >= terisi.length) {
        return "Kunci jawaban belum dipilih.";
      }
    }
    if (isi.jenis === "pg_kompleks") {
      if (terisi.length < 2) return "Pilihan jawaban minimal dua.";
      const kunci = uraiKunciJamak(isi.kunci);
      if (kunci.size === 0) return "Tandai dulu jawaban mana saja yang benar.";
      if (kunci.size >= terisi.length) {
        return "Seluruh pilihan ditandai benar — sisakan minimal satu pengecoh, kalau tidak soalnya tidak mengukur apa pun.";
      }
    }
    if (isi.jenis === "penjodohan") {
      if (terisi.length < 2) return "Kolom jawaban penjodohan minimal dua.";
      const lengkap = isi.pasangan.filter(
        (p) => p.kiri.trim().length > 0 && Number.isInteger(p.kanan) && p.kanan >= 0 && p.kanan < terisi.length,
      );
      if (lengkap.length < 2) return "Penjodohan perlu minimal dua pasangan yang lengkap.";
    }
    if (isi.jenis === "isian" && !isi.kunci.trim()) return "Kunci jawaban isian singkat belum diisi.";
    if (isi.media.jenis && !isi.media.url.trim()) return "Media sudah dipilih jenisnya, tetapi tautannya masih kosong.";
    return "";
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
    setSibuk(true);
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
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Media belum dapat diunggah.");
    } finally {
      setSibuk(false);
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
    if (keluhan) { setGalat(keluhan); return; }

    if (target) {
      const hasil = await kirim("/api/cbt/soal", "PATCH", { id: target, ...isi }, "Soal diperbarui.");
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
      setSoal((kini) => kini.filter((x) => x.id !== idSementara));
      setSoalBaru(isi);
      setPesan("");
      setGalat(alasan instanceof Error ? alasan.message : "Soal belum tersimpan.");
    }
  }

  async function hapusSoal(id: number) {
    if (!terbuka || !window.confirm("Hapus soal ini?")) return;
    // Soal yang masih dalam perjalanan ke server belum punya id sungguhan.
    if (id < 0) { setGalat("Soal ini masih dalam proses penyimpanan. Tunggu sebentar."); return; }
    setSibuk(true);
    try {
      const jawab = await fetch(`/api/cbt/soal?id=${id}`, { method: "DELETE" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Soal belum dapat dihapus.");
      await muatSoal(terbuka.id);
      await muatUjian();
      setPesan("Soal dihapus.");
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Soal belum dapat dihapus.");
    } finally {
      setSibuk(false);
    }
  }

  async function aktifkan() {
    if (!terbuka) return;
    if (!jadwal.mulai || !jadwal.selesai) {
      setGalat("Jam mulai dan jam selesai wajib diisi.");
      return;
    }
    const hasil = await kirim(
      "/api/cbt/aktivasi",
      "POST",
      {
        id: terbuka.id,
        aksi: "aktifkan",
        mulai: new Date(jadwal.mulai).toISOString(),
        selesai: new Date(jadwal.selesai).toISOString(),
      },
      "Ujian diaktifkan. Ia akan terbuka sendiri pada jam mulainya.",
    );
    if (hasil) await muatUjian();
  }

  async function batalkanAktivasi() {
    if (!terbuka || !window.confirm("Batalkan aktivasi ujian ini?")) return;
    const hasil = await kirim(
      "/api/cbt/aktivasi",
      "POST",
      { id: terbuka.id, aksi: "batalkan" },
      "Aktivasi dibatalkan.",
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
    setSibuk(true);
    try {
      const jawab = await fetch(`/api/cbt/ujian?id=${terbuka.id}`, { method: "DELETE" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Ujian belum dapat dihapus.");
      setBuka(null);
      setPesan("Ujian dihapus.");
      await muatUjian();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Ujian belum dapat dihapus.");
    } finally {
      setSibuk(false);
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
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Lembar jawaban tidak terbaca.");
      setBukaPeserta(null);
    } finally {
      setMuatRincian(false);
    }
  }

  async function koreksi(questionId: number, bobot: number) {
    if (!terbuka || !bukaPeserta) return;
    const draf = draftKoreksi[questionId];
    const poin = Number(draf?.poin);
    if (!Number.isFinite(poin) || poin < 0 || poin > bobot) {
      setGalat(`Nilai untuk soal ini harus antara 0 dan ${bobot}.`);
      return;
    }
    const hasil = await kirim(
      "/api/cbt/hasil",
      "PATCH",
      { ujian: terbuka.id, attempt: bukaPeserta.id, soal: questionId, poin, catatan: draf?.catatan ?? "" },
      "Koreksi tersimpan.",
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
  }

  function unduhTemplateWord() {
    unduh(buatDocxTemplate(), "Template-Soal-SiPaling.docx");
    setPesan("Template Word terunduh. Tulis soalnya, lalu unggah kembali di sini.");
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

  async function terbitkanImpor() {
    if (!terbuka || imporSoal.length === 0) return;
    const hasil = await kirim(
      "/api/cbt/soal",
      "POST",
      { ujian: terbuka.id, soal: imporSoal },
      `${imporSoal.length} soal masuk ke bank soal.`,
    );
    if (!hasil) return;
    setImporSoal([]);
    setImporTolak([]);
    setImporNama("");
    await muatSoal(terbuka.id);
    await muatUjian();
  }

  // ---------- BAGIKAN ----------

  function alamatUjian(kode: string) {
    if (typeof window === "undefined") return `/ujian?kode=${kode}`;
    return `${window.location.origin}/ujian?kode=${kode}`;
  }

  function pesanGrup(u: Ujian) {
    return [
      `*${u.title}*`,
      `${u.courseName}${u.className ? ` — Kelas ${u.className}` : ""}`,
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
                ? " Anda memantau seluruh ujian dan dapat menghapusnya, tetapi aktivasi ujian milik dosen lain bukan di tangan Anda — buat ujian sendiri bila perlu mengadakan seleksi."
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

            <div className="cbt-sakelar">
              {([
                ["randomQuestions", "Acak urutan soal"],
                ["randomOptions", "Acak urutan pilihan"],
                ["allowBack", "Boleh kembali ke soal sebelumnya"],
                ["showScore", "Tampilkan nilai setelah selesai"],
                ["singleDevice", "Satu perangkat hanya untuk satu peserta"],
              ] as const).map(([kunci, label]) => (
                <label key={kunci} className="cbt-cek">
                  <input type="checkbox" checked={draf[kunci]} onChange={(e) => setDraf({ ...draf, [kunci]: e.target.checked })} />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <button type="button" className="btn btn-primary" disabled={sibuk} onClick={() => void buatUjian()}>
              {sibuk ? "Menyimpan…" : "Simpan ujian"}
            </button>
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
              Tempel salah satu ke grup kelas. Mahasiswa tidak perlu membuat akun — buka tautannya,
              isi nama dan NIM, selesai.
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

      {/* ---------- GERBANG AKTIVASI ---------- */}
      <div className="panel cbt-aktivasi" data-aktif={terbuka.activatedAt ? "1" : undefined}>
        <div className="cbt-aktivasi-kepala">
          <div>
            <b>{terbuka.activatedAt ? "Ujian sudah diaktifkan" : "Belum diaktifkan"}</b>
            <span>
              {terbuka.activatedAt
                ? `Dibuka sendiri ${jamRapi(terbuka.startAt)} sampai ${jamRapi(terbuka.endAt)}. Diaktifkan oleh ${terbuka.activatedBy ?? "—"}.`
                : terbuka.bolehUbah
                  ? "Setel jam mulai dan jam selesai, lalu aktifkan. Pada jam mulainya ujian terbuka sendiri — tidak ada tombol yang perlu ditekan lagi."
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
              <button type="button" className="btn btn-primary" disabled={sibuk} onClick={() => void aktifkan()}>
                {terbuka.activatedAt ? "Perbarui jadwal" : "Aktifkan ujian"}
              </button>
              {terbuka.activatedAt && (
                <button type="button" className="btn btn-danger btn-mini" disabled={sibuk} onClick={() => void batalkanAktivasi()}>
                  Batalkan
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="cbt-catatan">
            Jadwal dan aktivasi ujian ini dipegang dosen pemiliknya. Anda dapat memantau peserta dan
            nilainya di tab sebelah{terbuka.bolehHapus ? ", dan menghapus ujian ini bila memang perlu" : ""}.
            Untuk ujian seleksi, buatlah ujian sendiri — ujian yang Anda buat menjadi milik Anda,
            beserta tombol aktivasinya.
          </p>
        )}

        {terbuka.bolehHapus && (
          <div className="cbt-hapus-ujian">
            <button type="button" className="btn btn-danger btn-mini" disabled={sibuk} onClick={() => void hapusUjian()}>
              Hapus ujian ini
            </button>
            <span>Soal dan seluruh hasilnya ikut terhapus. Tidak dapat dibatalkan.</span>
          </div>
        )}
      </div>

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
              Ujian sedang berlangsung. Soal dikunci sampai selesai — mengubahnya sekarang berarti
              sebagian mahasiswa mengerjakan ujian yang berbeda dari sebagian yang lain.
            </div>
          )}
          {!terbuka.bolehUbah && !sedangBerlangsung && (
            <div className="dsh-note">
              Bank soal ini milik <b>{terbuka.createdBy}</b> dan hanya dapat dibaca dari sini.
              Menyunting soal kelas dosen lain bukan wewenang yang ada pada peran Anda.
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
              <button type="button" className="btn btn-light" onClick={() => unduhTemplateExcel()}>
                ⇩ Template Excel (.xlsx)
              </button>
              <button type="button" className="btn btn-light" onClick={() => unduhTemplateWord()}>
                ⇩ Template Word (.docx)
              </button>
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
                      <li key={i}><b>{t.baris}</b> — {t.alasan}</li>
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
                      <button type="button" className="btn btn-primary" disabled={sibuk || terkunci} onClick={() => void terbitkanImpor()}>
                        {sibuk ? "Menyimpan…" : `Masukkan ${imporSoal.length} soal ke bank`}
                      </button>
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
              <label><span>Materi</span>
                <input value={soalBaru.materi} onChange={(e) => setSoalBaru({ ...soalBaru, materi: e.target.value })} placeholder="Bab 2" />
              </label>
              <label><span>Tingkat</span>
                <select value={soalBaru.tingkat} onChange={(e) => setSoalBaru({ ...soalBaru, tingkat: e.target.value })}>
                  <option value="mudah">Mudah</option>
                  <option value="sedang">Sedang</option>
                  <option value="sulit">Sulit</option>
                </select>
              </label>
            </div>

            <label className="cbt-lebar"><span>Pertanyaan *</span>
              <textarea rows={3} value={soalBaru.pertanyaan} onChange={(e) => setSoalBaru({ ...soalBaru, pertanyaan: e.target.value })} />
            </label>

            {/* ---------- MEDIA: GAMBAR ATAU VIDEO ---------- */}
            <div className="cbt-media-edit">
              <span className="cbt-opsi-judul">Media soal (opsional)</span>
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
                <label className={`btn btn-light btn-mini cbt-unggah ${terkunci ? "mati" : ""}`}>
                  ⇧ Unggah
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"
                    disabled={terkunci || sibuk}
                    onChange={(e) => {
                      const berkas = e.target.files?.[0];
                      e.target.value = "";
                      if (berkas) void unggahMedia(berkas);
                    }}
                  />
                </label>
              </div>
              {soalBaru.media.jenis && (
                <input
                  className="cbt-media-ket-edit"
                  value={soalBaru.media.keterangan}
                  onChange={(e) => setSoalBaru({ ...soalBaru, media: { ...soalBaru.media, keterangan: e.target.value } })}
                  placeholder="Keterangan gambar/video (opsional)"
                />
              )}
              <p className="cbt-catatan">
                Gambar maksimal 5 MB, video 50 MB. Video panjang lebih baik ditempel sebagai tautan
                YouTube atau Google Drive — tautan sematan tidak punya batas ukuran dan tidak
                memakan kuota penyimpanan.
              </p>
            </div>

            {(soalBaru.jenis === "pg" || soalBaru.jenis === "pg_kompleks" ||
              soalBaru.jenis === "benar_salah" || soalBaru.jenis === "penjodohan") && (
              <div className="cbt-opsi-edit">
                <span className="cbt-opsi-judul">
                  {soalBaru.jenis === "penjodohan"
                    ? "Kolom jawaban (kanan) — boleh diberi pengecoh yang tidak berpasangan"
                    : soalBaru.jenis === "pg_kompleks"
                      ? "Pilihan jawaban — tandai SEMUA yang benar, sisakan minimal satu pengecoh"
                      : "Pilihan jawaban — tekan lingkarannya untuk menandai kunci"}
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
                <span className="cbt-opsi-judul">Pasangan — kolom kiri dan jawaban yang benar</span>
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
              <label className="cbt-lebar"><span>Kunci jawaban — pisahkan beberapa kemungkinan dengan |</span>
                <input value={soalBaru.kunci} onChange={(e) => setSoalBaru({ ...soalBaru, kunci: e.target.value })} placeholder="komunikasi massa|mass communication" />
              </label>
            )}

            {soalBaru.jenis === "essay" && (
              <p className="cbt-catatan">Essay dikoreksi dosen di tab Monitoring &amp; nilai setelah ujian selesai.</p>
            )}

            <div className="cbt-form-aksi">
              <button type="button" className="btn btn-primary" disabled={sibuk || terkunci} onClick={() => void simpanSoal()}>
                {sunting ? "Simpan perubahan" : "+ Tambah ke bank soal"}
              </button>
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
                      }}>Ubah</button>
                      <button type="button" disabled={terkunci} onClick={() => void hapusSoal(s.id)}>Hapus</button>
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
                          <b>{i + 1}.</b> {pas.kiri} <i>↔ {s.pilihan[pas.kanan] ?? "—"}</i>
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
                <span>Menyegar sendiri tiap 15 detik selama tab ini terbuka.</span>
              </div>
              <button type="button" className="btn btn-light btn-mini" onClick={() => void unduhNilai()} disabled={peserta.length === 0}>
                ⇩ Unduh nilai (CSV)
              </button>
            </div>

            {peserta.length === 0 ? (
              <div className="dempty">Belum ada yang masuk ke ujian ini.</div>
            ) : (
              <div className="qtable-wrap">
                <table className="qt">
                  <thead>
                    <tr><th>Mahasiswa</th><th>Status</th><th>Progres</th><th>Nilai</th><th>Catatan</th><th /></tr>
                  </thead>
                  <tbody>
                    {peserta.map((p) => (
                      <tr key={p.id} className={bukaPeserta?.id === p.id ? "cbt-baris-buka" : ""}>
                        <td><b>{p.nama}</b><small className="psn-nama">{p.nim}</small></td>
                        <td>
                          <span className={`pill cbt-p-${p.status}`}>
                            {p.status === "berjalan" ? "Mengerjakan" : p.status === "waktu_habis" ? "Waktu habis" : "Selesai"}
                          </span>
                        </td>
                        <td>{p.terjawab}/{terbuka.questionCount || soal.length}</td>
                        <td>
                          {p.nilai === null ? "—" : <b>{p.nilai}</b>}
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
                            <small className="psn-nama">—</small>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="text-action"
                            onClick={() => void bukaLembar(p)}
                            disabled={p.status === "berjalan"}
                            title={p.status === "berjalan" ? "Menunggu sampai dikumpulkan" : "Buka lembar jawabannya"}
                          >
                            {p.tertunda > 0 ? `Koreksi ${p.tertunda} essay` : "Lihat jawaban"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

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
                <button type="button" className="btn btn-light btn-mini" onClick={() => { setBukaPeserta(null); setRincian([]); }}>
                  Tutup
                </button>
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
                            <button type="button" className="btn btn-primary btn-mini" disabled={sibuk} onClick={() => void koreksi(r.id, r.bobot)}>
                              {sibuk ? "Menyimpan…" : "Simpan nilai"}
                            </button>
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
                    Soal yang dijawab benar di bawah 30% ditandai perlu ditinjau — bisa jadi memang
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
    </section>
  );
}
