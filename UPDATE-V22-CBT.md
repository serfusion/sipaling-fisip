# v22: CBT — Ujian Berbasis Komputer

MVP sesuai bagian 23 blueprint. Mahasiswa **tidak punya akun**; identitasnya
melekat pada attempt ujian, bukan pada tabel pengguna.

---

## Pembagian wewenang

Ini yang Anda minta khusus, dan ia ditegakkan di tiga lapis — menu, layar, dan
server:

| Siapa | Boleh |
| --- | --- |
| **Dosen** | membuat ujian, menyusun soal, menentukan **jumlah soal** dan **durasi**, memantau, mengoreksi essay, mengunduh nilai |
| **Admin & Super Admin** | semua yang di atas, **ditambah mengaktifkan ujian dan menyetel jamnya** |
| **Admin bagian** (umum, akademik, prodi, PDDIKTI, perpustakaan, laboratorium) | tidak melihat menu ini sama sekali |

Dosen tidak melihat tombol aktivasi. Layarnya menampilkan: *"Menunggu Super
Admin atau Admin mengaktifkan. Anda tetap dapat menyusun soalnya sekarang."*

## Jam 10 berarti jam 10

Admin menyetel jam mulai dan jam selesai, lalu menekan **Aktifkan**. Sesudah
itu **tidak ada tombol yang perlu ditekan siapa pun** pada pukul sepuluh —
ujiannya terbuka sendiri, karena statusnya dihitung dari jam server setiap kali
ada yang membukanya.

Orang yang harus menekan tombol tepat pada satu detik tertentu adalah titik
gagal yang paling sering benar-benar terjadi.

Aktivasi menolak tiga hal, sebelum mahasiswa telanjur duduk di depan layar:

- bank soal masih kosong
- ujian menuntut lebih banyak soal daripada isi banknya
- jendela ujian lebih pendek daripada durasinya (jendela 30 menit untuk ujian
  60 menit berarti setiap mahasiswa terpotong)

---

## Mahasiswa: `/ujian`

Empat layar, dan tidak lebih.

```
kode ujian → nama + NIM + kode pengawas → mengerjakan → selesai
```

- **Jam mundur selalu terlihat** di kepala halaman, dan berubah merah lima
  menit terakhir.
- **Auto-save** berjalan sendiri; penandanya tenang ("✓ Tersimpan"), dan
  kegagalan jaringan ditulis "Menyimpan ulang…" berwarna kuning — bukan galat
  merah yang membuat orang berhenti mengerjakan.
- **Daftar nomor soal** menempel di bawah layar: hijau sudah dijawab, abu
  belum, bergaris biru yang sedang dibuka.
- **Waktu habis → dikumpulkan sendiri.**
- Ponsel mati atau tab tertutup? Buka lagi `/ujian`, lembar yang sama kembali
  dengan sisa waktu yang terus berjalan.

---

## Yang dijaga, dan kenapa

**Kunci jawaban tidak pernah ikut ke peramban.** Dibuktikan pada uji sungguhan:
yang diterima mahasiswa hanya `id, jenis, pertanyaan, pilihan, bobot`. Tabel
`cbt_questions` juga RLS tanpa policy, jadi kolom `answer_key` tidak dapat
diambil langsung dari peramban.

**Waktu dihitung server.** Batasnya disimpan di `deadline_at`; jam di layar
hanya penunjuk, dan tiap penyimpanan jawaban mengembalikan sisa yang sebenarnya
sehingga jam layar ikut dikoreksi. Memutar mundur jam ponsel tidak menambah
waktu sedetik pun.

**Pilihan yang diacak dikembalikan dulu sebelum dinilai.** Ini yang paling
mudah salah. Pada uji sungguhan, kunci "McCombs & Shaw" ada di indeks 0 pada
bank tetapi muncul di indeks **2** pada layar; mahasiswa menjawab "2" dan
dinilai **benar**. Salah menanganinya berarti menyalahkan seluruh mahasiswa
yang sebenarnya menjawab benar.

**Essay yang belum dikoreksi bukan jawaban salah.** Ia bernilai `null`, bukan
`false`. Menghitungnya salah membuat nilai sementara jauh lebih rendah daripada
yang sebenarnya, dan mahasiswanya panik atas sesuatu yang belum terjadi.

**Nilai adalah persentase bobot, bukan jumlah soal.** Essay 20 poin dan pilihan
ganda 5 poin tidak dihitung sederajat.

**Soal dikunci selama ujian berlangsung.** Mengubah durasi atau jumlah soal di
tengah jalan berarti sebagian mahasiswa mengerjakan ujian yang berbeda dari
sebagian yang lain.

---

## Anti-cheating yang terpasang

Acak soal · acak pilihan · kode ujian · batas percobaan (ditegakkan indeks unik
basis data, bukan hanya pemeriksaan kode) · pencatat pindah tab · peringatan
sebelum menutup halaman · auto-save · kunci sesi acak.

Pelanggaran tampil di kolom Catatan pada monitoring: *"pindah tab 3×"*.

---

## Analisis

Rata-rata, median, tertinggi, terendah, persen lulus. Per soal: persen benar,
dan soal di bawah 30% ditandai **⚠ perlu ditinjau** — bisa jadi memang sulit,
bisa jadi kuncinya yang salah, dan yang terakhir itu yang paling mahal bila
tidak ketahuan.

Nilai diunduh sebagai CSV (dengan BOM, jadi Excel membaca huruf beraksen
dengan benar).

---

## Yang perlu Anda lakukan

```
supabase-update-v22-cbt.sql
```

Lalu buka dashboard → **Ujian Online (CBT)**.

---

## Yang belum dibuat

Blueprint bagian 23 menyarankan menahan diri, dan saya menahannya:

- Import soal dari Excel
- Blueprint ujian (komposisi mudah/sedang/sulit per materi)
- Matching, pilihan ganda kompleks, gambar/audio pada soal
- Difficulty & discrimination index penuh
- AI question generator
- Proctoring webcam
- Bank soal lintas ujian (sekarang bank menempel pada ujiannya)

Semuanya dapat ditambahkan di atas yang sudah ada tanpa membongkar tabelnya.

---

## Yang dijaga uji otomatis

`npx tsx uji-cbt.ts` — **83 pemeriksaan** atas aturan yang menentukan nasib
nilai: jam buka, batas waktu, pengacakan yang dapat diulang, penilaian
termasuk pemetaan pilihan teracak, identitas tanpa login, dan analisis.

Alurnya juga dijalankan **sungguhan** — Postgres asli, HTTP asli:

- masuk tanpa kode → ditolak; kode salah → ditolak; NIM 2 angka → ditolak
- masuk benar → 4 soal dari bank 5 soal, tanpa satu pun kolom rahasia
- jawab → auto-save → kumpulkan → **nilai 42,9** (15 dari 35 poin, tepat)
- NIM yang sama masuk lagi → ditolak, satu percobaan
- jaringan putus → `lanjut` mengembalikan **urutan soal yang sama persis**
- waktu habis → jawaban baru ditolak, yang tersimpan tetap dihitung, status
  menjadi `waktu_habis`
- kunci sesi palsu → 401; soal di luar lembarnya → ditolak

Layar mahasiswanya dijalankan di Chromium pada lebar 400px: jam terlihat,
penanda "✓ Tersimpan" muncul, navigator menghitung "1 dari 4 soal sudah
dijawab · 3 masih kosong", dan tidak ada gulir mendatar.
