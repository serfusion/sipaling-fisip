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
import { amankanBagian, bacaBagianDariForm, jalurDiklaim } from "@/lib/unggah-klaim";
import { revisiPemilikJalur } from "@/lib/kiriman-ulang-server";
import { audienceUntukLayanan, pushNotification } from "@/lib/notify";
import { gantiBerkasTunggal, gantiLampiranRevisi } from "@/lib/revisi-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Sama alasannya dengan /api/requests: jalur cadangan masih mengangkut berkas
// di dalam badan permintaan, dan batas bawaan 10 detik memutusnya di tengah.
export const maxDuration = 60;

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
  // 15, bukan 8 seperti sebelumnya: peramban kini MENGULANG kirimannya sendiri
  // sampai tiga kali bila yang gagal bukan keputusan portal (lihat
  // src/lib/kirim-ulang.ts). Dengan batas 8, satu pengiriman yang tersendat
  // dapat menghabiskan kuota sebelum mahasiswa mendapat satu pun tiket — dan
  // yang terbaca di layar lalu berganti menjadi "terlalu banyak permintaan",
  // pesan yang sama sekali tidak menjelaskan keadaannya.
  const limit = rateLimit({ request, name: "revision-upload", limit: 15, windowMs: 10 * 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  // Selama mode maintenance menyala, kiriman dari pengunjung umum ditolak
  // supaya halaman lama yang masih terbuka di tab mahasiswa tidak dapat
  // menyelinap mengirim data. Dosen/admin yang login tetap dilayani.
  const closed = await blockedByMaintenance();
  if (closed) return closed;

  // Berkas yang berhasil naik dicatat di sini. Bila langkah berikutnya gagal,
  // semuanya dihapus kembali supaya tidak ada berkas yatim yang memakan kuota.
  const naik: string[] = [];
  // Jalur transit yang sah tetapi batal dipakai, disapu bersama `naik`.
  const sapuTransit: string[] = [];

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
    const bentuk = bentukUnggah(service.serviceType, service.serviceNeed, true);

    // KIRIMAN ULANG, diperiksa SEBELUM status.
    //
    // Revisi yang tersimpan mengubah status tiketnya menjadi "Masuk". Kiriman
    // ulang sesudah jawaban yang hilang karena itu akan ditolak penjaga status
    // di bawah dengan alasan yang tepat menurut aturan dan salah menurut
    // keadaan: berkasnya justru sudah masuk. Bila jalur pada kiriman ini sudah
    // tercatat sebagai revisi tiket ini, yang dipulangkan kabar berhasil —
    // bukan penolakan, dan bukan pula revisi kedua yang menimpa berkas yang
    // baru saja tersimpan.
    //
    // Formulirnya dibaca SEKALI di sini lalu dipakai lagi oleh cabang "bagian"
    // di bawah: pembacaannya murni (tidak menyentuh penyimpanan), dan
    // membacanya dua kali hanya membuat aturan yang sama dievaluasi dua kali.
    const dibaca = bentuk.jenis === "bagian" ? bacaBagianDariForm(form, "revisions", bentuk.bagian) : null;
    if (bentuk.jenis === "bagian" && dibaca?.ok) {
      const sudah = await revisiPemilikJalur(service.id, jalurDiklaim(dibaca.daftar));
      if (sudah) {
        return Response.json({
          success: true,
          message:
            `Revisi ke-${sudah.nomor} sudah tersimpan sebelumnya, jawaban yang pertama tidak sampai ` +
            "ke perangkat Anda. Berkasnya tidak perlu diunggah lagi.",
          ticket,
          jumlah: bentuk.bagian.length,
          ulangan: true,
        });
      }
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

    if (bentuk.jenis === "tanpa") {
      return Response.json(
        { success: false, message: `Layanan ini tidak memuat berkas. ${bentuk.alasan}` },
        { status: 400 },
      );
    }

    const revisionNumber = (service.revisionCount || 0) + 1;

    // ---------- BEBERAPA BAGIAN SEKALIGUS ----------
    if (bentuk.jenis === "bagian") {
      // SELURUH berkas diperiksa lebih dulu, sebelum satu pun diklaim. Kalau
      // pemeriksaannya diselang-seling dengan pencatatan, berkas keempat yang
      // ditolak meninggalkan tiga berkas yatim di penyimpanan.
      //
      // Berkasnya sendiri sudah dinaikkan peramban langsung ke penyimpanan —
      // revisi penyerahan juga empat PDF, dan empat PDF tidak pernah muat di
      // badan permintaan fungsi serverless. Kiriman lama yang masih membawa
      // berkasnya sendiri tetap dilayani lewat jalur cadangan.
      //
      // `dibaca` sudah disiapkan di atas, saat memeriksa kiriman ulang.
      if (!dibaca) {
        return Response.json(
          { success: false, message: "Bentuk berkas revisi tidak dapat dibaca. Muat ulang halaman lalu coba lagi." },
          { status: 400 },
        );
      }
      sapuTransit.push(...dibaca.sapu);
      if (!dibaca.ok) {
        await Promise.all(sapuTransit.map((p) => removeDocument(p).catch(() => undefined)));
        return Response.json({ success: false, message: dibaca.pesan }, { status: 400 });
      }

      const diamankan = await amankanBagian({
        daftar: dibaca.daftar,
        folder: "revisions",
        ticket,
        naik,
        sapu: sapuTransit,
      });
      if (!diamankan.ok) {
        await Promise.all(
          [...naik, ...sapuTransit].map((p) => removeDocument(p).catch(() => undefined)),
        );
        return Response.json({ success: false, message: diamankan.pesan }, { status: 400 });
      }
      const barisBaru = diamankan.hasil;

      const jalurLama = await gantiLampiranRevisi({
        requestId: service.id,
        nim,
        revisionNumber,
        note: note || null,
        baru: barisBaru.map((b) => ({
          part: b.id,
          label: b.label,
          sortOrder: b.urut,
          fileName: b.nama,
          fileMime: PDF_MIME,
          fileSize: b.ukuran,
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
    await Promise.all([...naik, ...sapuTransit].map((p) => removeDocument(p).catch(() => undefined)));
    console.error("upload revision", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Revisi belum tersimpan. Silakan coba lagi.") },
      { status: 500 },
    );
  }
}
