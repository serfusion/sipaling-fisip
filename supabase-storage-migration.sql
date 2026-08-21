-- =====================================================================
-- SiPaling FISIP — Migrasi aman BYTEA ke Supabase Storage
-- Jalankan SEKALI sebelum men-deploy kode versi Storage.
-- Tidak menghapus file lama. File lama tetap dibaca dari file_data.
-- =====================================================================

BEGIN;

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS file_storage_path TEXT;

ALTER TABLE public.revision_uploads
  ADD COLUMN IF NOT EXISTS file_storage_path TEXT;

-- Berkas baru disimpan di Storage sehingga BYTEA revisi harus boleh NULL.
ALTER TABLE public.revision_uploads
  ALTER COLUMN file_data DROP NOT NULL;

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

COMMIT;

-- Pemeriksaan: hasil yang benar adalah public = false dan limit = 10485760.
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'service-documents';

-- Pemeriksaan kolom: kedua tabel harus memiliki file_storage_path.
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('service_requests', 'revision_uploads')
  AND column_name IN ('file_storage_path', 'file_data')
ORDER BY table_name, column_name;
