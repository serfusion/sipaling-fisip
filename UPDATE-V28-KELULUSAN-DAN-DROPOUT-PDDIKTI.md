# v28: Admin PDDIKTI — template "Input Kelulusan & Dropout"

Kartu **"Template unit Anda"** milik Admin PDDIKTI selama ini kosong: hanya
janji bahwa templatnya menyusul. Sekarang ia berisi yang sesungguhnya
dikerjakan unit itu tiap akhir semester — memindahkan data yudisium dari
fakultas ke format unggahan PDDIKTI.

Tidak ada perubahan basis data. Tidak ada berkas SQL baru. Seluruhnya
berjalan di peramban admin; **tidak ada satu pun data mahasiswa yang dikirim
ke server**.

---

## Persoalannya: dua berkas yang tidak sebangun

Yang datang dari fakultas adalah `DATA_WISUDAWAN_FISIP_20252026.xlsx` — satu
lembar per prodi, berkop lampiran SK, judul prodi di baris keempat, judul
kolomnya baru muncul di baris kesembilan, dan blok tanda tangan Dekan di
kakinya. Kolomnya: `NO · KODE PT · KODE PRODI · NIM · NAMA MAHASISWA ·
TEMPAT LAHIR · TANGGAL LAHIR · JK · TGL YUDISIUM · NIK · IPK · PREDIKAT
KELULUSAN`.

Yang diminta PDDIKTI adalah sepuluh kolom tetap, urut A–J, pada satu lembar
bernama **Template kelulusan**:

| # | Kolom | Warna di template PDDIKTI |
|---|-------|---------------------------|
| A | NIM | 🔴 wajib |
| B | Nama | 🟢 boleh kosong |
| C | Jenis Keluar | 🔴 wajib |
| D | Tanggal keluar / Tanggal lulus | 🔴 wajib |
| E | Semester Keluar | 🔴 wajib |
| F | Nomor SK | 🟢 boleh kosong |
| G | Tanggal SK | 🟢 boleh kosong |
| H | IP Kumulatif | 🔴 wajib |
| I | Keterangan | 🟢 boleh kosong |
| J | Kode Prodi | 🔴 wajib |

Tidak ada satu kolom pun yang namanya sama di kedua berkas. Sampai sekarang
jembatannya adalah salin-tempel tangan, 363 baris, sekali setahun.

---

## 1. Yang paling penting: TGL YUDISIUM → Tanggal keluar

Ini bagian yang paling mudah salah, dan salahnya paling mahal.

Tanggal yudisium **berbeda-beda di dalam satu berkas yang sama**. Berkas
2025/2026 saja memuat **20 tanggal berbeda** — dari 7 Juni sampai 25 Juli
2026, dengan 70 mahasiswa pada 19 Juli dan hanya 4 pada 10 Juli. Menyalin satu
tanggal lalu menyeretnya ke bawah membuat ratusan mahasiswa tercatat lulus di
hari yang bukan hari yudisiumnya, dan itu terbawa sampai ke ijazah.

Tiap baris karena itu dibaca sendiri-sendiri:

```
"7 JUNI 2026"      → 2026-06-07
"18 JUNI 2026"     → 2026-06-18
"01 NOPEMBER 1998" → 1998-11-01
```

Bentuk lain ikut dimengerti: `2026-06-07`, `7/6/2026`, tanggal Excel
sungguhan, dan nomor serinya. Yang **tidak** terbaca tidak pernah ditebak —
barisnya ditandai merah beserta tulisan aslinya ("Di berkas fakultas tertulis:
…"), tidak ikut terunduh, dan dapat diperbaiki di tempat.

Dua penjagaan kecil yang sengaja ada:

- `31 FEBRUARI 2026` **ditolak**, bukan digeser diam-diam menjadi 3 Maret.
- NIM `2270201090` yang nyasar ke kolom tanggal tidak diam-diam berubah
  menjadi tanggal.

## 2. Semester Keluar dihitung, bukan diketik ulang

Kodenya memakai **tahun ajaran**: tahun yang ditulis adalah tahun *awal*
tahun ajarannya, bukan tahun pada tanggal yudisiumnya. Yudisium Juni dan Juli
2026 jatuh pada semester genap TA 2025/2026, jadi kodenya **`20252`** — bukan
`20262`. Selisih satu angka itu menentukan pada periode mana seluruh angkatan
tercatat keluar.

```
Agustus–Desember tahun Y  → ganjil TA Y/(Y+1)      → 20261  (Sep 2026)
Januari tahun Y           → ekor ganjil TA (Y-1)/Y → 20251  (Jan 2026)
Februari–Juli tahun Y     → genap TA (Y-1)/Y       → 20252  (Jun 2026)
```

Januari memakai tahun ajaran sebelumnya karena ia ekor semester ganjil yang
dimulai Agustus lalu. Pada semester ganjil kedua bacaan kebetulan bertemu di
angka yang sama; keduanya hanya berselisih pada semester genap.

Operator yang memakai kode **tahun kalender** (Juni 2026 = `20262`) tidak
perlu menghitung sendiri: nilainya disebutkan di layar dan dapat dipasang
dengan satu ketukan. Kolom Semester Keluar juga dapat diketik sendiri — satu
nilai untuk seluruh berkas.

Bila satu berkas ternyata melintasi dua semester, layarnya mengatakannya,
bukan mendiamkannya.

## 3. Kolom sisanya

| Kolom PDDIKTI | Asalnya |
|---|---|
| NIM | kolom `NIM`, **tetap teks** |
| Nama | kolom `NAMA MAHASISWA` |
| Jenis Keluar | pilihan di layar; `1 Lulus` untuk lembar yudisium, `0`–`6` untuk dropout |
| Tanggal keluar | `TGL YUDISIUM`, per baris (lihat bagian 1) |
| Semester Keluar | dihitung dari tanggal itu, kode tahun ajaran |
| Nomor SK | terangkat sendiri dari kop `Lampiran SK No. …` |
| **Tanggal SK** | **diketik admin sesuai suratnya** — memang tidak ada di berkas fakultas |
| IP Kumulatif | kolom `IPK`, dua angka di belakang koma: `3.8` → `3.80` |
| Keterangan | kosong; dapat diisi dari `PREDIKAT KELULUSAN` bila unit memerlukannya |
| Kode Prodi | kolom `KODE PRODI`; bila tidak ada, ditebak dari judul lembar (`70201` Ilmu Komunikasi, `65201` Ilmu Pemerintahan) |

Kode prodi yang datang dari berkas — atau yang sudah dikoreksi tangan — tidak
pernah tertimpa pilihan cadangan di layar, berapa kali pun pilihannya diganti.

## 4. Diperiksa sebelum diunggah, bukan sesudah ditolak

Enam kolom merah diperiksa satu per satu, ditambah NIM kembar. Baris yang
belum benar **tidak ikut** ke berkas hasil dan disebutkan sebabnya dengan
kalimat yang menunjuk kolomnya:

> `2270201204 · VIVI FAHRIYANTI PUTRI — tanggal "tanggal belum ada" tidak terbaca`

Kolom hijau yang kosong tidak pernah menahan baris — memang boleh kosong.

Tabelnya dapat disunting langsung, disaring per prodi, dicari per NIM/nama,
dan disaring menjadi "hanya yang bermasalah".

## 5. Berkas hasilnya

Satu lembar bernama `Template kelulusan`, sepuluh kolom urut A–J — **sama
persis dengan template PDDIKTI**, sampai ke warna merah/hijau judul kolomnya,
catatan yang menggantung di tiap judul, dan lebar kolomnya. Berkas yang dibuka
kembali bulan depan masih terbaca sebagai template PDDIKTI, bukan tabel mentah
tanpa penanda.

Seluruh isinya ditulis sebagai **teks**. NIM `2270201090` yang tersimpan
sebagai angka muncul kembali sebagai `2.27E+09`, dan `3.80` kehilangan angka
nolnya — keduanya keluhan lama yang tidak perlu ada.

Unduhannya dapat digabung atau dipisah per prodi, karena sebagian operator
mengunggahnya satu prodi sekali jalan:

```
Kelulusan-PDDIKTI-20252.xlsx          363 baris
Kelulusan-PDDIKTI-70201-20252.xlsx    292 baris (Ilmu Komunikasi)
Kelulusan-PDDIKTI-65201-20252.xlsx     71 baris (Ilmu Pemerintahan)
```

Ada pula **template kosong** — sepuluh kolom lengkap dengan warna dan
catatannya — untuk yang ingin mengisi tangan.

### Kenapa berkasnya dirakit sendiri, padahal SheetJS sudah ada

Alasannya sama dengan `src/lib/template-xlsx.ts`: edisi komunitas SheetJS
tidak dapat **menulis** gaya sel. Ia menulis huruf dan angkanya dengan benar,
tetapi tanpa merah, tanpa hijau, dan tanpa catatan — padahal justru itu yang
membuat sebuah berkas terbaca sebagai template PDDIKTI.

Catatan sel pada `.xlsx` butuh tiga bagian sekaligus: `comments1.xml` (isinya),
`vmlDrawing1.vml` (kotak kuning warisan Excel lama), dan `<legacyDrawing>` pada
lembarnya. Tanpa VML-nya, Excel membuka berkasnya sambil mengeluh rusak —
karena itu ketiganya selalu ditulis bersama-sama.

---

## Di mana

**Dashboard → Template → Input Kelulusan & Dropout**, atau langsung
`/dashboard/template?jenis=kelulusan`.

Terbuka untuk `admin_pddikti`, `admin`, dan `super_admin`.

## Berkas yang berubah

| Berkas | Isi |
|---|---|
| `src/app/dashboard/template/kelulusan-parse.ts` | baru — pembacaan lembar yudisium, tanggal, semester, pemeriksaan |
| `src/app/dashboard/template/kelulusan-panel.tsx` | baru — layar tiga langkahnya |
| `src/lib/kelulusan-xlsx.ts` | baru — perakit `.xlsx` berwarna + bercatatan |
| `src/app/dashboard/template/template-app.tsx` | tab & hak akses `admin_pddikti` |
| `src/app/dashboard/dashboard-app.tsx` | kartu template menggantikan yang kosong |
| `src/app/globals.css` | gaya layar `kel-*` |
| `uji-kelulusan-pddikti.ts` | baru — 65 pemeriksaan |

## Menguji

```bash
npx tsx uji-kelulusan-pddikti.ts
```

65 pemeriksaan: pembacaan tanggal (termasuk yang harus ditolak), semester,
IPK, pembacaan lembar sungguhan, pemeriksaan kolom wajib, dan berkas hasilnya
dibaca ulang oleh pembaca Excel sungguhan — bukan sekadar dipastikan
"berbentuk zip".
