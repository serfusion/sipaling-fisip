# v14: Catatan Uang, cukup dengan mengirim pesan

## Masalahnya

Aplikasi pencatat keuangan hampir selalu gagal di titik yang sama, dan
titiknya bukan fiturnya: **mencatat terlalu repot untuk dikerjakan sambil
berdiri di depan kasir.** Buka aplikasi, tunggu memuat, tekan tombol tambah,
pilih "pengeluaran", ketik nominal, gulir daftar kategori, pilih tanggal,
simpan. Delapan ketukan untuk nasi uduk sepuluh ribu. Setelah tiga hari,
tidak ada yang meneruskannya.

Tiga sumber rujukan yang dipakai sebagai pembanding (daily-expenses-tracker,
clearflow, FinTrack) semuanya rapi di sisi laporan, tetapi ketiganya memasukkan
data lewat formulir atau unggahan CSV. Yang paling ringan pun tetap sebuah
formulir.

Padahal orang sudah terbiasa menulis catatan uangnya dalam satu baris:

> +honor guru 100k
> -beli nasi uduk 10k

Satu baris itu sudah memuat segalanya: arah uangnya, nominalnya, keperluannya,
dan (kalau dibaca dengan benar) kategorinya. Yang kurang selama ini hanyalah
sesuatu yang mau membacanya.

---

## Yang dibangun

Halaman **/uang** dan satu jalur Telegram, keduanya bertumpu pada pengurai
kalimat yang sama.

### 1. Bahasa pesannya

| Yang diketik | Yang tercatat |
| --- | --- |
| `+honor guru 100k` | masuk Rp100.000, Gaji & honor, hari ini |
| `-beli nasi uduk 10k` | keluar Rp10.000, Makan & jajan, hari ini |
| `beli nasi uduk 10k` | keluar (arah ditebak dari kata "beli") |
| `gaji bulan ini 3jt` | masuk (arah ditebak dari kata "gaji") |
| `kemarin -20k grab ke kampus` | keluar Rp20.000, Transportasi, kemarin |
| `27/8 -50rb belanja` | keluar Rp50.000, Belanja, 27 Agustus |
| `-200k servis #tak-terduga` | kategorinya dipaksa, bukan ditebak |

**Nominal** boleh ditulis `10k`, `10rb`, `10 ribu`, `10.000`, `10000`,
`Rp10.000`, `1,5jt`, atau `2 juta`. Angka yang menempel pada satuan barang
tidak pernah dikira nominal: pada `beli 5kg beras 60rb` yang tercatat 60 ribu,
bukan lima.

**Arah** ditentukan tanda `+` atau `-` di depan baris. Tanpa tanda, arahnya
ditebak dari kata kerjanya, dan kata pengeluaran diperiksa lebih dulu supaya
`bayar gaji karyawan` tidak pernah terbaca sebagai gajian.

**Tanggal** boleh berupa `kemarin`, `kemarin lusa`, `27/8`, `27/8/2025`, atau
`27 agustus`. Tanggal tanpa tahun yang jatuh jauh di depan dianggap tahun lalu:
`31/12` yang ditulis pada bulan September berarti Desember tahun lalu, karena
catatan uang selalu tentang yang sudah terjadi.

**Beberapa catatan sekaligus** cukup ditulis satu per baris (atau dipisah titik
koma). Satu baris yang gagal dibaca tidak menjatuhkan baris lainnya, dan
alasannya tetap dilaporkan.

### 2. Kategorinya ditebak, bukan dipilih

Empat belas kategori dengan kamus kata sehari-hari:

- **Pemasukan:** Gaji & honor, Usaha & jualan, Hadiah & bantuan, Uang kembali
- **Pengeluaran:** Makan & jajan, Belanja, Transportasi, Tagihan & langganan,
  Kesehatan, Pendidikan, Hiburan & gaya hidup, Sosial & keluarga,
  Tabungan & investasi, Biaya tak terduga
- **Penutup:** Lainnya

Pencocokannya berhenti di awal kata, jadi "fotokopi" tidak pernah tertangkap
kata "kopi", dan yang menang adalah kecocokan terpanjang, jadi "top up game"
mengalahkan "game". Arah uang ikut menyaring, sehingga "kado" masuk ke
Hadiah ketika diterima dan ke Sosial ketika diberikan.

Kalau tebakannya meleset, tinggal tambahkan `#nama-kategori` pada pesannya.
Di halaman web, kategori yang dipilih ditulis sebagai tanda pagar di kotak
tulis, bukan disimpan diam-diam: yang terlihat selalu sama dengan yang
terkirim.

### 3. Halaman /uang

Satu layar, dan kotak tulisnya yang jadi pusat:

- Pratinjau langsung sambil mengetik. Pengurainya berkas yang sama dengan yang
  dipakai server, jadi yang terlihat memang yang akan tersimpan.
- Tiga angka bulan berjalan: pemasukan, pengeluaran, sisa.
- Batang enam bulan terakhir, dapat ditekan untuk berpindah bulan.
- Rincian per kategori, diurutkan dari yang paling besar.
- Daftar catatan dikelompokkan per hari beserta jumlah hariannya.
- Unduhan CSV per bulan untuk Excel atau Google Sheets.

### 4. Telegram

Sesudah botnya dipasang (lihat di bawah), pemiliknya cukup mengirim
`/daftar UNG-XXXX-XXXX-XXXX` sekali, lalu semua pesan berikutnya langsung
menjadi catatan. Balasannya menyebutkan apa yang tercatat beserta ringkasan
bulan berjalan.

Perintah yang tersedia: `/daftar`, `/ringkas`, `/batal` (menghapus catatan
terakhir), `/buku`, `/lepas`, dan `/bantuan`.

### 5. Buku kas berkode, tanpa akun

Yang punya akun di portal ini hanya dosen dan admin, sementara catatan uang
milik pribadi siapa saja. Karena itu bukunya dikunci oleh kode, bukan oleh
login: satu kode yang sama membuka buku yang sama di ponsel, di laptop, dan di
Telegram.

Kodenya dua belas huruf dari tiga puluh satu kemungkinan (sekitar 59 bit),
disimpan di perangkat masing-masing, dan penebak kode yang salah dibatasi
lajunya di sisi server. Konsekuensinya jujur: **kode yang hilang berarti
bukunya hilang**, dan kode yang terlihat orang lain berarti bukunya ikut
terbuka. Halaman /uang menyebut ini apa adanya, bukan menyembunyikannya.

---

## Cara memasang

### 1. Tabel basis data

Jalankan `supabase-update-v14-catatan-uang.sql` di Supabase, menu
SQL Editor. Aman diulang. Isinya tiga tabel (`money_books`, `money_entries`,
`money_channels`), indeksnya, dan RLS tanpa policy, persis seperti
`cakrawala_orders`: seluruh pembacaan dan penulisan lewat server.

Sampai di sini halaman /uang sudah berjalan penuh.

### 2. Bot Telegram (opsional)

Tanpa dua environment variable di bawah, jalur Telegram tertidur dan menjawab
404 untuk siapa pun. Halaman webnya tidak terpengaruh.

1. Buat bot lewat [@BotFather](https://t.me/BotFather), perintah `/newbot`.
   Salin tokennya.
2. Buat kata sandi acak untuk webhook, mis. dengan
   `openssl rand -hex 32`.
3. Isi environment variables di Vercel (Settings, Environment Variables):

   ```
   TELEGRAM_BOT_TOKEN=1234567890:AAxxxxxxxxxxxxxxxxxxxxxxxxxx
   TELEGRAM_WEBHOOK_SECRET=hasil-openssl-tadi
   ```

4. Deploy ulang, lalu daftarkan webhooknya sekali:

   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://alamat-portal-anda/api/uang/telegram" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

5. Buka botnya di Telegram, kirim `/daftar` diikuti kode buku Anda.

Kirim kodenya di percakapan pribadi dengan botnya, jangan di grup.

### 3. Otomasi lain (opsional)

Jalur webnya sendiri berupa satu POST biasa, jadi gerbang WhatsApp, Shortcut
iOS, Tasker, atau apa pun yang bisa mengirim HTTP dapat memakainya:

```bash
curl -X POST "https://alamat-portal-anda/api/uang/catat" \
  -H "content-type: application/json" \
  -d '{"kode":"UNG-XXXX-XXXX-XXXX","pesan":"-beli nasi uduk 10k"}'
```

Kodenya boleh dipindah ke header `X-Kode-Buku` bila muatannya ingin berisi
pesannya saja. Balasannya memuat apa yang tercatat beserta baris yang gagal
dibaca, jadi otomasinya dapat meneruskan kabar itu ke pengirimnya.

---

## Batas yang dipasang

| Jalur | Batas |
| --- | --- |
| Buku baru | 5 per jam per alamat |
| Mencatat | 60 per menit per alamat |
| Membaca | 120 per menit per alamat |
| Kode yang salah | 20 per 10 menit per alamat |
| Isi satu buku | 20.000 catatan |
| Baris per pesan | 20 |
| Nominal | paling besar 100 miliar |

Penghitungnya berbasis memori proses, sama seperti pembatas laju yang sudah
ada di portal ini. Untuk jaminan yang keras, aktifkan rate limiting di Vercel
Firewall.

---

## Berkas yang ditambahkan

```
src/lib/uang/kategori.ts        kamus kategori dan penebaknya
src/lib/uang/urai-pesan.ts      pengurai kalimat menjadi satu catatan
src/lib/uang/buku.ts            kode buku: bentuk, pembuatan, normalisasi
src/lib/uang/format.ts          rupiah dan tanggal untuk layar
src/lib/uang/simpan.ts          sisi server: menyimpan, membaca, meringkas
src/lib/uang/gerbang.ts         pemeriksaan kode pada tiap permintaan
src/app/uang/page.tsx           halaman /uang
src/app/uang/uang-app.tsx       layarnya
src/app/api/uang/buku/          buat buku, baca buku, ganti nama
src/app/api/uang/catat/         satu pintu masuk semua catatan
src/app/api/uang/catatan/       isi satu bulan, dan penghapusan
src/app/api/uang/telegram/      webhook bot
supabase-update-v14-catatan-uang.sql
uji-uang.ts                     105 periksa atas pengurai dan kodenya
```

Yang diubah: `src/db/schema.ts` (tiga tabel), `src/app/globals.css` (kelas
berawalan `.ug-`), dan satu tautan "Catatan Uang" di kepala halaman utama.

> **Lanjutannya ada di UPDATE-V15-WHATSAPP-DAN-APLIKASI.md**: jalur WhatsApp,
> pemasangan sebagai aplikasi beserta antrean luringnya, dan menu Catatan Uang
> di dalam Cakrawala. Isi berkas ini tetap berlaku; yang berubah di sana hanya
> bertambah.

## Menjalankan ujinya

```bash
npx tsx uji-uang.ts
```

Yang diperiksa bukan "kodenya jalan", melainkan hal-hal yang kalau meleset
merusak catatan keuangan orang: tujuh cara menulis sepuluh ribu harus berhenti
pada bilangan yang sama, "beli 5kg beras 60rb" tidak boleh tercatat lima
rupiah, "bayar gaji karyawan" tidak boleh terbaca sebagai pemasukan, dan
"fotokopi" tidak boleh masuk anggaran jajan.
