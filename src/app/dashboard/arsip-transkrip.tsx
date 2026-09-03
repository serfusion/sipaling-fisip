"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

// ARSIP TRANSKRIP NILAI — daftar mahasiswa yang transkripnya sudah dibuat
//
// Panel ini hanya membaca dan menghapus. Yang mengisinya adalah tombol
// "Save di Arsip Transkrip" di halaman Template → Transkrip: satu transkrip
// masuk ke sini hanya ketika admin menekannya sendiri.
//
// Tiap baris dapat dibuka kembali ke editor transkrip lewat tautan "Buka",
// sehingga cetak ulang atau perbaikan nilai tidak perlu mengunggah Excel
// dari SIMAK lagi.

type BarisArsip = {
  id: number;
  nim: string;
  studentName: string;
  studyProgram: string | null;
  concentration: string | null;
  lang: string;
  courseCount: number;
  totalSks: number;
  totalMutu: number;
  ipk: string;
  predikat: string | null;
  yudisium: string | null;
  thesisTitle: string | null;
  savedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function tanggal(waktu: string | null) {
  if (!waktu) return "—";
  const isi = new Date(waktu);
  return Number.isNaN(isi.getTime())
    ? "—"
    : isi.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function ArsipTranskrip({ bolehHapus }: { bolehHapus: boolean }) {
  const [daftar, setDaftar] = useState<BarisArsip[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [cari, setCari] = useState("");
  const [pastiHapus, setPastiHapus] = useState<number | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawab = await fetch("/api/arsip-transkrip", { cache: "no-store" });
      const isi = (await jawab.json()) as { success?: boolean; message?: string; daftar?: BarisArsip[] };
      if (!jawab.ok || !isi.success) throw new Error(isi.message || "Arsip belum dapat dimuat.");
      setDaftar(isi.daftar ?? []);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Arsip belum dapat dimuat.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const jam = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(jam);
  }, [muat]);

  const tersaring = useMemo(() => {
    const kunci = cari.trim().toLowerCase();
    if (!kunci) return daftar;
    return daftar.filter((baris) =>
      `${baris.studentName} ${baris.nim} ${baris.studyProgram || ""} ${baris.thesisTitle || ""}`
        .toLowerCase()
        .includes(kunci),
    );
  }, [daftar, cari]);

  const angka = useMemo(() => {
    const sks = daftar.reduce((jumlah, baris) => jumlah + baris.totalSks, 0);
    const pujian = daftar.filter((baris) => baris.predikat === "Dengan Pujian").length;
    return { mahasiswa: daftar.length, sks, pujian };
  }, [daftar]);

  async function hapus(id: number) {
    setSibuk(true);
    setGalat("");
    setPesan("");
    try {
      const jawab = await fetch(`/api/arsip-transkrip?id=${id}`, { method: "DELETE" });
      const isi = (await jawab.json()) as {
        success?: boolean; message?: string; terhapus?: { nim: string; studentName: string };
      };
      if (!jawab.ok || !isi.success) throw new Error(isi.message || "Arsip belum dapat dihapus.");
      setDaftar((kini) => kini.filter((baris) => baris.id !== id));
      setPastiHapus(null);
      setPesan(
        isi.terhapus
          ? `Transkrip ${isi.terhapus.studentName} (${isi.terhapus.nim}) dihapus dari arsip.`
          : "Satu transkrip dihapus dari arsip.",
      );
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Arsip belum dapat dihapus.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <section>
      <p className="section-eyebrow">ADMIN AKADEMIK</p>
      <h2 className="dsh-title">Arsip Transkrip Nilai</h2>

      <div className="panel arsip-tk">
        <p className="arsip-jelas">
          Daftar mahasiswa yang transkripnya sudah selesai dibuat dan <b>disimpan</b> lewat tombol{" "}
          <b>&ldquo;Save di Arsip Transkrip&rdquo;</b> di halaman Template → Transkrip. Transkrip yang belum disimpan
          tidak tercatat di sini. Klik <b>Buka</b> untuk memuat kembali biodata dan seluruh nilainya — siap dicetak
          ulang atau diperbaiki tanpa mengunggah Excel lagi.
        </p>

        <div className="arsip-tk-atas">
          <div className="arsip-angka">
            <div><b>{angka.mahasiswa}</b><span>transkrip tersimpan</span></div>
            <div><b>{angka.sks}</b><span>total SKS terarsip</span></div>
            <div><b>{angka.pujian}</b><span>predikat pujian</span></div>
          </div>
          <div className="arsip-tk-alat">
            <input
              value={cari}
              onChange={(peristiwa) => setCari(peristiwa.target.value)}
              placeholder="Cari nama, NIM, prodi, judul skripsi…"
            />
            <button type="button" className="btn btn-light btn-mini" onClick={() => void muat()} disabled={memuat}>
              ⟳ Segarkan
            </button>
            <Link className="btn btn-primary btn-mini" href="/dashboard/template?jenis=transkrip">
              + Buat transkrip baru
            </Link>
          </div>
        </div>

        {pesan && <div className="dsh-ok">{pesan}</div>}
        {galat && <div className="dsh-error">{galat}</div>}
      </div>

      <div className="panel qtable-wrap">
        <table className="qt">
          <thead>
            <tr>
              <th>Mahasiswa</th>
              <th>Prodi</th>
              <th>Hasil</th>
              <th>Disimpan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {memuat ? (
              <tr><td colSpan={5}><div className="dempty">Membaca arsip…</div></td></tr>
            ) : tersaring.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="dempty">
                    {daftar.length === 0
                      ? "Belum ada transkrip yang diarsipkan. Buat transkrip di Template → Transkrip, lalu tekan tombol “Save di Arsip Transkrip” di bagian paling bawah."
                      : "Tidak ada yang cocok dengan pencarian itu."}
                  </div>
                </td>
              </tr>
            ) : (
              tersaring.map((baris) => (
                <tr key={baris.id}>
                  <td>
                    <b>{baris.studentName}</b>
                    <small>{baris.nim}{baris.yudisium ? ` · yudisium ${baris.yudisium}` : ""}</small>
                  </td>
                  <td>
                    {baris.studyProgram || "—"}
                    <small>{baris.concentration || ""}</small>
                  </td>
                  <td>
                    <b>IPK {baris.ipk}</b>
                    <small>{baris.courseCount} MK · {baris.totalSks} SKS · {baris.predikat || "—"}</small>
                  </td>
                  <td>
                    {tanggal(baris.updatedAt)}
                    <small>{baris.savedBy ? `oleh ${baris.savedBy}` : ""}</small>
                  </td>
                  <td className="arsip-tk-aksi">
                    <Link
                      className="dlink"
                      href={`/dashboard/template?jenis=${baris.lang === "en" ? "transkrip-en" : "transkrip"}&arsip=${baris.id}`}
                    >
                      Buka →
                    </Link>
                    {bolehHapus && (pastiHapus === baris.id ? (
                      <span className="arsip-pasti">
                        <b>Hapus?</b>
                        <button type="button" className="btn btn-danger btn-mini" disabled={sibuk} onClick={() => void hapus(baris.id)}>Ya</button>
                        <button type="button" className="btn btn-light btn-mini" onClick={() => setPastiHapus(null)}>Batal</button>
                      </span>
                    ) : (
                      <button type="button" className="linklike arsip-tk-hapus" onClick={() => setPastiHapus(baris.id)}>Hapus</button>
                    ))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
