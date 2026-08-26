# Pembaruan: loading pada Perumus Judul dan alih bahasa Indonesia → Inggris

Dua perubahan, keduanya berjalan di peramban tanpa mengirim naskah ke mana pun.

---

## 1. Tombol "Susun rancangan penelitian" kini terlihat bekerja

**Masalahnya.** Penyusunan rancangan selesai dalam sepersekian detik. Karena
hasilnya sudah terbuka di bawah, menekan tombolnya tidak mengubah apa pun di
layar — tombolnya terbaca sebagai rusak.

**Yang berubah.**

- Hasil lama disembunyikan lebih dulu, lalu muncul kembali sebagai hasil baru.
- Tombolnya berubah menjadi "Menyusun rancangan…" beserta lingkaran berputar,
  dan tidak dapat ditekan dua kali.
- Muncul kartu "Menyusun rancangan penelitian…" selama proses berjalan.
- Setelah selesai, layar bergulir sendiri ke hasilnya, dan tombolnya berbunyi
  "Susun ulang rancangan penelitian".

Berkas: `src/app/alat/panel-judul.tsx`, `src/app/globals.css`.

---

## 2. Naskah Inggris: alih bahasa dari naskah Indonesia

Tab pada alat **Naskah Inggris** menjadi tiga:

1. **Padanan dari naskah Indonesia** — seperti sebelumnya, rumusan baku beserta
   padanan jurnalnya.
2. **Alihbahasakan naskah** — baru.
3. **Periksa naskah Inggris** — seperti sebelumnya.

### Apa yang dikerjakan tab baru

- **Judul bagian disusun ulang** mengikuti IMRaD bergaya jurnal dan prosiding:
  `I. INTRODUCTION`, `II. METHODS`, `III. RESULT AND DISCUSSION`,
  `IV. CONCLUSION AND RECOMMENDATION`, lalu `REFERENCES` tanpa nomor. Sub-bab
  menjadi sub-judul berhuruf (`A. Background`, `B. Research Problem`). Judul
  bagian tetap disisipkan walau naskahnya hanya memuat sub-bab.
- **Kala menyesuaikan bagian**: Methods dan Results memakai kala lampau,
  Introduction, Discussion, dan Conclusion memakai kala kini (APA edisi 7, bab
  4).
- **Rumusan baku diterjemahkan utuh**, bukan kata per kata. "Penelitian ini
  bertujuan untuk menganalisis" menjadi "This study examines", bukan "This
  research have a purpose to analyze".
- **Tata bahasa yang tidak ada padanannya dalam bahasa Indonesia** dipasang:
  kata sandang, urutan kata sifat (`media baru` → `new media`), kata ganti milik
  (`pilihan mereka` → `their choice`), bentuk -ing setelah kata depan, dan "to
  be" pada kalimat yang dalam bahasa Indonesia boleh tanpa kata kerja.
- **Angka diubah ke gaya Inggris**: `0,05` menjadi `0.05`, `1.200` menjadi
  `1,200`.
- **Abstrak dan kata kunci** ditulis `Abstract—…` dan `Keywords—…` mengikuti
  bentuk prosiding.
- **Daftar pustaka APA menjadi IEEE**: `[1] A. Basit and A. D. Nurlukman,
  "Judul," Nama Jurnal, vol. 18, no. 9, pp. 1875-1895, 2019.` Entri yang polanya
  tidak terbaca tetap dikeluarkan apa adanya dan ditandai belum utuh, supaya
  tidak ada rujukan yang diam-diam hilang.

### Yang sengaja tidak dilakukan

Alat ini **tidak menebak**. Kata yang tidak ada padanannya di kamus ditandai
`«begini»`, dihitung, dan didaftar terpisah — istilah khas tiap bidang memang
sebaiknya ditentukan penulisnya sendiri lalu dipakai konsisten. Persentase kata
yang berhasil dipadankan ditampilkan terbuka.

Hasilnya **draf**, bukan naskah siap kirim, dan antarmukanya menyatakan itu.

### Yang bisa dilakukan pengguna

- Menyalin drafnya, atau menyimpannya langsung ke kotak Naskah Inggris lalu
  memeriksa ragamnya di tab 3.
- Membandingkan naskah asli dan drafnya kalimat per kalimat, lengkap dengan
  keterangan bagian dan kalanya.
- Membaca catatan pedoman: apa yang sudah diterapkan, dan apa yang masih kurang
  (abstrak belum ada, metode belum terbaca, sitasi masih bergaya APA, dan
  seterusnya).

Berkas: `src/lib/alih-bahasa.ts` (baru), `src/app/alat/panel-naskah.tsx`,
`src/lib/acuan.ts`, `src/app/globals.css`.

---

## Acuan

- Swales, J. M., & Feak, C. B. (2012). *Academic Writing for Graduate Students*
  (3rd ed.). University of Michigan Press.
- American Psychological Association. (2020). *Publication Manual of the APA*
  (7th ed.), bab 4.
- IEEE. (2024). *IEEE Reference Guide*. IEEE Publishing.
- Basit, A., Nurlukman, A. D., Wahyono, E., & Fadli, Y. (2019). *Social Media in
  The Public Sphere, Network Society, and Political Branding*. Universitas
  Muhammadiyah Tangerang — contoh susunan prosiding berbahasa Inggris yang
  dipakai sebagai acuan bentuk.
