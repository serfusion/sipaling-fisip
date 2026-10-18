# UPDATE v50 — Kunci per kartu layanan (maintenance per kartu)

Setiap kartu layanan di portal mahasiswa kini dapat dikunci sendiri-sendiri.
Kartu yang dikunci tertutup selapis kaca buram dengan gembok dan lencana
**Maintenance**, dan server menolak pengajuannya. Kuncinya diatur Super Admin
di **Dashboard → Mode Maintenance → Kunci per kartu layanan**.

Selama belum pernah diatur, **semua kartu terkunci kecuali Perpustakaan**,
satu-satunya layanan yang sudah berjalan penuh.

---

## 1. Yang berubah

| Berkas | Perubahan |
| --- | --- |
| `src/lib/maintenance.ts` | Daftar `KARTU_LAYANAN`, kolom `lockedServices`, aturan `layananTertutup` |
| `src/lib/maintenance-gate.ts` | Penjaga baru `blockedByServiceLock` |
| `src/app/api/requests/route.ts` | Pengajuan ke kartu terkunci ditolak (503) |
| `src/app/api/revisions/route.ts` | Upload revisi ikut kunci kartu tiketnya |
| `src/app/api/title-proposals/route.ts` | Pengajuan judul ikut kunci kartu Tugas Akhir |
| `src/app/page.tsx` | Daftar kunci diteruskan ke portal sejak HTML pertama |
| `src/app/sipaling-app.tsx` | Gembok pada kartu, panel pengganti formulir, mode uji Super Admin |
| `src/app/dashboard/dashboard-app.tsx` | Panel "Kunci per kartu layanan" |
| `src/app/globals.css` | Gaya dan animasi gembok |
| `uji-maintenance.ts` | Uji aturan kunci per kartu |

Tidak ada tabel atau environment variable baru. Daftar kunci menumpang di
baris `maintenance_mode` pada `app_settings` yang sudah ada sejak v5.

---

## 2. Yang dilihat mahasiswa

- **Kartu terkunci**: isi kartu memudar di balik kaca, gembok biru malam–emas
  di tengah, nama layanan, dan lencana **Maintenance** dengan roda gigi yang
  berputar pelan. Pita garis emas–biru tipis bergerak di tepi atas.
- **Animasi**: saat halaman terbuka, belenggu gembok jatuh dan "mengunci"
  satu per satu. Sesudahnya gembok bernapas pelan, cincin cahaya memudar,
  dan kilau emas sesekali menyapu kaca. Saat disorot, gembok terangkat
  sedikit; saat diketuk, gembok menggeleng dan muncul kalimat di bawah kisi
  kartu berisi tautan ke layanan yang sudah terbuka.
- **Formulir**: pilihan layanan terkunci tidak bisa dipilih (bertanda
  "maintenance"). Bila tidak ada satu pun layanan yang terbuka, formulirnya
  diganti panel gembok.
- **Pengajuan Judul** ikut kartu **Tugas Akhir**. Selama Tugas Akhir terkunci,
  tabnya menampilkan panel gembok.
- **Upload Revisi** ikut kartu layanan tiketnya. Tombol kirimnya mati dan
  server menolak bila kartunya terkunci.
- **Cek Status** tetap terbuka untuk semua tiket.
- Pengguna yang mematikan animasi di perangkatnya tetap melihat gembok, tetapi
  diam.

## 3. Yang dilihat Super Admin

- Di dashboard: tujuh ubin kartu, masing-masing dengan sakelar (hijau =
  terbuka). Perubahan langsung tersimpan. Ada tombol **Buka semua**,
  **Kunci semua**, dan **Lihat portal →**.
- Di portal: gembok tetap terlihat (sama seperti yang dilihat mahasiswa),
  dengan tulisan "Super Admin · klik untuk uji". Kartunya tetap dapat dibuka
  dan dikirim untuk menguji, dengan bilah pengingat "Mode uji Super Admin".
  Peran lain (admin unit, dosen) tetap tertahan seperti mahasiswa.

---

## 4. Cara memasang

Unggah ke GitHub seperti biasa; Vercel membangun ulang sendiri. Tidak ada SQL
yang wajib dijalankan.

Begitu terpasang, enam kartu langsung terkunci (bawaan). Buka kuncinya dari
dashboard satu per satu ketika layanannya sudah siap.

## 5. Darurat lewat SQL

Membuka **semua** kartu (Supabase → SQL Editor):

```sql
insert into public.app_settings (key, value)
values ('maintenance_mode', '{"lockedServices":[]}')
on conflict (key) do update
  set value = jsonb_set(app_settings.value::jsonb, '{lockedServices}', '[]')::text,
      updated_at = now();
```

Mengunci kembali sesuai bawaan (semua kecuali Perpustakaan): ganti `'[]'` di
`jsonb_set` dengan

```
'["Layanan Tugas Akhir","Layanan PDDIKTI","Layanan Akademik","Layanan Prodi","Layanan Umum","Layanan Laboratorium"]'
```

## 6. Uji

```bash
npx tsx uji-maintenance.ts   # 252 periksa lulus
```

Tabel kebenarannya mencakup ketujuh kartu × semua peran × terkunci/terbuka,
nama lama "Layanan Skripsi / Jurnal", daftar rusak atau asing, dan daftar
kosong (yang berarti semua terbuka, bukan "belum diatur").
