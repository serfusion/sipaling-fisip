"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { periksaBahasa, BERAT_LABEL, type Berat, type Ringkasan } from "@/lib/bahasa-check";
import { METRIK_TIDAK_DIAKUI, PITA_LABEL, type Hasil, type Tingkat } from "@/lib/journal-radar";

type Tab = "radar" | "bahasa";

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
  const [tab, setTab] = useState<Tab>("radar");

  return (
    <div className="at-shell">
      <header className="at-head">
        <div className="at-head-in">
          <Link href="/" className="at-back">← Portal Mahasiswa</Link>
          <div>
            <p className="at-eyebrow">ALAT MAHASISWA</p>
            <h1>Alat Bantu Akademik</h1>
          </div>
          <p className="at-sub">
            Gratis, tanpa akun, dan naskah Anda tidak dikirim ke mana pun kecuali Anda menekan tombol periksa jurnal.
          </p>
        </div>
      </header>

      <nav className="at-tabs" aria-label="Pilih alat">
        <button type="button" className={tab === "radar" ? "on" : ""} onClick={() => setTab("radar")}>
          Radar Jurnal
        </button>
        <button type="button" className={tab === "bahasa" ? "on" : ""} onClick={() => setTab("bahasa")}>
          Periksa Bahasa
        </button>
      </nav>

      <main className="at-main">
        {tab === "radar" ? <RadarJurnal /> : <PeriksaBahasa />}
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
        <h2>Periksa jurnal sebelum Anda mengirim naskah</h2>
        <p>
          Setelah naskah masuk, penarikan sering ditolak — dan Anda tidak boleh mengirimkannya ke jurnal lain
          sampai penarikan itu dikonfirmasi. Karena itu pemeriksaan dilakukan sekarang, bukan nanti.
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
          <small>Tercantum di halaman depan jurnal atau di bagian &ldquo;About&rdquo;.</small>
        </label>

        <fieldset className="at-fieldset">
          <legend>Yang tidak bisa diperiksa otomatis</legend>

          <label className="at-check">
            <input type="checkbox" checked={sinta} onChange={(e) => setSinta(e.target.checked)} />
            <span>
              <b>Terakreditasi SINTA</b>
              <small>SINTA tidak menyediakan API publik. Periksa sendiri lalu centang bila benar.</small>
            </span>
          </label>

          <p className="at-legend-note">
            Buka situs jurnalnya, lalu centang metrik yang Anda lihat dipajang di sana. Tidak satu pun dari ini
            diterbitkan lembaga pengindeks yang diakui — memajangnya adalah tanda bahaya.
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
        {berat.length > 0 && <Kelompok judul="Temuan berbobot berat" sinyal={berat} />}
        {lain.length > 0 && <Kelompok judul="Temuan pendukung" sinyal={lain} />}
        {positif.length > 0 && <Kelompok judul="Yang justru wajar" sinyal={positif} />}

        {hasil.takTerperiksa.length > 0 && (
          <>
            <h4>Tidak dapat diperiksa</h4>
            <ul className="at-takperiksa">
              {hasil.takTerperiksa.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="at-catatan">
              Pemeriksaan yang tidak terjadi tidak dihitung sebagai aman maupun sebagai bahaya. Semakin banyak
              yang tidak terperiksa, semakin sedikit yang dapat disimpulkan.
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
          Ini penilaian risiko dari sinyal publik yang dapat diperiksa ulang, bukan putusan tentang jurnal ini.
          Tunjukkan kepada dosen pembimbing Anda dan putuskan bersama.
        </p>

        <button type="button" className="at-cetak" onClick={() => window.print()}>
          Cetak / simpan sebagai PDF
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

  // Seluruhnya dihitung di peramban — naskah tidak pernah dikirim ke server.
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
          Penelitian atas karya tulis mahasiswa Indonesia menemukan sebagian besar kesalahan justru ada di
          tataran ejaan — kata depan, huruf kapital, tanda baca, dan kata tidak baku. Semuanya diperiksa di sini
          tanpa AI, <b>dan tanpa naskah Anda meninggalkan perangkat ini.</b>
        </p>
      </div>

      <div className="at-editor">
        <label className="at-field at-field-wide">
          <span>Tempelkan naskah Anda</span>
          <textarea
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            rows={10}
            placeholder="Tempelkan satu bab, satu paragraf, atau seluruh draf…"
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
            <p className="at-bersih">Tidak ada temuan pada aturan yang diperiksa. Ini bukan jaminan bebas kesalahan — pemeriksa ini hanya menangkap pola yang paling sering muncul.</p>
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
            Pemeriksa ini mengikuti PUEBI dan KBBI untuk pola yang paling sering keliru. Ia tidak menggantikan
            pembacaan dosen pembimbing, dan kutipan langsung sengaja dilewati agar tidak salah menandai.
          </p>
        </>
      )}
    </section>
  );
}
