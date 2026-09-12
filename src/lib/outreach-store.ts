// ============================================================
// OUS — SISI BASIS DATA
//
// Seluruh perintah SQL sistem outreach berkumpul di sini. Route API tinggal
// memeriksa wewenang lalu memanggil fungsi di bawah; aturan yang menentukan
// boleh/tidaknya sesuatu ada di src/lib/outreach.ts dan tidak menyentuh
// basis data sama sekali.
// ============================================================

import { db } from "@/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  appSettings,
  outreachAudit,
  outreachCampaignRecipients,
  outreachCampaigns,
  outreachEvents,
  outreachRecipients,
  outreachSuppression,
  outreachTemplates,
} from "@/db/schema";
import {
  BATAS,
  DEFAULT_OUS,
  OUS_KEY,
  buatToken,
  kodeKampanye,
  normalkanOus,
  parseOus,
  rapikanEmail,
  type AlasanCekal,
  type KeadaanAntrean,
  type OusState,
  type Penerima,
  type StatusKampanye,
} from "@/lib/outreach";
import { TEMPLATE_BAWAAN, teksBawaan } from "@/lib/outreach-template";

type Baris = Record<string, unknown>;

async function barisDari(perintah: ReturnType<typeof sql>): Promise<Baris[]> {
  const hasil = await db.execute(perintah);
  return (hasil as unknown as { rows?: Baris[] }).rows ?? (hasil as unknown as Baris[]);
}

const angka = (nilai: unknown) => (nilai === null || nilai === undefined ? 0 : Number(nilai));

// ------------------------------------------------------------
// SAKLAR
// ------------------------------------------------------------

/**
 * Membaca pengaturan OUS.
 *
 * SENGAJA GAGAL-TERTUTUP, kebalikan dari mode maintenance. Bila barisnya
 * gagal dibaca, yang dikembalikan adalah keadaan bawaan: saklar MATI, mode
 * simulasi. Satu baris pengaturan yang tidak terbaca tidak boleh berujung
 * pada ratusan surat yang terkirim tanpa ada yang menyetujuinya.
 */
export async function bacaOus(): Promise<OusState> {
  try {
    const baris = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, OUS_KEY))
      .limit(1);
    return parseOus(baris[0]?.value);
  } catch {
    return DEFAULT_OUS;
  }
}

export async function tulisOus(state: OusState): Promise<OusState> {
  const bersih = normalkanOus(state);
  const value = JSON.stringify(bersih);
  await db
    .insert(appSettings)
    .values({ key: OUS_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  return bersih;
}

/**
 * Menandai kapan pengiriman sungguhan pertama terjadi.
 *
 * Dasar hitungan pemanasan. Ditulis SEKALI — pemanggilan berikutnya tidak
 * mengubah apa pun, sebab tanggal mulai yang bergeser berarti jatah harian
 * yang turun kembali ke dua puluh pada hari kesepuluh.
 */
export async function mulaiPemanasan(): Promise<void> {
  const state = await bacaOus();
  if (state.pemanasanMulai) return;
  await tulisOus({ ...state, pemanasanMulai: new Date().toISOString() });
}

// ------------------------------------------------------------
// NASKAH
// ------------------------------------------------------------

/**
 * Menyalin naskah bawaan ke basis data bila belum ada.
 *
 * Dipanggil saat panel dibuka. Yang sudah ada TIDAK ditimpa: pengurus jurnal
 * yang sudah menyunting naskahnya tidak boleh kehilangan suntingannya hanya
 * karena ia membuka panelnya lagi.
 */
export async function pastikanTemplateBawaan(oleh: string): Promise<void> {
  const kode = TEMPLATE_BAWAAN.map((item) => item.kode);
  const ada = await db
    .select({ code: outreachTemplates.code })
    .from(outreachTemplates)
    .where(inArray(outreachTemplates.code, kode));
  const sudah = new Set(ada.map((item) => item.code));
  const kurang = TEMPLATE_BAWAAN.filter((item) => !sudah.has(item.kode));
  if (kurang.length === 0) return;

  await db.insert(outreachTemplates).values(
    kurang.map((item) => ({
      code: item.kode,
      name: item.nama,
      description: item.keterangan,
      subject: item.subjek,
      bodyHtml: item.bodyHtml,
      bodyText: teksBawaan(item.bodyHtml),
      active: true,
      createdBy: oleh.slice(0, 160),
    })),
  ).onConflictDoNothing();
}

export async function daftarTemplate() {
  return db
    .select()
    .from(outreachTemplates)
    .orderBy(desc(outreachTemplates.active), outreachTemplates.name);
}

export async function ambilTemplate(id: number) {
  const baris = await db.select().from(outreachTemplates).where(eq(outreachTemplates.id, id)).limit(1);
  return baris[0] ?? null;
}

export async function simpanTemplate(input: {
  id?: number | null;
  nama: string;
  keterangan: string;
  subjek: string;
  bodyHtml: string;
  bodyText: string;
  aktif: boolean;
  oleh: string;
}) {
  const nilai = {
    name: input.nama.slice(0, 160),
    description: input.keterangan.slice(0, 2000) || null,
    subject: input.subjek.slice(0, 300),
    bodyHtml: input.bodyHtml,
    bodyText: input.bodyText || teksBawaan(input.bodyHtml),
    active: input.aktif,
    updatedAt: new Date(),
  };
  if (input.id) {
    const hasil = await db
      .update(outreachTemplates)
      .set(nilai)
      .where(eq(outreachTemplates.id, input.id))
      .returning({ id: outreachTemplates.id });
    return hasil[0]?.id ?? null;
  }
  const hasil = await db
    .insert(outreachTemplates)
    .values({ ...nilai, createdBy: input.oleh.slice(0, 160) })
    .returning({ id: outreachTemplates.id });
  return hasil[0]?.id ?? null;
}

// ------------------------------------------------------------
// DAFTAR CEKAL
// ------------------------------------------------------------

/**
 * Alamat mana saja dari daftar ini yang sedang dicekal?
 *
 * Menanyakan yang dibutuhkan saja, bukan menarik seluruh daftar cekal ke
 * dalam memori. Daftar cekal hanya bertambah sepanjang umur sistem, dan
 * fungsi yang menariknya utuh akan berhenti muat tanpa ada yang menyangka.
 */
export async function cekalUntuk(emails: string[]): Promise<Map<string, AlasanCekal>> {
  const bersih = [...new Set(emails.map(rapikanEmail).filter(Boolean))];
  if (bersih.length === 0) return new Map();

  // Alasannya ikut dibawa, bukan hanya keanggotaannya. Penerima yang dilewati
  // karena berhenti langganan dan penerima yang dilewati karena alamatnya mati
  // adalah dua hal berbeda, dan riwayat kampanye yang menyamakan keduanya
  // tidak dapat menjelaskan apa pun kepada yang membacanya kemudian.
  const keluar = new Map<string, AlasanCekal>();
  for (let i = 0; i < bersih.length; i += 500) {
    const potongan = bersih.slice(i, i + 500);
    const baris = await db
      .select({ email: outreachSuppression.email, reason: outreachSuppression.reason })
      .from(outreachSuppression)
      .where(inArray(outreachSuppression.email, potongan));
    baris.forEach((item) => keluar.set(item.email, item.reason as AlasanCekal));
  }
  return keluar;
}

export async function daftarCekal(batas = 200) {
  return db
    .select()
    .from(outreachSuppression)
    .orderBy(desc(outreachSuppression.createdAt))
    .limit(Math.min(1000, Math.max(1, batas)));
}

export async function tambahCekal(input: {
  email: string;
  alasan: AlasanCekal;
  sumber?: string | null;
  catatan?: string | null;
}): Promise<boolean> {
  const email = rapikanEmail(input.email);
  if (!email) return false;
  await db
    .insert(outreachSuppression)
    .values({
      email,
      reason: input.alasan,
      source: input.sumber?.slice(0, 160) ?? null,
      note: input.catatan ?? null,
    })
    // Alamat yang sudah dicekal tetap dicekal; alasan pertama yang disimpan,
    // sebab itulah yang menerangkan bagaimana ia masuk ke daftar.
    .onConflictDoNothing({ target: outreachSuppression.email });

  const status = input.alasan === "unsubscribe" ? "unsubscribed" : input.alasan === "invalid" ? "invalid" : "suppressed";
  await db
    .update(outreachRecipients)
    .set({ status, updatedAt: new Date() })
    .where(eq(outreachRecipients.email, email));
  return true;
}

export async function hapusCekal(email: string): Promise<boolean> {
  const bersih = rapikanEmail(email);
  if (!bersih) return false;
  await db.delete(outreachSuppression).where(eq(outreachSuppression.email, bersih));
  await db
    .update(outreachRecipients)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(outreachRecipients.email, bersih));
  return true;
}

// ------------------------------------------------------------
// PENERIMA
// ------------------------------------------------------------

/**
 * Menyimpan penerima dan mengembalikan peta email → id.
 *
 * Kolom pelengkap hanya DIISI, tidak pernah ditimpa dengan kosong: daftar
 * kedua yang hanya berisi alamat tidak boleh menghapus nama dan institusi
 * yang sudah terkumpul dari daftar sebelumnya.
 */
export async function simpanPenerima(daftar: Penerima[]): Promise<Map<string, number>> {
  const peta = new Map<string, number>();
  if (daftar.length === 0) return peta;

  for (let i = 0; i < daftar.length; i += 400) {
    const potongan = daftar.slice(i, i + 400);
    const hasil = await db
      .insert(outreachRecipients)
      .values(
        potongan.map((item) => ({
          email: item.email,
          name: item.name,
          institution: item.institution,
          field: item.field,
          country: item.country,
          unsubscribeToken: buatToken(32),
        })),
      )
      .onConflictDoUpdate({
        target: outreachRecipients.email,
        set: {
          name: sql`coalesce(${outreachRecipients.name}, excluded.name)`,
          institution: sql`coalesce(${outreachRecipients.institution}, excluded.institution)`,
          field: sql`coalesce(${outreachRecipients.field}, excluded.field)`,
          country: sql`coalesce(${outreachRecipients.country}, excluded.country)`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: outreachRecipients.id, email: outreachRecipients.email });
    hasil.forEach((item) => peta.set(item.email, item.id));
  }
  return peta;
}

export async function penerimaDariToken(token: string) {
  const bersih = String(token || "").replace(/[^a-f0-9]/gi, "").slice(0, 64);
  if (bersih.length < 16) return null;
  const baris = await db
    .select()
    .from(outreachRecipients)
    .where(eq(outreachRecipients.unsubscribeToken, bersih))
    .limit(1);
  return baris[0] ?? null;
}

// ------------------------------------------------------------
// KAMPANYE
// ------------------------------------------------------------

export type BuatKampanyeInput = {
  nama: string;
  templateId: number | null;
  subjek: string;
  bodyHtml: string;
  bodyText: string;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  simulasi: boolean;
  penerima: Penerima[];
  pemilik: { id: string; nama: string; peran: string };
};

/**
 * Membuat kampanye beserta seluruh barisan penerimanya.
 *
 * Kampanye lahir dalam keadaan DRAFT, bukan langsung mengantre. Yang
 * memindahkannya ke antrean adalah tindakan terpisah dengan konfirmasi
 * tersendiri — supaya tidak ada kampanye yang berjalan hanya karena
 * seseorang menekan "simpan".
 */
export async function buatKampanye(input: BuatKampanyeInput) {
  const peta = await simpanPenerima(input.penerima);
  const code = await kodeBelumTerpakai();

  const hasil = await db
    .insert(outreachCampaigns)
    .values({
      code,
      name: input.nama.slice(0, 200),
      templateId: input.templateId,
      status: "draft",
      subject: input.subjek.slice(0, 300),
      bodyHtml: input.bodyHtml,
      bodyText: input.bodyText,
      fromName: input.fromName.slice(0, 80),
      fromEmail: input.fromEmail,
      replyTo: input.replyTo,
      simulasi: input.simulasi,
      totalRecipients: peta.size,
      queuedCount: peta.size,
      ownerId: input.pemilik.id.slice(0, 64),
      ownerName: input.pemilik.nama.slice(0, 160),
      ownerRole: input.pemilik.peran.slice(0, 40),
    })
    .returning({ id: outreachCampaigns.id, code: outreachCampaigns.code });

  const kampanye = hasil[0];
  if (!kampanye) throw new Error("Kampanye gagal dibuat.");

  const ids = [...peta.values()];
  for (let i = 0; i < ids.length; i += 400) {
    await db
      .insert(outreachCampaignRecipients)
      .values(
        ids.slice(i, i + 400).map((recipientId) => ({
          campaignId: kampanye.id,
          recipientId,
          status: "queued",
          queuedAt: new Date(),
        })),
      )
      .onConflictDoNothing();
  }
  return kampanye;
}

/** Kode delapan huruf yang belum dipakai kampanye mana pun. */
async function kodeBelumTerpakai(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const kode = kodeKampanye();
    const ada = await db
      .select({ id: outreachCampaigns.id })
      .from(outreachCampaigns)
      .where(eq(outreachCampaigns.code, kode))
      .limit(1);
    if (ada.length === 0) return kode;
  }
  // Delapan kali bertabrakan berarti ada yang jauh lebih salah daripada
  // kodenya; nomor waktu di bawah setidaknya tidak pernah menggagalkan
  // pembuatan kampanye yang penerimanya sudah telanjur tersimpan.
  return `K${Date.now().toString(36).toUpperCase()}`.slice(0, 12);
}

/**
 * Daftar kampanye yang boleh dilihat orang ini.
 *
 * Dosen hanya melihat kampanyenya sendiri. Bukan karena kampanye orang lain
 * rahasia, melainkan karena daftar penerima kampanye lain adalah data pribadi
 * ratusan orang yang tidak ada hubungannya dengan pekerjaannya.
 */
export async function daftarKampanye(pemilik: { id: string; peran: string }, batas = 50) {
  // Syaratnya disusun lebih dulu, bukan ditempelkan sesudah orderBy/limit:
  // penyusun kueri Drizzle menolak where yang datang belakangan, dan
  // penolakannya baru terlihat saat halamannya dibuka.
  const syarat = pemilik.peran === "dosen" ? eq(outreachCampaigns.ownerId, pemilik.id) : undefined;
  return db
    .select({
      id: outreachCampaigns.id,
      code: outreachCampaigns.code,
      name: outreachCampaigns.name,
      status: outreachCampaigns.status,
      simulasi: outreachCampaigns.simulasi,
      subject: outreachCampaigns.subject,
      totalRecipients: outreachCampaigns.totalRecipients,
      queuedCount: outreachCampaigns.queuedCount,
      sentCount: outreachCampaigns.sentCount,
      deliveredCount: outreachCampaigns.deliveredCount,
      failedCount: outreachCampaigns.failedCount,
      bouncedCount: outreachCampaigns.bouncedCount,
      unsubscribedCount: outreachCampaigns.unsubscribedCount,
      ownerName: outreachCampaigns.ownerName,
      ownerRole: outreachCampaigns.ownerRole,
      createdAt: outreachCampaigns.createdAt,
      startedAt: outreachCampaigns.startedAt,
      completedAt: outreachCampaigns.completedAt,
    })
    .from(outreachCampaigns)
    .where(syarat)
    .orderBy(desc(outreachCampaigns.createdAt))
    .limit(Math.min(200, Math.max(1, batas)));
}

export async function ambilKampanye(id: number) {
  const baris = await db.select().from(outreachCampaigns).where(eq(outreachCampaigns.id, id)).limit(1);
  return baris[0] ?? null;
}

export async function penerimaKampanye(id: number, status: string, batas = 200) {
  const syarat = status
    ? and(eq(outreachCampaignRecipients.campaignId, id), eq(outreachCampaignRecipients.status, status))
    : eq(outreachCampaignRecipients.campaignId, id);

  return db
    .select({
      id: outreachCampaignRecipients.id,
      email: outreachRecipients.email,
      name: outreachRecipients.name,
      institution: outreachRecipients.institution,
      status: outreachCampaignRecipients.status,
      attempts: outreachCampaignRecipients.attempts,
      errorCode: outreachCampaignRecipients.errorCode,
      errorMessage: outreachCampaignRecipients.errorMessage,
      sentAt: outreachCampaignRecipients.sentAt,
      deliveredAt: outreachCampaignRecipients.deliveredAt,
    })
    .from(outreachCampaignRecipients)
    .innerJoin(outreachRecipients, eq(outreachRecipients.id, outreachCampaignRecipients.recipientId))
    .where(syarat)
    .orderBy(outreachCampaignRecipients.id)
    .limit(Math.min(1000, Math.max(1, batas)));
}

/**
 * Memindahkan kampanye ke keadaan lain.
 *
 * Pembatalan ikut membatalkan seluruh penerima yang MASIH mengantre — dan
 * hanya yang mengantre. Surat yang sudah keluar tidak dapat ditarik kembali,
 * dan menandainya "dibatalkan" hanya akan membuat catatannya berbohong.
 */
export async function ubahStatusKampanye(id: number, status: StatusKampanye) {
  const nilai: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === "sending") nilai.startedAt = sql`coalesce(${outreachCampaigns.startedAt}, now())`;
  if (status === "completed" || status === "cancelled") nilai.completedAt = new Date();

  await db.update(outreachCampaigns).set(nilai).where(eq(outreachCampaigns.id, id));

  if (status === "cancelled") {
    await db
      .update(outreachCampaignRecipients)
      .set({ status: "cancelled" })
      .where(and(eq(outreachCampaignRecipients.campaignId, id), eq(outreachCampaignRecipients.status, "queued")));
    await segarkanHitung(id);
  }
}

/**
 * Menghitung ulang seluruh penghitung kampanye dari barisan penerimanya.
 *
 * Dijalankan sesudah tiap putaran pekerja dan tiap webhook. Penghitung yang
 * dinaikkan satu per satu akan melenceng cepat atau lambat — satu putaran
 * yang gagal di tengah sudah cukup — dan yang membaca angka itu adalah orang
 * yang memutuskan apakah kampanyenya berjalan baik.
 */
export async function segarkanHitung(id: number) {
  const baris = await barisDari(sql`
    select
      count(*)                                             as total,
      count(*) filter (where status in ('queued','sending')) as antre,
      count(*) filter (where status = 'sent')                as terkirim,
      count(*) filter (where status = 'delivered')           as sampai,
      count(*) filter (where status = 'failed')              as gagal,
      count(*) filter (where status = 'bounced')             as pantul,
      count(*) filter (where status = 'unsubscribed')        as berhenti
    from outreach_campaign_recipients
    where campaign_id = ${id}
  `);
  const hitung = baris[0] || {};
  const antre = angka(hitung.antre);

  await db
    .update(outreachCampaigns)
    .set({
      totalRecipients: angka(hitung.total),
      queuedCount: antre,
      sentCount: angka(hitung.terkirim),
      deliveredCount: angka(hitung.sampai),
      failedCount: angka(hitung.gagal),
      bouncedCount: angka(hitung.pantul),
      unsubscribedCount: angka(hitung.berhenti),
      updatedAt: new Date(),
      // Kampanye yang antreannya habis selesai dengan sendirinya. Tidak ada
      // tombol "tandai selesai", sebab tombol itu pasti lupa ditekan.
      ...(antre === 0
        ? { status: sql`case when ${outreachCampaigns.status} = 'sending' then 'completed' else ${outreachCampaigns.status} end`,
            completedAt: sql`coalesce(${outreachCampaigns.completedAt}, case when ${outreachCampaigns.status} = 'sending' then now() else null end)` }
        : {}),
    })
    .where(eq(outreachCampaigns.id, id));

  return { antre, total: angka(hitung.total) };
}

// ------------------------------------------------------------
// ANTREAN
// ------------------------------------------------------------

/**
 * Berapa banyak yang sudah benar-benar terkirim belakangan ini.
 *
 * Kampanye SIMULASI tidak dihitung, dan itu disengaja: jatah harian ada untuk
 * menjaga reputasi domain, dan surat yang tidak pernah keluar tidak menyentuh
 * reputasi apa pun. Gladi bersih tiga ratus alamat karena itu tidak
 * menghanguskan jatah kirim hari itu.
 */
export async function keadaanAntrean(): Promise<KeadaanAntrean> {
  const baris = await barisDari(sql`
    select
      count(*)                                                        as hari,
      count(*) filter (where cr.sent_at >= now() - interval '1 hour') as jam,
      extract(epoch from (now() - max(cr.sent_at)))::int              as sejak
    from outreach_campaign_recipients cr
    join outreach_campaigns k on k.id = cr.campaign_id
    where cr.sent_at >= now() - interval '24 hours'
      and k.simulasi = false
  `);
  const isi = baris[0] || {};
  const sejak = isi.sejak === null || isi.sejak === undefined ? null : Number(isi.sejak);
  return {
    hariIni: angka(isi.hari),
    jamIni: angka(isi.jam),
    sejakTerakhir: Number.isFinite(sejak as number) ? (sejak as number) : null,
  };
}

export type Klaim = {
  id: number;
  campaignId: number;
  attempts: number;
  email: string;
  name: string | null;
  institution: string | null;
  field: string | null;
  country: string | null;
  unsubscribeToken: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  simulasi: boolean;
  campaignCode: string;
};

/**
 * Mengambil sejumlah surat dari antrean, dan MENGUNCINYA.
 *
 * Inilah bagian yang menentukan apakah seorang penerima dapat menerima surat
 * yang sama dua kali. Dua pekerja yang berjalan bersamaan — cron dan tombol
 * di panel, misalnya — akan membaca antrean yang sama persis bila
 * pengambilannya tidak atomik.
 *
 * "FOR UPDATE SKIP LOCKED" menyelesaikannya di dalam basis data: baris yang
 * sedang dipegang pekerja lain dilewati, bukan ditunggu. Yang kedua
 * mendapatkan sepuluh baris berikutnya, bukan sepuluh baris yang sama.
 *
 * Statusnya langsung dipindahkan ke "sending" dalam perintah yang sama,
 * sehingga jendela antara "dibaca" dan "ditandai" tidak ada sama sekali.
 */
export async function klaimAntrean(batas: number): Promise<Klaim[]> {
  const jumlah = Math.max(1, Math.min(50, Math.floor(batas)));
  const baris = await barisDari(sql`
    with dipilih as (
      select cr.id
      from outreach_campaign_recipients cr
      join outreach_campaigns k on k.id = cr.campaign_id
      where cr.status = 'queued'
        and (cr.next_attempt_at is null or cr.next_attempt_at <= now())
        and k.status = 'sending'
      order by cr.next_attempt_at nulls first, cr.id
      limit ${jumlah}
      for update of cr skip locked
    )
    update outreach_campaign_recipients cr
    set status = 'sending', attempts = cr.attempts + 1
    from dipilih d, outreach_recipients p, outreach_campaigns k
    where cr.id = d.id
      and p.id = cr.recipient_id
      and k.id = cr.campaign_id
    returning
      cr.id, cr.campaign_id, cr.attempts,
      p.email, p.name, p.institution, p.field, p.country, p.unsubscribe_token,
      k.subject, k.body_html, k.body_text, k.from_name, k.from_email, k.reply_to,
      k.simulasi, k.code as campaign_code
  `);

  return baris.map((item) => ({
    id: Number(item.id),
    campaignId: Number(item.campaign_id),
    attempts: Number(item.attempts),
    email: String(item.email),
    name: (item.name as string | null) ?? null,
    institution: (item.institution as string | null) ?? null,
    field: (item.field as string | null) ?? null,
    country: (item.country as string | null) ?? null,
    unsubscribeToken: String(item.unsubscribe_token),
    subject: String(item.subject),
    bodyHtml: String(item.body_html),
    bodyText: (item.body_text as string | null) ?? null,
    fromName: String(item.from_name),
    fromEmail: String(item.from_email),
    replyTo: (item.reply_to as string | null) ?? null,
    simulasi: Boolean(item.simulasi),
    campaignCode: String(item.campaign_code),
  }));
}

/**
 * Mengembalikan baris yang telanjur diklaim ke antrean.
 *
 * Dipakai ketika pekerja berhenti di tengah karena jatahnya habis. Tanpa ini,
 * surat yang sudah ditandai "sending" akan tergantung di sana selamanya —
 * tidak terkirim, dan tidak pernah diambil lagi oleh siapa pun.
 */
export async function kembalikanKeAntrean(ids: number[]) {
  if (ids.length === 0) return;
  await db
    .update(outreachCampaignRecipients)
    .set({ status: "queued", attempts: sql`greatest(0, ${outreachCampaignRecipients.attempts} - 1)` })
    .where(inArray(outreachCampaignRecipients.id, ids));
}

export async function tandaiTerkirim(id: number, messageId: string | null) {
  await db
    .update(outreachCampaignRecipients)
    .set({
      status: "sent",
      providerMessageId: messageId?.slice(0, 200) ?? null,
      sentAt: new Date(),
      errorCode: null,
      errorMessage: null,
      nextAttemptAt: null,
    })
    .where(eq(outreachCampaignRecipients.id, id));
}

export async function tandaiGagal(id: number, kode: string, pesan: string) {
  await db
    .update(outreachCampaignRecipients)
    .set({
      status: "failed",
      errorCode: kode.slice(0, 60),
      errorMessage: pesan.slice(0, 2000),
      failedAt: new Date(),
      nextAttemptAt: null,
    })
    .where(eq(outreachCampaignRecipients.id, id));
}

/** Dikembalikan ke antrean dengan tenggang, untuk galat yang sesaat. */
export async function tundaCobaUlang(id: number, jedaMs: number, kode: string, pesan: string) {
  await db
    .update(outreachCampaignRecipients)
    .set({
      status: "queued",
      errorCode: kode.slice(0, 60),
      errorMessage: pesan.slice(0, 2000),
      nextAttemptAt: new Date(Date.now() + jedaMs),
    })
    .where(eq(outreachCampaignRecipients.id, id));
}

/** Penerima yang ternyata sudah dicekal sesudah kampanye dibuat. */
export async function tandaiTercekal(id: number, alasan: AlasanCekal) {
  await db
    .update(outreachCampaignRecipients)
    .set({
      status: alasan === "unsubscribe" ? "unsubscribed" : "cancelled",
      errorCode: alasan,
      errorMessage: "Dilewati: alamat ada di daftar cekal.",
      nextAttemptAt: null,
    })
    .where(eq(outreachCampaignRecipients.id, id));
}

// ------------------------------------------------------------
// PERISTIWA PENYEDIA
// ------------------------------------------------------------

/** Baris penerima yang cocok dengan nomor pesan dari penyedia. */
export async function penerimaDariPesan(messageId: string) {
  const bersih = String(messageId || "").slice(0, 200);
  if (!bersih) return null;
  const baris = await db
    .select({
      id: outreachCampaignRecipients.id,
      campaignId: outreachCampaignRecipients.campaignId,
      email: outreachRecipients.email,
      status: outreachCampaignRecipients.status,
    })
    .from(outreachCampaignRecipients)
    .innerJoin(outreachRecipients, eq(outreachRecipients.id, outreachCampaignRecipients.recipientId))
    .where(eq(outreachCampaignRecipients.providerMessageId, bersih))
    .limit(1);
  return baris[0] ?? null;
}

/**
 * Mencatat satu peristiwa penyedia.
 *
 * Mengembalikan false bila peristiwanya sudah pernah dicatat. Penyedia
 * mengirim ulang webhook yang belum dijawab 200, dan tanpa pemeriksaan ini
 * satu pantulan yang sama akan terhitung lima kali di kartu statistik.
 */
export async function catatPeristiwa(input: {
  penerimaKampanyeId: number | null;
  eventId: string | null;
  jenis: string;
  muatan: unknown;
}): Promise<boolean> {
  const hasil = await db
    .insert(outreachEvents)
    .values({
      campaignRecipientId: input.penerimaKampanyeId,
      providerEventId: input.eventId?.slice(0, 200) ?? null,
      eventType: input.jenis.slice(0, 40),
      payload: JSON.stringify(input.muatan ?? null).slice(0, 20_000),
    })
    .onConflictDoNothing({ target: outreachEvents.providerEventId })
    .returning({ id: outreachEvents.id });
  return hasil.length > 0;
}

export async function ubahStatusPenerimaKampanye(id: number, status: string) {
  const nilai: Record<string, unknown> = { status };
  if (status === "delivered") nilai.deliveredAt = new Date();
  if (status === "bounced") nilai.failedAt = new Date();
  await db.update(outreachCampaignRecipients).set(nilai).where(eq(outreachCampaignRecipients.id, id));
}

// ------------------------------------------------------------
// BERHENTI LANGGANAN
// ------------------------------------------------------------

/**
 * Memproses satu penekanan tautan berhenti langganan.
 *
 * Tiga hal sekaligus, dan ketiganya harus terjadi: alamatnya masuk daftar
 * cekal (sehingga kampanye MENDATANG melewatinya), statusnya berubah, dan
 * seluruh barisnya yang MASIH mengantre di kampanye mana pun dibatalkan.
 *
 * Yang ketiga sering terlupa, dan akibatnya paling terasa: orang yang menekan
 * "berhenti" lalu tetap menerima surat esok harinya karena suratnya sudah
 * telanjur mengantre sejak kemarin.
 */
export async function berhentiLangganan(token: string, sumber = "tautan berhenti") {
  const penerima = await penerimaDariToken(token);
  if (!penerima) return null;

  await tambahCekal({ email: penerima.email, alasan: "unsubscribe", sumber, catatan: null });

  await db
    .update(outreachCampaignRecipients)
    .set({ status: "unsubscribed", nextAttemptAt: null })
    .where(
      and(
        eq(outreachCampaignRecipients.recipientId, penerima.id),
        inArray(outreachCampaignRecipients.status, ["queued", "sending"]),
      ),
    );

  return penerima;
}

// ------------------------------------------------------------
// JEJAK
// ------------------------------------------------------------

export async function catatAudit(input: {
  pelaku: { id: string; nama: string; peran: string } | null;
  tindakan: string;
  jenis?: string | null;
  nomor?: number | null;
  keterangan?: unknown;
}) {
  try {
    await db.insert(outreachAudit).values({
      actorId: input.pelaku?.id.slice(0, 64) ?? null,
      actorName: input.pelaku?.nama.slice(0, 160) ?? null,
      actorRole: input.pelaku?.peran.slice(0, 40) ?? null,
      action: input.tindakan.slice(0, 60),
      resourceType: input.jenis?.slice(0, 40) ?? null,
      resourceId: input.nomor ?? null,
      metadata: input.keterangan === undefined ? null : JSON.stringify(input.keterangan).slice(0, 4000),
    });
  } catch (galat) {
    // Jejak bersifat pelengkap: kegagalan menulisnya tidak boleh membatalkan
    // tindakan yang sudah berhasil dikerjakan.
    console.error("catat audit outreach", galat);
  }
}

export async function daftarAudit(batas = 50) {
  return db
    .select()
    .from(outreachAudit)
    .orderBy(desc(outreachAudit.createdAt))
    .limit(Math.min(200, Math.max(1, batas)));
}

// ------------------------------------------------------------
// RINGKASAN UNTUK PANEL
// ------------------------------------------------------------

export async function ringkasanOus() {
  const [antrean, cekal] = await Promise.all([
    keadaanAntrean(),
    db.select({ jumlah: sql<number>`count(*)` }).from(outreachSuppression),
  ]);
  const menunggu = await barisDari(sql`
    select count(*) as jumlah
    from outreach_campaign_recipients cr
    join outreach_campaigns k on k.id = cr.campaign_id
    where cr.status in ('queued','sending') and k.status in ('sending','paused','queued')
  `);
  return {
    terkirim24Jam: antrean.hariIni,
    terkirim1Jam: antrean.jamIni,
    menunggu: angka(menunggu[0]?.jumlah),
    dicekal: angka(cekal[0]?.jumlah),
    batasPenerima: BATAS.penerimaPerKampanye,
  };
}

/**
 * Token berhenti langganan milik sebuah alamat, dibuatkan bila belum ada.
 *
 * Dipakai surat uji. Surat uji memakai token SUNGGUHAN, bukan token
 * karangan — kalau tautan berhentinya tidak benar-benar berfungsi, justru
 * pada surat ujilah hal itu harus ketahuan.
 */
export async function tokenPenerima(email: string): Promise<{ id: number; token: string } | null> {
  const bersih = rapikanEmail(email);
  if (!bersih) return null;
  await simpanPenerima([{ email: bersih, name: null, institution: null, field: null, country: null }]);
  const baris = await db
    .select({ id: outreachRecipients.id, token: outreachRecipients.unsubscribeToken })
    .from(outreachRecipients)
    .where(eq(outreachRecipients.email, bersih))
    .limit(1);
  return baris[0] ?? null;
}
