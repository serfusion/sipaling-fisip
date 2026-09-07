-- =====================================================================
-- V31 - CBT: Exam Browser per perangkat
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- Satu kolom. Ia hanya berarti bila require_lockdown menyala, dan menjawab
-- satu pertanyaan yang tidak terjawab oleh saklar itu sendiri: perangkat mana
-- yang wajib memakai Exam Browser.
--
--   semua   - Android atau Windows, dua-duanya diterima.
--   android - hanya aplikasi Android. Untuk kelas yang seluruhnya memakai HP.
--   windows - hanya aplikasi Windows. Untuk laboratorium komputer.
--
-- Bawaannya "semua" supaya ujian yang sudah menyalakan require_lockdown tidak
-- berubah perilakunya sama sekali sesudah kolom ini ada.
-- =====================================================================

ALTER TABLE public.cbt_exams
  ADD COLUMN IF NOT EXISTS lockdown_device VARCHAR(16) NOT NULL DEFAULT 'semua';
