-- =====================================================================
-- V13 — PESANAN AKSES CAKRAWALA
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- Tabel ini menampung percobaan pembelian akses Cakrawala. Kode aksesnya
-- sendiri tetap tersimpan pada app_settings seperti sebelumnya; yang di sini
-- adalah pesanannya, karena pesanan lahir dari orang lain, kapan saja, dan
-- bisa berbarengan — satu baris JSON tidak cukup untuk itu.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.cakrawala_orders (
  id            SERIAL PRIMARY KEY,
  order_code    VARCHAR(20)  NOT NULL UNIQUE,
  package_id    VARCHAR(20)  NOT NULL,
  package_name  VARCHAR(40)  NOT NULL,
  base_price    INTEGER      NOT NULL,
  marker        INTEGER      NOT NULL,
  amount        INTEGER      NOT NULL,
  days          INTEGER      NOT NULL,
  max_devices   INTEGER      NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'menunggu',
  buyer_name    VARCHAR(120),
  buyer_contact VARCHAR(120),
  access_code   VARCHAR(40),
  paid_via      VARCHAR(40),
  paid_at       TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ  NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Halaman beli menanyakan status pesanannya berulang kali, dan pencarian
-- penanda yang masih terpakai berjalan tiap kali ada pesanan baru.
CREATE INDEX IF NOT EXISTS idx_cakrawala_orders_status
  ON public.cakrawala_orders(status);
CREATE INDEX IF NOT EXISTS idx_cakrawala_orders_expires
  ON public.cakrawala_orders(status, expires_at);

-- Satu nominal hanya boleh dipegang satu pesanan yang MASIH MENUNGGU. Inilah
-- yang membuat nominal unik benar-benar unik; tanpa pengunci di tingkat basis
-- data, dua permintaan yang datang pada saat yang sama masih dapat menerima
-- nominal yang sama walaupun kodenya sudah memeriksa lebih dulu.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cakrawala_orders_nominal_hidup
  ON public.cakrawala_orders(amount)
  WHERE status = 'menunggu';

ALTER TABLE public.cakrawala_orders ENABLE ROW LEVEL SECURITY;

-- Tidak ada policy sama sekali: seluruh pembacaan dan penulisan berjalan lewat
-- server memakai service-role key, yang memang melewati RLS. Dengan begitu
-- tidak ada jalan membaca pesanan orang lain langsung dari peramban.
