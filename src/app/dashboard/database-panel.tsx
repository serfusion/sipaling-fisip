"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { DOCUMENT_CATEGORIES } from "@/lib/academic";
import { LecturerPicker, type LecturerOption } from "../lecturer-picker";
import { formatStamp, type DocumentRow } from "./proposal-types";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  admin_umum: "Admin Umum",
  admin_akademik: "Admin Akademik",
  admin_prodi: "Admin Prodi",
  admin_pddikti: "Admin PDDIKTI",
  admin_perpustakaan: "Admin Perpustakaan",
  admin_laboratorium: "Admin Laboratorium",
  dosen: "Dosen",
};

const DRIVE_STEPS = [
  {
    title: "Login Google Drive",
    body: "Pakai akun arsip fakultas, bukan akun pribadi.",
    action: "Buka Google Drive",
    href: "https://drive.google.com/drive/my-drive",
  },
  {
    title: "Unggah berkas",
    body: "Baru → Upload file.",
  },
  {
    title: "Atur izin",
    body: 'Klik kanan → Bagikan → Akses umum: "Siapa saja yang memiliki link", peran "Pelihat". Tanpa ini admin lain tidak bisa membuka.',
  },
  {
    title: "Salin link",
    body: 'Tombol "Salin link", lalu tempel di formulir bawah.',
  },
  {
    title: "Lengkapi & simpan",
    body: "Pilih jenis, tulis judul, tandai dosen yang terlibat.",
  },
];

// Panel "Tambahkan Data di Database": seluruh admin dapat menambah dan
// melihat, tetapi hanya Super Admin yang boleh menghapus.
export default function DatabasePanel({
  lecturers,
  role,
  canDelete,
}: {
  lecturers: LecturerOption[];
  role: string;
  canDelete: boolean;
}) {
  const readOnly = role === "dosen";
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({ category: "", title: "", description: "", driveUrl: "", documentDate: "" });
  const [contributors, setContributors] = useState<number[]>([]);
  const [picker, setPicker] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      const payload = (await response.json()) as { success?: boolean; message?: string; documents?: DocumentRow[] };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Database dokumen belum dapat dimuat.");
      setRows(payload.documents || []);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Database dokumen belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Ditunda satu tick agar setState tidak berjalan sinkron di dalam effect.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("id-ID");
    return rows.filter((row) => {
      if (categoryFilter && row.category !== categoryFilter) return false;
      if (!term) return true;
      const haystack = `${row.title} ${row.category} ${row.addedByName} ${row.contributors.map((c) => c.lecturerName).join(" ")}`;
      return haystack.toLocaleLowerCase("id-ID").includes(term);
    });
  }, [rows, categoryFilter, search]);

  const contributorNames = useMemo(
    () =>
      contributors
        .map((id) => lecturers.find((lecturer) => lecturer.id === id))
        .filter((lecturer): lecturer is LecturerOption => Boolean(lecturer)),
    [contributors, lecturers],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setFormError("");
    setSaving(true);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, lecturerIds: contributors }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string; document?: DocumentRow };
      if (!response.ok || !payload.success || !payload.document) throw new Error(payload.message || "Dokumen belum tersimpan.");
      setRows((current) => [payload.document as DocumentRow, ...current]);
      setForm({ category: "", title: "", description: "", driveUrl: "", documentDate: "" });
      setContributors([]);
      setMessage(
        contributors.length
          ? `Tersimpan. ${contributors.length} dosen menerima notifikasi.`
          : "Tersimpan.",
      );
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : "Dokumen belum tersimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: DocumentRow) {
    if (!window.confirm(`Hapus permanen "${row.title}" dari database? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const response = await fetch(`/api/documents/${row.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Dokumen belum dapat dihapus.");
      setRows((current) => current.filter((item) => item.id !== row.id));
    } catch (reason: unknown) {
      window.alert(reason instanceof Error ? reason.message : "Dokumen belum dapat dihapus.");
    }
  }

  return (
    <section>
      <p className="section-eyebrow">DATABASE TERPUSAT</p>
      <h2 className="dsh-title">{readOnly ? "Dokumen yang mencantumkan nama Anda" : "Database dokumen fakultas"}</h2>

      {!readOnly && (
        <>
          <button type="button" className="db-guide-toggle" onClick={() => setGuideOpen((open) => !open)} aria-expanded={guideOpen}>
            <span className="db-guide-icon">?</span>
            <span>
              <b>Tambahkan Data di Database</b>
              <small>Lihat langkah-langkahnya</small>
            </span>
            <span className="db-guide-chevron">{guideOpen ? "▲" : "▼"}</span>
          </button>

          {guideOpen && (
            <ol className="db-steps">
              {DRIVE_STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="db-step-no">{index + 1}</span>
                  <div>
                    <b>{step.title}</b>
                    <p>{step.body}</p>
                    {step.href && (
                      <a className="btn btn-light btn-mini" href={step.href} target="_blank" rel="noreferrer">
                        {step.action} ↗
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}

          <form className="panel db-form" onSubmit={submit}>
            <div className="db-grid">
              <label>
                <span>Jenis Dokumen <em>*</em></span>
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required>
                  <option value="" disabled>-- Pilih jenis dokumen --</option>
                  {DOCUMENT_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>Tanggal Dokumen</span>
                <input type="date" value={form.documentDate} onChange={(event) => setForm({ ...form, documentDate: event.target.value })} />
              </label>
              <label className="db-wide">
                <span>Judul Dokumen <em>*</em></span>
                <input
                  required
                  maxLength={400}
                  placeholder="Judul dokumen"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </label>
              <label className="db-wide">
                <span>Tautan Google Drive <em>*</em></span>
                <input
                  required
                  type="url"
                  placeholder="https://drive.google.com/file/d/…/view?usp=sharing"
                  value={form.driveUrl}
                  onChange={(event) => setForm({ ...form, driveUrl: event.target.value })}
                />
              </label>
              <label className="db-wide">
                <span>Keterangan</span>
                <textarea
                  rows={2}
                  maxLength={2000}
                  placeholder="Opsional"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </label>
            </div>

            <div className="db-contrib">
              <LecturerPicker
                label="Dosen yang terlibat (kontributor)"
                lecturers={lecturers}
                value={picker}
                onChange={(id) => {
                  if (id !== null && !contributors.includes(id)) setContributors((current) => [...current, id]);
                  setPicker(null);
                }}
                excludeIds={contributors}
                helper="Yang ditambahkan langsung menerima notifikasi kontributor."
              />
              {contributorNames.length > 0 && (
                <div className="db-chips">
                  {contributorNames.map((lecturer) => (
                    <span className="db-chip" key={lecturer.id}>
                      {lecturer.name}
                      <button
                        type="button"
                        aria-label={`Hapus ${lecturer.name}`}
                        onClick={() => setContributors((current) => current.filter((id) => id !== lecturer.id))}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan ke database"}
            </button>
            {message && <div className="dsh-ok">{message}</div>}
            {formError && <div className="dsh-error">{formError}</div>}
          </form>
        </>
      )}

      <div className="db-filters">
        <input
          className="db-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari judul, jenis, admin, atau dosen…"
        />
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter jenis dokumen">
          <option value="">Semua jenis</option>
          {DOCUMENT_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button type="button" className="btn btn-light btn-mini" onClick={() => void load()}>↻ Muat ulang</button>
      </div>

      {error && <div className="dsh-error">{error}</div>}

      <div className="panel qtable-wrap">
        <table className="qt">
          <thead>
            <tr>
              <th>Jenis & Judul</th>
              <th>Dosen terlibat</th>
              <th>Ditambahkan oleh</th>
              <th>Waktu</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}><div className="dempty">Memuat database dokumen…</div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5}><div className="dempty"><b>Belum ada data</b><br />{readOnly ? "Anda belum dicantumkan pada dokumen mana pun." : "Tambahkan lewat formulir di atas."}</div></td></tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="db-cat">{row.category}</span>
                    <b>{row.title}</b>
                    {row.description && <small>{row.description}</small>}
                  </td>
                  <td>{row.contributors.length ? row.contributors.map((c) => c.lecturerName).join(", ") : "-"}</td>
                  <td><b>{row.addedByName}</b><small>{ROLE_LABEL[row.addedByRole] || row.addedByRole}</small></td>
                  <td>{formatStamp(row.createdAt)}{row.documentDate && <small>Dokumen: {row.documentDate}</small>}</td>
                  <td className="db-row-actions">
                    <a className="dlink" href={row.driveUrl} target="_blank" rel="noreferrer">Unduh ↗</a>
                    {canDelete && (
                      <button type="button" className="btn btn-danger btn-mini" onClick={() => void remove(row)}>🗑</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="helper db-footnote">Data di sini <strong>tidak dapat dihapus</strong> kecuali oleh Super Admin.</p>
    </section>
  );
}
