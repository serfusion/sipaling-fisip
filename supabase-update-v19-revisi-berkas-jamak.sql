-- =====================================================================
-- V19 — REVISI MENGIKUTI BENTUK LAYANANNYA
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- Formulir revisi dulu selalu meminta SATU berkas .docx, apa pun layanannya.
-- Penyerahan skripsi ke perpustakaan mengunggah empat PDF saat mengajukan,
-- jadi revisinya juga harus empat — dan keempatnya menggantikan yang lama
-- pada tiket yang sama. Riwayat revisinya karena itu perlu tahu bagian mana
-- yang diganti.
-- =====================================================================

ALTER TABLE public.revision_uploads
  ADD COLUMN IF NOT EXISTS part  VARCHAR(40),
  ADD COLUMN IF NOT EXISTS label VARCHAR(160);

-- Riwayat dibaca per tiket, per nomor revisi.
CREATE INDEX IF NOT EXISTS idx_revision_uploads_request_nomor
  ON public.revision_uploads(request_id, revision_number);
