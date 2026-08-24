"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { periksaBahasa, BERAT_LABEL, type Berat } from "@/lib/bahasa-check";
import { METRIK_TIDAK_DIAKUI, PITA_LABEL, type Hasil, type Tingkat } from "@/lib/journal-radar";
import {
  PUTUSAN_LABEL,
  type HasilRujukan,
  type Putusan,
  type RingkasanSitasi,
} from "@/lib/citation-check";
import {
  BAGIAN_LABEL,
  BERAT_INGGRIS_LABEL,
  PORSI_TARGET,
  periksaInggris,
  petakanNaskah,
  type BagianJurnal,
  type BagianSkripsi,
  type BeratInggris,
} from "@/lib/manuscript";

type Tab = "sitasi" | "radar" | "naskah" | "bahasa";

const KELAS_PUTUSAN: Record<Putusan, string> = {
  terverifikasi: "ok",
  "beda-rincian": "warn",
  "tidak-ditemukan": "bad",
  "tak-dapat-diperiksa": "abu",
};
const KELAS_TINGKAT: Record<Tingkat, string> = { berat: "bad", sedang: "warn", ringan: "warn", positif: "ok" };
const KELAS_BERAT: Record<Berat, string> = { salah: "bad", sebaiknya: "warn", gaya: "abu" };
const KELAS_ING: Record<BeratInggris, string> = { ganti: "bad", rapikan: "warn", pertimbangkan: "abu" };

/* ---------- Ikon ---------- */
const Ic = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const IKON = {
  sitasi: "M9 12h6M9 16h4M14 3v4a1 1 0 0 0 1 1h4M5 8V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3",
  radar: "M12 21a9 9 0 1 0-9-9M12 17a5 5 0 1 0-5-5M12 12l9-9",
  naskah: "M4 5h10M4 10h7M4 15h10M4 20h5M16 13l4 4-5 5h-4v-4z",
  bahasa: "M4 5h11M9 3v2c0 5-2 8-5 10M8 10c1 3 3 5 6 6M13 21l4-9 4 9M14.5 18h5",
  centang: "M4 12.5l5 5L20 6.5",
};

const MENU: Array<{ id: Tab; label: string; sub: string; ikon: string }> = [
  { id: "sitasi", label: "Verifikasi Sitasi", sub: "Cek referensi fiktif", ikon: IKON.sitasi },
  { id: "radar", label: "Radar Jurnal", sub: "Sebelum kirim naskah", ikon: IKON.radar },
  { id: "naskah", label: "Naskah Inggris", sub: "BAB → artikel jurnal", ikon: IKON.naskah },
  { id: "bahasa", label: "Periksa Bahasa", sub: "Ragam ilmiah Indonesia", ikon: IKON.bahasa },
];

export default function AlatApp() {
  const [tab, setTab] = useState<Tab>("sitasi");

  return (
    <div className="al">
      <header className="al-top">
        <div className="al-top-in">
          <Link href="/" className="al-back">← Portal Mahasiswa</Link>
          <h1>Alat Bantu Akademik</h1>
          <p>Gratis, tanpa akun, tanpa pasang aplikasi. Tulisan Anda tidak dikirim ke mana pun kecuali Anda menekan tombol periksa.</p>
        </div>
      </header>

      <div className="al-body">
        <nav className="al-side" aria-label="Pilih alat">
          {MENU.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`al-nav ${tab === m.id ? "on" : ""}`}
              aria-current={tab === m.id ? "page" : undefined}
              onClick={() => setTab(m.id)}
            >
              <Ic d={m.ikon} />
              {m.label}
              <span className="al-nav-sub">{m.sub}</span>
            </button>
          ))}
        </nav>

        <main>
          {tab === "sitasi" && <VerifikasiSitasi />}
          {tab === "radar" && <RadarJurnal />}
          {tab === "naskah" && <NaskahInggris />}
          {tab === "bahasa" && <PeriksaBahasa />}
        </main>
      </div>
    </div>
  );
}

function Kepala({ ikon, judul, sub }: { ikon: string; judul: string; sub: string }) {
  return (
    <div className="al-head">
      <span className="al-head-ic"><Ic d={ikon} /></span>
      <div>
        <h2>{judul}</h2>
        <p>{sub}</p>
      </div>
    </div>
  );
}

/* ==========================================================================
   VERIFIKASI SITASI
   ========================================================================== */

const CONTOH_SITASI = `Sugiyono. (2019). Metode Penelitian Kuantitatif, Kualitatif, dan R&D. Bandung: Alfabeta.

Kaplan, A. M., & Haenlein, M. (2010). Users of the world, unite! The challenges and opportunities of Social Media. Business Horizons, 53(1), 59-68.

Wijaya, B. S. (2021). Kerangka literasi algoritmik untuk mahasiswa Asia Tenggara. Jurnal Komunikasi Digital, 14(3), 201-219.

Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.`;

function VerifikasiSitasi() {
  const [daftar, setDaftar] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [hasil, setHasil] = useState<HasilRujukan[] | null>(null);
  const [ringkasan, setRingkasan] = useState<RingkasanSitasi | null>(null);

  async function periksa(event: React.FormEvent) {
    event.preventDefault();
    setMemuat(true); setGalat(""); setHasil(null);
    try {
      const balasan = await fetch("/api/verify-citations", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ daftar }),
      });
      const data = (await balasan.json()) as {
        success?: boolean; message?: string; hasil?: HasilRujukan[]; ringkasan?: RingkasanSitasi;
      };
      if (!balasan.ok || !data.success || !data.hasil) throw new Error(data.message || "Pemeriksaan gagal.");
      setHasil(data.hasil); setRingkasan(data.ringkasan ?? null);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Pemeriksaan gagal.");
    } finally { setMemuat(false); }
  }

  const urutan: Putusan[] = ["tidak-ditemukan", "beda-rincian", "tak-dapat-diperiksa", "terverifikasi"];

  return (
    <>
      <section className="al-card">
        <Kepala
          ikon={IKON.sitasi}
          judul="Verifikasi Sitasi"
          sub="Tempel daftar pustaka → diadu ke Crossref & OpenAlex → lihat mana yang benar-benar ada"
        />
        <p className="al-note">
          Referensi fiktif buatan AI naik dua belas kali lipat dalam tiga tahun, dan dua pertiganya karangan utuh —
          nama penulis nyata, jurnal nyata, tahun masuk akal, tetapi karyanya tidak pernah ada. Yang berbahaya justru
          karena <b>tidak terlihat cacat.</b>
        </p>

        <form onSubmit={periksa}>
          <label className="al-field">
            <span>Daftar pustaka Anda</span>
            <textarea
              value={daftar}
              onChange={(e) => setDaftar(e.target.value)}
              rows={9}
              placeholder="Satu rujukan per baris — dari skripsi Anda, atau dari jawaban AI mana pun…"
            />
          </label>
          <div className="al-linkrow">
            <button type="button" className="al-link" onClick={() => setDaftar(CONTOH_SITASI)}>Isi dengan contoh</button>
            {daftar && <button type="button" className="al-link" onClick={() => { setDaftar(""); setHasil(null); }}>Kosongkan</button>}
          </div>
          <button type="submit" className="al-btn" disabled={memuat}>
            {memuat ? "Mengadu ke Crossref dan OpenAlex…" : "Periksa daftar pustaka"}
          </button>
        </form>
        {galat && <p className="al-galat" role="alert">{galat}</p>}
      </section>

      {hasil && ringkasan && (
        <section className="al-card">
          <div className="al-stats">
            <div className="al-stat"><b>{ringkasan.total}</b><span>rujukan</span></div>
            <div className="al-stat ok"><b>{ringkasan.terverifikasi}</b><span>terverifikasi</span></div>
            <div className={`al-stat ${ringkasan.bedaRincian > 0 ? "warn" : ""}`}><b>{ringkasan.bedaRincian}</b><span>beda rincian</span></div>
            <div className={`al-stat ${ringkasan.tidakDitemukan > 0 ? "bad" : ""}`}><b>{ringkasan.tidakDitemukan}</b><span>tidak ditemukan</span></div>
            <div className="al-stat"><b>{ringkasan.takDapatDiperiksa}</b><span>tak diperiksa</span></div>
          </div>

          <ul className="al-list">
            {urutan.flatMap((p) =>
              hasil.filter((h) => h.putusan === p).map((h) => (
                <li key={`${h.rujukan.urut}-${p}`} className={`al-item ${KELAS_PUTUSAN[p]}`}>
                  <div className="al-item-atas">
                    <span className="al-tag">{PUTUSAN_LABEL[p]}</span>
                    <span className="al-num">#{h.rujukan.urut}</span>
                  </div>
                  <p className="al-kutip">{h.rujukan.mentah}</p>
                  <p>{h.pesan}</p>
                  {h.selisih.length > 0 && (
                    <ul className="al-sub">{h.selisih.map((d) => <li key={d}>{d}</li>)}</ul>
                  )}
                  {h.temuan?.judul && (
                    <p className="al-fix">
                      Catatan {h.temuan.sumber}: <b>{h.temuan.judul}</b>
                      {h.temuan.tahun ? ` (${h.temuan.tahun})` : ""}{h.temuan.doi ? ` · ${h.temuan.doi}` : ""}
                    </p>
                  )}
                </li>
              )),
            )}
          </ul>

          <p className="al-tail">
            <b>Tidak ditemukan bukan berarti palsu.</b>{" "}
            Buku, skripsi, peraturan, dan terbitan lokal memang tidak terdaftar di Crossref maupun OpenAlex — semuanya
            ditandai &ldquo;tidak dapat diperiksa&rdquo;, bukan dituduh. Yang berstatus <b>tidak ditemukan</b> adalah
            artikel jurnal yang seharusnya ada di sana tetapi tidak ada.
          </p>
          <button type="button" className="al-print" onClick={() => window.print()}>Cetak / simpan sebagai PDF</button>
        </section>
      )}
    </>
  );
}

/* ==========================================================================
   RADAR JURNAL
   ========================================================================== */

function RadarJurnal() {
  const [issn, setIssn] = useState("");
  const [sinta, setSinta] = useState(false);
  const [metrik, setMetrik] = useState<string[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [hasil, setHasil] = useState<Hasil | null>(null);

  async function periksa(event: React.FormEvent) {
    event.preventDefault();
    setMemuat(true); setGalat(""); setHasil(null);
    try {
      const balasan = await fetch("/api/journal-radar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ issn, sinta, metrik }),
      });
      const data = (await balasan.json()) as { success?: boolean; message?: string; hasil?: Hasil };
      if (!balasan.ok || !data.success || !data.hasil) throw new Error(data.message || "Pemeriksaan gagal.");
      setHasil(data.hasil);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Pemeriksaan gagal.");
    } finally { setMemuat(false); }
  }

  return (
    <>
      <section className="al-card">
        <Kepala
          ikon={IKON.radar}
          judul="Radar Jurnal"
          sub="Masukkan ISSN → periksa DOAJ, Crossref, OpenAlex → lihat tanda bahayanya beserta bukti"
        />
        <p className="al-note">
          Periksa <b>sebelum</b> mengirim naskah. Setelah naskah masuk, penarikan sering ditolak — dan Anda tidak boleh
          mengirimkannya ke jurnal lain sampai penarikan itu dikonfirmasi.
        </p>

        <form onSubmit={periksa}>
          <label className="al-field al-field-kecil">
            <span>ISSN jurnal</span>
            <input value={issn} onChange={(e) => setIssn(e.target.value)} placeholder="2089-3477" inputMode="numeric" autoComplete="off" required />
            <small>Tercantum di halaman depan jurnal atau di bagian &ldquo;About&rdquo;.</small>
          </label>

          <h3 className="al-h4">Yang tidak bisa diperiksa otomatis</h3>
          <ul className="al-chaps" style={{ marginBottom: 14 }}>
            <li>
              <button type="button" className={`al-chap ${sinta ? "on" : ""}`} aria-pressed={sinta} onClick={() => setSinta(!sinta)}>
                <span className="al-box"><Ic d={IKON.centang} /></span>
                <span>
                  <span className="al-chap-atas"><b>Terakreditasi SINTA</b></span>
                  <span className="al-chap-catatan">SINTA tidak menyediakan API publik. Periksa sendiri lalu centang bila benar.</span>
                </span>
              </button>
            </li>
          </ul>

          <p className="al-note" style={{ marginBottom: 10 }}>
            Buka situs jurnalnya, lalu pilih metrik yang Anda lihat dipajang di sana. Tidak satu pun dari ini diterbitkan
            lembaga pengindeks yang diakui — memajangnya adalah tanda bahaya.
          </p>
          <div className="al-tiles" style={{ marginBottom: 18 }}>
            {METRIK_TIDAK_DIAKUI.slice(0, 8).map((m) => {
              const aktif = metrik.includes(m);
              return (
                <button key={m} type="button" className={`al-tile ${aktif ? "on" : ""}`} aria-pressed={aktif}
                  onClick={() => setMetrik((k) => (aktif ? k.filter((x) => x !== m) : [...k, m]))}>
                  <b>{m}</b>
                  <small>{aktif ? "Terlihat di situs" : "Tidak terlihat"}</small>
                </button>
              );
            })}
          </div>

          <button type="submit" className="al-btn" disabled={memuat}>
            {memuat ? "Memeriksa ke DOAJ, Crossref, dan OpenAlex…" : "Periksa jurnal ini"}
          </button>
        </form>
        {galat && <p className="al-galat" role="alert">{galat}</p>}
      </section>

      {hasil && <LaporanRadar hasil={hasil} />}
    </>
  );
}

function KelompokSinyal({ judul, daftar }: { judul: string; daftar: Hasil["sinyal"] }) {
  return (
    <>
      <h4 className="al-h4">{judul}</h4>
      <ul className="al-list">
        {daftar.map((s) => (
          <li key={s.id} className={`al-item ${KELAS_TINGKAT[s.tingkat]}`}>
            <div className="al-item-atas">
              <span className="al-tag">{s.sumber}</span>
              <span className="al-num">{s.bobot > 0 ? `+${s.bobot}` : s.bobot}</span>
            </div>
            <p className="al-kutip"><b>{s.judul}</b></p>
            <p>{s.bukti}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

function LaporanRadar({ hasil }: { hasil: Hasil }) {
  const berat = hasil.sinyal.filter((s) => s.tingkat === "berat");
  const lain = hasil.sinyal.filter((s) => s.tingkat === "sedang" || s.tingkat === "ringan");
  const positif = hasil.sinyal.filter((s) => s.tingkat === "positif");

  return (
    <section className="al-card">
      <div className={`al-verdict ${hasil.pita}`}>
        <h3>{PITA_LABEL[hasil.pita]}</h3>
        <b>{hasil.nama}</b>
        <p>ISSN {hasil.issn.join(", ")} · {hasil.putusan}</p>
      </div>

      {berat.length > 0 && <KelompokSinyal judul="Temuan berbobot berat" daftar={berat} />}
      {lain.length > 0 && <KelompokSinyal judul="Temuan pendukung" daftar={lain} />}
      {positif.length > 0 && <KelompokSinyal judul="Yang justru wajar" daftar={positif} />}

      {hasil.takTerperiksa.length > 0 && (
        <>
          <h4 className="al-h4">Tidak dapat diperiksa</h4>
          <ul className="al-plain">{hasil.takTerperiksa.map((t) => <li key={t}>{t}</li>)}</ul>
        </>
      )}

      <h4 className="al-h4">Langkah Anda</h4>
      <ol className="al-steps">{hasil.langkah.map((l) => <li key={l}>{l}</li>)}</ol>

      <p className="al-tail">
        Ini penilaian risiko dari sinyal publik yang dapat diperiksa ulang, <b>bukan putusan</b> tentang jurnal ini.
        Tunjukkan kepada dosen pembimbing dan putuskan bersama.
      </p>
      <button type="button" className="al-print" onClick={() => window.print()}>Cetak / simpan sebagai PDF</button>
    </section>
  );
}

/* ==========================================================================
   NASKAH INGGRIS
   ========================================================================== */

const CONTOH_INGGRIS =
  "In this modern era, social media cannot be separated from human being daily life. " +
  "As we know, many experts say that digital literacy is very important for students. " +
  "In this research, the researcher want to do a research about this problem. " +
  "Based on the explanation above, this study proves that digital literacy clearly shows a positive effect.";

const PANJANG: Array<{ nilai: number; nama: string; ket: string }> = [
  { nilai: 5000, nama: "5.000 kata", ket: "Artikel pendek" },
  { nilai: 7000, nama: "7.000 kata", ket: "Umum di ilmu sosial" },
  { nilai: 9000, nama: "9.000 kata", ket: "Artikel panjang" },
];

/**
 * Hitung ulang target kata untuk bab yang dipilih saja.
 * Anggaran yang dilepas oleh bab yang tidak dibawa dibagikan kembali
 * secara proporsional kepada bab yang tersisa.
 */
function targetTerpilih(bagian: BagianSkripsi[], dipilih: Set<number>, total: number) {
  const aktif = bagian
    .map((b, i) => ({ b, i }))
    .filter(({ b, i }) => dipilih.has(i) && b.bagian !== "dibuang");

  const porsiPakai = new Set<BagianJurnal>(aktif.map(({ b }) => b.bagian));
  const jumlahPorsi = [...porsiPakai].reduce(
    (n, p) => n + (PORSI_TARGET[p as Exclude<BagianJurnal, "dibuang">] ?? 0), 0);

  const kataPerTujuan = new Map<BagianJurnal, number>();
  for (const { b } of aktif) kataPerTujuan.set(b.bagian, (kataPerTujuan.get(b.bagian) ?? 0) + b.jumlahKata);

  const hasil = new Map<number, number>();
  for (const { b, i } of aktif) {
    const porsi = (PORSI_TARGET[b.bagian as Exclude<BagianJurnal, "dibuang">] ?? 0) / (jumlahPorsi || 1);
    const anggaranTujuan = total * porsi;
    const kataTujuan = kataPerTujuan.get(b.bagian) ?? 0;
    hasil.set(i, Math.round(kataTujuan > 0 ? (b.jumlahKata / kataTujuan) * anggaranTujuan : anggaranTujuan));
  }
  return hasil;
}

function NaskahInggris() {
  const [mode, setMode] = useState<"struktur" | "ragam">("struktur");
  const [skripsi, setSkripsi] = useState("");
  const [inggris, setInggris] = useState("");
  const [target, setTarget] = useState(7000);
  const [batal, setBatal] = useState<Set<number>>(new Set());

  const peta = useMemo(() => (skripsi.trim() ? petakanNaskah(skripsi, target) : null), [skripsi, target]);

  // Bawaan: seluruh bab yang bukan "dibuang" ikut terbawa.
  const dipilih = useMemo(() => {
    if (!peta) return new Set<number>();
    const s = new Set<number>();
    peta.bagian.forEach((b, i) => { if (b.bagian !== "dibuang" && !batal.has(i)) s.add(i); });
    return s;
  }, [peta, batal]);

  const targetPeta = useMemo(
    () => (peta ? targetTerpilih(peta.bagian, dipilih, target) : new Map<number, number>()),
    [peta, dipilih, target],
  );

  const cek = useMemo(() => (inggris.trim() ? periksaInggris(inggris) : null), [inggris]);

  const kataTerpilih = peta ? peta.bagian.reduce((n, b, i) => n + (dipilih.has(i) ? b.jumlahKata : 0), 0) : 0;
  const kataTarget = [...targetPeta.values()].reduce((n, v) => n + v, 0);
  const dapatDipilih = peta ? peta.bagian.filter((b) => b.bagian !== "dibuang").length : 0;

  return (
    <>
      <section className="al-card">
        <Kepala
          ikon={IKON.naskah}
          judul="Naskah Inggris"
          sub="Pilih bab → petakan ke bagian jurnal → periksa ragam bahasanya"
        />
        <p className="al-note">
          Bukan mengarang jurnal baru — mengubah skripsi yang <b>sudah Anda pertahankan sendiri</b> menjadi artikel.
          Dua hal yang membuat naskah penulis Indonesia ditolak sebelum isinya dibaca: strukturnya masih BAB I–V, dan
          ragam bahasanya terjemahan harfiah. Keduanya diperiksa di peramban, tanpa AI.
        </p>

        <div className="al-filter">
          <button type="button" className={mode === "struktur" ? "on" : ""} onClick={() => setMode("struktur")}>1 · Struktur bab</button>
          <button type="button" className={mode === "ragam" ? "on" : ""} onClick={() => setMode("ragam")}>2 · Ragam Inggris</button>
        </div>

        {mode === "struktur" ? (
          <>
            <label className="al-field">
              <span>Daftar isi atau seluruh naskah skripsi</span>
              <textarea value={skripsi} onChange={(e) => setSkripsi(e.target.value)} rows={8}
                placeholder={"BAB I PENDAHULUAN\n1.1 Latar Belakang\n…"} />
            </label>

            <h3 className="al-h4">Target panjang artikel</h3>
            <div className="al-tiles">
              {PANJANG.map((p) => (
                <button key={p.nilai} type="button" className={`al-tile ${target === p.nilai ? "on" : ""}`}
                  aria-pressed={target === p.nilai} onClick={() => setTarget(p.nilai)}>
                  <b>{p.nama}</b><small>{p.ket}</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <label className="al-field">
              <span>Naskah berbahasa Inggris Anda</span>
              <textarea value={inggris} onChange={(e) => setInggris(e.target.value)} rows={8} placeholder="Paste your English draft here…" />
            </label>
            <div className="al-linkrow">
              <button type="button" className="al-link" onClick={() => setInggris(CONTOH_INGGRIS)}>Isi dengan contoh</button>
              {inggris && <button type="button" className="al-link" onClick={() => setInggris("")}>Kosongkan</button>}
            </div>
          </>
        )}
      </section>

      {mode === "struktur" && peta && peta.bagian.length > 0 && (
        <section className="al-card">
          <div className="al-stats">
            <div className="al-stat"><b>{kataTerpilih.toLocaleString("id-ID")}</b><span>kata terpilih</span></div>
            <div className="al-stat ok"><b>{kataTarget.toLocaleString("id-ID")}</b><span>kata target</span></div>
            <div className="al-stat warn">
              {/* Anggaran dapat melebihi sumber bila hanya sedikit bab dipilih.
                  Persentase negatif tidak berarti apa-apa, jadi dijepit di nol. */}
              <b>{Math.max(0, kataTerpilih > 0 ? Math.round((1 - kataTarget / kataTerpilih) * 100) : 0)}%</b>
              <span>harus dipangkas</span>
            </div>
          </div>

          <div className="al-pickhead">
            <h3>Pilih Bab</h3>
            <span>{dipilih.size} dari {dapatDipilih} bab dibawa ke naskah</span>
            <span className="al-acts">
              <button type="button" className="al-mini" onClick={() => setBatal(new Set())}>Semua</button>
              <button type="button" className="al-mini"
                onClick={() => setBatal(new Set(peta.bagian.map((_, i) => i)))}>Kosongkan</button>
            </span>
          </div>

          <ul className="al-chaps">
            {peta.bagian.map((b, i) => {
              const buang = b.bagian === "dibuang";
              const on = dipilih.has(i);
              const tgt = targetPeta.get(i) ?? 0;
              const rasio = b.jumlahKata > 0 ? Math.min(100, (tgt / b.jumlahKata) * 100) : 0;
              return (
                <li key={`${b.judul}-${i}`}>
                  <button
                    type="button"
                    className={`al-chap ${on ? "on" : ""} ${buang ? "mati" : ""}`}
                    aria-pressed={on}
                    disabled={buang}
                    onClick={() => setBatal((k) => {
                      const n = new Set(k);
                      if (n.has(i)) n.delete(i); else n.add(i);
                      return n;
                    })}
                  >
                    <span className="al-box"><Ic d={IKON.centang} /></span>
                    <span>
                      <span className="al-chap-atas">
                        <b>{b.judul}</b>
                        <span className={`al-badge ${buang ? "buang" : ""}`}>{BAGIAN_LABEL[b.bagian]}</span>
                      </span>
                      <span className="al-chap-kata">
                        {b.jumlahKata.toLocaleString("id-ID")} kata
                        {!buang && on && <> → <b>{tgt.toLocaleString("id-ID")} kata</b></>}
                        {buang && " → tidak dibawa"}
                      </span>
                      {!buang && on && <span className="al-bar"><i style={{ width: `${rasio}%` }} /></span>}
                      <span className="al-chap-catatan">{b.catatan}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {peta.takTerpetakan.length > 0 && (
            <>
              <h4 className="al-h4">Belum dapat dipetakan</h4>
              <ul className="al-plain">{peta.takTerpetakan.map((j) => <li key={j}>{j}</li>)}</ul>
              <p className="al-tail">
                Judul ini tidak cocok dengan pola mana pun. Anda yang paling tahu isinya — menebak akan lebih berbahaya
                daripada mengaku tidak tahu.
              </p>
            </>
          )}
        </section>
      )}

      {mode === "struktur" && skripsi.trim() && peta && peta.bagian.length === 0 && (
        <section className="al-card">
          <p className="al-galat">
            Tidak ada judul bab yang dikenali. Pastikan tiap judul berada pada barisnya sendiri, misalnya
            &ldquo;1.1 Latar Belakang&rdquo;.
          </p>
        </section>
      )}

      {mode === "ragam" && cek && (
        <section className="al-card">
          <div className="al-stats">
            <div className="al-stat"><b>{cek.jumlahKata.toLocaleString("id-ID")}</b><span>kata</span></div>
            <div className="al-stat"><b>{cek.rataKataPerKalimat}</b><span>kata/kalimat</span></div>
            <div className="al-stat"><b>{cek.kalimatPasifPersen}%</b><span>kalimat pasif</span></div>
            <div className={`al-stat ${cek.temuan.length > 0 ? "warn" : "ok"}`}><b>{cek.temuan.length}</b><span>temuan</span></div>
          </div>

          {cek.temuan.length === 0 ? (
            <p className="al-good">
              Tidak ada pola yang biasa ditandai peninjau. Ini bukan jaminan bebas kesalahan — pemeriksa ini hanya
              menangkap pola yang paling sering muncul pada naskah penulis Indonesia.
            </p>
          ) : (
            <ul className="al-list">
              {cek.temuan.map((t, i) => (
                <li key={`${t.posisi}-${i}`} className={`al-item ${KELAS_ING[t.berat]}`}>
                  <div className="al-item-atas">
                    <span className="al-tag">{BERAT_INGGRIS_LABEL[t.berat]}</span>
                    <code>{t.kutipan}</code>
                  </div>
                  <p>{t.pesan}</p>
                  {t.saran && <p className="al-fix">Coba: <b>{t.saran}</b></p>}
                </li>
              ))}
            </ul>
          )}

          <p className="al-tail">
            Kadar kalimat pasif bukan kesalahan — ia hanya ditampilkan sebagai angka. Di atas sekitar 40%, naskah
            biasanya mulai sulit diikuti peninjau.
          </p>
        </section>
      )}
    </>
  );
}

/* ==========================================================================
   PERIKSA BAHASA
   ========================================================================== */

const CONTOH_BAHASA =
  "Penelitian ini bertujuan untuk menganalisa pengaruh literasi digital terhadap " +
  "kemampuan mahasiswa dalam menyaring informasi . Data di peroleh melalui kuesioner " +
  "yang disebarkan pada bulan januari 2026. Sehingga hasil penelitian ini adalah " +
  "merupakan gambaran awal mengenai kondisi tersebut.";

function PeriksaBahasa() {
  const [teks, setTeks] = useState("");
  const [saring, setSaring] = useState<Berat | "semua">("semua");

  const hasil = useMemo(() => (teks.trim() ? periksaBahasa(teks) : null), [teks]);
  const tampil = useMemo(() => {
    if (!hasil) return [];
    return saring === "semua" ? hasil.temuan : hasil.temuan.filter((t) => t.berat === saring);
  }, [hasil, saring]);

  return (
    <>
      <section className="al-card">
        <Kepala
          ikon={IKON.bahasa}
          judul="Periksa Bahasa"
          sub="Tempel naskah → periksa ejaan, kata baku, dan kalimat efektif menurut PUEBI"
        />
        <p className="al-note">
          Penelitian atas karya tulis mahasiswa Indonesia menemukan sebagian besar kesalahan justru ada di tataran
          ejaan — kata depan, huruf kapital, tanda baca, dan kata tidak baku. Diperiksa di sini tanpa AI,{" "}
          <b>dan tanpa naskah Anda meninggalkan perangkat ini.</b>
        </p>

        <label className="al-field">
          <span>Naskah Anda</span>
          <textarea value={teks} onChange={(e) => setTeks(e.target.value)} rows={9}
            placeholder="Tempelkan satu bab, satu paragraf, atau seluruh draf…" />
        </label>
        <div className="al-linkrow">
          <button type="button" className="al-link" onClick={() => setTeks(CONTOH_BAHASA)}>Isi dengan contoh</button>
          {teks && <button type="button" className="al-link" onClick={() => setTeks("")}>Kosongkan</button>}
        </div>
      </section>

      {hasil && (
        <section className="al-card">
          <div className="al-stats">
            <div className="al-stat"><b>{hasil.jumlahKata.toLocaleString("id-ID")}</b><span>kata</span></div>
            <div className="al-stat"><b>{hasil.jumlahKalimat}</b><span>kalimat</span></div>
            <div className="al-stat"><b>{hasil.rataKataPerKalimat}</b><span>kata/kalimat</span></div>
            <div className={`al-stat ${hasil.temuan.length > 0 ? "warn" : "ok"}`}><b>{hasil.temuan.length}</b><span>temuan</span></div>
          </div>

          {hasil.temuan.length > 0 && (
            <div className="al-filter">
              <button type="button" className={saring === "semua" ? "on" : ""} onClick={() => setSaring("semua")}>
                Semua ({hasil.temuan.length})
              </button>
              {(["salah", "sebaiknya", "gaya"] as Berat[]).map((b) => {
                const n = hasil.temuan.filter((t) => t.berat === b).length;
                if (n === 0) return null;
                return (
                  <button key={b} type="button" className={saring === b ? "on" : ""} onClick={() => setSaring(b)}>
                    {BERAT_LABEL[b]} ({n})
                  </button>
                );
              })}
            </div>
          )}

          {hasil.temuan.length === 0 ? (
            <p className="al-good">
              Tidak ada temuan pada aturan yang diperiksa. Ini bukan jaminan bebas kesalahan — pemeriksa ini hanya
              menangkap pola yang paling sering muncul.
            </p>
          ) : (
            <ul className="al-list">
              {tampil.map((t, i) => (
                <li key={`${t.posisi}-${t.aturan}-${i}`} className={`al-item ${KELAS_BERAT[t.berat]}`}>
                  <div className="al-item-atas">
                    <span className="al-tag">{t.aturan}</span>
                    <code>{t.kutipan}</code>
                  </div>
                  <p>{t.pesan}</p>
                  {t.saran && <p className="al-fix">Ganti menjadi <b>{t.saran}</b></p>}
                </li>
              ))}
            </ul>
          )}

          <p className="al-tail">
            Pemeriksa ini mengikuti PUEBI dan KBBI untuk pola yang paling sering keliru. Ia tidak menggantikan pembacaan
            dosen pembimbing, dan kutipan langsung sengaja dilewati agar tidak salah menandai.
          </p>
        </section>
      )}
    </>
  );
}
