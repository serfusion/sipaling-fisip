# 🚀 DEPLOY-READY - SiPaling FISIP

File ini berisi **semua yang Anda butuhkan** untuk deploy langsung ke GitHub + Netlify.

---

## 📦 LANGKAH 1: Persiapan di Komputer Anda

### 1.1 Pastikan Anda Punya Folder Project

Pastikan folder project `sipalingfisip` sudah ada di komputer Anda dengan struktur seperti ini:

```
sipalingfisip/
├── src/
├── public/
├── package.json
├── package-lock.json   ← HARUS ADA
├── netlify.toml        ← BARU DITAMBAHKAN
├── .env
└── ...
```

### 1.2 Jalankan Perintah Ini di Terminal / Command Prompt

Buka **Command Prompt** atau **Terminal**, lalu jalankan perintah berikut **satu per satu**:

```bash
# Masuk ke folder project
cd sipalingfisip

# Install ulang dependency (penting!)
npm install

# Commit semua perubahan
git add .
git commit -m "deploy: ready for production"

# Push ke GitHub
git push
```

---

## 🔧 LANGKAH 2: Setting di Netlify

### 2.1 Import Repository

1. Buka **https://app.netlify.com**
2. Klik **Add new site** → **Import an existing project**
3. Pilih **GitHub**
4. Pilih repository `sipalingfisip`

### 2.2 Build Settings (Otomatis Terdeteksi)

Netlify akan otomatis mendeteksi:

| Field | Value |
|-------|-------|
| Build command | `npm run build` |
| Publish directory | `.next` |

### 2.3 Tambahkan Environment Variables

**WAJIB** — Tanpa ini deploy akan gagal.

Pergi ke **Site configuration → Environment variables**, tambahkan:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@db.wbhsgnidqxqtnruicuuh.supabase.co:5432/postgres?pgbouncer=true` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wbhsgnidqxqtnruicuuh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |
| `SUPABASE_SERVICE_ROLE_KEY` | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |

> Ganti `[PASSWORD]` dengan password database Supabase Anda.

### 2.4 Deploy

1. Klik **Deploy site**
2. Tunggu sampai selesai
3. Status harus **Published** (hijau)

---

## ✅ LANGKAH 3: Verifikasi

Setelah deploy berhasil:

1. Buka `https://sipalingfisip.web.id`
2. Halaman utama harus muncul
3. Coba klik **Login** → harus masuk ke halaman login
4. Login dengan akun Super Admin yang sudah dibuat di Supabase

---

## 🔄 Jika Masih Error

Jika masih gagal, cek:

1. Apakah `package-lock.json` ada di GitHub?
2. Apakah 4 Environment Variables sudah ditambahkan?
3. Apakah `netlify.toml` ada di root repository?

Jika masih bermasalah, screenshot error log dan kirim ke saya.

---

## 📝 Catatan Penting

- **JANGAN** download ZIP dari sandbox lagi
- **JANGAN** hapus `package-lock.json`
- **WAJIB** isi 4 Environment Variables di Netlify
- Setelah push, selalu jalankan `npm install` dulu sebelum commit

---

**Sekarang tinggal jalankan perintah di LANGKAH 1.2, lalu ikuti LANGKAH 2.**

Jika ada yang tidak jelas, tanya saja!