# v35: Transkrip — predikat cukup dua, setiap istilah Inggris pada judul miring

## Yang salah

### 1. Predikat kelulusan memakai lima istilah, unitnya hanya memakai dua

`predikatKelulusan()` memilih di antara lima kemungkinan:

```
IPK >= 3,51   Dengan Pujian
IPK >= 3,01   Sangat Memuaskan
IPK >= 2,76   Memuaskan
sisanya       Lulus  (kalau judul sudah diisi)
              -      (kalau belum)
```

Padahal berkas sungguhannya hanya mengenal dua. Transkrip contoh dari KUI
berbunyi "Sangat Memuaskan" pada IPK 3,43; lembar kelulusan yang dikirim ke
PDDIKTI berbunyi "CUM LAUDE" pada IPK 3,74. "Dengan Pujian" tidak pernah
dipakai di mana pun — ia hanya padanan Indonesia yang dipilih sistem sendiri,
lalu tercetak, ditandatangani Dekan, dan dilegalisir dengan bunyi yang lain
dari lembar kelulusan mahasiswa yang sama.

### 2. Judul skripsi baru setengah dimiringkan

Sejak v33 istilah Inggris pada judul dicetak miring, tetapi hanya yang
terdaftar sebagai **ungkapan**. Yang tersisa tegak justru kata Inggris yang
berdiri sendiri:

```
yang tercetak                                    yang diminta
──────────────────────────────────────────────   ────────────────────────────
Pengaruh Engagement dan Insight terhadap …       Pengaruh *Engagement* dan
                                                 *Insight* terhadap …
Fenomena Flexing dan Hoax pada Media Sosial      Fenomena *Flexing* dan *Hoax*
                                                 pada Media Sosial
Strategi Empowerment Pemerintah Desa             Strategi *Empowerment*
                                                 Pemerintah Desa
```

Satu judul yang setengah miring setengah tegak lebih buruk daripada judul
yang tidak dimiringkan sama sekali: yang membacanya menyangka yang tegak itu
kata Indonesia.

---

## Yang berubah

### 1. Predikat kelulusan tinggal dua istilah

```
IPK >= 3,51   Cum Laude
sisanya       Sangat Memuaskan
lembar kosong -
```

"Cum Laude" dipakai apa adanya pada transkrip Indonesia maupun Inggris —
begitu bunyinya pada transkrip KUI dan pada lembar PDDIKTI, dan ia sudah
berbahasa Latin di keduanya. Yang perlu padanan Inggris tinggal satu:
"Sangat Memuaskan" → "Very Satisfactory".

Tanda `-` bukan predikat ketiga; ia penampung untuk lembar yang memang belum
berisi apa pun (belum ada nilai dan judul skripsi masih kosong).

Predikat pada transkrip SELALU dihitung ulang dari barisnya saat dicetak, jadi
arsip lama pun langsung tercetak dengan istilah yang baru. Yang tersimpan di
kolom ringkasan arsip ikut diperbarui begitu transkripnya disimpan ulang.

Predikat pada **lembar kelulusan PDDIKTI** tidak disentuh: itu isian yang
dibaca dari berkas fakultas, bukan angka yang dihitung sistem. Yang ditulis
fakultas tetap yang dikirim.

### 2. Setiap istilah Inggris pada judul dicetak miring

`src/lib/judul-inggris.ts` sekarang membaca judul berlapis:

1. **Ungkapan** pada `ISTILAH` dicocokkan lebih dulu, yang terpanjang menang —
   supaya "brand awareness" tidak tercocokkan sebagai "brand" saja, dan supaya
   ungkapan yang memuat kata serapan ("digital marketing") tetap miring
   seutuhnya.
2. **Kata tunggal** pada `KATA` — sekitar 500 kata Inggris yang lazim pada
   judul skripsi Ilmu Komunikasi dan Ilmu Pemerintahan, ditimbang satu per satu
   terhadap bahasa Indonesia. Bentuk jamaknya tidak perlu didaftar dua kali:
   "influencers" ikut "influencer".
3. **Akhiran yang mustahil dalam ejaan Indonesia** — bahasa Indonesia
   menuliskan -tion menjadi -si, -ment menjadi -men, -ity menjadi -tas, -ive
   menjadi -if, -able menjadi -abel. Kata yang masih berakhiran bentuk
   Inggrisnya pasti belum diserap, jadi "sustainability", "responsiveness",
   dan "entrepreneurship" ikut miring tanpa perlu didaftar — sementara
   "efektivitas", "dokumen", dan "variabel" tidak.
4. **Kata tugas** ("of", "the", "in", "and") ikut miring HANYA kalau terjepit
   istilah Inggris di kedua sisinya: "Freedom of Speech" miring seutuhnya,
   tetapi "IT" pada "Divisi IT" tidak tersentuh.

Penggalan miring yang hanya dipisahkan spasi disambung menjadi SATU penggal,
jadi "Personal Branding Content Creator" tercetak sebagai satu istilah asing,
bukan dua potong miring yang berjajar. Tanda baca memutusnya: yang di seberang
koma bukan lagi satu istilah.

### 3. Dua rem yang sengaja dipasang

**Kata serapan yang sudah baku tetap tegak** — media, publik, digital, video,
televisi, film, program, produksi, komunikasi, strategi, konten, viral,
aplikasi, platform, gender, status, global, modern, internal, target, level,
mental, massa. Ejaannya sama dengan ejaan Inggrisnya, jadi hanya daftar
`TEGAK` yang dapat membedakannya.

**Nama diri tidak pernah dimiringkan** — TikTok, Instagram, YouTube, Shopee,
Netflix, Gojek, Traveloka, Muhammadiyah. Nama tetap tegak, sekalipun asing.

Judul yang seluruhnya berbahasa Inggris juga tetap dibiarkan tegak:
memiringkan seluruh kalimat bukan lagi penanda istilah asing.

### 4. Admin tetap menang, dan sekarang bisa mematikannya

Tanda bintang bekerja seperti sebelumnya:

```
Pengaruh *Brand Ambassador* terhadap Minat Beli
```

Begitu satu bintang dipakai, seluruh lapis di atas tidak ikut bekerja pada
judul itu: yang miring persis yang ditandai admin, tidak lebih.

Yang baru: **sepasang bintang kosong** berarti "jangan miringkan apa pun".

```
Pengaruh ** Kinerja Massa terhadap Status Sosial
      ↓ tercetak
Pengaruh Kinerja Massa terhadap Status Sosial
```

Itu jalan keluar untuk judul yang kata Indonesianya kebetulan terbaca Inggris.
Tandanya dibuang bersama spasi kembarnya, jadi judul yang tercetak tidak
menyisakan lubang di tempat tanda itu berdiri.

Catatan di bawah kolom Judul skripsi dan panduan pada template Excel
diperbarui mengikuti semuanya.

### 5. Tanda pisah panjang di layar transkrip ikut dibersihkan

Empat kalimat yang tampil di modul transkrip masih memakai "—", padahal
`uji-tanda-pisah.ts` sudah melarangnya atas permintaan pemilik sistem:
keterangan kamus, pesan hasil impor, pilihan "belum diisi", dan catatan di
bawah kolom Judul. Keempatnya diganti, dan penjaganya hijau kembali.

---

## Yang diperiksa

`npx tsx uji-transkrip.ts` — **320 periksa lulus** (dari 249 pada v34).

Yang baru pada bagian judul skripsi:

- **Kata tunggal**: kata Inggris yang berdiri sendiri ikut miring, termasuk
  bentuk jamaknya.
- **Akhiran**: dua belas kata yang tidak terdaftar dikenali dari akhirannya
  (sustainability, responsiveness, trustworthiness, entrepreneurship,
  readiness, attractiveness, creativity, continuity, photography, psychology,
  statehood, comparative), dan lima belas bentuk Indonesianya tetap tegak
  (efektivitas, produktivitas, identitas, dokumen, komitmen, argumen,
  instrumen, nasionalisme, efektif, variabel, reliabel, klasifikasi,
  implementasi, strategis).
- **Serapan & nama diri**: 26 kata serapan baku dan 12 nama diri diperiksa satu
  per satu, semuanya tegak.
- **Kata tugas**: yang terjepit ikut miring, yang bertetangga sebelah saja
  tetap tegak, dan singkatan Indonesia ("Divisi IT") tidak tersentuh.
- **Penggabungan**: istilah bertetangga menjadi satu penggal miring; koma
  tetap memutusnya.
- **Bintang admin**: memaksa, mematikan daftar, `**` mematikan seluruhnya,
  `**` di ujung judul ikut hilang, dan `**` tanpa spasi tidak melekatkan dua
  kata.
- **Keutuhan huruf**: enam judul diperiksa huruf demi huruf — satu huruf yang
  hilang ikut dicetak dan ikut dilegalisir.

`npx tsx uji-arsip-transkrip.ts` — **64 periksa lulus** (dari 62). Yang baru:
IPK 3,51 dan 4,00 menghasilkan "Cum Laude"; 3,50 sampai 2,50 menghasilkan
"Sangat Memuaskan"; lembar kosong menghasilkan "-"; dan seluruh IPK dari 0,00
sampai 4,00 disapu selangkah 0,01 untuk memastikan tidak ada istilah ketiga
yang dapat lahir dari satu batas yang terlewat.

`npx tsx uji-tanda-pisah.ts` hijau kembali (sebelumnya gagal dengan empat
temuan pada modul transkrip), `uji-kelulusan-pddikti.ts`, `npm run lint`,
`npm run typecheck`, dan `npm run build` ikut dijalankan dan bersih.

---

## Berkas yang berubah

| Berkas | Isi |
| --- | --- |
| `src/lib/arsip-transkrip.ts` | `predikatKelulusan()` tinggal dua istilah |
| `src/lib/judul-inggris.ts` | `KATA`, `AKHIRAN`, `PENYAMBUNG`, `TEGAK`, `kataInggris()`, pemenggal berlapis, saklar `**` |
| `src/app/dashboard/template/template-app.tsx` | `PREDIKAT_EN` satu baris, catatan kolom Judul, panduan template, empat tanda pisah panjang |
| `uji-arsip-transkrip.ts` | predikat dua istilah + sapuan seluruh rentang IPK |
| `uji-transkrip.ts` | 71 periksa baru pada judul skripsi |
