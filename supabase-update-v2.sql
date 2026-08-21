-- ============================================================
-- SiPaling FISIP — UPDATE DATABASE v2 (aman dijalankan berulang)
-- Jalankan SELURUH isi file ini di Supabase → SQL Editor → Run.
-- ============================================================

-- 1) Tabel pengaturan aplikasi (status layanan portal, dsb.)
create table if not exists public.app_settings (
  key        varchar(64) primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- 2) Tabel arsip dokumen hasil template (metadata + link Google Drive;
--    file PDF-nya sendiri disimpan di folder Drive admin, bukan di database)
create table if not exists public.generated_documents (
  id           serial primary key,
  unit_role    varchar(40)  not null,
  doc_type     varchar(120) not null,
  student_name varchar(160),
  nim          varchar(32),
  drive_url    text not null,
  created_by   varchar(160),
  created_at   timestamptz not null default now()
);

create index if not exists generated_documents_unit_role_idx
  on public.generated_documents (unit_role);

-- 3) Kunci keamanan (RLS) — termasuk 2 tabel baru di atas.
--    Aplikasi tidak terganggu: server mengakses lewat DATABASE_URL & secret key.
alter table public.lecturers           enable row level security;
alter table public.service_requests    enable row level security;
alter table public.revision_uploads    enable row level security;
alter table public.announcements      enable row level security;
alter table public.profiles            enable row level security;
alter table public.library_attendance  enable row level security;
alter table public.app_settings        enable row level security;
alter table public.generated_documents enable row level security;

-- 4) Role baru: admin_prodi (Layanan Prodi kini punya admin sendiri)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role in (
    'super_admin','admin','admin_umum','admin_akademik','admin_prodi',
    'admin_pddikti','admin_perpustakaan','admin_laboratorium','dosen'
  )
);

-- 5) Nilai awal status layanan portal (indikator hijau di halaman mahasiswa)
insert into public.app_settings (key, value)
values ('service_status', '{"status":"green","message":"Semua layanan aktif"}')
on conflict (key) do nothing;

-- Selesai. Hasil yang diharapkan: "Success. No rows returned".
