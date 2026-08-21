# SUPABASE STEP-BY-STEP — SiPaling FISIP
## Project Anda: wbhsgnidqxqtnruicuuh

Panduan **paling detail** dari awal sampai aplikasi bisa login dengan data Anda.

---

## DATA SUPABASE ANDA (jangan diubah)

| Item | Nilai |
|---|---|
| Project URL | `https://wbhsgnidqxqtnruicuuh.supabase.co` |
| Publishable Key | `sb_publishable_H2MdqSrW72qgU8bTI4J-LA_7CL17Lpc` |
| Anon public | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |
| service_role | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |
| Direct Connection String | `postgresql://postgres:[YOUR-PASSWORD]@db.wbhsgnidqxqtnruicuuh.supabase.co:5432/postgres` |
| CLI Command | `supabase login` → `supabase init` → `supabase link --project-ref wbhsgnidqxqtnruicuuh` |

---

## LANGKAH 1 — BUKA SUPABASE DASHBOARD

1. Buka browser (Chrome/Firefox/Edge)
2. Ketik: **https://supabase.com**
3. Klik tombol **Sign in** (pojok kanan atas)
4. Login pakai akun GitHub atau Email yang Anda pakai saat membuat project
5. Setelah login, Anda akan melihat daftar project
6. **Klik kartu project** yang bertuliskan:
   - `wbhsgnidqxqtnruicuuh`
   - Atau nama project Anda

Anda sekarang berada di dashboard project.

---

## LANGKAH 2 — JALANKAN SCHEMA DATABASE

### 2.1 Buka SQL Editor
- Di sidebar kiri, klik ikon **SQL Editor** (ikon database dengan tanda petik)
- Klik tombol **New query** (pojok kanan atas)

### 2.2 Copy & Paste Schema
1. Buka file `supabase-setup.sql` di folder project SiPaling FISIP
2. **Pilih semua** (Ctrl+A / Cmd+A)
3. **Copy** (Ctrl+C / Cmd+C)
4. Kembali ke Supabase SQL Editor
5. **Paste** (Ctrl+V / Cmd+V)

### 2.3 Jalankan
- Klik tombol **Run** (pojok kanan bawah) atau tekan `Ctrl+Enter`
- Tunggu sampai muncul tulisan **"Success. No rows returned"** (hijau)
- Jika ada error, screenshot dan kirim ke saya

### 2.4 Verifikasi Tabel
- Klik menu **Table Editor** di sidebar kiri
- Anda harus melihat 6 tabel:
  1. `lecturers`
  2. `service_requests`
  3. `revision_uploads`
  4. `announcements`
  5. `profiles`
  6. `library_attendance` (baru)
- Buka tabel `lecturers` → harus ada 4 dosen contoh

---

## LANGKAH 3 — AMBIL PASSWORD DATABASE

### 3.1 Buka Database Settings
- Sidebar kiri → **Project Settings** (ikon gear ⚙️)
- Klik tab **Database**

### 3.2 Cari Password
- Scroll ke bawah sampai ketemu **"Database password"**
- Jika ada tombol **Reset database password**, klik itu
- **Simpan password** di tempat aman (Notepad / Password Manager)
- Password ini akan dipakai untuk `DATABASE_URL`

### 3.3 Ambil Connection String
- Masih di halaman Database
- Cari bagian **Connection string**
- Pilih tab **URI**
- Anda akan melihat:
  ```
  postgresql://postgres:[YOUR-PASSWORD]@db.wbhsgnidqxqtnruicuuh.supabase.co:5432/postgres
  ```
- Ganti `[YOUR-PASSWORD]` dengan password yang baru saja Anda reset
- **Salin** string ini (nanti dipakai di Netlify)

---

## LANGKAH 4 — AMBIL API KEYS

### 4.1 Buka API Settings
- Sidebar kiri → **Project Settings**
- Klik tab **API** (atau **Data API**)

### 4.2 Catat 3 Nilai Ini

| Nama | Nilai yang Harus Disalin |
|---|---|
| **Project URL** | `https://wbhsgnidqxqtnruicuuh.supabase.co` (sudah ada di atas) |
| **anon public** | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |
| **service_role** | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |

⚠️ **PENTING**:
- `service_role` adalah kunci super admin. JANGAN pernah publish ke publik.
- Hanya boleh dipakai di server (Netlify Environment Variables).

---

## LANGKAH 5 — BUAT USER SUPER ADMIN

### 5.1 Buka Authentication
- Sidebar kiri → **Authentication**
- Tab **Users**

### 5.2 Buat User Baru
1. Klik tombol **Add user** (pojok kanan atas)
2. Pilih **Create new user**
3. Isi form:
   - **Email:** `superadmin@kampus.ac.id` (atau email Anda)
   - **Password:** minimal 8 karakter, kombinasi huruf+angka
   - **Auto Confirm User:** ✅ centang
4. Klik **Create user**
5. User sekarang muncul di daftar

### 5.3 Daftarkan ke Tabel `profiles`
1. Kembali ke **SQL Editor**
2. Klik **New query**
3. Paste query berikut (GANTI email jika berbeda):

```sql
INSERT INTO profiles (id, email, full_name, role, active)
VALUES (
  gen_random_uuid()::text,
  'superadmin@kampus.ac.id',        -- GANTI dengan email yang Anda buat
  'Super Admin FISIP',              -- GANTI dengan nama Anda
  'super_admin',
  true
);
```

4. Klik **Run**
5. Harus muncul: **"Success. 1 row inserted"**

### 5.4 (Opsional) Buat Admin & Dosen
Ulangi langkah 5.2 + 5.3 dengan role berbeda:

```sql
-- Admin biasa
INSERT INTO profiles (id, email, full_name, role, active)
VALUES (gen_random_uuid()::text, 'admin@kampus.ac.id', 'Admin FISIP', 'admin', true);

-- Dosen (hubungkan ke lecturer_id = 1)
INSERT INTO profiles (id, email, full_name, role, lecturer_id, active)
VALUES (gen_random_uuid()::text, 'dosen@kampus.ac.id', 'Dr. Rina Kurniawati', 'dosen', 1, true);
```

---

## LANGKAH 6 — SET ENVIRONMENT VARIABLES DI NETLIFY

### 6.1 Buka Netlify
1. Buka **https://app.netlify.com**
2. Login
3. Klik nama situs SiPaling FISIP Anda

### 6.2 Buka Environment Variables
- Sidebar kiri → **Site configuration**
- Klik **Environment variables**

### 6.3 Tambahkan 4 Variabel

Klik **Add a variable** → isi satu per satu:

| Key | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@db.wbhsgnidqxqtnruicuuh.supabase.co:5432/postgres?pgbouncer=true` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wbhsgnidqxqtnruicuuh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |
| `SUPABASE_SERVICE_ROLE_KEY` | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |

**Catatan penting:**
- Ganti `[PASSWORD]` di `DATABASE_URL` dengan password dari Langkah 3
- `?pgbouncer=true` WAJIB ada di akhir `DATABASE_URL`

### 6.4 Simpan
- Klik **Save** di setiap variabel
- Atau klik **Save** besar di bawah

---

## LANGKAH 7 — DEPLOY ULANG

1. Sidebar kiri Netlify → **Deploys**
2. Klik tombol **Trigger deploy**
3. Pilih **Deploy site**
4. Tunggu 1–3 menit sampai status **Published** (hijau)
5. Klik link preview atau domain utama

---

## LANGKAH 8 — TEST LOGIN

1. Buka halaman login:
   ```
   https://domain-anda.netlify.app/login
   ```
2. Masukkan:
   - Email: `superadmin@kampus.ac.id`
   - Password: yang Anda buat di Langkah 5.2
3. Klik **Masuk**
4. Harus masuk ke **Dashboard** dengan badge **SUPER ADMIN**
5. Coba klik menu **Editor Pengumuman** → tulis pengumuman → Simpan
6. Kembali ke halaman utama → pengumuman harus muncul

---

## TROUBLESHOOTING CEPAT

| Masalah | Solusi |
|---|---|
| Login gagal "Invalid login credentials" | Pastikan centang **Auto Confirm User** saat buat user |
| "Akun belum terdaftar di profil" | Jalankan INSERT ke tabel `profiles` (Langkah 5.3) |
| Error "DATABASE_URL is required" | Cek env var di Netlify, pastikan ada `?pgbouncer=true` |
| Error permission denied | Jalankan di SQL Editor: `GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;` |
| Dosen tidak muncul | Buka tabel `lecturers` → pastikan `active = true` |

---

## RINGKASAN 4 ENVIRONMENT VARIABLES

| Key | Nilai |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@db.wbhsgnidqxqtnruicuuh.supabase.co:5432/postgres?pgbouncer=true` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wbhsgnidqxqtnruicuuh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |
| `SUPABASE_SERVICE_ROLE_KEY` | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |

---

Selesai! Sekarang aplikasi SiPaling FISIP Anda sudah terhubung ke Supabase.

Jika ada yang error di langkah manapun, **screenshot error-nya** dan kirim ke saya. Saya akan bantu perbaiki satu per satu.