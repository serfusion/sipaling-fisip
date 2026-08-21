"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PROPOSAL_STATUS } from "@/lib/academic";
import { formatStamp, type ProposalRow } from "./proposal-types";
import { makeLetterNumber, openSuratTugas } from "./surat-tugas";

// Panel akun dosen: menerima/menolak mahasiswa yang sudah disetujui Prodi,
// lalu melihat daftar bimbingan berjalan dan mengunduh SURAT TUGAS yang
// isinya otomatis mengikuti jumlah mahasiswa bimbingan terkini.
export default function GuidancePanel({ lecturerName }: { lecturerName: string }) {
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/title-proposals", { cache: "no-store" });
      const payload = (await response.json()) as { success?: boolean; message?: string; proposals?: ProposalRow[] };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Daftar bimbingan belum dapat dimuat.");
      setRows(payload.proposals || []);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Daftar bimbingan belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Ditunda satu tick agar setState tidak berjalan sinkron di dalam effect.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const pending = useMemo(
    () => rows.filter((row) => row.status === PROPOSAL_STATUS.waitingLecturer),
    [rows],
  );
  const accepted = useMemo(
    () => rows.filter((row) => row.status === PROPOSAL_STATUS.acceptedLecturer),
    [rows],
  );
  const declined = useMemo(
    () => rows.filter((row) => row.status === PROPOSAL_STATUS.rejectedLecturer),
    [rows],
  );

  async function decide(row: ProposalRow, action: "accept" | "decline") {
    const lecturerNote = (noteDraft[row.code] || "").trim();
    if (action === "decline" && !lecturerNote) {
      window.alert("Tuliskan alasan penolakan terlebih dahulu.");
      return;
    }
    setBusy(`${row.code}-${action}`);
    setFeedback("");
    try {
      const response = await fetch(`/api/title-proposals/${encodeURIComponent(row.code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, lecturerNote }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Keputusan belum tersimpan.");
      setFeedback(
        action === "accept"
          ? "Diterima. Surat Tugas otomatis diperbarui."
          : "Ditolak. Prodi menerima notifikasi URGENT.",
      );
      setNoteDraft((current) => ({ ...current, [row.code]: "" }));
      await load();
    } catch (reason: unknown) {
      window.alert(reason instanceof Error ? reason.message : "Keputusan belum tersimpan.");
    } finally {
      setBusy("");
    }
  }

  function downloadSuratTugas() {
    openSuratTugas({
      lecturerName,
      letterNumber: makeLetterNumber(lecturerName, accepted.length),
      students: accepted.map((row) => ({
        nim: row.nim,
        studentName: row.studentName,
        studyProgram: row.studyProgram,
        concentration: row.concentration,
        finalTaskType: row.finalTaskType,
        title: row.title,
        decidedAt: row.decidedAt || row.updatedAt,
      })),
    });
  }

  return (
    <section>
      <p className="section-eyebrow">BIMBINGAN</p>
      <h2 className="dsh-title">Mahasiswa bimbingan tugas akhir</h2>

      {error && <div className="dsh-error">{error}</div>}
      {feedback && <div className="dsh-ok">{feedback}</div>}

      {pending.length > 0 && (
        <div className="panel gd-pending">
          <div className="gd-pending-head">
            <span className="urgent-tag urgent-tag-info">PERLU KEPUTUSAN</span>
            <b>{pending.length} mahasiswa menunggu jawaban Anda</b>
          </div>
          {pending.map((row) => (
            <article className="gd-card" key={row.code}>
              <header>
                <div>
                  <b>{row.studentName}</b>
                  <small>{row.nim} · {row.studyProgram} · {row.concentration}</small>
                </div>
                <span className="gd-type">{row.finalTaskType}</span>
              </header>
              <p className="gd-title">“{row.title}”</p>
              <div className="gd-meta">
                <span>IPK {Number(row.gpa).toFixed(2).replace(".", ",")}</span>
                <span>Kode {row.code}</span>
                <span>Disetujui Prodi {formatStamp(row.reviewedAt)}</span>
              </div>
              {row.prodiNote && <p className="gd-note">Catatan Prodi: {row.prodiNote}</p>}
              <textarea
                className="gd-textarea"
                rows={2}
                placeholder="Catatan untuk mahasiswa. Wajib bila menolak."
                value={noteDraft[row.code] || ""}
                onChange={(event) => setNoteDraft((current) => ({ ...current, [row.code]: event.target.value }))}
              />
              <div className="gd-actions">
                <button type="button" className="btn btn-primary" disabled={busy !== ""} onClick={() => void decide(row, "accept")}>
                  {busy === `${row.code}-accept` ? "Menyimpan…" : "✓ TERIMA"}
                </button>
                <button type="button" className="btn btn-danger" disabled={busy !== ""} onClick={() => void decide(row, "decline")}>
                  {busy === `${row.code}-decline` ? "Menyimpan…" : "✕ TOLAK"}
                </button>
                {row.paymentFileName && (
                  <a className="dlink" href={`/api/proposal-files/${encodeURIComponent(row.code)}`} target="_blank" rel="noreferrer">
                    Lihat bukti keuangan ↗
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="panel">
        <div className="list-head">
          <h3>Surat Tugas — {accepted.length} mahasiswa bimbingan</h3>
          <button type="button" className="btn btn-primary btn-mini" onClick={downloadSuratTugas} disabled={accepted.length === 0}>
            ⇩ Unduh Surat Tugas (PDF)
          </button>
        </div>
        <p className="helper gd-helper">Dibuat otomatis dari daftar di bawah. Unduh ulang setiap ada tambahan.</p>
        <div className="qtable-wrap">
          <table className="qt">
            <thead>
              <tr><th>Mahasiswa</th><th>Judul</th><th>Jenis</th><th>Disetujui</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4}><div className="dempty">Memuat daftar bimbingan…</div></td></tr>
              ) : accepted.length === 0 ? (
                <tr><td colSpan={4}><div className="dempty"><b>Belum ada mahasiswa bimbingan</b><br />Muncul di sini setelah Anda menekan TERIMA.</div></td></tr>
              ) : (
                accepted.map((row) => (
                  <tr key={row.id}>
                    <td><b>{row.studentName}</b><small>{row.nim} · {row.studyProgram}</small></td>
                    <td>{row.title}<small>{row.concentration}</small></td>
                    <td>{row.finalTaskType}</td>
                    <td>{formatStamp(row.decidedAt || row.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {declined.length > 0 && (
        <div className="panel">
          <h3>Pengajuan yang Anda tolak</h3>
          <div className="qtable-wrap">
            <table className="qt">
              <thead><tr><th>Mahasiswa</th><th>Judul</th><th>Alasan</th><th>Waktu</th></tr></thead>
              <tbody>
                {declined.map((row) => (
                  <tr key={row.id}>
                    <td><b>{row.studentName}</b><small>{row.nim}</small></td>
                    <td>{row.title}</td>
                    <td>{row.lecturerNote || "—"}</td>
                    <td>{formatStamp(row.decidedAt || row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
