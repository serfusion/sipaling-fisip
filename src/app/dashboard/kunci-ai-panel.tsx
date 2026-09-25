"use client";

// ============================================================
// KUNCI AI — Dashboard Super Admin
//
// Tempel kunci, pilih penyedianya, susun urutannya. Kunci pertama dipakai
// lebih dulu; bila ia ditolak atau kuotanya habis, yang berikutnya dicoba
// sendiri. Kunci utuh tidak pernah kembali ke layar ini — yang tampil hanya
// bentuk tersamarnya.
// ============================================================

import { useCallback, useEffect, useState } from "react";

type Penyedia = "gemini" | "claude" | "openai";

type Baris = {
  id: string;
  penyedia: Penyedia;
  model: string;
  aktif: boolean;
  asal: "dashboard" | "environment";
  samaran: string;
  /** Diisi hanya ketika kunci baru ditempel. Kosong = tidak diubah. */
  kunciBaru?: string;
};

type InfoPenyedia = { kode: Penyedia; label: string; modelBawaan: string };
type Fitur = { nama: string; nyala: boolean; catatan?: string };

type Catatan = {
  ok: number; gagal: number; masuk: number; keluar: number;
  penyedia?: string; label?: string; galat?: string; waktuGalat?: string; terakhir?: string;
};
type Pemakaian = {
  bulan: string;
  kunci: Array<{ id: string } & Catatan>;
  fitur: Array<{ nama: string } & Catatan>;
};

const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function ejaBulan(b: string) {
  const [t, m] = b.split("-");
  return `${NAMA_BULAN[Number(m) - 1] ?? m} ${t}`;
}
function ejaWaktu(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}
const angka = (n: number) => n.toLocaleString("id-ID");

export default function KunciAiPanel() {
  const [daftar, setDaftar] = useState<Baris[]>([]);
  const [penyedia, setPenyedia] = useState<InfoPenyedia[]>([]);
  const [fitur, setFitur] = useState<Fitur[]>([]);
  const [pemakaian, setPemakaian] = useState<Pemakaian | null>(null);
  const [bulanAda, setBulanAda] = useState<string[]>([]);
  const [bulan, setBulan] = useState("");
  const [muat, setMuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [berubah, setBerubah] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [uji, setUji] = useState<Record<string, { ok: boolean; teks: string } | "jalan">>({});

  const [tambah, setTambah] = useState<{ penyedia: Penyedia; kunci: string; model: string }>({
    penyedia: "gemini", kunci: "", model: "",
  });

  const muatDaftar = useCallback(async (pilihBulan = "") => {
    setMuat(true);
    try {
      const jawab = await fetch(`/api/admin/kunci-ai${pilihBulan ? `?bulan=${pilihBulan}` : ""}`, { cache: "no-store" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Gagal memuat.");
      setDaftar(data.daftar);
      setPenyedia(data.penyedia);
      setFitur(data.fitur);
      setPemakaian(data.pemakaian ?? null);
      setBulanAda(data.bulanAda ?? []);
      setBulan(data.pemakaian?.bulan ?? "");
      setBerubah(false);
    } catch (alasan: unknown) {
      setPesan({ ok: false, teks: alasan instanceof Error ? alasan.message : "Gagal memuat." });
    } finally {
      setMuat(false);
    }
  }, []);

  useEffect(() => {
    const jam = setTimeout(() => void muatDaftar(), 0);
    return () => clearTimeout(jam);
  }, [muatDaftar]);

  const labelPenyedia = (p: Penyedia) => penyedia.find((x) => x.kode === p)?.label ?? p;
  const modelBawaan = (p: Penyedia) => penyedia.find((x) => x.kode === p)?.modelBawaan ?? "";

  function ubah(id: string, tambalan: Partial<Baris>) {
    setDaftar((d) => d.map((b) => (b.id === id ? { ...b, ...tambalan } : b)));
    setBerubah(true);
  }

  function geser(id: string, arah: -1 | 1) {
    setDaftar((d) => {
      const i = d.findIndex((b) => b.id === id);
      const j = i + arah;
      if (i < 0 || j < 0 || j >= d.length) return d;
      const salin = [...d];
      [salin[i], salin[j]] = [salin[j], salin[i]];
      return salin;
    });
    setBerubah(true);
  }

  function tambahKunci() {
    const kunci = tambah.kunci.trim();
    if (kunci.length < 10) { setPesan({ ok: false, teks: "Kuncinya terlalu pendek." }); return; }
    setDaftar((d) => [
      // Kunci baru ditaruh PALING ATAS: yang baru ditempel biasanya justru
      // pengganti kunci yang baru saja mati.
      {
        id: `baru-${Date.now()}`,
        penyedia: tambah.penyedia,
        model: tambah.model.trim(),
        aktif: true,
        asal: "dashboard",
        samaran: `${kunci.slice(0, 6)}…${kunci.slice(-4)}`,
        kunciBaru: kunci,
      },
      ...d,
    ]);
    setTambah({ ...tambah, kunci: "", model: "" });
    setBerubah(true);
    setPesan(null);
  }

  async function simpan() {
    setSibuk(true); setPesan(null);
    try {
      const jawab = await fetch("/api/admin/kunci-ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daftar: daftar.map((b) => ({
            // Id sementara dari baris baru tidak dikirim; server membuat yang tetap.
            id: b.id.startsWith("baru-") ? undefined : b.id,
            penyedia: b.penyedia,
            kunci: b.kunciBaru ?? "",
            model: b.model,
            aktif: b.aktif,
          })),
        }),
      });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Gagal menyimpan.");
      await muatDaftar();
      setPesan({ ok: true, teks: "Tersimpan. Berlaku dalam 30 detik, tanpa deploy ulang." });
    } catch (alasan: unknown) {
      setPesan({ ok: false, teks: alasan instanceof Error ? alasan.message : "Gagal menyimpan." });
    } finally {
      setSibuk(false);
    }
  }

  async function ujiKunci(id: string) {
    setUji((u) => ({ ...u, [id]: "jalan" }));
    try {
      const jawab = await fetch("/api/admin/kunci-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await jawab.json();
      setUji((u) => ({ ...u, [id]: { ok: Boolean(data.success), teks: data.pesan || data.message || "" } }));
    } catch {
      setUji((u) => ({ ...u, [id]: { ok: false, teks: "Tidak dapat menghubungi server." } }));
    }
  }

  return (
    <section>
      <p className="section-eyebrow">SUPER ADMIN</p>
      <h2 className="dsh-title">Kunci AI</h2>

      {pesan && <div className={pesan.ok ? "dsh-ok" : "dsh-error"}>{pesan.teks}</div>}

      <div className="panel kai-fitur">
        {fitur.map((f) => (
          <span key={f.nama} className={f.nyala ? "kai-nyala" : "kai-mati"} title={f.catatan || ""}>
            {f.nyala ? "●" : "○"} {f.nama}
          </span>
        ))}
      </div>

      <div className="panel">
        <b className="kai-sub">Tambah kunci</b>
        <div className="cbt-baris kai-tambah">
          <label><span>Penyedia</span>
            <select value={tambah.penyedia} onChange={(e) => setTambah({ ...tambah, penyedia: e.target.value as Penyedia })}>
              {penyedia.map((p) => <option key={p.kode} value={p.kode}>{p.label}</option>)}
            </select>
          </label>
          <label className="kai-kunci"><span>Kunci API</span>
            <input
              type="password"
              autoComplete="off"
              value={tambah.kunci}
              onChange={(e) => setTambah({ ...tambah, kunci: e.target.value })}
              placeholder="Tempel kunci di sini"
            />
          </label>
          <label><span>Model (opsional)</span>
            <input
              value={tambah.model}
              onChange={(e) => setTambah({ ...tambah, model: e.target.value })}
              placeholder={modelBawaan(tambah.penyedia)}
            />
          </label>
          <button type="button" className="btn btn-light kai-tombol" onClick={tambahKunci} disabled={!tambah.kunci.trim()}>
            + Tambah
          </button>
        </div>
      </div>

      <div className="panel">
        <b className="kai-sub">Urutan pemakaian</b>
        {muat ? (
          <div className="dempty">Memuat…</div>
        ) : daftar.length === 0 ? (
          <div className="dempty">Belum ada kunci. Seluruh fitur AI mati.</div>
        ) : (
          <ol className="kai-daftar">
            {daftar.map((b, i) => {
              const hasil = uji[b.id];
              const env = b.asal === "environment";
              return (
                <li key={b.id} className={b.aktif ? "" : "kai-padam"}>
                  <span className="kai-no">{i + 1}</span>
                  <div className="kai-isi">
                    <b>{labelPenyedia(b.penyedia)}</b>
                    <code>{b.samaran}</code>
                    {env && <small className="kai-env">environment</small>}
                    {b.kunciBaru && <small className="kai-env">belum disimpan</small>}
                    <input
                      className="kai-model"
                      value={b.model}
                      disabled={env}
                      onChange={(e) => ubah(b.id, { model: e.target.value })}
                      placeholder={modelBawaan(b.penyedia)}
                    />
                    {hasil && hasil !== "jalan" && (
                      <small className={hasil.ok ? "kai-lulus" : "kai-gagal"}>{hasil.ok ? "✓ " : "✕ "}{hasil.teks}</small>
                    )}
                  </div>
                  <div className="kai-aksi">
                    <button type="button" className="btn btn-light btn-mini" disabled={i === 0 || env} onClick={() => geser(b.id, -1)} aria-label="Naikkan">↑</button>
                    <button type="button" className="btn btn-light btn-mini" disabled={i === daftar.length - 1 || env} onClick={() => geser(b.id, 1)} aria-label="Turunkan">↓</button>
                    <button
                      type="button" className="btn btn-light btn-mini"
                      disabled={Boolean(b.kunciBaru) || hasil === "jalan"}
                      title={b.kunciBaru ? "Simpan dulu, baru uji" : ""}
                      onClick={() => void ujiKunci(b.id)}
                    >
                      {hasil === "jalan" ? "Menguji…" : "Uji"}
                    </button>
                    {!env && (
                      <>
                        <label className="kai-saklar">
                          <input type="checkbox" checked={b.aktif} onChange={(e) => ubah(b.id, { aktif: e.target.checked })} />
                          Aktif
                        </label>
                        <button
                          type="button" className="btn btn-light btn-mini"
                          onClick={() => { setDaftar((d) => d.filter((x) => x.id !== b.id)); setBerubah(true); }}
                        >
                          Hapus
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="cbt-form-aksi">
          <button type="button" className="btn btn-primary" disabled={!berubah || sibuk} onClick={() => void simpan()}>
            {sibuk ? "Menyimpan…" : "Simpan"}
          </button>
          {berubah && <span className="cbt-catatan">Ada perubahan yang belum disimpan.</span>}
        </div>
      </div>

      {/* ---------- PEMAKAIAN BULANAN ---------- */}
      <div className="panel">
        <div className="kai-pakai-kepala">
          <b className="kai-sub">Pemakaian</b>
          <select
            value={bulan}
            onChange={(e) => { setBulan(e.target.value); void muatDaftar(e.target.value); }}
          >
            {bulanAda.map((b) => <option key={b} value={b}>{ejaBulan(b)}</option>)}
          </select>
        </div>

        {!pemakaian || (pemakaian.kunci.length === 0 && pemakaian.fitur.length === 0) ? (
          <div className="dempty">Belum ada pemakaian bulan ini.</div>
        ) : (
          <>
            <div className="qtable-wrap">
              <table className="dsh-table kai-pakai">
                <thead>
                  <tr><th>Kunci</th><th>Berhasil</th><th>Gagal</th><th>Token</th><th>Galat terakhir</th></tr>
                </thead>
                <tbody>
                  {pemakaian.kunci.map((k) => (
                    <tr key={k.id}>
                      <td data-kolom="Kunci">
                        <b>{labelPenyedia((k.penyedia as Penyedia) ?? "gemini")}</b>{" "}
                        <code>{k.label ?? k.id}</code>
                      </td>
                      <td data-kolom="Berhasil" className="cbtv-ka">{angka(k.ok)}</td>
                      <td data-kolom="Gagal" className={`cbtv-ka${k.gagal > 0 ? " kai-gagal-angka" : ""}`}>{angka(k.gagal)}</td>
                      <td data-kolom="Token" className="cbtv-ka">{k.masuk + k.keluar > 0 ? angka(k.masuk + k.keluar) : "—"}</td>
                      <td data-kolom="Galat terakhir" className="kai-galat-sel">
                        {k.galat ? <><small>{ejaWaktu(k.waktuGalat)}</small> {k.galat}</> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="kai-fitur-pakai">
              {pemakaian.fitur.map((f) => (
                <span key={f.nama}>
                  <b>{angka(f.ok + f.gagal)}</b> {f.nama}
                  {f.gagal > 0 && <i> · {angka(f.gagal)} gagal</i>}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
