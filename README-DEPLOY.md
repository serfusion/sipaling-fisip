# 🚀 CARA DEPLOY SIPALING FISIP KE GITHUB + NETLIFY

## ✅ Yang Sudah Disiapkan

Saya sudah menambahkan file-file penting berikut ke project:

- ✅ `netlify.toml` — Setting build Netlify
- ✅ `.gitignore` — File yang tidak perlu di-push
- ✅ `DEPLOY-READY.md` — Panduan lengkap
- ✅ Semua kode sudah rapi dan siap produksi

---

## 📥 LANGKAH 1: Download & Push ke GitHub

### Cara Paling Mudah:

1. **Download ZIP** dari GitHub (bukan dari sandbox!)
   - Nanti setelah Anda push, bisa download dari situ

2. **Atau pakai cara ini (RECOMMENDED):**

Buka **Command Prompt / Terminal** di folder project, lalu copy-paste perintah ini:

```bash
# Masuk ke folder
cd sipalingfisip

# Install dependency
npm install

# Commit & push
git add .
git commit -m "deploy: production ready"
git push
```

---

## 🌐 LANGKAH 2: Hubungkan ke Netlify

### 2.1 Import Project

1. Buka: **https://app.netlify.com**
2. Login
3. Klik **Add new site** → **Import an existing project**
4. Pilih **GitHub**
5. Pilih repository `sipalingfisip`

### 2.2 Tambahkan Environment Variables

**INI PALING PENTING!**

Pergi ke:
**Site configuration → Environment variables → Add a variable**

Tambahkan **4 variabel** ini:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@db.wbhsgnidqxqtnruicuuh.supabase.co:5432/postgres?pgbouncer=true` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wbhsgnidqxqtnruicuuh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |
| `SUPABASE_SERVICE_ROLE_KEY` | `<AMBIL_DARI_SUPABASE_DASHBOARD>` |

> Ganti `[PASSWORD]` dengan password database Supabase Anda

### 2.3 Deploy

1. Klik **Deploy site**
2. Tunggu sampai **Published** (hijau)

---

## ✅ SELESAI!

Situs Anda akan otomatis tersedia di:
- `https://sipalingfisip.web.id` (jika domain sudah diarahkan)
- Atau preview URL dari Netlify

---

## 🆘 Jika Masih Error

Screenshot error log di Netlify dan kirim ke saya.

---

**File-file yang sudah saya tambahkan:**

1. `netlify.toml` ✅
2. `.gitignore` ✅
3. `DEPLOY-READY.md` ✅
4. `README-DEPLOY.md` ✅ (file ini)

Semua sudah siap. Tinggal push ke GitHub!