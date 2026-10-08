# UPDATE v50: CBT, esai langsung dinilai saat dikumpulkan

## Yang dikeluhkan

> "Essay-mu sedang dinilai AI dengan rubrik mata uji ini..." Jadi? Untuk apa
> rubrik yang sudah kita pasang tapi masih menunggu AI yang terlalu lama? Saya
> harap sesuai dengan rubrik dan AI mengklasifikasikan, atau mana yang enak
> menurutmu, supaya proses cepat sesuai rubrik yang kita tanam.

Keluhannya benar. Pada v49 esai dinilai **sesudah** jawaban "kumpulkan" sampai
ke peserta, dengan AI yang diminta berpikir panjang dan menulis umpan balik
panjang. Peserta melihat layar "sedang dinilai" dan menunggu tanpa kepastian.

## Pilihan yang diambil: AI hanya mengklasifikasikan, langsung saat kumpul

Rubrik sudah memuat seluruh pertimbangannya: deskriptor tiap level adalah
keputusan pengajar tentang seperti apa jawaban level 1, 2, 3, dan 4. Yang
tersisa bagi AI hanyalah **mencocokkan** jawaban dengan deskriptor itu, dan itu
pekerjaan klasifikasi, bukan pekerjaan mengarang. Maka:

### 1. AI menjadi pengklasifikasi level rubrik

- Perintahnya ditulis ulang sebagai klasifikasi: **gerbang rubrik** lebih dulu
  (tetap, jawaban yang tidak menjawab soal bernilai 0), lalu pilih level yang
  deskriptornya paling cocok untuk tiap kriteria.
- **Keluarannya pendek**: per kriteria hanya level dan **satu kalimat alasan**
  (paling banyak 20 kata), ringkasan paling banyak dua kalimat, dan paling
  banyak dua saran. Medan yang dahulu ditulis AI tetapi tidak pernah disimpan
  (`terpenuhi`, `belum`) dibuang. Waktu jawab AI hampir seluruhnya ditentukan
  oleh berapa banyak yang ia tulis dan pikirkan.
- **Usaha berpikir ditekan serendah yang diterima tiap penyedia** (mode `cepat`).
  Model yang dipasang Super Admin **tidak diganti**:

| Penyedia | Yang dikirim pada mode cepat |
|---|---|
| Gemini 3.x / `gemini-flash-latest` | `thinkingLevel: "low"` |
| Gemini Flash-Lite 3.x / `gemini-flash-lite-latest` | `thinkingLevel: "minimal"` |
| Gemini 2.5 Flash / Flash-Lite | `thinkingBudget: 0` (berpikir mati) |
| Gemini 2.5 Pro | `thinkingBudget: 128` (tidak dapat dimatikan) |
| ChatGPT `gpt-4o-mini` (bawaan) | tidak ada; model ini memang tidak berpikir lebih dulu |
| ChatGPT model penalar (gpt-5.x, seri o) | `reasoning_effort` serendah yang diterima model itu |
| Claude | `effort: "low"`; Claude Haiku tanpa thinking/effort (Haiku menolak keduanya) |

  Aturan ini disusun dari dokumentasi resmi tiap penyedia. Karena nama model
  "-latest" dapat berpindah ke generasi baru sewaktu-waktu, **setiap penolakan
  ditangani sendiri**: bila penyedia menjawab 400 karena kendali berpikirnya,
  permintaan diulang seketika dengan kendali yang lebih longgar, lalu tanpa
  kendali sama sekali. Bentuk yang lolos diingat per model, jadi penolakan
  hanya terjadi sekali per server, bukan sekali per esai.

  Fitur AI lain (pemeriksa kamera, transkrip suara, pembuat soal) **tidak
  berubah**; mode cepat hanya dipakai penilaian esai.

### 2. Dinilai di dalam permintaan "Kumpulkan"

- Begitu peserta menekan **Kumpulkan**, seluruh esainya dinilai **bersamaan**
  (paling banyak delapan sekaligus). Lima esai selesai dalam waktu satu esai.
- Permintaan itu **menunggu** hasilnya, paling lama **10 detik**. Hampir selalu
  selesai jauh lebih cepat, dan layar **Ujian selesai** langsung menampilkan
  **nilai lengkap** termasuk esai. Tidak ada lagi "sedang dinilai".
- Bila penyedia AI sedang lambat dan melewati 10 detik, peserta tidak ditahan
  lebih lama: jawabannya dikirim, penilaian **tetap berjalan sampai tuntas** di
  server, dan layar peserta memperbarui nilainya sendiri (tiap delapan detik,
  paling lama tiga menit). Hanya pada keadaan itu tulisan *"Essay-mu masih
  dinilai AI sesuai rubrik"* muncul.
- Pengumpulan **paksa** oleh aturan pengawasan tidak menunggu, supaya layar
  peserta segera tahu ujiannya dihentikan; esainya tetap dinilai di belakang.
- Papan pantau pengajar tetap menjadi jaring pengaman untuk esai yang gagal
  dinilai (kuota habis, jaringan putus), dan semua aturan v49 tetap berlaku:
  nilai pengajar tidak pernah ditimpa, lembar yang sudah disahkan tidak
  disentuh, satu jawaban hanya dinilai satu penilai.

## Diperbaiki sesudah review

Perubahan ini ditinjau dari empat sudut (penilaian saat kumpul, parameter tiap
penyedia AI, mutu dan skema klasifikasi, pengalaman peserta), dan tiap temuan
diperiksa ulang oleh peninjau terpisah yang berusaha membantahnya. Yang
terbukti, dan sudah dibetulkan:

1. **Penilaian lewat Claude ditolak.** Keluaran terstruktur Claude menolak
   `maxItems` dan `minItems` di atas satu. Skema penilaian memuat keduanya
   pada daftar kriteria **sejak sebelum v50**, jadi penilaian esai lewat
   kunci Claude kemungkinan besar selalu gagal dan jatuh ke kunci berikutnya.
   Sekarang skema yang dikirim ke Claude dibersihkan dengan pembersih milik SDK
   Anthropic sendiri; batasannya pindah ke deskripsi medan. Gemini dan
   ChatGPT tetap menerima skema lengkap. Pemeriksa kamera ikut tertolong: ia
   memuat `minimum`, `maximum`, dan `maxLength` yang juga ditolak Claude.
2. **Layar peserta berhenti menunggu terlalu cepat.** Bila papan pantau
   pengajar mengklaim esai lebih dulu (ia menyegar tiap sepuluh detik),
   jawaban "kumpulkan" dahulu mengatakan "tidak perlu menunggu" padahal
   esainya belum ternilai. Sekarang keputusan "perlu menunggu" diambil dari
   keadaan basis data, dengan aturan yang sama dengan yang dipakai layar
   peserta ketika bertanya ulang.
3. **Error Gemini yang bukan soal berpikir ikut diulang.** Google memakai
   status `INVALID_ARGUMENT` untuk hampir semua 400, termasuk kunci yang
   kedaluwarsa. Sekarang hanya penolakan yang pesannya menyebut "think" yang
   diulang dengan kendali berpikir lebih longgar.

Ditambah tiga pengaman:

- **"Kumpulkan" yang ditekan dua kali tidak lagi berakhir 409.** Karena
  permintaannya kini menunggu penilaian sampai sepuluh detik, koneksi yang
  putus di tengah membuat peserta menekan tombolnya lagi. Lembar yang sudah
  tertutup kini dijawab dengan hasilnya, dan peserta sampai di layar hasil.
- **Batas keluaran mengikuti jumlah kriteria** (2.000 + 250 per kriteria), dan
  jawaban AI yang terpotong batas itu dilaporkan sebagai "terpotong", bukan
  "tidak dapat diurai".
- **Layar peserta bertanya ulang tiap delapan detik**, bukan lima. Satu
  laboratorium sering keluar lewat satu alamat jaringan, dan batas permintaan
  per alamat dipakai bersama peserta yang masih menyimpan jawabannya.

## Yang perlu dijalankan

**Tidak ada.** Tidak ada SQL baru dan tidak ada pengaturan baru. Cukup deploy.

Untuk penilaian paling cepat, pastikan kunci AI yang **pertama** di Dashboard
Super Admin → Kunci AI adalah Gemini Flash atau ChatGPT `gpt-4o-mini`. Keduanya
model ringan yang cocok untuk klasifikasi seperti ini. Bila kunci pertama
memakai model besar (mis. Claude Opus), penilaian tetap berjalan dengan usaha
rendah, tetapi tetap lebih lambat daripada model ringan.

## Berkas yang berubah

| Berkas | Isi |
|---|---|
| `src/lib/nilai-esai.ts` | perintah klasifikasi yang ringkas, skema tanpa medan yang tidak dipakai, mode cepat, versi perintah `esai-3` |
| `src/lib/ai-penyedia.ts` | opsi `cepat`: kendali berpikir per penyedia dan per model, mundur otomatis bila ditolak, diingat per model; Claude Haiku tanpa thinking/effort; skema untuk Claude dibersihkan; keluaran terpotong dilaporkan |
| `src/lib/nilai-otomatis.ts` | `nilaiEsaiSaatKumpul()`: dinilai bersamaan di dalam permintaan, ditunggu paling lama 10 detik, sisanya lewat `after()`; `esaiMasihDinilai()` sebagai satu aturan "perlu menunggu" |
| `src/app/api/cbt/ikut/route.ts` | pengumpulan biasa menunggu penilaian dan mengirim nilai lengkap; pengumpulan paksa tidak menunggu; "selesai" pada lembar yang sudah tertutup dijawab dengan hasilnya |
| `src/app/cbt/ujian/ujian-app.tsx` | layar selesai hanya menunggu bila penilaian melewati batas; teks diperbarui |
| `uji-penilaian-ai.ts` | 10 pemeriksaan baru: keluaran ringkas dan skema yang diterima Claude |

## Uji

```
npx tsx uji-penilaian-ai.ts     58 periksa lulus
npx tsx uji-cbt-v1.ts          194 periksa lulus
npx tsc --noEmit
npm run lint
npm run build
```

Di luar uji yang ikut di repo, dijalankan juga terhadap Postgres sungguhan
dengan AI tiruan (36 pemeriksaan): dua esai satu peserta selesai dalam waktu
satu esai, nilai lengkap dikembalikan di dalam permintaan, penilaian yang
melewati batas tunggu tetap tuntas sesudahnya, pengumpulan paksa tidak
menunggu, dan layar peserta tetap diminta menunggu selama papan pantau
memegang esainya. Mode cepat tiap penyedia diuji dengan penyedia tiruan (16
pemeriksaan): Gemini yang menolak kendali berpikir diulang tanpa kendali lalu
diingat, `gpt-4o-mini` tidak pernah dikirimi `reasoning_effort`, dan 400 lain
(termasuk kunci kedaluwarsa) tetap menjadi galat tanpa diulang.

Yang **belum** dapat diuji di sini: kecepatan sungguhan dengan kunci AI asli.
Angka "dua sampai lima detik per esai" adalah perkiraan untuk model ringan
dengan usaha berpikir rendah, bukan hasil ukur.
