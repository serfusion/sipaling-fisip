"use client";

// ============================================================
// ARSIP DRIVE — menu kelima panel CBT
//
// Tempat menyimpan tautan Google Drive berisi arsip hasil penilaian, masing-
// masing dengan tautan pendek di portal (<portal>/s/KODE) yang mudah
// dibagikan dan dicetak.
//
//   - Pengajar, Admin, dan Super Admin dapat MENYIMPAN tautan.
//   - Pengajar melihat arsipnya sendiri; Admin dan Super Admin melihat semua.
//   - HANYA Super Admin yang dapat MENGHAPUS. Tautan arsip adalah petunjuk
//     terakhir ke hasil penilaian sesudah isi tugasnya dihapus dari portal,
//     jadi menghilangkannya tidak boleh semudah menyimpannya.
//
// Server menegakkan semua aturan ini; tombol yang dikunci di sini hanya
// supaya layar tidak menjanjikan apa yang akan ditolak.
// ============================================================

import { useCallback, useEffect, useState } from "react";

type Arsip = {
  id: number; kode: string; pendek: string; judul: string; url: string; catatan: string;
  tugas: number | null; judulTugas: string; klik: number; oleh: string; dibuat: string;
};

async function minta<T>(url: string, init?: RequestInit): Promise<T> {
  const jawab = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json" } });
  const d = await jawab.json().catch(() => ({ success: false, message: `Server menjawab ${jawab.status}.` }));
  if (!jawab.ok || !d.success) throw new Error(d.message || `Server menjawab ${jawab.status}.`);
  return d as T;
}

const tautanPenuh = (pendek: string) => (typeof window === "undefined" ? pendek : `${window.location.origin}${pendek}`);

/** Formulir ringkas "simpan tautan Drive", dipakai di langkah 6 Penilaian tugas. */
export function SimpanArsipDrive({ tugasId, judulAwal, onTersimpan }: {
  tugasId?: number; judulAwal?: string; onTersimpan?: (a: Arsip) => void;
}) {
  const [judul, setJudul] = useState(judulAwal ?? "");
  const [url, setUrl] = useState("");
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [hasil, setHasil] = useState<Arsip | null>(null);
  const [disalin, setDisalin] = useState(false);

  useEffect(() => {
    const jam = setTimeout(() => { setJudul(judulAwal ?? ""); setHasil(null); }, 0);
    return () => clearTimeout(jam);
  }, [judulAwal, tugasId]);

  async function simpan() {
    setGalat(""); setSibuk(true); setDisalin(false);
    try {
      const d = await minta<{ arsip: Arsip }>("/api/arsip-drive", {
        method: "POST", body: JSON.stringify({ judul, url, catatan, tugas: tugasId }),
      });
      setHasil(d.arsip);
      setUrl(""); setCatatan("");
      onTersimpan?.(d.arsip);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Tautan belum tersimpan.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="ad-simpan">
      <div className="ad-baris">
        <label><span>Judul arsip</span><input value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Arsip Tugas 2 Public Relations 2026" /></label>
        <label><span>Tautan Google Drive</span><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" inputMode="url" /></label>
      </div>
      <label><span>Catatan (opsional)</span><input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. Semester Ganjil 2026/2027, kelas 3A" /></label>
      <div className="pt-tombol">
        <button type="button" className="btn btn-primary" disabled={sibuk || !url.trim() || judul.trim().length < 3} onClick={() => void simpan()}>
          {sibuk ? "Menyimpan…" : "Simpan ke Arsip Drive"}
        </button>
      </div>
      {galat && <div className="dsh-error">{galat}</div>}
      {hasil && (
        <div className="ad-hasil">
          <span>Tersimpan. Tautan pendek:</span>
          <a href={hasil.pendek} target="_blank" rel="noreferrer"><b>{tautanPenuh(hasil.pendek)}</b></a>
          <button type="button" className="btn btn-light btn-mini" onClick={() => {
            void navigator.clipboard?.writeText(tautanPenuh(hasil.pendek)); setDisalin(true);
          }}>{disalin ? "✓ Disalin" : "Salin"}</button>
        </div>
      )}
    </div>
  );
}

/** Menu Arsip Drive: daftar seluruh tautan arsip dan tautan pendeknya. */
export function PanelArsipDrive() {
  const [arsip, setArsip] = useState<Arsip[] | null>(null);
  const [bolehHapus, setBolehHapus] = useState(false);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");
  const [cari, setCari] = useState("");
  const [tambah, setTambah] = useState(false);

  const muat = useCallback(async () => {
    try {
      const d = await minta<{ arsip: Arsip[]; bolehHapus: boolean }>("/api/arsip-drive");
      setArsip(d.arsip);
      setBolehHapus(d.bolehHapus);
    } catch (e) {
      setArsip([]);
      setGalat(e instanceof Error ? e.message : "Arsip Drive belum dapat dimuat.");
    }
  }, []);

  useEffect(() => {
    const jam = setTimeout(() => void muat(), 0);
    return () => clearTimeout(jam);
  }, [muat]);

  async function hapus(a: Arsip) {
    if (!window.confirm(`Hapus tautan arsip "${a.judul}"?\n\nTautan pendek ${a.pendek} berhenti bekerja. Berkas di Google Drive tidak ikut terhapus.`)) return;
    setGalat("");
    try {
      const d = await minta<{ pesan: string }>(`/api/arsip-drive?id=${a.id}`, { method: "DELETE" });
      setKabar(d.pesan);
      setArsip((s) => s?.filter((x) => x.id !== a.id) ?? s);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Arsip belum dapat dihapus.");
    }
  }

  const q = cari.trim().toLowerCase();
  const tampil = (arsip ?? []).filter((a) => !q || [a.judul, a.judulTugas, a.catatan, a.oleh, a.kode].some((x) => x.toLowerCase().includes(q)));

  return (
    <div className="pt ad">
      <p className="cbtv-cara-baca">
        Hasil penilaian yang sudah diunduh (zip arsip dari Penilaian tugas, langkah 6) ditaruh di Google Drive, lalu
        tautannya disimpan di sini dengan tautan pendek portal. Isi tugas boleh dihapus dari portal sesudahnya; tautan
        arsip tetap ada. {bolehHapus ? "Sebagai Super Admin, Anda dapat menghapus tautan arsip." : "Hanya Super Admin yang dapat menghapus tautan arsip."}
      </p>
      {kabar && <div className="dsh-ok">{kabar}</div>}
      {galat && <div className="dsh-error">{galat}</div>}

      <div className="panel pt-pilih">
        <label><span>Cari arsip</span><input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Judul, tugas, catatan, atau kode" /></label>
        <button type="button" className="btn btn-primary" onClick={() => setTambah((t) => !t)}>{tambah ? "Tutup" : "+ Simpan tautan Drive"}</button>
      </div>

      {tambah && (
        <div className="panel pt-langkah">
          <SimpanArsipDrive onTersimpan={(a) => { setArsip((s) => [a, ...(s ?? [])]); setKabar(`Tautan pendek ${a.pendek} dibuat.`); }} />
        </div>
      )}

      {arsip === null ? <div className="dempty">Memuat…</div> : !tampil.length ? (
        <div className="dempty">{arsip.length ? "Tidak ada arsip yang cocok." : "Belum ada tautan arsip."}</div>
      ) : (
        <div className="panel pt-tabel-wadah">
          <table className="pt-tabel ad-tabel">
            <thead><tr><th>Arsip</th><th>Tautan pendek</th><th>Google Drive</th><th>Dibuka</th><th>Disimpan</th><th /></tr></thead>
            <tbody>
              {tampil.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.judul}</b>{a.judulTugas && <small>{a.judulTugas}</small>}{a.catatan && <small>{a.catatan}</small>}</td>
                  <td>
                    <a href={a.pendek} target="_blank" rel="noreferrer"><code>{a.pendek}</code></a>
                    <button type="button" className="btn btn-light btn-mini" onClick={() => { void navigator.clipboard?.writeText(tautanPenuh(a.pendek)); setKabar(`Tautan ${tautanPenuh(a.pendek)} disalin.`); }}>Salin</button>
                  </td>
                  <td><a className="ad-drive" href={a.url} target="_blank" rel="noreferrer">{a.url.replace(/^https:\/\//, "").slice(0, 48)}{a.url.length > 56 ? "…" : ""}</a></td>
                  <td>{a.klik}×</td>
                  <td>{a.oleh}<small>{new Date(a.dibuat).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</small></td>
                  <td>
                    <button type="button" className="btn btn-light btn-mini" disabled={!bolehHapus} onClick={() => void hapus(a)}
                      title={bolehHapus ? "Hapus tautan arsip" : "Hanya Super Admin yang dapat menghapus"}>
                      {bolehHapus ? "Hapus" : "🔒 Hapus"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
