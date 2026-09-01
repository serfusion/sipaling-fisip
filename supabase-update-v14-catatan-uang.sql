-- =====================================================================
-- V14 - CATATAN UANG (pemasukan dan pengeluaran lewat pesan)
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- Tiga tabel:
--   money_books    buku kas milik satu orang, dikunci oleh kodenya
--   money_entries  isi bukunya, satu baris satu pesan yang sudah diurai
--   money_channels percakapan Telegram yang sudah ditautkan ke sebuah buku
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.money_books (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(24) NOT NULL UNIQUE,
  name         VARCHAR(80) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.money_entries (
  id         SERIAL PRIMARY KEY,
  book_id    INTEGER     NOT NULL REFERENCES public.money_books(id) ON DELETE CASCADE,
  direction  VARCHAR(8)  NOT NULL,
  -- BIGINT, bukan INTEGER: batas INTEGER ada di 2,1 miliar dan satu baris
  -- "jual tanah 3 miliar" sudah cukup untuk menabraknya.
  amount     BIGINT      NOT NULL,
  category   VARCHAR(24) NOT NULL,
  note       VARCHAR(200) NOT NULL,
  -- Tanggal kejadian menurut WIB, "YYYY-MM-DD". Teks, bukan timestamp,
  -- supaya ringkasan bulanan tidak bergeser gara-gara server berjalan di UTC.
  entry_date VARCHAR(10) NOT NULL,
  source     VARCHAR(20) NOT NULL DEFAULT 'web',
  raw_text   VARCHAR(400),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.money_channels (
  id          SERIAL PRIMARY KEY,
  book_id     INTEGER     NOT NULL REFERENCES public.money_books(id) ON DELETE CASCADE,
  kind        VARCHAR(20) NOT NULL,
  external_id VARCHAR(64) NOT NULL,
  label       VARCHAR(120),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seluruh pembacaan selalu berbentuk "isi buku ini pada bulan itu".
CREATE INDEX IF NOT EXISTS idx_money_entries_buku_tanggal
  ON public.money_entries(book_id, entry_date DESC, id DESC);

-- Satu percakapan hanya boleh menunjuk ke satu buku. Tanpa pengunci ini,
-- dua pesan /daftar yang datang berbarengan meninggalkan dua tautan pada
-- percakapan yang sama, dan pesan berikutnya masuk ke buku yang salah.
CREATE UNIQUE INDEX IF NOT EXISTS idx_money_channels_kanal
  ON public.money_channels(kind, external_id);

ALTER TABLE public.money_books    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.money_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.money_channels ENABLE ROW LEVEL SECURITY;

-- Tanpa policy sama sekali, persis seperti cakrawala_orders: semua pembacaan
-- dan penulisan lewat server, dan tidak ada jalan membaca buku orang lain
-- langsung dari peramban walaupun kunci anon-nya diketahui.
