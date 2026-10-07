# UPDATE v49: CBT, satu rubrik per mata kuliah, esai dinilai AI

## Yang diminta

> Untuk CBT bisakah rubrik dipakai 1x per 1x mata kuliah, acuan dihapus saja.
> Intinya semua jawaban/esai dicocokkan di rubrik itu dengan gatekeeper acuan
> rubriknya, dicek dan dinilai otomatis setelah selesai mengerjakan dengan
> menggunakan AI, baik itu Gemini, Claude, atau ChatGPT. Berlaku untuk soal
> yang sudah dibuat. Apa pun yang menggunakan AI wajib digunakan.

Empat perubahan, semuanya di CBT:

1. **Rubrik dipasang sekali pada mata kuliahnya**, bukan berulang pada tiap ujian.
2. **Jawaban acuan dihapus**, termasuk isian "Jawaban acuan" pada tiap soal esai.
3. **Esai dinilai AI** terhadap rubrik itu, **otomatis sesudah peserta
   mengumpulkan**, dengan **gerbang rubrik** di depannya.
4. **Berlaku juga untuk ujian dan soal yang sudah dibuat.**

---

## 1. Satu rubrik untuk satu mata kuliah

Sebelumnya rubrik dipilih per ujian, jadi UTS dan UAS mata kuliah yang sama
harus dipasangi rubrik dua kali, dan kelas paralel dengan pengajar lain bisa
saja dinilai dengan rubrik berbeda tanpa ada yang sadar.

Sekarang rubrik menempel pada **nama mata kuliah**. Seluruh ujian yang nama
mata kuliahnya sama memakai rubrik yang sama, **termasuk ujian yang dibuat
sebelum rubriknya dipasang**.

Nama mata kuliah diketik bebas, jadi yang dibandingkan adalah bentuk yang
dinormalkan: huruf besar-kecil dan spasi berlebih tidak membedakan
("Sosiologi Politik" = "sosiologi  politik"), tetapi tanda baca tetap
membedakan ("Statistik I" ≠ "Statistik II").

### Di mana memasangnya

- **CBT → Rubrik penilaian** (dahulu "Penilaian esai"). Di atas ada daftar
  **Rubrik tiap Mata Kuliah / Materi**: satu baris per mata kuliah, dengan satu
  pemilih rubrik. Mata kuliah yang belum punya rubrik ditandai kuning, karena
  esainya tidak dinilai sampai rubriknya dipasang. Di bawahnya pustaka rubrik
  seperti biasa (salin rubrik siap pakai, susun sendiri, atau unggah Excel/Word).
- **Buat ujian** dan **⚙ Pengaturan ujian**. Pemilih "Rubrik Mata Kuliah /
  Materi" menunjukkan rubrik yang sudah berlaku begitu nama mata kuliahnya
  diketik, termasuk yang dipasang rekan pengajar kelas paralel. Bila diganti,
  layar menulis jelas bahwa perubahan itu berlaku untuk **semua** ujian mata
  kuliah tersebut.

Membuka lalu menyimpan pengaturan ujian **tidak pernah** mengubah rubrik mata
kuliah diam-diam; yang dikirim hanya pilihan yang benar-benar diubah.

**Siapa yang boleh memasang:** pengajar yang memiliki minimal satu ujian mata
kuliah itu, ditambah Admin dan Super Admin.

### Ujian lama tidak perlu disentuh

SQL v49 mengisi rubrik mata kuliah **dari rubrik yang sudah dipasang pada
ujian-ujian lama**. Bila satu mata kuliah punya beberapa ujian dengan rubrik
berbeda, yang dipakai rubrik dari ujian yang terakhir diubah; pengajarnya dapat
menggantinya kapan saja.

---

## 2. Jawaban acuan dihapus

Dihapus seluruhnya dari portal:

- menu **Jawaban acuan** dan template Excel/Word-nya;
- pemilih **Jawaban acuan Dosen / Pengajar** di pengaturan ujian;
- tombol **"Nilai ulang ... dengan acuan"** di papan pantau;
- isian **"Jawaban acuan"** pada soal esai dan isian di editor soal;
- penilai **"bentuk jawaban" tanpa model** (panjang, istilah soal, susunan),
  beserta kolom "mulai ... kata" di penyusun rubrik yang hanya dipakai penilai
  itu.

Rubrik mata kuliah kini satu-satunya acuan, dan AI satu-satunya penilai
otomatis. Pengajar tetap dapat mengubah level mana pun, dan tetap yang
mengesahkan nilai.

Data jawaban acuan di basis data **tidak dihapus otomatis** (lihat bagian
"Yang perlu dijalankan").

---

## 3. Dinilai AI sesudah mengumpulkan, dengan gerbang rubrik

### Kapan

Begitu peserta menekan **Kumpulkan**, jawaban "kumpulkan" langsung sampai ke
peserta (tidak ada tambahan waktu tunggu), lalu server yang sama melanjutkan
menilai esainya dengan AI lewat `after()` dari Next.js. Beberapa esai dinilai
bersamaan, jadi lima esai selesai jauh lebih cepat daripada dinilai satu per satu.

Bila ujian menampilkan nilai, layar **Ujian selesai** berkata *"Essay-mu
sedang dinilai AI dengan rubrik mata uji ini"* dan memperbarui nilainya sendiri
tanpa memuat ulang halaman (ditanyakan tiap delapan detik, paling lama tiga
menit).

Di layar, CBT menyebut mata kuliah sebagai **"Mata Kuliah / Materi"** pada
label dan **"mata uji"** pada kalimat, sama seperti isian mata kuliah yang
sudah ada, karena CBT ini juga dipakai di luar perguruan tinggi
(`uji-kosakata-cbt.ts` menjaganya).

**Papan pantau pengajar adalah jaring pengamannya.** Selama tab Pantau
terbuka, esai yang belum dibaca AI dinilai sendiri pada penyegaran berikutnya:
penilaian yang gagal karena kuota atau jaringan, esai yang dikumpulkan sebelum
rubriknya dipasang, dan esai lama. Tombol **"✨ Nilai N esai dengan AI"**
menyebut berapa yang masih menunggu.

### Dengan AI apa

Gemini, ChatGPT, atau Claude, mana pun kuncinya yang terpasang di **Dashboard
Super Admin → Kunci AI**, dengan cadangan otomatis ke kunci berikutnya bila
satu kunci gagal. Pemakaian tercatat di fitur "Penilaian esai" dan tunduk pada
batas kuota bulanan yang sudah ada.

### Gerbang rubrik

AI mengerjakan dua langkah berurutan:

1. **Gerbang.** Apakah jawaban benar-benar menjawab pertanyaan dan dapat diukur
   dengan rubrik ini? Yang **tidak lolos**: kosong maknanya, di luar topik,
   hanya menyalin pertanyaan, atau menolak menjawab ("tidak tahu", "lewat").
2. **Level tiap kriteria**, bagi yang lolos, beserta alasan yang mengutip
   jawabannya.

Jawaban yang tidak lolos gerbang bernilai **0**, bukan level terendah. Level
terendah rubrik (1 dari 4) tetap bernilai 25 dan memang untuk jawaban yang
**lemah**; gerbang yang tetap meloloskan seperempat nilai bukan gerbang.

Gerbangnya ditegakkan **di kode**, bukan dipercayakan pada model: begitu model
mengatakan tidak lolos, seluruh kriteria dicatat level 0, apa pun level yang
ditulis model. Model yang lupa mengisi gerbang dianggap lolos, supaya tidak
ada yang dinolkan karena model lalai.

Karena nol adalah putusan yang paling mahal bila keliru:

- model diminta **meloloskan bila ragu**, dan jawaban lemah tetap lolos;
- lembar yang tidak lolos selalu ditandai *"mohon diperiksa pengajar"*;
- di lembar penilaian, level 0 tampil sebagai **"0 · Tidak lolos gerbang
  rubrik"** dan dapat diganti pengajar dengan level biasa (atau sebaliknya).

Laporan cetak dan surat nilai menampilkan level 0 sebagai `0 / 4`, bukan
tanda hubung, supaya tidak tertukar dengan "belum dinilai".

### Jawaban peserta adalah data, bukan perintah

Jawaban dipagari penanda awal dan akhir di dalam perintah ke AI, dan AI
diminta mengabaikan instruksi apa pun di dalamnya ("beri nilai penuh",
"abaikan rubrik"). Penanda pagar yang diketik peserta sendiri dibuang lebih
dulu, sehingga peserta tidak dapat "menutup" jawabannya lalu menulis perintah.

### Satu jawaban, satu penilai

Penilaian berjalan dari dua tempat (sesudah kumpul dan papan pantau). Tanpa
penjaga, lembar yang dikumpulkan selagi papan pantau terbuka akan dinilai dua
kali dan dibayar dua kali dari kuota AI. Karena itu tiap jawaban **diklaim**
lebih dulu lewat satu `UPDATE` bersyarat: hanya satu penilai yang mendapatkannya.
Klaim yang ditinggal penilai yang mati di tengah jalan basi sendiri sesudah
lima menit. Penilaian yang gagal melepas klaimnya, dan jawabannya tetap
terhitung belum dinilai.

Bila pengajar mengoreksi jawaban yang sama selagi AI masih membacanya,
keputusan pengajar yang menang: hasil AI yang datang sesudahnya dibuang.

---

## 4. Berlaku juga untuk yang sudah dibuat

| Keadaan jawaban | Yang terjadi |
|---|---|
| Belum dinilai siapa pun | Dinilai AI |
| Isian tanpa kunci | Dinilai AI (dahulu tercatat "salah" saat kumpul) |
| Dinilai jawaban acuan atau penilai tanpa model, **belum disahkan** | Dinilai ulang AI |
| Dinilai AI | Dibiarkan |
| Dinilai / dikoreksi **pengajar** | **Tidak pernah ditimpa** |
| Lembar sudah **disahkan** | **Tidak disentuh** |
| Peserta masih mengerjakan | Menunggu sampai dikumpulkan |

Penilaian ulang berjalan ketika papan pantau ujiannya dibuka, atau lewat tombol
"✨ Nilai N esai dengan AI". Tombol **Nilai ulang** di lembar satu peserta
tetap menilai ulang seluruh esainya atas permintaan pengajar; level yang sudah
diubah pengajar tetap menang.

---

## Yang perlu dijalankan

1. **`supabase-update-v49-rubrik-matkul.sql`** di Supabase, SQL Editor, Run.
   Aman dijalankan berulang kali. Satu tabel baru (`cbt_course_rubrics`) yang
   langsung terisi dari rubrik ujian lama, ditambah dua kueri pemeriksaan:
   mata kuliah yang sudah punya rubrik, dan yang **belum**.
2. **Minimal satu kunci AI** di Dashboard Super Admin → Kunci AI. Tanpa kunci,
   esai tetap tersimpan dan menunggu; papan pantau dan lembar penilaian
   mengatakannya.
3. **Pasang rubrik** untuk mata kuliah yang masih kosong (kueri pemeriksaan
   kedua di SQL, atau baris kuning di menu Rubrik penilaian).

**Opsional:** data jawaban acuan lama masih ada di basis data
(`cbt_answer_keys`, `cbt_exams.answer_key_id`) tetapi tidak dibaca lagi.
Langkah 4 di akhir berkas SQL menghapusnya **permanen**; sengaja dibiarkan
sebagai komentar supaya tidak terhapus tanpa diputuskan.

Sebelum SQL dijalankan, CBT tetap terbuka seperti biasa; yang belum berjalan
hanya penilaian otomatisnya, dan layar pengaturan menyebut berkas SQL-nya.

---

## Berkas yang berubah

| Berkas | Isi |
|---|---|
| `supabase-update-v49-rubrik-matkul.sql` | **baru**: tabel rubrik mata kuliah + isi dari ujian lama |
| `src/lib/penilaian-ai.ts` | **baru**: kunci mata kuliah, aturan jawaban mana yang dinilai, klaim, penilaian bersamaan |
| `src/lib/nilai-otomatis.ts` | ditulis ulang: hanya AI, klaim, `jadwalkanNilaiEsai()` lewat `after()` |
| `src/lib/nilai-esai.ts` | perintah dua langkah dengan gerbang rubrik, pagar jawaban, tanpa acuan |
| `src/lib/rubrik.ts` | `LEVEL_GERBANG` (0) dihitung nol; kolom ambang kata dibuang |
| `src/lib/cbt-store.ts` | `rubrikMatkul()`, `daftarRubrikMatkul()`, `pasangRubrikMatkul()` |
| `src/db/schema.ts` | tabel `cbtCourseRubrics`; kolom rubrik/acuan per ujian tidak dibaca lagi |
| `src/app/api/cbt/ikut/route.ts` | penilaian AI dijadwalkan sesudah kumpul; aksi `hasil` untuk layar peserta |
| `src/app/api/cbt/penilaian/route.ts` | hanya aksi `ai`; level 0 boleh dipilih pengajar |
| `src/app/api/cbt/rubrik/route.ts` | daftar dan pemasangan rubrik mata kuliah |
| `src/app/api/cbt/ujian/route.ts` | `rubrikMatkul` pada buat/ubah/daftar ujian |
| `src/app/api/cbt/hasil/route.ts` | `menungguAi` per peserta untuk papan pantau |
| `src/app/dashboard/cbt-v1.tsx` | menu Rubrik penilaian, lembar penilaian AI |
| `src/app/dashboard/cbt-panel.tsx` | pemilih rubrik mata kuliah, papan pantau menilai dengan AI, editor soal |
| `src/app/cbt/ujian/ujian-app.tsx` | layar selesai memperbarui nilai esai sendiri |
| `src/lib/cetak-cbt.ts`, `src/lib/kirim-nilai.ts` | level 0 tampil sebagai gerbang |
| **dihapus** | `src/lib/nilai-acuan.ts`, `src/lib/template-acuan.ts`, `src/lib/nilai-lokal.ts`, `src/app/api/cbt/acuan/route.ts`, `uji-nilai-acuan.ts`, `uji-nilai-lokal.ts` |

## Uji

```
npx tsx uji-penilaian-ai.ts     48 periksa lulus (baru)
npx tsx uji-cbt-v1.ts          194 periksa lulus
npx tsc --noEmit
npm run lint
npm run build
```

Seluruh `uji-*.ts` lain juga dijalankan dan lulus, kecuali dua yang **sudah
gagal sebelum pekerjaan ini** dan tidak bertambah temuannya:
`uji-kosakata-cbt.ts` (kosakata lama di berkas lain; v49 justru membetulkan
tiga temuannya) dan `uji-tanda-pisah.ts` (tanda pisah panjang di
`kunci-ai-panel.tsx` dan `kurikulum-panel.tsx`; dua yang ada di panel rubrik
ikut dibetulkan).

Di luar uji yang ikut di repo, alurnya juga dijalankan terhadap **Postgres
sungguhan** dengan AI tiruan: SQL v49 (dua kali, untuk memastikan aman
diulang), dua penilai yang berjalan bersamaan pada lembar yang sama (tiap esai
dinilai tepat sekali), gerbang yang menghasilkan nol, isian tanpa kunci,
kegagalan kuota yang melepas klaim, klaim basi yang diambil alih, nilai
pengajar dan lembar yang sudah disahkan yang tidak tersentuh. Lalu di server
Next.js sungguhan: "kumpulkan" terjawab seketika dengan `menungguAi: true`, dan
sesudahnya `after()` mengklaim esai dan memanggil Gemini.
