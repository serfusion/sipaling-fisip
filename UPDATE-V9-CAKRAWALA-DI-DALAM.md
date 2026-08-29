# UPDATE v9 — Isi Cakrawala menyusul wajah layar kuncinya

Tidak ada SQL yang perlu dijalankan, tidak ada variabel environment baru.
Seluruh perubahan ada di tampilan.

---

## Masalahnya

Layar kunci Cakrawala gelap, bercahaya, dan bergerak. Begitu kode akses
dimasukkan, yang muncul adalah halaman terang dan datar dengan kepala navy
biasa. Satu klik terasa seperti berpindah ke situs lain, dan bagian yang
justru paling lama dipakai mahasiswa terasa paling biasa.

## Yang berubah

### 1. Palet yang sama dengan layar kunci

Ruang kerja Cakrawala kini bawaannya **Mode Malam**: latar `#070d1c`, kartu
bercahaya, aksen biru-emas — persis palet halaman kuncinya. Perpindahan dari
layar kunci ke dalam menu tidak lagi terasa terputus.

**Mode Terang tetap ada.** Sakelarnya di kanan atas kepala halaman. Pilihannya
diingat di perangkat itu (30 hari lebih, sampai penyimpanan peramban
dibersihkan) dan dipasang sebelum halaman digambar, jadi tidak ada kedipan
gelap bagi yang memilih mode terang.

Seluruh warna ruang kerja sekarang ditulis sebagai token pada `.al`. Mode
terang memakai token yang sama dengan nilai berbeda, jadi tidak ada satu pun
aturan tampilan yang ditulis dua kali — dan alat baru otomatis ikut kedua
modenya tanpa penyesuaian.

### 2. Kepala halaman

- Latar bercahaya yang sama dengan layar kunci (dua sorot warna + gradasi).
- Judul **Cakrawala** memakai gradasi putih → biru → emas, sama seperti di
  layar kunci.
- Lencana **AKSES TERBUKA** menggantikan judul kecil lama — kebalikan dari
  "AKSES TERBATAS" pada layar kunci, lengkap dengan gembok yang kaitnya
  terangkat sekali saat halaman dibuka.
- Animasi **buku terbang** yang sama dengan layar kunci.
- Kaki halaman ditambahkan, senada dengan kaki layar kunci.

### 3. Daftar alat

- Tiap alat kini punya ikon berbingkai, bukan ikon telanjang.
- Alat yang sedang dibuka ditandai bilah emas di tepi kiri.
- Di ponsel, baris alat **menempel di tepi atas layar** saat digulir, dan alat
  yang dipilih dari tempat lain (ubin "Lanjutkan ke") digulir sendiri ke
  tengah supaya terlihat mana yang sedang terbuka.
- Menekan alat di ponsel menggulung halaman ke ruang kerjanya; sebelumnya
  isinya berganti jauh di bawah layar tanpa tanda apa pun.

### 4. Gerak

Enam gerak, semuanya pendek dan sekali jalan:

| Gerak | Kapan |
| --- | --- |
| Cahaya menyapu kepala halaman | sekali, saat halaman dibuka |
| Kait gembok terangkat | sekali, saat halaman dibuka |
| Isi kepala halaman naik berurutan | sekali, saat halaman dibuka |
| Panel naik, kartunya menyusul | tiap berpindah alat |
| Angka ringkas naik berurutan | tiap hasil selesai dihitung |
| Bilah isian tumbuh dari nol | tiap hasil selesai dihitung |

Ditambah umpan balik kecil: kartu pilihan dan baris bab terangkat saat
disentuh, tombol utama bergradasi dan menekan balik saat diklik, cincin fokus
diseragamkan di seluruh alat.

**Semua gerak mati** bila perangkat pengguna mematikan animasi
(`prefers-reduced-motion`). Tidak ada satu pun keterangan yang hilang saat
dimatikan — gerak di sini hanya menerangkan perpindahan, tidak membawa isi.

---

## Berkas yang disentuh

- `src/app/globals.css` — token warna `.al` dijadikan dua set (malam/terang),
  seluruh warna yang sebelumnya ditulis langsung diganti token, lalu satu
  bagian baru "Cakrawala v9" ditambahkan di bawahnya.
- `src/app/alat/alat-app.tsx` — kepala halaman, sakelar mode, daftar alat
  berikon, pembungkus panel, kaki halaman.
- `src/app/alat/page.tsx` — skrip kecil pemasang mode baca sebelum halaman
  digambar.
- `src/app/layout.tsx` — `suppressHydrationWarning` pada `<html>`, karena
  atribut mode baca dipasang sebelum React menghidrasi halaman.

Halaman kunci (`pratinjau.tsx`) **tidak disentuh sama sekali**.

## Yang tidak berubah

- Cara kerja setiap alat, seluruh perhitungan, dan seluruh sumber datanya.
- Gerbang kunci Cakrawala di sisi server dan kode aksesnya.
- Laporan cetak: tetap hitam-putih di atas kertas, tidak terpengaruh mode
  malam.
- Halaman lain di portal.
