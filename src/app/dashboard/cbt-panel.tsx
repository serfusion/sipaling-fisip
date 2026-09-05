"use client";

// ============================================================
// PANEL CBT DI DASHBOARD — untuk Dosen, Admin, dan Super Admin
//
// Pembagian wewenangnya kelihatan dari layarnya, bukan hanya dijaga server:
//
//   Dosen  membuat ujian, menyusun soal, menentukan JUMLAH SOAL dan DURASI,
//          memantau, dan mengoreksi. Ia TIDAK melihat tombol aktivasi.
//   Admin  dan Super Admin memegang tombol itu: menyetel jam mulai dan jam
//          selesai, lalu ujiannya terbuka sendiri pada jam tersebut.
//
// Admin bagian — umum, akademik, prodi, PDDIKTI, perpustakaan, laboratorium —
// tidak melihat menu ini sama sekali.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { JENIS_LABEL, STATUS_LABEL, type JenisSoal, type StatusUjian } from "@/lib/cbt";

type Ujian = {
  id: number; code: string; title: string; courseName: string; className: string | null;
  questionCount: number; durationMinutes: number; passingGrade: number; maxAttempts: number;
  randomQuestions: boolean; randomOptions: boolean; allowBack: boolean; showScore: boolean;
  token: string | null; startAt: string | null; endAt: string | null;
  activatedAt: string | null; activatedBy: string | null;
  description: string | null; instruction: string | null; createdBy: string;
  status: StatusUjian; jumlahBank: number;
  peserta: { total: number; berjalan: number; selesai: number };
};

type Soal = {
  id: number; jenis: JenisSoal; pertanyaan: string; pilihan: string[];
  kunci: string; bobot: number; materi: string; tingkat: string; pembahasan: string;
};

type Peserta = {
  id: number; nim: string; nama: string; status: string; terjawab: number;
  nilai: number | null; tertunda: number; sisaDetik: number;
  keluarFullscreen: number; pindahTab: number; mulai: string; kumpul: string | null;
};

type Analisis = {
  id: number; pertanyaan: string; dijawab: number; benar: number;
  persen: number; kategori: string; perluDitinjau: boolean;
};

type Statistik = {
  peserta: number; rata: number; tertinggi: number; terendah: number;
  median: number; lulus: number; tidakLulus: number; persenLulus: number;
};

const SOAL_KOSONG = {
  jenis: "pg" as JenisSoal,
  pertanyaan: "",
  pilihan: ["", "", "", ""],
  kunci: "0",
  bobot: 1,
  materi: "",
  tingkat: "sedang",
  pembahasan: "",
};

/** Ubah tanggal ISO menjadi nilai untuk <input type="datetime-local">. */
function untukInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function jamRapi(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function CbtPanel({ role }: { role: string }) {
  const bolehAktivasi = role === "super_admin" || role === "admin";

  const [ujian, setUjian] = useState<Ujian[]>([]);
  const [muat, setMuat] = useState(true);
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState<number | null>(null);
  const [tab, setTab] = useState<"soal" | "pantau">("soal");
  const [buatBaru, setBuatBaru] = useState(false);

  const [draf, setDraf] = useState({
    title: "", courseName: "", className: "",
    questionCount: 20, durationMinutes: 60, passingGrade: 60, maxAttempts: 1,
    token: "", instruction: "",
    randomQuestions: true, randomOptions: true, allowBack: true, showScore: true,
  });

  const [soal, setSoal] = useState<Soal[]>([]);
  const [soalBaru, setSoalBaru] = useState({ ...SOAL_KOSONG });
  const [sunting, setSunting] = useState<number | null>(null);

  const [peserta, setPeserta] = useState<Peserta[]>([]);
  const [statistik, setStatistik] = useState<Statistik | null>(null);
  const [analisis, setAnalisis] = useState<Analisis[]>([]);

  const [jadwal, setJadwal] = useState({ mulai: "", selesai: "" });
  const [sibuk, setSibuk] = useState(false);

  const muatUjian = useCallback(async () => {
    try {
      const jawab = await fetch("/api/cbt/ujian", { cache: "no-store" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Daftar ujian tidak terbaca.");
      setUjian(data.ujian || []);
      setGalat("");
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Daftar ujian tidak terbaca.");
    } finally {
      setMuat(false);
    }
  }, []);

  useEffect(() => {
    const tunda = window.setTimeout(() => void muatUjian(), 0);
    return () => window.clearTimeout(tunda);
  }, [muatUjian]);

  // Monitoring ujian yang sedang berlangsung menyegar sendiri: dosen yang
  // harus menekan tombol muat ulang tiap menit tidak sedang memantau apa pun.
  useEffect(() => {
    if (buka === null || tab !== "pantau") return;
    const jam = setInterval(() => void muatHasil(buka), 15_000);
    return () => clearInterval(jam);
  }, [buka, tab]);

  const terbuka = ujian.find((u) => u.id === buka) || null;

  async function muatSoal(id: number) {
    try {
      const jawab = await fetch(`/api/cbt/soal?ujian=${id}`, { cache: "no-store" });
      const data = await jawab.json();
      if (data.success) setSoal(data.soal || []);
    } catch {
      // Daftar soal kosong lebih baik daripada galat merah yang menutup panel.
    }
  }

  async function muatHasil(id: number) {
    try {
      const jawab = await fetch(`/api/cbt/hasil?ujian=${id}`, { cache: "no-store" });
      const data = await jawab.json();
      if (data.success) {
        setPeserta(data.peserta || []);
        setStatistik(data.statistik || null);
        setAnalisis(data.analisis || []);
      }
    } catch {
      // Diabaikan; angka lama tetap tampil sampai pemuatan berikutnya.
    }
  }

  function bukaUjian(u: Ujian) {
    setBuka(u.id);
    setTab("soal");
    setSunting(null);
    setSoalBaru({ ...SOAL_KOSONG });
    setJadwal({ mulai: untukInput(u.startAt), selesai: untukInput(u.endAt) });
    void muatSoal(u.id);
    void muatHasil(u.id);
  }

  async function kirim(alamat: string, cara: string, isi: unknown, sukses: string) {
    setSibuk(true);
    setPesan("");
    setGalat("");
    try {
      const jawab = await fetch(alamat, {
        method: cara,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isi),
      });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Belum tersimpan.");
      setPesan(sukses);
      return data as Record<string, unknown>;
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Belum tersimpan.");
      return null;
    } finally {
      setSibuk(false);
    }
  }

  async function buatUjian() {
    if (!draf.title.trim() || !draf.courseName.trim()) {
      setGalat("Nama ujian dan mata kuliah wajib diisi.");
      return;
    }
    const hasil = await kirim("/api/cbt/ujian", "POST", draf, "Ujian dibuat. Sekarang isi soalnya.");
    if (!hasil) return;
    setBuatBaru(false);
    setDraf({ ...draf, title: "", className: "", instruction: "", token: "" });
    await muatUjian();
  }

  async function simpanSoal() {
    if (!terbuka) return;
    const target = sunting;
    const isi = target
      ? { id: target, ...soalBaru }
      : { ujian: terbuka.id, soal: [soalBaru] };
    const hasil = await kirim(
      "/api/cbt/soal",
      target ? "PATCH" : "POST",
      isi,
      target ? "Soal diperbarui." : "Soal ditambahkan.",
    );
    if (!hasil) return;
    setSoalBaru({ ...SOAL_KOSONG });
    setSunting(null);
    await muatSoal(terbuka.id);
    await muatUjian();
  }

  async function hapusSoal(id: number) {
    if (!terbuka || !window.confirm("Hapus soal ini?")) return;
    setSibuk(true);
    try {
      const jawab = await fetch(`/api/cbt/soal?id=${id}`, { method: "DELETE" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Soal belum dapat dihapus.");
      await muatSoal(terbuka.id);
      await muatUjian();
      setPesan("Soal dihapus.");
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Soal belum dapat dihapus.");
    } finally {
      setSibuk(false);
    }
  }

  async function aktifkan() {
    if (!terbuka) return;
    if (!jadwal.mulai || !jadwal.selesai) {
      setGalat("Jam mulai dan jam selesai wajib diisi.");
      return;
    }
    const hasil = await kirim(
      "/api/cbt/aktivasi",
      "POST",
      {
        id: terbuka.id,
        aksi: "aktifkan",
        mulai: new Date(jadwal.mulai).toISOString(),
        selesai: new Date(jadwal.selesai).toISOString(),
      },
      "Ujian diaktifkan. Ia akan terbuka sendiri pada jam mulainya.",
    );
    if (hasil) await muatUjian();
  }

  async function batalkanAktivasi() {
    if (!terbuka || !window.confirm("Batalkan aktivasi ujian ini?")) return;
    const hasil = await kirim(
      "/api/cbt/aktivasi",
      "POST",
      { id: terbuka.id, aksi: "batalkan" },
      "Aktivasi dibatalkan.",
    );
    if (hasil) await muatUjian();
  }

  async function koreksi(attemptId: number, questionId: number, poin: number, catatan: string) {
    if (!terbuka) return;
    const hasil = await kirim(
      "/api/cbt/hasil",
      "PATCH",
      { ujian: terbuka.id, attempt: attemptId, soal: questionId, poin, catatan },
      "Koreksi tersimpan.",
    );
    if (hasil) await muatHasil(terbuka.id);
  }
  void koreksi;

  function unduhNilai() {
    if (!terbuka || peserta.length === 0) return;
    const baris = [
      ["NIM", "Nama", "Nilai", "Benar", "Status", "Mulai", "Kumpul"].join(","),
      ...peserta.map((p) =>
        [
          p.nim,
          `"${p.nama.replace(/"/g, '""')}"`,
          p.nilai ?? "",
          p.terjawab,
          p.status,
          jamRapi(p.mulai),
          jamRapi(p.kumpul),
        ].join(","),
      ),
    ].join("\n");
    // BOM di depan supaya Excel membaca huruf beraksen dengan benar.
    const berkas = new Blob([`﻿${baris}`], { type: "text/csv;charset=utf-8" });
    const alamat = URL.createObjectURL(berkas);
    const tautan = document.createElement("a");
    tautan.href = alamat;
    tautan.download = `nilai-${terbuka.code}.csv`;
    tautan.click();
    URL.revokeObjectURL(alamat);
  }

  // ---------- DAFTAR UJIAN ----------
  if (buka === null) {
    return (
      <section>
        <p className="section-eyebrow">{bolehAktivasi ? "DOSEN & ADMIN" : "DOSEN"}</p>
        <h2 className="dsh-title">Ujian Online (CBT)</h2>

        {pesan && <div className="dsh-ok">{pesan}</div>}
        {galat && <div className="dsh-error">{galat}</div>}

        <div className="panel cbt-kepala">
          <div>
            <b>Mahasiswa tidak perlu akun</b>
            <span>
              Mereka cukup membuka <code>/ujian</code>, memasukkan kode ujian, nama, dan NIM.
              {bolehAktivasi
                ? " Ujian baru terbuka setelah Anda aktifkan dan jam mulainya tiba."
                : " Ujian baru terbuka setelah diaktifkan Super Admin atau Admin."}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setBuatBaru((b) => !b)}>
            {buatBaru ? "Tutup" : "+ Buat ujian"}
          </button>
        </div>

        {buatBaru && (
          <div className="panel cbt-form">
            <div className="cbt-baris">
              <label><span>Nama ujian *</span>
                <input value={draf.title} onChange={(e) => setDraf({ ...draf, title: e.target.value })} placeholder="UTS Komunikasi Politik" />
              </label>
              <label><span>Mata kuliah *</span>
                <input value={draf.courseName} onChange={(e) => setDraf({ ...draf, courseName: e.target.value })} placeholder="Komunikasi Politik" />
              </label>
              <label><span>Kelas</span>
                <input value={draf.className} onChange={(e) => setDraf({ ...draf, className: e.target.value })} placeholder="A / Reguler" />
              </label>
            </div>

            {/* Dua angka inilah yang ditentukan dosen, dan blueprint-nya
                menyebutnya khusus: berapa soal, dan berapa lama. */}
            <div className="cbt-baris">
              <label><span>Jumlah soal yang dikerjakan</span>
                <input type="number" min={1} max={500} value={draf.questionCount} onChange={(e) => setDraf({ ...draf, questionCount: Number(e.target.value) })} />
              </label>
              <label><span>Durasi (menit)</span>
                <input type="number" min={1} max={600} value={draf.durationMinutes} onChange={(e) => setDraf({ ...draf, durationMinutes: Number(e.target.value) })} />
              </label>
              <label><span>Nilai minimal lulus</span>
                <input type="number" min={0} max={100} value={draf.passingGrade} onChange={(e) => setDraf({ ...draf, passingGrade: Number(e.target.value) })} />
              </label>
              <label><span>Kode tambahan (opsional)</span>
                <input value={draf.token} onChange={(e) => setDraf({ ...draf, token: e.target.value.toUpperCase() })} placeholder="Dibacakan pengawas" />
              </label>
            </div>

            <label className="cbt-lebar"><span>Instruksi untuk mahasiswa</span>
              <textarea rows={3} value={draf.instruction} onChange={(e) => setDraf({ ...draf, instruction: e.target.value })} placeholder="Kerjakan sendiri. Tidak boleh membuka catatan." />
            </label>

            <div className="cbt-sakelar">
              {([
                ["randomQuestions", "Acak urutan soal"],
                ["randomOptions", "Acak urutan pilihan"],
                ["allowBack", "Boleh kembali ke soal sebelumnya"],
                ["showScore", "Tampilkan nilai setelah selesai"],
              ] as const).map(([kunci, label]) => (
                <label key={kunci} className="cbt-cek">
                  <input type="checkbox" checked={draf[kunci]} onChange={(e) => setDraf({ ...draf, [kunci]: e.target.checked })} />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <button type="button" className="btn btn-primary" disabled={sibuk} onClick={() => void buatUjian()}>
              {sibuk ? "Menyimpan…" : "Simpan ujian"}
            </button>
          </div>
        )}

        {muat ? (
          <div className="dempty">Memuat ujian…</div>
        ) : ujian.length === 0 ? (
          <div className="dempty">Belum ada ujian. Tekan &ldquo;Buat ujian&rdquo; untuk memulai.</div>
        ) : (
          <div className="cbt-daftar">
            {ujian.map((u) => (
              <button type="button" key={u.id} className="cbt-kartu" onClick={() => bukaUjian(u)}>
                <div className="cbt-kartu-atas">
                  <span className={`pill cbt-${u.status}`}>{STATUS_LABEL[u.status]}</span>
                  <code>{u.code}</code>
                </div>
                <b>{u.title}</b>
                <span className="cbt-mk">{u.courseName}{u.className ? ` · ${u.className}` : ""}</span>
                <div className="cbt-angka">
                  <span><b>{u.questionCount || u.jumlahBank}</b> soal</span>
                  <span><b>{u.durationMinutes}</b> menit</span>
                  <span><b>{u.peserta.total}</b> peserta</span>
                  {u.peserta.berjalan > 0 && <span className="cbt-hidup"><b>{u.peserta.berjalan}</b> mengerjakan</span>}
                </div>
                {u.startAt && <small className="cbt-jadwal">{jamRapi(u.startAt)} → {jamRapi(u.endAt)}</small>}
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (!terbuka) return <div className="dempty">Ujian tidak ditemukan.</div>;

  // ---------- SATU UJIAN ----------
  const terkunci = terbuka.status === "berlangsung";

  return (
    <section>
      <button type="button" className="text-action" onClick={() => { setBuka(null); void muatUjian(); }}>
        ← Semua ujian
      </button>
      <h2 className="dsh-title cbt-judul">{terbuka.title}</h2>
      <p className="cbt-sub">
        {terbuka.courseName}{terbuka.className ? ` · ${terbuka.className}` : ""} ·
        kode ujian <code>{terbuka.code}</code>
      </p>

      {pesan && <div className="dsh-ok">{pesan}</div>}
      {galat && <div className="dsh-error">{galat}</div>}

      {/* ---------- GERBANG AKTIVASI ---------- */}
      <div className="panel cbt-aktivasi" data-aktif={terbuka.activatedAt ? "1" : undefined}>
        <div className="cbt-aktivasi-kepala">
          <div>
            <b>{terbuka.activatedAt ? "Ujian sudah diaktifkan" : "Belum diaktifkan"}</b>
            <span>
              {terbuka.activatedAt
                ? `Dibuka sendiri ${jamRapi(terbuka.startAt)} sampai ${jamRapi(terbuka.endAt)}. Diaktifkan oleh ${terbuka.activatedBy ?? "—"}.`
                : bolehAktivasi
                  ? "Setel jam mulai dan jam selesai, lalu aktifkan. Pada jam mulainya ujian terbuka sendiri — tidak ada tombol yang perlu ditekan lagi."
                  : "Menunggu Super Admin atau Admin mengaktifkan. Anda tetap dapat menyusun soalnya sekarang."}
            </span>
          </div>
          <span className={`pill cbt-${terbuka.status}`}>{STATUS_LABEL[terbuka.status]}</span>
        </div>

        {bolehAktivasi ? (
          <div className="cbt-baris cbt-jadwal-form">
            <label><span>Jam mulai</span>
              <input type="datetime-local" value={jadwal.mulai} onChange={(e) => setJadwal({ ...jadwal, mulai: e.target.value })} />
            </label>
            <label><span>Jam selesai</span>
              <input type="datetime-local" value={jadwal.selesai} onChange={(e) => setJadwal({ ...jadwal, selesai: e.target.value })} />
            </label>
            <div className="cbt-jadwal-aksi">
              <button type="button" className="btn btn-primary" disabled={sibuk} onClick={() => void aktifkan()}>
                {terbuka.activatedAt ? "Perbarui jadwal" : "Aktifkan ujian"}
              </button>
              {terbuka.activatedAt && (
                <button type="button" className="btn btn-danger btn-mini" disabled={sibuk} onClick={() => void batalkanAktivasi()}>
                  Batalkan
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="cbt-catatan">
            Aktivasi ujian dipegang Super Admin dan Admin — bukan admin bagian. Kirimkan nama ujian
            dan jam pelaksanaannya kepada mereka.
          </p>
        )}
      </div>

      <div className="cbt-tab">
        <button type="button" className={tab === "soal" ? "on" : ""} onClick={() => setTab("soal")}>
          Bank soal ({soal.length})
        </button>
        <button type="button" className={tab === "pantau" ? "on" : ""} onClick={() => { setTab("pantau"); void muatHasil(terbuka.id); }}>
          Monitoring & nilai ({peserta.length})
        </button>
      </div>

      {tab === "soal" ? (
        <>
          {terkunci && (
            <div className="dsh-error">
              Ujian sedang berlangsung. Soal dikunci sampai selesai — mengubahnya sekarang berarti
              sebagian mahasiswa mengerjakan ujian yang berbeda dari sebagian yang lain.
            </div>
          )}

          <div className="panel cbt-form">
            <b className="cbt-form-judul">{sunting ? "Ubah soal" : "Tambah soal"}</b>

            <div className="cbt-baris">
              <label><span>Jenis</span>
                <select value={soalBaru.jenis} onChange={(e) => {
                  const jenis = e.target.value as JenisSoal;
                  setSoalBaru((s) => ({
                    ...s,
                    jenis,
                    pilihan: jenis === "benar_salah" ? ["Benar", "Salah"] : jenis === "pg" ? ["", "", "", ""] : [],
                    kunci: jenis === "essay" ? "" : "0",
                  }));
                }}>
                  {(Object.keys(JENIS_LABEL) as JenisSoal[]).map((j) => (
                    <option key={j} value={j}>{JENIS_LABEL[j]}</option>
                  ))}
                </select>
              </label>
              <label><span>Bobot nilai</span>
                <input type="number" min={1} max={100} value={soalBaru.bobot} onChange={(e) => setSoalBaru({ ...soalBaru, bobot: Number(e.target.value) })} />
              </label>
              <label><span>Materi</span>
                <input value={soalBaru.materi} onChange={(e) => setSoalBaru({ ...soalBaru, materi: e.target.value })} placeholder="Bab 2" />
              </label>
              <label><span>Tingkat</span>
                <select value={soalBaru.tingkat} onChange={(e) => setSoalBaru({ ...soalBaru, tingkat: e.target.value })}>
                  <option value="mudah">Mudah</option>
                  <option value="sedang">Sedang</option>
                  <option value="sulit">Sulit</option>
                </select>
              </label>
            </div>

            <label className="cbt-lebar"><span>Pertanyaan *</span>
              <textarea rows={3} value={soalBaru.pertanyaan} onChange={(e) => setSoalBaru({ ...soalBaru, pertanyaan: e.target.value })} />
            </label>

            {(soalBaru.jenis === "pg" || soalBaru.jenis === "benar_salah") && (
              <div className="cbt-opsi-edit">
                <span className="cbt-opsi-judul">Pilihan jawaban — tekan lingkarannya untuk menandai kunci</span>
                {soalBaru.pilihan.map((p, i) => (
                  <div key={i} className="cbt-opsi-baris">
                    <button
                      type="button"
                      className={`cbt-kunci ${soalBaru.kunci === String(i) ? "on" : ""}`}
                      onClick={() => setSoalBaru({ ...soalBaru, kunci: String(i) })}
                      title="Tandai sebagai kunci jawaban"
                    >
                      {String.fromCharCode(65 + i)}
                    </button>
                    <input
                      value={p}
                      onChange={(e) => {
                        const berikut = [...soalBaru.pilihan];
                        berikut[i] = e.target.value;
                        setSoalBaru({ ...soalBaru, pilihan: berikut });
                      }}
                      placeholder={`Pilihan ${String.fromCharCode(65 + i)}`}
                    />
                    {soalBaru.jenis === "pg" && soalBaru.pilihan.length > 2 && (
                      <button type="button" className="cbt-buang" onClick={() => {
                        const berikut = soalBaru.pilihan.filter((_, n) => n !== i);
                        setSoalBaru({ ...soalBaru, pilihan: berikut, kunci: "0" });
                      }}>✕</button>
                    )}
                  </div>
                ))}
                {soalBaru.jenis === "pg" && soalBaru.pilihan.length < 6 && (
                  <button type="button" className="btn btn-light btn-mini" onClick={() => setSoalBaru({ ...soalBaru, pilihan: [...soalBaru.pilihan, ""] })}>
                    + Tambah pilihan
                  </button>
                )}
              </div>
            )}

            {soalBaru.jenis === "isian" && (
              <label className="cbt-lebar"><span>Kunci jawaban — pisahkan beberapa kemungkinan dengan |</span>
                <input value={soalBaru.kunci} onChange={(e) => setSoalBaru({ ...soalBaru, kunci: e.target.value })} placeholder="komunikasi massa|mass communication" />
              </label>
            )}

            {soalBaru.jenis === "essay" && (
              <p className="cbt-catatan">Essay dikoreksi dosen di tab Monitoring &amp; nilai setelah ujian selesai.</p>
            )}

            <div className="cbt-form-aksi">
              <button type="button" className="btn btn-primary" disabled={sibuk || terkunci} onClick={() => void simpanSoal()}>
                {sunting ? "Simpan perubahan" : "+ Tambah ke bank soal"}
              </button>
              {sunting && (
                <button type="button" className="btn btn-light" onClick={() => { setSunting(null); setSoalBaru({ ...SOAL_KOSONG }); }}>
                  Batal
                </button>
              )}
            </div>
          </div>

          {soal.length === 0 ? (
            <div className="dempty">Bank soal masih kosong.</div>
          ) : (
            <ol className="cbt-soal-daftar">
              {soal.map((s) => (
                <li key={s.id} className="cbt-soal-item">
                  <div className="cbt-soal-kepala">
                    <span className={`pill cbt-t-${s.tingkat}`}>{JENIS_LABEL[s.jenis]} · {s.bobot} poin</span>
                    <span className="cbt-soal-aksi">
                      <button type="button" disabled={terkunci} onClick={() => { setSunting(s.id); setSoalBaru({ ...s, pilihan: s.pilihan.length ? s.pilihan : ["", ""] }); }}>Ubah</button>
                      <button type="button" disabled={terkunci} onClick={() => void hapusSoal(s.id)}>Hapus</button>
                    </span>
                  </div>
                  <p className="cbt-soal-tanya">{s.pertanyaan}</p>
                  {s.pilihan.length > 0 && (
                    <ul className="cbt-soal-opsi">
                      {s.pilihan.map((p, i) => (
                        <li key={i} className={s.kunci === String(i) ? "kunci" : ""}>
                          <b>{String.fromCharCode(65 + i)}.</b> {p}{s.kunci === String(i) && <i> ← kunci</i>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.jenis === "isian" && <p className="cbt-soal-kunci">Kunci: {s.kunci}</p>}
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <>
          {statistik && statistik.peserta > 0 && (
            <div className="psn-angka cbt-statistik">
              <div><b>{statistik.peserta}</b><span>selesai</span></div>
              <div><b>{statistik.rata}</b><span>rata-rata</span></div>
              <div><b>{statistik.tertinggi}</b><span>tertinggi</span></div>
              <div><b>{statistik.terendah}</b><span>terendah</span></div>
              <div><b>{statistik.persenLulus}%</b><span>lulus</span></div>
            </div>
          )}

          <div className="panel psn-panel">
            <div className="psn-kepala">
              <div>
                <b>Peserta</b>
                <span>Menyegar sendiri tiap 15 detik selama tab ini terbuka.</span>
              </div>
              <button type="button" className="btn btn-light btn-mini" onClick={() => void unduhNilai()} disabled={peserta.length === 0}>
                ⇩ Unduh nilai (CSV)
              </button>
            </div>

            {peserta.length === 0 ? (
              <div className="dempty">Belum ada yang masuk ke ujian ini.</div>
            ) : (
              <div className="qtable-wrap">
                <table className="qt">
                  <thead>
                    <tr><th>Mahasiswa</th><th>Status</th><th>Progres</th><th>Nilai</th><th>Catatan</th></tr>
                  </thead>
                  <tbody>
                    {peserta.map((p) => (
                      <tr key={p.id}>
                        <td><b>{p.nama}</b><small className="psn-nama">{p.nim}</small></td>
                        <td>
                          <span className={`pill cbt-p-${p.status}`}>
                            {p.status === "berjalan" ? "Mengerjakan" : p.status === "waktu_habis" ? "Waktu habis" : "Selesai"}
                          </span>
                        </td>
                        <td>{p.terjawab}/{terbuka.questionCount || soal.length}</td>
                        <td>
                          {p.nilai === null ? "—" : <b>{p.nilai}</b>}
                          {p.tertunda > 0 && <small className="psn-nama">{p.tertunda} essay menunggu</small>}
                        </td>
                        <td>
                          {p.pindahTab > 0 || p.keluarFullscreen > 0 ? (
                            <small className="cbt-langgar">
                              {p.pindahTab > 0 && `pindah tab ${p.pindahTab}×`}
                              {p.pindahTab > 0 && p.keluarFullscreen > 0 && " · "}
                              {p.keluarFullscreen > 0 && `keluar layar penuh ${p.keluarFullscreen}×`}
                            </small>
                          ) : (
                            <small className="psn-nama">—</small>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {analisis.some((a) => a.dijawab > 0) && (
            <div className="panel psn-panel">
              <div className="psn-kepala">
                <div>
                  <b>Analisis soal</b>
                  <span>
                    Soal yang dijawab benar di bawah 30% ditandai perlu ditinjau — bisa jadi memang
                    sulit, bisa jadi kuncinya yang salah.
                  </span>
                </div>
              </div>
              <ul className="cbt-analisis">
                {analisis.filter((a) => a.dijawab > 0).map((a) => (
                  <li key={a.id} className={a.perluDitinjau ? "tinjau" : ""}>
                    <div className="cbt-analisis-bar"><span style={{ width: `${a.persen}%` }} /></div>
                    <div className="cbt-analisis-teks">
                      <b>{a.persen}% benar</b>
                      <span>{a.pertanyaan.slice(0, 90)}{a.pertanyaan.length > 90 ? "…" : ""}</span>
                      {a.perluDitinjau && <i>⚠ perlu ditinjau</i>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
