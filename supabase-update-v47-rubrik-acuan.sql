-- ============================================================
-- SiPaling FISIP - UPDATE DATABASE v47
-- CBT: kunci jawaban acuan dosen, penilai esai berbasis TF-IDF
--
-- Jalankan SELURUH isi file ini di Supabase, SQL Editor, Run.
-- Aman dijalankan berulang kali.
-- ============================================================
--
-- APA YANG BERUBAH UNTUK UJIAN YANG SUDAH ADA
--
-- TIDAK ADA. Syarat yang sama dengan v44, dan alasannya sama: migrasi ini
-- dijalankan pada portal yang ujiannya mungkin dijadwalkan besok pagi.
--
--   answer_key_id  NULL  ->  esai dinilai persis seperti sebelumnya
--
-- Satu tabel baru yang boleh kosong selamanya, dan satu kolom baru yang
-- bawaannya NULL. Ujian yang berjalan hari ini berjalan sama persis sesudah
-- ini dijalankan.
--
-- ------------------------------------------------------------
-- APA YANG DITAMBAHKAN, DAN KENAPA
-- ------------------------------------------------------------
-- Rubrik mengukur BENTUK jawaban: panjangnya, susunannya, berapa istilah soal
-- yang muncul. Tidak satu pun di antaranya tahu apakah isinya benar, jadi
-- jawaban dua ratus kata yang melantur bernilai sama dengan jawaban dua ratus
-- kata yang tepat.
--
-- Kunci jawaban acuan mengukur ISI. Dosen menuliskan jawaban yang ia harapkan,
-- lalu jawaban peserta diukur kedekatannya dengan acuan itu memakai cosine
-- similarity atas bobot kata TF-IDF. Seluruh perhitungannya berjalan di server
-- portal ini, tanpa model bahasa, tanpa kunci API, dan tanpa biaya.
--
-- Keduanya BERDAMPINGAN, bukan saling menggantikan, dan boleh menyala
-- bersama-sama pada satu ujian. Dosen yang memakai keduanya mendapat dua
-- pembacaan atas lembar yang sama, dan lembar yang kedua pembacaannya
-- berselisih adalah justru lembar yang paling perlu ia baca sendiri.
--
-- ------------------------------------------------------------
-- YANG PERLU DISIAPKAN DI LUAR SQL INI
-- ------------------------------------------------------------
-- Tidak ada. Tanpa kunci API mana pun, tanpa bucket baru, tanpa environment
-- baru. Ini satu-satunya bagian penilaian esai pada portal ini yang tidak
-- bergantung pada apa pun di luar basis datanya sendiri.

BEGIN;

-- ============================================================
-- 1. PUSTAKA KUNCI JAWABAN ACUAN
-- ============================================================
CREATE TABLE IF NOT EXISTS cbt_answer_keys (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(160) NOT NULL,
  description     TEXT,
  -- Dua ambang kurva nilai, dalam persen kemiripan.
  --
  -- Disimpan per acuan, bukan tetap di dalam kode, karena soal yang jawabannya
  -- sempit dan soal yang jawabannya terbuka tidak dapat memakai ambang yang
  -- sama.
  --
  -- Nilai penuh sengaja TIDAK menunggu kemiripan seratus persen. Kemiripan
  -- satu hanya dicapai jawaban yang menyalin acuan kata demi kata, dan
  -- menuntutnya berarti memberi nilai tertinggi kepada yang menghafal lalu
  -- menghukum yang memahami dan menuliskannya dengan kalimat sendiri.
  zero_threshold  INTEGER      NOT NULL DEFAULT 15,
  full_threshold  INTEGER      NOT NULL DEFAULT 65,
  -- Butir acuan beserta bobot dan istilah wajibnya, sebagai JSON.
  --
  -- Alasan yang sama dengan kolom criteria pada cbt_rubrics: satu acuan selalu
  -- dibaca utuh dan tidak pernah dipertanyakan per butir lewat SQL. Tabel anak
  -- hanya menambah satu penggabungan pada tiap pembacaan tanpa menjawab satu
  -- pertanyaan pun yang tidak terjawab sekarang.
  items           TEXT         NOT NULL DEFAULT '[]',
  owner_id        VARCHAR(64),
  created_by      VARCHAR(120) NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Daftar acuan selalu dibaca terurut menurut kapan terakhir disunting, dan
-- yang baru diubah muncul paling atas. Tanpa indeks ini, tiap pembukaan menu
-- mengurutkan seluruh tabel.
CREATE INDEX IF NOT EXISTS idx_cbt_answer_keys_diubah
    ON cbt_answer_keys (updated_at DESC);

-- ============================================================
-- 2. UJIAN MENUNJUK SATU ACUAN
-- ============================================================
ALTER TABLE cbt_exams
  ADD COLUMN IF NOT EXISTS answer_key_id INTEGER
      REFERENCES cbt_answer_keys(id) ON DELETE SET NULL;

-- ON DELETE SET NULL, bukan CASCADE, dan itu disengaja.
--
-- Menghapus satu acuan tidak boleh menghapus ujiannya. Yang terjadi bila
-- acuannya hilang adalah ujian itu kembali dinilai seperti sebelum v47, yaitu
-- dosen mengetik angkanya sendiri. Itu kemunduran yang dapat dijelaskan;
-- ujian yang lenyap tidak.
--
-- Jalur API tetap menolak menghapus acuan yang masih dipakai ujian, dan
-- penolakannya menyebut berapa ujian. Baris ini hanya jaring terakhir untuk
-- penghapusan yang terjadi langsung di SQL Editor.

CREATE INDEX IF NOT EXISTS idx_cbt_exams_acuan
    ON cbt_exams (answer_key_id)
 WHERE answer_key_id IS NOT NULL;

COMMIT;

-- ============================================================
-- PEMERIKSAAN
-- ============================================================
-- Jalankan ini sesudah Run selesai. Yang diharapkan: satu tabel baru, dan
-- satu kolom baru pada cbt_exams.

SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name = 'cbt_answer_keys';

SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'cbt_exams'
   AND column_name = 'answer_key_id';
