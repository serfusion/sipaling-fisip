-- =====================================================================
-- V29 — CBT: saklar kamera pengawas
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- Satu kolom saja, tetapi yang penting bukan kolomnya melainkan SIAPA yang
-- boleh menggesernya: Admin dan Super Admin, bukan dosen pemilik ujiannya.
--
-- Ini satu-satunya wewenang CBT yang justru menjauh dari pemilik ujian.
-- Wewenang yang lain — menjadwalkan, mengaktifkan, menyusun soal — memang
-- milik dosennya, karena hanya ia yang tahu kelasnya sudah siap. Menyalakan
-- kamera lain persoalannya: yang dilakukan bukan mengatur ujian melainkan
-- MEREKAM WAJAH ORANG, dan yang menanggung akibatnya bila keliru adalah
-- lembaganya, bukan dosen itu sendiri.
--
-- Admin bagian — umum, akademik, prodi, PDDIKTI, perpustakaan, laboratorium —
-- tidak termasuk, sama seperti mereka tidak menyentuh menu CBT sama sekali.
--
-- Bawaannya TRUE, jadi tidak ada ujian sertifikasi yang berubah perilakunya
-- karena migrasi ini. Saklarnya ada untuk mematikan, bukan untuk menyalakan.
-- =====================================================================

ALTER TABLE public.cbt_exams
  ADD COLUMN IF NOT EXISTS camera_on BOOLEAN NOT NULL DEFAULT TRUE;
