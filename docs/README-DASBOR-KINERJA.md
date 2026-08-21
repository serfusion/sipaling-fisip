# Dasbor Kinerja — rancangan pengukuran

Rancangan menu **Statistik** untuk dashboard admin. Belum dibangun; berkas
`mockup-dasbor-kinerja.html` di folder ini adalah mockup dengan angka contoh.
Buka langsung di browser.

---

## Prinsip

**Jangan bandingkan unit dengan unit.** PDDIKTI sepi berarti data mahasiswa
sehat, bukan unit gagal. Laboratorium memang hanya melayani peminjaman dan
praktikum. Diagram pie "tiket per unit" akan membuat keduanya terbaca sebagai
kegagalan.

Yang dibandingkan: **tiap unit dengan dirinya sendiri bulan lalu**, memakai
ukuran yang adil bagi unit sepi maupun ramai — kecepatan, ketuntasan, dan
tiket yang menggantung.

---

## Tujuh pertanyaan yang dijawab

| # | Pertanyaan | Bentuk |
| --- | --- | --- |
| 1 | Apakah layanan cepat dan tuntas? | 4 cincin persentase + 4 kartu angka |
| 2 | Unit mana yang perlu dibantu? | Tabel papan nilai + sparkline per unit |
| 3 | Di mana pengajuan judul tersendat? | Alur berikon + corong + piktogram dosen |
| 4 | Apakah ada prodi yang tertinggal? | Batang tolak belakang, termasuk per 100 mahasiswa |
| 5 | Kapan loket paling sibuk? | Peta panas hari × jam |
| 6 | Apakah data PDDIKTI makin bersih? | Grafik area — **turun berarti berhasil** |
| 7 | Apakah luaran akademik tumbuh dan merata? | Garis 3 seri + donat + piktogram cakupan |

---

## Sumber data

Semua sudah tersedia di skema v4. **Tidak perlu tabel baru**, cukup query
agregat:

- `service_requests` — kecepatan, ketuntasan, tiket menggantung, tren unit,
  peta panas (`EXTRACT(dow/hour FROM created_at)`), tren PDDIKTI
- `title_proposals` + `title_proposal_choices` — corong, penolakan dosen,
  beban bimbingan
- `document_records` + `document_contributors` — luaran, komposisi jenis,
  cakupan dosen
- kolom `study_program` — perbandingan antar program studi

Di dalam mockup, tiap grafik punya tombol **"Dari mana angkanya?"** yang
memuat rumus dan nama kolomnya.

---

## Catatan rancangan

**Metrik terbalik.** Grafik PDDIKTI diberi label tegas bahwa turun berarti
berhasil, supaya tidak dibaca sebagai unit yang sepi peminat.

**Cakupan, bukan jumlah.** "86 luaran" terdengar bagus sampai ketahuan
datangnya dari 5 orang. Yang ditampilkan: berapa dosen yang punya minimal
satu luaran — inilah yang ditanya asesor akreditasi.

**Per 100 mahasiswa.** Ilmu Komunikasi mengirim 214 tiket, Ilmu Pemerintahan
128 — selisih besar. Tetapi per 100 mahasiswa angkanya 27 lawan 28. Tanpa
pembagi ini, prodi yang lebih kecil selalu terlihat tertinggal.

**Dirancang untuk pembaca berusia.** Ukuran dasar 17px, tombol *Perbesar
teks* menaikkannya ke 20px, sasaran sentuh minimal 44px, dan penjelasan
panjang disembunyikan di balik buka-tutup agar halaman tidak padat.

**Warna sudah diuji.** Tiga warna seri lolos pemeriksaan kontras, chroma,
dan pemisahan buta warna (protan/deutan/tritan) pada tema terang maupun
gelap.
