// Pembuat SURAT TUGAS pembimbing tugas akhir.
// Surat dicetak lewat jendela cetak browser (pilih "Save as PDF"), sehingga
// tidak perlu pustaka PDF tambahan — pola yang sama dipakai laporan antrean.
// Isinya selalu dibangun ulang dari data terkini, jadi setiap kali ada
// mahasiswa bimbingan baru, surat yang diunduh otomatis ikut diperbarui.

export type SuratTugasStudent = {
  nim: string;
  studentName: string;
  studyProgram: string;
  concentration: string;
  finalTaskType: string;
  title: string;
  decidedAt: string | null;
};

// Seluruh nilai dinamis di-escape sebelum masuk ke HTML agar judul atau nama
// yang mengandung karakter seperti < atau " tidak dapat menyisipkan markup.
function esc(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function buildSuratTugasHtml(input: {
  lecturerName: string;
  letterNumber: string;
  students: SuratTugasStudent[];
}) {
  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const rows = input.students
    .map(
      (student, index) => `<tr>
        <td class="c">${index + 1}</td>
        <td>${esc(student.nim)}</td>
        <td>${esc(student.studentName)}</td>
        <td>${esc(student.studyProgram)}<br /><i>${esc(student.concentration)}</i></td>
        <td>${esc(student.title)}</td>
        <td class="c">${esc(student.finalTaskType)}</td>
        <td class="c">${esc(formatDate(student.decidedAt))}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html lang="id"><head><meta charset="utf-8" />
<title>Surat Tugas Pembimbing - ${esc(input.lecturerName)}</title>
<style>
@page { size: A4; margin: 2cm 2cm 2cm 2.5cm; }
body { font-family: "Times New Roman", Times, serif; color: #000; font-size: 12pt; line-height: 1.45; margin: 0; }
.kop-space { height: 3.2cm; }
h1 { font-size: 14pt; text-align: center; margin: 0; letter-spacing: 0.06em; text-decoration: underline; }
.nomor { text-align: center; font-size: 11pt; margin: 2px 0 18px; }
p { margin: 0 0 10px; text-align: justify; }
.blok { margin: 0 0 12px 1.2cm; }
.blok div { display: grid; grid-template-columns: 4.6cm 0.4cm 1fr; }
table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 6px 0 14px; }
th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
th { background: #efefef; text-align: center; font-weight: 700; }
td.c { text-align: center; }
.sign { width: 7.5cm; margin-left: auto; text-align: center; margin-top: 22px; }
.sign .space { height: 2.2cm; }
.sign b { text-decoration: underline; }
.foot { margin-top: 26px; font-size: 8.5pt; color: #444; border-top: 1px solid #bbb; padding-top: 5px; }
.empty { text-align: center; font-style: italic; padding: 14px; }
@media print { .noprint { display: none !important; } .kop-space { height: 3.2cm; } }
.noprint { position: fixed; top: 10px; right: 10px; font-family: Arial, sans-serif; font-size: 12px; background: #1565d8; color: #fff; border: 0; border-radius: 6px; padding: 8px 14px; cursor: pointer; }
</style></head><body>
<button class="noprint" onclick="window.print()">Cetak / Simpan PDF</button>
<div class="kop-space"></div>
<h1>SURAT TUGAS</h1>
<div class="nomor">Nomor: ${esc(input.letterNumber)}</div>

<p>Yang bertanda tangan di bawah ini, Ketua Program Studi Fakultas Ilmu Sosial dan Ilmu Politik, dengan ini menugaskan:</p>
<div class="blok">
  <div><span>Nama</span><span>:</span><span><b>${esc(input.lecturerName)}</b></span></div>
  <div><span>Jabatan</span><span>:</span><span>Dosen Pembimbing Tugas Akhir</span></div>
  <div><span>Jumlah Bimbingan</span><span>:</span><span>${input.students.length} mahasiswa</span></div>
</div>
<p>Untuk membimbing penyusunan Tugas Akhir mahasiswa berikut sampai dinyatakan selesai:</p>

<table>
  <thead>
    <tr><th style="width:5%">No</th><th style="width:13%">NIM</th><th style="width:20%">Nama Mahasiswa</th><th style="width:16%">Program Studi</th><th>Judul Tugas Akhir</th><th style="width:9%">Jenis</th><th style="width:13%">Disetujui</th></tr>
  </thead>
  <tbody>${rows || '<tr><td class="empty" colspan="7">Belum ada mahasiswa bimbingan yang disetujui.</td></tr>'}</tbody>
</table>

<p>Surat tugas ini dibuat berdasarkan data persetujuan pada Sistem Pelayanan Akademik Lingkungan FISIP dan akan diperbarui secara otomatis setiap kali terdapat penambahan mahasiswa bimbingan. Demikian surat tugas ini dibuat untuk dilaksanakan sebagaimana mestinya.</p>

<div class="sign">
  <p>Jakarta, ${esc(today)}<br />Ketua Program Studi,</p>
  <div class="space"></div>
  <b>………………………………………</b>
  <p style="margin-top:2px">NIDN. …………………………</p>
</div>

<div class="foot">Dokumen dihasilkan otomatis oleh Sistem Pelayanan Akademik Lingkungan FISIP (sipalingfisip.web.id) pada ${esc(new Date().toLocaleString("id-ID"))}. Cetak di atas kertas berkop resmi fakultas.</div>
</body></html>`;
}

export function openSuratTugas(input: {
  lecturerName: string;
  letterNumber: string;
  students: SuratTugasStudent[];
}) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) {
    window.alert("Popup diblokir browser. Izinkan popup untuk situs ini, lalu coba lagi.");
    return;
  }
  win.document.write(buildSuratTugasHtml(input));
  win.document.close();
}

// Nomor surat mengikuti pola sederhana yang mudah dilacak:
// ST/<jumlah bimbingan>/<inisial dosen>/<bulan romawi>/<tahun>
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function makeLetterNumber(lecturerName: string, total: number) {
  const initials = lecturerName
    .replace(/[^A-Za-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 4)
    .toUpperCase() || "DSN";
  const now = new Date();
  return `ST/${String(total).padStart(3, "0")}/${initials}/FISIP/${ROMAN[now.getMonth()]}/${now.getFullYear()}`;
}
