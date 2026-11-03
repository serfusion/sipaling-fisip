"use client";

// ============================================================
// PAPAN NILAI TUGAS — situs CBT (cbt.<domain>/papan)
//
// Seperti mading: siapa pun dapat melihat nilai tugas yang sudah diterbitkan
// pengajar, diurutkan dari tertinggi. Yang tampil untuk semua orang hanya nama,
// nomor peserta tersamar, nilai, predikat, nilai merah (di bawah batas kritis), dan
// penanda plagiasi.
//
// KETERANGAN NILAI TERKUNCI. Di sebelah nilai merah dan kiriman yang
// terindikasi plagiasi ada tombol 🔒 Keterangan. Isinya — kenapa nilainya
// rendah, kriteria mana yang menurunkan, kalimat mana yang sama dengan
// kiriman lain — hanya terbuka dengan kode SIPALING-TUGAS pemilik baris itu,
// ibarat kata sandi. Server yang memeriksa kodenya (/api/cbt/papan), bukan
// halaman ini.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import KreditCbt from "../kredit";
import { buatLaporanPdf, namaBerkasLaporan, type DataLaporan } from "@/lib/tugas-template";
import { sidikBerkas } from "@/lib/tugas-kode";
import { PENANDA_LABEL, type BarisPublik, type Keterangan, type RingkasPapan } from "@/lib/tugas-papan";

type TugasPapan = {
  id: number; mataKuliah: string; nomor: string; judul: string; pengajar: string; kelas: string;
  terbitPada: string | null; batasKritis: number; jumlah?: number;
};

type HasilKode = {
  tugas: TugasPapan & { terbit: boolean };
  kiriman: {
    kode: string; nama: string; nim: string; asal: string; berkas: string; ukuran: number;
    halaman: number; kata: number; sidik: string; dikumpulkan: string;
  };
  terbit: boolean;
  pesan?: string;
  nilai?: {
    angka: number | null; keadaan: string; predikat: string; rentang: string; peringkat: number | null;
    dari: number; kritis: boolean; batasKritis: number; penanda: string;
  };
  keterangan?: Keterangan;
  rincian?: {
    judul: string;
    kriteria: Array<{ nama: string; bobot: number; skor: number | null; capaian: string }>;
    kelebihan: string[]; perbaikan: Array<{ aspek: string; uraian: string }>; catatan: string;
  } | null;
  laporan?: { template: string; kaki: string; data: DataLaporan } | null;
};

const judulTugas = (t: Pick<TugasPapan, "nomor" | "judul">) => [t.nomor && `Tugas ${t.nomor}`, t.judul].filter(Boolean).join(": ") || "Tugas";
const tanggal = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : "");
const angka = (n: number | null | undefined) => (n === null || n === undefined ? "–" : (Math.round(n * 100) / 100).toFixed(2));

async function bukaKode(kode: string, baris?: number): Promise<HasilKode> {
  const jawab = await fetch("/api/cbt/papan", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kode, baris }),
  });
  const d = await jawab.json().catch(() => ({ success: false, message: `Server menjawab ${jawab.status}.` }));
  if (!jawab.ok || !d.success) throw new Error(d.message || "Kode tidak dapat dibuka.");
  return d as HasilKode;
}

export default function PapanNilai({ awalan = "/cbt" }: { awalan?: string }) {
  const [daftar, setDaftar] = useState<TugasPapan[] | null>(null);
  const [papan, setPapan] = useState<{ tugas: TugasPapan; baris: BarisPublik[]; ringkas: RingkasPapan } | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [kode, setKode] = useState("");
  const [hasilKode, setHasilKode] = useState<HasilKode | null>(null);
  const [galatKode, setGalatKode] = useState("");
  const [sibukKode, setSibukKode] = useState(false);
  const [kunci, setKunci] = useState<{ baris: number; kode: string; hasil?: HasilKode; galat?: string; sibuk?: boolean } | null>(null);

  const muatPapan = useCallback(async (id: number, ganti = true) => {
    setMemuat(true); setGalat(""); setKunci(null);
    try {
      const jawab = await fetch(`/api/cbt/papan?tugas=${id}`, { cache: "no-store" });
      const d = await jawab.json();
      if (!jawab.ok || !d.success) throw new Error(d.message || "Papan nilai tidak dapat dimuat.");
      setPapan({ tugas: d.tugas, baris: d.baris, ringkas: d.ringkas });
      if (ganti) window.history.replaceState(null, "", `?tugas=${id}`);
    } catch (e) {
      setPapan(null);
      setGalat(e instanceof Error ? e.message : "Papan nilai tidak dapat dimuat.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const jam = setTimeout(async () => {
      try {
        const jawab = await fetch("/api/cbt/papan", { cache: "no-store" });
        const d = await jawab.json();
        if (!jawab.ok || !d.success) throw new Error(d.message || "Daftar tugas tidak dapat dimuat.");
        setDaftar(d.tugas);
        const id = Number(new URLSearchParams(window.location.search).get("tugas"));
        if (id) void muatPapan(id, false);
      } catch (e) {
        setDaftar([]);
        setGalat(e instanceof Error ? e.message : "Daftar tugas tidak dapat dimuat.");
      }
    }, 0);
    return () => clearTimeout(jam);
  }, [muatPapan]);

  async function cekKode() {
    setGalatKode(""); setHasilKode(null); setSibukKode(true);
    try {
      setHasilKode(await bukaKode(kode));
    } catch (e) {
      setGalatKode(e instanceof Error ? e.message : "Kode tidak dapat dibuka.");
    } finally {
      setSibukKode(false);
    }
  }

  async function bukaKunci() {
    if (!kunci) return;
    setKunci({ ...kunci, sibuk: true, galat: "" });
    try {
      const hasil = await bukaKode(kunci.kode, kunci.baris);
      setKunci({ ...kunci, hasil, sibuk: false, galat: "" });
    } catch (e) {
      setKunci({ ...kunci, sibuk: false, galat: e instanceof Error ? e.message : "Keterangan tidak dapat dibuka." });
    }
  }

  const q = cari.trim().toLowerCase();
  const baris = (papan?.baris ?? []).filter((b) => !q || b.nama.toLowerCase().includes(q) || b.nimSamar.toLowerCase().includes(q));

  return (
    <div className="pn">
      <header className="pn-kepala">
        <div className="pn-wadah">
          <a className="pn-balik" href={awalan || "/"}>← SiPaling CBT</a>
          <h1>Papan Nilai Tugas</h1>
          <p>
            Nilai tugas yang sudah diterbitkan pengajar, diurutkan dari tertinggi. Nilai merah berada di bawah batas kritis.
            Keterangan nilai terkunci dan hanya terbuka dengan kode SIPALING-TUGAS pemiliknya.
          </p>
          <div className="pn-cek">
            <input
              value={kode} onChange={(e) => setKode(e.target.value.toUpperCase())} placeholder="SIPALING-TUGAS-XXXXXXXX"
              aria-label="Kode SIPALING-TUGAS" autoComplete="off" onKeyDown={(e) => { if (e.key === "Enter") void cekKode(); }}
            />
            <button type="button" disabled={sibukKode || !kode.trim()} onClick={() => void cekKode()}>{sibukKode ? "Memeriksa…" : "Cek kiriman saya"}</button>
          </div>
          <a className="pn-kumpul" href={`${awalan}/tugas`}>📤 Kumpulkan tugas</a>
        </div>
      </header>

      <main className="pn-wadah pn-isi">
        {galatKode && <p className="cbtd-galat" role="alert">{galatKode}</p>}
        {hasilKode && <KartuKode hasil={hasilKode} onTutup={() => setHasilKode(null)} />}

        {galat && <p className="cbtd-galat" role="alert">{galat}</p>}

        <section className="pn-daftar">
          <h2>Tugas yang sudah diterbitkan</h2>
          {daftar === null ? <p className="pn-redup">Memuat…</p> : !daftar.length ? (
            <p className="pn-redup">Belum ada nilai tugas yang diterbitkan.</p>
          ) : (
            <div className="pn-kartu-daftar">
              {daftar.map((t) => (
                <button type="button" key={t.id} className={`pn-kartu${papan?.tugas.id === t.id ? " on" : ""}`} onClick={() => void muatPapan(t.id)}>
                  <small>{t.mataKuliah || "Tugas"}{t.kelas ? ` · ${t.kelas}` : ""}</small>
                  <b>{judulTugas(t)}</b>
                  <span>{t.pengajar}{t.pengajar && t.terbitPada ? " · " : ""}{t.terbitPada ? `terbit ${tanggal(t.terbitPada)}` : ""}</span>
                  {t.jumlah !== undefined && <em>{t.jumlah} kiriman</em>}
                </button>
              ))}
            </div>
          )}
        </section>

        {memuat && <p className="pn-redup">Memuat papan…</p>}

        {papan && !memuat && (
          <section className="pn-papan">
            <div className="pn-papan-kepala">
              <div>
                <small>{papan.tugas.mataKuliah}{papan.tugas.kelas ? ` · Kelas ${papan.tugas.kelas}` : ""}</small>
                <h2>{judulTugas(papan.tugas)}</h2>
                {papan.tugas.pengajar && <span>{papan.tugas.pengajar}</span>}
              </div>
              <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama…" aria-label="Cari nama" />
            </div>
            <ul className="pn-ringkas">
              <li><b>{papan.ringkas.dinilai}</b> dinilai</li>
              <li><b>{angka(papan.ringkas.rata)}</b> rata-rata</li>
              <li><b>{angka(papan.ringkas.tertinggi)}</b> tertinggi</li>
              <li className={papan.ringkas.kritis ? "merah" : ""}><b>{papan.ringkas.kritis}</b> di bawah batas kritis {papan.tugas.batasKritis}</li>
              {papan.ringkas.ditandai > 0 && <li className="merah"><b>{papan.ringkas.ditandai}</b> terindikasi plagiasi</li>}
            </ul>

            <div className="pn-tabel-wadah">
              <table className="pn-tabel pn-tabel-papan">
                <thead><tr><th>#</th><th>Nama</th><th>NIM / No. Peserta</th><th>Nilai</th><th>Predikat</th><th>Keterangan</th></tr></thead>
                <tbody>
                  {baris.map((b) => (
                    <BarisPapan
                      key={b.baris} b={b} kunci={kunci?.baris === b.baris ? kunci : null}
                      onKunci={() => setKunci(kunci?.baris === b.baris ? null : { baris: b.baris, kode: "" })}
                      onKode={(k) => setKunci((x) => (x ? { ...x, kode: k, galat: "" } : x))}
                      onBuka={() => void bukaKunci()}
                    />
                  ))}
                  {!baris.length && <tr><td colSpan={6} className="pn-redup">Tidak ada nama yang cocok.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="pn-catatan">
              Nomor peserta disamarkan. Penanda plagiasi berasal dari pemeriksaan otomatis kesamaan isi antarkiriman dan ditinjau pengajar;
              isi keterangannya hanya terbuka untuk pemilik kode.
            </p>
          </section>
        )}
        <KreditCbt />
      </main>
    </div>
  );
}

function BarisPapan({ b, kunci, onKunci, onKode, onBuka }: {
  b: BarisPublik;
  kunci: { kode: string; hasil?: HasilKode; galat?: string; sibuk?: boolean } | null;
  onKunci: () => void; onKode: (k: string) => void; onBuka: () => void;
}) {
  return (
    <>
      <tr className={b.kritis ? "kritis" : ""}>
        <td>{b.peringkat ?? "–"}</td>
        <td>{b.nama}</td>
        <td><code>{b.nimSamar}</code></td>
        <td className={b.kritis ? "pn-merah" : ""}>{b.nilai ?? <small>{b.keadaan}</small>}</td>
        <td>{b.predikat}</td>
        <td>
          <div className="pn-ket">
            {b.penanda && <span className={`pn-tanda ${b.penanda}`}>{b.penanda === "ditahan" ? "Ditahan" : `⚠ ${PENANDA_LABEL[b.penanda]}`}</span>}
            {b.kritis && !b.penanda && <span className="pn-tanda kritis">Di bawah batas kritis</span>}
            {b.terkunci && (
              <button type="button" className="pn-gembok" onClick={onKunci} aria-expanded={Boolean(kunci)}>
                {kunci?.hasil ? "🔓 Tutup" : "🔒 Keterangan"}
              </button>
            )}
          </div>
        </td>
      </tr>
      {kunci && (
        <tr className="pn-buka">
          <td colSpan={6}>
            {kunci.hasil ? (
              <KartuKode hasil={kunci.hasil} ringkas />
            ) : (
              <div className="pn-sandi">
                <span>Keterangan baris ini hanya terbuka dengan kode SIPALING-TUGAS milik <b>{b.nama}</b>.</span>
                <div>
                  <input
                    value={kunci.kode} autoFocus placeholder="SIPALING-TUGAS-XXXXXXXX" aria-label="Kode SIPALING-TUGAS"
                    autoComplete="off" onChange={(e) => onKode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") onBuka(); }}
                  />
                  <button type="button" disabled={kunci.sibuk || !kunci.kode.trim()} onClick={onBuka}>{kunci.sibuk ? "Memeriksa…" : "Buka"}</button>
                </div>
                {kunci.galat && <p className="cbtd-galat" role="alert">{kunci.galat}</p>}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/** Isi kiriman untuk pemilik kode: status, nilai, keterangan, rincian, laporan. */
function KartuKode({ hasil, ringkas = false, onTutup }: { hasil: HasilKode; ringkas?: boolean; onTutup?: () => void }) {
  const [cocok, setCocok] = useState<"" | "sama" | "beda" | "membaca">("");
  const k = hasil.kiriman;
  const n = hasil.nilai;
  const ket = hasil.keterangan;

  function unduhPdf() {
    if (!hasil.laporan) return;
    const pdf = buatLaporanPdf(hasil.laporan.template, hasil.laporan.data, { kaki: hasil.laporan.kaki || undefined });
    const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = namaBerkasLaporan(hasil.laporan.data);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function cocokkan(f: File | undefined) {
    if (!f) return;
    setCocok("membaca");
    const sidik = await sidikBerkas(new Uint8Array(await f.arrayBuffer()));
    setCocok(sidik === k.sidik ? "sama" : "beda");
  }

  return (
    <div className={`pn-kode${ket ? ` ${ket.nada}` : ""}`}>
      <div className="pn-kode-kepala">
        <div>
          <small>{hasil.tugas.mataKuliah} · {judulTugas(hasil.tugas)}</small>
          <b>{k.nama}</b> <span>{k.nim} · <code>{k.kode}</code></span>
        </div>
        {onTutup && <button type="button" className="pn-tutup" onClick={onTutup} aria-label="Tutup">✕</button>}
      </div>

      {!ringkas && (
        <p className="pn-redup">
          Dikumpulkan {new Date(k.dikumpulkan).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB ·
          {" "}{k.berkas}{k.halaman ? ` · ${k.halaman} halaman` : ""} · {k.kata.toLocaleString("id-ID")} kata
        </p>
      )}

      {!hasil.terbit ? (
        <p className="pn-status">{hasil.pesan || "Kiriman sudah diterima. Nilainya belum diterbitkan pengajar."}</p>
      ) : n && (
        <div className="pn-nilai">
          <div className={`pn-angka${n.kritis ? " merah" : ""}`}>
            <b>{n.angka === null ? (n.keadaan === "ditahan" ? "Ditahan" : "–") : angka(n.angka)}</b>
            {n.angka !== null && <span>{n.predikat}{n.rentang ? ` (${n.rentang})` : ""}</span>}
          </div>
          <div>
            {n.peringkat && <span>Peringkat <b>{n.peringkat}</b> dari {n.dari}</span>}
            {n.kritis && <span className="pn-tanda kritis">Di bawah batas kritis {n.batasKritis}</span>}
            {n.penanda && n.penanda !== "ditahan" && <span className={`pn-tanda ${n.penanda}`}>⚠ {PENANDA_LABEL[n.penanda as keyof typeof PENANDA_LABEL]}</span>}
          </div>
        </div>
      )}

      {hasil.terbit && ket && (
        <div className="pn-keterangan">
          <b>{ket.ringkas}</b>
          {ket.bagian.map((g) => (
            <div key={g.judul}>
              <small>{g.judul}</small>
              <ul>{g.isi.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
      )}

      {!ringkas && hasil.rincian && (
        <details className="pn-rincian">
          <summary>Rincian skor tiap kriteria{hasil.rincian.judul ? ` · ${hasil.rincian.judul}` : ""}</summary>
          <table className="pn-tabel">
            <thead><tr><th>Kriteria</th><th>Bobot</th><th>Skor</th><th>Capaian</th></tr></thead>
            <tbody>
              {hasil.rincian.kriteria.map((x) => (
                <tr key={x.nama}><td>{x.nama}</td><td>{x.bobot}%</td><td>{x.skor ?? "–"}</td><td>{x.capaian}</td></tr>
              ))}
            </tbody>
          </table>
          {hasil.rincian.kelebihan.length > 0 && <><small>Kelebihan</small><ul>{hasil.rincian.kelebihan.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
        </details>
      )}

      <div className="pn-aksi">
        {hasil.laporan && <button type="button" onClick={unduhPdf}>⇩ Unduh laporan PDF</button>}
        {!ringkas && (
          <label className="pn-cocok">
            <input type="file" accept="application/pdf,.pdf" onChange={(e) => { void cocokkan(e.target.files?.[0]); e.target.value = ""; }} />
            <span>Cocokkan PDF Anda</span>
          </label>
        )}
        {cocok === "membaca" && <span className="pn-redup">Menghitung sidik…</span>}
        {cocok === "sama" && <span className="pn-oke">✓ PDF ini sama persis dengan yang Anda kumpulkan.</span>}
        {cocok === "beda" && <span className="pn-merah">✕ PDF ini berbeda dari yang Anda kumpulkan.</span>}
      </div>
    </div>
  );
}
