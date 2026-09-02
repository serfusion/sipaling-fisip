import { db } from "@/db";
import { requestAttachments, revisionUploads, serviceRequests } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import {
  MAX_DOCUMENT_BYTES,
  removeDocument,
  uploadDocument,
} from "@/lib/document-storage";
import {
  BAGIAN_PENYERAHAN,
  isPenyerahanPerpus,
  periksaBerkasBagian,
} from "@/lib/bukti-penyerahan";
import { audienceForServiceType, pushNotification } from "@/lib/notify";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { blockedByMaintenance } from "@/lib/maintenance-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

function textValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Bentuk formulir revisi untuk satu tiket.
 *
 * Dibaca halaman "Upload Revisi" sebelum kotak unggahnya digambar, karena
 * revisi penyerahan skripsi ke perpustakaan bukan satu berkas .docx melainkan
 * empat bagian PDF yang sama persis dengan pengajuan awalnya. Tanpa ini
 * halaman harus menebak dari bentuk nomor tiket, dan tiket perpustakaan
 * dipakai bersama absensi, bebas pustaka, dan cek repository.
 *
 * NIM tetap wajib supaya nomor tiket orang lain tidak dapat ditelusuri
 * bentuk layanannya hanya dengan menebak nomornya.
 */
export async function GET(request: Request) {
  const limit = rateLimit({ request, name: "revision-form", limit: 30, windowMs: 5 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);
  try {
    const params = new URL(request.url).searchParams;
    const ticket = (params.get("ticket") || "").trim();
    const nim = (params.get("nim") || "").trim();
    if (!ticket || !nim) {
      return Response.json({ success: false, message: "Nomor tiket dan NIM wajib diisi." }, { status: 400 });
    }

    const rows = await db
      .select({
        serviceType: serviceRequests.serviceType,
        serviceNeed: serviceRequests.serviceNeed,
        status: serviceRequests.status,
        revisionCount: serviceRequests.revisionCount,
      })
      .from(serviceRequests)
      .where(and(eq(serviceRequests.ticket, ticket), eq(serviceRequests.nim, nim)))
      .limit(1);
    const service = rows[0];
    if (!service) {
      return Response.json({ success: false, message: "Tiket dan NIM tidak ditemukan." }, { status: 404 });
    }

    return Response.json({
      success: true,
      form: {
        mode: isPenyerahanPerpus(service.serviceType, service.serviceNeed) ? "penyerahan" : "docx",
        serviceType: service.serviceType,
        serviceNeed: service.serviceNeed,
        status: service.status,
        revisionCount: service.revisionCount,
      },
    });
  } catch (error: unknown) {
    console.error("read revision form", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Bentuk formulir revisi belum dapat dibaca.") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const limit = rateLimit({ request, name: "revision-upload", limit: 8, windowMs: 10 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  // Selama mode maintenance menyala, kiriman dari pengunjung umum ditolak
  // supaya halaman lama yang masih terbuka di tab mahasiswa tidak dapat
  // menyelinap mengirim data. Dosen/admin yang login tetap dilayani.
  const closed = await blockedByMaintenance();
  if (closed) return closed;
  try {
    const form = await request.formData();
    const ticket = textValue(form, "ticket");
    const nim = textValue(form, "nim");
    const note = textValue(form, "note");
    const fileEntry = form.get("file");
    const file = fileEntry instanceof File && fileEntry.name ? fileEntry : null;

    if (!ticket || !nim) {
      return Response.json({ success: false, message: "Nomor tiket dan NIM wajib diisi." }, { status: 400 });
    }

    const rows = await db
      .select({
        id: serviceRequests.id,
        studentName: serviceRequests.studentName,
        serviceType: serviceRequests.serviceType,
        serviceNeed: serviceRequests.serviceNeed,
        lecturerId: serviceRequests.lecturerId,
        status: serviceRequests.status,
        revisionCount: serviceRequests.revisionCount,
        fileName: serviceRequests.fileName,
        fileMime: serviceRequests.fileMime,
        fileSize: serviceRequests.fileSize,
        fileStoragePath: serviceRequests.fileStoragePath,
        fileData: serviceRequests.fileData,
      })
      .from(serviceRequests)
      .where(and(eq(serviceRequests.ticket, ticket), eq(serviceRequests.nim, nim)))
      .limit(1);
    const service = rows[0];

    if (!service) {
      return Response.json({ success: false, message: "Tiket dan NIM tidak ditemukan." }, { status: 404 });
    }
    if (service.status !== "Revisi") {
      return Response.json({ success: false, message: `Upload revisi hanya tersedia saat status Revisi. Status saat ini: ${service.status}.` }, { status: 409 });
    }

    const revisionNumber = (service.revisionCount || 0) + 1;

    // Penyerahan skripsi/jurnal ke perpustakaan tidak pernah berupa satu
    // berkas Word: pengajuannya empat bagian PDF, jadi revisinya juga empat
    // bagian PDF yang MENGGANTIKAN berkas sebelumnya pada nomor tiket yang
    // sama. Aturan ukurannya sama persis dengan pengajuan awal karena
    // keduanya memanggil pemeriksa yang sama.
    if (isPenyerahanPerpus(service.serviceType, service.serviceNeed)) {
      return gantiBerkasPenyerahan({ form, service, ticket, nim, note, revisionNumber });
    }

    if (!file) {
      return Response.json({ success: false, message: "File revisi wajib diunggah." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".docx") || file.size > MAX_DOCUMENT_BYTES) {
      return Response.json({ success: false, message: "File revisi harus .DOCX dan berukuran maksimal 10 MB." }, { status: 400 });
    }

    const fileMime = file.type || DOCX_MIME;
    const fileStoragePath = await uploadDocument({
      folder: "revisions",
      ticket,
      file,
      contentType: fileMime,
    });

    try {
      await db.transaction(async (tx) => {
        // Simpan berkas pengajuan awal sebagai revisi ke-0 sebelum pointer
        // berkas utama diarahkan ke revisi terbaru.
        if (
          revisionNumber === 1 &&
          service.fileName &&
          service.fileMime &&
          service.fileSize &&
          (service.fileStoragePath || service.fileData)
        ) {
          await tx.insert(revisionUploads).values({
            requestId: service.id,
            nim,
            revisionNumber: 0,
            note: "Berkas pengajuan awal",
            fileName: service.fileName,
            fileMime: service.fileMime,
            fileSize: service.fileSize,
            fileStoragePath: service.fileStoragePath,
            fileData: service.fileData,
          });
        }

        await tx.insert(revisionUploads).values({
          requestId: service.id,
          nim,
          revisionNumber,
          note: note || null,
          fileName: file.name,
          fileMime,
          fileSize: file.size,
          fileStoragePath,
          fileData: null,
        });
        await tx
          .update(serviceRequests)
          .set({
            revisionCount: revisionNumber,
            fileName: file.name,
            fileMime,
            fileSize: file.size,
            fileStoragePath,
            fileData: null,
            studentNote: note || null,
            status: "Masuk",
            administrativeStatus: "Belum Dicek",
            updatedAt: new Date(),
          })
          .where(eq(serviceRequests.id, service.id));
      });
    } catch (error) {
      await removeDocument(fileStoragePath);
      throw error;
    }

    await kabarkanRevisi({ service, ticket, nim, revisionNumber, jumlahBerkas: 1 });

    return Response.json({ success: true, message: "Revisi berhasil dikirim.", ticket });
  } catch (error: unknown) {
    console.error("upload revision", error);
    return Response.json({ success: false, message: explainServerError(error, "Revisi belum tersimpan. Silakan coba lagi.") }, { status: 500 });
  }
}

type TiketRevisi = {
  id: number;
  studentName: string;
  serviceType: string;
  serviceNeed: string;
  lecturerId: number | null;
  fileStoragePath: string | null;
};

/**
 * Revisi penyerahan perpustakaan: empat bagian PDF menggantikan yang lama.
 *
 * Urutannya disengaja. Berkas baru naik LEBIH DULU, barulah catatannya
 * ditukar di dalam satu transaksi, dan berkas lama dihapus paling akhir —
 * setelah tidak ada satu baris pun yang menunjuknya. Kalau urutannya
 * dibalik, satu kegagalan di tengah jalan meninggalkan tiket yang berkasnya
 * sudah telanjur hilang dan tidak dapat dikembalikan.
 */
async function gantiBerkasPenyerahan(input: {
  form: FormData;
  service: TiketRevisi;
  ticket: string;
  nim: string;
  note: string;
  revisionNumber: number;
}) {
  const { form, service, ticket, nim, note, revisionNumber } = input;

  // Halaman lama yang masih terbuka di tab mahasiswa mengirim satu berkas
  // .docx, karena begitulah formulir revisi dahulu untuk semua tiket. Tanpa
  // pesan ini yang muncul hanyalah "Cover sampai daftar isi belum dipilih",
  // yang menyebut kotak yang tidak ada di halaman mereka.
  const adaBagian = BAGIAN_PENYERAHAN.some((bagian) => {
    const isi = form.get(`bagian_${bagian.id}`);
    return isi instanceof File && Boolean(isi.name);
  });
  if (!adaBagian) {
    return Response.json(
      {
        success: false,
        message:
          "Revisi penyerahan skripsi/jurnal ke perpustakaan terdiri dari empat berkas PDF, " +
          "bukan satu berkas Word. Muat ulang halaman Upload Revisi, masukkan lagi nomor tiket " +
          "dan NIM Anda, lalu pilih keempat bagiannya.",
      },
      { status: 400 },
    );
  }

  const bagianBerkas: Array<{ id: string; label: string; urut: number; berkas: File }> = [];
  for (const [urut, bagian] of BAGIAN_PENYERAHAN.entries()) {
    const isi = form.get(`bagian_${bagian.id}`);
    const berkas = isi instanceof File && isi.name ? isi : null;
    const cek = periksaBerkasBagian(bagian.id, berkas);
    if (!cek.ok) {
      return Response.json({ success: false, message: cek.pesan }, { status: 400 });
    }
    bagianBerkas.push({ id: bagian.id, label: bagian.label, urut, berkas: berkas as File });
  }

  // Seluruh berkas lama tiket ini dicatat sebelum apa pun diganti.
  //
  // Tiga sumber, dan ketiganya perlu. Yang pertama keempat bagian yang
  // sedang dipakai. Dua sisanya peninggalan masa formulir revisi masih
  // meminta satu berkas .docx untuk SEMUA tiket: tiket penyerahan yang
  // terlanjur direvisi lewat jalur itu menyimpan berkas Word pada kolom
  // berkas utama sekaligus di riwayat revisi. Berkas itu tidak pernah
  // menjadi bagian penyerahan yang sah, dan bila tidak ikut diangkat di sini
  // ia menetap selamanya di penyimpanan tanpa satu pun halaman yang
  // menampilkannya.
  const lama = await db
    .select({ path: requestAttachments.fileStoragePath })
    .from(requestAttachments)
    .where(eq(requestAttachments.requestId, service.id))
    .orderBy(asc(requestAttachments.sortOrder), asc(requestAttachments.id));
  const revisiLama = await db
    .select({ path: revisionUploads.fileStoragePath })
    .from(revisionUploads)
    .where(eq(revisionUploads.requestId, service.id));
  const jalurLama = [
    ...lama.map((row) => row.path),
    ...revisiLama.map((row) => row.path),
    service.fileStoragePath,
  ].filter((path, index, semua): path is string => Boolean(path) && semua.indexOf(path) === index);

  const jalurBaru: string[] = [];
  const naik: Array<{ id: string; label: string; urut: number; berkas: File; jalur: string }> = [];
  try {
    for (const b of bagianBerkas) {
      const jalur = await uploadDocument({
        folder: "requests",
        ticket,
        file: b.berkas,
        contentType: b.berkas.type || PDF_MIME,
      });
      jalurBaru.push(jalur);
      naik.push({ ...b, jalur });
    }

    await db.transaction(async (tx) => {
      await tx.delete(requestAttachments).where(eq(requestAttachments.requestId, service.id));
      // Riwayat revisi .docx tiket penyerahan ikut dibuang bersama berkasnya:
      // barisnya menunjuk berkas yang sebentar lagi tidak ada, dan riwayat
      // yang menjanjikan unduhan yang selalu gagal lebih buruk daripada tidak
      // ada riwayat sama sekali. Riwayat penyerahan yang sebenarnya adalah
      // keempat bagian yang sedang berlaku, ditambah penghitung revisi.
      await tx.delete(revisionUploads).where(eq(revisionUploads.requestId, service.id));
      await tx.insert(requestAttachments).values(
        naik.map((b) => ({
          requestId: service.id,
          part: b.id,
          label: b.label,
          sortOrder: b.urut,
          fileName: b.berkas.name,
          fileMime: b.berkas.type || PDF_MIME,
          fileSize: b.berkas.size,
          fileStoragePath: b.jalur,
        })),
      );
      await tx
        .update(serviceRequests)
        .set({
          revisionCount: revisionNumber,
          // Tiket penyerahan tidak memakai berkas utama; keempat bagiannya
          // dicatat di request_attachments. Dikosongkan supaya tidak ada
          // penunjuk yang tertinggal ke berkas yang sebentar lagi dihapus.
          fileName: null,
          fileMime: null,
          fileSize: null,
          fileStoragePath: null,
          fileData: null,
          studentNote: note || null,
          status: "Masuk",
          administrativeStatus: "Belum Dicek",
          updatedAt: new Date(),
        })
        .where(eq(serviceRequests.id, service.id));
    });
  } catch (error) {
    await Promise.all(jalurBaru.map((path) => removeDocument(path).catch(() => undefined)));
    throw error;
  }

  // Berkas lama sudah tidak ditunjuk baris mana pun. Kegagalan menghapusnya
  // tidak boleh menggagalkan revisi yang sudah tersimpan: yang tertinggal
  // hanya berkas yatim, dan itu ikut terangkat oleh pembersihan berkala.
  await Promise.all(
    jalurLama.map((path) =>
      removeDocument(path).catch((error) => {
        console.error("hapus berkas penyerahan lama", path, error);
      }),
    ),
  );

  await kabarkanRevisi({ service, ticket, nim, revisionNumber, jumlahBerkas: naik.length });

  return Response.json({
    success: true,
    message: `Revisi berhasil dikirim. ${naik.length} berkas menggantikan unggahan sebelumnya.`,
    ticket,
    replaced: jalurLama.length,
  });
}

/** Bunyikan lonceng admin unit — dan dosen tujuan bila tiketnya punya. */
async function kabarkanRevisi(input: {
  service: TiketRevisi;
  ticket: string;
  nim: string;
  revisionNumber: number;
  jumlahBerkas: number;
}) {
  const { service, ticket, nim, revisionNumber, jumlahBerkas } = input;
  const audienceRole = audienceForServiceType(service.serviceType);
  const body =
    `${service.studentName} (${nim}) mengunggah revisi ke-${revisionNumber} ` +
    `untuk ${service.serviceNeed} — ${jumlahBerkas} berkas. Perlu diperiksa ulang.`;

  if (audienceRole) {
    await pushNotification({
      audienceRole,
      kind: "revision_uploaded",
      severity: "info",
      title: "Revisi berkas masuk",
      body,
      refCode: ticket,
    });
  }
  if (service.lecturerId) {
    await pushNotification({
      lecturerId: service.lecturerId,
      kind: "revision_uploaded",
      severity: "info",
      title: "Revisi berkas masuk",
      body,
      refCode: ticket,
    });
  }
}
