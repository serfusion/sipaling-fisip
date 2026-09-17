-- ============================================================
-- SiPaling FISIP — UPDATE DATABASE v43
-- Penyerahan Skripsi/Jurnal: unggah langsung ke penyimpanan
--
-- Jalankan SELURUH isi file ini di Supabase → SQL Editor → Run.
-- Aman dijalankan berulang kali.
-- ============================================================
--
-- KENAPA PERLU DIJALANKAN
--
-- Bucket "service-documents" dibuat dengan batas 10 MB per berkas. Portal
-- sementara itu MENGIZINKAN berkas "Skripsi full format PDF" sampai 25 MB —
-- dan memang seharusnya, karena satu skripsi utuh memang sebesar itu.
--
-- Akibatnya berkas 10 sampai 25 MB lolos seluruh pemeriksaan portal, sampai
-- akhirnya ditolak Supabase sendiri pada langkah terakhir. Yang terbaca
-- mahasiswa hanya kegagalan di ujung proses, sesudah menunggu unggahan
-- selesai — dan tidak ada satu pun pesan portal yang dapat menjelaskannya,
-- karena portal memang menganggap berkas itu sah.
--
-- Batas bucket dinaikkan ke 25 MB supaya cocok dengan MAKS_FULL_MB pada
-- src/lib/bukti-penyerahan.ts. Batas per bagian TETAP ditegakkan portal
-- (10 MB untuk tiga bagian pertama, 25 MB untuk berkas utuh); yang diubah di
-- sini hanya langit-langit penyimpanannya.

BEGIN;

UPDATE storage.buckets
   SET file_size_limit = 26214400,   -- 25 MB, sama dengan MAKS_FULL_MB
       allowed_mime_types = ARRAY[
         'application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       ]
 WHERE id = 'service-documents';

COMMIT;


-- ============================================================
-- PEMERIKSAAN HASIL
-- ============================================================
-- Hasil yang benar: public = false dan file_size_limit = 26214400.
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'service-documents';


-- ============================================================
-- CATATAN: TIDAK ADA POLICY BARU YANG PERLU DIBUAT
-- ============================================================
-- Unggahan langsung dari peramban memakai "signed upload URL" yang dibuat
-- server dengan service role key. Token itu berlaku untuk SATU jalur saja,
-- berumur pendek, dan pemeriksaannya dikerjakan Storage sendiri — bukan lewat
-- policy RLS. Bucket tetap privat dan tetap tidak membuka akses untuk anon.
