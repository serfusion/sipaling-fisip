# UPDATE v44 — CBT V1: dari tempat mengerjakan soal menjadi platform penilaian

## Yang diminta

> "Buatkan CBT V1 yang persis CBT yang sudah ada, kemudian dikembangkan dengan
> blueprint ini. Konsep ini garis besar saja — tolong sempurnakan apabila ada
> yang lebih simpel untuk pengguna dan untuk saya, dan efektif tanpa effort
> setting macam-macam."

Blueprint-nya memuat sepuluh tujuan: database mahasiswa dengan autocomplete
sejak satu karakter, rubrik penilaian esai, penilaian AI berbasis rubrik,
pemeriksaan kemiripan jawaban, rekaman suara, deteksi kata mencurigakan,
dashboard dosen, laporan PDF, email nilai, dan audit trail.

**Seluruhnya dikerjakan.** Yang berbeda dari blueprint ada di bagian
[Yang disederhanakan](#yang-disederhanakan-dan-kenapa) di bawah — dan setiap
penyederhanaan punya alasannya.

---

## Aturan yang dipegang di seluruh pekerjaan ini

> **Ujian yang berjalan hari ini harus berjalan persis sama besok pagi.**

Ini bukan kesopanan. Migrasi ini dijalankan pada portal yang ujiannya mungkin
dijadwalkan besok pagi, dan tidak ada satu pun dosen yang akan membaca dokumen
ini lebih dulu.

Karena itu **seluruh fitur baru mati secara bawaan**, kecuali satu yang tidak
berbiaya dan tidak pernah mengubah nilai:

| Fitur | Bawaan | Artinya |
|---|---|---|
| Rubrik esai | **mati** | Esai dinilai seperti biasa — dosen mengetik angkanya |
| Rekam suara | **mati** | Mikrofon tidak pernah menyala |
| Kemiripan jawaban | **menyala** | Berjalan di server, tanpa biaya, hanya menandai |
| Email nilai otomatis | **mati** | Tidak ada surat yang terkirim sendiri |
| Daftar mahasiswa | **kosong** | Peserta mengetik nama dan nomornya sendiri |

Dosen yang tidak menyentuh satu setelan pun tetap mendapat CBT yang sama
persis dengan kemarin, ditambah satu kolom "Mirip" pada papan pantaunya.

---

## 1. Daftar mahasiswa dan pencarian sejak satu huruf

### Untuk mahasiswa

Di layar masuk ujian, kolom **Nama Lengkap** sekarang sekaligus mencari.
Mengetik satu huruf sudah memunculkan daftar; menekan satu nama mengisi nomor
induknya sendiri.

```
Nama Lengkap
┌──────────────────────────────────────┐
│ a                                    │
└──────────────────────────────────────┘
  ┌────────────────────────────────────┐
  │ 2023123456  Andi Pratama    3A     │
  │ 2021777000  Anita Sari      4B     │
  │ 2023123488  Budi Santoso    3A     │
  └────────────────────────────────────┘
```

**Namanya tidak muncul? Ketik saja sendiri — sama sahnya.** Tidak ada tombol
"cari", tidak ada pilihan "saya tidak ada di daftar", tidak ada keadaan yang
salah. Portal yang belum mengimpor satu baris pun berjalan seperti biasa.

### Untuk Anda

Menu CBT sekarang punya tiga tab: **Ujian · Rubrik penilaian · Data
mahasiswa**. Impor daftar dengan salah satu dari dua cara:

- **Ambil dari Excel/CSV** — kolom yang dikenali: NIM/NPM, Nama, Email, Prodi,
  Kelas, Angkatan, Status. Judul kolomnya **dicari**, bukan dianggap selalu di
  baris pertama, jadi berkas berkop dari bagian akademik langsung terbaca.
- **Tempel dari SIAKAD** — salin dua kolom dari layar SIAKAD, tempel, selesai.

Nomor yang sudah ada **diperbarui**, bukan ditolak dan bukan digandakan.
Berkas yang sama dikirim ulang tiap semester menghasilkan daftar yang benar,
bukan laporan berisi empat ratus penolakan "sudah ada".

> **Catatan privasi.** Pencarian dari layar ujian terbuka tanpa login — memang
> begitu sifat CBT ini. Tiga hal menjaganya: harus menyebut **kode ujian yang
> sedang berlangsung**, daftarnya **disempitkan ke kelas ujiannya** bila
> ujiannya menyebut kelas, dan **email tidak pernah ikut keluar** lewat jalur
> itu. Di luar jam ujian, titik akhir itu tidak menjawab apa pun.

---

## 2. Rubrik penilaian esai

### Tiga rubrik siap pakai, tinggal salin

Membuka menu Rubrik pertama kali tidak menghadapkan Anda pada formulir kosong.
Ada tiga yang tinggal ditekan "Salin & sesuaikan":

| Rubrik | Kriteria | Untuk |
|---|---|---|
| **Rubrik Proposal Kampanye** | 5 kriteria, skala 1–4 | Persis rubrik dari dokumen Anda: Analisis Situasi 20%, Strategi Pesan 20%, Kelayakan Kanal 25%, Operasional 15%, Sistematika 20% |
| **Rubrik Esai Umum** | 4 kriteria, skala 1–4 | Sebagian besar soal esai: konsep, argumentasi, analisis, referensi |
| **Rubrik Jawaban Singkat** | 3 kriteria, skala 1–4 | Esai pendek satu-dua paragraf |

Ketiganya sudah lengkap sampai **deskriptor tiap level** — apa yang membuat
sebuah jawaban berada di level 1, 2, 3, atau 4. Menyusun rubrik dari nol
memakan dua puluh menit; memilih satu lalu mengganti dua kata memakan dua
menit.

### Rumusnya

```
Total terbobot = Σ (level tiap kriteria × bobotnya)
Nilai 0–100    = (total terbobot ÷ level tertinggi) × 100
```

Contoh dari dokumen Anda, dan sekarang menjadi salah satu uji otomatis:

```
Analisis Situasi        3 × 20% = 0,60
Strategi Pesan          4 × 20% = 0,80
Kelayakan Kanal         4 × 25% = 1,00
Operasional & Timeline  3 × 15% = 0,45
Sistematika & Bahasa    4 × 20% = 0,80
                                ------
Total                           = 3,65   →  (3,65 ÷ 4) × 100 = 91,25  →  A
```

Pembagiannya dengan **level tertinggi**, bukan jumlah kriteria. Itu yang
membuat rubrik berskala 1–4 dan 1–5 sama-sama menghasilkan 100 untuk pekerjaan
yang sempurna.

### Satu rubrik untuk satu ujian, bukan untuk satu soal

Rancangan per soal lebih luwes dan hampir tidak pernah dipakai: dosen yang
menyusun lima soal esai menilai kelimanya dengan ukuran yang sama. Dipasang
sekali di **Pengaturan ujian → Rubrik penilaian esai**, berlaku untuk seluruh
esai di ujian itu.

---

## 3. Penilaian esai oleh AI — dan batasnya

### Yang dikerjakan AI, dan yang tidak

```
Jawaban mahasiswa
      ↓
AI membaca rubrik, menilai PER KRITERIA
      ↓
Kriteria 1 → Level 3  "Pemetaan audiens tepat, tetapi data statistik lokal
                       belum spesifik."                    ← alasannya ikut
Kriteria 2 → Level 4  "Integrasi tokoh adat dan bahasa daerah menunjukkan
                       sensitivitas budaya yang tinggi."
      ↓
Sistem menghitung bobotnya  →  91,25
      ↓
DOSEN membaca, mengubah level yang tidak disetujui
      ↓
DOSEN menekan SAHKAN          ← nilainya baru berlaku di sini
```

**AI tidak pernah memberi nilai akhir.** Ia memilih level beserta alasannya;
rumusnya dikerjakan kode yang diuji tanpa satu pun panggilan model. Tiga
akibatnya:

1. Anda melihat **mengapa** nilainya 91,25, bukan hanya angkanya.
2. Tidak setuju pada satu kriteria? Ubah satu level, nilainya ikut berubah
   sendiri.
3. Keyakinan model di bawah 70% **selalu** ditandai "mohon diperiksa" — apa
   pun yang dikatakan model tentang dirinya sendiri.

### Pembacaan mesin dan keputusan Anda disimpan berdampingan

Tidak saling menimpa. Ketika nilai digugat berbulan-bulan kemudian, pertanyaan
pertamanya adalah apakah dosennya benar-benar memeriksa atau hanya menekan
setuju — dan laporan menyimpan jawabannya, beserta nama dan jam pengesahannya.

> **Mengubah satu level sesudah nilai disahkan akan MENCABUT pengesahannya.**
> Laporan yang sudah ditandatangani tidak boleh diam-diam berbeda dari nilai
> yang tersimpan sekarang.

### Tanpa kunci API pun rubriknya tetap jalan

Tidak ada `ANTHROPIC_API_KEY` maupun `GEMINI_API_KEY`? Rubriknya tetap
terpasang, levelnya Anda isi sendiri dari daftar pilihan yang memuat
deskriptornya — dan nilainya tetap dihitung otomatis.

---

## 4. Kemiripan jawaban antarpeserta

Berjalan **sendiri saat peserta mengumpulkan**, tanpa biaya dan tanpa menunda
pengumpulan. Kolom **Mirip** muncul di papan pantau; membuka satu peserta
menampilkan pasangannya beserta alasannya.

### Empat sinyal, karena satu tidak cukup

| Sinyal | Bobot | Menangkap |
|---|---:|---|
| **Kata bersama** (TF-IDF + cosine) | 35% | Jawaban yang isinya sama |
| **Urutan kata** (Jaccard atas 4-gram) | 40% | Kalimat yang disalin utuh — paling sulit terjadi kebetulan |
| **Frasa langka bersama** | 15% | Kalimat khas yang beredar lewat pesan singkat |
| **Bentuk tulisan** | 10% | Panjang dan jumlah kalimat yang hampir sama |

Ditambah satu yang berbicara paling keras: **kata tak lazim yang sama** — kata
yang hanya muncul di dua lembar dan tidak di lembar mana pun yang lain. Dua
orang boleh berpikir sama, tetapi tidak salah mengetik dengan cara yang sama.

Jawaban yang **sama persis** langsung bernilai 100%, tanpa melewati rumus —
angka sembilan puluhan pada dua lembar yang identik huruf demi huruf akan
membuat pembacanya mengira masih ada bedanya.

### Yang sengaja TIDAK ditandai

- **Pilihan ganda.** Tiga puluh peserta yang menjawab "B" pada soal yang
  jawabannya memang B akan mirip 100% satu sama lain.
- **Jawaban di bawah 12 kata.** "Ya", "setuju", "tidak tahu".
- **Parafrase yang benar.** Jawaban yang ditulis ulang dengan kata sendiri
  memang seharusnya lolos — itu namanya belajar.

### Kalimatnya, bukan angkanya

Setiap tampilan kemiripan — di layar dan di kertas — disertai:

> *"Angka ini indikasi, bukan bukti. Dua jawaban dapat mirip karena keduanya
> belajar dari bahan yang sama."*

Ambangnya dapat Anda setel per ujian (bawaan: 30% perlu ditinjau, 60% tinggi).

---

## 5. Rekaman suara dan deteksi kata mencurigakan

**Mati secara bawaan**, dan tidak dapat dinyalakan di tengah ujian yang sedang
berjalan — peserta yang sudah duduk mengerjakan tidak diberi tahu sebelumnya,
dan persetujuan yang diambil sesudah orangnya duduk bukan persetujuan.

### Di layar peserta

Sebelum menekan MULAI, muncul kotak yang tidak dapat dimatikan pengaturan mana
pun:

> **Ujian ini merekam suara.** Mikrofon perangkatmu akan menyala selama ujian
> berlangsung, dan rekamannya hanya dapat dibuka dosen pengampu. […] Bila
> izinnya ditolak atau mikrofonmu bermasalah, ujian tetap dapat dikerjakan.

Selama ujian ada lencana **● Merekam · 12 mnt** di sudut layar. Perekaman yang
disembunyikan dari orang yang direkam membuang seluruh daya cegahnya.

### Mikrofon yang gagal tidak pernah menghentikan ujian

Izin ditolak, perangkat tanpa mikrofon, peramban yang tidak mendukung —
semuanya **dicatat** lalu ujiannya diteruskan. Menghentikan ujian seseorang
karena mikrofonnya bermasalah menghukum peserta atas perangkatnya, dan yang
paling sering mengalaminya adalah yang perangkatnya paling murah.

### Potongan dua puluh detik, bukan satu berkas

Jaringan kampus putus. Rekaman yang baru dikirim pada akhir ujian akan hilang
seluruhnya ketika itu terjadi; yang sudah sampai tetap ada.

### Dua tahap, bukan satu

Ini bagian yang membuat fiturnya layak dipakai. Kata kunci saja menghasilkan
salah tuduh:

```
"Dalam pembahasan ini kita tidak boleh buka google"
    kata ditemukan  : "buka google"
    konteksnya      : ada kata pengingkar sebelumnya
    → risiko RENDAH, bukan pelanggaran

"Eh coba buka google dulu"
    kata ditemukan  : "buka google"
    konteksnya      : bentuk perintah kepada orang lain
    → risiko TINGGI
```

Tangganya sengaja tidak ketat: **satu penandaan berisiko tinggi belum berarti
"mencurigakan"**. Pengubah suara ke teks salah dengar, dan satu salah dengar
tidak boleh cukup untuk menaruh kata itu pada laporan ujian seseorang. Tiga
yang tinggi barulah "mencurigakan".

Daftar katanya sudah terisi bawaan (`buka google`, `tanya chatgpt`, `bacain
soalnya`, …) dan dapat diubah. Yang dicari **perbuatannya**, bukan nama
aplikasinya — "google" sendirian tidak ada di daftar, karena kata itu muncul
di hampir semua kuliah metodologi.

### Pemutarnya

Di lembar peserta: pemutar, lalu daftar penggal yang ditandai. Menekan
jamnya melompat ke titik itu.

```
[▶ 00:12:43]  coba buka google dong
              "buka google"  · Kata terdengar dalam bentuk perintah kepada orang lain
[▶ 00:18:09]  kita tidak boleh buka chatgpt
              "buka chatgpt" · Kalimat sebelumnya berisi kata pengingkar
```

Transkrip **diminta Anda**, tidak berjalan sendiri — ujian sembilan puluh menit
kali empat puluh peserta yang ditranskripsikan otomatis adalah tagihan yang
tidak Anda putuskan. Rekamannya tetap tersimpan dan tetap dapat didengarkan
tanpa transkrip.

---

## 6. Laporan PDF

Laporan per peserta sekarang memuat, **hanya bila datanya memang ada**:

```
A. Ringkasan nilai          ← + predikat, + nilai sistem bila Anda mengubahnya
B. Rincian jawaban
C. Penilaian rubrik         ← tiap kriteria, level, terbobot, DAN alasannya
D. Pemeriksaan integritas   ← kemiripan + hasil pembacaan rekaman
E. Jejak pengawasan         ← garis waktu berjam, bukan hanya angka ringkasan
F. Pengesahan               ← nilai sistem, nilai akhir, siapa, kapan
```

Penomoran bagiannya menyesuaikan sendiri. Ujian tanpa rubrik, tanpa
pemeriksaan kemiripan, dan tanpa rekaman mencetak halaman yang **sama persis**
dengan sebelum V1 — bukan dengan tiga bagian kosong bertuliskan "tidak ada
data".

Tetap lewat jendela cetak peramban (Simpan sebagai PDF), sama seperti berita
acara dan naskah soal. Tidak ada pustaka PDF baru.

---

## 7. Email nilai ke mahasiswa

**Hanya nilai yang sudah disahkan yang dikirim.** Aturan itu ditegakkan satu
lapis lebih dalam, jadi jalur mana pun — tombol satuan, tombol sekelas, atau
pengiriman otomatis — melewati pemeriksaan yang sama.

Isinya: nilai, predikat, lulus/belum, rincian rubrik per soal esai, dan umpan
balik. **Angka kemiripan dan hasil pembacaan rekaman tidak pernah ikut** —
keduanya indikasi yang masih menunggu pemeriksaan manusia, dan mengirimkannya
sebagai angka kepada orang yang menjadi pokoknya adalah tuduhan yang
dikeluarkan mesin. Kalau memang ada persoalan, yang menyampaikannya Anda,
dengan kalimat Anda sendiri.

Pengiriman otomatis **mati secara bawaan**: surat yang sudah terkirim tidak
dapat ditarik kembali, dan yang paling sering terjadi pada pekan penilaian
adalah dosen mengesahkan satu peserta untuk melihat bentuk laporannya.

---

## Yang disederhanakan, dan kenapa

Anda meminta disempurnakan "apabila ada yang lebih simpel dan efektif tanpa
effort setting macam-macam". Tujuh keputusan diambil atas dasar itu:

| # | Blueprint | Yang dikerjakan | Alasan |
|---|---|---|---|
| 1 | Redis + antrean + pekerja latar | **Tidak ada antrean sama sekali** | Yang murah (kemiripan) berjalan saat pengumpulan — hitungan milidetik. Yang mahal (AI, transkrip) berjalan saat Anda memintanya. Antrean menambah satu layanan yang harus dipasang, dijaga, dan dibayar |
| 2 | 3 tabel rubrik (rubrics → criteria → levels) | **2 tabel**, level sebagai JSON | Tidak ada satu pun pertanyaan yang menanyakan level tanpa kriterianya. Yang didapat dari pemisahan hanya tiga sambungan tabel tiap pembacaan |
| 3 | Modul manajemen mahasiswa (prodi, fakultas, angkatan, matkul sebagai tabel masing-masing) | **Satu tabel `students`** | Yang dipakai CBT hanya: menemukan orangnya, dan tahu ke mana nilainya dikirim. Sisanya keterangan, dan keterangan tidak perlu tabel sendiri |
| 4 | Similarity Level 3: embedding/vector | **Tidak dipakai** | Menuntut layanan vektor tersendiri beserta biayanya. Sinyal urutan-kata dan frasa-langka sudah menangkap perkara yang sebenarnya dicari: jawaban yang berpindah tangan |
| 5 | Rubrik dipasang per soal | **Satu rubrik per ujian** | Dosen yang menyusun lima soal esai menilai kelimanya dengan ukuran yang sama |
| 6 | Rubrik disusun dosen dari nol | **Tiga rubrik siap pakai** | Formulir kosong pada menu yang dibuka pertama kali adalah alasan fitur tidak pernah dipakai |
| 7 | Menu terpisah untuk tiap modul | **Tiga tab di dalam menu CBT** | Rubrik dan daftar mahasiswa hanya berarti bagi CBT. Menu sidebar yang bertambah tiga juga dilihat admin bagian yang tidak pernah menyentuh ujian |

Satu hal yang **tidak** disederhanakan: pemisahan pembacaan AI dari keputusan
dosen. Itu menambah satu kolom dan satu tombol, dan keduanya menjawab
pertanyaan yang muncul ketika nilai digugat.

---

## Cara memasang

### 1. Jalankan migrasi basis data

Supabase → SQL Editor → tempel seluruh isi **`supabase-update-v44-cbt-v1.sql`**
→ Run. Aman dijalankan berulang kali.

Yang dibuat: 7 tabel baru, 6 kolom pada `cbt_exams`, 8 kolom pada
`cbt_attempts`, dan bucket `cbt-rekaman` (tertutup). Seluruh kolom baru punya
nilai bawaan, jadi baris yang sudah ada terisi sendiri.

Di bagian bawah berkasnya ada dua perintah SELECT untuk memeriksa hasilnya.

### 2. Deploy

Tidak ada dependensi npm baru. `npm run build` seperti biasa.

### 3. Environment — seluruhnya OPSIONAL

| Variabel | Untuk | Tanpa itu |
|---|---|---|
| `ANTHROPIC_API_KEY` **atau** `GEMINI_API_KEY` | Penilaian esai oleh AI | Rubrik tetap jalan, level Anda isi sendiri |
| `GEMINI_API_KEY` | Transkrip rekaman | Rekaman tetap tersimpan dan dapat diputar |
| `CBT_EMAIL_DARI` + `OUTREACH_API_KEY` | Kirim nilai lewat email | Laporan tetap dapat dicetak dan diunduh |

Portal tanpa ketiganya tetap mendapat: daftar mahasiswa dengan autocomplete,
rubrik manual, kemiripan jawaban, dan laporan PDF yang memuat semuanya.

---

## Uji

```bash
npx tsx uji-cbt-v1.ts      # 194 periksa: rubrik, kemiripan, mahasiswa, rekaman
npx tsx uji-cbt.ts         # aturan CBT lama — tetap lulus
npx tsx uji-cetak-cbt.ts   # lembar cetak — tetap lulus
npx tsx uji-pengawasan.ts  # pengawasan — tetap lulus
```

Yang dijaga uji baru adalah hal-hal yang kesalahannya **tidak terlihat sampai
sudah terlambat**:

- contoh 3/4/4/3/4 dari dokumen Anda harus menghasilkan **3,65 lalu 91,25** —
  kalau angka ini bergeser, seluruh nilai esai di portal bergeser bersamanya;
- rubrik bawaan bobotnya harus berjumlah tepat 100%, kalau tidak ia akan
  ditolak server tepat ketika dosen menekan simpan;
- `"kita tidak boleh buka google"` harus berisiko **rendah**, bukan tinggi;
- parafrase yang benar harus **lolos**, jawaban identik harus **100%**;
- mengetik `"bud"` harus menaruh Budi di atas Mahbudi.

---

## Berkas yang berubah

**Baru — aturan (murni, dapat diuji tanpa server):**
`src/lib/rubrik.ts` · `src/lib/nilai-esai.ts` · `src/lib/mirip-jawaban.ts` ·
`src/lib/mahasiswa.ts` · `src/lib/rekaman.ts`

**Baru — sisi basis data:**
`src/lib/mirip-simpan.ts` · `src/lib/nilai-attempt.ts` · `src/lib/kirim-nilai.ts`

**Baru — API:**
`/api/cbt/mahasiswa` · `/api/cbt/rubrik` · `/api/cbt/penilaian` ·
`/api/cbt/rekaman` · `/api/cbt/kirim-nilai`

**Baru — layar:**
`src/app/dashboard/cbt-v1.tsx` · `src/app/cbt/ujian/cari-peserta.tsx` ·
`src/app/cbt/ujian/mikrofon.tsx`

**Diubah:**
`src/db/schema.ts` · `src/lib/cbt-store.ts` · `src/lib/ai-penyedia.ts`
(masukan suara untuk Gemini) · `src/lib/cetak-cbt.ts` ·
`src/app/api/cbt/ikut/route.ts` · `src/app/api/cbt/hasil/route.ts` ·
`src/app/api/cbt/ujian/route.ts` · `src/app/cbt/ujian/ujian-app.tsx` ·
`src/app/dashboard/cbt-panel.tsx` · `src/app/globals.css`

**Migrasi + uji + dokumen:**
`supabase-update-v44-cbt-v1.sql` · `uji-cbt-v1.ts` · berkas ini

---

## Prinsip yang tertulis di dalam kodenya

```
Otomatis untuk mempercepat.
Rubrik untuk menjaga konsistensi.
Kemiripan untuk menemukan indikasi — bukan untuk memutuskan.
Audio untuk menyediakan bukti tambahan.
Audit trail untuk transparansi.
Dosen tetap menjadi final reviewer.
```

Kalimat terakhir itu bukan hiasan. Tidak ada satu pun jalur di CBT V1 yang
membuat sebuah nilai menjadi resmi tanpa seseorang menekan **SAHKAN** — dan
yang menekannya tercatat namanya beserta jamnya, di layar dan di kertas.
