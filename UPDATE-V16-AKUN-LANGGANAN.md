# v16: Langganan pindah dari perangkat ke nomor WhatsApp

## Masalahnya

Sampai v15, akses Cakrawala hanyalah sebuah cookie berisi kode. Itu berarti
tiga hal yang semuanya merugikan orang yang sudah membayar:

1. **Ganti HP = kehilangan akses.** Cookie tinggal di satu peramban. Mahasiswa
   yang membeli paket 180 hari lalu ponselnya rusak di bulan kedua tidak punya
   apa pun untuk dibawa ke ponsel barunya.
2. **Perpanjangan tidak punya tempat menempel.** Tidak ada "akun" yang dapat
   ditambahi hari. Satu-satunya cara memperpanjang adalah menerbitkan kode
   baru, dan kode baru berarti pelanggannya harus diminta memasukkannya lagi.
3. **Aplikasi tidak dapat mengenali pelanggan yang sama.** Aplikasi tidak
   berbagi cookie dengan peramban.

Dan satu lagi yang lebih pelan tetapi lebih mahal: kode yang bocor dapat
dipakai berapa orang pun sampai kuotanya habis, dan tidak ada yang tahu siapa
yang memakainya.

---

## Yang berubah

### 1. Langganan menempel pada nomor WhatsApp

Kotak kode sekarang meminta **kode akses + nomor WhatsApp**. Nomor itu
didaftarkan **sekali** saat kode ditukar, lalu kode itu **terkunci** padanya.

- Ganti HP, buka di laptop, cookie terhapus → masukkan kode + nomor yang sama,
  masuk lagi. Tidak menambah hari, tidak memotong kuota.
- Kode yang sama dimasukkan **nomor lain** → ditolak. Satu kode satu nomor.
- Nanti aplikasinya cukup memakai jalur yang sama, dan pelanggannya otomatis
  adalah orang yang sama dengan di web.

**Tidak ada OTP dan tidak ada kata sandi**, dan itu keputusan sadar. Yang dapat
menyamar hanyalah orang yang tahu kode akses milik temannya — dan orang itu
memang sudah bisa masuk bahkan sebelum akun ada. Jadi tidak ada yang bertambah
bocor, sementara biayanya nol rupiah: OTP berarti berlangganan gerbang SMS.

### 2. Perpanjangan lewat WhatsApp

Panel **Kunci Cakrawala** di dashboard punya bagian baru: **Langganan
pelanggan**. Ada yang mengirim pesan minta perpanjang? Ketik nomornya,
tentukan harinya, tekan **Perpanjang**. Selesai — web dan aplikasi ikut
memanjang saat itu juga, tanpa kode baru dan tanpa pendaftaran ulang.

Tabelnya mengurutkan **yang paling dekat habis lebih dulu**, dan menandai
merah yang sudah lewat, kuning yang tinggal seminggu. Itu daftar orang yang
perlu dihubungi minggu ini.

Aturan hitungnya: **menambah, bukan memotong.** Memperpanjang 30 hari ketika
masih tersisa 7 hari menghasilkan 37 hari, bukan 30. Langganan yang sudah
lewat dihitung dari hari ini.

### 3. Sisa langganan terlihat oleh pemiliknya

Di kepala halaman Cakrawala ada lencana "Langganan 12 hari lagi". Seminggu
terakhir berubah kuning dan menyebut cara memperpanjang. Orang memperpanjang
tepat waktu kalau ia tahu kapan waktunya habis — bukan setelah terkunci di
tengah mengerjakan bab.

Yang sudah telanjur habis disapa dengan namanya di halaman pratinjau, lengkap
dengan tanggal berakhirnya, bukan disodori halaman jualan yang sama seperti
kepada orang yang belum pernah membeli apa-apa.

### 4. Nomor diminta saat membeli, bukan sesudahnya

Formulir pembelian sekarang **mewajibkan** nomor WhatsApp, dan nomor itu ikut
terisi sendiri di kotak kode begitu pembayarannya lunas. Alasannya bukan
kerapian: meminta belakangan berarti ada jeda ketika seseorang sudah membayar
tetapi belum punya tempat untuk menyimpan apa yang ia beli.

### 5. Catatan Uang mengikuti nomor, bukan kode

Buku kas di Free VIP Tools dulu dikenali dari sidik kode aksesnya. Kode
berganti setiap perpanjangan, jadi catatan setahun bisa hilang hanya karena
kodenya diperbarui. Sekarang ia dikenali dari sidik **nomor**-nya, dan buku
lama ikut dipindahkan sendiri pada pembukaan pertama.

Nomor maupun kode tetap **tidak pernah** tersimpan di tabel catatan uang —
yang disimpan hanya sidiknya. Bocornya satu tabel tidak membuka menu
Cakrawala.

### 6. Batas perangkat pada kode dimatikan

Yang mengunci sekarang tabel penukaran, bukan penghitung pemakaian. Penghitung
itu justru berbahaya bila dibiarkan: kalau pembuatan akunnya gagal setelah
kodenya telanjur terhitung terpakai, pembeli paket satu perangkat terkunci di
luar oleh kodenya sendiri — dan ia sudah membayar.

---

## Yang perlu Anda lakukan

### 1. Jalankan SQL-nya di Supabase

SQL Editor → tempel → Run. Aman diulang.

```
supabase-update-v13-pesanan-cakrawala.sql   (kalau belum pernah dijalankan)
supabase-update-v16-akun-cakrawala.sql
```

### 2. Pasang QRIS statis Anda di Vercel

Settings → Environment Variables:

| Nama | Isi |
| --- | --- |
| `QRIS_STATIS` | seluruh isi teks QRIS merchant Anda (yang diawali `00020101…`) |

Tanpa ini, tombol beli tidak dapat membuat QR. Isinya tidak pernah dikirim ke
peramban — yang keluar hanya gambar QR-nya.

### 3. Sekali saja: pindai QR-nya sendiri

Buka halaman beli, pilih paket **Bab**, dan pindai QR yang muncul dengan
aplikasi pembayaran Anda sendiri. Yang harus terlihat: **Rp 25.037** dan nama
merchant Anda. Ini satu-satunya hal yang tidak dapat diperiksa dari sini,
karena hanya aplikasi bank sungguhan yang dapat membacanya.

---

## Yang dijaga uji otomatis

`npx tsx uji-akun.ts` — 48 pemeriksaan:

- semua bentuk nomor (`0812…`, `+62 812-…`, `62…@c.us`) bermuara pada satu
  nomor yang sama, karena kalau tidak, perpanjangan mendarat di akun yang salah
- perpanjangan menambah dari akhir yang masih berjalan, dan mulai dari hari ini
  bila sudah lewat
- umur cookie tidak pernah melampaui batasnya, dan tenggangnya tidak pernah
  membuat akun yang habis terbaca aktif
- migrasinya benar-benar memuat `UNIQUE` pada kode penukaran — kunci yang hanya
  ada di JavaScript dapat dilewati dua permintaan yang datang bersamaan

Seluruh berkas `uji-*.ts` lain tetap lulus.
