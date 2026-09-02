// ============================================================
// PENGGANTIAN BERKAS SAAT REVISI — sisi basis data
//
// Dipisahkan dari route-nya dengan sengaja. Yang di route adalah mengunggah
// berkas ke penyimpanan; yang di sini adalah memutuskan baris mana yang
// dibuang dan baris mana yang menggantikannya — dan bagian kedua itulah yang
// pernah salah, jadi ia harus dapat diuji tanpa satu pun berkas sungguhan.
// ============================================================
import { db } from "@/db";
import { requestAttachments, revisionUploads, serviceRequests } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export type LampiranBaru = {
  part: string;
  label: string;
  sortOrder: number;
  fileName: string;
  fileMime: string;
  fileSize: number;
  fileStoragePath: string;
};

/**
 * Ganti SELURUH lampiran bernama milik satu tiket dengan yang baru.
 *
 * Mengembalikan jalur penyimpanan berkas lama supaya pemanggilnya dapat
 * menghapusnya — dan hanya sesudah basis data yakin. Menghapusnya lebih dulu
 * berarti tiket yang menunjuk berkas yang sudah tidak ada bila transaksinya
 * gagal, tanpa satu pun salinan tersisa.
 */
export async function gantiLampiranRevisi(input: {
  requestId: number;
  nim: string;
  revisionNumber: number;
  note: string | null;
  baru: LampiranBaru[];
}): Promise<string[]> {
  const lama = await db
    .select()
    .from(requestAttachments)
    .where(eq(requestAttachments.requestId, input.requestId))
    .orderBy(asc(requestAttachments.sortOrder));

  await db.transaction(async (tx) => {
    // Berkas pengajuan awal disimpan sebagai revisi ke-0 supaya riwayatnya
    // tidak lenyap begitu yang baru menimpanya.
    if (input.revisionNumber === 1 && lama.length > 0) {
      await tx.insert(revisionUploads).values(
        lama.map((a) => ({
          requestId: input.requestId,
          nim: input.nim,
          revisionNumber: 0,
          part: a.part,
          label: a.label,
          note: "Berkas pengajuan awal",
          fileName: a.fileName,
          fileMime: a.fileMime,
          fileSize: a.fileSize,
          fileStoragePath: a.fileStoragePath,
          fileData: null,
        })),
      );
    }

    await tx.insert(revisionUploads).values(
      input.baru.map((b) => ({
        requestId: input.requestId,
        nim: input.nim,
        revisionNumber: input.revisionNumber,
        part: b.part,
        label: b.label,
        note: input.note,
        fileName: b.fileName,
        fileMime: b.fileMime,
        fileSize: b.fileSize,
        fileStoragePath: b.fileStoragePath,
        fileData: null,
      })),
    );

    // MENGGANTIKAN, bukan menumpuk. Baris lama dibuang lebih dulu supaya yang
    // dilihat admin persis empat berkas — bukan delapan yang harus ia
    // bandingkan sendiri tanggalnya satu per satu.
    await tx.delete(requestAttachments).where(eq(requestAttachments.requestId, input.requestId));
    await tx.insert(requestAttachments).values(
      input.baru.map((b) => ({
        requestId: input.requestId,
        part: b.part,
        label: b.label,
        sortOrder: b.sortOrder,
        fileName: b.fileName,
        fileMime: b.fileMime,
        fileSize: b.fileSize,
        fileStoragePath: b.fileStoragePath,
      })),
    );

    await tx
      .update(serviceRequests)
      .set({
        revisionCount: input.revisionNumber,
        studentNote: input.note,
        status: "Masuk",
        administrativeStatus: "Belum Dicek",
        updatedAt: new Date(),
      })
      .where(eq(serviceRequests.id, input.requestId));
  });

  return lama.map((l) => l.fileStoragePath).filter((p): p is string => Boolean(p));
}

/** Berkas tunggal: pointer berkas utama tiketnya yang diarahkan ke yang baru. */
export async function gantiBerkasTunggal(input: {
  requestId: number;
  nim: string;
  revisionNumber: number;
  note: string | null;
  lama: {
    fileName: string | null;
    fileMime: string | null;
    fileSize: number | null;
    fileStoragePath: string | null;
    fileData: Buffer | null;
  };
  baru: { fileName: string; fileMime: string; fileSize: number; fileStoragePath: string };
}) {
  await db.transaction(async (tx) => {
    if (
      input.revisionNumber === 1 &&
      input.lama.fileName &&
      input.lama.fileMime &&
      input.lama.fileSize &&
      (input.lama.fileStoragePath || input.lama.fileData)
    ) {
      await tx.insert(revisionUploads).values({
        requestId: input.requestId,
        nim: input.nim,
        revisionNumber: 0,
        note: "Berkas pengajuan awal",
        fileName: input.lama.fileName,
        fileMime: input.lama.fileMime,
        fileSize: input.lama.fileSize,
        fileStoragePath: input.lama.fileStoragePath,
        fileData: input.lama.fileData,
      });
    }

    await tx.insert(revisionUploads).values({
      requestId: input.requestId,
      nim: input.nim,
      revisionNumber: input.revisionNumber,
      note: input.note,
      fileName: input.baru.fileName,
      fileMime: input.baru.fileMime,
      fileSize: input.baru.fileSize,
      fileStoragePath: input.baru.fileStoragePath,
      fileData: null,
    });

    await tx
      .update(serviceRequests)
      .set({
        revisionCount: input.revisionNumber,
        fileName: input.baru.fileName,
        fileMime: input.baru.fileMime,
        fileSize: input.baru.fileSize,
        fileStoragePath: input.baru.fileStoragePath,
        fileData: null,
        studentNote: input.note,
        status: "Masuk",
        administrativeStatus: "Belum Dicek",
        updatedAt: new Date(),
      })
      .where(eq(serviceRequests.id, input.requestId));
  });
}
