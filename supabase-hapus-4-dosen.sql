-- =====================================================================
-- SiPaling FISIP — HAPUS 4 DOSEN DARI DAFTAR "DOSEN TUJUAN"
-- Jalankan di Supabase → SQL Editor. Aman diulang.
--
-- Memakai active = false (BUKAN DELETE), supaya pengajuan lama yang
-- terlanjur menunjuk dosen ini tidak ikut rusak. Dosen yang aktif = false
-- otomatis hilang dari pilihan mahasiswa.
-- =====================================================================

-- 1) Lihat dulu siapa yang akan dinonaktifkan
select id, name, study_program, active
from public.lecturers
where name ilike '%Andi Restana%'
   or name ilike '%Hendra Wijaya%'
   or name ilike '%Maya Lestari%'
   or name ilike '%Rina Kurniawati%'
order by name;

-- 2) Nonaktifkan
update public.lecturers
set active = false
where name ilike '%Andi Restana%'
   or name ilike '%Hendra Wijaya%'
   or name ilike '%Maya Lestari%'
   or name ilike '%Rina Kurniawati%';

-- 3) Nonaktifkan juga akun login dosen tersebut (bila ada)
update public.profiles p
set active = false, updated_at = now()
from public.lecturers l
where p.lecturer_id = l.id and l.active = false;

-- 4) Verifikasi — daftar dosen yang MASIH tampil untuk mahasiswa
select name, study_program
from public.lecturers
where active = true
order by name;
