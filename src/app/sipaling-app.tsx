"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  FINAL_TASK_TYPES,
  isProposalCode,
  PROPOSAL_STATUS,
  type FinalTaskType,
} from "@/lib/academic";
import {
  BUKTI_PARTS,
  buktiAccept,
  isBuktiPenyerahan,
  periksaBuktiFile,
} from "@/lib/bukti-penyerahan";
import { LecturerPicker, type LecturerOption } from "./lecturer-picker";
import TitleProposalForm from "./title-proposal-form";

type Tab = "form" | "judul" | "status" | "revisi" | "about";
type ServiceType = (typeof serviceTypes)[number];

type Lecturer = LecturerOption;

type ProposalChoice = {
  lecturerName: string;
  studyProgram: string;
  choiceOrder: number;
  selected: boolean;
  decision: string;
};

type ProposalRecord = {
  code: string;
  nim: string;
  studentName: string;
  studyProgram: string;
  concentration: string;
  gpa: string;
  finalTaskType: string;
  title: string;
  financeVerified: boolean;
  eligibilityVerified: boolean;
  status: string;
  approvedLecturerName: string | null;
  prodiNote: string | null;
  lecturerNote: string | null;
  createdAt: string;
  updatedAt: string;
  choices: ProposalChoice[];
};

type Announcement = {
  id: number;
  title: string;
  body: string;
  updatedAt: string;
};

type StatusRecord = {
  ticket: string;
  nim: string;
  studentName: string;
  studyProgram: string;
  contact: string | null;
  serviceType: string;
  serviceNeed: string;
  title: string;
  lecturer: Lecturer | null;
  status: string;
  administrativeStatus: string;
  revisionCount: number;
  studentNote: string | null;
  lecturerNote: string | null;
  adminNote: string | null;
  fileName: string | null;
  // Bagian-bagian berkas untuk kebutuhan yang mengunggah lebih dari satu
  // lampiran; kosong pada kebutuhan lain.
  attachments?: Array<{ part: string; label: string; fileName: string; fileSize: number }>;
  createdAt: string;
  updatedAt: string;
};

const serviceTypes = [
  "Layanan Tugas Akhir",
  "Layanan PDDIKTI",
  "Layanan Akademik",
  "Layanan Prodi",
  "Layanan Umum",
  "Layanan Perpustakaan",
  "Layanan Laboratorium",
] as const;

type ServiceMeta = {
  short: string;
  description: string;
  icon: string;
  needs: string[];
  requirements?: string[];
  needRequirements?: Record<string, string[]>;
};

const serviceCatalog: Record<ServiceType, ServiceMeta> = {
  "Layanan Tugas Akhir": {
    short: "Tugas Akhir",
    description: "Pilih Skripsi atau Jurnal, ajukan judul, lalu unggah draft dan revisinya.",
    icon: "✦",
    // Daftar kebutuhan diisi dinamis oleh needsFor() sesuai pilihan
    // Skripsi / Jurnal. Nilai di bawah hanya cadangan.
    needs: [
      "Pengajuan Judul Skripsi",
      "Upload Skripsi Full Draft",
      "Upload Revisi Skripsi",
    ],
  },
  "Layanan PDDIKTI": {
    short: "PDDIKTI",
    description: "Perbaikan data mahasiswa pada sistem PDDIKTI.",
    icon: "◎",
    needs: [
      "Perbaikan NIM",
      "Perbaikan Nama Lengkap",
      "Perbaikan Aktivitas Status Mahasiswa",
      "Perbaikan Data lainnya",
    ],
    requirements: [
      "Upload KTP, KK, Akte, Ijazah, KTM, KRS & KHS semester 1 hingga semester sekarang yang sudah dibubuhi tanda tangan.",
      "Upload semua file gabungan dalam format PDF.",
    ],
  },
  "Layanan Akademik": {
    short: "Akademik",
    description: "Perbaikan nilai, transkrip, dan data akademik mahasiswa.",
    icon: "▧",
    needs: [
      "Perbaikan Nilai",
      "Transkrip Nilai",
      "Perbaikan Data Akademik",
      "Konsultasi Akademik",
    ],
  },
  "Layanan Prodi": {
    short: "Prodi",
    description: "Layanan judul, pembimbing, seminar, sidang, dan konsultasi prodi.",
    icon: "⌂",
    needs: [
      "Konsultasi Program Studi",
      "Pengajuan Judul Tugas Akhir",
      "Pengajuan Dosen Pembimbing",
      "Pengajuan Seminar Proposal",
      "Pengajuan Sidang Skripsi",
    ],
  },
  "Layanan Umum": {
    short: "Umum",
    description: "Surat keterangan aktif, izin penelitian, PKL, dan kebutuhan lainnya.",
    icon: "✉",
    needs: [
      "Surat Keterangan Aktif",
      "Izin Penelitian",
      "Permohonan Praktek Kerja Lapangan",
      "Kebutuhan Lainnya",
    ],
  },
  "Layanan Perpustakaan": {
    short: "Perpustakaan",
    description: "Absensi, bebas pustaka, repository, dan penyerahan karya.",
    icon: "▤",
    needs: [
      "Absensi Perpustakaan",
      "Request Bebas Pustaka",
      "Permintaan Cek Repository",
      "Upload Bukti Penyerahan Jurnal/Skripsi",
    ],
    needRequirements: {
      "Upload Bukti Penyerahan Jurnal/Skripsi": [
        "Upload cover sampai daftar isi.",
        "Upload bagian isi skripsi BAB I sampai BAB V.",
        "Upload daftar pustaka sampai selesai.",
        "Upload file skripsi full dalam format PDF.",
      ],
    },
  },
  "Layanan Laboratorium": {
    short: "Laboratorium",
    description: "Peminjaman ruang atau alat, praktikum, dan konsultasi laboratorium.",
    icon: "⌬",
    needs: [
      "Peminjaman Ruang Laboratorium",
      "Peminjaman Alat Laboratorium",
      "Pengajuan Jadwal Praktikum",
      "Konsultasi Laboratorium",
    ],
  },
};

// Kebutuhan pada Layanan Tugas Akhir bergantung pada pilihan Skripsi/Jurnal.
const FINAL_TASK_NEEDS: Record<FinalTaskType, string[]> = {
  Skripsi: ["Pengajuan Judul Skripsi", "Upload Skripsi Full Draft", "Upload Revisi Skripsi"],
  Jurnal: ["Pengajuan Judul Jurnal", "Upload Artikel Jurnal", "Upload Revisi Artikel Jurnal"],
};

function needsFor(type: ServiceType, finalTaskType: FinalTaskType) {
  if (type === "Layanan Tugas Akhir") return FINAL_TASK_NEEDS[finalTaskType];
  return serviceCatalog[type].needs;
}

// Kebutuhan yang membuka Template Pengajuan Judul, bukan form layanan biasa.
const TITLE_PROPOSAL_NEEDS = [
  "Pengajuan Judul Skripsi",
  "Pengajuan Judul Jurnal",
  "Pengajuan Judul Tugas Akhir",
];

function isTitleProposalNeed(need: string) {
  return TITLE_PROPOSAL_NEEDS.includes(need);
}

// Kebutuhan pertama yang benar-benar dapat diisi lewat form layanan biasa.
function firstFormNeed(type: ServiceType, finalTaskType: FinalTaskType) {
  const list = needsFor(type, finalTaskType);
  return list.find((need) => !isTitleProposalNeed(need)) || list[0];
}

type UploadMode = "required-docx" | "required-pdf" | "optional-document";

// Kebutuhan "Upload Bukti Penyerahan Jurnal/Skripsi" tidak muncul di sini:
// berkasnya empat buah, jadi kotak lampiran tunggal diganti seluruhnya oleh
// blok unggah empat bagian dan mode ini tidak dipakai untuknya.
function getUploadMode(serviceType: ServiceType): UploadMode {
  if (serviceType === "Layanan Tugas Akhir") return "required-docx";
  if (serviceType === "Layanan PDDIKTI") return "required-pdf";
  return "optional-document";
}


const DASH_ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  admin_umum: "Admin Umum",
  admin_akademik: "Admin Akademik",
  admin_prodi: "Admin Prodi",
  admin_pddikti: "Admin PDDIKTI",
  admin_perpustakaan: "Admin Perpustakaan",
  admin_laboratorium: "Admin Laboratorium",
  dosen: "Dosen",
};

const statuses = ["Masuk", "Dicek", "Revisi", "Diproses", "Selesai"];

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; message?: string }
    | null;
  if (!response.ok || !payload || payload.success === false) {
    throw new Error(payload?.message || "Terjadi gangguan. Silakan coba lagi.");
  }
  return payload as T;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isAcceptedFile(file: File | null, mode: UploadMode) {
  if (!file || !file.name) return false;
  const name = file.name.toLowerCase();
  const okExt = mode === "required-pdf"
    ? name.endsWith(".pdf")
    : mode === "required-docx"
      ? name.endsWith(".docx")
      : name.endsWith(".pdf") || name.endsWith(".docx");
  return okExt && file.size <= 10 * 1024 * 1024;
}

function hasOnlyLetters(value: string) {
  return /^[A-Za-zÀ-ɏ\s.'-]+$/.test(value.trim());
}

function localDateString(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function copyTicketToClipboard(ticket: string, onDone: () => void) {
  const fallback = () => {
    const area = document.createElement("textarea");
    area.value = ticket;
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      onDone();
    } catch {
      window.prompt("Salin nomor tiket:", ticket);
    }
    document.body.removeChild(area);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ticket).then(onDone).catch(fallback);
  } else {
    fallback();
  }
}

function StatusTimeline({ status }: { status: string }) {
  if (status === "Ditolak") {
    return <div className="tl-reject">Pengajuan ditolak. Baca catatan admin di bawah, lalu ajukan kembali bila perlu.</div>;
  }
  const steps = ["Masuk", "Dicek", "Revisi", "Diproses", "Selesai"];
  const current = steps.indexOf(status);
  return (
    <div className="tline">
      {steps.map((step, index) => (
        <div className={`tl-step ${index < current ? "done" : index === current ? "cur" : ""}`} key={step}>
          <span className="tl-dot">{index < current ? "✓" : index + 1}</span>
          <small>{step}</small>
        </div>
      ))}
    </div>
  );
}

// Ringkasan pelacakan pengajuan judul untuk mahasiswa.
const PROPOSAL_STEPS: string[] = [
  PROPOSAL_STATUS.waitingProdi,
  PROPOSAL_STATUS.waitingLecturer,
  PROPOSAL_STATUS.acceptedLecturer,
];

function proposalTone(status: string) {
  if (status === PROPOSAL_STATUS.acceptedLecturer) return "ok";
  if (status === PROPOSAL_STATUS.rejectedProdi || status === PROPOSAL_STATUS.rejectedLecturer) return "bad";
  return "wait";
}

function ProposalReport({ proposal, onCopy }: { proposal: ProposalRecord; onCopy: (value: string) => void }) {
  const tone = proposalTone(proposal.status);
  const currentStep = PROPOSAL_STEPS.indexOf(proposal.status);
  const rejected = tone === "bad";

  return (
    <div className="report-box tp-report">
      <div className="report-header">
        <div>
          <p className="section-eyebrow">PENGAJUAN JUDUL {proposal.finalTaskType.toUpperCase()}</p>
          <h3>{proposal.title}</h3>
          <span>
            {proposal.code}{" "}
            <button type="button" className="copy-mini" title="Salin kode pelacakan" onClick={() => onCopy(proposal.code)}>⧉</button>
          </span>
        </div>
        <span className={`tp-pill tp-pill-${tone}`}>{proposal.status}</span>
      </div>

      {rejected ? (
        <div className="tl-reject">
          {proposal.status === PROPOSAL_STATUS.rejectedProdi
            ? "Program Studi belum dapat meneruskan pengajuan ini. Silakan baca catatan di bawah, perbaiki, lalu ajukan ulang."
            : "Dosen yang ditunjuk menolak pengajuan ini. Program Studi sedang mencarikan dosen pengganti. Pantau halaman ini secara berkala."}
        </div>
      ) : (
        <div className="tline">
          {PROPOSAL_STEPS.map((step, index) => (
            <div className={`tl-step ${index < currentStep ? "done" : index === currentStep ? "cur" : ""}`} key={step}>
              <span className="tl-dot">{index < currentStep ? "✓" : index + 1}</span>
              <small>{step}</small>
            </div>
          ))}
        </div>
      )}

      <div className="report-grid">
        <div><small>Nama Mahasiswa</small><strong>{proposal.studentName}</strong></div>
        <div><small>NIM</small><strong>{proposal.nim}</strong></div>
        <div><small>Program Studi</small><strong>{proposal.studyProgram}</strong></div>
        <div><small>Konsentrasi</small><strong>{proposal.concentration}</strong></div>
        <div><small>IPK Terakhir</small><strong>{Number(proposal.gpa).toFixed(2).replace(".", ",")}</strong></div>
        <div><small>Jenis Tugas Akhir</small><strong>{proposal.finalTaskType}</strong></div>
        <div><small>Bukti Keuangan</small><strong>{proposal.financeVerified ? "✓ Terverifikasi" : "Menunggu pengecekan"}</strong></div>
        <div><small>Layak Diajukan</small><strong>{proposal.eligibilityVerified ? "✓ Dinyatakan layak" : "Menunggu penilaian"}</strong></div>
        <div><small>Dikirim</small><strong>{formatDate(proposal.createdAt)}</strong></div>
        <div><small>Diperbarui</small><strong>{formatDate(proposal.updatedAt)}</strong></div>
      </div>

      <div className="tp-choice-list">
        <small className="tp-choice-title">Usulan dosen pembimbing</small>
        {proposal.choices.map((choice) => (
          <div className={`tp-choice ${choice.selected ? "tp-choice-on" : ""}`} key={`${choice.choiceOrder}-${choice.lecturerName}`}>
            <span className="tp-choice-order">{choice.choiceOrder}</span>
            <span className="tp-choice-main">
              <b>{choice.lecturerName}</b>
              <small>{choice.studyProgram}</small>
            </span>
            <span className={`tp-choice-tag tp-choice-${choice.selected ? choice.decision.toLowerCase() : "idle"}`}>
              {choice.selected ? (choice.decision === "Menunggu" ? "Dipilih Prodi" : choice.decision) : "Tidak dipilih"}
            </span>
          </div>
        ))}
      </div>

      {proposal.approvedLecturerName && (
        <div className="notice notice-success tp-final">
          Pembimbing Anda: <strong>{proposal.approvedLecturerName}</strong>. Surat tugas akan otomatis terbentuk pada akun dosen tersebut.
        </div>
      )}

      <div className="report-notes">
        <div><small>Catatan Program Studi</small><p>{proposal.prodiNote || "Belum ada catatan dari Program Studi."}</p></div>
        <div><small>Catatan Dosen</small><p>{proposal.lecturerNote || "Belum ada catatan dosen."}</p></div>
      </div>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return <div className="notice notice-error">{message}</div>;
}

function SuccessNotice({ children }: { children: React.ReactNode }) {
  return <div className="notice notice-success">{children}</div>;
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${status.toLowerCase()}`}>{status}</span>;
}

function BrandLogo() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="cap" x1="8" y1="14" x2="56" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE08A" />
          <stop offset="1" stopColor="#F2C94C" />
        </linearGradient>
      </defs>
      <path d="M32 14L8 24l24 10 24-10-24-10z" fill="url(#cap)" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 28v9c0 3.6 7.2 7 16 7s16-3.4 16-7v-9" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".95" />
      <path d="M56 24v12" stroke="#F2C94C" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="56" cy="38" r="2.6" fill="#F2C94C" stroke="#FFFFFF" strokeWidth="1.2" />
      <path d="M24 50h16" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}

function ServiceIcon({ type }: { type: string }) {
  if (type === "Layanan Tugas Akhir") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7l9-3 9 3-9 3-9-3z" fill="currentColor" opacity=".25" stroke="none" />
        <path d="M3 7l9-3 9 3-9 3-9-3z" />
        <path d="M20 8v4" />
        <circle cx="20" cy="13" r="1" fill="currentColor" stroke="none" />
        <path d="M5 11v5c0 1.5 3 3 7 3s7-1.5 7-3v-5" />
        <path d="M12 16v3" />
      </svg>
    );
  }
  if (type === "Layanan PDDIKTI") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 8l-4 4 4 4" />
        <path d="M16 8l4 4-4 4" />
        <path d="M14 5l-4 14" />
      </svg>
    );
  }
  if (type === "Layanan Akademik") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 3h8l4 4v14H7z" />
        <path d="M15 3v5h5M10 12h6M10 16h6" />
      </svg>
    );
  }
  if (type === "Layanan Prodi") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 21V9l8-5 8 5v12" />
        <path d="M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01" />
      </svg>
    );
  }
  if (type === "Layanan Umum") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }
  if (type === "Layanan Perpustakaan") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2V5z" />
        <path d="M20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2V5z" />
        <path d="M8 7h1M8 10h1M15 7h1M15 10h1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3h6" />
      <path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />
      <path d="M7 15h10" fill="currentColor" opacity=".2" stroke="none" />
      <path d="M7 15h10" />
      <circle cx="10.5" cy="18" r=".6" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="17.5" r=".5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function SipalingApp() {
  const [activeTab, setActiveTab] = useState<Tab>("form");
  const [serviceType, setServiceType] = useState<ServiceType>(serviceTypes[0]);
  const [sessionRole, setSessionRole] = useState<string>("");
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [lecturerError, setLecturerError] = useState("");
  const [selectedLecturerId, setSelectedLecturerId] = useState<number | null>(null);
  const [submitMessage, setSubmitMessage] = useState<React.ReactNode>(null);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<React.ReactNode>(null);
  const [statusError, setStatusError] = useState("");
  const [statusData, setStatusData] = useState<StatusRecord | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [revisionMessage, setRevisionMessage] = useState<React.ReactNode>(null);
  const [revisionError, setRevisionError] = useState("");
  const [isUploadingRevision, setIsUploadingRevision] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [selectedNeed, setSelectedNeed] = useState<string>(serviceCatalog[serviceType].needs[0]);
  const [attendanceInfo, setAttendanceInfo] = useState<{ nextVisit: number; date: string; time: string } | null>(null);
  const [serviceState, setServiceState] = useState<{ status: "green" | "yellow" | "red"; message: string }>({ status: "green", message: "Semua layanan aktif" });
  const [statusTicketVal, setStatusTicketVal] = useState("");
  const [finalTaskType, setFinalTaskType] = useState<FinalTaskType>(FINAL_TASK_TYPES[0]);
  const [proposalData, setProposalData] = useState<ProposalRecord | null>(null);
  const [proposalCode, setProposalCode] = useState("");
  const [fileInfo, setFileInfo] = useState("");
  // Nama berkas terpilih untuk tiap bagian bukti penyerahan, ditandai dengan
  // id bagiannya (cover / isi / pustaka / full).
  const [buktiInfo, setBuktiInfo] = useState<Record<string, string>>({});
  const [revFileInfo, setRevFileInfo] = useState("");
  const [copiedNote, setCopiedNote] = useState("");
  // Penanda gembok pada tombol Cakrawala. Hanya status kuncinya yang dibaca —
  // daftar kodenya tidak pernah dikirim ke halaman publik.
  const [cakrawalaLocked, setCakrawalaLocked] = useState(false);

  function doCopy(ticket: string) {
    copyTicketToClipboard(ticket, () => {
      setCopiedNote("Nomor tiket disalin.");
      window.setTimeout(() => setCopiedNote(""), 2200);
    });
  }

  const currentService = serviceCatalog[serviceType];
  const currentNeeds = needsFor(serviceType, finalTaskType);
  // Kebutuhan "Pengajuan Judul" TIDAK boleh memakai form layanan biasa,
  // form itu hanya punya satu Dosen Tujuan, sedangkan pengajuan judul wajib
  // tiga usulan dosen. Semua jalur masuk diarahkan ke templatenya.
  const isProposalNeed = isTitleProposalNeed(selectedNeed);
  const PAYMENT_NOTICE_TYPES: ServiceType[] = ["Layanan Umum", "Layanan Prodi", "Layanan Akademik", "Layanan Perpustakaan"];
  const showPaymentNotice = PAYMENT_NOTICE_TYPES.includes(serviceType);
  const isAcademicReview = serviceType === "Layanan Tugas Akhir";
  // Empat kotak unggah menggantikan lampiran tunggal pada kebutuhan bukti
  // penyerahan, supaya berkas sampai ke Admin Perpustakaan sudah tersortir.
  const isBuktiEmpatBagian = isBuktiPenyerahan(serviceType, selectedNeed);
  const uploadMode = getUploadMode(serviceType);
  const requiresFile = !isBuktiEmpatBagian && uploadMode !== "optional-document";
  const rawDriveUrl = process.env.NEXT_PUBLIC_SURAT_LAINNYA_DRIVE_URL?.trim() || "";
  const suratLainnyaDriveUrl = /^https:\/\/(drive|docs)\.google\.com\//i.test(rawDriveUrl)
    ? rawDriveUrl
    : "";
  const isSuratLainnya = serviceType === "Layanan Umum" && selectedNeed === "Kebutuhan Lainnya";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lecturers")
      .then(readApi<{ lecturers: Lecturer[] }>)
      .then((payload) => {
        if (!cancelled) setLecturers(payload.lecturers);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLecturerError(error instanceof Error ? error.message : "Daftar dosen belum tersedia.");
      });
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { profile?: { role?: string; fullName?: string } } | null) => {
        if (!cancelled && payload?.profile?.role) {
          setSessionRole(payload.profile.role);
        }
      })
      .catch(() => {});
    fetch("/api/announcements")
      .then((response) => response.json())
      .then((payload: { success?: boolean; announcement?: Announcement | null }) => {
        if (!cancelled) setAnnouncement(payload?.announcement || null);
      })
      .catch(() => {
        if (!cancelled) setAnnouncement(null);
      });
    fetch("/api/service-status")
      .then((response) => response.json())
      .then((payload: { status?: "green" | "yellow" | "red"; message?: string }) => {
        if (!cancelled && payload && payload.status) {
          setServiceState({ status: payload.status, message: payload.message || "Semua layanan aktif" });
        }
      })
      .catch(() => {});
    fetch("/api/cakrawala-access")
      .then((response) => response.json())
      .then((payload: { locked?: boolean }) => {
        if (!cancelled) setCakrawalaLocked(payload?.locked === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto load absensi perpustakaan ketika NIM diisi
  useEffect(() => {
    if (serviceType !== "Layanan Perpustakaan" || selectedNeed !== "Absensi Perpustakaan") {
      const resetTimer = window.setTimeout(() => setAttendanceInfo(null), 0);
      return () => window.clearTimeout(resetTimer);
    }

    const nimInput = document.getElementById("nim") as HTMLInputElement | null;
    if (!nimInput) return;

    const handler = async () => {
      const nim = nimInput.value.trim();
      if (!/^\d{4,20}$/.test(nim)) {
        setAttendanceInfo(null);
        return;
      }
      try {
        const res = await fetch(`/api/attendance?nim=${nim}`);
        const data = await res.json();
        if (!data.success) return;

        const now = new Date();
        const dateStr = localDateString(now);
        const timeStr = now.toTimeString().slice(0, 5);

        setAttendanceInfo({
          nextVisit: data.nextVisit || 1,
          date: dateStr,
          time: timeStr,
        });
      } catch {
        setAttendanceInfo(null);
      }
    };

    nimInput.addEventListener("input", handler);
    // Update sekali saat pertama render
    handler();
    return () => nimInput.removeEventListener("input", handler);
  }, [serviceType, selectedNeed]);

  // Update tampilan otomatis absensi setiap detik
  useEffect(() => {
    if (!attendanceInfo) return;
    const interval = setInterval(() => {
      const now = new Date();
      setAttendanceInfo((prev) =>
        prev
          ? {
              ...prev,
              date: localDateString(now),
              time: now.toTimeString().slice(0, 5),
            }
          : null,
      );
    }, 30000); // update tiap 30 detik
    return () => clearInterval(interval);
  }, [attendanceInfo]);

  function selectTab(tab: Tab) {
    setActiveTab(tab);
    window.setTimeout(() => {
      document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 20);
  }

  function selectService(type: ServiceType) {
    const nextNeed = needsFor(type, finalTaskType)[0];
    setServiceType(type);
    setSelectedNeed(nextNeed);
    setAttendanceInfo(null);
    setBuktiInfo({});
    setActiveTab(isTitleProposalNeed(nextNeed) ? "judul" : "form");
    window.setTimeout(() => {
      document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 20);
  }

  // Mengganti Skripsi <-> Jurnal ikut mengganti daftar kebutuhannya.
  function selectFinalTaskType(next: FinalTaskType) {
    setFinalTaskType(next);
    if (serviceType === "Layanan Tugas Akhir") {
      const nextNeed = FINAL_TASK_NEEDS[next][0];
      setSelectedNeed(nextNeed);
      if (isTitleProposalNeed(nextNeed)) setActiveTab("judul");
    }
  }

  function openSuratLainnyaDrive() {
    if (!suratLainnyaDriveUrl) return;
    window.open(suratLainnyaDriveUrl, "_blank", "noopener,noreferrer");
  }

  function selectNeed(need: string) {
    setSelectedNeed(need);
    setBuktiInfo({});
    if (isTitleProposalNeed(need)) {
      // Kebutuhan "Pengajuan Judul" memakai template resmi, bukan form biasa.
      if (need === "Pengajuan Judul Jurnal") setFinalTaskType("Jurnal");
      if (need === "Pengajuan Judul Skripsi") setFinalTaskType("Skripsi");
      selectTab("judul");
      return;
    }
    if (serviceType === "Layanan Umum" && need === "Kebutuhan Lainnya" && suratLainnyaDriveUrl) {
      window.open(suratLainnyaDriveUrl, "_blank", "noopener,noreferrer");
    }
  }

  function clearLecturerSearch() {
    setSelectedLecturerId(null);
  }

  async function submitService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitMessage(null);
    setSubmitError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const fileValue = formData.get("file");
    const file = fileValue instanceof File && fileValue.name ? fileValue : null;
    const nim = String(formData.get("nim") || "").trim();
    const studentName = String(formData.get("studentName") || "").trim();

    if (!/^\d{4,20}$/.test(nim)) {
      setSubmitError("NIM harus berupa angka 4 sampai 20 digit tanpa huruf atau spasi.");
      return;
    }
    if (!hasOnlyLetters(studentName)) {
      setSubmitError("Nama Mahasiswa hanya boleh berisi huruf, spasi, titik, koma, tanda petik, atau tanda hubung.");
      return;
    }

    // Auto-absensi perpustakaan: isi data otomatis ke formData
    if (serviceType === "Layanan Perpustakaan" && selectedNeed === "Absensi Perpustakaan" && attendanceInfo) {
      formData.set("absensiAuto", "1");
      formData.set("absensiHari", new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(new Date(attendanceInfo.date)));
      formData.set("absensiTanggal", attendanceInfo.date);
      formData.set("absensiJam", attendanceInfo.time);
      formData.set("absensiKunjungan", String(attendanceInfo.nextVisit));
    }

    // Empat bagian bukti penyerahan diperiksa satu per satu supaya pesannya
    // menyebut bagian mana yang bermasalah, bukan sekadar "lampiran salah".
    if (isBuktiEmpatBagian) {
      for (const part of BUKTI_PARTS) {
        const entry = formData.get(part.field);
        const partFile = entry instanceof File && entry.name ? entry : null;
        const check = periksaBuktiFile(part, partFile);
        if (!check.ok) {
          setSubmitError(check.pesan);
          return;
        }
      }
      // Lampiran tunggal tidak dipakai pada jalur ini; ikut terkirim kosong
      // hanya akan membingungkan pemeriksaan di server.
      formData.delete("file");
    }

    if (requiresFile && !isAcceptedFile(file, uploadMode)) {
      setSubmitError(
        uploadMode === "required-pdf"
          ? "Lampiran wajib berupa satu file PDF maksimal 10 MB."
          : "Lampiran wajib berformat .DOCX dan maksimal 10 MB.",
      );
      return;
    }
    if (!requiresFile && file && !isAcceptedFile(file, "optional-document")) {
      setSubmitError("Lampiran opsional harus berupa PDF atau DOCX maksimal 10 MB.");
      return;
    }

    // Gabungkan field absensi ke catatan jika layanan perpustakaan + absensi
    const serviceNeed = String(formData.get("serviceNeed") || "");
    if (serviceType === "Layanan Perpustakaan" && serviceNeed === "Absensi Perpustakaan") {
      const hari = String(formData.get("absensiHari") || "").trim();
      const tanggal = String(formData.get("absensiTanggal") || "").trim();
      const jam = String(formData.get("absensiJam") || "").trim();
      const kunjungan = String(formData.get("absensiKunjungan") || "").trim();
      if (!hari || !tanggal || !jam || !kunjungan) {
        setSubmitError("Mohon lengkapi data absensi perpustakaan (hari, tanggal, jam, dan kunjungan ke-).");
        return;
      }
      const absensiNote = `[ABSENSI PERPUSTAKAAN] Hari: ${hari}, Tanggal: ${tanggal}, Jam: ${jam}, Kunjungan ke-${kunjungan}`;
      const existingNote = String(formData.get("studentNote") || "").trim();
      formData.set("studentNote", existingNote ? `${absensiNote} | ${existingNote}` : absensiNote);
    }

    setIsSubmitting(true);
    try {
      const result = await readApi<{ ticket: string }>(
        await fetch("/api/requests", { method: "POST", body: formData }),
      );
      setSubmitMessage(
        <>
          <strong>Pengajuan berhasil dikirim.</strong>
          <br />
          Nomor tiket Anda:
          <strong className="ticket-number">
            {result.ticket}
            <button type="button" className="copy-btn" onClick={() => doCopy(result.ticket)}>⧉ Salin</button>
          </strong>
          <span>Simpan nomor ini untuk memantau status layanan.</span>
        </>,
      );
      form.reset();
      setFileInfo("");
      setBuktiInfo({});
      setServiceType(serviceTypes[0]);
      setSelectedNeed(serviceCatalog[serviceTypes[0]].needs[0]);
      clearLecturerSearch();
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : "Pengajuan gagal dikirim.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function checkStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    setStatusError("");
    setStatusData(null);
    setProposalData(null);
    const data = new FormData(event.currentTarget);
    const code = String(data.get("ticket") || "").trim();
    setIsChecking(true);
    try {
      // Kode pengajuan judul (SIPALING-PRODI-JUDUL-…) dilacak lewat endpoint
      // terpisah karena bentuk datanya berbeda dari tiket layanan biasa.
      if (isProposalCode(code)) {
        const result = await readApi<{ proposal: ProposalRecord }>(
          await fetch(`/api/title-proposals/track?code=${encodeURIComponent(code.toUpperCase())}`),
        );
        setProposalData(result.proposal);
        setStatusMessage("Data pengajuan judul ditemukan.");
        return;
      }
      const result = await readApi<{ data: StatusRecord }>(
        await fetch("/api/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket: code }),
        }),
      );
      setStatusData(result.data);
      setStatusMessage("Data layanan ditemukan.");
    } catch (error: unknown) {
      setStatusError(error instanceof Error ? error.message : "Data layanan tidak ditemukan.");
    } finally {
      setIsChecking(false);
    }
  }

  async function submitRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRevisionMessage(null);
    setRevisionError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const fileValue = formData.get("file");
    const file = fileValue instanceof File && fileValue.name ? fileValue : null;
    if (!isAcceptedFile(file, "required-docx")) {
      setRevisionError("File revisi wajib berformat .DOCX dan berukuran maksimal 10 MB.");
      return;
    }

    setIsUploadingRevision(true);
    try {
      const result = await readApi<{ ticket: string; message: string }>(
        await fetch("/api/revisions", { method: "POST", body: formData }),
      );
      setRevisionMessage(
        <>
          <strong>{result.message}</strong>
          <br />
          Tiket: <strong>{result.ticket}</strong>
        </>,
      );
      form.reset();
      setRevFileInfo("");
    } catch (error: unknown) {
      setRevisionError(error instanceof Error ? error.message : "Revisi gagal dikirim.");
    } finally {
      setIsUploadingRevision(false);
    }
  }

  return (
    <div className="site-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="hero">
        <div className="hero-inner">
          <div className="brand-mark" aria-hidden="true">
            <BrandLogo />
          </div>
          <div className="hero-copy">
            <h1>SiPaling FISIP</h1>
            <p className="hero-subtitle">
              Sistem Pelayanan Akademik Lingkungan FISIP
            </p>
            <div className="hero-actions">
              <button type="button" className="hero-button hero-button-primary" onClick={() => selectTab("form")}>
                <span>＋</span> Form Layanan
              </button>
              <button type="button" className="hero-button" onClick={() => selectTab("judul")}>
                <span>✎</span> Pengajuan Judul
              </button>
              <button type="button" className="hero-button" onClick={() => selectTab("status")}>
                <span>⌕</span> Cek Status
              </button>
              <button type="button" className="hero-button" onClick={() => selectTab("revisi")}>
                Upload Revisi
              </button>
              <a
                className={cakrawalaLocked ? "hero-button hero-button-locked" : "hero-button"}
                href="/alat"
                title={cakrawalaLocked ? "Cakrawala terkunci — lihat pratinjaunya dan masukkan kode akses" : undefined}
              >
                Cakrawala{cakrawalaLocked && <em>🔒 VIP</em>}
              </a>
              <a className={sessionRole ? "hero-button hero-button-logged" : "hero-button"} href="/dashboard">
                {sessionRole ? `● Dashboard ${DASH_ROLE_LABEL[sessionRole] || "Admin"}` : "Login Dosen/Admin"}
              </a>
            </div>
            <form
              className="hero-track"
              onSubmit={(event) => {
                event.preventDefault();
                selectTab("status");
              }}
            >
              <input
                type="text"
                value={statusTicketVal}
                onChange={(event) => setStatusTicketVal(event.target.value)}
                placeholder="Punya nomor tiket? Tempel di sini untuk lacak status"
                aria-label="Nomor tiket"
              />
              <button type="submit">Lacak →</button>
            </form>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="overview-grid" aria-label="Ringkasan SiPaling FISIP">
          <article className="panel announcement-panel">
            <div className="announcement-label"><span className="live-dot" /> Pengumuman</div>
            {announcement ? (
              <>
                <h2>{announcement.title}</h2>
                <p className="announcement-body">{announcement.body}</p>
                <div className="announcement-meta">
                  <span>Diperbarui {formatDate(announcement.updatedAt)}</span>
                </div>
              </>
            ) : (
              <>
                <h2>Belum ada pengumuman</h2>
                <p className="announcement-body announcement-empty">Pengumuman terbaru dari admin akan tampil di sini.</p>
              </>
            )}
          </article>
          <article className="panel status-panel">
            <div className="flow-layout">
              <div className="flow-main">
                <div className="panel-kicker">ALUR LAYANAN</div>
                <h3>Setiap langkah tercatat</h3>
                <div className="status-flow">
                  {statuses.map((status, index) => (
                    <div className={`flow-item flow-c${index + 1}`} key={status}>
                      <span className="flow-dot">{index + 1}</span>
                      <span>{status}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="flow-art" src="/images/alur-cs.png" alt="" aria-hidden="true" />
            </div>
            <p className="panel-footnote">Status akan diperbarui oleh dosen atau admin yang menangani.</p>
          </article>
        </section>

        <section className="service-menu" aria-labelledby="service-menu-title">
          <div className="section-heading compact-heading">
            <div>
              <p className="section-eyebrow">PILIH KEBUTUHAN</p>
              <h2 id="service-menu-title">Layanan yang tersedia</h2>
            </div>
            <span className={`active-indicator status-${serviceState.status}`}>
              <i /> {serviceState.message}
            </span>
          </div>
          <div className="service-grid">
            {serviceTypes.map((type) => {
              const item = serviceCatalog[type];
              const selected = type === serviceType;
              return (
                <button
                  type="button"
                  className={`service-card ${selected ? "service-card-selected" : ""}`}
                  key={type}
                  onClick={() => selectService(type)}
                  aria-pressed={selected}
                >
                  <span className="service-icon"><ServiceIcon type={type} /></span>
                  <span className="service-card-copy"><strong>{item.short}</strong><small>{item.description}</small></span>
                  <span className="service-arrow">→</span>
                </button>
              );
            })}
          </div>
        </section>

        <nav className="tabs" aria-label="Navigasi halaman layanan">
          {(["form", "judul", "status", "revisi", "about"] as Tab[]).map((tab) => {
            const labels: Record<Tab, string> = { form: "Form Layanan", judul: "Pengajuan Judul", status: "Cek Status Layanan", revisi: "Upload Revisi", about: "Tentang" };
            return (
              <button type="button" key={tab} className={activeTab === tab ? "tab-active" : ""} onClick={() => selectTab(tab)}>
                {labels[tab]}
              </button>
            );
          })}
        </nav>

        <section id="workspace" className="workspace">
          {activeTab === "form" && (
            <article className="card page-panel">
              <div className="section-heading">
                <div>
                  <p className="section-eyebrow">PENGAJUAN BARU</p>
                  <h2>Form Layanan Mahasiswa</h2>
                  <p className="section-subtitle">Lengkapi data berikut. Layanan dan kebutuhan di bawah ini sudah dapat digunakan.</p>
                </div>
                <div className="form-badge"><span className="live-dot" /> Terbuka</div>
              </div>

              <div className="selected-service-banner">
                <span className="selected-service-icon"><ServiceIcon type={serviceType} /></span>
                <div><strong>{serviceType}</strong><span>{currentService.description}</span></div>
              </div>

              <form className="form-grid" onSubmit={submitService}>
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
                <div className="field-group">
                  <label htmlFor="nim">NIM <em>*</em></label>
                  <input id="nim" name="nim" type="text" inputMode="numeric" pattern="[0-9]{4,20}" placeholder="Contoh: 2670201001" required onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, ""); }} />
                  <p className="helper">Hanya angka, 4–20 digit.</p>
                </div>
                <div className="field-group">
                  <label htmlFor="studentName">Nama Mahasiswa <em>*</em></label>
                  <input id="studentName" name="studentName" type="text" placeholder="Nama lengkap" required pattern="[A-Za-zÀ-ɏ\s.'-]+" title="Hanya huruf, spasi, titik, koma, petik, atau tanda hubung." />
                  <p className="helper">Hanya huruf (tanpa angka).</p>
                </div>
                <div className="field-group">
                  <label htmlFor="studyProgram">Program Studi <em>*</em></label>
                  <select id="studyProgram" name="studyProgram" defaultValue="" required>
                    <option value="" disabled>-- Pilih Program Studi --</option>
                    <option value="Ilmu Komunikasi">Ilmu Komunikasi</option>
                    <option value="Ilmu Pemerintahan">Ilmu Pemerintahan</option>
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="contact">Email / WhatsApp</label>
                  <input id="contact" name="contact" type="text" placeholder="0812xxxx / email mahasiswa" />
                </div>
                <div className="field-group">
                  <label htmlFor="serviceType">Jenis Layanan <em>*</em></label>
                  <select id="serviceType" name="serviceType" value={serviceType} onChange={(event) => { const t = event.target.value as ServiceType; const nextNeed = needsFor(t, finalTaskType)[0]; setServiceType(t); setSelectedNeed(nextNeed); setAttendanceInfo(null); setBuktiInfo({}); if (isTitleProposalNeed(nextNeed)) selectTab("judul"); }} required>
                    {serviceTypes.map((type) => <option value={type} key={type}>{type}</option>)}
                  </select>
                </div>
                {isAcademicReview && (
                  <div className="field-group field-full ta-switch-box">
                    <span className="ta-switch-label">Jenis Tugas Akhir <em>*</em></span>
                    <div className="ta-switch" role="group" aria-label="Pilih jenis tugas akhir">
                      {FINAL_TASK_TYPES.map((type) => (
                        <button
                          type="button"
                          key={type}
                          className={finalTaskType === type ? "on" : ""}
                          onClick={() => selectFinalTaskType(type)}
                          aria-pressed={finalTaskType === type}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    <p className="helper">Pilih dulu, lalu tentukan kebutuhannya di bawah.</p>
                  </div>
                )}
                <div className="field-group">
                  <label htmlFor="serviceNeed">Kebutuhan Layanan <em>*</em></label>
                  <select id="serviceNeed" name="serviceNeed" value={selectedNeed} required onChange={(e) => selectNeed(e.target.value)}>
                    {currentNeeds.map((need) => <option value={need} key={need}>{need}</option>)}
                  </select>
                </div>
                {isProposalNeed ? (
                  <div className="field-group field-full tp-redirect">
                    <p>Pengajuan judul memakai template tersendiri.</p>
                    <button type="button" className="button button-primary" onClick={() => selectTab("judul")}>
                      Buka Template Pengajuan Judul <span>→</span>
                    </button>
                  </div>
                ) : (
                <>
                <div className="field-group field-full">
                  <label htmlFor="title">
                    {isAcademicReview || isBuktiEmpatBagian ? "Judul Skripsi / Jurnal" : "Ringkasan Kebutuhan"} <em>*</em>
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    placeholder={
                      isAcademicReview
                        ? "Masukkan judul lengkap"
                        : isBuktiEmpatBagian
                          ? "Tuliskan judul skripsi/jurnal yang diserahkan"
                          : "Tuliskan inti kebutuhan layanan Anda"
                    }
                    required
                  />
                </div>
                {showPaymentNotice && (
                  <div className="field-group field-full requirements-box">
                    <div className="requirements-title"><span>!</span> Persyaratan Pengajuan</div>
                    <ul className="requirements-list"><li>Mohon pastikan Anda sudah melakukan pembayaran untuk semester berjalan yang sedang ditempuh.</li></ul>
                  </div>
                )}
                {(currentService.requirements && currentService.requirements.length > 0) && (
                  <div className="field-group field-full requirements-box">
                    <div className="requirements-title"><span>!</span> Persyaratan Upload</div>
                    <ul className="requirements-list">{currentService.requirements.map((req, idx) => <li key={idx}>{req}</li>)}</ul>
                  </div>
                )}
                {currentService.needRequirements?.[selectedNeed] && !isBuktiEmpatBagian && (
                  <div className="field-group field-full requirements-box">
                    <div className="requirements-title"><span>!</span> Persyaratan Upload</div>
                    <ul className="requirements-list">{currentService.needRequirements[selectedNeed].map((req, idx) => <li key={idx}>{req}</li>)}</ul>
                  </div>
                )}
                {isSuratLainnya && (
                  <div className={`field-group field-full drive-upload-box ${suratLainnyaDriveUrl ? "" : "drive-upload-box-unconfigured"}`}>
                    <div className="drive-upload-copy">
                      <strong>Upload dokumen Kebutuhan Lainnya melalui Google Drive</strong>
                      <span>
                        {suratLainnyaDriveUrl
                          ? "Folder Google Drive telah disiapkan. Unggah template/dokumen Anda di sana, lalu kembali ke form ini untuk mengirim pengajuan."
                          : "Tautan folder Google Drive belum diatur. Tambahkan NEXT_PUBLIC_SURAT_LAINNYA_DRIVE_URL pada environment hosting (mis. Vercel)."}
                      </span>
                    </div>
                    <button type="button" className="drive-upload-button" onClick={openSuratLainnyaDrive} disabled={!suratLainnyaDriveUrl}>
                      Buka Google Drive <span>↗</span>
                    </button>
                  </div>
                )}
                {serviceType === "Layanan Perpustakaan" && selectedNeed === "Absensi Perpustakaan" && (
                  <div className="field-group field-full attendance-box">
                    <div className="attendance-header"><span>📍</span> Absensi Perpustakaan (otomatis)</div>
                    <p className="attendance-desc">Sistem akan otomatis mendeteksi hari, tanggal, dan jam saat NIM dimasukkan. Nomor kunjungan dihitung otomatis berdasarkan riwayat NIM tersebut. Admin tetap dapat mengubah data jika diperlukan.</p>
                    <div className="attendance-auto">
                      <div><strong>Hari & Tanggal:</strong> <span>{attendanceInfo ? new Date(attendanceInfo.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Menunggu NIM..."}</span></div>
                      <div><strong>Jam:</strong> <span>{attendanceInfo ? attendanceInfo.time : "-"}</span></div>
                      <div><strong>Kunjungan ke-:</strong> <span>{attendanceInfo ? attendanceInfo.nextVisit : "-"}</span></div>
                    </div>
                    <input type="hidden" name="absensiAuto" value="1" />
                  </div>
                )}
                {isAcademicReview ? (
                  <div className="field-group field-full">
                    <LecturerPicker
                      label="Dosen Tujuan"
                      lecturers={lecturers}
                      value={selectedLecturerId}
                      onChange={setSelectedLecturerId}
                      name="lecturerId"
                      required
                      placeholder={lecturers.length ? "Ketik nama dosen, daftar langsung tersaring" : "Memuat daftar dosen…"}
                      helper={`${lecturers.length} dosen aktif, urut A–Z tanpa gelar.`}
                    />
                    {lecturerError && <p className="helper helper-error">{lecturerError}</p>}
                  </div>
                ) : (
                  <div className="context-note field-full"><span>i</span><p>Pengajuan akan diteruskan ke admin unit <strong>{serviceCatalog[serviceType].short}</strong> untuk ditindaklanjuti.</p></div>
                )}
                <div className="field-group field-full">
                  <label htmlFor="studentNote">Catatan Mahasiswa</label>
                  <textarea id="studentNote" name="studentNote" placeholder="Contoh: Mohon dibantu untuk pengecekan data atau BAB I sampai BAB V." />
                </div>
                {isBuktiEmpatBagian ? (
                  <div className="field-group field-full bukti-box">
                    <p className="bukti-intro">Upload dibagi menjadi 4 bagian agar dokumen lebih rapi dan mudah diperiksa.</p>
                    <div className="bukti-syarat">
                      <b>Persyaratan Upload</b>
                      <ol>
                        {BUKTI_PARTS.map((part) => <li key={part.id}>{part.requirement}</li>)}
                      </ol>
                    </div>
                    {BUKTI_PARTS.map((part) => (
                      <div className="bukti-slot" key={part.id}>
                        <label htmlFor={part.field}>{part.label} <em>*</em></label>
                        <div className="file-input-wrap">
                          <input
                            id={part.field}
                            name={part.field}
                            type="file"
                            accept={buktiAccept(part.format)}
                            required
                            onChange={(event) => {
                              const chosen = event.target.files && event.target.files[0];
                              setBuktiInfo((current) => ({
                                ...current,
                                [part.id]: chosen
                                  ? `${chosen.name} · ${(chosen.size / 1024 / 1024).toFixed(2).replace(".", ",")} MB`
                                  : "",
                              }));
                            }}
                          />
                        </div>
                        {buktiInfo[part.id] && <span className="file-chosen">📄 {buktiInfo[part.id]}</span>}
                        <p className="helper">{part.helper} Maksimal 10 MB.</p>
                      </div>
                    ))}
                    <p className="bukti-tutup">
                      Keempat berkas dikirim dalam satu tiket dan langsung diterima Admin Perpustakaan dalam keadaan
                      terpisah, jadi tidak perlu digabung sendiri.
                    </p>
                  </div>
                ) : (
                  <div className="field-group field-full upload-box">
                    <label htmlFor="file">Lampiran {requiresFile && <em>*</em>}</label>
                    <div className="file-input-wrap"><input id="file" name="file" type="file" accept={uploadMode === "required-pdf" ? ".pdf,application/pdf" : uploadMode === "required-docx" ? ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" : ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"} required={requiresFile} onChange={(event) => { const f = event.target.files && event.target.files[0]; setFileInfo(f ? `${f.name} · ${(f.size / 1024 / 1024).toFixed(2).replace(".", ",")} MB` : ""); }} /></div>
                    {fileInfo && <span className="file-chosen">📄 {fileInfo}</span>}
                    <p className="helper">{uploadMode === "required-pdf" ? "Wajib satu file PDF maksimal 10 MB." : uploadMode === "required-docx" ? "Wajib file DOCX maksimal 10 MB." : "Lampiran PDF atau DOCX opsional, maksimal 10 MB."}</p>
                  </div>
                )}
                <div className="form-actions field-full">
                  <button type="submit" className="button button-primary" disabled={isSubmitting}>{isSubmitting ? "Mengirim..." : "Kirim Layanan"}<span>→</span></button>
                  <button type="reset" className="button button-light" onClick={() => { setServiceType(serviceTypes[0]); setSelectedNeed(firstFormNeed(serviceTypes[0], finalTaskType)); setAttendanceInfo(null); clearLecturerSearch(); setFileInfo(""); setBuktiInfo({}); setSubmitError(""); setSubmitMessage(null); }}>Reset</button>
                </div>
                </>
                )}
              </form>
              {submitError && <ErrorNotice message={submitError} />}
              {submitMessage && <SuccessNotice>{submitMessage}</SuccessNotice>}
            </article>
          )}

          {activeTab === "judul" && (
            <article className="card page-panel">
              <div className="section-heading">
                <div>
                  <p className="section-eyebrow">PROGRAM STUDI</p>
                  <h2>Template Pengajuan Judul Tugas Akhir</h2>
                  <p className="section-subtitle">Lengkapi data, lampirkan bukti keuangan, usulkan tiga dosen.</p>
                </div>
                <span className="heading-icon">✎</span>
              </div>

              <ol className="tp-steps">
                <li><b>1</b><span>Isi template</span></li>
                <li><b>2</b><span>Verifikasi Prodi</span></li>
                <li><b>3</b><span>Seleksi dosen</span></li>
                <li><b>4</b><span>Keputusan dosen</span></li>
              </ol>

              {proposalCode ? (
                <SuccessNotice>
                  <strong>Terkirim ke Program Studi.</strong>
                  <br />
                  Simpan kode ini:{" "}
                  <strong className="tp-code">{proposalCode}</strong>{" "}
                  <button type="button" className="copy-mini" title="Salin kode pelacakan" onClick={() => doCopy(proposalCode)}>⧉</button>
                  <br />
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => {
                      setStatusTicketVal(proposalCode);
                      selectTab("status");
                    }}
                  >
                    Lacak status →
                  </button>
                  <br />
                  <button type="button" className="text-action" onClick={() => setProposalCode("")}>
                    Ajukan judul lain →
                  </button>
                </SuccessNotice>
              ) : (
                <TitleProposalForm
                  lecturers={lecturers}
                  lecturerError={lecturerError}
                  finalTaskType={finalTaskType}
                  onFinalTaskTypeChange={setFinalTaskType}
                  onSubmitted={(code) => {
                    setProposalCode(code);
                    window.setTimeout(() => {
                      document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 20);
                  }}
                />
              )}
            </article>
          )}

          {activeTab === "status" && (
            <article className="card page-panel">
              <div className="section-heading"><div><p className="section-eyebrow">PEMANTAUAN</p><h2>Cek Status Layanan</h2><p className="section-subtitle">Cukup masukkan nomor tiket untuk melihat detail serta perkembangan layanan.</p></div><span className="heading-icon">⌕</span></div>
              <form className="form-grid status-form" onSubmit={checkStatus}>
                <div className="field-group field-full"><label htmlFor="statusTicket">Nomor Tiket <em>*</em></label><input id="statusTicket" name="ticket" type="text" placeholder="SIPALING-TA-2670201001-01234 atau SIPALING-PRODI-JUDUL-XXXXX-XXXXX" required value={statusTicketVal} onChange={(event) => setStatusTicketVal(event.target.value)} /><p className="helper">Berlaku untuk nomor tiket layanan maupun kode pengajuan judul.</p></div>
                <div className="form-actions field-full"><button type="submit" className="button button-primary" disabled={isChecking}>{isChecking ? "Mencari..." : "Cek Status"}<span>→</span></button></div>
              </form>
              {statusError && <ErrorNotice message={statusError} />}
              {statusMessage && !statusError && <div className="notice notice-info">{statusMessage}</div>}
              {proposalData && <ProposalReport proposal={proposalData} onCopy={doCopy} />}
              {statusData && (
                <div className="report-box">
                  <div className="report-header"><div><p className="section-eyebrow">RINGKASAN PENGAJUAN</p><h3>{statusData.serviceNeed}</h3><span>{statusData.ticket} <button type="button" className="copy-mini" title="Salin nomor tiket" onClick={() => doCopy(statusData.ticket)}>⧉</button></span></div><StatusPill status={statusData.status} /></div>
                  <StatusTimeline status={statusData.status} />
                  <div className="report-grid">
                    <div><small>Nama Mahasiswa</small><strong>{statusData.studentName}</strong></div>
                    <div><small>NIM</small><strong>{statusData.nim}</strong></div>
                    <div><small>Program Studi</small><strong>{statusData.studyProgram}</strong></div>
                    <div><small>Unit Layanan</small><strong>{statusData.serviceType.replace("Layanan ", "")}</strong></div>
                    <div className="report-wide"><small>Judul / Ringkasan</small><strong>{statusData.title}</strong></div>
                    <div><small>Dosen Tujuan</small><strong>{statusData.lecturer?.name || "Admin unit layanan"}</strong></div>
                    <div><small>Status Administratif</small><strong>{statusData.administrativeStatus}</strong></div>
                    <div><small>Revisi Ke</small><strong>{statusData.revisionCount}</strong></div>
                    <div><small>Pengajuan</small><strong>{formatDate(statusData.createdAt)}</strong></div>
                  </div>
                  {statusData.attachments && statusData.attachments.length > 0 && (
                    <div className="report-files">
                      <small>Berkas yang diterima</small>
                      <ul>
                        {statusData.attachments.map((item) => (
                          <li key={item.part}>
                            <b>{item.label}</b>
                            <span>{item.fileName} · {(item.fileSize / 1024 / 1024).toFixed(2).replace(".", ",")} MB</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="report-notes"><div><small>Catatan Dosen</small><p>{statusData.lecturerNote || "Belum ada catatan dosen."}</p></div><div><small>Catatan Admin</small><p>{statusData.adminNote || "Belum ada catatan admin."}</p></div></div>
                  {statusData.status === "Revisi" && <button type="button" className="text-action" onClick={() => selectTab("revisi")}>Status revisi: unggah berkas terbaru →</button>}
                </div>
              )}
            </article>
          )}

          {activeTab === "revisi" && (
            <article className="card page-panel">
              <div className="section-heading"><div><p className="section-eyebrow">PEMBARUAN BERKAS</p><h2>Upload Revisi Skripsi</h2><p className="section-subtitle">Upload revisi hanya dapat dilakukan ketika status layanan adalah <strong>Revisi</strong>.</p></div></div>
              <form className="form-grid" onSubmit={submitRevision}>
                <div className="field-group"><label htmlFor="revisionTicket">Nomor Tiket <em>*</em></label><input id="revisionTicket" name="ticket" type="text" placeholder="Masukkan nomor tiket" required /></div>
                <div className="field-group"><label htmlFor="revisionNim">NIM <em>*</em></label><input id="revisionNim" name="nim" type="text" inputMode="numeric" placeholder="Nomor induk mahasiswa" required /></div>
                <div className="field-group field-full"><label htmlFor="revisionNote">Catatan Revisi Mahasiswa</label><textarea id="revisionNote" name="note" placeholder="Contoh: Revisi BAB II sudah diperbaiki sesuai arahan dosen." /></div>
                <div className="field-group field-full upload-box"><label htmlFor="revisionFile">Upload File Revisi .DOCX <em>*</em></label><div className="file-input-wrap"><input id="revisionFile" name="file" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required onChange={(event) => { const f = event.target.files && event.target.files[0]; setRevFileInfo(f ? `${f.name} · ${(f.size / 1024 / 1024).toFixed(2).replace(".", ",")} MB` : ""); }} /></div>{revFileInfo && <span className="file-chosen">📄 {revFileInfo}</span>}<p className="helper">File wajib .DOCX, maksimal 10 MB.</p></div>
                <div className="form-actions field-full"><button type="submit" className="button button-primary" disabled={isUploadingRevision}>{isUploadingRevision ? "Mengunggah..." : "Kirim Revisi"}<span>→</span></button></div>
              </form>
              {revisionError && <ErrorNotice message={revisionError} />}
              {revisionMessage && <SuccessNotice>{revisionMessage}</SuccessNotice>}
            </article>
          )}

          {activeTab === "about" && (
            <article className="card page-panel about-panel"><p className="section-eyebrow">TENTANG PLATFORM</p><h2>SiPaling FISIP</h2><p><strong>SiPaling FISIP</strong> adalah Sistem Pelayanan Akademik Lingkungan FISIP. Portal ini dirancang untuk membuat pengajuan mahasiswa lebih rapi, transparan, dan mudah dipantau.</p><div className="about-columns"><div><span className="about-icon">01</span><h3>Untuk mahasiswa</h3><p>Kirim pengajuan ke Dosen yang sesuai di SIMAK, simpan <span className="highlight-navy">nomor tiket</span>, dan pantau status secara mandiri.</p></div><div><span className="about-icon">02</span><h3>Untuk dosen</h3><p>Terima berkas skripsi atau jurnal sesuai dosen tujuan dan berikan catatan tindak lanjut.</p></div><div><span className="about-icon">03</span><h3>Untuk admin</h3><p>Kelola seluruh layanan, status administratif, catatan, dan lampiran dalam satu dashboard.</p></div></div></article>
          )}
        </section>
      </main>
      {copiedNote && <div className="copy-toast">{copiedNote}</div>}
      <footer className="footer"><strong>SiPaling FISIP</strong><span>Sistem Pelayanan Akademik Lingkungan FISIP · Concept Superfal Dev · © {new Date().getFullYear()}</span><a href="/dashboard">{sessionRole ? `Dashboard ${DASH_ROLE_LABEL[sessionRole] || "Admin"} (sudah login) →` : "Dashboard Dosen/Admin →"}</a></footer>
    </div>
  );
}
