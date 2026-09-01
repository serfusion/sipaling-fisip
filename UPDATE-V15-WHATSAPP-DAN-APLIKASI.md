# v15: Catatan Uang lewat WhatsApp, aplikasinya sendiri, dan menunya di Cakrawala

## Masalahnya

Catatan Uang v14 sudah bisa dipakai lewat satu pesan, tetapi pesannya harus
diketik di halaman web atau di Telegram. Keduanya menuntut hal yang sama, dan
hal itulah yang selama ini membunuh aplikasi pencatat keuangan:

> **orang harus membuka sesuatu lebih dulu.**

Padahal aplikasi yang sudah terbuka sepanjang hari di ponsel orang Indonesia
cuma satu, dan itu WhatsApp. Selama mencatat berarti berpindah aplikasi,
pengeluaran sepuluh ribu tidak akan pernah dicatat siapa pun.

Ada satu lagi: pelanggan Cakrawala tidak punya jalan masuk ke alat ini, padahal
mereka sudah berlangganan.

---

## Yang berubah

### 1. WhatsApp menjadi pintu utama

Kirim pesan biasa ke nomor botnya, dan catatannya sudah ada di web, di
aplikasi, dan di panel Cakrawala sebelum halamannya sempat dibuka:

```
-beli nasi uduk 10k
+honor guru 100k
kemarin -20k grab ke kampus
```

Balasannya menyebutkan apa yang tercatat, kategorinya, dan sisa uang bulan
berjalan. Sekali saja perlu menyambungkan: kirim `daftar UNG-XXXX-XXXX-XXXX`,
atau tekan tombol **Sambungkan WhatsApp sekarang** di halaman Catatan Uang,
yang membuka WhatsApp dengan pesan pendaftarannya sudah terisi.

**Perintahnya tanpa garis miring.** Di WhatsApp orang tidak mengetik `/`, jadi
`ringkas`, `batal`, `buku`, dan `lepas` cukup ditulis apa adanya. Yang menjaga
supaya kata biasa tidak tertelan menjadi perintah ada dua aturan:

| Yang diketik | Dibaca sebagai |
| --- | --- |
| `batal` | perintah, karena pesannya hanya satu kata itu |
| `hapus tagihan wifi 300k` | catatan uang, karena kalimatnya panjang |
| `bantuan sosial 500k` | catatan uang, bukan permintaan bantuan |
| `daftar UNG-7HQ4-M2XB-9KDT` | pendaftaran, karena argumennya kode yang sah |
| `daftar ulang 500k` | catatan uang (biaya kuliah) |

Telegram tetap jalan seperti sebelumnya. Keduanya kini memakai otak yang sama
di `src/lib/uang/percakapan.ts`, jadi tidak mungkin satu kalimat tercatat
berbeda di dua kanal.

### 2. Aplikasinya sendiri

Halaman `/uang` sekarang dapat dipasang sebagai aplikasi: ada ikonnya di layar
utama, terbuka tanpa bilah peramban, dan punya nama sendiri (**Catatan Uang**),
bukan nama portalnya.

- Di Android/Chrome muncul tawaran **Pasang** di kepala halaman.
- Di iPhone/Safari lewat menu Bagikan, lalu "Tambah ke Layar Utama".
- Ikonnya dibangkitkan sendiri di dalam gudang ini (`public/images/uang/`),
  tidak mengambil dari mana pun.

**Tetap bisa mencatat tanpa sinyal.** Orang mencatat uang justru di tempat
sinyalnya paling buruk: di pasar, di parkiran, di antrean kasir. Catatan yang
gagal terkirim disimpan di perangkat, dihitung di layar ("3 catatan menunggu
sinyal"), dan dikirim sendiri begitu jaringannya kembali. Kotak tulisnya tetap
dikosongkan, karena catatannya memang sudah aman, dan menahannya di layar cuma
membuat orang mengetik ulang.

Yang **tidak** pernah disimpan luring: jawaban API. Angka uang yang basi lebih
berbahaya daripada halaman yang tidak terbuka, karena yang basi tidak terlihat
basi.

**Layarnya menyegarkan diri.** Selama halamannya terbuka dan sedang dilihat,
isinya ditanyakan ulang tiap dua puluh lima detik. Inilah yang membuat catatan
yang dikirim lewat WhatsApp muncul sendiri di layar yang sedang terbuka.

### 3. Menu tersendiri di dalam Cakrawala

Pelanggan Cakrawala mendapat alat ini di dalam langganan yang sama, pada
kelompok menu **"Di luar kuliah"**, terpisah dari sembilan alat naskah.

Pemisahan itu bukan soal tata letak. Alat naskah bekerja pada project skripsi;
yang ini bekerja pada uang pribadi pemiliknya. Menaruh keduanya sederajat dalam
satu daftar membuat orang menyangka catatan belanjanya ikut menjadi bagian dari
project, atau ikut terbaca dosen pembimbing. Karena itu menunya dipisah, diberi
warna sendiri, dan panelnya menyatakan hal itu di kepala.

**Bukunya sudah disiapkan.** Begitu menunya dibuka, buku kasnya ada, tanpa kode
kedua yang perlu diingat dan tanpa pendaftaran ulang di ponsel. Yang
menyamakannya antar perangkat adalah sidik kode akses Cakrawala (SHA-256, tidak
pernah kodenya sendiri), jadi bocornya tabel catatan uang tidak membuka menu
Cakrawala.

Layarnya berkas yang sama persis dengan halaman `/uang`. Warnanya menumpang
palet Cakrawala lewat token `--ug-*`, sehingga mode malam dan mode terang
Cakrawala keduanya terlayani tanpa satu pun aturan CSS tambahan.

---

## Cara memasang WhatsApp

Pilih salah satu. Tanpa keduanya, jalur WhatsApp tertidur dan menjawab 404
untuk siapa pun; sisa aplikasinya tidak terpengaruh.

### Cara A: WhatsApp Cloud API resmi (Meta)

Gratis untuk percakapan yang dimulai pengguna, tetapi perlu akun Meta Business
dan nomor yang belum terdaftar di aplikasi WhatsApp biasa.

1. Buat aplikasi di [developers.facebook.com](https://developers.facebook.com),
   tambahkan produk **WhatsApp**, dan catat **Phone number ID** serta
   **access token**-nya.
2. Isi environment variables di Vercel:

   ```
   WHATSAPP_TOKEN=EAAG...
   WHATSAPP_PHONE_ID=123456789012345
   WHATSAPP_VERIFY_TOKEN=karangan-sendiri-yang-panjang
   WHATSAPP_APP_SECRET=dari-menu-App-Settings-Basic
   NEXT_PUBLIC_UANG_WA=628123456789
   ```

3. Deploy ulang, lalu daftarkan webhooknya di menu WhatsApp, Configuration:
   - Callback URL: `https://alamat-portal-anda/api/uang/whatsapp`
   - Verify token: isi sama persis dengan `WHATSAPP_VERIFY_TOKEN`
   - Berlangganan bidang **messages**

`WHATSAPP_APP_SECRET` wajib. Tanpa itu jalurnya menolak semua kiriman dengan
503, karena tanda tangan itulah satu-satunya yang membedakan pesan sungguhan
dari pesan karangan atas nama nomor orang lain.

### Cara B: Gerbang pihak ketiga (Fonnte, Wablas, Watzap)

Lebih cepat dipasang dan memakai nomor WhatsApp biasa.

1. Daftar di gerbangnya, sambungkan nomor Anda, ambil tokennya.
2. Isi environment variables:

   ```
   WA_GATEWAY_SECRET=karangan-sendiri-yang-panjang
   WA_GATEWAY_KIRIM_URL=https://api.fonnte.com/send
   WA_GATEWAY_TOKEN=token-dari-gerbangnya
   NEXT_PUBLIC_UANG_WA=628123456789
   ```

3. Di panel gerbangnya, arahkan webhook pesan masuk ke
   `https://alamat-portal-anda/api/uang/whatsapp`, dan sertakan kata sandinya
   pada header `X-Uang-Secret` atau pada kolom `secret` di badan kiriman.

Muatan masuknya menerima nama kolom yang lazim dipakai
(`sender`/`pengirim`/`from`/`phone` dan `message`/`pesan`/`text`/`body`), jadi
berpindah gerbang tidak berarti mengubah kode. Balasannya dikirim dalam bentuk
Fonnte (`POST {target, message}` dengan token pada header `Authorization`);
gerbang yang bentuknya berbeda cukup diarahkan ke alamat penyesuainya sendiri
lewat `WA_GATEWAY_KIRIM_URL`.

---

## Semua environment variable Catatan Uang

| Nama | Wajib | Gunanya |
| --- | --- | --- |
| `NEXT_PUBLIC_UANG_WA` | tidak | Nomor bot untuk tombol "Sambungkan WhatsApp". Dibaca saat build, jadi perlu deploy ulang bila diganti |
| `NEXT_PUBLIC_UANG_TELEGRAM` | tidak | Nama bot Telegram untuk tombol pembukanya |
| `WHATSAPP_TOKEN` | Cara A | Token pengirim balasan |
| `WHATSAPP_PHONE_ID` | Cara A | Nomor pengirimnya |
| `WHATSAPP_VERIFY_TOKEN` | Cara A | Kata sandi saat mendaftarkan webhook |
| `WHATSAPP_APP_SECRET` | Cara A | Pemeriksa tanda tangan tiap kiriman |
| `WHATSAPP_API_VERSION` | tidak | Bawaannya `v21.0` |
| `WA_GATEWAY_SECRET` | Cara B | Kata sandi bersama dengan gerbangnya |
| `WA_GATEWAY_KIRIM_URL` | tidak | Alamat pengirim balasan |
| `WA_GATEWAY_TOKEN` | tidak | Tokennya |
| `TELEGRAM_BOT_TOKEN` | tidak | Jalur Telegram (v14) |
| `TELEGRAM_WEBHOOK_SECRET` | tidak | Jalur Telegram (v14) |
| `UANG_GARAM` | tidak | Kata tambahan untuk sidik pemilik buku Cakrawala |

---

## Basis data

Jalankan `supabase-update-v15-uang-cakrawala.sql` di Supabase SQL Editor
(sesudah v14). Satu kolom dan satu indeks: penanda pemilik buku, supaya
pelanggan Cakrawala mendapat buku yang sama di semua perangkatnya.

---

## Berkas yang ditambahkan

```
src/lib/uang/percakapan.ts      otak percakapan, dipakai WhatsApp dan Telegram
src/lib/uang/perintah.ts        pemisah perintah dari catatan uang
src/lib/uang/pesan-masuk.ts     tanda tangan dan penyaring kiriman ulang
src/lib/uang/whatsapp.ts        nomor, muatan, dan pengirim balasan
src/app/api/uang/whatsapp/      webhook WhatsApp (Meta dan gerbang)
src/app/api/uang/buku/cakrawala/ buku milik pelanggan Cakrawala
src/app/alat/panel-uang.tsx     panel Catatan Uang di dalam Cakrawala
public/manifest-uang.webmanifest
public/uang-sw.js               pekerja latar: rangka halaman saat luring
public/images/uang/             ikon aplikasi, dibangkitkan di gudang ini
supabase-update-v15-uang-cakrawala.sql
```

Yang diubah: `src/app/uang/uang-app.tsx` (antrean luring, penyegaran sendiri,
tawaran pemasangan, ragam Cakrawala), `src/app/api/uang/telegram/route.ts`
(tinggal protokolnya saja, dari 300 baris menjadi 99), `src/app/alat/alat-app.tsx`
(kelompok menu kedua), `src/db/schema.ts`, dan `src/app/globals.css` (token
warna `--ug-*`).

## Menjalankan ujinya

```bash
npx tsx uji-uang.ts
```

137 periksa, naik dari 105. Yang baru: pemisah perintah dari catatan uang
(termasuk "bantuan sosial 500k" dan "daftar ulang 500k" yang keduanya harus
tetap menjadi catatan uang), penyeragaman nomor WhatsApp dari tiga penulisan
yang berbeda, dan pembacaan muatan Meta maupun gerbang, termasuk memastikan
pemberitahuan "sudah dibaca" tidak ikut dianggap pesan.
