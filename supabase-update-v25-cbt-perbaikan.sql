-- =====================================================================
-- V25 — CBT: kepemilikan, penanda perangkat, dan nama yang diseragamkan
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- Empat hal:
--
--   1. created_by_id — penentu kepemilikan ujian. Semula kepemilikan hanya
--      dilihat dari lecturer_id, dan itu mengunci dosen yang akun profilnya
--      belum tersambung ke baris dosen: ia dapat membuat ujian, lalu tidak
--      pernah dapat membukanya lagi.
--   2. device_id — satu ponsel tidak dapat dipakai bergantian dua orang.
--   3. name_key — satu nama tidak dapat mendaftar dua kali dengan NIM berbeda.
--   4. single_device — saklar untuk mematikan aturan nomor 2 di laboratorium,
--      tempat satu komputer memang dipakai bergantian sepanjang hari.
-- =====================================================================

ALTER TABLE public.cbt_exams
  ADD COLUMN IF NOT EXISTS created_by_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS single_device BOOLEAN NOT NULL DEFAULT TRUE;

-- Ujian yang sudah terlanjur ada tidak punya pemilik menurut kolom baru ini.
-- Dibiarkan NULL dengan sengaja: kode membaca nama pembuatnya sebagai cadangan
-- khusus untuk baris lama, dan menebak id profil dari nama di sini justru dapat
-- memberikan ujian kepada orang yang namanya kebetulan sama.

ALTER TABLE public.cbt_attempts
  ADD COLUMN IF NOT EXISTS name_key  VARCHAR(120) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(64)  NOT NULL DEFAULT '';

-- Dicari saat mahasiswa masuk, untuk memeriksa apakah perangkat atau namanya
-- sudah dipakai orang lain pada ujian yang sama.
CREATE INDEX IF NOT EXISTS idx_cbt_attempts_perangkat
  ON public.cbt_attempts(exam_id, device_id);
CREATE INDEX IF NOT EXISTS idx_cbt_attempts_nama
  ON public.cbt_attempts(exam_id, name_key);

-- Indeks unik yang semula hanya ada di berkas SQL ini, tidak di skema Drizzle.
-- Diulang di sini supaya basis data yang disiapkan lewat jalur mana pun sama.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cbt_answers_satu
  ON public.cbt_answers(attempt_id, question_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cbt_attempts_sekali
  ON public.cbt_attempts(exam_id, nim, attempt_no);
