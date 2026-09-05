"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  angka,
  HARI_KERJA,
  JAM_KERJA,
  labelBulan,
  unitSeverity,
  type Statistics,
} from "./statistics-types";

const RING_KELILING = 2 * Math.PI * 46;

function Cincin({
  nilai, warna, judul, sub, sumber,
}: {
  nilai: number | null; warna: string; judul: string; sub: string; sumber: React.ReactNode;
}) {
  const pct = nilai ?? 0;
  return (
    <div className="panel st-ring-card">
      <div className="st-ring">
        <svg viewBox="0 0 120 120" role="img" aria-label={`${judul}: ${nilai === null ? "belum ada data" : `${pct} persen`}`}>
          <circle className="st-ring-bg" cx="60" cy="60" r="46" />
          <circle
            className="st-ring-fg" cx="60" cy="60" r="46" stroke={warna}
            strokeDasharray={`${(RING_KELILING * pct) / 100} ${RING_KELILING}`}
          />
        </svg>
        <span className="st-ring-val" style={{ color: warna }}>
          {nilai === null ? "-" : <>{pct}<i>%</i></>}
        </span>
      </div>
      <b className="st-ring-label">{judul}</b>
      <span className="st-ring-sub">{sub}</span>
      <details className="st-why">
        <summary>Dari mana angkanya?</summary>
        <div className="st-why-body">{sumber}</div>
      </details>
    </div>
  );
}

function Why({ children }: { children: React.ReactNode }) {
  return (
    <details className="st-why">
      <summary>Dari mana angkanya?</summary>
      <div className="st-why-body">{children}</div>
    </details>
  );
}

const ORANG = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="6.6" r="4.1" />
    <path d="M12 12.4c-4.5 0-8.2 3-8.2 6.9V22h16.4v-2.7c0-3.9-3.7-6.9-8.2-6.9z" />
  </svg>
);

function Piktogram({ isi, kosong, label }: { isi: number; kosong: number; label: string }) {
  // Dibatasi agar fakultas dengan ratusan dosen tidak membanjiri layar.
  const batas = 80;
  const tampilIsi = Math.min(isi, batas);
  const tampilKosong = Math.min(kosong, Math.max(0, batas - tampilIsi));
  return (
    <div className="st-picto" role="img" aria-label={label}>
      {Array.from({ length: tampilIsi }, (_, i) => <span className="on" key={`a${i}`}>{ORANG}</span>)}
      {Array.from({ length: tampilKosong }, (_, i) => <span className="off" key={`b${i}`}>{ORANG}</span>)}
      {isi + kosong > batas && <span className="st-picto-sisa">+{isi + kosong - batas} lagi</span>}
    </div>
  );
}

export default function StatisticsPanel() {
  const [data, setData] = useState<Partial<Statistics> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/statistics", { cache: "no-store" });
      const payload = (await response.json()) as { success?: boolean; message?: string } & Partial<Statistics>;
      if (!response.ok || !payload.success) throw new Error(payload.message || "Statistik belum dapat dimuat.");
      setData(payload);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Statistik belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // ---- turunan ----
  const peta = useMemo(() => {
    const map = new Map<string, number>();
    let max = 0;
    for (const sel of data?.peta || []) {
      map.set(`${sel.hari}-${sel.jam}`, sel.jumlah);
      if (sel.jumlah > max) max = sel.jumlah;
    }
    return { map, max };
  }, [data]);

  const luaran = useMemo(() => {
    const tahun = Array.from(new Set((data?.luaran || []).map((l) => l.tahun))).sort();
    const kategori = Array.from(new Set((data?.luaran || []).map((l) => l.kategori)));
    const nilai = new Map<string, number>();
    let max = 0;
    for (const l of data?.luaran || []) {
      nilai.set(`${l.tahun}|${l.kategori}`, l.jumlah);
      if (l.jumlah > max) max = l.jumlah;
    }
    return { tahun, kategori: kategori.slice(0, 3), nilai, max: Math.max(max, 1) };
  }, [data]);

  const komposisi = useMemo(() => {
    const semua = data?.komposisi || [];
    const total = semua.reduce((sum, k) => sum + k.jumlah, 0);
    const utama = semua.slice(0, 3);
    const sisa = semua.slice(3).reduce((sum, k) => sum + k.jumlah, 0);
    const potong = sisa > 0 ? [...utama, { kategori: "Lainnya", jumlah: sisa }] : utama;
    return { total, potong };
  }, [data]);

  if (loading) {
    return (
      <section className="stats">
        <p className="section-eyebrow">STATISTIK</p>
        <h2 className="dsh-title">Dasbor Kinerja</h2>
        <div className="panel dempty">Menghitung statistik…</div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="stats">
        <p className="section-eyebrow">STATISTIK</p>
        <h2 className="dsh-title">Dasbor Kinerja</h2>
        <div className="dsh-error">{error || "Statistik belum tersedia."}</div>
        <button type="button" className="btn btn-light" onClick={() => void load()}>↻ Coba lagi</button>
      </section>
    );
  }

  // Nilai cadangan untuk setiap bagian. Tanpa ini, satu bagian yang tidak
  // terkirim (mis. tabel pengajuan judul belum dibuat di basis data) membuat
  // seluruh dashboard admin blank karena TypeError yang tidak tertangkap.
  const ringkasan = data.ringkasan ?? {
    tiketBulanIni: 0, tiketBulanLalu: 0, deltaPersen: null,
    mahasiswaUnik: 0, menggantung: 0, medianHari: null, tuntasPersen: null,
  };
  const cincin = data.cincin ?? { tuntas: null, judulLolos: null, dosenMembimbing: null, dosenLuaran: null };
  const corong = data.corong ?? { diajukan: 0, lolosBerkas: 0, diterima: 0, ditolakDosen: 0, ditolakProdi: 0 };
  const bimbinganRaw = data.bimbingan ?? { totalDosen: 0, membimbing: 0, belum: 0, top: [] };
  const bimbingan = { ...bimbinganRaw, top: bimbinganRaw.top ?? [] };
  const prodi = data.prodi ?? [];
  const cakupan = data.cakupan ?? { totalDosen: 0, punyaLuaran: 0 };
  const unit = data.unit ?? [];
  const pddikti = data.pddikti ?? [];
  const warnaS1 = "var(--primary)";
  const warnaS2 = "#c9790d";
  const warnaS3 = "#d9466f";
  const warnaOk = "#16a36b";

  const corongMax = Math.max(corong.diajukan, 1);
  const lolosPct = (corong.lolosBerkas / corongMax) * 100;
  const diterimaPct = (corong.diterima / corongMax) * 100;
  const gugurBerkas = Math.max(0, corong.diajukan - corong.lolosBerkas);

  const prodiMax = Math.max(1, ...prodi.map((p) => Math.max(p.tiket, p.pengajuan)));
  const pddiktiMax = Math.max(1, ...pddikti.map((p) => p.jumlah));

  return (
    <section className="stats">
      <div className="st-head">
        <div>
          <p className="section-eyebrow">STATISTIK</p>
          <h2 className="dsh-title">Dasbor Kinerja</h2>
          <p className="st-lede">Mengukur mutu layanan, bukan ramai atau sepinya.</p>
        </div>
        <button type="button" className="btn btn-light btn-mini" onClick={() => void load()}>↻ Muat ulang</button>
      </div>

      {/* ---------- Cincin ---------- */}
      <div className="st-rings">
        <Cincin
          nilai={cincin.tuntas} warna={warnaOk} judul="Layanan tuntas"
          sub={`${ringkasan.tiketBulanIni} tiket bulan ini`}
          sumber={<>
            <p><b>Hitungan:</b> tiket berstatus <b>Selesai</b> ÷ seluruh tiket bulan ini × 100.</p>
            <p><b>Sumber:</b> <code>service_requests.status</code></p>
          </>}
        />
        <Cincin
          nilai={cincin.judulLolos} warna={warnaS1} judul="Judul lolos berkas"
          sub={`${corong.lolosBerkas} dari ${corong.diajukan} pengajuan`}
          sumber={<>
            <p><b>Hitungan:</b> pengajuan yang lolos <b>dua ceklis</b> ÷ seluruh pengajuan × 100.</p>
            <p><b>Sumber:</b> <code>title_proposals.finance_verified</code> dan <code>eligibility_verified</code></p>
          </>}
        />
        <Cincin
          nilai={cincin.dosenMembimbing} warna={warnaS2} judul="Dosen aktif membimbing"
          sub={`${bimbingan.membimbing} dari ${bimbingan.totalDosen} dosen`}
          sumber={<>
            <p><b>Hitungan:</b> dosen dengan minimal 1 mahasiswa disetujui ÷ dosen aktif × 100.</p>
            <p><b>Sumber:</b> <code>title_proposals.approved_lecturer_id</code> berstatus <code>Disetujui Dosen</code></p>
            <p>Rendah berarti beban bimbingan menumpuk di sedikit orang.</p>
          </>}
        />
        <Cincin
          nilai={cincin.dosenLuaran} warna={warnaS1} judul="Dosen punya luaran"
          sub={`${cakupan.punyaLuaran} dari ${cakupan.totalDosen} dosen`}
          sumber={<>
            <p><b>Hitungan:</b> dosen yang tercatat pada minimal 1 dokumen ÷ dosen aktif × 100.</p>
            <p><b>Sumber:</b> <code>document_contributors</code></p>
            <p>Yang dihitung orangnya, bukan dokumennya.</p>
          </>}
        />
      </div>

      {/* ---------- Kartu angka ---------- */}
      <div className="st-kpis">
        <div className="panel st-kpi">
          <span className="st-kpi-label">Tiket bulan ini</span>
          <span className="st-kpi-num">{ringkasan.tiketBulanIni}</span>
          {ringkasan.deltaPersen !== null && (
            <span className={`st-delta ${ringkasan.deltaPersen >= 0 ? "up" : "down"}`}>
              {ringkasan.deltaPersen >= 0 ? "▲" : "▼"} {Math.abs(ringkasan.deltaPersen)}% dari bulan lalu
            </span>
          )}
        </div>
        <div className="panel st-kpi">
          <span className="st-kpi-label">Median penyelesaian</span>
          <span className="st-kpi-num">{angka(ringkasan.medianHari)} <small>hari</small></span>
          <span className="st-delta">Separuh tiket selesai lebih cepat dari ini</span>
        </div>
        <div className={`panel st-kpi ${ringkasan.menggantung > 0 ? "alert" : ""}`}>
          <span className="st-kpi-label">Menggantung &gt; 7 hari</span>
          <span className="st-kpi-num">{ringkasan.menggantung}</span>
          <span className={`st-delta ${ringkasan.menggantung > 0 ? "down" : "up"}`}>
            {ringkasan.menggantung > 0 ? "Perlu ditindak" : "Antrean bersih"}
          </span>
        </div>
        <div className="panel st-kpi">
          <span className="st-kpi-label">Mahasiswa unik terlayani</span>
          <span className="st-kpi-num">{ringkasan.mahasiswaUnik}</span>
          <span className="st-delta">Orang berbeda, bukan jumlah tiket</span>
        </div>
      </div>

      {/* ---------- Papan nilai unit ---------- */}
      <div className="panel st-block">
        <h3>Papan nilai unit layanan</h3>
        <p className="st-sub">Enam bulan terakhir. Tiap unit dinilai dari kecepatan dan ketuntasannya sendiri.</p>
        <div className="qtable-wrap">
          <table className="qt st-table">
            <thead>
              <tr><th>Unit</th><th className="right">Tiket</th><th className="right">Median</th><th>Tuntas</th><th className="right">&gt;7 hari</th><th>Keadaan</th></tr>
            </thead>
            <tbody>
              {unit.length === 0 ? (
                <tr><td colSpan={6}><div className="dempty">Belum ada tiket enam bulan terakhir.</div></td></tr>
              ) : unit.map((u) => {
                const { sev, label } = unitSeverity(u);
                return (
                  <tr key={u.unit} className={`st-sev-${sev}`}>
                    <td className="st-stripe" data-l="Unit"><b>{u.unit.replace("Layanan ", "")}</b></td>
                    <td className="right st-num" data-l="Tiket">{u.tiket}</td>
                    <td className="right st-num" data-l="Median">{angka(u.medianHari, "hari")}</td>
                    <td data-l="Tuntas">
                      <span className="st-cellbar"><i style={{ width: `${u.tuntasPersen ?? 0}%` }} /></span>
                      <span className="st-cellbar-n">{u.tuntasPersen === null ? "-" : `${u.tuntasPersen}%`}</span>
                    </td>
                    <td className={`right st-num ${u.menggantung === 0 ? "dim" : ""}`} data-l="Lewat 7 hari">{u.menggantung}</td>
                    <td data-l="Keadaan"><span className={`pill s-${sev}`}>{label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Why>
          <p><b>Hitungan:</b> median selisih <code>created_at</code> → <code>updated_at</code> pada tiket Selesai; Tuntas = persentase Selesai; &gt;7 hari = belum selesai lewat tujuh hari.</p>
          <p><b>Sumber:</b> <code>service_requests</code>, dikelompokkan per <code>service_type</code>.</p>
          <p><b>Kenapa tabel, bukan diagram pie?</b> Pie “tiket per unit” membuat PDDIKTI dan Laboratorium terbaca sebagai kegagalan, padahal sepi di sana wajar. Unit bervolume rendah diberi label <b>Wajar sepi</b>, bukan dinilai buruk.</p>
        </Why>
      </div>

      {/* ---------- Corong + bimbingan ---------- */}
      <div className="st-duo">
        <div className="panel st-block">
          <h3>Corong pengajuan judul</h3>
          <p className="st-sub">Seluruh pengajuan yang pernah masuk</p>
          {corong.diajukan === 0 ? (
            <div className="dempty">Belum ada pengajuan judul.</div>
          ) : (
            <>
              <div role="img" aria-label={`Corong: ${corong.diajukan} diajukan, ${corong.lolosBerkas} lolos berkas, ${corong.diterima} diterima dosen`}>
                <div className="st-fnl-band a"><span className="st-fnl-shape" /><div className="st-fnl-txt"><b>{corong.diajukan}</b><span>Diajukan mahasiswa</span></div></div>
                {gugurBerkas > 0 && <div className="st-fnl-leak">↓ {gugurBerkas} belum lolos berkas</div>}
                <div className="st-fnl-band b"><span className="st-fnl-shape" style={{ clipPath: `polygon(${(100 - lolosPct) / 2}% 0, ${100 - (100 - lolosPct) / 2}% 0, ${100 - (100 - diterimaPct) / 2}% 100%, ${(100 - diterimaPct) / 2}% 100%)` }} /><div className="st-fnl-txt"><b>{corong.lolosBerkas}</b><span>Lolos verifikasi berkas</span></div></div>
                {corong.ditolakDosen > 0 && <div className="st-fnl-leak">↓ {corong.ditolakDosen} ditolak dosen, cari pengganti</div>}
                <div className="st-fnl-band c"><span className="st-fnl-shape" style={{ clipPath: `polygon(${(100 - diterimaPct) / 2}% 0, ${100 - (100 - diterimaPct) / 2}% 0, ${100 - (100 - diterimaPct) / 2}% 100%, ${(100 - diterimaPct) / 2}% 100%)` }} /><div className="st-fnl-txt"><b>{corong.diterima}</b><span>Diterima dosen</span></div></div>
              </div>
              <p className="st-note">
                Dari setiap 100 pengajuan, <b>{Math.round(diterimaPct)}</b> berakhir dengan Surat Tugas.
              </p>
            </>
          )}
          <Why>
            <p><b>Hitungan:</b> jumlah pengajuan di tiap tahap; selisih antar tahap dihitung sebagai kebocoran.</p>
            <p><b>Sumber:</b> <code>title_proposals</code>, kolom <code>status</code>, <code>finance_verified</code>, <code>eligibility_verified</code>.</p>
            <p>Lebar tiap pita sebanding dengan jumlahnya.</p>
          </Why>
        </div>

        <div className="panel st-block">
          <h3>Beban bimbingan per dosen</h3>
          <p className="st-sub">Satu orang = satu dosen. Total {bimbingan.totalDosen} dosen aktif.</p>
          <div className="st-picto-key">
            <span className="on">{ORANG} Sedang membimbing ({bimbingan.membimbing})</span>
            <span className="off">{ORANG} Belum memegang ({bimbingan.belum})</span>
          </div>
          <Piktogram
            isi={bimbingan.membimbing} kosong={bimbingan.belum}
            label={`Dari ${bimbingan.totalDosen} dosen, ${bimbingan.membimbing} membimbing dan ${bimbingan.belum} belum`}
          />
          {bimbingan.top.length > 0 && (
            <>
              <p className="st-sub st-tight">Bimbingan terbanyak:</p>
              <div className="st-bars">
                {bimbingan.top.map((d) => {
                  const max = bimbingan.top[0]?.jumlah || 1;
                  return (
                    <div className="st-bar-row" key={d.nama}>
                      <span className="who" title={d.nama}>{d.nama}</span>
                      <span className="track"><i className={d.jumlah >= 10 ? "over" : ""} style={{ width: `${(d.jumlah / max) * 100}%` }} /></span>
                      <span className="n">{d.jumlah}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <Why>
            <p><b>Hitungan:</b> satu ikon = satu dosen aktif; berwarna bila memegang minimal satu mahasiswa yang sudah disetujui.</p>
            <p><b>Sumber:</b> <code>title_proposals.approved_lecturer_id</code> dan <code>lecturers.active</code>.</p>
            <p>Deretan abu yang panjang berarti bimbingan menumpuk di sedikit dosen.</p>
          </Why>
        </div>
      </div>

      {/* ---------- Perbandingan prodi ---------- */}
      {prodi.length > 0 && (
        <div className="panel st-block">
          <h3>Perbandingan program studi</h3>
          <p className="st-sub">Sebulan terakhir. Jumlah mentah bisa menyesatkan, jadi dibanding juga per mahasiswa.</p>
          <div className="st-cmp">
            {prodi.map((p, i) => (
              <div className="st-cmp-row" key={p.prodi}>
                <span className="st-cmp-name" style={{ color: i === 0 ? warnaS1 : warnaS2 }}>{p.prodi}</span>
                <div className="st-cmp-metrics">
                  <div><span className="track"><i style={{ width: `${(p.tiket / prodiMax) * 100}%`, background: i === 0 ? warnaS1 : warnaS2 }} /></span><b>{p.tiket}</b><small>tiket</small></div>
                  <div><span className="track"><i style={{ width: `${(p.pengajuan / prodiMax) * 100}%`, background: i === 0 ? warnaS1 : warnaS2 }} /></span><b>{p.pengajuan}</b><small>pengajuan judul</small></div>
                  <div className="st-cmp-key"><b>{p.tiketPerMahasiswa}</b><small>tiket per mahasiswa · {p.mahasiswa} orang</small></div>
                </div>
              </div>
            ))}
          </div>
          <Why>
            <p><b>Hitungan:</b> jumlah tiket dan pengajuan tiap prodi; <b>tiket per mahasiswa</b> = tiket ÷ jumlah mahasiswa berbeda yang mengirim.</p>
            <p><b>Sumber:</b> kolom <code>study_program</code> pada <code>service_requests</code> dan <code>title_proposals</code>.</p>
            <p>Prodi yang lebih kecil selalu terlihat tertinggal bila hanya jumlah mentahnya yang dibaca. Angka per mahasiswa menghilangkan efek ukuran itu.</p>
          </Why>
        </div>
      )}

      {/* ---------- Peta panas ---------- */}
      <div className="panel st-block">
        <h3>Kapan loket paling sibuk</h3>
        <p className="st-sub">Tiga bulan terakhir, waktu Jakarta. Makin pekat, makin ramai.</p>
        <div className="st-hm">
          <span />
          {JAM_KERJA.map((j) => <span className="st-hm-top" key={j}>{String(j).padStart(2, "0")}</span>)}
          {HARI_KERJA.map((hari, hi) => (
            <span key={hari} style={{ display: "contents" }}>
              <span className="st-hm-lbl">{hari}</span>
              {JAM_KERJA.map((jam) => {
                const n = peta.map.get(`${hi + 1}-${jam}`) || 0;
                const lvl = n === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((n / (peta.max || 1)) * 4)));
                return <span className={`st-hm-cell l${lvl}`} key={jam} title={`${hari} pukul ${jam}.00: ${n} tiket`}>{n || ""}</span>;
              })}
            </span>
          ))}
        </div>
        <div className="st-hm-scale">
          <span>Sedikit</span>
          {[0, 1, 2, 3, 4].map((l) => <i className={`l${l}`} key={l} />)}
          <span>Banyak</span>
        </div>
        <Why>
          <p><b>Hitungan:</b> tiket dikelompokkan menurut hari dan jam kedatangannya, tiga bulan terakhir.</p>
          <p><b>Sumber:</b> <code>service_requests.created_at</code>, dikonversi ke zona Asia/Jakarta.</p>
          <p>Berguna untuk mengatur jadwal jaga loket: jam sepi tidak perlu dijaga penuh.</p>
        </Why>
      </div>

      {/* ---------- PDDIKTI ---------- */}
      {pddikti.length > 0 && (
        <div className="panel st-block">
          <h3>Perbaikan data PDDIKTI</h3>
          <p className="st-sub">Satu-satunya grafik di sini yang <b>turun berarti berhasil</b>.</p>
          <div className="st-mini-bars">
            {pddikti.map((m) => (
              <div className="st-mini-bar" key={m.bulan}>
                <span className="v">{m.jumlah}</span>
                <span className="col"><i style={{ height: `${(m.jumlah / pddiktiMax) * 100}%` }} /></span>
                <span className="l">{labelBulan(m.bulan)}</span>
              </div>
            ))}
          </div>
          <Why>
            <p><b>Hitungan:</b> jumlah tiket PDDIKTI per bulan, makin sedikit makin baik.</p>
            <p><b>Sumber:</b> <code>service_requests</code> dengan <code>service_type = &apos;Layanan PDDIKTI&apos;</code>.</p>
            <p>Tiap tiket di sini berarti ada data mahasiswa yang salah. Sepi berarti data sudah bersih, bukan unit yang tidak terpakai.</p>
          </Why>
        </div>
      )}

      {/* ---------- Luaran akademik ---------- */}
      <div className="st-duo">
        <div className="panel st-block">
          <h3>Luaran akademik per tahun</h3>
          <p className="st-sub">Dari Database Dokumen</p>
          {luaran.tahun.length === 0 ? (
            <div className="dempty">Belum ada dokumen di database.</div>
          ) : (
            <>
              <ul className="st-legend">
                {luaran.kategori.map((k, i) => (
                  <li key={k}><span className="sw" style={{ background: [warnaS1, warnaS2, warnaS3][i] }} /> {k}</li>
                ))}
              </ul>
              <div className="st-grouped">
                {luaran.tahun.map((t) => (
                  <div className="st-group" key={t}>
                    <div className="st-group-bars">
                      {luaran.kategori.map((k, i) => {
                        const v = luaran.nilai.get(`${t}|${k}`) || 0;
                        return <span className="st-gb" key={k} title={`${t} · ${k}: ${v}`}>
                          <i style={{ height: `${(v / luaran.max) * 100}%`, background: [warnaS1, warnaS2, warnaS3][i] }} />
                        </span>;
                      })}
                    </div>
                    <span className="st-group-lbl">{t}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <Why>
            <p><b>Hitungan:</b> jumlah entri per tahun, dipisah menurut tiga jenis dokumen terbanyak.</p>
            <p><b>Sumber:</b> <code>document_records</code> dikelompokkan per <code>document_date</code> dan <code>category</code>.</p>
            <p>Ini mengukur produktivitas, bukan mutu layanan. Inilah yang ditanya asesor akreditasi.</p>
          </Why>
        </div>

        <div className="panel st-block">
          <h3>Isi Database Dokumen</h3>
          <p className="st-sub">{komposisi.total} entri terkumpul</p>
          {komposisi.total === 0 ? (
            <div className="dempty">Belum ada dokumen.</div>
          ) : (
            <ul className="st-komposisi">
              {komposisi.potong.map((k, i) => {
                const pct = Math.round((k.jumlah / komposisi.total) * 100);
                const warna = [warnaS1, warnaS2, warnaS3, "#94a3b8"][i] || "#94a3b8";
                return (
                  <li key={k.kategori}>
                    <span className="nama"><i style={{ background: warna }} /> {k.kategori}</span>
                    <span className="track"><i style={{ width: `${pct}%`, background: warna }} /></span>
                    <b>{k.jumlah}</b><small>{pct}%</small>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="st-cakupan">
            <p className="st-sub st-tight">Cakupan dosen: berapa yang punya minimal satu luaran</p>
            <div className="st-picto-key">
              <span className="on">{ORANG} Punya luaran ({cakupan.punyaLuaran})</span>
              <span className="off">{ORANG} Belum ada ({Math.max(0, cakupan.totalDosen - cakupan.punyaLuaran)})</span>
            </div>
            <Piktogram
              isi={cakupan.punyaLuaran}
              kosong={Math.max(0, cakupan.totalDosen - cakupan.punyaLuaran)}
              label={`Dari ${cakupan.totalDosen} dosen, ${cakupan.punyaLuaran} punya luaran`}
            />
          </div>
          <Why>
            <p><b>Hitungan:</b> jumlah entri per jenis dibagi total; cakupan = dosen yang muncul pada minimal satu dokumen ÷ dosen aktif.</p>
            <p><b>Sumber:</b> <code>document_records.category</code> dan <code>document_contributors</code>.</p>
            <p>Angka total menipu: “86 luaran” terdengar hebat sampai ketahuan datangnya dari 5 orang. Cakupan menangkap ketimpangan itu.</p>
          </Why>
        </div>
      </div>
    </section>
  );
}
