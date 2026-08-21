-- =====================================================================
-- SiPaling FISIP — TAMBAH AKUN ADMIN & DOSEN (sekali jalan)
-- Aman dijalankan berulang kali.
--
-- SEBELUM RUN: buat semua email di Supabase Dashboard →
-- Authentication → Users → Add user → Create new user
-- (centang "Auto Confirm User"). Password diatur di sana, BUKAN di sini.
--
-- Lalu ganti email & nama di BAGIAN 2 dan BAGIAN 3 di bawah, klik Run.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- BAGIAN 1 — Perbaikan wajib: daftarkan role 'admin_prodi'
-- (file supabase-login-fix.sql versi lama tanpa sengaja menghapus role
--  ini, sehingga akun Admin Prodi tidak bisa dibuat.)
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role in (
    'super_admin', 'admin', 'admin_umum', 'admin_akademik', 'admin_prodi',
    'admin_pddikti', 'admin_perpustakaan', 'admin_laboratorium', 'dosen'
  )
);

-- ---------------------------------------------------------------------
-- BAGIAN 2 — AKUN ADMIN
-- Format: ('email', 'Nama Lengkap', 'role')
-- Hapus baris yang tidak dipakai. Jangan ubah tulisan role-nya.
-- ---------------------------------------------------------------------
with account_config (email, full_name, role) as (
  values
    ('superadmin@umt.ac.id',    'Super Admin FISIP',        'super_admin'),
    ('adminfisip@umt.ac.id',    'Admin FISIP',              'admin'),
    ('umum@umt.ac.id',          'Admin Umum FISIP',         'admin_umum'),
    ('akademik@umt.ac.id',      'Admin Akademik FISIP',     'admin_akademik'),
    ('prodi@umt.ac.id',         'Admin Prodi FISIP',        'admin_prodi'),
    ('pddikti@umt.ac.id',       'Admin PDDIKTI FISIP',      'admin_pddikti'),
    ('perpustakaan@umt.ac.id',  'Admin Perpustakaan FISIP', 'admin_perpustakaan'),
    ('laboratorium@umt.ac.id',  'Admin Laboratorium FISIP', 'admin_laboratorium')
)
insert into public.profiles (id, email, full_name, role, lecturer_id, active)
select u.id, u.email, c.full_name, c.role, null, true
from account_config c
join auth.users u on lower(u.email) = lower(c.email)
on conflict (id) do update set
  email      = excluded.email,
  full_name  = excluded.full_name,
  role       = excluded.role,
  lecturer_id = null,
  active     = true,
  updated_at = now();

-- ---------------------------------------------------------------------
-- BAGIAN 3 — AKUN DOSEN
-- Format: ('email', 'Nama Lengkap + Gelar', 'Program Studi')
--
-- Skrip ini otomatis: (a) menambahkan dosen ke daftar "Dosen Tujuan"
-- yang dipilih mahasiswa, dan (b) menghubungkannya ke akun login,
-- sehingga dosen hanya melihat pengajuan yang ditujukan kepadanya.
--
-- Program Studi HARUS persis salah satu dari:
--   'Ilmu Komunikasi'  atau  'Ilmu Pemerintahan'
-- ---------------------------------------------------------------------
with dosen_config (email, full_name, study_program) as (
  values
    ('dosen.andi@umt.ac.id', 'Dr. Andi Contoh, M.I.Kom', 'Ilmu Komunikasi'),
    ('dosen.budi@umt.ac.id', 'Budi Contoh, S.IP., M.Si', 'Ilmu Pemerintahan')
),
lecturer_upsert as (
  insert into public.lecturers (name, study_program, active)
  select d.full_name, d.study_program, true from dosen_config d
  on conflict (name, study_program) do update set active = true
  returning id, name, study_program
)
insert into public.profiles (id, email, full_name, role, lecturer_id, active)
select u.id, u.email, d.full_name, 'dosen', l.id, true
from dosen_config d
join auth.users u on lower(u.email) = lower(d.email)
join lecturer_upsert l
  on l.name = d.full_name and l.study_program = d.study_program
on conflict (id) do update set
  email       = excluded.email,
  full_name   = excluded.full_name,
  role        = excluded.role,
  lecturer_id = excluded.lecturer_id,
  active      = true,
  updated_at  = now();

commit;

-- ---------------------------------------------------------------------
-- VERIFIKASI — semua akun yang berhasil akan tampil di sini.
-- Email yang TIDAK muncul berarti belum dibuat di Authentication → Users,
-- atau penulisan emailnya berbeda.
-- ---------------------------------------------------------------------
select
  p.email,
  p.full_name,
  p.role,
  p.active,
  l.name as dosen_tujuan,
  l.study_program
from public.profiles p
left join public.lecturers l on l.id = p.lecturer_id
order by case p.role
  when 'super_admin' then 1 when 'admin' then 2 when 'admin_umum' then 3
  when 'admin_akademik' then 4 when 'admin_prodi' then 5 when 'admin_pddikti' then 6
  when 'admin_perpustakaan' then 7 when 'admin_laboratorium' then 8 else 9
end, p.email;
