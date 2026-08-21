# PERBAIKAN SiPaling FISIP — Baca Dulu Sebelum Deploy Ulang

## Temuan penting: situs live-mu menjalankan versi LAMA

Saya cek langsung https://sipalingfisip.web.id —  halaman yang tampil masih versi lama 
(teks "maksimal 20 MB", padahal kode terbaru "maksimal 10 MB"). Artinya:
**deploy terakhirmu kemungkinan besar GAGAL BUILD**, dan hosting terus menyajikan
versi lama yang tidak cocok dengan database baru → muncul "Pengajuan belum tersimpan."

Penyebab build gagal sudah ditemukan dan diperbaiki (lihat daftar di bawah).

## Bug yang diperbaiki di paket ini

1. **[KRITIS] `src/db/index.ts` melempar error saat build.**
   Kode lama langsung `throw new Error("DATABASE_URL is required")` saat file di-import.
   Next.js meng-import file API saat `next build`, jadi kalau DATABASE_URL belum
   tersedia di lingkungan build (Netlify), SELURUH build gagal → situs lama tetap tayang.
   Sekarang koneksi dibuat "lazy" (saat query pertama), build selalu sukses.

2. **[KRITIS] Homepage bergantung ke database.**
   `src/app/page.tsx` lama menjalankan `select 1` sebelum render — kalau database
   bermasalah, seluruh halaman mahasiswa error 500. Sekarang halaman selalu tampil.

3. **SSL Supabase.** Koneksi `pg` kini otomatis memakai TLS yang kompatibel dengan
   Supabase (mencegah error sertifikat di serverless), plus timeout & pool ramah serverless.

4. **Pesan error sekarang JELAS, bukan "Silakan coba lagi".**
   Semua endpoint (pengajuan, revisi, dosen, status, absensi) kini menampilkan
   penyebab aslinya, contoh:
   - "DATABASE_URL belum diatur di environment variables hosting…"
   - "Tabel database belum dibuat. Jalankan supabase-setup.sql…"
   - "Pastikan DATABASE_URL memakai Transaction pooler (port 6543)…"
   - "Bucket service-documents belum dibuat…"

5. **`/api/health` jadi halaman diagnosis lengkap.**
   Setelah deploy, buka: `https://sipalingfisip.web.id/api/health`
   Akan tampil JSON yang memberi tahu persis apa yang belum beres
   (env vars, koneksi database, tabel, bucket Storage). Semua `ok: true` = siap pakai.

6. **Font tidak lagi bisa menggagalkan build.** Font Google dimuat lewat `<link>`
   di browser, bukan diunduh saat build.

7. **Lint bersih (0 error)** — dua bug pola React di dashboard dibereskan, pencarian
   dashboard kini juga punya debounce 150 ms.

8. **netlify.toml** kini mendeklarasikan plugin `@netlify/plugin-nextjs` secara eksplisit.

## Langkah deploy ulang (urut, jangan dilewati)

1. **Ganti semua file di repo GitHub** dengan isi paket ini (folder `src`, `netlify.toml`,
   dll — timpa semuanya), lalu commit & push.

2. **Cek environment variables di hosting** (Netlify: Site configuration → Environment
   variables; pastikan berlaku untuk Builds DAN Functions/Runtime):
   - `DATABASE_URL` → salin dari Supabase → Connect → **Transaction pooler**
     (host `...pooler.supabase.com`, port **6543**). JANGAN pakai `db.xxx.supabase.co:5432`.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`

3. **Di Supabase → SQL Editor**, pastikan sudah pernah menjalankan (aman diulang):
   `supabase-setup.sql` → `supabase-update-v2.sql` → `supabase-storage-migration.sql`
   → `supabase-add-admin-roles.sql`.

4. **Pastikan bucket Storage `service-documents` ada** (Dashboard → Storage).

5. **Deploy ulang**, lalu di tab **Deploys** pastikan statusnya *Published* (hijau),
   bukan *Failed*. Kalau failed, buka log build-nya — sekarang seharusnya sukses.

6. **Verifikasi:** buka `https://sipalingfisip.web.id/api/health`.
   - Semua `ok: true` → coba kirim Form Layanan, harus dapat nomor tiket.
   - Ada yang `false` → baca `detail`-nya, di situ tertulis persis apa yang harus dibetulkan.

## Catatan

- Kalau setelah ini form masih gagal, pesan errornya sekarang akan menyebutkan
  penyebab pastinya di kotak merah — kirimkan pesan itu, bukan screenshot generik.
- Paket ini sudah lolos: `tsc --noEmit` (0 error), `eslint` (0 error),
  `next build` (sukses bahkan tanpa env vars & tanpa akses Google Fonts),
  dan uji jalan lokal semua halaman (/, /login, /dashboard, /api/health = 200).
