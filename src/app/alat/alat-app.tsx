"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { periksaBahasa, BERAT_LABEL, type Berat, type Ringkasan } from "@/lib/bahasa-check";
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
  periksaInggris,
  petakanNaskah,
  type BeratInggris,
} from "@/lib/manuscript";

type Tab = "radar" | "sitasi" | "naskah" | "bahasa";

const PUTUSAN_KELAS: Record<Putusan, string> = {
  terverifikasi: "at-positif",
  "beda-rincian": "at-sedang",
  "tidak-ditemukan": "at-berat",
  "tak-dapat-diperiksa": "at-abu",
};

const BERAT_ING_KELAS: Record<BeratInggris, string> = {
  ganti: "at-berat",
  rapikan: "at-sedang",
  pertimbangkan: "at-ringan",
};

const TINGKAT_KELAS: Record<Tingkat, string> = {
  berat: "at-berat",
  sedang: "at-sedang",
  ringan: "at-ringan",
  positif: "at-positif",
};

const BERAT_KELAS: Record<Berat, string> = {
  salah: "at-berat",
  sebaiknya: "at-sedang",
  gaya: "at-ringan",
};

export default function AlatApp() {
  const [tab, setTab] = useState<Tab>("sitasi");

  return (
    <div className="at-shell">
      <header className="at-head">
        <div className="at-head-in">
          <Link href="/" className="at-back">← Portal Mahasiswa</Link>
          <div>
            <p className="at-eyebrow">UNTUK MAHASISWA FISIP</p>
            <h1>Cakrawala</h1>
          </div>
          <p className="at-sub">
            Empat pemeriksa untuk skripsi dan naskah jurnal Anda. Gratis, tanpa akun, tanpa AI.
            Tulisan Anda baru keluar dari perangkat ini kalau Anda sendiri yang menekan tombol periksa.
          </p>
        </div>
      </header>

      <nav className="at-tabs" aria-label="Pilih alat">
        <button type="button" className={tab === "sitasi" ? "on" : ""} onClick={() => setTab("sitasi")}>
          Verifikasi Sitasi
        </button>
        <button type="button" className={tab === "radar" ? "on" : ""} onClick={() => setTab("radar")}>
          Radar Jurnal
        </button>
        <button type="button" className={tab === "naskah" ? "on" : ""} onClick={() => setTab("naskah")}>
          Naskah Inggris
        </button>
        <button type="button" className={tab === "bahasa" ? "on" : ""} onClick={() => setTab("bahasa")}>
          Periksa Bahasa
        </button>
      </nav>

      <main className="at-main">
        {tab === "radar" && <RadarJurnal />}
        {tab === "sitasi" && <VerifikasiSitasi />}
        {tab === "naskah" && <NaskahInggris />}
        {tab === "bahasa" && <PeriksaBahasa />}
      </main>
    </div>
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
    setMemuat(true);
    setGalat("");
    setHasil(null);
    try {
      const balasan = await fetch("/api/journal-radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issn, sinta, metrik }),
      });
      const data = (await balasan.json()) as { success?: boolean; message?: string; hasil?: Hasil };
      if (!balasan.ok || !data.success || !data.hasil) {
        throw new Error(data.message || "Pemeriksaan gagal.");
      }
      setHasil(data.hasil);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Pemeriksaan gagal.");
    } finally {
      setMemuat(false);
    }
  }

  return (
    <section className="at-panel">
      <div className="at-intro">
        <h2>Periksa jurnalnya dulu, baru kirim naskah</h2>
        <p>
          Begitu naskah masuk, permintaan penarikan sering ditolak. Selama penarikan belum dikonfirmasi, naskah
          itu tidak boleh Anda kirim ke jurnal lain. Jadi periksa sekarang, bukan nanti.
        </p>
      </div>

      <form className="at-form" onSubmit={periksa}>
        <label className="at-field">
          <span>ISSN jurnal</span>
          <input
            value={issn}
            onChange={(e) => setIssn(e.target.value)}
            placeholder="2089-3477"
            inputMode="numeric"
            autoComplete="off"
            required
          />
          <small>Ada di halaman depan jurnal atau di bagian &ldquo;About&rdquo;.</small>
        </label>

        <fieldset className="at-fieldset">
          <legend>Yang tidak bisa diperiksa otomatis</legend>

          <label className="at-check">
            <input type="checkbox" checked={sinta} onChange={(e) => setSinta(e.target.checked)} />
            <span>
              <b>Terakreditasi SINTA</b>
              <small>SINTA tidak punya API publik. Cek sendiri, lalu centang bila benar.</small>
            </span>
          </label>

          <p className="at-legend-note">
            Buka situs jurnalnya, lalu centang metrik yang dipajang di sana. Tidak satu pun metrik ini
            diterbitkan lembaga pengindeks yang diakui. Memajangnya adalah tanda bahaya.
          </p>
          <div className="at-chips">
            {METRIK_TIDAK_DIAKUI.slice(0, 8).map((m) => {
              const aktif = metrik.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  className={`at-chip ${aktif ? "on" : ""}`}
                  aria-pressed={aktif}
                  onClick={() => setMetrik((kini) => (aktif ? kini.filter((x) => x !== m) : [...kini, m]))}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </fieldset>

        <button type="submit" className="at-submit" disabled={memuat}>
          {memuat ? "Memeriksa ke DOAJ, Crossref, dan OpenAlex…" : "Periksa jurnal ini"}
        </button>
      </form>

      {galat && <p className="at-galat" role="alert">{galat}</p>}

      {hasil && <LaporanRadar hasil={hasil} />}
    </section>
  );
}

function LaporanRadar({ hasil }: { hasil: Hasil }) {
  const berat = hasil.sinyal.filter((s) => s.tingkat === "berat");
  const lain = hasil.sinyal.filter((s) => s.tingkat === "sedang" || s.tingkat === "ringan");
  const positif = hasil.sinyal.filter((s) => s.tingkat === "positif");

  return (
    <article className={`at-lapor pita-${hasil.pita}`}>
      <header className="at-lapor-atas">
        <p className="at-pita">{PITA_LABEL[hasil.pita]}</p>
        <h3>{hasil.nama}</h3>
        <p className="at-putusan">
          ISSN {hasil.issn.join(", ")} · {hasil.putusan}
        </p>
      </header>

      <div className="at-lapor-isi">
        {berat.length > 0 && <Kelompok judul="Tanda bahaya" sinyal={berat} />}
        {lain.length > 0 && <Kelompok judul="Temuan pendukung" sinyal={lain} />}
        {positif.length > 0 && <Kelompok judul="Yang sudah wajar" sinyal={positif} />}

        {hasil.takTerperiksa.length > 0 && (
          <>
            <h4>Tidak dapat diperiksa</h4>
            <ul className="at-takperiksa">
              {hasil.takTerperiksa.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="at-catatan">
              Pemeriksaan yang gagal berjalan tidak dihitung aman, tidak pula dihitung bahaya. Makin banyak yang
              tidak terperiksa, makin sedikit yang bisa disimpulkan.
            </p>
          </>
        )}

        <h4>Langkah Anda</h4>
        <ol className="at-langkah">
          {hasil.langkah.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>

        <p className="at-sangkalan">
          Ini penilaian risiko dari sinyal publik yang bisa Anda telusuri ulang, bukan vonis atas jurnalnya.
          Bawa ke dosen pembimbing, lalu putuskan bersama.
        </p>

        <button type="button" className="at-cetak" onClick={() => window.print()}>
          Cetak atau simpan sebagai PDF
        </button>
      </div>
    </article>
  );
}

function Kelompok({ judul, sinyal }: { judul: string; sinyal: Hasil["sinyal"] }) {
  return (
    <>
      <h4>{judul}</h4>
      <ul className="at-sinyal">
        {sinyal.map((s) => (
          <li key={s.id} className={TINGKAT_KELAS[s.tingkat]}>
            <div className="at-sinyal-atas">
              <b>{s.judul}</b>
              <span className="at-bobot">{s.bobot > 0 ? `+${s.bobot}` : s.bobot}</span>
            </div>
            <p>{s.bukti}</p>
            <small>Sumber: {s.sumber}</small>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ==========================================================================
   PERIKSA BAHASA
   ========================================================================== */

const CONTOH =
  "Penelitian ini bertujuan untuk menganalisa pengaruh literasi digital terhadap " +
  "kemampuan mahasiswa dalam menyaring informasi . Data di peroleh melalui kuesioner " +
  "yang disebarkan pada bulan januari 2026. Sehingga hasil penelitian ini adalah " +
  "merupakan gambaran awal mengenai kondisi tersebut.";

function PeriksaBahasa() {
  const [teks, setTeks] = useState("");
  const [saring, setSaring] = useState<Berat | "semua">("semua");

  // Seluruhnya dihitung di peramban. Naskah tidak pernah dikirim ke server.
  const hasil: Ringkasan | null = useMemo(() => (teks.trim() ? periksaBahasa(teks) : null), [teks]);

  const tampil = useMemo(() => {
    if (!hasil) return [];
    return saring === "semua" ? hasil.temuan : hasil.temuan.filter((t) => t.berat === saring);
  }, [hasil, saring]);

  return (
    <section className="at-panel">
      <div className="at-intro">
        <h2>Periksa ragam ilmiah tulisan Anda</h2>
        <p>
          Kesalahan terbanyak pada karya tulis mahasiswa bukan soal isi, melainkan ejaan: kata depan, huruf
          kapital, tanda baca, dan kata tidak baku. Semuanya diperiksa di sini tanpa AI,
          <b> dan tanpa naskah Anda meninggalkan perangkat ini.</b>
        </p>
      </div>

      <div className="at-editor">
        <label className="at-field at-field-wide">
          <span>Tempelkan naskah Anda</span>
          <textarea
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            rows={10}
            placeholder="Tempelkan satu paragraf, satu bab, atau seluruh draf…"
          />
        </label>
        <div className="at-editor-aksi">
          <button type="button" className="at-tautan" onClick={() => setTeks(CONTOH)}>
            Isi dengan contoh
          </button>
          {teks && (
            <button type="button" className="at-tautan" onClick={() => setTeks("")}>
              Kosongkan
            </button>
          )}
        </div>
      </div>

      {hasil && (
        <>
          <div className="at-angka">
            <div><b>{hasil.jumlahKata.toLocaleString("id-ID")}</b><span>kata</span></div>
            <div><b>{hasil.jumlahKalimat}</b><span>kalimat</span></div>
            <div><b>{hasil.rataKataPerKalimat}</b><span>rata-rata kata/kalimat</span></div>
            <div className={hasil.temuan.length > 0 ? "at-angka-siaga" : ""}>
              <b>{hasil.temuan.length}</b><span>temuan</span>
            </div>
          </div>

          {hasil.perAturan.length > 0 && (
            <div className="at-saring" role="group" aria-label="Saring temuan">
              <button type="button" className={saring === "semua" ? "on" : ""} onClick={() => setSaring("semua")}>
                Semua ({hasil.temuan.length})
              </button>
              {(["salah", "sebaiknya", "gaya"] as Berat[]).map((b) => {
                const jumlah = hasil.temuan.filter((t) => t.berat === b).length;
                if (jumlah === 0) return null;
                return (
                  <button key={b} type="button" className={saring === b ? "on" : ""} onClick={() => setSaring(b)}>
                    {BERAT_LABEL[b]} ({jumlah})
                  </button>
                );
              })}
            </div>
          )}

          {hasil.temuan.length === 0 ? (
            <p className="at-bersih">
              Bersih untuk aturan yang diperiksa. Ini bukan jaminan bebas kesalahan: yang ditangkap di sini hanya
              pola yang paling sering keliru.
            </p>
          ) : (
            <ul className="at-temuan">
              {tampil.map((t, i) => (
                <li key={`${t.posisi}-${t.aturan}-${i}`} className={BERAT_KELAS[t.berat]}>
                  <div className="at-temuan-atas">
                    <span className="at-aturan">{t.aturan}</span>
                    <code>{t.kutipan}</code>
                  </div>
                  <p>{t.pesan}</p>
                  {t.saran && (
                    <p className="at-saran">
                      Ganti menjadi <b>{t.saran}</b>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="at-sangkalan">
            Aturannya mengikuti PUEBI dan KBBI. Ini tidak menggantikan pembacaan dosen pembimbing, dan kutipan
            langsung sengaja dilewati supaya tidak salah tandai.
          </p>
        </>
      )}
    </section>
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
    setMemuat(true);
    setGalat("");
    setHasil(null);
    try {
      const balasan = await fetch("/api/verify-citations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daftar }),
      });
      const data = (await balasan.json()) as {
        success?: boolean; message?: string; hasil?: HasilRujukan[]; ringkasan?: RingkasanSitasi;
      };
      if (!balasan.ok || !data.success || !data.hasil) throw new Error(data.message || "Pemeriksaan gagal.");
      setHasil(data.hasil);
      setRingkasan(data.ringkasan ?? null);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Pemeriksaan gagal.");
    } finally {
      setMemuat(false);
    }
  }

  const urutan: Putusan[] = ["tidak-ditemukan", "beda-rincian", "tak-dapat-diperiksa", "terverifikasi"];

  return (
    <section className="at-panel">
      <div className="at-intro">
        <h2>Pastikan tiap referensi Anda benar-benar ada</h2>
        <p>
          Referensi fiktif buatan AI naik dua belas kali lipat dalam tiga tahun. Dua pertiganya karangan utuh:
          nama penulis nyata, jurnal nyata, tahun masuk akal, tapi karyanya tidak pernah terbit. Justru karena
          <b> tidak terlihat cacat</b>, referensi seperti ini lolos sampai sidang. Di sini tiap entri diadu ke
          Crossref dan OpenAlex.
        </p>
      </div>

      <form className="at-form" onSubmit={periksa}>
        <label className="at-field at-field-wide">
          <span>Tempelkan daftar pustaka Anda</span>
          <textarea
            value={daftar}
            onChange={(e) => setDaftar(e.target.value)}
            rows={9}
            placeholder="Satu rujukan per baris. Dari daftar pustaka Anda, atau dari jawaban AI mana pun…"
          />
        </label>
        <div className="at-editor-aksi">
          <button type="button" className="at-tautan" onClick={() => setDaftar(CONTOH_SITASI)}>
            Isi dengan contoh
          </button>
          {daftar && (
            <button type="button" className="at-tautan" onClick={() => { setDaftar(""); setHasil(null); }}>
              Kosongkan
            </button>
          )}
        </div>
        <button type="submit" className="at-submit" disabled={memuat}>
          {memuat ? "Mengadu ke Crossref dan OpenAlex…" : "Periksa daftar pustaka"}
        </button>
      </form>

      {galat && <p className="at-galat" role="alert">{galat}</p>}

      {hasil && ringkasan && (
        <>
          <div className="at-angka">
            <div><b>{ringkasan.total}</b><span>rujukan</span></div>
            <div><b>{ringkasan.terverifikasi}</b><span>terverifikasi</span></div>
            <div className={ringkasan.bedaRincian > 0 ? "at-angka-siaga" : ""}>
              <b>{ringkasan.bedaRincian}</b><span>beda rincian</span>
            </div>
            <div className={ringkasan.tidakDitemukan > 0 ? "at-angka-bahaya" : ""}>
              <b>{ringkasan.tidakDitemukan}</b><span>tidak ditemukan</span>
            </div>
            <div><b>{ringkasan.takDapatDiperiksa}</b><span>tak dapat diperiksa</span></div>
          </div>
          <p className="at-ringkas">{ringkasan.pesan}</p>

          <ul className="at-temuan">
            {urutan.flatMap((p) =>
              hasil
                .filter((h) => h.putusan === p)
                .map((h) => (
                  <li key={`${h.rujukan.urut}-${p}`} className={PUTUSAN_KELAS[p]}>
                    <div className="at-temuan-atas">
                      <span className="at-aturan">{PUTUSAN_LABEL[p]}</span>
                      <span className="at-nomor">#{h.rujukan.urut}</span>
                    </div>
                    <p className="at-mentah">{h.rujukan.mentah}</p>
                    <p>{h.pesan}</p>
                    {h.selisih.length > 0 && (
                      <ul className="at-selisih">
                        {h.selisih.map((d) => <li key={d}>{d}</li>)}
                      </ul>
                    )}
                    {h.temuan?.judul && (
                      <p className="at-saran">
                        Catatan {h.temuan.sumber}: <b>{h.temuan.judul}</b>
                        {h.temuan.tahun ? ` (${h.temuan.tahun})` : ""}
                        {h.temuan.doi ? ` · ${h.temuan.doi}` : ""}
                      </p>
                    )}
                  </li>
                )),
            )}
          </ul>

          <p className="at-sangkalan">
            <b>Tidak ditemukan bukan berarti palsu.</b>{" "}
            Buku, skripsi, peraturan, dan terbitan lokal memang tidak terdaftar di Crossref maupun OpenAlex.
            Semuanya ditandai &ldquo;tidak dapat diperiksa&rdquo;, bukan dituduh. Yang berstatus{" "}
            <b>tidak ditemukan</b> adalah artikel jurnal yang seharusnya ada di sana, tapi tidak ada. Buka sendiri
            rujukan itu sebelum naskah Anda diserahkan.
          </p>
        </>
      )}
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

function NaskahInggris() {
  const [mode, setMode] = useState<"struktur" | "bahasa">("struktur");
  const [skripsi, setSkripsi] = useState("");
  const [inggris, setInggris] = useState("");
  const [target, setTarget] = useState(7000);

  const peta = useMemo(() => (skripsi.trim() ? petakanNaskah(skripsi, target) : null), [skripsi, target]);
  const cek = useMemo(() => (inggris.trim() ? periksaInggris(inggris) : null), [inggris]);

  return (
    <section className="at-panel">
      <div className="at-intro">
        <h2>Ubah skripsi Anda menjadi artikel jurnal berbahasa Inggris</h2>
        <p>
          Bukan mengarang penelitian baru. Anda mengubah skripsi yang <b>sudah Anda pertahankan sendiri</b>
          {" "}menjadi artikel. Dua hal membuat naskah penulis Indonesia ditolak sebelum isinya dibaca: strukturnya
          masih BAB I sampai V, dan bahasanya terjemahan harfiah. Dua-duanya diperiksa di sini, di perangkat Anda,
          tanpa AI.
        </p>
      </div>

      <div className="at-saring" role="group" aria-label="Pilih pemeriksaan">
        <button type="button" className={mode === "struktur" ? "on" : ""} onClick={() => setMode("struktur")}>
          1 · Struktur BAB ke IMRaD
        </button>
        <button type="button" className={mode === "bahasa" ? "on" : ""} onClick={() => setMode("bahasa")}>
          2 · Ragam akademik Inggris
        </button>
      </div>

      {mode === "struktur" ? (
        <>
          <label className="at-field at-field-wide">
            <span>Tempelkan daftar isi atau seluruh naskah skripsi</span>
            <textarea
              value={skripsi}
              onChange={(e) => setSkripsi(e.target.value)}
              rows={9}
              placeholder={"BAB I PENDAHULUAN\n1.1 Latar Belakang\n…"}
            />
          </label>
          <label className="at-field at-field-kecil">
            <span>Target panjang artikel (kata)</span>
            <input
              type="number"
              value={target}
              min={3000}
              max={12000}
              step={500}
              onChange={(e) => setTarget(Math.max(3000, Math.min(12000, Number(e.target.value) || 7000)))}
            />
            <small>Artikel ilmu sosial umumnya 6.000 sampai 8.000 kata.</small>
          </label>

          {peta && peta.bagian.length > 0 && (
            <>
              <div className="at-angka">
                <div><b>{peta.totalKataSkripsi.toLocaleString("id-ID")}</b><span>kata di skripsi</span></div>
                <div><b>{peta.totalKataTarget.toLocaleString("id-ID")}</b><span>kata target</span></div>
                <div className="at-angka-siaga">
                  <b>{Math.round(peta.pemampatan * 100)}%</b><span>harus dipangkas</span>
                </div>
              </div>

              <ul className="at-peta">
                {peta.bagian.map((b, i) => (
                  <li key={`${b.judul}-${i}`} className={b.bagian === "dibuang" ? "at-buang" : ""}>
                    <div className="at-peta-atas">
                      <b>{b.judul}</b>
                      <span className="at-panah">→</span>
                      <span className="at-tujuan">{BAGIAN_LABEL[b.bagian]}</span>
                    </div>
                    <p className="at-peta-kata">
                      {b.jumlahKata.toLocaleString("id-ID")} kata
                      {b.targetKata !== null && (
                        <> → <b>{b.targetKata.toLocaleString("id-ID")} kata</b></>
                      )}
                    </p>
                    <p>{b.catatan}</p>
                  </li>
                ))}
              </ul>

              {peta.takTerpetakan.length > 0 && (
                <>
                  <h4 className="at-subjudul">Belum dapat dipetakan</h4>
                  <ul className="at-takperiksa">
                    {peta.takTerpetakan.map((j) => <li key={j}>{j}</li>)}
                  </ul>
                  <p className="at-catatan">
                    Judul ini tidak cocok dengan pola mana pun. Anda yang paling tahu isinya, dan menebak jauh
                    lebih berbahaya daripada mengaku tidak tahu.
                  </p>
                </>
              )}
            </>
          )}
          {skripsi.trim() && peta && peta.bagian.length === 0 && (
            <p className="at-galat">
              Tidak ada judul bab yang dikenali. Pastikan tiap judul berdiri di barisnya sendiri, misalnya
              &ldquo;1.1 Latar Belakang&rdquo;.
            </p>
          )}
        </>
      ) : (
        <>
          <label className="at-field at-field-wide">
            <span>Tempelkan naskah berbahasa Inggris Anda</span>
            <textarea
              value={inggris}
              onChange={(e) => setInggris(e.target.value)}
              rows={9}
              placeholder="Paste your English draft here…"
            />
          </label>
          <div className="at-editor-aksi">
            <button type="button" className="at-tautan" onClick={() => setInggris(CONTOH_INGGRIS)}>
              Isi dengan contoh
            </button>
            {inggris && (
              <button type="button" className="at-tautan" onClick={() => setInggris("")}>Kosongkan</button>
            )}
          </div>

          {cek && (
            <>
              <div className="at-angka">
                <div><b>{cek.jumlahKata.toLocaleString("id-ID")}</b><span>kata</span></div>
                <div><b>{cek.rataKataPerKalimat}</b><span>rata-rata kata/kalimat</span></div>
                <div><b>{cek.kalimatPasifPersen}%</b><span>kalimat pasif</span></div>
                <div className={cek.temuan.length > 0 ? "at-angka-siaga" : ""}>
                  <b>{cek.temuan.length}</b><span>temuan</span>
                </div>
              </div>

              {cek.temuan.length === 0 ? (
                <p className="at-bersih">
                  Bersih dari pola yang biasa ditandai peninjau. Ini bukan jaminan bebas kesalahan: yang ditangkap
                  di sini hanya pola yang paling sering muncul pada naskah penulis Indonesia.
                </p>
              ) : (
                <ul className="at-temuan">
                  {cek.temuan.map((t, i) => (
                    <li key={`${t.posisi}-${i}`} className={BERAT_ING_KELAS[t.berat]}>
                      <div className="at-temuan-atas">
                        <span className="at-aturan">{BERAT_INGGRIS_LABEL[t.berat]}</span>
                        <code>{t.kutipan}</code>
                      </div>
                      <p>{t.pesan}</p>
                      {t.saran && <p className="at-saran">Coba: <b>{t.saran}</b></p>}
                    </li>
                  ))}
                </ul>
              )}

              <p className="at-sangkalan">
                Kadar kalimat pasif bukan kesalahan, hanya angka. Di atas sekitar 40%, naskah biasanya mulai
                sulit diikuti peninjau.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
