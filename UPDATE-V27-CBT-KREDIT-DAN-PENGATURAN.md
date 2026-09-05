# v27: CBT — kredit di tautan, lama ujian sebelum mulai, tombol yang berkabar, dan pengaturan yang dapat diubah sewaktu-waktu

Tiga permintaan, dan ketiganya soal hal yang sama: **layar yang tidak
mengatakan apa yang sedang terjadi.**

Tidak ada perubahan basis data. Tidak ada berkas SQL baru yang perlu
dijalankan — cukup deploy seperti biasa.

---

## 1. Kredit, dan lama ujian yang terbaca sebelum "Mulai Ujian"

### Kredit di setiap layar CBT

Satu baris yang sama muncul di seluruh situs CBT:

> Computer Based Test (CBT) — SiPaling CBT — Concept Superfal Dev

Ia tercantum di lima tempat: pintu masuk `/cbt`, layar kode ujian, layar
identitas (tempat tombol **MULAI UJIAN** berada), panel samping selama
mengerjakan, dan layar selesai.

Kalimatnya disimpan pada **satu berkas** — `src/app/cbt/kredit.tsx` — dan
kelima layar memanggilnya dari sana. Kalau suatu hari sebutannya berubah, yang
disunting satu baris, dan tidak mungkin ada layar yang tertinggal membawa
tulisan lama.

### Lamanya ujian, dikatakan sebelum jam mundur berjalan

Mahasiswa yang membuka tautan dari grup kelas mendarat di layar identitas.
Angka durasinya sebenarnya sudah ada di sana — satu dari tiga kotak kecil yang
dibaca sekilas — dan justru itu yang paling ditanyakan sebelum menekan tombol.

Sekarang ia dikatakan sekali lagi, dengan jelas, tepat sebelum tombolnya:

> **⏱ Waktu pengerjaan 1 jam 30 menit**
> Hitungan mundur baru berjalan sesudah tombol **MULAI UJIAN** ditekan, jadi
> bersiaplah dulu: alat tulis, daya baterai, dan sambungan internet. Ujian ini
> ditutup Kamis, 12 Juni 10.00; yang mulai mendekati jam tutup hanya mendapat
> sisa waktu sampai jam itu.

Menitnya **dieja seperti orang mengucapkannya**: 90 menit ditulis "1 jam 30
menit". Angka mentahnya tetap ada di kotak fakta, yang kini ikut ditandai biru.

Ujian yang **belum dibuka** juga menyebutkannya: "dibuka Kamis 08.00 dan
dikerjakan selama 1 jam 30 menit" — supaya yang datang lebih awal sudah tahu
harus menyediakan waktu berapa lama.

---

## 2. Tombol yang mengatakan sendiri apa yang terjadi

Dulu seluruh tombol pada menu CBT hanya **berubah abu-abu** saat ditekan, dan
kabar hasilnya muncul sebagai pita tipis di puncak panel. Panel CBT panjang:
tombol "Hapus" yang ditekan di dasar bank soal membuat pita itu muncul jauh di
luar layar. Yang terlihat hanya kelabu sesaat — lalu orang menekannya dua kali
karena mengira tekanan pertamanya tidak masuk.

Sekarang **kabarnya ditulis di tombolnya sendiri**, tempat mata sedang menatap:

| Tombol | Saat ditekan | Sesudahnya |
| --- | --- | --- |
| Simpan ujian | Membuat ujian… | ✓ Ujian dibuat |
| Simpan pengaturan | Menyimpan pengaturan… | ✓ Pengaturan tersimpan |
| Tambah ke bank soal | — | ✓ Berhasil ditambahkan |
| Hapus (soal) | Menghapus… | ✓ Terhapus |
| Ubah (soal) | — | ✓ Dibuka di formulir ↑ |
| Aktifkan ujian | Mengaktifkan ujian… | ✓ Ujian diaktifkan |
| Perbarui jadwal | Memperbarui jadwal… | ✓ Jadwal diperbarui |
| Batalkan | Membatalkan… | ✓ Dibatalkan |
| Hapus ujian ini | Menghapus ujian… | ✓ Terhapus |
| Masukkan N soal ke bank | Memasukkan N soal… | ✓ N soal masuk |
| Unggah media | Mengunggah… | ✓ Media terunggah |
| Template Excel / Word | — | ✓ Template terunduh |
| Unduh nilai (CSV) | — | ✓ CSV terunduh |
| Cetak naskah / berita acara / laporan | — | ✓ Dibuka di tab baru |
| Lihat jawaban | Membuka… | ✓ Terbuka di bawah |
| Simpan nilai (essay) | Menyimpan nilai… | ✓ Nilai tersimpan |

Warnanya ikut berganti: **hijau** bila berhasil, **merah** bila gagal — dan
kegagalan pun berbunyi di tombolnya ("✕ Gagal, lihat keterangannya"), bukan
hanya di pita merah yang sering berada di luar layar. Kalimat panjangnya tetap
di pita, karena satu tombol tidak muat memuat kalimat penuh.

Yang juga hilang: **bendera "sibuk" yang mengabukan seluruh panel.** Dulu satu
tombol yang sedang bekerja mematikan semua tombol lain. Sekarang tiap tombol
memadamkan dirinya sendiri saja, dan kabarnya padam sendiri sesudah beberapa
detik.

---

## 3. Pengaturan ujian dapat diubah sewaktu-waktu

### Dulu: sekali saja, saat ujian dibuat

Setelan ujian hanya dapat ditentukan pada formulir "Buat ujian". Sesudah
ujiannya jadi, **tidak ada satu layar pun** yang dapat mengubahnya — jalur
servernya sebenarnya sudah ada, tetapi tidak pernah dipanggil dari mana pun.

Yang paling mahal terjadi justru saat ujian berjalan: seorang mahasiswa
terblokir karena ponselnya sudah dipakai temannya, dan centang "satu perangkat"
tidak dapat dilepas sampai ujiannya usai. Artinya orang itu tidak ikut ujian
sama sekali.

### Sekarang: panel ⚙ Pengaturan ujian

Di dalam tiap ujian, di bawah gerbang aktivasi, ada panel terlipat **⚙
Pengaturan ujian** yang memuat seluruh setelan: nama ujian, mata kuliah, kelas,
jumlah soal, durasi, nilai minimal lulus, kode pengawas, instruksi, dan kelima
centang.

Kepalanya menyebut **berapa perubahan yang belum disimpan**, supaya centang
yang sudah dilepas tidak terlupakan di balik lipatan yang tertutup.

### Yang dikunci saat ujian berlangsung — dan yang tidak

Selama ujian **BERLANGSUNG**, hanya empat setelan yang dikunci, yaitu yang
mengubah **bentuk** ujiannya:

- jumlah soal
- durasi
- acak urutan soal
- acak urutan pilihan

Mengubahnya di tengah jalan membuat sebagian peserta mengerjakan ujian yang
berbeda dari sebagian yang lain. Empat itu tampil kelabu dengan keterangan
"terkunci", bukan hilang — supaya jelas ia ada dan kapan dapat diubah.

**Selebihnya tetap terbuka**, termasuk untuk keadaan mendesak:

- satu perangkat untuk satu peserta
- boleh kembali ke soal sebelumnya
- tampilkan nilai setelah selesai
- kode pengawas, nilai minimal lulus, instruksi, nama, mata kuliah, kelas

Aturan yang sama dijaga **server**, bukan hanya layar: `PATCH /api/cbt/ujian`
menolak perubahan bentuk selama ujian berjalan dan menyebut namanya satu per
satu — tetapi hanya bila nilainya memang berbeda, sehingga formulir yang
mengirim seluruh isian sekaligus tidak ikut tertolak.

### Tulisan dan centang yang dirapikan

Deretan centang dulu satu baris yang membungkus: panjang labelnya berbeda-beda,
jadi kotak centangnya berhenti di tempat yang berlainan tiap baris dan matanya
harus mencari satu per satu.

Sekarang ia **kisi berkolom sama lebar** — kotak centangnya sejajar tegak lurus
— dan tiap pilihan membawa satu kalimat yang menjelaskan **akibatnya**, bukan
hanya namanya:

> ☐ **Satu perangkat untuk satu peserta**
> Mencegah satu ponsel dipakai bergantian. Lepas centangnya bila ada peserta
> yang terlanjur terblokir.

Daftar yang sama dipakai formulir "Buat ujian" dan panel pengaturan, dari satu
tetapan di kode — jadi keduanya tidak mungkin berbeda kata.

---

## Berkas yang berubah

| Berkas | Perubahan |
| --- | --- |
| `src/app/cbt/kredit.tsx` | **baru** — satu tempat penyimpan baris kredit |
| `src/app/cbt/masuk-cbt.tsx` | kredit di pintu masuk |
| `src/app/cbt/ujian/ujian-app.tsx` | kredit di empat layar; kotak lama ujian sebelum "MULAI UJIAN" |
| `src/app/dashboard/cbt-panel.tsx` | kabar per tombol; panel ⚙ Pengaturan ujian; daftar centang bersama |
| `src/app/api/cbt/ujian/route.ts` | PATCH mengunci hanya setelan yang mengubah bentuk ujian |
| `src/app/globals.css` | gaya kredit, kotak waktu, tombol gagal, kisi centang, panel pengaturan |
