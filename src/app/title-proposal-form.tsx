"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  concentrationsFor,
  DEFAULT_STATEMENT,
  FINAL_TASK_TYPES,
  MAX_LECTURER_CHOICES,
  NO_CONCENTRATION,
  STUDY_PROGRAMS,
  type FinalTaskType,
} from "@/lib/academic";
import { LecturerPicker, type LecturerOption } from "./lecturer-picker";
import PilihBerkas, { keteranganBerkas } from "./pilih-berkas";

type Props = {
  lecturers: LecturerOption[];
  lecturerError: string;
  finalTaskType: FinalTaskType;
  onFinalTaskTypeChange: (value: FinalTaskType) => void;
  onSubmitted: (code: string) => void;
};

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const PROOF_PATTERN = /\.(pdf|jpe?g|png)$/i;

function todayLabel() {
  return new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function TitleProposalForm({
  lecturers,
  lecturerError,
  finalTaskType,
  onFinalTaskTypeChange,
  onSubmitted,
}: Props) {
  const [studentName, setStudentName] = useState("");
  const [nim, setNim] = useState("");
  const [address, setAddress] = useState("");
  const [studyProgram, setStudyProgram] = useState<string>(STUDY_PROGRAMS[0]);
  const [concentration, setConcentration] = useState("");
  const [gpa, setGpa] = useState("");
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState(DEFAULT_STATEMENT);
  const [contact, setContact] = useState("");
  const [choices, setChoices] = useState<Array<number | null>>(() => Array(MAX_LECTURER_CHOICES).fill(null));
  const [proofName, setProofName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const concentrationOptions = useMemo(() => concentrationsFor(studyProgram), [studyProgram]);
  // Ilmu Pemerintahan tidak punya konsentrasi — kolomnya disembunyikan dan
  // nilainya diisi otomatis agar tidak memaksa mahasiswa mengarang isian.
  const needsConcentration = concentrationOptions.length > 0;

  const chosenIds = choices.filter((id): id is number => id !== null);
  const signatureName = studentName.trim() || "…………………………";
  const finalConcentration = needsConcentration ? concentration : NO_CONCENTRATION;

  function setChoice(index: number, id: number | null) {
    setChoices((current) => current.map((item, position) => (position === index ? id : item)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!/^\d{4,20}$/.test(nim.trim())) {
      setError("NIM harus berupa angka 4 sampai 20 digit.");
      return;
    }
    if (studentName.trim().length < 3) {
      setError("Nama lengkap pemohon wajib diisi.");
      return;
    }
    if (address.trim().length < 8) {
      setError("Alamat wajib diisi minimal 8 karakter.");
      return;
    }
    if (needsConcentration && !concentrationOptions.includes(concentration)) {
      setError("Konsentrasi wajib dipilih sesuai daftar program studi Anda.");
      return;
    }
    const gpaNumber = Number(gpa.replace(",", "."));
    if (!Number.isFinite(gpaNumber) || gpaNumber <= 0 || gpaNumber > 4) {
      setError("IPK terakhir harus berupa angka antara 0,01 sampai 4,00.");
      return;
    }
    if (title.trim().length < 10) {
      setError("Judul yang diajukan wajib diisi minimal 10 karakter.");
      return;
    }
    if (statement.trim().length < 20) {
      setError("Pernyataan wajib diisi minimal 20 karakter.");
      return;
    }
    if (chosenIds.length !== MAX_LECTURER_CHOICES) {
      setError(`Pilih ${MAX_LECTURER_CHOICES} dosen usulan terlebih dahulu.`);
      return;
    }
    if (new Set(chosenIds).size !== MAX_LECTURER_CHOICES) {
      setError("Ketiga dosen yang dipilih harus berbeda.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const proof = formData.get("paymentFile");
    const file = proof instanceof File && proof.name ? proof : null;
    if (!file) {
      setError("Bukti keuangan wajib dilampirkan.");
      return;
    }
    if (!PROOF_PATTERN.test(file.name) || file.size > MAX_PROOF_BYTES) {
      setError("Bukti keuangan harus berformat PDF, JPG, atau PNG dan maksimal 10 MB.");
      return;
    }

    formData.set("nim", nim.trim());
    formData.set("studentName", studentName.trim());
    formData.set("address", address.trim());
    formData.set("studyProgram", studyProgram);
    formData.set("concentration", finalConcentration);
    formData.set("gpa", gpaNumber.toFixed(2));
    formData.set("finalTaskType", finalTaskType);
    formData.set("title", title.trim());
    formData.set("statement", statement.trim());
    formData.set("contact", contact.trim());
    chosenIds.forEach((id, index) => formData.set(`lecturer${index + 1}`, String(id)));

    setSending(true);
    try {
      const response = await fetch("/api/title-proposals", { method: "POST", body: formData });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; message?: string; code?: string }
        | null;
      if (!response.ok || !payload?.success || !payload.code) {
        throw new Error(payload?.message || "Pengajuan judul belum tersimpan. Silakan coba lagi.");
      }
      onSubmitted(payload.code);
      form.reset();
      setProofName("");
      setChoices(Array(MAX_LECTURER_CHOICES).fill(null));
      setTitle("");
      setStatement(DEFAULT_STATEMENT);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Pengajuan judul belum tersimpan.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="tp-sheet" onSubmit={handleSubmit}>
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <header className="tp-head">
        <p className="tp-kicker">FORMULIR RESMI PROGRAM STUDI</p>
        <h3>Permohonan Pengajuan Judul Tugas Akhir</h3>
        <div className="tp-typeswitch" role="group" aria-label="Jenis tugas akhir">
          {FINAL_TASK_TYPES.map((type) => (
            <button
              type="button"
              key={type}
              className={finalTaskType === type ? "on" : ""}
              onClick={() => onFinalTaskTypeChange(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </header>

      <p className="tp-intro">Yang bertanda tangan di bawah ini:</p>

      <div className="tp-grid">
        <label className="tp-field">
          <span>Nama Lengkap <em>*</em></span>
          <input
            value={studentName}
            onChange={(event) => setStudentName(event.target.value)}
            placeholder="Nama sesuai KTM"
            maxLength={160}
            required
          />
        </label>
        <label className="tp-field">
          <span>NIM <em>*</em></span>
          <input
            value={nim}
            onChange={(event) => setNim(event.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Contoh: 2670201001"
            maxLength={20}
            required
          />
        </label>
        <label className="tp-field tp-field-wide">
          <span>Alamat <em>*</em></span>
          <textarea
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Alamat tempat tinggal saat ini"
            maxLength={500}
            rows={2}
            required
          />
        </label>
        <label className="tp-field">
          <span>Program Studi <em>*</em></span>
          <select
            value={studyProgram}
            onChange={(event) => {
              // Konsentrasi lama belum tentu tersedia pada prodi baru.
              setStudyProgram(event.target.value);
              setConcentration("");
            }}
            required
          >
            {STUDY_PROGRAMS.map((program) => (
              <option key={program} value={program}>{program}</option>
            ))}
          </select>
        </label>
        {needsConcentration ? (
          <label className="tp-field">
            <span>Konsentrasi <em>*</em></span>
            <select value={concentration} onChange={(event) => setConcentration(event.target.value)} required>
              <option value="" disabled>-- Pilih konsentrasi --</option>
              {concentrationOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="tp-field">
            <span>Konsentrasi</span>
            <div className="tp-static">{studyProgram} tidak memiliki konsentrasi</div>
          </div>
        )}
        <label className="tp-field">
          <span>IPK Terakhir <em>*</em></span>
          <input
            value={gpa}
            onChange={(event) => setGpa(event.target.value.replace(/[^\d.,]/g, "").slice(0, 4))}
            inputMode="decimal"
            placeholder="Contoh: 3,58"
            required
          />
        </label>
        <label className="tp-field">
          <span>Email / WhatsApp</span>
          <input
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder="0812xxxx / email mahasiswa"
            maxLength={160}
          />
        </label>
      </div>

      <label className="tp-field tp-field-block">
        <span>Judul {finalTaskType} yang Diajukan <em>*</em></span>
        <textarea
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={`Tuliskan judul ${finalTaskType.toLowerCase()} selengkap-lengkapnya`}
          maxLength={500}
          rows={3}
          required
        />
      </label>

      <div className="tp-statement">
        <span className="tp-statement-title">Pernyataan Pemohon</span>
        <textarea
          value={statement}
          onChange={(event) => setStatement(event.target.value)}
          maxLength={2000}
          rows={5}
          required
        />
        <p className="helper">Sudah terisi. Boleh disesuaikan.</p>
      </div>

      <div className="tp-upload">
        <span className="tp-statement-title">Bukti Keuangan <em>*</em></span>
        <p className="helper">Bukti pembayaran semester berjalan. PDF/JPG/PNG, maks. 10 MB.</p>
        <PilihBerkas
          id="paymentFile"
          name="paymentFile"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          required
          terpilih={proofName}
          onPilih={(berkas) => setProofName(keteranganBerkas(berkas))}
        />
      </div>

      <div className="tp-lecturers">
        <div className="tp-lecturers-head">
          <span className="tp-statement-title">Usulan Dosen Pembimbing</span>
          <p className="helper">Urut sesuai prioritas. Angka di samping nama = jumlah bimbingan berjalan.</p>
        </div>
        {lecturerError && <p className="helper helper-error">{lecturerError}</p>}
        <div className="tp-lecturer-grid">
          {choices.map((choice, index) => (
            <LecturerPicker
              key={index}
              label={`Pilihan ${index + 1}`}
              lecturers={lecturers}
              value={choice}
              onChange={(id) => setChoice(index, id)}
              excludeIds={chosenIds}
              required
              placeholder="Ketik nama dosen…"
            />
          ))}
        </div>
      </div>

      <div className="tp-sign">
        <div className="tp-sign-inner">
          <span>Jakarta, {todayLabel()}</span>
          <span>Hormat Saya,</span>
          <span className="tp-sign-space" />
          <b className="tp-sign-name">{signatureName}</b>
          <small>NIM. {nim.trim() || "…………………"}</small>
        </div>
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      <div className="tp-actions">
        <button type="submit" className="button button-primary" disabled={sending}>
          {sending ? "Mengirim…" : "Kirim ke Program Studi"} <span>→</span>
        </button>
        <p className="helper">Anda akan menerima kode pelacakan untuk memantau prosesnya.</p>
      </div>
    </form>
  );
}
