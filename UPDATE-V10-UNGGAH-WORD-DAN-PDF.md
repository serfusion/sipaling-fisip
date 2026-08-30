# UPDATE v10 — Cakrawala membaca Word dan PDF, tanpa halaman macet

Tidak ada SQL yang perlu dijalankan dan tidak ada variabel environment baru.
Yang bertambah hanya satu paket npm (`pdfjs-dist`); `npm install` sudah
mengurusnya, dan Vercel menjalankannya sendiri saat deploy.

---

## Masalahnya

Skripsi tidak pernah berbentuk `.txt`. Yang dipegang mahasiswa selalu Word
atau PDF. Sampai v9, kotak naskah Cakrawala hanya menerima teks polos, dan
di bawahnya tertulis apa adanya:

> Berkas .docx dan .pdf belum dapat dibaca. Salin isinya dari Word, lalu
> tempel di kotak ini.

Untuk naskah 200 halaman, "salin lalu tempel" bukan pekerjaan sepele: Word
kerap tersendat saat seluruh isinya diblok, dan yang tertempel sering
berantakan. Menu yang dijaga kode akses jadi terasa lebih merepotkan daripada
alat gratis mana pun.

Ada masalah kedua yang belum kelihatan selama naskahnya masih pendek: seluruh
perhitungan Cakrawala berjalan di utas yang sama dengan yang menggambar
halaman. Begitu naskah utuh masuk, layar berhenti menanggapi tiap kali sebuah
alat dibuka. Membuka pintu untuk Word dan PDF tanpa membereskan itu lebih
dulu justru akan membuat masalahnya kelihatan setiap hari.

## Yang berubah

### 1. Unggah Word (.docx) dan PDF

Tombolnya sekarang berbunyi **"Muat dari Word, PDF, atau teks"**.

| Jenis | Batas ukuran | Cara dibaca |
| --- | --- | --- |
| Word `.docx` | 25 MB | dibongkar sebagai zip, teksnya diambil paragraf demi paragraf |
| PDF | 40 MB | lapisan teksnya dibaca halaman demi halaman |
| Teks `.txt`, `.md` | 5 MB | dibaca apa adanya |

Batas panjang naskah dinaikkan dari 400 ribu menjadi **1 juta huruf** —
sekitar 150 ribu kata, jauh di atas skripsi mana pun berikut lampirannya.

**Naskah tetap tidak dikirim ke mana pun.** Pembongkaran berkas terjadi di
peramban mahasiswa sendiri. Tidak ada satu pun permintaan jaringan dalam
proses ini, dan janji yang selama ini tertulis di halaman Cakrawala tetap
berlaku apa adanya.

Yang dikerjakan pada teks hasil PDF sebelum masuk ke kotak naskah:

- Nomor halaman dibuang, termasuk angka Romawi pada halaman muka.
- Baris yang terpotong di tengah kalimat disambung kembali, sehingga paragraf
  kembali utuh dan pengurai bab tidak mengira tiap baris adalah judul.
- Tanda hubung di ujung baris dipertahankan, karena dalam bahasa Indonesia ia
  jauh lebih sering menandai kata ulang ("kata-" + "kata") daripada
  pemenggalan suku kata.

### 2. Penolakan yang memberi tahu langkah berikutnya

Jenis berkas dikenali dari byte pertamanya, bukan dari akhiran namanya —
pemilih berkas di ponsel kerap mengabaikan akhiran. Yang tidak dapat dibaca
ditolak beserta jalan keluarnya:

| Yang dipilih | Yang dikatakan Cakrawala |
| --- | --- |
| Word lama `.doc` | Simpan ulang lewat Berkas → Simpan Sebagai → Word Document (.docx) |
| `.odt` LibreOffice | Simpan ulang sebagai `.docx`, atau ekspor ke PDF |
| `.rtf` | Simpan ulang sebagai `.docx` atau PDF |
| PDF hasil pindaian | Tidak ada lapisan teksnya; unggah berkas Word aslinya |
| PDF terkunci sandi | Buka kuncinya dulu, simpan ulang tanpa sandi |
| Foto halaman skripsi | Gambar tidak dapat dibaca sebagai teks |
| `.zip`, `.xlsx`, `.pptx` | Bukan naskah; keluarkan/pilih berkas yang benar |
| Melebihi batas ukuran | Disebutkan ukurannya, batasnya, dan cara mengecilkannya |

### 3. Semua pekerjaan berat pindah ke pekerja latar

Inilah sebab utama halaman terasa macet, dan sekarang sudah tidak lagi.
Pembacaan berkas **dan** empat pemeriksaan terberat dipindahkan ke Web Worker
— utas terpisah yang tidak menggambar apa pun:

- pembacaan Word dan PDF,
- Periksa Bahasa (menyisir naskah sekali untuk tiap pola ejaan),
- pencarian padanan frasa akademik pada Naskah Inggris,
- pemeriksaan ragam Naskah Inggris,
- pencocokan sitasi dengan daftar pustaka,
- pembandingan naskah dengan sumber yang ditempel.

Selama pekerja latar bekerja, alatnya menampilkan keterangan "sedang
memeriksa", dan halaman tetap dapat digulir serta ditekan.

Pembacaan berkas menampilkan bilah kemajuan berisi **halaman keberapa yang
sedang dibaca**, lengkap dengan tombol **Batalkan**. Berkas yang dibatalkan
benar-benar dihentikan, bukan sekadar disembunyikan hasilnya.

Bila peramban tidak mengenal Web Worker sama sekali, perhitungan tetap
dijalankan seperti dulu di utas utama. Tersendat sebentar lebih baik daripada
alatnya tidak jalan di perangkat itu.

### 4. Laporan cetak baru disusun saat akan dicetak

Sebelum ini, laporan cetak tiap alat selalu ada di halaman dan hanya
disembunyikan dengan `display: none`. Pada satu bab hal itu tidak terasa. Pada
skripsi utuh, Periksa Bahasa bisa menghasilkan ribuan temuan, dan tiap temuan
menjadi beberapa elemen: puluhan ribu elemen tersembunyi yang tidak pernah
dilihat siapa pun, tetapi tetap harus disusun, ditata, dan disimpan peramban.

Sekarang tidak ada satu pun elemen laporan yang dibuat sampai tombol **Cetak**
ditekan, lalu dibongkar lagi setelah jendela cetak ditutup.

### 5. Daftar temuan ditampilkan bertahap

Daftar temuan yang panjang digambar 150 baris lebih dulu, dengan tombol
**Tampilkan lebih banyak** dan **Tampilkan semua** di bawahnya. Urutannya tetap
mengikuti letak temuan di naskah, jadi yang tampil lebih dulu memang yang
perlu dibereskan lebih dulu.

Laporan cetak Periksa Bahasa dibatasi 400 temuan per golongan, dengan
keterangan berapa yang tidak ikut tercetak. Ribuan temuan berarti ratusan
halaman yang tidak akan dibaca siapa pun.

---

## Hasil pengukuran

Diukur pada hasil build produksi, dengan naskah PDF 150 halaman (505 ribu
huruf, 53 ribu kata):

| Yang diukur | Hasil |
| --- | --- |
| Membaca PDF 150 halaman | 780 ms |
| Jeda antar-bingkai terpanjang selama membaca | 24,7 ms |
| Keterangan "sedang memeriksa" muncul setelah alat ditekan | 62 ms |
| Periksa Bahasa selesai | 849 ms |
| Jeda antar-bingkai terpanjang selama memeriksa | 37 ms |
| Jeda antar-bingkai terpanjang saat mengetik di kotak naskah | 24 ms |
| Elemen laporan cetak di halaman saat hasil tampil | 0 |

Jeda antar-bingkai di bawah 50 ms berarti halaman tidak pernah terasa macet.

---

## Berkas yang disentuh

Baru:

- `src/lib/ekstrak-naskah.ts` — pengambilan teks dari Word, PDF, dan teks
  polos, berikut perapiannya.
- `src/lib/pekerja-naskah.ts` — pekerja latar; semua pekerjaan berat Cakrawala
  dijalankan di sini.
- `src/lib/pekerja-klien.ts` — sisi utas utama: menyalakan pekerja, mengirim
  tugas, menangani pembatalan, dan jalur cadangan bila pekerja tidak tersedia.
- `src/lib/pekerja-pesan.ts` — bentuk pesan antara keduanya.
- `src/app/alat/use-analisis.ts` — penghubung React ke pekerja latar.
- `src/app/alat/daftar.tsx` — penampil daftar panjang secara bertahap.
- `src/types/pdfjs.d.ts` — satu pernyataan tipe untuk berkas pekerja pdf.js.

Diubah:

- `src/lib/berkas.ts` — pengenal jenis berkas, batas ukuran per jenis, dan
  alasan penolakan.
- `src/app/alat/panel-beranda.tsx` — tombol unggah, bilah kemajuan, tombol
  batal, dan keterangan hasil.
- `src/app/alat/laporan.tsx` — laporan disusun hanya saat akan dicetak.
- `src/app/alat/alat-app.tsx` — pembungkus keadaan cetak.
- `src/app/alat/panel-periksa.tsx`, `panel-naskah.tsx`, `panel-kemiripan.tsx` —
  pemeriksaan pindah ke pekerja latar, daftar ditampilkan bertahap.
- `src/app/globals.css` — gaya bilah kemajuan dan baris "tampilkan lebih
  banyak", mengikuti token warna yang sudah ada (ikut mode malam dan terang).
- `package.json` — tambahan `pdfjs-dist`.

## Yang tidak berubah

- Cara kerja tiap alat dan seluruh perhitungannya. Yang berpindah hanya
  tempatnya dijalankan, bukan isinya.
- Gerbang kode akses Cakrawala di sisi server.
- Penyimpanan project: tetap IndexedDB di perangkat, tetap tanpa akun.
- Tampilan laporan cetak.
- Halaman lain di portal.

## Yang perlu diketahui

- **Tabel dan gambar tidak ikut terbawa.** Yang diambil hanya teksnya. Isi
  tabel pada Word ikut terbaca sebagai teks biasa, tetapi bentuk tabelnya
  hilang. Keterangan ini muncul di layar tiap kali berkas selesai dibaca.
- **PDF hasil pindaian memang tidak bisa dibaca**, dan tidak akan pernah bisa
  tanpa pengenalan aksara. Cakrawala mengatakannya langsung, berikut jalan
  keluarnya.
- **Penomoran bab otomatis Word** (yang nomornya dibuat Word, bukan diketik)
  tidak ikut terbawa ke teks. Bila jumlah bab yang dikenali terasa kurang,
  nomor babnya perlu diketik pada barisnya sendiri di kotak naskah.
