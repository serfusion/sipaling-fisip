# Update aman SiPaling FISIP: Supabase Storage + Netlify

## Keputusan yang dipakai

- Tetap gunakan **Supabase Free + Netlify Free** selama pemakaian masih kecil.
- Semua file baru masuk ke bucket privat Supabase Storage, bukan kolom `BYTEA` database.
- Batas file diturunkan menjadi **10 MB**.
- File lama tidak dihapus dan masih dapat diunduh.
- Unduhan memerlukan login serta diperiksa berdasarkan role/unit layanan.
- Kumpulkan perubahan dan lakukan satu production deploy agar kredit Netlify hemat.

## Urutan wajib (jangan dibalik)

### 1. Ganti secret key yang pernah tersebar

Di Supabase Dashboard, buat/rotate secret key. Setelah itu perbarui variabel
`SUPABASE_SECRET_KEY` di Netlify. Jangan menaruh secret key di GitHub atau di
variabel yang namanya diawali `NEXT_PUBLIC_`.

### 2. Jalankan migrasi Supabase

1. Buka Supabase Dashboard.
2. Pilih **SQL Editor** > **New query**.
3. Salin seluruh isi `supabase-storage-migration.sql`.
4. Klik **Run**.
5. Pastikan hasil menampilkan bucket `service-documents`, `public = false`, dan
   `file_size_limit = 10485760`.

Migrasi ini aman untuk data lama: tidak ada `DROP TABLE`, `DELETE`, atau
penghapusan isi `file_data`.

### 3. Pastikan environment variables pada site Netlify yang memakai domain

Buka **Netlify > sipalingfisip.web.id > Site configuration > Environment variables**.

| Key | Isi |
| --- | --- |
| `DATABASE_URL` | Connection string Transaction pooler dari menu Supabase **Connect** |
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key Supabase |
| `SUPABASE_SECRET_KEY` | Secret key baru; server-only |
| `SUPABASE_DOCUMENT_BUCKET` | `service-documents` (opsional) |
| `NEXT_PUBLIC_SURAT_LAINNYA_DRIVE_URL` | URL folder Google Drive (opsional) |

Pastikan variabel dipasang pada site Netlify yang benar-benar terhubung ke
domain `sipalingfisip.web.id`, bukan site lama yang sudah tidak dipakai.

### 4. Push satu kali ke GitHub

Jalankan dari folder proyek:

```bat
git status
git add .
git commit -m "fix: simpan dokumen di Supabase Storage"
git push origin main
```

Jika `git status` menampilkan `nothing to commit`, berarti file paket ini belum
disalin ke folder repository yang sedang dibuka.

### 5. Deploy

- Jika production deploy Netlify masih paused, tunggu tanggal reset kredit atau
  upgrade. Website lama tetap online, tetapi perubahan baru belum dapat terbit.
- Setelah kredit aktif, lakukan satu **Retry deploy** atau push satu commit kecil.
- Jangan menekan **Trigger deploy** berulang-ulang.

### 6. Tes setelah Published

1. Buka `/api/health`; hasil harus `{"ok":true}`.
2. Kirim satu pengajuan dengan PDF/DOCX kecil.
3. Buka Supabase **Storage > service-documents** dan pastikan file muncul.
4. Login ke Dashboard, pilih tiket, lalu klik **Unduh**.
5. Logout dan buka kembali URL `/api/files/ID`; akses harus ditolak.
6. Login sebagai Admin unit dan pastikan hanya antrean unitnya yang terlihat.

## Penghematan kredit Netlify

- Uji perubahan dengan `npm run dev` sebelum push.
- Jalankan `npm run typecheck`, `npm run lint`, dan `npm run build` secara lokal.
- Gabungkan beberapa perubahan ke satu commit production.
- Jangan pindah ke Vercel hanya untuk menghindari limit; paket gratis Vercel juga
  memiliki batas dan Hobby ditujukan untuk penggunaan personal.
