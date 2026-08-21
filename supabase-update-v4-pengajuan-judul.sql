-- =====================================================================
-- SiPaling FISIP — UPDATE DATABASE v4
-- Pengajuan Judul Tugas Akhir, Notifikasi, dan Database Dokumen Terpusat
--
-- Jalankan SELURUH isi file ini di Supabase -> SQL Editor -> Run.
-- Aman dijalankan berulang kali (idempotent).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) Pengajuan Judul Tugas Akhir
--    Mahasiswa mengisi template -> Admin Prodi memverifikasi berkas dan
--    memilih 1 dari 3 dosen usulan -> dosen menerima atau menolak.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.title_proposals (
  id                   serial PRIMARY KEY,
  code                 varchar(80)  NOT NULL UNIQUE,
  nim                  varchar(32)  NOT NULL,
  student_name         varchar(160) NOT NULL,
  address              text         NOT NULL,
  study_program        varchar(120) NOT NULL,
  concentration        varchar(160) NOT NULL,
  gpa                  numeric(3,2) NOT NULL,
  final_task_type      varchar(20)  NOT NULL,
  title                text         NOT NULL,
  statement            text         NOT NULL,
  contact              varchar(160),
  payment_file_name    varchar(255),
  payment_file_mime    varchar(160),
  payment_file_size    integer,
  payment_storage_path text,
  finance_verified     boolean      NOT NULL DEFAULT false,
  eligibility_verified boolean      NOT NULL DEFAULT false,
  status               varchar(60)  NOT NULL DEFAULT 'Menunggu Verifikasi Prodi',
  approved_lecturer_id integer      REFERENCES public.lecturers (id) ON DELETE SET NULL,
  prodi_note           text,
  lecturer_note        text,
  reviewed_by          varchar(160),
  reviewed_at          timestamptz,
  decided_at           timestamptz,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS title_proposals_status_idx   ON public.title_proposals (status);
CREATE INDEX IF NOT EXISTS title_proposals_nim_idx      ON public.title_proposals (nim);
CREATE INDEX IF NOT EXISTS title_proposals_lecturer_idx ON public.title_proposals (approved_lecturer_id);

-- Tiga dosen usulan mahasiswa untuk satu pengajuan.
CREATE TABLE IF NOT EXISTS public.title_proposal_choices (
  id            serial PRIMARY KEY,
  proposal_id   integer     NOT NULL REFERENCES public.title_proposals (id) ON DELETE CASCADE,
  lecturer_id   integer     NOT NULL REFERENCES public.lecturers (id) ON DELETE CASCADE,
  choice_order  integer     NOT NULL,
  selected      boolean     NOT NULL DEFAULT false,
  decision      varchar(20) NOT NULL DEFAULT 'Menunggu',
  decision_note text,
  decided_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS title_proposal_choices_proposal_idx ON public.title_proposal_choices (proposal_id);
CREATE INDEX IF NOT EXISTS title_proposal_choices_lecturer_idx ON public.title_proposal_choices (lecturer_id);

-- Satu dosen hanya boleh muncul sekali pada satu pengajuan.
CREATE UNIQUE INDEX IF NOT EXISTS title_proposal_choices_unique
  ON public.title_proposal_choices (proposal_id, lecturer_id);

-- ---------------------------------------------------------------------
-- 2) Notifikasi internal
--    Ditujukan ke satu dosen (lecturer_id) ATAU ke seluruh pemegang role
--    tertentu (audience_role, mis. 'admin_prodi').
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id            serial PRIMARY KEY,
  audience_role varchar(40),
  lecturer_id   integer     REFERENCES public.lecturers (id) ON DELETE CASCADE,
  kind          varchar(40) NOT NULL,
  severity      varchar(20) NOT NULL DEFAULT 'info',
  title         varchar(200) NOT NULL,
  body          text        NOT NULL,
  ref_code      varchar(80),
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_lecturer_idx ON public.notifications (lecturer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_role_idx     ON public.notifications (audience_role, created_at DESC);

-- ---------------------------------------------------------------------
-- 3) Database dokumen terpusat
--    Surat tugas, sertifikat, sertifikasi, publikasi jurnal, artikel
--    ilmiah, dst. File tetap di Google Drive; di sini hanya metadata.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_records (
  id                  serial PRIMARY KEY,
  category            varchar(60)  NOT NULL,
  title               text         NOT NULL,
  description         text,
  drive_url           text         NOT NULL,
  document_date       varchar(20),
  added_by_profile_id varchar(64),
  added_by_name       varchar(160) NOT NULL,
  added_by_role       varchar(40)  NOT NULL,
  created_at          timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_records_category_idx ON public.document_records (category);
CREATE INDEX IF NOT EXISTS document_records_created_idx  ON public.document_records (created_at DESC);

CREATE TABLE IF NOT EXISTS public.document_contributors (
  id          serial PRIMARY KEY,
  document_id integer     NOT NULL REFERENCES public.document_records (id) ON DELETE CASCADE,
  lecturer_id integer     NOT NULL REFERENCES public.lecturers (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_contributors_document_idx ON public.document_contributors (document_id);
CREATE INDEX IF NOT EXISTS document_contributors_lecturer_idx ON public.document_contributors (lecturer_id);
CREATE UNIQUE INDEX IF NOT EXISTS document_contributors_unique
  ON public.document_contributors (document_id, lecturer_id);

-- ---------------------------------------------------------------------
-- 4) Row Level Security untuk tabel baru.
--    Aplikasi tetap berjalan karena server memakai DATABASE_URL /
--    secret key, sedangkan kunci publik (anon) tidak bisa membaca apa pun.
-- ---------------------------------------------------------------------
ALTER TABLE public.title_proposals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.title_proposal_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_contributors  ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ---------------------------------------------------------------------
-- 5) Bucket penyimpanan bukti keuangan pengajuan judul.
--    Bucket privat: hanya bisa diakses lewat signed URL dari server.
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-documents',
  'service-documents',
  FALSE,
  10485760,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 6) Ganti nama layanan lama "Layanan Skripsi / Jurnal" menjadi
--    "Layanan Tugas Akhir" agar tiket lama tetap terlihat oleh unit yang
--    sama setelah pembaruan nama menu di portal.
-- ---------------------------------------------------------------------
UPDATE public.service_requests
SET service_type = 'Layanan Tugas Akhir'
WHERE service_type = 'Layanan Skripsi / Jurnal';

-- ---------------------------------------------------------------------
-- Pemeriksaan akhir — kelima tabel di bawah harus muncul.
-- ---------------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'title_proposals',
    'title_proposal_choices',
    'notifications',
    'document_records',
    'document_contributors'
  )
ORDER BY table_name;
