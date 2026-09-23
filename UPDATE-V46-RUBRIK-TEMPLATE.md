# UPDATE v46 — Rubrik dapat diunggah dari Excel dan Word

## Yang diminta

> Pada rubrik saya mau bisa unggah template juga.

## Kenapa ini memang kurang

Sebelum v46, satu rubrik hanya dapat lahir dengan dua cara: menyalin salah satu
rubrik siap pakai, atau mengisi formulir dari nol. Formulir itu berarti — untuk
rubrik lima kriteria berskala 1–4 — satu nama, satu keterangan, lima nama
kriteria, lima bobot, dan **dua puluh kotak deskriptor**.

Dan hampir selalu, pekerjaan itu sudah selesai di tempat lain: rubrik adalah
lampiran RPS, sudah diketik dosen di Word atau Excel jauh sebelum ia membuka
portal. Yang diminta portal karena itu bukan menyusun rubrik, melainkan
**mengetik ulang rubrik yang sudah ada**.

Soal ujian sudah punya jalan keluarnya sejak lama (unduh template → isi →
unggah). Rubrik belum.

---

## Yang sekarang bisa

Pada **Dashboard CBT → Rubrik** muncul satu panel baru: *"Susun rubrik lewat
Excel atau Word"*, dengan tiga tombol.

```
  ⇩ Template Excel (.xlsx)     ⇩ Template Word (.docx)     ⇧ Unggah rubrik
```

Dan pada tiap rubrik yang sudah tersimpan, satu tombol tambahan: **⇩ Excel**,
yang menurunkannya sebagai template yang sama — boleh disunting di komputer,
dikirim ke rekan pengajar lewat surel, lalu diunggah kembali.

Alurnya:

```
  Template ──unduh──▶ diisi di komputer ──unggah──▶ FORMULIR PENYUSUN ──periksa──▶ Simpan
                                                    (belum tersimpan)
```

### Yang diunggah TIDAK langsung tersimpan

Ini keputusan yang paling menentukan pada seluruh perubahan ini. Rubrik hasil
unggahan mendarat di **formulir penyusun** — terisi, tetapi belum tersimpan —
dengan seluruh pemeriksaan yang sudah ada tetap berlaku: jumlah bobot harus
100%, nama tidak boleh kosong, level 3–6 tingkat.

Alasannya sama dengan alasan rubrik ada sejak awal: yang menandatangani nilai
tetap dosen. Rubrik yang masuk tanpa dibaca adalah rubrik yang dipakai menilai
empat puluh lembar jawaban sebelum seseorang menyadari bobotnya tertukar.

Rubrik unggahan juga **selalu masuk sebagai rubrik baru**, termasuk bila namanya
sama dengan yang sudah ada. Menimpa rubrik yang sudah dipakai ujian hanya karena
namanya cocok akan mengubah arti nilai yang sudah keluar, tanpa seorang pun
memintanya.

---

## Bentuk berkasnya

### Excel — tiga lembar

| Lembar | Isinya |
|--------|--------|
| **Rubrik** | yang diisi. Kosong dan sudah bergaris. **Inilah lembar yang dibaca.** |
| **Contoh** | satu rubrik yang sudah jadi, untuk dilihat. Tidak dibaca saat diunggah. |
| **Petunjuk** | sebelas butir aturan pengisian. |

Lembar "Rubrik":

```
 1 | TEMPLATE RUBRIK PENILAIAN ESAI
 2 | Isi lembar ini. Lihat lembar "Contoh" bila ragu bentuknya…
 3 | NAMA RUBRIK      | …
 4 | KETERANGAN       | …
 5 | LEVEL TERTINGGI  | …            ← boleh dikosongkan
 6 |
 7 | KRITERIA | BOBOT % | LEVEL 1 | LEVEL 2 | LEVEL 3 | LEVEL 4 | LEVEL 5 | LEVEL 6
 8 |          |         |         |         |         |         |         |
```

Bentuknya persis rubrik di atas kertas: satu kriteria satu baris, levelnya
menyamping. Itu bukan kebetulan — yang paling sering dimiliki dosen adalah tabel
dengan bentuk ini, sehingga isinya dapat ditempel apa adanya.

**Contohnya sengaja ditaruh di lembar terpisah**, tidak di dalam tabel isian.
Pada template soal, contoh yang lupa dihapus hanya menjadi satu soal berlebih
yang langsung terlihat. Rubrik lain soal: satu berkas adalah SATU rubrik, jadi
contoh yang lupa dihapus tidak berdiri sebagai rubrik lain melainkan **bercampur
ke dalam rubrik yang sedang disusun** — "Ketepatan Konsep" milik contoh duduk di
antara kriteria dosen sendiri, dengan bobot yang ikut menggeser jumlahnya.

### Word — berlabel per baris

```
NAMA RUBRIK: Rubrik Presentasi
KETERANGAN: Untuk penilaian presentasi kelompok
LEVEL TERTINGGI: 4

KRITERIA: Penguasaan Materi
BOBOT: 50
LEVEL 1: Tidak menguasai.
LEVEL 2: Menguasai sebagian,
  dan masih membaca catatan sepanjang waktu.
LEVEL 3: Menguasai.
LEVEL 4: Menguasai dan menjawab pertanyaan di luar naskah.
```

Berlabel, **bukan tabel** — dan itu bukan kemalasan. Pembaca `.docx` portal
mengambil teksnya saja; sebuah tabel Word kehilangan susunan kolomnya begitu
teksnya diambil, sehingga "mana kolom level 2" tidak lagi dapat dipastikan.
Rubrik yang salah kolom lebih berbahaya daripada rubrik yang ditolak: angkanya
tetap keluar, hanya artinya yang bergeser.

Karena itu rubrik yang sudah berbentuk tabel Word sebaiknya ditempel ke Excel —
dan penolakannya menyebutkan itu, bukan hanya "berkas tidak dapat dibaca".

Baris tanpa label dianggap **sambungan** deskriptor sebelumnya, supaya kalimat
panjang yang dipotong Enter tidak hilang separuh.

---

## Yang dimaafkan pembacanya

Berkas yang diisi manusia tidak pernah sekaku formatnya. Yang berikut ini tetap
terbaca:

| Yang ditulis dosen | Yang dibaca portal |
|--------------------|--------------------|
| `40%`, `40 %`, `40` | 40 |
| `0,3` atau `0.25` | 30% dan 25% |
| `keterangan:`, `Keterangan`, `DESKRIPSI` | keterangan rubrik |
| `KRITERIA 1:`, `kriteria:`, `Kriteria 1.` | awal satu kriteria |
| kolom digeser, kolom LEVEL 5–6 dihapus | dicari dari NAMA kolomnya, bukan letaknya |
| baris kosong di bawah tabel | dilewati tanpa keluhan |
| seluruh kolom BOBOT dikosongkan | dibagi rata (34/33/33) |
| `NAMA RUBRIK: Rubrik X` dalam satu sel | nama rubriknya |

Skalanya **dihitung dari kolom LEVEL yang terisi**: mengisi LEVEL 1–4 berarti
skala 1–4, dan kolom LEVEL 5–6 yang dibiarkan kosong tidak dihitung. Bila rubrik
memang berskala 1–5 tetapi deskriptor level 5 belum ditulis, baris `LEVEL
TERTINGGI` yang menentukan — dan baris itulah yang membuat unduhan rubrik
tersimpan dapat diunggah kembali tanpa skalanya menyusut sendiri.

### Kotak kuning "Yang perlu Anda periksa"

Apa pun yang **ditebak atau dibetulkan** pembacanya dilaporkan di atas formulir:

- bobot yang dibagi rata sendiri karena kolomnya kosong;
- jumlah bobot yang bukan 100% ("sekarang 95% — betulkan sebelum menyimpan");
- level yang dinaikkan ke 3 atau dipotong ke 6;
- kriteria ke-13 dan seterusnya yang tidak dipakai;
- nama rubrik yang tidak terbaca dari berkasnya.

Isian yang benar **tidak menghasilkan catatan apa pun**. Itu disengaja: kotak
peringatan yang muncul pada setiap unggahan yang berhasil adalah kotak yang
berhenti dibaca — termasuk ketika isinya hal yang sungguh perlu dibetulkan.

---

## Yang HARUS dijalankan admin

**Tidak ada.** Tidak ada perubahan basis data, tidak ada SQL, tidak ada
pengaturan Supabase. Seluruh pembacaan berkas terjadi **di peramban dosen** —
seperti impor soal dan impor mahasiswa — jadi tidak ada endpoint baru pun.

---

## Uji

```bash
npx tsx uji-rubrik-template.ts   # 84 pemeriksaan, tanpa basis data & tanpa peramban
npx tsx uji-template-soal.ts     # template soal tetap utuh sesudah perakit .docx dipisah
npx tsx uji-impor-soal.ts
npx tsx uji-cbt-v1.ts
npm run typecheck && npm run lint && npm run build
```

Yang paling menentukan pada `uji-rubrik-template.ts` adalah **putaran utuhnya**:

| Putaran | Yang dipastikan |
|---------|-----------------|
| template Excel → pembaca | lembar "Rubrik" masih kosong (contoh tidak bocor ke isian); lembar "Contoh" terbaca sempurna oleh pembaca portal sendiri, sampai ke tiap deskriptornya |
| rubrik tersimpan → Excel → pembaca | nama, keterangan, bobot, dan SELURUH deskriptor kembali utuh; skala 1–5 yang level 5-nya kosong tidak turun menjadi 1–4 |
| template Word → pembaca | naskah yang dirakit portal terbaca pembacanya sendiri, dan petunjuk di kepalanya tidak ikut menjadi kriteria |

Sisanya memeriksa kemurahan pembacanya (bobot `40%`, label huruf kecil, kolom
digeser, baris sambungan) dan penolakannya (lembar tanpa judul kolom, tabel
kosong, naskah Word tanpa label — yang penolakannya menyarankan Excel).

---

## Berkas yang berubah

| Berkas | Perubahan |
|--------|-----------|
| `src/lib/impor-rubrik.ts` | **baru** — pembaca rubrik dari Excel dan Word, beserta catatannya |
| `src/lib/template-rubrik.ts` | **baru** — perakit template Excel (3 lembar) dan Word, serta unduhan rubrik tersimpan |
| `src/lib/template-docx.ts` | **baru** — perakit `.docx` yang dipisah dari `template-soal.ts` supaya dipakai bersama |
| `src/lib/template-soal.ts` | memakai perakit `.docx` bersama itu; perilakunya tidak berubah |
| `src/app/dashboard/cbt-v1.tsx` | panel unduh/unggah template pada `PanelRubrik`, kotak catatan, tombol ⇩ Excel per rubrik |
| `src/app/globals.css` | gaya kotak catatan `.cbtv-catatan` |
| `uji-rubrik-template.ts` | **baru** |
