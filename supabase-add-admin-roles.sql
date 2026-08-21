-- SiPaling FISIP — hubungkan akun Auth ke role pengelola
--
-- SEBELUM MENJALANKAN:
-- 1. Buat seluruh email di Supabase Dashboard → Authentication → Users.
-- 2. Ganti email contoh dan nama di bawah sesuai akun yang sudah dibuat.
-- 3. Password dibuat/diganti melalui Authentication, bukan tabel profiles.

with account_config (email, full_name, role) as (
  values
    ('superadmin@contoh.ac.id', 'Super Admin / Developer FISIP', 'super_admin'),
    ('admin@contoh.ac.id', 'Admin FISIP', 'admin'),
    ('akademik@contoh.ac.id', 'Admin Akademik FISIP', 'admin_akademik'),
    ('pddikti@contoh.ac.id', 'Admin PDDIKTI FISIP', 'admin_pddikti'),
    ('perpustakaan@contoh.ac.id', 'Admin Perpustakaan FISIP', 'admin_perpustakaan'),
    ('laboratorium@contoh.ac.id', 'Admin Laboratorium FISIP', 'admin_laboratorium')
)
insert into public.profiles (id, email, full_name, role, active)
select
  u.id,
  u.email,
  c.full_name,
  c.role,
  true
from account_config c
join auth.users u on lower(u.email) = lower(c.email)
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  active = true,
  updated_at = now();

-- Verifikasi hasil. Setiap akun yang berhasil harus tampil di sini.
select
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.active
from public.profiles p
where p.role in (
  'super_admin',
  'admin',
  'admin_akademik',
  'admin_pddikti',
  'admin_perpustakaan',
  'admin_laboratorium'
)
order by case p.role
  when 'super_admin' then 1
  when 'admin' then 2
  when 'admin_akademik' then 3
  when 'admin_pddikti' then 4
  when 'admin_perpustakaan' then 5
  when 'admin_laboratorium' then 6
  else 99
end;
