# v39: CBT — lembar jawaban yang dapat dibaca, dan berita acara yang memuat nilai

Dua keluhan dari satu layar, dan yang pertama bukan kesalahan penilaian
melainkan kesalahan **penyebutan**.

> "JAWABAN PESERTA: 2,3 — Kunci: 0,2. Kenapa tidak sesuai dan selalu '0,'?
> Pada berita acara seharusnya dimasukkan pula nilai dan jam pengumpulan
> masing-masing peserta."

---

## 1. "Jawaban 2,3" berhadapan dengan "Kunci: 0,2"

### Yang salah

Pada soal **PG kompleks** dan **penjodohan**, lembar jawaban di panel pengajar
menampilkan dua deret angka:

```
┌────────────────────────────┐
│ JAWABAN PESERTA            │
│ 2,3                        │
└────────────────────────────┘
  Kunci: 0,2
```

Keduanya angka, dan keduanya **tidak dapat dibandingkan satu sama lain** —
bukan karena salah hitung, melainkan karena keduanya menghitung dari titik yang
berbeda:

| Yang tertulis | Nomor apa |
|---|---|
| `2,3` — jawaban peserta | nomor pilihan **di layar peserta**, yang urutannya sudah diacak khusus untuk dia |
| `0,2` — kunci | nomor pilihan **pada bank soal**, urutan asli yang diketik pengajar |

Akibatnya tiga hal sekaligus:

- **Selalu dimulai "0,".** Kunci PG kompleks disimpan terurut naik, jadi hampir
  setiap soal jawaban jamak kuncinya berbunyi `0,2`, `0,1,3`, `0,3`. Itu bukan
  kebetulan dan bukan pula kerusakan — itu memang nomor terkecil yang selalu
  berada di depan.
- **Tidak akan pernah cocok**, bahkan ketika jawabannya tepat. Peserta yang
  mencentang dua pilihan yang benar tetap terbaca `2,3` bila pilihannya teracak
  demikian, sementara kuncinya `0,2`. Nilainya sudah benar — mesin penilainya
  memang memetakan nomor layar ke nomor bank sejak dulu — tetapi lembar yang
  dibaca manusia tidak.
- **Penjodohan lebih buruk lagi:** yang tercetak di kolom jawaban adalah JSON
  apa adanya, `{"0":2,"1":0}`, dan pengajar yang mengoreksi harus membaca tanda
  kutipnya sendiri.

Sebabnya satu baris di `src/app/api/cbt/hasil/route.ts` yang hanya
menerjemahkan dua jenis soal dari enam:

```ts
jawabanTeks:
  soal.jenis === "pg" || soal.jenis === "benar_salah"
    ? (soal.pilihan[nomorAsli] ?? "")   // diterjemahkan
    : dipilih,                          // dikirim apa adanya: "2,3"
```

dan satu baris di panel pengajar yang mencoba menerjemahkan kuncinya di
peramban:

```tsx
Kunci: {r.pilihan[Number(r.kunci)] ?? r.kunci}
```

`Number("0,2")` bernilai `NaN`, `pilihan[NaN]` tidak ada, jadi yang tampil
kuncinya mentah — `0,2`. Panel memang **tidak mungkin** menerjemahkannya
sendiri: peta pengacakan pilihan tiap peserta tidak pernah ikut ke peramban, dan
itu disengaja.

### Yang berubah

Penerjemahannya pindah ke `src/lib/cbt.ts`, **bersebelahan dengan mesin
penilainya**, dan dipakai oleh layar maupun berkas cetak:

```ts
jawabanTerbaca(soal, jawaban, petaPilihan)  // apa yang dijawab peserta
kunciTerbaca(soal)                          // apa kuncinya
keUrutanBank(petaPilihan, nomorLayar)       // satu-satunya pemeta, dipakai keduanya
```

Lembar jawaban yang sama sekarang berbunyi:

```
┌──────────────────────────────────────────────────┐
│ JAWABAN PESERTA                                  │
│ A. Agenda setting; B. Kultivasi                  │
└──────────────────────────────────────────────────┘
  Kunci: A. Agenda setting; B. Kultivasi; D. Spiral of silence
```

dan penjodohan berhenti memperlihatkan JSON:

```
  JAWABAN PESERTA
  Agenda setting → A. McCombs & Shaw; Spiral of silence → (kosong)
  Kunci: Agenda setting → A. McCombs & Shaw; Spiral of silence → B. Noelle-Neumann
```

Enam keputusan yang menentukan bentuknya:

1. **Hurufnya huruf bank soal**, sama dengan naskah cetak dan daftar bank soal
   di layar pengajar — bukan huruf yang dilihat peserta. Pilihan diacak berbeda
   untuk tiap orang; huruf layar peserta tidak dapat dipakai membandingkan
   lembar demi lembar. Ketika pengacakan pilihan menyala, satu kalimat di atas
   lembarnya mengatakan hal ini, supaya pengajar yang membandingkan lembar ini
   dengan layar peserta tidak menyangka salah satunya keliru.
2. **Pasangan yang dilewati peserta tetap disebut**, sebagai `(kosong)`.
   Menampilkan hanya yang terjawab membuat lembarnya terlihat lengkap padahal
   dua baris dibiarkan kosong — dan justru itu yang ditanyakan ketika nilainya
   dipersoalkan.
3. **Pemisahnya titik koma, bukan koma.** Teks pilihan sendiri memuat koma.
4. **Benar/Salah tanpa huruf.** "A. Benar" menambah satu huruf yang tidak
   pernah ditanyakan siapa pun.
5. **Kunci isian tanpa tanda pipa:** `komunikasi massa / mass communication`,
   bukan `komunikasi massa|mass communication`.
6. **Essay tidak diberi kunci sama sekali.** Kunci palsu di lembar koreksi
   essay hanya akan disalahartikan sebagai jawaban yang dituntut.

### Dua kekeliruan sejenis yang ikut diperbaiki

**a. Pratinjau impor soal.** Baris yang sama — `String.fromCharCode(65 +
Number(q.kunci))` — dipakai pada pratinjau berkas Excel/Word. Untuk kunci
`0,2` ia menghasilkan `String.fromCharCode(NaN)`, yaitu **aksara kosong**,
sehingga setiap soal jawaban jamak dan setiap soal penjodohan berbunyi
`Kunci: .` tanpa ada yang tahu apa yang hilang. Sekarang lewat
`kunciTerbaca()` yang sama.

**b. Kunci yang hilang menunjuk pilihan A.** `Number("")` bernilai `0`, dan `0`
bilangan bulat yang sah — sehingga soal dari bank lama yang kuncinya hilang akan
menyebut **pilihan A** sebagai kunci, dengan tenang, pada lembar yang dipakai
mengoreksi. Kekosongan sekarang diperiksa sebelum angkanya dibaca.

### Satu pemeta, bukan dua

Mesin penilai dahulu menulis rumus pemetaannya sendiri di dalam
`nilaiJawaban()`. Sekarang ia memanggil `keUrutanBank()` yang sama dengan yang
dipakai lembar jawaban, dan membaca jawaban jamak dengan `uraiKunciJamak()` yang
sama dengan yang membaca kuncinya. Dua rumus yang mengerjakan hal yang sama pada
akhirnya akan berbeda — dan bedanya akan muncul pada lembar yang dipercaya
orang, bukan pada nilainya.

Karena itu ada satu uji yang tidak memeriksa kalimatnya melainkan
**kesepakatannya**: untuk sejumlah jawaban, lembar boleh menyebut jawaban sama
dengan kuncinya **jika dan hanya jika** mesin penilai menyebutnya benar penuh.

---

## 2. Berita acara tanpa nilai dan tanpa jam pengumpulan

### Yang salah

Berita acara memuat kehadiran, pelanggaran sistem, dan catatan pengawas — tetapi
tidak satu pun nilai, dan tidak satu pun jam. Keduanya ada di papan pantau di
layar, dan papan pantau **tidak dapat ditandatangani dan tidak dapat
dilampirkan**. Yang diserahkan ke akademik berita acaranya, jadi pengawas
menyalin nilai satu per satu dari layar ke dokumen yang ia tanda tangani
sendiri — salah ketik tanpa ada yang tahu, pada berkas yang justru dibuka
kembali ketika hasil ujian dipersoalkan.

### Yang berubah

Bagian baru **C. Daftar nilai dan jam pengumpulan**, di antara catatan
pelanggaran dan catatan pengawas:

```
C. Daftar nilai dan jam pengumpulan
┌───┬─────────┬───────────────┬───────────────┬───────────────┬──────────┬───────┬──────────────────────────┐
│No │NIM / No.│ Nama          │ Mulai         │ Dikumpulkan   │ Lama     │ Nilai │ Keterangan               │
├───┼─────────┼───────────────┼───────────────┼───────────────┼──────────┼───────┼──────────────────────────┤
│ 1 │ 2101001 │ Budi Santoso  │10 Sep 09.03…  │10 Sep 10.01…  │58 menit  │  82   │ Lulus                    │
│ 2 │ 2101002 │ Citra Dewi    │10 Sep 09.01…  │10 Sep 10.30…  │1 jam 29m │  64   │ Waktu habis, dikumpulkan │
│   │         │               │               │               │          │       │ otomatis · Belum lulus   │
│ 3 │ 2101003 │ Eka Putra     │10 Sep 09.05…  │10 Sep 09.58…  │53 menit  │  40   │ 2 essay menunggu koreksi │
│   │         │               │               │               │          │       │ — nilai belum tetap      │
│ 4 │ 2101004 │ Fajar Nugroho │10 Sep 09.10…  │belum dikumpul │   -      │   -   │ Masih mengerjakan        │
└───┴─────────┴───────────────┴───────────────┴───────────────┴──────────┴───────┴──────────────────────────┘
Batas lulus 70 · Sudah dinilai 3 orang · Rata-rata 62 · Median 64
Tertinggi/terendah 82 / 40 · Lulus 1 dari 3 (33%)
```

Enam keputusan yang menentukan isinya:

1. **Diurutkan menurut nomor peserta, bukan jam kedatangan.** Berita acara
   dicocokkan baris demi baris dengan daftar hadir dan daftar peserta dari
   akademik; daftar yang urutannya ditentukan siapa yang masuk lebih dulu tidak
   dapat dicocokkan dengan apa pun.
2. **Seluruh peserta masuk**, bukan hanya yang melanggar. Tabel pelanggaran di
   bagian B tetap memuat yang bercatatan saja — kedua daftar itu menjawab
   pertanyaan yang berbeda.
3. **Nilai yang belum tetap dinyatakan belum tetap.** Peserta yang essaynya
   belum dikoreksi BUKAN peserta bernilai rendah, dan berita acara yang
   menyamakan keduanya adalah dokumen yang menyesatkan — lalu ditandatangani.
4. **Rata-rata dihitung dari yang sudah dinilai saja.** Peserta yang masih
   mengerjakan bukan peserta bernilai nol; memasukkannya membuat berita acara
   yang dibuat sebelum semua orang mengumpulkan menyatakan rata-rata kelas jauh
   lebih rendah daripada yang sebenarnya. Angkanya dihitung oleh
   `statistikNilai()` yang sama dengan yang dipakai papan pantau.
5. **Yang belum mengumpulkan tidak diberi jam palsu** — tertulis
   *belum dikumpulkan*, dan lamanya tanda hubung.
6. **Lamanya dihitung dari tombol MULAI sampai pengumpulan**, bukan dari durasi
   ujiannya: peserta yang masuk terlambat memang mengerjakan lebih singkat, dan
   itulah yang ditanyakan ketika ada sengketa. Jamnya jam server dan zonanya
   ikut tercetak pada tiap sel.

Label keadaan peserta — "Mengerjakan", "Waktu habis", "Selesai" — pindah ke
`src/lib/cbt.ts` sebagai `labelStatusPeserta()`, dipakai papan pantau dan berita
acara sekaligus. Dua tempat yang mengarang labelnya sendiri pada akhirnya akan
menyebut keadaan yang sama dengan dua nama, pada dokumen yang dipakai justru
ketika hasil ujian dipersoalkan.

---

## Berkas yang berubah

| Berkas | Yang dikerjakan |
|---|---|
| `src/lib/cbt.ts` | `jawabanTerbaca()`, `kunciTerbaca()`, `keUrutanBank()`, `hurufOpsi()`, `labelStatusPeserta()`; `nilaiJawaban()` memakai pemeta dan pembaca jawaban yang sama |
| `src/app/api/cbt/hasil/route.ts` | `jawabanTeks` untuk **seluruh** jenis soal, dan `kunciTeks` baru — dirangkai di server, tempat satu-satunya yang memegang peta pengacakan |
| `src/app/dashboard/cbt-panel.tsx` | kunci lembar jawaban dari `kunciTeks`; pratinjau impor lewat `kunciTerbaca()`; keterangan huruf bank soal ketika pilihan diacak; nilai dan jam ikut ke berita acara |
| `src/lib/cetak-cbt.ts` | bagian **C. Daftar nilai dan jam pengumpulan**, ringkasan statistiknya, `lamaKerja()`, gaya tabel delapan kolom |
| `uji-soal-baru.ts` | +39 pemeriksaan atas lembar jawaban yang dapat dibaca |
| `uji-cetak-cbt.ts` | +18 pemeriksaan atas daftar nilai; uji tabel pelanggaran dipersempit ke bagian B-nya saja |

---

## Cara menguji

```bash
npx tsx uji-soal-baru.ts       # 101
npx tsx uji-cetak-cbt.ts       # 104
npx tsx uji-cbt.ts             # 83
npx tsx uji-pelaksanaan-cbt.ts # 32
npx tsx uji-pengawasan.ts      # 240
npx tsx uji-impor-soal.ts      # 82
npx tsx uji-waktu-ujian.ts     # 57
npx tsx uji-kosakata-cbt.ts    # 11 atas berkas CBT
```

Yang paling menentukan di antaranya:

- **lembar dan nilai sepakat** — untuk lima jawaban berbeda pada soal yang
  pilihannya teracak, lembar menyebut jawaban sama dengan kuncinya tepat ketika
  mesin penilai menyebutnya benar penuh, tidak pernah selain itu;
- **kunci PG kompleks tidak lagi memuat nomor mentahnya** — `0,1,3` tidak boleh
  muncul lagi di mana pun pada lembarnya;
- **jawaban penjodohan bukan JSON** — dijaga dengan mencari `{"0"` pada
  keluarannya;
- **kosongnya sepakat** — apa yang disebut "tidak dijawab" oleh lembar jawaban
  harus yang disebut kosong oleh penghitung nilai, diperiksa berpasangan untuk
  empat jenis soal;
- **rata-rata berita acara tidak menghitung yang masih mengerjakan**;
- **nama peserta pada daftar nilai tetap diloloskan** — `<script>` dari nama
  yang diketik peserta tidak menjadi unsur HTML pada berkas cetak.

### Mencobanya dengan tangan

1. Buat satu soal **PG kompleks** dan satu soal **penjodohan**, biarkan
   *pengacakan urutan pilihan* menyala, aktifkan ujiannya.
2. Kerjakan sebagai peserta, kumpulkan.
3. Di panel pengajar buka **Lihat jawaban**. Yang benar: kolom jawaban dan baris
   kunci sama-sama berbunyi huruf beserta teks pilihannya, dan pada jawaban yang
   tepat keduanya **sama kata demi kata**.
4. Tekan **🖨 Buat berita acara**. Bagian C memuat nilai dan jam pengumpulan
   seluruh peserta, terurut menurut nomor pesertanya.

**Tidak ada migrasi basis data.** Yang berubah hanya cara jawaban yang sudah
tersimpan itu disebutkan; nilai yang pernah keluar tidak berubah satu angka pun.
