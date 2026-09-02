# v17: Kode terbit sendiri begitu uang masuk DANA

## Kenapa tadi masih "menunggu pembayaran"

Uangnya benar-benar masuk. Yang tidak terjadi adalah **ada yang memberi tahu
situsnya.**

DANA mengirim pemberitahuan ke satu tempat saja: **ponsel Anda.** Ia tidak
mengetuk server mana pun, karena QRIS statis memang bukan akun merchant yang
punya sambungan balik. Gerbang pembayaran (Midtrans, Xendit, dan sebangsanya)
melakukan pengetukan itu — dan itulah yang Anda bayar setiap bulan kepada
mereka.

Jadi sampai v16, alurnya memang berhenti di situ: pesanan menunggu sampai
**Tandai lunas** ditekan di panel Super Admin. Itu keputusan sadar waktu itu —
supaya Anda bisa berjualan tanpa membayar siapa pun — tetapi saya belum
menuliskannya cukup jelas, dan halaman pembelinya menjanjikan kode yang
"keluar sendiri". Itu yang membuat tes Anda terasa seperti kerusakan.

---

## Yang sekarang bisa

Pemberitahuan DANA yang sudah masuk ke ponsel Anda **diteruskan** ke situs
oleh satu aplikasi kecil di ponsel yang sama. Nominalnya dicocokkan dengan
pesanan yang sedang menunggu — dan nominal itu memang sengaja dibuat unik
(Rp 25.037, bukan Rp 25.000) justru untuk saat ini — lalu kodenya terbit
sendiri dalam hitungan detik.

Hasilnya sama persis dengan gerbang pembayaran. Biayanya nol.

```
DANA (ponsel Anda)
   → pemberitahuan "Kamu menerima Rp25.037 dari …"
      → aplikasi penerus di ponsel yang sama
         → POST ke /api/cakrawala-mutasi
            → nominal dicocokkan dengan pesanan
               → kode akses terbit, layar pembeli berubah
```

---

## Memasangnya

### 1. Buat kunci rahasianya

Kunci acak yang panjang, mis. dari terminal:

```
openssl rand -hex 24
```

Vercel → Settings → Environment Variables:

| Nama | Isi |
| --- | --- |
| `CAKRAWALA_MUTASI_SECRET` | kunci acak tadi |

**Tanpa variabel ini jalurnya tidur dan menjawab 404 kepada siapa pun** —
termasuk kepada yang membawa kunci salah. Alamat yang mengaku ada dan sedang
menunggu kunci hanya mengundang orang mencoba-coba.

Deploy ulang supaya variabelnya terbaca.

### 2. Pasang penerus pemberitahuan di ponsel yang menerima DANA

Yang paling mudah: **MacroDroid** (Android). Alternatifnya Tasker +
AutoNotification, atau Automate — apa pun yang bisa "baca pemberitahuan →
kirim HTTP POST". Nama menunya berbeda-beda antarversi, tetapi bentuknya sama:

**Pemicu (Trigger):** Notifikasi diterima → pilih aplikasi **DANA**

**Aksi (Action):** HTTP Request → **POST**

- URL: `https://www.sipalingfisip.web.id/api/cakrawala-mutasi`
- Header: `x-cakrawala-kunci` = kunci acak dari langkah 1
- Content type: `application/json`
- Body:

```json
{"text": "[notification_title] [notification_text]"}
```

(`[notification_title]` dan `[notification_text]` adalah variabel MacroDroid;
di aplikasi lain namanya berbeda — yang penting isi pemberitahuannya ikut
terkirim.)

Beberapa aplikasi penerus tidak dapat menyetel header sendiri. Untuk itu,
kuncinya boleh ditaruh di badan permintaan:

```json
{"kunci": "KUNCI-ANDA", "text": "[notification_title] [notification_text]"}
```

Kunci **tidak pernah** boleh ditaruh di alamat URL — alamat ikut tercatat di
log server dan proxy.

### 3. Jangan biarkan Android mematikannya

Setelan → Baterai → aplikasi penerusnya → **jangan batasi** / *unrestricted*.
Android mematikan aplikasi latar belakang secara diam-diam, dan yang mati
tidak memberi tahu siapa pun.

### 4. Uji sekali dengan uang sungguhan

Buat pesanan paket **Coba**, bayar Rp 10.0xx dari akun lain, dan lihat apakah
kodenya muncul sendiri di layar pembeli dalam beberapa detik.

---

## Yang tetap ada sebagai jaring pengaman

**Tombol Tandai lunas tidak dihapus.** Ponsel mati, kehabisan baterai, atau
Android mematikan aplikasinya — semuanya mungkin, dan ketika itu terjadi
pesanannya tetap dapat dilunaskan dengan tangan seperti sekarang.

Panel pesanan juga **menyegar sendiri tiap 20 detik** selama terbuka, jadi
pesanan yang masuk terlihat tanpa perlu menekan apa pun.

Dan di layar pembeli: setelah **dua menit** menunggu, muncul keterangan bahwa
pembayarannya tidak hilang, beserta nomor pesanan dan cara menghubungi Anda.
Diam saja selama lima belas menit adalah cara tercepat membuat orang yang
sudah membayar merasa uangnya lenyap.

---

## Yang dijaga supaya tidak salah menerbitkan kode

`npx tsx uji-mutasi.ts` — 39 pemeriksaan atas kalimat pemberitahuan sungguhan:

- **Uang keluar tidak pernah menerbitkan kode.** "Kamu mengirim Rp25.037 ke
  Rina" ditolak, walaupun nominalnya persis sama dengan sebuah pesanan hidup.
  Kata "berhasil" muncul di kedua arah, jadi ia tidak dijadikan penentu.
- **Nominal yang diambil yang PERTAMA disebut, bukan yang terbesar.**
  "Kamu menerima Rp10.001. Saldo kamu Rp25.037" harus terbaca 10.001. Kalau
  yang terbesar yang diambil, pada suatu hari sisa saldo kebetulan sama dengan
  sebuah pesanan hidup, dan kode terbit untuk orang yang belum membayar.
- **Rp25.037,00 = dua puluh lima ribu tiga puluh tujuh**, bukan 2.503.700.
  Titik memisahkan ribuan, koma memisahkan sen.
- **Kiriman yang sama dua kali tetap satu kode.** Aplikasi penerus sering
  mengirim ulang; pesanan yang sudah lunas mengembalikan kode yang sama.
- **Pembayaran hari ini tidak menyambar pesanan tiga bulan lalu.** Pencocokan
  nominal dibatasi 24 jam ke belakang, dan yang berstatus "menunggu"
  didahulukan atas yang sudah kedaluwarsa.

---

## Batasnya, supaya Anda tahu

- **Ponselnya harus hidup dan online.** Ini menggantikan gerbang pembayaran,
  tetapi tidak menggantikan pusat data.
- **Kunci itu ada di ponsel Anda.** Kalau ponselnya hilang, ganti
  `CAKRAWALA_MUTASI_SECRET` di Vercel; yang lama langsung mati.
- **Yang dicocokkan hanya nominalnya**, bukan nama pengirimnya. Itu sebabnya
  nominal unik per pesanan penting, dan sebabnya jendela bayarnya hanya 15
  menit.
