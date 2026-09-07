-- =====================================================================
-- V27 — CBT: mode pengawasan, jejak insiden, dan skor integritas
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- Yang perlu diketahui lebih dulu, supaya tidak ada yang salah menduga apa
-- yang dibeli dengan migrasi ini:
--
--   PERAMBAN TIDAK DAPAT MELARANG TANGKAPAN LAYAR.
--
-- Tidak ada satu pun API web yang menahan tombol Print Screen, alat potong
-- bawaan sistem, perekam layar, atau ponsel kedua yang diarahkan ke monitor.
-- Yang dibangun di sini karena itu bukan pelarangan, melainkan tiga hal lain
-- yang benar-benar dapat ditegakkan:
--
--   1. MENYULITKAN — salin, potong, tempel, klik kanan, dan seleksi teks
--      dimatikan pada mode ketat. Ini menutup jalan yang paling sering
--      dipakai: menyalin soal ke ChatGPT lalu menempelkan jawabannya kembali.
--   2. MENCATAT    — tiap percobaan tersimpan lengkap dengan jam servernya.
--   3. MENANDAI    — nama, NIM, kode ujian, dan jam ditumpuk samar di atas
--      layar peserta, sehingga tiap lembar yang bocor menunjuk satu orang.
--
-- Tiga tambahan:
--
--   1. cbt_exams.proctor_mode — "biasa" | "ketat" | "sertifikasi".
--   2. Penghitung pelanggaran dan skor integritas di cbt_attempts.
--   3. cbt_incidents — satu baris untuk satu kejadian, dengan jamnya.
-- =====================================================================

-- ---------- 1. Mode pengawasan ----------
-- Bawaannya "biasa", dan itu disengaja: ujian yang sudah berjalan tidak boleh
-- mendadak mengunci layar penuh peserta yang sedang mengerjakannya.
ALTER TABLE public.cbt_exams
  ADD COLUMN IF NOT EXISTS proctor_mode VARCHAR(20) NOT NULL DEFAULT 'biasa';

-- ---------- 2. Penghitung pelanggaran per peserta ----------
-- Diringkas di sini supaya papan pantau yang menampilkan ratusan peserta
-- sekaligus tidak perlu menghitung ulang garis waktu tiap orang.
ALTER TABLE public.cbt_attempts
  ADD COLUMN IF NOT EXISTS blur_count          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS copy_attempts       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paste_attempts      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS screenshot_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS right_clicks        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS devtools_opens      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS second_screens      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS integrity_score     INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS forced_reason       VARCHAR(200);

-- ---------- 3. Garis waktu insiden ----------
-- Penghitung di atas menjawab "berapa kali". Tabel ini menjawab "kapan, dan
-- berurutan seperti apa" — dan itulah yang menentukan artinya. Tiga kali
-- pindah tab yang terpencar sepanjang sembilan puluh menit adalah notifikasi
-- yang muncul sendiri; tiga kali dalam empat puluh detik tepat sesudah soal
-- essay dibuka adalah hal yang lain sama sekali.
CREATE TABLE IF NOT EXISTS public.cbt_incidents (
  id         SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES public.cbt_attempts(id) ON DELETE CASCADE,
  kind       VARCHAR(20) NOT NULL,
  -- Jam SERVER, bukan jam yang dikirim peramban. Peserta yang memutar mundur
  -- jam perangkatnya akan menyusun garis waktu yang rapi dan sepenuhnya palsu,
  -- dan garis waktu itulah satu-satunya hal yang dibaca penguji.
  at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detail     VARCHAR(200)
);

CREATE INDEX IF NOT EXISTS idx_cbt_incidents_attempt
  ON public.cbt_incidents (attempt_id, at);

-- ---------- 4. Kunci pintu ----------
-- RLS menyala TANPA satu pun kebijakan, sama seperti tabel CBT yang lain.
-- Artinya: tidak ada satu pun peramban yang dapat membaca atau menulis tabel
-- ini langsung. Yang menyentuhnya hanya server, memakai kunci service-role.
--
-- Ini penting justru di tabel ini. Baris di sini adalah BUKTI, dan bukti yang
-- dapat disunting oleh orang yang sedang diperiksa bukan bukti sama sekali.
ALTER TABLE public.cbt_incidents ENABLE ROW LEVEL SECURITY;
