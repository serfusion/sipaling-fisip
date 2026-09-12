# v34: Transkrip — "UNGGUL" menempel sendiri, label biodata menyambung

## Yang salah

### 1. "UNGGUL" masih harus diketik ulang

Peringkat akreditasi sudah tertulis di template unduhan sejak v33, tetapi
hanya di situ. Berkas yang datang dari SIMAK menuliskan nomor SK-nya
sendirian:

```
Terakreditasi   : LAMSPAK Nomor 099/AK.03.05/2026
```

Yang seperti itu dulu tercetak apa adanya — tanpa peringkat sama sekali.
Admin harus mengetik "UNGGUL" di depannya, satu transkrip demi satu
transkrip, dan yang terlewat ikut tercetak lalu ikut dilegalisir.

Nomor SK-nya pun ditulis dua kali di dua berkas — sekali untuk template
unduhan, sekali untuk lembar kosong di layar. Nomor yang berganti di satu
tempat saja pernah membuat template unduhan berbulan-bulan membawa nomor
lama.

### 2. Label biodata dipatahkan di tengah

Bagian Inggris label biodata dipaksa turun ke baris bawah, padahal
pasangannya cukup pendek untuk menyambung:

```
yang tercetak            yang diminta
──────────────────────   ─────────────────────────────
NAMA MAHASISWA /         NAMA MAHASISWA / STUDENT NAME
STUDENT NAME
PROGRAM STUDI /          PROGRAM STUDI / STUDY PROGRAM
STUDY PROGRAM
```

Garis miring yang menggantung di ujung baris terbaca sebagai label yang
terpotong, bukan sebagai pasangan dwibahasa.

---

## Yang berubah

### 1. Peringkat akreditasi menempel sendiri

`pecahAkreditasi()` sekarang memasang `PERINGKAT_AKREDITASI` ("UNGGUL") di
baris atas setiap kali isiannya **hanya** memuat rujukan SK:

```
Terakreditasi   : LAMSPAK Nomor 099/AK.03.05/2026

      ↓ tercetak

TERAKREDITASI / ACCREDITATION  :  UNGGUL
                                  LAMSPAK Nomor 099/AK.03.05/2026
```

Bukan hanya saat dicetak: `lengkapiAkreditasi()` memasangnya juga pada jalur
impor, jadi kolom Akreditasi di layar dan isian yang ikut diarsipkan berbunyi
sama dengan yang keluar dari printer. Tanda kutip bawaan berkas KUI —
`"UNGGUL"` — ikut dibuang di situ.

Peringkat lain tidak pernah diganti: yang sudah menulis "BAIK SEKALI" tetap
"BAIK SEKALI". Dan `|` tetap jalan keluarnya — admin yang **sengaja**
mengosongkan peringkatnya dihormati apa adanya, karena itu satu-satunya cara
menolak peringkat bawaan.

Nomor SK sekarang ditulis SEKALI, pada `AKREDITASI_BAWAAN` di
`transkrip-label.ts`. Template unduhan dan lembar kosong di layar
membacanya dari situ, jadi nomor yang berganti ikut berganti di keduanya.

### 2. Label biodata menyambung dengan pasangan Inggrisnya

Keempat label yang diminta Admin Akademik pindah ke `LABEL_SEBARIS`:

```
NAMA MAHASISWA / STUDENT NAME                 :  LUTFI ALHABSY
NOMOR INDUK MAHASISWA / STUDENT IDENTIFICATION NUMBER
                                              :  2270201140
TEMPAT, TGL LAHIR / PLACE, DATE OF BIRTH      :  TANGERANG, 31 MARET 2001
PROGRAM STUDI / STUDY PROGRAM                 :  ILMU KOMUNIKASI
```

Yang tersisa bertingkat hanyalah label nomor — NOMOR IJAZAH NASIONAL, NOMOR
POKOK PERGURUAN TINGGI, TANGGAL YUDISIUM, NOMOR POKOK PROGRAM STUDI — yang
pasangan Inggrisnya terlalu panjang ("NATIONAL HIGHER EDUCATION INSTITUTION
CODE") dan akan mendorong kolom nilainya ke kanan kalau dipaksa sebaris.

Label yang menyambung tetap dipatahkan sendiri oleh lebar kolomnya kalau
tidak muat, tetapi itu patahan alami di tengah label — bukan garis miring
yang menggantung di ujung baris. Jumlah barisnya tidak bertambah: NAMA
MAHASISWA dan PROGRAM STUDI justru turun dari dua baris menjadi satu.

---

## Yang diperiksa

`npx tsx uji-transkrip.ts` — **249 periksa lulus** (dari 237 pada v33).

Yang baru:

- **Akreditasi**: isian tanpa peringkat ditempeli UNGGUL, bentuk SK BAN-PT
  ikut ditempeli, peringkat yang ditulis sendirian tetap satu baris,
  peringkat lain tidak diganti, penggalan paksa `|` dihormati termasuk yang
  peringkatnya sengaja dikosongkan, dan isian kosong tetap kosong.
- **Yang disimpan**: berkas SIMAK contoh menghasilkan "UNGGUL LAMSPAK Nomor
  099/AK.03.05/2026" di kolom Akreditasi, tidak ditempeli dua kali, dan
  tanda kutip KUI hilang.
- **Satu tetapan**: template unduhan memakai `AKREDITASI_BAWAAN` yang sama
  dengan lembar kosong di layar.
- **Label**: keempat label biodata menyambung, keempat label nomor tetap
  bertingkat, tidak ada yang masuk dua daftar, tidak ada label biodata yang
  lupa dipilah.

`npx tsx uji-arsip-transkrip.ts`, `uji-kelulusan-pddikti.ts`, `npm run lint`,
`npm run typecheck`, dan `npm run build` ikut dijalankan dan bersih.

---

## Berkas yang berubah

| Berkas | Isi |
| --- | --- |
| `src/app/dashboard/template/transkrip-label.ts` | `PERINGKAT_AKREDITASI`, `SK_AKREDITASI`, `AKREDITASI_BAWAAN`, `lengkapiAkreditasi()`, `LABEL_SEBARIS` |
| `src/app/dashboard/template/transkrip-template.ts` | template unduhan membaca `AKREDITASI_BAWAAN` |
| `src/app/dashboard/template/template-app.tsx` | lembar kosong membaca tetapan yang sama; impor melengkapi peringkatnya |
| `uji-transkrip.ts` | 12 periksa baru |
