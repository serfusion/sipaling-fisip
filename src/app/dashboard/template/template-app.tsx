"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useAutoLogout } from "@/lib/use-auto-logout";
import { sanitizeLetterHtml } from "@/lib/sanitize-html";
import { DEFAULT_LETTER_HTML, LETTER_TITLES, type LetterSlug } from "./letter-defaults";
import { AM, HMS, computeTotals, extractBio, parseSheetRows, type Aoa, type CourseRow } from "./transkrip-parse";
import { isiInggris, panenKamus } from "@/lib/kamus-matkul";
import { periksaSiapArsip, predikatKelulusan, sidikTranskrip } from "@/lib/arsip-transkrip";
import {
  TEMPLATE_BIO_ROWS, TEMPLATE_NILAI_CONTOH, TEMPLATE_NILAI_HEADER,
  TEMPLATE_SHEET_BIO, TEMPLATE_SHEET_NILAI,
  isTemplateWorkbook, parseTemplateBio, parseTemplateNilai,
} from "./transkrip-template";

type Role =
  | "super_admin"
  | "admin"
  | "admin_umum"
  | "admin_akademik"
  | "admin_prodi"
  | "admin_pddikti"
  | "admin_perpustakaan"
  | "admin_laboratorium"
  | "dosen";

type SessionProfile = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  lecturerId: number | null;
};

const TRANSKRIP_ROLES: Role[] = ["super_admin", "admin", "admin_akademik"];
const SURAT_ROLES: Role[] = ["super_admin", "admin", "admin_umum"];
const UMUM_DRIVE_URL = process.env.NEXT_PUBLIC_UMUM_TEMPLATE_DRIVE_URL || "";

const PRODI = [
  { nama: "Ilmu Pemerintahan", kode: "65201" },
  { nama: "Ilmu Komunikasi", kode: "70201" },
];

function todayID() {
  return new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function fmtIPK(value: number) {
  return value.toFixed(2).replace(".", ",");
}

/* ---------- komponen utama ---------- */

type Jenis = "transkrip" | LetterSlug;
const LETTER_SLUGS: LetterSlug[] = ["surat-aktif", "izin-penelitian", "pkl"];

export default function TemplateApp({ profile, initialJenis, initialArsip }: { profile: SessionProfile | null; initialJenis?: string; initialArsip?: string }) {
  useAutoLogout(Boolean(profile));
  const canTranskrip = Boolean(profile && TRANSKRIP_ROLES.includes(profile.role));
  const canSurat = Boolean(profile && SURAT_ROLES.includes(profile.role));
  const normalizedInitial: Jenis | null =
    initialJenis === "surat" || initialJenis === "surat-aktif" ? "surat-aktif"
      : initialJenis === "izin-penelitian" ? "izin-penelitian"
        : initialJenis === "pkl" ? "pkl"
          : initialJenis === "transkrip-en" ? "transkrip-en"
            : initialJenis === "transkrip" ? "transkrip"
              : null;
  const defaultJenis: Jenis =
    (normalizedInitial === "transkrip" || normalizedInitial === "transkrip-en") && canTranskrip ? normalizedInitial
      : normalizedInitial && normalizedInitial !== "transkrip" && normalizedInitial !== "transkrip-en" && canSurat ? normalizedInitial
        : canTranskrip ? "transkrip"
          : "surat-aktif";
  const [jenis, setJenis] = useState<Jenis>(defaultJenis);

  if (!profile) {
    return (
      <div className="dsh">
        <main className="dsh-locked">
          <section className="panel dsh-locked-card">
            <h2>Login diperlukan</h2>
            <p>Modul template hanya untuk admin yang sudah login.</p>
            <a href="/login" className="btn btn-primary">Masuk ke Dashboard →</a>
          </section>
        </main>
      </div>
    );
  }

  if (!canTranskrip && !canSurat) {
    return (
      <div className="dsh">
        <main className="dsh-locked">
          <section className="panel dsh-locked-card">
            <h2>Template unit Anda belum tersedia</h2>
            <p>Modul template saat ini berisi Transkrip Nilai (Admin Akademik) dan Surat Aktif Kuliah (Admin Umum). Template untuk unit {profile.role.replace("admin_", "").replace("_", " ")} akan ditambahkan dengan pola yang sama.</p>
            <Link href="/dashboard" className="btn btn-primary">← Kembali ke Dashboard</Link>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="tpl-shell">
      <header className="tpl-head no-print">
        <Link href="/dashboard" className="tpl-back">← Dashboard</Link>
        <h1>Template Dokumen</h1>
        <div className="tpl-tabs">
          {canTranskrip && (
            <button type="button" className={jenis === "transkrip" ? "on" : ""} onClick={() => setJenis("transkrip")}>Transkrip Nilai</button>
          )}
          {canTranskrip && (
            <button type="button" className={jenis === "transkrip-en" ? "on" : ""} onClick={() => setJenis("transkrip-en")}>Transkrip (ID+EN)</button>
          )}
          {canSurat && LETTER_SLUGS.map((slug) => (
            <button type="button" key={slug} className={jenis === slug ? "on" : ""} onClick={() => setJenis(slug)}>{LETTER_TITLES[slug]}</button>
          ))}
        </div>
      </header>
      {jenis === "transkrip" && canTranskrip ? <TranskripModule lang="id" arsipAwal={initialArsip} key="tk-id" />
        : jenis === "transkrip-en" && canTranskrip ? <TranskripModule lang="en" arsipAwal={initialArsip} key="tk-en" />
          : <LetterModule slug={jenis === "transkrip" || jenis === "transkrip-en" ? "surat-aktif" : jenis} key={jenis} />}
    </div>
  );
}

/**
 * Kalimat ringkas tentang pengisian kolom Inggris.
 *
 * Yang hanya tebakan kata DISEBUT jumlahnya, bukan disembunyikan. Transkrip
 * ikut dilegalisir; admin harus tahu baris mana yang perlu ia lihat sendiri
 * sebelum mencetaknya.
 */
function ringkasBahasa(hasil: { dariKamus: number; dariKasar: number; sudahAda: number; perluDicek: string[] }) {
  const bagian: string[] = [];
  if (hasil.dariKamus > 0) bagian.push(`${hasil.dariKamus} nama Inggris terisi dari kamus`);
  if (hasil.sudahAda > 0) bagian.push(`${hasil.sudahAda} sudah berbahasa Inggris di filenya`);
  if (hasil.dariKasar > 0) {
    const contoh = hasil.perluDicek.slice(0, 3).join(", ");
    bagian.push(
      `${hasil.dariKasar} diterjemahkan kata per kata dan PERLU DICEK` +
        (contoh ? ` (${contoh}${hasil.perluDicek.length > 3 ? ", …" : ""})` : ""),
    );
  }
  return bagian.length ? `; ${bagian.join(", ")}` : "";
}

/* ---------- modul transkrip ---------- */

// Pemecah dwibahasa: menerima pemisah "|" maupun "/".
// Bagian Inggris SELALU dimiringkan dan diletakkan di baris bawah.
function splitBi(text: string): [string, string] {
  if (text.includes("|")) {
    const [a, b] = text.split("|");
    return [a, (b || "").trim()];
  }
  const i = text.indexOf("/");
  if (i >= 0 && text.slice(i + 1).trim()) return [text.slice(0, i + 1), text.slice(i + 1).trim()];
  return [text, ""];
}

function Lbl({ text }: { text: string }) {
  const [id, en] = splitBi(text);
  return en ? <>{id}<i className="tk-lbl-en">{en}</i></> : <>{id}</>;
}

// Sebaris: Inggris miring, TIDAK turun ke baris bawah.
function BiIn({ text }: { text: string }) {
  const [id, en] = splitBi(text);
  return en ? <>{id} <i>{en}</i></> : <>{id}</>;
}

function BiVal({ text }: { text: string }) {
  const [id, en] = splitBi(text);
  return en ? <>{id}<i className="bi-en">{en}</i></> : <>{id}</>;
}

const PRODI_EN: Record<string, string> = {
  "Ilmu Komunikasi": "COMMUNICATION SCIENCE",
  "Ilmu Pemerintahan": "GOVERNMENT SCIENCE",
};

const PREDIKAT_EN: Record<string, string> = {
  "Dengan Pujian": "Cum Laude (With Honors)",
  "Sangat Memuaskan": "Very Satisfactory",
  "Memuaskan": "Satisfactory",
  "Lulus": "Pass",
};

/**
 * Biodata bawaan satu transkrip kosong.
 *
 * Dibuat sebagai fungsi, bukan tetapan: memuat transkrip lain harus mulai
 * dari lembar yang benar-benar bersih. Kalau isian lama hanya ditimpa
 * sebagian, konsentrasi atau nomor ijazah milik mahasiswa sebelumnya bisa
 * ikut tercetak pada transkrip mahasiswa berikutnya.
 */
function metaAwal() {
  return {
    noijazah: "",
    nppt: "041051",
    yudisium: "",
    akred: "LAMSPAK Nomor 099/AK.03.05/2026",
    nama: "",
    nim: "",
    prodi: PRODI[0].nama,
    ttl: "",
    konsentrasi: "",
    jenjang: "SARJANA / BACHELOR DEGREE (S-1)",
    judul: "",
    tanggal: todayID(),
    dekan: "Dr. H. Achmad Kosasih, MM.",
    nbmdekan: "739.574",
    rektor: "Dr. H. Desri Arwen, M.Pd.",
    nbmrektor: "837.138",
  };
}

/** Satu baris pada Arsip Transkrip Nilai (ringkasan; tanpa isi mata kuliah). */
type BarisArsip = {
  id: number;
  nim: string;
  studentName: string;
  studyProgram: string | null;
  concentration: string | null;
  lang: string;
  courseCount: number;
  totalSks: number;
  totalMutu: number;
  ipk: string;
  predikat: string | null;
  yudisium: string | null;
  thesisTitle: string | null;
  savedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function tanggalSingkat(waktu: string | null) {
  if (!waktu) return "-";
  const tanggal = new Date(waktu);
  return Number.isNaN(tanggal.getTime())
    ? "-"
    : tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function TranskripModule({ lang, arsipAwal }: { lang: "id" | "en"; arsipAwal?: string }) {
  const EN = lang === "en";
  const customSlug: LetterSlug = EN ? "transkrip-en" : "transkrip-custom";
  const L = EN
    ? {
        title: "TRANSKRIP NILAI", subtitle: "OFFICIAL ACADEMIC TRANSCRIPT",
        noij: "NOMOR IJAZAH NASIONAL/|DEGREE CERTIFICATE NUMBER", nppt: "NOMOR POKOK PERGURUAN TINGGI/|INSTITUTIONAL REGISTRATION NUMBER",
        yud: "TANGGAL YUDISIUM/|DEGREE CONFERRAL DATE", akred: "TERAKREDITASI/|ACCREDITED",
        nama: "NAMA MAHASISWA/|COMPLETE NAME", fak: "FAKULTAS/FACULTY",
        fakval: "ILMU SOSIAL DAN ILMU POLITIK/|SOCIAL AND POLITICAL SCIENCES",
        nim: "NOMOR INDUK MAHASISWA/|STUDENT REGISTRATION NUMBER", npps: "NOMOR POKOK PROGRAM STUDI/|STUDY PROGRAM IDENTIFICATION NUMBER",
        prodi: "PROGRAM STUDI/|STUDY PROGRAM",
        ttl: "TEMPAT, TGL LAHIR|PLACE AND DATE OF BIRTH", jenjangLbl: "JENJANG/COURSE", kons: "KONSENTRASI/CONCENTRATION",
        th: ["NO", "KODE MK|Course", "NAMA MATA KULIAH|Descriptions", "K|CR", "HM|LG", "AM|GP", "MK|WM"],
        totKredit: "Total Kredit / Total Credits Accomplished", totNilai: "Total Nilai / Total Grade Points", ipkLbl: "Indeks Prestasi Kumulatif / Grade Point Average (GPA)", predLbl: "Predikat Kelulusan / Graduation Honors",
        judul: "JUDUL SKRIPSI/ THESIS TITLE:", ket: "",
        ketval: "K = Kredit/Credits · HM = Huruf Mutu/Grade · AM = Angka Mutu/Grade Point · MK = Mutu Kredit/Quality Points (K × AM)",
        meng: "Mengetahui / Acknowledged by,", rektor: "Rektor / Rector,", dekan: "Dekan / Dean,",
      }
    : {
        title: "TRANSKRIP NILAI", subtitle: "",
        noij: "Nomor Ijasah Nasional", nppt: "Nomor Pokok Perguruan Tinggi",
        yud: "Tanggal Yudisium", akred: "Terakreditasi",
        nama: "NAMA MAHASISWA",
        jenjangLbl: "JENJANG", fak: "Fakultas", fakval: "Ilmu Sosial Dan Ilmu Politik",
        nim: "NOMOR INDUK MAHASISWA", npps: "Nomor Pokok Program Studi", prodi: "PROGRAM STUDI",
        ttl: "TEMPAT, TGL LAHIR", kons: "KONSENTRASI",
        th: ["NO", "KODE MK", "NAMA MATA KULIAH", "K", "HM", "AM", "MK"],
        totKredit: "Total Kredit", totNilai: "Total Nilai", ipkLbl: "Indeks Prestasi Kumulatif", predLbl: "Predikat Kelulusan",
        judul: "JUDUL SKRIPSI/ THESIS TITLE:", ket: "",
        ketval: "K = Kredit/SKS · HM = Huruf Mutu (A,B,C,D) · AM = Angka Mutu (1,2,3,4) · MK = Mutu Kredit (K × AM)",
        meng: "Mengetahui,", rektor: "Rektor,", dekan: "Dekan,",
      };
  const showIpk = (value: number) => (EN ? value.toFixed(2) : fmtIPK(value));
  const showPredikat = (value: string) => (EN && PREDIKAT_EN[value] ? `${value} / ${PREDIKAT_EN[value]}` : value);
  const showProdi = (value: string) => (PRODI_EN[value] ? `${value.toUpperCase()} / ${PRODI_EN[value]}` : value.toUpperCase());

  const [customMode, setCustomMode] = useState(false);
  const [savingData, setSavingData] = useState(false);
  const [showBio, setShowBio] = useState(true);
  const [showHint, setShowHint] = useState(true);
  const [editLayout, setEditLayout] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  // --- Tata letak hasil suntingan tangan ---------------------------------
  //
  // Selama `tataLetak` masih null, pratinjau dirender dari data: mengubah
  // biodata atau nilai langsung terlihat. Begitu admin menekan "Edit tata
  // letak", bentuk yang sedang tampil DIBEKUKAN menjadi HTML dan sejak itu
  // isinya milik DOM — React tidak pernah merendernya ulang.
  //
  // Dua penyakit sekaligus yang disembuhkan pembekuan ini:
  //   1. Setiap render ulang React (pesan sukses muncul, daftar arsip
  //      terbaca) menghapus suntingan yang sedang dikerjakan.
  //   2. Yang dikirim ke tombol simpan dulu hanya `meta` + `rows`, sehingga
  //      yang tersimpan selalu bentuk bawaannya — suntingan tata letaknya
  //      tidak pernah ikut, persis keluhan "save-nya cuma yang default".
  const [tataLetak, setTataLetak] = useState<string | null>(null);
  const [tataLetakKotor, setTataLetakKotor] = useState(false);
  const [pastiOtomatis, setPastiOtomatis] = useState(false);
  // Menandai pembekuan yang lahir dari sesi sunting ini sendiri. Kalau admin
  // membuka lalu menutup mode sunting tanpa mengubah apa pun, pratinjau
  // kembali mengikuti data — bukan ikut membeku tanpa ia minta.
  const bekuBaru = useRef(false);
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [meta, setMeta] = useState(metaAwal);
  // Kamus tambahan hasil koreksi admin sebelumnya. Dibaca sekali saat modul
  // dibuka; kalau gagal, kamus bawaan tetap bekerja.
  const [kamusTambahan, setKamusTambahan] = useState<Record<string, string>>({});
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [importMsg, setImportMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [workbook, setWorkbook] = useState<unknown>(null);

  // --- Arsip Transkrip Nilai ---------------------------------------------
  // `sidikArsip` menyimpan bentuk transkrip pada saat terakhir diarsipkan.
  // Selama yang di layar berbeda dari itu, statusnya berbunyi "belum
  // disimpan" — dan memang belum: tidak ada penyimpanan yang berjalan sendiri.
  const [arsip, setArsip] = useState<BarisArsip[]>([]);
  const [arsipSibuk, setArsipSibuk] = useState("");
  const [arsipPesan, setArsipPesan] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [sidikArsip, setSidikArsip] = useState<string | null>(null);
  const [arsipBuka, setArsipBuka] = useState(true);
  const [cariArsip, setCariArsip] = useState("");

  // Kamus tambahan dibaca sekali saat modul dibuka, supaya unggahan pertama
  // pun sudah memakai koreksi yang pernah dibuat admin sebelumnya.
  useEffect(() => {
    let hidup = true;
    fetch("/api/kamus-matkul", { cache: "no-store" })
      .then((jawab) => jawab.json())
      .then((isi: { success?: boolean; kamus?: Record<string, string> }) => {
        if (hidup && isi.success && isi.kamus) setKamusTambahan(isi.kamus);
      })
      .catch(() => {
        // Kamus bawaan tetap bekerja tanpa yang tambahan.
      });
    return () => {
      hidup = false;
    };
  }, []);

  const prodiKode = PRODI.find((item) => item.nama === meta.prodi)?.kode || "";
  // Prodi Ilmu Pemerintahan tidak memiliki konsentrasi -> tulis nama prodi
  // utuh. Nama prodi selalu ditulis dwibahasa seperti pada baris PROGRAM
  // STUDI di sebelahnya, sehingga barisnya berbunyi
  // "KONSENTRASI/CONCENTRATION: ILMU PEMERINTAHAN / GOVERNMENT SCIENCE" —
  // bukan hanya sisi Indonesianya saja.
  const konsentrasiText = meta.konsentrasi && !/pemerintahan/i.test(meta.prodi)
    ? meta.konsentrasi.toUpperCase()
    : showProdi(meta.prodi);
  // Satu kelas untuk kedua cabang render dokumen (bawaan & hasil suntingan).
  const kelasDoc =
    "tk-page tk-doc letter-page" + (EN ? " tk-bilingual" : "") + (editLayout ? " tk-editable" : "");
  // WAJIB di-memo. React memasang ulang dangerouslySetInnerHTML begitu OBJEK
  // propnya berganti — bukan begitu isinya berganti. Objek baru pada tiap
  // render berarti dokumen ditanam ulang pada tiap render, dan suntingan yang
  // sedang dikerjakan admin terhapus tepat pada saat ia mengetik.
  const isiTataLetak = useMemo(
    () => (tataLetak === null ? undefined : { __html: tataLetak }),
    [tataLetak],
  );
  const totals = useMemo(() => computeTotals(rows), [rows]);
  const half = Math.ceil(rows.length / 2);
  const columns = [rows.slice(0, half), rows.slice(half)];

  function applyBio(bio: Record<string, string>) {
    setMeta((current) => {
      const next = { ...current };
      if (bio.nama) next.nama = bio.nama;
      if (bio.nim) next.nim = bio.nim;
      if (bio.ttl) next.ttl = bio.ttl;
      if (bio.yudisium) next.yudisium = bio.yudisium;
      if (bio.akred) next.akred = bio.akred;
      if (bio.noijazah) next.noijazah = bio.noijazah;
      if (bio.judul) next.judul = bio.judul;
      if (bio.konsentrasi) next.konsentrasi = bio.konsentrasi;
      if (bio.jenjang) next.jenjang = bio.jenjang;
      if (bio.nppt) next.nppt = bio.nppt;
      if (bio.tanggal) next.tanggal = bio.tanggal;
      if (bio.dekan) next.dekan = bio.dekan;
      if (bio.nbmdekan) next.nbmdekan = bio.nbmdekan;
      if (bio.rektor) next.rektor = bio.rektor;
      if (bio.nbmrektor) next.nbmrektor = bio.nbmrektor;
      if (bio.prodi) {
        const match = PRODI.find((item) => item.nama.toLowerCase() === bio.prodi.trim().toLowerCase());
        if (match) next.prodi = match.nama;
      }
      return next;
    });
  }

  async function parseSheetByName(wb: unknown, name: string) {
    const XLSX = await import("xlsx");
    const workbookTyped = wb as { Sheets: Record<string, unknown> };
    const sheet = workbookTyped.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json(sheet as Parameters<typeof XLSX.utils.sheet_to_json>[0], { header: 1, defval: "", raw: false }) as Aoa;
    const parsed = parseSheetRows(aoa);
    const bio = extractBio(aoa);
    // Berkas mentah dari SIMAK hanya berbahasa Indonesia. Kolom Inggrisnya
    // diisi dari kamus supaya transkrip English tidak perlu menunggu kiriman
    // KUI; yang sudah berisi — berkas dwibahasa — tidak pernah ditimpa.
    const bahasa = isiInggris(parsed, kamusTambahan);
    setRows(bahasa.rows);
    applyBio(bio);
    const dilepas = lepasTataLetak();
    setImportMsg({
      kind: "ok",
      text: `Sheet "${name}": ${parsed.length} mata kuliah terbaca (dua blok kolom digabung)` +
        (bio.nama ? `; biodata ${bio.nama} ikut terisi` : "") +
        ringkasBahasa(bahasa) +
        ". Semua diproses di browser Anda, file tidak diunggah ke mana pun." +
        (dilepas ? " Tata letak kembali ke bentuk bawaan karena isinya diganti." : ""),
    });
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);

      if (isTemplateWorkbook(wb.SheetNames)) {
        // Format "Template Transkrip SiPaling" (2 sheet, 1 baris per mata kuliah)
        const toAoa = (name: string) => {
          const sheet = wb.Sheets[name];
          return sheet
            ? (XLSX.utils.sheet_to_json(sheet as Parameters<typeof XLSX.utils.sheet_to_json>[0], { header: 1, defval: "", raw: false }) as Aoa)
            : ([] as Aoa);
        };
        const parsed = parseTemplateNilai(toAoa(TEMPLATE_SHEET_NILAI));
        const bio = parseTemplateBio(toAoa(TEMPLATE_SHEET_BIO));
        const bahasa = isiInggris(parsed, kamusTambahan);
        setRows(bahasa.rows);
        applyBio(bio);
        const dilepas = lepasTataLetak();
        setImportMsg({
          kind: "ok",
          text: `Template SiPaling terbaca: ${parsed.length} mata kuliah` +
            (bio.nama ? `, biodata ${bio.nama} ikut terisi` : "") +
            ringkasBahasa(bahasa) +
            ". Semua diproses di browser Anda." +
            (dilepas ? " Tata letak kembali ke bentuk bawaan karena isinya diganti." : ""),
        });
        return;
      }
      await parseSheetByName(wb, wb.SheetNames[0]);
    } catch (reason: unknown) {
      setImportMsg({ kind: "err", text: reason instanceof Error ? reason.message : "File tidak dapat dibaca." });
    }
  }

  async function downloadTemplate() {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const bioSheet = XLSX.utils.aoa_to_sheet([["LABEL", "ISI"], ...TEMPLATE_BIO_ROWS]);
      bioSheet["!cols"] = [{ wch: 26 }, { wch: 52 }];
      XLSX.utils.book_append_sheet(wb, bioSheet, TEMPLATE_SHEET_BIO);

      const nilaiSheet = XLSX.utils.aoa_to_sheet([TEMPLATE_NILAI_HEADER, ...TEMPLATE_NILAI_CONTOH]);
      nilaiSheet["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 42 }, { wch: 42 }, { wch: 5 }, { wch: 5 }];
      XLSX.utils.book_append_sheet(wb, nilaiSheet, TEMPLATE_SHEET_NILAI);

      const panduan = XLSX.utils.aoa_to_sheet([
        ["PANDUAN PENGISIAN TEMPLATE TRANSKRIP"],
        [""],
        ["1. Sheet \"Biodata\": isi kolom ISI saja, JANGAN mengubah tulisan pada kolom LABEL."],
        ["2. Sheet \"Nilai\": satu baris untuk satu mata kuliah. Hapus 3 baris contoh, lalu isi data asli."],
        ["3. Kolom K = jumlah SKS (angka). Kolom HM = huruf mutu A/B/C/D/E."],
        ["4. Mata kuliah tanpa nilai huruf (mis. Skripsi/Seminar): KOSONGKAN kolom HM."],
        ["   SKS-nya tetap dihitung pada total, tetapi tidak menambah angka mutu."],
        ["5. Kolom COURSE TITLE (INGGRIS) boleh dikosongkan; bila kosong, baris Inggris"],
        ["   pada transkrip memakai nama Indonesia."],
        ["6. AM, MK, Total, dan IPK dihitung OTOMATIS oleh sistem - tidak perlu diisi."],
        ["7. Program Studi tulis persis: Ilmu Komunikasi  atau  Ilmu Pemerintahan."],
        ["8. Simpan file, lalu unggah lewat tombol Impor Excel di dashboard transkrip."],
      ]);
      panduan["!cols"] = [{ wch: 96 }];
      XLSX.utils.book_append_sheet(wb, panduan, "Panduan");

      XLSX.writeFile(wb, "Template-Transkrip-SiPaling.xlsx");
      setImportMsg({ kind: "ok", text: "Template terunduh. Isi sheet Biodata & Nilai, lalu unggah kembali lewat Impor Excel." });
    } catch (reason: unknown) {
      setImportMsg({ kind: "err", text: reason instanceof Error ? reason.message : "Template gagal dibuat." });
    }
  }

  /**
   * Ingat nama Inggris yang dikoreksi tangan.
   *
   * Dipanggil oleh KEDUA tombol simpan. Kalau hanya salah satu yang memanen,
   * kamusnya berhenti tumbuh begitu admin berpindah kebiasaan ke tombol yang
   * lain — dan mata kuliah yang sama menuntut koreksi tangan yang sama lagi
   * pada tiap unggahan berikutnya.
   */
  async function ingatKamus() {
    try {
      const pasangan = panenKamus(rows);
      if (pasangan.length === 0) return 0;
      const balas = await fetch("/api/kamus-matkul", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pasangan }),
      });
      const isi = (await balas.json()) as { success?: boolean; baru?: number };
      if (!isi.success) return 0;
      setKamusTambahan((kini) => {
        const berikut = { ...kini };
        for (const p of pasangan) berikut[p.kode] = p.en;
        return berikut;
      });
      return isi.baru ?? 0;
    } catch {
      // Kamus bersifat pelengkap; transkripnya sendiri sudah tersimpan.
      return 0;
    }
  }

  async function saveTranskripData() {
    setSavingData(true);
    try {
      // Yang dikirim adalah bentuk yang SEKARANG tampil, bukan bentuk bawaan:
      // suntingan tata letak ikut tersimpan bersama biodata dan nilainya.
      const bentuk = tataLetakKini();
      const response = await fetch("/api/transkrip-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta, rows, tataLetak: bentuk }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string; rows?: number };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Data belum tersimpan.");

      const diingat = await ingatKamus();
      if (bentuk) {
        setTataLetak(bentuk);
        setTataLetakKotor(false);
      }

      setImportMsg({
        kind: "ok",
        text:
          `Draf tersimpan: ${payload.rows} mata kuliah` +
          (bentuk ? " beserta tata letak hasil suntingan Anda." : ".") +
          (diingat > 0 ? ` ${diingat} nama Inggris diingat untuk unggahan berikutnya.` : "") +
          ` Nanti tinggal klik "Muat draf" lalu tambah/kurangi baris tanpa unggah ulang.` +
          ` Ingat: draf hanya SATU laci, transkrip mahasiswa berikutnya menimpanya.` +
          ` Yang tersimpan per mahasiswa adalah tombol "Save di Arsip Transkrip" di paling bawah.`,
      });
    } catch (reason: unknown) {
      setImportMsg({ kind: "err", text: reason instanceof Error ? reason.message : "Data belum tersimpan." });
    } finally {
      setSavingData(false);
    }
  }

  async function loadTranskripData() {
    setSavingData(true);
    try {
      const response = await fetch("/api/transkrip-data", { cache: "no-store" });
      const payload = (await response.json()) as {
        success?: boolean; message?: string; savedBy?: string | null; savedAt?: string | null;
        data?: { meta?: Record<string, string>; rows?: CourseRow[]; tataLetak?: string } | null;
      };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Data belum dapat dimuat.");
      if (!payload.data || !payload.data.rows?.length) {
        setImportMsg({ kind: "err", text: "Belum ada draf tersimpan. Simpan dulu setelah mengisi, atau muat dari Arsip Transkrip Nilai di bawah." });
        return;
      }
      setRows(payload.data.rows);
      if (payload.data.meta) setMeta({ ...metaAwal(), ...payload.data.meta });
      // Tata letak ikut dipulihkan. Kalau draf itu disimpan tanpa suntingan,
      // pratinjau kembali dirender dari data — bukan meneruskan suntingan
      // milik transkrip yang tadi ada di layar.
      pasangTataLetak(payload.data.tataLetak);
      setImportMsg({
        kind: "ok",
        text: `Dimuat: ${payload.data.rows.length} mata kuliah` +
          (payload.savedBy ? ` (disimpan oleh ${payload.savedBy})` : "") +
          (payload.data.tataLetak ? ", lengkap dengan tata letak hasil suntingan" : "") +
          ". Silakan tambah atau kurangi baris sesuai kebutuhan.",
      });
    } catch (reason: unknown) {
      setImportMsg({ kind: "err", text: reason instanceof Error ? reason.message : "Data belum dapat dimuat." });
    } finally {
      setSavingData(false);
    }
  }

  /* ---------- Tata letak hasil suntingan tangan ---------- */

  /** Bentuk yang sekarang benar-benar tampil, siap dikirim ke tombol simpan. */
  function tataLetakKini(): string {
    if (tataLetak === null) return "";
    const isi = docRef.current ? docRef.current.innerHTML : tataLetak;
    return sanitizeLetterHtml(isi);
  }

  function bukaEditTataLetak() {
    // Bekukan yang sekarang tampil, lalu suntingan berjalan di atas HTML itu.
    if (tataLetak === null && docRef.current) {
      setTataLetak(docRef.current.innerHTML);
      bekuBaru.current = true;
    } else {
      bekuBaru.current = false;
    }
    setPastiOtomatis(false);
    setEditLayout(true);
  }

  function tutupEditTataLetak() {
    if (tataLetakKotor) {
      // Yang di DOM-lah yang benar; simpan ke keadaan supaya render berikutnya
      // (mis. saat pesan sukses muncul) menanam kembali bentuk yang sama.
      setTataLetak(tataLetakKini());
    } else if (bekuBaru.current) {
      // Dibuka lalu ditutup tanpa mengubah apa pun -> kembali mengikuti data.
      setTataLetak(null);
    }
    setEditLayout(false);
  }

  /** Buang suntingan tata letak; pratinjau kembali mengikuti biodata & nilai. */
  function kembaliOtomatis() {
    if (!pastiOtomatis) {
      setPastiOtomatis(true);
      return;
    }
    setTataLetak(null);
    setTataLetakKotor(false);
    setPastiOtomatis(false);
    setEditLayout(false);
    bekuBaru.current = false;
  }

  /**
   * Data baru masuk (impor Excel) -> pratinjau wajib mengikuti data lagi.
   *
   * Tata letak hasil suntingan itu milik transkrip sebelumnya. Kalau ia
   * dibiarkan membeku sementara isinya diganti, yang tampil — dan yang
   * tercetak — masih transkrip mahasiswa yang lama.
   */
  function lepasTataLetak() {
    if (tataLetak === null) return false;
    pasangTataLetak(null);
    return true;
  }

  /** Pasang tata letak dari draf/arsip. Kosong berarti kembali ke bawaan. */
  const pasangTataLetak = useCallback((html: string | null | undefined) => {
    setTataLetak(html ? sanitizeLetterHtml(html) : null);
    setTataLetakKotor(false);
    setPastiOtomatis(false);
    setEditLayout(false);
    bekuBaru.current = false;
  }, []);

  /* ---------- Arsip Transkrip Nilai ---------- */

  // Syarat menyimpan dihitung dari isi yang sekarang di layar, dan alasannya
  // ditulis apa adanya di bawah tombol. Aturannya satu berkas dengan yang
  // dipakai server, jadi tombol yang menyala tidak akan ditolak di seberang.
  const siapArsip = useMemo(() => periksaSiapArsip(meta, rows), [meta, rows]);
  const sidikKini = useMemo(() => sidikTranskrip(meta, rows, tataLetak), [meta, rows, tataLetak]);
  // Tata letak yang baru disunting tetapi belum disimpan membuat statusnya
  // "belum disimpan" juga — walaupun angka dan biodatanya tidak berubah.
  const sudahDiarsipkan = sidikArsip !== null && sidikArsip === sidikKini && !tataLetakKotor;
  const arsipTersaring = useMemo(() => {
    const kunci = cariArsip.trim().toLowerCase();
    if (!kunci) return arsip;
    return arsip.filter((baris) =>
      `${baris.studentName} ${baris.nim} ${baris.studyProgram || ""}`.toLowerCase().includes(kunci),
    );
  }, [arsip, cariArsip]);

  const muatDaftarArsip = useCallback(async () => {
    try {
      const jawab = await fetch("/api/arsip-transkrip", { cache: "no-store" });
      const isi = (await jawab.json()) as { success?: boolean; daftar?: BarisArsip[] };
      if (isi.success) setArsip(isi.daftar || []);
    } catch {
      // Daftar arsip hanya pelengkap; pembuatan transkrip tetap bisa jalan.
    }
  }, []);

  const muatDariArsip = useCallback(async (id: number) => {
    setArsipSibuk("muat");
    setArsipPesan(null);
    try {
      const jawab = await fetch(`/api/arsip-transkrip?id=${id}`, { cache: "no-store" });
      const isi = (await jawab.json()) as {
        success?: boolean; message?: string;
        arsip?: {
          nim: string; studentName: string; meta?: Record<string, string>; rows?: CourseRow[];
          tataLetak?: string; savedBy: string | null; updatedAt: string;
        };
      };
      if (!jawab.ok || !isi.success || !isi.arsip) throw new Error(isi.message || "Transkrip itu belum dapat dimuat.");
      const baris = isi.arsip.rows || [];
      setRows(baris);
      // Lembar bersih dulu, baru isian dari arsip: transkrip mahasiswa
      // sebelumnya tidak boleh meninggalkan sisa pada yang ini.
      const bio = { ...metaAwal(), ...(isi.arsip.meta || {}) };
      setMeta(bio);
      // Termasuk tata letaknya: transkrip yang dulu disimpan sesudah disunting
      // tangan harus kembali persis seperti waktu disimpan, bukan kembali ke
      // bentuk bawaan. Kalau arsipnya tanpa suntingan, pratinjau dikembalikan
      // mengikuti data — sisa suntingan mahasiswa sebelumnya ikut dibuang.
      const bentuk = isi.arsip.tataLetak ? sanitizeLetterHtml(isi.arsip.tataLetak) : "";
      pasangTataLetak(bentuk);
      // Yang baru dimuat memang sama persis dengan yang ada di arsip, jadi
      // statusnya langsung "tersimpan" — sampai ada yang diubah.
      setSidikArsip(sidikTranskrip(bio, baris, bentuk || null));
      setArsipPesan({
        kind: "ok",
        text: `Transkrip ${isi.arsip.studentName} (${isi.arsip.nim}) dimuat dari arsip: ${baris.length} mata kuliah` +
          (bentuk ? ", lengkap dengan tata letak hasil suntingan. " : ". ") +
          `Silakan ubah seperlunya, lalu simpan lagi untuk memperbaruinya.`,
      });
    } catch (alasan: unknown) {
      setArsipPesan({ kind: "err", text: alasan instanceof Error ? alasan.message : "Transkrip itu belum dapat dimuat." });
    } finally {
      setArsipSibuk("");
    }
  }, [pasangTataLetak]);

  /**
   * Simpan transkrip yang sedang dibuat ke Arsip Transkrip Nilai.
   *
   * HANYA lewat tombol. Tidak ada pemanggilan lain ke fungsi ini — tidak dari
   * timer, tidak dari impor Excel, tidak saat pindah tab.
   */
  async function simpanKeArsip() {
    if (!siapArsip.siap) {
      setArsipPesan({ kind: "err", text: siapArsip.alasan });
      return;
    }
    setArsipSibuk("simpan");
    setArsipPesan(null);
    try {
      // Bentuk yang sekarang tampil — beserta suntingan tata letaknya, kalau
      // ada — itulah yang diarsipkan. Bukan bentuk bawaan hasil render ulang.
      const bentuk = tataLetakKini();
      const jawab = await fetch("/api/arsip-transkrip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta, rows, lang, tataLetak: bentuk }),
      });
      const isi = (await jawab.json()) as {
        success?: boolean; message?: string; diperbarui?: boolean; arsip?: BarisArsip;
      };
      if (!jawab.ok || !isi.success || !isi.arsip) throw new Error(isi.message || "Transkrip belum tersimpan ke arsip.");

      // Daftar diperbarui di tempat: baris dengan NIM yang sama diganti, yang
      // baru naik ke atas — sama seperti urutan dari server (terbaru dulu).
      setArsip((kini) => [isi.arsip as BarisArsip, ...kini.filter((baris) => baris.nim !== isi.arsip!.nim)]);
      // Keadaan disamakan dengan yang barusan terkirim, supaya status di
      // sebelah tombol benar-benar berbunyi "sudah tersimpan".
      if (bentuk) setTataLetak(bentuk);
      setTataLetakKotor(false);
      setSidikArsip(sidikTranskrip(meta, rows, bentuk || null));
      const diingat = await ingatKamus();
      setArsipPesan({
        kind: "ok",
        text: (isi.diperbarui
          ? `Transkrip ${isi.arsip.studentName} (${isi.arsip.nim}) DIPERBARUI di arsip`
          : `Transkrip ${isi.arsip.studentName} (${isi.arsip.nim}) masuk ke arsip`) +
          `: ${isi.arsip.courseCount} mata kuliah · ${isi.arsip.totalSks} SKS · IPK ${isi.arsip.ipk}.` +
          (bentuk ? " Tata letak hasil suntingan Anda ikut tersimpan." : "") +
          (diingat > 0 ? ` ${diingat} nama Inggris diingat untuk unggahan berikutnya.` : "") +
          ` Daftar lengkapnya ada di Dashboard → Arsip Transkrip Nilai.`,
      });
    } catch (alasan: unknown) {
      setArsipPesan({ kind: "err", text: alasan instanceof Error ? alasan.message : "Transkrip belum tersimpan ke arsip." });
    } finally {
      setArsipSibuk("");
    }
  }

  // Daftar dibaca sekali saat modul dibuka; kalau alamatnya membawa nomor
  // arsip (dari Dashboard → Arsip Transkrip Nilai), transkripnya ikut dimuat.
  useEffect(() => {
    // Ditunda satu tick supaya pembacaan pertamanya tidak menyalakan render
    // berantai pada saat modul baru saja terpasang.
    const jam = window.setTimeout(() => {
      void muatDaftarArsip();
      const nomor = Number(arsipAwal || 0);
      if (nomor > 0) void muatDariArsip(nomor);
    }, 0);
    return () => window.clearTimeout(jam);
  }, [arsipAwal, muatDaftarArsip, muatDariArsip]);

  // Menutup tab dengan transkrip yang belum diarsipkan berarti mengetik ulang
  // semuanya. Peramban yang bertanya sekali jauh lebih murah daripada itu.
  useEffect(() => {
    if (rows.length === 0 || sudahDiarsipkan) return;
    const jaga = (peristiwa: BeforeUnloadEvent) => peristiwa.preventDefault();
    window.addEventListener("beforeunload", jaga);
    return () => window.removeEventListener("beforeunload", jaga);
  }, [rows.length, sudahDiarsipkan]);

  function updateRow(index: number, patch: Partial<CourseRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function execDoc(command: string, value?: string) {
    docRef.current?.focus();
    document.execCommand(command, false, value);
    // Tombol toolbar mengubah dokumen langsung lewat DOM. Ditandai di sini
    // juga supaya statusnya tetap jujur walau peramban tidak mengirim
    // peristiwa "input" untuk perintah tertentu.
    setTataLetakKotor(true);
  }

  if (customMode) {
    return (
      <div>
        <div className="tpl-custom-bar no-print">
          <button type="button" className="btn btn-light btn-mini" onClick={() => setCustomMode(false)}>← Kembali ke format tabel (impor Excel)</button>
        </div>
        <LetterModule slug={customSlug} />
      </div>
    );
  }

  return (
    <div className="tpl-grid">
      <style>{"@media print { @page { size: 21.59cm 35.56cm; margin: 0; } }"}</style>
      <section className="tpl-editor no-print">
        <div className="import-box">
          <strong>Impor dari Excel (.xlsx)</strong>
          <p>Dua format diterima otomatis: <b>Template Transkrip SiPaling</b> (unduh di bawah, satu baris satu mata kuliah) dan <b>Excel akademik</b> lama (dua blok kolom NO · KODE MK · NAMA MATA KULIAH · K · HM · AM · MK). Biodata ikut terbaca.</p>
          <div className="tpl-actions tpl-actions-wrap tpl-data-bar">
            <button type="button" className="btn btn-light btn-mini" onClick={downloadTemplate}>⬇ Unduh Template Excel</button>
            <button type="button" className="btn btn-light btn-mini" onClick={saveTranskripData} disabled={savingData || rows.length === 0} title="Satu laci draf: menyimpan transkrip berikutnya menimpa yang ini. Untuk menyimpan per mahasiswa, pakai tombol Arsip Transkrip di paling bawah.">💾 Simpan draf (1 laci)</button>
            <button type="button" className="btn btn-light btn-mini" onClick={loadTranskripData} disabled={savingData}>📂 Muat draf</button>
          </div>
          <label className="file-box">
            <span className="file-btn">📁 Pilih File Excel</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
          </label>
          {sheetNames.length > 1 && (
            <label className="sheet-pick">File berisi beberapa sheet, pilih mahasiswa/sheet:
              <select onChange={(event) => { if (workbook) void parseSheetByName(workbook, event.target.value); }}>
                {sheetNames.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
          )}
          {importMsg && <div className={importMsg.kind === "ok" ? "dsh-ok" : "dsh-error"}>{importMsg.text}</div>}
        </div>

        <h3 className="tpl-h3">
          Biodata &amp; dokumen
          <button type="button" className="collapse-btn" onClick={() => setShowBio((v) => !v)}>
            {showBio ? "▲ Sembunyikan" : "▼ Tampilkan"}
          </button>
        </h3>
        <div className="tpl-fields" hidden={!showBio}>
          <label>Nama mahasiswa<input value={meta.nama} onChange={(e) => setMeta({ ...meta, nama: e.target.value })} /></label>
          <label>NIM<input value={meta.nim} onChange={(e) => setMeta({ ...meta, nim: e.target.value })} /></label>
          <label>Tempat, tanggal lahir<input value={meta.ttl} onChange={(e) => setMeta({ ...meta, ttl: e.target.value })} /></label>
          <label>Program studi
            <select value={meta.prodi} onChange={(e) => setMeta({ ...meta, prodi: e.target.value })}>
              {PRODI.map((item) => <option key={item.kode}>{item.nama}</option>)}
            </select>
          </label>
          <label>Konsentrasi<input value={meta.konsentrasi} onChange={(e) => setMeta({ ...meta, konsentrasi: e.target.value })} placeholder="mis. Broadcasting" /></label>
          <label>Nomor Ijazah Nasional<input value={meta.noijazah} onChange={(e) => setMeta({ ...meta, noijazah: e.target.value })} /></label>
          <label>Tanggal yudisium<input value={meta.yudisium} onChange={(e) => setMeta({ ...meta, yudisium: e.target.value })} /></label>
          <label className="wide">Akreditasi<input value={meta.akred} onChange={(e) => setMeta({ ...meta, akred: e.target.value })} /></label>
          <label className="wide">Judul skripsi<textarea value={meta.judul} onChange={(e) => setMeta({ ...meta, judul: e.target.value })} /></label>
          <label>Tanggal cetak<input value={meta.tanggal} onChange={(e) => setMeta({ ...meta, tanggal: e.target.value })} /></label>
          <label>Dekan<input value={meta.dekan} onChange={(e) => setMeta({ ...meta, dekan: e.target.value })} /></label>
          <label>NBM Dekan<input value={meta.nbmdekan} onChange={(e) => setMeta({ ...meta, nbmdekan: e.target.value })} /></label>
          <label>Rektor<input value={meta.rektor} onChange={(e) => setMeta({ ...meta, rektor: e.target.value })} /></label>
          <label>NBM Rektor<input value={meta.nbmrektor} onChange={(e) => setMeta({ ...meta, nbmrektor: e.target.value })} /></label>
        </div>

        <h3 className="tpl-h3">
          Nilai ({rows.length} MK · {totals.sks} SKS · IPK {showIpk(totals.ipk)})
          <button type="button" className="collapse-btn" onClick={() => setShowHint((v) => !v)}>
            {showHint ? "▲ Sembunyikan keterangan" : "▼ Keterangan"}
          </button>
        </h3>
        <p className="tpl-hint" hidden={!showHint}>
          HM → AM otomatis (A=4 · B=3 · C=2 · D=1 · E=0), M = K × AM. Pilih HM &quot;–&quot; untuk MK tanpa nilai huruf (mis. Skripsi), SKS-nya tetap dihitung dalam total & IPK.
          Urutan nomor mengikuti daftar ini <strong>atas ke bawah</strong>: kolom kiri transkrip = No. 1–{half || 1}, lalu lanjut kolom kanan.
          {EN && <> Transkrip tercetak <strong>dwibahasa</strong>: nama Indonesia + nama Inggris kecil miring di bawahnya (otomatis dari file KUI, bisa diedit per baris).</>}
        </p>
        <div
          className="tpl-rows"
          style={rows.length > 5 ? { display: "grid", gridAutoFlow: "column", gridTemplateRows: `repeat(${half}, auto)`, gridTemplateColumns: "1fr 1fr", gap: "6px 14px", alignItems: "start" } : undefined}
        >
          {rows.map((row, index) => (
            <div className="tpl-rowwrap" key={index}>
              <div className="tpl-row">
                <span className="tpl-row-no">{index + 1}.</span>
                <input className="in-kode" value={row.kode} onChange={(e) => updateRow(index, { kode: e.target.value })} placeholder="Kode" />
                <input className="in-nama" value={row.nama} onChange={(e) => updateRow(index, { nama: e.target.value })} placeholder="Nama mata kuliah" />
                <select value={row.hm} onChange={(e) => updateRow(index, { hm: e.target.value })}>
                  <option value="">–</option>
                  {HMS.map((letter) => <option key={letter}>{letter}</option>)}
                </select>
                <input type="number" min={0} max={12} value={row.k} onChange={(e) => updateRow(index, { k: Number(e.target.value) || 0 })} />
                <button type="button" onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>✕</button>
              </div>
              {EN && (
                <input className="tpl-row-en" value={row.en} onChange={(e) => updateRow(index, { en: e.target.value })} placeholder="Course title (English)" />
              )}
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-light" onClick={() => setRows((current) => [...current, { kode: "", nama: "", en: "", hm: "", k: 3 }])}>+ Tambah baris (mengisi atas → bawah)</button>

        <div className="tpl-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>🖨 Cetak tanpa kop (Legal 21,59×35,56 cm)</button>
          <button
            type="button"
            className={editLayout ? "btn btn-primary btn-mini" : "btn btn-light btn-mini"}
            onClick={() => (editLayout ? tutupEditTataLetak() : bukaEditTataLetak())}
            title="Ubah teks & tata letak langsung di pratinjau. Hasilnya ikut tersimpan pada Simpan draf dan Save di Arsip Transkrip."
          >
            {editLayout ? "✓ Selesai edit tata letak" : "✎ Edit tata letak"}
          </button>
          {tataLetak !== null && !editLayout && (
            <button
              type="button"
              className={pastiOtomatis ? "btn btn-primary btn-mini" : "btn btn-light btn-mini"}
              onClick={kembaliOtomatis}
              title="Buang suntingan tata letak; pratinjau kembali mengikuti biodata & nilai di sebelah kiri"
            >
              {pastiOtomatis ? "Yakin? Suntingan tata letak dibuang" : "↺ Kembali ke tata letak bawaan"}
            </button>
          )}
          <span className="print-tip no-print">Agar <strong>1 lembar</strong>: di dialog print set <strong>Margins = None</strong>, <strong>Scale = Default (100%)</strong>, dan matikan <strong>Headers and footers</strong>.</span>
          <button type="button" className="btn btn-light" onClick={() => { window.open("https://drive.google.com/drive/my-drive?hl=ID", "_blank", "noopener"); }} title="Buka Google Drive akun Anda untuk mengunggah PDF hasil cetak">⬢ Simpan ke Google Drive</button>
          <Link className="btn btn-light" href="/dashboard">Arsipkan link Drive di Dashboard → Arsip</Link>
        </div>

        {tataLetak !== null && (
          <p className="tk-tataletak-nota no-print">
            ✎ Pratinjau memakai <b>tata letak hasil suntingan tangan</b>, dan bentuk inilah yang ikut
            tersimpan pada <b>Simpan draf</b> maupun <b>Save di Arsip Transkrip</b>.
            Selama masih begini, perubahan Biodata &amp; nilai di sebelah kiri <b>tidak lagi</b> ikut ke
            pratinjau. Suntingannya akan tertimpa kalau ikut. Sesudah selesai menyunting, tombol
            <b>↺ Kembali ke tata letak bawaan</b> membuat pratinjau mengikuti data lagi.
          </p>
        )}

        {/* ============================================================
            ARSIP TRANSKRIP NILAI — tombol terakhir, sesudah transkripnya jadi

            Letaknya paling bawah karena inilah langkah terakhir: nilai sudah
            benar, biodata sudah benar, transkrip sudah dicetak — baru
            diarsipkan. Selama tombol ini belum ditekan, tidak ada satu pun
            data yang masuk ke arsip.
            ============================================================ */}
        <section className="tk-arsip">
          <div className="tk-arsip-head">
            <div>
              <strong>Arsip Transkrip Nilai</strong>
              <p>
                Simpan transkrip yang sudah selesai agar tercatat siapa saja mahasiswa yang transkripnya sudah dibuat.
                Tersimpan <b>hanya kalau tombol ini ditekan</b>. Selama belum, tidak ada yang diarsipkan.
              </p>
            </div>
            <span className={sudahDiarsipkan ? "tk-arsip-status sudah" : "tk-arsip-status belum"}>
              {sudahDiarsipkan ? "✓ Sudah tersimpan di arsip" : rows.length === 0 ? "○ Belum ada isi" : "● Belum disimpan"}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-arsip"
            onClick={() => void simpanKeArsip()}
            disabled={!siapArsip.siap || arsipSibuk !== ""}
            title={siapArsip.siap ? "Simpan transkrip ini ke Arsip Transkrip Nilai" : siapArsip.alasan}
          >
            {arsipSibuk === "simpan" ? "Menyimpan…" : "💾 Save di Arsip Transkrip"}
          </button>

          {!siapArsip.siap && <p className="tk-arsip-alasan">⚠ {siapArsip.alasan}</p>}
          {siapArsip.siap && !sudahDiarsipkan && (
            <p className="tk-arsip-alasan siap">
              Siap disimpan: <b>{meta.nama}</b> · {meta.nim} · {rows.length} mata kuliah · {totals.sks} SKS · IPK {showIpk(totals.ipk)}.
            </p>
          )}
          {arsipPesan && <div className={arsipPesan.kind === "ok" ? "dsh-ok" : "dsh-error"}>{arsipPesan.text}</div>}

          <div className="tk-arsip-list">
            <div className="tk-arsip-list-head">
              <button type="button" className="collapse-btn" onClick={() => setArsipBuka((buka) => !buka)}>
                {arsipBuka ? "▲" : "▼"} Sudah dibuat transkripnya ({arsip.length} mahasiswa)
              </button>
              <button type="button" className="collapse-btn" onClick={() => void muatDaftarArsip()}>⟳ Segarkan</button>
            </div>
            {arsipBuka && (
              arsip.length === 0 ? (
                <p className="tk-arsip-kosong">
                  Arsip masih kosong. Transkrip pertama yang Anda simpan akan muncul di sini.
                </p>
              ) : (
                <>
                  {arsip.length > 6 && (
                    <input
                      className="tk-arsip-cari"
                      value={cariArsip}
                      onChange={(e) => setCariArsip(e.target.value)}
                      placeholder="Cari nama, NIM, atau prodi…"
                    />
                  )}
                  <ul className="tk-arsip-daftar">
                    {arsipTersaring.map((baris) => (
                      <li key={baris.id}>
                        <div className="tk-arsip-siapa">
                          <b>{baris.studentName}</b>
                          <span>
                            {baris.nim} · {baris.studyProgram || "prodi tidak tercatat"} · {baris.courseCount} MK ·{" "}
                            {baris.totalSks} SKS · IPK {baris.ipk}
                          </span>
                          <small>
                            {tanggalSingkat(baris.updatedAt)}
                            {baris.savedBy ? ` · oleh ${baris.savedBy}` : ""}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="btn btn-light btn-mini"
                          onClick={() => void muatDariArsip(baris.id)}
                          disabled={arsipSibuk !== ""}
                        >
                          {arsipSibuk === "muat" ? "…" : "Muat"}
                        </button>
                      </li>
                    ))}
                    {arsipTersaring.length === 0 && <li className="tk-arsip-kosong">Tidak ada yang cocok dengan pencarian itu.</li>}
                  </ul>
                </>
              )
            )}
          </div>

          <Link className="tk-arsip-tautan" href="/dashboard?view=arsip-transkrip">
            Buka Arsip Transkrip Nilai di Dashboard →
          </Link>
        </section>
      </section>

      <section className="tpl-preview">
        <div className="print-area">
          {editLayout && (
            <div className="word-toolbar no-print" role="toolbar" aria-label="Format teks transkrip">
              <button type="button" title="Urungkan" onMouseDown={(e) => e.preventDefault()} onClick={() => execDoc("undo")}>↶</button>
              <button type="button" title="Ulangi" onMouseDown={(e) => e.preventDefault()} onClick={() => execDoc("redo")}>↷</button>
              <span className="wt-sep" />
              <select title="Jenis huruf" defaultValue="Arial" onChange={(e) => execDoc("fontName", e.target.value)}>
                {["Arial", "Calibri", "Times New Roman", "Georgia", "Tahoma"].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <select title="Ukuran huruf" defaultValue="2" onChange={(e) => execDoc("fontSize", e.target.value)}>
                {[["7", "1"], ["8", "2"], ["10", "3"], ["12", "4"], ["14", "5"], ["18", "6"]].map(([label, value]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <span className="wt-sep" />
              <button type="button" title="Tebal" onMouseDown={(e) => e.preventDefault()} onClick={() => execDoc("bold")}><b>B</b></button>
              <button type="button" title="Miring" onMouseDown={(e) => e.preventDefault()} onClick={() => execDoc("italic")}><i>I</i></button>
              <button type="button" title="Garis bawah" onMouseDown={(e) => e.preventDefault()} onClick={() => execDoc("underline")}><u>U</u></button>
              <span className="wt-sep" />
              <button type="button" title="Rata kiri" onMouseDown={(e) => e.preventDefault()} onClick={() => execDoc("justifyLeft")}>⯇</button>
              <button type="button" title="Rata tengah" onMouseDown={(e) => e.preventDefault()} onClick={() => execDoc("justifyCenter")}>≡</button>
              <button type="button" title="Rata kanan" onMouseDown={(e) => e.preventDefault()} onClick={() => execDoc("justifyRight")}>⯈</button>
              <span className="wt-sep" />
              <button type="button" title="Perkecil huruf terpilih" onMouseDown={(e) => e.preventDefault()} onClick={() => execDoc("fontSize", "1")}>A−</button>
              <button type="button" title="Perbesar huruf terpilih" onMouseDown={(e) => e.preventDefault()} onClick={() => execDoc("fontSize", "4")}>A+</button>
              <button type="button" title="Hapus format" onMouseDown={(e) => e.preventDefault()} onClick={() => execDoc("removeFormat")}>⌫A</button>
            </div>
          )}
          {/* ------------------------------------------------------------
              Tata letak hasil suntingan: isinya 100% milik DOM.

              Ditanam SEKALI lewat dangerouslySetInnerHTML dan tidak pernah
              dirender ulang selama HTML-nya tidak diganti, sehingga render
              ulang React (pesan sukses, daftar arsip yang baru terbaca)
              tidak bisa menghapus suntingan yang belum tersimpan.
              ------------------------------------------------------------ */}
          {tataLetak !== null ? (
            <div
              key="tangan"
              ref={docRef}
              className={kelasDoc}
              contentEditable={editLayout}
              suppressContentEditableWarning
              onInput={() => setTataLetakKotor(true)}
              dangerouslySetInnerHTML={isiTataLetak}
            />
          ) : (
          <div
            key="otomatis"
            ref={docRef}
            className={kelasDoc}
            contentEditable={editLayout}
            suppressContentEditableWarning
            onInput={() => setTataLetakKotor(true)}
          >
            <div className="kop-layer no-print" aria-hidden="true" />
            <div className="page-guide page-guide-legal no-print" aria-hidden="true" />

            {/* --- blok atas: nomor ijazah / NPPT / yudisium / akreditasi --- */}
            <div className="doc-top">
              <div className="dt-cell"><span className="dt-lbl"><Lbl text={L.noij} /></span><span className="dt-sep">:</span><span className="dt-val">{meta.noijazah || "................................"}</span></div>
              <div className="dt-cell"><span className="dt-lbl"><Lbl text={L.nppt} /></span><span className="dt-sep">:</span><span className="dt-val">{meta.nppt}</span></div>
              <div className="dt-cell"><span className="dt-lbl"><Lbl text={L.yud} /></span><span className="dt-sep">:</span><span className="dt-val">{meta.yudisium || "-"}</span></div>
              <div className="dt-cell"><span className="dt-lbl"><Lbl text={L.akred} /></span><span className="dt-sep">:</span><span className="dt-val">{meta.akred}</span></div>
            </div>

            {/* --- judul --- */}
            <div className="doc-title-wrap">
              <h2 className="doc-title">{L.title}</h2>
              {L.subtitle ? <p className="doc-subtitle">{L.subtitle}</p> : null}
            </div>

            {/* --- biodata DUA kolom, label bertingkat (acuan gambar) --- */}
            <div className="doc-bio2">
              <div className="bio-cell"><span className="bio-lbl"><Lbl text={L.nama} /></span><span className="bio-sep">:</span><span className="bio-val">{meta.nama || ""}</span></div>
              <div className="bio-cell"><span className="bio-lbl"><Lbl text={L.fak} /></span><span className="bio-sep">:</span><span className="bio-val"><Lbl text={L.fakval} /></span></div>
              <div className="bio-cell"><span className="bio-lbl"><Lbl text={L.nim} /></span><span className="bio-sep">:</span><span className="bio-val">{meta.nim || ""}</span></div>
              <div className="bio-cell"><span className="bio-lbl"><Lbl text={L.jenjangLbl} /></span><span className="bio-sep">:</span><span className="bio-val"><BiVal text={meta.jenjang} /></span></div>
              <div className="bio-cell"><span className="bio-lbl"><Lbl text={L.ttl} /></span><span className="bio-sep">:</span><span className="bio-val">{meta.ttl || ""}</span></div>
              <div className="bio-cell"><span className="bio-lbl"><Lbl text={L.kons} /></span><span className="bio-sep">:</span><span className="bio-val"><BiVal text={konsentrasiText} /></span></div>
              <div className="bio-cell"><span className="bio-lbl"><Lbl text={L.prodi} /></span><span className="bio-sep">:</span><span className="bio-val"><BiVal text={showProdi(meta.prodi)} /></span></div>
              <div className="bio-cell"><span className="bio-lbl"><Lbl text={L.npps} /></span><span className="bio-sep">:</span><span className="bio-val">{prodiKode}</span></div>
            </div>

            {/* --- tabel nilai: tanpa garis antar kolom/baris (acuan PDF) --- */}
            <div className="doc-cols">
              {[0, 1].map((columnIndex) => {
                const columnRows = columnIndex === 0 ? rows.slice(0, half) : rows.slice(half);
                return (
                  <table className="doc-table" key={columnIndex}>
                    <thead>
                      <tr>
                        <th className="c-no">No</th>
                        <th className="c-kode">Kode MK<i>Course</i></th>
                        <th className="c-nama">Nama Mata Kuliah<i>Descriptions</i></th>
                        <th className="c-n">HM<i className="pl">LG</i></th>
                        <th className="c-n">AM<i className="pl">CR</i></th>
                        <th className="c-n">K<i className="pl">WM</i></th>
                        <th className="c-n">M<i className="pl">GP</i></th>
                      </tr>
                    </thead>
                    <tbody>
                      {columnRows.map((row, rowIndex) => {
                        const graded = row.hm in AM;
                        const am = AM[row.hm] ?? 0;
                        return (
                          <tr key={`${row.kode}-${rowIndex}`}>
                            <td className="c-no">{columnIndex * half + rowIndex + 1}</td>
                            <td className="c-kode">{row.kode}</td>
                            <td className="c-nama">{row.nama || row.en}<i>{row.en || row.nama}</i></td>
                            <td className="c-n">{graded ? row.hm : ""}</td>
                            <td className="c-n">{graded ? am : ""}</td>
                            <td className="c-n">{row.k}</td>
                            <td className="c-n">{graded ? row.k * am : ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })}
            </div>

            {/* --- blok total: 3 pita bergaris, tanpa pemisah vertikal --- */}
            <div className="doc-totals">
              <div className="dtot-row">
                <span className="dt-a"><BiIn text={L.totKredit} /></span><span className="dt-b">{totals.sks} SKS</span>
                <span className="dt-c"><BiIn text={L.ipkLbl} /></span><span className="dt-d">{showIpk(totals.ipk)}</span>
              </div>
              <div className="dtot-row">
                <span className="dt-a"><BiIn text={L.totNilai} /></span><span className="dt-b">{totals.mutu}</span>
                <span className="dt-c"><BiIn text={L.predLbl} /></span><span className="dt-d"><b>{showPredikat(predikatKelulusan(totals.ipk, meta.judul))}</b></span>
              </div>
              <div className="dtot-judul"><span><BiVal text={L.judul} /></span><span>{meta.judul || ""}</span></div>
            </div>

            {/* --- tanda tangan dua kolom (acuan gambar) --- */}
            <div className="doc-sign2">
              <div className="ds-col">
                <p className="ds-date">&nbsp;</p>
                <p><BiIn text={L.dekan} /></p>
                <div className="doc-sign-space" />
                <b className="doc-sign-name">{meta.dekan}</b>
                <p>NBM : {meta.nbmdekan}</p>
              </div>
              <div className="ds-photo no-print" aria-hidden="true">3x4</div>
              <div className="ds-col ds-right">
                <p className="ds-date">Tangerang, {meta.tanggal}</p>
                <p><BiIn text={L.rektor} /></p>
                <div className="doc-sign-space" />
                <b className="doc-sign-name">{meta.rektor}</b>
                <p>NBM : {meta.nbmrektor}</p>
              </div>
            </div>
          </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------- modul surat berkop (generik untuk 3 template + unggahan) ---------- */

const FONT_FAMILIES = ["Times New Roman", "Arial", "Calibri", "Georgia", "Courier New"];
const FONT_SIZES: Array<{ label: string; value: string }> = [
  { label: "10", value: "2" },
  { label: "12", value: "3" },
  { label: "14", value: "4" },
  { label: "18", value: "5" },
  { label: "24", value: "6" },
];

function LetterModule({ slug }: { slug: LetterSlug }) {
  // PRINSIP UTAMA (perbaikan bug gambar hilang): setelah dimuat, isi editor
  // 100% milik DOM — React TIDAK pernah merender ulang innerHTML-nya.
  // Semua perubahan (ketikan, toolbar, gambar) dilakukan imperatif, sehingga
  // re-render React (mis. saat pesan sukses muncul) tak bisa menimpanya.
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const selectedImgRef = useRef<HTMLImageElement | null>(null);
  const dirtyRef = useRef(false);
  const draftTimer = useRef<number | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [savedInfo, setSavedInfo] = useState<{ by: string | null; at: string | null }>({ by: null, at: null });
  const [draftAvailable, setDraftAvailable] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const draftKey = `sipaling_draft_${slug}`;

  // posisikan pegangan ubah-ukuran di pojok kanan-bawah gambar terpilih
  const positionHandle = useCallback(() => {
    const handle = handleRef.current;
    const page = pageRef.current;
    const img = selectedImgRef.current;
    if (!handle || !page) return;
    if (!img || !page.contains(img)) {
      handle.style.display = "none";
      return;
    }
    const pageRect = page.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    handle.style.display = "block";
    handle.style.left = `${imgRect.right - pageRect.left - 8}px`;
    handle.style.top = `${imgRect.bottom - pageRect.top - 8}px`;
  }, []);

  const currentHtml = useCallback(
    () => (editorRef.current?.innerHTML ?? "").replace(/ class="img-selected"/g, ""),
    [],
  );

  const setContent = useCallback((nextHtml: string) => {
    // Selalu dibersihkan sebelum masuk DOM. Sumbernya bisa berupa hasil
    // konversi .docx maupun template tersimpan buatan admin lain, jadi
    // penyaringan di sisi tampilan inilah yang benar-benar menentukan.
    if (editorRef.current) editorRef.current.innerHTML = sanitizeLetterHtml(nextHtml);
    selectedImgRef.current = null;
    savedRangeRef.current = null;
    if (handleRef.current) handleRef.current.style.display = "none";
  }, []);

  // 1) isi awal: template bawaan langsung tampil, lalu ditimpa versi tersimpan
  //    dari server BILA pengguna belum sempat mengedit.
  useEffect(() => {
    setContent(DEFAULT_LETTER_HTML[slug]);
    dirtyRef.current = false;
    let cancelled = false;
    fetch(`/api/templates?slug=${slug}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { success?: boolean; template?: { html?: string; updatedBy?: string | null; updatedAt?: string | null } | null }) => {
        if (cancelled) return;
        const savedHtml = payload?.template?.html || "";
        if (savedHtml && !dirtyRef.current) setContent(savedHtml);
        if (savedHtml) setSavedInfo({ by: payload?.template?.updatedBy || null, at: payload?.template?.updatedAt || null });
        setLoaded(true);
        try {
          const draft = window.localStorage.getItem(draftKey);
          if (draft && draft !== (savedHtml || DEFAULT_LETTER_HTML[slug])) setDraftAvailable(true);
        } catch {}
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // 2) simpan posisi kursor/seleksi setiap kali berubah DI DALAM editor,
  //    supaya sisip gambar & dropdown huruf tetap tahu harus bekerja di mana
  //    walau fokus sempat pindah (dialog file, dropdown, tombol).
  useEffect(() => {
    function rememberSelection() {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
    document.addEventListener("selectionchange", rememberSelection);
    return () => document.removeEventListener("selectionchange", rememberSelection);
  }, []);

  function restoreSelection() {
    const range = savedRangeRef.current;
    if (!range) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function scheduleDraftSave() {
    dirtyRef.current = true;
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, currentHtml());
      } catch {}
    }, 800);
  }

  function restoreDraft() {
    try {
      const draft = window.localStorage.getItem(draftKey);
      if (draft) setContent(draft);
    } catch {}
    setDraftAvailable(false);
  }

  function discardDraft() {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {}
    setDraftAvailable(false);
  }

  // ---- toolbar ala Word ----
  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    scheduleDraftSave();
  }

  function markSelectedImage(img: HTMLImageElement | null) {
    editorRef.current?.querySelectorAll("img.img-selected").forEach((node) => node.classList.remove("img-selected"));
    selectedImgRef.current = img;
    if (img) img.classList.add("img-selected");
    positionHandle();
  }

  // seret pegangan = ubah ukuran bebas (rasio terjaga, tinggi otomatis)
  function startImageResize(event: React.PointerEvent<HTMLDivElement>) {
    const img = selectedImgRef.current;
    if (!img) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = img.getBoundingClientRect().width;
    function onMove(moveEvent: PointerEvent) {
      const nextWidth = Math.max(40, Math.round(startWidth + (moveEvent.clientX - startX)));
      img?.setAttribute("style", `width:${nextWidth}px;height:auto;`);
      positionHandle();
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      scheduleDraftSave();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // klik-ganda gambar = masukkan lebar persis dalam cm
  function handleEditorDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (!(target instanceof HTMLImageElement)) return;
    const currentCm = (target.getBoundingClientRect().width / 96) * 2.54;
    const answer = window.prompt("Lebar gambar (cm):", currentCm.toFixed(1));
    if (!answer) return;
    const cm = Number(answer.replace(",", "."));
    if (!Number.isFinite(cm) || cm <= 0.5 || cm > 18) {
      setMessage({ kind: "err", text: "Masukkan angka lebar 0,5–18 cm." });
      return;
    }
    target.setAttribute("style", `width:${cm}cm;height:auto;`);
    markSelectedImage(target);
    scheduleDraftSave();
  }

  async function insertImageFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editorRef.current) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setMessage({ kind: "err", text: "Gunakan gambar PNG/JPG/WebP." });
      return;
    }
    if (file.size > 400 * 1024) {
      setMessage({ kind: "err", text: "Gambar terlalu besar (maks. 400 KB). Untuk tanda tangan, potong seperlunya dan simpan sebagai PNG kecil." });
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Gambar tidak terbaca."));
        reader.readAsDataURL(file);
      });

      // Sisipkan node <img> langsung lewat DOM (bukan execCommand) —
      // deterministik dan tidak bergantung pada fokus yang hilang
      // karena dialog pemilih file.
      const img = document.createElement("img");
      img.src = dataUrl;
      img.alt = "Gambar sisipan";
      img.style.width = "4.5cm";
      img.style.height = "auto";

      const range = savedRangeRef.current;
      if (range && editorRef.current.contains(range.commonAncestorContainer)) {
        range.collapse(false);
        range.insertNode(img);
      } else {
        editorRef.current.appendChild(img);
      }

      // letakkan kursor tepat setelah gambar & tandai gambar agar tombol
      // ukuran langsung bisa dipakai
      const selection = window.getSelection();
      if (selection) {
        const after = document.createRange();
        after.setStartAfter(img);
        after.collapse(true);
        selection.removeAllRanges();
        selection.addRange(after);
        savedRangeRef.current = after.cloneRange();
      }
      markSelectedImage(img);
      img.scrollIntoView({ block: "nearest" });
      scheduleDraftSave();
      setMessage({ kind: "ok", text: "Gambar disisipkan. Klik gambarnya, lalu pakai tombol Kecil/Sedang/Besar untuk mengatur ukuran." });
    } catch (reason: unknown) {
      setMessage({ kind: "err", text: reason instanceof Error ? reason.message : "Gambar tidak dapat disisipkan." });
    }
  }

  function resizeSelectedImage(width: string) {
    const img = selectedImgRef.current && editorRef.current?.contains(selectedImgRef.current)
      ? selectedImgRef.current
      : editorRef.current?.querySelector<HTMLImageElement>("img.img-selected") || null;
    if (!img) {
      setMessage({ kind: "err", text: "Klik dulu gambarnya, baru pilih ukuran." });
      return;
    }
    img.setAttribute("style", `width:${width};height:auto;`);
    markSelectedImage(img);
    scheduleDraftSave();
  }

  function handleEditorClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    markSelectedImage(target instanceof HTMLImageElement ? target : null);
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    // Delete/Backspace menghapus gambar yang sedang terpilih
    if ((event.key === "Delete" || event.key === "Backspace") && selectedImgRef.current) {
      event.preventDefault();
      selectedImgRef.current.remove();
      selectedImgRef.current = null;
      positionHandle();
      scheduleDraftSave();
    }
  }

  async function saveTemplate() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, html: currentHtml() }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Template belum tersimpan.");
      discardDraft();
      dirtyRef.current = false;
      setMessage({ kind: "ok", text: "Template tersimpan, menjadi tampilan awal untuk semua admin berikutnya." });
    } catch (reason: unknown) {
      setMessage({ kind: "err", text: reason instanceof Error ? reason.message : "Template belum tersimpan." });
    } finally {
      setBusy(false);
    }
  }

  function resetTemplate() {
    setContent(DEFAULT_LETTER_HTML[slug]);
    discardDraft();
    dirtyRef.current = false;
    setMessage({ kind: "ok", text: "Kembali ke template bawaan (klik Simpan template bila ingin dipermanenkan)." });
  }

  async function handleDocx(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const nextHtml = result.value || "";
      if (!nextHtml.trim()) throw new Error("Isi .docx kosong / tidak terbaca.");
      setContent(nextHtml);
      scheduleDraftSave();
      setMessage({ kind: "ok", text: `"${file.name}" dimuat. Rapikan dengan toolbar, lalu klik Simpan template. Semua diproses di browser Anda.` });
    } catch (reason: unknown) {
      setMessage({ kind: "err", text: reason instanceof Error ? reason.message : "File .docx tidak dapat dibaca." });
    } finally {
      setBusy(false);
    }
  }

  function docCompatibleHtml() {
    // Microsoft Word tidak memahami flexbox, jadi struktur kolom (.drow) dan
    // blok tanda tangan dikonversi menjadi TABEL agar rapi saat dibuka di Word.
    const container = document.createElement("div");
    container.innerHTML = currentHtml();
    container.querySelectorAll(".dblock").forEach((block) => {
      const table = document.createElement("table");
      table.setAttribute("cellspacing", "0");
      table.setAttribute("cellpadding", "0");
      table.setAttribute("style", "border-collapse:collapse;margin:10pt 0;");
      block.querySelectorAll(".drow").forEach((row) => {
        const label = row.querySelector(".dlabel");
        const value = row.querySelector(".dval");
        const narrow = label?.classList.contains("dlabel-s");
        const tr = document.createElement("tr");
        tr.innerHTML = `<td style="width:${narrow ? "2.6cm" : "4.6cm"};vertical-align:top;">${label?.innerHTML || ""}</td>` +
          `<td style="width:0.5cm;vertical-align:top;">:</td>` +
          `<td style="vertical-align:top;">${value?.innerHTML || ""}</td>`;
        table.appendChild(tr);
      });
      block.replaceWith(table);
    });
    container.querySelectorAll(".sign-block").forEach((block) => {
      const right = block.classList.contains("sign-right");
      const wrapper = document.createElement("table");
      wrapper.setAttribute("width", "100%");
      wrapper.setAttribute("cellspacing", "0");
      wrapper.setAttribute("cellpadding", "0");
      wrapper.innerHTML = right
        ? `<tr><td></td><td style="width:8cm;vertical-align:top;">${block.innerHTML}</td></tr>`
        : `<tr><td style="width:8cm;vertical-align:top;">${block.innerHTML}</td><td></td></tr>`;
      block.replaceWith(wrapper);
    });
    container.querySelectorAll(".sign-space").forEach((gap) => {
      gap.innerHTML = "<br /><br /><br /><br />";
      gap.removeAttribute("class");
    });
    return container.innerHTML;
  }

  function downloadDoc() {
    const body = `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5;margin:2cm 2.2cm;margin-top:5.5cm}.align-right{text-align:right}.align-center{text-align:center}.align-justify{text-align:justify}.indent1{margin-left:1.1cm}img{max-width:5cm}</style></head><body>${docCompatibleHtml()}</body></html>`;
    const blob = new Blob(["\ufeff" + body], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slug}-${new Date().toISOString().slice(0, 10)}.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function saveToDrive() {
    downloadDoc();
    window.open("https://drive.google.com/drive/my-drive?hl=ID", "_blank", "noopener");
    setMessage({ kind: "ok", text: "File .doc terunduh & Google Drive Anda terbuka. Seret file ke Drive, salin tautannya, lalu catat di Dashboard → Arsip." });
  }

  return (
    <div className="tpl-grid tpl-grid-letter">
      <style>{"@media print { @page { size: A4; margin: 0 0 8mm 0; } }"}</style>
      <section className="tpl-editor no-print">
        <h3>{LETTER_TITLES[slug]}</h3>
        {savedInfo.by && (
          <p className="tpl-hint tpl-hint-dim">Template tersimpan terakhir oleh <strong>{savedInfo.by}</strong>{savedInfo.at ? ` · ${new Date(savedInfo.at).toLocaleString("id-ID")}` : ""}.</p>
        )}
        <p className="tpl-hint">
          Klik teks pada pratinjau untuk mengedit. Bagian <mark className="isian-demo">kuning</mark> adalah isian yang biasanya berubah.
          Kop FISIP hanya pratinjau; <strong>hasil cetak otomatis tanpa kop</strong> (kertas kop tersedia di printer kampus).
        </p>
        {draftAvailable && (
          <div className="draft-banner">
            Ada draf yang belum disimpan dari sesi sebelumnya.
            <button type="button" className="btn btn-light btn-mini" onClick={restoreDraft}>Pulihkan draf</button>
            <button type="button" className="btn btn-light btn-mini" onClick={discardDraft}>Abaikan</button>
          </div>
        )}
        <div className="tpl-actions tpl-actions-wrap">
          <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={busy}>🖨 Cetak (tanpa kop)</button>
          <button type="button" className="btn btn-light" onClick={saveToDrive} disabled={busy}>⬢ Simpan ke Google Drive</button>
          <button type="button" className="btn btn-light" onClick={saveTemplate} disabled={busy || !loaded}>💾 Simpan template</button>
          <button type="button" className="btn btn-light btn-mini" onClick={() => fileRef.current?.click()} disabled={busy} title="Ganti template dari file .docx">⇪ Ganti dari .docx</button>
          <button type="button" className="btn btn-light btn-mini" onClick={resetTemplate} disabled={busy}>↺ Bawaan</button>
          {UMUM_DRIVE_URL && <a className="btn btn-light btn-mini" href={UMUM_DRIVE_URL} target="_blank" rel="noreferrer">Folder unit ↗</a>}
          <input ref={fileRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleDocx} hidden />
        </div>
        {message && <div className={message.kind === "ok" ? "dsh-ok" : "dsh-error"}>{message.text}</div>}
        <p className="tpl-hint tpl-hint-dim">Simpan ke Google Drive = unduh file .doc lalu buka Google Drive akun Anda sendiri (aplikasi tidak memegang akses akun Google; unggah dilakukan manual).</p>
      </section>

      <section className="tpl-preview">
        <div className="word-toolbar no-print" role="toolbar" aria-label="Format teks">
          <button type="button" title="Urungkan (Ctrl+Z)" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("undo")}>↶</button>
          <button type="button" title="Ulangi (Ctrl+Y)" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("redo")}>↷</button>
          <span className="wt-sep" />
          <select title="Jenis huruf" defaultValue="Times New Roman" onChange={(e) => exec("fontName", e.target.value)}>
            {FONT_FAMILIES.map((font) => <option key={font} value={font}>{font}</option>)}
          </select>
          <select title="Ukuran huruf (pt)" defaultValue="3" onChange={(e) => exec("fontSize", e.target.value)}>
            {FONT_SIZES.map((size) => <option key={size.value} value={size.value}>{size.label}</option>)}
          </select>
          <span className="wt-sep" />
          <button type="button" title="Tebal (Ctrl+B)" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}><b>B</b></button>
          <button type="button" title="Miring (Ctrl+I)" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}><i>I</i></button>
          <button type="button" title="Garis bawah (Ctrl+U)" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}><u>U</u></button>
          <span className="wt-sep" />
          <button type="button" title="Rata kiri" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyLeft")}>⯇</button>
          <button type="button" title="Rata tengah" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyCenter")}>≡</button>
          <button type="button" title="Rata kanan" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyRight")}>⯈</button>
          <button type="button" title="Rata kiri-kanan (justify)" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyFull")}>☰</button>
          <span className="wt-sep" />
          <button type="button" title="Daftar poin" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}>•≡</button>
          <button type="button" title="Daftar bernomor" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}>1.≡</button>
          <button type="button" title="Kurangi indentasi" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("outdent")}>⇤</button>
          <button type="button" title="Tambah indentasi" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("indent")}>⇥</button>
          <span className="wt-sep" />
          <button type="button" title="Sisipkan gambar / tanda tangan digital" onMouseDown={(e) => e.preventDefault()} onClick={() => imageRef.current?.click()}>🖼 Gambar/TTD</button>
          <button type="button" title="Kecilkan gambar terpilih" onMouseDown={(e) => e.preventDefault()} onClick={() => resizeSelectedImage("3cm")}>Kecil</button>
          <button type="button" title="Ukuran sedang" onMouseDown={(e) => e.preventDefault()} onClick={() => resizeSelectedImage("4.5cm")}>Sedang</button>
          <button type="button" title="Besarkan gambar terpilih" onMouseDown={(e) => e.preventDefault()} onClick={() => resizeSelectedImage("7cm")}>Besar</button>
          <span className="wt-sep" />
          <button type="button" title="Hapus format pada teks terpilih" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("removeFormat")}>⌫A</button>
          <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={insertImageFile} hidden />
        </div>
        <div className="print-area">
          <div className="tk-page tk-a4 letter-page" ref={pageRef}>
            <div className="kop-layer no-print" aria-hidden="true" />
            <div className="page-guide no-print" aria-hidden="true" />
            <div ref={handleRef} className="img-handle no-print" style={{ display: "none" }} onPointerDown={startImageResize} title="Seret untuk mengubah ukuran gambar" />
            <div
              ref={editorRef}
              className="letter-body"
              contentEditable
              suppressContentEditableWarning
              onInput={() => { scheduleDraftSave(); positionHandle(); }}
              onClick={handleEditorClick}
              onDoubleClick={handleEditorDoubleClick}
              onKeyDown={handleEditorKeyDown}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
