# UPDATE v52: Transkrip Nilai di Kertas Concorde

## Yang diminta

> Pada Transkrip Nilai saya mau kamu membuat 1 template lagi (Kertas Concorde -
> Light Yellow), kertas asli yang dipakai untuk diserahkan ke mahasiswa
> (kemarin hanya sementara). Templatenya kurang lebih sama dengan KUI tapi kop
> surat (header) sedikit lebih ke bawah, ukuran kop 4,7 cm dengan kertas yang
> sama F4. Hasil memakai template kertas sementara di kertas asli nabrak
> terlalu ke atas, tolong sesuaikan agar tidak terpotong saat dicetak.

## Sebabnya

Templat **Transkrip (ID+EN)** dibuat untuk kertas sementara (biru), yang
kopnya 4,5 cm. Teksnya mulai tepat di 4,5 cm. Kop kertas Concorde 4,7 cm, jadi
baris pertama ("NOMOR IJAZAH NASIONAL / NATIONAL DIPLOMA NUMBER") jatuh di atas
alamat dan garis kop.

## Yang ditambahkan

Templat baru **Transkrip Kertas Concorde**, bentuknya sama dengan Transkrip
(ID+EN) dari Excel KUI (dwibahasa, dua kolom, tanda tangan Dekan & Rektor).
Yang berbeda hanya letaknya di kertas:

| | Transkrip (ID+EN), kertas sementara | Transkrip Kertas Concorde |
|---|---|---|
| Kop pra-cetak | 4,5 cm | **4,7 cm** |
| Teks mulai dari tepi atas | 4,5 cm | **5,2 cm** (kop + jeda 0,5 cm) |
| Tinggi kertas yang dihitung | Legal 35,56 cm | **F4 33 cm** |
| Tanda tangan | langsung sesudah tabel | **dipatok ke bawah**, berakhir 1 cm di atas tepi bawah F4, sama dengan pratinjau |
| Pratinjau | putih, kop biru | **kuning seperti kertas Concorde**, garis putus-putus di batas kop 4,7 cm |

Cara membukanya:

- Dashboard → kartu **Transkrip Nilai · Kertas Concorde**, atau
- Template Dokumen → tab **Transkrip Kertas Concorde**, atau
- Dashboard → Arsip Transkrip Nilai → **Concorde →** di sebelah **Buka →**
  (untuk transkrip dwibahasa).

Draf, arsip, kamus nama Inggris, dan **Edit tata letak** bekerja sama persis
dengan Transkrip (ID+EN); yang tersimpan adalah datanya, jadi transkrip yang
sudah diarsipkan dari tab ID+EN dapat langsung dicetak di Concorde. Templat
ID+EN untuk kertas sementara **tidak berubah sama sekali**.

## Supaya tidak terpotong di bawah

Teks yang turun 0,7 cm dan kertas F4 yang lebih pendek daripada Legal berarti
ruang untuk tabel berkurang. Isi yang melewati 33 cm tidak pindah ke halaman 2,
melainkan tidak ada kertasnya. Karena itu pratinjau Concorde **mengukur
tingginya sendiri** setiap kali isi berubah (unggah Excel, ubah biodata,
tambah/hapus mata kuliah, ketik di Edit tata letak) dan memadatkan tabel
bertahap **hanya bila perlu**:

| Tingkat | Yang diubah |
|---|---|
| 0 | tidak ada, sama dengan templat ID+EN |
| 1 | jarak antarbaris tabel dirapatkan |
| 2 | huruf tabel 6,8 → 6,4 pt |
| 3 | baris lebih rapat lagi, ruang tanda tangan 0,75 → 0,6 cm |
| 4 | huruf tabel 6 pt (ukuran tabel di PDF acuan transkrip) |

Biodata, judul, dan tanda tangan tidak pernah diperkecil. Bila tingkat 4 pun
belum muat, muncul peringatan di bawah tombol cetak dan garis merah "batas aman
kertas Concorde F4" di pratinjau memotong isi, sehingga admin tahu sebelum
mencetak.

Diukur di Chromium (PDF hasil cetak) dengan transkrip uji yang sengaja berat:
sepertiga nama mata kuliah panjang sampai turun ke baris kedua, Indonesia
maupun Inggris.

| Jumlah MK | Templat ID+EN lama, di kertas F4 | Templat Concorde |
|---|---|---|
| 40 | muat, teks menabrak kop | muat, tingkat 0 |
| 48 | tanda tangan berakhir 32,4 cm | muat, tingkat 1 |
| 52 | tanda tangan 34,2 cm, **terpotong** | muat, tingkat 3 |
| 56 | dua halaman | muat, tingkat 4 |
| 60 | dua halaman | muat, tingkat 4 |
| 66 | dua halaman | 0,8 cm terlalu panjang, **peringatan muncul** |

Pada semua yang muat, tinta pertama ada di 5,21 cm (di bawah kop 4,7 cm) dan
tinta terakhir di 31,85 cm (di dalam F4 33 cm). Transkrip dengan nama mata
kuliah yang lebih pendek daripada data uji ini membutuhkan tingkat yang lebih
rendah.

## Cara mencetak

Sama seperti sebelumnya: tombol **🖨 Cetak di kertas Concorde (tanpa kop)**,
lalu di dialog print **Margins = None**, **Scale = Default (100%)**, matikan
**Headers and footers**. Masukkan kertas Concorde dengan **kop di sisi atas**.
Pengaturan kertas di printer tidak perlu diubah dari yang dipakai untuk kertas
sementara kemarin.

Ukuran 4,7 cm diambil dari foto kertas Concorde. Untuk lembar pertama, cetak
satu transkrip uji lalu periksa jeda antara garis kop dan baris pertama; bila
printer menggeser kertas, angkanya cukup diubah di satu tempat
(`.tk-doc.tk-concorde.letter-page` di `globals.css`).

## Yang perlu dijalankan

**Tidak ada.** Tidak ada SQL baru dan tidak ada pengaturan baru. Cukup deploy.

## Berkas yang berubah

| Berkas | Isi |
|---|---|
| `src/app/dashboard/template/template-app.tsx` | tab & jenis `transkrip-concorde`; `TranskripModule` menerima `kertas="concorde"`; pemadatan otomatis ke F4 dan peringatannya; label tombol cetak |
| `src/app/globals.css` | geometri kertas Concorde (kop 4,7 cm, teks 5,2 cm, F4 33 cm), pratinjau kuning, garis batas, tingkat pemadatan |
| `src/app/dashboard/dashboard-app.tsx` | kartu **Transkrip Nilai · Kertas Concorde** |
| `src/app/dashboard/arsip-transkrip.tsx` | tautan **Concorde →** pada arsip transkrip dwibahasa |

## Uji

```
npx tsx uji-transkrip.ts          329 periksa lulus
npx tsx uji-arsip-transkrip.ts     80 periksa lulus
npx tsc --noEmit
npm run lint
npm run build
```

Ditambah pengukuran di Chromium yang dijalankan terhadap halaman aslinya (tabel
di atas): posisi tiap blok di layar dan saat dicetak sama, jumlah halaman PDF,
pratinjau otomatis maupun tata letak hasil suntingan ikut dipadatkan, dan tab
Transkrip (ID+EN) tetap seperti sebelumnya (teks 4,5 cm, tanpa pemadatan).

Yang **belum** dapat diuji di sini: hasil cetak sungguhan di printer kampus.
