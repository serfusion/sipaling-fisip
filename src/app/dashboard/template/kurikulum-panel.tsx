"use client";

// ============================================================
// BUAT KURIKULUM — acuan fakultas menjadi template matakuliah PDDIKTI
//
// Tiga langkah, dan hanya langkah kedua yang menuntut keputusan manusia:
// unggah acuan → setel tiga hal yang tidak ada di acuan itu → unduh.
//
// Seluruh pembacaan dan penggabungannya ada di kurikulum-parse.ts, murni dan
// teruji. Berkas ini hanya menggambar dan menyerahkan berkasnya.
// ============================================================

import { useMemo, useState } from "react";
import { buatXlsxKelulusan } from "@/lib/kelulusan-xlsx";
import {
  JENIS_MK, KELOMPOK_MK, KOLOM_MATKUL, NAMA_LEMBAR_MATKUL, OPSI_BAWAAN, PRODI_MATKUL,
  bacaKurikulumAcuan, barisKeAoa, gabungKonsentrasi, periksaBaris, tahunKurikulumSah,
  type Aoa, type BarisMatkul, type Bentrok, type OpsiKeluaran,
} from "./kurikulum-parse";

function unduh(blob: Blob, nama: string) {
  const url = URL.createObjectURL(blob);
  const tautan = document.createElement("a");
  tautan.href = url;
  tautan.download = nama;
  tautan.click();
  URL.revokeObjectURL(url);
}

type Pesan = { kind: "ok" | "err"; text: string } | null;

export default function KurikulumModule() {
  const [baris, setBaris] = useState<BarisMatkul[]>([]);
  const [bentrok, setBentrok] = useState<Bentrok[]>([]);
  const [tolak, setTolak] = useState<Array<{ baris: string; alasan: string }>>([]);
  const [konsentrasi, setKonsentrasi] = useState<string[]>([]);
  const [ganda, setGanda] = useState(0);
  const [namaBerkas, setNamaBerkas] = useState("");
  const [pesan, setPesan] = useState<Pesan>(null);
  const [sibuk, setSibuk] = useState(false);

  const [opsi, setOpsi] = useState<OpsiKeluaran>({ ...OPSI_BAWAAN });
  const [cari, setCari] = useState("");
  const [saringSemester, setSaringSemester] = useState("");

  const masalah = useMemo(() => periksaBaris(baris), [baris]);
  const idBermasalah = useMemo(() => new Set(masalah.map((m) => m.id)), [masalah]);
  const siap = useMemo(() => baris.filter((b) => !idBermasalah.has(b.id)), [baris, idBermasalah]);

  const tampil = useMemo(() => {
    const kunci = cari.trim().toLowerCase();
    return baris.filter((b) => {
      if (saringSemester && String(b.semester) !== saringSemester) return false;
      if (!kunci) return true;
      return b.kode.toLowerCase().includes(kunci) || b.nama.toLowerCase().includes(kunci);
    });
  }, [baris, cari, saringSemester]);

  const perSemester = useMemo(() => {
    const peta = new Map<number, number>();
    for (const b of baris) peta.set(b.semester, (peta.get(b.semester) ?? 0) + 1);
    return [...peta.entries()].sort((a, b) => a[0] - b[0]);
  }, [baris]);

  const totalSks = useMemo(() => siap.reduce((n, b) => n + (b.sks ?? 0), 0), [siap]);

  const lengkap = tahunKurikulumSah(opsi.tahunKurikulum) && opsi.kodeProdi.trim() !== "";

  async function bacaBerkas(berkas: File) {
    setSibuk(true);
    setPesan(null);
    try {
      // xlsx dimuat saat dipakai, bukan saat panel dibuka. Pustakanya besar.
      const XLSX = await import("xlsx");
      const wb = XLSX.read(new Uint8Array(await berkas.arrayBuffer()), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(
        ws as Parameters<typeof XLSX.utils.sheet_to_json>[0],
        { header: 1, raw: true, defval: "" },
      ) as Aoa;

      const baca = bacaKurikulumAcuan(aoa);
      const gab = gabungKonsentrasi(baca.baris);
      setBaris(gab.baris);
      setBentrok(gab.bentrok);
      setGanda(gab.ganda);
      setTolak(baca.tolak);
      setKonsentrasi(baca.konsentrasi);
      setNamaBerkas(berkas.name);
      setPesan(
        gab.baris.length > 0
          ? { kind: "ok", text: `${gab.baris.length} mata kuliah dari ${baca.konsentrasi.length} konsentrasi.` }
          : { kind: "err", text: baca.tolak[0]?.alasan || "Tidak ada mata kuliah yang terbaca." },
      );
    } catch {
      setPesan({ kind: "err", text: "Berkasnya tidak dapat dibaca. Pastikan .xlsx atau .csv." });
    } finally {
      setSibuk(false);
    }
  }

  function unduhData() {
    if (!siap.length) { setPesan({ kind: "err", text: "Belum ada baris yang siap." }); return; }
    if (!lengkap) { setPesan({ kind: "err", text: "Tahun kurikulum dan kode prodi wajib diisi." }); return; }
    unduh(
      buatXlsxKelulusan(KOLOM_MATKUL, barisKeAoa(siap, opsi), NAMA_LEMBAR_MATKUL),
      `Matakuliah-PDDIKTI-${opsi.kodeProdi}-${opsi.tahunKurikulum}.xlsx`,
    );
    setPesan({ kind: "ok", text: `${siap.length} baris terunduh. Unggah apa adanya ke PDDIKTI.` });
  }

  function unduhKosong() {
    unduh(buatXlsxKelulusan(KOLOM_MATKUL, [], NAMA_LEMBAR_MATKUL), "Template-Matakuliah-PDDIKTI-kosong.xlsx");
  }

  return (
    <main className="tpl-main kel-wrap">
      {pesan && <div className={pesan.kind === "ok" ? "dsh-ok" : "dsh-error"}>{pesan.text}</div>}

      {/* ---------- 1. UNGGAH ---------- */}
      <section className="panel kel-sec">
        <h2 className="kel-h2"><span className="kel-no">1</span> Unggah acuan kurikulum fakultas</h2>
        <div className="kel-baris-tombol">
          <label className="btn btn-primary btn-mini cbtv-berkas">
            📄 Pilih berkas Excel
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void bacaBerkas(f); e.target.value = ""; }}
            />
          </label>
          <button type="button" className="btn btn-light btn-mini" onClick={unduhKosong}>
            ⬇ Template kosong PDDIKTI
          </button>
          {namaBerkas && <span className="cbt-catatan">{namaBerkas}</span>}
          {sibuk && <span className="cbt-catatan">Membaca…</span>}
        </div>
        <p className="cbt-catatan">
          Konsentrasi yang berdampingan dan semester yang bertumpuk dibaca sendiri.
          Mata kuliah yang sama di beberapa konsentrasi digabung menjadi satu baris.
        </p>
      </section>

      {baris.length > 0 && (
        <>
          {/* ---------- 2. SETELAN ---------- */}
          <section className="panel kel-sec">
            <h2 className="kel-h2"><span className="kel-no">2</span> Isi yang tidak ada di acuan</h2>
            <div className="cbt-baris">
              <label>
                <span>Tahun Kurikulum *</span>
                <input
                  value={opsi.tahunKurikulum}
                  onChange={(e) => setOpsi({ ...opsi, tahunKurikulum: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                  placeholder="20241"
                />
              </label>
              <label>
                <span>Kode Prodi *</span>
                <select value={opsi.kodeProdi} onChange={(e) => setOpsi({ ...opsi, kodeProdi: e.target.value })}>
                  <option value="">— pilih —</option>
                  {PRODI_MATKUL.map((p) => (
                    <option key={p.kode} value={p.kode}>{p.kode} · {p.nama}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Jenis MK</span>
                <select value={opsi.jenisMk} onChange={(e) => setOpsi({ ...opsi, jenisMk: e.target.value })}>
                  {JENIS_MK.map((j) => <option key={j.kode} value={j.kode}>{j.label}</option>)}
                </select>
              </label>
              <label>
                <span>Wajib</span>
                <select value={opsi.wajib} onChange={(e) => setOpsi({ ...opsi, wajib: e.target.value })}>
                  <option value="1">1 — Ya</option>
                  <option value="0">0 — Tidak</option>
                </select>
              </label>
              <label>
                <span>Kelompok MK</span>
                <select value={opsi.kelompokMk} onChange={(e) => setOpsi({ ...opsi, kelompokMk: e.target.value })}>
                  {KELOMPOK_MK.map((k) => <option key={k.kode} value={k.kode}>{k.label}</option>)}
                </select>
              </label>
            </div>
            {!tahunKurikulumSah(opsi.tahunKurikulum) && opsi.tahunKurikulum !== "" && (
              <p className="cbt-catatan">Bentuknya tahun + semester, mis. 20241.</p>
            )}
            <p className="cbt-catatan">
              SKS Praktek, Praktek Lapangan, dan Simulasi diisi 0 — acuan fakultas hanya memuat satu angka SKS.
            </p>
          </section>

          {/* ---------- 3. PERIKSA & UNDUH ---------- */}
          <section className="panel kel-sec">
            <h2 className="kel-h2"><span className="kel-no">3</span> Periksa lalu unduh</h2>

            <div className="krk-ringkas">
              <span><b>{baris.length}</b> mata kuliah</span>
              <span><b>{totalSks}</b> SKS</span>
              <span>{konsentrasi.join(" · ")}</span>
              {ganda > 0 && <span>{ganda} baris ganda digabung</span>}
            </div>

            <div className="krk-sem">
              {perSemester.map(([sem, n]) => (
                <button
                  key={sem}
                  type="button"
                  className={saringSemester === String(sem) ? "on" : ""}
                  onClick={() => setSaringSemester(saringSemester === String(sem) ? "" : String(sem))}
                >
                  Sem {sem} <i>{n}</i>
                </button>
              ))}
            </div>

            {bentrok.length > 0 && (
              <div className="dsh-note">
                <b>{bentrok.length} kode dipakai untuk isi yang berbeda</b>
                <ul>
                  {bentrok.map((b) => (
                    <li key={b.kode}>
                      <code>{b.kode}</code>{" "}
                      {b.versi.map((v) => `${v.nama} (${v.sks ?? "?"} sks, sem ${v.semester}, ${v.konsentrasi})`).join(" — vs — ")}
                    </li>
                  ))}
                </ul>
                <small>Yang dipakai versi pertama. Betulkan di acuan fakultas bila yang benar bukan itu.</small>
              </div>
            )}

            {masalah.length > 0 && (
              <div className="dsh-error">
                <b>{masalah.length} baris tidak ikut terunduh</b>
                <ul>
                  {masalah.slice(0, 8).map((m) => <li key={m.id}><code>{m.kode}</code> {m.nama} — {m.sebab}</li>)}
                </ul>
              </div>
            )}

            {tolak.length > 0 && (
              <details className="krk-lipat">
                <summary>{tolak.length} baris acuan dilewati</summary>
                <ul>{tolak.slice(0, 20).map((t, i) => <li key={i}>{t.baris} — {t.alasan}</li>)}</ul>
              </details>
            )}

            <input
              className="cbtv-cari"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari kode atau nama…"
            />

            <div className="qtable-wrap">
              <table className="dsh-table krk-tabel">
                <thead>
                  <tr><th>Kode MK</th><th>Nama MK</th><th>SKS</th><th>Sem</th><th>Konsentrasi</th></tr>
                </thead>
                <tbody>
                  {tampil.slice(0, 200).map((b) => (
                    <tr key={b.id} className={idBermasalah.has(b.id) ? "krk-salah" : ""}>
                      <td data-kolom="Kode MK"><code>{b.kode}</code></td>
                      <td data-kolom="Nama MK">{b.nama}</td>
                      <td data-kolom="SKS" className="cbtv-ka">{b.sks ?? "—"}</td>
                      <td data-kolom="Sem" className="cbtv-ka">{b.semester}</td>
                      <td data-kolom="Konsentrasi">{b.konsentrasi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tampil.length > 200 && <p className="cbt-catatan">Ditampilkan 200 pertama dari {tampil.length}.</p>}

            <div className="kel-baris-tombol kel-unduh">
              <button type="button" className="btn btn-primary" onClick={unduhData} disabled={!siap.length || !lengkap}>
                ⬇ Unduh {siap.length} baris untuk PDDIKTI
              </button>
              {!lengkap && <span className="cbt-catatan">Isi tahun kurikulum dan kode prodi dulu.</span>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
