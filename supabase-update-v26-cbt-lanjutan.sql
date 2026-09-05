-- =====================================================================
-- V26 — CBT lanjutan: jenis soal baru, media, dan penskoran sebagian
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- Empat hal:
--
--   1. Jenis soal baru — PG kompleks (jawaban jamak) dan Penjodohan. Kunci
--      PG kompleks disimpan sebagai deretan nomor dipisah koma pada kolom
--      answer_key yang sudah ada; pasangan penjodohan pada kolom baru pairs.
--   2. Media soal — gambar dan video, diunggah atau ditempel sebagai tautan.
--   3. Penskoran sebagian — dua jenis di atas dapat bernilai sebagian, jadi
--      kolom poin per jawaban HARUS pecahan. Ini bukan soal kerapian:
--      Postgres MENOLAK angka pecahan yang masuk ke kolom integer, dan
--      penolakannya terjadi tepat ketika mahasiswa menekan "kumpulkan".
--   4. Bucket penyimpanan media, bersifat publik — yang membuka soal adalah
--      mahasiswa tanpa akun, sehingga URL bertanda tangan akan kedaluwarsa
--      di tengah ujian.
-- =====================================================================

-- ---------- 1 & 2. Kolom soal ----------
ALTER TABLE public.cbt_questions
  ADD COLUMN IF NOT EXISTS pairs         TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS media_type    VARCHAR(12) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS media_url     TEXT,
  ADD COLUMN IF NOT EXISTS media_caption VARCHAR(240);

-- ---------- 3. Penskoran sebagian ----------
ALTER TABLE public.cbt_attempts
  ADD COLUMN IF NOT EXISTS partial INTEGER NOT NULL DEFAULT 0;

-- integer → real adalah pelebaran, jadi tidak ada data yang hilang.
ALTER TABLE public.cbt_answers
  ALTER COLUMN points TYPE REAL USING points::real;

-- ---------- 4. Bucket media ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cbt-media', 'cbt-media', TRUE, 52428800)
ON CONFLICT (id) DO UPDATE
  SET public = TRUE, file_size_limit = 52428800;

-- Yang MENULIS ke bucket ini hanya server, memakai kunci service-role yang
-- melewati RLS — jadi tidak ada kebijakan insert di sini, dan itu disengaja.
-- Yang dibuka hanya membacanya, karena gambar soal harus dapat dimuat
-- peramban mahasiswa yang tidak punya akun sama sekali.
DROP POLICY IF EXISTS "cbt media dapat dibaca umum" ON storage.objects;
CREATE POLICY "cbt media dapat dibaca umum"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cbt-media');
