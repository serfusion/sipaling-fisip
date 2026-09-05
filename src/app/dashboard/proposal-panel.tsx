"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PROPOSAL_STATUS } from "@/lib/academic";
import { LecturerPicker, type LecturerOption } from "../lecturer-picker";
import { formatStamp, type ProposalRow } from "./proposal-types";

const FILTERS = [
  "Semua",
  PROPOSAL_STATUS.waitingProdi,
  PROPOSAL_STATUS.waitingLecturer,
  PROPOSAL_STATUS.acceptedLecturer,
  PROPOSAL_STATUS.rejectedLecturer,
  PROPOSAL_STATUS.rejectedProdi,
];

function statusTone(status: string) {
  if (status === PROPOSAL_STATUS.acceptedLecturer) return "ok";
  if (status === PROPOSAL_STATUS.rejectedLecturer) return "urgent";
  if (status === PROPOSAL_STATUS.rejectedProdi) return "bad";
  if (status === PROPOSAL_STATUS.waitingLecturer) return "run";
  return "wait";
}

// Panel Admin Prodi: verifikasi berkas, seleksi salah satu dari tiga dosen
// usulan mahasiswa, atau tunjuk dosen pengganti bila dosen terpilih menolak.
export default function ProposalPanel({
  lecturers,
  isSuperAdmin,
}: {
  lecturers: LecturerOption[];
  /** Aksi di luar alur (tunjuk dosen luar usulan, ubah yang sudah final,
   *  hapus) sengaja dikunci untuk Super Admin agar tidak disalahgunakan. */
  isSuperAdmin: boolean;
}) {
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [openCode, setOpenCode] = useState("");

  const [finance, setFinance] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [note, setNote] = useState("");
  const [pickedLecturer, setPickedLecturer] = useState<number | null>(null);
  const [replacement, setReplacement] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/title-proposals", { cache: "no-store" });
      const payload = (await response.json()) as { success?: boolean; message?: string; proposals?: ProposalRow[] };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Pengajuan judul belum dapat dimuat.");
      setRows(payload.proposals || []);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Pengajuan judul belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Ditunda satu tick agar setState tidak berjalan sinkron di dalam effect.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(
    () => (filter === "Semua" ? rows : rows.filter((row) => row.status === filter)),
    [rows, filter],
  );
  const selected = useMemo(() => rows.find((row) => row.code === openCode) || null, [rows, openCode]);
  const urgentCount = rows.filter((row) => row.status === PROPOSAL_STATUS.rejectedLecturer).length;

  function openDetail(row: ProposalRow) {
    setOpenCode(row.code);
    setFinance(row.financeVerified);
    setEligible(row.eligibilityVerified);
    setNote(row.prodiNote || "");
    setPickedLecturer(row.choices.find((choice) => choice.selected)?.lecturerId ?? null);
    setReplacement(null);
    setFeedback("");
    setActionError("");
  }

  async function send(action: "verify" | "approve" | "reject", lecturerId?: number) {
    if (!selected) return;
    setBusy(action);
    setFeedback("");
    setActionError("");
    try {
      const response = await fetch(`/api/title-proposals/${encodeURIComponent(selected.code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          financeVerified: finance,
          eligibilityVerified: eligible,
          prodiNote: note,
          lecturerId,
        }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Perubahan belum tersimpan.");
      setFeedback(
        action === "verify"
          ? "Verifikasi tersimpan."
          : action === "approve"
            ? "Diteruskan ke dosen terpilih."
            : "Ditolak. Alasannya terlihat di kode pelacakan mahasiswa.",
      );
      await load();
    } catch (reason: unknown) {
      setActionError(reason instanceof Error ? reason.message : "Perubahan belum tersimpan.");
    } finally {
      setBusy("");
    }
  }

  async function remove(code: string) {
    if (!window.confirm(`Hapus permanen pengajuan judul ${code}? Bukti keuangannya ikut terhapus.`)) return;
    setBusy("delete");
    try {
      const response = await fetch(`/api/title-proposals/${encodeURIComponent(code)}`, { method: "DELETE" });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Pengajuan belum dapat dihapus.");
      setOpenCode("");
      await load();
    } catch (reason: unknown) {
      window.alert(reason instanceof Error ? reason.message : "Pengajuan belum dapat dihapus.");
    } finally {
      setBusy("");
    }
  }

  const targetLecturer = replacement ?? pickedLecturer;
  const readyToApprove = finance && eligible && targetLecturer !== null;

  return (
    <section>
      <p className="section-eyebrow">PROGRAM STUDI</p>
      <h2 className="dsh-title">Pengajuan Judul Tugas Akhir</h2>

      {urgentCount > 0 && (
        <div className="urgent-banner">
          <span className="urgent-tag">URGENT</span>
          <div>
            <b>{urgentCount} pengajuan ditolak dosen.</b>
            <small>Buka detailnya untuk memilih dosen lain.</small>
          </div>
          <button type="button" className="btn btn-light btn-mini" onClick={() => setFilter(PROPOSAL_STATUS.rejectedLecturer)}>
            Lihat daftar
          </button>
        </div>
      )}

      <div className="chips">
        {FILTERS.map((item) => {
          const count = item === "Semua" ? rows.length : rows.filter((row) => row.status === item).length;
          return (
            <button type="button" key={item} className={`chip ${filter === item ? "on" : ""}`} onClick={() => setFilter(item)}>
              {item}{count > 0 ? ` · ${count}` : ""}
            </button>
          );
        })}
        <button type="button" className="chip" onClick={() => void load()}>↻ Muat ulang</button>
      </div>

      {error && <div className="dsh-error">{error}</div>}

      <div className="panel qtable-wrap">
        <table className="qt">
          <thead>
            <tr><th>Kode & Judul</th><th>Mahasiswa</th><th>Verifikasi</th><th>Status</th><th>Masuk</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}><div className="dempty">Memuat pengajuan judul…</div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5}><div className="dempty"><b>Belum ada pengajuan</b><br />untuk filter ini.</div></td></tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className={openCode === row.code ? "row-on" : ""} onClick={() => openDetail(row)}>
                  <td><b>{row.code}</b><small>{row.title}</small></td>
                  <td><b>{row.studentName}</b><small>{row.nim} · IPK {Number(row.gpa).toFixed(2).replace(".", ",")}</small></td>
                  <td>
                    <span className={`vchk ${row.financeVerified ? "on" : ""}`}>{row.financeVerified ? "✓" : "○"} Keuangan</span>
                    <span className={`vchk ${row.eligibilityVerified ? "on" : ""}`}>{row.eligibilityVerified ? "✓" : "○"} Layak</span>
                  </td>
                  <td><span className={`tp-pill tp-pill-${statusTone(row.status)}`}>{row.status}</span></td>
                  <td>{formatStamp(row.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="panel prop-detail">
          <div className="prop-detail-head">
            <div>
              <p className="section-eyebrow">DETAIL PENGAJUAN</p>
              <h3>{selected.title}</h3>
              <span className="prop-code">{selected.code}</span>
            </div>
            <span className={`tp-pill tp-pill-${statusTone(selected.status)}`}>{selected.status}</span>
            <button type="button" className="x" onClick={() => setOpenCode("")} aria-label="Tutup detail">✕</button>
          </div>

          {selected.status === PROPOSAL_STATUS.rejectedLecturer && (
            <div className="urgent-banner urgent-inline">
              <span className="urgent-tag">URGENT</span>
              <div>
                <b>Dosen terpilih menolak mahasiswa ini.</b>
                <small>
                  Alasan: {selected.lecturerNote || "tidak dicantumkan"}.{" "}
                  {isSuperAdmin ? "Pilih usulan lain atau tunjuk pengganti." : "Pilih usulan lain, atau minta Super Admin menunjuk pengganti."}
                </small>
              </div>
            </div>
          )}

          <dl className="dd">
            <div><dt>Nama</dt><dd>{selected.studentName}</dd></div>
            <div><dt>NIM</dt><dd>{selected.nim}</dd></div>
            <div><dt>Program Studi</dt><dd>{selected.studyProgram}</dd></div>
            <div><dt>Konsentrasi</dt><dd>{selected.concentration}</dd></div>
            <div><dt>IPK Terakhir</dt><dd>{Number(selected.gpa).toFixed(2).replace(".", ",")}</dd></div>
            <div><dt>Jenis Tugas Akhir</dt><dd>{selected.finalTaskType}</dd></div>
            <div className="dwide"><dt>Alamat</dt><dd>{selected.address || "-"}</dd></div>
            <div><dt>Kontak</dt><dd>{selected.contact || "-"}</dd></div>
            <div><dt>Diverifikasi oleh</dt><dd>{selected.reviewedBy || "-"}{selected.reviewedAt ? ` · ${formatStamp(selected.reviewedAt)}` : ""}</dd></div>
            <div className="dwide"><dt>Pernyataan pemohon</dt><dd className="prop-statement">{selected.statement}</dd></div>
          </dl>

          {selected.paymentFileName ? (
            <a className="dlink dlink-file" href={`/api/proposal-files/${encodeURIComponent(selected.code)}`} target="_blank" rel="noreferrer">
              ⇩ Buka bukti keuangan: {selected.paymentFileName}
            </a>
          ) : (
            <div className="nofile">Bukti keuangan tidak terlampir pada pengajuan ini.</div>
          )}

          <div className="prop-check">
            <p className="section-eyebrow">CEKLIS VERIFIKASI</p>
            <label className="prop-toggle">
              <input type="checkbox" checked={finance} onChange={(event) => setFinance(event.target.checked)} />
              <span><b>Bukti Keuangan</b><small>Pembayaran semester berjalan sesuai.</small></span>
            </label>
            <label className="prop-toggle">
              <input type="checkbox" checked={eligible} onChange={(event) => setEligible(event.target.checked)} />
              <span><b>Layak Diajukan</b><small>Judul dan IPK memenuhi syarat.</small></span>
            </label>
          </div>

          <div className="prop-choices">
            <p className="section-eyebrow">SELEKSI DOSEN PEMBIMBING</p>
            <p className="helper">Pilih satu yang paling sesuai dengan judulnya.</p>
            {selected.choices.map((choice) => (
              <label
                key={choice.lecturerId}
                className={`prop-choice ${targetLecturer === choice.lecturerId ? "on" : ""} ${choice.decision === "Ditolak" ? "rejected" : ""}`}
              >
                <input
                  type="radio"
                  name="pilih-dosen"
                  checked={targetLecturer === choice.lecturerId}
                  disabled={choice.decision === "Ditolak"}
                  onChange={() => {
                    setPickedLecturer(choice.lecturerId);
                    setReplacement(null);
                  }}
                />
                <span className="prop-choice-order">{choice.choiceOrder}</span>
                <span className="prop-choice-main">
                  <b>{choice.lecturerName}</b>
                  <small>{choice.studyProgram}</small>
                </span>
                <span className="prop-choice-count">{choice.guidanceCount} Mhs Bimbingan</span>
                {choice.decision !== "Menunggu" && (
                  <span className={`tp-pill tp-pill-${choice.decision === "Diterima" ? "ok" : "bad"}`}>{choice.decision}</span>
                )}
              </label>
            ))}

            {isSuperAdmin ? (
              <div className="prop-replacement">
                <LecturerPicker
                  label="Tunjuk dosen di luar usulan mahasiswa (Super Admin)"
                  lecturers={lecturers}
                  value={replacement}
                  onChange={(id) => {
                    setReplacement(id);
                    if (id !== null) setPickedLecturer(null);
                  }}
                  excludeIds={selected.choices.filter((c) => c.decision === "Ditolak").map((c) => c.lecturerId)}
                  helper="Aksi di luar alur. Pakai hanya bila ketiga usulan tidak dapat dipakai."
                />
              </div>
            ) : (
              <p className="helper prop-locked">
                🔒 Prodi hanya menyeleksi dari tiga usulan. Penggantian di luar itu lewat <strong>Super Admin</strong>.
              </p>
            )}
          </div>

          <label className="prop-note">
            <span>Catatan Prodi (terlihat mahasiswa)</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Opsional" />
          </label>

          {feedback && <div className="dsh-ok">{feedback}</div>}
          {actionError && <div className="dsh-error">{actionError}</div>}

          <div className="prop-actions">
            <button type="button" className="btn btn-light" disabled={busy !== ""} onClick={() => void send("verify")}>
              {busy === "verify" ? "Menyimpan…" : "Simpan ceklis verifikasi"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy !== "" || !readyToApprove}
              title={readyToApprove ? "" : "Lengkapi kedua ceklis dan pilih satu dosen."}
              onClick={() => targetLecturer !== null && void send("approve", targetLecturer)}
            >
              {busy === "approve" ? "Meneruskan…" : "Setujui & teruskan ke dosen"}
            </button>
            <button type="button" className="btn btn-danger" disabled={busy !== ""} onClick={() => void send("reject")}>
              {busy === "reject" ? "Menyimpan…" : "Tolak pengajuan"}
            </button>
            {isSuperAdmin && (
              <button type="button" className="btn btn-danger btn-mini" disabled={busy !== ""} onClick={() => void remove(selected.code)}>
                🗑 Hapus
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
