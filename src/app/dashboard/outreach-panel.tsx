"use client";

// ============================================================
// PANEL OUTREACH ULTRAMAILER SYSTEM (OUS)
//
// Satu layar untuk pengurus jurnal, Admin, dan Super Admin. Pembagian
// wewenangnya kelihatan dari layarnya, bukan hanya dijaga server:
//
//   Pengurus jurnal (dosen berizin) — menyusun daftar penerima, memilih
//       naskah, mengirim surat uji, menjalankan dan menjeda kampanyenya
//       sendiri. Ia TIDAK melihat kampanye orang lain.
//   Admin — sama, ditambah seluruh kampanye fakultas.
//   Super Admin — semua di atas, ditambah SAKLAR dan pengaturannya: siapa
//       yang boleh memakai, berapa jatah hariannya, dan apakah surat
//       benar-benar keluar atau hanya disimulasikan.
//
// Yang ditegakkan server tetap server. Layar ini hanya berhenti menawarkan
// tombol yang memang akan ditolak.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ALASAN_CEKAL_LABEL,
  BATAS,
  STATUS_KAMPANYE_LABEL,
  STATUS_PENERIMA_LABEL,
  gabungNaskah,
  jatahHariIni,
  peubahDipakai,
  periksaNada,
  perkiraanHari,
  pitaNada,
  ringkasanKampanye,
  type AlasanCekal,
  type OusState,
  type StatusKampanye,
  type StatusPenerima,
} from "@/lib/outreach";
import { rangkaEmail } from "@/lib/outreach-template";
import { sanitizeLetterHtml } from "@/lib/sanitize-html";

type Kesiapan = { siap: boolean; penghalang: string[]; catatan: string[] };
type Ringkasan = {
  terkirim24Jam: number; terkirim1Jam: number; menunggu: number; dicekal: number; batasPenerima: number;
} | null;

type Naskah = {
  id: number; code: string | null; name: string; description: string | null;
  subject: string; bodyHtml: string; bodyText: string | null; active: boolean;
};

type Kampanye = {
  id: number; code: string; name: string; status: string; simulasi: boolean; subject: string;
  totalRecipients: number; queuedCount: number; sentCount: number; deliveredCount: number;
  failedCount: number; bouncedCount: number; unsubscribedCount: number;
  ownerName: string | null; ownerRole: string | null;
  createdAt: string; startedAt: string | null; completedAt: string | null;
};

type PenerimaBaris = {
  id: number; email: string; name: string | null; institution: string | null;
  status: string; attempts: number; errorCode: string | null; errorMessage: string | null;
  sentAt: string | null; deliveredAt: string | null;
};

type Cekal = { id: number; email: string; reason: string; source: string | null; createdAt: string };

type Laporan = {
  total: number; valid: number; duplikat: number; tidakSah: number; tercekal: number;
  contohRusak: string[]; contohTercekal: string[];
  jatahHarian: number; perkiraanHari: number; batasPenerima: number;
};

type Tab = "kampanye" | "naskah" | "cekal" | "pengaturan";

const TAB_LABEL: Record<Tab, string> = {
  kampanye: "Kampanye",
  naskah: "Naskah Surat",
  cekal: "Daftar Cekal",
  pengaturan: "Pengaturan & Saklar",
};

/** Data contoh untuk pratinjau. Sengaja BUKAN data penerima sungguhan. */
const CONTOH = {
  name: "Dr. Amira Rahman",
  institution: "Universiti Malaya",
  field: "Digital Media",
  country: "Malaysia",
};

function waktu(nilai: string | null) {
  if (!nilai) return "-";
  return new Date(nilai).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function OutreachPanel({ role, email }: { role: string; email: string }) {
  const superAdmin = role === "super_admin";

  const [tab, setTab] = useState<Tab>("kampanye");
  const [state, setState] = useState<OusState | null>(null);
  const [kesiapan, setKesiapan] = useState<Kesiapan | null>(null);
  const [penyedia, setPenyedia] = useState("mock");
  const [ringkasan, setRingkasan] = useState<Ringkasan>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");

  const [naskah, setNaskah] = useState<Naskah[]>([]);
  const [kampanye, setKampanye] = useState<Kampanye[]>([]);
  const [cekal, setCekal] = useState<Cekal[]>([]);

  // --- pemuatan -------------------------------------------------------------

  const muatPengaturan = useCallback(async () => {
    const jawaban = await fetch("/api/outreach/settings", { cache: "no-store" });
    const isi = await jawaban.json();
    if (!jawaban.ok || !isi.success) throw new Error(isi.message || "Pengaturan OUS belum dapat dimuat.");
    setState(isi.state);
    setKesiapan(isi.kesiapan);
    setPenyedia(isi.penyedia);
    setRingkasan(isi.ringkasan);
  }, []);

  const muatSemua = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      await muatPengaturan();
      const [n, k, c] = await Promise.all([
        fetch("/api/outreach/templates", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/outreach/campaigns", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/outreach/cekal", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (n.success) setNaskah(n.templates || []);
      if (k.success) setKampanye(k.campaigns || []);
      if (c.success) setCekal(c.suppression || []);
    } catch (sebab: unknown) {
      setGalat(sebab instanceof Error ? sebab.message : "Panel OUS belum dapat dimuat.");
    } finally {
      setMemuat(false);
    }
  }, [muatPengaturan]);

  useEffect(() => {
    const jam = window.setTimeout(() => void muatSemua(), 0);
    return () => window.clearTimeout(jam);
  }, [muatSemua]);

  const adaBerjalan = kampanye.some((item) => item.status === "sending");

  // --- pemutar antrean ------------------------------------------------------
  //
  // Selama ada kampanye yang berjalan DAN layar ini terbuka, panel mengetuk
  // pekerja tiap setengah menit. Inilah yang membuat antrean bergerak pada
  // pemasangan yang penjadwal hariannya hanya satu kali sehari.
  //
  // Ia sengaja tidak memberi tahu apa pun ketika tidak ada yang dikerjakan:
  // kotak pesan yang berkedip tiap tiga puluh detik akan membuat orang
  // menutup layarnya, dan layar yang tertutup berarti antrean yang berhenti.
  const memutar = useRef(false);
  const putar = useCallback(async (diam = true) => {
    if (memutar.current) return;
    memutar.current = true;
    try {
      const jawaban = await fetch("/api/outreach/worker", { method: "POST" });
      const isi = await jawaban.json();
      if (!jawaban.ok || !isi.success) throw new Error(isi.message || "Pekerja antrean gagal dijalankan.");
      if (!diam) {
        setKabar(
          isi.diproses > 0
            ? `Putaran selesai: ${isi.terkirim} terkirim, ${isi.gagal} gagal, ${isi.ditunda} ditunda, ${isi.dilewati} dilewati.`
            : isi.alasanBerhenti,
        );
      }
      if (isi.diproses > 0) {
        const k = await fetch("/api/outreach/campaigns", { cache: "no-store" }).then((r) => r.json());
        if (k.success) setKampanye(k.campaigns || []);
        await muatPengaturan().catch(() => {});
      }
    } catch (sebab: unknown) {
      if (!diam) setGalat(sebab instanceof Error ? sebab.message : "Pekerja antrean gagal dijalankan.");
    } finally {
      memutar.current = false;
    }
  }, [muatPengaturan]);

  useEffect(() => {
    if (!adaBerjalan) return;
    const jam = window.setInterval(() => void putar(true), 30_000);
    return () => window.clearInterval(jam);
  }, [adaBerjalan, putar]);

  const jatah = useMemo(() => (state ? jatahHariIni(state, new Date()) : 0), [state]);

  if (memuat) {
    return <section><div className="dempty">Memuat Outreach Ultramailer…</div></section>;
  }

  return (
    <section className="ous">
      <p className="section-eyebrow">OUTREACH ULTRAMAILER SYSTEM</p>
      <h2 className="dsh-title">Undangan Jurnal · OUS</h2>

      <HeroSaklar
        state={state}
        jatah={jatah}
        ringkasan={ringkasan}
        penyedia={penyedia}
        superAdmin={superAdmin}
        onUbah={async (patch, pesan) => {
          await simpanPengaturan(patch, pesan, setKabar, setGalat, muatPengaturan);
        }}
      />

      {galat && <div className="dsh-error">{galat}</div>}
      {kabar && <div className="dsh-ok">{kabar}</div>}

      {state && !state.enabled && !superAdmin && (
        <div className="dempty">
          <b>Outreach Ultramailer sedang dimatikan.</b>
          <br />
          Hubungi Super Admin bila menu ini memang perlu dinyalakan.
        </div>
      )}

      <div className="ous-tab" role="tablist">
        {(Object.keys(TAB_LABEL) as Tab[])
          .filter((id) => id !== "pengaturan" || superAdmin)
          .map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "aktif" : ""}
              onClick={() => setTab(id)}
            >
              {TAB_LABEL[id]}
            </button>
          ))}
      </div>

      {tab === "kampanye" && state && (
        <TabKampanye
          state={state}
          naskah={naskah}
          kampanye={kampanye}
          emailSaya={email}
          jatah={jatah}
          onSegar={muatSemua}
          onPutar={() => void putar(false)}
          setKabar={setKabar}
          setGalat={setGalat}
        />
      )}

      {tab === "naskah" && state && (
        <TabNaskah state={state} naskah={naskah} onSegar={muatSemua} setKabar={setKabar} setGalat={setGalat} />
      )}

      {tab === "cekal" && (
        <TabCekal cekal={cekal} superAdmin={superAdmin} onSegar={muatSemua} setKabar={setKabar} setGalat={setGalat} />
      )}

      {tab === "pengaturan" && superAdmin && state && (
        <TabPengaturan
          state={state}
          kesiapan={kesiapan}
          penyedia={penyedia}
          onSimpan={async (patch, pesan) => {
            await simpanPengaturan(patch, pesan, setKabar, setGalat, muatPengaturan);
          }}
        />
      )}
    </section>
  );
}

async function simpanPengaturan(
  patch: Partial<OusState>,
  pesan: string,
  setKabar: (v: string) => void,
  setGalat: (v: string) => void,
  muat: () => Promise<void>,
) {
  setGalat("");
  setKabar("");
  try {
    const jawaban = await fetch("/api/outreach/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const isi = await jawaban.json();
    if (!jawaban.ok || !isi.success) throw new Error(isi.message || "Pengaturan belum tersimpan.");
    await muat();
    setKabar(pesan);
  } catch (sebab: unknown) {
    setGalat(sebab instanceof Error ? sebab.message : "Pengaturan belum tersimpan.");
  }
}

// ============================================================
// HERO + SAKLAR
// ============================================================

function HeroSaklar({
  state, jatah, ringkasan, penyedia, superAdmin, onUbah,
}: {
  state: OusState | null;
  jatah: number;
  ringkasan: Ringkasan;
  penyedia: string;
  superAdmin: boolean;
  onUbah: (patch: Partial<OusState>, pesan: string) => Promise<void>;
}) {
  const [sibuk, setSibuk] = useState(false);
  if (!state) return null;

  return (
    <div className="panel">
      <div className="mtp-hero" data-on={state.enabled ? "1" : undefined}>
        <div className="mtp-hero-copy">
          <b>{state.enabled ? "Outreach Ultramailer menyala" : "Outreach Ultramailer dimatikan"}</b>
          <span>
            {state.enabled
              ? state.simulasi
                ? "Mode simulasi: seluruh alur berjalan dan statistik terisi, tetapi TIDAK ADA surat yang benar-benar keluar."
                : `Kiriman sungguhan aktif lewat penyedia ${penyedia}. Jatah hari ini ${jatah} surat.`
              : "Tidak ada kampanye yang dapat dibuat maupun dijalankan selama saklar ini mati."}
          </span>
        </div>
        <span className="mtp-state ous-state" data-on={state.enabled ? "1" : undefined}>
          {state.enabled ? (state.simulasi ? "SIMULASI" : "AKTIF") : "MATI"}
        </span>
        {superAdmin && (
          <label className="mtp-switch" title="Nyalakan / matikan Outreach Ultramailer">
            <input
              type="checkbox"
              checked={state.enabled}
              disabled={sibuk}
              onChange={async (peristiwa) => {
                const nyala = peristiwa.target.checked;
                setSibuk(true);
                await onUbah(
                  { enabled: nyala },
                  nyala ? "Outreach Ultramailer dinyalakan." : "Outreach Ultramailer dimatikan.",
                );
                setSibuk(false);
              }}
            />
            <i aria-hidden="true" />
          </label>
        )}
      </div>

      <div className="ous-angka">
        <div><b>{jatah}</b><span>Jatah hari ini</span></div>
        <div><b>{ringkasan?.terkirim24Jam ?? 0}</b><span>Terkirim 24 jam</span></div>
        <div><b>{ringkasan?.terkirim1Jam ?? 0}</b><span>Terkirim 1 jam</span></div>
        <div><b>{ringkasan?.menunggu ?? 0}</b><span>Menunggu antrean</span></div>
        <div><b>{ringkasan?.dicekal ?? 0}</b><span>Alamat dicekal</span></div>
      </div>

      <p className="helper ous-jujur">
        <b>Yang perlu dipahami sejak awal:</b> tidak ada perangkat lunak yang dapat menjamin sebuah
        surat tidak masuk folder spam. Yang memutuskan itu Gmail, Outlook, dan server kampus
        penerima, berdasarkan reputasi domain pengirim. Yang dikerjakan OUS adalah seluruh
        bagian yang memang dapat dikerjakan kode: volume kecil dan rata, satu surat satu penerima,
        berhenti langganan yang berfungsi, pantulan dan keluhan langsung dihentikan. Bagian
        terbesarnya (SPF, DKIM, dan DMARC domain pengirim) dikerjakan sekali di panel DNS, dan
        tanpanya seluruh sisanya hampir tidak berarti.
      </p>
    </div>
  );
}

// ============================================================
// TAB KAMPANYE
// ============================================================

function TabKampanye({
  state, naskah, kampanye, emailSaya, jatah, onSegar, onPutar, setKabar, setGalat,
}: {
  state: OusState;
  naskah: Naskah[];
  kampanye: Kampanye[];
  emailSaya: string;
  jatah: number;
  onSegar: () => Promise<void>;
  onPutar: () => void;
  setKabar: (v: string) => void;
  setGalat: (v: string) => void;
}) {
  const [buka, setBuka] = useState(false);
  const [pilih, setPilih] = useState<number | null>(null);

  return (
    <>
      <div className="ous-aksi-baris">
        <button type="button" className="btn btn-primary" disabled={!state.enabled} onClick={() => setBuka((v) => !v)}>
          {buka ? "Tutup formulir" : "+ Kampanye baru"}
        </button>
        <button type="button" className="btn btn-light btn-mini" onClick={() => void onSegar()}>↻ Muat ulang</button>
        <button type="button" className="btn btn-light btn-mini" onClick={onPutar} disabled={!state.enabled}>
          ▷ Proses antrean sekarang
        </button>
      </div>

      {buka && (
        <FormKampanye
          state={state}
          naskah={naskah}
          jatah={jatah}
          onSelesai={async () => { setBuka(false); await onSegar(); }}
          setKabar={setKabar}
          setGalat={setGalat}
        />
      )}

      <div className="panel qtable-wrap">
        <table className="qt">
          <thead>
            <tr>
              <th>Kampanye</th><th>Penerima</th><th>Kemajuan</th><th>Status</th><th>Pemilik</th><th />
            </tr>
          </thead>
          <tbody>
            {kampanye.length === 0 ? (
              <tr><td colSpan={6}><div className="dempty"><b>Belum ada kampanye</b><br />Mulai dari tombol &ldquo;Kampanye baru&rdquo; di atas.</div></td></tr>
            ) : (
              kampanye.map((item) => {
                const hitung = ringkasanKampanye({
                  total: item.totalRecipients, queued: item.queuedCount, sent: item.sentCount,
                  delivered: item.deliveredCount, failed: item.failedCount,
                  bounced: item.bouncedCount, unsubscribed: item.unsubscribedCount,
                });
                return (
                  <tr key={item.id}>
                    <td>
                      <b>{item.name}</b>
                      <small>{item.code} · {item.subject}</small>
                    </td>
                    <td>{item.totalRecipients}</td>
                    <td>
                      <div className="ous-bar"><i style={{ width: `${hitung.kemajuan}%` }} /></div>
                      <small>{hitung.kemajuan}% · {item.deliveredCount} sampai · {item.bouncedCount} pantul</small>
                    </td>
                    <td>
                      <span className={`pill ous-pill s-${item.status}`}>
                        {STATUS_KAMPANYE_LABEL[item.status as StatusKampanye] || item.status}
                      </span>
                      {item.simulasi && <small>simulasi</small>}
                    </td>
                    <td><b>{item.ownerName || "-"}</b><small>{waktu(item.createdAt)}</small></td>
                    <td>
                      <button type="button" className="btn btn-light btn-mini" onClick={() => setPilih(item.id)}>
                        Buka
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pilih !== null && (
        <DetailKampanye
          id={pilih}
          emailSaya={emailSaya}
          onTutup={() => setPilih(null)}
          onSegar={onSegar}
          setKabar={setKabar}
          setGalat={setGalat}
        />
      )}
    </>
  );
}

// ============================================================
// FORMULIR KAMPANYE BARU
// ============================================================

function FormKampanye({
  state, naskah, jatah, onSelesai, setKabar, setGalat,
}: {
  state: OusState;
  naskah: Naskah[];
  jatah: number;
  onSelesai: () => Promise<void>;
  setKabar: (v: string) => void;
  setGalat: (v: string) => void;
}) {
  const [nama, setNama] = useState("");
  const [tempelan, setTempelan] = useState("");
  const [csv, setCsv] = useState("");
  const [namaCsv, setNamaCsv] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(naskah.find((n) => n.active)?.id ?? null);
  const [laporan, setLaporan] = useState<Laporan | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [sudahLihatDaftar, setSudahLihatDaftar] = useState(false);
  const [sudahLihatIsi, setSudahLihatIsi] = useState(false);

  const terpilih = naskah.find((item) => item.id === templateId) || null;

  const nada = useMemo(() => {
    if (!terpilih) return null;
    return periksaNada(terpilih.subject, rangkaEmail(terpilih.bodyHtml, terpilih.subject), terpilih.bodyText || "");
  }, [terpilih]);

  async function periksa() {
    setSibuk(true);
    setGalat("");
    try {
      const jawaban = await fetch("/api/outreach/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "periksa", tempelan, csv }),
      });
      const isi = await jawaban.json();
      if (!jawaban.ok || !isi.success) throw new Error(isi.message || "Daftar penerima belum dapat diperiksa.");
      setLaporan(isi.laporan);
    } catch (sebab: unknown) {
      setGalat(sebab instanceof Error ? sebab.message : "Daftar penerima belum dapat diperiksa.");
    } finally {
      setSibuk(false);
    }
  }

  async function buat() {
    setSibuk(true);
    setGalat("");
    setKabar("");
    try {
      const jawaban = await fetch("/api/outreach/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "buat", nama, templateId, tempelan, csv }),
      });
      const isi = await jawaban.json();
      if (!jawaban.ok || !isi.success) throw new Error(isi.message || "Kampanye belum dapat dibuat.");
      setKabar(
        `Kampanye ${isi.campaign.code} tersimpan sebagai draf${isi.simulasi ? " (mode simulasi)" : ""}. ` +
        "Buka kampanyenya, kirim satu surat uji, lalu tekan Jalankan.",
      );
      await onSelesai();
    } catch (sebab: unknown) {
      setGalat(sebab instanceof Error ? sebab.message : "Kampanye belum dapat dibuat.");
    } finally {
      setSibuk(false);
    }
  }

  const siapBuat =
    Boolean(nama.trim()) && Boolean(templateId) && (laporan?.valid ?? 0) > 0 &&
    sudahLihatDaftar && sudahLihatIsi && !nada?.tertahan;

  return (
    <div className="panel ous-form">
      <h3>Kampanye baru</h3>

      <label className="ous-label">
        <span>Nama kampanye <em>*</em></span>
        <input
          value={nama}
          maxLength={200}
          placeholder="mis. International Researchers Communication 2026"
          onChange={(e) => setNama(e.target.value)}
        />
      </label>

      <label className="ous-label">
        <span>Daftar penerima</span>
        <textarea
          rows={6}
          value={tempelan}
          placeholder={"john@university.edu\nJane Lee <jane@university.edu>\nresearcher@um.edu.my"}
          onChange={(e) => { setTempelan(e.target.value); setLaporan(null); setSudahLihatDaftar(false); }}
        />
      </label>
      <p className="helper">
        Satu alamat per baris. Bentuk <code>Nama &lt;alamat&gt;</code> ikut terbaca, dan namanya dipakai
        untuk menyapa penerimanya.
      </p>

      <label className="ous-label">
        <span>Atau unggah CSV {namaCsv && <b>· {namaCsv}</b>}</span>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => {
            const berkas = e.target.files?.[0];
            if (!berkas) return;
            setNamaCsv(berkas.name);
            const pembaca = new FileReader();
            pembaca.onload = () => {
              setCsv(String(pembaca.result || ""));
              setLaporan(null);
              setSudahLihatDaftar(false);
            };
            pembaca.readAsText(berkas);
          }}
        />
      </label>
      <p className="helper">
        Kolom yang dikenali: <code>email</code> (wajib), <code>name</code>, <code>institution</code>,
        <code>field</code>, <code>country</code>.
      </p>

      <button type="button" className="btn btn-light" disabled={sibuk || (!tempelan.trim() && !csv.trim())} onClick={() => void periksa()}>
        {sibuk ? "Memeriksa…" : "Periksa daftar penerima"}
      </button>

      {laporan && (
        <div className="ous-laporan">
          <div className="ous-laporan-angka">
            <div><b>{laporan.total}</b><span>Terbaca</span></div>
            <div className="baik"><b>{laporan.valid}</b><span>Siap dikirimi</span></div>
            <div className="sedang"><b>{laporan.duplikat}</b><span>Duplikat</span></div>
            <div className="buruk"><b>{laporan.tidakSah}</b><span>Rusak</span></div>
            <div className="buruk"><b>{laporan.tercekal}</b><span>Dicekal</span></div>
          </div>
          <p className="helper">
            Dengan jatah <b>{laporan.jatahHarian} surat per hari</b>, kampanye ini akan berjalan
            sekitar <b>{laporan.perkiraanHari} hari</b>. Itu disengaja: mengirim {laporan.valid} surat
            dalam sehari dari domain yang belum punya reputasi adalah cara tercepat masuk daftar hitam.
          </p>
          {laporan.contohRusak.length > 0 && (
            <p className="helper ous-contoh">Contoh baris rusak: {laporan.contohRusak.slice(0, 5).join(" · ")}</p>
          )}
          {laporan.contohTercekal.length > 0 && (
            <p className="helper ous-contoh">
              Dilewati karena pernah berhenti langganan / memantul: {laporan.contohTercekal.slice(0, 5).join(" · ")}
            </p>
          )}
        </div>
      )}

      <label className="ous-label">
        <span>Naskah surat <em>*</em></span>
        <select
          value={templateId ?? ""}
          onChange={(e) => { setTemplateId(Number(e.target.value) || null); setSudahLihatIsi(false); }}
        >
          <option value="">- pilih naskah -</option>
          {naskah.filter((item) => item.active).map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>

      {terpilih && <Pratinjau naskah={terpilih} state={state} nada={nada} />}

      <div className="ous-centang">
        <label>
          <input type="checkbox" checked={sudahLihatDaftar} onChange={(e) => setSudahLihatDaftar(e.target.checked)} />
          <span>Saya sudah memeriksa daftar penerimanya.</span>
        </label>
        <label>
          <input type="checkbox" checked={sudahLihatIsi} onChange={(e) => setSudahLihatIsi(e.target.checked)} />
          <span>Saya sudah membaca isi suratnya, dan klaimnya sesuai keterangan resmi jurnal.</span>
        </label>
      </div>

      <button type="button" className="btn btn-primary" disabled={!siapBuat || sibuk} onClick={() => void buat()}>
        {sibuk ? "Menyimpan…" : `Buat kampanye${laporan ? ` untuk ${laporan.valid} penerima` : ""}`}
      </button>
      <p className="helper">
        Kampanye dibuat sebagai <b>draf</b> dan belum mengirim apa pun. Jatah hari ini {jatah} surat;
        batas satu kampanye {BATAS.penerimaPerKampanye} penerima.
      </p>
    </div>
  );
}

// ============================================================
// PRATINJAU + PEMERIKSA NADA
// ============================================================

function Pratinjau({
  naskah, state, nada,
}: {
  naskah: { subject: string; bodyHtml: string; bodyText: string | null };
  state: OusState;
  nada: ReturnType<typeof periksaNada> | null;
}) {
  const asal = typeof window === "undefined" ? "" : window.location.origin;
  const data = {
    ...CONTOH,
    journal_name: state.jurnalNama,
    submission_url: state.jurnalUrl,
    sender_name: state.fromName,
    unsubscribe_url: `${asal}/email/berhenti?t=contoh`,
  };
  const subjek = gabungNaskah(naskah.subject, data);
  const isi = sanitizeLetterHtml(gabungNaskah(naskah.bodyHtml, data, true));
  const peubah = peubahDipakai(naskah.bodyHtml);

  return (
    <div className="ous-pratinjau">
      <div className="ous-pratinjau-kepala">
        <div>
          <span>Dari</span>
          <b>{state.fromName} &lt;{state.fromEmail || "belum diisi"}&gt;</b>
        </div>
        <div>
          <span>Kepada</span>
          <b>{CONTOH.name} &lt;contoh@university.edu&gt;</b>
        </div>
        <div>
          <span>Subjek</span>
          <b>{subjek}</b>
        </div>
      </div>
      <div className="ous-pratinjau-badan" dangerouslySetInnerHTML={{ __html: isi }} />
      {peubah.length > 0 && (
        <p className="helper">Peubah yang dipakai: {peubah.map((item) => `{{${item}}}`).join(" · ")}</p>
      )}
      {nada && <KartuNada nada={nada} />}
    </div>
  );
}

function KartuNada({ nada }: { nada: ReturnType<typeof periksaNada> }) {
  const pita = pitaNada(nada.skor);
  const label = pita === "baik" ? "Wajar" : pita === "sedang" ? "Perlu diperbaiki" : "Berisiko tinggi";
  return (
    <div className={`ous-nada ${pita}`}>
      <div className="ous-nada-kepala">
        <b>Pemeriksa nada</b>
        <span className={`pill ous-pita-${pita}`}>{label} · skor {nada.skor}</span>
      </div>
      {nada.temuan.length === 0 ? (
        <p className="helper">Tidak ada temuan. Suratnya terbaca seperti surat, bukan seperti iklan.</p>
      ) : (
        <ul>
          {nada.temuan.map((item, i) => (
            <li key={i} className={item.tingkat}>
              <b>{item.tingkat === "berat" ? "Wajib dibereskan" : "Sebaiknya"}</b> {item.pesan}
            </li>
          ))}
        </ul>
      )}
      <p className="helper">
        Skor ini bukan ramalan. Tidak ada penyaring spam yang menerbitkan aturannya; yang diperiksa
        di sini adalah hal-hal yang sudah lama diketahui membuat surat terbaca seperti iklan.
      </p>
    </div>
  );
}

// ============================================================
// RINCIAN KAMPANYE
// ============================================================

function DetailKampanye({
  id, emailSaya, onTutup, onSegar, setKabar, setGalat,
}: {
  id: number;
  emailSaya: string;
  onTutup: () => void;
  onSegar: () => Promise<void>;
  setKabar: (v: string) => void;
  setGalat: (v: string) => void;
}) {
  const [data, setData] = useState<{
    campaign: Kampanye & { bodyHtml: string; bodyText: string | null; fromName: string; fromEmail: string; replyTo: string | null };
    ringkasan: ReturnType<typeof ringkasanKampanye>;
    recipients: PenerimaBaris[];
  } | null>(null);
  const [saring, setSaring] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [ujiKe, setUjiKe] = useState(emailSaya);

  const muat = useCallback(async () => {
    const jawaban = await fetch(`/api/outreach/campaigns/${id}?status=${encodeURIComponent(saring)}`, { cache: "no-store" });
    const isi = await jawaban.json();
    if (!jawaban.ok || !isi.success) {
      setGalat(isi.message || "Rincian kampanye belum dapat dimuat.");
      return;
    }
    setData(isi);
  }, [id, saring, setGalat]);

  useEffect(() => {
    // Ditunda satu tick agar setState tidak berjalan sinkron di dalam effect,
    // sama seperti panel-panel lain di dashboard ini.
    const jam = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(jam);
  }, [muat]);

  async function aksi(nama: string, ke?: string) {
    setSibuk(true);
    setGalat("");
    setKabar("");
    try {
      const jawaban = await fetch(`/api/outreach/campaigns/${id}/aksi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: nama, ke }),
      });
      const isi = await jawaban.json();
      if (!jawaban.ok || !isi.success) throw new Error(isi.message || "Perintah belum dapat dijalankan.");
      setKabar(isi.message || "Selesai.");
      await muat();
      await onSegar();
    } catch (sebab: unknown) {
      setGalat(sebab instanceof Error ? sebab.message : "Perintah belum dapat dijalankan.");
    } finally {
      setSibuk(false);
    }
  }

  if (!data) return null;
  const k = data.campaign;

  return (
    <div className="panel ous-detail">
      <div className="ous-detail-kepala">
        <div>
          <h3>{k.name}</h3>
          <p className="helper">
            {k.code} · {STATUS_KAMPANYE_LABEL[k.status as StatusKampanye] || k.status}
            {k.simulasi ? " · MODE SIMULASI" : ""} · dibuat {waktu(k.createdAt)}
          </p>
        </div>
        <button type="button" className="btn btn-light btn-mini" onClick={onTutup}>Tutup</button>
      </div>

      <div className="ous-angka">
        <div><b>{k.totalRecipients}</b><span>Penerima</span></div>
        <div><b>{k.queuedCount}</b><span>Antre</span></div>
        <div><b>{k.sentCount}</b><span>Terkirim</span></div>
        <div><b>{k.deliveredCount}</b><span>Sampai</span></div>
        <div><b>{k.bouncedCount}</b><span>Memantul</span></div>
        <div><b>{k.failedCount}</b><span>Gagal</span></div>
        <div><b>{k.unsubscribedCount}</b><span>Berhenti</span></div>
      </div>

      <div className="ous-bar besar"><i style={{ width: `${data.ringkasan.kemajuan}%` }} /></div>
      <p className="helper">
        {data.ringkasan.diproses} dari {k.totalRecipients} diproses · laju sampai {data.ringkasan.lajuSampai}% ·
        laju pantul {data.ringkasan.lajuPantul}%
        {data.ringkasan.lajuPantul > 5 && "· di atas 5% sudah merusak reputasi domain; hentikan dan periksa sumber daftarnya."}
      </p>

      {/* Tombol kendali ditampilkan apa adanya. Yang menentukan kepemilikan
          tetap server: kampanye milik orang lain bahkan tidak pernah sampai ke
          sini — jalur rinciannya menjawab 404, bukan 403, supaya nomor
          kampanye orang lain pun tidak dapat diraba dari luar. */}
      <div className="ous-aksi-baris">
          {["draft", "paused", "queued"].includes(k.status) && (
            <button type="button" className="btn btn-primary" disabled={sibuk} onClick={() => void aksi("jalan")}>
              ▶ Jalankan
            </button>
          )}
          {k.status === "sending" && (
            <button type="button" className="btn btn-light" disabled={sibuk} onClick={() => void aksi("jeda")}>⏸ Jeda</button>
          )}
          {k.status === "paused" && (
            <button type="button" className="btn btn-primary" disabled={sibuk} onClick={() => void aksi("lanjut")}>▶ Lanjutkan</button>
          )}
          {["draft", "queued", "sending", "paused"].includes(k.status) && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={sibuk}
              onClick={() => {
                if (window.confirm("Batalkan sisa penerima yang masih mengantre? Surat yang sudah terkirim tidak dapat ditarik kembali.")) {
                  void aksi("batal");
                }
              }}
            >
              ✕ Batalkan
            </button>
          )}
      </div>

      <div className="ous-uji">
        <label className="ous-label">
          <span>Kirim surat uji ke</span>
          <input type="email" value={ujiKe} onChange={(e) => setUjiKe(e.target.value)} placeholder="alamat@anda.ac.id" />
        </label>
        <button type="button" className="btn btn-light" disabled={sibuk} onClick={() => void aksi("uji", ujiKe)}>
          ✉ Kirim surat uji
        </button>
        <p className="helper">
          Surat uji dirakit dengan jalur yang sama persis dengan surat sungguhan, termasuk tautan
          berhenti langganan yang benar-benar berfungsi. Tekan tautannya pada surat uji: kalau ia
          tidak bekerja, di sinilah hal itu harus ketahuan.
        </p>
      </div>

      <div className="ous-saring">
        <select value={saring} onChange={(e) => setSaring(e.target.value)} aria-label="Saring status penerima">
          <option value="">Semua status</option>
          {(Object.keys(STATUS_PENERIMA_LABEL) as StatusPenerima[]).map((item) => (
            <option key={item} value={item}>{STATUS_PENERIMA_LABEL[item]}</option>
          ))}
        </select>
        <button type="button" className="btn btn-light btn-mini" onClick={() => void muat()}>↻ Muat ulang</button>
      </div>

      <div className="qtable-wrap">
        <table className="qt">
          <thead>
            <tr><th>Penerima</th><th>Status</th><th>Coba</th><th>Keterangan</th><th>Waktu</th></tr>
          </thead>
          <tbody>
            {data.recipients.length === 0 ? (
              <tr><td colSpan={5}><div className="dempty">Tidak ada penerima pada saringan ini.</div></td></tr>
            ) : (
              data.recipients.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.name || "-"}</b><small>{item.email}</small></td>
                  <td>
                    <span className={`pill ous-pill s-${item.status}`}>
                      {STATUS_PENERIMA_LABEL[item.status as StatusPenerima] || item.status}
                    </span>
                  </td>
                  <td>{item.attempts}</td>
                  <td>{item.errorMessage ? <small>{item.errorCode}: {item.errorMessage}</small> : "-"}</td>
                  <td><small>{waktu(item.deliveredAt || item.sentAt)}</small></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="helper">Paling banyak 300 baris ditampilkan sekaligus; pakai saringan status untuk melihat sisanya.</p>
    </div>
  );
}

// ============================================================
// TAB NASKAH
// ============================================================

function TabNaskah({
  state, naskah, onSegar, setKabar, setGalat,
}: {
  state: OusState;
  naskah: Naskah[];
  onSegar: () => Promise<void>;
  setKabar: (v: string) => void;
  setGalat: (v: string) => void;
}) {
  const [sunting, setSunting] = useState<Naskah | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function simpan(isi: Naskah) {
    setSibuk(true);
    setGalat("");
    setKabar("");
    try {
      const jawaban = await fetch("/api/outreach/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isi.id > 0 ? isi.id : null,
          nama: isi.name,
          keterangan: isi.description || "",
          subjek: isi.subject,
          bodyHtml: isi.bodyHtml,
          bodyText: isi.bodyText || "",
          aktif: isi.active,
        }),
      });
      const balas = await jawaban.json();
      if (!jawaban.ok || !balas.success) throw new Error(balas.message || "Naskah belum tersimpan.");
      setKabar("Naskah tersimpan.");
      setSunting(null);
      await onSegar();
    } catch (sebab: unknown) {
      setGalat(sebab instanceof Error ? sebab.message : "Naskah belum tersimpan.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="panel ous-ingat">
        <b>Sebelum kampanye pertama, sesuaikan isinya.</b>
        <span>
          Naskah bawaan sengaja ditulis datar: tidak ada janji terindeks di mana pun, tidak ada
          tenggat, tidak ada penyebutan biaya. Bukan karena hal-hal itu terlarang, melainkan karena
          tidak satu pun dapat diverifikasi dari dalam portal, dan undangan jurnal yang memuat
          klaim keliru merusak nama jurnalnya jauh lebih dalam daripada undangan tanpa klaim
          apa pun. Cocokkan wording, nomor terbitan, dan kebijakan biaya dengan keterangan resmi
          yang sedang berlaku.
        </span>
      </div>

      <div className="ous-aksi-baris">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setSunting({
            id: 0, code: null, name: "", description: "", subject: "",
            bodyHtml: "<p>Dear {{name}},</p>\n\n<p>…</p>", bodyText: "", active: true,
          })}
        >
          + Naskah baru
        </button>
      </div>

      <div className="panel qtable-wrap">
        <table className="qt">
          <thead><tr><th>Naskah</th><th>Subjek</th><th>Nada</th><th>Status</th><th /></tr></thead>
          <tbody>
            {naskah.length === 0 ? (
              <tr><td colSpan={5}><div className="dempty">Naskah bawaan belum tersalin. Muat ulang panel ini.</div></td></tr>
            ) : (
              naskah.map((item) => {
                const nada = periksaNada(item.subject, rangkaEmail(item.bodyHtml, item.subject), item.bodyText || "");
                const pita = pitaNada(nada.skor);
                return (
                  <tr key={item.id}>
                    <td><b>{item.name}</b>{item.description && <small>{item.description}</small>}</td>
                    <td><small>{item.subject}</small></td>
                    <td><span className={`pill ous-pita-${pita}`}>{nada.skor}</span></td>
                    <td>{item.active ? "Aktif" : "Nonaktif"}</td>
                    <td>
                      <button type="button" className="btn btn-light btn-mini" onClick={() => setSunting(item)}>Sunting</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {sunting && (
        <PenyuntingNaskah
          awal={sunting}
          state={state}
          sibuk={sibuk}
          onBatal={() => setSunting(null)}
          onSimpan={simpan}
        />
      )}
    </>
  );
}

function PenyuntingNaskah({
  awal, state, sibuk, onBatal, onSimpan,
}: {
  awal: Naskah;
  state: OusState;
  sibuk: boolean;
  onBatal: () => void;
  onSimpan: (isi: Naskah) => Promise<void>;
}) {
  const [isi, setIsi] = useState<Naskah>(awal);
  // Naskah yang dipilih berganti tanpa komponennya dilepas. Penyesuaiannya
  // dikerjakan SAAT RENDER, bukan di dalam effect: effect berjalan sesudah
  // layar tergambar, sehingga sekejap yang terlihat adalah naskah lama di
  // dalam judul naskah baru.
  const [asal, setAsal] = useState(awal);
  if (asal !== awal) {
    setAsal(awal);
    setIsi(awal);
  }

  const nada = useMemo(
    () => periksaNada(isi.subject, rangkaEmail(isi.bodyHtml, isi.subject), isi.bodyText || ""),
    [isi],
  );

  return (
    <div className="panel ous-form">
      <h3>{isi.id > 0 ? "Sunting naskah" : "Naskah baru"}</h3>

      <label className="ous-label">
        <span>Nama naskah <em>*</em></span>
        <input value={isi.name} maxLength={160} onChange={(e) => setIsi({ ...isi, name: e.target.value })} />
      </label>
      <label className="ous-label">
        <span>Keterangan</span>
        <input value={isi.description || ""} maxLength={300} onChange={(e) => setIsi({ ...isi, description: e.target.value })} />
      </label>
      <label className="ous-label">
        <span>Subjek <em>*</em></span>
        <input value={isi.subject} maxLength={300} onChange={(e) => setIsi({ ...isi, subject: e.target.value })} />
      </label>
      <label className="ous-label">
        <span>Isi surat (HTML) <em>*</em></span>
        <textarea rows={14} value={isi.bodyHtml} onChange={(e) => setIsi({ ...isi, bodyHtml: e.target.value })} />
      </label>
      <p className="helper">
        Peubah yang tersedia: <code>{"{{name}}"}</code> <code>{"{{institution}}"}</code>{" "}
        <code>{"{{field}}"}</code> <code>{"{{country}}"}</code> <code>{"{{journal_name}}"}</code>{" "}
        <code>{"{{submission_url}}"}</code> <code>{"{{unsubscribe_url}}"}</code>. Nilai cadangan
        ditulis <code>{"{{institution|your institution}}"}</code>, dan tanpa itu pun kolom kosong tidak
        pernah menghasilkan kalimat menggantung.
      </p>
      <label className="ous-label">
        <span>Versi teks biasa (kosongkan agar diturunkan sendiri)</span>
        <textarea rows={5} value={isi.bodyText || ""} onChange={(e) => setIsi({ ...isi, bodyText: e.target.value })} />
      </label>
      <label className="ous-centang-satu">
        <input type="checkbox" checked={isi.active} onChange={(e) => setIsi({ ...isi, active: e.target.checked })} />
        <span>Aktif · muncul pada pilihan naskah saat membuat kampanye</span>
      </label>

      <Pratinjau naskah={isi} state={state} nada={nada} />

      <div className="ous-aksi-baris">
        <button type="button" className="btn btn-primary" disabled={sibuk || nada.tertahan} onClick={() => void onSimpan(isi)}>
          {sibuk ? "Menyimpan…" : "Simpan naskah"}
        </button>
        <button type="button" className="btn btn-light" onClick={onBatal}>Batal</button>
      </div>
      {nada.tertahan && (
        <p className="helper ous-tahan">
          Naskah belum dapat disimpan selama masih ada temuan &ldquo;wajib dibereskan&rdquo; di atas.
        </p>
      )}
    </div>
  );
}

// ============================================================
// TAB DAFTAR CEKAL
// ============================================================

function TabCekal({
  cekal, superAdmin, onSegar, setKabar, setGalat,
}: {
  cekal: Cekal[];
  superAdmin: boolean;
  onSegar: () => Promise<void>;
  setKabar: (v: string) => void;
  setGalat: (v: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function tambah() {
    setSibuk(true);
    setGalat("");
    try {
      const jawaban = await fetch("/api/outreach/cekal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, alasan: "manual" }),
      });
      const isi = await jawaban.json();
      if (!jawaban.ok || !isi.success) throw new Error(isi.message || "Alamat belum dapat dicekal.");
      setKabar(`${email} tidak akan dikirimi lagi.`);
      setEmail("");
      await onSegar();
    } catch (sebab: unknown) {
      setGalat(sebab instanceof Error ? sebab.message : "Alamat belum dapat dicekal.");
    } finally {
      setSibuk(false);
    }
  }

  async function keluarkan(alamat: string) {
    if (!window.confirm(`Keluarkan ${alamat} dari daftar cekal? Alamat ini akan kembali dikirimi undangan.`)) return;
    setGalat("");
    try {
      const jawaban = await fetch(`/api/outreach/cekal?email=${encodeURIComponent(alamat)}`, { method: "DELETE" });
      const isi = await jawaban.json();
      if (!jawaban.ok || !isi.success) throw new Error(isi.message || "Alamat belum dapat dikeluarkan.");
      setKabar(`${alamat} dikeluarkan dari daftar cekal.`);
      await onSegar();
    } catch (sebab: unknown) {
      setGalat(sebab instanceof Error ? sebab.message : "Alamat belum dapat dikeluarkan.");
    }
  }

  return (
    <>
      <div className="panel ous-ingat">
        <b>Daftar ini hanya boleh tumbuh.</b>
        <span>
          Alamat masuk ke sini karena orangnya menekan &ldquo;berhenti langganan&rdquo;, karena
          suratnya memantul keras, atau karena ia melaporkan kita sebagai spam. Mengirim lagi kepada
          orang yang sudah menolak adalah hal paling merusak yang dapat dilakukan sistem ini
          terhadap reputasi domainnya sendiri. Karena itu yang boleh mengeluarkan alamat dari
          daftar ini hanya Super Admin.
        </span>
      </div>

      <div className="panel ous-form">
        <label className="ous-label">
          <span>Cekal alamat secara manual</span>
          <input type="email" value={email} placeholder="alamat@contoh.edu" onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="button" className="btn btn-light" disabled={sibuk || !email.trim()} onClick={() => void tambah()}>
          Tambahkan ke daftar cekal
        </button>
      </div>

      <div className="panel qtable-wrap">
        <table className="qt">
          <thead><tr><th>Alamat</th><th>Alasan</th><th>Sumber</th><th>Waktu</th>{superAdmin && <th />}</tr></thead>
          <tbody>
            {cekal.length === 0 ? (
              <tr><td colSpan={superAdmin ? 5 : 4}><div className="dempty">Belum ada alamat yang dicekal.</div></td></tr>
            ) : (
              cekal.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.email}</b></td>
                  <td>{ALASAN_CEKAL_LABEL[item.reason as AlasanCekal] || item.reason}</td>
                  <td><small>{item.source || "-"}</small></td>
                  <td><small>{waktu(item.createdAt)}</small></td>
                  {superAdmin && (
                    <td>
                      <button type="button" className="btn btn-danger btn-mini" onClick={() => void keluarkan(item.email)}>
                        Keluarkan
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="helper">Paling banyak 200 alamat terakhir ditampilkan.</p>
    </>
  );
}

// ============================================================
// TAB PENGATURAN — SUPER ADMIN
// ============================================================

function TabPengaturan({
  state, kesiapan, penyedia, onSimpan,
}: {
  state: OusState;
  kesiapan: Kesiapan | null;
  penyedia: string;
  onSimpan: (patch: Partial<OusState>, pesan: string) => Promise<void>;
}) {
  const [draf, setDraf] = useState<OusState>(state);
  const [dosenBaru, setDosenBaru] = useState("");
  const [sibuk, setSibuk] = useState(false);
  // Sesudah penyimpanan, pengaturan yang berlaku datang kembali dari server —
  // sudah dirapikan dan dipotong batasnya. Drafnya disamakan saat render,
  // supaya angka yang terlihat di layar adalah angka yang benar-benar
  // tersimpan, bukan angka yang tadi diketik.
  const [asal, setAsal] = useState(state);
  if (asal !== state) {
    setAsal(state);
    setDraf(state);
  }

  async function simpan(patch: Partial<OusState>, pesan: string) {
    setSibuk(true);
    await onSimpan(patch, pesan);
    setSibuk(false);
  }

  return (
    <>
      <div className="panel">
        <h3>Kesiapan kirim sungguhan</h3>
        {kesiapan?.siap ? (
          <p className="dsh-ok">Tidak ada penghalang. Mode simulasi boleh dimatikan.</p>
        ) : (
          <ul className="ous-halangan">
            {(kesiapan?.penghalang ?? []).map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        )}
        <ul className="ous-catatan">
          {(kesiapan?.catatan ?? []).map((item, i) => <li key={i}>{item}</li>)}
        </ul>
        <p className="helper">Penyedia yang terbaca dari environment: <b>{penyedia}</b>.</p>

        <div className="mtp-row">
          <div className="mtp-row-copy">
            <b>Mode simulasi</b>
            <span>
              Menyala berarti seluruh alur berjalan tanpa satu pun surat keluar. Matikan hanya
              sesudah surat uji terlihat benar dan SPF/DKIM/DMARC domain pengirim sudah lulus.
            </span>
          </div>
          <label className="mtp-switch mtp-switch-danger">
            <input
              type="checkbox"
              checked={!state.simulasi}
              disabled={sibuk || !kesiapan?.siap}
              onChange={(e) => void simpan(
                { simulasi: !e.target.checked },
                e.target.checked ? "Kiriman sungguhan dinyalakan." : "Kembali ke mode simulasi.",
              )}
            />
            <i aria-hidden="true" />
          </label>
        </div>
      </div>

      <div className="panel ous-form">
        <h3>Siapa yang boleh memakai OUS</h3>
        <p className="helper">
          Admin dan Super Admin selalu termasuk. Dosen dibuka satu per satu, menu ini untuk
          pengurus jurnal, bukan untuk seluruh dosen fakultas.
        </p>
        <div className="ous-chips">
          {draf.dosen.map((item) => (
            <span className="ous-chip" key={item}>
              {item}
              <button
                type="button"
                aria-label={`Cabut izin ${item}`}
                disabled={sibuk}
                onClick={() => void simpan(
                  { dosen: draf.dosen.filter((lain) => lain !== item) },
                  `Izin OUS untuk ${item} dicabut.`,
                )}
              >
                ✕
              </button>
            </span>
          ))}
          {draf.dosen.length === 0 && <span className="helper">Belum ada dosen yang dibukakan.</span>}
        </div>
        <div className="ous-aksi-baris">
          <input
            type="email"
            value={dosenBaru}
            placeholder="email.dosen@umt.ac.id"
            onChange={(e) => setDosenBaru(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-light"
            disabled={sibuk || !dosenBaru.trim()}
            onClick={async () => {
              await simpan({ dosen: [...draf.dosen, dosenBaru.trim()] }, `Menu OUS dibuka untuk ${dosenBaru.trim()}.`);
              setDosenBaru("");
            }}
          >
            Buka akses
          </button>
        </div>
        <p className="helper">
          Alamatnya harus SAMA PERSIS dengan email akun portalnya. Dosen yang alamatnya tidak cocok
          tidak akan melihat menu ini, dan ia tidak akan diberi tahu kenapa.
        </p>
      </div>

      <div className="panel ous-form">
        <h3>Laju pengiriman</h3>
        <p className="helper">
          Inilah bagian yang menjaga surat tetap sampai. Jatah harian dibatasi {BATAS.hariMaks};
          yang butuh lebih banyak mengirim lebih lama, bukan lebih deras.
        </p>

        <label className="ous-label">
          <span>Jatah per hari: <b>{draf.hariMaks}</b> surat</span>
          <input
            type="range"
            min={BATAS.hariMin}
            max={BATAS.hariMaks}
            value={draf.hariMaks}
            onChange={(e) => setDraf({ ...draf, hariMaks: Number(e.target.value) })}
          />
        </label>
        <label className="ous-label">
          <span>Jatah per jam: <b>{draf.jamMaks}</b> surat</span>
          <input
            type="range"
            min={BATAS.jamMin}
            max={BATAS.jamMaks}
            value={draf.jamMaks}
            onChange={(e) => setDraf({ ...draf, jamMaks: Number(e.target.value) })}
          />
        </label>
        <label className="ous-label">
          <span>Jeda antar surat: <b>{draf.jedaDetik}</b> detik</span>
          <input
            type="range"
            min={BATAS.jedaMin}
            max={180}
            step={5}
            value={draf.jedaDetik}
            onChange={(e) => setDraf({ ...draf, jedaDetik: Number(e.target.value) })}
          />
        </label>
        <div className="ous-dua">
          <label className="ous-label">
            <span>Jam mulai (WIB)</span>
            <input type="number" min={0} max={23} value={draf.jamMulai}
              onChange={(e) => setDraf({ ...draf, jamMulai: Number(e.target.value) })} />
          </label>
          <label className="ous-label">
            <span>Jam selesai (WIB)</span>
            <input type="number" min={1} max={23} value={draf.jamSelesai}
              onChange={(e) => setDraf({ ...draf, jamSelesai: Number(e.target.value) })} />
          </label>
        </div>
        <label className="ous-centang-satu">
          <input type="checkbox" checked={draf.pemanasan} onChange={(e) => setDraf({ ...draf, pemanasan: e.target.checked })} />
          <span>
            Pemanasan bertahap: hari 1–2 hanya 20 surat, naik perlahan sampai jatah penuh pada hari
            kesepuluh. Wajib untuk domain yang belum pernah mengirim apa-apa.
          </span>
        </label>
        <p className="helper">
          Dengan {draf.hariMaks} surat sehari, daftar berisi 1.000 alamat selesai dalam{" "}
          {perkiraanHari(1000, draf.hariMaks)} hari.
        </p>
      </div>

      <div className="panel ous-form">
        <h3>Identitas pengirim</h3>
        <div className="ous-dua">
          <label className="ous-label">
            <span>Nama pengirim</span>
            <input value={draf.fromName} maxLength={80} onChange={(e) => setDraf({ ...draf, fromName: e.target.value })} />
          </label>
          <label className="ous-label">
            <span>Alamat pengirim</span>
            <input type="email" value={draf.fromEmail} placeholder="journal@domain-resmi.ac.id"
              onChange={(e) => setDraf({ ...draf, fromEmail: e.target.value })} />
          </label>
        </div>
        <label className="ous-label">
          <span>Reply-To</span>
          <input type="email" value={draf.replyTo} onChange={(e) => setDraf({ ...draf, replyTo: e.target.value })} />
        </label>
        <div className="ous-dua">
          <label className="ous-label">
            <span>Nama jurnal</span>
            <input value={draf.jurnalNama} maxLength={120} onChange={(e) => setDraf({ ...draf, jurnalNama: e.target.value })} />
          </label>
          <label className="ous-label">
            <span>Alamat pengiriman naskah</span>
            <input value={draf.jurnalUrl} maxLength={300} onChange={(e) => setDraf({ ...draf, jurnalUrl: e.target.value })} />
          </label>
        </div>
        <p className="helper">
          Jangan berganti-ganti identitas pengirim antar kampanye. Reputasi dibangun pada satu nama
          dan satu alamat; setiap penggantian memulainya kembali dari nol.
        </p>
      </div>

      <div className="ous-aksi-baris">
        <button
          type="button"
          className="btn btn-primary"
          disabled={sibuk}
          onClick={() => void simpan(
            {
              hariMaks: draf.hariMaks, jamMaks: draf.jamMaks, jedaDetik: draf.jedaDetik,
              jamMulai: draf.jamMulai, jamSelesai: draf.jamSelesai, pemanasan: draf.pemanasan,
              fromName: draf.fromName, fromEmail: draf.fromEmail, replyTo: draf.replyTo,
              jurnalNama: draf.jurnalNama, jurnalUrl: draf.jurnalUrl,
            },
            "Pengaturan OUS tersimpan.",
          )}
        >
          {sibuk ? "Menyimpan…" : "Simpan pengaturan"}
        </button>
      </div>
    </>
  );
}
