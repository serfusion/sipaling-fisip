# UPDATE v43 — "Terjadi gangguan" pada Penyerahan Skripsi/Jurnal

## Yang dilaporkan

> "Terjadi gangguan. Silahkan coba lagi." saat upload Penyerahan Skripsi/Jurnal.

## Sebabnya, dan kenapa selama ini tidak terlihat di log

Penyerahan Skripsi/Jurnal mengirim **empat PDF sekaligus** dalam satu
permintaan: cover (10 MB), BAB I–V (10 MB), daftar pustaka (10 MB), dan
skripsi utuh (25 MB). Satu penyerahan yang sah karena itu bisa berukuran
puluhan MB.

**Fungsi serverless Vercel menolak badan permintaan yang lebih besar dari
4,5 MB**, dan penolakan itu terjadi di tepi jaringan — sebelum satu baris pun
kode portal dijalankan. Karena itu:

- di log aplikasi **tidak ada apa-apa**: permintaannya tidak pernah masuk;
- jawabannya halaman HTML Vercel, bukan JSON portal;
- `readApi` di peramban gagal mengurainya, lalu menampilkan satu-satunya
  kalimat cadangan yang ia punya: *"Terjadi gangguan. Silakan coba lagi."*

Artinya penyerahan yang wajar — satu skripsi utuh saja biasanya sudah 5–15 MB
— **tidak pernah bisa berhasil di produksi**. Yang lolos hanya berkas yang
kebetulan sangat kecil, dan itulah sebabnya masalahnya tampak muncul sesekali
alih-alih selalu.

Dua masalah lain ditemukan pada jalur yang sama saat ditelusuri:

| # | Temuan | Akibat |
|---|--------|--------|
| 2 | Bucket `service-documents` dibatasi **10 MB**, sedangkan portal mengizinkan berkas "Skripsi full format PDF" sampai **25 MB** | Berkas 10–25 MB lolos seluruh pemeriksaan portal, lalu ditolak Supabase pada langkah terakhir |
| 3 | Jenis berkas yang dititipkan ke penyimpanan diambil dari laporan peramban (`file.type`) | Komputer yang melaporkan PDF sebagai `application/octet-stream` ditolak bucket, padahal berkasnya benar |

## Yang diperbaiki

### 1. Berkas tidak lagi menumpang badan permintaan API

```
Peramban  ──(1) minta izin, JSON kecil──▶  /api/unggah/bagian
Peramban  ◀─(2) URL unggah bertanda tangan
Peramban  ──(3) PDF, LANGSUNG──────────▶  Supabase Storage   ← tidak lewat Vercel
Peramban  ──(4) kirim formulir + jalur──▶  /api/requests      ← beberapa ratus bita
```

Batas 4,5 MB tidak lagi berlaku karena tidak ada satu bita berkas pun yang
melewati fungsi serverless, dan fungsi tidak pernah kehabisan waktu karena ia
tidak lagi mengunggah apa pun.

Berlaku untuk **pengajuan** maupun **revisi** penyerahan (keduanya empat PDF).

### 2. Jalurnya ditandatangani

Formulir sekarang mengirim jalur — dan jalur adalah teks, yang dapat diketik
siapa saja. Tanpa penjagaan, satu kiriman yang menyebut jalur berkas milik
mahasiswa lain akan melampirkan berkas itu ke tiketnya sendiri.

Server karena itu menandatangani (HMAC) setiap jalur yang ia izinkan, berumur
2 jam, dan memeriksanya lagi saat formulir masuk. Sesudah lolos, berkasnya
masih **diperiksa ulang dari penyimpanan**: benar ada, ukurannya di dalam
batas, dan bita pertamanya benar-benar `%PDF` — pemeriksaan yang sama persis
dengan yang dulu dikerjakan saat berkasnya melewati server.

### 3. Ruang transit, dan penyapunya

Berkas mendarat di `requests/transit/<tanggal>/…` lebih dulu, lalu
**dipindahkan** ke folder tiketnya begitu formulirnya benar-benar terkirim.
Yang tertinggal di transit berarti pengisian yang dibatalkan di tengah jalan;
`/api/cleanup` menyapunya setiap hari (berumur >1 hari, dan **tidak** sedang
ditunjuk basis data).

### 4. Pesan galat berhenti menyembunyikan sebabnya

`"Terjadi gangguan. Silakan coba lagi."` dihapus. Kode HTTP-nya kini
diterjemahkan (`src/lib/pesan-http.ts`), lengkap dengan nomor kodenya supaya
laporan mahasiswa dapat dicocokkan dengan log:

- **413** → "Berkas yang dikirim terlalu besar untuk satu kali kiriman…"
- **504** → "Server terlalu lama memproses kiriman lalu dihentikan…"
- **429** → "Terlalu banyak permintaan dari perangkat ini…"

### 5. Perbaikan kecil pada jalur yang sama

- Jenis berkas yang dititipkan ke penyimpanan selalu `application/pdf`, bukan
  yang dilaporkan peramban.
- `maxDuration = 60` pada `/api/requests` dan `/api/revisions`, supaya jalur
  cadangan tidak dipotong batas bawaan 10 detik.
- Kabar "Mengunggah berkas 2 dari 4 — isi.pdf" di layar mahasiswa; sebelumnya
  tombolnya diam saja selama beberapa menit.
- `/api/unggah/bagian` punya jatah rate limit sendiri (80 per 10 menit). Kalau
  disamakan dengan jatah pengiriman formulir (8 per 10 menit), satu penyerahan
  saja — yang meminta empat izin — sudah menghabiskan separuhnya.

### Jalur cadangan tetap ada

Bila penyimpanan belum siap melayani unggahan langsung, peramban kembali ke
cara lama (berkas ikut di badan permintaan). Cara itu hanya sanggup untuk
kiriman kecil, jadi batasnya kini **disebutkan lebih dulu** alih-alih berakhir
sebagai halaman galat Vercel. Kiriman dari halaman lama yang masih terbuka di
tab mahasiswa juga tetap dilayani server.

## WAJIB DIJALANKAN SAAT DEPLOY

Jalankan `supabase-update-v43-unggah-langsung.sql` di
**Supabase → SQL Editor → Run**. Isinya menaikkan batas bucket
`service-documents` dari 10 MB ke 25 MB agar cocok dengan batas berkas skripsi
utuh di portal.

Tanpa langkah ini, berkas 10–25 MB masih akan ditolak — bedanya sekarang
pesannya jelas: *"Penyimpanan menolak karena batas ukurannya belum dinaikkan.
Beri tahu admin untuk menjalankan supabase-update-v43-unggah-langsung.sql."*

**Tidak ada policy RLS baru yang perlu dibuat.** Unggahan langsung memakai
signed upload URL yang dibuat server dengan service role key; tokennya berlaku
untuk satu jalur saja dan berumur pendek. Bucket tetap privat.

Environment variable opsional: `UNGGAH_SECRET` bila ingin kunci tanda tangan
jalur dipisahkan dari `SUPABASE_SECRET_KEY` (bawaannya menumpang kunci itu).

## Pengujian

```bash
npx tsx uji-unggah-langsung.ts   # 53 pemeriksaan
npx tsx uji-serah.ts             # pemeriksa berkas penyerahan, tidak berubah
npm run build
```

`uji-unggah-langsung.ts` memeriksa, tanpa Supabase maupun basis data:

- bentuk jalur transit, pembersihan nama berkas, penolakan jalur karangan
  (titik ganda, di luar folder transit, bukan PDF);
- tanda tangan: yang palsu ditolak, yang kedaluwarsa ditolak, yang milik jalur
  lain ditolak, dan waktu berlakunya tidak dapat diperpanjang sendiri;
- pembacaan formulir: empat bagian lengkap, satu bagian hilang, ukuran di atas
  batas, nama bukan PDF, dan kiriman lama yang masih membawa berkasnya;
- **jalur yang tanda tangannya gagal tidak ikut dihapus** — ia mungkin milik
  orang lain, dan menghapusnya justru akan menjadi celah baru;
- penyapu transit: hanya folder lewat tanggal, dan **tidak pernah** menyentuh
  berkas yang masih ditunjuk basis data;
- pesan HTTP: tidak ada lagi satu pun yang berbunyi "Terjadi gangguan".

## Berkas yang berubah

| Berkas | Perubahan |
|--------|-----------|
| `src/lib/unggah-langsung.ts` | **baru** — aturan bersama peramban & server |
| `src/lib/unggah-tanda.ts` | **baru** — tanda tangan jalur (server) |
| `src/lib/unggah-klaim.ts` | **baru** — verifikasi & pemindahan berkas (server) |
| `src/lib/unggah-klien.ts` | **baru** — unggah dari peramban |
| `src/lib/sapu-transit.ts` | **baru** — penyapu ruang transit |
| `src/lib/pesan-http.ts` | **baru** — terjemahan kode HTTP |
| `src/app/api/unggah/bagian/route.ts` | **baru** — pemberi izin unggah |
| `src/lib/document-storage.ts` | izin unggah, periksa objek, pindah objek |
| `src/app/api/requests/route.ts` | terima jalur transit, `maxDuration` |
| `src/app/api/revisions/route.ts` | idem, untuk revisi penyerahan |
| `src/app/api/cleanup/route.ts` | sapu ruang transit tiap hari |
| `src/app/sipaling-app.tsx` | unggah langsung, kabar kemajuan, `readApi` jujur |
| `src/app/globals.css` | gaya kabar unggahan |
| `supabase-update-v43-unggah-langsung.sql` | **baru** — batas bucket 25 MB |
| `uji-unggah-langsung.ts` | **baru** — 53 pemeriksaan |

## Yang masih perlu diperhatikan

Rate limit `/api/requests` adalah **8 kiriman per 10 menit per alamat IP**. Di
jaringan kampus yang seluruh perangkatnya keluar lewat satu IP (NAT), jatah itu
dibagi bersama — pada musim penyerahan serentak, mahasiswa kesembilan akan
membaca *"Terlalu banyak permintaan dari perangkat ini."* padahal ia baru
mengirim sekali.

Ini **tidak diubah** pada v43 karena menyangkut pertahanan portal terhadap
banjir kiriman, bukan bug unggahan. Bila musim penyerahan ternyata
memicunya, dua jalan keluarnya: naikkan batasnya, atau pindahkan penghitungnya
ke penyimpanan bersama dan beri kunci yang lebih spesifik daripada alamat IP.
