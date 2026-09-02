# v17: Revisi penyerahan perpustakaan, dan lonceng admin yang akhirnya berbunyi

## Masalahnya

Dua keluhan, dan keduanya sama-sama membuat pekerjaan berhenti di tempat.

### 1. Revisi penyerahan skripsi masih meminta satu berkas .docx

Penyerahan skripsi/jurnal ke perpustakaan diunggah sebagai **empat bagian
PDF** — cover sampai daftar isi, BAB I–V, daftar pustaka, dan berkas utuh.
Tetapi tab **Upload Revisi** tidak pernah tahu itu: apa pun tiketnya, ia
menggambar satu kotak bertuliskan "Upload File Revisi .DOCX", dan servernya
menolak segala yang bukan `.docx`.

Akibatnya mahasiswa yang tiketnya diberi status **Revisi** oleh admin
perpustakaan tidak punya jalan sama sekali. Kalau ia menuruti formulirnya dan
mengirim satu berkas Word, keadaannya justru lebih buruk daripada gagal:
berkas itu tercatat sebagai berkas utama tiket, sementara empat PDF aslinya
tetap tertinggal di penyimpanan tanpa pernah diperbarui. Admin membuka tiket
yang sama dan masih melihat berkas lama.

### 2. Lonceng admin selalu berkata "Belum ada notifikasi"

Bukan karena loncengnya rusak. **Tidak pernah ada satu pun notifikasi yang
dibuat untuk tiket layanan.** `pushNotification` hanya dipanggil dari alur
Pengajuan Judul; pengajuan layanan biasa dan upload revisi tidak memanggilnya
sama sekali.

Dan seandainya ada pun, sebagian besar tidak akan sampai: penyaring di
`/api/notifications` memberi Super Admin dan Admin **hanya notifikasi
`admin_prodi`**. Tiket perpustakaan, umum, akademik, PDDIKTI, dan
laboratorium tidak masuk hitungan siapa pun.

---

## Yang berubah

### 1. Revisi perpustakaan = empat PDF yang mengganti berkas lama

Tab **Upload Revisi** sekarang mengenali tiketnya lebih dulu. Begitu nomor
tiket dan NIM terisi, halaman menanyakan bentuk formulirnya ke server; kalau
tiketnya penyerahan perpustakaan, kotak `.docx` berganti sendiri menjadi
**empat kotak PDF** yang sama persis dengan formulir pengajuan awalnya,
lengkap dengan batas ukurannya (10 MB per bagian, 25 MB untuk berkas utuh).

Bentuknya **ditanyakan, bukan ditebak dari nomor tiket**. Awalan
`SIPALING-PERPUS-` dipakai bersama oleh absensi, bebas pustaka, cek
repository, dan penyerahan — dan hanya yang terakhir yang berkasnya empat
bagian.

Yang terjadi saat dikirim:

- Keempat berkas baru naik lebih dulu.
- Catatan lampirannya ditukar di dalam **satu transaksi**.
- Berkas lama dihapus **paling akhir**, setelah tidak ada satu baris pun yang
  menunjuknya.

Urutan itu disengaja. Kalau dibalik, satu kegagalan di tengah jalan
meninggalkan tiket yang berkasnya sudah telanjur hilang dan tidak dapat
dikembalikan.

**Nomor tiketnya tidak berubah.** Statusnya kembali ke `Masuk` /
`Belum Dicek` supaya masuk lagi ke antrean pemeriksaan, dan penghitung
"Revisi ke-" bertambah satu.

Berkas `.docx` yang telanjur terkirim lewat formulir lama ikut dibersihkan
pada revisi berikutnya, berikut baris riwayatnya — riwayat yang menjanjikan
unduhan yang selalu gagal lebih buruk daripada tidak ada riwayat sama sekali.

Halaman lama yang masih terbuka di tab mahasiswa tidak dibiarkan menebak:
kiriman satu berkas Word untuk tiket penyerahan dijawab dengan penjelasan
bahwa revisinya empat PDF dan halamannya perlu dimuat ulang.

### 2. Lonceng admin berbunyi untuk tiket dan revisi

Dua notifikasi baru dibuat:

| Kejadian | Judul | Sampai ke |
| --- | --- | --- |
| Pengajuan layanan baru masuk | Pengajuan layanan baru | Admin unit layanan itu, dan dosen tujuan bila ada |
| Mahasiswa mengunggah revisi | Revisi berkas masuk | Admin unit layanan itu, dan dosen tujuan bila ada |

Keduanya membawa nomor tiket sebagai `refCode`, jadi **menekan notifikasinya
langsung membuka antrean yang sudah tersaring ke tiket itu** — satu ketukan
sampai ke barisnya, bukan ke daftar ratusan tiket.

Tiket perpustakaan hanya berbunyi di lonceng Admin Perpustakaan, tiket umum
di Admin Umum, dan seterusnya. Layanan Tugas Akhir tidak dipegang admin unit
mana pun, jadi notifikasinya dialamatkan ke dosen tujuan yang dipilih
mahasiswa.

**Absensi Perpustakaan sengaja tidak berbunyi.** Ia langsung berstatus
Selesai dan tidak pernah masuk antrean siapa pun; notifikasinya hanya akan
menjadi kebisingan yang menutupi tiket yang benar-benar perlu diperiksa.

### 3. Super Admin dan Admin melihat seluruh unit

Penyaring lonceng diperbaiki: kedua peran itu memegang seluruh unit layanan,
jadi loncengnya memuat notifikasi **setiap** unit. Yang tetap dikecualikan
hanya notifikasi bertuan dosen — itu percakapan antara Prodi dan dosen yang
bersangkutan.

Admin unit lain tidak berubah: masing-masing tetap hanya melihat unitnya.

---

## Berkas yang berubah

| Berkas | Perubahan |
| --- | --- |
| `src/app/api/revisions/route.ts` | `GET` baru untuk mengenali bentuk formulir; `POST` bercabang ke penggantian empat bagian |
| `src/app/sipaling-app.tsx` | Tab Upload Revisi berganti bentuk mengikuti tiketnya |
| `src/app/api/requests/route.ts` | Notifikasi pengajuan baru |
| `src/app/api/notifications/route.ts` | Super Admin dan Admin melihat seluruh unit |
| `src/lib/notify.ts` | `audienceForServiceType` — pemetaan jenis layanan ke role admin unit |
| `src/app/dashboard/dashboard-app.tsx` | Notifikasi tiket membuka antrean yang tersaring |
| `uji-revisi.ts` | 22 pemeriksaan baru |

---

## Cara memeriksa

```bash
npx tsx uji-revisi.ts   # 22 periksa: bentuk formulir, berkas, arah notifikasi
npx tsx uji-serah.ts    # aturan berkas penyerahan tetap sama
npm run typecheck
npm run lint
npm run build
```

Uji manual:

1. Kirim satu penyerahan skripsi lewat **Layanan Perpustakaan → Penyerahan
   Skripsi/Jurnal** dengan empat PDF. Lonceng Admin Perpustakaan berbunyi.
2. Di dashboard, ubah status tiket itu menjadi **Revisi**.
3. Buka tab **Upload Revisi**, isi nomor tiket dan NIM. Kotak unggahnya
   berganti menjadi empat kotak PDF.
4. Kirim empat PDF baru. Loncengnya berbunyi lagi, tiketnya kembali ke
   `Masuk`, dan laci lampiran di dashboard menampilkan berkas yang baru —
   nomor tiketnya tetap sama.

Tidak ada migrasi database pada pembaruan ini.
