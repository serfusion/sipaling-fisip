# UPDATE v5 — Mode Maintenance (halaman kucing tidur)

Saat mode ini dinyalakan, portal mahasiswa diganti satu halaman berisi animasi
kucing tidur, tulisan besar **maintenance**, dan kalimat-kalimat lucu yang
berganti sendiri. Titik di atas huruf **i** pada kata "maintenance" adalah
**tautan tersembunyi ke halaman login** yang bisa dinyalakan/dimatikan.

Semua tombolnya hanya untuk **Super Admin**. Admin biasa tidak melihat menunya,
dan kalaupun mencoba memanggil API-nya langsung, server menolak.

---

## 1. Yang berubah

**Berkas baru**

| Berkas | Isi |
| --- | --- |
| `public/animations/sleeping-cat.json` | Animasi kucing tidur (Lottie, vektor murni) |
| `public/animations/sleeping-cat.lottie` | Berkas `.lottie` asli, disimpan sebagai cadangan |
| `src/app/maintenance-screen.tsx` | Tampilan halaman maintenance |
| `src/lib/maintenance.ts` | Tipe data, teks bawaan, dan aturan validasi |
| `src/lib/maintenance-store.ts` | Baca/tulis status ke database + penjaga API |
| `src/app/api/maintenance/route.ts` | API status (GET umum, PUT khusus Super Admin) |
| `supabase-update-v5-maintenance.sql` | Baris awal di `app_settings` (opsional) |

**Berkas yang disunting**

| Berkas | Perubahan |
| --- | --- |
| `src/app/page.tsx` | Memeriksa status maintenance sebelum menampilkan portal |
| `src/app/dashboard/dashboard-app.tsx` | Menu + panel "Mode Maintenance" (Super Admin) |
| `src/app/globals.css` | Gaya halaman maintenance dan panelnya |
| `src/app/api/requests/route.ts` | Kiriman pengunjung umum ditolak saat maintenance |
| `src/app/api/revisions/route.ts` | idem |
| `src/app/api/title-proposals/route.ts` | idem |
| `package.json` | Tambah pustaka `lottie-web` (pemutar animasi) |

---

## 2. Cara memasang

1. **Unggah kode ke GitHub** seperti biasa (semua berkas di atas ikut).
2. **Vercel** akan otomatis build ulang. Tidak ada environment variable baru
   yang perlu ditambahkan.
3. **Supabase** — opsional. Jalankan `supabase-update-v5-maintenance.sql` di
   SQL Editor bila ingin barisnya langsung ada. Kalau dilewati pun aplikasi
   tetap jalan: selama baris itu belum ada, portal dianggap **normal**.

> Catatan: mode maintenance menumpang di tabel `app_settings` yang sudah ada
> sejak update v2. Tidak ada tabel baru.

---

## 3. Cara memakai

**Dashboard → menu "Mode Maintenance"** (hanya muncul untuk Super Admin).

| Kendali | Fungsi |
| --- | --- |
| Sakelar merah besar | Menyalakan/mematikan mode maintenance. Langsung tersimpan. |
| Sakelar "Pintu rahasia" | Menyalakan/mematikan tautan pada titik huruf "i". Langsung tersimpan. |
| Kalimat pembuka | Baris kecil di atas kata "maintenance" (maks. 120 huruf) |
| Pesan utama | Paragraf penjelasan (maks. 400 huruf) |
| Teks lencana kuning | Baris pendek di bawah pesan (maks. 90 huruf) |
| **Pulihkan teks bawaan** | Mengembalikan ketiga teks ke tulisan aslinya |
| **Lihat pratinjau →** | Membuka `/?preview=maintenance` di tab baru |

Kalimat-kalimat lucu yang berganti tiap 4,5 detik tertanam di kode
(`JOKES` pada `src/app/maintenance-screen.tsx`), bukan di database — silakan
disunting di sana bila ingin menambah.

**Kenapa perlu tombol pratinjau?** Karena akun yang sudah login selalu
dilewatkan dari maintenance. Tanpa tombol itu, Super Admin tidak akan pernah
melihat halaman kucingnya sendiri.

---

## 4. Pintu rahasia pada huruf "i"

Kata "maintenance" tidak ditulis sebagai teks biasa. Batang huruf "i"-nya
memakai glif **ı** (huruf i tanpa titik) dari font yang sama, lalu titiknya
dipasang sebagai elemen tersendiri di atasnya. Ukuran dan posisi titik itu
diukur langsung dari fontnya (Plus Jakarta Sans 800): berbentuk **kotak**
0,15em dan berdiri 0,6em di atas garis dasar — sehingga sama persis dengan
huruf "i" asli dan tidak terlihat sebagai tempelan.

Saat pintu rahasia **aktif**, titik itu menjadi tautan ke `/login`:

- tidak berubah warna, tidak bergaris bawah, tidak ada tooltip;
- kursor tetap berbentuk panah biasa (bukan tangan), jadi tidak ketahuan
  walau tidak sengaja dilewati kursor;
- tidak ikut urutan tombol Tab dan tidak dibacakan pembaca layar;
- hanya saat benar-benar disorot kursor, titiknya menguning tipis — cukup
  untuk memastikan Anda sudah tepat sasaran sebelum mengklik.

Saat dimatikan, titik itu kembali menjadi titik biasa tanpa tautan apa pun.

> **Anda tidak akan pernah terkunci di luar.** Halaman login tetap bisa dibuka
> langsung lewat alamat `https://sipalingfisip.web.id/login`, baik pintu
> rahasianya menyala maupun tidak.

---

## 5. Siapa melihat apa saat maintenance menyala

| Pengunjung | Yang terjadi |
| --- | --- |
| Mahasiswa / umum | Halaman kucing tidur. Kirim form ditolak sementara (503). |
| Dosen / admin yang sudah login | Portal tetap normal, dengan bilah kuning pengingat di atas. |
| Super Admin | Sama seperti di atas, plus menu untuk mematikannya kembali. |

Penolakan kiriman berlaku untuk tiga jalur milik mahasiswa: pengajuan layanan,
unggah revisi, dan pengajuan judul. Ini menutup celah tab lama yang sudah
terbuka sebelum maintenance dinyalakan. Pekerjaan dosen dan admin tidak
terganggu sama sekali.

---

## 6. Kalau dashboard tidak bisa dibuka

Matikan lewat Supabase → SQL Editor:

```sql
update public.app_settings
   set value = jsonb_set(value::jsonb, '{enabled}', 'false')::text,
       updated_at = now()
 where key = 'maintenance_mode';
```

Portal langsung normal kembali pada kunjungan berikutnya.

---

## 7. Catatan teknis

- **Gagal-terbuka.** Bila database bermasalah, status maintenance dianggap
  *mati* dan portal tetap tampil. Ini mengikuti aturan lama pada
  `src/app/page.tsx`: halaman utama tidak boleh ikut mati gara-gara database.
- **Tidak membebani kunjungan biasa.** Selama maintenance mati, halaman utama
  tidak memanggil Supabase sama sekali — pengecekan sesi hanya dijalankan bila
  mode maintenance menyala atau pratinjau dibuka.
- **Animasi.** Diputar dengan `lottie-web` versi *light* (perender SVG,
  ±168 KB) dan hanya diunduh ketika halaman maintenance benar-benar tampil.
  Berkas animasinya vektor murni tanpa gambar tempelan, jadi tetap tajam di
  layar besar. Kanvas aslinya 3840×2160 dengan banyak ruang kosong, karena itu
  dipotong lewat `CAT_VIEWBOX` supaya kucingnya memenuhi bingkai.
- **Aturan keamanan situs (CSP) tidak perlu diubah.** Animasi dan pemutarnya
  dilayani dari domain sendiri, bukan dari CDN luar.
- **Hemat gerak.** Bila pengguna mematikan animasi di setelan perangkatnya,
  kucingnya tetap tampil tetapi diam.
- **Kalau animasi gagal dimuat**, halaman tetap utuh: muncul gambar kucing
  sederhana (🐈💤) yang bernapas pelan sebagai pengganti.
