# CARA MEMASANG PAKET v2 — SiPaling FISIP

Paket ini berisi SELURUH project (bukan hanya file yang berubah), jadi cara
pasangnya cukup timpa. Ikuti urutan di bawah — sama dengan Langkah 7 pada
dokumen "Tutorial-Deploy-SiPaling-FISIP-ke-Vercel.docx".

## Isi pembaruan v2 (ringkas)

- Portal Mahasiswa v2: kolom "Lacak" tiket di hero, timeline status visual,
  tombol Salin nomor tiket, chip nama file terpilih, pengumuman default
  "Belum ada pengumuman", footer baru.
- Dashboard Admin v2: sidebar menu per-role dengan warna unit, sapaan
  "Halo, {nama}", kutipan motivasi harian, antrean + drawer detail, halaman
  Template / Arsip Drive / Absensi Perpustakaan / Pengumuman / Akun.
- 6 admin unit lengkap — role BARU `admin_prodi` untuk Layanan Prodi.
- Modul Template Dokumen: Transkrip Nilai (impor Excel format akademik:
  dua blok kolom, multi-sheet, biodata otomatis; cetak Legal/F4) dan Surat
  Keterangan Aktif Kuliah (cetak A4), plus tautan folder Drive Admin Umum.
- Arsip dokumen berbasis Google Drive (tabel `generated_documents`).
- Perbaikan teknis & keamanan: status layanan pindah ke database
  (`app_settings`), absensi perpustakaan benar-benar tercatat, GET absensi
  publik tidak lagi membocorkan nama, honeypot + retry nomor tiket pada
  form pengajuan, validasi isi file (magic bytes) sebelum unggah.

## Langkah pemasangan

1. **Backup dulu (opsional tapi disarankan).** Salin folder project lama,
   atau cukup pastikan commit terakhir sudah di-push ke GitHub.

2. **Timpa file.** Ekstrak zip ini, lalu salin seluruh isinya ke folder
   project Anda (replace/timpa semua saat ditanya). File lama yang tidak
   ada di paket tidak akan terhapus.

3. **Update database.** Buka Supabase → SQL Editor → New query → tempel
   seluruh isi file `supabase-update-v2.sql` → Run. Aman dijalankan
   berulang. (Jika Langkah 1 tutorial Word sudah pernah dijalankan,
   file ini tetap perlu dijalankan — isinya tabel & role baru.)

4. **Pasang dependensi baru & uji build di komputer Anda:**

       npm install
       npm run build

   `npm install` diperlukan karena ada pustaka baru (`xlsx`, pembaca
   Excel). **Jika `npm run build` menampilkan error, JANGAN push dulu** —
   kirimkan pesan errornya ke saya untuk diperbaiki.

5. **Kirim ke Vercel:**

       git add .
       git commit -m "feat: SiPaling v2 - portal, dashboard, template"
       git push

   Vercel otomatis build & menerbitkan dalam 1–3 menit.

6. **Setelah live, uji cepat:**
   - Portal: kolom "Lacak" di hero, kirim 1 pengajuan uji → tombol Salin
     tiket muncul → cek status menampilkan timeline.
   - Dashboard: login super admin → menu sidebar lengkap; buka
     Template → Transkrip → impor file Excel akademik → data & biodata
     terisi → Cetak.
   - Buat akun `admin_prodi` (Authentication → Add user, lalu SQL profiles
     seperti Lampiran A2 tutorial dengan role `admin_prodi`) → login →
     hanya antrean Layanan Prodi yang terlihat.

## Catatan penting

- `TUTORIAL-SUPABASE.md` lama berisi perintah `GRANT ALL ... TO anon` —
  itu JANGAN dijalankan lagi (membuka database ke publik). Acuan yang
  benar sekarang: `supabase-update-v2.sql` + tutorial Word.
- Semua pemrosesan impor Excel terjadi di browser admin; file Excel tidak
  diunggah ke server mana pun.
- Hasil cetak (PDF) disimpan di folder Google Drive admin yang aksesnya
  DIBATASI (bukan folder template publik), lalu link-nya dicatat di
  halaman Arsip.
