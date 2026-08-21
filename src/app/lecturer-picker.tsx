"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { compareLecturerName, GUIDANCE_SOFT_LIMIT } from "@/lib/academic";

export type LecturerOption = {
  id: number;
  name: string;
  studyProgram: string;
  guidanceCount?: number;
};

export function guidanceLabel(count: number | undefined) {
  return `${count ?? 0} Mhs Bimbingan`;
}

type Props = {
  lecturers: LecturerOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  label: string;
  /** Dosen yang sudah dipilih pada kolom lain sehingga tidak boleh dobel. */
  excludeIds?: number[];
  name?: string;
  required?: boolean;
  helper?: string;
  placeholder?: string;
};

// Pencarian dosen langsung saat mengetik — tanpa tombol dan tanpa Enter.
// Urutan abjad memakai nama asli, gelar depan (Dr., Prof., Drs.) diabaikan.
export function LecturerPicker({
  lecturers,
  value,
  onChange,
  label,
  excludeIds = [],
  name,
  required,
  helper,
  placeholder = "Ketik nama dosen…",
}: Props) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => lecturers.find((lecturer) => lecturer.id === value) || null,
    [lecturers, value],
  );

  const options = useMemo(() => {
    const available = lecturers
      .filter((lecturer) => !excludeIds.includes(lecturer.id) || lecturer.id === value)
      .sort((a, b) => compareLecturerName(a.name, b.name));
    const term = query.trim().toLocaleLowerCase("id-ID");
    if (!term) return available;
    return available.filter((lecturer) =>
      `${lecturer.name} ${lecturer.studyProgram}`.toLocaleLowerCase("id-ID").includes(term),
    );
  }, [lecturers, excludeIds, value, query]);

  // Klik di luar kotak menutup daftar saran.
  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function pick(option: LecturerOption) {
    onChange(option.id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="lp" ref={boxRef}>
      <span className="lp-label">{label} {required && <em>*</em>}</span>
      {selected ? (
        <div className="lp-chosen">
          <span className="lp-chosen-main">
            <b>{selected.name}</b>
            <small>{selected.studyProgram}</small>
          </span>
          <span className={`lp-count ${(selected.guidanceCount ?? 0) >= GUIDANCE_SOFT_LIMIT ? "lp-count-full" : ""}`}>
            {guidanceLabel(selected.guidanceCount)}
          </span>
          <button type="button" className="lp-clear" onClick={() => onChange(null)} aria-label={`Hapus pilihan ${label}`}>
            ✕
          </button>
        </div>
      ) : (
        <div className="lp-field">
          <input
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            placeholder={placeholder}
            onFocus={() => {
              setOpen(true);
              setHighlight(0);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setHighlight(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                // Enter tidak boleh mengirim formulir; hanya memilih saran.
                event.preventDefault();
                if (open && options[highlight]) pick(options[highlight]);
                return;
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
                setHighlight((index) => Math.min(index + 1, options.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlight((index) => Math.max(index - 1, 0));
              }
              if (event.key === "Escape") setOpen(false);
            }}
          />
          {open && (
            <ul className="lp-list" id={listId} role="listbox">
              {options.length === 0 ? (
                <li className="lp-empty">Nama dosen tidak ditemukan.</li>
              ) : (
                options.slice(0, 40).map((option, index) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === highlight}
                      className={index === highlight ? "on" : ""}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => pick(option)}
                    >
                      <span className="lp-opt-main">
                        <b>{option.name}</b>
                        <small>{option.studyProgram}</small>
                      </span>
                      <span className={`lp-count ${(option.guidanceCount ?? 0) >= GUIDANCE_SOFT_LIMIT ? "lp-count-full" : ""}`}>
                        {guidanceLabel(option.guidanceCount)}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      {helper && <p className="helper">{helper}</p>}
    </div>
  );
}
