# v35: Outreach Ultramailer System (OUS) — undangan jurnal NYIMAK

Fitur baru di dashboard: **Outreach Ultramailer System (OUS)**, alat kirim
undangan jurnal terpersonalisasi untuk pengurus NYIMAK, Admin, dan Super
Admin. Saklarnya dipegang Super Admin seorang diri.

---

## Hal pertama yang harus jujur ditulis

Permintaannya berbunyi *"bisa mengirim banyak email tanpa dianggap SPAM oleh
semua penyedia email"*. Bagian itu tidak dapat dijanjikan oleh perangkat lunak
mana pun, dan sistem yang menjanjikannya sedang berbohong.

Yang memutuskan sebuah surat masuk kotak masuk atau folder spam adalah
**penyedia penerima** — Gmail, Outlook, Yahoo, server kampus — dan
penilaiannya memakai reputasi domain pengirim yang dibangun berminggu-minggu.
Tidak ada baris kode di portal ini yang dapat menyentuhnya.

Yang benar-benar menentukan, berurutan dari yang paling besar dampaknya:

| # | Penentu | Dikerjakan oleh |
|---|---------|-----------------|
| 1 | Domain pengirim terautentikasi (SPF, DKIM, DMARC) | **Panel DNS — manusia, sekali** |
| 2 | Volume kecil dan rata | Kode (OUS) |
| 3 | Satu email satu penerima, bukan BCC | Kode (OUS) |
| 4 | Berhenti langganan yang berfungsi dan dihormati | Kode (OUS) |
| 5 | Pantulan dan keluhan langsung dihentikan | Kode (OUS) |
| 6 | Isi surat yang wajar, bukan iklan berteriak | Kode (OUS) + penulisnya |

Nomor 2–6 ditegakkan OUS, dan ditegakkan sungguh-sungguh — bukan sebagai
anjuran di layar melainkan sebagai penolakan di server. **Nomor 1 dikerjakan
sekali di panel DNS, dan tanpanya seluruh sisanya hampir tidak berarti.**

Karena itu OUS **menolak** mematikan mode simulasi selama alamat pengirimnya
masih memakai Gmail/Yahoo/Outlook, dan selalu menampilkan pengingat SPF/DKIM/
DMARC yang tidak dapat ditutup. Yang tidak dilakukan: menampilkan centang
hijau untuk hal yang tidak pernah diperiksanya.

---

## Yang dipasang

### 1. Menu baru: **Outreach Ultramailer**

```
Dashboard
├── Ringkasan
├── Antrean Layanan
├── Ujian Online (CBT)
├── Outreach Ultramailer   ← baru
└── …
```

Siapa yang melihatnya:

| Peran | Melihat menu | Membuat & mengirim | Menggeser saklar |
|-------|--------------|--------------------|------------------|
| Super Admin | selalu | saat saklar menyala | **ya** |
| Admin | saat saklar menyala | saat saklar menyala | tidak |
| Dosen **yang dibukakan** | saat saklar menyala | saat saklar menyala | tidak |
| Dosen lain | tidak | tidak | tidak |
| Admin unit (umum, akademik, prodi, PDDIKTI, perpustakaan, laboratorium) | tidak | tidak | tidak |

Dosen dibuka **satu per satu lewat alamat emailnya**, bukan lewat peran. Pada
pemasangan awal, satu akun sudah terdaftar: **`basit@umt.ac.id`**.

Super Admin tetap melihat panelnya ketika saklar mati — di situlah saklarnya
berada. Tanpa perkecualian itu, OUS yang sekali dimatikan tidak akan pernah
dapat dinyalakan kembali dari dalam sistemnya sendiri.

### 2. Saklar Super Admin

Dua saklar, dan keduanya lahir dalam keadaan aman:

```
[ SAKLAR UTAMA ]  MATI       — tidak ada kampanye yang dapat dibuat maupun jalan
[ MODE SIMULASI ] MENYALA    — seluruh alur jalan, TIDAK ADA surat yang keluar
```

Saklar utama diperiksa untuk **semua peran, Super Admin sekalipun**. Saklar
yang pemegangnya sendiri kebal bukan saklar; ia sekadar pagar untuk orang
lain.

Mode simulasi tidak dapat dimatikan selama masih ada penghalang — ditolak di
server, bukan hanya disembunyikan tombolnya di layar.

### 3. Laju kirim: 50–100 per hari

Bagian yang diminta secara khusus, dan bagian yang paling menentukan.

```
Jatah per hari    60   (dapat disetel 10–100, dibatasi keras di 100)
Jatah per jam     12
Jeda antar surat  45 detik + guncangan acak 80%–130%
Jam kirim         08.00–17.00 WIB
Pemanasan         hari 1–2: 20 · hari 3–4: 30 · hari 5–6: 40
                  hari 7–9: 50 · hari 10+: jatah penuh
```

Guncangan acak pada jeda bukan hiasan: pengiriman yang jaraknya persis sama
tiap kali adalah pola mesin, dan pola mesin justru yang dicari penyaring.

Jam kirim dihitung dari UTC, bukan dari zona waktu mesin. Fungsi serverless
berjalan dengan `TZ=UTC`, dan jendela "08.00–17.00" yang diam-diam berarti
15.00–24.00 WIB adalah kekeliruan yang baru ketahuan setelah seluruh kampanye
terkirim tengah malam.

Konsekuensinya ditampilkan **sebelum** tombol jalankan ditekan:

```
Dengan jatah 60 surat per hari, kampanye ini akan berjalan sekitar 17 hari.
```

Seribu alamat pada jatah 60 memang tujuh belas hari. Itu disengaja.

### 4. Empat naskah surat NYIMAK

Tersalin sendiri saat panel pertama dibuka:

| Kode | Nama | Untuk |
|------|------|-------|
| `nyimak-cfp` | General Call for Papers | Undangan umum — paling aman untuk kampanye pertama |
| `nyimak-internasional` | International Researchers | Penerima di luar Indonesia; memakai kolom institusi & negara |
| `nyimak-bidang` | Per Bidang Penelitian | Menyebut bidang penerima; butuh kolom `field` terisi |
| `nyimak-susulan` | Follow-up (Gentle Reminder) | Surat kedua, sekali saja |

Naskahnya sengaja ditulis **datar**: tidak ada janji terindeks di mana pun,
tidak ada tenggat, tidak ada angka penerimaan, tidak ada penyebutan biaya.
Bukan karena hal-hal itu terlarang, melainkan karena tidak satu pun dapat
diverifikasi dari dalam portal — dan undangan jurnal yang memuat klaim keliru
merusak nama jurnalnya jauh lebih dalam daripada undangan tanpa klaim apa pun.

> **Sebelum kampanye pertama:** sesuaikan wording, nomor terbitan, dan
> kebijakan biaya dengan keterangan resmi NYIMAK yang sedang berlaku.
> Peringatan ini juga tercetak di atas daftar naskah pada panelnya.

Contoh `nyimak-cfp` sesudah mail merge:

```
Dari    : NYIMAK Editorial Team <journal@domain-resmi>
Kepada  : Dr. Amira Rahman <amira@um.edu.my>
Subjek  : Invitation to Submit Your Research to NYIMAK

Dear Dr. Amira Rahman,

We are pleased to invite you to consider submitting your recent research to
NYIMAK: Journal of Communication, a peer-reviewed, open-access journal
published by the Faculty of Social and Political Sciences, Universitas
Muhammadiyah Tangerang, Indonesia.
…
Submissions and full author guidelines:
https://jurnal.umt.ac.id/index.php/nyimak

Warm regards,
NYIMAK Editorial Team
──────────────────────────────────────────────────────────
You are receiving this message because your published work is publicly
listed in the field of communication or media studies. If this invitation
is not relevant to you, we apologise for the intrusion — you may
unsubscribe here and you will not be contacted again.
```

### 5. Pemeriksa nada

Memeriksa subjek dan badan surat **sebelum** kampanye berjalan, lalu
menahannya bila ada temuan berat.

```
Pemeriksa nada                                   Berisiko tinggi · skor 61

  Wajib dibereskan   Subjek ditulis hampir seluruhnya dengan HURUF BESAR.
  Wajib dibereskan   Subjek memuat lebih dari satu tanda seru.
  Sebaiknya          Isi surat sangat pendek; surat yang terlalu ringkas
                     sering ditandai sebagai massal.
```

Dua hal yang **menahan** kampanye, dan keduanya bukan soal selera:

- tidak ada tautan berhenti langganan — kewajiban pada hampir semua
  yurisdiksi sekaligus syarat semua penyedia;
- pemendek tautan (bit.ly dan kerabatnya) — hampir semua penyaring
  memperlakukannya sebagai penyamaran alamat.

Skornya bukan ramalan, dan panel mengatakannya apa adanya: tidak ada penyaring
spam yang menerbitkan aturannya.

### 6. Berhenti langganan yang benar-benar berfungsi

```
{{unsubscribe_url}}  →  https://…/email/berhenti?t=<token acak 32 huruf>
```

- Tautannya hanya membawa **token acak**, tidak pernah alamat emailnya.
  Bentuk `?email=john@gmail.com` membocorkan alamat penerima ke setiap
  perantara yang dilewatinya, termasuk ke log server mana pun yang mencatat
  URL lengkap.
- Kepala **`List-Unsubscribe`** + **`List-Unsubscribe-Post`** terpasang pada
  setiap surat. Inilah yang memunculkan tombol "Berhenti berlangganan" di
  baris atas Gmail — dan orang yang menekan tombol itu **tidak** menekan
  tombol "laporkan spam" di sebelahnya. Satu keluhan spam merusak reputasi
  domain jauh lebih dalam daripada seratus orang yang berhenti langganan.
- `GET` pada alamat itu **tidak mengubah apa pun**, hanya mengantar ke halaman
  konfirmasi. Pemindai tautan dan pramuat peramban mengetuk alamat semacam ini
  tanpa diminta; kalau `GET` langsung memberhentikan, orang akan keluar dari
  daftar tanpa pernah menekan apa pun.
- Sekali ditekan, tiga hal terjadi sekaligus: alamatnya masuk daftar cekal,
  statusnya berubah, dan **seluruh barisnya yang masih mengantre di kampanye
  mana pun dibatalkan**. Yang ketiga sering terlupa, dan akibatnya paling
  terasa: orang yang menekan "berhenti" lalu tetap menerima surat esok harinya
  karena suratnya sudah telanjur mengantre sejak kemarin.

Halaman yang dilihat penerimanya tidak punya navigasi, tidak menawarkan
"frekuensi lebih jarang", dan tidak menampilkan alamat emailnya sendiri.

### 7. Alur satu kampanye

```
Tempel alamat / unggah CSV
        ↓
Periksa daftar            324 terbaca · 301 siap · 12 duplikat · 7 rusak · 4 dicekal
        ↓
Pilih naskah + pratinjau  (lengkap dengan baris Dari dan Subjek)
        ↓
Pemeriksa nada            menahan bila ada temuan berat
        ↓
Dua centang konfirmasi    daftar sudah diperiksa · isi sudah dibaca
        ↓
Kampanye tersimpan sebagai DRAF — belum mengirim apa pun
        ↓
Surat uji                 dirakit lewat jalur yang sama persis
        ↓
Jalankan → antrean → pekerja → penyedia → penerima
        ↓
Webhook → sampai / memantul / mengadu → daftar cekal
```

Kampanye lahir sebagai **draf**. Tidak ada kampanye yang berjalan hanya karena
seseorang menekan "simpan".

### 8. Daftar cekal

Alamat masuk karena orangnya menekan berhenti langganan, karena suratnya
memantul keras, atau karena ia melaporkan kita sebagai spam. Diperiksa **dua
kali**: saat kampanye dibuat, dan sekali lagi tepat sebelum suratnya dikirim —
karena di antara keduanya bisa lewat berhari-hari.

Yang boleh **mengeluarkan** alamat dari daftar ini hanya Super Admin.
Mengirim lagi kepada orang yang sudah menolak adalah hal paling merusak yang
dapat dilakukan sistem ini terhadap reputasi domainnya sendiri.

Pantulan **lunak** (kotak penuh, server sibuk) sengaja **tidak** mencekal: itu
keadaan sementara, dan mencekal alamat yang kotak masuknya kebetulan penuh
berarti kehilangan penerima yang sah untuk seterusnya.

---

## Bentuk teknisnya

### Berkas baru

```
src/lib/outreach.ts            aturan murni — tidak menyentuh basis data & jaringan
src/lib/outreach-template.ts   empat naskah NYIMAK + rangka surat
src/lib/outreach-store.ts      seluruh perintah SQL
src/lib/outreach-kirim.ts      perakit surat + pengantar ke penyedia
src/lib/outreach-gerbang.ts    satu tempat untuk seluruh pemeriksaan wewenang

src/app/dashboard/outreach-panel.tsx   panel dashboard
src/app/email/berhenti/                halaman berhenti langganan

src/app/api/outreach/settings/         GET semua yang berhak · PUT Super Admin
src/app/api/outreach/templates/        naskah
src/app/api/outreach/campaigns/        daftar · periksa daftar · buat
src/app/api/outreach/campaigns/[id]/   rincian + daftar penerima
src/app/api/outreach/campaigns/[id]/aksi/  jalan · jeda · lanjut · batal · uji
src/app/api/outreach/worker/           pekerja antrean
src/app/api/outreach/cekal/            daftar cekal
src/app/api/outreach/berhenti/         List-Unsubscribe (satu ketukan)
src/app/api/outreach/webhook/          peristiwa penyedia

supabase-update-v35-outreach-ous.sql   tujuh tabel + indeks + RLS
uji-outreach.ts                        272 pemeriksaan
```

### Tabel

```
outreach_recipients           penerima sebagai entitas tersendiri
outreach_templates            naskah
outreach_campaigns            kampanye + SALINAN naskahnya
outreach_campaign_recipients  penelusuran per penerima
outreach_suppression          daftar cekal
outreach_events               peristiwa penyedia
outreach_audit                jejak tindakan
```

Tiga keputusan bentuk yang perlu diketahui sebelum mengubahnya:

1. **Penerima adalah entitas tersendiri**, bukan baris di dalam kampanye.
   Status berhenti langganannya menempel pada *orangnya* — bukan pada salah
   satu kampanye.
2. **Naskah disalin ke dalam kampanye** saat kampanye dibuat. Template boleh
   disunting kapan saja; kampanye yang sedang berjalan tidak boleh berubah
   isinya di tengah jalan.
3. **Hasil render per penerima tidak disimpan.** Blueprint menyediakan
   kolomnya; memakainya berarti seribu salinan HTML yang sama persis kecuali
   satu nama. Suratnya dirakit ulang saat hendak dikirim.

RLS menyala pada ketujuh tabel, **tanpa policy sama sekali**. Bukan kelalaian:
isinya daftar alamat email peneliti beserta institusinya — data pribadi orang
yang tidak punya akun di sistem ini dan tidak pernah menyerahkan datanya
kepada kita. Satu policy baca yang longgar berarti daftar itu dapat diunduh
dari peramban siapa pun yang punya akun apa pun.

### Antrean yang tidak pernah mengirim dua kali

Pengambilannya atomik di dalam basis data:

```sql
with dipilih as (
  select cr.id from outreach_campaign_recipients cr
  join outreach_campaigns k on k.id = cr.campaign_id
  where cr.status = 'queued'
    and (cr.next_attempt_at is null or cr.next_attempt_at <= now())
    and k.status = 'sending'
  order by cr.next_attempt_at nulls first, cr.id
  limit $1
  for update of cr skip locked          -- ← di sinilah letaknya
)
update outreach_campaign_recipients cr
set status = 'sending', attempts = cr.attempts + 1
from dipilih d, …
```

`SKIP LOCKED` membuat baris yang sedang dipegang pekerja lain **dilewati**,
bukan ditunggu. Pekerja kedua — cron dan tombol panel yang berjalan
bersamaan — mendapat sepuluh baris berikutnya, bukan sepuluh baris yang sama.
Statusnya berpindah dalam perintah yang sama, sehingga jendela antara "dibaca"
dan "ditandai" tidak ada sama sekali.

Ditambah kunci unik `(campaign_id, recipient_id)`: satu orang tidak dapat
menerima surat yang sama dua kali dari satu kampanye, dan jaminan itu tidak
bergantung pada ketelitian kode di atasnya.

### Coba ulang

```
Percobaan 1 gagal  →  5 menit   (hanya untuk galat sesaat: 429, 5xx, timeout)
Percobaan 2 gagal  →  30 menit
Percobaan 3 gagal  →  menyerah, ditandai gagal
```

Alamat yang ditolak, memantul keras, atau dicekal **tidak** dicoba ulang sama
sekali.

### Webhook

Tanda tangan HMAC-SHA256 atas `<id>.<timestamp>.<badan mentah>` (bentuk Svix,
dipakai Resend). Yang diperiksa, berurutan:

- rahasianya ada — tanpa `OUTREACH_WEBHOOK_SECRET`, seluruh webhook dijawab
  `503`. Menerima apa adanya berarti siapa pun yang tahu alamat ini dapat
  mengarang "pantulan keras" untuk alamat mana pun dan mencekalnya selamanya;
- usianya di bawah lima menit — tanpa ini, satu permintaan yang pernah terekam
  dapat dikirim ulang kapan saja;
- badannya dibaca **mentah**, sebab JSON yang diurai lalu disusun ulang
  menghasilkan tanda tangan yang berbeda.

Peristiwa berulang ditolak indeks unik pada `provider_event_id` — penyedia
mengirim ulang webhook yang belum dijawab 200, dan tanpa itu satu pantulan
yang sama akan terhitung berkali-kali di kartu statistik.

---

## Cara memasang

### 1. Jalankan migrasi

Supabase → SQL Editor → tempel isi `supabase-update-v35-outreach-ous.sql` →
Run. Aman diulang; menjalankannya lagi **tidak** mematikan OUS yang sudah
dinyalakan dan tidak mengembalikan daftar dosennya.

### 2. Siapkan domain pengirim

Bagian yang tidak dapat dilewati, dan bagian yang tidak dapat dikerjakan
portal:

1. Daftarkan domain jurnal/kampus di penyedia email (Resend, Amazon SES,
   Postmark, Brevo, atau Mailgun).
2. Pasang catatan **SPF**, **DKIM**, dan **DMARC** yang diberikannya di panel
   DNS domain tersebut.
3. Tunggu sampai ketiganya berstatus *verified/pass* di panel penyedia.

Jangan memakai Gmail, Yahoo, atau Outlook sebagai alamat pengirim: penyedia
gratis menolak menandatangani DKIM atas nama Anda, dan DMARC penerima akan
menolak suratnya. OUS menolak keluar dari mode simulasi bila alamatnya
memakai salah satu dari itu.

### 3. Environment variables

| Nama | Wajib | Guna |
|------|-------|------|
| `OUTREACH_API_KEY` | untuk kiriman sungguhan | Kunci API penyedia. Kosong = seluruhnya simulasi. |
| `OUTREACH_PROVIDER` | tidak | `resend` (bawaan) atau `mock` |
| `OUTREACH_WEBHOOK_SECRET` | sangat dianjurkan | Tanpanya webhook dijawab 503 dan pantulan tidak pernah tercatat |
| `CRON_SECRET` | sudah ada | Dipakai juga oleh pekerja antrean |
| `NEXT_PUBLIC_PORTAL_URL` | tidak | Pangkal tautan berhenti langganan |

Semua disimpan di server. **Tidak satu pun boleh berawalan
`NEXT_PUBLIC_`** kecuali yang memang tercantum di atas — `NEXT_PUBLIC_` berarti
ikut terkirim ke peramban setiap pengunjung.

### 4. Arahkan webhook penyedia

```
https://<domain-portal>/api/outreach/webhook
```

Peristiwa yang perlu dilanggan: `delivered`, `bounced`, `complained`,
`unsubscribed`.

### 5. Nyalakan

Super Admin → Dashboard → **Outreach Ultramailer** → tab **Pengaturan &
Saklar**:

1. Isi identitas pengirim (nama, alamat, Reply-To).
2. Nyalakan saklar utama.
3. Buat satu kampanye kecil, kirim surat uji, **tekan tautan berhenti
   langganannya** — kalau ia tidak bekerja, di sinilah hal itu harus ketahuan.
4. Baru sesudah itu matikan mode simulasi.

---

## Yang menjalankan antreannya

Antrean bergerak bila ada yang memanggil pekerjanya. Tiga jalan, dan
sebaiknya dipakai bersama-sama:

| Jalan | Kapan | Catatan |
|-------|-------|---------|
| **Panel terbuka** | tiap 30 detik | Menyala sendiri selama ada kampanye berjalan dan layarnya terbuka |
| **Tombol "Proses antrean sekarang"** | manual | Satu putaran |
| **Penjadwal** | `0 3 * * *` (10.00 WIB) | Sudah terdaftar di `vercel.json` sebagai jaring pengaman |

Penjadwal Vercel pada paket Hobby hanya berjalan **sekali sehari**, jadi ia
tidak cukup untuk memenuhi jatah 60 surat sendirian. Untuk antrean yang jalan
tanpa layar terbuka, pakai penjadwal luar (mis. cron-job.org) tiap 2–5 menit:

```
GET https://<domain-portal>/api/outreach/worker
Authorization: Bearer <CRON_SECRET>
```

Satu putaran mengirim paling banyak lima surat, menunggu jeda di antaranya,
dan berhenti pada anggaran 45 detik — sisanya dikembalikan ke antrean, bukan
digantung pada status "sending".

---

## Uji

```
npx tsx uji-outreach.ts      # 272 periksa — baru
npx tsx uji-maintenance.ts   # 60 periksa — tetap lulus
npx tsx uji-cbt.ts           # 83 periksa — tetap lulus
npm run lint
npm run typecheck
npm run build
```

Yang diperiksa `uji-outreach.ts`, di antaranya:

- **tabel kebenaran wewenang penuh** — sembilan peran × dua keadaan saklar.
  Termasuk pemastian bahwa saat saklar mati, **tidak ada satu peran pun** yang
  boleh mengirim, Super Admin sekalipun;
- normalisasi alamat: huruf besar, kurung sudut, `mailto:`, tanda baca di
  ekor, batas 64/254 huruf RFC 5321;
- pembacaan tempelan & CSV: berkas tanpa baris judul tidak kehilangan alamat
  pertamanya, koma di dalam tanda kutip tidak memecah kolom;
- penyaringan: valid + duplikat + rusak + tercekal **harus** berjumlah
  totalnya — angka di layar harus dapat dijumlahkan kembali;
- mail merge: rantai cadangan, dan **pelolosan HTML** — nama penerima datang
  dari berkas CSV yang ditempel orang;
- pemeriksa nada: keempat naskah bawaan lolos; naskah tanpa tautan berhenti,
  subjek berteriak, dan pemendek tautan ditahan;
- jatah harian, tabel pemanasan yang tidak pernah turun, jendela jam yang
  dihitung dari UTC;
- perakitan surat: kepala `List-Unsubscribe`, versi teks biasa, kaki berhenti
  yang ditambal bila hilang, dan tautan yang tidak membocorkan alamat.

---

## Yang sengaja TIDAK dibuat

Mengikuti bagian 64 blueprint:

- surat yang dikarang AI;
- pelacakan buka surat — angkanya tidak akurat karena proksi gambar dan
  perlindungan privasi, dan piksel pelacaknya sendiri menaikkan skor spam;
- A/B testing, CRM, penyusun alur kerja;
- **pengumpulan alamat otomatis dari internet.** Ini yang paling tegas.
  Daftar penerima harus datang dari sumber yang jelas dan dapat dijelaskan
  kepada orang yang menanyakannya. Alamat hasil panen adalah cara tercepat
  menumpuk keluhan spam, dan satu keluhan merusak lebih dalam daripada seratus
  surat yang tidak dibalas.
