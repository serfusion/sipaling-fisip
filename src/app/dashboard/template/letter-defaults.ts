// Template surat bawaan — diturunkan dari file .docx Admin Umum FISIP.
// Struktur meniru tata letak Word:
//  - .dblock/.drow  : blok data berlabel (Nama/NPM/...) dengan kolom titik dua
//                     sejajar seperti tab-stop di Word
//  - .sign-*        : blok tanda tangan dengan ruang paraf yang benar
//  - .isian         : bagian kuning = isian yang biasanya berubah tiap surat
// Semua bisa diedit langsung pada pratinjau (contentEditable) dan dirapikan
// dengan toolbar format di atasnya.

export type LetterSlug =
  | "izin-penelitian"
  | "pkl"
  | "surat-aktif"
  | "transkrip-custom"
  | "transkrip-en";

export const LETTER_TITLES: Record<LetterSlug, string> = {
  "izin-penelitian": "Izin Penelitian",
  pkl: "Permohonan Praktek Kerja Lapangan",
  "surat-aktif": "Surat Keterangan Aktif",
  "transkrip-custom": "Transkrip Nilai (format unggahan)",
  "transkrip-en": "Transkrip Nilai — English",
};

const SIGN_GAP = '<div class="sign-space"><br /></div>';

export const DEFAULT_LETTER_HTML: Record<LetterSlug, string> = {
  "izin-penelitian": `
<p class="align-right">Tangerang, <span class="isian">08 Shafar 1448 H</span><br /><span class="isian">22 Juli 2026</span></p>
<div class="dblock dblock-tight">
  <div class="drow"><span class="dlabel dlabel-s">Nomor</span><span class="dcolon">:</span><span class="dval"><span class="isian">034/III.3.AU/F/FISIP/2026</span></span></div>
  <div class="drow"><span class="dlabel dlabel-s">Lampiran</span><span class="dcolon">:</span><span class="dval">-</span></div>
  <div class="drow"><span class="dlabel dlabel-s">Perihal</span><span class="dcolon">:</span><span class="dval"><strong><u>Izin Penelitian</u></strong></span></div>
</div>
<p class="p-gap">Kepada Yth,<br />
Bapak/Ibu Pimpinan<br />
<strong><span class="isian">PT. Aero Food Catering Services (ACS) Cengkareng</span></strong><br />
Di<br />
<span class="indent1">Tempat</span></p>
<p class="p-gap"><em>Assalamu'alaikum Wr.Wb</em></p>
<p class="align-justify">Ba'da salam kami sampaikan semoga Bapak/Ibu dalam keadaan sehat dan selalu diberikan kemudahan dalam melaksanakan kegiatan sehari-hari.</p>
<p class="align-justify">Berikut ini kami sampaikan, bahwa mahasiswa kami tersebut di bawah ini:</p>
<div class="dblock">
  <div class="drow"><span class="dlabel">Nama</span><span class="dcolon">:</span><span class="dval"><strong><span class="isian">Alviandra Hibatul Wafi</span></strong></span></div>
  <div class="drow"><span class="dlabel">NPM</span><span class="dcolon">:</span><span class="dval"><span class="isian">21-70-201-088</span></span></div>
  <div class="drow"><span class="dlabel">Prodi / Semester</span><span class="dcolon">:</span><span class="dval"><span class="isian">Ilmu Komunikasi / X</span></span></div>
</div>
<p class="align-justify">Bermaksud melakukan penelitian dan wawancara di <span class="isian">PT. Aero Food Catering Services (ACS) Cengkareng</span> yang Bapak/Ibu pimpin. Adapun surat pengantar ini diajukan dalam rangka penyelesaian tugas akhir berupa skripsi dengan judul <strong>"<span class="isian">Pola Komunikasi Organisasi Dalam Menjaga Standar Kualitas Layanan Di PT. Aero Food Catering Services (ACS) Cengkareng</span>"</strong>.</p>
<p class="align-justify p-gap">Demikian surat ini kami sampaikan, atas perhatian dan bantuannya kami ucapkan terima kasih.</p>
<p><em>Nasrun Minallah Wa Fathun Qorieb</em><br />
<em>Wassalamu'alaikum Wr.Wb.</em></p>
<div class="sign-block sign-left">
  <p>Dekan</p>
  ${SIGN_GAP}
  <p><strong><u><span class="isian">Dr. H. Achmad Kosasih, MM</span></u></strong><br />
  NBM. <span class="isian">739.574</span></p>
</div>
`,
  pkl: `
<p class="align-right">Tangerang, <span class="isian">01 Shafar 1448 H</span><br /><span class="isian">15 Juli 2026</span></p>
<div class="dblock dblock-tight">
  <div class="drow"><span class="dlabel dlabel-s">Nomor</span><span class="dcolon">:</span><span class="dval"><span class="isian">020/KET/III.3.AU/F/FISIP/2026</span></span></div>
  <div class="drow"><span class="dlabel dlabel-s">Lampiran</span><span class="dcolon">:</span><span class="dval">-</span></div>
  <div class="drow"><span class="dlabel dlabel-s">Perihal</span><span class="dcolon">:</span><span class="dval"><strong><u>Permohonan Praktek Kerja Lapangan</u></strong></span></div>
</div>
<p class="p-gap">Kepada Yth,<br />
<strong><span class="isian">Kepala DPRD Kota Tangerang</span></strong><br />
<span class="isian">Jl. Satria Sudirman No. 1 RT 001/RW 005, Kel. Sukaasih, Kec. Tangerang, Kota Tangerang, Banten 15111</span><br />
Di<br />
<span class="indent1">Tempat</span></p>
<p class="p-gap"><em>Assalamu'alaikum Wr.Wb</em></p>
<p class="align-justify">Dalam rangka memberi bekal keterampilan kepada mahasiswa serta pendekatan antara teori yang didapat di bangku kuliah dengan dunia praktisi, untuk itu kami sampaikan permohonan agar mahasiswa/i kami:</p>
<div class="dblock">
  <div class="drow"><span class="dlabel">Nama</span><span class="dcolon">:</span><span class="dval"><strong><span class="isian">Muhammad Rizky</span></strong></span></div>
  <div class="drow"><span class="dlabel">NPM</span><span class="dcolon">:</span><span class="dval"><span class="isian">24-65-201-0014</span></span></div>
  <div class="drow"><span class="dlabel">Prodi / Semester</span><span class="dcolon">:</span><span class="dval"><span class="isian">Ilmu Pemerintahan / V</span></span></div>
  <div class="drow"><span class="dlabel">No. HP</span><span class="dcolon">:</span><span class="dval"><span class="isian">0896-0441-9367</span></span></div>
</div>
<p class="align-justify">Mohon agar diizinkan untuk praktek kerja lapangan di <span class="isian">DPRD Kota Tangerang</span> yang Bapak/Ibu pimpin selama <span class="isian">2 (Dua) bulan</span>. Demikian surat permohonan ini kami sampaikan, atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>
<p class="p-gap"><em>Wassalamu'alaikum Wr.Wb</em></p>
<div class="sign-block sign-right sign-inset">
  <p>Wakil Dekan I,</p>
  ${SIGN_GAP}
  <p><strong><u><span class="isian">Nurhakim, M.Si</span></u></strong><br />
  NBM. <span class="isian">895.736</span></p>
</div>
`,
  "surat-aktif": `
<p class="align-center p-gap"><strong><u>SURAT KETERANGAN</u></strong><br />
<span class="isian">043/KET/III.3.AU/F/FISIP/2026</span></p>
<p class="align-justify">Wakil Dekan I Fakultas Ilmu Sosial Dan Ilmu Politik Universitas Muhammadiyah Tangerang, dengan ini menerangkan bahwa:</p>
<div class="dblock">
  <div class="drow"><span class="dlabel">Nama Lengkap</span><span class="dcolon">:</span><span class="dval"><strong><span class="isian">Faudath Azzihan</span></strong></span></div>
  <div class="drow"><span class="dlabel">NIM</span><span class="dcolon">:</span><span class="dval"><span class="isian">23-70-201-0259</span></span></div>
  <div class="drow"><span class="dlabel">Program / Semester</span><span class="dcolon">:</span><span class="dval"><span class="isian">Ilmu Komunikasi / VI</span></span></div>
</div>
<p class="align-justify">Adalah benar yang bersangkutan tercatat sebagai Mahasiswa/i aktif pada Fakultas Ilmu Sosial Dan Ilmu Politik Universitas Muhammadiyah Tangerang Tahun Akademik <span class="isian">2025/2026</span>.</p>
<p class="align-justify">Demikian Surat Keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.</p>
<div class="sign-block sign-right">
  <p>Tangerang, <span class="isian">27 Juli 2026</span></p>
  <p>Wakil Dekan I,</p>
  ${SIGN_GAP}
  <p><strong><u><span class="isian">Nurhakim, M.Si</span></u></strong><br />
  NBM. <span class="isian">895.736</span></p>
</div>
`,
  "transkrip-custom": `
<p class="align-center"><strong>TRANSKRIP NILAI</strong></p>
<p class="align-justify">Unggah file .docx transkrip Anda lewat tombol <strong>⇪ Ganti dari .docx</strong> untuk mengganti isi halaman ini, atau ketik langsung di sini. Pratinjau tampil dengan kop FISIP; hasil cetak otomatis tanpa kop (untuk kertas kop kampus).</p>
`,
  "transkrip-en": `
<p class="align-center p-gap"><strong>ACADEMIC TRANSCRIPT</strong><br /><em>(Transkrip Nilai — Versi Bahasa Inggris)</em></p>
<p class="align-justify"><strong>Halaman ini disiapkan untuk transkrip berbahasa Inggris.</strong> Begitu hasil terjemahan resmi dari Kantor Urusan Internasional (KUI) diterima dalam bentuk .docx, klik tombol <strong>⇪ Ganti dari .docx</strong> di atas, pilih filenya, rapikan bila perlu, lalu klik <strong>💾 Simpan template</strong> — sejak itu template English siap dipakai semua admin.</p>
<p class="align-justify">Pratinjau tampil dengan kop FISIP; hasil cetak otomatis tanpa kop (memakai kertas kop pra-cetak kampus), sama seperti template lainnya.</p>
`,
};
