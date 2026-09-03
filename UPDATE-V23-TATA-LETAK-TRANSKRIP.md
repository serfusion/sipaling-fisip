# v23: Suntingan tata letak transkrip ikut tersimpan

## Masalahnya

Di halaman **Template & Transkrip → Transkrip** ada tombol **✎ Edit tata
letak**: pratinjau transkrip menjadi bisa disunting langsung, seperti Word —
mengubah kata, menggeser huruf, menebalkan, mengganti jenis dan ukuran huruf.

Sampai v22, suntingan itu **tidak pernah ikut tersimpan**.

Tekan **💾 Simpan draf** atau **💾 Save di Arsip Transkrip** sesudah menyunting
tata letak, lalu muat kembali: yang kembali adalah bentuk bawaannya —
seolah-olah suntingannya tidak pernah ada. Persis keluhannya: *"setiap di save
setelah edit tata letak tidak ke save, hanya save defaultnya."*

Dua sebabnya, dan keduanya harus diperbaiki:

1. **Yang dikirim ke tombol simpan hanya data.** Isi kiriman hanyalah biodata
   (`meta`) dan daftar mata kuliah (`rows`). Suntingan tata letak hidup di
   dalam halaman sebagai HTML, dan HTML itu tidak pernah ikut dikirim ke mana
   pun. Yang tersimpan memang selalu bentuk bawaan.

2. **Suntingannya bahkan tidak bertahan di layar.** Pratinjau dirender dari
   data, jadi setiap kali halaman menggambar ulang — pesan sukses muncul,
   daftar arsip selesai terbaca, satu huruf diketik di kolom Biodata —
   suntingan tata letak tertimpa oleh hasil render yang baru.

---

## Yang berubah

### 1. Menyunting tata letak membekukan pratinjau

Begitu **✎ Edit tata letak** ditekan, bentuk yang sedang tampil dibekukan
menjadi HTML, dan sejak itu isinya milik halaman — bukan hasil render ulang.
Apa pun yang terjadi di sekitarnya, suntingan Anda tetap di tempatnya.

Selama membeku, muncul keterangan biru di bawah tombol cetak:

> ✎ Pratinjau memakai **tata letak hasil suntingan tangan**, dan bentuk inilah
> yang ikut tersimpan pada **Simpan draf** maupun **Save di Arsip Transkrip**.
> Selama masih begini, perubahan Biodata & nilai di sebelah kiri **tidak lagi**
> ikut ke pratinjau — suntingannya akan tertimpa kalau ikut.

Itu memang harganya, dan karena itu ditulis apa adanya: tata letak yang
disunting tangan tidak bisa sekaligus mengikuti data. Yang mana pun yang
menang, salah satunya hilang — jadi yang menang adalah yang barusan Anda
kerjakan sendiri.

Tiga jalan keluar dari keadaan beku, semuanya jelas:

| Kejadian | Akibatnya |
| --- | --- |
| **↺ Kembali ke tata letak bawaan** (tekan dua kali) | suntingan dibuang, pratinjau mengikuti data lagi |
| **Impor Excel** | tata letak otomatis dilepas — isinya milik mahasiswa lain sekarang |
| Buka lalu tutup mode sunting **tanpa mengubah apa pun** | tidak jadi membeku |

### 2. Yang tersimpan adalah yang tampil

Kedua tombol simpan sekarang mengirim tata letaknya juga:

- **💾 Simpan draf (1 laci)** → `/api/transkrip-data`
- **💾 Save di Arsip Transkrip** → `/api/arsip-transkrip`, per NIM

Dan kedua jalur pemuatan mengembalikannya utuh — **📂 Muat draf**, tombol
**Muat** pada daftar arsip, serta tautan **Buka** dari Dashboard → Arsip
Transkrip Nilai. Transkrip yang dulu Anda rapikan tangan kembali persis
seperti waktu disimpan, siap dicetak ulang tanpa dirapikan dari nol.

Kalau arsip yang dimuat tersimpan tanpa suntingan, pratinjaunya kembali
mengikuti data — sisa suntingan milik mahasiswa sebelumnya tidak ikut
menempel pada transkrip berikutnya.

### 3. Penanda "belum disimpan" ikut menghitung tata letak

Penanda di sebelah tombol arsip sekarang berbunyi **● Belum disimpan** juga
ketika yang berubah hanya tata letaknya — walau tidak satu angka pun berubah.
Sebelumnya ia berbunyi "sudah tersimpan" padahal suntingannya belum pernah
dikirim ke mana pun.

### 4. Tanpa SQL baru

Tata letak menumpang pada kolom `meta` yang sudah ada (JSON), **bukan kolom
baru**. Kolom baru berarti setiap pemasangan harus menjalankan SQL lebih dulu,
dan sampai itu dilakukan tombol Save Arsip akan gagal seluruhnya. Jadi:
**tidak ada yang perlu dijalankan di Supabase untuk pembaruan ini.**

Batas ukuran satu baris arsip dinaikkan 300.000 → 800.000 huruf agar tata
letak (dan gambar tanda tangan yang ditempel di dalamnya) muat. Yang lewat
batas ditolak dengan kalimat yang menyebut sebabnya, bukan galat mentah.

### 5. HTML yang disimpan dibersihkan dua lapis

Yang tersimpan sekarang HTML, jadi ia diperlakukan seperti template surat:

- **Lapis server** membuang `<script>`, `<iframe>`, atribut `onerror=` dan
  sejenisnya sebelum menyentuh basis data — walau tag-nya tidak berpenutup.
- **Lapis tampilan** membangun ulang seluruh pohon DOM dengan allowlist saat
  tata letak dipasang kembali. Inilah pertahanan yang menentukan.

Keduanya kini satu berkas dengan yang dipakai template surat
(`src/lib/sanitize-html.ts`), bukan dua salinan yang bisa berbeda diam-diam.

Allowlist-nya ditambah `<font face size color>` dan `aria-hidden`: itulah yang
dihasilkan tombol **jenis huruf** dan **ukuran huruf** pada toolbar. Tanpa
tambahan itu, setiap perubahan huruf akan ikut terbuang pada saat disimpan —
di transkrip **maupun** di template surat.

---

## KONSENTRASI/CONCENTRATION jadi dwibahasa

Prodi Ilmu Pemerintahan tidak memiliki konsentrasi, sehingga barisnya diisi
nama prodi itu sendiri. Sebelumnya tertulis "ILMU PEMERINTAHAN" saja,
sementara baris **PROGRAM STUDI/STUDY PROGRAM** tepat di sebelahnya sudah
dwibahasa. Sekarang keduanya sama:

```
KONSENTRASI/           :  ILMU PEMERINTAHAN /
CONCENTRATION             GOVERNMENT SCIENCE
```

Berlaku juga untuk Ilmu Komunikasi yang kolom Konsentrasinya dikosongkan
(→ ILMU KOMUNIKASI / COMMUNICATION SCIENCE). Konsentrasi yang memang diisi
sendiri — mis. Broadcasting — tetap tercetak apa adanya.

---

## Uji

```bash
npx tsx uji-arsip-transkrip.ts
```

61 pemeriksaan (naik dari 47). Yang baru menjaga tiga hal:

- HTML tata letak dibersihkan: `<script>`, `onerror=`, `javascript:` dan
  `<iframe>` terbuang, teks transkrip serta gambar `data:image` bertahan;
- tata letak kosong tersimpan sebagai "tidak ada suntingan", bukan sebagai
  halaman kosong yang membekukan pratinjau;
- tanda "belum disimpan" berubah ketika tata letaknya berubah, dan tetap sama
  ketika tata letaknya sama.

Alur di layarnya diuji langsung di peramban (Playwright, Chromium): menyunting
tata letak lalu menyimpan, memuat kembali dari draf dan dari arsip, dan
memastikan suntingan bertahan melewati render ulang React.

Satu temuan dari uji peramban itu layak dicatat, karena tidak terlihat dari
membaca kode: React memasang ulang `dangerouslySetInnerHTML` begitu **objek**
propnya berganti — bukan begitu isinya berganti. Objek baru pada tiap render
berarti dokumen ditanam ulang pada tiap render, dan suntingan terhapus tepat
pada saat admin mengetik. Objek itu kini di-memo.
