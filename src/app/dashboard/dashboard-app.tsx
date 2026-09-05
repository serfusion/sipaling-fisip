"use client";

import Link from "next/link";
import { useAutoLogout } from "@/lib/use-auto-logout";
import { DEFAULT_MAINTENANCE, type MaintenanceState } from "@/lib/maintenance";
import { sisaPemakaian, type CakrawalaCode } from "@/lib/cakrawala";
import type { LecturerOption } from "../lecturer-picker";
import DatabasePanel from "./database-panel";
import GuidancePanel from "./guidance-panel";
import NotificationBell from "./notification-bell";
import CbtPanel from "./cbt-panel";
import ProposalPanel from "./proposal-panel";
import StatisticsPanel from "./statistics-panel";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

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

type RequestRow = {
  id: number;
  ticket: string;
  nim: string;
  studentName: string;
  studyProgram: string;
  contact: string | null;
  serviceType: string;
  serviceNeed: string;
  title: string;
  status: string;
  administrativeStatus: string;
  lecturerNote: string | null;
  adminNote: string | null;
  revisionCount: number;
  fileName: string | null;
  // Folder Google Drive perpustakaan pada penyerahan skripsi/jurnal.
  driveUrl?: string | null;
  lecturerId: number | null;
  createdAt: string;
  updatedAt: string;
  lecturerName: string | null;
};

// Lampiran bernama pada tiket lama, dari masa penyerahan skripsi masih
// diunggah ke penyimpanan portal.
type AttachmentRow = {
  id: number;
  part: string;
  label: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  createdAt: string;
};

type ArchiveRow = {
  id: number;
  unitRole: string;
  docType: string;
  studentName: string | null;
  nim: string | null;
  driveUrl: string;
  createdBy: string | null;
  createdAt: string;
};

type PesananBaris = {
  orderCode: string;
  packageName: string;
  amount: number;
  days: number;
  status: "menunggu" | "lunas" | "kedaluwarsa" | "batal";
  buyerName: string | null;
  accessCode: string | null;
  createdAt: string;
  /** Kapan pembelinya menekan "Saya sudah membayar". */
  claimedAt: string | null;
};

/** Satu pemberitahuan uang masuk yang diteruskan dari ponsel pemilik. */
type MutasiBaris = {
  id: number;
  amount: number;
  text: string;
  incoming: boolean;
  orderCode: string | null;
  result: string;
  createdAt: string;
};

/**
 * Berapa hari lagi langganan ini berakhir, dibulatkan ke atas.
 *
 * Dibulatkan ke ATAS dengan sengaja: sisa dua belas jam adalah "sisa 1 hari",
 * bukan nol. Pelanggan yang aksesnya masih hidup tidak boleh terbaca sudah
 * habis di panel, karena itulah yang memicu tagihan yang tidak perlu.
 */
function sisaHari(sampai: string) {
  const selisih = new Date(sampai).getTime() - Date.now();
  return selisih <= 0 ? 0 : Math.ceil(selisih / (24 * 60 * 60_000));
}

/** Satu pelanggan Cakrawala, dilihat dari panel Super Admin. */
type LanggananBaris = {
  id: number;
  whatsapp: string;
  nama: string | null;
  sampai: string;
  kodeTerakhir: string | null;
  jumlahTukar: number;
  dibuat: string;
  terakhirDipakai: string | null;
};

type AttendanceRow = {
  id: number;
  nim: string;
  studentName: string;
  visitDate: string;
  visitNumber: number;
  note: string | null;
};

import ArsipSkripsi from "./arsip-skripsi";
import ArsipTranskrip from "./arsip-transkrip";

type ViewId =
  | "ringkasan"
  | "statistik"
  | "antrean"
  | "judul"
  | "bimbingan"
  | "database"
  | "template"
  | "arsip"
  | "arsip-transkrip"
  | "skripsi"
  | "absensi"
  | "pengumuman"
  | "maintenance"
  | "cakrawala"
  | "cbt"
  | "akun";

const STATUSES = ["Masuk", "Dicek", "Revisi", "Diproses", "Selesai", "Ditolak"];
const ADMIN_STATUSES = ["Belum Dicek", "Sudah Dicek", "Menunggu Dosen", "Menunggu Mahasiswa", "Selesai", "Arsip"];
const CHIPS = ["Semua", ...STATUSES];

const ROLE_META: Record<Role, { label: string; scope: string; accent: string; soft: string; ink: string; unit: string | null }> = {
  super_admin: { label: "Super Admin", scope: "Akses seluruh unit layanan", accent: "#f5c542", soft: "#fff6d8", ink: "#8a6400", unit: null },
  admin: { label: "Admin", scope: "Akses seluruh unit layanan", accent: "#1565d8", soft: "#e8f0ff", ink: "#0b4aa8", unit: null },
  admin_umum: { label: "Admin Umum", scope: "Hanya Layanan Umum", accent: "#d9466f", soft: "#fff0f4", ink: "#9d174d", unit: "Layanan Umum" },
  admin_akademik: { label: "Admin Akademik", scope: "Hanya Layanan Akademik", accent: "#4f46e5", soft: "#e9efff", ink: "#3730a3", unit: "Layanan Akademik" },
  admin_prodi: { label: "Admin Prodi", scope: "Hanya Layanan Prodi", accent: "#087f8c", soft: "#e0f7fa", ink: "#065f66", unit: "Layanan Prodi" },
  admin_pddikti: { label: "Admin PDDIKTI", scope: "Hanya Layanan PDDIKTI", accent: "#c9790d", soft: "#fff1dc", ink: "#92400e", unit: "Layanan PDDIKTI" },
  admin_perpustakaan: { label: "Admin Perpustakaan", scope: "Hanya Layanan Perpustakaan", accent: "#16a36b", soft: "#e2f8ef", ink: "#065f46", unit: "Layanan Perpustakaan" },
  admin_laboratorium: { label: "Admin Laboratorium", scope: "Hanya Layanan Laboratorium", accent: "#8b5cf6", soft: "#efe8ff", ink: "#5b21b6", unit: "Layanan Laboratorium" },
  dosen: { label: "Dosen", scope: "Hanya bimbingan yang ditujukan kepada Anda", accent: "#0fa3b1", soft: "#e0f7fa", ink: "#087f8c", unit: null },
};

const QUOTES: Array<[string, string]> = [
  ["Habis gelap terbitlah terang.", "R.A. Kartini"],
  ["Ing ngarsa sung tuladha, ing madya mangun karsa, tut wuri handayani.", "Ki Hadjar Dewantara"],
  ["Kalau hidup sekadar hidup, babi di hutan juga hidup.", "Buya Hamka"],
  ["Seorang terpelajar harus sudah berbuat adil sejak dalam pikiran, apalagi dalam perbuatan.", "Pramoedya Ananta Toer"],
  ["Aku rela dipenjara asalkan bersama buku, karena dengan buku aku bebas.", "Mohammad Hatta"],
  ["Bangsa yang besar adalah bangsa yang menghargai jasa para pahlawannya.", "Soekarno"],
  ["Beri aku sepuluh pemuda, niscaya akan kuguncangkan dunia.", "Soekarno"],
  ["Pendidikan adalah senjata paling ampuh untuk mengubah dunia.", "Nelson Mandela"],
  ["Belajarlah sampai ke negeri Cina.", "Peribahasa"],
  ["Anak-anak hidup dan tumbuh sesuai kodratnya sendiri; pendidik hanya dapat merawat dan menuntun.", "Ki Hadjar Dewantara"],
  ["Orang boleh pandai setinggi langit, tapi selama ia tidak menulis, ia akan hilang dari masyarakat.", "Pramoedya Ananta Toer"],
  ["Jadilah manusia yang bermanfaat bagi sesama.", "Ahmad Dahlan"],
  ["Ilmu tanpa amal bagaikan pohon tanpa buah.", "Peribahasa"],
  ["Tidak ada yang tidak mungkin selama kita mau belajar dan berusaha.", "B.J. Habibie"],
];

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Laporan PDF dicetak lewat jendela cetak browser (tanpa pustaka tambahan),
// sehingga pengguna bisa memilih "Save as PDF" atau langsung mencetak.
function downloadPdf(rows: RequestRow[], month: string, year: string) {
  const label = month && year ? `${MONTH_NAMES[Number(month) - 1]} ${year}` : year ? `Tahun ${year}` : "Semua Periode";
  const esc = (v: string | number | null | undefined) =>
    String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = rows
    .map((row, i) => `<tr><td>${i + 1}</td><td>${esc(row.ticket)}</td><td>${esc(row.nim)}</td><td>${esc(row.studentName)}</td>` +
      `<td>${esc(row.studyProgram)}</td><td>${esc(row.serviceType)}</td><td>${esc(row.serviceNeed)}</td>` +
      `<td>${esc(row.lecturerName || "Admin unit")}</td><td>${esc(row.status)}</td><td>${esc(row.administrativeStatus)}</td>` +
      `<td>${new Date(row.createdAt).toLocaleDateString("id-ID")}</td></tr>`)
    .join("");
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Antrean Layanan - ${esc(label)}</title>
<style>
@page { size: A4 landscape; margin: 1cm; }
body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; }
h1 { font-size: 15px; margin: 0 0 2px; }
.sub { font-size: 10px; color: #475569; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 9px; }
th { background: #1e40af; color: #fff; text-align: left; padding: 5px 4px; }
td { border-bottom: 1px solid #dbe3f0; padding: 4px; vertical-align: top; }
tr:nth-child(even) td { background: #f6f8fc; }
.foot { margin-top: 10px; font-size: 8.5px; color: #64748b; }
</style></head><body>
<h1>Laporan Antrean Layanan &mdash; SiPaling FISIP</h1>
<div class="sub">Periode: ${esc(label)} &middot; Jumlah data: ${rows.length} &middot; Dicetak: ${new Date().toLocaleString("id-ID")}</div>
<table><thead><tr><th>No</th><th>Tiket</th><th>NIM</th><th>Nama Mahasiswa</th><th>Prodi</th><th>Jenis</th><th>Kebutuhan</th><th>Tujuan</th><th>Status</th><th>Administratif</th><th>Masuk</th></tr></thead>
<tbody>${body}</tbody></table>
<div class="foot">Dokumen dihasilkan otomatis oleh Sistem Pelayanan Akademik Lingkungan FISIP (sipalingfisip.web.id).</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup diblokir browser. Izinkan popup untuk situs ini, lalu coba lagi.");
    return;
  }
  win.document.write(html);
  win.document.close();
}

function downloadCsv(rows: RequestRow[], month: string, year: string) {
  // Titik koma + BOM supaya langsung rapi saat dibuka di Excel berbahasa Indonesia.
  const header = ["Tiket", "NIM", "Nama Mahasiswa", "Program Studi", "Kontak", "Jenis Layanan", "Kebutuhan", "Judul/Ringkasan", "Dosen Tujuan", "Status", "Status Administratif", "Jumlah Revisi", "Nama File", "Tanggal Masuk", "Terakhir Diperbarui"];
  const escape = (value: string | number | null | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((row) => [
    row.ticket, row.nim, row.studentName, row.studyProgram, row.contact || "", row.serviceType,
    row.serviceNeed, row.title, row.lecturerName || "Admin unit", row.status, row.administrativeStatus,
    row.revisionCount, row.fileName || "", new Date(row.createdAt).toLocaleString("id-ID"), new Date(row.updatedAt).toLocaleString("id-ID"),
  ].map(escape).join(";"));
  const label = month && year ? `${MONTH_NAMES[Number(month) - 1]}-${year}` : year ? `tahun-${year}` : "semua";
  const blob = new Blob(["\uFEFF" + [header.map(escape).join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `antrean-layanan-${label}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

const ARCHIVE_ROLES: Role[] = ["super_admin", "admin", "admin_umum", "admin_akademik", "admin_prodi", "admin_pddikti", "admin_perpustakaan", "admin_laboratorium"];
// Transkrip nilai adalah pekerjaan Admin Akademik; Admin dan Super Admin ikut
// melihat arsipnya karena keduanya menutupi seluruh unit.
const TRANSKRIP_ROLES: Role[] = ["super_admin", "admin", "admin_akademik"];
const ATTENDANCE_ROLES: Role[] = ["super_admin", "admin", "admin_perpustakaan"];
const UMUM_DRIVE_URL = process.env.NEXT_PUBLIC_UMUM_TEMPLATE_DRIVE_URL || "";

const PROPOSAL_ROLES: Role[] = ["super_admin", "admin", "admin_prodi"];
const DATABASE_ROLES: Role[] = [...ARCHIVE_ROLES, "dosen"];

// Statistik memuat angka seluruh fakultas, jadi terbuka untuk semua admin
// tetapi tidak untuk dosen — dosen melihat bimbingannya sendiri.
const STAT_ROLES: Role[] = ARCHIVE_ROLES;

// Menu dikelompokkan supaya daftarnya tidak sepanjang layar. Super Admin
// melihat tiga belas menu sekaligus, dan pada ponsel yang paling bawah —
// termasuk tombol keluar — tidak pernah kelihatan. "Akun" dan "Keluar" karena
// itu pindah ke menu profil di pojok kanan atas, bukan lagi di daftar ini.
type GrupId = "ringkasan" | "dokumen";

const GRUP: Record<GrupId, { label: string; icon: string }> = {
  ringkasan: { label: "Ringkasan", icon: "◫" },
  dokumen: { label: "Dokumen & Arsip", icon: "🗄" },
};

type MenuItem = { id: ViewId; icon: string; label: string; roles: Role[] | "all"; grup?: GrupId };

const MENU: MenuItem[] = [
  { id: "ringkasan", icon: "◫", label: "Ringkasan", roles: "all", grup: "ringkasan" },
  { id: "statistik", icon: "◕", label: "Statistik", roles: STAT_ROLES, grup: "ringkasan" },
  { id: "judul", icon: "✎", label: "Pengajuan Judul", roles: PROPOSAL_ROLES, grup: "ringkasan" },
  // Antrean tetap di luar grup: ini pekerjaan harian, dan lencana jumlahnya
  // kehilangan gunanya kalau tersembunyi di balik satu ketukan.
  { id: "antrean", icon: "☰", label: "Antrean Layanan", roles: "all" },
  { id: "bimbingan", icon: "⚘", label: "Bimbingan & Surat Tugas", roles: ["dosen"] },
  // Menunya ada di portal dosen. Yang MENGAKTIFKAN ujian hanya Super Admin
  // dan Admin — admin bagian sengaja tidak melihat menu ini sama sekali.
  { id: "cbt", icon: "◈", label: "Ujian Online (CBT)", roles: ["super_admin", "admin", "dosen"] },
  { id: "database", icon: "🗄", label: "Database Dokumen", roles: DATABASE_ROLES, grup: "dokumen" },
  { id: "template", icon: "▤", label: "Template Dokumen", roles: ARCHIVE_ROLES, grup: "dokumen" },
  { id: "arsip", icon: "⬢", label: "Arsip Drive", roles: ARCHIVE_ROLES, grup: "dokumen" },
  { id: "arsip-transkrip", icon: "🎓", label: "Arsip Transkrip Nilai", roles: TRANSKRIP_ROLES, grup: "dokumen" },
  { id: "skripsi", icon: "⇩", label: "Arsip Skripsi", roles: ["super_admin", "admin", "admin_perpustakaan"], grup: "dokumen" },
  { id: "absensi", icon: "◔", label: "Absensi Perpustakaan", roles: ATTENDANCE_ROLES, grup: "dokumen" },
  { id: "pengumuman", icon: "✎", label: "Pengumuman & Status", roles: ["super_admin", "admin"] },
  { id: "maintenance", icon: "☾", label: "Mode Maintenance", roles: ["super_admin"] },
  { id: "cakrawala", icon: "✧", label: "Kunci Cakrawala", roles: ["super_admin"] },
  { id: "akun", icon: "⚙", label: "Akun", roles: "all" },
];

/**
 * Susun menu yang boleh dilihat peran ini menjadi baris tunggal dan grup.
 *
 * Grup yang hanya berisi satu menu dibongkar kembali menjadi baris biasa:
 * dosen misalnya cuma punya satu menu di grup "Dokumen & Arsip", dan
 * menyembunyikannya di balik satu ketukan hanya menambah pekerjaan.
 */
type BarisMenu =
  | { jenis: "satu"; item: MenuItem }
  | { jenis: "grup"; id: GrupId; label: string; icon: string; anak: MenuItem[] };

function susunMenu(boleh: MenuItem[]): BarisMenu[] {
  const baris: BarisMenu[] = [];
  const sudah = new Set<GrupId>();
  for (const item of boleh) {
    if (!item.grup) {
      baris.push({ jenis: "satu", item });
      continue;
    }
    if (sudah.has(item.grup)) continue;
    sudah.add(item.grup);
    const anak = boleh.filter((lain) => lain.grup === item.grup);
    if (anak.length === 1) baris.push({ jenis: "satu", item: anak[0] });
    else baris.push({ jenis: "grup", id: item.grup, label: GRUP[item.grup].label, icon: GRUP[item.grup].icon, anak });
  }
  return baris;
}

const VIEW_TITLES: Record<ViewId, string> = {
  ringkasan: "Ringkasan",
  statistik: "Statistik",
  antrean: "Antrean Layanan",
  judul: "Pengajuan Judul",
  bimbingan: "Bimbingan & Surat Tugas",
  database: "Database Dokumen",
  template: "Template Dokumen",
  arsip: "Arsip Drive",
  "arsip-transkrip": "Arsip Transkrip Nilai",
  skripsi: "Arsip Skripsi",
  absensi: "Absensi Perpustakaan",
  pengumuman: "Pengumuman & Status",
  maintenance: "Mode Maintenance",
  cakrawala: "Kunci Cakrawala",
  cbt: "Ujian Online (CBT)",
  akun: "Akun",
};

const STATUS_DOT: Record<string, string> = {
  Masuk: "#3b82f6",
  Dicek: "#eab308",
  Revisi: "#ef4444",
  Diproses: "#8b5cf6",
  Selesai: "#22c55e",
  Ditolak: "#991b1b",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function pillClass(status: string) {
  return `pill s-${status.toLowerCase()}`;
}

export default function DashboardApp({
  profile,
  maintenanceLocked = false,
  initialView,
}: {
  profile: SessionProfile | null;
  /** Akunnya sah, tetapi portal sedang ditutup dan perannya bukan Super Admin. */
  maintenanceLocked?: boolean;
  /** Menu yang diminta lewat alamat (?view=…), mis. tautan dari halaman lain. */
  initialView?: string;
}) {
  useAutoLogout(Boolean(profile));
  const meta = profile ? ROLE_META[profile.role] : ROLE_META.admin;
  // Alamat boleh menunjuk satu menu langsung, tetapi hanya menu yang memang
  // boleh dilihat peran ini — alamat tidak pernah menjadi jalan pintas hak.
  const [view, setView] = useState<ViewId>(() => {
    if (!profile || !initialView) return "ringkasan";
    const diminta = MENU.find((item) => item.id === initialView);
    if (!diminta) return "ringkasan";
    return diminta.roles === "all" || diminta.roles.includes(profile.role) ? diminta.id : "ringkasan";
  });
  const [sideOpen, setSideOpen] = useState(false);
  // Menu profil di pojok kanan atas: tempat "Akun" dan "Keluar" sekarang.
  const [meBuka, setMeBuka] = useState(false);
  const meRef = useRef<HTMLDivElement | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));

  // Quote berganti otomatis tiap 5 detik.
  useEffect(() => {
    const timer = window.setInterval(() => setQuoteIndex((current) => (current + 1) % QUOTES.length), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const [lecturerOptions, setLecturerOptions] = useState<LecturerOption[]>([]);
  const [rowsAll, setRowsAll] = useState<RequestRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [rowsError, setRowsError] = useState("");
  const [chip, setChip] = useState("Semua");
  const [periodMonth, setPeriodMonth] = useState<string>("");
  const [periodYear, setPeriodYear] = useState<string>("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
  // Tiket yang sedang dibuka. Dipakai untuk membuang balasan yang telat
  // datang dari tiket sebelumnya.
  const attachmentsForRef = useRef<string>("");
  const [statusDraft, setStatusDraft] = useState("");
  const [adminStatusDraft, setAdminStatusDraft] = useState("");
  const [lecturerNoteDraft, setLecturerNoteDraft] = useState("");
  const [adminNoteDraft, setAdminNoteDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const [archives, setArchives] = useState<ArchiveRow[]>([]);
  const archivesLoadedRef = useRef(false);
  const [archiveForm, setArchiveForm] = useState({ docType: "", studentName: "", nim: "", driveUrl: "" });
  const [archiveMessage, setArchiveMessage] = useState("");
  const [archiveError, setArchiveError] = useState("");

  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  // Baris yang sedang menunggu penegasan hapus. Penghapusan tidak dapat
  // dibatalkan, jadi tidak pernah terjadi hanya dari satu ketukan.
  const [attHapus, setAttHapus] = useState<number | null>(null);
  const [pesanan, setPesanan] = useState<PesananBaris[]>([]);
  const [psnRingkas, setPsnRingkas] = useState<{ lunas: number; menunggu: number; rupiah: number } | null>(null);
  const [psnSibuk, setPsnSibuk] = useState("");
  const [psnPesan, setPsnPesan] = useState("");
  const [psnGalat, setPsnGalat] = useState("");
  const attendanceLoadedRef = useRef(false);
  const [attForm, setAttForm] = useState({ nim: "", studentName: "", note: "" });
  const [attMessage, setAttMessage] = useState("");

  const [annDraft, setAnnDraft] = useState({ title: "", body: "" });
  const [annCurrent, setAnnCurrent] = useState<{ title: string; body: string } | null>(null);
  const [annMessage, setAnnMessage] = useState("");
  const [svc, setSvc] = useState<{ status: "green" | "yellow" | "red"; message: string }>({ status: "green", message: "Semua layanan aktif" });
  const [svcMessage, setSvcMessage] = useState("");
  const [mt, setMt] = useState<MaintenanceState>(DEFAULT_MAINTENANCE);
  const [mtDraft, setMtDraft] = useState<MaintenanceState>(DEFAULT_MAINTENANCE);
  const [mtBusy, setMtBusy] = useState(false);
  const [mtMessage, setMtMessage] = useState("");
  const [mtError, setMtError] = useState("");

  // Kunci Cakrawala: status kunci, daftar kode, dan formulir pembuat kode.
  const [cwLocked, setCwLocked] = useState(true);
  const [cwCodes, setCwCodes] = useState<CakrawalaCode[]>([]);
  const [cwBusy, setCwBusy] = useState(false);
  const [cwMessage, setCwMessage] = useState("");
  const [cwError, setCwError] = useState("");
  const [cwDraft, setCwDraft] = useState({ label: "", maxUses: "" });
  const [cwCopied, setCwCopied] = useState("");

  const [mutasi, setMutasi] = useState<MutasiBaris[]>([]);

  // Langganan: daftar pelanggan beserta tombol perpanjangannya. Inilah yang
  // dipakai ketika ada yang memperpanjang lewat WhatsApp.
  const [lgDaftar, setLgDaftar] = useState<LanggananBaris[]>([]);
  const [lgAktif, setLgAktif] = useState(0);
  const [lgSibuk, setLgSibuk] = useState("");
  const [lgPesan, setLgPesan] = useState("");
  const [lgGalat, setLgGalat] = useState("");
  const [lgDraft, setLgDraft] = useState({ whatsapp: "", hari: "30", nama: "" });

  async function deleteRequest(ticket: string) {
    if (!window.confirm(`Hapus permanen tiket ${ticket}? Lampiran dan riwayat revisinya ikut terhapus dan tidak dapat dikembalikan.`)) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/requests/${encodeURIComponent(ticket)}`, { method: "DELETE" });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Pengajuan belum dapat dihapus.");
      setRowsAll((current) => current.filter((row) => row.ticket !== ticket));
      setSelected(null);
    } catch (reason: unknown) {
      window.alert(reason instanceof Error ? reason.message : "Pengajuan belum dapat dihapus.");
    } finally {
      setDeleting(false);
    }
  }

  const loadRequests = useCallback(async (term: string, month = "", year = "") => {
    setLoadingRows(true);
    setRowsError("");
    try {
      const search = new URLSearchParams();
      if (term) search.set("q", term);
      if (year) search.set("year", year);
      if (month && year) search.set("month", month);
      const qs = search.toString();
      const response = await fetch(`/api/requests${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      const payload = (await response.json()) as { success?: boolean; message?: string; requests?: RequestRow[] };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Data pengajuan belum dapat dimuat.");
      setRowsAll(payload.requests || []);
    } catch (reason: unknown) {
      setRowsError(reason instanceof Error ? reason.message : "Data pengajuan belum dapat dimuat.");
    } finally {
      setLoadingRows(false);
    }
  }, []);

  // Daftar dosen dipakai oleh panel Pengajuan Judul dan Database Dokumen.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    fetch("/api/lecturers", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { success?: boolean; lecturers?: LecturerOption[] }) => {
        if (!cancelled && payload.success) setLecturerOptions(payload.lecturers || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    // Ditunda satu tick agar tidak memanggil setState secara sinkron di dalam
    // effect (aturan react-hooks) sekaligus berfungsi sebagai debounce pencarian.
    const timer = setTimeout(() => {
      void loadRequests(searchQ, periodMonth, periodYear);
    }, 150);
    return () => clearTimeout(timer);
  }, [profile, searchQ, periodMonth, periodYear, loadRequests]);

  /** Baca ulang daftar kode; dipakai sesudah satu pesanan ditandai lunas. */
  const muatCakrawala = useCallback(async () => {
    try {
      const balas = await fetch("/api/cakrawala-access", { cache: "no-store" });
      const data = (await balas.json()) as { locked?: boolean; codes?: CakrawalaCode[] };
      setCwLocked(data.locked !== false);
      setCwCodes(data.codes || []);
    } catch {
      // Diabaikan: daftar kodenya pelengkap, pesanannya sudah lunas.
    }
  }, []);

  const muatLangganan = useCallback(async () => {
    setLgGalat("");
    try {
      const balas = await fetch("/api/cakrawala-langganan", { cache: "no-store" });
      const data = (await balas.json()) as {
        success?: boolean; message?: string; aktif?: number; akun?: LanggananBaris[];
      };
      if (!balas.ok || !data.success) throw new Error(data.message || "Daftar langganan tidak terbaca.");
      setLgDaftar(data.akun ?? []);
      setLgAktif(data.aktif ?? 0);
    } catch (alasan: unknown) {
      setLgGalat(alasan instanceof Error ? alasan.message : "Daftar langganan tidak terbaca.");
    }
    // setLgGalat ikut didaftarkan bukan karena ia dapat berubah — pengubah
    // useState selalu tetap — melainkan karena React Compiler menyimpulkannya
    // sebagai kebergantungan di sini dan menolak memoisasi yang tidak
    // menyebutkannya. Menghapusnya membuat lint gagal, bukan membuatnya rapi.
  }, [setLgGalat]);

  const muatPesanan = useCallback(async () => {
    setPsnGalat("");
    try {
      const balas = await fetch("/api/cakrawala-pesan", { cache: "no-store" });
      const data = (await balas.json()) as {
        success?: boolean; message?: string;
        daftar?: PesananBaris[]; ringkasan?: { lunas: number; menunggu: number; rupiah: number };
        mutasi?: MutasiBaris[];
      };
      if (!balas.ok || !data.success) throw new Error(data.message || "Pesanan tidak dapat dibaca.");
      setPesanan(data.daftar ?? []);
      setPsnRingkas(data.ringkasan ?? null);
      setMutasi(data.mutasi ?? []);
    } catch (alasan: unknown) {
      setPsnGalat(alasan instanceof Error ? alasan.message : "Pesanan tidak dapat dibaca.");
    }
  }, []);

  /**
   * Tandai satu pesanan lunas. Kodenya terbit di server, bukan di sini —
   * dan begitu terbit, halaman pembelinya yang sedang menunggu langsung
   * menampilkannya sendiri pada tanyaan berikutnya.
   */
  async function tandaiLunas(nomor: string) {
    setPsnSibuk(nomor);
    setPsnPesan("");
    setPsnGalat("");
    try {
      const balas = await fetch("/api/cakrawala-pesan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pesanan: nomor }),
      });
      const data = (await balas.json()) as { success?: boolean; message?: string; pesan?: string };
      if (!balas.ok || !data.success) throw new Error(data.message || "Pesanan gagal ditandai lunas.");
      setPsnPesan(data.pesan || "Pesanan ditandai lunas.");
      await muatPesanan();
      // Daftar kodenya ikut disegarkan supaya kode yang barusan terbit
      // langsung terlihat di bawah, bukan pada muat ulang berikutnya.
      await muatCakrawala();
    } catch (alasan: unknown) {
      setPsnGalat(alasan instanceof Error ? alasan.message : "Pesanan gagal ditandai lunas.");
    } finally {
      setPsnSibuk("");
    }
  }

  /**
   * Menambah hari atau menghentikan satu langganan.
   *
   * Nomornya dikirim apa adanya; server yang meluruskannya. Yang dibaca di
   * WhatsApp bisa "0812…" sedangkan yang tersimpan "62812…", dan menyamakan
   * keduanya dengan tangan hanya menambah salah ketik.
   */
  async function ubahLangganan(aksi: "perpanjang" | "hentikan", whatsapp: string, hari?: number, nama?: string) {
    if (aksi === "hentikan" && !window.confirm(`Hentikan langganan ${whatsapp} sekarang juga?`)) return;
    setLgSibuk(whatsapp);
    setLgPesan("");
    setLgGalat("");
    try {
      const balas = await fetch("/api/cakrawala-langganan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi, whatsapp, hari, nama }),
      });
      const data = (await balas.json()) as { success?: boolean; message?: string; sampai?: string };
      if (!balas.ok || !data.success) throw new Error(data.message || "Langganan belum dapat diubah.");
      setLgPesan(
        aksi === "hentikan"
          ? "Langganan dihentikan."
          : `Langganan diperpanjang sampai ${data.sampai ? new Date(data.sampai).toLocaleDateString("id-ID") : "-"}.`,
      );
      await muatLangganan();
    } catch (alasan: unknown) {
      setLgGalat(alasan instanceof Error ? alasan.message : "Langganan belum dapat diubah.");
    } finally {
      setLgSibuk("");
    }
  }

  useEffect(() => {
    if (!profile) return;
    if (view === "arsip" && !archivesLoadedRef.current && ARCHIVE_ROLES.includes(profile.role)) {
      archivesLoadedRef.current = true;
      fetch("/api/archives", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { success?: boolean; archives?: ArchiveRow[] }) => {
          if (payload.success) setArchives(payload.archives || []);
        })
        .catch(() => {});
    }
    if (view === "absensi" && !attendanceLoadedRef.current && ATTENDANCE_ROLES.includes(profile.role)) {
      attendanceLoadedRef.current = true;
      fetch("/api/attendance?recent=1", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { success?: boolean; visits?: AttendanceRow[] }) => {
          if (payload.success) setAttendance(payload.visits || []);
        })
        .catch(() => {});
    }
    if (view === "pengumuman" && profile.role === "super_admin") {
      fetch("/api/announcements", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { announcement?: { title: string; body: string } | null }) => {
          setAnnCurrent(payload.announcement || null);
        })
        .catch(() => {});
      fetch("/api/service-status", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { status?: "green" | "yellow" | "red"; message?: string }) => {
          if (payload.status) setSvc({ status: payload.status, message: payload.message || "" });
        })
        .catch(() => {});
    }
    if (view === "cakrawala" && profile.role === "super_admin") {
      // Ditunda satu tick, sama seperti pemuat panel lain di sekitarnya:
      // memanggilnya langsung di badan effect membuat setState di dalamnya
      // berjalan sinkron dan memicu gambar bertingkat.
      window.setTimeout(() => void muatPesanan(), 0);
      window.setTimeout(() => void muatLangganan(), 0);
      fetch("/api/cakrawala-access", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { locked?: boolean; codes?: CakrawalaCode[] }) => {
          setCwLocked(payload.locked !== false);
          setCwCodes(payload.codes || []);
        })
        .catch(() => {});
    }
    if (view === "maintenance" && profile.role === "super_admin") {
      fetch("/api/maintenance", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { maintenance?: MaintenanceState }) => {
          if (payload.maintenance) {
            setMt(payload.maintenance);
            setMtDraft(payload.maintenance);
          }
        })
        .catch(() => {});
    }
  }, [view, profile, muatPesanan, muatLangganan]);

  // Pesanan masuk sendiri selama panelnya terbuka.
  //
  // Selama pembayaran masih ditandai lunas dengan tangan, orang yang sudah
  // membayar sedang menatap layar "menunggu pembayaran" sampai tombolnya
  // ditekan di sini. Panel yang hanya menyegar saat dimuat berarti pesanannya
  // baru terlihat pada kali berikutnya halaman ini dibuka — dan menunggu
  // selama itu terasa seperti uangnya hilang.
  useEffect(() => {
    if (!profile || view !== "cakrawala" || profile.role !== "super_admin") return;
    const jam = setInterval(() => void muatPesanan(), 20_000);
    return () => clearInterval(jam);
  }, [view, profile, muatPesanan]);

  const allowedMenu = useMemo(
    () =>
      MENU.filter(
        (item) =>
          // "Akun" tetap terdaftar demi judul halaman dan hak aksesnya, tetapi
          // tempatnya kini di menu profil, bukan di daftar samping.
          item.id !== "akun" && profile && (item.roles === "all" || item.roles.includes(profile.role)),
      ),
    [profile],
  );
  const barisMenu = useMemo(() => susunMenu(allowedMenu), [allowedMenu]);

  // Grup yang sedang terbuka. Grup yang memuat halaman aktif ikut terbuka
  // sendiri, supaya menu yang sedang dibaca tidak pernah tersembunyi.
  const [grupBuka, setGrupBuka] = useState<Record<string, boolean>>({});
  const grupTerbuka = (b: Extract<BarisMenu, { jenis: "grup" }>) =>
    grupBuka[b.id] ?? b.anak.some((anak) => anak.id === view);

  useEffect(() => {
    if (!meBuka) return;
    function diLuar(event: MouseEvent) {
      if (meRef.current && !meRef.current.contains(event.target as Node)) setMeBuka(false);
    }
    function tekanEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setMeBuka(false);
    }
    document.addEventListener("mousedown", diLuar);
    document.addEventListener("keydown", tekanEsc);
    return () => {
      document.removeEventListener("mousedown", diLuar);
      document.removeEventListener("keydown", tekanEsc);
    };
  }, [meBuka]);

  const filteredRows = useMemo(
    () => (chip === "Semua" ? rowsAll : rowsAll.filter((row) => row.status === chip)),
    [rowsAll, chip],
  );

  const stats = useMemo(() => ({
    total: rowsAll.length,
    incoming: rowsAll.filter((row) => row.status === "Masuk").length,
    revision: rowsAll.filter((row) => row.status === "Revisi").length,
    done: rowsAll.filter((row) => row.status === "Selesai").length,
  }), [rowsAll]);

  if (!profile) {
    return (
      <div className="dsh" style={accentStyle(ROLE_META.admin)}>
        <main className="dsh-locked">
          <section className="panel dsh-locked-card">
            {maintenanceLocked ? (
              <>
                <h2>Portal sedang maintenance</h2>
                <p>
                  Akun Anda tidak bermasalah. Dashboard ditutup sementara selama portal dalam perbaikan.
                  Silakan coba lagi setelah portal dibuka kembali.
                </p>
              </>
            ) : (
              <>
                <h2>Login diperlukan</h2>
                <p>Halaman dashboard hanya bisa diakses oleh Super Admin, Admin unit, atau Dosen yang sudah login.</p>
                <a href="/login" className="btn btn-primary">Masuk ke Dashboard →</a>
              </>
            )}
            <Link href="/" className="dsh-locked-back">← Kembali ke portal mahasiswa</Link>
          </section>
        </main>
      </div>
    );
  }

  function openView(next: ViewId) {
    setView(next);
    setSideOpen(false);
    window.scrollTo({ top: 0 });
  }

  function openDrawer(row: RequestRow) {
    setSelected(row);
    setStatusDraft(row.status);
    setAdminStatusDraft(row.administrativeStatus);
    setLecturerNoteDraft(row.lecturerNote || "");
    setAdminNoteDraft(row.adminNote || "");
    setSaveMessage("");
    setSaveError("");
    void loadAttachments(row.ticket);
  }

  // Lampiran bernama hanya dimuat ketika satu tiket dibuka, bukan untuk
  // seluruh antrean — daftar antrean bisa berisi ribuan baris.
  async function loadAttachments(ticket: string) {
    attachmentsForRef.current = ticket;
    setAttachments([]);
    setAttachmentsBusy(true);
    try {
      const response = await fetch(`/api/requests/${encodeURIComponent(ticket)}/attachments`, { cache: "no-store" });
      const payload = (await response.json()) as { success?: boolean; attachments?: AttachmentRow[] };
      if (attachmentsForRef.current !== ticket) return; // tiket lain sudah dibuka
      if (response.ok && payload.success && payload.attachments) setAttachments(payload.attachments);
    } catch {
      if (attachmentsForRef.current === ticket) setAttachments([]);
    } finally {
      if (attachmentsForRef.current === ticket) setAttachmentsBusy(false);
    }
  }

  async function saveSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setSaveMessage("");
    setSaveError("");
    try {
      const response = await fetch(`/api/requests/${encodeURIComponent(selected.ticket)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusDraft,
          administrativeStatus: adminStatusDraft,
          lecturerNote: lecturerNoteDraft,
          adminNote: adminNoteDraft,
        }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Perubahan belum tersimpan.");
      setSaveMessage("Perubahan tersimpan.");
      const patch = {
        status: statusDraft,
        administrativeStatus: adminStatusDraft,
        lecturerNote: lecturerNoteDraft || null,
        adminNote: adminNoteDraft || null,
        updatedAt: new Date().toISOString(),
      };
      setRowsAll((rows) => rows.map((row) => (row.id === selected.id ? { ...row, ...patch } : row)));
      setSelected((current) => (current ? { ...current, ...patch } : current));
    } catch (reason: unknown) {
      setSaveError(reason instanceof Error ? reason.message : "Perubahan belum tersimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function submitArchive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setArchiveMessage("");
    setArchiveError("");
    try {
      const response = await fetch("/api/archives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(archiveForm),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string; archive?: ArchiveRow };
      if (!response.ok || !payload.success || !payload.archive) throw new Error(payload.message || "Arsip belum tersimpan.");
      setArchives((rows) => [payload.archive as ArchiveRow, ...rows]);
      setArchiveForm({ docType: "", studentName: "", nim: "", driveUrl: "" });
      setArchiveMessage("Metadata tersimpan, file tetap berada di Google Drive.");
    } catch (reason: unknown) {
      setArchiveError(reason instanceof Error ? reason.message : "Arsip belum tersimpan.");
    }
  }

  /**
   * Hapus satu catatan kunjungan. Hanya Super Admin yang melihat tombolnya,
   * dan servernya memeriksa lagi — tombol yang disembunyikan bukan penjagaan.
   */
  async function hapusAbsensi(id: number) {
    setAttMessage("");
    try {
      const response = await fetch("/api/attendance", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string; pesan?: string };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Catatan gagal dihapus.");
      setAttendance((rows) => rows.filter((row) => row.id !== id));
      setAttHapus(null);
      setAttMessage(payload.pesan || "Catatan kunjungan dihapus.");
    } catch (reason: unknown) {
      setAttMessage(reason instanceof Error ? reason.message : "Catatan gagal dihapus.");
    }
  }

  async function submitAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttMessage("");
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nim: attForm.nim, studentName: attForm.studentName, note: attForm.note }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string; attendance?: AttendanceRow };
      if (!response.ok || !payload.success || !payload.attendance) throw new Error(payload.message || "Absensi gagal dicatat.");
      setAttendance((rows) => [payload.attendance as AttendanceRow, ...rows]);
      setAttForm({ nim: "", studentName: "", note: "" });
      setAttMessage("Kunjungan tercatat.");
    } catch (reason: unknown) {
      setAttMessage(reason instanceof Error ? reason.message : "Absensi gagal dicatat.");
    }
  }

  async function submitAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAnnMessage("");
    try {
      const response = await fetch("/api/announcements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: annDraft.title, body: annDraft.body, active: true }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Pengumuman gagal disimpan.");
      setAnnCurrent({ title: annDraft.title, body: annDraft.body });
      setAnnDraft({ title: "", body: "" });
      setAnnMessage("Pengumuman berhasil disimpan dan tampil di portal mahasiswa.");
    } catch (reason: unknown) {
      setAnnMessage(reason instanceof Error ? reason.message : "Pengumuman gagal disimpan.");
    }
  }

  async function submitServiceStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSvcMessage("");
    try {
      const response = await fetch("/api/service-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(svc),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Status layanan belum tersimpan.");
      setSvcMessage("Status layanan diperbarui.");
    } catch (reason: unknown) {
      setSvcMessage(reason instanceof Error ? reason.message : "Status layanan belum tersimpan.");
    }
  }

  // Satu pintu simpan untuk seluruh panel maintenance: sakelar maupun tombol
  // "Simpan teks" mengirim persis apa yang sedang tampak di layar, jadi tidak
  // ada perbedaan antara yang dilihat Super Admin dan yang tersimpan.
  async function saveMaintenance(next: MaintenanceState) {
    setMtBusy(true);
    setMtMessage("");
    setMtError("");
    try {
      const response = await fetch("/api/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string; maintenance?: MaintenanceState };
      if (!response.ok || !payload.success || !payload.maintenance) {
        throw new Error(payload.message || "Mode maintenance belum tersimpan.");
      }
      setMt(payload.maintenance);
      setMtDraft(payload.maintenance);
      setMtMessage(
        payload.maintenance.enabled
          ? "Mode maintenance MENYALA. Portal mahasiswa sekarang menampilkan halaman kucing tidur."
          : "Mode maintenance dimatikan. Portal mahasiswa kembali normal.",
      );
    } catch (reason: unknown) {
      setMtError(reason instanceof Error ? reason.message : "Mode maintenance belum tersimpan.");
    } finally {
      setMtBusy(false);
    }
  }

  // Satu pintu untuk seluruh perubahan kunci Cakrawala: sakelar, pembuatan
  // kode, penonaktifan, dan penghapusan. Server yang menentukan hasil
  // akhirnya, jadi tampilan selalu memakai daftar yang dikembalikan.
  async function ubahCakrawala(body: Record<string, unknown>, sukses: string) {
    setCwBusy(true);
    setCwMessage("");
    setCwError("");
    try {
      const response = await fetch("/api/cakrawala-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        locked?: boolean;
        codes?: CakrawalaCode[];
        created?: string | null;
      };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Pengaturan Cakrawala belum tersimpan.");
      }
      setCwLocked(payload.locked !== false);
      setCwCodes(payload.codes || []);
      setCwMessage(payload.created ? `Kode baru dibuat: ${payload.created}` : sukses);
    } catch (reason: unknown) {
      setCwError(reason instanceof Error ? reason.message : "Pengaturan Cakrawala belum tersimpan.");
    } finally {
      setCwBusy(false);
    }
  }

  function salinKode(code: string) {
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCwCopied(code);
        window.setTimeout(() => setCwCopied(""), 2000);
      })
      .catch(() => setCwCopied(""));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const needAction = rowsAll.filter((row) => row.status === "Masuk" || row.status === "Revisi").slice(0, 4);
  const greetName = profile.role === "dosen" ? profile.fullName : meta.label;
  const quote = QUOTES[quoteIndex % QUOTES.length];
  const initials = meta.label.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const templateCards: Array<{ icon: string; title: string; desc: string; href?: string; external?: string }> = [];
  if (["super_admin", "admin", "admin_akademik"].includes(profile.role)) {
    templateCards.push({ icon: "▤", title: "Transkrip Nilai", desc: "Impor Excel → IPK otomatis → pratinjau berkop, cetak tanpa kop.", href: "/dashboard/template?jenis=transkrip" });
    templateCards.push({ icon: "🌐", title: "Transkrip Nilai (ID+EN)", desc: "Impor Excel KUI → transkrip dwibahasa (Indonesia + Inggris) siap cetak Legal tanpa kop.", href: "/dashboard/template?jenis=transkrip-en" });
  }
  if (["super_admin", "admin", "admin_umum"].includes(profile.role)) {
    templateCards.push({ icon: "✉", title: "Surat Keterangan Aktif", desc: "Pratinjau berkop FISIP → edit langsung → cetak tanpa kop (kertas kop kampus).", href: "/dashboard/template?jenis=surat-aktif" });
    templateCards.push({ icon: "⌕", title: "Izin Penelitian", desc: "Pratinjau berkop FISIP → edit langsung → cetak tanpa kop (kertas kop kampus).", href: "/dashboard/template?jenis=izin-penelitian" });
    templateCards.push({ icon: "⚑", title: "Permohonan Praktek Kerja Lapangan", desc: "Pratinjau berkop FISIP → edit langsung → cetak tanpa kop (kertas kop kampus).", href: "/dashboard/template?jenis=pkl" });
    if (UMUM_DRIVE_URL) {
      templateCards.push({ icon: "⬢", title: 'Folder "SURAT PERMOHONAN"', desc: "Kumpulan template surat lain milik Admin Umum di Google Drive.", external: UMUM_DRIVE_URL });
    }
  }
  if (["super_admin", "admin", "admin_prodi"].includes(profile.role)) {
    // SKPI (Surat Keterangan Pendamping Ijazah) — khusus Admin Prodi.
    // Isian templatenya menyusul; kartunya sudah disiapkan di sini.
    templateCards.push({
      icon: "🎓",
      title: "SKPI",
      desc: "Surat Keterangan Pendamping Ijazah. Format resminya menyusul.",
      href: undefined,
    });
  }
  if (["admin_pddikti", "admin_perpustakaan", "admin_laboratorium"].includes(profile.role)) {
    templateCards.push({ icon: "＋", title: "Template unit Anda", desc: "Pola yang sama dengan Transkrip/Surat. Template unit ini akan ditambahkan berikutnya.", href: undefined });
  }

  return (
    <div className="dsh" style={accentStyle(meta)}>
      <aside className={`side ${sideOpen ? "open" : ""}`}>
        <div className="side-brand">
          <span className="mark"><CapLogo /></span>
          <span><b>SiPaling FISIP</b><small>RUANG KERJA INTERNAL</small></span>
        </div>
        <div className="side-unit">
          <span className="dot" />
          <span><b>{meta.label}</b><small>{meta.scope}</small></span>
        </div>
        <nav className="nav">
          {barisMenu.map((baris) =>
            baris.jenis === "satu" ? (
              <button
                type="button"
                key={baris.item.id}
                className={view === baris.item.id ? "on" : ""}
                onClick={() => openView(baris.item.id)}
              >
                <span className="ic">{baris.item.icon}</span>
                {baris.item.label}
                {baris.item.id === "antrean" && stats.incoming > 0 && <span className="badge">{stats.incoming}</span>}
              </button>
            ) : (
              <div className="nav-grup" key={baris.id}>
                <button
                  type="button"
                  className={`nav-grup-kepala ${grupTerbuka(baris) ? "buka" : ""} ${
                    baris.anak.some((anak) => anak.id === view) ? "aktif" : ""
                  }`}
                  aria-expanded={grupTerbuka(baris)}
                  onClick={() => setGrupBuka((kini) => ({ ...kini, [baris.id]: !grupTerbuka(baris) }))}
                >
                  <span className="ic">{baris.icon}</span>
                  {baris.label}
                  <span className="nav-grup-tanda" aria-hidden="true">▾</span>
                </button>
                {grupTerbuka(baris) && (
                  <div className="nav-grup-anak">
                    {baris.anak.map((anak) => (
                      <button
                        type="button"
                        key={anak.id}
                        className={view === anak.id ? "on" : ""}
                        onClick={() => openView(anak.id)}
                      >
                        <span className="ic">{anak.icon}</span>
                        {anak.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
        </nav>
        <div className="side-foot">
          <Link href="/">← Portal Mahasiswa</Link>
        </div>
      </aside>
      {sideOpen && <button type="button" className="backdrop" aria-label="Tutup menu" onClick={() => setSideOpen(false)} />}

      <div className="maincol">
        <div className="topbar">
          <button type="button" className="burger" onClick={() => setSideOpen(true)}>☰</button>
          <div className="crumb">
            <small>DASHBOARD · {meta.label.toUpperCase()}</small>
            <b>{VIEW_TITLES[view]}</b>
          </div>
          <form
            className="topsearch"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchQ(searchDraft.trim());
              setChip("Semua");
              openView("antrean");
            }}
          >
            <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Cari nomor tiket… (global)" />
            <button type="submit">Cari</button>
          </form>
          <NotificationBell
            onOpenRef={(refCode) => {
              // Notifikasi pengajuan judul membuka panel yang relevan.
              if (refCode.startsWith("SIPALING-PRODI-JUDUL-")) {
                openView(profile.role === "dosen" ? "bimbingan" : "judul");
                return;
              }
              // Sisanya bernomor tiket. Menekan pesannya membawa langsung ke
              // tiketnya, bukan ke daftar yang masih harus dicari sendiri —
              // notifikasi yang tidak mengantar ke mana-mana sama saja dengan
              // tidak ada.
              setSearchDraft(refCode);
              setSearchQ(refCode);
              setChip("Semua");
              openView(profile.role === "dosen" ? "bimbingan" : "antrean");
            }}
          />
          <div className="me" ref={meRef}>
            <button
              type="button"
              className="me-btn"
              onClick={() => setMeBuka((buka) => !buka)}
              aria-expanded={meBuka}
              aria-haspopup="menu"
              title="Akun dan keluar"
            >
              <span className="ava">{initials}</span>
              <span className="me-nama"><b>{profile.fullName}</b><small>{meta.label}</small></span>
              <span className="me-tanda" aria-hidden="true">▾</span>
            </button>
            {meBuka && (
              <div className="me-menu" role="menu">
                <div className="me-menu-kepala">
                  <b>{profile.fullName}</b>
                  <small>{profile.email}</small>
                  <span>{meta.label}</span>
                </div>
                <button type="button" role="menuitem" onClick={() => { setMeBuka(false); openView("akun"); }}>
                  <span aria-hidden="true">⚙</span> Akun
                </button>
                <Link role="menuitem" href="/" onClick={() => setMeBuka(false)}>
                  <span aria-hidden="true">←</span> Portal Mahasiswa
                </Link>
                <button type="button" role="menuitem" className="me-keluar" onClick={() => void logout()}>
                  <span aria-hidden="true">⎋</span> Keluar
                </button>
              </div>
            )}
          </div>
        </div>

        <main className="content">
          {view === "ringkasan" && (
            <section>
              <div className="greet">
                <div>
                  <p className="section-eyebrow">RINGKASAN HARI INI</p>
                  <h2 className="dsh-title">Halo, {greetName} 👋</h2>
                </div>
                <span className="datechip"><i /> {today}</span>
              </div>
              <div className="quotebox">
                <span className="qmark">”</span>
                <div>
                  <p>“{quote[0]}”</p>
                  <small>{quote[1]}</small>
                </div>
                <button type="button" title="Kutipan lain" onClick={() => setQuoteIndex((index) => index + 1)}>↻</button>
              </div>
              <div className="dstats">
                <div className="stat" style={{ "--sc": "#1565d8" } as CSSProperties}><span className="tag">TOTAL</span><b>{stats.total}</b><small>Total pengajuan</small></div>
                <div className="stat" style={{ "--sc": "#eab308" } as CSSProperties}><span className="tag">BARU</span><b>{stats.incoming}</b><small>Perlu dicek</small></div>
                <div className="stat" style={{ "--sc": "#8b5cf6" } as CSSProperties}><span className="tag">REVISI</span><b>{stats.revision}</b><small>Menunggu revisi</small></div>
                <div className="stat" style={{ "--sc": "#16a36b" } as CSSProperties}><span className="tag">BERES</span><b>{stats.done}</b><small>Selesai</small></div>
              </div>
              <div className="twocol">
                <div className="panel">
                  <div className="list-head">
                    <h3>Perlu tindakan lebih dulu</h3>
                    <button type="button" className="linklike" onClick={() => openView("antrean")}>Buka antrean →</button>
                  </div>
                  {needAction.length === 0 ? (
                    <div className="dempty">Tidak ada yang menunggu, antrean Anda bersih ✨</div>
                  ) : (
                    needAction.map((row) => (
                      <button
                        type="button"
                        className="actline"
                        key={row.id}
                        onClick={() => {
                          openView("antrean");
                          openDrawer(row);
                        }}
                      >
                        <span className="sdot" style={{ background: STATUS_DOT[row.status] || "#94a3b8" }} />
                        <span><b>{row.serviceNeed}</b><small>{row.studentName} · {row.ticket}</small></span>
                        <span className="when">{formatDate(row.createdAt)}</span>
                      </button>
                    ))
                  )}
                </div>
                <div className="panel quick">
                  <h3>Aksi cepat</h3>
                  <button type="button" onClick={() => openView("antrean")}><span className="qi">☰</span><span><b>Buka antrean</b><small>Proses tiket yang masuk hari ini</small></span></button>
                  {STAT_ROLES.includes(profile.role) && (
                    <button type="button" onClick={() => openView("statistik")}><span className="qi">◕</span><span><b>Buka Dasbor Kinerja</b><small>Ketuntasan layanan, corong pengajuan judul, beban bimbingan, luaran</small></span></button>
                  )}
                  {PROPOSAL_ROLES.includes(profile.role) && (
                    <button type="button" onClick={() => openView("judul")}><span className="qi">✎</span><span><b>Verifikasi pengajuan judul</b><small>Ceklis berkas dan pilih dosen pembimbing</small></span></button>
                  )}
                  {profile.role === "dosen" && (
                    <button type="button" onClick={() => openView("bimbingan")}><span className="qi">⚘</span><span><b>Bimbingan & Surat Tugas</b><small>Terima/tolak mahasiswa, unduh surat tugas</small></span></button>
                  )}
                  {DATABASE_ROLES.includes(profile.role) && (
                    <button type="button" onClick={() => openView("database")}><span className="qi">🗄</span><span><b>{profile.role === "dosen" ? "Dokumen yang mencantumkan Anda" : "Tambahkan Data di Database"}</b><small>Surat tugas, sertifikat, publikasi, artikel</small></span></button>
                  )}
                  {ARCHIVE_ROLES.includes(profile.role) && (
                    <>
                      <button type="button" onClick={() => openView("template")}><span className="qi">▤</span><span><b>Buat dokumen dari template</b><small>Transkrip, surat, dan template unit Anda</small></span></button>
                      <button type="button" onClick={() => openView("arsip")}><span className="qi">⬢</span><span><b>Arsip Drive</b><small>Catat link hasil cetak, file tetap di Drive</small></span></button>
                    </>
                  )}
                  {TRANSKRIP_ROLES.includes(profile.role) && (
                    <button type="button" onClick={() => openView("arsip-transkrip")}><span className="qi">🎓</span><span><b>Arsip Transkrip Nilai</b><small>Siapa saja yang transkripnya sudah dibuat, buka lagi untuk cetak ulang</small></span></button>
                  )}
                  {["super_admin", "admin"].includes(profile.role) && (
                    <button type="button" onClick={() => openView("pengumuman")}><span className="qi">✎</span><span><b>Perbarui pengumuman & status layanan</b><small>Tampil di halaman utama mahasiswa</small></span></button>
                  )}
                </div>
              </div>
            </section>
          )}

          {view === "antrean" && (
            <section>
              <p className="section-eyebrow">LAYANAN</p>
              <h2 className="dsh-title">
                {profile.role === "dosen"
                  ? "Bimbingan yang ditujukan kepada Anda"
                  : meta.unit
                    ? `Antrean ${meta.unit}`
                    : "Antrean seluruh unit"}
              </h2>
              {searchQ && (
                <p className="searchinfo">
                  Hasil pencarian tiket “{searchQ}” · <button type="button" className="linklike" onClick={() => { setSearchQ(""); setSearchDraft(""); }}>tampilkan semua</button>
                </p>
              )}
              <div className="period-bar">
                <select value={periodMonth} onChange={(event) => setPeriodMonth(event.target.value)} aria-label="Filter bulan" disabled={!periodYear}>
                  <option value="">Semua bulan</option>
                  {MONTH_NAMES.map((name, index) => <option key={name} value={String(index + 1)}>{name}</option>)}
                </select>
                <select value={periodYear} onChange={(event) => { setPeriodYear(event.target.value); if (!event.target.value) setPeriodMonth(""); }} aria-label="Filter tahun">
                  <option value="">Semua tahun (200 terbaru)</option>
                  {Array.from({ length: new Date().getFullYear() - 2024 + 1 }, (_, index) => String(2025 + index)).map((yearOption) => (
                    <option key={yearOption} value={yearOption}>{yearOption}</option>
                  ))}
                </select>
                <div className="period-actions">
                  <button type="button" className="btn btn-primary period-download" onClick={() => downloadPdf(filteredRows, periodMonth, periodYear)} disabled={filteredRows.length === 0}>
                    <span className="pd-ico">PDF</span> Unduh Data <b>({filteredRows.length})</b>
                  </button>
                  <button type="button" className="btn btn-light period-download btn-mini" onClick={() => downloadCsv(filteredRows, periodMonth, periodYear)} disabled={filteredRows.length === 0} title="Unduh versi Excel/CSV">
                    ⬇ CSV
                  </button>
                </div>
              </div>
              <div className="chips">
                {CHIPS.map((item) => {
                  const count = item === "Semua" ? rowsAll.length : rowsAll.filter((row) => row.status === item).length;
                  return (
                    <button type="button" key={item} className={`chip ${chip === item ? "on" : ""}`} onClick={() => setChip(item)}>
                      {item}{count > 0 ? ` · ${count}` : ""}
                    </button>
                  );
                })}
              </div>
              <div className="panel">
                {rowsError && <div className="dsh-error">{rowsError}</div>}
                <div className="qtable-wrap">
                  <table className="qt">
                    <thead>
                      <tr><th>Pengajuan</th><th>Mahasiswa</th><th>Layanan</th><th>Status</th><th>Masuk</th></tr>
                    </thead>
                    <tbody>
                      {loadingRows ? (
                        <tr><td colSpan={5}><div className="dempty">Memuat pengajuan…</div></td></tr>
                      ) : filteredRows.length === 0 ? (
                        <tr><td colSpan={5}><div className="dempty"><b>Tidak ada tiket</b><br />untuk filter ini.</div></td></tr>
                      ) : (
                        filteredRows.map((row) => (
                          <tr key={row.id} className={selected?.id === row.id ? "row-on" : ""} onClick={() => openDrawer(row)}>
                            <td><b>{row.ticket}</b><small>{row.serviceNeed}</small></td>
                            <td><b>{row.studentName}</b><small>{row.nim}</small></td>
                            <td>{row.serviceType.replace("Layanan ", "")}<small>{row.lecturerName || "Admin unit"}</small></td>
                            <td><span className={pillClass(row.status)}>{row.status}</span>{row.revisionCount > 0 && <small>{row.revisionCount} revisi</small>}</td>
                            <td>{formatDate(row.createdAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="pagerow"><span>Menampilkan {filteredRows.length} dari {rowsAll.length} tiket termuat {periodYear ? "(periode terpilih, maks. 2000)" : "(maks. 200 terbaru, pilih tahun untuk laporan penuh)"}</span></div>
              </div>
            </section>
          )}

          {view === "statistik" && STAT_ROLES.includes(profile.role) && <StatisticsPanel />}

          {view === "judul" && PROPOSAL_ROLES.includes(profile.role) && (
            <ProposalPanel lecturers={lecturerOptions} isSuperAdmin={profile.role === "super_admin"} />
          )}

          {view === "bimbingan" && profile.role === "dosen" && (
            <GuidancePanel lecturerName={profile.fullName} />
          )}

          {view === "database" && DATABASE_ROLES.includes(profile.role) && (
            <DatabasePanel
              lecturers={lecturerOptions}
              role={profile.role}
              canDelete={profile.role === "super_admin"}
            />
          )}

          {view === "template" && (
            <section>
              <p className="section-eyebrow">DOKUMEN</p>
              <h2 className="dsh-title">Template Dokumen unit Anda</h2>
              <div className="tcards">
                {templateCards.map((card) => {
                  const inner = (
                    <>
                      <span className="ti">{card.icon}</span>
                      <span><b>{card.title}</b><small>{card.desc}</small></span>
                    </>
                  );
                  if (card.href) {
                    return <Link className="tcard" href={card.href} key={card.title}>{inner}</Link>;
                  }
                  if (card.external) {
                    return <a className="tcard" href={card.external} target="_blank" rel="noreferrer" key={card.title}>{inner}</a>;
                  }
                  return <div className="tcard tcard-off" key={card.title}>{inner}</div>;
                })}
                {templateCards.length === 0 && <div className="panel dempty">Role ini tidak memiliki template.</div>}
              </div>
            </section>
          )}

          {view === "arsip" && (
            <section>
              <p className="section-eyebrow">GOOGLE DRIVE</p>
              <h2 className="dsh-title">Arsip dokumen: metadata di web, file di Drive</h2>
              <form className="panel arsip-add" onSubmit={submitArchive}>
                <div className="arsip-grid">
                  <input required maxLength={120} placeholder="Nama dokumen (mis. Transkrip Nilai, cetak resmi)" value={archiveForm.docType} onChange={(event) => setArchiveForm({ ...archiveForm, docType: event.target.value })} />
                  <input maxLength={160} placeholder="Nama mahasiswa (opsional)" value={archiveForm.studentName} onChange={(event) => setArchiveForm({ ...archiveForm, studentName: event.target.value })} />
                  <input maxLength={32} placeholder="NIM (opsional)" value={archiveForm.nim} onChange={(event) => setArchiveForm({ ...archiveForm, nim: event.target.value })} />
                  <input required placeholder="Tempel link Google Drive (https://drive.google.com/…)" value={archiveForm.driveUrl} onChange={(event) => setArchiveForm({ ...archiveForm, driveUrl: event.target.value })} />
                </div>
                <button className="btn btn-primary" type="submit">Simpan metadata</button>
                {archiveMessage && <div className="dsh-ok">{archiveMessage}</div>}
                {archiveError && <div className="dsh-error">{archiveError}</div>}
              </form>
              <div className="panel qtable-wrap">
                <table className="qt">
                  <thead><tr><th>Dokumen</th><th>Mahasiswa</th><th>Dibuat oleh</th><th>Tanggal</th><th /></tr></thead>
                  <tbody>
                    {archives.length === 0 ? (
                      <tr><td colSpan={5}><div className="dempty">Belum ada arsip. Setelah mencetak dokumen, unggah PDF-nya ke folder Drive unit Anda lalu catat tautannya di formulir atas.</div></td></tr>
                    ) : (
                      archives.map((row) => (
                        <tr key={row.id}>
                          <td><b>{row.docType}</b><small>{row.driveUrl}</small></td>
                          <td>{row.studentName || "-"}<small>{row.nim || ""}</small></td>
                          <td>{row.createdBy || "-"}</td>
                          <td>{formatDate(row.createdAt)}</td>
                          <td><a className="dlink" href={row.driveUrl} target="_blank" rel="noreferrer">Buka di Drive ↗</a></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {view === "arsip-transkrip" && TRANSKRIP_ROLES.includes(profile.role) && (
            <ArsipTranskrip bolehHapus={TRANSKRIP_ROLES.includes(profile.role)} />
          )}

          {view === "skripsi" && ["super_admin", "admin", "admin_perpustakaan"].includes(profile.role) && (
            <ArsipSkripsi bolehHapus={profile.role === "super_admin" || profile.role === "admin"} />
          )}

          {view === "absensi" && (
            <section>
              <p className="section-eyebrow">PERPUSTAKAAN</p>
              <h2 className="dsh-title">Absensi perpustakaan</h2>
              <form className="panel arsip-add" onSubmit={submitAttendance}>
                <div className="arsip-grid arsip-grid-3">
                  <input required placeholder="NIM" value={attForm.nim} onChange={(event) => setAttForm({ ...attForm, nim: event.target.value.replace(/\D/g, "") })} />
                  <input required placeholder="Nama mahasiswa" value={attForm.studentName} onChange={(event) => setAttForm({ ...attForm, studentName: event.target.value })} />
                  <input placeholder="Catatan (opsional)" value={attForm.note} onChange={(event) => setAttForm({ ...attForm, note: event.target.value })} />
                </div>
                <button className="btn btn-primary" type="submit">Catat kunjungan (nomor otomatis)</button>
                {attMessage && <div className="dsh-ok">{attMessage}</div>}
              </form>
              <div className="panel qtable-wrap">
                <table className="qt">
                  <thead>
                    <tr>
                      <th>NIM</th><th>Nama</th><th>Kunjungan ke-</th><th>Waktu</th><th>Catatan</th>
                      {profile.role === "super_admin" && <th aria-label="Aksi" />}
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.length === 0 ? (
                      <tr><td colSpan={profile.role === "super_admin" ? 6 : 5}><div className="dempty">Belum ada data kunjungan. Kunjungan dari form mahasiswa (Absensi Perpustakaan) otomatis tercatat di sini.</div></td></tr>
                    ) : (
                      attendance.map((row) => (
                        <tr key={row.id}>
                          <td>{row.nim}</td>
                          <td>{row.studentName}</td>
                          <td>{row.visitNumber}</td>
                          <td>{formatDate(row.visitDate)}</td>
                          <td>{row.note || "-"}</td>
                          {profile.role === "super_admin" && (
                            <td className="qt-aksi">
                              {attHapus === row.id ? (
                                <span className="qt-pasti">
                                  <b>Hapus?</b>
                                  <button type="button" className="btn btn-danger btn-mini" onClick={() => void hapusAbsensi(row.id)}>Ya</button>
                                  <button type="button" className="btn btn-light btn-mini" onClick={() => setAttHapus(null)}>Batal</button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-light btn-mini"
                                  title="Hapus catatan kunjungan ini"
                                  onClick={() => setAttHapus(row.id)}
                                >
                                  Hapus
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {view === "pengumuman" && profile.role === "super_admin" && (
            <section>
              <p className="section-eyebrow">SUPER ADMIN</p>
              <h2 className="dsh-title">Pengumuman portal & status layanan</h2>
              <form className="panel annform" onSubmit={submitAnnouncement}>
                <label>Judul<input required placeholder="Judul pengumuman" value={annDraft.title} onChange={(event) => setAnnDraft({ ...annDraft, title: event.target.value })} /></label>
                <label>Isi<textarea required placeholder="Tulis pengumuman untuk halaman utama mahasiswa…" value={annDraft.body} onChange={(event) => setAnnDraft({ ...annDraft, body: event.target.value })} /></label>
                <button className="btn btn-primary" type="submit">Simpan Pengumuman</button>
                {annMessage && <div className="dsh-ok">{annMessage}</div>}
                <div className="annprev">
                  <small>TAMPIL DI PORTAL SEBAGAI:</small>
                  <b>{annCurrent?.title || "Belum ada pengumuman"}</b>
                  <p>{annCurrent?.body || "Pengumuman yang Anda simpan akan tampil di sini dan di halaman utama mahasiswa."}</p>
                </div>
              </form>
              <form className="panel annform" onSubmit={submitServiceStatus} style={{ marginTop: 14 }}>
                <label>Indikator status layanan (tampil di portal)
                  <select value={svc.status} onChange={(event) => setSvc({ ...svc, status: event.target.value as "green" | "yellow" | "red" })}>
                    <option value="green">Hijau: semua layanan aktif</option>
                    <option value="yellow">Kuning: sebagian layanan terganggu</option>
                    <option value="red">Merah: layanan sedang tidak tersedia</option>
                  </select>
                </label>
                <label>Pesan status<input value={svc.message} onChange={(event) => setSvc({ ...svc, message: event.target.value })} placeholder="Semua layanan aktif" /></label>
                <button className="btn btn-primary" type="submit">Simpan Status</button>
                {svcMessage && <div className="dsh-ok">{svcMessage}</div>}
              </form>
            </section>
          )}

          {view === "maintenance" && profile.role === "super_admin" && (
            <section>
              <p className="section-eyebrow">SUPER ADMIN</p>
              <h2 className="dsh-title">Mode maintenance portal</h2>

              <div className="panel">
                <div className="mtp-hero" data-on={mt.enabled ? "1" : undefined}>
                  <div className="mtp-hero-copy">
                    <b>{mt.enabled ? "Portal sedang ditutup" : "Portal terbuka normal"}</b>
                    <span>
                      {mt.enabled
                        ? mt.adminLogin
                          ? "Pengunjung umum melihat halaman kucing tidur. Admin unit dan dosen tetap dapat masuk seperti biasa."
                          : "Pengunjung umum melihat halaman kucing tidur. Admin unit dan dosen ikut terkunci; hanya Anda yang dapat masuk."
                        : "Mahasiswa dapat mengakses seluruh layanan seperti biasa."}
                    </span>
                  </div>
                  <span className="mtp-state" data-on={mt.enabled ? "1" : undefined}>
                    {mt.enabled ? "MAINTENANCE" : "NORMAL"}
                  </span>
                  <label className="mtp-switch mtp-switch-danger" title="Nyalakan / matikan mode maintenance">
                    <input
                      type="checkbox"
                      checked={mt.enabled}
                      disabled={mtBusy}
                      onChange={(event) => void saveMaintenance({ ...mtDraft, enabled: event.target.checked })}
                    />
                    <i aria-hidden="true" />
                  </label>
                </div>

                <div className="mtp-row">
                  <div className="mtp-row-copy">
                    <b>Admin dan dosen boleh masuk selama maintenance</b>
                    <span>
                      {mt.adminLogin
                        ? "MENYALA: Admin unit dan dosen dapat login dan bekerja seperti biasa selagi portal ditutup. Pilih ini bila perbaikannya butuh banyak tangan."
                        : "MATI: Admin unit dan dosen tidak dapat login selama portal ditutup, dan yang sesinya masih hidup ikut dikeluarkan. Hanya Anda sebagai Super Admin yang tetap masuk."}
                      {" "}Sakelar ini tidak berpengaruh pada akun Anda sendiri.
                    </span>
                  </div>
                  <label className="mtp-switch" title="Izinkan / tutup login admin dan dosen selama maintenance">
                    <input
                      type="checkbox"
                      checked={mt.adminLogin}
                      disabled={mtBusy}
                      onChange={(event) => void saveMaintenance({ ...mtDraft, adminLogin: event.target.checked })}
                    />
                    <i aria-hidden="true" />
                  </label>
                </div>

                <div className="mtp-row">
                  <div className="mtp-row-copy">
                    <b>Pintu rahasia pada titik huruf &ldquo;i&rdquo;</b>
                    <span>
                      Titik di atas huruf i pada kata &ldquo;maintenance&rdquo; menjadi tautan tersembunyi ke halaman login.
                      Tanpa penanda, tanpa tooltip, dan tidak ikut urutan Tab. Hanya yang tahu letaknya yang bisa masuk.
                      Bila dimatikan, titik itu kembali menjadi titik biasa.
                    </span>
                  </div>
                  <label className="mtp-switch" title="Aktifkan / nonaktifkan tautan tersembunyi">
                    <input
                      type="checkbox"
                      checked={mt.secretDoor}
                      disabled={mtBusy}
                      onChange={(event) => void saveMaintenance({ ...mtDraft, secretDoor: event.target.checked })}
                    />
                    <i aria-hidden="true" />
                  </label>
                </div>

                <form
                  className="annform"
                  style={{ padding: "16px 0 0" }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveMaintenance(mtDraft);
                  }}
                >
                  <label>
                    Kalimat pembuka (di atas kata maintenance)
                    <input
                      value={mtDraft.lead}
                      maxLength={120}
                      placeholder={DEFAULT_MAINTENANCE.lead}
                      onChange={(event) => setMtDraft({ ...mtDraft, lead: event.target.value })}
                    />
                  </label>
                  <label>
                    Pesan utama
                    <textarea
                      value={mtDraft.message}
                      maxLength={400}
                      placeholder={DEFAULT_MAINTENANCE.message}
                      onChange={(event) => setMtDraft({ ...mtDraft, message: event.target.value })}
                    />
                  </label>
                  <label>
                    Teks lencana kuning di bawah pesan
                    <input
                      value={mtDraft.note}
                      maxLength={90}
                      placeholder={DEFAULT_MAINTENANCE.note}
                      onChange={(event) => setMtDraft({ ...mtDraft, note: event.target.value })}
                    />
                  </label>

                  <div className="mtp-actions">
                    <button className="btn btn-primary" type="submit" disabled={mtBusy}>
                      {mtBusy ? "Menyimpan…" : "Simpan teks"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-light"
                      disabled={mtBusy}
                      onClick={() =>
                        setMtDraft({
                          ...mtDraft,
                          lead: DEFAULT_MAINTENANCE.lead,
                          message: DEFAULT_MAINTENANCE.message,
                          note: DEFAULT_MAINTENANCE.note,
                        })
                      }
                    >
                      Pulihkan teks bawaan
                    </button>
                    <a className="btn btn-light" href="/?preview=maintenance" target="_blank" rel="noreferrer">
                      Lihat pratinjau →
                    </a>
                  </div>

                  {mtMessage && <div className="dsh-ok">{mtMessage}</div>}
                  {mtError && <div className="dsh-error">{mtError}</div>}
                </form>

                <div className="mtp-hint">
                  <b>Yang perlu diketahui.</b> Menu ini hanya tampil untuk Super Admin, dan server pun hanya menerima
                  perubahan dari Super Admin, Admin biasa ditolak. Selama maintenance menyala, pengiriman form dari
                  pengunjung umum ditolak sementara. Akun Super Admin Anda tidak pernah ikut terkunci, dan halaman
                  login tetap bisa dibuka langsung lewat <code>/login</code>, jadi Anda tidak akan pernah terkunci
                  di luar walaupun pintu rahasianya dimatikan. Yang ditolak tidak diberi tahu bahwa masih ada peran
                  yang bisa masuk; pesannya hanya menyebut portal sedang maintenance.
                </div>
              </div>
            </section>
          )}

          {view === "cbt" && ["super_admin", "admin", "dosen"].includes(profile.role) && (
            <CbtPanel role={profile.role} />
          )}

          {view === "cakrawala" && profile.role === "super_admin" && (
            <section>
              <p className="section-eyebrow">SUPER ADMIN</p>
              <h2 className="dsh-title">Kunci menu Cakrawala</h2>

              {/* Pesanan ditaruh PALING ATAS. Inilah yang perlu ditengok tiap
                  hari; daftar kode dan sakelar kuncinya jarang disentuh. */}
              <div className="panel psn-panel">
                <div className="psn-kepala">
                  <div>
                    <b>Pesanan akses</b>
                    <span>
                      Tekan &ldquo;Tandai lunas&rdquo; setelah pembayarannya terlihat di mutasi. Kodenya terbit
                      sendiri dan langsung muncul di layar pembelinya, tanpa Anda perlu mengirim apa pun.
                    </span>
                  </div>
                  <button type="button" className="btn btn-light btn-mini" onClick={() => void muatPesanan()}>
                    ↻ Muat ulang
                  </button>
                </div>

                {psnRingkas && (
                  <div className="psn-angka">
                    <div><b>{psnRingkas.menunggu}</b><span>menunggu</span></div>
                    <div><b>{psnRingkas.lunas}</b><span>lunas</span></div>
                    <div><b>{`Rp ${(psnRingkas.rupiah || 0).toLocaleString("id-ID")}`}</b><span>diterima</span></div>
                  </div>
                )}

                {psnPesan && <div className="dsh-ok">{psnPesan}</div>}
                {psnGalat && <div className="dsh-error">{psnGalat}</div>}

                <div className="qtable-wrap">
                  <table className="qt">
                    <thead>
                      <tr><th>Pesanan</th><th>Paket</th><th>Nominal</th><th>Status</th><th>Kode</th><th aria-label="Aksi" /></tr>
                    </thead>
                    <tbody>
                      {pesanan.length === 0 ? (
                        <tr><td colSpan={6}><div className="dempty">Belum ada pesanan masuk.</div></td></tr>
                      ) : (
                        pesanan.map((o) => (
                          <tr key={o.orderCode} className={o.claimedAt && o.status !== "lunas" ? "psn-diklaim" : undefined}>
                            <td>
                              <code>{o.orderCode}</code>
                              {o.buyerName && <small className="psn-nama">{o.buyerName}</small>}
                              {o.claimedAt && o.status !== "lunas" && (
                                <small className="psn-klaim">
                                  ● mengaku sudah bayar ·{" "}
                                  {new Date(o.claimedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                </small>
                              )}
                            </td>
                            <td>{o.packageName} · {o.days} hari</td>
                            {/* Nominalnya yang dicocokkan dengan mutasi, jadi
                                ditulis penuh dan mudah disalin mata. */}
                            <td><b>Rp {o.amount.toLocaleString("id-ID")}</b></td>
                            <td><span className={`pill psn-${o.status}`}>{o.status}</span></td>
                            <td>{o.accessCode ? <code>{o.accessCode}</code> : "-"}</td>
                            <td className="qt-aksi">
                              {o.status === "menunggu" || o.status === "kedaluwarsa" ? (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-mini"
                                  disabled={psnSibuk === o.orderCode}
                                  onClick={() => void tandaiLunas(o.orderCode)}
                                >
                                  {psnSibuk === o.orderCode ? "…" : "Tandai lunas"}
                                </button>
                              ) : o.status === "lunas" ? (
                                <span className="psn-sudah">✓ terbit</span>
                              ) : "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* JEMBATAN DANA
                  Panel kecil yang menjawab satu pertanyaan yang tidak dapat
                  dijawab dari mana pun juga: apakah pemberitahuan dari ponsel
                  benar-benar sampai? Tanpa ini, jembatan yang salah pasang
                  dan jembatan yang benar tetapi belum ada yang membayar
                  terlihat sama persis — sunyi. */}
              <div className="panel psn-panel">
                <div className="psn-kepala">
                  <div>
                    <b>Jembatan DANA</b>
                    <span>
                      {mutasi.length > 0
                        ? "Pemberitahuan dari ponsel Anda sampai ke sini. Pesanan yang nominalnya cocok dilunaskan sendiri."
                        : "Belum ada satu pun pemberitahuan yang sampai. Selama kosong, pelunasan masih harus ditandai dengan tangan di tabel atas."}
                    </span>
                  </div>
                  <span className={`pill ${mutasi.length > 0 ? "psn-lunas" : "psn-kedaluwarsa"}`}>
                    {mutasi.length > 0 ? "aktif" : "belum aktif"}
                  </span>
                </div>

                {mutasi.length > 0 && (
                  <div className="qtable-wrap">
                    <table className="qt">
                      <thead>
                        <tr><th>Waktu</th><th>Nominal</th><th>Hasil</th><th>Pemberitahuan</th></tr>
                      </thead>
                      <tbody>
                        {mutasi.map((m) => (
                          <tr key={m.id}>
                            <td>{new Date(m.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                            <td><b>Rp {m.amount.toLocaleString("id-ID")}</b></td>
                            <td>
                              <span className={`pill ${m.result === "cocok" ? "psn-lunas" : m.result === "tanpa-pesanan" ? "psn-menunggu" : "psn-kedaluwarsa"}`}>
                                {m.result}
                              </span>
                              {m.orderCode && <small className="psn-nama"><code>{m.orderCode}</code></small>}
                            </td>
                            <td><small className="psn-mutasi-teks">{m.text}</small></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Langganan berdiri di antara pesanan dan daftar kode karena
                  di sinilah keduanya bertemu: pesanan menerbitkan kode, kode
                  menjadi langganan pada sebuah nomor, dan perpanjangan lewat
                  WhatsApp tidak menyentuh kode sama sekali — ia menambah hari
                  di baris ini, dan web serta aplikasi ikut memanjang. */}
              <div className="panel psn-panel">
                <div className="psn-kepala">
                  <div>
                    <b>Langganan pelanggan</b>
                    <span>
                      Langganan menempel pada nomor WhatsApp, bukan pada perangkat. Ada yang
                      memperpanjang lewat WhatsApp? Ketik nomornya di bawah, tambahkan harinya, dan
                      akun itu langsung hidup lagi di web maupun aplikasi tanpa kode baru.
                    </span>
                  </div>
                  <button type="button" className="btn btn-light btn-mini" onClick={() => void muatLangganan()}>
                    ↻ Muat ulang
                  </button>
                </div>

                <div className="psn-angka">
                  <div><b>{lgAktif}</b><span>masih aktif</span></div>
                  <div><b>{lgDaftar.length}</b><span>pernah berlangganan</span></div>
                  <div><b>{lgDaftar.filter((a) => sisaHari(a.sampai) > 0 && sisaHari(a.sampai) <= 7).length}</b><span>habis ≤ 7 hari</span></div>
                </div>

                <form
                  className="lg-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const hari = Number(lgDraft.hari);
                    if (!lgDraft.whatsapp.trim()) {
                      setLgGalat("Nomor WhatsApp belum diisi.");
                      return;
                    }
                    if (!Number.isInteger(hari) || hari < 1) {
                      setLgGalat("Jumlah hari belum benar.");
                      return;
                    }
                    void ubahLangganan("perpanjang", lgDraft.whatsapp.trim(), hari, lgDraft.nama.trim() || undefined);
                  }}
                >
                  <label>
                    <span>Nomor WhatsApp</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      placeholder="0812xxxxxxxx"
                      value={lgDraft.whatsapp}
                      onChange={(event) => setLgDraft((d) => ({ ...d, whatsapp: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Tambah hari</span>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={lgDraft.hari}
                      onChange={(event) => setLgDraft((d) => ({ ...d, hari: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Nama (opsional)</span>
                    <input
                      type="text"
                      placeholder="Nama pelanggan"
                      value={lgDraft.nama}
                      onChange={(event) => setLgDraft((d) => ({ ...d, nama: event.target.value }))}
                    />
                  </label>
                  <button type="submit" className="btn btn-primary btn-mini" disabled={Boolean(lgSibuk)}>
                    {lgSibuk ? "…" : "Perpanjang"}
                  </button>
                </form>

                {lgPesan && <div className="dsh-ok">{lgPesan}</div>}
                {lgGalat && <div className="dsh-error">{lgGalat}</div>}

                <div className="qtable-wrap">
                  <table className="qt">
                    <thead>
                      <tr><th>WhatsApp</th><th>Nama</th><th>Berlaku sampai</th><th>Kode terakhir</th><th aria-label="Aksi" /></tr>
                    </thead>
                    <tbody>
                      {lgDaftar.length === 0 ? (
                        <tr><td colSpan={5}><div className="dempty">Belum ada yang menukarkan kode dengan nomor WhatsApp.</div></td></tr>
                      ) : (
                        lgDaftar.map((a) => {
                          const sisa = sisaHari(a.sampai);
                          return (
                            <tr key={a.id}>
                              <td><code>{a.whatsapp}</code></td>
                              <td>{a.nama || "-"}</td>
                              <td>
                                {new Date(a.sampai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                <small className={`lg-sisa${sisa <= 0 ? " lg-habis" : sisa <= 7 ? " lg-dekat" : ""}`}>
                                  {sisa <= 0 ? "sudah habis" : sisa === 1 ? "sisa 1 hari" : `sisa ${sisa} hari`}
                                </small>
                              </td>
                              <td>{a.kodeTerakhir ? <code>{a.kodeTerakhir}</code> : "-"}</td>
                              <td className="qt-aksi">
                                <button
                                  type="button"
                                  className="btn btn-light btn-mini"
                                  disabled={lgSibuk === a.whatsapp}
                                  onClick={() => void ubahLangganan("perpanjang", a.whatsapp, 30)}
                                >
                                  +30 hari
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-mini"
                                  disabled={lgSibuk === a.whatsapp || sisa <= 0}
                                  onClick={() => void ubahLangganan("hentikan", a.whatsapp)}
                                >
                                  Hentikan
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel">
                <div className="mtp-hero" data-on={cwLocked ? "1" : undefined}>
                  <div className="mtp-hero-copy">
                    <b>{cwLocked ? "Cakrawala terkunci" : "Cakrawala terbuka untuk umum"}</b>
                    <span>
                      {cwLocked
                        ? "Pengunjung melihat halaman pratinjau berisi keunggulan tiap menu, dan hanya masuk setelah memasukkan kode akses."
                        : "Siapa pun yang membuka /alat langsung memakai seluruh alat tanpa kode."}
                    </span>
                  </div>
                  <span className="mtp-state cwp-state" data-on={cwLocked ? "1" : undefined}>
                    {cwLocked ? "TERKUNCI" : "TERBUKA"}
                  </span>
                  <label className="mtp-switch" title="Kunci / buka menu Cakrawala">
                    <input
                      type="checkbox"
                      checked={cwLocked}
                      disabled={cwBusy}
                      onChange={(event) =>
                        void ubahCakrawala(
                          { action: "toggle", locked: event.target.checked },
                          event.target.checked ? "Cakrawala dikunci kembali." : "Kunci Cakrawala dimatikan.",
                        )
                      }
                    />
                    <i aria-hidden="true" />
                  </label>
                </div>

                <form
                  className="annform"
                  style={{ padding: "16px 0 0" }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const jatah = Number(cwDraft.maxUses);
                    void ubahCakrawala(
                      {
                        action: "generate",
                        label: cwDraft.label,
                        maxUses: Number.isFinite(jatah) && jatah > 0 ? Math.floor(jatah) : 0,
                      },
                      "Kode baru dibuat.",
                    );
                    setCwDraft({ label: "", maxUses: "" });
                  }}
                >
                  <label>
                    Catatan pemilik kode (opsional)
                    <input
                      value={cwDraft.label}
                      maxLength={80}
                      placeholder="Contoh: Rina, Ilkom 2021, atau Kelas Metopen A"
                      onChange={(event) => setCwDraft({ ...cwDraft, label: event.target.value })}
                    />
                  </label>
                  <label>
                    Batas pemakaian (kosongkan untuk tanpa batas)
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={cwDraft.maxUses}
                      placeholder="Contoh: 1 untuk sekali pakai"
                      onChange={(event) => setCwDraft({ ...cwDraft, maxUses: event.target.value })}
                    />
                  </label>
                  <div className="mtp-actions">
                    <button className="btn btn-primary" type="submit" disabled={cwBusy}>
                      {cwBusy ? "Memproses…" : "✧ Buat kode baru"}
                    </button>
                    <a className="btn btn-light" href="/alat" target="_blank" rel="noreferrer">
                      Lihat halaman pratinjau →
                    </a>
                  </div>
                  {cwMessage && <div className="dsh-ok">{cwMessage}</div>}
                  {cwError && <div className="dsh-error">{cwError}</div>}
                </form>

                <div className="cwp-list">
                  <div className="cwp-list-h">
                    <b>Kode yang sudah dibuat</b>
                    <span>{cwCodes.length} kode</span>
                  </div>
                  {cwCodes.length === 0 ? (
                    <div className="nofile">Belum ada kode. Buat satu di atas, lalu bagikan kepada yang berhak.</div>
                  ) : (
                    cwCodes.map((item) => (
                      <div className={`cwp-item ${item.active ? "" : "cwp-item-off"}`} key={item.code}>
                        <div className="cwp-main">
                          <button type="button" className="cwp-code" onClick={() => salinKode(item.code)} title="Klik untuk menyalin">
                            {item.code}
                            <span>{cwCopied === item.code ? "tersalin ✓" : "⧉ salin"}</span>
                          </button>
                          <small>{item.label || "Tanpa catatan"}</small>
                        </div>
                        <div className="cwp-meta">
                          <span>Dipakai {item.uses}×</span>
                          <span>Sisa: {sisaPemakaian(item)}</span>
                          <span>{item.lastUsedAt ? `Terakhir ${formatDate(item.lastUsedAt)}` : "Belum pernah dipakai"}</span>
                        </div>
                        <div className="cwp-aksi">
                          <button
                            type="button"
                            className="btn btn-light"
                            disabled={cwBusy}
                            onClick={() =>
                              void ubahCakrawala(
                                { action: item.active ? "disable" : "enable", code: item.code },
                                item.active ? "Kode dinonaktifkan." : "Kode diaktifkan kembali.",
                              )
                            }
                          >
                            {item.active ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={cwBusy}
                            onClick={() => {
                              if (!window.confirm(`Hapus kode ${item.code}? Pemakainya akan langsung tertutup.`)) return;
                              void ubahCakrawala({ action: "remove", code: item.code }, "Kode dihapus.");
                            }}
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mtp-hint">
                  <b>Yang perlu diketahui.</b> Menu ini hanya tampil untuk Super Admin, dan server pun hanya menerima
                  perubahan dari Super Admin. Kode yang dimasukkan mahasiswa disimpan pada cookie perangkatnya selama
                  30 hari. Menonaktifkan atau menghapus kode langsung menutup akses semua perangkat yang memakainya.
                  Akun Super Admin sendiri selalu dapat membuka Cakrawala tanpa kode.
                </div>
              </div>
            </section>
          )}

          {view === "akun" && (
            <section>
              <p className="section-eyebrow">PENGATURAN</p>
              <h2 className="dsh-title">Akun saya</h2>
              <div className="panel akun-card">
                <b>{profile.fullName}</b>
                <span>{profile.email}</span>
                <span>Role: {meta.label} · {meta.scope}</span>
                <p>Untuk mengganti password, gunakan menu reset password di halaman login (dikelola Supabase Auth).</p>
              </div>
            </section>
          )}

          <div className="dfoot">
            <strong>SiPaling FISIP</strong>
            <span>Dashboard Admin · Concept Superfal Dev · © {new Date().getFullYear()}</span>
            <Link href="/">Portal mahasiswa →</Link>
          </div>
        </main>
      </div>

      <aside className={`drawer ${selected ? "open" : ""}`}>
        {selected && (
          <>
            <div className="drawer-h">
              <div>
                <small>DETAIL TIKET</small>
                <b>{selected.ticket}</b>
                <small>{formatDate(selected.createdAt)}</small>
              </div>
              <span className={pillClass(selected.status)}>{selected.status}</span>
              <button type="button" className="x" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="drawer-b">
              <div className="drawer-student">
                <b>{selected.studentName}</b>
                <span>{selected.nim} · {selected.studyProgram}</span>
                <span>{selected.contact || "Kontak belum dicantumkan"}</span>
              </div>
              <dl className="dd">
                <div><dt>Unit layanan</dt><dd>{selected.serviceType}</dd></div>
                <div><dt>Kebutuhan</dt><dd>{selected.serviceNeed}</dd></div>
                <div className="dwide"><dt>Judul / ringkasan</dt><dd>{selected.title}</dd></div>
                <div><dt>Dosen tujuan</dt><dd>{selected.lecturerName || "Admin unit layanan"}</dd></div>
                <div><dt>Revisi ke</dt><dd>{selected.revisionCount}</dd></div>
              </dl>
              {selected.driveUrl && (
                <a className="dlink dlink-file" href={selected.driveUrl} target="_blank" rel="noreferrer">
                  ↗ Buka folder Drive penyerahan
                </a>
              )}
              {attachments.length > 0 ? (
                <div className="dbagian">
                  <div className="dbagian-h">
                    <b>Berkas per bagian</b>
                    <span>{attachments.length} berkas · sudah tersortir</span>
                  </div>
                  {attachments.map((item) => (
                    <a
                      className="dbagian-item"
                      key={item.id}
                      href={`/api/attachments/${item.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="dbagian-ic">⇩</span>
                      <span className="dbagian-teks">
                        <b>{item.label}</b>
                        <small>{item.fileName} · {(item.fileSize / 1024 / 1024).toFixed(2).replace(".", ",")} MB</small>
                      </span>
                    </a>
                  ))}
                </div>
              ) : attachmentsBusy ? (
                <div className="nofile">Memuat lampiran…</div>
              ) : selected.fileName ? (
                <a className="dlink dlink-file" href={`/api/files/${selected.id}`} target="_blank" rel="noreferrer">⇩ Unduh {selected.fileName}</a>
              ) : selected.driveUrl ? null : (
                <div className="nofile">Tidak ada lampiran pada pengajuan ini.</div>
              )}
              <form className="upd" onSubmit={saveSelected}>
                <p className="section-eyebrow">PERBARUI LAYANAN</p>
                <div className="grid2">
                  <label>Status utama
                    <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                      {STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                  <label>Status administratif
                    <select value={adminStatusDraft} onChange={(event) => setAdminStatusDraft(event.target.value)}>
                      {ADMIN_STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                </div>
                <label>Catatan dosen<textarea value={lecturerNoteDraft} onChange={(event) => setLecturerNoteDraft(event.target.value)} placeholder="Catatan untuk mahasiswa…" /></label>
                <label>Catatan admin<textarea value={adminNoteDraft} onChange={(event) => setAdminNoteDraft(event.target.value)} placeholder="Catatan internal admin…" /></label>
                <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan perubahan"}</button>
                {saveMessage && <div className="dsh-ok">{saveMessage}</div>}
                {saveError && <div className="dsh-error">{saveError}</div>}
              </form>
              {profile.role === "super_admin" && (
                <div className="danger-zone">
                  <b>Zona Super Admin</b>
                  <p>Menghapus pengajuan bersifat permanen: data tiket, riwayat revisi, dan lampirannya di penyimpanan ikut terhapus.</p>
                  <button type="button" className="btn btn-danger" disabled={deleting} onClick={() => void deleteRequest(selected.ticket)}>
                    {deleting ? "Menghapus…" : "🗑 Hapus pengajuan ini"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function accentStyle(meta: { accent: string; soft: string; ink: string }) {
  return {
    "--accent": meta.accent,
    "--accent-soft": meta.soft,
    "--accent-ink": meta.ink,
  } as CSSProperties;
}

function CapLogo() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M32 14L8 24l24 10 24-10-24-10z" fill="#F2C94C" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 28v9c0 3.6 7.2 7 16 7s16-3.4 16-7v-9" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".95" />
      <path d="M56 24v12" stroke="#F2C94C" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="56" cy="38" r="2.6" fill="#F2C94C" stroke="#FFFFFF" strokeWidth="1.2" />
      <path d="M24 50h16" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}
