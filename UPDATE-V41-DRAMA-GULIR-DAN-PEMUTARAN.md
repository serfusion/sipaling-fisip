# v41: Nonton Drama — gulir tak berhingga, dan videonya benar-benar jalan

Dua keluhan, satu rilis:

1. **"Mau infinity load seperti di gambar dan seperti di GitHub."** Daftar judul
   kini bertambah sendiri saat digulir, lengkap dengan pemutar berputar dan
   tulisan **"Memuat lebih banyak…"**, lalu **"Semua data telah dimuat"** di
   ujungnya — persis bagian `Infinite*Section` milik hulu.
2. **"Kebanyakan mau nonton tidak bisa terputar videonya."** Ditelusuri sampai
   sebabnya, bukan ditambal di layar. Ada **enam** sebab yang berbeda, dan
   satu di antaranya merusak pemutaran di **seluruh** platform sekaligus.

Tidak ada perubahan basis data. Tidak ada berkas SQL baru. Tidak ada
pengaturan Vercel yang perlu disentuh.

---

## Bagian 1 — Kenapa videonya tidak jalan

### Sebab #1: potongan video dibaca sebagai teks (ini yang terparah)

Penerus aliran membaca jawaban hulu dengan `.text()` bila panjangnya di bawah
4 MB. Maksudnya baik — daftar putar HLS memang harus dibaca sebagai teks supaya
isinya dapat disunting. Akibatnya tidak:

> **Satu potongan video HLS besarnya 200 KB sampai 2 MB.** Jadi hampir SETIAP
> potongan ikut terbaca sebagai teks.

Membaca deretan bita sebagai UTF-8 mengganti tiap bita yang bukan huruf sah
dengan tanda tanya, dan bita yang sudah diganti tidak dapat dikembalikan. Yang
sampai ke pemutar bukan video yang rusak sebagian, melainkan berkas yang tidak
lagi berbentuk video sama sekali. Panjang yang diteruskan pun ikut salah, sebab
panjang aslinya tidak lagi sama dengan panjang sesudah diubah.

**Ini merusak HLS di sepuluh platform sekaligus** — dan HLS dipakai hampir
semuanya.

Sekarang yang menentukan bukan panjangnya melainkan **awal berkasnya**: daftar
putar HLS selalu dibuka `#EXTM3U`, dan tidak ada potongan video yang kebetulan
dibuka begitu. Yang bukan daftar putar diteruskan sebagai bita, tidak disentuh.

### Sebab #2: yang meminta videonya mengaku sebagai okhttp

Penerus memakai `User-Agent: okhttp/4.12.0` untuk semua permintaan, termasuk
ke CDN video, dan tidak mengirim `Referer` sama sekali. Banyak CDN video
menjawab **403** untuk permintaan seperti itu.

Hulu sendiri memakai **dua** nama untuk dua tujuan yang berbeda — okhttp untuk
API-nya, nama peramban untuk videonya — dan mengirim `Referer` berisi asal
tautannya sendiri. Sekarang begitu juga. `Origin` tetap tidak dikirim: justru
asal kita yang ditolak CDN.

### Sebab #3: tautan NetShort tidak pernah terbaca

NetShort menamai tautan episodenya `playVoucher`, cadangannya `playVoucherBak`.
Nama itu tidak menyebut video sama sekali, dan tidak tercatat di pembaca — jadi
**setiap** episode NetShort terbaca sebagai episode tanpa tautan. Daftar
judulnya tampil rapi; videonya tidak pernah ada.

Hal yang sama, lebih halus, pada dua platform lain:

| Platform | Yang hilang | Akibatnya |
| --- | --- | --- |
| NetShort | `playVoucher`, `playVoucherBak` | seluruh episode tanpa tautan |
| Melolo | `main_url_decoded` | yang dipakai alamat yang belum dipulihkan |
| GoodShort | `downloadList` | judulnya tidak punya satu episode pun |

### Sebab #4: DramaBox dan GoodShort dibuka tanpa disiapkan

`videoPath` DramaBox dan `filePath` GoodShort **selalu** harus disiapkan API
hulu lebih dulu. Kode lama memutuskannya dari bentuk nilainya: kalau sudah
tampak seperti alamat, buka langsung. Bentuknya menipu — keduanya kadang datang
sebagai alamat utuh yang kelihatan wajar, dan keduanya menjawab 403 ketika
benar-benar dibuka.

Sekarang keputusannya **dari tabel**, bukan dari bentuk nilainya:

```ts
{ id: "dramabox",  jalurAliran: "/dramabox/decrypt-video",  kunciLewatHulu: ["videoPath"] }
{ id: "goodshort", jalurAliran: "/goodshort/decrypt-stream", kunciLewatHulu: ["filePath"] }
```

Pembaca jawaban tetap tidak mengenal satu pun nama platform: yang diterimanya
sepotong data dari tabel. Platform kesebelas tetap cukup ditambahkan di tabel.

### Sebab #5: satu potongan tersendat = tautan dibuang

Pemutar langsung pindah ke tautan cadangan pada galat HLS *fatal* yang pertama.
Sebagian besar galat itu sifatnya sesaat — satu potongan gagal diunduh,
penyangga tersendat — dan `hls.js` dapat pulih sendiri bila diminta.

Yang lama membuang tautan yang sebenarnya masih baik, lalu kehabisan tautan,
lalu menampilkan pesan gagal untuk gangguan yang sudah lewat. Urutannya
sekarang: **pulihkan dulu** (`startLoad()` untuk jaringan, `recoverMediaError()`
untuk media, sampai tiga kali), **pindah tautan** berikutnya, **menyerah**
paling akhir — dan pada akhirnya ada tombol **Coba lagi**.

### Sebab #6: gangguan sesaat di hulu langsung jadi layar kosong

API hulu sesekali menjawab 5xx atau memutus sambungan pada permintaan pertama,
lalu menjawab wajar sedetik kemudian. Keduanya — rute daftar dan penerus aliran
— kini **mengulang sekali**, hanya untuk kegagalan yang memang sesaat. 404
tetap 404: menanyakan judul yang tidak ada dua kali tetap tidak ada.

### Satu lagi: batas waktu yang memutus tontonan

Penerus memasang batas 45 detik pada **seluruh** pengunduhan. Berkas mp4 yang
besar di jaringan pelan terputus di tengah menonton, dan yang terlihat bukan
pesan galat melainkan video yang berhenti sendiri. Sekarang batasnya hanya
untuk **kepala** jawaban (20 detik); sesudah kepalanya tiba, isinya mengalir
selama apa pun.

---

## Bagian 2 — ShortMax: yang dulu tidak disalin, kini disalin

v40 sengaja tidak menyalin pembuka wadah potongan ShortMax, dan mengatakannya
apa adanya di layar. Atas permintaan, bagian itu **kini disertakan**, sehingga
ShortMax ikut dapat diputar dan tidak ada lagi platform yang setengah jalan.

Yang perlu dicatat supaya jelas apa yang sebenarnya dikerjakan: **tidak ada
pengaman yang dilewati.** Kuncinya ikut di dalam berkas yang sama, pada posisi
yang ditunjuk kepalanya sendiri, dan servernya mengirimkan berkas itu kepada
siapa pun yang memintanya tanpa menanyakan apa pun. Yang dikerjakan membaca
format — sebagaimana membaca kepala berkas `.mp4`.

Bentuk berkasnya, menurut kepalanya sendiri:

```
0..8       nama wadahnya, "shortmax"
16..20     posisi kuncinya, ditulis sebagai angka dalam huruf
24..1024   daerah tempat kunci 16 bita itu berada
1024..1040 enam belas bita yang ikut dipulihkan bersama isinya
1040..     isinya
```

**Satu perbedaan dari hulu, dan ini yang membuatnya bekerja lebih sering.**
Hulu memulihkan isinya dengan pelucutan ganjal (*padding*) dinyalakan. Isi ini
tidak berganjal, jadi pemeriksaannya hampir selalu gagal, pustakanya melempar,
dan hulu menangkapnya lalu memulangkan isi yang kepalanya sekadar dipotong.

Di sini ganjalnya dimatikan — sehingga pemulihannya benar-benar dicoba — lalu
**hasilnya diperiksa**: yang dipulangkan yang bita pertamanya benar-benar
penanda potongan video (`0x47`). Bila tidak, yang dipulangkan isi dengan kepala
dipotong saja, persis seperti hulu.

`uji-drama.ts` menyusun sebuah wadah lengkap dengan kuncinya sendiri, lalu
membuktikan isinya pulih bita per bita — pemeriksaan yang tidak akan lulus pada
cara hulu.

---

## Bagian 3 — Gulir tak berhingga

### Yang tampak di layar

Baris terakhir tiap platform — **"Buat Kamu"** — bertambah sendiri saat
digulir. Di bawahnya, berurutan sesuai keadaannya:

| Keadaan | Yang digambar |
| --- | --- |
| sedang menarik potongan | pemutar berputar + **"Memuat lebih banyak…"** |
| masih ada, belum ditarik | pemicu tak terlihat + tombol "Muat lebih banyak" |
| sudah habis | garis pemisah + **"Semua data telah dimuat"** |
| gagal | pesannya + tombol "Coba lagi" |

Pemicunya menyala **setengah layar sebelum** dasar daftarnya terlihat, jadi
potongan berikutnya sudah dalam perjalanan sebelum pengunjung sampai ke bawah.

### Kenapa hanya SATU baris yang bergulir sendiri

Dua baris yang sama-sama menarik sendiri berarti baris pertama tumbuh tanpa
henti dan baris kedua tidak pernah tercapai — pengunjung menggulir selamanya di
dalam satu baris. Karena itu yang bergulir hanya baris **terakhir**, dan hanya
bila platformnya memang melayani potongan berikutnya. Itu pula susunan hulu:
satu-satunya bagian bergulir ada di dasar halaman, bagian di atasnya sekali
ambil habis.

### Penomoran: tiga cara, satu fungsi

Hulu memakai tiga cara menandai potongan berikutnya, dan ketiganya berbeda:

| Platform | Caranya | Batas potongan |
| --- | --- | --- |
| PineDrama | kursor yang dikirim balik apa adanya | 10 |
| DramaBox, ReelShort, ShortMax, NetShort | nomor halaman | 100 |
| GoodShort, FlickReels | nomor halaman | 50 |
| Melolo | geseran, melompat 20 | 6 |
| FreeReels | geseran, melompat 20 | 5 |

Angka batasnya bukan tebakan — disalin dari `MAX_FORYOU_PAGES` dan
`allPages.length >= n` milik hulu. Tanpa batas itu, gulir tak berhingga terus
meminta halaman yang sudah lama menjawab isi yang sama.

Semuanya dilayani **satu** fungsi, `gulirBerikut()`, dan layar tidak perlu tahu
bahwa Melolo menghitung geseran sementara DramaBox menghitung halaman.

### Kapan daftarnya dinyatakan habis

Tiga hal menghentikannya, dan ketiganya perlu:

1. **Hulu bilang habis.** Dan hulu mengatakannya dengan lima nama yang berbeda
   di tiga tempat yang berbeda: `has_more` di akar (PineDrama), `has_more` di
   `data.page_info` (FreeReels), `isEnd` (ShortMax, FlickReels), `completed`
   (NetShort), atau `current >= pages` tanpa `has_more` sama sekali (GoodShort).
   Membaca akar saja berarti dua dari tiga platform itu selalu terbaca "masih
   ada" — dan gulirnya tidak pernah berhenti sendiri.
2. **Batas potongan tercapai** (tabel di atas).
3. **Potongan yang tidak menambah satu judul pun.** Hulu sudah mengulang isi
   yang sama; tanpa pemeriksaan ini gulirnya benar-benar tak berhingga —
   pemicunya tetap terlihat, potongannya terus diminta, layarnya tidak pernah
   bertambah.

### Pencarian ikut bergulir

Di platform yang pencariannya berhalaman — ReelShort dan DramaNova — hasil
pencarian ikut bertambah sendiri. Yang tidak berhalaman tetap menampilkan
hasilnya utuh; pemicunya cukup tidak digambar.

---

## Yang berubah di dalam kode

| Berkas | Perubahannya |
| --- | --- |
| `src/lib/drama.ts` | penomoran bawa `batas` dan `langkah`; `kunciLewatHulu` dan `bungkusSegmen` per platform; fungsi baru `gulirBerikut()` |
| `src/lib/drama-baca.ts` | `playVoucher`/`playVoucherBak`/`main_url_decoded`/`downloadList`; H264 didahulukan; mutu dari nama kunci; `bacaHalaman()` |
| `src/lib/drama-aliran.ts` | `tampakDaftarPutar()` — memeriksa awal berkas, bukan panjangnya |
| `src/lib/drama-wadah.ts` | **baru** — pembuka wadah potongan ShortMax |
| `src/app/api/drama/aliran/route.ts` | tidak lagi merusak potongan; UA peramban + Referer; batas waktu hanya untuk kepala; satu ulangan |
| `src/app/api/drama/[platform]/[aksi]/route.ts` | satu ulangan ke hulu; `habis` ikut dipulangkan |
| `src/app/drama/drama-app.tsx` | gulir tak berhingga; daftar dan pencarian jadi komponen berkunci |
| `src/app/drama/pemutar.tsx` | pulihkan galat HLS sebelum pindah tautan; tombol coba lagi |
| `src/app/globals.css` | tampilan pemuat, pemicu, dan ujung daftar |
| `uji-drama.ts` | 188 → **241** pemeriksaan |

### Satu hal yang ikut dirapikan

Daftar judul dan hasil pencarian kini komponen sendiri, dipasang dengan kunci
berisi nama platform (dan kata pencariannya). Berpindah platform memasang
daftar yang benar-benar baru, bukan daftar lama yang disetel ulang dengan
tangan — dan daftar yang disetel ulang dengan tangan selalu menyisakan satu
keadaan yang terlupa. Yang terlupa di sini penanda halaman platform sebelumnya,
yang dipakai meminta potongan platform berikutnya.

---

## Menjalankan ujinya

```bash
npx tsx uji-drama.ts        # 241 lulus
npx tsx uji-situs-cbt.ts    # 56 lulus — aturan CBT tidak ikut bergeser
npx tsx cek-sekaidrama.ts   # selaras dengan hulu 0481a1c
npm run build
```

Seluruh 241 pemeriksaan berjalan tanpa menyalakan server dan tanpa memanggil
API hulu satu kali pun. Itu syarat, bukan kebetulan: API hulu milik orang lain
dan dapat mati kapan saja, dan uji yang ikut mati bersamanya berhenti dipercaya
orang.

---

## Yang tetap seperti sebelumnya

- **Gerbang Cakrawala** di depan kedua rute API. Tidak dilonggarkan sedikit pun.
- **Pembatas laju**: 120 permintaan daftar per menit, 900 untuk potongan video.
- **`tautanAman()`** menolak `localhost`, jaringan dalam, alamat metadata awan,
  skema selain http/https, nama tanpa titik, dan alamat bersandi.
- **Tidak satu pun berkas video disimpan.** Tidak ada riwayat tontonan.
- **Halaman tidak diindeks.**
- **DramaNova tetap mati**, persis seperti di hulu.
