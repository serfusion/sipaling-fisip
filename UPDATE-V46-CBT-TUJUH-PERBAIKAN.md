# UPDATE v46 — CBT: tujuh perbaikan

## 1. Kotak hitam di beberapa bagian

Portal ini seluruhnya **terang**, tetapi ada empat blok
`@media (prefers-color-scheme: dark)` yang tertinggal di `globals.css`. Di
perangkat yang setelan sistemnya gelap, keempatnya menyala sendiri — dan yang
terlihat adalah pulau gelap di atas halaman putih, lengkap dengan tulisan gelap
di atas latar gelap. Kotak "Hitungan sistem / Nilai akhir / SAHKAN NILAI" pada
lembar penilaian adalah salah satunya.

Keempat blok itu dibuang, dan `:root` sekarang menyatakan `color-scheme: light`.
Baris terakhir itu mengurus sisanya: tanpa ia, peramban menggambar sendiri kotak
isian, daftar pilihan, dan bilah gulirnya dengan warna gelap.

## 2. Perekaman tidak lagi diumumkan ke peserta

Dibuang: kotak "Ujian ini merekam suara" di layar sebelum mulai, dan lencana
"● Merekam" di sudut layar selama ujian. Komponen mikrofonnya kini tidak
menggambar apa pun; ia hanya merekam dan mengirim.

**Satu hal yang tidak dapat dihilangkan kode mana pun:** kotak izin mikrofon
milik peramban. Ia muncul sendiri pada permintaan pertama dan bunyinya
ditentukan peramban, bukan portal ini. Pemberitahuan kepada yang direkam juga
diwajibkan sebagian besar aturan perlindungan data — tempatnya sekarang di tata
tertib ujian, di luar layar.

## 3. Peringatan yang tidak bisa digulir ke atas

`.uj-tegur`, `.uj-tirai`, `.uj-pastikan`, dan `.cbt-tirai` memusatkan isinya
dengan `place-items: center` tanpa gulir. Isi yang lebih tinggi dari layar
karena itu terpotong di **atas dan bawah sekaligus**, dan bagian yang terpotong
di atas tidak dapat dicapai sama sekali.

Keempatnya sekarang `align-content: safe center` + `overflow-y: auto`. Diukur
pada layar 380×300: sebelumnya ujung atas kotak teguran berada di −3px dan
halamannya tidak dapat digulir; sekarang di +24px dan gulirnya berjalan.

## 4. Mikrofon selalu ditolak

Penyebabnya bukan peserta melainkan satu baris header:

```
camera=(self), microphone=()     ← sebelum
camera=(self), microphone=(self) ← sesudah
```

`Permissions-Policy` untuk layar ujian membuka kamera tetapi lupa membuka
mikrofon, jadi `getUserMedia` ditolak peramban **sebelum kotak izinnya sempat
muncul**. Setiap peserta tercatat "ditolak" tanpa pernah ditanya.

Berlaku hanya di `/ujian` dan `/cbt/ujian`; halaman lain tetap `microphone=()`.

## 5. Penilaian & integritas

- Blok **Penilaian & integritas** kini ada di formulir **Buat ujian**, bukan
  hanya di ⚙ Pengaturan ujian. Rubrik dapat dipasang sejak awal.
- Daftar rubrik dimuat ulang tiap kali menu kembali ke daftar ujian — sebelumnya
  dimuat sekali di awal, jadi rubrik yang baru saja dibuat tidak muncul di
  pemilihnya sampai halaman dimuat ulang.
- **Pemutar rekaman pindah ke sebelah skor integritas** di lembar pengawasan
  tiap peserta, bukan lagi di kaki lembar jawaban.

## 6. Data mahasiswa

| | sebelum | sesudah |
|---|---|---|
| Excel/CSV | ✓ | ✓ |
| Word (.docx) | — | ✓ tabel terpanjang, atau teks bila tak ada tabel |
| Tempel | ✓ | ✓ |
| Tambah manual | — | ✓ |
| Ubah baris | — | ✓ (`PATCH /api/cbt/mahasiswa`) |
| Dari peserta ujian | — | ✓ |

**Dari peserta ujian**: nama dan nomor yang diketik peserta sendiri di layar
ujian dulu berhenti di baris percobaannya. Sekarang yang nomornya belum
terdaftar muncul sebagai daftar bercentang — satu ketukan memindahkannya ke
daftar tetap.

Datanya **permanen**. Tidak ada jalur mana pun, termasuk `/api/cleanup`, yang
membuangnya karena umur; satu-satunya yang menghapus adalah tombol Hapus.

## 7. Kata-kata penjelasan dipangkas

Sekitar dua puluh paragraf penjelasan fitur diringkas menjadi satu baris atau
dibuang. Yang **tetap ada**, dalam bentuk sependek mungkin, hanya yang
kesalahpahamannya merugikan orang: "Indikasi, bukan bukti" pada kemiripan
jawaban, "AI hanya mengusulkan level" pada penilaian esai, dan "Penandaan
otomatis dapat keliru" pada transkrip.

---

## Yang diperiksa

- `npx tsc --noEmit`, `npx eslint .`, `npm run build` — bersih.
- Seluruh berkas `uji-*.ts` dijalankan. Dua yang gagal (`uji-kosakata-cbt.ts`,
  `uji-tanda-pisah.ts`) sudah gagal sebelum perubahan ini; jumlah pelanggaran
  kosakata justru turun dari 95 ke 92.
- Header `Permissions-Policy` dibaca dari server yang berjalan: `microphone=(self)`
  di `/ujian` dan `/cbt/ujian`, `microphone=()` di `/login`.
- Layar ujian dan kotak penilaian dipotret dengan peramban bersetelan gelap —
  keduanya tetap terang dan terbaca.
