-- =====================================================================
-- V18 — KLAIM PEMBAYARAN & CATATAN MUTASI
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- Dua hal yang ditambahkan:
--   1. Tombol "Saya sudah membayar" perlu tempat mencatat kapan diklaim.
--   2. Setiap pemberitahuan uang masuk dicatat, cocok maupun tidak, supaya
--      pemiliknya dapat melihat apakah jembatan dari ponselnya benar-benar
--      hidup — dan supaya klaim dapat diperiksa ulang terhadap catatan itu.
-- =====================================================================

ALTER TABLE public.cakrawala_orders
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Pesanan yang diklaim diangkat ke puncak panel, jadi ia dicari berdasarkan
-- kolom ini setiap kali panelnya dibuka.
CREATE INDEX IF NOT EXISTS idx_cakrawala_orders_claimed
  ON public.cakrawala_orders(claimed_at)
  WHERE claimed_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cakrawala_mutations (
  id          SERIAL PRIMARY KEY,
  amount      INTEGER      NOT NULL,
  text        VARCHAR(400) NOT NULL,
  incoming    BOOLEAN      NOT NULL DEFAULT TRUE,
  order_code  VARCHAR(20),
  -- "cocok" | "tanpa-pesanan" | "bukan-masuk" | "sudah-lunas" | "batal"
  result      VARCHAR(20)  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Klaim mencari mutasi bernominal sama dalam beberapa jam terakhir.
CREATE INDEX IF NOT EXISTS idx_cakrawala_mutations_amount
  ON public.cakrawala_mutations(amount, created_at DESC);
-- Panel menampilkan yang terbaru lebih dulu.
CREATE INDEX IF NOT EXISTS idx_cakrawala_mutations_waktu
  ON public.cakrawala_mutations(created_at DESC);

ALTER TABLE public.cakrawala_mutations ENABLE ROW LEVEL SECURITY;

-- Tanpa policy sama sekali: seluruh pembacaan lewat server memakai
-- service-role key. Kalimat pemberitahuan memuat nama pengirim uang, dan itu
-- tidak boleh terbaca langsung dari peramban siapa pun.
