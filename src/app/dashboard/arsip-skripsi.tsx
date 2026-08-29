"use client";

import { useCallback, useEffect, useState } from "react";
import { buatZip, namaAman, ukuranTerbaca, type Bita, type IsiZip } from "@/lib/zip";

// ARSIP PENYERAHAN SKRIPSI — BUNGKUS JADI ZIP, LALU KOSONGKAN PENYIMPANAN
//
// Alur satu musim penyerahan:
//   1. Mahasiswa mengunggah empat bagian; berkasnya menumpuk di penyimpanan.
//   2. Admin menekan "Unduh Arsip". Peramban mengambil tiap berkas, lalu
//      membungkusnya menjadi zip berisi map "NIM Nama", plus daftar.csv.
//   3. Setelah arsipnya benar-benar tersimpan di komputer, admin menghapus
//      berkasnya dari penyimpanan portal.
//
// Penyimpanan karena itu tidak pernah menumpuk antar musim.

/** Batas ukuran satu arsip. Lebih dari ini dipecah menjadi beberapa berkas zip. */
const MAKS_ARSIP_BYTE = 400 * 1024 * 1024;

type Bagian = { id: number; part: string; label: string; fileName: string; fileSize: number };
type Baris = {
  requestId: number;
  ticket: string;
  nim: string;
  studentName: string;
  studyProgram: string | null;
  title: string | null;
  createdAt: string;
  totalBytes: number;
  bagian: Bagian[];
};
type Ringkasan = { mahasiswa: number; berkas: number; totalBytes: number };

const URUT_BAGIAN: Record<string, number> = { cover: 1, isi: 2, pustaka: 3, full: 4 };

function unduhBlob(blob: Blob, nama: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  a.click();
  // Ditunda sesaat: sebagian peramban membatalkan unduhan bila alamat objeknya
  // dicabut pada tick yang sama.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Bagi daftar menjadi beberapa kelompok agar tiap arsip tidak melampaui batas. */
function pecahKelompok(daftar: Baris[]) {
  const kelompok: Baris[][] = [];
  let kini: Baris[] = [];
  let ukuran = 0;
  for (const b of daftar) {
    // Satu mahasiswa tidak pernah dipecah antar arsip, supaya map-nya utuh.
    if (kini.length > 0 && ukuran + b.totalBytes > MAKS_ARSIP_BYTE) {
      kelompok.push(kini);
      kini = [];
      ukuran = 0;
    }
    kini.push(b);
    ukuran += b.totalBytes;
  }
  if (kini.length > 0) kelompok.push(kini);
  return kelompok;
}

export default function ArsipSkripsi({ bolehHapus }: { bolehHapus: boolean }) {
  const [daftar, setDaftar] = useState<Baris[]>([]);
  const [ringkas, setRingkas] = useState<Ringkasan | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [kerja, setKerja] = useState("");
  const [maju, setMaju] = useState(0);
  const [sudahDiunduh, setSudahDiunduh] = useState(false);
  const [pastiHapus, setPastiHapus] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const balasan = await fetch("/api/perpus-arsip", { cache: "no-store" });
      const data = (await balasan.json()) as {
        success?: boolean; message?: string; daftar?: Baris[]; ringkasan?: Ringkasan;
      };
      if (!balasan.ok || !data.success) throw new Error(data.message || "Daftar tidak dapat dibaca.");
      setDaftar(data.daftar ?? []);
      setRingkas(data.ringkasan ?? null);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Daftar tidak dapat dibaca.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const jam = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(jam);
  }, [muat]);

  async function unduhArsip() {
    if (daftar.length === 0) return;
    setGalat("");
    setPesan("");
    setMaju(0);
    const kelompok = pecahKelompok(daftar);
    const stempel = new Date().toISOString().slice(0, 10);
    let selesai = 0;
    const totalBerkas = daftar.reduce((n, d) => n + d.bagian.length, 0);

    try {
      for (const [nomor, satu] of kelompok.entries()) {
        const isi: IsiZip[] = [];
        const barisCsv = ["nim,nama,prodi,tiket,judul,bagian,berkas,ukuran_byte"];

        for (const mhs of satu) {
          const map = `${namaAman(mhs.nim, 24)} ${namaAman(mhs.studentName, 60)}`.trim();
          const urut = [...mhs.bagian].sort(
            (a, b) => (URUT_BAGIAN[a.part] ?? 9) - (URUT_BAGIAN[b.part] ?? 9),
          );
          for (const bagian of urut) {
            setKerja(`${mhs.nim} · ${bagian.label}`);
            const balasan = await fetch(`/api/attachments/${bagian.id}`);
            if (!balasan.ok) throw new Error(`Berkas "${bagian.label}" milik ${mhs.nim} tidak dapat diunduh.`);
            const buf = new Uint8Array(await balasan.arrayBuffer()) as Bita;
            const nomorBagian = URUT_BAGIAN[bagian.part] ?? 9;
            isi.push({ nama: `${map}/${nomorBagian}-${namaAman(bagian.label, 50)}.pdf`, data: buf });
            barisCsv.push(
              [mhs.nim, mhs.studentName, mhs.studyProgram ?? "", mhs.ticket, mhs.title ?? "",
                bagian.label, bagian.fileName, String(bagian.fileSize)]
                .map((k) => `"${String(k).replace(/"/g, '""')}"`)
                .join(","),
            );
            selesai += 1;
            setMaju(Math.round((selesai / totalBerkas) * 100));
          }
        }

        isi.push({
          nama: "daftar.csv",
          data: new TextEncoder().encode(`﻿${barisCsv.join("\n")}\n`) as Bita,
        });
        const akhiran = kelompok.length > 1 ? `-bagian-${nomor + 1}-dari-${kelompok.length}` : "";
        unduhBlob(buatZip(isi), `arsip-skripsi-${stempel}${akhiran}.zip`);
      }

      setKerja("");
      setSudahDiunduh(true);
      setPesan(
        kelompok.length > 1
          ? `${kelompok.length} berkas arsip diunduh. Pastikan semuanya tersimpan sebelum menghapus.`
          : "Arsip diunduh. Buka dan pastikan isinya lengkap sebelum menghapus.",
      );
    } catch (alasan: unknown) {
      setKerja("");
      setGalat(alasan instanceof Error ? alasan.message : "Arsip gagal dibuat.");
    }
  }

  async function hapusSemua() {
    setGalat("");
    setPesan("");
    try {
      const balasan = await fetch("/api/perpus-arsip", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestIds: daftar.map((d) => d.requestId) }),
      });
      const data = (await balasan.json()) as { success?: boolean; message?: string; pesan?: string };
      if (!balasan.ok || !data.success) throw new Error(data.message || "Berkas tidak dapat dihapus.");
      setPesan(data.pesan || "Berkas dihapus dari penyimpanan.");
      setPastiHapus(false);
      setSudahDiunduh(false);
      await muat();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Berkas tidak dapat dihapus.");
    }
  }

  return (
    <section>
      <p className="section-eyebrow">PENYIMPANAN PORTAL</p>
      <h2 className="dsh-title">Arsip penyerahan skripsi</h2>

      <div className="panel arsip-skripsi">
        <p className="arsip-jelas">
          Berkas skripsi menumpang di penyimpanan portal hanya sampai diarsipkan. Unduh arsipnya sebagai satu berkas
          zip berisi map <b>NIM Nama</b>, pastikan isinya lengkap, lalu kosongkan penyimpanannya.
        </p>

        {memuat ? (
          <p className="arsip-kosong">Membaca daftar…</p>
        ) : daftar.length === 0 ? (
          <p className="arsip-kosong">
            Belum ada berkas penyerahan di penyimpanan. Penyimpanan portal sedang kosong untuk layanan ini.
          </p>
        ) : (
          <>
            <div className="arsip-angka">
              <div><b>{ringkas?.mahasiswa ?? daftar.length}</b><span>mahasiswa</span></div>
              <div><b>{ringkas?.berkas ?? 0}</b><span>berkas</span></div>
              <div className={ (ringkas?.totalBytes ?? 0) > 700 * 1024 * 1024 ? "bahaya" : "" }>
                <b>{ukuranTerbaca(ringkas?.totalBytes ?? 0)}</b><span>terpakai</span>
              </div>
            </div>

            <ul className="arsip-daftar">
              {daftar.map((m) => (
                <li key={m.requestId}>
                  <div>
                    <b>{m.nim} · {m.studentName}</b>
                    <span>{m.studyProgram || "Prodi tidak tercatat"} · {m.bagian.length} berkas · {ukuranTerbaca(m.totalBytes)}</span>
                  </div>
                  <code>{m.ticket}</code>
                </li>
              ))}
            </ul>

            {kerja && (
              <div className="arsip-maju">
                <div className="arsip-bar"><i style={{ width: `${maju}%` }} /></div>
                <span>{maju}% · {kerja}</span>
              </div>
            )}

            <div className="arsip-aksi">
              <button type="button" className="btn btn-primary" onClick={() => void unduhArsip()} disabled={Boolean(kerja)}>
                {kerja ? "Membungkus arsip…" : "Unduh Arsip (.zip)"}
              </button>

              {bolehHapus && sudahDiunduh && !pastiHapus && (
                <button type="button" className="btn btn-danger" onClick={() => setPastiHapus(true)}>
                  Kosongkan penyimpanan
                </button>
              )}
              {bolehHapus && pastiHapus && (
                <span className="arsip-pasti">
                  <b>Hapus {ringkas?.berkas ?? 0} berkas? Tidak dapat dibatalkan.</b>
                  <button type="button" className="btn btn-danger" onClick={() => void hapusSemua()}>Ya, hapus</button>
                  <button type="button" className="btn" onClick={() => setPastiHapus(false)}>Batal</button>
                </span>
              )}
            </div>

            {!bolehHapus && (
              <p className="arsip-jelas">
                Penghapusan hanya dapat dilakukan Admin dan Super Admin. Anda tetap dapat mengunduh arsipnya.
              </p>
            )}
            {bolehHapus && !sudahDiunduh && (
              <p className="arsip-jelas">
                Tombol hapus baru muncul setelah arsipnya diunduh pada sesi ini.
              </p>
            )}
          </>
        )}

        {pesan && <div className="dsh-ok">{pesan}</div>}
        {galat && <div className="dsh-error">{galat}</div>}
      </div>
    </section>
  );
}
