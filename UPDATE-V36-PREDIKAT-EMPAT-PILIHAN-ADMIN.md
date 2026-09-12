# v36: Transkrip — empat predikat, admin yang memilih, tanpa padanan Inggris

## Yang salah

### 1. Transkrip Inggris mencetak "Very Satisfactory"

Sejak v35 predikat diterjemahkan sendiri oleh sistem pada transkrip berbahasa
Inggris:

```
Predikat Kelulusan / Graduation Honors : Very Satisfactory
```

Istilah itu tidak pernah ditulis siapa pun di FISIP. Ia lahir dari satu baris
peta di dalam kode:

```ts
const PREDIKAT_EN = { "Sangat Memuaskan": "Very Satisfactory" };
```

Akibatnya satu mahasiswa memegang dua dokumen yang sama-sama bertanda tangan
Dekan dan sama-sama dilegalisir, tetapi predikatnya berbunyi lain: transkrip
Indonesianya "Sangat Memuaskan", transkrip Inggrisnya "Very Satisfactory".
Yang memeriksa di seberang tidak punya cara tahu keduanya satu jenjang.

### 2. Predikatnya tinggal dua, dan tidak bisa diubah

v35 memangkas daftarnya menjadi dua istilah yang dihitung mati dari IPK:

```
IPK >= 3,51   Cum Laude
sisanya       Sangat Memuaskan
```

Dua kekurangannya baru terlihat waktu dipakai:

- **"Memuaskan" hilang.** IPK 2,80 dan IPK 3,45 sama-sama tercetak "Sangat
  Memuaskan", padahal keduanya bukan satu jenjang.
- **"Dengan Pujian" tidak ada jalan masuknya.** Ia dan "Cum Laude" menandai
  jenjang yang sama; yang memilih bunyi mana yang dipakai adalah fakultas,
  bukan angka. Selama pilihannya dihitung dari IPK, tidak ada batas mana pun
  yang dapat memisahkan keduanya, dan admin tidak punya cara menuliskan yang
  benar tanpa menyunting tata letak dengan tangan.

---

## Yang berubah

### 1. Empat predikat, dan hanya empat

```ts
export const PREDIKAT = ["Cum Laude", "Dengan Pujian", "Sangat Memuaskan", "Memuaskan"];
```

Daftar ini yang mengisi kolom pilihan di layar, dan daftar ini pula yang
menyaring apa yang boleh tercetak. Kolomnya memang berupa pilihan, tetapi yang
sampai ke server hanyalah teks — `bersihkanMeta` meloloskan isi apa pun untuk
kunci yang dikenal — jadi penyaringnya dipasang di `predikatTercetak()` juga.
Isian di luar daftar tidak ikut tercetak; ia jatuh kembali ke usulan IPK.
Istilah lama seperti "Lulus" dan "Very Satisfactory" tidak bisa hidup kembali
lewat arsip lama atau lewat kiriman yang dibuat tangan.

Tanda `-` bukan predikat kelima; ia penampung untuk lembar yang memang belum
berisi apa pun (belum ada nilai dan judul skripsi masih kosong).

### 2. IPK mengusulkan, admin yang memutuskan

Kolom **Predikat kelulusan** ditambahkan pada Biodata, tepat di bawah Tanggal
yudisium. Bawaannya "Otomatis dari IPK", dan usulannya ikut angka:

```
IPK >= 3,51   Cum Laude
IPK >= 3,01   Sangat Memuaskan
sisanya       Memuaskan
lembar kosong -
```

Batas itu mengikuti berkas yang sudah ada: lembar kelulusan PDDIKTI berbunyi
"CUM LAUDE" pada IPK 3,74, dan transkrip contoh dari KUI berbunyi "Sangat
Memuaskan" pada IPK 3,43.

"Dengan Pujian" sengaja tidak pernah lahir dari angka. Fakultas yang memakai
istilah itu tinggal memilihnya sendiri di kolom yang sama, dan pilihannya
mengalahkan usulan IPK.

Pilihan admin ikut tersimpan ke arsip dan ikut ke kolom ringkasan, jadi daftar
arsip tidak pernah berbunyi lain dari transkrip yang dicetak dari baris yang
sama. Arsip lama yang belum punya kolom ini tetap mengikuti usulan IPK saat
dicetak ulang.

Satu rem dipasang seperti pada Konsentrasi: **mengimpor berkas Excel
mengembalikan kolom ini ke "Otomatis"**. Kalau tidak, predikat yang tadi
dipilih tangan untuk satu mahasiswa akan tercetak pada mahasiswa berikutnya
tanpa ada yang menyentuhnya.

### 3. Predikat tidak lagi diterjemahkan

`PREDIKAT_EN` dihapus. Keempat istilah dicetak apa adanya pada transkrip
Indonesia maupun Inggris — begitu pula bunyinya pada transkrip KUI, yang
mencetak satu istilah, bukan pasangan "Indonesia / Inggris" seperti jenjang
dan program studi.

Label kolomnya tidak berubah: transkrip Inggris tetap berkepala
"Predikat Kelulusan / Graduation Honors".

### 4. Lembar kelulusan PDDIKTI tidak disentuh

Predikat di sana adalah isian yang dibaca dari berkas fakultas, bukan angka
yang dihitung sistem. Yang ditulis fakultas tetap yang dikirim.

---

## Yang diperiksa

`npx tsx uji-arsip-transkrip.ts` — **80 periksa lulus** (dari 64 pada v35).
Yang baru:

- **Batas usulan**: 3,51 dan 4,00 menghasilkan "Cum Laude"; 3,50, 3,43, dan
  3,01 menghasilkan "Sangat Memuaskan"; 3,00, 2,76, dan 2,50 menghasilkan
  "Memuaskan"; lembar kosong menghasilkan "-".
- **Sapuan seluruh rentang IPK** dari 0,00 sampai 4,00 selangkah 0,01, dengan
  dan tanpa judul skripsi: tidak ada satu batas pun yang dapat melahirkan
  istilah di luar daftar, dan "Dengan Pujian" tidak pernah lahir dari angka.
- **Pilihan admin**: mengalahkan usulan IPK ke atas maupun ke bawah, tidak
  membedakan huruf besar kecil atau spasi berlebih, dan kolom kosong tetap
  jatuh ke usulan IPK.
- **Penyaring**: "Lulus", "Very Satisfactory", dan isian bebas berisi tag HTML
  diabaikan, bukan dicetak.
- **Ringkasan arsip** memakai pilihan admin yang sama dengan yang tercetak.

`npx tsx uji-transkrip.ts` (320 periksa) dan `npx tsx uji-kelulusan-pddikti.ts`
(62 periksa) tetap hijau, `npm run lint`, `npm run typecheck`, dan
`npm run build` bersih.

`npx tsx uji-tanda-pisah.ts` masih gagal pada `src/app/dashboard/outreach-panel.tsx`
persis seperti sebelum perubahan ini; berkas itu tidak tersentuh di sini.

---

## Berkas yang berubah

| Berkas | Isi |
| --- | --- |
| `src/lib/arsip-transkrip.ts` | `PREDIKAT`, `PREDIKAT_KOSONG`, `predikatKelulusan()` tiga jenjang, `predikatTercetak()`, ringkasan arsip ikut pilihan admin |
| `src/app/dashboard/template/template-app.tsx` | `PREDIKAT_EN` dihapus, kolom pilihan Predikat kelulusan pada Biodata, impor Excel mengembalikannya ke "Otomatis" |
| `uji-arsip-transkrip.ts` | 16 periksa baru pada predikat |
