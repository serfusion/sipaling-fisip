"use client";

import { useMemo, useState } from "react";
import { Ic, IKON, Kepala, Rinci } from "./ikon";
import { periksaBahasa, BERAT_LABEL, type Berat } from "@/lib/bahasa-check";
import { METRIK_TIDAK_DIAKUI, PITA_LABEL, type Hasil, type Tingkat } from "@/lib/journal-radar";
import { PUTUSAN_LABEL, type HasilRujukan, type Putusan, type RingkasanSitasi } from "@/lib/citation-check";
import type { Project } from "@/lib/project";

const KELAS_PUTUSAN: Record<Putusan, string> = {
  terverifikasi: "ok", "beda-rincian": "warn", "tidak-ditemukan": "bad", "tak-dapat-diperiksa": "abu",
};
const KELAS_TINGKAT: Record<Tingkat, string> = { berat: "bad", sedang: "warn", ringan: "warn", positif: "ok" };
const KELAS_BERAT: Record<Berat, string> = { salah: "bad", sebaiknya: "warn", gaya: "abu" };

/* ========================= VERIFIKASI SITASI ========================= */

const CONTOH_SITASI = `Sugiyono. (2019). Metode Penelitian Kuantitatif, Kualitatif, dan R&D. Bandung: Alfabeta.

Kaplan, A. M., & Haenlein, M. (2010). Users of the world, unite! The challenges and opportunities of Social Media. Business Horizons, 53(1), 59-68.

Wijaya, B. S. (2021). Kerangka literasi algoritmik untuk mahasiswa Asia Tenggara. Jurnal Komunikasi Digital, 14(3), 201-219.

Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.`;

export function PanelSitasi({
  project, ubah,
}: { project: Project | null; ubah: (p: Partial<Project>) => void }) {
  const [lokal, setLokal] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [hasil, setHasil] = useState<HasilRujukan[] | null>(null);
  const [ringkasan, setRingkasan] = useState<RingkasanSitasi | null>(null);

  // Bila ada project, daftar pustaka disimpan di sana supaya tidak perlu
  // ditempel ulang setiap kali. Tanpa project, alat tetap bisa dipakai.
  const daftar = project ? project.daftarPustaka : lokal;
  const setDaftar = (nilai: string) => (project ? ubah({ daftarPustaka: nilai }) : setLokal(nilai));

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
        <Kepala ikon={IKON.sitasi} judul="Pastikan tiap referensi Anda benar-benar ada"
          sub="Tempel daftar pustaka → diadu ke Crossref dan OpenAlex → lihat mana yang nyata" />
        <Rinci>
          <p>
            Rujukan karangan AI biasanya terlihat wajar: nama penulis nyata, jurnal nyata, tahun masuk akal, tetapi
            karyanya tidak pernah terbit. Karena tidak terlihat cacat, rujukan seperti itu sering lolos sampai sidang.
          </p>
        </Rinci>

        <form onSubmit={periksa}>
          <label className="al-field">
            <span>Daftar pustaka {project && <em className="al-dari">tersimpan di project</em>}</span>
            <textarea value={daftar} onChange={(e) => setDaftar(e.target.value)} rows={9}
              placeholder="Satu rujukan per baris, dari skripsi Anda atau dari jawaban AI mana pun." />
          </label>
          <div className="al-linkrow">
            <button type="button" className="al-link" onClick={() => setDaftar(CONTOH_SITASI)}>Isi dengan contoh</button>
            {daftar && <button type="button" className="al-link" onClick={() => { setDaftar(""); setHasil(null); }}>Kosongkan</button>}
          </div>
          <button type="submit" className="al-btn" disabled={memuat || !daftar.trim()}>
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
                  {h.selisih.length > 0 && <ul className="al-sub">{h.selisih.map((d) => <li key={d}>{d}</li>)}</ul>}
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
            <b>Tidak ditemukan bukan berarti palsu.</b> Buku, skripsi, dan peraturan memang tidak terdaftar di
            Crossref maupun OpenAlex, jadi ditandai tidak dapat diperiksa.
          </p>
          <button type="button" className="al-print" onClick={() => window.print()}>Cetak atau simpan sebagai PDF</button>
        </section>
      )}
    </>
  );
}

/* ========================= RADAR JURNAL ========================= */

export function PanelRadar({
  project, ubah,
}: { project: Project | null; ubah: (p: Partial<Project>) => void }) {
  const [lokal, setLokal] = useState("");
  const [sinta, setSinta] = useState(false);
  const [metrik, setMetrik] = useState<string[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [hasil, setHasil] = useState<Hasil | null>(null);

  const issn = project ? project.issnTujuan : lokal;
  const setIssn = (n: string) => (project ? ubah({ issnTujuan: n }) : setLokal(n));

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
        <Kepala ikon={IKON.radar} judul="Periksa jurnalnya dulu, baru kirim naskah"
          sub="Masukkan ISSN → periksa DOAJ, Crossref, OpenAlex → lihat tanda bahayanya beserta bukti" />
        <p className="al-note">Periksa jurnalnya sebelum naskah dikirim.</p>
        <Rinci>
          <p>
            Setelah naskah masuk, permintaan penarikan sering ditolak. Selama penarikan belum dikonfirmasi, naskah itu
            tidak boleh dikirim ke jurnal lain.
          </p>
        </Rinci>

        <form onSubmit={periksa}>
          <label className="al-field al-field-kecil">
            <span>ISSN jurnal {project && <em className="al-dari">tersimpan di project</em>}</span>
            <input value={issn} onChange={(e) => setIssn(e.target.value)} placeholder="2089-3477"
              inputMode="numeric" autoComplete="off" required />
            <small>Tercantum di halaman depan jurnal atau di bagian About.</small>
          </label>

          <h3 className="al-h4">Yang tidak bisa diperiksa otomatis</h3>
          <ul className="al-chaps al-chaps-rapat">
            <li>
              <button type="button" className={`al-chap ${sinta ? "on" : ""}`} aria-pressed={sinta}
                onClick={() => setSinta(!sinta)}>
                <span className="al-box"><Ic d={IKON.centang} /></span>
                <span>
                  <span className="al-chap-atas"><b>Terakreditasi SINTA</b></span>
                  <span className="al-chap-catatan">SINTA tidak menyediakan API publik. Periksa sendiri lalu centang bila benar.</span>
                </span>
              </button>
            </li>
          </ul>

          <p className="al-note">Buka situs jurnalnya, lalu centang metrik yang dipajang di sana.</p>
          <Rinci judul="Kenapa metrik ini jadi tanda bahaya?">
            <p>
              Tidak satu pun diterbitkan lembaga pengindeks yang diakui. Memajangnya biasanya untuk meyakinkan
              penulis yang tidak sempat memeriksa.
            </p>
          </Rinci>
          <div className="al-tiles">
            {METRIK_TIDAK_DIAKUI.slice(0, 8).map((m) => {
              const aktif = metrik.includes(m);
              return (
                <button key={m} type="button" className={`al-tile ${aktif ? "on" : ""}`} aria-pressed={aktif}
                  onClick={() => setMetrik((k) => (aktif ? k.filter((x) => x !== m) : [...k, m]))}>
                  <b>{m}</b><small>{aktif ? "Terlihat di situs" : "Tidak terlihat"}</small>
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
      </p>
      <button type="button" className="al-print" onClick={() => window.print()}>Cetak atau simpan sebagai PDF</button>
    </section>
  );
}

/* ========================= PERIKSA BAHASA ========================= */

const CONTOH_BAHASA =
  "Penelitian ini bertujuan untuk menganalisa pengaruh literasi digital terhadap " +
  "kemampuan mahasiswa dalam menyaring informasi . Data di peroleh melalui kuesioner " +
  "yang disebarkan pada bulan januari 2026. Sehingga hasil penelitian ini adalah " +
  "merupakan gambaran awal mengenai kondisi tersebut.";

export function PanelBahasa({ project }: { project: Project | null }) {
  const [lokal, setLokal] = useState("");
  const [saring, setSaring] = useState<Berat | "semua">("semua");
  const [pakaiProject, setPakaiProject] = useState(true);

  const dariProject = useMemo(
    () => (project ? project.bab.map((b) => `${b.judul}\n${b.isi}`).join("\n\n") : ""),
    [project],
  );
  const teks = project && pakaiProject && dariProject.trim() ? dariProject : lokal;

  const hasil = useMemo(() => (teks.trim() ? periksaBahasa(teks) : null), [teks]);
  const tampil = useMemo(() => {
    if (!hasil) return [];
    return saring === "semua" ? hasil.temuan : hasil.temuan.filter((t) => t.berat === saring);
  }, [hasil, saring]);

  return (
    <>
      <section className="al-card">
        <Kepala ikon={IKON.bahasa} judul="Periksa ragam ilmiah tulisan Anda"
          sub="Ejaan, kata baku, tanda baca, dan kalimat efektif menurut PUEBI" />
        <p className="al-note">
          Ejaan, kata depan, huruf kapital, tanda baca, dan kata tidak baku. <b>Naskah tidak dikirim ke mana pun.</b>
        </p>

        {project && dariProject.trim() && (
          <div className="al-filter">
            <button type="button" className={pakaiProject ? "on" : ""} onClick={() => setPakaiProject(true)}>
              Naskah dari project
            </button>
            <button type="button" className={!pakaiProject ? "on" : ""} onClick={() => setPakaiProject(false)}>
              Tempel teks lain
            </button>
          </div>
        )}

        {(!project || !pakaiProject || !dariProject.trim()) && (
          <>
            <label className="al-field">
              <span>Naskah Anda</span>
              <textarea value={lokal} onChange={(e) => setLokal(e.target.value)} rows={9}
                placeholder="Tempelkan satu bab, satu paragraf, atau seluruh draf." />
            </label>
            <div className="al-linkrow">
              <button type="button" className="al-link" onClick={() => setLokal(CONTOH_BAHASA)}>Isi dengan contoh</button>
              {lokal && <button type="button" className="al-link" onClick={() => setLokal("")}>Kosongkan</button>}
            </div>
          </>
        )}
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
            <p className="al-good">Tidak ada temuan pada aturan yang diperiksa. Ini bukan jaminan bebas kesalahan.</p>
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
            Mengikuti PUEBI dan KBBI. Kutipan langsung dilewati agar tidak salah ditandai.
          </p>
        </section>
      )}
    </>
  );
}
