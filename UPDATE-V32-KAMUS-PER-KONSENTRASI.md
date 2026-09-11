# v32: Transkrip — kamus per konsentrasi, header & footer sesuai KUI

## Yang salah

Admin Akademik benar: nama Inggris pada transkrip Ilmu Komunikasi memang
salah. Bukan salah ketik satu-dua baris, melainkan salah yang berpola.

Kamus nama mata kuliah selama ini **satu daftar datar**: satu kode, satu nama
Inggris. Itu bertahan selama hanya ada satu kurikulum. Begitu Ilmu Komunikasi
ikut memakainya, daftar datar itu runtuh — karena **kode mata kuliah tidak
unik antar prodi**. Sepuluh kode dipakai oleh kedua prodi untuk mata kuliah
yang sama sekali berbeda:

| Kode | Ilmu Pemerintahan | Ilmu Komunikasi |
| --- | --- | --- |
| MKK-012 | Pengantar Sosiologi | **Ilmu Budaya Dasar** |
| MKK-020 | Dasar Dasar Logika | **Komputer Dan Multimedia** |
| MPK-001…005 | AIKA I–V | **AIKA I–V** (bunyi Inggrisnya berbeda) |
| MPK-010 | Filsafat Ilmu Pengetahuan | **Filsafat Pengetahuan Dan Dasar Logika** |
| MKPB-051 | PKL | **Produksi Feature TV** (Broadcasting) |
| MKPB-052 | KKN | **Produksi Dan Pasca Produksi** (Broadcasting) |

Yang tercetak pada transkrip Ilmu Komunikasi karena itu:

```
Ilmu Budaya Dasar          → Introduction to Sociology        ← salah
Komputer Dan Multimedia    → Fundamentals of Logic            ← salah
Produksi Feature TV        → Field Work Practice (Internship) ← salah
Produksi Dan Pasca Produksi→ Community Service Program        ← salah
AIKA I                     → Al-Islam and Kemuhammadiyahan I  ← bukan bunyi
                                                                 fakultas
```

Dan salahnya diam: tidak ada kolom kosong, tidak ada tanda seru. Barisnya
terisi rapi dengan nama mata kuliah **milik prodi lain**, lalu ikut dicetak,
ikut ditandatangani Dekan, ikut dilegalisir.

Sisanya — 53 dari 68 kode Ilmu Komunikasi — tidak ada di kamus sama sekali,
jadi jatuh ke pencocokan nama atau tebakan kata per kata.

---

## Yang berubah

### 1. Kamusnya dipecah per kurikulum, lalu per konsentrasi

`src/lib/kamus-matkul.ts` sekarang memuat **lima kamus**, bukan satu:

| Lingkup | Isi |
| --- | --- |
| `pemerintahan` | kurikulum Ilmu Pemerintahan, tidak berubah sedikit pun |
| `ilkom` | 44 mata kuliah inti Ilmu Komunikasi (sama di ketiga konsentrasi) |
| `ilkom-pr` | 8 mata kuliah Public Relations |
| `ilkom-bc` | 8 mata kuliah Broadcasting |
| `ilkom-adv` | 8 mata kuliah Advertising |

Yang menentukan kamus mana yang dipakai adalah **prodi dan konsentrasi pada
biodata transkrip yang sedang dikerjakan** — dan diambil dari biodata
**berkas yang baru diimpor**, bukan dari yang tersisa di layar. Kalau tidak,
mahasiswa Ilmu Komunikasi yang diimpor sesudah mahasiswa Ilmu Pemerintahan
akan diterjemahkan memakai kamus prodi sebelumnya.

Konsentrasi yang tertulis selalu menang. Dua konsentrasi lain tetap ikut
ditelusuri **sesudahnya**, tidak dibuang: kode ketiganya berawalan berbeda
(MKSP/MKPP, MKSB/MKPB, MKSA/MKPA) sehingga tidak mungkin bertabrakan satu
sama lain, dan mahasiswa yang mengambil mata kuliah lintas konsentrasi karena
itu tetap mendapat nama Inggrisnya. Base SIMAK mentah pun memuat PROGRAM
STUDI tetapi tidak selalu memuat KONSENTRASI — dengan aturan ini, berkas
seperti itu tetap terisi penuh.

### 2. Prodi yang tidak diketahui TIDAK ditebak

Kalau prodinya tidak dikenali, kode yang bertabrakan antar prodi **dilewati**,
bukan dijawab dengan salah satunya. Kode yang berarti sama di mana pun
(MKB-044 Skripsi, misalnya) tetap dijawab.

Menebak di sini berarti mencetak nama mata kuliah prodi lain pada dokumen
resmi. Kolom yang kosong menuntut admin mengetik satu baris; kolom yang salah
menuntut ijazah dicetak ulang.

### 3. Datanya disalin dari KUI apa adanya

Seluruh 68 nama Inggris Ilmu Komunikasi disalin dari transkrip dwibahasa KUI
untuk ketiga konsentrasi. Bukan terjemahan yang disusun di sini.

**Ketiga berkas itu berselisih pada lima kode** — dan selisihnya
**dipertahankan**, tidak diseragamkan:

| Kode | Mata kuliah | Public Relations | Broadcasting | Advertising |
| --- | --- | --- | --- | --- |
| MPK-003/004/005 | AIKA III–V | `Al-Islam and Kemuhammadiyahan III (Islamic and Muhammadiyah Studies III)` | `Islamic and Muhammadiyah Studies III` | sama seperti Broadcasting |
| MPK-011 | Sosiologi Dan Sistem Sosial Indonesia | `Sociology and Indonesian Social System` | `Sociology and System Social Indonesia` | sama seperti PR |
| MKB-011 | Komunikasi Sosial Pembangunan | `Development Communication` | `Social Development Communication` | sama seperti PR |

Kamus ini **tidak berwenang merapikan bahasa KUI**. Transkrip yang tercetak
harus sama dengan yang dikeluarkan KUI untuk konsentrasi itu — termasuk bunyi
yang tampak janggal seperti `Sociology and System Social Indonesia`. Selisih
antar konsentrasi adalah keputusan KUI, bukan galat yang perlu diperbaiki di
sini. Kalau KUI kelak merapikannya, barisnya dibetulkan di layar lalu disimpan
(lihat nomor 7).

### 4. Header dan footer dibetulkan mengikuti transkrip KUI

Label transkrip ikut dilegalisir dan ikut dibaca kampus luar negeri. Enam di
antaranya keliru:

| Baris | Sebelumnya | Sekarang (sesuai KUI) |
| --- | --- | --- |
| Nomor Ijazah Nasional | DEGREE CERTIFICATE NUMBER | **NATIONAL DIPLOMA NUMBER** |
| Nomor Pokok Perguruan Tinggi | INSTITUTIONAL REGISTRATION NUMBER | **NATIONAL HIGHER EDUCATION INSTITUTION CODE** |
| Tanggal Yudisium | DEGREE CONFERRAL DATE | **DATE OF DEGREE CONFERRAL** |
| Terakreditasi | ACCREDITED | **ACCREDITATION** |
| Nama Mahasiswa | COMPLETE NAME | **STUDENT NAME** |
| Nomor Induk Mahasiswa | STUDENT REGISTRATION NUMBER | **STUDENT IDENTIFICATION NUMBER** |
| Nomor Pokok Program Studi | STUDY PROGRAM IDENTIFICATION NUMBER | **NATIONAL STUDY PROGRAM CODE** |
| Jenjang | COURSE | **DEGREE LEVEL** |
| Tempat, Tgl Lahir | PLACE AND DATE OF BIRTH | **PLACE, DATE OF BIRTH** |
| Total Kredit | Total Credits Accomplished | **Total Credits** |
| Total Nilai | Total Grade Points | **Total Quality Points** |
| Indeks Prestasi Kumulatif | Grade Point Average (GPA) | **Cumulative Grade Point Average (GPA)** |

`FAKULTAS / FACULTY`, `JENJANG / DEGREE LEVEL`, dan `KONSENTRASI /
CONCENTRATION` sekarang dicetak **satu baris**, seperti pada transkrip KUI —
bukan bertingkat seperti label kolom kiri.

**Singkatan kolom nilai tergeser satu kolom.** AM (Angka Mutu) berlabel `CR`,
K (Kredit) berlabel `WM`, M (Mutu) berlabel `GP`:

```
sebelum:  HM/LG   AM/CR   K/WM   M/GP      ← CR di kolom Angka Mutu
sesudah:  HM/LG   AM/GP   K/CR   M/QP
```

`CR` dan `QP` mengikuti bunyi yang dipakai KUI sendiri pada baris total —
*Total Credits* dan *Total Quality Points*. Singkatan `WM` yang tidak punya
acuan dibuang.

Predikat kelulusan dicetak **satu istilah**, bukan pasangan Indonesia/Inggris:
transkrip KUI berbunyi `Cum Laude`, bukan `Dengan Pujian / Cum Laude (With
Honors)`. Lembar Indonesia memakai ejaan `IJAZAH`, bukan `Ijasah`, dan seluruh
labelnya diseragamkan huruf besar.

Akreditasi bawaan mengikuti yang sekarang berlaku: `UNGGUL LAMSPAK Nomor
156/AK.03.05/2026`.

**Setiap garis miring diapit spasi:** `NAMA MAHASISWA / STUDENT NAME`, bukan
`NAMA MAHASISWA/STUDENT NAME`. Termasuk yang jatuh di ujung baris karena
bagian Inggrisnya turun ke bawah — yang tercetak berbunyi `NAMA MAHASISWA /`.
Aturannya dikunci uji, bukan kesepakatan lisan. Nomor SK **tidak** ikut
dirapikan: `156/AK.03.05/2026` adalah nomor, bukan pasangan dwibahasa.

**Akreditasi dicetak bertingkat**, seperti transkrip KUI:

```
TERAKREDITASI / ACCREDITATION  :  UNGGUL
                                  LAMSPAK Nomor 156/AK.03.05/2026
```

Tetap **satu isian**, bukan dua kolom: berkas dari SIMAK maupun dari KUI
menuliskan keduanya pada satu sel, dan memecahnya jadi dua kolom akan membuat
impor Excel kehilangan salah satunya. Pemenggalannya jatuh sebelum kata yang
memulai rujukan SK — `LAMSPAK`, `BAN-PT`, `Nomor`, `No.`, `SK` — dan admin
dapat memaksanya dengan menulis `|`. Isian yang **hanya** memuat nomor SK
tetap satu baris, supaya tidak tercetak dengan baris atas yang kosong.

Nilai **Jenjang** dicetak satu baris (`SARJANA / BACHELOR DEGREE (S-1)`),
sedangkan Fakultas dan Program Studi tetap bertingkat — mengikuti transkrip
KUI.

**Satu lembar untuk kedua prodi.** Ilmu Pemerintahan memakai label yang sama
persis — perbaikan di atas berlaku untuk transkrip Ilmu Pemerintahan juga,
bukan hanya Ilmu Komunikasi. Labelnya dipisah ke
`src/app/dashboard/template/transkrip-label.ts` supaya dapat diuji sendirian.

### 5. Saklar "Dekan & Rektor" / "Tanpa rektor"

Di Biodata, sebelah kolom Dekan:

> **Tanda tangan:** `Dekan & Rektor` · `Tanpa rektor (Dekan di kanan)`

| Pilihan | Yang tercetak |
| --- | --- |
| Dekan & Rektor | Dekan di kiri, Rektor di kanan bersama tanggalnya — seperti sedia kala |
| Tanpa rektor | **Dekan pindah ke kanan** bersama tanggalnya; kolom kiri hilang |

Kolom kiri tidak disisakan kosong. Kotak kosong di transkrip resmi terbaca
sebagai tanda tangan yang **belum dibubuhkan**, bukan sebagai tanda tangan
yang memang tidak diperlukan. Kolom Rektor dan NBM Rektor ikut disembunyikan
selama saklarnya "tanpa rektor", supaya tidak ada isian yang diisi sia-sia.

Tanggal **selalu** di kolom paling kanan, di atas nama yang menandatangani
di situ.

Saklarnya disimpan sebagai teks (`ttd`), bukan boolean: penyaring meta di
server hanya meloloskan nilai teks, dan boolean akan hilang diam-diam saat
transkripnya diarsipkan. Draf dan arsip yang dibuat **sebelum** saklarnya ada
tidak menyebut `ttd` sama sekali — yang seperti itu tetap tercetak dengan dua
tanda tangan, tidak tiba-tiba kehilangan Rektor.

### 6. Tombol "Isi ulang kolom Inggris"

Di bawah tabel nilai, di samping "+ Tambah baris":

> **🔤 Isi ulang kolom Inggris (ikut prodi & konsentrasi)**

Kolom Inggris diisi saat impor, memakai konsentrasi yang terbaca dari berkas.
Kalau konsentrasinya keliru — atau berkasnya memang tidak menyebutkannya —
betulkan di Biodata, lalu tekan tombol ini.

**Tidak berjalan sendiri.** Menimpa kolom Inggris tanpa diminta akan menghapus
koreksi tangan yang baru saja diketik admin, dan terjemahan resmi KUI yang
ikut terbaca dari berkas dwibahasa. Tombolnya menimpa **seluruh** kolom
Inggris, dan keterangannya mengatakan begitu sebelum ditekan.

Kolom Konsentrasi menawarkan ketiga ejaan resmi lewat daftar pilihan, tetapi
daftarnya **baru muncul sesudah admin mengetik sendiri** — dan hanya untuk
prodi yang memang berkonsentrasi. Daftar yang menyembul begitu kolomnya
disentuh memancing salah klik, dan konsentrasi yang salah mengganti **seluruh**
kolom Inggris, bukan hanya satu baris biodata. Yang sudah diketik lengkap dan
benar tidak diusulkan lagi.

### 7. Koreksi admin ikut berlingkup

Kamus yang tumbuh dari koreksi admin (`app_settings['kamus_matkul']`) dulu
juga datar. Artinya koreksi yang benar untuk Ilmu Komunikasi akan **mengubah
transkrip Ilmu Pemerintahan** — bug yang sama, satu lapis lebih dalam.

Kuncinya sekarang berlingkup: `ilkom-bc::MKPB-051`, bukan `MKPB-051`.

Kunci lama tanpa `::` **tetap dibaca**, tidak dibuang. Tetapi entri seperti itu
dibuat sebelum kamus dipecah dan tidak diketahui lagi berasal dari prodi mana,
jadi ia hanya mengisi kode yang kamus bawaan memang tidak punya — ia tidak
lagi boleh menimpa nama yang tertulis pada transkrip resmi fakultas.

Koreksi pada transkrip yang **prodinya belum dipilih** tidak disimpan sama
sekali: laci "entah prodi mana" persis melahirkan kembali kamus datar ini.

---

## Yang diperiksa

`npx tsx uji-transkrip.ts` — **167 pemeriksaan** (sebelumnya 52).

Yang baru, dan yang paling menentukan: ketiga transkrip dwibahasa resmi
fakultas dipakai sebagai bahan uji, tanpa nama dan NIM mahasiswanya
(`uji-berkas-contoh/transkrip-ilkom-*.json`). Ujinya **membuang kolom Inggris
pada berkas itu, mengisinya kembali dari kamus, lalu menuntut hasilnya sama
persis**. Bergeser satu kata pun, ujinya gagal.

Tanpa pengecualian satu pun: kelima selisih antar konsentrasi ikut dituntut
sama persis, dan diperiksa lagi tersendiri supaya jelas selisihnya memang
disengaja, bukan lolos dari uji.

Selain itu:

- kesepuluh kode yang bertabrakan, diperiksa untuk **kedua** prodi;
- tanpa prodi, kode bentrok tidak dijawab, dan kode yang tidak bentrok tetap
  dijawab;
- koreksi Ilmu Pemerintahan tidak bocor ke Ilmu Komunikasi, dan sebaliknya;
- kunci lama tanpa lingkup mengisi kode yang belum dikenal, tetapi tidak
  menimpa nama resmi konsentrasi;
- ejaan konsentrasi bebas — `BROADCASTING`, `Broadcasting`, `Penyiaran`;
- label `KONSETRASI` yang salah ketik pada berkas fakultas tetap terbaca;
- seluruh label header & footer dikunci bunyinya, dan sepuluh bunyi lama yang
  terbukti keliru diperiksa **tidak boleh kembali**;
- singkatan kolom lurus dengan arti kolomnya, dan `WM` tidak dipakai lagi;
- setiap garis miring pada label diapit spasi — diperiksa karakter demi
  karakter, bukan dengan daftar contoh;
- pemenggalan akreditasi: bentuk LAMSPAK, bentuk BAN-PT dari base SIMAK,
  penggalan paksa dengan `|`, dan isian yang hanya memuat nomor SK;
- saklar rektor, termasuk isian lama yang belum menyebutnya.

`npx tsx uji-arsip-transkrip.ts` — 61 pemeriksaan, tetap lulus.
`npm run lint`, `npm run typecheck`, `npx next build` — bersih.

---

## Berkas yang berubah

| Berkas | Perubahan |
| --- | --- |
| `src/lib/kamus-matkul.ts` | kamus dipecah per lingkup; `terjemahkanMatkul`/`isiInggris`/`panenKamus` menerima lingkup; tambahan `isiUlangInggris`, `rantaiLingkup`, `lingkupUtama`, `kunciKamus`, `kodeBentrok` |
| `src/app/api/kamus-matkul/route.ts` | kunci koreksi admin berlingkup; lingkup tak dikenal ditolak |
| `src/app/dashboard/template/template-app.tsx` | lingkup diambil dari biodata berkas; tombol isi ulang; daftar pilihan konsentrasi; singkatan kolom dibetulkan; predikat satu istilah |
| `src/app/dashboard/template/transkrip-label.ts` | **baru** — label header & footer, pemecah akreditasi, saklar rektor |
| `src/app/globals.css` | baris nomor SK akreditasi; tanda tangan satu kolom |
| `uji-transkrip.ts` | 52 → 167 pemeriksaan |
| `uji-berkas-contoh/transkrip-ilkom-*.json` | tiga bahan uji baru dari transkrip resmi fakultas |
