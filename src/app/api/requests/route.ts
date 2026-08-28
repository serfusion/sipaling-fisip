import { db } from "@/db";
import { lecturers, libraryAttendance, requestAttachments, serviceRequests } from "@/db/schema";
import { and, desc, eq, gte, ilike, lt, sql } from "drizzle-orm";
import {
  MAX_DOCUMENT_BYTES,
  removeDocument,
  uploadDocument,
} from "@/lib/document-storage";
import {
  BUKTI_PARTS,
  BUKTI_PART_UTAMA,
  buktiMime,
  isBuktiPenyerahan,
  periksaBuktiFile,
  type BuktiPart,
} from "@/lib/bukti-penyerahan";
import { getCurrentProfile, serviceTypeForProfile } from "@/lib/supabase-server";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { blockedByMaintenance } from "@/lib/maintenance-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

// "Layanan Skripsi / Jurnal" adalah nama lama yang kini menjadi
// "Layanan Tugas Akhir". Nama lama tetap diterima agar tiket dan tautan
// yang sudah tersebar sebelum pembaruan tidak menjadi tidak valid.
const TUGAS_AKHIR_NEEDS = [
  "Pengajuan Judul Skripsi",
  "Pengajuan Judul Jurnal",
  "Upload Skripsi Full Draft",
  "Upload Revisi Skripsi",
  "Upload Artikel Jurnal",
  "Upload Revisi Artikel Jurnal",
];

const serviceCatalog: Record<string, string[]> = {
  "Layanan Tugas Akhir": TUGAS_AKHIR_NEEDS,
  "Layanan Skripsi / Jurnal": TUGAS_AKHIR_NEEDS,
  "Layanan PDDIKTI": [
    "Perbaikan NIM",
    "Perbaikan Nama Lengkap",
    "Perbaikan Aktivitas Status Mahasiswa",
    "Perbaikan Data lainnya",
  ],
  "Layanan Akademik": [
    "Perbaikan Nilai",
    "Transkrip Nilai",
    "Perbaikan Data Akademik",
    "Konsultasi Akademik",
  ],
  "Layanan Prodi": [
    "Konsultasi Program Studi",
    "Pengajuan Judul Tugas Akhir",
    "Pengajuan Judul Skripsi",
    "Pengajuan Dosen Pembimbing",
    "Pengajuan Seminar Proposal",
    "Pengajuan Sidang Skripsi",
  ],
  "Layanan Umum": [
    "Surat Pengantar",
    "Pengajuan Magang",
    "Surat Keterangan Aktif Kuliah",
    "Surat Lainnya",
  ],
  "Layanan Perpustakaan": [
    "Absensi Perpustakaan",
    "Request Bebas Pustaka",
    "Permintaan Cek Repository",
    "Upload Bukti Penyerahan Jurnal/Skripsi",
  ],
  "Layanan Laboratorium": [
    "Peminjaman Ruang Laboratorium",
    "Peminjaman Alat Laboratorium",
    "Pengajuan Jadwal Praktikum",
    "Konsultasi Laboratorium",
  ],
};

function textValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function makeTicket(serviceType: string, nim: string) {
  const codes: Record<string, string> = {
    "Layanan Tugas Akhir": "TA",
    "Layanan Skripsi / Jurnal": "SKRIPSI",
    "Layanan PDDIKTI": "PDDIKTI",
    "Layanan Akademik": "AKADEMIK",
    "Layanan Prodi": "PRODI",
    "Layanan Umum": "UMUM",
    "Layanan Perpustakaan": "PERPUS",
    "Layanan Laboratorium": "LAB",
  };
  const code = codes[serviceType] || "LAYANAN";
  const suffix = String(Math.floor(10000 + Math.random() * 90000));
  return `SIPALING-${code}-${nim}-${suffix}`;
}

export async function POST(request: Request) {
  const limit = rateLimit({ request, name: "request-submit", limit: 8, windowMs: 10 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  // Selama mode maintenance menyala, kiriman dari pengunjung umum ditolak
  // supaya halaman lama yang masih terbuka di tab mahasiswa tidak dapat
  // menyelinap mengirim data. Dosen/admin yang login tetap dilayani.
  const closed = await blockedByMaintenance();
  if (closed) return closed;
  try {
    const form = await request.formData();
    const nim = textValue(form, "nim");
    const studentName = textValue(form, "studentName");
    const studyProgram = textValue(form, "studyProgram");
    const contact = textValue(form, "contact");
    const serviceType = textValue(form, "serviceType");
    const serviceNeed = textValue(form, "serviceNeed");
    const title = textValue(form, "title");
    const studentNote = textValue(form, "studentNote");
    const lecturerIdValue = textValue(form, "lecturerId");

    // Honeypot anti-bot: field tersembunyi ini kosong pada pengisian manusia.
    if (textValue(form, "website")) {
      return Response.json({ success: true, ticket: makeTicket(serviceType || "Layanan Umum", "0000") }, { status: 201 });
    }

    if (!/^\d{4,20}$/.test(nim)) {
      return Response.json({ success: false, message: "NIM harus berupa angka 4 sampai 20 digit." }, { status: 400 });
    }
    if (!studentName || !studyProgram || !serviceType || !serviceNeed || !title) {
      return Response.json({ success: false, message: "Mohon lengkapi semua field yang bertanda wajib." }, { status: 400 });
    }
    if (!serviceCatalog[serviceType] || !serviceCatalog[serviceType].includes(serviceNeed)) {
      return Response.json({ success: false, message: "Pilihan layanan tidak valid." }, { status: 400 });
    }

    const isTugasAkhir =
      serviceType === "Layanan Tugas Akhir" || serviceType === "Layanan Skripsi / Jurnal";
    // Pengajuan judul memakai template khusus di /api/title-proposals,
    // bukan formulir layanan biasa.
    if (serviceNeed.startsWith("Pengajuan Judul")) {
      return Response.json(
        {
          success: false,
          message: 'Pengajuan judul dikirim melalui Template Pengajuan Judul pada tab "Pengajuan Judul".',
        },
        { status: 400 },
      );
    }

    let lecturerId: number | null = null;
    if (isTugasAkhir) {
      lecturerId = Number(lecturerIdValue);
      if (!Number.isInteger(lecturerId) || lecturerId < 1) {
        return Response.json({ success: false, message: "Silakan pilih dosen tujuan." }, { status: 400 });
      }
      const lecturer = await db.select({ id: lecturers.id }).from(lecturers).where(eq(lecturers.id, lecturerId)).limit(1);
      if (!lecturer.length) {
        return Response.json({ success: false, message: "Dosen tujuan tidak ditemukan." }, { status: 400 });
      }
    }

    // Bukti penyerahan jurnal/skripsi memakai jalurnya sendiri: empat berkas
    // terpisah, bukan satu lampiran gabungan.
    const multiPart = isBuktiPenyerahan(serviceType, serviceNeed);
    const buktiFiles: Array<{ part: BuktiPart; file: File }> = [];
    if (multiPart) {
      for (const part of BUKTI_PARTS) {
        const entry = form.get(part.field);
        const candidate = entry instanceof File && entry.name ? entry : null;
        const check = periksaBuktiFile(part, candidate);
        if (!check.ok) {
          return Response.json({ success: false, message: check.pesan }, { status: 400 });
        }
        buktiFiles.push({ part, file: candidate as File });
      }
    }

    const fileEntry = form.get("file");
    const file = fileEntry instanceof File && fileEntry.name ? fileEntry : null;
    const requiresDocx = isTugasAkhir;
    const requiresPdf = serviceType === "Layanan PDDIKTI";
    if (!multiPart && (requiresDocx || requiresPdf) && !file) {
      return Response.json(
        { success: false, message: requiresPdf ? "Satu file PDF wajib dilampirkan untuk layanan ini." : "File DOCX wajib dilampirkan untuk Layanan Tugas Akhir." },
        { status: 400 },
      );
    }
    if (file && !multiPart) {
      const name = file.name.toLowerCase();
      const okExt = requiresPdf
        ? name.endsWith(".pdf")
        : requiresDocx
          ? name.endsWith(".docx")
          : name.endsWith(".pdf") || name.endsWith(".docx");
      if (!okExt || file.size > MAX_DOCUMENT_BYTES) {
        return Response.json(
          {
            success: false,
            message: requiresPdf
              ? "Lampiran harus PDF dan maksimal 10 MB."
              : requiresDocx
                ? "Lampiran harus DOCX dan maksimal 10 MB."
                : "Lampiran opsional harus PDF atau DOCX maksimal 10 MB.",
          },
          { status: 400 },
        );
      }
    }

    const ticket = makeTicket(serviceType, nim);

    // Setiap berkas yang berhasil naik dicatat di sini. Bila langkah
    // berikutnya gagal, semuanya dihapus kembali supaya tidak ada berkas
    // yatim yang memakan kuota penyimpanan.
    const uploadedPaths: string[] = [];
    let fileName: string | null = null;
    let fileMime: string | null = null;
    let fileSize: number | null = null;
    let fileStoragePath: string | null = null;
    const attachmentRows: Array<{
      part: string;
      label: string;
      sortOrder: number;
      fileName: string;
      fileMime: string;
      fileSize: number;
      fileStoragePath: string;
    }> = [];

    try {
      if (multiPart) {
        for (let index = 0; index < buktiFiles.length; index++) {
          const { part, file: partFile } = buktiFiles[index];
          const mime = buktiMime(partFile.name, partFile.type);
          let path: string;
          try {
            path = await uploadDocument({ folder: "requests", ticket, file: partFile, contentType: mime });
          } catch (reason) {
            // Nama bagiannya ikut disebut, supaya mahasiswa tahu berkas mana
            // dari keempatnya yang harus diperbaiki.
            throw new Error(`${part.label}: ${(reason as Error).message}`);
          }
          uploadedPaths.push(path);
          attachmentRows.push({
            part: part.id,
            label: part.label,
            sortOrder: index,
            fileName: partFile.name,
            fileMime: mime,
            fileSize: partFile.size,
            fileStoragePath: path,
          });
          // Skripsi full sekaligus menjadi lampiran utama tiket, sehingga
          // tombol unduh yang sudah ada tetap menunjuk berkas yang benar.
          if (part.id === BUKTI_PART_UTAMA) {
            fileName = partFile.name;
            fileMime = mime;
            fileSize = partFile.size;
            fileStoragePath = path;
          }
        }
      } else if (file) {
        fileName = file.name;
        fileMime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? PDF_MIME : DOCX_MIME);
        fileSize = file.size;
        fileStoragePath = await uploadDocument({ folder: "requests", ticket, file, contentType: fileMime });
        uploadedPaths.push(fileStoragePath);
      }
    } catch (error) {
      await Promise.all(uploadedPaths.map((path) => removeDocument(path).catch(() => undefined)));
      throw error;
    }

    let finalTicket = ticket;
    let requestId: number | null = null;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const inserted = await db
            .insert(serviceRequests)
            .values({
              ticket: finalTicket,
              nim,
              studentName,
              studyProgram,
              contact: contact || null,
              serviceType,
              serviceNeed,
              title,
              lecturerId,
              studentNote: studentNote || null,
              fileName,
              fileMime,
              fileSize,
              fileStoragePath,
              fileData: null,
            })
            .returning({ id: serviceRequests.id });
          requestId = inserted[0]?.id ?? null;
          break;
        } catch (error) {
          const code = (error as { code?: string }).code;
          const duplicate = code === "23505" || String((error as Error).message || "").includes("duplicate key");
          if (duplicate && attempt < 2) {
            // Nomor tiket kebetulan tabrakan; buat nomor baru lalu coba lagi.
            finalTicket = makeTicket(serviceType, nim);
            continue;
          }
          throw error;
        }
      }

      // Empat lampiran bernama disimpan setelah tiketnya ada. Bila langkah
      // ini gagal, tiket yang baru saja dibuat ikut dihapus supaya tidak
      // tersisa pengajuan yang berkasnya tidak lengkap.
      const savedId = requestId;
      if (attachmentRows.length && savedId) {
        try {
          await db.insert(requestAttachments).values(
            attachmentRows.map((row) => ({ ...row, requestId: savedId })),
          );
        } catch (error) {
          await db.delete(serviceRequests).where(eq(serviceRequests.id, savedId));
          throw error;
        }
      }
    } catch (error) {
      await Promise.all(uploadedPaths.map((path) => removeDocument(path).catch(() => undefined)));
      throw error;
    }

    // Catat kunjungan perpustakaan otomatis agar penghitung "Kunjungan ke-" berjalan.
    if (serviceType === "Layanan Perpustakaan" && serviceNeed === "Absensi Perpustakaan") {
      try {
        const countRows = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(libraryAttendance)
          .where(eq(libraryAttendance.nim, nim));
        await db.insert(libraryAttendance).values({
          nim,
          studentName,
          visitNumber: (countRows[0]?.count ?? 0) + 1,
          note: studentNote || null,
          requestId,
        });
      } catch (error) {
        console.error("auto attendance", error); // tidak menggagalkan pengajuan
      }
    }

    return Response.json({ success: true, ticket: finalTicket }, { status: 201 });
  } catch (error: unknown) {
    console.error("submit service request", error);
    const message = explainServerError(error, "Pengajuan belum tersimpan. Silakan coba lagi.");
    return Response.json({ success: false, message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return Response.json({ success: false, message: "Silakan login untuk melihat data pengajuan." }, { status: 401 });
    }
    const params = new URL(request.url).searchParams;
    const query = params.get("q")?.trim() || "";
    const yearParam = Number(params.get("year") || "");
    const monthParam = Number(params.get("month") || "");
    const hasYear = Number.isInteger(yearParam) && yearParam >= 2020 && yearParam <= 2100;
    const hasMonth = hasYear && Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12;
    let periodFilter;
    if (hasMonth) {
      const start = new Date(Date.UTC(yearParam, monthParam - 1, 1) - 7 * 3600_000); // WIB
      const end = new Date(Date.UTC(yearParam, monthParam, 1) - 7 * 3600_000);
      periodFilter = and(gte(serviceRequests.createdAt, start), lt(serviceRequests.createdAt, end));
    } else if (hasYear) {
      const start = new Date(Date.UTC(yearParam, 0, 1) - 7 * 3600_000);
      const end = new Date(Date.UTC(yearParam + 1, 0, 1) - 7 * 3600_000);
      periodFilter = and(gte(serviceRequests.createdAt, start), lt(serviceRequests.createdAt, end));
    }
    if (profile.role === "dosen" && profile.lecturerId === null) {
      return Response.json({ success: true, requests: [] });
    }
    const unitServiceType = serviceTypeForProfile(profile);
    const accessFilter = profile.role === "dosen"
      ? eq(serviceRequests.lecturerId, profile.lecturerId as number)
      : unitServiceType
        ? eq(serviceRequests.serviceType, unitServiceType)
        : undefined;
    const rows = await db
      .select({
        id: serviceRequests.id,
        ticket: serviceRequests.ticket,
        nim: serviceRequests.nim,
        studentName: serviceRequests.studentName,
        studyProgram: serviceRequests.studyProgram,
        contact: serviceRequests.contact,
        serviceType: serviceRequests.serviceType,
        serviceNeed: serviceRequests.serviceNeed,
        title: serviceRequests.title,
        status: serviceRequests.status,
        administrativeStatus: serviceRequests.administrativeStatus,
        lecturerNote: serviceRequests.lecturerNote,
        adminNote: serviceRequests.adminNote,
        revisionCount: serviceRequests.revisionCount,
        fileName: serviceRequests.fileName,
        lecturerId: serviceRequests.lecturerId,
        createdAt: serviceRequests.createdAt,
        updatedAt: serviceRequests.updatedAt,
        lecturerName: lecturers.name,
      })
      .from(serviceRequests)
      .leftJoin(lecturers, eq(serviceRequests.lecturerId, lecturers.id))
      .where(and(query ? ilike(serviceRequests.ticket, `%${query}%`) : undefined, accessFilter, periodFilter))
      .orderBy(desc(serviceRequests.createdAt))
      .limit(hasYear ? 2000 : 200);

    return Response.json({ success: true, requests: rows });
  } catch (error: unknown) {
    console.error("list service requests", error);
    const message = explainServerError(error, "Data pengajuan belum dapat dimuat.");
    return Response.json({ success: false, message }, { status: 500 });
  }
}
