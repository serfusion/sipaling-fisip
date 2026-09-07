"use client";

// ============================================================
// TEMPLATE "Input Kelulusan & Dropout" — Admin PDDIKTI
//
// Satu layar, tiga langkah: unggah Excel yudisium fakultas → lengkapi yang
// tidak ada di berkas itu (nomor & tanggal SK) → unduh berkas berformat
// PDDIKTI. Seluruhnya berjalan di peramban admin; tidak ada data mahasiswa
// yang dikirim ke server.
//
// Yang dikerjakan modul ini, dan alasannya:
//
//   TGL YUDISIUM → Tanggal keluar. Tanggal yudisium BERBEDA-BEDA di dalam
//   satu berkas (7 Juni, 18 Juni, 24 Juli…). Menyalinnya tangan berarti
//   ratusan peluang salah ketik, dan satu tanggal yang telanjur diseret ke
//   bawah membuat seluruh angkatan tercatat lulus di hari yang salah.
//
//   Semester Keluar dihitung dari tanggal itu, bukan diketik ulang.
//
//   IPK → IP Kumulatif dua angka di belakang koma, NIM dan Kode Prodi
//   dipertahankan sebagai teks supaya tidak berubah menjadi 2.27E+09.
// ============================================================

import { useMemo, useState, type ChangeEvent } from "react";
import {
  JENIS_KELUAR, KOLOM_KELULUSAN, NAMA_LEMBAR_PDDIKTI, PRODI_PDDIKTI,
  bacaLembarYudisium, barisKeAoa, nomorSkDariLembar, periksaBaris,
  semesterKeluar, semesterTahunKalender,
  type BarisKelulusan,
} from "./kelulusan-parse";
import type { Aoa } from "./transkrip-parse";
import { buatXlsxKelulusan } from "@/lib/kelulusan-xlsx";

const PER_HALAMAN = 50;

function unduh(blob: Blob, nama: string) {
  const url = URL.createObjectURL(blob);
  const tautan = document.createElement("a");
  tautan.href = url;
  tautan.download = nama;
  tautan.click();
  URL.revokeObjectURL(url);
}

type Pesan = { kind: "ok" | "err"; text: string } | null;

export default function KelulusanModule() {
  const [baris, setBaris] = useState<BarisKelulusan[]>([]);
  const [namaBerkas, setNamaBerkas] = useState("");
  const [pesan, setPesan] = useState<Pesan>(null);

  // --- isian seragam: satu nilai untuk seluruh baris -----------------------
  const [jenisSemua, setJenisSemua] = useState("1");
  const [semesterPaksa, setSemesterPaksa] = useState("");
  const [nomorSk, setNomorSk] = useState("");
  const [tanggalSk, setTanggalSk] = useState("");
  const [prodiCadangan, setProdiCadangan] = useState("");

  // --- tampilan tabel ------------------------------------------------------
  const [cari, setCari] = useState("");
  const [saringProdi, setSaringProdi] = useState("");
  const [hanyaBermasalah, setHanyaBermasalah] = useState(false);
  const [halaman, setHalaman] = useState(0);
  const [bukaAcuan, setBukaAcuan] = useState(false);

  const masalah = useMemo(() => periksaBaris(baris), [baris]);
  const idBermasalah = useMemo(() => new Set(masalah.map((m) => m.id)), [masalah]);
  const barisSiap = useMemo(() => baris.filter((b) => !idBermasalah.has(b.id)), [baris, idBermasalah]);

  const prodiAda = useMemo(() => {
    const kode = new Set(baris.map((b) => b.kodeProdi).filter(Boolean));
    return [...kode].sort();
  }, [baris]);

  const terlihat = useMemo(() => {
    const kunci = cari.trim().toLowerCase();
    return baris.filter((b) => {
      if (hanyaBermasalah && !idBermasalah.has(b.id)) return false;
      if (saringProdi && b.kodeProdi !== saringProdi) return false;
      if (!kunci) return true;
      return b.nim.toLowerCase().includes(kunci) || b.nama.toLowerCase().includes(kunci);
    });
  }, [baris, cari, hanyaBermasalah, idBermasalah, saringProdi]);

  const halamanMaks = Math.max(0, Math.ceil(terlihat.length / PER_HALAMAN) - 1);
  const halamanKini = Math.min(halaman, halamanMaks);
  const potongan = terlihat.slice(halamanKini * PER_HALAMAN, halamanKini * PER_HALAMAN + PER_HALAMAN);

  /* ---------- membaca berkas fakultas ---------- */

  async function bacaBerkas(event: ChangeEvent<HTMLInputElement>) {
    const berkas = event.target.files?.[0];
    event.target.value = "";
    if (!berkas) return;
    setPesan(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(new Uint8Array(await berkas.arrayBuffer()), { type: "array" });

      const kumpulan: BarisKelulusan[] = [];
      const catatanLembar: string[] = [];
      const gagalLembar: string[] = [];
      let skTerbaca = "";

      for (const nama of wb.SheetNames) {
        const aoa = XLSX.utils.sheet_to_json(
          wb.Sheets[nama] as Parameters<typeof XLSX.utils.sheet_to_json>[0],
          { header: 1, defval: "", raw: false },
        ) as Aoa;
        try {
          const hasil = bacaLembarYudisium(aoa, nama, { jenisKeluar: jenisSemua, kodeProdiCadangan: prodiCadangan });
          if (!hasil.baris.length) {
            gagalLembar.push(`"${nama}" tidak berisi baris mahasiswa`);
            continue;
          }
          kumpulan.push(...hasil.baris);
          catatanLembar.push(`"${nama}" ${hasil.baris.length} mahasiswa`);
          if (!skTerbaca) skTerbaca = nomorSkDariLembar(aoa);
        } catch (sebab: unknown) {
          gagalLembar.push(sebab instanceof Error ? sebab.message : `"${nama}" tidak terbaca`);
        }
      }

      if (!kumpulan.length) {
        throw new Error(
          "Tidak ada lembar yang berisi data yudisium. " +
          (gagalLembar.length ? gagalLembar.join(" · ") : "Pastikan berkasnya berisi kolom NIM, NAMA MAHASISWA, TGL YUDISIUM, dan IPK."),
        );
      }

      // Nomor SK dari kop lembar dipakai HANYA bila admin belum mengetik
      // sendiri — yang ia ketik tidak boleh tertimpa berkas yang ia unggah.
      const sk = nomorSk || skTerbaca;
      if (sk !== nomorSk) setNomorSk(sk);
      setBaris(kumpulan.map((b) => ({ ...b, nomorSk: sk, tanggalSk, semester: semesterPaksa || b.semester })));
      setNamaBerkas(berkas.name);
      setHalaman(0);

      const rusak = periksaBaris(kumpulan).length;
      setPesan({
        kind: "ok",
        text:
          `${kumpulan.length} mahasiswa terbaca dari ${catatanLembar.length} lembar (${catatanLembar.join(", ")}). ` +
          (skTerbaca ? `Nomor SK "${skTerbaca}" terangkat dari kop lembar. ` : "") +
          (rusak ? `${rusak} baris masih perlu diperbaiki. Lihat tabel di bawah. ` : "Semua baris lengkap. ") +
          (gagalLembar.length ? `Dilewati: ${gagalLembar.join(" · ")}. ` : "") +
          "Berkasnya dibaca di peramban Anda, tidak diunggah ke mana pun.",
      });
    } catch (sebab: unknown) {
      setPesan({ kind: "err", text: sebab instanceof Error ? sebab.message : "Berkas tidak dapat dibaca." });
    }
  }

  /* ---------- isian seragam ---------- */

  function ubahJenisSemua(kode: string) {
    setJenisSemua(kode);
    setBaris((rows) => rows.map((r) => ({ ...r, jenisKeluar: kode })));
  }

  function ubahSemesterPaksa(nilai: string) {
    const bersih = nilai.replace(/\D/g, "").slice(0, 5);
    setSemesterPaksa(bersih);
    setBaris((rows) =>
      rows.map((r) => ({ ...r, semester: bersih || (r.tanggalKeluar ? semesterKeluar(r.tanggalKeluar) : "") })),
    );
  }

  function ubahNomorSk(nilai: string) {
    setNomorSk(nilai);
    setBaris((rows) => rows.map((r) => ({ ...r, nomorSk: nilai })));
  }

  function ubahTanggalSk(nilai: string) {
    setTanggalSk(nilai);
    setBaris((rows) => rows.map((r) => ({ ...r, tanggalSk: nilai })));
  }

  // Cadangan hanya menyentuh baris yang kode prodinya TIDAK berasal dari
  // berkas fakultas. Kode prodi yang memang tertulis di berkasnya — atau yang
  // sudah dikoreksi tangan pada tabel — tidak pernah tertimpa pilihan ini,
  // termasuk ketika admin mengganti pilihannya berkali-kali.
  function ubahProdiCadangan(kode: string) {
    setProdiCadangan(kode);
    setBaris((rows) => rows.map((r) => (r.prodiDariBerkas ? r : { ...r, kodeProdi: kode })));
  }

  function salinPredikat() {
    setBaris((rows) => rows.map((r) => ({ ...r, keterangan: r.predikat || r.keterangan })));
  }

  function kosongkanKeterangan() {
    setBaris((rows) => rows.map((r) => ({ ...r, keterangan: "" })));
  }

  function ubahBaris(id: string, tambalan: Partial<BarisKelulusan>) {
    setBaris((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const baru = { ...r, ...tambalan };
        // Mengoreksi tanggal ikut memperbarui semesternya — kecuali admin
        // sedang memaksakan satu semester untuk seluruh berkas.
        if (tambalan.tanggalKeluar !== undefined && !semesterPaksa) {
          baru.semester = baru.tanggalKeluar ? semesterKeluar(baru.tanggalKeluar) : "";
        }
        // Kode prodi yang diketik tangan diperlakukan sama dengan yang datang
        // dari berkas: pilihan cadangan tidak boleh menghapusnya lagi.
        if (tambalan.kodeProdi !== undefined) baru.prodiDariBerkas = true;
        return baru;
      }),
    );
  }

  /* ---------- unduhan ---------- */

  function unduhData(kodeProdi?: string) {
    const pilihan = kodeProdi ? barisSiap.filter((b) => b.kodeProdi === kodeProdi) : barisSiap;
    if (!pilihan.length) {
      setPesan({ kind: "err", text: "Belum ada baris yang siap diunduh." });
      return;
    }
    const semester = pilihan[0].semester || "";
    const label = kodeProdi ? `-${kodeProdi}` : "";
    unduh(
      buatXlsxKelulusan(KOLOM_KELULUSAN, barisKeAoa(pilihan), NAMA_LEMBAR_PDDIKTI),
      `Kelulusan-PDDIKTI${label}${semester ? `-${semester}` : ""}.xlsx`,
    );
    setPesan({
      kind: "ok",
      text: `${pilihan.length} baris terunduh${kodeProdi ? ` untuk prodi ${kodeProdi}` : ""}. Unggah berkas ini apa adanya ke PDDIKTI. kolom dan urutannya sudah sesuai template.`,
    });
  }

  function unduhKosong() {
    unduh(buatXlsxKelulusan(KOLOM_KELULUSAN, [], NAMA_LEMBAR_PDDIKTI), "Template-Kelulusan-PDDIKTI-kosong.xlsx");
    setPesan({ kind: "ok", text: "Template kosong terunduh. Sepuluh kolom PDDIKTI lengkap dengan warna dan catatannya." });
  }

  /* ---------- semester: dua bacaan yang sama-sama dipakai orang ---------- */

  const tanggalContoh = baris.find((b) => b.tanggalKeluar)?.tanggalKeluar || "";
  // Bawaannya kode TAHUN AJARAN — itu yang dipakai PDDIKTI FISIP. Kode tahun
  // kalender tetap disebutkan supaya operator yang memakainya tidak perlu
  // menghitung sendiri.
  const semesterOtomatis = tanggalContoh ? semesterKeluar(tanggalContoh) : "";
  const semesterKalender = tanggalContoh ? semesterTahunKalender(tanggalContoh) : "";
  const tahunAjaran = semesterOtomatis ? `${semesterOtomatis.slice(0, 4)}/${Number(semesterOtomatis.slice(0, 4)) + 1}` : "";
  const semesterBeragam = useMemo(
    () => new Set(baris.map((b) => b.semester).filter(Boolean)).size > 1,
    [baris],
  );

  return (
    <div className="kel-wrap">
      {/* ---------- LANGKAH 1 ---------- */}
      <section className="panel kel-box">
        <h2 className="kel-h2"><span className="kel-no">1</span> Unggah Excel yudisium dari fakultas</h2>
        <p className="kel-p">
          Berkas apa adanya dari fakultas. Kop lampiran SK dan blok tanda tangan boleh ikut.
          Semua lembar di dalamnya dibaca sekaligus, jadi ILKOM dan ILPEM cukup satu kali unggah.
          Kolom yang dicari: <b>NIM</b>, <b>NAMA MAHASISWA</b>, <b>TGL YUDISIUM</b>, <b>IPK</b>, dan <b>KODE PRODI</b> bila ada.
        </p>
        <div className="kel-baris-tombol">
          <label className="file-box">
            <span className="file-btn">📁 Pilih Excel yudisium</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={bacaBerkas} />
          </label>
          <button type="button" className="btn btn-light btn-mini" onClick={unduhKosong}>⬇ Template kosong PDDIKTI</button>
          <button type="button" className="btn btn-light btn-mini" onClick={() => setBukaAcuan((v) => !v)}>
            {bukaAcuan ? "▲ Tutup" : "▼ Lihat"} arti sepuluh kolom PDDIKTI
          </button>
        </div>
        {namaBerkas && <p className="kel-berkas">Berkas terbaca: <b>{namaBerkas}</b></p>}
        {pesan && <div className={pesan.kind === "ok" ? "dsh-ok" : "dsh-error"}>{pesan.text}</div>}

        {bukaAcuan && (
          <div className="kel-acuan">
            <p className="kel-p">
              Warnanya disalin dari template PDDIKTI: <span className="kel-chip kel-chip-wajib">merah = wajib diisi</span>{" "}
              <span className="kel-chip kel-chip-bebas">hijau = boleh kosong</span>. Berkas yang diunduh di sini memakai
              warna dan catatan yang sama persis, jadi masih terbaca sebagai template PDDIKTI ketika dibuka lagi.
            </p>
            <ul className="kel-acuan-daftar">
              {KOLOM_KELULUSAN.map((kolom) => (
                <li key={kolom.judul}>
                  <span className={`kel-chip ${kolom.wajib ? "kel-chip-wajib" : "kel-chip-bebas"}`}>{kolom.judul}</span>
                  <span className="kel-acuan-isi">{kolom.catatan.trim() || "Tidak ada catatan pada template."}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ---------- LANGKAH 2 ---------- */}
      <section className="panel kel-box">
        <h2 className="kel-h2"><span className="kel-no">2</span> Lengkapi yang tidak ada di berkas fakultas</h2>
        <p className="kel-p">
          Nilai di sini berlaku untuk <b>seluruh baris</b> sekaligus. Baris tertentu tetap dapat diubah sendiri
          pada tabel di langkah 3.
        </p>
        <div className="kel-isian">
          <label>
            Jenis Keluar
            <select value={jenisSemua} onChange={(e) => ubahJenisSemua(e.target.value)}>
              {JENIS_KELUAR.map((j) => <option key={j.kode} value={j.kode}>{j.kode} · {j.label}</option>)}
            </select>
            <small>Lembar yudisium = <b>1 Lulus</b>. Untuk berkas dropout, pilih sebabnya.</small>
          </label>

          <label>
            Semester Keluar
            <input
              value={semesterPaksa}
              onChange={(e) => ubahSemesterPaksa(e.target.value)}
              placeholder={semesterOtomatis || "otomatis dari tanggal"}
              inputMode="numeric"
            />
            <small>
              Kosong = dihitung sendiri dari tanggal tiap baris, memakai kode <b>tahun ajaran</b>.
              {semesterOtomatis && (
                <>
                  {" "}Untuk berkas ini: <b>{semesterOtomatis}</b>
                  {tahunAjaran && <>, {semesterOtomatis.endsWith("2") ? "genap" : "ganjil"} TA {tahunAjaran}</>}.
                  {semesterKalender !== semesterOtomatis && (
                    <>
                      {" "}Bila unit Anda memakai kode <b>tahun kalender</b>, nilainya{" "}
                      <button type="button" className="kel-tautan" onClick={() => ubahSemesterPaksa(semesterKalender)}>{semesterKalender}</button>.
                    </>
                  )}
                </>
              )}
            </small>
          </label>

          <label>
            Nomor SK <span className="kel-tanda kel-tanda-bebas">boleh kosong</span>
            <input value={nomorSk} onChange={(e) => ubahNomorSk(e.target.value)} placeholder="003/KEP/III.3.AU/F/FISIP/2026" />
            <small>Terisi sendiri bila tertulis pada kop lembar fakultas.</small>
          </label>

          <label>
            Tanggal SK <span className="kel-tanda kel-tanda-bebas">boleh kosong</span>
            <input type="date" value={tanggalSk} onChange={(e) => ubahTanggalSk(e.target.value)} />
            <small>Diketik sesuai surat keputusannya. Tanggal ini tidak ada di berkas fakultas.</small>
          </label>

          <label>
            Kode Prodi cadangan
            <select value={prodiCadangan} onChange={(e) => ubahProdiCadangan(e.target.value)}>
              <option value="">(tidak dipakai)</option>
              {PRODI_PDDIKTI.map((p) => <option key={p.kode} value={p.kode}>{p.kode} · {p.nama}</option>)}
            </select>
            <small>Hanya mengisi baris yang kode prodinya kosong. Yang datang dari berkas tidak ditimpa.</small>
          </label>

          <label>
            Keterangan <span className="kel-tanda kel-tanda-bebas">boleh kosong</span>
            <span className="kel-baris-tombol kel-baris-rapat">
              <button type="button" className="btn btn-light btn-mini" onClick={salinPredikat} disabled={!baris.length}>Isi dari Predikat Kelulusan</button>
              <button type="button" className="btn btn-light btn-mini" onClick={kosongkanKeterangan} disabled={!baris.length}>Kosongkan</button>
            </span>
            <small>PDDIKTI tidak mewajibkannya; isi bila unit Anda memang mencatat predikat di sini.</small>
          </label>
        </div>

        {semesterBeragam && (
          <div className="dsh-error">
            Berkas ini berisi lebih dari satu semester keluar. Itu wajar bila yudisiumnya melintasi pergantian
            semester. Periksa kolom Semester pada tabel di bawah, atau ketik satu nilai di kolom Semester Keluar
            supaya seragam.
          </div>
        )}
      </section>

      {/* ---------- LANGKAH 3 ---------- */}
      <section className="panel kel-box">
        <h2 className="kel-h2"><span className="kel-no">3</span> Periksa lalu unduh</h2>

        {baris.length === 0 ? (
          <p className="kel-kosong">Belum ada data. Mulai dari langkah 1.</p>
        ) : (
          <>
            <div className="kel-ringkas">
              <span className="kel-angka"><b>{baris.length}</b> baris terbaca</span>
              <span className="kel-angka kel-angka-ok"><b>{barisSiap.length}</b> siap diunggah</span>
              {masalah.length > 0 && <span className="kel-angka kel-angka-salah"><b>{masalah.length}</b> perlu diperbaiki</span>}
            </div>

            {masalah.length > 0 && (
              <div className="dsh-error kel-masalah">
                <b>{masalah.length} baris belum bisa diunduh</b> karena kolom wajibnya belum benar. Baris ini{" "}
                <b>tidak ikut</b> ke berkas hasil sampai diperbaiki:
                <ul>
                  {masalah.slice(0, 8).map((m) => (
                    <li key={m.id}>{m.nim || "(NIM kosong)"} {m.nama && `· ${m.nama}`}: {m.sebab}</li>
                  ))}
                </ul>
                {masalah.length > 8 && <span>…dan {masalah.length - 8} lainnya. Nyalakan saringan &quot;hanya yang bermasalah&quot; di bawah.</span>}
              </div>
            )}

            <div className="kel-baris-tombol kel-unduh">
              <button type="button" className="btn btn-primary btn-mini" onClick={() => unduhData()} disabled={!barisSiap.length}>
                ⬇ Unduh Excel PDDIKTI ({barisSiap.length} baris)
              </button>
              {prodiAda.length > 1 && prodiAda.map((kode) => {
                const jumlah = barisSiap.filter((b) => b.kodeProdi === kode).length;
                const nama = PRODI_PDDIKTI.find((p) => p.kode === kode)?.nama || kode;
                return (
                  <button key={kode} type="button" className="btn btn-light btn-mini" onClick={() => unduhData(kode)} disabled={!jumlah}>
                    ⬇ {nama} saja ({jumlah})
                  </button>
                );
              })}
            </div>
            <p className="kel-p kel-p-kecil">
              Berkas hasil berisi satu lembar bernama <b>{NAMA_LEMBAR_PDDIKTI}</b> dengan sepuluh kolom urut A–J,
              seluruh isinya berbentuk teks supaya NIM tidak berubah menjadi 2.27E+09 dan IPK tidak kehilangan angka nolnya.
            </p>

            <div className="kel-saring">
              <input value={cari} onChange={(e) => { setCari(e.target.value); setHalaman(0); }} placeholder="Cari NIM atau nama…" />
              <select value={saringProdi} onChange={(e) => { setSaringProdi(e.target.value); setHalaman(0); }}>
                <option value="">Semua prodi</option>
                {prodiAda.map((kode) => (
                  <option key={kode} value={kode}>{kode} · {PRODI_PDDIKTI.find((p) => p.kode === kode)?.nama || "?"}</option>
                ))}
              </select>
              <label className="kel-centang">
                <input type="checkbox" checked={hanyaBermasalah} onChange={(e) => { setHanyaBermasalah(e.target.checked); setHalaman(0); }} />
                hanya yang bermasalah
              </label>
              <span className="kel-hitung">{terlihat.length} baris tampil</span>
            </div>

            <div className="kel-tabel-bungkus">
              <table className="kel-tabel">
                <thead>
                  <tr>
                    <th>#</th>
                    {KOLOM_KELULUSAN.map((k) => (
                      <th key={k.judul} className={k.wajib ? "kel-th-wajib" : "kel-th-bebas"} title={k.catatan.trim() || undefined}>
                        {k.judul}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {potongan.map((row, urut) => {
                    const rusak = idBermasalah.has(row.id);
                    return (
                      <tr key={row.id} className={rusak ? "kel-tr-rusak" : ""}>
                        <td className="kel-td-no" title={`${row.lembar} baris ${row.barisAsli}`}>
                          {halamanKini * PER_HALAMAN + urut + 1}
                        </td>
                        <td><input value={row.nim} onChange={(e) => ubahBaris(row.id, { nim: e.target.value })} /></td>
                        <td><input className="kel-in-lebar" value={row.nama} onChange={(e) => ubahBaris(row.id, { nama: e.target.value })} /></td>
                        <td>
                          <select value={row.jenisKeluar} onChange={(e) => ubahBaris(row.id, { jenisKeluar: e.target.value })}>
                            {JENIS_KELUAR.map((j) => <option key={j.kode} value={j.kode} title={j.label}>{j.kode} · {j.label}</option>)}
                          </select>
                        </td>
                        <td>
                          <input
                            value={row.tanggalKeluar}
                            onChange={(e) => ubahBaris(row.id, { tanggalKeluar: e.target.value })}
                            placeholder="2026-06-07"
                            title={row.tanggalAsli ? `Di berkas fakultas tertulis: ${row.tanggalAsli}` : undefined}
                          />
                        </td>
                        <td><input className="kel-in-sempit" value={row.semester} onChange={(e) => ubahBaris(row.id, { semester: e.target.value })} /></td>
                        <td><input value={row.nomorSk} onChange={(e) => ubahBaris(row.id, { nomorSk: e.target.value })} /></td>
                        <td><input className="kel-in-sempit" value={row.tanggalSk} onChange={(e) => ubahBaris(row.id, { tanggalSk: e.target.value })} placeholder="kosong" /></td>
                        <td><input className="kel-in-sempit" value={row.ipk} onChange={(e) => ubahBaris(row.id, { ipk: e.target.value })} /></td>
                        <td><input value={row.keterangan} onChange={(e) => ubahBaris(row.id, { keterangan: e.target.value })} placeholder="kosong" /></td>
                        <td><input className="kel-in-sempit" value={row.kodeProdi} onChange={(e) => ubahBaris(row.id, { kodeProdi: e.target.value })} /></td>
                      </tr>
                    );
                  })}
                  {potongan.length === 0 && (
                    <tr><td colSpan={KOLOM_KELULUSAN.length + 1} className="kel-kosong">Tidak ada baris yang cocok dengan saringan ini.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {halamanMaks > 0 && (
              <div className="kel-halaman">
                <button type="button" className="btn btn-light btn-mini" onClick={() => setHalaman((h) => Math.max(0, h - 1))} disabled={halamanKini === 0}>← Sebelumnya</button>
                <span>Halaman {halamanKini + 1} dari {halamanMaks + 1}</span>
                <button type="button" className="btn btn-light btn-mini" onClick={() => setHalaman((h) => Math.min(halamanMaks, h + 1))} disabled={halamanKini >= halamanMaks}>Berikutnya →</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
