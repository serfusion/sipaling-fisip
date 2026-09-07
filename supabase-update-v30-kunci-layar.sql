-- =====================================================================
-- V30 — CBT: kunci tangkapan layar
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- Dua kolom, dan keduanya berdiri di atas satu kenyataan yang tidak dapat
-- ditawar:
--
--   PERAMBAN TIDAK DAPAT MELARANG TANGKAPAN LAYAR. SISTEM OPERASI DAPAT.
--
-- Tidak ada satu pun API web yang menahan Print Screen, alat potong bawaan,
-- perekam layar, apalagi tombol Volume+Power di ponsel. Yang benar-benar
-- menolak ada di lapisan aplikasi, dan sistem operasinya sudah menyediakannya:
-- FLAG_SECURE di Android, SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) di
-- Windows. Aplikasinya ada di dalam lockdown/ pada repositori ini.
--
--   require_lockdown — ujian ini HANYA boleh dikerjakan lewat aplikasi itu.
--                      Peserta yang membukanya dari peramban ditolak di
--                      gerbang masuk, dengan kalimat yang menyebutkan apa yang
--                      harus ia unduh.
--
--                      Bawaannya FALSE, dan itu disengaja. Menyalakannya
--                      berarti setiap peserta harus memasang aplikasi lebih
--                      dulu; ujian yang menyalakannya tanpa memberi tahu
--                      kelasnya sehari sebelumnya akan menolak SELURUH
--                      pesertanya pada pagi hari pelaksanaan.
--
--   client_type      — perangkat yang benar-benar dipakai tiap peserta.
--                      Disimpan pada barisnya, bukan disimpulkan ulang dari
--                      User-Agent ketika laporannya dibaca: inilah satu-satunya
--                      jawaban atas pertanyaan yang muncul ketika hasil ujian
--                      digugat berbulan-bulan kemudian — layar peserta ini
--                      terkunci atau tidak.
--
-- Percobaan lama diberi nilai "peramban", karena memang itulah yang terjadi:
-- semuanya dikerjakan sebelum aplikasi terkuncinya ada.
-- =====================================================================

ALTER TABLE public.cbt_exams
  ADD COLUMN IF NOT EXISTS require_lockdown BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.cbt_attempts
  ADD COLUMN IF NOT EXISTS client_type VARCHAR(20) NOT NULL DEFAULT 'peramban';
