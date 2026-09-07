# v30: Kunci tangkapan layar, kode QR ujian, dan warna Benar/Salah

Tiga hal, dan yang ketiga yang paling banyak pekerjaannya.

1. **Benar berlatar hijau, Salah berlatar merah** — di layar pengajar, di layar
   peserta, dan di berkas cetaknya.
2. **Kode QR ujian** di panel *Bagikan ke peserta*, lengkap dengan tombol unduh
   dan poster siap tempel.
3. **Kunci tangkapan layar** — tirai di sisi web, dan dua **Aplikasi Ujian
   Terkunci** yang sistem operasinya sendiri yang menolak.

Satu berkas SQL baru: **`supabase-update-v30-kunci-layar.sql`**. Jalankan sekali
di SQL Editor Supabase; aman diulang.

---

## 1. Benar hijau, Salah merah

Sebelumnya lencana pada lembar jawaban meminjam warna **lencana status** —
dan lencana status "berjalan" berwarna **hijau**. Akibatnya jawaban yang SALAH
tercetak hijau, dan jawaban yang benar tercetak biru. Pengajar yang menggulir
cepat membaca lembar itu terbalik.

Sekarang:

| Keadaan | Warna | Kapan |
| --- | --- | --- |
| Benar | hijau | jawabannya benar penuh |
| Benar sebagian | kuning | PG kompleks dan penjodohan yang benar sebagian |
| Salah | merah | jawabannya salah |
| Menunggu koreksi | abu-abu | essay yang belum dinilai pengajar |

"Benar sebagian" adalah keadaan **baru di layar**, bukan hitungan baru: ia sudah
lama dihitung terpisah di basis data, tetapi lencananya dahulu ikut berbunyi
"Salah". Peserta yang benar tiga dari empat pasangan tetap mendapat poin, dan
lembar yang menyebutnya salah akan digugat — dengan alasan yang benar.

Kesimpulannya kini dibuat **satu fungsi** (`keadaanJawab` di `src/lib/cbt.ts`)
yang dipakai layar dan kertas sekaligus. Dahulu keduanya menyimpulkannya
sendiri-sendiri, dan dua tempat yang menyimpulkan hal yang sama pada akhirnya
akan menyimpulkannya berbeda — pada berkas yang justru dilampirkan ke berita
acara.

Di layar peserta, kotak **benar** dan **salah** ikut berwarna. Kotak "kosong"
sengaja dibiarkan netral: soal yang tidak dijawab bukan jawaban yang salah, dan
mengecatnya merah menghukum dua kali untuk satu hal yang sama.

Pada laporan tercetak, `print-color-adjust: exact` ikut dipasang. Tanpa baris
itu peramban membuang seluruh warna latar saat mencetak, dan yang tersisa di
kertas hanya kata "benar" dan "salah" berlatar putih yang sama.

---

## 2. Kode QR ujian

Panel **Bagikan ke peserta** kini membuka dengan kode QR-nya.

Yang dipindai bukan kode ujiannya melainkan **tautan lengkapnya**, jadi kamera
ponsel mana pun langsung membuka halaman ujian dengan kodenya sudah terisi.
Inilah yang menghapus sepuluh menit pertama yang selalu hilang karena "0"
tertukar dengan "O".

Tiga cara memakainya:

- **Di layar** — tayangkan panelnya ke papan, seluruh kelas memindai sekaligus.
- **⬇ Unduh QR (PNG)** — berkas gambar untuk ditempel ke grup kelas atau
  dimasukkan ke salindia. PNG, bukan SVG: SVG lebih tajam tetapi tidak dapat
  ditempel ke percakapan WhatsApp.
- **🖨 Cetak poster QR** — satu halaman A4 berisi QR besar, kode ujian
  besar-besar, alamatnya, jadwalnya, dan empat langkah pengerjaan. Untuk
  ditempel di pintu ruang ujian.

Kode ujian **tetap** tercetak besar di bawah QR-nya, dan itu bukan hiasan:
ponsel dengan kamera rusak, kamera yang tidak diizinkan, dan komputer
laboratorium tanpa kamera semuanya nyata. Poster yang hanya memuat QR
meninggalkan mereka tanpa jalan masuk.

Penggambar QR dimuat **saat dibutuhkan**, bukan ikut terkirim bersama seluruh
dashboard. Bila ia gagal dimuat, panelnya tetap utuh — tautan dan kodenya ada
di sana — dan posternya tetap dapat dicetak tanpa QR.

---

## 3. Kunci tangkapan layar

Bagian yang paling panjang, dan harus dibuka dengan satu kalimat yang tidak
dapat ditawar:

> **Peramban tidak dapat melarang tangkapan layar. Sistem operasi dapat.**

Tidak ada satu pun API web yang menahan Print Screen, alat potong bawaan,
perekam layar, apalagi tombol Volume + Power di ponsel. Siapa pun yang
menjanjikan sebaliknya sedang menjual sesuatu yang tidak ada.

Karena itu pembaruan ini bekerja di **dua lapisan**, dan keduanya mengatakan
kemampuannya apa adanya.

### Lapisan 1 — Tirai, di situs web

Begitu ada isyarat tangkapan layar, atau begitu halaman ujian ditinggalkan,
**soal ditutup bidang gelap** bertuliskan nama peserta.

Ia **tidak menggagalkan** tangkapan layarnya. Ia **mengosongkan isinya**. Yang
tertangkap bukan soal melainkan tirai beserta identitas pengambilnya — dan
gambar yang isinya hanya nama sendiri beserta peringatan adalah gambar yang
tidak seorang pun mau sebarkan.

Seberapa jauh ia berhasil, apa adanya:

| Cara mengambil | Tirai menang? |
| --- | --- |
| Alat potong (Win+Shift+S, Cmd+Shift+4) | **hampir selalu** — masih ada seretan kotak seleksi sesudah pintasannya ditekan |
| Pindah aplikasi, tarik baris notifikasi, layar terkunci | **ya** |
| Perekam layar yang dinyalakan dari aplikasi lain | **ya** |
| Print Screen | **sering tidak** — sistem menyalin layar pada saat tombolnya turun |
| Volume + Power di ponsel | **tidak pernah tahu** — tidak ada peristiwa web untuk itu |

Baris terakhir itulah yang menuntut lapisan kedua.

Tirai menyala pada mode pengawasan **Ketat** dan **Sertifikasi/OSCE**. Mode
Biasa untuk kuis harian tidak berubah sama sekali.

### Lapisan 2 — Aplikasi Ujian Terkunci

Ada di `lockdown/`, dua aplikasi kecil yang menjalankan halaman ujian yang sama
persis di dalam jendela yang **sistem operasinya sendiri menolak untuk
ditangkap**.

| Perangkat | Panggilan | Akibatnya |
| --- | --- | --- |
| Android | `FLAG_SECURE` | Sistem menolak tangkapan layar dan perekaman, lalu menampilkan pesannya sendiri: *"Tidak dapat mengambil tangkapan layar karena kebijakan keamanan."* |
| Windows | `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` | Jendela ujian menjadi **hitam** pada setiap tangkapan layar dan setiap perekaman — Print Screen, Snipping Tool, Win+Shift+S, Xbox Game Bar, OBS, Zoom share, Teams share |

Keduanya **tidak memuat satu pun logika ujian**. Tidak ada soal, tidak ada
penilaian, tidak ada jam mundur di sana — semuanya tetap di situs CBT yang sama.
Yang ditambahkan hanya lingkungan tempat halaman itu dijalankan. Petunjuk
membangun dan menandatanganinya ada di `lockdown/README.md`.

Keduanya juga membatasi navigasi ke luar situs ujian, menyembunyikan bilah
sistem, dan menutup pintasan alat pengembang.

### Menyalakannya

Buka ujiannya → **Pengaturan** → centang **"Wajib lewat Aplikasi Ujian
Terkunci"**.

Sesudah itu peserta yang membuka dari peramban biasa **ditolak di pintu masuk**,
beserta kalimat yang menyebutkan apa yang harus ia unduh — bukan ditolak di
tengah ujian, dan bukan dibiarkan mengerjakan tanpa penjagaan. Gerbang yang sama
berdiri pada pemulihan sesi, supaya jalan memutarnya tertutup: mulai dari
aplikasi, salin kunci sesinya, lanjutkan dari peramban.

Setelan ini **mati secara bawaan**, dan itu disengaja. Menyalakannya berarti
setiap peserta harus memasang aplikasi lebih dulu.

> **Beri tahu kelasnya sehari sebelumnya, beserta tautan unduhannya.** Ujian
> yang menyalakannya pagi hari pelaksanaan akan menolak seluruh pesertanya.

### Apa yang dilihat peserta

Layar identitas menyebutkan sejauh mana layarnya benar-benar dijaga, dan
kalimatnya **berbeda menurut perangkatnya**:

- Aplikasi terkunci → *"Tangkapan layar dan perekaman layar diblokir sistem."*
  Lencana 🔒 **Layar terkunci** ikut berdiri di bilah atas selama mengerjakan.
- Peramban biasa → *"Percobaan tangkapan layar dicatat pengawas beserta jamnya,
  dan soal ditutup sesaat setiap kali terdeteksi."*

Bedanya bukan basa-basi. "Tangkapan layar diblokir" pada peramban biasa akan
diuji peserta pertama dalam lima detik; begitu terbukti tidak benar, seluruh
peringatan lain di layar itu ikut kehilangan wibawanya — termasuk yang
sungguh-sungguh ditegakkan.

### Apa yang dilihat pengajar

Papan pantau menandai baris yang **menyimpang**, bukan mendaftar perangkat semua
orang:

- 🔒 **Aplikasi Ujian Android / Windows** — layarnya benar-benar terkunci.
- ⚠ **peramban biasa, layarnya tidak terkunci** — hanya pada ujian yang
  mewajibkan aplikasi, mis. peserta yang sudah mulai sebelum kewajibannya
  dinyalakan.

Perangkatnya tersimpan pada baris percobaannya, bukan disimpulkan ulang dari
User-Agent saat laporannya dibaca. Inilah satu-satunya jawaban atas pertanyaan
yang muncul ketika hasil ujian digugat berbulan-bulan kemudian: layar peserta
ini terkunci atau tidak.

### Yang TIDAK dijanjikan

Tetap, dan tidak berubah oleh pembaruan ini:

- **Ponsel kedua yang diarahkan ke monitor.** Tidak ada, dan tidak akan pernah
  ada, perangkat lunak yang menghalanginya. Yang menjawabnya pengawas ruangan.
- **iOS.** Apple tidak menyediakan padanan `FLAG_SECURE` bagi aplikasi biasa.
  Karena itu tidak ada `lockdown/ios/`: aplikasi yang dijanjikan mengunci layar
  tetapi tidak mengunci apa pun lebih buruk daripada tidak ada aplikasinya.
- **Perangkat yang sudah di-root**, mesin virtual, dan penangkap gambar HDMI.
- **Windows lebih tua dari versi 2004.** Aplikasinya jatuh ke penguncian yang
  lebih kasar, dan bila itu pun gagal, ujiannya tetap berjalan tanpa
  penguncian — dicatat, tidak disembunyikan.

Jangan pernah menulis *"100% tidak bisa screenshot"* di layar mana pun. Yang
benar, dan itu pun sudah kuat:

> Ujian berjalan dalam lingkungan terkunci yang menolak tangkapan layar,
> perekaman layar, perpindahan aplikasi, dan navigasi ke luar.

---

## Basis data

```sql
-- supabase-update-v30-kunci-layar.sql
ALTER TABLE public.cbt_exams
  ADD COLUMN IF NOT EXISTS require_lockdown BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.cbt_attempts
  ADD COLUMN IF NOT EXISTS client_type VARCHAR(20) NOT NULL DEFAULT 'peramban';
```

Percobaan lama diberi nilai `'peramban'`, karena memang itulah yang terjadi:
semuanya dikerjakan sebelum aplikasi terkuncinya ada.

## Environment (opsional)

```
CBT_KUNCI_APLIKASI=<tali acak panjang>
```

Kunci bersama yang harus dibawa Aplikasi Ujian Terkunci. Kosongkan bila belum
disiapkan — gerbangnya lalu bersandar pada pengenalan perangkat saja.

Seberapa kuat kunci ini, terus terang: ia ikut tertanam di dalam berkas
aplikasinya, jadi siapa pun yang membongkar `.apk` atau `.exe`-nya dapat
menemukannya. Yang dikerjakannya tetap nyata — ia mengubah *"ketik satu baris di
alat pengembang"* menjadi *"bongkar aplikasinya lebih dulu"* — tetapi ia bukan
kunci sesungguhnya.

---

## Uji

```bash
npx tsx uji-kunci-layar.ts     # 88 pemeriksaan — baru
npx tsx uji-cetak-cbt.ts       # 78 pemeriksaan
npx tsx uji-cbt.ts             # 83 pemeriksaan
npx tsx uji-pengawasan.ts      # 137 pemeriksaan
```

`uji-kunci-layar.ts` tidak menguji "apakah tangkapan layar terblokir" — berkas
uji tidak dapat menekan Print Screen. Yang dijaganya adalah hal yang jauh lebih
mudah rusak dan jauh lebih mahal bila rusak: **siapa yang boleh mengaku
terkunci**. Hampir semua pemeriksaannya menguji arah jatuhnya — masukan yang
meragukan harus selalu jatuh ke "peramban", yang paling longgar dan paling
sedikit janjinya.

Satu perbaikan kecil ikut: `uji-template-soal.ts` dahulu menulis berkas contoh
ke jalur mutlak milik satu komputer, sehingga ia gagal di setiap komputer lain.
Kini ia memakai direktori sementara sistem.
