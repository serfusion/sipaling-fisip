# v51: Menu Alat, tab Theater Drama, dan drama yang kembali dapat ditonton

Dua hal di rilis ini.

1. **Menu baru: Alat.** Tombolnya di portal, tepat di sebelah **Cakrawala**.
   Isinya tab per alat, dan tab pertamanya **Theater Drama**.
2. **Drama diperiksa ujung-ke-ujung, dan ternyata sebagian besar rusak.**
   Enam dari sembilan sumber menampilkan daftar kosong, ReelShort dan Melolo
   tidak dapat diputar sama sekali. Semuanya diperbaiki di sini, dan
   perbaikannya berlaku untuk **kedua** pintu: Theater Drama di menu Alat,
   dan Nonton Drama di Cakrawala / sipalingfisip.online.

Tidak ada perubahan basis data, tidak ada berkas SQL baru, tidak ada
environment variable baru, dan tidak ada pengaturan Vercel yang perlu
disentuh.

---

## 1. Menu Alat

| | |
| --- | --- |
| Tombol | **Alat**, di baris tombol hero portal, sesudah Cakrawala |
| Alamat | `/perkakas` → langsung membuka tab pertama |
| Tab pertama | **Theater Drama** — `/perkakas/drama` |
| Siapa yang dapat menonton | pemegang kode Cakrawala, sama seperti Nonton Drama |

Alamatnya `/perkakas`, bukan `/alat`, karena `/alat` sudah lama menjadi
alamat Cakrawala dan dipakai di banyak tempat (tautan "Lihat Cakrawala",
pengalihan dari domain drama, dan sebagainya).

### Menambah alat berikutnya

Satu baris di `src/app/perkakas/daftar-alat.ts`, satu folder halaman di
sebelahnya:

```ts
export const DAFTAR_ALAT: Alat[] = [
  { id: "drama", href: "/perkakas/drama", label: "Theater Drama", ... },
  { id: "contoh", href: "/perkakas/contoh", label: "Alat Baru", sub: "…", ikon: IKON.… },
];
```

```
src/app/perkakas/contoh/page.tsx
```

Baris tab, tab yang menyala, dan alamat `/perkakas` mengikuti sendiri. Tiap
alat sengaja halaman sendiri, bukan tab yang digambar bergantian di satu
halaman: gerbang aksesnya di server, judul halamannya, dan bundel
JavaScript-nya terpisah — pemutar video Theater Drama tidak ikut dimuat oleh
orang yang membuka alat lain.

---

## 2. Theater Drama: disalin, bukan dipindah

Nonton Drama di menu Cakrawala dan di **sipalingfisip.online tetap ada**,
tidak diubah. Theater Drama adalah pintu kedua ke layar yang **sama**:
`src/app/perkakas/drama/page.tsx` memasang `DramaApp` dan `KunciDrama` dari
`src/app/drama/`, bukan salinan seribu baris yang harus dirawat dua kali.
Yang berbeda hanya namanya di kepala layar (prop `merek`) dan layar kuncinya
yang tidak menggambar kepala dan kaki sendiri (prop `dalamAlat`).

**Yang membuatnya lebih mudah ditonton:** Theater Drama tinggal di domain
portal, domain yang sama dengan Cakrawala. Cookie pembukanya pun sama.
Siapa pun yang sudah membuka Cakrawala di perangkatnya **langsung menonton
tanpa mengetik kode lagi**, dan tab ini tidak bergantung pada domain drama
terpasang di Vercel. Bila kodenya diketik di tab ini, Cakrawala ikut terbuka.

`/perkakas/drama` tidak tertangkap aturan pengalihan domain drama (uji
"TAB THEATER DRAMA DI MENU ALAT" di `uji-drama.ts`). Di domain drama dan di
subdomain CBT, alamat itu diantar ke portal.

---

## 3. Hasil pemeriksaan tontonan: sebelum perbaikan

Tiap sumber diperiksa seperti yang dilakukan pengunjung: buka daftar →
pilih judul → buka rincian → minta episode 1 → putar videonya lewat penerus
`/api/drama/aliran`, lalu bita videonya diperiksa dengan `ffprobe`.

| Sumber | Sebelum v51 | Penyebab |
| --- | --- | --- |
| PineDrama | jalan | — |
| DramaBox | jalan | — |
| ShortMax | jalan | — |
| GoodShort | **daftar kosong** | beranda berkelompok (records → items) |
| NetShort | **daftar kosong**, kartu tanpa sampul | beranda berkelompok; `shortPlayCover` tidak dikenal |
| Melolo | **daftar kosong**; episode berisi nama aktor | beranda berkelompok; `thumb_url`, `video_list`, `vid`, `vid_index` tidak dikenal |
| ReelShort | **daftar kosong**; **pemutar tidak pernah muncul** | beranda berkelompok; `book_title` tidak dikenal; tiga mutu terbaca sebagai tiga episode |
| FreeReels | **beranda kosong** | beranda berkelompok (items → items) |
| FlickReels | **beranda kosong** | beranda berkelompok (data → list) |

Dari 27 jawaban daftar dan pencarian yang diambil dari hulu, **13 terbaca
kosong**.

---

## 4. Yang diperbaiki

### 4.1 Daftar judul berkelompok — `src/lib/drama-baca.ts`

Hampir semua beranda hulu kini berkelompok: larik kelompok, tiap kelompok
membawa larik judulnya sendiri. Pembaca lama berhenti pada larik **pertama**
yang ditemukannya — larik kelompoknya — dan kelompok bukan judul.

Sekarang `bacaDaftar` menyapu jawaban selapis demi selapis dan memungut
**setiap objek yang berupa kartu** dari kelompok mana pun (`kumpulkanKartu`).
Dua pagar supaya yang terpungut memang judul:

- kartu **wajib bersampul** — label `{id, name}` dan penanda halaman juga
  punya id dan nama, dan sampullah yang membedakannya;
- isi sebuah kartu tidak ditelusuri lagi — episode di dalam judul bukan
  judul tersendiri.

Cara lama tetap dipakai sebagai cadangan untuk jawaban yang judulnya memang
tidak bersampul. Pada platform yang sudah jalan, hasilnya sama — atau
bertambah dari bagian beranda lain yang dulu terlewat (diperiksa satu per
satu: semuanya judul sungguhan).

### 4.2 Nama kolom baru

| Arti | Nama yang ditambahkan |
| --- | --- |
| Judul | `book_title` (ReelShort), `series_title` (Melolo) |
| Sampul | `shortPlayCover` (NetShort), `thumb_url`, `first_chapter_cover`, `series_cover` (Melolo) |
| Jumlah episode | `serial_count`, `episode_cnt` (Melolo), `upload_num` (FlickReels) |
| Ringkasan | `abstract`, `series_intro` (Melolo), `special_desc` (ReelShort), `introduce` (FlickReels), `shotIntroduce` (NetShort) |
| Label | `labelArray`, `labelNames`, `shortPlayLabels` (NetShort), `series_tag` (FreeReels), `playlet_tag_name` (FlickReels) |
| Daftar episode | `video_list` (Melolo) |
| Id / nomor episode | `vid`, `vid_index` (Melolo) |

Semuanya ditaruh di **belakang** daftar masing-masing, supaya nama yang
sudah dipakai platform lain tetap menang.

Tiga perapian kecil ikut:

- **Sampul HEIC Melolo** hanya tampil di Safari. Yang HEIC dibelokkan lewat
  `wsrv.nl` (pengubah gambar terbuka yang juga dipakai situs hulu untuk
  semua sampulnya) dan pulang sebagai WebP. Sampul lain tidak disentuh, dan
  tautan video tidak pernah lewat sana.
- **Judul hasil pencarian NetShort** membawa `<em>…</em>`; tanda HTML-nya
  dibuang.
- **Label yang dikirim sebagai teks** (JSON di dalam teks, atau daftar
  berkoma) diurai menjadi label satu per satu.

### 4.3 ReelShort: pemutar yang tidak pernah muncul — `route.ts`

ReelShort menjawab permintaan **satu** episode dengan `videoList` berisi tiga
mutu. Jalur episode memutuskan "daftar episode atau satu episode" dari
banyaknya larik, sehingga ketiga mutu itu dikirim sebagai `daftarEpisode` —
padahal layar menunggu `episode`. Hasilnya: tombol episode ditekan, lalu
tidak terjadi apa-apa.

Sekarang yang memutuskan **tabel platformnya** (`caraEpisode`): hanya
platform bercara `"semua"` yang menerima `daftarEpisode`. Untuk yang lain,
bila hulu ikut mengirim episode tetangga, yang diambil yang nomor **dan**
id-nya cocok; deretan tanpa id adalah pilihan mutu satu episode, dan seluruh
tautannya dikumpulkan.

### 4.4 Sandi video: H264 lebih dulu, termasuk di Melolo

Melolo menyebut H265 sebagai `bytevc1`, yang tidak dikenali, sehingga tautan
H265-nya tidak ditaruh di belakang dan dicoba lebih dulu di peramban yang
tidak dapat memutarnya. Nama `bytevc1`, `hvc1`, `hev1`, `x265` kini dibaca
sebagai H265, dan `avc1`, `x264` sebagai H264. Label mutu yang kembar
digabung supaya tombol "720p" tetap bertanda "H265".

### 4.5 hls.js lebih dulu

Pemutar dulu memakai pemutar HLS bawaan peramban bila peramban mengaku dapat
memutar HLS sendiri. Itu benar selama hanya Safari yang mengaku begitu.
**Chrome versi baru kini ikut menjawab "maybe"**, sehingga seluruh
pengunjung Chrome diam-diam berpindah ke pemutar bawaannya yang masih muda:
tanpa pemulihan galat hls.js, dan tanpa dukungan matang untuk jalur audio
terpisah yang dipakai FreeReels. Sekarang hls.js dipakai di mana pun
MediaSource tersedia — urutan yang sama dengan situs hulu — dan pemutar
bawaan hanya untuk iPhone.

### 4.6 Penyelarasan dengan hulu

`npx tsx cek-sekaidrama.ts` menemukan hulu sudah bergerak dari `0481a1c` ke
`131356e`, dengan dua alamat berganti. Keduanya disesuaikan di
`src/lib/drama.ts`:

| | Lama | Baru |
| --- | --- | --- |
| Rincian ReelShort | `/reelshort/detail` | `/reelshort/get-detail` |
| Terbaru Melolo | `/melolo/latest` | `/melolo/get-latest` |

---

## 5. Hasil pemeriksaan tontonan: sesudah perbaikan

**Daftar dan pencarian:** ke-27 jawaban yang sama, dibaca ulang dengan
pembaca baru — **seluruhnya terbaca** (sebelumnya 13 kosong), tiap kartu
bersampul. Dua sisanya bukan JSON sama sekali pada saat diambil ("Terbaru"
DramaBox kosong, "Terbaru" Melolo halaman galat dari hulu).

**Tontonan, lewat penerus dan diperiksa `ffprobe`** (episode 1 dari judul
teratas tiap sumber, 2026-10-24):

| Sumber | Hasil | Yang terputar |
| --- | --- | --- |
| PineDrama | 3/3 | mp4 H264 540p–576p |
| ShortMax | 3/3 | HLS H264 720p (wadah ShortMax dibuka penerus) |
| ReelShort | 2/2 | HLS H264 540p |
| GoodShort | 2/2 | HLS H264 720p |
| FlickReels | 2/2 | HLS H264 1080p |
| NetShort | 2/2 | mp4 **H265** 720p — lihat bagian 6 |
| DramaBox | 1 judul jalan | mp4 H264 1080p; judul lain terhenti karena hulu tumbang |
| Melolo | belum sempat | daftar, rincian (71 episode berid), dan tautan videonya sudah terbaca benar; hulu tumbang sebelum videonya diputar |
| FreeReels | belum sempat | daftar putar fMP4 + jalur audio terpisah sudah lewat penerus dengan benar (`#EXT-X-MAP` dan `#EXT-X-MEDIA` ikut ditulis ulang); hulu tumbang sebelum diputar ujung-ke-ujung |

Uji di peramban sungguhan (Chromium, yang memutar H264 tetapi **tidak**
H265 — keadaan terburuk seperti Chrome di PC Windows) dijalankan begitu API
hulu kembali menjawab.

---

## 6. Yang perlu diketahui, apa adanya

- **API hulu sering tumbang, dan itu bukan kode kita.** Selama pemeriksaan
  ini, `api.sansekai.my.id` menjawab **502 dari Cloudflare untuk semua
  platform** selama puluhan menit. Di layar, itu terbaca sebagai "Sumber
  dramanya sedang tidak menjawab" dengan tombol **Coba lagi**. Simpanan
  jawaban (v42) menutup gangguan pendek bagi judul yang baru saja dibuka
  orang; gangguan panjang tetap terasa.
- **NetShort hanya mengirim video H265.** Ponsel Android, iPhone, dan Mac
  umumnya memutarnya; Chrome di PC Windows tanpa dekoder H265 perangkat keras
  tidak. Tidak ada tautan H264 dari hulunya untuk dipilih.
- **Melolo hanya punya H264 di 240p.** Itu yang diputar lebih dulu supaya
  pasti jalan; tombol mutu 720p/540p (H265) tetap tersedia untuk perangkat
  yang mendukungnya.
- **Sampul Melolo lewat wsrv.nl.** Yang terkirim ke sana hanya alamat
  gambar sampulnya.

---

## 7. Berkas yang berubah

| Berkas | Perubahan |
| --- | --- |
| `src/app/perkakas/daftar-alat.ts` | **Baru.** Daftar alat — satu baris per alat |
| `src/app/perkakas/layout.tsx` | **Baru.** Kepala menu Alat dan baris tab |
| `src/app/perkakas/tab-alat.tsx` | **Baru.** Baris tab; yang menyala dibaca dari alamat |
| `src/app/perkakas/page.tsx` | **Baru.** `/perkakas` → alat pertama |
| `src/app/perkakas/drama/page.tsx` | **Baru.** Theater Drama: gerbang + layar drama yang sama |
| `src/app/sipaling-app.tsx` | Tombol **Alat** di sebelah Cakrawala |
| `src/app/drama/drama-app.tsx` | Prop `merek` (nama di kepala layar) |
| `src/app/drama/kunci.tsx` | Prop `dalamAlat`; sesudah membuka, halaman ini sendiri yang dimuat ulang |
| `src/app/drama/pemutar.tsx` | hls.js lebih dulu bila MediaSource tersedia |
| `src/app/api/drama/[platform]/[aksi]/route.ts` | Episode tunggal vs daftar episode menurut `caraEpisode` |
| `src/lib/drama-baca.ts` | Pembaca beranda berkelompok, nama kolom baru, HEIC, sandi video |
| `src/lib/drama.ts` | Dua alamat hulu baru; acuan hulu `131356e` |
| `src/app/globals.css` | Gaya menu Alat (`.pk-*`); judul layar kunci |
| `uji-drama.ts` | 272 → **298** pemeriksaan |

## 8. Cara memeriksa

```
npx tsx uji-drama.ts        # 298 lulus
npx tsx uji-situs-cbt.ts    # 56 lulus — aturan CBT tidak ikut bergeser
npx tsx cek-sekaidrama.ts   # selaras dengan hulu 131356e
```

Lalu di portal: tekan **Alat** → tab **Theater Drama** → pilih sumber →
pilih judul → pilih episode.
