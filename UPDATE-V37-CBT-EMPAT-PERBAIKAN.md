# v37: CBT — angka soal yang besar, jam Indonesia, satu layar, dan fokus yang tidak lagi dituduh

Empat keluhan dari pemakaian sungguhan, dan keempatnya diperbaiki di tempat
sebabnya, bukan ditutup dengan kalimat di layar.

---

## 1. Sudah berapa soal yang masuk?

### Yang salah

Memasukkan soal adalah pekerjaan berulang yang memakan satu jam penuh: mengetik,
menyimpan, mengetik lagi. Di tengahnya selalu muncul satu pertanyaan yang sama —
*sudah berapa?* — dan jawabannya hanya ada di dua tempat yang keduanya tidak
terlihat dari tempat mengetik:

- angka kecil di dalam kurung pada nama tab, `Bank soal (12)`, jauh di atas
  formulir yang sedang diisi;
- daftar soal di bawah formulir, yang harus dihitung sendiri.

### Yang berubah

Satu panel baru berdiri **persis di atas formulir "Tambah soal satu per satu"**,
sehingga angka yang naik itu berada tepat di tempat mata sedang menatap ketika
satu soal tersimpan.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│      34      Ujian ini memakai 20 soal dari bank.            │
│              ✓ Cukup, malah berlebih 14 soal — yang dipakai  │
│  SOAL SUDAH    diacak dari seluruh bank.                     │
│  DIMASUKKAN  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    │
└──────────────────────────────────────────────────────────────┘
```

Angkanya 58 piksel, dan itu bukan hiasan: ia harus terbaca tanpa berhenti
mengetik. Di bawahnya tiga hal lagi yang menjawab pertanyaan berikutnya:

- **berapa yang dipakai ujian** — bank boleh lebih besar daripada jumlah soal
  yang dikerjakan; soalnya diacak dari seluruh bank, jadi bank yang lebih besar
  berarti dua peserta bersebelahan lebih kecil kemungkinan mendapat lembar yang
  sama;
- **kurang berapa lagi**, bila banknya belum cukup — beserta peringatan bahwa
  ujiannya belum dapat diaktifkan;
- **batang yang ikut penuh** — angka menjawab "berapa", batang menjawab "tinggal
  berapa lagi" tanpa seorang pun mengurangi.

Warnanya ikut berganti: biru selama kurang, hijau begitu cukup.

---

## 2. Jam AM/PM, dan jam yang bergeser sendiri

### Yang salah

Dua hal yang terlihat seperti satu keluhan, padahal sebabnya berbeda — dan yang
kedua jauh lebih berbahaya karena tidak terlihat sama sekali.

**a. "AM" dan "PM" datang dari peramban, bukan dari halaman.** Isian jadwal dulu
memakai:

```tsx
<input type="datetime-local" value={jadwal.mulai} … />
```

Kotak isian itu digambar peramban menurut **bahasa sistem operasi** pemakainya.
Laptop yang bahasanya *English (United States)* menggambarnya dalam jam dua belas
lengkap dengan AM dan PM, dan tidak ada satu pun atribut HTML yang dapat
memaksanya berhenti — bukan `lang`, bukan `locale`, bukan apa pun.

**b. Jamnya bergeser sebanyak selisih zona perangkat.** Yang diketik dikirim
begini:

```ts
mulai: new Date(jadwal.mulai).toISOString()
```

`new Date("2026-05-12T08:00")` berarti *"pukul delapan menurut jam perangkat
ini"*. Pengajar yang laptopnya berzona UTC mengetik `08.00` dan menyimpan ujian
yang terbuka **pukul tiga sore**. Peserta yang membuka tautannya menemukan ujian
yang belum dibuka — atau yang sudah ditutup.

Pergeseran yang sama menimpa kalimat yang disusun **di server**, karena server
berjalan pada UTC:

```ts
`Ujian belum dibuka. Mulai ${ujian.startAt?.toLocaleString("id-ID")}.`
```

### Yang berubah

**Satu berkas baru, `src/lib/waktu-indonesia.ts`,** memegang seluruh jam CBT:

```ts
export const ZONA_UJIAN = "Asia/Jakarta";
export const HURUF_ZONA = "WIB";
```

Penyelenggara di luar WIB mengubah dua baris itu sekaligus — WITA adalah
`Asia/Makassar`, WIT adalah `Asia/Jayapura` — lalu seluruh sistem ikut. Selisih
zonanya **dihitung**, bukan ditulis tetap `+7`, sehingga berkasnya tetap benar
bila zonanya diganti ke zona yang mengenal waktu musim panas.

**Pemilih jam menggantikan `datetime-local`:**

```
JAM MULAI
┌────────────────┐  ┌────┐   ┌────┐
│ 12/05/2026  📅 │  │ 08 │ . │ 00 │  WIB
└────────────────┘  └────┘   └────┘
Selasa, 12 Mei 2026 08.00 WIB
```

- Jam **00–23**, menit **00–59**, digambar halaman ini sendiri. Tidak ada jam dua
  belas kedua, jadi tidak ada AM maupun PM yang dapat muncul.
- Pemilih, bukan kotak ketik: menitnya tidak dapat berisi `7` yang sebenarnya
  berarti tujuh menit padahal yang dimaksud tujuh puluh.
- **Tanggalnya dieja kembali di bawahnya.** Kotak tanggal bawaan peramban juga
  menuliskan urutannya menurut bahasa sistem operasinya — `05/12/2026` berarti
  5 Desember pada satu laptop dan 12 Mei pada laptop sebelahnya. Baris
  "Selasa, 12 Mei 2026 08.00 WIB" adalah satu-satunya tempat di layar itu yang
  tidak dapat dibaca terbalik.

**Seluruh jam yang tampil sekarang lewat `jamIndonesia()`** — panel pengajar,
halaman peserta, pesan siap tempel untuk grup, naskah cetak, berita acara, dan
penolakan dari server. Semuanya 24 jam, semuanya zona ujian, dan semuanya
membawa huruf zonanya: `12 Mei 08.00 WIB`, bukan `08.00` yang harus ditebak jam
siapa.

### Tombol yang abu-abu bila syaratnya belum terpenuhi

Dulu syarat jadwal **hanya** dijaga server: pengajar menekan tombol biru yang
tampak siap, lalu membaca penolakan merah — pada jam ketika peserta sudah duduk
di ruangan.

Sekarang syaratnya diperiksa lebih dulu di layar, dan tombolnya **benar-benar
abu-abu**, bukan biru yang dipudarkan:

| Keadaan | Yang tertulis |
|---|---|
| tanggal/jam/menit belum lengkap | Tanggal, jam, dan menit — mulai maupun selesai — harus terisi lengkap. |
| selesai ≤ mulai | Jam selesai harus sesudah jam mulai. |
| jendela lebih pendek daripada durasi | Jendela ujian hanya 90 menit, sedangkan durasinya 120 menit. Peserta akan terpotong waktunya. |
| bank soal kosong | Bank soal masih kosong. Isi soalnya dulu. |
| bank lebih sedikit daripada yang dipakai | Ujian menuntut 20 soal, sedangkan banknya baru 15. |

Alasannya ditulis persis di atas tombolnya — tombol mati tanpa alasan hanya
memindahkan kebingungan, tidak menghapusnya. **Penjagaan di server tidak ikut
dilepas:** halaman dapat diubah dari alat pengembang, dan jadwal ujian tidak
boleh bergantung pada tombol yang patuh.

### Dan di layar peserta

Tombol **MULAI UJIAN** kini ikut abu-abu selama ujiannya belum boleh dikerjakan —
belum dijadwalkan, belum diaktifkan pengajarnya, atau jamnya belum tiba:

```
┌────────────────────────────────────────┐
│        TERBUKA DALAM 42 MENIT          │   ← abu-abu, tidak dapat ditekan
└────────────────────────────────────────┘
Tombol ini menyala sendiri pada Selasa, 12 Mei 2026 08.00 WIB.
Nama dan nomormu boleh diisi dari sekarang.
```

Tiga perubahan kecil yang menyertainya:

- **Kolom nama dan nomor tidak lagi disembunyikan.** Dulu peserta yang membuka
  tautannya sepuluh menit lebih awal melihat halaman tanpa satu pun kolom isian,
  menutupnya, lalu mengetik namanya terburu-buru sesudah ujian berjalan.
- **Yang membuka tombolnya adalah status dari server,** yang diambil ulang tiap
  lima belas detik — bukan jam perangkat. Kalau jam perangkat yang memutuskan,
  memundurkan jam laptop sudah cukup untuk masuk lebih awal; dan peserta yang jam
  ponselnya terlambat akan menatap tombol abu-abu sesudah ujiannya benar-benar
  dibuka.
- Hitungan mundurnya berdetak tiap detik, tetapi ia hanya menulis — tidak pernah
  memutuskan apa pun.

---

## 3. Soal bergambar tidak lagi menuntut gulungan untuk menekan "Lanjut"

### Yang salah

Layar mengerjakan setinggi isinya. Soal bergambar mendorong tombol
**SOAL SELANJUTNYA** ke bawah lipatan, dan peserta harus menggulung dulu untuk
menemukannya — pada **tiap** nomor bergambar. Pada ujian berwaktu itu bukan
ketidaknyamanan kecil: ia detik yang hilang berkali-kali, dan tangan yang sudah
hafal letak tombolnya menekan tempat yang salah.

Gambar potret dari kamera ponsel — dan pengajar memang memotret soalnya dengan
ponsel — muat lebarnya tetapi tingginya dua kali layar.

### Yang berubah

Layar mengerjakan sekarang **persis setinggi jendela dan tidak pernah lebih**:

```
┌─────────────────────────────────────┐ ← bilah atas, tetap
├─────────────────────────────────────┤
│ SOAL NO. 3          SISA 00:42:11   │ ← kepala kartu, tetap
├─────────────────────────────────────┤
│ Perhatikan bagan berikut…           │
│ ┌───────────┐                       │ ← HANYA bagian ini
│ │  gambar   │                       │   yang bergulir
│ └───────────┘                       │
│ ○ A. …                              │
├─────────────────────────────────────┤
│ ‹ SEBELUMNYA  RAGU  SELANJUTNYA ›   │ ← tombol jalan, tetap
└─────────────────────────────────────┘
```

- `.uj-kerja` menjadi kolom flex setinggi `100dvh` yang tidak bergulir.
- `.ck-kartu-isi` satu-satunya yang bergulir; kepala dan kaki kartunya tidak
  pernah ikut bergerak.
- Tinggi gambar dan video dibatasi terhadap **tinggi jendela**, bukan lebarnya
  sendiri: `min(52dvh, 34rem)`, dan `min(42dvh, 22rem)` di ponsel supaya selalu
  ada satu baris pilihan jawaban yang menyembul — satu baris yang menyembul
  itulah yang memberi tahu bahwa di bawahnya masih ada.
- Bingkai video sematan ikut dibatasi tinggi jendela, sebab bingkai 16:9 selebar
  kartu pada layar pendek sendirian sudah lebih tinggi daripada seluruh ruang
  yang tersisa.
- Tinggi minimum kartu dihapus: pada layar pendek — ponsel yang dimiringkan,
  jendela peramban yang separuh — tinggi minimum apa pun akan mendorong tombol
  jalan ke bawah lipatan lagi.
- Di ponsel palet nomor turun satu gulungan di bawah kartu, tempat yang memang
  hanya ditengok sesekali.

Diperiksa pada enam ukuran layar dengan gambar potret 900×1600. Pada keenamnya
tombol **SOAL SELANJUTNYA** berada di dalam layar dan halamannya sendiri tidak
bergulir:

| Ukuran | Tombol lanjut | Halaman bergulir |
|---|---|---|
| 390×844 (ponsel tegak) | y=750 | tidak |
| 360×640 (ponsel kecil) | y=546 | tidak |
| 844×390 (ponsel miring) | y=348 | tidak |
| 820×1180 (tablet) | y=1138 | tidak |
| 1366×768 (laptop) | y=736 | tidak |
| 1280×600 (laptop pendek) | y=568 | tidak |

Aturan cetak ikut dibetulkan: tinggi tetap dan luapan tersembunyi dilepas pada
`@media print`, karena lembar cetak tidak punya "tinggi jendela".

---

## 4. "Kehilangan fokus" pada peserta yang belum melihat satu soal pun

### Yang salah

Keluhannya: *"baru masuk sudah terdeteksi kehilangan fokus, padahal tidak
melakukan apa pun."* Dan itu benar — yang terjadi pada detik-detik pertama
sebuah ujian tidak satu pun dilakukan pesertanya:

1. **Permintaan layar penuh** berpindah mode tampilan, dan sebagian peramban
   melepas fokus jendelanya sesaat ketika itu terjadi.
2. **Kotak izin kamera** — pada mode Sertifikasi ini selalu muncul — berdiri di
   atas halaman dan **memegang fokusnya** sampai ditekan. Peserta yang membaca
   kotak izinnya lebih dulu menekan "Izinkan" pada detik kesepuluh, dan
   detik-detik itu menjadi pelanggaran atas namanya.
3. Chrome bahkan **melepas layar penuh sendiri** ketika menampilkan kotak izin —
   dan itu tercatat sebagai pelanggaran berat.

Pendengarnya dulu sesederhana ini:

```ts
function hilang() { kirim("blur"); }
window.addEventListener("blur", hilang);
```

Tidak ada satu pun saringan di antaranya.

### Yang berubah

Blur sekarang melewati **tiga saringan** sebelum ia menjadi catatan atas nama
peserta:

1. **Masa mula.** Lima detik sesudah layar mengerjakan terbuka, ditambah selama
   kotak izin kamera masih menunggu ditekan. Kameranya mengabarkan sendiri kapan
   izinnya selesai — diizinkan, ditolak, atau gagal; ketiganya sama saja bagi
   yang menunggunya — lewat `selesaiIzin`. Ada jaring pengaman dua puluh detik,
   supaya kabar yang karena satu dan lain hal tidak sampai tidak mematikan
   deteksinya sepanjang ujian.
2. **Bingkai soal.** Fokus yang berpindah ke `<iframe>` **di dalam** halaman ini
   juga memicu blur pada window. Peserta yang menekan tombol putar pada video
   soalnya sedang mengerjakan soal itu, bukan meninggalkannya.
3. **Tundaan satu setengah detik.** Yang pulih sendiri secepat itu bukan orang
   yang pergi. Yang benar-benar berpindah ke jendela lain tidak kembali dalam
   satu setengah detik — dan ia tetap tercatat, apa adanya.

Ditambah satu saringan yang membetulkan hitungan ganda lama: berpindah tab
memicu `blur` **dan** `visibilitychange` sekaligus, dan yang kedua sudah
mencatatnya sebagai `tab` — yang jauh lebih berat. Satu perbuatan sekarang
tercatat satu kali.

Keluar dari layar penuh mendapat masa mula yang sama, tetapi **hanya laporannya
yang ditahan**: tirainya tetap menutup soal sejak detik pertama, dan pesertanya
tetap diminta kembali ke layar penuh. Yang hilang catatan palsunya, bukan
penjagaannya.

Berpindah tab tetap dicatat apa adanya sejak detik pertama, tanpa masa mula
sama sekali.

---

## Berkas yang berubah

| Berkas | Yang dikerjakan |
|---|---|
| `src/lib/waktu-indonesia.ts` | **baru** — zona ujian, pemecah dan penyusun jam, penulis jam 24 jam |
| `src/app/dashboard/cbt-panel.tsx` | panel hitung soal, pemilih jam, syarat aktivasi |
| `src/app/cbt/ujian/ujian-app.tsx` | tombol Mulai abu-abu + hitungan mundur, kabar izin kamera |
| `src/app/cbt/ujian/penjaga.ts` | tiga saringan blur, masa mula layar penuh |
| `src/app/cbt/ujian/kamera.tsx` | `selesaiIzin` — kabar bahwa kotak izinnya sudah ditekan |
| `src/app/api/cbt/ikut/route.ts` | jam pada penolakan "belum dibuka" tidak lagi UTC |
| `src/lib/cetak-cbt.ts` | jam pada naskah dan berita acara tidak lagi UTC |
| `src/app/globals.css` | tata letak satu layar, batas tinggi media, gaya panel hitung dan pemilih jam |
| `uji-waktu-ujian.ts` | **baru** — 57 pemeriksaan |
| `uji-kosakata-cbt.ts` | berkas jam ikut dijaga kosakatanya |

---

## Cara menguji

```bash
npx tsx uji-waktu-ujian.ts
```

57 pemeriksaan. Jalankan juga dengan zona perangkat yang diputar — hasilnya harus
sama persis, dan itulah seluruh maksudnya:

```bash
TZ=UTC              npx tsx uji-waktu-ujian.ts
TZ=America/New_York npx tsx uji-waktu-ujian.ts
TZ=Pacific/Auckland npx tsx uji-waktu-ujian.ts
TZ=Asia/Makassar    npx tsx uji-waktu-ujian.ts
```

Uji CBT yang sudah ada tetap harus lulus:

```bash
npx tsx uji-cbt.ts            # 83
npx tsx uji-cetak-cbt.ts      # 86
npx tsx uji-pelaksanaan-cbt.ts # 32
npx tsx uji-pengawasan.ts     # 240
npx tsx uji-kunci-layar.ts    # 145
npx tsx uji-tombol.ts         # 188
npx tsx uji-media-cbt.ts      # 38
npx tsx uji-kosakata-cbt.ts   # 11 atas 35 berkas
npx tsx uji-situs-cbt.ts      # 56
```

**Tidak ada migrasi basis data.** Kolom `start_at` dan `end_at` tetap menyimpan
saat yang sama seperti sebelumnya; yang berubah hanya cara jam itu dibaca dan
ditulis di layar. Jadwal yang sudah tersimpan sebelum pembaruan ini tetap
menunjuk saat yang sama — bila dahulu disetel dari perangkat berzona WIB, yang
tampil sekarang juga jam yang sama persis.
