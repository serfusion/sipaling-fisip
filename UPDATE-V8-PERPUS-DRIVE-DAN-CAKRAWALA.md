# UPDATE v8 — Perpustakaan pakai Google Drive, dan wajah baru Cakrawala

Empat perubahan. Dua menyentuh cara kerja, dua menyentuh tampilan.

---

## 1. Penyerahan skripsi ke perpustakaan pindah ke Google Drive

**Sebelum:** mahasiswa mengunggah empat berkas ke portal. Satu mahasiswa bisa
memakai puluhan MB, dan kuota penyimpanan cepat penuh.

**Sekarang:** berkasnya diunggah ke folder Google Drive milik perpustakaan.
Portal hanya menyimpan tautannya.

Yang dilihat mahasiswa pada kebutuhan **Penyerahan Skripsi/Jurnal**:

1. Daftar empat berkas yang harus ada (cover s/d daftar isi, BAB I s/d BAB V,
   daftar pustaka s/d selesai, skripsi full PDF).
2. Tombol **Buka Folder Drive Perpustakaan**.
3. Satu kotak untuk menempelkan tautan Drive miliknya.

Tautan wajib diawali `https://drive.google.com/` atau `https://docs.google.com/`.
Diperiksa di peramban dan diperiksa ulang di server.

Admin Perpustakaan membuka tautannya lewat tombol **Buka folder Drive
penyerahan** pada laci detail tiket. Mahasiswa juga melihat tautannya sendiri
di Cek Status.

Berkas tiket lama tidak tersentuh: yang sudah terlanjur naik ke portal tetap
dapat diunduh admin seperti biasa.

### Wajib diatur: folder Drive perpustakaan

Tambahkan variabel ini di environment hosting (Netlify/Vercel):

```
NEXT_PUBLIC_PERPUS_DRIVE_URL = https://drive.google.com/drive/folders/xxxxxxxx
```

Pakai folder milik akun perpustakaan, dan atur izinnya agar mahasiswa dapat
menambahkan berkas. Selama variabel ini belum diisi, tombolnya mati dan
kotaknya memberi tahu bahwa foldernya belum diatur.

---

## 2. Absensi Perpustakaan: cukup absen

**Sebelum:** mahasiswa harus mengisi ringkasan kebutuhan, catatan, dan
menghadapi kotak lampiran yang tidak ada gunanya untuk absen.

**Sekarang:** hanya NIM, nama, dan program studi. Hari, tanggal, jam, dan
nomor kunjungan terisi sendiri begitu NIM diketik. Tombolnya berbunyi
**Absen Sekarang**.

Yang hilang dari form saat kebutuhan ini dipilih: kotak email/WhatsApp,
ringkasan kebutuhan, catatan mahasiswa, kotak lampiran, dan pemberitahuan
persyaratan pembayaran.

Pencatatan di tabel absensi tetap berjalan seperti sebelumnya, jadi menu
**Absensi Perpustakaan** di dashboard tidak berubah.

---

## 3. Cakrawala: kotak angka diganti sorotan menu

Empat kotak angka di kepala halaman ("9 alat dalam satu tempat", dan
seterusnya) diganti sembilan sorotan menu berikon: Perumus Judul dan Metode,
Cari Referensi, Cek Kemiripan dan Parafrase, dan seterusnya. Setiap sorotan
menaut ke kartu menunya di bawah.

Teks kepala halaman juga diganti, dan seluruh teks halaman dipendekkan.

---

## 4. Tiga animasi baru

- **Buku terbang** di kepala halaman Cakrawala dan pada kotak Absensi
  Perpustakaan.
- **Digital** pada bagian "Tiga langkah" Cakrawala dan pada kotak penyerahan
  skripsi.
- **Books** di sudut kartu kesembilan menu Cakrawala.

Semuanya berhenti pada satu bingkai bila perangkat pengguna mematikan
animasi, dan diganti lambang biasa bila berkasnya gagal dimuat.

### Supaya tidak memberatkan ponsel

Sembilan kartu memakai animasi yang sama. Dua hal menjaganya tetap ringan:

1. **Animasi baru dibuat ketika kotaknya masuk layar, dan dijeda begitu
   keluar layar.** Diukur pada throttle CPU 6× (setara ponsel kelas bawah):
   satu animasi memakai ±22% main thread, tiga animasi ±30%, sembilan
   animasi sekaligus ±58%. Karena hanya yang terlihat yang berjalan, di
   ponsel paling banyak dua sampai tiga kartu aktif bersamaan, dan nol
   ketika bagian kartunya belum tergulung. Semua keadaan tetap 60 fps.
2. **Berkasnya diambil sekali** lalu dipakai bersama seluruh kartu:
   `books.json` 2,3 KB terkirim, satu permintaan untuk sembilan kartu.

---

## Cara memasang

### 1. Jalankan SQL

Buka Supabase → **SQL Editor** → **New query**, tempel seluruh isi
`supabase-update-v8-penyerahan-drive.sql`, lalu **Run**. Aman dijalankan
berulang kali.

Perintahnya menambah kolom `drive_url` pada `service_requests` dan
menyeragamkan nama kebutuhan lama menjadi `Penyerahan Skripsi/Jurnal`.

### 2. Isi variabel environment

Tambahkan `NEXT_PUBLIC_PERPUS_DRIVE_URL` seperti pada bagian 1 di atas, lalu
deploy ulang.

### 3. Bila SQL belum sempat dijalankan

Portal tetap berjalan. Selama kolom `drive_url` belum ada, tautan Drive
disimpan di catatan mahasiswa dengan awalan `[DRIVE]`, jadi admin
perpustakaan tetap menerimanya. Setelah SQL dijalankan, tautan baru masuk ke
kolomnya sendiri.
