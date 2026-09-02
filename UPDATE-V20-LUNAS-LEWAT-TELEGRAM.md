# v20: Satu balasan Telegram menerbitkan kodenya

## Kenapa masih menggantung

Tombol "Saya sudah membayar" **tidak pernah dapat menerbitkan kode sendiri.**
Menekan tombol bukan bukti membayar; kalau tombolnya sendiri menerbitkan kode,
Cakrawala menjadi gratis bagi siapa pun yang mau menekannya.

Yang dilakukannya: mencocokkan ulang ke **catatan mutasi**. Kalau
pemberitahuan DANA sudah tercatat di sana, kodenya terbit saat itu juga. Kalau
catatannya kosong — dan sampai jembatannya dipasang, ia memang selalu kosong —
tidak ada yang dapat dicocokkan, jadi ia menunggu.

**Cara memastikan:** dashboard → Kunci Cakrawala → panel **Jembatan DANA**.
Lencana "belum aktif" berarti belum ada satu pun pemberitahuan yang sampai.

---

## Yang berubah

### 1. Tombolnya menyala

Emas, tebal, dengan denyut pelan yang berhenti sendiri saat ditekan. Tombol
samar membuat orang menyangka tidak ada lagi yang bisa dilakukan lalu menutup
halamannya. (Denyutnya mati sendiri bila ponselnya disetel mengurangi gerak.)

Layar tunggunya juga menghitung: "Pembayaranmu sedang diperiksa · 3 menit".
Angka yang bergerak memberi tahu bahwa halamannya masih bekerja.

### 2. Klaim mengabari ponsel Anda lewat Telegram

Begitu ada yang menekan tombol itu, Telegram Anda berbunyi:

```
💰 KLAIM PEMBAYARAN

Pesanan : PSN-XAZLTQ
Paket   : Coba · 3 hari
Nominal : Rp 10.573
Nama    : Rina

Cek mutasi DANA. Kalau nominalnya cocok, balas pesan ini:
lunas PSN-XAZLTQ
```

### 3. Balas "lunas PSN-XXXXXX" — kodenya terbit

Dari layar kunci, tanpa membuka dashboard. Kodenya langsung muncul di layar
pembelinya karena halamannya memang terus memeriksa.

Perintah lain:

| Ketik | Artinya |
| --- | --- |
| `lunas PSN-XXXXXX` | terbitkan kode aksesnya |
| `cek PSN-XXXXXX` | lihat status pesanannya |
| `PSN-XXXXXX` | ditempel sendirian = cek |

**Hanya dari chat Anda.** Bot Telegram dapat diajak bicara siapa saja yang tahu
namanya, dan "lunas PSN-…" dari orang asing berarti kode akses yang diberikan
gratis. Chat lain tidak diberi tahu bahwa perintah ini ada — pesannya
diteruskan ke jalur Catatan Uang seperti biasa.

Perintah yang sama dikirim dua kali **tidak** menerbitkan kode kedua.

---

## Memasangnya (5 menit, gratis)

1. Telegram → cari **@BotFather** → `/newbot` → simpan tokennya.
2. Kirim satu pesan apa pun ke bot Anda, lalu buka
   `https://api.telegram.org/bot<TOKEN>/getUpdates` di peramban dan salin
   angka `chat.id`-nya.
3. Vercel → Environment Variables:

| Nama | Isi |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | token dari BotFather |
| `TELEGRAM_ADMIN_CHAT_ID` | chat id Anda |
| `TELEGRAM_WEBHOOK_SECRET` | teks acak bebas |

4. Daftarkan webhook-nya sekali:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://www.sipalingfisip.web.id/api/uang/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Deploy ulang. Selesai — dan bot yang sama sekaligus menjadi pintu Catatan Uang
yang sudah ada sejak v14.

---

## Tiga jalan, dan biayanya masing-masing

Supaya pilihannya jelas, bukan supaya satu di antaranya didorong:

| Jalan | Otomatis? | Biaya | Kesiapan |
| --- | --- | --- | --- |
| **Balas Telegram** (v20) | satu ketukan dari layar kunci | gratis | 5 menit |
| **Penerus pemberitahuan DANA** (v17) | ya, penuh | gratis | pasang aplikasi di ponsel, ~15 menit |
| **Gerbang pembayaran** | ya, penuh | **tanpa biaya bulanan**, sekitar 0,7% per transaksi (± Rp 175 dari Rp 25.000) | daftar merchant |

Yang ketiga perlu diluruskan: gerbang seperti Midtrans, Xendit, atau Tripay
**tidak menagih bulanan** — yang ditagih hanya persentase tiap transaksi
berhasil. Kalau suatu saat Anda memilih itu, alurnya sudah siap:
`/api/cakrawala-webhook` menunggu sejak v13, tinggal dipasangi
`CAKRAWALA_WEBHOOK_SECRET`.

Ketiganya boleh menyala bersamaan. Mana pun yang lebih dulu memastikan
pembayarannya, kodenya terbit sekali — dan hanya sekali.

---

## Yang dijaga uji otomatis

`uji-klaim.ts` — kini 43 pemeriksaan, terhadap Postgres sungguhan:

- perintah ditulis tanpa garis miring, dan huruf besar-kecil tidak masalah
- `lunas` menerbitkan kode; perintah yang sama sekali lagi mengembalikan kode
  yang sama, bukan kode kedua
- **pesan Catatan Uang tidak tertelan menjadi perintah pesanan.** Uji ini
  menangkap satu kesalahan sungguhan: kata `ringkas` sempat terbaca sebagai
  nomor pesanan, yang berarti perintah Catatan Uang berhenti bekerja bagi
  pemiliknya sendiri. Nomor pesanan sekarang wajib berbentuk `PSN-XXXXXX`.

Jalur Telegramnya juga dijalankan sungguhan lewat HTTP: perintah dari chat
asing tidak mengubah apa pun, perintah dari chat pemilik menerbitkan kode
dengan `paid_via = telegram`, dan mengulanginya tidak menambah kode.
