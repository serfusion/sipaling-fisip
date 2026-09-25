"use client";

// ============================================================
// BAGIAN CBT V1 PADA DASHBOARD PENGAJAR
//
// Lima potongan yang dipakai panel CBT, dipisahkan ke berkas sendiri karena
// panel utamanya sudah tiga ribu baris — dan berkas yang harus digulir lima
// menit untuk menemukan satu tombol adalah berkas yang berhenti dibetulkan.
//
//   PanelMahasiswa    daftar mahasiswa + impor
//   PanelRubrik       rubrik: pilih dari yang siap pakai, atau susun sendiri
//   PanelAcuan        kunci jawaban acuan dosen: unduh template, isi, unggah
//   LembarRubrik      penilaian esai satu peserta + pengesahan nilai
//   PemutarRekaman    rekaman suara + penanda yang dapat ditekan
//   DaftarMirip       pasangan jawaban yang mirip
//
// ------------------------------------------------------------
// SATU SIKAP YANG BERLAKU DI SELURUHNYA
// ------------------------------------------------------------
// Tidak satu pun bagian di sini boleh MENUDUH. Kemiripan dan penandaan suara
// selalu muncul disertai kalimat yang menyebutnya indikasi yang perlu
// diperiksa — bukan sebagai lencana merah yang berdiri sendiri. Lencana merah
// tanpa kalimat itu akan dibaca sebagai putusan, dan yang membacanya lelah,
// pada pekan penilaian, dengan empat puluh lembar lain menunggu.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAKS_KRITERIA, RUBRIK_BAWAAN, hitungRubrik, predikat, periksaRubrik, ratakanBobot,
  rubrikKosong, type KriteriaRubrik, type Rubrik,
} from "@/lib/rubrik";
import { imporRubrikExcel, imporRubrikWord } from "@/lib/impor-rubrik";
import {
  LEMBAR_RUBRIK, buatDocxRubrik, buatXlsxDariRubrik, buatXlsxRubrik,
} from "@/lib/template-rubrik";
import { STATUS_MIRIP_LABEL, STATUS_MIRIP_WARNA, type StatusMirip } from "@/lib/mirip-jawaban";
import { STATUS_TANDA_LABEL, STATUS_TANDA_WARNA, ejaJamRekaman, type StatusTanda } from "@/lib/rekaman";
import {
  STATUS_MAHASISWA, STATUS_MAHASISWA_LABEL, bacaImporMahasiswa, bacaTempelMahasiswa,
  type Aoa, type BarisImpor, type Mahasiswa,
} from "@/lib/mahasiswa";
import {
  AMBANG_NOL_BAWAAN, AMBANG_PENUH_BAWAAN, MAKS_BUTIR, MIN_KATA_ACUAN,
  acuanKosong, kurvaNilai, periksaAcuan, ratakanBobotButir,
  type Acuan, type ButirAcuan,
} from "@/lib/nilai-acuan";
import { acuanDariExcel, acuanDariWord, buatDocxAcuan, buatXlsxAcuan } from "@/lib/template-acuan";

// ============================================================
// DAFTAR MAHASISWA
// ============================================================

/** Peserta yang mengetik identitasnya sendiri di layar ujian. */
type PesertaLepas = { nim: string; nama: string; kelas: string; ujian: number };

const BARIS_KOSONG: BarisImpor = {
  nim: "", nama: "", email: "", prodi: "", kelas: "", angkatan: "", status: "aktif",
};

/** Medan teks pada formulir tambah/ubah. Status punya pemilihnya sendiri. */
const MEDAN: Array<{ kunci: "nim" | "nama" | "email" | "prodi" | "kelas" | "angkatan"; label: string; contoh: string }> = [
  { kunci: "nim", label: "NIM *", contoh: "2023123456" },
  { kunci: "nama", label: "Nama *", contoh: "Andi Pratama" },
  { kunci: "email", label: "Email", contoh: "andi@kampus.ac.id" },
  { kunci: "prodi", label: "Prodi", contoh: "Ilmu Komunikasi" },
  { kunci: "kelas", label: "Kelas", contoh: "3A" },
  { kunci: "angkatan", label: "Angkatan", contoh: "2023" },
];

function keBarisImpor(m: Partial<Mahasiswa> & { nim: string; nama: string }): BarisImpor {
  return {
    nim: m.nim,
    nama: m.nama,
    email: m.email ?? "",
    prodi: m.prodi ?? "",
    kelas: m.kelas ?? "",
    angkatan: m.angkatan ?? "",
    status: (STATUS_MAHASISWA as readonly string[]).includes(m.status ?? "")
      ? (m.status as BarisImpor["status"])
      : "aktif",
  };
}

/** Excel atau CSV. Pustakanya dimuat saat dipakai, bukan saat panel dibuka. */
async function bacaLembar(berkas: File) {
  const XLSX = await import("xlsx");
  const kerja = XLSX.read(await berkas.arrayBuffer(), { type: "array" });
  const lembar = kerja.Sheets[kerja.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(lembar, { header: 1, raw: true, defval: "" }) as Aoa;
  return bacaImporMahasiswa(aoa);
}

/**
 * Word (.docx).
 *
 * Daftar mahasiswa di Word hampir selalu berupa TABEL, jadi tabelnya yang
 * dicari lebih dulu — tabel terpanjang, karena kop surat dan kolom tanda
 * tangan juga tabel. Baru kalau tidak ada satu pun tabel, isinya dibaca
 * sebagai teks baris demi baris lewat pembaca tempelan yang sudah ada.
 *
 * .doc lama (bukan .docx) tidak dapat dibaca pustaka mana pun di peramban;
 * yang terjadi adalah galat, dan pesannya menyebut hal itu.
 */
async function bacaWord(berkas: File) {
  const mammoth = await import("mammoth");
  const arrayBuffer = await berkas.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
  const dok = new DOMParser().parseFromString(html, "text/html");

  let terpanjang: Aoa = [];
  for (const tabel of Array.from(dok.querySelectorAll("table"))) {
    const aoa: Aoa = Array.from(tabel.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.querySelectorAll("th, td")).map((sel) => (sel.textContent || "").trim()),
    );
    if (aoa.length > terpanjang.length) terpanjang = aoa;
  }
  if (terpanjang.length > 0) return bacaImporMahasiswa(terpanjang);

  const { value: teks } = await mammoth.extractRawText({ arrayBuffer });
  return bacaTempelMahasiswa(teks);
}

export function PanelMahasiswa({ bolehKelola: awal }: { bolehKelola: boolean }) {
  /**
   * Hak kelola datang dari SERVER, bukan ditebak dari role di peramban.
   *
   * Tebakannya dulu meleset: panel dipanggil dengan `pemantau` — benar hanya
   * untuk admin — sehingga pengajar melihat daftar tanpa satu pun tombol
   * impor. Nilai dari prop dipakai sampai jawaban pertama datang, supaya
   * tombolnya tidak berkedip muncul-hilang.
   */
  const [bolehKelola, setBolehKelola] = useState(awal);
  const [daftar, setDaftar] = useState<Mahasiswa[]>([]);
  const [jumlah, setJumlah] = useState(0);
  const [cari, setCari] = useState("");
  const [muat, setMuat] = useState(true);
  const [kabar, setKabar] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const [pratinjau, setPratinjau] = useState<BarisImpor[]>([]);
  const [tolak, setTolak] = useState<Array<{ baris: string; alasan: string }>>([]);
  const [tempel, setTempel] = useState("");
  const [bukaTempel, setBukaTempel] = useState(false);

  /**
   * Satu formulir untuk dua pekerjaan: menambah baris baru dan mengubah baris
   * yang sudah ada. `id` null berarti baru.
   *
   * Digabung karena medannya persis sama, dan dua formulir dengan medan yang
   * sama adalah dua tempat yang harus diubah setiap kali satu kolom bertambah.
   */
  const [isian, setIsian] = useState<{ id: number | null; baris: BarisImpor } | null>(null);

  /** Peserta yang mengisi identitasnya sendiri di layar ujian. */
  const [pesertaLepas, setPesertaLepas] = useState<PesertaLepas[]>([]);
  const [pilihLepas, setPilihLepas] = useState<string[]>([]);
  const [bukaLepas, setBukaLepas] = useState(false);
  /** Daftar tetapnya kosong, tetapi ada yang sudah ikut ujian. */
  const kosongTapiAdaPeserta = jumlah === 0 && pesertaLepas.length > 0;

  const muatDaftar = useCallback(async (q: string) => {
    setMuat(true);
    try {
      const jawab = await fetch(`/api/cbt/mahasiswa?daftar=1&q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Gagal memuat.");
      setDaftar(data.mahasiswa || []);
      setJumlah(data.jumlah || 0);
      if (typeof data.bolehKelola === "boolean") setBolehKelola(data.bolehKelola);
      setGalat("");
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Daftar mahasiswa gagal dimuat.");
    } finally {
      setMuat(false);
    }
  }, []);

  /** Peserta ujian yang nomornya belum ada di daftar. */
  const muatLepas = useCallback(async () => {
    try {
      const jawab = await fetch("/api/cbt/mahasiswa?peserta=1", { cache: "no-store" });
      const data = await jawab.json();
      if (jawab.ok && data.success) setPesertaLepas(data.peserta || []);
    } catch {
      // Didiamkan: bagian ini tambahan, dan panelnya tetap berguna tanpanya.
    }
  }, []);

  // Ketikan ditahan sebentar. Daftar lima ribu baris tidak perlu dicari ulang
  // pada tiap huruf, dan yang mengetiknya sedang mencari satu nama.
  useEffect(() => {
    const jam = setTimeout(() => void muatDaftar(cari.trim()), 260);
    return () => clearTimeout(jam);
  }, [cari, muatDaftar]);

  // Ditunda satu tick, sama seperti pemuat lain di panel ini: memanggilnya
  // langsung di badan effect memicu gambar bertingkat.
  useEffect(() => {
    if (!bolehKelola) return;
    const jam = setTimeout(() => void muatLepas(), 0);
    return () => clearTimeout(jam);
  }, [bolehKelola, muatLepas]);

  async function bacaBerkas(berkas: File) {
    setGalat(""); setKabar("");
    const word = /\.docx?$/i.test(berkas.name);
    try {
      const hasil = word ? await bacaWord(berkas) : await bacaLembar(berkas);
      setPratinjau(hasil.baris);
      setTolak(hasil.tolak);
      if (hasil.baris.length === 0) setGalat("Tidak ada baris yang dapat dipakai dari berkas itu.");
    } catch {
      setGalat(
        word
          ? "Berkas Word itu tidak dapat dibaca. Pastikan berupa .docx, bukan .doc lama."
          : "Berkasnya tidak dapat dibaca. Pastikan berupa Excel (.xlsx) atau CSV.",
      );
    }
  }

  function bacaTempelan() {
    const hasil = bacaTempelMahasiswa(tempel);
    setPratinjau(hasil.baris);
    setTolak(hasil.tolak);
    if (hasil.baris.length === 0) setGalat("Tidak ada baris yang dapat dipakai dari tempelan itu.");
    else setGalat("");
  }

  /** Kirim sekumpulan baris lewat jalur impor. Dipakai tiga tombol. */
  async function simpanBaris(baris: BarisImpor[], sesudah: string) {
    if (baris.length === 0) return false;
    setSibuk(true); setGalat(""); setKabar("");
    try {
      const jawab = await fetch("/api/cbt/mahasiswa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baris }),
      });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Gagal menyimpan.");
      setKabar(sesudah.replace("{n}", String(data.tersimpan)));
      await muatDaftar(cari.trim());
      await muatLepas();
      return true;
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Daftar gagal disimpan.");
      return false;
    } finally {
      setSibuk(false);
    }
  }

  async function simpanImpor() {
    if (await simpanBaris(pratinjau, "{n} mahasiswa tersimpan.")) {
      setPratinjau([]); setTolak([]); setTempel(""); setBukaTempel(false);
    }
  }

  async function simpanIsian() {
    if (!isian) return;
    // Baris baru lewat jalur impor — ia menggabungkan berdasarkan nomor induk,
    // jadi nomor yang ternyata sudah ada diperbarui, bukan ditolak.
    if (isian.id === null) {
      if (await simpanBaris([isian.baris], "{n} baris tersimpan.")) setIsian(null);
      return;
    }
    setSibuk(true); setGalat(""); setKabar("");
    try {
      const jawab = await fetch("/api/cbt/mahasiswa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: isian.id, ...isian.baris }),
      });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Gagal menyimpan.");
      setKabar("Perubahan tersimpan.");
      setIsian(null);
      await muatDaftar(cari.trim());
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Perubahan gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function tambahLepas() {
    const dipilih = pesertaLepas.filter((p) => pilihLepas.includes(p.nim));
    if (await simpanBaris(dipilih.map(keBarisImpor), "{n} peserta masuk ke daftar.")) {
      setPilihLepas([]);
    }
  }

  async function hapus(m: Mahasiswa) {
    if (!window.confirm(`Hapus ${m.nama} (${m.nim}) dari daftar mahasiswa?`)) return;
    try {
      const jawab = await fetch(`/api/cbt/mahasiswa?id=${m.id}`, { method: "DELETE" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Gagal menghapus.");
      await muatDaftar(cari.trim());
      await muatLepas();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Baris gagal dihapus.");
    }
  }

  return (
    <div className="cbtv-mhs">
      <div className="panel cbt-kepala">
        <div>
          <b>Daftar mahasiswa</b>
          <span>Tersimpan sampai dihapus. Boleh dibiarkan kosong.</span>
        </div>
        <span className="cbtv-jumlah">{jumlah} orang</span>
      </div>

      {kabar && <div className="dsh-ok">{kabar}</div>}
      {galat && <div className="dsh-error">{galat}</div>}

      {bolehKelola && (
        <div className="panel cbt-form">
          <div className="cbtv-impor">
            <label className="btn btn-light btn-mini cbtv-berkas">
              📄 Excel/CSV
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void bacaBerkas(f); e.target.value = ""; }}
              />
            </label>
            <label className="btn btn-light btn-mini cbtv-berkas">
              📝 Word
              <input
                type="file"
                accept=".docx"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void bacaBerkas(f); e.target.value = ""; }}
              />
            </label>
            <button type="button" className="btn btn-light btn-mini" onClick={() => setBukaTempel((b) => !b)}>
              📋 Tempel
            </button>
            <button
              type="button"
              className="btn btn-light btn-mini"
              onClick={() => setIsian({ id: null, baris: { ...BARIS_KOSONG } })}
            >
              ✎ Tambah manual
            </button>
            <span className="cbt-catatan cbtv-impor-bantu">
              Kolom: NIM, Nama, Email, Prodi, Kelas, Angkatan, Status. Nomor yang sudah ada diperbarui.
            </span>
          </div>

          {bukaTempel && (
            <div className="cbtv-tempel">
              <textarea
                rows={6}
                value={tempel}
                onChange={(e) => setTempel(e.target.value)}
                placeholder={"2023123456\tAndi Pratama\tandi@kampus.ac.id\n2023123457\tBudi Santoso\tbudi@kampus.ac.id"}
              />
              <button type="button" className="btn btn-light btn-mini" onClick={bacaTempelan}>
                Baca tempelan
              </button>
            </div>
          )}

          {isian && (
            <div className="cbtv-isian">
              <b>{isian.id === null ? "Tambah mahasiswa" : "Ubah data"}</b>
              <div className="cbtv-isian-baris">
                {MEDAN.map((m) => (
                  <label key={m.kunci}>
                    <span>{m.label}</span>
                    <input
                      value={isian.baris[m.kunci]}
                      onChange={(e) => setIsian({ ...isian, baris: { ...isian.baris, [m.kunci]: e.target.value } })}
                      placeholder={m.contoh}
                    />
                  </label>
                ))}
                <label>
                  <span>Status</span>
                  <select
                    value={isian.baris.status}
                    onChange={(e) => setIsian({ ...isian, baris: { ...isian.baris, status: e.target.value as BarisImpor["status"] } })}
                  >
                    {STATUS_MAHASISWA.map((st) => (
                      <option key={st} value={st}>{STATUS_MAHASISWA_LABEL[st]}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="cbtv-pratinjau-tombol">
                <button type="button" className="btn btn-primary btn-mini" disabled={sibuk} onClick={() => void simpanIsian()}>
                  {sibuk ? "Menyimpan…" : "Simpan"}
                </button>
                <button type="button" className="btn btn-light btn-mini" onClick={() => setIsian(null)}>Batal</button>
              </div>
            </div>
          )}

          {pratinjau.length > 0 && (
            <div className="cbtv-pratinjau">
              <b>{pratinjau.length} baris siap disimpan</b>
              <ul>
                {pratinjau.slice(0, 8).map((b) => (
                  <li key={b.nim}><code>{b.nim}</code> {b.nama}{b.email ? ` · ${b.email}` : ""}</li>
                ))}
              </ul>
              {pratinjau.length > 8 && <p className="cbt-catatan">…dan {pratinjau.length - 8} baris lagi.</p>}
              <div className="cbtv-pratinjau-tombol">
                <button type="button" className="btn btn-primary btn-mini" disabled={sibuk} onClick={() => void simpanImpor()}>
                  {sibuk ? "Menyimpan…" : `Simpan ${pratinjau.length} baris`}
                </button>
                <button type="button" className="btn btn-light btn-mini" onClick={() => { setPratinjau([]); setTolak([]); }}>
                  Batal
                </button>
              </div>
            </div>
          )}

          {tolak.length > 0 && (
            <div className="dsh-note cbtv-tolak">
              <b>{tolak.length} baris dilewati</b>
              <ul>{tolak.slice(0, 6).map((t, i) => <li key={i}>{t.baris}: {t.alasan}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {/* ---------- PESERTA YANG MENGISI SENDIRI ----------
          Portal yang belum pernah mengimpor satu baris pun tetap mengumpulkan
          nama dan nomor: peserta mengetiknya sendiri di layar ujian. Di sinilah
          keduanya bertemu — satu ketukan memindahkan yang sudah terbukti ikut
          ujian ke daftar tetap. */}
      {bolehKelola && pesertaLepas.length > 0 && (
        <div className="panel cbtv-lepas">
          <button
            type="button"
            className="cbt-lipat"
            aria-expanded={bukaLepas || kosongTapiAdaPeserta}
            onClick={() => setBukaLepas((b) => !(b || kosongTapiAdaPeserta))}
          >
            <b>Dari peserta ujian ({pesertaLepas.length})</b>
            <span>{bukaLepas || kosongTapiAdaPeserta ? "▲ Sembunyikan" : "▼ Lihat"}</span>
          </button>
          {(bukaLepas || kosongTapiAdaPeserta) && (
            <div className="cbt-lipat-isi">
              <ul className="cbtv-lepas-daftar">
                {pesertaLepas.map((p) => (
                  <li key={p.nim}>
                    <label>
                      <input
                        type="checkbox"
                        checked={pilihLepas.includes(p.nim)}
                        onChange={(e) =>
                          setPilihLepas((kini) =>
                            e.target.checked ? [...kini, p.nim] : kini.filter((n) => n !== p.nim),
                          )
                        }
                      />
                      <code>{p.nim}</code>
                      <b>{p.nama}</b>
                      {p.kelas && <i>{p.kelas}</i>}
                      <small>{p.ujian} ujian</small>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="cbtv-pratinjau-tombol">
                <button
                  type="button"
                  className="btn btn-primary btn-mini"
                  disabled={sibuk || pilihLepas.length === 0}
                  onClick={() => void tambahLepas()}
                >
                  {sibuk ? "Menyimpan…" : `Tambahkan ${pilihLepas.length || ""}`.trim()}
                </button>
                <button
                  type="button"
                  className="btn btn-light btn-mini"
                  onClick={() => setPilihLepas(pesertaLepas.map((p) => p.nim))}
                >
                  Pilih semua
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="panel">
        <input
          className="cbtv-cari"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama atau NIM…"
        />
        {muat ? (
          <div className="dempty">Memuat…</div>
        ) : daftar.length === 0 ? (
          <div className="dempty">
            {cari
              ? "Tidak ada yang cocok."
              : pesertaLepas.length > 0
                ? `Daftar tetap masih kosong. ${pesertaLepas.length} peserta sudah ikut ujian, tambahkan dari kotak di atas.`
                : "Belum ada peserta. Impor dari Excel, Word, tempelan, atau tambah manual di atas."}
          </div>
        ) : (
          <table className="dsh-table cbtv-tabel">
            <thead>
              <tr><th>NIM</th><th>Nama</th><th>Email</th><th>Kelas</th><th>Status</th>{bolehKelola && <th />}</tr>
            </thead>
            <tbody>
              {daftar.map((m) => (
                <tr key={m.id}>
                  <td><code>{m.nim}</code></td>
                  <td>{m.nama}</td>
                  <td className="cbtv-email">{m.email || <i>-</i>}</td>
                  <td>{m.kelas || "-"}</td>
                  <td>{STATUS_MAHASISWA_LABEL[m.status as (typeof STATUS_MAHASISWA)[number]] ?? m.status}</td>
                  {bolehKelola && (
                    <td className="cbtv-aksi-baris">
                      <button
                        type="button"
                        className="btn btn-light btn-mini"
                        onClick={() => setIsian({ id: m.id, baris: keBarisImpor(m) })}
                      >
                        Ubah
                      </button>
                      <button type="button" className="btn btn-light btn-mini" onClick={() => void hapus(m)}>Hapus</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {daftar.length >= 200 && (
          <p className="cbt-catatan">Ditampilkan 200 pertama. Pakai kotak cari.</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// RUBRIK
// ============================================================

export type RubrikRingkas = {
  id: number;
  nama: string;
  keterangan: string;
  skalaMin: number;
  skalaMax: number;
  kriteria: KriteriaRubrik[];
  pemilik: string;
  milikSaya: boolean;
  bolehSunting: boolean;
  dipakai: number;
};

export function PanelRubrik() {
  const [daftar, setDaftar] = useState<RubrikRingkas[]>([]);
  const [muat, setMuat] = useState(true);
  const [kabar, setKabar] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  /** Rubrik yang sedang disunting. null berarti tidak ada formulir terbuka. */
  const [susun, setSusun] = useState<{ id: number | null; isi: Rubrik } | null>(null);

  /**
   * Hal yang ditebak atau dibetulkan pembaca template, ditampilkan bersama
   * formulirnya.
   *
   * Dipisahkan dari `kabar` karena keduanya berbeda umur: kabar hilang begitu
   * ada tindakan berikutnya, sedangkan catatan ini harus bertahan selama
   * formulirnya terbuka — ia satu-satunya tempat dosen dapat melihat bahwa
   * bobotnya dibagi rata, bukan ia yang menuliskannya.
   */
  const [catatan, setCatatan] = useState<string[]>([]);
  const [namaBerkas, setNamaBerkas] = useState("");

  const muatDaftar = useCallback(async () => {
    setMuat(true);
    try {
      const jawab = await fetch("/api/cbt/rubrik", { cache: "no-store" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Gagal memuat.");
      setDaftar(data.rubrik || []);
      setGalat("");
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Daftar rubrik gagal dimuat.");
    } finally {
      setMuat(false);
    }
  }, []);

  // Ditunda satu putaran, bukan dipanggil langsung di badan efek.
  // Pemuat ini menyetel state pada baris pertamanya (setMuat(true)), dan
  // menyetel state serentak di dalam efek memicu gambar ulang berantai.
  // Pola yang sama dipakai panel CBT sejak awal.
  useEffect(() => {
    const tunda = window.setTimeout(() => void muatDaftar(), 0);
    return () => window.clearTimeout(tunda);
  }, [muatDaftar]);

  async function simpan() {
    if (!susun) return;
    const periksa = periksaRubrik(susun.isi);
    if (!periksa.ok) { setGalat(periksa.pesan); return; }

    setSibuk(true); setGalat(""); setKabar("");
    try {
      const jawab = await fetch("/api/cbt/rubrik", {
        method: susun.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: susun.id ?? undefined, ...susun.isi }),
      });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Gagal menyimpan.");
      setKabar(susun.id ? "Rubrik tersimpan." : "Rubrik baru dibuat.");
      setSusun(null);
      setCatatan([]);
      setNamaBerkas("");
      await muatDaftar();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Rubrik gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function hapus(r: RubrikRingkas) {
    if (!window.confirm(`Hapus rubrik "${r.nama}"?`)) return;
    try {
      const jawab = await fetch(`/api/cbt/rubrik?id=${r.id}`, { method: "DELETE" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Gagal menghapus.");
      await muatDaftar();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Rubrik gagal dihapus.");
    }
  }

  function unduh(isi: Blob, nama: string) {
    const alamat = URL.createObjectURL(isi);
    const tautan = document.createElement("a");
    tautan.href = alamat;
    tautan.download = nama;
    tautan.click();
    URL.revokeObjectURL(alamat);
  }

  /** Nama berkas yang aman dipakai di seluruh sistem berkas. */
  function namaUnduhan(nama: string) {
    const bersih = nama.trim().replace(/[^A-Za-z0-9 _-]+/g, "").replace(/\s+/g, "-").slice(0, 60);
    return bersih || "Rubrik";
  }

  /**
   * Baca template rubrik yang diunggah dosen.
   *
   * Diurai DI PERAMBAN, sama seperti impor soal dan impor mahasiswa. Rubrik
   * bukan rahasia, tetapi tidak ada gunanya ia singgah di server sebelum
   * pemiliknya sendiri melihat hasil bacaannya — dan yang diurai di peramban
   * memberi jawaban seketika, tanpa satu pun perjalanan jaringan.
   *
   * Hasilnya mendarat di FORMULIR, bukan di basis data. Yang menyimpan tetap
   * dosen, dengan periksaRubrik() berlaku seperti biasa.
   */
  async function bacaBerkasRubrik(berkas: File) {
    setGalat(""); setKabar(""); setCatatan([]);
    setNamaBerkas(berkas.name);
    try {
      const nama = berkas.name.toLowerCase();
      let hasil;
      if (nama.endsWith(".docx")) {
        // Modul yang sama dipakai pengimpor soal; dimuat saat dipakai, bukan
        // saat panel dibuka.
        const mammoth = await import("mammoth");
        const teks = await mammoth.extractRawText({ arrayBuffer: await berkas.arrayBuffer() });
        hasil = imporRubrikWord(teks.value || "");
      } else if (nama.endsWith(".xlsx") || nama.endsWith(".xls") || nama.endsWith(".csv")) {
        const XLSX = await import("xlsx");
        const kerja = XLSX.read(new Uint8Array(await berkas.arrayBuffer()), { type: "array" });
        // Lembar "Rubrik" lebih dulu, bukan lembar pertama: template membawa
        // lembar "Contoh" dan "Petunjuk" di sebelahnya, dan yang aktif terakhir
        // saat berkasnya disimpan dosen bisa lembar mana pun.
        const lembar = kerja.Sheets[LEMBAR_RUBRIK] ?? kerja.Sheets[kerja.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(lembar as Parameters<typeof XLSX.utils.sheet_to_json>[0], {
          header: 1, defval: "", raw: false,
        }) as Aoa;
        hasil = imporRubrikExcel(aoa);
      } else {
        throw new Error("Berkasnya harus .xlsx, .xls, .csv, atau .docx.");
      }

      if (!hasil.ok) {
        setNamaBerkas("");
        setGalat(hasil.pesan);
        return;
      }
      // Rubrik hasil unggahan selalu masuk sebagai rubrik BARU (id null),
      // termasuk ketika namanya sama dengan yang sudah ada. Menimpa rubrik yang
      // sudah dipakai ujian hanya karena namanya cocok akan mengubah arti nilai
      // yang sudah keluar, tanpa seorang pun memintanya.
      setSusun({ id: null, isi: hasil.rubrik });
      setCatatan(hasil.catatan);
      setKabar(
        `Rubrik terbaca dari ${berkas.name}: ${hasil.rubrik.kriteria.length} kriteria, ` +
          `skala ${hasil.rubrik.skalaMin}–${hasil.rubrik.skalaMax}. Periksa lalu simpan.`,
      );
    } catch (alasan: unknown) {
      setNamaBerkas("");
      setGalat(
        alasan instanceof Error
          ? alasan.message
          : "Berkasnya tidak dapat dibaca. Pastikan berupa Excel (.xlsx) atau Word (.docx).",
      );
    }
  }

  function ubahKriteria(urut: number, ubah: Partial<KriteriaRubrik>) {
    if (!susun) return;
    const kriteria = susun.isi.kriteria.map((k, i) => (i === urut ? { ...k, ...ubah } : k));
    setSusun({ ...susun, isi: { ...susun.isi, kriteria } });
  }

  function ubahLevel(urutK: number, level: number, ubah: { deskriptor?: string; minKata?: number }) {
    if (!susun) return;
    const kriteria = susun.isi.kriteria.map((k, i) => {
      if (i !== urutK) return k;
      const levels = k.levels.map((l) => (l.level === level ? { ...l, ...ubah } : l));
      return { ...k, levels };
    });
    setSusun({ ...susun, isi: { ...susun.isi, kriteria } });
  }

  const jumlahBobot = susun ? susun.isi.kriteria.reduce((n, k) => n + k.bobot, 0) : 0;

  return (
    <div className="cbtv-rubrik">
      <div className="panel cbt-kepala">
        <div>
          <b>Rubrik penilaian esai</b>
          <span>
            Tiap level punya ambang panjang. Itu yang dipakai menilai esai otomatis saat peserta mengumpulkan.
          </span>
        </div>
        <button type="button" className="btn btn-primary btn-mini" onClick={() => setSusun({ id: null, isi: rubrikKosong() })}>
          + Susun sendiri
        </button>
      </div>

      {kabar && <div className="dsh-ok">{kabar}</div>}
      {galat && <div className="dsh-error">{galat}</div>}

      {/* ---------- CATATAN PEMBACA TEMPLATE ----------
          Tampil bersama formulirnya, bukan sekejap seperti kabar biasa: isinya
          hal-hal yang TIDAK ditulis dosen sendiri, dan yang tidak tahu bahwa
          bobotnya dibagi rata akan menyimpannya tanpa memeriksanya. */}
      {catatan.length > 0 && (
        <div className="cbtv-catatan">
          <b>Yang perlu Anda periksa{namaBerkas ? ` dari ${namaBerkas}` : ""}:</b>
          <ul>
            {catatan.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      {/* ---------- TEMPLATE: UNDUH, ISI, UNGGAH ----------
          Rubrik hampir selalu SUDAH ADA sebelum menyentuh portal — ia lampiran
          RPS, dan sudah diketik di Word atau Excel. Tanpa jalan ini, dosen
          mengetik ulang dua puluh kotak deskriptor yang sudah selesai ia tulis.

          Disembunyikan ketika formulir terbuka, supaya "unggah" tidak tampak
          seperti pilihan lain untuk isian yang sedang dikerjakan. */}
      {!susun && (
        <div className="panel cbt-impor">
          <div className="cbt-impor-kepala">
            <b>Susun rubrik lewat Excel atau Word</b>
            <span>
              Unduh template, isi di komputer, lalu unggah kembali di sini. Yang diunggah
              masuk ke formulir penyusun lebih dahulu — <b>belum tersimpan</b> — supaya
              bobot dan deskriptornya dapat Anda periksa sendiri sebelum dipakai menilai.
            </span>
          </div>

          <div className="cbt-impor-tombol">
            <button
              type="button"
              className="btn btn-light btn-mini"
              onClick={() => {
                unduh(buatXlsxRubrik(), "Template-Rubrik-SiPaling.xlsx");
                setKabar("Template Excel terunduh. Isi lembar \"Rubrik\", lalu unggah kembali di sini.");
              }}
            >
              ⇩ Template Excel (.xlsx)
            </button>
            <button
              type="button"
              className="btn btn-light btn-mini"
              onClick={() => {
                unduh(buatDocxRubrik(), "Template-Rubrik-SiPaling.docx");
                setKabar("Template Word terunduh. Ganti isi contohnya, lalu unggah kembali di sini.");
              }}
            >
              ⇩ Template Word (.docx)
            </button>
            <label className="btn btn-primary btn-mini cbt-unggah">
              ⇧ Unggah rubrik
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.docx"
                onChange={(e) => {
                  const berkas = e.target.files?.[0];
                  // Dikosongkan supaya berkas yang SAMA dapat diunggah lagi
                  // sesudah dibetulkan — tanpa ini, memilih berkas bernama sama
                  // tidak memicu apa pun dan tampak seperti tombol yang rusak.
                  e.target.value = "";
                  if (berkas) void bacaBerkasRubrik(berkas);
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* ---------- RUBRIK SIAP PAKAI ----------
          Ditaruh di ATAS daftar milik sendiri, dan itu disengaja. Dosen yang
          membuka menu ini pertama kali punya daftar kosong; yang ia lihat
          pertama harus sesuatu yang dapat langsung dipakai, bukan ruang
          kosong dengan tombol "susun sendiri" yang memakan dua puluh menit. */}
      {!susun && (
        <div className="panel">
          <b className="cbtv-sub">Siap pakai, tinggal salin</b>
          <div className="cbtv-bawaan">
            {RUBRIK_BAWAAN.map((r) => (
              <div key={r.nama} className="cbtv-bawaan-kartu">
                <b>{r.nama}</b>
                <p>{r.keterangan}</p>
                <small>
                  {r.kriteria.length} kriteria · skala {r.skalaMin}–{r.skalaMax} ·{" "}
                  {r.kriteria.map((k) => `${k.nama} ${k.bobot}%`).join(", ")}
                </small>
                <button
                  type="button"
                  className="btn btn-light btn-mini"
                  onClick={() => setSusun({ id: null, isi: JSON.parse(JSON.stringify(r)) as Rubrik })}
                >
                  Salin &amp; sesuaikan
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- FORMULIR ---------- */}
      {susun && (
        <div className="panel cbt-form cbtv-susun">
          <div className="cbt-baris">
            <label><span>Nama rubrik *</span>
              <input
                value={susun.isi.nama}
                onChange={(e) => setSusun({ ...susun, isi: { ...susun.isi, nama: e.target.value } })}
                placeholder="mis. Rubrik Esai Metodologi Penelitian"
              />
            </label>
            <label><span>Level tertinggi</span>
              <select
                value={susun.isi.skalaMax}
                onChange={(e) => {
                  const max = Number(e.target.value);
                  // Level ditambah/dikurangi pada SELURUH kriteria sekaligus.
                  // Rubrik yang satu kriterianya berskala 1–4 dan yang lain
                  // 1–5 menghasilkan nilai yang tidak dapat diterangkan
                  // kepada siapa pun.
                  const kriteria = susun.isi.kriteria.map((k) => ({
                    ...k,
                    levels: Array.from({ length: max }, (_, i) => {
                      const level = i + 1;
                      return { level, deskriptor: k.levels.find((l) => l.level === level)?.deskriptor ?? "" };
                    }),
                  }));
                  setSusun({ ...susun, isi: { ...susun.isi, skalaMax: max, kriteria } });
                }}
              >
                {[3, 4, 5, 6].map((n) => <option key={n} value={n}>1 sampai {n}</option>)}
              </select>
            </label>
          </div>

          <label className="cbt-lebar"><span>Keterangan singkat</span>
            <input
              value={susun.isi.keterangan}
              onChange={(e) => setSusun({ ...susun, isi: { ...susun.isi, keterangan: e.target.value } })}
              placeholder="Untuk apa rubrik ini dipakai"
            />
          </label>

          <div className="cbtv-bobot-kabar">
            Jumlah bobot: <b className={jumlahBobot === 100 ? "ok" : "salah"}>{jumlahBobot}%</b>
            {jumlahBobot !== 100 && <>, harus tepat 100%.</>}
            <button
              type="button"
              className="btn btn-light btn-mini"
              onClick={() => {
                const rata = ratakanBobot(susun.isi.kriteria.length);
                setSusun({
                  ...susun,
                  isi: { ...susun.isi, kriteria: susun.isi.kriteria.map((k, i) => ({ ...k, bobot: rata[i] })) },
                });
              }}
            >
              Ratakan
            </button>
          </div>

          {susun.isi.kriteria.map((k, urut) => (
            <div key={urut} className="cbtv-kriteria">
              <div className="cbt-baris">
                <label><span>Kriteria {urut + 1}</span>
                  <input value={k.nama} onChange={(e) => ubahKriteria(urut, { nama: e.target.value })} placeholder="mis. Ketepatan Konsep" />
                </label>
                <label className="cbtv-bobot"><span>Bobot %</span>
                  <input
                    type="number" min={0} max={100} value={k.bobot}
                    onChange={(e) => ubahKriteria(urut, { bobot: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-light btn-mini cbtv-buang"
                  onClick={() => setSusun({ ...susun, isi: { ...susun.isi, kriteria: susun.isi.kriteria.filter((_, i) => i !== urut) } })}
                >
                  Buang
                </button>
              </div>
              {k.levels.map((l) => (
                <div key={l.level} className="cbt-lebar cbtv-level">
                  <div className="cbtv-level-kepala">
                    <span>Level {l.level}</span>
                    {/* Angka inilah yang membuat esai dapat ternilai sampai
                        selesai tanpa satu ketukan pun: tangga yang ditetapkan
                        sebelum ujian dan berlaku sama untuk semua peserta. */}
                    <label className="cbtv-ambang-kata">
                      <span>mulai</span>
                      <input
                        type="number" min={0} max={5000} value={l.minKata ?? 0}
                        onChange={(e) => ubahLevel(urut, l.level, { minKata: Number(e.target.value) })}
                      />
                      <span>kata</span>
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    value={l.deskriptor}
                    onChange={(e) => ubahLevel(urut, l.level, { deskriptor: e.target.value })}
                    placeholder={`Apa yang membuat sebuah jawaban berada di level ${l.level}`}
                  />
                </div>
              ))}
            </div>
          ))}

          <div className="cbtv-susun-tombol">
            <button
              type="button"
              className="btn btn-light btn-mini"
              disabled={susun.isi.kriteria.length >= MAKS_KRITERIA}
              onClick={() =>
                setSusun({
                  ...susun,
                  isi: {
                    ...susun.isi,
                    kriteria: [
                      ...susun.isi.kriteria,
                      {
                        nama: "",
                        bobot: 0,
                        levels: Array.from({ length: susun.isi.skalaMax }, (_, i) => ({ level: i + 1, deskriptor: "" })),
                      },
                    ],
                  },
                })
              }
            >
              + Tambah kriteria
            </button>
            <button type="button" className="btn btn-primary btn-mini" disabled={sibuk} onClick={() => void simpan()}>
              {sibuk ? "Menyimpan…" : "Simpan rubrik"}
            </button>
            <button
              type="button"
              className="btn btn-light btn-mini"
              onClick={() => { setSusun(null); setCatatan([]); setNamaBerkas(""); }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ---------- RUBRIK YANG SUDAH ADA ---------- */}
      {!susun && (
        <div className="panel">
          <b className="cbtv-sub">Rubrik di portal ini</b>
          {muat ? (
            <div className="dempty">Memuat…</div>
          ) : daftar.length === 0 ? (
            <div className="dempty">Belum ada rubrik tersimpan. Salin salah satu yang siap pakai di atas.</div>
          ) : (
            <ul className="cbtv-daftar-rubrik">
              {daftar.map((r) => (
                <li key={r.id}>
                  <div>
                    <b>{r.nama}</b>
                    <small>
                      {r.kriteria.length} kriteria · skala {r.skalaMin}–{r.skalaMax} · oleh {r.pemilik}
                      {r.dipakai > 0 && ` · dipakai ${r.dipakai} ujian`}
                    </small>
                  </div>
                  <span className="cbtv-aksi-rubrik">
                    {r.bolehSunting && (
                      <button
                        type="button" className="btn btn-light btn-mini"
                        onClick={() => setSusun({
                          id: r.id,
                          isi: { nama: r.nama, keterangan: r.keterangan, skalaMin: r.skalaMin, skalaMax: r.skalaMax, kriteria: r.kriteria },
                        })}
                      >
                        Sunting
                      </button>
                    )}
                    <button
                      type="button" className="btn btn-light btn-mini"
                      onClick={() => setSusun({
                        id: null,
                        isi: { nama: `${r.nama} (salinan)`, keterangan: r.keterangan, skalaMin: r.skalaMin, skalaMax: r.skalaMax, kriteria: JSON.parse(JSON.stringify(r.kriteria)) },
                      })}
                    >
                      Salin
                    </button>
                    {/* Unduhan berbentuk template yang sama, jadi berkasnya dapat
                        disunting di komputer atau dikirim ke rekan pengajar lewat
                        surel, lalu diunggah kembali tanpa mengetik ulang apa pun. */}
                    <button
                      type="button" className="btn btn-light btn-mini"
                      title="Unduh sebagai template Excel — boleh disunting lalu diunggah kembali"
                      onClick={() => {
                        unduh(
                          buatXlsxDariRubrik({
                            nama: r.nama, keterangan: r.keterangan,
                            skalaMin: r.skalaMin, skalaMax: r.skalaMax, kriteria: r.kriteria,
                          }),
                          `Rubrik-${namaUnduhan(r.nama)}.xlsx`,
                        );
                        setKabar(`"${r.nama}" terunduh sebagai Excel.`);
                      }}
                    >
                      ⇩ Excel
                    </button>
                    {r.bolehSunting && (
                      <button type="button" className="btn btn-light btn-mini" onClick={() => void hapus(r)}>Hapus</button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// PENILAIAN ESAI: DUA CARA, SATU MENU
//
// Jawaban acuan dan rubrik mengukur hal yang BERBEDA, dan itulah sebabnya
// keduanya ada berdampingan alih-alih yang satu menggantikan yang lain:
//
//   jawaban acuan   mengukur ISI    apakah yang dibicarakan peserta sama
//                                   dengan yang dibicarakan dosen
//   rubrik          mengukur BENTUK panjangnya, susunannya, berapa istilah
//                                   soal yang muncul
//
// Jawaban acuan didahulukan dan menjadi bawaannya. Ia menjawab pertanyaan
// yang sebenarnya ditanyakan dosen ketika menilai esai, dan rubrik tidak
// pernah dapat menjawabnya betapa pun rapi deskriptornya disusun.
//
// Rubrik tidak dihapus, dan itu bukan keraguan. Ujian yang sudah dinilai
// dengan rubrik masih menyimpan skor per kriterianya, dan lembar penilaian
// ujian-ujian itu harus tetap dapat dibuka bertahun-tahun kemudian ketika ada
// yang menggugat nilainya. Menghapus rubrik berarti menghapus jawaban atas
// gugatan itu.
// ============================================================

export function PanelPenilaianEsai() {
  /** Jawaban acuan lebih dulu, karena itulah yang dianjurkan sekarang. */
  const [cara, setCara] = useState<"acuan" | "rubrik">("acuan");

  return (
    <div className="cbtv-penilaian">
      <div className="cbt-tab cbtv-cara">
        <button type="button" className={cara === "acuan" ? "on" : ""} onClick={() => setCara("acuan")}>
          Jawaban acuan
        </button>
        <button type="button" className={cara === "rubrik" ? "on" : ""} onClick={() => setCara("rubrik")}>
          Rubrik
        </button>
      </div>

      <p className="cbtv-cara-baca">
        {cara === "acuan"
          ? "Mengukur ISI jawaban: seberapa dekat yang ditulis peserta dengan jawaban acuan Anda. Dianjurkan."
          : "Mengukur BENTUK jawaban: panjang, susunan, dan istilah soal yang muncul. Tidak tahu apakah isinya benar."}
      </p>

      {cara === "acuan" ? <PanelAcuan /> : <PanelRubrik />}
    </div>
  );
}

// ============================================================
// KUNCI JAWABAN ACUAN DOSEN
//
// Susunan layarnya sengaja meniru impor soal, sampai ke letak tombolnya:
// unduh template, isi di komputer, unggah sekali. Dosen yang pernah mengimpor
// soal sudah tahu cara memakai panel ini sebelum membacanya.
//
// Ada juga jalan menyusun langsung di layar, dan ia ditaruh SESUDAH jalur
// berkas, bukan sebelumnya. Yang butirnya tiga memang lebih cepat mengetik di
// sini; yang butirnya dua puluh akan menyesal di butir ketujuh belas.
// ============================================================

export type AcuanRingkas = {
  id: number;
  nama: string;
  keterangan: string;
  ambangNol: number;
  ambangPenuh: number;
  butir: ButirAcuan[];
  pemilik: string;
  milikSaya: boolean;
  bolehSunting: boolean;
  dipakai: number;
};

/** Berapa kata sebuah jawaban acuan, dihitung kasar untuk ditampilkan. */
function jumlahKata(teks: string) {
  return teks.trim() ? teks.trim().split(/\s+/).length : 0;
}

export function PanelAcuan() {
  const [daftar, setDaftar] = useState<AcuanRingkas[]>([]);
  const [muat, setMuat] = useState(true);
  const [kabar, setKabar] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  /** Acuan yang sedang disunting. null berarti tidak ada formulir terbuka. */
  const [susun, setSusun] = useState<{ id: number | null; isi: Acuan } | null>(null);

  /** Baris yang ditolak pembaca berkas, ditahan untuk diperlihatkan. */
  const [tolak, setTolak] = useState<Array<{ baris: string; alasan: string }>>([]);
  const [namaBerkas, setNamaBerkas] = useState("");
  const [membaca, setMembaca] = useState(false);

  const muatDaftar = useCallback(async () => {
    setMuat(true);
    try {
      const jawab = await fetch("/api/cbt/acuan", { cache: "no-store" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Gagal memuat.");
      setDaftar(data.acuan || []);
      setGalat("");
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Daftar jawaban acuan gagal dimuat.");
    } finally {
      setMuat(false);
    }
  }, []);

  // Ditunda satu putaran, sama seperti PanelRubrik di atas: pemuat ini
  // menyetel state pada baris pertamanya, dan menyetel state serentak di dalam
  // efek memicu gambar ulang berantai.
  useEffect(() => {
    const tunda = window.setTimeout(() => void muatDaftar(), 0);
    return () => window.clearTimeout(tunda);
  }, [muatDaftar]);

  function unduh(berkas: Blob, nama: string) {
    const url = URL.createObjectURL(berkas);
    const tautan = document.createElement("a");
    tautan.href = url;
    tautan.download = nama;
    tautan.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Baca berkas acuan yang diunggah.
   *
   * Seluruhnya diurai DI PERAMBAN, sama seperti pengimpor soal. Berkas Word
   * dan Excel dosen tidak perlu singgah di server hanya untuk dibaca, dan yang
   * tidak singgah tidak dapat tertinggal di sana.
   */
  async function bacaBerkas(berkas: File) {
    setMembaca(true);
    setGalat("");
    setKabar("");
    setNamaBerkas(berkas.name);
    try {
      let hasil: { butir: ButirAcuan[]; tolak: Array<{ baris: string; alasan: string }> };
      if (/\.docx?$/i.test(berkas.name)) {
        const mammoth = await import("mammoth");
        const dibaca = await mammoth.convertToHtml({ arrayBuffer: await berkas.arrayBuffer() });
        hasil = acuanDariWord(dibaca.value || "");
      } else {
        const XLSX = await import("xlsx");
        const buku = XLSX.read(await berkas.arrayBuffer(), { type: "array" });
        const lembar = buku.Sheets[buku.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(lembar, { header: 1, raw: false, defval: "" }) as Aoa;
        hasil = acuanDariExcel(aoa);
      }

      setTolak(hasil.tolak);
      if (hasil.butir.length === 0) {
        setGalat(hasil.tolak[0]?.alasan || "Tidak ada butir yang terbaca dari berkas ini.");
        return;
      }

      // Berkas yang terbaca langsung membuka formulir, bukan sekadar menjadi
      // pratinjau yang masih harus ditekan sekali lagi. Yang baru saja
      // mengunggah berkas bermaksud menyimpannya; nama acuannya yang masih
      // perlu ia ketik, dan itulah satu-satunya yang diminta di sini.
      setSusun({
        id: null,
        isi: {
          nama: berkas.name.replace(/\.(xlsx|xls|csv|docx?)$/i, "").slice(0, 160),
          keterangan: "",
          ambangNol: AMBANG_NOL_BAWAAN,
          ambangPenuh: AMBANG_PENUH_BAWAAN,
          butir: hasil.butir,
        },
      });
      setKabar(`${hasil.butir.length} jawaban acuan terbaca dari ${berkas.name}. Periksa lalu simpan.`);
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Berkas belum dapat dibaca.");
    } finally {
      setMembaca(false);
    }
  }

  async function simpan() {
    if (!susun) return;
    const periksa = periksaAcuan(susun.isi);
    if (!periksa.ok) { setGalat(periksa.pesan); return; }

    setSibuk(true); setGalat(""); setKabar("");
    try {
      const jawab = await fetch("/api/cbt/acuan", {
        method: susun.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: susun.id ?? undefined, ...susun.isi }),
      });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Gagal menyimpan.");
      setKabar(
        susun.id
          ? data.dipakai > 0
            ? `Acuan tersimpan. Ia dipakai ${data.dipakai} ujian; nilai yang sudah keluar dihitung dengan acuan versi lama sampai penilaiannya dijalankan lagi.`
            : "Acuan tersimpan."
          : "Acuan baru tersimpan.",
      );
      setSusun(null);
      setTolak([]);
      setNamaBerkas("");
      await muatDaftar();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Acuan gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function hapus(a: AcuanRingkas) {
    if (!window.confirm(`Hapus jawaban acuan "${a.nama}"?`)) return;
    try {
      const jawab = await fetch(`/api/cbt/acuan?id=${a.id}`, { method: "DELETE" });
      const data = await jawab.json();
      if (!jawab.ok || !data.success) throw new Error(data.message || "Gagal menghapus.");
      await muatDaftar();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Acuan gagal dihapus.");
    }
  }

  function ubahButir(urut: number, ubah: Partial<ButirAcuan>) {
    if (!susun) return;
    const butir = susun.isi.butir.map((b, i) => (i === urut ? { ...b, ...ubah } : b));
    setSusun({ ...susun, isi: { ...susun.isi, butir } });
  }

  const jumlahBobot = susun ? susun.isi.butir.reduce((n, b) => n + b.bobot, 0) : 0;

  return (
    <div className="cbtv-acuan">
      <div className="panel cbt-kepala">
        <div>
          <b>Kunci jawaban acuan Dosen / Pengajar</b>
          <span>
            Jawaban peserta dinilai dari kedekatannya dengan jawaban acuan Anda, memakai cosine
            similarity atas bobot kata TF-IDF. Parafrase yang benar tetap bernilai tinggi;
            jawaban panjang di luar topik tidak terbantu oleh panjangnya.
          </span>
        </div>
        <button
          type="button"
          className="btn btn-light btn-mini"
          onClick={() => { setSusun({ id: null, isi: acuanKosong() }); setTolak([]); setNamaBerkas(""); }}
        >
          + Susun di layar
        </button>
      </div>

      {kabar && <div className="dsh-ok">{kabar}</div>}
      {galat && <div className="dsh-error">{galat}</div>}

      {/* ---------- UNDUH, ISI, UNGGAH ----------
          Tombolnya memakai kelas yang sama persis dengan impor soal, sehingga
          keduanya tidak dapat berselisih rupa ketika salah satunya diubah. */}
      {!susun && (
        <div className="panel cbt-impor">
          <div className="cbt-impor-kepala">
            <b>Isi lewat Excel atau Word</b>
            <span>
              Unduh template, tulis jawaban acuan di komputer, unggah sekali untuk seluruh butir.
              Excel untuk butir yang banyak; Word untuk jawaban berupa paragraf.
            </span>
          </div>

          <div className="cbt-impor-tombol">
            <button
              type="button"
              className="btn btn-light"
              onClick={() => unduh(buatXlsxAcuan(), "template-jawaban-acuan.xlsx")}
            >
              &#8681; Template Excel (.xlsx)
            </button>
            <button
              type="button"
              className="btn btn-light"
              onClick={() => unduh(buatDocxAcuan(), "template-jawaban-acuan.docx")}
            >
              &#8681; Template Word (.docx)
            </button>
            <label className={`btn btn-primary cbt-unggah ${membaca ? "mati" : ""}`}>
              {membaca ? "Membaca…" : "⇧ Unggah acuan"}
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.docx"
                disabled={membaca}
                onChange={(e) => {
                  const berkas = e.target.files?.[0];
                  e.target.value = "";
                  if (berkas) void bacaBerkas(berkas);
                }}
              />
            </label>
          </div>

          {tolak.length > 0 && (
            <div className="cbt-impor-hasil">
              <div className="cbt-impor-angka">
                <span className="cbt-impor-gagal"><b>{tolak.length}</b> baris perlu diperbaiki</span>
                {namaBerkas && <span className="cbt-impor-nama">{namaBerkas}</span>}
              </div>
              <ul className="cbt-impor-tolak">
                {tolak.slice(0, 8).map((t, i) => <li key={i}><b>{t.baris}</b>: {t.alasan}</li>)}
                {tolak.length > 8 && <li>…dan {tolak.length - 8} lagi.</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ---------- FORMULIR ---------- */}
      {susun && (
        <div className="panel cbt-form cbtv-susun">
          <div className="cbt-baris">
            <label><span>Nama acuan *</span>
              <input
                value={susun.isi.nama}
                onChange={(e) => setSusun({ ...susun, isi: { ...susun.isi, nama: e.target.value } })}
                placeholder="mis. Acuan UAS Komunikasi Massa"
              />
            </label>
          </div>

          <label className="cbt-lebar"><span>Keterangan singkat</span>
            <input
              value={susun.isi.keterangan}
              onChange={(e) => setSusun({ ...susun, isi: { ...susun.isi, keterangan: e.target.value } })}
              placeholder="Untuk mata kuliah dan semester apa acuan ini dipakai"
            />
          </label>

          {/* ---------- DUA AMBANG ----------
              Ditaruh di atas daftar butir, bukan disembunyikan di bawahnya:
              keduanya berlaku untuk SELURUH butir, dan yang mengubahnya perlu
              melihat akibatnya sebelum mengetik dua puluh jawaban acuan. */}
          <div className="cbtv-ambang-acuan">
            <div className="cbtv-ambang-baris">
              <label>
                <span>Nilai nol di bawah</span>
                <input
                  type="number" min={0} max={98} value={susun.isi.ambangNol}
                  onChange={(e) => setSusun({
                    ...susun,
                    isi: { ...susun.isi, ambangNol: Math.max(0, Math.min(98, Number(e.target.value) || 0)) },
                  })}
                />
                <i>% mirip</i>
              </label>
              <label>
                <span>Nilai penuh mulai</span>
                <input
                  type="number" min={1} max={100} value={susun.isi.ambangPenuh}
                  onChange={(e) => setSusun({
                    ...susun,
                    isi: { ...susun.isi, ambangPenuh: Math.max(1, Math.min(100, Number(e.target.value) || 0)) },
                  })}
                />
                <i>% mirip</i>
              </label>
            </div>
            <p className="cbt-catatan">
              Nilai penuh sengaja tidak menunggu kemiripan 100%. Kemiripan 100% hanya dicapai
              jawaban yang menyalin acuan kata demi kata, dan menuntutnya berarti memberi nilai
              tertinggi kepada yang menghafal. Bawaannya {AMBANG_NOL_BAWAAN}% dan {AMBANG_PENUH_BAWAAN}%.
            </p>
            <div className="cbtv-kurva">
              {[10, 25, 40, 55, 70, 85, 100].map((k) => (
                <span key={k}>
                  <b>{k}%</b> mirip <i>→</i> nilai {kurvaNilai(k, susun.isi.ambangNol, susun.isi.ambangPenuh)}
                </span>
              ))}
            </div>
          </div>

          <div className="cbtv-bobot-kabar">
            Jumlah bobot: <b className={jumlahBobot === 100 ? "ok" : "salah"}>{jumlahBobot}%</b>
            {jumlahBobot !== 100 && <> harus tepat 100%.</>}
            <button
              type="button"
              className="btn btn-light btn-mini"
              onClick={() => {
                const rata = ratakanBobotButir(susun.isi.butir.length);
                setSusun({
                  ...susun,
                  isi: { ...susun.isi, butir: susun.isi.butir.map((b, i) => ({ ...b, bobot: rata[i] })) },
                });
              }}
            >
              Ratakan
            </button>
          </div>

          {susun.isi.butir.map((b, urut) => {
            const kata = jumlahKata(b.jawaban);
            return (
              <div key={urut} className="cbtv-butir">
                <div className="cbt-baris">
                  <label className="cbtv-nomor"><span>Soal nomor</span>
                    <input
                      type="number" min={1} max={999} value={b.nomor}
                      onChange={(e) => ubahButir(urut, { nomor: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </label>
                  <label><span>Pertanyaan (tidak dinilai)</span>
                    <input
                      value={b.pertanyaan}
                      onChange={(e) => ubahButir(urut, { pertanyaan: e.target.value })}
                      placeholder="Disalin sekadar agar Anda tahu sedang menjawab soal yang mana"
                    />
                  </label>
                  <label className="cbtv-bobot"><span>Bobot %</span>
                    <input
                      type="number" min={0} max={100} value={b.bobot}
                      onChange={(e) => ubahButir(urut, { bobot: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-light btn-mini cbtv-buang"
                    onClick={() => setSusun({
                      ...susun,
                      isi: { ...susun.isi, butir: susun.isi.butir.filter((_, i) => i !== urut) },
                    })}
                  >
                    Buang
                  </button>
                </div>

                <div className="cbt-lebar cbtv-jawab">
                  <div className="cbtv-jawab-kepala">
                    <span>Jawaban acuan</span>
                    {/* Jumlah kata ditulis terus terang, dan warnanya berubah di
                        bawah ambang. Acuan yang terlalu pendek baru ketahuan saat
                        disimpan akan membuat dosen mengulang dari awal. */}
                    <em className={kata < MIN_KATA_ACUAN ? "kurang" : ""}>
                      {kata} kata{kata < MIN_KATA_ACUAN ? `, paling sedikit ${MIN_KATA_ACUAN}` : ""}
                    </em>
                  </div>
                  <textarea
                    rows={4}
                    value={b.jawaban}
                    onChange={(e) => ubahButir(urut, { jawaban: e.target.value })}
                    placeholder="Tulis jawaban terbaik yang Anda harapkan, dengan kalimat penuh"
                  />
                </div>

                <label className="cbt-lebar cbtv-wajib"><span>Istilah wajib, dipisah koma (opsional)</span>
                  <input
                    value={b.wajib.join(", ")}
                    onChange={(e) => ubahButir(urut, {
                      wajib: e.target.value.split(",").map((w) => w.trim().toLowerCase()).filter((w) => w !== ""),
                    })}
                    placeholder="mis. agenda setting, khalayak"
                  />
                </label>
              </div>
            );
          })}

          <div className="cbtv-susun-tombol">
            <button
              type="button"
              className="btn btn-light btn-mini"
              disabled={susun.isi.butir.length >= MAKS_BUTIR}
              onClick={() => setSusun({
                ...susun,
                isi: {
                  ...susun.isi,
                  butir: [
                    ...susun.isi.butir,
                    { nomor: susun.isi.butir.length + 1, pertanyaan: "", jawaban: "", bobot: 0, wajib: [] },
                  ],
                },
              })}
            >
              + Tambah butir
            </button>
            <button type="button" className="btn btn-primary btn-mini" disabled={sibuk} onClick={() => void simpan()}>
              {sibuk ? "Menyimpan…" : "Simpan acuan"}
            </button>
            <button
              type="button"
              className="btn btn-light btn-mini"
              onClick={() => { setSusun(null); setTolak([]); setNamaBerkas(""); }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ---------- ACUAN YANG SUDAH ADA ---------- */}
      {!susun && (
        <div className="panel">
          <b className="cbtv-sub">Acuan di portal ini</b>
          {muat ? (
            <div className="dempty">Memuat…</div>
          ) : daftar.length === 0 ? (
            <div className="dempty">
              Belum ada jawaban acuan. Unduh template di atas, isi di komputer, lalu unggah kembali.
            </div>
          ) : (
            <ul className="cbtv-daftar-rubrik">
              {daftar.map((a) => (
                <li key={a.id}>
                  <div>
                    <b>{a.nama}</b>
                    <small>
                      {a.butir.length} butir · nilai penuh mulai {a.ambangPenuh}% mirip · oleh {a.pemilik}
                      {a.dipakai > 0 && ` · dipakai ${a.dipakai} ujian`}
                    </small>
                  </div>
                  <span className="cbtv-aksi-rubrik">
                    {a.bolehSunting && (
                      <button
                        type="button" className="btn btn-light btn-mini"
                        onClick={() => setSusun({
                          id: a.id,
                          isi: {
                            nama: a.nama, keterangan: a.keterangan,
                            ambangNol: a.ambangNol, ambangPenuh: a.ambangPenuh,
                            butir: JSON.parse(JSON.stringify(a.butir)) as ButirAcuan[],
                          },
                        })}
                      >
                        Sunting
                      </button>
                    )}
                    <button
                      type="button" className="btn btn-light btn-mini"
                      onClick={() => setSusun({
                        id: null,
                        isi: {
                          nama: `${a.nama} (salinan)`, keterangan: a.keterangan,
                          ambangNol: a.ambangNol, ambangPenuh: a.ambangPenuh,
                          butir: JSON.parse(JSON.stringify(a.butir)) as ButirAcuan[],
                        },
                      })}
                    >
                      Salin
                    </button>
                    {a.bolehSunting && (
                      <button type="button" className="btn btn-light btn-mini" onClick={() => void hapus(a)}>Hapus</button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// LEMBAR PENILAIAN RUBRIK SATU PESERTA
// ============================================================

type KriteriaNilai = {
  urut: number;
  nama: string;
  bobot: number;
  levels: Array<{ level: number; deskriptor: string }>;
  aiLevel: number | null;
  aiAlasan: string;
  aiKeyakinan: number | null;
  finalLevel: number | null;
  level: number | null;
  namaTersimpan: string;
};

type EsaiNilai = {
  soalId: number;
  pertanyaan: string;
  bobot: number;
  jawaban: string;
  poin: number;
  catatan: string;
  dinilaiOleh: string;
  kriteria: KriteriaNilai[];
  hasil: ReturnType<typeof hitungRubrik> | null;
};

export type LembarPenilaian = {
  peserta: {
    id: number; nim: string; nama: string; email: string;
    nilaiMesin: number | null; nilaiAkhir: number | null;
    predikat: { huruf: string; sebutan: string };
    lulus: boolean; tertunda: number;
    disetujui: string | null; disetujuiOleh: string;
    laporanTerkirim: string | null;
    kemiripan: number; statusKemiripan: string;
  };
  rubrik: { nama: string; skalaMin: number; skalaMax: number; jumlahKriteria: number } | null;
  esai: EsaiNilai[];
  aiSiap: boolean;
};

export function LembarRubrik({
  ujianId,
  attemptId,
  onNilaiBerubah,
}: {
  ujianId: number;
  attemptId: number;
  /** Dipanggil ketika nilai berubah, supaya papan pantau ikut diperbarui. */
  onNilaiBerubah?: () => void;
}) {
  const [data, setData] = useState<LembarPenilaian | null>(null);
  const [muat, setMuat] = useState(true);
  const [sibuk, setSibuk] = useState("");
  const [kabar, setKabar] = useState("");
  const [galat, setGalat] = useState("");
  const [nilaiKetik, setNilaiKetik] = useState("");

  const muatLembar = useCallback(async () => {
    setMuat(true);
    try {
      const jawab = await fetch(`/api/cbt/penilaian?ujian=${ujianId}&attempt=${attemptId}`, { cache: "no-store" });
      const isi = await jawab.json();
      if (!jawab.ok || !isi.success) throw new Error(isi.message || "Gagal memuat.");
      setData(isi);
      setNilaiKetik(String(isi.peserta.nilaiAkhir ?? isi.peserta.nilaiMesin ?? ""));
      setGalat("");
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Lembar penilaian gagal dimuat.");
    } finally {
      setMuat(false);
    }
  }, [ujianId, attemptId]);

  // Ditunda satu putaran, bukan dipanggil langsung di badan efek.
  // Pemuat ini menyetel state pada baris pertamanya (setMuat(true)), dan
  // menyetel state serentak di dalam efek memicu gambar ulang berantai.
  // Pola yang sama dipakai panel CBT sejak awal.
  useEffect(() => {
    const tunda = window.setTimeout(() => void muatLembar(), 0);
    return () => window.clearTimeout(tunda);
  }, [muatLembar]);

  async function nilaiAi(ulangi: boolean, aksi: "ai" | "lokal" = "ai") {
    setSibuk(aksi); setGalat(""); setKabar("");
    try {
      const jawab = await fetch("/api/cbt/penilaian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi, ujian: ujianId, attempt: attemptId, ulangi }),
      });
      const isi = await jawab.json();
      if (!jawab.ok || !isi.success) throw new Error(isi.message || "Gagal menilai.");
      setKabar(isi.pesan || "Penilaian selesai.");
      if (Array.isArray(isi.gagal) && isi.gagal.length > 0) setGalat(isi.gagal.join(" · "));
      await muatLembar();
      onNilaiBerubah?.();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Penilaian gagal dijalankan.");
    } finally {
      setSibuk("");
    }
  }

  async function ubahLevel(soalId: number, urut: number, level: number | null) {
    setSibuk(`level-${soalId}-${urut}`); setGalat("");
    try {
      const jawab = await fetch("/api/cbt/penilaian", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "level", ujian: ujianId, attempt: attemptId, soal: soalId, kriteria: urut, level }),
      });
      const isi = await jawab.json();
      if (!jawab.ok || !isi.success) throw new Error(isi.message || "Gagal menyimpan.");
      if (isi.persetujuanDicabut) {
        setKabar("Nilai berubah, jadi pengesahan sebelumnya dicabut. Sahkan lagi bila sudah sesuai.");
      }
      await muatLembar();
      onNilaiBerubah?.();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Level gagal disimpan.");
    } finally {
      setSibuk("");
    }
  }

  async function sahkan() {
    setSibuk("setuju"); setGalat(""); setKabar("");
    try {
      const jawab = await fetch("/api/cbt/penilaian", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "setuju", ujian: ujianId, attempt: attemptId,
          nilai: nilaiKetik === "" ? null : Number(nilaiKetik),
        }),
      });
      const isi = await jawab.json();
      if (!jawab.ok || !isi.success) throw new Error(isi.message || "Gagal mengesahkan.");
      setKabar(
        isi.surat
          ? `Nilai ${isi.nilaiAkhir} disahkan. ${isi.surat.pesan}`
          : `Nilai ${isi.nilaiAkhir} disahkan.`,
      );
      await muatLembar();
      onNilaiBerubah?.();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Pengesahan gagal.");
    } finally {
      setSibuk("");
    }
  }

  async function batalkan() {
    setSibuk("batal"); setGalat("");
    try {
      await fetch("/api/cbt/penilaian", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "batal", ujian: ujianId, attempt: attemptId }),
      });
      setKabar("Pengesahan ditarik.");
      await muatLembar();
      onNilaiBerubah?.();
    } finally {
      setSibuk("");
    }
  }

  async function kirimSurat() {
    setSibuk("kirim"); setGalat(""); setKabar("");
    try {
      const jawab = await fetch("/api/cbt/kirim-nilai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "satu", ujian: ujianId, attempt: attemptId, paksa: true }),
      });
      const isi = await jawab.json();
      if (!jawab.ok || !isi.success) throw new Error(isi.message || "Gagal mengirim.");
      if (isi.terkirim) setKabar(isi.pesan);
      else setGalat(isi.pesan);
      await muatLembar();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Surat gagal dikirim.");
    } finally {
      setSibuk("");
    }
  }

  if (muat) return <div className="dempty">Memuat lembar penilaian…</div>;
  if (!data) return <div className="dsh-error">{galat || "Lembar penilaian tidak tersedia."}</div>;

  const p = data.peserta;
  const belumDinilai = data.esai.filter((e) => e.jawaban.trim() && (e.hasil?.belumDinilai ?? 0) > 0).length;

  return (
    <section className="cbtv-lembar">
      {kabar && <div className="dsh-ok">{kabar}</div>}
      {galat && <div className="dsh-error">{galat}</div>}

      {!data.rubrik ? (
        <div className="dsh-note">
          Ujian ini belum memakai rubrik, jadi esai dinilai seperti biasa, Anda mengetik
          angkanya sendiri pada lembar jawaban. Untuk memakai rubrik, pilih satu pada
          <b> Pengaturan ujian → Rubrik penilaian esai</b>.
        </div>
      ) : (
        <>
          <div className="cbtv-lembar-kepala">
            <div>
              <b>Penilaian rubrik: {data.rubrik.nama}</b>
              <small>
                {data.esai.length} soal esai · skala {data.rubrik.skalaMin}–{data.rubrik.skalaMax}
                {belumDinilai > 0 && ` · ${belumDinilai} belum dinilai`}
              </small>
            </div>
            {data.aiSiap ? (
              <span className="cbtv-aksi-rubrik">
                <button type="button" className="btn btn-primary btn-mini" disabled={sibuk === "ai"} onClick={() => void nilaiAi(false)}>
                  {sibuk === "ai" ? "Menilai…" : "✨ Nilai dengan AI"}
                </button>
                <button type="button" className="btn btn-light btn-mini" disabled={sibuk === "ai"} onClick={() => void nilaiAi(true)}>
                  Nilai ulang
                </button>
              </span>
            ) : (
              <span className="cbtv-lembar-aksi">
                <button
                  type="button" className="btn btn-light btn-mini"
                  disabled={sibuk === "lokal"}
                  onClick={() => void nilaiAi(true, "lokal")}
                >
                  {sibuk === "lokal" ? "Menghitung…" : "↻ Hitung ulang otomatis"}
                </button>
                <small className="cbt-catatan">Pembacaan isi oleh AI tidak tersedia.</small>
              </span>
            )}
          </div>

          <p className="cbt-catatan cbtv-prinsip">
            Esai dinilai otomatis dari ambang panjang rubrik saat peserta mengumpulkan.
            Ubah level bila ada yang meleset, nilainya ikut berubah.
          </p>

          {data.esai.length === 0 && <div className="dempty">Tidak ada soal esai pada lembar peserta ini.</div>}

          {data.esai.map((e) => (
            <article key={e.soalId} className="cbtv-esai">
              <header>
                <b>{e.pertanyaan.slice(0, 200)}{e.pertanyaan.length > 200 ? "…" : ""}</b>
                <span className="cbtv-esai-poin">
                  {e.hasil ? `${e.hasil.nilai} / 100 → ${e.poin} dari ${e.bobot} poin` : `${e.poin} / ${e.bobot} poin`}
                </span>
              </header>

              <div className="cbtv-jawaban">
                {e.jawaban.trim() ? e.jawaban : <i>Tidak dijawab.</i>}
              </div>

              {e.jawaban.trim() && (
                <div className="cbtv-tabel-bungkus">
                <table className="dsh-table cbtv-tabel-rubrik">
                  <thead>
                    <tr><th>Kriteria</th><th>Bobot</th><th>Level</th><th>Terbobot</th></tr>
                  </thead>
                  <tbody>
                    {e.kriteria.map((k) => {
                      const terbobot = e.hasil?.kriteria[k.urut]?.terbobot ?? 0;
                      const berbeda = k.namaTersimpan && k.namaTersimpan !== k.nama;
                      return (
                        <tr key={k.urut}>
                          <td data-kolom="Kriteria">
                            {k.nama}
                            {/* Rubriknya disunting sesudah jawaban ini dinilai.
                                Ditunjukkan apa adanya, bukan didiamkan: angka
                                di sebelahnya diberikan terhadap kriteria yang
                                namanya lain. */}
                            {berbeda && <small className="cbtv-berubah">dinilai sebagai “{k.namaTersimpan}”</small>}
                            {k.aiAlasan && (
                              <small className="cbtv-alasan">
                                {k.aiAlasan}
                                {k.aiKeyakinan !== null && k.aiKeyakinan < 70 && (
                                  <b> (keyakinan {k.aiKeyakinan}%, mohon diperiksa)</b>
                                )}
                              </small>
                            )}
                          </td>
                          <td className="cbtv-ka" data-kolom="Bobot">{k.bobot}%</td>
                          <td data-kolom="Level">
                            <select
                              value={k.level ?? ""}
                              disabled={sibuk === `level-${e.soalId}-${k.urut}`}
                              onChange={(ev) => void ubahLevel(e.soalId, k.urut, ev.target.value === "" ? null : Number(ev.target.value))}
                              title={k.levels.find((l) => l.level === k.level)?.deskriptor ?? ""}
                            >
                              <option value="">-</option>
                              {k.levels.map((l) => (
                                <option key={l.level} value={l.level} title={l.deskriptor}>
                                  {l.level}{l.deskriptor ? ` · ${l.deskriptor.slice(0, 60)}${l.deskriptor.length > 60 ? "…" : ""}` : ""}
                                </option>
                              ))}
                            </select>
                            {k.finalLevel !== null && <small className="cbtv-diubah">diubah Anda</small>}
                          </td>
                          <td className="cbtv-ka" data-kolom="Terbobot">{terbobot.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {e.hasil && (
                    <tfoot>
                      <tr>
                        <th colSpan={3}>Total skor terbobot</th>
                        <td className="cbtv-ka"><b>{e.hasil.totalTerbobot.toFixed(2)}</b></td>
                      </tr>
                      <tr>
                        <th colSpan={3}>Nilai bagian ini</th>
                        <td className="cbtv-ka"><b>{e.hasil.nilai}</b></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                </div>
              )}

              {e.catatan && (
                <div className="cbtv-catatan-ai">
                  <b>Umpan balik</b>
                  <p>{e.catatan}</p>
                  {e.dinilaiOleh && <small>oleh {e.dinilaiOleh}</small>}
                </div>
              )}
            </article>
          ))}
        </>
      )}

      {/* ---------- PENGESAHAN ----------
          Selalu tampil, termasuk pada ujian tanpa rubrik. Pengesahan bukan
          bagian dari rubrik — ia bagian dari nilai, dan tiap nilai yang
          dikirimkan ke mahasiswa harus melewatinya. */}
      <div className="cbtv-sahkan">
        <div className="cbtv-sahkan-kiri">
          <span className="cbtv-nilai-mesin">Hitungan sistem: <b>{p.nilaiMesin ?? "-"}</b></span>
          {p.tertunda > 0 && <span className="cbtv-tunggu">{p.tertunda} jawaban belum dinilai</span>}
        </div>

        {p.disetujui ? (
          <div className="cbtv-sahkan-kanan">
            <span className="cbtv-sudah">
              ✓ Nilai <b>{p.nilaiAkhir}</b> ({p.predikat.huruf}, {p.predikat.sebutan}) disahkan oleh {p.disetujuiOleh}
            </span>
            <span className="cbtv-aksi-rubrik">
              <button
                type="button" className="btn btn-light btn-mini"
                disabled={sibuk === "kirim" || !p.email}
                title={p.email ? `Kirim ke ${p.email}` : "Peserta ini belum punya alamat email di daftar mahasiswa."}
                onClick={() => void kirimSurat()}
              >
                {sibuk === "kirim" ? "Mengirim…" : p.laporanTerkirim ? "✉ Kirim ulang" : "✉ Kirim ke mahasiswa"}
              </button>
              <button type="button" className="btn btn-light btn-mini" disabled={sibuk === "batal"} onClick={() => void batalkan()}>
                Tarik pengesahan
              </button>
            </span>
          </div>
        ) : (
          <div className="cbtv-sahkan-kanan">
            <label className="cbtv-nilai-ketik">
              <span>Nilai akhir</span>
              <input
                type="number" min={0} max={100} value={nilaiKetik}
                onChange={(e) => setNilaiKetik(e.target.value)}
              />
            </label>
            <button type="button" className="btn btn-primary btn-mini" disabled={sibuk === "setuju"} onClick={() => void sahkan()}>
              {sibuk === "setuju" ? "Menyimpan…" : "SAHKAN NILAI"}
            </button>
          </div>
        )}
      </div>
      {!p.disetujui && (
        <p className="cbt-catatan">
          Angka di atas boleh diubah. Hitungan sistem dan nilai yang Anda sahkan sama-sama tersimpan.
          {!p.email && " Peserta ini belum punya email, jadi laporannya belum dapat dikirim."}
        </p>
      )}
    </section>
  );
}

// ============================================================
// KEMIRIPAN JAWABAN
// ============================================================

export type PasanganMirip = {
  questionId: number;
  skor: number;
  status: string;
  lawanId: number;
  lawanNama: string;
  lawanNim: string;
  sinyal: {
    kata?: number; urutan?: number; frasa?: number; bentuk?: number;
    frasaBersama?: string[]; kataBersama?: string[]; salinanUtuh?: boolean;
  };
};

export function DaftarMirip({ pasangan, skor, status }: { pasangan: PasanganMirip[]; skor: number; status: string }) {
  const [buka, setBuka] = useState<number | null>(null);
  const warna = STATUS_MIRIP_WARNA[status as StatusMirip] ?? "#64748b";

  return (
    <section className="cbtv-mirip">
      <div className="cbtv-mirip-kepala">
        <b>Kemiripan jawaban</b>
        <span className="cbtv-lencana" style={{ background: warna }}>
          {skor}% · {STATUS_MIRIP_LABEL[status as StatusMirip] ?? status}
        </span>
      </div>

      <p className="cbt-catatan">
        <b>Indikasi, bukan bukti.</b> Dua jawaban dapat mirip karena bahan belajarnya sama.
      </p>

      {pasangan.length === 0 ? (
        <div className="dempty">Tidak ada jawaban yang mirip dengan peserta lain.</div>
      ) : (
        <ul className="cbtv-mirip-daftar">
          {pasangan.map((m, i) => (
            <li key={`${m.questionId}-${m.lawanId}`}>
              <button type="button" onClick={() => setBuka(buka === i ? null : i)}>
                <span
                  className="cbtv-mirip-skor"
                  style={{ color: STATUS_MIRIP_WARNA[m.status as StatusMirip] ?? "#64748b" }}
                >
                  {m.skor}%
                </span>
                <span className="cbtv-mirip-lawan">{m.lawanNama} <code>{m.lawanNim}</code></span>
                <span className="cbtv-mirip-status">{STATUS_MIRIP_LABEL[m.status as StatusMirip] ?? m.status}</span>
              </button>
              {buka === i && (
                <div className="cbtv-mirip-rinci">
                  <div className="cbtv-sinyal">
                    <span>Kata bersama <b>{m.sinyal.kata ?? 0}%</b></span>
                    <span>Urutan kata <b>{m.sinyal.urutan ?? 0}%</b></span>
                    <span>Frasa langka <b>{m.sinyal.frasa ?? 0}%</b></span>
                    <span>Bentuk tulisan <b>{m.sinyal.bentuk ?? 0}%</b></span>
                  </div>
                  {(m.sinyal.frasaBersama ?? []).length > 0 && (
                    <div className="cbtv-frasa">
                      <b>Frasa yang hanya muncul pada kedua lembar ini:</b>
                      <ul>{(m.sinyal.frasaBersama ?? []).map((f, n) => <li key={n}>“{f}”</li>)}</ul>
                    </div>
                  )}
                  {(m.sinyal.kataBersama ?? []).length > 0 && (
                    <p className="cbtv-kata-langka">
                      <b>Kata tak lazim yang sama:</b> {(m.sinyal.kataBersama ?? []).join(", ")}
                    </p>
                  )}
                  {m.sinyal.salinanUtuh && (
                    <p className="cbtv-salinan">
                      Ada bagian yang sama persis kata demi kata. Ini yang paling layak Anda baca sendiri.
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ============================================================
// PEMUTAR REKAMAN
// ============================================================

type Penggal = { mulai: number; selesai: number; teks: string; kata: string; risiko: string; alasan: string };

export function PemutarRekaman({ ujianId, attemptId }: { ujianId: number; attemptId: number }) {
  const [rekaman, setRekaman] = useState<{
    status: string; durasi: number; potongan: number; transkrip: string;
    tanda: string; jumlahTanda: number; catatan: string;
  } | null>(null);
  const [penggal, setPenggal] = useState<Penggal[]>([]);
  const [bolehTranskrip, setBolehTranskrip] = useState(false);
  const [muat, setMuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState("");
  const [galat, setGalat] = useState("");
  const [kini, setKini] = useState(0);
  const [semuaPenggal, setSemuaPenggal] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const muatRekaman = useCallback(async () => {
    setMuat(true);
    try {
      const jawab = await fetch(`/api/cbt/rekaman?ujian=${ujianId}&attempt=${attemptId}`, { cache: "no-store" });
      const isi = await jawab.json();
      if (!jawab.ok || !isi.success) throw new Error(isi.message || "Gagal memuat.");
      setRekaman(isi.rekaman);
      setPenggal(isi.penggal || []);
      setBolehTranskrip(Boolean(isi.bolehTranskrip));
      setGalat("");
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Rekaman gagal dimuat.");
    } finally {
      setMuat(false);
    }
  }, [ujianId, attemptId]);

  // Ditunda satu putaran, bukan dipanggil langsung di badan efek.
  // Pemuat ini menyetel state pada baris pertamanya (setMuat(true)), dan
  // menyetel state serentak di dalam efek memicu gambar ulang berantai.
  // Pola yang sama dipakai panel CBT sejak awal.
  useEffect(() => {
    const tunda = window.setTimeout(() => void muatRekaman(), 0);
    return () => window.clearTimeout(tunda);
  }, [muatRekaman]);

  /**
   * Lompat ke satu detik di dalam rekaman.
   *
   * Sekarang sesederhana ini karena yang dimuat pemutar SATU berkas utuh
   * (lihat `utuh=1` pada /api/cbt/rekaman). Sebelumnya rekamannya diputar
   * potongan demi potongan, dan fungsi ini harus mencari potongan mana yang
   * memuat detik itu, mengganti sumbernya, menunggunya termuat, lalu mencari
   * posisinya di dalam potongan — empat langkah yang masing-masing punya cara
   * gagalnya sendiri, dan satu jeda terdengar tiap dua puluh detik.
   */
  const lompat = useCallback((detik: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = detik;
    } catch {
      // Pencarian pada berkas yang metadatanya belum terbaca. Dicoba lagi
      // begitu ia siap.
      audio.addEventListener("loadedmetadata", () => { audio.currentTime = detik; }, { once: true });
    }
    void audio.play().catch(() => {
      setGalat("Peramban menolak memutar otomatis. Tekan tombol putar pada pemutar di bawah.");
    });
    setKini(detik);
  }, []);

  /**
   * Transkripkan SAMPAI SELESAI, bukan satu gelombang lalu menyuruh menekan
   * lagi.
   *
   * Server mengerjakan rekaman sepotong demi sepotong karena satu permintaan
   * punya umur, dan dulu tiap gelombang berakhir dengan "tekan sekali lagi".
   * Untuk ujian sembilan puluh menit itu berarti belasan ketukan per peserta —
   * dan yang tidak sabar berhenti di tengah, dengan status "Bersih" yang
   * sebenarnya berarti "belum selesai diperiksa". Di sini gelombangnya
   * diulang sendiri sampai sisanya nol.
   */
  const transkripkan = useCallback(async () => {
    setSibuk(true); setGalat(""); setKabar("");
    try {
      for (let gelombang = 0; gelombang < 40; gelombang += 1) {
        const jawab = await fetch("/api/cbt/rekaman", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aksi: "transkrip", ujian: ujianId, attempt: attemptId }),
        });
        const isi = await jawab.json();
        if (!jawab.ok || !isi.success) throw new Error(isi.message || "Gagal.");
        if (!(Number(isi.sisa) > 0)) {
          setKabar("Rekaman selesai diperiksa.");
          break;
        }
        setKabar(`Memeriksa rekaman… sisa ${isi.sisa} potongan.`);
      }
      await muatRekaman();
    } catch (alasan: unknown) {
      setGalat(alasan instanceof Error ? alasan.message : "Transkrip gagal dibuat.");
    } finally {
      setSibuk(false);
    }
  }, [ujianId, attemptId, muatRekaman]);

  // Berjalan SENDIRI begitu rekaman dibuka dan belum diperiksa. Pengajar yang
  // membuka lembar seorang peserta sedang ingin tahu apakah ada yang
  // mencurigakan; menyuruhnya menekan tombol lebih dulu hanya menunda
  // jawabannya. Sekali per pembukaan — penjaga ini yang mencegahnya berulang
  // pada tiap gambar ulang.
  const sudahOtomatis = useRef(false);
  useEffect(() => {
    if (sudahOtomatis.current || !rekaman || !bolehTranskrip) return;
    if (rekaman.potongan === 0 || rekaman.transkrip === "selesai") return;
    sudahOtomatis.current = true;
    const jam = setTimeout(() => void transkripkan(), 0);
    return () => clearTimeout(jam);
  }, [rekaman, bolehTranskrip, transkripkan]);

  if (muat) return <div className="dempty">Memuat rekaman…</div>;
  if (!rekaman) return null;

  const ditandai = penggal.filter((p) => p.risiko !== "bersih");
  const tampil = semuaPenggal ? penggal : ditandai;
  const warnaTanda = STATUS_TANDA_WARNA[rekaman.tanda as StatusTanda] ?? "#64748b";

  return (
    <section className="cbtv-rekam">
      <div className="cbtv-rekam-kepala">
        <div>
          <b>Rekaman suara</b>
          <small>
            {rekaman.potongan > 0
              ? `${ejaJamRekaman(rekaman.durasi)} · ${rekaman.potongan} potongan`
              : rekaman.catatan || "Tidak ada rekaman."}
          </small>
        </div>
        {rekaman.potongan > 0 && (
          // "Bersih" hanya boleh tampil sesudah rekamannya BENAR-BENAR selesai
          // diperiksa. Sebelum itu status bawaannya memang "bersih", dan
          // menampilkannya apa adanya berarti menyatakan bersih rekaman yang
          // belum didengar sepotong pun.
          rekaman.transkrip === "selesai" ? (
            <span className="cbtv-lencana" style={{ background: warnaTanda }}>
              {STATUS_TANDA_LABEL[rekaman.tanda as StatusTanda] ?? rekaman.tanda}
              {rekaman.jumlahTanda > 0 && ` · ${rekaman.jumlahTanda}`}
            </span>
          ) : (
            <span className="cbtv-lencana" style={{ background: "#94a3b8" }}>
              {sibuk ? "Memeriksa…" : "Belum diperiksa"}
            </span>
          )
        )}
      </div>

      {kabar && <div className="dsh-ok">{kabar}</div>}
      {galat && <div className="dsh-error">{galat}</div>}

      {rekaman.potongan === 0 ? (
        <div className="dempty">
          {rekaman.catatan || "Peserta ini tidak punya rekaman. Ujiannya mungkin tidak merekam, atau mikrofonnya bermasalah."}
        </div>
      ) : (
        <>
          {/* SATU berkas, dari awal sampai habis. Potongannya disambung di
              server; pemutar ini tidak pernah berganti sumber, jadi tidak ada
              jeda tiap dua puluh detik dan bilah gesernya menunjuk posisi yang
              sebenarnya di dalam rekaman. */}
          <audio
            ref={audioRef}
            controls
            preload="metadata"
            className="cbtv-audio"
            src={`/api/cbt/rekaman?ujian=${ujianId}&attempt=${attemptId}&utuh=1`}
            onTimeUpdate={(e) => setKini(Math.floor(e.currentTarget.currentTime))}
          />
          <div className="cbtv-rekam-jam">
            {ejaJamRekaman(kini)} / {ejaJamRekaman(rekaman.durasi)}
          </div>

          <div className="cbtv-rekam-aksi">
            {bolehTranskrip && (
              <button type="button" className="btn btn-light btn-mini" disabled={sibuk} onClick={() => void transkripkan()}>
                {sibuk ? "Memproses…" : rekaman.transkrip === "selesai" ? "Transkrip ulang" : "📝 Buat transkrip"}
              </button>
            )}
            {penggal.length > 0 && (
              <button type="button" className="btn btn-light btn-mini" onClick={() => setSemuaPenggal((s) => !s)}>
                {semuaPenggal ? `Hanya yang ditandai (${ditandai.length})` : `Tampilkan seluruh transkrip (${penggal.length})`}
              </button>
            )}
          </div>

          {penggal.length === 0 ? (
            <p className="cbt-catatan">
              {bolehTranskrip
                ? "Belum ditranskripsikan. Tekan tombol di atas."
                : "Transkrip otomatis tidak tersedia. Rekamannya tetap dapat didengarkan."}
            </p>
          ) : (
            <>
              <p className="cbt-catatan">
                Penandaan otomatis <b>dapat keliru</b>. Tekan jamnya untuk mendengar sendiri.
              </p>
              {tampil.length === 0 ? (
                <div className="dempty">Tidak ada penggal yang ditandai.</div>
              ) : (
                <ul className="cbtv-penggal">
                  {tampil.map((p, i) => (
                    <li key={i} className={`cbtv-risiko-${p.risiko}`}>
                      <button type="button" className="cbtv-jam-tombol" onClick={() => lompat(p.mulai)}>
                        ▶ {ejaJamRekaman(p.mulai)}
                      </button>
                      <div>
                        <span className="cbtv-penggal-teks">{p.teks}</span>
                        {p.kata && <span className="cbtv-penggal-kata">“{p.kata}”</span>}
                        {p.alasan && <small className="cbtv-penggal-alasan">{p.alasan}</small>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
