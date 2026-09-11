# v33: Transkrip — tata letak label sesuai gambar, konsentrasi terbaca sendiri, judul skripsi miring

## Yang salah

Empat keluhan Admin Akademik, semuanya pada Transkrip Nilai.

### 1. Label bertingkat di tempat yang salah

Pada transkrip KUI yang tercetak, bagian Inggris label **tidak selalu** turun
ke baris bawah. Yang pendek tetap sebaris dengan pasangan Indonesianya.
SiPaling memilihnya satu per satu di dalam JSX, dan **TERAKREDITASI** ikut
dipatahkan padahal acuannya sebaris:

```
yang tercetak SiPaling        acuan KUI
─────────────────────────     ──────────────────────────────────
TERAKREDITASI /               TERAKREDITASI / ACCREDITATION : UNGGUL
ACCREDITATION  : UNGGUL                                       LAMSPAK Nomor …
                 LAMSPAK …
```

Patahan yang salah menggeser nomor SK akreditasi satu baris ke bawah — tepat
di tempat yang paling sering dibaca pemeriksa ijazah.

Dan salahnya tidak dapat ditahan uji: pilihan antara `<Lbl>` dan `<BiIn>`
tersebar di dua puluh baris JSX, jadi satu baris yang keliru ikut tercetak
tanpa ada yang menangkapnya.

### 2. Peringkat akreditasi tidak ada di template unduhan

Template Excel yang diunduh admin memuat `"UNGGUL" LAMSPAK Nomor
099/AK.03.05/2026` — dengan tanda kutip, dan dengan nomor SK yang sudah tidak
berlaku. Setiap admin yang mengunduhnya menyalin isian yang kemudian harus
dibetulkan tangan, satu transkrip demi satu transkrip.

### 3. Konsentrasi: tidak ada pilihan, tidak terbaca sendiri

Kolom Konsentrasi hanya kotak ketik dengan `<datalist>`, dan daftarnya **baru
menyembul sesudah admin mengetik huruf pertama yang benar**. Yang tidak pernah
melihat daftarnya menyimpulkan tidak ada pilihan sama sekali, lalu mengetik
ejaan sendiri.

Lebih mahal lagi: base SIMAK mentah memuat PROGRAM STUDI tetapi **tidak memuat
KONSENTRASI**, sedangkan konsentrasi itulah yang memilih kamus nama Inggris.
Selama ia kosong, transkrip Broadcasting tercetak memakai kamus inti saja —
"Produksi Feature TV" jatuh ke tebakan kata per kata, bukan ke "TV Feature
Production".

Padahal daftar mata kuliahnya sudah mengatakannya. Tidak ada mahasiswa yang
mengambil ketiga konsentrasi sekaligus.

### 4. Istilah Inggris pada judul skripsi tercetak tegak

Kaidah penulisan ilmiah Indonesia: kata asing yang belum diserap ditulis
miring. Judul skripsi Ilmu Komunikasi hampir selalu memuatnya — *brand
awareness*, *personal branding*, *content creator* — dan seluruhnya tercetak
tegak seperti kata Indonesia di sekelilingnya, berbeda dari judul pada skripsi
yang sudah disahkan pembimbing.

---

## Yang berubah

### 1. Sebaris atau bertingkat didaftar, bukan dipilih per baris JSX

`transkrip-label.ts` sekarang memuat daftarnya:

| Sebaris | Bertingkat |
| --- | --- |
| `akred`, `fak`, `jenjangLbl`, `kons` | `noij`, `nppt`, `yud`, `nama`, `nim`, `ttl`, `prodi`, `npps` |

Komponen `<LblDoc kunci="akred" teks={L.akred} />` menanyakan daftar itu,
bukan memilih sendiri. Hasilnya persis gambar acuan:

```
TERAKREDITASI / ACCREDITATION  :  UNGGUL
                                  LAMSPAK Nomor 156/AK.03.05/2026
FAKULTAS / FACULTY             :  ILMU SOSIAL DAN ILMU POLITIK /
                                  SOCIAL AND POLITICAL SCIENCES
JENJANG / DEGREE LEVEL         :  SARJANA / BACHELOR DEGREE (S-1)
KONSENTRASI / CONCENTRATION    :  ADVERTISING

NAMA MAHASISWA /               :  LUTFI ALHABSY
STUDENT NAME
NOMOR INDUK MAHASISWA /        :  2270201140
STUDENT IDENTIFICATION NUMBER
```

Daftarnya dikunci uji: label yang lupa didaftar, atau masuk dua daftar
sekaligus, menggagalkan `uji-transkrip.ts`.

### 2. UNGGUL tertulis langsung di template

```
Akreditasi   UNGGUL LAMSPAK Nomor 156/AK.03.05/2026
```

Tanpa tanda kutip, dengan nomor SK yang berlaku, sama persis dengan bawaan
transkrip di layar. Tetap **satu sel**, bukan dua kolom: berkas dari SIMAK
maupun KUI menuliskannya pada satu sel, dan `pecahAkreditasi` yang memisahkan
peringkat dari nomor SK-nya saat dicetak.

### 3. Konsentrasi: daftar yang selalu terlihat + pembacaan otomatis

**Pilihannya sekarang daftar biasa**, bukan `<datalist>` yang harus dipancing:

```
Konsentrasi  [ — belum diisi —            ▾ ]
             [ Public Relations              ]
             [ Advertising                   ]
             [ Broadcasting                  ]
             [ Lainnya (ketik sendiri)…      ]
             [ 🔎 Deteksi dari mata kuliah   ]
```

Ejaan dari berkas KUI selalu huruf besar ("ADVERTISING"); yang dicari adalah
pilihan yang sama artinya, bukan yang sama persis hurufnya. Konsentrasi di
luar daftar tetap dapat diketik lewat "Lainnya". Ilmu Pemerintahan memang
tidak berkonsentrasi, jadi kolomnya berbunyi "Ilmu Pemerintahan tidak
berkonsentrasi" — bukan hilang dan membuat admin mencari-cari.

**`tebakKonsentrasi()` membaca konsentrasi dari daftar mata kuliahnya.**
Berjalan sendiri saat impor kalau berkasnya tidak menyebutkan, dan dapat
dipanggil kapan saja lewat tombol 🔎. Tandanya **diturunkan dari kamus yang
sudah ada**, bukan didaftar ulang:

| Tanda | Angka | Contoh |
| --- | --- | --- |
| KODE yang hanya ada di satu kamus konsentrasi | 3 | `MKSA-048`, `MKSB-050`, `MKSP-002` |
| NAMA (Indonesia maupun Inggris) yang hanya ada di satu kamus | 2 | "Riset Iklan" / "Advertising Research", "Teknik Kamera" / "Camera Techniques", "Cyber Public Relations" |
| KATA KUNCI pada mata kuliah yang tidak dikenal kamus mana pun | 1 | Iklan/Periklanan/Advertising · Siaran/Penyiaran/Broadcast/Kamera/TV · Public Relations/Humas/Kehumasan |

Mata kuliah **inti** tidak pernah menjadi tanda. "Dasar Dasar Periklanan" dan
"Dasar Dasar Public Relations" diambil ketiga konsentrasi; memakainya sebagai
tanda membuat setiap mahasiswa terbaca Advertising sekaligus Public Relations.

Yang menang harus mengumpulkan **minimal 2 angka DAN lebih tinggi daripada
runner-up-nya**. Kalau tidak, hasilnya kosong dan kolomnya dibiarkan untuk
diisi admin. Konsentrasi yang salah mengganti **seluruh** kolom Inggris pada
dokumen yang ikut dilegalisir — di situ "tidak tahu" jauh lebih murah daripada
"kira-kira".

Hanya untuk Ilmu Komunikasi. `MKPB-051` di Broadcasting berarti "Produksi
Feature TV", di Ilmu Pemerintahan berarti "PKL"; menebaknya lintas prodi
persis melahirkan kembali kekeliruan yang memaksa kamus dipecah pada v32.

Pesan impor menyebutkan dari mana konsentrasi itu datang:

```
Sheet "Sheet1": 52 mata kuliah terbaca …; konsentrasi terbaca sendiri sebagai
Broadcasting dari mata kuliahnya (Produksi Feature TV, Digital Editing,
Teknik Kamera) — PERIKSA sebelum mencetak; kamus Ilmu Komunikasi — Broadcasting, …
```

**Dan konsentrasi tidak lagi diwarisi mahasiswa sebelumnya.** Dulu isian lama
hanya ditimpa kalau berkas baru menyebutkan konsentrasi; sekarang ia
dikosongkan kalau berkasnya diam. Konsentrasi yang tertinggal dari impor
sebelumnya mengganti seluruh kolom Inggris tanpa ada yang mengetik apa pun.

### 4. Istilah Inggris pada judul skripsi dicetak miring

`src/lib/judul-inggris.ts` memuat daftar istilah yang lazim pada judul skripsi
Ilmu Komunikasi dan Ilmu Pemerintahan:

```
Pengaruh Brand Awareness terhadap Minat Beli Konsumen pada Content Creator TikTok
      →  Pengaruh *Brand Awareness* terhadap Minat Beli Konsumen pada *Content Creator* TikTok
```

Tiga rem yang sengaja dipasang:

1. **Daftar, bukan pengenalan bahasa.** Yang dimiringkan hanya yang terdaftar.
   Judul adalah kalimat yang ditulis mahasiswanya sendiri; memiringkan kata
   Indonesia yang kebetulan mirip Inggris ikut dicetak dan ikut dilegalisir.
2. **Kata serapan baku tidak didaftar** — media, publik, digital, video,
   televisi, program, produksi, strategi, konten, viral. Kata seperti itu
   ditulis tegak.
3. **Judul yang seluruhnya berbahasa Inggris dibiarkan tegak.** Memiringkan
   seluruh kalimat bukan lagi penanda istilah asing.

Admin selalu dapat memaksa istilah yang belum terdaftar dengan tanda bintang:

```
Pengaruh *Brand Ambassador* terhadap Minat Beli
```

Begitu satu tanda bintang dipakai, **daftar tidak ikut bekerja pada judul
itu**: yang miring persis yang ditandai admin, tidak lebih. Judul resmi tidak
boleh setengah ditentukan daftar dan setengah ditentukan manusia — yang
seperti itu mustahil diperiksa sebelum cetak.

---

## Yang diperiksa

`npx tsx uji-transkrip.ts` — **237 periksa lulus** (dari 167 pada v32).

Yang baru:

- **Label sebaris/bertingkat**: keempat label sebaris, kedelapan label
  bertingkat, tidak ada yang masuk dua daftar, tidak ada label biodata yang
  lupa dipilah.
- **Template**: peringkat UNGGUL tertulis apa adanya tanpa tanda kutip, dan
  terpenggal benar saat dicetak.
- **Konsentrasi**: ketiga berkas KUI sungguhan terbaca benar — juga tanpa
  kolom Inggris (base SIMAK mentah) dan tanpa kode mata kuliah (kurikulum yang
  kodenya berganti). Contoh yang diminta Admin Akademik diperiksa satu per
  satu, Inggris maupun padanan Indonesianya. Mata kuliah inti tidak menjadi
  tanda; tanda yang terbagi rata tidak ditebak; Ilmu Pemerintahan tidak pernah
  ditebak konsentrasinya.
- **Judul skripsi**: istilah dimiringkan utuh (bukan "Brand" saja dari "Brand
  Awareness"), kata serapan baku tetap tegak, tanda bintang admin menang
  penuh, judul Inggris penuh dibiarkan tegak, dan seluruh huruf judul utuh —
  satu huruf yang hilang ikut dicetak dan ikut dilegalisir.

`npx tsx uji-arsip-transkrip.ts`, `uji-kelulusan-pddikti.ts`,
`uji-kunci-layar.ts`, `npm run lint`, `npm run typecheck`, dan `npm run build`
ikut dijalankan dan bersih.

---

## Berkas yang berubah

| Berkas | Isi |
| --- | --- |
| `src/lib/judul-inggris.ts` | **baru** — daftar istilah Inggris & pemenggal judul |
| `src/lib/kamus-matkul.ts` | `tebakKonsentrasi()`, `NAMA_KONSENTRASI` |
| `src/app/dashboard/template/transkrip-label.ts` | `LABEL_SEBARIS`, `LABEL_BERTINGKAT`, `labelSebaris()` |
| `src/app/dashboard/template/transkrip-template.ts` | peringkat UNGGUL di template unduhan |
| `src/app/dashboard/template/template-app.tsx` | `<LblDoc>`, `<JudulSkripsi>`, pilihan & deteksi konsentrasi, panduan template |
| `src/app/globals.css` | `.tpl-catatan` — catatan kecil di bawah kolom isian |
| `uji-transkrip.ts` | 70 periksa baru |
