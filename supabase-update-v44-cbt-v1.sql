-- ============================================================
-- SiPaling FISIP — UPDATE DATABASE v44
-- CBT V1: data mahasiswa, rubrik, kemiripan jawaban, rekaman suara,
--         pengesahan nilai, dan pengiriman laporan
--
-- Jalankan SELURUH isi file ini di Supabase → SQL Editor → Run.
-- Aman dijalankan berulang kali.
-- ============================================================
--
-- APA YANG BERUBAH UNTUK UJIAN YANG SUDAH ADA
--
-- TIDAK ADA. Itu syarat yang dipegang di seluruh berkas ini, dan bukan
-- kesopanan: migrasi ini dijalankan pada portal yang ujiannya mungkin
-- dijadwalkan besok pagi.
--
-- Seluruh kolom baru punya nilai bawaan yang berarti "fitur ini tidak
-- dipakai", dan seluruh tabel baru boleh kosong selamanya. Ujian yang sudah
-- berjalan hari ini akan berjalan persis sama sesudah ini dijalankan:
--
--   rubric_id          NULL   → esai dinilai seperti biasa, dosen mengetik angkanya
--   record_audio       false  → mikrofon tidak pernah menyala
--   check_similarity   true   → berjalan di server, tanpa biaya, hanya menandai
--   auto_email         false  → tidak ada surat yang terkirim sendiri
--   students           kosong → peserta mengetik nama dan nomornya sendiri
--
-- Satu-satunya yang menyala secara bawaan adalah pemeriksaan kemiripan, dan
-- ia tidak pernah mengubah nilai, tidak memanggil model, dan tidak menunda
-- pengumpulan. Yang dihasilkannya satu kolom pada papan pantau dosen.
--
-- ------------------------------------------------------------
-- YANG PERLU DISIAPKAN DI LUAR SQL INI
-- ------------------------------------------------------------
--   1. Bucket Storage "cbt-rekaman" — dibuat di bawah, TERTUTUP. Hanya perlu
--      bila perekaman suara akan dipakai.
--   2. GEMINI_API_KEY pada environment — hanya untuk transkrip rekaman.
--      ANTHROPIC_API_KEY atau GEMINI_API_KEY — untuk penilaian esai rubrik.
--      Tanpa keduanya, rubrik tetap jalan: dosen mengisi levelnya sendiri.
--   3. CBT_EMAIL_DARI dan OUTREACH_API_KEY — hanya untuk mengirim laporan
--      nilai ke mahasiswa lewat email.
--
-- Tidak satu pun dari ketiganya wajib. Portal tanpa semuanya tetap
-- mendapat: daftar mahasiswa, rubrik manual, kemiripan jawaban, dan laporan
-- PDF yang memuat semuanya.

BEGIN;

-- ============================================================
-- 1. DAFTAR MAHASISWA
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id            SERIAL PRIMARY KEY,
  nim           VARCHAR(20)  NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  -- Nama yang sudah diseragamkan untuk dicari. Disimpan sebagai kolom, bukan
  -- dihitung saat mencari: pencarian berjalan pada TIAP KETIKAN tiga puluh
  -- peserta sekaligus, lima menit sebelum ujian dimulai.
  name_key      VARCHAR(120) NOT NULL DEFAULT '',
  email         VARCHAR(160),
  prodi         VARCHAR(120),
  class_name    VARCHAR(80),
  angkatan      VARCHAR(10),
  status        VARCHAR(20)  NOT NULL DEFAULT 'aktif',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Dua indeks untuk dua jalan masuk yang berbeda: orang mengetik huruf depan
-- namanya, atau angka depan nomornya. Tanpa keduanya, autocomplete sejak satu
-- karakter berarti pemindaian tabel penuh pada tiap ketikan.
CREATE INDEX IF NOT EXISTS idx_students_nama ON students (name_key);
CREATE INDEX IF NOT EXISTS idx_students_nim  ON students (nim);

-- Pencarian "mengandung kata" (ILIKE '%budi%') tidak dapat memakai indeks
-- B-tree biasa. Indeks trigram membuatnya tetap cepat pada tabel lima ribu
-- baris. Bila ekstensinya tidak tersedia pada proyek ini, bagian ini dilewati
-- diam-diam — pencariannya tetap benar, hanya lebih lambat pada daftar besar.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS idx_students_nama_trgm
      ON students USING gin (name_key gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm tidak tersedia; pencarian nama tetap jalan tanpa indeks trigram.';
END $$;

-- ============================================================
-- 2. RUBRIK
-- ============================================================
CREATE TABLE IF NOT EXISTS cbt_rubrics (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(160) NOT NULL,
  description  TEXT,
  scale_min    INTEGER      NOT NULL DEFAULT 1,
  scale_max    INTEGER      NOT NULL DEFAULT 4,
  -- Kriteria beserta bobot dan deskriptor tiap level, sebagai JSON.
  --
  -- Rancangan awal memisahkannya menjadi tabel criteria dan tabel levels.
  -- Pemisahan itu benar secara bentuk dan tidak pernah berguna: tidak ada satu
  -- pun pertanyaan yang menanyakan level tanpa kriterianya. Yang didapat
  -- hanyalah tiga sambungan tabel pada tiap pembacaan.
  criteria     TEXT         NOT NULL DEFAULT '[]',
  owner_id     VARCHAR(64),
  created_by   VARCHAR(120) NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cbt_rubric_scores (
  id              SERIAL PRIMARY KEY,
  attempt_id      INTEGER NOT NULL REFERENCES cbt_attempts(id)  ON DELETE CASCADE,
  question_id     INTEGER NOT NULL REFERENCES cbt_questions(id) ON DELETE CASCADE,
  -- Nomor urut kriteria di dalam rubriknya, bukan id: rubrik dapat disunting.
  criterion_index INTEGER NOT NULL,
  criterion_name  VARCHAR(160) NOT NULL DEFAULT '',
  weight          INTEGER NOT NULL DEFAULT 0,
  -- Pembacaan model dan keputusan dosen disimpan BERDAMPINGAN, tidak saling
  -- menimpa. Menimpanya menghapus satu-satunya jawaban atas pertanyaan yang
  -- muncul ketika nilai digugat: apakah dosennya memeriksa, atau hanya
  -- menekan setuju.
  ai_level        INTEGER,
  ai_reason       TEXT,
  ai_confidence   INTEGER,
  final_level     INTEGER,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cbt_rubric_scores_satu
    ON cbt_rubric_scores (attempt_id, question_id, criterion_index);

-- ============================================================
-- 3. KEMIRIPAN JAWABAN
-- ============================================================
CREATE TABLE IF NOT EXISTS cbt_similarity (
  id          SERIAL PRIMARY KEY,
  exam_id     INTEGER NOT NULL REFERENCES cbt_exams(id)     ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES cbt_questions(id) ON DELETE CASCADE,
  -- attempt_a SELALU bernomor lebih kecil daripada attempt_b. Menyimpan dua
  -- arah menggandakan barisnya dan membuka kemungkinan dua baris yang sama
  -- mengatakan angka berbeda sesudah salah satunya dihitung ulang.
  attempt_a   INTEGER NOT NULL REFERENCES cbt_attempts(id)  ON DELETE CASCADE,
  attempt_b   INTEGER NOT NULL REFERENCES cbt_attempts(id)  ON DELETE CASCADE,
  score       INTEGER NOT NULL DEFAULT 0,
  status      VARCHAR(20) NOT NULL DEFAULT 'bersih',
  -- Rincian sinyal pembentuk skornya, supaya angkanya dapat DITERANGKAN.
  -- Angka 74% tidak dapat dibawa ke sidang akademik; dua kalimat yang sama
  -- huruf demi huruf, ditampilkan berdampingan, bisa.
  signals     TEXT NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cbt_similarity_pasangan
    ON cbt_similarity (question_id, attempt_a, attempt_b);
CREATE INDEX IF NOT EXISTS idx_cbt_similarity_ujian
    ON cbt_similarity (exam_id, score);

-- ============================================================
-- 4. REKAMAN SUARA
-- ============================================================
CREATE TABLE IF NOT EXISTS cbt_recordings (
  id                SERIAL PRIMARY KEY,
  attempt_id        INTEGER NOT NULL UNIQUE REFERENCES cbt_attempts(id) ON DELETE CASCADE,
  exam_id           INTEGER NOT NULL REFERENCES cbt_exams(id) ON DELETE CASCADE,
  prefix            VARCHAR(200) NOT NULL DEFAULT '',
  chunk_count       INTEGER NOT NULL DEFAULT 0,
  duration_sec      INTEGER NOT NULL DEFAULT 0,
  bytes             BIGINT  NOT NULL DEFAULT 0,
  status            VARCHAR(20) NOT NULL DEFAULT 'menunggu',
  note              VARCHAR(200),
  transcript_status VARCHAR(20) NOT NULL DEFAULT 'belum',
  flag_status       VARCHAR(20) NOT NULL DEFAULT 'bersih',
  flag_count        INTEGER NOT NULL DEFAULT 0,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbt_recordings_ujian ON cbt_recordings (exam_id);

CREATE TABLE IF NOT EXISTS cbt_transcript_segments (
  id           SERIAL PRIMARY KEY,
  recording_id INTEGER NOT NULL REFERENCES cbt_recordings(id) ON DELETE CASCADE,
  -- Detik sejak rekaman dimulai. JAMNYA yang penting, bukan teksnya: dosen
  -- tidak membaca transkrip sembilan puluh menit, ia menekan satu timestamp
  -- yang ditandai dan mendengarkan sepuluh detik di sekitarnya.
  start_sec    INTEGER NOT NULL DEFAULT 0,
  end_sec      INTEGER NOT NULL DEFAULT 0,
  text         TEXT    NOT NULL DEFAULT '',
  keyword      VARCHAR(120),
  risk         VARCHAR(20) NOT NULL DEFAULT 'bersih',
  reason       VARCHAR(300)
);

CREATE INDEX IF NOT EXISTS idx_cbt_transcript_rekaman
    ON cbt_transcript_segments (recording_id, start_sec);

-- ============================================================
-- 5. CATATAN PENGIRIMAN LAPORAN NILAI
-- ============================================================
CREATE TABLE IF NOT EXISTS cbt_result_emails (
  id          SERIAL PRIMARY KEY,
  attempt_id  INTEGER NOT NULL REFERENCES cbt_attempts(id) ON DELETE CASCADE,
  email       VARCHAR(160) NOT NULL,
  subject     VARCHAR(240) NOT NULL DEFAULT '',
  status      VARCHAR(20)  NOT NULL DEFAULT 'terkirim',
  error       VARCHAR(300),
  provider_id VARCHAR(200),
  sent_by     VARCHAR(120),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbt_result_emails_attempt
    ON cbt_result_emails (attempt_id, created_at);

-- ============================================================
-- 6. KOLOM BARU PADA TABEL YANG SUDAH ADA
-- ============================================================
-- Seluruhnya ADD COLUMN IF NOT EXISTS dengan DEFAULT. Baris yang sudah ada
-- terisi sendiri, dan nilainya berarti "fitur ini tidak dipakai".

ALTER TABLE cbt_exams
  ADD COLUMN IF NOT EXISTS rubric_id          INTEGER REFERENCES cbt_rubrics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS record_audio       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS check_similarity   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS similarity_review  INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS similarity_high    INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS auto_email         BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE cbt_attempts
  ADD COLUMN IF NOT EXISTS student_id         INTEGER REFERENCES students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email              VARCHAR(160),
  ADD COLUMN IF NOT EXISTS similarity_score   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS similarity_status  VARCHAR(20) NOT NULL DEFAULT 'bersih',
  -- Nilai yang DISAHKAN dosen, terpisah dari score yang berisi hitungan
  -- mesin. Keduanya ikut ke laporan, dan keduanya perlu: yang pertama
  -- menjawab "berapa nilainya", yang kedua "apakah dosennya mengubah sesuatu".
  ADD COLUMN IF NOT EXISTS final_score        INTEGER,
  ADD COLUMN IF NOT EXISTS approved_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by        VARCHAR(120),
  ADD COLUMN IF NOT EXISTS report_sent_at     TIMESTAMPTZ;

-- ============================================================
-- 7. BUCKET REKAMAN SUARA
-- ============================================================
-- TERTUTUP (public = false), sama seperti bucket bukti kamera. Alamat
-- pemutarnya dibuatkan bertanda tangan berumur satu jam oleh route-nya —
-- cukup untuk satu sesi pemeriksaan, tidak cukup untuk menjadi tautan yang
-- beredar di grup pesan.
--
-- Batas 5 MB per potongan; satu potongan dua puluh detik Opus jauh di
-- bawahnya, dan sisanya ruang untuk peramban yang kurang hemat.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cbt-rekaman', 'cbt-rekaman', FALSE, 5242880,
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
)
ON CONFLICT (id) DO UPDATE
  SET public = FALSE,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;

-- ============================================================
-- PERIKSA HASILNYA
-- ============================================================
-- Jalankan ini sesudah Run selesai. Yang diharapkan: lima tabel baru, dan
-- enam kolom baru pada cbt_exams.

SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN (
     'students', 'cbt_rubrics', 'cbt_rubric_scores', 'cbt_similarity',
     'cbt_recordings', 'cbt_transcript_segments', 'cbt_result_emails'
   )
 ORDER BY table_name;

SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_name = 'cbt_exams'
   AND column_name IN (
     'rubric_id', 'record_audio', 'check_similarity',
     'similarity_review', 'similarity_high', 'auto_email'
   )
 ORDER BY column_name;
