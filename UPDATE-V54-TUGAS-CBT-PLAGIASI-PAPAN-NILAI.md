# UPDATE v54: Tugas lewat CBT, kode SIPALING-TUGAS, .md, plagiasi, papan nilai, Arsip Drive

## Yang diminta

> 1. Pengumpulan tugas via CBT ekstensi .pdf otomatis dapat unik code
>    (SIPALING-TUGAS-XXX), untuk tracking permasalahan nilai.
> 2. Setelah upload, otomatis tersusun ".md" di sistem kita (supaya tidak
>    makan storage).
> 3. Otomatis cek plagiasi seluruh tugas yang dikumpulkan (gatekeeper); notif
>    siapa yang terkena plagiasi; ada keterangan pada nilai yang akan muncul
>    dan bisa dibuka oleh mahasiswa yang sesuai unik code-nya (ibarat
>    password, apa keterangannya).
> 4. Semua nilai mahasiswa dipublikasikan di CBT (semua bisa melihat seperti
>    mading/pengumuman) dan diranking; jika nilai kecil/merah otomatis di
>    sebelahnya ada keterangan, dan yang bisa membuka keterangan hanya pemilik
>    kode, terindikasi karena apa nilainya kecil.
> 5. Ada tingkat persentase kritis untuk penilaian yang bisa diatur saat
>    "Penilaian AI & laporan PDF".
> 6. "Disusun dengan bantuan AI" diganti "Disusun menggunakan Software SPF",
>    dan template dibuat elegan supaya enak dilihat.
> 7. Semua bisa dihapus dan bisa diunduh untuk ditaruh di Google Drive dan
>    diarsipkan.
> 8. Arsip Drive untuk menyimpan hasil Google Drive, diperpendek tautannya, dan
>    hanya bisa dihapus Super Admin.

## Ringkasnya

| Permintaan | Yang dibangun | Di mana |
|---|---|---|
| 1. Kumpul PDF via CBT + kode | Halaman **Kumpulkan Tugas**; tiap kiriman mendapat `SIPALING-TUGAS-XXXXXXXX` dan tanda terima | `cbt.<domain>/tugas` |
| 2. Otomatis jadi .md | PDF disusun menjadi Markdown **di peramban pengirim**; yang tersimpan hanya .md + sidik SHA-256. PDF tidak disimpan | `src/lib/pdf-markdown.ts` |
| 3. Plagiasi + gerbang + notif | Kemiripan antarkiriman dihitung otomatis; **gerbang** menahan/menolkan sebelum AI; lonceng dosen berbunyi | `src/lib/tugas-plagiasi.ts`, langkah 5 |
| 3 (ralat). Keterangan dibuka dengan kode | Penanda "Terindikasi plagiasi" tampil di papan; **isinya hanya terbuka dengan kode milik baris itu** | `cbt.<domain>/papan` |
| 4. Papan nilai + ranking + nilai merah | **Papan Nilai Tugas**: diurutkan dari tertinggi, nilai merah di bawah batas kritis, 🔒 Keterangan | `cbt.<domain>/papan` |
| 5. Persentase kritis | **Batas kritis nilai** di langkah 5, per tugas (bawaan 60) | Dashboard → CBT → Penilaian tugas |
| 6. Kaki SPF + template elegan | Kaki "Disusun menggunakan Software SPF"; laporan PDF bergaya resmi (pita biru tua berisi kode, tabel berkepala, kotak nilai) | `src/lib/pdf-sederhana.ts` |
| 7. Hapus & unduh untuk Drive | **Arsip lengkap (.zip)**: laporan PDF, kiriman .md, rekap .xlsx, plagiasi .csv, rubrik & template, BACA-DULU; hapus per kiriman, semua kiriman, atau tugas | langkah 6 |
| 8. Arsip Drive + tautan pendek | Menu **Arsip Drive**; tautan Drive → `<portal>/s/KODE`; **hapus hanya Super Admin** | Dashboard → CBT → Arsip Drive |

Perubahan pokoknya: **tugas kini tersimpan di server**, bukan lagi di peramban
dosen (v53). Itu yang memungkinkan mahasiswa mengumpulkan sendiri, kode dapat
dilacak, dan papan nilai dapat membaca nilainya.

---

## 1. Pengumpulan lewat CBT dan kode SIPALING-TUGAS

Dosen membuka **Dashboard → CBT → Penilaian tugas (AI)**, membuat tugas, dan
di **langkah 4** menyalakan *Buka pengumpulan lewat CBT* (boleh dengan batas
waktu). Kode pengumpulan enam huruf dan tautannya tinggal dibagikan ke grup
kelas:

```
https://cbt.<domain>/tugas?kode=K7M2QX
```

Mahasiswa (tanpa akun) mengisi nama, NIM, dan memilih PDF. Sesudah
dikumpulkan, layar menampilkan kode kiriman, tombol *Salin kode*, dan
*Unduh tanda terima (.txt)* berisi kode, identitas, nama berkas, jumlah
halaman, waktu, dan SHA-256 PDF-nya.

**Kenapa delapan huruf acak, bukan SIPALING-TUGAS-001?** Kode inilah kunci
keterangan nilai di papan (permintaan 3 dan 4). Nomor urut dapat ditebak siapa
saja ("teman saya 014, berarti saya 015"), sehingga keterangan orang lain
dapat dibuka. Delapan huruf dari 30 huruf yang tidak mudah tertukar (tanpa I,
L, O, U, 0, 1) memberi ± 6,6 × 10¹¹ kemungkinan, dibangkitkan dengan
`crypto.getRandomValues`, dan pembukaannya dibatasi lajunya. Kode boleh
diketik huruf kecil, berspasi, atau tanpa awalan.

Halaman CBT memakai label berpasangan (**NIM / Nomor Peserta**, **Mata Kuliah /
Materi**) dan kata "pengajar", mengikuti aturan kosakata situs CBT
(`uji-kosakata-cbt.ts`): CBT juga dipakai sekolah dan lembaga sertifikasi.

**Satu NIM satu kiriman per tugas** (ditegakkan indeks unik di basis data).
Mengganti kiriman diperbolehkan selama pengumpulan dibuka, tetapi hanya dengan
menyertakan kode kiriman lama; kodenya tetap sama dan penilaiannya diulang.
Penolakan tidak pernah membocorkan kode lama, jadi mengetik NIM teman tidak
membuka apa pun. Mahasiswa yang lupa kodenya dapat menanyakannya ke dosen:
kolom **Kode** ada di tabel langkah 5.

## 2. PDF menjadi .md, PDF tidak disimpan

PDF dibaca dengan pdf.js **di ponsel/laptop pengirim**, disusun menjadi
Markdown, lalu hanya teks itu yang dikirim. Susunan yang dikenali:

| Pada PDF | Menjadi |
|---|---|
| huruf lebih besar dari huruf badan | `#`, `##`, `###` |
| `BAB I`, `1.2 Latar Belakang`, `A. Tujuan`, baris pendek berhuruf kapital | judul |
| `•`, `-`, `1.`, `a)` di awal baris | butir daftar |
| baris bercelah lebar yang berurutan | tabel Markdown |
| kata terpenggal `komuni-` / `kasi` | disambung |
| nomor halaman, kop/kaki yang berulang di tiap halaman | dibuang |
| tiap halaman | `[Halaman N]` (supaya umpan balik AI dapat menyebut halaman) |

Jarak antarparagraf diukur dari dokumennya sendiri, jadi naskah berspasi 2
dan berspasi 1 sama-sama terbaca benar. Mahasiswa **melihat sendiri teks yang
akan dikirim** sebelum menekan Kumpulkan. PDF hasil pindaian/foto (kurang dari
20 kata) ditolak dengan saran mengekspor ulang dari Word/Google Docs.

Yang tersimpan per kiriman: Markdown, nama berkas, ukuran, jumlah halaman,
jumlah kata, dan **SHA-256 berkas asli**. Bila nilai dipersoalkan, sidik PDF
yang dipegang mahasiswa dapat dicocokkan (tombol *Cocokkan PDF Anda* di
papan, atau `sha256sum`), tanpa portal pernah menyimpan PDF-nya.

Impor dari Drive (zip/rar/PDF/Word/Excel, fitur v53) tetap ada di langkah 4,
dan kini juga menjadi kiriman .md bertanda **Impor**, masing-masing dengan
kodenya sendiri.

## 3. Gerbang plagiasi dan notifikasi

Setiap kiriman dibandingkan dengan **seluruh kiriman lain pada tugas yang
sama**: otomatis sesaat sesudah masuk, dan dihitung ulang sebelum dosen
menilai (tombol *🛡 Cek plagiasi*, juga dijalankan otomatis oleh *✨ Nilai
yang belum*).

Ukurannya **persen isi yang sama persis**, yaitu urutan lima kata berturut-turut
milik kiriman ini yang juga ada di kiriman lain. Angka ini dapat dikatakan
apa adanya kepada mahasiswa ("45% isi kiriman Anda sama dengan kiriman lain").
Rumus Jaccard pada kemiripan esai CBT tidak dipakai di sini karena untuk
dokumen utuh ia meremehkan salinan: separuh isi yang disalin hanya terbaca ±33%.

| Diabaikan | Alasannya |
|---|---|
| urutan kata yang dipakai **separuh kelas** atau lebih (minimal 4 kiriman) | templat dosen, soal yang disalin, kop seragam |
| kalimat dari **petunjuk tugas** di langkah 1 | teks dari dosen sendiri |
| kiriman di bawah 40 kata | persennya tidak bermakna (yang sama persis tetap tertangkap) |

**Berkas PDF identik** (SHA-256 sama) dan teks identik langsung 100%.

Ambang di langkah 5: *perlu ditinjau* ≥ 25%, *terindikasi plagiasi* ≥ 50%
(dapat diubah). Untuk yang terindikasi, dosen memilih tindakan gerbang:

| Tindakan | Akibatnya |
|---|---|
| **Tahan nilainya sampai ditinjau dosen** (bawaan) | tidak dinilai AI; di papan tampil *Ditahan* |
| **Beri nilai 0** | tidak dinilai AI; di papan 0 (merah) sampai dosen memulihkan |
| **Tetap dinilai, beri keterangan** | dinilai AI seperti biasa; penandanya tetap ada |

Yang ditahan atau dinolkan **tidak pernah dikirim ke AI**, jadi tidak memakai
kuota. Dosen meninjau dengan *Bandingkan* (kalimat yang sama persis
ditampilkan berdampingan), lalu memutuskan per kiriman: **Loloskan** atau
**Plagiasi (nilai 0)**. Hasil AI yang sudah ada tidak dibuang; meloloskan
kiriman langsung mengembalikan nilai aslinya tanpa menilai ulang.

**Notifikasi**: kiriman yang *baru* terindikasi membunyikan lonceng dashboard
pemilik tugas ("Indikasi plagiasi: <tugas>: N kiriman, nama-namanya"). Dosen
yang akunnya tersambung ke data dosen menerimanya sendiri; selebihnya
dialamatkan ke Admin dan Super Admin. Di langkah 5, ringkasan dan tabel
menandai siapa saja yang terindikasi.

**Untuk mahasiswa** (ralat permintaan 3): di papan nilai, baris yang
terindikasi bertanda *⚠ Terindikasi plagiasi* (atau *Plagiasi* bila sudah
diputus dosen), dengan tombol **🔒 Keterangan**. Isinya (persen kesamaan,
status tinjauan dosen, dan hingga tiga contoh kalimat **dari teks mahasiswa
itu sendiri** yang sama persis dengan kiriman lain) hanya terbuka bila kode
SIPALING-TUGAS yang dimasukkan adalah kode **baris itu**. Kiriman pembandingnya
tidak pernah disebut namanya.

Seperti pemeriksa kemiripan esai CBT, sistem menyebutnya **indikasi**, bukan
bukti. Parafrase yang benar-benar ditulis ulang memang tidak tertangkap,
dan itu disengaja.

## 4. Papan Nilai Tugas

`cbt.<domain>/papan` (juga ada tombolnya di halaman depan CBT). Hanya tugas
yang **diterbitkan dosen** (langkah 6) yang tampil.

- Diurutkan dari nilai tertinggi; nilai sama berbagi peringkat (1, 1, 3).
- Kolom: peringkat, nama, **NIM tersamar** (`2370•••••92`), nilai, predikat,
  keterangan. Kode kiriman tidak pernah tercetak di papan.
- Nilai di bawah **batas kritis** tampil **merah** dengan tombol 🔒 Keterangan.
- Ringkasan: jumlah dinilai, rata-rata, tertinggi, jumlah di bawah batas
  kritis, jumlah terindikasi plagiasi.

**Keterangan terkunci** menjelaskan kenapa nilainya kecil, disusun dari hasil
penilaian tanpa memanggil AI lagi: kriteria yang menurunkan nilai (skor dan
deskripsi capaiannya), area yang perlu diperbaiki, catatan tindak lanjut,
alasan bila kiriman tidak lolos gerbang isi, dan indikasi plagiasi.

**Cek kiriman saya** di kepala papan: dengan kode, mahasiswa melihat status
kirimannya (sudah diterima / nilainya belum terbit / ditahan), nilai,
peringkat, keterangan, rincian skor, **mengunduh laporan PDF-nya sendiri**
(isinya sama persis dengan laporan yang diunduh dosen), dan mencocokkan PDF.

## 5. Batas kritis di "Penilaian AI & laporan PDF"

Kotak pengaturan di bagian atas langkah 5: **Batas kritis nilai (merah di
bawah)**, persen 0–100, per tugas, bawaan 60. Dipakai di tabel dosen (baris
merah), di papan (nilai merah + keterangan), di rekap Excel (kolom "Di bawah
batas kritis"), dan di laporan PDF (kotak merah "Nilai berada di bawah batas
kritis …").

## 6. Kaki "Disusun menggunakan Software SPF" dan laporan yang elegan

- Kaki laporan kini **"Disusun menggunakan Software SPF"** (dapat dimatikan di
  langkah 1). Tidak ada lagi tulisan "bantuan AI" di laporan.
- **Pita biru tua** di puncak tiap halaman: "LAPORAN PENILAIAN TUGAS" dan
  **kode kiriman**, sehingga halaman mana pun yang tercecer tetap terlacak.
- Judul biru tua dengan bilah emas, judul bagian bergaris pemisah lembut.
- Tabel informasi dengan kolom label berlatar; tabel rubrik berkepala biru tua
  dengan baris berselang.
- **Nilai akhir dan predikat di dalam kotak sorot**; keterangan sistem
  (plagiasi, nilai kritis) dalam kotak merah tepat di bawahnya.
- Garis emas tipis di atas kaki halaman, nomor "Halaman 1 dari 2".
- Template bawaan mendapat satu baris: **Kode Kiriman**. Template sendiri
  boleh memakai penanda `{{kode}}`.

Tetap ditulis tanpa pustaka (Helvetica bawaan PDF), ± 15 KB per laporan.

## 7. Unduh untuk Drive, dan hapus

Langkah 6 → **⇩ Arsip lengkap (.zip)**:

```
BACA-DULU.md                 ringkasan tugas & cara memeriksa SHA-256
laporan/PENILAIAN_…pdf       laporan tiap mahasiswa yang sudah bernilai
kiriman/<KODE>_<Nama>_<NIM>.md   isi kiriman, berkepala YAML (kode, NIM,
                             berkas, halaman, sha256, kemiripan, nilai)
REKAP_NILAI.xlsx             nilai tiap kriteria + lembar Plagiasi
PLAGIASI.csv                 pasangan kiriman yang mirip
RUBRIK_DAN_TEMPLATE.md       rubrik, predikat, ambang, template
```

Unduhan lain: PDF per mahasiswa, `.md` per kiriman, semua PDF + rekap, rekap
.xlsx. Isi .md diambil berkelompok (± 3 MB per permintaan) sehingga kelas
besar tidak menabrak batas jawaban Vercel.

**Hapus**: per kiriman (✕), *Hapus semua kiriman*, atau *Hapus tugas ini*
(beserta seluruh kiriman, nilai, dan pasangan kemiripannya). Pemilik tugas,
Admin, dan Super Admin boleh menghapus. Tautan Arsip Drive tugas itu **tetap
ada** sesudah tugasnya dihapus.

## 8. Arsip Drive dan tautan pendek

Dashboard → CBT → **Arsip Drive** (menu kelima), dan formulir ringkasnya di
langkah 6. Tempelkan tautan folder/berkas Google Drive tempat zip arsip
disimpan; portal membuat tautan pendek:

```
https://<portal>/s/K7Q2XMP   →  https://drive.google.com/drive/folders/…
```

- Hanya **Google Drive/Docs** yang diterima (diperiksa di server, di basis
  data, dan sekali lagi saat mengalihkan), supaya pemendek portal tidak dapat
  dipakai mengantar ke situs penipu.
- Jumlah dibuka dicatat. Tautan yang tidak ada menampilkan halaman "Tautan
  arsip tidak ditemukan".
- **Hanya Super Admin yang dapat menghapus** (server menolak peran lain;
  tombolnya terkunci di layar mereka). Pengajar melihat arsipnya sendiri;
  Admin dan Super Admin melihat semua.

---

## Wewenang

| Tindakan | Pengajar (pemilik) | Admin | Super Admin | Mahasiswa (tanpa akun) |
|---|---|---|---|---|
| Buat & atur tugas, nilai, putuskan plagiasi, terbitkan | ✓ | lihat saja | lihat saja | – |
| Hapus kiriman/tugas | ✓ | ✓ | ✓ | – |
| Simpan tautan Arsip Drive | ✓ | ✓ | ✓ | – |
| Hapus tautan Arsip Drive | – | – | ✓ | – |
| Kumpulkan tugas | – | – | – | ✓ (pengumpulan dibuka) |
| Lihat papan nilai | ✓ | ✓ | ✓ | ✓ (tugas yang terbit) |
| Buka keterangan satu baris | – | – | – | hanya dengan kode baris itu |

Aturan pemilik mengikuti ujian CBT (`pemilik()` di `src/lib/cbt.ts`).

## Yang perlu dijalankan

1. **SQL**: jalankan `supabase-update-v54-tugas-cbt.sql` di Supabase → SQL
   Editor (aman diulang). Empat tabel baru, RLS menyala tanpa policy seperti
   tabel CBT lain. Pemeriksaan di akhir berkas harus menampilkan empat baris
   `rls = true`.
2. Deploy. Tidak ada dependensi baru.
3. Pengaturan tugas v53 yang tersimpan di peramban dosen: buka Penilaian tugas
   di peramban yang sama, lalu tekan **Pindahkan ke server**. Yang dipindahkan
   rubrik, template, dan pengaturannya; hasil penilaian v53 tetap ada di zip
   yang dulu diunduh.

## Uji

```
npx tsx uji-tugas-cbt.ts          155 periksa lulus (baru)
npx tsx uji-situs-cbt.ts           68 lulus (12 baru: /tugas, /papan, /s/)
npx tsx uji-penilaian-tugas.ts    162 periksa lulus
npx tsc --noEmit
npm run lint
npm run build
```

Tiga uji lama sudah gagal **sebelum** v54 dan tidak disebabkan perubahan ini:
`uji-kosakata-cbt.ts` (87 baris kosakata kampus di berkas CBT lama; sesudah v54
justru 83, karena kepala jalur penilaian tugas ikut dirapikan),
`uji-tanda-pisah.ts` (tanda pisah panjang di `kunci-ai-panel.tsx` dan
`kurikulum-panel.tsx`), dan `uji-serah.ts` (satu pesan). Berkas baru v54 tidak
menambah satu pun pelanggaran keduanya. Seluruh uji lain lulus.

`uji-tugas-cbt.ts` berjalan tanpa jaringan dan tanpa basis data: kode kiriman
(bentuk, abjad, 3.000 tanpa kembar, ketikan longgar, penolakan tebakan),
NIM tersamar, saringan tautan Drive (http, domain tiruan, userinfo,
`javascript:`), SHA-256; PDF → .md dari potongan buatan tangan dan dari PDF
sungguhan (judul, BAB, butir, tabel, pemenggalan, kop berulang, nomor
halaman, PDF rusak); plagiasi (separuh disalin ±50%, ringkasan yang disalin
utuh, PDF identik, templat separuh kelas, petunjuk dosen, ambang dosen,
120 kiriman × 1.500 kata di bawah 4 detik); gerbang dan nilai yang berlaku
untuk ketiga tindakan dan kedua putusan; papan (peringkat bersama, merah,
terkunci, ditahan, tanpa kode); keterangan; laporan PDF (pita, kode, kaki
SPF, kotak sorot, warna, xref); SQL v54 dan aturan jalur terbuka.

Di luar uji yang ikut di repo, seluruh alur dijalankan di **Chromium** pada
server pengembangan dengan **PostgreSQL 16 sungguhan** (tabel v54 dibuat
dari berkas SQL ini), dan Gemini tiruan:

- mahasiswa: kode tugas → nama/NIM → PDF dibaca menjadi .md → kode
  SIPALING-TUGAS → tanda terima; NIM ganda ditolak; PDF tanpa teks ditolak;
- dua PDF identik langsung bertanda 100% dan lonceng dosen berbunyi;
- dosen: impor zip unduhan Drive (2 mahasiswa), gerbang plagiasi menangkap
  salinan PDF teman, *Loloskan*, batas kritis 70, *Nilai yang belum*
  (3 tertahan gerbang, tidak dikirim ke AI), sunting skor, PDF, zip arsip
  lengkap, tautan pendek (307 ke Drive, klik tercatat);
- papan: kode orang lain pada baris lain ditolak, kode pemilik (huruf kecil,
  tanpa awalan) membuka keterangan, unduh laporan PDF, *Cocokkan PDF* cocok,
  tampilan ponsel tanpa geser mendatar;
- Super Admin menghapus arsip (tautan pendek lalu 404); Pengajar dan Admin
  ditolak; Super Admin dapat melihat tetapi tidak mengubah tugas pengajar;
  permintaan dari asal asing ditolak CSRF.

## Batasan yang perlu diketahui

- **AI menilai teks .md-nya saja** untuk kiriman lewat CBT, karena PDF-nya
  tidak disimpan: tata letak dan gambar di dalam PDF tidak terlihat model.
  Kiriman yang diimpor dosen pada sesi yang sama tetap dapat dilampiri PDF
  dan gambarnya seperti v53.
- PDF hasil pindaian/foto ditolak saat dikumpulkan (tidak ada teksnya).
- Plagiasi hanya antarkiriman **satu tugas**, bukan dengan internet, dan hanya
  kesamaan kata persis lima berturut-turut. Parafrase tidak tertangkap.
  Siapa yang menyalin siapa tidak dapat diketahui mesin; keduanya ditandai
  dan dosen yang memutuskan.
- Mahasiswa tidak berakun (sama seperti ujian CBT): seseorang dapat
  mengumpulkan atas NIM orang lain lebih dulu. Dosen melihatnya di tabel,
  menghapus kirimannya, dan mahasiswa yang benar mengumpulkan lagi.
- Papan menampilkan nama lengkap (seperti mading, sesuai permintaan); NIM
  disamarkan dan halaman CBT tidak diindeks mesin pencari.
- Pembatas laju bersifat per-instance (lihat `src/lib/rate-limit.ts`).

## Berkas yang berubah

| Berkas | Isi |
|---|---|
| `supabase-update-v54-tugas-cbt.sql` | **baru**: `cbt_tasks`, `cbt_task_submissions`, `cbt_task_similarity`, `drive_archives`, RLS |
| `src/db/schema.ts` | keempat tabel di atas |
| `src/lib/tugas-kode.ts` | **baru**: kode kiriman/tugas/tautan pendek, NIM tersamar, saringan Drive, SHA-256 |
| `src/lib/pdf-markdown.ts` | **baru**: PDF → Markdown |
| `src/lib/tugas-plagiasi.ts` | **baru**: plagiasi antarkiriman |
| `src/lib/tugas-papan.ts` | **baru**: gerbang, nilai yang berlaku, peringkat, keterangan, data laporan |
| `src/lib/tugas-store.ts` | **baru**: basis data tugas, kiriman, penghitungan ulang plagiasi, notifikasi |
| `src/app/api/cbt/tugas/route.ts` | menilai kiriman tersimpan, gerbang plagiasi lebih dulu |
| `src/app/api/cbt/tugas/kelola/route.ts` | **baru**: daftar, buat, ubah, salin, pindah v53, hapus tugas |
| `src/app/api/cbt/tugas/kiriman/route.ts` | **baru**: .md, impor dosen, suntingan, putusan, identitas, hapus |
| `src/app/api/cbt/tugas/plagiasi/route.ts` | **baru**: hitung ulang, bandingkan dua kiriman |
| `src/app/api/cbt/kumpul/route.ts` | **baru** (terbuka): info tugas, kumpulkan |
| `src/app/api/cbt/papan/route.ts` | **baru** (terbuka): papan, buka dengan kode |
| `src/app/api/arsip-drive/route.ts` | **baru**: Arsip Drive (hapus: Super Admin) |
| `src/app/s/[kode]/route.ts` | **baru**: tautan pendek |
| `src/app/cbt/tugas/*`, `src/app/cbt/papan/*` | **baru**: halaman Kumpulkan Tugas dan Papan Nilai |
| `src/app/cbt/masuk-cbt.tsx`, `src/app/cbt/page.tsx` | tombol Kumpulkan tugas & Papan nilai |
| `src/app/dashboard/penilaian-tugas.tsx` | panel ditulis ulang: tersimpan di server, 6 langkah |
| `src/app/dashboard/arsip-drive.tsx` | **baru**: menu Arsip Drive |
| `src/app/dashboard/cbt-panel.tsx` | menu kelima Arsip Drive |
| `src/lib/pdf-sederhana.ts` | warna, pita kepala, tabel berkepala, kotak sorot, kaki bergaris |
| `src/lib/tugas-template.ts` | kaki SPF, baris Kode Kiriman, `{{kode}}`, keterangan sistem |
| `src/lib/situs-cbt.ts` | `/tugas` dan `/papan` milik situs CBT; `awalanCbt()` |
| `src/lib/api-errors.ts` | pesan "jalankan SQL v54" bila tabelnya belum ada |
| `src/app/globals.css` | gaya `.pt-*` baru, `.ad-*`, `.kt-*`, `.pn-*` |
| `uji-tugas-cbt.ts` | **baru** |
| `uji-situs-cbt.ts` | rute v54 |
