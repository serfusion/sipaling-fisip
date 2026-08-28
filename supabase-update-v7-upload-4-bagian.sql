-- ============================================================
-- SiPaling FISIP — UPDATE DATABASE v7
-- 1) Upload Bukti Penyerahan Jurnal/Skripsi dibagi EMPAT bagian
-- 2) Kunci menu Cakrawala + kode akses
--
-- Jalankan SELURUH isi file ini di Supabase → SQL Editor → Run.
-- Aman dijalankan berulang kali.
-- ============================================================


-- ============================================================
-- BAGIAN 1 — TABEL LAMPIRAN BERNAMA (request_attachments)
-- ============================================================
--
-- Sebelumnya satu pengajuan hanya punya satu lampiran (kolom file_* pada
-- tabel service_requests). Kebutuhan "Upload Bukti Penyerahan Jurnal/Skripsi"
-- kini mengunggah empat berkas terpisah: cover s/d daftar isi, BAB I s/d
-- BAB V, daftar pustaka s/d selesai, dan skripsi full PDF.
--
-- Kolom file_* lama TETAP DIPAKAI: berkas skripsi full ikut disalin ke sana
-- supaya tiket lama maupun baru sama-sama punya satu lampiran utama, dan
-- tombol unduh yang sudah ada di dashboard tidak perlu diubah maknanya.

create table if not exists public.request_attachments (
  id                serial primary key,
  request_id        integer not null references public.service_requests(id) on delete cascade,
  part              varchar(40)  not null,
  label             varchar(160) not null,
  sort_order        integer      not null default 0,
  file_name         varchar(255) not null,
  file_mime         varchar(160) not null,
  file_size         integer      not null,
  file_storage_path text         not null,
  created_at        timestamptz  not null default now()
);

-- Laci detail tiket selalu mengambil lampiran milik SATU pengajuan, jadi
-- indeksnya mengikuti pola pemakaian itu.
create index if not exists request_attachments_request_idx
  on public.request_attachments (request_id, sort_order);

-- Satu bagian hanya boleh punya satu berkas per pengajuan; unggahan ulang
-- menimpa barisnya, bukan menumpuk.
create unique index if not exists request_attachments_part_uniq
  on public.request_attachments (request_id, part);

alter table public.request_attachments enable row level security;

-- Seluruh pembacaan berkas melewati route API yang sudah memeriksa peran
-- pengguna (canAccessServiceRequest), memakai service role key. Karena itu
-- tabel ini tidak membuka policy untuk anon/authenticated — sama seperti
-- tabel service_requests.


-- ============================================================
-- BAGIAN 2 — KUNCI MENU CAKRAWALA
-- ============================================================
--
-- Sama seperti mode maintenance, status kunci menumpang di tabel
-- public.app_settings pada satu baris dengan key = 'cakrawala_access'.
-- Aplikasi tetap berjalan tanpa baris ini (bawaannya: TERKUNCI, belum ada
-- kode). Baris di bawah hanya supaya isinya langsung terlihat saat diperiksa.

create table if not exists public.app_settings (
  key        varchar(64) primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- 'on conflict do nothing' dipakai dengan sengaja: bila Super Admin sudah
-- pernah membuat kode lewat dashboard, menjalankan ulang file ini TIDAK
-- menghapus kode-kode tersebut.
insert into public.app_settings (key, value)
values ('cakrawala_access', '{"locked":true,"codes":[]}')
on conflict (key) do nothing;


-- ============================================================
-- PEMERIKSAAN HASIL
-- ============================================================
select
  (select count(*) from public.request_attachments) as jumlah_lampiran_bernama,
  (select value from public.app_settings where key = 'cakrawala_access') as kunci_cakrawala;


-- ============================================================
-- CARA DARURAT LEWAT SQL
-- ============================================================
-- Membuka kunci Cakrawala untuk semua orang (mis. dashboard tidak terbuka):
--
--   update public.app_settings
--      set value = jsonb_set(value::jsonb, '{locked}', 'false')::text,
--          updated_at = now()
--    where key = 'cakrawala_access';
--
-- Menguncinya kembali: ganti 'false' menjadi 'true' pada perintah di atas.
--
-- Melihat daftar kode yang berlaku:
--
--   select jsonb_pretty(value::jsonb) from public.app_settings
--    where key = 'cakrawala_access';
