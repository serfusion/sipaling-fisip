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
  server, dan layar peserta memperbarui nilainya sendiri (tiap lima detik,
  paling lama tiga menit). Hanya pada keadaan itu tulisan *"Essay-mu masih
  dinilai AI sesuai rubrik; penyedia AI sedang lambat"* muncul.
- Pengumpulan **paksa** oleh aturan pengawasan tidak menunggu, supaya layar
  peserta segera tahu ujiannya dihentikan; esainya tetap dinilai di belakang.
- Papan pantau pengajar tetap menjadi jaring pengaman untuk esai yang gagal
  dinilai (kuota habis, jaringan putus), dan semua aturan v49 tetap berlaku:
  nilai pengajar tidak pernah ditimpa, lembar yang sudah disahkan tidak
  disentuh, satu jawaban hanya dinilai satu penilai.

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
| `src/lib/ai-penyedia.ts` | opsi `cepat`: kendali berpikir per penyedia dan per model, mundur otomatis bila ditolak, diingat per model; Claude Haiku tanpa thinking/effort |
| `src/lib/nilai-otomatis.ts` | `nilaiEsaiSaatKumpul()`: dinilai bersamaan di dalam permintaan, ditunggu paling lama 10 detik, sisanya lewat `after()` |
| `src/app/api/cbt/ikut/route.ts` | pengumpulan biasa menunggu penilaian dan mengirim nilai lengkap; pengumpulan paksa tidak menunggu |
| `src/app/cbt/ujian/ujian-app.tsx` | layar selesai hanya menunggu bila penilaian melewati batas; teks diperbarui |
| `uji-penilaian-ai.ts` | 6 pemeriksaan baru untuk keluaran ringkas |

## Uji

```
npx tsx uji-penilaian-ai.ts     54 periksa lulus
npx tsx uji-cbt-v1.ts          194 periksa lulus
npx tsc --noEmit
npm run lint
npm run build
```

Di luar uji yang ikut di repo, dijalankan juga terhadap Postgres sungguhan
dengan AI tiruan (33 pemeriksaan): dua esai satu peserta selesai dalam waktu
satu esai, nilai lengkap dikembalikan di dalam permintaan, penilaian yang
melewati batas tunggu tetap tuntas sesudahnya, dan pengumpulan paksa tidak
menunggu. Mode cepat tiap penyedia diuji dengan penyedia tiruan (15
pemeriksaan): Gemini yang menolak kendali berpikir diulang tanpa kendali lalu
diingat, `gpt-4o-mini` tidak pernah dikirimi `reasoning_effort`, dan penolakan
lain tetap menjadi galat tanpa diulang.

Yang **belum** dapat diuji di sini: kecepatan sungguhan dengan kunci AI asli.
Angka "dua sampai lima detik per esai" adalah perkiraan untuk model ringan
dengan usaha berpikir rendah, bukan hasil ukur.
