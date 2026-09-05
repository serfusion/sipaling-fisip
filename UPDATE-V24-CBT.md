# v24: CBT — Ujian Berbasis Komputer

MVP sesuai bagian 23 blueprint. Mahasiswa **tidak punya akun**; identitasnya
melekat pada attempt ujian, bukan pada tabel pengguna.

---

## Pembagian wewenang

Ini yang Anda minta khusus, dan ia ditegakkan di tiga lapis — menu, layar, dan
server:

| Siapa | Boleh |
| --- | --- |
| **Dosen** | membuat ujian, menyusun soal, menentukan **jumlah soal** dan **durasi**, memantau, mengoreksi essay, mengunduh nilai |
| **Admin & Super Admin** | semua yang di atas, **ditambah mengaktifkan ujian dan menyetel jamnya** |
| **Admin bagian** (umum, akademik, prodi, PDDIKTI, perpustakaan, laboratorium) | tidak melihat menu ini sama sekali |

Dosen tidak melihat tombol aktivasi. Layarnya menampilkan: *"Menunggu Super
Admin atau Admin mengaktifkan. Anda tetap dapat menyusun soalnya sekarang."*

## Jam 10 berarti jam 10

Admin menyetel jam mulai dan jam selesai, lalu menekan **Aktifkan**. Sesudah
itu **tidak ada tombol yang perlu ditekan siapa pun** pada pukul sepuluh —
ujiannya terbuka sendiri, karena statusnya dihitung dari jam server setiap kali
ada yang membukanya.

Orang yang harus menekan tombol tepat pada satu detik tertentu adalah titik
gagal yang paling sering benar-benar terjadi.

Aktivasi menolak tiga hal, sebelum mahasiswa telanjur duduk di depan layar:

- bank soal masih kosong
- ujian menuntut lebih banyak soal daripada isi banknya
- jendela ujian lebih pendek daripada durasinya (jendela 30 menit untuk ujian
  60 menit berarti setiap mahasiswa terpotong)

---

## Mahasiswa: `/ujian`

Terang, bukan gelap — mengikuti bentuk yang sudah dikenal mahasiswa dari
aplikasi ujian lain: soal di kiri, sisa waktu dan palet nomor di kanan,
deretan tombol di dasar kolom soal, legenda di bawahnya.

Empat layar, dan tidak lebih.

```
kode ujian → nama + NIM + kode pengawas → mengerjakan → selesai
```

- **Jam mundur selalu terlihat** di kepala halaman, dan berubah merah lima
  menit terakhir.
- **Auto-save** berjalan sendiri; penandanya tenang ("✓ Tersimpan"), dan
  kegagalan jaringan ditulis "Menyimpan ulang…" berwarna kuning — bukan galat
  merah yang membuat orang berhenti mengerjakan.
- **Palet nomor soal** dengan lima keadaan yang artinya ditulis pada legenda,
  bukan hanya diwarnai: biru sedang dibuka, hijau sudah dijawab, jingga dibuka
  tetapi masih kosong, merah ditandai untuk ditinjau, abu belum dibuka.
- **Tandai untuk ditinjau** — penandanya disimpan di server, jadi tidak hilang
  ketika halaman dimuat ulang.
- Di ponsel palet itu berpindah ke panel yang dibuka satu ketukan; menggulir
  jauh untuk mencari nomor soal berarti kehilangan tempat pada soal yang
  sedang dibaca.
- **Waktu habis → dikumpulkan sendiri.**
- Ponsel mati atau tab tertutup? Buka lagi `/ujian`, lembar yang sama kembali
  dengan sisa waktu yang terus berjalan.

---

## Yang dijaga, dan kenapa

**Kunci jawaban tidak pernah ikut ke peramban.** Dibuktikan pada uji sungguhan:
yang diterima mahasiswa hanya `id, jenis, pertanyaan, pilihan, bobot`. Tabel
`cbt_questions` juga RLS tanpa policy, jadi kolom `answer_key` tidak dapat
diambil langsung dari peramban.

**Waktu dihitung server.** Batasnya disimpan di `deadline_at`; jam di layar
hanya penunjuk, dan tiap penyimpanan jawaban mengembalikan sisa yang sebenarnya
sehingga jam layar ikut dikoreksi. Memutar mundur jam ponsel tidak menambah
waktu sedetik pun.

**Pilihan yang diacak dikembalikan dulu sebelum dinilai.** Ini yang paling
mudah salah. Pada uji sungguhan, kunci "McCombs & Shaw" ada di indeks 0 pada
bank tetapi muncul di indeks **2** pada layar; mahasiswa menjawab "2" dan
dinilai **benar**. Salah menanganinya berarti menyalahkan seluruh mahasiswa
yang sebenarnya menjawab benar.

**Essay yang belum dikoreksi bukan jawaban salah.** Ia bernilai `null`, bukan
`false`. Menghitungnya salah membuat nilai sementara jauh lebih rendah daripada
yang sebenarnya, dan mahasiswanya panik atas sesuatu yang belum terjadi.

**Nilai adalah persentase bobot, bukan jumlah soal.** Essay 20 poin dan pilihan
ganda 5 poin tidak dihitung sederajat.

**Soal dikunci selama ujian berlangsung.** Mengubah durasi atau jumlah soal di
tengah jalan berarti sebagian mahasiswa mengerjakan ujian yang berbeda dari
sebagian yang lain.

---

## Anti-cheating yang terpasang

Acak soal · acak pilihan · kode ujian · batas percobaan (ditegakkan indeks unik
basis data, bukan hanya pemeriksaan kode) · pencatat pindah tab · peringatan
sebelum menutup halaman · auto-save · kunci sesi acak.

Pelanggaran tampil di kolom Catatan pada monitoring: *"pindah tab 3×"*.

---

## Analisis

Rata-rata, median, tertinggi, terendah, persen lulus. Per soal: persen benar,
dan soal di bawah 30% ditandai **⚠ perlu ditinjau** — bisa jadi memang sulit,
bisa jadi kuncinya yang salah, dan yang terakhir itu yang paling mahal bila
tidak ketahuan.

Nilai diunduh sebagai CSV (dengan BOM, jadi Excel membaca huruf beraksen
dengan benar).

---

## Yang perlu Anda lakukan

```
supabase-update-v24-cbt.sql
```

Lalu buka dashboard → **Ujian Online (CBT)**.

---

## Membuat soal: unduh template, isi, unggah

Menambah soal satu per satu lewat formulir tetap ada, tetapi bukan lagi
satu-satunya jalan. Empat puluh soal lewat formulir berarti empat puluh kali
mengisi, menekan, dan menunggu.

**Dashboard → CBT → buka ujiannya → Bank soal → ⇩ Template Excel / ⇩ Template Word.**

Isi di komputer sendiri, lalu **⇧ Unggah soal**. Berkasnya diurai **di
peramban Anda** — berkas soal memuat kunci jawaban, dan tidak ada alasan ia
singgah di server sebelum Anda sendiri melihat hasil bacaannya.

### Excel

Sheet **Soal**, dengan kolom:

```
NO | JENIS | PERTANYAAN | PILIHAN A..E | KUNCI | BOBOT | MATERI | TINGKAT | PEMBAHASAN
```

- `JENIS` — PG, BENAR-SALAH, ISIAN, atau ESSAY. Kosong dianggap PG.
- `KUNCI` — huruf (A/B/C/D/E) untuk PG, BENAR/SALAH, teks untuk isian
  (beberapa kemungkinan dipisah `|`), kosong untuk essay.
- Urutan kolom **boleh digeser** dan kolom yang tidak dipakai boleh dihapus —
  yang dicari sistem nama kolomnya, bukan letaknya. Berkas yang bergantung
  pada urutan akan rusak pada dokumen kedua yang diunggah orang.

Sheet **Petunjuk** ikut serta, dan baris contohnya sudah benar — template
kosong melulu membuat orang menebak bentuknya, dan tebakannya ditolak.

### Word

```
1. Siapa perumus teori agenda setting?
A. McCombs & Shaw
B. Lasswell
KUNCI: A
BOBOT: 5
```

Nomor bergaya `1.`, `1)`, atau `Soal 1.` sama-sama terbaca. Pertanyaan dan
pembahasan yang memanjang ke baris berikutnya ikut tersambung. `JENIS: ISIAN`
atau `JENIS: ESSAY` untuk soal tanpa pilihan.

### Satu baris rusak tidak menggagalkan seluruh berkas

Yang sah tetap masuk; yang bermasalah ditampilkan beserta **nomor barisnya**
dan alasannya — *"Baris 9: kunci "Z" menunjuk pilihan yang tidak ada"*. Dosen
memperbaiki tiga baris, bukan mengunggah ulang empat puluh soal.

Sebelum masuk ke bank, lima soal pertama ditampilkan lengkap dengan kuncinya
untuk dilihat dulu.

---

## Bagikan: tautan dan kode

Begitu bank soalnya berisi, muncul kartu **Bagikan ke mahasiswa**:

- **Tautan ujian** — `https://www.sipalingfisip.web.id/ujian?kode=XXXXXX`.
  Mahasiswa yang menekannya langsung melihat ujiannya; kodenya terisi sendiri.
- **Kode ujian** — untuk yang lebih suka mengetik manual.
- **Kode pengawas** — bila ujiannya memakai kode tambahan.
- **📋 Salin pesan siap tempel untuk grup** — satu tombol yang menyalin pesan
  lengkap: judul, mata kuliah, tautan, kode, jumlah soal, durasi, jam buka dan
  tutup. Menyalin tautan lalu mengetik sendiri jam dan jumlah soalnya di grup
  adalah pekerjaan yang paling sering salah ketik.

---

## Yang belum dibuat

Blueprint bagian 23 menyarankan menahan diri, dan saya menahannya:

- Import soal dari Excel
- Blueprint ujian (komposisi mudah/sedang/sulit per materi)
- Matching, pilihan ganda kompleks, gambar/audio pada soal
- Difficulty & discrimination index penuh
- AI question generator
- Proctoring webcam
- Bank soal lintas ujian (sekarang bank menempel pada ujiannya)

Semuanya dapat ditambahkan di atas yang sudah ada tanpa membongkar tabelnya.

---

## Yang dijaga uji otomatis

`npx tsx uji-impor-soal.ts` — **76 pemeriksaan** atas pembaca berkas soal.
Yang dijaga terutama **kunci jawaban**: huruf, huruf kecil, `C.`, `D)`, dan
teks jawaban yang disalin utuh semuanya diterima; yang tidak menunjuk ke mana
pun ditolak dengan alasannya. Termasuk satu pemeriksaan yang wajib ada:
**template yang kami sediakan sendiri harus lolos pembacanya sendiri**, dan
soal hasilnya benar-benar dapat dinilai mesin penilai.

`npx tsx uji-cbt.ts` — **83 pemeriksaan** atas aturan yang menentukan nasib
nilai: jam buka, batas waktu, pengacakan yang dapat diulang, penilaian
termasuk pemetaan pilihan teracak, identitas tanpa login, dan analisis.

Alurnya juga dijalankan **sungguhan** — Postgres asli, HTTP asli:

- masuk tanpa kode → ditolak; kode salah → ditolak; NIM 2 angka → ditolak
- masuk benar → 4 soal dari bank 5 soal, tanpa satu pun kolom rahasia
- jawab → auto-save → kumpulkan → **nilai 42,9** (15 dari 35 poin, tepat)
- NIM yang sama masuk lagi → ditolak, satu percobaan
- jaringan putus → `lanjut` mengembalikan **urutan soal yang sama persis**
- waktu habis → jawaban baru ditolak, yang tersimpan tetap dihitung, status
  menjadi `waktu_habis`
- kunci sesi palsu → 401; soal di luar lembarnya → ditolak

Layar mahasiswanya dijalankan di Chromium pada 1440px dan 390px: jam mundur
berjalan, palet menunjukkan `isi, isi, isi, isi, isi, isi, tinjau, kini,
belum, belum` persis sesuai yang dikerjakan, penanda "✓ Tersimpan" hijau, dan
tidak ada gulir mendatar di kedua lebar.

Berkas `.docx` yang dirakit sendiri dibuka ulang dan diperiksa: zip-nya sah,
ketiga XML-nya terurai tanpa galat, dan `file` mengenalinya sebagai
**Microsoft Word 2007+**.

### Satu bug tertangkap saat pengujian ini

Indeks unik `(attempt_id, question_id)` pada `cbt_answers` semula **hanya ada
di berkas SQL migrasi**, tidak di skema Drizzle. Basis data yang disiapkan
dari skema saja karena itu berdiri tanpa indeksnya — dan auto-save yang
memakai `on conflict do update` **ditolak diam-diam**: layar mahasiswa tetap
hijau sementara servernya tidak menyimpan apa pun.

Indeksnya sekarang dideklarasikan di skema, jadi kedua jalur penyiapan
menghasilkan basis data yang sama. Dan sebagai jaring kedua, menekan
"Kumpulkan" ketika masih ada jawaban yang belum sampai ke server tidak lagi
lolos diam-diam — mahasiswanya diberi tahu dan diminta menunggu sebentar.
