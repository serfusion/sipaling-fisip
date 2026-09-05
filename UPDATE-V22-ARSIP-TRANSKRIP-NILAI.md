# v22: Arsip Transkrip Nilai — transkrip yang sudah jadi tidak lagi hilang

## Masalahnya

Sampai v21, transkrip yang sudah selesai hanya punya **satu laci**:
tombol "Simpan data transkrip" menulis ke `app_settings['transkrip_data']`.

Satu laci berarti satu transkrip. Begitu Anda mengerjakan mahasiswa
berikutnya lalu menyimpannya, transkrip mahasiswa sebelumnya **tertimpa** —
tanpa peringatan, tanpa jejak. Dan karena tidak ada yang menumpuk, tidak
pernah ada jawaban untuk pertanyaan yang paling sering ditanyakan sendiri
oleh Admin Akademik: *siapa saja yang transkripnya sudah saya buat?*

---

## Yang berubah

### 1. Tombol terang di paling bawah

Di halaman **Template & Transkrip → Transkrip**, setelah seluruh tombol
lain — di bawah tabel nilai, di bawah tombol cetak — ada satu kotak hijau:

> **💾 Save di Arsip Transkrip**

Sengaja paling terang di halaman itu, dan selebar kolomnya. Semua tombol lain
di kolom editor berwarna abu atau biru muda; yang ini menyala, karena inilah
satu-satunya tindakan yang membuat transkrip yang sudah jadi tidak hilang
begitu tab ditutup.

**Tidak ada penyimpanan otomatis.** Selama tombol itu belum ditekan, tidak
ada satu baris pun yang masuk ke arsip — tidak saat impor Excel, tidak saat
berpindah tab, tidak saat mencetak. Di sebelah judulnya ada penanda yang
jujur:

| Penanda | Artinya |
| --- | --- |
| ○ Belum ada isi | tabel nilainya masih kosong |
| ● Belum disimpan | ada yang di layar, dan berbeda dari yang di arsip |
| ✓ Sudah tersimpan di arsip | yang di layar sama persis dengan yang tersimpan |

Kalau Anda menutup tab dengan transkrip yang belum diarsipkan, peramban
bertanya sekali sebelum melepasnya.

### 2. Tombolnya mati dengan ALASAN, bukan diam-diam

Transkrip setengah jadi tidak boleh masuk arsip: baris yang tercatat "sudah
dibuat" tetapi isinya bolong justru menyesatkan orang berikutnya. Jadi
tombolnya menunggu sampai transkripnya benar-benar jadi, dan alasannya
tertulis tepat di bawahnya:

- *"Belum ada mata kuliah. Impor Excel atau tambah baris dulu."*
- *"Nama mahasiswa belum diisi pada Biodata."*
- *"NIM belum diisi pada Biodata — NIM dipakai sebagai penanda arsip."*
- *"Baris ke-12 belum punya nama mata kuliah."*
- *"Baris ke-30 (\"Metode Penelitian\") belum punya SKS."*

Mata kuliah tanpa huruf mutu (Skripsi, Seminar) **tetap sah** — SKS-nya
memang dihitung, nilainya memang belum ada.

Aturan yang dipakai layar dan yang dipakai server **satu berkas yang sama**
(`src/lib/arsip-transkrip.ts`), sehingga tidak ada tombol menyala yang
ditolak di seberang, atau sebaliknya.

### 3. Daftar siapa saja yang sudah dibuat

Dua tempat, isi yang sama:

- **Di bawah tombolnya**, daftar ringkas — nama, NIM, prodi, jumlah MK, SKS,
  IPK, tanggal, dan siapa yang menyimpannya. Ada kolom pencarian begitu
  isinya lebih dari enam.
- **Dashboard → Dokumen & Arsip → Arsip Transkrip Nilai**, panel penuh
  dengan pencarian (termasuk judul skripsi), tiga angka ringkasan, dan
  tombol hapus untuk baris yang tersimpan atas NIM keliru.

Klik **Buka** pada salah satu baris, dan seluruh biodata beserta nilainya
kembali ke editor — siap dicetak ulang atau diperbaiki, **tanpa mengunggah
Excel dari SIMAK lagi**.

### 4. Satu mahasiswa satu transkrip

NIM adalah kuncinya. Menyimpan ulang NIM yang sama berarti **memperbarui**
transkrip mahasiswa itu, bukan melahirkan baris kembar yang membuat Anda
harus menebak mana yang terbaru. Pesannya menyebut mana yang terjadi:
*"…DIPERBARUI di arsip"* atau *"…masuk ke arsip"*.

### 5. Kamus mata kuliah ikut tumbuh dari sini

Sebelumnya hanya tombol draf yang memanen koreksi nama Inggris. Sekarang
**kedua tombol** memanennya — kalau tidak, kamusnya berhenti tumbuh begitu
kebiasaan berpindah ke tombol arsip, dan mata kuliah yang sama menuntut
koreksi tangan yang sama lagi pada tiap unggahan berikutnya.

### 6. Tombol lama diberi nama yang jujur

"Simpan data transkrip" → **"Simpan draf (1 laci)"**, dan "Muat data
tersimpan" → **"Muat draf"**. Fungsinya tidak berubah; namanya sekarang
menyebutkan batasnya sendiri, supaya tidak ada yang mengira draf itu arsip.

---

## Yang harus dijalankan sekali

Buka **Supabase → SQL Editor**, tempel isi berkas
`supabase-update-v22-arsip-transkrip.sql`, jalankan. Aman diulang.

Tabelnya `transcript_archives`: satu baris satu mahasiswa, isinya data
terstruktur (biodata + daftar mata kuliah dalam JSON) — bukan HTML — sehingga
transkrip lama dapat dimuat kembali dan diedit, bukan sekadar dilihat. RLS
menyala tanpa policy: seluruh pembacaan dan penulisan lewat server yang
memeriksa sesi admin lebih dulu, jadi nilai dan biodata mahasiswa tidak dapat
dibaca langsung dari peramban siapa pun.

## Siapa yang boleh

Admin Akademik, Admin, dan Super Admin — sama persis dengan yang boleh
membuat transkripnya.

---

## Cara pakainya

1. Dashboard → **Template & Transkrip** → **Transkrip Nilai** atau
   **Transkrip (ID+EN)**.
2. Impor Excel seperti biasa, rapikan nilai dan biodatanya, cetak.
3. Gulir ke **paling bawah** → **💾 Save di Arsip Transkrip**.
4. Daftarnya muncul saat itu juga, dan tercatat di
   **Dashboard → Arsip Transkrip Nilai**.

Mau memperbaiki transkrip yang sudah pernah dibuat? Buka arsipnya, klik
**Buka** (atau **Muat**), ubah seperlunya, lalu tekan tombol yang sama —
barisnya diperbarui, tidak berkembang biak.

---

## Yang dijaga uji otomatis

`npx tsx uji-arsip-transkrip.ts` — 47 pemeriksaan:

- transkrip kosong, tanpa nama, tanpa NIM, atau dengan baris bolong
  **ditolak**, dan alasannya menyebut baris mana serta mata kuliah apa
- mata kuliah tanpa huruf mutu tetap boleh diarsipkan
- angka yang tersimpan **sama dengan angka yang tercetak**: total SKS, total
  mutu, dan IPK dihitung dengan perhitungan transkrip yang sama
- predikat dihitung dari IPK yang **sudah dibulatkan** — supaya daftar arsip
  tidak pernah menulis "Dengan Pujian" untuk transkrip yang tercetak "Sangat
  Memuaskan"
- kiriman peramban dibersihkan: huruf mutu asing dibuang, SKS raksasa
  dipangkas, SKS negatif menjadi nol, jumlah baris dibatasi, kunci biodata
  yang aneh tidak ikut tersimpan
- penanda "belum disimpan" berubah begitu satu nilai atau satu isian biodata
  berubah, dan tidak berubah hanya karena urutan kuncinya berbeda
