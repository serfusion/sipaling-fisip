"use client";

// ============================================================
// PENILAIAN TUGAS DENGAN AI — menu keempat panel CBT
//
// Alurnya sama dengan CBT, tanpa soal:
//
//   1. Data tugas      mata kuliah, tugas ke-, nama tugas, petunjuk (opsional)
//   2. Rubrik tugas    diunggah (Excel/Word/PDF/teks), diambil dari pustaka
//                      rubrik CBT, atau diketik; dosen memeriksa bobotnya
//   3. Template        template laporan dosen (Markdown/Word/teks) atau bawaan
//   4. Tugas terisi    banyak berkas sekaligus: zip/rar unduhan Drive, map,
//                      PDF, Word, Excel; dikelompokkan per mahasiswa
//   5. Nilai dengan AI uji satu mahasiswa dulu, lalu semua; hasilnya dapat
//                      disunting dosen, lalu diunduh sebagai PDF per
//                      mahasiswa, satu zip, dan rekap Excel
//
// Pengaturan tugas (rubrik, template, skala) dan hasil penilaian disimpan di
// peramban ini (localStorage), jadi memuat ulang halaman tidak menghapus
// pekerjaan. Berkas mahasiswa TIDAK disimpan di mana pun; untuk menilai ulang
// setelah memuat ulang halaman, berkasnya diunggah lagi.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SKALA_BAWAAN, dariRubrikLevel, ejaNilai, ejaRentang, ejaSkala, hitungNilaiTugas, periksaRubrikTugas,
  predikatTugas, rapikanBobot, skorAman, uraiSkala, type RubrikTugas, type TingkatPredikat,
} from "@/lib/tugas-rubrik";
import {
  TEMPLATE_BAWAAN, analisisTemplate, buatLaporanPdf, htmlKeMarkdown, namaBerkasLaporan, uraiMarkdown,
  type DataLaporan,
} from "@/lib/tugas-template";
import {
  alatGambarPeramban, bongkar, kelompokkan, rubrikDariBerkas, sarikanBerkas, siapkanKiriman,
  type BerkasTugas, type KirimanSiap,
} from "@/lib/tugas-berkas";
import type { HasilPenilaianTugas } from "@/lib/tugas-nilai";
import type { Rubrik } from "@/lib/rubrik";
import { buatZip, ukuranTerbaca, type Bita } from "@/lib/zip";

// ------------------------------------------------------------
// TIPE DAN PENYIMPANAN LOKAL
// ------------------------------------------------------------

type Tugas = {
  id: string;
  mataKuliah: string;
  nomor: string;
  nama: string;
  petunjuk: string;
  dosen: string;
  rubrik: RubrikTugas;
  template: string;
  namaTemplate: string;
  skala: TingkatPredikat[];
  /** Cantumkan keterangan "disusun dengan bantuan AI" di kaki halaman PDF. */
  kakiAi: boolean;
  diubah: string;
};

type Hasil = HasilPenilaianTugas & { dinilai: string; diubahDosen?: boolean };

type Status = "siap" | "antre" | "membaca" | "menilai" | "selesai" | "gagal";

type Baris = {
  id: string;
  sumber: string;
  nama: string;
  nim: string;
  berkas: BerkasTugas[];
  namaBerkas: string[];
  status: Status;
  galat?: string;
  hasil?: Hasil;
  ringkas?: KirimanSiap["ringkas"];
  keterangan?: string;
  catatan?: string[];
};

type UjiTampil = {
  nama: string;
  permintaan: { teks: number; lampiran: string[]; keterangan: string; ukuranKb: number };
  hasil?: Hasil;
  galat?: string;
  status?: number;
};

const KUNCI_SIMPAN = "sipaling:penilaian-tugas:v1";
const kunciHasil = (id: string) => `sipaling:penilaian-tugas:hasil:${id}`;

function tugasBaru(): Tugas {
  return {
    id: `t${Date.now().toString(36)}`,
    mataKuliah: "", nomor: "", nama: "", petunjuk: "", dosen: "",
    rubrik: { nama: "", kriteria: [] },
    template: TEMPLATE_BAWAAN, namaTemplate: "Template bawaan",
    skala: SKALA_BAWAAN.map((t) => ({ ...t })), kakiAi: true, diubah: new Date().toISOString(),
  };
}

function bacaSimpanan(): { aktif: string; tugas: Tugas[] } {
  try {
    const isi = JSON.parse(localStorage.getItem(KUNCI_SIMPAN) || "null") as { aktif?: string; tugas?: Tugas[] } | null;
    if (isi && Array.isArray(isi.tugas) && isi.tugas.length) return { aktif: isi.aktif || isi.tugas[0].id, tugas: isi.tugas };
  } catch {
    // Penyimpanan peramban tidak tersedia atau rusak: mulai dari kosong.
  }
  const t = tugasBaru();
  return { aktif: t.id, tugas: [t] };
}

function simpanTugas(aktif: string, tugas: Tugas[]) {
  try { localStorage.setItem(KUNCI_SIMPAN, JSON.stringify({ aktif, tugas })); } catch { /* penuh atau dimatikan */ }
}

type BarisSimpan = Omit<Baris, "berkas" | "status"> & { status: Status };

function bacaHasilSimpan(id: string): Baris[] {
  try {
    const isi = JSON.parse(localStorage.getItem(kunciHasil(id)) || "[]") as BarisSimpan[];
    return isi.map((b) => ({ ...b, berkas: [], status: b.hasil ? "selesai" : "siap" }));
  } catch {
    return [];
  }
}

function simpanHasil(id: string, baris: Baris[]) {
  try {
    const ringkas: BarisSimpan[] = baris
      .filter((b) => b.hasil)
      .map(({ berkas: _b, ...sisa }) => ({ ...sisa, status: "selesai", hasil: sisa.hasil ? { ...sisa.hasil, mentah: undefined } : undefined }));
    localStorage.setItem(kunciHasil(id), JSON.stringify(ringkas));
  } catch {
    // Diamkan: hasil tetap ada di layar dan dapat diunduh.
  }
}

function unduh(data: BlobPart, nama: string, jenis: string) {
  const url = URL.createObjectURL(new Blob([data], { type: jenis }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

const LABEL_STATUS: Record<Status, string> = {
  siap: "Siap", antre: "Antre", membaca: "Membaca berkas…", menilai: "Dinilai AI…", selesai: "Selesai", gagal: "Gagal",
};

const TERIMA = ".zip,.rar,.pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.odt,.odp,.ods,.rtf,.txt,.md,.html,.jpg,.jpeg,.png,.webp";

// ------------------------------------------------------------
// KOMPONEN UTAMA
// ------------------------------------------------------------

export function PanelPenilaianTugas() {
  const [daftarTugas, setDaftarTugas] = useState<Tugas[]>([]);
  const [aktif, setAktif] = useState("");
  const [baris, setBaris] = useState<Baris[]>([]);
  const [siapAi, setSiapAi] = useState<boolean | null>(null);
  const [kabar, setKabar] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [catatanRubrik, setCatatanRubrik] = useState<string[]>([]);
  const [peringatan, setPeringatan] = useState<string[]>([]);
  const [uji, setUji] = useState<UjiTampil | null>(null);
  const [buka, setBuka] = useState<string | null>(null);
  const [jalan, setJalan] = useState(false);
  const [teksSkala, setTeksSkala] = useState("");
  const berhenti = useRef(false);
  // Baris terbaru untuk antrean penilaian yang berjalan di luar siklus gambar.
  const barisRef = useRef<Baris[]>([]);
  useEffect(() => { barisRef.current = baris; }, [baris]);

  // Dimuat sesudah pasang, supaya gambar pertama sama di server dan peramban.
  useEffect(() => {
    const jam = setTimeout(() => {
      const s = bacaSimpanan();
      setDaftarTugas(s.tugas);
      setAktif(s.aktif);
      setBaris(bacaHasilSimpan(s.aktif));
      setTeksSkala(ejaSkala((s.tugas.find((t) => t.id === s.aktif) ?? s.tugas[0]).skala));
    }, 0);
    return () => clearTimeout(jam);
  }, []);

  useEffect(() => {
    let hidup = true;
    fetch("/api/cbt/tugas", { cache: "no-store" })
      .then((j) => j.json())
      .then((d) => { if (hidup) setSiapAi(Boolean(d?.siap)); })
      .catch(() => { if (hidup) setSiapAi(false); });
    return () => { hidup = false; };
  }, []);

  const tugas = useMemo(() => daftarTugas.find((t) => t.id === aktif) ?? null, [daftarTugas, aktif]);

  const ubahTugas = useCallback((ubah: Partial<Tugas>) => {
    setDaftarTugas((semua) => {
      const baru = semua.map((t) => (t.id === aktif ? { ...t, ...ubah, diubah: new Date().toISOString() } : t));
      simpanTugas(aktif, baru);
      return baru;
    });
  }, [aktif]);

  // Hasil disimpan tiap kali berubah.
  useEffect(() => {
    if (aktif) simpanHasil(aktif, baris);
  }, [aktif, baris]);

  const blokTemplate = useMemo(() => uraiMarkdown(tugas?.template || TEMPLATE_BAWAAN), [tugas?.template]);
  const analisis = useMemo(() => analisisTemplate(blokTemplate), [blokTemplate]);
  const cekRubrik = tugas ? periksaRubrikTugas(tugas.rubrik) : { ok: false as const, pesan: "" };
  const jumlahBobot = tugas ? tugas.rubrik.kriteria.reduce((n, k) => n + k.bobot, 0) : 0;

  function pilihTugas(id: string) {
    if (jalan) return;
    setAktif(id);
    simpanTugas(id, daftarTugas);
    setBaris(bacaHasilSimpan(id));
    setUji(null);
    setBuka(null);
    const t = daftarTugas.find((x) => x.id === id);
    if (t) setTeksSkala(ejaSkala(t.skala));
  }

  function tambahTugas(salinDari?: Tugas) {
    const t = salinDari
      ? { ...salinDari, id: `t${Date.now().toString(36)}`, nomor: "", nama: `${salinDari.nama} (salinan)`, diubah: new Date().toISOString() }
      : tugasBaru();
    const baru = [...daftarTugas, t];
    setDaftarTugas(baru);
    setAktif(t.id);
    simpanTugas(t.id, baru);
    setBaris([]);
    setUji(null);
    setTeksSkala(ejaSkala(t.skala));
  }

  function hapusTugas() {
    if (!tugas || jalan) return;
    if (!window.confirm(`Hapus pengaturan "${tugas.nama || "tugas ini"}" beserta hasil penilaiannya dari peramban ini?`)) return;
    try { localStorage.removeItem(kunciHasil(tugas.id)); } catch { /* diamkan */ }
    const sisa = daftarTugas.filter((t) => t.id !== tugas.id);
    const akhir = sisa.length ? sisa : [tugasBaru()];
    setDaftarTugas(akhir);
    setAktif(akhir[0].id);
    simpanTugas(akhir[0].id, akhir);
    setBaris(bacaHasilSimpan(akhir[0].id));
    setTeksSkala(ejaSkala(akhir[0].skala));
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
      const jawab = await fetch("/api/cbt/tugas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "rubrik", teks: h.teks.slice(0, 60_000) }),
      });
      const d = await jawab.json();
      if (!jawab.ok || !d.success) throw new Error(d.message || "Rubrik gagal disusun AI.");
      ubahTugas({ rubrik: { ...d.rubrik, nama: d.rubrik.nama || berkas.name.replace(/\.[^.]+$/, "") } });
      setCatatanRubrik(d.catatan || []);
      setKabar("");
    } catch (alasan) {
      setKabar("");
      setGalat(alasan instanceof Error ? alasan.message : "Rubrik gagal dibaca.");
    } finally {
      setSibuk("");
    }
  }

  const [pustaka, setPustaka] = useState<Array<Rubrik & { id?: number }> | null>(null);
  async function muatPustaka() {
    setSibuk("pustaka");
    try {
      const jawab = await fetch("/api/cbt/rubrik", { cache: "no-store" });
      const d = await jawab.json();
      if (!jawab.ok || !d.success) throw new Error(d.message || "Pustaka rubrik gagal dimuat.");
      setPustaka([...(d.rubrik || []), ...(d.bawaan || [])]);
    } catch (alasan) {
      setGalat(alasan instanceof Error ? alasan.message : "Pustaka rubrik gagal dimuat.");
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
    } catch (alasan) {
      setGalat(alasan instanceof Error ? alasan.message : "Template gagal dibaca.");
    } finally {
      setSibuk("");
    }
  }

  function dataLaporan(t: Tugas, b: Baris): DataLaporan {
    const h = b.hasil!;
    const skor = h.kriteria.map((k) => k.skor);
    const hitung = hitungNilaiTugas(t.rubrik, skor);
    return {
      tugas: { mataKuliah: t.mataKuliah, nomor: t.nomor, nama: t.nama, dosen: t.dosen },
      mahasiswa: { nama: b.nama, nim: b.nim },
      judulKarya: h.judul,
      rubrik: t.rubrik,
      skor,
      capaian: h.kriteria.map((k) => k.capaian),
      nilai: hitung.nilai,
      rataBiasa: hitung.rataBiasa,
      predikat: predikatTugas(hitung.nilai, t.skala),
      kelebihan: h.kelebihan,
      perbaikan: h.perbaikan,
      catatan: h.catatan,
      bagianTambahan: h.bagianTambahan,
      tanggal: new Date(h.dinilai || Date.now()).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    };
  }

  const kaki = (t: Tugas) => (t.kakiAi ? "Disusun dengan bantuan AI berdasarkan rubrik dosen" : undefined);

  function pratinjauTemplate() {
    if (!tugas) return;
    const rubrik = tugas.rubrik.kriteria.length ? tugas.rubrik : {
      nama: "Contoh", kriteria: [1, 2, 3].map((n) => ({ nama: `Kriteria contoh ${n}`, bobot: n === 1 ? 34 : 33, deskripsi: "" })),
    };
    const skor = rubrik.kriteria.map((_, i) => 80 + ((i * 3) % 7));
    const hitung = hitungNilaiTugas(rubrik, skor);
    const pdf = buatLaporanPdf(tugas.template, {
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
    }, { kaki: kaki(tugas) });
    const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  // ---------- UNGGAH TUGAS MAHASISWA ----------

  async function terimaBerkas(daftar: FileList | File[]) {
    const berkas = Array.from(daftar);
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
      setBaris((lama) => {
        const peta = new Map(lama.map((b) => [b.id, b]));
        for (const k of kelompok) {
          const ada = peta.get(k.id) ?? [...peta.values()].find((b) => !b.berkas.length && b.sumber === k.sumber);
          if (ada) {
            peta.set(ada.id, { ...ada, berkas: k.berkas, namaBerkas: k.berkas.map((x) => x.nama) });
          } else {
            peta.set(k.id, {
              id: k.id, sumber: k.sumber, nama: k.nama, nim: k.nim, berkas: k.berkas,
              namaBerkas: k.berkas.map((x) => x.nama), status: "siap",
            });
          }
        }
        return [...peta.values()];
      });
      setPeringatan(h.peringatan);
      setKabar(`${berkas.length} berkas (${ukuranTerbaca(total)}) dibongkar: ${h.berkas.length} dokumen, ${kelompok.length} mahasiswa. Periksa nama dan NIM sebelum menilai.`);
    } catch (alasan) {
      setGalat(alasan instanceof Error ? alasan.message : "Berkas gagal dibaca.");
    } finally {
      setSibuk("");
    }
  }

  function ubahBaris(id: string, ubah: Partial<Baris>) {
    setBaris((semua) => semua.map((b) => (b.id === id ? { ...b, ...ubah } : b)));
  }

  // ---------- PENILAIAN ----------

  /** Nilai satu mahasiswa. Mengembalikan ringkasan untuk layar uji. */
  async function nilaiSatu(id: string, t: Tugas): Promise<UjiTampil> {
    const b = barisRef.current.find((x) => x.id === id);
    if (!b) throw new Error("Baris tidak ditemukan.");
    if (!b.berkas.length) throw new Error("Berkas mahasiswa ini belum diunggah ulang sejak halaman dimuat.");
    ubahBaris(id, { status: "membaca", galat: undefined });
    const siap = await siapkanKiriman(
      { id: b.id, sumber: b.sumber, nama: b.nama, nim: b.nim, berkas: b.berkas },
      alatGambarPeramban(),
    );
    ubahBaris(id, { status: "menilai", ringkas: siap.ringkas, keterangan: siap.keteranganLampiran, catatan: siap.catatan });

    let lampiran = siap.lampiran;
    const susun = () => JSON.stringify({
      aksi: "nilai",
      tugas: { mataKuliah: t.mataKuliah, nomor: t.nomor, nama: t.nama, petunjuk: t.petunjuk },
      rubrik: t.rubrik,
      mahasiswa: { nama: b.nama, nim: b.nim },
      berkas: siap.berkas,
      teks: siap.teks,
      lampiran,
      keteranganLampiran: lampiran.length ? siap.keteranganLampiran : "",
      bagianTambahan: analisis.bagianBebas,
    });
    let badan = susun();
    // Batas unggah fungsi serverless 4,5 MB: lampiran terbesar dilepas lebih dulu.
    while (badan.length > 4_400_000 && lampiran.length) {
      const terbesar = lampiran.reduce((m, l, i) => (l.data.length > lampiran[m].data.length ? i : m), 0);
      lampiran = lampiran.filter((_, i) => i !== terbesar);
      badan = susun();
    }
    const tampil: UjiTampil = {
      nama: b.nama || b.sumber,
      permintaan: {
        teks: siap.teks.length,
        lampiran: lampiran.map((l) => `${l.nama ?? l.jenis} (${l.jenis}, ${ukuranTerbaca(Math.round(l.data.length * 0.75))})`),
        keterangan: siap.keteranganLampiran,
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
          const hasil: Hasil = { ...d.hasil, dinilai: new Date().toISOString() };
          const isiNama = !b.nama && hasil.identitas.nama ? { nama: hasil.identitas.nama } : {};
          const isiNim = !b.nim && hasil.identitas.nim ? { nim: hasil.identitas.nim } : {};
          ubahBaris(id, { status: "selesai", hasil, ...isiNama, ...isiNim });
          return { ...tampil, hasil, status: jawab.status };
        }
        terakhir = d.message || `Server menjawab ${jawab.status}.`;
        tampil.status = jawab.status;
        // Kuota, penyedia sibuk, atau batas waktu: tunggu lalu ulangi.
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
    ubahBaris(id, { status: "gagal", galat: terakhir });
    return { ...tampil, galat: terakhir };
  }

  async function ujiSatu() {
    if (!tugas) return;
    const calon = baris.find((b) => b.id === buka && b.berkas.length) ?? baris.find((b) => b.berkas.length && !b.hasil) ?? baris.find((b) => b.berkas.length);
    if (!calon) { setGalat("Unggah tugas mahasiswa lebih dulu."); return; }
    setGalat(""); setUji(null); setJalan(true); berhenti.current = false;
    try {
      setUji(await nilaiSatu(calon.id, tugas));
    } catch (alasan) {
      setUji({ nama: calon.nama, permintaan: { teks: 0, lampiran: [], keterangan: "", ukuranKb: 0 }, galat: (alasan as Error).message });
    } finally {
      setJalan(false);
    }
  }

  async function nilaiSemua(ulang = false) {
    if (!tugas) return;
    const antre = baris.filter((b) => b.berkas.length && (ulang ? true : !b.hasil || b.status === "gagal")).map((b) => b.id);
    if (!antre.length) { setKabar("Tidak ada yang perlu dinilai. Unggah berkasnya, atau pilih Nilai ulang semua."); return; }
    if (ulang && !window.confirm(`Nilai ulang ${antre.length} mahasiswa? Hasil dan suntingan sebelumnya akan diganti.`)) return;
    setGalat(""); setJalan(true); berhenti.current = false;
    setBaris((semua) => semua.map((b) => (antre.includes(b.id) ? { ...b, status: "antre" } : b)));
    const sisa = [...antre];
    // Dua sekaligus: cukup cepat, dan tidak menabrak batas per menit kunci Gemini gratis.
    const pekerja = async () => {
      while (sisa.length && !berhenti.current) {
        const id = sisa.shift()!;
        try { await nilaiSatu(id, tugas); } catch (alasan) { ubahBaris(id, { status: "gagal", galat: (alasan as Error).message }); }
      }
    };
    await Promise.all([pekerja(), pekerja()]);
    setBaris((semua) => semua.map((b) => (b.status === "antre" ? { ...b, status: b.hasil ? "selesai" : "siap" } : b)));
    setJalan(false);
    setKabar(berhenti.current ? "Penilaian dihentikan." : "Penilaian selesai. Periksa baris bertanda ⚠ sebelum laporan dibagikan.");
  }

  // ---------- SUNTING HASIL ----------

  function ubahHasil(id: string, ubah: (h: Hasil) => Hasil) {
    if (!tugas) return;
    setBaris((semua) => semua.map((b) => {
      if (b.id !== id || !b.hasil) return b;
      const h = ubah(b.hasil);
      const hitung = hitungNilaiTugas(tugas.rubrik, h.kriteria.map((k) => k.skor));
      return { ...b, hasil: { ...h, nilai: hitung.nilai, lengkap: hitung.lengkap, diubahDosen: true } };
    }));
  }

  // ---------- UNDUH ----------

  function unduhSatu(b: Baris) {
    if (!tugas || !b.hasil) return;
    const d = dataLaporan(tugas, b);
    unduh(buatLaporanPdf(tugas.template, d, { kaki: kaki(tugas) }) as BlobPart, namaBerkasLaporan(d), "application/pdf");
  }

  async function rekapXlsx(): Promise<Uint8Array> {
    const XLSX = await import("xlsx");
    const t = tugas!;
    const kepala = ["No", "NIM", "Nama", ...t.rubrik.kriteria.map((k) => `${k.nama} (${k.bobot}%)`), "Nilai Akhir", "Predikat", "Judul Karya", "Perlu diperiksa", "Disunting dosen", "Model", "Berkas"];
    const isi = baris.filter((b) => b.hasil).map((b, i) => {
      const d = dataLaporan(t, b);
      return [
        i + 1, b.nim, b.nama, ...d.skor.map((s) => (s === null ? "" : s)), Number(ejaNilai(d.nilai)), d.predikat.huruf,
        d.judulKarya, b.hasil!.perluDosen ? "ya" : "", b.hasil!.diubahDosen ? "ya" : "", b.hasil!.model, b.namaBerkas.join("; "),
      ];
    });
    const lembar = XLSX.utils.aoa_to_sheet([kepala, ...isi]);
    const buku = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(buku, lembar, "Rekap Nilai");
    return new Uint8Array(XLSX.write(buku, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
  }

  async function unduhRekap() {
    if (!tugas) return;
    unduh(await rekapXlsx() as BlobPart, `REKAP_NILAI_${namaBerkasLaporan({ tugas, mahasiswa: { nama: "", nim: "" } }).replace(/^PENILAIAN_|_-_Mahasiswa\.pdf$/g, "")}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  async function unduhSemua() {
    if (!tugas) return;
    const selesai = baris.filter((b) => b.hasil);
    if (!selesai.length) return;
    setSibuk("zip");
    try {
      const isi: Array<{ nama: string; data: Bita }> = [];
      const dipakai = new Set<string>();
      for (const b of selesai) {
        const d = dataLaporan(tugas, b);
        const dasar = namaBerkasLaporan(d);
        let nama = dasar;
        // Nama kembar (mis. satu mahasiswa mengumpulkan dua kali) diberi
        // nomor, tanpa menyentuh NIM di ujung namanya.
        for (let n = 2; dipakai.has(nama); n += 1) nama = dasar.replace(/\.pdf$/, `_(${n}).pdf`);
        dipakai.add(nama);
        isi.push({ nama, data: buatLaporanPdf(tugas.template, d, { kaki: kaki(tugas) }) as Bita });
      }
      isi.push({ nama: "REKAP_NILAI.xlsx", data: (await rekapXlsx()) as Bita });
      const judul = tugas.nomor ? `TUGAS_${tugas.nomor}` : (tugas.nama || "TUGAS").replace(/\s+/g, "_");
      unduh(buatZip(isi), `LAPORAN_PENILAIAN_${judul}.zip`, "application/zip");
    } finally {
      setSibuk("");
    }
  }

  // ---------- TAMPILAN ----------

  if (!tugas) return <div className="dempty">Memuat…</div>;

  const jumlahSelesai = baris.filter((b) => b.hasil).length;
  const jumlahBerkas = baris.filter((b) => b.berkas.length).length;
  const jumlahPeriksa = baris.filter((b) => b.hasil?.perluDosen && !b.hasil.diubahDosen).length;
  const prosesJalan = baris.filter((b) => ["antre", "membaca", "menilai"].includes(b.status)).length;
  const bolehNilai = cekRubrik.ok && siapAi !== false && !jalan;
  // NIM yang muncul di lebih dari satu baris: biasanya satu mahasiswa yang
  // mengumpulkan dua kali, atau tebakan nama berkas yang keliru.
  const hitungNim = new Map<string, number>();
  for (const b of baris) if (b.nim) hitungNim.set(b.nim, (hitungNim.get(b.nim) ?? 0) + 1);

  return (
    <div className="pt">
      <p className="cbtv-cara-baca">
        Seperti CBT tanpa soal: pasang rubrik dan template laporan sekali per tugas, unggah seluruh tugas
        mahasiswa sekaligus (zip/rar unduhan Drive, PDF, Word, Excel), lalu AI menilai tiap mahasiswa
        dengan rubrik itu dan menyusun laporan PDF. Dosen tetap memeriksa dan dapat mengubah skor dan
        umpan balik sebelum laporannya dibagikan.
      </p>

      {siapAi === false && (
        <div className="dsh-error">
          Kunci AI belum terpasang. Minta Super Admin menempelkan kunci Gemini di Dashboard → Kunci AI.
          Rubrik, template, dan unggahan tetap dapat disiapkan.
        </div>
      )}
      {kabar && <div className="dsh-ok">{kabar}</div>}
      {galat && <div className="dsh-error">{galat}</div>}

      {/* ---------- PILIH TUGAS ---------- */}
      <div className="panel pt-pilih">
        <label>
          <span>Tugas</span>
          <select value={aktif} onChange={(e) => pilihTugas(e.target.value)} disabled={jalan}>
            {daftarTugas.map((t) => (
              <option key={t.id} value={t.id}>
                {[t.mataKuliah, t.nomor && `Tugas ${t.nomor}`, t.nama].filter(Boolean).join(" · ") || "Tugas tanpa nama"}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-light" onClick={() => tambahTugas()} disabled={jalan}>+ Tugas baru</button>
        <button type="button" className="btn btn-light" onClick={() => tambahTugas(tugas)} disabled={jalan} title="Rubrik dan template ikut disalin">Salin tugas ini</button>
        <button type="button" className="btn btn-light" onClick={hapusTugas} disabled={jalan}>Hapus</button>
      </div>

      {/* ---------- 1. DATA TUGAS ---------- */}
      <section className="panel pt-langkah">
        <h3><span>1</span> Data tugas</h3>
        <div className="pt-isian">
          <label><span>Mata kuliah</span><input value={tugas.mataKuliah} onChange={(e) => ubahTugas({ mataKuliah: e.target.value })} placeholder="Public Relations" /></label>
          <label className="pt-pendek"><span>Tugas ke-</span><input value={tugas.nomor} onChange={(e) => ubahTugas({ nomor: e.target.value })} placeholder="2" /></label>
          <label><span>Nama tugas</span><input value={tugas.nama} onChange={(e) => ubahTugas({ nama: e.target.value })} placeholder="Proposal Program PR & Press Conference" /></label>
          <label><span>Dosen (opsional)</span><input value={tugas.dosen} onChange={(e) => ubahTugas({ dosen: e.target.value })} /></label>
        </div>
        <label className="pt-lebar">
          <span>Petunjuk tugas untuk AI (opsional)</span>
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
            <input type="checkbox" checked={tugas.kakiAi} onChange={(e) => ubahTugas({ kakiAi: e.target.checked })} />
            <span>Tulis &ldquo;disusun dengan bantuan AI&rdquo; di kaki laporan</span>
          </label>
        </div>
      </section>

      {/* ---------- 2. RUBRIK ---------- */}
      <section className="panel pt-langkah">
        <h3><span>2</span> Rubrik tugas {cekRubrik.ok ? <em className="pt-oke">siap</em> : <em className="pt-kurang">belum siap</em>}</h3>
        <div className="pt-tombol">
          <label className="btn btn-primary">
            {sibuk === "rubrik" ? "Membaca…" : "⇧ Unggah rubrik"}
            <input type="file" hidden accept=".xlsx,.xls,.csv,.docx,.doc,.pdf,.txt,.md,.rtf,.odt,.pptx"
              disabled={Boolean(sibuk)} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void unggahRubrik(f); }} />
          </label>
          <button type="button" className="btn btn-light" onClick={() => void muatPustaka()} disabled={Boolean(sibuk)}>Ambil dari pustaka rubrik CBT</button>
          <button type="button" className="btn btn-light" onClick={() => ubahTugas({ rubrik: { ...tugas.rubrik, kriteria: [...tugas.rubrik.kriteria, { nama: "", bobot: 0, deskripsi: "" }] } })}>+ Kriteria</button>
          <button type="button" className="btn btn-light" disabled={!tugas.rubrik.kriteria.length}
            onClick={() => ubahTugas({ rubrik: { ...tugas.rubrik, kriteria: rapikanBobot(tugas.rubrik.kriteria.map((k) => ({ ...k, bobot: 0 }))).kriteria } })}>Ratakan bobot</button>
        </div>
        <p className="cbt-catatan">
          Excel/Word dengan tabel berkolom <b>Kriteria</b> (dan <b>Bobot</b>) langsung terbaca; template rubrik CBT juga.
          PDF atau teks bebas disusun AI. Kolom deskripsi boleh memuat pita skor, mis. &ldquo;85–100: …&rdquo;.
        </p>
        {pustaka && (
          <div className="pt-pustaka">
            <select defaultValue="" onChange={(e) => {
              const r = pustaka[Number(e.target.value)];
              if (r) { ubahTugas({ rubrik: dariRubrikLevel(r) }); setCatatanRubrik([`Diambil dari pustaka: ${r.nama}. Deskriptor level diubah menjadi acuan skor 0–100.`]); setPustaka(null); }
            }}>
              <option value="" disabled>Pilih rubrik…</option>
              {pustaka.map((r, i) => <option key={`${r.nama}-${i}`} value={i}>{r.nama} ({r.kriteria.length} kriteria)</option>)}
            </select>
            <button type="button" className="btn btn-light btn-mini" onClick={() => setPustaka(null)}>Tutup</button>
          </div>
        )}
        {catatanRubrik.length > 0 && (
          <div className="cbtv-catatan"><b>Yang perlu Anda periksa</b><ul>{catatanRubrik.map((c) => <li key={c}>{c}</li>)}</ul></div>
        )}
        <label className="pt-lebar"><span>Nama rubrik</span>
          <input value={tugas.rubrik.nama} onChange={(e) => ubahTugas({ rubrik: { ...tugas.rubrik, nama: e.target.value } })} />
        </label>
        {tugas.rubrik.kriteria.length > 0 && (
          <div className="pt-tabel-wadah">
            <table className="pt-tabel">
              <thead><tr><th>#</th><th>Kriteria</th><th>Bobot %</th><th>Deskripsi / acuan skor</th><th /></tr></thead>
              <tbody>
                {tugas.rubrik.kriteria.map((k, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><input value={k.nama} onChange={(e) => ubahKriteria(i, { nama: e.target.value })} /></td>
                    <td><input type="number" min={0} max={100} value={k.bobot} onChange={(e) => ubahKriteria(i, { bobot: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })} /></td>
                    <td><textarea rows={2} value={k.deskripsi} onChange={(e) => ubahKriteria(i, { deskripsi: e.target.value })} /></td>
                    <td><button type="button" className="btn btn-light btn-mini" onClick={() => ubahTugas({ rubrik: { ...tugas.rubrik, kriteria: tugas.rubrik.kriteria.filter((_, j) => j !== i) } })}>✕</button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td /><td>Jumlah bobot</td><td className={jumlahBobot === 100 ? "pt-oke" : "pt-kurang"}>{jumlahBobot}%</td><td colSpan={2}>{!cekRubrik.ok && cekRubrik.pesan}</td></tr></tfoot>
            </table>
          </div>
        )}
      </section>

      {/* ---------- 3. TEMPLATE ---------- */}
      <section className="panel pt-langkah">
        <h3><span>3</span> Template laporan <em className="pt-oke">{tugas.namaTemplate}</em></h3>
        <div className="pt-tombol">
          <label className="btn btn-primary">
            {sibuk === "template" ? "Membaca…" : "⇧ Unggah template"}
            <input type="file" hidden accept=".md,.markdown,.txt,.docx,.pdf,.doc,.rtf,.odt" disabled={Boolean(sibuk)}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void unggahTemplate(f); }} />
          </label>
          <button type="button" className="btn btn-light" onClick={() => ubahTugas({ template: TEMPLATE_BAWAAN, namaTemplate: "Template bawaan" })}>Pakai template bawaan</button>
          <button type="button" className="btn btn-light" onClick={pratinjauTemplate}>Pratinjau PDF</button>
          <button type="button" className="btn btn-light" onClick={() => unduh(tugas.template, "Template_Laporan_Penilaian.md", "text/markdown")}>⇩ Template (.md)</button>
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
          Bagian bertanda ＋ tidak ada di template dan akan ditambahkan di akhir laporan. Penanda {"{{nama}}"}, {"{{nim}}"},
          {" {{nilai}}"}, {"{{predikat}}"}, atau [Nama Mahasiswa] di template juga diisi.
        </p>
      </section>

      {/* ---------- 4. TUGAS MAHASISWA ---------- */}
      <section className="panel pt-langkah">
        <h3><span>4</span> Tugas mahasiswa {baris.length > 0 && <em className="pt-oke">{baris.length} mahasiswa</em>}</h3>
        <div
          className="pt-jatuh"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (!sibuk && !jalan) void terimaBerkas(e.dataTransfer.files); }}
        >
          <b>{sibuk === "unggah" ? "Membongkar berkas…" : "Tarik berkas ke sini"}</b>
          <span>zip/rar unduhan Google Drive, PDF, Word (.docx/.doc), Excel (.xlsx/.xls), PowerPoint, gambar; boleh banyak sekaligus</span>
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
            {baris.length > 0 && (
              <button type="button" className="btn btn-light" disabled={jalan}
                onClick={() => { if (window.confirm("Kosongkan daftar mahasiswa beserta hasilnya?")) { setBaris([]); setUji(null); } }}>Kosongkan daftar</button>
            )}
          </div>
        </div>
        {peringatan.length > 0 && (
          <div className="cbtv-catatan"><b>Berkas yang dilewati</b><ul>{peringatan.map((p) => <li key={p}>{p}</li>)}</ul></div>
        )}
      </section>

      {/* ---------- 5. PENILAIAN ---------- */}
      <section className="panel pt-langkah">
        <h3><span>5</span> Penilaian AI & laporan PDF</h3>
        <div className="pt-tombol">
          <button type="button" className="btn btn-light" disabled={!bolehNilai || !jumlahBerkas} onClick={() => void ujiSatu()}
            title="Nilai satu mahasiswa dulu dan lihat jawaban AI apa adanya">🧪 Uji 1 mahasiswa</button>
          <button type="button" className="btn btn-primary" disabled={!bolehNilai || !jumlahBerkas} onClick={() => void nilaiSemua(false)}>
            ✨ Nilai yang belum ({baris.filter((b) => b.berkas.length && (!b.hasil || b.status === "gagal")).length})
          </button>
          <button type="button" className="btn btn-light" disabled={!bolehNilai || !jumlahBerkas} onClick={() => void nilaiSemua(true)}>Nilai ulang semua</button>
          {jalan && <button type="button" className="btn btn-gagal" onClick={() => { berhenti.current = true; }}>Hentikan</button>}
          <span className="pt-pisah" />
          <button type="button" className="btn btn-light" disabled={!jumlahSelesai || sibuk === "zip"} onClick={() => void unduhSemua()}>
            {sibuk === "zip" ? "Menyusun…" : `⇩ Semua PDF + rekap (.zip, ${jumlahSelesai})`}
          </button>
          <button type="button" className="btn btn-light" disabled={!jumlahSelesai} onClick={() => void unduhRekap()}>⇩ Rekap nilai (.xlsx)</button>
        </div>
        {!cekRubrik.ok && <p className="cbt-catatan">Lengkapi rubrik di langkah 2 lebih dulu ({cekRubrik.pesan || "belum ada kriteria"}).</p>}
        {(jalan || prosesJalan > 0) && (
          <div className="pt-kemajuan">
            <div style={{ width: `${Math.round((jumlahSelesai / Math.max(1, baris.length)) * 100)}%` }} />
            <span>{jumlahSelesai} dari {baris.length} selesai{prosesJalan ? ` · ${prosesJalan} sedang diproses` : ""}</span>
          </div>
        )}
        {jumlahPeriksa > 0 && <p className="cbt-catatan">⚠ {jumlahPeriksa} hasil ditandai AI perlu dibaca dosen (keyakinan rendah, jawaban tidak lengkap, atau tidak lolos gerbang).</p>}

        {uji && <PanelUji uji={uji} rubrik={tugas.rubrik} onTutup={() => setUji(null)} />}

        {baris.length > 0 && (
          <div className="pt-tabel-wadah">
            <table className="pt-tabel pt-mhs">
              <thead>
                <tr><th>#</th><th>Nama</th><th>NIM</th><th>Berkas</th><th>Status</th><th>Nilai</th><th /></tr>
              </thead>
              <tbody>
                {baris.map((b, i) => {
                  const nilai = b.hasil ? b.hasil.nilai : null;
                  const pred = nilai !== null ? predikatTugas(nilai, tugas.skala).huruf : "";
                  return (
                    <FragmenBaris key={b.id}>
                      <tr className={buka === b.id ? "on" : ""}>
                        <td>{i + 1}</td>
                        <td><input value={b.nama} onChange={(e) => ubahBaris(b.id, { nama: e.target.value })} placeholder={b.sumber} /></td>
                        <td><input value={b.nim} onChange={(e) => ubahBaris(b.id, { nim: e.target.value.replace(/\s/g, "") })} /></td>
                        <td title={b.namaBerkas.join("\n")}>
                          {b.namaBerkas.length} berkas
                          {!b.berkas.length && b.hasil && <small> (unggah ulang untuk menilai ulang)</small>}
                        </td>
                        <td>
                          <span className={`pt-status ${b.status}`}>{LABEL_STATUS[b.status]}</span>
                          {b.hasil?.perluDosen && !b.hasil.diubahDosen && <span className="pt-awas" title="Perlu dibaca dosen">⚠</span>}
                          {b.hasil?.diubahDosen && <span className="pt-dosen" title="Sudah disunting dosen">✎</span>}
                          {(hitungNim.get(b.nim) ?? 0) > 1 && <small className="pt-galat">NIM ini ada di baris lain; gabungkan atau hapus salah satunya.</small>}
                          {b.galat && <small className="pt-galat">{b.galat}</small>}
                        </td>
                        <td>{nilai !== null ? <b>{ejaNilai(nilai)} · {pred}</b> : "–"}</td>
                        <td><div className="pt-aksi">
                          {b.hasil && <button type="button" className="btn btn-light btn-mini" onClick={() => setBuka(buka === b.id ? null : b.id)}>{buka === b.id ? "Tutup" : "Periksa"}</button>}
                          {b.hasil && <button type="button" className="btn btn-light btn-mini" onClick={() => unduhSatu(b)}>PDF</button>}
                          {b.berkas.length > 0 && !jalan && (
                            <button type="button" className="btn btn-light btn-mini" disabled={!bolehNilai}
                              onClick={() => { setJalan(true); berhenti.current = false; void nilaiSatu(b.id, tugas).catch((e) => ubahBaris(b.id, { status: "gagal", galat: (e as Error).message })).finally(() => setJalan(false)); }}>
                              {b.hasil ? "Nilai ulang" : "Nilai"}
                            </button>
                          )}
                          <button type="button" className="btn btn-light btn-mini" disabled={jalan} onClick={() => setBaris((s) => s.filter((x) => x.id !== b.id))}>✕</button>
                        </div></td>
                      </tr>
                      {buka === b.id && b.hasil && (
                        <tr className="pt-rinci"><td colSpan={7}>
                          <RincianHasil baris={b} tugas={tugas} onUbah={(f) => ubahHasil(b.id, f)} />
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
    </div>
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
    [h.gerbang.lolos, h.gerbang.lolos ? "Lolos gerbang penilaian" : `Tidak lolos gerbang: ${h.gerbang.alasan}`],
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
        Dikirim: {uji.permintaan.teks.toLocaleString("id-ID")} huruf teks, {uji.permintaan.lampiran.length} lampiran
        ({uji.permintaan.ukuranKb.toLocaleString("id-ID")} KB). {uji.permintaan.keterangan}
      </p>
      {uji.permintaan.lampiran.length > 0 && <p className="cbt-catatan">Lampiran: {uji.permintaan.lampiran.join(", ")}</p>}
      {uji.galat && <div className="dsh-error">Gagal{uji.status ? ` (HTTP ${uji.status})` : ""}: {uji.galat}</div>}
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
// RINCIAN DAN SUNTINGAN SATU MAHASISWA
// ------------------------------------------------------------

function RincianHasil({ baris: b, tugas, onUbah }: { baris: Baris; tugas: Tugas; onUbah: (f: (h: Hasil) => Hasil) => void }) {
  const h = b.hasil!;
  const pred = predikatTugas(h.nilai, tugas.skala);
  return (
    <div className="pt-rincian">
      <div className="pt-rincian-kepala">
        <div>
          <b>{b.nama || b.sumber}</b> · {b.nim || "NIM belum diisi"}
          <small> · {h.model} · keyakinan {h.keyakinan}{h.diubahDosen ? " · disunting dosen" : ""}</small>
        </div>
        <div><b>{ejaNilai(h.nilai)}</b> / 100 · {pred.huruf} ({ejaRentang(pred)}){!h.lengkap && " · belum lengkap"}</div>
      </div>
      {(h.identitas.nama || h.identitas.nim) && (h.identitas.nama !== b.nama || h.identitas.nim !== b.nim) && (
        <p className="cbt-catatan">Dokumen menyebut: {h.identitas.nama || "–"} {h.identitas.nim && `(NIM ${h.identitas.nim})`}</p>
      )}
      {!h.gerbang.lolos && <div className="dsh-error">Tidak lolos gerbang: {h.gerbang.alasan || "kiriman tidak dapat dinilai"}. Seluruh skor 0; periksa berkasnya.</div>}
      {h.masalah.length > 0 && <div className="cbtv-catatan"><b>Penyimpangan jawaban AI</b><ul>{h.masalah.map((m) => <li key={m}>{m}</li>)}</ul></div>}
      {b.catatan && b.catatan.length > 0 && <div className="cbtv-catatan"><b>Catatan pembacaan berkas</b><ul>{b.catatan.map((m) => <li key={m}>{m}</li>)}</ul></div>}
      {b.keterangan && <p className="cbt-catatan">Lampiran visual: {b.keterangan}</p>}

      <label className="pt-lebar"><span>Judul karya</span>
        <input value={h.judul} onChange={(e) => onUbah((x) => ({ ...x, judul: e.target.value }))} />
      </label>
      <table className="pt-tabel">
        <thead><tr><th>Kriteria</th><th>Deskripsi capaian</th><th>Skor</th></tr></thead>
        <tbody>
          {tugas.rubrik.kriteria.map((k, i) => {
            const kr = h.kriteria[i] ?? { urut: i, skor: null, capaian: "" };
            return (
              <tr key={i}>
                <td><b>{i + 1}. {k.nama}</b><small> {k.bobot}%</small></td>
                <td><textarea rows={3} value={kr.capaian} onChange={(e) => onUbah((x) => ({ ...x, kriteria: tugas.rubrik.kriteria.map((_, j) => (j === i ? { ...kr, capaian: e.target.value } : (x.kriteria[j] ?? { urut: j, skor: null, capaian: "" }))) }))} /></td>
                <td><input type="number" min={0} max={100} value={kr.skor ?? ""} onChange={(e) => onUbah((x) => ({ ...x, kriteria: tugas.rubrik.kriteria.map((_, j) => (j === i ? { ...kr, skor: skorAman(e.target.value) } : (x.kriteria[j] ?? { urut: j, skor: null, capaian: "" }))) }))} /></td>
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
          <textarea rows={3} value={h.perbaikan.map((p) => (p.aspek ? `${p.aspek}: ${p.uraian}` : p.uraian)).join("\n")}
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
      {b.ringkas && (
        <p className="cbt-catatan">
          Berkas dibaca: {b.ringkas.map((r) => `${r.nama} (${r.jenis}${r.bagian ? `, ${r.bagian} ${r.jenis === "pdf" ? "hlm" : "bagian"}` : ""}, ${r.kata} kata)`).join("; ")}
        </p>
      )}
    </div>
  );
}
