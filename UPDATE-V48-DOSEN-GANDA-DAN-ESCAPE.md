# UPDATE v48 — Dosen ganda dihapus, dan Escape tidak lagi menjadi pintu keluar

Dua laporan, dua perbaikan yang tidak berhubungan satu sama lain.

---

## 1. Dosen yang tampil dua kali

**Laporan:** *"Hapus Dosen Double Umar Farisal S.I.Kom, M.Si dan Dr. Abdul Basit, ST, M.Ikom."*

### Yang sebenarnya terjadi

Daftar "Dosen Tujuan" memang tidak boleh berisi satu orang dua kali, dan
tabelnya sudah punya penjaga untuk itu: `UNIQUE (name, study_program)`. Tetapi
penjaga itu membandingkan nama **persis**, huruf demi huruf — sedangkan gelar
akademik hampir tidak pernah diketik dua kali dengan cara yang sama:

| Baris pertama | Baris kedua |
| --- | --- |
| `Umar Farisal S.I.Kom, M.Si` | `Umar Farisal, S.I.Kom., M.Si.` |
| `Dr. Abdul Basit, ST, M.Ikom` | `Dr. Abdul Basit, S.T., M.I.Kom` |

Bagi Postgres keempatnya empat orang yang berbeda. Satu titik atau satu koma
sudah cukup melewati `ON CONFLICT`, dan baris kedua lahir tanpa satu pesan
galat pun.

Akibatnya bukan sekadar daftar yang jelek dibaca. Dua mahasiswa yang memilih
orang yang **sama** tercatat pada dua baris dosen yang berbeda, sehingga
hitungan `(8 Mhs Bimbingan)` yang dipakai Prodi menimbang beban tiap dosen
terbelah dua dan berhenti menjawab pertanyaan yang ditanyakannya. Akun login
dosennya pun hanya menempel pada salah satu baris: ujian CBT dan pengajuan
judul yang masuk ke baris yang lain tidak pernah terlihat olehnya.

### Yang dikerjakan

Berkas baru: **`supabase-update-v48-dosen-ganda.sql`** — jalankan seluruh
isinya di Supabase → SQL Editor → Run. Aman diulang.

1. **Menggabungkan, bukan menghapus.** Satu baris dipilih sebagai yang
   disimpan, lalu seluruh rujukan ke kembarannya dipindahkan ke sana:
   pengajuan judul, pilihan dosen, kontributor dokumen, notifikasi, ujian CBT,
   layanan mahasiswa, dan akun login. Baru sesudah tidak ada lagi yang menunjuk
   kepadanya, kembarannya dihapus.

   Menghapus lebih dulu berarti kehilangan data. `lecturer_id` pada pengajuan
   judul dan layanan mahasiswa berpasangan `ON DELETE SET NULL`, jadi pengajuan
   yang sudah disetujui akan kehilangan nama dosen yang menyetujuinya; pilihan
   dosen dan kontributor dokumen berpasangan `ON DELETE CASCADE`, jadi barisnya
   lenyap sama sekali.

2. **Yang disimpan dipilih, bukan diundi.** Urutannya: yang punya akun login
   lebih dulu, lalu yang paling banyak dirujuk data lain, lalu yang id-nya
   paling kecil. Memindahkan akun login jauh lebih berisiko daripada
   memindahkan pengajuan, karena akun itulah yang dipakai dosennya membuka
   ujian CBT miliknya sendiri.

3. **Keputusan yang sudah tercatat tidak hilang.** Satu pengajuan dapat
   menunjuk **kedua** baris kembar sekaligus — mahasiswa yang melihat nama yang
   sama dua kali di daftar memang kadang memilih keduanya. Pada keadaan itu
   yang dibuang adalah pilihan yang belum diputuskan, dan yang sudah
   "Diterima" dipindahkan utuh ke baris simpanan.

4. **Pintunya ditutup.** `sipaling_buat_dosen` sekarang mencari baris yang
   sudah ada lewat nama yang **dinormalkan** — tanpa titik, koma, dan spasi —
   sehingga `Dr. Abdul Basit, ST, M.Ikom` dan `Dr. Abdul Basit, S.T., M.I.Kom`
   dikenali sebagai orang yang sama. Penjaganya ditambahkan pula sebagai indeks
   unik, supaya yang lolos dari fungsi tetap tertahan basis data.

   Nama yang sudah ada **tidak ditimpa** ketika akun baru dibuat dengan ejaan
   yang lain: ejaan yang sudah terlanjur tercetak pada surat tugas dan
   transkrip tidak boleh berubah hanya karena satu akun dibuat.

   Gelar sengaja **tidak** ikut dibuang saat dinormalkan, hanya tanda bacanya.
   Membuang gelar akan menyatukan dua orang berbeda yang kebetulan senama, dan
   kekeliruan itu jauh lebih mahal daripada satu baris ganda yang tersisa.

### Kalau hasilnya berkata "LEWAT: tidak ada dosen yang cocok"

Berarti barisnya terdaftar pada program studi yang lain. Jalankan ulang baris
yang bersangkutan dengan `'Ilmu Pemerintahan'`. Bila ternyata orangnya memang
terdaftar di **kedua** prodi, keduanya bukan baris ganda melainkan dua
penugasan — yang benar adalah menonaktifkan yang tidak dipakai, dan caranya
ada di catatan BLOK 3 pada berkas SQL-nya.

---

## 2. CBT di PC: Escape masih menjadi pintu keluar

**Laporan:** *"CBT di pc masih bisa di 'esc' untuk keluar dan tidak dianggap
pelanggaran."*

### Yang sebenarnya terjadi

Penjaga layar ujian hanya **mendengarkan** satu peristiwa, `fullscreenchange`.
Peristiwa itu menyala pada **perpindahan** — dan di situlah celahnya, karena
halaman yang sejak lahir sudah berada di luar layar penuh tidak pernah
berpindah dari mana pun.

Jalan yang paling sering benar-benar dipakai hanya dua ketukan:

1. **Escape** melepas layar penuh. Ini tercatat — dan memang selalu tercatat.
   Bilah peramban muncul kembali justru karena layar penuhnya lepas, dan
   tombol muat ulang ada di sana.
2. **Muat ulang** dari tombol itu. Halamannya lahir kembali di luar layar
   penuh, sesi ujiannya dipulihkan sendiri dari `localStorage` — dan pemulihan
   itu **tidak dapat** meminta layar penuh, karena peramban hanya mengabulkan
   permintaan layar penuh yang datang dari ketukan orang.

Sesudah dua ketukan itu tidak ada satu pun peristiwa yang menyala. Tidak ada
tirai, tidak ada catatan, dan seluruh sisa ujian dikerjakan di dalam jendela
biasa yang bilah perambannya lengkap — sementara yang tercatat di server tetap
"bersih". Dua jalan lain bermuara ke keadaan yang sama: `requestFullscreen`
yang ditolak peramban tanpa suara, dan sesi yang dipulihkan sesudah peramban
tertutup atau perangkatnya mati.

### Yang dikerjakan

**Layar penuh sekarang DIPERIKSA, bukan sekadar didengarkan.**
(`src/app/cbt/ujian/penjaga.ts`)

Keadaan layar dibaca ulang dari `document.fullscreenElement` sedetik sekali —
sumber yang tidak dapat dilewatkan dengan cara tidak menyalakan peristiwa.
Peristiwanya tetap didengarkan, tetapi kini hanya sebagai jalan cepat: ia yang
membuat tirai jatuh pada ketukan Escape itu juga, bukan satu detik sesudahnya.

Aturannya sendiri dipisahkan menjadi fungsi murni `periksaLayarPenuh` di
`src/lib/kunci-layar.ts`, lengkap dengan ujinya di `uji-kunci-layar.ts`. Tiga
hal yang dijaganya:

- **Tirainya selalu.** Di luar layar penuh berarti soalnya ditutup, tanpa
  kecuali dan tanpa jeda. Yang ditahan jeda hanyalah catatannya.
- **Satu catatan per episode.** Keluar sekali dicatat sekali, bukan sekali tiap
  detik selama peserta di luar sana. Penghitungnya baru dikokang ulang sesudah
  peserta benar-benar kembali — jadi keluar tiga kali tetap tercatat tiga kali,
  dan bertahan di luar selama sepuluh menit tetap satu.
- **Yang ragu diam.** Detik-detik pembukaan (kotak izin kamera merebut fokus)
  dan detik-detik pengumpulan (halamannya sendiri yang melepas layar penuh)
  tidak pernah menjadi catatan atas nama peserta.

Dua keadaan dibedakan, dan bedanya penting:

| Keadaan | Tirai | Catatan |
| --- | --- | --- |
| Tadi di dalam, sekarang di luar — **Escape, F11, menu peramban** | seketika | seketika |
| Tidak pernah terlihat di dalamnya — **muat ulang, sesi dipulihkan** | seketika | sesudah 8 detik |

Delapan detik itu dipilih dari dua sisi: cukup panjang supaya peserta yang
sesinya baru pulih sempat membaca tiraïnya dan menekan tombol "Kembali ke layar
penuh" tanpa membawa catatan atas nama orang yang tidak berbuat apa-apa, dan
cukup pendek supaya ujian yang memang dikerjakan di luar layar penuh tidak
berjalan setengah jam tanpa satu baris pun tercatat.

**Escape dikenali daftar tombol.** (`src/lib/tombol-terlarang.ts`)

Sebelumnya Escape sengaja dibiarkan lewat tanpa sepatah kata pun. Sekarang ia
dikenali sebagai golongan `layar_penuh` — sama seperti F11 — supaya pesertanya
mendapat kalimat yang menerangkan apa yang barusan terjadi, bukan layar gelap
tanpa sebab.

Dua kolom pada putusannya sengaja tetap apa adanya:

- `insiden: null` — yang mencatat keluarnya layar penuh adalah pemeriksaan
  keadaan di atas, yang menyala **apa pun** cara keluarnya, termasuk lewat menu
  peramban yang tidak pernah menyentuh papan ketik. Mencatatnya dari daftar
  tombol juga akan menghitung satu perbuatan dua kali.
- `benarTercegah: false` — `preventDefault` **tidak** membatalkan Escape yang
  melepas layar penuh. Peramban menanganinya pada jalur yang tidak diserahkan
  kepada halaman, dan mengaku sebaliknya hanya akan terbukti bohong pada
  peserta pertama yang mencobanya.

### Satu pembebasan, dan alasannya

Aplikasi ujian Android di `lockdown/android/` **tidak** melayani
`requestFullscreen` sama sekali — WebView Android membutuhkan
`WebChromeClient` beserta `onShowCustomView`, dan aplikasi itu tidak
memasangnya karena memang tidak membutuhkannya: jendelanya sudah disematkan
sistem lewat `startLockTask()` dan bilah sistemnya sudah disembunyikan. Di sana
`document.fullscreenElement` selamanya kosong.

Tanpa pembebasan ini, setiap peserta yang justru memakai perangkat **paling**
terkunci akan mendapat tirai yang tidak pernah terbuka, beserta satu
pelanggaran atas nama orang yang tidak dapat berbuat apa-apa terhadapnya.
Karena itu perangkat yang jendelanya dipegang aplikasi ujian (`KEMAMPUAN.kiosk`)
dibebaskan dari **satu** cabang saja: keadaan yang layar penuhnya tidak pernah
sekali pun menyala. Aplikasi Windows melayani `requestFullscreen` dengan baik,
jadi peserta di sana yang tadi di dalam lalu sekarang di luar tetap tercatat
seperti peserta mana pun.

Batasnya dikatakan terus terang: pengenalan aplikasi itu **pengakuan**, bukan
bukti — User-Agent dapat ditulis siapa saja. Yang menutupnya bukan halaman ini
melainkan gerbang di server: ujian yang mewajibkan aplikasi menuntut kunci
bersama (`periksaKunciKlien`), dan pengakuan tanpa kunci ditolak di sana.

### Yang TIDAK berubah

- Bobot pelanggaran `fullscreen` tetap 10, dan ia tetap ikut menghitung mundur
  ke pengumpulan paksa. Tidak ada ambang yang digeser.
- Mode **Biasa** tetap tidak memakai layar penuh sama sekali. Kuis harian tidak
  ikut tertutup tirai.
- Keputusan menghentikan ujian tetap dibuat **server**, bukan halaman.

---

## Cara memasang

1. Supabase → SQL Editor → Run seluruh isi `supabase-update-v48-dosen-ganda.sql`.
   Baca dulu hasil BLOK 3a sebelum melanjutkan; kalau ada nama yang bukan orang
   yang dimaksud, persempit polanya.
2. Deploy seperti biasa. Perbaikan CBT tidak menuntut migrasi apa pun.

## Uji

```
npx tsx uji-kunci-layar.ts     # 178 periksa — termasuk seluruh aturan layar penuh
npx tsx uji-tombol.ts          # 202 periksa — termasuk Escape
npm run typecheck
npm run lint
```
