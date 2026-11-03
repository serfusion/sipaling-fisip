// ============================================================
// TUGAS LEWAT CBT — pembacaan dan penulisan basis data
//
// Dipakai jalur dosen (/api/cbt/tugas/*), jalur mahasiswa (/api/cbt/kumpul),
// dan papan nilai (/api/cbt/papan). Aturan yang tidak menyentuh basis data
// tinggal di berkas murni: kode di tugas-kode.ts, plagiasi di
// tugas-plagiasi.ts, peringkat dan keterangan di tugas-papan.ts.
// ============================================================
import { db } from "@/db";
import { cbtTaskSimilarity, cbtTaskSubmissions, cbtTasks } from "@/db/schema";
import { and, asc, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { pushNotification } from "@/lib/notify";
import { PEMANTAU, type Kepemilikan, type Pemakai } from "@/lib/cbt";
import {
  SKALA_BAWAAN, hitungNilaiTugas, rapikanRubrikTugas, rapikanSkala, skorAman,
  type RubrikTugas, type TingkatPredikat,
} from "@/lib/tugas-rubrik";
import { buatKodeResi, buatKodeTugas } from "@/lib/tugas-kode";
import { periksaPlagiasi } from "@/lib/tugas-plagiasi";
import { nilaiEfektif, rapikanTindakan, type Putusan, type TindakanPlagiasi } from "@/lib/tugas-papan";
import type { HasilPenilaianTugas } from "@/lib/tugas-nilai";
import type { DataLaporan } from "@/lib/tugas-template";

export type BarisTugas = typeof cbtTasks.$inferSelect;
export type BarisKiriman = typeof cbtTaskSubmissions.$inferSelect;
export type BarisPasangan = typeof cbtTaskSimilarity.$inferSelect;

/** Batas isi Markdown satu kiriman (± 60.000 kata). */
export const MAKS_MD = 400_000;
/** Kiriman CBT di bawah sekian kata ditolak: PDF tanpa teks tidak dapat dinilai. */
export const MIN_KATA_KIRIM = 20;

// ------------------------------------------------------------
// BENTUK DATA
// ------------------------------------------------------------

export function kepemilikan(t: BarisTugas): Kepemilikan {
  return { lecturerId: t.lecturerId, createdBy: t.createdBy, createdById: t.createdById };
}

export function rubrikDari(t: Pick<BarisTugas, "rubric">): RubrikTugas {
  try {
    return rapikanRubrikTugas(JSON.parse(t.rubric));
  } catch {
    return { nama: "", kriteria: [] };
  }
}

export function skalaDari(t: Pick<BarisTugas, "scale">): TingkatPredikat[] {
  try {
    const isi = JSON.parse(t.scale);
    if (Array.isArray(isi) && isi.length) return rapikanSkala(isi);
  } catch {
    // Tangga yang rusak dibaca sebagai tangga bawaan.
  }
  return SKALA_BAWAAN.map((x) => ({ ...x }));
}

export type HasilSimpan = Omit<HasilPenilaianTugas, "mentah">;

export function hasilDari(k: Pick<BarisKiriman, "result">): HasilSimpan | null {
  if (!k.result) return null;
  try {
    return JSON.parse(k.result) as HasilSimpan;
  } catch {
    return null;
  }
}

export const nilaiDari = (k: Pick<BarisKiriman, "score">) => (k.score === null || k.score === undefined ? null : Number(k.score));

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

/** Bagian "tugas" data laporan PDF (bentuk yang dipakai template laporan). */
export function tugasLaporan(t: BarisTugas): DataLaporan["tugas"] {
  return { mataKuliah: t.courseName, nomor: t.taskNo, nama: t.title, dosen: t.lecturerName, kelas: t.className ?? "" };
}

/** Tugas untuk peramban dosen. */
export function tugasKeKlien(t: BarisTugas) {
  return {
    id: t.id,
    kode: t.code,
    mataKuliah: t.courseName,
    nomor: t.taskNo,
    nama: t.title,
    petunjuk: t.instruction,
    dosen: t.lecturerName,
    kelas: t.className ?? "",
    rubrik: rubrikDari(t),
    template: t.template,
    namaTemplate: t.templateName,
    skala: skalaDari(t),
    kakiSpf: t.footerOn,
    batasKritis: t.criticalScore,
    ambangTinjau: t.plagiarismReview,
    ambangTinggi: t.plagiarismHigh,
    tindakan: rapikanTindakan(t.plagiarismAction),
    terbuka: t.acceptOpen,
    tenggat: iso(t.deadlineAt),
    terbit: t.published,
    terbitPada: iso(t.publishedAt),
    pemilik: t.createdBy,
    dibuat: iso(t.createdAt),
    diubah: iso(t.updatedAt),
  };
}
export type TugasKlien = ReturnType<typeof tugasKeKlien>;

/** Kolom kiriman tanpa isi Markdown, ditambah panjangnya. */
const { markdown: _md, ...kolomTanpaMd } = getTableColumns(cbtTaskSubmissions);
const kolomRingkas = { ...kolomTanpaMd, panjang: sql<number>`length(${cbtTaskSubmissions.markdown})::int` };
type BarisRingkas = Omit<BarisKiriman, "markdown"> & { panjang: number };

/** Kiriman untuk peramban dosen, tanpa isi Markdown. */
export function kirimanKeKlien(k: Omit<BarisKiriman, "markdown"> & { panjang?: number; markdown?: string }, tindakan: TindakanPlagiasi) {
  const plagiasi = { status: k.similarityStatus, skor: k.similarity, putusan: k.decision };
  const ef = nilaiEfektif({ status: k.status, nilai: nilaiDari(k), plagiasi }, tindakan);
  return {
    id: k.id,
    kode: k.receipt,
    nama: k.name,
    nim: k.nim,
    asal: k.source,
    berkas: k.fileName,
    ukuran: k.fileSize,
    sidik: k.fileHash,
    halaman: k.pages,
    kata: k.words,
    panjang: k.panjang ?? k.markdown?.length ?? 0,
    kemiripan: k.similarity,
    statusMirip: k.similarityStatus,
    miripDengan: k.similarTo,
    putusan: k.decision as Putusan,
    diputusOleh: k.decidedBy ?? "",
    status: k.status,
    nilai: nilaiDari(k),
    nilaiBerlaku: ef.nilai,
    keadaan: ef.keadaan,
    hasil: hasilDari(k),
    disunting: k.edited,
    dinilai: iso(k.gradedAt),
    dikumpulkan: iso(k.submittedAt),
  };
}
export type KirimanKlien = ReturnType<typeof kirimanKeKlien>;

export function pasanganKeKlien(p: BarisPasangan) {
  let sinyal: Record<string, unknown> = {};
  try { sinyal = JSON.parse(p.signals); } catch { /* sinyal rusak dibaca kosong */ }
  return { a: p.subA, b: p.subB, skor: p.score, bagianA: p.shareA, bagianB: p.shareB, status: p.status, sinyal };
}
export type PasanganKlien = ReturnType<typeof pasanganKeKlien>;

// ------------------------------------------------------------
// GALAT POSTGRES
// ------------------------------------------------------------

/** Kode dan nama batasan galat Postgres, menembus pembungkus Drizzle. */
export function galatPg(e: unknown): { kode: string; batasan: string } {
  const a = (e ?? {}) as { code?: unknown; constraint?: unknown; cause?: { code?: unknown; constraint?: unknown } };
  return {
    kode: String(a.code ?? a.cause?.code ?? ""),
    batasan: String(a.constraint ?? a.cause?.constraint ?? ""),
  };
}

// ------------------------------------------------------------
// TUGAS
// ------------------------------------------------------------

export async function tugasDariId(id: number): Promise<BarisTugas | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const baris = await db.select().from(cbtTasks).where(eq(cbtTasks.id, id)).limit(1);
  return baris[0] ?? null;
}

export async function tugasDariKode(kode: string): Promise<BarisTugas | null> {
  if (!kode) return null;
  const baris = await db.select().from(cbtTasks).where(eq(cbtTasks.code, kode)).limit(1);
  return baris[0] ?? null;
}

/**
 * Tugas yang terlihat oleh pemakai ini, beserta hitungan kirimannya.
 *
 * Subkuerinya menyebut cbt_tasks.id dengan nama tabelnya sendiri: Drizzle
 * menulis kolom tanpa nama tabel pada select satu tabel, dan "id" polos di
 * dalam subkueri terikat ke tabel kiriman, bukan ke tugasnya.
 */
export async function daftarTugasUntuk(profile: Pemakai) {
  const semua = PEMANTAU.includes(profile.role);
  const baris = await db
    .select({
      t: cbtTasks,
      jumlah: sql<number>`(SELECT count(*)::int FROM cbt_task_submissions s WHERE s.task_id = cbt_tasks.id)`,
      dinilai: sql<number>`(SELECT count(*)::int FROM cbt_task_submissions s WHERE s.task_id = cbt_tasks.id AND s.status = 'dinilai')`,
      ditandai: sql<number>`(SELECT count(*)::int FROM cbt_task_submissions s WHERE s.task_id = cbt_tasks.id AND s.similarity_status = 'tinggi' AND s.decision = '')`,
    })
    .from(cbtTasks)
    .where(semua ? undefined : eq(cbtTasks.createdById, profile.id))
    .orderBy(desc(cbtTasks.updatedAt))
    .limit(300);
  return baris.map((b) => ({ ...tugasKeKlien(b.t), jumlah: b.jumlah, dinilai: b.dinilai, ditandai: b.ditandai }));
}

/** Buat tugas baru. Kode pengumpulannya dicoba ulang bila kebetulan kembar. */
export async function buatTugas(profile: Pemakai, isi: Partial<typeof cbtTasks.$inferInsert> = {}): Promise<BarisTugas> {
  for (let coba = 0; coba < 6; coba += 1) {
    try {
      const [baris] = await db.insert(cbtTasks).values({
        ...isi,
        code: buatKodeTugas(),
        lecturerId: profile.lecturerId,
        createdBy: profile.fullName.slice(0, 160),
        createdById: profile.id,
      }).returning();
      return baris;
    } catch (e) {
      const g = galatPg(e);
      if (g.kode === "23505" && /code/.test(g.batasan)) continue;
      throw e;
    }
  }
  throw new Error("Kode pengumpulan baru tidak dapat dibuat. Coba lagi.");
}

// ------------------------------------------------------------
// KIRIMAN
// ------------------------------------------------------------

export async function kirimanTugas(taskId: number): Promise<BarisRingkas[]> {
  return db
    .select(kolomRingkas)
    .from(cbtTaskSubmissions)
    .where(eq(cbtTaskSubmissions.taskId, taskId))
    .orderBy(asc(cbtTaskSubmissions.submittedAt), asc(cbtTaskSubmissions.id));
}

export async function kirimanDariId(id: number): Promise<BarisKiriman | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const baris = await db.select().from(cbtTaskSubmissions).where(eq(cbtTaskSubmissions.id, id)).limit(1);
  return baris[0] ?? null;
}

export async function kirimanDariResi(resi: string): Promise<BarisKiriman | null> {
  if (!resi) return null;
  const baris = await db.select().from(cbtTaskSubmissions).where(eq(cbtTaskSubmissions.receipt, resi)).limit(1);
  return baris[0] ?? null;
}

export async function kirimanCbtDariNim(taskId: number, nim: string): Promise<BarisKiriman | null> {
  const baris = await db.select().from(cbtTaskSubmissions)
    .where(and(eq(cbtTaskSubmissions.taskId, taskId), eq(cbtTaskSubmissions.nim, nim), eq(cbtTaskSubmissions.source, "cbt")))
    .limit(1);
  return baris[0] ?? null;
}

export async function pasanganTugas(taskId: number): Promise<BarisPasangan[]> {
  return db.select().from(cbtTaskSimilarity)
    .where(eq(cbtTaskSimilarity.taskId, taskId))
    .orderBy(desc(cbtTaskSimilarity.score));
}

/**
 * Isi Markdown beberapa kiriman, untuk zip arsip dosen.
 *
 * Dibatasi ± 3 MB per jawaban (batas jawaban fungsi Vercel 4,5 MB). Yang
 * tidak muat dikembalikan di `sisa`, dan peramban memintanya pada giliran
 * berikutnya.
 */
export async function markdownKiriman(taskId: number, ids: number[], maksHuruf = 3_000_000) {
  const bersih = [...new Set(ids.filter((x) => Number.isInteger(x) && x > 0))].slice(0, 400);
  if (!bersih.length) return { isi: [] as Array<{ id: number; markdown: string }>, sisa: [] as number[] };
  const ukuran = await db
    .select({ id: cbtTaskSubmissions.id, panjang: sql<number>`length(${cbtTaskSubmissions.markdown})::int` })
    .from(cbtTaskSubmissions)
    .where(and(eq(cbtTaskSubmissions.taskId, taskId), inArray(cbtTaskSubmissions.id, bersih)));
  const ambil: number[] = [];
  const sisa: number[] = [];
  let total = 0;
  for (const u of ukuran) {
    if (ambil.length && total + u.panjang > maksHuruf) { sisa.push(u.id); continue; }
    ambil.push(u.id);
    total += u.panjang;
  }
  const isi = ambil.length
    ? await db.select({ id: cbtTaskSubmissions.id, markdown: cbtTaskSubmissions.markdown })
      .from(cbtTaskSubmissions)
      .where(and(eq(cbtTaskSubmissions.taskId, taskId), inArray(cbtTaskSubmissions.id, ambil)))
    : [];
  return { isi, sisa };
}

export type KirimanBaru = Omit<typeof cbtTaskSubmissions.$inferInsert, "id" | "receipt">;

export class GalatNimKembar extends Error {
  constructor() {
    super("NIM ini sudah mengumpulkan tugas ini.");
    this.name = "GalatNimKembar";
  }
}

/** Simpan kiriman dengan kode SIPALING-TUGAS baru (dicoba ulang bila kembar). */
export async function simpanKiriman(isi: KirimanBaru): Promise<BarisKiriman> {
  for (let coba = 0; coba < 6; coba += 1) {
    try {
      const [baris] = await db.insert(cbtTaskSubmissions).values({ ...isi, receipt: buatKodeResi() }).returning();
      return baris;
    } catch (e) {
      const g = galatPg(e);
      if (g.kode === "23505" && /nim/.test(g.batasan)) throw new GalatNimKembar();
      if (g.kode === "23505" && /receipt/.test(g.batasan)) continue;
      throw e;
    }
  }
  throw new Error("Kode kiriman tidak dapat dibuat. Coba kumpulkan lagi.");
}

/** Hasil penilaian disimpan; nilai dihitung ulang dari skor dan bobot. */
export async function simpanHasil(k: BarisKiriman, hasil: HasilSimpan, opsi: { disunting: boolean; isiIdentitas?: boolean }) {
  const ubah: Partial<typeof cbtTaskSubmissions.$inferInsert> = {
    result: JSON.stringify(hasil),
    score: hasil.nilai.toFixed(2),
    status: "dinilai",
    edited: opsi.disunting,
    updatedAt: new Date(),
  };
  if (!opsi.disunting) ubah.gradedAt = new Date();
  // Nama dan NIM kosong (impor dosen dari nama berkas yang tidak terbaca)
  // diisi dari sampul dokumen yang dibaca AI.
  if (opsi.isiIdentitas) {
    if (!k.name && hasil.identitas?.nama) ubah.name = hasil.identitas.nama.slice(0, 160);
    if (!k.nim && hasil.identitas?.nim) ubah.nim = hasil.identitas.nim.replace(/\D/g, "").slice(0, 32);
  }
  const [baris] = await db.update(cbtTaskSubmissions).set(ubah).where(eq(cbtTaskSubmissions.id, k.id)).returning();
  return baris;
}

const teks = (v: unknown, maks: number) => String(v ?? "").replace(/\r/g, "").trim().slice(0, maks);

/**
 * Hasil yang disunting dosen, dibersihkan.
 *
 * Yang boleh diubah dosen: judul karya, skor dan capaian tiap kriteria,
 * kelebihan, perbaikan, catatan. Nilai akhir TIDAK diterima dari peramban;
 * ia dihitung ulang dari skor dan bobot di sini.
 */
export function rapikanHasilDosen(masuk: unknown, rubrik: RubrikTugas, lama: HasilSimpan | null): HasilSimpan {
  const d = (masuk ?? {}) as Record<string, unknown>;
  const mentahKriteria = Array.isArray(d.kriteria) ? d.kriteria : [];
  const kriteria = rubrik.kriteria.map((_, i) => {
    const k = (mentahKriteria[i] ?? {}) as { skor?: unknown; capaian?: unknown };
    return { urut: i, skor: skorAman(k.skor), capaian: teks(k.capaian, 1500) };
  });
  const hitung = hitungNilaiTugas(rubrik, kriteria.map((k) => k.skor));
  const daftar = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    gerbang: lama?.gerbang ?? { lolos: true, alasan: "" },
    judul: teks(d.judul, 300),
    identitas: lama?.identitas ?? { nama: "", nim: "" },
    kriteria,
    kelebihan: daftar(d.kelebihan).map((x) => teks(x, 800)).filter(Boolean).slice(0, 6),
    perbaikan: daftar(d.perbaikan)
      .map((x) => {
        const p = (x ?? {}) as { aspek?: unknown; uraian?: unknown };
        return { aspek: teks(p.aspek, 120), uraian: teks(p.uraian, 800) };
      })
      .filter((p) => p.uraian)
      .slice(0, 6),
    catatan: teks(d.catatan, 2000),
    bagianTambahan: daftar(d.bagianTambahan)
      .map((x) => {
        const b = (x ?? {}) as { judul?: unknown; isi?: unknown };
        return { judul: teks(b.judul, 200), isi: teks(b.isi, 2000) };
      })
      .filter((b) => b.judul && b.isi)
      .slice(0, 6),
    keyakinan: lama?.keyakinan ?? 100,
    perluDosen: false,
    nilai: hitung.nilai,
    lengkap: hitung.lengkap,
    masalah: lama?.masalah ?? [],
    model: lama?.model ?? "dosen",
    penyedia: lama?.penyedia ?? ("gemini" as HasilSimpan["penyedia"]),
    versiPerintah: lama?.versiPerintah ?? "dosen",
    ms: lama?.ms ?? 0,
  };
}

// ------------------------------------------------------------
// PLAGIASI
// ------------------------------------------------------------

/** Kunci penasihat Postgres untuk penghitungan ulang satu tugas. */
const KUNCI_PLAGIASI = 54_001;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function jalankanPlagiasi(tx: Tx, tugas: BarisTugas) {
  const kiriman = await tx
    .select({
      id: cbtTaskSubmissions.id,
      markdown: cbtTaskSubmissions.markdown,
      fileHash: cbtTaskSubmissions.fileHash,
      similarityStatus: cbtTaskSubmissions.similarityStatus,
      decision: cbtTaskSubmissions.decision,
      name: cbtTaskSubmissions.name,
      receipt: cbtTaskSubmissions.receipt,
    })
    .from(cbtTaskSubmissions)
    .where(eq(cbtTaskSubmissions.taskId, tugas.id));

  const hasil = periksaPlagiasi(
    kiriman.map((k) => ({ id: k.id, teks: k.markdown, sidikBerkas: k.fileHash })),
    { tinjau: tugas.plagiarismReview, tinggi: tugas.plagiarismHigh },
    { abaikan: [tugas.instruction] },
  );

  await tx.delete(cbtTaskSimilarity).where(eq(cbtTaskSimilarity.taskId, tugas.id));
  for (let i = 0; i < hasil.pasangan.length; i += 400) {
    await tx.insert(cbtTaskSimilarity).values(hasil.pasangan.slice(i, i + 400).map((p) => ({
      taskId: tugas.id,
      subA: p.a,
      subB: p.b,
      score: p.skor,
      shareA: p.bagianA,
      shareB: p.bagianB,
      status: p.status,
      signals: JSON.stringify(p.sinyal),
    })));
  }
  // Satu pernyataan untuk seluruh ringkasan per kiriman, bukan satu per baris.
  for (let i = 0; i < kiriman.length; i += 500) {
    const potong = kiriman.slice(i, i + 500);
    const nilai = sql.join(potong.map((k) => {
      const r = hasil.ringkas.get(k.id) ?? { skor: 0, status: "bersih", lawan: null };
      return sql`(${k.id}::int, ${r.skor}::int, ${r.status}::varchar, ${r.lawan}::int)`;
    }), sql`, `);
    await tx.execute(sql`
      UPDATE cbt_task_submissions AS s
         SET similarity = v.skor, similarity_status = v.status, similar_to = v.lawan
        FROM (VALUES ${nilai}) AS v(id, skor, status, lawan)
       WHERE s.id = v.id AND s.task_id = ${tugas.id}`);
  }

  const baruDitandai = kiriman.filter((k) =>
    hasil.ringkas.get(k.id)?.status === "tinggi" && k.similarityStatus !== "tinggi" && !k.decision);
  return {
    pasangan: hasil.pasangan.length,
    ditandai: [...hasil.ringkas.values()].filter((r) => r.status === "tinggi").length,
    umum: hasil.umum,
    baruDitandai,
    maksId: kiriman.reduce((m, k) => Math.max(m, k.id), 0),
    jumlah: kiriman.length,
  };
}

/**
 * Kabari pemilik tugas tentang kiriman yang BARU terindikasi plagiasi.
 *
 * Hanya yang baru, supaya menghitung ulang tidak menimbun lonceng dengan
 * kabar yang sama. Dosen yang akunnya tersambung ke baris dosen menerimanya
 * sendiri; selebihnya dialamatkan ke Admin dan Super Admin.
 */
async function kabariPlagiasi(tugas: BarisTugas, baru: Array<{ name: string; receipt: string }>) {
  if (!baru.length) return;
  const nama = baru.slice(0, 6).map((k) => k.name || k.receipt).join(", ");
  const lebih = baru.length > 6 ? `, dan ${baru.length - 6} lainnya` : "";
  const judul = [tugas.courseName, tugas.taskNo && `Tugas ${tugas.taskNo}`, tugas.title].filter(Boolean).join(" · ") || tugas.code;
  await pushNotification({
    lecturerId: tugas.lecturerId ?? null,
    audienceRole: tugas.lecturerId ? null : "admin",
    kind: "plagiasi",
    severity: "urgent",
    title: `Indikasi plagiasi: ${judul}`,
    body: `${baru.length} kiriman terindikasi plagiasi (kesamaan isi ≥ ${tugas.plagiarismHigh}%): ${nama}${lebih}. Tinjau di CBT → Penilaian tugas.`,
    refCode: tugas.code,
  });
}

/** Hitung ulang SEKARANG, menunggu giliran bila sedang dihitung. Dipanggil dosen. */
export async function hitungUlangPlagiasi(tugas: BarisTugas) {
  const hasil = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${KUNCI_PLAGIASI}::int, ${tugas.id}::int)`);
    return jalankanPlagiasi(tx, tugas);
  });
  await kabariPlagiasi(tugas, hasil.baruDitandai);
  return hasil;
}

/**
 * Hitung ulang sesudah kiriman baru masuk, TANPA mengantre.
 *
 * Empat puluh mahasiswa yang mengumpulkan pada menit terakhir tidak boleh
 * saling menunggu penghitungan masing-masing. Bila sedang ada yang menghitung,
 * permintaan ini mundur; yang sedang menghitung memeriksa lagi sesudahnya
 * apakah ada kiriman yang masuk setelah ia mulai, dan bila ada, ia menghitung
 * sekali lagi. Dengan begitu kiriman terakhir selalu ikut terperiksa.
 */
export async function plagiasiSesudahKirim(taskId: number) {
  for (let putaran = 0; putaran < 6; putaran += 1) {
    const tugas = await tugasDariId(taskId);
    if (!tugas) return;
    const hasil = await db.transaction(async (tx) => {
      const kunci = await tx.execute<{ dapat: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(${KUNCI_PLAGIASI}::int, ${tugas.id}::int) AS dapat`,
      );
      if (!kunci.rows[0]?.dapat) return null;
      return jalankanPlagiasi(tx, tugas);
    });
    if (!hasil) return;
    await kabariPlagiasi(tugas, hasil.baruDitandai);
    const [terbaru] = await db
      .select({ maks: sql<number>`coalesce(max(${cbtTaskSubmissions.id}), 0)::int`, jumlah: sql<number>`count(*)::int` })
      .from(cbtTaskSubmissions)
      .where(eq(cbtTaskSubmissions.taskId, taskId));
    if ((terbaru?.maks ?? 0) <= hasil.maksId && (terbaru?.jumlah ?? 0) === hasil.jumlah) return;
  }
}
