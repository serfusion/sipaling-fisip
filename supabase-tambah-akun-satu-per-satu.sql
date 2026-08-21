-- =====================================================================
-- SiPaling FISIP — TAMBAH AKUN SATU PER SATU
--
-- Cara pakai: salin SATU blok saja (A, B, atau C), ganti bagian
-- BERTANDA <<< , lalu Run di Supabase → SQL Editor.
-- Aman dijalankan berulang. Kalau salah, tinggal Run ulang.
--
-- SYARAT: email-nya sudah dibuat lebih dulu di
-- Authentication → Users → Add user (centang "Auto Confirm User").
-- =====================================================================


-- =====================================================================
-- BLOK 0 — WAJIB DIJALANKAN SEKALI SAJA (sebelum blok lain)
-- Mendaftarkan role 'admin_prodi' yang sebelumnya terhapus oleh
-- supabase-login-fix.sql versi lama.
-- =====================================================================
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role in (
    'super_admin', 'admin', 'admin_umum', 'admin_akademik', 'admin_prodi',
    'admin_pddikti', 'admin_perpustakaan', 'admin_laboratorium', 'dosen'
  )
);


-- =====================================================================
-- BLOK A — CEK DULU (jalankan kalau muncul error atau ragu)
-- Menampilkan kondisi sebuah email: sudah ada di Auth? sudah punya profil?
-- =====================================================================
select
  u.id            as auth_id,
  u.email         as email_di_authentication,
  p.id            as profile_id,
  p.full_name,
  p.role,
  p.active,
  case
    when u.id is null then 'BELUM ada di Authentication → Users. Buat dulu.'
    when p.id is null then 'Akun ada, profil/role belum dipasang.'
    when p.id = u.id  then 'Sudah benar.'
    else 'BENTROK: profil ini milik akun lain. Blok B/C akan membereskannya.'
  end as keterangan
from auth.users u
full outer join public.profiles p on lower(p.email) = lower(u.email)
where lower(coalesce(u.email, p.email)) = lower('ilkomumt@umt.ac.id');   -- <<< GANTI EMAIL


-- =====================================================================
-- BLOK B — TAMBAH SATU AKUN ADMIN
--
-- Ganti 3 hal: email (muncul 2x), nama lengkap, dan role.
-- Pilihan role (tulis persis):
--   super_admin | admin | admin_umum | admin_akademik | admin_prodi
--   admin_pddikti | admin_perpustakaan | admin_laboratorium
-- =====================================================================
begin;

-- Membersihkan profil lama yang memakai email sama tapi milik akun berbeda.
-- Inilah penyebab error "duplicate key ... profiles_email_key".
delete from public.profiles
where lower(email) = lower('ilkomumt@umt.ac.id')                          -- <<< EMAIL
  and id <> (select id from auth.users
             where lower(email) = lower('ilkomumt@umt.ac.id') limit 1);   -- <<< EMAIL (sama)

insert into public.profiles (id, email, full_name, role, lecturer_id, active)
select
  u.id,
  u.email,
  'Admin Prodi FISIP',        -- <<< NAMA LENGKAP
  'admin_prodi',              -- <<< ROLE
  null,
  true
from auth.users u
where lower(u.email) = lower('ilkomumt@umt.ac.id')                        -- <<< EMAIL (sama)
limit 1
on conflict (id) do update set
  email       = excluded.email,
  full_name   = excluded.full_name,
  role        = excluded.role,
  lecturer_id = excluded.lecturer_id,
  active      = true,
  updated_at  = now();

commit;

-- Verifikasi. Kalau 0 rows, berarti emailnya belum ada di Authentication → Users.
select email, full_name, role, active from public.profiles
where lower(email) = lower('ilkomumt@umt.ac.id');                         -- <<< EMAIL (sama)


-- =====================================================================
-- BLOK C — TAMBAH SATU AKUN DOSEN
--
-- Sekali jalan mengurus dua hal: (1) memasukkan dosen ke daftar
-- "Dosen Tujuan" yang dipilih mahasiswa di form, dan (2) menghubungkannya
-- ke akun login supaya dosen hanya melihat pengajuan miliknya.
--
-- Nama dosen muncul 3x dan harus PERSIS SAMA ketiganya.
-- Program Studi harus persis 'Ilmu Komunikasi' atau 'Ilmu Pemerintahan'.
-- =====================================================================
begin;

delete from public.profiles
where lower(email) = lower('dosen.citra@umt.ac.id')                       -- <<< EMAIL
  and id <> (select id from auth.users
             where lower(email) = lower('dosen.citra@umt.ac.id') limit 1);-- <<< EMAIL (sama)

-- Daftarkan ke daftar dosen tujuan
insert into public.lecturers (name, study_program, active)
values (
  'Citra Contoh, S.I.Kom., M.I.Kom',   -- <<< NAMA DOSEN (1 dari 3)
  'Ilmu Komunikasi',                   -- <<< PROGRAM STUDI (1 dari 2)
  true
)
on conflict (name, study_program) do update set active = true;

-- Hubungkan akun login ke entri dosen di atas
insert into public.profiles (id, email, full_name, role, lecturer_id, active)
select
  u.id,
  u.email,
  'Citra Contoh, S.I.Kom., M.I.Kom',   -- <<< NAMA DOSEN (2 dari 3)
  'dosen',
  (select id from public.lecturers
    where name = 'Citra Contoh, S.I.Kom., M.I.Kom'   -- <<< NAMA DOSEN (3 dari 3)
      and study_program = 'Ilmu Komunikasi'),        -- <<< PROGRAM STUDI (2 dari 2)
  true
from auth.users u
where lower(u.email) = lower('dosen.citra@umt.ac.id')                     -- <<< EMAIL (sama)
limit 1
on conflict (id) do update set
  email       = excluded.email,
  full_name   = excluded.full_name,
  role        = excluded.role,
  lecturer_id = excluded.lecturer_id,
  active      = true,
  updated_at  = now();

commit;

-- Verifikasi. Kolom dosen_tujuan harus terisi, bukan kosong.
select p.email, p.full_name, p.role, l.name as dosen_tujuan, l.study_program
from public.profiles p
left join public.lecturers l on l.id = p.lecturer_id
where lower(p.email) = lower('dosen.citra@umt.ac.id');                    -- <<< EMAIL (sama)


-- =====================================================================
-- BLOK D — LIHAT SEMUA AKUN YANG SUDAH TERPASANG
-- =====================================================================
select p.email, p.full_name, p.role, p.active, l.name as dosen_tujuan
from public.profiles p
left join public.lecturers l on l.id = p.lecturer_id
order by case p.role
  when 'super_admin' then 1 when 'admin' then 2 when 'admin_umum' then 3
  when 'admin_akademik' then 4 when 'admin_prodi' then 5 when 'admin_pddikti' then 6
  when 'admin_perpustakaan' then 7 when 'admin_laboratorium' then 8 else 9
end, p.email;
