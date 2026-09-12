// ============================================================
// NASKAH SURAT BAWAAN OUS
//
// Yang disimpan di sini hanyalah KEADAAN AWAL. Begitu template disalin ke
// basis data, pengurus jurnal menyuntingnya dari panel dan berkas ini tidak
// lagi menentukan apa pun — persis seperti kamus template soal CBT.
//
// ------------------------------------------------------------
// TENTANG ISI SURATNYA
// ------------------------------------------------------------
// Naskah di bawah sengaja ditulis DATAR. Tidak ada janji terindeks di mana
// pun, tidak ada tenggat palsu, tidak ada angka penerimaan, tidak ada
// penyebutan biaya. Bukan karena hal-hal itu terlarang, melainkan karena
// tidak satu pun di antaranya dapat diverifikasi dari dalam kode ini — dan
// undangan jurnal yang memuat klaim yang keliru jauh lebih merusak nama
// jurnalnya daripada undangan yang tidak memuat klaim apa pun.
//
// Sebelum kampanye pertama, pengurus jurnal WAJIB menyesuaikan wording,
// nomor terbitan, dan kebijakan biaya dengan keterangan resmi NYIMAK yang
// sedang berlaku. Panel menampilkan peringatan ini di atas daftar template,
// bukan sebagai catatan kaki.
//
// ------------------------------------------------------------
// KENAPA BENTUK HTML-NYA SESEDERHANA INI
// ------------------------------------------------------------
// Tidak ada tabel tata letak, tidak ada gambar tajuk, tidak ada tombol
// berwarna. Surat undangan akademik yang berbentuk halaman promosi adalah
// salah satu penanda yang paling cepat dikenali penyaring, dan penerimanya —
// dosen dan peneliti — justru membaca surat yang terlihat seperti surat.
// ============================================================

import { keTeksBiasa } from "@/lib/outreach";

export type TemplateBawaan = {
  kode: string;
  nama: string;
  keterangan: string;
  subjek: string;
  bodyHtml: string;
};

/** Catatan kaki wajib: alasan menerima surat + tautan berhenti langganan. */
export const KAKI_WAJIB = `<hr style="border:none;border-top:1px solid #dddddd;margin:26px 0 14px">
<p style="font-size:12px;color:#666666;line-height:1.6;margin:0">
  You are receiving this message because your published work is publicly
  listed in the field of communication or media studies. If this invitation
  is not relevant to you, we apologise for the intrusion — you may
  <a href="{{unsubscribe_url}}" style="color:#666666">unsubscribe here</a>
  and you will not be contacted again.
</p>`;

/** Tanda tangan yang sama untuk seluruh naskah, supaya pengirimnya konsisten. */
const TANDA_TANGAN = `<p style="margin:0 0 18px">
  Warm regards,<br>
  {{sender_name|Editorial Team}}<br>
  {{journal_name}}<br>
  Faculty of Social and Political Sciences<br>
  Universitas Muhammadiyah Tangerang, Indonesia
</p>`;

/** Ajakan tunggal. Satu tautan, bukan tiga — lihat pemeriksa nada. */
const AJAKAN = `<p style="margin:0 0 18px">
  Submissions and full author guidelines:<br>
  <a href="{{submission_url}}">{{submission_url}}</a>
</p>`;

export const TEMPLATE_BAWAAN: TemplateBawaan[] = [
  {
    kode: "nyimak-cfp",
    nama: "General Call for Papers",
    keterangan:
      "Undangan umum. Dipakai bila daftar penerimanya belum terpilah per bidang — paling aman untuk kampanye pertama.",
    subjek: "Invitation to Submit Your Research to NYIMAK",
    bodyHtml: `<p style="margin:0 0 18px">Dear {{name}},</p>

<p style="margin:0 0 18px">
  We are pleased to invite you to consider submitting your recent research to
  {{journal_name}}, a peer-reviewed, open-access journal published by the
  Faculty of Social and Political Sciences, Universitas Muhammadiyah
  Tangerang, Indonesia.
</p>

<p style="margin:0 0 18px">
  The journal welcomes original research in communication studies, digital
  media, journalism, public relations, political communication, media and
  culture, and strategic communication. Manuscripts are reviewed by
  specialists in the relevant area, and authors receive substantive comments
  regardless of the outcome.
</p>

<p style="margin:0 0 18px">
  If you have a manuscript that aligns with the journal's scope, we would be
  glad to consider it for an upcoming issue.
</p>

${AJAKAN}

<p style="margin:0 0 18px">Thank you for your time and consideration.</p>

${TANDA_TANGAN}

${KAKI_WAJIB}`,
  },
  {
    kode: "nyimak-internasional",
    nama: "International Researchers",
    keterangan:
      "Untuk penerima di luar Indonesia. Menyebut institusi dan negara penerima, sehingga kolom institution/country pada CSV terpakai.",
    subjek: "Call for Papers — NYIMAK: Journal of Communication",
    bodyHtml: `<p style="margin:0 0 18px">Dear {{name}},</p>

<p style="margin:0 0 18px">
  I am writing from the editorial team of {{journal_name}}, a peer-reviewed,
  open-access journal published by Universitas Muhammadiyah Tangerang,
  Indonesia. We are currently inviting contributions from researchers working
  in communication and media studies, and your work at
  {{institution|your institution}} came to our attention.
</p>

<p style="margin:0 0 18px">
  The journal publishes empirical and theoretical work in English and
  Indonesian. We are particularly interested in comparative and regional
  studies, including research situated in {{country|Southeast Asia}} and the
  wider Asia-Pacific.
</p>

${AJAKAN}

<p style="margin:0 0 18px">
  If the journal is not a suitable venue for your current work, we would still
  be grateful for any suggestion of colleagues for whom it might be.
</p>

${TANDA_TANGAN}

${KAKI_WAJIB}`,
  },
  {
    kode: "nyimak-bidang",
    nama: "Per Bidang Penelitian",
    keterangan:
      "Menyebut bidang penelitian penerima secara langsung. Hanya pakai bila kolom field pada daftar penerima benar-benar terisi.",
    subjek: "Invitation for Researchers in Communication and Media",
    bodyHtml: `<p style="margin:0 0 18px">Dear {{name}},</p>

<p style="margin:0 0 18px">
  We are inviting submissions for an upcoming issue of {{journal_name}}, and
  we are especially looking for work in
  {{field|communication and media studies}}.
</p>

<p style="margin:0 0 18px">
  {{journal_name}} is a peer-reviewed, open-access journal published by
  Universitas Muhammadiyah Tangerang, Indonesia. Research articles, systematic
  reviews, and well-developed case studies are all within scope.
</p>

${AJAKAN}

<p style="margin:0 0 18px">
  We would be glad to answer any question about scope or format before you
  prepare a submission — simply reply to this message.
</p>

${TANDA_TANGAN}

${KAKI_WAJIB}`,
  },
  {
    kode: "nyimak-susulan",
    nama: "Follow-up (Gentle Reminder)",
    keterangan:
      "Surat kedua, dikirim beberapa hari sesudah surat pertama. JANGAN dikirim lebih dari sekali kepada penerima yang sama.",
    subjek: "A short follow-up from NYIMAK: Journal of Communication",
    bodyHtml: `<p style="margin:0 0 18px">Dear {{name}},</p>

<p style="margin:0 0 18px">
  A short while ago we wrote to invite you to submit your work to
  {{journal_name}}. As the call for our upcoming issue is still open, we
  wanted to send one brief reminder in case the earlier message arrived at a
  busy time.
</p>

<p style="margin:0 0 18px">
  This is the last message we will send about this call.
</p>

${AJAKAN}

${TANDA_TANGAN}

${KAKI_WAJIB}`,
  },
];

/**
 * Membungkus badan surat menjadi dokumen HTML yang utuh.
 *
 * Yang disunting pengurus jurnal hanyalah ISI-nya; kerangka di bawah selalu
 * sama, sehingga tidak ada kampanye yang terkirim tanpa charset, tanpa lebar
 * maksimum, atau dengan gaya huruf yang berbeda-beda dari kampanye ke
 * kampanye. Identitas pengirim yang konsisten ikut dibangun dari hal sekecil
 * ini.
 */
export function rangkaEmail(isi: string, judul = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${judul.replace(/[<>&]/g, "")}</title>
</head>
<body style="margin:0;padding:24px 16px;background:#ffffff;color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.65">
<div style="max-width:600px;margin:0 auto">
${isi}
</div>
</body>
</html>`;
}

/**
 * Menjamin surat selalu membawa tautan berhenti langganan.
 *
 * Panel sudah menolak naskah yang kehilangan tautannya, tetapi penjagaan di
 * layar tidak pernah cukup: naskah dapat masuk lewat jalur lain, dan surat
 * outreach tanpa jalan keluar adalah pelanggaran yang menghanguskan reputasi
 * domain sekaligus melanggar syarat setiap penyedia. Di sinilah ia ditambal,
 * sebagai jaring terakhir sebelum suratnya keluar.
 */
export function pastikanKakiBerhenti(html: string): string {
  if (/\{\{\s*unsubscribe_url\s*\}\}/i.test(html)) return html;
  return `${html}\n${KAKI_WAJIB}`;
}

/** Versi teks biasa bawaan sebuah template. */
export function teksBawaan(bodyHtml: string): string {
  return keTeksBiasa(bodyHtml);
}
