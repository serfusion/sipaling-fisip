// ============================================================
// LEMBAR CETAK CBT — naskah soal, berita acara, laporan per peserta
//
// Tiga berkas cetak, dan semuanya dirakit sebagai HTML lalu dibuka pada
// jendela tersendiri untuk dicetak atau disimpan sebagai PDF. Cara ini sudah
// dipakai portal untuk surat tugas dan laporan antrean, jadi dosennya sudah
// mengenalnya — dan tidak perlu ada satu pun pustaka PDF baru.
//
// SELURUHNYA FUNGSI MURNI: masuk data, keluar untai HTML. Tidak menyentuh
// jendela, dokumen, maupun jaringan, sehingga isinya dapat diuji apa adanya —
// dan yang paling perlu diuji di sini adalah bahwa KUNCI JAWABAN tidak ikut
// tercetak pada naskah yang dibagikan ke mahasiswa.
// ============================================================
import { JENIS_LABEL, type JenisSoal, type Media, type Pasangan } from "@/lib/cbt";

export type SoalCetak = {
  id: number;
  jenis: JenisSoal;
  pertanyaan: string;
  pilihan: string[];
  kunci: string;
  pasangan: Pasangan[];
  media?: Media;
  bobot: number;
  materi?: string;
  tingkat?: string;
  pembahasan?: string;
};

export type UjianCetak = {
  judul: string;
  mataKuliah: string;
  kelas: string | null;
  kode: string;
  durasi: number;
  jumlahSoal: number;
  instruksi?: string | null;
  mulai?: string | null;
  selesai?: string | null;
};

const HURUF = "ABCDEFGH";

/**
 * Lolos-kan teks sebelum masuk HTML.
 *
 * Soal ditulis dosen, dan tanda < > & muncul wajar pada rumus dan nama
 * ("McCombs & Shaw", "x < y"). Tanpa ini, satu tanda kurung siku membuat sisa
 * naskahnya hilang dari halaman cetak — dan hilangnya diam-diam.
 */
export function lolos(teks: unknown): string {
  return String(teks ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const GAYA = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Times New Roman", Times, serif; font-size: 12pt;
         line-height: 1.5; color: #000; }
  .kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 16px; }
  .kop h1 { margin: 0 0 4px; font-size: 15pt; letter-spacing: .04em; }
  .kop p { margin: 2px 0; font-size: 11pt; }
  .keterangan { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11pt; }
  .keterangan td { padding: 2px 0; vertical-align: top; }
  .keterangan td:first-child { width: 32%; }
  .keterangan td:nth-child(2) { width: 3%; }
  .petunjuk { border: 1px solid #000; padding: 9px 12px; margin-bottom: 16px; font-size: 11pt; }
  .petunjuk b { display: block; margin-bottom: 4px; }
  ol.soal { margin: 0; padding-left: 22px; }
  ol.soal > li { margin-bottom: 13px; page-break-inside: avoid; }
  .tanya { margin: 0 0 5px; white-space: pre-line; }
  .opsi { margin: 0; padding-left: 18px; list-style: none; }
  .opsi li { margin-bottom: 2px; }
  .jodoh { width: 100%; border-collapse: collapse; margin-top: 4px; }
  .jodoh td { border: 1px solid #666; padding: 4px 7px; vertical-align: top; font-size: 11pt; }
  .garis { border-bottom: 1px dotted #444; height: 1.6em; }
  .kunci { font-weight: bold; }
  .media-catatan { font-style: italic; font-size: 10.5pt; color: #333; }
  .kaki { margin-top: 22px; font-size: 10pt; text-align: center; color: #333;
          border-top: 1px solid #999; padding-top: 8px; }
  table.nilai { width: 100%; border-collapse: collapse; font-size: 11pt; }
  table.nilai th, table.nilai td { border: 1px solid #555; padding: 5px 7px; text-align: left; }
  table.nilai th { background: #eee; }
  .ttd { margin-top: 34px; width: 100%; }
  .ttd td { width: 50%; vertical-align: top; text-align: center; font-size: 11pt; }
  .ttd .ruang { height: 62px; }
  @media print { .sembunyi-cetak { display: none !important; } }
  .bilah { position: sticky; top: 0; background: #1e3a5f; color: #fff; padding: 9px 14px;
           font-family: system-ui, sans-serif; font-size: 13px; display: flex; gap: 10px;
           align-items: center; justify-content: space-between; margin: -18mm -16mm 16px; }
  .bilah button { padding: 7px 15px; border: 0; border-radius: 5px; background: #fff;
                  color: #1e3a5f; font: inherit; font-weight: 700; cursor: pointer; }
`;

function bungkus(judul: string, isi: string) {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
<title>${lolos(judul)}</title><style>${GAYA}</style></head><body>
<div class="bilah sembunyi-cetak">
  <span>Tekan Cetak, lalu pilih <b>Simpan sebagai PDF</b> pada tujuan pencetak.</span>
  <button type="button" onclick="window.print()">Cetak / Simpan PDF</button>
</div>
${isi}
</body></html>`;
}

function tanggalPanjang(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function kop(ujian: UjianCetak, subjudul: string) {
  return `<div class="kop">
  <h1>${lolos(subjudul)}</h1>
  <p>FAKULTAS ILMU SOSIAL DAN ILMU POLITIK</p>
  <p>SiPaling FISIP — Sistem Ujian Berbasis Komputer</p>
</div>`;
}

function barisKeterangan(pasangan: Array<[string, string]>) {
  const baris = pasangan
    .map(([kiri, kanan]) => `<tr><td>${lolos(kiri)}</td><td>:</td><td>${lolos(kanan)}</td></tr>`)
    .join("");
  return `<table class="keterangan">${baris}</table>`;
}

// ---------- 1. NASKAH SOAL ----------

/**
 * Naskah soal siap cetak — cadangan ketika listrik padam atau jaringan mati.
 *
 * `denganKunci` menentukan dua berkas yang sama sekali berbeda peruntukannya:
 * yang dibagikan ke mahasiswa, dan yang dipegang pengawas. Kunci jawaban
 * TIDAK PERNAH ikut kecuali diminta tegas — naskah cadangan yang tercetak
 * beserta kuncinya lalu dibagikan adalah cara tercepat menggagalkan ujian.
 */
export function naskahSoalHtml(
  ujian: UjianCetak,
  soal: SoalCetak[],
  opsi: { denganKunci?: boolean; namaPengawas?: string } = {},
): string {
  const denganKunci = opsi.denganKunci === true;

  const daftar = soal
    .map((s) => {
      const bagian: string[] = [`<p class="tanya">${lolos(s.pertanyaan)}</p>`];

      // Media tidak dapat dicetak sebagai gambar dari sini, jadi keberadaannya
      // disebutkan — supaya pengawas tahu soal ini pincang tanpa layarnya.
      if (s.media?.jenis && s.media.url) {
        bagian.push(
          `<p class="media-catatan">[Soal ini disertai ${s.media.jenis}` +
            `${s.media.keterangan ? `: ${lolos(s.media.keterangan)}` : ""} — tidak tercetak]</p>`,
        );
      }

      if (s.jenis === "penjodohan") {
        const kiri = s.pasangan
          .map((p, i) => `<tr><td>${i + 1}. ${lolos(p.kiri)}</td><td>${
            denganKunci ? `<span class="kunci">${HURUF[p.kanan] ?? "?"}. ${lolos(s.pilihan[p.kanan] ?? "")}</span>` : "…………"
          }</td></tr>`)
          .join("");
        const kanan = s.pilihan
          .map((p, i) => `<li>${HURUF[i] ?? i + 1}. ${lolos(p)}</li>`)
          .join("");
        bagian.push(`<table class="jodoh">${kiri}</table>`);
        bagian.push(`<p class="tanya"><i>Pilihan jawaban:</i></p><ul class="opsi">${kanan}</ul>`);
      } else if (s.pilihan.length > 0) {
        const kunciJamak = new Set(
          s.jenis === "pg_kompleks" ? s.kunci.split(",").map((n) => Number(n.trim())) : [Number(s.kunci)],
        );
        const opsiHtml = s.pilihan
          .map((p, i) => {
            const iniKunci = denganKunci && kunciJamak.has(i);
            const teks = `${HURUF[i] ?? i + 1}. ${lolos(p)}`;
            return `<li>${iniKunci ? `<span class="kunci">${teks} ✓</span>` : teks}</li>`;
          })
          .join("");
        bagian.push(`<ul class="opsi">${opsiHtml}</ul>`);
        if (s.jenis === "pg_kompleks") {
          bagian.push('<p class="media-catatan">(Jawaban boleh lebih dari satu)</p>');
        }
      } else if (s.jenis === "isian") {
        bagian.push(denganKunci
          ? `<p class="kunci">Kunci: ${lolos(s.kunci)}</p>`
          : '<div class="garis"></div>');
      } else {
        // Essay: diberi ruang menulis yang sepadan dengan bobotnya.
        const baris = Math.max(3, Math.min(Math.round(s.bobot / 3), 10));
        bagian.push(Array.from({ length: baris }, () => '<div class="garis"></div>').join(""));
        if (denganKunci && s.pembahasan) {
          bagian.push(`<p class="kunci">Rambu penilaian: ${lolos(s.pembahasan)}</p>`);
        }
      }

      return `<li>${bagian.join("")}</li>`;
    })
    .join("");

  const isi = `
${kop(ujian, denganKunci ? "NASKAH SOAL DAN KUNCI JAWABAN" : "NASKAH SOAL UJIAN")}
${barisKeterangan([
  ["Mata Kuliah", ujian.mataKuliah],
  ["Nama Ujian", ujian.judul],
  ["Kelas", ujian.kelas || "—"],
  ["Waktu", `${ujian.durasi} menit`],
  ["Jumlah Soal", `${soal.length} butir`],
  ["Total Bobot", `${soal.reduce((n, s) => n + s.bobot, 0)} poin`],
])}
${denganKunci ? '<div class="petunjuk"><b>BERKAS PENGAWAS — JANGAN DIBAGIKAN KE MAHASISWA.</b>Berkas ini memuat kunci jawaban.</div>' : ""}
<div class="petunjuk">
  <b>PETUNJUK</b>
  ${ujian.instruksi ? `${lolos(ujian.instruksi)}<br>` : ""}
  Tulis nama dan NIM pada lembar jawaban. Kerjakan dengan pulpen. Naskah ini adalah
  cadangan tercetak; bila ujian daring dapat dilanjutkan, ikuti arahan pengawas.
</div>
${!denganKunci ? barisKeterangan([["Nama", "……………………………………………"], ["NIM", "……………………………………………"], ["Tanda Tangan", "……………………………………………"]]) : ""}
<ol class="soal">${daftar}</ol>
<div class="kaki">Kode ujian ${lolos(ujian.kode)} · dicetak ${tanggalPanjang(new Date().toISOString())}</div>`;

  return bungkus(`Naskah Soal — ${ujian.judul}`, isi);
}

// ---------- 2. BERITA ACARA ----------

export type BeritaAcara = {
  pengawas: string;
  ruang: string;
  hadir: number;
  terdaftar: number;
  selesai: number;
  berjalan: number;
  pelanggaran: number;
  catatan: string;
  peserta: Array<{ nim: string; nama: string; status: string; pindahTab: number; keluarFullscreen: number }>;
};

/**
 * Berita acara pelaksanaan ujian.
 *
 * Yang membuat berkas ini berguna bukan angkanya melainkan DAFTAR
 * PELANGGARANNYA: itulah satu-satunya yang tidak dapat direka ulang sesudah
 * ujian bubar, dan itulah yang ditanyakan ketika ada sengketa nilai.
 */
export function beritaAcaraHtml(ujian: UjianCetak, acara: BeritaAcara): string {
  const melanggar = acara.peserta.filter((p) => p.pindahTab > 0 || p.keluarFullscreen > 0);
  const daftarLanggar = melanggar.length === 0
    ? "<p>Tidak ada pelanggaran yang tercatat sistem selama ujian berlangsung.</p>"
    : `<table class="nilai">
        <tr><th>NIM</th><th>Nama</th><th>Pindah tab</th><th>Keluar layar penuh</th></tr>
        ${melanggar.map((p) => `<tr><td>${lolos(p.nim)}</td><td>${lolos(p.nama)}</td>
          <td>${p.pindahTab}×</td><td>${p.keluarFullscreen}×</td></tr>`).join("")}
      </table>
      <p class="media-catatan">Catatan sistem ini adalah penanda, bukan putusan. Penentuan
      pelanggaran tetap pada pengawas dan dosen pengampu.</p>`;

  const isi = `
${kop(ujian, "BERITA ACARA PELAKSANAAN UJIAN")}
${barisKeterangan([
  ["Mata Kuliah", ujian.mataKuliah],
  ["Nama Ujian", ujian.judul],
  ["Kelas", ujian.kelas || "—"],
  ["Kode Ujian", ujian.kode],
  ["Hari / Tanggal", tanggalPanjang(ujian.mulai)],
  ["Waktu Berakhir", tanggalPanjang(ujian.selesai)],
  ["Durasi", `${ujian.durasi} menit`],
  ["Ruang / Moda", acara.ruang || "Daring"],
  ["Pengawas", acara.pengawas || "—"],
])}

<h3>A. Kehadiran</h3>
<table class="nilai">
  <tr><th>Peserta masuk ujian</th><td>${acara.hadir} orang</td></tr>
  <tr><th>Sudah mengumpulkan</th><td>${acara.selesai} orang</td></tr>
  <tr><th>Masih mengerjakan saat berita acara dibuat</th><td>${acara.berjalan} orang</td></tr>
</table>

<h3>B. Catatan pelanggaran sistem</h3>
${daftarLanggar}

<h3>C. Catatan pengawas</h3>
<div class="petunjuk" style="min-height:70px">${acara.catatan ? lolos(acara.catatan) : "—"}</div>

<p>Demikian berita acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.</p>

<table class="ttd">
  <tr><td>Mengetahui,<br>Dosen Pengampu</td><td>Pengawas Ujian</td></tr>
  <tr><td class="ruang"></td><td class="ruang"></td></tr>
  <tr><td>(………………………………)</td><td>(${lolos(acara.pengawas || "………………………………")})</td></tr>
</table>`;

  return bungkus(`Berita Acara — ${ujian.judul}`, isi);
}

// ---------- 3. LAPORAN PER PESERTA ----------

export type RincianCetak = {
  nomor: number;
  jenis: JenisSoal;
  pertanyaan: string;
  jawabanTeks: string;
  benar: boolean | null;
  poin: number;
  bobot: number;
  catatan?: string;
};

export type PesertaCetak = {
  nim: string;
  nama: string;
  nilai: number | null;
  benar: number;
  salah: number;
  sebagian?: number;
  kosong: number;
  tertunda: number;
  mulai: string;
  kumpul: string | null;
  pindahTab: number;
  keluarFullscreen: number;
};

/** Laporan satu peserta: nilai, rincian jawaban, dan catatan koreksinya. */
export function laporanPesertaHtml(
  ujian: UjianCetak,
  peserta: PesertaCetak,
  rincian: RincianCetak[],
  passing: number,
): string {
  const lulus = peserta.nilai !== null && peserta.nilai >= passing;
  const baris = rincian
    .map((r) => {
      const tanda = r.benar === null ? "menunggu koreksi" : r.benar ? "benar" : r.poin > 0 ? "benar sebagian" : "salah";
      return `<tr>
        <td>${r.nomor}</td>
        <td>${lolos(JENIS_LABEL[r.jenis])}</td>
        <td>${lolos(r.pertanyaan.slice(0, 110))}${r.pertanyaan.length > 110 ? "…" : ""}</td>
        <td>${lolos(r.jawabanTeks) || "<i>tidak dijawab</i>"}</td>
        <td>${tanda}</td>
        <td>${r.poin} / ${r.bobot}</td>
      </tr>${r.catatan ? `<tr><td></td><td colspan="5"><i>Catatan dosen: ${lolos(r.catatan)}</i></td></tr>` : ""}`;
    })
    .join("");

  const isi = `
${kop(ujian, "LAPORAN HASIL UJIAN PESERTA")}
${barisKeterangan([
  ["Nama", peserta.nama],
  ["NIM", peserta.nim],
  ["Mata Kuliah", ujian.mataKuliah],
  ["Nama Ujian", ujian.judul],
  ["Kelas", ujian.kelas || "—"],
  ["Mulai Mengerjakan", tanggalPanjang(peserta.mulai)],
  ["Dikumpulkan", tanggalPanjang(peserta.kumpul)],
])}

<h3>A. Ringkasan nilai</h3>
<table class="nilai">
  <tr><th>Nilai akhir</th><td><b style="font-size:15pt">${peserta.nilai ?? "—"}</b>
    &nbsp; (batas lulus ${passing}) — <b>${peserta.nilai === null ? "belum dinilai" : lulus ? "LULUS" : "BELUM LULUS"}</b></td></tr>
  <tr><th>Benar</th><td>${peserta.benar} butir</td></tr>
  ${peserta.sebagian ? `<tr><th>Benar sebagian</th><td>${peserta.sebagian} butir</td></tr>` : ""}
  <tr><th>Salah</th><td>${peserta.salah} butir</td></tr>
  <tr><th>Tidak dijawab</th><td>${peserta.kosong} butir</td></tr>
  ${peserta.tertunda ? `<tr><th>Menunggu koreksi dosen</th><td>${peserta.tertunda} butir</td></tr>` : ""}
</table>

<h3>B. Rincian jawaban</h3>
<table class="nilai">
  <tr><th>No</th><th>Jenis</th><th>Pertanyaan</th><th>Jawaban</th><th>Hasil</th><th>Poin</th></tr>
  ${baris}
</table>

${peserta.pindahTab > 0 || peserta.keluarFullscreen > 0 ? `
<h3>C. Catatan sistem</h3>
<p>Pindah tab ${peserta.pindahTab}×, keluar layar penuh ${peserta.keluarFullscreen}×.
Catatan ini penanda, bukan putusan.</p>` : ""}

<table class="ttd">
  <tr><td>Dosen Pengampu</td><td>Mahasiswa</td></tr>
  <tr><td class="ruang"></td><td class="ruang"></td></tr>
  <tr><td>(………………………………)</td><td>(${lolos(peserta.nama)})</td></tr>
</table>`;

  return bungkus(`Laporan — ${peserta.nama}`, isi);
}
