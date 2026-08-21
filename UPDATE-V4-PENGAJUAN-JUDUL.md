# UPDATE V4 — Pengajuan Judul Tugas Akhir, Database Dokumen & Notifikasi

Ringkasan seluruh perubahan pada pembaruan ini beserta langkah pemasangannya.

---

## 1. Langkah pemasangan (WAJIB, urut)

1. Buka **Supabase → SQL Editor → New query**.
2. Salin **seluruh isi** file `supabase-update-v4-pengajuan-judul.sql`, tempel, lalu **Run**.
   Hasil akhir yang benar: muncul 5 baris nama tabel
   (`document_contributors`, `document_records`, `notifications`,
   `title_proposal_choices`, `title_proposals`).
3. Deploy ulang di Vercel (otomatis setelah push ke GitHub).

File SQL tersebut aman dijalankan berulang kali. Selain membuat tabel baru,
file itu juga:

- menambah `image/jpeg` dan `image/png` ke bucket `service-documents`
  (bukti keuangan boleh berupa foto), dan
- mengganti `service_type` tiket lama `Layanan Skripsi / Jurnal`
  menjadi `Layanan Tugas Akhir` agar riwayat tiket tetap terlihat.

---

## 2. "Rumah Skripsi/Jurnal" menjadi "Tugas Akhir"

Menu layanan **Layanan Skripsi / Jurnal** kini bernama **Layanan Tugas Akhir**.
Alurnya: pilih **Skripsi** atau **Jurnal** dulu lewat sakelar di form, baru
muncul kebutuhannya.

| Pilihan | Kebutuhan yang tersedia |
| --- | --- |
| Skripsi | Pengajuan Judul Skripsi · Upload Skripsi Full Draft · Upload Revisi Skripsi |
| Jurnal | Pengajuan Judul Jurnal · Upload Artikel Jurnal · Upload Revisi Artikel Jurnal |

Nama lama `Layanan Skripsi / Jurnal` masih diterima oleh API supaya tiket dan
tautan yang sudah tersebar sebelum pembaruan tidak menjadi tidak valid.

---

## 3. Template Pengajuan Judul (portal mahasiswa)

Tab baru **"Pengajuan Judul"** di portal mahasiswa. Bisa dibuka dari:

- tombol **Pengajuan Judul** di hero,
- menu **Prodi → Pengajuan Judul Tugas Akhir**, atau
- menu **Tugas Akhir → Pengajuan Judul Skripsi/Jurnal**.

Isi template: pernyataan pemohon (teks baku, boleh disunting), nama, NIM,
alamat, program studi, konsentrasi/kejuruan, IPK terakhir, kontak, judul,
**upload bukti keuangan** (PDF/JPG/PNG maks. 10 MB), dan **3 usulan dosen**.
Setiap dosen tampil beserta jumlah bimbingannya, mis.
`Dr. Mirza Shahreza, M.I.K (8 Mhs Bimbingan)`. Di kanan bawah template ada blok
tanda tangan **"Hormat Saya,"** dengan nama jelas pemohon yang mengikuti isian
nama secara langsung.

Setelah dikirim, mahasiswa menerima **kode pelacakan** berformat
`SIPALING-PRODI-JUDUL-XXXXX-XXXXX`. Kode itu dimasukkan di tab
**Cek Status Layanan** (kolom yang sama dengan nomor tiket biasa) untuk melihat
hasil verifikasi, dosen mana yang dipilih Prodi, serta keputusan dosen.

Satu NIM hanya boleh memiliki satu pengajuan judul yang sedang berjalan.

---

## 4. Alur persetujuan

```
Mahasiswa kirim template
        │
        ▼
Admin Prodi  ── ceklis "Bukti Keuangan" + "Layak Diajukan"
             ── pilih 1 dari 3 dosen usulan (atau tunjuk dosen pengganti)
        │
        ▼
Dosen terpilih menerima notifikasi → TERIMA / TOLAK
        │                                   │
        ▼                                   ▼
Disetujui Dosen                    (URGENT) notifikasi ke Prodi
Surat Tugas otomatis terbentuk     Prodi menunjuk dosen pengganti
```

### Panel Admin Prodi — menu "Pengajuan Judul"

- Daftar pengajuan lengkap dengan filter status dan penanda ceklis verifikasi.
- Detail berisi data mahasiswa, pernyataan, dan tombol membuka bukti keuangan.
- Dua ceklis wajib: **Bukti Keuangan** dan **Layak Diajukan**. Tombol
  "Setujui & teruskan ke dosen" baru aktif setelah keduanya tercentang dan satu
  dosen dipilih.
- Bisa memilih **dosen pengganti di luar tiga usulan mahasiswa** — dipakai saat
  ketiga usulan tidak sesuai atau dosen terpilih menolak.
- Spanduk **URGENT** muncul di atas daftar bila ada dosen yang menolak.
- Hanya Super Admin yang dapat menghapus pengajuan.

### Panel Dosen — menu "Bimbingan & Surat Tugas"

- Kartu **PERLU KEPUTUSAN** untuk setiap mahasiswa yang sudah disetujui Prodi,
  dengan tombol **TERIMA** dan **TOLAK**. Alasan wajib diisi saat menolak.
- Tabel mahasiswa bimbingan berjalan.
- Tombol **Unduh Surat Tugas (PDF)** — surat dibangun ulang dari data terkini,
  jadi setiap penambahan mahasiswa bimbingan otomatis ikut memperbarui isinya.
  Surat dibuka di jendela cetak browser; pilih "Save as PDF" atau cetak di atas
  kertas berkop fakultas.

---

## 5. Database dokumen terpusat — menu "Database Dokumen"

Tersedia untuk seluruh admin (tambah + lihat) dan dosen (lihat dokumen yang
mencantumkan namanya).

- Panduan **"Tambahkan Data di Database"** berisi 5 langkah: login Google Drive
  (tombol membuka tab baru), unggah berkas, ubah izin menjadi "Siapa saja yang
  memiliki link", salin tautan, lalu lengkapi datanya.
- Jenis dokumen: Surat Tugas, Sertifikat, Sertifikasi, Publikasi Jurnal, Jurnal
  Bersama Mahasiswa, Artikel Ilmiah, Surat Keputusan, Hak Kekayaan Intelektual,
  Pengabdian Masyarakat, Penelitian, dan Dokumen Lainnya.
- Kolom **dosen yang terlibat** — setiap dosen yang ditandai langsung menerima
  notifikasi *"… menambahkan Anda sebagai kontributor pada …"*.
- Tabel menampilkan jenis, judul, dosen terlibat, admin penambah beserta
  rolenya, tanggal & jam penambahan, dan tautan unduh.
- **Data tidak dapat dihapus kecuali oleh Super Admin.**

Hanya tautan `https://drive.google.com/…` dan `https://docs.google.com/…` yang
diterima, sehingga tautan berskema berbahaya tidak bisa masuk ke database.

---

## 6. Notifikasi

Lonceng 🔔 di topbar dashboard. Notifikasi dosen bersifat pribadi; notifikasi
program studi dibaca bersama oleh Admin Prodi, Admin, dan Super Admin.

| Peristiwa | Penerima | Sifat |
| --- | --- | --- |
| Mahasiswa mengirim pengajuan judul | Admin Prodi | info |
| Prodi meneruskan ke dosen | Dosen terpilih | info |
| Dosen menerima mahasiswa | Admin Prodi | info |
| Dosen menolak mahasiswa | Admin Prodi | **URGENT** |
| Ditambahkan sebagai kontributor dokumen | Dosen terkait | info |

---

## 7. Pencarian dosen

Semua kolom pemilihan dosen (form layanan, template pengajuan judul, seleksi
Prodi, kontributor database) memakai kotak pencarian yang **menyaring langsung
saat mengetik — tanpa menekan Enter**, dengan navigasi panah atas/bawah.

Urutan abjad memakai **nama asli**, bukan gelar depan: gelar `Dr.`, `Prof.`,
`Drs.`, `Dra.`, `Ir.`, `H.`, `Hj.`, `KH.`, `apt.`, dan `Ns.` diabaikan
(termasuk yang berlapis seperti `Prof. Dr. Ir.`), sehingga
`Dr. Mirza Shahreza, M.I.K` diurutkan pada huruf **M**.

---

## 8. Template SKPI

Kartu **SKPI — Surat Keterangan Pendamping Ijazah** sudah disiapkan pada menu
**Template Dokumen** untuk Admin Prodi (juga terlihat oleh Admin dan Super
Admin). Format resminya menyusul dan akan langsung tampil di kartu tersebut.

---

## 9. Perbaikan lain

- **`.gitignore` ditambahkan.** Sebelumnya repositori tidak punya `.gitignore`
  sama sekali, sehingga `node_modules/`, hasil build `.next/`, dan yang paling
  berisiko — file `.env` berisi kunci Supabase — bisa ikut ter-commit tanpa
  disadari. Sekarang semuanya diabaikan Git.
- **Otorisasi berkas.** Bukti keuangan hanya bisa dibuka Admin Prodi/Admin/
  Super Admin dan dosen yang sedang ditugaskan pada pengajuan itu, lewat signed
  URL berumur 60 detik.
- **Endpoint pelacakan publik dibatasi.** `/api/title-proposals/track` sengaja
  tidak mengembalikan alamat, kontak, tautan bukti keuangan, atau catatan
  internal — karena kode pelacakan bisa saja terlihat orang lain.
- **Notifikasi tidak bisa ditandai lintas pengguna.** Penandaan "sudah dibaca"
  selalu disaring ulang berdasarkan audiens, jadi id notifikasi orang lain tidak
  bisa ditebak dan ditandai.
- **Surat Tugas aman dari penyisipan markup.** Seluruh nilai dinamis (nama,
  judul) di-escape sebelum masuk ke HTML jendela cetak.
- **Validasi isi berkas diperluas.** Pemeriksaan *magic bytes* kini juga
  mencakup JPG dan PNG, sehingga file yang sekadar berganti ekstensi tetap
  ditolak.
- **`baseUrl` pada `tsconfig.json` dihapus.** Opsi itu sudah usang dan membuat
  `npm run typecheck` gagal; `paths` tetap berfungsi tanpa opsi tersebut.

---

# Pembaruan lanjutan (v4.1)

## A. Konsentrasi program studi diperbaiki

| Program Studi | Konsentrasi |
| --- | --- |
| Ilmu Komunikasi | Public Relations · Advertising · Broadcasting |
| Ilmu Pemerintahan | **Tidak ada** — kolomnya disembunyikan otomatis |

Pilihan lama (Jurnalistik, Komunikasi Digital, Kebijakan Publik, dan
seterusnya) dihapus. Nilainya juga **divalidasi di server** terhadap daftar
resmi, jadi tidak bisa diakali dengan mengirim data langsung ke API.

## B. Form Layanan saat kebutuhan "Pengajuan Judul" — diperbaiki total

**Masalahnya:** memilih kebutuhan Pengajuan Judul dari dropdown Form Layanan
masih menampilkan form biasa yang hanya punya **satu Dosen Tujuan**, padahal
pengajuan judul mewajibkan tiga usulan dosen.

**Perbaikannya, di semua jalur masuk:**

1. Memilih kartu layanan → langsung ke tab Template Pengajuan Judul.
2. Mengganti **Jenis Layanan** lewat dropdown → ikut berpindah otomatis.
3. Mengganti **Kebutuhan Layanan** lewat dropdown → ikut berpindah otomatis.
4. Mengganti sakelar **Skripsi/Jurnal** → ikut berpindah otomatis.
5. Bila entah bagaimana masih tertinggal di tab Form, form biasa **diganti
   kartu pengalih** yang menjelaskan alasannya dan menyediakan tombol menuju
   template — jadi kolom satu dosen itu tidak akan pernah muncul lagi.
6. Tombol **Reset** kini mendarat pada kebutuhan yang benar-benar dapat
   diisi lewat form biasa.

Sebagai pengaman terakhir, `POST /api/requests` **menolak** kebutuhan yang
diawali "Pengajuan Judul" dan mengarahkan ke template yang benar.

## C. Tanda tangan surat PKL

Blok tanda tangan pada template **Permohonan Praktek Kerja Lapangan**
digeser **1,5 cm ke kiri** (kelas `sign-inset`) mengikuti tata letak Surat
Keterangan, dan label diseragamkan menjadi "Wakil Dekan I,".

> **Perhatian:** bila Admin Umum pernah menekan **Simpan template** untuk
> PKL, versi tersimpan itulah yang dipakai dan menimpa bawaan. Buka
> **Template Dokumen → Permohonan Praktek Kerja Lapangan**, lalu simpan
> ulang agar posisi baru ikut terpakai.

## D. Aksi di luar alur dikunci untuk Super Admin

Sesuai permintaan, Program Studi kini **hanya menyeleksi dari tiga usulan
mahasiswa**. Semua aksi yang keluar dari alur menjadi hak Super Admin:

| Aksi | Prodi | Super Admin |
| --- | --- | --- |
| Ceklis verifikasi & pilih 1 dari 3 usulan | ✅ | ✅ |
| Tolak pengajuan dengan alasan | ✅ | ✅ |
| Tunjuk dosen **di luar** tiga usulan | ❌ | ✅ |
| Ganti pembimbing yang **sudah final** | ❌ | ✅ |
| Hapus pengajuan judul | ❌ | ✅ |

Pembatasan ini ditegakkan **di server** (`403`), bukan sekadar tombolnya
disembunyikan — jadi tetap berlaku walau API dipanggil langsung. Bila ketiga
dosen menolak, layar Prodi menampilkan arahan untuk meminta Super Admin
menunjuk pengganti.

## E. Tampilan portal dirapikan

- Ukuran teks yang sebelumnya 10–11px dinaikkan ke ambang yang nyaman dibaca
  di ponsel.
- Navigasi tab: dari kisi 2 kolom (yang menyisakan baris ganjil setelah tab
  kelima) menjadi barisan yang dapat digeser mendatar di ponsel dan merata
  di layar lebar.
- Cincin fokus papan ketik yang jelas pada seluruh elemen interaktif.
- Sasaran sentuh minimal 44px, dengan umpan balik saat ditekan.
- Keadaan "layanan terpilih" dibuat lebih tegas; panah kartu bergerak halus.
- Sudut dan bayangan panel diselaraskan dengan komponen baru.
- Form dua kolom pada layar lebar.
- Menghormati `prefers-reduced-motion` bagi pengguna yang mematikan animasi.

## F. Keamanan

Seluruhnya dirangkum di **`KEAMANAN.md`**, termasuk penjelasan jujur
mengenai butir-butir VPS (nginx, PHP, firewall, blokir port, cronjob OS,
`raw.github`) yang **tidak berlaku** pada susunan Next.js + Vercel +
Supabase, beserta padanannya.

Ringkas: security headers + CSP, proteksi CSRF berbasis Origin, sanitasi
HTML berbasis DOM untuk template surat, rate limiting pada seluruh endpoint
publik, endpoint cron header-only dengan perbandingan waktu-tetap, cookie
`SameSite`+`Secure`, dan pengetatan RBAC.

Semua sudah diuji langsung terhadap server produksi lokal:

```
POST tanpa Origin                     -> 403
POST dari origin asing                -> 403
/api/cleanup tanpa header             -> 401
/api/cleanup?key=... (cara lama)      -> 401
/api/documents tanpa login            -> 401
permintaan ke-31 pada endpoint lacak  -> 429
```
