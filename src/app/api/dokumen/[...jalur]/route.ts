// Unduh (GET) dan unggah (PUT) dokumen pada penyimpanan disk server (v55).
// Wewenangnya HANYA dari tanda tangan HMAC di alamatnya — dibuat oleh rute
// yang sudah memeriksa hak akses (files, attachments, proposal-files,
// unggah/bagian). Lihat src/lib/penyimpanan-lokal.ts.
import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import { berkasDisk, pakaiPenyimpananLokal, simpanAliran, tandaSah } from "@/lib/penyimpanan-lokal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Batas satu unggahan langsung: berkas terbesar yang sah 25 MB, diberi kelonggaran. */
const MAKS_UNGGAH = 30 * 1024 * 1024;

const JENIS: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  png: "image/png",
};

type Konteks = { params: Promise<{ jalur: string[] }> };

async function jalurDari(konteks: Konteks) {
  const { jalur } = await konteks.params;
  // Jalur dokumen hanya berisi huruf, angka, titik, garis bawah, dan strip
  // (lihat buatJalurDokumen & jalurTransit), jadi tidak ada yang perlu diurai.
  return (jalur || []).join("/");
}

function namaAman(nama: string) {
  return nama.replace(/[\r\n"\\]/g, "_");
}

export async function GET(request: Request, konteks: Konteks) {
  if (!pakaiPenyimpananLokal()) return new Response("Tidak ditemukan", { status: 404 });
  const jalur = await jalurDari(konteks);
  const q = new URL(request.url).searchParams;
  const unduh = q.get("d") || "";
  if (!tandaSah("get", jalur, Number(q.get("e")), q.get("t") || "", unduh)) {
    return new Response("Tautan tidak sah atau sudah kedaluwarsa. Buka ulang dari portal.", { status: 403 });
  }
  const berkas = berkasDisk(jalur);
  const info = berkas ? await fs.stat(berkas).catch(() => null) : null;
  if (!berkas || !info?.isFile()) return new Response("Berkas tidak ditemukan", { status: 404 });

  const ekstensi = (jalur.split(".").pop() || "").toLowerCase();
  const kepala: Record<string, string> = {
    "Content-Type": JENIS[ekstensi] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (unduh) {
    kepala["Content-Disposition"] =
      `attachment; filename="${namaAman(unduh)}"; filename*=UTF-8''${encodeURIComponent(unduh)}`;
  }

  // Satu rentang "bytes=a-b" cukup: itulah satu-satunya bentuk yang dipakai
  // peramban (pratinjau PDF) dan pemeriksa kepala berkas.
  const rentang = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  let awal = 0;
  let akhir = info.size - 1;
  let status = 200;
  if (rentang && info.size > 0) {
    if (rentang[1]) {
      awal = Number(rentang[1]);
      if (rentang[2]) akhir = Math.min(Number(rentang[2]), info.size - 1);
    } else if (rentang[2]) {
      awal = Math.max(0, info.size - Number(rentang[2]));
    }
    if (awal > akhir || awal >= info.size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    }
    status = 206;
    kepala["Content-Range"] = `bytes ${awal}-${akhir}/${info.size}`;
  }
  kepala["Content-Length"] = String(info.size === 0 ? 0 : akhir - awal + 1);
  if (info.size === 0) return new Response(null, { status: 200, headers: kepala });

  const aliran = Readable.toWeb(createReadStream(berkas, { start: awal, end: akhir })) as ReadableStream;
  return new Response(aliran, { status, headers: kepala });
}

export async function PUT(request: Request, konteks: Konteks) {
  if (!pakaiPenyimpananLokal()) return new Response("Tidak ditemukan", { status: 404 });
  const jalur = await jalurDari(konteks);
  const q = new URL(request.url).searchParams;
  if (!tandaSah("put", jalur, Number(q.get("e")), q.get("t") || "")) {
    return Response.json({ statusCode: "403", error: "Unauthorized", message: "Izin unggah tidak sah atau kedaluwarsa." }, { status: 403 });
  }
  const panjang = Number(request.headers.get("content-length") || 0);
  if (panjang > MAKS_UNGGAH) {
    return Response.json({ statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" }, { status: 413 });
  }
  if (!request.body) return Response.json({ message: "Badan permintaan kosong." }, { status: 400 });
  try {
    await simpanAliran(jalur, request.body as unknown as AsyncIterable<Uint8Array>, MAKS_UNGGAH);
  } catch (galat: unknown) {
    const pesan = galat instanceof Error ? galat.message : String(galat);
    const besar = pesan.includes("batas ukuran");
    return Response.json(
      { statusCode: besar ? "413" : "500", message: besar ? "The object exceeded the maximum allowed size" : pesan },
      { status: besar ? 413 : 500 },
    );
  }
  return Response.json({ Key: jalur });
}
