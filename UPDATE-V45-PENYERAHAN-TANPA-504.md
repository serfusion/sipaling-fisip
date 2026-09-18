# UPDATE v45 — Penyerahan Skripsi berhenti gagal di "Menyimpan pengajuan…", dan kini punya animasi unggahan

## Yang dilaporkan

> Pada layanan Perpustakaan, saat menunggu **"Semua berkas terunggah. Menyimpan
> pengajuan…"** selalu muncul error — salah satunya *"Server terlalu lama
> memproses kiriman lalu dihentikan. Biasanya karena berkasnya besar; perkecil
> ukurannya lalu coba lagi. (kode 504)"*. Berkali-kali selalu masalah yang sama,
> tidak bisa unggah karena file skripsi besar-besar. Tolong dibetulkan dan
> dibuatkan animasi loading saat mengunggah.

Laporan ini **tepat menunjuk tempatnya**. Kalimat "Semua berkas terunggah"
muncul sesudah keempat PDF benar-benar sampai di penyimpanan; yang gagal adalah
langkah terakhir — `POST /api/requests`, yang seharusnya hanya mencatat
beberapa ratus bita.

---

## Sebabnya

### 1. Langkah terakhir menyalin sampai 55 MB, empat kali, berurutan

v43 memindahkan berkas dari `requests/transit/<tanggal>/…` ke
`requests/<tiket>/…` pada detik formulirnya masuk. Yang tidak diperhitungkan:
**"pindah" di Supabase Storage berarti MENYALIN seluruh isi berkas**, lalu
menghapus yang lama.

Satu penyerahan yang sah berukuran 10 + 10 + 10 + 25 MB. Jadi di dalam satu
permintaan yang anggaran waktunya 60 detik, terjadi berurutan:

| # | Kerja | Berapa kali |
|---|-------|-------------|
| 1 | buat URL bertanda tangan | 4 |
| 2 | baca 16 bita pertama untuk memastikan isinya PDF | 4 |
| 3 | **salin berkas ke folder tiket** | 4 (sampai 55 MB) |

Dua belas perjalanan ke Supabase yang saling menunggu, ditambah empat salinan
yang besarnya tergantung ukuran skripsi. Semakin besar berkasnya, semakin dekat
ke batas 60 detik — dan begitu terlewat, Vercel memutus fungsinya lalu menjawab
dengan halaman galatnya sendiri: **504**.

Itu juga menjelaskan mengapa masalahnya "selalu" untuk berkas besar dan tidak
pernah terlihat pada berkas kecil.

### 2. Dan sesudah 504 pertama, percobaan berikutnya TIDAK MUNGKIN berhasil

Inilah bagian yang membuat mahasiswa mencoba berkali-kali dengan galat yang
berganti-ganti. Fungsi yang diputus di tengah sering sudah sempat memindahkan
satu-dua berkas. Jalur transitnya karena itu **sudah kosong**, sehingga
percobaan kedua dijawab:

> Berkas "Cover sampai daftar isi" tidak ditemukan di penyimpanan. Pilih ulang
> berkasnya lalu kirim lagi.

Dan bila fungsinya sempat menyimpan pengajuannya sampai selesai lalu jawabannya
yang hilang, percobaan berikutnya justru membuat **tiket kedua** untuk skripsi
yang sama.

### 3. Tidak ada satu pun tanda bahwa unggahan masih berjalan

Selama berkas 25 MB naik — bermenit-menit pada jaringan ponsel — yang terlihat
di layar hanya satu baris teks yang tidak bergerak. Tidak ada cara membedakan
"sedang naik" dari "sudah menggantung", jadi sebagian mahasiswa menekan kirim
dua kali, dan sebagian lain menutup tabnya tepat sebelum selesai.

---

## Yang diperbaiki

### 1. Berkasnya tidak lagi disalin — jalurnya dicatat apa adanya

`amankanBagian` berhenti memindahkan berkas. Yang dicatat basis data adalah
jalur tempat peramban menaruhnya.

Yang hilang karena ini **hanya kerapian nama folder di dalam bucket**. Tidak ada
satu pun bagian portal yang membaca tiket dari jalur berkas: dashboard, unduhan
(`/api/attachments/[id]`), "Backup Semua", arsip perpustakaan, dan penghapusan
tiket semuanya bekerja dari jalur yang tercatat di basis data.

Berkasnya juga tidak akan tersapu: penyapu `/api/cleanup` sejak awal **menolak
menghapus jalur yang masih ditunjuk basis data**. Sejak v45 pengaman itu naik
pangkat dari "jaring pengaman" menjadi satu-satunya penjaga, jadi penyapunya
ikut diperbaiki: daftar isi foldernya kini dibaca **berhalaman** (dulu hanya
1000 nama pertama, dan pada musim penyerahan satu folder tanggal bisa lebih
dari itu), dan pertanyaan ke basis data dipotong per 200 jalur.

### 2. Pemeriksaannya dijalankan sekaligus, dan setiap panggilan punya batas waktu

- Keempat berkas diperiksa bersamaan (`Promise.all`), bukan satu per satu.
- Setiap panggilan ke Supabase Storage kini punya batas waktu sendiri (20 detik,
  10 detik untuk pembacaan kepala berkas). Panggilan yang menggantung karena itu
  menghasilkan **pesan portal** — "Penyimpanan tidak menjawab saat memeriksa
  berkas …, ini gangguan sementara di sisi penyimpanan, bukan berkas Anda" —
  bukan halaman 504 tanpa keterangan.
- Klien Supabase dibuat **sekali** per proses, bukan belasan kali per permintaan
  (setiap pembuatan membawa pemasangan TLS-nya sendiri).

Hasilnya: langkah "Menyimpan pengajuan…" tidak lagi punya kerja yang membesar
mengikuti ukuran skripsi.

### 3. Kirimannya boleh dicoba lagi — dan tidak pernah melahirkan tiket kedua

Dua bagian, dan keduanya harus ada:

- **Peramban** (`src/lib/kirim-ulang.ts`) mengulang kiriman terakhir sampai 3
  kali bila yang gagal **bukan keputusan portal**: 504, 502, 500 tanpa pesan,
  sambungan putus, jawaban tidak terbaca. Penolakan yang membawa pesan portal
  ("NIM harus angka", "Berkas melebihi batas", "Portal sedang maintenance")
  **tidak** diulang — jawabannya tidak akan berubah. Percobaan ulang hanya
  mengirim beberapa ratus bita; tidak ada berkas yang diunggah ulang.
- **Server** (`src/lib/kiriman-ulang-server.ts`) mengenali kiriman ulang dari
  **jalur berkasnya**. Jalur itu dibuat server, unik per izin unggah, dan sejak
  perbaikan #1 tidak berubah sesudah diklaim. Bila ada lampiran yang sudah
  menunjuk jalur tersebut, yang dipulangkan **tiket yang sudah ada** beserta
  keterangannya — bukan tiket kedua, dan bukan galat.

Revisi mendapat perlakuan yang sama, dengan satu tambahan: revisi yang tersimpan
mengubah status tiket menjadi "Masuk", sehingga kiriman ulangnya dulu ditolak
*"Upload revisi hanya tersedia saat status Revisi"*. Pemeriksaan kiriman ulang
karena itu dijalankan **sebelum** penjaga status.

Batas laju kedua endpoint dinaikkan 8 → 15 per 10 menit, karena satu pengiriman
sekarang boleh memakai sampai tiga percobaan.

### 4. Animasi unggahan, dengan persentase yang sungguhan

Panel baru (`src/app/kemajuan-unggah.tsx`) menjawab tiga pertanyaan yang muncul
selama menunggu:

```
  ◠ Mengunggah berkas 3 dari 4 — skripsi-full.pdf (68%)        68%
    37,4 MB dari 55,0 MB terkirim
  ████████████████████████░░░░░░░░░░░

  ✓  Cover sampai daftar isi        cover.pdf · 2,1 MB       selesai
  ✓  BAB I sampai BAB V             isi.pdf · 8,4 MB         selesai
  ↑  Daftar pustaka sampai selesai  pustaka.pdf · 3,2 MB          68%
  ·  Skripsi full format PDF        full.pdf · 21,3 MB       menunggu

  Jangan tutup atau muat ulang halaman ini sampai nomor tiket muncul.
```

- **Angkanya nyata, bukan perkiraan.** Unggahannya kini dikerjakan
  `XMLHttpRequest`, satu-satunya cara peramban melaporkan berapa bita badan
  permintaan yang sudah terkirim (`fetch` tidak bisa). Bentuk permintaannya
  sama dengan yang dikirim pustaka Supabase, dan jenis berkasnya tetap dipaksa
  `application/pdf`.
- **Tahap "Menyimpan pengajuan…"** tidak punya angka yang dapat diukur, jadi
  bilahnya berganti menjadi garis berjalan dan berhenti di 99% — penuh di layar
  sementara prosesnya belum selesai adalah bentuk lain dari berbohong.
- **Percobaan ulang ikut terlihat**: "(percobaan 2 dari 3)".
- **Unggahan yang macet diputus, yang lambat tidak.** Bila tidak ada bita baru
  selama 45 detik, unggahan dibatalkan lalu dicoba dengan cara lain; sesudah
  bita terakhir terkirim, penyimpanan diberi waktu sampai 3 menit untuk
  menjawab (di sini memang tidak ada lagi kemajuan untuk diawasi).
- Pembaca layar mendapat kalimatnya lewat satu simpul `aria-live`, bukan dari
  angka persen yang berubah puluhan kali per detik. `prefers-reduced-motion`
  dihormati: angkanya tetap, gerakannya berhenti.
- Panel ini juga tampil untuk layanan biasa dan absensi, dengan kalimat
  "Mengirim pengajuan…" — tanpa menyebut berkas apa pun.

### 5. Tiket tanpa lampiran tidak lagi tertinggal di antrean

Bila pencatatan lampiran gagal sesudah tiketnya tersimpan, baris tiketnya ikut
dibuang. Dulu ia tertinggal sebagai pekerjaan yang tidak mungkin dikerjakan di
antrean admin perpustakaan, sekaligus menghalangi kiriman ulang mahasiswa.

---

## Yang HARUS dijalankan admin

**Tidak ada.** Tidak ada perubahan struktur basis data, tidak ada SQL baru, dan
tidak ada pengaturan Supabase yang perlu disentuh. Cukup deploy.

Satu-satunya yang tetap perlu dipastikan adalah yang sudah diminta v43: batas
ukuran bucket `service-documents` sudah 25 MB
(`supabase-update-v43-unggah-langsung.sql`). Bila belum, unggahan berkas di atas
10 MB akan ditolak penyimpanan — dan pesannya sudah menyebut nama berkas SQL-nya.

Lampiran lama yang sudah berada di `requests/<tiket>/…` tetap terbaca seperti
biasa: jalurnya tercatat di basis data, dan tidak ada yang perlu dipindahkan.

---

## Catatan jujur tentang satu akibat sampingan

Karena berkas tidak lagi dipindahkan, izin unggah yang sudah dipakai mahasiswa
(berumur 2 jam) secara teori masih dapat dipakai menimpa berkasnya sendiri
sesudah pengajuannya tersimpan. Yang dapat ditimpa **hanya berkasnya sendiri
pada tiketnya sendiri**, ukurannya tetap dibatasi bucket (25 MB, hanya PDF/DOCX),
dan pemeriksaan portal memang hanya memastikan bita pertamanya `%PDF` — artinya
mahasiswa yang ingin mengirim PDF kosong sejak awal sudah bisa melakukannya
tanpa celah ini. Ditukar dengan penyerahan yang akhirnya bisa berhasil, harganya
kecil, tetapi tetap dicatat di sini supaya tidak ditemukan sebagai kejutan.

---

## Uji

```bash
npx tsx uji-unggah-kemajuan.ts      # 54 pemeriksaan, tanpa Supabase & basis data
npx tsx uji-unggah-langsung.ts      # jalur transit, tanda tangan, penyapu
npm run typecheck && npm run lint && npm run build
```

`uji-unggah-kemajuan.ts` memeriksa:

| Bagian | Yang dipastikan |
|--------|-----------------|
| Persentase | tidak pernah NaN, tidak pernah melewati 100, tahap menyimpan berhenti di 99 |
| Kalimat | menyebut berkas keberapa, namanya, persennya, percobaan keberapa; pengajuan tanpa berkas tidak pernah menulis "berkas 1 dari 0" |
| Baris berkas | selesai / sedang naik / menunggu, dan semuanya selesai saat tahap menyimpan |
| Boleh dicoba lagi | 504, 502, 500, 408, sambungan putus, jawaban tidak terbaca → ya; 400, 413, 429, dan apa pun yang membawa pesan portal → tidak |
| Pengulangan | 504 lalu berhasil = 2 panggilan; penolakan portal = 1 panggilan; gagal terus berhenti tepat pada batas dan pesannya menyebut bahwa berkasnya tidak hilang; jawaban "sudah tersimpan" diterima sebagai berhasil |
| Pengenal kiriman ulang | hanya jalur penyimpanan yang dipakai, urutannya terjaga |

---

## Berkas yang berubah

| Berkas | Perubahan |
|--------|-----------|
| `src/lib/unggah-klaim.ts` | tidak lagi memindahkan berkas; pemeriksaan keempat bagian dijalankan sekaligus; `jalurDiklaim` |
| `src/lib/document-storage.ts` | batas waktu per panggilan, klien Supabase dibuat sekali, `moveDocument` dihapus, "lambat" dibedakan dari "hilang" |
| `src/lib/kiriman-ulang-server.ts` | **baru** — mengenali kiriman ulang dari jalur berkasnya |
| `src/lib/kirim-ulang.ts` | **baru** — pengulangan kiriman di peramban beserta aturannya |
| `src/lib/kemajuan.ts` | **baru** — angka dan kalimat kemajuan (murni, dapat diuji) |
| `src/lib/unggah-klien.ts` | unggahan lewat XHR dengan laporan bita, pengawas macet, pengawas jawaban |
| `src/lib/sapu-transit.ts` | daftar folder dibaca berhalaman; pertanyaan basis data dipotong |
| `src/app/kemajuan-unggah.tsx` | **baru** — panel kemajuan beserta animasinya |
| `src/app/sipaling-app.tsx` | memakai panel kemajuan dan pengulangan kiriman, untuk pengajuan maupun revisi |
| `src/app/globals.css` | gaya panel kemajuan; `.kabar-unggah` yang digantikannya dihapus |
| `src/app/api/requests/route.ts` | kiriman ulang dijawab dengan tiket yang sama; batas laju 15; tiket tanpa lampiran dibuang |
| `src/app/api/revisions/route.ts` | kiriman ulang dikenali sebelum penjaga status; formulir dibaca sekali; batas laju 15 |
| `uji-unggah-kemajuan.ts` | **baru** |
