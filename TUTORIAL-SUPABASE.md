> **PERINGATAN (v2):** Bagian `GRANT ALL ... TO anon` di dokumen ini SUDAH TIDAK BERLAKU
> dan BERBAHAYA (membuka seluruh database ke publik). Jangan dijalankan.
> Gunakan `supabase-update-v2.sql` dan dokumen Tutorial-Deploy-SiPaling-FISIP-ke-Vercel.docx.

# Tutorial Step-by-Step: Koneksi SiPaling FISIP ke Supabase

Panduan ini disusun khusus untuk project Supabase Anda:
**Project Ref:** `wbhsgnidqxqtnruicuuh`
**Project URL:** `https://wbhsgnidqxqtnruicuuh.supabase.co`

Ikuti 7 langkah berikut secara berurutan. Waktu estimasi: 10–15 menit.

---

## Langkah 1 — Login ke Supabase

1. Buka browser → pergi ke **https://supabase.com/dashboard**
2. Klik **Sign In** (pojok kanan atas) → login dengan akun GitHub atau email yang Anda pakai saat membuat project.
3. Di halaman dashboard, klik kartu project **`wbhsgnidqxqtnruicuuh`**.

---

## Langkah 2 — Jalankan Schema Database

1. Pada sidebar kiri project, klik ikon **SQL Editor** (ikon database dengan petik).
2. Klik tombol **New query** (kanan atas).
3. Buka file `supabase-setup.sql` di project ini, **salin seluruh isinya**.
4. **Tempel** ke editor SQL Supabase.
5. Klik **Run** (atau tekan `Ctrl+Enter` / `Cmd+Enter`).
6. Tunggu muncul pesan **"Success. No rows returned"** — itu normal karena query hanya membuat tabel.
7. Verifikasi: klik menu **Table Editor** di sidebar → Anda akan melihat 5 tabel baru:
   - `lecturers`
   - `service_requests`
   - `revision_uploads`
   - `announcements`
   - `profiles`
8. Buka tabel `lecturers` — sudah ada 4 dosen contoh.

---

## Langkah 3 — Dapatkan Password Database

Anda butuh password database untuk `DATABASE_URL` di Netlify.

1. Sidebar kiri → **Project Settings** (ikon gear di bawah).
2. Pilih tab **Database**.
3. Scroll ke bagian **Connection parameters** atau **Connection string**.
4. Pilih tab **URI**.
5. Akan muncul string seperti:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.wbhsgnidqxqtnruicuuh.supabase.co:5432/postgres
   ```
6. **Catat password Anda** (bagian yang menggantikan `[YOUR-PASSWORD]`).
   - Jika lupa: scroll ke bagian **Database password** → klik **Reset database password** → simpan password baru di tempat aman.

> Catatan: Supabase juga menyediakan **Transaction pooler (PgBouncer)** dengan URL yang berbeda. Untuk Netlify, kita akan pakai **Direct connection** dengan tambahan `?pgbouncer=true` (lebih stabil di serverless).

---

## Langkah 4 — Ambil API Keys Supabase

1. Sidebar kiri → **Project Settings** → tab **API** (atau **Data API** di UI baru).
2. Catat 3 nilai berikut (klik ikon mata untuk menampilkan):

| Nama di Supabase | Contoh nilai Anda |
|---|---|
| Project URL | `https://wbhsgnidqxqtnruicuuh.supabase.co` |
| `anon` `public` key | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |
| `service_role` `secret` key | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |

⚠️ **Jangan pernah expose `service_role` ke publik.** Key ini hanya untuk server (Netlify env var).

---

## Langkah 5 — Buat User Super Admin

1. Sidebar kiri → **Authentication** → tab **Users**.
2. Klik **Add user** (kanan atas) → **Create new user**.
3. Isi form:
   - **Email:** `superadmin@kampus.ac.id` (atau email Anda)
   - **Password:** pilih password kuat, minimal 8 karakter
   - **Auto Confirm User:** centang ✅
4. Klik **Create user**.
5. Catat email yang Anda pakai — akan dipakai untuk login nanti.

### 5b — Daftarkan user ke tabel `profiles`

Kembali ke **SQL Editor** → New query → jalankan:

```sql
INSERT INTO profiles (id, email, full_name, role, active)
VALUES (
  gen_random_uuid()::text,
  'superadmin@kampus.ac.id',   -- GANTI dengan email user yang baru dibuat
  'Super Admin FISIP',         -- GANTI dengan nama lengkap
  'super_admin',
  true
);
```

Klik **Run**. Pastikan muncul **"Success. 1 row inserted"**.

> Untuk menambahkan Admin atau Dosen baru, ulangi langkah 5 + 5b dengan role `admin` atau `dosen`. Untuk dosen, isi `lecturer_id` dengan ID dari tabel `lecturers`.

---

## Langkah 6 — Set Environment Variables di Netlify

1. Buka **https://app.netlify.com** → pilih situs SiPaling FISIP Anda.
2. Klik menu **Site configuration** (sidebar) → **Environment variables**.
3. Klik **Add a variable** dan tambahkan **4 variabel** berikut satu per satu:

| Key | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:PASSWORD_ANDA@db.wbhsgnidqxqtnruicuuh.supabase.co:5432/postgres?pgbouncer=true` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wbhsgnidqxqtnruicuuh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |
| `SUPABASE_SERVICE_ROLE_KEY` | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |

⚠️ **Ganti `PASSWORD_ANDA`** di `DATABASE_URL` dengan password database dari Langkah 3.

4. Klik **Save**.

---

## Langkah 7 — Deploy Ulang & Login

1. Di Netlify, klik menu **Deploys** → **Trigger deploy** → **Deploy site**.
2. Tunggu 1–3 menit hingga status berubah menjadi **Published**.
3. Buka situs Anda: `https://domain-anda.netlify.app/login`
4. Login dengan email + password dari Langkah 5.
5. Anda akan masuk ke **Dashboard** dengan role badge **SUPER ADMIN**.
6. Coba edit **Pengumuman** → submit → buka halaman utama untuk melihat pengumuman muncul.

---

## Troubleshooting

### Login gagal dengan pesan "Invalid login credentials"
- Pastikan Anda sudah centang **Auto Confirm User** saat membuat user.
- Jika tidak, cek email untuk link konfirmasi atau konfirmasi manual di **Authentication → Users → ⋯ → Confirm user**.

### Login berhasil tapi muncul "Akun Anda belum terdaftar di daftar profil"
- Berarti email yang login belum ada di tabel `profiles`.
- Jalankan INSERT di Langkah 5b dengan email yang sama persis.

### Halaman utama / dashboard error "DATABASE_URL is required" atau timeout
- Pastikan `DATABASE_URL` di Netlify sudah benar (password + `?pgbouncer=true`).
- Trigger deploy ulang setelah mengubah env var.

### Error "permission denied for table ..."
- Buka **SQL Editor** → jalankan:
  ```sql
  GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
  ```

### Dosen tidak muncul di dropdown form
- Buka tabel `lecturers` di Supabase → pastikan kolom `active` bernilai `true`.
- Tambah dosen baru:
  ```sql
  INSERT INTO lecturers (name, study_program) VALUES
  ('Nama Dosen, Gelar', 'Ilmu Komunikasi');
  ```

---

## Struktur Role

| Role | Hak Akses |
|---|---|
| `super_admin` | Semua akses + edit Pengumuman |
| `admin` | Kelola semua pengajuan, tidak bisa edit Pengumuman |
| `dosen` | Hanya lihat pengajuan yang ditujukan kepadanya |

Untuk menambah Admin atau Dosen, ulangi Langkah 5 + 5b dengan role yang sesuai.

---

Selesai! Sistem SiPaling FISIP Anda kini sudah live dengan Supabase. 🎓
