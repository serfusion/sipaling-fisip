# v28: CBT pindah ke subdomainnya sendiri — cbt.sipalingfisip.web.id

Subdomainnya sudah hidup. Sejak pembaruan ini, **CBT tinggal di sana**, bukan
lagi menumpang di `/cbt` pada domain portal.

Tidak ada perubahan basis data. Tidak ada berkas SQL baru yang perlu
dijalankan — cukup deploy seperti biasa.

---

## Yang berubah bagi yang membukanya

| Yang membuka | Dulu | Sekarang |
| --- | --- | --- |
| Mahasiswa | `www.sipalingfisip.web.id/ujian?kode=XXXXXX` | `cbt.sipalingfisip.web.id/ujian?kode=XXXXXX` |
| Pintu masuk CBT | `www.sipalingfisip.web.id/cbt` | `cbt.sipalingfisip.web.id` — di akarnya |
| Dosen dan admin | dashboard portal, menu **Ujian Online (CBT)** | **tidak berubah** |

Menu CBT tetap di dalam dashboard portal, dan itu disengaja: yang membukanya
dosen yang sudah masuk dengan akun portal, dan sesi login itu terikat pada
domain portal. Memindahkannya berarti memindahkan seluruh sesi login — pekerjaan
yang jauh lebih besar daripada yang diminta, dengan risiko yang menimpa seluruh
layanan lain, bukan hanya CBT.

**Tautan lama tidak ada yang mati.** Tautan ujian yang sudah terlanjur beredar
di grup kelas — yang masih menunjuk domain portal — dialihkan ke subdomain
dengan kode ujiannya ikut terbawa. Yang membukanya mendarat pada ujian yang
sama persis, hanya lewat satu lompatan.

---

## Bagaimana satu penyebaran melayani dua situs

Tidak ada penyebaran kedua, tidak ada basis data kedua, tidak ada salinan kode.
Yang membedakan kedua situs hanyalah **tuan rumah pada permintaan**, dan
middleware membacanya lalu mengantar permintaannya ke tempat yang benar:

```
cbt.sipalingfisip.web.id/            → ditulis ulang ke /cbt        (alamat tetap subdomain)
cbt.sipalingfisip.web.id/ujian       → ditulis ulang ke /cbt/ujian  (alamat tetap subdomain)
cbt.sipalingfisip.web.id/login       → dialihkan ke portal
cbt.sipalingfisip.web.id/cbt/ujian   → dirapikan ke /ujian          (alamat kembar)

www.sipalingfisip.web.id/cbt         → dialihkan ke cbt.sipalingfisip.web.id/
www.sipalingfisip.web.id/ujian?kode= → dialihkan ke cbt.sipalingfisip.web.id/ujian?kode=
```

Yang **tidak** disentuh: `/api`, bundel Next.js, dan berkas statis. Ketiganya
dipakai bersama oleh kedua situs, dan layar ujian memanggil `/api/cbt/...`
dengan alamat relatif — jadi permintaannya tetap satu asal dengan halamannya,
dan perlindungan CSRF portal tetap berlaku tanpa perlu dilonggarkan.

Yang di subdomain **ditulis ulang**, bukan dialihkan: alamat di bilah peramban
tetap `cbt.sipalingfisip.web.id/ujian?kode=XXXXXX`. Itu memang yang diinginkan
— tangkapan layar yang beredar di grup kelas menunjukkan alamat ujiannya, bukan
alamat internal.

Yang antardomain **dialihkan sementara** (307), bukan permanen. Pengalihan
permanen mengendap di peramban mahasiswa sampai cache-nya dibuang; kalau nama
subdomainnya suatu saat perlu dikoreksi, yang sudah mengendap itu tidak dapat
ditarik kembali di tengah musim ujian.

---

## Berkas yang bekerja

| Berkas | Tugasnya |
| --- | --- |
| `src/lib/situs-cbt.ts` | **Satu-satunya** tempat yang tahu host mana milik siapa. Fungsi murni, jadi dapat diuji tanpa menyalakan server. |
| `src/middleware.ts` | Menerjemahkan rencana dari berkas di atas menjadi jawaban HTTP. |
| `src/app/cbt/page.tsx` | Membaca tuan rumah di server, lalu menurunkan alamat portal ke pintu masuk CBT. |
| `src/app/cbt/masuk-cbt.tsx` | Tautan "SiPaling FISIP" dan "Masuk ke dashboard" menunjuk portal dengan alamat lengkap. |
| `src/app/dashboard/cbt-panel.tsx` | Tautan yang disalin dosen kini menunjuk subdomain. |
| `uji-situs-cbt.ts` | 52 pemeriksaan atas seluruh aturan di atas. |

Jalankan ujinya:

```bash
npx tsx uji-situs-cbt.ts
```

---

## Yang perlu dipastikan di Vercel

1. **Domain `cbt.sipalingfisip.web.id` terpasang pada proyek yang sama.**
   Bukan proyek baru — situsnya satu, dan kedua domain menunjuk penyebaran yang
   sama. (Ini sudah dikerjakan; subdomainnya sudah hidup.)

2. **Kalau nama domainnya ternyata berbeda** — misalnya yang terdaftar
   `www.cbt.sipalingfisip.web.id` dan bukan `cbt.sipalingfisip.web.id` —
   isikan environment variable:

   ```
   NEXT_PUBLIC_CBT_HOST = www.cbt.sipalingfisip.web.id
   ```

   Nama itulah yang kemudian dipakai untuk seluruh tautan yang disalin dosen.
   Tanpa pengaturan ini pun keduanya tetap **dilayani** dengan benar — bentuk
   `cbt.*` maupun `www.cbt.*` sama-sama dikenali sebagai situs CBT — yang
   ditentukannya hanyalah nama mana yang ditulis pada tautan.

   Nama lama `CBT_HOST` tetap dihormati bagi penyebaran yang sudah memakainya.
   Bedanya: `NEXT_PUBLIC_CBT_HOST` ikut sampai ke peramban, sehingga panel dosen
   dapat menyusun tautan ujiannya sendiri.

3. **Tidak perlu menyentuh `ALLOWED_ORIGINS`.** Halaman CBT memanggil API
   dengan alamat relatif, jadi asal permintaannya sama dengan halamannya.

---

## Saat dikembangkan di komputer sendiri

`localhost` tidak punya subdomain, dan pratayang `*.vercel.app` juga tidak.
Karena itu di sana **tidak ada pengalihan sama sekali**: CBT tetap dilayani di
`/cbt` dan `/ujian` seperti dahulu. Mengalihkan ke alamat yang tidak ada sama
saja dengan mematikan CBT bagi yang sedang mengembangkannya.

---

## Yang sengaja dibiarkan apa adanya

**Mode maintenance portal masih ikut menutup CBT.** `/api/cbt/ikut` berada di
balik penjaga maintenance yang sama dengan layanan portal lainnya, jadi selama
portal ditutup, ujian juga tidak dapat dimasuki. Sekarang bahwa keduanya sudah
menjadi dua situs, itu barangkali bukan yang diinginkan — tetapi mengubahnya
adalah keputusan tentang **kapan ujian boleh berjalan**, bukan tentang alamat,
dan keputusan seperti itu pantas diambil sendiri, bukan diselipkan ke dalam
pemindahan alamat.
