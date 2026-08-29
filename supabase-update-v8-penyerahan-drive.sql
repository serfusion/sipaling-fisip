-- ============================================================
-- SiPaling FISIP — UPDATE DATABASE v8
-- Penyerahan skripsi/jurnal ke perpustakaan pindah ke Google Drive
--
-- Jalankan SELURUH isi file ini di Supabase → SQL Editor → Run.
-- Aman dijalankan berulang kali.
-- ============================================================


-- ============================================================
-- KOLOM drive_url PADA service_requests
-- ============================================================
--
-- Sebelumnya empat berkas skripsi diunggah ke penyimpanan portal. Satu
-- mahasiswa bisa memakai puluhan MB dan kuota cepat penuh.
--
-- Sekarang berkasnya diunggah mahasiswa ke folder Google Drive milik
-- perpustakaan, dan portal hanya menyimpan tautannya di kolom ini. Kolomnya
-- kosong (null) untuk semua layanan lain.
--
-- Portal tetap berjalan walau perintah ini belum dijalankan: selama kolomnya
-- belum ada, tautan Drive menumpang di catatan mahasiswa dengan awalan
-- "[DRIVE]". Setelah dijalankan, tautannya masuk ke kolom sendiri.

alter table public.service_requests
  add column if not exists drive_url text;

-- Dipakai admin perpustakaan untuk menyaring tiket yang sudah menyertakan
-- tautan; parsial supaya indeksnya hanya memuat baris yang relevan.
create index if not exists service_requests_drive_idx
  on public.service_requests (created_at desc)
  where drive_url is not null;


-- ============================================================
-- NAMA KEBUTUHAN YANG BERUBAH
-- ============================================================
--
-- "Upload Bukti Penyerahan Jurnal/Skripsi" kini bernama
-- "Penyerahan Skripsi/Jurnal". Tiket lama ikut diseragamkan supaya
-- penyaringan di dashboard tidak perlu mengenal dua nama.
--
-- Berkas tiket lama TIDAK tersentuh: yang sudah ada di request_attachments
-- tetap dapat diunduh admin seperti biasa.

update public.service_requests
   set service_need = 'Penyerahan Skripsi/Jurnal'
 where service_type = 'Layanan Perpustakaan'
   and service_need = 'Upload Bukti Penyerahan Jurnal/Skripsi';


-- ============================================================
-- PEMERIKSAAN HASIL
-- ============================================================
select
  (select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_requests'
      and column_name = 'drive_url')                       as kolom_drive_url_ada,
  (select count(*) from public.service_requests
    where drive_url is not null)                           as tiket_dengan_tautan_drive,
  (select count(*) from public.service_requests
    where service_need = 'Penyerahan Skripsi/Jurnal')      as tiket_penyerahan;
