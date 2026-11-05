# v55 — Dokumen disimpan di disk VPS (bukan Supabase Storage)

**Kenapa:** bucket `service-documents` 1,59 GB melewati kuota Supabase gratis (1 GB; masa tenggang s/d 14 Nov 2026).
Portal kini berjalan di VPS (disk lapang), jadi dokumen pindah ke disk server. Basis data, akun, dan bucket CBT
(`cbt-rekaman`, `cbt-media`) TETAP di Supabase.

**Nyalakan:** di `/etc/sipaling-fisip.env`
```
DOCUMENT_STORAGE=lokal
DOCUMENT_DIR=/var/lib/sipaling-fisip/dokumen
DOCUMENT_SIGNING_SECRET=<acak 64 heks>
```
Tanpa `DOCUMENT_STORAGE=lokal` perilaku lama (Supabase) tidak berubah.

**Cara kerja:** `src/lib/penyimpanan-lokal.ts` meniru Supabase Storage (jalur, list/remove, izin unggah & tautan unduh
bertanda tangan HMAC berumur pendek). Rute `GET/PUT /api/dokumen/<jalur>?e=&t=` melayani unduh (dukung Range) dan
unggah langsung dari peramban (maks 30 MB). `document-storage.ts`, `/api/cleanup`, `/api/health`, dan tiga rute unduh
memakai penyimpanan ini otomatis.

**Pindahkan berkas lama** (sebagai user `web`, env dimuat):
```
node scripts/pindah-dokumen.mjs          # salin Supabase → disk (aman diulang)
node scripts/pindah-dokumen.mjs periksa  # cocokkan
node scripts/pindah-dokumen.mjs hapus    # hapus dari Supabase hanya yang sudah ada di disk
```
**Cadangan:** berkas kini menjadi tanggung jawab server — salin folder `DOCUMENT_DIR` secara berkala.
