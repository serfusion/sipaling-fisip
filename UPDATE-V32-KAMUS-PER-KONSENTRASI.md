# v32: Nama Inggris transkrip Ilmu Komunikasi — per konsentrasi

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

### 3. Datanya disalin dari transkrip resmi fakultas, bukan dikarang

Seluruh 68 nama Inggris Ilmu Komunikasi disalin dari transkrip dwibahasa resmi
fakultas untuk ketiga konsentrasi. Bukan terjemahan yang disusun di sini.

**Ketiga berkas itu tidak seragam satu sama lain.** Lima kode ditulis berbeda
di salah satu berkas. Yang dipakai adalah bunyi yang muncul pada **mayoritas**
berkas, dan yang menyimpang dicatat — bukan disembunyikan:

| Kode | Mata kuliah | Dipakai | Menyimpang di |
| --- | --- | --- | --- |
| MPK-003/004/005 | AIKA III–V | `Islamic and Muhammadiyah Studies III–V` | Public Relations menulis `Al-Islam and Kemuhammadiyahan III (Islamic and Muhammadiyah Studies III)` |
| MPK-011 | Sosiologi Dan Sistem Sosial Indonesia | `Sociology and Indonesian Social System` | Broadcasting menulis `Sociology and System Social Indonesia` |
| MKB-011 | Komunikasi Sosial Pembangunan | `Development Communication` | Broadcasting menulis `Social Development Communication` |

Dua yang pertama tampak salah tulis — AIKA I dan II pada berkas Public
Relations itu sendiri ditulis polos, dan "Sociology and System Social
Indonesia" bukan susunan bahasa Inggris yang benar. Yang ketiga, MKB-011,
betul-betul pilihan kata: dua berkas memilih `Development Communication`, satu
memilih `Social Development Communication`.

**Kalau fakultas memutuskan lain, tidak perlu mengubah kode.** Betulkan
barisnya di layar lalu simpan — koreksinya diingat untuk unggahan berikutnya
(lihat nomor 5).

### 4. Tombol "Isi ulang kolom Inggris"

Di bawah tabel nilai, di samping "+ Tambah baris":

> **🔤 Isi ulang kolom Inggris (ikut prodi & konsentrasi)**

Kolom Inggris diisi saat impor, memakai konsentrasi yang terbaca dari berkas.
Kalau konsentrasinya keliru — atau berkasnya memang tidak menyebutkannya —
betulkan di Biodata, lalu tekan tombol ini.

**Tidak berjalan sendiri.** Menimpa kolom Inggris tanpa diminta akan menghapus
koreksi tangan yang baru saja diketik admin, dan terjemahan resmi KUI yang
ikut terbaca dari berkas dwibahasa. Tombolnya menimpa **seluruh** kolom
Inggris, dan keterangannya mengatakan begitu sebelum ditekan.

Kolom Konsentrasi sekarang menawarkan ketiga ejaan resmi lewat daftar pilihan,
tetapi tetap bebas diketik.

### 5. Koreksi admin ikut berlingkup

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

`npx tsx uji-transkrip.ts` — **114 pemeriksaan** (sebelumnya 52).

Yang baru, dan yang paling menentukan: ketiga transkrip dwibahasa resmi
fakultas dipakai sebagai bahan uji, tanpa nama dan NIM mahasiswanya
(`uji-berkas-contoh/transkrip-ilkom-*.json`). Ujinya **membuang kolom Inggris
pada berkas itu, mengisinya kembali dari kamus, lalu menuntut hasilnya sama
persis**. Bergeser satu kata pun, ujinya gagal.

Daftar penyimpangan antar berkas ikut diperiksa **dua arah**: kalau salah satu
ternyata tidak lagi menyimpang, ujinya gagal dan daftarnya harus dirapikan.
Daftar itu tidak bisa menjadi karpet.

Selain itu:

- kesepuluh kode yang bertabrakan, diperiksa untuk **kedua** prodi;
- tanpa prodi, kode bentrok tidak dijawab, dan kode yang tidak bentrok tetap
  dijawab;
- koreksi Ilmu Pemerintahan tidak bocor ke Ilmu Komunikasi, dan sebaliknya;
- kunci lama tanpa lingkup mengisi kode yang belum dikenal, tetapi tidak
  menimpa nama resmi konsentrasi;
- ejaan konsentrasi bebas — `BROADCASTING`, `Broadcasting`, `Penyiaran`;
- label `KONSETRASI` yang salah ketik pada berkas fakultas tetap terbaca.

`npx tsx uji-arsip-transkrip.ts` — 61 pemeriksaan, tetap lulus.
`npm run lint`, `npm run typecheck`, `npx next build` — bersih.

---

## Berkas yang berubah

| Berkas | Perubahan |
| --- | --- |
| `src/lib/kamus-matkul.ts` | kamus dipecah per lingkup; `terjemahkanMatkul`/`isiInggris`/`panenKamus` menerima lingkup; tambahan `isiUlangInggris`, `rantaiLingkup`, `lingkupUtama`, `kunciKamus`, `kodeBentrok` |
| `src/app/api/kamus-matkul/route.ts` | kunci koreksi admin berlingkup; lingkup tak dikenal ditolak |
| `src/app/dashboard/template/template-app.tsx` | lingkup diambil dari biodata berkas; tombol isi ulang; daftar pilihan konsentrasi |
| `uji-transkrip.ts` | 52 → 114 pemeriksaan |
| `uji-berkas-contoh/transkrip-ilkom-*.json` | tiga bahan uji baru dari transkrip resmi fakultas |
