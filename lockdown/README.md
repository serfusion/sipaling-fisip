# Aplikasi Ujian Terkunci

Dua aplikasi kecil yang menjalankan halaman ujian CBT di dalam jendela yang
**sistem operasinya sendiri menolak untuk ditangkap layar**.

Keduanya tidak memuat satu pun logika ujian. Tidak ada soal, tidak ada
penilaian, tidak ada jam mundur di sini — semuanya tetap di situs CBT yang
sama. Yang ditambahkan aplikasi ini hanya *lingkungan* tempat halaman itu
dijalankan.

---

## Kenapa aplikasi, bukan JavaScript

Satu kalimat, dan seluruh direktori ini berdiri di atasnya:

> **Peramban tidak dapat melarang tangkapan layar. Sistem operasi dapat.**

Tidak ada satu pun API web yang menahan Print Screen, alat potong bawaan,
perekam layar, apalagi tombol Volume + Power di ponsel. Yang dapat dikerjakan
halaman web hanya tiga — menyulitkan, mencatat, dan menandai — dan ketiganya
sudah dikerjakan `src/lib/kunci-layar.ts` beserta `src/app/cbt/ujian/penjaga.ts`
di situsnya.

Yang **benar-benar menolak** ada di lapisan aplikasi, dan sistem operasinya
sudah menyediakannya:

| Perangkat | Panggilan | Akibatnya |
|---|---|---|
| Android | `FLAG_SECURE` | Sistem menolak tangkapan layar dan perekaman layar, lalu menampilkan pesannya sendiri: *"Tidak dapat mengambil tangkapan layar karena kebijakan keamanan."* |
| Windows | `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` | Jendela ujian menjadi **hitam** pada setiap tangkapan layar dan setiap perekaman — Print Screen, Snipping Tool, Win+Shift+S, Xbox Game Bar, OBS, Zoom share, Teams share. |

---

## Yang TIDAK dapat dijanjikan

Ini bagian yang paling penting dibaca, dan sengaja diletakkan sebelum petunjuk
membangunnya.

- **Ponsel kedua yang diarahkan ke monitor.** Tidak ada, dan tidak akan pernah
  ada, perangkat lunak yang menghalanginya. Yang menjawabnya adalah pengawas
  ruangan, bukan kode.
- **iOS.** Apple tidak menyediakan padanan `FLAG_SECURE` bagi aplikasi biasa.
  Yang mungkin di sana hanya *mendeteksi* tangkapan layar sesudah terjadi. Karena
  itu tidak ada `lockdown/ios/` di sini: aplikasi yang dijanjikan mengunci layar
  tetapi tidak mengunci apa pun lebih buruk daripada tidak ada aplikasinya.
- **Perangkat yang sudah di-root atau di-jailbreak**, tempat pemiliknya dapat
  mematikan apa pun.
- **Mesin virtual dan perangkat penangkap gambar HDMI**, yang berada di luar
  jangkauan panggilan Windows di atas.
- **Windows lebih tua dari versi 2004 (build 19041).** `WDA_EXCLUDEFROMCAPTURE`
  belum ada di sana; aplikasinya jatuh ke `WDA_MONITOR` yang lebih kasar, dan
  bila itu pun gagal, ujiannya tetap berjalan tanpa penguncian. Kegagalannya
  dicatat, tidak disembunyikan.

Karena itu jangan pernah menulis *"100% tidak bisa screenshot"* di layar mana
pun. Yang benar, dan itu pun sudah kuat:

> Ujian berjalan dalam lingkungan terkunci yang menolak tangkapan layar,
> perekaman layar, perpindahan aplikasi, dan navigasi ke luar.

---

## Bagaimana situs mengenali aplikasinya

Dua jalan, dan keduanya ada karena masing-masing gagal pada keadaan yang
berbeda.

1. **Penanda pada User-Agent** — ikut pada *setiap* permintaan, termasuk yang
   pertama, sebelum satu baris skrip pun berjalan. Inilah yang dibaca server
   pada gerbang ujian yang mewajibkan aplikasi.

   ```
   Mozilla/5.0 (…) SiPalingCBT/1.0.0 (android; kunci-layar)
   Mozilla/5.0 (…) SiPalingCBT/1.0.0 (windows; kunci-layar)
   ```

   Susunannya **harus tetap**. Mengubahnya berarti situsnya berhenti mengenali
   aplikasi ini, dan ujian yang mewajibkan aplikasi akan menolak seluruh
   pesertanya.

2. **Objek jembatan** yang disuntikkan aplikasi ke halaman:

   ```js
   window.SipalingLockdown = { jenis: "android", versi: "1.0.0", kunciLayar: true, kunci: "" }
   ```

   Isinya sengaja hanya keterangan. Tidak ada satu pun fungsi yang dapat
   menjalankan sesuatu di sisi aslinya — halaman web tidak boleh dapat
   memanggil kemampuan sistem sesuka hati.

Pembacaannya ada di `src/lib/kunci-layar.ts` (`bacaKlien`), dan diuji
`uji-kunci-layar.ts`.

### Tentang kunci bersama

Server dapat menuntut kunci bersama lewat environment `CBT_KUNCI_APLIKASI`,
yang dibandingkan dengan `kunci` pada objek jembatan.

Katakan terus terang seberapa kuat ini: kuncinya ikut tertanam di dalam berkas
aplikasinya, jadi siapa pun yang membongkar `.apk` atau `.exe`-nya dapat
menemukannya lalu mengaku sebagai aplikasi terkunci dari peramban biasa. Yang
dikerjakannya tetap nyata — ia mengubah *"ketik satu baris di alat pengembang"*
menjadi *"bongkar aplikasinya lebih dulu"* — tetapi ia bukan kunci
sesungguhnya. Kosongkan bila belum disiapkan; gerbangnya lalu bersandar pada
pengenalan perangkat saja.

---

## Membangun — Android

```bash
cd lockdown/android

# 1. Isi alamat situs ujian Anda.
#    Ini bukan sekadar halaman pembuka: navigasi ke tuan rumah mana pun selain
#    ini DITOLAK aplikasinya.
$EDITOR gradle.properties     # sipaling.alamatUjian=https://cbt.kampus.ac.id/ujian

# 2. Bangun.
./gradlew assembleRelease

# hasilnya: app/build/outputs/apk/release/app-release.apk
```

Sebelum dibagikan ke peserta, **tandatangani dengan kunci lembaga Anda**, bukan
kunci debug. Berkas yang ditandatangani kunci debug ditolak sebagian perangkat
dan tidak dapat diperbarui di atas pemasangan sebelumnya — dan pembaruan itulah
yang membuat versi lama yang bermasalah dapat ditarik.

Bagikan `.apk`-nya lewat tautan resmi kampus. Kode QR untuk tautan unduhannya
dapat dibuat dengan cara yang sama seperti kode QR ujian di panel dosen.

## Membangun — Windows

Menuntut Windows, Rust, dan
[prasyarat Tauri](https://tauri.app/start/prerequisites/) (Visual Studio Build
Tools + WebView2 Runtime).

```powershell
cd lockdown\windows\src-tauri

# Alamat situs ujian ditanam saat membangun.
$env:ALAMAT_UJIAN = "https://cbt.kampus.ac.id/ujian"

cargo install tauri-cli --version "^2"
cargo tauri build

# hasilnya: target\release\bundle\nsis\*.exe
```

Tandatangani pemasangnya secara digital bila memungkinkan. Tanpa tanda tangan,
SmartScreen akan memperingatkan setiap peserta yang mengunduhnya, dan
peringatan itu muncul persis pada pagi hari ujian.

> Versi `tauri` dan `windows` di `Cargo.toml` mungkin perlu disesuaikan dengan
> yang terbaru saat Anda membangunnya. Pemanggilan `SetWindowDisplayAffinity`
> di `src/main.rs` sengaja melewati pointer mentah, jadi ia tetap bekerja walau
> versi crate `windows` yang dipakai Tauri berbeda dari yang dipakai di sini.

---

## Menyalakannya di sisi ujian

1. Jalankan `supabase-update-v30-kunci-layar.sql` sekali di SQL Editor Supabase.
2. Buka ujiannya di dashboard → **Pengaturan** → centang
   **"Wajib lewat Aplikasi Ujian Terkunci"**.
3. Bagikan tautan unduhan aplikasinya ke kelas **sehari sebelumnya**, bukan pagi
   hari ujian.

Sesudah itu, peserta yang membuka ujian dari peramban biasa ditolak di pintu
masuk beserta kalimat yang menyebutkan apa yang harus ia unduh — bukan ditolak
di tengah ujian, dan bukan dibiarkan mengerjakan tanpa penjagaan.

Papan pantau dosen menandai tiap peserta dengan perangkat yang benar-benar
dipakainya, jadi baris yang menyimpang terlihat tanpa perlu dicari.
