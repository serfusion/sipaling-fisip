# UPDATE v53: Penilaian Tugas dengan AI, laporan PDF per mahasiswa

## Yang diminta

> Saya ada data mahasiswa "tugas sudah terisi", mau saya nilai dan beri
> feedback otomatis pakai API Gemini. Prosesnya mirip CBT tanpa upload soal:
>
> 1. Upload rubrik setiap tugas (dosen)
> 2. Upload template laporan penilaian (dosen)
> 3. Upload tugas terisi (mahasiswa), bisa bulk
> 4. Proses penilaian memakai AI (API Gemini)
> 5. Hasil outputnya laporan berbentuk .pdf (feedback AI)
>
> Semua sekaligus, baca semua format .xls, Word, .pdf, .rar, .zip, karena
> sudah terlanjur diproses di Drive. Butuh penilaian, feedback, dan uji
> supaya respons API-nya benar dengan otomatisasinya.

Dilampirkan dua contoh: `Template_Laporan_Penilaian.md` dan
`PENILAIAN_TUGAS_2_-_Afifah_Meilina_23702010192.pdf`.

## Di mana

**Dashboard → CBT → Penilaian tugas (AI)**, menu keempat di samping Ujian,
Rubrik penilaian, dan Data mahasiswa. Terlihat oleh siapa pun yang melihat
menu CBT (Pengajar, Admin, Super Admin).

---

## Alurnya: lima langkah di satu halaman

### 1. Data tugas

Mata kuliah, tugas ke-, nama tugas, nama dosen (opsional), dan **petunjuk
tugas untuk AI** (opsional; mis. "susun proposal PR beserta pitch letter
untuk 5 jurnalis"). Di sini juga **acuan predikat**, bawaannya

```
A=79,5; B=69,5; C=59,5; D=49,5; E=0
```

A mengikuti laporan contoh ("Grade A: 79,5–100"); huruf lain memakai
langkah sepuluh dengan pembulatan yang sama. **Ganti bila acuan kampus
berbeda**, cukup diketik di kotaknya (boleh AB, BC, dst.).

Pengaturan tugas disimpan di peramban. Satu dosen dapat menyimpan banyak
tugas (Tugas 1, Tugas 2, ...) dan berpindah lewat pemilih di atas; tombol
**Salin tugas ini** menyalin rubrik dan templatenya ke tugas baru.

### 2. Rubrik tugas

Tiga jalan, hasilnya selalu tabel yang dapat disunting dosen
(kriteria, bobot %, deskripsi/acuan skor):

| Sumber | Cara dibaca |
|---|---|
| Excel (.xlsx/.xls/.csv) atau Word (.docx) dengan tabel berkolom **Kriteria** | dibaca langsung, tanpa AI. Kolom Bobot dikenali ("20%", "0,2", "20"); kolom lain (mis. "Sangat Baik (85–100)") digabung ke deskripsi **bersama judul kolomnya**, jadi pita skor tidak hilang |
| Template rubrik CBT (Excel/Word berlabel) | dibaca pembaca rubrik CBT yang sudah ada |
| PDF, PowerPoint, .doc, teks bebas | teksnya disusun **AI** menjadi tabel kriteria |
| Pustaka rubrik CBT | rubrik berlevel diubah menjadi acuan skor (level 3 dari 4 setara ±75) |

Bobot yang kosong dibagi rata, yang berjumlah lain diskalakan ke 100, dan
setiap penyesuaian disebut di kotak kuning "Yang perlu Anda periksa".
Penilaian baru dapat dimulai bila jumlah bobot tepat 100%.

### 3. Template laporan

Bawaannya **persis template yang dilampirkan**. Dosen dapat mengunggah
template sendiri dalam Markdown (.md/.txt) atau Word (.docx). Isiannya
dikenali dari bentuk dan kata-katanya, karena template ditulis untuk dibaca
manusia, bukan berisi penanda:

| Pada template | Diisi dengan |
|---|---|
| `[Nomor dan Nama Tugas]` di judul | "TUGAS 2: PROPOSAL PROGRAM PR & PRESS CONFERENCE" (kapital mengikuti judulnya) |
| baris "NAMA dan NIM" | "Afifah Meilina (NIM 23702010192)" |
| tabel dua kolom yang kolom kanannya kosong | menurut label kiri: Mata Kuliah, Tugas Ke-, Nama Mahasiswa, NIM, Judul Proposal/Judul (dari dokumen mahasiswa, dibaca AI), Kelas, Dosen, Tanggal |
| tabel berkolom "Kriteria" | satu baris per kriteria: nama, deskripsi capaian (AI), skor; kolom Bobot/Terbobot bila ada |
| "NILAI AKHIR ...:" | "80.60 / 100" (rata-rata terbobot dari skor, dihitung kode) |
| "PREDIKAT (GRADE):" | "A (Grade A: 79,5–100)" pada yang pertama, "A" sesudahnya |
| butir "Skor Kriteria 1 ..." | satu butir per kriteria rubrik, berapa pun jumlahnya |
| label "Kelebihan / Strengths" | daftar kelebihan |
| label "Perlu Ditingkatkan / Improvement" | daftar **Aspek:** uraian |
| label "Catatan Khusus / Saran Tindak Lanjut" | paragraf catatan |
| `{{nama}}`, `{{nim}}`, `{{nilai}}`, `{{predikat}}`, `{{judul}}`, `{{tanggal}}`, `[Nama Mahasiswa]`, ... | nilainya |
| judul bagian lain yang KOSONG (mis. "6. Rekomendasi") | diisi AI |

Template yang tidak memuat tabel rubrik, nilai akhir, atau umpan balik tetap
menghasilkan laporan lengkap: bagian yang tidak ditemukan **ditambahkan di
akhir**, bukan dihilangkan diam-diam. Deretan cip di layar menunjukkan isian
mana yang dikenali (✓) dan mana yang akan ditambahkan (＋), dan tombol
**Pratinjau PDF** menampilkan hasilnya dengan data contoh.

Bila jumlah bobot tidak sama rata, label "(RATA-RATA)" ditulis
"(RATA-RATA TERBOBOT)", supaya laporan tidak menyebut rata-rata biasa untuk
angka yang memang terbobot.

### 4. Tugas mahasiswa (bulk)

Tarik berkas ke kotak, **Pilih berkas** (banyak sekaligus), atau **Pilih map**.
Semuanya dibongkar **di peramban dosen**:

| Bentuk | Yang dibaca |
|---|---|
| **.zip** (termasuk unduhan folder Google Drive, ZIP64) | dibongkar, bertingkat sampai 3 lapis |
| **.rar** (RAR4 dan RAR5) | dibongkar lewat unrar resmi (WebAssembly) di Web Worker |
| **.pdf** | teks per halaman (`[Halaman 7]`), plus PDF aslinya untuk dibaca AI (lihat di bawah) |
| **.docx** | teks, tabel tetap satu baris per baris tabel, plus gambar yang tertanam |
| **.doc** (Word 97–2003) | teks dari tabel potongan berkas Word, kode bidang dibuang |
| **.xlsx / .xls / .ods / .csv** | tiap lembar sebagai CSV |
| **.pptx** | teks tiap salindia dan catatannya, plus gambarnya |
| .odt, .odp, .rtf, .txt, .md, .html | teks |
| .jpg, .png, .webp | dilampirkan sebagai gambar |
| .7z | ditolak dengan saran disimpan ulang sebagai .zip/.rar |

Sampah sistem (`__MACOSX`, `.DS_Store`, `~$berkas.docx`, `Thumbs.db`) dibuang.

**Pengelompokan per mahasiswa**: map akar bersama (mis. "Tugas 2-2026...")
dibuang lebih dulu; sesudahnya satu map atau satu arsip = satu mahasiswa,
dan berkas lepas = satu mahasiswa masing-masing. **Nama dan NIM ditebak dari
nama berkas/map** dan selalu dapat dibetulkan di tabel:

```
Proposal_Afifah Meilina_23702010192.pdf   → Afifah Meilina, 23702010192
Anggaran_Budi Santoso_23702010200.xlsx    → Budi Santoso, 23702010200
23702010192 - AFIFAH MEILINA.docx         → Afifah Meilina, 23702010192
Tugas 2 PR - Afifah Meilina.pdf           → Afifah Meilina (pola Google Form)
Hadi Wijaya_23702010205.rar (isi 2 berkas) → satu mahasiswa, dua berkas
```

Kata dari nama tugas dan mata kuliah tidak ikut menjadi nama orang. Bila
nama/NIM kosong, AI mengisinya dari sampul dokumen; bila berbeda, rincian
hasil menyebut "Dokumen menyebut: ...". NIM yang muncul di dua baris ditandai.

### 5. Penilaian AI dan laporan PDF

- **🧪 Uji 1 mahasiswa**: menilai satu mahasiswa dan menampilkan apa yang
  dikirim (jumlah huruf teks, lampiran, ukuran), model dan waktunya, daftar
  pemeriksaan jawaban AI (✓/✕), dan **jawaban AI mentah (JSON)**. Ini
  tombol untuk memastikan respons API benar sebelum menilai satu kelas.
- **✨ Nilai yang belum (N)**: menilai seluruhnya, **dua mahasiswa
  sekaligus** (cukup cepat dan tidak menabrak batas per menit kunci Gemini
  gratis), dengan bilah kemajuan dan tombol **Hentikan**. Galat kuota/sibuk
  (429/502/503/504) **diulang otomatis** sesudah 8, 20, lalu 45 detik.
- **Periksa**: rincian satu mahasiswa. Skor tiap kriteria, deskripsi capaian,
  kelebihan, perbaikan, catatan, dan judul karya **dapat disunting dosen**;
  nilai akhir dan predikat dihitung ulang seketika, dan barisnya diberi
  tanda ✎ "disunting dosen". Baris ⚠ adalah yang ditandai perlu dibaca dosen.
- **PDF** per mahasiswa, **⇩ Semua PDF + rekap (.zip)**, dan
  **⇩ Rekap nilai (.xlsx)** (NIM, nama, skor tiap kriteria, nilai akhir,
  predikat, judul karya, perlu diperiksa, disunting dosen, model, berkas).
  Nama berkasnya mengikuti contoh: `PENILAIAN_TUGAS_2_-_Afifah_Meilina_23702010192.pdf`.

Hasil penilaian disimpan di peramban, jadi memuat ulang halaman tidak
menghapusnya dan PDF tetap dapat diunduh. **Berkas mahasiswa tidak disimpan
di mana pun**; untuk menilai ulang sesudah memuat ulang halaman, unggah lagi
berkasnya (baris yang sama dikenali dan disambung).

---

## Bagaimana AI menilai

Satu permintaan = satu mahasiswa, lewat `POST /api/cbt/tugas`. Yang dikirim:
teks semua berkasnya (paling banyak 150.000 huruf, dipotong adil per berkas)
dan **lampiran visual** bila muat (batas unggah fungsi Vercel 4,5 MB):

1. **PDF aslinya, utuh**, bila tidak lebih dari 2,6 MB. Gemini membaca tata
   letak, tabel, dan gambar halaman, sehingga umpan balik seperti
   "pada halaman 7 terlampir tangkapan layar obrolan ChatGPT" (seperti di
   contoh) memang mungkin.
2. PDF yang lebih besar: **halaman yang memuat gambar** digambar ulang
   menjadi JPEG (paling banyak 6 halaman). PDF hasil pindaian (hampir tanpa
   teks) digambar halaman-halaman awalnya, supaya tetap terbaca.
3. Gambar di dalam Word/PowerPoint dan berkas gambar lepas (paling banyak 8,
   dikecilkan ke 1400 px; ikon dan logo kecil dilewati).

AI yang dipakai: kunci yang terpasang di **Dashboard Super Admin → Kunci AI**,
urut, dengan cadangan otomatis ke kunci berikutnya. Gemini didahulukan bila
kuncinya paling atas; ChatGPT dan Claude juga dapat membaca PDF dan gambar
(lapisan penyedia kini mendukung lampiran PDF untuk ketiganya). Pemakaian
dicatat sebagai fitur **"Penilaian tugas"** dan tunduk pada batas bulanan di
halaman Kunci AI.

Perintahnya (versi `tugas-1`) meminta AI:

1. **Gerbang**: apakah kiriman benar-benar pengerjaan tugas ini. Hanya yang
   kosong, tidak terbaca, sampul tanpa isi, atau jelas tugas lain yang tidak
   lolos (nilai 0, **selalu ditandai perlu dosen**). Bila ragu, loloskan.
2. **Skor 0–100 tiap kriteria** mengikuti deskripsi/pita skor rubrik, beserta
   1–3 kalimat **deskripsi capaian** yang menunjuk bukti konkret (bagian, data,
   nomor halaman).
3. **Umpan balik**: 2–3 kelebihan, 2–3 area perbaikan (aspek + uraian),
   catatan tindak lanjut, judul karya, dan identitas di sampul.

Yang **tidak** diminta dari AI: nilai akhir dan predikat. Keduanya dihitung
kode dari skor × bobot (`src/lib/tugas-rubrik.ts`), sehingga dapat dikoreksi
per kriteria dan diuji tanpa model.

Pagar yang sama dengan penilaian esai CBT:

- **Isi tugas adalah data, bukan perintah**: dipagari penanda, penanda yang
  diketik mahasiswa dibuang, dan AI diminta mengabaikan "beri nilai 100".
- **Tidak menuduh** menjiplak atau memakai AI dari dugaan gaya tulisan. Yang
  boleh disebut hanya yang **terlihat** di dokumen (tangkapan layar obrolan
  AI, teks prompt yang tertinggal), sebagai soal kerapian dan etika penyajian.
- **Jawaban AI diperiksa isinya**, bukan hanya bentuknya: jumlah kriteria,
  skor di 0–100, capaian dan umpan balik tidak kosong. Kriteria yang tidak
  dijawab dibiarkan tanpa skor (bukan nol diam-diam) dan permintaannya
  **diulang sekali otomatis**; yang tetap cacat diserahkan ke dosen dengan
  penyimpangannya tertulis.
- Keyakinan di bawah 70, gerbang tertutup, atau nilai tidak lengkap selalu
  ditandai ⚠ perlu dibaca dosen.

Kaki halaman PDF bertuliskan *"Disusun dengan bantuan AI berdasarkan rubrik
dosen"* (dapat dimatikan di langkah 1).

---

## Laporan PDF: ditulis sendiri, tanpa pustaka

Jendela cetak yang dipakai portal untuk surat tidak cocok untuk empat puluh
laporan sekaligus. `src/lib/pdf-sederhana.ts` menulis PDF sungguhan: judul,
paragraf dengan **tebal**/*miring*, garis, daftar, tabel bergaris yang
berlanjut ke halaman berikut (kepala tabel diulang), kaki "Halaman 1 dari 2".
Huruf Helvetica bawaan PDF (tanpa berkas huruf), satu laporan ± 15 KB.
Huruf di luar WinAnsi diganti padanannya (≥ menjadi >=) atau dibuang (emoji).

---

## Pembaca RAR dan CSP

Pembaca RAR adalah unrar resmi yang dikompilasi ke WebAssembly
(`node-unrar-js`). Pustaka itu membangun fungsinya dengan `new Function`,
yang **ditolak CSP portal** (dan memang harus tetap ditolak di halaman).
Maka ia berjalan di **Web Worker tersendiri**, `public/vendor/unrar-pekerja.js`,
yang mendapat CSP-nya sendiri:

```
/vendor/unrar-pekerja.js   default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; connect-src 'self'
seluruh halaman            script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'   (ditambah 'wasm-unsafe-eval')
```

Pekerja tidak dapat menyentuh DOM, kuki halaman, maupun skrip halaman, dan
satu-satunya yang boleh ia ambil adalah `/vendor/unrar.wasm` milik portal.
`'wasm-unsafe-eval'` hanya mengizinkan kompilasi WebAssembly, bukan `eval()`.

Kedua berkas di `public/vendor/` dibangun dari `vendor-src/unrar-pekerja.mjs`
dengan `npm run pekerja-rar`. **Jalankan ulang hanya bila versi
node-unrar-js dinaikkan**; uji di bawah memastikan wasm di `public/` sama
dengan versi pustaka yang terpasang.

---

## Yang perlu dijalankan

**Tidak ada SQL.** Tidak ada tabel baru: pengaturan tugas dan hasil disimpan
di peramban dosen, berkas mahasiswa tidak disimpan di mana pun.

1. `npm install` (dependensi baru: `node-unrar-js`), lalu deploy.
2. Pastikan **kunci Gemini** terpasang di Dashboard Super Admin → Kunci AI
   (halaman itu kini juga menyebut fitur "Penilaian tugas & laporan PDF").
   Untuk tugas belasan halaman, `gemini-flash-latest` cukup dan murah.
3. Buka CBT → Penilaian tugas (AI) → isi langkah 1–3 → unggah zip dari Drive
   → **🧪 Uji 1 mahasiswa** → bila benar, **✨ Nilai yang belum**.

---

## Uji

```
npx tsx uji-penilaian-tugas.ts                      162 periksa lulus (baru)
GEMINI_API_KEY=... npx tsx uji-penilaian-tugas.ts --langsung [berkas]
npx tsx uji-penilaian-ai.ts                          58 periksa lulus
npx tsx uji-cbt-v1.ts                                194 periksa lulus
npx tsc --noEmit
npm run lint
npm run build
```

`uji-penilaian-tugas.ts` berjalan tanpa jaringan dan tanpa basis data:

| Bagian | Yang dipastikan |
|---|---|
| Rubrik & nilai | contoh dosen (80, 84, 82, 82, 75) = **80,60 → A (79,5–100)**; batas 79,49/79,5; bobot dirapikan; tabel rubrik bebas dengan pita skor di judul kolom |
| Template | template bawaan dikenali seluruhnya; judul, NAMA dan NIM, tabel informasi, tabel rubrik, nilai akhir, predikat, rincian skor, umpan balik terisi; titik sisa template tidak tercetak; 6 kriteria pada template 5 butir; template sendiri dengan `{{penanda}}` dan bagian kosong yang diisi AI; template Word |
| PDF | dibaca ulang dengan pdf.js: teks laporan utuh, tanpa bintang Markdown tersisa, xref menunjuk tepat, tabel panjang berlanjut ke halaman berikut |
| Perintah & skema | rubrik dan bobot ikut; pagar dari mahasiswa dibuang; skema Claude dibersihkan |
| Jawaban AI | lengkap, kriteria hilang, skor 130, nomor mulai 1, gerbang tertutup, keyakinan rendah, umpan balik kosong |
| **API Gemini (server tiruan)** | permintaan sungguhan lewat jalur asli: alamat & model, kunci di kepala `x-goog-api-key` (bukan di URL), `responseJsonSchema`, PDF sebagai `inline_data` lebih dulu, tanpa mode cepat; jawaban dibaca menjadi nilai 80,6; jawaban cacat diulang sekali; MAX_TOKENS → 502; 429; kunci ditolak → pindah kunci |
| **API ChatGPT (server tiruan)** | PDF sebagai isian `file`, `json_schema`, `gpt-4o-mini` tanpa `reasoning_effort` |
| Berkas | unduhan Drive berisi map per mahasiswa, RAR3 di dalam zip, ZIP64 buatan tangan, berkas lepas → 5 mahasiswa dengan nama & NIM benar; RAR5 bertingkat & nama Unicode; RAR rusak menjadi peringatan; .doc (8-bit, UTF-16, kode bidang); .xls lama; tabel Word; RTF; PDF kecil dilampirkan utuh, PDF besar tidak; rubrik dari Excel, Word, teks |
| Pekerja RAR & CSP | berkas pekerja ada; CSP pekerja mengizinkan `unsafe-eval` dan tidak lebih; aturan pekerja ditulis sesudah aturan umum |

**Uji langsung ke Gemini** (`--langsung`) menilai satu tugas dengan rubrik
contoh memakai kunci sungguhan, memeriksa jawabannya (5 kriteria, skor
0–100, capaian dan umpan balik terisi, lolos gerbang, tanpa penyimpangan),
mencetak umpan baliknya, dan menulis laporan PDF ke folder sementara. Tanpa
berkas, tugas contoh buatan uji yang dipakai; dengan berkas (.pdf, .zip,
.rar, .docx), mahasiswa pertama di dalamnya yang dinilai.

Di luar uji yang ikut di repo, alurnya juga dijalankan di **Chromium
sungguhan pada build produksi dengan CSP asli** dan API tiruan: rubrik Excel
terbaca, unduhan Drive berisi PDF, .xlsx, .pptx, .doc, .xls, .rar, dan map
ODT+RTF terbongkar menjadi 8 mahasiswa, Uji 1 mahasiswa, Nilai semua,
sunting skor (nilai dan predikat berubah), unduh zip berisi 8 PDF + rekap
.xlsx, muat ulang halaman (hasil tetap ada), PDF 4,6 MB (hanya halaman
bergambar yang dikirim, sebagai JPEG 236 KB), dan galat 503 yang diulang
otomatis lalu ditandai gagal. Konsol peramban bersih dari pelanggaran CSP.

Yang **belum** dapat diuji di sini: panggilan ke Gemini sungguhan (tidak ada
kunci di lingkungan pengembangan) dan mutu umpan baliknya. Jalankan
`--langsung` dengan kunci portal untuk itu.

---

## Batasan yang perlu diketahui

- Hasil tersimpan **per peramban**. Dosen yang pindah komputer membawa hasilnya
  lewat zip PDF dan rekap Excel, bukan lewat portal.
- Lampiran visual dibatasi ± 2,9 MB per mahasiswa (batas unggah Vercel).
  Teksnya tetap dikirim utuh sampai 150.000 huruf.
- Gambar di dalam berkas .doc lama tidak diambil (teksnya terbaca).
- Arsip/dokumen bersandi dilewati dengan peringatan. .7z belum didukung.

---

## Berkas yang berubah

| Berkas | Isi |
|---|---|
| `src/app/dashboard/penilaian-tugas.tsx` | **baru**: menu Penilaian tugas (5 langkah, uji, antrean, sunting, unduh) |
| `src/lib/tugas-rubrik.ts` | **baru**: rubrik tugas, bobot, nilai akhir, predikat, baca tabel rubrik |
| `src/lib/tugas-template.ts` | **baru**: template bawaan, urai Markdown/Word, kenali isian, isi, PDF laporan |
| `src/lib/tugas-nilai.ts` | **baru**: perintah, skema, pembaca & pemeriksa jawaban AI, ulang otomatis, rubrik dari teks |
| `src/lib/tugas-berkas.ts` | **baru**: bongkar zip/rar bertingkat, kelompok per mahasiswa, tebak nama/NIM, sarikan semua bentuk, lampiran visual |
| `src/lib/pdf-sederhana.ts` | **baru**: penulis PDF tanpa pustaka |
| `src/app/api/cbt/tugas/route.ts` | **baru**: `GET` siap, `POST aksi=nilai`, `POST aksi=rubrik` |
| `vendor-src/unrar-pekerja.mjs`, `public/vendor/unrar-pekerja.js`, `public/vendor/unrar.wasm` | **baru**: pekerja RAR |
| `src/lib/ai-penyedia.ts` | lampiran **PDF** untuk Gemini, Claude, ChatGPT; `lewatKunci` diekspor untuk uji |
| `src/lib/ai-pemakaian.ts`, `src/app/api/admin/kunci-ai/route.ts` | fitur "Penilaian tugas" |
| `src/lib/baca-zip.ts` | ZIP64 (unduhan Drive besar) dan isi bersandi dilewati |
| `src/app/dashboard/cbt-panel.tsx` | menu keempat |
| `next.config.ts` | `'wasm-unsafe-eval'`; CSP khusus pekerja RAR |
| `src/app/globals.css` | gaya `.pt-*` |
| `package.json` | `node-unrar-js`; skrip `pekerja-rar` |
| `eslint.config.mjs` | `public/vendor/**` tidak di-lint (berkas terbangun) |
| `uji-penilaian-tugas.ts` | **baru** |
