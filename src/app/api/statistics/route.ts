import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/supabase-server";
import { PROPOSAL_STATUS } from "@/lib/academic";
import { explainServerError } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Seluruh angka dasbor dihitung di sini dengan query agregat. Tidak ada
// tabel baru: semuanya berasal dari service_requests, title_proposals,
// document_records, dan document_contributors.
//
// Catatan waktu: seluruh pengelompokan harian/jam memakai zona Asia/Jakarta
// supaya "pukul 10" berarti pukul 10 WIB, bukan UTC.
const TZ = "Asia/Jakarta";

// Role yang boleh melihat statistik. Dosen tidak termasuk: angkanya
// menyangkut seluruh fakultas, bukan bimbingannya sendiri.
const ADMIN_ROLES = [
  "super_admin", "admin", "admin_umum", "admin_akademik",
  "admin_prodi", "admin_pddikti", "admin_perpustakaan", "admin_laboratorium",
];

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

async function rows(query: ReturnType<typeof sql>): Promise<Row[]> {
  const result = await db.execute(query);
  return (result as unknown as { rows?: Row[] }).rows ?? (result as unknown as Row[]);
}

// Bagian pengajuan judul dan database dokumen memakai tabel dari migrasi v4.
// Bila migrasi itu belum dijalankan, tabelnya belum ada. Dasbor tetap
// menampilkan bagian yang datanya sudah tersedia, bukan gagal seluruhnya.
// Hanya "tabel tidak ada" (42P01) yang dimaafkan — kegagalan lain tetap 500
// supaya masalah sungguhan tidak tersembunyi di balik angka nol.
const TABEL_TIDAK_ADA = "42P01";

// Drizzle membungkus galat pg di dalam DrizzleQueryError, sehingga kode
// aslinya tidak ada di error.code melainkan di error.cause. Rantai cause
// ditelusuri agar pemeriksaannya tidak bergantung pada satu lapis pembungkus.
function kodeGalat(error: unknown): string | undefined {
  let current = error;
  for (let lapis = 0; lapis < 5 && current; lapis += 1) {
    const kode = (current as { code?: unknown }).code;
    if (typeof kode === "string") return kode;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

async function rowsOpsional(query: ReturnType<typeof sql>): Promise<Row[]> {
  try {
    return await rows(query);
  } catch (error: unknown) {
    if (kodeGalat(error) === TABEL_TIDAK_ADA) {
      console.warn("statistics: tabel migrasi v4 belum ada, bagian ini dilewati");
      return [];
    }
    throw error;
  }
}

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !ADMIN_ROLES.includes(profile.role)) {
      return Response.json({ success: false, message: "Halaman statistik hanya untuk admin." }, { status: 403 });
    }

    const [
      ringkasanRows, unitRows, corongRows, bimbinganRows, topDosenRows,
      prodiRows, petaRows, pddiktiRows, luaranRows, komposisiRows, cakupanRows,
    ] = await Promise.all([
      // --- Ringkasan bulan berjalan + pembanding bulan lalu ---
      rows(sql`
        with bulan as (
          select date_trunc('month', now() at time zone ${TZ}) as awal
        )
        select
          (select count(*) from service_requests, bulan
             where created_at at time zone ${TZ} >= awal)::int as tiket_bulan_ini,
          (select count(*) from service_requests, bulan
             where created_at at time zone ${TZ} >= awal - interval '1 month'
               and created_at at time zone ${TZ} < awal)::int as tiket_bulan_lalu,
          (select count(distinct nim) from service_requests, bulan
             where created_at at time zone ${TZ} >= awal)::int as mahasiswa_unik,
          (select count(*) from service_requests
             where status not in ('Selesai','Ditolak')
               and created_at < now() - interval '7 days')::int as menggantung,
          (select percentile_cont(0.5) within group (
                    order by extract(epoch from (updated_at - created_at)) / 86400.0)
             from service_requests, bulan
             where status = 'Selesai' and created_at at time zone ${TZ} >= awal) as median_hari,
          (select count(*) filter (where status = 'Selesai')::numeric
                  / nullif(count(*), 0) * 100
             from service_requests, bulan
             where created_at at time zone ${TZ} >= awal) as tuntas_persen
      `),

      // --- Papan nilai per unit layanan ---
      rows(sql`
        select
          service_type as unit,
          count(*)::int as tiket,
          percentile_cont(0.5) within group (
            order by case when status = 'Selesai'
                     then extract(epoch from (updated_at - created_at)) / 86400.0 end) as median_hari,
          (count(*) filter (where status = 'Selesai')::numeric / nullif(count(*), 0) * 100) as tuntas_persen,
          count(*) filter (
            where status not in ('Selesai','Ditolak') and created_at < now() - interval '7 days')::int as menggantung
        from service_requests
        where created_at > now() - interval '6 months'
        group by service_type
        order by count(*) desc
      `),

      // --- Corong pengajuan judul ---
      rowsOpsional(sql`
        select
          count(*)::int as diajukan,
          count(*) filter (where finance_verified and eligibility_verified)::int as lolos_berkas,
          count(*) filter (where status = ${PROPOSAL_STATUS.acceptedLecturer})::int as diterima,
          count(*) filter (where status = ${PROPOSAL_STATUS.rejectedLecturer})::int as ditolak_dosen,
          count(*) filter (where status = ${PROPOSAL_STATUS.rejectedProdi})::int as ditolak_prodi
        from title_proposals
      `),

      // --- Cakupan dosen membimbing ---
      rowsOpsional(sql`
        select
          (select count(*) from lecturers where active)::int as total_dosen,
          (select count(distinct approved_lecturer_id) from title_proposals
             where approved_lecturer_id is not null
               and status = ${PROPOSAL_STATUS.acceptedLecturer})::int as membimbing
      `),

      // --- Dosen dengan bimbingan terbanyak ---
      rowsOpsional(sql`
        select l.name as nama, count(*)::int as jumlah
        from title_proposals p
        join lecturers l on l.id = p.approved_lecturer_id
        where p.status = ${PROPOSAL_STATUS.acceptedLecturer}
        group by l.name
        order by count(*) desc, l.name
        limit 8
      `),

      // --- Perbandingan program studi ---
      rowsOpsional(sql`
        select
          s.study_program as prodi,
          count(*)::int as tiket,
          count(distinct s.nim)::int as mahasiswa,
          (select count(*) from title_proposals t where t.study_program = s.study_program)::int as pengajuan,
          (select count(*) from title_proposals t
             where t.study_program = s.study_program
               and t.status = ${PROPOSAL_STATUS.acceptedLecturer})::int as diterima
        from service_requests s
        where s.created_at > now() - interval '1 month'
        group by s.study_program
        order by count(*) desc
      `),

      // --- Peta panas hari x jam (WIB, Senin-Jumat, 08.00-16.00) ---
      rows(sql`
        select
          extract(isodow from created_at at time zone ${TZ})::int as hari,
          extract(hour   from created_at at time zone ${TZ})::int as jam,
          count(*)::int as jumlah
        from service_requests
        where created_at > now() - interval '3 months'
          and extract(isodow from created_at at time zone ${TZ}) between 1 and 5
          and extract(hour   from created_at at time zone ${TZ}) between 8 and 16
        group by 1, 2
      `),

      // --- Tren PDDIKTI enam bulan (turun = data makin bersih) ---
      rows(sql`
        select
          to_char(date_trunc('month', created_at at time zone ${TZ}), 'YYYY-MM') as bulan,
          count(*)::int as jumlah
        from service_requests
        where service_type = 'Layanan PDDIKTI'
          and created_at > now() - interval '6 months'
        group by 1 order by 1
      `),

      // --- Luaran akademik per tahun ---
      rowsOpsional(sql`
        select
          coalesce(nullif(left(document_date, 4), ''),
                   to_char(created_at at time zone ${TZ}, 'YYYY')) as tahun,
          category as kategori,
          count(*)::int as jumlah
        from document_records
        group by 1, 2 order by 1
      `),

      // --- Komposisi isi database dokumen ---
      rowsOpsional(sql`
        select category as kategori, count(*)::int as jumlah
        from document_records group by 1 order by count(*) desc
      `),

      // --- Cakupan dosen punya luaran ---
      rowsOpsional(sql`
        select
          (select count(*) from lecturers where active)::int as total_dosen,
          (select count(distinct lecturer_id) from document_contributors)::int as punya_luaran
      `),
    ]);

    const r = ringkasanRows[0] || {};
    const c = corongRows[0] || {};
    const b = bimbinganRows[0] || {};
    const k = cakupanRows[0] || {};

    const tiketBulanIni = num(r.tiket_bulan_ini);
    const tiketBulanLalu = num(r.tiket_bulan_lalu);
    const totalDosen = num(b.total_dosen);
    const diajukan = num(c.diajukan);

    return Response.json({
      success: true,
      ringkasan: {
        tiketBulanIni,
        tiketBulanLalu,
        deltaPersen: tiketBulanLalu ? Math.round(((tiketBulanIni - tiketBulanLalu) / tiketBulanLalu) * 100) : null,
        mahasiswaUnik: num(r.mahasiswa_unik),
        menggantung: num(r.menggantung),
        medianHari: r.median_hari === null ? null : Number(Number(r.median_hari).toFixed(1)),
        tuntasPersen: r.tuntas_persen === null ? null : Math.round(Number(r.tuntas_persen)),
      },
      cincin: {
        tuntas: r.tuntas_persen === null ? null : Math.round(Number(r.tuntas_persen)),
        judulLolos: diajukan ? Math.round((num(c.lolos_berkas) / diajukan) * 100) : null,
        dosenMembimbing: totalDosen ? Math.round((num(b.membimbing) / totalDosen) * 100) : null,
        dosenLuaran: num(k.total_dosen) ? Math.round((num(k.punya_luaran) / num(k.total_dosen)) * 100) : null,
      },
      unit: unitRows.map((row) => ({
        unit: String(row.unit),
        tiket: num(row.tiket),
        medianHari: row.median_hari === null ? null : Number(Number(row.median_hari).toFixed(1)),
        tuntasPersen: row.tuntas_persen === null ? null : Math.round(Number(row.tuntas_persen)),
        menggantung: num(row.menggantung),
      })),
      corong: {
        diajukan,
        lolosBerkas: num(c.lolos_berkas),
        diterima: num(c.diterima),
        ditolakDosen: num(c.ditolak_dosen),
        ditolakProdi: num(c.ditolak_prodi),
      },
      bimbingan: {
        totalDosen,
        membimbing: num(b.membimbing),
        belum: Math.max(0, totalDosen - num(b.membimbing)),
        top: topDosenRows.map((row) => ({ nama: String(row.nama), jumlah: num(row.jumlah) })),
      },
      prodi: prodiRows.map((row) => ({
        prodi: String(row.prodi),
        tiket: num(row.tiket),
        mahasiswa: num(row.mahasiswa),
        tiketPerMahasiswa: num(row.mahasiswa) ? Number((num(row.tiket) / num(row.mahasiswa)).toFixed(1)) : 0,
        pengajuan: num(row.pengajuan),
        diterima: num(row.diterima),
      })),
      peta: petaRows.map((row) => ({ hari: num(row.hari), jam: num(row.jam), jumlah: num(row.jumlah) })),
      pddikti: pddiktiRows.map((row) => ({ bulan: String(row.bulan), jumlah: num(row.jumlah) })),
      luaran: luaranRows.map((row) => ({
        tahun: String(row.tahun), kategori: String(row.kategori), jumlah: num(row.jumlah),
      })),
      komposisi: komposisiRows.map((row) => ({ kategori: String(row.kategori), jumlah: num(row.jumlah) })),
      cakupan: { totalDosen: num(k.total_dosen), punyaLuaran: num(k.punya_luaran) },
    });
  } catch (error: unknown) {
    console.error("statistics", error);
    return Response.json(
      { success: false, message: explainServerError(error, "Statistik belum dapat dihitung.") },
      { status: 500 },
    );
  }
}
