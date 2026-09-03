-- =====================================================================
-- V22 — ARSIP TRANSKRIP NILAI (Admin Akademik)
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- Sebelum ini transkrip yang sudah selesai hanya punya SATU laci:
-- app_settings['transkrip_data']. Menyimpan transkrip mahasiswa berikutnya
-- MENIMPA milik mahasiswa sebelumnya, sehingga tidak pernah ada daftar siapa
-- saja yang transkripnya sudah dibuat.
--
-- Tabel ini memberi tiap mahasiswa barisnya sendiri. Isinya data terstruktur
-- (biodata + daftar mata kuliah dalam JSON), bukan HTML, supaya transkrip
-- lama dapat dimuat kembali, diperbaiki, lalu dicetak ulang tanpa mengunggah
-- Excel dari SIMAK lagi.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.transcript_archives (
  id            SERIAL PRIMARY KEY,
  -- UNIQUE: satu mahasiswa satu transkrip. Menyimpan ulang NIM yang sama
  -- berarti memperbaiki transkrip yang itu juga, bukan melahirkan kembar
  -- yang membuat admin harus menebak mana yang terbaru.
  nim           VARCHAR(32)  NOT NULL UNIQUE,
  student_name  VARCHAR(160) NOT NULL,
  study_program VARCHAR(120),
  concentration VARCHAR(160),
  -- "id" = transkrip Indonesia, "en" = dwibahasa. Sekadar penanda asal,
  -- dipakai untuk membuka kembali di modul yang sama.
  lang          VARCHAR(4)   NOT NULL DEFAULT 'id',
  course_count  INTEGER      NOT NULL DEFAULT 0,
  total_sks     INTEGER      NOT NULL DEFAULT 0,
  total_mutu    INTEGER      NOT NULL DEFAULT 0,
  ipk           NUMERIC(4,2) NOT NULL DEFAULT 0,
  predikat      VARCHAR(40),
  yudisium      VARCHAR(60),
  thesis_title  TEXT,
  -- Biodata dan daftar mata kuliah, apa adanya, dalam bentuk JSON.
  meta          TEXT         NOT NULL,
  rows          TEXT         NOT NULL,
  saved_by      VARCHAR(160),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Daftar arsip selalu dibaca dengan yang terbaru di atas.
CREATE INDEX IF NOT EXISTS idx_transcript_archives_terbaru
  ON public.transcript_archives(updated_at DESC);

ALTER TABLE public.transcript_archives ENABLE ROW LEVEL SECURITY;

-- Tanpa policy sama sekali: seluruh pembacaan dan penulisan lewat server,
-- yang memeriksa sesi admin lebih dulu. Dengan begitu nilai dan biodata
-- mahasiswa tidak dapat dibaca langsung dari peramban siapa pun.
