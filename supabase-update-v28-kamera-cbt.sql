-- =====================================================================
-- V28 — CBT: pengawasan kamera untuk ujian sertifikasi dan OSCE
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- YANG DISIMPAN, DAN YANG TIDAK
--
-- Cuplikan kamera diambil tiap dua puluh detik, diperiksa, lalu DIBUANG.
-- Yang tersimpan HANYA cuplikan yang memang bermasalah, sebagai bukti.
-- Wajah ratusan orang yang tidak berbuat apa-apa tidak menjadi arsip yang
-- harus dijaga berbulan-bulan demi sengketa yang mungkin tidak pernah datang.
--
-- Sebagian besar pemeriksaan tidak memanggil model sama sekali. Lensa yang
-- tertutup dan gambar yang beku terbaca dari angka pikselnya, di perangkat
-- pesertanya, tanpa satu byte pun meninggalkan perangkat itu. Model hanya
-- dipanggil untuk yang benar-benar meragukan — dan jatahnya per peserta
-- dibatasi di kolom ai_checks di bawah, karena batas itu adalah batas UANG.
--
-- Tiga tambahan:
--
--   1. Penghitung insiden kamera dan jatah pemeriksaan model di cbt_attempts.
--   2. cbt_incidents.evidence — nama berkas cuplikan yang disimpan.
--   3. Bucket cbt-bukti, TERTUTUP. Berbeda dari cbt-media yang publik.
-- =====================================================================

-- ---------- 1. Penghitung kamera ----------
ALTER TABLE public.cbt_attempts
  ADD COLUMN IF NOT EXISTS camera_off     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS camera_covered INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS camera_frozen  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS face_missing   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_person   INTEGER NOT NULL DEFAULT 0,
  -- Jatah pemeriksaan model per peserta. Ditegakkan SERVER, bukan peramban:
  -- peramban peserta dapat disuruh mengirim seribu cuplikan, dan yang
  -- membayarnya pemilik portal.
  ADD COLUMN IF NOT EXISTS ai_checks      INTEGER NOT NULL DEFAULT 0;

-- ---------- 2. Bukti pada garis waktu ----------
ALTER TABLE public.cbt_incidents
  ADD COLUMN IF NOT EXISTS evidence VARCHAR(200);

-- ---------- 3. Bucket bukti — TERTUTUP ----------
-- Berbeda dari cbt-media yang sengaja publik (gambar soal harus terbuka untuk
-- mahasiswa tanpa akun). Bucket ini berisi wajah orang, dan yang boleh
-- melihatnya hanya penguji lewat URL bertanda tangan yang dibuat server.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cbt-bukti', 'cbt-bukti', FALSE, 5242880)
ON CONFLICT (id) DO UPDATE
  SET public = FALSE, file_size_limit = 5242880;

-- TIDAK ADA kebijakan SELECT di sini, dan itu disengaja. Tanpa kebijakan,
-- tidak ada satu pun peramban yang dapat membaca bucket ini langsung —
-- yang menyentuhnya hanya server memakai kunci service-role, yang kemudian
-- membuatkan URL bertanda tangan berumur pendek untuk penguji.
DROP POLICY IF EXISTS "cbt bukti dapat dibaca umum" ON storage.objects;
