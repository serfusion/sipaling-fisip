# v40: Nonton Drama — menu baru di Cakrawala, situs baru di sipalingfisip.online

Menu bonus ketiga untuk pemegang kode Cakrawala: **Nonton Drama**. Drama pendek
dari sembilan sumber sekaligus, dibuka dengan **kode Cakrawala yang sama**, dan
tinggal di **domainnya sendiri**.

Tidak ada perubahan basis data. Tidak ada berkas SQL baru. Yang perlu dikerjakan
di luar deploy hanya satu: memasang domain `sipalingfisip.online` pada proyek
Vercel yang sama (lihat *Yang perlu dipastikan di Vercel* di bawah).

---

## Ringkasnya

| | |
| --- | --- |
| Alamatnya | `sipalingfisip.online` |
| Yang membukanya | kode Cakrawala yang sudah dipegang, diketik sekali di sana |
| Biayanya bagi pelanggan | tidak ada; ikut langganan yang sedang berjalan |
| Masa langganan | **tidak** terpotong saat kodenya dipakai di sana |
| Sumber isinya | API terbuka proyek [SekaiDrama](https://github.com/Sansekai/SekaiDrama) (MIT) |
| Berkas video yang kita simpan | tidak ada satu pun |
| Penyelarasan dengan hulu | tiga hari sekali, lihat bagian terakhir |

---

## Kenapa situsnya terpisah

Tiga alasan, dan ketiganya praktis.

**Pertama, isinya beda jenis.** Cakrawala dibuka mahasiswa di ruang baca, di
perpustakaan, kadang di layar yang ikut terlihat orang lain — dan ia halaman
tugas akhir. Deretan sampul drama di dalam halaman yang sama mengubah apa yang
tampak sedang dikerjakan pemiliknya. Dua situs berarti keduanya tidak pernah
muncul dalam satu tangkapan layar.

**Kedua, portal tidak ikut menanggung beratnya.** Pemutar HLS (`hls.js`) hanya
dimuat oleh yang benar-benar menonton, lewat impor dinamis — bukan oleh setiap
mahasiswa yang membuka halaman pengajuan judul.

**Ketiga, satu penyebaran tetap cukup.** Ini pola yang sama dengan CBT di
v28: satu proyek Vercel, satu basis data, dan `src/middleware.ts` yang
membaca tuan rumah pada tiap permintaan lalu mengantarnya ke tempat yang benar.

```
sipalingfisip.online/          → ditulis ulang ke /drama   (alamat tetap .online)
sipalingfisip.online/drama     → dirapikan ke /            (alamat kembar)
sipalingfisip.online/login     → dialihkan ke portal
sipalingfisip.online/alat      → dialihkan ke portal

www.sipalingfisip.web.id/drama → dialihkan ke sipalingfisip.online/
cbt.sipalingfisip.web.id/drama → dialihkan ke sipalingfisip.online/
```

Yang **tidak** disentuh: `/api`, bundel Next.js, dan berkas statis. Ketiganya
dipakai bersama ketiga situs, dan layar drama memanggil `/api/drama/...` dengan
alamat relatif — jadi permintaannya tetap satu asal dengan halamannya, dan
perlindungan CSRF portal tetap berlaku tanpa perlu dilonggarkan.

Di `localhost` dan pratayang `*.vercel.app` **tidak ada pengalihan sama sekali**:
di sana menunya tetap dilayani di `/drama`, sebab mengalihkan ke domain yang
belum terpasang sama saja dengan mematikannya bagi yang sedang mengembangkan.

---

## Kenapa kodenya diketik sekali lagi di sana

Karena `sipalingfisip.online` domain yang lain, dan **peramban tidak pernah
mengirim cookie satu domain ke domain lain**. Itu aturan peramban, bukan
keputusan kita.

Yang penting: **mengetiknya lagi tidak memotong apa pun.**
`/api/cakrawala-access` mengenali nomor WhatsApp yang sudah pernah menukarkan
kode itu, lalu sekadar memulangkan sesinya — tanpa menambah hari, tanpa
memotong kuota pemakaian kode. Jalur itu memang sudah bekerja begitu sejak v16;
menu ini tinggal memakainya.

Karena itu layar kuncinya meminta **kode + nomor WhatsApp**, sama persis dengan
layar kunci Cakrawala. Nomor itulah yang menyimpan langganannya.

> Mengakalinya dengan token yang dioper lewat alamat memang mungkin, dan sengaja
> tidak dilakukan: token akses yang berjalan di bilah alamat adalah token yang
> tersalin ke grup WhatsApp.

---

## Dari mana isinya

Dari API terbuka proyek **SekaiDrama** (`api.sansekai.my.id`), yang juga dipakai
situs aslinya. Kita **tidak** mengambil sendiri dari aplikasi platform mana pun,
dan **tidak** menyimpan satu berkas video pun.

Sembilan sumber yang hidup: PineDrama, DramaBox, ReelShort, ShortMax, GoodShort,
NetShort, Melolo, FreeReels, FlickReels. Kesembilannya dapat diputar sejak v41.
DramaNova tetap tertulis di tabel dalam keadaan mati — persis seperti di hulu, yang mematikannya pada 12 September 2026
dengan catatan "api lagi error".

### Yang disalin, dan yang tidak

| Dari hulu | Di sini |
| --- | --- |
| 80 berkas rute API, satu per platform per aksi | **satu** rute: `/api/drama/[platform]/[aksi]` |
| 10 tipe TypeScript + 10 komponen beranda | **satu** pembaca jawaban: `src/lib/drama-baca.ts` |
| 30 halaman layar (beranda/detail/tonton per platform) | **satu** layar: `src/app/drama/drama-app.tsx` |
| Pembongkar wadah potongan video ShortMax | **disalin sejak v41** — lihat di bawah |
| Pengaburan jawaban API dengan AES (`crypto-js`) | tidak disalin; gerbang Cakrawala yang menjaganya |
| Logo platform sebagai berkas gambar | tidak disalin; dipakai lencana dua huruf |

**Wadah potongan ShortMax — diperbarui di v41.** Potongan video ShortMax datang
dalam wadah khusus buatan aplikasinya: 1040 bita kepala, lalu isinya. Pemutar
mana pun menolak berkas itu, sebab bukan potongan video yang dikenalinya.

Di v40 bagian itu sengaja tidak disalin, dan layarnya mengatakan begitu apa
adanya. **Sejak v41 bagian itu disertakan**, sehingga ShortMax ikut dapat
diputar — lihat `UPDATE-V41-DRAMA-GULIR-DAN-PEMUTARAN.md` dan
`src/lib/drama-wadah.ts`.

Yang perlu dicatat supaya jelas apa yang dikerjakannya: **tidak ada pengaman
yang dilewati.** Kuncinya ikut di dalam berkas yang sama, pada posisi yang
ditunjuk kepalanya sendiri, dan servernya mengirimkan berkas itu kepada siapa
pun yang memintanya tanpa menanyakan apa pun. Yang dikerjakan membaca format,
sebagaimana membaca kepala berkas `.mp4`.

Selebihnya penerus aliran kita (`/api/drama/aliran`) melakukan penerusan biasa:
meneruskan apa yang dikirim sumbernya dan menuliskan ulang daftar putar HLS
supaya potongannya ikut lewat satu pintu.

---

## Berkas yang bekerja

| Berkas | Tugasnya |
| --- | --- |
| `src/lib/drama.ts` | **Satu-satunya** tempat yang tahu alamat dan parameter API hulu. Tabel, bukan percabangan. |
| `src/lib/drama-baca.ts` | Merapikan sepuluh bentuk jawaban menjadi satu bentuk. |
| `src/lib/drama-aliran.ts` | Memeriksa alamat video dan menuliskan ulang daftar putar HLS. |
| `src/lib/situs-drama.ts` | Aturan "host mana milik siapa" untuk domain drama. |
| `src/lib/situs.ts` | Menyusun urutan bertanya: drama dulu, baru CBT dan portal. |
| `src/middleware.ts` | Menerjemahkan rencana itu menjadi jawaban HTTP. |
| `src/app/api/drama/[platform]/[aksi]/route.ts` | Daftar, pencarian, rincian, episode — berpagar kode Cakrawala. |
| `src/app/api/drama/aliran/route.ts` | Penerus video dan daftar putar — berpagar yang sama. |
| `src/app/drama/page.tsx` | Gerbangnya, di server. |
| `src/app/drama/kunci.tsx` | Layar kunci: kode + nomor WhatsApp. |
| `src/app/drama/drama-app.tsx` | Layarnya: daftar, pencarian, rincian, menonton. |
| `src/lib/drama-wadah.ts` | Pembuka wadah potongan ShortMax (sejak v41). |
| `src/app/drama/pemutar.tsx` | Pemutar yang memulihkan galat HLS, lalu mencoba tautan cadangan, sebelum menyerah. |
| `src/app/alat/panel-drama.tsx` | Pintu masuknya di menu Cakrawala. |
| `uji-drama.ts` | 241 pemeriksaan atas seluruh aturan di atas. |
| `cek-sekaidrama.ts` | Penyelaras tiga harian dengan repositori hulu. |

Jalankan ujinya:

```bash
npx tsx uji-drama.ts
npx tsx uji-situs-cbt.ts   # membuktikan aturan CBT tidak ikut bergeser
```

---

## Keamanan yang dipasang

1. **Gerbang di server.** `/api/drama/*` — keduanya — memanggil
   `cakrawalaAccess()` sebelum apa pun yang lain. Tanpa ini situs kita berubah
   menjadi API drama umum yang tagihannya kita yang bayar.
2. **Pembatas laju.** 120 permintaan daftar per menit per perangkat; 900 untuk
   potongan video, karena satu menit menonton HLS memang berarti puluhan
   potongan.
3. **Penerus tidak menerima alamat apa pun.** `tautanAman()` menolak
   `localhost`, `127.0.0.1`, `10.x`, `172.16–31.x`, `192.168.x`, alamat metadata
   awan `169.254.169.254`, skema selain http/https, nama tanpa titik, dan alamat
   yang membawa nama pengguna/sandi. Yang tidak dijanjikan: nama domain yang
   sengaja diarahkan ke alamat dalam — menutupnya menuntut pemeriksaan pada
   tahap penyambungan, dan yang menahannya sekarang adalah gerbang di depannya.
4. **Halaman tidak diindeks.** `robots: { index: false }` — yang datang dari
   hasil pencarian hanya akan mendarat di layar kunci.

---

## Yang perlu dipastikan di Vercel

1. **Domain `sipalingfisip.online` dipasang pada proyek yang sama.** Bukan
   proyek baru: situsnya menumpang penyebaran yang sudah ada.

2. **Kalau nama domainnya ternyata berbeda** — misalnya yang terdaftar
   `www.sipalingfisip.online` — isikan:

   ```
   NEXT_PUBLIC_DRAMA_HOST = www.sipalingfisip.online
   ```

   Bentuk `www.*` maupun tanpa `www` sama-sama dikenali; pengaturan ini
   menentukan nama mana yang **ditulis** pada tautan keluar.

3. **Alamat API hulu dapat dipindah** bila suatu saat perlu:

   ```
   DRAMA_API_BASE = https://api.sansekai.my.id/api
   ```

   Tidak perlu diisi selama alamatnya belum berubah.

4. **Tidak perlu menyentuh `ALLOWED_ORIGINS`.** Layar drama memanggil API
   dengan alamat relatif, jadi asal permintaannya sama dengan halamannya.

---

## Penyelarasan tiga hari sekali

API hulu berubah sendiri, tanpa memberi tahu. Dalam riwayat SekaiDrama ada
platform yang hilang, kembali, lalu hilang lagi dalam hitungan pekan. Karena itu
penyelarasannya dijadwalkan, bukan diingat-ingat.

```bash
npx tsx cek-sekaidrama.ts
```

Yang dikerjakannya:

1. Membandingkan commit hulu hari ini dengan `SUMBER_HULU.commit` di
   `src/lib/drama.ts`, dan menyodorkan tautan `compare` bila berbeda.
2. Membaca `src/hooks/usePlatform.ts` di hulu, lalu membandingkan daftar
   platform yang hidup di sana dengan yang hidup di tabel kita — termasuk
   platform yang **baru** dan yang **baru dimatikan**.
3. Membuka **tiap** berkas rute hulu yang tabel kita menyalin darinya (52
   berkas), lalu membandingkan jalur dan nama parameternya baris per baris.

Kode keluarnya: `0` selaras, `2` ada perbedaan, `1` gagal memeriksa. Tidak
memerlukan token GitHub — yang dipakai `git ls-remote` dan
`raw.githubusercontent.com`.

Kalau ada perbedaan, yang biasanya perlu dikerjakan:

| Temuan | Tindakan |
| --- | --- |
| jalur/parameter berubah | sunting satu baris di tabel `PLATFORM` |
| platform baru di hulu | tambah satu entri di tabel yang sama |
| platform mati di hulu | setel `aktif: false` beserta alasannya |
| berkas rute hulu hilang | cari penggantinya, perbarui `berkas:` pada titik itu |

Sesudah menyesuaikan: perbarui `SUMBER_HULU.commit` dan `dibacaPada`, lalu
jalankan `npx tsx uji-drama.ts`.

---

## Yang sengaja dibiarkan apa adanya

**Mode maintenance portal tidak menutup situs drama.** Menu ini bonus hiburan
dan tidak menyentuh satu pun data akademik; menutupnya saat portal ditutup
untuk perawatan tidak menyelamatkan apa pun, dan hanya membuat pelanggan
mengira langganannya bermasalah.

**Riwayat tontonan tidak disimpan.** Tidak ada "lanjutkan menonton", dan itu
bukan kelalaian: menyimpannya berarti menyimpan catatan tontonan pribadi
pelanggan di basis data portal kampus. Yang tidak disimpan tidak dapat bocor.

**Episode berbayar tetap berbayar.** Yang tidak dikirim hulu tidak ada di sini,
dan layarnya mengatakan begitu apa adanya.
