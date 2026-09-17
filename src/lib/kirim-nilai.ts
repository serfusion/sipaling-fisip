// ============================================================
// MENGIRIM LAPORAN NILAI KE MAHASISWA
//
// Satu surat berisi nilai akhir, rincian rubrik, dan umpan balik dosen.
// Dikirim HANYA sesudah dosen menyetujui — tidak pernah ketika model selesai
// menilai.
//
// Perbedaan itu yang paling penting di seluruh berkas ini. Nilai yang terkirim
// tidak dapat ditarik kembali: mahasiswa sudah membacanya, sudah mengabarkan
// orang tuanya, dan sudah membandingkannya dengan teman sekelasnya. Surat yang
// dikirim ketika model selesai berarti mengirimkan pembacaan awal sebagai
// keputusan akhir — dan yang menanggung akibat koreksinya adalah dosen yang
// harus menerangkan kenapa nilainya turun.
//
// ------------------------------------------------------------
// APA YANG TIDAK IKUT DIKIRIM
// ------------------------------------------------------------
// Angka kemiripan dan hasil pembacaan rekaman TIDAK pernah masuk ke surat
// mahasiswa, walaupun keduanya ada di laporan dosen. Keduanya indikasi yang
// masih menunggu pemeriksaan manusia, dan mengirimkannya sebagai angka kepada
// orang yang menjadi pokoknya adalah tuduhan yang dikeluarkan mesin — persis
// hal yang seluruh rancangan ini berusaha hindari.
//
// Kalau memang ada persoalan integritas, yang menyampaikannya dosen, dengan
// kalimatnya sendiri, kepada orangnya.
// ============================================================

import { db } from "@/db";
import { cbtAnswers, cbtAttempts, cbtExams, cbtResultEmails } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { bacaLembar, rubrikUjian, skorRubrikAttempt, soalUjian } from "@/lib/cbt-store";
import { hitungRubrik, predikat } from "@/lib/rubrik";
import { asalPortal, kirimSurat, penyediaTerpasang } from "@/lib/outreach-kirim";
import { jamIndonesia } from "@/lib/waktu-indonesia";
import { lolos } from "@/lib/cetak-cbt";

export type HasilKirimNilai = {
  terkirim: boolean;
  pesan: string;
  email: string;
};

/** Nama dan alamat pengirim. Dapat disetel; ada bawaan yang masuk akal. */
function pengirim() {
  const nama = process.env.CBT_EMAIL_NAMA || process.env.OUTREACH_FROM_NAME || "Ujian Online";
  const alamat = process.env.CBT_EMAIL_DARI || process.env.OUTREACH_FROM_EMAIL || "";
  return { nama, alamat };
}

/**
 * Rangka surat: satu tabel, tanpa gambar, tanpa skrip.
 *
 * Sengaja sederhana. Surat nilai dibuka di ponsel, lewat aplikasi email
 * bawaan, pada jaringan yang lambat — dan rangka yang rumit akan berantakan di
 * salah satu dari puluhan aplikasi yang dipakai satu kelas.
 */
function rangka(isi: string, judul: string): string {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${lolos(judul)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2a37;">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e6eb;">
<tr><td style="padding:26px 28px;">${isi}</td></tr>
</table>
<p style="max-width:600px;margin:16px auto 0;color:#8a95a1;font-size:11.5px;line-height:1.6;text-align:center;">
Surat ini dikirim otomatis oleh sistem ujian. Bila ada yang perlu ditanyakan mengenai nilai,
hubungi dosen pengampu mata kuliah — bukan membalas surat ini.
</p></body></html>`;
}

function keTeks(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-3]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Susun dan kirim satu laporan nilai.
 *
 * Mengembalikan keterangan, bukan melempar galat, untuk setiap kegagalan yang
 * DAPAT DIPERKIRAKAN: alamat email kosong, nilainya belum disetujui, penyedia
 * surat belum terpasang. Ketiganya keadaan yang wajar dan yang dosennya perlu
 * BACA, bukan galat 500 yang menyuruhnya menebak.
 */
export async function kirimLaporanNilai(input: {
  attemptId: number;
  examId: number;
  dikirimOleh: string;
  /** Kirim walau sudah pernah terkirim. Dipakai tombol "kirim ulang". */
  paksa?: boolean;
}): Promise<HasilKirimNilai> {
  const baris = await db
    .select()
    .from(cbtAttempts)
    .where(and(eq(cbtAttempts.id, input.attemptId), eq(cbtAttempts.examId, input.examId)))
    .limit(1);
  const attempt = baris[0];
  if (!attempt) return { terkirim: false, pesan: "Peserta tidak ditemukan.", email: "" };

  if (!attempt.approvedAt) {
    return {
      terkirim: false,
      pesan: "Nilainya belum disetujui. Tekan SETUJUI dulu — surat hanya dikirim untuk nilai yang sudah final.",
      email: attempt.email || "",
    };
  }

  const email = (attempt.email || "").trim();
  if (!email) {
    return {
      terkirim: false,
      pesan:
        "Peserta ini tidak punya alamat email. Isi kolom email pada daftar mahasiswa " +
        "(menu Data Mahasiswa), lalu kirim ulang.",
      email: "",
    };
  }

  if (attempt.reportSentAt && !input.paksa) {
    return {
      terkirim: false,
      pesan: `Laporan sudah pernah dikirim pada ${jamIndonesia(attempt.reportSentAt)}. Pakai "kirim ulang" bila memang perlu.`,
      email,
    };
  }

  const dari = pengirim();
  if (!dari.alamat) {
    return {
      terkirim: false,
      pesan:
        "Alamat pengirim belum disetel. Isi CBT_EMAIL_DARI (atau OUTREACH_FROM_EMAIL) " +
        "pada environment, lalu deploy ulang.",
      email,
    };
  }

  const ujianBaris = await db.select().from(cbtExams).where(eq(cbtExams.id, input.examId)).limit(1);
  const ujian = ujianBaris[0];
  if (!ujian) return { terkirim: false, pesan: "Ujian tidak ditemukan.", email };

  // ---------- SUSUN ISINYA ----------
  const nilai = attempt.finalScore ?? attempt.score ?? 0;
  const pred = predikat(nilai);
  const lulus = nilai >= ujian.passingGrade;

  const rubrik = await rubrikUjian(ujian.rubricId);
  const bank = await soalUjian(input.examId);
  const lembar = bacaLembar(attempt.paper);
  const jawaban = await db.select().from(cbtAnswers).where(eq(cbtAnswers.attemptId, attempt.id));
  const petaJawab = new Map(jawaban.map((j) => [j.questionId, j]));
  const skor = await skorRubrikAttempt(attempt.id);

  const bagian: string[] = [];
  bagian.push(`<h1 style="margin:0 0 4px;font-size:19px;color:#111827;">Hasil Ujian</h1>`);
  bagian.push(
    `<p style="margin:0 0 18px;color:#6b7280;font-size:13px;">${lolos(ujian.courseName)}${ujian.className ? ` · ${lolos(ujian.className)}` : ""}</p>`,
  );
  bagian.push(
    `<p style="margin:0 0 16px;font-size:14px;line-height:1.65;">Halo <b>${lolos(attempt.name)}</b> (${lolos(attempt.nim)}),<br>` +
      `berikut hasil <b>${lolos(ujian.title)}</b> yang sudah diperiksa dan disetujui dosen pengampu.</p>`,
  );

  // Kotak nilai.
  bagian.push(
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;border-collapse:separate;">` +
      `<tr><td style="padding:18px;border-radius:10px;background:${lulus ? "#f0fdf4" : "#fef2f2"};border:1px solid ${lulus ? "#bbf7d0" : "#fecaca"};text-align:center;">` +
      `<div style="font-size:38px;font-weight:800;line-height:1;color:${lulus ? "#15803d" : "#b91c1c"};">${nilai}</div>` +
      `<div style="margin-top:6px;font-size:13px;font-weight:700;color:#374151;">${lolos(pred.huruf)} — ${lolos(pred.sebutan)}</div>` +
      `<div style="margin-top:4px;font-size:12px;color:#6b7280;">Batas kelulusan ${ujian.passingGrade} · ${lulus ? "Memenuhi" : "Belum memenuhi"}</div>` +
      `</td></tr></table>`,
  );

  // Rincian rubrik per soal esai, bila memang ada.
  if (rubrik) {
    for (const l of lembar) {
      const soal = bank.find((s) => s.id === l.id);
      if (!soal || soal.jenis !== "essay") continue;
      const j = petaJawab.get(soal.id);
      if (!j || !String(j.answer ?? "").trim()) continue;

      const tersimpan = skor.get(soal.id) ?? [];
      const urut = new Map(tersimpan.map((t) => [t.criterionIndex, t]));
      const hasil = hitungRubrik(
        rubrik,
        rubrik.kriteria.map((_, i) => ({
          aiLevel: urut.get(i)?.aiLevel ?? null,
          finalLevel: urut.get(i)?.finalLevel ?? null,
        })),
      );
      if (hasil.belumDinilai === rubrik.kriteria.length) continue;

      bagian.push(`<h2 style="margin:22px 0 8px;font-size:14px;color:#111827;">${lolos(soal.pertanyaan.slice(0, 160))}</h2>`);
      bagian.push(
        `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:12.5px;">` +
          `<tr style="background:#f9fafb;"><th align="left" style="padding:7px 9px;border:1px solid #e5e7eb;">Kriteria</th>` +
          `<th align="right" style="padding:7px 9px;border:1px solid #e5e7eb;width:58px;">Bobot</th>` +
          `<th align="center" style="padding:7px 9px;border:1px solid #e5e7eb;width:58px;">Level</th></tr>` +
          hasil.kriteria
            .map(
              (k) =>
                `<tr><td style="padding:7px 9px;border:1px solid #e5e7eb;">${lolos(k.nama)}</td>` +
                `<td align="right" style="padding:7px 9px;border:1px solid #e5e7eb;">${k.bobot}%</td>` +
                `<td align="center" style="padding:7px 9px;border:1px solid #e5e7eb;font-weight:700;">${k.level || "–"} / ${rubrik.skalaMax}</td></tr>`,
            )
            .join("") +
          `<tr style="background:#f9fafb;"><td colspan="2" style="padding:7px 9px;border:1px solid #e5e7eb;font-weight:700;">Nilai bagian ini</td>` +
          `<td align="center" style="padding:7px 9px;border:1px solid #e5e7eb;font-weight:800;">${hasil.nilai}</td></tr>` +
          `</table>`,
      );

      if (j.feedback) {
        bagian.push(
          `<div style="margin:10px 0 0;padding:11px 13px;border-radius:8px;background:#f9fafb;border:1px solid #e5e7eb;font-size:12.5px;line-height:1.65;white-space:pre-line;">` +
            `<b style="display:block;margin-bottom:4px;color:#374151;">Catatan</b>${lolos(j.feedback)}</div>`,
        );
      }
    }
  }

  bagian.push(
    `<p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.7;">` +
      `Disetujui oleh <b>${lolos(attempt.approvedBy || "-")}</b><br>` +
      `${lolos(jamIndonesia(attempt.approvedAt))}</p>`,
  );

  const judul = `Hasil ${ujian.title} — ${ujian.courseName}`;
  const html = rangka(bagian.join(""), judul);

  // ---------- KIRIM ----------
  const simulasi = penyediaTerpasang() === "mock";
  const hasil = await kirimSurat(
    {
      // Kunci idempotensi memuat jam persetujuan, bukan hanya nomor attempt.
      // Nilai yang disetujui ulang sesudah dikoreksi memang surat yang BERBEDA,
      // dan kunci yang sama akan membuat penyedia menolaknya diam-diam sebagai
      // kiriman berulang — mahasiswa menerima nilai lamanya, selamanya.
      idem: `cbt-nilai-${attempt.id}-${attempt.approvedAt.getTime()}`,
      from: `${dari.nama} <${dari.alamat}>`,
      to: email,
      replyTo: process.env.CBT_EMAIL_BALAS || null,
      subject: judul,
      html,
      text: keTeks(html),
      headers: {},
    },
    simulasi,
  );

  const sekarang = new Date();
  await db.insert(cbtResultEmails).values({
    attemptId: attempt.id,
    email,
    subject: judul.slice(0, 240),
    status: hasil.ok ? "terkirim" : "gagal",
    error: hasil.ok ? null : `${hasil.kode}: ${hasil.pesan}`.slice(0, 300),
    providerId: hasil.ok ? hasil.messageId.slice(0, 200) : null,
    sentBy: input.dikirimOleh.slice(0, 120),
    createdAt: sekarang,
  });

  if (!hasil.ok) {
    return { terkirim: false, pesan: `Surat gagal dikirim: ${hasil.pesan}`, email };
  }

  await db.update(cbtAttempts).set({ reportSentAt: sekarang }).where(eq(cbtAttempts.id, attempt.id));

  return {
    terkirim: true,
    email,
    pesan: simulasi
      ? `Mode simulasi: surat TIDAK benar-benar dikirim ke ${email}. Pasang OUTREACH_API_KEY untuk mengirim sungguhan.`
      : `Laporan nilai terkirim ke ${email}.`,
  };
}

/** Apakah portal ini sudah dapat mengirim surat sungguhan. */
export function suratSiap(): { siap: boolean; sebab: string } {
  if (!pengirim().alamat) {
    return { siap: false, sebab: "Alamat pengirim belum disetel (CBT_EMAIL_DARI)." };
  }
  if (penyediaTerpasang() === "mock") {
    return { siap: false, sebab: "Penyedia surat belum terpasang (OUTREACH_API_KEY). Kiriman berjalan dalam mode simulasi." };
  }
  return { siap: true, sebab: "" };
}

export { asalPortal };
