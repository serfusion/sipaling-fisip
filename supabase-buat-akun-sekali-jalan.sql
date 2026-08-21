-- =====================================================================
-- SiPaling FISIP — BUAT AKUN 100% DARI SQL EDITOR (tanpa buka
-- Authentication → Users). Email + password + role, sekali jalan.
--
-- CARA PAKAI:
--   1. Jalankan BLOK 0 SEKALI SAJA (memasang fungsi bantu).
--   2. Setelah itu, menambah akun = jalankan SATU BARIS di BLOK 1/2.
--
-- ⚠️ CATATAN PENTING:
--   • Cara ini menulis langsung ke tabel internal Supabase Auth —
--     pola yang umum dipakai komunitas, tapi bukan jalur resmi Supabase.
--     Kalau suatu saat sebuah akun tidak bisa login, buat ulang akun itu
--     lewat Dashboard → Authentication → Users, lalu jalankan skrip
--     "tambah-akun-satu-per-satu" untuk memasang role-nya.
--   • Password tertulis di query. SQL Editor menyimpan riwayat query,
--     jadi sebaiknya pakai password sementara lalu minta pengguna
--     menggantinya, dan hapus query dari riwayat setelah selesai
--     (ikon jam / history di SQL Editor).
-- =====================================================================


-- =====================================================================
-- BLOK 0 — PASANG FUNGSI BANTU (jalankan sekali; aman diulang)
-- =====================================================================
create extension if not exists pgcrypto;

-- Pastikan role admin_prodi terdaftar
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role in (
    'super_admin', 'admin', 'admin_umum', 'admin_akademik', 'admin_prodi',
    'admin_pddikti', 'admin_perpustakaan', 'admin_laboratorium', 'dosen'
  )
);

-- ---------------------------------------------------------------
-- Fungsi inti: buat/perbarui akun login + profil role sekaligus.
-- Kalau email sudah ada: password di-reset dan role diperbarui.
-- ---------------------------------------------------------------
create or replace function public.sipaling_buat_akun(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_lecturer_id integer default null
) returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid uuid;
  v_status text;
begin
  if length(coalesce(p_password, '')) < 8 then
    return 'GAGAL: password minimal 8 karakter.';
  end if;
  if p_role not in ('super_admin','admin','admin_umum','admin_akademik','admin_prodi',
                    'admin_pddikti','admin_perpustakaan','admin_laboratorium','dosen') then
    return 'GAGAL: role "' || p_role || '" tidak dikenal.';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(p_email);

  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token,
      is_super_admin
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated', lower(p_email),
      crypt(p_password, gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(),
      '', '', '', '', '', '', '', '',
      false
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', lower(p_email),
                         'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );
    v_status := 'DIBUAT';
  else
    update auth.users set
      encrypted_password = crypt(p_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      banned_until = null,
      updated_at = now()
    where id = v_uid;
    v_status := 'SUDAH ADA — password di-reset';
  end if;

  -- bersihkan profil lama yang memakai email sama tapi milik akun lain
  delete from public.profiles
  where lower(email) = lower(p_email) and id <> v_uid;

  insert into public.profiles (id, email, full_name, role, lecturer_id, active)
  values (v_uid, lower(p_email), p_full_name, p_role, p_lecturer_id, true)
  on conflict (id) do update set
    email = excluded.email, full_name = excluded.full_name,
    role = excluded.role, lecturer_id = excluded.lecturer_id,
    active = true, updated_at = now();

  return v_status || ': ' || lower(p_email) || ' → role ' || p_role;
end;
$$;

-- ---------------------------------------------------------------
-- Fungsi dosen: sekaligus mendaftarkan ke daftar "Dosen Tujuan"
-- di form mahasiswa dan menghubungkannya ke akun login.
-- ---------------------------------------------------------------
create or replace function public.sipaling_buat_dosen(
  p_email text,
  p_password text,
  p_full_name text,
  p_study_program text
) returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_lecturer_id integer;
begin
  if p_study_program not in ('Ilmu Komunikasi', 'Ilmu Pemerintahan') then
    return 'GAGAL: Program Studi harus persis ''Ilmu Komunikasi'' atau ''Ilmu Pemerintahan''.';
  end if;

  insert into public.lecturers (name, study_program, active)
  values (p_full_name, p_study_program, true)
  on conflict (name, study_program) do update set active = true
  returning id into v_lecturer_id;

  return public.sipaling_buat_akun(p_email, p_password, p_full_name, 'dosen', v_lecturer_id)
         || ' (Dosen Tujuan: ' || p_full_name || ' — ' || p_study_program || ')';
end;
$$;

-- ---------------------------------------------------------------
-- Fungsi pelengkap: ganti password & nonaktifkan akun.
-- ---------------------------------------------------------------
create or replace function public.sipaling_ganti_password(p_email text, p_password_baru text)
returns text language plpgsql security definer
set search_path = public, auth, extensions as $$
begin
  if length(coalesce(p_password_baru, '')) < 8 then
    return 'GAGAL: password minimal 8 karakter.';
  end if;
  update auth.users set encrypted_password = crypt(p_password_baru, gen_salt('bf')), updated_at = now()
  where lower(email) = lower(p_email);
  if not found then return 'GAGAL: email ' || p_email || ' tidak ditemukan.'; end if;
  return 'OK: password ' || lower(p_email) || ' diganti.';
end; $$;

create or replace function public.sipaling_nonaktifkan(p_email text)
returns text language plpgsql security definer
set search_path = public, auth, extensions as $$
begin
  update public.profiles set active = false, updated_at = now() where lower(email) = lower(p_email);
  update public.lecturers l set active = false
    from public.profiles p where p.lecturer_id = l.id and lower(p.email) = lower(p_email);
  update auth.users set banned_until = 'infinity', updated_at = now() where lower(email) = lower(p_email);
  if not found then return 'GAGAL: email ' || p_email || ' tidak ditemukan.'; end if;
  return 'OK: akun ' || lower(p_email) || ' dinonaktifkan.';
end; $$;
-- ================== AKHIR BLOK 0 ==================


-- =====================================================================
-- BLOK 1 — TAMBAH ADMIN: cukup satu baris, ganti isinya, Run.
-- Format: (email, password, nama lengkap, role)
-- Role: super_admin | admin | admin_umum | admin_akademik | admin_prodi
--       | admin_pddikti | admin_perpustakaan | admin_laboratorium
-- =====================================================================
select public.sipaling_buat_akun(
  'ilkomumt@umt.ac.id',       -- email
  'PasswordSementara123',     -- password (min. 8 karakter)
  'Admin Prodi Ilkom',        -- nama lengkap
  'admin_prodi'               -- role
);


-- =====================================================================
-- BLOK 2 — TAMBAH DOSEN: satu baris, otomatis masuk daftar Dosen Tujuan.
-- Format: (email, password, nama + gelar, program studi)
-- Program studi persis: 'Ilmu Komunikasi' atau 'Ilmu Pemerintahan'
-- =====================================================================
select public.sipaling_buat_dosen(
  'dosen.citra@umt.ac.id',
  'PasswordSementara123',
  'Citra Contoh, S.I.Kom., M.I.Kom',
  'Ilmu Komunikasi'
);


-- =====================================================================
-- BLOK 3 — GANTI PASSWORD
-- =====================================================================
-- select public.sipaling_ganti_password('email@umt.ac.id', 'PasswordBaru123');


-- =====================================================================
-- BLOK 4 — NONAKTIFKAN AKUN (tidak menghapus data)
-- =====================================================================
-- select public.sipaling_nonaktifkan('email@umt.ac.id');


-- =====================================================================
-- BLOK 5 — LIHAT SEMUA AKUN TERPASANG
-- =====================================================================
select p.email, p.full_name, p.role, p.active, l.name as dosen_tujuan
from public.profiles p
left join public.lecturers l on l.id = p.lecturer_id
order by case p.role
  when 'super_admin' then 1 when 'admin' then 2 when 'admin_umum' then 3
  when 'admin_akademik' then 4 when 'admin_prodi' then 5 when 'admin_pddikti' then 6
  when 'admin_perpustakaan' then 7 when 'admin_laboratorium' then 8 else 9
end, p.email;
