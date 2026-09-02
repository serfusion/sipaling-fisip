# v21: Base mentahan SIMAK langsung jadi transkrip dwibahasa

## Yang sudah jalan, dan yang belum

Saya baca berkas `.xls` yang Anda kirim lewat pembaca yang sudah ada. Hasilnya:

| Isian | Terbaca? |
| --- | --- |
| Nama, NIM, prodi, tempat/tanggal lahir | ✅ |
| Tanggal yudisium, akreditasi | ✅ |
| 53 mata kuliah dari dua blok kolom | ✅ |
| Total 153 SKS, total mutu 525, IPK 3,43 | ✅ (sama persis dengan yang tertulis di berkasnya) |
| Judul skripsi — yang ditulis melompat dua baris | ✅ utuh |
| **Nama mata kuliah versi Inggris** | ❌ **52 dari 53 kosong** |

Jadi yang menggantung memang satu: kolom Inggrisnya. Base Anda hanya
berbahasa Indonesia, dan versi dwibahasanya harus diminta ke KUI setiap ada
lulusan baru.

## Satu bug ikut ketahuan

Baris ke-27, **Etika Pemerintahan**, kolom Inggrisnya berisi **`"K"`**.

Sebabnya: di bawah tabel ada blok "Keterangan" yang memuat sel `K`, `HM`,
`AM`, `MK` — tepat di kolom yang sama dengan nama mata kuliah. Pembacanya
melewati baris itu satu per satu, tetapi tetap membaca `K` sebagai *nama
Inggris* milik mata kuliah terakhir di kolom kiri.

Dan itu ikut tercetak di transkrip resmi, di bawah "Etika Pemerintahan",
sebagai satu huruf `K` yang miring.

Sekarang pembacanya **berhenti** begitu sampai di baris JUMLAH/Total
Kredit/Keterangan, bukan sekadar melewatinya, dan nama Inggris wajib berupa
kata sungguhan — minimal empat huruf dengan tiga huruf berurutan. Sel legenda
tidak mungkin lolos lagi.

---

## Yang berubah

### Kolom Inggris terisi sendiri saat impor

`src/lib/kamus-matkul.ts` menerjemahkan nama mata kuliah dengan tiga lapis
yang menurun ketepatannya:

1. **Kode mata kuliah** — paling tepat, kodenya unik per kurikulum.
2. **Nama yang diseragamkan** — menampung kode yang berganti sementara namanya
   tetap, dan ejaan yang berbeda ("Managemen" / "Manajemen").
3. **Kata per kata** — bukan terjemahan yang indah, tetapi terbaca.

Untuk berkas Anda: **53 dari 53 terisi dari kamus, nol tebakan kata.**

```
MKK-011  Ilmu Budaya Dasar             → Basic Cultural Sciences
MKKB-033 Etika Pemerintahan            → Government Ethics
MKPB-051 PKL                           → Field Work Practice (Internship)
MKPB-052 KKN                           → Community Service Program
MKPB-053 Skripsi                       → Undergraduate Thesis
MKPB-049 Pemerintahan Elektronik ( E-Government )
                                       → Electronic Government (E-Government)
```

Lapis ketiga **tidak pernah menebak diam-diam**. Kalau ada mata kuliah yang
tidak dikenal, pesan impornya menyebut jumlahnya dan menyebut namanya:
*"3 diterjemahkan kata per kata dan PERLU DICEK (…)"*. Transkrip ikut
dilegalisir; Anda harus tahu baris mana yang perlu dilihat sendiri.

Terjemahan resmi dari KUI **selalu menang**: berkas dwibahasa yang kolom
Inggrisnya sudah terisi tidak pernah ditimpa kamus.

### Kamusnya tumbuh sendiri

Kurikulum berubah. Tanpa jalur ini, tiap mata kuliah baru menuntut koreksi
tangan yang **sama** pada setiap unggahan berikutnya.

Jadi: perbaiki nama Inggris yang salah di tabel, lalu klik **💾 Simpan data
transkrip**. Pasangan kode → nama Inggris itu diingat, dan unggahan berikutnya
sudah terisi. Pesannya menyebut berapa yang diingat.

Koreksi Anda selalu menang atas daftar bawaan — daftar itu ditulis sekali,
koreksinya dibuat orang yang sedang melihat berkasnya.

---

## Cara pakainya (tidak berubah)

Dashboard → **Template & Transkrip** → **Transkrip (ID+EN)** → **Impor Excel**
→ pilih `.xls` mentah dari SIMAK. Selesai — nama, NIM, prodi, TTL, yudisium,
akreditasi, 53 mata kuliah, nilai, SKS, IPK, judul skripsi, dan kolom Inggris
semuanya terisi.

Berkasnya diproses **di peramban Anda**; tidak diunggah ke mana pun.

---

## Yang dijaga uji otomatis

`npx tsx uji-transkrip.ts` — 52 pemeriksaan, bahannya berkas SIMAK sungguhan
(struktur asli, nama dan NIM mahasiswanya diganti):

- IPK, total SKS, dan total mutu **sama persis** dengan yang tertulis di
  berkasnya — 153, 525, dan 3,43
- judul skripsi terbaca utuh melewati dua baris, dan tidak kemasukan label
  "Keterangan"/"Predikat"
- **kolom Inggris Etika Pemerintahan tidak lagi berisi `"K"`**, dan tidak ada
  satu pun nama Inggris yang panjangnya di bawah empat huruf
- 53 dari 53 terisi dari kamus, nol tebakan kata
- kode menang atas nama; ejaan berbeda tetap ketemu; kode berspasi tetap ketemu
- mata kuliah asing tetap mendapat terjemahan yang terbaca **dan ditandai**
  sebagai tebakan
- terjemahan yang sudah ada tidak pernah ditimpa
- kamus tambahan menang atas bawaan, dan hanya pasangan yang benar-benar baru
  yang dipanen
