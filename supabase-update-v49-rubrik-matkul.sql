-- ============================================================
-- SiPaling FISIP - UPDATE DATABASE v49
-- CBT: satu rubrik untuk satu mata kuliah, esai dinilai AI
--
-- Jalankan SELURUH isi file ini di Supabase, SQL Editor, Run.
-- Aman dijalankan berulang kali.
-- ============================================================
--
-- APA YANG BERUBAH
--
-- 1. Rubrik dipasang SEKALI pada mata kuliahnya, bukan berulang pada tiap
--    ujian. Seluruh ujian dengan nama mata kuliah yang sama memakai rubrik
--    itu, termasuk ujian yang sudah dibuat sebelumnya.
-- 2. Jawaban acuan pengajar DIHAPUS dari portal. Rubrik mata kuliah menjadi
--    satu-satunya acuan penilaian esai.
-- 3. Esai dinilai AI (Gemini, ChatGPT, atau Claude, mana pun yang kuncinya
--    terpasang di Dashboard Super Admin → Kunci AI) terhadap rubrik itu,
--    segera sesudah peserta mengumpulkan.
--
-- ------------------------------------------------------------
-- YANG DIKERJAKAN FILE INI
-- ------------------------------------------------------------
-- Satu tabel baru, cbt_course_rubrics, lalu ISINYA DIAMBIL DARI RUBRIK YANG
-- SUDAH DIPASANG pada ujian-ujian lama. Mata kuliah yang ujiannya sudah
-- memakai rubrik langsung punya rubrik mata kuliah tanpa ada yang perlu
-- memasangnya lagi.
--
-- Bila satu mata kuliah punya beberapa ujian dengan rubrik BERBEDA, yang
-- dipakai rubrik dari ujian yang paling akhir diubah. Pengajarnya dapat
-- menggantinya kapan saja di menu CBT → Rubrik penilaian.
--
-- ------------------------------------------------------------
-- YANG TIDAK DISENTUH
-- ------------------------------------------------------------
-- - Kolom lama cbt_exams.rubric_id dan cbt_exams.answer_key_id, serta tabel
--   cbt_answer_keys. Portal tidak membacanya lagi, tetapi isinya dibiarkan:
--   langkah 2 di bawah membaca rubric_id, dan membuangnya berarti file ini
--   tidak dapat dijalankan ulang. Bila ingin benar-benar menghapus data
--   jawaban acuan, lihat langkah 4 (opsional, tidak dijalankan otomatis).
-- - Nilai yang sudah ada. Skor rubrik, poin, dan pengesahan tetap seperti
--   semula. Esai yang dahulu dinilai jawaban acuan atau penilai tanpa model
--   dan BELUM disahkan pengajar akan dinilai ulang AI ketika papan pantau
--   ujiannya dibuka. Yang sudah disahkan tidak disentuh.
--
-- ------------------------------------------------------------
-- YANG PERLU DISIAPKAN DI LUAR SQL INI
-- ------------------------------------------------------------
-- Minimal satu kunci AI di Dashboard Super Admin → Kunci AI. Tanpa kunci,
-- esai tetap tersimpan dan menunggu dinilai; papan pantau mengatakannya.

BEGIN;

-- ============================================================
-- 1. RUBRIK TIAP MATA KULIAH
-- ============================================================
CREATE TABLE IF NOT EXISTS cbt_course_rubrics (
  -- Nama mata kuliah yang DINORMALKAN: huruf kecil, spasi tunggal, tanpa
  -- spasi di ujung. Nama mata kuliah diketik bebas pada tiap ujian, dan
  -- "Sosiologi Politik" dengan "sosiologi  politik" adalah mata kuliah yang
  -- sama. Tanda baca tidak dibuang: "Statistik I" dan "Statistik II" tetap
  -- dua mata kuliah.
  --
  -- Rumusnya HARUS sama dengan kunciMatkul() di src/lib/penilaian-ai.ts.
  course_key   VARCHAR(160) PRIMARY KEY,
  -- Ejaan yang tampil di layar.
  course_name  VARCHAR(120) NOT NULL,
  -- ON DELETE CASCADE: rubrik yang dihapus langsung dari SQL Editor ikut
  -- melepas mata kuliahnya, bukan meninggalkan rujukan ke baris yang tidak
  -- ada. Jalur API tetap menolak menghapus rubrik yang masih dipakai mata
  -- kuliah, dan penolakannya menyebut berapa.
  rubric_id    INTEGER      NOT NULL REFERENCES cbt_rubrics(id) ON DELETE CASCADE,
  set_by       VARCHAR(120) NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Menu rubrik menghitung berapa mata kuliah memakai tiap rubrik, dan
-- penghapusan rubrik memeriksanya lebih dulu.
CREATE INDEX IF NOT EXISTS idx_cbt_course_rubrics_rubrik
    ON cbt_course_rubrics (rubric_id);

-- ============================================================
-- 2. ISI DARI RUBRIK YANG SUDAH DIPASANG PADA UJIAN LAMA
-- ============================================================
-- Hanya mengisi mata kuliah yang BELUM punya rubrik mata kuliah, jadi
-- menjalankan file ini lagi tidak menimpa rubrik yang sudah dipilih pengajar
-- lewat portal.
INSERT INTO cbt_course_rubrics (course_key, course_name, rubric_id, set_by, updated_at)
SELECT DISTINCT ON (kunci)
       kunci,
       LEFT(btrim(regexp_replace(e.course_name, '\s+', ' ', 'g')), 120),
       e.rubric_id,
       'Dipindahkan dari ujian ' || e.code,
       NOW()
  FROM (
        SELECT e.*,
               LEFT(lower(btrim(regexp_replace(e.course_name, '\s+', ' ', 'g'))), 160) AS kunci
          FROM cbt_exams e
         WHERE e.rubric_id IS NOT NULL
       ) e
  JOIN cbt_rubrics r ON r.id = e.rubric_id
 WHERE e.kunci <> ''
 ORDER BY kunci, e.updated_at DESC, e.id DESC
ON CONFLICT (course_key) DO NOTHING;

COMMIT;

-- ============================================================
-- 3. PEMERIKSAAN
-- ============================================================
-- Jalankan ini sesudah Run selesai. Yang diharapkan: satu baris untuk tiap
-- mata kuliah yang ujiannya dahulu memakai rubrik.

SELECT c.course_name AS mata_kuliah, r.name AS rubrik, c.set_by AS dipasang
  FROM cbt_course_rubrics c
  JOIN cbt_rubrics r ON r.id = c.rubric_id
 ORDER BY c.course_name;

-- Mata kuliah yang BELUM punya rubrik, beserta jumlah ujiannya. Esai ujian
-- mata kuliah ini tidak dinilai AI sampai rubriknya dipasang di menu
-- CBT → Rubrik penilaian.
SELECT MIN(btrim(e.course_name)) AS mata_kuliah, COUNT(*) AS jumlah_ujian
  FROM cbt_exams e
 WHERE NOT EXISTS (
         SELECT 1 FROM cbt_course_rubrics c
          WHERE c.course_key = LEFT(lower(btrim(regexp_replace(e.course_name, '\s+', ' ', 'g'))), 160)
       )
 GROUP BY LEFT(lower(btrim(regexp_replace(e.course_name, '\s+', ' ', 'g'))), 160)
 ORDER BY 1;

-- ============================================================
-- 4. OPSIONAL: HAPUS DATA JAWABAN ACUAN
-- ============================================================
-- Portal sudah tidak membaca jawaban acuan sama sekali. Baris di bawah
-- MENGHAPUS datanya secara permanen dan tidak dapat dibatalkan, jadi sengaja
-- dibiarkan sebagai komentar. Hapus tanda "--" di depan dua baris itu lalu
-- jalankan HANYA bila Anda yakin tidak memerlukannya lagi.
--
-- ALTER TABLE cbt_exams DROP COLUMN IF EXISTS answer_key_id;
-- DROP TABLE IF EXISTS cbt_answer_keys;
