# Perbaikan Login dan Deploy SiPaling FISIP

Paket ini memperbaiki sesi login Supabase agar cookie dapat dibaca oleh
Next.js/Netlify, menghubungkan profil melalui UUID `auth.users.id`, dan
mendukung seluruh role SiPaling FISIP.

## 1. Jalankan perbaikan Supabase

1. Buka Supabase Dashboard → **SQL Editor** → **New query**.
2. Salin seluruh isi `supabase-login-fix.sql`.
3. Klik **Run**.
4. Hasil terakhir harus menampilkan satu baris untuk `umumfisip@gmail.com`.
5. Pastikan `auth_id` sama dengan `profile_id`, `role` berisi
   `admin_umum`, dan `active` berisi `true`.

## 2. Periksa environment variable pada site Netlify yang aktif

Buka site Netlify yang memiliki domain `sipalingfisip.web.id`, lalu buka
**Site configuration → Environment variables**. Isi:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (atau nama lama
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SECRET_KEY` (atau nama lama `SUPABASE_SERVICE_ROLE_KEY`)
- `DATABASE_URL`
- `NEXT_PUBLIC_SURAT_LAINNYA_DRIVE_URL` — URL folder Google Drive untuk
  upload dokumen pada kebutuhan **Surat Lainnya**
- `NEXT_PUBLIC_PERPUS_DRIVE_URL` — URL folder Google Drive milik
  perpustakaan, tempat mahasiswa mengunggah berkas penyerahan skripsi

Secret key hanya boleh berada di Netlify. Jangan menaruhnya di source code,
GitHub, atau variable yang diawali `NEXT_PUBLIC_`.

## 3. Upload versi perbaikan ke GitHub

Ekstrak paket ini. Salin seluruh isinya ke folder repository lokal Anda,
misalnya `C:\Users\FISIP(3)\Downloads\NEW`, lalu jalankan Command Prompt dari
folder tersebut:

```bat
git status
git add .
git commit -m "Fix Supabase login session and roles"
git push origin main
```

Jika muncul `nothing to commit`, berarti file belum disalin ke folder repo
yang memiliki subfolder `.git`.

## 4. Deploy ulang di Netlify

Push GitHub biasanya memicu deploy otomatis. Jika belum:

1. Netlify → site `sipalingfisip.web.id` → **Deploys**.
2. Pilih **Trigger deploy → Clear cache and deploy site**.
3. Tunggu sampai status **Published**.

## 5. Tes login

1. Buka jendela Incognito/Private.
2. Masuk ke `https://sipalingfisip.web.id/login`.
3. Login dengan akun Auth `umumfisip@gmail.com`.
4. Setelah berhasil, buka `https://sipalingfisip.web.id/api/auth/me`.

Saat belum login, `profile:null` adalah normal. Setelah login, respons harus
memuat objek `profile` dengan `role:"admin_umum"`, lalu dashboard dapat dibuka.

## Struktur role

1. `super_admin` — Super Admin / Developer
2. `admin` — Admin utama
3. `admin_umum`, `admin_akademik`, `admin_pddikti`,
   `admin_perpustakaan`, `admin_laboratorium` — admin unit setingkat
4. `dosen` — Dosen

## Catatan keamanan

Kunci rahasia yang pernah dibagikan di chat atau tersimpan dalam berkas lama
harus dirotasi dari Supabase Dashboard. Setelah rotasi, perbarui nilainya hanya
di site Netlify yang aktif dan lakukan deploy ulang.
