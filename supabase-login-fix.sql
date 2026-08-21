-- SiPaling FISIP — perbaikan role dan profil Admin Umum
-- Aman dijalankan lebih dari sekali.

begin;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (
    role in (
      'super_admin',
      'admin',
      'admin_umum',
      'admin_akademik',
      'admin_pddikti',
      'admin_perpustakaan',
      'admin_laboratorium',
      'dosen'
    )
  );

insert into public.profiles (id, email, full_name, role, active)
select
  id,
  email,
  'Admin Umum FISIP',
  'admin_umum',
  true
from auth.users
where lower(email) = lower('umumfisip@gmail.com')
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  active = true,
  updated_at = now();

commit;

-- Hasil harus satu baris dan auth_id harus sama dengan profile_id.
select
  u.id as auth_id,
  p.id as profile_id,
  u.email,
  p.full_name,
  p.role,
  p.active
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('umumfisip@gmail.com');
