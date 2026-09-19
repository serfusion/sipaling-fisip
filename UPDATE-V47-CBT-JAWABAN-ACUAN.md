# UPDATE v47: CBT, jawaban acuan pengajar dan tiga perbaikan tampilan

## 1. Tanda pisah panjang dibuang dari teks yang tampil

Karakter `—` tidak ada pada papan ketik siapa pun di sini, tidak seragam
antarperamban, dan pada layar sempit ia sering memutus kalimat di tempat yang
salah.

Enam puluh baris teks yang dibaca pengguna dibersihkan: pesan galat jalur API,
label tombol, isian, lembar cetak, isi surat laporan nilai, dan perintah yang
dikirim ke model penilai. Sebagian besar menjadi koma, karena pemisah gagasan
dalam kalimat Indonesia memang koma. Yang berupa penanda sel kosong menjadi
tanda hubung biasa, dan yang berupa label berpasangan menjadi titik dua:
`Kriteria 3: Ketepatan Konsep`, bukan `Kriteria 3 — Ketepatan Konsep`.

**Komentar di dalam kode tidak disentuh.** Ia tidak pernah dibaca pengguna, dan
memaksa penulisnya membuang tanda pisah dari penjelasan panjang hanya membuat
penjelasannya lebih sulit dibaca tanpa menguntungkan siapa pun. Penjaganya,
`uji-tanda-pisah.ts`, memang sudah memisahkan keduanya sejak awal, dan uji itu
**sudah gagal sebelum pekerjaan ini**. Sekarang ia lulus.

**Satu pengecualian, dan ia sudah tercatat di dalam berkas ujinya sendiri:**
`Abstract—` dan `Keywords—` pada alih bahasa naskah. Keduanya bentuk baku IEEE
untuk naskah berbahasa Inggris, dan yang menghasilkannya menulis **dokumen**,
bukan halaman. Menggantinya berarti naskah yang tidak sesuai templat jurnalnya.
Bila Anda ingin ini pun dibuang, katakan saja.

## 2. Susunan blok pengaturan ujian dirapikan

Pengaturan ujian memuat lima kelompok berurutan yang mengalir tanpa pemisah
apa pun: setelan umum, perangkat yang dikunci, mode pengawasan, saklar kamera,
dan penilaian. Judul tiap kelompok karena itu terbaca seperti keterangan
setelan di atasnya, bukan sebagai kepala kelompok baru.

Kelimanya kini dipisah satu garis tipis lewat penanda bersama `cbt-grup`.
Penanda bersama, bukan daftar pasangan kelas yang saling bertetangga: pasangan
semacam itu harus ditambah tiap kali ada kelompok baru, dan yang lupa
menambahkannya tidak melihat apa pun rusak, hanya satu garis yang diam-diam
hilang.

Dua hal lain ikut dibetulkan:

- **Jarak antarsaklar dibuat tetap.** Dahulu tiap saklar membawa margin sendiri
  yang bertemu margin tetangganya, jadi jaraknya berubah-ubah menurut ada
  tidaknya keterangan kecil di bawah masing-masing.
- **Tanda persen pada ambang kemiripan.** Dahulu label, kotak isian, dan tanda
  persennya ditumpuk dalam satu kolom, sehingga `%` jatuh sendirian di baris di
  bawah kotaknya dan terbaca seperti isian ketiga yang kosong. Sekarang kotak
  dan tandanya duduk di satu baris. Keduanya juga bertakuk ke dalam, karena
  hanya berlaku bila saklar di atasnya menyala.

## 3. Jam yang sudah terlewat tidak bisa dipilih lagi

Pemilih jadwal menawarkan dua puluh empat jam penuh betapa pun sudah lewat
tengah hari, jadi ujian dapat dijadwalkan mulai jam 07.00 pada hari yang jam
tujuhnya sudah berlalu empat jam lalu. Penolakannya baru datang dari server,
sesudah tombolnya ditekan.

Sekarang jam dan menit yang sudah berlalu digambar abu-abu dan tidak dapat
dipilih, dan kalender tanggalnya menutup hari-hari sebelum hari ini.

Tiga hal yang menentukan di sini:

- **Yang dibandingkan zona ujian, bukan zona perangkat.** Laptop yang jamnya
  disetel WITA tidak boleh mengabukan jam yang di Jakarta masih di depan.
- **Diperbarui tiap tiga puluh detik** selama panel terbuka, sehingga menit
  yang baru saja lewat ikut tertutup tanpa halaman dimuat ulang.
- **Pilihan yang terlewat diabukan, bukan dibuang.** Jadwal lama yang jamnya
  sudah berlalu tetap terbaca sebagaimana tersimpan, dan diberi keterangan
  `(sudah terlewat)` supaya bedanya terlihat. Membuangnya akan membuat pemilih
  yang sedang menampilkan "08" mendadak kosong, dan jadwal yang tadinya terbaca
  berubah menjadi tidak terisi tanpa ada yang menyentuhnya.

## 4. Penilaian esai dari jawaban acuan pengajar

Ini bagian terbesar update ini.

### Kenapa rubrik saja tidak cukup

Rubrik mengukur **bentuk** jawaban: berapa panjang, berapa tersusun, berapa
istilah soal yang muncul. Tidak satu pun di antaranya tahu apakah isinya benar,
dan itulah batas yang tidak dapat dilewati rubrik betapa pun rapi deskriptornya
disusun. Jawaban dua ratus kata yang melantur mendapat angka yang sama dengan
jawaban dua ratus kata yang tepat.

### Caranya

Pengajar menuliskan **jawaban acuan**, lalu jawaban peserta diukur kedekatannya
dengan acuan itu memakai **cosine similarity atas bobot kata TF-IDF**.

```
bobot(kata) = (1 + log tf) x ( log((N + 1) / (df + 1)) + 1 )

tf = berapa kali kata itu muncul di dalam satu jawaban
df = berapa jawaban di seluruh kelas yang memuat kata itu
N  = jumlah jawaban yang dibandingkan, termasuk acuan pengajar
```

Bagian `df` itulah yang menentukan segalanya. Pertanyaan "jelaskan manfaat
energi terbarukan" membuat kata "energi", "terbarukan", dan "manfaat" muncul di
hampir setiap lembar. Tanpa pembobotan, tiga puluh jawaban akan terlihat mirip
acuan hanya karena semuanya menjawab pertanyaan yang sama, dan yang menyalin
pertanyaannya kembali akan bernilai setinggi yang benar-benar menguraikan.

Mesin hitungnya bukan mesin baru: `hitungDf`, `bobotTfIdf`, dan `cosine`
dipakai apa adanya dari `src/lib/mirip-jawaban.ts`, tempat ketiganya sudah
bekerja membandingkan peserta dengan peserta. Satu mesin, dua kegunaan.

**Seluruhnya berjalan di dalam server portal ini.** Tanpa model bahasa, tanpa
kunci API, tanpa biaya per jawaban, dan hasilnya sama persis tiap kali
dijalankan pada teks yang sama.

### Terukur pada korpus uji

| Jawaban | Mirip | Nilai |
|---|---|---|
| Parafrase tepat, kalimat sendiri | 55% | **80** |
| Menyalin pertanyaannya, dipanjangkan | 10% | **0** |
| Panjang, tersusun, di luar topik | 1% | **0** |
| Menyalin acuan kata demi kata | 100% | **100** |
| Di bawah delapan kata | tidak dinilai | diserahkan ke pengajar |

Baris ketiga yang paling penting: jawaban itu **yang terpanjang** di antara
semuanya, dan tetap bernilai nol. Panjang tidak lagi menolong.

### Nilai penuh tidak menunggu kemiripan 100%

Kemiripan 100% hanya dicapai jawaban yang menyalin acuan kata demi kata.
Menuntutnya berarti memberi nilai tertinggi kepada yang menghafal dan menghukum
yang memahami lalu menuliskannya dengan kalimat sendiri, padahal yang kedua
itulah yang sedang diuji.

Karena itu ada dua ambang yang dapat diatur per acuan: di bawah `ambangNol`
bernilai 0, di atas `ambangPenuh` bernilai 100, di antaranya naik lurus.
Bawaannya **15 dan 65**.

### Alurnya: unduh, isi, unggah

Menulis jawaban acuan adalah pekerjaan mengarang, bukan mengisi borang. Satu
butir memakan dua sampai empat kalimat yang harus dipikirkan, dan dua puluh
butir berarti satu jam mengetik. Menuntutnya dikerjakan di dalam kotak isian di
halaman web berarti menuntut satu jam tanpa boleh menutup tab dan dengan risiko
sambungan putus di butir ketujuh belas. Yang terjadi kemudian bukan pengajar
mengisinya dengan susah payah, melainkan pengajar tidak mengisinya sama sekali.

Karena itu alurnya mengikuti impor soal, sampai ke letak tombolnya. **Dua
bentuk template:**

- **Excel** untuk butir yang banyak dan jawabannya pendek.
- **Word** untuk jawaban berupa paragraf. Sel Excel dapat memuat paragraf,
  tetapi mengetik paragraf di dalam sel menyiksa, dan yang tersiksa akan
  memendekkan jawabannya sampai muat. Jawaban acuan yang dipendekkan supaya
  muat adalah jawaban acuan yang lebih buruk, dan seluruh penilaian bergantung
  padanya.

Berkasnya diurai **di peramban**, sama seperti pengimpor soal. Yang tidak
singgah di server tidak dapat tertinggal di sana.

Kolom dicari dari **namanya**, bukan urutannya, sehingga berkas yang disisipi
kolom catatan sendiri tetap terbaca. Kolom bobot yang dikosongkan **seluruhnya**
dibagi rata; yang terisi sebagian dikeluhkan terbuka, karena bobot yang ditebak
diam-diam adalah nilai yang berubah tanpa ada yang memutuskannya.

### Istilah wajib

Ada jawaban yang tidak boleh dinilai benar tanpa menyebut satu istilah
tertentu, dan cosine tidak dapat menjamin itu. Kolom **ISTILAH WAJIB**
menjaganya. Yang tidak menyebutnya kehilangan nilai menurut bagiannya, bukan
jatuh ke nol: dari tiga istilah yang diminta, peserta yang menyebut dua di
antaranya memang tidak lengkap, tetapi ia jelas bukan peserta yang tidak
menyebut satu pun.

### Satu hal yang dikatakan terus terang

Bobot kata TF-IDF bergantung pada seluruh lembar yang dibandingkan. Penilaian
yang berjalan sendiri di tengah ujian karena itu memakai korpus yang belum
lengkap, dan dua jawaban yang sama persis dapat bernilai sedikit berbeda bila
dinilai pada putaran yang berbeda.

Itu tidak disembunyikan. Ketika penilaian berjalan sementara masih ada yang
mengerjakan, pesannya menyebut berapa peserta yang belum mengumpulkan dan
menganjurkan menilai ulang. Tombol **"Nilai ulang sekelas dengan acuan"**
menyamakan semuanya dengan satu korpus yang sama. Nilai yang bergantung pada
siapa mengumpulkan lebih dulu adalah nilai yang tidak dapat dipertahankan di
hadapan yang menggugatnya.

### Rubrik tidak dihapus

Menu "Rubrik penilaian" menjadi **"Penilaian esai"** dan memuat dua cara,
dengan jawaban acuan lebih dulu sebagai bawaannya. Keduanya boleh menyala
bersama pada satu ujian: acuan mengukur isi, rubrik mengukur bentuk, dan lembar
yang kedua pembacaannya berselisih adalah yang paling perlu dibaca sendiri.

Rubrik tetap ada karena ujian yang sudah dinilai dengannya masih menyimpan skor
per kriterianya, dan lembar penilaiannya harus tetap dapat dibuka bertahun-tahun
kemudian ketika ada yang menggugat nilainya. Menghapus rubrik berarti menghapus
jawaban atas gugatan itu.

### Penilaian yang berjalan sendiri

Papan pantau kini mendahulukan acuan bila ujiannya punya, dan jatuh ke jalur
lokal bila tidak. Keduanya sama-sama gratis dan sama-sama berjalan di dalam
server, jadi tidak ada alasan memakai yang lebih lemah ketika yang lebih kuat
sudah dipasang.

Soal yang tidak punya butir acuan **dilewati, bukan dinolkan**: yang terjadi
bukan peserta gagal menjawabnya, melainkan acuannya belum ditulis.

---

## Yang perlu dijalankan

`supabase-update-v47-rubrik-acuan.sql` di Supabase, SQL Editor, Run. Aman
dijalankan berulang kali.

**Tidak ada yang berubah untuk ujian yang sudah ada.** Satu tabel baru yang
boleh kosong selamanya (`cbt_answer_keys`), satu kolom baru yang bawaannya NULL
(`cbt_exams.answer_key_id`), dan tidak ada kunci API, bucket, atau environment
baru. Ujian yang berjalan hari ini berjalan sama persis sesudah ini dijalankan.

## Berkas yang berubah

| Berkas | Isi |
|---|---|
| `src/lib/nilai-acuan.ts` | Mesin TF-IDF, kurva dua ambang, istilah wajib |
| `src/lib/template-acuan.ts` | Pembuat dan pembaca template Excel dan Word |
| `src/app/api/cbt/acuan/route.ts` | Jalur CRUD pustaka acuan |
| `src/lib/cbt-store.ts` | `acuanUjian()` |
| `src/lib/nilai-otomatis.ts` | `kerjakanPenilaianAcuan()` |
| `src/app/api/cbt/penilaian/route.ts` | Aksi `acuan` |
| `src/app/api/cbt/ujian/route.ts` | Medan `answerKeyId` |
| `src/app/dashboard/cbt-v1.tsx` | `PanelAcuan`, `PanelPenilaianEsai` |
| `src/app/dashboard/cbt-panel.tsx` | Pemilih acuan, jam terlewat, penanda kelompok |
| `src/lib/waktu-indonesia.ts` | `sekarangUjian()`, `tanggalSudahLewat()` |
| `src/db/schema.ts` | Tabel `cbtAnswerKeys`, kolom `answerKeyId` |
| `src/app/globals.css` | Panel acuan, pemilih sejajar, pemisah kelompok |
| `uji-nilai-acuan.ts` | 75 pemeriksaan baru |

## Uji

```
npx tsx uji-nilai-acuan.ts     75 periksa lulus
npx tsx uji-tanda-pisah.ts      6 periksa lulus atas 271 berkas sumber
npx tsx uji-waktu-ujian.ts
npx tsc --noEmit
npx next build
```

Seluruh berkas `uji-*.ts` lain juga dijalankan dan lulus, kecuali
`uji-kosakata-cbt.ts` yang **sudah gagal sejak sebelum pekerjaan ini** karena
kosakata lama di berkas lain. Kode baru pada update ini tidak menambah satu pun
temuan di sana.
