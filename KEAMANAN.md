# Keamanan SiPaling FISIP

Dokumen ini menjawab daftar pemeriksaan keamanan satu per satu: mana yang
**sudah dikerjakan di kode**, mana yang **harus Anda aktifkan sendiri di
panel Vercel/Supabase/Cloudflare**, dan mana yang **tidak berlaku** untuk
susunan teknologi ini beserta alasannya.

---

## 0. Hal terpenting dibaca lebih dulu

Beberapa permintaan pada daftar Anda berasal dari dunia **VPS / shared
hosting** (nginx, PHP, iptables, cronjob sistem, blokir `raw.github`).
Aplikasi ini **tidak berjalan di server semacam itu**:

| Yang diminta | Kenyataan pada stack ini |
| --- | --- |
| Matikan fungsi PHP, cegah upload `.php` dijalankan | **Tidak ada PHP sama sekali.** Runtime-nya Node.js. File yang diunggah masuk ke Supabase Storage — bucket objek, bukan direktori web — sehingga tidak ada konsep "file dieksekusi lewat browser". |
| Hardening nginx | **Tidak ada nginx.** Vercel yang mengelola edge/proxy-nya, konfigurasinya tidak dapat kita sentuh. Padanannya adalah security headers, dan itu sudah dipasang (bagian 1). |
| Firewall, blokir port keluar, matikan akses `curl` | **Tidak ada mesin yang bisa dipasangi iptables.** Fungsi serverless berumur pendek dan tidak punya shell yang persisten. |
| Cek cronjob sistem | Tidak ada crontab OS. Satu-satunya penjadwal adalah **Vercel Cron** di `vercel.json` (`/api/cleanup`) — sudah diperketat, lihat bagian 6. |
| Blokir akses ke `raw.githubusercontent.com` | Skenario yang Anda gambarkan (penyerang mengunduh biner terenkripsi lewat raw.github lalu menjalankannya) mensyaratkan **eksekusi perintah di server**. Di sini tidak ada shell, tidak ada `exec`, dan filesystem-nya read-only kecuali `/tmp`. Meski begitu, jalur keluar tetap ditutup dari sisi peramban lewat `connect-src` pada CSP (bagian 1). |
| Cek hidden service | Tidak ada daemon tersembunyi yang bisa hidup — kontainer dibuat ulang tiap permintaan. |

**Kesimpulan jujur:** vektor serangan pada arsitektur ini bukan "webshell di
server", melainkan **lapisan aplikasi** — CSRF, XSS, kebocoran otorisasi,
brute force, dan kebocoran kunci. Ke sanalah seluruh pekerjaan diarahkan.

---

## 1. Security headers & CSP — ✅ selesai di kode

Berkas: `next.config.ts`

| Header | Nilai | Gunanya |
| --- | --- | --- |
| `Content-Security-Policy` | lihat di bawah | Membatasi dari mana skrip/gaya/koneksi boleh berasal |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Memaksa HTTPS selama 2 tahun |
| `X-Frame-Options` | `DENY` | Anti clickjacking |
| `X-Content-Type-Options` | `nosniff` | Peramban dilarang menebak tipe berkas |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | URL internal tidak bocor ke situs lain |
| `Permissions-Policy` | kamera/mikrofon/lokasi/pembayaran dimatikan | Perangkat keras yang tak dipakai ditutup |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | Isolasi jendela (popup cetak tetap jalan) |
| `Cross-Origin-Resource-Policy` | `same-origin` | Aset tidak bisa disedot situs lain |
| `X-Permitted-Cross-Domain-Policies` | `none` | Menutup celah lawas Flash/PDF |
| `X-Powered-By` | **dihapus** | Versi framework tidak terekspos |

CSP yang berlaku:

```
default-src 'self'; script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:;
connect-src 'self' <origin Supabase Anda>; media-src 'self';
worker-src 'self' blob:; manifest-src 'self'; frame-src 'none';
frame-ancestors 'none'; form-action 'self'; base-uri 'self';
object-src 'none'; upgrade-insecure-requests
```

> **Catatan jujur soal `'unsafe-inline'` pada `script-src`.** Next.js
> menyisipkan skrip hidrasi inline, dan jendela cetak (laporan antrean,
> Surat Tugas, pratinjau surat) juga memakai skrip inline. Menghapusnya
> menuntut CSP berbasis *nonce*, yang tidak dapat diterapkan pada jendela
> `about:blank` hasil `window.open`. Jadi lapisan itu memang lebih longgar
> dari ideal — tetapi `object-src 'none'`, `base-uri 'self'`,
> `frame-ancestors 'none'`, `form-action 'self'`, dan `connect-src` yang
> dikunci tetap menutup jalur eksfiltrasi data ke domain asing.

---

## 2. CSRF — ✅ selesai di kode

Berkas: `src/middleware.ts`

Sesi disimpan pada cookie, sehingga peramban ikut mengirimkannya walau
permintaan dipicu situs lain. Karena itu **setiap** `POST`/`PUT`/`PATCH`/
`DELETE` ke `/api/*` wajib membawa header `Origin` yang host-nya sama dengan
host permintaan. Bila tidak → **403**.

Hasil pengujian nyata:

```
POST tanpa Origin              -> 403
POST dari https://penyerang.x  -> 403
POST dari origin sendiri       -> lolos
```

Domain tambahan yang sah dapat didaftarkan lewat environment variable
`ALLOWED_ORIGINS` (dipisah koma).

Lapis kedua: cookie sesi dipasangi `SameSite=Lax` dan `Secure` di produksi
(`src/lib/supabase-server.ts`).

> `httpOnly` **sengaja tidak** dipasang: login portal ini berjalan di
> peramban lewat `@supabase/ssr`, jadi pustakanya harus bisa membaca dan
> memperbarui cookie sesinya sendiri. Memaksakan `httpOnly` membuat pengguna
> tampak selalu logout dan gagal sign out. Risiko pencurian cookie ditekan
> dari sisi lain: CSP, sanitasi HTML, dan escaping React.

---

## 3. XSS — ✅ selesai di kode

1. **React meng-escape seluruh teks** secara bawaan. Tidak ada
   `dangerouslySetInnerHTML` di mana pun.
2. **Jendela cetak** (laporan antrean, Surat Tugas) membangun HTML dari data
   database. Seluruh nilai dinamis dilewatkan fungsi `esc()` yang mengubah
   `& < > " '` menjadi entitas.
3. **Editor template surat** adalah satu-satunya tempat HTML mentah masuk ke
   DOM — isinya berasal dari konversi `.docx` (mammoth) dan dari template
   tersimpan buatan admin lain. Ini **stored XSS antar-admin** yang nyata.
   - Ditambahkan `src/lib/sanitize-html.ts`: pembersih **berbasis DOM dengan
     allowlist** yang membangun ulang pohon elemen dan hanya menyisakan tag
     serta atribut yang memang dibutuhkan surat. Dipasang di sisi **render**,
     yaitu titik yang benar-benar menentukan.
   - Penyaring lama di `/api/templates` berbasis regex dan bisa ditembus
     (`<script src=x>` tanpa penutup, `<svg/onload=…>`, `java&#9;script:`).
     Sekarang diperkuat sebagai lapis pertama, tetapi keamanannya bertumpu
     pada pembersih DOM di atas.

---

## 4. SQL injection — ✅ aman, sudah diverifikasi

Seluruh query memakai **Drizzle ORM dengan parameter terikat**. Penelusuran
menyeluruh atas `sql.raw`, `execute(\`…\`)`, dan perangkaian string ke query
**tidak menemukan satu pun** kejadian. Template `sql\`…\`` yang dipakai
menyisipkan nilai sebagai parameter, bukan sebagai teks query.

---

## 5. Kontrol akses (RBAC) — ✅ diperketat

- Setiap route API memanggil `getCurrentProfile()` dan memeriksa peran
  **di server**, bukan sekadar menyembunyikan tombol di layar.
- **Aksi di luar alur dikunci untuk Super Admin** (permintaan Anda):
  - menunjuk dosen di luar tiga usulan mahasiswa → `403` bagi Prodi;
  - mengganti pembimbing yang sudah final → `403` bagi Prodi;
  - menghapus pengajuan judul dan menghapus data database dokumen.
  Ketiganya ditegakkan di `src/app/api/title-proposals/[code]/route.ts`,
  jadi tetap berlaku walaupun seseorang memanggil API secara langsung.
- **Bukti keuangan** hanya dapat dibuka Admin Prodi/Admin/Super Admin dan
  dosen yang sedang ditugaskan pada pengajuan itu, lewat *signed URL*
  berumur 60 detik.
- **Endpoint pelacakan publik** tidak mengembalikan alamat, kontak, tautan
  berkas, maupun catatan internal.
- **Notifikasi** disaring ulang per audiens saat ditandai sudah dibaca,
  sehingga id milik orang lain tidak bisa ditebak lalu ditandai.

Hasil pengujian tanpa login: `/api/documents`, `/api/title-proposals`,
`/api/notifications` semuanya menjawab **401**.

---

## 6. Rate limiting & proteksi bot — ⚠️ separuh di kode, separuh di panel

Berkas: `src/lib/rate-limit.ts`

| Endpoint | Batas |
| --- | --- |
| `POST /api/title-proposals` | 5 / 10 menit |
| `POST /api/requests` | 8 / 10 menit |
| `POST /api/revisions` | 8 / 10 menit |
| `POST /api/status` | 30 / 5 menit |
| `GET /api/title-proposals/track` | 30 / 5 menit |

Terbukti bekerja: permintaan ke-31 pada endpoint pelacakan menjawab **429**
beserta header `Retry-After`.

Proteksi bot tambahan: **honeypot** pada form publik, dan satu NIM hanya
boleh punya satu pengajuan judul yang berjalan.

> **Batasnya, jujur saja:** penghitung ini ada di memori tiap instance
> serverless. Vercel bisa menjalankan banyak instance sekaligus dan mendaur
> ulangnya kapan saja, jadi angkanya **best effort** — bagus untuk meredam
> banjir dari satu sumber, bukan jaminan keras. Untuk jaminan sungguhan,
> lihat bagian 9.

Endpoint cron `/api/cleanup` juga diperketat: kunci **hanya** diterima lewat
header `Authorization`, cara lama `?key=…` **dihapus** (kunci pada URL ikut
tercatat di log akses dan header `Referer`), dan pembandingannya memakai
perbandingan waktu-tetap agar tidak bisa ditebak karakter demi karakter.

---

## 7. Validasi input & keamanan unggahan — ✅ selesai

- NIM, nama, IPK, judul, alamat, dan pernyataan divalidasi **di server**
  dengan pola dan batas panjang.
- **Konsentrasi divalidasi ketat** terhadap daftar resmi tiap prodi. Prodi
  tanpa konsentrasi selalu memakai nilai baku, apa pun yang dikirim klien.
- Jenis tugas akhir, jenis dokumen, dan status wajib berasal dari daftar
  tertutup.
- Tautan Drive wajib cocok `https://drive.google.com/…` atau
  `https://docs.google.com/…` — menutup `javascript:` dan `data:`.
- **Unggahan diperiksa isinya (*magic bytes*), bukan hanya ekstensinya**:
  PDF (`%PDF`), DOCX (`PK`), JPG (`FF D8 FF`), PNG. Berkas yang sekadar
  berganti nama ekstensi ditolak.
- Bucket Supabase Storage bersifat **privat**, dibatasi 10 MB dan hanya
  menerima daftar MIME tertentu.

---

## 8. Rahasia (secrets) — ✅ aman, sudah diverifikasi

- Penelusuran seluruh riwayat Git: **tidak ada** `.env` yang pernah
  ter-commit dan **tidak ada** kunci Supabase tertulis di kode. Berkas
  dokumentasi hanya memuat placeholder.
- `.gitignore` ditambahkan (sebelumnya repositori **tidak punya sama
  sekali**) sehingga `.env`, `node_modules/`, dan `.next/` tidak bisa ikut
  ter-commit tanpa sengaja.
- `SUPABASE_SECRET_KEY` hanya dipakai di kode sisi server; yang terkirim ke
  peramban hanyalah kunci publik (`NEXT_PUBLIC_*`).

---

## 9. Yang HARUS Anda aktifkan sendiri (tidak bisa dari kode)

Bagian ini tidak dapat diselesaikan lewat repositori — semuanya ada di panel
penyedia layanan.

### Vercel → Settings → Security
- [ ] **WAF / Firewall** — aktifkan, lalu buat aturan rate limit di tepi
      jaringan. Ini pengganti sejati untuk keterbatasan di bagian 6.
- [ ] **Attack Challenge Mode** — nyalakan saat terjadi lonjakan trafik aneh.
- [ ] **Deployment Protection** — kunci URL Preview agar tidak terindeks
      publik (preview memakai database yang sama dengan produksi).

### Cloudflare (opsional, di depan Vercel)
- [ ] **DDoS protection** dan **Bot Fight Mode**.
- [ ] SSL/TLS mode **Full (strict)**.
- [ ] Selalu gunakan HTTPS + minimum TLS 1.2.

> SSL/TLS & HTTPS sendiri **sudah otomatis** dari Vercel (sertifikat
> diterbitkan dan diperpanjang sendiri), dan HSTS sudah dipaksa dari kode.

### Supabase → Authentication
- [ ] **MFA / 2FA** untuk seluruh akun admin — terutama Super Admin.
- [ ] Kebijakan kata sandi: minimum 12 karakter, aktifkan pemeriksaan
      kebocoran (*leaked password protection*).
- [ ] Perpendek masa berlaku JWT bila dirasa perlu.
- [ ] Batasi **Site URL** dan **Redirect URLs** hanya ke domain resmi.

### Supabase → Database
- [ ] **Point-in-Time Recovery (PITR)** untuk cadangan (*backup*) — ini
      berbayar, tetapi cadangan harian bawaan sudah aktif. Uji pemulihannya
      sekali agar yakin.
- [ ] RLS sudah aktif untuk seluruh tabel (dijalankan oleh berkas SQL v4).
      Server mengakses lewat kunci rahasia, jadi kunci publik tidak dapat
      membaca apa pun.
- [ ] Enkripsi: data **saat transit** (TLS) dan **saat disimpan** (at rest)
      sudah ditangani Supabase secara bawaan.

### Rotasi kunci
- [ ] Putar `SUPABASE_SECRET_KEY`, `DATABASE_URL`, dan `CRON_SECRET` secara
      berkala, serta **segera** bila ada admin yang keluar.

### Pemantauan (logging & monitoring)
- [ ] Vercel **Log Drains** atau Supabase **Logs** → sambungkan ke alat
      pemantauan agar lonjakan 4xx/5xx terlihat.
- [ ] Nyalakan peringatan untuk lonjakan **429** (indikasi serangan) dan
      **500** (indikasi kerusakan).

---

## 10. Ringkasan status

| Bidang | Status |
| --- | --- |
| Security headers | ✅ kode |
| CSP | ✅ kode (`'unsafe-inline'` pada script, dijelaskan di bagian 1) |
| HTTPS / SSL / TLS | ✅ otomatis Vercel + HSTS dari kode |
| CSRF | ✅ kode |
| XSS | ✅ kode |
| SQL injection | ✅ aman, terverifikasi |
| Validasi & sanitasi input | ✅ kode |
| Kontrol akses / RBAC | ✅ kode, diperketat |
| Manajemen sesi | ✅ kode (SameSite + Secure) |
| Cookie aman | ✅ kode (`httpOnly` tidak dapat dipakai, lihat bagian 2) |
| Keamanan API | ✅ kode |
| Keamanan unggahan | ✅ kode |
| Rate limiting | ⚠️ kode (best effort) → butuh WAF |
| Proteksi bot | ⚠️ honeypot → butuh Bot Fight Mode |
| Keamanan database | ✅ RLS aktif; PITR opsional di panel |
| Enkripsi | ✅ bawaan Supabase |
| Manajemen rahasia | ✅ bersih + `.gitignore` |
| WAF / DDoS | ❌ **harus diaktifkan di panel** |
| MFA | ❌ **harus diaktifkan di Supabase Auth** |
| Cadangan (backup) | ⚠️ harian bawaan; PITR opsional |
| Logging & monitoring | ❌ **harus disambungkan sendiri** |
| nginx / PHP / firewall / port / cronjob OS / raw.github | ➖ **tidak berlaku** — lihat bagian 0 |
