# v28: CBT — tautan yang dibangkitkan sendiri (beserta QR-nya), dan rupa yang tidak lagi putih polos

Dua permintaan pemilik portal:

1. **"Generate link CBT."** Bangkitkan tautan ujiannya, jangan disusun sendiri
   satu per satu di grup kelas.
2. **"Sesuaikan designnya seperti sipalingfisip.web.id/cbt atau lebih bagus
   lagi UI/UX-nya, jangan polos putih."**

Tidak ada perubahan basis data. Tidak ada berkas SQL baru yang perlu
dijalankan — cukup deploy seperti biasa.

---

## 1. Tautan ujian yang dibangkitkan, bukan dirakit sendiri

### Bentuk barunya pendek

Dulu tautan yang tersalin dari panel dosen berbentuk:

```
https://sipalingfisip.web.id/ujian?kode=K7M2QX
```

Sekarang:

```
https://sipalingfisip.web.id/cbt/u/K7M2QX      ← domain utama
https://cbt.sipalingfisip.web.id/u/K7M2QX      ← bila CBT_HOST dipasang
```

Bukan demi cantik. Tautan itu **dibacakan di depan kelas**, **diketik ulang**
oleh mahasiswa yang salinannya gagal terkirim, dan **dicetak sebagai QR** pada
poster ruang ujian. `?kode=` yang panjang gagal pada ketiganya.

Alamat lama `/ujian?kode=...` **tetap hidup** dan mengalihkan ke tempat yang
benar: tautan yang sudah terlanjur beredar di grup kelas tidak boleh mati.

### Domainnya ditentukan server, bukan peramban

Ini yang paling penting dan paling tidak kelihatan.

Dulu alamatnya dirakit di dalam panel dosen dengan `window.location.origin`.
Itu benar **hanya** selama CBT dibuka dari domain utama. Begitu `CBT_HOST`
diisi dan ujian pindah ke subdomainnya sendiri, tautan yang tersalin ke grup
kelas masih menunjuk domain lama — dan yang menemukannya bukan penulis
kodenya, melainkan tiga puluh mahasiswa lima menit sebelum ujian.

Sekarang alamatnya disusun **di server** (`/api/cbt/tautan`), yang memang
satu-satunya pihak yang tahu isi environment. Peramban hanya menampilkan apa
yang diterimanya. Selama jawabannya belum tiba, panel memakai penyusun yang
sama persis di sisi peramban, jadi bentuknya tidak pernah berganti-ganti di
depan mata dosen.

Penyusunnya tinggal di satu berkas, `src/lib/tautan-cbt.ts`, seluruhnya fungsi
murni — dipakai server maupun peramban, dan dapat diuji tanpa menyalakan apa
pun.

### Environment yang dibaca

| Variabel | Isi | Bila kosong |
| --- | --- | --- |
| `CBT_HOST` | `cbt.sipalingfisip.web.id` — tuan rumah subdomain CBT, sudah dipakai middleware sejak v24 | Tautan memakai `/cbt` pada domain utama |
| `NEXT_PUBLIC_CBT_URL` | Alamat penuh, mis. `https://ujian.kampus.ac.id`. Mengalahkan `CBT_HOST` | `CBT_HOST` yang dipakai |

Keduanya opsional. Tanpa keduanya semuanya tetap berjalan penuh.

---

## 2. Panel "Tautan ujian & kode QR" di dashboard

Menggantikan kotak "Bagikan ke mahasiswa" yang lama. Isinya:

- **Kode QR** — ditampilkan besar, dirakit server dengan pustaka `qrcode` yang
  sudah dipakai QRIS Cakrawala. Toleransi galatnya **M**, bukan L: poster
  ujian ditempel di pintu ruangan, tersentuh tangan, dan tercetak pencetak
  kantor yang tintanya menipis.
- **Tautan ujian** dan **kode ujian** berdampingan, masing-masing dengan
  tombol salin.
- **Kode pengawas**, bila ujiannya memakainya.
- **📋 Salin pesan siap tempel untuk grup** — tautan, kode, jumlah soal, waktu,
  jam buka dan tutup, dalam satu tempelan.
- **💬 Kirim lewat WhatsApp** — membuka daftar obrolan dengan pesannya sudah
  terisi.
- **📤 Bagikan…** — lembar berbagi bawaan sistem. Hanya muncul bila
  perambannya memilikinya; tombol yang tampil lalu tidak melakukan apa-apa
  lebih buruk daripada tombol yang tidak ada.
- **🖨 Cetak poster QR** — lihat di bawah.
- **⬇ Unduh QR (PNG)** — untuk ditempel ke grup, slide, atau lembar soal.

Ujian yang belum diaktifkan diberi keterangan kuning: tautannya sudah boleh
dibagikan sekarang, tetapi baru terbuka setelah diaktifkan dan jam mulainya
tiba.

### Poster satu halaman

Tombol **Cetak poster QR** membuka lembar A4 siap cetak: QR besar di tengah,
lalu **alamat** dan **kode ujian** berdampingan di bawahnya, disusul lama
pengerjaan, jumlah soal, jam buka dan tutup, serta tiga langkah yang harus
dilakukan mahasiswa.

Ketiga jalan masuk dicetak sekaligus dengan sengaja, karena di ruang ujian
selalu ada ketiga keadaannya: yang memindai QR, yang mengetik alamatnya karena
kameranya menolak memindai, dan yang sudah membuka layar depan CBT dan hanya
butuh kodenya.

Alamatnya ditulis **tanpa `https://`** — tujuh huruf yang sama pada setiap
alamat di dunia tidak menolong siapa pun yang sedang mengetik dari jarak lima
meter.

---

## 3. Rupa situs CBT: tidak lagi putih polos

### Pintu masuk `/cbt`

Bentuk dua kolomnya dipertahankan — itu rujukan rancangan yang diberikan
pemilik portal — tetapi keduanya diperdalam:

- **Kolom kiri** memakai gradasi nila berlapis, jala tipis yang dipudarkan ke
  tepi, dan satu cahaya samar di sudut. Kata "CBT" pada judulnya diberi warna
  emas: judul satu warna pada latar biru penuh terbaca sebagai blok, bukan
  sebagai nama. Centang pada daftar keunggulan kini lingkaran emas pekat
  dengan centang nila, bukan emas di atas emas samar yang terbaca kusam.
- **Kolom kanan BUKAN putih polos lagi.** Yang berdiri di sana adalah kartu,
  dan kartu hanya terbaca sebagai kartu bila ada sesuatu di belakangnya:
  kanvas biru sangat muda, jala samar, dua cahaya di sudut, dan garis warna
  setipis empat piksel pada tepi atas kartunya. Halaman putih rata dengan
  kotak putih di tengahnya tidak punya kedalaman sama sekali — dan itu justru
  bentuk yang paling sering dipakai halaman phishing.
- Di ponsel, tautan **kembali ke portal** dimunculkan di dalam kartunya:
  kolom kiri yang biasanya membawanya disembunyikan di layar sempit, dan yang
  salah membuka CBT tidak boleh terkurung di dalamnya.

### Layar kode, identitas, dan selesai

Latarnya dulu abu-abu rata `#e6e6e6`. Sekarang gradasi nila berjenama dengan
jala tipis dan dua cahaya samar — dan di atasnya kartu putih terang, karena
yang dibaca di sana adalah nama, NIM, dan lama waktu ujian.

Ditambahkan **kepala jenama** di atas kartu: lambang, "SiPaling CBT", dan
"Ujian Berbasis Komputer · FISIP". Layar-layar ini dibuka dari tautan yang
diteruskan berkali-kali sampai pengirim aslinya tidak lagi kelihatan; nama
sistemnya harus ada di layar **sebelum** ada yang mengetikkan NIM-nya ke
dalamnya.

Kotak isian dan tombolnya ikut dirapikan: sudut lebih lunak, tombol utama
bergradasi dengan bayangan warna, dan kotak kode ujian dibuat sebesar mungkin
tanpa keluar dari kartunya.

### Layar mengerjakan

**Tetap terang.** Yang dibaca di sini soal ujian selama satu jam penuh, dan
latar gelap yang cantik pada tangkapan layar adalah latar yang melelahkan pada
menit keempat puluh.

Yang berubah hanya rasanya: kelabu rata diganti kanvas bergradasi tipis, bilah
atas menjadi gradasi nila→biru dengan garis emas setipis dua piksel di
bawahnya, kartu soal dan panel nomor mendapat sudut lebih lunak serta bayangan
yang benar-benar mengangkatnya, dan lencana nomor soal serta sisa waktu
menjadi pil.

Susunan, warna palet nomor, dan legendanya **tidak disentuh** — ketiganya
membawa arti, dan mengubahnya berarti mengubah hal yang sudah dihafal
mahasiswa.

---

## 4. Berkas yang berubah

| Berkas | Perubahan |
| --- | --- |
| `src/lib/tautan-cbt.ts` | **baru** — penyusun alamat, pesan grup, tautan WhatsApp. Fungsi murni. |
| `src/app/api/cbt/tautan/route.ts` | **baru** — tautan + QR (SVG & PNG) satu ujian, dijaga wewenang pemantau |
| `src/app/cbt/u/[kode]/page.tsx` | **baru** — tautan pendek, merender ujiannya langsung tanpa pengalihan |
| `src/lib/cetak-cbt.ts` | `posterTautanHtml()` — poster QR satu halaman |
| `src/app/cbt/ujian/ujian-app.tsx` | menerima `kodeAwal`; kepala jenama pada empat layar berkartu |
| `src/app/cbt/masuk-cbt.tsx` | judul dua warna, tautan portal untuk ponsel |
| `src/app/dashboard/cbt-panel.tsx` | panel "Tautan ujian & kode QR" |
| `src/app/globals.css` | rupa situs CBT dan panel tautan di dashboard |
| `uji-tautan-cbt.ts` | **baru** — 46 pemeriksaan |

---

## 5. Pengujian

```
npx tsx uji-tautan-cbt.ts
```

46 pemeriksaan, tanpa basis data dan tanpa jaringan. Yang dijaga antara lain:

- tautan menunjuk domain yang benar pada kedua pemasangan (dengan dan tanpa
  subdomain) — bila yang kedua salah, alamatnya menjadi `/cbt/cbt` dan seluruh
  kelas mendarat di 404;
- `javascript:` dan `data:` yang terselip ke environment **ditolak**, tidak
  pernah tercetak sebagai tautan;
- kode ujian yang membawa garis miring tidak pernah dapat keluar dari
  `/cbt/u/`;
- tanpa `x-forwarded-proto`, domain sungguhan tetap menghasilkan `https` —
  tautan `http` yang tersebar ke grup kelas adalah cacat yang tidak kelihatan;
- judul ujian yang memuat `<` dan `>` dilolos-kan sebelum masuk poster.

Selain itu: `npm run lint`, `npx tsc --noEmit`, dan `npm run build` bersih.
