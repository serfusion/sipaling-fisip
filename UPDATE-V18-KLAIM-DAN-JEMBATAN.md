# v18: Tombol "Saya sudah membayar", dan cara melihat jembatan DANA hidup atau mati

## Kenapa v17 belum terasa otomatis

Jembatannya sudah ada di kode sejak v17, tetapi ia **tidur** sampai dua hal
dikerjakan di luar repositori ini:

1. `CAKRAWALA_MUTASI_SECRET` diisi di Vercel, lalu deploy ulang.
2. Satu aplikasi penerus pemberitahuan dipasang di ponsel yang menerima DANA.

Selama salah satunya belum, `/api/cakrawala-mutasi` menjawab 404 kepada siapa
pun dan tidak ada yang berubah — dan tidak ada satu pun layar yang memberi
tahu Anda bahwa itulah yang sedang terjadi. Itu kekurangan v17, dan v18
memperbaikinya.

---

## Yang berubah

### 1. Panel "Jembatan DANA"

Di dashboard → Kunci Cakrawala, di bawah tabel pesanan. Ia menjawab satu
pertanyaan yang sebelumnya tidak dapat dijawab dari mana pun:

> **apakah pemberitahuan dari ponsel saya benar-benar sampai?**

- Lencana **belum aktif** — belum ada satu pun pemberitahuan yang masuk.
  Selama itu, pelunasan memang masih harus ditandai dengan tangan.
- Lencana **aktif** — pemberitahuannya sampai. Tabelnya menunjukkan waktu,
  nominal, hasil, dan kalimat aslinya.

Hasilnya salah satu dari:

| Hasil | Artinya |
| --- | --- |
| `cocok` | pesanannya ketemu, kode terbit |
| `sudah-lunas` | pemberitahuan yang sama datang dua kali; tidak ada kode kedua |
| `tanpa-pesanan` | tidak ada pesanan bernominal itu — bisa jadi uang untuk hal lain |
| `bukan-masuk` | terbaca sebagai uang KELUAR, jadi diabaikan |

Kalau semua barisnya `bukan-masuk` padahal itu uang masuk, kalimat aslinya
kelihatan di kolom terakhir dan saya dapat menyesuaikan pembacanya.

### 2. Tombol "Saya sudah membayar"

Ada di layar pembayaran, dan juga di layar "waktunya habis" — di sana justru
lebih penting, karena orang yang sudah membayar di menit ketujuh belas selama
ini hanya disodori tombol memesan lagi.

**Yang perlu dikatakan terus terang: menekan tombol bukan bukti membayar.**
Kalau tombolnya sendiri menerbitkan kode, Cakrawala menjadi gratis bagi siapa
pun yang mau menekannya. Jadi yang dikerjakannya adalah semua yang **dapat**
dikerjakan tanpa mengarang bukti:

1. **Dicocokkan ulang ke catatan mutasi.** Kalau pemberitahuannya ternyata
   sudah tercatat tetapi belum menemukan pesanannya — datang saat pesanannya
   baru kedaluwarsa, atau saat basis datanya tersendat — maka **kodenya terbit
   saat itu juga, tanpa Anda menandai apa pun.** Ini jalur yang paling sering
   menyelamatkan keadaan.
2. Kalau belum ada catatannya, pesanannya **dihidupkan kembali** dan masa
   berlakunya diperpanjang 24 jam, supaya nominal uniknya tidak didaur ulang
   sementara uangnya masih di jalan.
3. Pesanannya **naik ke puncak** panel dengan penanda kuning "mengaku sudah
   bayar" beserta jamnya.

Layar pembelinya berubah menjadi "Pembayaranmu sedang diperiksa" dan tetap
memeriksa sendiri — jadi ketika pemberitahuannya menyusul, kodenya muncul
tanpa halamannya dimuat ulang.

### 3. Pesanan kedaluwarsa tetap bisa dilunaskan pemberitahuan

Jendela 15 menit itu urusan daur ulang nominal, bukan alasan menahan barang
orang. Pemberitahuan yang datang sesudahnya tetap menemukan pesanannya —
tetapi yang masih menunggu selalu menang atas yang sudah kedaluwarsa, karena
nominalnya memang boleh dipakai ulang.

---

## Yang perlu Anda lakukan

### 1. Jalankan SQL-nya

```
supabase-update-v18-klaim-dan-mutasi.sql
```

### 2. Kalau ingin benar-benar otomatis, selesaikan v17

Isi `CAKRAWALA_MUTASI_SECRET` di Vercel, deploy ulang, lalu pasang penerus
pemberitahuannya di ponsel. Langkah lengkapnya di
`UPDATE-V17-PEMBAYARAN-OTOMATIS.md`.

**Cara memastikannya jalan tanpa mengeluarkan uang:** buat pesanan apa pun,
lalu dari komputer kirim satu pemberitahuan palsu:

```bash
curl -X POST https://www.sipalingfisip.web.id/api/cakrawala-mutasi \
  -H 'content-type: application/json' \
  -H 'x-cakrawala-kunci: KUNCI-ANDA' \
  -d '{"text":"Kamu menerima Rp10.037 dari Uji"}'
```

Ganti nominalnya dengan nominal pesanan yang barusan dibuat. Kalau jawabannya
`{"success":true,"dikerjakan":true,...}` dan kodenya muncul di layar pembeli,
jembatannya benar — tinggal ponselnya yang perlu disetel. Kalau jawabannya
404, kuncinya belum terbaca di Vercel.

### 3. Kalau belum sempat

Tidak apa-apa. Tombol **Tandai lunas** tetap ada, panel menyegar sendiri tiap
20 detik, klaim pembeli naik ke puncak dengan penanda kuning, dan tidak ada
pembayaran yang hilang.

---

## Yang dijaga uji otomatis

`uji-klaim.ts` — 25 pemeriksaan terhadap **basis data sungguhan** (berkas uji
lain di repositori ini murni perhitungan; yang ini harus menyentuh tabel,
karena yang dijaga justru perilaku yang hanya muncul ketika ada tabel):

- pesanan kedaluwarsa tetap ditemukan dari nominalnya, tetapi yang masih
  menunggu selalu menang
- pembayaran hari ini tidak menyambar pesanan 90 hari lalu
- satu pembayaran tetap satu kode walau pemberitahuannya datang dua kali
- klaim memperpanjang masa berlaku, dan penyapu berkala tidak membunuhnya
- klaim menghidupkan pesanan yang kedaluwarsa, tetapi **tidak** menyentuh yang
  sudah lunas maupun yang sudah batal
- mutasi uang keluar tidak pernah dibaca sebagai pembayaran oleh klaim
- mutasi berumur dua hari tidak lagi dipakai
- sepuluh pesanan berurutan menerima sepuluh nominal berbeda

Jalankan dengan:

```bash
DATABASE_URL=postgres://... npx tsx uji-klaim.ts
```

Tanpa `DATABASE_URL` ia melewatkan dirinya sendiri, bukan gagal.

Seluruh berkas `uji-*.ts` lain tetap lulus.
