// ============================================================
// UNGGAH REVISI
//
// Berapa berkas yang diminta di sini DITENTUKAN OLEH TIKETNYA, bukan
// ditetapkan satu untuk semua. Penyerahan skripsi ke perpustakaan mengunggah
// empat PDF saat mengajukan; revisinya karena itu juga empat PDF, dan
// keempatnya MENGGANTIKAN yang lama pada tiket yang sama.
//
// Sebelum ini formulir revisi selalu meminta satu berkas .docx, apa pun
// layanannya. Akibatnya tiga bagian yang lain tidak pernah tergantikan, dan
// admin memeriksa campuran antara berkas lama dan berkas baru tanpa ada yang
// memberi tahu bahwa itu yang sedang terjadi.
//
// Aturan bentuknya tinggal di src/lib/bentuk-unggah.ts dan dipakai bersama
// dengan formulirnya di peramban; penggantian barisnya di src/lib/revisi-store.ts
// supaya dapat diuji tanpa satu pun berkas sungguhan.
// ============================================================
import { db } from "@/db";
import { serviceRequests } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { MAX_DOCUMENT_BYTES, removeDocument, uploadDocument } from "@/lib/document-storage";
import { explainServerError } from "@/lib/api-errors";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { blockedByMaintenance } from "@/lib/maintenance-gate";
import { bentukUnggah, periksaBerkasTunggal } from "@/lib/bentuk-unggah";
import { periksaBerkasBagian } from "@/lib/bukti-penyerahan";
import { audienceUntukLayanan, pushNotification } from "@/lib/notify";
import { gantiBerkasTunggal, gantiLampiranRevisi } from "@/lib/revisi-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

function textValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fileValue(form: FormData, key: string) {
  const isi = form.get(key);
  return isi instanceof File && isi.name ? isi : null;
}

/**
 * Beri tahu unit yang menanganinya bahwa berkas revisi sudah masuk.
 *
 * Tanpa ini tiketnya kembali ke status "Masuk" dalam diam, dan yang menunggu
 * revisinya baru tahu ketika kebetulan menyegarkan daftar. Ditandai "urgent"
 * karena tiket revisi sudah pernah menunggu sekali; menunggu dua kali untuk
 * hal yang sama adalah yang paling membuat orang berhenti memakai portal.
 */
async function kabarkanRevisi(
  serviceType: string,
  serviceNeed: string,
  ticket: string,
  nim: string,
  revisi: number,
  jumlah: number,
) {
  await pushNotification({
    audienceRole: audienceUntukLayanan(serviceType),
    kind: "revisi-masuk",
    severity: "urgent",
    title: `Revisi ke-${revisi} masuk · ${serviceNeed}`,
    body: `NIM ${nim} mengunggah ${jumlah} berkas revisi. Berkas sebelumnya sudah digantikan.`,
    refCode: ticket,
  });
}

export async function POST(request: Request) {
  const limit = rateLimit({ request, name: "revision-upload", limit: 8, windowMs: 10 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  // Selama mode maintenance menyala, kiriman dari pengunjung umum ditolak
  // supaya halaman lama yang masih terbuka di tab mahasiswa tidak dapat
  // menyelinap mengirim data. Dosen/admin yang login tetap dilayani.
  const closed = await blockedByMaintenance();
  if (closed) return closed;

  // Berkas yang berhasil naik dicatat di sini. Bila langkah berikutnya gagal,
  // semuanya dihapus kembali supaya tidak ada berkas yatim yang memakan kuota.
  const naik: string[] = [];

  try {
    const form = await request.formData();
    const ticket = textValue(form, "ticket");
    const nim = textValue(form, "nim");
    const note = textValue(form, "note");

    if (!ticket || !nim) {
      return Response.json(
        { success: false, message: "Nomor tiket dan NIM wajib diisi." },
        { status: 400 },
      );
    }

    const rows = await db
      .select({
        id: serviceRequests.id,
        serviceType: serviceRequests.serviceType,
        serviceNeed: serviceRequests.serviceNeed,
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
      return Response.json(
        {
          success: false,
          message: `Upload revisi hanya tersedia saat status Revisi. Status saat ini: ${service.status}.`,
        },
        { status: 409 },
      );
    }

    const bentuk = bentukUnggah(service.serviceType, service.serviceNeed, true);
    if (bentuk.jenis === "tanpa") {
      return Response.json(
        { success: false, message: `Layanan ini tidak memuat berkas. ${bentuk.alasan}` },
        { status: 400 },
      );
    }

    const revisionNumber = (service.revisionCount || 0) + 1;

    // ---------- BEBERAPA BAGIAN SEKALIGUS ----------
    if (bentuk.jenis === "bagian") {
      // SELURUH berkas diperiksa lebih dulu, sebelum satu pun diunggah. Kalau
      // pemeriksaannya diselang-seling dengan unggahan, berkas keempat yang
      // ditolak meninggalkan tiga berkas yatim di penyimpanan.
      const dipilih: Array<{ id: string; label: string; urut: number; berkas: File }> = [];
      for (const [urut, bagian] of bentuk.bagian.entries()) {
        const berkas = fileValue(form, `bagian_${bagian.id}`);
        const cek = periksaBerkasBagian(bagian.id, berkas);
        if (!cek.ok) return Response.json({ success: false, message: cek.pesan }, { status: 400 });
        dipilih.push({ id: bagian.id, label: bagian.label, urut, berkas: berkas as File });
      }

      const barisBaru: Array<{ id: string; label: string; urut: number; berkas: File; jalur: string }> = [];
      for (const b of dipilih) {
        const jalur = await uploadDocument({
          folder: "revisions",
          ticket,
          file: b.berkas,
          contentType: b.berkas.type || PDF_MIME,
        });
        naik.push(jalur);
        barisBaru.push({ ...b, jalur });
      }

      const jalurLama = await gantiLampiranRevisi({
        requestId: service.id,
        nim,
        revisionNumber,
        note: note || null,
        baru: barisBaru.map((b) => ({
          part: b.id,
          label: b.label,
          sortOrder: b.urut,
          fileName: b.berkas.name,
          fileMime: b.berkas.type || PDF_MIME,
          fileSize: b.berkas.size,
          fileStoragePath: b.jalur,
        })),
      });

      // Berkas lama dihapus PALING AKHIR, sesudah basis data yakin. Kalau
      // urutannya dibalik dan transaksinya gagal, tiketnya menunjuk berkas
      // yang sudah tidak ada — dan tidak ada satu pun salinannya tersisa.
      await Promise.all(jalurLama.map((p) => removeDocument(p).catch(() => undefined)));

      await kabarkanRevisi(
        service.serviceType, service.serviceNeed, ticket, nim, revisionNumber, barisBaru.length,
      );
      return Response.json({
        success: true,
        message: `Revisi berhasil dikirim. ${barisBaru.length} berkas menggantikan yang sebelumnya.`,
        ticket,
        jumlah: barisBaru.length,
      });
    }

    // ---------- SATU BERKAS ----------
    const file = fileValue(form, bentuk.nama);
    const cek = periksaBerkasTunggal(bentuk, file);
    if (!cek.ok) return Response.json({ success: false, message: cek.pesan }, { status: 400 });
    if (!file) {
      return Response.json({ success: false, message: `${bentuk.label} belum dipilih.` }, { status: 400 });
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      return Response.json(
        { success: false, message: `Berkas melebihi batas ${MAX_DOCUMENT_BYTES / (1024 * 1024)} MB.` },
        { status: 400 },
      );
    }

    const fileMime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? PDF_MIME : DOCX_MIME);
    const fileStoragePath = await uploadDocument({ folder: "revisions", ticket, file, contentType: fileMime });
    naik.push(fileStoragePath);

    await gantiBerkasTunggal({
      requestId: service.id,
      nim,
      revisionNumber,
      note: note || null,
      lama: {
        fileName: service.fileName,
        fileMime: service.fileMime,
        fileSize: service.fileSize,
        fileStoragePath: service.fileStoragePath,
        fileData: service.fileData,
      },
      baru: { fileName: file.name, fileMime, fileSize: file.size, fileStoragePath },
    });

    await kabarkanRevisi(service.serviceType, service.serviceNeed, ticket, nim, revisionNumber, 1);
    return Response.json({ success: true, message: "Revisi berhasil dikirim.", ticket, jumlah: 1 });
  } catch (error: unknown) {
    await Promise.all(naik.map((p) => removeDocument(p).catch(() => undefined)));
    console.error("upload revision", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Revisi belum tersimpan. Silakan coba lagi.") },
      { status: 500 },
    );
  }
}
