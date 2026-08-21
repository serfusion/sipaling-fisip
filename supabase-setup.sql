-- =====================================================================
-- SiPaling FISIP — Supabase Schema Setup
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor → New query
-- =====================================================================

-- Tabel dosen tujuan
CREATE TABLE IF NOT EXISTS lecturers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  study_program VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, study_program)
);

-- Tabel pengajuan layanan mahasiswa
CREATE TABLE IF NOT EXISTS service_requests (
  id SERIAL PRIMARY KEY,
  ticket VARCHAR(80) NOT NULL UNIQUE,
  nim VARCHAR(32) NOT NULL,
  student_name VARCHAR(160) NOT NULL,
  study_program VARCHAR(120) NOT NULL,
  contact VARCHAR(160),
  service_type VARCHAR(120) NOT NULL,
  service_need VARCHAR(160) NOT NULL,
  title TEXT NOT NULL,
  lecturer_id INTEGER REFERENCES lecturers(id) ON DELETE SET NULL,
  student_note TEXT,
  file_name VARCHAR(255),
  file_mime VARCHAR(160),
  file_size INTEGER,
  file_storage_path TEXT,
  -- Dipertahankan nullable hanya agar berkas versi lama tetap dapat dibaca.
  -- Aplikasi tidak lagi menyimpan berkas baru ke kolom BYTEA ini.
  file_data BYTEA,
  status VARCHAR(40) NOT NULL DEFAULT 'Masuk',
  administrative_status VARCHAR(80) NOT NULL DEFAULT 'Belum Dicek',
  lecturer_note TEXT,
  admin_note TEXT,
  revision_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabel riwayat upload revisi
CREATE TABLE IF NOT EXISTS revision_uploads (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  nim VARCHAR(32) NOT NULL,
  revision_number INTEGER NOT NULL,
  note TEXT,
  file_name VARCHAR(255) NOT NULL,
  file_mime VARCHAR(160) NOT NULL,
  file_size INTEGER NOT NULL,
  file_storage_path TEXT,
  file_data BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabel pengumuman (editable Super Admin)
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0,
  created_by VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabel profil user (terhubung ke Supabase Auth via UUID)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(200) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'dosen',
  lecturer_id INTEGER REFERENCES lecturers(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_role_check CHECK (
    role IN (
      'super_admin',
      'admin',
      'admin_umum',
      'admin_akademik',
      'admin_pddikti',
      'admin_perpustakaan',
      'admin_laboratorium',
      'dosen'
    )
  )
);

-- Index untuk mempercepat pencarian tiket
CREATE INDEX IF NOT EXISTS idx_service_requests_ticket ON service_requests(ticket);
CREATE INDEX IF NOT EXISTS idx_service_requests_nim ON service_requests(nim);
CREATE INDEX IF NOT EXISTS idx_service_requests_lecturer ON service_requests(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Bucket privat untuk seluruh dokumen layanan. Aplikasi menggunakan secret key
-- hanya di server dan membuat signed URL berdurasi singkat saat file diunduh.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) VALUES (
  'service-documents',
  'service-documents',
  FALSE,
  10485760,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================================
-- DATA AWAL: Dosen FISIP (opsional — sesuaikan nama dosen Anda)
-- =====================================================================
INSERT INTO lecturers (name, study_program) VALUES
  ('Dr. Rina Kurniawati, S.Sos., M.Si.', 'Ilmu Komunikasi'),
  ('Dr. Andi Pratama, S.IP., M.Si.', 'Ilmu Pemerintahan'),
  ('Dra. Maya Lestari, M.Si.', 'Ilmu Komunikasi'),
  ('Hendra Wijaya, S.IP., M.AP.', 'Ilmu Pemerintahan')
ON CONFLICT (name, study_program) DO NOTHING;

-- =====================================================================
-- USER PERTAMA: Super Admin
-- GANTI email & full_name sesuai akun Supabase Auth Anda
-- =====================================================================
-- Langkah 1: Buat user di Supabase → Authentication → Users → Add user
--            (misal email: superadmin@kampus.ac.id, password: pilih sendiri)
-- Langkah 2: Jalankan INSERT berikut (sesuaikan email):
--
-- INSERT INTO profiles (id, email, full_name, role, active)
-- SELECT id, email, 'Super Admin FISIP', 'super_admin', true
-- FROM auth.users
-- WHERE lower(email) = lower('superadmin@kampus.ac.id')
-- ON CONFLICT (id) DO UPDATE SET
--   email = excluded.email,
--   full_name = excluded.full_name,
--   role = excluded.role,
--   active = true,
--   updated_at = now();
--
-- Untuk dosen, isi lecturer_id dengan ID dosen yang sesuai.
