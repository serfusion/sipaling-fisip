-- =====================================================================
-- V35 — OUTREACH ULTRAMAILER SYSTEM (OUS)
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
--
-- Undangan terpersonalisasi untuk jurnal yang diurus fakultas. Pemakai
-- pertamanya pengurus NYIMAK; menunya dibuka per dosen oleh Super Admin,
-- bukan untuk seluruh dosen sekaligus.
--
-- Yang perlu diketahui sebelum menjalankan:
--
--   * Tidak ada satu baris pun di sini yang mengirim email. Pengiriman
--     dilakukan server lewat API penyedia, dan saklarnya ada di tabel
--     app_settings — baris terakhir berkas ini yang menyiapkannya, dalam
--     keadaan MATI dan MODE SIMULASI.
--
--   * Alamat email adalah data pribadi. Seluruh tabel di bawah memakai RLS
--     TANPA policy sama sekali: tidak ada satu pun peran anon/authenticated
--     yang dapat membacanya langsung dari peramban. Jalan masuknya hanya
--     lewat server dengan service-role key, dan di sana perannya diperiksa
--     lebih dulu.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Penerima. Entitas tersendiri, bukan baris di dalam kampanye: satu alamat
-- dipakai berkali-kali, dan status berhenti langganannya menempel pada
-- orangnya — bukan pada salah satu kampanye.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_recipients (
  id                 SERIAL PRIMARY KEY,
  email              VARCHAR(254) NOT NULL UNIQUE,
  name               VARCHAR(160),
  institution        VARCHAR(200),
  field              VARCHAR(160),
  country            VARCHAR(80),
  -- active | unsubscribed | suppressed | invalid
  status             VARCHAR(20)  NOT NULL DEFAULT 'active',
  -- Kunci tautan berhenti langganan. Acak, dan TIDAK memuat alamatnya.
  unsubscribe_token  VARCHAR(64)  NOT NULL UNIQUE,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_recipients_status
  ON public.outreach_recipients(status);

-- ---------------------------------------------------------------------
-- Naskah surat.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_templates (
  id          SERIAL PRIMARY KEY,
  -- Kode tetap untuk naskah bawaan, mis. 'nyimak-cfp'. NULL untuk buatan sendiri.
  code        VARCHAR(60),
  name        VARCHAR(160) NOT NULL,
  description TEXT,
  subject     VARCHAR(300) NOT NULL,
  body_html   TEXT         NOT NULL,
  body_text   TEXT,
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by  VARCHAR(160),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Naskah bawaan disalin sekali oleh server saat panel pertama dibuka;
-- kuncinya di bawah yang menjaga salinannya tidak berganda.
-- Tanpa predikat parsial: pada Postgres, NULL saling berbeda di indeks unik,
-- jadi naskah buatan sendiri yang kodenya kosong tetap boleh berjumlah banyak.
CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_templates_kode
  ON public.outreach_templates(code);

-- ---------------------------------------------------------------------
-- Kampanye. Naskahnya DISALIN ke sini saat kampanye dibuat: template boleh
-- disunting kapan saja, kampanye yang sedang berjalan tidak boleh berubah
-- isinya di tengah jalan.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id                  SERIAL PRIMARY KEY,
  code                VARCHAR(12)  NOT NULL UNIQUE,
  name                VARCHAR(200) NOT NULL,
  template_id         INTEGER REFERENCES public.outreach_templates(id) ON DELETE SET NULL,
  -- draft | queued | sending | paused | completed | cancelled
  status              VARCHAR(20)  NOT NULL DEFAULT 'draft',

  subject             VARCHAR(300) NOT NULL,
  body_html           TEXT         NOT NULL,
  body_text           TEXT,

  from_name           VARCHAR(80)  NOT NULL,
  from_email          VARCHAR(254) NOT NULL,
  reply_to            VARCHAR(254),

  -- Dibekukan pada kampanyenya. Saklar yang digeser di tengah jalan tidak
  -- boleh mengubah separuh sisanya menjadi kiriman sungguhan.
  simulasi            BOOLEAN      NOT NULL DEFAULT TRUE,

  total_recipients    INTEGER      NOT NULL DEFAULT 0,
  queued_count        INTEGER      NOT NULL DEFAULT 0,
  sent_count          INTEGER      NOT NULL DEFAULT 0,
  delivered_count     INTEGER      NOT NULL DEFAULT 0,
  failed_count        INTEGER      NOT NULL DEFAULT 0,
  bounced_count       INTEGER      NOT NULL DEFAULT 0,
  unsubscribed_count  INTEGER      NOT NULL DEFAULT 0,

  owner_id            VARCHAR(64),
  owner_name          VARCHAR(160),
  owner_role          VARCHAR(40),

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_status
  ON public.outreach_campaigns(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_pemilik
  ON public.outreach_campaigns(owner_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Penerima per kampanye. Tabel terpenting untuk penelusuran.
--
-- Hasil render per penerima SENGAJA tidak disimpan. Blueprint menyediakan
-- kolomnya; memakainya berarti seribu salinan HTML yang sama persis kecuali
-- satu nama. Suratnya dirakit ulang saat hendak dikirim.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_campaign_recipients (
  id                   SERIAL PRIMARY KEY,
  campaign_id          INTEGER NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  -- RESTRICT, bukan CASCADE: riwayat kirim yang kehilangan penerimanya adalah
  -- baris yang tidak dapat dijelaskan kepada orang yang menanyakannya.
  recipient_id         INTEGER NOT NULL REFERENCES public.outreach_recipients(id) ON DELETE RESTRICT,
  -- queued | sending | sent | delivered | failed | bounced | unsubscribed | cancelled
  status               VARCHAR(20) NOT NULL DEFAULT 'queued',
  provider_message_id  VARCHAR(200),
  attempts             INTEGER     NOT NULL DEFAULT 0,
  error_code           VARCHAR(60),
  error_message        TEXT,
  next_attempt_at      TIMESTAMPTZ,
  queued_at            TIMESTAMPTZ,
  sent_at              TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  failed_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WAJIB. Pembuatan kampanye menulis penerimanya dengan ON CONFLICT DO NOTHING;
-- tanpa kunci ini perintahnya ditolak basis data. Ia juga yang menjamin satu
-- orang tidak menerima surat yang sama dua kali dari satu kampanye.
CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_cr_sekali
  ON public.outreach_campaign_recipients(campaign_id, recipient_id);
-- Jalur baca pekerja antrean.
CREATE INDEX IF NOT EXISTS idx_outreach_cr_antre
  ON public.outreach_campaign_recipients(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_outreach_cr_kampanye
  ON public.outreach_campaign_recipients(campaign_id, status);
-- Webhook datang membawa nomor pesan dan harus menemukan barisnya cepat.
CREATE INDEX IF NOT EXISTS idx_outreach_cr_pesan
  ON public.outreach_campaign_recipients(provider_message_id);
-- Penghitung "terkirim dalam 24 jam terakhir" — inilah yang menegakkan jatah
-- harian, dan ia dibaca setiap kali pekerja berjalan.
CREATE INDEX IF NOT EXISTS idx_outreach_cr_terkirim
  ON public.outreach_campaign_recipients(sent_at);

-- ---------------------------------------------------------------------
-- Daftar cekal. Diperiksa SEBELUM penerima masuk antrean, dan sekali lagi
-- tepat sebelum suratnya dikirim.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_suppression (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(254) NOT NULL UNIQUE,
  -- unsubscribe | hard_bounce | complaint | manual | invalid
  reason     VARCHAR(30)  NOT NULL,
  source     VARCHAR(160),
  note       TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_suppression_email
  ON public.outreach_suppression(email);

-- ---------------------------------------------------------------------
-- Peristiwa dari penyedia (delivered, bounced, complained, …).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_events (
  id                     SERIAL PRIMARY KEY,
  campaign_recipient_id  INTEGER REFERENCES public.outreach_campaign_recipients(id) ON DELETE CASCADE,
  provider_event_id      VARCHAR(200),
  event_type             VARCHAR(40) NOT NULL,
  payload                TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Penyedia mengirim ulang webhook yang belum dijawab 200. Kunci ini membuat
-- kiriman kedua ditolak basis data alih-alih menambah satu lagi ke statistik.
CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_events_sekali
  ON public.outreach_events(provider_event_id);
CREATE INDEX IF NOT EXISTS idx_outreach_events_penerima
  ON public.outreach_events(campaign_recipient_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Jejak tindakan. Siapa menyalakan saklar, siapa menjalankan kampanye.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_audit (
  id            SERIAL PRIMARY KEY,
  actor_id      VARCHAR(64),
  actor_name    VARCHAR(160),
  actor_role    VARCHAR(40),
  action        VARCHAR(60) NOT NULL,
  resource_type VARCHAR(40),
  resource_id   INTEGER,
  metadata      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_audit_waktu
  ON public.outreach_audit(created_at DESC);

-- ---------------------------------------------------------------------
-- RLS: menyala, TANPA policy.
--
-- Bukan kelalaian. Isi tabel-tabel ini adalah daftar alamat email peneliti
-- beserta institusinya — data pribadi orang yang tidak punya akun di sistem
-- ini dan tidak pernah menyerahkan datanya kepada kita. Satu policy baca
-- yang longgar berarti daftar itu dapat diunduh dari peramban siapa pun yang
-- punya akun apa pun.
--
-- Seluruh pembacaan dan penulisan lewat server dengan service-role key, dan
-- di sana peran pemanggilnya diperiksa lebih dulu.
-- ---------------------------------------------------------------------
ALTER TABLE public.outreach_recipients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_templates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_campaign_recipients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_suppression          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_audit                ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Saklar OUS.
--
-- Ditulis dalam keadaan MATI dan MODE SIMULASI. Sistem yang dapat mengirim
-- ribuan surat atas nama fakultas tidak boleh hidup hanya karena migrasinya
-- sudah dijalankan; ia hidup ketika Super Admin menyalakannya dari panel,
-- sesudah SPF/DKIM/DMARC domain pengirim benar-benar lulus.
--
-- ON CONFLICT DO NOTHING: menjalankan ulang berkas ini TIDAK mematikan OUS
-- yang sudah dinyalakan, dan tidak mengembalikan daftar dosennya.
-- ---------------------------------------------------------------------
INSERT INTO public.app_settings (key, value)
VALUES (
  'outreach_ous',
  '{"enabled":false,"simulasi":true,"dosen":["basit@umt.ac.id"],"hariMaks":60,"jamMaks":12,"jedaDetik":45,"pemanasan":true,"pemanasanMulai":null,"jamMulai":8,"jamSelesai":17,"fromName":"NYIMAK Editorial Team","fromEmail":"","replyTo":"","jurnalNama":"NYIMAK: Journal of Communication","jurnalUrl":"https://jurnal.umt.ac.id/index.php/nyimak"}'
)
ON CONFLICT (key) DO NOTHING;
