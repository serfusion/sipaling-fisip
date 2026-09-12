# v38: CBT — mengakhiri ujian tidak lagi berbuah pelanggaran

Satu keluhan, satu sebab, dan sebabnya bukan di tempat yang terlihat.

> "Setelah ingin mengakhiri ujian seharusnya jangan ada konfirmasi lagi, alhasil
> malah terkena pelanggaran keluar dari layar."

---

## Yang salah

Peserta menekan **AKHIRI UJIAN**. Sebelum jawabannya terkirim, sebuah kotak
berdiri di tengah layar dan bertanya "hentikan ujian dan kumpulkan sekarang?".
Ia menekan OK — dan ujiannya berakhir dengan satu **pelanggaran "keluar dari
layar penuh"** tercatat atas namanya, lengkap dengan kotak teguran merah dan
skor integritas yang turun.

Tidak ada yang ia lakukan salah. Yang salah kotaknya.

### Kotak bawaan peramban bukan bagian dari halaman

Pertanyaan itu dahulu ditanyakan `window.confirm()`. Kotak itu **bukan lapisan
di dalam halaman** — ia milik peramban dan berdiri di luar dokumen. Akibatnya
ada dua, dan keduanya nyata:

**a. Chrome melepas layar penuh sebelum menggambarnya.** Ini perilaku Chrome
yang disengaja dan sudah lama: kotak JavaScript tidak pernah digambar di atas
halaman yang sedang layar penuh, karena halaman layar penuh dapat memalsukan
tampilan sistem. Chrome keluar dari layar penuh lebih dulu, baru bertanya.

Halaman ujian tidak tahu apa-apa tentang keputusan itu. Yang sampai kepadanya
satu peristiwa `fullscreenchange` yang tidak diminta siapa pun, dan penjaga
ujian membacanya persis seperti peserta yang menekan Esc untuk mengintip jendela
lain:

```
peserta menekan AKHIRI UJIAN
   → window.confirm() dipanggil
      → Chrome keluar dari layar penuh          ← bukan perbuatan peserta
         → fullscreenchange
            → penjaga: "keluar dari layar penuh"
               → pelanggaran berat, kotak teguran, skor turun
```

Pada mode Ketat dan Sertifikasi ini bukan catatan kecil: `fullscreen` termasuk
pelanggaran yang **ikut menghitung mundur** ke pengumpulan paksa. Peserta yang
ragu-ragu lalu membatalkan, ragu lagi, lalu benar-benar mengumpulkan, dapat
mengumpulkan tiga pelanggaran hanya dari tiga kali menekan tombol yang sama.

**b. Peramban lain melepas fokus jendelanya** selama kotak itu berdiri. Peserta
yang membaca pertanyaannya lebih dari satu setengah detik — dan "yakin mau
mengumpulkan?" memang dibaca lebih lama dari itu — mendapat catatan "jendela
kehilangan fokus" sebagai gantinya.

Kotak yang sama juga dipakai tombol **Logout**, dengan akibat yang persis sama.

---

## Yang berubah

Pertanyaannya sekarang **digambar halaman ujian itu sendiri**: satu lapisan
`<div>` di dalam dokumen yang sama. Layar penuhnya tidak pernah lepas, fokusnya
tidak pernah keluar, dan tidak ada satu peristiwa pun yang sampai ke penjaga.

```
┌──────────────────────────────────────────────────────────────┐
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ (garis merah)         │
│                                                              │
│   Kumpulkan jawaban dan akhiri ujian?                        │
│                                                              │
│   ( Masih ada 3 soal belum dijawab dan 2 soal ditandai       │
│     ragu-ragu. )                                             │
│                                                              │
│   Jawabanmu dikumpulkan dan ujian ditutup. Lembar ini tidak  │
│   dapat dibuka lagi, dan sisa waktunya tidak dapat dipakai   │
│   lagi.                                                      │
│                                                              │
│              ┌───────────────────────┐ ┌──────────────────┐  │
│              │ Belum, kembali ke soal│ │ Ya, kumpulkan    │  │
│              └───────────────────────┘ └──────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

Empat hal yang menentukan bentuknya, dan tak satu pun hiasan:

1. **Fokusnya jatuh ke tombol BATAL, bukan ke tombol yang menutup ujian.**
   Peserta yang menekan Enter karena terbiasa dengan kotak bawaan peramban tidak
   akan mengumpulkan ujiannya tanpa membaca. Fokus yang berpindah **di dalam**
   dokumen tidak pernah memicu `blur` pada jendela, jadi ia tidak pernah menjadi
   catatan atas nama siapa pun.
2. **Tidak ada tombol Esc.** Esc di dalam layar penuh dimiliki peramban, bukan
   halaman: menekannya keluar dari layar penuh, dan itu persis pelanggaran yang
   sedang diperbaiki. Kotak ini hanya punya dua jalan keluar, dan keduanya
   tombol.
3. **Di bawah tirai dan kotak teguran** (z-index 55 lawan 60 dan 70). Peserta
   yang membuka kotak ini lalu keluar dari layar penuh tetap mendapat tirai
   gelapnya, bukan soal yang terbuka di belakang sebuah kotak yang boleh
   dibiarkan terbuka.
4. **Di ponsel tombolnya melebar penuh dan yang membatalkan berdiri di bawah.**
   Ibu jari yang menggapai dari tepi bawah layar mengenai yang aman lebih dulu.

### Lapis kedua: dua insiden yang memang milik penutupan

Kotak baru menutup sebabnya, tetapi satu peristiwa lagi tetap datang sesudahnya
dan ia memang seharusnya datang: **halaman ujian melepas layar penuhnya sendiri
begitu jawaban terkumpul**, supaya pesertanya tidak tertinggal terkunci di layar
penuh berisi halaman hasil. Fokusnya berpindah ke layar hasil pada saat yang
sama.

Karena itu, sejak "kumpulkan" ditekan sampai pengirimannya selesai, dua insiden
— dan hanya dua — berhenti dicatat atas nama peserta:

| Insiden | Selama pengumpulan berjalan |
|---|---|
| `fullscreen` keluar dari layar penuh | **tidak dicatat** — halaman sendiri yang melepasnya |
| `blur` jendela kehilangan fokus | **tidak dicatat** — fokusnya pindah ke layar hasil |
| `tab` pindah tab atau aplikasi | tetap dicatat |
| `tangkap` tangkapan layar | tetap dicatat |
| `tempel` menempel ke kolom jawaban | tetap dicatat |
| `devtools` alat pengembang | tetap dicatat |
| `salin`, `klik_kanan`, `layar_kedua`, seluruh insiden kamera | tetap dicatat |

Daftarnya satu fungsi di `src/lib/pengawasan.ts` — `milikPengakhiran()` — supaya
ia dapat diuji sendiri dan supaya tidak ada tempat kedua yang menebak-nebak
isinya.

### Yang sengaja TIDAK ikut berubah

**Pengawasan tidak dijeda selama kotaknya terbuka.** Ini bagian yang paling
mudah salah dan paling mahal bila salah. Menidurkan penjaga selama sebuah kotak
konfirmasi menunggu akan membuka jalan curang termurah yang dapat dibayangkan:
tekan "Akhiri", pindah tab mencari jawaban selagi kotaknya berdiri, lalu tekan
"Belum". Karena itu yang mematikan dua laporan di atas bukan kotaknya, melainkan
pengumpulan yang **benar-benar sudah dimulai** — dan ia padam lagi pada tiap
jalan gagal, karena pesertanya kembali mengerjakan, serta pada tiap jalan masuk
ke lembar ujian, supaya peserta yang keluar lewat Logout lalu masuk kembali
tidak membawa keadaan yang masih menyala ke ujian yang dilanjutkannya.

**Pertanyaannya sendiri tidak dihapus.** Ketukan pada AKHIRI UJIAN tidak dapat
ditarik kembali: attempt-nya ditutup server, lembarnya tidak pernah terbuka
lagi, dan sisa waktunya hangus. Tombol itu duduk **persis di tempat tombol SOAL
SELANJUTNYA berada satu soal sebelumnya** — tangan yang sudah hafal letaknya akan
menekannya tanpa membaca. Peserta yang kehilangan sepuluh menit sisa waktunya
karena satu ketukan hafal jauh lebih dirugikan daripada peserta yang harus
menekan dua kali. Yang dihapus kotak perambannya, bukan pertanyaannya.

---

## Berkas yang berubah

| Berkas | Yang dikerjakan |
|---|---|
| `src/lib/pastikan.ts` | **baru** — kalimat kedua pertanyaan, di luar komponen supaya dapat diuji |
| `src/app/cbt/ujian/pastikan.tsx` | **baru** — kotak pastikan yang digambar halaman sendiri |
| `src/app/cbt/ujian/ujian-app.tsx` | dua `window.confirm()` diganti; keadaan `mengakhiri` menyala saat pengumpulan dimulai, padam pada tiap jalan gagal dan pada tiap jalan masuk ke lembar ujian |
| `src/app/cbt/ujian/penjaga.ts` | opsi `mengakhiri` — `fullscreen` dan `blur` berhenti dilaporkan selama penutupan |
| `src/lib/pengawasan.ts` | `milikPengakhiran()` — daftar dua insiden itu, dapat diuji sendiri |
| `src/app/globals.css` | gaya `.uj-pastikan`, termasuk susunan tombol di ponsel |
| `uji-pastikan-ujian.ts` | **baru** — 51 pemeriksaan |

---

## Cara menguji

```bash
npx tsx uji-pastikan-ujian.ts
```

51 pemeriksaan. Selain kalimat kotaknya, empat di antaranya menjaga perbaikan
ini tetap berdiri:

- **tidak ada `confirm`, `alert`, atau `prompt`** di seluruh layar ujian —
  pemindaian sumber yang membuang komentar lebih dulu, supaya keterangan yang
  menerangkan larangan ini tidak menolak dirinya sendiri;
- **kotak pastikan tetap kalah** dari tirai dan kotak teguran, dibaca dari
  z-index yang benar-benar tertulis di `globals.css`;
- **`mengakhiri` padam lagi pada jalan gagal** — tanpa ini, satu pengumpulan
  yang gagal karena jaringan akan mematikan dua deteksi itu sepanjang sisa
  ujian;
- **dan padam pada tiap jalan masuk ke lembar ujian** — dihitung dari sumbernya,
  jadi jalan masuk baru yang lupa memulangkannya akan menggagalkan uji ini.

Uji CBT yang sudah ada tetap harus lulus:

```bash
npx tsx uji-cbt.ts             # 83
npx tsx uji-pelaksanaan-cbt.ts # 32
npx tsx uji-pengawasan.ts      # 240
npx tsx uji-kunci-layar.ts     # 145
npx tsx uji-tombol.ts          # 188
npx tsx uji-waktu-ujian.ts     # 57
npx tsx uji-kosakata-cbt.ts    # 11 atas berkas CBT
npx tsx uji-situs-cbt.ts       # 56
```

### Mencobanya dengan tangan

1. Buat ujian bermode **Ketat** atau **Sertifikasi**, aktifkan, lalu masuk
   sebagai peserta dengan **Chrome**.
2. Kerjakan sampai soal terakhir, tekan **AKHIRI UJIAN**.
3. Yang benar: layarnya **tetap layar penuh** sementara pertanyaannya berdiri,
   dan lembar pengawasan di panel pengajar tidak bertambah satu pun pelanggaran
   — baik ketika "Belum" ditekan maupun ketika ujiannya benar-benar
   dikumpulkan.
4. Ulangi dengan tombol **Logout** di bilah atas. Hasilnya harus sama.

**Tidak ada migrasi basis data.** Yang berubah hanya apa yang dilaporkan
peramban, bukan bentuk catatannya.
