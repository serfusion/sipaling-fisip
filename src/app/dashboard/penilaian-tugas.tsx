"use client";

// ============================================================
// PENILAIAN TUGAS — menu keempat panel CBT (v54: tersimpan di server)
//
// Alurnya enam langkah di satu halaman:
//
//   1. Data tugas      mata kuliah, tugas ke-, nama tugas, petunjuk (opsional)
//   2. Rubrik tugas    diunggah (Excel/Word/PDF/teks), dari pustaka rubrik CBT,
//                      atau diketik; dosen memeriksa bobotnya
//   3. Template        template laporan dosen (Markdown/Word/teks) atau bawaan
//   4. Pengumpulan     mahasiswa mengumpulkan PDF sendiri lewat CBT dengan
//                      kode pengumpulan; dosen juga dapat mengimpor tugas yang
//                      sudah terkumpul di Drive (zip/rar/PDF/Word/Excel)
//   5. Penilaian AI    batas kritis nilai, gerbang plagiasi, lalu penilaian;
//      & laporan PDF   hasilnya dapat disunting dosen dan diunduh sebagai PDF
//   6. Terbitkan &     papan nilai CBT, arsip lengkap (.zip) untuk Google
//      arsipkan        Drive, tautan Arsip Drive, dan penghapusan
//
// SEJAK v54 SEMUANYA TERSIMPAN DI SERVER: pengaturan tugas, isi kiriman
// sebagai Markdown (.md), hasil penilaian, dan kemiripan antarkiriman.
// Berkas asli mahasiswa tetap TIDAK disimpan; yang tersimpan hanya teks
// Markdown-nya beserta sidik SHA-256 berkas aslinya. Berkas yang diimpor dosen
// pada sesi ini tetap dipegang peramban, supaya PDF dan gambarnya dapat
// dilampirkan untuk dibaca AI saat dinilai.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dariRubrikLevel, ejaNilai, ejaRentang, ejaSkala, hitungNilaiTugas, periksaRubrikTugas, predikatTugas,
  rapikanBobot, skorAman, uraiSkala, type RubrikTugas,
} from "@/lib/tugas-rubrik";
import {
  KAKI_SPF, TEMPLATE_BAWAAN, analisisTemplate, buatLaporanPdf, htmlKeMarkdown, namaBerkasLaporan, uraiMarkdown,
  type DataLaporan,
} from "@/lib/tugas-template";
import {
  alatGambarPeramban, bongkar, jenisBerkas, kelompokkan, rubrikDariBerkas, sarikanBerkas, siapkanKiriman,
  type BerkasTugas, type Lampiran,
} from "@/lib/tugas-berkas";
import { pdfKeMarkdown } from "@/lib/pdf-markdown";
import { sidikBerkas } from "@/lib/tugas-kode";
import {
  TINDAKAN_LABEL, TINDAKAN_PLAGIASI, labelKemiripan, nilaiKritis, rapikanBatasKritis, susunDataLaporan, terindikasi,
  type TindakanPlagiasi,
} from "@/lib/tugas-papan";
import type { HasilPenilaianTugas } from "@/lib/tugas-nilai";
import type { KirimanKlien, PasanganKlien, TugasKlien } from "@/lib/tugas-store";
import type { Rubrik } from "@/lib/rubrik";
import { buatZip, namaAman, ukuranTerbaca, type Bita } from "@/lib/zip";
import { asalCbt } from "@/lib/situs-cbt";
import { SimpanArsipDrive } from "./arsip-drive";

// ------------------------------------------------------------
// TIPE
// ------------------------------------------------------------

type RingkasTugas = TugasKlien & { jumlah: number; dinilai: number; ditandai: number };

type Hasil = NonNullable<KirimanKlien["hasil"]>;

type Proses = { status: "antre" | "membaca" | "menilai" | "gagal"; galat?: string };

type UjiTampil = {
  nama: string;
  permintaan: { teks: number; lampiran: string[]; keterangan: string; ukuranKb: number };
  hasil?: HasilPenilaianTugas;
  galat?: string;
  status?: number;
};

type Banding = {
  a: { id: number; kode: string; nama: string; nim: string; kata: number; berkas: string };
  b: { id: number; kode: string; nama: string; nim: string; kata: number; berkas: string };
  kalimat: string[];
  skor: number;
};

/** Pengaturan tugas v53 yang tersimpan di peramban (untuk dipindahkan ke server). */
type TugasV53 = {
  id: string; mataKuliah: string; nomor: string; nama: string; petunjuk: string; dosen: string;
  rubrik: RubrikTugas; template: string; namaTemplate: string; skala: unknown; kakiAi: boolean;
};

const KUNCI_V53 = "sipaling:penilaian-tugas:v1";
const KUNCI_V53_PINDAH = "sipaling:penilaian-tugas:v1:dipindah";
const KUNCI_AKTIF = "sipaling:penilaian-tugas:aktif";

const KEADAAN_LABEL: Record<string, string> = { belum: "Belum dinilai", dinilai: "Dinilai", ditahan: "Ditahan" };
const PROSES_LABEL: Record<Proses["status"], string> = { antre: "Antre", membaca: "Membaca berkas…", menilai: "Dinilai AI…", gagal: "Gagal" };

const TERIMA = ".zip,.rar,.pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.odt,.odp,.ods,.rtf,.txt,.md,.html,.jpg,.jpeg,.png,.webp";

// ------------------------------------------------------------
// ALAT KECIL
// ------------------------------------------------------------

function unduh(data: BlobPart, nama: string, jenis: string) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: jenis }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));
const utf8 = (s: string) => new TextEncoder().encode(s) as Bita;

async function minta<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T & { success: true }> {
  const jawab = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const d = await jawab.json().catch(() => ({ success: false, message: `Server menjawab ${jawab.status}.` }));
  if (!jawab.ok || !d.success) throw Object.assign(new Error(d.message || `Server menjawab ${jawab.status}.`), { status: jawab.status, data: d });
  return d;
}

const pesanGalat = (e: unknown, cadangan: string) => (e instanceof Error && e.message ? e.message : cadangan);

/** Waktu ISO → nilai <input type="datetime-local"> waktu setempat. */
function keInputWaktu(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const dua = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}T${dua(d.getHours())}:${dua(d.getMinutes())}`;
}

const jamTanggal = (iso: string | null) => (iso
  ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  : "–");

/** Isi Markdown satu kiriman yang diimpor dosen (bisa beberapa berkas). */
async function markdownKelompok(berkas: BerkasTugas[]): Promise<{ markdown: string; halaman: number; catatan: string[] }> {
  const potong: string[] = [];
  const catatan: string[] = [];
  let halaman = 0;
  const gambar: string[] = [];
  for (const b of berkas) {
    const jenis = jenisBerkas(b.nama);
    let md = "";
    try {
      if (jenis === "pdf") {
        const h = await pdfKeMarkdown(b.data);
        md = h.markdown;
        halaman += h.halaman;
        catatan.push(...h.catatan.map((c) => `${b.nama}: ${c}`));
      } else if (jenis === "docx") {
        const mammoth = await import("mammoth");
        const { value } = await mammoth.convertToHtml({ arrayBuffer: b.data.slice().buffer as ArrayBuffer });
        md = htmlKeMarkdown(value);
      } else if (jenis === "gambar") {
        gambar.push(b.nama);
        continue;
      } else {
        const s = await sarikanBerkas(b);
        md = s.teks;
        halaman += s.bagian;
        catatan.push(...s.catatan.filter(Boolean).map((c) => `${b.nama}: ${c}`));
      }
    } catch (e) {
      catatan.push(`${b.nama}: ${pesanGalat(e, "tidak dapat dibaca")}`);
    }
    if (md.trim()) potong.push(berkas.length > 1 ? `# ${b.nama}\n\n${md.trim()}` : md.trim());
  }
  if (gambar.length) {
    potong.push(`(Berkas gambar: ${gambar.join(", ")}. Isinya dibaca AI dari lampiran visual saat dinilai pada sesi impor.)`);
  }
  return { markdown: potong.join("\n\n---\n\n"), halaman, catatan };
}

// ------------------------------------------------------------
// KOMPONEN UTAMA
// ------------------------------------------------------------

export function PanelPenilaianTugas() {
  const [daftar, setDaftar] = useState<RingkasTugas[] | null>(null);
  const [tugas, setTugas] = useState<TugasKlien | null>(null);
  const [kiriman, setKiriman] = useState<KirimanKlien[]>([]);
  const [pasangan, setPasangan] = useState<PasanganKlien[]>([]);
  const [boleh, setBoleh] = useState({ ubah: false, hapus: false });
  const [siapAi, setSiapAi] = useState<boolean | null>(null);
  const [kabar, setKabar] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [simpan, setSimpan] = useState<"" | "menyimpan" | "tersimpan" | "gagal">("");
  const [catatanRubrik, setCatatanRubrik] = useState<string[]>([]);
  const [peringatan, setPeringatan] = useState<string[]>([]);
  const [uji, setUji] = useState<UjiTampil | null>(null);
  const [buka, setBuka] = useState<number | null>(null);
  const [jalan, setJalan] = useState(false);
  const [teksSkala, setTeksSkala] = useState("");
  const [proses, setProses] = useState<Record<number, Proses>>({});
  const [banding, setBanding] = useState<Banding | null>(null);
  const [lokalV53, setLokalV53] = useState<TugasV53[]>([]);
  const [asal, setAsal] = useState({ cbt: "", portal: "" });

  const berhenti = useRef(false);
  /** Berkas impor dosen pada sesi ini, per id kiriman: untuk lampiran visual. */
  const berkasSesi = useRef(new Map<number, BerkasTugas[]>());
  const kirimanRef = useRef<KirimanKlien[]>([]);
  useEffect(() => { kirimanRef.current = kiriman; }, [kiriman]);
  const antrean = useRef<{ id: number; ubah: Record<string, unknown> } | null>(null);
  const jamSimpan = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jamHasil = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  // ---------- MUAT ----------

  const muatTugas = useCallback(async (id: number) => {
    setGalat("");
    try {
      const d = await minta<{ tugas: TugasKlien; kiriman: KirimanKlien[]; pasangan: PasanganKlien[]; boleh: { ubah: boolean; hapus: boolean } }>(
        `/api/cbt/tugas/kelola?id=${id}`,
      );
      setTugas(d.tugas);
      setKiriman(d.kiriman);
      setPasangan(d.pasangan);
      setBoleh(d.boleh);
      setTeksSkala(ejaSkala(d.tugas.skala));
      setUji(null);
      setBuka(null);
      setBanding(null);
      setProses({});
      try { localStorage.setItem(KUNCI_AKTIF, String(id)); } catch { /* diamkan */ }
    } catch (e) {
      setGalat(pesanGalat(e, "Tugas belum dapat dimuat."));
    }
  }, []);

  const muatDaftar = useCallback(async (pilih?: number) => {
    try {
      const d = await minta<{ tugas: RingkasTugas[] }>("/api/cbt/tugas/kelola");
      setDaftar(d.tugas);
      let simpanan = 0;
      try { simpanan = Number(localStorage.getItem(KUNCI_AKTIF)) || 0; } catch { /* diamkan */ }
      const id = pilih ?? d.tugas.find((t) => t.id === simpanan)?.id ?? d.tugas[0]?.id;
      if (id) await muatTugas(id);
      else setTugas(null);
    } catch (e) {
      setDaftar([]);
      setGalat(pesanGalat(e, "Daftar tugas belum dapat dimuat."));
    }
  }, [muatTugas]);

  useEffect(() => {
    // Asal situs dibaca sesudah terpasang, supaya gambar pertama sama di
    // server dan peramban.
    const jam = setTimeout(() => {
      setAsal({ cbt: asalCbt(window.location.host), portal: window.location.origin });
      try {
        if (!localStorage.getItem(KUNCI_V53_PINDAH)) {
          const isi = JSON.parse(localStorage.getItem(KUNCI_V53) || "null") as { tugas?: TugasV53[] } | null;
          const ada = (isi?.tugas ?? []).filter((t) => t.rubrik?.kriteria?.length || t.nama || t.mataKuliah);
          setLokalV53(ada);
        }
      } catch { /* penyimpanan peramban tidak tersedia */ }
      void muatDaftar();
    }, 0);
    return () => clearTimeout(jam);
  }, [muatDaftar]);

  useEffect(() => {
    let hidup = true;
    fetch("/api/cbt/tugas", { cache: "no-store" })
      .then((j) => j.json())
      .then((d) => { if (hidup) setSiapAi(Boolean(d?.siap)); })
      .catch(() => { if (hidup) setSiapAi(false); });
    return () => { hidup = false; };
  }, []);

  // ---------- SIMPAN PENGATURAN (otomatis) ----------

  const kirimUbah = useCallback(async (id: number, ubah: Record<string, unknown>, lengkap = false) => {
    setSimpan("menyimpan");
    try {
      const d = await minta<{ tugas: TugasKlien; kiriman?: KirimanKlien[]; pasangan?: PasanganKlien[] }>(
        "/api/cbt/tugas/kelola", { method: "POST", body: JSON.stringify({ aksi: "ubah", id, ubah, lengkap }) },
      );
      setSimpan("tersimpan");
      setDaftar((ds) => ds?.map((x) => (x.id === id ? { ...x, ...d.tugas } : x)) ?? ds);
      if (d.kiriman) { setKiriman(d.kiriman); setPasangan(d.pasangan ?? []); }
      return d;
    } catch (e) {
      setSimpan("gagal");
      setGalat(pesanGalat(e, "Pengaturan belum tersimpan."));
      return null;
    }
  }, []);

  const tuntaskanSimpan = useCallback(() => {
    if (jamSimpan.current) clearTimeout(jamSimpan.current);
    jamSimpan.current = null;
    const a = antrean.current;
    antrean.current = null;
    if (a && Object.keys(a.ubah).length) void kirimUbah(a.id, a.ubah);
  }, [kirimUbah]);

  useEffect(() => () => tuntaskanSimpan(), [tuntaskanSimpan]);

  /** Ubah pengaturan: layar langsung, server menyusul (atau segera). */
  function ubahTugas(ubah: Partial<TugasKlien>, segera = false) {
    if (!tugas || !boleh.ubah) return;
    setTugas((t) => (t ? { ...t, ...ubah } : t));
    if (antrean.current && antrean.current.id !== tugas.id) tuntaskanSimpan();
    antrean.current = { id: tugas.id, ubah: { ...(antrean.current?.ubah ?? {}), ...ubah } };
    if (jamSimpan.current) clearTimeout(jamSimpan.current);
    if (segera) {
      const a = antrean.current;
      antrean.current = null;
      jamSimpan.current = null;
      return kirimUbah(a.id, a.ubah, true);
    }
    jamSimpan.current = setTimeout(tuntaskanSimpan, 800);
    return undefined;
  }

  // ---------- TUGAS: PILIH, BUAT, SALIN, HAPUS, PINDAH ----------

  function pilihTugas(id: number) {
    if (jalan) return;
    tuntaskanSimpan();
    void muatTugas(id);
  }

  async function buatBaru() {
    if (jalan) return;
    tuntaskanSimpan();
    setSibuk("buat");
    try {
      const d = await minta<{ tugas: TugasKlien }>("/api/cbt/tugas/kelola", { method: "POST", body: JSON.stringify({ aksi: "buat" }) });
      await muatDaftar(d.tugas.id);
      setKabar(`Tugas baru dibuat dengan kode pengumpulan ${d.tugas.kode}.`);
    } catch (e) {
      setGalat(pesanGalat(e, "Tugas baru belum dapat dibuat."));
    } finally {
      setSibuk("");
    }
  }

  async function salinTugas() {
    if (!tugas || jalan) return;
    tuntaskanSimpan();
    try {
      const d = await minta<{ tugas: TugasKlien }>("/api/cbt/tugas/kelola", { method: "POST", body: JSON.stringify({ aksi: "salin", id: tugas.id }) });
      await muatDaftar(d.tugas.id);
      setKabar("Rubrik, template, dan pengaturan disalin ke tugas baru (tanpa kiriman).");
    } catch (e) {
      setGalat(pesanGalat(e, "Tugas belum dapat disalin."));
    }
  }

  async function hapusTugas() {
    if (!tugas || jalan) return;
    const judul = [tugas.mataKuliah, tugas.nama].filter(Boolean).join(" · ") || "tugas ini";
    if (!window.confirm(
      `Hapus "${judul}" beserta ${kiriman.length} kiriman, nilai, dan pemeriksaan plagiasinya dari portal?\n\n` +
      "Unduh arsip lengkapnya (langkah 6) lebih dulu bila belum. Tautan Arsip Drive-nya tetap ada.",
    )) return;
    try {
      await minta(`/api/cbt/tugas/kelola?id=${tugas.id}`, { method: "DELETE" });
      berkasSesi.current.clear();
      await muatDaftar();
      setKabar("Tugas dihapus.");
    } catch (e) {
      setGalat(pesanGalat(e, "Tugas belum dapat dihapus."));
    }
  }

  async function pindahkanV53() {
    setSibuk("pindah");
    try {
      const isi = lokalV53.map((t) => ({
        mataKuliah: t.mataKuliah, nomor: t.nomor, nama: t.nama, petunjuk: t.petunjuk, dosen: t.dosen,
        rubrik: t.rubrik, template: t.template, namaTemplate: t.namaTemplate, skala: t.skala, kakiSpf: t.kakiAi,
      }));
      const d = await minta<{ dibuat: number[] }>("/api/cbt/tugas/kelola", { method: "POST", body: JSON.stringify({ aksi: "pindah", tugas: isi }) });
      try { localStorage.setItem(KUNCI_V53_PINDAH, new Date().toISOString()); } catch { /* diamkan */ }
      setLokalV53([]);
      await muatDaftar(d.dibuat[0]);
      setKabar(`${d.dibuat.length} pengaturan tugas dipindahkan ke server. Hasil penilaian lama tetap dapat diunduh ulang dari zip yang dulu Anda simpan.`);
    } catch (e) {
      setGalat(pesanGalat(e, "Pengaturan belum dapat dipindahkan."));
    } finally {
      setSibuk("");
    }
  }

  // ---------- RUBRIK ----------

  async function unggahRubrik(berkas: File) {
    setGalat(""); setKabar(""); setCatatanRubrik([]);
    setSibuk("rubrik");
    try {
      const data = new Uint8Array(await berkas.arrayBuffer());
      const h = await rubrikDariBerkas(berkas.name, data);
      if (h.ok) {
        ubahTugas({ rubrik: { ...h.rubrik, nama: h.rubrik.nama || berkas.name.replace(/\.[^.]+$/, "") } });
        setCatatanRubrik([`Terbaca dari ${h.cara}: ${h.rubrik.kriteria.length} kriteria.`, ...h.catatan]);
        return;
      }
      if (h.teks.trim().length < 30) throw new Error("Tidak ada teks rubrik yang dapat dibaca dari berkas itu.");
      setKabar("Tidak ada tabel rubrik yang dikenali; AI sedang menyusunnya dari teks dokumen…");
      const d = await minta<{ rubrik: RubrikTugas; catatan: string[] }>("/api/cbt/tugas", {
        method: "POST", body: JSON.stringify({ aksi: "rubrik", teks: h.teks.slice(0, 60_000) }),
      });
      ubahTugas({ rubrik: { ...d.rubrik, nama: d.rubrik.nama || berkas.name.replace(/\.[^.]+$/, "") } });
      setCatatanRubrik(d.catatan || []);
      setKabar("");
    } catch (e) {
      setKabar("");
      setGalat(pesanGalat(e, "Rubrik gagal dibaca."));
    } finally {
      setSibuk("");
    }
  }

  const [pustaka, setPustaka] = useState<Array<Rubrik & { id?: number }> | null>(null);
  async function muatPustaka() {
    setSibuk("pustaka");
    try {
      const d = await minta<{ rubrik?: Rubrik[]; bawaan?: Rubrik[] }>("/api/cbt/rubrik");
      setPustaka([...(d.rubrik || []), ...(d.bawaan || [])]);
    } catch (e) {
      setGalat(pesanGalat(e, "Pustaka rubrik gagal dimuat."));
    } finally {
      setSibuk("");
    }
  }

  function ubahKriteria(i: number, ubah: Partial<RubrikTugas["kriteria"][number]>) {
    if (!tugas) return;
    ubahTugas({ rubrik: { ...tugas.rubrik, kriteria: tugas.rubrik.kriteria.map((k, j) => (j === i ? { ...k, ...ubah } : k)) } });
  }

  // ---------- TEMPLATE ----------

  async function unggahTemplate(berkas: File) {
    setGalat("");
    setSibuk("template");
    try {
      const nama = berkas.name.toLowerCase();
      const data = new Uint8Array(await berkas.arrayBuffer());
      let md = "";
      if (nama.endsWith(".docx")) {
        const mammoth = await import("mammoth");
        const { value } = await mammoth.convertToHtml({ arrayBuffer: data.buffer as ArrayBuffer });
        md = htmlKeMarkdown(value);
      } else if (/\.(md|markdown|txt)$/.test(nama)) {
        md = new TextDecoder().decode(data);
      } else {
        const s = await sarikanBerkas({ jalur: berkas.name, segmen: [berkas.name], wadah: 0, nama: berkas.name, data });
        md = s.teks.replace(/\[Halaman \d+\]\n?/g, "");
      }
      if (!md.trim()) throw new Error("Template itu kosong atau tidak terbaca.");
      ubahTugas({ template: md, namaTemplate: berkas.name });
    } catch (e) {
      setGalat(pesanGalat(e, "Template gagal dibaca."));
    } finally {
      setSibuk("");
    }
  }

  const templateAktif = tugas?.template || TEMPLATE_BAWAAN;
  const blokTemplate = useMemo(() => uraiMarkdown(templateAktif), [templateAktif]);
  const analisis = useMemo(() => analisisTemplate(blokTemplate), [blokTemplate]);

  const kaki = (t: TugasKlien) => (t.kakiSpf ? KAKI_SPF : undefined);

  function dataLaporan(t: TugasKlien, k: KirimanKlien): DataLaporan {
    return susunDataLaporan({
      tugas: { mataKuliah: t.mataKuliah, nomor: t.nomor, nama: t.nama, dosen: t.dosen, kelas: t.kelas },
      mahasiswa: { nama: k.nama, nim: k.nim },
      rubrik: t.rubrik,
      skala: t.skala,
      hasil: k.hasil,
      status: k.status,
      plagiasi: { status: k.statusMirip, skor: k.kemiripan, putusan: k.putusan },
      tindakan: t.tindakan,
      batasKritis: t.batasKritis,
      dinilai: k.dinilai,
      kode: k.kode,
    });
  }

  function pratinjauTemplate() {
    if (!tugas) return;
    const rubrik = tugas.rubrik.kriteria.length ? tugas.rubrik : {
      nama: "Contoh", kriteria: [1, 2, 3].map((n) => ({ nama: `Kriteria contoh ${n}`, bobot: n === 1 ? 34 : 33, deskripsi: "" })),
    };
    const skor = rubrik.kriteria.map((_, i) => 80 + ((i * 3) % 7));
    const hitung = hitungNilaiTugas(rubrik, skor);
    const pdf = buatLaporanPdf(templateAktif, {
      tugas: { mataKuliah: tugas.mataKuliah || "Mata Kuliah Contoh", nomor: tugas.nomor || "1", nama: tugas.nama || "Nama Tugas Contoh", dosen: tugas.dosen },
      mahasiswa: { nama: "Nama Mahasiswa Contoh", nim: "2300000000" },
      judulKarya: "Judul karya mahasiswa (diambil AI dari dokumennya)",
      rubrik, skor,
      capaian: rubrik.kriteria.map(() => "Deskripsi capaian mahasiswa pada kriteria ini, ditulis AI dengan menunjuk bukti di dokumen."),
      nilai: hitung.nilai, rataBiasa: hitung.rataBiasa, predikat: predikatTugas(hitung.nilai, tugas.skala),
      kelebihan: ["Kelebihan pertama yang spesifik pada karya ini.", "Kelebihan kedua."],
      perbaikan: [{ aspek: "Aspek perbaikan", uraian: "Letak masalah dan cara memperbaikinya." }],
      catatan: "Catatan khusus atau saran tindak lanjut.",
      bagianTambahan: analisis.bagianBebas.map((j) => ({ judul: j, isi: `Isi bagian "${j}" ditulis AI.` })),
      tanggal: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
      kode: "SIPALING-TUGAS-CONTOH12",
    }, { kaki: kaki(tugas) });
    const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  // ---------- IMPOR DOSEN (Drive) ----------

  async function terimaBerkas(daftarBerkas: FileList | File[]) {
    const berkas = Array.from(daftarBerkas);
    if (!berkas.length || !tugas) return;
    setGalat(""); setKabar(""); setPeringatan([]);
    setSibuk("unggah");
    try {
      const masukan = [];
      let total = 0;
      for (const f of berkas) {
        total += f.size;
        masukan.push({
          nama: f.name,
          data: new Uint8Array(await f.arrayBuffer()),
          jalur: (f as File & { webkitRelativePath?: string }).webkitRelativePath || undefined,
        });
      }
      const h = await bongkar(masukan, { lapor: (p) => setKabar(p) });
      const kelompok = kelompokkan(h.berkas, [tugas.nama, tugas.mataKuliah]);
      const catatan = [...h.peringatan];

      // Unggahan ulang berkas yang sudah diimpor tidak menjadi kiriman kembar:
      // berkasnya hanya dipegang lagi untuk lampiran visual.
      const baru: Array<{ k: typeof kelompok[number]; isi: Record<string, unknown> }> = [];
      let dikenali = 0;
      for (const [i, k] of kelompok.entries()) {
        const namaBerkas = k.berkas.map((b) => b.nama).join("; ").slice(0, 400);
        const ada = kirimanRef.current.find((x) => x.asal === "dosen" && x.berkas === namaBerkas && x.nim === k.nim);
        if (ada) { berkasSesi.current.set(ada.id, k.berkas); dikenali += 1; continue; }
        setKabar(`Menyusun .md ${i + 1} dari ${kelompok.length}: ${k.nama || k.sumber}…`);
        const md = await markdownKelompok(k.berkas);
        catatan.push(...md.catatan);
        baru.push({
          k,
          isi: {
            nama: k.nama, nim: k.nim, berkas: namaBerkas,
            ukuran: k.berkas.reduce((n, b) => n + b.data.length, 0),
            sidik: k.berkas.length === 1 ? await sidikBerkas(k.berkas[0].data) : "",
            halaman: md.halaman,
            markdown: md.markdown,
          },
        });
      }

      // Dikirim berkelompok supaya tiap permintaan di bawah batas unggah 4,5 MB.
      let dibuat = 0;
      let kumpul: typeof baru = [];
      let ukuran = 0;
      const kirim = async () => {
        if (!kumpul.length) return;
        const d = await minta<{ dibuat: KirimanKlien[]; catatan: string[] }>("/api/cbt/tugas/kiriman", {
          method: "POST", body: JSON.stringify({ aksi: "impor", tugas: tugas.id, kiriman: kumpul.map((x) => x.isi) }),
        });
        // Urutan jawaban mengikuti urutan kiriman yang dikirim (yang kosong dilewati server).
        const terisi = kumpul.filter((x) => String(x.isi.markdown || "").trim());
        d.dibuat.forEach((row, j) => { if (terisi[j]) berkasSesi.current.set(row.id, terisi[j].k.berkas); });
        setKiriman((s) => [...s, ...d.dibuat]);
        catatan.push(...d.catatan);
        dibuat += d.dibuat.length;
        kumpul = [];
        ukuran = 0;
      };
      for (const x of baru) {
        const panjang = String(x.isi.markdown).length * 1.1 + 500;
        if (ukuran + panjang > 3_000_000) await kirim();
        kumpul.push(x);
        ukuran += panjang;
      }
      await kirim();

      setPeringatan(catatan);
      setKabar(
        `${berkas.length} berkas (${ukuranTerbaca(total)}) dibongkar: ${kelompok.length} mahasiswa. ` +
        `${dibuat} kiriman baru tersimpan sebagai .md${dikenali ? `, ${dikenali} sudah ada (berkasnya dipakai untuk lampiran visual)` : ""}. ` +
        "Periksa nama dan NIM sebelum menilai.",
      );
      void muatDaftar(tugas.id);
    } catch (e) {
      setGalat(pesanGalat(e, "Berkas gagal dibaca."));
    } finally {
      setSibuk("");
    }
  }

  async function muatUlangKiriman() {
    if (!tugas) return;
    setSibuk("muat");
    await muatTugas(tugas.id);
    setSibuk("");
  }

  function gantiBaris(k: KirimanKlien) {
    setKiriman((s) => s.map((x) => (x.id === k.id ? { ...k, hasil: k.hasil } : x)));
  }

  async function ubahIdentitas(id: number, isi: { nama?: string; nim?: string }) {
    try {
      const d = await minta<{ kiriman: KirimanKlien }>("/api/cbt/tugas/kiriman", {
        method: "POST", body: JSON.stringify({ aksi: "identitas", id, ...isi }),
      });
      gantiBaris(d.kiriman);
    } catch (e) {
      setGalat(pesanGalat(e, "Nama/NIM belum tersimpan."));
    }
  }

  async function hapusKiriman(ids: number[], pesan: string) {
    if (!tugas || !ids.length || !window.confirm(pesan)) return;
    setSibuk("hapus");
    try {
      const d = await minta<{ dihapus: number; kiriman: KirimanKlien[]; pasangan: PasanganKlien[] }>("/api/cbt/tugas/kiriman", {
        method: "DELETE", body: JSON.stringify({ tugas: tugas.id, ids }),
      });
      ids.forEach((id) => berkasSesi.current.delete(id));
      setKiriman(d.kiriman);
      setPasangan(d.pasangan);
      setKabar(`${d.dihapus} kiriman dihapus.`);
      void muatDaftar(tugas.id);
    } catch (e) {
      setGalat(pesanGalat(e, "Kiriman belum dapat dihapus."));
    } finally {
      setSibuk("");
    }
  }

  async function unduhMd(k: KirimanKlien) {
    try {
      const d = await minta<{ kiriman: KirimanKlien & { markdown: string } }>(`/api/cbt/tugas/kiriman?id=${k.id}`);
      unduh(kepalaMd(d.kiriman, tugas) + d.kiriman.markdown, `${namaAman(`${k.kode}_${k.nama || "Mahasiswa"}_${k.nim}`)}.md`, "text/markdown");
    } catch (e) {
      setGalat(pesanGalat(e, "Isi .md belum dapat diunduh."));
    }
  }

  // ---------- GERBANG PLAGIASI ----------

  async function cekPlagiasi(diam = false) {
    if (!tugas) return null;
    if (!diam) setSibuk("plagiasi");
    try {
      const d = await minta<{ ringkas: { pasangan: number; ditandai: number; umum: number; baru: number }; kiriman: KirimanKlien[]; pasangan: PasanganKlien[] }>(
        "/api/cbt/tugas/plagiasi", { method: "POST", body: JSON.stringify({ tugas: tugas.id }) },
      );
      setKiriman(d.kiriman);
      setPasangan(d.pasangan);
      if (!diam) {
        setKabar(
          d.ringkas.ditandai
            ? `Gerbang plagiasi: ${d.ringkas.ditandai} kiriman terindikasi plagiasi (≥ ${tugas.ambangTinggi}%). Tinjau sebelum menilai atau menerbitkan.`
            : `Gerbang plagiasi: tidak ada kiriman yang terindikasi plagiasi (${d.ringkas.pasangan} pasangan bermiripan rendah dicatat).`,
        );
      }
      return d.ringkas;
    } catch (e) {
      setGalat(pesanGalat(e, "Plagiasi belum dapat diperiksa."));
      return null;
    } finally {
      if (!diam) setSibuk("");
    }
  }

  async function putuskan(id: number, putusan: "" | "lolos" | "plagiasi") {
    try {
      const d = await minta<{ kiriman: KirimanKlien }>("/api/cbt/tugas/kiriman", {
        method: "POST", body: JSON.stringify({ aksi: "putuskan", id, putusan }),
      });
      gantiBaris(d.kiriman);
    } catch (e) {
      setGalat(pesanGalat(e, "Putusan belum tersimpan."));
    }
  }

  async function bandingkan(p: PasanganKlien) {
    try {
      const d = await minta<Omit<Banding, "skor">>(`/api/cbt/tugas/plagiasi?a=${p.a}&b=${p.b}`);
      setBanding({ ...d, skor: p.skor });
    } catch (e) {
      setGalat(pesanGalat(e, "Pasangan belum dapat dibandingkan."));
    }
  }

  // ---------- PENILAIAN ----------

  const setProsesSatu = (id: number, p: Proses | null) =>
    setProses((s) => { const salin = { ...s }; if (p) salin[id] = p; else delete salin[id]; return salin; });

  /** Nilai satu kiriman tersimpan. Mengembalikan ringkasan untuk layar uji. */
  async function nilaiSatu(id: number): Promise<UjiTampil> {
    const k = kirimanRef.current.find((x) => x.id === id);
    if (!k) throw new Error("Kiriman tidak ditemukan.");
    const berkas = berkasSesi.current.get(id) ?? [];
    setProsesSatu(id, { status: "membaca" });
    let lampiran: Lampiran[] = [];
    let keterangan = "";
    if (berkas.length) {
      const siap = await siapkanKiriman({ id: String(id), sumber: k.berkas, nama: k.nama, nim: k.nim, berkas }, alatGambarPeramban());
      lampiran = siap.lampiran;
      keterangan = siap.keteranganLampiran;
    }
    setProsesSatu(id, { status: "menilai" });
    const susun = () => JSON.stringify({ aksi: "nilai", kiriman: id, lampiran, keteranganLampiran: lampiran.length ? keterangan : "" });
    let badan = susun();
    // Batas unggah fungsi serverless 4,5 MB: lampiran terbesar dilepas lebih dulu.
    while (badan.length > 4_400_000 && lampiran.length) {
      const terbesar = lampiran.reduce((m, l, i) => (l.data.length > lampiran[m].data.length ? i : m), 0);
      lampiran = lampiran.filter((_, i) => i !== terbesar);
      badan = susun();
    }
    const tampil: UjiTampil = {
      nama: k.nama || k.kode,
      permintaan: {
        teks: k.panjang,
        lampiran: lampiran.map((l) => `${l.nama ?? l.jenis} (${l.jenis}, ${ukuranTerbaca(Math.round(l.data.length * 0.75))})`),
        keterangan: lampiran.length ? keterangan : "Isi .md tersimpan (tanpa lampiran visual).",
        ukuranKb: Math.round(badan.length / 1024),
      },
    };

    let terakhir = "";
    for (let coba = 0; coba < 4; coba += 1) {
      if (berhenti.current && coba > 0) break;
      try {
        const jawab = await fetch("/api/cbt/tugas", { method: "POST", headers: { "Content-Type": "application/json" }, body: badan });
        const d = await jawab.json().catch(() => ({ success: false, message: `Server menjawab ${jawab.status}.` }));
        if (jawab.ok && d.success) {
          gantiBaris(d.kiriman);
          setProsesSatu(id, null);
          return { ...tampil, hasil: d.hasil, status: jawab.status };
        }
        if (jawab.status === 409 && d.ditahan) {
          // Gerbang plagiasi: tidak dinilai, dan tidak memakai kuota AI.
          if (d.kiriman) gantiBaris(d.kiriman);
          setProsesSatu(id, null);
          return { ...tampil, galat: d.message, status: 409 };
        }
        terakhir = d.message || `Server menjawab ${jawab.status}.`;
        tampil.status = jawab.status;
        if ([429, 502, 503, 504].includes(jawab.status)) {
          await tunggu([8000, 20_000, 45_000][coba] ?? 45_000);
          continue;
        }
        if (jawab.status === 413 && lampiran.length) {
          lampiran = [];
          badan = susun();
          continue;
        }
        break;
      } catch {
        terakhir = "Sambungan ke server terputus.";
        await tunggu([5000, 15_000, 30_000][coba] ?? 30_000);
      }
    }
    setProsesSatu(id, { status: "gagal", galat: terakhir });
    return { ...tampil, galat: terakhir };
  }

  async function ujiSatu() {
    if (!tugas) return;
    const calon = kiriman.find((k) => k.id === buka) ?? kiriman.find((k) => k.keadaan === "belum") ?? kiriman[0];
    if (!calon) { setGalat("Belum ada kiriman untuk dinilai."); return; }
    setGalat(""); setUji(null); setJalan(true); berhenti.current = false;
    try {
      setUji(await nilaiSatu(calon.id));
    } catch (e) {
      setUji({ nama: calon.nama, permintaan: { teks: 0, lampiran: [], keterangan: "", ukuranKb: 0 }, galat: pesanGalat(e, "Gagal.") });
      setProsesSatu(calon.id, null);
    } finally {
      setJalan(false);
    }
  }

  async function nilaiSemua(ulang = false) {
    if (!tugas) return;
    setGalat(""); setJalan(true); berhenti.current = false;
    // Gerbang dulu: angka kemiripan disegarkan tepat sebelum menilai.
    setKabar("Gerbang plagiasi: memeriksa kemiripan seluruh kiriman…");
    await cekPlagiasi(true);
    const sekarang = kirimanRef.current;
    const antre = sekarang
      .filter((k) => (ulang ? k.keadaan !== "ditahan" : k.keadaan === "belum" || k.status === "gagal"))
      .filter((k) => !(terindikasi({ status: k.statusMirip, skor: k.kemiripan, putusan: k.putusan }) && tugas.tindakan !== "catat"))
      .map((k) => k.id);
    const ditahan = sekarang.filter((k) => terindikasi({ status: k.statusMirip, skor: k.kemiripan, putusan: k.putusan }) && tugas.tindakan !== "catat").length;
    if (!antre.length) {
      setJalan(false);
      setKabar(`Tidak ada yang perlu dinilai${ditahan ? `; ${ditahan} kiriman tertahan gerbang plagiasi` : ""}.`);
      return;
    }
    if (ulang && !window.confirm(`Nilai ulang ${antre.length} kiriman? Hasil dan suntingan sebelumnya akan diganti.`)) { setJalan(false); return; }
    antre.forEach((id) => setProsesSatu(id, { status: "antre" }));
    const sisa = [...antre];
    // Dua sekaligus: cukup cepat, dan tidak menabrak batas per menit kunci Gemini gratis.
    const pekerja = async () => {
      while (sisa.length && !berhenti.current) {
        const id = sisa.shift()!;
        try { await nilaiSatu(id); } catch (e) { setProsesSatu(id, { status: "gagal", galat: pesanGalat(e, "Gagal.") }); }
      }
    };
    await Promise.all([pekerja(), pekerja()]);
    setProses((s) => Object.fromEntries(Object.entries(s).filter(([, p]) => p.status === "gagal")));
    setJalan(false);
    setKabar(berhenti.current
      ? "Penilaian dihentikan."
      : `Penilaian selesai${ditahan ? `; ${ditahan} kiriman tertahan gerbang plagiasi menunggu putusan Anda` : ""}. Periksa baris bertanda ⚠ sebelum menerbitkan.`);
    void muatDaftar(tugas.id);
  }

  // ---------- SUNTING HASIL ----------

  function ubahHasil(id: number, ubah: (h: Hasil) => Hasil) {
    if (!tugas || !boleh.ubah) return;
    let terbaru: Hasil | null = null;
    setKiriman((semua) => semua.map((k) => {
      if (k.id !== id || !k.hasil) return k;
      const h = ubah(k.hasil);
      const hitung = hitungNilaiTugas(tugas.rubrik, h.kriteria.map((x) => x.skor));
      terbaru = { ...h, nilai: hitung.nilai, lengkap: hitung.lengkap };
      return { ...k, hasil: terbaru, nilai: hitung.nilai, disunting: true };
    }));
    const lama = jamHasil.current.get(id);
    if (lama) clearTimeout(lama);
    jamHasil.current.set(id, setTimeout(async () => {
      jamHasil.current.delete(id);
      const h = terbaru ?? kirimanRef.current.find((k) => k.id === id)?.hasil;
      if (!h) return;
      try {
        const d = await minta<{ kiriman: KirimanKlien }>("/api/cbt/tugas/kiriman", {
          method: "POST", body: JSON.stringify({ aksi: "simpan-hasil", id, hasil: h }),
        });
        // Isi yang sedang diketik tidak ditimpa; hanya nilainya yang disegarkan.
        setKiriman((s) => s.map((k) => (k.id === id ? { ...d.kiriman, hasil: k.hasil } : k)));
      } catch (e) {
        setGalat(pesanGalat(e, "Suntingan belum tersimpan."));
      }
    }, 900));
  }

  /** Nilai tanpa AI: dosen mengisi skornya sendiri. */
  function nilaiManual(k: KirimanKlien) {
    if (!tugas) return;
    const kosong: Hasil = {
      gerbang: { lolos: true, alasan: "" }, judul: "", identitas: { nama: "", nim: "" },
      kriteria: tugas.rubrik.kriteria.map((_, i) => ({ urut: i, skor: null, capaian: "" })),
      kelebihan: [], perbaikan: [], catatan: "", bagianTambahan: [], keyakinan: 100, perluDosen: false,
      nilai: 0, lengkap: false, masalah: [], model: "dosen", penyedia: "gemini", versiPerintah: "dosen", ms: 0,
    };
    setKiriman((s) => s.map((x) => (x.id === k.id ? { ...x, hasil: kosong } : x)));
    setBuka(k.id);
  }

  // ---------- UNDUH ----------

  function unduhSatu(k: KirimanKlien) {
    if (!tugas) return;
    const d = dataLaporan(tugas, k);
    unduh(buatLaporanPdf(templateAktif, d, { kaki: kaki(tugas) }) as BlobPart, namaBerkasLaporan(d), "application/pdf");
  }

  async function rekapXlsx(): Promise<Bita> {
    const XLSX = await import("xlsx");
    const t = tugas!;
    const kepala = [
      "No", "Kode Kiriman", "NIM", "Nama", "Asal", ...t.rubrik.kriteria.map((k) => `${k.nama} (${k.bobot}%)`),
      "Nilai AI/Dosen", "Nilai Berlaku", "Predikat", `Di bawah batas kritis ${t.batasKritis}`, "Kemiripan %", "Status Kemiripan",
      "Putusan Plagiasi", "Judul Karya", "Perlu diperiksa", "Disunting dosen", "Model", "Berkas", "Halaman", "Kata",
      "SHA-256 Berkas", "Dikumpulkan", "Dinilai",
    ];
    const isi = kiriman.map((k, i) => {
      const skor = t.rubrik.kriteria.map((_, j) => k.hasil?.kriteria?.[j]?.skor ?? "");
      return [
        i + 1, k.kode, k.nim, k.nama, k.asal === "cbt" ? "CBT" : "Impor dosen", ...skor,
        k.nilai ?? "", k.nilaiBerlaku ?? (k.keadaan === "ditahan" ? "ditahan" : ""),
        k.nilaiBerlaku !== null ? predikatTugas(k.nilaiBerlaku, t.skala).huruf : "",
        nilaiKritis(k.nilaiBerlaku, t.batasKritis) ? "ya" : "", k.kemiripan, k.statusMirip, k.putusan,
        k.hasil?.judul ?? "", k.hasil?.perluDosen && !k.disunting ? "ya" : "", k.disunting ? "ya" : "",
        k.hasil?.model ?? "", k.berkas, k.halaman, k.kata, k.sidik, k.dikumpulkan ?? "", k.dinilai ?? "",
      ];
    });
    const lembar = XLSX.utils.aoa_to_sheet([kepala, ...isi]);
    const buku = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(buku, lembar, "Rekap Nilai");
    const pasang = pasangan.map((p) => {
      const a = kiriman.find((k) => k.id === p.a);
      const b = kiriman.find((k) => k.id === p.b);
      return [a?.kode ?? p.a, a?.nama ?? "", b?.kode ?? p.b, b?.nama ?? "", p.skor, p.bagianA, p.bagianB, p.status];
    });
    XLSX.utils.book_append_sheet(buku, XLSX.utils.aoa_to_sheet([
      ["Kode A", "Nama A", "Kode B", "Nama B", "Kemiripan %", "Isi A yang sama %", "Isi B yang sama %", "Status"], ...pasang,
    ]), "Plagiasi");
    return new Uint8Array(XLSX.write(buku, { type: "array", bookType: "xlsx" }) as ArrayBuffer) as Bita;
  }

  const judulBerkas = (t: TugasKlien) =>
    namaAman(t.nomor ? `TUGAS_${t.nomor}_${t.mataKuliah}` : (t.nama || t.mataKuliah || "TUGAS")).replace(/\s+/g, "_");

  async function unduhRekap() {
    if (!tugas) return;
    unduh(await rekapXlsx(), `REKAP_NILAI_${judulBerkas(tugas)}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  /** Isi .md seluruh kiriman, diambil berkelompok (jawaban server ± 3 MB). */
  async function ambilSemuaMd(t: TugasKlien): Promise<Map<number, string>> {
    const hasil = new Map<number, string>();
    let antre = kiriman.map((k) => k.id);
    for (let putaran = 0; antre.length && putaran < 200; putaran += 1) {
      const kini = antre.slice(0, 400);
      const d = await minta<{ isi: Array<{ id: number; markdown: string }>; sisa: number[] }>(
        `/api/cbt/tugas/kiriman?tugas=${t.id}&ids=${kini.join(",")}`,
      );
      d.isi.forEach((x) => hasil.set(x.id, x.markdown));
      antre = [...d.sisa, ...antre.slice(400)];
      if (!d.isi.length) break;
      setKabar(`Mengambil isi .md: ${hasil.size} dari ${kiriman.length}…`);
    }
    return hasil;
  }

  /** Zip laporan PDF saja, ditambah rekap (seperti v53). */
  async function unduhSemuaPdf() {
    if (!tugas) return;
    const dinilai = kiriman.filter((k) => k.keadaan === "dinilai");
    if (!dinilai.length) return;
    setSibuk("zip");
    try {
      const isi: Array<{ nama: string; data: Bita }> = [];
      const dipakai = new Set<string>();
      for (const k of dinilai) {
        const d = dataLaporan(tugas, k);
        const dasar = namaBerkasLaporan(d);
        let nama = dasar;
        for (let n = 2; dipakai.has(nama); n += 1) nama = dasar.replace(/\.pdf$/, `_(${n}).pdf`);
        dipakai.add(nama);
        isi.push({ nama, data: buatLaporanPdf(templateAktif, d, { kaki: kaki(tugas) }) as Bita });
      }
      isi.push({ nama: "REKAP_NILAI.xlsx", data: await rekapXlsx() });
      unduh(buatZip(isi), `LAPORAN_PENILAIAN_${judulBerkas(tugas)}.zip`, "application/zip");
    } finally {
      setSibuk("");
    }
  }

  /** Arsip lengkap untuk Google Drive: laporan, kiriman .md, rekap, plagiasi, README. */
  async function unduhArsip() {
    if (!tugas) return;
    setSibuk("arsip");
    setGalat("");
    try {
      const md = await ambilSemuaMd(tugas);
      const isi: Array<{ nama: string; data: Bita }> = [];
      const dipakai = new Set<string>();
      const unik = (nama: string) => {
        let n = nama;
        for (let i = 2; dipakai.has(n); i += 1) n = nama.replace(/(\.[a-z]+)$/, `_(${i})$1`);
        dipakai.add(n);
        return n;
      };
      for (const k of kiriman) {
        isi.push({
          nama: unik(`kiriman/${namaAman(`${k.kode}_${k.nama || "Mahasiswa"}_${k.nim}`)}.md`),
          data: utf8(kepalaMd(k, tugas) + (md.get(k.id) ?? "")),
        });
        if (k.keadaan === "dinilai") {
          const d = dataLaporan(tugas, k);
          isi.push({ nama: unik(`laporan/${namaBerkasLaporan(d)}`), data: buatLaporanPdf(templateAktif, d, { kaki: kaki(tugas) }) as Bita });
        }
      }
      isi.push({ nama: "REKAP_NILAI.xlsx", data: await rekapXlsx() });
      isi.push({ nama: "PLAGIASI.csv", data: utf8(csvPlagiasi(pasangan, kiriman)) });
      isi.push({ nama: "RUBRIK_DAN_TEMPLATE.md", data: utf8(rubrikMd(tugas, templateAktif)) });
      isi.unshift({ nama: "BACA-DULU.md", data: utf8(readmeArsip(tugas, kiriman, pasangan)) });
      unduh(buatZip(isi), `ARSIP_${judulBerkas(tugas)}_${new Date().toISOString().slice(0, 10)}.zip`, "application/zip");
      setKabar("Arsip lengkap diunduh. Taruh di Google Drive, lalu simpan tautannya di bawah supaya tercatat di Arsip Drive.");
    } catch (e) {
      setGalat(pesanGalat(e, "Arsip belum dapat disusun."));
    } finally {
      setSibuk("");
    }
  }

  // ---------- TAMPILAN ----------

  if (daftar === null) return <div className="dempty">Memuat…</div>;

  const tautanKumpul = tugas ? (asal.cbt ? `${asal.cbt}/tugas?kode=${tugas.kode}` : `${asal.portal}/cbt/tugas?kode=${tugas.kode}`) : "";
  const tautanPapan = tugas ? (asal.cbt ? `${asal.cbt}/papan?tugas=${tugas.id}` : `${asal.portal}/cbt/papan?tugas=${tugas.id}`) : "";

  return (
    <div className="pt">
      <p className="cbtv-cara-baca">
        Mahasiswa mengumpulkan tugas (PDF) sendiri lewat CBT dan langsung menerima kode SIPALING-TUGAS untuk melacak
        nilainya. Setiap kiriman disimpan sebagai teks .md (PDF-nya tidak disimpan), diperiksa kemiripannya dengan
        kiriman lain, dinilai AI dengan rubrik Anda, lalu diterbitkan di papan nilai CBT. Tugas yang sudah terkumpul di
        Drive tetap dapat diimpor sekaligus.
      </p>

      {siapAi === false && (
        <div className="dsh-error">
          Kunci AI belum terpasang. Minta Super Admin menempelkan kunci Gemini di Dashboard → Kunci AI.
          Pengumpulan, plagiasi, dan penilaian manual tetap dapat dipakai.
        </div>
      )}
      {lokalV53.length > 0 && (
        <div className="cbtv-catatan pt-pindah">
          <b>{lokalV53.length} pengaturan tugas versi lama masih tersimpan di peramban ini</b>
          <span>Pindahkan ke server supaya rubrik dan templatenya dapat dipakai untuk pengumpulan lewat CBT.</span>
          <div className="pt-tombol">
            <button type="button" className="btn btn-primary" disabled={sibuk === "pindah"} onClick={() => void pindahkanV53()}>
              {sibuk === "pindah" ? "Memindahkan…" : "Pindahkan ke server"}
            </button>
            <button type="button" className="btn btn-light" onClick={() => {
              try { localStorage.setItem(KUNCI_V53_PINDAH, "lewati"); } catch { /* diamkan */ }
              setLokalV53([]);
            }}>Abaikan</button>
          </div>
        </div>
      )}
      {kabar && <div className="dsh-ok">{kabar}</div>}
      {galat && <div className="dsh-error">{galat}</div>}

      {/* ---------- PILIH TUGAS ---------- */}
      <div className="panel pt-pilih">
        <label>
          <span>Tugas</span>
          <select value={tugas?.id ?? ""} onChange={(e) => pilihTugas(Number(e.target.value))} disabled={jalan || !daftar.length}>
            {!daftar.length && <option value="">Belum ada tugas</option>}
            {daftar.map((t) => (
              <option key={t.id} value={t.id}>
                {[t.mataKuliah, t.nomor && `Tugas ${t.nomor}`, t.nama].filter(Boolean).join(" · ") || "Tugas tanpa nama"}
                {` · ${t.kode} · ${t.jumlah} kiriman${t.ditandai ? ` · ⚠ ${t.ditandai}` : ""}${t.terbit ? " · terbit" : ""}`}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary" onClick={() => void buatBaru()} disabled={jalan || sibuk === "buat"}>+ Tugas baru</button>
        {tugas && <button type="button" className="btn btn-light" onClick={() => void salinTugas()} disabled={jalan} title="Rubrik, template, dan pengaturan disalin; kiriman tidak">Salin tugas ini</button>}
        {tugas && boleh.hapus && <button type="button" className="btn btn-light" onClick={() => void hapusTugas()} disabled={jalan}>Hapus</button>}
        {simpan && <span className={`pt-simpan ${simpan}`}>{{ menyimpan: "Menyimpan…", tersimpan: "✓ Tersimpan", gagal: "✕ Belum tersimpan" }[simpan]}</span>}
      </div>

      {!tugas && (
        <div className="panel pt-kosong">
          <b>Belum ada tugas.</b>
          <span>Buat tugas pertama: pasang rubrik dan template, lalu bagikan kode pengumpulannya ke kelas.</span>
        </div>
      )}

      {tugas && (<>
        {!boleh.ubah && (
          <div className="cbtv-catatan">
            Tugas ini milik <b>{tugas.pemilik || "pengajar lain"}</b>. Anda dapat memantau, mengunduh, dan menghapusnya, tetapi
            pengaturan dan penilaiannya dipegang pembuatnya.
          </div>
        )}

        <fieldset className="pt-wadah" disabled={!boleh.ubah}>
        {/* ---------- 1. DATA TUGAS ---------- */}
        <section className="panel pt-langkah">
          <h3><span>1</span> Data tugas</h3>
          <div className="pt-isian">
            <label><span>Mata kuliah</span><input value={tugas.mataKuliah} onChange={(e) => ubahTugas({ mataKuliah: e.target.value })} placeholder="Public Relations" /></label>
            <label className="pt-pendek"><span>Tugas ke-</span><input value={tugas.nomor} onChange={(e) => ubahTugas({ nomor: e.target.value })} placeholder="2" /></label>
            <label><span>Nama tugas</span><input value={tugas.nama} onChange={(e) => ubahTugas({ nama: e.target.value })} placeholder="Proposal Program PR & Press Conference" /></label>
            <label><span>Dosen (tercetak di laporan)</span><input value={tugas.dosen} onChange={(e) => ubahTugas({ dosen: e.target.value })} /></label>
            <label className="pt-pendek"><span>Kelas</span><input value={tugas.kelas} onChange={(e) => ubahTugas({ kelas: e.target.value })} placeholder="3A" /></label>
          </div>
          <label className="pt-lebar">
            <span>Petunjuk tugas untuk AI (opsional; kalimatnya juga diabaikan pemeriksa plagiasi)</span>
            <textarea rows={3} value={tugas.petunjuk} onChange={(e) => ubahTugas({ petunjuk: e.target.value })}
              placeholder="Mis. Susun proposal program PR beserta rencana konferensi pers, media kit, dan pitch letter untuk 5 jurnalis." />
          </label>
          <div className="pt-isian">
            <label className="pt-lebar">
              <span>Acuan predikat (batas bawah tiap huruf)</span>
              <input value={teksSkala} onChange={(e) => setTeksSkala(e.target.value)}
                onBlur={() => { const s = uraiSkala(teksSkala); ubahTugas({ skala: s }); setTeksSkala(ejaSkala(s)); }} />
            </label>
            <label className="pt-centang">
              <input type="checkbox" checked={tugas.kakiSpf} onChange={(e) => ubahTugas({ kakiSpf: e.target.checked }, true)} />
              <span>Tulis &ldquo;{KAKI_SPF}&rdquo; di kaki laporan</span>
            </label>
          </div>
        </section>

        {/* ---------- 2. RUBRIK ---------- */}
        <RubrikLangkah
          tugas={tugas} sibuk={sibuk} catatan={catatanRubrik} pustaka={pustaka}
          onUnggah={(f) => void unggahRubrik(f)} onPustaka={() => void muatPustaka()}
          onPilihPustaka={(r) => { ubahTugas({ rubrik: dariRubrikLevel(r) }); setCatatanRubrik([`Diambil dari pustaka: ${r.nama}. Deskriptor level diubah menjadi acuan skor 0–100.`]); setPustaka(null); }}
          onTutupPustaka={() => setPustaka(null)} onUbah={(r) => ubahTugas({ rubrik: r })} onUbahKriteria={ubahKriteria}
        />

        {/* ---------- 3. TEMPLATE ---------- */}
        <section className="panel pt-langkah">
          <h3><span>3</span> Template laporan <em className="pt-oke">{tugas.template ? tugas.namaTemplate || "Template sendiri" : "Template bawaan"}</em></h3>
          <div className="pt-tombol">
            <label className="btn btn-primary">
              {sibuk === "template" ? "Membaca…" : "⇧ Unggah template"}
              <input type="file" hidden accept=".md,.markdown,.txt,.docx,.pdf,.doc,.rtf,.odt" disabled={Boolean(sibuk)}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void unggahTemplate(f); }} />
            </label>
            <button type="button" className="btn btn-light" onClick={() => ubahTugas({ template: "", namaTemplate: "" }, true)}>Pakai template bawaan</button>
            <button type="button" className="btn btn-light" onClick={pratinjauTemplate}>Pratinjau PDF</button>
            <button type="button" className="btn btn-light" onClick={() => unduh(templateAktif, "Template_Laporan_Penilaian.md", "text/markdown")}>⇩ Template (.md)</button>
          </div>
          <ul className="pt-cip">
            {([
              ["tabelInfo", "Tabel informasi"], ["tabelRubrik", "Tabel rubrik"], ["nilaiAkhir", "Nilai akhir"], ["predikat", "Predikat"],
              ["daftarSkor", "Rincian skor"], ["kelebihan", "Kelebihan"], ["perbaikan", "Perlu ditingkatkan"], ["catatan", "Catatan/saran"],
            ] as const).map(([k, label]) => (
              <li key={k} className={analisis[k] ? "ada" : ""}>{analisis[k] ? "✓" : "＋"} {label}</li>
            ))}
            {analisis.bagianBebas.map((j) => <li key={j} className="ada">✓ {j} (diisi AI)</li>)}
          </ul>
          <p className="cbt-catatan">
            Laporan PDF bergaya resmi: pita biru tua berisi kode kiriman di tiap halaman, tabel berkepala, dan nilai akhir
            dalam kotak sorot. Bagian bertanda ＋ tidak ada di template dan akan ditambahkan di akhir. Penanda {"{{nama}}"}, {"{{nim}}"},
            {" {{nilai}}"}, {"{{predikat}}"}, {"{{kode}}"}, atau [Nama Mahasiswa] di template juga diisi.
          </p>
        </section>

        {/* ---------- 4. PENGUMPULAN ---------- */}
        <section className="panel pt-langkah">
          <h3><span>4</span> Pengumpulan tugas {kiriman.length > 0 && <em className="pt-oke">{kiriman.length} kiriman</em>}</h3>
          <div className="pt-kumpul">
            <div className="pt-kode">
              <small>Kode pengumpulan</small>
              <b>{tugas.kode}</b>
              <span className={tugas.terbuka ? "pt-oke" : "pt-kurang"}>{tugas.terbuka ? "Dibuka" : "Ditutup"}</span>
            </div>
            <div className="pt-kumpul-atur">
              <label className="pt-centang">
                <input type="checkbox" checked={tugas.terbuka} onChange={(e) => void ubahTugas({ terbuka: e.target.checked }, true)} />
                <span>Buka pengumpulan lewat CBT (mahasiswa mengunggah PDF sendiri)</span>
              </label>
              <label>
                <span>Batas waktu (opsional)</span>
                <input type="datetime-local" value={keInputWaktu(tugas.tenggat)}
                  onChange={(e) => void ubahTugas({ tenggat: e.target.value ? new Date(e.target.value).toISOString() : null }, true)} />
              </label>
              <div className="pt-tautan">
                <code>{tautanKumpul}</code>
                <button type="button" className="btn btn-light btn-mini" onClick={() => { void navigator.clipboard?.writeText(tautanKumpul); setKabar("Tautan pengumpulan disalin."); }}>Salin tautan</button>
              </div>
              <small className="cbt-catatan">
                Bagikan kode atau tautan ini ke grup kelas. Tiap mahasiswa yang mengumpulkan langsung menerima kode
                SIPALING-TUGAS-XXXXXXXX. PDF-nya disusun menjadi .md di ponsel/laptop mahasiswa; hanya teksnya yang tersimpan.
              </small>
            </div>
          </div>

          <div
            className="pt-jatuh"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (!sibuk && !jalan) void terimaBerkas(e.dataTransfer.files); }}
          >
            <b>{sibuk === "unggah" ? "Membongkar dan menyusun .md…" : "Impor tugas yang sudah ada di Drive"}</b>
            <span>Tarik zip/rar unduhan Google Drive, PDF, Word, Excel, PowerPoint, atau gambar ke sini. Setiap mahasiswa menjadi satu kiriman .md dengan kodenya sendiri.</span>
            <div className="pt-tombol">
              <label className="btn btn-primary">
                Pilih berkas
                <input type="file" hidden multiple accept={TERIMA} disabled={Boolean(sibuk) || jalan}
                  onChange={(e) => { const f = e.target.files; if (f) void terimaBerkas(Array.from(f)); e.target.value = ""; }} />
              </label>
              <label className="btn btn-light">
                Pilih map
                <input type="file" hidden multiple disabled={Boolean(sibuk) || jalan}
                  {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                  onChange={(e) => { const f = e.target.files; if (f) void terimaBerkas(Array.from(f)); e.target.value = ""; }} />
              </label>
              <button type="button" className="btn btn-light" disabled={sibuk === "muat" || jalan} onClick={() => void muatUlangKiriman()}>
                {sibuk === "muat" ? "Memuat…" : "↻ Muat kiriman terbaru"}
              </button>
            </div>
          </div>
          {peringatan.length > 0 && (
            <div className="cbtv-catatan"><b>Catatan pembacaan berkas</b><ul>{peringatan.slice(0, 40).map((p, i) => <li key={`${p}-${i}`}>{p}</li>)}</ul></div>
          )}
        </section>
        </fieldset>

        {/* ---------- 5. PENILAIAN ---------- */}
        <LangkahPenilaian
          tugas={tugas} kiriman={kiriman} pasangan={pasangan} proses={proses} boleh={boleh} siapAi={siapAi}
          jalan={jalan} sibuk={sibuk} buka={buka} uji={uji} banding={banding}
          onAtur={(u) => void ubahTugas(u, true)}
          onCekPlagiasi={() => void cekPlagiasi()} onUji={() => void ujiSatu()} onNilaiSemua={(u) => void nilaiSemua(u)}
          onHentikan={() => { berhenti.current = true; }}
          onUnduhSemuaPdf={() => void unduhSemuaPdf()} onUnduhRekap={() => void unduhRekap()}
          onTutupUji={() => setUji(null)} onBuka={setBuka} onPutuskan={(id, p) => void putuskan(id, p)}
          onBandingkan={(p) => void bandingkan(p)} onTutupBanding={() => setBanding(null)}
          onNilaiSatu={(id) => {
            setJalan(true); berhenti.current = false;
            void nilaiSatu(id).catch((e) => setProsesSatu(id, { status: "gagal", galat: pesanGalat(e, "Gagal.") })).finally(() => setJalan(false));
          }}
          onNilaiManual={nilaiManual} onPdf={unduhSatu} onMd={(k) => void unduhMd(k)}
          onHapus={(k) => void hapusKiriman([k.id], `Hapus kiriman ${k.kode} (${k.nama || "tanpa nama"}) beserta nilainya?`)}
          onIdentitas={(id, isi) => void ubahIdentitas(id, isi)} onUbahHasil={ubahHasil}
          adaBerkasSesi={(id) => berkasSesi.current.has(id)}
        />

        {/* ---------- 6. TERBITKAN & ARSIPKAN ---------- */}
        <section className="panel pt-langkah">
          <h3><span>6</span> Terbitkan & arsipkan</h3>
          <div className="pt-terbit">
            <div>
              <b>Papan nilai CBT</b>
              <p className="cbt-catatan">
                Seluruh nilai tampil di papan nilai CBT seperti mading, diurutkan dari tertinggi. Nilai di bawah batas kritis
                ({tugas.batasKritis}) merah dan diberi keterangan, kiriman yang terindikasi plagiasi ditandai, dan isi
                keterangannya hanya terbuka dengan kode SIPALING-TUGAS pemiliknya.
              </p>
              <label className="pt-centang">
                <input type="checkbox" checked={tugas.terbit} disabled={!boleh.ubah}
                  onChange={(e) => {
                    const terbit = e.target.checked;
                    const tertunda = kiriman.filter((k) => k.keadaan !== "dinilai").length;
                    if (terbit && tertunda && !window.confirm(`${tertunda} kiriman belum bernilai (belum dinilai atau ditahan gerbang plagiasi). Tetap terbitkan?`)) return;
                    void ubahTugas({ terbit } as Partial<TugasKlien>, true);
                  }} />
                <span>Terbitkan nilai tugas ini di papan nilai CBT</span>
              </label>
              {tugas.terbit && (
                <div className="pt-tautan">
                  <code>{tautanPapan}</code>
                  <button type="button" className="btn btn-light btn-mini" onClick={() => { void navigator.clipboard?.writeText(tautanPapan); setKabar("Tautan papan nilai disalin."); }}>Salin</button>
                  <a className="btn btn-light btn-mini" href={tautanPapan} target="_blank" rel="noreferrer">Buka</a>
                </div>
              )}
            </div>
            <div>
              <b>Arsip untuk Google Drive</b>
              <p className="cbt-catatan">
                Satu zip berisi laporan PDF tiap mahasiswa, kiriman .md, rekap nilai (.xlsx), rekap plagiasi (.csv), rubrik
                dan template, serta BACA-DULU.md. Taruh di Drive, lalu simpan tautannya sebagai Arsip Drive (tautan pendek).
              </p>
              <div className="pt-tombol">
                <button type="button" className="btn btn-primary" disabled={!kiriman.length || sibuk === "arsip"} onClick={() => void unduhArsip()}>
                  {sibuk === "arsip" ? "Menyusun arsip…" : `⇩ Arsip lengkap (.zip, ${kiriman.length} kiriman)`}
                </button>
              </div>
              <SimpanArsipDrive tugasId={tugas.id} judulAwal={`Arsip ${[tugas.mataKuliah, tugas.nomor && `Tugas ${tugas.nomor}`, tugas.nama].filter(Boolean).join(" · ")}`} />
            </div>
          </div>
          {boleh.hapus && (
            <div className="pt-bahaya">
              <b>Hapus dari portal</b>
              <span>Sesudah diarsipkan, isi tugas boleh dihapus supaya tidak memakan penyimpanan. Tautan Arsip Drive tetap ada.</span>
              <div className="pt-tombol">
                <button type="button" className="btn btn-light" disabled={!kiriman.length || jalan || sibuk === "hapus"}
                  onClick={() => void hapusKiriman(kiriman.map((k) => k.id), `Hapus SEMUA ${kiriman.length} kiriman beserta nilainya? Pengaturan tugas tetap ada.`)}>
                  Hapus semua kiriman
                </button>
                <button type="button" className="btn btn-gagal" disabled={jalan} onClick={() => void hapusTugas()}>Hapus tugas ini</button>
              </div>
            </div>
          )}
        </section>
      </>)}
    </div>
  );
}

// ------------------------------------------------------------
// ISI ARSIP
// ------------------------------------------------------------

const yaml = (s: string) => `"${String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;

/** Kepala YAML tiap berkas .md di arsip: siapa, kapan, dan sidik berkas aslinya. */
function kepalaMd(k: KirimanKlien, t: TugasKlien | null): string {
  const baris = [
    "---",
    `kode: ${k.kode}`,
    `nama: ${yaml(k.nama)}`,
    `nim: ${yaml(k.nim)}`,
    t ? `tugas: ${yaml([t.mataKuliah, t.nomor && `Tugas ${t.nomor}`, t.nama].filter(Boolean).join(" · "))}` : null,
    `asal: ${k.asal === "cbt" ? "dikumpulkan lewat CBT" : "diimpor dosen"}`,
    `berkas: ${yaml(k.berkas)}`,
    `halaman: ${k.halaman}`,
    `kata: ${k.kata}`,
    k.sidik ? `sha256: ${k.sidik}` : null,
    `dikumpulkan: ${k.dikumpulkan ?? ""}`,
    `kemiripan: ${yaml(`${k.kemiripan}% (${k.statusMirip}${k.putusan ? `, putusan dosen: ${k.putusan}` : ""})`)}`,
    `nilai: ${k.nilaiBerlaku ?? (k.keadaan === "ditahan" ? "ditahan" : "belum dinilai")}`,
    "---",
  ].filter((b): b is string => b !== null);
  return `${baris.join("\n")}\n\n`;
}

function csvPlagiasi(pasangan: PasanganKlien[], kiriman: KirimanKlien[]): string {
  const sel = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const baris = [["Kode A", "Nama A", "NIM A", "Kode B", "Nama B", "NIM B", "Kemiripan %", "Isi A yang sama %", "Isi B yang sama %", "Status", "Berkas identik"]];
  for (const p of pasangan) {
    const a = kiriman.find((k) => k.id === p.a);
    const b = kiriman.find((k) => k.id === p.b);
    baris.push([a?.kode ?? "", a?.nama ?? "", a?.nim ?? "", b?.kode ?? "", b?.nama ?? "", b?.nim ?? "",
      String(p.skor), String(p.bagianA), String(p.bagianB), p.status, String((p.sinyal as { kembar?: string }).kembar ?? "")]);
  }
  return "﻿" + baris.map((r) => r.map(sel).join(",")).join("\r\n") + "\r\n";
}

function rubrikMd(t: TugasKlien, template: string): string {
  const baris = t.rubrik.kriteria.map((k, i) => `| ${i + 1}. ${k.nama.replace(/\|/g, "\\|")} | ${k.bobot}% | ${k.deskripsi.replace(/\n/g, "<br>").replace(/\|/g, "\\|")} |`);
  return [
    `# Rubrik: ${t.rubrik.nama || "(tanpa nama)"}`, "",
    "| Kriteria | Bobot | Deskripsi / acuan skor |", "| --- | --- | --- |", ...baris, "",
    `Acuan predikat: ${ejaSkala(t.skala)}`, `Batas kritis nilai: ${t.batasKritis}`,
    `Ambang plagiasi: perlu ditinjau ≥ ${t.ambangTinjau}%, terindikasi ≥ ${t.ambangTinggi}% (${TINDAKAN_LABEL[t.tindakan]})`, "",
    "---", "", "# Template laporan", "", template,
  ].join("\n");
}

function readmeArsip(t: TugasKlien, kiriman: KirimanKlien[], pasangan: PasanganKlien[]): string {
  const dinilai = kiriman.filter((k) => k.keadaan === "dinilai");
  const kritis = dinilai.filter((k) => nilaiKritis(k.nilaiBerlaku, t.batasKritis)).length;
  const ditandai = kiriman.filter((k) => terindikasi({ status: k.statusMirip, skor: k.kemiripan, putusan: k.putusan })).length;
  return [
    `# Arsip penilaian: ${[t.mataKuliah, t.nomor && `Tugas ${t.nomor}`, t.nama].filter(Boolean).join(" · ")}`,
    "",
    `Disusun menggunakan Software SPF (SiPaling FISIP) pada ${new Date().toLocaleString("id-ID")}.`,
    "",
    `- Kode pengumpulan: ${t.kode}`,
    `- Dosen: ${t.dosen || "-"}`,
    `- Kiriman: ${kiriman.length} (dinilai ${dinilai.length}, di bawah batas kritis ${t.batasKritis}: ${kritis})`,
    `- Terindikasi plagiasi: ${ditandai} kiriman, ${pasangan.length} pasangan bermiripan tercatat`,
    "",
    "## Isi arsip",
    "",
    "- `laporan/` laporan penilaian PDF tiap mahasiswa yang sudah bernilai",
    "- `kiriman/` isi tiap kiriman sebagai Markdown (.md), dengan kepala berisi kode, identitas, dan SHA-256 berkas asli",
    "- `REKAP_NILAI.xlsx` rekap nilai tiap kriteria dan lembar Plagiasi",
    "- `PLAGIASI.csv` pasangan kiriman yang mirip",
    "- `RUBRIK_DAN_TEMPLATE.md` rubrik, acuan predikat, ambang, dan template laporan yang dipakai",
    "",
    "## Memeriksa keaslian PDF bila nilai dipersoalkan",
    "",
    "PDF mahasiswa tidak disimpan portal. Yang tersimpan adalah teksnya (.md) dan sidik SHA-256 berkas aslinya. Bila",
    "mahasiswa menunjukkan PDF-nya, hitung sidiknya (`sha256sum berkas.pdf`, atau `certutil -hashfile berkas.pdf SHA256`",
    "di Windows) dan cocokkan dengan baris `sha256` di kepala .md-nya. Sama berarti berkasnya persis yang dulu dikumpulkan.",
    "",
  ].join("\n");
}

// ------------------------------------------------------------
// LANGKAH 2: RUBRIK
// ------------------------------------------------------------

function RubrikLangkah({ tugas, sibuk, catatan, pustaka, onUnggah, onPustaka, onPilihPustaka, onTutupPustaka, onUbah, onUbahKriteria }: {
  tugas: TugasKlien; sibuk: string; catatan: string[]; pustaka: Array<Rubrik & { id?: number }> | null;
  onUnggah: (f: File) => void; onPustaka: () => void; onPilihPustaka: (r: Rubrik) => void; onTutupPustaka: () => void;
  onUbah: (r: RubrikTugas) => void; onUbahKriteria: (i: number, u: Partial<RubrikTugas["kriteria"][number]>) => void;
}) {
  const cek = periksaRubrikTugas(tugas.rubrik);
  const jumlahBobot = tugas.rubrik.kriteria.reduce((n, k) => n + k.bobot, 0);
  return (
    <section className="panel pt-langkah">
      <h3><span>2</span> Rubrik tugas {cek.ok ? <em className="pt-oke">siap</em> : <em className="pt-kurang">belum siap</em>}</h3>
      <div className="pt-tombol">
        <label className="btn btn-primary">
          {sibuk === "rubrik" ? "Membaca…" : "⇧ Unggah rubrik"}
          <input type="file" hidden accept=".xlsx,.xls,.csv,.docx,.doc,.pdf,.txt,.md,.rtf,.odt,.pptx"
            disabled={Boolean(sibuk)} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUnggah(f); }} />
        </label>
        <button type="button" className="btn btn-light" onClick={onPustaka} disabled={Boolean(sibuk)}>Ambil dari pustaka rubrik CBT</button>
        <button type="button" className="btn btn-light" onClick={() => onUbah({ ...tugas.rubrik, kriteria: [...tugas.rubrik.kriteria, { nama: "", bobot: 0, deskripsi: "" }] })}>+ Kriteria</button>
        <button type="button" className="btn btn-light" disabled={!tugas.rubrik.kriteria.length}
          onClick={() => onUbah({ ...tugas.rubrik, kriteria: rapikanBobot(tugas.rubrik.kriteria.map((k) => ({ ...k, bobot: 0 }))).kriteria })}>Ratakan bobot</button>
      </div>
      <p className="cbt-catatan">
        Excel/Word dengan tabel berkolom <b>Kriteria</b> (dan <b>Bobot</b>) langsung terbaca; template rubrik CBT juga.
        PDF atau teks bebas disusun AI. Kolom deskripsi boleh memuat pita skor, mis. &ldquo;85–100: …&rdquo;.
      </p>
      {pustaka && (
        <div className="pt-pustaka">
          <select defaultValue="" onChange={(e) => { const r = pustaka[Number(e.target.value)]; if (r) onPilihPustaka(r); }}>
            <option value="" disabled>Pilih rubrik…</option>
            {pustaka.map((r, i) => <option key={`${r.nama}-${i}`} value={i}>{r.nama} ({r.kriteria.length} kriteria)</option>)}
          </select>
          <button type="button" className="btn btn-light btn-mini" onClick={onTutupPustaka}>Tutup</button>
        </div>
      )}
      {catatan.length > 0 && (
        <div className="cbtv-catatan"><b>Yang perlu Anda periksa</b><ul>{catatan.map((c) => <li key={c}>{c}</li>)}</ul></div>
      )}
      <label className="pt-lebar"><span>Nama rubrik</span>
        <input value={tugas.rubrik.nama} onChange={(e) => onUbah({ ...tugas.rubrik, nama: e.target.value })} />
      </label>
      {tugas.rubrik.kriteria.length > 0 && (
        <div className="pt-tabel-wadah">
          <table className="pt-tabel">
            <thead><tr><th>#</th><th>Kriteria</th><th>Bobot %</th><th>Deskripsi / acuan skor</th><th /></tr></thead>
            <tbody>
              {tugas.rubrik.kriteria.map((k, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><input value={k.nama} onChange={(e) => onUbahKriteria(i, { nama: e.target.value })} /></td>
                  <td><input type="number" min={0} max={100} value={k.bobot} onChange={(e) => onUbahKriteria(i, { bobot: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })} /></td>
                  <td><textarea rows={2} value={k.deskripsi} onChange={(e) => onUbahKriteria(i, { deskripsi: e.target.value })} /></td>
                  <td><button type="button" className="btn btn-light btn-mini" onClick={() => onUbah({ ...tugas.rubrik, kriteria: tugas.rubrik.kriteria.filter((_, j) => j !== i) })}>✕</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td /><td>Jumlah bobot</td><td className={jumlahBobot === 100 ? "pt-oke" : "pt-kurang"}>{jumlahBobot}%</td><td colSpan={2}>{!cek.ok && cek.pesan}</td></tr></tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------
// LANGKAH 5: PENILAIAN AI & LAPORAN PDF
// ------------------------------------------------------------

type SifatPenilaian = {
  tugas: TugasKlien; kiriman: KirimanKlien[]; pasangan: PasanganKlien[]; proses: Record<number, Proses>;
  boleh: { ubah: boolean; hapus: boolean }; siapAi: boolean | null; jalan: boolean; sibuk: string; buka: number | null;
  uji: UjiTampil | null; banding: Banding | null;
  onAtur: (u: Partial<TugasKlien>) => void; onCekPlagiasi: () => void; onUji: () => void; onNilaiSemua: (ulang: boolean) => void;
  onHentikan: () => void; onUnduhSemuaPdf: () => void; onUnduhRekap: () => void; onTutupUji: () => void;
  onBuka: (id: number | null) => void; onPutuskan: (id: number, p: "" | "lolos" | "plagiasi") => void;
  onBandingkan: (p: PasanganKlien) => void; onTutupBanding: () => void; onNilaiSatu: (id: number) => void;
  onNilaiManual: (k: KirimanKlien) => void; onPdf: (k: KirimanKlien) => void; onMd: (k: KirimanKlien) => void;
  onHapus: (k: KirimanKlien) => void; onIdentitas: (id: number, isi: { nama?: string; nim?: string }) => void;
  onUbahHasil: (id: number, f: (h: Hasil) => Hasil) => void; adaBerkasSesi: (id: number) => boolean;
};

function LangkahPenilaian(p: SifatPenilaian) {
  const { tugas, kiriman, pasangan, proses, boleh } = p;
  const cekRubrik = periksaRubrikTugas(tugas.rubrik);
  const bolehNilai = boleh.ubah && cekRubrik.ok && p.siapAi !== false && !p.jalan;
  const [ambang, setAmbang] = useState({ tinjau: String(tugas.ambangTinjau), tinggi: String(tugas.ambangTinggi), kritis: String(tugas.batasKritis) });
  useEffect(() => {
    const jam = setTimeout(() => setAmbang({ tinjau: String(tugas.ambangTinjau), tinggi: String(tugas.ambangTinggi), kritis: String(tugas.batasKritis) }), 0);
    return () => clearTimeout(jam);
  }, [tugas.id, tugas.ambangTinjau, tugas.ambangTinggi, tugas.batasKritis]);

  const keadaanPlagiasi = (k: KirimanKlien) => ({ status: k.statusMirip, skor: k.kemiripan, putusan: k.putusan });
  const ditandai = kiriman.filter((k) => terindikasi(keadaanPlagiasi(k)));
  const belumDiputus = ditandai.filter((k) => !k.putusan);
  const jumlahDinilai = kiriman.filter((k) => k.keadaan === "dinilai").length;
  const jumlahBelum = kiriman.filter((k) => k.keadaan === "belum" || k.status === "gagal").length;
  const jumlahKritis = kiriman.filter((k) => nilaiKritis(k.nilaiBerlaku, tugas.batasKritis)).length;
  const jumlahPeriksa = kiriman.filter((k) => k.hasil?.perluDosen && !k.disunting).length;
  const prosesJalan = Object.values(proses).filter((x) => x.status !== "gagal").length;
  const hitungNim = new Map<string, number>();
  for (const k of kiriman) if (k.nim) hitungNim.set(k.nim, (hitungNim.get(k.nim) ?? 0) + 1);
  const pasanganTinjau = pasangan.filter((x) => x.skor >= tugas.ambangTinjau);
  const namaDari = (id: number) => kiriman.find((k) => k.id === id);

  return (
    <section className="panel pt-langkah">
      <h3><span>5</span> Penilaian AI & laporan PDF</h3>

      <div className="pt-atur">
        <label>
          <span>Batas kritis nilai (merah di bawah)</span>
          <div className="pt-angka">
            <input type="number" min={0} max={100} value={ambang.kritis} disabled={!boleh.ubah}
              onChange={(e) => setAmbang((a) => ({ ...a, kritis: e.target.value }))}
              onBlur={() => {
                const batas = rapikanBatasKritis(ambang.kritis);
                setAmbang((a) => ({ ...a, kritis: String(batas) }));
                if (batas !== tugas.batasKritis) p.onAtur({ batasKritis: batas });
              }} />
            <b>%</b>
          </div>
          <small>Nilai di bawah angka ini tampil merah di papan nilai dan diberi keterangan untuk pemilik kode.</small>
        </label>
        <label>
          <span>Ambang plagiasi</span>
          <div className="pt-angka">
            <em>tinjau ≥</em>
            <input type="number" min={1} max={99} value={ambang.tinjau} disabled={!boleh.ubah}
              onChange={(e) => setAmbang((a) => ({ ...a, tinjau: e.target.value }))}
              onBlur={() => p.onAtur({ ambangTinjau: Number(ambang.tinjau) || 25, ambangTinggi: Number(ambang.tinggi) || 50 })} />
            <em>% · plagiasi ≥</em>
            <input type="number" min={2} max={100} value={ambang.tinggi} disabled={!boleh.ubah}
              onChange={(e) => setAmbang((a) => ({ ...a, tinggi: e.target.value }))}
              onBlur={() => p.onAtur({ ambangTinjau: Number(ambang.tinjau) || 25, ambangTinggi: Number(ambang.tinggi) || 50 })} />
            <b>%</b>
          </div>
          <small>Persen isi yang sama persis (lima kata berturut-turut) dengan kiriman lain; templat bersama diabaikan.</small>
        </label>
        <label>
          <span>Bila terindikasi plagiasi (gerbang)</span>
          <select value={tugas.tindakan} disabled={!boleh.ubah} onChange={(e) => p.onAtur({ tindakan: e.target.value as TindakanPlagiasi })}>
            {TINDAKAN_PLAGIASI.map((t) => <option key={t} value={t}>{TINDAKAN_LABEL[t]}</option>)}
          </select>
          <small>Yang ditahan atau dinolkan tidak dikirim ke AI, jadi tidak memakai kuota.</small>
        </label>
      </div>

      <div className="pt-tombol">
        <button type="button" className="btn btn-light" disabled={!kiriman.length || p.sibuk === "plagiasi" || p.jalan} onClick={p.onCekPlagiasi}
          title="Hitung ulang kemiripan seluruh kiriman sekarang">{p.sibuk === "plagiasi" ? "Memeriksa…" : "🛡 Cek plagiasi"}</button>
        <button type="button" className="btn btn-light" disabled={!bolehNilai || !kiriman.length} onClick={p.onUji}
          title="Nilai satu kiriman dulu dan lihat jawaban AI apa adanya">🧪 Uji 1 mahasiswa</button>
        <button type="button" className="btn btn-primary" disabled={!bolehNilai || !jumlahBelum} onClick={() => p.onNilaiSemua(false)}>
          ✨ Nilai yang belum ({jumlahBelum})
        </button>
        <button type="button" className="btn btn-light" disabled={!bolehNilai || !kiriman.length} onClick={() => p.onNilaiSemua(true)}>Nilai ulang semua</button>
        {p.jalan && <button type="button" className="btn btn-gagal" onClick={p.onHentikan}>Hentikan</button>}
        <span className="pt-pisah" />
        <button type="button" className="btn btn-light" disabled={!jumlahDinilai || p.sibuk === "zip"} onClick={p.onUnduhSemuaPdf}>
          {p.sibuk === "zip" ? "Menyusun…" : `⇩ Semua PDF + rekap (.zip, ${jumlahDinilai})`}
        </button>
        <button type="button" className="btn btn-light" disabled={!kiriman.length} onClick={p.onUnduhRekap}>⇩ Rekap nilai (.xlsx)</button>
      </div>
      {!cekRubrik.ok && <p className="cbt-catatan">Lengkapi rubrik di langkah 2 lebih dulu ({cekRubrik.pesan || "belum ada kriteria"}).</p>}

      {(p.jalan || prosesJalan > 0) && (
        <div className="pt-kemajuan">
          <div style={{ width: `${Math.round((jumlahDinilai / Math.max(1, kiriman.length)) * 100)}%` }} />
          <span>{jumlahDinilai} dari {kiriman.length} bernilai{prosesJalan ? ` · ${prosesJalan} sedang diproses` : ""}</span>
        </div>
      )}

      <ul className="pt-ringkas">
        <li><b>{kiriman.length}</b> kiriman</li>
        <li><b>{jumlahDinilai}</b> bernilai</li>
        <li className={jumlahKritis ? "merah" : ""}><b>{jumlahKritis}</b> di bawah batas kritis {tugas.batasKritis}</li>
        <li className={ditandai.length ? "merah" : ""}><b>{ditandai.length}</b> terindikasi plagiasi{belumDiputus.length ? ` (${belumDiputus.length} belum diputus)` : ""}</li>
        {jumlahPeriksa > 0 && <li className="kuning"><b>{jumlahPeriksa}</b> ⚠ perlu dibaca dosen</li>}
      </ul>

      {pasanganTinjau.length > 0 && (
        <div className="pt-gerbang">
          <b>🛡 Gerbang plagiasi: pasangan kiriman yang mirip</b>
          <ul>
            {pasanganTinjau.slice(0, 30).map((x) => {
              const a = namaDari(x.a);
              const b = namaDari(x.b);
              return (
                <li key={`${x.a}-${x.b}`} className={x.status}>
                  <span className={`pt-mirip ${x.status}`}>{x.skor}%</span>
                  <span>{a?.nama || a?.kode || x.a} ↔ {b?.nama || b?.kode || x.b}</span>
                  {(x.sinyal as { kembar?: string }).kembar === "berkas" && <small>berkas PDF identik</small>}
                  <button type="button" className="btn btn-light btn-mini" onClick={() => p.onBandingkan(x)}>Bandingkan</button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {p.banding && (
        <div className="pt-banding">
          <div className="pt-uji-kepala">
            <b>Bandingkan kiriman ({p.banding.skor}%)</b>
            <button type="button" className="btn btn-light btn-mini" onClick={p.onTutupBanding}>Tutup</button>
          </div>
          <div className="pt-banding-dua">
            {[p.banding.a, p.banding.b].map((s) => {
              const k = kiriman.find((x) => x.id === s.id);
              return (
                <div key={s.id}>
                  <b>{s.nama || "(tanpa nama)"}</b> <small>{s.nim} · {s.kode} · {s.kata} kata</small>
                  <small>{s.berkas}</small>
                  {k && boleh.ubah && (
                    <div className="pt-tombol">
                      <button type="button" className={`btn btn-mini ${k.putusan === "lolos" ? "btn-primary" : "btn-light"}`} onClick={() => p.onPutuskan(s.id, k.putusan === "lolos" ? "" : "lolos")}>Bukan plagiasi</button>
                      <button type="button" className={`btn btn-mini ${k.putusan === "plagiasi" ? "btn-gagal" : "btn-light"}`} onClick={() => p.onPutuskan(s.id, k.putusan === "plagiasi" ? "" : "plagiasi")}>Plagiasi (nilai 0)</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {p.banding.kalimat.length
            ? <><small>Kalimat yang sama persis pada keduanya:</small><ol className="pt-kalimat">{p.banding.kalimat.map((k, i) => <li key={i}>{k}</li>)}</ol></>
            : <p className="cbt-catatan">Tidak ada kalimat utuh yang sama persis; kesamaannya berupa potongan kalimat.</p>}
        </div>
      )}

      {p.uji && <PanelUji uji={p.uji} rubrik={tugas.rubrik} onTutup={p.onTutupUji} />}

      {kiriman.length > 0 && (
        <div className="pt-tabel-wadah">
          <table className="pt-tabel pt-mhs">
            <thead>
              <tr><th>#</th><th>Kode</th><th>Nama</th><th>NIM</th><th>Kemiripan</th><th>Status</th><th>Nilai</th><th /></tr>
            </thead>
            <tbody>
              {kiriman.map((k, i) => {
                const pr = proses[k.id];
                const nilai = k.nilaiBerlaku;
                const kritis = nilaiKritis(nilai, tugas.batasKritis);
                const tanda = terindikasi(keadaanPlagiasi(k));
                return (
                  <FragmenBaris key={k.id}>
                    <tr className={`${p.buka === k.id ? "on" : ""}${kritis ? " kritis" : ""}`}>
                      <td>{i + 1}</td>
                      <td><code className="pt-resi" title={`${k.asal === "cbt" ? "Dikumpulkan lewat CBT" : "Diimpor dosen"} · ${jamTanggal(k.dikumpulkan)}`}>{k.kode.replace("SIPALING-TUGAS-", "")}</code>
                        <small>{k.asal === "cbt" ? "CBT" : "Impor"}{p.adaBerkasSesi(k.id) ? " · berkas sesi" : ""}</small></td>
                      <td><input defaultValue={k.nama} key={`n${k.id}${k.nama}`} disabled={!boleh.ubah} placeholder={k.berkas}
                        onBlur={(e) => { if (e.target.value !== k.nama) p.onIdentitas(k.id, { nama: e.target.value }); }} /></td>
                      <td><input defaultValue={k.nim} key={`m${k.id}${k.nim}`} disabled={!boleh.ubah}
                        onBlur={(e) => { const v = e.target.value.replace(/\s/g, ""); if (v !== k.nim) p.onIdentitas(k.id, { nim: v }); }} />
                        {(hitungNim.get(k.nim) ?? 0) > 1 && <small className="pt-galat">NIM ini ada di baris lain.</small>}</td>
                      <td>
                        <span className={`pt-mirip ${k.statusMirip}`}>{labelKemiripan(k.statusMirip, k.kemiripan)}</span>
                        {k.putusan === "lolos" && <small className="pt-oke-teks">Diloloskan dosen</small>}
                        {k.putusan === "plagiasi" && <small className="pt-galat">Dinyatakan plagiasi</small>}
                        {tanda && !k.putusan && boleh.ubah && (
                          <div className="pt-aksi">
                            <button type="button" className="btn btn-light btn-mini" onClick={() => p.onPutuskan(k.id, "lolos")}>Loloskan</button>
                            <button type="button" className="btn btn-light btn-mini" onClick={() => p.onPutuskan(k.id, "plagiasi")}>Plagiasi</button>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`pt-status ${pr ? pr.status : k.keadaan}`}>{pr ? PROSES_LABEL[pr.status] : KEADAAN_LABEL[k.keadaan]}</span>
                        {k.hasil?.perluDosen && !k.disunting && <span className="pt-awas" title="Perlu dibaca dosen">⚠</span>}
                        {k.disunting && <span className="pt-dosen" title="Sudah disunting dosen">✎</span>}
                        {pr?.galat && <small className="pt-galat">{pr.galat}</small>}
                      </td>
                      <td className={kritis ? "pt-merah" : ""}>
                        {nilai !== null ? <b>{ejaNilai(nilai)} · {predikatTugas(nilai, tugas.skala).huruf}</b> : "–"}
                        {kritis && <small>di bawah {tugas.batasKritis}</small>}
                      </td>
                      <td><div className="pt-aksi">
                        {k.hasil && <button type="button" className="btn btn-light btn-mini" onClick={() => p.onBuka(p.buka === k.id ? null : k.id)}>{p.buka === k.id ? "Tutup" : "Periksa"}</button>}
                        {k.keadaan === "dinilai" && <button type="button" className="btn btn-light btn-mini" onClick={() => p.onPdf(k)}>PDF</button>}
                        <button type="button" className="btn btn-light btn-mini" onClick={() => p.onMd(k)} title="Unduh isi kiriman (.md)">.md</button>
                        {boleh.ubah && !p.jalan && (
                          <button type="button" className="btn btn-light btn-mini" disabled={!(cekRubrik.ok && p.siapAi !== false)} onClick={() => p.onNilaiSatu(k.id)}>
                            {k.hasil ? "Nilai ulang" : "Nilai AI"}
                          </button>
                        )}
                        {boleh.ubah && !k.hasil && <button type="button" className="btn btn-light btn-mini" onClick={() => p.onNilaiManual(k)}>Manual</button>}
                        {boleh.hapus && <button type="button" className="btn btn-light btn-mini" disabled={p.jalan} onClick={() => p.onHapus(k)} title="Hapus kiriman">✕</button>}
                      </div></td>
                    </tr>
                    {p.buka === k.id && k.hasil && (
                      <tr className="pt-rinci"><td colSpan={8}>
                        <RincianHasil kiriman={k} tugas={tugas} bolehUbah={boleh.ubah} onUbah={(f) => p.onUbahHasil(k.id, f)} />
                      </td></tr>
                    )}
                  </FragmenBaris>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FragmenBaris({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ------------------------------------------------------------
// PANEL UJI: jawaban AI apa adanya, beserta pemeriksaannya
// ------------------------------------------------------------

function PanelUji({ uji, rubrik, onTutup }: { uji: UjiTampil; rubrik: RubrikTugas; onTutup: () => void }) {
  const h = uji.hasil;
  const periksa: Array<[boolean, string]> = h ? [
    [h.kriteria.length === rubrik.kriteria.length, `${h.kriteria.filter((k) => k.skor !== null).length} dari ${rubrik.kriteria.length} kriteria berskor`],
    [h.kriteria.every((k) => k.skor === null || (k.skor >= 0 && k.skor <= 100)), "Seluruh skor di dalam 0–100"],
    [h.kriteria.every((k) => k.capaian.trim().length > 0), "Deskripsi capaian terisi"],
    [h.kelebihan.length > 0 && h.perbaikan.length > 0 && Boolean(h.catatan), "Kelebihan, perbaikan, dan catatan terisi"],
    [h.gerbang.lolos, h.gerbang.lolos ? "Lolos gerbang isi" : `Tidak lolos gerbang isi: ${h.gerbang.alasan}`],
    [h.masalah.length === 0, h.masalah.length ? `Masalah: ${h.masalah.join(" · ")}` : "Tidak ada penyimpangan pada jawaban AI"],
    [h.keyakinan >= 70, `Keyakinan AI ${h.keyakinan}`],
  ] : [];
  return (
    <div className="pt-uji">
      <div className="pt-uji-kepala">
        <b>🧪 Uji penilaian: {uji.nama}</b>
        <button type="button" className="btn btn-light btn-mini" onClick={onTutup}>Tutup</button>
      </div>
      <p className="cbt-catatan">
        Dikirim: {uji.permintaan.teks.toLocaleString("id-ID")} huruf .md, {uji.permintaan.lampiran.length} lampiran
        ({uji.permintaan.ukuranKb.toLocaleString("id-ID")} KB). {uji.permintaan.keterangan}
      </p>
      {uji.permintaan.lampiran.length > 0 && <p className="cbt-catatan">Lampiran: {uji.permintaan.lampiran.join(", ")}</p>}
      {uji.galat && <div className={uji.status === 409 ? "cbtv-catatan" : "dsh-error"}>{uji.status === 409 ? "🛡 " : "Gagal"}{uji.status && uji.status !== 409 ? ` (HTTP ${uji.status})` : ""}{uji.status === 409 ? "" : ": "}{uji.galat}</div>}
      {h && (
        <>
          <p className="cbt-catatan">
            Model <b>{h.model}</b> ({h.penyedia}) · {(h.ms / 1000).toFixed(1)} detik · versi perintah {h.versiPerintah} ·
            nilai akhir <b>{ejaNilai(h.nilai)}</b>
          </p>
          <ul className="pt-periksa">
            {periksa.map(([ok, teks]) => <li key={teks} className={ok ? "ok" : "tidak"}>{ok ? "✓" : "✕"} {teks}</li>)}
          </ul>
          <details>
            <summary>Jawaban AI mentah (JSON)</summary>
            <pre>{JSON.stringify(h.mentah, null, 2)}</pre>
          </details>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// RINCIAN DAN SUNTINGAN SATU KIRIMAN
// ------------------------------------------------------------

function RincianHasil({ kiriman: k, tugas, bolehUbah, onUbah }: {
  kiriman: KirimanKlien; tugas: TugasKlien; bolehUbah: boolean; onUbah: (f: (h: Hasil) => Hasil) => void;
}) {
  const h = k.hasil!;
  const pred = predikatTugas(h.nilai, tugas.skala);
  const [md, setMd] = useState<string | null>(null);
  const kosong = (j: number) => ({ urut: j, skor: null as number | null, capaian: "" });
  async function lihatMd() {
    if (md !== null) { setMd(null); return; }
    try {
      const d = await minta<{ kiriman: { markdown: string } }>(`/api/cbt/tugas/kiriman?id=${k.id}`);
      setMd(d.kiriman.markdown);
    } catch {
      setMd("(Isi .md belum dapat dimuat.)");
    }
  }
  return (
    <fieldset className="pt-rincian" disabled={!bolehUbah}>
      <div className="pt-rincian-kepala">
        <div>
          <b>{k.nama || k.kode}</b> · {k.nim || "NIM belum diisi"} · <code>{k.kode}</code>
          <small> · {h.model} · keyakinan {h.keyakinan}{k.disunting ? " · disunting dosen" : ""}</small>
        </div>
        <div><b>{ejaNilai(h.nilai)}</b> / 100 · {pred.huruf} ({ejaRentang(pred)}){!h.lengkap && " · belum lengkap"}</div>
      </div>
      {(h.identitas?.nama || h.identitas?.nim) && (h.identitas.nama !== k.nama || h.identitas.nim !== k.nim) && (
        <p className="cbt-catatan">Dokumen menyebut: {h.identitas.nama || "–"} {h.identitas.nim && `(NIM ${h.identitas.nim})`}</p>
      )}
      {!h.gerbang.lolos && <div className="dsh-error">Tidak lolos gerbang isi: {h.gerbang.alasan || "kiriman tidak dapat dinilai"}. Seluruh skor 0; periksa kirimannya.</div>}
      {h.masalah.length > 0 && <div className="cbtv-catatan"><b>Penyimpangan jawaban AI</b><ul>{h.masalah.map((m) => <li key={m}>{m}</li>)}</ul></div>}

      <label className="pt-lebar"><span>Judul karya</span>
        <input value={h.judul} onChange={(e) => onUbah((x) => ({ ...x, judul: e.target.value }))} />
      </label>
      <table className="pt-tabel">
        <thead><tr><th>Kriteria</th><th>Deskripsi capaian</th><th>Skor</th></tr></thead>
        <tbody>
          {tugas.rubrik.kriteria.map((kr, i) => {
            const x = h.kriteria[i] ?? kosong(i);
            const ganti = (u: Partial<typeof x>) => onUbah((y) => ({
              ...y, kriteria: tugas.rubrik.kriteria.map((_, j) => (j === i ? { ...x, ...u } : (y.kriteria[j] ?? kosong(j)))),
            }));
            return (
              <tr key={i}>
                <td><b>{i + 1}. {kr.nama}</b><small> {kr.bobot}%</small></td>
                <td><textarea rows={3} value={x.capaian} onChange={(e) => ganti({ capaian: e.target.value })} /></td>
                <td><input type="number" min={0} max={100} value={x.skor ?? ""} onChange={(e) => ganti({ skor: skorAman(e.target.value) })} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="pt-isian">
        <label className="pt-lebar"><span>Kelebihan utama (satu per baris)</span>
          <textarea rows={3} value={h.kelebihan.join("\n")} onChange={(e) => onUbah((x) => ({ ...x, kelebihan: e.target.value.split("\n").filter((s) => s.trim()) }))} />
        </label>
        <label className="pt-lebar"><span>Perlu ditingkatkan (satu per baris, &ldquo;Aspek: uraian&rdquo;)</span>
          <textarea rows={3} value={h.perbaikan.map((x) => (x.aspek ? `${x.aspek}: ${x.uraian}` : x.uraian)).join("\n")}
            onChange={(e) => onUbah((x) => ({
              ...x,
              perbaikan: e.target.value.split("\n").filter((s) => s.trim()).map((s) => {
                const m = s.match(/^([^:]{2,60}):\s*(.+)$/);
                return m ? { aspek: m[1].trim(), uraian: m[2].trim() } : { aspek: "", uraian: s.trim() };
              }),
            }))} />
        </label>
        <label className="pt-lebar"><span>Catatan khusus / saran tindak lanjut</span>
          <textarea rows={3} value={h.catatan} onChange={(e) => onUbah((x) => ({ ...x, catatan: e.target.value }))} />
        </label>
      </div>
      <p className="cbt-catatan">
        {k.berkas} · {k.halaman ? `${k.halaman} halaman · ` : ""}{k.kata.toLocaleString("id-ID")} kata
        {k.sidik && <> · SHA-256 <code title={k.sidik}>{k.sidik.slice(0, 12)}…</code></>}
        {" "}<button type="button" className="btn btn-light btn-mini" onClick={() => void lihatMd()}>{md === null ? "Lihat isi .md" : "Tutup .md"}</button>
      </p>
      {md !== null && <pre className="pt-md">{md}</pre>}
    </fieldset>
  );
}
