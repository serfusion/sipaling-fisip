# Cara Menambahkan Akun Pengelola SiPaling FISIP

Urutan role aplikasi:

1. `super_admin` — Super Admin / Developer, akses tertinggi
2. `admin` — Admin utama
3. `admin_umum`, `admin_akademik`, `admin_pddikti`,
   `admin_perpustakaan`, dan `admin_laboratorium` — admin unit setingkat
4. `dosen` — Dosen

`admin_umum` tidak dimasukkan kembali dalam skrip karena akun tersebut sudah
dibuat sebelumnya.

## Langkah 1 — Buat akun dan password

1. Buka Supabase Dashboard.
2. Pilih **Authentication → Users → Add user → Create new user**.
3. Masukkan email dan password akun.
4. Aktifkan **Auto Confirm User** jika akun harus langsung dapat digunakan.
5. Ulangi untuk Super Admin, Admin, Akademik, PDDIKTI, Perpustakaan, dan
   Laboratorium.

Password hanya disimpan oleh Supabase Authentication. Jangan memasukkan
password ke SQL, GitHub, tabel `profiles`, atau environment Netlify.

## Langkah 2 — Hubungkan akun dengan role

1. Buka file `supabase-add-admin-roles.sql`.
2. Pada bagian `account_config`, ganti semua email contoh dengan email Auth
   yang baru dibuat.
3. Sesuaikan nama lengkap jika diperlukan.
4. Buka **SQL Editor → New query**, tempel seluruh SQL, lalu klik **Run**.

Baris yang tampil pada hasil verifikasi adalah akun yang berhasil dihubungkan.
Jika suatu email tidak tampil, pastikan email tersebut sudah ada di
**Authentication → Users** dan penulisannya sama.

## Langkah 3 — Tes login

1. Buka `https://sipalingfisip.web.id/login` dalam jendela Incognito.
2. Masuk menggunakan email dan password masing-masing akun.
3. Buka `/api/auth/me` setelah login dan pastikan `profile.role` sesuai.

## Mengganti password

Buka **Authentication → Users**, pilih pengguna, kemudian gunakan pilihan
untuk mengirim password recovery atau memperbarui password. Mengubah data pada
`public.profiles` tidak akan mengubah password.
