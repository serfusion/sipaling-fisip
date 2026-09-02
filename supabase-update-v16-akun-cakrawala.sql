-- =====================================================================
-- V16 — AKUN LANGGANAN CAKRAWALA (nomor WhatsApp)
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- Langganan pindah dari PERANGKAT ke AKUN. Sebelum ini akses hanya berupa
-- cookie berisi kode: ganti ponsel berarti kehilangan akses, dan perpanjangan
-- tidak punya apa pun untuk ditempeli.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.cakrawala_accounts (
  id            SERIAL PRIMARY KEY,
  whatsapp      VARCHAR(24)  NOT NULL UNIQUE,
  name          VARCHAR(120),
  expires_at    TIMESTAMPTZ  NOT NULL,
  token         VARCHAR(64)  NOT NULL UNIQUE,
  last_code     VARCHAR(40),
  redeem_count  INTEGER      NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ
);

-- Gerbang aksesnya mencari akun lewat token pada tiap permintaan halaman.
CREATE INDEX IF NOT EXISTS idx_cakrawala_accounts_token
  ON public.cakrawala_accounts(token);
-- Panel Super Admin menampilkan yang langganannya hampir habis lebih dulu.
CREATE INDEX IF NOT EXISTS idx_cakrawala_accounts_expires
  ON public.cakrawala_accounts(expires_at);

CREATE TABLE IF NOT EXISTS public.cakrawala_redemptions (
  id          SERIAL PRIMARY KEY,
  -- UNIQUE inilah penguncinya: satu kode hanya dapat ditukar sekali, dan
  -- sesudah itu terikat pada nomor yang menukarkannya.
  code        VARCHAR(40)  NOT NULL UNIQUE,
  account_id  INTEGER      NOT NULL REFERENCES public.cakrawala_accounts(id) ON DELETE CASCADE,
  whatsapp    VARCHAR(24)  NOT NULL,
  days        INTEGER      NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cakrawala_redemptions_akun
  ON public.cakrawala_redemptions(account_id);

ALTER TABLE public.cakrawala_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cakrawala_redemptions ENABLE ROW LEVEL SECURITY;

-- Tanpa policy sama sekali: seluruh pembacaan dan penulisan lewat server
-- memakai service-role key, yang memang melewati RLS. Dengan begitu tidak ada
-- jalan membaca nomor WhatsApp orang lain langsung dari peramban.
