-- ============================================================
-- SiPaling FISIP - UPDATE DATABASE v54
-- Tugas lewat CBT: kode SIPALING-TUGAS, .md, plagiasi, papan nilai, Arsip Drive
--
-- Jalankan SELURUH isi file ini di Supabase, SQL Editor, Run.
-- Aman dijalankan berulang kali.
-- ============================================================
--
-- APA YANG BERUBAH
--
-- Penilaian tugas v53 menyimpan tugas dan hasilnya di peramban dosen. Sejak
-- v54 tugas tinggal di server, karena:
--
-- 1. Mahasiswa mengumpulkan PDF tugasnya sendiri lewat CBT (cbt.<domain>/tugas)
--    dan langsung menerima kode SIPALING-TUGAS-XXXXXXXX.
-- 2. PDF-nya TIDAK disimpan. Peramban mahasiswa menyusunnya menjadi Markdown
--    (.md) dan hanya teks itu, sidik SHA-256 berkasnya, serta jumlah
--    halamannya yang dikirim. Kolom markdown di bawah inilah "berkasnya".
-- 3. Kemiripan antarkiriman dihitung otomatis (cbt_task_similarity) dan
--    menjadi gerbang sebelum penilaian AI.
-- 4. Nilai yang diterbitkan dosen tampil di papan nilai CBT (cbt.<domain>/papan).
-- 5. Tautan Google Drive tempat hasil diarsipkan disimpan di Arsip Drive
--    beserta tautan pendeknya (<portal>/s/KODE).
--
-- ------------------------------------------------------------
-- YANG TIDAK DISENTUH
-- ------------------------------------------------------------
-- Tabel lama mana pun. Empat tabel di bawah seluruhnya baru.
--
-- Pengaturan tugas v53 yang tersimpan di peramban dosen tidak dapat dibaca
-- SQL. Panel Penilaian tugas menawarkan memindahkannya ke server dengan satu
-- tombol saat pertama kali dibuka di peramban yang sama.

BEGIN;

-- ============================================================
-- 1. TUGAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cbt_tasks (
  id                 SERIAL       PRIMARY KEY,
  -- Kode pengumpulan yang dibacakan di kelas. Bukan rahasia.
  code               VARCHAR(12)  NOT NULL UNIQUE,
  course_name        VARCHAR(160) NOT NULL DEFAULT '',
  task_no            VARCHAR(20)  NOT NULL DEFAULT '',
  title              VARCHAR(300) NOT NULL DEFAULT '',
  instruction        TEXT         NOT NULL DEFAULT '',
  lecturer_name      VARCHAR(160) NOT NULL DEFAULT '',
  class_name         VARCHAR(80),
  rubric             TEXT         NOT NULL DEFAULT '{"nama":"","kriteria":[]}',
  -- Kosong = template bawaan.
  template           TEXT         NOT NULL DEFAULT '',
  template_name      VARCHAR(200) NOT NULL DEFAULT '',
  -- Larik kosong = tangga predikat bawaan (A=79,5; B=69,5; ...).
  scale              TEXT         NOT NULL DEFAULT '[]',
  footer_on          BOOLEAN      NOT NULL DEFAULT TRUE,
  -- Nilai di bawah angka ini merah di papan dan diberi keterangan.
  critical_score     INTEGER      NOT NULL DEFAULT 60,
  plagiarism_review  INTEGER      NOT NULL DEFAULT 25,
  plagiarism_high    INTEGER      NOT NULL DEFAULT 50,
  -- 'tahan' | 'nol' | 'catat'
  plagiarism_action  VARCHAR(20)  NOT NULL DEFAULT 'tahan',
  accept_open        BOOLEAN      NOT NULL DEFAULT FALSE,
  deadline_at        TIMESTAMPTZ,
  published          BOOLEAN      NOT NULL DEFAULT FALSE,
  published_at       TIMESTAMPTZ,
  lecturer_id        INTEGER      REFERENCES public.lecturers(id) ON DELETE SET NULL,
  created_by         VARCHAR(160) NOT NULL DEFAULT '',
  created_by_id      VARCHAR(64),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT cbt_tasks_kritis_sah   CHECK (critical_score BETWEEN 0 AND 100),
  CONSTRAINT cbt_tasks_ambang_sah   CHECK (plagiarism_review BETWEEN 1 AND 100 AND plagiarism_high BETWEEN 1 AND 100),
  CONSTRAINT cbt_tasks_tindakan_sah CHECK (plagiarism_action IN ('tahan', 'nol', 'catat'))
);

CREATE INDEX IF NOT EXISTS idx_cbt_tasks_pemilik ON public.cbt_tasks (created_by_id);
CREATE INDEX IF NOT EXISTS idx_cbt_tasks_terbit  ON public.cbt_tasks (published, published_at);

-- ============================================================
-- 2. KIRIMAN
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cbt_task_submissions (
  id                 SERIAL       PRIMARY KEY,
  task_id            INTEGER      NOT NULL REFERENCES public.cbt_tasks(id) ON DELETE CASCADE,
  -- SIPALING-TUGAS-XXXXXXXX. Delapan huruf ACAK: kode ini kunci keterangan
  -- nilai di papan, dan nomor urut dapat ditebak siapa saja.
  receipt            VARCHAR(40)  NOT NULL UNIQUE,
  nim                VARCHAR(32)  NOT NULL DEFAULT '',
  name               VARCHAR(160) NOT NULL DEFAULT '',
  -- 'cbt' = dikumpulkan mahasiswa; 'dosen' = diimpor dosen dari Drive.
  source             VARCHAR(12)  NOT NULL DEFAULT 'cbt',
  file_name          VARCHAR(400) NOT NULL DEFAULT '',
  file_size          INTEGER      NOT NULL DEFAULT 0,
  file_hash          VARCHAR(64)  NOT NULL DEFAULT '',
  pages              INTEGER      NOT NULL DEFAULT 0,
  words              INTEGER      NOT NULL DEFAULT 0,
  markdown           TEXT         NOT NULL DEFAULT '',
  similarity         INTEGER      NOT NULL DEFAULT 0,
  similarity_status  VARCHAR(20)  NOT NULL DEFAULT 'bersih',
  similar_to         INTEGER      REFERENCES public.cbt_task_submissions(id) ON DELETE SET NULL,
  -- Putusan dosen: '' | 'lolos' | 'plagiasi'
  decision           VARCHAR(20)  NOT NULL DEFAULT '',
  decided_by         VARCHAR(160),
  -- 'masuk' | 'dinilai' | 'ditahan' | 'gagal'
  status             VARCHAR(20)  NOT NULL DEFAULT 'masuk',
  score              NUMERIC(5,2),
  result             TEXT,
  edited             BOOLEAN      NOT NULL DEFAULT FALSE,
  graded_at          TIMESTAMPTZ,
  submitted_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbt_task_sub_tugas
    ON public.cbt_task_submissions (task_id, submitted_at);

-- Satu NIM satu kiriman CBT per tugas. Menahan klik ganda tombol Kumpulkan
-- dan orang lain yang mengirim atas NIM yang sudah mengumpulkan. Impor dosen
-- tidak ikut: NIM-nya ditebak dari nama berkas dan boleh kembar sampai
-- dibetulkan dosen.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cbt_task_sub_nim
    ON public.cbt_task_submissions (task_id, nim)
 WHERE source = 'cbt' AND nim <> '';

-- ============================================================
-- 3. PASANGAN KIRIMAN YANG MIRIP
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cbt_task_similarity (
  id          SERIAL      PRIMARY KEY,
  task_id     INTEGER     NOT NULL REFERENCES public.cbt_tasks(id) ON DELETE CASCADE,
  sub_a       INTEGER     NOT NULL REFERENCES public.cbt_task_submissions(id) ON DELETE CASCADE,
  sub_b       INTEGER     NOT NULL REFERENCES public.cbt_task_submissions(id) ON DELETE CASCADE,
  score       INTEGER     NOT NULL DEFAULT 0,
  share_a     INTEGER     NOT NULL DEFAULT 0,
  share_b     INTEGER     NOT NULL DEFAULT 0,
  status      VARCHAR(20) NOT NULL DEFAULT 'bersih',
  signals     TEXT        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cbt_task_sim_urut CHECK (sub_a < sub_b)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cbt_task_sim_pasangan
    ON public.cbt_task_similarity (sub_a, sub_b);
CREATE INDEX IF NOT EXISTS idx_cbt_task_sim_tugas
    ON public.cbt_task_similarity (task_id, score);

-- ============================================================
-- 4. ARSIP DRIVE
-- ============================================================
-- Hanya Super Admin yang boleh menghapus barisnya (ditegakkan jalur API).
-- task_id menjadi NULL bila tugasnya dihapus: arsipnya justru dibuat supaya
-- isi tugas boleh dihapus dari portal sesudah tersimpan di Drive.
CREATE TABLE IF NOT EXISTS public.drive_archives (
  id               SERIAL       PRIMARY KEY,
  code             VARCHAR(16)  NOT NULL UNIQUE,
  title            VARCHAR(200) NOT NULL,
  drive_url        TEXT         NOT NULL,
  note             TEXT,
  task_id          INTEGER      REFERENCES public.cbt_tasks(id) ON DELETE SET NULL,
  clicks           INTEGER      NOT NULL DEFAULT 0,
  created_by       VARCHAR(160) NOT NULL DEFAULT '',
  created_by_id    VARCHAR(64),
  created_by_role  VARCHAR(40)  NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Pemendek tautan ini HANYA untuk Google Drive/Docs, supaya tidak menjadi
  -- pengalih terbuka ke situs sembarang.
  CONSTRAINT drive_archives_tautan_drive
    CHECK (drive_url ~* '^https://(drive|docs)\.google\.com/')
);

CREATE INDEX IF NOT EXISTS idx_drive_archives_waktu ON public.drive_archives (created_at);

-- ============================================================
-- 5. RLS: TERTUTUP UNTUK KUNCI PUBLIK
-- ============================================================
-- Tanpa policy sama sekali, seperti tabel CBT lainnya. Seluruh pembacaan dan
-- penulisan lewat server (DATABASE_URL), dan di sana peran pemanggil
-- diperiksa lebih dulu. Ini penting: markdown berisi karya mahasiswa, dan
-- receipt adalah kunci keterangan nilai.
ALTER TABLE public.cbt_tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_task_similarity  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_archives       ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================
-- 6. PEMERIKSAAN
-- ============================================================
-- Yang diharapkan: empat baris, seluruhnya rls = true.
SELECT c.relname AS tabel, c.relrowsecurity AS rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('cbt_tasks', 'cbt_task_submissions', 'cbt_task_similarity', 'drive_archives')
 ORDER BY c.relname;
