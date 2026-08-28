# Pembaruan v7: unggah bukti penyerahan 4 bagian & kunci menu Cakrawala

Dua perubahan besar dan satu perbaikan penting. Dua yang pertama membutuhkan
**satu berkas SQL dijalankan sekali** di Supabase:
`supabase-update-v7-upload-4-bagian.sql`.

---

## 0. Yang harus dilakukan dulu (sekali saja)

1. Buka Supabase → **SQL Editor** → **New query**.
2. Salin seluruh isi `supabase-update-v7-upload-4-bagian.sql`, tempel, lalu
   **Run**.
3. Selesai. Berkas itu aman dijalankan berulang kali dan tidak menimpa
   pengaturan yang sudah ada.

Bila langkah ini terlewat, pengiriman "Upload Bukti Penyerahan Jurnal/Skripsi"
akan gagal dengan pesan yang menyebutkan nama berkas SQL-nya, dan menu
Cakrawala tetap terkunci tanpa bisa dibuatkan kode.

---

## 1. Upload Bukti Penyerahan Jurnal/Skripsi dibagi menjadi 4 bagian

**Masalahnya.** Kebutuhan ini hanya menerima satu berkas PDF gabungan,
padahal persyaratannya sudah lama menyebut empat bagian. Admin Perpustakaan
harus membuka berkas itu satu per satu lalu memilah sendiri mana cover, mana
isi, dan mana daftar pustaka — untuk setiap mahasiswa.

**Yang berubah.** Ketika mahasiswa memilih kebutuhan
**Upload Bukti Penyerahan Jurnal/Skripsi**, kotak "Lampiran" tunggal diganti
satu panel berisi persyaratan dan **empat kotak unggah terpisah**:

| Bagian | Judul kotak | Format yang diterima |
| --- | --- | --- |
| 1 | Upload Cover s/d Daftar Isi | PDF, JPG, atau PNG |
| 2 | Upload BAB I s/d BAB V | PDF, JPG, atau PNG |
| 3 | Upload Daftar Pustaka s/d Selesai | PDF, JPG, atau PNG |
| 4 | Upload File Skripsi Full PDF | PDF saja |

Keempatnya wajib, masing-masing maksimal 10 MB.

### Yang dilihat masing-masing pihak

- **Mahasiswa.** Persyaratan bernomor tampil persis di atas kotak unggahnya.
  Bila ada bagian yang belum dipilih atau salah format, pesannya menyebut
  bagian yang mana — bukan sekadar "lampiran salah". Setelah tiket dilacak
  lewat **Cek Status**, keempat nama berkas yang diterima ikut ditampilkan.
- **Admin Perpustakaan.** Pada laci detail tiket muncul daftar
  **"Berkas per bagian"**: empat tautan unduh dengan label bagiannya
  masing-masing. Berkas sudah tersortir sejak dikirim.

### Catatan teknis

- Tabel baru `request_attachments` menyimpan lampiran bernama (satu baris per
  bagian). Satu bagian hanya boleh punya satu berkas per pengajuan.
- Berkas **skripsi full** sekaligus disalin ke kolom lampiran utama tiket
  (`file_*` pada `service_requests`), sehingga tiket lama dan baru sama-sama
  punya satu lampiran utama dan tautan unduh yang sudah ada tetap benar.
- Bila penyimpanan barisnya gagal, seluruh berkas yang sudah terunggah dihapus
  kembali — tidak ada berkas yatim yang memakan kuota penyimpanan.
- Menghapus tiket (Super Admin) ikut menghapus keempat berkasnya di Storage.
- Aturan format dan ukuran ditulis satu kali di `src/lib/bukti-penyerahan.ts`
  dan dipakai bersama oleh peramban dan server, jadi keduanya tidak mungkin
  berbeda.

Berkas: `src/lib/bukti-penyerahan.ts`, `src/db/schema.ts`,
`src/app/sipaling-app.tsx`, `src/app/api/requests/route.ts`,
`src/app/api/requests/[ticket]/route.ts`,
`src/app/api/requests/[ticket]/attachments/route.ts`,
`src/app/api/attachments/[id]/route.ts`, `src/app/api/status/route.ts`,
`src/app/dashboard/dashboard-app.tsx`, `src/app/globals.css`.

---

## 2. Menu Cakrawala dikunci, dibuka dengan kode akses

Cakrawala kini **terkunci secara bawaan**. Pengunjung `/alat` melihat halaman
pratinjau, bukan alatnya.

### Yang dilihat pengunjung

Halaman pratinjau berlatar gelap berisi:

- kepala halaman dengan lencana **AKSES TERBATAS**;
- empat angka ringkas (9 alat, 3 katalog ilmiah, 0 naskah yang dititipkan ke
  server, 1× tempel naskah untuk semua alat);
- **"Tiga langkah, sisanya dikerjakan sendiri"** — tempel naskah, pilih alat,
  ambil hasilnya;
- **sembilan kartu keunggulan**, satu untuk tiap menu Cakrawala, masing-masing
  dengan gambaran tampilan panelnya (digambar dengan elemen biasa, bukan
  berkas gambar, supaya tetap ringan dan tajam di layar mana pun) dan satu
  lencana hijau berisi bagian yang berjalan otomatis;
- **kotak kode akses** untuk membuka; dan
- ajakan **"Wanna? Contact Me @superfaldev"** beserta tombol salin.

### Cara Super Admin mengelolanya

Dashboard → menu baru **Kunci Cakrawala** (hanya tampil untuk Super Admin):

- **Sakelar kunci.** Menyalakan/mematikan kunci untuk semua orang sekaligus.
- **Buat kode baru.** Kode berbentuk `CKRW-XXXX-XXXX`, dibuat di server dengan
  angka acak kriptografis. Dapat diberi catatan pemilik (mis. "Rina — Ilkom
  2021") dan batas pemakaian (mis. 1 untuk sekali pakai; kosongkan untuk tanpa
  batas).
- **Daftar kode.** Menampilkan berapa kali dipakai, sisa kuota, dan kapan
  terakhir dipakai. Klik kodenya untuk menyalin. Tiap kode dapat
  **dinonaktifkan** atau **dihapus**.
- **Lihat halaman pratinjau** membuka `/alat` di tab baru.

### Aturan mainnya

- Mahasiswa memasukkan kode → tersimpan sebagai cookie `httpOnly` pada
  perangkatnya selama **30 hari**, jadi tidak perlu mengetik ulang tiap datang.
- **Batas pemakaian** mengatur berapa kali sebuah kode boleh *ditukar* menjadi
  akses. Perangkat yang sudah menukarnya tetap dapat masuk walaupun kuotanya
  kemudian habis — kode sekali pakai memang dibuat untuk satu orang yang
  datang berkali-kali.
- **Menonaktifkan atau menghapus kode langsung menutup akses** semua perangkat
  yang memakainya, saat itu juga.
- **Super Admin selalu bisa masuk tanpa kode**, jadi tidak mungkin terkunci di
  luar oleh pengaturannya sendiri.
- Percobaan memasukkan kode dibatasi 10 kali per 10 menit per perangkat.
- Gerbangnya berada **di server**: selama terkunci, isi Cakrawala tidak ikut
  terkirim ke peramban sama sekali, sehingga tidak dapat dilewati lewat alat
  pengembang.
- Bila database bermasalah, kuncinya **gagal-tertutup** (halaman pratinjau yang
  tampil) — kebalikan dari mode maintenance yang sengaja gagal-terbuka.
- Tombol Cakrawala di beranda mahasiswa memakai penanda **🔒 VIP** selama
  kuncinya menyala.

### Membuka kunci lewat SQL bila dashboard tidak dapat dibuka

```sql
update public.app_settings
   set value = jsonb_set(value::jsonb, '{locked}', 'false')::text,
       updated_at = now()
 where key = 'cakrawala_access';
```

Ganti `'false'` menjadi `'true'` untuk menguncinya kembali.

Berkas: `src/lib/cakrawala.ts`, `src/lib/cakrawala-store.ts`,
`src/app/api/cakrawala-access/route.ts`, `src/app/alat/page.tsx`,
`src/app/alat/pratinjau.tsx`, `src/app/dashboard/dashboard-app.tsx`,
`src/app/sipaling-app.tsx`, `src/app/globals.css`.

---

## 3. Perbaikan: Layanan Umum tidak lagi ditolak "Pilihan layanan tidak valid"

**Masalahnya.** Keempat kebutuhan pada **Layanan Umum** di form mahasiswa
(Surat Keterangan Aktif, Izin Penelitian, Permohonan Praktek Kerja Lapangan,
Kebutuhan Lainnya) pernah berganti nama, tetapi daftar yang diperiksa server
masih memakai nama lama (Surat Pengantar, Pengajuan Magang, Surat Keterangan
Aktif Kuliah, Surat Lainnya). Akibatnya **seluruh pengajuan Layanan Umum
ditolak** dengan pesan "Pilihan layanan tidak valid." — mahasiswa tidak punya
cara untuk lolos, apa pun yang dipilihnya.

**Yang berubah.** Daftar di server kini memuat empat nama yang dipakai form
sekarang, **ditambah** empat nama lama yang tetap diterima (mengikuti cara yang
sudah dipakai untuk "Layanan Skripsi / Jurnal" → "Layanan Tugas Akhir"),
sehingga tautan atau halaman lama yang masih terbuka tidak ikut ditolak.

**Cara memastikannya.** Seluruh 31 kombinasi Jenis Layanan × Kebutuhan dibaca
langsung dari form yang berjalan, lalu dikirim satu per satu ke
`POST /api/requests`: tidak ada lagi yang ditolak karena katalognya. Kombinasi
yang belum lengkap berkasnya ditolak dengan pesan yang sesuai (mis. "File DOCX
wajib dilampirkan…"), bukan karena namanya tidak dikenali.

Berkas: `src/app/api/requests/route.ts`.

### Dua perbaikan kecil lain

- **Laci detail tiket.** Daftar lampiran dari tiket yang dibuka sebelumnya
  tidak lagi dapat menimpa tiket yang sedang dibuka bila balasannya telat
  datang.
- **Form mahasiswa.** Nama berkas yang sudah dipilih ikut dibersihkan ketika
  mahasiswa berpindah kebutuhan atau jenis layanan — sebelumnya labelnya
  tertinggal padahal kotak unggahnya sudah kosong kembali.
