-- =====================================================================
-- V15 - CATATAN UANG: buku milik pelanggan Cakrawala
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang. Jalankan
-- supabase-update-v14-catatan-uang.sql lebih dulu.
--
-- Satu kolom saja: penanda pemilik dari luar. Pelanggan Cakrawala yang
-- membuka panel Catatan Uang di ponsel dan di laptop harus mendapat buku
-- yang sama, dan yang menyamakannya adalah sidik kode aksesnya.
-- =====================================================================

ALTER TABLE public.money_books
  ADD COLUMN IF NOT EXISTS owner_key VARCHAR(80);

-- Satu penanda hanya boleh memiliki satu buku. Tanpa pengunci ini, dua
-- perangkat yang membuka panelnya pada saat yang sama membuat dua buku, dan
-- catatan pemiliknya terbelah dua tanpa ia pernah tahu.
CREATE UNIQUE INDEX IF NOT EXISTS idx_money_books_pemilik
  ON public.money_books(owner_key)
  WHERE owner_key IS NOT NULL;
