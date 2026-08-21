# UPDATE v3 — 10 Perubahan (Juli 2026)

Semua perubahan di bawah SUDAH terpasang di kode paket ini.
**Tidak ada SQL baru yang perlu dijalankan.** Cukup:

1. Timpa isi repo GitHub dengan paket ini → commit → Vercel build otomatis.
2. Tambah SATU environment variable baru di Vercel:
   `CRON_SECRET` = teks acak panjang apa saja (mis. hasil generator UUID).
   Lalu **Redeploy**.
3. Selesai. (Pembersihan otomatis berjalan tiap hari ±03.00 WIB via Vercel Cron.)

## Daftar perubahan

1. **Pembersihan penyimpanan otomatis** — file lampiran berumur > 1 tahun
   dihapus dari Supabase Storage tiap hari; DATA laporan tetap utuh (tiket,
   nama, status, nama & ukuran file). Uji manual kapan pun:
   `https://DOMAIN/api/cleanup?key=NILAI_CRON_SECRET`
   Hasil pembersihan terakhir tercatat di app_settings → key `last_cleanup`.
2. **Antrean Layanan**: filter Bulan + Tahun (memuat s.d. 2000 tiket untuk
   periode terpilih) + tombol **⬇ Unduh CSV** (langsung rapi di Excel).
3. **Sesi login**: logout otomatis setelah 30 menit tidak aktif — berlaku juga
   bila tab ditutup dan dibuka esok hari. Tombol beranda berubah hijau
   "● Dashboard <Role>" saat sudah login (footer ikut).
4. **Cek Status** kini cukup **nomor tiket** (NIM sudah termuat di tiket).
5. **Notice** "Persyaratan Pengajuan — pembayaran semester berjalan" tampil di
   form Umum, Prodi, Akademik, dan Perpustakaan.
6. **Kebutuhan Layanan Umum** → Surat Keterangan Aktif · Izin Penelitian ·
   Permohonan Praktek Kerja Lapangan · Kebutuhan Lainnya.
7. **Admin** (bukan hanya Super Admin) kini bisa mengubah Pengumuman, pesan
   "Semua layanan aktif", dan status Terbuka/kuning/merah dari menu
   **Pengumuman & Status**.
8. **Dosen Tujuan**: daftar tersaring otomatis saat mengetik.
9. **Template Admin Umum** (menu Template Dokumen): tiga template baru —
   Surat Keterangan Aktif, Izin Penelitian, Permohonan PKL (menggantikan
   "Surat Keterangan Aktif Kuliah"). Pratinjau tampil dengan **kop FISIP
   asli**; **hasil cetak otomatis TANPA kop** dengan ruang atas 5,1 cm
   dipertahankan agar pas di kertas kop pra-cetak kampus. Semua teks bisa
   diedit langsung di pratinjau (bagian kuning = isian). Tombol kecil
   **⇪ Ganti dari .docx** untuk mengganti template (diproses di browser),
   **💾 Simpan template** menjadikannya baku untuk semua admin,
   **⬢ Simpan ke Google Drive** = unduh file .doc + buka folder Drive unit
   (unggah manual — aplikasi tidak memegang akses akun Google).
10. **Transkrip Nilai**: pratinjau kini memakai kop FISIP asli dan mencetak
    tanpa kop (kertas kop kampus); tombol kecil **⇪ Format unggahan (.docx)**
    untuk memakai template transkrip hasil unggahan sendiri.

## Catatan teknis singkat

- Template tersimpan di tabel `app_settings` (key `template_html_*`) — itulah
  sebabnya tidak perlu SQL migrasi.
- Endpoint baru: `/api/templates` (GET/PUT, wajib login + role), `/api/cleanup`
  (kunci CRON_SECRET). Keduanya sudah diuji menolak akses tanpa izin.
- Kop diambil dari `public/images/kop-fisip.png` (hasil konversi
  kop_surat_fisip.pdf). Bila suatu saat kop berganti, cukup ganti file ini.


---

# TAMBAHAN v3.1 — Editor Surat ala Word (Juli 2026)

Cara pasang sama: timpa repo → commit → Vercel build otomatis. Tanpa SQL, tanpa env var baru.

1. **Jarak & tata letak surat kini meniru Word** — kolom Nama/NPM/Prodi memakai
   struktur kolom sejajar (bukan spasi manual), jarak antar-blok dan ruang tanda
   tangan mengikuti dokumen aslinya.
2. **Toolbar format ala Microsoft Word** di atas pratinjau: Undo/Redo, jenis &
   ukuran huruf, B/I/U, rata kiri-tengah-kanan-justify, daftar poin/bernomor,
   indentasi, hapus format.
3. **Sisip gambar / tanda tangan digital** — tombol 🖼 Gambar/TTD (PNG/JPG,
   maks. 400 KB). Klik gambar → pilih Kecil/Sedang/Besar untuk ukurannya.
   Saran: pakai PNG latar transparan hasil scan/crop tanda tangan.
4. **Simpan ke Google Drive** kini membuka **Drive milik pengguna sendiri**
   (drive.google.com/drive/my-drive — otomatis diarahkan login bila belum),
   setelah file .doc terunduh. Pengarsipan tetap manual lewat tombol
   "Arsipkan link Drive di Dashboard → Arsip" yang kini ada di SEMUA template
   (surat & transkrip).
5. **File .doc hasil unduhan dibuka rapi di Word** — struktur kolom otomatis
   dikonversi menjadi tabel (Word tidak memahami flexbox).
6. **Draf otomatis tersimpan di browser** — refresh tak sengaja tidak menghapus
   pekerjaan; muncul tawaran "Pulihkan draf" saat halaman dibuka lagi. Info
   "tersimpan terakhir oleh siapa & kapan" juga tampil.
7. **(Persiapan) Transkrip Nilai — English**: tab & kartu baru "Transkrip (EN)".
   Begitu .docx terjemahan dari Kantor Urusan Internasional diterima: buka tab
   itu → ⇪ Ganti dari .docx → rapikan → 💾 Simpan template. Langsung siap pakai,
   tanpa deploy ulang.


---

# PERBAIKAN v3.2 — Bug gambar/tanda tangan hilang (Juli 2026)

**Gejala:** gambar tanda tangan muncul sesaat setelah diunggah, lalu hilang ±1 detik.

**Penyebab:** editor surat masih "dimiliki" React (dangerouslySetInnerHTML) —
saat komponen render ulang (mis. ketika pesan sukses muncul), React menimpa isi
editor dengan versi lamanya, dan gambar sisipan ikut terhapus.

**Perbaikan:**
- Setelah termuat, isi editor kini 100% dikelola DOM langsung — React tidak
  pernah lagi menulis ulang isinya. Kelas bug "editan tertimpa render" hilang
  total, berlaku juga untuk semua tombol toolbar.
- Penyisipan gambar tidak lagi lewat execCommand (yang rapuh karena fokus
  hilang ke dialog pemilih file), melainkan disisipkan langsung di posisi
  kursor terakhir yang diingat sistem; bila tidak ada, ditaruh di akhir surat.
- Bonus: gambar terpilih kini bisa dihapus dengan tombol Delete/Backspace,
  dan kursor otomatis berada tepat setelah gambar untuk lanjut mengetik.


---

# PENYEMPURNAAN v3.3 — Ukuran gambar bebas & jarak kop presisi (Juli 2026)

1. **Ubah ukuran gambar sesuka Anda** — klik gambar, lalu SERET kotak biru di
   pojok kanan-bawahnya (rasio otomatis terjaga). Ingin angka pasti?
   **Klik-ganda** gambarnya dan ketik lebar dalam cm. Tombol
   Kecil/Sedang/Besar tetap ada sebagai jalan pintas.
2. **Jarak kop dipresisikan** — tinggi kop diukur ulang per-piksel dari PDF
   aslinya: 4,20 cm (sebelumnya tercadang 5,1 cm). Isi surat naik ±0,9 cm,
   ditambah perapatan jarak paragraf & ruang tanda tangan (2,1 cm), sehingga
   surat standar muat utuh satu halaman dan nama penandatangan tidak lagi
   terdorong/terpotong.
3. **Garis pemandu "batas halaman 1"** (merah putus-putus, hanya di layar) —
   bila ada isi di bawah garis itu, bagian tersebut akan tercetak di halaman 2,
   jadi kelebihannya terlihat SEBELUM dicetak.
4. **Margin bawah cetak 8 mm** ditambahkan agar baris terakhir tidak menempel
   tepi kertas/area tak tercetak printer.


---

# v3.4 — Transkrip English (file KUI) & urutan matkul (Juli 2026)

1. **Transkrip Nilai (EN) kini modul penuh berkertas Legal** — sama persis
   dengan transkrip Indonesia (kop pratinjau, cetak tanpa kop), dengan seluruh
   label berbahasa Inggris: ACADEMIC TRANSCRIPT, Student's Name, GPA, Quality
   Points, Dean/Rector, dst. Predikat & program studi ikut diterjemahkan
   otomatis (mis. Sangat Memuaskan → Very Satisfactory).
2. **Pembaca Excel memahami format bilingual KUI**: tiap MK dua baris
   (Indonesia + Inggris) — nama Inggris otomatis masuk dan dipakai transkrip EN.
   Diuji langsung dengan file TRANSKRIP_ILKOM_-_BROADCASTING.xls:
   52 MK · 147 SKS · Mutu 468 · IPK 3.18 — persis angka di file.
3. **MK tanpa nilai huruf (Skripsi/Seminar) tidak lagi terbuang** — pilih HM
   "–"; SKS-nya tetap dihitung dalam total & IPK (mengikuti rumus KUI),
   kolom HM/AM/MK dicetak kosong.
4. **Urutan tambah MK manual: atas → bawah** — daftar isian kini dua kolom
   vertikal bernomor yang mencerminkan persis kolom kiri (1–N) lalu kanan pada
   transkrip tercetak; baris baru selalu menyambung dari atas ke bawah.
5. Kolom **Konsentrasi** (mis. Broadcasting) ikut terbaca dari file & tercetak.


---

# v3.4.1 — Transkrip dwibahasa & perbaikan lewat-batas Legal (Juli 2026)

1. **Penyebab tabel "kelewat batas" ditemukan & dibasmi**: dua tabel kolom
   dipaksa sama tinggi oleh tata letak grid, sehingga tabel yang lebih pendek
   diregangkan — barisnya menggendut (persis baris 39–41 pada screenshot) dan
   total tinggi melewati kertas Legal. Kini tiap tabel setinggi isinya saja.
2. **Transkrip tab kedua kini DWIBAHASA (ID + EN)**, mengikuti format KUI:
   nama mata kuliah Indonesia di baris utama + nama Inggris kecil miring di
   bawahnya; seluruh label ditulis ganda (mis. "Nama Mahasiswa / Student's
   Name", "Predikat / Predicate: Sangat Memuaskan / Very Satisfactory").
   Sel tabel dwibahasa sedikit dirapatkan agar 52 MK tetap muat di Legal.
3. **Garis pemandu batas kertas Legal** (merah putus-putus, hanya di layar)
   ditambahkan pada kedua transkrip — kelebihan isi terlihat sebelum dicetak.


---

# v3.4.2 — Transkrip dwibahasa muat SATU lembar Legal (Juli 2026)

1. **Biodata header dijamin satu baris** — label dwibahasa dipendekkan
   ("Nama / Name", "NIM / Student ID", dst), lebar kolom label dipaskan, dan
   nilai isian diberi aturan tidak-membungkus; nama panjang 3–4 suku kata
   tidak lagi tumpang tindih. Baris panjang (Fakultas, Konsentrasi) otomatis
   membentang penuh.
2. **Seluruh isi dipadatkan** khusus mode dwibahasa: baris tabel, jumlah,
   keterangan, dan blok tanda tangan — total tinggi terhitung ±27,5 cm dari
   batas 34,9 cm, sehingga 52 MK + tanda tangan Dekan/Rektor muat SATU lembar
   Legal dengan sisa ±7 cm. Transkrip Indonesia tidak berubah.


---

# v3.4.3 — Kalibrasi dari ukuran FISIK kertas kampus (Juli 2026)

Berdasarkan pengukuran langsung kertas kop di kampus:
1. **Kertas transkrip diganti ke F4 21,5x33 cm** (sebelumnya keliru memakai
   Legal AS 35,56 cm - itulah sebabnya hasil cetak bisa terpotong padahal
   pratinjau terlihat aman). Garis pemandu batas kertas pindah ke 32,4 cm.
2. **Ruang kop diset dari ukuran fisik: 4,5 cm**, dan teks mulai di 5,0 cm
   (jeda 0,5 cm dari garis kop) - tidak mepet lagi. Berlaku untuk SEMUA
   template: 3 surat A4 dan kedua transkrip.
3. Ekspor .doc surat ikut disesuaikan (margin atas 5,5 cm).

Anggaran tinggi transkrip dwibahasa 52 MK setelah kalibrasi: +-28,1 cm dari
batas 32,4 cm - sisa +-4,3 cm. Muat satu lembar F4.


---

# v3.5 - Transkrip mengisi penuh halaman (acuan Format_Transkrip_Nilai.docx)

Acuan yang dipelajari dari file .docx KUI: halaman Legal/F4, judul bertingkat
"TRANSKRIP NILAI" + "OFFICIAL ACADEMIC TRANSCRIPT", label biodata bertingkat
Indonesia/English, tabel bergaris penuh, baris JUMLAH & JUDUL SKRIPSI, blok
tanda tangan dua sisi.

1. **Ruang kiri, kanan, dan bawah kini terpakai** - margin cetak halaman
   dikecilkan dari 1,5-1,6 cm menjadi 1,0 cm (bawah 0,8 cm). Lebar isi naik
   dari 18,3 cm menjadi **19,5 cm**; tabel melebar mengikutinya.
2. **Isi diperbesar agar ruang bawah tidak kosong** - font tabel, biodata,
   baris jumlah, keterangan, dan ruang tanda tangan dinaikkan proporsional.
   Anggaran tinggi terhitung: **31,5 cm dari batas 32,2 cm** (kertas 33 cm -
   0,8 cm), sisa 0,7 cm. Sebelumnya isi hanya +-28 cm sehingga bagian bawah
   kertas kosong.
3. **Judul bertingkat** sesuai acuan .docx: TRANSKRIP NILAI di baris utama,
   OFFICIAL ACADEMIC TRANSCRIPT di bawahnya.


---

# v3.6 - Blok totalan bergaris & jaminan satu lembar

1. **Blok totalan diganti menjadi TABEL BERGARIS 4 kolom** sesuai acuan:
   baris 1 = Total Kredit : 147 SKS | Indeks Prestasi Kumulatif : 3,18
   baris 2 = Total Nilai : 468 | Predikat Kelulusan : Sangat Memuaskan
   baris 3 = JUDUL SKRIPSI : (bergaris, menyatu dengan tabel di atasnya)
   Versi dwibahasa memakai label ganda (Total Kredit / Total Credits, dst).
2. **Aturan anti-potong**: tabel nilai, blok totalan, dan blok tanda tangan
   diberi break-inside: avoid, sehingga tidak pernah terbelah dua halaman.
3. **Isi dirapatkan lagi**: tinggi total kini 31,4 cm dari batas 32,2 cm
   (kertas 33 cm). Di kertas Legal 35,56 cm sisa ruangnya 3,4 cm.
4. **Panduan cetak tampil di layar** (kuning, di samping tombol Cetak):
   agar hasil 1 lembar, di dialog print set **Margins = None**,
   **Scale = Default (100%)**, dan **matikan Headers and footers**.
   Ini penyebab paling sering hasil menjadi 2 lembar - kop/URL/tanggal
   bawaan browser memakan tinggi kertas.


---

# v3.7 - Label bertingkat sesuai acuan + mode Edit Tata Letak

1. **Label biodata kini BERTINGKAT dua baris** persis acuan .docx:
   baris 1 Indonesia huruf kapital ("NAMA MAHASISWA/"), baris 2 Inggris
   miring ("COMPLETE NAME"). Berlaku untuk Nomor Ijazah Nasional/Degree
   Certificate Number, Tanggal Yudisium/Degree Conferral Date, NPPT/
   Institutional Registration Number, Terakreditasi/Accredited, NIM/Student
   Registration Number, Program Studi/Study Program, Tempat Tgl Lahir/Place
   and Date of Birth, Nomor Pokok Program Studi/Study Program Identification
   Number, serta Fakultas/Faculty dan Jenjang/Course.
2. **Header tabel juga bertingkat**: KODE MK/Course, NAMA MATA KULIAH/
   Descriptions, K/CR, HM/LG, AM/GP, MK/WM.
3. **Sub-judul OFFICIAL ACADEMIC TRANSCRIPT dimiringkan** sesuai acuan.
4. **Tombol baru "Edit tata letak"** di samping tombol Cetak. Saat aktif,
   SELURUH pratinjau transkrip menjadi bisa diklik dan diketik langsung -
   teks, label, posisi, apa pun - ditandai garis putus-putus biru. Klik
   "Selesai edit tata letak" untuk mengunci kembali, lalu Cetak.
   Catatan: hasil edit ini berlaku untuk cetakan saat itu (tidak tersimpan
   permanen); untuk template permanen gunakan menu Format unggahan (.docx).


---

# v4.0 - Transkrip DIROMBAK TOTAL sesuai PDF acuan (kertas Legal)

Seluruh tata letak transkrip dibangun ulang dari hasil pengukuran langsung
file PDF acuan (Transkrip_Nilai2061201446.pdf) - posisi tiap garis, lebar
tiap kolom, dan ukuran tiap font diambil dari koordinat aslinya.

**Temuan utama: tabel acuan TIDAK bergaris penuh.** Hanya ada kotak luar,
satu pembatas vertikal di tengah, dan satu garis di bawah baris header.
Tidak ada garis antar-kolom maupun antar-baris. Versi lama memakai grid
penuh - itulah beda paling mencolok, dan kini sudah diseragamkan.

Rincian yang disamakan:
1. **Judul** "TRANSKRIP NILAI" 10,5pt tebal bergaris bawah, di bawahnya
   "OFFICIAL ACADEMIC TRANSCRIPT" 6,4pt tebal miring.
2. **Blok atas** (Nomor Ijazah Nasional / Degree Certificate Number, NPPT /
   Institutional Registration Number, Tanggal Yudisium / Degree Conferral
   Date, Terakreditasi / Accredited) dua kolom, label bertingkat.
3. **Biodata** satu kolom, 5 baris, titik dua sejajar di 8,1cm: NAMA
   MAHASISWA / COMPLETE NAME, NOMOR INDUK MAHASISWA / STUDENT REGISTRATION
   NUMBER, TEMPAT TGL LAHIR / PLACE AND DATE OF BIRTH, PROGRAM STUDI /
   STUDY PROGRAM, JENJANG / KONSENTRASI / COURSE / CONCENTRATION.
4. **Header tabel dua baris**: No | Kode MK/Course | Nama Mata Kuliah/
   Descriptions | HM/LG | AM/CR | K/WM | M/GP.
5. **Lebar kolom** persis proporsi PDF: No 5,2% - Kode 12,2% - Nama 60,7% -
   empat kolom nilai masing-masing 5,4%.
6. **Blok total 3 pita bergaris** tanpa pemisah vertikal: Total Kredit /
   Total Credits Accomplished + Indeks Prestasi Kumulatif / Grade Point
   Average (GPA); Total Nilai / Total Grade Points + Predikat Kelulusan /
   Graduation Honors; lalu pita JUDUL SKRIPSI.
7. **Tanda tangan tunggal di kanan** dengan nama bergaris bawah dan NBM.
8. **Kertas Legal 21,59 x 35,56 cm**. Tinggi isi terhitung 28,8 cm - muat
   satu lembar di Legal (sisa 5,8 cm) maupun di F4 33 cm (sisa 3,3 cm).


---

# v4.1 - Header dua kolom, font diperbesar, tanda tangan dipatok bawah

1. **Header diganti sesuai gambar acuan**: biodata kini DUA KOLOM dengan
   label bertingkat (Indonesia di atas, Inggris miring di bawahnya).
   Kiri: Nama Mahasiswa/Complete Name, Nomor Induk Mahasiswa/Student
   Registration Number, Tempat Tgl Lahir/Place and Date of Birth, Program
   Studi/Study Program. Kanan: Fakultas/Faculty, Jenjang/Course,
   Konsentrasi/Concentration, Nomor Pokok Program Studi/Study Program
   Identifications Number. Blok atas (Nomor Ijazah/NPPT/Yudisium/
   Terakreditasi) juga dirapikan dua kolom.
2. **Semua font diperbesar** supaya tidak kekecilan:
   biodata & blok atas 6,4 -> 7,6pt; tabel nilai 6 -> 6,8pt (nama mata
   kuliah ikut naik); blok total 6 -> 7pt; judul 10,5 -> 14pt; sub-judul
   6,4 -> 8pt; tanda tangan 6,8 -> 8,5pt.
3. **Tanda tangan dipatok ke dasar halaman** (flex + margin-top auto),
   sehingga tidak ada lagi ruang kosong menganggur di bawahnya - sisa ruang
   otomatis terserap ke jarak sebelum blok tanda tangan.
4. Tinggi total terhitung 33,5 cm dari batas 34,56 cm (Legal) - tersisa
   ~1,1 cm sebagai cadangan bila ada nama mata kuliah yang terlipat 2 baris.
5. **Tombol "Edit tata letak" tetap ada** - seluruh pratinjau masih bisa
   diklik dan diketik langsung seperti Microsoft Word.


---

# v4.2 - Tanda tangan tidak terpotong, header ala PDF, kode MK tidak terlipat

1. **Tanda tangan terpotong: DIPERBAIKI.** Penyebabnya blok tanda tangan
   dipatok ke dasar kertas Legal (35,56 cm) - padahal printer punya zona
   tak-tercetak di tepi. Sekarang dipatok ke dasar KOTAK AMAN 33,4 cm,
   sehingga berakhir di 32,4 cm dari tepi atas: sisa 3,16 cm di Legal dan
   0,60 cm di F4 33 cm. Bila ada nama mata kuliah yang terlipat, kotak
   membesar sendiri ke bawah (masih ada ruang di Legal).
2. **Font header dikembalikan sekecil PDF acuan** (6,4pt) - blok atas dan
   biodata dua kolom - sehingga hemat ruang vertikal, judul 12pt.
3. **Kolom Kode MK dilebarkan** 12,2% -> 14,5% dan dikunci tidak boleh
   terlipat (white-space: nowrap). Kode seperti MKKB-026 / MKSB-045 kini
   selalu satu baris, jadi tinggi baris seragam dua baris seperti contoh
   kotak hijau - tidak lagi ada baris menjulang tiga baris.
4. **Baris Inggris nama mata kuliah SELALU tampil.** Bila terjemahan
   kosong, baris kedua memakai nama yang sama (mengikuti PDF acuan, mis.
   "Corporate Governance / Corporate Governance").
5. **Toolbar ala Microsoft Word kini ADA di transkrip.** Klik "Edit tata
   letak", toolbar muncul di atas halaman: Undo/Redo, jenis huruf, ukuran
   huruf, B / I / U, rata kiri-tengah-kanan, A- / A+ (perkecil/perbesar
   teks terpilih), dan hapus format. Sebelumnya toolbar ini hanya ada di
   modul surat - itulah sebabnya belum terlihat di transkrip.


---

# v4.3 - Kop naik, nilai dikapitalkan, Inggris miring, ttd dua kolom

1. **Kop & awal tulisan naik 0,5 cm** (cadangan atas 5,0 -> 4,5 cm) khusus
   transkrip; template surat tetap 5 cm.
2. **Program Studi**: ditulis kapital dwibahasa, mis.
   "ILMU PEMERINTAHAN / GOVERNMENT SCIENCE" (Inggris miring).
3. **Jenjang**: bawaan menjadi "SARJANA / BACHELOR DEGREE (S-1)".
4. **Konsentrasi**: otomatis kapital, mis. "ILMU PEMERINTAHAN".
5. **JUDUL SKRIPSI/ THESIS TITLE:** - label dwibahasa, Inggris miring.
6. **Blok tanda tangan jadi DUA kolom** sesuai gambar: kiri "Dekan / Dean,"
   dengan Dr. H. Achmad Kosasih, MM. (NBM 739.574); kanan "Tangerang, <tgl>"
   lalu "Rektor / Rector," dengan Dr. H. Desri Arwen, M.Pd. (NBM 837.138).
   Nama bergaris bawah, tetap dipatok ke dasar kotak aman.
7. **Semua teks berbahasa Inggris dimiringkan** - label bertingkat, nilai
   setelah tanda "/", nama jabatan (Dean, Rector), dan judul skripsi.
   Semua nilai biodata otomatis kapital seperti PDF acuan.

Anggaran tinggi: isi 27,6 cm dari 27,9 cm tersedia; tanda tangan berakhir
32,4 cm dari tepi atas (sisa 3,2 cm di Legal).


---

# v4.5 - Rektor di pojok kanan, foto 3x4 tepat di tengah

Blok tanda tangan diubah dari grid 3 kolom menjadi flex space-between:
- **Dekan / Dean** menempel tepi KIRI halaman.
- **Rektor / Rector** menempel tepi KANAN halaman (pojok kanan bawah),
  bukan lagi bergeser sedikit dari tengah.
- **Kotak foto 3x4** tetap melayang absolut tepat di tengah dan boleh
  melewati garis tabel (sesuai permintaan) tanpa menambah tinggi halaman.
  Kotak panduan putus-putus hanya tampil di layar, tidak ikut tercetak.


---

# v4.7 - Blok total dimiringkan, ttd sebaris & sejajar, tanggal Indonesia

1. **Label blok total kini miring bagian Inggrisnya.** Penyebab sebelumnya:
   label Total Kredit / Total Credits Accomplished, Indeks Prestasi
   Kumulatif / Grade Point Average (GPA), Total Nilai / Total Grade Points,
   dan Predikat Kelulusan / Graduation Honors dirender polos, tidak melewati
   pemroses dwibahasa. Kini keempatnya memakai varian SEBARIS (BiIn):
   Inggris miring tetapi tidak turun baris, sesuai PDF acuan.
2. **"Dekan / Dean" dan "Rektor / Rector" jadi SEBARIS**, tidak lagi
   bertingkat - ruang paraf jadi lebih lega sehingga tanda tangan tidak
   kekecilan.
3. **Blok Rektor disejajarkan**: seluruh barisnya (Tangerang..., Rektor /
   Rector, nama, NBM) kini rata kiri pada satu garis awal yang sama, tepat
   di bawah huruf "T" pada Tangerang.
4. **Tanggal tanda tangan selalu Bahasa Indonesia** (mis. 5 Agustus 2026),
   termasuk pada transkrip dwibahasa.


---

# v5.0 - Template Excel Transkrip + Simpan/Muat data

## Alur baru di dashboard Transkrip
1. **⬇ Unduh Template Excel** - menghasilkan file
   "Template-Transkrip-SiPaling.xlsx" berisi 3 sheet:
   - **Biodata**: kolom LABEL | ISI (nama, NIM, TTL, prodi, konsentrasi,
     jenjang, nomor ijazah, NPPT, yudisium, akreditasi, judul skripsi,
     tanggal surat, dekan + NBM, rektor + NBM).
   - **Nilai**: NO | KODE MK | NAMA MATA KULIAH | COURSE TITLE (INGGRIS) |
     K | HM - satu baris satu mata kuliah, mudah diisi manual/bulk.
   - **Panduan**: 8 poin cara pengisian.
2. **Impor Excel** kini menerima DUA format otomatis: template SiPaling di
   atas, dan Excel akademik lama (dua blok kolom ala KUI). Sistem mendeteksi
   sendiri berdasarkan nama sheet.
3. **💾 Simpan data transkrip** - menyimpan biodata + seluruh baris nilai ke
   database (tabel app_settings, kunci transkrip_data).
4. **📂 Muat data tersimpan** - memuat kembali data itu kapan saja, lalu
   baris mata kuliah bisa DITAMBAH atau DIKURANGI langsung di dashboard
   tanpa perlu mengunggah Excel lagi.

## Aturan penting template
- AM, MK, Total SKS, Mutu, dan IPK dihitung OTOMATIS - tidak diisi di Excel.
- Mata kuliah tanpa nilai huruf (Skripsi/Seminar): KOSONGKAN kolom HM;
  SKS tetap masuk total, tidak menambah angka mutu.
- Kolom COURSE TITLE boleh kosong; transkrip memakai nama Indonesia.
- Program Studi ditulis persis "Ilmu Komunikasi" atau "Ilmu Pemerintahan".

## Hasil pengujian
- Round-trip: template dibuat -> dibaca ulang -> biodata 13 field & seluruh
  mata kuliah terbaca utuh.
- Uji ketahanan 53 MK + baris kosong + duplikat + baris "JUMLAH" nyasar:
  semua sampah tersaring, hasil tepat 53 MK, dua MK tanpa HM tetap dihitung
  SKS-nya (162 SKS, mutu 425, IPK 2,62).
- Simpan/muat JSON identik; ukuran ~4 KB (batas 300 KB).
- API /api/transkrip-data menolak akses tanpa login dan tanpa role yang
  berwenang (super_admin, admin, admin_akademik).
- Pesan error informatif bila header salah/file bukan template.


---

# v5.1 - Delapan penyempurnaan

1. **Editor nilai lebih nyaman**: kolom Kode dipendekkan (cukup 6-9 karakter
   seperti MKSB-046), kolom Nama Mata Kuliah dipanjangkan mengisi sisanya.
   Panel **Biodata & dokumen** dan **keterangan HM/AM** kini dapat DILIPAT
   (tombol "▲ Sembunyikan"), sehingga daftar ketikan naik ke atas dan tidak
   perlu scroll bolak-balik antara isian dan pratinjau.
2. **Tombol pilih file** dibungkus kotak bergaya sama dengan tiga tombol
   lain ("📁 Pilih File Excel"), tidak lagi tampil polos.
3. **Tombol "Arsipkan link Drive" (2 buah) dan "⇪ Format unggahan (.docx)"
   dihapus** dari modul transkrip.
4. **Super Admin dapat menghapus pengajuan.** Di panel detail tiket muncul
   "Zona Super Admin" dengan tombol hapus + konfirmasi. Lampiran di
   Supabase Storage, riwayat revisi, dan catatan absensi ikut dibersihkan
   agar tidak menyisakan berkas yatim. Role lain menerima 403.
5. **Quote berganti otomatis tiap 5 detik**, koleksi ditambah menjadi 15
   kutipan tokoh pendidikan (Ki Hadjar Dewantara, Kartini, Hatta, Soekarno,
   Hamka, Pramoedya, Habibie, dll).
6. **4 dosen dinonaktifkan** lewat file supabase-hapus-4-dosen.sql
   (Andi Restana, Hendra Wijaya, Maya Lestari, Rina Kurniawati). Memakai
   active = false agar pengajuan lama tidak rusak; sudah diuji pada replika.
7. **Antrean Layanan: tombol "Unduh Data" berformat PDF** dengan lencana
   merah PDF, tata letak lanskap A4, header biru, baris belang, kop laporan
   dan cap waktu cetak. Tombol CSV dipertahankan sebagai opsi kecil.
8. **Kartu "Alur Layanan" ditata ulang**: lima langkah menjadi pil berwarna
   (biru-kuning-merah-ungu-hijau) dan ditambah ilustrasi layanan di sisi
   kanan; pada layar kecil ilustrasi turun ke bawah.
