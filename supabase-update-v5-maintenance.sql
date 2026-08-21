-- ============================================================
-- SiPaling FISIP — UPDATE DATABASE v5: MODE MAINTENANCE
-- Jalankan SELURUH isi file ini di Supabase → SQL Editor → Run.
-- Aman dijalankan berulang kali.
-- ============================================================
--
-- Mode maintenance TIDAK memakai tabel baru. Statusnya menumpang di tabel
-- public.app_settings yang sudah ada sejak update v2, pada satu baris dengan
-- key = 'maintenance_mode' dan value berisi JSON.
--
-- Sebenarnya aplikasi sanggup berjalan tanpa menjalankan file ini sama
-- sekali: bila barisnya belum ada, kode memakai nilai bawaan (portal NORMAL,
-- pintu rahasia AKTIF). File ini berguna untuk dua hal:
--   1) memastikan tabel app_settings memang sudah ada; dan
--   2) menaruh baris awal supaya isinya langsung terlihat saat diperiksa.

-- 1) Jaring pengaman bila update v2 belum pernah dijalankan.
create table if not exists public.app_settings (
  key        varchar(64) primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- 2) Baris status maintenance.
--    'on conflict do nothing' dipakai dengan sengaja: kalau Super Admin sudah
--    pernah mengatur teksnya lewat dashboard, menjalankan ulang file ini
--    TIDAK akan menimpa pengaturan tersebut.
insert into public.app_settings (key, value)
values (
  'maintenance_mode',
  '{"enabled":false,"secretDoor":true,"lead":"Ssst… jangan berisik ya.","message":"Server kami sedang tidur siang ditemani kucing penjaga. Tim admin lagi mengelus-elus mesinnya biar cepat bangun. Data Anda aman, cuma ikut rebahan sebentar.","note":"Coba tengok lagi beberapa saat lagi"}'
)
on conflict (key) do nothing;

-- 3) Pemeriksaan hasil — jalankan bagian ini untuk melihat status sekarang.
select
  key,
  value,
  updated_at
from public.app_settings
where key = 'maintenance_mode';

-- ============================================================
-- CARA MENYALAKAN / MEMATIKAN
-- ============================================================
-- Cara normal: Dashboard → menu "Mode Maintenance" (hanya Super Admin).
--
-- Cara darurat lewat SQL (mis. dashboard tidak bisa dibuka) — MEMATIKAN
-- mode maintenance dan mengembalikan portal ke normal:
--
--   update public.app_settings
--      set value = jsonb_set(value::jsonb, '{enabled}', 'false')::text,
--          updated_at = now()
--    where key = 'maintenance_mode';
--
-- Untuk menyalakan, ganti 'false' menjadi 'true' pada perintah di atas.
