-- =====================================================================
-- V24 — CBT (Computer Based Test)
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- Mahasiswa TIDAK punya akun. Identitasnya melekat pada cbt_attempts —
-- nama + NIM + kode ujian — dan tidak ada tabel pengguna mahasiswa sama
-- sekali. Itu keputusan pokoknya, dan seluruh bentuk tabel mengikuti.
--
-- Kontrol aktivasi dipisah dari kepemilikan: dosen membuat ujian dan
-- menentukan jumlah soal serta durasinya; yang mengisi activated_at hanya
-- Super Admin dan Admin. Sesudah aktif, pembukaannya murni dari start_at.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.cbt_exams (
  id               SERIAL PRIMARY KEY,
  code             VARCHAR(12)  NOT NULL UNIQUE,
  title            VARCHAR(160) NOT NULL,
  course_name      VARCHAR(120) NOT NULL,
  class_name       VARCHAR(80),
  description      TEXT,
  instruction      TEXT,
  lecturer_id      INTEGER REFERENCES public.lecturers(id) ON DELETE SET NULL,
  created_by       VARCHAR(120) NOT NULL,
  created_by_role  VARCHAR(40)  NOT NULL,
  question_count   INTEGER      NOT NULL DEFAULT 0,
  duration_minutes INTEGER      NOT NULL DEFAULT 60,
  passing_grade    INTEGER      NOT NULL DEFAULT 60,
  max_attempts     INTEGER      NOT NULL DEFAULT 1,
  random_questions BOOLEAN      NOT NULL DEFAULT TRUE,
  random_options   BOOLEAN      NOT NULL DEFAULT TRUE,
  allow_back       BOOLEAN      NOT NULL DEFAULT TRUE,
  show_score       BOOLEAN      NOT NULL DEFAULT TRUE,
  token            VARCHAR(12),
  start_at         TIMESTAMPTZ,
  end_at           TIMESTAMPTZ,
  activated_at     TIMESTAMPTZ,
  activated_by     VARCHAR(120),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Mahasiswa mencari ujiannya lewat kode; dosen membuka daftarnya per pemilik.
CREATE INDEX IF NOT EXISTS idx_cbt_exams_dosen ON public.cbt_exams(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_cbt_exams_jadwal ON public.cbt_exams(start_at, end_at);

CREATE TABLE IF NOT EXISTS public.cbt_questions (
  id          SERIAL PRIMARY KEY,
  exam_id     INTEGER      NOT NULL REFERENCES public.cbt_exams(id) ON DELETE CASCADE,
  type        VARCHAR(20)  NOT NULL DEFAULT 'pg',
  question    TEXT         NOT NULL,
  options     TEXT         NOT NULL DEFAULT '[]',
  answer_key  VARCHAR(400) NOT NULL DEFAULT '',
  points      INTEGER      NOT NULL DEFAULT 1,
  material    VARCHAR(120),
  difficulty  VARCHAR(12)  NOT NULL DEFAULT 'sedang',
  explanation TEXT,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbt_questions_exam
  ON public.cbt_questions(exam_id, sort_order);

CREATE TABLE IF NOT EXISTS public.cbt_attempts (
  id              SERIAL PRIMARY KEY,
  exam_id         INTEGER     NOT NULL REFERENCES public.cbt_exams(id) ON DELETE CASCADE,
  nim             VARCHAR(20) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  attempt_no      INTEGER     NOT NULL DEFAULT 1,
  session_key     VARCHAR(64) NOT NULL UNIQUE,
  seed            INTEGER     NOT NULL,
  paper           TEXT        NOT NULL DEFAULT '[]',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at     TIMESTAMPTZ NOT NULL,
  submitted_at    TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'berjalan',
  score           INTEGER,
  correct         INTEGER     NOT NULL DEFAULT 0,
  wrong           INTEGER     NOT NULL DEFAULT 0,
  blank           INTEGER     NOT NULL DEFAULT 0,
  pending         INTEGER     NOT NULL DEFAULT 0,
  left_fullscreen INTEGER     NOT NULL DEFAULT 0,
  switched_tab    INTEGER     NOT NULL DEFAULT 0,
  last_seen_at    TIMESTAMPTZ
);

-- Batas percobaan ditegakkan basis data, bukan hanya pemeriksaan di kode:
-- dua permintaan yang datang bersamaan dapat lolos pemeriksaan bersama-sama.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cbt_attempts_sekali
  ON public.cbt_attempts(exam_id, nim, attempt_no);
CREATE INDEX IF NOT EXISTS idx_cbt_attempts_exam ON public.cbt_attempts(exam_id, status);

CREATE TABLE IF NOT EXISTS public.cbt_answers (
  id          SERIAL PRIMARY KEY,
  attempt_id  INTEGER     NOT NULL REFERENCES public.cbt_attempts(id) ON DELETE CASCADE,
  question_id INTEGER     NOT NULL REFERENCES public.cbt_questions(id) ON DELETE CASCADE,
  answer      TEXT        NOT NULL DEFAULT '',
  -- Ditandai mahasiswa untuk ditinjau ulang sebelum dikumpulkan.
  marked      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_correct  BOOLEAN,
  points      INTEGER     NOT NULL DEFAULT 0,
  feedback    TEXT,
  graded_by   VARCHAR(120),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-save menulis jawaban yang sama berkali-kali. Tanpa kunci ini, satu
-- soal dapat memiliki puluhan baris dan yang mana yang dinilai menjadi undian.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cbt_answers_satu
  ON public.cbt_answers(attempt_id, question_id);

ALTER TABLE public.cbt_exams     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_answers   ENABLE ROW LEVEL SECURITY;

-- Tanpa policy sama sekali. Seluruh pembacaan dan penulisan lewat server
-- memakai service-role key. Ini penting khusus untuk cbt_questions: kolom
-- answer_key memuat KUNCI JAWABAN, dan satu policy baca yang longgar berarti
-- kunci itu dapat diambil langsung dari peramban mahasiswa saat ujian.

-- Kolom penanda tinjau ditambahkan belakangan; baris ini membuat migrasi
-- tetap aman dijalankan pada basis data yang tabelnya sudah berdiri lebih dulu.
ALTER TABLE public.cbt_answers ADD COLUMN IF NOT EXISTS marked BOOLEAN NOT NULL DEFAULT FALSE;
