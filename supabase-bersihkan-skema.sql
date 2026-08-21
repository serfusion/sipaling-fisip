-- =====================================================================
-- SiPaling FISIP — BERSIHKAN TABEL LAMA & RAPIKAN SKEMA
-- Jalankan SEKALI di Supabase → SQL Editor.
--
-- Database kamu berisi sisa aplikasi VERSI LAMA yang sudah tidak dipakai
-- oleh kode di zip deploy:
--   • dosen            → duplikat dari lecturers
--   • pengajuan        → duplikat dari service_requests
--   • riwayat_revisi   → duplikat dari revision_uploads
--   • pengumuman       → duplikat dari announcements
--   • service_settings → duplikat dari app_settings
--   • kolom profiles.prodi & profiles.dosen_id → sisa versi lama
--   • kolom file_path di service_requests & revision_uploads → sisa lama
--     (versi sekarang memakai file_storage_path)
--
-- ⚠️ PERHATIAN SEBELUM RUN:
-- Skrip ini MENGHAPUS PERMANEN tabel-tabel lama beserta ISINYA.
-- Jalankan dulu BAGIAN A untuk melihat berapa baris data di dalamnya.
-- Kalau ada data lama yang masih kamu butuhkan (mis. pengajuan mahasiswa
-- dari sistem versi lama), ekspor dulu lewat Table Editor → Export CSV.
-- Kalau isinya cuma data uji coba, langsung lanjut BAGIAN B.
-- =====================================================================


-- =====================================================================
-- BAGIAN A — CEK DULU: berapa isi tabel lama yang akan dihapus?
-- =====================================================================
-- (Aman dijalankan kapan pun, termasuk setelah tabelnya terhapus.)
drop table if exists _cek_lama;
create temp table _cek_lama (tabel_lama text, jumlah_baris bigint);
do $$
declare t text; n bigint;
begin
  for t in select unnest(array['dosen','pengajuan','riwayat_revisi','pengumuman','service_settings']) loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into n;
      insert into _cek_lama values (t, n);
    else
      insert into _cek_lama values (t || ' (sudah terhapus)', 0);
    end if;
  end loop;
end $$;
select * from _cek_lama;


-- =====================================================================
-- BAGIAN B — PEMBERSIHAN (blok utama, jalankan setelah yakin)
-- =====================================================================
begin;

-- 1) Lepas dulu ketergantungan profiles ke tabel lama, lalu buang
--    kolom sisa versi lama.
alter table public.profiles drop constraint if exists profiles_dosen_id_fkey;
alter table public.profiles drop column if exists dosen_id;
alter table public.profiles drop column if exists prodi;

-- 2) Hapus tabel versi lama (urut dari anak ke induk).
drop table if exists public.riwayat_revisi;
drop table if exists public.pengajuan;
drop table if exists public.dosen;
drop table if exists public.pengumuman;
drop table if exists public.service_settings;

-- 3) Buang kolom file_path sisa lama (aplikasi memakai file_storage_path).
alter table public.service_requests drop column if exists file_path;
alter table public.revision_uploads drop column if exists file_path;

-- 4) Pastikan daftar role lengkap — termasuk admin_prodi yang hilang
--    dari constraint versi lama.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role in (
    'super_admin', 'admin', 'admin_umum', 'admin_akademik', 'admin_prodi',
    'admin_pddikti', 'admin_perpustakaan', 'admin_laboratorium', 'dosen'
  )
);

-- 5) Pastikan unique constraint lecturers ada (dibutuhkan skrip tambah
--    dosen agar tidak membuat duplikat nama).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lecturers_name_study_program_key'
      and conrelid = 'public.lecturers'::regclass
  ) then
    alter table public.lecturers
      add constraint lecturers_name_study_program_key unique (name, study_program);
  end if;
end $$;

-- 6) Pastikan nilai awal status layanan ada di app_settings.
insert into public.app_settings (key, value)
values ('service_status', '{"status":"green","message":"Semua layanan aktif"}')
on conflict (key) do nothing;

-- 7) Kunci keamanan (RLS) pada semua tabel yang tersisa.
alter table public.lecturers           enable row level security;
alter table public.service_requests    enable row level security;
alter table public.revision_uploads    enable row level security;
alter table public.announcements       enable row level security;
alter table public.profiles            enable row level security;
alter table public.library_attendance  enable row level security;
alter table public.app_settings        enable row level security;
alter table public.generated_documents enable row level security;

commit;


-- =====================================================================
-- BAGIAN C — VERIFIKASI AKHIR
-- Daftar tabel harus tinggal 8 ini saja:
-- announcements, app_settings, generated_documents, lecturers,
-- library_attendance, profiles, revision_uploads, service_requests
-- =====================================================================
select table_name
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;
