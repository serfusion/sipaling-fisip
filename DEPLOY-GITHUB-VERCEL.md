# Deploy Ulang dari Nol: GitHub Baru + Vercel

Ikuti urut dari atas. Estimasi 20–30 menit.

---

## BAGIAN 1 — Siapkan Supabase (jangan dilewati)

Database lama boleh dipakai lagi. Yang penting semua SQL sudah dijalankan.

**1.1** Buka Supabase → project kamu → menu **SQL Editor** → **New query**.

**1.2** Jalankan file berikut **satu per satu, urut** (copy seluruh isi file → Run).
Semua aman dijalankan berulang meski sudah pernah:

1. `supabase-setup.sql`
2. `supabase-update-v2.sql`
3. `supabase-storage-migration.sql`
4. `supabase-add-admin-roles.sql`
5. `supabase-login-fix.sql`

Hasil yang benar: *"Success. No rows returned"*.

**1.3** Buka menu **Storage**. Pastikan ada bucket bernama **`service-documents`**.
Kalau belum ada: **New bucket** → nama `service-documents` → **Private** (jangan public) → Create.

**1.4** Ambil 4 nilai ini, simpan di Notes dulu:

| Nama | Ambil dari |
|---|---|
| `DATABASE_URL` | Tombol **Connect** (atas) → tab **Transaction pooler** → salin URI. Host-nya `...pooler.supabase.com`, port **6543**. Ganti `[YOUR-PASSWORD]` dengan password database asli. |
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Settings → API keys → publishable / anon key |
| `SUPABASE_SECRET_KEY` | Settings → API keys → secret / service_role key (**RAHASIA**) |

⚠️ **Paling sering salah:** memakai *Direct connection* `db.xxx.supabase.co:5432`.
Itu TIDAK jalan di Vercel. Wajib **Transaction pooler port 6543**.

Lupa password database? Settings → Database → **Reset database password**.

---

## BAGIAN 2 — Buat Repo GitHub Baru

**2.1** Buka https://github.com/new

**2.2** Isi:
- Repository name: `sipaling-fisip`
- Visibility: **Private**
- **JANGAN** centang "Add a README", .gitignore, atau license (biarkan kosong semua)
- Klik **Create repository**

**2.3** Upload file. Cara paling gampang tanpa install apa-apa:

1. Di halaman repo baru, klik **uploading an existing file**
2. Buka zip ini di komputer, **extract** dulu
3. Masuk ke folder hasil extract, **blok semua isinya** (folder `src`, `public`, file
   `package.json`, dll) — bukan folder pembungkusnya
4. Drag-and-drop semuanya ke jendela GitHub
5. Tunggu sampai semua ter-upload, lalu **Commit changes**

✅ Pastikan di halaman repo terlihat folder `src`, `public`, dan file `package.json`
langsung di halaman utama (bukan di dalam satu folder lagi).

❌ Pastikan **tidak ada** folder `node_modules` atau `.next` ter-upload. Kalau ada,
hapus dulu di komputer sebelum upload.

---

## BAGIAN 3 — Deploy ke Vercel

**3.1** Buka https://vercel.com → **Sign up / Log in with GitHub**.

**3.2** Klik **Add New…** → **Project**.

**3.3** Cari repo `sipaling-fisip` → klik **Import**.
(Kalau repo tidak muncul: klik **Adjust GitHub App Permissions** → beri akses ke repo itu.)

**3.4** Di halaman konfigurasi, **jangan ubah apa pun** di bagian Build:
Framework Preset akan otomatis terdeteksi **Next.js**. Biarkan.

**3.5** Buka bagian **Environment Variables** → masukkan **4 variabel** dari Bagian 1.4.
Tambahkan satu per satu (Key → Value → Add):

```
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

Pastikan ketiga environment (Production, Preview, Development) tercentang untuk
masing-masing variabel.

⚠️ Saat menempel nilai, **jangan ada spasi atau enter di ujung**.

**3.6** Klik **Deploy**. Tunggu 1–3 menit sampai muncul layar ucapan selamat.

---

## BAGIAN 4 — Verifikasi (WAJIB sebelum lanjut)

**4.1** Vercel memberi alamat sementara, misal `sipaling-fisip.vercel.app`.
Buka: **`https://sipaling-fisip.vercel.app/api/health`**

Kamu akan lihat JSON. Yang benar seperti ini:

```json
{
  "ok": true,
  "env": { "DATABASE_URL": true, "NEXT_PUBLIC_SUPABASE_URL": true,
           "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": true, "SUPABASE_SECRET_KEY": true },
  "database": { "ok": true, ... },
  "tables":   { "ok": true, ... },
  "storage":  { "ok": true, ... }
}
```

**Kalau ada yang `false`, baca teks `detail` di sebelahnya — di situ tertulis persis
apa yang harus dibetulkan.** Panduan cepat:

| Yang muncul | Artinya | Solusi |
|---|---|---|
| `env` ada yang `false` | Variabel belum masuk/salah nama | Vercel → Settings → Environment Variables → perbaiki → **Redeploy** |
| `database.ok: false`, pesan soal pooler | Pakai Direct connection | Ganti `DATABASE_URL` ke Transaction pooler port 6543 |
| `database.ok: false`, pesan soal password | Password salah | Reset password di Supabase, perbarui variabel |
| `tables.ok: false` | SQL belum dijalankan | Ulangi Bagian 1.2 |
| `storage.ok: false` | Bucket belum ada | Ulangi Bagian 1.3 |

Setiap kali mengubah environment variable di Vercel, wajib **Deployments → titik tiga
pada deploy terakhir → Redeploy** supaya perubahannya terpakai.

**4.2** Setelah `ok: true` semua, tes langsung: buka halaman utama → isi **Form Layanan**
→ kirim. Harus muncul nomor tiket. Lalu tes **Cek Status** dengan tiket itu.

**4.3** Tes login: buka `/dashboard` → login pakai akun admin di Supabase.
(Cara bikin akun baru ada di `CARA-TAMBAH-AKUN-ADMIN.md`.)

---

## BAGIAN 5 — Pasang Domain sipalingfisip.web.id

Lakukan **setelah** Bagian 4 hijau semua.

**5.1** Di Vercel: **Settings** → **Domains** → ketik `sipalingfisip.web.id` → **Add**.

**5.2** Vercel akan menampilkan record DNS yang harus dipasang. Biasanya:

- Untuk domain utama (`sipalingfisip.web.id`):
  record **A** → nilai **`76.76.21.21`**
- Untuk `www.sipalingfisip.web.id`:
  record **CNAME** → nilai **`cname.vercel-dns.com`**

**Pakai persis nilai yang ditampilkan Vercel di layarmu**, karena bisa berbeda.

**5.3** Login ke tempat kamu beli domain (Niagahoster/Rumahweb/dll) → menu **DNS
Management** → **hapus dulu record A/CNAME lama yang mengarah ke Netlify** → tambahkan
record dari langkah 5.2.

**5.4** Tunggu propagasi (5 menit sampai 1 jam). Di Vercel, status domain akan berubah
jadi **Valid Configuration** dengan centang hijau, dan HTTPS otomatis aktif.

**5.5** Cek terakhir: buka `https://sipalingfisip.web.id/api/health` → harus `ok: true`.

**5.6** Kalau proyek lama masih ada di Netlify, **hapus/unpublish site-nya** supaya
tidak bentrok dan tidak bikin bingung nanti.

---

## Kalau nanti mau update kode

Cukup edit file di GitHub (atau upload ulang) → commit. Vercel otomatis build ulang
dan menerbitkan versi baru. Cek statusnya di tab **Deployments** — harus **Ready**,
bukan **Error**.

---

## Ringkasan checklist

- [ ] 5 file SQL dijalankan di Supabase
- [ ] Bucket `service-documents` ada dan Private
- [ ] Repo GitHub baru, isi di root (bukan nested), tanpa `node_modules`
- [ ] Import ke Vercel, framework terdeteksi Next.js
- [ ] 4 environment variables terisi, semua environment tercentang
- [ ] `/api/health` → `ok: true` semuanya
- [ ] Form Layanan berhasil menghasilkan nomor tiket
- [ ] Login dashboard berhasil
- [ ] Domain dipindah ke Vercel, status Valid Configuration
- [ ] Site lama di Netlify dimatikan
