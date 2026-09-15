# v42: Nonton Drama — berhenti ikut mati ketika sumbernya mati

Keluhannya:

> "Nonton Drama selalu *'Sumber dramanya sedang tidak menjawab. Coba lagi
> sebentar lagi'*, kadang tidak bisa dibuka, kadang tidak bisa menonton.
> Tolong perbaiki, atau tidak sudah ikuti saja GitHub-nya."

Dua hal dikerjakan, dan yang kedua ternyata bukan yang menyebabkannya.

Tidak ada perubahan basis data. Tidak ada berkas SQL baru. Tidak ada pengaturan
Vercel yang wajib disentuh — ada **satu yang opsional**, dijelaskan di bagian
terakhir.

---

## Lebih dulu: "sudah ikuti saja GitHub-nya" — sudah, dan memang sudah sama

Sebelum apa pun diubah, tabel sumber kita dibandingkan lagi dengan repositori
hulu hari ini, memakai berkas yang memang dibuat untuk itu:

```
npx tsx cek-sekaidrama.ts

== PENYELARASAN DENGAN Sansekai/SekaiDrama ==
   acuan kita : 0481a1c (dibaca 2026-09-13)
   hulu kini  : 0481a1c (sama)
   platform   : 9 hidup di hulu, 9 hidup di sini
   titik      : 52 diperiksa

Selaras. Tidak ada yang perlu disesuaikan.
```

**52 alamat dan nama parameter, sembilan platform, tidak satu pun berbeda.**
Alamat API-nya pun sama persis dengan yang dipakai hulu sendiri
(`https://api.sansekai.my.id/api`).

Jadi penyebabnya **bukan** kita tertinggal dari GitHub-nya. Menyalin ulang
kode hulu tidak akan mengubah apa pun, sebab yang mati bukan kodenya —
melainkan **mesin API-nya**, yang sama-sama dipakai SekaiDrama sendiri dan
tagihan bulanannya dibayar dari donasi (kalimat itu ada di popup donasi mereka).

> **Pertanyaannya jadi berubah.** Bukan lagi "bagaimana menyalin hulu lebih
> tepat", melainkan **"bagaimana menu ini tidak ikut mati setiap kali hulu
> tersendak semenit"**. Itulah yang dikerjakan rilis ini.

---

## Bagian 1 — Bug yang membuat tiga perbaikan lama tidak pernah sempat bekerja

Ini yang paling lama tidak terlihat, dan yang paling merugikan.

Kedua jalur API drama **tidak menyebutkan `maxDuration`.** Tanpa baris itu,
Vercel memakai bawaannya — sekitar **10–15 detik**, tergantung paket. Padahal
di dalam kode kita sendiri tertulis:

| Tempat | Batas waktu kita | Dikali ulangan | Total |
|---|---|---|---|
| Rute daftar/rincian | 15 detik | 2× | **sampai 30 detik** |
| Penerus video | 20 detik untuk kepalanya | 2× | **sampai 40 detik** |

Artinya, setiap kali hulu lambat:

1. Batas waktu kita sendiri **tidak pernah sempat menyala**.
2. Ulangannya **tidak pernah sempat dikerjakan** — padahal ulangan itulah yang
   ditulis khusus untuk menutup keluhan "kadang bisa, kadang tidak".
3. Yang sampai ke peramban **galat gerbang Vercel**, yang bukan JSON, sehingga
   layar pun tidak dapat menjelaskan apa yang terjadi.

Untuk penerus video akibatnya lebih halus dan lebih menyebalkan: hitungan
Vercel bukan sampai kepala jawaban tiba, melainkan **sampai seluruh isi selesai
mengalir**. Satu berkas mp4 pada sambungan ponsel yang pelan melewatinya dengan
mudah — lalu dipotong di tengah jalan. Yang dilihat penonton bukan pesan galat,
melainkan **video yang berhenti sendiri dan tidak mau berlanjut**.

Sekarang keduanya menyebutkannya:

```ts
export const maxDuration = 30;   // rute daftar & rincian
export const maxDuration = 300;  // penerus video
```

dan seluruh percobaan ke hulu dijaga anggaran waktu sendiri (`ANGGARAN_MS =
20_000`) supaya yang menghentikannya tetap kode kita — yang tahu cara
memulangkan simpanan — bukan gerbang yang tidak tahu apa-apa.

---

## Bagian 2 — Simpanan: gangguan semenit berhenti terbaca sebagai menu rusak

Sebelum ini, tiap detik hulu mati sampai utuh ke layar sebagai pesan galat.
Hulu yang mati sembilan puluh detik sehari terbaca sebagai **menu yang rusak
sepanjang hari**, sebab pengunjung yang kebetulan datang pada detik-detik itu
tidak punya alasan menyangka menunya baik-baik saja.

Sekarang jawaban hulu yang berhasil **diingat sebentar**, dan dipakai kembali
ketika hulu sedang tidak menjawab.

**Umurnya berbeda menurut apa yang disimpan**, dan ini bagian terpentingnya:

| Isi | Dipakai tanpa bertanya ke hulu | Masih dipakai bila hulu mati |
|---|---|---|
| Daftar judul & pencarian | 5 menit | 12 jam |
| Rincian judul | 10 menit | 6 jam |
| **Episode (tautan video)** | **1 menit** | **5 menit** |

Episode sengaja paling pendek. Tautan videonya **bertanda tangan dan
kedaluwarsa sendiri**; menyajikannya dari simpanan berjam-jam berarti menukar
satu pesan galat dengan sesuatu yang lebih membingungkan — video yang berputar
sebentar lalu berhenti.

Dua untung sekaligus dari simpanan segar: layar terbuka **seketika**, dan mesin
hulu yang dibayari donasi **tidak ditanyai hal yang sama berulang-ulang** oleh
pengunjung yang berpindah-pindah platform.

Yang jujur soal batasnya: ini memori proses, bukan penyimpanan bersama. Di
Vercel tiap instance punya memorinya sendiri dan dapat didaur ulang kapan saja
— persis seperti pembatas laju di `src/lib/rate-limit.ts`, dan dicatat dengan
kejujuran yang sama di berkasnya.

### Yang dilihat pengunjung

Isi dari simpanan **diberi tahu, bukan disembunyikan**:

> Sumber dramanya sedang tidak menjawab. Yang ditampilkan simpanan terakhir,
> diambil sekitar 7 menit lalu. **[Muat ulang]**

Daftar yang tertinggal beberapa judul tetap berguna. Yang tidak berguna adalah
pengunjung yang mengira daftarnya mutakhir padahal tidak.

---

## Bagian 3 — Ulangan yang benar-benar berbeda dari percobaan pertama

Ulangan yang lama menanyai hulu **pada milidetik yang sama**, ke alamat yang
sama. Hulu yang barusan menjawab 502 hampir selalu sedang kewalahan, jadi
permintaan susulan itu adalah permintaan yang paling mungkin ikut ditolak —
lalu gagal karena alasan yang persis sama.

Sekarang:

- **Tiga percobaan**, bukan dua.
- **Berjeda** 0,4 dan 1,2 detik (video: 0,5 dan 1,5 detik).
- **Berpindah alamat** bila ada cadangan (lihat Bagian 5).
- Masih tetap: 404 **tidak** diulang. Judul yang tidak ada tetap tidak ada
  walau ditanya tiga kali.

---

## Bagian 4 — Layar: jalan buntu yang tidak punya satu pun tombol

Tiga kebuntuan ditutup.

### "Coba lagi" untuk baris yang gagal dimuat

Baris yang gagal pada pemuatan **pertama** dulu adalah jalan buntu sungguhan:
tidak ada satu pun tombol yang dapat ditekan, dan satu-satunya jalan keluarnya
memuat ulang seluruh halaman. Padahal kegagalan yang paling sering terjadi di
sini justru yang paling sebentar umurnya. Sekarang ada tombolnya — begitu pula
untuk **rincian judul** dan **episode yang gagal disiapkan**.

Sebelum ini, satu-satunya cara mencoba ulang sebuah episode adalah menekan
nomor episode **lain** lalu kembali lagi — dan itu tidak pernah terpikir oleh
siapa pun.

### Pencarian yang gagal berhenti berbohong

Pencarian yang gagal karena hulu sedang mati dulu dipulangkan sebagai **daftar
kosong**, dan terbaca di layar sebagai:

> ~~Tidak ada judul yang cocok di platform ini.~~

Kalimat itu salah, dan salah dengan cara yang paling menyesatkan: pengunjung
menyimpulkan judul yang dicarinya memang tidak ada, lalu **berhenti mencari**.
Sekarang kegagalan tampil sebagai kegagalan, lengkap dengan tombol coba lagi.

### Pesannya menyebutkan apa yang dapat dilakukan

| Keadaan | Dulu | Sekarang |
|---|---|---|
| Hulu 5xx | "Sumber dramanya sedang tidak menjawab. Coba lagi sebentar lagi." | …ditambah **"atau pilih platform lain di atas."** |
| Hulu 404 | pesan yang **sama persis** | "Judul ini sudah tidak ada di *DramaBox*." |
| Hulu 429 | pesan yang sama persis | "Sumber dramanya sedang membatasi permintaan. Tunggu sebentar, lalu coba lagi." |

Yang 404 itu bukan detail kecil: dulu judul yang memang sudah dihapus dari
platformnya mengaku sebagai gangguan sesaat, sehingga pengunjung menunggu
sesuatu yang tidak akan pernah datang.

---

## Bagian 5 — Satu alamat hulu adalah satu titik yang mematikan seluruh menu

Ini yang **opsional**, dan yang paling berguna bila keluhannya kembali.

`DRAMA_API_BASE` kini boleh berisi **lebih dari satu alamat**, dipisah koma
atau spasi:

```
DRAMA_API_BASE="https://api.sansekai.my.id/api, https://cadanganku.contoh/api"
```

Percobaan berikutnya jatuh ke alamat **berikutnya**, bukan ke alamat yang
barusan gagal — mesin yang sedang mati tidak menjadi hidup karena ditanya dua
kali. Cadangannya berlaku untuk daftar, rincian, **dan** penyiapan tautan video
DramaBox/GoodShort, yang tanpa hulu tidak dapat diputar sama sekali walau berkas
videonya sendiri baik-baik saja.

Cadangannya boleh berupa **SekaiDrama yang dipasang sendiri** — repositorinya
terbuka (MIT), dan menyalakannya tidak menuntut satu baris kode pun diubah di
sini.

Yang disetel dipakai **apa adanya**: alamat bawaan tidak diam-diam ditambahkan
di belakangnya. Memindahkan alamat adalah keputusan, dan keputusan yang
diam-diam dibatalkan lebih buruk daripada yang gagal terang-terangan.

---

## Berkas yang berubah

| Berkas | Yang berubah |
|---|---|
| `src/lib/drama-simpanan.ts` | **baru** — simpanan jawaban hulu beserta aturan umurnya |
| `src/lib/drama.ts` | `DRAMA_API_BASE` boleh berdaftar; `alamatHuluSemua`, `alamatAliranHuluSemua` |
| `src/app/api/drama/[platform]/[aksi]/route.ts` | `maxDuration`, anggaran waktu, tiga percobaan berjeda, simpanan, pesan yang membedakan 404/429/5xx |
| `src/app/api/drama/aliran/route.ts` | `maxDuration`, tiga percobaan berjeda, cadangan hulu |
| `src/app/drama/drama-app.tsx` | tombol coba lagi (baris, rincian, episode), penanda simpanan, pencarian gagal ≠ hasil kosong |
| `uji-drama.ts` | 31 uji baru |

## Uji

```
npx tsx uji-drama.ts        → 272 lulus, 0 gagal   (sebelumnya 241)
npx tsx cek-sekaidrama.ts   → selaras dengan hulu
npx tsc --noEmit            → bersih
npx eslint .                → bersih
npx next build              → berhasil
```

## Yang jujur tidak dapat dijanjikan rilis ini

API hulu tetap milik orang lain. Bila mesinnya mati **berjam-jam**, simpanan
daftar judul (12 jam) masih menyelamatkan halaman depannya, tetapi **menonton
tetap tidak bisa** — tautan videonya berumur pendek dan memang harus diminta
baru. Yang berubah: gangguan sesaat tidak lagi terlihat seperti kerusakan, dan
gangguan yang sungguhan sekarang mengatakan dengan jelas apa yang terjadi dan
apa yang dapat dicoba.
