# v19: Revisi mengikuti bentuk layanannya, dan lonceng yang benar-benar berbunyi

## Dua hal yang rusak

### 1. Revisi selalu meminta satu berkas .DOCX

Penyerahan Skripsi/Jurnal ke perpustakaan mengunggah **empat PDF** saat
mengajukan. Ketika statusnya menjadi Revisi, formulirnya hanya meminta **satu
.DOCX** — apa pun layanannya, karena kotaknya memang ditulis mati begitu.

Akibatnya tiga bagian yang lain **tidak pernah tergantikan**. Admin memeriksa
campuran antara berkas lama dan berkas baru, dan tidak ada satu pun tanda yang
memberi tahu bahwa itulah yang sedang terjadi.

### 2. Super Admin tidak melihat notifikasi apa pun

Filternya berbunyi: yang bukan dosen hanya melihat notifikasi beralamat
`admin_prodi`. Jadi Super Admin — orang yang memegang seluruh portal —
melihat satu aliran saja, dan pengajuan perpustakaan, PDDIKTI, akademik, umum,
serta laboratorium tidak pernah sampai ke loncengnya.

Lebih dalam lagi: **satu-satunya hal yang pernah membuat notifikasi adalah
Pengajuan Judul.** Pengajuan layanan biasa dan unggahan revisi tidak pernah
membuat notifikasi sama sekali. Loncengnya bukan rusak — memang tidak ada yang
pernah membunyikannya.

---

## Yang berubah

### Bentuk unggahan jadi satu aturan

`src/lib/bentuk-unggah.ts` menjawab satu pertanyaan untuk semua layanan:
*berapa berkas, jenis apa, wajib atau tidak.* Tiga tempat memanggilnya —
formulir pengajuan, formulir revisi, dan server — jadi ketiganya tidak mungkin
berselisih lagi.

| Layanan | Berkas |
| --- | --- |
| Penyerahan Skripsi/Jurnal | 4 PDF (cover, isi, pustaka, full) |
| Layanan Tugas Akhir | 1 DOCX, wajib |
| Layanan PDDIKTI | 1 PDF, wajib |
| Layanan lain | 1 PDF/DOCX — opsional saat mengajukan, **wajib saat merevisi** |
| Absensi Perpustakaan | tidak ada berkas |

Yang terakhir disengaja: revisi tanpa berkas baru tidak mengubah apa pun yang
dapat diperiksa admin, jadi membiarkannya kosong hanya memindahkan kebingungan
ke meja orang lain.

### Formulir revisi menanyakan tiketnya dulu

Masukkan nomor tiket dan NIM → **Cek tiket** → muncul ringkasan layanannya
beserta persis berkas yang diminta. Dari halaman Cek Status, tombolnya sekarang
berbunyi "unggah **4** berkas terbaru" dan langsung mengisi tiket dan NIM-nya;
tidak ada yang perlu diketik ulang.

Tombol Kirim dimatikan bila status tiketnya bukan Revisi, dan alasannya
tertulis, bukan dibiarkan ditebak.

### Berkasnya MENGGANTIKAN, bukan menumpuk

Empat berkas revisi menggantikan empat berkas lama pada tiket yang sama:
barisnya diganti, berkas lamanya dihapus dari penyimpanan, dan admin melihat
persis empat berkas — bukan delapan yang harus ia bandingkan sendiri
tanggalnya.

Riwayatnya tidak hilang. Berkas pengajuan awal disimpan sebagai **revisi ke-0**
sebelum yang baru menimpanya, lengkap dengan bagian mana yang diganti.

Urutannya penting dan disengaja: berkas lama dihapus **paling akhir**, sesudah
basis data yakin. Kalau dibalik dan transaksinya gagal, tiketnya menunjuk
berkas yang sudah tidak ada — tanpa satu pun salinan tersisa.

### Lonceng

- **Super Admin dan Admin melihat seluruh notifikasi beralamat role**, apa pun
  unitnya. Yang beralamat dosen tetap tidak ikut: itu percakapan antara dosen
  dan mahasiswa bimbingannya.
- **Admin unit melihat miliknya sendiri.** Meja orang lain bukan urusannya.
- **Pengajuan layanan baru membunyikan lonceng**, dialamatkan ke unit yang
  menanganinya — perpustakaan ke `admin_perpustakaan`, PDDIKTI ke
  `admin_pddikti`, dan seterusnya. Dosen tujuan diberi tahu langsung.
- **Unggahan revisi membunyikan lonceng**, ditandai *urgent*: tiket revisi
  sudah pernah menunggu sekali.
- **Absensi sengaja tidak ikut.** Ia langsung Selesai dan tidak menuntut
  tindakan siapa pun; notifikasi untuk hal seperti itu hanya membuat orang
  berhenti membaca notifikasi.
- **Menekan notifikasi mengantar ke tiketnya**, bukan ke daftar yang masih
  harus dicari sendiri.

---

## Yang perlu Anda lakukan

```
supabase-update-v19-revisi-berkas-jamak.sql
```

Menambah kolom `part` dan `label` pada `revision_uploads` supaya riwayat revisi
tahu bagian mana yang diganti. Aman diulang.

---

## Yang dijaga uji otomatis

`uji-revisi.ts` — 73 pemeriksaan. Bagian bentuk berkas dan alamat notifikasi
selalu jalan; bagian yang menyentuh basis data hanya jalan bila `DATABASE_URL`
diisi:

```bash
DATABASE_URL=postgres://... npx tsx uji-revisi.ts
```

Yang dijaga, antara lain:

- revisi penyerahan meminta **empat** berkas, sama dengan pengajuannya
- kurang satu bagian ditolak, dan pesannya **menyebut bagian mana**
- batas ukurannya benar per bagian: isi 12 MB ditolak, full 20 MB diterima,
  full 30 MB ditolak
- sesudah revisi tetap **empat** lampiran, dan keempatnya yang baru
- jalur berkas lama dikembalikan untuk dihapus, dan memang milik yang lama
- riwayat menyimpan 4 baris revisi ke-0 + 4 baris revisi ke-1; revisi kedua
  **tidak** melipatgandakan revisi ke-0
- status kembali ke "Masuk" dan "Belum Dicek" supaya ada yang memeriksanya lagi
- Super Admin melihat keempat notifikasi role termasuk perpustakaan dan
  PDDIKTI, tetapi **bukan** yang beralamat dosen
- admin unit melihat tepat satu — miliknya
- dosen melihat miliknya; dosen lain tidak melihat apa-apa

Formulirnya juga dijalankan di peramban sungguhan: tiket penyerahan
menampilkan 4 kotak berkas, tiket tugas akhir menampilkan 1 kotak DOCX, dan
mengirim tanpa berkas ditolak dengan menyebut bagian yang kosong.
